const { readRuntimeConfig, sleep, adalahPenerimaPegawai } = require("../config/runtime-config");
const { validateWhatsappRecipient } = require("../utils/phoneFormatter");
const logService = require("./logService");
const rateLimitService = require("./rateLimitService");
const whatsappStatusService = require("./whatsappStatusService");
const productionGuardService = require("./productionGuardService");
const whatsappAudienceService = require("./whatsappAudienceService");
const blockedRecipientService = require("./blockedRecipientService");
const optOutService = require("./optOutService");
const recipientHealthService = require("./recipientHealthService");
const humanPresenceService = require("./humanPresenceService");
const banSignalService = require("./banSignalService");
const numberWarmupService = require("./numberWarmupService");

function getMessagePreview(message) {
  if (typeof message === "string") {
    return message.replace(/\s+/g, " ").slice(0, 240);
  }
  return "[media/non-text message]";
}

function getWhatsappMessageId(response) {
  if (!response || typeof response !== "object") return "";
  const candidates = [
    response.id,
    response.messageId,
    response._data && response._data.id,
    response._data && response._data.messageId,
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    if (typeof candidate === "string") return candidate;
    if (candidate._serialized) return String(candidate._serialized);
    if (candidate.id) return String(candidate.id);
  }
  return "";
}

function isNotificationContext(category) {
  return ["employee", "party", "notification"].includes(String(category || "").toLowerCase());
}

function isLegacyDirectSend(metadata = {}) {
  const source = String(metadata.source || metadata.sourceFeature || "").toLowerCase();
  return source.startsWith("legacy_") || source.includes("legacy_safe") || source.includes("legacy_client");
}

function isQueuedMessage(metadata = {}) {
  return Boolean(metadata && metadata.queueId);
}

function shouldBypassConfiguredDelay(category, metadata = {}) {
  const normalizedCategory = String(category || "").toLowerCase();
  return normalizedCategory === "manual" || metadata.processImmediately === true || metadata.testMessage === true;
}

/**
 * Jeda antar pesan dengan JITTER (acak) untuk mengurangi risiko akun ditandai
 * bot oleh WhatsApp.
 *
 * Interval yang PERSIS sama tiap pesan adalah salah satu ciri paling mudah
 * dikenali sebagai otomatisasi. Slider Risiko di portal menetapkan rentang
 * [messageDelayMs, messageDelayMaxMs]; di sini dipilih satu nilai acak dalam
 * rentang itu. Bila max tidak diset (atau <= min), perilaku lama dipakai
 * (jeda tetap) — jadi aman untuk konfigurasi lama.
 */
function resolveJitteredDelayMs(runtimeConfig, explicitDelayMs) {
  if (explicitDelayMs != null) return Math.max(0, Number(explicitDelayMs) || 0);
  const minMs = Math.max(0, Number(runtimeConfig.messageDelayMs) || 0);
  const maxMs = Math.max(0, Number(runtimeConfig.messageDelayMaxMs) || 0);
  if (maxMs > minMs) {
    return Math.floor(minMs + Math.random() * (maxMs - minMs + 1));
  }
  return minMs;
}

function isWhatsappConnected() {
  const status = whatsappStatusService.getStatus().status;
  return status === "connected";
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
  isRegisteredChecker,
} = {}) {
  const runtimeConfig = readRuntimeConfig();
  const validation = validateWhatsappRecipient(to);
  const messagePreview = typeof message === "string" ? getMessagePreview(message) : getMessagePreview(options?.caption || message);
  const queuedMessage = isQueuedMessage(metadata);
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

  // Lapis kedua: apa pun jalurnya, bot tidak boleh mengirim ke status atau
  // saluran siaran. Penyaringan utama ada di handler pesan masuk; ini menahan
  // jalur lain (antrean, notifikasi, kirim manual) yang mungkin menerima chat
  // id siaran dari data yang salah.
  if (whatsappAudienceService.isStatusOrBroadcastChatId(to) || whatsappAudienceService.isStatusOrBroadcastChatId(validation.chatId)) {
    logService.logMessageSkipped({
      ...baseLog,
      status: "skipped",
      errorMessage: "status_atau_siaran_bukan_tujuan_sah",
      metadata: { ...baseLog.metadata, rawRecipient: String(to || "") },
    });
    logService.logSystemEvent({
      eventType: "broadcast_target_blocked",
      severity: "warning",
      message: "Pengiriman ke status/siaran WhatsApp ditolak. ALETA Bot hanya melayani chat langsung dan notifikasi terjadwal.",
      metadata: { rawRecipient: String(to || ""), notificationKey, category },
    });
    return null;
  }

  // Akun yang diblokir di portal tidak boleh menerima apa pun, termasuk saat
  // nama dan nomornya datang dari SIPP yang tidak tahu soal pemblokiran.
  const alasanBlokir = blockedRecipientService.getBlockReason(
    {
      number: validation.chatId ? validation.normalized : to,
      name: metadata.recipientName || metadata.recipient_name || metadata.nama_pegawai || metadata.nama || "",
    },
    runtimeConfig
  );
  if (alasanBlokir) {
    logService.logMessageSkipped({
      ...baseLog,
      status: "skipped",
      errorMessage: alasanBlokir,
      metadata: { ...baseLog.metadata, rawRecipient: String(to || "") },
    });
    logService.logSystemEvent({
      eventType: "blocked_account_message_skipped",
      severity: "warning",
      message: "Pengiriman dibatalkan karena akun tujuan diblokir di portal ALETA.",
      metadata: {
        reason: alasanBlokir,
        rawRecipient: String(to || ""),
        recipientName: String(metadata.recipientName || metadata.nama_pegawai || metadata.nama || ""),
        notificationKey,
        category,
      },
    });
    return null;
  }

  // Penerima yang meminta BERHENTI tidak lagi menerima pemberitahuan otomatis.
  // Balasan atas pertanyaan yang mereka kirim sendiri tetap dilayani: menolak
  // menjawab orang yang menghubungi kita lebih dulu membuat layanan terasa
  // rusak, dan bukan itu yang mereka minta hentikan.
  if (isNotificationContext(category) && await optOutService.isOptedOut(validation.chatId || to)) {
    logService.logMessageSkipped({
      ...baseLog,
      status: "skipped",
      errorMessage: "penerima_berhenti_berlangganan",
    });
    logService.logSystemEvent({
      eventType: "opted_out_message_skipped",
      severity: "info",
      message: "Pemberitahuan dibatalkan karena penerima sudah meminta berhenti.",
      metadata: { notificationKey, category },
    });
    return null;
  }

  // Nomor yang pesannya tidak pernah sampai dihentikan. Terus mengirim ke sana
  // hanya menumpuk sinyal buruk di mata WhatsApp tanpa satu pun pesan diterima.
  if (isNotificationContext(category) && await recipientHealthService.isSuppressed(validation.chatId || to)) {
    logService.logMessageSkipped({
      ...baseLog,
      status: "skipped",
      errorMessage: "penerima_dihentikan_tidak_pernah_sampai",
    });
    logService.logSystemEvent({
      eventType: "suppressed_recipient_message_skipped",
      severity: "info",
      message: "Pemberitahuan dibatalkan karena pesan ke nomor ini tidak pernah sampai.",
      metadata: { notificationKey, category },
    });
    return null;
  }

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

  // Berhenti total bila WhatsApp sudah menandai akun. Ditaruh SEBELUM seluruh
  // penjaga lain karena ini satu-satunya keadaan yang tidak boleh ditembus
  // kategori apa pun - termasuk manual dan sistem. Mengirim apa pun dari nomor
  // yang sedang ditandai memperberat penilaiannya.
  if (banSignalService.isHalted()) {
    const tanda = banSignalService.getStatus();
    logService.logMessageSkipped({
      ...baseLog,
      status: "skipped",
      errorMessage: "ban_signal_halt",
      metadata: { ...baseLog.metadata, haltReason: tanda.haltReason, haltedAt: tanda.haltedAt },
    });
    return null;
  }

  if (isNotificationContext(category) && !runtimeConfig.notificationsEnabled) {
    logService.logMessageSkipped({ ...baseLog, status: "skipped", errorMessage: "notifications_disabled" });
    return null;
  }

  // ==========================================================================
  // DUA SALURAN, DUA SAKLAR
  // ==========================================================================
  //
  // Pegawai dan pihak berperkara kerap perlu diperlakukan berbeda:
  // menghentikan pemberitahuan ke pihak saat nomornya sedang bermasalah
  // sambil tetap mengirim tugas ke pegawai, atau meliburkan pemberitahuan
  // internal tanpa memutus panggilan sidang kepada para pihak.
  //
  // Hanya berlaku untuk pesan yang DIMULAI BOT SENDIRI. Balasan atas pesan
  // yang masuk tidak pernah ikut ditahan: mematikan pengiriman tidak boleh
  // membuat bot mendiamkan orang yang sedang bertanya kepadanya.
  //
  // Nomor yang tidak ada di daftar pegawai dianggap nomor PIHAK - lihat
  // adalahPenerimaPegawai di config/runtime-config.js untuk alasannya.
  if (isNotificationContext(category)) {
    const kePegawai = adalahPenerimaPegawai(
      validation.chatId || to,
      runtimeConfig.employeeRecipients
    );
    const bolehPegawai = runtimeConfig.kirimPegawaiEnabled !== false;
    const bolehPihak = runtimeConfig.kirimPihakEnabled !== false;

    if (kePegawai && !bolehPegawai) {
      logService.logMessageSkipped({
        ...baseLog,
        status: "skipped",
        errorMessage: "pengiriman_pegawai_dimatikan",
      });
      return null;
    }

    if (!kePegawai && !bolehPihak) {
      logService.logMessageSkipped({
        ...baseLog,
        status: "skipped",
        errorMessage: "pengiriman_pihak_dimatikan",
      });
      return null;
    }
  }

  // Pemanasan nomor: batas harian yang naik bertahap setelah nomor bermasalah.
  // Hanya berlaku untuk pesan yang dimulai bot sendiri; balasan chat tidak
  // pernah ikut ditahan.
  if (isNotificationContext(category)) {
    const pemanasan = await numberWarmupService.checkWarmupLimit(category, { runtimeConfig });
    if (!pemanasan.allowed) {
      numberWarmupService.logWarmupHold(pemanasan);
      logService.logMessageSkipped({
        ...baseLog,
        status: "skipped",
        errorMessage: "warmup_limit_reached",
        metadata: { ...baseLog.metadata, cap: pemanasan.cap, sent: pemanasan.sent, day: pemanasan.day },
      });
      return null;
    }
  }

  const guardDecision = productionGuardService.shouldBlockLegacyQueueMessage({
    sourceApp: metadata.sourceApp || metadata.source_app || "",
    sourceFeature: metadata.sourceFeature || metadata.source_feature || metadata.source || "",
    category,
    metadata,
  }, runtimeConfig);
  if (guardDecision.blocked) {
    logService.logMessageSkipped({
      ...baseLog,
      status: "skipped",
      errorMessage: guardDecision.reason || "legacy_direct_send_blocked_by_production_guard",
      metadata: {
        ...baseLog.metadata,
        guard: "production_message_contract",
        guardReason: guardDecision.reason || "",
      },
    });
    logService.logSystemEvent({
      eventType: "message_contract_send_blocked",
      severity: "warning",
      message: "Pengiriman WhatsApp diblokir oleh production guard kontrak pesan.",
      metadata: {
        notificationKey,
        category,
        recipientType: validation.type,
        guardReason: guardDecision.reason || "",
      },
    });
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

  if (!isWhatsappConnected()) {
    const currentStatus = whatsappStatusService.getStatus().status || "unknown";
    const errorMessage = `WhatsApp belum tersambung. Status runtime saat ini: ${currentStatus}.`;
    logService.logMessageFailed({ ...baseLog, errorMessage });
    if (queuedMessage) throw new Error(errorMessage);
    return null;
  }

  const rateLimit = rateLimitService.checkRateLimit(runtimeConfig);
  if (!rateLimit.allowed) {
    const errorMessage = rateLimit.reason || "rate_limit_reached";
    rateLimitService.logRateLimit(rateLimit.reason, {
      recipient: validation.chatId,
      notificationKey,
      category,
      rateLimit: rateLimit.config,
    });
    if (queuedMessage) {
      logService.logMessageFailed({ ...baseLog, errorMessage });
      throw new Error(errorMessage);
    }
    logService.logMessageSkipped({ ...baseLog, status: "skipped", errorMessage });
    return null;
  }

  // Nomor yang tidak terdaftar WhatsApp tidak perlu dicoba: tingkat gagal-kirim
  // yang tinggi adalah ciri khas daftar nomor hasil kikisan data, dan data
  // telepon SIPP pasti memuat nomor mati serta salah ketik.
  //
  // Pemeriksaannya GAGAL-TERBUKA: bila WhatsApp belum siap atau pemeriksaannya
  // bermasalah, pengiriman tetap dilanjutkan. Notifikasi pengadilan tidak boleh
  // berhenti gara-gara alat bantu anti-blokir tidak dapat dijalankan.
  if (isNotificationContext(category)) {
    const pendaftaran = await recipientHealthService.isRegisteredOnWhatsapp(
      validation.normalized || validation.chatId,
      typeof isRegisteredChecker === "function" ? isRegisteredChecker : (client && client.isRegisteredUser && client.isRegisteredUser.bind(client))
    );
    if (pendaftaran.checked && !pendaftaran.registered) {
      logService.logMessageSkipped({
        ...baseLog,
        status: "skipped",
        errorMessage: "nomor_tidak_terdaftar_whatsapp",
      });
      logService.logSystemEvent({
        eventType: "unregistered_recipient_skipped",
        severity: "info",
        message: "Pengiriman dibatalkan karena nomor tujuan tidak terdaftar di WhatsApp. Perbaiki nomornya di SIPP.",
        metadata: { notificationKey, category, recipientType: validation.type },
      });
      return null;
    }
  }

  const maxRetries = Math.max(0, Number(retryLimit ?? runtimeConfig.retryLimit ?? 0));
  // Jeda ber-jitter: nilai acak dalam [messageDelayMs, messageDelayMaxMs].
  // Pesan manual/uji tetap tanpa jeda. delayMs eksplisit (bila diberikan
  // pemanggil) tetap dihormati apa adanya.
  const bypass = shouldBypassConfiguredDelay(category, metadata);
  const effectiveDelayMs = bypass ? Math.max(0, Number(delayMs ?? 0)) : resolveJitteredDelayMs(runtimeConfig, delayMs ?? null);
  const sendMessage = sendFn || (client && client.sendMessage && client.sendMessage.bind(client));

  if (typeof sendMessage !== "function") {
    logService.logMessageFailed({ ...baseLog, errorMessage: "missing_send_function" });
    return null;
  }

  // Jeda sebelum kirim dipakai sekalian untuk menampilkan "sedang mengetik...".
  // Karena jedanya memang sudah ada, kemiripan dengan manusia ini didapat
  // TANPA menambah waktu tunggu sedikit pun untuk pesan notifikasi.
  //
  // Untuk balasan chat, jeda terjadwalnya nol, sehingga indikator mengetik
  // menambah 1-4 detik. Itu disengaja: balasan yang muncul seketika justru
  // yang paling terlihat sebagai mesin.
  const presenceConfig = humanPresenceService.getPresenceConfig(runtimeConfig);
  const typingMs = presenceConfig.typingEnabled
    ? humanPresenceService.typingDurationMs(typeof message === "string" ? message : "", presenceConfig)
    : 0;
  const preSendWaitMs = Math.max(effectiveDelayMs, bypass ? typingMs : 0);

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    logService.logMessageAttempt({ ...baseLog, retryCount: attempt });
    try {
      if (preSendWaitMs > 0) {
        // showTyping selalu menunggu selama durasi yang diminta, bahkan bila
        // indikatornya gagal ditampilkan. Jedanya sendiri yang penting.
        await humanPresenceService.showTyping(client, validation.chatId, preSendWaitMs, presenceConfig);
      }

      const response = await sendMessage(validation.chatId, message, options);
      const whatsappMessageId = getWhatsappMessageId(response);
      rateLimitService.recordSend();
      whatsappStatusService.recordMessageSent();
      logService.logMessageSent({
        ...baseLog,
        retryCount: attempt,
        whatsappMessageId,
        metadata: {
          ...baseLog.metadata,
          ...(whatsappMessageId ? { whatsappMessageId } : {}),
        },
      });
      return response;
    } catch (error) {
      const errorMessage = error && error.message ? error.message : String(error);
      logService.logMessageFailed({ ...baseLog, retryCount: attempt, errorMessage });
      console.error(`[ALETA Bot] Gagal mengirim pesan ke ${validation.chatId} pada percobaan ${attempt + 1}:`, errorMessage);
      if (attempt >= maxRetries) {
        if (queuedMessage) throw new Error(errorMessage);
        return null;
      }
    }
  }

  return null;
}

module.exports = {
  safeSendMessage,
  getMessagePreview,
  getWhatsappMessageId,
  resolveJitteredDelayMs,
};
