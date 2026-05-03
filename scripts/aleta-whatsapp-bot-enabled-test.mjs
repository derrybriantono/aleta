import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const SCRIPT_DIR = path.dirname(__filename);
const ROOT_DIR = path.resolve(SCRIPT_DIR, "..");
const PORTAL_DIR = path.join(ROOT_DIR, "manajemen_surat");
const BOT_DIR = path.join(ROOT_DIR, "aleta_bot");
const REPORT_DIR = path.join(ROOT_DIR, "reports");
const REPORT_JSON = path.join(REPORT_DIR, "aleta-whatsapp-bot-enabled-test-latest.json");
const REPORT_MD = path.join(REPORT_DIR, "aleta-whatsapp-bot-enabled-test-latest.md");
const AUDIT_JSONL = path.join(REPORT_DIR, "aleta-whatsapp-bot-enabled-test-audit.jsonl");
const PREFLIGHT_JSON = path.join(REPORT_DIR, "aleta-preflight-latest.json");
const SMOKE_JSON = path.join(REPORT_DIR, "aleta-smoke-dry-run-latest.json");

const RUNTIME_CONFIG_PATHS = [
  path.join(BOT_DIR, "config", "aleta-runtime.json"),
  path.join(PORTAL_DIR, "data", "aleta-bot-runtime.json"),
];
const PORTAL_BASE_URL = "http://127.0.0.1:3000";
const BOT_BASE_URL = "http://127.0.0.1:3003";
const RECIPIENT_NAME = "DERRY BRIANTONO";
const RECIPIENT_ROLE = "Hakim";
const RECIPIENT_PHONE = process.env.ALETA_TEST_RECIPIENT_PHONE || "";
const MASKED_PHONE = process.env.ALETA_TEST_RECIPIENT_MASKED || "628****0000";
const IDEMPOTENCY_KEY = "limited-wa-test-derry-briantono-2026-05-02-001";
const MESSAGE =
  "UJI COBA ALETA - pesan test internal untuk DERRY BRIANTONO (Hakim). Abaikan pesan ini.";
const ENABLE_REASON =
  "Enable bot for limited internal WhatsApp test to DERRY BRIANTONO only. Scheduler/reminder production remains disabled.";
const DISABLE_REASON = "Disabled after one-message internal test.";

const portalEnv = loadEnvFiles([path.join(PORTAL_DIR, ".env"), path.join(PORTAL_DIR, ".env.local")]);
const botEnv = loadEnvFiles([path.join(BOT_DIR, ".env")]);

const result = {
  generatedAt: new Date().toISOString(),
  overall: "WARN",
  botEnabledBefore: null,
  botEnabledAfterEnable: null,
  botEnabledFinal: null,
  messageSent: false,
  messageEnqueued: false,
  sentCount: 0,
  enqueuedCount: 0,
  recipient: {
    name: RECIPIENT_NAME,
    role: RECIPIENT_ROLE,
    maskedPhone: MASKED_PHONE,
  },
  idempotencyKey: IDEMPOTENCY_KEY,
  gateBeforeEnable: [],
  gateBeforeSend: [],
  queueAfterSend: {},
  deliveryHistory: {},
  deadLetterActiveAfterSend: 0,
  approvalPendingAfterSend: 0,
  schedulerProductionActive: false,
  reminderProductionActive: false,
  warnings: [],
  blockers: [],
  actionsTaken: [],
  validation: [],
  summary: {},
};

function loadEnvFiles(files) {
  const values = { ...process.env };
  for (const file of files) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const match = trimmed.match(/^([^=]+)=(.*)$/);
      if (!match) continue;
      const key = match[1].trim();
      let value = match[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      values[key] = value;
    }
  }
  return values;
}

function internalToken() {
  return (
    portalEnv.ALETA_BOT_INTERNAL_API_TOKEN ||
    portalEnv.ALETA_BOT_INTERNAL_TOKEN ||
    botEnv.ALETA_BOT_INTERNAL_API_TOKEN ||
    botEnv.ALETA_BOT_INTERNAL_TOKEN ||
    ""
  );
}

function internalHeaders(extra = {}) {
  const token = internalToken();
  return {
    ...(token ? { "x-aleta-internal-token": token, "x-aleta-bot-token": token } : {}),
    ...extra,
  };
}

function addGate(bucket, key, label, status, detail, metadata = {}) {
  const entry = { key, label, status, detail, metadata };
  result[bucket].push(entry);
  if (status === "FAIL") result.blockers.push({ key, label, detail });
  if (status === "WARN") result.warnings.push({ key, label, detail });
  return entry;
}

function addAction(action, detail, metadata = {}) {
  const entry = { action, detail, metadata };
  result.actionsTaken.push(entry);
  return entry;
}

function normalizeStatus(value) {
  return String(value ?? "unknown").toLowerCase();
}

function normalizePhone(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("62")) return digits;
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  if (digits.startsWith("8")) return `62${digits}`;
  return digits;
}

function isValidPhone(value) {
  return /^62\d{8,15}$/.test(normalizePhone(value));
}

function sanitizeError(error) {
  return String(error?.message ?? error ?? "unknown_error")
    .replace(/[A-Za-z]:\\[^\s"'<>]+/g, "[path]")
    .replace(/(token|password|api[_-]?key)=([^&\s]+)/gi, "$1=[redacted]")
    .replaceAll(RECIPIENT_PHONE, MASKED_PHONE)
    .slice(0, 300);
}

function sanitizeValue(value) {
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !["qr", "lastQrString", "qrString", "rawQr", "stack", "sessionPath"].includes(key))
        .map(([key, child]) => [key, sanitizeValue(child)])
    );
  }
  if (typeof value === "string") {
    return value
      .replaceAll(RECIPIENT_PHONE, MASKED_PHONE)
      .replace(/\.wwebjs_auth[^\s"'<>]*/gi, "[session-path]")
      .replace(/session-[a-z0-9_-]+/gi, "[session-name]");
  }
  return value;
}

function containsSensitivePayload(value) {
  const text = JSON.stringify(value ?? {});
  return (
    text.includes(RECIPIENT_PHONE) ||
    /\.wwebjs_auth|lastQrString|rawQr|qrString|sessionPath|api[_-]?key|password|token|stack/i.test(text)
  );
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 10000);
  try {
    const response = await fetch(url, {
      method: options.method ?? "GET",
      headers: options.headers,
      body: options.body,
      signal: controller.signal,
    });
    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { text: text.slice(0, 300) };
    }
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    return { ok: false, status: 0, error: sanitizeError(error) };
  } finally {
    clearTimeout(timeout);
  }
}

function readJsonFile(file) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function readRuntimeConfigFiles() {
  return RUNTIME_CONFIG_PATHS.filter((file) => existsSync(file)).map((file) => ({
    file,
    raw: readFileSync(file, "utf8"),
    parsed: JSON.parse(readFileSync(file, "utf8")),
  }));
}

function writeRuntimeConfigFiles(configs, enabled, reason) {
  const changedAt = new Date().toISOString();
  for (const config of configs) {
    const next = {
      ...config.parsed,
      botEnabled: enabled,
      updatedAt: changedAt,
      pilotTestAudit: {
        changedBy: "aleta-whatsapp-bot-enabled-test.mjs",
        changedAt,
        oldValue: Boolean(config.parsed.botEnabled),
        newValue: enabled,
        reason,
      },
    };
    writeFileSync(config.file, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  }
  appendFileSync(
    AUDIT_JSONL,
    `${JSON.stringify({ changedAt, changedBy: "aleta-whatsapp-bot-enabled-test.mjs", newValue: enabled, reason })}\n`,
    "utf8"
  );
}

function restoreRuntimeConfigFiles(configs) {
  for (const config of configs) {
    writeFileSync(config.file, config.raw, "utf8");
  }
}

async function openPortalDb() {
  const databaseUrl = portalEnv.DATABASE_URL;
  if (!databaseUrl) return null;
  try {
    const portalRequire = createRequire(path.join(PORTAL_DIR, "package.json"));
    const { Pool } = portalRequire("pg");
    const pool = new Pool({ connectionString: databaseUrl });
    await pool.query("SELECT 1");
    return pool;
  } catch (error) {
    addGate("gateBeforeEnable", "portal_db", "Portal database", "FAIL", `Koneksi database portal gagal: ${sanitizeError(error)}.`);
    return null;
  }
}

async function query(pool, sql, params = []) {
  if (!pool) return { rows: [] };
  try {
    return await pool.query(sql, params);
  } catch {
    return { rows: [] };
  }
}

async function findInternalRecipient(pool) {
  if (!pool) return { found: false, detail: "Database portal tidak tersedia untuk verifikasi penerima internal." };
  const rows = (await query(pool, "SELECT * FROM users")).rows || [];
  const activeRows = rows.filter((row) => {
    if (row.deleted_at) return false;
    if (row.is_active === false || row.is_active === 0) return false;
    if (String(row.status || "").toLowerCase() === "inactive") return false;
    return true;
  });
  const match = activeRows.find((row) => normalizePhone(row.whatsapp_number) === RECIPIENT_PHONE);
  if (!match) return { found: false, detail: `Penerima internal ${MASKED_PHONE} tidak ditemukan pada user aktif.` };
  return {
    found: true,
    detail: "Penerima ditemukan sebagai user aktif internal dengan nomor WhatsApp terdaftar.",
  };
}

async function countPendingApprovals(pool) {
  const queryResult = await query(
    pool,
    "SELECT COUNT(*)::int AS count FROM aleta_bot_approval_requests WHERE status = 'pending'"
  );
  return Number(queryResult.rows?.[0]?.count ?? 0);
}

async function getRuntimeSnapshot() {
  const [statusResponse, waResponse, diagnosticsResponse, queueResponse, activeDeadLettersResponse] = await Promise.all([
    fetchJson(`${BOT_BASE_URL}/internal/aleta-bot/status`, { headers: internalHeaders() }),
    fetchJson(`${BOT_BASE_URL}/internal/aleta-bot/whatsapp/status`, { headers: internalHeaders() }),
    fetchJson(`${BOT_BASE_URL}/internal/aleta-bot/whatsapp/diagnostics`, { headers: internalHeaders() }),
    fetchJson(`${BOT_BASE_URL}/internal/aleta-bot/queue?limit=40`, { headers: internalHeaders() }),
    fetchJson(`${BOT_BASE_URL}/internal/aleta-bot/queue/dead-letters?limit=100&status=active`, {
      headers: internalHeaders(),
    }),
  ]);

  const statusData = statusResponse.data || {};
  const waData = waResponse.data || {};
  const diagnosticsData = diagnosticsResponse.data || {};
  const whatsapp = statusData.whatsapp || waData || {};
  const worker = statusData.worker || {};
  const queue = queueResponse.data?.stats || statusData.queue || {};
  const safeSendingWindow = statusData.bot?.sendingWindow || waData.sendingWindow || worker.sendingWindow || {};
  const reminder = readJsonFile(RUNTIME_CONFIG_PATHS.find((file) => existsSync(file)) || "")?.dispositionDeadlineReminder || {};
  const scheduler = reminder.scheduler || {};

  return {
    rawStatusOk: statusResponse.ok,
    rawWaOk: waResponse.ok,
    rawDiagnosticsOk: diagnosticsResponse.ok,
    rawQueueOk: queueResponse.ok,
    whatsappStatus: normalizeStatus(whatsapp.status || diagnosticsData.status),
    initializing: Boolean(whatsapp.initializing ?? diagnosticsData.initializing),
    hasClient: Boolean(whatsapp.hasClient ?? diagnosticsData.hasClient),
    lastErrorType: String(whatsapp.lastErrorType || diagnosticsData.lastErrorType || ""),
    initializeAgeMs: Number(whatsapp.initializeAgeMs ?? diagnosticsData.initializeAgeMs ?? 0),
    worker: {
      enabled: Boolean(worker.enabled),
      activeTimer: Boolean(worker.activeTimer),
      paused: Boolean(worker.paused),
      running: Boolean(worker.running),
      intervalMs: Number(worker.intervalMs || 0),
      batchSize: Number(worker.batchSize || 0),
    },
    queue: {
      total: Number(queue.total || 0),
      pending: Number(queue.pending || 0),
      processing: Number(queue.processing || 0),
      sent: Number(queue.sent || 0),
      failed: Number(queue.failed || 0),
      skipped: Number(queue.skipped || 0),
      dryRun: Number(queue.dry_run || queue.dryRun || 0),
      resolved: Number(queue.resolved || 0),
      deadLetter: Number(queue.dead_letter || queue.deadLetter || 0),
    },
    queueItems: queueResponse.data?.items || [],
    activeDeadLetters: activeDeadLettersResponse.data?.items || [],
    safeSendingWindow: {
      enabled: Boolean(safeSendingWindow.enabled),
      start: safeSendingWindow.start || "",
      end: safeSendingWindow.end || "",
      inside: Boolean(safeSendingWindow.inside ?? safeSendingWindow.insideWindow),
      allowed: Boolean(safeSendingWindow.allowed),
      message: safeSendingWindow.message || "",
    },
    botEnabled: Boolean(statusData.bot?.botEnabled ?? statusData.bot?.enabled ?? statusData.botEnabled),
    aiRuntime: statusData.aiRuntime
      ? {
          status: statusData.aiRuntime.status || statusData.aiRuntime.lastSyncStatus || "unknown",
          provider: statusData.aiRuntime.provider || statusData.aiRuntime.providerId || "",
        }
      : null,
    reminder: {
      mode: reminder.mode || "unknown",
      enabled: Boolean(reminder.enabled),
      schedulerEnabled: Boolean(scheduler.enabled),
      schedulerMode: scheduler.mode || "unknown",
      killSwitch: Boolean(reminder.killSwitch),
    },
  };
}

function latestQueueItem(snapshot, queueId) {
  return (snapshot.queueItems || []).find((item) => item.id === queueId) || null;
}

async function sendLimitedMessage() {
  const response = await fetchJson(`${BOT_BASE_URL}/internal/aleta-bot/messages/enqueue`, {
    method: "POST",
    headers: internalHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({
      sourceApp: "aleta_pilot",
      sourceFeature: "bot_enabled_limited_whatsapp_test",
      entityType: "pilot_test",
      entityId: "bot-enabled-limited-wa-test-2026-05-02",
      recipientNumber: RECIPIENT_PHONE,
      recipientName: RECIPIENT_NAME,
      message: MESSAGE,
      category: "manual",
      priority: 1,
      dryRun: false,
      idempotencyKey: IDEMPOTENCY_KEY,
      metadata: {
        recipientType: "employee",
        recipientRole: RECIPIENT_ROLE,
        limitedTest: true,
        explicitConsent: true,
        noBroadcast: true,
      },
    }),
    timeoutMs: 12000,
  });
  const queueId = response.data?.queueId || response.data?.existingQueueId || null;
  if (!response.ok || response.data?.ok !== true || !queueId) {
    return {
      ok: false,
      status: response.status,
      error: sanitizeError(response.data?.message || response.data?.error || response.error || "send_failed"),
    };
  }
  return {
    ok: true,
    queueId,
    queueStatus: response.data.status || "pending",
    duplicate: Boolean(response.data.duplicate),
  };
}

async function pollQueueItem(queueId, maxWaitMs = 90000) {
  const startedAt = Date.now();
  let lastSnapshot = null;
  let lastItem = null;
  while (Date.now() - startedAt < maxWaitMs) {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    lastSnapshot = await getRuntimeSnapshot();
    lastItem = latestQueueItem(lastSnapshot, queueId);
    const status = normalizeStatus(lastItem?.status);
    if (["sent", "failed", "resolved", "skipped", "dry_run"].includes(status)) break;
  }
  return { snapshot: lastSnapshot, item: lastItem, waitedMs: Date.now() - startedAt };
}

function evaluateProductionSafety(snapshot) {
  result.schedulerProductionActive = snapshot.reminder.schedulerEnabled && snapshot.reminder.schedulerMode === "production";
  result.reminderProductionActive = snapshot.reminder.enabled && snapshot.reminder.mode === "production";
}

function writeReports() {
  mkdirSync(REPORT_DIR, { recursive: true });
  const safeResult = sanitizeValue(result);
  if (containsSensitivePayload(safeResult)) {
    throw new Error("Report sanitization failed: sensitive payload detected.");
  }
  writeFileSync(REPORT_JSON, `${JSON.stringify(safeResult, null, 2)}\n`, "utf8");
  const md = [
    "# ALETA WhatsApp Bot Enabled Limited Test",
    "",
    `Generated at: ${safeResult.generatedAt}`,
    "",
    `Overall: ${safeResult.overall}`,
    `botEnabled before: ${safeResult.botEnabledBefore}`,
    `botEnabled after enable: ${safeResult.botEnabledAfterEnable}`,
    `botEnabled final: ${safeResult.botEnabledFinal}`,
    `Message sent: ${safeResult.messageSent ? "yes" : "no"}`,
    `Sent count: ${safeResult.sentCount}`,
    `Enqueued count: ${safeResult.enqueuedCount}`,
    `Recipient: ${RECIPIENT_NAME} (${RECIPIENT_ROLE}), ${MASKED_PHONE}`,
    `Idempotency key: ${IDEMPOTENCY_KEY}`,
    "",
    "## Gate Sebelum Enable",
    ...safeResult.gateBeforeEnable.map((gate) => `- ${gate.status} - ${gate.label}: ${gate.detail}`),
    "",
    "## Gate Sebelum Kirim",
    ...safeResult.gateBeforeSend.map((gate) => `- ${gate.status} - ${gate.label}: ${gate.detail}`),
    "",
    "## Status Setelah Uji",
    `- WhatsApp: ${safeResult.summary?.after?.whatsappStatus ?? "-"}`,
    `- Worker: enabled=${safeResult.summary?.after?.worker?.enabled ?? "-"}, activeTimer=${safeResult.summary?.after?.worker?.activeTimer ?? "-"}, paused=${safeResult.summary?.after?.worker?.paused ?? "-"}`,
    `- Queue: pending=${safeResult.queueAfterSend.pending ?? "-"}, processing=${safeResult.queueAfterSend.processing ?? "-"}, failed=${safeResult.queueAfterSend.failed ?? "-"}, sent=${safeResult.queueAfterSend.sent ?? "-"}`,
    `- Dead-letter aktif: ${safeResult.deadLetterActiveAfterSend}`,
    `- Approval pending: ${safeResult.approvalPendingAfterSend}`,
    `- Delivery: ${safeResult.deliveryHistory.status ?? "unknown"} (${safeResult.deliveryHistory.queueId ?? "no-queue-id"})`,
    "",
    "## Actions Taken",
    ...(safeResult.actionsTaken.length
      ? safeResult.actionsTaken.map((action) => `- ${action.action}: ${action.detail}`)
      : ["- Tidak ada aksi."]),
    "",
    "## Blockers",
    ...(safeResult.blockers.length
      ? safeResult.blockers.map((blocker) => `- ${blocker.label}: ${blocker.detail}`)
      : ["- Tidak ada blocker."]),
    "",
    "## Warnings",
    ...(safeResult.warnings.length
      ? safeResult.warnings.map((warning) => `- ${warning.label}: ${warning.detail}`)
      : ["- Tidak ada warning."]),
    "",
    "## Safety",
    "- Tidak ada broadcast.",
    "- Tidak ada resend queue lama atau dead-letter.",
    "- Tidak ada scheduler/reminder production yang diaktifkan.",
    "- Tidak ada scan QR, logout/reset session, atau perubahan session.",
  ].join("\n");
  if (containsSensitivePayload(md)) {
    throw new Error("Markdown report sanitization failed: sensitive payload detected.");
  }
  writeFileSync(REPORT_MD, `${md}\n`, "utf8");
}

async function main() {
  const configs = readRuntimeConfigFiles();
  if (configs.length === 0) {
    result.blockers.push({ key: "runtime_config_missing", label: "Runtime config", detail: "Runtime config tidak ditemukan." });
    result.overall = "FAIL";
    writeReports();
    return;
  }

  const preflight = readJsonFile(PREFLIGHT_JSON);
  const smoke = readJsonFile(SMOKE_JSON);
  const pool = await openPortalDb();
  const before = await getRuntimeSnapshot();
  const recipient = await findInternalRecipient(pool);
  const approvalPendingBefore = await countPendingApprovals(pool);
  evaluateProductionSafety(before);
  result.botEnabledBefore = before.botEnabled;
  result.summary.before = sanitizeValue({
    whatsappStatus: before.whatsappStatus,
    worker: before.worker,
    queue: before.queue,
    activeDeadLetters: before.activeDeadLetters.length,
    safeSendingWindow: before.safeSendingWindow,
    reminder: before.reminder,
    aiRuntime: before.aiRuntime,
    approvalPending: approvalPendingBefore,
  });

  addGate(
    "gateBeforeEnable",
    "preflight_latest",
    "Preflight terakhir",
    preflight && preflight.overall !== "FAIL" && preflight.safeToRunSmokeTest ? "PASS" : "FAIL",
    preflight ? `overall=${preflight.overall}, safeToRunSmokeTest=${Boolean(preflight.safeToRunSmokeTest)}.` : "Laporan preflight belum tersedia."
  );
  addGate(
    "gateBeforeEnable",
    "smoke_latest",
    "Smoke dry-run terakhir",
    smoke && smoke.overall === "PASS" && smoke.safeForLimitedWhatsAppPilot ? "PASS" : "FAIL",
    smoke ? `overall=${smoke.overall}, safeForLimitedWhatsAppPilot=${Boolean(smoke.safeForLimitedWhatsAppPilot)}.` : "Laporan smoke belum tersedia."
  );
  addGate(
    "gateBeforeEnable",
    "runtime_reachable",
    "Runtime ALETA Bot reachable",
    before.rawStatusOk && before.rawWaOk && before.rawDiagnosticsOk && before.rawQueueOk ? "PASS" : "FAIL",
    "Status, WhatsApp, diagnostics, dan queue runtime dibaca."
  );
  addGate("gateBeforeEnable", "whatsapp_connected", "WhatsApp runtime connected", before.whatsappStatus === "connected" ? "PASS" : "FAIL", `status=${before.whatsappStatus}.`);
  addGate(
    "gateBeforeEnable",
    "whatsapp_no_lock_or_stuck",
    "WhatsApp tidak terkunci/stuck",
    before.lastErrorType === "browser_locked" || before.lastErrorType === "initialize_timeout" || before.initializeAgeMs > 120000
      ? "FAIL"
      : "PASS",
    `lastErrorType=${before.lastErrorType || "-"}, initializing=${before.initializing}, initializeAgeMs=${before.initializeAgeMs}.`
  );
  addGate(
    "gateBeforeEnable",
    "worker_operational",
    "Worker operasional",
    before.worker.enabled && before.worker.activeTimer && !before.worker.paused ? "PASS" : "FAIL",
    `enabled=${before.worker.enabled}, activeTimer=${before.worker.activeTimer}, paused=${before.worker.paused}.`
  );
  addGate(
    "gateBeforeEnable",
    "queue_empty_before_enable",
    "Queue kosong sebelum enable",
    before.queue.pending === 0 && before.queue.processing === 0 && before.queue.failed === 0 ? "PASS" : "FAIL",
    `pending=${before.queue.pending}, processing=${before.queue.processing}, failed=${before.queue.failed}.`
  );
  addGate("gateBeforeEnable", "dead_letter_zero", "Dead-letter aktif", before.activeDeadLetters.length === 0 ? "PASS" : "FAIL", `${before.activeDeadLetters.length} dead-letter aktif.`);
  addGate("gateBeforeEnable", "approval_zero", "Approval pending", approvalPendingBefore === 0 ? "PASS" : "FAIL", `${approvalPendingBefore} approval pending.`);
  addGate(
    "gateBeforeEnable",
    "safe_window_allowed",
    "Safe Sending Window allowed",
    before.safeSendingWindow.enabled && before.safeSendingWindow.allowed ? "PASS" : "FAIL",
    `enabled=${before.safeSendingWindow.enabled}, ${before.safeSendingWindow.start}-${before.safeSendingWindow.end}, allowed=${before.safeSendingWindow.allowed}.`
  );
  addGate(
    "gateBeforeEnable",
    "production_disabled",
    "Reminder/scheduler production disabled",
    !result.schedulerProductionActive && !result.reminderProductionActive && !before.reminder.killSwitch
      ? "PASS"
      : "FAIL",
    `reminder=${before.reminder.enabled}/${before.reminder.mode}, scheduler=${before.reminder.schedulerEnabled}/${before.reminder.schedulerMode}, killSwitch=${before.reminder.killSwitch}.`
  );
  addGate(
    "gateBeforeEnable",
    "target_valid",
    "Nomor tujuan internal valid",
    isValidPhone(RECIPIENT_PHONE) && recipient.found ? "PASS" : "FAIL",
    recipient.detail
  );

  if (result.blockers.length > 0) {
    addAction("enable_skipped", "botEnabled tidak diaktifkan karena gate awal belum aman.");
    result.botEnabledFinal = before.botEnabled;
    result.overall = "FAIL";
    await pool?.end();
    writeReports();
    console.log(`ALETA WhatsApp bot-enabled test ${result.overall}. Report: ${REPORT_MD}`);
    return;
  }

  let restored = false;
  let sendResult = null;
  let deliveryItem = null;
  let after = null;
  try {
    writeRuntimeConfigFiles(configs, true, ENABLE_REASON);
    addAction("enable_bot_temporarily", "botEnabled=true ditulis ke runtime config resmi untuk uji satu pesan internal.");
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const afterEnable = await getRuntimeSnapshot();
    result.botEnabledAfterEnable = afterEnable.botEnabled;
    addGate(
      "gateBeforeSend",
      "bot_enabled_after_enable",
      "botEnabled terbaca true",
      afterEnable.botEnabled ? "PASS" : "FAIL",
      `botEnabled=${afterEnable.botEnabled}.`
    );
    addGate(
      "gateBeforeSend",
      "queue_still_empty",
      "Queue tetap kosong sebelum kirim",
      afterEnable.queue.pending === 0 && afterEnable.queue.processing === 0 && afterEnable.queue.failed === 0 ? "PASS" : "FAIL",
      `pending=${afterEnable.queue.pending}, processing=${afterEnable.queue.processing}, failed=${afterEnable.queue.failed}.`
    );
    addGate(
      "gateBeforeSend",
      "production_still_disabled",
      "Scheduler/reminder tetap non-production",
      !afterEnable.reminder.enabled &&
        afterEnable.reminder.mode !== "production" &&
        !afterEnable.reminder.schedulerEnabled &&
        afterEnable.reminder.schedulerMode !== "production"
        ? "PASS"
        : "FAIL",
      `reminder=${afterEnable.reminder.enabled}/${afterEnable.reminder.mode}, scheduler=${afterEnable.reminder.schedulerEnabled}/${afterEnable.reminder.schedulerMode}.`
    );
    addGate(
      "gateBeforeSend",
      "whatsapp_still_connected",
      "WhatsApp tetap connected",
      afterEnable.whatsappStatus === "connected" ? "PASS" : "FAIL",
      `status=${afterEnable.whatsappStatus}.`
    );

    if (result.blockers.length === 0) {
      sendResult = await sendLimitedMessage();
      if (!sendResult.ok) {
        result.blockers.push({
          key: "limited_send_failed",
          label: "Pengiriman uji gagal",
          detail: sendResult.error || "Endpoint enqueue tidak menerima pesan.",
        });
        addAction("send_attempt_failed_once", "Satu percobaan pengiriman dilakukan dan tidak diulang otomatis.");
      } else {
        const pollResult = await pollQueueItem(sendResult.queueId);
        after = pollResult.snapshot || (await getRuntimeSnapshot());
        deliveryItem = pollResult.item || latestQueueItem(after, sendResult.queueId);
        result.deliveryHistory = {
          queueId: sendResult.queueId,
          status: deliveryItem?.status || sendResult.queueStatus || "unknown",
          recipient: MASKED_PHONE,
          source: "aleta_bot_queue_public",
          waitedMs: pollResult.waitedMs,
        };
        result.messageEnqueued = true;
        result.enqueuedCount = sendResult.duplicate ? 0 : 1;
        result.messageSent = normalizeStatus(deliveryItem?.status || sendResult.queueStatus) === "sent";
        result.sentCount = result.messageSent ? 1 : 0;
        addAction(
          sendResult.duplicate ? "send_skipped_duplicate_idempotency" : "send_limited_internal_test",
          sendResult.duplicate
            ? `Idempotency key sudah ada; tidak membuat enqueue baru untuk ${MASKED_PHONE}.`
            : `Satu pesan test internal baru dimasukkan ke queue resmi ALETA Bot untuk ${MASKED_PHONE}.`,
          { queueId: sendResult.queueId, duplicate: Boolean(sendResult.duplicate) }
        );
      }
    } else {
      addAction("send_skipped", "Pesan tidak dikirim karena gate setelah enable belum aman.");
    }
  } finally {
    restoreRuntimeConfigFiles(configs);
    restored = true;
    addAction("disable_bot_after_test", "botEnabled dikembalikan ke nilai semula setelah uji satu pesan internal.");
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  after = after || (await getRuntimeSnapshot());
  const finalSnapshot = await getRuntimeSnapshot();
  result.botEnabledFinal = finalSnapshot.botEnabled;
  result.deadLetterActiveAfterSend = finalSnapshot.activeDeadLetters.length;
  result.approvalPendingAfterSend = await countPendingApprovals(pool);
  evaluateProductionSafety(finalSnapshot);
  result.queueAfterSend = {
    pending: finalSnapshot.queue.pending,
    processing: finalSnapshot.queue.processing,
    failed: finalSnapshot.queue.failed,
    sent: finalSnapshot.queue.sent,
    skipped: finalSnapshot.queue.skipped,
    deadLetter: finalSnapshot.queue.deadLetter,
    activeDeadLetters: finalSnapshot.activeDeadLetters.length,
  };
  result.summary.after = sanitizeValue({
    whatsappStatus: finalSnapshot.whatsappStatus,
    worker: finalSnapshot.worker,
    queue: finalSnapshot.queue,
    activeDeadLetters: finalSnapshot.activeDeadLetters.length,
    safeSendingWindow: finalSnapshot.safeSendingWindow,
    reminder: finalSnapshot.reminder,
    aiRuntime: finalSnapshot.aiRuntime,
    approvalPending: result.approvalPendingAfterSend,
    restored,
  });

  if (result.deadLetterActiveAfterSend > 0) {
    result.blockers.push({ key: "dead_letter_after", label: "Dead-letter setelah uji", detail: `${result.deadLetterActiveAfterSend} dead-letter aktif.` });
  }
  if (result.queueAfterSend.failed > before.queue.failed) {
    result.blockers.push({ key: "queue_failed_after", label: "Queue failed bertambah", detail: `Queue failed naik dari ${before.queue.failed} ke ${result.queueAfterSend.failed}.` });
  }
  if (result.botEnabledFinal !== result.botEnabledBefore) {
    result.warnings.push({ key: "bot_enabled_final_changed", label: "botEnabled final berubah", detail: `Final=${result.botEnabledFinal}, sebelum=${result.botEnabledBefore}.` });
  }
  if (sendResult?.ok && !result.messageSent) {
    result.warnings.push({ key: "delivery_not_sent", label: "Pesan belum terkirim", detail: `Status delivery=${result.deliveryHistory.status || "unknown"}. Tidak ada retry otomatis.` });
  }

  result.overall = result.blockers.length > 0 ? "FAIL" : result.messageSent ? "PASS" : "WARN";
  await pool?.end();
  writeReports();
  console.log(`ALETA WhatsApp bot-enabled test ${result.overall}. Report: ${REPORT_MD}`);
}

main().catch((error) => {
  result.overall = "FAIL";
  result.blockers.push({ key: "runner_crashed", label: "Runner gagal", detail: sanitizeError(error) });
  try {
    writeReports();
  } catch {
    // keep output safe
  }
  console.error(`ALETA WhatsApp bot-enabled test failed: ${sanitizeError(error)}`);
  process.exitCode = 1;
});
