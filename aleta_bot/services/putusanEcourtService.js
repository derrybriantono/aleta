"use strict";

/**
 * Pemeriksaan putusan: apa yang tercatat di SIPP versus apa yang terbit di
 * e-Court.
 *
 * ============================================================================
 * TIGA KEGAGALAN YANG SEMUANYA DIAM
 * ============================================================================
 *
 * Perkara yang sudah diputus belum selesai urusannya. Salinan putusannya harus
 * terbit di e-Court supaya para pihak dapat mengambilnya, dan itu menuntut tiga
 * hal berturut-turut: barisnya terbentuk, dokumennya diunggah, lalu Panitera
 * menandatanganinya secara elektronik.
 *
 * Ketiganya dapat gagal tanpa satu pun peringatan:
 *
 *   1. SIPP sudah putus, tetapi tab Putusan e-Court tidak memuat baris apa pun.
 *      Datanya tidak pernah terbentuk di sana. Inilah yang disebut petugas
 *      "Menu Putusan E-Court Error".
 *   2. Barisnya ada, dokumen salinan putusannya belum diunggah.
 *   3. Dokumennya ada, tetapi Panitera belum menandatanganinya - dan salinan
 *      tanpa tanda tangan tidak dapat diambil para pihak.
 *
 * Ketiganya baru ketahuan saat para pihak datang menanyakan salinannya, kerap
 * berminggu-minggu kemudian. Layanan ini menjadikannya terlihat sejak hari
 * putusan.
 *
 * ============================================================================
 * YANG DISIMPAN HASIL BACAAN, BUKAN KESIMPULAN
 * ============================================================================
 *
 * Tabelnya menyimpan apa yang TERBACA di e-Court pada penarikan terakhir.
 * Kesimpulannya - "error", "belum diunggah", "belum TTE" - dibentuk saat
 * ditanya, dengan keadaan SIPP terbaru di tangan. Menyimpan kesimpulan berarti
 * kesimpulan itu ikut basi bersama datanya, dan perkara yang salinannya sudah
 * diunggah kemarin akan tetap tertandai bermasalah hari ini.
 */

const botDb = require("./botDbService");
const { normalizeCaseNumber } = require("./ecourtTextService");

/** Kesimpulan yang mungkin, dari yang paling genting. */
const KEADAAN = {
  ERROR_ECOURT: "putusan_ecourt_error",
  BELUM_UNGGAH: "salinan_belum_diunggah",
  BELUM_TTE: "belum_tte_panitera",
  LENGKAP: "lengkap",
  BELUM_PUTUS: "sipp_belum_putus",
  BELUM_DITARIK: "ecourt_belum_ditarik",
};

const SEBUTAN = {
  [KEADAAN.ERROR_ECOURT]: "Menu Putusan E-Court Error",
  [KEADAAN.BELUM_UNGGAH]: "Salinan putusan belum diunggah",
  [KEADAAN.BELUM_TTE]: "Belum TTE oleh Panitera",
  [KEADAAN.LENGKAP]: "Sudah di-TTE oleh Panitera",
  [KEADAAN.BELUM_PUTUS]: "Belum diputus",
  [KEADAAN.BELUM_DITARIK]: "Belum ditarik dari e-Court",
};

/** Keadaan yang menuntut tindakan. Dipakai penanda di layar-layar daftar. */
const PERLU_TINDAKAN = new Set([KEADAAN.ERROR_ECOURT, KEADAAN.BELUM_UNGGAH, KEADAAN.BELUM_TTE]);

let skemaSiap = false;

async function ensureSchema() {
  if (skemaSiap) return;

  // VARCHAR(191) pada utf8mb4: batas 767 bita berlaku PER KOLOM pada innodb
  // COMPACT, dan 191 x 4 = 764 - tepat di bawahnya.
  await botDb.query(`
    CREATE TABLE IF NOT EXISTS aleta_bot_ecourt_putusan (
      nomor_perkara VARCHAR(191) PRIMARY KEY,
      ada_tab TINYINT(1) NOT NULL DEFAULT 0,
      ada_baris TINYINT(1) NOT NULL DEFAULT 0,
      alasan VARCHAR(64) NOT NULL DEFAULT '',
      nomor_putusan VARCHAR(191) NOT NULL DEFAULT '',
      nomor_salinan VARCHAR(191) NOT NULL DEFAULT '',
      tanggal_putusan_teks VARCHAR(64) NOT NULL DEFAULT '',
      tanggal_bht_teks VARCHAR(64) NOT NULL DEFAULT '',
      dokumen_ada TINYINT(1) NOT NULL DEFAULT 0,
      dokumen_judul VARCHAR(255) NOT NULL DEFAULT '',
      dokumen_url TEXT,
      diunggah_oleh VARCHAR(191) NOT NULL DEFAULT '',
      tanggal_unggah_teks VARCHAR(64) NOT NULL DEFAULT '',
      panitera_nama VARCHAR(191) NOT NULL DEFAULT '',
      panitera_tte TINYINT(1) NOT NULL DEFAULT 0,
      panitera_tanggal_tte VARCHAR(64) NOT NULL DEFAULT '',
      diperiksa_pada DATETIME NOT NULL,
      INDEX idx_putusan_diperiksa (diperiksa_pada)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  skemaSiap = true;
}

/** Dipakai pengujian supaya skema tidak dianggap sudah terpasang. */
function lupakan() {
  skemaSiap = false;
}

function bersih(nilai, batas = 191) {
  return String(nilai === null || nilai === undefined ? "" : nilai)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, batas);
}

/**
 * Menyimpan hasil pembacaan tab Putusan e-Court untuk satu perkara.
 *
 * @param {string} nomorPerkara
 * @param {object} bacaan hasil extractPutusanEcourt dari penjelajah
 */
async function simpan(nomorPerkara, bacaan) {
  const nomor = normalizeCaseNumber(nomorPerkara);
  if (!nomor || !bacaan) return false;

  await ensureSchema();

  const dokumen = bacaan.dokumenSalinan || {};
  const panitera = bacaan.panitera || {};

  await botDb.query(
    `INSERT INTO aleta_bot_ecourt_putusan (
       nomor_perkara, ada_tab, ada_baris, alasan, nomor_putusan, nomor_salinan,
       tanggal_putusan_teks, tanggal_bht_teks, dokumen_ada, dokumen_judul, dokumen_url,
       diunggah_oleh, tanggal_unggah_teks, panitera_nama, panitera_tte,
       panitera_tanggal_tte, diperiksa_pada
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE
       ada_tab = VALUES(ada_tab), ada_baris = VALUES(ada_baris), alasan = VALUES(alasan),
       nomor_putusan = VALUES(nomor_putusan), nomor_salinan = VALUES(nomor_salinan),
       tanggal_putusan_teks = VALUES(tanggal_putusan_teks),
       tanggal_bht_teks = VALUES(tanggal_bht_teks),
       dokumen_ada = VALUES(dokumen_ada), dokumen_judul = VALUES(dokumen_judul),
       dokumen_url = VALUES(dokumen_url), diunggah_oleh = VALUES(diunggah_oleh),
       tanggal_unggah_teks = VALUES(tanggal_unggah_teks),
       panitera_nama = VALUES(panitera_nama), panitera_tte = VALUES(panitera_tte),
       panitera_tanggal_tte = VALUES(panitera_tanggal_tte),
       diperiksa_pada = NOW()`,
    [
      nomor,
      bacaan.adaTab ? 1 : 0,
      bacaan.adaBaris ? 1 : 0,
      bersih(bacaan.alasan, 64),
      bersih(bacaan.nomorPutusan),
      bersih(bacaan.nomorSalinan),
      bersih(bacaan.tanggalPutusanTeks, 64),
      bersih(bacaan.tanggalBhtTeks, 64),
      dokumen.ada ? 1 : 0,
      bersih(dokumen.judul, 255),
      String(dokumen.url || "").slice(0, 2000),
      bersih(bacaan.diunggahOleh),
      bersih(bacaan.tanggalUnggahTeks, 64),
      bersih(panitera.nama),
      panitera.sudahTte ? 1 : 0,
      bersih(panitera.tanggalTte, 64),
    ]
  );

  return true;
}

/**
 * Membaca catatan e-Court untuk sekumpulan perkara sekaligus.
 *
 * Daftar yang panjang dipecah menjadi beberapa kueri, TIDAK dipotong.
 * Memotongnya di 500 membuat perkara ke-501 dan seterusnya dijawab "belum
 * ditarik dari e-Court" - jawaban yang tampak sah, tidak menyalakan peringatan
 * apa pun, dan menyembunyikan justru putusan yang belum ditandatangani. Satu
 * halaman daftar sidang setahun penuh melewati 500 tanpa kesulitan.
 */
async function catatanBanyak(daftarNomor = []) {
  await ensureSchema();

  const nomor = [...new Set(daftarNomor.map((x) => normalizeCaseNumber(x)).filter(Boolean))];
  if (nomor.length === 0) return {};

  const peta = {};
  const rows = [];
  for (let mulai = 0; mulai < nomor.length; mulai += 500) {
    const bagian = nomor.slice(mulai, mulai + 500);
    const isian = bagian.map(() => "?").join(", ");
    const sebagian = await botDb.query(
      `SELECT nomor_perkara AS nomorPerkara, ada_tab AS adaTab, ada_baris AS adaBaris,
              alasan, nomor_putusan AS nomorPutusan, nomor_salinan AS nomorSalinan,
              tanggal_putusan_teks AS tanggalPutusanTeks, tanggal_bht_teks AS tanggalBhtTeks,
              dokumen_ada AS dokumenAda, dokumen_judul AS dokumenJudul, dokumen_url AS dokumenUrl,
              diunggah_oleh AS diunggahOleh, tanggal_unggah_teks AS tanggalUnggahTeks,
              panitera_nama AS paniteraNama, panitera_tte AS paniteraTte,
              panitera_tanggal_tte AS paniteraTanggalTte, diperiksa_pada AS diperiksaPada
         FROM aleta_bot_ecourt_putusan
        WHERE nomor_perkara IN (${isian})`,
      bagian
    );
    if (Array.isArray(sebagian)) rows.push(...sebagian);
  }

  for (const row of rows) {
    peta[String(row.nomorPerkara)] = {
      adaTab: Number(row.adaTab) === 1,
      adaBaris: Number(row.adaBaris) === 1,
      alasan: String(row.alasan || ""),
      nomorPutusan: String(row.nomorPutusan || ""),
      nomorSalinan: String(row.nomorSalinan || ""),
      tanggalPutusanTeks: String(row.tanggalPutusanTeks || ""),
      tanggalBhtTeks: String(row.tanggalBhtTeks || ""),
      dokumenAda: Number(row.dokumenAda) === 1,
      dokumenJudul: String(row.dokumenJudul || ""),
      dokumenUrl: String(row.dokumenUrl || ""),
      diunggahOleh: String(row.diunggahOleh || ""),
      tanggalUnggahTeks: String(row.tanggalUnggahTeks || ""),
      paniteraNama: String(row.paniteraNama || ""),
      paniteraTte: Number(row.paniteraTte) === 1,
      paniteraTanggalTte: String(row.paniteraTanggalTte || ""),
      diperiksaPada: row.diperiksaPada ? new Date(row.diperiksaPada).toISOString() : "",
    };
  }
  return peta;
}

/**
 * Menyimpulkan keadaan satu perkara.
 *
 * ============================================================================
 * TIDAK TAHU BUKAN TIDAK ADA MASALAH
 * ============================================================================
 *
 * Perkara yang belum pernah ditarik dari e-Court TIDAK dinyatakan lengkap, dan
 * juga tidak dinyatakan error. Keduanya akan menyesatkan: yang pertama
 * menyembunyikan pekerjaan, yang kedua menuduh e-Court atas sesuatu yang belum
 * pernah dilihat. Keadaannya disebut apa adanya - belum ditarik.
 *
 * @param {{ sudahPutus: boolean, tanggalPutusan?: string }} sipp
 * @param {object|null} ecourt catatan dari catatanBanyak
 */
function simpulkan(sipp, ecourt) {
  const sudahPutus = Boolean(sipp && sipp.sudahPutus);

  if (!sudahPutus) {
    return {
      keadaan: KEADAAN.BELUM_PUTUS,
      sebutan: SEBUTAN[KEADAAN.BELUM_PUTUS],
      perluTindakan: false,
      keterangan: "",
      ecourt: ecourt || null,
    };
  }

  if (!ecourt) {
    return {
      keadaan: KEADAAN.BELUM_DITARIK,
      sebutan: SEBUTAN[KEADAAN.BELUM_DITARIK],
      perluTindakan: false,
      keterangan:
        "Perkara sudah diputus, tetapi keadaan putusannya di e-Court belum pernah dibaca ALETA.",
      ecourt: null,
    };
  }

  // SIPP sudah putus, e-Court tidak memuat baris putusan sama sekali.
  if (!ecourt.adaBaris) {
    return {
      keadaan: KEADAAN.ERROR_ECOURT,
      sebutan: SEBUTAN[KEADAAN.ERROR_ECOURT],
      perluTindakan: true,
      keterangan:
        ecourt.alasan === "tab_putusan_tidak_ada"
          ? "Perkara sudah diputus di SIPP, tetapi halaman e-Court tidak punya tab Putusan."
          : "Perkara sudah diputus di SIPP, tetapi tab Putusan e-Court tidak memuat satu baris pun.",
      ecourt,
    };
  }

  if (!ecourt.dokumenAda) {
    return {
      keadaan: KEADAAN.BELUM_UNGGAH,
      sebutan: SEBUTAN[KEADAAN.BELUM_UNGGAH],
      perluTindakan: true,
      keterangan: "Baris putusan sudah ada di e-Court, dokumen salinan putusannya belum diunggah.",
      ecourt,
    };
  }

  if (!ecourt.paniteraTte) {
    return {
      keadaan: KEADAAN.BELUM_TTE,
      sebutan: SEBUTAN[KEADAAN.BELUM_TTE],
      perluTindakan: true,
      keterangan:
        "Salinan putusan sudah diunggah, tetapi Panitera belum menandatanganinya secara elektronik. Para pihak belum dapat mengambilnya.",
      ecourt,
    };
  }

  return {
    keadaan: KEADAAN.LENGKAP,
    sebutan: SEBUTAN[KEADAAN.LENGKAP],
    perluTindakan: false,
    keterangan: ecourt.paniteraTanggalTte
      ? `Diperiksa Panitera ${ecourt.paniteraNama || ""} pada ${ecourt.paniteraTanggalTte}.`.replace(
          /\s+/g,
          " "
        )
      : "",
    ecourt,
  };
}

/**
 * Keadaan putusan untuk sekumpulan perkara.
 *
 * @param {Array<{ nomorPerkara: string, sudahPutus: boolean, tanggalPutusan?: string }>} daftar
 */
async function keadaanBanyak(daftar = []) {
  const bersihDaftar = (Array.isArray(daftar) ? daftar : [])
    .map((x) => ({ ...x, nomorPerkara: normalizeCaseNumber(x && x.nomorPerkara) }))
    .filter((x) => x.nomorPerkara);

  if (bersihDaftar.length === 0) return {};

  const catatan = await catatanBanyak(bersihDaftar.map((x) => x.nomorPerkara)).catch(() => ({}));

  const hasil = {};
  for (const item of bersihDaftar) {
    hasil[item.nomorPerkara] = simpulkan(item, catatan[item.nomorPerkara] || null);
  }
  return hasil;
}

/** Keadaan putusan untuk satu perkara. */
async function keadaanSatu(nomorPerkara, sipp) {
  const nomor = normalizeCaseNumber(nomorPerkara);
  if (!nomor) return null;
  const hasil = await keadaanBanyak([{ ...sipp, nomorPerkara: nomor }]);
  return hasil[nomor] || null;
}

/** Perkara yang menuntut tindakan, untuk layar kendali berkas. */
async function daftarPerluTindakan({ batas = 100 } = {}) {
  await ensureSchema();

  const maksBaris = Math.min(Math.max(Math.floor(Number(batas) || 100), 1), 500);

  // Yang diambil hanya yang catatannya SUDAH ada di ALETA. Perkara yang belum
  // pernah ditarik tidak dapat dinilai dari sini - itu urusan penyandingan.
  const rows = await botDb.query(
    `SELECT nomor_perkara AS nomorPerkara, ada_baris AS adaBaris, dokumen_ada AS dokumenAda,
            panitera_tte AS paniteraTte, nomor_putusan AS nomorPutusan,
            diunggah_oleh AS diunggahOleh, tanggal_unggah_teks AS tanggalUnggahTeks,
            panitera_nama AS paniteraNama, diperiksa_pada AS diperiksaPada
       FROM aleta_bot_ecourt_putusan
      WHERE ada_baris = 0 OR dokumen_ada = 0 OR panitera_tte = 0
      ORDER BY ada_baris ASC, dokumen_ada ASC, panitera_tte ASC, diperiksa_pada DESC
      LIMIT ${maksBaris}`
  );

  return (Array.isArray(rows) ? rows : []).map((row) => ({
    nomorPerkara: String(row.nomorPerkara || ""),
    adaBaris: Number(row.adaBaris) === 1,
    dokumenAda: Number(row.dokumenAda) === 1,
    paniteraTte: Number(row.paniteraTte) === 1,
    nomorPutusan: String(row.nomorPutusan || ""),
    diunggahOleh: String(row.diunggahOleh || ""),
    tanggalUnggahTeks: String(row.tanggalUnggahTeks || ""),
    paniteraNama: String(row.paniteraNama || ""),
    diperiksaPada: row.diperiksaPada ? new Date(row.diperiksaPada).toISOString() : "",
  }));
}

module.exports = {
  KEADAAN,
  PERLU_TINDAKAN,
  SEBUTAN,
  catatanBanyak,
  daftarPerluTindakan,
  ensureSchema,
  keadaanBanyak,
  keadaanSatu,
  lupakan,
  simpan,
  simpulkan,
};
