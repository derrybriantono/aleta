// Pengimpor data peladen ALETA ke skema yang lebih baru.
// Memenggal SQL per-pernyataan (menghormati tanda kutip), membuang tabel dan
// kolom yang sudah tidak ada, lalu melaporkan persis apa yang tidak terbawa.
import fs from "node:fs";
import pg from "pg";

const BERKAS = process.argv[2];
const ALAMAT = process.env.DATABASE_URL;
if (!BERKAS || !ALAMAT) { console.error("pakai: node impor.mjs <berkas.sql>  (butuh DATABASE_URL)"); process.exit(1); }

function* pernyataan(teks) {
  let buf = "", dalamKutip = false;
  for (let i = 0; i < teks.length; i++) {
    const c = teks[i];
    if (dalamKutip) {
      if (c === "'") { if (teks[i + 1] === "'") { buf += "''"; i++; continue; } dalamKutip = false; }
      buf += c; continue;
    }
    if (c === "'") { dalamKutip = true; buf += c; continue; }
    if (c === "-" && teks[i + 1] === "-") { while (i < teks.length && teks[i] !== "\n") i++; continue; }
    if (c === ";") { const s = buf.trim(); buf = ""; if (s) yield s; continue; }
    buf += c;
  }
  const s = buf.trim(); if (s) yield s;
}

function pecahNilai(s) {
  const out = []; let buf = "", dalamKutip = false, dalam = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (dalamKutip) {
      if (c === "'") { if (s[i + 1] === "'") { buf += "''"; i++; continue; } dalamKutip = false; }
      buf += c; continue;
    }
    if (c === "'") { dalamKutip = true; buf += c; continue; }
    if (c === "(") { dalam++; buf += c; continue; }
    if (c === ")") { dalam--; buf += c; continue; }
    if (c === "," && dalam === 0) { out.push(buf.trim()); buf = ""; continue; }
    buf += c;
  }
  out.push(buf.trim());
  return out;
}

const klien = new pg.Client({ connectionString: ALAMAT });
await klien.connect();
await klien.query("SET synchronous_commit = off");

const kol = new Map();
const tipe = new Map();
const r = await klien.query(
  "SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema='public'"
);
for (const b of r.rows) {
  if (!kol.has(b.table_name)) kol.set(b.table_name, new Set());
  kol.get(b.table_name).add(b.column_name);
  tipe.set(`${b.table_name}.${b.column_name}`, b.data_type);
}
console.log(`skema hidup : ${kol.size} tabel`);

const teks = fs.readFileSync(BERKAS, "utf8");
const pola = /^INSERT INTO "([a-z0-9_]+)"\s*\(([\s\S]*?)\)\s*VALUES\s*\(([\s\S]*)\)$/i;

let total = 0, masuk = 0;
const tabelHilang = new Map(), kolomHilang = new Map(), gagal = [];
const dipaksa = new Map();
const tertunda = [];

for (const p of pernyataan(teks)) {
  const m = pola.exec(p);
  if (!m) { if (/^SET /i.test(p)) continue; continue; }
  total++;
  const tabel = m[1];
  if (!kol.has(tabel)) { tabelHilang.set(tabel, (tabelHilang.get(tabel) || 0) + 1); continue; }
  const namaKol = m[2].split(",").map((x) => x.trim().replace(/^"|"$/g, ""));
  const nilai = pecahNilai(m[3]);
  if (namaKol.length !== nilai.length) { gagal.push([p.slice(0, 120), "jumlah kolom dan nilai tidak sama"]); continue; }
  const pakaiK = [], pakaiN = [];
  for (let i = 0; i < namaKol.length; i++) {
    if (kol.get(tabel).has(namaKol[i])) {
      let v = nilai[i];
      // 2.23.0 menulis TRUE / 12 telanjang; 2.26.0 mendeklarasikan kolomnya jsonb
      if (tipe.get(`${tabel}.${namaKol[i]}`) === "jsonb" && /^(TRUE|FALSE|-?\d+(\.\d+)?)$/i.test(v)) {
        v = `to_jsonb(${v})`;
        dipaksa.set(`${tabel}.${namaKol[i]}`, (dipaksa.get(`${tabel}.${namaKol[i]}`) || 0) + 1);
      }
      pakaiK.push(namaKol[i]); pakaiN.push(v);
    }
    else {
      const k = `${tabel}.${namaKol[i]}`;
      kolomHilang.set(k, (kolomHilang.get(k) || 0) + 1);
    }
  }
  if (pakaiK.length === 0) continue;
  const sql = `INSERT INTO "${tabel}" (${pakaiK.map((c) => `"${c}"`).join(", ")}) VALUES (${pakaiN.join(", ")})`;
  try { await klien.query(sql); masuk++; }
  catch (e) { tertunda.push([tabel, sql, e.message]); }
}

// Kegagalan kunci asing sering hanya soal urutan baris. Diulang sampai tidak
// ada kemajuan lagi - rantai induk-anak bisa lebih dari dua tingkat.
let masukUlang = 0, sisa = tertunda, putaran = 0;
while (sisa.length > 0 && putaran < 6) {
  putaran++;
  const berikut = [];
  let majuPutaranIni = 0;
  for (const [tabel, sql, pesan] of sisa) {
    try { await klien.query(sql); masukUlang++; majuPutaranIni++; }
    catch (e) { berikut.push([tabel, sql, e.message]); }
  }
  console.log(`  putaran ulang ${putaran}: ${majuPutaranIni} masuk, ${berikut.length} tersisa`);
  sisa = berikut;
  if (majuPutaranIni === 0) break;
}
for (const [tabel, sql, pesan] of sisa) gagal.push([tabel, pesan]);

console.log(`pernyataan dibaca : ${total}`);
console.log(`berhasil masuk    : ${masuk + masukUlang}  (${masukUlang} lewat putaran kedua)`);
console.log("");
console.log("TABEL yang sudah tidak ada di skema baru:");
if (tabelHilang.size === 0) console.log("  (tidak ada)");
for (const [t, n] of [...tabelHilang].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(6)} baris  ${t}`);
console.log("");
console.log("KOLOM yang sudah tidak ada (nilainya dibuang, barisnya tetap masuk):");
if (kolomHilang.size === 0) console.log("  (tidak ada)");
for (const [c, n] of [...kolomHilang].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(6)}x  ${c}`);
console.log("");
console.log("NILAI yang dipaksa jadi jsonb (tipe kolom berubah sejak 2.23.0):");
if (dipaksa.size === 0) console.log("  (tidak ada)");
for (const [c, n] of [...dipaksa].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(6)}x  ${c}`);
console.log("");
console.log(`BARIS yang tetap gagal : ${gagal.length}`);
const ringkas = new Map();
for (const [t, pesan] of gagal) {
  const k = `${t} :: ${String(pesan).split("\n")[0]}`;
  ringkas.set(k, (ringkas.get(k) || 0) + 1);
}
for (const [k, n] of [...ringkas].sort((a, b) => b[1] - a[1]).slice(0, 15)) console.log(`  ${String(n).padStart(6)}x  ${k}`);

await klien.end();
