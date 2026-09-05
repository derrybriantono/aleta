"use strict";

/**
 * Antrean permintaan penarikan satu perkara.
 *
 * ============================================================================
 * KENAPA ANTREAN, BUKAN LANGSUNG TARIK
 * ============================================================================
 *
 * Petugas membuka perkara di SIPP dan datanya belum ada di ALETA. Menariknya
 * saat itu juga berarti petugas menunggu satu sampai tiga menit di depan layar
 * - alamat e-Court buram, jadi daftar harus disapu lebih dulu sebelum halaman
 * perkaranya dapat ditemukan.
 *
 * Karena itu permintaannya dititipkan, bukan dikerjakan seketika. Penjadwal
 * mengambilnya di putaran berikutnya, dan panel terisi sendiri ketika petugas
 * membuka perkara itu lagi.
 *
 * ============================================================================
 * TIGA PENJAGAAN TERHADAP BANJIR PERMINTAAN
 * ============================================================================
 *
 * Tombol yang dapat ditekan siapa saja, sesering apa pun, mengarah ke satu
 * tempat: bot yang menghantam sistem Mahkamah Agung berulang kali. Karena itu:
 *
 *   1. SATU permintaan tertunda per perkara. Menekan tombol dua kali tidak
 *      menghasilkan dua penarikan.
 *   2. JEDA setelah selesai. Perkara yang baru ditarik tidak dapat diminta
 *      lagi dalam waktu dekat - datanya belum akan berbeda.
 *   3. BATAS antrean. Bila antrean sudah panjang, permintaan baru ditolak
 *      dengan alasan yang jelas, bukan diterima lalu tidak pernah dikerjakan.
 */

const crypto = require("crypto");

const botDb = require("./botDbService");
const { cleanText, normalizeCaseNumber } = require("./ecourtTextService");

/** Jeda sebelum satu perkara boleh diminta lagi setelah selesai ditarik. */
const JEDA_ULANG_MS = Number(process.env.ALETA_BOT_ECOURT_JEDA_PERMINTAAN_MS || 30 * 60 * 1000);

/** Batas permintaan tertunda sebelum yang baru ditolak. */
const BATAS_ANTREAN = Number(process.env.ALETA_BOT_ECOURT_BATAS_ANTREAN || 25);

let schemaReady = false;
let schemaPromise = null;

async function ensureSchema() {
  if (schemaReady) return true;
  if (schemaPromise) return schemaPromise;

  schemaPromise = (async () => {
    const siap = await botDb.ensureSchema();
    if (!siap) return false;

    await botDb.query(`
      CREATE TABLE IF NOT EXISTS aleta_bot_ecourt_permintaan (
        id VARCHAR(64) PRIMARY KEY,
        nomor_perkara VARCHAR(191) NOT NULL,
        diminta_oleh VARCHAR(191) NOT NULL DEFAULT '',
        diminta_pada DATETIME NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'menunggu',
        dikerjakan_pada DATETIME NULL,
        selesai_pada DATETIME NULL,
        catatan TEXT,
        INDEX idx_abep_status (status, diminta_pada),
        INDEX idx_abep_perkara (nomor_perkara, status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    schemaReady = true;
    return true;
  })();

  return schemaPromise;
}

/** Berapa permintaan yang sedang mengantre. */
async function jumlahMenunggu() {
  const rows = await botDb.query(
    "SELECT COUNT(*) AS jumlah FROM aleta_bot_ecourt_permintaan WHERE status IN ('menunggu', 'dikerjakan')"
  );
  return Number(rows && rows[0] && rows[0].jumlah) || 0;
}

/**
 * Menitipkan permintaan penarikan satu perkara.
 *
 * @returns {Promise<{ ok: boolean, alasan: string, keadaan?: object }>}
 */
async function titipkan(nomorPerkaraMentah, dimintaOleh = "") {
  const siap = await ensureSchema();
  if (!siap) return { ok: false, alasan: "database_bot_tidak_siap" };

  const nomorPerkara = normalizeCaseNumber(nomorPerkaraMentah);
  if (!nomorPerkara) return { ok: false, alasan: "nomor_perkara_kosong" };

  // 1. Sudah ada yang tertunda untuk perkara ini.
  const tertunda = await botDb.query(
    `SELECT id, status, diminta_pada FROM aleta_bot_ecourt_permintaan
      WHERE nomor_perkara = ? AND status IN ('menunggu', 'dikerjakan')
      LIMIT 1`,
    [nomorPerkara]
  );
  if (Array.isArray(tertunda) && tertunda.length > 0) {
    return {
      ok: true,
      alasan: "sudah_diantrekan",
      keadaan: {
        status: cleanText(tertunda[0].status),
        dimintaPada: botDb.fromMysqlDate(tertunda[0].diminta_pada),
      },
    };
  }

  // 2. Baru saja selesai ditarik - datanya belum akan berbeda.
  const barusan = await botDb.query(
    `SELECT selesai_pada FROM aleta_bot_ecourt_permintaan
      WHERE nomor_perkara = ? AND status = 'selesai' AND selesai_pada IS NOT NULL
      ORDER BY selesai_pada DESC LIMIT 1`,
    [nomorPerkara]
  );
  const selesaiTerakhir = barusan && barusan[0] ? botDb.fromMysqlDate(barusan[0].selesai_pada) : null;
  if (selesaiTerakhir && Date.now() - selesaiTerakhir.getTime() < JEDA_ULANG_MS) {
    return {
      ok: false,
      alasan: "baru_saja_ditarik",
      keadaan: { selesaiPada: selesaiTerakhir, jedaMenit: Math.round(JEDA_ULANG_MS / 60000) },
    };
  }

  // 3. Antrean sudah panjang. Menerima permintaan yang tidak akan dikerjakan
  //    dalam waktu dekat lebih buruk daripada menolaknya terang-terangan.
  const antre = await jumlahMenunggu();
  if (antre >= BATAS_ANTREAN) {
    return { ok: false, alasan: "antrean_penuh", keadaan: { antre, batas: BATAS_ANTREAN } };
  }

  await botDb.query(
    `INSERT INTO aleta_bot_ecourt_permintaan
       (id, nomor_perkara, diminta_oleh, diminta_pada, status)
     VALUES (?, ?, ?, ?, 'menunggu')`,
    [crypto.randomUUID(), nomorPerkara, cleanText(dimintaOleh).slice(0, 191), botDb.toMysqlDate(new Date())]
  );

  return { ok: true, alasan: "diantrekan", keadaan: { antre: antre + 1 } };
}

/** Keadaan permintaan terakhir untuk satu perkara. */
async function keadaan(nomorPerkaraMentah) {
  const siap = await ensureSchema();
  if (!siap) return null;

  const nomorPerkara = normalizeCaseNumber(nomorPerkaraMentah);
  if (!nomorPerkara) return null;

  const rows = await botDb.query(
    `SELECT status, diminta_pada, dikerjakan_pada, selesai_pada, catatan
       FROM aleta_bot_ecourt_permintaan
      WHERE nomor_perkara = ?
      ORDER BY diminta_pada DESC LIMIT 1`,
    [nomorPerkara]
  );
  const row = rows && rows[0];
  if (!row) return null;

  return {
    status: cleanText(row.status),
    dimintaPada: botDb.fromMysqlDate(row.diminta_pada),
    dikerjakanPada: botDb.fromMysqlDate(row.dikerjakan_pada),
    selesaiPada: botDb.fromMysqlDate(row.selesai_pada),
    catatan: cleanText(row.catatan),
  };
}

/** Permintaan tertua yang belum dikerjakan, untuk diambil penjadwal. */
async function ambilBerikutnya() {
  const siap = await ensureSchema();
  if (!siap) return null;

  const rows = await botDb.query(
    `SELECT id, nomor_perkara FROM aleta_bot_ecourt_permintaan
      WHERE status = 'menunggu'
      ORDER BY diminta_pada ASC LIMIT 1`
  );
  const row = rows && rows[0];
  if (!row) return null;

  await botDb.query(
    "UPDATE aleta_bot_ecourt_permintaan SET status = 'dikerjakan', dikerjakan_pada = ? WHERE id = ?",
    [botDb.toMysqlDate(new Date()), row.id]
  );

  return { id: row.id, nomorPerkara: cleanText(row.nomor_perkara) };
}

/** Menandai permintaan selesai atau gagal. */
async function tandaiSelesai(id, { berhasil = true, catatan = "" } = {}) {
  const siap = await ensureSchema();
  if (!siap) return false;

  await botDb.query(
    `UPDATE aleta_bot_ecourt_permintaan
        SET status = ?, selesai_pada = ?, catatan = ?
      WHERE id = ?`,
    [berhasil ? "selesai" : "gagal", botDb.toMysqlDate(new Date()), cleanText(catatan).slice(0, 2000), String(id || "")]
  );
  return true;
}

module.exports = {
  BATAS_ANTREAN,
  JEDA_ULANG_MS,
  ambilBerikutnya,
  ensureSchema,
  jumlahMenunggu,
  keadaan,
  tandaiSelesai,
  titipkan,
};
