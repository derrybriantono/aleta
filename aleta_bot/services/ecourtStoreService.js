"use strict";

/**
 * Penyimpan dokumen e-Court — Tahap 2 dari Jembatan e-Court.
 *
 * --- Kenapa ALETA perlu menyimpannya sendiri ---
 *
 * SIPP tidak tahu apa-apa tentang dokumen milik PIHAK. Yang dicatat SIPP hanya
 * dokumen milik pengadilan: petitum, putusan, akta cerai, BAS. Jawaban,
 * Replik, dan Duplik yang diunggah para pihak lewat e-Court sama sekali tidak
 * punya jejak di sana - SIPP cuma tahu AGENDA sidangnya sebagai teks bebas.
 *
 * Karena itu ALETA harus punya catatannya sendiri. Dari catatan inilah ALETA
 * tahu mana dokumen yang BARU dan belum pernah diberitahukan - sesuatu yang
 * mustahil disimpulkan dari SIPP.
 *
 * --- Semua tulisan masuk ke database ALETA, bukan SIPP ---
 *
 * bot_db_config.js secara aktif melempar galat saat startup bila database
 * internal ALETA sampai bertabrakan nama dengan SIPP. Tabel di sini mengikuti
 * pola aleta_bot_* dan hidup di database ALETA sendiri. SIPP tetap murni
 * sumber baca.
 */

const crypto = require("crypto");

const botDb = require("./botDbService");
const { cleanText, normalizeCaseNumber } = require("./ecourtTextService");

let schemaReady = false;
let schemaPromise = null;

/**
 * Status verifikasi dokumen di e-Court.
 *
 * "belum" adalah keadaan awal: dokumen sudah diunggah pihak tetapi majelis
 * belum memutuskan. Notifikasi TIDAK BOLEH terpicu pada keadaan ini - lihat
 * catatan di ecourtEventClassifierService.js.
 */
const VERIFICATION_STATUSES = new Set(["belum", "valid", "tidak_valid"]);

async function ensureSchema() {
  if (schemaReady) return true;
  if (schemaPromise) return schemaPromise;

  schemaPromise = (async () => {
    const siap = await botDb.ensureSchema();
    if (!siap) return false;

    await botDb.query(`
      CREATE TABLE IF NOT EXISTS aleta_bot_ecourt_documents (
        id VARCHAR(64) PRIMARY KEY,
        document_key VARCHAR(191) NOT NULL,
        nomor_perkara VARCHAR(191) NOT NULL DEFAULT '',
        registrasi_ecourt VARCHAR(191) NOT NULL DEFAULT '',
        judul_dokumen VARCHAR(255) NOT NULL DEFAULT '',
        jenis_dokumen VARCHAR(64) NOT NULL DEFAULT '',
        peran_pengunggah VARCHAR(64) NOT NULL DEFAULT '',
        email_pengunggah VARCHAR(191) NOT NULL DEFAULT '',
        diunggah_pada DATETIME NULL,
        status_verifikasi VARCHAR(32) NOT NULL DEFAULT 'belum',
        agenda VARCHAR(255) NOT NULL DEFAULT '',
        tanggal_sidang DATETIME NULL,
        batas_unggah DATETIME NULL,
        batas_unggah_teks VARCHAR(191) NOT NULL DEFAULT '',
        pengingat_terakhir DATETIME NULL,
        berkas_pdf TEXT,
        berkas_word TEXT,
        sumber_url TEXT,
        diberitahukan_pada DATETIME NULL,
        alasan_tidak_diberitahukan VARCHAR(191) NOT NULL DEFAULT '',
        pertama_terlihat DATETIME NOT NULL,
        terakhir_terlihat DATETIME NOT NULL,
        updated_at DATETIME NOT NULL,
        UNIQUE KEY uq_abed_key (document_key),
        INDEX idx_abed_perkara (nomor_perkara),
        INDEX idx_abed_notifikasi (status_verifikasi, diberitahukan_pada),
        INDEX idx_abed_batas (batas_unggah, pengingat_terakhir)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await botDb.query(`
      CREATE TABLE IF NOT EXISTS aleta_bot_ecourt_sync_runs (
        id VARCHAR(64) PRIMARY KEY,
        dimulai_pada DATETIME NOT NULL,
        selesai_pada DATETIME NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'berjalan',
        perkara_diperiksa INT NOT NULL DEFAULT 0,
        dokumen_terlihat INT NOT NULL DEFAULT 0,
        dokumen_baru INT NOT NULL DEFAULT 0,
        berkas_terunduh INT NOT NULL DEFAULT 0,
        jumlah_galat INT NOT NULL DEFAULT 0,
        galat_terakhir TEXT,
        catatan TEXT,
        INDEX idx_abesr_mulai (dimulai_pada)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    schemaReady = true;
    return true;
  })().catch((error) => {
    schemaPromise = null;
    throw error;
  });

  return schemaPromise;
}

/**
 * Identitas tetap sebuah dokumen.
 *
 * Dipakai untuk mengenali dokumen yang SAMA pada sinkronisasi berikutnya,
 * supaya tidak diunduh ulang dan tidak diberitahukan dua kali.
 *
 * Sengaja TIDAK memakai status verifikasi sebagai bahan kunci: status justru
 * yang diharapkan berubah (belum -> valid), dan bila ikut jadi bahan kunci,
 * dokumen yang sama akan dianggap dokumen baru begitu majelis memverifikasinya.
 */
function buildDocumentKey({ nomorPerkara, judulDokumen, emailPengunggah, diunggahPada }) {
  const bahan = [
    normalizeCaseNumber(nomorPerkara),
    cleanText(judulDokumen).toLowerCase(),
    cleanText(emailPengunggah).toLowerCase(),
    diunggahPada ? new Date(diunggahPada).toISOString().slice(0, 16) : "",
  ].join("|");
  return crypto.createHash("sha256").update(bahan).digest("hex").slice(0, 40);
}

function normalizeStatus(value) {
  const teks = cleanText(value).toLowerCase();
  if (!teks) return "belum";
  if (VERIFICATION_STATUSES.has(teks)) return teks;
  if (/tidak\s*valid|ditolak/.test(teks)) return "tidak_valid";
  // "Sudah diverifikasi Majelis/Hakim (Dokumen Valid)" pada halaman e-Court.
  if (/valid|terverifikasi|diverifikasi/.test(teks)) return "valid";
  return "belum";
}

function toDateOrNull(value) {
  if (!value) return null;
  const waktu = value instanceof Date ? value : new Date(value);
  return Number.isFinite(waktu.getTime()) ? waktu : null;
}

/**
 * Menyimpan satu dokumen yang ditemukan jembatan.
 *
 * Dokumen yang sudah pernah tersimpan akan DIPERBARUI, bukan digandakan.
 * Yang diperbarui hanya bagian yang memang bisa berubah di e-Court: status
 * verifikasi, jalur berkas, dan agenda. Waktu pemberitahuan TIDAK pernah
 * disentuh di sini - itu urusan pekerja notifikasi.
 *
 * @returns {Promise<{ documentKey: string, baru: boolean, statusBerubah: boolean, statusLama: string }>}
 */
async function recordDocument(input = {}) {
  await ensureSchema();

  const nomorPerkara = normalizeCaseNumber(input.nomorPerkara);
  const judulDokumen = cleanText(input.judulDokumen);
  const emailPengunggah = cleanText(input.emailPengunggah);
  const diunggahPada = toDateOrNull(input.diunggahPada);
  const documentKey = input.documentKey || buildDocumentKey({ nomorPerkara, judulDokumen, emailPengunggah, diunggahPada });
  const status = normalizeStatus(input.statusVerifikasi);
  const sekarang = new Date();

  const tersimpan = await botDb.query(
    `SELECT id, status_verifikasi FROM aleta_bot_ecourt_documents WHERE document_key = ? LIMIT 1`,
    [documentKey]
  );

  if (Array.isArray(tersimpan) && tersimpan.length > 0) {
    const statusLama = String(tersimpan[0].status_verifikasi || "belum");
    await botDb.query(
      `UPDATE aleta_bot_ecourt_documents
          SET status_verifikasi = ?,
              jenis_dokumen = ?,
              agenda = ?,
              tanggal_sidang = ?,
              -- Batas waktu ikut disegarkan tiap sinkronisasi karena e-Court dapat
              -- menggesernya saat sidang ditunda.
              batas_unggah = ?,
              batas_unggah_teks = ?,
              -- Jalur berkas hanya ditimpa bila jembatan benar-benar membawa
              -- yang baru. Sinkronisasi yang gagal mengunduh tidak boleh
              -- menghapus berkas yang sudah berhasil diunduh sebelumnya.
              berkas_pdf = COALESCE(?, berkas_pdf),
              berkas_word = COALESCE(?, berkas_word),
              sumber_url = COALESCE(?, sumber_url),
              registrasi_ecourt = ?,
              peran_pengunggah = ?,
              terakhir_terlihat = ?,
              updated_at = ?
        WHERE document_key = ?`,
      [
        status,
        cleanText(input.jenisDokumen),
        cleanText(input.agenda),
        toDateOrNull(input.tanggalSidang) ? botDb.toMysqlDate(toDateOrNull(input.tanggalSidang)) : null,
        toDateOrNull(input.batasUnggah) ? botDb.toMysqlDate(toDateOrNull(input.batasUnggah)) : null,
        cleanText(input.batasUnggahTeks).slice(0, 191),
        input.berkasPdf ? String(input.berkasPdf) : null,
        input.berkasWord ? String(input.berkasWord) : null,
        input.sumberUrl ? String(input.sumberUrl) : null,
        cleanText(input.registrasiEcourt),
        cleanText(input.peranPengunggah),
        botDb.toMysqlDate(sekarang),
        botDb.toMysqlDate(sekarang),
        documentKey,
      ]
    );
    return { documentKey, baru: false, statusBerubah: statusLama !== status, statusLama };
  }

  await botDb.query(
    `INSERT INTO aleta_bot_ecourt_documents (
       id, document_key, nomor_perkara, registrasi_ecourt, judul_dokumen, jenis_dokumen,
       peran_pengunggah, email_pengunggah, diunggah_pada, status_verifikasi, agenda,
       tanggal_sidang, batas_unggah, batas_unggah_teks, berkas_pdf, berkas_word, sumber_url,
       pertama_terlihat, terakhir_terlihat, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      crypto.randomUUID(),
      documentKey,
      nomorPerkara,
      cleanText(input.registrasiEcourt),
      judulDokumen,
      cleanText(input.jenisDokumen),
      cleanText(input.peranPengunggah),
      emailPengunggah,
      diunggahPada ? botDb.toMysqlDate(diunggahPada) : null,
      status,
      cleanText(input.agenda),
      toDateOrNull(input.tanggalSidang) ? botDb.toMysqlDate(toDateOrNull(input.tanggalSidang)) : null,
      toDateOrNull(input.batasUnggah) ? botDb.toMysqlDate(toDateOrNull(input.batasUnggah)) : null,
      cleanText(input.batasUnggahTeks).slice(0, 191),
      input.berkasPdf ? String(input.berkasPdf) : null,
      input.berkasWord ? String(input.berkasWord) : null,
      input.sumberUrl ? String(input.sumberUrl) : null,
      botDb.toMysqlDate(sekarang),
      botDb.toMysqlDate(sekarang),
      botDb.toMysqlDate(sekarang),
    ]
  );
  return { documentKey, baru: true, statusBerubah: true, statusLama: "" };
}

/** Apakah dokumen dengan kunci ini sudah pernah tersimpan? */
async function hasDocument(documentKey) {
  await ensureSchema();
  const rows = await botDb.query(
    `SELECT 1 FROM aleta_bot_ecourt_documents WHERE document_key = ? LIMIT 1`,
    [String(documentKey || "")]
  );
  return Array.isArray(rows) && rows.length > 0;
}

/**
 * Dokumen yang sudah diverifikasi valid tetapi belum pernah diberitahukan.
 *
 * Inilah antrean kerja pekerja notifikasi. Penyaringan status ada di SINI,
 * bukan hanya di pengklasifikasi, supaya dokumen yang belum diverifikasi tidak
 * pernah sampai terbaca pekerja notifikasi sama sekali.
 */
async function listPendingNotification({ limit = 50 } = {}) {
  await ensureSchema();
  const batas = Math.max(1, Math.min(500, Number(limit) || 50));
  const rows = await botDb.query(
    `SELECT * FROM aleta_bot_ecourt_documents
      WHERE status_verifikasi = 'valid'
        AND diberitahukan_pada IS NULL
        AND alasan_tidak_diberitahukan = ''
      ORDER BY diunggah_pada ASC, pertama_terlihat ASC
      LIMIT ${batas}`
  );
  return Array.isArray(rows) ? rows : [];
}

/** Menandai dokumen sudah diberitahukan. */
async function markNotified(documentKey, { at = new Date() } = {}) {
  await ensureSchema();
  await botDb.query(
    `UPDATE aleta_bot_ecourt_documents
        SET diberitahukan_pada = ?, updated_at = ?
      WHERE document_key = ?`,
    [botDb.toMysqlDate(at), botDb.toMysqlDate(at), String(documentKey || "")]
  );
}

/**
 * Menandai dokumen sengaja TIDAK diberitahukan, beserta alasannya.
 *
 * Dipisahkan dari markNotified supaya bisa dibedakan saat diperiksa: dokumen
 * yang dilewati karena memang tidak perlu (mis. berkas pendaftaran milik
 * pengunggah sendiri) tidak sama dengan dokumen yang gagal dikirim.
 */
async function markSkipped(documentKey, reason) {
  await ensureSchema();
  const sekarang = new Date();
  await botDb.query(
    `UPDATE aleta_bot_ecourt_documents
        SET alasan_tidak_diberitahukan = ?, updated_at = ?
      WHERE document_key = ?`,
    [cleanText(reason).slice(0, 191) || "tidak_dijelaskan", botDb.toMysqlDate(sekarang), String(documentKey || "")]
  );
}

/** Seluruh dokumen satu perkara, terbaru lebih dulu. */
async function listByCase(nomorPerkara, { limit = 100 } = {}) {
  await ensureSchema();
  const batas = Math.max(1, Math.min(500, Number(limit) || 100));
  const rows = await botDb.query(
    `SELECT * FROM aleta_bot_ecourt_documents
      WHERE nomor_perkara = ?
      ORDER BY diunggah_pada DESC, pertama_terlihat DESC
      LIMIT ${batas}`,
    [normalizeCaseNumber(nomorPerkara)]
  );
  return Array.isArray(rows) ? rows : [];
}

/** Memulai catatan satu kali jalan sinkronisasi. */
async function startSyncRun({ catatan = "" } = {}) {
  await ensureSchema();
  const id = crypto.randomUUID();
  await botDb.query(
    `INSERT INTO aleta_bot_ecourt_sync_runs (id, dimulai_pada, status, catatan)
     VALUES (?, ?, 'berjalan', ?)`,
    [id, botDb.toMysqlDate(new Date()), cleanText(catatan)]
  );
  return id;
}

/** Menutup catatan sinkronisasi dengan hasilnya. */
async function finishSyncRun(runId, hasil = {}) {
  await ensureSchema();
  await botDb.query(
    `UPDATE aleta_bot_ecourt_sync_runs
        SET selesai_pada = ?, status = ?, perkara_diperiksa = ?, dokumen_terlihat = ?,
            dokumen_baru = ?, berkas_terunduh = ?, jumlah_galat = ?, galat_terakhir = ?
      WHERE id = ?`,
    [
      botDb.toMysqlDate(new Date()),
      String(hasil.status || "selesai"),
      Number(hasil.perkaraDiperiksa || 0),
      Number(hasil.dokumenTerlihat || 0),
      Number(hasil.dokumenBaru || 0),
      Number(hasil.berkasTerunduh || 0),
      Number(hasil.jumlahGalat || 0),
      hasil.galatTerakhir ? String(hasil.galatTerakhir).slice(0, 2000) : null,
      String(runId || ""),
    ]
  );
}

/** Ringkasan untuk status layanan bot. */
async function getStats() {
  await ensureSchema();
  try {
    const rows = await botDb.query(
      `SELECT
         COUNT(*) AS total,
         SUM(status_verifikasi = 'valid') AS valid,
         SUM(status_verifikasi = 'belum') AS belum,
         SUM(status_verifikasi = 'valid' AND diberitahukan_pada IS NULL AND alasan_tidak_diberitahukan = '') AS menunggu_kirim
       FROM aleta_bot_ecourt_documents`
    );
    const baris = Array.isArray(rows) && rows[0] ? rows[0] : {};
    const terakhir = await botDb.query(
      `SELECT dimulai_pada, selesai_pada, status, dokumen_baru
         FROM aleta_bot_ecourt_sync_runs ORDER BY dimulai_pada DESC LIMIT 1`
    );
    return {
      total: Number(baris.total || 0),
      valid: Number(baris.valid || 0),
      belum: Number(baris.belum || 0),
      menungguKirim: Number(baris.menunggu_kirim || 0),
      sinkronTerakhir: Array.isArray(terakhir) && terakhir[0] ? terakhir[0] : null,
    };
  } catch {
    // Status layanan tidak boleh gagal hanya karena bagian ini bermasalah.
    return { total: null, valid: null, belum: null, menungguKirim: null, sinkronTerakhir: null };
  }
}

module.exports = {
  VERIFICATION_STATUSES,
  buildDocumentKey,
  ensureSchema,
  finishSyncRun,
  getStats,
  hasDocument,
  listByCase,
  listPendingNotification,
  markNotified,
  markSkipped,
  normalizeStatus,
  recordDocument,
  startSyncRun,
};
