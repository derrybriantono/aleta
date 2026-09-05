require("dotenv").config();

const crypto = require("crypto");
const http = require("http");
const https = require("https");
const fs = require("fs");
const {
  Client,
  LocalAuth,
  MessageMedia,
} = require("whatsapp-web.js");
const path = require('path');
const qrcode2 = require("qrcode-terminal");
const figlet = require("figlet");
const cron = require("node-cron");

// Semua scheduler ALETA Bot wajib berjalan pada zona waktu WITA, terlepas dari
// timezone host/container. Wrapper ini menambahkan default timezone ke setiap
// cron.schedule (termasuk scheduler dinamis yang memakai instance module yang sama).
const ALETA_CRON_TIMEZONE = String(process.env.ALETA_BOT_CRON_TIMEZONE || "Asia/Makassar").trim() || "Asia/Makassar";
const cronScheduleWithoutTimezone = cron.schedule.bind(cron);
cron.schedule = (expression, task, options) =>
  cronScheduleWithoutTimezone(expression, task, { timezone: ALETA_CRON_TIMEZONE, ...(options || {}) });
const getData = require("./query");
const notification = require("./notifikasi");
const detailPerkara = require("./detail");
const express = require("express");
const { phoneNumberFormatter } = require("./helpers/formatter");
const { readRuntimeConfig, getWhatsappSessionName, sleep } = require("./config/runtime-config");
const messageService = require("./services/messageService");
const messageQueueService = require("./services/messageQueueService");
const sendingPaceService = require("./services/sendingPaceService");
const chatMenuService = require("./services/chatMenuService");
const optOutService = require("./services/optOutService");
const serviceAnalyticsService = require("./services/serviceAnalyticsService");
const outgoingChatService = require("./services/outgoingChatService");
const recipientHealthService = require("./services/recipientHealthService");
const banSignalService = require("./services/banSignalService");
const humanPresenceService = require("./services/humanPresenceService");
const ecourtDocumentService = require("./services/ecourtDocumentService");
const ecourtNotificationWorker = require("./services/ecourtNotificationWorker");
const ecourtVerificationService = require("./services/ecourtVerificationService");
const nomorVerificationService = require("./services/nomorVerificationService");
const ecourtSchedulerService = require("./services/ecourtSchedulerService");
const ecourtSesiPantauService = require("./services/ecourtSesiPantauService");
const logService = require("./services/logService");
const rateLimitService = require("./services/rateLimitService");
const whatsappStatusService = require("./services/whatsappStatusService");
const whatsappAudienceService = require("./services/whatsappAudienceService");
const productionGuardService = require("./services/productionGuardService");
const queueWorkerService = require("./services/queueWorkerService");
const dynamicNotificationSchedulerService = require("./services/dynamicNotificationSchedulerService");
const botDbService = require("./services/botDbService");
const { validateStartupConfig } = require("./services/configValidationService");
const { buildIdempotencyKey, buildManualIdempotencyKey } = require("./services/idempotencyService");
const notificationRegistryService = require("./services/notificationRegistryService");
const { validateQuery } = require("./services/queryValidatorService");
const { validateTemplate } = require("./services/templateService");
const externalDbService = require("./services/externalDbService");
const publicQaIntentService = require("./services/publicQaIntentService");
const { guardCaseCommandAccess } = require("./services/publicQaVerificationService");
const antrianOnlineService = require("./services/antrianOnlineService");
const antrianSidangService = require("./services/antrianSidangService");
const kehadiranAntrianService = require("./services/kehadiranAntrianService");
// Perintah antrian sidang online dari pihak. "daftar antrian" -> slot penggugat,
// "antrian online" -> slot tergugat, "ambil antrian" -> deteksi dari nomor pengirim.
const ANTRIAN_ONLINE_COMMANDS = new Set(["daftar antrian", "antrian online", "ambil antrian"]);

/**
 * "cek antrian" - pihak menanyakan posisinya sendiri.
 *
 * Dipisahkan dari perintah pengambilan karena ia TIDAK MENULIS apa pun. Yang
 * paling sering ditanya di ruang tunggu bukan "berapa nomor saya" - itu sudah
 * dipegangnya - melainkan "masih berapa lagi", dan selama ini jawabannya hanya
 * ada pada petugas yang harus berhenti mengerjakan yang lain tiap kali
 * ditanya.
 */
const ANTRIAN_CEK_COMMANDS = new Set(["cek antrian", "posisi antrian", "antrian saya"]);
const aiRuntimeConfigService = require("./services/aiRuntimeConfigService");
const aiProviderAdapter = require("./services/aiProviderAdapter");
const internalGatewayRoutes = require("./routes/internalGatewayRoutes");
const app = express();
const port = 3003;
const server = http.createServer(app);
const legacyNotificationSkipLogs = new Set();
const {
  adminId,
  hakimIds,
  paniteraIds,
  jurusitaIds,
  ketuaId,
  paniteraId,
  kasirId,
  ptspId,
  penjagaSidangId,
  legacyWhatsappMappingStats
} = require('./whatsapp');

function sanitizeProcessError(error) {
  const rawMessage = error && error.message ? error.message : String(error || "");
  const lower = rawMessage.toLowerCase();
  if (
    lower.includes("browser is already running") ||
    lower.includes("userdata") ||
    lower.includes("userdatadir") ||
    lower.includes(".wwebjs_auth") ||
    lower.includes("session-aleta-whatsapp-main") ||
    lower.includes("ebusy") ||
    lower.includes("eperm")
  ) {
    return "Session WhatsApp sedang dipakai proses browser lain. Tutup proses Chrome/Puppeteer lama atau restart backend ALETA Bot, lalu coba lagi.";
  }
  if (
    lower.includes("could not find chrome") ||
    lower.includes("could not find expected browser") ||
    lower.includes("browser was not found") ||
    lower.includes("executable doesn't exist") ||
    (lower.includes("failed to launch the browser process") && lower.includes("no such file"))
  ) {
    return "Chrome belum ditemukan atau path Chrome tidak dapat dijalankan.";
  }
  return rawMessage.slice(0, 500) || "Error runtime tidak diketahui.";
}

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', sanitizeProcessError(reason));
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', sanitizeProcessError(error));
});

validateStartupConfig();
void botDbService.ensureSchema().then((ready) => {
  if (!ready) {
    console.warn("[ALETA Bot] Tabel DB aleta_bot_* belum siap. Log/queue akan fallback sementara bila diperlukan.");
  }
});

// console log bot name
figlet("AletaBot", function (err, data) {
  if (err) {
    console.log("Ada yang salah...");
    console.dir(err);
    return;
  }
  console.log(data);
});

app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: "1mb" }));
app.use(express.static("public"));

app.get("/", (req, res) => {
  res.sendFile("index.html", {
    root: __dirname,
  });
});

// Health check ringan untuk Docker/reverse proxy. Tanpa auth dan tanpa data sensitif.
app.get("/health", (req, res) => {
  res.status(200).json({
    ok: true,
    service: "aleta_bot",
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

//inisiasi whatsapp
const initialRuntimeConfig = readRuntimeConfig();
const whatsappSessionName = getWhatsappSessionName(initialRuntimeConfig);
const chromeExecutablePath =
  String(process.env.ALETA_BOT_CHROME_EXECUTABLE_PATH || process.env.PUPPETEER_EXECUTABLE_PATH || "").trim();

const puppeteerLaunchConfig = {
  headless: true,
  args: [
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--no-sandbox",
    "--disable-accelerated-2d-canvas",
    "--no-first-run",
    "--no-zygote",
    "--disable-gpu",
  ],
};

if (chromeExecutablePath) {
  puppeteerLaunchConfig.executablePath = chromeExecutablePath;
}

function getWhatsappStartupErrorMessage(error) {
  const rawMessage = error && error.message ? error.message : String(error || "");
  const isBrowserLocked =
    /browser is already running/i.test(rawMessage) ||
    /userdata/i.test(rawMessage) ||
    /userDataDir/i.test(rawMessage) ||
    /session-aleta-whatsapp-main/i.test(rawMessage);
  const isChromeMissing =
    /could not find chrome/i.test(rawMessage) ||
    /could not find expected browser/i.test(rawMessage) ||
    /browser was not found/i.test(rawMessage) ||
    /executable doesn't exist/i.test(rawMessage) ||
    (/failed to launch the browser process/i.test(rawMessage) && /no such file/i.test(rawMessage));

  if (isBrowserLocked) {
    return "Session WhatsApp sedang dipakai proses browser lain. Tutup proses Chrome/Puppeteer lama atau restart backend ALETA Bot, lalu coba lagi.";
  }

  if (!isChromeMissing) {
    return rawMessage || "Inisialisasi WhatsApp client gagal.";
  }

  const envHint = chromeExecutablePath
    ? `Path Chrome dari env saat ini: ${chromeExecutablePath}. Pastikan file tersebut ada dan dapat dijalankan.`
    : "Set PUPPETEER_EXECUTABLE_PATH atau ALETA_BOT_CHROME_EXECUTABLE_PATH ke lokasi chrome.exe.";

  return [
    "Chrome/Puppeteer belum terinstall atau tidak ditemukan.",
    "Jalankan: npx puppeteer browsers install chrome",
    "atau set PUPPETEER_EXECUTABLE_PATH.",
    envHint,
  ].join(" ");
}

function getWhatsappStartupErrorType(error) {
  const rawMessage = error && error.message ? error.message : String(error || "");
  if (
    /browser is already running/i.test(rawMessage) ||
    /userdata/i.test(rawMessage) ||
    /userDataDir/i.test(rawMessage) ||
    /session-aleta-whatsapp-main/i.test(rawMessage)
  ) {
    return "browser_locked";
  }
  if (
    /could not find chrome/i.test(rawMessage) ||
    /could not find expected browser/i.test(rawMessage) ||
    /browser was not found/i.test(rawMessage) ||
    /executable doesn.t exist/i.test(rawMessage) ||
    (/failed to launch the browser process/i.test(rawMessage) && /no such file/i.test(rawMessage))
  ) return "browser_unavailable";
  if (/no usable sandbox/i.test(rawMessage) || /running as root without --no-sandbox/i.test(rawMessage) || /setuid sandbox/i.test(rawMessage)) return "browser_sandbox_error";
  if (/target closed/i.test(rawMessage)) return "browser_closed";
  if (/protocol error/i.test(rawMessage)) return "browser_protocol";
  return "initialize_failed";
}

function cleanupStaleChromiumLocks(sessionName) {
  const cleaned = [];
  const errors = [];
  try {
    const dataPath = path.join(__dirname, ".wwebjs_auth", `session-${sessionName}`);
    let exists = false;
    try { fs.lstatSync(dataPath); exists = true; } catch (_) { exists = false; }
    if (!exists) return { cleaned: false, reason: "session_dir_missing", files: [], errors: [] };

    const lockNames = ["SingletonLock", "SingletonCookie", "SingletonSocket"];
    const dirs = [dataPath, path.join(dataPath, "Default")];
    for (const dir of dirs) {
      for (const lockName of lockNames) {
        const target = path.join(dir, lockName);
        try {
          fs.lstatSync(target); // lstat untuk menangani symlink dangling
          fs.unlinkSync(target);
          cleaned.push(target);
        } catch (err) {
          if (err && err.code !== "ENOENT") {
            errors.push({ target, message: err.message });
          }
        }
      }
    }
    return { cleaned: cleaned.length > 0, files: cleaned, errors };
  } catch (error) {
    return { cleaned: false, error: error && error.message ? error.message : String(error), files: cleaned, errors };
  }
}

function logWhatsappLockCleanupResult(source, result = {}) {
  if (!result.cleaned && !result.error && (!Array.isArray(result.errors) || result.errors.length === 0)) return;
  void logService.logSystemEvent({
    eventType: "whatsapp_session_lock_cleanup",
    severity: result.error || (Array.isArray(result.errors) && result.errors.length > 0) ? "warning" : "info",
    message: result.cleaned
      ? "Lock Chrome/session WhatsApp lama dibersihkan sebelum initialize."
      : "Pemeriksaan lock Chrome/session WhatsApp selesai dengan catatan.",
    metadata: {
      source,
      cleaned: Boolean(result.cleaned),
      files: Array.isArray(result.files) ? result.files.map((file) => path.basename(file)) : [],
      reason: result.reason || "",
      errorMessage: result.error || "",
      errors: Array.isArray(result.errors)
        ? result.errors.map((item) => ({
            target: item.target ? path.basename(item.target) : "",
            message: item.message || "",
          }))
        : [],
    },
  });
}

function prepareWhatsappSessionForInitialize(source) {
  const result = cleanupStaleChromiumLocks(whatsappSessionName);
  logWhatsappLockCleanupResult(source, result);
  return result;
}

let client = null;
let originalSendMessage = null;

function createWhatsappClientInstance(source = "startup") {
  const nextClient = new Client({
    webVersionCache: { type: 'none' },
    puppeteer: puppeteerLaunchConfig,
    // session is deprecated
    // session: sessionCfg,
    authStrategy: new LocalAuth({
      clientId: whatsappSessionName,
    }),
    qrTimeoutMs: 0,
  });

  originalSendMessage = nextClient.sendMessage.bind(nextClient);
  nextClient.sendMessage = async (id, ...args) => {
    return sendOrQueueLegacyMessage({
      id,
      message: args[0],
      options: args[1],
      category: "notification",
      metadata: {
        source: "legacy_client_sendMessage",
        sourceFeature: "legacy_client_sendMessage",
        legacySendPath: true,
        legacySourceFile: "app.js",
      },
    });
  };
  registerWhatsappClientEventHandlers(nextClient);
  void logService.logSystemEvent({
    eventType: "whatsapp_client_instance_created",
    severity: "info",
    message: "Instance WhatsApp client ALETA Bot dibuat.",
    metadata: { source, sessionName: whatsappSessionName },
  });
  return nextClient;
}

function ensureWhatsappClient(source = "runtime") {
  if (!client) {
    client = createWhatsappClientInstance(source);
  }
  return client;
}

async function destroyWhatsappClient(source = "runtime") {
  const activeClient = client;
  if (!activeClient) return false;
  try {
    await activeClient.destroy();
    if (client === activeClient) {
      client = null;
    }
    return true;
  } catch (error) {
    void logService.logSystemEvent({
      eventType: "whatsapp_client_destroy_failed",
      severity: "warning",
      message: "Destroy WhatsApp client gagal.",
      metadata: { source, errorMessage: getWhatsappStartupErrorMessage(error) },
    });
    throw error;
  }
}

function recreateWhatsappClientInstance(source = "reconnect") {
  client = createWhatsappClientInstance(source);
  return client;
}

function isActiveWhatsappClient(activeClient) {
  return Boolean(activeClient && activeClient === client);
}

client = createWhatsappClientInstance("startup");
function buildLegacyQueueIdempotencyKey({ recipientNumber, message, notificationKey, sourceFeature, attachment }) {
  const digest = crypto
    .createHash("sha256")
    .update(`${typeof message === "string" ? message : ""}|${attachment?.source || ""}`)
    .digest("hex")
    .slice(0, 12);
  return buildIdempotencyKey({
    notificationKey: notificationKey || sourceFeature || "legacy-notification",
    recipientNumber,
    eventDate: new Date().toISOString().slice(0, 16),
    messageType: digest || "message",
  });
}

async function enqueueLegacyMessage({
  id,
  message,
  options,
  category = "notification",
  notificationKey = "",
  jobKey = "",
  recipientName = "",
  metadata = {},
  idempotencyKey = "",
  dryRun,
  attachment = null,
  priority,
} = {}) {
  const sourceFeature = String(metadata.sourceFeature || metadata.source || notificationKey || "legacy_notification");
  const mergedMetadata = {
    ...metadata,
    source: metadata.source || sourceFeature,
    sourceFeature,
    jobKey,
    legacyQueued: true,
    legacySendPath: true,
    legacySourceFile: "app.js",
  };
  if (options && typeof options === "object" && Object.keys(options).length > 0) {
    mergedMetadata.sendOptions = options;
  }
  if (typeof dryRun === "boolean") {
    mergedMetadata.dryRun = dryRun;
  }

  return messageQueueService.enqueueMessage({
    recipientNumber: id,
    recipientName,
    message: typeof message === "string" ? message : (options?.caption || "[media/non-text message]"),
    category,
    notificationKey: notificationKey || sourceFeature,
    priority,
    idempotencyKey: idempotencyKey || buildLegacyQueueIdempotencyKey({
      recipientNumber: id,
      message,
      notificationKey,
      sourceFeature,
      attachment,
    }),
    sourceApp: "aleta_bot",
    sourceFeature,
    metadata: mergedMetadata,
    attachment,
  });
}

function shouldQueueLegacyMessage({ message, attachment, category, options }) {
  const normalizedCategory = String(category || "").toLowerCase();
  if (options && typeof options === "object" && "quotedMessageId" in options) return false;
  if (attachment && attachment.source) return true;
  if (typeof message !== "string") return false;
  return ["notification", "employee", "party"].includes(normalizedCategory);
}

async function sendOrQueueLegacyMessage(payload = {}) {
  const sourceFeature = String(
    payload.metadata?.sourceFeature ||
    payload.metadata?.source ||
    payload.notificationKey ||
    "legacy_app_js_send"
  );
  const legacyMetadata = {
    ...(payload.metadata || {}),
    source: payload.metadata?.source || sourceFeature,
    sourceFeature,
    legacySendPath: true,
    legacySourceFile: "app.js",
  };
  const runtimeConfig = readRuntimeConfig();
  const guardDecision = productionGuardService.shouldBlockLegacyQueueMessage({
    sourceApp: "aleta_bot",
    sourceFeature,
    category: payload.category || "notification",
    metadata: legacyMetadata,
  }, runtimeConfig);

  if (guardDecision.blocked) {
    await logService.logSecurityEvent({
      eventType: "legacy_app_js_send_blocked",
      severity: "warning",
      message: "Jalur kirim legacy app.js diblokir oleh production guard.",
      metadata: {
        sourceFeature,
        notificationKey: payload.notificationKey || "",
        category: payload.category || "notification",
        reason: guardDecision.reason,
      },
    });
    return null;
  }

  const guardedPayload = {
    ...payload,
    metadata: legacyMetadata,
  };

  if (shouldQueueLegacyMessage(guardedPayload)) {
    const item = await enqueueLegacyMessage(guardedPayload);
    return { queued: true, queueId: item.id, status: item.status || "pending" };
  }
  const activeClient = ensureWhatsappClient("send_or_queue");
  return messageService.safeSendMessage({
    client: activeClient,
    sendFn: originalSendMessage,
    to: guardedPayload.id,
    message: guardedPayload.message,
    options: guardedPayload.options,
    category: guardedPayload.category || "notification",
    notificationKey: guardedPayload.notificationKey || "",
    jobKey: guardedPayload.jobKey || "",
    recipientName: guardedPayload.recipientName || "",
    metadata: guardedPayload.metadata || {},
    idempotencyKey: guardedPayload.idempotencyKey || "",
    dryRun: guardedPayload.dryRun,
  });
}

const safeSendMessage = async (id, ...args) => {
  return sendOrQueueLegacyMessage({
    id,
    message: args[0],
    options: args[1],
    category: "notification",
    metadata: {
      source: "legacy_safeSendMessage",
      sourceFeature: "legacy_safeSendMessage",
      legacySendPath: true,
      legacySourceFile: "app.js",
    },
  });
};

const safeSendTrackedMessage = async ({
  id,
  message,
  options,
  category = "notification",
  notificationKey = "",
  jobKey = "",
  recipientName = "",
  metadata = {},
  idempotencyKey = "",
  dryRun,
}) => {
  return sendOrQueueLegacyMessage({
    id,
    message,
    options,
    category,
    notificationKey,
    jobKey,
    recipientName,
    metadata,
    idempotencyKey,
    dryRun,
  });
};

function isLegacyNotificationDisabled(legacyKey, runtimeConfig = readRuntimeConfig()) {
  const disabledKeys = [
    ...(Array.isArray(runtimeConfig.disabledLegacyKeys) ? runtimeConfig.disabledLegacyKeys : []),
    ...(Array.isArray(runtimeConfig.disabledLegacyNotificationKeys) ? runtimeConfig.disabledLegacyNotificationKeys : []),
  ].map((key) => String(key || ""));
  return disabledKeys.includes(legacyKey);
}

function hasActiveDynamicReplacement(replacements = [], runtimeConfig = readRuntimeConfig()) {
  const notifications = Array.isArray(runtimeConfig.notifications) ? runtimeConfig.notifications : [];
  return notifications.some((notification) => {
    if (!notification || !notification.isActive) return false;
    const notificationId = String(notification.id || notification.key || "");
    const queryId = String(notification.queryId || notification.query_id || notification.query_key || "");
    return replacements.some((replacement) => {
      return (
        (replacement.id && replacement.id === notificationId) ||
        (replacement.queryId && replacement.queryId === queryId)
      );
    });
  });
}

function registryNotificationTakeoverEnabled(runtimeConfig = readRuntimeConfig()) {
  return runtimeConfig.useRegistryNotifications !== false && runtimeConfig.legacyNotificationTakeoverMode !== false;
}

function runLegacyNotificationIfAllowed(legacyKey, replacements, runner) {
  const runtimeConfig = readRuntimeConfig();
  if (registryNotificationTakeoverEnabled(runtimeConfig)) {
    if (!legacyNotificationSkipLogs.has(`registry_takeover:${legacyKey}`)) {
      legacyNotificationSkipLogs.add(`registry_takeover:${legacyKey}`);
      console.log(`[ALETA Bot] Legacy notification ${legacyKey} dilewati karena registry ALETA Bot menjadi sumber pengiriman.`);
      void logService.logSecurityEvent({
        eventType: "legacy_notification_registry_takeover",
        severity: "warning",
        message: "Scheduler notifikasi legacy app.js dilewati karena pengiriman sudah dialihkan ke registry ALETA Bot.",
        metadata: { legacyKey, sourceFile: "app.js", replacements },
      });
    }
    return;
  }
  if (
    productionGuardService.productionGuardEnabled(runtimeConfig) &&
    !productionGuardService.legacyNotificationSchedulerAllowed(runtimeConfig)
  ) {
    if (!legacyNotificationSkipLogs.has(legacyKey)) {
      legacyNotificationSkipLogs.add(legacyKey);
      console.log(`[ALETA Bot] Legacy notification ${legacyKey} dilewati oleh production guard.`);
      void logService.logSecurityEvent({
        eventType: "legacy_notification_scheduler_blocked",
        severity: "warning",
        message: "Scheduler notifikasi legacy app.js diblokir oleh production guard.",
        metadata: { legacyKey, sourceFile: "app.js" },
      });
    }
    return;
  }
  if (isLegacyNotificationDisabled(legacyKey, runtimeConfig)) {
    console.log(`[ALETA Bot] Legacy notification ${legacyKey} dilewati karena sudah dinonaktifkan dari portal.`);
    return;
  }
  if (hasActiveDynamicReplacement(replacements, runtimeConfig)) {
    console.log(`[ALETA Bot] Legacy notification ${legacyKey} dilewati karena pengganti dinamis dari portal aktif.`);
    return;
  }
  return runner();
}

// Resolusi dokumen SIPP dipindahkan ke services/sippDocumentService.js agar bisa
// diuji/didiagnosis tanpa menyalakan client WhatsApp (lihat scripts/check-sipp-document.js).
const {
  SIPP_DOCUMENT_ROOTS,
  sanitizeSippDocumentInput,
  findReadableSippDocument,
  buildSippDocumentUrl,
  checkRemoteDocument,
} = require("./services/sippDocumentService");

async function createSippDocumentMedia(documentPath) {
  const documentInfo = sanitizeSippDocumentInput(documentPath);
  if (!documentInfo.ok) return { ok: false, reason: documentInfo.reason };

  if (documentInfo.isUrl) {
    const remoteCheck = await checkRemoteDocument(documentInfo.url);
    if (!remoteCheck.ok) return remoteCheck;
    const media = await MessageMedia.fromUrl(documentInfo.url, {
      unsafeMime: true,
      filename: documentInfo.fileName,
      reqOptions: { headers: { accept: "*/*" } },
    });
    return { ok: true, media, source: documentInfo.url, fileName: documentInfo.fileName };
  }

  const localPath = findReadableSippDocument(documentInfo);
  if (localPath) {
    return {
      ok: true,
      media: MessageMedia.fromFilePath(localPath),
      source: localPath,
      fileName: documentInfo.fileName,
    };
  }

  const remoteUrl = buildSippDocumentUrl(documentInfo.relativePath);
  const remoteCheck = await checkRemoteDocument(remoteUrl);
  if (!remoteCheck.ok) {
    return {
      ok: false,
      reason: `${remoteCheck.reason} File juga tidak ditemukan di root lokal: ${SIPP_DOCUMENT_ROOTS.join(", ")}.`,
    };
  }

  const media = await MessageMedia.fromUrl(remoteUrl, {
    unsafeMime: true,
    filename: documentInfo.fileName,
    reqOptions: { headers: { accept: "*/*" } },
  });
  return { ok: true, media, source: remoteUrl, fileName: documentInfo.fileName };
}

/**
 * Menyiapkan berkas e-Court yang sudah diunduh jembatan sebagai lampiran.
 *
 * Jauh lebih sederhana daripada padanannya untuk SIPP: berkasnya sudah pasti
 * ada di disk lokal (jembatan yang menaruhnya), jadi tidak perlu pencarian di
 * beberapa root maupun jalur cadangan lewat HTTP.
 */
function createEcourtDocumentMedia(documentPath) {
  const berkas = ecourtDocumentService.describeEcourtDocument(documentPath);
  if (!berkas.ok) return { ok: false, reason: berkas.reason };
  return {
    ok: true,
    media: MessageMedia.fromFilePath(berkas.absolutePath),
    source: berkas.absolutePath,
    fileName: berkas.fileName,
  };
}

function createSippDocumentAttachment(documentPath) {
  const documentInfo = sanitizeSippDocumentInput(documentPath);
  if (!documentInfo.ok) return null;
  return {
    source: documentPath,
    name: documentInfo.fileName,
    kind: "sipp_document",
    required: false,
  };
}

async function sendSippDocumentNotification({
  formattedNumber,
  message,
  documentPath,
  recipientRole,
  recipientName,
  caseNumber,
  testMode = false,
}) {
  const recipientLabel = `${recipientRole} ${recipientName || "-"} (${formattedNumber}) untuk perkara ${caseNumber || "-"}`;

  if (testMode) {
    console.log(`[TEST MODE] Akan mengirim pesan ke ${recipientLabel}:\n${message}`);
    console.log(`[TEST MODE] Dokumen SIPP: ${documentPath || "tidak ada path dokumen"}`);
    return { sent: false, testMode: true };
  }

  const attachment = createSippDocumentAttachment(documentPath);
  if (!attachment && documentPath) {
    console.warn(`Dokumen tidak dimasukkan antrean untuk ${recipientLabel}: path dokumen tidak valid.`);
  }

  const item = await enqueueLegacyMessage({
    id: formattedNumber,
    message,
    options: attachment ? { caption: message, sendMediaAsDocument: true } : undefined,
    category: "party",
    notificationKey: "pihak-dokumen-sipp",
    recipientName,
    metadata: {
      source: "sipp_document_notification",
      sourceFeature: "sipp_document_notification",
      recipientRole,
      caseNumber,
      hasAttachment: Boolean(attachment),
    },
    attachment,
  });
  console.log(`Pesan ${attachment ? "dengan dokumen" : "teks"} masuk antrean untuk ${recipientLabel}. Queue ID: ${item.id}`);
  return { sent: false, queued: true, queueId: item.id, withDocument: Boolean(attachment) };
}

async function resolveLegacyAiCommandResponse({ prompt, senderNumber, senderName, commandKey }) {
  const question = String(prompt || "").trim();
  if (!question) {
    return "Tidak ada isi pertanyaan untuk diproses. Silakan tulis pertanyaan layanan yang ingin Bapak/Ibu tanyakan.";
  }

  try {
    const publicQa = await publicQaIntentService.resolvePublicQaAnswer({
      message: question,
      senderNumber,
      senderName,
    });
    const legacyResponse = publicQa.handled && publicQa.legacyCommand
      ? await getData(publicQa.legacyCommand.toLocaleLowerCase(), {
          senderNumber,
          senderName,
          allowDynamicQuery: publicQa.intent?.responseMode === "query_template",
          publicQaIntentKey: publicQa.intent?.key || "",
          publicQaIntent: publicQa.intent || null,
        })
      : "";
    const finalPublicQa = await publicQaIntentService.finalizePublicQaAnswer({
      publicQa,
      message: question,
      senderNumber,
      legacyResponse,
    });

    return (
      finalPublicQa.answer ||
      publicQa.answer ||
      legacyResponse ||
      "Maaf, pertanyaan belum dapat dikenali. Silakan pilih menu layanan atau hubungi PTSP/petugas resmi pengadilan."
    );
  } catch (error) {
    logService.logSystemEvent({
      eventType: "legacy_ai_command_failed",
      severity: "warning",
      message: "Command AI legacy gagal diproses melalui Public Q&A.",
      metadata: {
        commandKey,
        errorMessage: error.message,
      },
    });
    return "Maaf, layanan AI belum dapat memproses pertanyaan saat ini. Silakan coba lagi atau hubungi PTSP/petugas resmi pengadilan.";
  }
}

let whatsappInitializePromise = null;
let isShuttingDown = false;
const WHATSAPP_INITIALIZE_TIMEOUT_MS = 120000;

const markWhatsappInitializeTimeoutIfNeeded = async () => {
  const currentState = whatsappStatusService.getStatus();
  const waitingForReady = ["initializing", "authenticated"].includes(currentState.status);
  if (
    !waitingForReady ||
    !currentState.initializeAgeMs ||
    currentState.initializeAgeMs < WHATSAPP_INITIALIZE_TIMEOUT_MS
  ) {
    return false;
  }

  try {
    await destroyWhatsappClient("initialize_timeout");
  } catch (error) {
    logService.logSystemEvent({
      eventType: "whatsapp_initialize_timeout_destroy_failed",
      severity: "warning",
      message: "Cleanup aman client WhatsApp setelah initialize timeout gagal.",
      metadata: { errorMessage: getWhatsappStartupErrorMessage(error) },
    });
  }
  whatsappInitializePromise = null;
  await sleep(1500);
  recreateWhatsappClientInstance("initialize_timeout");

  whatsappStatusService.setStatus("initialize_timeout", "initialize_timeout", {
    severity: "warning",
    message: "Inisialisasi WhatsApp terlalu lama tanpa QR/ready. Client dihentikan aman tanpa logout.",
    errorMessage: "Inisialisasi WhatsApp terlalu lama. Klik Connect sekali lagi setelah memastikan tidak ada proses browser lama.",
    errorType: "initialize_timeout",
    initializeAgeMs: currentState.initializeAgeMs,
  });
  return true;
};

const startWhatsappClient = async (source = "manual") => {
  await markWhatsappInitializeTimeoutIfNeeded();
  const currentState = whatsappStatusService.getStatus();
  const currentStatus = currentState.status || "unknown";
  const guardedStatuses = source === "reconnect"
    ? ["connected", "authenticated", "qr_needed", "initializing", "browser_locked"]
    : ["connected", "authenticated", "qr_needed", "initializing", "browser_locked", "reconnecting"];

  if (guardedStatuses.includes(currentStatus)) {
    return {
      started: false,
      status: currentStatus,
      message:
        currentStatus === "connected"
          ? "WhatsApp sudah terhubung."
          : currentStatus === "browser_locked"
          ? "Session WhatsApp sedang dipakai proses browser lain. Tutup proses Chrome/Puppeteer lama atau restart backend ALETA Bot, lalu coba lagi."
          : currentStatus === "initializing" || currentStatus === "reconnecting"
          ? "WhatsApp client sedang diinisialisasi. Tunggu status/QR beberapa detik."
          : "WhatsApp client sudah berjalan. QR akan tersedia jika login diperlukan.",
    };
  }

  if (whatsappInitializePromise) {
    return {
      started: false,
      status: "initializing",
      message: "WhatsApp client sedang diinisialisasi. Tunggu status/QR beberapa detik.",
    };
  }

  whatsappStatusService.setStatus("initializing", "initialize", {
    message: `WhatsApp client diinisialisasi (${source}).`,
    source,
  });
  const activeClient = ensureWhatsappClient(source);
  prepareWhatsappSessionForInitialize(source);

 whatsappInitializePromise = Promise.resolve()
    .then(() => activeClient.initialize())
    .catch((error) => {
      const friendlyMessage = getWhatsappStartupErrorMessage(error);
      const errorType = getWhatsappStartupErrorType(error);
      const rawMessage = error && error.message ? error.message : String(error || "");
      const rawStack = error && error.stack ? String(error.stack) : "";
      whatsappStatusService.setStatus(errorType === "browser_locked" ? "browser_locked" : "disconnected", "initialize_failed", {
        severity: "error",
        message: friendlyMessage,
        errorMessage: friendlyMessage,
        errorType,
        source,
        chromeExecutablePathConfigured: Boolean(chromeExecutablePath),
        chromeExecutablePath: chromeExecutablePath ? "[configured]" : "",
        puppeteerCacheDirConfigured: Boolean(process.env.PUPPETEER_CACHE_DIR),
      });
      console.error("Inisialisasi WhatsApp gagal:", friendlyMessage);
      if (rawMessage && rawMessage.slice(0, 200) !== friendlyMessage.slice(0, 200)) {
        console.error("[ALETA Bot] Raw launch error:", rawMessage.slice(0, 1500));
      }
      if (rawStack) {
        console.error("[ALETA Bot] Stack:", rawStack.slice(0, 2000));
      }
      try {
        logService.logSystemEvent({
          eventType: "whatsapp_initialize_failed",
          severity: "error",
          message: "Inisialisasi WhatsApp client gagal.",
          metadata: {
            errorType,
            friendlyMessage,
            rawErrorMessage: rawMessage.slice(0, 1500),
            rawErrorStack: rawStack.slice(0, 2000),
            source,
            chromeExecutablePathConfigured: Boolean(chromeExecutablePath),
            puppeteerCacheDirConfigured: Boolean(process.env.PUPPETEER_CACHE_DIR),
          },
        });
      } catch (logError) {
        console.error("[ALETA Bot] Gagal mencatat log inisialisasi:", logError && logError.message ? logError.message : logError);
      }
    })
    .finally(() => {
      whatsappInitializePromise = null;
    });

  return {
    started: true,
    status: "initializing",
    message: "WhatsApp client sedang diinisialisasi. QR akan tersedia jika login diperlukan.",
  };
};

const queuedMessageSender = async (payload = {}) => {
  const activeClient = ensureWhatsappClient("queue_sender");
  const attachment = payload.attachment;
  if (attachment && attachment.source) {
    let mediaResult;
    try {
      // Berkas e-Court dan berkas SIPP dipisahkan jalurnya karena asalnya
      // berbeda: path SIPP datang mentah dari database aplikasi lain dan perlu
      // pembersihan ketat, sedangkan berkas e-Court diletakkan sendiri oleh
      // jembatan di bawah folder yang kita kuasai. Menyalurkan berkas e-Court
      // lewat pembersih SIPP akan ditolak, karena pembersih itu memang
      // dirancang menolak apa pun di luar root SIPP.
      mediaResult = attachment.kind === "ecourt_document"
        ? createEcourtDocumentMedia(attachment.source)
        : await createSippDocumentMedia(attachment.source);
    } catch (error) {
      mediaResult = { ok: false, reason: error.message };
    }

    if (mediaResult.ok) {
      return messageService.safeSendMessage({
        client: activeClient,
        sendFn: originalSendMessage,
        ...payload,
        message: mediaResult.media,
        options: {
          ...(payload.options || {}),
          caption: payload.options?.caption || payload.message || "",
          sendMediaAsDocument: payload.options?.sendMediaAsDocument !== false,
        },
        metadata: {
          ...(payload.metadata || {}),
          attachmentSource: mediaResult.source,
          attachmentName: mediaResult.fileName || attachment.name || "",
          hasAttachment: true,
        },
      });
    }

    logService.logSystemEvent({
      eventType: "queue_attachment_unavailable",
      severity: attachment.required ? "error" : "warning",
      message: "Lampiran antrean WhatsApp belum dapat dibaca.",
      metadata: {
        queueId: payload.metadata?.queueId || "",
        attachmentName: attachment.name || "",
        attachmentKind: attachment.kind || "",
        reason: mediaResult.reason,
      },
    });

    if (attachment.required) {
      throw new Error(`attachment_not_available:${mediaResult.reason}`);
    }
  }

  return messageService.safeSendMessage({ client: activeClient, sendFn: originalSendMessage, ...payload });
};

queueWorkerService.startQueueWorker(queuedMessageSender);

// Penjadwal penarikan e-Court. Dimulai dalam keadaan MATI kecuali admin
// menyalakannya dari portal - menarik dari sistem Mahkamah Agung tanpa
// diminta bukan perilaku yang pantas dinyalakan sendiri oleh pembaruan.
ecourtSchedulerService.mulai();

// Pemantau sesi e-Court. Sama seperti penjadwal, dimulai dalam keadaan MATI
// kecuali admin menyalakannya - detaknya membuka peramban ke sistem Mahkamah
// Agung, dan itu tidak pantas menyala sendiri oleh pembaruan.
ecourtSesiPantauService.mulai();
dynamicNotificationSchedulerService.startDynamicNotificationScheduler();

// Menilai nomor yang pesannya tidak pernah sampai, lalu menghentikannya.
// Dijalankan sekali sehari saja: penilaiannya memang menunggu lebih dari
// sehari sebelum menyimpulkan, jadi memeriksanya lebih sering tidak menambah
// ketepatan, hanya menambah beban database.
const PENILAIAN_PENERIMA_INTERVAL_MS = 24 * 60 * 60 * 1000;
function jalankanPenilaianPenerima() {
  recipientHealthService
    .evaluateUndeliverable()
    .then((hasil) => {
      if (hasil.suppressed > 0) {
        console.log(`[ALETA Bot] ${hasil.suppressed} nomor dihentikan karena pesannya tidak pernah sampai.`);
      }
    })
    .catch((error) => {
      logService.logSystemEvent({
        eventType: "recipient_health_evaluation_failed",
        severity: "info",
        message: "Penilaian kesehatan nomor tujuan gagal; pengiriman tidak terpengaruh.",
        metadata: { errorMessage: String(error.message || error).slice(0, 200) },
      });
    });
}
const penilaianPenerimaTimer = setInterval(jalankanPenilaianPenerima, PENILAIAN_PENERIMA_INTERVAL_MS);
if (penilaianPenerimaTimer.unref) penilaianPenerimaTimer.unref();
// Penilaian pertama ditunda beberapa menit agar tidak menambah beban saat bot
// baru menyala dan sedang menyambung ke WhatsApp.
const penilaianAwalTimer = setTimeout(jalankanPenilaianPenerima, 5 * 60 * 1000);
if (penilaianAwalTimer.unref) penilaianAwalTimer.unref();

// Dokumen e-Court diperiksa tiap 15 menit. Jauh lebih sering daripada
// penilaian penerima karena sifatnya berbeda: begitu majelis memverifikasi
// sebuah Jawaban, pihak lawan sebaiknya tahu pada hari yang sama supaya sempat
// menyiapkan Replik. Pemeriksaannya sendiri murah - hanya membaca tabel ALETA,
// dan hampir selalu menemukan antrean kosong.
//
// Pengirimannya tetap tunduk pada irama kirim dan jendela jam kerja, karena
// pesan diserahkan ke antrean, bukan dikirim langsung dari sini.
const PEKERJA_ECOURT_INTERVAL_MS = Number(process.env.ALETA_BOT_ECOURT_WORKER_INTERVAL_MS || 15 * 60 * 1000);
function jalankanPekerjaEcourt() {
  ecourtNotificationWorker
    .runOnce()
    .then((hasil) => {
      if (hasil && hasil.diantrekan > 0) {
        console.log(`[ALETA Bot] e-Court: ${hasil.diantrekan} dokumen diantrekan (${hasil.pesan} pesan).`);
      }
    })
    .catch((error) => {
      logService.logSystemEvent({
        eventType: "ecourt_worker_failed",
        severity: "info",
        message: "Pekerja notifikasi e-Court gagal; notifikasi lain tidak terpengaruh.",
        metadata: { errorMessage: String(error.message || error).slice(0, 200) },
      });
    });
}
const pekerjaEcourtTimer = setInterval(jalankanPekerjaEcourt, PEKERJA_ECOURT_INTERVAL_MS);
if (pekerjaEcourtTimer.unref) pekerjaEcourtTimer.unref();
const pekerjaEcourtAwalTimer = setTimeout(jalankanPekerjaEcourt, 6 * 60 * 1000);
if (pekerjaEcourtAwalTimer.unref) pekerjaEcourtAwalTimer.unref();

function registerWhatsappClientEventHandlers(activeClient) {
activeClient.on("qr", (qr) => {
  if (!isActiveWhatsappClient(activeClient)) return;
  // NOTE: This event will not be fired if a session is specified.
  whatsappStatusService.setStatus("qr_needed", "qr", { message: "QR login WhatsApp dibuat.", qrString: qr });
  qrcode2.generate(qr, { small: true });
});

activeClient.on("ready", () => {
  if (!isActiveWhatsappClient(activeClient)) return;
  const phoneNumber = activeClient.info?.wid?.user || "";
  // Hitungan gagal beruntun dinolkan. Penghentian karena tanda blokir TIDAK
  // ikut dibatalkan di sini - hanya admin yang boleh melepaskannya.
  banSignalService.recordReady();
  whatsappStatusService.setStatus("connected", "ready", { message: "WhatsApp client siap dan terhubung.", phoneNumber });
  logService.logWhatsappEvent({
    eventType: "whatsapp_ready_no_auto_send",
    severity: "info",
    message: "WhatsApp client siap. Tidak ada pesan otomatis yang dikirim saat ready.",
    metadata: { hasAdminRecipient: Boolean(adminId) },
  });
  console.log("READY");
});

activeClient.on("message_ack", (message, ack) => {
  const whatsappMessageId = messageService.getWhatsappMessageId(message);
  logService.updateMessageAck({
    whatsappMessageId,
    ack,
    metadata: {
      to: message?.to || "",
      from: message?.from || "",
    },
  }).catch((error) => {
    logService.logWhatsappEvent({
      eventType: "message_ack_update_failed",
      severity: "warning",
      message: "ACK WhatsApp diterima tetapi gagal memperbarui laporan.",
      metadata: { whatsappMessageId, ack, errorMessage: error.message },
    });
  });
});

// Menyimpan sesi ke file
activeClient.on("authenticated", () => {
  if (!isActiveWhatsappClient(activeClient)) return;
  whatsappStatusService.setStatus("authenticated", "authenticated", { message: "WhatsApp client berhasil autentikasi." });
  console.log("AUTHENTICATED");
});

activeClient.on("auth_failure", (msg) => {
  if (!isActiveWhatsappClient(activeClient)) return;
  // Fired if session restore was unsuccessfull
  const sinyal = banSignalService.recordAuthFailure(String(msg || ""));
  whatsappStatusService.setStatus("auth_failure", "auth_failure", {
    severity: sinyal.halted ? "critical" : "error",
    message: sinyal.halted
      ? "Bot dihentikan otomatis: autentikasi WhatsApp gagal berulang kali."
      : "WhatsApp authentication failure.",
    errorMessage: String(msg || ""),
  });
  console.error("AUTHENTICATION FAILURE", msg, `(gagal beruntun ke-${sinyal.streak})`);
});

activeClient.on("change_battery", (batteryInfo) => {
  // Battery percentage for attached device has changed
  const { battery, plugged } = batteryInfo;
  console.log(`Battery: ${battery}% - Charging? ${plugged}`);
});

activeClient.on('change_state', (state) => {
  if (!isActiveWhatsappClient(activeClient)) return;
  console.log("CHANGE STATE", state);
  const normalizedState = String(state || "").trim().toLowerCase();
  whatsappStatusService.setStatus(normalizedState || "unknown", "change_state", { state, message: `WhatsApp state: ${state}` });
  if (normalizedState === "conflict" || normalizedState === "unlaunched") {
    activeClient.takeOver();
  } else if (normalizedState === "disconnected") {
    console.log("Bot terputus. Mencoba untuk menghubungkan kembali...");
    reconnect();
  }
});

activeClient.on('error', (error) => {
  if (!isActiveWhatsappClient(activeClient)) return;
  whatsappStatusService.setStatus("unknown", "error", {
    severity: "error",
    message: "WhatsApp client error.",
    errorMessage: error && error.message ? error.message : String(error),
  });
  console.error("Terjadi kesalahan:", error);
});

activeClient.on("disconnected", (reason) => {
  if (!isActiveWhatsappClient(activeClient)) return;
  // Alasan terputus dipilah lebih dulu. Menyambung ulang setelah WhatsApp
  // menandai akun (TOS_BLOCK, UNPAIRED, LOGOUT) justru memperberat
  // penilaiannya - setiap percobaan tercatat.
  const sinyal = banSignalService.recordDisconnect(reason);
  whatsappStatusService.setStatus("disconnected", "disconnected", {
    severity: sinyal.accountLevel ? "critical" : "warning",
    message: sinyal.accountLevel
      ? "Bot dihentikan otomatis: WhatsApp memutus sambungan dengan alasan tingkat akun."
      : "WhatsApp client disconnected.",
    reason,
  });
  if (isShuttingDown) return;
  if (!sinyal.shouldReconnect) {
    console.error(
      `[ALETA Bot] Tidak menyambung ulang. Alasan terputus "${reason}" menunjuk ke keadaan akun, ` +
        `bukan gangguan jaringan. Ajukan banding dari aplikasi WhatsApp, lalu lepaskan penghentian dari portal.`
    );
    return;
  }
  reconnect();
});

let isReconnecting = false;
const reconnect = () => {
  if (isReconnecting || isShuttingDown) return;
  const currentStatus = whatsappStatusService.getStatus().status;
  if (currentStatus === "browser_locked") return;
  isReconnecting = true;
  console.log("Jadwal reconnect dalam 10 detik...");
  whatsappStatusService.setStatus("reconnecting", "reconnect_scheduled", { message: "Reconnect dijadwalkan dalam 10 detik." });
  setTimeout(async () => {
    try {
      console.log("Mencoba untuk menghubungkan kembali...");
      whatsappStatusService.setStatus("reconnecting", "reconnect_attempt", { message: "Mencoba reconnect WhatsApp client." });
      await destroyWhatsappClient("reconnect");
      whatsappInitializePromise = null;
      await sleep(1500);
      recreateWhatsappClientInstance("reconnect");
      void startWhatsappClient("reconnect");
    } catch (err) {
      whatsappStatusService.setStatus("disconnected", "reconnect_failed", {
        severity: "error",
        message: "Reconnect WhatsApp gagal.",
        errorMessage: err.message,
      });
      console.error("Reconnect gagal:", err.message);
    } finally {
      isReconnecting = false;
    }
  }, 10000);
};


/**
 * Satu-satunya cara membalas chat di berkas ini.
 *
 * Seluruh balasan wajib lewat sini supaya perlakuan yang sama berlaku di semua
 * jalur: pembersihan jejak kode, penjelasan istilah hukum, lalu pencatatan
 * corong layanan. Sebelum ada pembantu ini, perbaikan hanya menempel di jalur
 * menu baru sehingga warga yang mengetik perintah lama mendapat mutu jawaban
 * yang berbeda untuk pertanyaan yang sama.
 */
async function balasChat(msg, text, meta = {}) {
    const siap = outgoingChatService.prepareReply(text, {
        withGlossary: meta.withGlossary !== false,
    });
    if (siap && String(siap).trim()) {
        msg.reply(siap, null, { ignoreQuoteErrors: true });
    }

    // Lampiran dikirim lewat pintu yang SAMA, bukan lewat msg.reply terpisah.
    // Seluruh balasan chat harus melewati satu titik ini supaya tidak ada
    // jalur kedua yang melewatkan sanitasi maupun pencatatan statistik -
    // aturan yang dijaga scripts/verify-outgoing-chat.js.
    //
    // Kegagalan mengirim lampiran sengaja tidak menghentikan apa pun: teks
    // balasannya sudah berangkat dan sudah menjelaskan apa yang harus
    // dilakukan bila berkasnya tidak sampai.
    if (meta.attachment && meta.attachment.source) {
        const media = createEcourtDocumentMedia(meta.attachment.source);
        if (media.ok) {
            await msg
                .reply(media.media, null, { sendMediaAsDocument: true, ignoreQuoteErrors: true })
                .catch(() => {});
        }
    }

    // Statistik dicatat setelah balasan dikirim dan tanpa ditunggu.
    void serviceAnalyticsService.record({
        senderNumber: msg.from || "",
        action: meta.action || "",
        optionKey: meta.optionKey || "",
        dataSource: meta.dataSource || "",
        durationMs: meta.durationMs || 0,
    });
    return siap;
}

activeClient.on('message', async (msg) => {
  if (!isActiveWhatsappClient(activeClient)) return;
  if (!msg.body || msg.body.trim() === '') return;

  // Status WhatsApp masuk ke handler ini persis seperti chat biasa. Tanpa
  // penyaringan, msg.reply() di bawah akan MEMBALAS STATUS orang - pesan yang
  // tidak pernah diminta dan tampak seperti bot berkomentar di status pegawai
  // maupun pihak berperkara. Bot hanya melayani chat langsung.
  const alasanTolak = whatsappAudienceService.getIncomingRejectionReason(msg);
  if (alasanTolak) {
    logService.logSystemEvent({
      eventType: "incoming_message_ignored_non_chat",
      severity: "info",
      message: `Pesan masuk diabaikan karena bukan chat langsung (${alasanTolak}).`,
      metadata: {
        reason: alasanTolak,
        sender: msg.from || "",
        messagePreview: String(msg.body || "").replace(/\s+/g, " ").slice(0, 160),
      },
    });
    return;
  }

  // Membuka pesan yang masuk, seperti yang dilakukan orang. Akun yang mengirim
  // ratusan pesan tetapi tidak pernah membuka satu pun pesan masuk berperilaku
  // sebagai corong satu arah - bentuk yang dicari penyaring spam.
  //
  // Tidak ditunggu dan tidak boleh menggagalkan apa pun: ini kosmetik perilaku,
  // sedangkan menjawab pertanyaan pihak adalah tugas yang sebenarnya.
  void humanPresenceService.markSeen(activeClient, msg.from);

  const runtimeConfig = readRuntimeConfig();
  if (!runtimeConfig.botEnabled) {
    logService.logSystemEvent({
      eventType: "incoming_message_ignored_bot_disabled",
      severity: "info",
      message: "Pesan masuk diabaikan karena bot sedang nonaktif dari portal.",
      metadata: {
        sender: msg.from || "",
        messagePreview: String(msg.body || "").replace(/\s+/g, " ").slice(0, 160),
      },
    });
    return;
  }

  console.log("Pesan diterima:", msg.body);

  try {
      let chat = await msg.getChat();

      const rawMessage = String(msg.body || "");
      let message = rawMessage.toLocaleLowerCase();
      let prefix = message.split("#");

      if (!chat.isGroup) {
          // Jawaban verifikasi kepemilikan nomor didahulukan dari semua menu.
          //
          // Kata "ya" dan "bukan" terlalu umum untuk dibiarkan bertabrakan
          // dengan menu lain, tetapi layanannya hanya menanggapi bila memang
          // ada pertanyaan yang sedang menunggu jawaban dari nomor ini -
          // selain itu ia mengembalikan null dan alur di bawah tetap jalan.
          try {
              const jawabanNomor = await nomorVerificationService.handleReply({
                  senderNumber: msg.from || "",
                  text: rawMessage,
              });
              if (jawabanNomor) {
                  await balasChat(msg, jawabanNomor.reply, {
                      action: "verifikasi_nomor",
                      withGlossary: false,
                  });
                  return;
              }
          } catch (error) {
              logService.logSystemEvent({
                  eventType: "verifikasi_nomor_gagal",
                  severity: "warning",
                  message: "Jawaban verifikasi nomor gagal diproses; alur chat lain tetap berjalan.",
                  metadata: { errorMessage: String(error.message || error).slice(0, 200) },
              });
          }

          // Menu verifikasi hakim didahulukan dari menu pihak, karena kata
          // "verifikasi" dan angka pilihannya bisa bertabrakan dengan menu
          // umum. Layanannya mengembalikan null bila pesan ini bukan urusannya,
          // sehingga alur di bawah tetap berjalan seperti biasa.
          try {
              const hasilVerifikasi = await ecourtVerificationService.handleMessage({
                  senderNumber: msg.from || "",
                  text: rawMessage,
              });
              if (hasilVerifikasi) {
                  // Berkasnya ikut lewat balasChat supaya hakim menerima
                  // keterangan dan dokumennya dari satu jalur yang sama.
                  await balasChat(msg, hasilVerifikasi.reply, {
                      action: "ecourt_verifikasi",
                      withGlossary: false,
                      attachment: hasilVerifikasi.attachment || null,
                  });
                  return;
              }
          } catch (error) {
              logService.logSystemEvent({
                  eventType: "ecourt_verification_menu_failed",
                  severity: "warning",
                  message: "Menu verifikasi e-Court gagal; alur chat lain tetap berjalan.",
                  metadata: { errorMessage: String(error.message || error).slice(0, 200) },
              });
          }

          // Menu pilihan bernomor didahulukan: pengguna tidak perlu lagi hafal
          // perintah dan nomor perkaranya. Bila pesan ini bukan urusan menu,
          // handled=false dan seluruh perintah lama tetap berjalan seperti biasa.
          const menuMulaiMs = Date.now();
          const menuResult = await chatMenuService.handleMenuMessage({
              senderNumber: msg.from || "",
              chatId: msg.from || "",
              text: rawMessage,
              answerCommand: (command) => getData(command, { senderNumber: msg.from || "" }),
          });
          if (menuResult.handled) {
              if (menuResult.reply) {
                  await balasChat(msg, menuResult.reply, {
                      action: menuResult.action || "",
                      optionKey: menuResult.optionKey || "",
                      dataSource: menuResult.dataSource || "",
                      durationMs: Date.now() - menuMulaiMs,
                  });
              }
              logService.logSystemEvent({
                  eventType: "chat_menu_handled",
                  severity: "info",
                  message: "Pesan masuk dilayani menu pilihan.",
                  metadata: {
                      action: menuResult.action || "",
                      command: menuResult.command || "",
                  },
              });
              return;
          }

          if (ANTRIAN_CEK_COMMANDS.has(prefix[0].trim())) {
              // ============================================================
              // HANYA PERKARA MILIK PENGIRIMNYA SENDIRI
              // ============================================================
              //
              // Perkaranya dikenali dari NOMOR PENGIRIM saja - tidak ada
              // bentuk "cek antrian#nomor perkara". Menerima nomor perkara
              // berarti siapa pun yang menebak nomor perkara dapat mengetahui
              // apakah pihak lawannya sudah hadir dan sedang menunggu di
              // ruangan mana. Keterangan itu tidak berbahaya di layar ruang
              // tunggu, tempat orangnya memang saling melihat; ia menjadi lain
              // ketika dapat ditanyakan dari jauh oleh siapa saja.
              //
              // Perintah ini juga tidak menulis apa pun - ia hanya membaca.
              try {
                  const peta = await antrianSidangService.petaAntrian();
                  if (!peta.terbaca) {
                      await balasChat(msg, "Maaf, keadaan antrian sedang tidak dapat dibaca. Silakan menghubungi petugas kami.", { action: "no_case", withGlossary: false });
                      return;
                  }

                  const cocok = await antrianOnlineService
                      .findTodayQueueCaseBySender({ senderNumber: msg.from || "" })
                      .catch(() => null);
                  const perkaraId = cocok && cocok.perkaraId ? String(cocok.perkaraId) : "";

                  if (!perkaraId) {
                      await balasChat(msg, "Nomor WhatsApp ini belum tercatat pada perkara yang bersidang hari ini. Silakan menghubungi petugas kami di 0822-7111-5021.", { action: "no_case", withGlossary: false });
                      return;
                  }

                  const jawaban = kehadiranAntrianService.susunJawabanCekAntrian(peta.peta, perkaraId);
                  await balasChat(msg, jawaban, { action: "antrian", withGlossary: false });
              } catch (galat) {
                  logService.logSystemEvent({
                      eventType: "antrian_cek_gagal",
                      severity: "warning",
                      message: "Pemeriksaan antrian gagal dijawab.",
                      metadata: { sender: msg.from || "", errorMessage: String(galat.message || galat).slice(0, 200) },
                  });
                  await balasChat(msg, "Maaf, keadaan antrian sedang tidak dapat dibaca. Silakan menghubungi petugas kami.", { action: "no_case", withGlossary: false });
              }
              return;
          }

          if (ANTRIAN_ONLINE_COMMANDS.has(prefix[0].trim())) {
              // Antrian sidang online: "daftar antrian#123.G.2026" (penggugat),
              // "antrian online#123.G.2026" (tergugat), atau cukup "ambil antrian"
              // bila nomor WhatsApp pengirim sudah tercatat di perkara hari ini.
              const queueCommand = prefix[0].trim();
              const nomorPerkaraInput = rawMessage.split("#").slice(1).join("#").trim();

              if (nomorPerkaraInput) {
                  const access = await guardCaseCommandAccess({
                      senderNumber: msg.from || "",
                      command: queueCommand,
                      nomorPerkara: nomorPerkaraInput,
                  });
                  if (!access.allowed) {
                      await balasChat(msg, access.fallbackMessage || "Untuk keamanan data perkara, nomor WhatsApp ini belum dapat diverifikasi.", { action: "no_case", withGlossary: false });
                      return;
                  }
              }

              const queueResult = await antrianOnlineService.registerOnlineQueue({
                  nomorPerkara: nomorPerkaraInput,
                  message: rawMessage,
                  senderNumber: msg.from || "",
              });

              logService.logSystemEvent({
                  eventType: "online_queue_registration",
                  severity: queueResult.status === "registered" ? "info" : "warning",
                  message: `Pendaftaran antrian online: ${queueResult.status}.`,
                  metadata: {
                      sender: msg.from || "",
                      command: queueCommand,
                      nomorPerkara: queueResult.nomorPerkara || "",
                      partySlot: queueResult.partySlot || "",
                      nomorAntrian: queueResult.nomorAntrian,
                      resolvedBy: queueResult.resolvedBy || "",
                  },
              });

              await balasChat(msg, queueResult.answer, { action: "answered", optionKey: "antrian" });
          } else if (prefix[0] === "detail") {
              const detailParameter = rawMessage.split("#").slice(1).join("#");
              if (detailParameter.trim()) {
                  const access = await guardCaseCommandAccess({
                      senderNumber: msg.from || "",
                      command: "detail",
                      nomorPerkara: detailParameter,
                  });
                  if (!access.allowed) {
                      await balasChat(msg, access.fallbackMessage || "Untuk keamanan data perkara, nomor WhatsApp ini belum dapat diverifikasi.", { action: "no_case", withGlossary: false });
                      return;
                  }
              }
              const response = await detailPerkara(rawMessage);
              await balasChat(msg, response, { action: "answered", optionKey: "detail" });
          } else if (prefix[0] === "ai") {
              const response = await resolveLegacyAiCommandResponse({
                  prompt: prefix.slice(1).join("#"),
                  senderNumber: msg.from || "",
                  senderName: msg._data?.notifyName || "",
                  commandKey: "ai",
              });
              await balasChat(msg, response, { action: "answered", optionKey: "ai" });
          } else if (prefix[0] === "bot") {
              if (prefix[1]) {
                  const response = await resolveLegacyAiCommandResponse({
                      prompt: prefix.slice(1).join("#"),
                      senderNumber: msg.from || "",
                      senderName: msg._data?.notifyName || "",
                      commandKey: "bot",
                  });
                  await balasChat(msg, response, { action: "answered", optionKey: "ai" });
              } else {
                  await balasChat(msg, "Tidak ada isi untuk diproses setelah 'bot'.", { withGlossary: false });
              }
          } else {
              const publicQa = await publicQaIntentService.resolvePublicQaAnswer({
                  message: msg.body,
                  senderNumber: msg.from || "",
                  senderName: msg._data?.notifyName || "",
              });
              let response;
              if (publicQa.handled) {
                  const legacyResponse = publicQa.legacyCommand
                      ? await getData(publicQa.legacyCommand.toLocaleLowerCase(), {
                          senderNumber: msg.from || "",
                          senderName: msg._data?.notifyName || "",
                          allowDynamicQuery: publicQa.intent?.responseMode === "query_template",
                          publicQaIntentKey: publicQa.intent?.key || "",
                          publicQaIntent: publicQa.intent || null,
                      })
                      : "";
                  const finalPublicQa = await publicQaIntentService.finalizePublicQaAnswer({
                      publicQa,
                      message: msg.body,
                      senderNumber: msg.from || "",
                      legacyResponse,
                  });
                  response = finalPublicQa.answer || publicQa.answer || legacyResponse;
              } else {
                  response = await getData(message, {
                      senderNumber: msg.from || "",
                      senderName: msg._data?.notifyName || "",
                  });
              }
              await balasChat(msg, response, {
                  action: "answered",
                  optionKey: publicQa.handled ? String(publicQa.intent?.key || "tanya_bebas") : "perintah_lama",
              });
          }
      } else {
          console.log("Pesan berasal dari grup, tidak diproses");
      }
  } catch (error) {
      console.error("Error yang terjadi:", error);
      await balasChat(msg, "Terjadi kesalahan saat memproses permintaan Anda.", { withGlossary: false });
  }
});
}

// Fungsi untuk mendapatkan nama hari dalam bahasa Indonesia
const getNamaHari = (date) => {
  const hari = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  return hari[date.getDay()];
};

// Fungsi untuk mendapatkan tanggal
const formatTanggal = (date) => {
  const bulan = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  const day = String(date.getDate()).padStart(2, '0');
  const month = bulan[date.getMonth()];
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
};

// Fungsi untuk mendapatkan nama hari besok dalam bahasa Indonesia
const getNamaHariBesok = () => {
  const hari = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1); // Menambahkan satu hari
  return hari[tomorrow.getDay()];
};

// Fungsi untuk mendapatkan tanggal besok
const formatTanggalBesok = () => {
  const bulan = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1); // Menambahkan satu hari
  const day = String(tomorrow.getDate()).padStart(2, '0');
  const month = bulan[tomorrow.getMonth()];
  const year = tomorrow.getFullYear();
  return `${day} ${month} ${year}`;
};

const pengadilan = "Pengadilan Agama Donggala";
const zonaWaktu = "WITA";

//     const messagesToSend = Object.values(messages).filter(value => value !== '');

//     let msg = "*_Hai, saya Aleta, Ai buatan Hakim Derry Briantono, S.H., berikut data keadaan perkara :_* \n\n";
//     msg += messagesToSend.join('\n\n');

//     const messagesToSend = Object.values(messages).filter(value => value !== '');

//     let msg = "*_Hai, saya Aleta, berikut data keadaan perkara :_*\n\n";
//     msg += messagesToSend.join('\n\n');

// TOTAL PENERIMAAN PERKARA AKTIF DAN MEDIASI
const sendKetuaPenerimaanPerkara = async () => { 
  try {
    let promisePerkaraHakim = notification.getTotalPenerimaanPerkaraSemuaHakimLengkap();
    let messagePerkaraHakim = await promisePerkaraHakim;
    let promiseMediasiHakim = notification.getTotalPenerimaanMediasiSemuaHakim();
    let messageMediasiHakim = await promiseMediasiHakim;
    let promisePerkaraPanitera = notification.getTotalPenerimaanPerkaraSemuaPanitera();
    let messagePerkaraPanitera = await promisePerkaraPanitera;
    let promisePerkaraJurusita = notification.getTotalPenerimaanPerkaraSemuaJurusita();
    let messagePerkaraJurusita = await promisePerkaraJurusita;

    if (
      messagePerkaraHakim === "Tidak ada data" &&
      messagePerkaraPanitera === "Tidak ada data" &&
      messagePerkaraJurusita === "Tidak ada data" &&
      messageMediasiHakim === "Tidak ada data"
    ) {
      console.log(`Data tidak ada, tidak mengirim pesan.`);
      return; 
    }

    let msg = `*_Hai, saya Aleta, berikut data keadaan perkara :_*\n\n*DATA PENERIMAAN PERKARA SETIAP HAKIM, DARI JUMLAH TERBESAR KE TERKECIL* :\n${messagePerkaraHakim}\n\n*DATA MEDIASI SETIAP HAKIM, DARI JUMLAH KEBERHASILAN TERBESAR KE TERKECIL* :\n${messageMediasiHakim}`;
    
    return msg;
  } catch (error) {
    console.log(error);
  }
};

cron.schedule("50 07 1 * *", () => {
  runLegacyNotificationIfAllowed("sendKetuaPenerimaanPerkara", [{ id: "ketua-penerimaan-perkara", queryId: "legacy-ketua-penerimaan-perkara" }], () => sendKetuaPenerimaanPerkara().then((message) => {
    if (!message) return;
    Object.values(ketuaId).forEach((id) => {
      client.sendMessage(id, message).then(() => {
        console.log("Pesan berhasil dikirim ke", id);
      }).catch((error) => {
        console.error("Gagal mengirim pesan ke", id, "dengan error:", error);
      });
    });
  }).catch((error) => {
    console.error("Terjadi kesalahan Penerimaan Perkara:", error);
  }));
});

//     let msg = `*_Hai, saya Aleta, berikut data Triwulan :_*\n\n*TRIWULAN E-COURT* :\n${messageTriwulanEcourt}\n\n*TRIWULAN MEDIASI* :\n${messageTriwulanMediasi}`;
    
// NOTIFIKASI UNTUK PANITERA BULANAN
const sendPanitera = async () => {
  try {
    let promiseBA = notification.getDataBA();
    let messageBA = await promiseBA;
    let promisePutusanBelumMinut = notification.getDataPutusanBelumMinut();
    let messagePutusanBelumMinut = await promisePutusanBelumMinut;
    let promiseBelumBhtPerdata = notification.getDataBelumBhtPerdata();
    let messageBelumBhtPerdata = await promiseBelumBhtPerdata;
    let promiseBelumSerahHukum = notification.getDataBelumSerahHukum();
    let messageBelumSerahHukum = await promiseBelumSerahHukum;
    let promiseSaksiTidakLengkap = notification.getDataSaksiTidakLengkap();
    let messageSaksiTidakLengkap = await promiseSaksiTidakLengkap;
    let promiseSisaPanjarPn = notification.getDataSisaPanjarPn();
    let messageSisaPanjarPn = await promiseSisaPanjarPn;
    let promiseSisaPanjarBanding = notification.getDataSisaPanjarBanding();
    let messageSisaPanjarBanding = await promiseSisaPanjarBanding;
    let promiseSisaPanjarKasasi = notification.getDataSisaPanjarKasasi();
    let messageSisaPanjarKasasi = await promiseSisaPanjarKasasi;
    let promiseStatistikDetail = notification.getStatistikDetail();
    let messageStatistikDetail = await promiseStatistikDetail;
    let promiseBelumBhtBanding = notification.getBelumBhtBanding();
    let messageBelumBhtBanding = await promiseBelumBhtBanding;
    let promiseBelumBhtKasasi = notification.getBelumBhtKasasi();
    let messageBelumBhtKasasi = await promiseBelumBhtKasasi;
    let promiseBelumPanggilan = notification.getBelumPanggilan();
    let messageBelumPanggilan = await promiseBelumPanggilan;
    let promiseDatabanding = notification.getDataBanding();
    let messageDataBanding = await promiseDatabanding;
    let promiseDataKasasi = notification.getDataKasasi();
    let messageDataKasasi = await promiseDataKasasi;
    let promiseDataPK = notification.getDataPK();
    let messageDataPK = await promiseDataPK;
    let promiseDataPetitum = notification.getDataEdocPetitum();
    let messageDataPetitum = await promiseDataPetitum;
    let promiseDataEdocAnonimisasi = notification.getDataEdocAnonimisasi();
    let messageDataAnonimisasi = await promiseDataEdocAnonimisasi;
    let promiseDataBelumDelegasi = notification.getDataBelumDelegasi();
    let messageDataBelumDelegasi = await promiseDataBelumDelegasi;
    let promiseDataVerstek = notification.getDataVerstek();
    let messageDataVerstek = await promiseDataVerstek;
    let promiseTundaMediasi = notification.getDataTundaMediasi();
    let messageTundaMediasi = await promiseTundaMediasi;

    const counts = {
      jumlahBA: messageBA === "Tidak ada data" ? 0 : messageBA.split('\n\n').length,
      jumlahPutusanBelumMinut: messagePutusanBelumMinut === "Tidak ada data" ? 0 : messagePutusanBelumMinut.split('\n\n').length,
      jumlahBelumBhtPerdata: messageBelumBhtPerdata === "Tidak ada data" ? 0 : messageBelumBhtPerdata.split('\n\n').length,
      jumlahBelumSerahHukum: messageBelumSerahHukum === "Tidak ada data" ? 0 : messageBelumSerahHukum.split('\n\n').length,
      jumlahSaksiTidakLengkap: messageSaksiTidakLengkap === "Tidak ada data" ? 0 : messageSaksiTidakLengkap.split('\n\n').length,
      jumlahSisaPanjarPn: messageSisaPanjarPn === "Tidak ada data" ? 0 : messageSisaPanjarPn.split('\n\n').length,
      jumlahSisaPanjarBanding: messageSisaPanjarBanding === "Tidak ada data" ? 0 : messageSisaPanjarBanding.split('\n\n').length,
      jumlahSisaPanjarKasasi: messageSisaPanjarKasasi === "Tidak ada data" ? 0 : messageSisaPanjarKasasi.split('\n\n').length,
      jumlahStatistikDetail: messageStatistikDetail === "Tidak ada data" ? 0 : messageStatistikDetail.split('\n\n').length,
      jumlahBelumBhtBanding: messageBelumBhtBanding === "Tidak ada data" ? 0 : messageBelumBhtBanding.split('\n\n').length,
      jumlahBelumBhtKasasi: messageBelumBhtKasasi === "Tidak ada data" ? 0 : messageBelumBhtKasasi.split('\n\n').length,
      jumlahBelumPanggilan: messageBelumPanggilan === "Tidak ada data" ? 0 : messageBelumPanggilan.split('\n\n').length,
      jumlahDataBanding: messageDataBanding === "Tidak ada data" ? 0 : messageDataBanding.split('\n\n').length,
      jumlahDataKasasi: messageDataKasasi === "Tidak ada data" ? 0 : messageDataKasasi.split('\n\n').length,
      jumlahDataPK: messageDataPK === "Tidak ada data" ? 0 : messageDataPK.split('\n\n').length,
      jumlahDataPetitum: messageDataPetitum === "Tidak ada data" ? 0 : messageDataPetitum.split('\n\n').length,
      jumlahDataAnonimisasi: messageDataAnonimisasi === "Tidak ada data" ? 0 : messageDataAnonimisasi.split('\n\n').length,
      jumlahDataBelumDelegasi: messageDataBelumDelegasi === "Tidak ada data" ? 0 : messageDataBelumDelegasi.split('\n\n').length,
      jumlahDataVerstek: messageDataVerstek === "Tidak ada data" ? 0 : messageDataVerstek.split('\n\n').length,
      jumlahTundaMediasi: messageTundaMediasi === "Tidak ada data" ? 0 : messageTundaMediasi.split('\n\n').length
  };
  
  const messages = {
      messageStatistikDetail: counts.jumlahStatistikDetail > 0 ? `*STATISTIK DETAIL PENANGANAN PERKARA TAHUN INI : \n${messageStatistikDetail}` : '',
      messageBelumPanggilan: counts.jumlahBelumPanggilan > 0 ? `*JENIS BELUM PANGGILAN TIDAK SESUAI SEJUMLAH ${counts.jumlahBelumPanggilan} PERKARA* : \n${messageBelumPanggilan}` : '',
      messageTundaMediasi: counts.jumlahTundaMediasi > 0 ? `*PERKARA YANG BELUM DI TUNDA MEDIASI* SEJUMLAH *${counts.jumlahTundaMediasi} PERKARA* : \n${messageTundaMediasi}` : '',
      messageSisaPanjarPn: counts.jumlahSisaPanjarPn > 0 ? `*SISA PANJAR PERKARA TINGKAT PERTAMA YANG TELAH PUTUS DAN BELUM DIKEMBALIKAN SEJUMLAH ${counts.jumlahSisaPanjarPn} PERKARA* : \n${messageSisaPanjarPn}` : '',
      messageSisaPanjarBanding: counts.jumlahSisaPanjarBanding > 0 ? `*SISA PANJAR PERKARA TINGKAT BANDING YANG TELAH PUTUS DAN BELUM DIKEMBALIKAN SEJUMLAH ${counts.jumlahSisaPanjarBanding} PERKARA* : \n${messageSisaPanjarBanding}` : '',
      messageSisaPanjarKasasi: counts.jumlahSisaPanjarKasasi > 0 ? `*SISA PANJAR PERKARA TINGKAT KASASI YANG TELAH PUTUS DAN BELUM DIKEMBALIKAN SEJUMLAH ${counts.jumlahSisaPanjarKasasi} PERKARA* : \n${messageSisaPanjarKasasi}` : '',
      messageBA: counts.jumlahBA > 0 ? `*DATA PERKARA YANG BELUM UPLOAD BAS* SEJUMLAH *${counts.jumlahBA} PERKARA* : \n${messageBA}` : '',
      messageDataBelumDelegasi: counts.jumlahDataBelumDelegasi > 0 ? `*DATA DELEGASI BELUM DILAKSANAKAN* SEJUMLAH *${counts.jumlahDataBelumDelegasi} PERKARA* : \n${messageDataBelumDelegasi}` : '',
      messagePutusanBelumMinut: counts.jumlahPutusanBelumMinut > 0 ? `*DATA PUTUSAN YANG BELUM DI MINUTASI* SEJUMLAH *${counts.jumlahPutusanBelumMinut} PERKARA* : \n${messagePutusanBelumMinut}` : '',
      messageBelumBhtPerdata: counts.jumlahBelumBhtPerdata > 0 ? `*DATA PERKARA PERDATA YANG BELUM BERISI TANGGAL BHT SEJUMLAH ${counts.jumlahBelumBhtPerdata} PERKARA* : \n${messageBelumBhtPerdata}` : '',
      messageBelumBhtBanding: counts.jumlahBelumBhtBanding > 0 ? `*DATA PERKARA BANDING YANG BELUM BERISI TANGGAL BHT SEJUMLAH ${counts.jumlahBelumBhtBanding} PERKARA* : \n${messageBelumBhtBanding}` : '',
      messageBelumBhtKasasi: counts.jumlahBelumBhtKasasi > 0 ? `*DATA PERKARA KASASI YANG BELUM BERISI TANGGAL BHT SEJUMLAH ${counts.jumlahBelumBhtKasasi} PERKARA* : \n${messageBelumBhtKasasi}` : '',
      messageSaksiTidakLengkap: counts.jumlahSaksiTidakLengkap > 0 ? `DATA PERKARA YANG DATA SAKSI TIDAK LENGKAP SEJUMLAH ${counts.jumlahSaksiTidakLengkap} PERKARA* : \n${messageSaksiTidakLengkap}` : '',
      messageDataBanding: counts.jumlahDataBanding > 0 ? `*DATA BANDING BELUM DIKIRIM SEJUMLAH ${counts.jumlahDataBanding} PERKARA* : \n${messageDataBanding}` : '',
      messageDataKasasi: counts.jumlahDataKasasi > 0 ? `**DATA KASASI BELUM DIKIRIM SEJUMLAH ${counts.jumlahDataKasasi} PERKARA* : \n${messageDataKasasi}` : '',
      messageDataPK: counts.jumlahDataPK > 0 ? `*DATA BANDING PK DIKIRIM SEJUMLAH ${counts.jumlahDataPK} PERKARA* : \n${messageDataPK}` : '',
      messageDataPetitum: counts.jumlahDataPetitum > 0 ? `*DATA PERKARA BELUM BERISI EDOC PETITUM SEJUMLAH ${counts.jumlahDataPetitum} PERKARA* : \n${messageDataPetitum}` : '',
      messageDataAnonimisasi: counts.jumlahDataAnonimisasi > 0 ? `*PERKARA PUTUSAN BELUM ANONIMISASI* SEJUMLAH *${counts.jumlahDataAnonimisasi} PERKARA* : \n${messageDataAnonimisasi}` : '',
      messageDataVerstek: counts.jumlahDataVerstek > 0 ? `*JENIS PUTUSAN VERSTEK TIDAK SESUAI (LUPA INPUT VERSTEK) SEJUMLAH ${counts.jumlahDataVerstek} PERKARA* : \n${messageDataVerstek}` : '',
      messageBelumSerahHukum: counts.jumlahBelumSerahHukum > 0 ? `*DATA PERKARA YANG BELUM DISERAHKAN KE BAGIAN HUKUM/ARSIP SEJUMLAH ${counts.jumlahBelumSerahHukum} PERKARA* : \n${messageBelumSerahHukum}` : ''
  };      

    const messagesToSend = Object.values(messages).filter(value => value !== '');

    if (messagesToSend.length === 0) {
      console.log("Data tidak ada, tidak mengirim pesan.");
      return; 
    }

    let msg = "*_Hai, saya Aleta, berikut data keadaan perkara :_*\n\n";
    msg += messagesToSend.join('\n\n');

    return msg;
  } catch (error) {
    console.log(error);
  }
};

cron.schedule("50 07 1 * *", () => {
  runLegacyNotificationIfAllowed("sendPanitera", [{ id: "panitera-monitoring-bulanan", queryId: "legacy-panitera-monitoring-bulanan" }], () => sendPanitera().then((res) => {
    if (!res) return;
    Object.values(paniteraId).forEach((id) => {
      safeSendMessage(id, res).then(() => {
        console.log("Pesan panitera berhasil diproses untuk", id);
      });
    });
  }).catch((error) => {
    console.error("Terjadi kesalahan sendPanitera:", error);
  }));
});

//     let msg = `*_Hai, saya Aleta, berikut data keadaan perkara :_*\n\n*DATA PENERIMAAN PERKARA SETIAP PANITERA, DARI JUMLAH TERBESAR KE TERKECIL* :\n${messagePerkaraPanitera}\n\n*DATA PENERIMAAN PERKARA SETIAP JURUSITA, DARI JUMLAH TERBESAR KE TERKECIL* :\n${messagePerkaraJurusita}`;

//     const messagesToSend = Object.values(messages).filter(value => value !== '');

//     let msg = "*_Hai, saya Aleta, berikut data keadaan perkara (Silahkan Cek Detailnya dengan mengacu pada kode query nya (seperti monev bas) :_*\n\n";
//     msg += messagesToSend.join('\n\n');

//     const counts = { jumlahValidasiHarian: messageBelumValidasi === "Tidak ada data" ? 0 : messageBelumValidasi.split('\n\n').length }; 
    
//     let msg = `_Hai, saya Aleta, berikut yang belum di validasi oleh validator sejumlah *${counts.jumlahValidasiHarian} Proses*_ : \n${messageBelumValidasi}`;
  
//     const messagesToSend = Object.values(messages).filter(value => value !== '');

//     let msg = "*_Hai, saya Aleta, berikut data keadaan perkara :_*\n\n";
//     msg += messagesToSend.join('\n\n');

//     const messagesToSend = Object.values(messages).filter(value => value !== '');

//     let msg = "*_Hai, saya Aleta, berikut data keadaan perkara :_*\n\n";
//     msg += messagesToSend.join('\n\n');

//     const messagesToSend = Object.values(messages).filter(value => value !== '');

//     let msg = "*_Hai, saya Aleta, berikut data keadaan perkara :_* \n\n";
//     msg += messagesToSend.join('\n\n');

//     const messagesToSend = Object.values(messages).filter(value => value !== '');

//     let msg = "*_Hai, saya Aleta, berikut data keadaan perkara :_* \n\n";
//     msg += messagesToSend.join('\n\n');

// cron.schedule("30 09 * * Monday-Friday", () => {
//   sendProduk().then((message) => {
    
// cron.schedule("00 15 * * Monday-Friday", () => {
//   sendProduk().then((message) => {
    
//     const messagesToSend = Object.values(messages).filter(value => value !== '');

//     let msg = "*_Hai, saya Aleta, berikut data keadaan perkara :_* \n\n";
//     msg += messagesToSend.join('\n\n');

// NOTIFIKASI PENJAGA SIDANG
const sendPenjagaSidangHariIni = async () => {
  try {
    let promiseJadwalSidangPerdata = notification.getDataJadwalSidangPerdata();
    let messageJadwalSidangPerdata = await promiseJadwalSidangPerdata;
    let promiseJadwalMediasi = notification.getDataJadwalMediasi();
    let messageJadwalMediasi = await promiseJadwalMediasi;
    let promiseBelumPanggilanHariSidang = notification.getBelumPanggilanHariSidang();
    let messageBelumPanggilanHariSidang = await promiseBelumPanggilanHariSidang;

    const counts = {
      totalSidang: messageJadwalSidangPerdata === "Tidak ada data" ? 0 : messageJadwalSidangPerdata.split('\n\n').length,
      totalMediasi: messageJadwalMediasi === "Tidak ada data" ? 0 : messageJadwalMediasi.split('\n\n').length,
      totalPanggilan: messageBelumPanggilanHariSidang === "Tidak ada data" ? 0 : messageBelumPanggilanHariSidang.split('\n\n').length,
    };

    const messages = {
      messageJadwalSidang: counts.totalSidang > 0 ? `*JADWAL SIDANG HARI INI (${counts.totalSidang} PERKARA)* : \n${messageJadwalSidangPerdata}` : '',
      messageJadwalMediasi: counts.totalMediasi > 0 ? `*JADWAL MEDIASI HARI INI (${counts.totalMediasi} PERKARA)* : \n${messageJadwalMediasi}` : '',
      messagePanggilan: counts.totalPanggilan > 0 ? `*PANGGILAN BELUM DILAKSANAKAN UNTUK SIDANG HARI INI (${counts.totalPanggilan} PERKARA)* : \n${messageBelumPanggilanHariSidang}` : '',
    };

    const messagesToSend = Object.values(messages).filter(value => value !== '');

    if (messagesToSend.length === 0) {
      console.log("Data tidak ada, tidak mengirim pesan.");
      return; 
    }

    let msg = "*_Hai, saya Aleta, berikut data keadaan perkara (Untuk Cek Kode Hakim dan Panitera Ketik : kode) :_* \n\n";
    msg += messagesToSend.join('\n\n');

    return msg;
  } catch (error) {
    console.log(error);
  }
};

const sendPenjagaSidangBesok = async () => {
  try {
    let promiseJadwalSidangBesok = notification.getDataJadwalBesok();
    let messageJadwalSidangBesok = await promiseJadwalSidangBesok;
    let promiseJadwalMediasiBesok = notification.getDataJadwalMediasiBesok();
    let messageJadwalMediasiBesok = await promiseJadwalMediasiBesok;

    const counts = {
      totalSidangBesok: messageJadwalSidangBesok === "Tidak ada data" ? 0 : messageJadwalSidangBesok.split('\n\n').length,
      totalMediasiBesok: messageJadwalMediasiBesok === "Tidak ada data" ? 0 : messageJadwalMediasiBesok.split('\n\n').length,
    };

    const messages = {
      messageJadwalSidangBesok: counts.totalSidangBesok > 0 ? `*JADWAL SIDANG BESOK (${counts.totalSidangBesok} PERKARA)* : \n${messageJadwalSidangBesok}` : '',
      messageJadwalMediasiBesok: counts.totalMediasiBesok > 0 ?`*JADWAL MEDIASI BESOK (${counts.totalMediasiBesok} PERKARA)* : \n${messageJadwalMediasiBesok}` : ''
    };

    const messagesToSend = Object.values(messages).filter(value => value !== '');

    if (messagesToSend.length === 0) {
      console.log("Data tidak ada, tidak mengirim pesan.");
      return; 
    }

    let msg = "*_Hai, saya Aleta, berikut data keadaan perkara untuk besok :_* \n\n";
    msg += messagesToSend.join('\n\n');

    return msg;
  } catch (error) {
    console.log(error);
  }
};

cron.schedule("10 07 * * Monday-Friday", () => {
  runLegacyNotificationIfAllowed("sendPenjagaSidangHariIni", [{ id: "penjaga-sidang-hari-ini", queryId: "legacy-jadwal-sidang-internal" }], () => sendPenjagaSidangHariIni().then((message) => {
    if (!message) return;
    Object.values(penjagaSidangId).forEach((id) => {
      client.sendMessage(id, message).then(() => {
        console.log("Pesan berhasil dikirim ke", id);
      }).catch((error) => {
        console.error("Gagal mengirim pesan ke", id, "dengan error:", error);
      });
    });
  }).catch((error) => {
    console.error("Terjadi kesalahan:", error);
  }));
});

cron.schedule("00 20 * * *", () => {
  runLegacyNotificationIfAllowed("sendPenjagaSidangBesok", [{ id: "penjaga-sidang-besok", queryId: "legacy-jadwal-sidang-internal" }], () => sendPenjagaSidangBesok().then((message) => {
    if (!message) return;
    Object.values(penjagaSidangId).forEach((id) => {
      client.sendMessage(id, message).then(() => {
        console.log("Pesan berhasil dikirim ke", id);
      }).catch((error) => {
        console.error("Gagal mengirim pesan ke", id, "dengan error:", error);
      });
    });
  }).catch((error) => {
    console.error("Terjadi kesalahan:", error);
  }));
});

//     const messagesToSend = Object.values(messages).filter(value => value !== '');

//     let msg = "*_Hai, saya Aleta, berikut data keadaan perkara :_* \n\n";
//     msg += messagesToSend.join('\n\n');

//     const messagesToSend = Object.values(messages).filter(value => value !== '');

//     let msg = "*_Hai, saya Aleta, berikut data keadaan perkara :_* \n\n";
//     msg += messagesToSend.join('\n\n');

//     const counts = { jumlahDelegasi: messageBelumSerahHukum === "Tidak ada data" ? 0 : messageBelumSerahHukum.split('\n\n').length }; 
    
//     let msg = `*_Hai, saya Aleta, berikut data keadaan perkara :_* \n\n*DATA PERKARA YANG BELUM DISERAHKAN KE BAGIAN HUKUM/ARSIP SEJUMLAH ${counts.jumlahDelegasi} PERKARA* : \n${messageBelumSerahHukum}`;

// NOTIFIKASI KASIR HARIAN
const sendPengingatKasir = async () => {
  try {
    
    let promiseSisaPanjarPn = notification.getDataSisaPanjarPn();
    let messageSisaPanjarPn = await promiseSisaPanjarPn;
    let promiseMeteraiRedaksiPsp = notification.getDataMeteraiRedaksiPsp();
    let messageMeteraiRedaksiPsp = await promiseMeteraiRedaksiPsp;
    let promiseDaftarPenetapan = notification.getDataDaftarPenetapan();
    let messageDaftarPenetapan = await promiseDaftarPenetapan;

    const counts = {
      jumlahPanjar: messageSisaPanjarPn === "Tidak ada data" ? 0 : messageSisaPanjarPn.split('\n\n').length,
      jumlahMaterai: messageMeteraiRedaksiPsp === "Tidak ada data" ? 0 : messageMeteraiRedaksiPsp.split('\n\n').length,
      jumlahPenetapan: messageDaftarPenetapan === "Tidak ada data" ? 0 : messageDaftarPenetapan.split('\n\n').length,
    };

    const messages = {
      messagePenetapan: counts.jumlahPenetapan > 0 ? `*PERKARA YANG BELUM PMH/PENUNJUKKAN PP/PENUNJUKKAN JS SERTA PHS SEJUMLAH ${counts.jumlahPenetapan} PERKARA* : \n${messageDaftarPenetapan}` : '',
      messageMaterai: counts.jumlahMaterai > 0 ? `*PERKARA YANG BELUM DIKELUARKAN MATERAI, REDAKSI DAN PSP SEJUMLAH ${counts.jumlahMaterai} PERKARA* : \n${messageMeteraiRedaksiPsp}` : '',
      messagePanjar: counts.jumlahPanjar > 0 ? `*SISA PANJAR PERKARA TINGKAT PERTAMA YANG TELAH PUTUS DAN BELUM DIKEMBALIKAN SEJUMLAH ${counts.jumlahPanjar} PERKARA* : \n${messageSisaPanjarPn}` : '',
    };

    const messagesToSend = Object.values(messages).filter(value => value !== '');

    if (messagesToSend.length === 0) {
      console.log("Data tidak ada, tidak mengirim pesan.");
      return; 
    }

    let msg = "*Hai, mengingatkan kembali tentang situasi keadaan perkara sampai sore hari ini :* \n\n";
    msg += messagesToSend.join('\n\n');

    return msg;
  } catch (error) {
    console.log(error);
  }
};

cron.schedule("30 14 * * Monday-Thursday", () => {
  runLegacyNotificationIfAllowed("sendPengingatKasir", [{ id: "kasir-harian", queryId: "legacy-kasir-panjar" }], () => sendPengingatKasir().then((message) => {
    if (!message) return;
    Object.values(ptspId).forEach((id) => {
      client.sendMessage(id, message).then(() => {
        console.log("Pesan berhasil dikirim ke", id);
      }).catch((error) => {
        console.error("Gagal mengirim pesan ke", id, "dengan error:", error);
      });
    });

    Object.values(kasirId).forEach((id) => {
      safeSendTrackedMessage({
        id,
        message,
        category: "employee",
        notificationKey: "pegawai-kasir-harian",
        idempotencyKey: buildIdempotencyKey({
          notificationKey: "pegawai-kasir-harian",
          recipientNumber: id,
          eventDate: new Date().toISOString().slice(0, 10),
          messageType: "daily-reminder",
        }),
        metadata: { source: "pilot_pegawai_kasir" },
      }).then(() => {
        console.log("Pesan kasir berhasil diproses untuk", id);
      });
    });

  }).catch((error) => {
    console.error("Terjadi kesalahan sendPengingatKasir:", error);
  }));
});

// NOTIFIKASI PENGINGAT TIAP USER SESUAI NAMA
// NOTIFIKASI SIDANG DAN MEDIASI HAKIM
const sendPengingatHakim = async (id, nama, getDataJadwalSidang, getDataJadwalMediasi, role, isBesok = false, testMode = false) => {
  try {
    let messageJadwalSidangPerdata = await getDataJadwalSidang(nama);
    let messageJadwalMediasi = await getDataJadwalMediasi(nama);

    const counts = {
      jumlahSidang: messageJadwalSidangPerdata === "Tidak ada data" ? 0 : messageJadwalSidangPerdata.split('\n\n').length,
      jumlahMediasi: messageJadwalMediasi === "Tidak ada data" ? 0 : messageJadwalMediasi.split('\n\n').length
    };

    if (messageJadwalSidangPerdata === "Tidak ada data" && messageJadwalMediasi === "Tidak ada data") {
      console.log(`Data tidak ada untuk ${role} ${nama}, tidak mengirim pesan.`);
      return; 
    }

    const waktu = isBesok ? "besok" : "hari ini";
    const namaHari = isBesok ? getNamaHariBesok() : getNamaHari(new Date());
    const tanggal = isBesok ? formatTanggalBesok() : formatTanggal(new Date());

    const messages = {
      messageSidang: counts.jumlahSidang > 0 ? `*JADWAL SIDANG ${waktu.toUpperCase()}* SEJUMLAH *${counts.jumlahSidang} PERKARA* : \n${messageJadwalSidangPerdata}` : '',
      messageMediasi: counts.jumlahMediasi > 0 ? `*JADWAL MEDIASI ${waktu.toUpperCase()}* SEJUMLAH *${counts.jumlahMediasi} PERKARA* : \n${messageJadwalMediasi}` : ''
    };

    const messagesToSend = Object.values(messages).filter(value => value !== '');

    if (messagesToSend.length === 0) {
      console.log(`Data tidak ada untuk ${role} ${nama}, tidak mengirim pesan.`);
      return; 
    }

    let msg = `*_Hai, Saya Aleta, mengingatkan kembali persiapan untuk ${role} ${nama} ${waktu} ${namaHari}, tanggal ${tanggal} :_* \n\n`;
    msg += messagesToSend.join('\n\n');

    if (!testMode) {
      await safeSendMessage(id, msg);
      console.log(`Pesan berhasil dikirim ke ${nama} (${id})`);
    } else {
      console.log(`Test Mode: Pesan yang akan dikirim ke ${nama} (${id}): ${msg}`);
    }

    return msg;
  } catch (error) {
    console.error(error);
  }
};

// Mengatur pengingat untuk sidang pagi
const pengingatPagiHakim = (id, nama, getDataJadwalSidang, getDataJadwalMediasi, role, testMode = false) => {
  cron.schedule("15 07 * * Monday-Friday", () => {
    runLegacyNotificationIfAllowed("sendPengingatHakim", [{ id: "hakim-jadwal-sidang" }], () => sendPengingatHakim(id, nama, getDataJadwalSidang, getDataJadwalMediasi, role, false, testMode).then((message) => {
      if (message) {
        console.log(`Pesan berhasil dikirim ke ${nama}`, id);
      }
    }).catch((error) => {
      console.error("Terjadi kesalahan saat mengirim pengingat pagi:", error);
    }));
  });
};

// Mengatur pengingat untuk sidang malam
const pengingatMalamHakim = (id, nama, getDataJadwalSidang, getDataJadwalMediasi, role, testMode = false) => {
  cron.schedule("00 20 * * Sunday-Thursday", () => {
    runLegacyNotificationIfAllowed("sendPengingatHakim", [{ id: "hakim-jadwal-sidang" }], () => sendPengingatHakim(id, nama, getDataJadwalSidang, getDataJadwalMediasi, role, true, testMode).then((message) => {
      if (message) {
        console.log(`Pesan berhasil dikirim ke ${nama}`, id);
      }
    }).catch((error) => {
      console.error("Terjadi kesalahan saat mengirim pengingat malam:", error);
    }));
  });
};

// Mengatur pengingat untuk semua hakim pagi
Object.entries(hakimIds).forEach(([nama, id]) => {
  pengingatPagiHakim(id, nama, notification.getDataJadwalSidangPerdataHakim, notification.getDataJadwalMediasiHakim, "Hakim", false);
});

// Mengatur pengingat untuk semua hakim malam
Object.entries(hakimIds).forEach(([nama, id]) => {
  pengingatMalamHakim(id, nama, notification.getDataJadwalBesokHakim, notification.getDataJadwalMediasiBesokHakim, "Hakim", false);
});

// NOTIFIKASI PENGINGAT SIDANG DAN PENUNDAAN MEDIASI PANITERA
const sendPengingatPaniteraSidang = async (id, nama, getDataJadwalSidang, getDataTundaMediasi, role, isBesok = false, testMode = false) => {
  try {
    let messageJadwalSidangPerdata = await getDataJadwalSidang(nama);
    let messageJadwalMediasi = await getDataTundaMediasi(nama);

    const counts = {
      jumlahSidang: messageJadwalSidangPerdata === "Tidak ada data" ? 0 : messageJadwalSidangPerdata.split('\n\n').length,
      jumlahMediasi: messageJadwalMediasi === "Tidak ada data" ? 0 : messageJadwalMediasi.split('\n\n').length
    };

    if (messageJadwalSidangPerdata === "Tidak ada data" && messageJadwalMediasi === "Tidak ada data") {
      console.log(`Data tidak ada untuk ${role} ${nama}, tidak mengirim pesan.`);
      return;
    }

    const waktu = isBesok ? "besok" : "hari ini";
    const namaHari = isBesok ? getNamaHariBesok() : getNamaHari(new Date());
    const tanggal = isBesok ? formatTanggalBesok() : formatTanggal(new Date());

    const messages = {
      messageSidang: counts.jumlahSidang > 0 ? `*JADWAL SIDANG ${waktu.toUpperCase()}* SEJUMLAH *${counts.jumlahSidang} PERKARA* : \n${messageJadwalSidangPerdata}` : '',
      messageMediasi: counts.jumlahMediasi > 0 ? `*STATUS MEDIASI YANG BELUM DI PROSES* SEJUMLAH *${counts.jumlahMediasi} PERKARA* : \n${messageJadwalMediasi}` : ''
    };

    const messagesToSend = Object.values(messages).filter(value => value !== '');

    let msg = `*_Hai, Saya Aleta, mengingatkan kembali persiapan untuk ${role} ${nama} ${waktu} ${namaHari}, tanggal ${tanggal} :_* \n\n`;
    msg += messagesToSend.join('\n\n');

    if (!testMode) {
      await safeSendMessage(id, msg);
      console.log(`Pesan berhasil dikirim ke ${nama} (${id})`);
    } else {
      console.log(`Test Mode: Pesan yang akan dikirim ke ${nama} (${id}): ${msg}`);
    }

    return msg;
  } catch (error) {
    console.log(error);
  }
};

// Mengatur pengingat untuk sidang pagi
const pengingatPagiPanitera = (id, nama, getDataJadwalSidang, getDataTundaMediasi, role, testMode = false) => {
  cron.schedule("00 07 * * Monday-Friday", () => {
    runLegacyNotificationIfAllowed("sendPengingatPaniteraSidang", [{ id: "panitera-jadwal-sidang" }], () => sendPengingatPaniteraSidang(id, nama, getDataJadwalSidang, getDataTundaMediasi, role, false, testMode).then((message) => {
        if (message) {
          console.log(`Pesan berhasil dikirim ke ${nama}`, id);
        }
      })
      .catch((error) => {
        console.error("Terjadi kesalahan:", error);
      }));
  });
}

// Mengatur pengingat untuk sidang malam
const pengingatMalamPanitera = (id, nama, getDataJadwalSidang, getDataTundaMediasi, role, testMode = false) => {
  cron.schedule("00 20 * * *", () => {
    runLegacyNotificationIfAllowed("sendPengingatPaniteraSidang", [{ id: "panitera-jadwal-sidang" }], () => sendPengingatPaniteraSidang(id, nama, getDataJadwalSidang, getDataTundaMediasi, role, true, testMode).then((message) => {
        if (message) {
          console.log(`Pesan berhasil dikirim ke ${nama}`, id);
        }
      })
      .catch((error) => {
        console.error("Terjadi kesalahan:", error);
      }));
  });
}

// Mengatur pengingat untuk semua panitera pagi
Object.entries(paniteraIds).forEach(([nama, id]) => {
  pengingatPagiPanitera(id, nama, notification.getDataJadwalSidangPerdataPanitera, notification.getDataTundaMediasiPanitera, "Panitera", false);
});

// Mengatur pengingat untuk semua panitera malam
Object.entries(paniteraIds).forEach(([nama, id]) => {
  pengingatMalamPanitera(id, nama, notification.getDataJadwalBesokPaniteraNew, notification.getDataTundaMediasiPanitera, "Panitera", false);
});

// NOTIFIKASI PENGINGAT LUPA MINUT, PUTUSAN, ANONIMISASI DAN TUNDA UNTUK HAKIM
const sendStatusSidangHakim = async (id, nama, getDataPutusanBelumMinut, getDataUploadPutusan, getDataEdocAnonimisasi, getDataLupaTundaHakim, role, testMode = false) => { 
  try {
    let messagePutusanBelumMinut = await getDataPutusanBelumMinut(nama);
    let messageUploadPutusan = await getDataUploadPutusan(nama);
    let messageDataAnonimisasi = await getDataEdocAnonimisasi(nama);
    let messageLupaTunda = await getDataLupaTundaHakim(nama);

    const counts = {
      jumlahBelumMinut: messagePutusanBelumMinut === "Tidak ada data" ? 0 : messagePutusanBelumMinut.split('\n\n').length,
      jumlahUploadPutusan: messageUploadPutusan === "Tidak ada data" ? 0 : messageUploadPutusan.split('\n\n').length,
      jumlahDataAnonimisasi: messageDataAnonimisasi === "Tidak ada data" ? 0 : messageDataAnonimisasi.split('\n\n').length,
      jumlahLupaTunda: messageLupaTunda === "Tidak ada data" ? 0 : messageLupaTunda.split('\n\n').length
    };

    if (messagePutusanBelumMinut === "Tidak ada data" && messageUploadPutusan === "Tidak ada data" && messageDataAnonimisasi === "Tidak ada data" && messageLupaTunda === "Tidak ada data") {
      console.log(`Data tidak ada untuk ${role} ${nama}, tidak mengirim pesan.`);
      return; 
    }

    const messages = {
      messageBelumMinut: counts.jumlahBelumMinut > 0 ? `*DATA PUTUSAN YANG BELUM DI MINUTASI* SEJUMLAH *${counts.jumlahBelumMinut} PERKARA* : \n${messagePutusanBelumMinut}` : '',
      messageUploadPutusan: counts.jumlahUploadPutusan > 0 ? `*PERKARA YANG BELUM UPLOAD PUTUSAN* SEJUMLAH *${counts.jumlahUploadPutusan} PERKARA* : \n${messageUploadPutusan}` : '',
      messageDataAnonimisasi: counts.jumlahDataAnonimisasi > 0 ? `*PERKARA PUTUSAN BELUM ANONIMISASI* SEJUMLAH *${counts.jumlahDataAnonimisasi} PERKARA* : \n${messageDataAnonimisasi}` : '',
      messageLupaTunda: counts.jumlahLupaTunda > 0 ? `*DATA LUPA TUNDA* SEJUMLAH *${counts.jumlahLupaTunda} PERKARA* : \n${messageLupaTunda}` : ''
    };
    
    const messagesToSend = Object.values(messages).filter(value => value !== '');
    
    if (messagesToSend.length === 0) {
      console.log(`Data tidak ada untuk ${role} ${nama}, tidak mengirim pesan.`);
      return; 
    }
    
    let msg = `*Hai, mengingatkan kembali tentang situasi keadaan perkara ${role} ${nama} sampai sore hari ini :*\n\n`;
    msg += messagesToSend.join('\n\n');
    
    if (!testMode) {
      await safeSendMessage(id, msg);
      console.log(`Pesan berhasil dikirim ke ${nama} (${id})`);
    } else {
      console.log(`Test Mode: Pesan yang akan dikirim ke ${nama} (${id}): ${msg}`);
    }

    return msg; 
  } catch (error) {
    console.log(error);
  }
};

// Mengatur pengingat untuk sidang
const statusSidangHakim = (cronTime, id, nama, getDataPutusanBelumMinut, getDataUploadPutusan, getDataEdocAnonimisasi, getDataLupaTundaHakim, role, testMode = false) => { 
  cron.schedule(cronTime, () => {
    runLegacyNotificationIfAllowed("sendStatusSidangHakim", [{ id: "hakim-jadwal-sidang" }], () => sendStatusSidangHakim(id, nama, getDataPutusanBelumMinut, getDataUploadPutusan, getDataEdocAnonimisasi, getDataLupaTundaHakim, role, testMode).then((message) => {
      if (message) {
          console.log(`Pesan berhasil dikirim ke ${nama}`, id);
      }
    }).catch((error) => {
      console.error("Terjadi kesalahan saat mengirim pengingat:", error);
    }));
  });
};

// Mengatur pengingat untuk semua hakim
Object.entries(hakimIds).forEach(([nama, id]) => {
  statusSidangHakim("30 14 * * Monday-Friday", id, nama, notification.getDataPutusanBelumMinutHakim, notification.getDataUploadPutusanHakim, notification.getDataEdocAnonimisasiHakim, notification.getDataLupaTundaHakim, "Majelis Hakim/Hakim Tunggal", false);
  statusSidangHakim("00 19 * * Monday-Friday", id, nama, notification.getDataPutusanBelumMinutHakim, notification.getDataUploadPutusanHakim, notification.getDataEdocAnonimisasiHakim, notification.getDataLupaTundaHakim, "Majelis Hakim/Hakim Tunggal", false);
});

// NOTIFIKASI PENGINGAT MINUTASI, TUNDA MEDIASI DAN TUNDA SIDANG YANG LUPA
const sendStatusSidangPanitera = async (id, nama, getDataPutusanBelumMinut, getDataTundaMediasi, getDataLupaTunda, role, testMode = false) => {
  try {
    let messagePutusanBelumMinut = await getDataPutusanBelumMinut(nama);
    let messageTundaMediasi = await getDataTundaMediasi(nama);
    let messageLupaTunda = await getDataLupaTunda(nama);

    const counts = {
      jumlahBelumMinut: messagePutusanBelumMinut === "Tidak ada data" ? 0 : messagePutusanBelumMinut.split('\n\n').length,
      jumlahTundaMediasi: messageTundaMediasi === "Tidak ada data" ? 0 : messageTundaMediasi.split('\n\n').length,
      jumlahLupaTunda: messageLupaTunda === "Tidak ada data" ? 0 : messageLupaTunda.split('\n\n').length
    };

    if (messagePutusanBelumMinut === "Tidak ada data" && messageTundaMediasi === "Tidak ada data" && messageLupaTunda === "Tidak ada data") {
      console.log(`Data tidak ada untuk ${role} ${nama}, tidak mengirim pesan.`);
      return; 
    }
    
    const messages = {
      messagePutusanBelumMinut: counts.jumlahBelumMinut > 0 ? `*DATA PUTUSAN YANG BELUM DI MINUTASI* SEJUMLAH *${counts.jumlahBelumMinut} PERKARA* : \n${messagePutusanBelumMinut}` : '',
      messageTundaMediasi: counts.jumlahTundaMediasi > 0 ? `*PERKARA YANG BELUM DI TUNDA MEDIASI* SEJUMLAH *${counts.jumlahTundaMediasi} PERKARA* : \n${messageTundaMediasi}` : '',
      messageLupaTunda: counts.jumlahLupaTunda > 0 ? `*PERKARA YANG BELUM DILAKUKAN PENUNDAAN* SEJUMLAH *${counts.jumlahLupaTunda} PERKARA* : \n${messageLupaTunda}` : ''
    };

    const messagesToSend = Object.values(messages).filter(value => value !== '');

    if (messagesToSend.length === 0) {
      console.log(`Data tidak ada untuk ${role} ${nama}, tidak mengirim pesan.`);
      return; 
    }

    let msg = `*_Hai, mengingatkan kembali tentang situasi keadaan perkara ${role} ${nama} sampai sore hari ini :_*\n`;
    msg += messagesToSend.join('\n\n');
    
    if (testMode) {
      console.log(`[TEST MODE] Pesan yang akan dikirim ke ${nama} (${id}): ${msg}`);
    } else {
      await safeSendMessage(id, msg);
      console.log(`Pesan berhasil dikirim ke ${nama} (${id})`);
    }

    return msg;
  } catch (error) {
    console.log(error);
  }
};

// Fungsi untuk menjadwalkan tugas pengiriman status sidang panitera
const statusSidangPanitera = (cronTime, id, nama, getDataPutusanBelumMinut, getDataTundaMediasi, getDataLupaTunda, role, testMode = false) => {
  cron.schedule(cronTime, () => {
    runLegacyNotificationIfAllowed("sendStatusSidangPanitera", [{ id: "panitera-jadwal-sidang" }], () => sendStatusSidangPanitera(id, nama, getDataPutusanBelumMinut, getDataTundaMediasi, getDataLupaTunda, role, testMode).then((message) => {
      if (message) {
          console.log(`Pesan berhasil dikirim ke ${nama}`, id);
      }
    }).catch((error) => {
      console.error("Terjadi kesalahan saat mengirim pengingat:", error);
    }));
  });
};

// Mengatur pengingat untuk semua panitera
Object.entries(paniteraIds).forEach(([nama, id]) => {
  statusSidangPanitera("30 14 * * Monday-Friday", id, nama, notification.getDataPutusanBelumMinutPanitera, notification.getDataTundaMediasiPanitera, notification.getDataLupaTundaPanitera, "Panitera", false);
  statusSidangPanitera("45 18 * * Monday-Friday", id, nama, notification.getDataPutusanBelumMinutPanitera, notification.getDataTundaMediasiPanitera, notification.getDataLupaTundaPanitera, "Panitera", false);
});

// NOTIFIKASI ANTRIAN SIDANG YANG TELAH HADIR HARI INI
const sendAntrianSidangHariIni = async (id, nama, getDataAntrianSidangHariIni, role, testMode = false) => { 
  try {
    let messageAntrianSidangHariIni = await getDataAntrianSidangHariIni(nama);
    console.log(`Hasil ${role} ${nama}:`, messageAntrianSidangHariIni);
    
    const jumlahSidangHariIni = messageAntrianSidangHariIni === "Tidak ada data" ? 0 : messageAntrianSidangHariIni.split('\n\n').length;

    if (messageAntrianSidangHariIni === "Tidak ada data") {
      console.log(`Data tidak ada untuk ${role} ${nama}, tidak mengirim pesan.`);
      return; 
    }

    let msg = `Hai, saya Aleta, sekarang telah pukul 08:55, berikut perkara ditangani oleh ${role} ${nama} yang telah hadir sejumlah *${jumlahSidangHariIni} Perkara* :\n${messageAntrianSidangHariIni}`;
    
    if (testMode) { 
      console.log(`[TEST MODE] Pesan yang akan dikirim ke ${nama} (${id}): ${msg}`);
    } else {
      await safeSendMessage(id, msg);
      console.log(`Pesan berhasil dikirim ke ${nama} (${id})`);
    }

    return msg;
  } catch (error) {
    console.log(`Gagal mengirim pesan ke ${role} ${nama}:`, error);
  }
};

// Mengatur pengingat untuk bas
const statusSidangHariIni = (id, nama, getDataAntrianSidangHariIni, role, testMode = false) => { 
  cron.schedule("55 08 * * Monday-Friday", () => {
    const replacements = /panitera/i.test(role)
      ? [{ id: "panitera-jadwal-sidang" }]
      : [{ id: "hakim-jadwal-sidang" }];
    runLegacyNotificationIfAllowed("sendAntrianSidangHariIni", replacements, () => sendAntrianSidangHariIni(id, nama, getDataAntrianSidangHariIni, role, testMode).then((message) => { 
      if (message) {
        console.log(`Pesan berhasil dikirim ke ${role} ${nama}`, id); 
      }
    }).catch((error) => {
      console.error("Terjadi kesalahan saat mengirim pengingat antrian sidang hari ini:", error);
    }));
  });
}

// Mengatur pengingat untuk semua hakim
Object.entries(hakimIds).forEach(([nama, id]) => {
  statusSidangHariIni(id, nama, notification.getDataAntrianSidangHakim, "Majelis Hakim/Hakim Tunggal", false); 
});

// Mengatur pengingat untuk semua panitera
Object.entries(paniteraIds).forEach(([nama, id]) => {
  statusSidangHariIni(id, nama, notification.getDataAntrianSidangPanitera, "Panitera", false); 
});

// NOTIFIKASI PUTUS DAN TUNDA SIDANG HARI SIDANG JURUSITA
const sendStatusSidangJurusita = async (id, nama, getDataPutusJurusita, getDataTundaJurusita, role, testMode = false) => { 
  try {
    let messagePutusJurusita = await getDataPutusJurusita(nama);
    let messageTundaJurusita = await getDataTundaJurusita(nama);

    const counts = {
      jumlahPutus: messagePutusJurusita === "Tidak ada data" ? 0 : messagePutusJurusita.split('\n\n').length,
      jumlahTunda: messageTundaJurusita === "Tidak ada data" ? 0 : messageTundaJurusita.split('\n\n').length
    };

    if (messagePutusJurusita === "Tidak ada data" && messageTundaJurusita === "Tidak ada data") {
      console.log(`Data tidak ada untuk ${role} ${nama}, tidak mengirim pesan.`);
      return; 
    }

    const messages = {
      messagePutus: counts.jumlahPutus > 0 ? `*PUTUS HARI INI* SEJUMLAH *${counts.jumlahPutus} PERKARA* : \n${messagePutusJurusita}` : '',
      messageTunda: counts.jumlahTunda > 0 ? `*TUNDA HARI INI* SEJUMLAH *${counts.jumlahTunda} PERKARA* : \n${messageTundaJurusita}` : ''
    };

    const messagesToSend = Object.values(messages).filter(value => value !== '');

    if (messagesToSend.length === 0) {
      console.log(`Data tidak ada untuk ${role} ${nama}, tidak mengirim pesan.`);
      return; 
    }

    let msg = `*_Hai, saya Aleta, berikut data keadaan perkara ${role} ${nama} :_*\n`;
    msg += messagesToSend.join('\n\n');

    if (testMode) {
      console.log(`[TEST MODE] Pesan yang akan dikirim ke ${nama} (${id}): ${msg}`);
    } else {
      await safeSendMessage(id, msg);
      console.log(`Pesan berhasil dikirim ke ${nama} (${id})`);
    }

    return msg;
  } catch (error) {
    console.log(error);
  }
};

// Fungsi untuk menjadwalkan tugas pengiriman status sidang jurusita
const statusSidangJurusita = (cronTime, id, nama, getDataPutusJurusita, getDataTundaJurusita, role, testMode = false) => {
  cron.schedule(cronTime, () => {
    runLegacyNotificationIfAllowed("sendStatusSidangJurusita", [{ id: "jurusita-status-relaas" }], () => sendStatusSidangJurusita(id, nama, getDataPutusJurusita, getDataTundaJurusita, role, testMode).then((message) => {
      if (message) {
          console.log(`Pesan berhasil dikirim ke ${nama}`, id);
      }
    }).catch((error) => {
      console.error("Terjadi kesalahan saat mengirim pengingat:", error);
    }));
  });
};

Object.entries(jurusitaIds).forEach(([nama, id]) => {
  statusSidangJurusita("00 12 * * Monday-Friday", id, nama, notification.getDataPutusJurusitaNew, notification.getDataTundaJurusitaNew, "Jurusita", false); 
  statusSidangJurusita("15 16 * * Monday-Friday", id, nama, notification.getDataPutusJurusitaNew, notification.getDataTundaJurusitaNew, "Jurusita", false); 
});

//     const jumlahBas = messageBeritaAcaraSidang === "Tidak ada data" ? 0 : messageBeritaAcaraSidang.split('\n\n').length;

//     let msg = `*_Hai, Saya Aleta, mengingatkan kembali mengenai status BAS untuk ${role} ${nama} :_*\n\n*DATA PERKARA YANG BELUM UPLOAD BAS* SEJUMLAH *${jumlahBas} PERKARA* :\n${messageBeritaAcaraSidang}`;
    
//NOTIFIKASI KEADAAN RELAAS, DELEGASI KELUAR DAN DELEGASI MASUK
const sendRelaasJurusita = async (id, nama, getBelumPanggilan, getDataBelumDelegasi, getDataPemberitahuanPutusanBelum, role, testMode = false) => {
  try {
    let messageBelumPanggilan = await getBelumPanggilan(nama);
    let messageDataBelumDelegasi = await getDataBelumDelegasi(nama);
    let messagePemberitahuanPutusanBelum = await getDataPemberitahuanPutusanBelum(nama);

    const counts = {
      jumlahPanggilan: messageBelumPanggilan === "Tidak ada data" ? 0 : messageBelumPanggilan.split('\n\n').length,
      jumlahDelegasi: messageDataBelumDelegasi === "Tidak ada data" ? 0 : messageDataBelumDelegasi.split('\n\n').length,
      jumlahPemberitahuan: messagePemberitahuanPutusanBelum === "Tidak ada data" ? 0 : messagePemberitahuanPutusanBelum.split('\n\n').length
    };
    
    if (messageBelumPanggilan === "Tidak ada data" && messageDataBelumDelegasi === "Tidak ada data" && messagePemberitahuanPutusanBelum === "Tidak ada data") {
      console.log(`Data tidak ada untuk ${role} ${nama}, tidak mengirim pesan.`);
      return; 
    }

    const messages = {
      messageBelumPanggilan: counts.jumlahPanggilan > 0 ? `*PANGGILAN BELUM DILAKSANAKAN UNTUK SIDANG HARI INI* SEJUMLAH *${counts.jumlahPanggilan} PERKARA* : \n${messageBelumPanggilan}` : '',
      messageDataBelumDelegasi: counts.jumlahDelegasi > 0 ? `*DATA DELEGASI BELUM DILAKSANAKAN* SEJUMLAH *${counts.jumlahDelegasi} PERKARA* : \n${messageDataBelumDelegasi}` : '',
      messagePemberitahuanPutusanBelum: counts.jumlahPemberitahuan > 0 ? `*DATA PERKARA SUDAH PUTUS YANG BELUM DIBERITAHUKAN* SEJUMLAH *${counts.jumlahPemberitahuan} PERKARA* : \n${messagePemberitahuanPutusanBelum}` : ''
    };

    const messagesToSend = Object.values(messages).filter(value => value !== '');

    if (messagesToSend.length === 0) {
      console.log(`Data tidak ada untuk ${role} ${nama}, tidak mengirim pesan.`);
      return; 
    }

    let msg = `*_Hai, mengingatkan kembali tentang situasi keadaan perkara ${role} ${nama} sampai sore hari ini :_*\n`;
    msg += messagesToSend.join('\n\n');
    
    if (testMode) { 
      console.log(`[TEST MODE] Pesan yang akan dikirim ke ${nama} (${id}): ${msg}`);
    } else {
      await safeSendMessage(id, msg);
      console.log(`Pesan berhasil dikirim ke ${nama} (${id})`);
    }

    return msg;
  } catch (error) {
    console.log(error);
  }
};

// Mengatur pengingat untuk relaas jurusita
const statusRelaasJurusita = (id, nama, getBelumPanggilan, getDataBelumDelegasi, getDataPemberitahuanPutusanBelum, role, testMode = false) => {
  cron.schedule("00 09 * * Friday", () => {
    runLegacyNotificationIfAllowed("sendRelaasJurusita", [{ id: "jurusita-status-relaas" }], () => sendRelaasJurusita(id, nama, getBelumPanggilan, getDataBelumDelegasi, getDataPemberitahuanPutusanBelum, role, testMode).then((message) => {
      if (message) {
          console.log(`Pesan berhasil dikirim ke ${nama}`, id);
      }
    }).catch((error) => {
      console.error("Terjadi kesalahan saat mengirim pengingat:", error);
    }));
  });
};

Object.entries(jurusitaIds).forEach(([nama, id]) => {
  statusRelaasJurusita(id, nama, notification.getBelumPanggilanJurusita, notification.getDataBelumDelegasiJurusita, notification.getDataPemberitahuanPutusanBelumJurusita, "Jurusita", false);
});

//     const jumlahPengingatRelaas = messagePengingatRelaas === "Tidak ada data" ? 0 : messagePengingatRelaas.split('\n\n').length;

//     let msg = `*_Hai, saya Aleta, berikut adalah batas akhir pelaksanaan panggilan untuk ${role} ${nama} sejumlah ${jumlahPengingatRelaas} Perkara :_* \n${messagePengingatRelaas}`;
    
//     const jumlahRelaas = messageBelumPanggilanHariIni === "Tidak ada data" ? 0 : messageBelumPanggilanHariIni.split('\n\n').length;

//     let msg = `*_Hai, saya Aleta, berikut data keadaan perkara untuk ${role} ${nama} :_*\n\n*PANGGILAN BELUM DILAKSANAKAN UNTUK SIDANG HARI INI* SEJUMLAH *${jumlahRelaas} PERKARA* : \n${messageBelumPanggilanHariIni}`;
    
//     const messagesToSend = Object.values(messages).filter(value => value !== '');

//     let msg = `*_Hai, berikut keadaan perkara ${role} ${nama} yang ditangani :_*\n`;
//     msg += messagesToSend.join('\n\n');

// NOTIFIKASI PARA PIHAK
// Fungsi untuk mengirim pesan ke pihak baru
const sendPihakBaru = async (testMode = false) => {
  try {
    const { pihakP, pihakT, kuasaP, kuasaT, turutT, intervensi } = await notification.getDataPihakBaru();
    console.log("Pihak P Daftar/Sidang Pertama:", pihakP); 
    console.log("Pihak T Daftar/Sidang Pertama:", pihakT); 
    console.log("Kuasa P Daftar/Sidang Pertama:", kuasaP); 
    console.log("Kuasa T Daftar/Sidang Pertama:", kuasaT); 
    console.log("Turut T Daftar/Sidang Pertama:", turutT); 
    console.log("Intervensi Daftar/Sidang Pertama:", intervensi); 

    const sentMessages = new Set();

    const groupedPihak = {};

    pihakP.forEach(pihak => {
      const key = pihak.perkara_id;
      if (!groupedPihak[key]) {
        groupedPihak[key] = { pihakP: [], pihakT: [], kuasaP: [], kuasaT: [], turutT: [], intervensi: [] };
      }
      groupedPihak[key].pihakP.push(pihak);
    });

    pihakT.forEach(pihak => {
      const key = pihak.perkara_id;
      if (!groupedPihak[key]) {
        groupedPihak[key] = { pihakP: [], pihakT: [], kuasaP: [], kuasaT: [], turutT: [], intervensi: [] };
      }
      groupedPihak[key].pihakT.push(pihak);
    });

    kuasaP.forEach(kuasa => {
      const key = kuasa.perkara_id;
      if (!groupedPihak[key]) {
        groupedPihak[key] = { pihakP: [], pihakT: [], kuasaP: [], kuasaT: [], turutT: [], intervensi: [] };
      }
      groupedPihak[key].kuasaP.push(kuasa);
    });

    kuasaT.forEach(kuasa => {
      const key = kuasa.perkara_id;
      if (!groupedPihak[key]) {
        groupedPihak[key] = { pihakP: [], pihakT: [], kuasaP: [], kuasaT: [], turutT: [], intervensi: [] };
      }
      groupedPihak[key].kuasaT.push(kuasa);
    });

    turutT.forEach(turut => {
      const key = turut.perkara_id;
      if (!groupedPihak[key]) {
        groupedPihak[key] = { pihakP: [], pihakT: [], kuasaP: [], kuasaT: [], turutT: [], intervensi: [] };
      }
      groupedPihak[key].turutT.push(turut);
    });

    intervensi.forEach(intervensi => {
      const key = intervensi.perkara_id;
      if (!groupedPihak[key]) {
        groupedPihak[key] = { pihakP: [], pihakT: [], kuasaP: [], kuasaT: [], turutT: [], intervensi: [] };
      }
      groupedPihak[key].intervensi.push(intervensi);
    });

    // Kirim pesan untuk setiap grup berdasarkan perkara_id
    for (const key in groupedPihak) {
      const { pihakP, pihakT, kuasaP, kuasaT, turutT, intervensi } = groupedPihak[key];

      // Kirim pesan untuk pihak P
      if (pihakP.length > 0) {
        for (const pihak of pihakP) {
          const formattedNumber = phoneNumberFormatter(pihak.telepon);
          const message = `Assalamu'alaikum Warahmatullahi Wabarakatuh,\n\n` +
          `Halo, saya Aleta, Bot ${pengadilan}.\n\n` +
          `Detail perkara:\n\n` +
          `- Nama: Sdr/Sdri *${pihak.nama}*\n` +
          `- Jenis Perkara: *${pihak.jenis_perkara_nama}*\n` +
          `- Nomor Perkara: *${pihak.nomor_perkara}*\n\n` +
          `Pihak yang terlibat:\n` +
          `${pihak.para_pihak}\n\n` +
          `Jadwal Sidang:\n` +
          `- Tanggal: *${pihak.tanggal_sidang}*\n` +
          `- Ruangan: *${pihak.ruangan}*\n\n` +
          `Informasi tambahan:\n` +
          `- Ini adalah notifikasi, anda tidak perlu membalasnya. Panggilan resmi akan disampaikan oleh Jurusita/Petugas Pos ke rumah Anda atau melalui Desa/Kelurahan.\n` +
          `- Untuk informasi lebih lanjut, ketik "perkara" atau hubungi *0822-7111-5021*.\n` +
          `- Mohon isi survei di https://s.id/LTYh1`;

          await sendSippDocumentNotification({
            formattedNumber,
            message,
            documentPath: pihak.petitum_dok,
            recipientRole: "Penggugat Pihak Baru",
            recipientName: pihak.nama,
            caseNumber: pihak.nomor_perkara,
            testMode,
          });
        }
      }

      // Kirim pesan untuk pihak T
      if (pihakT.length > 0) {
        for (const pihak of pihakT) {
          const formattedNumber = phoneNumberFormatter(pihak.telepon);
          const message = `Assalamu'alaikum Warahmatullahi Wabarakatuh,\n\n` +
          `Halo, saya Aleta, Bot ${pengadilan}.\n\n` +
          `Detail perkara:\n\n` +
          `- Nama: Sdr/Sdri *${pihak.nama}*\n` +
          `- Jenis Perkara: *${pihak.jenis_perkara_nama}*\n` +
          `- Nomor Perkara: *${pihak.nomor_perkara}*\n\n` +
          `Pihak yang terlibat:\n` +
          `${pihak.para_pihak}\n\n` +
          `Jadwal Sidang:\n` +
          `- Tanggal: *${pihak.tanggal_sidang}*\n` +
          `- Ruangan: *${pihak.ruangan}*\n\n` +
          `Informasi tambahan:\n` +
          `- Ini adalah notifikasi, anda tidak perlu membalasnya. Panggilan resmi akan disampaikan oleh Jurusita/Petugas Pos ke rumah Anda atau melalui Desa/Kelurahan.\n` +
          `- Untuk informasi lebih lanjut, ketik "perkara" atau hubungi *0822-7111-5021*.\n` +
          `- Mohon isi survei di https://s.id/LTYh1`;

          await sendSippDocumentNotification({
            formattedNumber,
            message,
            documentPath: pihak.petitum_dok,
            recipientRole: "Tergugat Pihak Baru",
            recipientName: pihak.nama,
            caseNumber: pihak.nomor_perkara,
            testMode,
          });
        }
      }

      // Kirim pesan untuk kuasa P
      if (kuasaP.length > 0) {
        for (const kuasa of kuasaP) {
          const formattedNumber = phoneNumberFormatter(kuasa.telepon);
          const message = `Assalamu'alaikum Warahmatullahi Wabarakatuh,\n\n` +
          `Halo, saya Aleta, Bot ${pengadilan}.\n\n` +
          `Detail perkara:\n\n` +
          `- Nama: Sdr/Sdri *${kuasa.nama}*\n` +
          `- Jenis Perkara: *${kuasa.jenis_perkara_nama}*\n` +
          `- Nomor Perkara: *${kuasa.nomor_perkara}*\n\n` +
          `Pihak yang terlibat:\n` +
          `${kuasa.para_pihak}\n\n` +
          `Jadwal Sidang:\n` +
          `- Tanggal: *${kuasa.tanggal_sidang}*\n` +
          `- Ruangan: *${kuasa.ruangan}*\n\n` +
          `Informasi tambahan:\n` +
          `- Ini adalah notifikasi, anda tidak perlu membalasnya. Panggilan resmi akan disampaikan oleh Jurusita/Petugas Pos ke rumah Anda atau melalui Desa/Kelurahan.\n` +
          `- Untuk informasi lebih lanjut, ketik "perkara" atau hubungi *0822-7111-5021*.\n` +
          `- Mohon isi survei di https://s.id/LTYh1`;

          await sendSippDocumentNotification({
            formattedNumber,
            message,
            documentPath: kuasa.petitum_dok,
            recipientRole: "Kuasa Penggugat Pihak Baru",
            recipientName: kuasa.nama,
            caseNumber: kuasa.nomor_perkara,
            testMode,
          });
        }
      }

      // Kirim pesan untuk kuasa T
      if (kuasaT.length > 0) {
        for (const kuasa of kuasaT) {
          const formattedNumber = phoneNumberFormatter(kuasa.telepon);
          const message = `Assalamu'alaikum Warahmatullahi Wabarakatuh,\n\n` +
          `Halo, saya Aleta, Bot ${pengadilan}.\n\n` +
          `Detail perkara:\n\n` +
          `- Nama: Sdr/Sdri *${kuasa.nama}*\n` +
          `- Jenis Perkara: *${kuasa.jenis_perkara_nama}*\n` +
          `- Nomor Perkara: *${kuasa.nomor_perkara}*\n\n` +
          `Pihak yang terlibat:\n` +
          `${kuasa.para_pihak}\n\n` +
          `Jadwal Sidang:\n` +
          `- Tanggal: *${kuasa.tanggal_sidang}*\n` +
          `- Ruangan: *${kuasa.ruangan}*\n\n` +
          `Informasi tambahan:\n` +
          `- Ini adalah notifikasi, anda tidak perlu membalasnya. Panggilan resmi akan disampaikan oleh Jurusita/Petugas Pos ke rumah Anda atau melalui Desa/Kelurahan.\n` +
          `- Untuk informasi lebih lanjut, ketik "perkara" atau hubungi *0822-7111-5021*.\n` +
          `- Mohon isi survei di https://s.id/LTYh1`;

          await sendSippDocumentNotification({
            formattedNumber,
            message,
            documentPath: kuasa.petitum_dok,
            recipientRole: "Kuasa Tergugat Pihak Baru",
            recipientName: kuasa.nama,
            caseNumber: kuasa.nomor_perkara,
            testMode,
          });
        }
      }

      // Kirim pesan untuk turut T
      if (turutT.length > 0) {
        for (const turut of turutT) {
          const formattedNumber = phoneNumberFormatter(turut.telepon);
          const message = `Assalamu'alaikum Warahmatullahi Wabarakatuh,\n\n` +
          `Halo, saya Aleta, Bot ${pengadilan}.\n\n` +
          `Detail perkara:\n\n` +
          `- Nama: Sdr/Sdri *${turut.nama}*\n` +
          `- Jenis Perkara: *${turut.jenis_perkara_nama}*\n` +
          `- Nomor Perkara: *${turut.nomor_perkara}*\n\n` +
          `Pihak yang terlibat:\n` +
          `${turut.para_pihak}\n\n` +
          `Jadwal Sidang:\n` +
          `- Tanggal: *${turut.tanggal_sidang}*\n` +
          `- Ruangan: *${turut.ruangan}*\n\n` +
          `Informasi tambahan:\n` +
          `- Ini adalah notifikasi, anda tidak perlu membalasnya. Panggilan resmi akan disampaikan oleh Jurusita/Petugas Pos ke rumah Anda atau melalui Desa/Kelurahan.\n` +
          `- Untuk informasi lebih lanjut, ketik "perkara" atau hubungi *0822-7111-5021*.\n` +
          `- Mohon isi survei di https://s.id/LTYh1`;

          await sendSippDocumentNotification({
            formattedNumber,
            message,
            documentPath: turut.petitum_dok,
            recipientRole: "Turut Tergugat Pihak Baru",
            recipientName: turut.nama,
            caseNumber: turut.nomor_perkara,
            testMode,
          });
        }
      }

      // Kirim pesan untuk intervensi
      if (intervensi.length > 0) {
        for (const inv of intervensi) {
          const formattedNumber = phoneNumberFormatter(inv.telepon);
          const message = `Assalamu'alaikum Warahmatullahi Wabarakatuh,\n\n` +
          `Halo, saya Aleta, Bot ${pengadilan}.\n\n` +
          `Detail perkara:\n\n` +
          `- Nama: Sdr/Sdri *${inv.nama}*\n` +
          `- Jenis Perkara: *${inv.jenis_perkara_nama}*\n` +
          `- Nomor Perkara: *${inv.nomor_perkara}*\n\n` +
          `Pihak yang terlibat:\n` +
          `${inv.para_pihak}\n\n` +
          `Jadwal Sidang:\n` +
          `- Tanggal: *${inv.tanggal_sidang}*\n` +
          `- Ruangan: *${inv.ruangan}*\n\n` +
          `Informasi tambahan:\n` +
          `- Ini adalah notifikasi, anda tidak perlu membalasnya. Panggilan resmi akan disampaikan oleh Jurusita/Petugas Pos ke rumah Anda atau melalui Desa/Kelurahan.\n` +
          `- Untuk informasi lebih lanjut, ketik "perkara" atau hubungi *0822-7111-5021*.\n` +
          `- Mohon isi survei di https://s.id/LTYh1`;

          await sendSippDocumentNotification({
            formattedNumber,
            message,
            documentPath: inv.petitum_dok,
            recipientRole: "Intervensi Pihak Baru",
            recipientName: inv.nama,
            caseNumber: inv.nomor_perkara,
            testMode,
          });
        }
      }
    }
  } catch (error) {
    console.error('Gagal mengambil data atau mengirim pesan:', error.message);
  }
};

const sendMessagePihakBaru = (testMode = false) => {
  cron.schedule("00 17 * * Monday-Friday", () => {
    runLegacyNotificationIfAllowed("sendPihakBaru", [{ id: "pihak-baru", queryId: "legacy-pihak-baru" }, { id: "party-registration", queryId: "legacy-pihak-baru" }], async () => {
      try {
          if (testMode) {
              console.log("Test mode aktif. Pesan tidak akan dikirim.");
              return;
          }
          
          console.log("Mengirim pesan untuk pihak baru...");
          await sendPihakBaru(testMode); // Memanggil fungsi sendPihakBaru dengan testMode
          console.log("Pengiriman pesan selesai.");
      } catch (error) {
          console.error("Terjadi kesalahan saat mengirim pesan:", error);
      }
    });
  });
};

// Panggil fungsi penjadwalan
sendMessagePihakBaru();

// Fungsi untuk mengirim pesan akta cerai
const sendPihakAktaCerai = async (testMode = false) => {
    try {
        const { pihakP, pihakT } = await notification.getDataPihakAktaCerai(); // Ambil data akta cerai
        console.log("Data Akta Cerai Pihak P:", pihakP); // Log data akta cerai pihak P
        console.log("Data Akta Cerai Pihak T:", pihakT); // Log data akta cerai pihak T

        const groupedPihak = {};

        pihakP.forEach(pihak => {
            const key = pihak.perkara_id;
            if (!groupedPihak[key]) {
                groupedPihak[key] = { pihakP: [], pihakT: [], kuasaP: [], kuasaT: [], turutT: [], intervensi: [] };
            }
            groupedPihak[key].pihakP.push(pihak);
        });

        pihakT.forEach(pihak => {
            const key = pihak.perkara_id;
            if (!groupedPihak[key]) {
                groupedPihak[key] = { pihakP: [], pihakT: [], kuasaP: [], kuasaT: [], turutT: [], intervensi: [] };
            }
            groupedPihak[key].pihakT.push(pihak);
        });

        // Kirim pesan untuk setiap grup berdasarkan perkara_id
        for (const key in groupedPihak) {
            const { pihakP, pihakT } = groupedPihak[key];

            const sentMessages = new Set();

            // Kirim pesan untuk pihak P
            for (const pihak of pihakP) {
                const formattedNumber = phoneNumberFormatter(pihak.telepon);
                const message = `Assalamu'alaikum Warahmatullahi Wabarakatuh,\n\n` +
                `Halo, saya Aleta, Bot ${pengadilan}.\n` +
                `Informasi mengenai Akta Cerai Anda:\n` +
                `- Nomor Perkara: ${pihak.nomor_perkara}\n` +
                `- Nama: *${pihak.nama}*\n` +
                `- Nomor Seri Akta Cerai: *${pihak.no_seri_akta_cerai}*\n` +
                `- Tanggal Terbit Akta Cerai: *${pihak.tanggal_akta_cerai}*\n\n` +
                `Akta Cerai sekarang dapat diambil secara online.\n` +
                `Silahkan mengunjungi https://eac.mahkamahagung.go.id/ dan apabila masih belum memahami silahkan hubungi *0822-7111-5021*.\n\n` +
                `Ini adalah notifikasi, Anda tidak perlu membalasnya. Abaikan pesan ini jika Akta Cerai telah diambil. Terima kasih.`;

                if (!sentMessages.has(formattedNumber)) {
                  try {
                    if (testMode) {
                      console.log(`[TEST MODE] Akan mengirim pesan ke ${formattedNumber}:\n${message}`);
                    } else {
                      await safeSendMessage(formattedNumber, message);
                      console.log(`Pesan berhasil dikirim ke Penggugat Akta Cerai ${pihak.nama} (${formattedNumber}) untuk perkara ${pihak.nomor_perkara}`);
                    }
                  } catch (sendError) {
                    console.error(`Gagal kirim pesan ke ${pihak.nama} (${formattedNumber}) untuk perkara ${pihak.nomor_perkara}: ${sendError.message}`);
                  }
                  sentMessages.add(formattedNumber);
                }
            }

            // Kirim pesan untuk pihak T
            for (const pihak of pihakT) {
                const formattedNumber = phoneNumberFormatter(pihak.telepon);
                const message = `Assalamu'alaikum Warahmatullahi Wabarakatuh,\n\n` +
                `Halo, saya Aleta, Bot ${pengadilan}.\n` +
                `Informasi mengenai Akta Cerai Anda:\n` +
                `- Nomor Perkara: ${pihak.nomor_perkara}\n` +
                `- Nama: *${pihak.nama}*\n` +
                `- Nomor Seri Akta Cerai: *${pihak.no_seri_akta_cerai}*\n` +
                `- Tanggal Terbit Akta Cerai: *${pihak.tanggal_akta_cerai}*\n\n` +
                `Akta Cerai sekarang dapat diambil secara online.\n` +
                `Silahkan mengunjungi https://eac.mahkamahagung.go.id/ dan apabila masih belum memahami silahkan hubungi *0822-7111-5021*.\n\n` +
                `Ini adalah notifikasi, Anda tidak perlu membalasnya. Abaikan pesan ini jika Akta Cerai telah diambil. Terima kasih.`;

                if (!sentMessages.has(formattedNumber)) {
                  try {
                    if (testMode) {
                      console.log(`[TEST MODE] Akan mengirim pesan ke ${formattedNumber}:\n${message}`);
                    } else {
                      await safeSendMessage(formattedNumber, message);
                      console.log(`Pesan berhasil dikirim ke ${pihak.nama} (${formattedNumber}) untuk perkara ${pihak.nomor_perkara}`);
                    }
                  } catch (sendError) {
                    console.error(`Gagal kirim pesan ke Tergugat Akta Cerai ${pihak.nama} (${formattedNumber}) untuk perkara ${pihak.nomor_perkara}: ${sendError.message}`);
                  }
                  sentMessages.add(formattedNumber);
                }
            }
        }
    } catch (error) {
        console.error("Error sending akta cerai messages:", error);
    }
};

const sendMessagePihakAktaCerai = (testMode = false) => {
  cron.schedule("00 16 * * *", () => {
    runLegacyNotificationIfAllowed("sendPihakAktaCerai", [{ id: "pihak-akta-cerai", queryId: "legacy-pihak-akta-cerai" }, { id: "party-akta-cerai", queryId: "legacy-pihak-akta-cerai" }], async () => {
      try {
          if (testMode) {
              console.log("Test mode aktif. Pesan tidak akan dikirim.");
              return;
          }
          
          console.log("Mengirim pesan untuk pihak belum ambil akta cerai ...");
          await sendPihakAktaCerai(testMode);
          console.log("Pengiriman pesan selesai.");
      } catch (error) {
          console.error("Terjadi kesalahan saat mengirim pesan:", error);
      }
    });
  });
};

sendMessagePihakAktaCerai();

// Fungsi untuk mengirim pesan kurang sisa panjar
const sendPihakSisaPanjar = async (testMode = false) => {
  try {
    const { sisaPanjar } = await notification.getDataHabisBiaya();
    console.log("Sisa Panjar:", sisaPanjar); // Log data Sisa Panjar

    const sentMessages = new Set();

    if (sisaPanjar && sisaPanjar.length > 0) {
      for (const pihak of sisaPanjar) {
        const formattedNumber = phoneNumberFormatter(pihak.telepon);
        const message = `Assalamu'alaikum Warahmatullahi Wabarakatuh,\n\n` +
        `Sdr/Sdri **${pihak.nama}**, perkara Nomor ${pihak.nomor_perkara} memiliki sisa biaya:\n` +
        `- Kurang dari Rp100.000,00 atau telah habis.\n\n` +
        `Tindakan yang perlu dilakukan:\n` +
        `1. Silakan ke PTSP ${pengadilan} untuk arahan penambahan panjar.\n` +
        `2. Lakukan pembayaran hanya di kasir ${pengadilan}.\n\n` +
        `Untuk cek biaya, ketik:\n` +
        `biaya#${pihak.nomor_urut_perkara}.${pihak.alur_status}.${pihak.tahun_pendaftaran}\n\n` +
        `Ini adalah notifikasi, anda tidak perlu membalasnya.\nInfo lebih lanjut hubungi *0822-7111-5021*.`;

        if (!sentMessages.has(formattedNumber)) {
          try {
            if (testMode) {
              console.log(`[TEST MODE] Akan mengirim pesan ke ${formattedNumber}:\n${message}`);
            } else {
              await safeSendTrackedMessage({
                id: formattedNumber,
                message,
                category: "party",
                notificationKey: "pihak-sisa-panjar",
                recipientName: pihak.nama,
                idempotencyKey: buildIdempotencyKey({
                  notificationKey: "pihak-sisa-panjar",
                  perkaraId: pihak.perkara_id,
                  nomorPerkara: pihak.nomor_perkara,
                  recipientNumber: formattedNumber,
                  eventDate: new Date().toISOString().slice(0, 10),
                  messageType: "sisa-panjar-habis",
                }),
                metadata: {
                  source: "pilot_pihak_sisa_panjar",
                  nomorPerkara: pihak.nomor_perkara,
                  perkaraId: pihak.perkara_id,
                },
              });
              console.log(`Pesan berhasil dikirim ke Pihak Sisa Panjar ${pihak.nama} (${formattedNumber}) untuk perkara ${pihak.nomor_perkara}`);
            }
          } catch (sendError) {
            console.error(`Gagal kirim pesan ke Pihak Sisa Panjar ${pihak.nama} (${formattedNumber}) untuk perkara ${pihak.nomor_perkara}: ${sendError.message}`);
          }
          sentMessages.add(formattedNumber);
        }
      }
    }
  } catch (error) {
    console.error("Error sending sisa panjar messages:", error);
  }
};

const sendMessagePihakPanjar = (testMode = false) => {
  cron.schedule("00 19 * * *", () => {
    runLegacyNotificationIfAllowed("sendPihakSisaPanjar", [{ id: "pihak-sisa-panjar", queryId: "legacy-pihak-sisa-panjar" }, { id: "party-sisa-panjar", queryId: "legacy-pihak-sisa-panjar" }], async () => {
      try {
          if (testMode) {
              console.log("Test mode aktif. Pesan tidak akan dikirim.");
              return;
          }
          
          console.log("Mengirim pesan untuk pihak kurang panjar ...");
          await sendPihakSisaPanjar(testMode);
          console.log("Pengiriman pesan selesai.");
      } catch (error) {
          console.error("Terjadi kesalahan saat mengirim pesan:", error);
      }
    });
  });
};

sendMessagePihakPanjar();

// Fungsi untuk mengirim pesan sisa panjar yang belum diambil
const sendPihakPanjarBelum = async (testMode = false) => {
  try {
    const { sisaPertama, sisaBanding, sisaKasasi, sisaPk, sisaEksekusi } = await notification.getDataPihakSisaPanjar();
    const allSisaPanjar = [...sisaPertama, ...sisaBanding, ...sisaKasasi, ...sisaPk, ...sisaEksekusi];
    console.log("Sisa Panjar Belum:", allSisaPanjar); // Log data Sisa Panjar

    const sentMessages = new Set();

    if (allSisaPanjar && allSisaPanjar.length > 0) {
      for (const pihak of allSisaPanjar) {
        const formattedNumber = phoneNumberFormatter(pihak.telepon);
        const message = `Assalamu'alaikum Warahmatullahi Wabarakatuh,\n\n` +
        `Sdr/Sdri *${pihak.nama}*, perkara Nomor ${pihak.nomor_perkara} memiliki sisa panjar yang belum diambil, yaitu sejumlah :\n\n` +
        `Sisa Panjar : ${pihak.sisa}\n\n` +
        `Silakan ke PTSP ${pengadilan} untuk arahan lebih lanjut.\n\n` +
        `Untuk cek biaya, ketik:\n\n` +
        `biaya#${pihak.nomor_urut_perkara}.${pihak.alur_status}.${pihak.tahun_pendaftaran}\n\n` +
        `Ini adalah notifikasi, anda tidak perlu membalasnya.\nAtau hubungi *0822-7111-5021* untuk info lebih lanjut.`;

        if (!sentMessages.has(formattedNumber)) {
          try {
            if (testMode) {
              console.log(`[TEST MODE] Akan mengirim pesan ke ${formattedNumber}:\n${message}`);
            } else {
              await safeSendMessage(formattedNumber, message);
              console.log(`Pesan berhasil dikirim ke Pihak Panjar Belum ${pihak.nama} (${formattedNumber}) untuk perkara ${pihak.nomor_perkara}`);
            }
          } catch (sendError) {
            console.error(`Gagal kirim pesan ke Pihak Panjar Belum ${pihak.nama} (${formattedNumber}) untuk perkara ${pihak.nomor_perkara}: ${sendError.message}`);
          }
          sentMessages.add(formattedNumber);
        }
      }
    }
  } catch (error) {
    console.error("Error sending panjar belum messages:", error);
  }
};

// Menjadwalkan pengiriman pesan panjar yang belum dibayar
const sendMessagePihakPanjarBelum = (testMode = false) => {
  cron.schedule("30 15 * * *", () => { // Atur waktu sesuai kebutuhan
    runLegacyNotificationIfAllowed("sendPihakPanjarBelum", [{ id: "pihak-sisa-panjar", queryId: "legacy-pihak-sisa-panjar" }, { id: "party-panjar-habis", queryId: "legacy-pihak-sisa-panjar" }], async () => {
      try {
          if (testMode) {
              console.log("Test mode aktif. Pesan tidak akan dikirim.");
              return;
          }
          
          console.log("Mengirim pesan untuk pihak panjar yang belum dibayar ...");
          await sendPihakPanjarBelum(testMode);
          console.log("Pengiriman pesan selesai.");
      } catch (error) {
          console.error("Terjadi kesalahan saat mengirim pesan:", error);
      }
    });
  });
};

sendMessagePihakPanjarBelum();

// Fungsi untuk mengirim pesan putusan
const sendPihakPutusan = async (testMode = false) => {
  try {
    const { pihakP: putusanP, pihakT: putusanT, kuasaP: putusanKuasaP, kuasaT: putusanKuasaT, turutT: putusanTurutT, intervensi: putusanIntervensi } = await notification.getDataPutusanPihak(); // Ambil data putusan
    console.log("Data Putusan Pihak P:", putusanP); // Log data putusan pihak P
    console.log("Data Putusan Pihak T:", putusanT); // Log data putusan pihak T
    console.log("Data Putusan Kuasa P:", putusanKuasaP); // Log data putusan kuasa P
    console.log("Data Putusan Kuasa T:", putusanKuasaT); // Log data putusan kuasa T
    console.log("Data Putusan Turut T:", putusanTurutT); // Log data putusan turut T
    console.log("Data Putusan Intervensi:", putusanIntervensi); // Log data putusan intervensi

    const sentMessages = new Set();

    const groupedPihak = {};

    putusanP.forEach(pihak => {
      const key = pihak.perkara_id;
      if (!groupedPihak[key]) {
        groupedPihak[key] = { pihakP: [], pihakT: [], kuasaP: [], kuasaT: [], turutT: [], intervensi: [] };
      }
      groupedPihak[key].pihakP.push(pihak);
    });

    putusanT.forEach(pihak => {
      const key = pihak.perkara_id;
      if (!groupedPihak[key]) {
        groupedPihak[key] = { pihakP: [], pihakT: [], kuasaP: [], kuasaT: [], turutT: [], intervensi: [] };
      }
      groupedPihak[key].pihakT.push(pihak);
    });

    putusanKuasaP.forEach(kuasa => {
      const key = kuasa.perkara_id;
      if (!groupedPihak[key]) {
        groupedPihak[key] = { pihakP: [], pihakT: [], kuasaP: [], kuasaT: [], turutT: [], intervensi: [] };
      }
      groupedPihak[key].kuasaP.push(kuasa);
    });

    putusanKuasaT.forEach(kuasa => {
      const key = kuasa.perkara_id;
      if (!groupedPihak[key]) {
        groupedPihak[key] = { pihakP: [], pihakT: [], kuasaP: [], kuasaT: [], turutT: [], intervensi: [] };
      }
      groupedPihak[key].kuasaT.push(kuasa);
    });

    putusanTurutT.forEach(turut => {
      const key = turut.perkara_id;
      if (!groupedPihak[key]) {
        groupedPihak[key] = { pihakP: [], pihakT: [], kuasaP: [], kuasaT: [], turutT: [], intervensi: [] };
      }
      groupedPihak[key].turutT.push(turut);
    });

    putusanIntervensi.forEach(intervensi => {
      const key = intervensi.perkara_id;
      if (!groupedPihak[key]) {
        groupedPihak[key] = { pihakP: [], pihakT: [], kuasaP: [], kuasaT: [], turutT: [], intervensi: [] };
      }
      groupedPihak[key].intervensi.push(intervensi);
    });

    // Kirim pesan untuk setiap grup berdasarkan perkara_id
    for (const key in groupedPihak) {
      const { pihakP, pihakT, kuasaP, kuasaT, turutT, intervensi } = groupedPihak[key];

      // Kirim notifikasi putusan untuk pihak P
      if (pihakP.length > 0) {
        for (const putusan of pihakP) { // Iterasi semua putusan P
          const formattedNumber = phoneNumberFormatter(putusan.telepon); // Format nomor telepon
          const message = `Assalamualaikum Warahmatullahi Wabarakatuh,\n\n` +
          `Halo, saya Aleta, Bot ${pengadilan}.\n\n` +
          `Detail Putusan Perkara:\n` +
          `- Nama: Sdr/Sdri *${putusan.nama}*\n` +
          `- Jenis Perkara: *${putusan.jenis_perkara_nama}*\n` +
          `- Nomor Perkara: *${putusan.nomor_perkara}*\n` +
          `- Status Putusan: *${putusan.status_putusan_kode}*\n\n` +
          `Para Pihak:\n` +
          `${putusan.para_pihak}\n\n` +
          `Amar Putusan:\n` +
          `${putusan.amar_putusan}` +
          `- Unduh file PDF di ${putusan.link_dirput}\n\n` +
          `Instruksi Jika Keberatan:\n` +
          `- Ajukan upaya hukum dalam waktu 14 hari setelah putusan dibacakan atau setelah menerima pemberitahuan resmi dari Jurusita.\n` +
          `- Jika tidak hadir saat pembacaan, pemberitahuan akan dikirim ke rumah atau Desa/Kelurahan setempat.\n\n` +
          `Informasi Tambahan:\n` +
          `- Ini adalah notifikasi dan bukan pemberitahuan resmi, anda tidak perlu membalasnya.\n` +
          `- Info lebih lanjut: WhatsApp *0822-7111-5021*.`;

          if (!sentMessages.has(formattedNumber)) {
            if (testMode) {
              console.log(`[TEST MODE] Akan mengirim pesan ke ${formattedNumber}:\n${message}`);
            } else {
              try {
                await safeSendMessage(formattedNumber, message);
                console.log(`Pesan berhasil dikirim ke Pihak Penggugat Putusan ${putusan.nama} (${formattedNumber}) untuk perkara ${putusan.nomor_perkara}`);
              } catch (sendError) {
                console.error(`Gagal kirim pesan ke Pihak Penggugat Putusan ${putusan.nama} (${formattedNumber}) untuk perkara ${putusan.nomor_perkara}: ${sendError.message}`);
              }
            }
            sentMessages.add(formattedNumber);
          }
        }
      }

      // Kirim notifikasi putusan untuk pihak T
      if (pihakT.length > 0) {
        for (const putusan of pihakT) { // Iterasi semua putusan T
          const formattedNumber = phoneNumberFormatter(putusan.telepon); // Format nomor telepon
          const message = `Assalamualaikum Warahmatullahi Wabarakatuh,\n\n` +
          `Halo, saya Aleta, Bot ${pengadilan}.\n\n` +
          `Detail Putusan Perkara:\n` +
          `- Nama: Sdr/Sdri *${putusan.nama}*\n` +
          `- Jenis Perkara: *${putusan.jenis_perkara_nama}*\n` +
          `- Nomor Perkara: *${putusan.nomor_perkara}*\n` +
          `- Status Putusan: *${putusan.status_putusan_kode}*\n\n` +
          `Para Pihak:\n` +
          `${putusan.para_pihak}\n\n` +
          `Amar Putusan:\n` +
          `${putusan.amar_putusan}` +
          `- Unduh file PDF di ${putusan.link_dirput}\n\n` +
          `Instruksi Jika Keberatan:\n` +
          `- Ajukan upaya hukum dalam waktu 14 hari setelah putusan dibacakan atau setelah menerima pemberitahuan resmi dari Jurusita.\n` +
          `- Jika tidak hadir saat pembacaan, pemberitahuan akan dikirim ke rumah atau Desa/Kelurahan setempat.\n\n` +
          `Informasi Tambahan:\n` +
          `- Ini adalah notifikasi dan bukan pemberitahuan resmi, anda tidak perlu membalasnya.\n` +
          `- Info lebih lanjut: WhatsApp *0822-7111-5021*.`;

          if (!sentMessages.has(formattedNumber)) {
            if (testMode) {
              console.log(`[TEST MODE] Akan mengirim pesan ke ${formattedNumber}:\n${message}`);
            } else {
              try {
                await safeSendMessage(formattedNumber, message);
                console.log(`Pesan berhasil dikirim ke Pihak Tergugat Putusan ${putusan.nama} (${formattedNumber}) untuk perkara ${putusan.nomor_perkara}`);
              } catch (sendError) {
                console.error(`Gagal kirim pesan ke Pihak Tergugat Putusan${putusan.nama} (${formattedNumber}) untuk perkara ${putusan.nomor_perkara}: ${sendError.message}`);
              }
            }
            sentMessages.add(formattedNumber);
          }
        }
      }

      // Kirim notifikasi putusan untuk kuasa P
      if (kuasaP.length > 0) {
        for (const kuasa of kuasaP) { // Iterasi semua kuasa P
          const formattedNumber = phoneNumberFormatter(kuasa.telepon); // Format nomor telepon
          const message = `Assalamualaikum Warahmatullahi Wabarakatuh,\n\n` +
          `Halo, saya Aleta, Bot ${pengadilan}.\n\n` +
          `Detail Putusan Perkara:\n` +
          `- Nama: Sdr/Sdri *${kuasa.nama}*\n` +
          `- Jenis Perkara: *${kuasa.jenis_perkara_nama}*\n` +
          `- Nomor Perkara: *${kuasa.nomor_perkara}*\n` +
          `- Status Putusan: *${kuasa.status_putusan_kode}*\n\n` +
          `Para Pihak:\n` +
          `${kuasa.para_pihak}\n\n` +
          `Amar Putusan:\n` +
          `${kuasa.amar_putusan}` +
          `- Unduh file PDF di ${kuasa.link_dirput}\n\n` +
          `Instruksi Jika Keberatan:\n` +
          `- Ajukan upaya hukum dalam waktu 14 hari setelah putusan dibacakan atau setelah menerima pemberitahuan resmi dari Jurusita.\n` +
          `- Jika tidak hadir saat pembacaan, pemberitahuan akan dikirim ke rumah atau Desa/Kelurahan setempat.\n\n` +
          `Informasi Tambahan:\n` +
          `- Ini adalah notifikasi dan bukan pemberitahuan resmi, anda tidak perlu membalasnya.\n` +
          `- Info lebih lanjut: WhatsApp *0822-7111-5021*.`;

          if (!sentMessages.has(formattedNumber)) {
            if (testMode) {
              console.log(`[TEST MODE] Akan mengirim pesan ke ${formattedNumber}:\n${message}`);
            } else {
              try {
                await safeSendMessage(formattedNumber, message);
                console.log(`Pesan berhasil dikirim ke Pihak Kuasa Penggugat Putusan ${kuasa.nama} (${formattedNumber}) untuk perkara ${kuasa.nomor_perkara}`);
              } catch (sendError) {
                console.error(`Gagal kirim pesan ke Pihak Kuasa Penggugat Putusan${kuasa.nama} (${formattedNumber}) untuk perkara ${kuasa.nomor_perkara}: ${sendError.message}`);
              }
            }
            sentMessages.add(formattedNumber);
          }
        }
      }

      // Kirim notifikasi putusan untuk kuasa T
      if (kuasaT.length > 0) {
        for (const kuasa of kuasaT) { // Iterasi semua kuasa T
          const formattedNumber = phoneNumberFormatter(kuasa.telepon); // Format nomor telepon
          const message = `Assalamualaikum Warahmatullahi Wabarakatuh,\n\n` +
          `Halo, saya Aleta, Bot ${pengadilan}.\n\n` +
          `Detail Putusan Perkara:\n` +
          `- Nama: Sdr/Sdri *${kuasa.nama}*\n` +
          `- Jenis Perkara: *${kuasa.jenis_perkara_nama}*\n` +
          `- Nomor Perkara: *${kuasa.nomor_perkara}*\n` +
          `- Status Putusan: *${kuasa.status_putusan_kode}*\n\n` +
          `Para Pihak:\n` +
          `${kuasa.para_pihak}\n\n` +
          `Amar Putusan:\n` +
          `${kuasa.amar_putusan}` +
          `- Unduh file PDF di ${kuasa.link_dirput}\n\n` +
          `Instruksi Jika Keberatan:\n` +
          `- Ajukan upaya hukum dalam waktu 14 hari setelah putusan dibacakan atau setelah menerima pemberitahuan resmi dari Jurusita.\n` +
          `- Jika tidak hadir saat pembacaan, pemberitahuan akan dikirim ke rumah atau Desa/Kelurahan setempat.\n\n` +
          `Informasi Tambahan:\n` +
          `- Ini adalah notifikasi dan bukan pemberitahuan resmi, anda tidak perlu membalasnya.\n` +
          `- Info lebih lanjut: WhatsApp *0822-7111-5021*.`;

          if (!sentMessages.has(formattedNumber)) {
            if (testMode) {
              console.log(`[TEST MODE] Akan mengirim pesan ke ${formattedNumber}:\n${message}`);
            } else {
              try {
                await safeSendMessage(formattedNumber, message);
                console.log(`Pesan berhasil dikirim ke Pihak Kuasa Tergugat Putusan ${kuasa.nama} (${formattedNumber}) untuk perkara ${kuasa.nomor_perkara}`);
              } catch (sendError) {
                console.error(`Gagal kirim pesan ke Pihak Kuasa Tergugat Putusan ${kuasa.nama} (${formattedNumber}) untuk perkara ${kuasa.nomor_perkara}: ${sendError.message}`);
              }
            }
            sentMessages.add(formattedNumber);
          }
        }
      }

      // Kirim notifikasi putusan untuk turut T
      if (turutT.length > 0) {
        for (const turut of turutT) { // Iterasi semua turut T
          const formattedNumber = phoneNumberFormatter(turut.telepon); // Format nomor telepon
          const message = `Assalamualaikum Warahmatullahi Wabarakatuh,\n\n` +
          `Halo, saya Aleta, Bot ${pengadilan}.\n\n` +
          `Detail Putusan Perkara:\n` +
          `- Nama: Sdr/Sdri *${turut.nama}*\n` +
          `- Jenis Perkara: *${turut.jenis_perkara_nama}*\n` +
          `- Nomor Perkara: *${turut.nomor_perkara}*\n` +
          `- Status Putusan: *${turut.status_putusan_kode}*\n\n` +
          `Para Pihak:\n` +
          `${turut.para_pihak}\n\n` +
          `Amar Putusan:\n` +
          `${turut.amar_putusan}` +
          `- Unduh file PDF di ${turut.link_dirput}\n\n` +
          `Instruksi Jika Keberatan:\n` +
          `- Ajukan upaya hukum dalam waktu 14 hari setelah putusan dibacakan atau setelah menerima pemberitahuan resmi dari Jurusita.\n` +
          `- Jika tidak hadir saat pembacaan, pemberitahuan akan dikirim ke rumah atau Desa/Kelurahan setempat.\n\n` +
          `Informasi Tambahan:\n` +
          `- Ini adalah notifikasi dan bukan pemberitahuan resmi, anda tidak perlu membalasnya.\n` +
          `- Info lebih lanjut: WhatsApp *0822-7111-5021*.`;

          if (!sentMessages.has(formattedNumber)) {
            if (testMode) {
              console.log(`[TEST MODE] Akan mengirim pesan ke ${formattedNumber}:\n${message}`);
            } else {
              try {
                await safeSendMessage(formattedNumber, message);
                console.log(`Pesan berhasil dikirim ke Pihak Turut Tergugat Putusan ${turut.nama} (${formattedNumber}) untuk perkara ${turut.nomor_perkara}`);
              } catch (sendError) {
                console.error(`Gagal kirim pesan ke Pihak Turut Tergugat Putusan${turut.nama} (${formattedNumber}) untuk perkara ${turut.nomor_perkara}: ${sendError.message}`);
              }
            }
            sentMessages.add(formattedNumber);
          }
        }
      }

      // Kirim notifikasi putusan untuk intervensi
      if (intervensi.length > 0) {
        for (const inv of intervensi) { // Iterasi semua intervensi
          const formattedNumber = phoneNumberFormatter(inv.telepon); // Format nomor telepon
          const message = `Assalamualaikum Warahmatullahi Wabarakatuh,\n\n` +
          `Halo, saya Aleta, Bot ${pengadilan}.\n\n` +
          `Detail Putusan Perkara:\n` +
          `- Nama: Sdr/Sdri *${inv.nama}*\n` +
          `- Jenis Perkara: *${inv.jenis_perkara_nama}*\n` +
          `- Nomor Perkara: *${inv.nomor_perkara}*\n` +
          `- Status Putusan: *${inv.status_putusan_kode}*\n\n` +
          `Para Pihak:\n` +
          `${inv.para_pihak}\n\n` +
          `Amar Putusan:\n` +
          `${inv.amar_putusan}` +
          `- Unduh file PDF di ${inv.link_dirput}\n\n` +
          `Instruksi Jika Keberatan:\n` +
          `- Ajukan upaya hukum dalam waktu 14 hari setelah putusan dibacakan atau setelah menerima pemberitahuan resmi dari Jurusita.\n` +
          `- Jika tidak hadir saat pembacaan, pemberitahuan akan dikirim ke rumah atau Desa/Kelurahan setempat.\n\n` +
          `Informasi Tambahan:\n` +
          `- Ini adalah notifikasi dan bukan pemberitahuan resmi, anda tidak perlu membalasnya.\n` +
          `- Info lebih lanjut: WhatsApp *0822-7111-5021*.`;

          if (!sentMessages.has(formattedNumber)) {
            if (testMode) {
              console.log(`[TEST MODE] Akan mengirim pesan ke ${formattedNumber}:\n${message}`);
            } else {
              try {
                await safeSendMessage(formattedNumber, message);
                console.log(`Pesan berhasil dikirim ke Pihak Intervensi Putusan ${inv.nama} (${formattedNumber}) untuk perkara ${inv.nomor_perkara}`);
              } catch (sendError) {
                console.error(`Gagal kirim pesan ke Pihak Intervensi Putusan ${inv.nama} (${formattedNumber}) untuk perkara ${inv.nomor_perkara}: ${sendError.message}`);
              }
            }
            sentMessages.add(formattedNumber);
          }
        }
      }

    }
  } catch (error) {
    console.error(`Gagal mendapatkan data putusan: ${error.message}`);
  }
};

const sendMessagePihakPutusan = (testMode = false) => {
  cron.schedule("30 23 * * *", () => {
    runLegacyNotificationIfAllowed("sendPihakPutusan", [{ id: "pihak-putusan", queryId: "legacy-pihak-putusan" }, { id: "party-putusan", queryId: "legacy-pihak-putusan" }], async () => {
      try {
          if (testMode) {
              console.log("Test mode aktif. Pesan tidak akan dikirim.");
              return;
          }
          
          console.log("Mengirim pesan untuk pihak putusan ...");
          await sendPihakPutusan(testMode);
          console.log("Pengiriman pesan selesai.");
      } catch (error) {
          console.error("Terjadi kesalahan saat mengirim pesan:", error);
      }
    });
  });
};

sendMessagePihakPutusan();

const sendPihakHariSidang = async (testMode = true) => {
  try {
      const { pihakP, pihakT, kuasaP, kuasaT, turutT, intervensi } = await notification.getDataPihakHariSidang();
      console.log("Pihak P Sidang Hari Ini:", pihakP); 
      console.log("Pihak T Sidang Hari Ini:", pihakT); 
      console.log("Kuasa P Sidang Hari Ini:", kuasaP); 
      console.log("Kuasa T Sidang Hari Ini:", kuasaT); 
      console.log("Turut T Sidang Hari Ini:", turutT); 
      console.log("Intervensi Sidang Hari Ini:", intervensi); 
      const sentMessages = new Set(); 

      const groupedPihak = {};

      pihakP.forEach(pihak => {
          const key = pihak.perkara_id;
          if (!groupedPihak[key]) {
              groupedPihak[key] = { pihakP: [], pihakT: [], kuasaP: [], kuasaT: [], turutT: [], intervensi: [] };
          }
          groupedPihak[key].pihakP.push(pihak);
      });

      pihakT.forEach(pihak => {
          const key = pihak.perkara_id;
          if (!groupedPihak[key]) {
              groupedPihak[key] = { pihakP: [], pihakT: [], kuasaP: [], kuasaT: [], turutT: [], intervensi: [] };
          }
          groupedPihak[key].pihakT.push(pihak);
      });

      kuasaP.forEach(kuasa => {
          const key = kuasa.perkara_id;
          if (!groupedPihak[key]) {
              groupedPihak[key] = { pihakP: [], pihakT: [], kuasaP: [], kuasaT: [], turutT: [], intervensi: [] };
          }
          groupedPihak[key].kuasaP.push(kuasa);
      });

      kuasaT.forEach(kuasa => {
          const key = kuasa.perkara_id;
          if (!groupedPihak[key]) {
              groupedPihak[key] = { pihakP: [], pihakT: [], kuasaP: [], kuasaT: [], turutT: [], intervensi: [] };
          }
          groupedPihak[key].kuasaT.push(kuasa);
      });

      turutT.forEach(turut => {
          const key = turut.perkara_id;
          if (!groupedPihak[key]) {
              groupedPihak[key] = { pihakP: [], pihakT: [], kuasaP: [], kuasaT: [], turutT: [], intervensi: [] };
          }
          groupedPihak[key].turutT.push(turut);
      });

      intervensi.forEach(inv => {
          const key = inv.perkara_id;
          if (!groupedPihak[key]) {
              groupedPihak[key] = { pihakP: [], pihakT: [], kuasaP: [], kuasaT: [], turutT: [], intervensi: [] };
          }
          groupedPihak[key].intervensi.push(inv);
      });

      // Kirim pesan untuk setiap grup berdasarkan perkara_id
      for (const key in groupedPihak) {
          const { pihakP, pihakT, kuasaP, kuasaT, turutT, intervensi } = groupedPihak[key];

          // Kirim pesan untuk pihak P
          if (pihakP.length > 0) {
              for (const pihak of pihakP) {
                  const formattedNumber = phoneNumberFormatter(pihak.telepon);
                  const message = `Assalamu'alaikum Warahmatullahi Wabarakatullahi Wabarakatuh,\n\n` +
                  `Halo, saya Aleta, Bot ${pengadilan}.\n\n` +
                  `Detail Sidang Perkara Hari Ini:\n` +
                  `- Nama: Sdr/Sdri **${pihak.nama}**\n` +
                  `- Jenis Perkara: ${pihak.jenis_perkara_nama}\n` +
                  `- Nomor Perkara: ${pihak.nomor_perkara}\n` +
                  `- Jadwal: ${pihak.hari_sidang}, ${pihak.tanggal_sidang} pukul 09:00 ${zonaWaktu}\n` +
                  `- Ruangan: ${pihak.ruangan}\n` +
                  `- Agenda: ${pihak.agenda}\n\n` +
                  `Pihak Terkait:\n` +
                  `${pihak.para_pihak}\n\n` +
                  `Ambil Antrian Online:\n` +
                  `- *Ketik: daftar antrian#${pihak.nomor_urut_perkara}.${pihak.alur_status}.${pihak.tahun_pendaftaran}.*\n\n` +
                  `Informasi Tambahan:\n` +
                  `- Pesan ini merupakan **notifikasi**, Anda **tidak perlu membalasnya**. **Panggilan resmi telah disampaikan sebelumnya oleh Jurusita/Petugas Pos.** Persidangan dilaksanakan **secara online atau tatap muka berdasarkan perintah Majelis Hakim/Hakim Tunggal pada persidangan sebelumnya.**\n` +
                  `- Info lebih lanjut, Ketik "perkara" atau hubungi WhatsApp: *0822-7111-5021*.`;

                  if (!sentMessages.has(formattedNumber)) {
                      try {
                          if (testMode) {
                              console.log(`[TEST MODE] Akan mengirim pesan ke ${formattedNumber}:\n${message}`);
                          } else {
                              await safeSendMessage(formattedNumber, message);
                              console.log(`Pesan berhasil dikirim ke Pihak Penggugat Hari Sidang ${pihak.nama} (${formattedNumber}) untuk perkara ${pihak.nomor_perkara}`);
                          }
                          sentMessages.add(formattedNumber);
                      } catch (sendError) {
                          console.error(`Gagal kirim pesan ke Pihak Penggugat Hari Sidang ${pihak.nama} (${formattedNumber}) untuk perkara ${pihak.nomor_perkara}: ${sendError.message}`);
                      }
                  }
              }
          }

          // Kirim pesan untuk pihak T
          if (pihakT.length > 0) {
              for (const pihak of pihakT) {
                  const formattedNumber = phoneNumberFormatter(pihak.telepon);
                  const message = `Assalamu'alaikum Warahmatullahi Wabarakatullahi Wabarakatuh,\n\n` +
                  `Halo, saya Aleta, Bot ${pengadilan}.\n\n` +
                  `Detail Sidang Perkara Hari Ini:\n` +
                  `- Nama: Sdr/Sdri **${pihak.nama}**\n` +
                  `- Jenis Perkara: ${pihak.jenis_perkara_nama}\n` +
                  `- Nomor Perkara: ${pihak.nomor_perkara}\n` +
                  `- Jadwal: ${pihak.hari_sidang}, ${pihak.tanggal_sidang} pukul 09:00 ${zonaWaktu}\n` +
                  `- Ruangan: ${pihak.ruangan}\n` +
                  `- Agenda: ${pihak.agenda}\n\n` +
                  `Pihak Terkait:\n` +
                  `${pihak.para_pihak}\n\n` +
                  `Ambil Antrian Online:\n` +
                  `- *Ketik: antrian online#${pihak.nomor_urut_perkara}.${pihak.alur_status}.${pihak.tahun_pendaftaran}.*\n\n` +
                  `Informasi Tambahan:\n` +
                  `- Pesan ini merupakan **notifikasi**, Anda **tidak perlu membalasnya**. **Panggilan resmi telah disampaikan sebelumnya oleh Jurusita/Petugas Pos.** Persidangan dilaksanakan **secara online atau tatap muka berdasarkan perintah Majelis Hakim/Hakim Tunggal pada persidangan sebelumnya.**\n` +
                  `- Info lebih lanjut, Ketik "perkara" atau hubungi WhatsApp: *0822-7111-5021*.`;

                  if (!sentMessages.has(formattedNumber)) {
                      try {
                          if (testMode) {
                              console.log(`[TEST MODE] Akan mengirim pesan ke ${formattedNumber}:\n${message}`);
                          } else {
                              await safeSendMessage(formattedNumber, message);
                              console.log(`Pesan berhasil dikirim ke Pihak Tergugat Hari Sidang ${pihak.nama} (${formattedNumber}) untuk perkara ${pihak.nomor_perkara}`);
                          }
                          sentMessages.add(formattedNumber);
                      } catch (sendError) {
                          console.error(`Gagal kirim pesan ke Pihak Tergugat Hari Sidang ${pihak.nama} (${formattedNumber}) untuk perkara ${pihak.nomor_perkara}: ${sendError.message}`);
                      }
                  }
              }
          }

          // Kirim pesan untuk kuasa P
          if (kuasaP.length > 0) {
              for (const kuasa of kuasaP) {
                  const formattedNumber = phoneNumberFormatter(kuasa.telepon);
                  const message = `Assalamu'alaikum Warahmatullahi Wabarakatullahi Wabarakatuh,\n\n` +
                  `Halo, saya Aleta, Bot ${pengadilan}.\n\n` +
                  `Detail Sidang Perkara Hari Ini:\n` +
                  `- Nama: Sdr/Sdri **${kuasa.nama}**\n` +
                  `- Jenis Perkara: ${kuasa.jenis_perkara_nama}\n` +
                  `- Nomor Perkara: ${kuasa.nomor_perkara}\n` +
                  `- Jadwal: ${kuasa.hari_sidang}, ${kuasa.tanggal_sidang} pukul 09:00 ${zonaWaktu}\n` +
                  `- Ruangan: ${kuasa.ruangan}\n` +
                  `- Agenda: ${kuasa.agenda}\n\n` +
                  `Pihak Terkait:\n` +
                  `${kuasa.para_pihak}\n\n` +
                  `Ambil Antrian Online:\n` +
                  `- *Ketik: daftar antrian#${kuasa.nomor_urut_perkara}.${kuasa.alur_status}.${kuasa.tahun_pendaftaran}.*\n\n` +
                  `Informasi Tambahan:\n` +
                  `- Pesan ini merupakan **notifikasi**, Anda **tidak perlu membalasnya**. **Panggilan resmi telah disampaikan sebelumnya oleh Jurusita/Petugas Pos.** Persidangan dilaksanakan **secara online atau tatap muka berdasarkan perintah Majelis Hakim/Hakim Tunggal pada persidangan sebelumnya.**\n` +
                  `- Info lebih lanjut, Ketik "perkara" atau hubungi WhatsApp: *0822-7111-5021*.`;

                  if (!sentMessages.has(formattedNumber)) {
                      try {
                          if (testMode) {
                              console.log(`[TEST MODE] Akan mengirim pesan ke ${formattedNumber}:\n${message}`);
                          } else {
                              await safeSendMessage(formattedNumber, message);
                              console.log(`Pesan berhasil dikirim ke Kuasa Penggugat Hari Sidang ${kuasa.nama} (${formattedNumber}) untuk perkara ${kuasa.nomor_perkara}`);
                          }
                          sentMessages.add(formattedNumber);
                      } catch (sendError) {
                          console.error(`Gagal kirim pesan ke Kuasa Penggugat Hari Sidang ${kuasa.nama} (${formattedNumber}) untuk perkara ${kuasa.nomor_perkara}: ${sendError.message}`);
                      }
                  }
              }
          }

          // Kirim pesan untuk kuasa T
          if (kuasaT.length > 0) {
              for (const kuasa of kuasaT) {
                  const formattedNumber = phoneNumberFormatter(kuasa.telepon);
                  const message = `Assalamu'alaikum Warahmatullahi Wabarakatullahi Wabarakatuh,\n\n` +
                  `Halo, saya Aleta, Bot ${pengadilan}.\n\n` +
                  `Detail Sidang Perkara Hari Ini:\n` +
                  `- Nama: Sdr/Sdri **${kuasa.nama}**\n` +
                  `- Jenis Perkara: ${kuasa.jenis_perkara_nama}\n` +
                  `- Nomor Perkara: ${kuasa.nomor_perkara}\n` +
                  `- Jadwal: ${kuasa.hari_sidang}, ${kuasa.tanggal_sidang} pukul 09:00 ${zonaWaktu}\n` +
                  `- Ruangan: ${kuasa.ruangan}\n` +
                  `- Agenda: ${kuasa.agenda}\n\n` +
                  `Pihak Terkait:\n` +
                  `${kuasa.para_pihak}\n\n` +
                  `Ambil Antrian Online:\n` +
                  `- *Ketik: antrian online#${kuasa.nomor_urut_perkara}.${kuasa.alur_status}.${kuasa.tahun_pendaftaran}.*\n\n` +
                  `Informasi Tambahan:\n` +
                  `- Pesan ini merupakan **notifikasi**, Anda **tidak perlu membalasnya**. **Panggilan resmi telah disampaikan sebelumnya oleh Jurusita/Petugas Pos.** Persidangan dilaksanakan **secara online atau tatap muka berdasarkan perintah Majelis Hakim/Hakim Tunggal pada persidangan sebelumnya.**\n` +
                  `- Info lebih lanjut, Ketik "perkara" atau hubungi WhatsApp: *0822-7111-5021*.`;

                  if (!sentMessages.has(formattedNumber)) {
                      try {
                          if (testMode) {
                              console.log(`[TEST MODE] Akan mengirim pesan ke ${formattedNumber}:\n${message}`);
                          } else {
                              await safeSendMessage(formattedNumber, message);
                              console.log(`Pesan berhasil dikirim ke Kuasa Tergugat Hari Sidang ${kuasa.nama} (${formattedNumber}) untuk perkara ${kuasa.nomor_perkara}`);
                          }
                          sentMessages.add(formattedNumber);
                      } catch (sendError) {
                          console.error(`Gagal kirim pesan ke Kuasa Tergugat Hari Sidang ${kuasa.nama} (${formattedNumber}) untuk perkara ${kuasa.nomor_perkara}: ${sendError.message}`);
                      }
                  }
              }
          }

          // Kirim pesan untuk turut T
          if (turutT.length > 0) {
              for (const turut of turutT) {
                  const formattedNumber = phoneNumberFormatter(turut.telepon);
                  const message = `Assalamu'alaikum Warahmatullahi Wabarakatullahi Wabarakatuh,\n\n` +
                  `Halo, saya Aleta, Bot ${pengadilan}.\n\n` +
                  `Detail Sidang Perkara Hari Ini:\n` +
                  `- Nama: Sdr/Sdri **${turut.nama}**\n` +
                  `- Jenis Perkara: ${turut.jenis_perkara_nama}\n` +
                  `- Nomor Perkara: ${turut.nomor_perkara}\n` +
                  `- Jadwal: ${turut.hari_sidang}, ${turut.tanggal_sidang} pukul 09:00 ${zonaWaktu}\n` +
                  `- Ruangan: ${turut.ruangan}\n` +
                  `- Agenda: ${turut.agenda}\n\n` +
                  `Pihak Terkait:\n` +
                  `${turut.para_pihak}\n\n` +
                  `Informasi Tambahan:\n` +
                  `- Pesan ini merupakan **notifikasi**, Anda **tidak perlu membalasnya**. **Panggilan resmi telah disampaikan sebelumnya oleh Jurusita/Petugas Pos.** Persidangan dilaksanakan **secara online atau tatap muka berdasarkan perintah Majelis Hakim/Hakim Tunggal pada persidangan sebelumnya.**\n` +
                  `- Info lebih lanjut, Ketik "perkara" atau hubungi WhatsApp: *0822-7111-5021*.`;

                  if (!sentMessages.has(formattedNumber)) {
                      try {
                          if (testMode) {
                              console.log(`[TEST MODE] Akan mengirim pesan ke ${formattedNumber}:\n${message}`);
                          } else {
                              await safeSendMessage(formattedNumber, message);
                              console.log(`Pesan berhasil dikirim ke Turut Tergugat Hari Sidang ${turut.nama} (${formattedNumber}) untuk perkara ${turut.nomor_perkara}`);
                          }
                          sentMessages.add(formattedNumber);
                      } catch (sendError) {
                          console.error(`Gagal kirim pesan ke Turut Tergugat Hari Sidang ${turut.nama} (${formattedNumber}) untuk perkara ${turut.nomor_perkara}: ${sendError.message}`);
                      }
                  }
              }
          }

          // Kirim pesan untuk intervensi
          if (intervensi.length > 0) {
              for (const inv of intervensi) {
                  const formattedNumber = phoneNumberFormatter(inv.telepon);
                  const message = `Assalamu'alaikum Warahmatullahi Wabarakatullahi Wabarakatuh,\n\n` +
                  `Halo, saya Aleta, Bot ${pengadilan}.\n\n` +
                  `Detail Sidang Perkara Hari Ini:\n` +
                  `- Nama: Sdr/Sdri **${inv.nama}**\n` +
                  `- Jenis Perkara: ${inv.jenis_perkara_nama}\n` +
                  `- Nomor Perkara: ${inv.nomor_perkara}\n` +
                  `- Jadwal: ${inv.hari_sidang}, ${inv.tanggal_sidang} pukul 09:00 ${zonaWaktu}\n` +
                  `- Ruangan: ${inv.ruangan}\n` +
                  `- Agenda: ${inv.agenda}\n\n` +
                  `Pihak Terkait:\n` +
                  `${inv.para_pihak}\n\n` +
                  `Informasi Tambahan:\n` +
                  `- Pesan ini merupakan **notifikasi**, Anda **tidak perlu membalasnya**. **Panggilan resmi telah disampaikan sebelumnya oleh Jurusita/Petugas Pos.** Persidangan dilaksanakan **secara online atau tatap muka berdasarkan perintah Majelis Hakim/Hakim Tunggal pada persidangan sebelumnya.**\n` +
                  `- Info lebih lanjut, Ketik "perkara" atau hubungi WhatsApp: *0822-7111-5021*.`;

                  if (!sentMessages.has(formattedNumber)) {
                      try {
                          if (testMode) {
                              console.log(`[TEST MODE] Akan mengirim pesan ke ${formattedNumber}:\n${message}`);
                          } else {
                              await safeSendMessage(formattedNumber, message);
                              console.log(`Pesan berhasil dikirim ke Intervensi Hari Sidang ${inv.nama} (${formattedNumber}) untuk perkara ${inv.nomor_perkara}`);
                          }
                          sentMessages.add(formattedNumber);
                      } catch (sendError) {
                          console.error(`Gagal kirim pesan ke Intervensi Hari Sidang ${inv.nama} (${formattedNumber}) untuk perkara ${inv.nomor_perkara}: ${sendError.message}`);
                      }
                  }
              }
          }
      }

  } catch (error) {
      console.error(`Terjadi kesalahan: ${error.message}`);
  }
};

const sendMessageHariSidang = (testMode = false) => {
  cron.schedule("00 07 * * *", () => {
    runLegacyNotificationIfAllowed("sendPihakHariSidang", [{ id: "pihak-hari-sidang", queryId: "legacy-pihak-hari-sidang" }, { id: "party-hari-sidang", queryId: "legacy-pihak-hari-sidang" }], async () => {
      try {
          if (testMode) {
              console.log("Test mode aktif. Pesan tidak akan dikirim.");
              return;
          }
          
          console.log("Mengirim pesan untuk hari sidang ...");
          await sendPihakHariSidang(testMode);
          console.log("Pengiriman pesan selesai.");
      } catch (error) {
          console.error("Terjadi kesalahan saat mengirim pesan:", error);
      }
    });
  });
};

sendMessageHariSidang()

const sendPihakSebelumHariSidang = async (testMode = true) => {
  try {
    const { pihakP, pihakT, kuasaP, kuasaT, turutT, intervensi } = await notification.getDataPihakSebelumHariSidang(); // Ambil kuasaP dan kuasaT
    console.log("Pihak P Sidang 3 Hari Lagi:", pihakP); 
    console.log("Pihak T Sidang 3 Hari Lagi:", pihakT); 
    console.log("Kuasa P Sidang 3 Hari Lagi:", kuasaP); 
    console.log("Kuasa T Sidang 3 Hari Lagi:", kuasaT); 
    console.log("Turut T Sidang 3 Hari Lagi:", turutT); 
    console.log("Intervensi Sidang 3 Hari Lagi:", intervensi); 
    const sentMessages = new Set(); 

    const groupedPihak = {};

    pihakP.forEach(pihak => {
      const key = pihak.perkara_id;
      if (!groupedPihak[key]) {
        groupedPihak[key] = { pihakP: [], pihakT: [], kuasaP: [], kuasaT: [], turutT: [], intervensi: [] };
      }
      groupedPihak[key].pihakP.push(pihak);
    });

    pihakT.forEach(pihak => {
      const key = pihak.perkara_id;
      if (!groupedPihak[key]) {
        groupedPihak[key] = { pihakP: [], pihakT: [], kuasaP: [], kuasaT: [], turutT: [], intervensi: [] };
      }
      groupedPihak[key].pihakT.push(pihak);
    });

    kuasaP.forEach(kuasa => {
      const key = kuasa.perkara_id;
      if (!groupedPihak[key]) {
        groupedPihak[key] = { pihakP: [], pihakT: [], kuasaP: [], kuasaT: [], turutT: [], intervensi: [] };
      }
      groupedPihak[key].kuasaP.push(kuasa);
    });

    kuasaT.forEach(kuasa => {
      const key = kuasa.perkara_id;
      if (!groupedPihak[key]) {
        groupedPihak[key] = { pihakP: [], pihakT: [], kuasaP: [], kuasaT: [], turutT: [], intervensi: [] };
      }
      groupedPihak[key].kuasaT.push(kuasa);
    });

    turutT.forEach(turut => {
      const key = turut.perkara_id;
      if (!groupedPihak[key]) {
        groupedPihak[key] = { pihakP: [], pihakT: [], kuasaP: [], kuasaT: [], turutT: [], intervensi: [] };
      }
      groupedPihak[key].turutT.push(turut);
    });

    intervensi.forEach(inv => {
      const key = inv.perkara_id;
      if (!groupedPihak[key]) {
        groupedPihak[key] = { pihakP: [], pihakT: [], kuasaP: [], kuasaT: [], turutT: [], intervensi: [] };
      }
      groupedPihak[key].intervensi.push(inv);
    });

    // Kirim pesan untuk setiap grup berdasarkan perkara_id
    for (const key in groupedPihak) {
      const { pihakP, pihakT, kuasaP, kuasaT, turutT, intervensi } = groupedPihak[key];

      // Kirim pesan untuk pihak P
      if (pihakP.length > 0) {
        for (const pihak of pihakP) {
          const formattedNumber = phoneNumberFormatter(pihak.telepon);
          const message = `Assalamualaikum Warahmatullahi Wabarakatuh,\n\n` +
          `Halo, saya Aleta, Bot ${pengadilan}.\n\n` +
          `Detail Sidang Perkara 3 Hari Ke Depan:\n` +
          `- Nama: Sdr/Sdri **${pihak.nama}**\n` +
          `- Jenis Perkara: ${pihak.jenis_perkara_nama}\n` +
          `- Nomor Perkara: ${pihak.nomor_perkara}\n` +
          `- Jadwal: ${pihak.hari_sidang}, ${pihak.tanggal_sidang} pukul 09:00 ${zonaWaktu}\n` +
          `- Ruangan: ${pihak.ruangan}\n` +
          `- Agenda: ${pihak.agenda}.\n\n` +
          `Pihak Terkait:\n` +
          `${pihak.para_pihak}\n\n` +
          `Informasi Tambahan:\n` +
          `- Pesan ini adalah notifikasi, anda tidak perlu membalasnya. Panggilan resmi sebelumnya sudah disampaikan oleh Jurusita/Petugas Pos.\n` +
          `- Siapkan bukti, saksi, atau dokumen (jawaban/replik/duplik) **hanya jika Majelis Hakim/Hakim Tunggal memerintahkan pada sidang sebelumnya**. Jika **tidak ada perintah**, **tidak perlu disiapkan**. Pelaksanaan sidang bisa **online atau tatap muka**, sesuai perintah dalam **agenda sidang**.\n` +
          `- Info lebih lanjut, Ketik "perkara" atau hubungi WhatsApp: *0822-7111-5021*.`;

          if (!sentMessages.has(formattedNumber)) {
            try {
              if (testMode) {
                console.log(`[TEST MODE] Akan mengirim pesan ke ${formattedNumber}:\n${message}`);
              } else {
                await safeSendMessage(formattedNumber, message);
                console.log(`Pesan berhasil dikirim ke Penggugat 3 Hari Sebelum Sidang ${pihak.nama} (${formattedNumber}) untuk perkara ${pihak.nomor_perkara}`);
              }
            } catch (sendError) {
              console.error(`Gagal kirim pesan ke Penggugat 3 Hari Sebelum Sidang ${pihak.nama} (${formattedNumber}) untuk perkara ${pihak.nomor_perkara}: ${sendError.message}`);
            }
            sentMessages.add(formattedNumber);
          }
        }
      }

      // Kirim pesan untuk pihak T
      if (pihakT.length > 0) {
        for (const pihak of pihakT) {
          const formattedNumber = phoneNumberFormatter(pihak.telepon);
          const message = `Assalamualaikum Warahmatullahi Wabarakatuh,\n\n` +
          `Halo, saya Aleta, Bot ${pengadilan}.\n\n` +
          `Detail Sidang Perkara 3 Hari Ke Depan:\n` +
          `- Nama: Sdr/Sdri **${pihak.nama}**\n` +
          `- Jenis Perkara: ${pihak.jenis_perkara_nama}\n` +
          `- Nomor Perkara: ${pihak.nomor_perkara}\n` +
          `- Jadwal: ${pihak.hari_sidang}, ${pihak.tanggal_sidang} pukul 09:00 ${zonaWaktu}\n` +
          `- Ruangan: ${pihak.ruangan}\n` +
          `- Agenda: ${pihak.agenda}.\n\n` +
          `Pihak Terkait:\n` +
          `${pihak.para_pihak}\n\n` +
          `Informasi Tambahan:\n` +
          `- Pesan ini adalah notifikasi, anda tidak perlu membalasnya. Panggilan resmi sebelumnya sudah disampaikan oleh Jurusita/Petugas Pos.\n` +
          `- Siapkan bukti, saksi, atau dokumen (jawaban/replik/duplik) **hanya jika Majelis Hakim/Hakim Tunggal memerintahkan pada sidang sebelumnya**. Jika **tidak ada perintah**, **tidak perlu disiapkan**. Pelaksanaan sidang bisa **online atau tatap muka**, sesuai perintah dalam **agenda sidang**.\n` +
          `- Info lebih lanjut, Ketik "perkara" atau hubungi WhatsApp: *0822-7111-5021*.`;

          if (!sentMessages.has(formattedNumber)) {
            try {
              if (testMode) {
                console.log(`[TEST MODE] Akan mengirim pesan ke ${formattedNumber}:\n${message}`);
              } else {
                await safeSendMessage(formattedNumber, message);
                console.log(`Pesan berhasil dikirim ke Tergugat 3 Hari Sebelum Sidang ${pihak.nama} (${formattedNumber}) untuk perkara ${pihak.nomor_perkara}`);
              }
            } catch (sendError) {
              console.error(`Gagal kirim pesan ke Tergugat 3 Hari Sebelum Sidang ${pihak.nama} (${formattedNumber}) untuk perkara ${pihak.nomor_perkara}: ${sendError.message}`);
            }
            sentMessages.add(formattedNumber);
          }
        }
      }

      // Kirim pesan untuk kuasa P
      if (kuasaP.length > 0) {
        for (const kuasa of kuasaP) {
          const formattedNumber = phoneNumberFormatter(kuasa.telepon);
          const message = `Assalamualaikum Warahmatullahi Wabarakatuh,\n\n` +
          `Halo, saya Aleta, Bot ${pengadilan}.\n\n` +
          `Detail Sidang Perkara 3 Hari Ke Depan:\n` +
          `- Nama: Sdr/Sdri **${kuasa.nama}**\n` +
          `- Jenis Perkara: ${kuasa.jenis_perkara_nama}\n` +
          `- Nomor Perkara: ${kuasa.nomor_perkara}\n` +
          `- Jadwal: ${kuasa.hari_sidang}, ${kuasa.tanggal_sidang} pukul 09:00 ${zonaWaktu}\n` +
          `- Ruangan: ${kuasa.ruangan}\n` +
          `- Agenda: ${kuasa.agenda}.\n\n` +
          `Pihak Terkait:\n` +
          `${kuasa.para_pihak}\n\n` +
          `Informasi Tambahan:\n` +
          `- Pesan ini adalah notifikasi, anda tidak perlu membalasnya. Panggilan resmi sebelumnya sudah disampaikan oleh Jurusita/Petugas Pos.\n` +
          `- Siapkan bukti, saksi, atau dokumen (jawaban/replik/duplik) **hanya jika Majelis Hakim/Hakim Tunggal memerintahkan pada sidang sebelumnya**. Jika **tidak ada perintah**, **tidak perlu disiapkan**. Pelaksanaan sidang bisa **online atau tatap muka**, sesuai perintah dalam **agenda sidang**.\n` +
          `- Info lebih lanjut, Ketik "perkara" atau hubungi WhatsApp: *0822-7111-5021*.`;

          if (!sentMessages.has(formattedNumber)) {
            try {
              if (testMode) {
                console.log(`[TEST MODE] Akan mengirim pesan ke ${formattedNumber}:\n${message}`);
              } else {
                await safeSendMessage(formattedNumber, message);
                console.log(`Pesan berhasil dikirim ke Kuasa Penggugat 3 Hari Sebelum Sidang ${kuasa.nama} (${formattedNumber}) untuk perkara ${kuasa.nomor_perkara}`);
              }
            } catch (sendError) {
              console.error(`Gagal kirim pesan ke Kuasa Penggugat 3 Hari Sebelum Sidang ${kuasa.nama} (${formattedNumber}) untuk perkara ${kuasa.nomor_perkara}: ${sendError.message}`);
            }
            sentMessages.add(formattedNumber);
          }
        }
      }

      // Kirim pesan untuk kuasa T
      if (kuasaT.length > 0) {
        for (const kuasa of kuasaT) {
          const formattedNumber = phoneNumberFormatter(kuasa.telepon);
          const message = `Assalamualaikum Warahmatullahi Wabarakatuh,\n\n` +
          `Halo, saya Aleta, Bot ${pengadilan}.\n\n` +
          `Detail Sidang Perkara 3 Hari Ke Depan:\n` +
          `- Nama: Sdr/Sdri **${kuasa.nama}**\n` +
          `- Jenis Perkara: ${kuasa.jenis_perkara_nama}\n` +
          `- Nomor Perkara: ${kuasa.nomor_perkara}\n` +
          `- Jadwal: ${kuasa.hari_sidang}, ${kuasa.tanggal_sidang} pukul 09:00 ${zonaWaktu}\n` +
          `- Ruangan: ${kuasa.ruangan}\n` +
          `- Agenda: ${kuasa.agenda}.\n\n` +
          `Pihak Terkait:\n` +
          `${kuasa.para_pihak}\n\n` +
          `Informasi Tambahan:\n` +
          `- Pesan ini adalah notifikasi, anda tidak perlu membalasnya. Panggilan resmi sebelumnya sudah disampaikan oleh Jurusita/Petugas Pos.\n` +
          `- Siapkan bukti, saksi, atau dokumen (jawaban/replik/duplik) **hanya jika Majelis Hakim/Hakim Tunggal memerintahkan pada sidang sebelumnya**. Jika **tidak ada perintah**, **tidak perlu disiapkan**. Pelaksanaan sidang bisa **online atau tatap muka**, sesuai perintah dalam **agenda sidang**.\n` +
          `- Info lebih lanjut, Ketik "perkara" atau hubungi WhatsApp: *0822-7111-5021*.`;

          if (!sentMessages.has(formattedNumber)) {
            try {
              if (testMode) {
                console.log(`[TEST MODE] Akan mengirim pesan ke Kuasa Tergugat 3 Hari Sebelum Sidang ${formattedNumber}:\n${message}`);
              } else {
                await safeSendMessage(formattedNumber, message);
                console.log(`Pesan berhasil dikirim ke ${kuasa.nama} (${formattedNumber}) untuk perkara ${kuasa.nomor_perkara}`);
              }
            } catch (sendError) {
              console.error(`Gagal kirim pesan ke Kuasa Tergugat 3 Hari Sebelum Sidang ${kuasa.nama} (${formattedNumber}) untuk perkara ${kuasa.nomor_perkara}: ${sendError.message}`);
            }
            sentMessages.add(formattedNumber);
          }
        }
      }

      // Kirim pesan untuk turut T
      if (turutT.length > 0) {
        for (const turut of turutT) {
          const formattedNumber = phoneNumberFormatter(turut.telepon);
          const message = `Assalamualaikum Warahmatullahi Wabarakatuh,\n\n` +
          `Halo, saya Aleta, Bot ${pengadilan}.\n\n` +
          `Detail Sidang Perkara 3 Hari Ke Depan:\n` +
          `- Nama: Sdr/Sdri **${turut.nama}**\n` +
          `- Jenis Perkara: ${turut.jenis_perkara_nama}\n` +
          `- Nomor Perkara: ${turut.nomor_perkara}\n` +
          `- Jadwal: ${turut.hari_sidang}, ${turut.tanggal_sidang} pukul 09:00 ${zonaWaktu}\n` +
          `- Ruangan: ${turut.ruangan}\n` +
          `- Agenda: ${turut.agenda}.\n\n` +
          `Pihak Terkait:\n` +
          `${turut.para_pihak}\n\n` +
          `Informasi Tambahan:\n` +
          `- Pesan ini adalah notifikasi, anda tidak perlu membalasnya. Panggilan resmi sebelumnya sudah disampaikan oleh Jurusita/Petugas Pos.\n` +
          `- Siapkan bukti, saksi, atau dokumen (jawaban/replik/duplik) **hanya jika Majelis Hakim/Hakim Tunggal memerintahkan pada sidang sebelumnya**. Jika **tidak ada perintah**, **tidak perlu disiapkan**. Pelaksanaan sidang bisa **online atau tatap muka**, sesuai perintah dalam **agenda sidang**.\n` +
          `- Info lebih lanjut, Ketik "perkara" atau hubungi WhatsApp: *0822-7111-5021*.`;

          if (!sentMessages.has(formattedNumber)) {
            try {
              if (testMode) {
                console.log(`[TEST MODE] Akan mengirim pesan ke ${formattedNumber}:\n${message}`);
              } else {
                await safeSendMessage(formattedNumber, message);
                console.log(`Pesan berhasil dikirim ke Turut Tergugat 3 Hari Sebelum Sidang ${turut.nama} (${formattedNumber}) untuk perkara ${turut.nomor_perkara}`);
              }
            } catch (sendError) {
              console.error(`Gagal kirim pesan ke Turut Tergugat 3 Hari Sebelum Sidang ${turut.nama} (${formattedNumber}) untuk perkara ${turut.nomor_perkara}: ${sendError.message}`);
            }
            sentMessages.add(formattedNumber);
          }
        }
      }

      // Kirim pesan untuk intervensi
      if (intervensi.length > 0) {
        for (const inv of intervensi) {
          const formattedNumber = phoneNumberFormatter(inv.telepon);
          const message = `Assalamualaikum Warahmatullahi Wabarakatuh,\n\n` +
          `Halo, saya Aleta, Bot ${pengadilan}.\n\n` +
          `Detail Sidang Perkara 3 Hari Ke Depan:\n` +
          `- Nama: Sdr/Sdri **${inv.nama}**\n` +
          `- Jenis Perkara: ${inv.jenis_perkara_nama}\n` +
          `- Nomor Perkara: ${inv.nomor_perkara}\n` +
          `- Jadwal: ${inv.hari_sidang}, ${inv.tanggal_sidang} pukul 09:00 ${zonaWaktu}\n` +
          `- Ruangan: ${inv.ruangan}\n` +
          `- Agenda: ${inv.agenda}.\n\n` +
          `Pihak Terkait:\n` +
          `${inv.para_pihak}\n\n` +
          `Informasi Tambahan:\n` +
          `- Pesan ini adalah notifikasi, anda tidak perlu membalasnya. Panggilan resmi sebelumnya sudah disampaikan oleh Jurusita/Petugas Pos.\n` +
          `- Siapkan bukti, saksi, atau dokumen (jawaban/replik/duplik) **hanya jika Majelis Hakim/Hakim Tunggal memerintahkan pada sidang sebelumnya**. Jika **tidak ada perintah**, **tidak perlu disiapkan**. Pelaksanaan sidang bisa **online atau tatap muka**, sesuai perintah dalam **agenda sidang**.\n` +
          `- Info lebih lanjut, Ketik "perkara" atau hubungi WhatsApp: *0822-7111-5021*.`;

          if (!sentMessages.has(formattedNumber)) {
            try {
              if (testMode) {
                console.log(`[TEST MODE] Akan mengirim pesan ke ${formattedNumber}:\n${message}`);
              } else {
                await safeSendMessage(formattedNumber, message);
                console.log(`Pesan berhasil dikirim ke Intervensi 3 Hari Sebelum Sidang ${inv.nama} (${formattedNumber}) untuk perkara ${inv.nomor_perkara}`);
              }
            } catch (sendError) {
              console.error(`Gagal kirim pesan ke Intervensi 3 Hari Sebelum Sidang ${inv.nama} (${formattedNumber}) untuk perkara ${inv.nomor_perkara}: ${sendError.message}`);
            }
            sentMessages.add(formattedNumber);
          }
        }
      }
    }

  } catch (error) {
    console.error('Error dalam fungsi sendPihakSebelumHariSidang:', error.message);
  }
};

const sendMessageSebelumHariSidang = (testMode = false) => {
  cron.schedule("00 09 * * *", () => {
    runLegacyNotificationIfAllowed("sendPihakSebelumHariSidang", [{ id: "pihak-sebelum-sidang", queryId: "legacy-pihak-sebelum-sidang" }, { id: "party-sebelum-sidang", queryId: "legacy-pihak-sebelum-sidang" }], async () => {
      try {
          if (testMode) {
              console.log("Test mode aktif. Pesan tidak akan dikirim.");
              return;
          }
          
          console.log("Mengirim pesan untuk sebelum hari sidang ...");
          await sendPihakSebelumHariSidang(testMode);
          console.log("Pengiriman pesan selesai.");
      } catch (error) {
          console.error("Terjadi kesalahan saat mengirim pesan:", error);
      }
    });
  });
};

sendMessageSebelumHariSidang();

const sendPihakTundaCuti = async (testMode = true) => {
  try {
      const { pihakP, pihakT, kuasaP, kuasaT, turutT, intervensi } = await notification.getDataPihakTundaCuti();
      console.log("Pihak P Sidang Tunda Cuti:", pihakP); 
      console.log("Pihak T Sidang Tunda Cuti:", pihakT); 
      console.log("Kuasa P Sidang Tunda Cuti:", kuasaP); 
      console.log("Kuasa T Sidang Tunda Cuti:", kuasaT); 
      console.log("Turut T Sidang Tunda Cuti:", turutT); 
      console.log("Intervensi Sidang Tunda Cuti:", intervensi); 
      const sentMessages = new Set(); 

      const groupedPihak = {};

      pihakP.forEach(pihak => {
          const key = pihak.perkara_id;
          if (!groupedPihak[key]) {
              groupedPihak[key] = { pihakP: [], pihakT: [], kuasaP: [], kuasaT: [], turutT: [], intervensi: [] };
          }
          groupedPihak[key].pihakP.push(pihak);
      });

      pihakT.forEach(pihak => {
          const key = pihak.perkara_id;
          if (!groupedPihak[key]) {
              groupedPihak[key] = { pihakP: [], pihakT: [], kuasaP: [], kuasaT: [], turutT: [], intervensi: [] };
          }
          groupedPihak[key].pihakT.push(pihak);
      });

      kuasaP.forEach(kuasa => {
          const key = kuasa.perkara_id;
          if (!groupedPihak[key]) {
              groupedPihak[key] = { pihakP: [], pihakT: [], kuasaP: [], kuasaT: [], turutT: [], intervensi: [] };
          }
          groupedPihak[key].kuasaP.push(kuasa);
      });

      kuasaT.forEach(kuasa => {
          const key = kuasa.perkara_id;
          if (!groupedPihak[key]) {
              groupedPihak[key] = { pihakP: [], pihakT: [], kuasaP: [], kuasaT: [], turutT: [], intervensi: [] };
          }
          groupedPihak[key].kuasaT.push(kuasa);
      });

      turutT.forEach(turut => {
          const key = turut.perkara_id;
          if (!groupedPihak[key]) {
              groupedPihak[key] = { pihakP: [], pihakT: [], kuasaP: [], kuasaT: [], turutT: [], intervensi: [] };
          }
          groupedPihak[key].turutT.push(turut);
      });

      intervensi.forEach(inv => {
          const key = inv.perkara_id;
          if (!groupedPihak[key]) {
              groupedPihak[key] = { pihakP: [], pihakT: [], kuasaP: [], kuasaT: [], turutT: [], intervensi: [] };
          }
          groupedPihak[key].intervensi.push(inv);
      });

      // Kirim pesan untuk setiap grup berdasarkan perkara_id
      for (const key in groupedPihak) {
          const { pihakP, pihakT, kuasaP, kuasaT, turutT, intervensi } = groupedPihak[key];

          // Kirim pesan untuk pihak P
          if (pihakP.length > 0) {
              for (const pihak of pihakP) {
                  const formattedNumber = phoneNumberFormatter(pihak.telepon);
                  const message = `Assalamualaikum Warahmatullahi Wabarakatuh,\n\n` +
                      `Halo, saya Aleta, Bot ${pengadilan}. Kami ingin menginformasikan bahwa Anda ${pihak.nama} yang dijadwalkan untuk sidang pada hari ${pihak.hari_sidang}, tanggal ${pihak.tanggal_sidang} pada perkara ${pihak.jenis_perkara_nama} dengan nomor register ${pihak.nomor_perkara}, dengan agenda sidang ${pihak.agenda} dialihkan dikarenakan pada tanggal 27 November 2024 merupakan hari libur berdasarkan KEPPRES Nomor 3 Tahun 2024\n\n` +
                      `Selanjutnya sidang akan dilaksanakan pada hari ${pihak.hari_cuti}, tanggal ${pihak.tanggal_sidang_cuti}, pukul 09:00 ${zonaWaktu} di ruangan ${pihak.ruangan} dengan agenda sidang ${pihak.agenda}\n\n` +
                      `Pesan ini merupakan notifikasi bukanlah panggilan resmi. Untuk informasi lebih lanjut silahkan menghubungi petugas PTSP kami di nomor WhatsApp : *0822-7111-5021*`;

                  if (!sentMessages.has(formattedNumber)) {
                      try {
                          if (testMode) {
                              console.log(`[TEST MODE] Akan mengirim pesan ke ${formattedNumber}:\n${message}`);
                          } else {
                              await safeSendMessage(formattedNumber, message);
                              console.log(`Pesan berhasil dikirim ke Pihak Penggugat Hari Sidang ${pihak.nama} (${formattedNumber}) untuk perkara ${pihak.nomor_perkara}`);
                          }
                          sentMessages.add(formattedNumber);
                      } catch (sendError) {
                          console.error(`Gagal kirim pesan ke Pihak Penggugat Hari Sidang ${pihak.nama} (${formattedNumber}) untuk perkara ${pihak.nomor_perkara}: ${sendError.message}`);
                      }
                  }
              }
          }

          // Kirim pesan untuk pihak T
          if (pihakT.length > 0) {
              for (const pihak of pihakT) {
                  const formattedNumber = phoneNumberFormatter(pihak.telepon);
                  const message = `Assalamualaikum Warahmatullahi Wabarakatuh,\n\n` +
                      `Halo, saya Aleta, Bot ${pengadilan}. Kami ingin menginformasikan bahwa Anda ${pihak.nama} yang dijadwalkan untuk sidang pada hari ${pihak.hari_sidang}, tanggal ${pihak.tanggal_sidang} pada perkara ${pihak.jenis_perkara_nama} dengan nomor register ${pihak.nomor_perkara}, dengan agenda sidang ${pihak.agenda} dialihkan dikarenakan pada tanggal 27 November 2024 merupakan hari libur berdasarkan KEPPRES Nomor 3 Tahun 2024\n\n` +
                      `Selanjutnya sidang akan dilaksanakan pada hari ${pihak.hari_cuti}, tanggal ${pihak.tanggal_sidang_cuti}, pukul 09:00 ${zonaWaktu} di ruangan ${pihak.ruangan} dengan agenda sidang ${pihak.agenda}\n\n` +
                      `Pesan ini merupakan notifikasi bukanlah panggilan resmi. Untuk informasi lebih lanjut silahkan menghubungi petugas PTSP kami di nomor WhatsApp : *0822-7111-5021*`;

                  if (!sentMessages.has(formattedNumber)) {
                      try {
                          if (testMode) {
                              console.log(`[TEST MODE] Akan mengirim pesan ke ${formattedNumber}:\n${message}`);
                          } else {
                              await safeSendMessage(formattedNumber, message);
                              console.log(`Pesan berhasil dikirim ke Pihak Tergugat Hari Sidang ${pihak.nama} (${formattedNumber}) untuk perkara ${pihak.nomor_perkara}`);
                          }
                          sentMessages.add(formattedNumber);
                      } catch (sendError) {
                          console.error(`Gagal kirim pesan ke Pihak Tergugat Hari Sidang ${pihak.nama} (${formattedNumber}) untuk perkara ${pihak.nomor_perkara}: ${sendError.message}`);
                      }
                  }
              }
          }

          // Kirim pesan untuk kuasa P
          if (kuasaP.length > 0) {
              for (const kuasa of kuasaP) {
                  const formattedNumber = phoneNumberFormatter(kuasa.telepon);
                  const message = `Assalamualaikum Warahmatullahi Wabarakatuh,\n\n` +
                      `Halo, saya Aleta, Bot ${pengadilan}. Kami ingin menginformasikan bahwa Anda ${kuasa.nama} yang dijadwalkan untuk sidang pada hari ${kuasa.hari_sidang}, tanggal ${kuasa.tanggal_sidang} pada perkara ${kuasa.jenis_perkara_nama} dengan nomor register ${kuasa.nomor_perkara}, dengan agenda sidang ${kuasa.agenda} dialihkan dikarenakan pada tanggal 27 November 2024 merupakan hari libur berdasarkan KEPPRES Nomor 3 Tahun 2024\n\n` +
                      `Selanjutnya sidang akan dilaksanakan pada hari ${kuasa.hari_cuti}, tanggal ${kuasa.tanggal_sidang_cuti}, pukul 09:00 ${zonaWaktu} di ruangan ${kuasa.ruangan} dengan agenda sidang ${kuasa.agenda}\n\n` +
                      `Pesan ini merupakan notifikasi bukanlah panggilan resmi. Untuk informasi lebih lanjut silahkan menghubungi petugas PTSP kami di nomor WhatsApp : *0822-7111-5021*`;

                  if (!sentMessages.has(formattedNumber)) {
                      try {
                          if (testMode) {
                              console.log(`[TEST MODE] Akan mengirim pesan ke ${formattedNumber}:\n${message}`);
                          } else {
                              await safeSendMessage(formattedNumber, message);
                              console.log(`Pesan berhasil dikirim ke Kuasa Penggugat Hari Sidang ${kuasa.nama} (${formattedNumber}) untuk perkara ${kuasa.nomor_perkara}`);
                          }
                          sentMessages.add(formattedNumber);
                      } catch (sendError) {
                          console.error(`Gagal kirim pesan ke Kuasa Penggugat Hari Sidang ${kuasa.nama} (${formattedNumber}) untuk perkara ${kuasa.nomor_perkara}: ${sendError.message}`);
                      }
                  }
              }
          }

          // Kirim pesan untuk kuasa T
          if (kuasaT.length > 0) {
              for (const kuasa of kuasaT) {
                  const formattedNumber = phoneNumberFormatter(kuasa.telepon);
                  const message = `Assalamualaikum Warahmatullahi Wabarakatuh,\n\n` +
                      `Halo, saya Aleta, Bot ${pengadilan}. Kami ingin menginformasikan bahwa Anda ${kuasa.nama} yang dijadwalkan untuk sidang pada hari ${kuasa.hari_sidang}, tanggal ${kuasa.tanggal_sidang} pada perkara ${kuasa.jenis_perkara_nama} dengan nomor register ${kuasa.nomor_perkara}, dengan agenda sidang ${kuasa.agenda} dialihkan dikarenakan pada tanggal 27 November 2024 merupakan hari libur berdasarkan KEPPRES Nomor 3 Tahun 2024\n\n` +
                      `Selanjutnya sidang akan dilaksanakan pada hari ${kuasa.hari_cuti}, tanggal ${kuasa.tanggal_sidang_cuti}, pukul 09:00 ${zonaWaktu} di ruangan ${kuasa.ruangan} dengan agenda sidang ${kuasa.agenda}\n\n` +
                      `Pesan ini merupakan notifikasi bukanlah panggilan resmi. Untuk informasi lebih lanjut silahkan menghubungi petugas PTSP kami di nomor WhatsApp : *0822-7111-5021*`;

                  if (!sentMessages.has(formattedNumber)) {
                      try {
                          if (testMode) {
                              console.log(`[TEST MODE] Akan mengirim pesan ke ${formattedNumber}:\n${message}`);
                          } else {
                              await safeSendMessage(formattedNumber, message);
                              console.log(`Pesan berhasil dikirim ke Kuasa Tergugat Hari Sidang ${kuasa.nama} (${formattedNumber}) untuk perkara ${kuasa.nomor_perkara}`);
                          }
                          sentMessages.add(formattedNumber);
                      } catch (sendError) {
                          console.error(`Gagal kirim pesan ke Kuasa Tergugat Hari Sidang ${kuasa.nama} (${formattedNumber}) untuk perkara ${kuasa.nomor_perkara}: ${sendError.message}`);
                      }
                  }
              }
          }

          // Kirim pesan untuk turut T
          if (turutT.length > 0) {
              for (const turut of turutT) {
                  const formattedNumber = phoneNumberFormatter(turut.telepon);
                  const message = `Assalamualaikum Warahmatullahi Wabarakatuh,\n\n` +
                      `Halo, saya Aleta, Bot ${pengadilan}. Kami ingin menginformasikan bahwa Anda ${turut.nama} yang dijadwalkan untuk sidang pada hari ${turut.hari_sidang}, tanggal ${turut.tanggal_sidang} pada perkara ${turut.jenis_perkara_nama} dengan nomor register ${turut.nomor_perkara}, dengan agenda sidang ${turut.agenda} dialihkan dikarenakan pada tanggal 27 November 2024 merupakan hari libur berdasarkan KEPPRES Nomor 3 Tahun 2024\n\n` +
                      `Selanjutnya sidang akan dilaksanakan pada hari ${turut.hari_cuti}, tanggal ${turut.tanggal_sidang_cuti}, pukul 09:00 ${zonaWaktu} di ruangan ${turut.ruangan} dengan agenda sidang ${turut.agenda}\n\n` +
                      `Pesan ini merupakan notifikasi bukanlah panggilan resmi. Untuk informasi lebih lanjut silahkan menghubungi petugas PTSP kami di nomor WhatsApp : *0822-7111-5021*`;

                  if (!sentMessages.has(formattedNumber)) {
                      try {
                          if (testMode) {
                              console.log(`[TEST MODE] Akan mengirim pesan ke ${formattedNumber}:\n${message}`);
                          } else {
                              await safeSendMessage(formattedNumber, message);
                              console.log(`Pesan berhasil dikirim ke Turut Tergugat Hari Sidang ${turut.nama} (${formattedNumber}) untuk perkara ${turut.nomor_perkara}`);
                          }
                          sentMessages.add(formattedNumber);
                      } catch (sendError) {
                          console.error(`Gagal kirim pesan ke Turut Tergugat Hari Sidang ${turut.nama} (${formattedNumber}) untuk perkara ${turut.nomor_perkara}: ${sendError.message}`);
                      }
                  }
              }
          }

          // Kirim pesan untuk intervensi
          if (intervensi.length > 0) {
              for (const inv of intervensi) {
                  const formattedNumber = phoneNumberFormatter(inv.telepon);
                  const message = `Assalamualaikum Warahmatullahi Wabarakatuh,\n\n` +
                      `Halo, saya Aleta, Bot ${pengadilan}. Kami ingin menginformasikan bahwa Anda ${inv.nama} yang dijadwalkan untuk sidang pada hari ${inv.hari_sidang}, tanggal ${inv.tanggal_sidang} pada perkara ${inv.jenis_perkara_nama} dengan nomor register ${inv.nomor_perkara}, dengan agenda sidang ${inv.agenda} dialihkan dikarenakan pada tanggal 27 November 2024 merupakan hari libur berdasarkan KEPPRES Nomor 3 Tahun 2024\n\n` +
                      `Selanjutnya sidang akan dilaksanakan pada hari ${inv.hari_cuti}, tanggal ${inv.tanggal_sidang_cuti}, pukul 09:00 ${zonaWaktu} di ruangan ${inv.ruangan} dengan agenda sidang ${inv.agenda}\n\n` +
                      `Pesan ini merupakan notifikasi bukanlah panggilan resmi. Untuk informasi lebih lanjut silahkan menghubungi petugas PTSP kami di nomor WhatsApp : *0822-7111-5021*`;

                  if (!sentMessages.has(formattedNumber)) {
                      try {
                          if (testMode) {
                              console.log(`[TEST MODE] Akan mengirim pesan ke ${formattedNumber}:\n${message}`);
                          } else {
                              await safeSendMessage(formattedNumber, message);
                              console.log(`Pesan berhasil dikirim ke Intervensi Hari Sidang ${inv.nama} (${formattedNumber}) untuk perkara ${inv.nomor_perkara}`);
                          }
                          sentMessages.add(formattedNumber);
                      } catch (sendError) {
                          console.error(`Gagal kirim pesan ke Intervensi Hari Sidang ${inv.nama} (${formattedNumber}) untuk perkara ${inv.nomor_perkara}: ${sendError.message}`);
                      }
                  }
              }
          }
      }

  } catch (error) {
      console.error(`Terjadi kesalahan: ${error.message}`);
  }
};

const sendMessageTundaCuti = (testMode = false) => {
  cron.schedule("00 12 24 11 *", () => {
    runLegacyNotificationIfAllowed("sendPihakTundaCuti", [{ id: "pihak-tunda-cuti", queryId: "legacy-pihak-tunda-cuti" }, { id: "party-tunda-cuti", queryId: "legacy-pihak-tunda-cuti" }], async () => {
      try {
          if (testMode) {
              console.log("Test mode aktif. Pesan tidak akan dikirim.");
              return;
          }
          
          console.log("Mengirim pesan untuk hari sidang ...");
          await sendPihakTundaCuti(testMode);
          console.log("Pengiriman pesan selesai.");
      } catch (error) {
          console.error("Terjadi kesalahan saat mengirim pesan:", error);
      }
    });
  });
};

sendMessageTundaCuti()

///////////////////////////////////////////////////

// whatsapp api
// ── WhatsApp Gateway Internal Routes (Task 1) ────────────────────────────────
if (typeof internalGatewayRoutes.setRuntimeLifecycleHandlers === "function") {
  internalGatewayRoutes.setRuntimeLifecycleHandlers({
    startWhatsappClient,
    processQueueNow: (options) => queueWorkerService.processNow(queuedMessageSender, options),
    checkWhatsappStartupTimeout: markWhatsappInitializeTimeoutIfNeeded,
  });
}
app.use("/internal/aleta-bot", internalGatewayRoutes);
// ─────────────────────────────────────────────────────────────────────────────

const getRequestToken = (req) => {
  const authHeader = req.get("authorization") || "";
  if (authHeader.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7).trim();
  }
  return req.get("x-aleta-internal-token") || req.get("x-aleta-bot-token") || "";
};

const safeCompareToken = (requestToken, configuredToken) => {
  if (!requestToken || !configuredToken) return false;
  const requestDigest = crypto.createHash("sha256").update(String(requestToken)).digest();
  const configuredDigest = crypto.createHash("sha256").update(String(configuredToken)).digest();
  return crypto.timingSafeEqual(requestDigest, configuredDigest);
};

const isLoopbackRequest = (req) => {
  const ip = req.ip || req.socket?.remoteAddress || "";
  return ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(ip) || ip.endsWith("127.0.0.1");
};

const ensureInternalAccess = (req, res, action = "internal_access") => {
  const runtimeConfig = readRuntimeConfig();
  const configuredToken =
    process.env.ALETA_BOT_INTERNAL_API_TOKEN ||
    runtimeConfig.internalApiToken ||
    process.env.ALETA_BOT_INTERNAL_TOKEN ||
    "";
  const requestToken = getRequestToken(req);

  if (configuredToken && safeCompareToken(requestToken, configuredToken)) {
    return true;
  }

  if (configuredToken && !requestToken) {
    logService.logSecurityEvent({
      eventType: "blocked_internal_endpoint_missing_token",
      severity: "warning",
      message: `Blocked ALETA Bot endpoint access without token: ${action}`,
      metadata: {
        action,
        ip: req.ip || req.socket?.remoteAddress,
        path: req.path,
        hasConfiguredToken: true,
      },
    });

    res.status(401).json({
      status: false,
      ok: false,
      error: "missing_token",
      message: "Forbidden. ALETA Bot internal token is required.",
    });
    return false;
  }

  if (!configuredToken && isLoopbackRequest(req)) {
    return true;
  }

  logService.logSecurityEvent({
    eventType: "blocked_internal_endpoint",
    severity: "warning",
    message: `Blocked ALETA Bot endpoint access: ${action}`,
    metadata: {
      action,
      ip: req.ip || req.socket?.remoteAddress,
      path: req.path,
      hasConfiguredToken: Boolean(configuredToken),
    },
  });

  res.status(403).json({
    status: false,
    ok: false,
    error: "invalid_token",
    message: "Forbidden. ALETA Bot internal token is required.",
  });
  return false;
};

app.get("/internal/aleta-bot/status", async (req, res) => {
  if (!ensureInternalAccess(req, res, "status")) return;
  await markWhatsappInitializeTimeoutIfNeeded();
  const runtimeConfig = readRuntimeConfig();
  const waStatus = whatsappStatusService.getStatus();
  const { lastQrString, ...safeWhatsappStatus } = waStatus;
  Promise.all([
    messageQueueService.getQueueStats(),
    logService.getMessageStatsToday(),
    logService.getSystemStatsToday(),
    logService.getRecentLogs("whatsapp", 1),
    logService.getRecentLogs("notification", 1),
    publicQaIntentService.getPublicQaSnapshot(),
    aiRuntimeConfigService.getMaskedAiRuntimeConfigWithHealthAlert("internal_status"),
    notificationRegistryService.getRegistrySnapshotAsync(),
  ]).then(([queueStats, messageStatsToday, systemStatsToday, whatsappEvents, notificationRuns, publicQa, aiConfig, registrySnapshot]) => res.status(200).json({
    status: true,
    whatsapp: {
      ...safeWhatsappStatus,
      qrAvailable: waStatus.status === "qr_needed" && Boolean(lastQrString),
      sessionName: whatsappSessionName,
    },
    db: botDbService.getDbStatus(),
    worker: queueWorkerService.getWorkerStatus(),
    bot: {
      botEnabled: runtimeConfig.botEnabled,
      notificationsEnabled: runtimeConfig.notificationsEnabled,
      dryRunEnabled: runtimeConfig.dryRunEnabled,
      messageDelayMs: runtimeConfig.messageDelayMs,
      messageDelayMaxMs: runtimeConfig.messageDelayMaxMs,
      retryLimit: runtimeConfig.retryLimit,
      sendingRiskLevel: runtimeConfig.sendingRiskLevel ?? null,
      sendingWindow: messageQueueService.getSendingWindowState(),
      sendingPace: sendingPaceService.describePace(),
    },
    whatsappNumberResolver: {
      portalRecipientCount: legacyWhatsappMappingStats.portalRecipientCount,
      legacyFallbackUsedCount: legacyWhatsappMappingStats.legacyWhatsappMappingUsedCount,
      lastLegacyFallbackUsedAt: legacyWhatsappMappingStats.lastLegacyWhatsappMappingUsedAt,
      legacyFallbackLabels: legacyWhatsappMappingStats.labels,
    },
    rateLimit: rateLimitService.getRateLimitStats(runtimeConfig),
    queue: queueStats,
    registry: registrySnapshot,
    dynamicScheduler: dynamicNotificationSchedulerService.getSchedulerStatus(),
    dbConnections: externalDbService.listConnections(),
    publicQa,
    aiRuntime: aiConfig,
    messageStatsToday,
    systemStatsToday,
    lastWhatsappEvent: whatsappEvents[0] || null,
    lastNotificationRun: notificationRuns[0] || null,
  })).catch((error) => {
    logService.logSystemEvent({
      eventType: "internal_status_failed",
      severity: "error",
      message: "Endpoint status internal ALETA Bot gagal dibaca.",
      metadata: { errorMessage: error.message },
    });
    res.status(500).json({ status: false, message: "Internal status failed.", error: error.message });
  });
});

app.post("/internal/aleta-bot/whatsapp/connect", async (req, res) => {
  if (!ensureInternalAccess(req, res, "whatsapp_connect")) return;

  try {
    const runtimeConfig = readRuntimeConfig();
    const dryRun = Boolean(req.body?.dryRun || req.query?.dryRun === "true");

    if (dryRun) {
      const waState = whatsappStatusService.getStatus();
      return res.status(200).json({
        ok: true,
        status: waState.status || "unknown",
        started: false,
        dryRun: true,
        qrAvailable: waState.status === "qr_needed" && Boolean(waState.lastQrString),
        botEnabled: Boolean(runtimeConfig.botEnabled),
        message: "Dry-run connect berhasil: endpoint tersedia dan tidak menginisialisasi client.",
      });
    }

    const result = await startWhatsappClient("internal_connect");
    const waState = whatsappStatusService.getStatus();
    logService.logWhatsappEvent({
      eventType: "internal_whatsapp_connect_requested",
      severity: runtimeConfig.botEnabled ? "info" : "warning",
      message: "Connect WhatsApp Gateway diminta dari endpoint internal.",
      metadata: {
        status: waState.status,
        started: result.started,
        botEnabled: Boolean(runtimeConfig.botEnabled),
        note: runtimeConfig.botEnabled ? "" : "Bot disabled, tetapi koneksi WhatsApp tetap boleh dipairing dari control panel.",
      },
    });

    return res.status(200).json({
      ok: true,
      status: waState.status || result.status,
      started: result.started,
      qrAvailable: waState.status === "qr_needed" && Boolean(waState.lastQrString),
      botEnabled: Boolean(runtimeConfig.botEnabled),
      message: runtimeConfig.botEnabled
        ? result.message
        : `${result.message} Bot masih nonaktif untuk pengiriman/notifikasi sampai diaktifkan dari pengaturan.`,
    });
  } catch (error) {
    logService.logSystemEvent({
      eventType: "internal_whatsapp_connect_failed",
      severity: "error",
      message: "Endpoint connect WhatsApp internal gagal.",
      metadata: { errorMessage: error.message },
    });
    return res.status(500).json({
      ok: false,
      error: "connect_failed",
      message: "Connect WhatsApp Gateway gagal diproses.",
    });
  }
});

// Reset sesi WhatsApp: menyembuhkan sesi macet/korup agar QR baru bisa dibuat.
// - soft (default): hentikan client, bersihkan lock, buat ulang client, inisiasi ulang.
// - hard (hardReset: true): tambahan hapus folder sesi (paksa QR baru dari nol).
app.post("/internal/aleta-bot/whatsapp/reset", async (req, res) => {
  if (!ensureInternalAccess(req, res, "whatsapp_reset")) return;

  const hardReset = Boolean(req.body?.hardReset || req.query?.hardReset === "true");
  try {
    // 1. Hentikan client aktif (best-effort).
    try {
      await destroyWhatsappClient("reset");
    } catch (destroyError) {
      logService.logSystemEvent({
        eventType: "whatsapp_reset_destroy_warning",
        severity: "warning",
        message: "Destroy client saat reset tidak sempurna, lanjut reset.",
        metadata: { errorMessage: getWhatsappStartupErrorMessage(destroyError) },
      });
    }
    whatsappInitializePromise = null;

    // 2. Bersihkan lock Chrome yang menggantung.
    prepareWhatsappSessionForInitialize("reset");

    // 3. Hard reset: hapus folder sesi agar login diminta ulang (QR baru).
    let sessionCleared = false;
    if (hardReset) {
      const sessionDir = path.join(__dirname, ".wwebjs_auth", `session-${whatsappSessionName}`);
      try {
        fs.rmSync(sessionDir, { recursive: true, force: true });
        sessionCleared = true;
      } catch (rmError) {
        logService.logSystemEvent({
          eventType: "whatsapp_reset_session_rm_failed",
          severity: "warning",
          message: "Folder sesi WhatsApp gagal dihapus saat hard reset.",
          metadata: { errorMessage: rmError && rmError.message ? rmError.message : String(rmError) },
        });
      }
    }

    // 4. Buat ulang instance client & inisiasi ulang → QR baru.
    await sleep(800);
    recreateWhatsappClientInstance("reset");
    const result = await startWhatsappClient("reset");
    const waState = whatsappStatusService.getStatus();

    logService.logWhatsappEvent({
      eventType: "internal_whatsapp_reset",
      severity: "warning",
      message: hardReset ? "Reset penuh sesi WhatsApp (hapus sesi)." : "Reset sesi WhatsApp (soft).",
      metadata: { hardReset, sessionCleared, status: waState.status },
    });

    return res.status(200).json({
      ok: true,
      status: waState.status || result.status,
      hardReset,
      sessionCleared,
      qrAvailable: waState.status === "qr_needed" && Boolean(waState.lastQrString),
      message: hardReset
        ? "Sesi WhatsApp direset penuh. Tunggu beberapa detik, QR baru akan muncul untuk dipindai."
        : "Sesi WhatsApp dimulai ulang. Tunggu beberapa detik, QR akan muncul bila login diperlukan.",
    });
  } catch (error) {
    logService.logSystemEvent({
      eventType: "internal_whatsapp_reset_failed",
      severity: "error",
      message: "Endpoint reset WhatsApp internal gagal.",
      metadata: { errorMessage: getWhatsappStartupErrorMessage(error), hardReset },
    });
    return res.status(500).json({
      ok: false,
      error: "reset_failed",
      message: "Reset sesi WhatsApp gagal diproses.",
    });
  }
});

app.get("/internal/aleta-bot/whatsapp/diagnostics", async (req, res) => {
  if (!ensureInternalAccess(req, res, "whatsapp_diagnostics")) return;

  try {
    await markWhatsappInitializeTimeoutIfNeeded();
    const runtimeConfig = readRuntimeConfig();
    const waState = whatsappStatusService.getStatus();
    return res.status(200).json({
      ok: true,
      sessionName: getWhatsappSessionName(runtimeConfig),
      status: waState.status || "unknown",
      initializing: Boolean(whatsappInitializePromise),
      hasClient: Boolean(client),
      hasQr: Boolean(waState.lastQrString),
      lastErrorType: waState.lastErrorType || "",
      initializingSince: waState.initializingStartedAt || null,
      initializeAgeMs: waState.initializeAgeMs || 0,
      authPathConfigured: true,
      message:
        waState.status === "browser_locked"
          ? "Session WhatsApp sedang dipakai proses browser lain. Tutup proses Chrome/Puppeteer lama atau restart backend ALETA Bot, lalu coba lagi."
          : waState.status === "initialize_timeout"
          ? "Inisialisasi WhatsApp terlalu lama tanpa QR/ready. Client sudah dihentikan aman tanpa logout."
          : "Diagnostics WhatsApp Gateway terbaca. QR raw, token, session path, dan stack trace tidak disertakan.",
    });
  } catch (error) {
    logService.logSystemEvent({
      eventType: "internal_whatsapp_diagnostics_failed",
      severity: "error",
      message: "Endpoint diagnostics WhatsApp internal gagal.",
      metadata: { errorMessage: getWhatsappStartupErrorMessage(error) },
    });
    return res.status(500).json({
      ok: false,
      error: "diagnostics_failed",
      message: "Diagnostics WhatsApp Gateway belum dapat dibaca.",
    });
  }
});

app.get("/internal/aleta-bot/ai-config", async (req, res) => {
  if (!ensureInternalAccess(req, res, "ai_config")) return;
  try {
    const masked = await aiRuntimeConfigService.getMaskedAiRuntimeConfigWithHealthAlert("ai_config_endpoint");
    res.status(200).json({
      ok: true,
      status: masked.status,
      provider: masked.provider,
      model: masked.model,
      publicQaAiEnabled: masked.publicQaAiAnswerEnabled,
      apiKeyConfigured: masked.apiKeyConfigured && masked.secretAvailable,
      source: masked.configSource,
      lastSyncAt: masked.syncedAt,
      lastTestAt: masked.lastTestAt,
      lastTestStatus: masked.lastTestStatus,
      message: masked.message,
      config: masked,
    });
  } catch (error) {
    const message = aiRuntimeConfigService.sanitizeAiError(error);
    logService.logSystemEvent({
      eventType: "ai_config_read_failed",
      severity: "error",
      message: "Endpoint AI config ALETA Bot gagal dibaca.",
      metadata: { errorMessage: message },
    });
    res.status(500).json({ ok: false, status: "error", message });
  }
});

app.post("/internal/aleta-bot/ai-config/sync", async (req, res) => {
  if (!ensureInternalAccess(req, res, "ai_config_sync")) return;
  try {
    const config = await aiRuntimeConfigService.updateAiRuntimeConfig(req.body || {}, "manajemen_surat");
    res.status(200).json({ status: true, config });
  } catch (error) {
    const message = aiRuntimeConfigService.sanitizeAiError(error);
    logService.logSystemEvent({
      eventType: "ai_config_sync_failed",
      severity: "warning",
      message: "Sinkronisasi AI config dari portal gagal.",
      metadata: { errorMessage: message },
    });
    res.status(400).json({ status: false, message });
  }
});

app.post("/internal/aleta-bot/ai-config/test", async (req, res) => {
  if (!ensureInternalAccess(req, res, "ai_config_test")) return;
  try {
    const result = await aiProviderAdapter.testProviderConnection(req.body?.config || {});
    logService.logSystemEvent({
      eventType: "ai_runtime_test",
      severity: result.ok ? "info" : "warning",
      message: result.ok ? "Test AI runtime berhasil." : "Test AI runtime gagal.",
      metadata: {
        provider: result.provider,
        model: result.model,
        status: result.status,
        errorMessage: result.errorMessage || "",
      },
    });
    res.status(result.ok ? 200 : 400).json({ status: result.ok, result });
  } catch (error) {
    const message = aiProviderAdapter.sanitizeAiError(error);
    res.status(400).json({ status: false, message });
  }
});

app.get("/internal/aleta-bot/queue", async (req, res) => {
  if (!ensureInternalAccess(req, res, "queue")) return;
  try {
    const limit = Number(req.query?.limit || 20);
    res.status(200).json({
      status: true,
      stats: await messageQueueService.getQueueStats(),
      items: await messageQueueService.readQueuePublic(limit),
    });
  } catch (error) {
    logService.logSystemEvent({
      eventType: "internal_queue_failed",
      severity: "error",
      message: "Endpoint queue internal ALETA Bot gagal dibaca.",
      metadata: { errorMessage: error.message },
    });
    res.status(500).json({ status: false, message: "Internal queue failed." });
  }
});

app.post("/internal/aleta-bot/validate-query", (req, res) => {
  if (!ensureInternalAccess(req, res, "validate_query")) return;
  const result = validateQuery(req.body?.sqlText || "", {
    category: req.body?.category,
    recipientColumn: req.body?.recipientColumn,
    outputColumns: req.body?.outputColumns,
  });
  res.status(200).json({ status: true, validation: result });
});

app.post("/internal/aleta-bot/validate-template", (req, res) => {
  if (!ensureInternalAccess(req, res, "validate_template")) return;
  const result = validateTemplate(req.body?.template || {}, {
    category: req.body?.category,
    outputColumns: req.body?.outputColumns,
    requiredPlaceholders: req.body?.requiredPlaceholders,
  });
  res.status(200).json({ status: true, validation: result });
});

app.get("/internal/aleta-bot/public-qa/intents", async (req, res) => {
  if (!ensureInternalAccess(req, res, "public_qa_intents")) return;
  try {
    res.status(200).json({
      status: true,
      intents: publicQaIntentService.getRuntimeIntents(),
      logs: await publicQaIntentService.getRecentPublicQaLogs(50),
      snapshot: await publicQaIntentService.getPublicQaSnapshot(),
    });
  } catch (error) {
    logService.logSystemEvent({
      eventType: "public_qa_intents_failed",
      severity: "error",
      message: "Endpoint intent Pertanyaan Para Pihak gagal dibaca.",
      metadata: { errorMessage: error.message },
    });
    res.status(500).json({ status: false, message: "Public QA intents failed.", error: error.message });
  }
});

app.post("/internal/aleta-bot/public-qa/test", async (req, res) => {
  if (!ensureInternalAccess(req, res, "public_qa_test")) return;
  try {
    const question = String(req.body?.question || "");
    const result = await publicQaIntentService.resolvePublicQaAnswer({
      message: question,
      senderNumber: String(req.body?.senderNumber || "test"),
      senderName: String(req.body?.senderName || "Super Admin Preview"),
    });
    res.status(200).json({ status: true, result });
  } catch (error) {
    logService.logSystemEvent({
      eventType: "public_qa_test_failed",
      severity: "warning",
      message: "Test intent Pertanyaan Para Pihak gagal.",
      metadata: { errorMessage: error.message },
    });
    res.status(400).json({ status: false, message: error.message });
  }
});

app.post("/internal/aleta-bot/registry/enqueue-dry-run", async (req, res) => {
  if (!ensureInternalAccess(req, res, "registry_enqueue_dry_run")) return;
  try {
    const item = await notificationRegistryService.enqueuePilotDryRun(req.body?.notificationKey, req.body?.sampleData || {});
    res.status(200).json({ status: true, item });
  } catch (error) {
    logService.logSystemEvent({
      eventType: "registry_dry_run_enqueue_failed",
      severity: "warning",
      message: "Pilot registry ALETA Bot gagal dimasukkan ke queue dry-run.",
      metadata: { notificationKey: req.body?.notificationKey, errorMessage: error.message },
    });
    res.status(400).json({ status: false, message: error.message });
  }
});

app.get("/internal/aleta-bot/db-connections", (req, res) => {
  if (!ensureInternalAccess(req, res, "db_connections")) return;
  res.status(200).json({ status: true, connections: externalDbService.listConnections() });
});

app.post("/internal/aleta-bot/db-connections/test", async (req, res) => {
  if (!ensureInternalAccess(req, res, "db_connection_test")) return;
  const connectionKey = req.body?.connectionKey || req.body?.key || "sipp_primary";
  const result = req.body?.connection
    ? await externalDbService.testConnectionConfig(req.body.connection)
    : await externalDbService.testConnection(connectionKey);
  logService.logSystemEvent({
    eventType: "external_db_connection_test",
    severity: result.status === "success" ? "info" : "warning",
    message: result.status === "success" ? "Test koneksi database eksternal berhasil." : "Test koneksi database eksternal gagal.",
    metadata: { connectionKey, status: result.status, error: result.error, source: result.source },
  });
  res.status(result.status === "success" ? 200 : 400).json({ status: result.status === "success", result });
});

app.post("/send-message", async (req, res) => {
  if (!ensureInternalAccess(req, res, "manual_send_post")) return;

  const runtimeConfig = readRuntimeConfig();
  if (!runtimeConfig.manualSendEnabled) {
    logService.logSecurityEvent({
      eventType: "manual_send_disabled",
      severity: "warning",
      message: "Manual send endpoint dipanggil saat manualSendEnabled=false.",
      metadata: { path: req.path },
    });
    res.status(403).json({ status: false, message: "Manual send is disabled." });
    return;
  }

  const to = req.body.to || req.body.number || req.body.recipient;
  const message = req.body.message || "";
  const shouldQueue = req.body.queue !== false;
  const idempotencyKey = req.body.idempotencyKey || buildManualIdempotencyKey({
    recipientNumber: to,
    message,
    requestId: req.body.requestId,
  });

  if (shouldQueue) {
    const item = await messageQueueService.enqueueMessage({
      to,
      message,
      category: "manual",
      notificationKey: "manual-send",
      priority: 1,
      idempotencyKey,
      metadata: { source: "post_send_message", processImmediately: true },
    });
    const processed = await queueWorkerService.processNow(queuedMessageSender, { reason: "manual_send_post", limit: 5 });
    res.status(200).json({ status: true, queued: true, item, processed });
    return;
  }

  const response = await messageService.safeSendMessage({
    client: ensureWhatsappClient("manual_send_post"),
    sendFn: originalSendMessage,
    to,
    message,
    category: "manual",
    notificationKey: "manual-send",
    idempotencyKey,
    metadata: { source: "post_send_message" },
  });

  res.status(200).json({ status: true, queued: false, sent: Boolean(response) });
});

app.get("/send-message/:number/:message", async (req, res) => {
  if (!ensureInternalAccess(req, res, "manual_send_get")) return;
  if (!readRuntimeConfig().manualSendEnabled) {
    res.status(403).json({ status: false, message: "Manual send is disabled." });
    return;
  }

  let numberId = req.params.number;
  let message = req.params.message;

  let split = message.split("+");
  let fix_message = split.join(" ");

  const response = await messageService.safeSendMessage({
    client: ensureWhatsappClient("manual_send_get"),
    sendFn: originalSendMessage,
    to: numberId,
    message: fix_message,
    category: "manual",
    notificationKey: "manual-send",
    idempotencyKey: buildManualIdempotencyKey({ recipientNumber: numberId, message: fix_message, requestId: req.query.requestId }),
    metadata: { source: "get_send_message" },
  });

  res.status(200).json({
    status: true,
    response,
  });
});

app.get("/send-message-group/:number/:message", async (req, res) => {
  if (!ensureInternalAccess(req, res, "manual_send_group_get")) return;
  if (!readRuntimeConfig().manualSendEnabled) {
    res.status(403).json({ status: false, message: "Manual send is disabled." });
    return;
  }

  let numberId = req.params.number;
  let message = req.params.message;

  let split = message.split("+");
  let fix_message = split.join(" ");

  const response = await messageService.safeSendMessage({
    client: ensureWhatsappClient("manual_send_group_get"),
    sendFn: originalSendMessage,
    to: numberId,
    message: fix_message,
    category: "manual",
    notificationKey: "manual-send-group",
    idempotencyKey: buildManualIdempotencyKey({ recipientNumber: numberId, message: fix_message, requestId: req.query.requestId }),
    metadata: { source: "get_send_message_group" },
  });

  res.status(200).json({
    status: true,
    response,
  });
});

let shutdownStarted = false;
async function shutdownWhatsappClient(signal) {
  if (shutdownStarted) return;
  shutdownStarted = true;
  isShuttingDown = true;
  whatsappInitializePromise = null;
  try {
    await destroyWhatsappClient(`shutdown_${signal}`);
    whatsappStatusService.setStatus("disconnected", "shutdown", {
      severity: "info",
      message: "WhatsApp client stopped without logout.",
      signal,
    });
    console.log("WhatsApp client stopped without logout.");
  } catch (error) {
    whatsappStatusService.setStatus("disconnected", "shutdown_error", {
      severity: "warning",
      message: "WhatsApp client shutdown selesai dengan catatan.",
      errorMessage: getWhatsappStartupErrorMessage(error),
      errorType: getWhatsappStartupErrorType(error),
    });
    console.warn("WhatsApp shutdown cleanup:", getWhatsappStartupErrorMessage(error));
  } finally {
    server.close(() => {
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 3000).unref();
  }
}

process.once("SIGINT", () => {
  void shutdownWhatsappClient("SIGINT");
});

process.once("SIGTERM", () => {
  void shutdownWhatsappClient("SIGTERM");
});

// Inisiasi WhatsApp client dijalankan SEKALI di sini, setelah seluruh fungsi
// (termasuk startWhatsappClient) selesai dideklarasikan. Dulu blok ini keliru
// berada di dalam registerWhatsappClientEventHandlers sehingga ikut berjalan saat
// client dibuat di awal modul — memicu ReferenceError (TDZ) startWhatsappClient.
if (readRuntimeConfig().botEnabled) {
  void startWhatsappClient("startup");
} else {
  whatsappStatusService.setStatus("disconnected", "initialize_skipped", { message: "Bot nonaktif dari konfigurasi portal." });
  console.log("[ALETA Bot] Bot nonaktif dari konfigurasi portal. WhatsApp client tidak diinisialisasi.");
}

server.listen(port, '0.0.0.0', () => {
  console.log(`Aleta listening at port ${port}`);
});
