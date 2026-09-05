#!/usr/bin/env node
/**
 * Menanam isi ekstensi peramban ke dalam kode portal.
 *
 * ============================================================================
 * KENAPA DITANAM, BUKAN DIBACA DARI DISK
 * ============================================================================
 *
 * Portal berjalan di dalam container yang dibangun dari folder manajemen_surat
 * saja. Folder ekstensi-sipp adalah folder sebelahnya - TIDAK ikut ke dalam
 * image, sehingga membacanya dari disk saat berjalan akan selalu gagal di
 * server, meskipun berhasil saat pengembangan.
 *
 * Menanam isinya sebagai modul menghilangkan seluruh kelas masalah itu
 * sekaligus: tidak ada pencarian jalur, tidak ada ketergantungan pada
 * process.cwd(), tidak ada berkas yang bisa hilang saat penelusuran bundel.
 *
 * Jalankan ulang setiap kali berkas ekstensi berubah:
 *   node scripts/susun-ekstensi.mjs
 *
 * Ada pengujian yang membandingkan hasil tanam ini dengan berkas aslinya,
 * sehingga keduanya tidak dapat berbeda tanpa ketahuan.
 */

import fs from "node:fs";
import path from "node:path";

const BERKAS = ["manifest.json", "konten.js", "jembatan.js", "panel.css", "popup.html", "popup.js", "PASANG.md"];

// Ikon TIDAK dapat ditanam sebagai teks: ia berkas PNG, dan membacanya sebagai
// utf8 merusak bitanya tanpa satu pun galat. Karena itu ikon ditanam terpisah
// sebagai base64, lalu dikembalikan menjadi bita saat ZIP disusun.
//
// Melewatkannya sama sekali lebih buruk lagi: manifest menunjuk ikon/*.png,
// dan Chrome MENOLAK memasang ekstensi yang ikonnya tidak ada. Ekstensi yang
// diunduh dari portal akan gagal dipasang seluruhnya.
const BERKAS_BINER = [
  "ikon/aleta-16.png",
  "ikon/aleta-32.png",
  "ikon/aleta-48.png",
  "ikon/aleta-128.png",
];

const sumber = path.resolve(process.cwd(), "..", "ekstensi-sipp");
const tujuan = path.resolve(process.cwd(), "src/server/shared/ekstensi-berkas.ts");

const bagian = [];
for (const nama of BERKAS) {
  const jalur = path.join(sumber, nama);
  if (!fs.existsSync(jalur)) {
    console.error(`Berkas ekstensi tidak ditemukan: ${jalur}`);
    process.exit(1);
  }
  const isi = fs.readFileSync(jalur, "utf8");
  bagian.push(`  ${JSON.stringify(nama)}: ${JSON.stringify(isi)},`);
}

const bagianBiner = [];
for (const nama of BERKAS_BINER) {
  const jalur = path.join(sumber, nama);
  if (!fs.existsSync(jalur)) {
    console.error(`Berkas ikon tidak ditemukan: ${jalur}`);
    process.exit(1);
  }
  const isi = fs.readFileSync(jalur).toString("base64");
  bagianBiner.push(`  ${JSON.stringify(nama)}: ${JSON.stringify(isi)},`);
}

const keluaran = `// DIHASILKAN OTOMATIS oleh scripts/susun-ekstensi.mjs — jangan disunting tangan.
//
// Isi ekstensi peramban ditanam di sini karena folder ekstensi-sipp tidak ikut
// ke dalam container portal. Jalankan ulang skrip itu setiap kali berkas
// ekstensi berubah; ada pengujian yang menjaga keduanya tetap sama.

export const EKSTENSI_BERKAS: Record<string, string> = {
${bagian.join("\n")}
};

/** Berkas biner (ikon), disandikan base64. Dikembalikan jadi bita saat dikemas. */
export const EKSTENSI_BINER: Record<string, string> = {
${bagianBiner.join("\n")}
};

export const EKSTENSI_NAMA_BERKAS = [
  ...Object.keys(EKSTENSI_BERKAS),
  ...Object.keys(EKSTENSI_BINER),
];
`;

fs.writeFileSync(tujuan, keluaran, "utf8");
console.log(
  `Ditanam ${BERKAS.length} berkas teks dan ${BERKAS_BINER.length} ikon ke ${path.relative(process.cwd(), tujuan)}`
);
