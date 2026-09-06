"use strict";

/**
 * ============================================================================
 * PELARI SELURUH PENJAGA SISI BOT
 * ============================================================================
 *
 * Ada 67 naskah `verify-*.js` di folder ini dan sampai 7 September 2026 tidak
 * ada satu pun cara menjalankannya sekaligus. Satu-satunya jalan adalah
 * mengetik `node scripts/verify-x.js` enam puluh tujuh kali - yang berarti
 * pada praktiknya tidak pernah dijalankan seluruhnya, dan penjaga yang tidak
 * dijalankan sama saja dengan penjaga yang tidak ada.
 *
 * ============================================================================
 * KONTRAKNYA KODE KELUAR, BUKAN KELUARANNYA
 * ============================================================================
 *
 * Teks ringkasan ketujuh puluh naskah itu TIDAK seragam: 43 mencetak
 * "Lulus: X, Gagal: Y", 6 mencetak "OK - N pemeriksaan lulus", sisanya
 * berbeda-beda. Membaca keluarannya berarti membuat pelari yang rapuh
 * terhadap kalimat. Yang seragam hanya satu hal - `process.exit(0)` bila
 * lulus - dan itulah yang dipakai di sini.
 *
 * ============================================================================
 * TIAP NASKAH BERPROSES SENDIRI
 * ============================================================================
 *
 * Tiga puluh di antaranya membajak pemuat modul: mereka mengganti
 * `require.cache[...]` milik db_config dengan penadah supaya dapat berjalan
 * tanpa basis data. Menjalankan dua naskah semacam itu di dalam satu proses
 * akan membuat yang kedua mewarisi penadah yang pertama, dan hasilnya bukan
 * gagal melainkan LULUS PALSU. Karena itu tiap naskah dijalankan sebagai
 * proses tersendiri, dan itu tidak dapat ditawar demi kecepatan.
 *
 * ============================================================================
 * YANG SENGAJA TIDAK IKUT
 * ============================================================================
 *
 * Folder ini juga memuat naskah pembantu yang BUKAN penjaga. Satu di antaranya
 * - audit-sipp-tabel-aleta.js - menunggu masukan dari papan ketik dan bersifat
 * merusak. Menjalankannya di dalam pelari akan menggantung selamanya atau,
 * lebih buruk, mengubah sesuatu. Saringan `verify-*.js` sudah mengeluarkannya,
 * tetapi daftar tolak di bawah tetap ada supaya penamaan yang kelak berbeda
 * tidak menyeretnya masuk.
 *
 * Pemakaian:
 *   node scripts/jalankan-semua-verify.js
 *   node scripts/jalankan-semua-verify.js --hanya sipp
 *   node scripts/jalankan-semua-verify.js --batas 300
 *   node scripts/jalankan-semua-verify.js --diam
 */

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const FOLDER = __dirname;
const AKAR_BOT = path.resolve(FOLDER, "..");

/**
 * Naskah yang tidak boleh dijalankan pelari, apa pun namanya kelak.
 * Alasannya ditulis supaya tidak ada yang membuangnya karena mengira ini
 * kehati-hatian yang berlebihan.
 */
const JANGAN_JALANKAN = new Map([
  ["audit-sipp-tabel-aleta.js", "menunggu masukan papan ketik dan bersifat merusak"],
  ["health-check.js", "menembak layanan hidup, bukan penjaga"],
  ["smoke-test.js", "menembak layanan hidup, bukan penjaga"],
  ["check-sipp-document.js", "menuntut berkas SIPP sungguhan di server"],
  ["kendali-berkas-sinkron.js", "menulis, bukan memeriksa"],
  ["sipp-periksa-kolom.js", "menuntut sambungan SIPP hidup"],
  ["diagnose-employee-query.js", "alat penelusuran, bukan penjaga"],
]);

/**
 * Naskah yang menuntut basis data hidup. Di mesin pengembang ia akan gagal
 * bukan karena ada yang salah, melainkan karena basis datanya memang tidak
 * ada. Dilaporkan tersendiri sebagai "terlewat", bukan sebagai "gagal" -
 * mencampurnya akan membuat pelari ini merah setiap hari sampai orang
 * berhenti membacanya.
 */
const BUTUH_BASIS_DATA = new Set(["verify-blocked-account-guard.js"]);

function tafsirkanPilihan(argv) {
  const p = { hanya: null, batasMs: 120000, diam: false, laporan: true };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--hanya") p.hanya = String(argv[++i] || "").toLowerCase();
    else if (a === "--batas") p.batasMs = Math.max(1000, Number(argv[++i]) * 1000 || 120000);
    else if (a === "--diam") p.diam = true;
    else if (a === "--tanpa-laporan") p.laporan = false;
  }
  return p;
}

const pilihan = tafsirkanPilihan(process.argv.slice(2));

// Dua awalan, dua peran. `verify-*` menjaga satu hal tertentu; `uji-sapuan-*`
// menyapu SELURUH penilaian sekaligus. Keduanya sama-sama gerbang, jadi
// keduanya dijalankan - penyapu yang tidak ikut gerbang tidak akan pernah
// dijalankan orang, persis seperti keadaan ke-67 penjaga sebelum ada pelari.
const semua = fs
  .readdirSync(FOLDER)
  .filter((f) => /^(verify|uji-sapuan)-.*\.js$/.test(f))
  .filter((f) => !JANGAN_JALANKAN.has(f))
  .filter((f) => (pilihan.hanya ? f.toLowerCase().includes(pilihan.hanya) : true))
  .sort();

if (!semua.length) {
  console.error("Tidak ada naskah yang cocok.");
  process.exit(2);
}

const ditolak = fs
  .readdirSync(FOLDER)
  .filter((f) => JANGAN_JALANKAN.has(f))
  .sort();

console.log("");
console.log(`Menjalankan ${semua.length} penjaga dan penyapu, masing-masing sebagai proses tersendiri.`);
console.log(`Batas waktu tiap naskah: ${Math.round(pilihan.batasMs / 1000)} detik.`);
if (ditolak.length) {
  console.log(`Tidak diikutkan (${ditolak.length}): ${ditolak.join(", ")}`);
}
console.log("");

const mulai = Date.now();
const hasil = [];
let lulus = 0;
let gagal = 0;
let terlewat = 0;

for (const berkas of semua) {
  const t0 = Date.now();
  const jalan = spawnSync(process.execPath, [path.join(FOLDER, berkas)], {
    cwd: AKAR_BOT,
    encoding: "utf8",
    timeout: pilihan.batasMs,
    // stdin ditutup: naskah yang keliru menunggu masukan akan segera berakhir
    // alih-alih menggantung sampai batas waktu.
    stdio: ["ignore", "pipe", "pipe"],
    env: process.env,
    maxBuffer: 32 * 1024 * 1024,
  });
  const lama = Date.now() - t0;
  const kehabisanWaktu = Boolean(jalan.error && jalan.error.code === "ETIMEDOUT");
  const kode = jalan.status;
  const butuhDb = BUTUH_BASIS_DATA.has(berkas);

  let keadaan;
  if (!jalan.error && kode === 0) keadaan = "LULUS";
  else if (butuhDb) keadaan = "TERLEWAT";
  else keadaan = "GAGAL";

  if (keadaan === "LULUS") lulus += 1;
  else if (keadaan === "TERLEWAT") terlewat += 1;
  else gagal += 1;

  const ekorKeluar = String(jalan.stdout || "")
    .split(/\r?\n/)
    .filter(Boolean)
    .slice(-12)
    .join("\n");
  const ekorGalat = String(jalan.stderr || "")
    .split(/\r?\n/)
    .filter(Boolean)
    .slice(-12)
    .join("\n");

  hasil.push({
    berkas,
    keadaan,
    kodeKeluar: kode,
    kehabisanWaktu,
    lamaMs: lama,
    ekorKeluar,
    ekorGalat: ekorGalat || (jalan.error ? jalan.error.message : ""),
  });

  const tanda = keadaan === "LULUS" ? "OK   " : keadaan === "TERLEWAT" ? "LEWAT" : "GAGAL";
  const detik = (lama / 1000).toFixed(1);
  console.log(`  ${tanda} ${berkas.padEnd(44)} ${detik.padStart(6)}s`);

  if (keadaan === "GAGAL" && !pilihan.diam) {
    const sebab = kehabisanWaktu
      ? `kehabisan waktu sesudah ${Math.round(pilihan.batasMs / 1000)} detik`
      : `kode keluar ${kode}`;
    console.log(`        sebab: ${sebab}`);
    (ekorGalat || ekorKeluar)
      .split("\n")
      .slice(-8)
      .forEach((b) => console.log(`        | ${b}`));
  }
}

const lamaTotal = Date.now() - mulai;

console.log("");
console.log(`Selesai dalam ${(lamaTotal / 1000).toFixed(1)} detik.`);
console.log(`  lulus    : ${lulus}`);
console.log(`  gagal    : ${gagal}`);
console.log(`  terlewat : ${terlewat}${terlewat ? " (menuntut basis data hidup)" : ""}`);

if (terlewat) {
  console.log("");
  console.log("Yang terlewat bukan lulus. Di server, jalankan dengan basis data hidup:");
  hasil
    .filter((h) => h.keadaan === "TERLEWAT")
    .forEach((h) => console.log(`  docker compose exec aleta_bot node scripts/${h.berkas}`));
}

if (pilihan.laporan) {
  try {
    const folderLaporan = path.resolve(AKAR_BOT, "reports");
    fs.mkdirSync(folderLaporan, { recursive: true });
    const jalur = path.join(folderLaporan, "penjaga-bot-terakhir.json");
    fs.writeFileSync(
      jalur,
      JSON.stringify(
        {
          dijalankanPada: new Date().toISOString(),
          lamaMs: lamaTotal,
          jumlah: { lulus, gagal, terlewat, seluruhnya: semua.length },
          tidakDiikutkan: Object.fromEntries(ditolak.map((f) => [f, JANGAN_JALANKAN.get(f)])),
          hasil,
        },
        null,
        2
      ) + "\n",
      "utf8"
    );
    console.log("");
    console.log(`Laporan: ${path.relative(AKAR_BOT, jalur)}`);
  } catch (galat) {
    console.log(`(laporan tidak dapat ditulis: ${galat.message})`);
  }
}

console.log("");
process.exit(gagal > 0 ? 1 : 0);
