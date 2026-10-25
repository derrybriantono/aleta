#!/usr/bin/env node
/**
 * ============================================================================
 * K11 - PETA FITUR EKSTENSI (inventaris sebelum/sesudah pemecahan skrip)
 * ============================================================================
 *
 * Pemecahan konten.js dan pemuatan skrip per halaman TIDAK boleh menghilangkan satu
 * fitur pun. Peta ini adalah inventaris yang dapat dibandingkan mesin:
 *
 *   kelompok   tiap kelompok skrip konten manifest (matches, run_at, urutan js)
 *   berkas     tiap berkas JS: byte, sidik isi, nama tingkat atas (function/const/let/var/
 *              class), nama yang dipasang ke globalThis/window, dan - untuk berkas yang
 *              dipecah - sidik tiap pernyataan tingkat atas
 *
 * `k11-peta-fitur-sebelum.json` (di src/test/fixtures) dibuat dari ekstensi 1.205.39 SEBELUM
 * K11. Uji k11-peta-fitur-26okt.test.ts membangun peta yang sama dari ekstensi sekarang
 * lalu menyatakan: semua nama masih ada, semua pernyataan konten.js masih ada
 * (persis), tiap berkas yang lepas dari manifest terdaftar sebagai modul malas.
 *
 * Pakai: node scripts/k11-peta.mjs <folder-ekstensi> <keluar.json>
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { parse } from "acorn";

const BATAS_PARSE_BYTE = 3 * 1024 * 1024;

const sidik = (teks, panjang = 40) => crypto.createHash("sha1").update(teks).digest("hex").slice(0, panjang);

/** Nama yang dideklarasikan oleh satu pola (destrukturisasi ikut). */
function namaDariPola(p, keluar) {
  if (!p) return;
  if (p.type === "Identifier") keluar.push(p.name);
  else if (p.type === "ObjectPattern") for (const q of p.properties) namaDariPola(q.value || q.argument, keluar);
  else if (p.type === "ArrayPattern") for (const q of p.elements) namaDariPola(q, keluar);
  else if (p.type === "AssignmentPattern") namaDariPola(p.left, keluar);
  else if (p.type === "RestElement") namaDariPola(p.argument, keluar);
}

/** Pernyataan tingkat atas sebuah berkas: [{ jenis, nama[], teks }]. */
export function pernyataanTingkatAtas(sumber) {
  const ast = parse(sumber, { ecmaVersion: "latest", sourceType: "script", ranges: true });
  return ast.body.map((n) => {
    const nama = [];
    if (n.type === "FunctionDeclaration" || n.type === "ClassDeclaration") nama.push(n.id.name);
    if (n.type === "VariableDeclaration") for (const d of n.declarations) namaDariPola(d.id, nama);
    return { jenis: n.type, nama, teks: sumber.slice(n.start, n.end), direktif: n.type === "ExpressionStatement" && typeof n.directive === "string" };
  });
}

/** Nama yang dipasang berkas ke globalThis/window/self (penugasan langsung atau Object.assign). */
export function namaEkspor(sumber) {
  const hasil = new Set();
  for (const m of sumber.matchAll(/\b(?:globalThis|window|self|akar)\.([A-Za-z_$][\w$]*)\s*=[^=]/g)) hasil.add(m[1]);
  for (const m of sumber.matchAll(/Object\.assign\(\s*(?:globalThis|window|akar)\s*,\s*\{([^}]*)\}/g)) {
    for (const n of m[1].split(",")) {
      const k = n.split(":")[0].trim();
      if (/^[A-Za-z_$][\w$]*$/.test(k)) hasil.add(k);
    }
  }
  return [...hasil].sort();
}

export function bangunPeta(dirEkstensi, opsi = {}) {
  const manifest = JSON.parse(fs.readFileSync(path.join(dirEkstensi, "manifest.json"), "utf8"));
  const kelompok = manifest.content_scripts.map((c, i) => ({
    i,
    matches: c.matches,
    run_at: c.run_at || "document_idle",
    world: c.world || "ISOLATED",
    js: c.js || [],
    css: c.css || [],
  }));
  const daftarBerkas = new Set(opsi.tambahan || []);
  for (const k of kelompok) for (const j of k.js) daftarBerkas.add(j);
  const berkas = {};
  for (const nama of [...daftarBerkas].sort()) {
    const jalur = path.join(dirEkstensi, nama);
    if (!fs.existsSync(jalur)) continue;
    const sumber = fs.readFileSync(jalur, "utf8");
    const info = { byte: Buffer.byteLength(sumber), sidik: sidik(sumber) };
    if (Buffer.byteLength(sumber) <= BATAS_PARSE_BYTE) {
      const stmt = pernyataanTingkatAtas(sumber);
      info.nama = [...new Set(stmt.flatMap((s) => s.nama))].sort();
      info.ekspor = namaEkspor(sumber);
      info.jumlahPernyataan = stmt.length;
      if (opsi.sidikPernyataan && opsi.sidikPernyataan.includes(nama)) info.pernyataan = stmt.filter((s) => !s.direktif).map((s) => sidik(s.teks, 12));
    }
    berkas[nama] = info;
  }
  return { versi: manifest.version, permissions: manifest.permissions, kelompok, berkas };
}

if (process.argv[1] && process.argv[1].endsWith("k11-peta.mjs")) {
  const [, , dir, keluar] = process.argv;
  if (!dir || !keluar) {
    console.error("pakai: node scripts/k11-peta.mjs <folder-ekstensi> <keluar.json>");
    process.exit(2);
  }
  const peta = bangunPeta(path.resolve(dir), { sidikPernyataan: ["konten.js"] });
  fs.writeFileSync(keluar, JSON.stringify(peta, null, 1));
  console.log(`peta: ${Object.keys(peta.berkas).length} berkas, ${peta.kelompok.length} kelompok -> ${keluar}`);
}
