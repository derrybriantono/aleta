#!/usr/bin/env node
/**
 * Menyusun ekstensi-sipp/saksi-katalog-data.js dari ekstensi-sipp/saksi-katalog/*.json.
 *
 * ============================================================================
 * KENAPA ADA DUA BENTUK
 * ============================================================================
 *
 * Katalog "Susun saksi" disunting sebagai JSON per jenis perkara (satu berkas
 * per jenis: mudah ditinjau dan diperiksa skemanya). Ekstensi, di sisi lain,
 * memuat skrip - skrip konten tidak dapat membaca berkas JSON dari paketnya
 * tanpa izin tambahan dan satu permintaan jaringan lokal per berkas. Karena itu
 * seluruh katalog dilebur menjadi SATU skrip data yang memasang
 * globalThis.ALETA_SAKSI_KATALOG_DATA.
 *
 * Berkas hasilnya DIHASILKAN: jangan disunting tangan. Ada uji
 * (saksi-katalog-penjaga.test.ts) yang membandingkan hasilnya dengan
 * keluaran skrip ini, jadi katalog yang diubah tanpa menjalankan skrip ini
 * langsung ketahuan.
 *
 * Jalankan dari folder manajemen_surat:
 *   node scripts/susun-saksi-katalog.mjs
 *
 * Berkas dengan "contoh": true TIDAK dimuat (hanya contoh bentuk).
 *
 * ============================================================================
 * K10 (25 Okt 2026): KATALOG DIMUAT PER JENIS PERKARA
 * ============================================================================
 *
 * Satu skrip data 9,4 MB di SETIAP halaman ABT memberati PC tua (halaman ABT
 * ±12,4 MB JS). Karena itu skrip ini juga menghasilkan:
 *
 *   saksi-katalog-indeks.js        kecil, dimuat di halaman ABT: per katalog hanya
 *                                  kunci, judul, versi, syarat, tambahanUntuk,
 *                                  daftar kode variabel, nama berkas, dan ukuran
 *   saksi-katalog-jenis/<kunci>.json   isi satu katalog; dimuat HANYA bila jenis
 *                                  perkara yang dibuka memerlukannya (utama +
 *                                  tambahan + keterangannya) lewat
 *                                  saksi-katalog-muat.js
 *
 * saksi-katalog-data.js (semua sekaligus) tetap dihasilkan: dipakai portal untuk
 * Panduan pertanyaan saksi (server) dan uji; TIDAK lagi disuntik ke halaman ABT.
 * JSON dapat dibaca skrip konten lewat web_accessible_resources (tanpa izin baru).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SKRIP = fileURLToPath(import.meta.url);
const AKAR_EKSTENSI = path.resolve(path.dirname(SKRIP), "..", "..", "ekstensi-sipp");
export const FOLDER_KATALOG = path.join(AKAR_EKSTENSI, "saksi-katalog");
export const BERKAS_DATA = path.join(AKAR_EKSTENSI, "saksi-katalog-data.js");
export const BERKAS_INDEKS = path.join(AKAR_EKSTENSI, "saksi-katalog-indeks.js");
export const FOLDER_JENIS = path.join(AKAR_EKSTENSI, "saksi-katalog-jenis");
export const AWALAN_JENIS = "saksi-katalog-jenis/";

/** Katalog yang dimuat, diurutkan menurut kunci. */
export function bacaKatalog(folder = FOLDER_KATALOG) {
  const hasil = [];
  for (const nama of fs.readdirSync(folder).filter((n) => n.endsWith(".json")).sort()) {
    const kat = JSON.parse(fs.readFileSync(path.join(folder, nama), "utf8"));
    if (kat && kat.contoh === true) continue;
    hasil.push(kat);
  }
  return hasil;
}

/** Isi berkas data persis seperti yang ditulis. */
export function bangunIsi(katalog) {
  return (
    '"use strict";\n\n' +
    "// DIHASILKAN OTOMATIS oleh manajemen_surat/scripts/susun-saksi-katalog.mjs - jangan disunting tangan.\n" +
    "// Sumber: ekstensi-sipp/saksi-katalog/*.json (satu berkas per jenis perkara).\n" +
    "globalThis.ALETA_SAKSI_KATALOG_DATA = " +
    JSON.stringify(katalog) +
    ";\n"
  );
}

/** Kode variabel ABT (#nnnn#) yang dipakai butir-butir satu katalog (sama dengan yang dihitung kodeDipakaiKatalog di saksi-susun.js). */
export function kodeVariabelKatalog(kat) {
  const kode = new Set();
  for (const q of (kat && kat.pertanyaan) || []) for (const v of q.variabelAbt || []) kode.add(String(v));
  return Array.from(kode);
}

/** Isi satu berkas jenis persis seperti yang ditulis (JSON rapat). */
export function bangunIsiJenis(kat) {
  return JSON.stringify(kat);
}

/** Satu butir indeks: hanya yang diperlukan untuk MEMILIH katalog dan menentukan apa yang harus dimuat. */
export function butirIndeks(kat) {
  const butir = {
    kunci: kat.kunci,
    judul: kat.judul,
    versi: kat.versi,
    syarat: kat.syarat || {},
    tambahanUntuk: Array.isArray(kat.tambahanUntuk) ? kat.tambahanUntuk : [],
    kodeVariabel: kodeVariabelKatalog(kat),
    berkas: `${AWALAN_JENIS}${kat.kunci}.json`,
    ukuran: Buffer.byteLength(bangunIsiJenis(kat), "utf8"),
  };
  if (kat.contoh === true) butir.contoh = true;
  if (kat.jenisKatalog) butir.jenisKatalog = kat.jenisKatalog;
  return butir;
}

export function bangunIndeks(katalog) {
  return katalog.map(butirIndeks);
}

/** Isi berkas indeks persis seperti yang ditulis. */
export function bangunIsiIndeks(katalog) {
  return (
    '"use strict";\n\n' +
    "// DIHASILKAN OTOMATIS oleh manajemen_surat/scripts/susun-saksi-katalog.mjs - jangan disunting tangan.\n" +
    "// Indeks katalog Susun saksi (K10): isi lengkap tiap katalog ada di saksi-katalog-jenis/<kunci>.json dan dimuat sesuai kebutuhan.\n" +
    "globalThis.ALETA_SAKSI_KATALOG_INDEKS = " +
    JSON.stringify(bangunIndeks(katalog)) +
    ";\n"
  );
}

/** Menulis berkas jenis dan membuang yang tidak lagi punya katalog. */
function tulisJenis(katalog) {
  fs.mkdirSync(FOLDER_JENIS, { recursive: true });
  const ada = new Set(katalog.map((k) => `${k.kunci}.json`));
  for (const nama of fs.readdirSync(FOLDER_JENIS)) if (nama.endsWith(".json") && !ada.has(nama)) fs.unlinkSync(path.join(FOLDER_JENIS, nama));
  for (const kat of katalog) fs.writeFileSync(path.join(FOLDER_JENIS, `${kat.kunci}.json`), bangunIsiJenis(kat), "utf8");
}

if (process.argv[1] && path.resolve(process.argv[1]) === SKRIP) {
  const katalog = bacaKatalog();
  if (process.argv.includes("--stdout")) {
    // hanya mencetak isi yang SEHARUSNYA (dipakai uji penjaga), tanpa menulis berkas
    process.stdout.write(bangunIsi(katalog));
    process.exit(0);
  }
  if (process.argv.includes("--stdout-indeks")) {
    process.stdout.write(bangunIsiIndeks(katalog));
    process.exit(0);
  }
  fs.writeFileSync(BERKAS_INDEKS, bangunIsiIndeks(katalog), "utf8");
  tulisJenis(katalog);
  fs.writeFileSync(BERKAS_DATA, bangunIsi(katalog), "utf8");
  console.log(`saksi-katalog-data.js ditulis: ${katalog.length} katalog (${katalog.map((k) => k.kunci).join(", ")})`);
}
