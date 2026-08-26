"use strict";

/**
 * Menjaga daftar tujuan tetap sehat, demi mencegah pemblokiran akun.
 *
 * Dua sinyal yang paling kuat membuat WhatsApp menandai sebuah nomor sebagai
 * pengirim spam justru bukan volume, melainkan:
 *
 *   1. MENGIRIM KE NOMOR YANG TIDAK TERDAFTAR. Tingkat gagal-kirim yang tinggi
 *      adalah ciri khas daftar nomor hasil kikisan data. Data telepon SIPP
 *      pasti memuat nomor mati, salah ketik, dan nomor yang bukan WhatsApp —
 *      dan setiap percobaan ke sana menambah sinyal buruk tanpa satu pun pesan
 *      sampai.
 *
 *   2. MENGIRIM TERUS KE NOMOR YANG MEMBLOKIR KITA. Tanda centang yang tidak
 *      pernah menjadi dua umumnya berarti pesan tidak pernah sampai ke ponsel
 *      penerima. Terus mengirim ke sana hanya menumpuk sinyal buruk.
 *
 * PRINSIP YANG DIPEGANG: pemeriksaan ini adalah pelengkap, bukan syarat. Bila
 * pemeriksaannya sendiri gagal — WhatsApp belum siap, jaringan bermasalah,
 * database tidak terjangkau — pengiriman TETAP DILANJUTKAN. Notifikasi
 * pengadilan tidak boleh berhenti gara-gara alat bantu anti-blokir tidak dapat
 * dijalankan.
 */

const botDb = require("./botDbService");
const logService = require("./logService");
const { normalizeIndonesianPhoneNumber } = require("../utils/phoneFormatter");

/** Hasil pemeriksaan pendaftaran ditahan lama; status ini jarang berubah. */
const REGISTRATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** Nomor yang tidak terdaftar diperiksa ulang lebih cepat, siapa tahu baru dipasang. */
const UNREGISTERED_TTL_MS = 24 * 60 * 60 * 1000;
/** Pesan dianggap tidak sampai bila sekian jam masih belum diterima ponsel. */
const UNDELIVERED_AFTER_HOURS = 24;
/** Berapa pesan berturut-turut tidak sampai sebelum nomor dihentikan. */
const UNDELIVERED_THRESHOLD = 3;

const registrationCache = new Map();
let schemaReady = false;

function normalize(number) {
  return normalizeIndonesianPhoneNumber(String(number || "").replace(/@c\.us$/i, ""));
}

async function ensureTable() {
  if (schemaReady) return true;
  const ready = await botDb.ensureSchema();
  if (!ready) return false;
  await botDb.query(`
    CREATE TABLE IF NOT EXISTS aleta_bot_recipient_suppressions (
      phone_number VARCHAR(32) PRIMARY KEY,
      reason VARCHAR(64) NOT NULL DEFAULT '',
      detail VARCHAR(255) NOT NULL DEFAULT '',
      suppressed_at DATETIME NOT NULL,
      released_at DATETIME NULL,
      updated_at DATETIME NOT NULL,
      INDEX idx_abrs_active (released_at, suppressed_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  schemaReady = true;
  return true;
}

/* ─────────────────────────────────────────────────────────────────────────
 * 1. Pemeriksaan nomor terdaftar WhatsApp
 * ───────────────────────────────────────────────────────────────────────── */

/**
 * Apakah nomor ini terdaftar di WhatsApp?
 *
 * @param {string} number nomor tujuan
 * @param {Function} checker fungsi pemeriksa dari klien WhatsApp; disuntikkan
 *   supaya modul ini tidak bergantung pada klien dan dapat diuji sendiri
 * @returns {Promise<{registered: boolean, checked: boolean, source: string}>}
 *   `checked:false` berarti pemeriksaannya TIDAK dapat dilakukan — pemanggil
 *   harus memperlakukannya sebagai izin lanjut, bukan larangan.
 */
async function isRegisteredOnWhatsapp(number, checker) {
  const normalized = normalize(number);
  if (!normalized) return { registered: false, checked: false, source: "nomor_tidak_valid" };
  if (typeof checker !== "function") {
    return { registered: true, checked: false, source: "pemeriksa_tidak_tersedia" };
  }

  const cached = registrationCache.get(normalized);
  if (cached && cached.expiresAt > Date.now()) {
    return { registered: cached.registered, checked: true, source: "cache" };
  }

  try {
    const hasil = await checker(`${normalized}@c.us`);
    const registered = hasil === true;
    registrationCache.set(normalized, {
      registered,
      expiresAt: Date.now() + (registered ? REGISTRATION_TTL_MS : UNREGISTERED_TTL_MS),
    });
    return { registered, checked: true, source: "whatsapp" };
  } catch (error) {
    // Gagal memeriksa BUKAN berarti nomornya tidak terdaftar. Melanjutkan
    // pengiriman jauh lebih baik daripada mendiamkan notifikasi pengadilan.
    void logService
      .logSystemEvent({
        eventType: "recipient_registration_check_failed",
        severity: "info",
        message: "Pemeriksaan nomor WhatsApp gagal; pengiriman tetap dilanjutkan.",
        metadata: { errorMessage: String(error.message || error).slice(0, 200) },
      })
      .catch(() => {});
    return { registered: true, checked: false, source: "pemeriksaan_gagal" };
  }
}

function forgetRegistration(number) {
  const normalized = normalize(number);
  if (normalized) registrationCache.delete(normalized);
}

/* ─────────────────────────────────────────────────────────────────────────
 * 2. Penghentian nomor yang pesannya tidak pernah sampai
 * ───────────────────────────────────────────────────────────────────────── */

/** Apakah nomor ini sedang dihentikan? Tidak pernah melempar galat. */
async function isSuppressed(number) {
  const normalized = normalize(number);
  if (!normalized) return false;
  try {
    const ready = await ensureTable();
    if (!ready) return false;
    const rows = await botDb.query(
      `SELECT phone_number FROM aleta_bot_recipient_suppressions
        WHERE phone_number = ? AND released_at IS NULL LIMIT 1`,
      [normalized]
    );
    return Array.isArray(rows) && rows.length > 0;
  } catch {
    return false;
  }
}

/** Sejauh mana ke belakang keterlibatan penerima masih dianggap berlaku. */
const ENGAGEMENT_WINDOW_DAYS = 90;

/**
 * Apakah penerima ini pernah benar-benar MEMBUKA pesan dari pengadilan?
 *
 * Percakapan dua arah adalah perlindungan terkuat terhadap pemblokiran: akun
 * yang pesannya dibaca dan dibalas terlihat sebagai layanan yang diinginkan,
 * sedangkan akun yang pesannya tidak pernah dibuka siapa pun terlihat sebagai
 * pengirim massal.
 *
 * Ukurannya memakai tanda terima yang sudah dicatat: ack >= 3 berarti pesan
 * dibuka penerima, bukan sekadar sampai ke ponselnya. Ini sengaja dipilih
 * daripada mencatat pesan masuk, karena mencatat nomor pengirim pesan masuk
 * berarti menyimpan data baru tentang warga - dan tanda terima sudah ada.
 *
 * GAGAL-TERBUKA ke arah "belum terlibat": bila database bermasalah, penerima
 * dianggap belum terlibat sehingga hanya kehilangan prioritas, tidak kehilangan
 * pesannya.
 */
async function hasEngaged(number) {
  const normalized = normalize(number);
  if (!normalized) return false;
  try {
    const sejak = new Date(Date.now() - ENGAGEMENT_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const rows = await botDb.query(
      `SELECT 1 FROM aleta_bot_message_logs
        WHERE recipient_number = ?
          AND ack >= 3
          AND created_at >= ?
        LIMIT 1`,
      [normalized, botDb.toMysqlDate(sejak)]
    );
    return Array.isArray(rows) && rows.length > 0;
  } catch {
    return false;
  }
}

async function suppress(number, { reason = "tidak_pernah_sampai", detail = "" } = {}) {
  const normalized = normalize(number);
  if (!normalized) return false;
  await ensureTable();
  const now = botDb.toMysqlDate(new Date());
  await botDb.query(
    `INSERT INTO aleta_bot_recipient_suppressions
       (phone_number, reason, detail, suppressed_at, released_at, updated_at)
     VALUES (?, ?, ?, ?, NULL, ?)
     ON DUPLICATE KEY UPDATE reason = VALUES(reason), detail = VALUES(detail),
       suppressed_at = VALUES(suppressed_at), released_at = NULL, updated_at = VALUES(updated_at)`,
    [normalized, String(reason).slice(0, 64), String(detail).slice(0, 255), now, now]
  );
  return true;
}

/** Mengaktifkan kembali sebuah nomor, mis. setelah datanya diperbaiki di SIPP. */
async function release(number) {
  const normalized = normalize(number);
  if (!normalized) return false;
  await ensureTable();
  const now = botDb.toMysqlDate(new Date());
  await botDb.query(
    `UPDATE aleta_bot_recipient_suppressions SET released_at = ?, updated_at = ?
      WHERE phone_number = ? AND released_at IS NULL`,
    [now, now, normalized]
  );
  forgetRegistration(normalized);
  return true;
}

/**
 * Menilai nomor mana yang pesannya tidak pernah sampai, lalu menghentikannya.
 *
 * Penilaiannya memakai catatan yang SUDAH ADA: sebuah pesan yang berstatus
 * terkirim tetapi tanda terimanya tidak pernah mencapai ponsel penerima setelah
 * sekian jam praktis berarti tidak sampai. Menunggu dulu sebelum menyimpulkan
 * itu penting — tanda terima datang menyusul, dan menilai terlalu cepat akan
 * menghentikan nomor yang sebenarnya sehat.
 *
 * Nomor yang PERNAH berhasil menerima dikecualikan: satu keberhasilan cukup
 * membuktikan nomornya sehat, dan kegagalan setelahnya lebih mungkin karena
 * ponsel mati daripada karena diblokir.
 */
async function evaluateUndeliverable({ hours = UNDELIVERED_AFTER_HOURS, threshold = UNDELIVERED_THRESHOLD } = {}) {
  const ready = await ensureTable();
  if (!ready) return { evaluated: 0, suppressed: 0, numbers: [] };

  const rows = await botDb.query(
    `SELECT recipient_number,
            COUNT(*) AS gagal_sampai,
            MAX(created_at) AS terakhir
       FROM aleta_bot_message_logs
      WHERE status = 'sent'
        AND recipient_number <> ''
        AND created_at < DATE_SUB(NOW(), INTERVAL ? HOUR)
        AND delivered_at IS NULL
        AND (ack IS NULL OR ack < 2)
        AND recipient_number NOT IN (
          SELECT DISTINCT recipient_number
            FROM aleta_bot_message_logs
           WHERE delivered_at IS NOT NULL OR ack >= 2
        )
      GROUP BY recipient_number
     HAVING gagal_sampai >= ?`,
    [Math.max(1, Number(hours) || UNDELIVERED_AFTER_HOURS), Math.max(1, Number(threshold) || UNDELIVERED_THRESHOLD)]
  );

  const daftar = Array.isArray(rows) ? rows : [];
  let dihentikan = 0;
  for (const row of daftar) {
    if (await isSuppressed(row.recipient_number)) continue;
    await suppress(row.recipient_number, {
      reason: "tidak_pernah_sampai",
      detail: `${row.gagal_sampai} pesan tidak pernah diterima ponsel penerima`,
    });
    dihentikan += 1;
  }

  if (dihentikan > 0) {
    await logService
      .logSystemEvent({
        eventType: "recipients_suppressed_undeliverable",
        severity: "warning",
        message: "Pengiriman ke sejumlah nomor dihentikan karena pesannya tidak pernah sampai.",
        metadata: { dihentikan, ambang: threshold, setelahJam: hours },
      })
      .catch(() => {});
  }

  return { evaluated: daftar.length, suppressed: dihentikan, numbers: daftar.map((row) => maskNumber(row.recipient_number)) };
}

/** Daftar nomor yang sedang dihentikan, untuk ditinjau admin di portal. */
async function listSuppressed(limit = 200) {
  const ready = await ensureTable();
  if (!ready) return [];
  const rows = await botDb.query(
    `SELECT phone_number, reason, detail, suppressed_at
       FROM aleta_bot_recipient_suppressions
      WHERE released_at IS NULL
      ORDER BY suppressed_at DESC
      LIMIT ?`,
    [Math.max(1, Math.min(1000, Number(limit) || 200))]
  );
  return (Array.isArray(rows) ? rows : []).map((row) => ({
    phoneNumber: maskNumber(row.phone_number),
    reason: row.reason,
    detail: row.detail,
    suppressedAt: row.suppressed_at,
  }));
}

function maskNumber(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length < 6) return "";
  return `${digits.slice(0, 4)}******${digits.slice(-2)}`;
}

function clearCache() {
  registrationCache.clear();
}

module.exports = {
  ENGAGEMENT_WINDOW_DAYS,
  REGISTRATION_TTL_MS,
  UNDELIVERED_AFTER_HOURS,
  UNDELIVERED_THRESHOLD,
  UNREGISTERED_TTL_MS,
  clearCache,
  evaluateUndeliverable,
  forgetRegistration,
  hasEngaged,
  isRegisteredOnWhatsapp,
  isSuppressed,
  listSuppressed,
  release,
  suppress,
};
