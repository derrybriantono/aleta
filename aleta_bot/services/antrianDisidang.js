"use strict";

/**
 * ============================================================================
 * ARTI KOLOM `disidang` APLIKASI ANTRIAN RUANG TUNGGU - SATU TEMPAT
 * ============================================================================
 *
 * Dibaca dari sumber aplikasi antrian di server (5 Okt 2026):
 * /var/www/html/antrian/php/_fungsi.php dan menu.sidang.php, dan dicocokkan
 * dengan data hidup sipp_turunan_antrian.antrian_sidang hari itu.
 *
 *   NULL   belum masuk ruang (menunggu). BATAL / SKORS SIDANG menulis NULL lagi.
 *   1..9   SEDANG DISIDANG di ruang itu - nilainya nomor ruang (= ruangan_id).
 *          Tombol PROSES menulis `disidang = <ruang>, jam_sidang = now()`
 *          (_fungsi.php:934), dan layar "RUANG SIDANG n" membaca
 *          `disidang = n AND ruangan_id = n` (menu.sidang.php:21).
 *   10     SELESAI disidang - Tunda, Putus, Ikrar, dan SELESAI SIDANG semuanya
 *          menulis `disidang = 10` (_fungsi.php:938/949/961/994). jam_sidang
 *          TIDAK diubah, sehingga tetap berisi jam masuk ruang (bila perkaranya
 *          pernah di-PROSES) atau jam jadwal (bila langsung ditunda).
 *
 * Sampai 1.183.0 ALETA keliru membaca 10 sebagai "dipanggil" dan bahkan
 * MENULIS 10 saat memanggil - artinya perkara yang baru dipanggil langsung
 * tercatat "selesai" di aplikasi antrian, dan perkara yang sedang di ruang
 * (1..9) tidak pernah terdeteksi sedang berjalan.
 *
 * Semua pembaca dan penulis di bot memakai berkas ini, supaya arti satu kode
 * tidak lagi tersebar dan berselisih di lima tempat.
 */

/** Nilai "selesai disidang". */
const DISIDANG_SELESAI = 10;

/** Rentang nomor ruang yang dikenal aplikasi antrian. */
const RUANG_TERKECIL = 1;
const RUANG_TERBESAR = 9;

function angkaDisidang(nilai) {
  if (nilai === null || nilai === undefined || nilai === "") return null;
  const n = Number(nilai);
  return Number.isInteger(n) ? n : null;
}

/** Nomor ruang bila baris SEDANG disidang (1..9), selain itu null. */
function ruangDisidang(nilai) {
  const n = angkaDisidang(nilai);
  return n !== null && n >= RUANG_TERKECIL && n <= RUANG_TERBESAR ? n : null;
}

/** Baris sudah SELESAI disidang (10). */
function selesaiDisidang(nilai) {
  return angkaDisidang(nilai) === DISIDANG_SELESAI;
}

/**
 * "menunggu" (NULL) | "disidang" (1..9) | "selesai" (10) | "lain" (kode lain
 * yang belum dikenal - dibiarkan, tidak ditafsir).
 */
function keadaanDisidang(nilai) {
  const n = angkaDisidang(nilai);
  // 0 bukan nilai aplikasi antrian, tetapi jelas bukan ruang: dibaca menunggu.
  if (n === null || n === 0) return "menunggu";
  if (ruangDisidang(n) !== null) return "disidang";
  if (n === DISIDANG_SELESAI) return "selesai";
  return "lain";
}

/**
 * Menyegarkan layar-layar aplikasi antrian - persis yang dikerjakan aplikasi
 * itu sendiri sesudah PROSES / SELESAI / BATAL (_fungsi.php:1087 dan
 * sekitarnya): layar ruang tunggu dan layar ruang sidang memantau
 * sys_data_refresh, dan tanpa itu perubahan dari ALETA baru tampil di sana
 * pada penyegaran berikutnya oleh hal lain. Hanya cap waktu; tanpa penanda
 * ALETA. NOW() = CURRENT_TIMESTAMP() di MySQL.
 */
const SQL_SEGARKAN_LAYAR = `UPDATE sipp_turunan_antrian.sys_data_refresh SET value = NOW()
  WHERE id IN ('prsdg', 'sidng', 'antri') OR id LIKE 'sdng%' OR id LIKE 'ruan%'`;

/** Penyegaran layar - galatnya ditelan: tabel itu mungkin tidak ada di satker lain. */
async function segarkanLayar(kueri) {
  try {
    await kueri(SQL_SEGARKAN_LAYAR, []);
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  DISIDANG_SELESAI,
  RUANG_TERKECIL,
  RUANG_TERBESAR,
  SQL_SEGARKAN_LAYAR,
  angkaDisidang,
  keadaanDisidang,
  ruangDisidang,
  segarkanLayar,
  selesaiDisidang,
};
