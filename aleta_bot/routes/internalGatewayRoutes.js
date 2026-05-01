"use strict";

const express = require("express");
const crypto = require("crypto");
const router = express.Router();

const { readRuntimeConfig, getWhatsappSessionName } = require("../config/runtime-config");
const whatsappStatusService = require("../services/whatsappStatusService");
const messageQueueService = require("../services/messageQueueService");
const queueWorkerService = require("../services/queueWorkerService");
const logService = require("../services/logService");
const { validateWhatsappNumber } = require("../utils/phoneFormatter");

function sanitizeWhatsappRuntimeError(value) {
  const message = String(value || "");
  const lower = message.toLowerCase();
  if (!message) return null;
  if (lower.includes("could not find chrome") || lower.includes("puppeteer")) {
    return "Chrome/Puppeteer belum tersedia di server. Jalankan instalasi browser Puppeteer atau set PUPPETEER_EXECUTABLE_PATH.";
  }
  if (lower.includes("target closed")) {
    return "Browser WhatsApp tertutup. Coba hubungkan ulang WhatsApp Gateway.";
  }
  if (lower.includes("session expired")) {
    return "Sesi WhatsApp berakhir. Silakan scan QR ulang melalui WhatsApp Gateway.";
  }
  if (lower.includes("protocol error")) {
    return "Terjadi gangguan komunikasi dengan browser WhatsApp.";
  }
  if (lower.includes("econnrefused")) {
    return "WhatsApp Bot belum dapat dihubungi.";
  }
  return message.slice(0, 220);
}

// ── Internal Token Middleware ────────────────────────────────────────────────

function getRequestToken(req) {
  // x-aleta-internal-token (spec baru) atau x-aleta-bot-token (legacy fallback)
  return (
    req.headers["x-aleta-internal-token"] ||
    req.headers["x-aleta-bot-token"] ||
    ""
  );
}

function getConfiguredToken() {
  const runtimeConfig = readRuntimeConfig();
  return (
    process.env.ALETA_BOT_INTERNAL_API_TOKEN ||
    process.env.ALETA_BOT_INTERNAL_TOKEN ||
    runtimeConfig.internalApiToken ||
    ""
  );
}

function requireInternalToken(req, res, next) {
  const configuredToken = getConfiguredToken();
  const requestToken = getRequestToken(req);

  if (!configuredToken) {
    const isProduction = process.env.NODE_ENV === "production";
    if (isProduction) {
      logService.logSecurityEvent({
        eventType: "internal_token_not_configured_production",
        severity: "error",
        message: "Endpoint internal gateway diakses tanpa konfigurasi token di production.",
        metadata: { path: req.path, ip: req.ip },
      });
      return res.status(403).json({
        ok: false,
        error: "token_not_configured",
        message: "ALETA_BOT_INTERNAL_API_TOKEN belum dikonfigurasi. Endpoint internal tidak aman.",
      });
    }
    // Development: izinkan dengan warning
    console.warn(
      "[ALETA Bot Gateway] PERINGATAN: ALETA_BOT_INTERNAL_API_TOKEN tidak dikonfigurasi." +
      " Endpoint internal tidak aman di development."
    );
    return next();
  }

  if (!requestToken) {
    logService.logSecurityEvent({
      eventType: "internal_gateway_unauthorized",
      severity: "warning",
      message: `Akses gateway internal tanpa token: ${req.method} ${req.path}`,
      metadata: { path: req.path, method: req.method, ip: req.ip },
    });
    return res.status(401).json({
      ok: false,
      error: "missing_token",
      message: "Header x-aleta-internal-token diperlukan.",
    });
  }

  if (requestToken !== configuredToken) {
    logService.logSecurityEvent({
      eventType: "internal_gateway_forbidden",
      severity: "warning",
      message: `Token tidak valid untuk gateway internal: ${req.method} ${req.path}`,
      metadata: { path: req.path, method: req.method, ip: req.ip },
    });
    return res.status(403).json({
      ok: false,
      error: "invalid_token",
      message: "Token tidak valid.",
    });
  }

  return next();
}

// ── GET /whatsapp/status ─────────────────────────────────────────────────────

router.get("/whatsapp/status", requireInternalToken, (req, res) => {
  try {
    const runtimeConfig = readRuntimeConfig();
    const waState = whatsappStatusService.getStatus();
    const sessionName = getWhatsappSessionName(runtimeConfig);

    logService.logSystemEvent({
      eventType: "internal_whatsapp_status_requested",
      severity: "info",
      message: "Endpoint status WhatsApp internal dipanggil.",
      metadata: { ip: req.ip },
    });

    return res.json({
      ok: true,
      status: waState.status,
      sessionName,
      displayName: "ALETA WhatsApp Web",
      phoneNumber: waState.phoneNumber || "",
      lastConnectedAt: waState.lastReadyAt || null,
      lastDisconnectedAt: waState.lastDisconnectedAt || null,
      lastError: sanitizeWhatsappRuntimeError(waState.lastErrorMessage),
      sessionStartedAt: waState.sessionStartedAt || null,
      lastMessageSentAt: waState.lastMessageSentAt || null,
      sessionAgeHours: waState.sessionAgeHours,
      authFailureCount: waState.authFailureCount || 0,
      lastAuthFailureAt: waState.lastAuthFailureAt || null,
      sendingWindow: messageQueueService.getSendingWindowState(),
      qrAvailable: waState.status === "qr_needed" && Boolean(waState.lastQrString),
      runtime: "aleta_bot",
      gatewayMode: "single_gateway_candidate",
    });
  } catch (error) {
    logService.logSystemEvent({
      eventType: "internal_whatsapp_status_failed",
      severity: "error",
      message: "Endpoint status WhatsApp internal gagal.",
      metadata: { errorMessage: error.message },
    });
    return res.status(500).json({ ok: false, error: "status_failed", message: error.message });
  }
});

// ── GET /whatsapp/qr ─────────────────────────────────────────────────────────

router.get("/whatsapp/qr", requireInternalToken, async (req, res) => {
  try {
    const waState = whatsappStatusService.getStatus();

    logService.logSystemEvent({
      eventType: "internal_whatsapp_qr_requested",
      severity: "info",
      message: "Endpoint QR WhatsApp internal dipanggil.",
      metadata: { ip: req.ip, waStatus: waState.status },
    });

    if (waState.status === "connected") {
      return res.json({
        ok: true,
        status: "connected",
        qr: null,
        message: "WhatsApp sudah terhubung.",
      });
    }

    if (!waState.lastQrString) {
      return res.json({
        ok: true,
        status: waState.status || "initializing",
        qr: null,
        message: "QR belum tersedia. Tunggu sampai WhatsApp client menghasilkan QR.",
      });
    }

    const QRCode = require("qrcode");
    const qrDataUrl = await QRCode.toDataURL(waState.lastQrString, { errorCorrectionLevel: "M" });
    return res.json({
      ok: true,
      status: "qr_needed",
      qr: qrDataUrl,
      generatedAt: waState.lastQrGeneratedAt,
    });
  } catch (error) {
    logService.logSystemEvent({
      eventType: "internal_whatsapp_qr_failed",
      severity: "error",
      message: "Endpoint QR WhatsApp internal gagal.",
      metadata: { errorMessage: error.message },
    });
    return res.status(500).json({ ok: false, error: "qr_failed", message: error.message });
  }
});

// ── Helper: build gateway idempotency key ────────────────────────────────────

function stableSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9@._-]/g, "");
}

function buildGatewayIdempotencyKey({
  sourceApp,
  sourceFeature,
  entityType,
  entityId,
  recipientNumber,
  message,
} = {}) {
  if (sourceApp && sourceFeature && recipientNumber) {
    const parts = [
      stableSlug(sourceApp),
      stableSlug(sourceFeature),
      stableSlug(entityType || "entity"),
      stableSlug(entityId || ""),
      stableSlug(recipientNumber),
    ];
    if (message) {
      const msgHash = crypto
        .createHash("sha256")
        .update(String(message))
        .digest("hex")
        .slice(0, 8);
      parts.push(msgHash);
    }
    return `gw:${parts.join(":")}`;
  }
  // Fallback deterministik
  const nonce = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
  const digest = crypto
    .createHash("sha256")
    .update(`${recipientNumber || ""}|${message || ""}|${nonce}`)
    .digest("hex")
    .slice(0, 24);
  return `gw-manual:${digest}`;
}

// ── POST /messages/enqueue ────────────────────────────────────────────────────

router.post("/messages/enqueue", requireInternalToken, async (req, res) => {
  try {
    const {
      sourceApp,
      sourceFeature,
      entityType,
      entityId,
      recipientNumber,
      recipientName,
      message,
      category,
      priority,
      dryRun,
      idempotencyKey: providedKey,
      metadata: extraMetadata,
    } = req.body || {};

    // Validasi field wajib
    if (!sourceApp) {
      return res.status(400).json({ ok: false, error: "validation_error", message: "sourceApp wajib diisi." });
    }
    if (!sourceFeature) {
      return res.status(400).json({ ok: false, error: "validation_error", message: "sourceFeature wajib diisi." });
    }
    if (!recipientNumber) {
      return res.status(400).json({ ok: false, error: "validation_error", message: "recipientNumber wajib diisi." });
    }
    if (!message || !String(message).trim()) {
      return res.status(400).json({ ok: false, error: "validation_error", message: "message wajib diisi dan tidak boleh kosong." });
    }

    // Validasi nomor WhatsApp
    const numValidation = validateWhatsappNumber(String(recipientNumber));
    if (!numValidation.valid) {
      logService.logSystemEvent({
        eventType: "enqueue_invalid_recipient",
        severity: "warning",
        message: `Enqueue gateway: nomor penerima tidak valid: ${numValidation.reason}`,
        metadata: {
          recipientNumber: String(recipientNumber),
          reason: numValidation.reason,
          sourceApp: String(sourceApp),
          sourceFeature: String(sourceFeature),
        },
      });
      return res.status(400).json({
        ok: false,
        error: "invalid_recipient_number",
        message: `Nomor penerima tidak valid: ${numValidation.reason}`,
        recipientNumber: String(recipientNumber),
        reason: numValidation.reason,
      });
    }

    // Bangun atau gunakan idempotency key
    const idempotencyKey = String(
      providedKey ||
      buildGatewayIdempotencyKey({
        sourceApp,
        sourceFeature,
        entityType,
        entityId,
        recipientNumber: numValidation.normalized,
        message: String(message),
      })
    );

    // Cek duplikat sebelum enqueue
    const existing = await messageQueueService.findByIdempotencyKey(idempotencyKey);
    if (existing) {
      logService.logSystemEvent({
        eventType: "enqueue_duplicate",
        severity: "info",
        message: "Enqueue gateway: idempotency key sudah ada di queue.",
        metadata: {
          queueId: existing.id,
          idempotencyKey,
          sourceApp: String(sourceApp),
          sourceFeature: String(sourceFeature),
          existingStatus: existing.status,
        },
      });
      return res.json({
        ok: true,
        duplicate: true,
        existingQueueId: existing.id,
        status: existing.status,
        idempotencyKey,
        message: "Pesan dengan idempotency key ini sudah ada.",
      });
    }

    // Bangun metadata gabungan dengan source info
    const mergedMetadata = {
      ...((extraMetadata && typeof extraMetadata === "object") ? extraMetadata : {}),
      source_app: String(sourceApp),
      source_feature: String(sourceFeature),
      entity_type: String(entityType || ""),
      entity_id: String(entityId || ""),
      dryRun: dryRun === true,
      gateway: true,
    };

    const item = await messageQueueService.enqueueMessage({
      recipientNumber: numValidation.chatId,
      recipientName: String(recipientName || ""),
      message: String(message),
      category: String(category || "employee"),
      priority: Number(priority || 5),
      idempotencyKey,
      sourceApp: String(sourceApp),
      sourceFeature: String(sourceFeature),
      entityType: String(entityType || ""),
      entityId: String(entityId || ""),
      metadata: mergedMetadata,
    });

    logService.logSystemEvent({
      eventType: "enqueue_success",
      severity: "info",
      message: "Pesan gateway berhasil dimasukkan ke queue.",
      metadata: {
        queueId: item.id,
        idempotencyKey,
        sourceApp: String(sourceApp),
        sourceFeature: String(sourceFeature),
        recipientNumber: numValidation.normalized,
      },
    });

    return res.json({
      ok: true,
      queueId: item.id,
      status: item.status || "pending",
      idempotencyKey,
    });
  } catch (error) {
    logService.logSystemEvent({
      eventType: "enqueue_failed",
      severity: "error",
      message: "Endpoint enqueue gateway gagal.",
      metadata: { errorMessage: error.message },
    });
    return res.status(500).json({ ok: false, error: "enqueue_failed", message: error.message });
  }
});

// ── POST /messages/test ───────────────────────────────────────────────────────

router.post("/messages/test", requireInternalToken, async (req, res) => {
  try {
    const { recipientNumber, message, dryRun: requestedDryRun } = req.body || {};

    // Default dryRun = true
    const effectiveDryRun = requestedDryRun !== false;

    if (!recipientNumber) {
      return res.status(400).json({ ok: false, error: "validation_error", message: "recipientNumber wajib diisi." });
    }
    if (!message || !String(message).trim()) {
      return res.status(400).json({ ok: false, error: "validation_error", message: "message wajib diisi." });
    }

    const numValidation = validateWhatsappNumber(String(recipientNumber));
    if (!numValidation.valid) {
      logService.logSystemEvent({
        eventType: "test_message_invalid_recipient",
        severity: "warning",
        message: `Test message gateway: nomor tidak valid: ${numValidation.reason}`,
        metadata: { recipientNumber: String(recipientNumber), reason: numValidation.reason },
      });
      return res.status(400).json({
        ok: false,
        error: "invalid_recipient_number",
        message: `Nomor penerima tidak valid: ${numValidation.reason}`,
        reason: numValidation.reason,
      });
    }

    logService.logSystemEvent({
      eventType: effectiveDryRun ? "test_message_dry_run" : "test_message_enqueue",
      severity: "info",
      message: effectiveDryRun
        ? "Test message gateway dry-run dipanggil."
        : "Test message gateway dikirim ke queue.",
      metadata: {
        recipientNumber: numValidation.normalized,
        dryRun: effectiveDryRun,
        messagePreview: String(message).slice(0, 100),
      },
    });

    if (effectiveDryRun) {
      return res.json({
        ok: true,
        dryRun: true,
        preview: {
          recipientNumber: numValidation.normalized,
          recipientChatId: numValidation.chatId,
          message: String(message),
        },
      });
    }

    // dryRun: false — masuk queue, bukan bypass
    const runtimeConfig = readRuntimeConfig();
    if (!runtimeConfig.botEnabled) {
      return res.status(400).json({
        ok: false,
        error: "bot_disabled",
        message: "Bot tidak aktif. Test message tidak dapat dikirim.",
      });
    }

    const idempotencyKey = `gw-test:${numValidation.normalized}:${Date.now()}`;
    const item = await messageQueueService.enqueueMessage({
      recipientNumber: numValidation.chatId,
      recipientName: "Test Gateway",
      message: String(message),
      category: "manual",
      priority: 5,
      idempotencyKey,
      sourceApp: "aleta_bot_gateway",
      sourceFeature: "test_message",
      metadata: {
        source_app: "aleta_bot_gateway",
        source_feature: "test_message",
        dryRun: false,
        gateway: true,
        testMessage: true,
      },
    });

    return res.json({
      ok: true,
      dryRun: false,
      queueId: item.id,
      status: item.status,
      preview: {
        recipientNumber: numValidation.normalized,
        message: String(message),
      },
    });
  } catch (error) {
    logService.logSystemEvent({
      eventType: "test_message_failed",
      severity: "error",
      message: "Endpoint test message gateway gagal.",
      metadata: { errorMessage: error.message },
    });
    return res.status(500).json({ ok: false, error: "test_failed", message: error.message });
  }
});

// ── POST /worker/control ──────────────────────────────────────────────────────

router.post("/worker/control", requireInternalToken, (req, res) => {
  try {
    const action = String(req.body?.action || "").trim().toLowerCase();
    const reason = String(req.body?.reason || "").trim();

    if (action === "pause") {
      const status = queueWorkerService.pauseWorker(reason || "Dijeda dari portal manajemen_surat.");
      logService.logSystemEvent({
        eventType: "worker_paused_via_gateway",
        severity: "warning",
        message: "Worker queue dijeda melalui gateway internal.",
        metadata: { reason, ip: req.ip },
      });
      return res.json({ ok: true, action: "pause", worker: status });
    }

    if (action === "resume") {
      const status = queueWorkerService.resumeWorker();
      logService.logSystemEvent({
        eventType: "worker_resumed_via_gateway",
        severity: "info",
        message: "Worker queue dilanjutkan melalui gateway internal.",
        metadata: { ip: req.ip },
      });
      return res.json({ ok: true, action: "resume", worker: status });
    }

    if (action === "status") {
      return res.json({ ok: true, action: "status", worker: queueWorkerService.getWorkerStatus() });
    }

    return res.status(400).json({
      ok: false,
      error: "invalid_action",
      message: "Action harus 'pause', 'resume', atau 'status'.",
    });
  } catch (error) {
    logService.logSystemEvent({
      eventType: "worker_control_failed",
      severity: "error",
      message: "Endpoint worker control gagal.",
      metadata: { errorMessage: error.message },
    });
    return res.status(500).json({ ok: false, error: "worker_control_failed", message: error.message });
  }
});

router.get("/worker/status", requireInternalToken, (req, res) => {
  return res.json({ ok: true, action: "status", worker: queueWorkerService.getWorkerStatus() });
});

router.post("/worker/pause", requireInternalToken, (req, res) => {
  try {
    const reason = String(req.body?.reason || "").trim();
    const status = queueWorkerService.pauseWorker(reason || "Dijeda dari portal manajemen_surat.");
    logService.logSystemEvent({
      eventType: "worker_paused_via_gateway",
      severity: "warning",
      message: "Worker queue dijeda melalui endpoint pause.",
      metadata: { reason, ip: req.ip },
    });
    return res.json({ ok: true, action: "pause", worker: status });
  } catch (error) {
    logService.logSystemEvent({
      eventType: "worker_pause_failed",
      severity: "error",
      message: "Endpoint worker pause gagal.",
      metadata: { errorMessage: error.message },
    });
    return res.status(500).json({ ok: false, error: "worker_pause_failed", message: "Worker pause failed." });
  }
});

router.post("/worker/resume", requireInternalToken, (req, res) => {
  try {
    const status = queueWorkerService.resumeWorker();
    logService.logSystemEvent({
      eventType: "worker_resumed_via_gateway",
      severity: "info",
      message: "Worker queue dilanjutkan melalui endpoint resume.",
      metadata: { ip: req.ip },
    });
    return res.json({ ok: true, action: "resume", worker: status });
  } catch (error) {
    logService.logSystemEvent({
      eventType: "worker_resume_failed",
      severity: "error",
      message: "Endpoint worker resume gagal.",
      metadata: { errorMessage: error.message },
    });
    return res.status(500).json({ ok: false, error: "worker_resume_failed", message: "Worker resume failed." });
  }
});

// ── GET /queue/dead-letters ───────────────────────────────────────────────────

router.get("/queue/dead-letters", requireInternalToken, async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(200, Number(req.query?.limit || 50)));
    const items = await messageQueueService.getDeadLetters(limit);
    return res.json({
      ok: true,
      total: items.length,
      items,
    });
  } catch (error) {
    logService.logSystemEvent({
      eventType: "dead_letters_read_failed",
      severity: "error",
      message: "Endpoint dead letters gagal dibaca.",
      metadata: { errorMessage: error.message },
    });
    return res.status(500).json({ ok: false, error: "dead_letters_failed", message: error.message });
  }
});

// ── POST /queue/dead-letters/resend ──────────────────────────────────────────

router.post("/queue/dead-letters/resend", requireInternalToken, async (req, res) => {
  try {
    const id = String(req.body?.id || "").trim();
    if (!id) {
      return res.status(400).json({ ok: false, error: "validation_error", message: "id wajib diisi." });
    }

    const result = await messageQueueService.requeueDeadLetter(id);
    if (!result) {
      return res.status(404).json({
        ok: false,
        error: "not_found",
        message: "Dead letter tidak ditemukan atau bukan berstatus failed.",
      });
    }

    logService.logSystemEvent({
      eventType: "dead_letter_resent_via_gateway",
      severity: "info",
      message: "Dead letter di-resend melalui gateway internal.",
      metadata: { originalId: id, newId: result.newId, ip: req.ip },
    });

    return res.json({ ok: true, ...result });
  } catch (error) {
    logService.logSystemEvent({
      eventType: "dead_letter_resend_failed",
      severity: "error",
      message: "Endpoint resend dead letter gagal.",
      metadata: { errorMessage: error.message },
    });
    return res.status(500).json({ ok: false, error: "resend_failed", message: error.message });
  }
});

router.post("/queue/dead-letters/:id/resend", requireInternalToken, async (req, res) => {
  try {
    const id = String(req.params?.id || "").trim();
    if (!id) {
      return res.status(400).json({ ok: false, error: "validation_error", message: "id wajib diisi." });
    }

    const result = await messageQueueService.requeueDeadLetter(id);
    if (!result) {
      return res.status(404).json({
        ok: false,
        error: "not_found",
        message: "Dead letter tidak ditemukan atau bukan berstatus failed.",
      });
    }

    logService.logSystemEvent({
      eventType: "dead_letter_resent_via_gateway",
      severity: "info",
      message: "Dead letter di-resend melalui endpoint path-param.",
      metadata: { originalId: id, newId: result.newId, ip: req.ip },
    });

    return res.json({ ok: true, ...result });
  } catch (error) {
    logService.logSystemEvent({
      eventType: "dead_letter_resend_failed",
      severity: "error",
      message: "Endpoint resend dead letter path-param gagal.",
      metadata: { errorMessage: error.message },
    });
    return res.status(500).json({ ok: false, error: "resend_failed", message: "Resend dead letter failed." });
  }
});

// ── Phase 5: Legacy Migration Adapters ──────────────────────────────────────

const legacyNotificationAdapter = require("../services/legacy/legacyNotificationAdapter");
const legacyCommandAdapter = require("../services/legacy/legacyCommandAdapter");

/**
 * GET /legacy/notifications
 * Returns the full legacy notification registry snapshot for the portal
 * migration dashboard. READ-ONLY — does not execute any notifications.
 */
router.get("/legacy/notifications", requireInternalToken, (req, res) => {
  try {
    const snapshot = legacyNotificationAdapter.getRegistrySnapshot();
    const duplicates = legacyNotificationAdapter.detectDuplicateNotificationPaths();
    return res.json({
      ok: true,
      total: snapshot.length,
      notifications: snapshot,
      duplicates,
      duplicateCount: duplicates.length,
    });
  } catch (error) {
    logService.logSystemEvent({
      eventType: "legacy_notifications_snapshot_failed",
      severity: "error",
      message: "Endpoint legacy notification snapshot gagal.",
      metadata: { errorMessage: error.message },
    });
    return res.status(500).json({ ok: false, error: "snapshot_failed", message: error.message });
  }
});

/**
 * GET /legacy/notifications/:key/preview
 * Fetches (dry-run) the data that would be sent for a specific notification key.
 * READ-ONLY — no messages sent.
 */
router.get("/legacy/notifications/:key/preview", requireInternalToken, async (req, res) => {
  try {
    const key = String(req.params.key || "").trim();
    if (!key) {
      return res.status(400).json({ ok: false, error: "missing_key", message: "Legacy notification key wajib diisi." });
    }
    const result = await legacyNotificationAdapter.previewLegacyNotificationData(key);
    return res.status(result.ok ? 200 : 400).json(result);
  } catch (error) {
    logService.logSystemEvent({
      eventType: "legacy_notification_preview_failed",
      severity: "error",
      message: "Endpoint legacy notification preview gagal.",
      metadata: { key: req.params.key, errorMessage: error.message },
    });
    return res.status(500).json({ ok: false, error: "preview_failed", message: error.message });
  }
});

/**
 * GET /legacy/commands
 * Returns the full legacy command catalog and migration status for the portal.
 */
router.get("/legacy/commands", requireInternalToken, (req, res) => {
  try {
    const snapshot = legacyCommandAdapter.getCommandCatalogSnapshot();
    const duplicates = legacyCommandAdapter.detectDuplicateCommandPaths();
    return res.json({
      ok: true,
      ...snapshot,
      duplicates,
      duplicateCount: duplicates.length,
    });
  } catch (error) {
    logService.logSystemEvent({
      eventType: "legacy_commands_snapshot_failed",
      severity: "error",
      message: "Endpoint legacy command snapshot gagal.",
      metadata: { errorMessage: error.message },
    });
    return res.status(500).json({ ok: false, error: "snapshot_failed", message: error.message });
  }
});

module.exports = router;
