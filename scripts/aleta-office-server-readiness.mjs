import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const SCRIPT_DIR = path.dirname(__filename);
const ROOT_DIR = path.resolve(SCRIPT_DIR, "..");
const PORTAL_DIR = path.join(ROOT_DIR, "manajemen_surat");
const BOT_DIR = path.join(ROOT_DIR, "aleta_bot");
const REPORT_DIR = path.join(ROOT_DIR, "reports");
const RUNTIME_CONFIG = path.join(BOT_DIR, "config", "aleta-runtime.json");
const REPORT_JSON = path.join(REPORT_DIR, "aleta-office-server-readiness-latest.json");
const REPORT_MD = path.join(REPORT_DIR, "aleta-office-server-readiness-latest.md");
const PORTAL_URL = process.env.ALETA_PORTAL_BASE_URL || "http://127.0.0.1:3000";
const BOT_URL = process.env.ALETA_BOT_BASE_URL || "http://127.0.0.1:3003";

const result = {
  generatedAt: new Date().toISOString(),
  overall: "WARN",
  environment: {
    host: os.hostname(),
    platform: `${os.platform()} ${os.release()}`,
    arch: os.arch(),
    isOfficeServerVerified: false,
    note: "Jalankan script ini langsung di server kantor untuk verifikasi deployment aktual.",
  },
  checks: [],
  blockers: [],
  warnings: [],
  actionsTaken: [],
  summary: {},
};

function loadEnvFiles(files) {
  const values = { ...process.env };
  const presence = {};
  for (const file of files) {
    presence[path.basename(file)] = existsSync(file);
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const match = trimmed.match(/^([^=]+)=(.*)$/);
      if (!match) continue;
      let value = match[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      values[match[1].trim()] = value;
    }
  }
  return { values, presence };
}

const portalEnv = loadEnvFiles([path.join(PORTAL_DIR, ".env"), path.join(PORTAL_DIR, ".env.local")]);
const botEnv = loadEnvFiles([path.join(BOT_DIR, ".env")]);

function sanitize(value) {
  return String(value ?? "")
    .replace(/[A-Za-z]:\\[^\s"'<>]+/g, "[path]")
    .replace(/\.wwebjs_auth[^\s"'<>]*/gi, "[session-path]")
    .replace(/(token|password|api[_-]?key)=([^&\s]+)/gi, "$1=[redacted]")
    .slice(0, 500);
}

function addCheck(key, label, status, detail, metadata = {}) {
  const safeMetadata = JSON.parse(JSON.stringify(metadata, (_, value) => {
    if (typeof value === "string") return sanitize(value);
    return value;
  }));
  const item = { key, label, status, detail: sanitize(detail), metadata: safeMetadata };
  result.checks.push(item);
  if (status === "FAIL") result.blockers.push({ key, label, detail: item.detail });
  if (status === "WARN") result.warnings.push({ key, label, detail: item.detail });
  return item;
}

function commandVersion(command, args) {
  const executable = process.platform === "win32" && command === "npm" ? "npm.cmd" : command;
  let output = spawnSync(executable, args, { encoding: "utf8", shell: false });
  if (output.error && process.platform === "win32") {
    output = spawnSync(command, args, { encoding: "utf8", shell: true });
  }
  if (output.error) return { ok: false, detail: sanitize(output.error.message) };
  return {
    ok: output.status === 0,
    detail: sanitize((output.stdout || output.stderr || "").trim()),
  };
}

function ps(script) {
  const output = spawnSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script], {
    encoding: "utf8",
    shell: false,
  });
  return {
    ok: output.status === 0,
    stdout: sanitize(output.stdout.trim()),
    stderr: sanitize(output.stderr.trim()),
  };
}

async function fetchJson(url, headers = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetch(url, { headers, signal: controller.signal });
    const text = await response.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { text: text.slice(0, 120) };
    }
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    return { ok: false, status: 0, error: sanitize(error.message) };
  } finally {
    clearTimeout(timer);
  }
}

function internalToken() {
  return (
    portalEnv.values.ALETA_BOT_INTERNAL_API_TOKEN ||
    portalEnv.values.ALETA_BOT_INTERNAL_TOKEN ||
    botEnv.values.ALETA_BOT_INTERNAL_API_TOKEN ||
    botEnv.values.ALETA_BOT_INTERNAL_TOKEN ||
    ""
  );
}

function internalHeaders() {
  const token = internalToken();
  return token
    ? {
        "x-aleta-internal-token": token,
        "x-aleta-bot-token": token,
      }
    : {};
}

function checkPortListener(port) {
  const query = ps(`$c = Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue; if ($c) { $c | Select-Object -First 5 -ExpandProperty OwningProcess }`);
  const pids = query.stdout
    .split(/\r?\n/)
    .map((line) => Number(line.trim()))
    .filter(Boolean);
  return { listening: pids.length > 0, pids: Array.from(new Set(pids)) };
}

async function canConnect(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: "127.0.0.1", port, timeout: 1500 }, () => {
      socket.destroy();
      resolve(true);
    });
    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.on("error", () => resolve(false));
  });
}

async function checkDb() {
  const databaseUrl = portalEnv.values.DATABASE_URL;
  if (!databaseUrl) {
    addCheck("database_config", "Database config", "WARN", "DATABASE_URL tidak ditemukan. Siapkan .env production di server kantor.");
    return;
  }
  try {
    const portalRequire = createRequire(path.join(PORTAL_DIR, "package.json"));
    const { Pool } = portalRequire("pg");
    const pool = new Pool({ connectionString: databaseUrl });
    await pool.query("SELECT 1");
    await pool.end();
    addCheck("database_reachable", "Database reachable", "PASS", "Database portal reachable via DATABASE_URL configured.");
  } catch (error) {
    addCheck("database_reachable", "Database reachable", "FAIL", `Database tidak reachable: ${sanitize(error.message)}`);
  }
}

function writeReports() {
  result.overall = result.blockers.length > 0 ? "FAIL" : result.warnings.length > 0 ? "WARN" : "PASS";
  writeFileSync(REPORT_JSON, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  const md = [
    "# ALETA Office Server Readiness",
    "",
    `Generated: ${result.generatedAt}`,
    "",
    `Overall: **${result.overall}**`,
    "",
    "## Environment",
    `- Host: ${result.environment.host}`,
    `- Platform: ${result.environment.platform}`,
    `- Catatan: ${result.environment.note}`,
    "",
    "## Checks",
    ...result.checks.map((item) => `- ${item.status} - ${item.label}: ${item.detail}`),
    "",
    "## Blockers",
    ...(result.blockers.length ? result.blockers.map((item) => `- ${item.label}: ${item.detail}`) : ["- Tidak ada blocker."]),
    "",
    "## Warnings",
    ...(result.warnings.length ? result.warnings.map((item) => `- ${item.label}: ${item.detail}`) : ["- Tidak ada warning."]),
    "",
    "## Deployment Notes",
    "- Jalankan ulang script ini di mesin server kantor sebelum cutover.",
    "- Jangan menyalin atau mencetak secret dari .env ke laporan.",
    "- WhatsApp production automation tetap memakai gate terpisah.",
  ].join("\n");
  writeFileSync(REPORT_MD, `${md}\n`, "utf8");
}

async function main() {
  mkdirSync(REPORT_DIR, { recursive: true });
  mkdirSync(path.join(ROOT_DIR, "runtime-logs"), { recursive: true });

  const nodeVersion = commandVersion("node", ["--version"]);
  addCheck("node", "Node.js", nodeVersion.ok ? "PASS" : "FAIL", nodeVersion.ok ? `Node tersedia ${nodeVersion.detail}.` : `Node tidak tersedia: ${nodeVersion.detail}`);

  const npmVersion = commandVersion("npm", ["--version"]);
  addCheck("npm", "npm", npmVersion.ok ? "PASS" : "FAIL", npmVersion.ok ? `npm tersedia ${npmVersion.detail}.` : `npm tidak tersedia: ${npmVersion.detail}`);

  addCheck("portal_env", "Portal env files", portalEnv.presence[".env"] || portalEnv.presence[".env.local"] ? "PASS" : "WARN", `Portal env configured=${Boolean(portalEnv.presence[".env"] || portalEnv.presence[".env.local"])}.`);
  addCheck("bot_env", "ALETA Bot env file", botEnv.presence[".env"] ? "PASS" : "WARN", `Bot env configured=${Boolean(botEnv.presence[".env"])}.`);
  addCheck("internal_token", "Internal token configured", internalToken() ? "PASS" : "WARN", `Internal token configured=${Boolean(internalToken())}.`);
  addCheck("runtime_config", "Runtime config", existsSync(RUNTIME_CONFIG) ? "PASS" : "FAIL", "aleta-runtime.json harus tersedia.");
  addCheck("whatsapp_auth_folder", "WhatsApp auth folder", existsSync(path.join(BOT_DIR, ".wwebjs_auth")) ? "PASS" : "WARN", "Folder auth WhatsApp dicek tanpa membaca isi session.");
  addCheck("reports_logs", "Reports/logs folders", existsSync(REPORT_DIR) && existsSync(path.join(ROOT_DIR, "runtime-logs")) ? "PASS" : "WARN", "Folder reports dan runtime-logs tersedia.");

  const portalPort = checkPortListener(3000);
  const botPort = checkPortListener(3003);
  addCheck("port_3000", "Port 3000", portalPort.listening ? "PASS" : "WARN", portalPort.listening ? "Port 3000 sedang listen." : "Port 3000 belum listen; jalankan portal saat deployment.");
  addCheck("port_3003", "Port 3003", botPort.listening ? "PASS" : "WARN", botPort.listening ? "Port 3003 sedang listen." : "Port 3003 belum listen; jalankan aleta_bot saat deployment.");

  const portalReachable = await fetchJson(PORTAL_URL);
  addCheck("portal_reachable", "Portal reachable", portalReachable.ok ? "PASS" : "WARN", portalReachable.ok ? `Portal HTTP ${portalReachable.status}.` : `Portal belum reachable: ${portalReachable.error || portalReachable.status}.`);

  const botReachable = await fetchJson(`${BOT_URL}/internal/aleta-bot/status`, internalHeaders());
  addCheck("bot_reachable", "ALETA Bot reachable", botReachable.ok ? "PASS" : "WARN", botReachable.ok ? `ALETA Bot status HTTP ${botReachable.status}.` : `ALETA Bot belum reachable: ${botReachable.error || botReachable.status}.`);

  const diagnostics = await fetchJson(`${BOT_URL}/internal/aleta-bot/whatsapp/diagnostics`, internalHeaders());
  const diagData = diagnostics.data || {};
  addCheck(
    "whatsapp_diagnostics",
    "WhatsApp diagnostics",
    diagnostics.ok && diagData.lastErrorType !== "browser_locked" && diagData.lastErrorType !== "initialize_timeout" ? "PASS" : "WARN",
    diagnostics.ok
      ? `status=${diagData.status || "unknown"}, initializing=${Boolean(diagData.initializing)}, hasClient=${Boolean(diagData.hasClient)}, lastErrorType=${diagData.lastErrorType || "none"}.`
      : `Diagnostics belum reachable: ${diagnostics.error || diagnostics.status}.`
  );

  const processQuery = ps(`Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*aleta_bot*app.js*' } | Measure-Object | Select-Object -ExpandProperty Count`);
  const botProcessCount = Number(processQuery.stdout.trim() || 0);
  addCheck("single_bot_instance", "Single ALETA Bot instance", botProcessCount <= 1 ? "PASS" : "FAIL", `aleta_bot app.js process count=${botProcessCount}.`);

  const disk = ps(`$d = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='D:'"; if ($d) { [math]::Round($d.FreeSpace / 1GB, 2) }`);
  const freeGb = Number(disk.stdout);
  addCheck("disk_space", "Disk space", Number.isFinite(freeGb) && freeGb >= 5 ? "PASS" : "WARN", Number.isFinite(freeGb) ? `Drive D free space ${freeGb} GB.` : "Tidak bisa membaca free space drive D.");

  await checkDb();

  result.summary = {
    portal: { reachable: portalReachable.ok, portListening: portalPort.listening },
    aletaBot: { reachable: botReachable.ok, portListening: botPort.listening, processCount: botProcessCount },
    whatsapp: { status: diagData.status || "unknown", lastErrorType: diagData.lastErrorType || "" },
    env: {
      portalEnvConfigured: Boolean(portalEnv.presence[".env"] || portalEnv.presence[".env.local"]),
      botEnvConfigured: Boolean(botEnv.presence[".env"]),
      internalTokenConfigured: Boolean(internalToken()),
      databaseUrlConfigured: Boolean(portalEnv.values.DATABASE_URL),
    },
    ports: {
      portal3000Connectable: await canConnect(3000),
      bot3003Connectable: await canConnect(3003),
    },
  };
  result.actionsTaken.push({
    action: "readiness_check_only",
    detail: "Tidak ada restart, WhatsApp connect, QR scan, logout, reset session, send, resend, atau production activation.",
  });
  writeReports();
  console.log(`Office server readiness: ${result.overall}. Report: ${REPORT_JSON}`);
  if (result.overall === "FAIL") process.exitCode = 1;
}

main();
