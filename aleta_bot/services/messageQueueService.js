const crypto = require("crypto");
const { readRuntimeConfig } = require("../config/runtime-config");
const botDb = require("./botDbService");
const logService = require("./logService");
const { getMessagePreview } = require("./messageService");
const whatsappStatusService = require("./whatsappStatusService");

function createId() {
  return crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(12).toString("hex");
}

function parseClockToMinutes(value, fallback) {
  const match = String(value || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return fallback;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return fallback;
  }
  return hours * 60 + minutes;
}

function getSendingWindowState(now = new Date()) {
  const runtimeConfig = readRuntimeConfig();
  const config = runtimeConfig.sendingWindow || {};
  const enabled = config.enabled !== false;
  const start = String(config.start || "07:30");
  const end = String(config.end || "21:00");
  const startMinutes = parseClockToMinutes(start, 7 * 60 + 30);
  const endMinutes = parseClockToMinutes(end, 21 * 60);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const inside =
    !enabled ||
    (startMinutes <= endMinutes
      ? currentMinutes >= startMinutes && currentMinutes <= endMinutes
      : currentMinutes >= startMinutes || currentMinutes <= endMinutes);

  return {
    enabled,
    start,
    end,
    inside,
    allowed: inside,
    message: inside
      ? "Pengiriman berada dalam jam aman."
      : `Di luar jam aman (${start}-${end}). Pesan normal ditahan di antrean.`,
  };
}

async function enqueueMessage(data = {}) {
  await botDb.ensureSchema();
  const now = new Date();
  const idempotencyKey = data.idempotencyKey || data.idempotency_key || "";

  if (idempotencyKey) {
    const existing = await botDb.query(
      `SELECT * FROM aleta_bot_message_queue
       WHERE idempotency_key = ? AND status IN ('pending', 'processing', 'sent', 'dry_run', 'skipped')
       ORDER BY created_at DESC
       LIMIT 1`,
      [idempotencyKey]
    );
    if (existing.length > 0) return existing[0];
  }

  const item = {
    id: data.id || createId(),
    idempotency_key: idempotencyKey,
    recipient_number: data.recipientNumber || data.recipient_number || data.to || "",
    recipient_name: data.recipientName || data.recipient_name || "",
    message_body: data.message || data.messageBody || "",
    message_preview: data.messagePreview || getMessagePreview(data.message || data.messageBody || ""),
    category: data.category || "manual",
    notification_key: data.notificationKey || data.notification_key || "",
    priority: Number(data.priority || 5),
    status: "pending",
    retry_count: Number(data.retryCount || 0),
    max_retries: Number(data.maxRetries ?? data.max_retries ?? 0),
    scheduled_at: data.scheduledAt || data.scheduled_at || now,
    processed_at: null,
    last_error: "",
    source_app: data.sourceApp || data.source_app || "",
    source_feature: data.sourceFeature || data.source_feature || "",
    entity_type: data.entityType || data.entity_type || "",
    entity_id: data.entityId || data.entity_id || "",
    metadata_json: JSON.stringify(data.metadata || {}),
    created_at: now,
    updated_at: now,
  };

  await botDb.query(
    `INSERT INTO aleta_bot_message_queue (
      id, idempotency_key, notification_key, category, recipient_number, recipient_name,
      message_body, message_preview, priority, status, retry_count, max_retries,
      scheduled_at, processed_at, last_error,
      source_app, source_feature, entity_type, entity_id,
      metadata_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      item.id,
      item.idempotency_key,
      item.notification_key,
      item.category,
      item.recipient_number,
      item.recipient_name,
      item.message_body,
      item.message_preview,
      item.priority,
      item.status,
      item.retry_count,
      item.max_retries,
      botDb.toMysqlDate(item.scheduled_at),
      null,
      item.last_error,
      item.source_app,
      item.source_feature,
      item.entity_type,
      item.entity_id,
      item.metadata_json,
      botDb.toMysqlDate(item.created_at),
      botDb.toMysqlDate(item.updated_at),
    ]
  );

  await logService.logMessageAttempt({
    queueId: item.id,
    idempotencyKey: item.idempotency_key,
    category: item.category,
    notificationKey: item.notification_key,
    recipientNumber: item.recipient_number,
    recipientName: item.recipient_name,
    messagePreview: item.message_preview,
    status: "pending",
  });

  return item;
}

async function updateItem(id, updates) {
  const fields = [];
  const params = [];
  for (const [key, value] of Object.entries(updates)) {
    fields.push(`${key} = ?`);
    params.push(key.endsWith("_at") && value ? botDb.toMysqlDate(value) : value);
  }
  fields.push("updated_at = ?");
  params.push(botDb.toMysqlDate(new Date()));
  params.push(id);
  await botDb.query(`UPDATE aleta_bot_message_queue SET ${fields.join(", ")} WHERE id = ?`, params);
  const rows = await botDb.query(`SELECT * FROM aleta_bot_message_queue WHERE id = ? LIMIT 1`, [id]);
  return rows[0] || null;
}

function markSent(id) {
  return updateItem(id, { status: "sent", processed_at: new Date(), last_error: "" });
}

function markFailed(id, error) {
  return updateItem(id, {
    status: "failed",
    processed_at: new Date(),
    last_error: error && error.message ? error.message : String(error || "failed"),
  });
}

function markSkipped(id, reason) {
  return updateItem(id, {
    status: "skipped",
    processed_at: new Date(),
    last_error: reason || "skipped",
  });
}

function markDryRun(id) {
  return updateItem(id, {
    status: "dry_run",
    processed_at: new Date(),
    last_error: "",
  });
}

async function markPendingRetry(id, retryCount, nextScheduledAt, error) {
  return updateItem(id, {
    status: "pending",
    retry_count: retryCount,
    scheduled_at: nextScheduledAt,
    last_error: error && error.message ? error.message : String(error || "retry_scheduled"),
  });
}

async function claimNextMessage() {
  await botDb.ensureSchema();
  const sendingWindow = getSendingWindowState();
  const categoryGuard = sendingWindow.allowed ? "" : "AND category IN ('system', 'critical')";
  const rows = await botDb.query(
    `SELECT *
     FROM aleta_bot_message_queue
     WHERE status = 'pending' AND scheduled_at <= NOW()
       ${categoryGuard}
     ORDER BY priority ASC, scheduled_at ASC, created_at ASC
     LIMIT 1`
  );
  const item = rows[0];
  if (!item) return null;

  const result = await botDb.query(
    `UPDATE aleta_bot_message_queue
     SET status = 'processing', updated_at = NOW()
     WHERE id = ? AND status = 'pending'`,
    [item.id]
  );
  if (!result || result.affectedRows === 0) return null;
  return { ...item, status: "processing" };
}

async function processNextMessage(sender) {
  const item = await claimNextMessage();
  if (!item) return null;

  try {
    const metadata = item.metadata_json ? JSON.parse(item.metadata_json) : {};
    const result = await sender({
      to: item.recipient_number,
      message: item.message_body,
      category: item.category,
      notificationKey: item.notification_key,
      recipientName: item.recipient_name,
      idempotencyKey: item.idempotency_key,
      metadata: { ...metadata, queueId: item.id },
      dryRun: metadata.dryRun === true,
    });

    if (metadata.dryRun === true) {
      await markDryRun(item.id);
    } else if (result === null) {
      await markSkipped(item.id, "sender_returned_null");
    } else {
      await markSent(item.id);
      whatsappStatusService.recordMessageSent();
    }
    return item;
  } catch (error) {
    const nextRetryCount = Number(item.retry_count || 0) + 1;
    if (nextRetryCount <= Number(item.max_retries || 0)) {
      const backoffMs = Math.min(15 * 60 * 1000, 30 * 1000 * nextRetryCount);
      await markPendingRetry(item.id, nextRetryCount, new Date(Date.now() + backoffMs), error);
    } else {
      await markFailed(item.id, error);
    }
    await logService.logSystemEvent({
      eventType: "queue_item_failed",
      severity: "error",
      message: "Queue item ALETA Bot gagal diproses.",
      metadata: { queueId: item.id, errorMessage: error.message },
    });
    return item;
  }
}

async function processQueueBatch(limit = 10, sender) {
  const processed = [];
  for (let index = 0; index < limit; index += 1) {
    const item = await processNextMessage(sender);
    if (!item) break;
    processed.push(item);
  }
  return processed;
}

async function getQueueStats() {
  await botDb.ensureSchema();
  const rows = await botDb.query(`SELECT status, COUNT(*) AS count FROM aleta_bot_message_queue GROUP BY status`);
  return rows.reduce(
    (stats, row) => {
      const count = Number(row.count || 0);
      stats.total += count;
      stats[row.status] = count;
      return stats;
    },
    { total: 0, pending: 0, processing: 0, sent: 0, failed: 0, skipped: 0, dry_run: 0, dead_letter: 0, resolved: 0 }
  );
}

async function getDeadLetters(limit = 50, options = {}) {
  await botDb.ensureSchema();
  const safeLimit = Math.max(1, Math.min(200, Number(limit || 50)));
  const statusFilter = String(options.status || "active").toLowerCase();
  const whereClause =
    statusFilter === "resolved"
      ? "status = 'resolved'"
      : statusFilter === "all"
        ? "((status = 'failed' AND retry_count >= max_retries) OR status = 'resolved')"
        : "status = 'failed' AND retry_count >= max_retries";
  const rows = await botDb.query(
    `SELECT id, idempotency_key, recipient_number, recipient_name, message_preview,
       category, notification_key, priority, status, retry_count, max_retries,
       last_error, source_app, source_feature, entity_type, entity_id,
       scheduled_at, processed_at, resolved_at, resolved_by, resolved_note, created_at, updated_at
     FROM aleta_bot_message_queue
     WHERE ${whereClause}
     ORDER BY updated_at DESC
     LIMIT ?`,
    [safeLimit]
  );
  return rows.map(toPublicQueueItem);
}

function maskRecipientNumber(value) {
  const text = String(value || "").replace(/@c\.us$/i, "");
  const digits = text.replace(/\D/g, "");
  if (digits.length < 6) return "";
  return `${digits.slice(0, 4)}******${digits.slice(-2)}`;
}

async function requeueDeadLetter(id) {
  await botDb.ensureSchema();
  const rows = await botDb.query(
    `SELECT * FROM aleta_bot_message_queue WHERE id = ? AND status = 'failed' LIMIT 1`,
    [id]
  );
  const item = rows[0];
  if (!item) return null;

  const newId = createId();
  const now = new Date();
  const idempotencyKey = `requeue:${newId}:${Date.now()}`;

  await botDb.query(
    `INSERT INTO aleta_bot_message_queue (
      id, idempotency_key, notification_key, category, recipient_number, recipient_name,
      message_body, message_preview, priority, status, retry_count, max_retries,
      scheduled_at, processed_at, last_error,
      source_app, source_feature, entity_type, entity_id,
      metadata_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, 0, ?, NULL, '', ?, ?, ?, ?, ?, ?, ?)`,
    [
      newId,
      idempotencyKey,
      item.notification_key || "",
      item.category || "manual",
      item.recipient_number,
      item.recipient_name || "",
      item.message_body,
      item.message_preview || "",
      Number(item.priority || 5),
      botDb.toMysqlDate(now),
      item.source_app || "",
      item.source_feature || "",
      item.entity_type || "",
      item.entity_id || "",
      item.metadata_json || "{}",
      botDb.toMysqlDate(now),
      botDb.toMysqlDate(now),
    ]
  );

  await logService.logSystemEvent({
    eventType: "dead_letter_requeued",
    severity: "info",
    message: "Dead letter ALETA Bot di-requeue oleh admin.",
    metadata: { originalId: id, newId, recipientNumber: maskRecipientNumber(item.recipient_number) },
  });

  return { originalId: id, newId, status: "pending" };
}

async function resolveDeadLetter(id, input = {}) {
  await botDb.ensureSchema();
  const rows = await botDb.query(
    `SELECT * FROM aleta_bot_message_queue
     WHERE id = ? AND status = 'failed' AND retry_count >= max_retries
     LIMIT 1`,
    [id]
  );
  const item = rows[0];
  if (!item) return null;

  const now = new Date();
  const resolvedAt = botDb.toMysqlDate(now);
  const resolvedBy = String(input.resolvedBy || "internal").slice(0, 191);
  const resolvedNote = String(input.note || "").slice(0, 1000);

  await botDb.query(
    `UPDATE aleta_bot_message_queue
     SET status = 'resolved',
         resolved_at = ?,
         resolved_by = ?,
         resolved_note = ?,
         updated_at = ?
     WHERE id = ? AND status = 'failed'`,
    [resolvedAt, resolvedBy, resolvedNote, resolvedAt, id]
  );

  await logService.logSystemEvent({
    eventType: "dead_letter_resolved",
    severity: "info",
    message: "Dead letter ALETA Bot ditandai ditangani tanpa resend.",
    metadata: {
      originalId: id,
      resolvedBy,
      notePreview: resolvedNote.slice(0, 160),
      recipientNumber: maskRecipientNumber(item.recipient_number),
    },
  });

  return toPublicQueueItem({
    ...item,
    status: "resolved",
    resolved_at: resolvedAt,
    resolved_by: resolvedBy,
    resolved_note: resolvedNote,
    updated_at: resolvedAt,
  });
}

function toPublicQueueItem(row = {}) {
  return {
    id: row.id,
    idempotencyKey: row.idempotency_key || "",
    notificationKey: row.notification_key || "",
    category: row.category || "",
    recipientNumber: maskRecipientNumber(row.recipient_number),
    recipientName: row.recipient_name || "",
    messagePreview: row.message_preview || "",
    priority: Number(row.priority || 0),
    status: row.status || "",
    retryCount: Number(row.retry_count || 0),
    maxRetries: Number(row.max_retries || 0),
    lastError: String(row.last_error || "").slice(0, 500),
    sourceApp: row.source_app || "",
    sourceFeature: row.source_feature || "",
    entityType: row.entity_type || "",
    entityId: row.entity_id || "",
    scheduledAt: row.scheduled_at || null,
    processedAt: row.processed_at || null,
    resolvedAt: row.resolved_at || null,
    resolvedBy: row.resolved_by || "",
    resolvedNote: row.resolved_note || "",
    isResolved: row.status === "resolved",
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

async function readQueue(limit = 50) {
  await botDb.ensureSchema();
  return botDb.query(`SELECT * FROM aleta_bot_message_queue ORDER BY created_at DESC LIMIT ?`, [
    Math.max(1, Math.min(100, Number(limit || 50))),
  ]);
}

async function readQueuePublic(limit = 50) {
  const rows = await readQueue(limit);
  return rows.map(toPublicQueueItem);
}

async function findByIdempotencyKey(idempotencyKey) {
  if (!idempotencyKey) return null;
  await botDb.ensureSchema();
  const rows = await botDb.query(
    `SELECT * FROM aleta_bot_message_queue
     WHERE idempotency_key = ? AND status IN ('pending', 'processing', 'sent', 'dry_run', 'skipped')
     ORDER BY created_at DESC LIMIT 1`,
    [idempotencyKey]
  );
  return rows[0] || null;
}

module.exports = {
  enqueueMessage,
  findByIdempotencyKey,
  processNextMessage,
  processQueueBatch,
  getSendingWindowState,
  markSent,
  markFailed,
  markSkipped,
  markDryRun,
  getQueueStats,
  readQueue,
  readQueuePublic,
  getDeadLetters,
  requeueDeadLetter,
  resolveDeadLetter,
};
