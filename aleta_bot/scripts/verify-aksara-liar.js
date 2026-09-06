"use strict";

/**
 * ============================================================================
 * AKSARA KENDALI LIAR DI DALAM KODE SUMBER
 * ============================================================================
 *
 * Pada 7 September 2026 sebuah regex penjaga berhenti bekerja tanpa suara.
 * Bentuknya di layar tampak benar:
 *
 *     /...{0,400}?\bdb\s*\.\s*query\s*\(/g
 *
 * Tetapi `\b` di sana bukan dua aksara "tanda miring" dan "b". Ia SATU aksara
 * - backspace, 0x08 - dan regexnya karena itu mencari aksara backspace yang
 * diikuti "db". Tidak pernah ada. Penjaganya lulus tanpa memeriksa apa pun,
 * dan itu bentuk kegagalan yang paling mahal: penjaga yang mengaku bekerja.
 *
 * ============================================================================
 * DARI MANA ASALNYA
 * ============================================================================
 *
 * Dari penyuntingan lewat cangkang. Sebuah `\\b` yang ditulis di dalam naskah
 * penyunting menyusut menjadi `\b` ketika melewati cangkang, lalu penafsir
 * berikutnya membacanya sebagai aksara kendali. Sudah terjadi berkali-kali di
 * proyek ini - pada kunci PEM, pada jalur registry, dan sekarang pada regex.
 *
 * Aksara semacam itu TIDAK PERNAH ditulis sengaja di dalam kode sumber. Maka
 * kehadirannya selalu berarti ada tanda miring yang menyusut, dan penjaga ini
 * menemukannya sebelum ia sempat mendiamkan penjaga lain.
 *
 * Yang dicari: seluruh aksara kendali kecuali tab, baris baru, dan kembali
 * ke awal baris - ketiganya memang lazim di dalam berkas teks.
 */

const fs = require("fs");
const path = require("path");

let lulus = 0;
let gagal = 0;

function periksa(nama, benar, keterangan) {
  if (benar) {
    lulus += 1;
    console.log(`  OK    ${nama}`);
  } else {
    gagal += 1;
    console.log(`  GAGAL ${nama}${keterangan ? ` - ${keterangan}` : ""}`);
  }
}

const AKAR = path.resolve(__dirname, "..", "..");

const LEWATI_FOLDER = new Set([
  "node_modules",
  "vendor",
  ".git",
  ".next",
  "dist",
  "build",
  "coverage",
  "releases",
  "backup-before-bot-update-2026-05-11-0945",
  "backup-before-bot-update-2026-05-11-0954",
  ".tmp",
  "logs",
  "runtime-logs",
  ".runtime-logs",
  "reports",
  "data",
  "temp",
]);

// Berkas catatan (.md) sengaja TIDAK dipindai: keluaran terminal yang
// ditempelkan ke dalamnya memang membawa kode warna, dan tanda miring yang
// menyusut di dalam catatan tidak mendiamkan penjaga mana pun.
const AKHIRAN = new Set([".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx", ".json", ".yml", ".yaml", ".sh", ".sql"]);

/** Nama aksara, supaya laporannya dapat dipahami tanpa membuka tabel ASCII. */
const NAMA = {
  0: "NUL (dari \\0)",
  7: "BEL (dari \\a)",
  8: "BACKSPACE (dari \\b)",
  11: "VT (dari \\v)",
  12: "FF (dari \\f)",
  27: "ESC",
};

function namaAksara(kode) {
  return NAMA[kode] || `0x${kode.toString(16).padStart(2, "0")}`;
}

/** Kendali yang tidak pernah sengaja ditulis. Tab, LF, dan CR dikecualikan. */
function liar(kode) {
  if (kode === 9 || kode === 10 || kode === 13) return false;
  return kode < 32 || kode === 127;
}

/**
 * ============================================================================
 * YANG MEMANG DISENGAJA
 * ============================================================================
 *
 * Tiga berkas menulis aksara kendali dengan sadar dan benar. Menolaknya akan
 * membuat penjaga ini merah selamanya - dan penjaga yang merah selamanya sama
 * tidak bergunanya dengan penjaga yang tidak ada.
 *
 * Pengecualiannya menyebut BERKAS DAN KODE AKSARANYA, bukan berkasnya saja:
 * berkas yang dikecualikan seluruhnya akan menelan aksara liar berikutnya
 * yang masuk ke sana tanpa suara.
 */
const DIKECUALIKAN = new Map([
  [
    "manajemen_surat/scripts/diagnose-ai-network.js",
    { kode: new Set([27]), alasan: "kode warna ANSI untuk keluaran terminal - ESC memang ditulis harfiah" },
  ],
  [
    "manajemen_surat/src/test/berkas-gugatan.test.ts",
    { kode: new Set([0]), alasan: "bita nol di dalam berkas Word buatan untuk uji pembacaan" },
  ],
  [
    "aleta_bot/services/ecourtTextService.js",
    {
      kode: new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 11, 12, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 127]),
      alasan:
        "CONTROL_PATTERN - kelas aksara yang justru bertugas MEMBUANG aksara kendali dari teks e-Court. Ditulis harfiah sejak semula; menulisnya ulang dengan lambang lolos akan mengubah jangkauannya, dan itu perubahan perilaku yang tidak boleh menumpang perapian gaya.",
    },
  ],
  [
    "aleta_bot/services/sippReadOnlyBridgeService.js",
    { kode: new Set([0, 1, 2]), alasan: "contoh sampah medan yang ditulis harfiah di dalam keterangan, bukan di dalam kode yang berjalan" },
  ],
  [
    "manajemen_surat/src/test/crx.test.ts",
    { kode: new Set([3, 4]), alasan: "bita ajaib ZIP (PK\\x03\\x04) pada berkas pura-pura untuk uji" },
  ],
]);

/**
 * Berkas terpadatkan dan berkas pihak ketiga tidak dipindai. Isinya memang
 * bukan tulisan tangan siapa pun di sini, dan aksara kendali di dalamnya
 * bukan tanda ada tanda miring yang menyusut.
 */
const TERPADATKAN = /\.min\.(js|mjs|cjs)$/;

function kumpulkan(folder, hasil = []) {
  let isi;
  try {
    isi = fs.readdirSync(folder, { withFileTypes: true });
  } catch (_) {
    return hasil;
  }
  for (const butir of isi) {
    if (butir.isDirectory()) {
      if (LEWATI_FOLDER.has(butir.name)) continue;
      kumpulkan(path.join(folder, butir.name), hasil);
    } else if (AKHIRAN.has(path.extname(butir.name)) && !TERPADATKAN.test(butir.name)) {
      hasil.push(path.join(folder, butir.name));
    }
  }
  return hasil;
}

function periksaBerkas(jalur) {
  let teks;
  try {
    teks = fs.readFileSync(jalur, "utf8");
  } catch (_) {
    return [];
  }
  const relatif = path.relative(AKAR, jalur).split(path.sep).join("/");
  const kecuali = DIKECUALIKAN.get(relatif);
  const temuan = [];
  for (let i = 0; i < teks.length; i += 1) {
    const kode = teks.charCodeAt(i);
    if (!liar(kode)) continue;
    if (kecuali && kecuali.kode.has(kode)) continue;
    const baris = teks.slice(0, i).split(/\r?\n/).length;
    const sekitar = teks
      .slice(Math.max(0, i - 40), i + 20)
      .replace(/[\u0000-\u001f\u007f]/g, "?")
      .replace(/\s+/g, " ");
    temuan.push({ baris, kode, sekitar });
    if (temuan.length >= 5) break;
  }
  return temuan;
}

function utama() {
  console.log("");
  console.log("== Uji diri ==");
  periksa("backspace dikenali sebagai liar", liar(8));
  periksa("tab tidak dianggap liar", !liar(9));
  periksa("baris baru tidak dianggap liar", !liar(10));
  periksa("kembali ke awal baris tidak dianggap liar", !liar(13));
  periksa("huruf biasa tidak dianggap liar", !liar("a".charCodeAt(0)));
  periksa("namanya terbaca manusia", namaAksara(8).includes("BACKSPACE"));

  // Pengecualian harus menyebut kode aksaranya, bukan berkasnya saja.
  periksa(
    "setiap pengecualian menyebut kode aksara dan alasannya",
    [...DIKECUALIKAN.values()].every((x) => x.kode && x.kode.size > 0 && x.alasan && x.alasan.length > 20)
  );
  periksa(
    "berkas yang dikecualikan tetap ditolak untuk kode aksara lain",
    (() => {
      // Berkas contoh dikecualikan untuk ESC saja; backspace tetap harus liar.
      const kecuali = DIKECUALIKAN.get("manajemen_surat/scripts/diagnose-ai-network.js");
      return Boolean(kecuali) && kecuali.kode.has(27) && !kecuali.kode.has(8);
    })()
  );

  console.log("");
  console.log("== Seluruh berkas sumber ==");
  const berkas = kumpulkan(AKAR);
  periksa("ada berkas yang dipindai", berkas.length > 200, `dapat ${berkas.length}`);

  const kotor = [];
  berkas.forEach((jalur) => {
    const temuan = periksaBerkas(jalur);
    if (temuan.length) kotor.push({ jalur: path.relative(AKAR, jalur).split(path.sep).join("/"), temuan });
  });

  periksa(
    `${berkas.length} berkas sumber bebas aksara kendali liar`,
    kotor.length === 0,
    kotor.length ? `${kotor.length} berkas kotor` : ""
  );

  if (kotor.length) {
    console.log("");
    kotor.slice(0, 10).forEach((k) => {
      console.log(`  ${k.jalur}`);
      k.temuan.forEach((t) => console.log(`     baris ${t.baris}: ${namaAksara(t.kode)}  ...${t.sekitar}...`));
    });
    console.log("");
    console.log("  Aksara semacam itu tidak pernah ditulis sengaja. Hampir selalu ia lahir");
    console.log("  dari tanda miring ganda yang menyusut saat melewati cangkang. Perbaiki");
    console.log("  dengan penyunting berkas langsung, bukan lewat cangkang.");
  }

  console.log("");
  console.log(`Hasil: ${lulus} lulus, ${gagal} gagal`);
  process.exit(gagal > 0 ? 1 : 0);
}

utama();
