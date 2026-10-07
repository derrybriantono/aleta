"use strict";

/**
 * ============================================================================
 * SIDIK SANDI SIPP DAN KEADAAN AKUNNYA - MURNI, TANPA BASIS DATA
 * ============================================================================
 *
 * Dipisah dari services/sippReadOnlyBridgeService.js (7 Okt 2026, masuk ALETA
 * dengan akun SIPP) supaya dapat dimuat uji portal tanpa ikut menyalakan
 * sambungan MySQL - layanan jembatan memuat externalDbService di tingkat atas.
 * Isi sidikSandiSipp DIPINDAHKAN APA ADANYA; layanan jembatan tetap
 * mengekspornya untuk scripts/verify-sidik-sandi.js.
 *
 * Yang ditiru: application/models/Login/validation_user.php milik SIPP
 * (berkas server satker identik dengan salinan XAMPP setempat, diperiksa lewat
 * md5sum 7 Okt 2026). SIPP menolak masuk bila:
 *
 *   1. arr2md5(code_activation, password) !== sys_users.password
 *   2. sys_users.block bernilai benar           - if($row->block)
 *   3. user_expired terisi dan sudah lewat      - strtotime(...) < time()
 *
 * Ketiganya dihitung di sini, di sisi SIPP. Yang keluar ke portal hanya
 * jawaban ya/tidak - sidik tersimpan dan kode aktivasinya tidak pernah.
 */

const crypto = require("crypto");

/**
 * Sidik sandi SIPP - tiruan persis arr2md5() milik SIPP.
 *
 *     hasil = md5(kode_aktivasi)                       32 huruf heksadesimal
 *     code  = md5(sandi)                               32 huruf heksadesimal
 *     hasil[i] = chr(ord(hasil[i]) XOR ord(code[i]))   tiap huruf
 *     kembalikan md5(hasil)
 *
 * DUA HAL YANG MUDAH KELIRU:
 *
 *   1. XOR-nya atas HURUF heksadesimalnya, bukan atas byte yang diwakilinya.
 *      Menerjemahkan hex ke byte lebih dulu menghasilkan sidik yang salah.
 *
 *   2. Hasil XOR di-md5 sebagai DERET BYTE, bukan teks UTF-8. Huruf
 *      heksadesimal ada di 0x30-0x39 dan 0x61-0x66, jadi XOR-nya selalu di
 *      bawah 0x80 - masih aman di latin1, tetapi itu KEBETULAN. Disebut tegas
 *      supaya tidak bergantung pada kebetulan.
 *
 * Dicocokkan terhadap PHP asli di server untuk lima masukan berbeda; lihat
 * scripts/verify-sidik-sandi.js.
 */
function sidikSandiSipp(kodeAktivasi, sandi) {
  const md5Hex = (nilai) => crypto.createHash("md5").update(String(nilai == null ? "" : nilai)).digest("hex");

  let hasil = md5Hex(kodeAktivasi);
  const kode = md5Hex(sandi);

  const batas = Math.min(hasil.length, kode.length);
  let campur = "";
  for (let i = 0; i < batas; i += 1) {
    campur += String.fromCharCode(hasil.charCodeAt(i) ^ kode.charCodeAt(i));
  }
  hasil = campur + hasil.slice(batas);

  return crypto.createHash("md5").update(Buffer.from(hasil, "latin1")).digest("hex");
}

/**
 * sys_users.block menurut SIPP: `if($row->block)` - nilai PHP yang benar.
 * "0", 0, "", null = tidak diblokir; angka lain = diblokir.
 */
function akunSippDiblokir(nilai) {
  if (nilai === null || nilai === undefined) return false;
  if (typeof nilai === "boolean") return nilai;
  const teks = String(nilai).trim();
  if (teks === "" || teks === "0") return false;
  const angka = Number(teks);
  return Number.isFinite(angka) ? angka !== 0 : true;
}

/**
 * sys_users.user_expired menurut SIPP:
 *
 *     if(!empty($row->user_expired)) if (strtotime($row->user_expired) < time()) return FALSE;
 *
 * Kosong/NULL = tidak kedaluwarsa. Tanggal nol "0000-00-00 ..." DIANGGAP
 * kedaluwarsa, sebab strtotime() PHP 5.6 memulangkan angka negatif untuknya
 * dan SIPP pun menolaknya. Teks yang tidak dapat dibaca Date.parse dianggap
 * TIDAK kedaluwarsa: bentuk yang dibaca strtotime() lebih luas daripada
 * Date.parse, dan menutup akun ALETA karena salah membaca tanggal lebih buruk
 * daripada membiarkannya. Kolom datetime MySQL selalu terbaca.
 */
function akunSippKedaluwarsa(nilai, sekarang = Date.now()) {
  if (nilai === null || nilai === undefined) return false;
  if (nilai instanceof Date) {
    const ms = nilai.getTime();
    if (Number.isNaN(ms)) return true; // mysql2 memulangkan Invalid Date untuk tanggal nol
    return ms < sekarang;
  }
  const teks = String(nilai).trim();
  if (!teks) return false;
  if (/^0000-00-00/.test(teks)) return true;
  const ms = Date.parse(teks.replace(" ", "T"));
  if (Number.isNaN(ms)) return false;
  return ms < sekarang;
}

module.exports = { sidikSandiSipp, akunSippDiblokir, akunSippKedaluwarsa };
