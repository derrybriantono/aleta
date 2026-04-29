const crypto = require("crypto");
require("dotenv").config();

const botDb = require("./botDbService");
const logService = require("./logService");
const { readRuntimeConfig } = require("../config/runtime-config");

const SETTING_KEY = "ai_runtime_config";
const SUPPORTED_PROVIDERS = new Set(["openai", "chatgpt", "gemini", "claude", "llama"]);
const volatileSecrets = new Map();

const DEFAULT_CONFIG = {
  enabled: false,
  publicQaEnabled: false,
  publicQaAiAnswerEnabled: false,
  provider: process.env.ALETA_BOT_AI_DEFAULT_PROVIDER || "gemini",
  model: process.env.ALETA_BOT_AI_DEFAULT_MODEL || "gemini-1.5-flash",
  endpointUrl: "",
  apiKeyEnvKey: "",
  apiKeyConfigured: false,
  configSource: "default",
  timeoutMs: Number(process.env.ALETA_BOT_AI_TIMEOUT_MS || 8000),
  maxTokens: Number(process.env.ALETA_BOT_PUBLIC_QA_MAX_TOKENS || 400),
  temperature: Number(process.env.ALETA_BOT_PUBLIC_QA_TEMPERATURE || 0.2),
  promptPolicy: "public_qa_guarded",
  syncedAt: null,
  lastSyncStatus: "never",
  lastSyncError: "",
  lastTestStatus: "idle",
  lastTestError: "",
  lastTestAt: null,
};

function nowIso() {
  return new Date().toISOString();
}

function createId(prefix) {
  const random = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(12).toString("hex");
  return `${prefix}_${random}`;
}

function normalizeProvider(provider) {
  const normalized = String(provider || "").trim().toLowerCase();
  if (normalized === "chatgpt") return "openai";
  return normalized;
}

function providerForPortal(provider) {
  const normalized = normalizeProvider(provider);
  return normalized === "openai" ? "chatgpt" : normalized;
}

function sanitizeAiError(error) {
  return String(error?.message || error || "AI runtime error")
    .replace(/sk-[a-zA-Z0-9_-]+/g, "sk-***")
    .replace(/AIza[0-9A-Za-z_-]+/g, "AIza***")
    .replace(/(api[_-]?key|token|secret|password)\s*[:=]\s*['"]?[^'"\s]+/gi, "$1=[redacted]")
    .slice(0, 500);
}

function maskApiKey(value) {
  const key = String(value || "").trim();
  if (!key) return "";
  if (key.length <= 8) return "********";
  return `${key.slice(0, 4)}****${key.slice(-4)}`;
}

function parseJson(value, fallback = null) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

function normalizeConfig(input = {}) {
  const provider = normalizeProvider(input.provider || input.providerId || DEFAULT_CONFIG.provider);
  const model = String(input.model || input.modelId || DEFAULT_CONFIG.model).trim();
  const apiKey = String(input.apiKey || "").trim();
  const apiKeyEnvKey = String(input.apiKeyEnvKey || input.api_key_env_key || "").trim();
  const enabled = Boolean(input.enabled);
  const publicQaEnabled = Boolean(input.publicQaEnabled ?? input.public_qa_enabled ?? enabled);
  const publicQaAiAnswerEnabled = Boolean(
    input.publicQaAiAnswerEnabled ?? input.public_qa_ai_answer_enabled ?? publicQaEnabled
  );

  return {
    ...DEFAULT_CONFIG,
    ...input,
    enabled,
    publicQaEnabled,
    publicQaAiAnswerEnabled,
    provider,
    providerId: providerForPortal(provider),
    model,
    modelId: model,
    endpointUrl: String(input.endpointUrl || input.endpoint_url || "").trim(),
    apiKeyEnvKey,
    apiKeyConfigured: Boolean(apiKey || apiKeyEnvKey || input.apiKeyConfigured),
    apiKeyMasked: apiKey ? maskApiKey(apiKey) : String(input.apiKeyMasked || ""),
    secretAvailable: Boolean(
      input.secretAvailable ??
      (apiKey || (apiKeyEnvKey && process.env[apiKeyEnvKey]) || provider === "llama")
    ),
    timeoutMs: clampNumber(input.timeoutMs ?? input.timeout_ms, 1000, 30000, DEFAULT_CONFIG.timeoutMs),
    maxTokens: clampNumber(input.maxTokens ?? input.max_tokens, 100, 2000, DEFAULT_CONFIG.maxTokens),
    temperature: clampNumber(input.temperature, 0, 1, DEFAULT_CONFIG.temperature),
    promptPolicy: String(input.promptPolicy || input.prompt_policy || DEFAULT_CONFIG.promptPolicy),
    configSource: String(input.configSource || input.source || "portal"),
    syncedAt: input.syncedAt || input.synced_at || nowIso(),
    lastSyncStatus: input.lastSyncStatus || "success",
    lastSyncError: String(input.lastSyncError || ""),
  };
}

function resolveAiRuntimeStatus(config = {}) {
  const normalized = normalizeConfig(config);
  if (!normalized.enabled && !normalized.publicQaEnabled && !normalized.publicQaAiAnswerEnabled) {
    return {
      status: "disabled",
      message: "AI runtime ALETA Bot sedang nonaktif.",
    };
  }
  if (normalized.configSource === "env_fallback") {
    return {
      status: "fallback_env",
      message: "AI runtime memakai fallback env development. Production sebaiknya sync dari manajemen_surat.",
    };
  }
  if (normalized.lastTestStatus === "failed" && normalized.lastTestError) {
    return {
      status: "error",
      message: normalized.lastTestError,
    };
  }
  if (normalized.configSource === "manajemen_surat" || normalized.configSource === "portal") {
    if (normalized.apiKeyConfigured && !normalized.secretAvailable && normalized.provider !== "llama") {
      return {
        status: "needs_sync",
        message: "AI config metadata tersedia, tetapi secret runtime belum tersinkron setelah restart.",
      };
    }
  }
  if (normalized.apiKeyConfigured || normalized.provider === "llama") {
    return {
      status: "synced",
      message: "AI runtime siap dipakai oleh ALETA Bot.",
    };
  }
  return {
    status: "unknown",
    message: "Status AI runtime belum dapat dipastikan.",
  };
}

function validateAiRuntimeConfig(config) {
  const normalized = normalizeConfig(config);
  const errors = [];

  if (!SUPPORTED_PROVIDERS.has(normalized.provider)) {
    errors.push(`Provider AI '${normalized.provider}' belum didukung oleh ALETA Bot.`);
  }
  if (!normalized.model) {
    errors.push("Model AI wajib diisi.");
  }
  if (normalized.enabled && !normalized.apiKeyConfigured && normalized.provider !== "llama") {
    errors.push("API key atau env reference wajib tersedia saat AI aktif.");
  }
  if (process.env.NODE_ENV === "production" && normalized.enabled) {
    const dummyPattern = /dummy|example|changeme|test-key/i;
    if (dummyPattern.test(normalized.apiKeyMasked || "") || dummyPattern.test(normalized.apiKeyEnvKey || "")) {
      errors.push("Production tidak boleh memakai API key dummy.");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    config: normalized,
  };
}

function stripSecrets(config = {}) {
  const { apiKey, api_key, ...rest } = config;
  return rest;
}

function maskAiRuntimeConfig(config = {}) {
  const normalized = normalizeConfig(config);
  const runtime = resolveAiRuntimeStatus(normalized);
  return {
    status: runtime.status,
    message: runtime.message,
    enabled: normalized.enabled,
    publicQaEnabled: normalized.publicQaEnabled,
    publicQaAiAnswerEnabled: normalized.publicQaAiAnswerEnabled,
    provider: normalized.provider,
    providerId: normalized.providerId,
    model: normalized.model,
    modelId: normalized.modelId,
    endpointUrl: normalized.endpointUrl,
    apiKeyConfigured: Boolean(normalized.apiKeyConfigured),
    secretAvailable: Boolean(normalized.secretAvailable),
    apiKeyMasked: normalized.apiKeyConfigured ? "configured" : "",
    apiKeyEnvKey: normalized.apiKeyEnvKey,
    configSource: normalized.configSource,
    timeoutMs: normalized.timeoutMs,
    maxTokens: normalized.maxTokens,
    temperature: normalized.temperature,
    promptPolicy: normalized.promptPolicy,
    syncedAt: normalized.syncedAt,
    lastSyncStatus: normalized.lastSyncStatus,
    lastSyncError: normalized.lastSyncError,
    lastTestStatus: normalized.lastTestStatus || "idle",
    lastTestError: normalized.lastTestError || "",
    lastTestAt: normalized.lastTestAt || null,
  };
}

async function readStoredRuntimeConfig() {
  try {
    const ready = await botDb.ensureSchema();
    if (!ready) return null;
    const rows = await botDb.query(
      "SELECT value_json FROM aleta_bot_settings WHERE `key` = ? LIMIT 1",
      [SETTING_KEY]
    );
    const row = Array.isArray(rows) ? rows[0] : null;
    return parseJson(row?.value_json, null);
  } catch (error) {
    logService.logSystemEvent({
      eventType: "ai_runtime_config_read_failed",
      severity: "warning",
      message: "AI runtime config ALETA Bot gagal dibaca dari DB.",
      metadata: { errorMessage: sanitizeAiError(error) },
    });
    return null;
  }
}

async function persistMaskedRuntimeConfig(config, source = "portal") {
  const ready = await botDb.ensureSchema();
  if (!ready) return false;
  const safeConfig = {
    ...maskAiRuntimeConfig(config),
    configSource: source,
  };
  const now = new Date();
  await botDb.query(
    `INSERT INTO aleta_bot_settings (id, \`key\`, value_json, description, updated_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE value_json = VALUES(value_json), description = VALUES(description),
       updated_by = VALUES(updated_by), updated_at = VALUES(updated_at)`,
    [
      createId("abs"),
      SETTING_KEY,
      JSON.stringify(safeConfig),
      "Masked AI runtime config synced from manajemen_surat. API key is kept in process memory or env reference.",
      source,
      botDb.toMysqlDate(now),
      botDb.toMysqlDate(now),
    ]
  );
  return true;
}

function getFallbackEnvConfig() {
  const fallbackEnabled =
    String(process.env.ALETA_BOT_AI_FALLBACK_ENV_ENABLED || "false") === "true" ||
    (process.env.NODE_ENV !== "production" && String(process.env.ALETA_BOT_AI_FALLBACK_ENV_ENABLED || "") === "dev");
  if (!fallbackEnabled) {
    return {
      ...DEFAULT_CONFIG,
      enabled: false,
      publicQaEnabled: false,
      publicQaAiAnswerEnabled: false,
      configSource: "env_fallback_disabled",
      apiKeyConfigured: false,
      secretAvailable: false,
    };
  }

  const provider = normalizeProvider(process.env.ALETA_BOT_AI_DEFAULT_PROVIDER || "gemini");
  const envKey =
    provider === "openai" ? "OPENAI_API_KEY" :
    provider === "gemini" ? "GEMINI_API_KEY" :
    provider === "claude" ? "ANTHROPIC_API_KEY" :
    "";
  const apiKey = envKey ? process.env[envKey] || "" : "";
  return normalizeConfig({
    enabled: Boolean(apiKey || provider === "llama"),
    publicQaEnabled: Boolean(apiKey || provider === "llama"),
    publicQaAiAnswerEnabled: Boolean(apiKey || provider === "llama"),
    provider,
    model: process.env.ALETA_BOT_AI_DEFAULT_MODEL || DEFAULT_CONFIG.model,
    apiKeyEnvKey: envKey,
    apiKeyConfigured: Boolean(apiKey || provider === "llama"),
    apiKeyMasked: maskApiKey(apiKey),
    configSource: "env_fallback",
    timeoutMs: process.env.ALETA_BOT_AI_TIMEOUT_MS,
  });
}

async function getAiRuntimeConfig() {
  const stored = await readStoredRuntimeConfig();
  if (stored) {
    const provider = normalizeProvider(stored.provider);
    const envKey = stored.apiKeyEnvKey || "";
    const secretAvailable = Boolean(
      volatileSecrets.has(SETTING_KEY) ||
      (envKey && process.env[envKey]) ||
      provider === "llama"
    );
    return normalizeConfig({
      ...stored,
      provider,
      apiKeyConfigured: Boolean(stored.apiKeyConfigured),
      secretAvailable,
    });
  }

  const runtime = readRuntimeConfig();
  if (runtime.aiRuntimeConfig) {
    return normalizeConfig({
      ...runtime.aiRuntimeConfig,
      configSource: "runtime_config",
    });
  }

  return getFallbackEnvConfig();
}

async function updateAiRuntimeConfig(payload = {}, source = "portal") {
  const apiKey = String(payload.apiKey || "").trim();
  const normalized = normalizeConfig({
    ...payload,
    apiKeyConfigured: Boolean(apiKey || payload.apiKeyEnvKey || payload.apiKeyConfigured),
    apiKeyMasked: apiKey ? maskApiKey(apiKey) : payload.apiKeyMasked,
    configSource: source,
    syncedAt: nowIso(),
    lastSyncStatus: "success",
    lastSyncError: "",
  });
  const validation = validateAiRuntimeConfig(normalized);
  if (!validation.valid) {
    const message = validation.errors.join(" ");
    await logService.logSystemEvent({
      eventType: "ai_runtime_config_sync_rejected",
      severity: "warning",
      message: "Sinkronisasi AI config dari portal ditolak.",
      metadata: { errors: validation.errors, source },
    });
    throw new Error(message);
  }

  if (apiKey) {
    volatileSecrets.set(SETTING_KEY, apiKey);
  }
  await persistMaskedRuntimeConfig(stripSecrets(validation.config), source);
  await logService.logSystemEvent({
    eventType: "ai_runtime_config_synced",
    severity: "info",
    message: "AI runtime config ALETA Bot berhasil disinkronkan dari portal.",
    metadata: maskAiRuntimeConfig(validation.config),
  });

  return maskAiRuntimeConfig(validation.config);
}

async function getProviderClientConfig(providerOverride) {
  const runtimeConfig = await getAiRuntimeConfig();
  const provider = normalizeProvider(providerOverride || runtimeConfig.provider);
  const envKey = runtimeConfig.apiKeyEnvKey || (
    provider === "openai" ? "OPENAI_API_KEY" :
    provider === "gemini" ? "GEMINI_API_KEY" :
    provider === "claude" ? "ANTHROPIC_API_KEY" :
    ""
  );
  const apiKey =
    volatileSecrets.get(SETTING_KEY) ||
    (envKey ? process.env[envKey] || "" : "");

  return {
    ...runtimeConfig,
    provider,
    providerId: providerForPortal(provider),
    apiKey,
    apiKeyConfigured: Boolean(apiKey || provider === "llama"),
    secretAvailable: Boolean(apiKey || provider === "llama"),
  };
}

async function isAiEnabledForPublicQa() {
  const config = await getProviderClientConfig();
  return Boolean(config.enabled && config.publicQaEnabled && config.apiKeyConfigured);
}

async function updateAiRuntimeTestResult(result = {}) {
  const current = await getAiRuntimeConfig();
  const next = {
    ...current,
    lastTestStatus: result.status || (result.ok ? "success" : "failed"),
    lastTestError: result.errorMessage || "",
    lastTestAt: nowIso(),
  };
  await persistMaskedRuntimeConfig(next, current.configSource || "runtime");
  return maskAiRuntimeConfig(next);
}

module.exports = {
  SETTING_KEY,
  normalizeProvider,
  providerForPortal,
  validateAiRuntimeConfig,
  maskAiRuntimeConfig,
  getAiRuntimeConfig,
  updateAiRuntimeConfig,
  getProviderClientConfig,
  isAiEnabledForPublicQa,
  updateAiRuntimeTestResult,
  sanitizeAiError,
  maskApiKey,
};
