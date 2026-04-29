// inisisalisasi database
require("dotenv").config();
const mysql = require("mysql");
const db = mysql.createPool({
  // sesuaikan konfigurasi dengan server
  host: process.env.ALETA_BOT_DB_HOST || "localhost",
  user: process.env.ALETA_BOT_DB_USER || "root",
  password: process.env.ALETA_BOT_DB_PASSWORD || "",
  database: process.env.ALETA_BOT_DB2_NAME || "db_suratin",
  multipleStatements: true
});

module.exports = db;
