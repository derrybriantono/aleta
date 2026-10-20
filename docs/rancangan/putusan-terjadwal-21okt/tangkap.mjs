// Tangkapan Playwright Chromium headless: Jadwalkan Putusan di halaman perkara SIPP (replika) dan di halaman daftar/jurnal.
// Markup dari ekstensi sungguhan yang dijalankan di jsdom (uji ekstensi-putusan-terjadwal-ui-21okt dengan
// ALETA_TANGKAP_PTJ=<awalan>); gaya dari ekstensi-sipp/putusan-terjadwal.css, putusan-sipp.css, penetapan-sipp.css,
// dan panel.css. Tidak menyentuh SIPP/server.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const AKAR = path.resolve(import.meta.dirname, "../../..");
const require = createRequire(path.join(AKAR, "manajemen_surat/package.json"));
const { chromium } = require("playwright");
const awalan = process.argv[2] || "D:/Aplikasi/aleta/tmp/ptj";
const keluar = import.meta.dirname;
const css = ["panel.css", "penetapan-sipp.css", "putusan-sipp.css", "putusan-terjadwal.css"].map((b) => fs.readFileSync(path.join(AKAR, "ekstensi-sipp", b), "utf8")).join("\n");
const sipp = `
body{margin:0;font:13px/1.5 Arial,sans-serif;background:#fff;color:#333}
.kepala-sipp{background:#008c4b;color:#fff;padding:10px 16px;font-weight:700}
#konten{padding:0 16px 24px}
.btn{display:inline-block;border:1px solid #ccc;border-radius:3px;padding:3px 10px;background:#fff;color:#333;text-decoration:none;font-size:13px}
table{border-collapse:collapse}td{vertical-align:middle}
.aleta-l1-submenu a{margin-left:3px;background:#16704a;color:#fff!important;border-color:#235b3e}
.aleta-pensipp-tombol{background:#16704a;color:#fff;border:2px solid #16704a;border-radius:4px;padding:4px 14px;font-weight:800}
.aleta-pusipp-tombol{background:#1f4e8c;color:#fff;border:2px solid #1f4e8c;border-radius:4px;padding:4px 14px;font-weight:800}
#daftar{margin-top:12px}#daftar th,#daftar td{border:1px solid #ccc;padding:4px 10px}
`;
const halaman = (isi, judul, gelap) =>
  `<!doctype html><html${gelap ? ' data-aleta-tema-sipp="gelap"' : ""}><head><meta charset="utf-8"><title>SIPP (replika)</title><style>${sipp}${
    gelap ? "body{background:#0d1512;color:#dfe8e2}.kepala-sipp{background:#1c5539}.btn{background:#17211c;color:#dfe8e2;border-color:#27342e}#daftar th,#daftar td{border-color:#27342e}" : ""
  }</style><style>${css}</style></head><body><div class="kepala-sipp">${judul}</div><div id="konten">${isi}</div></body></html>`;
const peramban = await chromium.launch();
try {
  const daftar = [
    ["perkara-berkas", "SIPP Pengadilan Agama Donggala · Detil Perkara 684/Pdt.G/2026/PA.Dgl (tiruan)"],
    ["perkara-konfirmasi", "SIPP Pengadilan Agama Donggala · Detil Perkara 684/Pdt.G/2026/PA.Dgl (tiruan)"],
    ["daftar-pasangan", "SIPP Pengadilan Agama Donggala · Jurnal Perkara Gugatan (tiruan)"],
    ["daftar-tanggal", "SIPP Pengadilan Agama Donggala · Jurnal Perkara Gugatan (tiruan)"],
    ["antrean", "SIPP Pengadilan Agama Donggala · Detil Perkara 684/Pdt.G/2026/PA.Dgl (tiruan)"],
  ];
  for (const [nama, judul] of daftar) {
    const f = `${awalan}-${nama}.html`;
    if (!fs.existsSync(f)) continue;
    const isi = fs.readFileSync(f, "utf8");
    for (const gelap of [false, true]) {
      for (const [ukuran, lebar, tinggi] of [["laptop", 1280, 900], ["hp", 390, 1100]]) {
        if (ukuran === "hp" && gelap && nama !== "perkara-berkas") continue;
        const p = await peramban.newPage({ viewport: { width: lebar, height: tinggi } });
        await p.setContent(halaman(isi, judul, gelap));
        await p.screenshot({ path: path.join(keluar, `${nama}-${gelap ? "gelap" : "terang"}${ukuran === "hp" ? "-hp" : ""}.png`), fullPage: nama.startsWith("daftar") ? false : true });
        await p.close();
      }
    }
  }
} finally {
  await peramban.close();
}
console.log("selesai");
