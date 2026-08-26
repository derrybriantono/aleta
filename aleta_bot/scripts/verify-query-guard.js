#!/usr/bin/env node
"use strict";

/**
 * Membuktikan batas waktu query dan pengukuran durasinya bekerja, DAN yang
 * paling penting: tidak merusak satu pun query yang selama ini sudah berjalan.
 *
 *   node scripts/verify-query-guard.js
 *
 * 137 SELECT di query.js dan 129 fungsi notifikasi lewat pembungkus yang sama.
 * Kalau pembungkusnya salah, yang rusak bukan satu fitur melainkan seluruh
 * layanan data perkara sekaligus. Karena itu pemeriksaan di sini lebih banyak
 * menyoal "apa yang TIDAK boleh berubah" daripada fitur barunya.
 */

const queryGuard = require("../services/queryGuardService");
const queryMetrics = require("../services/queryMetricsService");

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

const konfigUji = {
  enabled: true,
  timeoutMs: 15000,
  clientTimeoutMs: 17000,
  serverEnforced: true,
  connectionLimit: 10,
};

console.log("\n== Batas waktu sisi server disisipkan pada SELECT ==");
{
  const hasil = queryGuard.withServerTimeout("SELECT nomor_perkara FROM perkara WHERE id = ?", 15000);
  periksa("petunjuk MAX_EXECUTION_TIME dipasang", hasil.includes("MAX_EXECUTION_TIME(15000)"));
  periksa("dipasang tepat setelah SELECT", /^SELECT \/\*\+ MAX_EXECUTION_TIME\(15000\) \*\/ nomor_perkara/.test(hasil));
  periksa("isi query tidak berubah", hasil.includes("FROM perkara WHERE id = ?"));

  const distinct = queryGuard.withServerTimeout("SELECT DISTINCT a FROM b", 9000);
  periksa("SELECT DISTINCT tetap sah", /^SELECT \/\*\+ MAX_EXECUTION_TIME\(9000\) \*\/ DISTINCT a FROM b$/.test(distinct));

  const berindentasi = queryGuard.withServerTimeout("\n  SELECT x FROM y", 5000);
  periksa("SELECT berindentasi tetap dikenali", berindentasi.includes("MAX_EXECUTION_TIME(5000)"));
}

console.log("\n== Yang TIDAK boleh disisipi ==");
{
  const ganda = queryGuard.withServerTimeout("SELECT 1; SELECT 2", 15000);
  periksa("pernyataan majemuk dilewati", !ganda.includes("MAX_EXECUTION_TIME"));

  const update = queryGuard.withServerTimeout("UPDATE perkara SET a = 1", 15000);
  periksa("UPDATE dilewati", !update.includes("MAX_EXECUTION_TIME"));

  const insert = queryGuard.withServerTimeout("INSERT INTO antrian (a) VALUES (?)", 15000);
  periksa("INSERT dilewati", !insert.includes("MAX_EXECUTION_TIME"));

  const sudahAda = queryGuard.withServerTimeout("SELECT /*+ MAX_EXECUTION_TIME(500) */ a FROM b", 15000);
  periksa("batas yang sudah ditulis sendiri tidak diganggu", sudahAda.includes("MAX_EXECUTION_TIME(500)"));
  periksa("tidak dipasang dua kali", (sudahAda.match(/MAX_EXECUTION_TIME/g) || []).length === 1);

  periksa("SELECT dengan titik koma di akhir tetap tunggal", queryGuard.isSingleSelect("SELECT a FROM b;") === true);
  periksa("dua pernyataan dikenali majemuk", queryGuard.isSingleSelect("SELECT a FROM b; SELECT c FROM d") === false);
}

console.log("\n== Argumen driver dibentuk dengan benar ==");
{
  const dariString = queryGuard.applyQueryGuard("SELECT a FROM b", konfigUji);
  periksa("string SQL menjadi objek pilihan", typeof dariString.options === "object");
  periksa("batas waktu klien terpasang", dariString.options.timeout === 17000);
  periksa("batas klien lebih longgar daripada batas server", konfigUji.clientTimeoutMs > konfigUji.timeoutMs);
  periksa("SQL yang dibawa sudah bertanda batas server", dariString.options.sql.includes("MAX_EXECUTION_TIME"));

  const dariObjek = queryGuard.applyQueryGuard({ sql: "SELECT a FROM b", timeout: 3000 }, konfigUji);
  periksa("batas waktu dari pemanggil tidak ditimpa", dariObjek.options.timeout === 3000);

  const dimatikan = queryGuard.applyQueryGuard("SELECT a FROM b", { ...konfigUji, enabled: false });
  periksa("pengaman dimatikan -> SQL diteruskan apa adanya", dimatikan.options === "SELECT a FROM b");
  periksa("pengaman dimatikan -> ditandai tidak dipasang", dimatikan.applied === false);

  const tanpaHint = queryGuard.applyQueryGuard("SELECT a FROM b", { ...konfigUji, serverEnforced: false });
  periksa("batas server dimatikan -> tanpa petunjuk", !tanpaHint.options.sql.includes("MAX_EXECUTION_TIME"));
  periksa("batas server dimatikan -> batas klien tetap ada", tanpaHint.options.timeout === 17000);

  const kosong = queryGuard.applyQueryGuard("", konfigUji);
  periksa("SQL kosong tidak diutak-atik", kosong.applied === false);
}

console.log("\n== Batas waktu dijaga tetap masuk akal ==");
{
  const terlaluKecil = queryGuard.getGuardConfig({ queryGuard: { timeoutMs: 5 } });
  periksa(`batas terlalu kecil dinaikkan (${terlaluKecil.timeoutMs} ms)`, terlaluKecil.timeoutMs >= 1000);

  const terlaluBesar = queryGuard.getGuardConfig({ queryGuard: { timeoutMs: 999999 } });
  periksa(`batas terlalu besar diturunkan (${terlaluBesar.timeoutMs} ms)`, terlaluBesar.timeoutMs <= 120000);

  const tidakValid = queryGuard.getGuardConfig({ queryGuard: { timeoutMs: "bukan angka" } });
  periksa("nilai tidak valid jatuh ke bawaan", tidakValid.timeoutMs === queryGuard.DEFAULT_QUERY_TIMEOUT_MS);

  const batasSambungan = queryGuard.getGuardConfig({ queryGuard: { connectionLimit: 999 } });
  periksa(`batas sambungan dijaga wajar (${batasSambungan.connectionLimit})`, batasSambungan.connectionLimit <= 50);
}

console.log("\n== Pesan batas waktu dapat dibaca orang awam ==");
{
  const pesan = queryGuard.describeTimeoutError({ code: "PROTOCOL_SEQUENCE_TIMEOUT" }, konfigUji);
  periksa("menyebut lamanya menunggu", pesan.includes("15 detik"));
  periksa("menjelaskan alasan dihentikan", pesan.includes("membebani"));
  periksa("memberi arahan lanjutan", pesan.includes("coba lagi"));
  periksa("tidak berisi jargon SQL", !/MAX_EXECUTION_TIME|SELECT/.test(pesan));
}

console.log("\n== Pengenalan galat batas waktu ==");
{
  periksa("kode driver dikenali", queryMetrics.isTimeoutError({ code: "PROTOCOL_SEQUENCE_TIMEOUT" }));
  periksa("ETIMEDOUT dikenali", queryMetrics.isTimeoutError({ code: "ETIMEDOUT" }));
  periksa("galat batas server dikenali", queryMetrics.isTimeoutError({ message: "Query execution was interrupted, maximum statement execution time exceeded" }));
  periksa("galat biasa bukan batas waktu", queryMetrics.isTimeoutError({ code: "ER_PARSE_ERROR", message: "syntax" }) === false);
  periksa("tanpa galat bukan batas waktu", queryMetrics.isTimeoutError(null) === false);
}

console.log("\n== Sidik query menyatukan query yang sama ==");
{
  const a = queryMetrics.fingerprintSql("SELECT * FROM perkara WHERE nomor_perkara = '531/Pdt.G/2026/PA.Dgl'");
  const b = queryMetrics.fingerprintSql("SELECT * FROM perkara WHERE nomor_perkara = '219/Pdt.P/2026/PA.Dgl'");
  periksa("nomor perkara berbeda tetap satu sidik", a.key === b.key);
  periksa("label menyebut tabelnya", a.label === "SELECT perkara");

  const c = queryMetrics.fingerprintSql("SELECT * FROM sidang WHERE id = 1");
  periksa("tabel berbeda menghasilkan sidik berbeda", a.key !== c.key);

  const d = queryMetrics.fingerprintSql("SELECT   *   FROM   perkara   WHERE nomor_perkara = '1'");
  periksa("beda spasi tetap satu sidik", a.key === d.key);
}

console.log("\n== Pencatatan durasi ==");
{
  queryMetrics.reset();
  queryMetrics.record({ sql: "SELECT a FROM perkara WHERE id = 1", durationMs: 100, result: [{}, {}] });
  queryMetrics.record({ sql: "SELECT a FROM perkara WHERE id = 2", durationMs: 300, result: [{}] });
  queryMetrics.record({ sql: "SELECT b FROM sidang", durationMs: 50, result: [] });

  const ringkasan = queryMetrics.getSnapshot();
  periksa("tiga query tercatat", ringkasan.totalQueries === 3);
  periksa("dua sidik berbeda", ringkasan.trackedFingerprints === 2);
  periksa(`rata-rata dihitung (${ringkasan.avgMs} ms)`, ringkasan.avgMs === 150);

  const teratas = ringkasan.byTotalTime[0];
  periksa("diurutkan menurut total waktu", teratas.label === "SELECT perkara");
  periksa("jumlah pemanggilan benar", teratas.count === 2);
  periksa("durasi tertinggi tercatat", teratas.maxMs === 300);
  periksa("rata-rata baris tercatat", teratas.avgRows === 2);
}

console.log("\n== Query ringan yang sering dipanggil tetap terlihat ==");
{
  queryMetrics.reset();
  // Satu query berat sekali jalan, satu query ringan seribu kali.
  queryMetrics.record({ sql: "SELECT x FROM laporan_besar", durationMs: 4000, result: [] });
  for (let i = 0; i < 1000; i += 1) {
    queryMetrics.record({ sql: `SELECT y FROM pihak WHERE id = ${i}`, durationMs: 20, result: [{}] });
  }
  const ringkasan = queryMetrics.getSnapshot();
  periksa(
    "yang paling membebani adalah query ringan yang sering (bukan yang paling lambat)",
    ringkasan.byTotalTime[0].label === "SELECT pihak"
  );
  periksa("query paling lambat tetap terdaftar tersendiri", ringkasan.slowest[0].label === "SELECT laporan_besar");
}

console.log("\n== Galat dan batas waktu ikut terhitung ==");
{
  queryMetrics.reset();
  queryMetrics.record({ sql: "SELECT a FROM b", durationMs: 20000, error: { code: "PROTOCOL_SEQUENCE_TIMEOUT", message: "timeout" } });
  queryMetrics.record({ sql: "SELECT a FROM b", durationMs: 10, error: { code: "ER_PARSE_ERROR", message: "syntax" } });
  const ringkasan = queryMetrics.getSnapshot();
  periksa("dua galat tercatat", ringkasan.totalErrors === 2);
  periksa("satu di antaranya batas waktu", ringkasan.totalTimeouts === 1);
  periksa("query melewati ambang lambat tercatat", ringkasan.totalSlow === 1);
}

console.log("\n== Pencatatan tidak pernah menjatuhkan query ==");
{
  let lolos = true;
  try {
    queryMetrics.record({ sql: null, durationMs: NaN, result: undefined, error: undefined });
    queryMetrics.record(undefined);
    queryMetrics.record({ sql: {}, durationMs: "bukan angka" });
  } catch {
    lolos = false;
  }
  periksa("masukan rusak tidak melempar galat", lolos);
}

console.log(`\nLulus: ${lulus}, Gagal: ${gagal}`);
if (gagal > 0) {
  console.log("ADA PERIKSAAN YANG GAGAL.");
  process.exit(1);
}
console.log("SEMUA PERIKSAAN LULUS.");
process.exit(0);
