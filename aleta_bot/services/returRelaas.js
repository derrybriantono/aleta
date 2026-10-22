"use strict";

/**
 * RELAAS RETUR - SATU ATURAN (22 Okt 2026)
 *
 * Relaas dihitung RETUR bila surat dikembalikan (status_pos = 2) ATAU hasil
 * relaasnya memuat kata "retur" atau "failed". Yang terakhir dari keputusan
 * hakim 22 Okt: relaas pos dengan hasil "FAILED TO DELIVERY, alamat ... tidak
 * ditemukan" (contoh 651/Pdt.G/2026) tetap berstatus_pos kosong di SIPP,
 * sehingga dulu lolos dari hitungan retur.
 *
 * Dipakai semua tempat yang menghitung retur (analisa panggilan, checklist,
 * peta, rekap petugas, jadwal sidang, status perkara, penanda perkara) supaya
 * angkanya tidak berselisih.
 */
const POLA_RETUR = /retur|failed/i;

/** Relaas ini retur? `hasil` = ket_hasil_relaas. */
function relaasRetur(statusPos, hasil) {
  return Number(statusPos) === 2 || POLA_RETUR.test(String(hasil || ""));
}

/** Penggalan SQL (MySQL) yang bernilai benar/salah - tidak pernah NULL - untuk alias tabel relaas. */
function sqlRetur(alias) {
  return `(COALESCE(${alias}.status_pos, 0) = 2 OR COALESCE(${alias}.ket_hasil_relaas, '') LIKE '%retur%' OR COALESCE(${alias}.ket_hasil_relaas, '') LIKE '%failed%')`;
}

module.exports = { POLA_RETUR, relaasRetur, sqlRetur };
