"use strict";

/**
 * Mencatat berapa lama setiap query berjalan.
 *
 * Sebelum ini tidak ada satu pun pengukuran pada jalur query: tidak diketahui
 * query mana yang lambat, mana yang paling sering dipanggil, atau berapa yang
 * gagal — sampai ada orang mengeluh. Padahal SIPP adalah sistem produksi
 * pengadilan, dan beban dari bot menumpang di atasnya.
 *
 * Modul ini sengaja dibuat murah: perhitungannya hanya penjumlahan di memori,
 * tidak menulis ke database pada jalur panas. Yang ditulis hanya query yang
 * benar-benar lambat, itu pun dibatasi frekuensinya supaya log tidak banjir
 * ketika SIPP sedang berat — persis saat log paling dibutuhkan tetap terbaca.
 *
 * Angkanya dibaca lewat status layanan bot dan menjadi dasar tahap berikutnya:
 * tidak ada yang bisa dioptimalkan bila tidak ada yang diukur.
 */

const crypto = require("crypto");
const logService = require("./logService");

/** Query lebih lama dari ini dianggap lambat dan dicatat tersendiri. */
const DEFAULT_SLOW_MS = Number(process.env.ALETA_BOT_SLOW_QUERY_MS || 3000);
/** Jeda minimum antar catatan lambat untuk sidik query yang sama. */
const SLOW_LOG_THROTTLE_MS = 60 * 1000;
/** Banyaknya sidik query berbeda yang diingat. */
const MAX_TRACKED = 300;
/** Contoh durasi yang disimpan per sidik, untuk menghitung persentil. */
const MAX_SAMPLES = 50;

const stats = new Map();
const lastSlowLogAt = new Map();
let startedAt = new Date().toISOString();

/**
 * Membuat sidik query yang stabil: nilai literal dibuang supaya query yang sama
 * dengan nomor perkara berbeda tetap terhitung sebagai satu.
 */
function fingerprintSql(sql) {
  const raw = String(sql || "");
  const normalized = raw
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\n]*/g, " ")
    .replace(/'[^']*'/g, "?")
    .replace(/"[^"]*"/g, "?")
    .replace(/\b\d+\b/g, "?")
    .replace(/\s+/g, " ")
    .trim();

  const verb = (normalized.match(/^\s*([a-z]+)/i) || [, "query"])[1].toUpperCase();
  const table =
    (normalized.match(/\bfrom\s+`?([a-z0-9_.]+)`?/i) || [])[1] ||
    (normalized.match(/\bupdate\s+`?([a-z0-9_.]+)`?/i) || [])[1] ||
    (normalized.match(/\binto\s+`?([a-z0-9_.]+)`?/i) || [])[1] ||
    "";

  const hash = crypto.createHash("sha1").update(normalized).digest("hex").slice(0, 8);
  return {
    key: `${verb}:${table || "-"}:${hash}`,
    label: table ? `${verb} ${table}` : verb,
    preview: normalized.slice(0, 160),
  };
}

function emptyEntry(fingerprint) {
  return {
    key: fingerprint.key,
    label: fingerprint.label,
    preview: fingerprint.preview,
    count: 0,
    errorCount: 0,
    timeoutCount: 0,
    slowCount: 0,
    totalMs: 0,
    maxMs: 0,
    totalRows: 0,
    lastAt: null,
    lastErrorMessage: "",
    samples: [],
  };
}

/**
 * Sidik yang paling jarang dipakai dibuang lebih dulu bila daftar penuh,
 * supaya query panas tidak tergeser oleh query sekali jalan.
 */
function evictIfNeeded() {
  if (stats.size <= MAX_TRACKED) return;
  let leanest = null;
  for (const [key, entry] of stats) {
    if (!leanest || entry.count < leanest.entry.count) leanest = { key, entry };
  }
  if (leanest) stats.delete(leanest.key);
}

function rowCountOf(result) {
  if (Array.isArray(result)) return result.length;
  if (result && typeof result === "object" && Number.isFinite(Number(result.affectedRows))) {
    return Number(result.affectedRows);
  }
  return 0;
}

function isTimeoutError(error) {
  if (!error) return false;
  const code = String(error.code || "");
  const message = String(error.message || "").toLowerCase();
  return (
    code === "PROTOCOL_SEQUENCE_TIMEOUT" ||
    code === "ETIMEDOUT" ||
    message.includes("timeout") ||
    message.includes("max_execution_time") ||
    message.includes("maximum statement execution time")
  );
}

/**
 * Mencatat satu query yang sudah selesai.
 *
 * Tidak pernah melempar error: kegagalan mencatat tidak boleh menggagalkan
 * query yang sebenarnya sudah berhasil dijalankan.
 */
function record({ sql, durationMs, result, error, connectionKey = "sipp_primary", slowMs = DEFAULT_SLOW_MS } = {}) {
  try {
    const fingerprint = fingerprintSql(sql);
    const entry = stats.get(fingerprint.key) || emptyEntry(fingerprint);
    const ms = Math.max(0, Number(durationMs) || 0);
    const timedOut = isTimeoutError(error);

    entry.count += 1;
    entry.totalMs += ms;
    entry.maxMs = Math.max(entry.maxMs, ms);
    entry.totalRows += error ? 0 : rowCountOf(result);
    entry.lastAt = new Date().toISOString();
    if (error) {
      entry.errorCount += 1;
      entry.lastErrorMessage = String(error.message || error).slice(0, 200);
    }
    if (timedOut) entry.timeoutCount += 1;

    entry.samples.push(ms);
    if (entry.samples.length > MAX_SAMPLES) entry.samples.shift();

    if (ms >= slowMs) {
      entry.slowCount += 1;
      const lastLoggedAt = lastSlowLogAt.get(fingerprint.key) || 0;
      if (Date.now() - lastLoggedAt >= SLOW_LOG_THROTTLE_MS) {
        lastSlowLogAt.set(fingerprint.key, Date.now());
        void logService
          .logSystemEvent({
            eventType: "slow_query_detected",
            severity: ms >= slowMs * 3 ? "error" : "warning",
            message: `Query ke database berjalan lambat (${Math.round(ms)} ms).`,
            metadata: {
              connectionKey,
              label: entry.label,
              durationMs: Math.round(ms),
              slowThresholdMs: slowMs,
              sqlPreview: fingerprint.preview,
              timedOut,
            },
          })
          .catch(() => {});
      }
    }

    stats.set(fingerprint.key, entry);
    evictIfNeeded();
  } catch {
    // Pencatatan bersifat pelengkap; kegagalannya diabaikan dengan sengaja.
  }
}

function percentile(samples, fraction) {
  if (!samples || samples.length === 0) return 0;
  const sorted = [...samples].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor(sorted.length * fraction));
  return Math.round(sorted[index]);
}

function toPublicEntry(entry) {
  return {
    label: entry.label,
    preview: entry.preview,
    count: entry.count,
    errorCount: entry.errorCount,
    timeoutCount: entry.timeoutCount,
    slowCount: entry.slowCount,
    avgMs: entry.count > 0 ? Math.round(entry.totalMs / entry.count) : 0,
    p95Ms: percentile(entry.samples, 0.95),
    maxMs: Math.round(entry.maxMs),
    totalMs: Math.round(entry.totalMs),
    avgRows: entry.count > 0 ? Math.round(entry.totalRows / entry.count) : 0,
    lastAt: entry.lastAt,
    lastErrorMessage: entry.lastErrorMessage,
  };
}

/**
 * Ringkasan untuk dashboard.
 *
 * Diurutkan menurut TOTAL waktu, bukan durasi rata-rata: query 200 ms yang
 * dipanggil seribu kali membebani SIPP jauh lebih berat daripada query 3 detik
 * yang dipanggil sekali, dan justru yang pertama itulah yang biasanya luput.
 */
function getSnapshot({ limit = 15 } = {}) {
  const entries = [...stats.values()];
  const totals = entries.reduce(
    (acc, entry) => {
      acc.count += entry.count;
      acc.totalMs += entry.totalMs;
      acc.errorCount += entry.errorCount;
      acc.timeoutCount += entry.timeoutCount;
      acc.slowCount += entry.slowCount;
      return acc;
    },
    { count: 0, totalMs: 0, errorCount: 0, timeoutCount: 0, slowCount: 0 }
  );

  const byTotalTime = entries
    .slice()
    .sort((a, b) => b.totalMs - a.totalMs)
    .slice(0, limit)
    .map(toPublicEntry);

  const slowest = entries
    .slice()
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.maxMs - a.maxMs)
    .slice(0, limit)
    .map(toPublicEntry);

  return {
    startedAt,
    trackedFingerprints: stats.size,
    slowThresholdMs: DEFAULT_SLOW_MS,
    totalQueries: totals.count,
    totalErrors: totals.errorCount,
    totalTimeouts: totals.timeoutCount,
    totalSlow: totals.slowCount,
    avgMs: totals.count > 0 ? Math.round(totals.totalMs / totals.count) : 0,
    byTotalTime,
    slowest,
  };
}

function reset() {
  stats.clear();
  lastSlowLogAt.clear();
  startedAt = new Date().toISOString();
}

module.exports = {
  DEFAULT_SLOW_MS,
  fingerprintSql,
  getSnapshot,
  isTimeoutError,
  record,
  reset,
};
