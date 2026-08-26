const crypto = require("crypto");
const { readRuntimeConfig } = require("../config/runtime-config");
const botDb = require("./botDbService");
const logService = require("./logService");
const { getMessagePreview, getWhatsappMessageId } = require("./messageService");
const whatsappStatusService = require("./whatsappStatusService");
const productionGuardService = require("./productionGuardService");
const sendingPaceService = require("./sendingPaceService");
const recipientHealthService = require("./recipientHealthService");

function createId() {
  return crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(12).toString("hex");
}

function createEmptyQueueStats() {
  return {
    total: 0,
    pending: 0,
    processing: 0,
    sent: 0,
    delivered: 0,
    read: 0,
    failed: 0,
    skipped: 0,
    dry_run: 0,
    dead_letter: 0,
    resolved: 0,
  };
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

function normalizePriority(value, category) {
  const hasExplicitPriority = value !== undefined && value !== null && value !== "";
  const explicitPriority = Number(value);
  if (hasExplicitPriority && Number.isFinite(explicitPriority)) {
    return explicitPriority;
  }

  const normalizedCategory = String(category || "").toLowerCase();
  if (["critical", "system", "manual"].includes(normalizedCategory)) return 1;
  if (normalizedCategory === "party") return 6;
  return 5;
}

/**
 * Prioritas akhir, dengan mendahulukan penerima yang pesannya benar-benar
 * dibaca.
 *
 * Pekerja antrean mengurutkan `priority ASC, scheduled_at ASC`, dan HANYA
 * memilih pesan yang jadwal kirimnya sudah tiba. Karena itu prioritas di sini
 * tidak pernah merusak jarak antar pesan - ia hanya menentukan siapa yang
 * didahulukan di antara pesan yang sama-sama sudah waktunya berangkat.
 *
 * Penerima yang terlibat didahulukan karena percakapan dua arah adalah
 * perlindungan terkuat terhadap pemblokiran: makin awal pesan mereka berangkat,
 * makin besar kemungkinan ada balasan yang masuk pada hari itu.
 *
 * Prioritas yang ditentukan pemanggil secara eksplisit tidak pernah diubah.
 */
async function resolvePriority(data, category, recipientNumber) {
  const dasar = normalizePriority(data.priority, category);
  const eksplisit = data.priority !== undefined && data.priority !== null && data.priority !== "";
  if (eksplisit) return dasar;

  const normalizedCategory = String(category || "").toLowerCase();
  if (normalizedCategory !== "party") return dasar;
  if (!recipientNumber) return dasar;

  try {
    const terlibat = await recipientHealthService.hasEngaged(recipientNumber);
    // Satu tingkat saja. Lompatan besar akan membuat seluruh pesan untuk
    // penerima tidak terlibat selalu berada di belakang, dan pemberitahuan
    // pengadilan tidak boleh punya warga kelas dua.
    return terlibat ? dasar - 1 : dasar;
  } catch {
    return dasar;
  }
}

function normalizeMaxRetries(value) {
  const runtimeConfig = readRuntimeConfig();
  const parsed = Number(value ?? runtimeConfig.retryLimit ?? 0);
  return Math.max(0, Math.min(10, Number.isFinite(parsed) ? parsed : 0));
}

function normalizeAttachment(data = {}) {
  const attachment = data.attachment || data.media || {};
  if (!attachment || typeof attachment !== "object") {
    return {
      source: "",
      name: "",
      mimeType: "",
      kind: "",
      required: false,
      size: null,
      checksum: "",
    };
  }
  const source = String(attachment.source || attachment.path || attachment.url || attachment.filePath || "").trim();
  return {
    source,
    name: String(attachment.name || attachment.fileName || attachment.filename || "").trim().slice(0, 255),
    mimeType: String(attachment.mimeType || attachment.mime_type || "").trim().slice(0, 191),
    kind: String(attachment.kind || attachment.type || "document").trim().slice(0, 64),
    required: Boolean(attachment.required || attachment.required === 1 || attachment.required === "true"),
    size:
      attachment.size === undefined || attachment.size === null || attachment.size === ""
        ? null
        : Math.max(0, Number(attachment.size) || 0),
    checksum: String(attachment.checksum || attachment.sha256 || "").trim().slice(0, 191),
  };
}

function attachmentFromRow(row = {}) {
  const source = String(row.attachment_source || "").trim();
  if (!source) return null;
  return {
    source,
    name: row.attachment_name || "",
    mimeType: row.attachment_mime_type || "",
    kind: row.attachment_kind || "document",
    required: Boolean(row.attachment_required),
    size: row.attachment_size === null || row.attachment_size === undefined ? null : Number(row.attachment_size),
    checksum: row.attachment_checksum || "",
  };
}

function getRetryBackoffMs(error, retryCount) {
  const message = String(error && error.message ? error.message : error || "").toLowerCase();
  if (message.includes("rate_limit_minute")) return 65 * 1000;
  if (message.includes("rate_limit_hour")) return 5 * 60 * 1000;
  if (message.includes("rate_limit_day")) return 15 * 60 * 1000;
  if (message.includes("whatsapp belum tersambung")) return Math.min(5 * 60 * 1000, 30 * 1000 * retryCount);
  return Math.min(15 * 60 * 1000, 30 * 1000 * retryCount);
}

async function enqueueMessage(data = {}) {
  await botDb.ensureSchema();
  const now = new Date();
  const idempotencyKey = data.idempotencyKey || data.idempotency_key || "";

  if (idempotencyKey) {
    const existing = await botDb.query(
      `SELECT * FROM aleta_bot_message_queue
       WHERE idempotency_key = ? AND status IN ('pending', 'processing', 'sent', 'delivered', 'read', 'dry_run', 'skipped')
       ORDER BY created_at DESC
       LIMIT 1`,
      [idempotencyKey]
    );
    if (existing.length > 0) return existing[0];
  }

  const category = data.category || "manual";
  const attachment = normalizeAttachment(data);
  const recipientNumber = data.recipientNumber || data.recipient_number || data.to || "";
  // Jadwal kirim ber-jarak: pesan notifikasi tidak boleh berangkat serentak
  // walau tipenya sama. Jadwal eksplisit dari pemanggil tetap dihormati.
  const explicitScheduledAt = data.scheduledAt || data.scheduled_at || null;
  const paceDecision = explicitScheduledAt
    ? { scheduledAt: new Date(explicitScheduledAt), deferredMs: 0, reasons: ["explicit_schedule"] }
    : await sendingPaceService.reserveSendSlot({ category, recipientNumber, now });
  const item = {
    id: data.id || createId(),
    idempotency_key: idempotencyKey,
    recipient_number: recipientNumber,
    recipient_name: data.recipientName || data.recipient_name || "",
    message_body: data.message || data.messageBody || "",
    message_preview: data.messagePreview || getMessagePreview(data.message || data.messageBody || ""),
    attachment_source: attachment.source,
    attachment_name: attachment.name,
    attachment_mime_type: attachment.mimeType,
    attachment_kind: attachment.kind,
    attachment_required: attachment.required ? 1 : 0,
    attachment_size: attachment.size,
    attachment_checksum: attachment.checksum,
    whatsapp_message_id: data.whatsappMessageId || data.whatsapp_message_id || "",
    ack: data.ack === undefined || data.ack === null ? null : Number(data.ack),
    delivered_at: null,
    read_at: null,
    category,
    notification_key: data.notificationKey || data.notification_key || "",
    priority: await resolvePriority(data, category, recipientNumber),
    status: "pending",
    retry_count: Number(data.retryCount || 0),
    max_retries: normalizeMaxRetries(data.maxRetries ?? data.max_retries),
    scheduled_at: paceDecision.scheduledAt,
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
      message_body, message_preview,
      attachment_source, attachment_name, attachment_mime_type, attachment_kind,
      attachment_required, attachment_size, attachment_checksum, whatsapp_message_id, ack, delivered_at, read_at,
      priority, status, retry_count, max_retries,
      scheduled_at, processed_at, last_error,
      source_app, source_feature, entity_type, entity_id,
      metadata_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      item.id,
      item.idempotency_key,
      item.notification_key,
      item.category,
      item.recipient_number,
      item.recipient_name,
      item.message_body,
      item.message_preview,
      item.attachment_source || null,
      item.attachment_name,
      item.attachment_mime_type,
      item.attachment_kind,
      item.attachment_required,
      item.attachment_size,
      item.attachment_checksum,
      item.whatsapp_message_id,
      item.ack,
      null,
      null,
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
    status: "queued",
    metadata: {
      hasAttachment: Boolean(item.attachment_source),
      attachmentName: item.attachment_name,
      attachmentKind: item.attachment_kind,
      sourceApp: item.source_app,
      sourceFeature: item.source_feature,
      entityType: item.entity_type,
      entityId: item.entity_id,
      scheduledAt: item.scheduled_at instanceof Date ? item.scheduled_at.toISOString() : String(item.scheduled_at || ""),
      paceDeferredMs: paceDecision.deferredMs,
      paceReasons: paceDecision.reasons,
      messageContractVersion: data.metadata?.messageContractVersion || data.metadata?.message_contract_version || "",
      messageContractSource: data.metadata?.messageContractSource || data.metadata?.message_contract_source || "",
      messageContractTraceId: data.metadata?.messageContractTraceId || data.metadata?.message_contract_trace_id || "",
      templateId: data.metadata?.templateId || data.metadata?.template_id || data.metadata?.templateKey || data.metadata?.template_key || "",
    },
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

function markSent(id, details = {}) {
  const whatsappMessageId = getWhatsappMessageId(details.response || details.whatsappMessage || details) || details.whatsappMessageId || "";
  return updateItem(id, {
    status: "sent",
    processed_at: new Date(),
    last_error: "",
    ...(whatsappMessageId ? { whatsapp_message_id: whatsappMessageId } : {}),
  });
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
  const categoryGuard = sendingWindow.allowed ? "" : "AND category IN ('system', 'critical', 'manual')";
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
    const runtimeConfig = readRuntimeConfig();
    const guardDecision = productionGuardService.shouldBlockLegacyQueueMessage({
      sourceApp: item.source_app,
      sourceFeature: item.source_feature,
      category: item.category,
      metadata,
    }, runtimeConfig);

    if (guardDecision.blocked) {
      await markSkipped(item.id, guardDecision.reason);
      await logService.logSecurityEvent({
        eventType: "queue_message_contract_blocked",
        severity: "warning",
        message: "Queue item WhatsApp diblokir karena tidak berasal dari kontrak template aktif.",
        metadata: {
          queueId: item.id,
          idempotencyKey: item.idempotency_key,
          sourceApp: item.source_app,
          sourceFeature: item.source_feature,
          category: item.category,
          reason: guardDecision.reason,
          messageContractVersion: metadata.messageContractVersion || metadata.message_contract_version || "",
          messageContractSource: metadata.messageContractSource || metadata.message_contract_source || "",
          templateId: metadata.templateId || metadata.template_id || metadata.templateKey || metadata.template_key || "",
        },
      });
      return item;
    }

    const result = await sender({
      to: item.recipient_number,
      message: item.message_body,
      attachment: attachmentFromRow(item),
      category: item.category,
      notificationKey: item.notification_key,
      recipientName: item.recipient_name,
      idempotencyKey: item.idempotency_key,
      metadata: { ...metadata, queueId: item.id },
      options: metadata.sendOptions && typeof metadata.sendOptions === "object" ? metadata.sendOptions : undefined,
      dryRun: metadata.dryRun === true,
    });

    if (metadata.dryRun === true) {
      await markDryRun(item.id);
    } else if (result === null) {
      await markSkipped(item.id, "sender_returned_null");
    } else {
      await markSent(item.id, { response: result });
      whatsappStatusService.recordMessageSent();
    }
    return item;
  } catch (error) {
    const nextRetryCount = Number(item.retry_count || 0) + 1;
    if (nextRetryCount <= Number(item.max_retries || 0)) {
      const backoffMs = getRetryBackoffMs(error, nextRetryCount);
      await markPendingRetry(item.id, nextRetryCount, new Date(Date.now() + backoffMs), error);
      await logService.logSystemEvent({
        eventType: "queue_item_retry_scheduled",
        severity: "warning",
        message: "Queue item ALETA Bot dijadwalkan ulang.",
        metadata: { queueId: item.id, retryCount: nextRetryCount, backoffMs, errorMessage: error.message },
      });
    } else {
      await markFailed(item.id, error);
      await logService.logSystemEvent({
        eventType: "queue_item_failed",
        severity: "error",
        message: "Queue item ALETA Bot gagal diproses.",
        metadata: { queueId: item.id, errorMessage: error.message },
      });
    }
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

async function recoverStaleProcessingMessages(options = {}) {
  await botDb.ensureSchema();
  const config = getStaleProcessingConfig();
  const now = new Date();
  const cutoff = new Date(now.getTime() - config.minutes * 60 * 1000);
  const rows = await botDb.query(
    `SELECT id, recipient_number, status, retry_count, max_retries, scheduled_at, updated_at, last_error
     FROM aleta_bot_message_queue
     WHERE status = 'processing' AND updated_at < ?
     ORDER BY updated_at ASC
     LIMIT ?`,
    [botDb.toMysqlDate(cutoff), config.limit]
  );

  if (rows.length === 0) {
    return {
      checkedAt: now.toISOString(),
      staleMinutes: config.minutes,
      recovered: 0,
      failed: 0,
      queueIds: [],
    };
  }

  let recovered = 0;
  let failed = 0;
  const queueIds = [];
  const nowSql = botDb.toMysqlDate(now);

  for (const row of rows) {
    const retryCount = Number(row.retry_count || 0);
    const maxRetries = Number(row.max_retries || 0);
    const canRetry = retryCount <= maxRetries;
    const nextStatus = canRetry ? "pending" : "failed";
    const nextRetryCount = canRetry ? retryCount + 1 : retryCount;
    const errorCode = canRetry
      ? `stale_processing_recovered_after_${config.minutes}_minutes`
      : `stale_processing_failed_after_${config.minutes}_minutes`;

    const result = await botDb.query(
      `UPDATE aleta_bot_message_queue
       SET status = ?,
           retry_count = ?,
           scheduled_at = ?,
           processed_at = ?,
           last_error = ?,
           updated_at = ?
       WHERE id = ? AND status = 'processing'`,
      [
        nextStatus,
        nextRetryCount,
        canRetry ? nowSql : row.scheduled_at || nowSql,
        canRetry ? null : nowSql,
        errorCode,
        nowSql,
        row.id,
      ]
    );

    if (!result || result.affectedRows === 0) continue;
    queueIds.push(row.id);
    if (canRetry) recovered += 1;
    else failed += 1;
  }

  await logService.logSystemEvent({
    eventType: "queue_stale_processing_recovered",
    severity: failed > 0 ? "error" : "warning",
    message:
      failed > 0
        ? "Sebagian pesan processing lama dipulihkan, sebagian masuk gagal."
        : "Pesan processing lama dikembalikan ke antrean.",
    metadata: {
      trigger: options.reason || options.trigger || "worker",
      staleMinutes: config.minutes,
      recovered,
      failed,
      queueIds: queueIds.slice(0, 25),
      truncated: queueIds.length > 25,
    },
  });

  return {
    checkedAt: now.toISOString(),
    staleMinutes: config.minutes,
    recovered,
    failed,
    queueIds,
  };
}

async function getQueueStats() {
  const schemaReady = await botDb.ensureSchema();
  if (!schemaReady) return createEmptyQueueStats();

  let rows = [];
  try {
    rows = await botDb.query(`SELECT status, COUNT(*) AS count FROM aleta_bot_message_queue GROUP BY status`);
  } catch {
    return createEmptyQueueStats();
  }

  return rows.reduce(
    (stats, row) => {
      const count = Number(row.count || 0);
      stats.total += count;
      stats[row.status] = count;
      return stats;
    },
    createEmptyQueueStats()
  );
}

function formatWaitText(milliseconds) {
  const totalSeconds = Math.max(0, Math.ceil(Number(milliseconds || 0) / 1000));
  if (totalSeconds <= 3) return "sebentar lagi";
  if (totalSeconds < 60) return `${totalSeconds} detik`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds > 0 ? `${minutes} menit ${seconds} detik` : `${minutes} menit`;
}

function getEstimatedMessageMs() {
  const runtimeConfig = readRuntimeConfig();
  const worker = runtimeConfig.queueWorker || {};
  const delayMs = Number(runtimeConfig.messageDelayMs || runtimeConfig.message_delay_ms || 1500);
  const batchSize = Math.max(1, Math.min(50, Number(worker.batchSize || runtimeConfig.queueWorkerBatchSize || 5)));
  const intervalMs = Math.max(5000, Number(worker.intervalMs || runtimeConfig.queueWorkerIntervalMs || 30000));
  const intervalShare = Math.ceil(intervalMs / batchSize);
  // Sejak pesan dijadwalkan berjarak, JARAK ANTAR PESAN-lah penentu utama lama
  // antrean — bukan lagi interval worker. Perkiraan waktu tunggu yang
  // ditampilkan ke penanya harus ikut memperhitungkannya.
  const pace = sendingPaceService.getPaceConfig(runtimeConfig);
  const paceShare = pace.enabled ? Math.ceil((pace.minGapMs + pace.maxGapMs) / 2) : 0;
  return Math.max(750, delayMs, intervalShare, paceShare);
}

function getStaleProcessingConfig() {
  const runtimeConfig = readRuntimeConfig();
  const worker = runtimeConfig.queueWorker || {};
  const minutes = Number(
    worker.staleProcessingMinutes ||
      runtimeConfig.queueStaleProcessingMinutes ||
      process.env.ALETA_BOT_QUEUE_STALE_PROCESSING_MINUTES ||
      15
  );

  return {
    minutes: Math.max(10, Math.min(120, Number.isFinite(minutes) ? minutes : 15)),
    limit: Math.max(1, Math.min(200, Number(worker.staleProcessingLimit || 50))),
  };
}

function queueProgressDetails(item = {}) {
  return {
    whatsappMessageId: item.whatsapp_message_id || "",
    ack: item.ack === null || item.ack === undefined ? null : Number(item.ack),
    deliveredAt: item.delivered_at || null,
    readAt: item.read_at || null,
    failedAt: item.status === "failed" ? (item.processed_at || item.updated_at || null) : null,
    processedAt: item.processed_at || null,
    lastError: String(item.last_error || "").slice(0, 500),
    updatedAt: item.updated_at || null,
  };
}

async function getQueueProgress(queueItemOrId) {
  await botDb.ensureSchema();
  const queueId = typeof queueItemOrId === "object" ? queueItemOrId?.id : queueItemOrId;
  if (!queueId) {
    return {
      stage: "unknown",
      status: "unknown",
      position: null,
      pendingAhead: null,
      estimatedWaitMs: null,
      estimatedWaitText: "belum dapat dihitung",
    };
  }

  const rows = typeof queueItemOrId === "object" && queueItemOrId.status
    ? [queueItemOrId]
    : await botDb.query(`SELECT * FROM aleta_bot_message_queue WHERE id = ? LIMIT 1`, [queueId]);
  const item = rows[0];
  if (!item) {
    return {
      queueId,
      stage: "unknown",
      status: "not_found",
      position: null,
      pendingAhead: null,
      estimatedWaitMs: null,
      estimatedWaitText: "antrean tidak ditemukan",
    };
  }

  if (["sent", "delivered", "read", "dry_run"].includes(item.status)) {
    return {
      queueId: item.id,
      stage: "done",
      status: item.status,
      position: 0,
      pendingAhead: 0,
      estimatedWaitMs: 0,
      estimatedWaitText: "selesai",
      ...queueProgressDetails(item),
    };
  }
  if (item.status === "failed") {
    return {
      queueId: item.id,
      stage: "failed",
      status: item.status,
      position: 0,
      pendingAhead: 0,
      estimatedWaitMs: 0,
      estimatedWaitText: "gagal",
      ...queueProgressDetails(item),
    };
  }
  if (item.status === "processing") {
    return {
      queueId: item.id,
      stage: "sending",
      status: item.status,
      position: 1,
      pendingAhead: 0,
      estimatedWaitMs: 0,
      estimatedWaitText: "sedang dikirim",
      ...queueProgressDetails(item),
    };
  }

  const aheadRows = await botDb.query(
    `SELECT COUNT(*) AS count
       FROM aleta_bot_message_queue
      WHERE status IN ('pending', 'processing')
        AND (
          status = 'processing'
          OR priority < ?
          OR (priority = ? AND scheduled_at < ?)
          OR (priority = ? AND scheduled_at = ? AND created_at <= ?)
        )`,
    [
      item.priority,
      item.priority,
      item.scheduled_at,
      item.priority,
      item.scheduled_at,
      item.created_at,
    ]
  );
  const position = Math.max(1, Number(aheadRows[0]?.count || 1));
  const pendingAhead = Math.max(0, position - 1);
  const estimatedWaitMs = pendingAhead * getEstimatedMessageMs();

  return {
    queueId: item.id,
    stage: "queued",
    status: item.status,
    position,
    pendingAhead,
    estimatedWaitMs,
    estimatedWaitText: formatWaitText(estimatedWaitMs),
    ...queueProgressDetails(item),
  };
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
       attachment_source, attachment_name, attachment_mime_type, attachment_kind,
       attachment_required, attachment_size, attachment_checksum, whatsapp_message_id, ack, delivered_at, read_at,
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
  // Kirim ulang massal juga harus berjarak. Tanpa ini, admin yang mengembalikan
  // banyak pesan gagal sekaligus akan memicu ledakan pengiriman.
  const paceDecision = await sendingPaceService.reserveSendSlot({
    category: item.category || "manual",
    recipientNumber: item.recipient_number,
    now,
  });

  await botDb.query(
    `INSERT INTO aleta_bot_message_queue (
      id, idempotency_key, notification_key, category, recipient_number, recipient_name,
      message_body, message_preview,
      attachment_source, attachment_name, attachment_mime_type, attachment_kind,
      attachment_required, attachment_size, attachment_checksum, whatsapp_message_id, ack, delivered_at, read_at,
      priority, status, retry_count, max_retries,
      scheduled_at, processed_at, last_error,
      source_app, source_feature, entity_type, entity_id,
      metadata_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, 0, ?, NULL, '', ?, ?, ?, ?, ?, ?, ?)`,
    [
      newId,
      idempotencyKey,
      item.notification_key || "",
      item.category || "manual",
      item.recipient_number,
      item.recipient_name || "",
      item.message_body,
      item.message_preview || "",
      item.attachment_source || null,
      item.attachment_name || "",
      item.attachment_mime_type || "",
      item.attachment_kind || "",
      Number(item.attachment_required || 0),
      item.attachment_size ?? null,
      item.attachment_checksum || "",
      "",
      null,
      null,
      null,
      Number(item.priority || 5),
      botDb.toMysqlDate(paceDecision.scheduledAt),
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
    metadata: {
      originalId: id,
      newId,
      recipientNumber: maskRecipientNumber(item.recipient_number),
      scheduledAt: paceDecision.scheduledAt.toISOString(),
      paceDeferredMs: paceDecision.deferredMs,
    },
  });

  return {
    originalId: id,
    newId,
    status: "pending",
    scheduledAt: paceDecision.scheduledAt.toISOString(),
  };
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
    hasAttachment: Boolean(row.attachment_source),
    attachmentName: row.attachment_name || "",
    attachmentKind: row.attachment_kind || "",
    attachmentRequired: Boolean(row.attachment_required),
    attachmentSize: row.attachment_size === null || row.attachment_size === undefined ? null : Number(row.attachment_size),
    whatsappMessageId: row.whatsapp_message_id || "",
    ack: row.ack === null || row.ack === undefined ? null : Number(row.ack),
    deliveredAt: row.delivered_at || null,
    readAt: row.read_at || null,
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
     WHERE idempotency_key = ? AND status IN ('pending', 'processing', 'sent', 'delivered', 'read', 'dry_run', 'skipped')
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
  recoverStaleProcessingMessages,
  getSendingWindowState,
  markSent,
  markFailed,
  markSkipped,
  markDryRun,
  getQueueStats,
  getQueueProgress,
  readQueue,
  readQueuePublic,
  getDeadLetters,
  requeueDeadLetter,
  resolveDeadLetter,
};
