#!/usr/bin/env node
"use strict";

/**
 * Memeriksa pemisahan database ALETA dan SIPP.
 *
 *   node scripts/verify-pemisahan-database.js
 *
 * ============================================================================
 * KENAPA INI PENTING
 * ============================================================================
 *
 * SIPP adalah sistem induk Mahkamah Agung yang dipakai seluruh pengadilan
 * se-Indonesia. ALETA hanya menumpang MEMBACA darinya.
 *
 * Versi ALETA yang lama pernah menulis tabelnya sendiri ke dalam SIPP, karena
 * ALETA_BOT_DB_NAME saat itu mengarah ke sana. Akibatnya tabel aleta_bot_*
 * terbentuk di database perkara - termasuk tabel log yang tumbuh sampai
 * ratusan ribu baris, ikut membesarkan setiap pencadangan SIPP.
 *
 * Kesalahan seperti itu tidak menghasilkan pesan galat apa pun. Bot berjalan
 * normal, datanya tersimpan, hanya tersimpan di tempat yang salah - dan baru
 * ketahuan ketika ada yang membuka daftar tabel SIPP.
 *
 * Berkas ini menjaga agar tidak terulang.
 */

const fs = require("fs");
const path = require("path");

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

/** Memuat bot_db_config dengan env tertentu, mengembalikan galat bila ada. */
function muatDenganEnv(env) {
  const simpan = {};
  for (const [k, v] of Object.entries(env)) {
    simpan[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }

  const jalur = require.resolve("../bot_db_config");
  delete require.cache[jalur];

  let galat = null;
  try {
    require("../bot_db_config");
  } catch (error) {
    galat = error;
  }

  delete require.cache[jalur];
  for (const [k, v] of Object.entries(simpan)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  return galat;
}

function utama() {
  console.log("\n== ATURAN POKOK: database internal tidak boleh sama dengan SIPP ==");
  {
    const galat = muatDenganEnv({
      ALETA_BOT_DB_NAME: "SIPP",
      ALETA_BOT_DB_SIPP_NAME: "SIPP",
      ALETA_BOT_INTERNAL_DB_NAME: undefined,
      ALETA_BOT_ALLOW_SIPP_SCHEMA_WRITE: undefined,
    });
    periksa("konfigurasi berbahaya MELEMPAR galat", galat !== null);
    periksa("galatnya menjelaskan sebabnya", galat && /tidak boleh sama|tidak aman/i.test(galat.message));
    periksa("galatnya menyebut jalan keluar", galat && /aleta_bot/i.test(galat.message));
  }

  console.log("\n== Nama 'SIPP' ditolak walau nama SIPP-nya berbeda ==");
  {
    // Menamai database internal "SIPP" sambil menunjuk SIPP asli ke nama lain
    // tetap salah: tabel ALETA akan mendarat di database bernama SIPP, dan
    // siapa pun yang memeriksanya akan menyimpulkan hal yang keliru.
    const galat = muatDenganEnv({
      ALETA_BOT_DB_NAME: "SIPP",
      ALETA_BOT_DB_SIPP_NAME: "sipp_produksi",
      ALETA_BOT_INTERNAL_DB_NAME: undefined,
      ALETA_BOT_ALLOW_SIPP_SCHEMA_WRITE: undefined,
    });
    periksa("nama internal 'SIPP' ditolak", galat !== null);
  }

  console.log("\n== Perbandingan tidak peduli huruf besar-kecil ==");
  {
    for (const nama of ["sipp", "Sipp", "SIPP", " SIPP "]) {
      const galat = muatDenganEnv({
        ALETA_BOT_DB_NAME: nama,
        ALETA_BOT_DB_SIPP_NAME: "SIPP",
        ALETA_BOT_INTERNAL_DB_NAME: undefined,
        ALETA_BOT_ALLOW_SIPP_SCHEMA_WRITE: undefined,
      });
      periksa(`"${nama}" ditolak`, galat !== null);
    }
  }

  console.log("\n== Konfigurasi yang benar diterima ==");
  {
    const galat = muatDenganEnv({
      ALETA_BOT_DB_NAME: "aleta_bot",
      ALETA_BOT_DB_SIPP_NAME: "SIPP",
      ALETA_BOT_INTERNAL_DB_NAME: undefined,
      ALETA_BOT_ALLOW_SIPP_SCHEMA_WRITE: undefined,
    });
    periksa("aleta_bot + SIPP diterima", galat === null);
  }

  console.log("\n== SIPP dibaca lewat sambungan yang berbeda ==");
  {
    const sipp = fs.readFileSync(path.resolve(__dirname, "..", "db_config.js"), "utf8");
    const bot = fs.readFileSync(path.resolve(__dirname, "..", "bot_db_config.js"), "utf8");

    periksa("db_config menunjuk SIPP", /ALETA_BOT_DB_SIPP_NAME/.test(sipp));
    periksa("bot_db_config menunjuk database internal", /ALETA_BOT_INTERNAL_DB_NAME|ALETA_BOT_DB_NAME/.test(bot));
    periksa("keduanya sambungan terpisah", /mysql\.createPool/.test(sipp) && /mysql\.createPool/.test(bot));

    // Layanan ALETA menulis lewat botDbService, yang memakai bot_db_config.
    const botDb = fs.readFileSync(path.resolve(__dirname, "..", "services", "botDbService.js"), "utf8");
    periksa("botDbService memakai bot_db_config", /require\("\.\.\/bot_db_config"\)/.test(botDb));
    periksa("botDbService TIDAK memakai db_config", !/require\("\.\.\/db_config"\)/.test(botDb));
  }

  console.log("\n== Sambungan SIPP hanya dipakai untuk membaca ==");
  {
    // Pemeriksaan ini melihat SETIAP pemanggilan yang menempuh sambungan SIPP,
    // bukan sekadar keberadaan kata CREATE TABLE di dalam berkas. Sebuah
    // layanan boleh memakai dua sambungan sekaligus - membaca dari SIPP dan
    // menulis ke database ALETA - dan itu memang bentuk yang benar.
    const folder = path.resolve(__dirname, "..", "services");
    const berkas = fs.readdirSync(folder).filter((f) => f.endsWith(".js"));
    const pelanggar = [];

    for (const nama of berkas) {
      const isi = fs.readFileSync(path.join(folder, nama), "utf8");
      if (!/require\("\.\.\/db_config"\)/.test(isi)) continue;

      // Nama pembungkus yang menjalankan db.query - itulah jalur ke SIPP.
      const pembungkus = new Set(["db.query"]);
      const polaPembungkus = /function\s+(\w+)\s*\([^)]*\)\s*\{[\s\S]{0,300}?(?<![\w.])db\.query\(/g;
      let cocok;
      while ((cocok = polaPembungkus.exec(isi)) !== null) pembungkus.add(cocok[1]);

      for (const fn of pembungkus) {
        const pola = new RegExp(fn.replace(".", "\\.") + "\\(\\s*`([^`]*)`", "g");
        let panggilan;
        while ((panggilan = pola.exec(isi)) !== null) {
          const sql = panggilan[1].trim();
          if (!sql) continue;
          if (!/^\s*(SELECT|SHOW)\b/i.test(sql)) {
            pelanggar.push(nama + ": " + fn + ' menjalankan "' + sql.slice(0, 40) + '..."');
          }
        }
      }
    }

    periksa(
      "sambungan SIPP hanya SELECT" + (pelanggar.length ? " (" + pelanggar.join("; ") + ")" : ""),
      pelanggar.length === 0
    );

    // Penjagaan kedua: tidak ada tulisan langsung lewat sambungan SIPP.
    const menulis = [];
    for (const nama of berkas) {
      const isi = fs.readFileSync(path.join(folder, nama), "utf8");
      if (!/require\("\.\.\/db_config"\)/.test(isi)) continue;
      // (?<![\w.]) mencegah "botDb.query" ikut tertangkap sebagai "db.query" -
      // keduanya berakhiran sama, tetapi menuju database yang berbeda.
      if (/(?<![\w.])db\.query\(\s*`\s*(INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)/i.test(isi)) {
        menulis.push(nama);
      }
    }
    periksa(
      "tidak ada tulisan langsung lewat db.query SIPP" + (menulis.length ? " (" + menulis.join(", ") + ")" : ""),
      menulis.length === 0
    );
  }

  console.log("\n== Alat pembersih SIPP berhati-hati ==");
  {
    const alat = fs.readFileSync(path.resolve(__dirname, "audit-sipp-tabel-aleta.js"), "utf8");

    periksa("melihat adalah perilaku bawaan", /!args\.cadangkan && !args\.hapus/.test(alat));
    periksa("hanya menyentuh awalan aleta_bot_", /const AWALAN = "aleta_bot_"/.test(alat));
    periksa("nama tabel diambil dari information_schema", /information_schema\.TABLES/.test(alat));
    // Menghapus tanpa cadangan adalah kesalahan yang tidak punya tombol batal.
    periksa("penghapusan menuntut cadangan yang ada", /DITOLAK: berkas cadangan tidak ditemukan/.test(alat));
    periksa("cadangan kosong ditolak", /terlalu kecil/.test(alat));
    periksa("konfirmasi berupa kalimat penuh", /SAYA MENGERTI DAN SUDAH MENCADANGKAN/.test(alat));
  }

  console.log("\n== Lapis kedua sama kuatnya, tanpa bergantung NODE_ENV ==");
  {
    // Lapis pertama (bot_db_config) melempar saat modul dimuat, sehingga
    // selalu menang lebih dulu. Untuk menguji lapis kedua sendirian, kedua
    // sambungan ditiru supaya pemuatan modulnya tidak terhalang.
    const tiru = (jalur) => {
      const kunci = require.resolve(jalur);
      require.cache[kunci] = { id: kunci, filename: kunci, loaded: true, exports: { query: () => {} } };
    };
    tiru("../bot_db_config");
    tiru("../services/botDbService");

    const jalurValidasi = require.resolve("../services/configValidationService");
    const cobaDenganEnv = (env) => {
      const simpan = {};
      for (const [k, v] of Object.entries(env)) {
        simpan[k] = process.env[k];
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
      delete require.cache[jalurValidasi];
      let galat = null;
      try {
        require("../services/configValidationService").validateStartupConfig();
      } catch (error) {
        galat = error;
      }
      delete require.cache[jalurValidasi];
      for (const [k, v] of Object.entries(simpan)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
      return galat;
    };

    const bahaya = {
      ALETA_BOT_DB_NAME: "SIPP",
      ALETA_BOT_DB_SIPP_NAME: "SIPP",
      ALETA_BOT_INTERNAL_DB_NAME: undefined,
      ALETA_BOT_ALLOW_SIPP_SCHEMA_WRITE: undefined,
    };

    // Inilah celah yang ditutup: server yang lupa menyetel NODE_ENV dulu
    // hanya mendapat peringatan konsol, dan bot tetap menyala.
    periksa(
      "tanpa NODE_ENV -> tetap melempar",
      cobaDenganEnv({ ...bahaya, NODE_ENV: undefined }) !== null
    );
    periksa(
      "NODE_ENV=development -> tetap melempar",
      cobaDenganEnv({ ...bahaya, NODE_ENV: "development" }) !== null
    );
    periksa(
      "NODE_ENV=production -> melempar",
      cobaDenganEnv({ ...bahaya, NODE_ENV: "production" }) !== null
    );

    // Pintu darurat tetap ada, tetapi harus dinyatakan dengan sengaja.
    periksa(
      "pintu darurat masih dapat dipakai bila memang disengaja",
      cobaDenganEnv({ ...bahaya, NODE_ENV: undefined, ALETA_BOT_ALLOW_SIPP_SCHEMA_WRITE: "true" }) === null
    );

    const sumber = fs.readFileSync(
      path.resolve(__dirname, "..", "services", "configValidationService.js"),
      "utf8"
    );
    periksa(
      "penjagaan tidak lagi bercabang pada NODE_ENV",
      !/nodeEnv === "production"[\s\S]{0,80}throw/.test(sumber)
    );
  }

  console.log(`\nLulus: ${lulus}, Gagal: ${gagal}`);
  if (gagal > 0) {
    console.log("ADA PERIKSAAN YANG GAGAL.");
    process.exit(1);
  }
  console.log("SEMUA PERIKSAAN LULUS.");
  process.exit(0);
}

utama();
