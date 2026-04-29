const { readRuntimeConfig, sleep } = require("../config/runtime-config");
const { validateWhatsappRecipient } = require("../utils/phoneFormatter");
const logService = require("./logService");
const rateLimitService = require("./rateLimitService");

function getMessagePreview(message) {
  if (typeof message === "string") {
    return message.replace(/\s+/g, " ").slice(0, 240);
  }
  return "[media/non-text message]";
}

function isNotificationContext(category) {
  return ["employee", "party", "notification"].includes(String(category || "").toLowerCase());
}

async function safeSendMessage({
  client,
  sendFn,
  to,
  message,
  options,
  category = "system",
  notificationKey = "",
  jobKey = "",
  recipientName = "",
  metadata = {},
  idempotencyKey = "",
  dryRun,
  retryLimit,
  delayMs,
} = {}) {
  const runtimeConfig = readRuntimeConfig();
  const validation = validateWhatsappRecipient(to);
  const messagePreview = getMessagePreview(message);
  const baseLog = {
    notificationKey,
    jobKey,
    idempotencyKey,
    category,
    recipientNumber: validation.chatId || String(to || ""),
    recipientName,
    messagePreview,
    metadata: {
      ...metadata,
      recipientType: validation.type,
    },
  };

  if (!validation.valid) {
    logService.logMessageSkipped({
      ...baseLog,
      status: "skipped",
      errorMessage: validation.reason,
      metadata: { ...baseLog.metadata, rawRecipient: String(to || "") },
    });
    logService.logSystemEvent({
      eventType: "invalid_whatsapp_recipient",
      severity: "warning",
      message: `Invalid WhatsApp recipient skipped: ${validation.reason}`,
      metadata: { rawRecipient: String(to || ""), notificationKey, category },
    });
    return null;
  }

  if (!runtimeConfig.botEnabled) {
    logService.logMessageSkipped({ ...baseLog, status: "skipped", errorMessage: "bot_disabled" });
    return null;
  }

  if (isNotificationContext(category) && !runtimeConfig.notificationsEnabled) {
    logService.logMessageSkipped({ ...baseLog, status: "skipped", errorMessage: "notifications_disabled" });
    return null;
  }

  if (idempotencyKey && await logService.hasSentIdempotencyKey(idempotencyKey)) {
    logService.logMessageSkipped({ ...baseLog, status: "skipped", errorMessage: "idempotency_key_already_sent" });
    return null;
  }

  const effectiveDryRun = typeof dryRun === "boolean" ? dryRun : Boolean(runtimeConfig.dryRunEnabled);
  if (effectiveDryRun) {
    logService.logMessageSkipped({ ...baseLog, status: "dry_run" });
    console.log(`[ALETA Bot][DRY RUN] ${validation.chatId}: ${messagePreview}`);
    return null;
  }

  const rateLimit = rateLimitService.checkRateLimit(runtimeConfig);
  if (!rateLimit.allowed) {
    rateLimitService.logRateLimit(rateLimit.reason, {
      recipient: validation.chatId,
      notificationKey,
      category,
      rateLimit: rateLimit.config,
    });
    logService.logMessageSkipped({ ...baseLog, status: "skipped", errorMessage: rateLimit.reason });
    return null;
  }

  const maxRetries = Math.max(0, Number(retryLimit ?? runtimeConfig.retryLimit ?? 0));
  const effectiveDelayMs = Math.max(0, Number(delayMs ?? runtimeConfig.messageDelayMs ?? 0));
  const sendMessage = sendFn || (client && client.sendMessage && client.sendMessage.bind(client));

  if (typeof sendMessage !== "function") {
    logService.logMessageFailed({ ...baseLog, errorMessage: "missing_send_function" });
    return null;
  }

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    logService.logMessageAttempt({ ...baseLog, retryCount: attempt });
    try {
      if (effectiveDelayMs > 0) {
        await sleep(effectiveDelayMs);
      }

      const response = await sendMessage(validation.chatId, message, options);
      rateLimitService.recordSend();
      logService.logMessageSent({ ...baseLog, retryCount: attempt });
      return response;
    } catch (error) {
      const errorMessage = error && error.message ? error.message : String(error);
      logService.logMessageFailed({ ...baseLog, retryCount: attempt, errorMessage });
      console.error(`[ALETA Bot] Gagal mengirim pesan ke ${validation.chatId} pada percobaan ${attempt + 1}:`, errorMessage);
      if (attempt >= maxRetries) {
        return null;
      }
    }
  }

  return null;
}

module.exports = {
  safeSendMessage,
  getMessagePreview,
};
