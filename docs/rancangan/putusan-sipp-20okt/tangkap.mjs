// Tangkapan Playwright Chromium headless: halaman perkara SIPP (replika) dengan tombol "Putusan Otomatis" di sebelah
// "Penetapan Otomatis" dan panelnya. Markup dari ekstensi sungguhan yang dijalankan di jsdom (uji
// ekstensi-putusan-sipp-tombol-20okt dengan ALETA_TANGKAP_PUSIPP=<awalan>); gaya dari ekstensi-sipp/putusan-sipp.css,
// penetapan-sipp.css, dan panel.css. Tidak menyentuh SIPP/server.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const AKAR = path.resolve(import.meta.dirname, "../../..");
const require = createRequire(path.join(AKAR, "manajemen_surat/package.json"));
const { chromium } = require("playwright");
const awalan = process.argv[2] || "D:/Aplikasi/aleta/tmp/pusipp";
const keluar = import.meta.dirname;
const css = ["panel.css", "penetapan-sipp.css", "putusan-sipp.css"].map((b) => fs.readFileSync(path.join(AKAR, "ekstensi-sipp", b), "utf8")).join("\n");
const sipp = `
body{margin:0;font:13px/1.5 Arial,sans-serif;background:#fff;color:#333}
.kepala-sipp{background:#008c4b;color:#fff;padding:10px 16px;font-weight:700}
#konten{padding:0 16px 24px}
.btn{display:inline-block;border:1px solid #ccc;border-radius:3px;padding:3px 10px;background:#fff;color:#333;text-decoration:none;font-size:13px}
table{border-collapse:collapse}td{vertical-align:middle}
.aleta-l1-submenu a{margin-left:3px;background:#16704a;color:#fff!important;border-color:#235b3e}
`;
const halaman = (isi, gelap) =>
  `<!doctype html><html${gelap ? ' data-aleta-tema-sipp="gelap"' : ""}><head><meta charset="utf-8"><title>SIPP (replika)</title><style>${sipp}${
    gelap ? "body{background:#0d1512;color:#dfe8e2}.kepala-sipp{background:#1c5539}.btn{background:#17211c;color:#dfe8e2;border-color:#27342e}" : ""
  }</style><style>${css}</style></head><body><div class="kepala-sipp">SIPP Pengadilan Agama Donggala · Detil Perkara 684/Pdt.G/2026/PA.Dgl (tiruan)</div><div id="konten">${isi}</div></body></html>`;
const peramban = await chromium.launch();
try {
  for (const nama of ["terbentang", "terisi", "konfirmasi", "selesai", "gagal"]) {
    const f = `${awalan}-${nama}.html`;
    if (!fs.existsSync(f)) continue;
    const isi = fs.readFileSync(f, "utf8");
    for (const gelap of [false, true]) {
      for (const [ukuran, lebar, tinggi] of [["laptop", 1280, 700], ["hp", 390, 900]]) {
        if (ukuran === "hp" && !gelap && nama !== "terbentang" && nama !== "selesai") continue;
        const p = await peramban.newPage({ viewport: { width: lebar, height: tinggi } });
        await p.setContent(halaman(isi, gelap));
        await p.screenshot({ path: path.join(keluar, `${nama}-${gelap ? "gelap" : "terang"}${ukuran === "hp" ? "-hp" : ""}.png`), fullPage: true });
        await p.close();
      }
    }
  }
} finally {
  await peramban.close();
}
console.log("selesai");
