#!/usr/bin/env node
"use strict";

/**
 * Membuktikan pembungkus db.query TIDAK mengubah perilaku query yang ada.
 *
 *   node scripts/verify-db-wrapper.js
 *
 * Ini pemeriksaan paling penting dari Tahap 1-2. Seluruh query jalur lama
 * (137 SELECT di query.js, 129 fungsi di notifikasi.js, verifikasi perkara,
 * dan daftar perkara) memakai satu pembungkus yang sama. Kalau pembungkusnya
 * keliru menangani salah satu bentuk pemanggilan, yang rusak bukan satu fitur
 * melainkan seluruh layanan data perkara.
 *
 * Kolam mysql diganti tiruan supaya pengujian tidak menyentuh SIPP.
 */

const mysqlPath = require.resolve("mysql");
require("mysql");

const panggilan = [];
const kolamTiruan = {
  query(...args) {
    const callback = typeof args[args.length - 1] === "function" ? args[args.length - 1] : null;
    panggilan.push({ args, punyaCallback: Boolean(callback) });

    if (!callback) return { stream: true };

    const skenario = kolamTiruan._skenario;
    setTimeout(() => {
      if (skenario && skenario.error) callback(skenario.error, undefined, undefined);
      else callback(null, skenario ? skenario.result : [{ ok: 1 }], [{ name: "kolom" }]);
    }, skenario && skenario.delayMs ? skenario.delayMs : 0);
    return { stream: false };
  },
  _skenario: null,
};

require.cache[mysqlPath].exports = {
  createPool() {
    return kolamTiruan;
  },
};

const db = require("../db_config");
const queryMetrics = require("../services/queryMetricsService");
const { runWithReferenceDate } = require("../services/legacyDateContext");

let lulus = 0;
let gagal = 0;

function periksa(label, kondisi) {
  if (kondisi) {
    lulus += 1;
    console.log(`  OK    ${label}`);
  } else {
    gagal += 1;
    console.log(`  GAGAL ${label}`);
  }
}

function bersihkan() {
  panggilan.length = 0;
  kolamTiruan._skenario = null;
  queryMetrics.reset();
}

/** SQL yang benar-benar diterima driver pada pemanggilan terakhir. */
function sqlTerakhir() {
  const terakhir = panggilan[panggilan.length - 1];
  if (!terakhir) return "";
  const pertama = terakhir.args[0];
  return typeof pertama === "string" ? pertama : String(pertama.sql || "");
}

function opsiTerakhir() {
  const terakhir = panggilan[panggilan.length - 1];
  return terakhir && typeof terakhir.args[0] === "object" ? terakhir.args[0] : null;
}

function jalankan(...args) {
  return new Promise((resolve) => {
    db.query(...args, (error, result, fields) => resolve({ error, result, fields }));
  });
}

async function utama() {
  console.log("\n== Bentuk pemanggilan db.query(sql, callback) ==");
  {
    bersihkan();
    const hasil = await jalankan("SELECT nomor_perkara FROM perkara");
    periksa("callback dipanggil", hasil.error === null);
    periksa("hasil diteruskan apa adanya", Array.isArray(hasil.result) && hasil.result[0].ok === 1);
    periksa("kolom (fields) ikut diteruskan", Array.isArray(hasil.fields) && hasil.fields[0].name === "kolom");
    periksa("driver menerima objek pilihan", opsiTerakhir() !== null);
    periksa("batas waktu klien terpasang", opsiTerakhir().timeout > 0);
    periksa("SQL asli tetap utuh", sqlTerakhir().includes("FROM perkara"));
  }

  console.log("\n== Bentuk pemanggilan db.query(sql, params, callback) ==");
  {
    bersihkan();
    const hasil = await jalankan("SELECT a FROM b WHERE id = ? AND x = ?", [7, "abc"]);
    periksa("callback dipanggil", hasil.error === null);
    const terakhir = panggilan[panggilan.length - 1];
    periksa("parameter diteruskan pada posisi kedua", Array.isArray(terakhir.args[1]));
    periksa("nilai parameter tidak berubah", terakhir.args[1][0] === 7 && terakhir.args[1][1] === "abc");
    periksa("urutan parameter tidak bergeser", terakhir.args.length === 3);
  }

  console.log("\n== Galat diteruskan apa adanya ==");
  {
    bersihkan();
    kolamTiruan._skenario = { error: Object.assign(new Error("ER_NO_SUCH_TABLE"), { code: "ER_NO_SUCH_TABLE" }) };
    const hasil = await jalankan("SELECT a FROM tabel_hilang");
    periksa("galat sampai ke pemanggil", Boolean(hasil.error));
    periksa("kode galat tidak diubah", hasil.error.code === "ER_NO_SUCH_TABLE");
    periksa("galat tetap tercatat di metrik", queryMetrics.getSnapshot().totalErrors === 1);
  }

  console.log("\n== Pemanggilan tanpa callback (aliran) diteruskan ==");
  {
    bersihkan();
    const kembalian = db.query("SELECT a FROM b");
    periksa("tidak melempar galat", true);
    periksa("kembalian driver diteruskan", kembalian && kembalian.stream === true);
    periksa("tetap sampai ke driver", panggilan.length === 1);
  }

  console.log("\n== Tanggal acuan tetap bekerja seperti sebelumnya ==");
  {
    bersihkan();
    await runWithReferenceDate("2026-03-15", async () => {
      await jalankan("SELECT a FROM sidang WHERE tanggal = CURDATE()");
    });
    periksa("CURDATE() ditulis ulang", !sqlTerakhir().includes("CURDATE()"));
    periksa("tanggal acuan tersisip", sqlTerakhir().includes("2026-03-15"));
    periksa("batas waktu tetap terpasang bersamaan", sqlTerakhir().includes("MAX_EXECUTION_TIME"));
  }

  console.log("\n== Di luar tanggal acuan, CURDATE() dibiarkan ==");
  {
    bersihkan();
    await jalankan("SELECT a FROM sidang WHERE tanggal = CURDATE()");
    periksa("CURDATE() tidak diutak-atik", sqlTerakhir().includes("CURDATE()"));
  }

  console.log("\n== Batas waktu sisi server hanya untuk SELECT ==");
  {
    bersihkan();
    await jalankan("SELECT a FROM b");
    periksa("SELECT mendapat batas server", sqlTerakhir().includes("MAX_EXECUTION_TIME"));

    bersihkan();
    await jalankan("UPDATE antrian SET status = ? WHERE id = ?", ["hadir", 1]);
    periksa("UPDATE tidak disisipi", !sqlTerakhir().includes("MAX_EXECUTION_TIME"));
    periksa("UPDATE tetap mendapat batas klien", opsiTerakhir().timeout > 0);

    bersihkan();
    await jalankan("INSERT INTO antrian (a) VALUES (?)", [1]);
    periksa("INSERT tidak disisipi", !sqlTerakhir().includes("MAX_EXECUTION_TIME"));
  }

  console.log("\n== Durasi setiap query tercatat ==");
  {
    bersihkan();
    kolamTiruan._skenario = { delayMs: 60, result: [{ a: 1 }, { a: 2 }] };
    await jalankan("SELECT a FROM perkara");
    const ringkasan = queryMetrics.getSnapshot();
    periksa("satu query tercatat", ringkasan.totalQueries === 1);
    periksa(`durasi terukur wajar (${ringkasan.avgMs} ms)`, ringkasan.avgMs >= 50);
    periksa("tabel dikenali pada label", ringkasan.byTotalTime[0].label === "SELECT perkara");
    periksa("jumlah baris tercatat", ringkasan.byTotalTime[0].avgRows === 2);
  }

  console.log("\n== Query yang sama dengan nilai berbeda dihitung menyatu ==");
  {
    bersihkan();
    await jalankan("SELECT a FROM pihak WHERE id = ?", [1]);
    await jalankan("SELECT a FROM pihak WHERE id = ?", [2]);
    await jalankan("SELECT a FROM pihak WHERE id = ?", [3]);
    const ringkasan = queryMetrics.getSnapshot();
    periksa("tiga pemanggilan tercatat", ringkasan.totalQueries === 3);
    periksa("terhitung sebagai satu sidik query", ringkasan.trackedFingerprints === 1);
    periksa("jumlah pemanggilan benar", ringkasan.byTotalTime[0].count === 3);
  }

  console.log(`\nLulus: ${lulus}, Gagal: ${gagal}`);
  if (gagal > 0) {
    console.log("ADA PERIKSAAN YANG GAGAL.");
    process.exit(1);
  }
  console.log("SEMUA PERIKSAAN LULUS.");
  process.exit(0);
}

utama().catch((error) => {
  console.error("Gagal menjalankan pengujian:", error);
  process.exit(1);
});
