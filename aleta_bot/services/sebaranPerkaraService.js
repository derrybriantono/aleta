"use strict";

/**
 * ============================================================================
 * SEBARAN PERKARA - BUTIR PERTAMA YANG MEMAKAI KERANGKA KEDUA
 * ============================================================================
 *
 * Empat butir dari Bab 9, dipilih dengan sengaja supaya keempatnya menguji
 * bagian kerangka yang berbeda:
 *
 *   ST02  jenis perkara       - ruas berkode, cakupan hampir sempurna
 *   ST03  jenis amar putusan  - ruas berkode, hanya perkara yang sudah putus
 *   ST13  verstek dan hadir   - ruas berkode bernilai dua, kelompoknya sedikit
 *   ST09  wilayah kecamatan   - ruas BEBAS dengan cakupan 32 persen
 *
 * Yang terakhir dipilih justru karena buruk. Pengukuran terhadap SIPP
 * sungguhan menemukan kecamatan hanya terisi 32,2 persen dengan 340 tulisan
 * berbeda - dan sebaran yang dihitung darinya akan tampak meyakinkan padahal
 * menggambarkan sepertiga data dengan ejaan yang belum baku.
 *
 * Butir itu tetap dibangun, sebab menyembunyikannya tidak membuat datanya
 * membaik. Yang dibangun bersamanya: peringatan yang menempel pada hasilnya,
 * sehingga siapa pun yang membacanya tahu persis apa yang sedang dilihatnya.
 */

const db = require("../db_config");

/** Pembungkus baca, sebentuk dengan layanan penilaian lain. */
function runQuery(sql, params = []) {
  return new Promise((selesai, gagal) => {
    db.query(sql, params, (galat, hasil) => {
      if (galat) gagal(galat);
      else selesai(Array.isArray(hasil) ? hasil : []);
    });
  });
}

const sebaran = require("./kerangkaSebaranService");

const BATAS_BARIS = 20000;

function teks(v) {
  return v === null || v === undefined ? "" : String(v);
}

/* ==========================================================================
 * ST02 - SEBARAN JENIS PERKARA
 * ========================================================================== */

const SQL_JENIS = `SELECT p.perkara_id AS perkaraId,
                          p.nomor_perkara AS nomorPerkara,
                          p.tanggal_pendaftaran AS tanggalDaftar,
                          p.jenis_perkara_nama AS kategori
                     FROM perkara p
                    WHERE p.tanggal_pendaftaran >= ? AND p.tanggal_pendaftaran <= ?
                    ORDER BY p.tanggal_pendaftaran ASC
                    LIMIT ${BATAS_BARIS}`;

async function barisJenisPerkara(rentang) {
  const hasil = await runQuery(SQL_JENIS, [rentang.mulai, rentang.selesai]);
  return hasil.map((r) => ({
    kunci: `${teks(r.nomorPerkara)}#ST02`,
    nomorPerkara: teks(r.nomorPerkara),
    tanggalDaftar: teks(r.tanggalDaftar).slice(0, 10),
    kategori: teks(r.kategori),
  }));
}

/* ==========================================================================
 * ST03 - SEBARAN JENIS AMAR PUTUSAN
 * ========================================================================== */

const SQL_AMAR = `SELECT p.perkara_id AS perkaraId,
                         p.nomor_perkara AS nomorPerkara,
                         p.jenis_perkara_nama AS jenisPerkara,
                         (SELECT MAX(x.status_putusan_nama) FROM perkara_putusan x WHERE x.perkara_id = p.perkara_id) AS kategori,
                         (SELECT MIN(x.tanggal_putusan) FROM perkara_putusan x WHERE x.perkara_id = p.perkara_id) AS tanggalPutusan
                    FROM perkara p
                   WHERE p.tanggal_pendaftaran >= ? AND p.tanggal_pendaftaran <= ?
                   ORDER BY p.tanggal_pendaftaran ASC
                   LIMIT ${BATAS_BARIS}`;

async function barisAmarPutusan(rentang) {
  const hasil = await runQuery(SQL_AMAR, [rentang.mulai, rentang.selesai]);

  // Perkara yang belum diputus dikeluarkan seluruhnya - bukan dihitung sebagai
  // "tidak terkategori". Perkara yang masih berjalan memang belum punya amar,
  // dan menghitungnya sebagai data yang hilang akan membuat cakupan tampak
  // buruk padahal tidak ada yang salah.
  return hasil
    .filter((r) => r.tanggalPutusan)
    .map((r) => ({
      kunci: `${teks(r.nomorPerkara)}#ST03`,
      nomorPerkara: teks(r.nomorPerkara),
      jenisPerkara: teks(r.jenisPerkara),
      tanggalPutusan: teks(r.tanggalPutusan).slice(0, 10),
      kategori: teks(r.kategori),
    }));
}

/* ==========================================================================
 * ST13 - PERKARA VERSTEK DAN KONTENSIUS
 * ========================================================================== */

const SQL_VERSTEK = `SELECT p.perkara_id AS perkaraId,
                            p.nomor_perkara AS nomorPerkara,
                            p.jenis_perkara_nama AS jenisPerkara,
                            (SELECT MAX(x.putusan_verstek) FROM perkara_putusan x WHERE x.perkara_id = p.perkara_id) AS verstek,
                            (SELECT MIN(x.tanggal_putusan) FROM perkara_putusan x WHERE x.perkara_id = p.perkara_id) AS tanggalPutusan
                       FROM perkara p
                      WHERE p.tanggal_pendaftaran >= ? AND p.tanggal_pendaftaran <= ?
                      ORDER BY p.tanggal_pendaftaran ASC
                      LIMIT ${BATAS_BARIS}`;

async function barisVerstek(rentang) {
  const hasil = await runQuery(SQL_VERSTEK, [rentang.mulai, rentang.selesai]);

  return hasil
    .filter((r) => r.tanggalPutusan)
    .map((r) => {
      // Ruas ini bernilai dua keadaan pada SIPP. Yang kosong TIDAK ditebak -
      // ia dibiarkan kosong dan terhitung sebagai tidak terkategori, sebab
      // menebaknya "hadir" akan menyembunyikan perkara yang keadaannya memang
      // belum tercatat.
      const v = r.verstek;
      let kategori = "";
      if (v === 1 || v === "1" || v === true) kategori = "Verstek";
      else if (v === 0 || v === "0" || v === false) kategori = "Dihadiri (kontensius)";

      return {
        kunci: `${teks(r.nomorPerkara)}#ST13`,
        nomorPerkara: teks(r.nomorPerkara),
        jenisPerkara: teks(r.jenisPerkara),
        tanggalPutusan: teks(r.tanggalPutusan).slice(0, 10),
        nilaiAsli: teks(v),
        kategori,
      };
    });
}

/* ==========================================================================
 * ST09 - SEBARAN WILAYAH MENURUT KECAMATAN
 * ========================================================================== */

const SQL_WILAYAH = `SELECT p.perkara_id AS perkaraId,
                            p.nomor_perkara AS nomorPerkara,
                            p.jenis_perkara_nama AS jenisPerkara,
                            (SELECT MAX(x.kecamatan) FROM perkara_pertimbangan_hukum x WHERE x.perkara_id = p.perkara_id) AS kategori
                       FROM perkara p
                      WHERE p.tanggal_pendaftaran >= ? AND p.tanggal_pendaftaran <= ?
                      ORDER BY p.tanggal_pendaftaran ASC
                      LIMIT ${BATAS_BARIS}`;

async function barisWilayah(rentang) {
  const hasil = await runQuery(SQL_WILAYAH, [rentang.mulai, rentang.selesai]);
  return hasil.map((r) => ({
    kunci: `${teks(r.nomorPerkara)}#ST09`,
    nomorPerkara: teks(r.nomorPerkara),
    jenisPerkara: teks(r.jenisPerkara),
    kategori: teks(r.kategori),
  }));
}

/* ==========================================================================
 * PENDAFTARAN
 * ========================================================================== */

function daftarkanSemua() {
  sebaran.daftarkan({
    kunci: "sebaranJenisPerkara",
    judul: "Sebaran Jenis Perkara",
    keterangan:
      "Perkara yang didaftarkan dikelompokkan menurut jenisnya. Gambaran ini menjadi dasar hampir seluruh perbandingan lain - beban majelis, lama penyelesaian, dan biaya semuanya berbeda menurut jenis perkaranya.",
    versiRumus: "sebaran-v1",
    ruasKategori: "jenis_perkara_nama",
    ruasBebas: false,
    caraHitung: {
      kelompok: "Nama jenis perkara sebagaimana tercatat berkode pada SIPP",
      baris: "Satu baris adalah satu perkara yang didaftarkan pada rentang ini",
      dikecualikan:
        "Tidak ada yang dikecualikan. Perkara yang jenisnya kosong tetap dihitung sebagai tidak terkategori, sebab ruas itu semestinya tidak pernah kosong",
      tabelSumber: "perkara - induk seluruh perkara yang didaftarkan",
      ruasSumber: "jenis_perkara_nama, tanggal_pendaftaran",
    },
    baris: barisJenisPerkara,
  });

  sebaran.daftarkan({
    kunci: "sebaranAmarPutusan",
    judul: "Sebaran Jenis Amar Putusan",
    keterangan:
      "Perkara yang sudah diputus dikelompokkan menurut jenis amarnya - dikabulkan, ditolak, tidak diterima, dicabut, atau gugur.",
    versiRumus: "sebaran-v1",
    ruasKategori: "status_putusan_nama",
    ruasBebas: false,
    caraHitung: {
      kelompok: "Nama status putusan sebagaimana tercatat berkode pada SIPP",
      baris: "Satu baris adalah satu perkara yang sudah punya tanggal putusan",
      dikecualikan:
        "Perkara yang belum diputus dikeluarkan seluruhnya - ia memang belum punya amar, dan menghitungnya sebagai data yang hilang membuat cakupan tampak buruk padahal tidak ada yang salah",
      tabelSumber: "perkara sebagai induk, perkara_putusan untuk status amarnya",
      ruasSumber: "status_putusan_nama, tanggal_putusan",
    },
    baris: barisAmarPutusan,
  });

  sebaran.daftarkan({
    kunci: "sebaranVerstek",
    judul: "Perkara Verstek dan Dihadiri",
    keterangan:
      "Perkara yang sudah diputus dikelompokkan menurut kehadiran pihak - diputus verstek karena tergugat tidak hadir, atau diperiksa dengan kedua pihak hadir.",
    versiRumus: "sebaran-v1",
    ruasKategori: "putusan_verstek",
    ruasBebas: false,
    caraHitung: {
      kelompok: "Dua keadaan menurut ruas berkode putusan_verstek pada SIPP",
      baris: "Satu baris adalah satu perkara yang sudah punya tanggal putusan",
      dikecualikan:
        "Perkara yang belum diputus. Perkara yang ruas verstek-nya kosong TIDAK ditebak - ia terhitung tidak terkategori, sebab menebaknya hadir akan menyembunyikan perkara yang keadaannya memang belum tercatat",
      tabelSumber: "perkara sebagai induk, perkara_putusan untuk penanda verstek-nya",
      ruasSumber: "putusan_verstek, tanggal_putusan",
    },
    baris: barisVerstek,
  });

  sebaran.daftarkan({
    kunci: "sebaranWilayahKecamatan",
    judul: "Sebaran Perkara Menurut Wilayah Hukum",
    keterangan:
      "Perkara dikelompokkan menurut kecamatan tempat tinggal pihak. Berguna untuk menimbang penempatan sidang di luar gedung dan biaya pemanggilan menurut radius.",
    versiRumus: "sebaran-v1",
    ruasKategori: "kecamatan",
    ruasBebas: true,
    catatanBebas:
      "Kecamatan diketik bebas di SIPP. Pengukuran terhadap basis data sungguhan menemukan ruas ini hanya terisi 32,2 persen dengan 340 tulisan berbeda - sehingga sebaran ini menggambarkan sepertiga data dengan ejaan yang belum dibakukan. Ia belum boleh dipakai menyimpulkan wilayah mana yang paling banyak berperkara.",
    caraHitung: {
      kelompok: "Tulisan kecamatan apa adanya, tanpa disatukan dan tanpa dibetulkan ejaannya",
      baris: "Satu baris adalah satu perkara yang didaftarkan pada rentang ini",
      dikecualikan:
        "Tidak ada yang dikecualikan. Perkara yang kecamatannya kosong justru dihitung sebagai tidak terkategori, dan angka itulah temuan sebenarnya pada butir ini",
      tabelSumber: "perkara sebagai induk, perkara_pertimbangan_hukum untuk kecamatan pihaknya",
      ruasSumber: "kecamatan, tanggal_pendaftaran",
    },
    baris: barisWilayah,
  });
}

function sambungan() {
  return {
    ST02: "sebaranJenisPerkara",
    ST03: "sebaranAmarPutusan",
    ST13: "sebaranVerstek",
    ST09: "sebaranWilayahKecamatan",
  };
}

function seluruhKueri() {
  return [
    { kode: "ST02", sql: SQL_JENIS },
    { kode: "ST03", sql: SQL_AMAR },
    { kode: "ST13", sql: SQL_VERSTEK },
    { kode: "ST09", sql: SQL_WILAYAH },
  ];
}

function namaSippDipakai() {
  return {
    tabel: ["perkara", "perkara_putusan", "perkara_pertimbangan_hukum"],
    ruas: [
      "jenis_perkara_nama",
      "kecamatan",
      "nomor_perkara",
      "perkara_id",
      "putusan_verstek",
      "status_putusan_nama",
      "tanggal_pendaftaran",
      "tanggal_putusan",
    ],
  };
}

module.exports = { daftarkanSemua, sambungan, seluruhKueri, namaSippDipakai };
