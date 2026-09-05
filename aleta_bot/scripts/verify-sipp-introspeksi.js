"use strict";

/**
 * Introspeksi struktur SIPP.
 *
 * Kamus Database SIPP selama ini diisi tangan, ditambah pengurai berkas dump
 * SQL yang jalurnya di-hardcode ke folder Windows pengembang - jalur yang tidak
 * akan pernah ada di server Linux. Akibatnya kamus di produksi selalu
 * tertinggal dari SIPP yang sesungguhnya, dan setiap kueri baru dibangun di
 * atas dugaan tentang nama kolom.
 *
 * Skrip ini menjaga aturan yang paling mudah dilanggar tanpa disadari,
 * seluruhnya tanpa menyentuh jaringan maupun database.
 */

const fs = require("fs");
const pathx = require("path");

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

const bot = fs.readFileSync(
  pathx.resolve(__dirname, "..", "services", "sippReadOnlyBridgeService.js"),
  "utf8"
);
const portalPath = pathx.resolve(
  __dirname,
  "..",
  "..",
  "manajemen_surat",
  "src",
  "server",
  "modules",
  "aleta-sipp",
  "aleta-sipp-service.ts"
);
const portal = fs.existsSync(portalPath) ? fs.readFileSync(portalPath, "utf8") : "";

// Hanya bagian introspeksi yang diperiksa, bukan seluruh berkas.
const bagian = bot.slice(
  bot.indexOf("async function introspectSchema"),
  bot.indexOf("async function handleBridgeOperation")
);

console.log("\n== Operasi terdaftar di jembatan ==");
periksa("introspectSchema ada", bagian.length > 0);
periksa("terdaftar sebagai schema.introspect", /"schema\.introspect": introspectSchema/.test(bot));

console.log("\n== Hanya membaca STRUKTUR, bukan data perkara ==");
{
  // information_schema tidak memuat satu pun baris data perkara. Menyentuh
  // tabel perkara di sini akan berarti nama, alamat, dan NIK pihak berperkara
  // ikut keluar dari jaringan pengadilan.
  periksa("membaca information_schema.TABLES", /information_schema\.TABLES/.test(bagian));
  periksa("membaca information_schema.COLUMNS", /information_schema\.COLUMNS/.test(bagian));

  const tabelData = ["FROM perkara", "FROM pihak", "JOIN perkara", "JOIN pihak"];
  const menyentuh = tabelData.filter((t) => bagian.includes(t));
  periksa(
    `tidak menyentuh tabel data${menyentuh.length ? ` (${menyentuh.join(", ")})` : ""}`,
    menyentuh.length === 0
  );
}

console.log("\n== Skema tidak boleh datang dari luar ==");
{
  // Menerima nama skema dari parameter membuka jalan membaca struktur database
  // lain di server MySQL yang sama - termasuk yang bukan urusan ALETA.
  periksa("memakai DATABASE() milik koneksinya sendiri", /TABLE_SCHEMA = DATABASE\(\)/.test(bagian));
  periksa(
    "tidak menerima nama skema dari parameter",
    !/params\.(schema|database|dbName|skema)/.test(bagian)
  );
  periksa("hanya SELECT", !/\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE)\b/i.test(bagian));
  periksa("lewat runReadOnly, bukan query langsung", !/externalDbService\.query/.test(bagian));
}

console.log("\n== Penyelaras portal tidak merusak tulisan manusia ==");
{
  periksa("penyelaras ada di portal", /syncAletaSippDictionaryFromLive/.test(portal));

  const sinkron = portal.slice(portal.indexOf("export async function syncAletaSippDictionaryFromLive"));

  // Ini aturan yang paling mudah dilanggar: satu ON CONFLICT yang menimpa
  // begitu saja akan menghapus dokumentasi yang disusun bertahun-tahun.
  periksa(
    "nama manusiawi dipertahankan bila sudah terisi",
    /human_name = COALESCE\(NULLIF\(aleta_sipp_tables\.human_name, ''\)/.test(sinkron)
  );
  periksa(
    "penjelasan tabel dipertahankan",
    /short_description = COALESCE\(NULLIF\(aleta_sipp_tables\.short_description, ''\)/.test(sinkron)
  );
  periksa(
    "penjelasan kolom dipertahankan",
    /description = COALESCE\(NULLIF\(aleta_sipp_columns\.description, ''\)/.test(sinkron)
  );

  // Fakta struktural JUSTRU harus disegarkan - itu gunanya introspeksi.
  periksa("tipe data disegarkan", /data_type = EXCLUDED\.data_type/.test(sinkron));
  periksa("kunci utama disegarkan", /is_primary_key = EXCLUDED\.is_primary_key/.test(sinkron));

  // Tabel yang hilang ditandai, bukan dibuang: kueri lama yang menyebutnya
  // tetap harus dapat ditelusuri.
  periksa("tabel hilang ditandai tidak aktif", /is_active = 0/.test(sinkron));
  periksa("tidak ada DELETE pada kamus", !/DELETE FROM aleta_sipp/i.test(sinkron));

  periksa("dijaga izin impor struktur", /IMPORT_SQL_STRUCTURE/.test(sinkron));
}

console.log(`\nLulus: ${lulus}, Gagal: ${gagal}`);
if (gagal > 0) {
  console.log("ADA PERIKSAAN YANG GAGAL.");
  process.exit(1);
}
