// Membangkitkan cermin portal untuk blok W3b di ekstensi-sipp/panel-alat.js (ALAT_PETA_BAWAAN) ke
// manajemen_surat/src/lib/tipe-keluaran/bawaan/bawaan-ekstensi.ts, bagian "putusan.peta-blangko".
// Sumber DIJALANKAN di node:vm persis seperti uji tipe-keluaran-cermin-ekstensi.test.ts; entri baru = kunci ALAT_PETA_BAWAAN yang belum ada di cermin
// (selalu di ujung karena blok W3b ada sesudah blok I28). Blok lama W3b di cermin dibuang dulu, jadi aman dijalankan berulang.
// Pakai (dari folder paket):  node alat/cermin_peta.mjs
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const AKAR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const PANEL = path.join(AKAR, "ekstensi-sipp", "panel-alat.js");
const CERMIN = path.join(AKAR, "manajemen_surat", "src", "lib", "tipe-keluaran", "bawaan", "bawaan-ekstensi.ts");

const elemen = () => ({
  style: { setProperty() {} },
  classList: { add() {}, remove() {}, toggle() {} },
  dataset: {},
  setAttribute() {},
  removeAttribute() {},
  getAttribute: () => null,
  appendChild: (x) => x,
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener() {},
});
const konteks = {
  console, setTimeout, clearTimeout, Date, JSON, Math, Number, String, Boolean, Array, Object, Promise, Error, Map, Set, URLSearchParams, URL, AbortController,
  document: { documentElement: elemen(), createElement: elemen, querySelector: () => null, querySelectorAll: () => [], addEventListener() {} },
  location: { origin: "http://127.0.0.1", pathname: "/", search: "" },
  window: {
    location: { hostname: "127.0.0.1", pathname: "/", search: "", origin: "http://127.0.0.1" },
    sessionStorage: { getItem: () => null, setItem() {} },
    localStorage: { getItem: () => null, setItem() {} },
    addEventListener() {},
    postMessage() {},
  },
  chrome: {
    runtime: { getManifest: () => ({ version: "0.0.0" }), getURL: (p) => p },
    storage: { onChanged: { addListener() {} }, local: { get: async () => ({}), set: async () => undefined, remove: async () => undefined } },
  },
  fetch: async () => ({ ok: true, status: 200, json: async () => ({}), clone() { return this; } }),
  requestAnimationFrame: (cb) => setTimeout(cb, 0),
};
konteks.globalThis = konteks;
vm.createContext(konteks);
vm.runInContext(fs.readFileSync(PANEL, "utf8"), konteks, { filename: "panel-alat.js" });
const PETA = JSON.parse(JSON.stringify(vm.runInContext("ALAT_PETA_BAWAAN", konteks)));
const kunciPeta = Object.keys(PETA);

let ts = fs.readFileSync(CERMIN, "utf8");
const awal = ts.indexOf('  "putusan.peta-blangko": [');
const akhir = ts.indexOf('  "putusan.padanan-jenis": [');
if (awal < 0 || akhir < 0) throw new Error("bagian peta-blangko tidak ditemukan");
let bagian = ts.slice(awal, akhir);
// buang blok lama W3b
bagian = bagian.replace(/\n    \/\* === W3b 21 Okt ===[\s\S]*?\/\* === AKHIR W3b === \*\/\n/, "\n");
const lama = [...bagian.matchAll(/\n      kunci: "((?:[^"\\]|\\.)*)",/g)].map((m) => JSON.parse(`"${m[1]}"`));
const urutanTerakhir = Math.max(...[...bagian.matchAll(/urutan: (\d+),/g)].map((m) => Number(m[1])));
if (lama.length !== urutanTerakhir + 1) throw new Error(`cermin tidak rapat: ${lama.length} entri vs urutan terakhir ${urutanTerakhir}`);
if (JSON.stringify(lama) !== JSON.stringify(kunciPeta.slice(0, lama.length))) throw new Error("urutan kunci cermin lama tidak sama dengan awalan ALAT_PETA_BAWAAN - blok W3b harus di ujung");
const baru = kunciPeta.slice(lama.length);

const q = (x) => JSON.stringify(x);
const objek = (o) => "{ " + Object.entries(o).map(([k, v]) => `${k}: ${q(v)}`).join(", ") + " }";
const entri = baru.map((k, i) => {
  const { berkas, bawaan, ...data } = PETA[k];
  if (bawaan !== true) throw new Error(`baris ${k} tanpa bawaan: true`);
  return `    {\n      kunci: ${q(k)},\n      nilai: ${q(berkas)},\n      data: ${objek(data)},\n      urutan: ${lama.length + i},\n    },`;
});
const blok = `    /* === W3b 21 Okt === cermin blok W3b panel-alat.js (pencabutan kekuasaan orang tua 353 / wali 355, penunjukan wali 356, ganti rugi terhadap wali 357, nafkah anak oleh ibu 350) */\n${entri.join("\n")}\n    /* === AKHIR W3b === */\n`;
const penutup = bagian.lastIndexOf("  ],");
if (penutup < 0) throw new Error("penutup bagian tidak ditemukan");
bagian = bagian.slice(0, penutup) + blok + bagian.slice(penutup);
ts = ts.slice(0, awal) + bagian + ts.slice(akhir);
fs.writeFileSync(CERMIN, ts, "utf8");
console.log(`cermin: ${lama.length} entri lama + ${baru.length} entri W3b = ${kunciPeta.length}`);
