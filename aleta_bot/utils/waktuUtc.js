"use strict";

/**
 * Penyusun SQL jam setempat untuk kolom ALETA yang disimpan UTC.
 *
 * Murni (tanpa sambungan basis data) supaya dapat dipakai layanan mana pun
 * tanpa memuat kolam koneksi. Aturan lengkapnya ada di botDbService
 * ("ATURAN WAKTU KOLOM ALETA"), yang juga mengekspor ulang isi berkas ini.
 *
 * Selisih setempat = NOW() - UTC_TIMESTAMP() server MySQL, dihitung DI
 * pernyataan itu sendiri (keduanya dinilai pada saat mulai pernyataan yang
 * sama, jadi tepat - WITA: 28800 detik). Itulah basis yang dulu ditulis
 * NOW(), dan basis jam aplikasi antrian/SIPP. Tidak memerlukan tabel zona
 * MySQL (MariaDB 5.5 server tidak memuatnya).
 */
const SQL_SELISIH_SETEMPAT = "TIMESTAMPDIFF(SECOND, UTC_TIMESTAMP(), NOW())";

/** Kolom UTC -> jam dinding setempat (untuk DATE_FORMAT/DATE/HOUR keluaran). */
function sqlSetempat(kolom) {
  return `DATE_ADD(${kolom}, INTERVAL ${SQL_SELISIH_SETEMPAT} SECOND)`;
}

/** Jam dinding setempat (placeholder/ekspresi) -> UTC, untuk disimpan atau dibandingkan. */
function sqlDariSetempat(ekspresi = "?") {
  return `DATE_SUB(${ekspresi}, INTERVAL ${SQL_SELISIH_SETEMPAT} SECOND)`;
}

/** Awal hari setempat ini, dalam UTC - pengganti DATE(kolom) = CURDATE(). */
const SQL_AWAL_HARI_SETEMPAT = sqlDariSetempat("CURDATE()");

module.exports = { SQL_SELISIH_SETEMPAT, sqlSetempat, sqlDariSetempat, SQL_AWAL_HARI_SETEMPAT };
