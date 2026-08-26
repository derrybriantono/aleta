const fs = require("fs");
const path = require("path");
require("dotenv").config();

const {
  normalizeIndonesianPhoneNumber,
  toWhatsappChatId,
} = require("../utils/phoneFormatter");

const DEFAULT_WHATSAPP_SESSION_NAME = "aleta-whatsapp-main";
const DEFAULT_DISABLED_LEGACY_NOTIFICATION_KEYS = [
  "sendKetuaPenerimaanPerkara",
  "sendPanitera",
  "sendPenjagaSidangHariIni",
  "sendPenjagaSidangBesok",
  "sendPengingatKasir",
  "sendPengingatHakim",
  "pengingatHakim",
  "sendPengingatPaniteraSidang",
  "pengingatPanitera",
  "sendStatusSidangHakim",
  "statusSidangHakim",
  "sendStatusSidangPanitera",
  "statusSidangPanitera",
  "sendAntrianSidangHariIni",
  "statusSidangHariIni",
  "sendStatusSidangJurusita",
  "statusSidangJurusita",
  "sendRelaasJurusita",
  "statusRelaasJurusita",
  "sendPihakBaru",
  "sendPihakAktaCerai",
  "sendPihakSisaPanjar",
  "sendPihakPanjarBelum",
  "sendPihakPutusan",
  "sendPihakHariSidang",
  "sendPihakSebelumHariSidang",
  "sendPihakTundaCuti",
];

const defaultConfig = {
  version: 1,
  botEnabled: true,
  notificationsEnabled: true,
  adminWhatsappNumber: "",
  adminWhatsappChatId: "",
  messageDelayMs: 0,
  // Batas atas jeda ber-jitter. Bila > messageDelayMs, jeda antar pesan diacak
  // dalam rentang [messageDelayMs, messageDelayMaxMs] (anti-ban). Diisi oleh
  // Slider Risiko di portal; 0 = perilaku lama (jeda tetap).
  messageDelayMaxMs: 0,
  retryLimit: 0,
  dryRunEnabled: false,
  manualSendEnabled: true,
  internalApiToken: process.env.ALETA_BOT_INTERNAL_TOKEN || "",
  productionAutomationGuard: {
    enabled: true,
    legacyDirectSendEnabled: false,
    legacyNotificationSchedulerEnabled: false,
    requireGatewayMessageContract: true,
  },
  rateLimit: {
    maxPerMinute: 60,
    maxPerHour: 1000,
    maxPerDay: 5000,
  },
  queueWorker: {
    enabled: String(process.env.ALETA_BOT_QUEUE_WORKER_ENABLED || "true") !== "false",
    intervalMs: Number(process.env.ALETA_BOT_QUEUE_WORKER_INTERVAL_MS || 30000),
    batchSize: Number(process.env.ALETA_BOT_QUEUE_WORKER_BATCH_SIZE || 5),
  },
  sendingWindow: {
    enabled: String(process.env.ALETA_BOT_SENDING_WINDOW_ENABLED || "true") !== "false",
    start: process.env.ALETA_BOT_SENDING_WINDOW_START || "07:30",
    end: process.env.ALETA_BOT_SENDING_WINDOW_END || "21:00",
  },
  // Pengaman query ke database perkara: batas waktu eksekusi dan batas
  // sambungan. Tanpa ini, query lambat menggantung sampai kolam sambungan
  // habis dan bot berhenti menjawab siapa pun.
  queryGuard: {
    enabled: String(process.env.ALETA_BOT_QUERY_GUARD_ENABLED || "true") !== "false",
    timeoutMs: Number(process.env.ALETA_BOT_QUERY_TIMEOUT_MS || 15000),
    serverEnforced: String(process.env.ALETA_BOT_QUERY_GUARD_SERVER_ENFORCED || "true") !== "false",
    connectionLimit: Number(process.env.ALETA_BOT_DB_CONNECTION_LIMIT || 10),
  },
  // Jarak waktu antar pesan di ANTREAN (bukan hanya saat kirim). Mencegah
  // puluhan notifikasi sejenis berangkat serentak — pola paling khas akun bot.
  // Diisi oleh Slider Risiko di portal.
  sendingPace: {
    enabled: String(process.env.ALETA_BOT_SENDING_PACE_ENABLED || "true") !== "false",
    minGapMs: Number(process.env.ALETA_BOT_SENDING_PACE_MIN_GAP_MS || 8000),
    maxGapMs: Number(process.env.ALETA_BOT_SENDING_PACE_MAX_GAP_MS || 15000),
    perRecipientCooldownMs: Number(process.env.ALETA_BOT_SENDING_PACE_RECIPIENT_COOLDOWN_MS || 300000),
  },
  useRegistryNotifications: true,
  registryPilotMode: false,
  registryDryRunDefault: true,
  legacyNotificationTakeoverMode: true,
  disabledLegacyKeys: [],
  disabledLegacyNotificationKeys: DEFAULT_DISABLED_LEGACY_NOTIFICATION_KEYS,
  disabledLegacyCommandKeys: [],
  dbConnections: [],
  publicQaEnabled: true,
  publicQaAiEnabled: false,
  publicQaAiAnswerEnabled: String(process.env.ALETA_BOT_PUBLIC_QA_AI_ANSWER_ENABLED || "false") === "true",
  publicQaAiAnswerMode: process.env.ALETA_BOT_PUBLIC_QA_AI_ANSWER_MODE || "template_only",
  publicQaAiTimeoutMs: Number(process.env.ALETA_BOT_PUBLIC_QA_AI_TIMEOUT_MS || 8000),
  publicQaMaxTokens: Number(process.env.ALETA_BOT_PUBLIC_QA_MAX_TOKENS || 400),
  publicQaTemperature: Number(process.env.ALETA_BOT_PUBLIC_QA_TEMPERATURE || 0.2),
  publicQaSessionTtlMinutes: Number(process.env.ALETA_BOT_PUBLIC_QA_SESSION_TTL_MINUTES || 20),
  publicQaRequireApproval: String(process.env.ALETA_BOT_PUBLIC_QA_REQUIRE_APPROVAL || "true") !== "false",
  publicQaIntents: [],
  publicQaKnowledge: [],
  institutionIdentity: {
    courtName: process.env.ALETA_COURT_NAME || "Pengadilan",
    courtShortName: process.env.ALETA_COURT_SHORT_NAME || "",
    address: "",
    phoneNumber: "",
    mobilePhone: "",
    csWhatsappNumber: "",
    botWhatsappNumber: "",
    email: "",
    instagram: "",
    facebook: "",
    youtube: "",
    website: process.env.ALETA_COURT_WEBSITE || "",
    mapUrl: "",
  },
  aiRuntimeConfig: {
    enabled: false,
    publicQaEnabled: false,
    publicQaAiAnswerEnabled: false,
    provider: process.env.ALETA_BOT_AI_DEFAULT_PROVIDER || "gemini",
    model: process.env.ALETA_BOT_AI_DEFAULT_MODEL || "gemini-1.5-flash",
    endpointUrl: "",
    apiKeyEnvKey: "",
    apiKeyConfigured: false,
    configSource: process.env.ALETA_BOT_AI_CONFIG_SOURCE || "portal",
    timeoutMs: Number(process.env.ALETA_BOT_AI_TIMEOUT_MS || 8000),
    maxTokens: Number(process.env.ALETA_BOT_PUBLIC_QA_MAX_TOKENS || 400),
    temperature: Number(process.env.ALETA_BOT_PUBLIC_QA_TEMPERATURE || 0.2),
    promptPolicy: "public_qa_guarded",
  },
  scheduleCron: "00 07 * * Monday-Friday",
  testTargetNumber: "",
  templates: [],
  notifications: [],
  queries: [],
  employeeRecipients: [],
  whatsapp: {
    sessionName: process.env.ALETA_BOT_WHATSAPP_SESSION_NAME || DEFAULT_WHATSAPP_SESSION_NAME,
  },
};

const writableRuntimeConfigPath =
  process.env.ALETA_BOT_RUNTIME_CONFIG_PATH || path.join(__dirname, "aleta-runtime.json");

const candidateConfigPaths = [
  writableRuntimeConfigPath,
  path.join(__dirname, "aleta-runtime.json"),
  path.resolve(__dirname, "..", "..", "manajemen_surat", "data", "aleta-bot-runtime.json"),
];

function normalizeWhatsappNumber(number) {
  return normalizeIndonesianPhoneNumber(number);
}

function normalizeChatId(number) {
  return toWhatsappChatId(number);
}

function uniqueStrings(values) {
  return [...new Set((Array.isArray(values) ? values : [])
    .map((value) => String(value || "").trim())
    .filter(Boolean))];
}

function normalizeEmployeeRecipients(recipients) {
  if (!Array.isArray(recipients)) return [];
  return recipients
    .map((recipient) => {
      const whatsappNumber = normalizeWhatsappNumber(recipient.whatsappNumber || recipient.whatsapp_number);
      const additionalRoleIds = Array.isArray(recipient.additionalRoleIds || recipient.additional_role_ids)
        ? (recipient.additionalRoleIds || recipient.additional_role_ids).map((item) => String(item || "").toLowerCase()).filter(Boolean)
        : [];
      return {
        id: String(recipient.id || ""),
        name: String(recipient.name || recipient.username || ""),
        username: String(recipient.username || ""),
        roleId: String(recipient.roleId || recipient.role_id || "").toLowerCase(),
        positionId: String(recipient.positionId || recipient.position_id || "").toLowerCase(),
        positionName: String(recipient.positionName || recipient.position_name || "").toLowerCase(),
        unitKerja: String(recipient.unitKerja || recipient.unit_kerja || "").toLowerCase(),
        additionalRoleIds,
        whatsappNumber,
        whatsappChatId: normalizeChatId(whatsappNumber),
      };
    })
    .filter((recipient) => recipient.whatsappChatId);
}

function recipientMatches(recipient, hints) {
  const normalizedHints = (Array.isArray(hints) ? hints : [hints])
    .map((hint) => String(hint || "").toLowerCase())
    .filter(Boolean);
  if (normalizedHints.length === 0) return true;
  const haystack = `${recipient.id} ${recipient.roleId} ${recipient.positionId} ${recipient.positionName} ${recipient.unitKerja} ${(recipient.additionalRoleIds || []).join(" ")} ${recipient.name} ${recipient.username}`.toLowerCase();
  return normalizedHints.some((hint) => haystack.includes(hint));
}

function recipientsToMap(recipients, hints) {
  return normalizeEmployeeRecipients(recipients).reduce((map, recipient) => {
    if (recipientMatches(recipient, hints)) {
      map[recipient.name || recipient.username || recipient.id] = recipient.whatsappChatId;
    }
    return map;
  }, {});
}

function normalizeSessionName(sessionName) {
  const normalized = String(sessionName || "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .toLowerCase();

  return normalized || DEFAULT_WHATSAPP_SESSION_NAME;
}

function getWhatsappSessionName(runtimeConfig = {}) {
  return normalizeSessionName(
    process.env.ALETA_BOT_WHATSAPP_SESSION_NAME ||
    runtimeConfig.whatsapp?.sessionName ||
    DEFAULT_WHATSAPP_SESSION_NAME
  );
}

function readRuntimeConfig() {
  for (const configPath of candidateConfigPaths) {
    try {
      if (!fs.existsSync(configPath)) continue;
      const parsed = JSON.parse(fs.readFileSync(configPath, "utf8"));
      const adminWhatsappNumber = normalizeWhatsappNumber(
        parsed.adminWhatsappNumber || parsed.adminWhatsappChatId || defaultConfig.adminWhatsappNumber
      );

      const sessionName = getWhatsappSessionName(parsed);
      const legacyNotificationTakeoverMode = Boolean(
        parsed.legacyNotificationTakeoverMode ?? defaultConfig.legacyNotificationTakeoverMode
      );
      const takeoverDisabledLegacyNotificationKeys = legacyNotificationTakeoverMode
        ? defaultConfig.disabledLegacyNotificationKeys
        : [];
      const disabledLegacyNotificationKeys = uniqueStrings([
        ...takeoverDisabledLegacyNotificationKeys,
        ...(Array.isArray(parsed.disabledLegacyNotificationKeys) ? parsed.disabledLegacyNotificationKeys : []),
      ]);

      return {
        ...defaultConfig,
        ...parsed,
        adminWhatsappNumber,
        adminWhatsappChatId: normalizeChatId(adminWhatsappNumber) || defaultConfig.adminWhatsappChatId,
        messageDelayMs: Math.max(0, Number(parsed.messageDelayMs ?? defaultConfig.messageDelayMs)),
        messageDelayMaxMs: Math.max(0, Number(parsed.messageDelayMaxMs ?? defaultConfig.messageDelayMaxMs)),
        retryLimit: Math.max(0, Number(parsed.retryLimit ?? defaultConfig.retryLimit)),
        internalApiToken: parsed.internalApiToken || process.env.ALETA_BOT_INTERNAL_TOKEN || "",
        manualSendEnabled: parsed.manualSendEnabled ?? defaultConfig.manualSendEnabled,
        productionAutomationGuard: {
          ...defaultConfig.productionAutomationGuard,
          ...(parsed.productionAutomationGuard || {}),
        },
        rateLimit: {
          ...defaultConfig.rateLimit,
          ...(parsed.rateLimit || {}),
        },
        queueWorker: {
          ...defaultConfig.queueWorker,
          ...(parsed.queueWorker || {}),
        },
        sendingWindow: {
          ...defaultConfig.sendingWindow,
          ...(parsed.sendingWindow || {}),
        },
        sendingPace: {
          ...defaultConfig.sendingPace,
          ...(parsed.sendingPace || {}),
        },
        queryGuard: {
          ...defaultConfig.queryGuard,
          ...(parsed.queryGuard || {}),
        },
        useRegistryNotifications: Boolean(parsed.useRegistryNotifications ?? defaultConfig.useRegistryNotifications),
        registryPilotMode: Boolean(parsed.registryPilotMode ?? defaultConfig.registryPilotMode),
        registryDryRunDefault: Boolean(parsed.registryDryRunDefault ?? defaultConfig.registryDryRunDefault),
        legacyNotificationTakeoverMode,
        disabledLegacyKeys: uniqueStrings([
          ...takeoverDisabledLegacyNotificationKeys,
          ...(Array.isArray(parsed.disabledLegacyKeys) ? parsed.disabledLegacyKeys : []),
          ...disabledLegacyNotificationKeys,
        ]),
        disabledLegacyNotificationKeys,
        disabledLegacyCommandKeys: Array.isArray(parsed.disabledLegacyCommandKeys) ? parsed.disabledLegacyCommandKeys : [],
        dbConnections: Array.isArray(parsed.dbConnections) ? parsed.dbConnections : [],
        publicQaEnabled: Boolean(parsed.publicQaEnabled ?? defaultConfig.publicQaEnabled),
        publicQaAiEnabled: Boolean(parsed.publicQaAiEnabled ?? defaultConfig.publicQaAiEnabled),
        publicQaAiAnswerEnabled: Boolean(parsed.publicQaAiAnswerEnabled ?? defaultConfig.publicQaAiAnswerEnabled),
        publicQaAiAnswerMode: parsed.publicQaAiAnswerMode || defaultConfig.publicQaAiAnswerMode,
        publicQaAiTimeoutMs: Number(parsed.publicQaAiTimeoutMs ?? defaultConfig.publicQaAiTimeoutMs),
        publicQaMaxTokens: Number(parsed.publicQaMaxTokens ?? defaultConfig.publicQaMaxTokens),
        publicQaTemperature: Number(parsed.publicQaTemperature ?? defaultConfig.publicQaTemperature),
        publicQaSessionTtlMinutes: Number(parsed.publicQaSessionTtlMinutes ?? defaultConfig.publicQaSessionTtlMinutes),
        publicQaRequireApproval: Boolean(parsed.publicQaRequireApproval ?? defaultConfig.publicQaRequireApproval),
        publicQaIntents: Array.isArray(parsed.publicQaIntents) ? parsed.publicQaIntents : [],
        publicQaKnowledge: Array.isArray(parsed.publicQaKnowledge) ? parsed.publicQaKnowledge : [],
        institutionIdentity: {
          ...defaultConfig.institutionIdentity,
          ...(parsed.institutionIdentity || {}),
        },
        aiRuntimeConfig: {
          ...defaultConfig.aiRuntimeConfig,
          ...(parsed.aiRuntimeConfig || {}),
        },
        employeeRecipients: normalizeEmployeeRecipients(parsed.employeeRecipients),
        notifications: Array.isArray(parsed.notifications) ? parsed.notifications : [],
        queries: Array.isArray(parsed.queries) ? parsed.queries : [],
        templates: Array.isArray(parsed.templates) ? parsed.templates : [],
        whatsapp: {
          ...defaultConfig.whatsapp,
          ...(parsed.whatsapp || {}),
          sessionName,
        },
      };
    } catch (error) {
      console.error("[ALETA Bot] Gagal membaca runtime config:", error.message);
    }
  }

  return {
    ...defaultConfig,
    adminWhatsappChatId: normalizeChatId(defaultConfig.adminWhatsappNumber),
    whatsapp: {
      ...defaultConfig.whatsapp,
      sessionName: getWhatsappSessionName(defaultConfig),
    },
  };
}

function writeRuntimeConfig(nextConfig = {}) {
  const payload = {
    ...nextConfig,
    version: Number(nextConfig.version || 1),
    updatedAt: nextConfig.updatedAt || new Date().toISOString(),
    source: nextConfig.source || "manajemen_surat",
  };
  fs.mkdirSync(path.dirname(writableRuntimeConfigPath), { recursive: true });
  fs.writeFileSync(writableRuntimeConfigPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return readRuntimeConfig();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
  readRuntimeConfig,
  writeRuntimeConfig,
  getWhatsappSessionName,
  normalizeWhatsappNumber,
  normalizeChatId,
  normalizeSessionName,
  normalizeEmployeeRecipients,
  recipientsToMap,
  sleep,
};
