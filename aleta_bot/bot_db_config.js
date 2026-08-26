// Database internal ALETA Bot.
// Jangan arahkan koneksi ini ke database SIPP. Koneksi SIPP dibaca melalui db_config.js
// atau externalDbService dengan env ALETA_BOT_DB_SIPP_*.
require("dotenv").config();

const mysql = require("mysql");

function normalizeName(value) {
  return String(value || "").trim().toLowerCase();
}

const internalDatabase =
  process.env.ALETA_BOT_INTERNAL_DB_NAME ||
  process.env.ALETA_BOT_DB_NAME ||
  "aleta_bot";

const sippDatabase = process.env.ALETA_BOT_DB_SIPP_NAME || "SIPP";
const allowUnsafeSippSchemaWrite =
  String(process.env.ALETA_BOT_ALLOW_SIPP_SCHEMA_WRITE || "false").toLowerCase() === "true";

if (
  !allowUnsafeSippSchemaWrite &&
  normalizeName(internalDatabase) &&
  normalizeName(sippDatabase) &&
  normalizeName(internalDatabase) === normalizeName(sippDatabase)
) {
  throw new Error(
    "Konfigurasi database tidak aman: ALETA_BOT_DB_NAME/ALETA_BOT_INTERNAL_DB_NAME tidak boleh sama dengan ALETA_BOT_DB_SIPP_NAME. " +
      "Gunakan database internal khusus, misalnya 'aleta_bot', dan biarkan SIPP hanya sebagai datasource read-only."
  );
}

if (!allowUnsafeSippSchemaWrite && normalizeName(internalDatabase) === "sipp") {
  throw new Error(
    "Konfigurasi database tidak aman: database internal ALETA Bot tidak boleh bernama 'SIPP'. " +
      "Set ALETA_BOT_DB_NAME=aleta_bot dan ALETA_BOT_DB_SIPP_NAME=SIPP."
  );
}

const db = mysql.createPool({
  host: process.env.ALETA_BOT_DB_HOST || "localhost",
  port: Number(process.env.ALETA_BOT_DB_PORT || 3306),
  user: process.env.ALETA_BOT_DB_USER || "root",
  password: process.env.ALETA_BOT_DB_PASSWORD || "",
  database: internalDatabase,
  multipleStatements: false,
});

module.exports = db;
