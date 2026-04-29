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
};

let timer = null;

function getWorkerConfig() {
  const runtimeConfig = readRuntimeConfig();
  const worker = runtimeConfig.queueWorker || {};
  return {
    enabled: worker.enabled ?? runtimeConfig.queueWorkerEnabled ?? true,
    intervalMs: Math.max(5000, Number(worker.intervalMs || runtimeConfig.queueWorkerIntervalMs || 30000)),
    batchSize: Math.max(1, Math.min(50, Number(worker.batchSize || runtimeConfig.queueWorkerBatchSize || 5))),
  };
}

async function processOnce(sender) {
  const config = getWorkerConfig();
  state.enabled = Boolean(config.enabled);
  state.intervalMs = config.intervalMs;
  state.batchSize = config.batchSize;
  state.lastHeartbeatAt = new Date().toISOString();

  if (!state.enabled || state.running || state.paused) {
    return [];
  }

  state.running = true;
  try {
    const processed = await messageQueueService.processQueueBatch(state.batchSize, sender);
    state.lastBatchProcessed = processed.length;
    state.lastError = "";
    await logService.logSystemEvent({
      eventType: "queue_worker_heartbeat",
      severity: "info",
      message: "Worker queue ALETA Bot aktif.",
      metadata: { processed: processed.length, batchSize: state.batchSize },
    });
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

function startQueueWorker(sender) {
  if (timer) return getWorkerStatus();
  const config = getWorkerConfig();
  state.enabled = Boolean(config.enabled);
  state.intervalMs = config.intervalMs;
  state.batchSize = config.batchSize;
  state.startedAt = new Date().toISOString();

  timer = setInterval(() => {
    void processOnce(sender);
  }, state.intervalMs);

  if (timer.unref) timer.unref();
  void processOnce(sender);
  return getWorkerStatus();
}

function stopQueueWorker() {
  if (timer) {
    clearInterval(timer);
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
  return { ...state, activeTimer: Boolean(timer) };
}

module.exports = {
  startQueueWorker,
  stopQueueWorker,
  pauseWorker,
  resumeWorker,
  processOnce,
  getWorkerStatus,
};
