// Tangkapan Playwright jendela "Pilih blangko" (lencana perkiraan sidang) dari replika statis.
// Markup diambil dari ekstensi sungguhan yang dijalankan di jsdom (uji blangko-derry-pemilih-cetak-19okt dengan
// ALETA_TANGKAP_PEMILIH=<awalan>), gaya dari ekstensi-sipp/blangko-derry.css. Tidak menyentuh ABT/SIPP/server.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const AKAR = path.resolve(import.meta.dirname, "../../..");
const require = createRequire(path.join(AKAR, "manajemen_surat/package.json"));
const { chromium } = require("playwright");

const awalan = process.argv[2] || "D:/Aplikasi/aleta/tmp/pemilih";
const keluar = import.meta.dirname;
const css = fs.readFileSync(path.join(AKAR, "ekstensi-sipp/blangko-derry.css"), "utf8");

const halaman = (isi, tema) =>
  `<!doctype html><html><head><meta charset="utf-8"><title>Pilih blangko (replika)</title><style>${css}</style>
<style>html,body{margin:0;background:${tema === "terang" ? "#dfe7e2" : "#0a1a13"};height:100%}</style></head><body>${isi.replace(/id="aleta-bd-akar"/, `id="aleta-bd-akar" data-tema="${tema}"`)}</body></html>`;

const peramban = await chromium.launch();
try {
  for (const [berkas, nama] of [["saran", "1-disarankan"], ["bas", "2-kelompok-bas"]]) {
    const isi = fs.readFileSync(`${awalan}-${berkas}.html`, "utf8");
    for (const tema of ["gelap", "terang"]) {
      const p = await peramban.newPage({ viewport: { width: 1000, height: 700 } });
      await p.setContent(halaman(isi, tema));
      await p.screenshot({ path: path.join(keluar, `${nama}-${tema}.png`) });
      await p.close();
    }
  }
} finally {
  await peramban.close();
}
console.log("selesai");
