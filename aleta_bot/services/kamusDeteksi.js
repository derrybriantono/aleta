"use strict";

/**
 * Kamus deteksi & rangkaian kata (kontrak bersama 10 Okt 2026 - lihat kamus-deteksi/README.md).
 *
 * Lapis 1: benih JSON di kamus-deteksi/awal/<kelompok>.json.
 * Lapis 2: baris database (diisi lewat aturLapisDatabase oleh pemuat tabel aleta_* - dipasang terpisah).
 * Baris database dengan kode sama menimpa benih; hanya status "aktif" (atau tanpa status) yang dipakai -
 * "draf" menunggu tinjauan, "nonaktif" dimatikan.
 */

const fs = require("fs");
const path = require("path");

const FOLDER_BENIH = path.join(__dirname, "..", "kamus-deteksi", "awal");

let benih = null; // { [kelompok]: { pola: [], templat: [] } }
let lapisDb = { pola: [], templat: [] }; // baris database, sudah dalam bentuk benih (+ kelompok)
let versiLapis = 0; // naik tiap lapis berubah: pemakai yang menyimpan hasil olahan (cache) memuat ulang hanya bila ini berubah

function bacaBenih() {
  if (benih) return benih;
  benih = {};
  let berkas = [];
  try {
    berkas = fs.readdirSync(FOLDER_BENIH).filter((n) => n.endsWith(".json"));
  } catch (_) {
    berkas = [];
  }
  for (const n of berkas) {
    const isi = JSON.parse(fs.readFileSync(path.join(FOLDER_BENIH, n), "utf8"));
    const kelompok = isi.kelompok || n.replace(/\.json$/, "");
    benih[kelompok] = { pola: isi.pola || [], templat: isi.templat || [] };
  }
  return benih;
}

function gabung(daftarBenih, daftarDb, kelompok) {
  const peta = new Map();
  for (const x of daftarBenih) peta.set(x.kode, { ...x, kelompok, asal: "benih" });
  for (const x of daftarDb) if (x.kelompok === kelompok) peta.set(x.kode, { ...x, asal: "database" });
  // Hanya yang AKTIF dipakai mendeteksi: "draf" = tersimpan untuk ditinjau (sama dengan lapis database, yang tidak
  // mengirim draf ke bot), "nonaktif" = dimatikan. Tanpa status dianggap aktif.
  return Array.from(peta.values()).filter((x) => (x.status || "aktif") === "aktif");
}

const cacheRegex = new Map();
function regexDari(p) {
  const k = `${p.regex}\u0000${p.flags || ""}`;
  if (!cacheRegex.has(k)) cacheRegex.set(k, new RegExp(p.regex, p.flags || ""));
  return cacheRegex.get(k);
}

/** Pola aktif satu kelompok (benih + database). Tiap butir punya .re (RegExp siap pakai). */
function polaKelompok(kelompok) {
  const b = bacaBenih()[kelompok] || { pola: [] };
  return gabung(b.pola, lapisDb.pola, kelompok).map((p) => ({ ...p, re: regexDari(p) }));
}

/** Templat aktif satu kelompok (benih + database). */
function templatKelompok(kelompok) {
  const b = bacaBenih()[kelompok] || { templat: [] };
  return gabung(b.templat, lapisDb.templat, kelompok);
}

/** Dipanggil pemuat tabel aleta_* (lapis database). */
function aturLapisDatabase({ pola = [], templat = [] } = {}) {
  lapisDb = { pola, templat };
  versiLapis++;
  cacheRegex.clear();
}

/** Untuk uji: lupakan benih yang sudah dibaca. */
function lupakan() {
  benih = null;
  lapisDb = { pola: [], templat: [] };
  versiLapis++;
  cacheRegex.clear();
}

/** Daftar kelompok benih yang ada. */
function daftarKelompok() {
  return Object.keys(bacaBenih());
}

/** Penanda versi lapis (benih + database) untuk cache pemakai. */
function versi() {
  return versiLapis;
}

module.exports = { versi, polaKelompok, templatKelompok, aturLapisDatabase, daftarKelompok, lupakan, FOLDER_BENIH };
