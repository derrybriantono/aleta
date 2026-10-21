// Tangkapan Playwright Chromium headless: kepala halaman perkara SIPP (replika memakai CSS SIPP sungguhan dari
// D:/Aplikasi/SIPP/resources) dengan tombol "Tarik data" di kiri "Selamat Datang". Markup dari ekstensi yang
// dijalankan di jsdom (uji tarik-satu-perkara-21okt dengan ALETA_TANGKAP_TARIKSATU=<awalan>); gaya tombol dari
// tarik-satu-perkara.js. Tidak menyentuh SIPP/server.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const AKAR = path.resolve(import.meta.dirname, "../../..");
const require = createRequire(path.join(AKAR, "manajemen_surat/package.json"));
const { chromium } = require("playwright");
const awalan = process.argv[2] || "D:/Aplikasi/aleta/tmp/w29-layar/ts";
const keluar = process.argv[3] || path.dirname(awalan);
const SIPP = "file:///D:/Aplikasi/SIPP/resources";
const panel = fs.readFileSync(path.join(AKAR, "ekstensi-sipp/panel.css"), "utf8");

const halaman = (sumber, gelap) => {
  const gaya = (sumber.match(/<style id="aleta-tarik-satu-gaya">[\s\S]*?<\/style>/) || [""])[0];
  const badan = (sumber.match(/<body[^>]*>([\s\S]*)<\/body>/) || [, ""])[1].replaceAll('src="/resources/', `src="${SIPP}/`);
  const html = gelap ? ' data-aleta-tema-sipp="gelap" data-aleta-tema="gelap"' : "";
  return `<!doctype html><html${html}><head><meta charset="utf-8"><title>SIPP (replika)</title>
<link rel="stylesheet" href="${SIPP}/css/style.css"><link rel="stylesheet" href="${SIPP}/css/bootstrap.css">
<link rel="stylesheet" href="${SIPP}/css/AdminLTE.css"><link rel="stylesheet" href="${SIPP}/css/font-awesome/css/font-awesome.css">
<style>${panel}</style>${gaya}</head><body>${badan}</body></html>`;
};

const peramban = await chromium.launch();
try {
  for (const nama of ["1-awal", "2-menunggu", "3-berjalan", "4-selesai", "5-segar", "6-admin-paksa", "7-bukan-ecourt", "8-ditolak"]) {
    const f = `${awalan}-${nama}.html`;
    if (!fs.existsSync(f)) continue;
    const sumber = fs.readFileSync(f, "utf8");
    for (const gelap of [false, true]) {
      for (const [ukuran, lebar] of [["laptop", 1366], ["kecil", 1024]]) {
        if (ukuran === "kecil" && nama !== "4-selesai" && nama !== "3-berjalan") continue;
        const berkas = path.join(keluar, `${nama}-${gelap ? "gelap" : "terang"}${ukuran === "kecil" ? "-kecil" : ""}`);
        fs.writeFileSync(`${berkas}.html`, halaman(sumber, gelap));
        const p = await peramban.newPage({ viewport: { width: lebar, height: 260 } });
        await p.goto(`file:///${berkas.replaceAll("\\", "/")}.html`);
        await p.waitForTimeout(250);
        await p.screenshot({ path: `${berkas}.png`, clip: { x: 0, y: 0, width: lebar, height: 130 } });
        await p.close();
      }
    }
  }
} finally {
  await peramban.close();
}
console.log("selesai");
