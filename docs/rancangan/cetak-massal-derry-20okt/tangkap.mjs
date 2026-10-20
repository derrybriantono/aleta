// Tangkapan Playwright jendela "Cetak massal" dari replika statis.
// Markup diambil dari ekstensi sungguhan yang dijalankan di jsdom (uji blangko-derry-cetak-massal-20okt dengan
// ALETA_TANGKAP_MASSAL=<awalan>), gaya dari ekstensi-sipp/blangko-derry.css. Tidak menyentuh ABT/SIPP/server.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const AKAR = path.resolve(import.meta.dirname, "../../..");
const require = createRequire(path.join(AKAR, "manajemen_surat/package.json"));
const { chromium } = require("playwright");

const awalan = process.argv[2] || "D:/Aplikasi/aleta/tmp/massal";
const keluar = import.meta.dirname;
const css = fs.readFileSync(path.join(AKAR, "ekstensi-sipp/blangko-derry.css"), "utf8");
const halaman = (isi, tema) =>
  `<!doctype html><html><head><meta charset="utf-8"><title>Cetak massal (replika)</title><style>${css}</style>
<style>html,body{margin:0;background:${tema === "terang" ? "#dfe7e2" : "#0a1a13"};height:100%}</style></head><body>${isi.replace(/id="aleta-bd-akar"/, `id="aleta-bd-akar" data-tema="${tema}"`)}</body></html>`;

const peramban = await chromium.launch();
try {
  for (const nama of ["1-tombol", "2-daftar-dipilih", "3-pemilih-blangko", "4-isi-otomatis", "5-ringkasan-gagal", "6-selesai"]) {
    const isi = fs.readFileSync(`${awalan}-${nama}.html`, "utf8");
    for (const tema of ["gelap", "terang"]) {
      for (const [ukuran, lebar, tinggi] of [["laptop", 1280, 800], ["hp", 390, 820]]) {
        if (ukuran === "hp" && tema === "terang") continue;
        const p = await peramban.newPage({ viewport: { width: lebar, height: tinggi } });
        await p.setContent(halaman(isi, tema));
        await p.screenshot({ path: path.join(keluar, `${nama}-${tema}${ukuran === "hp" ? "-hp" : ""}.png`) });
        await p.close();
      }
    }
  }
} finally {
  await peramban.close();
}
console.log("selesai");
