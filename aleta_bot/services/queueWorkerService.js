const { readRuntimeConfig } = require("../config/runtime-config");
const messageQueueService = require("./messageQueueService");
const logService = require("./logService");

const state = {
  enabled: false,
  running: false,
  paused: false,
  intervalMs: 30000,
  batchSize: 5,
  lastHeartbeatAt: null,
  lastBatchProcessed: 0,
  lastError: "",
  startedAt: null,
  pausedAt: null,
  pauseReason: "",
  sendingWindow: null,
  lastStaleRecovery: null,
  lastHeartbeatLogAt: null,
};

let timer = null;
let timerActive = false;
const HEARTBEAT_LOG_INTERVAL_MS = 5 * 60 * 1000;

function normalizeBatchSize(value) {
  return Math.max(1, Math.min(50, Number(value || 5)));
}

function getWorkerConfig() {
  const runtimeConfig = readRuntimeConfig();
  const worker = runtimeConfig.queueWorker || {};
  return {
    enabled: worker.enabled ?? runtimeConfig.queueWorkerEnabled ?? true,
    intervalMs: Math.max(5000, Number(worker.intervalMs || runtimeConfig.queueWorkerIntervalMs || 30000)),
    batchSize: normalizeBatchSize(worker.batchSize || runtimeConfig.queueWorkerBatchSize || 5),
  };
}

async function processOnce(sender, options = {}) {
  const config = getWorkerConfig();
  const processLimit = normalizeBatchSize(options.limit || config.batchSize);
  state.enabled = Boolean(config.enabled);
  state.intervalMs = config.intervalMs;
  state.batchSize = config.batchSize;
  state.lastHeartbeatAt = new Date().toISOString();
  state.sendingWindow = messageQueueService.getSendingWindowState();

  if (!state.enabled || state.paused) {
    return [];
  }

  if (state.running) {
    if (options.retryWhenBusy !== false) {
      const retryTimer = setTimeout(() => {
        void processOnce(sender, { ...options, retryWhenBusy: false });
      }, 1000);
      if (retryTimer.unref) retryTimer.unref();
    }
    return [];
  }

  state.running = true;
  try {
    const staleRecovery = await messageQueueService.recoverStaleProcessingMessages({
      reason: options.reason || options.trigger || "interval",
    });
    state.lastStaleRecovery = staleRecovery;
    const processed = await messageQueueService.processQueueBatch(processLimit, sender);
    state.lastBatchProcessed = processed.length;
    state.lastError = "";
    const trigger = options.reason || options.trigger || "interval";
    const recoveredStale = Number(staleRecovery?.recovered || 0) + Number(staleRecovery?.failed || 0);
    const heartbeatAgeMs = state.lastHeartbeatLogAt
      ? Date.now() - new Date(state.lastHeartbeatLogAt).getTime()
      : Number.MAX_SAFE_INTEGER;
    const shouldLogHeartbeat =
      processed.length > 0 ||
      recoveredStale > 0 ||
      trigger !== "interval" ||
      heartbeatAgeMs >= HEARTBEAT_LOG_INTERVAL_MS;
    if (shouldLogHeartbeat) {
      state.lastHeartbeatLogAt = new Date().toISOString();
      await logService.logSystemEvent({
        eventType: "queue_worker_heartbeat",
        severity: "info",
        message: "Worker queue ALETA Bot aktif.",
        metadata: {
          processed: processed.length,
          batchSize: processLimit,
          staleRecovery,
          trigger,
        },
      });
    }
    return processed;
  } catch (error) {
    state.lastError = error.message;
    await logService.logSystemEvent({
      eventType: "queue_worker_error",
      severity: "error",
      message: "Worker queue ALETA Bot gagal memproses batch.",
      metadata: { errorMessage: error.message },
    });
    return [];
  } finally {
    state.running = false;
  }
}

function processNow(sender, options = {}) {
  return processOnce(sender, {
    ...options,
    reason: options.reason || "manual_trigger",
  });
}

/**
 * Menjadwalkan tik worker berikutnya memakai interval TERBARU.
 *
 * Sebelumnya interval dikunci sekali saat start memakai setInterval, sehingga
 * perubahan Mode Risiko dari portal (yang menurunkan/menaikkan intervalMs) baru
 * berlaku setelah bot direstart. Dengan setTimeout berantai, setiap tik membaca
 * ulang konfigurasi — mode aman langsung berlaku saat digeser.
 */
function scheduleNextTick(sender) {
  if (!timerActive) return;
  const config = getWorkerConfig();
  state.intervalMs = config.intervalMs;
  timer = setTimeout(() => {
    void processOnce(sender).finally(() => scheduleNextTick(sender));
  }, config.intervalMs);
  if (timer.unref) timer.unref();
}

function startQueueWorker(sender) {
  if (timerActive) return getWorkerStatus();
  const config = getWorkerConfig();
  state.enabled = Boolean(config.enabled);
  state.intervalMs = config.intervalMs;
  state.batchSize = config.batchSize;
  state.startedAt = new Date().toISOString();

  timerActive = true;
  scheduleNextTick(sender);
  void processOnce(sender);
  return getWorkerStatus();
}

function stopQueueWorker() {
  timerActive = false;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  state.enabled = false;
  return getWorkerStatus();
}

function pauseWorker(reason = "") {
  state.paused = true;
  state.pausedAt = new Date().toISOString();
  state.pauseReason = String(reason || "Dijeda manual oleh admin.").slice(0, 200);
  void logService.logSystemEvent({
    eventType: "queue_worker_paused",
    severity: "warning",
    message: "Worker queue ALETA Bot dijeda.",
    metadata: { reason: state.pauseReason },
  });
  return getWorkerStatus();
}

function resumeWorker() {
  state.paused = false;
  state.pausedAt = null;
  state.pauseReason = "";
  void logService.logSystemEvent({
    eventType: "queue_worker_resumed",
    severity: "info",
    message: "Worker queue ALETA Bot dilanjutkan.",
    metadata: {},
  });
  return getWorkerStatus();
}

function getWorkerStatus() {
  return { ...state, activeTimer: timerActive };
}

module.exports = {
  startQueueWorker,
  stopQueueWorker,
  pauseWorker,
  resumeWorker,
  processOnce,
  processNow,
  getWorkerStatus,
};
