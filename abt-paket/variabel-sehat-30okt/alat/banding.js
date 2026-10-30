"use strict";
/**
 * Banding keluaran variabel SEBELUM (katalog salinan) dan SESUDAH (isi baru dari PASANG.sql paket, lewat timpaKatalog - tidak ditulis)
 * atas SEMUA perkara sampel, dengan mesin variabel bot (baca saja). Melaporkan perkara yang berubah, galat baru, dan contoh.
 * pakai: NODE_PATH=<aleta_bot/node_modules> node banding.js <PASANG.sql> <sampel.tsv> <keluar.json>   [env SIPP_DB, ABT_DB]
 */
const fs = require("fs");
const path = require("path");
const mysql = require("mysql");
const { buatMesin } = require(path.join(__dirname, "..", "..", "..", "aleta_bot", "services", "abtMesinVariabel.js"));
const [pasangF, sampelF, keluar] = process.argv.slice(2);
const SIPP = process.env.SIPP_DB || "sipp_vs";
const ABT = process.env.ABT_DB || "aps_badilag_vs";
const PANJANG = Number(process.env.PANJANG || 600);
const isi = fs.readFileSync(pasangF, "utf8");
const timpa = {};
for (const m of isi.matchAll(/UNHEX\('([0-9A-F]+)'\) USING latin1\)\s+WHERE no_var = (\d+)/g)) timpa[m[2]] = { sql_query: Buffer.from(m[1], "hex").toString("latin1") };
const kode = Object.keys(timpa);
const sampel = fs.readFileSync(sampelF, "utf8").split(/\r?\n/).filter((l) => l.trim()).map((l) => l.split("\t"));
const pool = mysql.createPool({ host: "127.0.0.1", user: "root", database: SIPP, connectionLimit: 4, charset: "latin1_swedish_ci" });
function kueri(sql, params, opsi) {
  const teks = String(sql).replace(/\baps_badilag\./g, `${ABT}.`);
  return new Promise((ok, gagal) =>
    pool.query({ sql: teks, values: params || [], timeout: (opsi && opsi.timeoutMs) || 60000, typeCast: (f) => f.string() }, (g, r) => (g ? gagal(g) : ok(r)))
  );
}
(async () => {
  const hasil = { variabel: kode, perkara: sampel.length, berubah: {}, galatBaru: [], galatLama: [], sama: {} };
  for (const k of kode) {
    hasil.berubah[k] = [];
    hasil.sama[k] = 0;
  }
  for (const [pid, gol, jenis] of sampel) {
    const a = await buatMesin({ kueri, skemaAbt: ABT, batasKueriMs: 60000 }).nilaiPenanda({ perkaraId: pid }, kode);
    const b = await buatMesin({ kueri, skemaAbt: ABT, batasKueriMs: 60000, timpaKatalog: timpa }).nilaiPenanda({ perkaraId: pid }, kode);
    for (const k of kode) {
      const x = a.get(k) || {};
      const y = b.get(k) || {};
      if (y.status === "galat") hasil.galatBaru.push([pid, k, y.sebab]);
      if (x.status === "galat") hasil.galatLama.push([pid, k, x.sebab]);
      if (String(x.polos) === String(y.polos) && x.status === y.status) hasil.sama[k] += 1;
      else hasil.berubah[k].push({ perkara: pid, jenis, gol, sebelum: String(x.polos).slice(0, PANJANG), sesudah: String(y.polos).slice(0, PANJANG) });
    }
  }
  fs.writeFileSync(keluar, JSON.stringify(hasil, null, 1));
  console.log("perkara", sampel.length, "galat baru", hasil.galatBaru.length, "galat lama", hasil.galatLama.length);
  for (const k of kode) console.log(k, "sama", hasil.sama[k], "berubah", hasil.berubah[k].length);
  pool.end();
})();
