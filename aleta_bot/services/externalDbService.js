const mysql = require("mysql");
const crypto = require("crypto");
const { readRuntimeConfig } = require("../config/runtime-config");
const logService = require("./logService");

const legacyConnections = {
  sipp_primary: {
    key: "sipp_primary",
    name: "SIPP Utama",
    description: "Fallback legacy dari db_config.js untuk data perkara/SIPP utama.",
    driver: "mysql",
    host: process.env.ALETA_BOT_DB_SIPP_HOST || process.env.ALETA_BOT_DB_HOST || "localhost",
    port: Number(process.env.ALETA_BOT_DB_SIPP_PORT || process.env.ALETA_BOT_DB_PORT || 3306),
    databaseName: process.env.ALETA_BOT_DB_SIPP_NAME || process.env.ALETA_BOT_DB_NAME || "SIPP",
    username: process.env.ALETA_BOT_DB_SIPP_USER || process.env.ALETA_BOT_DB_USER || "root",
    passwordEnvKey: "ALETA_BOT_DB_SIPP_PASSWORD",
    fallbackPasswordEnvKey: "ALETA_BOT_DB_PASSWORD",
    sslEnabled: false,
    connectionTimeoutMs: 5000,
    isActive: true,
    isDefault: true,
    legacySource: "db_config.js",
  },
  antrian_sidang: {
    key: "antrian_sidang",
    name: "Antrian Sidang",
    description: "Fallback legacy dari db_config4.js untuk data antrian sidang.",
    driver: "mysql",
    host: process.env.ALETA_BOT_DB_ANTRIAN_HOST || process.env.ALETA_BOT_DB_HOST || "localhost",
    port: Number(process.env.ALETA_BOT_DB_ANTRIAN_PORT || process.env.ALETA_BOT_DB_PORT || 3306),
    databaseName: process.env.ALETA_BOT_DB_ANTRIAN_NAME || process.env.ALETA_BOT_DB4_NAME || "sipp_turunan_antrian",
    username: process.env.ALETA_BOT_DB_ANTRIAN_USER || process.env.ALETA_BOT_DB_USER || "root",
    passwordEnvKey: "ALETA_BOT_DB_ANTRIAN_PASSWORD",
    fallbackPasswordEnvKey: "ALETA_BOT_DB_PASSWORD",
    sslEnabled: false,
    connectionTimeoutMs: 5000,
    isActive: true,
    isDefault: false,
    legacySource: "db_config4.js",
  },
  aps_badilag: {
    key: "aps_badilag",
    name: "APS Badilag",
    description: "Fallback legacy dari db_config5.js untuk data APS Badilag.",
    driver: "mysql",
    host: process.env.ALETA_BOT_DB_APS_HOST || process.env.ALETA_BOT_DB_HOST || "localhost",
    port: Number(process.env.ALETA_BOT_DB_APS_PORT || process.env.ALETA_BOT_DB_PORT || 3306),
    databaseName: process.env.ALETA_BOT_DB_APS_NAME || process.env.ALETA_BOT_DB5_NAME || "aps_badilag",
    username: process.env.ALETA_BOT_DB_APS_USER || process.env.ALETA_BOT_DB_USER || "root",
    passwordEnvKey: "ALETA_BOT_DB_APS_PASSWORD",
    fallbackPasswordEnvKey: "ALETA_BOT_DB_PASSWORD",
    sslEnabled: false,
    connectionTimeoutMs: 5000,
    isActive: true,
    isDefault: false,
    legacySource: "db_config5.js",
  },
};

const legacySourceMap = {
  "db_config.js": "sipp_primary",
  "db_config4.js": "antrian_sidang",
  "db_config5.js": "aps_badilag",
};

const pools = new Map();

function sanitizeError(error) {
  const rawMessage = error && error.message ? error.message : String(error || "unknown error");
  return rawMessage
    .replace(/password=[^&\s]+/gi, "password=[redacted]")
    .replace(/:[^:@\s]+@/g, ":[redacted]@")
    .slice(0, 500);
}

function getDbSecretEncryptionKey() {
  const raw = process.env.ALETA_BOT_DB_SECRET_ENCRYPTION_KEY || "";
  if (!raw) return null;
  return crypto.createHash("sha256").update(raw).digest();
}

function decryptDbSecret(secretValue = "") {
  const value = String(secretValue || "");
  if (!value) return "";
  if (value.startsWith("plain:v1:")) {
    return Buffer.from(value.slice("plain:v1:".length), "base64").toString("utf8");
  }
  if (!value.startsWith("enc:v1:")) return "";

  const key = getDbSecretEncryptionKey();
  if (!key) {
    throw new Error("Password manual koneksi database terenkripsi, tetapi ALETA_BOT_DB_SECRET_ENCRYPTION_KEY belum diset di runtime.");
  }
  const [, , ivRaw, tagRaw, encryptedRaw] = value.split(":");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivRaw, "base64"));
  decipher.setAuthTag(Buffer.from(tagRaw, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

function normalizeRegistryConnection(input = {}) {
  return {
    key: String(input.key || "").trim(),
    name: String(input.name || input.key || "").trim(),
    description: String(input.description || "").trim(),
    driver: String(input.driver || "mysql").toLowerCase(),
    host: String(input.host || "").trim(),
    port: Number(input.port || 3306),
    databaseName: String(input.databaseName || input.database_name || "").trim(),
    username: String(input.username || "").trim(),
    passwordEnvKey: String(input.passwordEnvKey || input.password_env_key || "").trim(),
    passwordSecret: String(input.passwordSecret || input.password_secret || "").trim(),
    passwordSource: String(input.passwordSource || input.password_source || "").trim(),
    fallbackPasswordEnvKey: String(input.fallbackPasswordEnvKey || input.fallback_password_env_key || "").trim(),
    sslEnabled: Boolean(input.sslEnabled ?? input.ssl_enabled),
    connectionTimeoutMs: Math.max(1000, Number(input.connectionTimeoutMs || input.connection_timeout_ms || 5000)),
    isActive: input.isActive ?? input.is_active ?? true,
    isDefault: Boolean(input.isDefault ?? input.is_default),
    legacySource: String(input.legacySource || input.legacy_source || "").trim(),
    lastTestStatus: String(input.lastTestStatus || input.last_test_status || "idle"),
    lastTestError: String(input.lastTestError || input.last_test_error || ""),
    lastTestAt: input.lastTestAt || input.last_test_at || null,
  };
}

function getPassword(config) {
  if (config.passwordSecret) {
    return decryptDbSecret(config.passwordSecret);
  }
  if (config.passwordEnvKey && process.env[config.passwordEnvKey]) {
    return process.env[config.passwordEnvKey];
  }
  if (config.fallbackPasswordEnvKey && process.env[config.fallbackPasswordEnvKey]) {
    return process.env[config.fallbackPasswordEnvKey];
  }
  return "";
}

function maskValue(value = "") {
  const text = String(value || "");
  if (!text) return "";
  if (text.length <= 3) return "***";
  return `${text.slice(0, 2)}***${text.slice(-1)}`;
}

function maskConnectionConfig(config) {
  return {
    ...config,
    hostMasked: config.host,
    usernameMasked: maskValue(config.username),
    passwordConfigured: Boolean(config.passwordSecret || (config.passwordEnvKey && process.env[config.passwordEnvKey])),
    passwordSource: config.passwordSecret ? "manual" : config.passwordEnvKey ? "env" : "none",
    password: undefined,
    passwordSecret: undefined,
  };
}

function getRegistryConnections() {
  const runtimeConfig = readRuntimeConfig();
  const registry = Array.isArray(runtimeConfig.dbConnections) ? runtimeConfig.dbConnections : [];
  return registry.map(normalizeRegistryConnection).filter((item) => item.key);
}

function listConnections() {
  const registry = getRegistryConnections();
  const byKey = new Map(Object.entries(legacyConnections).map(([key, value]) => [key, { ...value, source: "legacy" }]));

  for (const connection of registry) {
    byKey.set(connection.key, { ...connection, source: "registry" });
  }

  return [...byKey.values()].map(maskConnectionConfig);
}

function resolveLegacyConnectionKey(fileName) {
  return legacySourceMap[fileName] || "";
}

function getConnectionConfig(connectionKey = "sipp_primary") {
  const registry = getRegistryConnections();
  const fromRegistry = registry.find((item) => item.key === connectionKey);
  if (fromRegistry) {
    if (!fromRegistry.isActive) {
      throw new Error(`Koneksi database ${connectionKey} tidak aktif.`);
    }
    return { ...fromRegistry, source: "registry" };
  }

  const legacy = legacyConnections[connectionKey] || legacyConnections[resolveLegacyConnectionKey(connectionKey)] || legacyConnections.sipp_primary;
  void logService.logSystemEvent({
    eventType: "external_db_legacy_fallback",
    severity: "warning",
    message: "ALETA Bot memakai fallback koneksi database legacy.",
    metadata: { connectionKey, legacySource: legacy.legacySource },
  });
  return { ...legacy, source: "legacy" };
}

function createConnectionPool(connectionKey = "sipp_primary") {
  const config = getConnectionConfig(connectionKey);
  const poolKey = `${config.source}:${config.key}:${config.host}:${config.port}:${config.databaseName}:${config.username}`;
  if (pools.has(poolKey)) return pools.get(poolKey);

  if (config.driver !== "mysql") {
    throw new Error(`Driver database belum didukung: ${config.driver}`);
  }

  const pool = mysql.createPool({
    host: config.host,
    port: config.port,
    user: config.username,
    password: getPassword(config),
    database: config.databaseName,
    ssl: config.sslEnabled ? {} : undefined,
    connectTimeout: config.connectionTimeoutMs,
    multipleStatements: false,
  });
  pools.set(poolKey, pool);
  return pool;
}

function query(connectionKey, sql, params = []) {
  return new Promise((resolve, reject) => {
    const pool = createConnectionPool(connectionKey);
    pool.query(sql, params, (error, result) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(result);
    });
  });
}

function queryWithConfig(config, sql, params = []) {
  return new Promise((resolve, reject) => {
    const normalized = normalizeRegistryConnection(config);
    const pool = mysql.createPool({
      host: normalized.host,
      port: normalized.port,
      user: normalized.username,
      password: getPassword(normalized),
      database: normalized.databaseName,
      ssl: normalized.sslEnabled ? {} : undefined,
      connectTimeout: normalized.connectionTimeoutMs,
      multipleStatements: false,
    });
    pool.query(sql, params, (error, result) => {
      pool.end(() => null);
      if (error) {
        reject(error);
        return;
      }
      resolve(result);
    });
  });
}

async function testConnection(connectionKey = "sipp_primary") {
  const startedAt = Date.now();
  const config = getConnectionConfig(connectionKey);
  try {
    await query(config.key, "SELECT 1 AS ok", []);
    return {
      key: config.key,
      status: "success",
      error: "",
      durationMs: Date.now() - startedAt,
      testedAt: new Date().toISOString(),
      source: config.source,
    };
  } catch (error) {
    return {
      key: config.key,
      status: "failed",
      error: sanitizeError(error),
      durationMs: Date.now() - startedAt,
      testedAt: new Date().toISOString(),
      source: config.source,
    };
  }
}

async function testConnectionConfig(configInput = {}) {
  const startedAt = Date.now();
  const config = normalizeRegistryConnection(configInput);
  try {
    await queryWithConfig(config, "SELECT 1 AS ok", []);
    return {
      key: config.key,
      status: "success",
      error: "",
      durationMs: Date.now() - startedAt,
      testedAt: new Date().toISOString(),
      source: "draft",
    };
  } catch (error) {
    return {
      key: config.key,
      status: "failed",
      error: sanitizeError(error),
      durationMs: Date.now() - startedAt,
      testedAt: new Date().toISOString(),
      source: "draft",
    };
  }
}

module.exports = {
  legacyConnections,
  listConnections,
  getConnectionConfig,
  createConnectionPool,
  testConnection,
  testConnectionConfig,
  maskConnectionConfig,
  resolveLegacyConnectionKey,
  query,
  sanitizeError,
};
