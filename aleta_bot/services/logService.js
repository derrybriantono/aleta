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
  const sentAt = data.sentAt || data.sent_at || (["sent", "delivered", "read"].includes(status) ? now : null);
  const deliveredAt = data.deliveredAt || data.delivered_at || (status === "delivered" ? now : null);
  const readAt = data.readAt || data.read_at || (status === "read" ? now : null);
  const failedAt = data.failedAt || data.failed_at || (status === "failed" ? now : null);
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
    whatsapp_message_id: data.whatsappMessageId || data.whatsapp_message_id || data.metadata?.whatsappMessageId || "",
    ack: data.ack === undefined || data.ack === null ? null : Number(data.ack),
    error_message: data.errorMessage || data.error_message || "",
    retry_count: Number(data.retryCount || data.retry_count || 0),
    sent_at: sentAt,
    delivered_at: deliveredAt,
    read_at: readAt,
    failed_at: failedAt,
    metadata_json: safeJson(data.metadata || data.metadata_json || {}),
    created_at: data.createdAt || data.created_at || now,
  };
}

async function insertMessageLog(record) {
  return withDbFallback("message", record, () =>
    botDb.query(
      `INSERT INTO aleta_bot_message_logs (
        id, queue_id, idempotency_key, notification_key, category, recipient_number,
        recipient_name, message_preview, status, whatsapp_message_id, ack,
        retry_count, error_message, sent_at, delivered_at, read_at, failed_at,
        metadata_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        record.whatsapp_message_id,
        record.ack,
        record.retry_count,
        record.error_message,
        record.sent_at ? botDb.toMysqlDate(record.sent_at) : null,
        record.delivered_at ? botDb.toMysqlDate(record.delivered_at) : null,
        record.read_at ? botDb.toMysqlDate(record.read_at) : null,
        record.failed_at ? botDb.toMysqlDate(record.failed_at) : null,
        record.metadata_json,
        botDb.toMysqlDate(record.created_at),
      ]
    )
  );
}

function logMessageAttempt(data) {
  return insertMessageLog(normalizeMessageRecord(data, data?.status || "sending"));
}

function logMessageQueued(data) {
  return insertMessageLog(normalizeMessageRecord(data, "queued"));
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

async function logPolicySkip(data = {}) {
  const now = new Date();
  const record = {
    id: data.id || createId("psk"),
    notification_key: data.notificationKey || data.notification_key || "",
    notification_id: data.notificationId || data.notification_id || null,
    category: data.category || "",
    reason: data.reason || "unknown",
    source_feature: data.sourceFeature || data.source_feature || "",
    entity_type: data.entityType || data.entity_type || "",
    entity_id: data.entityId || data.entity_id || "",
    recipient_type: data.recipientType || data.recipient_type || "",
    recipient_count: Number(data.recipientCount || data.recipient_count || 0),
    metadata_json: safeJson(data.metadata || {}),
    created_at: data.createdAt || data.created_at || now,
  };

  return withDbFallback("notification", record, () =>
    botDb.query(
      `INSERT INTO aleta_bot_policy_skip_logs (
        id, notification_key, notification_id, category, reason, source_feature,
        entity_type, entity_id, recipient_type, recipient_count, metadata_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        record.id,
        record.notification_key,
        record.notification_id,
        record.category,
        record.reason,
        record.source_feature,
        record.entity_type,
        record.entity_id,
        record.recipient_type,
        record.recipient_count,
        record.metadata_json,
        botDb.toMysqlDate(record.created_at),
      ]
    )
  );
}

async function getPolicySkipStats() {
  const dbReady = await botDb.ensureSchema();
  if (!dbReady) {
    return { skippedCount: 0, lastSkippedAt: null, reasons: {}, totalToday: 0, topNotifications: [], recent: [] };
  }
  const [totalRows, todayRows, lastRows, reasonRows, notificationRows, recentRows] = await Promise.all([
    botDb.query(`SELECT COUNT(*) AS count FROM aleta_bot_policy_skip_logs`),
    botDb.query(`SELECT COUNT(*) AS count FROM aleta_bot_policy_skip_logs WHERE DATE(created_at) = CURDATE()`),
    botDb.query(`SELECT created_at FROM aleta_bot_policy_skip_logs ORDER BY created_at DESC LIMIT 1`),
    botDb.query(
      `SELECT reason, COUNT(*) AS count
       FROM aleta_bot_policy_skip_logs
       GROUP BY reason
       ORDER BY COUNT(*) DESC, reason ASC
       LIMIT 8`
    ),
    botDb.query(
      `SELECT notification_key, COUNT(*) AS count
       FROM aleta_bot_policy_skip_logs
       GROUP BY notification_key
       ORDER BY COUNT(*) DESC, notification_key ASC
       LIMIT 8`
    ),
    botDb.query(
      `SELECT id, notification_key, notification_id, category, reason, source_feature,
        entity_type, entity_id, recipient_type, recipient_count, created_at
       FROM aleta_bot_policy_skip_logs
       ORDER BY created_at DESC
       LIMIT 12`
    ),
  ]);
  const reasons = {};
  for (const row of reasonRows || []) {
    reasons[row.reason || "unknown"] = Number(row.count || 0);
  }
  return {
    skippedCount: Number(totalRows?.[0]?.count || 0),
    totalToday: Number(todayRows?.[0]?.count || 0),
    lastSkippedAt: lastRows?.[0]?.created_at || null,
    reasons,
    topNotifications: (notificationRows || []).map((row) => ({
      notificationKey: row.notification_key || "",
      count: Number(row.count || 0),
    })),
    recent: recentRows || [],
  };
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
    `SELECT id FROM aleta_bot_message_logs WHERE idempotency_key = ? AND status IN ('sent', 'delivered', 'read') LIMIT 1`,
    [idempotencyKey]
  );
  return Array.isArray(rows) && rows.length > 0;
}

async function getMessageStatsToday() {
  const dbReady = await botDb.ensureSchema();
  if (!dbReady) {
    return { total: 0, queued: 0, sent: 0, delivered: 0, read: 0, failed: 0, skipped: 0, dry_run: 0, sending: 0, pending: 0 };
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
    { total: 0, queued: 0, sent: 0, delivered: 0, read: 0, failed: 0, skipped: 0, dry_run: 0, sending: 0, pending: 0 }
  );
}

function mapWhatsappAck(ack) {
  const value = Number(ack);
  if (!Number.isFinite(value)) return { status: "sent", label: "ack_unknown" };
  if (value < 0) return { status: "failed", failedAt: new Date(), label: "ack_error" };
  if (value >= 3) return { status: "read", readAt: new Date(), deliveredAt: new Date(), label: "read" };
  if (value >= 2) return { status: "delivered", deliveredAt: new Date(), label: "delivered" };
  if (value >= 1) return { status: "sent", label: "server_sent" };
  return { status: "sent", label: "pending_device_ack" };
}

const STATUS_RANK = {
  queued: 10,
  pending: 10,
  sending: 20,
  sent: 30,
  success: 30,
  delivered: 40,
  read: 50,
  failed: 60,
};

async function updateMessageAck(data = {}) {
  const whatsappMessageId = String(data.whatsappMessageId || data.whatsapp_message_id || "").trim();
  if (!whatsappMessageId) return null;
  const dbReady = await botDb.ensureSchema();
  if (!dbReady) return null;

  const rawAckValue = Number(data.ack);
  const ackValue = Number.isFinite(rawAckValue) ? rawAckValue : null;
  const mapped = mapWhatsappAck(ackValue);
  const now = new Date();
  const rows = await botDb.query(
    `SELECT id, queue_id, status, delivered_at, read_at, metadata_json
     FROM aleta_bot_message_logs
     WHERE whatsapp_message_id = ?
     ORDER BY created_at DESC
     LIMIT 1`,
    [whatsappMessageId]
  );
  const row = rows?.[0];
  if (!row) {
    return logWhatsappEvent({
      eventType: "message_ack_unmatched",
      severity: "info",
      message: "ACK WhatsApp diterima tetapi log pesan belum ditemukan.",
      metadata: { whatsappMessageId, ack: ackValue, ackLabel: mapped.label },
    });
  }

  const currentRank = STATUS_RANK[row.status] || 0;
  const mappedRank = STATUS_RANK[mapped.status] || 0;
  const nextStatus = currentRank > mappedRank && row.status !== "failed" ? row.status : mapped.status;
  const nextDeliveredAt = mapped.deliveredAt ? (row.delivered_at || botDb.toMysqlDate(mapped.deliveredAt)) : row.delivered_at;
  const nextReadAt = mapped.readAt ? (row.read_at || botDb.toMysqlDate(mapped.readAt)) : row.read_at;
  const nextFailedAt = mapped.failedAt ? botDb.toMysqlDate(mapped.failedAt) : null;
  const previousMetadata = (() => {
    try {
      return JSON.parse(row.metadata_json || "{}");
    } catch {
      return {};
    }
  })();
  const metadataJson = safeJson({
    ...previousMetadata,
    whatsappAck: ackValue,
    whatsappAckLabel: mapped.label,
    whatsappAckAt: now.toISOString(),
  });

  await botDb.query(
    `UPDATE aleta_bot_message_logs
     SET status = ?,
         ack = ?,
         delivered_at = COALESCE(delivered_at, ?),
         read_at = COALESCE(read_at, ?),
         failed_at = COALESCE(failed_at, ?),
         error_message = CASE WHEN ? = 'failed' THEN 'whatsapp_ack_failed' ELSE error_message END,
         metadata_json = ?
     WHERE id = ?`,
    [
      nextStatus,
      ackValue,
      nextDeliveredAt,
      nextReadAt,
      nextFailedAt,
      nextStatus,
      metadataJson,
      row.id,
    ]
  );

  if (row.queue_id) {
    await botDb.query(
      `UPDATE aleta_bot_message_queue
       SET status = CASE WHEN status IN ('failed', 'resolved', 'dry_run', 'skipped') THEN status ELSE ? END,
           whatsapp_message_id = CASE WHEN whatsapp_message_id = '' THEN ? ELSE whatsapp_message_id END,
           ack = ?,
           delivered_at = COALESCE(delivered_at, ?),
           read_at = COALESCE(read_at, ?),
           updated_at = ?
       WHERE id = ?`,
      [
        nextStatus,
        whatsappMessageId,
        ackValue,
        nextDeliveredAt,
        nextReadAt,
        botDb.toMysqlDate(now),
        row.queue_id,
      ]
    );
  }

  return logWhatsappEvent({
    eventType: "message_ack_updated",
    severity: "info",
    message: `Status WhatsApp diperbarui: ${mapped.label}.`,
    metadata: { whatsappMessageId, ack: ackValue, queueId: row.queue_id || "", status: nextStatus },
  });
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
  const safeLimit = Math.max(1, Math.min(5001, Number(limit || 50)));
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
  logMessageQueued,
  logMessageSent,
  logMessageFailed,
  logMessageSkipped,
  logSystemEvent,
  logWhatsappEvent,
  logNotificationRun,
  logPolicySkip,
  getPolicySkipStats,
  logQueryError,
  logSecurityEvent,
  hasSentIdempotencyKey,
  updateMessageAck,
  getMessageStatsToday,
  getSystemStatsToday,
  getRecentLogs,
};
