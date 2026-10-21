"use strict";
// Dipanggil ukur.py: menerapkan aturan JS (kodePosWilayahService.pilihKodePos) atas baris kode_pos + nama wilayah dari berkas JSON.
// Keluaran: { "<kode kelurahan>": { kodePos, tingkat, sebab } } sebagai JSON di stdout.
const fs = require("fs");
const path = require("path");
const layanan = require(path.join(__dirname, "..", "..", "..", "aleta_bot", "services", "kodePosWilayahService.js"));

const masuk = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const keluar = {};
for (const kode of masuk.kode) {
  const w = masuk.wilayah[kode];
  keluar[kode] = w ? layanan.pilihKodePos(masuk.kode_pos, w) : { kodePos: null, tingkat: null, sebab: "kode-wilayah-tidak-dikenal" };
}
process.stdout.write(JSON.stringify(keluar));
