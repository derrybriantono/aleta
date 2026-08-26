#!/usr/bin/env node
// =============================================================================
// Verifikasi TANGGAL ACUAN untuk sumber data jalur lama, tanpa database.
//
//   node scripts/verify-legacy-reference-date.js
//
// Sumber data jalur lama (notifikasi.js) memuat 129 fungsi dengan 332 pemakaian
// CURDATE(). Alih-alih menulis ulang semuanya — yang berisiko menghilangkan
// fungsi yang sudah terbukti jalan — CURDATE() digantikan tepat saat query
// dieksekusi, di satu pintu db.query().
//
// Yang dijaga skrip ini, urut dari yang paling berbahaya bila salah:
//   1. ISOLASI. Tanggal acuan TIDAK BOLEH bocor ke operasi lain yang berjalan
//      bersamaan. Bila bocor, notifikasi terjadwal bisa mengirim jadwal tanggal
//      yang salah ke pihak berperkara sungguhan.
//   2. KEAMANAN. Tanggal disisipkan sebagai literal SQL, jadi nilai yang tidak
//      berformat tanggal wajib ditolak mentah-mentah.
//   3. KEUTUHAN. Di luar konteks, SQL harus lewat apa adanya.
// =============================================================================
const path = require("path");
const Module = require("module");

// Palsukan mysql agar db_config tidak menyentuh database sungguhan, tetapi
// pembungkus db.query yang asli tetap diuji.
const sqlTercatat = [];
const mysqlPath = require.resolve("mysql");
require.cache[mysqlPath] = {
  id: mysqlPath,
  filename: mysqlPath,
  loaded: true,
  exports: {
    createPool: () => ({
      query: (sqlOrOptions, ...rest) => {
        // Sejak pengaman batas waktu dipasang, driver menerima objek pilihan
        // ({ sql, timeout }) dan bukan lagi string telanjang. SQL-nya diambil
        // dari dalamnya supaya pemeriksaan tanggal acuan tetap menguji hal
        // yang sama seperti semula.
        const sql = typeof sqlOrOptions === "string" ? sqlOrOptions : String(sqlOrOptions && sqlOrOptions.sql);
        // Petunjuk batas waktu dibuang dari catatan agar perbandingan teks
        // hanya menyoal penulisan ulang tanggal, bukan pengaman yang menempel.
        sqlTercatat.push(sql.replace(/\/\*\+ MAX_EXECUTION_TIME\(\d+\) \*\/ /, ""));
        const cb = rest.find((r) => typeof r === "function");
        if (cb) cb(null, []);
      },
    }),
  },
};

const db = require(path.resolve(__dirname, "..", "db_config.js"));
const ctx = require(path.resolve(__dirname, "..", "services", "legacyDateContext.js"));

let gagal = 0;
function periksa(label, aktual, harapan) {
  const ok = String(aktual) === String(harapan);
  if (!ok) gagal += 1;
  console.log(`  ${ok ? "OK   " : "GAGAL"}  ${label.padEnd(56)} -> ${aktual}${ok ? "" : ` (harap ${harapan})`}`);
}

const SQL = "SELECT * FROM perkara_jadwal_sidang WHERE tanggal_sidang = CURDATE()";
const jalankan = (sql) => new Promise((resolve) => db.query(sql, () => resolve()));

(async () => {
  console.log("1. Di luar konteks: SQL lewat apa adanya");
  sqlTercatat.length = 0;
  await jalankan(SQL);
  periksa("CURDATE() tidak diubah", sqlTercatat[0], SQL);

  console.log("\n2. Di dalam konteks: CURDATE() digantikan tanggal acuan");
  sqlTercatat.length = 0;
  await ctx.runWithReferenceDate("2026-08-15", () => jalankan(SQL));
  periksa("memakai literal tanggal acuan", /DATE\('2026-08-15'\)/.test(sqlTercatat[0]), true);
  periksa("CURDATE() sudah hilang", /CURDATE/i.test(sqlTercatat[0]), false);

  console.log("\n3. Setelah konteks selesai: kembali normal");
  sqlTercatat.length = 0;
  await jalankan(SQL);
  periksa("tidak ada sisa tanggal acuan", sqlTercatat[0], SQL);

  console.log("\n4. ISOLASI - pratinjau bertanggal berjalan BERSAMAAN dengan scheduler");
  sqlTercatat.length = 0;
  const jejak = { pratinjau: "", scheduler: "" };
  await Promise.all([
    // Meniru pratinjau Kirim Manual dengan tanggal acuan.
    ctx.runWithReferenceDate("2026-08-15", async () => {
      await new Promise((r) => setTimeout(r, 20));
      await new Promise((resolve) =>
        db.query(SQL, () => {
          jejak.pratinjau = sqlTercatat[sqlTercatat.length - 1];
          resolve();
        })
      );
    }),
    // Meniru scheduler notifikasi yang jalan pada saat yang sama, TANPA konteks.
    (async () => {
      await new Promise((r) => setTimeout(r, 10));
      await new Promise((resolve) =>
        db.query(SQL, () => {
          jejak.scheduler = sqlTercatat[sqlTercatat.length - 1];
          resolve();
        })
      );
    })(),
  ]);
  periksa("pratinjau memakai tanggal acuan", /DATE\('2026-08-15'\)/.test(jejak.pratinjau), true);
  periksa("scheduler TIDAK terpengaruh", /CURDATE/i.test(jejak.scheduler), true);
  periksa("scheduler tidak kebocoran tanggal", /2026-08-15/.test(jejak.scheduler), false);

  console.log("\n5. Dua pratinjau bertanggal berbeda secara bersamaan");
  const dua = { a: "", b: "" };
  await Promise.all([
    ctx.runWithReferenceDate("2026-08-15", async () => {
      await new Promise((r) => setTimeout(r, 15));
      await new Promise((resolve) => db.query(SQL, () => { dua.a = sqlTercatat[sqlTercatat.length - 1]; resolve(); }));
    }),
    ctx.runWithReferenceDate("2027-01-02", async () => {
      await new Promise((r) => setTimeout(r, 5));
      await new Promise((resolve) => db.query(SQL, () => { dua.b = sqlTercatat[sqlTercatat.length - 1]; resolve(); }));
    }),
  ]);
  periksa("pratinjau A memakai tanggalnya sendiri", /DATE\('2026-08-15'\)/.test(dua.a), true);
  periksa("pratinjau B memakai tanggalnya sendiri", /DATE\('2027-01-02'\)/.test(dua.b), true);

  console.log("\n6. KEAMANAN - nilai tidak sah tidak boleh masuk SQL");
  for (const jahat of ["2026-08-15') OR 1=1 --", "2026-02-31", "15/08/2026", "'; DROP TABLE perkara; --"]) {
    sqlTercatat.length = 0;
    await ctx.runWithReferenceDate(jahat, () => jalankan(SQL));
    periksa(`ditolak: ${JSON.stringify(jahat).slice(0, 30)}`, sqlTercatat[0], SQL);
  }

  console.log(gagal === 0 ? "\nSEMUA PERIKSAAN LULUS" : `\n${gagal} PERIKSAAN GAGAL`);
  process.exit(gagal === 0 ? 0 : 1);
})();
