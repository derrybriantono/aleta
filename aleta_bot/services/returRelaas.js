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
 * SEMA 1/2023 (W58, 22 Okt): pada SURAT TERCATAT, keterangan angka 12 huruf b
 * (tidak bersedia menerima - angka 4), e (alamat tidak ditemukan), f (tidak
 * tinggal di alamat) dan g (meninggal dunia) juga berarti surat dikembalikan
 * ke pengadilan, walau status_pos-nya kosong. Diukur atas 15.013 relaas
 * satker 22 Okt: retur 242 baris / 199 perkara menjadi 264 baris / 215 perkara.
 * Frasa yang sama dipakai penggalan SQL dan pemeriksa JS, supaya hitungan
 * daftar dan tampilan satu relaas tidak berselisih. Panggilan jurusita
 * TIDAK ikut - tidak ada surat yang dikembalikan.
 *
 * Dipakai semua tempat yang menghitung retur (analisa panggilan, checklist,
 * peta, rekap petugas, jadwal sidang, status perkara, penanda perkara) dan
 * oleh kepatutanRelaas.js, supaya angkanya tidak berselisih.
 */
const POLA_RETUR = /retur|failed/i;

/** Frasa SEMA 1/2023 angka 12 huruf b/e/f/g (huruf kecil; LIKE MariaDB tidak membedakan besar-kecil). */
const FRASA_RETUR_POS = [
  "tidak berhasil diserahkan",
  "dikembalikan",
  "tidak ditemukan",
  "tidak diketemukan",
  "tidak dikenal",
  "tidak ada yang mengenal",
  "alamat tidak jelas",
  "alamat tidak lengkap",
  "alamat salah",
  "tidak tinggal",
  "tidak berdomisili",
  "pindah alamat",
  "pindah domisili",
  "pindah tempat",
  "sudah pindah",
  "telah pindah",
  "meninggal dunia",
  "telah meninggal",
  "wafat",
  "tidak bersedia menerima",
  "tidak bersedia menandatangani",
  "tidak bersedia menanda tangani",
  "ditolak",
  "menolak menerima",
];

/** Relaas ini lewat surat tercatat? (sandi S atau ada nomor resi) */
function lewatPos(ketTemu, noResiPos) {
  return String(ketTemu || "").trim().toUpperCase() === "S" || String(noResiPos || "").trim() !== "";
}

/**
 * Relaas ini retur? `hasil` = ket_hasil_relaas.
 * `ketTemu` dan `noResiPos` opsional: tanpa keduanya frasa SEMA tidak dinilai
 * (pemanggil lama tetap mendapat aturan lama).
 */
function relaasRetur(statusPos, hasil, ketTemu, noResiPos) {
  if (Number(statusPos) === 2 || POLA_RETUR.test(String(hasil || ""))) return true;
  if (!lewatPos(ketTemu, noResiPos)) return false;
  const t = String(hasil || "").toLowerCase();
  return FRASA_RETUR_POS.some((f) => t.includes(f));
}

/** Penggalan SQL (MySQL) yang bernilai benar/salah - tidak pernah NULL - untuk alias tabel relaas. */
function sqlRetur(alias) {
  const hasil = `COALESCE(${alias}.ket_hasil_relaas, '')`;
  const frasa = FRASA_RETUR_POS.map((f) => `${hasil} LIKE '%${f}%'`).join(" OR ");
  return (
    `(COALESCE(${alias}.status_pos, 0) = 2 OR ${hasil} LIKE '%retur%' OR ${hasil} LIKE '%failed%'` +
    ` OR ((COALESCE(${alias}.ket_temu, '') = 'S' OR COALESCE(${alias}.no_resi_pos, '') <> '') AND (${frasa})))`
  );
}

module.exports = { POLA_RETUR, FRASA_RETUR_POS, relaasRetur, sqlRetur };
