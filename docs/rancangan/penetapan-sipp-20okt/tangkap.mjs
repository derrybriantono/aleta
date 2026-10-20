// Tangkapan Playwright Chromium headless: halaman perkara SIPP (replika) dengan tombol dan panel Penetapan Otomatis.
// Markup dari ekstensi sungguhan yang dijalankan di jsdom (uji ekstensi-penetapan-sipp-tombol-20okt dengan
// ALETA_TANGKAP_PENSIPP=<awalan>); gaya dari ekstensi-sipp/penetapan-sipp.css + panel.css. Tidak menyentuh SIPP/server.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const AKAR = path.resolve(import.meta.dirname, "../../..");
const require = createRequire(path.join(AKAR, "manajemen_surat/package.json"));
const { chromium } = require("playwright");
const awalan = process.argv[2] || "D:/Aplikasi/aleta/tmp/pensipp";
const keluar = import.meta.dirname;
const css = ["panel.css", "penetapan-sipp.css"].map((b) => fs.readFileSync(path.join(AKAR, "ekstensi-sipp", b), "utf8")).join("\n");
const sipp = `
body{margin:0;font:13px/1.5 Arial,sans-serif;background:#fff;color:#333}
.kepala-sipp{background:#008c4b;color:#fff;padding:10px 16px;font-weight:700}
.badge{width:100%;background:#f4f4f4}.badge td{padding:6px 16px}
#konten{padding:0 16px 24px}
.btn{display:inline-block;border:1px solid #ccc;border-radius:3px;padding:3px 10px;background:#fff;color:#333;text-decoration:none;font-size:13px}
table{border-collapse:collapse}td{vertical-align:middle}
.aleta-l1-submenu a{margin-left:3px;background:#16704a;color:#fff!important;border-color:#235b3e}
.data-umum td{padding:3px 8px;border-bottom:1px solid #eee}
`;
// Tombol Buka di ABT / Buka di ALETA (sipp-ide-l1) ditambahkan di replika agar urutannya terlihat.
const halaman = (isi, gelap) => {
  const sisip = isi.replace(/(<td class="aleta-sisip aleta-pensipp aleta-pensipp-sel">[\s\S]*?<\/td>)/, `$1<td class="aleta-sisip aleta-l1 aleta-l1-submenu"><a class="btn btn-default btn-sm" href="#">Buka di ABT</a><a class="btn btn-default btn-sm" href="#">Buka di ALETA</a></td>`);
  return `<!doctype html><html${gelap ? ' data-aleta-tema-sipp="gelap"' : ""}><head><meta charset="utf-8"><title>SIPP (replika)</title><style>${sipp}${gelap ? "body{background:#0d1512;color:#dfe8e2}.badge{background:#131c18}.kepala-sipp{background:#1c5539}.btn{background:#17211c;color:#dfe8e2;border-color:#27342e}.data-umum td{border-color:#27342e}" : ""}</style><style>${css}</style></head><body><div class="kepala-sipp">SIPP Pengadilan Agama Donggala · Detil Perkara (tiruan)</div><div id="konten">${sisip}</div></body></html>`;
};
const peramban = await chromium.launch();
try {
  for (const nama of ["1-awal", "2-konfirmasi", "3-berjalan", "4-selesai", "5-gagal", "6-manual", "7-muat-ulang", "8-sesudah-muat-ulang", "9-muat-ulang-gagal"]) {
    const f = `${awalan}-${nama}.html`;
    if (!fs.existsSync(f)) continue;
    const isi = fs.readFileSync(f, "utf8");
    for (const gelap of [false, true]) {
      for (const [ukuran, lebar, tinggi] of [["laptop", 1280, 900], ["hp", 390, 900]]) {
        if (ukuran === "hp" && !gelap && nama !== "1-awal" && nama !== "4-selesai") continue;
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
