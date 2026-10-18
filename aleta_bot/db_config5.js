// inisisalisasi database
require("dotenv").config();
const mysql = require("mysql");
const db = mysql.createPool({
  // sesuaikan konfigurasi dengan server
  host: process.env.ALETA_BOT_DB_HOST || "localhost",
  user: process.env.ALETA_BOT_DB_USER || "root",
  password: process.env.ALETA_BOT_DB_PASSWORD || "",
  database: process.env.ALETA_BOT_DB5_NAME || "aps_badilag",
  multipleStatements: true
});

// MODE KEMBARAN: tulisan ke ABT (aps_badilag) dialihkan ke antrean sinkron.
require("./services/penjagaKembaran").pasang(db, "abt");

// Jaring tanda ALETA (audit jejak 18 Okt 2026): struktur ber-nama ALETA ditolak, nilai dicatat.
require("./services/penjagaTandaSipp").pasangJaring(db, "abt");

module.exports = db;
