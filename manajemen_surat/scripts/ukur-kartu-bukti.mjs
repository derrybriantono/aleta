#!/usr/bin/env node
/**
 * Ukur bahan blangko cerai (F46): jenis bukti mana yang punya bunyi pada tiap keadaan cerai.
 * Hanya membaca docs/arahan/awan-f46-bahan-cerai.json. Tidak menyentuh basis data atau jaringan.
 * Pakai: node scripts/ukur-kartu-bukti.mjs [--tulis]   (--tulis menyimpan docs/arahan/awan-F46-cerai-ukur.md)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const akar = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const bahan = JSON.parse(readFileSync(resolve(akar, "docs/arahan/awan-f46-bahan-cerai.json"), "utf8"));

/** Keadaan dari tanda di nama berkas blangko. */
function keadaanDari(berkas) {
  if (/\[Kabul Verstek\]/i.test(berkas)) return "kabul verstek";
  if (/\[Tolak Verstek\]/i.test(berkas)) return "tolak verstek";
  if (/\[Kabul\]/i.test(berkas)) return /Tidak Hadir Setelah Mediasi/i.test(berkas) ? "kabul (lawan tidak hadir setelah mediasi)" : "kabul kontradiktoir";
  if (/\[Tolak\]/i.test(berkas)) return "tolak kontradiktoir";
  if (/\[Cabut\]/i.test(berkas)) return "dicabut";
  if (/\[NO\]/i.test(berkas)) return "tidak dapat diterima";
  return "lain";
}

/** Jenis bunyi pada satu alinea. Satu alinea boleh punya beberapa jenis. */
const JENIS = [
  ["ktp", /Kartu Tanda Penduduk|identitas dan domisili/i],
  ["nikah", /Kutipan Akta Nikah|suami istri (?:sah|dan belum|yang hingga)|terikat sebagai suami istri/i],
  ["surat umum: meterai", /meterai cukup/i],
  ["surat umum: dicocokkan dengan aslinya", /dicocokkan dengan aslinya/i],
  ["surat umum: akta otentik", /akta autentik|akta otentik/i],
  ["elektronik", /bukti elektronik|T\.3/i],
  ["saksi (di luar tugas ini)", /\bsaksi\b/i],
];

const baris = new Map(); // "cerai|keadaan" -> {blangko:Set, jenis:Map(jenis->Set(alinea))}
for (const b of bahan.blangko) {
  const cerai = b.folder.includes("CT") ? "CT" : "CG";
  const kunci = `${cerai}|${keadaanDari(b.berkas)}`;
  const e = baris.get(kunci) ?? { blangko: 0, jenis: new Map() };
  e.blangko += 1;
  for (const a of b.alineaBukti) {
    for (const [nama, re] of JENIS) {
      if (!re.test(a)) continue;
      const s = e.jenis.get(nama) ?? new Set();
      s.add(a);
      e.jenis.set(nama, s);
    }
  }
  baris.set(kunci, e);
}

const urut = [...baris.entries()].sort();
const sumber = urut.map(([k, e]) => ({ cerai: k.split("|")[0], keadaan: k.split("|")[1], blangko: e.blangko, jenis: Object.fromEntries([...e.jenis].map(([n, s]) => [n, s.size])) }));
const semuaJenis = JENIS.map(([n]) => n);

let md = "# Ukuran bahan blangko cerai (F46)\n\nDihitung oleh `scripts/ukur-kartu-bukti.mjs` dari `docs/arahan/awan-f46-bahan-cerai.json`. Angka sel = jumlah alinea berbeda yang memuat bunyi jenis itu; `-` = tidak ada bunyi.\n\n";
md += `Blangko dibaca: ${bahan.blangko.length}. Keadaan unik: ${sumber.length}.\n\n`;
md += `| Cerai | Keadaan | Blangko | ${semuaJenis.join(" | ")} |\n|${"---|".repeat(3 + semuaJenis.length)}\n`;
for (const s of sumber) md += `| ${s.cerai} | ${s.keadaan} | ${s.blangko} | ${semuaJenis.map((n) => s.jenis[n] ?? "-").join(" | ")} |\n`;
md += "\nCatatan: bukti surat selain KTP dan Kutipan Akta Nikah (KK, akta cerai, surat domisili, dan seterusnya) tidak punya bunyi sendiri di blangko mana pun. Bukti elektronik hanya muncul pada blangko kabul kontradiktoir dan tidak dicakup tahap ini.\n";

console.log(md);
if (process.argv.includes("--tulis")) writeFileSync(resolve(akar, "docs/arahan/awan-F46-cerai-ukur.md"), md);
