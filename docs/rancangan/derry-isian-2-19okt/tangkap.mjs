// Tangkapan layar kartu "Perlu diisi" Blangko Derry (replika statis, BUKAN Chrome pengguna dan BUKAN server).
// Alur: (1) TANGKAP=1 TANGKAP_KE=<folder> [TANGKAP_NAMA=putusan-sebelum EKSTENSI_DIR=<salinan lama>] npx vitest run src/test/blangko-derry-isian-2-19okt.test.ts
//          menyimpan HTML kartu dari ekstensi yang dijalankan sungguhan di jsdom;
//       (2) node docs/rancangan/derry-isian-2-19okt/tangkap.mjs <folder-html> -> PNG + hasil-ukur.json di folder ini.
// Tiga ukuran layar 1366x768 pada zoom 100%, 125% dan 150% (viewport CSS 1366, 1093, 911 dengan skala piksel 1, 1.25, 1.5).
// TMP/TEMP harus di D: (D:\Aplikasi\aleta\tmp).
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const folder = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.resolve(folder, "../../../manajemen_surat/package.json"));
const { chromium } = require("playwright");
const sumberHtml = process.argv[2] || "D:/Aplikasi/aleta/tmp/isian2/tangkap";
const cssBaru = fs.readFileSync(path.resolve(folder, "../../../ekstensi-sipp/blangko-derry.css"), "utf8");
const cssLama = process.env.CSS_LAMA ? fs.readFileSync(process.env.CSS_LAMA, "utf8") : null;
const UKURAN = [
  { nama: "1366-zoom100", lebar: 1366, tinggi: 768, skala: 1 },
  { nama: "1366-zoom125", lebar: 1093, tinggi: 614, skala: 1.25 },
  { nama: "1366-zoom150", lebar: 911, tinggi: 512, skala: 1.5 },
];

async function ukur(page) {
  return page.evaluate(() => {
    const kartu = Array.from(document.querySelectorAll("#aleta-bd-akar .bd-pgrid > .bd-f")).map((el) => {
      const r = el.getBoundingClientRect();
      return { kode: el.getAttribute("data-f"), x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), panjang: el.classList.contains("panjang") || el.classList.contains("lebar") };
    });
    let tumpang = 0;
    let rapat = 0;
    for (let i = 0; i < kartu.length; i += 1) {
      for (let j = i + 1; j < kartu.length; j += 1) {
        const a = kartu[i];
        const b = kartu[j];
        const lebarIrisan = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
        const tinggiIrisan = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
        if (lebarIrisan > 1 && tinggiIrisan > 1) tumpang += 1;
        else if (lebarIrisan > 0 && tinggiIrisan > -8 && tinggiIrisan <= 0) rapat += 1; // vertikal kurang dari 8px
      }
    }
    const luap = Array.from(document.querySelectorAll("#aleta-bd-akar .bd-f *")).filter((e) => e.scrollWidth > e.clientWidth + 2 && getComputedStyle(e).overflowX === "visible" && e.clientWidth > 0 && e.children.length === 0 && !/^(INPUT|SELECT|TEXTAREA)$/.test(e.tagName)).length;
    const pendek = kartu.filter((k) => !k.panjang);
    const tinggiPendek = pendek.map((k) => k.h);
    return {
      lebarDokumen: document.documentElement.clientWidth,
      gulirMendatar: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      jumlahKartu: kartu.length,
      kartuTumpangTindih: tumpang,
      kartuTerlaluRapat: rapat,
      teksMeluap: luap,
      tinggiKartuPendek: tinggiPendek.length ? { min: Math.min(...tinggiPendek), maks: Math.max(...tinggiPendek) } : null,
      kartuPanjang: kartu.filter((k) => k.panjang).map((k) => ({ kode: k.kode, lebar: k.w, tinggi: k.h })),
      lebarGrid: Math.round(document.querySelector("#aleta-bd-akar .bd-pgrid").getBoundingClientRect().width),
    };
  });
}

const hasil = {};
const browser = await chromium.launch();
try {
  for (const berkas of fs.readdirSync(sumberHtml).filter((f) => f.endsWith(".html"))) {
    const nama = berkas.replace(/\.html$/, "");
    const isi = fs.readFileSync(path.join(sumberHtml, berkas), "utf8");
    const css = /sebelum/.test(nama) && cssLama ? cssLama : cssBaru;
    for (const u of UKURAN) {
      const konteks = await browser.newContext({ viewport: { width: u.lebar, height: u.tinggi }, deviceScaleFactor: u.skala });
      const page = await konteks.newPage();
      await page.setContent(`<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;background:#0f2a1f;font-family:"IBM Plex Sans",system-ui,"Segoe UI",Arial,sans-serif}${css}</style></head><body><div style="padding:12px 16px">${isi}</div></body></html>`);
      await page.waitForTimeout(250);
      // Panel menggulir di dalam wadahnya sendiri: tinggi layar dibesarkan supaya seluruh "Perlu diisi" tampak, lalu dipotret saja
      // dari deret tombol sampai kartu terakhir (lebar layar tetap lebar 1366 pada zoom yang diuji).
      await page.setViewportSize({ width: u.lebar, height: 3200 });
      await page.waitForTimeout(150);
      const kotak = await page.evaluate(() => {
        const a = document.querySelector("#bd-alatisi").getBoundingClientRect();
        const l = document.querySelector("#bd-perlu").getBoundingClientRect();
        return { x: Math.max(0, Math.floor(a.left) - 14), y: Math.max(0, Math.floor(a.top) - 14), w: Math.min(innerWidth, Math.ceil(l.right) + 14) - Math.max(0, Math.floor(a.left) - 14), h: Math.ceil(l.bottom) + 14 - Math.max(0, Math.floor(a.top) - 14) };
      });
      await page.screenshot({ path: path.join(folder, `${nama}-${u.nama}.png`), clip: { x: kotak.x, y: kotak.y, width: kotak.w, height: kotak.h } });
      hasil[`${nama}-${u.nama}`] = await ukur(page);
      await konteks.close();
    }
  }
} finally {
  await browser.close();
}
fs.writeFileSync(path.join(folder, "hasil-ukur.json"), JSON.stringify(hasil, null, 2));
console.log(JSON.stringify(hasil, null, 1));
