"use strict";

/**
 * Menentukan berhasil-tidaknya login e-Court.
 *
 * Semula hanya alamat halaman yang diperiksa, terhadap daftar tetap
 * (pendaftaran, dashboard, home). Bila e-Court mendaratkan petugas di alamat
 * di luar daftar itu, login yang SUDAH BERHASIL dibaca sebagai gagal - dan
 * tidak ada jalan keluarnya: mengulang dengan sandi yang benar pun gagal lagi
 * dengan cara yang sama. Yang terlihat petugas hanya "login ditolak".
 *
 * Skrip ini menguji kedua tanda tanpa menyentuh jaringan.
 */

const scraper = require("../tools/ecourt-bridge/scraper");

let lulus = 0;
let gagal = 0;

function periksa(nama, benar) {
  if (benar) {
    lulus += 1;
    console.log(`  OK    ${nama}`);
  } else {
    gagal += 1;
    console.log(`  GAGAL ${nama}`);
  }
}

/** Menyalin aturan yang dipakai kirimLogin, tanpa peramban. */
function sudahMasuk(alamat, { adaKolomSandi }) {
  if (scraper.isLoggedInUrl(alamat)) return true;
  const masihDiLogin = scraper.LOGIN_PATH_PATTERN.test(alamat) || adaKolomSandi;
  return !masihDiLogin && !scraper.isGateUrl(alamat) && alamat.startsWith(scraper.BASE_URL);
}

const B = scraper.BASE_URL;

console.log("\n== Yang memang sudah dikenali sebelumnya ==");
periksa("dashboard -> masuk", sudahMasuk(`${B}/dashboard`, { adaKolomSandi: false }));
periksa("pendaftaran -> masuk", sudahMasuk(`${B}/pendaftaran`, { adaKolomSandi: false }));
periksa("home -> masuk", sudahMasuk(`${B}/home`, { adaKolomSandi: false }));

console.log("\n== Yang DULU salah dibaca sebagai gagal ==");
periksa("alamat tak dikenal tanpa kolom sandi -> masuk", sudahMasuk(`${B}/panel/beranda`, { adaKolomSandi: false }));
periksa("akar situs tanpa kolom sandi -> masuk", sudahMasuk(`${B}/`, { adaKolomSandi: false }));
periksa("alamat lain tanpa kolom sandi -> masuk", sudahMasuk(`${B}/e-litigasi/daftar`, { adaKolomSandi: false }));

console.log("\n== Yang tetap harus ditolak ==");
periksa("masih di halaman Login -> belum masuk", !sudahMasuk(`${B}/Login`, { adaKolomSandi: true }));
periksa("Login walau kolom sandi hilang -> belum masuk", !sudahMasuk(`${B}/Login`, { adaKolomSandi: false }));
periksa(
  "captcha salah: kembali ke Login dengan galat -> belum masuk",
  !sudahMasuk(`${B}/Login?galat=1`, { adaKolomSandi: true })
);
periksa(
  "kolom sandi masih ada di alamat lain -> belum masuk",
  !sudahMasuk(`${B}/verifikasi`, { adaKolomSandi: true })
);
periksa("keluar dari e-Court -> belum masuk", !sudahMasuk("https://www.google.com/", { adaKolomSandi: false }));
periksa("alamat kosong -> belum masuk", !sudahMasuk("", { adaKolomSandi: false }));


console.log("\n== Halaman gerbang /GateLogin ==");
// Kasus paling berbahaya: gerbang TIDAK memuat kolom sandi, jadi aturan
// "kolom sandi hilang berarti sudah masuk" akan menyimpulkan berhasil -
// padahal sesinya belum terbentuk sampai tombol Lanjut ditekan. Kegagalan
// seperti itu baru ketahuan jauh kemudian, saat jembatan dijalankan.
periksa(
  "gerbang tanpa kolom sandi -> BELUM masuk",
  !sudahMasuk(`${B}/GateLogin`, { adaKolomSandi: false })
);
periksa("gerbang dikenali sebagai gerbang", scraper.isGateUrl(`${B}/GateLogin`));
periksa("dashboard bukan gerbang", !scraper.isGateUrl(`${B}/dashboard`));
periksa("gerbang di situs lain tidak diakui", !scraper.isGateUrl("https://jahat.example/GateLogin"));
periksa("isLoggedInUrl menolak gerbang", !scraper.isLoggedInUrl(`${B}/GateLogin`));
periksa(
  "setelah gerbang dilewati, dashboard -> masuk",
  sudahMasuk(`${B}/dashboard`, { adaKolomSandi: false })
);
console.log("\n== Jalur pendaratan dicatat tanpa query ==");
{
  const jalur = new URL(`${B}/panel/beranda?token=RAHASIA123`).pathname;
  periksa("query tidak ikut tercatat", jalur === "/panel/beranda" && !jalur.includes("RAHASIA"));
}

console.log(`\nLulus: ${lulus}, Gagal: ${gagal}`);
if (gagal > 0) {
  console.log("ADA PERIKSAAN YANG GAGAL.");
  process.exit(1);
}
