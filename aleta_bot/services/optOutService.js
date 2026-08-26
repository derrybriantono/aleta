"use strict";

/**
 * Berhenti berlangganan pemberitahuan ("BERHENTI").
 *
 * Ini adalah pengaman anti-blokir yang paling berdampak sekaligus paling murah.
 * WhatsApp menimbang LAPORAN dan PEMBLOKIRAN dari penerima jauh lebih berat
 * daripada jumlah pesan. Orang menekan "Laporkan" ketika merasa tidak punya
 * cara lain menghentikan pesan yang tidak mereka inginkan. Memberi jalan keluar
 * yang jelas dan langsung bekerja mengubah calon laporan menjadi satu baris
 * catatan di sini — dan satu laporan yang tidak terjadi jauh lebih berharga
 * daripada satu pesan yang berhasil terkirim.
 *
 * Yang dihentikan hanya pemberitahuan otomatis. Bila orang yang sama nanti
 * bertanya sendiri ke bot, pertanyaannya tetap dijawab: menjawab orang yang
 * menghubungi kita lebih dulu tidak pernah menjadi masalah, dan menolak
 * menjawab justru membuat layanan terasa rusak.
 */

const botDb = require("./botDbService");
const logService = require("./logService");
const { normalizeIndonesianPhoneNumber } = require("../utils/phoneFormatter");

/** Kata yang menghentikan pemberitahuan. */
const OPT_OUT_KEYWORDS = new Set([
  "berhenti",
  "stop",
  "unsubscribe",
  "berhenti langganan",
  "stop notifikasi",
  "hentikan",
]);

/** Kata yang menyalakannya kembali. */
const RESUME_KEYWORDS = new Set(["lanjut", "lanjutkan", "mulai lagi", "aktifkan", "berlangganan"]);

const OPT_OUT_CONFIRMATION = [
  "Baik, pemberitahuan otomatis ke nomor ini dihentikan.",
  "",
  "Anda tidak akan lagi menerima pemberitahuan jadwal sidang, biaya perkara, atau akta dari kami.",
  "Panggilan resmi tetap disampaikan Jurusita atau Petugas Pos seperti biasa, jadi proses perkara Anda tidak terpengaruh.",
  "",
  'Bila suatu saat ingin menerimanya kembali, balas "LANJUT".',
].join("\n");

const RESUME_CONFIRMATION = [
  "Pemberitahuan otomatis untuk nomor ini diaktifkan kembali.",
  "",
  'Balas "BERHENTI" kapan saja bila ingin menghentikannya lagi.',
].join("\n");

/** Baris ajakan yang ditempelkan di kaki pemberitahuan. */
const OPT_OUT_FOOTER = 'Balas BERHENTI bila tidak ingin menerima pemberitahuan ini.';

/**
 * Cache agar pemeriksaan tidak memukul database untuk setiap pesan keluar.
 * Umurnya pendek supaya permintaan berhenti berlaku hampir seketika.
 */
const CACHE_TTL_MS = 30 * 1000;
const cache = new Map();

function normalize(number) {
  return normalizeIndonesianPhoneNumber(String(number || "").replace(/@c\.us$/i, ""));
}

function normalizeKeyword(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Apakah teks ini permintaan berhenti? */
function isOptOutKeyword(text) {
  return OPT_OUT_KEYWORDS.has(normalizeKeyword(text));
}

/** Apakah teks ini permintaan berlangganan kembali? */
function isResumeKeyword(text) {
  return RESUME_KEYWORDS.has(normalizeKeyword(text));
}

async function ensureTable() {
  const ready = await botDb.ensureSchema();
  if (!ready) return false;
  await botDb.query(`
    CREATE TABLE IF NOT EXISTS aleta_bot_opt_outs (
      phone_number VARCHAR(32) PRIMARY KEY,
      opted_out_at DATETIME NOT NULL,
      resumed_at DATETIME NULL,
      source VARCHAR(64) NOT NULL DEFAULT 'whatsapp_keyword',
      note VARCHAR(255) NOT NULL DEFAULT '',
      updated_at DATETIME NOT NULL,
      INDEX idx_abo_active (resumed_at, opted_out_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  return true;
}

/**
 * Apakah nomor ini sedang berhenti berlangganan?
 *
 * Sengaja TIDAK melempar error: kegagalan database tidak boleh mendiamkan
 * seluruh pemberitahuan pengadilan. Bila tidak dapat dipastikan, jawabannya
 * "tidak berhenti" dan kegagalannya dicatat.
 */
async function isOptedOut(number) {
  const normalized = normalize(number);
  if (!normalized) return false;

  const cached = cache.get(normalized);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  try {
    await ensureTable();
    const rows = await botDb.query(
      `SELECT phone_number FROM aleta_bot_opt_outs WHERE phone_number = ? AND resumed_at IS NULL LIMIT 1`,
      [normalized]
    );
    const value = Array.isArray(rows) && rows.length > 0;
    cache.set(normalized, { value, expiresAt: Date.now() + CACHE_TTL_MS });
    return value;
  } catch (error) {
    await logService
      .logSystemEvent({
        eventType: "opt_out_check_failed",
        severity: "warning",
        message: "Status berhenti berlangganan tidak dapat diperiksa; pengiriman diteruskan.",
        metadata: { errorMessage: error.message },
      })
      .catch(() => {});
    return false;
  }
}

/** Mencatat permintaan berhenti. */
async function optOut(number, { source = "whatsapp_keyword", note = "" } = {}) {
  const normalized = normalize(number);
  if (!normalized) return { ok: false, reason: "nomor_tidak_valid" };

  await ensureTable();
  const now = botDb.toMysqlDate(new Date());
  await botDb.query(
    `INSERT INTO aleta_bot_opt_outs (phone_number, opted_out_at, resumed_at, source, note, updated_at)
     VALUES (?, ?, NULL, ?, ?, ?)
     ON DUPLICATE KEY UPDATE opted_out_at = VALUES(opted_out_at), resumed_at = NULL,
       source = VALUES(source), note = VALUES(note), updated_at = VALUES(updated_at)`,
    [normalized, now, String(source).slice(0, 64), String(note).slice(0, 255), now]
  );
  cache.set(normalized, { value: true, expiresAt: Date.now() + CACHE_TTL_MS });

  await logService
    .logSystemEvent({
      eventType: "recipient_opted_out",
      severity: "info",
      message: "Penerima meminta berhenti menerima pemberitahuan otomatis.",
      metadata: { phoneNumber: maskNumber(normalized), source },
    })
    .catch(() => {});

  return { ok: true, phoneNumber: normalized, message: OPT_OUT_CONFIRMATION };
}

/** Membatalkan permintaan berhenti. */
async function resume(number, { source = "whatsapp_keyword" } = {}) {
  const normalized = normalize(number);
  if (!normalized) return { ok: false, reason: "nomor_tidak_valid" };

  await ensureTable();
  const now = botDb.toMysqlDate(new Date());
  await botDb.query(
    `UPDATE aleta_bot_opt_outs SET resumed_at = ?, updated_at = ? WHERE phone_number = ? AND resumed_at IS NULL`,
    [now, now, normalized]
  );
  cache.set(normalized, { value: false, expiresAt: Date.now() + CACHE_TTL_MS });

  await logService
    .logSystemEvent({
      eventType: "recipient_resumed",
      severity: "info",
      message: "Penerima mengaktifkan kembali pemberitahuan otomatis.",
      metadata: { phoneNumber: maskNumber(normalized), source },
    })
    .catch(() => {});

  return { ok: true, phoneNumber: normalized, message: RESUME_CONFIRMATION };
}

/** Daftar nomor yang sedang berhenti, untuk ditampilkan di portal. */
async function listOptOuts(limit = 200) {
  await ensureTable();
  const safeLimit = Math.max(1, Math.min(1000, Number(limit) || 200));
  const rows = await botDb.query(
    `SELECT phone_number, opted_out_at, source, note
       FROM aleta_bot_opt_outs
      WHERE resumed_at IS NULL
      ORDER BY opted_out_at DESC
      LIMIT ?`,
    [safeLimit]
  );
  return (Array.isArray(rows) ? rows : []).map((row) => ({
    phoneNumber: maskNumber(row.phone_number),
    optedOutAt: row.opted_out_at,
    source: row.source,
    note: row.note,
  }));
}

function maskNumber(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length < 6) return "";
  return `${digits.slice(0, 4)}******${digits.slice(-2)}`;
}

function clearCache() {
  cache.clear();
}

module.exports = {
  OPT_OUT_CONFIRMATION,
  OPT_OUT_FOOTER,
  OPT_OUT_KEYWORDS,
  RESUME_CONFIRMATION,
  RESUME_KEYWORDS,
  clearCache,
  isOptOutKeyword,
  isOptedOut,
  isResumeKeyword,
  listOptOuts,
  optOut,
  resume,
};
