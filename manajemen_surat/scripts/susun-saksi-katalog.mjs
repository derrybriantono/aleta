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
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SKRIP = fileURLToPath(import.meta.url);
const AKAR_EKSTENSI = path.resolve(path.dirname(SKRIP), "..", "..", "ekstensi-sipp");
export const FOLDER_KATALOG = path.join(AKAR_EKSTENSI, "saksi-katalog");
export const BERKAS_DATA = path.join(AKAR_EKSTENSI, "saksi-katalog-data.js");

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

if (process.argv[1] && path.resolve(process.argv[1]) === SKRIP) {
  const katalog = bacaKatalog();
  if (process.argv.includes("--stdout")) {
    // hanya mencetak isi yang SEHARUSNYA (dipakai uji penjaga), tanpa menulis berkas
    process.stdout.write(bangunIsi(katalog));
    process.exit(0);
  }
  fs.writeFileSync(BERKAS_DATA, bangunIsi(katalog), "utf8");
  console.log(`saksi-katalog-data.js ditulis: ${katalog.length} katalog (${katalog.map((k) => k.kunci).join(", ")})`);
}
