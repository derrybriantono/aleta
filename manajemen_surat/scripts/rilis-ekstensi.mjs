#!/usr/bin/env node
/**
 * ============================================================================
 * RILIS EKSTENSI - TUJUH LANGKAH YANG SELAMA INI DIKETIK TANGAN
 * ============================================================================
 *
 * Tiap rilis ekstensi menempuh urutan yang sama, dan sepanjang sesi September
 * 2026 urutan itu diketik belasan kali - dengan tiga kekeliruan yang sungguh
 * terjadi, masing-masing sekali cukup untuk menyesatkan:
 *
 *   - menanam ulang sesudah suntingan terakhir TERLEWAT, sehingga yang
 *     tertanam di portal bukan yang ada di folder;
 *   - ALETA_TANAM_PAKSA terlupa ketika isinya berubah tetapi versinya belum
 *     dinaikkan, dan skrip tanam berhenti dengan pesan yang tidak terbaca di
 *     tengah rangkaian perintah panjang;
 *   - kode keluar tsc dibaca dari `tsc | tail -3; echo $?` - dan $? itu milik
 *     tail. Beberapa laporan "tsc bersih" tidak membuktikan apa pun.
 *
 * Skrip ini menempuh urutannya SATU PER SATU dan berhenti pada langkah
 * pertama yang merah, dengan kode keluar yang dibaca langsung dari prosesnya.
 *
 *   1. manifest.json  - versi terbaca, dan berbeda dari yang sudah tertanam
 *   2. catatan        - entri teratas catatan-ekstensi.ts = versi manifest
 *                       (uji repo menuntutnya; catatan yang tertinggal adalah
 *                       catatan yang berbohong tentang apa yang berjalan)
 *   3. tanam          - susun-ekstensi.mjs; bila isinya berubah tanpa versi
 *                       naik, skrip itu sendiri yang menolak - di sini TIDAK
 *                       dipaksa diam-diam
 *   4. salin          - ke folder yang dimuat Chrome (bukan repo!), lihat
 *                       memori chrome-memuat-ekstensi-dari-folder-unduhan
 *   5. tsc            - kode keluar dibaca langsung
 *   6. uji            - periksa-uji.mjs (penuh), kecuali --tanpa-uji
 *   7. ringkasan      - beserta pengingat: Reload di chrome://extensions dan
 *                       catatan pemasangan peladen
 *
 * Yang TIDAK dikerjakan skrip ini: commit. Pesan commit ditulis orang -
 * ia menjelaskan sebab, dan sebab tidak dapat disusun dari diff.
 *
 * Pemakaian:
 *   node scripts/rilis-ekstensi.mjs              rilis penuh
 *   node scripts/rilis-ekstensi.mjs --periksa    langkah 1-2 saja, tanpa menulis
 *   node scripts/rilis-ekstensi.mjs --tanpa-uji  lewati rangkaian penuh (JANGAN
 *                                                dipakai sebelum commit)
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { lingkunganUji, utama as periksaUji } from "./periksa-uji.mjs";

const AKAR_PORTAL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const AKAR_REPO = path.resolve(AKAR_PORTAL, "..");
const FOLDER_EKSTENSI = path.join(AKAR_REPO, "ekstensi-sipp");
const BERKAS_TERTANAM = path.join(AKAR_PORTAL, "src/server/shared/ekstensi-berkas.ts");
const BERKAS_CATATAN = path.join(AKAR_PORTAL, "src/lib/catatan-ekstensi.ts");
/** Folder yang dimuat Chrome sebagai ekstensi unpacked - BUKAN folder repo. */
const FOLDER_CHROME = process.env.ALETA_FOLDER_CHROME || "D:/Download File/ekstensi-sipp";

export function bacaVersiManifest(isiManifest) {
  const manifest = JSON.parse(String(isiManifest || "{}"));
  return String(manifest.version || "").trim();
}

export function bacaVersiTertanam(isiTertanam) {
  const m = String(isiTertanam || "").match(/EKSTENSI_VERSI = "([^"]*)"/);
  return m ? m[1] : "";
}

/** Versi pada entri TERATAS catatan-ekstensi.ts - yang dianggap "sedang berjalan". */
export function bacaVersiCatatanTeratas(isiCatatan) {
  const m = String(isiCatatan || "").match(/CATATAN_EKSTENSI[^=]*=\s*\[\s*\{\s*versi:\s*"([^"]+)"/);
  return m ? m[1] : "";
}

/**
 * Pemeriksaan versi - dipisah supaya dapat diuji tanpa menyentuh berkas.
 * Pulang { ok, pesan[] }.
 */
export function periksaVersi({ manifest, tertanam, catatan }) {
  const pesan = [];
  if (!manifest) pesan.push("manifest.json tidak punya version.");
  if (manifest && catatan && manifest !== catatan) {
    pesan.push(
      `Entri teratas catatan-ekstensi.ts adalah ${catatan}, manifest ${manifest}. ` +
        "Tambahkan entri catatan untuk versi ini - uji repo menuntut keduanya sama."
    );
  }
  if (manifest && !catatan) pesan.push("catatan-ekstensi.ts tidak terbaca entri teratasnya.");
  return { ok: pesan.length === 0, pesan, samaDenganTertanam: Boolean(manifest) && manifest === tertanam };
}

function jalankan(perintah, argumen, opsi = {}) {
  const hasil = spawnSync(perintah, argumen, {
    cwd: opsi.cwd || AKAR_PORTAL,
    env: lingkunganUji(),
    encoding: "utf8",
    shell: process.platform === "win32",
    maxBuffer: 64 * 1024 * 1024,
  });
  return { kode: hasil.status ?? 1, keluaran: `${hasil.stdout || ""}${hasil.stderr || ""}` };
}

function salinFolder(dari, ke) {
  fs.mkdirSync(ke, { recursive: true });
  let jumlah = 0;
  for (const entri of fs.readdirSync(dari, { withFileTypes: true })) {
    const s = path.join(dari, entri.name);
    const t = path.join(ke, entri.name);
    if (entri.isDirectory()) {
      jumlah += salinFolder(s, t);
    } else {
      fs.copyFileSync(s, t);
      jumlah += 1;
    }
  }
  return jumlah;
}

function langkah(nomor, judul) {
  console.log(`\n[${nomor}/7] ${judul}`);
}

export async function utama(argv) {
  const hanyaPeriksa = argv.includes("--periksa");
  const tanpaUji = argv.includes("--tanpa-uji");

  langkah(1, "membaca versi");
  const manifest = bacaVersiManifest(fs.readFileSync(path.join(FOLDER_EKSTENSI, "manifest.json"), "utf8"));
  const tertanam = fs.existsSync(BERKAS_TERTANAM) ? bacaVersiTertanam(fs.readFileSync(BERKAS_TERTANAM, "utf8")) : "";
  const catatan = bacaVersiCatatanTeratas(fs.readFileSync(BERKAS_CATATAN, "utf8"));
  console.log(`  manifest ${manifest || "?"} | tertanam ${tertanam || "-"} | catatan teratas ${catatan || "?"}`);

  langkah(2, "memeriksa keselarasan versi dan catatan");
  const periksa = periksaVersi({ manifest, tertanam, catatan });
  if (!periksa.ok) {
    for (const p of periksa.pesan) console.log(`  ✗ ${p}`);
    return 1;
  }
  console.log(periksa.samaDenganTertanam
    ? "  ✓ selaras; versi sama dengan yang tertanam - tanam ulang hanya bila isinya berubah"
    : "  ✓ selaras; versi baru, akan ditanam");
  if (hanyaPeriksa) {
    console.log("\n--periksa: berhenti di sini, tidak ada yang ditulis.");
    return 0;
  }

  langkah(3, "menanam ekstensi ke portal (susun-ekstensi.mjs)");
  const tanam = jalankan("node", ["scripts/susun-ekstensi.mjs"]);
  console.log(tanam.keluaran.trim().split(/\r?\n/).map((b) => `  ${b}`).join("\n"));
  if (tanam.kode !== 0) {
    console.log("  ✗ penanaman ditolak. Kalau pesannya menyebut versi belum dinaikkan, NAIKKAN versinya -");
    console.log("    jangan memaksa dengan ALETA_TANAM_PAKSA kecuali isinya memang tidak berubah.");
    return 1;
  }

  langkah(4, `menyalin ke folder Chrome: ${FOLDER_CHROME}`);
  const jumlah = salinFolder(FOLDER_EKSTENSI, FOLDER_CHROME);
  const versiSalinan = bacaVersiManifest(fs.readFileSync(path.join(FOLDER_CHROME, "manifest.json"), "utf8"));
  if (versiSalinan !== manifest) {
    console.log(`  ✗ salinan bermanifest ${versiSalinan}, seharusnya ${manifest}`);
    return 1;
  }
  console.log(`  ✓ ${jumlah} berkas; manifest salinan ${versiSalinan}`);

  langkah(5, "tsc --noEmit (kode keluar dibaca langsung)");
  const tsc = jalankan("npx", ["tsc", "--noEmit", "-p", "tsconfig.json"]);
  if (tsc.kode !== 0) {
    const baris = tsc.keluaran.trim().split(/\r?\n/);
    console.log(baris.slice(-12).map((b) => `  ${b}`).join("\n"));
    if (baris.some((b) => b.includes(".next/"))) {
      console.log("  ! galatnya di .next/ (berkas bikinan Next.js). Bila terpotong/rusak: hapus .next/dev/types lalu ulangi.");
    }
    console.log(`  ✗ tsc kode keluar ${tsc.kode}`);
    return 1;
  }
  console.log("  ✓ tsc bersih (kode keluar 0)");

  langkah(6, tanpaUji ? "uji DILEWATI (--tanpa-uji)" : "rangkaian uji penuh lewat periksa-uji.mjs");
  if (!tanpaUji) {
    const kodeUji = await periksaUji([]);
    if (kodeUji !== 0) {
      console.log("  ✗ rangkaian uji belum hijau - JANGAN commit.");
      return 1;
    }
  } else {
    console.log("  ! tanpa uji penuh, rilis ini belum layak di-commit. Jalankan periksa-uji.mjs sebelum commit.");
  }

  langkah(7, "ringkasan");
  console.log(`  Ekstensi ${manifest} tertanam dan tersalin ke ${FOLDER_CHROME}.`);
  console.log("  Berikutnya, oleh orang:");
  console.log("    - tekan Reload di chrome://extensions (ekstensi unpacked tidak memperbarui dirinya);");
  console.log("    - tulis pesan commit berbahasa Indonesia yang menjelaskan SEBAB, akhiri dengan");
  console.log("      Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>;");
  console.log("    - akhiri jawaban ke pengguna dengan catatan pengingat pemasangan peladen");
  console.log("      (memori tugas-server-ekstensi-1-123) selama peladen belum terpasang.");
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  utama(process.argv.slice(2)).then((kode) => process.exit(kode));
}
