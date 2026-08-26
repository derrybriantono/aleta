"use strict";

// =============================================================================
// Membuat SELURUH sumber data jalur lama (notifikasi.js) fleksibel terhadap
// tanggal, TANPA menulis ulang satu pun SQL-nya.
//
// Latar: notifikasi.js memuat 129 fungsi dengan 332 pemakaian CURDATE(), semua
// dieksekusi lewat satu pintu db.query(). Menulis ulang semuanya menjadi query
// dinamis berisiko besar menghilangkan fungsi yang sudah terbukti jalan
// bertahun-tahun. Alih-alih itu, CURDATE() digantikan tanggal acuan tepat pada
// saat query dieksekusi.
//
// Mengapa AsyncLocalStorage, bukan variabel global: pratinjau pegawai kini
// menjalankan query SIPP secara PARALEL, dan scheduler notifikasi berjalan di
// proses yang sama. Variabel global akan bocor antar operasi bersamaan sehingga
// notifikasi terjadwal bisa memakai tanggal milik pratinjau orang lain.
// =============================================================================
const { AsyncLocalStorage } = require("async_hooks");

const storage = new AsyncLocalStorage();

/**
 * Terima HANYA tanggal berformat YYYY-MM-DD yang benar-benar ada di kalender.
 * Ketat karena nilainya disisipkan sebagai literal SQL: apa pun di luar pola ini
 * ditolak, sehingga tidak ada teks dari luar yang bisa masuk ke query.
 */
function normalizeReferenceDate(value) {
  const teks = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(teks)) return "";
  const [tahun, bulan, hari] = teks.split("-").map(Number);
  const tanggal = new Date(Date.UTC(tahun, bulan - 1, hari));
  if (
    tanggal.getUTCFullYear() !== tahun ||
    tanggal.getUTCMonth() !== bulan - 1 ||
    tanggal.getUTCDate() !== hari
  ) {
    return ""; // mis. 2026-02-31
  }
  return teks;
}

/** Jalankan fn dengan tanggal acuan aktif hanya untuk lingkup asinkron itu. */
function runWithReferenceDate(referenceDate, fn) {
  const tanggal = normalizeReferenceDate(referenceDate);
  if (!tanggal) return fn();
  return storage.run({ referenceDate: tanggal }, fn);
}

/** Tanggal acuan yang berlaku pada lingkup saat ini, "" bila tidak ada. */
function getReferenceDate() {
  const konteks = storage.getStore();
  return konteks && konteks.referenceDate ? konteks.referenceDate : "";
}

/**
 * Gantikan CURDATE()/CURRENT_DATE dengan literal tanggal acuan.
 * Query relatif seperti DATE_ADD(CURDATE(), INTERVAL 3 DAY) otomatis ikut
 * bergeser, jadi pengingat H-3 tetap bermakna H-3 dari tanggal pilihan.
 */
function rewriteCurrentDate(sql, referenceDate) {
  const tanggal = normalizeReferenceDate(referenceDate);
  if (!tanggal || typeof sql !== "string") return { sql, changed: 0 };

  let changed = 0;
  const hasil = sql.replace(/\bCURDATE\s*\(\s*\)|\bCURRENT_DATE\b(?:\s*\(\s*\))?/gi, () => {
    changed += 1;
    return `DATE('${tanggal}')`;
  });
  return { sql: hasil, changed };
}

module.exports = {
  normalizeReferenceDate,
  runWithReferenceDate,
  getReferenceDate,
  rewriteCurrentDate,
};
