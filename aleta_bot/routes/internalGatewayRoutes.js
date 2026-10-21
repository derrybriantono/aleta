"use strict";

const express = require("express");
const crypto = require("crypto");
const router = express.Router();
// Keputusan 104 (18 Okt 2026): tulisan manual di luar jam kerja ditanyakan dulu - lihat antreanTulisSippService.
const { manualJamKerja } = require("../services/antreanTulisSippService");

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
const ecourtLoginService = require("../services/ecourtLoginService");
const sippKonteksService = require("../services/sippKonteksService");
const obyekSengketaService = require("../services/obyekSengketaService");
const praperiksaPutusanService = require("../services/praperiksaPutusanService");
const penjagaTenggatService = require("../services/penjagaTenggatService");
const checklistMilestoneService = require("../services/checklistMilestoneService");
const penyusunPertimbanganService = require("../services/penyusunPertimbanganService");
const arsipBertindakService = require("../services/arsipBertindakService");
const ecourtPermintaanService = require("../services/ecourtPermintaanService");
const abtUsulanService = require("../services/abtUsulanService");
const abtCetakService = require("../services/abtCetakService");
const sippPositaService = require("../services/sippPositaService");
const ecourtSchedulerService = require("../services/ecourtSchedulerService");
const ecourtSasaranService = require("../services/ecourtSasaranService");
const sippJadwalSidangService = require("../services/sippJadwalSidangService");
const kesiapanSidangService = require("../services/kesiapanSidangService");
const sippStatusPerkaraService = require("../services/sippStatusPerkaraService");
const sippTautanService = require("../services/sippTautanService");
const tagPerkaraService = require("../services/tagPerkaraService");
const putusanUnggahService = require("../services/putusanUnggahService");
const hakUnggahPutusanService = require("../services/hakUnggahPutusanService");
const kendaliBerkasService = require("../services/kendaliBerkasService");
const putusanEcourtService = require("../services/putusanEcourtService");
const sippSkemaService = require("../services/sippSkemaService");
const ecourtSesiStatusService = require("../services/ecourtSesiStatusService");
const ecourtKredensialService = require("../services/ecourtKredensialService");
const penilaianPerkaraService = require("../services/penilaianPerkaraService");
const ecourtPanggilanService = require("../services/ecourtPanggilanService");
const ecourtSesiPantauService = require("../services/ecourtSesiPantauService");
const ecourtAkunService = require("../services/ecourtAkunService");
const ecourtAuditArsipService = require("../services/ecourtAuditArsipService");
const sippDocumentService = require("../services/sippDocumentService");
const ecourtArsipService = require("../services/ecourtArsipService");
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
const penunjukanService = require("../services/penunjukanService");
const jejakAletaService = require("../services/jejakAletaService");
const jedaManusiaService = require("../services/jedaManusiaService");
const sidangHasilAlur = require("../services/sidangHasilAlur");
const selisihHarianService = require("../services/selisihHarianService");
const tandaTanganService = require("../services/tandaTanganService");
const dokumenPenetapanService = require("../services/dokumenPenetapanService");
const salinanPutusanService = require("../services/salinanPutusanService");
const penetapanTulisService = require("../services/penetapanTulisService");
// 20 Okt 2026: satu sumber keadaan penetapan + satu kunci per perkara untuk SEMUA jalan tulis.
const penetapanKeadaanService = require("../services/penetapanKeadaanService");
const penetapanKunciService = require("../services/penetapanKunciService");
const sidangHasilService = require("../services/sidangHasilService");
const putusanTulisService = require("../services/putusanTulisService");
const antrianSidangService = require("../services/antrianSidangService");
const antrianWaktuService = require("../services/antrianWaktuService");
const antrianSinkronService = require("../services/antrianSinkronService");
const analisaLanjutService = require("../services/analisaLanjutService");
const penilaianKonseptorService = require("../services/penilaianKonseptorService");
const petaPerkaraService = require("../services/petaPerkaraService");
const identitasPihakService = require("../services/identitasPihakService");
const riwayatPihakService = require("../services/riwayatPihakService");
const lapisanPetaService = require("../services/lapisanPetaService");
const relaasMassalService = require("../services/relaasMassalService");
const promptPutusanService = require("../services/promptPutusanService");
// Penilaian dan pengawasan - lihat rute /penilaian/* dan /laporan-perkara/*.
const kerangkaPenilaianService = require("../services/kerangkaPenilaianService");
const katalogEAuditService = require("../services/katalogEAuditService");
const kemampuanMesinService = require("../services/kemampuanMesinService");
const kosakataService = require("../services/kosakataService");
const penilaianKetepatanInputService = require("../services/penilaianKetepatanInputService");
const penilaianSebaranService = require("../services/penilaianSebaranService");
const penilaianRegisterService = require("../services/penilaianRegisterService");
const penilaianLaporanService = require("../services/penilaianLaporanService");
const penilaianDipa04Service = require("../services/penilaianDipa04Service");
const penilaianIntegritasWaktuService = require("../services/penilaianIntegritasWaktuService");
const penilaianBebanKerjaService = require("../services/penilaianBebanKerjaService");
const penilaianMutuPutusanService = require("../services/penilaianMutuPutusanService");
const penilaianPelayananService = require("../services/penilaianPelayananService");
const penilaianStatistikService = require("../services/penilaianStatistikService");
const penilaianKeuanganPerkaraService = require("../services/penilaianKeuanganPerkaraService");
const penilaianMetodeAnalisisService = require("../services/penilaianMetodeAnalisisService");
const penilaianJejakKetaatanService = require("../services/penilaianJejakKetaatanService");
const penilaianRaporLanjutService = require("../services/penilaianRaporLanjutService");
const penilaianLaporanLanjutService = require("../services/penilaianLaporanLanjutService");
const berkasPengawasanService = require("../services/berkasPengawasanService");
const alatPenilaianService = require("../services/alatPenilaianService");
const penilaianTahapanService = require("../services/penilaianTahapanService");
const penilaianIntegritasService = require("../services/penilaianIntegritasService");
const penilaianSisaPanjarService = require("../services/penilaianSisaPanjarService");
const kerangkaSebaranService = require("../services/kerangkaSebaranService");
const sebaranPerkaraService = require("../services/sebaranPerkaraService");
const kerangkaRaporService = require("../services/kerangkaRaporService");
const raporAparaturService = require("../services/raporAparaturService");
const raporBerjenjangService = require("../services/raporBerjenjangService");
const gerbangRaporAparaturService = require("../services/gerbangRaporAparaturService");
const periodePenilaianService = require("../services/periodePenilaianService");
const penyandinganService = require("../services/penyandinganService");
const laporanPerkaraService = require("../services/laporanPerkaraService");
const penilaianKetaatanService = require("../services/penilaianKetaatanService");
const penilaianMutuDataService = require("../services/penilaianMutuDataService");
const penilaianKeuanganService = require("../services/penilaianKeuanganService");
const kehadiranAntrianService = require("../services/kehadiranAntrianService");
const panggilanAntrianService = require("../services/panggilanAntrianService");
const kelengkapanDataService = require("../services/kelengkapanDataService");

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

/**
 * Penanda verifikasi majelis untuk perkara e-Litigasi pada satu tanggal
 * (butir 30, 5 Okt 2026). Hanya MEMBACA simpanan ALETA - tidak menarik
 * e-Court; penarikannya oleh ecourtVerifikasiHarianService di latar.
 */
router.get("/ecourt/verifikasi-hari-ini", requireInternalToken, async (req, res) => {
  try {
    const hasil = await require("../services/ecourtVerifikasiHarianService").keadaanHari(String(req.query.tanggal || ""));
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

/**
 * Libur tambahan dari Pengaturan portal (18 Okt 2026). Portal satu-satunya
 * sumbernya; bot menyimpan salinan di folder datanya supaya tetap berlaku
 * sesudah dimulai ulang. Hanya hari libur - tidak menulis ke SIPP.
 */
router.post("/hari-libur/tambahan", requireInternalToken, (req, res) => {
  try {
    const jumlah = require("../services/hariLiburService").pasangTambahan(req.body && req.body.tambahan);
    res.json({ ok: true, jumlah });
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

/**
 * Usulan penunjukan PMH, PPP, PJS, dan PHS untuk satu perkara.
 *
 * ==========================================================================
 * ATURANNYA DATANG BERSAMA PERMINTAAN, TIDAK DISIMPAN DI SINI
 * ==========================================================================
 *
 * Hari sidang tiap majelis, kode panitera penggantinya, jeda minimal, dan
 * ambang nilai sengketa dikirim portal bersama nomor perkaranya. Portal yang
 * menyimpannya, portal pula yang menyediakan menu penyuntingnya - bot hanya
 * tahu SIPP.
 *
 * Karena aturannya datang dari luar, tiap nilai diperiksa ulang di sini
 * sebelum dipakai. Yang tidak masuk akal diabaikan, bukan dipercaya: gerbang
 * ini memang bertoken internal, tetapi angka yang salah bentuk tetap akan
 * melahirkan tanggal sidang yang salah - dan tanggal sidang yang salah
 * menyeret panggilan para pihak.
 *
 * Yang dijawab USULAN. Tidak ada satu pun tulisan ke SIPP dari jalur ini.
 */
router.post("/penunjukan/usulan", requireInternalToken, async (req, res) => {
  try {
    const nomorPerkara = String(req.body?.nomorPerkara || "");
    if (!nomorPerkara) {
      res.status(400).json({ ok: false, error: "Nomor perkara wajib diisi." });
      return;
    }

    const kirim = req.body?.pengaturan || {};
    const aturanMasuk = kirim.aturan || {};

    // Hari sidang: hanya bilangan bulat 0..6 yang diterima. Nilai lain
    // dibuang, sehingga majelisnya terbaca "belum diatur" - jauh lebih baik
    // daripada menetapkan sidang pada hari yang tidak ada.
    const hariSidang = {};
    for (const [kode, hari] of Object.entries(kirim.hariSidang || {})) {
      const angka = Number(hari);
      if (Number.isInteger(angka) && angka >= 0 && angka <= 6) {
        hariSidang[String(kode).toUpperCase()] = angka;
      }
    }

    const paniteraMajelis = {};
    for (const [kode, daftar] of Object.entries(kirim.paniteraMajelis || {})) {
      if (!Array.isArray(daftar)) continue;
      paniteraMajelis[String(kode).toUpperCase()] = daftar
        .map((x) => String(x || "").trim().toUpperCase())
        .filter((x) => x.length > 0);
    }

    // ========================================================================
    // SUSUNAN MENURUT SK - DISARING SEBELUM DIPAKAI
    // ========================================================================
    //
    // Kode hakim dipakai MENUNJUK ORANG, jadi bentuknya dibatasi huruf dan
    // angka. Panitera berpasangan kode-id: kodenya label yang dibaca petugas,
    // id-nya yang menunjuk orangnya - lihat migrasi 0044.
    const susunanSk = [];
    for (const satu of Array.isArray(kirim.susunanSk) ? kirim.susunanSk : []) {
      const kode = String((satu && satu.majelisKode) || "").trim().toUpperCase();
      const hakim = (Array.isArray(satu && satu.hakimKode) ? satu.hakimKode : [])
        .map((x) => String(x || "").trim().toUpperCase())
        .filter((x) => /^[A-Z0-9]{1,8}$/.test(x));
      if (!kode || hakim.length < 2) continue;

      const panitera = (Array.isArray(satu && satu.panitera) ? satu.panitera : [])
        .map((p) => ({
          kode: String((p && p.kode) || "").trim().toUpperCase(),
          id: Number((p && p.id) || 0),
        }))
        .filter((p) => p.kode && Number.isInteger(p.id) && p.id > 0);

      susunanSk.push({
        majelisKode: kode,
        hakimKode: hakim,
        panitera,
        // SK per majelis (pengecualian) - hanya untuk ditampilkan di papan.
        skNomor: String((satu && satu.skNomor) || "").replace(/\s+/g, " ").trim().slice(0, 120),
        skTanggal: /^\d{4}-\d{2}-\d{2}$/.test(String((satu && satu.skTanggal) || "")) ? String(satu.skTanggal) : "",
      });
    }

    // Nama petugas bernakun nonaktif (mutasi) - hanya teks pendek, maksimal 60 nama.
    const petugasNonaktif = (Array.isArray(kirim.petugasNonaktif) ? kirim.petugasNonaktif : [])
      .slice(0, 60)
      .map((x) => String(x || "").replace(/\s+/g, " ").trim().slice(0, 80))
      .filter(Boolean);

    // Majelis yang dipilih petugas di papan - id hakim_pn, ketua di depan.
    // Dibatasi lima: majelis tidak pernah lebih dari itu, dan daftar panjang
    // dari peramban bukan pilihan melainkan kekeliruan.
    const pilihanMajelis = (Array.isArray(kirim.pilihanMajelis) ? kirim.pilihanMajelis : [])
      .map((x) => Number(x))
      .filter((x) => Number.isInteger(x) && x > 0)
      .slice(0, 5);

    // Andaian antrean massal - perkara yang sudah diperiksa sebelumnya di
    // papan dan dianggap tertulis. Disaring di sini DAN di layanannya:
    // bilangan bulat positif, tanggal ISO, paling banyak 25.
    const bulat = (x) => (Number.isInteger(Number(x)) && Number(x) > 0 ? Number(x) : 0);
    const andaian = (Array.isArray(kirim.andaian) ? kirim.andaian : []).slice(0, 25).map((a) => ({
      perkaraId: bulat(a && a.perkaraId),
      hakimId: (Array.isArray(a && a.hakimId) ? a.hakimId : []).map(bulat).filter((x) => x > 0).slice(0, 5),
      paniteraId: bulat(a && a.paniteraId),
      jurusitaId: bulat(a && a.jurusitaId),
      tanggalSidang: /^\d{4}-\d{2}-\d{2}$/.test(String((a && a.tanggalSidang) || "")) ? String(a.tanggalSidang) : "",
    }));

    const jeda = Number(aturanMasuk.jedaMinimalHari);
    const ambang = Number(aturanMasuk.ambangNilaiSengketa);

    const hasil = await penunjukanService.usulanPenunjukan(nomorPerkara, {
      aturan: {
        jedaMinimalHari: Number.isFinite(jeda) && jeda >= 0 ? Math.floor(jeda) : 10,
        ambangNilaiSengketa:
          Number.isFinite(ambang) && ambang >= 0 ? Math.floor(ambang) : 500000000,
        klasifikasiHakimTunggal: Array.isArray(aturanMasuk.klasifikasiHakimTunggal)
          ? aturanMasuk.klasifikasiHakimTunggal.map((x) => String(x || ""))
          : [],
        kolamHakimTunggal:
          aturanMasuk.kolamHakimTunggal === "ketua-wakil" ? "ketua-wakil" : "hakim",
      },
      hariSidang,
      paniteraMajelis,
      // SK yang berlaku (nomor + tanggal) - untuk papan dan pemeriksaan kesesuaian.
      sk: {
        nomor: String((kirim.sk && kirim.sk.nomor) || "").replace(/\s+/g, " ").trim().slice(0, 120),
        tanggal: /^\d{4}-\d{2}-\d{2}$/.test(String((kirim.sk && kirim.sk.tanggal) || "")) ? String(kirim.sk.tanggal) : "",
        berlaku: /^\d{4}-\d{2}-\d{2}$/.test(String((kirim.sk && kirim.sk.berlaku) || "")) ? String(kirim.sk.berlaku) : "",
        // Pegawai di SK yang perlu diperbarui menurut portal (akun nonaktif/jabatan berganti).
        peringatan: (Array.isArray(kirim.sk && kirim.sk.peringatan) ? kirim.sk.peringatan : []).slice(0, 30).map((x) => ({
          majelisKode: String((x && x.majelisKode) || "").toUpperCase().slice(0, 8),
          kode: String((x && x.kode) || "").toUpperCase().slice(0, 8),
          nama: String((x && x.nama) || "").slice(0, 80),
          alasan: String((x && x.alasan) || "").slice(0, 160),
        })),
      },
      susunanSk,
      andaian,
      petugasNonaktif,
      pilihanMajelis,
    });

    res.status(hasil.ok ? 200 : 404).json(hasil);
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/**
 * Memeriksa apakah penetapan yang diisikan benar-benar tercatat di SIPP.
 *
 * Dipanggil sesudah tombol Simpan ditekan. Yang dijawab bukan "berhasil"
 * melainkan apa yang TERBACA di perkara_penetapan sekarang, dibandingkan
 * dengan yang diharapkan - sehingga yang mendarat sebagian tetap terlihat
 * sebagian, bukan dibulatkan jadi berhasil atau gagal.
 */
router.post("/penunjukan/periksa", requireInternalToken, async (req, res) => {
  try {
    const nomorPerkara = String(req.body?.nomorPerkara || "");
    if (!nomorPerkara) {
      res.status(400).json({ ok: false, error: "Nomor perkara wajib diisi." });
      return;
    }

    // Hanya keempat kunci yang dikenal yang diterima, dan nilainya dipangkas.
    // Harapan datang dari pemanggil, dan yang tidak dikenali tidak perlu
    // diteruskan hanya untuk dipantulkan kembali ke catatan.
    const harapan = {};
    for (const jenis of ["pmh", "ppp", "pjs", "phs"]) {
      const nilai = req.body?.harapan?.[jenis];
      if (nilai) harapan[jenis] = String(nilai).slice(0, 40);
    }

    const hasil = await penunjukanService.periksaPengisian(nomorPerkara, harapan);
    res.status(hasil.ok ? 200 : 404).json(hasil);
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/**
 * ============================================================================
 * MENULIS PENETAPAN KE SIPP - SATU-SATUNYA RUTE YANG MENULIS KE SANA
 * ============================================================================
 *
 * KERING sebagai bawaan. Menulis menuntut { kering: false } yang tegas, dan
 * itu disengaja: rute yang menulis secara diam-diam pada permintaan yang lupa
 * menyebut apa-apa adalah rute yang akan menulis pada permintaan yang salah.
 *
 * Yang datang dari peramban hanya PILIHAN - nomor perkara, id orangnya,
 * tanggalnya, dan nama akun pejabatnya. Nama, NIP, kode, dan sifat ruangan
 * seluruhnya dibaca ulang dari SIPP di dalam layanan. Peramban tidak pernah
 * dapat menuliskan NIP siapa pun ke berkas perkara.
 *
 * `operator` diambil dari SESI ALETA yang memanggil, bukan dari badan
 * permintaan. Kalau ia boleh dikirim peramban, catatan tentang siapa yang
 * sebenarnya menekan tombolnya dapat diisi apa saja - dan justru catatan itu
 * satu-satunya yang membedakan jalur ini dari memalsukan tanda tangan.
 */
/**
 * Daftar ruangan sidang yang dapat DIPILIH - beserta bendera sidang keliling
 * milik SIPP sendiri. Yang memutuskan sifatnya (dalam gedung, keliling, atau
 * terpadu) adalah portal; di sini benderanya dikirim apa adanya.
 */
/**
 * Alamat yang dicatat pada baris audit SIPP.
 *
 * Yang dikirim portal adalah alamat PERAMBAN petugas - itulah yang dicatat
 * SIPP untuk pekerjaan yang sama. req.ip di sini hanya alamat peti portal,
 * yang di sys_audittrail satker tidak pernah muncul sekali pun selain dari
 * ALETA sendiri.
 *
 * Disaring ke IPv4 sebab kolomnya varchar(15): alamat yang lebih panjang akan
 * terpotong menjadi alamat lain yang keliru.
 */
function alamatAudit(req) {
  const dariPortal = String((req.body && req.body.ip) || "").trim();
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(dariPortal) && dariPortal.length <= 15) return dariPortal;
  // Butir 45 (17 Okt 2026): TANPA jalan mundur ke alamat soket. Itu alamat peti portal
  // (172.18.0.2) - 19 baris sys_audittrail 29 Sep-16 Okt memuatnya, alamat yang
  // tidak pernah dipakai petugas mana pun, jadi penanda ALETA di audit SIPP.
  // Kosong lebih jujur daripada alamat mesin ALETA (sama dengan putusanTulisService).
  return "";
}

/** Hakim dan panitera aktif - dipakai layar pengaturan SK susunan majelis. */
router.get("/penunjukan/pegawai", requireInternalToken, async (req, res) => {
  try {
    res.json(await penunjukanService.pegawaiPenunjukan());
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

router.get("/penetapan/ruangan", requireInternalToken, async (req, res) => {
  try {
    const ruangan = await penetapanTulisService.daftarRuangan();
    res.json({ ok: true, ruangan });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/**
 * ============================================================================
 * KEADAAN PENETAPAN + KUNCI PER PERKARA (20 Okt 2026, satu sumber untuk semua)
 * ============================================================================
 *
 * Dibaca kartu Penetapan, tombol di halaman SIPP, penanda baris daftar, dan
 * borang SIPP yang disimpan peramban - lihat penetapanKeadaanService. Kunci:
 * penetapanKunciService (masa berlaku, gagal tertutup).
 */
router.post("/penetapan/keadaan", requireInternalToken, async (req, res) => {
  try {
    const badan = req.body || {};
    const acuan = Number(badan.perkaraId) > 0 ? Number(badan.perkaraId) : String(badan.nomorPerkara || "").trim();
    if (!acuan) {
      res.status(400).json({ ok: false, alasan: "perkara_tidak_disebut" });
      return;
    }
    const keadaan = await penetapanKeadaanService.keadaanSatu(acuan);
    if (!keadaan.ok) {
      res.status(keadaan.alasan === "perkara_tidak_ketemu" ? 404 : 503).json(keadaan);
      return;
    }
    keadaan.kunci = await penetapanKunciService.layanan().lihat(keadaan.perkaraId);
    res.json(keadaan);
  } catch (error) {
    res.status(500).json({ ok: false, alasan: "keadaan_tidak_terbaca", pesan: String(error.message || error).slice(0, 300) });
  }
});

router.post("/penetapan/kunci", requireInternalToken, async (req, res) => {
  try {
    const badan = req.body || {};
    const operator = String(badan.operator || "").trim();
    if (!operator) {
      res.status(400).json({ ok: false, alasan: "operator_tidak_disebut" });
      return;
    }
    const hasil = await penetapanKunciService.layanan().ambil({
      perkaraId: badan.perkaraId,
      pemilik: operator,
      tujuan: String(badan.tujuan || "kerjakan"),
      ttlDetik: badan.ttlDetik,
      tokenLama: String(badan.token || ""),
    });
    res.status(hasil.ok ? 200 : 409).json(hasil);
  } catch (error) {
    res.status(500).json({ ok: false, alasan: "kunci_tidak_tersedia", pesan: String(error.message || error).slice(0, 300) });
  }
});

router.post("/penetapan/kunci/lepas", requireInternalToken, async (req, res) => {
  try {
    const badan = req.body || {};
    const hasil = await penetapanKunciService.layanan().lepas({ perkaraId: badan.perkaraId, token: String(badan.token || "") });
    res.status(hasil.ok ? 200 : 400).json(hasil);
  } catch (error) {
    res.status(500).json({ ok: false, alasan: "kunci_tidak_tersedia", pesan: String(error.message || error).slice(0, 300) });
  }
});

/**
 * Menjalankan `kerja` selagi memegang kunci perkara. Kunci yang tidak didapat
 * dijawab 409 `sedang_dikerjakan` (atau 503 `kunci_tidak_tersedia`) dan `kerja`
 * TIDAK dijalankan - pekerjaan kedua atas perkara yang sama tidak menulis apa pun.
 * Token dari pemanggil yang masih berlaku dipakai ulang (pekerjaan yang sama
 * yang melangkah dari keadaan ke tulis), bukan ditolak oleh dirinya sendiri.
 */
async function denganKunciPerkara(res, { perkaraId, operator, tujuan, token }, kerja) {
  const dikerjakan = await penetapanKunciService.layanan().dengan(
    { perkaraId, pemilik: operator, tujuan, tokenLama: String(token || "") },
    kerja
  );
  if (!dikerjakan.dikunci) {
    const k = dikerjakan.kunci || {};
    const sibuk = k.alasan === "sedang_dikerjakan";
    res.status(sibuk ? 409 : 503).json({
      ok: false,
      alasan: k.alasan || "kunci_tidak_tersedia",
      oleh: k.oleh || "",
      tujuan: k.tujuan || "",
      sampai: k.sampai || "",
      pesan: k.pesan || "",
      hasil: [],
      dipulihkan: true,
    });
    return undefined;
  }
  return dikerjakan.hasil;
}

/**
 * Sisa penetapan SATU perkara, utuh atau batal (uji rilis U1, 9 Okt 2026) -
 * lihat penetapanTulisService.tulisRantaiUtuh. Hanya penulisan sungguhan;
 * uji kering tetap lewat /penetapan/tulis per langkah. Selalu 200 dengan ok di
 * badan (kecuali galat tak terduga), supaya rinciannya sampai ke panel utuh.
 */
router.post(
  "/penetapan/tulis-rantai",
  requireInternalToken,
  manualJamKerja("penetapan-rantai", (b) => String(b.perkaraId || ""), async (req, res) => {
  try {
    const badan = req.body || {};
    const operator = String(badan.operator || "").trim();
    if (!operator) {
      res.status(400).json({ ok: false, alasan: "operator_tidak_disebut" });
      return;
    }
    if (badan.kering !== false) {
      res.status(400).json({ ok: false, alasan: "rantai_hanya_untuk_menulis" });
      return;
    }
    const langkah = (Array.isArray(badan.langkah) ? badan.langkah : []).map((x) => ({
      jenis: String((x && x.jenis) || ""),
      hakimId: Array.isArray(x && x.hakimId) ? x.hakimId : [],
      petugasId: x && x.petugasId,
      tanggalSidang: String((x && x.tanggalSidang) || ""),
      ruanganId: x && x.ruanganId,
      jamSidang: String((x && x.jamSidang) || ""),
      pejabatUsername: String((x && x.pejabatUsername) || "").trim().slice(0, 150),
    }));
    const ip = alamatAudit(req);
    // Satu perkara, satu pekerjaan: kartu Penetapan, tombol halaman SIPP, antrean
    // jam kerja, dan penanda halaman melewati pagar yang SAMA. Yang kedua
    // berpapasan tidak menulis apa pun (409 sedang_dikerjakan).
    const hasil = await denganKunciPerkara(
      res,
      { perkaraId: badan.perkaraId, operator, tujuan: "penetapan-rantai", token: badan.kunciToken },
      () =>
        penetapanTulisService.tulisRantaiUtuh({
          perkaraId: badan.perkaraId,
          tanggalPenetapan: String(badan.tanggalPenetapan || ""),
          olehUsername: String(badan.olehUsername || ""),
          operator,
          ip,
          langkah,
        })
    );
    if (hasil === undefined) return;

    // Jejak jujur per langkah - termasuk yang DIBATALKAN bersama rantainya.
    for (const satu of hasil.hasil || []) {
      if (satu.sudahAda) continue;
      const r = satu.rencana || {};
      const pejabat = (langkah.find((x) => x.jenis.toLowerCase() === satu.jenis) || {}).pejabatUsername || "";
      void jejakAletaService.catat({
        aksi: "tulis",
        jenis: satu.jenis,
        perkaraId: badan.perkaraId,
        nomorPerkara: (r.perkara && r.perkara.nomorPerkara) || "",
        tanggalPenetapan: String(badan.tanggalPenetapan || ""),
        // Butir 17: akun yang DICATAT di SIPP (pejabat), jam yang dicatat di
        // SIPP, dan penekan sebenarnya (akun SIPP yang masuk + operator ALETA).
        akunSipp: (r.atasNama && r.atasNama.username) || pejabat,
        namaPejabat: (r.atasNama && r.atasNama.namaLengkap) || pejabat,
        akunSippMasuk: (r.akunMasuk && r.akunMasuk.username) || String(badan.olehUsername || ""),
        jamSipp: r.saat || "",
        operator,
        ip,
        berhasil: hasil.ok === true && satu.ok === true,
        kering: false,
        alasan: hasil.ok ? "" : satu.ok ? `dibatalkan_rantai:${hasil.alasan || "gagal"}` : String(satu.alasan || "gagal"),
        langkah: r.langkah || [],
      });
    }

    res.json({
      ok: hasil.ok === true,
      utuh: hasil.utuh === true,
      alasan: hasil.alasan || "",
      jenisGagal: hasil.jenis || "",
      // Akun yang ditolak (butir 17) - supaya panel menyebut akun pejabatnya,
      // bukan akun yang sedang masuk.
      usernameGagal:
        ((hasil.hasil || []).find((x) => x && !x.ok && !x.sudahAda && x.rencana && x.rencana.username) || { rencana: {} })
          .rencana.username || "",
      pesan: hasil.pesan || "",
      dipulihkan: hasil.dipulihkan === true,
      hasil: (hasil.hasil || []).map((satu) => ({
        jenis: satu.jenis,
        ok: hasil.ok === true && satu.ok === true,
        sudahAda: satu.sudahAda === true,
        alasan: satu.alasan || "",
        atasNama: satu.rencana ? satu.rencana.atasNama : undefined,
        tanggalPenetapan: satu.rencana ? satu.rencana.tanggalPenetapan : "",
        catatanTanggal: (satu.rencana && satu.rencana.catatanTanggal) || [],
        langkah: satu.eksekusi && satu.eksekusi.selesai ? satu.eksekusi.selesai : [],
      })),
    });
  } catch (error) {
    res.status(500).json({ ok: false, alasan: "gagal_menulis", pesan: String(error.message || error).slice(0, 300) });
  }
  }, (b) => `Penetapan perkara ${b.perkaraId || ""}`)
);

router.post("/penetapan/tulis", requireInternalToken, async (req, res) => {
  // Kunci perkara untuk penulisan sungguhan satu langkah (jalan lama), diambil
  // SEBELUM keadaan dibaca dan dilepas di akhir. Uji kering dan Data Umum tidak
  // dikunci: keduanya tidak menulis penetapan.
  let kunciDiambil = null;
  try {
    const badan = req.body || {};
    const operator = String(badan.operator || "").trim();
    if (!operator) {
      res.status(400).json({ ok: false, alasan: "operator_tidak_disebut" });
      return;
    }

    // Uji kering dinilai atas keadaan yang AKAN ada. Keduanya harus sampai ke
    // penyusun rencana, bukan hanya ke penjalannya: PHS menuntut PMH sudah
    // tersimpan, dan pada uji kering belum ada satu baris pun yang ditulis.
    const kering = badan.kering !== false;

    if (!kering && penetapanKeadaanService.JENIS.includes(String(badan.jenis || "").toLowerCase())) {
      const kunci = await penetapanKunciService.layanan().ambil({
        perkaraId: badan.perkaraId,
        pemilik: operator,
        tujuan: `penetapan-${String(badan.jenis).toLowerCase()}`,
        tokenLama: String(badan.kunciToken || ""),
      });
      if (!kunci.ok) {
        res.status(kunci.alasan === "sedang_dikerjakan" ? 409 : 503).json({
          ok: false,
          alasan: kunci.alasan,
          oleh: kunci.oleh || "",
          tujuan: kunci.tujuan || "",
          sampai: kunci.sampai || "",
          pesan: kunci.pesan || "",
        });
        return;
      }
      if (!kunci.diperpanjang) kunciDiambil = kunci.token;
    }

    // ========================================================================
    // JEDA SUNGGUHAN SEBELUM MENULIS - DAN JAMNYA DIAMBIL SESUDAHNYA
    // ========================================================================
    //
    // Petugas yang mengisi borang SIPP tidak menekan Simpan sedetik sesudah
    // langkah sebelumnya. Jedanya dijalani di SINI, sebelum rencana disusun,
    // sebab penyusun rencana mengambil jam basis data saat itu juga - jam yang
    // tercatat di sys_audittrail adalah jam sesudah jeda, jam yang sungguh
    // terjadi, bukan jam yang disusun. Uji kering tidak menunggu apa pun.
    if (!kering) await jedaManusiaService.jeda("simpan", { kering });

    const rencana = await penetapanTulisService.susunRencanaTulis({
      jenis: String(badan.jenis || ""),
      perkaraId: badan.perkaraId,
      tanggalPenetapan: String(badan.tanggalPenetapan || ""),
      kering,
      // Jenis penetapan yang ditulis LEBIH DAHULU oleh pemanggil pada rantai
      // yang sama. Hanya berpengaruh pada uji kering.
      rantaiSebelum: Array.isArray(badan.rantaiSebelum) ? badan.rantaiSebelum : [],
      // PMH
      hakimId: Array.isArray(badan.hakimId) ? badan.hakimId : [],
      // PPP dan PJS
      petugasId: badan.petugasId,
      // Data Umum - isian yang akan dituliskan. Tanpa baris ini rencananya
      // tersusun KOSONG, dan tulisan kosong tetap dilaporkan berhasil.
      dataUmum: badan.dataUmum || {},
      // PHS
      tanggalSidang: String(badan.tanggalSidang || ""),
      ruanganId: badan.ruanganId,
      jamSidang: String(badan.jamSidang || ""),
      // Akun SIPP petugas yang SEDANG MASUK dan menekan tombolnya (nama pada
      // kepala halaman SIPP) - penekan sebenarnya, untuk jejak ALETA.
      olehUsername: String(badan.olehUsername || ""),
      // Butir 17 (13 Okt 2026): akun SIPP pejabat penetap (Ketua/Wakil/Plh,
      // Panitera/Plh, ketua majelis) - INILAH yang dicatat di Riwayat Perkara
      // dan sys_audittrail untuk PMH/PPP/PJS/PHS.
      pejabatUsername: String(badan.pejabatUsername || "").trim().slice(0, 150),
      operator,
      ip: alamatAudit(req),
    });

    const pejabatPenetap = String(badan.pejabatUsername || "").trim().slice(0, 150);

    if (!rencana.ok) {
      // Yang DITOLAK ikut tercatat. Di sys_audittrail percobaan yang gagal
      // tidak pernah meninggalkan jejak, dan itu justru yang dicari ketika
      // petugas bertanya kenapa penetapannya tidak jadi.
      void jejakAletaService.catat({
        aksi: "tulis",
        jenis: String(badan.jenis || ""),
        perkaraId: badan.perkaraId,
        tanggalPenetapan: String(badan.tanggalPenetapan || ""),
        akunSipp: pejabatPenetap,
        namaPejabat: pejabatPenetap,
        akunSippMasuk: String(badan.olehUsername || ""),
        operator,
        ip: alamatAudit(req),
        berhasil: false,
        kering,
        alasan: String(rencana.alasan || "ditolak"),
        langkah: [],
      });
      res.status(400).json(rencana);
      return;
    }

    const hasil = await penetapanTulisService.jalankanRencana(rencana, { kering });

    void jejakAletaService.catat({
      aksi: "tulis",
      jenis: rencana.jenis,
      perkaraId: badan.perkaraId,
      // rencana.perkara adalah OBYEK { perkaraId, nomorPerkara } - nomornya
      // yang dicatat, bukan bungkusnya. Lihat nomorPerkaraSaja di
      // jejakAletaService.
      nomorPerkara: (rencana.perkara && rencana.perkara.nomorPerkara) || "",
      tanggalPenetapan: String(badan.tanggalPenetapan || ""),
      akunSipp: (rencana.atasNama && rencana.atasNama.username) || "",
      namaPejabat: (rencana.atasNama && rencana.atasNama.namaLengkap) || pejabatPenetap,
      akunSippMasuk: (rencana.akunMasuk && rencana.akunMasuk.username) || String(badan.olehUsername || ""),
      jamSipp: rencana.saat || "",
      operator: rencana.operator,
      ip: alamatAudit(req),
      berhasil: hasil.ok === true,
      kering,
      alasan: hasil.ok ? "" : String(hasil.alasan || "gagal"),
      langkah: rencana.langkah,
    });

    res.status(hasil.ok ? 200 : 409).json({
      ...hasil,
      jenis: rencana.jenis,
      perkara: rencana.perkara,
      atasNama: rencana.atasNama,
      operator: rencana.operator,
      andaian: rencana.andaian || [],
      // Pada hasil kering, langkahnya dikirim lengkap supaya dapat dibaca
      // manusia sebelum apa pun terjadi.
      rencana: kering ? rencana.langkah.map((x) => ({
        tabel: x.tabel,
        aksi: x.aksi,
        keterangan: x.keterangan,
        sql: String(x.sql).replace(/\s+/g, " ").trim(),
        nilai: x.params,
      })) : undefined,
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  } finally {
    if (kunciDiambil) {
      await penetapanKunciService.layanan().lepas({ perkaraId: (req.body || {}).perkaraId, token: kunciDiambil });
    }
  }
});

/**
 * Keadaan satu baris jadwal sidang - dibaca sebelum apa pun ditawarkan.
 *
 * Panitera sidang membuka layar ini dari kotak nomor perkara pada antrian
 * sidang, dan yang pertama ia butuhkan bukan borang melainkan JAWABAN: sidang
 * ini sudah ditunda atau belum, agendanya apa, jamnya berapa.
 */
router.get("/sidang/keadaan", requireInternalToken, async (req, res) => {
  try {
    // Sejak 7 Okt 2026 (kasus 273): keadaan + riwayat + ruangan + antrian
    // sidang + atas nama siapa tombolnya menulis (PP) - sidangHasilAlur.
    const { status, body } = await sidangHasilAlur.keadaanHasilSidang(req.query.jadwalId);
    res.status(status).json(body);
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/**
 * Menunda satu sidang - menulis ke SIPP dan menggerakkan antriannya.
 *
 * ============================================================================
 * KERING SEBAGAI BAWAAN, SAMA SEPERTI PENETAPAN
 * ============================================================================
 *
 * Menulis sungguhan menuntut { kering: false } yang TEGAS. Bukan kehati-hatian
 * berlebihan: yang ditulis ini `perkara_jadwal_sidang` dan `perkara` pada basis
 * data SIPP yang sedang dipakai, dan tiga baris audit yang harus terbaca
 * sebagaimana petugas menuliskannya sendiri. Rencananya diperlihatkan lebih
 * dahulu supaya ada yang dapat membacanya sebelum apa pun terjadi.
 *
 * ============================================================================
 * ANTRIAN DIGERAKKAN SESUDAHNYA, DAN GAGALNYA TIDAK MEMBATALKAN PENUNDAAN
 * ============================================================================
 *
 * Penundaan sidang adalah catatan resmi; antrian hanya papan panggil di ruang
 * tunggu. Bila antriannya tidak tergerakkan - perkaranya memang tidak mengambil
 * nomor, misalnya - penundaannya TETAP sah dan tetap tercatat. Yang dikerjakan
 * hanya melaporkan bahwa antriannya tidak ikut bergerak, bukan membatalkan
 * yang sudah benar.
 */
// Tunda otomatis 16.30 (22 Okt 2026) berkunci antrean sendiri ("otomatis:<jadwal>")
// supaya tidak pernah bertabrakan dengan tundaan manual yang diantrekan petugas,
// dan supaya tombol "jangan tunda otomatis" dapat membatalkannya.
router.post(
  "/sidang/tunda",
  requireInternalToken,
  manualJamKerja("sidang-tunda", (b) => (b.otomatis === true ? `otomatis:${String(b.jadwalId || "")}` : String(b.jadwalId || "")), async (req, res) => {
  try {
    // Alurnya di sidangHasilAlur (7 Okt 2026, kasus 273): rencana -> jeda ->
    // SATU transaksi -> antrian -> jejak jujur; penolakan membawa kalimat sebab.
    const { status, body } = await sidangHasilAlur.jalankanHasilSidang("tunda", req.body || {}, {
      ip: alamatAudit(req),
    });
    res.status(status).json(body);
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
  }, () => "Tunda sidang")
);

/**
 * Memutus satu sidang - panitera sidang mencatat bahwa hari ini perkaranya
 * diputus.
 *
 * BUKAN borang hakim. Amar dan pertimbangan hukumnya tidak ditanyakan: aplikasi
 * antrian sidang satker mengisi amar_putusan dengan "BELUM DIINPUT" dan
 * sumber_hukum_id tetap '8,11'. Naskahnya ditulis hakim belakangan lewat SIPP.
 *
 * Alamat /sidang/putus yang lama - yang menuntut amar dan pertimbangan - tetap
 * ada untuk jalur hakim. Keduanya menulis ke tabel yang sama pada saat yang
 * berbeda, dan ON DUPLICATE KEY UPDATE membuat keduanya hidup berdampingan.
 */
router.post(
  "/sidang/putus-sidang",
  requireInternalToken,
  manualJamKerja("sidang-putus", (b) => String(b.jadwalId || ""), async (req, res) => {
  try {
    // Alur yang sama dengan tunda - sidangHasilAlur (7 Okt 2026).
    const { status, body } = await sidangHasilAlur.jalankanHasilSidang("putus", req.body || {}, {
      ip: alamatAudit(req),
    });
    res.status(status).json(body);
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
  }, () => "Putus sidang")
);

/**
 * Mengisi form "Penetapan Ikrar Talak" SIPP sesudah ikrar terlaksana (18 Okt 2026):
 * tanggal ikrar = tanggal sidang ikrar, status diikrarkan, amar, keadaan istri.
 * Atas nama ketua majelis ikrar; ditolak bila keterangan jadwal sidang belum
 * menyatakan ikrar terlaksana. Kering sebagai bawaan.
 */
router.post(
  "/sidang/isi-ikrar",
  requireInternalToken,
  manualJamKerja("isi-ikrar", (b) => String(b.jadwalId || ""), async (req, res) => {
  try {
    const { status, body } = await sidangHasilAlur.jalankanIsiIkrar(req.body || {}, { ip: alamatAudit(req) });
    res.status(status).json(body);
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
  }, () => "Form ikrar talak")
);

/**
 * Isian borang "Data Penetapan Ikrar Talak" SIPP untuk ekstensi (31, 18 Okt 2026): MEMBACA
 * saja, tidak menulis apa pun ke SIPP. `ok:false` + alasan = borang tidak perlu/belum boleh
 * diisi (ekstensi diam): ikrar belum dinyatakan terlaksana, form sudah terisi, tanggal tak sah.
 */
router.post("/sidang/ikrar-borang", requireInternalToken, async (req, res) => {
  try {
    const badan = req.body || {};
    const hasil = await require("../services/ikrarTalakService").susunIsianBorangIkrar({
      nomorPerkara: badan.nomorPerkara,
      perkaraId: badan.perkaraId,
    });
    res.json(hasil);
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/**
 * Status putusan yang dapat dipilih - dibaca dari tabel rujukan SIPP.
 *
 * Tidak disalin ke dalam kode: daftar yang disalin akan basi tanpa berbunyi,
 * dan yang basi di sini berarti putusan tercatat dengan status yang salah.
 */
router.get("/sidang/status-putusan", requireInternalToken, async (req, res) => {
  try {
    const daftar = await putusanTulisService.daftarStatusPutusan();
    res.json({ ok: true, daftar });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/**
 * Menulis putusan akhir ke SIPP.
 *
 * ============================================================================
 * TULISAN PALING BERAT YANG DIKERJAKAN ALETA
 * ============================================================================
 *
 * Yang dicatat di sini dibaca pengadilan tingkat banding, dipakai menyusun akta
 * cerai, dan dikirim ke Direktori Putusan. Karena itu kering sebagai bawaan
 * berlaku sama tegasnya seperti pada penetapan dan penundaan - `kering: false`
 * harus disebut, tidak pernah tersirat.
 *
 * Bentuk tulisannya diukur dari satu sesi memutus sungguhan: dua baris pada
 * detik yang sama - `perkara_putusan` dan `perkara_pertimbangan_hukum` - dengan
 * judul audit yang berbeda dari seluruh modul SIPP lainnya, dan kolom
 * `diinput_tanggal` berjam dua belas. Lihat putusanTulisService.
 */
router.post("/sidang/putus", requireInternalToken, async (req, res) => {
  try {
    // Keputusan 9 Okt 2026: unggah/tulis putusan hanya Super Admin, Admin,
    // dan Hakim (termasuk Ketua/Wakil). Portal sudah memeriksa; ini lapis
    // kedua - lihat hakUnggahPutusanService.
    const hak = hakUnggahPutusanService.periksaHakUnggahPutusan(req.body || {});
    if (!hak.ok) {
      res.status(hak.status).json({ ok: false, alasan: hak.alasan, pesan: hak.pesan, error: hak.pesan });
      return;
    }
    const badan = req.body || {};
    const operator = String(badan.operator || "").trim();
    if (!operator) {
      res.status(400).json({ ok: false, alasan: "operator_tidak_disebut" });
      return;
    }
    const kering = badan.kering !== false;

    const rencana = await putusanTulisService.susunRencanaPutus({
      perkaraId: badan.perkaraId,
      tanggalPutusan: String(badan.tanggalPutusan || ""),
      statusPutusanId: badan.statusPutusanId,
      amarPutusan: String(badan.amarPutusan || ""),
      catatanPutusan: String(badan.catatanPutusan || ""),
      sumberHukumId: String(badan.sumberHukumId || ""),
      verstek: String(badan.verstek || ""),
      pertimbanganHukum: String(badan.pertimbanganHukum || ""),
      olehUsername: String(badan.olehUsername || ""),
      operator,
      ip: alamatAudit(req),
    });

    if (!rencana.ok) {
      void jejakAletaService.catat({
        aksi: "putus",
        jenis: "putusan",
        perkaraId: badan.perkaraId,
        akunSipp: String(badan.olehUsername || ""),
        operator,
        ip: alamatAudit(req),
        berhasil: false,
        kering,
        alasan: String(rencana.alasan || "ditolak"),
        langkah: [],
      });
      res.status(400).json(rencana);
      return;
    }

    const hasil = await putusanTulisService.jalankanRencana(rencana, { kering });

    void jejakAletaService.catat({
      aksi: "putus",
      jenis: "putusan",
      perkaraId: rencana.perkara && rencana.perkara.perkaraId,
      nomorPerkara: (rencana.perkara && rencana.perkara.nomorPerkara) || "",
      tanggalPenetapan: rencana.putusan && rencana.putusan.tanggalPutusan,
      akunSipp: (rencana.atasNama && rencana.atasNama.username) || "",
      namaPejabat: (rencana.atasNama && rencana.atasNama.namaLengkap) || "",
      operator: rencana.operator,
      ip: alamatAudit(req),
      berhasil: hasil.ok === true,
      kering,
      alasan: hasil.ok ? "" : String(hasil.alasan || "gagal"),
      langkah: rencana.langkah,
    });

    res.status(hasil.ok ? 200 : 409).json({
      ...hasil,
      perkara: rencana.perkara,
      atasNama: rencana.atasNama,
      operator: rencana.operator,
      putusan: rencana.putusan,
      andaian: rencana.andaian || [],
      rencana: kering
        ? rencana.langkah.map((x) => ({
            tabel: x.tabel,
            aksi: x.aksi,
            keterangan: x.keterangan,
            sql: String(x.sql).replace(/\s+/g, " ").trim(),
            nilai: x.params,
          }))
        : undefined,
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/**
 * Membongkar satu penetapan yang sudah tertulis.
 *
 * Kering sebagai bawaan, sama seperti menulis: rencananya diperlihatkan lebih
 * dahulu, dan membongkar sungguhan menuntut { kering: false } yang tegas.
 */
router.post("/penetapan/hapus", requireInternalToken, async (req, res) => {
  let kunciHapus = null;
  try {
    const badan = req.body || {};
    const operator = String(badan.operator || "").trim();
    if (!operator) {
      res.status(400).json({ ok: false, alasan: "operator_tidak_disebut" });
      return;
    }

    const kering = badan.kering !== false;
    // Membongkar HANYA atas perintah eksplisit pengguna (tombol Bongkar yang
    // ia tekan). Mode otomatis, antrean, dan penanda halaman tidak pernah
    // mengirim tanda ini - perkara tidak dibongkar lalu ditulis ulang sendiri.
    if (!kering && String(badan.perintahPengguna || "") !== "bongkar") {
      res.status(400).json({ ok: false, alasan: "bongkar_tanpa_perintah" });
      return;
    }
    if (!kering) {
      const kunci = await penetapanKunciService.layanan().ambil({
        perkaraId: badan.perkaraId,
        pemilik: operator,
        tujuan: `bongkar-${String(badan.jenis || "").toLowerCase()}`,
        tokenLama: String(badan.kunciToken || ""),
      });
      if (!kunci.ok) {
        res.status(kunci.alasan === "sedang_dikerjakan" ? 409 : 503).json({
          ok: false,
          alasan: kunci.alasan,
          oleh: kunci.oleh || "",
          sampai: kunci.sampai || "",
          pesan: kunci.pesan || "",
        });
        return;
      }
      if (!kunci.diperpanjang) kunciHapus = kunci.token;
    }
    // Jeda sungguhan sebelum membongkar - jamnya diambil sesudahnya (butir 39).
    if (!kering) await jedaManusiaService.jeda("simpan", { kering });
    const rencana = await penetapanTulisService.susunRencanaHapus({
      jenis: String(badan.jenis || ""),
      perkaraId: badan.perkaraId,
      // Pejabat pilihan panel - dipakai bila penetapan yang dibatalkan tidak
      // tercatat atas akun pejabat (butir 17, lihat akunPembatalan).
      olehUsername: String(badan.olehUsername || ""),
      // Akun SIPP petugas yang sedang masuk - penekan sebenarnya, jejak ALETA.
      akunSippMasuk: String(badan.akunSippMasuk || ""),
      operator,
      kering,
      ip: alamatAudit(req),
    });

    if (!rencana.ok) {
      res.status(400).json(rencana);
      return;
    }

    const hasil = await penetapanTulisService.jalankanRencana(rencana, { kering });

    void jejakAletaService.catat({
      aksi: "hapus",
      jenis: rencana.jenis,
      perkaraId: badan.perkaraId,
      // rencana.perkara adalah OBYEK { perkaraId, nomorPerkara } - nomornya
      // yang dicatat, bukan bungkusnya. Lihat nomorPerkaraSaja di
      // jejakAletaService.
      nomorPerkara: (rencana.perkara && rencana.perkara.nomorPerkara) || "",
      akunSipp: (rencana.atasNama && rencana.atasNama.username) || "",
      namaPejabat: (rencana.atasNama && rencana.atasNama.namaLengkap) || "",
      akunSippMasuk: (rencana.akunMasuk && rencana.akunMasuk.username) || String(badan.akunSippMasuk || ""),
      jamSipp: rencana.saat || "",
      operator: rencana.operator,
      ip: alamatAudit(req),
      berhasil: hasil.ok === true,
      kering,
      alasan: hasil.ok ? "" : String(hasil.alasan || "gagal"),
      langkah: rencana.langkah,
    });

    res.status(hasil.ok ? 200 : 409).json({
      ...hasil,
      jenis: rencana.jenis,
      membongkar: true,
      perkara: rencana.perkara,
      atasNama: rencana.atasNama,
      operator: rencana.operator,
      rencana: kering
        ? rencana.langkah.map((x) => ({
            tabel: x.tabel,
            aksi: x.aksi,
            keterangan: x.keterangan,
            sql: String(x.sql).replace(/\s+/g, " ").trim(),
            nilai: x.params,
          }))
        : undefined,
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  } finally {
    if (kunciHapus) await penetapanKunciService.layanan().lepas({ perkaraId: (req.body || {}).perkaraId, token: kunciHapus });
  }
});

/**
 * ============================================================================
 * MEMBATALKAN SELURUH PENETAPAN SATU PERKARA
 * ============================================================================
 *
 * Membatalkan satu per satu menuntut empat kali dua tekanan, berurutan dari
 * PHS mundur ke PMH, dan urutan itu tidak boleh keliru - membongkar majelis
 * selagi hari sidangnya masih berdiri meninggalkan sidang bagi majelis yang
 * sudah tidak ada. Delapan tekanan yang urutannya harus diingat adalah
 * delapan kesempatan berhenti di tengah, dan perkara yang separuh terbongkar
 * justru keadaan yang paling sukar dibereskan.
 *
 * Di sini rantainya diurus satu tempat. Urutannya dibaca dari layanan, bukan
 * ditulis ulang - lihat URUTAN_BONGKAR.
 *
 * KERING sebagai bawaan, sama seperti membongkar satu langkah: yang lupa
 * menyebut { kering: false } menerima RENCANA, bukan pembongkarannya.
 */
router.post("/penetapan/hapus-semua", requireInternalToken, async (req, res) => {
  let kunciHapusSemua = null;
  try {
    const badan = req.body || {};
    const operator = String(badan.operator || "").trim();
    if (!operator) {
      res.status(400).json({ ok: false, alasan: "operator_tidak_disebut" });
      return;
    }

    const perkaraId = Number(badan.perkaraId);
    if (!Number.isFinite(perkaraId) || perkaraId <= 0) {
      res.status(400).json({ ok: false, alasan: "perkara_tidak_sah" });
      return;
    }

    // Akun pejabat tiap jenis - pembongkaran tercatat atas nama yang sama
    // dengan yang menuliskannya.
    const akun = badan.akunPerJenis && typeof badan.akunPerJenis === "object" ? badan.akunPerJenis : {};
    const kering = badan.kering !== false;
    const ip = alamatAudit(req);

    // Hanya atas perintah eksplisit pengguna (lihat /penetapan/hapus).
    if (!kering && String(badan.perintahPengguna || "") !== "bongkar") {
      res.status(400).json({ ok: false, alasan: "bongkar_tanpa_perintah" });
      return;
    }
    if (!kering) {
      const kunci = await penetapanKunciService.layanan().ambil({
        perkaraId,
        pemilik: operator,
        tujuan: "bongkar-semua",
        tokenLama: String(badan.kunciToken || ""),
      });
      if (!kunci.ok) {
        res.status(kunci.alasan === "sedang_dikerjakan" ? 409 : 503).json({
          ok: false,
          alasan: kunci.alasan,
          oleh: kunci.oleh || "",
          sampai: kunci.sampai || "",
          pesan: kunci.pesan || "",
        });
        return;
      }
      if (!kunci.diperpanjang) kunciHapusSemua = kunci.token;
    }

    const langkah = [];
    const rantaiDibongkar = [];
    let berhentiKarena = null;

    // Butir 17 (13 Okt 2026): tiap langkah tercatat di SIPP atas akun pejabat
    // yang sama dengan penetapan yang dibatalkan, pada jam SIPP yang disusun
    // SEKALI untuk seluruh rangkaian (PHS -> PMH) seperti orang bekerja.
    // Akun SIPP yang sedang masuk hanya untuk jejak ALETA.
    const akunSippMasuk = String(badan.akunSippMasuk || "").trim();
    const jadwal = await penetapanTulisService.jadwalJamSipp(perkaraId, penetapanTulisService.URUTAN_BONGKAR, {
      saring: "ada",
    });

    for (const jenis of penetapanTulisService.URUTAN_BONGKAR) {
      const olehUsername = String(akun[jenis] || "").trim();

      if (!kering) await jedaManusiaService.jeda("simpan", { kering });
      const rencana = await penetapanTulisService.susunRencanaHapus({
        jenis,
        perkaraId,
        olehUsername,
        akunSippMasuk,
        operator,
        ip,
        kering,
        rantaiDibongkar: [...rantaiDibongkar],
        saatSipp: jadwal.jam[jenis] || "",
      });

      if (!rencana.ok) {
        // Yang memang BELUM ADA dilewati tanpa berbunyi - perkara yang
        // penetapannya baru sampai PPP tidak sedang bermasalah, ia hanya
        // belum punya PJS dan PHS.
        if (rencana.alasan === `${jenis}_belum_ada`) continue;

        // Sisanya menghentikan rantainya. Melanjutkan berarti membongkar
        // langkah yang lebih awal selagi yang lebih akhir masih berdiri.
        berhentiKarena = { jenis, ...rencana };
        break;
      }

      if (kering) {
        langkah.push({
          jenis,
          atasNama: rencana.atasNama,
          jumlahPernyataan: rencana.langkah.length,
          tabel: [...new Set(rencana.langkah.map((x) => x.tabel))],
        });
        rantaiDibongkar.push(jenis);
        continue;
      }

      const hasil = await penetapanTulisService.jalankanRencana(rencana, { kering: false });

      void jejakAletaService.catat({
        aksi: "hapus",
        jenis,
        perkaraId,
        // rencana.perkara adalah OBYEK { perkaraId, nomorPerkara } - nomornya
        // yang dicatat, bukan bungkusnya. Lihat nomorPerkaraSaja di
        // jejakAletaService.
        nomorPerkara: (rencana.perkara && rencana.perkara.nomorPerkara) || "",
        akunSipp: (rencana.atasNama && rencana.atasNama.username) || "",
        namaPejabat: (rencana.atasNama && rencana.atasNama.namaLengkap) || "",
        akunSippMasuk: (rencana.akunMasuk && rencana.akunMasuk.username) || akunSippMasuk,
        jamSipp: rencana.saat || "",
        operator: rencana.operator,
        ip,
        berhasil: hasil.ok === true,
        kering: false,
        alasan: hasil.ok ? "" : String(hasil.alasan || "gagal"),
        langkah: rencana.langkah,
      });

      langkah.push({
        jenis,
        atasNama: rencana.atasNama,
        jumlahPernyataan: rencana.langkah.length,
        tabel: [...new Set(rencana.langkah.map((x) => x.tabel))],
        ok: hasil.ok === true,
        alasan: hasil.ok ? "" : String(hasil.alasan || "gagal"),
      });

      if (!hasil.ok) {
        berhentiKarena = { jenis, ...hasil };
        break;
      }
      rantaiDibongkar.push(jenis);
    }

    // Tidak ada satu pun yang dapat dibongkar BUKAN kegagalan - perkara yang
    // memang belum ditetapkan menjawab begitu, dan itu jawaban yang benar.
    res.status(berhentiKarena ? 409 : 200).json({
      ok: !berhentiKarena,
      kering,
      perkaraId,
      langkah,
      jumlah: langkah.length,
      berhentiKarena,
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  } finally {
    if (kunciHapusSemua) await penetapanKunciService.layanan().lepas({ perkaraId: (req.body || {}).perkaraId, token: kunciHapusSemua });
  }
});

/**
 * ============================================================================
 * RIWAYAT PERBUATAN ALETA
 * ============================================================================
 *
 * Dibaca tab Riwayat pada panel ekstensi. Sumbernya basis data ALETA sendiri,
 * bukan sys_audittrail SIPP - sejak 1.106.0 tidak ada satu kata pun tentang
 * ALETA yang ditulis ke sana.
 */
router.get("/penetapan/riwayat", requireInternalToken, async (req, res) => {
  try {
    const hasil = await jejakAletaService.riwayat({
      perkaraId: req.query.perkaraId,
      nomorPerkara: String(req.query.nomorPerkara || ""),
      batas: req.query.batas,
      termasukKering: String(req.query.termasukKering || "") === "1",
    });
    res.status(hasil.ok ? 200 : 500).json(hasil);
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/** Rincian langkah satu jejak - dibaca ketika satu barisnya dibuka. */
router.get("/penetapan/riwayat/:id", requireInternalToken, async (req, res) => {
  try {
    const hasil = await jejakAletaService.rincian(req.params.id);
    res.status(hasil.ok ? 200 : 404).json(hasil);
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/**
 * ============================================================================
 * PEMERIKSA SELISIH e-COURT DAN SIPP
 * ============================================================================
 *
 * Dua titik: membaca keadaan pemeriksaan terakhir, dan menjalankannya
 * sekarang juga.
 *
 * Yang menjalankan manual BAWAANNYA KERING - ia menyusun pesannya dan
 * memulangkannya tanpa mengantre apa pun. Mengirim sungguhan menuntut
 * { kering: false } yang tegas, sebab pesan yang sama dapat berangkat ke
 * ponsel panitera di tengah malam hanya karena seseorang menekan tombol
 * untuk melihat isinya.
 */
router.get("/selisih-harian/keadaan", requireInternalToken, (req, res) => {
  try {
    res.json({ ok: true, ...selisihHarianService.keadaan() });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

router.post("/selisih-harian/jalankan", requireInternalToken, async (req, res) => {
  try {
    const badan = req.body || {};
    const hasil = await selisihHarianService.jalankanSatuPutaran({
      kering: badan.kering !== false,
      olehSiapa: String(badan.olehSiapa || "manual").slice(0, 120),
    });
    res.status(hasil.ok ? 200 : 500).json(hasil);
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/**
 * ============================================================================
 * TANDA TANGAN PEJABAT
 * ============================================================================
 *
 * Lima titik: membaca daftarnya, membaca gambarnya, menamai, mengesahkan,
 * dan membuang. Yang BELUM DISAHKAN tidak pernah dapat dipakai membubuhkan
 * apa pun - lihat tandaTanganService.untukPejabat.
 */
router.get("/tanda-tangan", requireInternalToken, async (req, res) => {
  try {
    const hasil = await tandaTanganService.daftar({ hanyaSah: String(req.query.hanyaSah || "") === "1" });
    res.json(hasil);
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/** Gambarnya sendiri - dibaca layar pengesahan. */
router.get("/tanda-tangan/:id/gambar", requireInternalToken, async (req, res) => {
  try {
    const gambar = await tandaTanganService.gambar(req.params.id);
    if (!gambar) {
      res.status(404).json({ ok: false, alasan: "tanda_tangan_tidak_ketemu" });
      return;
    }
    res.setHeader("Content-Type", gambar.jenis === "jpg" ? "image/jpeg" : "image/png");
    res.setHeader("Cache-Control", "private, max-age=300");
    res.send(gambar.isi);
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

router.post("/tanda-tangan/:id/nama", requireInternalToken, async (req, res) => {
  try {
    const badan = req.body || {};
    const hasil = await tandaTanganService.namai(req.params.id, {
      namaPejabat: String(badan.namaPejabat || ""),
      jabatan: String(badan.jabatan || ""),
      // Tautan ke akun portal - boleh kosong, sebab tanda tangan pejabat dari
      // luar satker memang tidak punya akun di sini.
      penggunaId: String(badan.penggunaId || ""),
      peran: String(badan.peran || ""),
      subPeran: String(badan.subPeran || ""),
      oleh: String(badan.oleh || ""),
    });
    res.status(hasil.ok ? 200 : 400).json(hasil);
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/**
 * Mengunggah SATU tanda tangan baru.
 *
 * Sampai 2.21.0 gambar hanya dapat masuk lewat skrip pengimpor yang membaca
 * berkas .doc satuan kerja di peladen. Pejabat yang tanda tangannya tidak ada
 * di dokumen itu karena itu tidak punya jalan sama sekali.
 *
 * Yang diunggah TETAP menunggu pengesahan orang kedua, persis seperti yang
 * diimpor - itulah yang memisahkannya dari tanda tangan palsu pada penetapan.
 */
router.post("/tanda-tangan/tambah", requireInternalToken, async (req, res) => {
  try {
    const badan = req.body || {};
    const hasil = await tandaTanganService.tambah({
      isiBase64: String(badan.isiBase64 || ""),
      jenisBerkas: String(badan.jenisBerkas || ""),
      namaPejabat: String(badan.namaPejabat || ""),
      jabatan: String(badan.jabatan || ""),
      penggunaId: String(badan.penggunaId || ""),
      peran: String(badan.peran || ""),
      subPeran: String(badan.subPeran || ""),
      asal: String(badan.asal || "unggahan layar"),
      oleh: String(badan.oleh || ""),
    });
    res.status(hasil.ok ? 200 : 400).json(hasil);
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/** Tautan otomatis ke akun pemilik (14 Okt 2026) - hanya berkas yang belum bertaut. */
router.post("/tanda-tangan/:id/tautkan-akun", requireInternalToken, async (req, res) => {
  try {
    const badan = req.body || {};
    const hasil = await tandaTanganService.tautkanAkun(req.params.id, {
      penggunaId: String(badan.penggunaId || ""),
      peran: String(badan.peran || ""),
      subPeran: String(badan.subPeran || ""),
      namaPejabat: String(badan.namaPejabat || ""),
    });
    res.status(hasil.ok ? 200 : 400).json(hasil);
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/** Status sambungan TTE BSrE (19 Okt 2026) - hanya membaca; tidak menyebut alamat/rahasia penyedia. */
router.get("/tanda-tangan-tte/status", requireInternalToken, (req, res) => {
  let tersambung = false;
  try {
    tersambung = Boolean(require("../services/tteProviderService").tersedia());
  } catch {
    tersambung = false;
  }
  res.json({ ok: true, tersambung });
});

/** Cara tanda tangan + identitas sertifikat satu pejabat. Passphrase DITOLAK, tidak disimpan. */
router.post("/tanda-tangan/:id/tte", requireInternalToken, async (req, res) => {
  try {
    const badan = req.body || {};
    const hasil = await tandaTanganService.aturTte(req.params.id, {
      caraTtd: String(badan.caraTtd || "gambar"),
      nikBsre: String(badan.nikBsre || ""),
      passphrase: badan.passphrase === undefined ? undefined : "ada",
      tteTersedia: () => require("../services/tteProviderService").tersedia(),
    });
    res.status(hasil.ok ? 200 : 400).json(hasil);
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

router.post("/tanda-tangan/:id/sahkan", requireInternalToken, async (req, res) => {
  try {
    const hasil = await tandaTanganService.sahkan(req.params.id, { oleh: String((req.body || {}).oleh || "") });
    res.status(hasil.ok ? 200 : 400).json(hasil);
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

router.post("/tanda-tangan/:id/hapus", requireInternalToken, async (req, res) => {
  try {
    const hasil = await tandaTanganService.hapus(req.params.id);
    res.status(hasil.ok ? 200 : 400).json(hasil);
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/**
 * ============================================================================
 * ALAMAT BLANGKO PENETAPAN DI ABT
 * ============================================================================
 *
 * ABT hanya ada di peladen, dan alamat blangkonya berbeda antar pemasangan.
 * Karena itu alamatnya DISUNTING, bukan ditulis tetap di dalam kode: {nomor}
 * dan {nomorBersih} di dalamnya diganti nomor perkaranya.
 */
router.get("/blangko-penetapan/pengaturan", requireInternalToken, (req, res) => {
  try {
    res.json({
      ok: true,
      pengaturan: dokumenPenetapanService.pengaturanBlangko(),
      akarSipp: dokumenPenetapanService.akarSipp(),
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

router.post("/blangko-penetapan/pengaturan", requireInternalToken, (req, res) => {
  try {
    const badan = req.body || {};
    const sekarang = readRuntimeConfig();
    const lama = sekarang.blangkoPenetapan || {};
    const untai = (kunci) =>
      badan[kunci] === undefined ? String(lama[kunci] || "") : String(badan[kunci] || "").slice(0, 500).trim();

    const baru = {
      aktif: badan.aktif === undefined ? lama.aktif === true : badan.aktif === true,
      pmh: untai("pmh"),
      ppp: untai("ppp"),
      pjs: untai("pjs"),
      phs: untai("phs"),
      akarSipp: untai("akarSipp"),
    };

    writeRuntimeConfig({ ...sekarang, blangkoPenetapan: baru });
    res.json({ ok: true, pengaturan: dokumenPenetapanService.pengaturanBlangko(), akarSipp: baru.akarSipp });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/**
 * Menerbitkan satu dokumen penetapan dan mencatatnya di SIPP.
 *
 * KERING sebagai bawaan - lihat dokumenPenetapanService.terbitkan.
 */
router.post("/dokumen-penetapan/terbitkan", requireInternalToken, async (req, res) => {
  try {
    const badan = req.body || {};
    const hasil = await dokumenPenetapanService.terbitkan({
      perkaraId: badan.perkaraId,
      nomorPerkara: String(badan.nomorPerkara || ""),
      jenis: String(badan.jenis || ""),
      namaPenandatangan: String(badan.namaPenandatangan || ""),
      olehUsername: String(badan.olehUsername || ""),
      kering: badan.kering !== false,
    });
    res.status(hasil.ok ? 200 : 409).json(hasil);
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

/**
 * Keadaan sesi e-Court.
 *
 * ?periksa=penuh memaksa pemeriksaan sungguhan - Chrome dinyalakan, halaman
 * e-Court dimuat. Tanpa itu yang dikembalikan hasil pemeriksaan terakhir
 * beserta umurnya, sehingga membuka layar pengaturan tidak lagi menyalakan
 * Chrome tiap kali.
 */
router.get("/ecourt/login/status", requireInternalToken, async (req, res) => {
  try {
    const penuh = req.query.periksa === "penuh";
    const slot = String(req.query.slot || "");
    const keadaan = await ecourtSesiStatusService.keadaanSlot(slot, { paksa: penuh });
    res.json({
      ok: true,
      // Bentuk lama tetap dikirim supaya pemanggil yang sudah ada tidak
      // rusak; yang baru ada pada `keadaan`.
      sesi: {
        tersimpan: keadaan.tersimpan,
        berlaku: keadaan.keadaan === "berlaku" ? true : keadaan.keadaan === "kedaluwarsa" ? false : null,
        alasan: keadaan.alasan,
        namaPengguna: keadaan.namaPengguna,
      },
      keadaan,
      menunggu: ecourtLoginService.sedangMenunggu(),
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/**
 * Keadaan SELURUH akun e-Court sekaligus.
 *
 * Dipakai layar pengaturan supaya tidak perlu menembak satu permintaan per
 * akun - dan supaya pemeriksaan sungguhannya berjalan berurutan di dalam bot,
 * bukan serentak dari peramban.
 */
router.get("/ecourt/akun/keadaan", requireInternalToken, async (req, res) => {
  try {
    const penuh = req.query.periksa === "penuh";
    const akun = await ecourtSesiStatusService.keadaanSemua({ paksa: penuh });
    res.json({ ok: true, akun, segarDetik: Math.round(ecourtSesiStatusService.SEGAR_MS / 1000) });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/**
 * ============================================================================
 * SIMPANAN SUREL DAN SANDI AKUN e-COURT
 * ============================================================================
 *
 * Rute ini MENULIS dan MENGHAPUS. Tidak ada rute yang membaca sandinya -
 * bahkan tidak dalam bentuk tersandi. Satu-satunya yang membukanya adalah
 * ecourtLoginService, di dalam proses bot, tepat sebelum mengetikkannya ke
 * formulir e-Court.
 */
router.get("/ecourt/kredensial", requireInternalToken, (req, res) => {
  try {
    res.json({
      ok: true,
      // daftar() memang tidak memuat sandi - lihat ecourtKredensialService.
      kredensial: ecourtKredensialService.daftar(),
      keadaan: ecourtKredensialService.keadaan(),
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

router.post("/ecourt/kredensial", requireInternalToken, (req, res) => {
  try {
    const hasil = ecourtKredensialService.simpan({
      slot: String(req.body?.slot || ""),
      email: String(req.body?.email || ""),
      sandi: String(req.body?.sandi || ""),
      olehSiapa: String(req.body?.olehSiapa || ""),
    });
    if (hasil.ok) ecourtSesiStatusService.lupakan(String(req.body?.slot || ""));
    res.status(hasil.ok ? 200 : 400).json(hasil);
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

router.delete("/ecourt/kredensial", requireInternalToken, (req, res) => {
  try {
    const hasil = ecourtKredensialService.hapus({
      slot: String(req.query.slot || req.body?.slot || ""),
      olehSiapa: String(req.body?.olehSiapa || ""),
    });
    if (hasil.ok) ecourtSesiStatusService.lupakan(String(req.query.slot || ""));
    res.status(hasil.ok ? 200 : 400).json(hasil);
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/** Membuka halaman login e-Court dan mengambil gambar captchanya. */
router.post("/ecourt/login/mulai", requireInternalToken, async (req, res) => {
  try {
    const hasil = await ecourtLoginService.mulaiLogin({ slot: String(req.body?.slot || "") });
    ecourtSesiStatusService.lupakan(String(req.body?.slot || ""));
    res.status(hasil.ok ? 200 : 400).json(hasil);
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/**
 * Mengirimkan email, sandi, dan jawaban captcha ke e-Court.
 *
 * Badan permintaan ini memuat SANDI. Karena itu tidak ada satu pun bagiannya
 * yang dicatat: bukan ke log akses, bukan ke pesan galat, bukan ke jejak
 * keamanan. Yang tercatat hanya berhasil atau tidaknya.
 */
router.post("/ecourt/login/kirim", requireInternalToken, async (req, res) => {
  try {
    const hasil = await ecourtLoginService.kirimLogin({
      email: String(req.body?.email || ""),
      sandi: String(req.body?.sandi || ""),
      captcha: String(req.body?.captcha || ""),
    });
    res.status(hasil.ok ? 200 : 400).json(hasil);
  } catch (error) {
    // Pesan galat sengaja tidak diteruskan: dapat memuat potongan badan
    // permintaan, dan badan permintaan ini memuat sandi.
    res.status(500).json({ ok: false, alasan: "gagal_memproses_login" });
  }
});

/** Menghapus sesi e-Court tersimpan. */
router.post("/ecourt/login/keluar", requireInternalToken, (req, res) => {
  try {
    const hasil = ecourtLoginService.keluar({ slot: String(req.body?.slot || "") });
    res.json({ ok: hasil.ok, alasan: hasil.alasan || "" });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/**
 * Konteks ALETA untuk satu perkara, dipakai ekstensi peramban di halaman SIPP.
 *
 * HANYA MEMBACA. Tidak menyentuh SIPP sama sekali.
 */
router.get("/sipp/konteks", requireInternalToken, async (req, res) => {
  try {
    const hasil = await sippKonteksService.getKonteks(String(req.query.nomor || ""), {
      // Nama pembuka datang dari portal yang sudah mengautentikasi penggunanya.
      // Dipakai HANYA untuk menentukan tombol verifikasi tampil atau tidak.
      namaPembuka: String(req.query.nama || ""),
    });
    res.status(hasil.ok ? 200 : 400).json(hasil);
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/**
 * Kebiasaan satker menulis Obyek Sengketa untuk jenis perkara yang sama.
 *
 * Baca saja. Ejaan dipulangkan apa adanya beserta jumlahnya; yang
 * menggabungkan variannya adalah portal, di tempat yang dapat diuji.
 */
/**
 * ============================================================================
 * GERBANG UKUR DAFTAR DETEKSI (K13) - HANYA MEMBACA SIPP
 * ============================================================================
 *
 * {jenis:'ciri', calon[], dasar?[], benih?}  ciriDariKalimat tanpa/dengan calon
 *                                            atas posita cerai 2024+;
 * {jenis:'sebutan', batas?}                  sampel 300 putusan terbaru;
 * {jenis:'padanan', nama}                    nama ada di jenis_perkara_nama?
 *
 * Tidak menulis apa pun; hasil_ukur disimpan portal. Masukan yang salah 400,
 * tabel yang tidak terbaca 500 dengan namanya - bukan jawaban kosong.
 */
const ukurTipeService = require("../services/ukurTipeService");

router.post("/sipp/ukur-tipe", requireInternalToken, async (req, res) => {
  try {
    const badan = req.body && typeof req.body === "object" ? req.body : {};
    const hasil = await ukurTipeService.ukur({
      jenis: String(badan.jenis || ""),
      calon: Array.isArray(badan.calon) ? badan.calon.slice(0, 20) : [],
      dasar: Array.isArray(badan.dasar) ? badan.dasar.slice(0, 400) : null,
      benih: String(badan.benih || "").slice(0, 200),
      batas: badan.batas,
      nama: String(badan.nama || "").slice(0, 120),
    });
    res.status(hasil.ok ? 200 : 400).json(hasil);
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

router.get("/sipp/obyek-sengketa/kebiasaan", requireInternalToken, async (req, res) => {
  try {
    const hasil = await obyekSengketaService.kebiasaan(String(req.query.nomor || ""));
    res.status(hasil.ok ? 200 : 400).json(hasil);
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/**
 * ============================================================================
 * PRAPERIKSA PUTUSAN - FAKTA (Tahap 2 rencana agen)
 * ============================================================================
 *
 * HANYA MEMBACA. Seluruh fakta SIPP untuk satu perkara dalam satu jawaban:
 * jadwal sidang, majelis tercatat, pihak dan anak, putusan yang sudah ada,
 * petitum, keikutsertaan e-Court. Yang menimbangnya terhadap draf adalah
 * portal - di sinilah datanya, di sanalah drafnya dan aturannya.
 *
 * `tanggal` (YYYY-MM-DD) adalah tanggal putusan yang SEDANG diusulkan borang;
 * dipakai hanya untuk menyertakan keterangan hari liburnya.
 */
router.get("/sipp/praperiksa-putusan/fakta", requireInternalToken, async (req, res) => {
  try {
    const hasil = await praperiksaPutusanService.bacaFakta(String(req.query.nomor || ""), {
      tanggal: String(req.query.tanggal || ""),
    });
    res.status(hasil.ok ? 200 : 400).json(hasil);
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/**
 * Pendapat AI atas amar vs petitum - DISAMARKAN lebih dulu, lewat jalur
 * "perkara" yang gerbangnya menolak muatan tanpa bukti penyamaran.
 *
 * Jawabannya selalu 200: { ok: false, alasan } adalah jawaban yang sah -
 * jalur belum disetel, penyamaran menyisakan nama, penyedia gagal - dan
 * portal menuliskannya sebagai "pendapat AI dilewati", bukan sebagai galat.
 * Pendapat AI tidak pernah menahan penulisan; yang menahan hanya
 * pertentangan yang dibuktikan dari SIPP.
 */
router.post("/sipp/praperiksa-putusan/pendapat", requireInternalToken, async (req, res) => {
  try {
    const hasil = await praperiksaPutusanService.pendapatAi(req.body || {});
    res.status(200).json(hasil);
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/**
 * Mengunduh satu berkas dokumen e-Court.
 *
 * Jalur berkasnya diperiksa berada di dalam folder arsip tepat sebelum dibaca,
 * sehingga baris database yang keliru pun tidak dapat menyerahkan berkas lain
 * di server.
 */
/** Daftar perkara beserta keadaan berkasnya - tabel utama kendali arsip. */
router.get("/ecourt/arsip/perkara", requireInternalToken, async (req, res) => {
  try {
    const hasil = await ecourtStoreService.daftarArsipPerkara({
      cari: String(req.query.cari || ""),
      hanyaBelumLengkap: String(req.query.belumLengkap || "") === "1",
      urutkan: String(req.query.urutkan || "terakhir"),
      // Arah dikirim terpisah dari kuncinya. Kosong berarti pemanggil lama yang
      // masih memakai nama urutan gabungan ("terlama", "belumTerbanyak") -
      // diterjemahkan di layanan lewat URUTAN_LAMA, bukan di sini.
      arah: String(req.query.arah || ""),
      batas: Number(req.query.batas) || 100,
      mulai: Number(req.query.mulai) || 0,
    });
    res.json({ ok: true, ...hasil });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/** Rincian dokumen satu perkara - dibuka saat satu baris dipilih. */
router.get("/ecourt/arsip/rincian", requireInternalToken, async (req, res) => {
  try {
    const hasil = await ecourtStoreService.rincianArsipPerkara(String(req.query.nomor || ""));
    res.json({ ok: true, ...hasil });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/** Ringkasan singkat untuk BANYAK perkara sekaligus - penanda baris daftar. */
router.post("/sipp/ringkasan-massal", requireInternalToken, async (req, res) => {
  try {
    const daftar = Array.isArray(req.body?.nomorPerkara) ? req.body.nomorPerkara : [];
    const hasil = await sippKonteksService.ringkasanMassal(daftar);
    res.json({ ok: true, ...hasil });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

// ============================================================================
// PENYARING MASUKAN /abt/usulan (kontrak K6)
// ============================================================================
//
// Semua yang dibaca rute /abt/usulan adalah masukan dari peramban yang
// diteruskan portal. Portal sudah menyaringnya sekali; di sini disaring lagi,
// sebab rute internal ini dapat dipanggil selain lewat portal. Dua pagar.
//
// Yang ditolak TIDAK dibuang diam-diam: disebut pada jawaban
// (tipeKeluaranDitolak, saksiDitolak) beserta sebabnya.

// Diambil di sini, bukan di kepala berkas: hunk rute ini milik satu pekerjaan,
// dan kepala berkas disunting putaran lain.
const abtUsulanLainService = require("../services/abtUsulanLainService");

/** Modus satu saksi. Sebutan pencerita (sumberNama) ikut diteruskan. */
function saringModusAbt(m) {
  const r = m && typeof m === "object" ? m : {};
  return {
    modus: String(r.modus || "").slice(0, 20),
    sumber: String(r.sumber || "").slice(0, 20),
    // ========================================================================
    // SEBUTAN PENCERITA - DAHULU DIBUANG DI SINI
    // ========================================================================
    //
    // Ekstensi mengirim sebutan pihak yang bercerita apa adanya ("Penggugat",
    // "Tergugat", "keluarga mereka") supaya bot tidak menafsirkan kodenya.
    // Penyaring ini dahulu hanya meloloskan modus/sumber/alasan, sehingga
    // sebutan itu hilang dan bot jatuh ke tafsiran kode: pilihan "cerita
    // dari Penggugat" menjadi "Tergugat bercerita" di berita acara.
    sumberNama: String(r.sumberNama || "").replace(/\s+/g, " ").trim().slice(0, 40),
    alasan: Array.isArray(r.alasan) ? r.alasan.map((x) => String(x).slice(0, 80)).slice(0, 12) : [],
  };
}

/**
 * Kode pencerita penggugat/tergugat tanpa sebutan (ekstensi yang tidak
 * mengirim sumberNama) diterjemahkan di sini dengan sebutan halaman itu
 * sendiri. pelaku = 0047 = Tergugat/Termohon; lawan = 0046 =
 * Penggugat/Pemohon. Kode lama "pelaku"/"lawan" dibiarkan kepada layanan -
 * artinya bagi ekstensi lama memang terbalik, dan layanan sudah menanganinya.
 */
function lengkapiSumberNamaAbt(m, pelaku, lawan) {
  if (m.sumberNama) return m;
  if (m.sumber === "penggugat") return { ...m, sumberNama: lawan || "Penggugat" };
  if (m.sumber === "tergugat") return { ...m, sumberNama: pelaku || "Tergugat" };
  return m;
}

/* === SAKSI-N 12 Okt === */
// Total saksi satu permintaan: sampai 5 saksi P + 4 saksi T (BATAS_SAKSI_SDG di abtUsulanService). Dahulu 6.
const BATAS_SAKSI_PIHAK_ABT = Object.freeze({ P: 5, T: 4 });
const BATAS_SAKSI_ABT = BATAS_SAKSI_PIHAK_ABT.P + BATAS_SAKSI_PIHAK_ABT.T;
/* === AKHIR SAKSI-N === */

/** Daftar saksi N (kontrak K6): {ke, pihak 'P'|'T', modus, sumber, sumberNama, alasan}. */
function saringSaksiAbt(masuk, pelaku, lawan) {
  if (!Array.isArray(masuk)) return { saksi: [], ditolak: [] };
  const saksi = [];
  const ditolak = [];
  masuk.forEach((s, indeks) => {
    const r = s && typeof s === "object" ? s : {};
    const pihak = String(r.pihak || "").toUpperCase();
    const ke = Number(r.ke);
    if (pihak !== "P" && pihak !== "T") {
      ditolak.push({ indeks, alasan: "pihak_bukan_P_atau_T" });
      return;
    }
    if (!Number.isInteger(ke) || ke < 1 || ke > BATAS_SAKSI_PIHAK_ABT[pihak]) {
      ditolak.push({ indeks, alasan: `ke_di_luar_1_sampai_${BATAS_SAKSI_PIHAK_ABT[pihak]}` });
      return;
    }
    if (saksi.length >= BATAS_SAKSI_ABT) {
      ditolak.push({ indeks, alasan: `lebih_dari_${BATAS_SAKSI_ABT}_saksi` });
      return;
    }
    saksi.push({ ke, pihak, ...lengkapiSumberNamaAbt(saringModusAbt(r), pelaku, lawan) });
  });
  return { saksi, ditolak };
}

/**
 * Penanda yang sah per daftar tipe keluaran yang dipakai bot - sama dengan
 * `penanda` registri portal (src/lib/tipe-keluaran/kontrak.ts, DAFTAR_TIPE);
 * ujinya membandingkan keduanya. Daftar di luar peta ini ditolak.
 *
 * Untuk 'bentuk', #dddd# yang sah hanya #0046#, #0047#, dan yang ada di
 * bentuk dasarnya - templat ABT yang dikirim bersama permintaan ini. Varian
 * tidak boleh memunculkan sebutan yang tidak pernah ada di templatnya.
 */
const PENANDA_TIPE_BOT = Object.freeze({
  "bas.saksi.pembuka": Object.freeze([]),
  "bas.saksi.ragam-kata": Object.freeze([]),
  // {jawab} sejak butir 27: jawaban templat yang sudah diisi dari gugatan.
  "bas.saksi.jawaban-modus": Object.freeze(["{sumber}", "{daftar}", "{isi}", "{jawab}"]),
  "bas.saksi.bentuk": Object.freeze(["{slot}", "#0046#", "#0047#"]),
  "bas.saksi.profil": Object.freeze([]),
  "bersama.alasan.frasa": Object.freeze(["{pelaku}", "{lawan}"]),
  "putusan.alasan.ciri": Object.freeze([]),
  "putusan.upaya-damai.bunyi": Object.freeze(["{pelaku}", "{lawan}"]),
});
const BATAS_ENTRI_TIPE_ABT = 200;
// Butir 9 (13 Okt 2026): jawaban-modus bawaannya 280 kalimat (20 bank x 14) - cermin abtUsulanService BATAS_ENTRI_KHUSUS.
const BATAS_ENTRI_KHUSUS_ABT = Object.freeze({ "bas.saksi.jawaban-modus": 400 });
const BATAS_TEKS_TIPE_ABT = 400;
const BATAS_DATA_TIPE_ABT = 4000;

/** Sebab sebuah teks entri ditolak, atau "". */
function periksaTeksTipeAbt(teks, sah) {
  if (teks.length > BATAS_TEKS_TIPE_ABT) return `lebih_dari_${BATAS_TEKS_TIPE_ABT}_huruf`;
  if (teks.includes("${")) return "memuat_${";
  if (teks.includes("<")) return "memuat_<";
  if (/[\r\n]/.test(teks)) return "memuat_ganti_baris";
  if (sah) {
    for (const p of teks.match(/\{[^{}]*\}|#\d{4}#/g) || []) {
      if (!sah.has(p)) return `penanda_asing:${p.slice(0, 40)}`;
    }
    if (/[{}]/.test(teks.replace(/\{[^{}]*\}/g, ""))) return "kurung_kurawal_lepas";
  }
  return "";
}

/** Seluruh string di dalam data, sedalam apa pun. */
function stringDiDalamTipeAbt(nilai, keluar) {
  if (typeof nilai === "string") keluar.push(nilai);
  else if (Array.isArray(nilai)) for (const x of nilai) stringDiDalamTipeAbt(x, keluar);
  else if (nilai && typeof nilai === "object") for (const x of Object.values(nilai)) stringDiDalamTipeAbt(x, keluar);
  return keluar;
}

function periksaEntriTipeAbt(e, sah) {
  if (!e || typeof e !== "object" || Array.isArray(e)) return "bukan_objek";
  const salahKunci = periksaTeksTipeAbt(String(e.kunci === undefined || e.kunci === null ? "" : e.kunci), null);
  if (salahKunci) return `kunci_${salahKunci}`;
  const salahNilai = periksaTeksTipeAbt(String(e.nilai === undefined || e.nilai === null ? "" : e.nilai), sah);
  if (salahNilai) return `nilai_${salahNilai}`;
  if (e.data !== undefined && e.data !== null) {
    if (typeof e.data !== "object" || Array.isArray(e.data)) return "data_bukan_objek";
    let panjang = 0;
    try {
      panjang = JSON.stringify(e.data).length;
    } catch (_galat) {
      return "data_tidak_dapat_dibaca";
    }
    if (panjang > BATAS_DATA_TIPE_ABT) return `data_lebih_dari_${BATAS_DATA_TIPE_ABT}_huruf`;
    for (const s of stringDiDalamTipeAbt(e.data, [])) {
      const salah = periksaTeksTipeAbt(s, sah);
      if (salah) return `data_${salah}`;
    }
  }
  return "";
}

/**
 * Menyaring tipeKeluaran kiriman portal (K6). Tanpa tipeKeluaran, atau bila
 * sebuah daftar tidak ada, pemakainya memakai konstanta tertanam.
 *
 * @returns {{tipeKeluaran: object|undefined, ditolak: {daftar, kunci, alasan, jumlah?}[]}}
 */
function saringTipeKeluaranAbt(tipe, templat) {
  const ditolak = [];
  if (tipe === undefined || tipe === null) return { tipeKeluaran: undefined, ditolak };
  if (typeof tipe !== "object" || !tipe.daftar || typeof tipe.daftar !== "object" || Array.isArray(tipe.daftar)) {
    ditolak.push({ daftar: "", kunci: "", alasan: "bentuk_tipeKeluaran_tidak_dikenal" });
    return { tipeKeluaran: undefined, ditolak };
  }
  const penandaDasar = new Set();
  for (const b of Array.isArray(templat) ? templat : []) {
    const r = b && typeof b === "object" ? b : {};
    for (const p of `${String(r.tanya || "")} ${String(r.jawab || "")}`.match(/#\d{4}#/g) || []) penandaDasar.add(p);
  }
  const daftar = {};
  for (const [kunciDaftar, mentah] of Object.entries(tipe.daftar)) {
    if (!Object.prototype.hasOwnProperty.call(PENANDA_TIPE_BOT, kunciDaftar)) {
      ditolak.push({ daftar: String(kunciDaftar).slice(0, 80), kunci: "", alasan: "daftar_tidak_dikenal" });
      continue;
    }
    if (!Array.isArray(mentah)) {
      ditolak.push({ daftar: kunciDaftar, kunci: "", alasan: "daftar_bukan_larik" });
      continue;
    }
    const sah = new Set(PENANDA_TIPE_BOT[kunciDaftar]);
    if (kunciDaftar === "bas.saksi.bentuk") for (const p of penandaDasar) sah.add(p);
    const bersih = [];
    const batasEntri = BATAS_ENTRI_KHUSUS_ABT[kunciDaftar] || BATAS_ENTRI_TIPE_ABT;
    mentah.slice(0, batasEntri).forEach((e) => {
      const alasan = periksaEntriTipeAbt(e, sah);
      if (!alasan) {
        bersih.push(e);
        return;
      }
      const kunci = e && typeof e === "object" ? String(e.kunci === undefined || e.kunci === null ? "" : e.kunci) : "";
      ditolak.push({ daftar: kunciDaftar, kunci: kunci.slice(0, 80), alasan });
    });
    if (mentah.length > batasEntri) {
      ditolak.push({
        daftar: kunciDaftar,
        kunci: "",
        alasan: `lebih_dari_${batasEntri}_entri`,
        jumlah: mentah.length - batasEntri,
      });
    }
    daftar[kunciDaftar] = bersih;
  }
  return { tipeKeluaran: { versi: String(tipe.versi || "").slice(0, 32), daftar }, ditolak };
}

/**
 * Usulan isian untuk blangko ABT.
 *
 * Menghasilkan usulan saja - tidak menulis apa pun, tidak ke SIPP maupun ke
 * aps_badilag. Yang menuliskannya ke ABT adalah ekstensi di peramban petugas,
 * lewat rute simpan milik ABT sendiri, sesudah petugas memeriksanya.
 */
/* === JENIS3 11 Okt === */
// Deteksi per jenis perkara non-cerai (kamus per jenis) - lihat services/deteksiJenisPerkaraService.js.
const { tambahUsulanJenis, lengkapiSaksiJenis } = require("../services/deteksiJenisPerkaraService");
/* === AKHIR JENIS3 === */
router.post("/abt/usulan", requireInternalToken, async (req, res) => {
  try {
    const nomorPerkara = String(req.body?.nomorPerkara || "");
    const sumber = String(req.body?.sumber || "semua");
    const pelaku = String(req.body?.pelaku || "").slice(0, 40);
    const lawan = String(req.body?.lawan || "").slice(0, 40);
    const templatMasuk = Array.isArray(req.body?.templat) ? req.body.templat.slice(0, 60) : [];

    // Pengaturan tipe keluaran dari portal (K6), disaring sebelum sampai ke
    // penyusun mana pun. Tanpa itu penyusun memakai konstanta tertanam.
    const tipe = saringTipeKeluaranAbt(req.body?.tipeKeluaran, templatMasuk);

    const jawaban = {
      ok: true,
      sipp: null,
      saksi: null,
      itsbat: null,
      saksiSdg: null,
      isiJawaban: null,
      positaLain: null,
      alasanPosita: null,
      // Yang dipakai penyusun, bukan yang diminta: portal menyebut asalnya
      // 'portal' hanya bila bot sungguh menerimanya.
      tipeKeluaranDiterima: Boolean(tipe.tipeKeluaran),
    };

    /* === U6 20 Okt === */
    // Fakta bersama satu perkara (faktaPerkara): tanya jawab saksi/BAS membaca nilai yang SAMA dengan Blangko Derry dan putusan.
    // Dihitung sekali per permintaan, hanya bila dibutuhkan; memakai usulan dariSipp yang sudah ada (tanpa bacaan ulang) dan
    // data SIPP saksi yang sudah dibaca. Gagal = null (jawaban saksi tetap dari sumber sendiri).
    let janjiFaktaBersama = null;
    const faktaBersama = (sippSaksiAda) => {
      if (!janjiFaktaBersama) {
        janjiFaktaBersama = nomorPerkara
          ? Promise.race([
              require("../services/faktaPerkara").faktaPerkara(nomorPerkara, {
                usulan: jawaban.sipp && Array.isArray(jawaban.sipp.usulan) ? jawaban.sipp.usulan : undefined,
                tanpaDariSipp: !(jawaban.sipp && Array.isArray(jawaban.sipp.usulan)),
                tanpaBas: true,
                pelaku,
                lawan,
                isian: req.body?.isian,
                ...(sippSaksiAda ? { sippSaksi: sippSaksiAda } : {}),
              }),
              new Promise((selesai) => setTimeout(() => selesai(null), 4000)),
            ]).catch(() => null)
          : Promise.resolve(null);
      }
      return janjiFaktaBersama;
    };
    /* === AKHIR U6 === */
    if (sumber === "semua" || sumber === "sipp") {
      jawaban.sipp = await abtUsulanService.dariSipp(nomorPerkara).catch((galat) => ({
        ok: false,
        alasan: String(galat.message || galat).slice(0, 200),
        usulan: [],
      }));
      /* === U6 20 Okt === */
      // Kode setara: koreksi petugas di satu blangko diteruskan ke kode lain yang menyimpan fakta yang sama (hanya mengisi yang
      // kosong - jagaIsianLama). Gerbang keyakinan (gerbangIsian) diterapkan sesudahnya pada seluruh usulan.
      if (jawaban.sipp && jawaban.sipp.ok && Array.isArray(jawaban.sipp.usulan)) {
        try {
          const fb = await faktaBersama();
          for (const u of (fb && fb.usulanSetara) || []) {
            const i = jawaban.sipp.usulan.findIndex((x) => x && x.kode === u.kode);
            if (i < 0) jawaban.sipp.usulan.push(u);
            else if (!String(jawaban.sipp.usulan[i].nilai || "").trim()) jawaban.sipp.usulan[i] = u;
          }
        } catch (_galat) {
          /* kode setara bersifat tambahan */
        }
      }
      /* === AKHIR U6 === */
    }
    // Itsbat nikah - fakta pernikahan dari posita permohonan. Positanya
    // dikirim ekstensi dari halaman ABT (variabel 5125), bukan dibaca dari
    // basis data aps_badilag: aturan "ALETA tidak membaca aps_badilag" tetap.
    if (sumber === "itsbat") {
      const itsbat = abtUsulanService.dariPositaItsbat(String(req.body?.posita || ""), {
        // Sebutan pemohon = variabel 0046. Dahulu yang dipakai `pelaku`
        // (0047 = Termohon), sehingga labelnya "Status Termohon sebelum
        // nikah". `pelaku` tinggal cadangan bagi ekstensi yang belum
        // mengirim `pemohon`.
        pemohon: String(req.body?.pemohon || req.body?.pelaku || "").slice(0, 40),
        pemohon2: String(req.body?.pemohon2 || ""),
      });
      // Variabel yang bawaan ABT-nya terukur lebih tepat dikirim sebagai tawaran
      // ABT, bukan usulan ALETA - lihat GERBANG_ITSBAT di abtUsulanLainService
      // (sejak ukur ulang 13 Okt 2026 ke-14 variabel itsbat diusulkan ALETA).
      jawaban.itsbat = abtUsulanLainService.saringUsulanItsbat(itsbat, String(req.body?.jenisPerkara || "").slice(0, 80));
      /* === JENIS3 11 Okt === */
      // Variabel itsbat tambahan dari kamus per jenis (8171 tujuan itsbat, 1357 alasan wali, 1025
      // pasangan wafat). Pola "ragu" dikirim keyakinan "ragu" - tampil TIDAK tercentang.
      try {
        jawaban.itsbat = tambahUsulanJenis(jawaban.itsbat, String(req.body?.posita || ""), {
          jenisPerkara: String(req.body?.jenisPerkara || "").slice(0, 80) || "360",
          alur: String(req.body?.alur || "").slice(0, 20),
        });
      } catch (_galatJenis) {
        // tambahan per jenis tidak pernah menggagalkan usulan itsbat
      }
      /* === AKHIR JENIS3 === */
      /* === ITSBAT KONTENTIUS 13 Okt (agen V) === */
      // Pasangan yang telah meninggal (1025/1246/1247/1509, blangko "2a Itsbat Nikah Kontensius"): "ragu", tidak
      // tercentang - isian manusia baru 7 perkara. Hanya kode yang belum ada.
      try {
        const f = require("../services/deteksi/itsbat").deteksi(String(req.body?.posita || ""), {});
        const it = jawaban.itsbat;
        if (it && Array.isArray(it.usulan)) {
          for (const kode of ["1025", "1246", "1247", "1509"]) {
            if (!f[kode] || it.usulan.some((u) => u && u.kode === kode)) continue;
            it.usulan.push({
              kode,
              nama: { 1025: "Nama almarhum/almarhumah", 1246: "Tanggal meninggal", 1247: "Sebab meninggal", 1509: "Tempat meninggal" }[kode],
              nilai: f[kode].nilai,
              keyakinan: "ragu",
              bentrok: "",
              catatan: "pasangan yang telah meninggal (itsbat kontentius) - periksa kalimat sumbernya",
              dihitung: false,
              sumber: [{ saksi: 0, asal: "posita", kalimat: String(f[kode].kalimat).slice(0, 400) }],
            });
          }
        }
      } catch (_galatKontentius) {
        // tidak pernah menggagalkan usulan itsbat
      }
      /* === AKHIR ITSBAT KONTENTIUS === */
      /* === ISTRI SEBELUMNYA 14 Okt (agen T2) === */
      // Blangko [99aa] Cerai Hidup/Mati Pasangan Sebelumnya: 1021 nama (posita, atau SIPP dari nomor akta cerai PA.Dgl
      // yang disebut posita - HANYA SELECT), 5015/5016 tanggal & sebab meninggal. Lihat deteksi/sambungItsbatPasangan.js.
      try {
        jawaban.itsbat = await require("../services/deteksi/sambungItsbatPasangan").lengkapiIstriSebelumnya(jawaban.itsbat, {
          posita: String(req.body?.posita || ""),
          nomorPerkara,
        });
      } catch (_galatIstriDulu) {
        // tidak pernah menggagalkan usulan itsbat
      }
      /* === AKHIR ISTRI SEBELUMNYA === */
      /* === F2.3 BLANGKO DERRY 16 Okt === */
      // Akta cerai Pemohon I/II (1321-1331); pada Penetapan Ahli Waris/Kewarisan (blangkonya memuat #5197#
      // sehingga jalur ini ikut dipanggil) kode pewaris diganti bacaan waris.js. Jenis dari SIPP (HANYA SELECT).
      try {
        jawaban.itsbat = await require("../services/deteksi/blangkoDerry").lengkapiJenis(jawaban.itsbat, {
          jalur: "itsbat",
          posita: String(req.body?.posita || ""),
          jenisPerkara: String(req.body?.jenisPerkara || "").slice(0, 80),
          nomorPerkara,
        });
      } catch (_galatDerry) {
        // tidak pernah menggagalkan usulan itsbat
      }
      /* === AKHIR F2.3 === */
    }
    // Perkara lain (dispensasi kawin, perwalian, asal usul, harta bersama) -
    // variabel blangko dari posita permohonan, hanya yang lulus gerbang ukur.
    /* === DK 13 Okt === */
    // Blangko BAS dispensasi kawin tidak memuat 5125: ekstensi mengirim posita
    // kosong dan posita dibaca dari SIPP (HANYA SELECT, 2,5 detik).
    if (sumber === "posita-lain") {
      req.body.posita = await require("../services/deteksiDispensasiKawinService")
        .positaCadanganSipp(req.body)
        .catch(() => String(req.body?.posita || ""));
    }
    /* === AKHIR DK === */
    if (sumber === "posita-lain") {
      jawaban.positaLain = abtUsulanLainService.dariPositaLain(String(req.body?.posita || ""), {
        jenisPerkara: String(req.body?.jenisPerkara || "").slice(0, 80),
        alur: String(req.body?.alur || "").slice(0, 20),
        sebutan: {
          pelaku,
          lawan,
          pemohon: String(req.body?.pemohon || "").slice(0, 40),
          pemohon2: String(req.body?.pemohon2 || "").slice(0, 40),
        },
        tipeKeluaran: tipe.tipeKeluaran,
      });
      /* === JENIS3 11 Okt === */
      // Semua jenis non-cerai (ahli waris, wali adhol, poligami, harta bersama, ekonomi syariah, ...):
      // variabel dari kamus per jenis ditambahkan; jenis yang dulu "tidak dilayani" kini dijawab.
      try {
        jawaban.positaLain = tambahUsulanJenis(jawaban.positaLain, String(req.body?.posita || ""), {
          jenisPerkara: String(req.body?.jenisPerkara || "").slice(0, 80),
          alur: String(req.body?.alur || "").slice(0, 20),
        });
      } catch (_galatJenis) {
        // tambahan per jenis tidak pernah menggagalkan usulan perkara lain
      }
      /* === AKHIR JENIS3 === */
      /* === PWH 13 Okt (butir 16) === */
      // Izin poligami, harta bersama, kewarisan, penetapan ahli waris: modul deteksi/<jenis>.js dari
      // posita + petitum + SIPP (alasan & penghasilan poligami, nama pemohon) - SIPP hanya dibaca.
      try {
        const pwh = require("../services/deteksi/sambunganPwh");
        const jenisMasuk = String(req.body?.jenisPerkara || "").slice(0, 80);
        const sippPwh = nomorPerkara ? await pwh.bacaSipp(nomorPerkara).catch(() => null) : null;
        if (pwh.idJenis(jenisMasuk) || (sippPwh && pwh.JENIS_PWH.has(sippPwh.jenisPerkaraId))) {
          jawaban.positaLain = pwh.tambahUsulanPwh(jawaban.positaLain, String(req.body?.posita || ""), {
            jenisPerkara: jenisMasuk,
            alur: String(req.body?.alur || "").slice(0, 20),
            sipp: sippPwh,
          });
        }
      } catch {
        // modul per jenis tidak pernah menggagalkan usulan perkara lain
      }
      /* === AKHIR PWH === */
      /* === DETEKSI-Y 13 Okt === */
      // Modul per jenis (perwalian, asal usul, pengangkatan anak, wali adhol, hadhanah, Lain-Lain 369):
      // posita + petitum/pihak dari SIPP (HANYA SELECT) - lihat services/deteksi/sambungPositaLain.js.
      try {
        jawaban.positaLain = await require("../services/deteksi/sambungPositaLain").lengkapiPositaLain(jawaban.positaLain, {
          posita: String(req.body?.posita || ""),
          nomorPerkara,
          jenisPerkara: String(req.body?.jenisPerkara || "").slice(0, 80),
          alur: String(req.body?.alur || "").slice(0, 20),
        });
      } catch (_galatY) {
        // deteksi per jenis tidak pernah menggagalkan usulan perkara lain
      }
      /* === AKHIR DETEKSI-Y === */
    }
    /* === DK 13 Okt === */
    // Dispensasi kawin: peran anak/calon pasangan, umur, identitas, kehamilan,
    // perkenalan, puskesmas - lihat services/deteksiDispensasiKawinService.js.
    if (sumber === "posita-lain") {
      try {
        jawaban.positaLain = require("../services/deteksiDispensasiKawinService").lengkapiUsulanDk(
          jawaban.positaLain,
          String(req.body?.posita || ""),
          { jenisPerkara: String(req.body?.jenisPerkara || "").slice(0, 80) }
        );
      } catch (_galatDk) {
        // tambahan DK tidak pernah menggagalkan usulan perkara lain
      }
    }
    /* === AKHIR DK === */
    /* === F2.3 BLANGKO DERRY 16 Okt === */
    // Variabel blangko Derry yang belum dibaca modul jenisnya: wali adhal 9201/9203/9204/9206, sita
    // 9161-9163 (harta bersama, kewarisan), bagian waris 8719 hanya bila tertulis. Semua "ragu".
    if (sumber === "posita-lain") {
      try {
        jawaban.positaLain = await require("../services/deteksi/blangkoDerry").lengkapiJenis(jawaban.positaLain, {
          jalur: "posita-lain",
          posita: String(req.body?.posita || ""),
          jenisPerkara: String(req.body?.jenisPerkara || "").slice(0, 80),
          nomorPerkara,
        });
      } catch (_galatDerry) {
        // tidak pernah menggagalkan usulan perkara lain
      }
    }
    /* === AKHIR F2.3 === */
    // Butir 12 (6 Okt 2026): alasan yang terbaca dari posita - SUMBER YANG SAMA
    // dengan "Alasan yang dipakai" penyusun saksi (alasanDariPosita) - supaya
    // centang modus "Hanya sebagian alasan" dapat mendahulukan alasan yang
    // sesuai posita sebelum keterangan disusun. Posita dari ekstensi (5125),
    // atau dari SIPP bila tidak dikirim (HANYA SELECT, 2,5 detik).
    if (sumber === "alasan-posita") {
      const positaMasuk = String(req.body?.posita || "");
      const positaKurang = positaMasuk.replace(/<[^>]*>/g, " ").trim().length < 50;
      const konteksSipp =
        positaKurang && nomorPerkara ? await abtUsulanService.konteksPerkaraSaksi(nomorPerkara).catch(() => null) : null;
      const positaSipp = konteksSipp && konteksSipp.posita ? konteksSipp.posita : "";
      const positaDipakai = positaKurang && positaSipp ? positaSipp : positaMasuk;
      const terbaca = positaDipakai.replace(/<[^>]*>/g, " ").trim().length >= 50;
      jawaban.alasanPosita = {
        ok: terbaca,
        alasan: terbaca ? abtUsulanService.alasanDariPosita(positaDipakai) : [],
        asalPosita: !terbaca ? "" : positaDipakai === positaSipp ? "sipp" : "ekstensi",
      };
    }
    // 20 Okt 2026: "isi-jawaban" - mengisi baris tanya jawab apa saja (susunan katalog jenis perkara) dari isian blangko >
    // data SIPP > posita; kontrak {teks, yakin, sumber, ket} per kunci. HANYA SELECT ke SIPP, 2,5 detik.
    if (sumber === "isi-jawaban") {
      const isiSumber = require("../services/isiJawabanSaksiService");
      const positaMasuk = String(req.body?.posita || "");
      const positaKurang = positaMasuk.replace(/<[^>]*>/g, " ").trim().length < 50;
      // 21 Okt 2026 (W2a-K1): gugatan harta bersama dan kewarisan juga dibaca PETITUM-nya (daftar objek dan ahli waris ada di petitum)
      const perluPetitum = /\b(?:348|364)\b|harta\s*bersama|waris/i.test(String(req.body?.jenisPerkara || "") + " " + String(req.body?.kunciKatalog || ""));
      const [konteksSipp, sippSaksi, alamatPihakSipp] = await Promise.all([
        (positaKurang || perluPetitum) && nomorPerkara ? abtUsulanService.konteksPerkaraSaksi(nomorPerkara).catch(() => null) : null,
        nomorPerkara ? isiSumber.bacaSippSaksi(nomorPerkara).catch(() => null) : null,
        nomorPerkara && typeof abtUsulanService.alamatPihakPerkara === "function" ? abtUsulanService.alamatPihakPerkara(nomorPerkara).catch(() => null) : null,
      ]);
      jawaban.isiJawaban = isiSumber.isiBaris({
        posita: positaKurang && konteksSipp && konteksSipp.posita ? konteksSipp.posita : positaMasuk,
        jenisPerkara: String(req.body?.jenisPerkara || "").slice(0, 80),
        alur: String(req.body?.alur || "").slice(0, 20),
        kunciKatalog: String(req.body?.kunciKatalog || "").slice(0, 60),
        petitum: String(req.body?.petitum || (konteksSipp && konteksSipp.petitum) || "").slice(0, 60000),
        kodeVariabel: Array.isArray(req.body?.kodeVariabel) ? req.body.kodeVariabel.map((x) => String(x)).slice(0, 60) : [],
        pelaku,
        lawan,
        tanggalSidang: String(req.body?.tanggalSidang || "").slice(0, 40) || (konteksSipp && konteksSipp.tanggalSidang) || "",
        ...(alamatPihakSipp ? { alamatPihak: alamatPihakSipp } : {}),
        isian: req.body?.isian,
        sipp: sippSaksi,
        faktaBersama: await faktaBersama(sippSaksi),
        saksiIsi: Array.isArray(req.body?.saksiIsi) ? req.body.saksiIsi.slice(0, 12) : [],
      });
      // 20 Okt 2026 (U1): fakta perkara apa adanya untuk penyusun saksi katalog di panel (hanya bila diminta).
      if (req.body?.mintaFakta === true) {
        jawaban.faktaPerkara = isiSumber.faktaPerkara({
          petitum: String(req.body?.petitum || (konteksSipp && konteksSipp.petitum) || "").slice(0, 60000),
          posita: positaKurang && konteksSipp && konteksSipp.posita ? konteksSipp.posita : positaMasuk,
          jenisPerkara: String(req.body?.jenisPerkara || "").slice(0, 80),
          alur: String(req.body?.alur || "").slice(0, 20),
          pelaku,
          lawan,
          tanggalSidang: String(req.body?.tanggalSidang || "").slice(0, 40) || (konteksSipp && konteksSipp.tanggalSidang) || "",
          ...(alamatPihakSipp ? { alamatPihak: alamatPihakSipp } : {}),
          isian: req.body?.isian,
          sipp: sippSaksi,
        });
      }
    }
    // Keterangan saksi SDG - disusun dari templat pertanyaan yang ekstensi
    // ambil lewat halaman penyunting ABT sendiri (load_template). Dua saksi,
    // satu substansi, dua bentuk kalimat.
    /* === PSAKSI 12 Okt === */
    // Set pertanyaan saksi baku (kamus pertanyaan-saksi): aksi "daftar" = set yang cocok dengan jenis perkara (+ huruf alasan
    // dari posita), aksi "ambil" = baris pertanyaan satu set (templat tanya-jawab untuk "Susun keterangan saksi").
    if (sumber === "pertanyaan-saksi") {
      const svc = require("../services/pertanyaanSaksiService");
      const m = req.body?.pertanyaanSaksi && typeof req.body.pertanyaanSaksi === "object" ? req.body.pertanyaanSaksi : {};
      const jenisId = svc.idJenis(req.body?.jenisPerkara);
      const hurufKirim = Array.isArray(m.huruf) ? m.huruf.map((x) => String(x).toUpperCase().slice(0, 1)).filter((x) => /^[A-H]$/.test(x)) : null;
      let huruf = hurufKirim;
      let hurufAsal = "dipilih";
      if (!huruf) {
        try {
          huruf = svc.hurufDariTeks(String(req.body?.posita || "").slice(0, 20000));
        } catch (_) {
          huruf = [];
        }
        hurufAsal = huruf.length ? "posita" : "";
      }
      const tanpaContoh = huruf.filter((h) => svc.TANPA_CONTOH.includes(h));
      if (m.aksi === "ambil") {
        jawaban.pertanyaanSaksi = {
          ...svc.ambilSet(String(m.namaSet || ""), { huruf, tambahan: Array.isArray(m.tambahan) ? m.tambahan.map(String).slice(0, 6) : [] }),
          huruf,
          hurufAsal,
          tanpaContoh,
        };
      } else {
        /* === T 13 Okt === */
        // Perkara kumulasi (SIPP + petitum): set yang memuat pokok kumulasinya diusulkan (itsbat -> A3/A3a, hak asuh/nafkah ->
        // + pertanyaan anak & nafkah). Gagal dibaca = tanpa usulan, daftar tetap seperti semula.
        const kumulasi =
          m.pihak === "T" || !nomorPerkara || (jenisId !== "346" && jenisId !== "347")
            ? null
            : await Promise.race([
                require("../services/kumulasiPerkaraService").kumulasiNomorPerkara(nomorPerkara),
                new Promise((selesai) => setTimeout(() => selesai(null), 2500)),
              ]).catch(() => null);
        const usulanKumulasi = kumulasi ? svc.usulanSetKumulasi(jenisId, kumulasi.daftar) : null;
        /* === AKHIR T === */
        jawaban.pertanyaanSaksi = {
          ok: true,
          jenisPerkaraId: jenisId,
          huruf,
          hurufAsal,
          tanpaContoh,
          daftar: svc.daftarSet({ jenisPerkaraId: jenisId, pihak: m.pihak === "T" ? "T" : undefined }),
          ...(usulanKumulasi ? { usulanKumulasi } : {}),
        };
      }
    }
    /* === AKHIR PSAKSI === */
    if (sumber === "saksi-sdg") {
      // Modus tiap saksi - "sama", "sebagian", "tidak-tahu", "tidak-melihat",
      // "dari-cerita" - beserta alasan pilihannya dan siapa yang bercerita.
      // Disaring per medan: ia masukan dari peramban.
      const modusMasuk = req.body?.modus && typeof req.body.modus === "object" ? req.body.modus : {};
      const modusSaksi = (m) => lengkapiSumberNamaAbt(saringModusAbt(m), pelaku, lawan);
      const saksiMasuk = saringSaksiAbt(req.body?.saksi, pelaku, lawan);
      if (saksiMasuk.ditolak.length) jawaban.saksiDitolak = saksiMasuk.ditolak;
      // Upaya rukun (butir 28, 30 Sep 2026): variabel 1268 dikirim ekstensi
      // (upayaDamai); mediasi dikirim ekstensi atau dibaca dari SIPP - HANYA
      // bila templatnya memang menanyakan upaya rukun, dan dibatasi 2,5 detik.
      const tanyaUpaya = templatMasuk.some((b) =>
        abtUsulanService.POLA_TANYA_UPAYA_RUKUN.test(String((b && (b.tanya || b.pertanyaan)) || ""))
      );
      const mediasiMasuk =
        req.body?.mediasi && typeof req.body.mediasi === "object"
          ? { selesai: req.body.mediasi.selesai === true, berhasil: req.body.mediasi.berhasil === true }
          : null;
      // Butir 24 (5 Okt 2026): ekstensi mengirim posita hanya dari variabel
      // 5125 ABT dan hanya bila "sama dengan gugatan" dicentang; variabel itu
      // dapat kosong, dan tanpa posita SELURUH fakta saksi jatuh menjadi
      // titik-titik (584/Pdt.G/2026/PA.Dgl). Posita dan tanggal sidang perkara
      // yang sama dibaca dari SIPP bila tidak dikirim - HANYA SELECT, 2,5 detik,
      // berjalan bersamaan dengan pembacaan mediasi.
      const positaMasuk = String(req.body?.posita || "");
      const tanggalSidangMasuk = String(req.body?.tanggalSidang || "").slice(0, 40);
      const positaKurang = positaMasuk.replace(/<[^>]*>/g, " ").trim().length < 50;
      /* === P5P6 10 Okt === */
      // Identitas saksi dari SIPP untuk paragraf keterangan saksi - SELECT saja,
      // berjalan bersamaan dengan bacaan di bawah, dibatasi 2,5 detik; gagal = tanpa identitas.
      const janjiIdentitasSaksi = nomorPerkara
        ? require("../services/saksiBantuService").identitasSaksiBerbatas(nomorPerkara, 2500)
        : Promise.resolve(null);
      /* === AKHIR P5P6 === */
      // 19 Okt 2026: alamat pihak di SIPP (cadangan "sekarang Penggugat tinggal di ...") dibaca hanya bila templatnya
      // menanyakan tempat tinggal masing-masing pihak sekarang; SELECT saja, 2,5 detik.
      const tanyaTempatKini = templatMasuk.some((b) => /masing-masing\s+tinggal|tinggal\s+di\s+mana/i.test(String((b && (b.tanya || b.pertanyaan)) || "")));
      // 20 Okt 2026: data SIPP untuk pengisi jawaban bersumber (SELECT saja, 2,5 detik) - hanya bila templat masih bertitik-titik.
      const isiSumber = require("../services/isiJawabanSaksiService");
      const perluSumber = templatMasuk.some((b) => /(?:[.]{3,}|…|\{[a-zA-Z0-9_]+\})/.test(String((b && (b.jawab || b.jawaban)) || "")));
      const janjiSippSaksi = perluSumber && nomorPerkara ? isiSumber.bacaSippSaksi(nomorPerkara).catch(() => null) : Promise.resolve(null);
      const [mediasiSipp, konteksSipp, alamatPihakSipp] = await Promise.all([
        !mediasiMasuk && tanyaUpaya && nomorPerkara ? abtUsulanService.mediasiPerkara(nomorPerkara).catch(() => null) : null,
        nomorPerkara && (positaKurang || !tanggalSidangMasuk)
          ? abtUsulanService.konteksPerkaraSaksi(nomorPerkara).catch(() => null)
          : null,
        tanyaTempatKini && nomorPerkara && typeof abtUsulanService.alamatPihakPerkara === "function"
          ? abtUsulanService.alamatPihakPerkara(nomorPerkara).catch(() => null)
          : null,
      ]);
      const mediasi = mediasiMasuk || mediasiSipp;
      const positaSipp = konteksSipp && konteksSipp.posita ? konteksSipp.posita : "";
      const positaDipakai = positaKurang && positaSipp ? positaSipp : positaMasuk;
      /* === JENIS3 11 Okt === */
      // Perkara non-cerai: variabel templat ABT yang tercetak "..." (belum diisi di ABT) diisi dari
      // posita per jenis - hanya fakta yang lulus gerbang isian saksi (deteksiJenisPerkaraService).
      // Templat masukan diganti di tempat agar susunKeteranganSaksiSdg di bawah tidak berubah.
      let jenis3Isi = null;
      // Salinan templat SEBELUM isiTemplatSaksi menggantinya: pengisi jawaban bersumber mencocokkan titik-titik pada bunyi aslinya.
      const templatSebelumJenis3 = templatMasuk.map((b) => (b && typeof b === "object" ? { ...b } : b));
      try {
        jenis3Isi = require("../services/deteksiJenisPerkaraService").isiTemplatSaksi(templatMasuk, {
          posita: positaDipakai,
          jenisPerkara: String(req.body?.jenisPerkara || "").slice(0, 80),
          alur: String(req.body?.alur || "").slice(0, 20),
        });
        if (jenis3Isi && jenis3Isi.jenis && Array.isArray(jenis3Isi.templat) && jenis3Isi.terisi.length) {
          templatMasuk.splice(0, templatMasuk.length, ...jenis3Isi.templat);
        }
      } catch (_galatJenis) {
        jenis3Isi = null;
      }
      /* === AKHIR JENIS3 === */
      jawaban.saksiSdg = abtUsulanService.susunKeteranganSaksiSdg({
        upayaDamai: String(req.body?.upayaDamai || "").slice(0, 600),
        mediasi,
        templat: templatMasuk,
        alasan: Array.isArray(req.body?.alasan) ? req.body.alasan.map((x) => String(x).slice(0, 80)).slice(0, 12) : [],
        posita: positaDipakai,
        tanggalSidang: tanggalSidangMasuk || (konteksSipp && konteksSipp.tanggalSidang) || "",
        ...(alamatPihakSipp ? { alamatPihak: alamatPihakSipp } : {}),
        pelaku,
        lawan,
        // Nomor perkara dan kode kumpulan templat menentukan varian kalimat
        // (pemilih ragam K7b) - cetak ulang perkara yang sama tetap sama.
        nomorPerkara: nomorPerkara.slice(0, 80),
        kodeKumpulan: String(req.body?.kodeKumpulan || "").slice(0, 20),
        // Syarat bentuk bergender (data.syarat.jenisPerkaraId/alur). Tanpa
        // keduanya bentuk bersyarat yang disahkan admin tidak pernah cocok.
        jenisPerkara: String(req.body?.jenisPerkara || "").slice(0, 80),
        alur: String(req.body?.alur || "").slice(0, 20),
        modus: { saksi1: modusSaksi(modusMasuk.saksi1), saksi2: modusSaksi(modusMasuk.saksi2) },
        ...(saksiMasuk.saksi.length ? { saksi: saksiMasuk.saksi } : {}),
        ...(tipe.tipeKeluaran ? { tipeKeluaran: tipe.tipeKeluaran } : {}),
      });
      // 20 Okt 2026: jawaban yang masih '...' padahal datanya ada diisi dari isian blangko > data SIPP > posita (kontrak
      // {teks, yakin, sumber, ket} per jawaban, di j.usulan). Dijalankan sebelum paragraf saksi disusun supaya ikut terbaca.
      if (jawaban.saksiSdg && jawaban.saksiSdg.ok) {
        try {
          const sippSaksi = await janjiSippSaksi;
          const ringkasIsi = isiSumber.lengkapi(jawaban.saksiSdg, {
            templatMasuk: templatSebelumJenis3,
            posita: positaDipakai,
            jenisPerkara: String(req.body?.jenisPerkara || "").slice(0, 80),
            alur: String(req.body?.alur || "").slice(0, 20),
            pelaku,
            lawan,
            tanggalSidang: tanggalSidangMasuk || (konteksSipp && konteksSipp.tanggalSidang) || "",
            ...(alamatPihakSipp ? { alamatPihak: alamatPihakSipp } : {}),
            isian: req.body?.isian,
            sipp: sippSaksi,
            faktaBersama: await faktaBersama(sippSaksi),
            saksi: saksiMasuk.saksi,
          });
          if (ringkasIsi && ringkasIsi.terisi) jawaban.saksiSdg.terisiDariSumber = { jawaban: ringkasIsi.terisi, ragu: ringkasIsi.ragu };
        } catch (galatIsi) {
          jawaban.saksiSdg.isiSumberGagal = String((galatIsi && galatIsi.message) || galatIsi).slice(0, 200);
        }
      }
      // Dari mana fakta gugatan diambil - supaya panel dapat menyebutnya.
      if (jawaban.saksiSdg && jawaban.saksiSdg.ok) {
        jawaban.saksiSdg.asalPosita = positaDipakai === positaSipp && positaSipp ? "sipp" : positaMasuk ? "ekstensi" : "";
      }
      /* === P5P6 10 Okt === */
      // Paragraf keterangan saksi (ringkas & lengkap) + peringatan ringan. Hanya
      // MENAMBAH ruas - tanya-jawab yang disusun tidak disentuh, dan galat di
      // sini tidak pernah menggagalkan susunan.
      if (jawaban.saksiSdg && jawaban.saksiSdg.ok) {
        try {
          const identitasSaksi = await janjiIdentitasSaksi;
          Object.assign(
            jawaban.saksiSdg,
            require("../services/deteksiSaksiService").lengkapiSusunan(jawaban.saksiSdg, {
              identitas: identitasSaksi,
              lawan,
              pelaku,
              kelompokTanya: require("../services/pemilihRagam").kelompokTanya,
              penutup: req.body?.penutupSaksi === "tanggapan" ? "tanggapan" : "",
            })
          );
        } catch (galatParagraf) {
          jawaban.saksiSdg.paragrafGagal = String((galatParagraf && galatParagraf.message) || galatParagraf).slice(0, 200);
        }
      }
      /* === AKHIR P5P6 === */
      /* === JENIS3 11 Okt === */
      // Jenis perkara, isian dari posita per jenis, peringatan syarat saksi per jenis, dan kalimat
      // pokok (ringkas) - hanya MENAMBAH ruas; galat di sini tidak menggagalkan susunan.
      if (jawaban.saksiSdg && jawaban.saksiSdg.ok && jenis3Isi && jenis3Isi.jenis) {
        try {
          lengkapiSaksiJenis(jawaban.saksiSdg, jenis3Isi, {
            posita: positaDipakai,
            jenisPerkara: String(req.body?.jenisPerkara || "").slice(0, 80),
            alur: String(req.body?.alur || "").slice(0, 20),
          });
        } catch (galatJenis) {
          jawaban.saksiSdg.jenisGagal = String((galatJenis && galatJenis.message) || galatJenis).slice(0, 200);
        }
      }
      /* === AKHIR JENIS3 === */
    }
    if (sumber === "semua" || sumber === "saksi") {
      jawaban.saksi = abtUsulanService.dariKeteranganSaksi(
        String(req.body?.saksi1 || ""),
        String(req.body?.saksi2 || ""),
        String(req.body?.tanggalSidang || ""),
        {
          pelaku: String(req.body?.pelaku || ""),
          lawan: String(req.body?.lawan || ""),
        },
        // Gugatannya - dipakai menyaring alasan yang tidak pernah
        // didalilkan. Boleh kosong; saringannya lalu tidak berlaku.
        String(req.body?.posita || ""),
        tipe.tipeKeluaran ? { tipeKeluaran: tipe.tipeKeluaran } : undefined
      );
      /* === KDL2 11 Okt === */
      // Tempat tinggal bersama semasa rukun -> kartu 1006 (Tempat tinggal setelah nikah) & 8570
      // (Kediaman bersama terakhir), sumber posita + kutipan saksi. Posita dari ekstensi (5125) atau
      // SIPP bila tidak dikirim (SELECT, 2,5 detik). Hanya MENAMBAH kartu yang belum ada; galat di sini
      // tidak pernah menggagalkan usulan lain.
      if (jawaban.saksi && Array.isArray(jawaban.saksi.usulan)) {
        try {
          const positaMasukTt = String(req.body?.posita || "");
          let positaTt = positaMasukTt;
          if (positaMasukTt.replace(/<[^>]*>/g, " ").trim().length < 50 && nomorPerkara) {
            const konteksTt = await abtUsulanService.konteksPerkaraSaksi(nomorPerkara).catch(() => null);
            if (konteksTt && konteksTt.posita) positaTt = konteksTt.posita;
          }
          const tt = require("../services/deteksiTempatTinggalService").usulanTempatTinggal({
            posita: positaTt,
            saksi1: String(req.body?.saksi1 || ""),
            saksi2: String(req.body?.saksi2 || ""),
          });
          for (const u of tt.usulan) {
            if (!jawaban.saksi.usulan.some((x) => x && x.kode === u.kode)) jawaban.saksi.usulan.push(u);
          }
          jawaban.saksi.tempatTinggal = tt.tempatTinggal;
        } catch (galatTt) {
          jawaban.saksi.tempatTinggalGalat = String((galatTt && galatTt.message) || galatTt).slice(0, 200);
        }
      }
      /* === AKHIR KDL2 === */
      /* === CERAI 13 Okt (agen V, butir 16) === */
      // Hanya cerai gugat/talak (jenis dari SIPP): 5105 tempat menikah, 0007 anak, 1267 komunikasi dari posita,
      // 5127 = salinan 5227 - lihat services/deteksi/cerai.js. HANYA modul cerai (bukan semua DAFTAR deteksi/index.js:
      // modul jenis lain disambung agen W/X/Y di bagian posita-lain). Hanya menambah kartu yang belum ada.
      if (jawaban.saksi && Array.isArray(jawaban.saksi.usulan) && nomorPerkara) {
        try {
          const konteksCr = await abtUsulanService.konteksPerkaraSaksi(nomorPerkara).catch(() => null);
          if (konteksCr && [346, 347].includes(konteksCr.jenisPerkaraId)) {
            const positaCr = String(req.body?.posita || "").replace(/<[^>]*>/g, " ").trim().length >= 50 ? String(req.body?.posita || "") : konteksCr.posita;
            jawaban.saksi.usulan = require("../services/deteksi/cerai").tambahUsulanCerai(jawaban.saksi.usulan, positaCr);
          }
        } catch (galatCr) {
          jawaban.saksi.ceraiGalat = String((galatCr && galatCr.message) || galatCr).slice(0, 200);
        }
      }
      /* === AKHIR CERAI 13 Okt === */
    }

    // Entri pengaturan yang ditolak - oleh penyaring di atas maupun oleh
    // penyusunnya sendiri - disebut dalam satu daftar, bukan ditelan.
    const ditolakLayanan = [jawaban.saksi, jawaban.saksiSdg, jawaban.positaLain].flatMap((h) =>
      h && Array.isArray(h.tipeKeluaranDitolak) ? h.tipeKeluaranDitolak : []
    );
    if (tipe.ditolak.length || ditolakLayanan.length) {
      jawaban.tipeKeluaranDitolak = [...tipe.ditolak, ...ditolakLayanan];
    }

    /* === U6 20 Okt === */
    // GERBANG OTOMATIS BERDASAR: usulan pasti/cukup hanya tetap bila kode+asalnya terukur ketepatannya (config/gerbang-isian.json);
    // selain itu menjadi saran "ragu". Satu tempat untuk semua sumber usulan (sipp, saksi, itsbat, posita-lain).
    try {
      const gerbang = require("../services/gerbangIsian");
      for (const bag of [jawaban.sipp, jawaban.saksi, jawaban.itsbat, jawaban.positaLain]) if (bag && Array.isArray(bag.usulan)) gerbang.terapkan(bag.usulan);
    } catch (galatGerbang) {
      jawaban.gerbangGalat = String((galatGerbang && galatGerbang.message) || galatGerbang).slice(0, 160);
    }
    /* === AKHIR U6 === */

    res.json(jawaban);
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/**
 * Mengubah RTF putusan menjadi PDF.
 *
 * Isinya dikirim sebagai base64, bukan multipart: rute internal ini sudah
 * menerima JSON untuk segalanya, dan menambahkan satu pengurai multipart hanya
 * untuk satu rute berarti satu jalur masuk lagi yang harus dijaga.
 *
 * Tidak menyimpan apa pun. Berkasnya masuk, PDF-nya keluar, foldernya dibuang -
 * putusan lengkap beserta nama pihaknya tidak tertinggal di mana-mana.
 */
router.post("/abt/pdf", requireInternalToken, async (req, res) => {
  try {
    const base64 = String(req.body?.rtfBase64 || "");
    if (!base64) {
      res.status(400).json({ ok: false, error: "rtfBase64 kosong." });
      return;
    }
    let isi = Buffer.from(base64, "base64");
    // 14 Okt: { salinan: true } -> PDF SALINAN: "SALINAN" kanan atas, "ttd"
    // di tempat tanda tangan pejabat, blok Untuk Salinan tampak, dan gambar
    // tanda tangan Panitera (HANYA yang sudah disahkan, dicocokkan dengan
    // nama di blok itu). Lihat salinanPutusanService.
    let salinan = null;
    if (req.body && req.body.salinan === true && isi.subarray(0, 5).toString("latin1").startsWith("{\\rtf")) {
      const teks = isi.toString("latin1");
      const namaPanitera = salinanPutusanService.namaPaniteraSalinan(teks);
      let ttd = null;
      let galatTtd = "";
      try {
        ttd = namaPanitera ? await tandaTanganService.untukPejabat(namaPanitera) : null;
      } catch (e) {
        galatTtd = String((e && e.message) || e).slice(0, 160);
      }
      // 20 Okt: ukuran tanda tangan/cap dari portal (satu set dengan e-Doc penetapan & ekstensi);
      // cap Panitera (bila ada) dibubuhkan di sisi kiri tanda tangan. Tanpa kiriman = ukuran bawaan, tanpa cap.
      let cap = null;
      const kapBody = req.body && req.body.cap;
      if (kapBody && typeof kapBody.isiBase64 === "string" && kapBody.isiBase64) {
        const isiCap = Buffer.from(kapBody.isiBase64, "base64");
        if (isiCap.length) cap = { isi: isiCap, jenis: String(kapBody.jenis || "") };
      }
      const susun = salinanPutusanService.susunSalinan(teks, { ttd, cap, atur: req.body && req.body.atur });
      isi = Buffer.from(susun.rtf, "latin1");
      salinan = { ...susun.laporan, ttdTerdaftar: Boolean(ttd), galatTtd };
    }
    const hasil = await abtCetakService.rtfKePdf(isi);
    if (!hasil.ok) {
      res.status(422).json({ ok: false, error: hasil.alasan });
      return;
    }
    res.json({
      ok: true,
      pdfBase64: hasil.pdf.toString("base64"),
      byte: hasil.pdf.length,
      versiMesin: hasil.versiMesin || "",
      ...(salinan ? { salinan } : {}),
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/**
 * Mengubah naskah ke bentuk lain (kontrak K1, butir 8 dan 11, 30 Sep 2026).
 *
 *   POST { berkasBase64, ke: "rtf" | "docx" | "doc" | "pdf" }
 *   -> { ok, berkasBase64, bentukAsal, ke, byte, versiMesin }
 *
 * Hanya menghitung - tidak ada yang disimpan dan tidak ada tulisan ke SIPP.
 * PDF sebagai asal ditolak dengan kode "pdf_perlu_ekstraksi": portal
 * mengekstrak teksnya lebih dulu (lihat dokumenKeBentuk).
 */
router.post("/naskah/konversi", requireInternalToken, async (req, res) => {
  try {
    const base64 = String((req.body && req.body.berkasBase64) || "");
    if (!base64) {
      res.status(400).json({ ok: false, error: "berkasBase64 kosong." });
      return;
    }
    const isi = Buffer.from(base64, "base64");
    const hasil = await abtCetakService.dokumenKeBentuk(isi, req.body && req.body.ke);
    if (!hasil.ok) {
      const status = hasil.kode === "soffice_tidak_ada" ? 503 : hasil.kode === "terlalu_besar" ? 413 : 422;
      res.status(status).json({ ok: false, error: hasil.alasan, kode: hasil.kode, bentukAsal: hasil.bentukAsal || "" });
      return;
    }
    res.json({
      ok: true,
      berkasBase64: hasil.berkas.toString("base64"),
      bentukAsal: hasil.bentukAsal,
      ke: hasil.ke,
      byte: hasil.berkas.length,
      versiMesin: hasil.versiMesin || "",
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/** Apakah mesin konversinya siap? Dipakai panel untuk menyebutkan sebabnya. */
router.get("/abt/pdf/mesin", requireInternalToken, async (_req, res) => {
  try {
    res.json({ ok: true, mesin: await abtCetakService.periksaMesin() });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/**
 * Merapikan posita satu perkara di SIPP.
 *
 * SATU-SATUNYA rute di ALETA yang menulis ke kolom posita. Pagarnya di
 * sippPositaService: isi tanpa ruang kosong harus persis sama sebelum dan
 * sesudah, sehingga tidak satu huruf pun dalil gugatan dapat berubah.
 *
 * Posita lama dikembalikan supaya pemanggilnya dapat menyimpannya di riwayat
 * perubahan - dan supaya ada yang dapat dikembalikan bila perlu.
 */
router.post("/sipp/posita/rapikan", requireInternalToken, async (req, res) => {
  try {
    // Teksnya TIDAK diterima dari pemanggil - hanya perkaranya. Yang
    // dirapikan dibaca sendiri dari kolom posita, sehingga yang dibandingkan
    // dan yang ditulis satu teks yang sama.
    const hasil = await sippPositaService.rapikanPosita(
      req.body?.perkaraId,
      req.body?.ujiKering === true
    );
    if (!hasil.ok) {
      // 422, bukan 500: permintaannya sampai dan dimengerti, isinya yang
      // ditolak. Membedakannya membuat sebabnya terbaca di layar petugas.
      return res.status(422).json({ ok: false, error: hasil.alasan });
    }
    res.json({
      ok: true,
      tersentuh: hasil.tersentuh,
      berubah: Boolean(hasil.berubah),
      disambung: Number(hasil.disambung) || 0,
      // Pecahan yang RAGU - huruf a-f - dikembalikan supaya panel dapat
      // menanyakannya. Tidak satu pun disentuh perapian; lihat catatan di
      // periksaPosita tentang kenapa ia tidak dapat diputuskan mesin.
      ragu: sippPositaService.periksaPosita(String(hasil.sebelum || "")).pecahanRagu,
      sebelum: hasil.sebelum,
      sesudah: hasil.sesudah,
      alasan: hasil.alasan || "",
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});
/**
 * Menyambung satu pecahan kata yang RAGU pada posita.
 *
 * Yang diterima hanya nomor perkara dan URUTAN temuannya - bukan teks, dan
 * bukan pola. Positanya dibaca ulang dan temuannya dihitung ulang di sisi bot;
 * rute yang menerima teks adalah rute yang dapat dititipi posita karangan.
 */
router.post("/sipp/posita/sambung", requireInternalToken, async (req, res) => {
  try {
    const hasil = await sippPositaService.sambungPecahanRagu(
      req.body?.perkaraId,
      req.body?.indeks
    );
    if (!hasil.ok) return res.status(422).json({ ok: false, error: hasil.alasan });
    res.json({
      ok: true,
      tersentuh: hasil.tersentuh,
      disambung: hasil.disambung,
      sisa: hasil.sisa,
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});
/** Menitipkan permintaan penarikan satu perkara. */
router.post("/ecourt/permintaan", requireInternalToken, async (req, res) => {
  try {
    const hasil = await ecourtPermintaanService.titipkan(
      String(req.body?.nomorPerkara || ""),
      String(req.body?.dimintaOleh || "")
    );
    res.status(hasil.ok ? 200 : 400).json(hasil);
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/** Keadaan permintaan terakhir untuk satu perkara. */
router.get("/ecourt/permintaan", requireInternalToken, async (req, res) => {
  try {
    const keadaan = await ecourtPermintaanService.keadaan(String(req.query.nomor || ""));
    // Butir 8 (1.189.x): permintaan yang SEDANG dikerjakan membawa kemajuan
    // nyata putaran penjadwal (tahap jembatan + persen) bila putarannya memang
    // untuk perkara ini.
    if (keadaan && keadaan.status === "dikerjakan") {
      try {
        const s = require("../services/ecourtSchedulerService").getStatus();
        const { normalizeCaseNumber } = require("../services/ecourtTextService");
        if (s.sedangJalan && s.kemajuan && normalizeCaseNumber(s.perkaraDiminta) === normalizeCaseNumber(String(req.query.nomor || ""))) {
          keadaan.kemajuan = s.kemajuan;
        }
      } catch {
        // Tanpa kemajuan pun keadaannya tetap terjawab.
      }
    }
    res.json({ ok: true, keadaan });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/**
 * Tarik data SATU perkara dari kepala halaman perkara SIPP (21 Okt 2026).
 *
 * Antrean satu pintu di sela penarikan utama - aturannya di
 * ecourtTarikSatuService (jangan menghitung ulang di sini). `paksa` hanya
 * dikirim portal untuk Admin/Super Admin. Bot menjawab 200 untuk semua hasil
 * yang wajar (segar, bukan e-Court, diantrekan); 500 hanya untuk galat.
 */
router.post("/ecourt/tarik-satu", requireInternalToken, async (req, res) => {
  try {
    const hasil = await require("../services/ecourtTarikSatuService").minta({
      nomorPerkara: String(req.body?.nomorPerkara || ""),
      olehSiapa: String(req.body?.olehSiapa || ""),
      paksa: req.body?.paksa === true,
    });
    res.json(hasil);
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

router.get("/ecourt/tarik-satu", requireInternalToken, async (req, res) => {
  try {
    res.json(await require("../services/ecourtTarikSatuService").keadaan(String(req.query.nomor || "")));
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

router.get("/sipp/berkas", requireInternalToken, async (req, res) => {
  try {
    const hasil = await sippKonteksService.getBerkas(
      String(req.query.documentKey || ""),
      String(req.query.format || "pdf")
    );
    if (!hasil.ok) {
      res.status(404).json({ ok: false, alasan: hasil.alasan });
      return;
    }

    res.setHeader("Content-Type", hasil.tipeIsi);
    res.setHeader("Content-Length", String(hasil.isi.length));
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(hasil.namaBerkas)}"`);
    res.send(hasil.isi);
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

// ============================================================================
// PENANDA EKSEPSI & REKONVENSI - JAWABAN / DUPLIK TERGUGAT (butir 4, 6 Okt 2026)
// ============================================================================
//
// Portal yang membaca (pdfjs + tesseract ada di citranya, tidak di bot); bot
// hanya menyerahkan berkas kandidat dan menyimpan hasilnya. Lihat
// services/penandaJawabanService.js.
const penandaJawabanService = require("../services/penandaJawabanService");

/** Berkas jawaban/duplik Tergugat yang belum dibaca - perkara ?nomor= lebih dulu. */
router.get("/sipp/penanda-jawaban/antrian", requireInternalToken, async (req, res) => {
  try {
    const nomor = String(req.query.nomor || "")
      .split("|")
      .map((x) => x.trim())
      .filter(Boolean);
    const berkas = await penandaJawabanService.antrian({
      nomor,
      batas: Number(req.query.batas) || 12,
      versi: Number(req.query.versi) || 0,
    });
    res.json({ ok: true, berkas });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/** Isi satu berkas kandidat, menurut id baris aleta_bot_ecourt_files. */
router.get("/sipp/penanda-jawaban/berkas", requireInternalToken, async (req, res) => {
  try {
    const hasil = await penandaJawabanService.berkas(String(req.query.fileId || ""));
    if (!hasil.ok) {
      res.status(404).json({ ok: false, alasan: hasil.alasan });
      return;
    }
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Length", String(hasil.isi.length));
    res.send(hasil.isi);
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/** Hasil pembacaan portal, per berkas. */
router.post("/sipp/penanda-jawaban", requireInternalToken, async (req, res) => {
  try {
    const hasil = await penandaJawabanService.simpan(Array.isArray(req.body?.hasil) ? req.body.hasil : []);
    res.json({ ok: true, ...hasil });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/* === KTP-PIHAK 12 Okt === */
// Tanggal KTP pihak dari berkas KTP e-Court (butir 14-15). Portal yang membaca
// (pdfjs + tesseract ada di citranya); bot menyerahkan berkas, mencocokkan ke
// pihak SIPP, dan menyimpan di aleta_bot_ktp_pihak. Lihat services/ktpPihakService.js.
const ktpPihakService = require("../services/ktpPihakService");

router.get("/sipp/ktp-pihak/antrian", requireInternalToken, async (req, res) => {
  try {
    const nomor = String(req.query.nomor || "")
      .split("|")
      .map((x) => x.trim())
      .filter(Boolean);
    const berkas = await ktpPihakService.antrian({
      nomor,
      batas: Number(req.query.batas) || 6,
      versi: Number(req.query.versi) || ktpPihakService.VERSI_KTP_PIHAK,
    });
    res.json({ ok: true, berkas, versi: ktpPihakService.VERSI_KTP_PIHAK });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

router.get("/sipp/ktp-pihak/berkas", requireInternalToken, async (req, res) => {
  try {
    const hasil = await ktpPihakService.berkas(String(req.query.fileId || ""));
    if (!hasil.ok) {
      res.status(404).json({ ok: false, alasan: hasil.alasan });
      return;
    }
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Length", String(hasil.isi.length));
    res.send(hasil.isi);
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

router.post("/sipp/ktp-pihak", requireInternalToken, async (req, res) => {
  try {
    const hasil = await ktpPihakService.simpan(Array.isArray(req.body?.hasil) ? req.body.hasil : []);
    res.json({ ok: true, ...hasil });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/** Tanggal KTP tiap pihak satu perkara: ?nomor=535/Pdt.G/2026/PA.Dgl (atau ?perkaraId=). */
router.get("/sipp/ktp-pihak/perkara", requireInternalToken, async (req, res) => {
  try {
    const hasil = await ktpPihakService.perkaraKtp({
      nomorPerkara: String(req.query.nomor || ""),
      perkaraId: Number(req.query.perkaraId) || undefined,
    });
    res.json(hasil);
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});
/* === AKHIR KTP-PIHAK === */

/* === OCR-ECOURT 19 Okt === */
// Lampiran e-Court (KK, akta, surat keterangan, surat kuasa, slip gaji) -> medan per halaman. Portal yang membaca
// (lapisan teks/OCR); bot mengenali jenis, mengurai medan, mencocokkan ke pihak SIPP, dan menyimpan medan TANPA NIK
// dan tanpa teks halaman. Lihat services/lampiranEcourtStoreService.js.
const lampiranEcourtStore = require("../services/lampiranEcourtStoreService");

router.get("/sipp/lampiran-ecourt/antrian", requireInternalToken, async (req, res) => {
  try {
    const nomor = String(req.query.nomor || "").split("|").map((x) => x.trim()).filter(Boolean);
    const versi = require("../services/lampiranEcourtService").VERSI_LAMPIRAN;
    const berkas = await lampiranEcourtStore.antrian({ nomor, batas: Number(req.query.batas) || 1, versi: Number(req.query.versi) || versi });
    res.json({ ok: true, berkas, versi });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

router.get("/sipp/lampiran-ecourt/berkas", requireInternalToken, async (req, res) => {
  try {
    const hasil = await lampiranEcourtStore.berkas(String(req.query.fileId || ""));
    if (!hasil.ok) {
      res.status(404).json({ ok: false, alasan: hasil.alasan });
      return;
    }
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Length", String(hasil.isi.length));
    res.send(hasil.isi);
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

router.post("/sipp/lampiran-ecourt", requireInternalToken, async (req, res) => {
  try {
    const hasil = await lampiranEcourtStore.simpan(Array.isArray(req.body?.hasil) ? req.body.hasil : []);
    res.json({ ok: true, ...hasil });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

router.get("/sipp/lampiran-ecourt/ringkasan", requireInternalToken, async (_req, res) => {
  try {
    res.json({ ok: true, ...(await lampiranEcourtStore.ringkasan()) });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});
/* === AKHIR OCR-ECOURT === */

/* === KTP-RIWAYAT 12 Okt === */
// Histori penarikan tanggal KTP per nomor perkara + bacaan ulang satu perkara (butir 11).
// Hanya membaca tabel bot; NIK tidak pernah keluar. Lihat services/ktpPihakRiwayatService.js.
const ktpPihakRiwayatService = require("../services/ktpPihakRiwayatService");

router.get("/sipp/ktp-pihak/riwayat/ringkasan", requireInternalToken, async (_req, res) => {
  try {
    res.json({ ok: true, ringkasan: await ktpPihakRiwayatService.ringkasanRiwayat() });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

router.get("/sipp/ktp-pihak/riwayat", requireInternalToken, async (req, res) => {
  try {
    const hasil = await ktpPihakRiwayatService.daftarPerkara({
      cari: String(req.query.cari || ""),
      batas: Number(req.query.batas) || 30,
      mulai: Number(req.query.mulai) || 0,
    });
    res.json({ ok: true, ...hasil });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

router.get("/sipp/ktp-pihak/riwayat/perkara", requireInternalToken, async (req, res) => {
  try {
    const hasil = await ktpPihakRiwayatService.riwayatPerkara(String(req.query.nomor || ""));
    res.json(hasil);
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

router.post("/sipp/ktp-pihak/baca-ulang", requireInternalToken, async (req, res) => {
  try {
    const hasil = await ktpPihakRiwayatService.bacaUlangPerkara(String(req.body?.nomor || ""));
    res.status(hasil.ok ? 200 : 400).json(hasil);
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});
/* === AKHIR KTP-RIWAYAT === */

/** Daftar sidang pada rentang tanggal. */
router.get("/sipp/jadwal-sidang", requireInternalToken, async (req, res) => {
  try {
    // Performa muat 19 Okt 2026: jadwal (SIPP) dan peta antrian (basis data
    // antrian) tidak saling bergantung - dibaca BERSAMAAN, tidak berurutan.
    // Gagalnya peta antrian tetap ditelan seperti semula.
    const [hasil, petaPenuh] = await Promise.all([
      sippJadwalSidangService.daftarSidang({
        dari: String(req.query.dari || ""),
        sampai: String(req.query.sampai || ""),
        cari: String(req.query.cari || ""),
        batas: Number(req.query.batas) || 200,
      }),
      antrianSidangService.petaAntrian().catch((galat) => ({
        terbaca: false,
        alasan: String(galat.message || galat).slice(0, 200),
        peta: {},
        tanggal: [],
      })),
    ]);

    // ======================================================================
    // ANTRIAN DITEMPELKAN DI SINI, BUKAN DI DALAM LAYANAN JADWAL
    // ======================================================================
    //
    // Keduanya membaca basis data yang BERBEDA: jadwal dari SIPP, antrian
    // dari sipp_turunan_antrian lewat sambungan tersendiri. Menyatukannya di
    // dalam satu layanan berarti layanan jadwal ikut mati saat sambungan
    // antrian bermasalah - padahal antrian hanya keterangan tambahan.
    //
    // Karena itu kegagalannya ditelan: jadwalnya tetap terkirim, dan
    // keterangan antriannya menyebutkan sendiri kenapa ia kosong.
    //
    // Peta antrian dibaca PENUH sekali, lalu dipakai dua kali: disaring untuk
    // layar (bentuk yang sama seperti sebelumnya), dan utuh untuk buku waktu
    // antrian di bawah - yang memerlukan nomor seluruh perkara hari itu.
    const idPerkara = (hasil.sidang || []).map((baris) => baris.perkaraId);
    const antrian = antrianSidangService.saringUntukPerkara(petaPenuh, idPerkara);

    // ======================================================================
    // WAKTU ANTRIAN - TIGA JARAK WAKTU SIDANG (27 September 2026)
    // ======================================================================
    //
    // Waktu ambil, jam jadwal asli, dan waktu panggil berdetik untuk SELURUH
    // perkara pada tanggal-tanggal yang tampil - dari buku waktu ALETA untuk
    // hari lampau, disatukan dengan pembacaan langsung untuk hari ini - beserta
    // "sekarang" menurut jam aplikasi antrian. Portal menghitung tiga jaraknya
    // dari sini; lihat antrianWaktuService dan lib/tiga-jarak-sidang.ts.
    //
    // HANYA bila diminta (?waktu=1) - temuan penelaah 27 September 2026.
    // Menyusunnya menembak basis data antrian dan basis data bot, sedangkan
    // rute ini juga dipanggil layar publik yang memuat ulang berkala
    // (antrian-publik, antrian-tampil, sidang-ruang) dan membuang hasilnya.
    // Tanpa pilihan itu jawabannya SAMA dengan sebelum 2.39: tanpa kunci
    // waktuAntrian sama sekali.
    //
    // Gagalnya pun ditelan, dengan sebab yang disebutkan: jadwal tetap tampil.
    if (String(req.query.waktu || "") !== "1") {
      res.json({ ok: true, ...hasil, antrian });
      return;
    }
    // Waktu antrian dan kehadiran rinci juga dibaca bersamaan (19 Okt 2026).
    const janjiWaktuAntrian = antrianWaktuService
      .waktuUntukJadwal({
        tanggal: (hasil.sidang || []).map((baris) => baris.tanggalSidang),
        petaNomor: petaPenuh && petaPenuh.terbaca ? petaPenuh.peta : null,
      })
      .catch((galat) => ({
        terbaca: false,
        alasan: String(galat.message || galat).slice(0, 200),
        sekarang: "",
        hariIni: "",
        langsungTerbaca: false,
        rekamanTerbaca: false,
        baris: [],
      }));

    // ======================================================================
    // F3.2: KEHADIRAN RINCI PER ORANG - HANYA UNTUK LAYAR JADWAL (?waktu=1)
    // ======================================================================
    //
    // Dikunci "perkaraId|tanggal": jadwal dapat memuat rentang tanggal, dan
    // perkara yang sama bersidang lagi pada tanggal lain. Gagalnya ditelan -
    // kehadiran rinci keterangan tambahan, jadwal tetap tampil.
    const kehadiranRinci = {};
    try {
      const perTanggal = new Map();
      for (const baris of hasil.sidang || []) {
        const hari = String(baris.tanggalSidang || "").slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(hari)) continue;
        if (!perTanggal.has(hari)) perTanggal.set(hari, new Set());
        perTanggal.get(hari).add(String(baris.perkaraId || ""));
      }
      // Per tanggal BERSAMAAN (19 Okt 2026), bukan satu tanggal menunggu yang
      // lain. Tanggal yang gagal dibaca dilewati - tanggal lain tetap terisi.
      const daftarHari = [...perTanggal.entries()];
      const hasilHari = await Promise.allSettled(
        daftarHari.map(([hari, kumpulan]) => kehadiranAntrianService.daftarKehadiran([...kumpulan], hari))
      );
      daftarHari.forEach(([hari], i) => {
        const satu = hasilHari[i];
        if (satu.status !== "fulfilled") return;
        for (const [perkaraId, isi] of Object.entries(satu.value || {})) kehadiranRinci[`${perkaraId}|${hari}`] = isi;
      });
    } catch {
      // Tabel kehadiran tidak terbaca: kolom antrian tetap seperti semula.
    }
    const waktuAntrian = await janjiWaktuAntrian;

    res.json({ ok: true, ...hasil, antrian: { ...antrian, kehadiran: kehadiranRinci }, waktuAntrian });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/**
 * Antrian sidang hari berjalan, lengkap dengan nomor urutnya.
 *
 * Nomornya dihitung dengan rumus yang SAMA PERSIS dengan yang dipakai
 * menjawab WhatsApp, sehingga nomor di layar dan nomor yang diterima para
 * pihak tidak pernah berselisih.
 */
router.get("/antrian/sidang", requireInternalToken, async (req, res) => {
  try {
    const hasil = await antrianSidangService.petaAntrian();

    // Kehadiran rinci ditempelkan di sini, bukan di dalam layanan antrian:
    // yang satu membaca aplikasi antrian, yang lain membaca basis data ALETA.
    // Kegagalan salah satunya tidak boleh menjatuhkan yang lain.
    const [kehadiran, panggilan] = await Promise.all([
      kehadiranAntrianService.daftarKehadiran(Object.keys(hasil.peta || {})).catch(() => ({})),
      panggilanAntrianService.riwayatPanggilan(Object.keys(hasil.peta || {})).catch(() => ({})),
    ]);

    res.json({ ok: true, ...hasil, kehadiran, panggilan });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/**
 * Keadaan pencatat waktu antrian - menyala atau tidak, kapan terakhir
 * membaca, dan galat terakhirnya.
 *
 * Hanya membaca keadaan di memori; tidak menyentuh basis data mana pun.
 * Gunanya menjawab "pencatatnya jalan atau tidak" di peladen tanpa membuka
 * log - pencatat yang diam-diam mati baru ketahuan saat riwayat sebuah hari
 * ternyata kosong, dan saat itu harinya sudah lewat.
 */
router.get("/antrian/waktu/status", requireInternalToken, (req, res) => {
  res.json({ ok: true, ...antrianWaktuService.status() });
});

/**
 * Memanggil satu nomor antrian.
 *
 * ==========================================================================
 * ALETA MENJADI PINTU KEDUA, BUKAN SISTEM TANDINGAN
 * ==========================================================================
 *
 * Yang ditulis PERSIS yang ditulis mesin antrian - disidang dan jam panggil -
 * sehingga layar aplikasi antrian tetap benar dan tidak ada dua sumber
 * kebenaran yang berselisih. Yang ditambahkan ALETA hanya RIWAYATNYA: tabel
 * antrian cuma menyimpan satu jam panggil, dan tidak dapat menjawab "sudah
 * dipanggil berapa kali" - padahal itulah yang menentukan apakah perkara patut
 * ditunda.
 */
router.post("/antrian/panggil", requireInternalToken, async (req, res) => {
  try {
    const perkaraId = String(req.body?.perkaraId || "").trim();
    if (!perkaraId) {
      res.status(400).json({ ok: false, error: "perkaraId wajib diisi." });
      return;
    }

    const hasil = await panggilanAntrianService.panggil({
      perkaraId,
      nomorPerkara: String(req.body?.nomorPerkara || ""),
      nomorAntrian: req.body?.nomorAntrian ?? null,
      noRuang: req.body?.noRuang ?? null,
      oleh: String(req.body?.oleh || ""),
    });

    res.status(hasil.ok ? 200 : 409).json(hasil);
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/** Peran yang dapat hadir - dipakai layar pengambilan menyusun pilihannya. */
router.get("/antrian/peran", requireInternalToken, (req, res) => {
  res.json({ ok: true, peran: kehadiranAntrianService.PERAN });
});

/**
 * Mencatat satu kehadiran, lalu mengisi waktu ambil bila masih kosong.
 *
 * ==========================================================================
 * INI YANG MELAHIRKAN NOMOR ANTRIAN
 * ==========================================================================
 *
 * Kolom waktu di aplikasi antrian hanya diisi bila MASIH KOSONG. Kedatangan
 * kedua pada sisi yang sama - Penggugat II menyusul Penggugat I - tetap
 * tercatat di ALETA tetapi tidak menyentuh waktunya. Menimpanya berarti
 * perkara itu mundur di antrian hanya karena ada orang kedua yang datang, dan
 * nomor yang sudah diberitahukan berubah tanpa ada yang menjelaskan kenapa.
 */
router.post("/antrian/hadir", requireInternalToken, async (req, res) => {
  try {
    const perkaraId = String(req.body?.perkaraId || "").trim();
    if (!perkaraId) {
      res.status(400).json({ ok: false, error: "perkaraId wajib diisi." });
      return;
    }

    const hasil = await kehadiranAntrianService.catatHadir({
      perkaraId,
      nomorPerkara: String(req.body?.nomorPerkara || ""),
      tanggal: String(req.body?.tanggal || ""),
      peran: String(req.body?.peran || ""),
      urutanPihak: String(req.body?.urutanPihak || ""),
      sebagaiKuasa: req.body?.sebagaiKuasa === true,
      nama: String(req.body?.nama || ""),
      sisi: String(req.body?.sisi || ""),
      sumber: String(req.body?.sumber || "aleta"),
      waChatId: String(req.body?.waChatId || ""),
      dicatatOleh: String(req.body?.dicatatOleh || ""),
      // F3.2: saksi siapa (pihak_1/pihak_2) - selain itu kosong.
      saksiUntuk: String(req.body?.saksiUntuk || ""),
    });

    res.status(hasil.ok ? 200 : 400).json(hasil);
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/**
 * F3.2: kehadiran rinci per orang untuk satu atau beberapa perkara pada satu
 * tanggal (bawaan hari ini). Dipakai blangko Tunda/Putus, BAS, dan panel
 * ekstensi di SIPP - termasuk sidang hari lampau, sebab tabel kehadiran ALETA
 * menyimpan tanggalnya (aplikasi antrian hanya menyimpan hari ini).
 * Hanya membaca.
 */
router.get("/antrian/kehadiran", requireInternalToken, async (req, res) => {
  try {
    const id = String(req.query.perkaraId || "")
      .split(",")
      .map((x) => x.trim())
      .filter((x) => /^\d+$/.test(x))
      .slice(0, 500);
    if (id.length === 0) {
      res.status(400).json({ ok: false, error: "perkaraId wajib diisi." });
      return;
    }
    const kehadiran = await kehadiranAntrianService.daftarKehadiran(id, String(req.query.tanggal || ""));
    res.json({ ok: true, kehadiran });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/**
 * F3.2: menandai satu orang pulang / kembali / saksi sudah diperiksa.
 * Tidak menyentuh aplikasi antrian - nomor tidak bergeser.
 */
router.post("/antrian/kehadiran/keadaan", requireInternalToken, async (req, res) => {
  try {
    const hasil = await kehadiranAntrianService.ubahKeadaan({
      perkaraId: String(req.body?.perkaraId || ""),
      id: String(req.body?.id || ""),
      keadaan: String(req.body?.keadaan || ""),
      oleh: String(req.body?.oleh || ""),
    });
    res.status(hasil.ok ? 200 : 400).json(hasil);
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/**
 * MEMBATALKAN kehadiran satu sisi, lalu mengosongkan waktu ambilnya.
 *
 * ==========================================================================
 * UNTUK SALAH INPUT, DAN NOMOR ORANG LAIN IKUT BERGESER
 * ==========================================================================
 *
 * Yang diperbaiki pencatatannya, bukan kenyataannya: orang yang sudah datang
 * lalu pulang tetap pernah hadir. Yang dibatalkan adalah catatan yang memang
 * keliru dibuat - sisi yang salah ditekan, atau perkara yang salah dibuka.
 *
 * Mengosongkan kolom waktu MENGGESER urutan antrian, dan karena itu jejaknya
 * dicatat: siapa yang membatalkan, kapan, dan atas alasan apa.
 */
router.post("/antrian/batal-hadir", requireInternalToken, async (req, res) => {
  try {
    const perkaraId = String(req.body?.perkaraId || "").trim();
    if (!perkaraId) {
      res.status(400).json({ ok: false, error: "perkaraId wajib diisi." });
      return;
    }

    const hasil = await kehadiranAntrianService.batalkanHadir({
      perkaraId,
      nomorPerkara: String(req.body?.nomorPerkara || ""),
      tanggal: String(req.body?.tanggal || ""),
      sisi: String(req.body?.sisi || ""),
      alasan: String(req.body?.alasan || ""),
      dibatalkanOleh: String(req.body?.dibatalkanOleh || ""),
    });

    res.status(hasil.ok ? 200 : 400).json(hasil);
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/**
 * Memberitahu yang tinggal satu atau dua antrian lagi.
 *
 * Uji kering adalah bawaan. Yang diberitahu hanya yang meninggalkan nomor
 * kontak saat mengambil - yang mengambil di mesin tidak meninggalkan apa pun,
 * dan menebaknya dari data perkara berarti mengirim pesan kepada orang yang
 * tidak pernah memintanya.
 */
router.post("/antrian/pemberitahuan", requireInternalToken, async (req, res) => {
  try {
    const jarak = Number(req.body?.jarak);
    const terapkan = req.body?.terapkan === true || String(req.body?.terapkan) === "1";

    const antrian = await antrianSidangService.petaAntrian();
    if (!antrian.terbaca) {
      res.status(503).json({ ok: false, error: antrian.alasan || "Antrian tidak terbaca." });
      return;
    }

    const kehadiran = await kehadiranAntrianService.kehadiranBelumDiberitahu(
      Object.keys(antrian.peta || {})
    );

    const pesan = kehadiranAntrianService.susunPesanHampirGiliran(antrian.peta, kehadiran, {
      jarak: Number.isFinite(jarak) ? jarak : 2,
    });

    if (!terapkan) {
      res.json({ ok: true, ujiKering: true, akanDikirim: pesan, dikirim: 0 });
      return;
    }

    let dikirim = 0;
    const gagal = [];
    for (const satu of pesan) {
      try {
        await messageQueueService.enqueueMessage({
          // Satu pesan per perkara per nomor per hari - bukan per putaran.
          // Tanpa kunci ini, penjadwal yang berjalan tiap menit akan
          // mengirimi orang yang sama berulang kali sampai gilirannya tiba.
          // Tanggalnya dari jam server, bukan dari daftar tanggal antrian:
          // daftar itu kosong ketika belum ada yang mengambil, dan kunci tanpa
          // tanggal membuat orang yang sama tidak pernah dapat diberitahu lagi
          // pada hari-hari berikutnya.
          idempotencyKey: `antrian-giliran:${satu.perkaraId}:${satu.waChatId}:${new Date()
            .toISOString()
            .slice(0, 10)}`,
          category: "party",
          notificationKey: "antrian-hampir-giliran",
          recipientNumber: satu.waChatId,
          recipientName: satu.nama,
          message: satu.teks,
          attachment: null,
          sourceApp: "aleta_bot",
          sourceFeature: "antrian_sidang",
          entityType: "perkara",
          entityId: satu.perkaraId,
          metadata: { nomorAntrian: satu.nomorAntrian, didepan: satu.didepan },
        });
        await kehadiranAntrianService.tandaiDiberitahu(satu.perkaraId, satu.waChatId);
        dikirim += 1;
      } catch (galat) {
        gagal.push({ perkaraId: satu.perkaraId, sebab: String(galat.message || galat).slice(0, 200) });
      }
    }

    res.json({ ok: true, ujiKering: false, akanDikirim: pesan, dikirim, gagal });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/**
 * Mendaftarkan jadwal sidang satu tanggal ke aplikasi antrian.
 *
 * ==========================================================================
 * SATU-SATUNYA JALUR ALETA MENULIS KE APLIKASI LAIN
 * ==========================================================================
 *
 * Jadwalnya diambil sendiri dari SIPP di sini, bukan dikirim pemanggil. Kalau
 * pemanggil yang mengirim daftar perkaranya, maka yang menentukan siapa masuk
 * antrian adalah layar - dan layar dapat keliru, tertinggal, atau disusun
 * sendiri oleh siapa pun yang memegang token. Yang berwenang menyatakan
 * "hari ini sidangnya perkara apa saja" hanyalah SIPP.
 *
 * Uji kering adalah bawaan: tanpa terapkan=1, yang dijawab hanya daftar apa
 * yang AKAN didaftarkan.
 */
/**
 * Nomor ruangan dari teks ruangan SIPP - "Ruang Sidang 2" menjadi 2.
 *
 * Yang tidak memuat angka dijawab null, bukan ditebak. Nomor ruang menentukan
 * ke mana orang dipanggil, dan menebaknya berarti mengirim orang ke ruangan
 * yang salah.
 */
function nomorRuang(teks) {
  const cocok = /(\d+)/.exec(String(teks || ""));
  return cocok ? Number(cocok[1]) : null;
}

router.post("/antrian/sinkron", requireInternalToken, async (req, res) => {
  try {
    const tanggal = String(req.body?.tanggal || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) {
      res.status(400).json({ ok: false, error: "Tanggal wajib berbentuk YYYY-MM-DD." });
      return;
    }

    const jadwal = await sippJadwalSidangService.daftarSidang({
      dari: tanggal,
      sampai: tanggal,
      batas: 500,
    });

    const hasil = await antrianSinkronService.sinkronkan({
      tanggal,
      sidang: (jadwal.sidang || []).map((baris) => ({
        perkaraId: baris.perkaraId,
        nomorPerkara: baris.nomorPerkara,
        tanggalSidang: baris.tanggalSidang,
        jamSidang: baris.jamSidang,
        majelisKode: baris.majelisKode,
        // SIPP menyimpan ruangan sebagai TEKS ("Ruang Sidang 1"), sedangkan
        // aplikasi antrian memakai nomor. Angkanya diambil bila memang ada di
        // dalam teks itu; bila tidak, dibiarkan kosong dan diisi aplikasi
        // antrian atau petugas. Menebak pemetaannya berarti memanggil orang ke
        // ruangan yang salah.
        noRuang: nomorRuang(baris.ruangan),
        ruanganId: null,
        sidangId: baris.sidangId,
        namaPetugas: baris.paniteraNama,
      })),
      terapkan: req.body?.terapkan === true || String(req.body?.terapkan) === "1",
      olehSiapa: String(req.body?.olehSiapa || ""),
    });

    res.status(hasil.ok ? 200 : 409).json(hasil);
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/**
 * Jadwal pertemuan MEDIASI pada satu rentang tanggal.
 *
 * Terpisah dari jadwal sidang: pertemuan mediasi tersimpan di tabelnya
 * sendiri dan tidak pernah ikut pada perkara_jadwal_sidang, sehingga layar
 * jadwal sidang tidak memperlihatkannya sama sekali.
 */
router.get("/sipp/jadwal-mediasi", requireInternalToken, async (req, res) => {
  try {
    const hasil = await sippJadwalSidangService.daftarJadwalMediasi({
      dari: String(req.query.dari || ""),
      sampai: String(req.query.sampai || ""),
      cari: String(req.query.cari || ""),
      batas: Number(req.query.batas) || 200,
    });
    res.json({ ok: true, ...hasil });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/** Skor kesiapan untuk sekumpulan sidang. */
router.post("/sipp/jadwal-sidang/kesiapan", requireInternalToken, async (req, res) => {
  try {
    const daftar = Array.isArray(req.body?.sidang) ? req.body.sidang : [];
    const hasil = await kesiapanSidangService.nilaiKesiapanBanyak(daftar, {
      batas: Number(req.body?.batas) || 50,
    });
    res.json({ ok: true, ...hasil });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/** Kesiapan satu sidang, lengkap dengan keadaan panggilan tiap pihak. */
router.get("/sipp/jadwal-sidang/kesiapan", requireInternalToken, async (req, res) => {
  try {
    const hasil = await kesiapanSidangService.nilaiKesiapanPerkara(String(req.query.nomor || ""), {
      sidangId: Number(req.query.sidangId) || 0,
      tanggalSidang: String(req.query.tanggalSidang || "") || null,
      agenda: String(req.query.agenda || ""),
    });
    res.json({ ok: Boolean(hasil), kesiapan: hasil });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/** Pengaturan tenggang waktu kepatutan panggilan. */
router.get("/ecourt/panggilan/pengaturan", requireInternalToken, (req, res) => {
  try {
    res.json({
      ok: true,
      pengaturan: ecourtPanggilanService.getSettings(),
      jalur: ecourtPanggilanService.JALUR,
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

router.post("/ecourt/panggilan/pengaturan", requireInternalToken, (req, res) => {
  try {
    const hasil = ecourtPanggilanService.saveSettings({
      hariElektronik: req.body?.hariElektronik,
      hariSuratTercatat: req.body?.hariSuratTercatat,
      hariBiasa: req.body?.hariBiasa,
      olehSiapa: String(req.body?.olehSiapa || ""),
    });
    res.status(hasil.ok ? 200 : 400).json({ ...hasil, jalur: ecourtPanggilanService.JALUR });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/** Mencari perkara dari potongan nomor - menerima angka saja. */
router.get("/sipp/status-perkara/cari", requireInternalToken, async (req, res) => {
  try {
    // ======================================================================
    // TAG DIJEMPUT LEBIH DULU, LALU DIKIRIM SEBAGAI DAFTAR ID
    // ======================================================================
    //
    // Terukur atas tag ghaib (67 perkara): syaratnya ditempel sebagai EXISTS
    // ke dalam kueri cariPerkara 2,98 detik; daftar idnya dijemput dulu lalu
    // dipakai sebagai IN 0,44 detik. Sebabnya tabel turunan yang harus
    // disusun utuh ketika syaratnya jarang.
    //
    // Beberapa tag digabung dengan DAN, yaitu IRISAN daftar idnya: "belum
    // putus DAN ghaib" adalah pertanyaan pengawasan yang nyata, sedangkan
    // gabungan ATAU hampir tidak pernah ditanyakan.
    //
    // Kunci yang tidak ada di katalog DIBUANG - tidak ada satu pun potongan
    // SQL yang datang dari peramban.
    const kunciTag = String(req.query.tag || "")
      .split(",")
      .map((x) => x.trim())
      // Object.hasOwn, BUKAN kebenaran TAG[x]. TAG adalah objek biasa yang
      // dibekukan, jadi TAG["toString"] dan TAG["constructor"] bernilai benar -
      // kunci itu lolos penyaring lalu melempar TypeError di idPerkaraTag
      // (tag.tabel undefined), dan rute menjawab 500. Bukan lubang keamanan:
      // tidak ada satu potongan SQL yang lolos. Tetapi penyaring katalog yang
      // seharusnya TERTUTUP ternyata berlubang, dan ?tag=toString memulangkan
      // 500 alih-alih hasil tanpa tag.
      .filter((x) => Object.hasOwn(tagPerkaraService.TAG, x))
      .slice(0, 8);
    // tagDari/tagSampai, BUKAN dari/sampai: `sampai` pada rute yang sama sudah
    // dipakai saringan tanggal pendaftaran. Satu nama untuk dua arti akan
    // membuat tanggal panel tag ikut memotong pendaftaran tanpa satu pun galat.
    const lingkupTag = {
      dasar: String(req.query.dasarTanggal || "daftar"),
      periode: String(req.query.periode || "total"),
      acuan: String(req.query.acuan || ""),
      dari: String(req.query.tagDari || ""),
      sampai: String(req.query.tagSampai || ""),
    };
    const rentangTag = tagPerkaraService.rentang(
      lingkupTag.periode,
      lingkupTag.acuan,
      lingkupTag.dari,
      lingkupTag.sampai
    );

    let idTag = null;
    // Tag yang daftarnya mentok di BATAS_ID. Itu berarti perkara TERTUA yang
    // cocok tidak ikut terbawa - dan tanpa disebutkan, layar akan tampak
    // menjawab pertanyaan yang sebenarnya hanya dijawab sebagian.
    const tagDipotong = [];
    for (const kunci of kunciTag) {
      const daftar = await tagPerkaraService.idPerkaraTag(kunci, lingkupTag);
      if (daftar.length >= tagPerkaraService.BATAS_ID) tagDipotong.push(kunci);
      idTag = idTag === null ? daftar : idTag.filter((x) => daftar.includes(x));
      if (idTag.length === 0) break;
    }

    // Berhalaman: batas (bawaan 25, pagu 500 dijaga layanan) dan lewati.
    const halaman = await sippStatusPerkaraService.cariPerkaraHalaman(String(req.query.cari || ""), {
      batas: Number(req.query.batas) || 25,
      lewati: Number(req.query.lewati) || 0,
      jenisPerkara: String(req.query.jenisPerkara || ""),
      status: String(req.query.status || ""),
      tahun: String(req.query.tahun || ""),
      alurPerkaraId: Number(req.query.alurPerkaraId) || 0,
      sejak: String(req.query.sejak || ""),
      sampai: String(req.query.sampai || ""),
      namaPihak: String(req.query.namaPihak || ""),
      petugas: String(req.query.petugas || ""),
      hakim: String(req.query.hakim || ""),
      panitera: String(req.query.panitera || ""),
      jurusita: String(req.query.jurusita || ""),
      statusPutusan: String(req.query.statusPutusan || ""),
      pertimbangan: String(req.query.pertimbangan || ""),
      amar: String(req.query.amar || ""),
      verstek: String(req.query.verstek || ""),
      alamatPihak: String(req.query.alamatPihak || ""),
      kua: String(req.query.kua || ""),
      relaas: String(req.query.relaas || ""),
      putusSejak: String(req.query.putusSejak || ""),
      putusSampai: String(req.query.putusSampai || ""),
      umur: String(req.query.umur || ""),
      ecourt: String(req.query.ecourt || ""),
      idTag,
      // Rentang waktunya tetap menyaring walau tidak ada tag yang menyala -
      // "diputus triwulan ini" adalah pertanyaan yang utuh dengan sendirinya.
      lingkupTanggal: tagPerkaraService.syaratLingkup(
        lingkupTag.dasar,
        rentangTag.dari,
        rentangTag.sampai
      ),
    });
    res.json({
      ok: true,
      perkara: halaman.perkara,
      // Masih ada baris sesudah halaman ini - layar meminta berikutnya
      // dengan lewati = lewati + batas.
      adaLagi: halaman.adaLagi,
      lewati: halaman.lewati,
      batas: halaman.batas,
      lapis: halaman.lapis,
      // Bagian yang gagal dibaca dari SIPP. Kosong berarti seluruh ruas
      // terbaca; berisi berarti kolom kosong itu BELUM TENTU memang kosong.
      ruasTakTerbaca: halaman.ruasTakTerbaca,
      tagDipakai: kunciTag,
      // Berapa perkara yang SUNGGUH cocok dengan tagnya, terlepas dari berapa
      // baris yang muat ditampilkan. Tanpa angka ini, batas baris membuat
      // "ghaib" tampak 25 perkara padahal 67.
      jumlahTag: Array.isArray(idTag) ? idTag.length : null,
      tagDipotong,
      // Pagunya ikut dikirim supaya layar tidak menuliskan angkanya sendiri.
      // Sebelumnya layar mencetak "3.000" sebagai teks, dan ketika pagunya
      // dinaikkan ke 20.000 peringatannya berbohong tentang angka yang
      // dipotong - tepat jenis penyimpangan yang membuat katalog tag ini
      // dikirim dari bot alih-alih disalin.
      batasId: tagPerkaraService.BATAS_ID,
      lingkupTag: rentangTag,
      // Pilihan saringan dikirim bersama hasilnya supaya layar tidak perlu
      // menyalin ulang daftar yang sama - dan tidak dapat menyimpang darinya.
      pilihanStatus: sippStatusPerkaraService.STATUS_PENCARIAN,
      pilihanAlur: sippStatusPerkaraService.ALUR_PENCARIAN,
      pilihanRelaas: sippStatusPerkaraService.RELAAS_PENCARIAN,
      pilihanUmur: sippStatusPerkaraService.UMUR_PENCARIAN,
      pilihanPutusan: sippStatusPerkaraService.PUTUSAN_PENCARIAN,
    });
  } catch (error) {
    // Habis waktu (juga saat menjemput daftar tag di atas) dikatakan dalam
    // bahasa orangnya, bukan "Query inactivity timeout" - lihat
    // galatPencarian() di layanannya. Galat lain diteruskan apa adanya.
    res.status(500).json({ ok: false, error: sippStatusPerkaraService.pesanGalatPencarian(error) });
  }
});

/**
 * Jumlah tiap tag pada layar awal Status Perkara.
 *
 * Terpisah dari pencariannya dengan sengaja: angkanya dihitung atas LINGKUP
 * RENTANG WAKTU saja, tidak pernah atas hasil yang sudah tersaring tag lain.
 * Aturan yang sama sudah berlaku pada kotak keadaan Jadwal Sidang - kalau
 * angkanya ikut menyusut, menyalakan satu tag membuat tag lain tampak nol dan
 * mustahil dilepas kembali.
 */
router.get("/sipp/status-perkara/tag", requireInternalToken, async (req, res) => {
  try {
    // ======================================================================
    // KATALOGNYA DAPAT DIJAWAB TANPA MENYENTUH SIPP
    // ======================================================================
    //
    // Nama tag, kelompoknya, nadanya, dan penjelasannya adalah tetapan yang
    // dibekukan di berkas layanan - tidak ada satu kueri pun di baliknya.
    // Jumlahnya yang mahal: terukur 6,6 detik untuk 88 tag pada lingkup
    // "Seluruhnya", sebab sembilan belas kueri harus menyisir tabel anaknya.
    //
    // Karena itu keduanya dapat diminta terpisah, dan layar meminta katalognya
    // lebih dahulu supaya panel berdiri SEKETIKA dengan nama-nama tagnya, lalu
    // angkanya menyusul. Panel yang diam enam setengah detik akan dianggap
    // rusak sebelum satu angka pun terlihat.
    const katalog = {
      tag: Object.entries(tagPerkaraService.TAG).map(([kunci, x]) => ({
        kunci,
        label: x.label,
        kelompok: x.kelompok,
        nada: x.nada,
        judul: x.judul,
      })),
      kelompok: tagPerkaraService.KELOMPOK_TAG,
      dasar: Object.entries(tagPerkaraService.DASAR_TANGGAL).map(([kunci, x]) => ({
        kunci,
        label: x.label,
      })),
      batasId: tagPerkaraService.BATAS_ID,
    };

    if (String(req.query.katalogSaja || "") === "1") {
      res.json({ ok: true, katalogSaja: true, jumlah: null, lingkup: null, ...katalog });
      return;
    }

    const hasil = await tagPerkaraService.hitungSemua({
      dasar: String(req.query.dasarTanggal || "daftar"),
      periode: String(req.query.periode || "total"),
      acuan: String(req.query.acuan || ""),
      dari: String(req.query.tagDari || ""),
      sampai: String(req.query.tagSampai || ""),
    });
    // Katalognya tetap ikut dikirim bersama angkanya - layar yang dibuka ulang
    // tidak perlu dua permintaan, dan yang memakai rute ini dari luar layar
    // tetap mendapat keduanya sekaligus.
    res.json({ ok: true, ...hasil, ...katalog });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/** Seluruh keadaan satu perkara. */
/**
 * Satu analisis lanjutan atas satu perkara.
 *
 * Terpisah dari status-perkara dengan sengaja: layar status sudah menjalankan
 * tiga puluh satu kueri, dan sebagian analisis di sini mengagregasi seluruh
 * register. Menyatukannya berarti MEMBUKA perkara ikut menunggu perhitungan
 * yang mungkin tidak akan dilihat siapa pun.
 */
router.get("/sipp/analisa", requireInternalToken, async (req, res) => {
  try {
    const hasil = await analisaLanjutService.jalankanAnalisa(
      String(req.query.nomor || ""),
      String(req.query.jenis || "")
    );
    res.status(hasil.ok ? 200 : 400).json(hasil);
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/** Daftar analisis yang tersedia - supaya layar tidak menyalinnya sendiri. */
router.get("/sipp/analisa/daftar", requireInternalToken, async (req, res) => {
  res.json({ ok: true, daftar: analisaLanjutService.DAFTAR_ANALISA });
});

/**
 * Beban kinerja konseptor putusan.
 *
 * Diukur di salinan satker sebelum dibuka: rentang setahun 2,1 detik, rentang
 * seluruh basis data (9.993 putusan) 5,4 detik. Gerbang menyerah pada 8 detik,
 * jadi "total" muat - tetapi tanpa marginnya banyak. Karena itu rincian per
 * perkara DIMATIKAN sendiri begitu rentangnya melewati seribu putusan: yang
 * dibaca orang pada rentang selebar itu memang bukan daftar sembilan ribu
 * perkara.
 */
router.get("/sipp/konseptor", requireInternalToken, async (req, res) => {
  try {
    const bobot = req.query.bobot ? JSON.parse(String(req.query.bobot)) : undefined;
    const hasil = await penilaianKonseptorService.hitung({
      periode: String(req.query.periode || "bulan"),
      acuan: String(req.query.acuan || ""),
      dari: String(req.query.dari || ""),
      sampai: String(req.query.sampai || ""),
      // Bawaannya TIDAK ditulis di sini. Layanannya sudah menentukan yang
      // pertama pada DASAR, dan bawaan kedua di rute akan tertinggal begitu
      // yang di layanan berganti - persis yang terjadi saat konseptor
      // menggantikan ketua majelis.
      dasar: String(req.query.dasar || ""),
      rinci: String(req.query.rinci || "") !== "0",
      // Usul bobot dari data satker dihitung hanya bila diminta - ia menyisir
      // ulang seluruh baris untuk kuadrat terkecilnya.
      usulBobot: String(req.query.usulBobot || "") === "1",
      bobot,
    });
    res.status(hasil.ok ? 200 : 400).json(hasil);
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/**
 * Peta perkara - sebaran wilayah, faktor, dan siapa yang datang.
 *
 * Diukur di salinan satker: rentang setahun 0,5 detik, seluruh basis data 4,8
 * detik. Batas waktunya sama dengan penilaian lanjutan.
 */
router.get("/sipp/peta-perkara", requireInternalToken, async (req, res) => {
  try {
    const hasil = await petaPerkaraService.hitung({
      kelompok: String(req.query.kelompok || "perceraian"),
      tingkat: String(req.query.tingkat || "kecamatan"),
      induk: String(req.query.induk || ""),
      periode: String(req.query.periode || "tahun"),
      acuan: String(req.query.acuan || ""),
      dari: String(req.query.dari || ""),
      sampai: String(req.query.sampai || ""),
    });
    res.status(hasil.ok ? 200 : 400).json(hasil);
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/**
 * Identitas para pihak satu perkara.
 *
 * ============================================================================
 * ALAMATNYA SENDIRI, DAN ITU DISENGAJA
 * ============================================================================
 *
 * Ini data pribadi, dan Status Perkara dibuka di meja yang kerap terlihat
 * orang lain. Menempelkannya ke muatan status berarti ia ikut terkirim pada
 * SETIAP perkara yang dibuka siapa pun - termasuk yang hanya ingin melihat
 * jadwal sidang - lalu ikut tersimpan di singgahan peramban.
 *
 * Di sini ia dibaca hanya ketika satu nama diketuk. NIK dan teleponnya
 * disamarkan di layanan, bukan di layar: yang disamarkan di layar tetap
 * melintasi jaringan dalam bentuk utuhnya.
 */
router.get("/sipp/identitas-pihak", requireInternalToken, async (req, res) => {
  try {
    const hasil = await identitasPihakService.identitasPihak(String(req.query.nomorPerkara || ""));
    res.status(hasil.ok ? 200 : 400).json(hasil);
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/**
 * 16OKT-F43: data pribadi satu perkara untuk anonimisasi mandiri portal (SELECT
 * saja). Nilainya utuh - hanya untuk portal sisi server; lihat kepala
 * entitasAnonimService.
 */
router.get("/sipp/entitas-anonim", requireInternalToken, async (req, res) => {
  try {
    const hasil = await require("../services/entitasAnonimService").entitasAnonim(String(req.query.nomorPerkara || ""));
    res.status(hasil.ok ? 200 : 400).json(hasil);
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/**
 * 17OKT-F44: putusan BHT hakim ketua yang sama, jenis sama - pembanding
 * Putusan Advance (SELECT saja). Nama pihak ikut hanya untuk disamarkan portal.
 */
router.get("/sipp/putusan-serupa", requireInternalToken, async (req, res) => {
  try {
    const hasil = await require("../services/putusanSerupaService").putusanSerupa(String(req.query.nomorPerkara || ""), {
      batas: Number(req.query.batas) || undefined,
    });
    res.status(hasil.ok ? 200 : 400).json(hasil);
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/**
 * Wilayah SIPP bertingkat untuk isian pihak/saksi dari foto KTP (perbaikan
 * 2 Okt 2026 butir 16, kontrak K5). ?induk= anak satu wilayah (kosong =
 * provinsi), ?kode= rantai sampai satu kode. SELECT saja; nilai pilihan
 * bersandi seperti yang dicetak SIPP - lihat kepala sippWilayahService.
 * Layanannya dimuat di sini, bukan di kepala berkas: berkas rute ini dipakai
 * bersama banyak fitur, dan tambahan ini cukup satu blok.
 */
router.get("/sipp/wilayah", requireInternalToken, async (req, res) => {
  try {
    const { status, body } = await require("../services/sippWilayahService").jawabRute(req.query || {});
    res.status(status).json(body);
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/**
 * Riwayat para pihak satu perkara - cerai berakta dan perkara lain orang yang
 * sama (permintaan 27 September 2026).
 *
 * Alamatnya sendiri, dibaca hanya ketika bagian Para pihak dibuka - bukan ikut
 * muatan Status Perkara. Aturan pengenalnya, ukurannya, dan indeks yang
 * dipakainya ada di kepala riwayatPihakService. Status HTTP-nya dari
 * jawabRute: masukan tidak sah 400, perkara tidak ada 404, galat SIPP 500.
 */
router.get("/sipp/riwayat-pihak", requireInternalToken, async (req, res) => {
  const { status, body } = await riwayatPihakService.jawabRute(req.query || {});
  res.status(status).json(body);
});

/**
 * Bantu data saksi (1.189.x butir 10-12): sebutan para pihak menurut jenis
 * perkara + saksi yang sudah ada (konteks), dan orang yang SUDAH ADA di tabel
 * pihak SIPP (ganda). SELECT saja; NIK tidak pernah keluar - lihat kepala
 * saksiBantuService. Ganda lewat POST supaya nama dan NIK tidak masuk alamat.
 */
router.get("/sipp/saksi-bantu/konteks", requireInternalToken, async (req, res) => {
  const { status, body } = await require("../services/saksiBantuService").jawabKonteks(req.query || {});
  res.status(status).json(body);
});

router.post("/sipp/saksi-bantu/ganda", requireInternalToken, async (req, res) => {
  const badan = req.body && typeof req.body === "object" ? req.body : {};
  const { status, body } = await require("../services/saksiBantuService").jawabGanda(badan);
  res.status(status).json(body);
});

/**
 * Lapisan panggilan tidak bertemu per desa.
 *
 * Dihitung HANYA dari baris bersandi Y/T/E (E = elektronik, dianggap bertemu) - sandi `ket_temu` berganti arti sejak
 * 2025, dan dihitung apa adanya dua tahun terakhir akan memulangkan 0% tidak
 * bertemu. Lihat keterangan panjang pada petaPerkaraService.
 */
router.get("/sipp/peta-perkara/relaas", requireInternalToken, async (req, res) => {
  try {
    const { dari, sampai } = petaPerkaraService.rentangPeriode(
      String(req.query.periode || "tahun"),
      String(req.query.acuan || ""),
      String(req.query.dari || ""),
      String(req.query.sampai || "")
    );
    const hasil = await petaPerkaraService.sebaranRelaas(dari, sampai);
    res.json({ ok: true, rentang: { dari, sampai }, ...hasil });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/**
 * Daftar perkara satu desa - dibaca ketika lingkaran peta diketuk.
 *
 * Tidak ikut muatan peta: sembilan ribu nomor perkara beserta tanggalnya
 * berukuran ratusan kilobita, dan yang dibuka orang paling banyak satu desa.
 */
router.get("/sipp/peta-perkara/desa", requireInternalToken, async (req, res) => {
  try {
    const { dari, sampai } = petaPerkaraService.rentangPeriode(
      String(req.query.periode || "tahun"),
      String(req.query.acuan || ""),
      String(req.query.dari || ""),
      String(req.query.sampai || "")
    );
    const hasil = await petaPerkaraService.perkaraDesa(
      String(req.query.kelompok || "perceraian"),
      String(req.query.kode || ""),
      dari,
      sampai,
      // Golongan bulatan yang diketuk - bila dikenal, ia menggantikan kelompok.
      String(req.query.golongan || "")
    );
    res.status(hasil.ok ? 200 : 400).json({ ...hasil, rentang: { dari, sampai } });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/**
 * Sembilan lapisan peta - biaya, faktor, kehadiran, berulang, perubahan,
 * jurusita, sidang keliling yang ada, dan desa tanpa perkara.
 *
 * Satu alamat, satu bentuk jawaban. Tiap lapisan dibaca HANYA ketika dipilih:
 * biaya panggilan sendiri menyisir seluruh transaksi pada rentangnya, dan
 * tidak ada gunanya dibayar oleh yang hanya melihat jumlah perkara.
 */
router.get("/sipp/peta-perkara/lapisan", requireInternalToken, async (req, res) => {
  try {
    const { dari, sampai } = petaPerkaraService.rentangPeriode(
      String(req.query.periode || "tahun"),
      String(req.query.acuan || ""),
      String(req.query.dari || ""),
      String(req.query.sampai || "")
    );
    const apa = String(req.query.apa || "");

    if (apa === "keliling") {
      const hasil = await lapisanPetaService.kelilingAda(dari, sampai);
      res.json({ ok: true, rentang: { dari, sampai }, ...hasil });
      return;
    }
    if (apa === "kosong") {
      const hasil = await lapisanPetaService.desaKosong(String(req.query.induk || ""));
      res.json({ ok: true, ...hasil });
      return;
    }

    // Daftar tertutup, dan dibaca dengan hasOwnProperty: nama fungsi tidak
    // pernah datang dari peramban. Lihat keterangan PENGERJA pada layanan
    // analisis - "constructor" dan "toString" pernah menembus daftar yang
    // tampak tertutup.
    const kerja = Object.prototype.hasOwnProperty.call(lapisanPetaService.LAPISAN, apa)
      ? lapisanPetaService.LAPISAN[apa]
      : null;
    if (typeof kerja !== "function") {
      res.status(400).json({ ok: false, alasan: "lapisan_tidak_dikenali" });
      return;
    }
    const hasil = await kerja(dari, sampai);
    res.json({ ok: true, apa, rentang: { dari, sampai }, ...hasil });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/**
 * ============================================================================
 * SEBARAN RELAAS PER JURUSITA
 * ============================================================================
 *
 * Kebalikan arah dari lapisan peta "Jurusita yang melayani": bukan "siapa yang
 * melayani desa ini", melainkan "desa mana saja yang dikerjakan orang ini,
 * berapa banyak, dan berapa yang kembali".
 *
 * Rentangnya dibaca dengan penghitung yang sama dengan lapisan peta, supaya
 * kedua layar tidak pernah menjawab rentang yang berbeda untuk pilihan yang
 * sama.
 */
router.get("/sipp/sebaran-jurusita", requireInternalToken, async (req, res) => {
  try {
    const { dari, sampai } = petaPerkaraService.rentangPeriode(
      String(req.query.periode || "tahun"),
      String(req.query.acuan || ""),
      String(req.query.dari || ""),
      String(req.query.sampai || "")
    );
    const hasil = await lapisanPetaService.sebaranJurusita(dari, sampai);
    res.json({ ok: true, ...hasil });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/**
 * ============================================================================
 * CETAK MASSAL RELAAS - SATU TANGGAL, PER JURU SITA
 * ============================================================================
 *
 * Dua jenis dokumen sekaligus - relaas panggilan sidang dan pemberitahuan
 * putusan - dikelompokkan per juru sita, supaya satu lembar cetak memuat
 * SELURUH yang harus dikerjakan orang itu pada hari itu.
 *
 * `tanggal` kosong berarti hari ini menurut zona pengadilan (Asia/Makassar),
 * dan zonanya ditentukan di layanan, bukan mengikuti zona mesin: hasil yang
 * berpindah hari pukul empat sore tidak menimbulkan galat - hanya daftar yang
 * salah hari.
 *
 * Tanggal yang bentuknya bukan YYYY-MM-DD dijawab 400, tidak diperbaiki
 * diam-diam. Tanggal yang benar tetapi tidak ada isinya dijawab 200 dengan
 * daftar kosong beserta sebabnya pada `catatan` - hari tanpa panggilan memang
 * ada, dan itu bukan kegagalan.
 *
 * ============================================================================
 * SEJAK 25 SEPTEMBER 2026: DUA BELAHAN, DAN PEMANGGIL WAJIB MEMBEDAKANNYA
 * ============================================================================
 *
 * Tiap baris membawa `sudahAdaRelaas`, dan artinya menentukan gunanya:
 *
 *   true    relaas atau pemberitahuan yang SUDAH tercatat pada tanggal itu -
 *           rekap, untuk dicetak ulang;
 *   false   sidang atau putusan yang jatuh pada tanggal itu tetapi relaasnya
 *           BELUM ada - pekerjaan yang belum dikerjakan.
 *
 * `ringkas.relaas` dan `ringkas.pemberitahuan` menghitung belahan pertama saja,
 * `ringkas.belumAdaRelaas` belahan kedua, dan ketiganya berjumlah sama dengan
 * seluruh barisnya. Karena itu "tanggal ini kosong" TIDAK boleh diputuskan dari
 * dua angka pertama saja: 22 September 2026 terukur relaas 0 dan pemberitahuan 0
 * sementara 26 baris pekerjaan menunggu di hari yang sama (27 sebelum sandi 1
 * "Semua Pihak" dibaca "tidak-perlu"; yang dihadiri semua pihak dihitung pada
 * `ringkas.tidakPerlu`, bukan menjadi baris).
 *
 * Tiap baris juga membawa `golongan` (sidang-pertama, sidang-ditunda,
 * sidang-lanjutan, ikrar-talak, pemberitahuan-putusan, atau "" bila sidangnya
 * tidak terbaca), `urutanSidang`, `dihadiriOleh` apa adanya, dan
 * `pihakDipanggil`. Sebab tiap keputusan itu ada di relaasMassalService.
 */
router.get("/sipp/relaas-massal", requireInternalToken, async (req, res) => {
  try {
    const hasil = await relaasMassalService.relaasMassal(String(req.query.tanggal || ""));
    res.status(hasil.ok ? 200 : 400).json(hasil);
  } catch (error) {
    // Kegagalan TIDAK diubah menjadi daftar kosong. Lembar cetak yang kosong
    // karena kueri gagal tidak dapat dibedakan dari hari yang memang lengang,
    // dan juru sita akan membaca "tidak ada panggilan hari ini".
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/**
 * ============================================================================
 * ANTRIAN CETAK RELAAS HARIAN - DOKUMEN YANG LAHIR PADA HARI MENCETAK
 * ============================================================================
 *
 * Dipakai tombol cetak relaas di antrian ALETA Sidang (tab Jadwal Sidang
 * ALETA e-Court). BUKAN rekap seperti /sipp/relaas-massal: "hari itu" di sini
 * hari juru sita MENCETAK - perkara yang didaftarkan atau ditetapkan hari
 * sidangnya hari itu, sidang hari itu yang ditunda, jadwal yang diinput hari
 * itu, dan putusan hari itu. Aturan tiap jalan masuk dan ukurannya ada di
 * relaasMassalService.relaasCetakHarian.
 *
 * `tanggal` kosong = hari ini zona Asia/Makassar; bentuk lain atau tanggal
 * yang tidak ada di kalender -> 400, tidak diperbaiki diam-diam. Kueri yang
 * gagal -> 500 beserta sebabnya, BUKAN antrian kosong: antrian kosong karena
 * galat terbaca "hari ini tidak ada yang harus dicetak".
 *
 * Rute ini hanya MEMBACA SIPP. Tidak ada yang ditulis ke doc_relaas, edoc_pbt,
 * atau tabel SIPP lain.
 */
router.get("/sipp/relaas-cetak", requireInternalToken, async (req, res) => {
  try {
    const hasil = await relaasMassalService.relaasCetakHarian(String(req.query.tanggal || ""));
    res.status(hasil.ok ? 200 : 400).json(hasil);
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/** Menu jenis perkara - disusun dari yang SUNGGUH diputus, bukan dari daftar. */
router.get("/sipp/peta-perkara/menu", requireInternalToken, async (req, res) => {
  try {
    res.json({
      ok: true,
      menu: await petaPerkaraService.daftarJenis(),
      tingkat: petaPerkaraService.TINGKAT,
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/** Pilihan periode, dasar konseptor dan bobot awalnya - supaya layar tidak menyalinnya. */
router.get("/sipp/konseptor/pilihan", requireInternalToken, (req, res) => {
  res.json({
    ok: true,
    periode: penilaianKonseptorService.PERIODE,
    dasar: penilaianKonseptorService.DASAR,
    bobotAwal: penilaianKonseptorService.BOBOT_AWAL,
  });
});

/**
 * Bahan penyusun perintah putusan - seluruhnya baca.
 *
 * Yang dikembalikan bukan perintahnya, melainkan BAHANnya: riwayat sidang,
 * mediasi, saksi, kuasa, berkas. Perangkaiannya dikerjakan di layar supaya
 * yang menyusun dapat melihat perubahan tiap kali ia mengubah pilihan.
 */
router.get("/sipp/prompt-putusan", requireInternalToken, async (req, res) => {
  try {
    const hasil = await promptPutusanService.bahanPrompt(String(req.query.nomor || ""));
    res.status(hasil.ok ? 200 : 400).json(hasil);
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/* ==========================================================================
 * PENILAIAN DAN PENGAWASAN
 * ========================================================================== */

/**
 * Daftar penilaian yang terdaftar pada kerangka.
 *
 * Yang dipulangkan termasuk cara hitung dan ambang tiap penilaian - supaya
 * layar tidak perlu menebak, dan supaya panel "cara hitung" tidak menjadi
 * salinan kedua yang perlahan menyimpang dari yang sebenarnya dipakai.
 */
router.get("/penilaian/daftar", requireInternalToken, async (req, res) => {
  try {
    penilaianKetaatanService.daftarkanSemua();
    penilaianMutuDataService.daftarkanSemua();
    penilaianKeuanganService.daftarkanSemua();
    penilaianTahapanService.daftarkanSemua();
    penilaianKetepatanInputService.daftarkanSemua();
    penilaianSebaranService.daftarkanSemua();
    penilaianRegisterService.daftarkanSemua();
    penilaianLaporanService.daftarkanSemua();
    penilaianDipa04Service.daftarkanSemua();
    penilaianIntegritasWaktuService.daftarkanSemua();
    penilaianBebanKerjaService.daftarkanSemua();
    penilaianMutuPutusanService.daftarkanSemua();
    penilaianPelayananService.daftarkanSemua();
    penilaianStatistikService.daftarkanSemua();
    penilaianKeuanganPerkaraService.daftarkanSemua();
    penilaianMetodeAnalisisService.daftarkanSemua();
    penilaianJejakKetaatanService.daftarkanSemua();
    penilaianRaporLanjutService.daftarkanSemua();
    penilaianLaporanLanjutService.daftarkanSemua();
    penilaianIntegritasService.daftarkanSemua();
    penilaianSisaPanjarService.daftarkanSemua();
    sebaranPerkaraService.daftarkanSemua();
    const daftar = kerangkaPenilaianService.daftar();
    res.json({
      ok: true,
      jumlah: daftar.length,
      penilaian: daftar,
      periode: periodePenilaianService.PERIODE.map((p) => ({
        jenis: p.jenis,
        label: p.label,
        satuan: p.satuan,
      })),
      catatan:
        "Tidak satu pun penilaian di sini boleh dipakai membina sebelum angkanya disandingkan dengan angka dari luar ALETA.",
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/**
 * Menjalankan satu penilaian pada satu jendela periode.
 *
 * Bukti tiap satuan sengaja DIBATASI pada jawaban ini - daftar lengkapnya dapat
 * berisi puluhan ribu baris, dan mengirimkannya seluruhnya akan membuat layar
 * menunggu sesuatu yang tidak akan dibaca sekaligus. Jumlah sebenarnya tetap
 * disebut, sehingga tidak ada yang menyangka itu seluruhnya.
 */
router.get("/penilaian/jalankan", requireInternalToken, async (req, res) => {
  try {
    penilaianKetaatanService.daftarkanSemua();
    penilaianMutuDataService.daftarkanSemua();
    penilaianKeuanganService.daftarkanSemua();
    penilaianTahapanService.daftarkanSemua();
    penilaianKetepatanInputService.daftarkanSemua();
    penilaianSebaranService.daftarkanSemua();
    penilaianRegisterService.daftarkanSemua();
    penilaianLaporanService.daftarkanSemua();
    penilaianDipa04Service.daftarkanSemua();
    penilaianIntegritasWaktuService.daftarkanSemua();
    penilaianBebanKerjaService.daftarkanSemua();
    penilaianMutuPutusanService.daftarkanSemua();
    penilaianPelayananService.daftarkanSemua();
    penilaianStatistikService.daftarkanSemua();
    penilaianKeuanganPerkaraService.daftarkanSemua();
    penilaianMetodeAnalisisService.daftarkanSemua();
    penilaianJejakKetaatanService.daftarkanSemua();
    penilaianRaporLanjutService.daftarkanSemua();
    penilaianLaporanLanjutService.daftarkanSemua();
    penilaianIntegritasService.daftarkanSemua();
    penilaianSisaPanjarService.daftarkanSemua();
    sebaranPerkaraService.daftarkanSemua();

    const kunci = String(req.query.kunci || "").trim();
    const jenisPeriode = String(req.query.periode || "bulanan").trim();
    const acuan = String(req.query.acuan || "").trim() || periodePenilaianService.tanggalHariIni();
    const batasBukti = Math.min(50, Math.max(0, Number(req.query.bukti) || 10));

    const hasil = await kerangkaPenilaianService.jalankan(kunci, jenisPeriode, acuan);
    if (!hasil.ok) {
      res.status(400).json(hasil);
      return;
    }

    const keadaanSanding = penyandinganService.keadaanPenilaian(kunci);
    res.json({
      ...hasil,
      acuan,
      penyandingan: {
        keadaan: keadaanSanding.keadaan,
        penanda: penyandinganService.penandaTerbaca(kunci),
      },
      satuan: hasil.satuan.map((s) => ({
        ...s,
        jumlahBukti: Array.isArray(s.bukti) ? s.bukti.length : 0,
        bukti: Array.isArray(s.bukti) ? s.bukti.slice(0, batasBukti) : [],
        buktiDipotong: Array.isArray(s.bukti) && s.bukti.length > batasBukti,
      })),
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/* ==========================================================================
 * ALETA e-AUDIT
 * ========================================================================== */

/**
 * Katalog seratus delapan puluh lima butir beserta keadaan pengerjaannya.
 *
 * Keadaannya DIHITUNG di sini, bukan disimpan. Menyimpannya berarti sebuah
 * angka yang perlahan usang - dan angka "berapa yang sudah selesai" adalah
 * angka yang paling tidak boleh usang pada aplikasi yang sedang dibangun.
 *
 * Yang dihitung mencakup tiga hal yang mudah tersembunyi: butir yang
 * disambungkan ke penilaian yang ternyata tidak terdaftar (sambungan putus),
 * penilaian yang berjalan tanpa tercatat di katalog maupun di daftar
 * pengecualian (terdaftar tanpa tempat), dan butir yang baru tersambung
 * SEBAGIAN beserta apa yang masih kurang.
 */
router.get("/e-audit/katalog", requireInternalToken, async (req, res) => {
  try {
    penilaianKetaatanService.daftarkanSemua();
    penilaianMutuDataService.daftarkanSemua();
    penilaianKeuanganService.daftarkanSemua();
    penilaianTahapanService.daftarkanSemua();
    penilaianKetepatanInputService.daftarkanSemua();
    penilaianSebaranService.daftarkanSemua();
    penilaianRegisterService.daftarkanSemua();
    penilaianLaporanService.daftarkanSemua();
    penilaianDipa04Service.daftarkanSemua();
    penilaianIntegritasWaktuService.daftarkanSemua();
    penilaianBebanKerjaService.daftarkanSemua();
    penilaianMutuPutusanService.daftarkanSemua();
    penilaianPelayananService.daftarkanSemua();
    penilaianStatistikService.daftarkanSemua();
    penilaianKeuanganPerkaraService.daftarkanSemua();
    penilaianMetodeAnalisisService.daftarkanSemua();
    penilaianJejakKetaatanService.daftarkanSemua();
    penilaianRaporLanjutService.daftarkanSemua();
    penilaianLaporanLanjutService.daftarkanSemua();
    penilaianIntegritasService.daftarkanSemua();
    penilaianSisaPanjarService.daftarkanSemua();
    sebaranPerkaraService.daftarkanSemua();

    // Sejak ada bentuk penilaian kedua, "yang terdaftar" datang dari DUA
    // daftar. Membaca satu saja membuat seluruh butir sebaran terbaca sebagai
    // sambungan yang putus - padahal ia justru berjalan.
    raporAparaturService.daftarkanSemua();
    const terdaftar = [
      ...kerangkaPenilaianService.daftar().map((d) => d.kunci),
      ...kerangkaSebaranService.daftar().map((d) => d.kunci),
      ...kerangkaRaporService.daftar().map((d) => d.kunci),
    ];
    // Bab 1 mengukur MESINNYA, bukan pengadilan - dan kemampuan mesin tidak
    // punya kunci penilaian untuk ditunjuk. Tanpa daftar ini keenam butirnya
    // selamanya terbaca "belum", padahal seluruhnya sudah tertanam sebagai
    // kontrak yang ditegakkan saat pendaftaran.
    //
    // Diperiksa dengan DIJALANKAN, bukan diakui: lihat kemampuanMesinService.
    const kemampuan = kemampuanMesinService.terpenuhi();
    const keadaan = katalogEAuditService.keadaan(terdaftar, kemampuan);
    const petaKeadaan = Object.create(null);
    keadaan.perButir.forEach((x) => {
      petaKeadaan[x.kode] = x;
    });

    res.json({
      ok: true,
      bab: katalogEAuditService.daftarBab(),
      bentuk: katalogEAuditService.BENTUK,
      mutuRuas: katalogEAuditService.MUTU_RUAS,
      butir: katalogEAuditService.daftarButir().map((b) => ({
        ...b,
        keadaan: petaKeadaan[b.kode] ? petaKeadaan[b.kode].keadaan : "belum",
        kunci: petaKeadaan[b.kode] ? petaKeadaan[b.kode].kunci : null,
        catatanSambungan: petaKeadaan[b.kode] ? petaKeadaan[b.kode].catatan : "",
      })),
      ringkas: {
        jumlahButir: keadaan.jumlahButir,
        penuh: keadaan.penuh,
        sebagian: keadaan.sebagian,
        belum: keadaan.belum,
        putus: keadaan.putus,
        diLuarKatalog: keadaan.diLuarKatalog,
        tanpaTempat: keadaan.tanpaTempat,
      },
      diLuarKatalog: katalogEAuditService.DI_LUAR_KATALOG,
      cela: katalogEAuditService.celaKatalog(),
      catatan:
        "Katalog ini daftar, bukan mesin. Butir yang belum tersambung tetap ditampilkan supaya sisa pekerjaan terlihat, bukan disembunyikan.",
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/**
 * Rapor kinerja aparatur Bab 7 - penilaian dipecah menurut orangnya.
 *
 * ============================================================================
 * RUTE TERSENDIRI DARI /e-audit/rapor
 * ============================================================================
 *
 * Rute /e-audit/rapor memecah SATU penilaian menurut dimensi yang diminta -
 * berguna saat menelusuri satu angka. Rute ini menyusun rapor yang sudah
 * DIDAFTARKAN pada katalog Bab 7: beberapa penilaian sekaligus, berdampingan
 * pada satu tabel orang lawan penilaian.
 *
 * Yang tidak dipulangkan keduanya: angka gabungan. Menggabungkan beberapa
 * penilaian menjadi satu angka menuntut pembobotan, dan pembobotan adalah
 * kewenangan pimpinan pengadilan.
 */
router.get("/e-audit/rapor-aparatur", requireInternalToken, async (req, res) => {
  try {
    penilaianTahapanService.daftarkanSemua();
    penilaianKetepatanInputService.daftarkanSemua();
    penilaianSebaranService.daftarkanSemua();
    penilaianRegisterService.daftarkanSemua();
    penilaianLaporanService.daftarkanSemua();
    penilaianDipa04Service.daftarkanSemua();
    penilaianIntegritasWaktuService.daftarkanSemua();
    penilaianBebanKerjaService.daftarkanSemua();
    penilaianMutuPutusanService.daftarkanSemua();
    penilaianPelayananService.daftarkanSemua();
    penilaianStatistikService.daftarkanSemua();
    penilaianKeuanganPerkaraService.daftarkanSemua();
    penilaianMetodeAnalisisService.daftarkanSemua();
    penilaianJejakKetaatanService.daftarkanSemua();
    penilaianRaporLanjutService.daftarkanSemua();
    penilaianLaporanLanjutService.daftarkanSemua();
    raporAparaturService.daftarkanSemua();

    const kunci = String(req.query.kunci || "").trim();
    const jenisPeriode = String(req.query.periode || "bulanan").trim();
    const acuan = String(req.query.acuan || "").trim() || periodePenilaianService.tanggalHariIni();

    if (!kunci) {
      res.json({
        ok: true,
        rapor: kerangkaRaporService.daftar(),
        belumDapatDibangun: raporAparaturService.BELUM_DAPAT,
        catatan:
          "Sepuluh butir Bab 7 belum dapat dibangun, dan masing-masing menyebutkan penghalangnya. Butir yang hilang tanpa keterangan terbaca seperti butir yang memang tidak ada.",
      });
      return;
    }

    const hasil = await kerangkaRaporService.jalankan(kunci, jenisPeriode, acuan);
    if (!hasil.ok) {
      res.status(400).json(hasil);
      return;
    }
    res.json(hasil);
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/**
 * Menjalankan satu butir SEBARAN.
 *
 * ============================================================================
 * RUTE TERSENDIRI, SEBAB JAWABANNYA MEMANG BERBEDA BENTUK
 * ============================================================================
 *
 * Butir sebaran tidak menghasilkan nilai, tidak punya pembilang, dan tidak
 * punya penyebut. Memaksakannya lewat rute penilaian biasa akan menuntut
 * jawaban itu membawa ruas kosong yang tidak berarti apa-apa - dan ruas kosong
 * yang bernama "nilai" pada akhirnya akan diisi seseorang.
 *
 * Yang dipulangkan gambar keadaannya: daftar kelompok beserta jumlah dan
 * bagiannya, ditambah tiga keterangan yang menentukan apakah gambar itu boleh
 * dipercaya - cakupan datanya, kecukupan barisnya, dan apakah kelompoknya
 * berasal dari ruas yang diketik bebas.
 */
router.get("/e-audit/sebaran", requireInternalToken, async (req, res) => {
  try {
    sebaranPerkaraService.daftarkanSemua();

    const kunci = String(req.query.kunci || "").trim();
    const jenisPeriode = String(req.query.periode || "bulanan").trim();
    const acuan = String(req.query.acuan || "").trim() || periodePenilaianService.tanggalHariIni();
    const batasBukti = Math.min(50, Math.max(0, Number(req.query.bukti) || 10));

    if (!kunci) {
      res.json({
        ok: true,
        daftar: kerangkaSebaranService.daftar(),
        catatan:
          "Butir sebaran menggambarkan keadaan, bukan menilai capaian. Ia tidak menghasilkan angka nol sampai seratus.",
      });
      return;
    }

    const hasil = await kerangkaSebaranService.jalankan(kunci, jenisPeriode, acuan);
    if (!hasil.ok) {
      res.status(400).json(hasil);
      return;
    }

    res.json({
      ...hasil,
      acuan,
      satuan: hasil.satuan.map((s) => ({
        ...s,
        jumlahBukti: Array.isArray(s.bukti) ? s.bukti.length : 0,
        bukti: Array.isArray(s.bukti) ? s.bukti.slice(0, batasBukti) : [],
        buktiDipotong: Array.isArray(s.bukti) && s.bukti.length > batasBukti,
      })),
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/**
 * Rapor kinerja aparatur - satu penilaian, dipecah menurut orangnya.
 *
 * ============================================================================
 * GERBANGNYA DIJALANKAN SEBELUM RAPORNYA DIPULANGKAN
 * ============================================================================
 *
 * Enam syarat harus terpenuhi sebelum nilai per orang boleh ditampilkan. Bila
 * salah satu belum, yang dibuang hanya NILAInya - nama, pembilang, dan
 * penyebutnya tetap ada, beserta daftar syarat yang belum terpenuhi.
 *
 * Membuang seluruh rapornya akan membuat orang menyangka tidak ada datanya;
 * membiarkan nilainya tampil akan membuat nama seseorang tertulis di sebelah
 * angka yang belum layak dipakai menilainya.
 *
 * ============================================================================
 * DIMENSI YANG DITAWARKAN HANYA YANG BENAR-BENAR ADA
 * ============================================================================
 *
 * Tidak semua penilaian membawa nama petugas pada barisnya. Ketaatan tenggang
 * pemanggilan membawa juru sita; kelengkapan ruas wajib tidak membawa siapa
 * pun. Meminta rapor per orang atas penilaian yang tidak menyebut orang akan
 * menghasilkan satu kelompok bernama "(tidak tercatat)" berisi segalanya - dan
 * itu terbaca seperti temuan padahal hanya salah pertanyaan.
 */
/**
 * MS06 - berkas pengawasan siap kirim.
 *
 * ============================================================================
 * SATU BERKAS, BUKAN EMPAT LAYAR
 * ============================================================================
 *
 * Pengawas tidak memakai ALETA. Yang sampai kepadanya sebuah berkas, dan
 * berkas itu harus berdiri sendiri berbulan-bulan sesudah dikirim - ketika
 * datanya sudah berubah, ketika ambangnya mungkin sudah diganti, dan ketika
 * tidak ada seorang pun yang ingat bagaimana angka itu dahulu dihitung.
 *
 * Karena itu nilai, bukti, temuan, tanggal hitung, dan aturan yang berlaku
 * dirangkai jadi satu. Berkas yang kurang satu bagian DITOLAK beserta
 * sebabnya - tidak dikirim setengah, sebab yang menerimanya tidak akan tahu
 * bagian mana yang hilang.
 */
router.get("/e-audit/berkas", requireInternalToken, async (req, res) => {
  try {
    penilaianKetaatanService.daftarkanSemua();
    penilaianMutuDataService.daftarkanSemua();
    penilaianKeuanganService.daftarkanSemua();
    penilaianTahapanService.daftarkanSemua();
    penilaianKetepatanInputService.daftarkanSemua();
    penilaianSebaranService.daftarkanSemua();
    penilaianRegisterService.daftarkanSemua();
    penilaianLaporanService.daftarkanSemua();
    penilaianDipa04Service.daftarkanSemua();
    penilaianIntegritasWaktuService.daftarkanSemua();
    penilaianBebanKerjaService.daftarkanSemua();
    penilaianMutuPutusanService.daftarkanSemua();
    penilaianPelayananService.daftarkanSemua();
    penilaianStatistikService.daftarkanSemua();
    penilaianKeuanganPerkaraService.daftarkanSemua();
    penilaianMetodeAnalisisService.daftarkanSemua();
    penilaianJejakKetaatanService.daftarkanSemua();
    penilaianRaporLanjutService.daftarkanSemua();
    penilaianLaporanLanjutService.daftarkanSemua();
    penilaianIntegritasService.daftarkanSemua();
    penilaianSisaPanjarService.daftarkanSemua();

    const kunci = String(req.query.kunci || "").trim();
    if (!kunci) {
      res.status(400).json({ ok: false, alasan: "kunci_penilaian_kosong" });
      return;
    }

    const jenisPeriode = String(req.query.periode || "bulanan").trim();
    const acuan = String(req.query.acuan || "").trim() || periodePenilaianService.tanggalHariIni();

    const hasil = await berkasPengawasanService.susun(kunci, jenisPeriode, acuan);
    if (!hasil.ok) {
      res.status(400).json(hasil);
      return;
    }

    res.json({ ok: true, ...hasil });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

router.get("/e-audit/rapor", requireInternalToken, async (req, res) => {
  try {
    penilaianKetaatanService.daftarkanSemua();
    penilaianMutuDataService.daftarkanSemua();
    penilaianKeuanganService.daftarkanSemua();
    penilaianTahapanService.daftarkanSemua();
    penilaianKetepatanInputService.daftarkanSemua();
    penilaianSebaranService.daftarkanSemua();
    penilaianRegisterService.daftarkanSemua();
    penilaianLaporanService.daftarkanSemua();
    penilaianDipa04Service.daftarkanSemua();
    penilaianIntegritasWaktuService.daftarkanSemua();
    penilaianBebanKerjaService.daftarkanSemua();
    penilaianMutuPutusanService.daftarkanSemua();
    penilaianPelayananService.daftarkanSemua();
    penilaianStatistikService.daftarkanSemua();
    penilaianKeuanganPerkaraService.daftarkanSemua();
    penilaianMetodeAnalisisService.daftarkanSemua();
    penilaianJejakKetaatanService.daftarkanSemua();
    penilaianRaporLanjutService.daftarkanSemua();
    penilaianLaporanLanjutService.daftarkanSemua();
    penilaianIntegritasService.daftarkanSemua();
    penilaianSisaPanjarService.daftarkanSemua();
    sebaranPerkaraService.daftarkanSemua();

    const kunci = String(req.query.kunci || "").trim();
    const jenisPeriode = String(req.query.periode || "bulanan").trim();
    const acuan = String(req.query.acuan || "").trim() || periodePenilaianService.tanggalHariIni();
    const dimensi = String(req.query.dimensi || "").trim();

    const hasil = await kerangkaPenilaianService.jalankan(kunci, jenisPeriode, acuan);
    if (!hasil.ok) {
      res.status(400).json(hasil);
      return;
    }

    // Dimensi yang tersedia dibaca dari baris buktinya sendiri - ruas bertipe
    // teks yang bukan tanggal, bukan nomor perkara, dan bukan penanda.
    const contoh = hasil.satuan.flatMap((s) => s.bukti).slice(0, 200);
    const BUKAN_DIMENSI = new Set([
      "kunci",
      "nomorPerkara",
      "memenuhi",
      "sebabTidakMemenuhi",
      "ruasKosong",
      "mendahuluiAcuan",
    ]);
    const calon = new Map();
    contoh.forEach((b) => {
      Object.keys(b).forEach((k) => {
        if (BUKAN_DIMENSI.has(k)) return;
        const v = b[k];
        if (typeof v !== "string" || !v.trim()) return;
        if (/^\d{4}-\d{2}-\d{2}/.test(v)) return;
        calon.set(k, (calon.get(k) || 0) + 1);
      });
    });
    const tersedia = [...calon.keys()].sort();

    if (!dimensi) {
      res.json({
        ok: true,
        kunci: hasil.kunci,
        judul: hasil.judul,
        dimensiTersedia: tersedia,
        catatan:
          "Sebutkan dimensi untuk menyusun rapornya. Yang ditawarkan hanya ruas yang benar-benar ada pada baris bukti penilaian ini.",
      });
      return;
    }

    if (!tersedia.includes(dimensi)) {
      res.status(400).json({
        ok: false,
        alasan: `Penilaian ini tidak membawa ruas "${dimensi}" pada baris buktinya.`,
        dimensiTersedia: tersedia,
      });
      return;
    }

    const rapor = raporBerjenjangService.berjenjang(hasil, dimensi);
    const gerbang = gerbangRaporAparaturService.terbitkan(rapor, {
      penilaian: hasil.kunci,
      tanggal: acuan,
    });

    res.json({ ok: true, dimensi, dimensiTersedia: tersedia, ...gerbang });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/**
 * Dua puluh alat di dalam penilaian beserta keadaannya.
 *
 * Keadaannya dihitung dari berkas yang benar-benar ada di kedua sisi - mesin
 * dan layar - bukan dari penanda yang ditulis tangan. Alat yang mesinnya ada
 * tetapi layarnya belum bukan "selesai": angkanya terhitung tetapi tidak
 * terlihat siapa pun.
 */
router.get("/e-audit/alat", requireInternalToken, async (req, res) => {
  try {
    res.json({
      ok: true,
      alat: alatPenilaianService.daftar(),
      ringkas: alatPenilaianService.ringkas(),
      cela: alatPenilaianService.celaAlat(),
      catatan:
        "Alat menempel pada setiap layar penilaian, bukan menjadi menu tersendiri. Yang belum lengkap menyebutkan apa yang menghalanginya.",
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/**
 * Satu butir katalog beserta keadaannya.
 *
 * Bila butirnya sudah tersambung, definisi penilaiannya ikut dipulangkan -
 * cara hitung, ambang, dan lantainya - supaya layar tidak perlu memanggil dua
 * kali untuk menggambar satu halaman.
 */
router.get("/e-audit/butir", requireInternalToken, async (req, res) => {
  try {
    const b = katalogEAuditService.butir(req.query.kode);
    if (!b) {
      res.status(400).json({ ok: false, alasan: "butir_tidak_dikenali" });
      return;
    }

    penilaianKetaatanService.daftarkanSemua();
    penilaianMutuDataService.daftarkanSemua();
    penilaianKeuanganService.daftarkanSemua();
    penilaianTahapanService.daftarkanSemua();
    penilaianKetepatanInputService.daftarkanSemua();
    penilaianSebaranService.daftarkanSemua();
    penilaianRegisterService.daftarkanSemua();
    penilaianLaporanService.daftarkanSemua();
    penilaianDipa04Service.daftarkanSemua();
    penilaianIntegritasWaktuService.daftarkanSemua();
    penilaianBebanKerjaService.daftarkanSemua();
    penilaianMutuPutusanService.daftarkanSemua();
    penilaianPelayananService.daftarkanSemua();
    penilaianStatistikService.daftarkanSemua();
    penilaianKeuanganPerkaraService.daftarkanSemua();
    penilaianMetodeAnalisisService.daftarkanSemua();
    penilaianJejakKetaatanService.daftarkanSemua();
    penilaianRaporLanjutService.daftarkanSemua();
    penilaianLaporanLanjutService.daftarkanSemua();
    penilaianIntegritasService.daftarkanSemua();
    penilaianSisaPanjarService.daftarkanSemua();
    sebaranPerkaraService.daftarkanSemua();

    const daftar = kerangkaPenilaianService.daftar();
    const daftarSebaran = kerangkaSebaranService.daftar();
    raporAparaturService.daftarkanSemua();
    const daftarRapor = kerangkaRaporService.daftar();
    const keadaan = katalogEAuditService.keadaan([
      ...daftar.map((d) => d.kunci),
      ...daftarSebaran.map((d) => d.kunci),
      ...daftarRapor.map((d) => d.kunci),
    ]);
    const ini = keadaan.perButir.find((x) => x.kode === b.kode) || { keadaan: "belum", kunci: null, catatan: "" };
    const definisi = ini.kunci
      ? daftar.find((d) => d.kunci === ini.kunci) ||
        daftarSebaran.find((d) => d.kunci === ini.kunci) ||
        daftarRapor.find((d) => d.kunci === ini.kunci) ||
        null
      : null;

    res.json({
      ok: true,
      butir: {
        ...b,
        bentukTerbaca: katalogEAuditService.bentukTerbaca(b.bentuk),
        artiMutuRuas: katalogEAuditService.MUTU_RUAS[b.mutuRuas] || null,
      },
      keadaan: ini.keadaan,
      kunci: ini.kunci,
      catatanSambungan: ini.catatan,
      definisi,
      bab: katalogEAuditService.daftarBab().find((x) => x.no === b.bab) || null,
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/**
 * Blangko nilai satu laporan perkara beserta catatan pengirimannya.
 *
 * Angka SIPP belum disambung untuk laporan mana pun, sehingga aspek kesesuaian
 * belum dinilai - dan nilainya null, bukan enam puluh. Lihat keterangan pada
 * laporanPerkaraService.
 */
router.get("/laporan-perkara/blangko", requireInternalToken, async (req, res) => {
  try {
    const nomor = Number(req.query.lipa);
    const butir = laporanPerkaraService.butirLipa(nomor);
    if (!butir) {
      res.status(400).json({ ok: false, alasan: "Nomor LIPA harus antara 1 dan 22." });
      return;
    }
    const acuan = String(req.query.acuan || "").trim() || periodePenilaianService.tanggalHariIni();
    const banyak = Math.min(24, Math.max(1, Number(req.query.bulan) || 12));
    const bulan = periodePenilaianService
      .satuanPeriode("bulanan", acuan, { banyak })
      .unit.map((u) => u.kunci);

    const tercatat = await laporanPerkaraService.bacaPengiriman(nomor, bulan[0], bulan[bulan.length - 1]);
    const peta = {};
    tercatat.forEach((c) => {
      peta[String(c.bulanLaporan)] = {
        tanggalKirim: c.tanggalKirim ? String(c.tanggalKirim).slice(0, 10) : null,
        angkaLaporan: c.angkaLaporan,
      };
    });

    res.json({ ok: true, ...laporanPerkaraService.blangkoNilai(nomor, bulan, peta, {}) });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/** Daftar kedua puluh dua laporan, untuk mengisi menu pilihan. */
router.get("/laporan-perkara/daftar", requireInternalToken, async (req, res) => {
  try {
    res.json({
      ok: true,
      lipa: laporanPerkaraService.LIPA.map((x) => ({
        nomor: x.nomor,
        kunci: laporanPerkaraService.kunciLipa(x.nomor),
        nama: x.nama,
        dipa04: Boolean(x.dipa04),
      })),
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/**
 * Mencatat tanggal kirim dan angka laporan.
 *
 * Inilah satu-satunya jalan yang pantas bagi petugas untuk memasukkannya -
 * sebelum ada rute ini, satu-satunya cara adalah menulis langsung ke basis
 * data, dan itu bukan cara yang boleh diminta dari siapa pun.
 */
router.post("/laporan-perkara/catat", requireInternalToken, async (req, res) => {
  try {
    const b = req.body || {};
    await laporanPerkaraService.catatPengiriman({
      lipaNomor: Number(b.lipaNomor),
      bulanLaporan: String(b.bulanLaporan || "").trim(),
      tanggalKirim: b.tanggalKirim ? String(b.tanggalKirim).trim() : null,
      angkaLaporan: b.angkaLaporan === "" || b.angkaLaporan === undefined ? null : b.angkaLaporan,
      dicatatOleh: String(b.dicatatOleh || "").trim(),
      jabatan: String(b.jabatan || "").trim(),
      keterangan: b.keterangan === undefined ? null : String(b.keterangan),
    });
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ ok: false, alasan: String(error.message || error).slice(0, 300) });
  }
});

/**
 * Mengunggah putusan akhir dan anonimisasinya ke SIPP sekaligus.
 *
 * Bitanya dikirim sebagai base64 di dalam JSON - gerbang ini tidak menerima
 * multipart, dan menambahkannya berarti menambah satu pustaka penguraian di
 * jalur yang sudah bekerja. Putusan 200 KB menjadi 270 KB base64; itu ongkos
 * yang tidak terasa pada satu unggahan per perkara.
 */
router.post("/sipp/putusan-unggah", requireInternalToken, async (req, res) => {
  try {
    // Keputusan 9 Okt 2026: unggah/tulis putusan hanya Super Admin, Admin,
    // dan Hakim (termasuk Ketua/Wakil). Portal sudah memeriksa; ini lapis
    // kedua - lihat hakUnggahPutusanService.
    const hak = hakUnggahPutusanService.periksaHakUnggahPutusan(req.body || {});
    if (!hak.ok) {
      res.status(hak.status).json({ ok: false, alasan: hak.alasan, pesan: hak.pesan, error: hak.pesan });
      return;
    }
    const badan = req.body || {};
    const bita = (nilai) => {
      const teks = String(nilai || "");
      if (!teks) return null;
      try {
        return Buffer.from(teks, "base64");
      } catch {
        return null;
      }
    };
    const hasil = await putusanUnggahService.unggahPutusan({
      perkaraId: badan.perkaraId,
      nomorPerkara: String(badan.nomorPerkara || ""),
      pdfPutusan: bita(badan.putusanBase64),
      pdfAnonimisasi: bita(badan.anonimisasiBase64),
      olehUsername: String(badan.olehUsername || ""),
      ip: String(badan.ip || ""),
      // Uji rilis U1 (9 Okt 2026): akun ALETA penekan untuk jejak ALETA -
      // sebelumnya tidak diteruskan, kolom operator jejak unggah kosong.
      operator: String(badan.operator || ""),
    });
    res.status(hasil.ok ? 200 : 400).json(hasil);
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/* === 17OKT-F16: keadaan perkara untuk checklist konseptor (SELECT saja) === */
router.get("/sipp/konseptor-keadaan", requireInternalToken, async (req, res) => {
  try {
    const id = String(req.query.perkaraId || "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    res.json(await require("../services/konseptorKeadaanService").keadaanBanyak(id));
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});
/* === AKHIR 17OKT-F16 === */

/* === 17OKT-F41: UNGGAH MASSAL e-DOC (putusan & BAS) === */
// Daftar e-Doc yang menunggu dan cek dobel satu e-Doc: SELECT saja
// (unggahMassalService). Unggah BAS satu sidang: menulis berkas + satu kolom
// edoc_bas meniru fileupload_c.php SIPP (basUnggahService), hak lapis kedua di sini.
router.get("/sipp/unggah-massal/daftar", requireInternalToken, async (req, res) => {
  try {
    const hasil = await require("../services/unggahMassalService").daftar({
      sejakHari: Number(req.query.sejak || 0) || undefined,
      // Butir 43 (17 Okt): BAS yang sudah ada ikut, untuk tombol "Ganti".
      basAda: String(req.query.basAda || "") === "1",
    });
    res.status(hasil.ok ? 200 : 400).json(hasil);
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});
router.get("/sipp/unggah-massal/cek", requireInternalToken, async (req, res) => {
  try {
    const hasil = await require("../services/unggahMassalService").cek({
      jenis: String(req.query.jenis || ""),
      perkaraId: String(req.query.perkaraId || ""),
      sidangId: String(req.query.sidangId || ""),
    });
    res.status(hasil.ok ? 200 : 400).json(hasil);
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});
router.post("/sipp/bas-unggah", requireInternalToken, async (req, res) => {
  try {
    const basUnggahService = require("../services/basUnggahService");
    const hak = basUnggahService.periksaHakUnggahBas(req.body || {});
    if (!hak.ok) {
      res.status(hak.status).json({ ok: false, alasan: hak.alasan, pesan: hak.pesan, error: hak.pesan });
      return;
    }
    const badan = req.body || {};
    let isi = null;
    try {
      isi = badan.basBase64 ? Buffer.from(String(badan.basBase64), "base64") : null;
    } catch {
      isi = null;
    }
    const hasil = await basUnggahService.unggahBas({
      perkaraId: badan.perkaraId,
      sidangId: badan.sidangId,
      nomorPerkara: String(badan.nomorPerkara || ""),
      isi,
      olehUsername: String(badan.olehUsername || ""),
      operator: String(badan.operator || ""),
      ip: String(badan.ip || ""),
      ganti: badan.ganti === true,
    });
    // Penolakan yang wajar (sudah_ada dll.) membawa `kode` + `error` - gatewayFetch portal
    // meneruskan keduanya, sehingga "sudah ada" dapat dibedakan dari bot yang mati.
    res.status(200).json(hasil.ok ? hasil : { ...hasil, kode: hasil.alasan, error: hasil.pesan || hasil.alasan });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});
/* === AKHIR 17OKT-F41 === */

router.get("/sipp/status-perkara", requireInternalToken, async (req, res) => {
  try {
    const hasil = await sippStatusPerkaraService.statusLengkap(String(req.query.nomor || ""));
    res.status(hasil.ok ? 200 : 400).json(hasil);
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/**
 * Rekap satu petugas - hakim, panitera pengganti, juru sita, atau mediator -
 * dibuka dari nama pada layar Status Perkara.
 *
 * Orangnya dikenali lewat ID SIPP (?peran=hakim&id=26), tidak pernah lewat
 * nama; lihat rekapPetugasService. Masukan yang tidak sah ditolak 400 beserta
 * alasannya, id yang tidak dikenal 404 - keduanya kalimat yang dapat dibaca
 * petugas, sebab gatewayFetch portal meneruskan ruas `error` apa adanya.
 *
 * require diletakkan di sini, bukan di kepala berkas, mengikuti ukurTipeService
 * dan abtUsulanLainService: layanannya hanya dipakai rute ini.
 */
const rekapPetugasService = require("../services/rekapPetugasService");
router.get("/sipp/rekap-petugas", requireInternalToken, async (req, res) => {
  try {
    const hasil = await rekapPetugasService.rekapPetugas({
      peran: String(req.query.peran || ""),
      id: String(req.query.id || ""),
      tahun: String(req.query.tahun || ""),
      keadaan: String(req.query.keadaan || ""),
      kedudukan: String(req.query.kedudukan || ""),
      lewati: String(req.query.lewati || ""),
      batas: String(req.query.batas || ""),
    });
    res.status(hasil.ok ? 200 : hasil.status || 400).json(hasil);
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/**
 * Fakta eviden SKP satu petugas untuk satu periode (2.40.0) - bukti dukung
 * SKP eKinerja yang diunduh dari halaman Rekap Hakim.
 *
 *   ?peran=hakim&id=31&tahun=2026&periode=tw2
 *
 * Seluruhnya FAKTA per perkara; memilih perkara per dokumen dan menghitung
 * realisasinya dikerjakan portal (lib/eviden-skp-katalog.ts). Masukan yang
 * tidak sah 400, id yang tidak dikenal 404, SIPP yang tidak terbaca 502 -
 * masing-masing dengan kalimat yang diteruskan portal apa adanya.
 */
const evidenSkpService = require("../services/evidenSkpService");
router.get("/sipp/eviden-skp", requireInternalToken, async (req, res) => {
  try {
    const hasil = await evidenSkpService.evidenSkp({
      peran: String(req.query.peran || ""),
      id: String(req.query.id || ""),
      tahun: String(req.query.tahun || ""),
      periode: String(req.query.periode || ""),
    });
    res.status(hasil.ok ? 200 : hasil.status || 400).json(hasil);
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/**
 * Fakta SKP jabatan perkara (17 Okt 2026): kejadian per akun SIPP per jabatan
 * untuk Ketua, Wakil, Panitera, Panmud, PP, Jurusita, Petugas Meja, Kasir.
 *
 *   ?tahun=2026&periode=tw3[&jabatan=jurusita][&username=mustini&username=a,b][&tambahan=1]
 *
 * periode: tw1..tw4, tahun, atau b01..b12. Seluruhnya FAKTA (kontrak
 * DataSkpJabatan di skp-jabatan-tipe.ts); aturan hitung ada di portal
 * (skp-jabatan-hitung.ts). Hanya SELECT. Masukan tidak sah 400, username
 * tak dikenal 404, SIPP tidak terbaca 502 - dengan kalimat untuk pembaca.
 */
const evidenSkpJabatanService = require("../services/evidenSkpJabatanService");
router.get("/sipp/skp-jabatan", requireInternalToken, async (req, res) => {
  try {
    const hasil = await evidenSkpJabatanService.skpJabatan({
      tahun: String(req.query.tahun || ""),
      periode: String(req.query.periode || ""),
      jabatan: String(req.query.jabatan || ""),
      // username boleh diulang (?username=a&username=b) dan memuat koma: jangan dipecah.
      username: Array.isArray(req.query.username) ? req.query.username.map((x) => String(x)) : String(req.query.username || ""),
      tambahan: String(req.query.tambahan || ""),
    });
    res.status(hasil.ok ? 200 : hasil.status || 400).json(hasil);
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/**
 * Jembatan Pemetaan SKP: akun SIPP (aktif; ?semua=1 untuk semua) beserta grup
 * (sys_user_group + sys_groups) dan jabatan dugaan (jurusita.jabatan).
 * Layar Pemetaan memakainya sebagai tebakan awal; pemetaan akhir dikonfirmasi
 * pengguna. Hanya SELECT.
 */
router.get("/sipp/skp-akun", requireInternalToken, async (req, res) => {
  try {
    const hasil = await evidenSkpJabatanService.daftarAkun({
      username: Array.isArray(req.query.username) ? req.query.username.map((x) => String(x)) : String(req.query.username || ""),
      semua: String(req.query.semua || ""),
    });
    res.status(hasil.ok ? 200 : hasil.status || 400).json(hasil);
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/**
 * ============================================================================
 * TAUTAN KE HALAMAN PERKARA DI SIPP
 * ============================================================================
 *
 * Untuk tombol "Buka SIPP" dan "Salin tautan" di Status Perkara. Jawabannya
 * JALUR RELATIF - perkara_detil_agama/<enc> - bukan alamat mutlak: alamat SIPP
 * menurut peramban petugas (ALETA_SIPP_BASE_URL) hanya diketahui portal,
 * sedangkan bot melihat SIPP dari dalam container.
 *
 * Kunci SIPP yang dipakai menyusun <enc> tidak pernah ikut dalam jawaban -
 * lihat sippTautanService.
 *
 * Kegagalan dijawab { ok:false, alasan:<kode>, message:<kalimat> }. message
 * sengaja kalimat untuk petugas, sebab gatewayFetch portal meneruskannya
 * apa adanya.
 */
router.get("/sipp/tautan-perkara", requireInternalToken, async (req, res) => {
  // Kode HTTP menurut alasannya, supaya penolakan tetap terbaca sebagai
  // penolakan di log akses - bukan 200 yang berisi kegagalan.
  const STATUS_GAGAL = {
    masukan_kosong: 400,
    perkara_id_tidak_sah: 400,
    perkara_tidak_ditemukan: 404,
    nomor_tidak_cocok: 409,
    kunci_tidak_terbaca: 503,
    sandi_tidak_lulus_uji: 503,
    sipp_tidak_terbaca: 503,
  };
  try {
    const hasil = await sippTautanService.tautanPerkara({
      perkaraId: req.query.perkaraId,
      nomor: req.query.nomor,
    });
    res.status(hasil.ok ? 200 : STATUS_GAGAL[hasil.alasan] || 400).json(hasil);
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/**
 * ============================================================================
 * KENDALI BERKAS
 * ============================================================================
 *
 * Menyandingkan berkas yang seharusnya ada menurut SIPP dengan arsip e-Court
 * ALETA. Sinkronisasinya berjalan lama - ribuan perkara, berjam-jam - sehingga
 * dilepas ke latar belakang dan dipantau lewat ringkasan, bukan ditunggu di
 * dalam satu permintaan HTTP yang pasti kehabisan waktu.
 */

/** Ringkasan kendali berkas beserta jalannya sinkronisasi. */
router.get("/kendali-berkas/ringkasan", requireInternalToken, async (req, res) => {
  try {
    res.json({ ok: true, ...(await kendaliBerkasService.ringkasan()) });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/** Perkara yang kurang berkasnya, paling banyak kurangnya di atas. */
router.get("/kendali-berkas/kurang", requireInternalToken, async (req, res) => {
  try {
    const perkara = await kendaliBerkasService.daftarKurang({ batas: Number(req.query.batas) || 100 });
    res.json({ ok: true, perkara });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/**
 * Perkara yang putusannya belum terbit utuh di e-Court.
 *
 * Daftar kerja, bukan laporan: yang dikembalikan hanya perkara yang MENUNTUT
 * tindakan - barisnya belum terbentuk, salinannya belum diunggah, atau
 * Panitera belum menandatanganinya.
 */
router.get("/kendali-berkas/putusan", requireInternalToken, async (req, res) => {
  try {
    const perkara = await putusanEcourtService.daftarPerluTindakan({
      batas: Number(req.query.batas) || 100,
    });
    res.json({ ok: true, perkara });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/**
 * Memulai sinkronisasi.
 *
 * Jawaban dikirim SEKARANG, tidak menunggu selesai. Menahan sambungan HTTP
 * selama berjam-jam akan diputus perantara mana pun di tengah jalan, dan
 * pemakainya tidak akan pernah tahu apakah pekerjaannya selesai atau mati.
 * Kemajuannya dibaca dari /kendali-berkas/ringkasan.
 */
router.post("/kendali-berkas/sinkron", requireInternalToken, async (req, res) => {
  try {
    const berjalan = await kendaliBerkasService.jalanYangMasihHidup();
    if (berjalan) {
      return res.status(409).json({
        ok: false,
        alasan: "sinkron_lain_berjalan",
        error: `Sinkronisasi lain sedang berjalan (${berjalan.diperiksa}/${berjalan.target}).`,
      });
    }

    const pilihan = {
      sejak: String((req.body && req.body.sejak) || ""),
      sampai: String((req.body && req.body.sampai) || ""),
      maks: Number((req.body && req.body.maks) || 0),
      hanyaEcourt: Boolean(req.body && req.body.hanyaEcourt),
      sumber: "portal",
      dijalankanOleh: String((req.body && req.body.olehSiapa) || ""),
    };

    // Dilepas tanpa ditunggu. Galatnya tercatat pada baris jalannya sendiri,
    // jadi tidak ada yang hilang diam-diam.
    void kendaliBerkasService.sinkron(pilihan).catch(() => {});

    res.json({ ok: true, pesan: "Sinkronisasi kendali berkas dimulai di latar belakang." });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/**
 * Kolom SIPP mana yang ditemukan dan mana yang tidak.
 *
 * Dipakai layar untuk menjelaskan mengapa suatu unsur SK belum dapat dinilai -
 * jawabannya "kolomnya tidak ada pada SIPP versi ini", bukan "pengadilan tidak
 * mengerjakannya". Dua hal yang sangat berbeda.
 */
router.get("/sipp/skema/laporan", requireInternalToken, async (req, res) => {
  try {
    res.json({ ok: true, ...(await sippSkemaService.laporan()) });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/**
 * Kosakata pemeriksa pesan - yang ditambahkan pengadilan.
 *
 * Daftar bawaannya tetap di dalam kode portal dan tidak dikirim dari sini;
 * yang ini TAMBAHAN saja. Menggabungkannya di sisi bot akan membuat portal
 * bergantung pada bot untuk memeriksa kalimat yang sedang diketik - dan
 * pemeriksa yang mati ketika botnya mati berhenti menjadi pemeriksa.
 */
router.get("/kosakata", requireInternalToken, (req, res) => {
  try {
    res.json({ ok: true, tambahan: kosakataService.getTambahan(), jenis: kosakataService.JENIS });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

router.post("/kosakata", requireInternalToken, (req, res) => {
  try {
    const hasil = kosakataService.simpanTambahan(
      req.body?.tambahan || {},
      String(req.body?.olehSiapa || "")
    );
    res.status(hasil.ok ? 200 : 400).json({ ...hasil, jenis: kosakataService.JENIS });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/** Rubrik penilaian perkara. */
router.get("/sipp/penilaian/pengaturan", requireInternalToken, (req, res) => {
  try {
    res.json({
      ok: true,
      pengaturan: penilaianPerkaraService.getSettings(),
      butir: penilaianPerkaraService.BUTIR,
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

router.post("/sipp/penilaian/pengaturan", requireInternalToken, (req, res) => {
  try {
    const hasil = penilaianPerkaraService.saveSettings({
      bulanPenuh: req.body?.bulanPenuh,
      bulanNol: req.body?.bulanNol,
      hariMinutasi: req.body?.hariMinutasi,
      // Ambang predikat. Yang tidak dikirim jatuh ke bawaannya, bukan ke nol -
      // ambang nol akan menyebut SELURUH perkara "baik", dan itu keadaan yang
      // tidak akan dicurigai siapa pun.
      ambangBaik: req.body?.ambangBaik,
      ambangPerhatian: req.body?.ambangPerhatian,
      bobot: req.body?.bobot || {},
      olehSiapa: String(req.body?.olehSiapa || ""),
    });
    res.status(hasil.ok ? 200 : 400).json({ ...hasil, butir: penilaianPerkaraService.BUTIR });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/** Rekap jumlah sidang per hari dalam satu bulan - isi kalender sidang. */
router.get("/sipp/jadwal-sidang/kalender", requireInternalToken, async (req, res) => {
  try {
    const hasil = await sippJadwalSidangService.rekapBulanSidang(String(req.query.bulan || ""));
    res.json({ ok: true, ...hasil });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/**
 * ============================================================================
 * AGEN PENJAGA TENGGAT (TAHAP 3) - FAKTANYA SAJA
 * ============================================================================
 *
 * Rute ini TIDAK memutuskan apa pun tentang terlampaui atau tidak. Ia hanya
 * memulangkan fakta mentah; yang menilai adalah mesin aturan di portal
 * (src/lib/penjaga-tenggat.ts), di tempat yang dapat diuji tanpa basis data.
 *
 * Pembagian yang sama dengan praperiksa putusan, dan sebabnya sama: aturan
 * tenggat menuduh orang lalai, dan aturan yang menuduh harus berada di tempat
 * yang penjaganya dapat menjalankannya seribu kali tanpa menyentuh SIPP.
 */
router.get("/sipp/penjaga-tenggat", requireInternalToken, async (req, res) => {
  try {
    const hasil = await penjagaTenggatService.bacaFakta(String(req.query.acuan || ""));
    res.json({ ok: true, ...hasil });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/**
 * ============================================================================
 * CHECKLIST MILESTONE - FAKTANYA SAJA
 * ============================================================================
 *
 * Sama dengan penjaga tenggat: rute ini tidak memutuskan apa pun. Ia
 * memulangkan fakta SIPP untuk satu peran, dibatasi pada perkara yang
 * menyebut id pejabat pengguna (hakim/panitera/jurusita). Portal yang
 * menilai (src/lib/checklist-milestone.ts). Hanya membaca.
 */
router.get("/sipp/checklist-milestone", requireInternalToken, async (req, res) => {
  try {
    const hasil = await checklistMilestoneService.bacaFakta({
      peran: String(req.query.peran || ""),
      acuan: String(req.query.acuan || ""),
      hakim: String(req.query.hakim || ""),
      panitera: String(req.query.panitera || ""),
      jurusita: String(req.query.jurusita || ""),
      perkara: String(req.query.perkara || ""),
    });
    res.status(hasil.ok ? 200 : 400).json(hasil);
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/**
 * AGEN PENYUSUN PERTIMBANGAN (TAHAP 4) - FAKTA ALAT BUKTINYA.
 *
 * Membaca saja. Yang MENYUSUN kalimatnya adalah portal
 * (src/lib/penyusun-pertimbangan.ts), dan yang menyetujuinya petugas.
 */
router.get("/sipp/pertimbangan/bukti", requireInternalToken, async (req, res) => {
  try {
    const hasil = await penyusunPertimbanganService.bacaFaktaBukti(String(req.query.nomor || ""));
    res.status(hasil.ok ? 200 : 404).json(hasil);
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/**
 * AGEN ARSIP e-COURT BERTINDAK (TAHAP 5) - PENCOCOKAN CAKRAM.
 *
 * Membaca catatan arsip dan memeriksa cakram. Tidak mengunduh, tidak
 * menghapus. Yang memutuskan apakah pantas bertindak adalah portal
 * (src/lib/arsip-ecourt-bertindak.ts), dan ia menolak bila akarnya tidak
 * bertahan - menarik ulang ke direktori yang musnah tiap peti dibangun ulang
 * adalah pekerjaan yang menghapus dirinya sendiri.
 */
router.get("/ecourt/arsip/cocokkan", requireInternalToken, async (req, res) => {
  try {
    const hasil = await arsipBertindakService.cocokkanArsip(Number(req.query.batas) || 2000);
    res.status(hasil.ok ? 200 : 500).json(hasil);
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/** Seluruh keterangan satu sidang. */
router.get("/sipp/jadwal-sidang/rincian", requireInternalToken, async (req, res) => {
  try {
    const hasil = await sippJadwalSidangService.rincianSidang(
      String(req.query.nomor || ""),
      String(req.query.sidangId || "")
    );
    res.status(hasil.ok ? 200 : 400).json(hasil);
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/**
 * Mengalirkan berkas SIPP - dokumen perkara, relaas, atau resi pos.
 *
 * ==========================================================================
 * JALURNYA DICARI DI DATABASE, TIDAK PERNAH DIKIRIM PEMANGGIL
 * ==========================================================================
 *
 * Pemanggil hanya menyebut jenis dan nomor barisnya. Jalur berkasnya dibaca
 * dari SIPP di sini, lalu dilewatkan sippDocumentService yang sudah membatasi
 * ekstensi dan akar folder yang boleh dibaca. Dengan begitu tidak ada cara
 * meminta berkas yang tidak memang tercatat pada perkara.
 */
router.get("/sipp/berkas-perkara", requireInternalToken, async (req, res) => {
  try {
    // ======================================================================
    // DAFTAR INI PERNAH TERTINGGAL DARI YANG SUDAH DIKERJAKAN
    // ======================================================================
    //
    // jalurDokumenSipp() sudah lama menangani penetapan, petitum, arsip, dan
    // ikrar talak, dan layarnya sudah lama memasang tombol unduh untuk
    // keempatnya. Daftar di sini tidak ikut ditambah, sehingga keempat tombol
    // itu berujung 400 jenis_tidak_dikenali - diuji pada server: penetapan,
    // arsip, dan petitum sama-sama 400.
    //
    // Kegagalan seperti ini tidak berbunyi di mana pun: layarnya menampilkan
    // tombol, tombolnya diklik, dan yang turun berkas JSON berisi penolakan.
    // Karena itu daftarnya sekarang disusun dari SATU tempat bersama
    // jalurDokumenSipp - lihat JENIS_BERKAS_SIPP di sippJadwalSidangService.
    const jenis = String(req.query.jenis || "");
    if (!sippJadwalSidangService.JENIS_BERKAS_SIPP.includes(jenis)) {
      res.status(400).json({ ok: false, alasan: "jenis_tidak_dikenali" });
      return;
    }

    const acuan = await sippJadwalSidangService.jalurDokumenSipp(jenis, req.query.id);
    if (!acuan) {
      res.status(404).json({ ok: false, alasan: "berkas_tidak_tercatat" });
      return;
    }

    const info = sippDocumentService.sanitizeSippDocumentInput(acuan.jalur);
    if (!info.ok) {
      res.status(400).json({ ok: false, alasan: info.reason });
      return;
    }

    const jalurLokal = info.isUrl ? null : sippDocumentService.findReadableSippDocument(info);
    if (!jalurLokal) {
      res.status(404).json({ ok: false, alasan: "berkas_tidak_ditemukan_di_server" });
      return;
    }

    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(info.fileName || acuan.judul)}"`
    );
    require("fs").createReadStream(jalurLokal).pipe(res);
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/** Keadaan penjadwal penarikan e-Court. */
router.get("/ecourt/jadwal", requireInternalToken, (req, res) => {
  try {
    res.json({ ok: true, jadwal: ecourtSchedulerService.getStatus() });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/** Menyimpan pengaturan penjadwal. Berlaku pada putaran berikutnya. */
router.post("/ecourt/jadwal", requireInternalToken, (req, res) => {
  try {
    const hasil = ecourtSchedulerService.saveSettings({
      aktif: req.body?.aktif === true,
      jarakJam: req.body?.jarakJam,
      jamMulai: req.body?.jamMulai,
      jamSelesai: req.body?.jamSelesai,
      maksPerkara: req.body?.maksPerkara,
      // 13 Okt 2026: selang acak putaran berkala dan tarikan pagi. Ruas yang
      // tidak dikirim (pengirim lama) dipertahankan dari pengaturan sekarang.
      selangMinMenit: req.body?.selangMinMenit,
      selangMaksMenit: req.body?.selangMaksMenit,
      pagiAktif: typeof req.body?.pagiAktif === "boolean" ? req.body.pagiAktif : undefined,
      jamPagi: req.body?.jamPagi,
      menitPagi: req.body?.menitPagi,
      olehSiapa: String(req.body?.olehSiapa || ""),
    });
    res.status(hasil.ok ? 200 : 400).json(hasil);
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/**
 * Menjalankan satu putaran sekarang, di luar jadwal.
 *
 * Tetap memakai mode terjadwal, sehingga tidak menunggu login manusia dan
 * berhenti sopan bila sesinya sudah habis.
 */
router.post("/ecourt/jadwal/jalankan", requireInternalToken, (req, res) => {
  try {
    // ======================================================================
    // DILEPAS, BUKAN DITUNGGU
    // ======================================================================
    //
    // Sebelumnya rute ini MENUNGGU satu putaran selesai. Satu putaran menarik
    // sampai dua puluh lima perkara lewat peramban - hitungan menit. Selama
    // itu permintaan HTTP menggantung, layar pengaturan tampak membeku, dan
    // perantara akhirnya memutus sambungannya. Petugas menyimpulkan tombolnya
    // rusak, lalu menekannya lagi.
    //
    // Sekarang jawabannya datang seketika, sama seperti penarikan menyeluruh
    // dan penarikan satu perkara di bawah. Kemajuannya dibaca dari
    // /ecourt/jadwal.
    const status = ecourtSchedulerService.getStatus();
    if (status && status.sedangJalan) {
      return res.status(409).json({
        ok: false,
        alasan: "putaran_sebelumnya_belum_selesai",
        error: "Satu putaran penarikan masih berjalan.",
      });
    }

    void ecourtSchedulerService.jalankanSatuPutaran().catch(() => {});

    res.json({
      ok: true,
      dimulai: true,
      pesan: "Satu putaran penarikan dimulai. Kemajuannya terlihat pada keadaan penjadwal.",
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/**
 * Penarikan berkas e-Court atas permintaan portal.
 *
 * Tiga pintu: menyeluruh, satu perkara, dan penghentian. Ketiganya menjawab
 * SEKETIKA - penarikan berjalan di latar belakang dan kemajuannya diikuti
 * lewat berkas log di folder reports yang dibagi dengan host.
 *
 * Menunggu sampai selesai bukan pilihan: satu penarikan menyeluruh dapat
 * berjam-jam, dan proksi akan memutus permintaannya jauh sebelum itu.
 */
router.post("/ecourt/penarikan/menyeluruh", requireInternalToken, (req, res) => {
  try {
    const hasil = ecourtSchedulerService.mulaiPenarikanMenyeluruh({
      olehSiapa: String(req.body?.olehSiapa || ""),
    });
    res.status(hasil.ok ? 200 : 409).json(hasil);
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

router.post("/ecourt/penarikan/perkara", requireInternalToken, (req, res) => {
  try {
    const hasil = ecourtSchedulerService.mulaiPenarikanPerkara(String(req.body?.nomorPerkara || ""), {
      olehSiapa: String(req.body?.olehSiapa || ""),
    });
    res.status(hasil.ok ? 200 : 409).json(hasil);
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/**
 * Berapa perkara yang berkasnya belum ada - TANPA menyentuh e-Court.
 *
 * Hanya membaca SIPP dan basis data bot, jadi boleh dipanggil sesering apa pun
 * termasuk ketika sesi e-Court sedang habis. Tidak memulai apa pun.
 */
router.get("/ecourt/penarikan/sasaran", requireInternalToken, async (req, res) => {
  try {
    const hasil = await ecourtSasaranService.hitungSasaran({
      contoh: Number(req.query?.contoh) || 20,
    });
    res.status(hasil.ok ? 200 : 503).json(hasil);
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/** Menarik HANYA perkara yang berkasnya belum ada. */
router.post("/ecourt/penarikan/belum-ada", requireInternalToken, (req, res) => {
  try {
    const hasil = ecourtSchedulerService.mulaiPenarikanBelumAda({
      maksPerkara: Number(req.body?.maksPerkara) || ecourtSchedulerService.MAKS_BELUM_ADA,
      olehSiapa: String(req.body?.olehSiapa || ""),
    });
    res.status(hasil.ok ? 200 : 409).json(hasil);
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/**
 * Melupakan penanda "tidak tersedia" supaya ditanyakan sekali lagi.
 *
 * Petugas kadang TAHU berkasnya baru diunggah, dan menunggu tiga puluh hari
 * tidak masuk akal.
 */
router.post("/ecourt/penarikan/coba-tidak-tersedia", requireInternalToken, async (req, res) => {
  try {
    const hasil = await ecourtStoreService.lupakanTidakTersedia({
      documentKey: String(req.body?.documentKey || ""),
      semua: req.body?.semua === true,
    });
    res.json({ ok: true, ...hasil });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

router.post("/ecourt/penarikan/hentikan", requireInternalToken, (req, res) => {
  try {
    const hasil = ecourtSchedulerService.hentikanPenarikan({
      olehSiapa: String(req.body?.olehSiapa || ""),
    });
    res.status(hasil.ok ? 200 : 409).json(hasil);
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/** Daftar akun e-Court beserta keadaan sesinya. */
router.get("/ecourt/akun", requireInternalToken, (req, res) => {
  try {
    res.json({ ok: true, akun: ecourtAkunService.daftarAkun(), akunUtama: ecourtAkunService.keadaanAkunUtama() });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/** Menambah atau menyunting satu akun. */
router.post("/ecourt/akun", requireInternalToken, (req, res) => {
  try {
    const hasil = ecourtAkunService.simpanAkun({
      slot: String(req.body?.slot || ""),
      label: String(req.body?.label || ""),
      aktif: req.body?.aktif !== false,
      olehSiapa: String(req.body?.olehSiapa || ""),
    });
    res.status(hasil.ok ? 200 : 400).json(hasil);
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/** Menghapus satu akun beserta sesinya. */
router.post("/ecourt/akun/hapus", requireInternalToken, (req, res) => {
  try {
    const hasil = ecourtAkunService.hapusAkun(String(req.body?.slot || ""), {
      olehSiapa: String(req.body?.olehSiapa || ""),
    });
    res.status(hasil.ok ? 200 : 400).json(hasil);
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/**
 * Akun utama penarikan (butir 11, 13 Okt 2026): penarikannya selalu jalan.
 * Memilih = menandai satu akun terdaftar. Melepas wajib membawa kata penegas.
 */
router.post("/ecourt/akun/utama", requireInternalToken, (req, res) => {
  try {
    const olehSiapa = String(req.body?.olehSiapa || "");
    const hasil =
      String(req.body?.tindakan || "") === "lepas"
        ? ecourtAkunService.lepasAkunUtama({ konfirmasi: String(req.body?.konfirmasi || ""), olehSiapa })
        : ecourtAkunService.pilihAkunUtama(String(req.body?.slot || ""), { olehSiapa });
    // Penolakan (kata penegas, akun tidak ada) dijawab 200 + ok:false supaya
    // portal dapat menyebut sebabnya, bukan "bot tidak terjangkau".
    res.json(hasil);
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/**
 * Status penarikan data e-Court untuk dasbor (butir 12, 13 Okt 2026): tarikan
 * terakhir berkala & per perkara dari log, jadwal berikutnya, akun, sesi.
 * Hanya membaca - tidak menyentuh e-Court.
 */
router.get("/ecourt/penarikan/status", requireInternalToken, (req, res) => {
  try {
    res.json(require("../services/ecourtPenarikanStatusService").statusPenarikan());
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/** Keadaan pemantau sesi e-Court. */
router.get("/ecourt/pantau-sesi", requireInternalToken, (req, res) => {
  try {
    res.json({ ok: true, pantau: ecourtSesiPantauService.getStatus() });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/**
 * Keadaan pemulihan sesi e-Court / login captcha lewat WhatsApp (hanya membaca;
 * tidak membuka peramban, tidak mengirim apa pun, tidak memuat nomor admin).
 */
router.get("/ecourt/wa-sesi", requireInternalToken, (req, res) => {
  try {
    res.json({ ok: true, waSesi: require("../services/ecourtPulihService").getStatus() });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/** Menyimpan pengaturan pemantau sesi. */
router.post("/ecourt/pantau-sesi", requireInternalToken, (req, res) => {
  try {
    const hasil = ecourtSesiPantauService.saveSettings({
      aktif: req.body?.aktif === true,
      jedaMenit: req.body?.jedaMenit,
      jedaPeringatanJam: req.body?.jedaPeringatanJam,
      olehSiapa: String(req.body?.olehSiapa || ""),
    });
    res.status(hasil.ok ? 200 : 400).json({ ...hasil, pantau: ecourtSesiPantauService.getStatus() });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/**
 * Satu detak sekarang juga.
 *
 * Membuka peramban, jadi TIDAK dijalankan bila penarikan sedang berlangsung -
 * profil peramban hanya dapat dipakai satu proses.
 */
router.post("/ecourt/pantau-sesi/detak", requireInternalToken, async (req, res) => {
  try {
    const hasil = await ecourtSesiPantauService.detak({ paksa: true });
    res.json({ ok: true, ...hasil, pantau: ecourtSesiPantauService.getStatus() });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/**
 * Pemeriksaan keutuhan arsip.
 *
 * perbaiki=true MENGHAPUS catatan dan berkas yang rusak, sehingga perkaranya
 * tidak lagi terhitung lengkap dan penarikan berikutnya mengambilnya kembali.
 */
router.post("/ecourt/audit-arsip", requireInternalToken, async (req, res) => {
  try {
    const hasil = await ecourtAuditArsipService.periksaArsip({
      batas: Number(req.body?.batas) || undefined,
      perbaiki: req.body?.perbaiki === true,
      olehSiapa: String(req.body?.olehSiapa || ""),
    });
    res.json({ ok: true, ...hasil });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/** Keadaan ruang dan masa simpan arsip. */
router.get("/ecourt/arsip", requireInternalToken, async (req, res) => {
  try {
    res.json({ ok: true, arsip: await ecourtArsipService.getStatus() });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/** Menyimpan pengaturan ruang dan masa simpan. */
router.post("/ecourt/arsip", requireInternalToken, (req, res) => {
  try {
    const hasil = ecourtArsipService.saveSettings({
      minRuangGb: req.body?.minRuangGb,
      maksBerkasMb: req.body?.maksBerkasMb,
      simpanBulan: req.body?.simpanBulan,
      olehSiapa: String(req.body?.olehSiapa || ""),
    });
    res.status(hasil.ok ? 200 : 400).json(hasil);
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});

/**
 * Membersihkan berkas yang melewati masa simpan.
 *
 * Tanpa hapus:true, hanya melaporkan apa yang AKAN dihapus.
 */
router.post("/ecourt/arsip/bersihkan", requireInternalToken, async (req, res) => {
  try {
    const hasil = await ecourtArsipService.bersihkan({
      hapus: req.body?.hapus === true,
      olehSiapa: String(req.body?.olehSiapa || ""),
    });
    res.json(hasil);
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

// ============================================================================
// KIRIM SAAT DATA LENGKAP
// ============================================================================
//
// Keadaan pemantau dan pratinjau daftar kirimnya. Pratinjau menyusun daftar
// yang persis sama dengan pengiriman sungguhan tetapi tidak mengantrekan apa
// pun - layar portal memperlihatkannya sebelum admin menyalakan saklarnya.

router.get("/kelengkapan/status", requireInternalToken, (_req, res) => {
  try {
    return res.json({ ok: true, ...kelengkapanDataService.status() });
  } catch (error) {
    return res.status(500).json({ ok: false, error: "kelengkapan_status_failed", message: error.message });
  }
});

router.post("/kelengkapan/jalankan", requireInternalToken, async (req, res) => {
  try {
    // Bawaannya PRATINJAU. Mengantrekan sungguhan harus diminta secara tegas
    // dengan pratinjau: false - tombol yang salah tekan tidak boleh mengirim
    // pesan ke nomor orang.
    const pratinjau = req.body?.pratinjau !== false;
    const hasil = await kelengkapanDataService.jalankan({ pratinjau, pemicu: "portal" });
    if (!pratinjau) {
      void logService.logSystemEvent({
        eventType: "kirim_saat_lengkap_dipicu_portal",
        severity: "info",
        message: "Pemantau kelengkapan dijalankan dari portal.",
        metadata: { olehSiapa: String(req.body?.olehSiapa || ""), ok: hasil.ok },
      });
    }
    return res.json({ ok: true, hasil });
  } catch (error) {
    return res.status(500).json({ ok: false, error: "kelengkapan_run_failed", message: error.message });
  }
});

/* === P4P7B2 10 Okt === */
/**
 * B2 + P4 + P7 (10 Okt 2026, agen 3): isi gugatan / jawaban e-Court ke ABT.
 *
 *   POST /abt/isi-gugatan  { nomorPerkara, sebutan: {lawan, pelaku}, majelis?,
 *                            dokumen: [{judul, peran, teks, baca, penuntutKode, rekonvensi}] }
 *     -> { ok, ada, tuntutan[], anak[], jawab[], usulan[], kalimat[], diabaikan[], catatan[] }
 *
 * Teks berkas dibaca PORTAL dari arsip e-Court (pembaca PDF/DOCX/OCR ada di
 * sana); di sini hanya pola kamus (tuntutan.json, gugatan.json,
 * kalimat-hakim.json lewat kamusDeteksi) yang menimbangnya. Tidak menulis apa pun.
 */
const isiGugatanService = require("../services/isiGugatanService");

router.post("/abt/isi-gugatan", requireInternalToken, async (req, res) => {
  try {
    const sebutanMasuk = req.body?.sebutan && typeof req.body.sebutan === "object" ? req.body.sebutan : {};
    const hasil = isiGugatanService.susunIsiGugatan({
      sebutan: {
        lawan: String(sebutanMasuk.lawan || "").replace(/[^A-Za-z /]/g, "").slice(0, 40),
        pelaku: String(sebutanMasuk.pelaku || "").replace(/[^A-Za-z /]/g, "").slice(0, 40),
      },
      majelis: /^(?:Majelis Hakim|Hakim|Hakim Tunggal)$/.test(String(req.body?.majelis || "")) ? String(req.body.majelis) : undefined,
      dokumen: Array.isArray(req.body?.dokumen) ? req.body.dokumen : [],
    });
    // KONTAK-EC 11 Okt: kontak pihak/kuasa dari teks yang sama + ringkasan untuk variabel ABT.
    hasil.kontak = await kontakDariIsiGugatan(req.body, hasil);
    // OCR-ECOURT 19 Okt: usulan dari lampiran e-Court yang sudah dibaca penyapu latar (cache per berkas). Kode yang
    // sudah diusulkan dari surat gugatan/jawaban tidak diulang; galat lampiran tidak pernah menggagalkan isi gugatan.
    try {
      const sebutanLampiran = {
        lawan: String(sebutanMasuk.lawan || "").replace(/[^A-Za-z /]/g, "").slice(0, 40),
        pelaku: String(sebutanMasuk.pelaku || "").replace(/[^A-Za-z /]/g, "").slice(0, 40),
      };
      const lampiran = await lampiranEcourtStore.usulanPerkara({ nomorPerkara: String(req.body?.nomorPerkara || ""), sebutan: sebutanLampiran });
      const ada = new Set((hasil.usulan || []).map((u) => u.kode));
      const baru = lampiran.usulan.filter((u) => !ada.has(u.kode));
      if (baru.length || lampiran.kalimat.length) {
        hasil.usulan = [...(hasil.usulan || []), ...baru];
        hasil.kalimat = [...(hasil.kalimat || []), ...lampiran.kalimat];
        hasil.catatan = [...(hasil.catatan || []), ...lampiran.catatan];
        hasil.ada = true;
      }
      hasil.lampiran = lampiran.ringkasan;
    } catch (_) {
      hasil.lampiran = null;
    }
    res.json({ ...hasil, nomorPerkara: String(req.body?.nomorPerkara || "").slice(0, 80) });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
});
/* === AKHIR P4P7B2 === */

/* === KONTAK-EC 11 Okt === */
/**
 * KONTAK-EC (11 Okt 2026, agen 5): email & nomor HP/WA pihak dan kuasa dari
 * e-Court -> usulan blangko Data Pihak/Pengacara SIPP (diisi ekstensi atas klik
 * petugas) dan ringkasan aleta_bot_ecourt_ringkasan yang dibaca variabel ABT
 * 8800-8811. Lihat services/kontakEcourtService.js.
 *
 *   POST /abt/kontak-ecourt  { nomorPerkara?, nama?, dokumen?: [{judul, peran, teks, penuntutKode}] }
 *     -> { ok, ada, perkaraId, nomorPerkara, orang[], domisili{1,2}, tanpaPemilik[], tersimpan }
 *
 * Tidak menulis SIPP/ABT. Nilai kontak tidak pernah dicatat ke log.
 */
const kontakEcourtService = require("../services/kontakEcourtService");

function dokumenKontak(body) {
  return (Array.isArray(body?.dokumen) ? body.dokumen : []).slice(0, 10).map((d) => ({
    judul: String(d?.judul || "").slice(0, 160),
    peran: String(d?.peran || "").slice(0, 40),
    penuntutKode: d?.penuntutKode === "0046" || d?.penuntutKode === "0047" ? d.penuntutKode : "",
    teks: String(d?.teks || "").slice(0, 200000),
  }));
}

/** Dipanggil rute /abt/isi-gugatan: kontak dari teks yang sudah dibaca + ringkasan usulan ABT. Tidak pernah melempar. */
async function kontakDariIsiGugatan(body, hasilIsi) {
  try {
    const nomorPerkara = String(body?.nomorPerkara || "").trim().slice(0, 80);
    if (!nomorPerkara) return null;
    const k = await kontakEcourtService.kontakPerkara({ nomorPerkara, dokumen: dokumenKontak(body) });
    if (k && k.ada && hasilIsi && Array.isArray(hasilIsi.usulan)) {
      await kontakEcourtService
        .simpanRingkasan(k.perkaraId, k.nomorPerkara, kontakEcourtService.barisDariUsulanAbt(hasilIsi.usulan), { awalan: "abt.", hapusAsal: ["teks"] })
        .catch(() => null);
    }
    return k;
  } catch (error) {
    return { ok: false, ada: false, sebab: String(error?.code || "kontak_gagal").slice(0, 60) };
  }
}

router.post("/abt/kontak-ecourt", requireInternalToken, async (req, res) => {
  try {
    const hasil = await kontakEcourtService.kontakPerkara({
      nomorPerkara: String(req.body?.nomorPerkara || "").trim().slice(0, 80),
      nama: String(req.body?.nama || "").trim().slice(0, 200),
      dokumen: dokumenKontak(req.body),
    });
    res.json(hasil);
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error?.code || error?.message || error).slice(0, 120) });
  }
});
/* === AKHIR KONTAK-EC === */

/* === STATUS-ZIP 12 Okt === */
/**
 * Kontak para pihak untuk layar Status Perkara (butir 12, 12 Okt 2026): email, HP/WhatsApp
 * (SIPP dulu, lalu e-Court - dengan tanda sumber) dan "bersedia sidang elektronik
 * (e-Litigasi)" dari persetujuan saluran elektronik e-Court. Hanya SELECT, tanpa catatan
 * nilai kontak ke log. Hak lihat dijaga portal (data pribadi). Lihat
 * services/kontakEcourtService.js kontakParaPihak.
 *
 *   GET /sipp/kontak-para-pihak?nomor=273/Pdt.G/2026/PA.Dgl
 *     -> { ok, ada, nomorPerkara, lewatEcourt, ecourtTerbaca, orang[{jenis,pihakKe,urutan,nama,email,hp,elitigasi}] }
 */
router.get("/sipp/kontak-para-pihak", requireInternalToken, async (req, res) => {
  try {
    const nomor = String(req.query.nomor || "").trim().slice(0, 80);
    if (!nomor) return res.status(400).json({ ok: false, alasan: "nomor_kosong" });
    res.json(await require("../services/kontakEcourtService").kontakParaPihak(nomor));
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error?.code || error?.message || error).slice(0, 120) });
  }
});
/* === AKHIR STATUS-ZIP === */

/* === PEKERJAAN 11 Okt === */
/**
 * PEKERJAAN (11 Okt 2026, agen 7): kategori pekerjaan pihak (PNS/TNI/POLRI/BUMN/BUMD/desa; PPPK -> PNS) dari teks
 * bebas SIPP - kamus kamus-deteksi/awal/pekerjaan.json lewat services/pekerjaanPihakService.js. Untuk lajur
 * "Pekerjaan terbaca" di blangko Data Pihak SIPP (usul teks baku, Simpan ditekan petugas). Baca saja.
 *
 *   POST /abt/pekerjaan-terbaca  { teks?: string | string[] (<= 10), perkaraId? }
 *     -> { ok, hasil: [{teks, kunci, label, asal, kodePola, yakin, golongan, dasar, pilihanSipp, teksBaku, kalimat}], pihak? }
 */
const pekerjaanPihakService = require("../services/pekerjaanPihakService");

router.post("/abt/pekerjaan-terbaca", requireInternalToken, async (req, res) => {
  try {
    const masuk = Array.isArray(req.body?.teks) ? req.body.teks : req.body?.teks != null ? [req.body.teks] : [];
    const hasil = masuk.slice(0, 10).map((t) => {
      const teks = String(t == null ? "" : t).slice(0, 300);
      const k = pekerjaanPihakService.klasifikasiPekerjaan(teks);
      return { teks, ...k, kalimat: pekerjaanPihakService.kalimatTerbaca(teks, k) };
    });
    const jawaban = { ok: true, hasil };
    const perkaraId = Number(req.body?.perkaraId);
    if (Number.isFinite(perkaraId) && perkaraId > 0) jawaban.pihak = await pekerjaanPihakService.bacaPekerjaanPihak(perkaraId);
    res.json(jawaban);
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error?.code || error?.message || error).slice(0, 120) });
  }
});
/* === AKHIR PEKERJAAN === */

/* === TAHAP L2 (16 Okt 2026): SIPP DENGAN IDE ALETA - SEPULUH PENANDA === */
/**
 * HANYA MEMBACA SIPP.
 *   POST /sipp/ide-l2/penanda   { nomorPerkara: [..] (<= 100) }
 *     -> { ok, kini: {tanggal, menit}, perkara: { <nomor>: { perkaraId, penanda: [...] } }, terbaca, tidakDikenal }
 *   GET  /sipp/ide-l2/lima-bulan
 *     -> { ok, jumlah, daftar: [{ nomor, hari, lewat }], dasar }   (seluruh satker, untuk Ketua)
 */
const sippIdeL2Service = require("../services/sippIdeL2Service");

router.post("/sipp/ide-l2/penanda", requireInternalToken, async (req, res) => {
  try {
    const daftar = Array.isArray(req.body?.nomorPerkara) ? req.body.nomorPerkara.slice(0, 100).map((x) => String(x || "").slice(0, 60)) : [];
    res.json(await sippIdeL2Service.penandaBanyakNomor(daftar));
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error?.code || error?.message || error).slice(0, 160) });
  }
});

router.get("/sipp/ide-l2/lima-bulan", requireInternalToken, async (_req, res) => {
  try {
    res.json(await sippIdeL2Service.ringkasLimaBulan());
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error?.code || error?.message || error).slice(0, 160) });
  }
});
/* === AKHIR TAHAP L2 === */

router.setRuntimeLifecycleHandlers = setRuntimeLifecycleHandlers;

module.exports = router;
