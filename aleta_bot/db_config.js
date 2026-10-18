// inisisalisasi database
require("dotenv").config();
const mysql = require("mysql");

const sippDatabase =
  process.env.ALETA_BOT_DB_SIPP_NAME ||
  (String(process.env.ALETA_BOT_DB_NAME || "").trim().toLowerCase() !== "aleta_bot"
    ? process.env.ALETA_BOT_DB_NAME
    : "") ||
  "SIPP";

const db = mysql.createPool({
  // sesuaikan konfigurasi dengan server
  host: process.env.ALETA_BOT_DB_SIPP_HOST || process.env.ALETA_BOT_DB_HOST || "localhost",
  port: Number(process.env.ALETA_BOT_DB_SIPP_PORT || process.env.ALETA_BOT_DB_PORT || 3306),
  user: process.env.ALETA_BOT_DB_SIPP_USER || process.env.ALETA_BOT_DB_USER || "root",
  password: process.env.ALETA_BOT_DB_SIPP_PASSWORD || process.env.ALETA_BOT_DB_PASSWORD || "",
  database: sippDatabase,
  multipleStatements: true,
  // Batas sambungan ditulis eksplisit. Sebelumnya mengandalkan bawaan driver
  // (10) tanpa pernah disebut, sehingga tidak ada yang dapat menghitung berapa
  // banyak query serentak yang sanggup ditanggung SIPP dari bot.
  connectionLimit: Math.max(1, Math.min(50, Number(process.env.ALETA_BOT_DB_CONNECTION_LIMIT || 10))),
  connectTimeout: Math.max(1000, Number(process.env.ALETA_BOT_DB_CONNECT_TIMEOUT_MS || 5000))
});

// -----------------------------------------------------------------------------
// Dukungan TANGGAL ACUAN untuk seluruh sumber data jalur lama.
//
// Seluruh query notifikasi.js (129 fungsi, 332 pemakaian CURDATE()) lewat sini,
// jadi satu pembungkus di titik ini membuat semuanya fleksibel tanpa menyentuh
// SQL-nya — fungsi yang sudah terbukti jalan tidak berisiko hilang.
//
// Aktif HANYA di dalam lingkup runWithReferenceDate(). Di luar itu perilakunya
// persis seperti sebelumnya, sehingga notifikasi terjadwal tetap memakai
// tanggal hari ini menurut server.
// -----------------------------------------------------------------------------
const { getReferenceDate, rewriteCurrentDate } = require("./services/legacyDateContext");
const queryGuardService = require("./services/queryGuardService");
const queryMetricsService = require("./services/queryMetricsService");
const sippCircuitBreaker = require("./services/sippCircuitBreakerService");
const penjagaTandaSipp = require("./services/penjagaTandaSipp");

// MODE KEMBARAN (ALETA_MODE=kembaran): tulisan ke SIPP dialihkan ke antrean "menunggu
// sinkron". Di mode biasa baris ini tidak mengubah apa pun. Dipasang SEBELUM
// pembungkus di bawah, jadi originalQuery di bawah sudah melewati penjaga.
require("./services/penjagaKembaran").pasang(db, "sipp");

const originalQuery = db.query.bind(db);

function sqlTextOf(target) {
  if (typeof target === "string") return target;
  if (target && typeof target === "object") return String(target.sql || "");
  return "";
}

/**
 * Satu pembungkus untuk tiga hal sekaligus, di titik yang dilewati SELURUH
 * query jalur lama (query.js, notifikasi.js, verifikasi perkara, daftar
 * perkara). Menaruhnya di sini berarti 137 SELECT di query.js dan 129 fungsi
 * notifikasi ikut terlindungi tanpa satu pun SQL-nya disentuh.
 *
 *   1. TANGGAL ACUAN  - perilaku lama, tidak berubah.
 *   2. BATAS WAKTU    - query lambat dihentikan, tidak lagi menggantung
 *                       sampai kolam sambungan habis.
 *   3. PENGUKURAN     - durasi tiap query dicatat, supaya query yang berat
 *                       akhirnya terlihat tanpa menunggu ada yang mengeluh.
 *   4. PEMUTUS ARUS   - saat SIPP bermasalah, pengambilan dihentikan sementara
 *                       supaya bot tidak ikut memperberat sistem induk.
 */
db.query = function queryWithReferenceDate(sql, ...rest) {
  let target = sql;

  // JARING TERAKHIR (17 Okt 2026): tulisan ke SIPP yang memuat kata ALETA dicatat di
  // log. Penolakannya ada di penjaga per-jalur (penjagaTandaSipp); di titik ini teks
  // dari data SIPP sendiri (nama pihak) tidak dapat dibedakan, jadi hanya mencatat.
  try {
    if (penjagaTandaSipp.tulisanBocor(sql, Array.isArray(rest[0]) ? rest[0] : undefined)) {
      console.error("[penjagaTandaSipp] PERINGATAN: tulisan ke SIPP memuat kata ALETA - periksa jalur tulis yang memanggilnya.");
    }
  } catch {
    /* jaring pengaman tidak boleh mengganggu kueri */
  }
  // STRUKTUR ber-nama ALETA (tabel/kolom/indeks) di basis data SIPP: DITOLAK, bukan
  // dicatat - tidak ada data SIPP yang perlu dikecualikan (audit jejak 18 Okt 2026).
  const tolakStruktur = penjagaTandaSipp.galatStrukturAleta(sql);
  if (tolakStruktur) {
    const cb = rest.length > 0 && typeof rest[rest.length - 1] === "function" ? rest[rest.length - 1] : null;
    if (!cb) throw tolakStruktur;
    setImmediate(() => cb(tolakStruktur, undefined, undefined));
    return undefined;
  }

  const referenceDate = getReferenceDate();
  if (referenceDate) {
    const sqlText = sqlTextOf(target);
    if (sqlText) {
      const { sql: rewritten, changed } = rewriteCurrentDate(sqlText, referenceDate);
      // Tanggal disisipkan sebagai literal DATE('YYYY-MM-DD') yang sudah
      // divalidasi ketat, bukan sebagai tanda tanya, supaya urutan parameter
      // pada pemanggilan yang memang membawa array nilai tidak ikut bergeser.
      if (changed > 0) {
        target = typeof target === "string" ? rewritten : { ...target, sql: rewritten };
      }
    }
  }

  const guard = queryGuardService.applyQueryGuard(target);
  const options = guard.applied ? guard.options : target;

  // Durasi hanya dapat diukur bila pemanggil memakai callback. Pemanggilan
  // bergaya aliran (streaming) diteruskan apa adanya agar tidak berubah sifat.
  const callbackIndex = rest.length - 1;
  const callback = callbackIndex >= 0 && typeof rest[callbackIndex] === "function" ? rest[callbackIndex] : null;
  if (!callback) return originalQuery(options, ...rest);

  // Pemutus arus: saat SIPP sedang bermasalah, permintaan baru ditolak cepat
  // tanpa menyentuh database sama sekali. Terus mencoba hanya menempati
  // sambungan dan memperburuk keadaan sistem induk.
  const izin = sippCircuitBreaker.canAttempt("sipp_primary");
  if (!izin.allowed) {
    const penolakan = sippCircuitBreaker.buildOpenCircuitError("sipp_primary");
    queryMetricsService.record({
      sql: guard.sql || sqlTextOf(target),
      durationMs: 0,
      error: penolakan,
      connectionKey: "sipp_primary",
    });
    setImmediate(() => callback(penolakan, undefined, undefined));
    return undefined;
  }

  const startedAt = Date.now();
  const forwarded = rest.slice();
  forwarded[callbackIndex] = function measuredCallback(error, result, fields) {
    queryMetricsService.record({
      sql: guard.sql || sqlTextOf(target),
      durationMs: Date.now() - startedAt,
      result,
      error,
      connectionKey: "sipp_primary",
    });
    if (error) sippCircuitBreaker.recordFailure("sipp_primary", error);
    else sippCircuitBreaker.recordSuccess("sipp_primary");
    return callback(error, result, fields);
  };

  return originalQuery(options, ...forwarded);
};

module.exports = db;
