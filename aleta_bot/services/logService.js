const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const botDb = require("./botDbService");

const dataDir = path.resolve(__dirname, "..", "data");
const fallbackFiles = {
  message: path.join(dataDir, "aleta-bot-message-logs.jsonl"),
  system: path.join(dataDir, "aleta-bot-system-logs.jsonl"),
  whatsapp: path.join(dataDir, "aleta-bot-whatsapp-events.jsonl"),
  notification: path.join(dataDir, "aleta-bot-notification-runs.jsonl"),
  query: path.join(dataDir, "aleta-bot-query-errors.jsonl"),
  security: path.join(dataDir, "aleta-bot-security-events.jsonl"),
};

function createId(prefix) {
  const random = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(12).toString("hex");
  return `${prefix}_${random}`;
}

function previewMessage(message) {
  if (typeof message === "string") {
    return message.replace(/\s+/g, " ").slice(0, 240);
  }
  return "[media/non-text message]";
}

function sanitizeMetadata(metadata) {
  if (!metadata || typeof metadata !== "object") return {};
  const copy = { ...metadata };
  for (const key of Object.keys(copy)) {
    if (/password|secret|token|apikey|api_key|authorization/i.test(key)) {
      copy[key] = "[redacted]";
    }
  }
  return copy;
}

function safeJson(value) {
  return JSON.stringify(sanitizeMetadata(value || {}));
}

function ensureDataDir() {
  fs.mkdirSync(dataDir, { recursive: true });
}

function appendFallback(filePath, record) {
  ensureDataDir();
  fs.appendFileSync(filePath, `${JSON.stringify(record)}\n`, "utf8");
  return record;
}

async function withDbFallback(fileKey, record, writer) {
  try {
    const dbReady = await botDb.ensureSchema();
    if (dbReady) {
      await writer();
      return record;
    }
  } catch (error) {
    record.db_error = error.message;
  }

  appendFallback(fallbackFiles[fileKey] || fallbackFiles.system, record);
  return record;
}

function normalizeMessageRecord(data = {}, status) {
  const now = new Date();
  return {
    id: data.id || createId("msg"),
    queue_id: data.queueId || data.queue_id || data.metadata?.queueId || null,
    notification_key: data.notificationKey || data.notification_key || "",
    idempotency_key: data.idempotencyKey || data.idempotency_key || "",
    category: data.category || "system",
    recipient_number: data.recipientNumber || data.recipient_number || "",
    recipient_name: data.recipientName || data.recipient_name || "",
    message_preview: data.messagePreview || data.message_preview || previewMessage(data.message),
    status,
    error_message: data.errorMessage || data.error_message || "",
    retry_count: Number(data.retryCount || data.retry_count || 0),
    sent_at: status === "sent" ? now : data.sentAt || data.sent_at || null,
    metadata_json: safeJson(data.metadata || data.metadata_json || {}),
    created_at: data.createdAt || data.created_at || now,
  };
}

async function insertMessageLog(record) {
  return withDbFallback("message", record, () =>
    botDb.query(
      `INSERT INTO aleta_bot_message_logs (
        id, queue_id, idempotency_key, notification_key, category, recipient_number,
        recipient_name, message_preview, status, retry_count, error_message, sent_at,
        metadata_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        record.id,
        record.queue_id,
        record.idempotency_key,
        record.notification_key,
        record.category,
        record.recipient_number,
        record.recipient_name,
        record.message_preview,
        record.status,
        record.retry_count,
        record.error_message,
        record.sent_at ? botDb.toMysqlDate(record.sent_at) : null,
        record.metadata_json,
        botDb.toMysqlDate(record.created_at),
      ]
    )
  );
}

function logMessageAttempt(data) {
  return insertMessageLog(normalizeMessageRecord(data, data?.status || "sending"));
}

function logMessageSent(data) {
  return insertMessageLog(normalizeMessageRecord(data, "sent"));
}

function logMessageFailed(data) {
  return insertMessageLog(normalizeMessageRecord(data, "failed"));
}

function logMessageSkipped(data) {
  return insertMessageLog(normalizeMessageRecord(data, data?.status || "skipped"));
}

function normalizeSystemRecord(prefix, data = {}) {
  const now = new Date();
  return {
    id: data.id || createId(prefix),
    event_type: data.eventType || data.event_type || "event",
    severity: data.severity || "info",
    message: data.message || "",
    source: data.source || "aleta_bot",
    metadata_json: safeJson(data.metadata || {}),
    created_at: data.createdAt || data.created_at || now,
  };
}

async function insertSystemLog(fileKey, prefix, data = {}) {
  const record = normalizeSystemRecord(prefix, data);
  return withDbFallback(fileKey, record, () =>
    botDb.query(
      `INSERT INTO aleta_bot_system_logs (id, event_type, severity, message, source, metadata_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        record.id,
        record.event_type,
        record.severity,
        record.message,
        record.source,
        record.metadata_json,
        botDb.toMysqlDate(record.created_at),
      ]
    )
  );
}

function logSystemEvent(data) {
  return insertSystemLog("system", "sys", data);
}

function logWhatsappEvent(data) {
  return insertSystemLog("whatsapp", "wa", { ...data, source: "whatsapp" });
}

async function logNotificationRun(data = {}) {
  const now = new Date();
  const record = {
    id: data.id || createId("run"),
    notification_key: data.notificationKey || data.notification_key || "",
    category: data.category || "system",
    status: data.status || "running",
    total_targets: Number(data.totalTargets || data.total_targets || 0),
    queued_count: Number(data.queuedCount || data.queued_count || 0),
    sent_count: Number(data.sentCount || data.sent_count || 0),
    failed_count: Number(data.failedCount || data.failed_count || 0),
    skipped_count: Number(data.skippedCount || data.skipped_count || 0),
    started_at: data.startedAt || data.started_at || now,
    finished_at: data.finishedAt || data.finished_at || null,
    error_message: data.errorMessage || data.error_message || "",
    metadata_json: safeJson(data.metadata || {}),
    created_at: data.createdAt || data.created_at || now,
  };

  return withDbFallback("notification", record, () =>
    botDb.query(
      `INSERT INTO aleta_bot_notification_runs (
        id, notification_key, category, status, total_targets, queued_count,
        sent_count, failed_count, skipped_count, started_at, finished_at,
        error_message, metadata_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        record.id,
        record.notification_key,
        record.category,
        record.status,
        record.total_targets,
        record.queued_count,
        record.sent_count,
        record.failed_count,
        record.skipped_count,
        botDb.toMysqlDate(record.started_at),
        record.finished_at ? botDb.toMysqlDate(record.finished_at) : null,
        record.error_message,
        record.metadata_json,
        botDb.toMysqlDate(record.created_at),
      ]
    )
  );
}

function logQueryError(data) {
  return insertSystemLog("query", "qry", { ...data, severity: data?.severity || "error", source: "query" });
}

function logSecurityEvent(data) {
  return insertSystemLog("security", "sec", { ...data, severity: data?.severity || "warning", source: "security" });
}

async function hasSentIdempotencyKey(idempotencyKey) {
  if (!idempotencyKey) return false;
  const dbReady = await botDb.ensureSchema();
  if (!dbReady) return false;
  const rows = await botDb.query(
    `SELECT id FROM aleta_bot_message_logs WHERE idempotency_key = ? AND status = 'sent' LIMIT 1`,
    [idempotencyKey]
  );
  return Array.isArray(rows) && rows.length > 0;
}

async function getMessageStatsToday() {
  const dbReady = await botDb.ensureSchema();
  if (!dbReady) {
    return { total: 0, sent: 0, failed: 0, skipped: 0, dry_run: 0, sending: 0, pending: 0 };
  }
  const rows = await botDb.query(
    `SELECT status, COUNT(*) AS count
     FROM aleta_bot_message_logs
     WHERE DATE(created_at) = CURDATE()
     GROUP BY status`
  );
  return rows.reduce(
    (stats, row) => {
      const count = Number(row.count || 0);
      stats.total += count;
      stats[row.status] = count;
      return stats;
    },
    { total: 0, sent: 0, failed: 0, skipped: 0, dry_run: 0, sending: 0, pending: 0 }
  );
}

async function getSystemStatsToday() {
  const dbReady = await botDb.ensureSchema();
  if (!dbReady) return { total: 0, info: 0, warning: 0, error: 0, critical: 0 };
  const rows = await botDb.query(
    `SELECT severity, COUNT(*) AS count
     FROM aleta_bot_system_logs
     WHERE DATE(created_at) = CURDATE()
     GROUP BY severity`
  );
  return rows.reduce(
    (stats, row) => {
      const count = Number(row.count || 0);
      stats.total += count;
      stats[row.severity] = count;
      return stats;
    },
    { total: 0, info: 0, warning: 0, error: 0, critical: 0 }
  );
}

async function getRecentLogs(type = "message", limit = 50) {
  const safeLimit = Math.max(1, Math.min(100, Number(limit || 50)));
  const dbReady = await botDb.ensureSchema();
  if (!dbReady) return [];

  if (type === "message") {
    return botDb.query(`SELECT * FROM aleta_bot_message_logs ORDER BY created_at DESC LIMIT ?`, [safeLimit]);
  }
  if (type === "notification") {
    return botDb.query(`SELECT * FROM aleta_bot_notification_runs ORDER BY created_at DESC LIMIT ?`, [safeLimit]);
  }

  const source = type === "whatsapp" ? "whatsapp" : type === "security" ? "security" : type === "query" ? "query" : null;
  if (source) {
    return botDb.query(`SELECT * FROM aleta_bot_system_logs WHERE source = ? ORDER BY created_at DESC LIMIT ?`, [source, safeLimit]);
  }
  return botDb.query(`SELECT * FROM aleta_bot_system_logs ORDER BY created_at DESC LIMIT ?`, [safeLimit]);
}

module.exports = {
  files: fallbackFiles,
  logMessageAttempt,
  logMessageSent,
  logMessageFailed,
  logMessageSkipped,
  logSystemEvent,
  logWhatsappEvent,
  logNotificationRun,
  logQueryError,
  logSecurityEvent,
  hasSentIdempotencyKey,
  getMessageStatsToday,
  getSystemStatsToday,
  getRecentLogs,
};
