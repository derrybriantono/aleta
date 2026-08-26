"use strict";

/**
 * Pemutus arus ke database perkara.
 *
 * Ketika SIPP sedang berat atau tidak dapat dijangkau, bot yang terus mencoba
 * justru memperburuk keadaannya: setiap percobaan baru menempati sambungan,
 * menunggu sampai batas waktu, lalu gagal — sementara antrean permintaan di
 * belakangnya terus menumpuk. Berhenti sejenak adalah bentuk perlindungan
 * terhadap sistem induk, bukan sekadar penyelamatan diri bot.
 *
 * Tiga keadaan:
 *   TERTUTUP    - normal, semua permintaan diteruskan.
 *   TERBUKA     - setelah beberapa kegagalan berturut-turut, permintaan baru
 *                 ditolak cepat tanpa menyentuh SIPP sama sekali.
 *   SETENGAH    - setelah masa tenang, SATU permintaan percobaan diizinkan.
 *                 Berhasil berarti pulih; gagal berarti terbuka lagi.
 *
 * YANG DIHITUNG SEBAGAI KEGAGALAN hanyalah tanda SIPP sedang tertekan: batas
 * waktu terlampaui dan gangguan sambungan. Galat SQL biasa — tabel tidak ada,
 * sintaks keliru — TIDAK dihitung. Satu query admin yang salah tulis tidak
 * boleh menghentikan layanan bagi semua orang.
 */

const logService = require("./logService");

const DEFAULT_FAILURE_THRESHOLD = Number(process.env.ALETA_BOT_SIPP_BREAKER_THRESHOLD || 5);
const DEFAULT_COOLDOWN_MS = Number(process.env.ALETA_BOT_SIPP_BREAKER_COOLDOWN_MS || 30000);

const STATE_CLOSED = "tertutup";
const STATE_OPEN = "terbuka";
const STATE_HALF_OPEN = "setengah_terbuka";

/** Kode galat yang menandakan SIPP sedang bermasalah, bukan query yang salah. */
const DISTRESS_CODES = new Set([
  "PROTOCOL_SEQUENCE_TIMEOUT",
  "PROTOCOL_CONNECTION_LOST",
  "PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR",
  "ETIMEDOUT",
  "ECONNREFUSED",
  "ECONNRESET",
  "EHOSTUNREACH",
  "ENOTFOUND",
  "EPIPE",
  "ER_CON_COUNT_ERROR",
  "ER_TOO_MANY_USER_CONNECTIONS",
  "ER_LOCK_WAIT_TIMEOUT",
  "POOL_ENQUEUELIMIT",
  "POOL_CLOSED",
]);

const circuits = new Map();

function getCircuit(key) {
  const id = String(key || "sipp_primary");
  if (!circuits.has(id)) {
    circuits.set(id, {
      key: id,
      state: STATE_CLOSED,
      consecutiveFailures: 0,
      openedAt: null,
      lastFailureAt: null,
      lastSuccessAt: null,
      lastErrorMessage: "",
      totalOpened: 0,
      totalRejected: 0,
    });
  }
  return circuits.get(id);
}

function getConfig() {
  return {
    failureThreshold: Math.max(2, Math.min(50, DEFAULT_FAILURE_THRESHOLD)),
    cooldownMs: Math.max(5000, Math.min(600000, DEFAULT_COOLDOWN_MS)),
  };
}

/**
 * Apakah galat ini menandakan SIPP sedang tertekan?
 *
 * Dibedakan dengan sengaja dari galat SQL biasa: hanya gangguan yang bersifat
 * sistemik yang boleh membuka pemutus arus.
 */
function isDistressError(error) {
  if (!error) return false;
  const code = String(error.code || "");
  if (DISTRESS_CODES.has(code)) return true;
  const message = String(error.message || "").toLowerCase();
  return (
    message.includes("timeout") ||
    message.includes("maximum statement execution time") ||
    message.includes("too many connections") ||
    message.includes("connection lost") ||
    message.includes("pool is closed")
  );
}

/**
 * Boleh menyentuh SIPP sekarang?
 * @returns {{allowed: boolean, state: string, reason?: string, retryInMs?: number}}
 */
function canAttempt(key = "sipp_primary") {
  const circuit = getCircuit(key);
  const config = getConfig();

  if (circuit.state !== STATE_OPEN) {
    return { allowed: true, state: circuit.state };
  }

  const sinceOpenedMs = Date.now() - (circuit.openedAt || 0);
  if (sinceOpenedMs >= config.cooldownMs) {
    // Masa tenang selesai: izinkan satu percobaan untuk menguji keadaan.
    circuit.state = STATE_HALF_OPEN;
    return { allowed: true, state: STATE_HALF_OPEN, reason: "percobaan_pemulihan" };
  }

  circuit.totalRejected += 1;
  return {
    allowed: false,
    state: STATE_OPEN,
    reason: "sumber_data_sedang_bermasalah",
    retryInMs: config.cooldownMs - sinceOpenedMs,
  };
}

function recordSuccess(key = "sipp_primary") {
  const circuit = getCircuit(key);
  const sebelumnya = circuit.state;
  circuit.consecutiveFailures = 0;
  circuit.lastSuccessAt = new Date().toISOString();
  circuit.state = STATE_CLOSED;
  circuit.openedAt = null;

  if (sebelumnya !== STATE_CLOSED) {
    void logService
      .logSystemEvent({
        eventType: "sipp_circuit_closed",
        severity: "info",
        message: "Sumber data perkara pulih; pengambilan data dilanjutkan.",
        metadata: { connectionKey: circuit.key, previousState: sebelumnya },
      })
      .catch(() => {});
  }
}

function recordFailure(key = "sipp_primary", error) {
  const circuit = getCircuit(key);

  // Galat query biasa tidak boleh menghentikan layanan bagi semua orang.
  if (!isDistressError(error)) return { state: circuit.state, counted: false };

  const config = getConfig();
  circuit.consecutiveFailures += 1;
  circuit.lastFailureAt = new Date().toISOString();
  circuit.lastErrorMessage = String((error && error.message) || error || "").slice(0, 200);

  const perluDibuka =
    circuit.state === STATE_HALF_OPEN || circuit.consecutiveFailures >= config.failureThreshold;

  if (perluDibuka && circuit.state !== STATE_OPEN) {
    circuit.state = STATE_OPEN;
    circuit.openedAt = Date.now();
    circuit.totalOpened += 1;
    void logService
      .logSystemEvent({
        eventType: "sipp_circuit_opened",
        severity: "error",
        message: "Pengambilan data perkara dihentikan sementara karena sumber datanya bermasalah.",
        metadata: {
          connectionKey: circuit.key,
          consecutiveFailures: circuit.consecutiveFailures,
          cooldownMs: config.cooldownMs,
          lastErrorMessage: circuit.lastErrorMessage,
        },
      })
      .catch(() => {});
  } else if (perluDibuka) {
    // Percobaan pemulihan gagal: masa tenang dihitung ulang dari sekarang.
    circuit.openedAt = Date.now();
  }

  return { state: circuit.state, counted: true };
}

/** Galat yang dilempar saat permintaan ditolak pemutus arus. */
function buildOpenCircuitError(key = "sipp_primary") {
  const circuit = getCircuit(key);
  const config = getConfig();
  const detik = Math.max(1, Math.round(((circuit.openedAt || 0) + config.cooldownMs - Date.now()) / 1000));
  const error = new Error(
    "Data perkara sedang tidak dapat diambil karena sumber datanya bermasalah. " +
      `Sistem mencoba lagi otomatis dalam sekitar ${detik} detik.`
  );
  error.code = "SIPP_CIRCUIT_OPEN";
  return error;
}

function getStatus() {
  const config = getConfig();
  return {
    ...config,
    circuits: [...circuits.values()].map((circuit) => ({
      key: circuit.key,
      state: circuit.state,
      consecutiveFailures: circuit.consecutiveFailures,
      openedAt: circuit.openedAt ? new Date(circuit.openedAt).toISOString() : null,
      lastFailureAt: circuit.lastFailureAt,
      lastSuccessAt: circuit.lastSuccessAt,
      lastErrorMessage: circuit.lastErrorMessage,
      totalOpened: circuit.totalOpened,
      totalRejected: circuit.totalRejected,
    })),
  };
}

function reset() {
  circuits.clear();
}

module.exports = {
  STATE_CLOSED,
  STATE_HALF_OPEN,
  STATE_OPEN,
  buildOpenCircuitError,
  canAttempt,
  getConfig,
  getStatus,
  isDistressError,
  recordFailure,
  recordSuccess,
  reset,
};
