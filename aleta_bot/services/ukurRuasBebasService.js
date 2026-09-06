"use strict";

/**
 * ============================================================================
 * MENGUKUR RUAS TEKS BEBAS SEBELUM MERAPIKANNYA
 * ============================================================================
 *
 * Lima ruas SIPP dipakai sebagai sumber penilaian padahal isinya teks bebas.
 * Selama belum dirapikan, diagram yang dibangun di atasnya menampilkan kode
 * angka sebagai nama daerah, dan satu alasan penundaan yang ditulis dengan
 * lima ejaan berbeda terhitung sebagai lima kelompok.
 *
 * Yang dikerjakan di sini BUKAN merapikannya, melainkan MENGUKURNYA. Membangun
 * tabel pemetaan sebelum melihat bentuk berantakannya adalah membangun untuk
 * masalah yang dikira, bukan masalah yang ada. Pengukuran dahulu, pemetaan
 * kemudian - dan pemetaan itu disusun manusia yang membaca daftarnya.
 *
 * ============================================================================
 * SATU HAL YANG SUDAH DITEMUKAN TANPA MENJALANKAN INI
 * ============================================================================
 *
 * SIPP ternyata SUDAH punya tabel acuan kecamatan sendiri - `ref_kecamatan_new`
 * - dan `sebaranWilayah()` sudah menjoinnya. Jadi persoalan wilayah bukan
 * "belum ada tabel acuan", melainkan "berapa banyak isian yang tidak cocok
 * dengan tabel acuan yang sudah ada". Itu pertanyaan yang berbeda, dan
 * jawabannya menentukan apakah perapiannya sepuluh menit atau dua hari.
 *
 * Pengukur ini menjawab pertanyaan itu, dan pertanyaan yang sama untuk keempat
 * ruas lainnya.
 *
 * ============================================================================
 * MEMBACA, TIDAK MENULIS
 * ============================================================================
 *
 * Seluruh kueri di sini SELECT. Itu bukan kebiasaan melainkan syarat:
 * `verify-sipp-baca-saja.js` dan `verify-pemisahan-database.js` memindai berkas
 * ini, dan kueri yang tidak diawali SELECT akan menggagalkan gerbang sebelum
 * apa pun dinaikkan. Itulah sebabnya kuerinya ditulis harfiah di sini alih-alih
 * dirakit dari potongan - kueri yang dirakit tidak terjangkau pemindaian teks.
 */

const db = require("../db_config");

function runQuery(sql, params = []) {
  return new Promise((selesai, gagal) => {
    db.query(sql, params, (galat, hasil) => {
      if (galat) gagal(galat);
      else selesai(hasil || []);
    });
  });
}

const aman = (janji) => janji.catch((galat) => ({ galat: String(galat.message || galat).slice(0, 200) }));

/** Ruas yang diukur, beserta alasan mengapa ia perlu dirapikan. */
const RUAS = [
  {
    kunci: "kecamatan",
    label: "Kecamatan asal pihak",
    tabel: "pihak.kecamatan",
    dipakaiOleh: "Sebaran wilayah, dan seluruh penilaian yang membagi menurut daerah",
    catatan:
      "SIPP sudah punya ref_kecamatan_new. Yang diukur di sini berapa isian yang TIDAK cocok dengannya.",
  },
  {
    kunci: "alasanDitunda",
    label: "Alasan penundaan sidang",
    tabel: "perkara_jadwal_sidang.alasan_ditunda",
    dipakaiOleh: "Pola penundaan, dan penilaian ketaatan jadwal",
    catatan: "Teks bebas. Alasan dan hasil kerap tercampur dalam satu tulisan.",
  },
  {
    kunci: "pekerjaan",
    label: "Pekerjaan pihak",
    tabel: "pihak.pekerjaan",
    dipakaiOleh: "Profil pihak",
    catatan: "Teks bebas.",
  },
  {
    kunci: "pendidikan",
    label: "Pendidikan pihak",
    tabel: "pihak.pendidikan",
    dipakaiOleh: "Profil pihak",
    catatan: "Teks bebas, tetapi jenjangnya baku sehingga kemungkinan besar lebih rapi.",
  },
  {
    kunci: "uraianBiaya",
    label: "Uraian transaksi biaya perkara",
    tabel: "perkara_biaya.uraian",
    dipakaiOleh: "Peta biaya, dan seluruh penilaian keuangan perkara",
    catatan: "Teks bebas yang diketik kasir.",
  },
  {
    kunci: "ruangSidang",
    label: "Ruang sidang",
    tabel: "perkara_jadwal_sidang.ruangan",
    dipakaiOleh: "Antrian sidang dan pemerataan penggunaan ruang",
    catatan: "Teks bebas.",
  },
];

/**
 * Mengukur satu ruas: berapa baris seluruhnya, berapa yang terisi, berapa
 * banyak tulisan yang berbeda, dan tiga puluh tulisan yang paling sering.
 *
 * Tiga puluh, bukan sepuluh: yang menentukan berat-ringannya perapian justru
 * ekornya - sepuluh teratas hampir selalu tampak rapi.
 */
async function ukurKecamatan() {
  const jumlah = await aman(
    runQuery(
      `SELECT COUNT(*) AS semua,
              SUM(CASE WHEN TRIM(COALESCE(ph.kecamatan, '')) <> '' THEN 1 ELSE 0 END) AS terisi,
              COUNT(DISTINCT NULLIF(TRIM(COALESCE(ph.kecamatan, '')), '')) AS berbeda
         FROM pihak ph`,
      []
    )
  );
  const cocok = await aman(
    runQuery(
      `SELECT COUNT(*) AS cocok
         FROM pihak ph
         JOIN ref_kecamatan_new rk ON rk.kecamatan_kode = ph.kecamatan
        WHERE TRIM(COALESCE(ph.kecamatan, '')) <> ''`,
      []
    )
  );
  const acuan = await aman(
    runQuery(`SELECT COUNT(*) AS jumlah FROM ref_kecamatan_new`, [])
  );
  const tidakCocok = await aman(
    runQuery(
      `SELECT TRIM(ph.kecamatan) AS nilai, COUNT(*) AS jumlah
         FROM pihak ph
         LEFT JOIN ref_kecamatan_new rk ON rk.kecamatan_kode = ph.kecamatan
        WHERE TRIM(COALESCE(ph.kecamatan, '')) <> ''
          AND rk.kecamatan_kode IS NULL
        GROUP BY TRIM(ph.kecamatan)
        ORDER BY jumlah DESC
        LIMIT 30`,
      []
    )
  );
  return { jumlah, cocok, acuan, tidakCocok };
}

async function ukurAlasanDitunda() {
  const jumlah = await aman(
    runQuery(
      `SELECT COUNT(*) AS semua,
              SUM(CASE WHEN TRIM(COALESCE(j.alasan_ditunda, '')) <> '' THEN 1 ELSE 0 END) AS terisi,
              COUNT(DISTINCT NULLIF(TRIM(COALESCE(j.alasan_ditunda, '')), '')) AS berbeda
         FROM perkara_jadwal_sidang j`,
      []
    )
  );
  const sering = await aman(
    runQuery(
      `SELECT TRIM(j.alasan_ditunda) AS nilai, COUNT(*) AS jumlah
         FROM perkara_jadwal_sidang j
        WHERE TRIM(COALESCE(j.alasan_ditunda, '')) <> ''
        GROUP BY TRIM(j.alasan_ditunda)
        ORDER BY jumlah DESC
        LIMIT 30`,
      []
    )
  );
  return { jumlah, sering };
}

async function ukurPekerjaan() {
  const jumlah = await aman(
    runQuery(
      `SELECT COUNT(*) AS semua,
              SUM(CASE WHEN TRIM(COALESCE(ph.pekerjaan, '')) <> '' THEN 1 ELSE 0 END) AS terisi,
              COUNT(DISTINCT NULLIF(TRIM(COALESCE(ph.pekerjaan, '')), '')) AS berbeda
         FROM pihak ph`,
      []
    )
  );
  const sering = await aman(
    runQuery(
      `SELECT TRIM(ph.pekerjaan) AS nilai, COUNT(*) AS jumlah
         FROM pihak ph
        WHERE TRIM(COALESCE(ph.pekerjaan, '')) <> ''
        GROUP BY TRIM(ph.pekerjaan)
        ORDER BY jumlah DESC
        LIMIT 30`,
      []
    )
  );
  return { jumlah, sering };
}

async function ukurPendidikan() {
  const jumlah = await aman(
    runQuery(
      `SELECT COUNT(*) AS semua,
              SUM(CASE WHEN TRIM(COALESCE(ph.pendidikan, '')) <> '' THEN 1 ELSE 0 END) AS terisi,
              COUNT(DISTINCT NULLIF(TRIM(COALESCE(ph.pendidikan, '')), '')) AS berbeda
         FROM pihak ph`,
      []
    )
  );
  const sering = await aman(
    runQuery(
      `SELECT TRIM(ph.pendidikan) AS nilai, COUNT(*) AS jumlah
         FROM pihak ph
        WHERE TRIM(COALESCE(ph.pendidikan, '')) <> ''
        GROUP BY TRIM(ph.pendidikan)
        ORDER BY jumlah DESC
        LIMIT 30`,
      []
    )
  );
  return { jumlah, sering };
}

async function ukurUraianBiaya() {
  const jumlah = await aman(
    runQuery(
      `SELECT COUNT(*) AS semua,
              SUM(CASE WHEN TRIM(COALESCE(b.uraian, '')) <> '' THEN 1 ELSE 0 END) AS terisi,
              COUNT(DISTINCT NULLIF(TRIM(COALESCE(b.uraian, '')), '')) AS berbeda
         FROM perkara_biaya b`,
      []
    )
  );
  const sering = await aman(
    runQuery(
      `SELECT TRIM(b.uraian) AS nilai, b.jenis_transaksi AS jenis, COUNT(*) AS jumlah
         FROM perkara_biaya b
        WHERE TRIM(COALESCE(b.uraian, '')) <> ''
        GROUP BY TRIM(b.uraian), b.jenis_transaksi
        ORDER BY jumlah DESC
        LIMIT 30`,
      []
    )
  );
  return { jumlah, sering };
}

async function ukurRuangSidang() {
  const jumlah = await aman(
    runQuery(
      `SELECT COUNT(*) AS semua,
              SUM(CASE WHEN TRIM(COALESCE(j.ruangan, '')) <> '' THEN 1 ELSE 0 END) AS terisi,
              COUNT(DISTINCT NULLIF(TRIM(COALESCE(j.ruangan, '')), '')) AS berbeda
         FROM perkara_jadwal_sidang j`,
      []
    )
  );
  const sering = await aman(
    runQuery(
      `SELECT TRIM(j.ruangan) AS nilai, COUNT(*) AS jumlah
         FROM perkara_jadwal_sidang j
        WHERE TRIM(COALESCE(j.ruangan, '')) <> ''
        GROUP BY TRIM(j.ruangan)
        ORDER BY jumlah DESC
        LIMIT 30`,
      []
    )
  );
  return { jumlah, sering };
}

const PENGUKUR = Object.assign(Object.create(null), {
  kecamatan: ukurKecamatan,
  alasanDitunda: ukurAlasanDitunda,
  pekerjaan: ukurPekerjaan,
  pendidikan: ukurPendidikan,
  uraianBiaya: ukurUraianBiaya,
  ruangSidang: ukurRuangSidang,
});

/** Mengukur seluruh ruas. Satu ruas yang gagal tidak menghentikan yang lain. */
async function ukurSemua() {
  const hasil = [];
  for (const ruas of RUAS) {
    const pengukur = Object.prototype.hasOwnProperty.call(PENGUKUR, ruas.kunci)
      ? PENGUKUR[ruas.kunci]
      : null;
    if (typeof pengukur !== "function") {
      hasil.push({ ...ruas, galat: "tidak ada pengukurnya" });
      continue;
    }
    try {
      const ukuran = await pengukur();
      hasil.push({ ...ruas, ukuran });
    } catch (galat) {
      hasil.push({ ...ruas, galat: String(galat.message || galat).slice(0, 200) });
    }
  }
  return { diukurPada: new Date().toISOString(), ruas: hasil };
}

module.exports = { RUAS, ukurSemua };
