// Tangkapan Playwright Chromium headless: panel ALETA di detil perkara, dashboard, dan daftar perkara SIPP (replika).
// Markup dari ekstensi sungguhan yang dijalankan di jsdom (uji panel-sipp-tampilan-21okt dengan
// ALETA_TANGKAP_SIPP23=<awalan>); gaya dari ekstensi-sipp/{panel,penetapan-sipp,putusan-sipp,putusan-terjadwal}.css.
// Tidak menyentuh SIPP/server. Hasil: PNG di folder keluaran (bawaan D:/Aplikasi/aleta/tmp/sipp23-layar).
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const AKAR = path.resolve(import.meta.dirname, "../../..");
const require = createRequire(path.join(AKAR, "manajemen_surat/package.json"));
const { chromium } = require("playwright");
const awalan = process.argv[2] || "D:/Aplikasi/aleta/tmp/sipp23-layar/s23";
const keluar = process.argv[3] || "D:/Aplikasi/aleta/tmp/sipp23-layar";
const css = ["panel.css", "penetapan-sipp.css", "putusan-sipp.css", "putusan-terjadwal.css"].map((b) => fs.readFileSync(path.join(AKAR, "ekstensi-sipp", b), "utf8")).join("\n");
const sipp = `
body{margin:0;font:13px/1.5 Arial,sans-serif;background:#fff;color:#333}
.kepala-sipp{background:#008c4b;color:#fff;padding:10px 16px;font-weight:700}
#konten{padding:0 16px 24px}
.btn{display:inline-block;border:1px solid #ccc;border-radius:3px;padding:3px 10px;background:#fff;color:#333;text-decoration:none;font-size:13px;cursor:pointer}
table{border-collapse:collapse}td{vertical-align:middle}
.aleta-l1-submenu a{margin-left:3px;background:#16704a;color:#fff!important;border-color:#235b3e}
h1{font-size:24px;font-weight:500;margin:20px 0 10px}h1 small{font-size:75%;color:#777}
.breadcrumb{list-style:none;display:flex;gap:8px;padding:0;color:#777}
.kotak-stat{border:1px solid #ddd;border-radius:4px;padding:12px;margin-top:8px}
#pageTitle{font-size:18px;font-weight:700;margin:14px 0 4px}#right{float:right}
#left{float:left}#pages{clear:both;padding-top:10px}
#daftar{width:100%}#daftar th,#daftar td{border:1px solid #ccc;padding:4px 10px}
`;
const gelapGaya =
  "body{background:#0d1512;color:#dfe8e2}.kepala-sipp{background:#1c5539}.btn{background:#17211c;color:#dfe8e2;border-color:#27342e}#daftar th,#daftar td{border-color:#27342e}h1 small{color:#9fb1a6}.kotak-stat{border-color:#27342e}";
const halaman = (isi, judul, gelap) =>
  `<!doctype html><html${gelap ? ' data-aleta-tema-sipp="gelap"' : ""}><head><meta charset="utf-8"><title>SIPP (replika)</title><style>${sipp}${gelap ? gelapGaya : ""}</style><style>${css}</style></head><body><div class="kepala-sipp">${judul}</div><div id="konten">${isi}</div></body></html>`;

const daftar = [
  ["1-detil-awal", "Detil perkara (awal): Penetapan terbentang, beban terlipat, Putusan dan Jadwalkan terlipat"],
  ["2-detil-rincian", "Detil perkara: rincian beban dibuka"],
  ["3-detil-putusan", "Detil perkara: Putusan Otomatis dibuka, berkas dipilih"],
  ["4-detil-jadwal", "Detil perkara: Jadwalkan Putusan (satu perkara)"],
  ["5-dashboard-awal", "Dashboard: tombol di samping judul"],
  ["6-dashboard-massal", "Dashboard: Jadwalkan Putusan Massal"],
  ["7-daftar-awal", "Daftar perkara perdata gugatan: tombol di samping Cetak"],
  ["8-daftar-massal", "Daftar perkara: Jadwalkan Putusan Massal"],
];
const ukuranSemua = [
  ["laptop-kecil", 1024, 768],
  ["lebar", 1600, 900],
  ["hp", 390, 900],
];
const peramban = await chromium.launch();
try {
  for (const [nama, judul] of daftar) {
    const f = `${awalan}-${nama}.html`;
    if (!fs.existsSync(f)) continue;
    const isi = fs.readFileSync(f, "utf8");
    for (const gelap of [false, true]) {
      for (const [ukuran, lebar, tinggi] of ukuranSemua) {
        // HP hanya untuk beberapa keadaan; laptop kecil dan lebar untuk semuanya.
        if (ukuran === "hp" && !["1-detil-awal", "6-dashboard-massal", "8-daftar-massal"].includes(nama)) continue;
        if (ukuran === "lebar" && gelap && !["1-detil-awal", "6-dashboard-massal"].includes(nama)) continue;
        const p = await peramban.newPage({ viewport: { width: lebar, height: tinggi } });
        await p.setContent(halaman(isi, `SIPP Pengadilan Agama Donggala (tiruan) · ${judul}`, gelap));
        await p.screenshot({ path: path.join(keluar, `${nama}-${gelap ? "gelap" : "terang"}-${ukuran}.png`), fullPage: true });
        await p.close();
      }
    }
  }
} finally {
  await peramban.close();
}
console.log("selesai");
