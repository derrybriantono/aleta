const fs = require("fs");
const path = require("path");
require("dotenv").config();

const {
  normalizeIndonesianPhoneNumber,
  toWhatsappChatId,
} = require("../utils/phoneFormatter");

const defaultConfig = {
  version: 1,
  botEnabled: true,
  notificationsEnabled: true,
  adminWhatsappNumber: "",
  adminWhatsappChatId: "",
  messageDelayMs: 0,
  retryLimit: 0,
  dryRunEnabled: false,
  manualSendEnabled: true,
  internalApiToken: process.env.ALETA_BOT_INTERNAL_TOKEN || "",
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
  useRegistryNotifications: false,
  registryPilotMode: true,
  registryDryRunDefault: true,
  disabledLegacyKeys: [],
  disabledLegacyNotificationKeys: [],
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
    sessionName: process.env.ALETA_BOT_WHATSAPP_SESSION_NAME || "aleta-whatsapp-main",
  },
};

const candidateConfigPaths = [
  path.join(__dirname, "aleta-runtime.json"),
  path.resolve(__dirname, "..", "..", "manajemen_surat", "data", "aleta-bot-runtime.json"),
];

function normalizeWhatsappNumber(number) {
  return normalizeIndonesianPhoneNumber(number);
}

function normalizeChatId(number) {
  return toWhatsappChatId(number);
}

function normalizeEmployeeRecipients(recipients) {
  if (!Array.isArray(recipients)) return [];
  return recipients
    .map((recipient) => {
      const whatsappNumber = normalizeWhatsappNumber(recipient.whatsappNumber || recipient.whatsapp_number);
      return {
        id: String(recipient.id || ""),
        name: String(recipient.name || recipient.username || ""),
        username: String(recipient.username || ""),
        roleId: String(recipient.roleId || recipient.role_id || "").toLowerCase(),
        positionId: String(recipient.positionId || recipient.position_id || "").toLowerCase(),
        positionName: String(recipient.positionName || recipient.position_name || "").toLowerCase(),
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
  const haystack = `${recipient.roleId} ${recipient.positionId} ${recipient.positionName} ${recipient.name}`.toLowerCase();
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

  return normalized || "aleta-session";
}

function readRuntimeConfig() {
  for (const configPath of candidateConfigPaths) {
    try {
      if (!fs.existsSync(configPath)) continue;
      const parsed = JSON.parse(fs.readFileSync(configPath, "utf8"));
      const adminWhatsappNumber = normalizeWhatsappNumber(
        parsed.adminWhatsappNumber || parsed.adminWhatsappChatId || defaultConfig.adminWhatsappNumber
      );

      const sessionName = normalizeSessionName(parsed.whatsapp?.sessionName || defaultConfig.whatsapp.sessionName);

      return {
        ...defaultConfig,
        ...parsed,
        adminWhatsappNumber,
        adminWhatsappChatId: normalizeChatId(adminWhatsappNumber) || defaultConfig.adminWhatsappChatId,
        messageDelayMs: Math.max(0, Number(parsed.messageDelayMs ?? defaultConfig.messageDelayMs)),
        retryLimit: Math.max(0, Number(parsed.retryLimit ?? defaultConfig.retryLimit)),
        internalApiToken: parsed.internalApiToken || process.env.ALETA_BOT_INTERNAL_TOKEN || "",
        manualSendEnabled: parsed.manualSendEnabled ?? defaultConfig.manualSendEnabled,
        rateLimit: {
          ...defaultConfig.rateLimit,
          ...(parsed.rateLimit || {}),
        },
        queueWorker: {
          ...defaultConfig.queueWorker,
          ...(parsed.queueWorker || {}),
        },
        useRegistryNotifications: Boolean(parsed.useRegistryNotifications ?? defaultConfig.useRegistryNotifications),
        registryPilotMode: Boolean(parsed.registryPilotMode ?? defaultConfig.registryPilotMode),
        registryDryRunDefault: Boolean(parsed.registryDryRunDefault ?? defaultConfig.registryDryRunDefault),
        disabledLegacyKeys: Array.isArray(parsed.disabledLegacyKeys) ? parsed.disabledLegacyKeys : [],
        disabledLegacyNotificationKeys: Array.isArray(parsed.disabledLegacyNotificationKeys) ? parsed.disabledLegacyNotificationKeys : [],
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
      sessionName: normalizeSessionName(defaultConfig.whatsapp.sessionName),
    },
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
  readRuntimeConfig,
  normalizeWhatsappNumber,
  normalizeChatId,
  normalizeSessionName,
  normalizeEmployeeRecipients,
  recipientsToMap,
  sleep,
};
