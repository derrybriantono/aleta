import crypto from "node:crypto";
import path from "node:path";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";

export type InstallSectionStatus = {
  key: string;
  label: string;
  configured: boolean;
  required: boolean;
  message: string;
};

export type InstallStatus = {
  installed: boolean;
  setupRequired: boolean;
  envFileExists: boolean;
  installStateExists: boolean;
  installStatePath: string;
  envFilePath: string;
  completedAt: string | null;
  restartRequired: boolean;
  sections: InstallSectionStatus[];
  missingRequiredKeys: string[];
};

export type InstallPayload = {
  postgres?: {
    host?: string;
    port?: string | number;
    database?: string;
    user?: string;
    password?: string;
  };
  auth?: {
    appUrl?: string;
    secret?: string;
  };
  bot?: {
    baseUrl?: string;
    internalToken?: string;
    runtimeMode?: string;
    timeoutMs?: string | number;
  };
  sipp?: {
    host?: string;
    port?: string | number;
    database?: string;
    user?: string;
    password?: string;
  };
  antrian?: {
    host?: string;
    port?: string | number;
    database?: string;
    user?: string;
    password?: string;
  };
  aps?: {
    host?: string;
    port?: string | number;
    database?: string;
    user?: string;
    password?: string;
  };
  extraDatabases?: Array<{
    key?: string;
    name?: string;
    description?: string;
    host?: string;
    port?: string | number;
    database?: string;
    user?: string;
    password?: string;
    sslEnabled?: boolean;
    timeoutMs?: string | number;
  }>;
  ai?: {
    provider?: string;
    model?: string;
    openAiApiKey?: string;
    publicQaAiEnabled?: boolean;
  };
  institution?: {
    courtName?: string;
    courtShortName?: string;
    website?: string;
    email?: string;
    csWhatsappNumber?: string;
    botWhatsappNumber?: string;
  };
  overwriteEnvFile?: boolean;
};

type InstallStateFile = {
  version: 1;
  completedAt: string;
  envFilePath: string;
  restartRequired: boolean;
  maskedSummary: Record<string, unknown>;
};

const INSTALL_STATE_PATH = path.join(process.cwd(), "data", "install-state.json");
const ENV_FILE_PATH = path.join(process.cwd(), ".env.local");

function readEnv(name: string) {
  return String(process.env[name] ?? "").trim();
}

async function fileExists(filePath: string) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readInstallState() {
  try {
    const parsed = JSON.parse(await readFile(INSTALL_STATE_PATH, "utf8")) as InstallStateFile;
    return parsed?.version === 1 ? parsed : null;
  } catch {
    return null;
  }
}

function section(key: string, label: string, configured: boolean, required: boolean, message: string): InstallSectionStatus {
  return { key, label, configured, required, message };
}

export async function getInstallStatus(): Promise<InstallStatus> {
  const [installState, envFileExists] = await Promise.all([readInstallState(), fileExists(ENV_FILE_PATH)]);
  const installStateExists = Boolean(installState);

  const sections = [
    section(
      "database",
      "Database ALETA",
      Boolean(readEnv("DATABASE_URL")),
      true,
      readEnv("DATABASE_URL") ? "DATABASE_URL sudah terdeteksi." : "Database utama belum diisi."
    ),
    section(
      "auth",
      "Keamanan Login",
      Boolean(readEnv("BETTER_AUTH_SECRET") && readEnv("BETTER_AUTH_URL")),
      true,
      readEnv("BETTER_AUTH_SECRET") && readEnv("BETTER_AUTH_URL")
        ? "Secret dan URL login sudah terdeteksi."
        : "Secret login dan URL aplikasi belum lengkap."
    ),
    section(
      "bot",
      "ALETA Bot",
      Boolean(readEnv("ALETA_BOT_BASE_URL") || readEnv("ALETA_BOT_RUNTIME_URL")),
      false,
      readEnv("ALETA_BOT_BASE_URL") || readEnv("ALETA_BOT_RUNTIME_URL")
        ? "Alamat runtime bot sudah terdeteksi."
        : "Runtime bot belum diisi, dapat dilengkapi nanti."
    ),
    section(
      "sipp",
      "Database SIPP",
      Boolean(readEnv("ALETA_BOT_DB_SIPP_HOST") && readEnv("ALETA_BOT_DB_SIPP_NAME")),
      false,
      readEnv("ALETA_BOT_DB_SIPP_HOST") && readEnv("ALETA_BOT_DB_SIPP_NAME")
        ? "Koneksi SIPP sudah terdeteksi."
        : "Koneksi SIPP belum diisi, fitur sumber data SIPP belum aktif penuh."
    ),
    section(
      "extra_sql",
      "SQL Tambahan",
      Boolean(readEnv("ALETA_BOT_EXTRA_DB_CONNECTIONS_JSON")),
      false,
      readEnv("ALETA_BOT_EXTRA_DB_CONNECTIONS_JSON")
        ? "Koneksi SQL tambahan sudah terdaftar dari environment."
        : "Belum ada SQL tambahan. Dapat ditambah jika ada database lain."
    ),
  ];

  const missingRequiredKeys = sections.filter((item) => item.required && !item.configured).map((item) => item.key);
  const installed = installStateExists || envFileExists || missingRequiredKeys.length === 0;
  const setupRequired = !installed;

  return {
    installed,
    setupRequired,
    envFileExists,
    installStateExists,
    installStatePath: INSTALL_STATE_PATH,
    envFilePath: ENV_FILE_PATH,
    completedAt: installState?.completedAt ?? null,
    restartRequired: Boolean(installState?.restartRequired),
    sections,
    missingRequiredKeys,
  };
}

function cleanValue(value: unknown) {
  return String(value ?? "").replace(/[\r\n]/g, " ").trim();
}

function cleanPort(value: unknown, fallback: string) {
  const text = cleanValue(value);
  if (!text) return fallback;
  const port = Number(text);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Port tidak valid: ${text}`);
  }
  return String(port);
}

function requireValue(value: unknown, label: string) {
  const text = cleanValue(value);
  if (!text) throw new Error(`${label} wajib diisi.`);
  return text;
}

function encodePart(value: string) {
  return encodeURIComponent(value);
}

function buildPostgresUrl(payload: InstallPayload) {
  const host = requireValue(payload.postgres?.host, "Host database ALETA");
  const port = cleanPort(payload.postgres?.port, "5432");
  const database = requireValue(payload.postgres?.database, "Nama database ALETA");
  const user = requireValue(payload.postgres?.user, "User database ALETA");
  const password = cleanValue(payload.postgres?.password);
  return `postgres://${encodePart(user)}:${encodePart(password)}@${host}:${port}/${encodePart(database)}`;
}

function buildMysqlSection(prefix: string, values: InstallPayload["sipp"]): Array<[string, string]> {
  const host = cleanValue(values?.host);
  const database = cleanValue(values?.database);
  const user = cleanValue(values?.user);
  const port = cleanPort(values?.port, "3306");
  const password = cleanValue(values?.password);

  if (!host && !database && !user && !password) return [];

  return [
    [`${prefix}_HOST`, host || "localhost"],
    [`${prefix}_PORT`, port],
    [`${prefix}_NAME`, database],
    [`${prefix}_USER`, user],
    [`${prefix}_PASSWORD`, password],
  ];
}

function normalizeConnectionKey(value: unknown) {
  const key = cleanValue(value).toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
  if (!/^[a-z][a-z0-9_]{2,63}$/.test(key)) {
    throw new Error("Key koneksi SQL tambahan harus memakai huruf kecil, angka, dan underscore, minimal 3 karakter.");
  }
  return key;
}

function passwordEnvKeyForConnection(key: string) {
  return `ALETA_BOT_EXTRA_DB_${key.toUpperCase().replace(/[^A-Z0-9_]+/g, "_")}_PASSWORD`;
}

function buildExtraDbConnections(extraDatabases: InstallPayload["extraDatabases"] = []) {
  const connections: Array<Record<string, unknown>> = [];
  const passwordEntries: Array<[string, string]> = [];
  const seenKeys = new Set(["sipp_primary", "antrian_sidang", "aps_badilag"]);

  for (const item of extraDatabases) {
    const hasAnyValue = Object.values(item || {}).some((value) => cleanValue(value).length > 0);
    if (!hasAnyValue) continue;

    const key = normalizeConnectionKey(item.key);
    if (seenKeys.has(key)) {
      throw new Error(`Key koneksi SQL tambahan sudah dipakai: ${key}`);
    }
    seenKeys.add(key);

    const passwordEnvKey = passwordEnvKeyForConnection(key);
    const host = requireValue(item.host, `Host SQL tambahan ${key}`);
    const databaseName = requireValue(item.database, `Nama database SQL tambahan ${key}`);
    const username = requireValue(item.user, `User SQL tambahan ${key}`);

    connections.push({
      key,
      name: cleanValue(item.name) || key,
      description: cleanValue(item.description) || "Koneksi SQL tambahan dari instalasi pertama ALETA.",
      driver: "mysql",
      host,
      port: Number(cleanPort(item.port, "3306")),
      databaseName,
      username,
      passwordEnvKey,
      sslEnabled: Boolean(item.sslEnabled),
      connectionTimeoutMs: Number(cleanPort(item.timeoutMs, "5000")),
      isActive: true,
      isDefault: false,
      legacySource: "first-install",
    });
    passwordEntries.push([passwordEnvKey, cleanValue(item.password)]);
  }

  return { connections, passwordEntries };
}

function toEnvLine(key: string, value: string) {
  if (/^[A-Za-z0-9_./:@-]*$/.test(value)) {
    return `${key}=${value}`;
  }
  return `${key}=${JSON.stringify(value)}`;
}

function maskSecret(value: string) {
  if (!value) return "";
  if (value.length <= 8) return "********";
  return `${value.slice(0, 4)}********${value.slice(-4)}`;
}

export function generateInstallEnv(payload: InstallPayload) {
  const databaseUrl = buildPostgresUrl(payload);
  const authSecret = requireValue(payload.auth?.secret, "Secret login");
  if (authSecret.length < 32) {
    throw new Error("Secret login minimal 32 karakter.");
  }

  const appUrl = requireValue(payload.auth?.appUrl, "URL aplikasi");
  const botBaseUrl = cleanValue(payload.bot?.baseUrl) || "http://127.0.0.1:3003";
  const botToken = cleanValue(payload.bot?.internalToken);
  const botRuntimeMode = cleanValue(payload.bot?.runtimeMode) || "aleta_bot";
  const botTimeout = cleanPort(payload.bot?.timeoutMs, "8000");
  const aiProvider = cleanValue(payload.ai?.provider) || "gemini";
  const aiModel = cleanValue(payload.ai?.model) || "gemini-1.5-flash";
  const publicQaAiEnabled = payload.ai?.publicQaAiEnabled ? "true" : "false";
  const extraDb = buildExtraDbConnections(payload.extraDatabases);

  const entries: Array<[string, string]> = [
    ["DATABASE_URL", databaseUrl],
    ["BETTER_AUTH_SECRET", authSecret],
    ["BETTER_AUTH_URL", appUrl],
    ["WHATSAPP_RUNTIME_MODE", botRuntimeMode],
    ["ALETA_BOT_BASE_URL", botBaseUrl],
    ["ALETA_BOT_RUNTIME_URL", botBaseUrl],
    ["ALETA_BOT_INTERNAL_API_TOKEN", botToken],
    ["ALETA_BOT_INTERNAL_TOKEN", botToken],
    ["ALETA_BOT_GATEWAY_TIMEOUT_MS", botTimeout],
    ["ALETA_BOT_AI_CONFIG_SOURCE", "portal"],
    ["ALETA_BOT_AI_TIMEOUT_MS", "8000"],
    ["ALETA_BOT_AI_DEFAULT_PROVIDER", aiProvider],
    ["ALETA_BOT_AI_DEFAULT_MODEL", aiModel],
    ["ALETA_BOT_PUBLIC_QA_AI_ENABLED", publicQaAiEnabled],
    ["ALETA_BOT_PUBLIC_QA_AI_ANSWER_ENABLED", publicQaAiEnabled],
    ["ALETA_BOT_PUBLIC_QA_AI_ANSWER_MODE", "template_only"],
    ["ALETA_BOT_PUBLIC_QA_AI_TIMEOUT_MS", "8000"],
    ["ALETA_BOT_PUBLIC_QA_MAX_TOKENS", "400"],
    ["ALETA_BOT_PUBLIC_QA_TEMPERATURE", "0.2"],
    ["OPENAI_API_KEY", cleanValue(payload.ai?.openAiApiKey)],
    ...buildMysqlSection("ALETA_BOT_DB_SIPP", payload.sipp),
    ...buildMysqlSection("ALETA_BOT_DB_ANTRIAN", payload.antrian),
    ...buildMysqlSection("ALETA_BOT_DB_APS", payload.aps),
    ...extraDb.passwordEntries,
    ["ALETA_BOT_EXTRA_DB_CONNECTIONS_JSON", extraDb.connections.length > 0 ? JSON.stringify(extraDb.connections) : ""],
  ];

  const envText = [
    "# Generated by ALETA first install setup.",
    "# Restart service/container after saving this file.",
    ...entries.map(([key, value]) => toEnvLine(key, value)),
    "",
  ].join("\n");

  return {
    envText,
    summary: {
      databaseUrl: databaseUrl.replace(/:\/\/([^:]+):([^@]+)@/, (_match, user) => `://${user}:********@`),
      appUrl,
      botBaseUrl,
      botToken: maskSecret(botToken),
      sipp: {
        host: cleanValue(payload.sipp?.host),
        database: cleanValue(payload.sipp?.database),
        user: cleanValue(payload.sipp?.user),
      },
      institution: {
        courtName: cleanValue(payload.institution?.courtName),
        courtShortName: cleanValue(payload.institution?.courtShortName),
        website: cleanValue(payload.institution?.website),
        email: cleanValue(payload.institution?.email),
        csWhatsappNumber: cleanValue(payload.institution?.csWhatsappNumber),
        botWhatsappNumber: cleanValue(payload.institution?.botWhatsappNumber),
      },
      extraDatabases: extraDb.connections.map((connection) => ({
        key: connection.key,
        name: connection.name,
        host: connection.host,
        databaseName: connection.databaseName,
        username: connection.username,
        passwordEnvKey: connection.passwordEnvKey,
      })),
    },
  };
}

export async function saveInstallConfig(payload: InstallPayload) {
  const status = await getInstallStatus();
  if (status.envFileExists && !payload.overwriteEnvFile) {
    throw new Error(".env.local sudah ada. Aktifkan opsi timpa hanya jika benar-benar ingin mengganti config lokal.");
  }

  const generated = generateInstallEnv(payload);
  await mkdir(path.dirname(INSTALL_STATE_PATH), { recursive: true });
  await writeFile(ENV_FILE_PATH, generated.envText, { encoding: "utf8", mode: 0o600 });
  const state: InstallStateFile = {
    version: 1,
    completedAt: new Date().toISOString(),
    envFilePath: ENV_FILE_PATH,
    restartRequired: true,
    maskedSummary: generated.summary,
  };
  await writeFile(INSTALL_STATE_PATH, JSON.stringify(state, null, 2), { encoding: "utf8", mode: 0o600 });
  return {
    ok: true,
    installId: crypto.randomUUID(),
    envFilePath: ENV_FILE_PATH,
    installStatePath: INSTALL_STATE_PATH,
    restartRequired: true,
    summary: generated.summary,
  };
}
