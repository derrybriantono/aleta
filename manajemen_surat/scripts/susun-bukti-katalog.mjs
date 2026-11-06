// Menyusun ekstensi-sipp/bukti-katalog.js dari satu sumber src/lib/bukti-katalog.json, supaya panel dan portal memakai katalog yang sama.
// Dijalankan sesudah katalog diubah: node scripts/susun-bukti-katalog.mjs (bukti-tertulis-6nov.test.ts menjaga keduanya sama).
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const akar = process.cwd();
const data = JSON.parse(readFileSync(path.join(akar, "src/lib/bukti-katalog.json"), "utf8"));
const isi =
  `"use strict";\n\n/** Katalog alat bukti tertulis dan elektronik. Disusun dari manajemen_surat/src/lib/bukti-katalog.json, jangan disunting di sini. */\n` +
  `globalThis.ALETA_BUKTI_KATALOG = ${JSON.stringify(data)};\n`;
writeFileSync(path.join(akar, "../ekstensi-sipp/bukti-katalog.js"), isi, "utf8");
console.log(`bukti-katalog.js: ${data.surat.length} surat, ${data.elektronik.length} elektronik`);
