// Menyusun untuk-sesi-utama/rujukan-k1.md dari selisih dasarHukum katalog versi 1 (katalog-v1) dan versi 2 (ekstensi-sipp/saksi-katalog).
// Pakai: node buat_rujukan.js
"use strict";
const fs = require("fs");
const path = require("path");
const akar = path.resolve(__dirname, "..", "..", "..");
const v1 = path.join(akar, "abt-paket", "w2a-kebendaan", "katalog-v1");
const v2 = path.join(akar, "ekstensi-sipp", "saksi-katalog");
const keluar = path.join(akar, "abt-paket", "w2a-kebendaan", "untuk-sesi-utama", "rujukan-k1.md");

const baca = (d, n) => JSON.parse(fs.readFileSync(path.join(d, n + ".json"), "utf8"));
const sel = (t) => String(t || "").replace(/\|/g, "/").replace(/\s+/g, " ").trim();
const baris = [];
baris.push("# Rujukan hukum BARU katalog saksi harta bersama dan kewarisan versi 2 (agen W2a-K1)");
baris.push("");
baris.push("Untuk disalin ke docs/gelombang2/PERIKSA-PASAL-W2a.md. Dibuat otomatis oleh `alat/buat_rujukan.js` dari selisih katalog versi 1 dan versi 2.");
baris.push("");
baris.push("Aturan: pasal/rujukan dianggap benar (keputusan pengguna) tetapi statusnya jujur. `terverifikasi` = bunyi sudah dicocokkan dengan naskah di referensi/KHI-pasal-terverifikasi.md ATAU dikutip pada pertimbangan blangko putusan Derry (bunyi naskah pasalnya belum ada di referensi: kolom sumber menyebutnya). `perlu-verifikasi` = TIDAK dicetak dan TIDAK muncul di teks pertanyaan atau jawaban mana pun (pemeriksa katalog menolaknya), hanya metadata.");
baris.push("Kolom 'tercetak/panel': semua rujukan hanya tampil di panel Susun saksi (butir dasar hukum yang berstatus terverifikasi); tidak ada nomor pasal pada kalimat jawaban saksi atau pertanyaan yang dicetak ke BAS.");
baris.push("");
for (const kunci of ["harta-bersama", "kewarisan"]) {
  const a = baca(v1, kunci);
  const b = baca(v2, kunci);
  const lama = new Set(a.dasarHukum.map((d) => d.id));
  const baru = b.dasarHukum.filter((d) => !lama.has(d.id));
  baris.push(`## ${kunci}`);
  baris.push("");
  baris.push("| id | rujukan | uraian (kutipan/ringkasan) | status | sumber | pokok yang memakainya | tercetak/panel |");
  baris.push("|---|---|---|---|---|---|---|");
  for (const d of baru) {
    const pokok = b.pokokPembuktian.filter((p) => (p.dasarHukum || []).includes(d.id)).map((p) => p.id).join(", ");
    baris.push(`| ${d.id} | ${sel(d.rujukan)} | ${sel(d.uraian)} | ${d.status} | ${sel(d.sumber).slice(0, 220)} | ${pokok} | ${d.status === "terverifikasi" ? "panel" : "tidak tampil (perlu-verifikasi)"} |`);
  }
  baris.push("");
  const tambahan = [];
  for (const p of b.pokokPembuktian) {
    const pLama = a.pokokPembuktian.find((x) => x.id === p.id);
    if (!pLama) continue;
    const tambah = (p.dasarHukum || []).filter((x) => !(pLama.dasarHukum || []).includes(x));
    if (tambah.length) tambahan.push(`- pokok \`${p.id}\` (lama) kini juga bersandar pada: ${tambah.join(", ")}`);
  }
  if (tambahan.length) {
    baris.push("Dasar hukum yang ditambahkan pada pokok versi 1 (melengkapi, tidak mengubah arti):");
    baris.push("");
    baris.push(...tambahan);
    baris.push("");
  }
}
baris.push("## Catatan sumber");
baris.push("");
baris.push("- Pasal 1 huruf f, Pasal 88, Pasal 95 KHI jo. Pasal 261 ayat (1) RBg: dikutip pada pertimbangan blangko putusan Derry `4a Harta Bersama` [01] (server, diambil 21 Okt 2026). Bunyi uraian di katalog mengikuti kutipan itu; naskah KHI Pasal 1, 88 dan 95 belum ada di referensi/KHI-pasal-terverifikasi.md, jadi perlu dicocokkan bila sesi utama ingin menaikkannya ke 'terverifikasi naskah'.");
baris.push("- Pasal 96 ayat (1), Pasal 100, Pasal 171 huruf e f h, Pasal 185 ayat (1) KHI: sudah dicocokkan dengan referensi/KHI-pasal-terverifikasi.md (VERIFIKASI-HUKUM 18 Okt 2026) dan dipakai agen U5 pada penetapan-ahli-waris.");
baris.push("- Pasal 94, Pasal 85 dan 86, Pasal 188, Pasal 211 KHI serta Pasal 29 UU 1/1974: BELUM ada naskah resmi berupa teks pada referensi; status perlu-verifikasi, tidak dicetak, tanpa kutipan bunyi (uraian hanya ringkasan maksud).");
baris.push("- Tidak ada nomor putusan atau SEMA yang dikarang.");
baris.push("");
fs.writeFileSync(keluar, baris.join("\n"));
console.log("ditulis", keluar, baris.length, "baris");
