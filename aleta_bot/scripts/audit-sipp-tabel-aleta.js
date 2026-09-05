#!/usr/bin/env node
"use strict";

/**
 * Memeriksa dan membersihkan tabel ALETA yang tertinggal di database SIPP.
 *
 *   node scripts/audit-sipp-tabel-aleta.js                      (hanya melihat)
 *   node scripts/audit-sipp-tabel-aleta.js --cadangkan berkas.sql
 *   node scripts/audit-sipp-tabel-aleta.js --hapus --cadangan berkas.sql
 *
 * ============================================================================
 * KENAPA ALAT INI ADA
 * ============================================================================
 *
 * Versi ALETA yang lama menulis tabelnya sendiri ke dalam database SIPP,
 * karena ALETA_BOT_DB_NAME saat itu mengarah ke sana. Sejak bot_db_config.js
 * memiliki penjagaan, hal itu tidak mungkin terjadi lagi - tetapi tabel yang
 * terlanjur terbentuk tetap tinggal di sana.
 *
 * SIPP adalah sistem induk Mahkamah Agung yang dipakai seluruh pengadilan.
 * Tabel asing di dalamnya menyulitkan pemeliharaan, membingungkan siapa pun
 * yang memeriksa strukturnya, dan ikut membesarkan setiap pencadangan SIPP.
 *
 * ============================================================================
 * ALAT INI SANGAT BERHATI-HATI, DAN SENGAJA MEREPOTKAN
 * ============================================================================
 *
 *   1. MELIHAT adalah perilaku bawaan. Tanpa tanda apa pun, tidak ada satu
 *      baris pun yang berubah.
 *
 *   2. HANYA tabel berawalan aleta_bot_ yang disentuh. Nama tabel dicocokkan
 *      dengan pola yang ketat, dan daftar hasilnya ditampilkan untuk diperiksa
 *      mata manusia sebelum apa pun terjadi.
 *
 *   3. PENGHAPUSAN MENUNTUT CADANGAN. Tanpa berkas cadangan yang benar-benar
 *      ada dan berisi, penghapusan ditolak - bukan diperingatkan, ditolak.
 *
 *   4. KONFIRMASI DIKETIK LENGKAP. Bukan "y", melainkan kalimat penuh yang
 *      tidak mungkin terketik tanpa sengaja.
 *
 * Kesalahan di database SIPP tidak punya tombol batal. Kerepotan di sini
 * adalah harganya.
 */

const fs = require("fs");
const path = require("path");
const readline = require("readline");

const db = require("../db_config");

/** Hanya tabel dengan awalan ini yang boleh disentuh. */
const AWALAN = "aleta_bot_";
const KALIMAT_KONFIRMASI = "SAYA MENGERTI DAN SUDAH MENCADANGKAN";

function parseArgs(argv) {
  const args = { cadangkan: "", hapus: false, cadangan: "" };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--cadangkan") args.cadangkan = String(argv[++i] || "");
    else if (argv[i] === "--hapus") args.hapus = true;
    else if (argv[i] === "--cadangan") args.cadangan = String(argv[++i] || "");
  }
  return args;
}

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (error, rows) => {
      if (error) reject(error);
      else resolve(Array.isArray(rows) ? rows : []);
    });
  });
}

function tanya(pertanyaan) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(pertanyaan, (jawaban) => {
      rl.close();
      resolve(String(jawaban || "").trim());
    });
  });
}

function garis(judul) {
  console.log(`\n${"=".repeat(72)}\n${judul}\n${"=".repeat(72)}`);
}

/** Nama database SIPP yang sedang tersambung. */
async function namaDatabase() {
  const rows = await runQuery("SELECT DATABASE() AS db");
  return String((rows[0] && rows[0].db) || "");
}

/**
 * Daftar tabel ALETA di dalam database SIPP.
 *
 * Nama tabel diambil dari information_schema, bukan disusun sendiri, sehingga
 * yang ditampilkan benar-benar apa adanya - termasuk bila ada tabel berawalan
 * sama yang tidak kami kenali.
 */
async function daftarTabel(dbName) {
  return runQuery(
    `SELECT TABLE_NAME AS nama,
            TABLE_ROWS AS perkiraan_baris,
            ROUND((DATA_LENGTH + INDEX_LENGTH) / 1024 / 1024, 1) AS ukuran_mb,
            CREATE_TIME AS dibuat,
            UPDATE_TIME AS diubah
       FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME LIKE ?
      ORDER BY TABLE_NAME`,
    [dbName, `${AWALAN}%`]
  );
}

/** Jumlah baris sesungguhnya. TABLE_ROWS pada InnoDB hanya perkiraan. */
async function hitungBaris(dbName, nama) {
  try {
    const rows = await runQuery(`SELECT COUNT(*) AS jumlah FROM \`${dbName}\`.\`${nama}\``);
    return Number((rows[0] && rows[0].jumlah) || 0);
  } catch {
    return null;
  }
}

/** Menulis cadangan berupa CREATE TABLE dan seluruh isinya. */
async function cadangkan(dbName, tabel, tujuan) {
  const keluaran = [];
  keluaran.push(`-- Cadangan tabel ALETA dari database ${dbName}`);
  keluaran.push(`-- Dibuat ${new Date().toISOString()}`);
  keluaran.push(`-- Dipulihkan dengan: mysql -u root -p ${dbName} < ${path.basename(tujuan)}`);
  keluaran.push("");
  keluaran.push("SET FOREIGN_KEY_CHECKS = 0;");
  keluaran.push("");

  for (const item of tabel) {
    const nama = item.nama;
    process.stdout.write(`  mencadangkan ${nama} ... `);

    const struktur = await runQuery(`SHOW CREATE TABLE \`${dbName}\`.\`${nama}\``);
    const ddl = struktur[0] && (struktur[0]["Create Table"] || struktur[0]["Create View"]);
    if (!ddl) {
      console.log("dilewati (struktur tidak terbaca)");
      continue;
    }

    keluaran.push(`-- ${"-".repeat(68)}`);
    keluaran.push(`-- ${nama}`);
    keluaran.push(`-- ${"-".repeat(68)}`);
    keluaran.push(`DROP TABLE IF EXISTS \`${nama}\`;`);
    keluaran.push(`${ddl};`);
    keluaran.push("");

    const baris = await runQuery(`SELECT * FROM \`${dbName}\`.\`${nama}\``);
    if (baris.length > 0) {
      const kolom = Object.keys(baris[0]);
      const daftarKolom = kolom.map((k) => `\`${k}\``).join(", ");
      for (const row of baris) {
        const nilai = kolom
          .map((k) => {
            const v = row[k];
            if (v === null || v === undefined) return "NULL";
            if (v instanceof Date) return `'${v.toISOString().slice(0, 19).replace("T", " ")}'`;
            if (typeof v === "number") return String(v);
            if (Buffer.isBuffer(v)) return `0x${v.toString("hex")}`;
            return `'${String(v).replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\n/g, "\\n").replace(/\r/g, "\\r")}'`;
          })
          .join(", ");
        keluaran.push(`INSERT INTO \`${nama}\` (${daftarKolom}) VALUES (${nilai});`);
      }
      keluaran.push("");
    }
    console.log(`${baris.length} baris`);
  }

  keluaran.push("SET FOREIGN_KEY_CHECKS = 1;");
  fs.writeFileSync(tujuan, keluaran.join("\n"), "utf8");
  return fs.statSync(tujuan).size;
}

async function utama() {
  const args = parseArgs(process.argv.slice(2));

  const dbName = await namaDatabase();
  if (!dbName) {
    console.error("Tidak dapat menentukan database yang tersambung. Periksa ALETA_BOT_DB_SIPP_*.");
    process.exit(1);
  }

  garis(`TABEL ALETA DI DALAM DATABASE "${dbName}"`);

  const tabel = await daftarTabel(dbName);
  if (tabel.length === 0) {
    console.log(`Tidak ada tabel berawalan "${AWALAN}" di database ini.`);
    console.log("Database SIPP bersih dari tabel ALETA.\n");
    process.exit(0);
  }

  let totalBaris = 0;
  let totalMb = 0;
  console.log("");
  for (const item of tabel) {
    const baris = await hitungBaris(dbName, item.nama);
    item.baris = baris;
    totalBaris += baris || 0;
    totalMb += Number(item.ukuran_mb || 0);
    console.log(
      `  ${String(baris === null ? "?" : baris).padStart(9)} baris  ` +
        `${String(item.ukuran_mb || 0).padStart(7)} MB  ${item.nama}`
    );
  }

  console.log("");
  console.log(`  ${tabel.length} tabel · ${totalBaris.toLocaleString("id-ID")} baris · ${totalMb.toFixed(1)} MB`);

  // --- Hanya melihat ---
  if (!args.cadangkan && !args.hapus) {
    console.log("\nTidak ada yang diubah. Untuk mencadangkan:");
    console.log("  node scripts/audit-sipp-tabel-aleta.js --cadangkan cadangan-sipp-aleta.sql\n");
    process.exit(0);
  }

  // --- Mencadangkan ---
  if (args.cadangkan) {
    garis("MENCADANGKAN");
    const ukuran = await cadangkan(dbName, tabel, args.cadangkan);
    console.log(`\nCadangan tersimpan: ${args.cadangkan} (${(ukuran / 1024 / 1024).toFixed(1)} MB)`);
    console.log("\nSetelah memastikan cadangannya benar, hapus dengan:");
    console.log(`  node scripts/audit-sipp-tabel-aleta.js --hapus --cadangan ${args.cadangkan}\n`);
    process.exit(0);
  }

  // --- Menghapus ---
  garis("PENGHAPUSAN TABEL DARI DATABASE SIPP");

  // Cadangan WAJIB ada dan berisi. Ini penjagaan, bukan peringatan.
  if (!args.cadangan) {
    console.error("DITOLAK: penghapusan menuntut --cadangan menunjuk berkas cadangan.");
    console.error("Jalankan --cadangkan lebih dulu.\n");
    process.exit(1);
  }
  if (!fs.existsSync(args.cadangan)) {
    console.error(`DITOLAK: berkas cadangan tidak ditemukan: ${args.cadangan}\n`);
    process.exit(1);
  }
  const ukuranCadangan = fs.statSync(args.cadangan).size;
  if (ukuranCadangan < 1024) {
    console.error(`DITOLAK: berkas cadangan terlalu kecil (${ukuranCadangan} byte). Kemungkinan gagal dibuat.\n`);
    process.exit(1);
  }

  console.log(`Cadangan  : ${args.cadangan} (${(ukuranCadangan / 1024 / 1024).toFixed(1)} MB)`);
  console.log(`Database  : ${dbName}`);
  console.log(`Akan dihapus: ${tabel.length} tabel, ${totalBaris.toLocaleString("id-ID")} baris\n`);
  for (const item of tabel) console.log(`  DROP TABLE ${item.nama}`);

  console.log("\nIni tidak dapat dibatalkan selain memulihkan dari cadangan.");
  const jawaban = await tanya(`Ketik "${KALIMAT_KONFIRMASI}" untuk melanjutkan: `);
  if (jawaban !== KALIMAT_KONFIRMASI) {
    console.log("\nDibatalkan. Tidak ada tabel yang dihapus.\n");
    process.exit(0);
  }

  let berhasil = 0;
  let gagal = 0;
  for (const item of tabel) {
    process.stdout.write(`  menghapus ${item.nama} ... `);
    try {
      // Nama tabel berasal dari information_schema pada database ini dan sudah
      // disaring dengan awalan tetap, jadi tidak ada teks dari luar yang masuk.
      await runQuery(`DROP TABLE \`${dbName}\`.\`${item.nama}\``);
      berhasil += 1;
      console.log("selesai");
    } catch (error) {
      gagal += 1;
      console.log(`GAGAL: ${error.message}`);
    }
  }

  garis("RINGKASAN");
  console.log(`  Terhapus : ${berhasil}`);
  console.log(`  Gagal    : ${gagal}`);
  if (gagal > 0) {
    console.log("\n  Kegagalan biasanya karena akun SIPP hanya-baca. Minta DBA menjalankannya,");
    console.log("  atau jalankan ulang dengan akun yang berhak menghapus tabel.");
  }
  console.log("");
  process.exit(gagal > 0 ? 1 : 0);
}

utama().catch((error) => {
  console.error("\nGagal:", error.message);
  process.exit(1);
});
