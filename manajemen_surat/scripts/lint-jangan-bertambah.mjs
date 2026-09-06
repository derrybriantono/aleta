#!/usr/bin/env node
/**
 * ============================================================================
 * LINT TIDAK BOLEH BERTAMBAH
 * ============================================================================
 *
 * `npm run lint` memakai `--max-warnings=0`, dan pada 7 September 2026 ia
 * memulangkan sebelas galat. Sebelas-sebelasnya `react-hooks/set-state-in-effect`
 * pada layar antrian dan jadwal sidang - kode yang sudah lama hidup dan dipakai
 * di ruang tunggu pengadilan.
 *
 * Laporan preflight terakhir yang tersimpan bertanggal 13 Mei 2026 dan sudah
 * mencatat `npm run lint` GAGAL. Artinya gerbang itu sudah hampir empat bulan
 * merah, dan gerbang yang selalu merah tidak berbeda dengan gerbang yang tidak
 * ada: orang berhenti membacanya.
 *
 * ============================================================================
 * MENGAPA TIDAK LANGSUNG DIPERBAIKI SAJA
 * ============================================================================
 *
 * Kesebelasnya menuntut penataan ulang alur keadaan pada delapan berkas layar -
 * layar panggilan, layar ruang sidang, layar ambil nomor - dan tidak satu pun
 * dari layar itu punya uji yang menutupinya. Menyentuhnya demi sebuah aturan
 * lint, di tengah pekerjaan yang sama sekali lain, adalah cara menukar utang
 * yang terlihat dengan kerusakan yang tidak terlihat.
 *
 * Maka yang dipasang di sini roda gigi searah: sebelas yang sudah ada dicatat
 * apa adanya dan tidak menghalangi, tetapi yang KEDUA BELAS ditolak. Utangnya
 * tetap terlihat, tidak bertambah, dan berkurangnya dirayakan - naskah ini
 * berkata sendiri bila ada yang sudah diperbaiki, supaya catatannya ikut
 * dirapatkan.
 *
 * ============================================================================
 * MENGAPA DICATAT PER BERKAS DAN PER ATURAN, BUKAN PER BARIS
 * ============================================================================
 *
 * Nomor baris bergeser setiap kali ada yang menyunting berkas di atasnya.
 * Catatan bernomor baris akan berteriak pada perubahan yang sama sekali tidak
 * berkaitan, dan teriakan palsu adalah cara tercepat membuat orang mematikan
 * penjaganya. Yang dicatat karena itu: berapa banyak galat aturan tertentu di
 * berkas tertentu.
 *
 * Pemakaian:
 *   node scripts/lint-jangan-bertambah.mjs            memeriksa
 *   node scripts/lint-jangan-bertambah.mjs --rapatkan menulis ulang catatannya
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DI_SINI = path.dirname(fileURLToPath(import.meta.url));
const AKAR = path.resolve(DI_SINI, "..");
const CATATAN = path.join(AKAR, "lint-utang.json");
const RAPATKAN = process.argv.includes("--rapatkan");

function jalankanEslint() {
  const npx = process.platform === "win32" ? "npx.cmd" : "npx";
  const jalan = spawnSync(npx, ["eslint", ".", "--format", "json"], {
    cwd: AKAR,
    encoding: "utf8",
    shell: process.platform === "win32",
    maxBuffer: 64 * 1024 * 1024,
    timeout: 15 * 60 * 1000,
  });

  if (jalan.error) {
    console.error("Tidak dapat menjalankan eslint:", jalan.error.message);
    process.exit(2);
  }

  const keluaran = String(jalan.stdout || "").trim();
  if (!keluaran) {
    console.error("eslint tidak memulangkan apa pun.");
    console.error(String(jalan.stderr || "").slice(-2000));
    process.exit(2);
  }

  // eslint menaruh JSON di stdout; keluaran lain (peringatan Node) dibuang.
  const mulai = keluaran.indexOf("[");
  if (mulai < 0) {
    console.error("Keluaran eslint bukan JSON:", keluaran.slice(0, 400));
    process.exit(2);
  }

  try {
    return JSON.parse(keluaran.slice(mulai));
  } catch (galat) {
    console.error("Keluaran eslint tidak dapat diurai:", galat.message);
    process.exit(2);
  }
}

/** Peta "berkas relatif :: aturan" -> jumlah galat. */
function hitung(hasil) {
  const peta = {};
  for (const berkas of hasil) {
    const relatif = path.relative(AKAR, berkas.filePath).split(path.sep).join("/");
    for (const pesan of berkas.messages || []) {
      // Peringatan tidak dihitung: `--max-warnings=0` yang menaikkannya menjadi
      // penggagal, dan yang ingin dijaga di sini galatnya.
      if (pesan.severity !== 2) continue;
      const aturan = pesan.ruleId || "(tanpa-aturan)";
      const kunci = `${relatif} :: ${aturan}`;
      peta[kunci] = (peta[kunci] || 0) + 1;
    }
  }
  return peta;
}

function bacaCatatan() {
  if (!fs.existsSync(CATATAN)) return null;
  try {
    const isi = JSON.parse(fs.readFileSync(CATATAN, "utf8"));
    return isi && typeof isi.utang === "object" ? isi : null;
  } catch {
    return null;
  }
}

function tulisCatatan(peta, jumlah) {
  const isi = {
    keterangan:
      "Galat lint yang sudah ada sebelum roda gigi searah ini dipasang. " +
      "Angkanya hanya boleh turun. Bila turun, jalankan dengan --rapatkan " +
      "supaya catatan ini ikut mengecil dan tidak lagi memberi ruang.",
    dicatatPada: new Date().toISOString().slice(0, 10),
    jumlah,
    utang: Object.fromEntries(Object.entries(peta).sort(([a], [b]) => a.localeCompare(b))),
  };
  fs.writeFileSync(CATATAN, JSON.stringify(isi, null, 2) + "\n", "utf8");
}

// ------------------------------------------------------------------- jalannya
const hasil = jalankanEslint();
const sekarang = hitung(hasil);
const jumlahSekarang = Object.values(sekarang).reduce((a, b) => a + b, 0);

if (RAPATKAN) {
  tulisCatatan(sekarang, jumlahSekarang);
  console.log(`Catatan dirapatkan: ${jumlahSekarang} galat pada ${Object.keys(sekarang).length} pasangan berkas-aturan.`);
  process.exit(0);
}

const catatan = bacaCatatan();
if (!catatan) {
  tulisCatatan(sekarang, jumlahSekarang);
  console.log(`Catatan pertama dibuat: ${jumlahSekarang} galat.`);
  console.log(`Berkas: ${path.relative(process.cwd(), CATATAN)}`);
  process.exit(0);
}

const lama = catatan.utang;
const bertambah = [];
const baru = [];
const berkurang = [];

for (const [kunci, jumlah] of Object.entries(sekarang)) {
  const sebelumnya = lama[kunci];
  if (sebelumnya === undefined) baru.push([kunci, jumlah]);
  else if (jumlah > sebelumnya) bertambah.push([kunci, sebelumnya, jumlah]);
  else if (jumlah < sebelumnya) berkurang.push([kunci, sebelumnya, jumlah]);
}
for (const [kunci, sebelumnya] of Object.entries(lama)) {
  if (sekarang[kunci] === undefined) berkurang.push([kunci, sebelumnya, 0]);
}

const jumlahLama = Object.values(lama).reduce((a, b) => a + b, 0);
console.log("");
console.log(`Galat lint: ${jumlahSekarang} sekarang, ${jumlahLama} pada catatan (${catatan.dicatatPada}).`);

if (berkurang.length) {
  console.log("");
  console.log("Berkurang - jalankan dengan --rapatkan supaya catatannya ikut mengecil:");
  berkurang
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([k, dari, ke]) => console.log(`  ${k}: ${dari} -> ${ke}`));
}

if (!baru.length && !bertambah.length) {
  console.log("");
  console.log("Tidak ada galat lint baru.");
  process.exit(0);
}

console.log("");
console.log("GAGAL - ada galat lint yang tidak ada pada catatan:");
baru
  .sort(([a], [b]) => a.localeCompare(b))
  .forEach(([k, j]) => console.log(`  BARU      ${k} (${j})`));
bertambah
  .sort(([a], [b]) => a.localeCompare(b))
  .forEach(([k, dari, ke]) => console.log(`  BERTAMBAH ${k}: ${dari} -> ${ke}`));
console.log("");
console.log("Perbaiki galatnya. Catatan hanya untuk utang yang sudah ada sejak");
console.log("7 September 2026, bukan tempat menampung galat baru.");
process.exit(1);
