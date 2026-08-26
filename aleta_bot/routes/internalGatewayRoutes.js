"use strict";

const express = require("express");
const crypto = require("crypto");
const router = express.Router();

const { readRuntimeConfig, writeRuntimeConfig, getWhatsappSessionName } = require("../config/runtime-config");
const whatsappStatusService = require("../services/whatsappStatusService");
const messageQueueService = require("../services/messageQueueService");
const sendingPaceService = require("../services/sendingPaceService");
const banSignalService = require("../services/banSignalService");
const numberWarmupService = require("../services/numberWarmupService");
const ecourtStoreService = require("../services/ecourtStoreService");
const optOutService = require("../services/optOutService");
const queryMetricsService = require("../services/queryMetricsService");
const queryGuardService = require("../services/queryGuardService");
const caseSnapshotService = require("../services/caseSnapshotService");
const sippCircuitBreaker = require("../services/sippCircuitBreakerService");
const serviceAnalyticsService = require("../services/serviceAnalyticsService");
const paniteraDashboardService = require("../services/paniteraDashboardService");
const ecourtVerificationService = require("../services/ecourtVerificationService");
const ecourtReconciliationService = require("../services/ecourtReconciliationService");
const ecourtStatusService = require("../services/ecourtStatusService");
const ecourtSettingsService = require("../services/ecourtSettingsService");
const nomorVerificationService = require("../services/nomorVerificationService");
const recipientHealthService = require("../services/recipientHealthService");
const queueWorkerService = require("../services/queueWorkerService");
const dynamicNotificationSchedulerService = require("../services/dynamicNotificationSchedulerService");
const logService = require("../services/logService");
const antrianOnlineService = require("../services/antrianOnlineService");
const { analyzeRecipientNumber } = require("../services/recipientValidationService");
const sippReadOnlyBridgeService = require("../services/sippReadOnlyBridgeService");
const productionGuardService = require("../services/productionGuardService");
const manualSendService = require("../services/manualSendService");

const runtimeLifecycleHandlers = {
  startWhatsappClient: null,
  processQueueNow: null,
  checkWhatsappStartupTimeout: null,
};

function setRuntimeLifecycleHandlers(handlers = {}) {
  runtimeLifecycleHandlers.startWhatsappClient =
    typeof handlers.startWhatsappClient === "function"
      ? handlers.startWhatsappClient
      : runtimeLifecycleHandlers.startWhatsappClient;
  runtimeLifecycleHandlers.processQueueNow =
    typeof handlers.processQueueNow === "function"
      ? handlers.processQueueNow
      : runtimeLifecycleHandlers.processQueueNow;
  runtimeLifecycleHandlers.checkWhatsappStartupTimeout =
    typeof handlers.checkWhatsappStartupTimeout === "function"
      ? handlers.checkWhatsappStartupTimeout
      : runtimeLifecycleHandlers.checkWhatsappStartupTimeout;
}

async function checkWhatsappStartupTimeoutIfAvailable() {
  if (typeof runtimeLifecycleHandlers.checkWhatsappStartupTimeout !== "function") {
    return false;
  }
  try {
    return await runtimeLifecycleHandlers.checkWhatsappStartupTimeout();
  } catch (error) {
    logService.logSystemEvent({
      eventType: "whatsapp_startup_timeout_check_failed",
      severity: "warning",
      message: "Pemeriksaan timeout startup WhatsApp gagal.",
      metadata: { errorMessage: sanitizeWhatsappRuntimeError(error.message) },
    });
    return false;
  }
}

function triggerQueueProcessNow(reason, limit = 1) {
  if (typeof runtimeLifecycleHandlers.processQueueNow !== "function") {
    return false;
  }

  Promise.resolve(runtimeLifecycleHandlers.processQueueNow({ reason, limit }))
    .catch((error) => {
      logService.logSystemEvent({
        eventType: "queue_immediate_trigger_failed",
        severity: "warning",
        message: "Pemicu proses cepat queue ALETA Bot gagal.",
        metadata: { reason, errorMessage: error.message },
      });
    });
  return true;
}

function shouldProcessGatewayMessageImmediately({ category, sourceFeature, metadata, explicit }) {
  if (explicit === true) return true;
  if (metadata && metadata.processImmediately === true) return true;
  if (metadata && metadata.testMessage === true) return true;

  const normalizedCategory = String(category || "").toLowerCase();
  const normalizedFeature = String(sourceFeature || "").toLowerCase();
  if (normalizedCategory === "manual") return true;
  return normalizedCategory === "system" && (
    normalizedFeature.includes("test") ||
    normalizedFeature.includes("manual") ||
    normalizedFeature.includes("uji")
  );
}

function compactObject(input = {}) {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined && value !== null && value !== "")
  );
}

function hashMessageBody(message) {
  return crypto.createHash("sha256").update(String(message || "")).digest("hex");
}

function normalizeMessageContract(rawContract, context = {}) {
  if (!rawContract || typeof rawContract !== "object") return null;
  return compactObject({
    version: String(rawContract.version || rawContract.messageContractVersion || rawContract.message_contract_version || ""),
    source: String(rawContract.source || rawContract.messageContractSource || rawContract.message_contract_source || ""),
    renderer: String(rawContract.renderer || ""),
    sourceApp: String(rawContract.sourceApp || context.sourceApp || ""),
    sourceFeature: String(rawContract.sourceFeature || context.sourceFeature || ""),
    entityType: String(rawContract.entityType || context.entityType || ""),
    entityId: String(rawContract.entityId || context.entityId || ""),
    eventType: String(rawContract.eventType || context.eventType || ""),
    templateId: String(rawContract.templateId || rawContract.template_id || context.templateId || ""),
    traceId: String(rawContract.traceId || rawContract.trace_id || context.traceId || ""),
    messageSha256: String(rawContract.messageSha256 || rawContract.message_sha256 || ""),
    messageLength: Number(rawContract.messageLength || rawContract.message_length || context.messageLength || 0),
    renderedAt: String(rawContract.renderedAt || rawContract.rendered_at || ""),
    runtimeMode: String(rawContract.runtimeMode || rawContract.runtime_mode || ""),
  });
}

function validateMessageContract(contract, message) {
  if (!contract) return { ok: true };
  const expectedHash = String(contract.messageSha256 || "");
  if (expectedHash && expectedHash !== hashMessageBody(message)) {
    return { ok: false, reason: "message_contract_hash_mismatch" };
  }
  return { ok: true };
}

function startWhatsappClientAfterConfigSync(config) {
  if (!config.botEnabled || typeof runtimeLifecycleHandlers.startWhatsappClient !== "function") {
    return;
  }

  Promise.resolve(runtimeLifecycleHandlers.startWhatsappClient("config_sync"))
    .then((result) => {
      if (!result?.started) return;
      logService.logSystemEvent({
        eventType: "internal_runtime_config_started_whatsapp",
        severity: "info",
        message: "WhatsApp client diinisialisasi setelah bot diaktifkan dari portal.",
        metadata: { source: "config_sync", status: result.status },
      });
    })
    .catch((error) => {
      logService.logSystemEvent({
        eventType: "internal_runtime_config_start_whatsapp_failed",
        severity: "warning",
        message: "WhatsApp client belum dapat diinisialisasi setelah config sync.",
        metadata: { errorMessage: sanitizeWhatsappRuntimeError(error.message) },
      });
    });
}

function sanitizeWhatsappRuntimeError(value) {
  const message = String(value || "");
  const lower = message.toLowerCase();
  if (!message) return null;
  if (
    lower.includes("browser is already running") ||
    lower.includes("userdata") ||
    lower.includes("userdatadir") ||
    lower.includes("session-aleta-whatsapp-main")
  ) {
    return "Session WhatsApp sedang dipakai proses browser lain. Tutup proses Chrome/Puppeteer lama atau restart backend ALETA Bot, lalu coba lagi.";
  }
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

// Internal Token Middleware

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

function tokenFingerprint(token) {
  const value = String(token || "");
  if (!value) return "";
  return crypto.createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function safeCompareToken(requestToken, configuredToken) {
  if (!requestToken || !configuredToken) return false;
  const requestDigest = crypto.createHash("sha256").update(String(requestToken)).digest();
  const configuredDigest = crypto.createHash("sha256").update(String(configuredToken)).digest();
  return crypto.timingSafeEqual(requestDigest, configuredDigest);
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

  if (!safeCompareToken(requestToken, configuredToken)) {
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

// GET /whatsapp/status

router.get("/security/token-health", requireInternalToken, (req, res) => {
  const runtimeConfig = readRuntimeConfig();
  const configuredToken = getConfiguredToken();
  const fingerprint = tokenFingerprint(configuredToken);

  return res.json({
    ok: true,
    status: fingerprint ? "ok" : "missing_bot_token",
    tokenConfigured: Boolean(fingerprint),
    tokenFingerprint: fingerprint,
    acceptedHeader: "x-aleta-internal-token",
    envApiTokenConfigured: Boolean(process.env.ALETA_BOT_INTERNAL_API_TOKEN),
    envLegacyTokenConfigured: Boolean(process.env.ALETA_BOT_INTERNAL_TOKEN),
    runtimeConfigTokenConfigured: Boolean(runtimeConfig.internalApiToken),
    message: fingerprint
      ? "Token internal ALETA Bot terkonfigurasi dan request portal terautentikasi."
      : "Token internal ALETA Bot belum dikonfigurasi.",
  });
});

router.post("/config/sync", requireInternalToken, (req, res) => {
  try {
    const config = writeRuntimeConfig(req.body || {});
    dynamicNotificationSchedulerService.refreshSchedules();
    startWhatsappClientAfterConfigSync(config);

    logService.logSystemEvent({
      eventType: "internal_runtime_config_synced",
      severity: "info",
      message: "Runtime config ALETA Bot disinkronkan dari portal.",
      metadata: {
        source: config.source,
        botEnabled: Boolean(config.botEnabled),
        notificationsEnabled: Boolean(config.notificationsEnabled),
        dryRunEnabled: Boolean(config.dryRunEnabled),
        // Kinerja query ke database perkara. Diurutkan menurut total waktu,
      // supaya query ringan yang dipanggil ribuan kali ikut terlihat - bukan
      // hanya query berat yang jarang dijalankan.
      queryPerformance: queryMetricsService.getSnapshot({ limit: 10 }),
      queryGuard: queryGuardService.getGuardConfig(),
      // Potret perkara: rasio jawaban yang dilayani tanpa menyentuh SIPP.
      // Inilah angka penentu berhasil atau tidaknya penurunan beban.
      caseSnapshot: caseSnapshotService.getStats(),
      sippCircuit: sippCircuitBreaker.getStatus(),
      productionAutomationGuard: {
          enabled: config.productionAutomationGuard?.enabled !== false,
          legacyDirectSendEnabled: config.productionAutomationGuard?.legacyDirectSendEnabled === true,
          legacyNotificationSchedulerEnabled: config.productionAutomationGuard?.legacyNotificationSchedulerEnabled === true,
          requireGatewayMessageContract: config.productionAutomationGuard?.requireGatewayMessageContract !== false,
        },
        updatedAt: config.updatedAt,
      },
    });

    return res.json({
      ok: true,
      status: true,
      config: {
        botEnabled: Boolean(config.botEnabled),
        notificationsEnabled: Boolean(config.notificationsEnabled),
        dryRunEnabled: Boolean(config.dryRunEnabled),
        productionAutomationGuard: {
          enabled: config.productionAutomationGuard?.enabled !== false,
          legacyDirectSendEnabled: config.productionAutomationGuard?.legacyDirectSendEnabled === true,
          legacyNotificationSchedulerEnabled: config.productionAutomationGuard?.legacyNotificationSchedulerEnabled === true,
          requireGatewayMessageContract: config.productionAutomationGuard?.requireGatewayMessageContract !== false,
        },
        updatedAt: config.updatedAt,
      },
    });
  } catch (error) {
    logService.logSystemEvent({
      eventType: "internal_runtime_config_sync_failed",
      severity: "error",
      message: "Sinkronisasi runtime config ALETA Bot gagal.",
      metadata: { errorMessage: error.message },
    });
    return res.status(500).json({
      ok: false,
      status: false,
      error: "config_sync_failed",
      message: error.message,
    });
  }
});

router.post("/jlf/sipp/query", requireInternalToken, async (req, res) => {
  const operation = String(req.body?.operation || "").trim();
  const params = req.body?.params && typeof req.body.params === "object" ? req.body.params : {};
  const result = await sippReadOnlyBridgeService.safeHandleBridgeOperation(operation, params);
  return res.status(result.ok ? 200 : 400).json(result);
});

/**
 * Corong layanan dan laporan pelayanan publik.
 *
 * Dipisah dari /whatsapp/status karena berisi kueri agregat yang lebih berat
 * dan hanya dibaca sesekali untuk keperluan pelaporan.
 */
router.get("/service-report", requireInternalToken, async (req, res) => {
  try {
    const range = String(req.query.range || "30d");
    const [funnel, report] = await Promise.all([
      serviceAnalyticsService.getFunnel({ range }),
      serviceAnalyticsService.getServiceReport({ range }),
    ]);
    res.json({ ok: true, range, funnel, report });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/**
 * Ringkasan kerja panitera pengganti.
 *
 * HANYA MEMBACA. Tidak ada tombol yang mengubah apa pun dari sini - keputusan
 * verifikasi tetap di tangan hakim lewat jalurnya sendiri.
 */
router.get("/ecourt/panitera", requireInternalToken, async (req, res) => {
  try {
    const limit = Number(req.query.limit || 100);
    const dashboard = await paniteraDashboardService.getDashboard({ limit });
    res.json({ ok: true, dashboard });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/**
 * Daftar dokumen menunggu verifikasi untuk hakim yang membuka portal.
 *
 * Nama hakim datang dari portal yang sudah mengautentikasi penggunanya, dan
 * gerbang ini menuntut token internal. Meski begitu, layanannya tetap
 * memeriksa ulang bahwa nama itu terdaftar sebagai hakim DAN duduk pada
 * majelis perkaranya - persis seperti jalur WhatsApp.
 */
router.get("/ecourt/verifikasi", requireInternalToken, async (req, res) => {
  try {
    const nama = String(req.query.nama || "");
    const limit = Number(req.query.limit || 50);
    const hasil = await ecourtVerificationService.listForPortal(nama, { limit });
    res.json({ ok: true, ...hasil });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/** Menyimpan keputusan verifikasi dari portal. */
router.post("/ecourt/verifikasi", requireInternalToken, async (req, res) => {
  try {
    const hasil = await ecourtVerificationService.decideFromPortal({
      namaLengkap: String(req.body?.nama || ""),
      documentKey: String(req.body?.documentKey || ""),
      keputusan: String(req.body?.keputusan || ""),
      konfirmasi: req.body?.konfirmasi === true,
      keterangan: String(req.body?.keterangan || ""),
    });
    res.status(hasil.ok ? 200 : 400).json(hasil);
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/** Selisih antara catatan ALETA dan status sesungguhnya di e-Court. */
router.get("/ecourt/rekonsiliasi", requireInternalToken, async (req, res) => {
  try {
    const limit = Number(req.query.limit || 500);
    const laporan = await ecourtReconciliationService.periksa({ limit });
    res.json({ ok: true, laporan });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/** Keadaan e-Court untuk tab pengelolaan di portal. Hanya membaca. */
router.get("/ecourt/status", requireInternalToken, async (req, res) => {
  try {
    const limit = Number(req.query.limit || 100);
    const [status, dokumen] = await Promise.all([
      ecourtStatusService.getStatus({ limit }),
      ecourtStatusService.getDokumenTerbaru({ limit: Number(req.query.dokumenLimit || 25) }),
    ]);
    res.json({ ok: true, status, dokumen });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/**
 * Menyalakan atau mematikan pemberitahuan e-Court.
 *
 * Dimatikan TIDAK membuang antrean: dokumen yang menunggu tetap menunggu dan
 * akan dikirim begitu dinyalakan kembali.
 */
router.post("/ecourt/aktif", requireInternalToken, (req, res) => {
  try {
    const aktif = req.body?.aktif === true;
    const sekarang = readRuntimeConfig();
    writeRuntimeConfig({ ...sekarang, ecourtNotifikasiAktif: aktif });

    void logService.logSecurityEvent({
      eventType: "ecourt_notifikasi_saklar",
      severity: "warning",
      message: aktif
        ? "Pemberitahuan e-Court dinyalakan dari portal."
        : "Pemberitahuan e-Court dimatikan dari portal.",
      metadata: { aktif },
    });

    res.json({ ok: true, aktif });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/** Pengaturan e-Court yang dapat disunting portal. */
router.get("/ecourt/pengaturan", requireInternalToken, (req, res) => {
  try {
    res.json({ ok: true, pengaturan: ecourtSettingsService.getSettings() });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/** Menyimpan satu aturan pemberitahuan. */
router.post("/ecourt/pengaturan/aturan", requireInternalToken, (req, res) => {
  try {
    const hasil = ecourtSettingsService.saveRule({
      key: String(req.body?.key || ""),
      patterns: req.body?.patterns,
      ringkasan: String(req.body?.ringkasan || ""),
      tindakan: String(req.body?.tindakan || ""),
      audience: String(req.body?.audience || ""),
      notify: req.body?.notify !== false,
      olehSiapa: String(req.body?.olehSiapa || ""),
    });
    res.status(hasil.ok ? 200 : 400).json(hasil);
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/** Menghapus aturan tambahan, atau mengembalikan kelas bawaan ke bentuk asalnya. */
router.post("/ecourt/pengaturan/aturan/hapus", requireInternalToken, (req, res) => {
  try {
    const hasil = ecourtSettingsService.deleteRule({
      key: String(req.body?.key || ""),
      olehSiapa: String(req.body?.olehSiapa || ""),
    });
    res.status(hasil.ok ? 200 : 400).json(hasil);
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/** Menyimpan ambang hari. */
router.post("/ecourt/pengaturan/ambang", requireInternalToken, (req, res) => {
  try {
    const hasil = ecourtSettingsService.saveThresholds({
      ambangMendesakHari: req.body?.ambangMendesakHari,
      tanyaUlangHari: req.body?.tanyaUlangHari,
      olehSiapa: String(req.body?.olehSiapa || ""),
    });
    res.status(hasil.ok ? 200 : 400).json(hasil);
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/**
 * Melepas nomor yang pernah dijawab BUKAN agar ditanya ulang.
 *
 * TIDAK langsung mengizinkan pengiriman: pemiliknya ditanya sekali lagi, dan
 * tetap dialah yang menentukan.
 */
router.post("/ecourt/nomor/tanya-ulang", requireInternalToken, async (req, res) => {
  try {
    const hasil = await nomorVerificationService.resetNumber(
      String(req.body?.nomor || ""),
      String(req.body?.namaPihak || ""),
      { olehSiapa: String(req.body?.olehSiapa || "") }
    );
    res.status(hasil.ok ? 200 : 400).json(hasil);
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/** Padanan agenda sidang yang dapat disunting panitera. */
router.get("/agenda/pengaturan", requireInternalToken, (req, res) => {
  try {
    res.json({ ok: true, ...ecourtSettingsService.getAgendaSettings() });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/** Menyimpan satu padanan agenda. */
router.post("/agenda/pengaturan", requireInternalToken, (req, res) => {
  try {
    const hasil = ecourtSettingsService.saveAgendaRule({
      key: String(req.body?.key || ""),
      patterns: req.body?.patterns,
      persiapan: req.body?.persiapan,
      h3: req.body?.h3 !== false,
      h1: req.body?.h1 !== false,
      olehSiapa: String(req.body?.olehSiapa || ""),
    });
    res.status(hasil.ok ? 200 : 400).json(hasil);
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/** Menghapus padanan tambahan, atau mengembalikan agenda bawaan ke asalnya. */
router.post("/agenda/pengaturan/hapus", requireInternalToken, (req, res) => {
  try {
    const hasil = ecourtSettingsService.deleteAgendaRule({
      key: String(req.body?.key || ""),
      olehSiapa: String(req.body?.olehSiapa || ""),
    });
    res.status(hasil.ok ? 200 : 400).json(hasil);
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

router.get("/whatsapp/status", requireInternalToken, async (req, res) => {
  try {
    await checkWhatsappStartupTimeoutIfAvailable();
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
      lastErrorType: waState.lastErrorType || "",
      sessionStartedAt: waState.sessionStartedAt || null,
      lastMessageSentAt: waState.lastMessageSentAt || null,
      sessionAgeHours: waState.sessionAgeHours,
      authFailureCount: waState.authFailureCount || 0,
      lastAuthFailureAt: waState.lastAuthFailureAt || null,
      sendingWindow: messageQueueService.getSendingWindowState(),
      sendingPace: sendingPaceService.describePace(),
      // Tanda blokir ditaruh di status supaya admin melihat penghentian
      // otomatis tanpa harus membuka catatan keamanan.
      banSignal: banSignalService.getStatus(),
      numberWarmup: numberWarmupService.describeWarmup(),
      ecourt: await ecourtStoreService.getStats(),
      // Jumlah penerima yang meminta berhenti. Angka yang naik tajam adalah
      // peringatan dini bahwa isi atau frekuensi pesan mulai mengganggu —
      // jauh lebih baik diketahui dari sini daripada dari surat peninjauan akun.
      // Nomor yang dihentikan karena pesannya tidak pernah sampai. Angka yang
      // naik menandakan data telepon di SIPP perlu dibersihkan.
      suppressedRecipientCount: await recipientHealthService
        .listSuppressed(1000)
        .then((rows) => rows.length)
        .catch(() => null),
      optOutCount: await optOutService
        .listOptOuts(1000)
        .then((rows) => rows.length)
        .catch(() => null),
      productionAutomationGuard: {
        enabled: runtimeConfig.productionAutomationGuard?.enabled !== false,
        legacyDirectSendEnabled: runtimeConfig.productionAutomationGuard?.legacyDirectSendEnabled === true,
        legacyNotificationSchedulerEnabled: runtimeConfig.productionAutomationGuard?.legacyNotificationSchedulerEnabled === true,
        requireGatewayMessageContract: runtimeConfig.productionAutomationGuard?.requireGatewayMessageContract !== false,
      },
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

// GET /whatsapp/qr

router.get("/whatsapp/qr", requireInternalToken, async (req, res) => {
  try {
    await checkWhatsappStartupTimeoutIfAvailable();
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

// Helper: build gateway idempotency key

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
  attachmentSource,
} = {}) {
  if (sourceApp && sourceFeature && recipientNumber) {
    const parts = [
      stableSlug(sourceApp),
      stableSlug(sourceFeature),
      stableSlug(entityType || "entity"),
      stableSlug(entityId || ""),
      stableSlug(recipientNumber),
    ];
    if (message || attachmentSource) {
      const msgHash = crypto
        .createHash("sha256")
        .update(`${String(message || "")}|${String(attachmentSource || "")}`)
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
    .update(`${recipientNumber || ""}|${message || ""}|${attachmentSource || ""}|${nonce}`)
    .digest("hex")
    .slice(0, 24);
  return `gw-manual:${digest}`;
}

// POST /messages/enqueue

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
      processImmediately,
      idempotencyKey: providedKey,
      metadata: extraMetadata,
      messageContract,
      attachment,
    } = req.body || {};
    const attachmentSource =
      attachment && typeof attachment === "object"
        ? String(attachment.source || attachment.path || attachment.url || attachment.filePath || "").trim()
        : "";
    const hasAttachment = Boolean(attachmentSource);

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
    if ((!message || !String(message).trim()) && !hasAttachment) {
      return res.status(400).json({ ok: false, error: "validation_error", message: "message atau attachment wajib diisi." });
    }

    // Validasi nomor WhatsApp
    const numValidation = analyzeRecipientNumber(String(recipientNumber), {
      recipientType: String(category || "manual"),
      strict: false,
    });
    if (!numValidation.allowed) {
      logService.logSystemEvent({
        eventType: "enqueue_invalid_recipient",
        severity: "warning",
        message: `Enqueue gateway: nomor penerima tidak valid: ${numValidation.reason}`,
        metadata: {
          recipientNumber: String(recipientNumber),
          reason: numValidation.reason,
          score: numValidation.score,
          issues: numValidation.issues,
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
        score: numValidation.score,
        issues: numValidation.issues,
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
        message: String(message || ""),
        attachmentSource,
      })
    );
    const normalizedContract = normalizeMessageContract(messageContract, {
      sourceApp,
      sourceFeature,
      entityType,
      entityId,
      traceId: idempotencyKey,
      messageLength: String(message || "").length,
      templateId: extraMetadata?.templateId || extraMetadata?.template_id || extraMetadata?.templateKey || extraMetadata?.template_key || "",
    });
    const contractValidation = validateMessageContract(normalizedContract, String(message || ""));
    if (!contractValidation.ok) {
      logService.logSecurityEvent({
        eventType: "message_contract_invalid",
        severity: "warning",
        message: "Kontrak pesan gateway tidak valid.",
        metadata: {
          reason: contractValidation.reason,
          sourceApp: String(sourceApp),
          sourceFeature: String(sourceFeature),
          idempotencyKey,
        },
      });
      return res.status(400).json({
        ok: false,
        error: contractValidation.reason,
        message: "Kontrak pesan tidak sesuai dengan isi pesan yang dikirim.",
      });
    }

    // Bangun metadata gabungan dengan source info sebelum cek duplikat,
    // sehingga request tanpa kontrak tidak bisa lolos sebagai duplicate.
    const mergedMetadata = {
      ...((extraMetadata && typeof extraMetadata === "object") ? extraMetadata : {}),
      source_app: String(sourceApp),
      source_feature: String(sourceFeature),
      entity_type: String(entityType || ""),
      entity_id: String(entityId || ""),
      dryRun: dryRun === true,
      gateway: true,
      hasAttachment,
      ...(normalizedContract ? {
        messageContract: normalizedContract,
        messageContractVersion: normalizedContract.version,
        messageContractSource: normalizedContract.source,
        messageContractTraceId: normalizedContract.traceId || idempotencyKey,
        messageSha256: normalizedContract.messageSha256 || hashMessageBody(String(message || "")),
        messageLength: normalizedContract.messageLength || String(message || "").length,
        renderedAt: normalizedContract.renderedAt || "",
        templateId: normalizedContract.templateId || extraMetadata?.templateId || extraMetadata?.template_id || extraMetadata?.templateKey || extraMetadata?.template_key || "",
      } : {}),
    };
    const runtimeConfig = readRuntimeConfig();
    const guardDecision = productionGuardService.shouldBlockLegacyQueueMessage({
      sourceApp: String(sourceApp),
      sourceFeature: String(sourceFeature),
      category: String(category || "employee"),
      metadata: mergedMetadata,
    }, runtimeConfig);
    if (guardDecision.blocked) {
      logService.logSecurityEvent({
        eventType: "message_contract_blocked",
        severity: "warning",
        message: "Pesan gateway diblokir karena tidak berasal dari kontrak template aktif.",
        metadata: {
          reason: guardDecision.reason,
          sourceApp: String(sourceApp),
          sourceFeature: String(sourceFeature),
          category: String(category || "employee"),
          idempotencyKey,
          hasContract: Boolean(normalizedContract),
        },
      });
      return res.status(409).json({
        ok: false,
        error: guardDecision.reason,
        message: "Pesan diblokir: sumber notifikasi tidak terverifikasi sebagai template ALETA Bot aktif.",
      });
    }

    const duplicateImmediateProcessing = shouldProcessGatewayMessageImmediately({
      category: String(category || "employee"),
      sourceFeature: String(sourceFeature),
      metadata: mergedMetadata,
      explicit: processImmediately,
    });

    // Cek duplikat sebelum enqueue
    const existing = await messageQueueService.findByIdempotencyKey(idempotencyKey);
    if (existing) {
      const processTriggered =
        duplicateImmediateProcessing && existing.status === "pending"
          ? triggerQueueProcessNow("gateway_enqueue_duplicate_immediate", 5)
          : false;
      const queueProgress = await messageQueueService.getQueueProgress(existing);
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
        processTriggered,
        queueProgress,
        message: "Pesan dengan idempotency key ini sudah ada.",
      });
    }

    const immediateProcessing = shouldProcessGatewayMessageImmediately({
      category: String(category || "employee"),
      sourceFeature: String(sourceFeature),
      metadata: mergedMetadata,
      explicit: processImmediately,
    });
    if (immediateProcessing) {
      mergedMetadata.processImmediately = true;
    }

    const normalizedPriority =
      priority === undefined || priority === null || priority === ""
        ? (immediateProcessing ? 1 : 5)
        : Number(priority);

    const item = await messageQueueService.enqueueMessage({
      recipientNumber: numValidation.chatId,
      recipientName: String(recipientName || ""),
      message: String(message || ""),
      category: String(category || "employee"),
      priority: Number.isFinite(normalizedPriority) ? normalizedPriority : (immediateProcessing ? 1 : 5),
      idempotencyKey,
      sourceApp: String(sourceApp),
      sourceFeature: String(sourceFeature),
      entityType: String(entityType || ""),
      entityId: String(entityId || ""),
      metadata: mergedMetadata,
      attachment: hasAttachment ? attachment : undefined,
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
        hasAttachment,
        messageContractVersion: mergedMetadata.messageContractVersion || "",
        messageContractSource: mergedMetadata.messageContractSource || "",
        messageContractTraceId: mergedMetadata.messageContractTraceId || "",
        templateId: mergedMetadata.templateId || "",
      },
    });

    const processTriggered = immediateProcessing
      ? triggerQueueProcessNow("gateway_enqueue_immediate", 5)
      : false;
    const queueProgress = await messageQueueService.getQueueProgress(item);

    return res.json({
      ok: true,
      queueId: item.id,
      status: item.status || "pending",
      idempotencyKey,
      processTriggered,
      queueProgress,
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

// POST /messages/test

router.get("/messages/recent", requireInternalToken, async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(500, Number(req.query.limit || 200)));
    const logs = await logService.getRecentLogs("message", limit);
    return res.json({
      ok: true,
      total: Array.isArray(logs) ? logs.length : 0,
      logs: Array.isArray(logs) ? logs : [],
    });
  } catch (error) {
    logService.logSystemEvent({
      eventType: "recent_message_logs_failed",
      severity: "error",
      message: "Endpoint log pesan terbaru gagal.",
      metadata: { errorMessage: error.message },
    });
    return res.status(500).json({
      ok: false,
      error: "recent_message_logs_failed",
      message: sanitizeWhatsappRuntimeError(error.message) || "Log pesan terbaru belum bisa dibaca.",
    });
  }
});

router.get("/messages/progress/:id", requireInternalToken, async (req, res) => {
  try {
    const queueId = String(req.params.id || "").trim();
    if (!queueId) {
      return res.status(400).json({ ok: false, error: "validation_error", message: "id antrean wajib diisi." });
    }
    const queueProgress = await messageQueueService.getQueueProgress(queueId);
    return res.json({
      ok: true,
      queueProgress,
    });
  } catch (error) {
    logService.logSystemEvent({
      eventType: "message_progress_failed",
      severity: "error",
      message: "Endpoint progres pesan gagal.",
      metadata: { errorMessage: sanitizeWhatsappRuntimeError(error.message) },
    });
    return res.status(500).json({
      ok: false,
      error: "message_progress_failed",
      message: sanitizeWhatsappRuntimeError(error.message) || "Progres pesan belum bisa dibaca.",
    });
  }
});

router.post("/messages/test", requireInternalToken, async (req, res) => {
  try {
    await checkWhatsappStartupTimeoutIfAvailable();
    const { recipientNumber, message, dryRun: requestedDryRun } = req.body || {};

    // Default dryRun = true
    const effectiveDryRun = requestedDryRun !== false;

    if (!recipientNumber) {
      return res.status(400).json({ ok: false, error: "validation_error", message: "recipientNumber wajib diisi." });
    }
    if (!message || !String(message).trim()) {
      return res.status(400).json({ ok: false, error: "validation_error", message: "message wajib diisi." });
    }

    const numValidation = analyzeRecipientNumber(String(recipientNumber), {
      recipientType: "manual_test",
      strict: false,
    });
    if (!numValidation.allowed) {
      logService.logSystemEvent({
        eventType: "test_message_invalid_recipient",
        severity: "warning",
        message: `Test message gateway: nomor tidak valid: ${numValidation.reason}`,
        metadata: {
          recipientNumber: String(recipientNumber),
          reason: numValidation.reason,
          score: numValidation.score,
          issues: numValidation.issues,
        },
      });
      return res.status(400).json({
        ok: false,
        error: "invalid_recipient_number",
        message: `Nomor penerima tidak valid: ${numValidation.reason}`,
        reason: numValidation.reason,
        score: numValidation.score,
        issues: numValidation.issues,
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
    const waState = whatsappStatusService.getStatus();
    if (waState.status !== "connected") {
      return res.status(409).json({
        ok: false,
        error: "whatsapp_not_connected",
        status: waState.status || "unknown",
        message: `WhatsApp belum tersambung. Status runtime saat ini: ${waState.status || "unknown"}.`,
      });
    }
    const workerState = queueWorkerService.getWorkerStatus();
    if (!workerState.enabled || !workerState.activeTimer || workerState.paused) {
      return res.status(409).json({
        ok: false,
        error: "worker_not_ready",
        worker: workerState,
        message: workerState.paused
          ? "Mesin Bot sedang dijeda. Lanjutkan Mesin Bot sebelum uji kirim."
          : "Mesin Bot belum aktif. Pastikan layanan aleta_bot berjalan dan worker menyala.",
      });
    }

    const idempotencyKey = `gw-test:${numValidation.normalized}:${Date.now()}`;
    const item = await messageQueueService.enqueueMessage({
      recipientNumber: numValidation.chatId,
      recipientName: "Test Gateway",
      message: String(message),
      category: "manual",
      priority: 1,
      idempotencyKey,
      sourceApp: "aleta_bot_gateway",
      sourceFeature: "test_message",
      metadata: {
        source_app: "aleta_bot_gateway",
        source_feature: "test_message",
        dryRun: false,
        gateway: true,
        testMessage: true,
        processImmediately: true,
      },
    });
    const processTriggered = triggerQueueProcessNow("gateway_test_message", 5);
    const queueProgress = await messageQueueService.getQueueProgress(item);

    return res.json({
      ok: true,
      dryRun: false,
      queueId: item.id,
      status: item.status,
      processTriggered,
      queueProgress,
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

router.post("/query/health-check", requireInternalToken, async (req, res) => {
  try {
    const query = req.body?.query || {};
    const health = await dynamicNotificationSchedulerService.healthCheckSourceQuery(query, {
      maxRows: req.body?.maxRows || 20,
      sampleLimit: req.body?.sampleLimit || 5,
      slowMs: req.body?.slowMs || 3000,
    });

    logService.logSystemEvent({
      eventType: "source_query_health_check",
      severity: health.ok ? (health.slow ? "warning" : "info") : "warning",
      message: health.ok ? "Health check sumber data ALETA Bot selesai." : "Health check sumber data ALETA Bot gagal.",
      metadata: {
        queryId: query.id || query.key || "",
        queryName: query.name || "",
        status: health.status,
        durationMs: health.durationMs,
        rowCount: health.rowCount,
        slow: health.slow,
        errorMessage: health.error ? sanitizeWhatsappRuntimeError(health.error) : null,
      },
    });

    return res.json({
      ok: true,
      status: true,
      health: {
        ...health,
        error: health.error ? sanitizeWhatsappRuntimeError(health.error) : null,
      },
    });
  } catch (error) {
    logService.logSystemEvent({
      eventType: "source_query_health_check_failed",
      severity: "error",
      message: "Endpoint health check sumber data gagal.",
      metadata: { errorMessage: sanitizeWhatsappRuntimeError(error.message) },
    });
    return res.status(500).json({
      ok: false,
      error: "source_query_health_check_failed",
      message: sanitizeWhatsappRuntimeError(error.message) || "Health check sumber data gagal.",
    });
  }
});

// POST /manual-send/preview
// Preview Kirim Manual: jalankan sumber data read-only dengan parameter binding,
// render template dengan data nyata, dan kembalikan kandidat penerima.
// Endpoint ini tidak pernah mengirim pesan.
router.post("/manual-send/preview", requireInternalToken, async (req, res) => {
  try {
    // employeeRecipients & notificationName WAJIB ikut diteruskan: sumber data
    // pegawai difilter per nama, dan tanpa keduanya query berjalan tanpa nama
    // sehingga selalu mengembalikan 0 baris.
    const { query, template, params, manualValues, selectedRowIndex, maxRows, employeeRecipients, notificationName, referenceDate } =
      req.body || {};
    if (!query && !template) {
      return res.status(400).json({
        ok: false,
        error: "validation_error",
        message: "Minimal salah satu dari query atau template wajib diisi.",
      });
    }

    const preview = await manualSendService.previewManualSend({
      query,
      template,
      params: params && typeof params === "object" ? params : {},
      manualValues: manualValues && typeof manualValues === "object" ? manualValues : {},
      selectedRowIndex: Number(selectedRowIndex || 0),
      maxRows: Number(maxRows || 20),
      employeeRecipients: Array.isArray(employeeRecipients) ? employeeRecipients : [],
      notificationName: String(notificationName || ""),
      referenceDate: String(referenceDate || ""),
    });

    logService.logSystemEvent({
      eventType: "manual_send_preview",
      severity: "info",
      message: "Preview Kirim Manual ALETA Bot diproses.",
      metadata: {
        queryId: query?.id || "",
        templateId: template?.id || "",
        paramKeys: params && typeof params === "object" ? Object.keys(params) : [],
        rowCount: preview.query?.rowCount ?? null,
        missingParams: preview.query?.missingParams || [],
        missingPlaceholders: preview.template?.missingPlaceholders || [],
        complete: preview.ok,
      },
    });

    return res.json({ ok: true, preview });
  } catch (error) {
    logService.logSystemEvent({
      eventType: "manual_send_preview_failed",
      severity: "warning",
      message: "Preview Kirim Manual ALETA Bot gagal.",
      metadata: { errorMessage: sanitizeWhatsappRuntimeError(error.message) },
    });
    return res.status(500).json({
      ok: false,
      error: "manual_send_preview_failed",
      message: sanitizeWhatsappRuntimeError(error.message) || "Preview Kirim Manual gagal.",
    });
  }
});

// POST /worker/control

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

// GET /queue/dead-letters

/**
 * Pemantauan antrian sidang online untuk halaman ALETA Bot.
 *
 * Hanya membaca: daftar antrian hari ini beserta status koneksi ke basis data
 * antrian, plus riwayat pendaftaran yang dicatat handler pesan. Petugas perlu
 * ini untuk tahu antriannya jalan atau tidak - kalau basis data antrian putus,
 * perintah "daftar antrian" dari pihak gagal tanpa ada yang menyadari.
 */
router.get("/antrian-online/monitor", requireInternalToken, async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(500, Number(req.query?.limit || 100)));
    const logLimit = Math.max(1, Math.min(200, Number(req.query?.logLimit || 50)));

    const monitor = await antrianOnlineService.getQueueMonitor({ limit });

    const semuaLog = await logService.getRecentLogs("system", 500);
    const logs = (Array.isArray(semuaLog) ? semuaLog : [])
      .filter((row) => String(row?.event_type || "") === "online_queue_registration")
      .slice(0, logLimit)
      .map((row) => {
        let metadata = {};
        try {
          metadata = row.metadata ? JSON.parse(row.metadata) : {};
        } catch {
          metadata = {};
        }
        return {
          id: row.id,
          createdAt: row.created_at,
          severity: row.severity,
          message: row.message,
          status: String(metadata.status || ""),
          nomorPerkara: String(metadata.nomorPerkara || metadata.nomor_perkara || ""),
          partySlot: String(metadata.partySlot || metadata.party_slot || ""),
          nomorAntrian: metadata.nomorAntrian ?? metadata.nomor_antrian ?? null,
          resolvedBy: String(metadata.resolvedBy || metadata.resolved_by || ""),
        };
      });

    return res.json({
      ok: true,
      monitor,
      logs,
      totalLogs: logs.length,
    });
  } catch (error) {
    logService.logSystemEvent({
      eventType: "online_queue_monitor_failed",
      severity: "error",
      message: "Endpoint pemantauan antrian online gagal.",
      metadata: { errorMessage: error.message },
    });
    return res.status(500).json({
      ok: false,
      error: "online_queue_monitor_failed",
      message: sanitizeWhatsappRuntimeError(error.message) || "Pemantauan antrian online belum bisa dibaca.",
    });
  }
});

router.get("/queue/dead-letters", requireInternalToken, async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(200, Number(req.query?.limit || 50)));
    const requestedStatus = String(req.query?.status || "active").toLowerCase();
    const status = ["active", "resolved", "all"].includes(requestedStatus) ? requestedStatus : "active";
    const items = await messageQueueService.getDeadLetters(limit, { status });
    return res.json({
      ok: true,
      status,
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

// POST /queue/dead-letters/resolve

router.post("/queue/dead-letters/resolve", requireInternalToken, async (req, res) => {
  try {
    const id = String(req.body?.id || "").trim();
    if (!id) {
      return res.status(400).json({ ok: false, error: "validation_error", message: "id wajib diisi." });
    }

    const item = await messageQueueService.resolveDeadLetter(id, {
      resolvedBy: req.body?.resolvedBy,
      note: req.body?.note,
    });
    if (!item) {
      return res.status(404).json({
        ok: false,
        error: "not_found",
        message: "Dead letter aktif tidak ditemukan atau sudah ditangani.",
      });
    }

    logService.logSystemEvent({
      eventType: "dead_letter_resolved_via_gateway",
      severity: "info",
      message: "Dead letter ditandai ditangani melalui gateway internal.",
      metadata: { originalId: id, ip: req.ip },
    });

    return res.json({ ok: true, originalId: id, status: "resolved", item });
  } catch (error) {
    logService.logSystemEvent({
      eventType: "dead_letter_resolve_failed",
      severity: "error",
      message: "Endpoint resolve dead letter gagal.",
      metadata: { errorMessage: error.message },
    });
    return res.status(500).json({ ok: false, error: "resolve_failed", message: "Resolve dead letter failed." });
  }
});

router.post("/queue/dead-letters/:id/resolve", requireInternalToken, async (req, res) => {
  try {
    const id = String(req.params?.id || "").trim();
    if (!id) {
      return res.status(400).json({ ok: false, error: "validation_error", message: "id wajib diisi." });
    }

    const item = await messageQueueService.resolveDeadLetter(id, {
      resolvedBy: req.body?.resolvedBy,
      note: req.body?.note,
    });
    if (!item) {
      return res.status(404).json({
        ok: false,
        error: "not_found",
        message: "Dead letter aktif tidak ditemukan atau sudah ditangani.",
      });
    }

    logService.logSystemEvent({
      eventType: "dead_letter_resolved_via_gateway",
      severity: "info",
      message: "Dead letter ditandai ditangani melalui endpoint path-param.",
      metadata: { originalId: id, ip: req.ip },
    });

    return res.json({ ok: true, originalId: id, status: "resolved", item });
  } catch (error) {
    logService.logSystemEvent({
      eventType: "dead_letter_resolve_failed",
      severity: "error",
      message: "Endpoint resolve dead letter path-param gagal.",
      metadata: { errorMessage: error.message },
    });
    return res.status(500).json({ ok: false, error: "resolve_failed", message: "Resolve dead letter failed." });
  }
});

// POST /queue/dead-letters/resend

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

// Phase 5: Legacy Migration Adapters

const legacyNotificationAdapter = require("../services/legacy/legacyNotificationAdapter");
const legacyCommandAdapter = require("../services/legacy/legacyCommandAdapter");
const legacyQueryCatalog = require("../services/legacy/legacyQueryCatalog");

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

/**
 * GET /legacy/query-catalog
 * Lists exported notifikasi.js functions as selectable dynamic data sources.
 */
router.get("/legacy/query-catalog", requireInternalToken, (req, res) => {
  try {
    const queries = legacyQueryCatalog.getLegacyNotifikasiQueryCatalog();
    return res.json({
      ok: true,
      total: queries.length,
      queries,
    });
  } catch (error) {
    logService.logSystemEvent({
      eventType: "legacy_query_catalog_failed",
      severity: "error",
      message: "Endpoint katalog query legacy gagal.",
      metadata: { errorMessage: error.message },
    });
    return res.status(500).json({ ok: false, error: "query_catalog_failed", message: error.message });
  }
});

router.setRuntimeLifecycleHandlers = setRuntimeLifecycleHandlers;

module.exports = router;
