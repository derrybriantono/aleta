"use strict";

/**
 * Lebar kolom yang diindeks tidak boleh melewati batas MySQL.
 *
 * ============================================================================
 * BATASNYA PER KOLOM, BUKAN PER INDEKS
 * ============================================================================
 *
 * InnoDB dengan row format COMPACT membatasi tiap KOLOM yang masuk indeks pada
 * 767 byte. Pada utf8mb4 satu huruf memakan empat byte, sehingga:
 *
 *   VARCHAR(191) = 764 byte  -> muat
 *   VARCHAR(255) = 1020 byte -> DITOLAK
 *
 * Inilah sebab seluruh tabel ALETA memakai VARCHAR(191) untuk kolom yang
 * diindeks - angka 191 bukan pilihan sembarang.
 *
 * Kolom VARCHAR(255) boleh saja ada; yang tidak boleh adalah memasukkannya ke
 * dalam kunci utama, kunci unik, atau indeks.
 *
 * ============================================================================
 * KENAPA PERLU DIPERIKSA OTOMATIS
 * ============================================================================
 *
 * Kegagalannya muncul saat ensureSchema berjalan di server - bukan saat kode
 * ditulis, dan bukan pada mesin pengembang yang MySQL-nya lebih baru. Satu
 * tabel yang gagal dibuat membuat SELURUH layar yang memakai layanan itu
 * menampilkan ER_TOO_LONG_KEY, dan itu sudah terjadi sekali.
 */

const fs = require("fs");
const pathx = require("path");

/** Batas byte satu kolom yang diindeks pada InnoDB row format COMPACT. */
const BATAS_BYTE = 767;

/** utf8mb4: satu huruf paling banyak empat byte. */
const BYTE_PER_HURUF = 4;

let lulus = 0;
let gagal = 0;

function periksa(nama, benar) {
  if (benar) {
    lulus += 1;
    console.log(`  OK    ${nama}`);
  } else {
    gagal += 1;
    console.log(`  GAGAL ${nama}`);
  }
}

/** Lebar byte satu kolom menurut deklarasinya. */
function lebarKolom(deklarasi) {
  const varchar = deklarasi.match(/\bVARCHAR\((\d+)\)/i);
  if (varchar) return Number(varchar[1]) * BYTE_PER_HURUF;

  const char = deklarasi.match(/(?:^|[^R])\bCHAR\((\d+)\)/i);
  if (char) return Number(char[1]) * BYTE_PER_HURUF;

  if (/\bDATETIME\b/i.test(deklarasi)) return 5;
  if (/\bTIMESTAMP\b/i.test(deklarasi)) return 4;
  if (/\bDATE\b/i.test(deklarasi)) return 3;
  if (/\bBIGINT\b/i.test(deklarasi)) return 8;
  if (/\bSMALLINT\b/i.test(deklarasi)) return 2;
  if (/\bTINYINT\b/i.test(deklarasi)) return 1;
  if (/\bINT\b/i.test(deklarasi)) return 4;
  if (/\bDECIMAL\b/i.test(deklarasi)) return 8;
  // TEXT tidak dapat diindeks tanpa panjang awalan - selalu ditolak.
  if (/\b(TEXT|BLOB|LONGTEXT)\b/i.test(deklarasi)) return BATAS_BYTE + 1;
  return null;
}

/** Membaca seluruh CREATE TABLE dari satu berkas layanan. */
function bacaTabel(jalur) {
  const isi = fs.readFileSync(jalur, "utf8").replace(/\r/g, "");
  return [...isi.matchAll(/CREATE TABLE IF NOT EXISTS (\w+) \(([\s\S]*?)\n\s*\) ENGINE/g)].map(
    ([, nama, badan]) => ({ nama, badan })
  );
}

/** Kolom-kolom yang masuk indeks pada satu tabel. */
function kolomTerindeks(badan) {
  const hasil = new Set();

  const pk = badan.match(/^\s*(\w+)\s+[^,\n]*PRIMARY KEY/mi);
  if (pk) hasil.add(pk[1]);

  for (const m of badan.matchAll(/(?:PRIMARY KEY|UNIQUE KEY\s+\w+|INDEX\s+\w+)\s*\(([^)]+)\)/g)) {
    for (const kolom of m[1].split(",")) {
      // Awalan panjang - INDEX idx (kolom(100)) - tidak dihitung penuh.
      const bersih = kolom.trim().replace(/\(\d+\)$/, "");
      hasil.add(bersih);
    }
  }

  return [...hasil];
}

function deklarasiKolom(badan, nama) {
  return badan
    .split("\n")
    .find((baris) => baris.trim().toLowerCase().startsWith(`${nama.toLowerCase()} `));
}

const BERKAS = [
  "services/ecourtStoreService.js",
  "services/nomorVerificationService.js",
  "services/ecourtPermintaanService.js",
];

console.log("\n== Lebar kolom yang diindeks ==");

let jumlahTabel = 0;
let jumlahKolom = 0;

for (const berkas of BERKAS) {
  const jalur = pathx.resolve(__dirname, "..", berkas);
  if (!fs.existsSync(jalur)) continue;

  for (const { nama, badan } of bacaTabel(jalur)) {
    jumlahTabel += 1;

    for (const kolom of kolomTerindeks(badan)) {
      const deklarasi = deklarasiKolom(badan, kolom);
      if (!deklarasi) {
        periksa(`${nama}.${kolom} - deklarasinya ditemukan`, false);
        continue;
      }

      const lebar = lebarKolom(deklarasi);
      if (lebar === null) {
        periksa(`${nama}.${kolom} - tipenya dikenali (${deklarasi.trim().slice(0, 40)})`, false);
        continue;
      }

      jumlahKolom += 1;
      periksa(`${nama}.${kolom} = ${lebar} byte`, lebar <= BATAS_BYTE);
    }
  }
}

console.log(`\nTabel diperiksa: ${jumlahTabel}, kolom terindeks: ${jumlahKolom}`);

// Penjagaan terhadap pemeriksaan yang diam-diam tidak memeriksa apa pun.
// Tanpa ini, satu perubahan pada pola CREATE TABLE membuat skrip ini lulus
// tanpa membaca satu tabel pun - dan lulus tanpa memeriksa lebih buruk
// daripada gagal.
periksa("benar-benar ada tabel yang diperiksa", jumlahTabel >= 3);
periksa("benar-benar ada kolom yang diperiksa", jumlahKolom >= 8);

console.log(`\nHasil: ${lulus} lulus, ${gagal} gagal\n`);
process.exit(gagal === 0 ? 0 : 1);
