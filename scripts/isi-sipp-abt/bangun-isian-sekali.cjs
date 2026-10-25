#!/usr/bin/env node
"use strict";

/**
 * Membangun manajemen_surat/src/lib/isian-sekali-data.ts dari docs/isi-sipp-abt/DAFTAR-CEK.json dan BEBAN-MANUAL.json.
 *
 * "Isian sekali per perkara" (U11, rantai D butir D2): isian popup blangko Derry yang belum punya pengisi otomatis
 * (status "tidak" di daftar cek). Nilainya diketik petugas; ALETA mengingatnya per perkara supaya blangko lain
 * perkara itu tidak menuntut ketikan ulang. Tidak ada data perkara asli di sini: hanya kode, nama, dan hitungan.
 *
 *   node scripts/isi-sipp-abt/bangun-isian-sekali.cjs           menulis berkas
 *   node scripts/isi-sipp-abt/bangun-isian-sekali.cjs --periksa  gagal (kode 1) bila berkas yang ada berbeda
 */
const fs = require("fs");
const path = require("path");

const AKAR = path.resolve(__dirname, "..", "..");
const DAFTAR = path.join(AKAR, "docs", "isi-sipp-abt", "DAFTAR-CEK.json");
const BEBAN = path.join(AKAR, "docs", "isi-sipp-abt", "BEBAN-MANUAL.json");
const KELUAR = path.join(AKAR, "manajemen_surat", "src", "lib", "isian-sekali-data.ts");

function bangun() {
  const daftar = JSON.parse(fs.readFileSync(DAFTAR, "utf8"));
  const beban = JSON.parse(fs.readFileSync(BEBAN, "utf8"));
  const baris = [];
  for (const i of daftar.isian) {
    if (i.status !== "tidak" || !["teks", "tanggal"].includes(i.jenis)) continue;
    for (const kode of Array.isArray(i.kode) ? i.kode : [i.kode]) {
      const k = String(kode).padStart(4, "0");
      const sumber = String(i.sumberMungkin || "").replace(/\s+/g, " ").trim().slice(0, 120);
      baris.push({
        kode: k,
        nama: String(i.nama || "").replace(/\s+/g, " ").trim().slice(0, 160),
        jenis: i.jenis,
        keadaan: String(i.keadaan || ""),
        beban: Number((beban[k] && beban[k].perkara) || 0),
        blangko: Number(i.jumlahBlangko || 0),
        tanpaSumber: /^tidak ada/i.test(sumber) || /^penilaian/i.test(sumber),
        sumber,
      });
    }
  }
  baris.sort((a, b) => b.beban - a.beban || b.blangko - a.blangko || a.kode.localeCompare(b.kode));
  const isi = baris.map((b) => `  ${JSON.stringify(b)},`).join("\n");
  return `/**
 * DIBANGUN OTOMATIS oleh scripts/isi-sipp-abt/bangun-isian-sekali.cjs dari docs/isi-sipp-abt/DAFTAR-CEK.json (status "tidak")
 * dan BEBAN-MANUAL.json. JANGAN disunting tangan; jalankan ulang skripnya sesudah daftar cek diperbarui
 * (uji isian-sekali-25okt.test.ts menjaga kesamaannya).
 *
 * Isian popup blangko Derry yang belum punya pengisi otomatis (${baris.length} isian). \`beban\` = banyak perkara sejak 2023 yang isiannya
 * diketik petugas; \`blangko\` = banyak blangko yang memuatnya; \`tanpaSumber\` = memang tidak ada di data SIPP (penilaian hakim atau
 * tidak tercatat).
 */
export type IsianSekaliData = {
  kode: string;
  nama: string;
  jenis: "teks" | "tanggal";
  keadaan: string;
  beban: number;
  blangko: number;
  tanpaSumber: boolean;
  sumber: string;
};

export const ISIAN_SEKALI_DATA: readonly IsianSekaliData[] = [
${isi}
];
`;
}

const hasil = bangun();
if (process.argv.includes("--periksa")) {
  const ada = fs.existsSync(KELUAR) ? fs.readFileSync(KELUAR, "utf8") : "";
  if (ada.replace(/\r\n/g, "\n") !== hasil) {
    console.error("isian-sekali-data.ts tidak sama dengan DAFTAR-CEK.json; jalankan: node scripts/isi-sipp-abt/bangun-isian-sekali.cjs");
    process.exit(1);
  }
  console.log("isian-sekali-data.ts sesuai.");
} else {
  fs.writeFileSync(KELUAR, hasil, "utf8");
  console.log(`ditulis ${path.relative(AKAR, KELUAR)}`);
}
