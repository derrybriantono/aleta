"use strict";
/**
 * Contoh yang menjaga isian_rtf_penutup (SQL) tetap sama dengan adalahKalimatPenutupSaksi (bot, JS).
 * Dipakai bangun_paket.js untuk PERIKSA.sql: harapan tiap contoh DIHITUNG oleh fungsi bot (bukan ditulis tangan),
 * jadi bila aturan bot berubah, paket harus dibangun ulang (uji penutup-saksi-x6-21okt.test.ts menjaganya).
 */
const fs = require("node:fs");
const path = require("node:path");

// Tabel contoh bersama (salinan penutup-saksi-lentur.test.ts) + beberapa bentuk baru 21 Okt.
const PENUTUP = [
  "Bahwa cukup sekian", "Bahwa cukup sekian;", "Bahwa sudah cukup", "Bahwa sudah cukup;", "Bahwa cukup", "Bahwa saksi sudah cukup",
  "Bahwa saya sudah cukup", "Bahwa tidak ada lagi yang ingin disampaikan", "Bahwa tidak ada lagi yang ingin saya sampaikan",
  "Bahwa tidak ada lagi yang akan saksi sampaikan", "Bahwa tidak ada lagi yang dapat disampaikan", "Bahwa tidak ada lagi keterangan",
  "Bahwa tidak ada keterangan lain", "Bahwa tidak ada keterangan tambahan", "Bahwa saksi tidak ada lagi keterangan",
  "Bahwa sudah tidak ada lagi yang ingin saya sampaikan", "Bahwa sekian", "Bahwa sekian keterangan saya",
  "Bahwa hanya itu yang saya ketahui", "Bahwa itu saja yang saksi sampaikan", "Bahwa demikian keterangan saya",
  "Bahwa saya tidak sanggup lagi dan sudah cukup", "Bahwa saya sudah tidak sanggup lagi, cukup sekian", "Bahwa cukup sekian dan terima kasih",
  "Bahwa tidak ada, sudah cukup", "Bahwa tidak, sudah cukup", "Bahwa ya, sudah cukup", "Bahwa saya tidak sanggup lagi menjawab",
  "Bahwa saksi sudah tidak sanggup lagi memberikan keterangan", "Sudah cukup", "Sudah cukup;", "sudah  cukup .", "Tidak ada, sudah cukup",
  "Tidak, sudah cukup;", "Cukup sekian;", "Bahwa, sudah cukup", "- Bahwa sudah cukup;", "-   Bahwa sudah cukup;", "SUDAH CUKUP;", "Sudah\ncukup;",
  "Bahwa tidak ada lagi yang ingin diterangkan", "Bahwa tidak ada lagi yang saksi ketahui", "Bahwa tidak ada lagi yang saya ketahui",
  "Bahwa tidak ada hal lain yang saya ketahui", "Bahwa tidak ada yang saksi ketahui lagi", "Bahwa saksi tidak mampu lagi memberikan keterangan",
  "Bahwa saya tidak kuat lagi menjawab", "Cukup sekian, terima kasih", "Sampai di sini saja", "Sekian dulu",
];
const BIASA = [
  "Sekian lama ia pergi meninggalkan rumah", "Bahwa sekian lama Tergugat pergi meninggalkan Penggugat", "Bahwa sudah cukup lama keduanya berpisah tempat tinggal",
  "Bahwa nafkah yang diberikan Tergugat tidak pernah cukup untuk anak-anaknya", "Bahwa Tergugat sudah cukup sering memukul Penggugat",
  "Bahwa cukup banyak barang yang dibawa Tergugat", "Saksi sudah tidak sanggup lagi merukunkan keduanya", "Bahwa saksi tidak sanggup lagi mendamaikan keduanya",
  "Bahwa saya tidak sanggup mendamaikan karena tidak tahu persoalannya", "Bahwa saksi tidak sanggup mendamaikan", "Bahwa saya tidak sanggup",
  "Bahwa Tergugat tidak sanggup lagi menafkahi Penggugat", "Bahwa Tergugat sudah tidak sanggup lagi hidup bersama Penggugat", "Bahwa tidak ada pekerjaan lain",
  "Bahwa tidak ada halangan secara hukum", "Bahwa tidak ada", "Bahwa tidak ada lagi harapan untuk rukun", "Bahwa tidak ada lagi yang menafkahi anak",
  "Bahwa tidak ada keterangan Penggugat tentang itu", "Bahwa hanya itu penyebabnya", "Bahwa hanya itu yang diketahui Tergugat",
  "Bahwa itu saja penyebab pertengkaran mereka", "Bahwa demikian keterangan Tergugat kepada saksi", "Bahwa sampai di sini rumah mereka",
  "Bahwa cukup sekian lama mereka berpisah", "Bahwa yang meninggalkan tempat tinggal bersama adalah Tergugat", "Bahwa saya tidak tahu", "",
  "Bahwa tidak kuat lagi", "Bahwa saya tidak kuat lagi", "Bahwa tidak mampu lagi", "Bahwa saksi tidak mampu lagi merukunkan",
  "Tidak ada yang diketahui tentang sebab perselisihan", "Bahwa tidak ada yang saya ketahui", "Bahwa tidak ada yang saksi ketahui", "Penggugat tidak mampu lagi",
  "Bahwa Penggugat sudah tidak kuat lagi", "tidak sanggup lagi menunggu tergugat", "Bahwa sudah cukup lama berpisah", "Bahwa tidak sanggup lagi hidup bersama Tergugat",
  "Selama pisah antara Penggugat dan Tergugat sudah tidak ada komunikasi;", "Tidak ada;", "Setahu saya tidak ada;", "Tidak;",
];
const SANGGUP_LAGI = [
  "Saya tidak sanggup lagi;", "Saya sudah tidak sanggup lagi;", "Bahwa saya tidak sanggup lagi", "Bahwa saksi sudah tidak sanggup lagi", "Bahwa tidak sanggup lagi",
  "Bahwa saksi tidak lagi sanggup", "Bahwa belum sanggup lagi", "- BAHWA SAYA TIDAK SANGGUP LAGI;", "Iya, saya tidak sanggup lagi;",
];
const TANYA_MENDAMAIKAN = [
  "Apakah saksi masih sanggup untuk mendamaikan Penggugat dan Tergugat?",
  "Apakah\nsaksi masih sanggup untuk mendamaikan Pemohon dan Termohon?",
  "Apakah Saudara masih sanggup merukunkan Penggugat dan Tergugat?",
  "Apakah saudara masih sanggup untuk menasehati Penggugat dan Tergugat?",
];
const TANYA_PENUTUP = [
  "Apakah masih ada yang ingin saudara sampaikan?", "Apakah masih ada keterangan yang saksi akan sampaikan?",
  "Apakah masih ada hal lain yang saudara ingin sampaikan ?", "Apakah masih ada yang tanyakan ?",
];

/** [{t, q, e}] : teks, pertanyaan (boleh kosong), harapan (1/0) = putusan fungsi bot. */
function daftarContoh(adalahPenutup) {
  const hasil = [];
  const tambah = (t, q) => hasil.push({ t, q: q || "", e: adalahPenutup(t, q || "") ? 1 : 0 });
  for (const t of [...PENUTUP, ...BIASA]) tambah(t, "");
  for (const t of PENUTUP.slice(0, 12)) for (const q of [TANYA_MENDAMAIKAN[0], TANYA_PENUTUP[0]]) tambah(t, q);
  for (const t of SANGGUP_LAGI) for (const q of [...TANYA_MENDAMAIKAN, ...TANYA_PENUTUP, ""]) tambah(t, q);
  const nyata = JSON.parse(fs.readFileSync(path.join(__dirname, "contoh-nyata.json"), "utf8"));
  for (const x of nyata) tambah(x.jawab, x.tanya);
  // buang pengulangan persis
  const lihat = new Set();
  return hasil.filter((x) => {
    const k = `${x.t}\u0000${x.q}`;
    if (lihat.has(k)) return false;
    lihat.add(k);
    return true;
  });
}

module.exports = { daftarContoh, PENUTUP, BIASA, SANGGUP_LAGI, TANYA_MENDAMAIKAN, TANYA_PENUTUP };
