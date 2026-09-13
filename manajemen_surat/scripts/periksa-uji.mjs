#!/usr/bin/env node
/**
 * ============================================================================
 * PERIKSA UJI - RANGKAIAN PENUH YANG MEMBEDAKAN HABIS-WAKTU DARI GAGAL
 * ============================================================================
 *
 * Rangkaian uji repo ini 3.100 lebih, dan pada mesin pengembangan yang juga
 * memikul MariaDB, Postgres, dan bot, sebagian berkas HABIS WAKTU ketika tiga
 * utas berjalan berbarengan - arsip-cadangan (300 detik) yang paling sering.
 * Dijalankan sendirian, berkas yang sama lulus dalam hitungan detik.
 *
 * Membaca "3 gagal" lalu berhenti berarti dua kesalahan sekaligus: menahan
 * commit yang sebenarnya sehat, atau - lebih buruk - terbiasa mengabaikan
 * angka merah sampai kegagalan sungguhan ikut terlewat. Skrip ini yang
 * membedakannya, dengan cara yang sama persis seperti yang dikerjakan tangan
 * selama sesi September 2026:
 *
 *   1. jalankan rangkaian penuh, keluarannya ke berkas di D: (bukan C:);
 *   2. baca yang gagal; pisahkan yang habis waktu dari yang salah hasil;
 *   3. yang habis waktu dijalankan ulang SENDIRIAN;
 *   4. lulus hanya bila tidak ada yang salah hasil DAN ulangannya hijau.
 *
 * Yang salah hasil tidak pernah dijalankan ulang: uji yang gagal karena
 * hasilnya salah tidak akan benar dengan diberi kesempatan kedua, dan
 * mengulanginya hanya menyamarkan cacat sebagai kebetulan.
 *
 * Pemakaian:
 *   node scripts/periksa-uji.mjs                 rangkaian penuh + triase
 *   node scripts/periksa-uji.mjs --berkas a b    hanya berkas tertentu
 *   node scripts/periksa-uji.mjs --tanpa-ulang   triase saja, tanpa ulangan
 *
 * Keluaran ke D:/aleta-dev/kerja/hasil-vitest-<waktu>.txt - folder kerja yang
 * selamat dari pembersihan Temp (lihat memori bersihkan-temp-menghapus-scratchpad).
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const AKAR_PORTAL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FOLDER_KERJA = process.env.ALETA_FOLDER_KERJA || "D:/aleta-dev/kerja";
const UTAS_MAKS = Number(process.env.ALETA_UJI_UTAS) || 3;

/**
 * Lingkungan yang TIDAK menyentuh C: - aturan tetap sesi ini. Vitest dan npm
 * menulis cache dan berkas sementara; keduanya dialihkan ke D:.
 */
export function lingkunganUji() {
  return {
    ...process.env,
    TMP: process.env.ALETA_TMP || "D:/Aplikasi/aleta/tmp",
    TEMP: process.env.ALETA_TMP || "D:/Aplikasi/aleta/tmp",
    npm_config_cache: process.env.ALETA_NPM_CACHE || "D:/Aplikasi/aleta/cache/npm",
  };
}

/** Membuang kode warna ANSI dan bita NUL yang membuat grep mengira berkasnya biner. */
export function bersihkanKeluaran(teks) {
  return String(teks || "")
    .replace(/\u001b\[[0-9;]*m/g, "")
    .replace(/\u0000/g, "");
}

/**
 * Triase keluaran vitest --reporter=basic.
 *
 * Pulang { berkasGagal: [...jalur], habisWaktu: [...jalur], salahHasil: [...jalur],
 *          ringkas: "Test Files ... / Tests ...", kodeKeluar }.
 *
 * Tanda habis waktu yang dikenali - ketiganya pernah muncul sungguhan:
 *   "Test timed out in 300000ms"      uji yang lambat
 *   "Hook timed out in 120000ms"      beforeAll yang menunggu basis data
 *   'Timeout calling "fetch"'         pekerja vitest yang kehabisan napas
 */
export function triaseKeluaran(teks) {
  const bersih = bersihkanKeluaran(teks);
  const baris = bersih.split(/\r?\n/);

  // Berkas yang gagal: baris " FAIL  src/test/x.test.ts > ..." atau
  // " FAIL  src/test/x.test.ts [ src/test/x.test.ts ]".
  const berkasGagal = new Set();
  for (const b of baris) {
    const m = b.match(/^\s*FAIL\s+(\S+\.test\.[cm]?[jt]sx?)\b/);
    if (m) berkasGagal.add(m[1]);
  }

  // Sebab per berkas: dicari di baris sesudah "×" (nama uji) - panah "→"
  // menyebut sebabnya - dan di blok "FAIL ... \n Error: ...".
  const habisWaktu = new Set();
  const polaHabis = /timed out in \d+ms|Timeout calling|Hook timed out/i;
  let berkasAktif = "";
  for (const b of baris) {
    const m = b.match(/^\s*FAIL\s+(\S+\.test\.[cm]?[jt]sx?)\b/);
    if (m) berkasAktif = m[1];
    if (polaHabis.test(b) && berkasAktif) habisWaktu.add(berkasAktif);
  }
  // Kalau penanda FAIL per berkas tidak ada (reporter berbeda), setiap
  // berkas gagal yang seluruh sebabnya habis waktu ikut dihitung.
  if (habisWaktu.size === 0) {
    const semuaSebab = baris.filter((b) => /^\s*→/.test(b));
    if (semuaSebab.length > 0 && semuaSebab.every((b) => polaHabis.test(b))) {
      for (const f of berkasGagal) habisWaktu.add(f);
    }
  }

  const salahHasil = [...berkasGagal].filter((f) => !habisWaktu.has(f));
  const ringkas = baris.filter((b) => /^\s*(Test Files|Tests)\s/.test(b)).join(" | ");
  return {
    berkasGagal: [...berkasGagal],
    habisWaktu: [...habisWaktu],
    salahHasil,
    ringkas,
  };
}

function jalankanVitest(berkas, utas) {
  const argumen = ["vitest", "run", "--reporter=basic"];
  if (utas) argumen.push(`--poolOptions.threads.maxThreads=${utas}`);
  argumen.push(...berkas);
  const hasil = spawnSync("npx", argumen, {
    cwd: AKAR_PORTAL,
    env: lingkunganUji(),
    encoding: "utf8",
    shell: process.platform === "win32",
    maxBuffer: 64 * 1024 * 1024,
  });
  return { kode: hasil.status ?? 1, keluaran: `${hasil.stdout || ""}\n${hasil.stderr || ""}` };
}

function simpanLog(nama, isi) {
  fs.mkdirSync(FOLDER_KERJA, { recursive: true });
  const jalur = path.join(FOLDER_KERJA, nama);
  fs.writeFileSync(jalur, isi, "utf8");
  return jalur;
}

export async function utama(argv) {
  const tanpaUlang = argv.includes("--tanpa-ulang");
  const iBerkas = argv.indexOf("--berkas");
  const berkasDiminta = iBerkas >= 0 ? argv.slice(iBerkas + 1).filter((x) => !x.startsWith("--")) : [];
  const cap = new Date().toISOString().replace(/[:.]/g, "-");

  console.log(`periksa-uji: menjalankan ${berkasDiminta.length ? berkasDiminta.join(" ") : "rangkaian penuh"} (utas ${UTAS_MAKS})…`);
  const pertama = jalankanVitest(berkasDiminta, UTAS_MAKS);
  const logPertama = simpanLog(`hasil-vitest-${cap}.txt`, `${pertama.keluaran}\nkode keluar: ${pertama.kode}\n`);
  const triase = triaseKeluaran(pertama.keluaran);

  console.log(`  ${triase.ringkas || "(ringkasan tidak terbaca)"}`);
  console.log(`  log: ${logPertama}`);

  if (triase.berkasGagal.length === 0) {
    if (pertama.kode !== 0) {
      console.log("  vitest keluar bukan 0 tanpa berkas gagal yang terbaca - periksa lognya.");
      return 1;
    }
    console.log("HIJAU: tidak ada yang gagal.");
    return 0;
  }

  if (triase.salahHasil.length > 0) {
    console.log(`MERAH: ${triase.salahHasil.length} berkas SALAH HASIL - tidak diulang, sebab mengulang tidak membenarkannya:`);
    for (const f of triase.salahHasil) console.log(`  × ${f}`);
  }
  if (triase.habisWaktu.length > 0) {
    console.log(`  ${triase.habisWaktu.length} berkas HABIS WAKTU (bukan salah hasil):`);
    for (const f of triase.habisWaktu) console.log(`  ⏱ ${f}`);
  }

  if (triase.salahHasil.length > 0) return 1;
  if (tanpaUlang) {
    console.log("  --tanpa-ulang: yang habis waktu tidak dijalankan ulang; belum dapat disebut hijau.");
    return 2;
  }

  console.log(`  menjalankan ulang ${triase.habisWaktu.length} berkas itu SENDIRIAN…`);
  const kedua = jalankanVitest(triase.habisWaktu, 0);
  const logKedua = simpanLog(`hasil-vitest-${cap}-ulang.txt`, `${kedua.keluaran}\nkode keluar: ${kedua.kode}\n`);
  const triaseKedua = triaseKeluaran(kedua.keluaran);
  console.log(`  ${triaseKedua.ringkas || "(ringkasan tidak terbaca)"}`);
  console.log(`  log: ${logKedua}`);

  if (kedua.kode === 0 && triaseKedua.berkasGagal.length === 0) {
    console.log("HIJAU: yang habis waktu lulus ketika dijalankan sendirian - beban mesin, bukan cacat.");
    return 0;
  }
  console.log("MERAH: masih gagal walau dijalankan sendirian - ini cacat sungguhan, bukan beban mesin.");
  for (const f of triaseKedua.berkasGagal) console.log(`  × ${f}`);
  return 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  utama(process.argv.slice(2)).then((kode) => process.exit(kode));
}
