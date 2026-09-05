"use strict";

/**
 * Memeriksa kolom SIPP mana yang ada dan mana yang tidak.
 *
 * ============================================================================
 * UNTUK APA
 * ============================================================================
 *
 * Sebagian unsur SK Penilaian SIPP menilai KETEPATAN WAKTU penginputan - berapa
 * hari setelah suatu peristiwa datanya masuk ke SIPP. Kolom tanggal input itu
 * namanya berbeda antar versi SIPP, sehingga ALETA mencarinya lebih dulu dari
 * daftar calon alih-alih menebak.
 *
 * Skrip ini memperlihatkan hasil pencarian itu: mana yang ketemu, mana yang
 * tidak, dan pada tabel apa harus dicari. Yang belum ketemu berarti unsur SK
 * itu belum dapat dinilai - dan nama kolom sebenarnya perlu ditambahkan ke
 * daftar calon di services/sippSkemaService.js.
 *
 * ============================================================================
 * MENJALANKAN
 * ============================================================================
 *
 *   docker exec aleta-bot node scripts/sipp-periksa-kolom.js
 *
 * Tambahkan --semua untuk melihat seluruh nama kolom tiap tabel - berguna saat
 * mencari nama sebenarnya dari kolom yang belum ketemu.
 *
 *   docker exec aleta-bot node scripts/sipp-periksa-kolom.js --semua
 *
 * SIPP hanya dibaca. Skrip ini tidak menulis apa pun.
 */

const db = require("../db_config");
const sippSkemaService = require("../services/sippSkemaService");

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (error, rows) => {
      if (error) reject(error);
      else resolve(Array.isArray(rows) ? rows : []);
    });
  });
}

function garis() {
  console.log("-".repeat(78));
}

async function utama() {
  const semua = process.argv.includes("--semua");

  console.log("");
  console.log("Pemeriksaan kolom SIPP untuk penilaian SK 048/2024");
  garis();

  const laporan = await sippSkemaService.laporan();

  console.log("");
  console.log("TABEL");
  garis();
  for (const [nama, jumlah] of Object.entries(laporan.tabel)) {
    console.log(`  ${jumlah > 0 ? "ada  " : "TIDAK"}  ${nama}${jumlah > 0 ? ` (${jumlah} kolom)` : ""}`);
  }

  console.log("");
  console.log("KETERANGAN YANG DICARI");
  garis();
  for (const baris of laporan.keterangan) {
    if (baris.ketemu) {
      console.log(`  ada    ${baris.keterangan.padEnd(24)} ${baris.tabel}.${baris.kolom}`);
    }
  }

  console.log("");
  console.log("BELUM KETEMU - unsur SK ini belum dapat dinilai");
  garis();
  const belum = laporan.keterangan.filter((x) => !x.ketemu);
  if (belum.length === 0) {
    console.log("  (tidak ada - seluruh kolom yang diperlukan ditemukan)");
  }
  for (const baris of belum) {
    console.log(`  ${baris.keterangan}`);
    console.log(`    tabel  : ${baris.tabel}${baris.tabelAda ? "" : "  <- TABELNYA SENDIRI TIDAK ADA"}`);
    console.log(`    dicoba : ${baris.calon.join(", ")}`);
  }

  if (semua) {
    console.log("");
    console.log("SELURUH KOLOM TIAP TABEL");
    garis();
    for (const tabel of sippSkemaService.TABEL) {
      const rows = await runQuery(
        `SELECT COLUMN_NAME AS kolom
           FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
          ORDER BY ORDINAL_POSITION`,
        [tabel]
      );
      if (rows.length === 0) continue;
      console.log("");
      console.log(`  ${tabel}`);
      console.log(`    ${rows.map((r) => r.kolom).join(", ")}`);
    }
  }

  console.log("");
  garis();
  console.log(`  Ketemu ${laporan.ketemu}, belum ketemu ${laporan.belumKetemu}.`);
  if (laporan.belumKetemu > 0) {
    console.log("");
    console.log("  Bila nama kolom sebenarnya sudah diketahui, tambahkan ke daftar calon");
    console.log("  pada services/sippSkemaService.js, lalu nyalakan ulang bot.");
    console.log("");
    console.log("  Menjalankan dengan --semua memperlihatkan seluruh nama kolom tiap tabel.");
  }
  console.log("");

  return 0;
}

utama()
  .then((kode) => process.exit(kode))
  .catch((error) => {
    console.error("");
    console.error(`GAGAL: ${error && error.stack ? error.stack : error}`);
    console.error("");
    process.exit(1);
  });
