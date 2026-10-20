// Tangkapan layar popup ekstensi (Playwright Chromium headless, tanpa Chrome pengguna).
// Pakai: dari manajemen_surat/  ->  node ../docs/rancangan/popup-rapi-21okt/tangkap.mjs <awalan: sebelum|sesudah>
// Popup dibuka sebagai berkas lokal dengan chrome.storage + fetch tiruan (tanpa server, tanpa SIPP).
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import fs from "node:fs";

const sini = path.dirname(fileURLToPath(import.meta.url));
const akar = path.resolve(sini, "../../..");
const require = createRequire(path.join(akar, "manajemen_surat", "package.json"));
const { chromium } = require("playwright");

const awalan = process.argv[2] || "sesudah";
const popup = pathToFileURL(path.join(akar, "ekstensi-sipp", "popup.html")).href;

const SKENARIO = [
  { nama: "super-ui", peran: "Super Admin", simpan: { ujiTampilan: "ui" } },
  { nama: "super-lama", peran: "Super Admin", simpan: {} },
  { nama: "hakim", peran: "Hakim", simpan: {} },
  { nama: "kasir", peran: "Kasir", simpan: {} },
];

const tiruan = (peran, simpanAwal) => `
(() => {
  const simpanan = Object.assign({ asalPortal: "http://192.168.10.10/aleta", akunSipp: "fahri" }, ${JSON.stringify(simpanAwal)});
  const salin = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
  window.chrome = {
    runtime: { id: "aleta-uji", getManifest: () => ({ version: "1.205.19", host_permissions: [] }), sendMessage: async () => ({}) },
    storage: {
      local: {
        get: async (k) => { const d = k == null ? Object.keys(simpanan) : [k].flat(); const h = {}; for (const x of d) if (x in simpanan) h[x] = salin(simpanan[x]); return h; },
        set: async (i) => { Object.assign(simpanan, salin(i)); },
        remove: async (k) => { for (const x of [k].flat()) delete simpanan[x]; },
      },
      session: { get: async () => ({}), set: async () => undefined },
      onChanged: { addListener() {} },
    },
  };
  window.__simpanan = simpanan;
  window.fetch = async (a) => {
    a = String(a);
    if (a.includes("info=siapa")) return { ok: true, status: 200, json: async () => ({ ok: true, data: { pengguna: { nama: "Pengguna Uji", peran: ${JSON.stringify(peran)} }, versi: "1.205.19" } }) };
    if (a.includes("tarik-ecourt")) return { ok: true, status: 200, json: async () => ({ ok: true, data: { aktif: true } }) };
    return { ok: true, status: 200, url: a, json: async () => ({}) };
  };
})();`;

const luar = path.join(sini, awalan === "sebelum" ? "sebelum" : "sesudah");
fs.mkdirSync(luar, { recursive: true });
const peramban = await chromium.launch();
for (const sk of SKENARIO) {
  for (const tema of ["terang", "gelap"]) {
    const konteks = await peramban.newContext({ viewport: { width: 380, height: 900 }, colorScheme: tema === "gelap" ? "dark" : "light" });
    const halaman = await konteks.newPage();
    await halaman.addInitScript(tiruan(sk.peran, { ...sk.simpan, temaPopup: tema }));
    await halaman.goto(popup);
    await halaman.waitForFunction(() => !/memuat/.test(document.getElementById("akunAleta")?.textContent || ""), null, { timeout: 5000 }).catch(() => {});
    await halaman.waitForTimeout(500);
    const berkas = path.join(luar, `${sk.nama}-${tema}.png`);
    if (process.env.KLIP) {
      // Potongan 380 x 1100 mulai dari y=KLIP, untuk memeriksa bagian tertentu dengan mata.
      await halaman.screenshot({ path: berkas.replace(".png", "-klip.png"), fullPage: true, clip: { x: 0, y: Number(process.env.KLIP), width: 380, height: 1100 } });
    } else await halaman.screenshot({ path: berkas, fullPage: true });
    console.log("tersimpan", berkas);
    await konteks.close();
  }
}
await peramban.close();
