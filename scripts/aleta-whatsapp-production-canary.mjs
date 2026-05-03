import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const SCRIPT_DIR = path.dirname(__filename);
const ROOT_DIR = path.resolve(SCRIPT_DIR, "..");
const PORTAL_DIR = path.join(ROOT_DIR, "manajemen_surat");
const BOT_DIR = path.join(ROOT_DIR, "aleta_bot");
const REPORT_DIR = path.join(ROOT_DIR, "reports");

const RISK_JSON = path.join(REPORT_DIR, "aleta-whatsapp-production-risk-check-latest.json");
const SHADOW_JSON = path.join(REPORT_DIR, "aleta-whatsapp-production-shadow-run-latest.json");
const PREFLIGHT_JSON = path.join(REPORT_DIR, "aleta-preflight-latest.json");
const SMOKE_JSON = path.join(REPORT_DIR, "aleta-smoke-dry-run-latest.json");
const REPORT_JSON = path.join(REPORT_DIR, "aleta-whatsapp-production-canary-latest.json");
const REPORT_MD = path.join(REPORT_DIR, "aleta-whatsapp-production-canary-latest.md");
const AUDIT_JSONL = path.join(REPORT_DIR, "aleta-whatsapp-production-canary-audit.jsonl");
const BOT_BASE_URL = "http://127.0.0.1:3003";
const CANARY_EVENT_ID = "CANARY-PROD-ALETA-2026-05-03-001";

const RUNTIME_CONFIG_PATHS = [
  path.join(BOT_DIR, "config", "aleta-runtime.json"),
  path.join(PORTAL_DIR, "data", "aleta-bot-runtime.json"),
];

const CANARY_RECIPIENTS = [
  {
    name: "DERRY BRIANTONO, S.H.",
    role: "Hakim",
    phone: process.env.ALETA_CANARY_PHONE_1 || "",
  },
  {
    name: "ABDUL SALAM, S.HI. MH.",
    role: "Ketua",
    phone: process.env.ALETA_CANARY_PHONE_2 || "",
  },
  {
    name: "AKBAR ALI, S.H.I.",
    role: "Wakil Ketua",
    phone: process.env.ALETA_CANARY_PHONE_3 || "",
  },
];

const portalEnv = loadEnvFiles([path.join(PORTAL_DIR, ".env"), path.join(PORTAL_DIR, ".env.local")]);
const botEnv = loadEnvFiles([path.join(BOT_DIR, ".env")]);

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

function readJson(file, fallback = null) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function normalizePhone(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("62")) return digits;
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  if (digits.startsWith("8")) return `62${digits}`;
  return digits;
}

function maskPhone(value) {
  const digits = normalizePhone(value);
  if (digits.length < 8) return "";
  return `${digits.slice(0, 3)}****${digits.slice(-4)}`;
}

function slugName(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "recipient";
}

function sanitizeError(error) {
  return String(error?.message ?? error ?? "unknown_error")
    .replace(/[A-Za-z]:\\[^\s"'<>]+/g, "[path]")
    .replace(/(token|password|api[_-]?key)=([^&\s]+)/gi, "$1=[redacted]")
    .replace(/62\d{7,15}/g, (match) => maskPhone(match) || "[masked-phone]")
    .replace(/\.wwebjs_auth[^\s"'<>]*/gi, "[session-path]")
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
      .replace(/62\d{7,15}/g, (match) => maskPhone(match) || "[masked-phone]")
      .replace(/\.wwebjs_auth[^\s"'<>]*/gi, "[session-path]")
      .replace(/session-[a-z0-9_-]+/gi, "[session-name]")
      .replace(/(token|password|api[_-]?key)=([^&\s]+)/gi, "$1=[redacted]");
  }
  return value;
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

function readRuntimeConfigFiles() {
  return RUNTIME_CONFIG_PATHS.filter((file) => existsSync(file)).map((file) => ({
    file,
    raw: readFileSync(file, "utf8"),
    parsed: JSON.parse(readFileSync(file, "utf8")),
  }));
}

function writeCanaryRuntimeConfigFiles(configs) {
  const changedAt = new Date().toISOString();
  for (const config of configs) {
    const next = {
      ...config.parsed,
      botEnabled: true,
      notificationsEnabled: true,
      dryRunEnabled: false,
      retryLimit: 0,
      updatedAt: changedAt,
      productionCanaryAudit: {
        changedBy: "aleta-whatsapp-production-canary.mjs",
        changedAt,
        oldBotEnabled: Boolean(config.parsed.botEnabled),
        newBotEnabled: true,
        reason: "Temporary enable for production canary only; no scheduler production activation.",
      },
    };
    writeFileSync(config.file, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  }
  appendFileSync(
    AUDIT_JSONL,
    `${JSON.stringify({
      at: changedAt,
      action: "temporary_canary_enable",
      botEnabled: true,
      notificationsEnabled: true,
      dryRunEnabled: false,
      retryLimit: 0,
      schedulerProduction: false,
    })}\n`,
    "utf8"
  );
}

function restoreRuntimeConfigFiles(configs) {
  for (const config of configs) {
    writeFileSync(config.file, config.raw, "utf8");
  }
  appendFileSync(
    AUDIT_JSONL,
    `${JSON.stringify({
      at: new Date().toISOString(),
      action: "restore_after_canary",
      detail: "Runtime config restored to pre-canary state.",
    })}\n`,
    "utf8"
  );
}

async function getRuntimeSnapshot() {
  const [statusResponse, waResponse, diagnosticsResponse, queueResponse, activeDeadLettersResponse] = await Promise.all([
    fetchJson(`${BOT_BASE_URL}/internal/aleta-bot/status`, { headers: internalHeaders() }),
    fetchJson(`${BOT_BASE_URL}/internal/aleta-bot/whatsapp/status`, { headers: internalHeaders() }),
    fetchJson(`${BOT_BASE_URL}/internal/aleta-bot/whatsapp/diagnostics`, { headers: internalHeaders() }),
    fetchJson(`${BOT_BASE_URL}/internal/aleta-bot/queue?limit=100`, { headers: internalHeaders() }),
    fetchJson(`${BOT_BASE_URL}/internal/aleta-bot/queue/dead-letters?limit=100&status=active`, {
      headers: internalHeaders(),
    }),
  ]);
  const statusData = statusResponse.data || {};
  const waData = waResponse.data || {};
  const diagnostics = diagnosticsResponse.data || {};
  const whatsapp = statusData.whatsapp || waData || {};
  const worker = statusData.worker || {};
  const queue = queueResponse.data?.stats || statusData.queue || {};
  const sendingWindow = statusData.bot?.sendingWindow || waData.sendingWindow || worker.sendingWindow || {};
  const config = readJson(RUNTIME_CONFIG_PATHS.find((file) => existsSync(file)) || "", {});
  const reminder = config.dispositionDeadlineReminder || {};
  const scheduler = reminder.scheduler || {};
  return {
    rawOk: statusResponse.ok && waResponse.ok && diagnosticsResponse.ok && queueResponse.ok && activeDeadLettersResponse.ok,
    whatsappStatus: String(whatsapp.status || diagnostics.status || "unknown").toLowerCase(),
    initializing: Boolean(whatsapp.initializing ?? diagnostics.initializing),
    lastErrorType: String(whatsapp.lastErrorType || diagnostics.lastErrorType || ""),
    initializeAgeMs: Number(whatsapp.initializeAgeMs ?? diagnostics.initializeAgeMs ?? 0),
    sessionName: String(whatsapp.sessionName || diagnostics.sessionName || ""),
    botEnabled: Boolean(statusData.bot?.botEnabled ?? statusData.bot?.enabled ?? config.botEnabled),
    notificationsEnabled: Boolean(config.notificationsEnabled),
    worker: {
      enabled: Boolean(worker.enabled),
      activeTimer: Boolean(worker.activeTimer),
      paused: Boolean(worker.paused),
      running: Boolean(worker.running),
    },
    queue: {
      total: Number(queue.total || 0),
      pending: Number(queue.pending || 0),
      processing: Number(queue.processing || 0),
      sent: Number(queue.sent || 0),
      failed: Number(queue.failed || 0),
      skipped: Number(queue.skipped || 0),
      dryRun: Number(queue.dry_run || queue.dryRun || 0),
      deadLetter: Number(queue.dead_letter || queue.deadLetter || 0),
      resolved: Number(queue.resolved || 0),
    },
    queueItems: queueResponse.data?.items || [],
    activeDeadLetters: activeDeadLettersResponse.data?.items || [],
    safeSendingWindow: {
      enabled: Boolean(sendingWindow.enabled),
      start: sendingWindow.start || "",
      end: sendingWindow.end || "",
      inside: Boolean(sendingWindow.inside),
      allowed: Boolean(sendingWindow.allowed),
    },
    reminder: {
      enabled: Boolean(reminder.enabled),
      mode: reminder.mode || "unknown",
      schedulerEnabled: Boolean(scheduler.enabled),
      schedulerMode: scheduler.mode || "unknown",
      killSwitch: Boolean(reminder.killSwitch),
    },
  };
}

function addGate(result, key, label, status, detail, metadata = {}) {
  const entry = { key, label, status, detail, metadata: sanitizeValue(metadata) };
  result.gateBeforeSend.push(entry);
  if (status === "FAIL") result.blockers.push({ key, label, detail });
  if (status === "WARN") result.warnings.push({ key, label, detail });
  return entry;
}

function addAction(result, action, detail, metadata = {}) {
  result.actionsTaken.push({ action, detail, metadata: sanitizeValue(metadata) });
}

function latestQueueItem(snapshot, queueId) {
  return (snapshot.queueItems || []).find((item) => item.id === queueId) || null;
}

function buildCanaryMessage(recipient) {
  return `CANARY-PROD-ALETA - Notifikasi disposisi internal ALETA untuk ${recipient.name} (${recipient.role}). Mohon abaikan jika tidak berkepentingan. Tidak perlu membalas.`;
}

async function enqueueCanaryMessage(recipient) {
  const slug = slugName(recipient.name);
  const response = await fetchJson(`${BOT_BASE_URL}/internal/aleta-bot/messages/enqueue`, {
    method: "POST",
    headers: internalHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({
      sourceApp: "aleta_production_canary",
      sourceFeature: "internal_disposition_notification",
      entityType: "production_canary_disposition",
      entityId: CANARY_EVENT_ID,
      recipientNumber: recipient.phone,
      recipientName: recipient.name,
      message: buildCanaryMessage(recipient),
      category: "employee",
      notificationKey: "prod-internal-disposition-notification",
      priority: 3,
      dryRun: false,
      idempotencyKey: `canary-prod-aleta-2026-05-03-001-internal-disposition-${slug}`,
      metadata: {
        workflow: "internal_disposition_notification",
        canary: true,
        canaryEventId: CANARY_EVENT_ID,
        recipientRole: recipient.role,
      },
    }),
    timeoutMs: 12000,
  });
  const queueId = response.data?.queueId || response.data?.existingQueueId || null;
  return {
    ok: response.ok && response.data?.ok === true && Boolean(queueId),
    queueId,
    duplicate: Boolean(response.data?.duplicate),
    status: response.data?.status || "unknown",
    error: response.ok ? "" : sanitizeError(response.data?.message || response.data?.error || response.error),
  };
}

async function pollQueueItems(queueIds, maxWaitMs = 150000) {
  const startedAt = Date.now();
  let snapshot = await getRuntimeSnapshot();
  while (Date.now() - startedAt < maxWaitMs) {
    const statuses = queueIds.map((id) => String(latestQueueItem(snapshot, id)?.status || "unknown").toLowerCase());
    if (statuses.length > 0 && statuses.every((status) => ["sent", "failed", "resolved", "skipped", "dry_run"].includes(status))) {
      return snapshot;
    }
    await new Promise((resolve) => setTimeout(resolve, 3000));
    snapshot = await getRuntimeSnapshot();
  }
  return snapshot;
}

function writeReports(result) {
  mkdirSync(REPORT_DIR, { recursive: true });
  const safe = sanitizeValue(result);
  writeFileSync(REPORT_JSON, `${JSON.stringify(safe, null, 2)}\n`, "utf8");
  const md = [
    "# ALETA WhatsApp Production Canary",
    "",
    `Generated: ${safe.generatedAt}`,
    "",
    `Overall: **${safe.overall}**`,
    `Canary executed: **${safe.canaryExecuted ? "yes" : "no"}**`,
    `Workflow: ${safe.workflow}`,
    `Sent count: ${safe.sentCount}`,
    `Failed count: ${safe.failedCount}`,
    `Duplicate count: ${safe.duplicateCount}`,
    `Out-of-whitelist count: ${safe.outOfWhitelistRecipients}`,
    `botEnabled before/during/final: ${safe.botEnabledBefore}/${safe.botEnabledDuringCanary}/${safe.botEnabledFinal}`,
    "",
    "## Recipients",
    ...(safe.recipients.length
      ? safe.recipients.map((recipient) => `- ${recipient.name} (${recipient.role}), ${recipient.maskedPhone}: ${recipient.deliveryStatus}`)
      : ["- Tidak ada penerima."]),
    "",
    "## Gates",
    ...safe.gateBeforeSend.map((gate) => `- ${gate.status} - ${gate.label}: ${gate.detail}`),
    "",
    "## Queue After Canary",
    `- pending=${safe.queueAfter.pending ?? "-"}, processing=${safe.queueAfter.processing ?? "-"}, failed=${safe.queueAfter.failed ?? "-"}, sent=${safe.queueAfter.sent ?? "-"}`,
    `- dead-letter active=${safe.deadLetterActiveAfter}`,
    `- approval pending=${safe.approvalPendingAfter}`,
    "",
    "## Blockers",
    ...(safe.blockers.length ? safe.blockers.map((item) => `- ${item.key}: ${item.detail}`) : ["- Tidak ada blocker."]),
    "",
    "## Actions",
    ...safe.actionsTaken.map((item) => `- ${item.action}: ${item.detail}`),
  ].join("\n");
  writeFileSync(REPORT_MD, `${md}\n`, "utf8");
}

async function main() {
  mkdirSync(REPORT_DIR, { recursive: true });
  const risk = readJson(RISK_JSON, {});
  const shadow = readJson(SHADOW_JSON, {});
  const preflight = readJson(PREFLIGHT_JSON, {});
  const smoke = readJson(SMOKE_JSON, {});
  const configs = readRuntimeConfigFiles();
  const result = {
    generatedAt: new Date().toISOString(),
    overall: "FAIL",
    canaryExecuted: false,
    workflow: "internal_disposition_notification",
    sentCount: 0,
    failedCount: 0,
    skippedCount: 0,
    duplicateCount: 0,
    outOfWhitelistRecipients: 0,
    botEnabledBefore: null,
    botEnabledDuringCanary: null,
    botEnabledFinal: null,
    notificationsEnabledDuringCanary: null,
    recipients: CANARY_RECIPIENTS.map((recipient) => ({
      name: recipient.name,
      role: recipient.role,
      maskedPhone: maskPhone(recipient.phone),
      deliveryStatus: "not_started",
    })),
    gateBeforeSend: [],
    queueAfter: {},
    deadLetterActiveAfter: 0,
    approvalPendingAfter: Number(preflight.summary?.approvals?.pending || 0),
    blockers: [],
    warnings: [],
    actionsTaken: [],
    summary: {},
  };

  const before = await getRuntimeSnapshot();
  result.botEnabledBefore = before.botEnabled;
  result.summary.before = sanitizeValue({
    whatsappStatus: before.whatsappStatus,
    worker: before.worker,
    queue: before.queue,
    safeSendingWindow: before.safeSendingWindow,
    reminder: before.reminder,
  });

  const uniquePhones = new Set(CANARY_RECIPIENTS.map((recipient) => normalizePhone(recipient.phone)));
  addGate(result, "risk_pass", "Risk-check PASS", risk.overall === "PASS" ? "PASS" : "FAIL", `risk=${risk.overall || "missing"}.`);
  addGate(result, "shadow_pass", "Shadow-run PASS", shadow.overall === "PASS" ? "PASS" : "FAIL", `shadow=${shadow.overall || "missing"}.`);
  addGate(result, "preflight_usable", "Preflight usable", preflight.overall !== "FAIL" ? "PASS" : "FAIL", `preflight=${preflight.overall || "missing"}.`);
  addGate(result, "smoke_pass", "Smoke dry-run PASS", smoke.overall === "PASS" ? "PASS" : "FAIL", `smoke=${smoke.overall || "missing"}.`);
  addGate(result, "canary_whitelist_size", "Whitelist canary", CANARY_RECIPIENTS.length === 3 && uniquePhones.size === 3 ? "PASS" : "FAIL", `${CANARY_RECIPIENTS.length} penerima internal canary.`);
  addGate(result, "runtime_reachable", "Runtime reachable", before.rawOk ? "PASS" : "FAIL", "Status runtime, WhatsApp, diagnostics, queue, dan dead-letter terbaca.");
  addGate(result, "whatsapp_connected", "WhatsApp connected", before.whatsappStatus === "connected" ? "PASS" : "FAIL", `status=${before.whatsappStatus}.`);
  addGate(result, "whatsapp_not_stuck", "WhatsApp tidak lock/stuck", before.lastErrorType === "browser_locked" || before.lastErrorType === "initialize_timeout" || before.initializeAgeMs > 120000 ? "FAIL" : "PASS", `lastErrorType=${before.lastErrorType || "-"}, initializing=${before.initializing}.`);
  addGate(result, "session_name", "Session name tetap", before.sessionName === "aleta-whatsapp-main" ? "PASS" : "FAIL", `session=${before.sessionName || "unknown"}.`);
  addGate(result, "worker_operational", "Worker operasional", before.worker.enabled && before.worker.activeTimer && !before.worker.paused ? "PASS" : "FAIL", `enabled=${before.worker.enabled}, activeTimer=${before.worker.activeTimer}, paused=${before.worker.paused}.`);
  addGate(result, "queue_empty", "Queue kosong", before.queue.pending === 0 && before.queue.processing === 0 && before.queue.failed === 0 ? "PASS" : "FAIL", `pending=${before.queue.pending}, processing=${before.queue.processing}, failed=${before.queue.failed}.`);
  addGate(result, "dead_letter_zero", "Dead-letter aktif", before.activeDeadLetters.length === 0 ? "PASS" : "FAIL", `${before.activeDeadLetters.length} dead-letter aktif.`);
  addGate(result, "approval_zero", "Approval pending", result.approvalPendingAfter === 0 ? "PASS" : "FAIL", `${result.approvalPendingAfter} approval pending.`);
  addGate(result, "safe_window_allowed", "Safe Sending Window allowed", before.safeSendingWindow.enabled && before.safeSendingWindow.allowed ? "PASS" : "FAIL", `enabled=${before.safeSendingWindow.enabled}, ${before.safeSendingWindow.start}-${before.safeSendingWindow.end}, allowed=${before.safeSendingWindow.allowed}.`);
  addGate(result, "scheduler_not_production", "Scheduler/reminder belum production", !before.reminder.enabled && before.reminder.mode !== "production" && !before.reminder.schedulerEnabled && before.reminder.schedulerMode !== "production" && !before.reminder.killSwitch ? "PASS" : "FAIL", `reminder=${before.reminder.enabled}/${before.reminder.mode}, scheduler=${before.reminder.schedulerEnabled}/${before.reminder.schedulerMode}.`);

  if (result.blockers.length > 0) {
    addAction(result, "canary_skipped", "Canary tidak dijalankan karena gate belum aman.");
    result.botEnabledFinal = before.botEnabled;
    result.queueAfter = before.queue;
    result.deadLetterActiveAfter = before.activeDeadLetters.length;
    writeReports(result);
    console.log(`Production canary: ${result.overall}. Report: ${REPORT_JSON}`);
    process.exitCode = 1;
    return;
  }

  let finalSnapshot = before;
  try {
    writeCanaryRuntimeConfigFiles(configs);
    addAction(result, "enable_bot_temporarily", "botEnabled, notificationsEnabled, dan dryRunEnabled=false ditulis sementara untuk canary.");
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const afterEnable = await getRuntimeSnapshot();
    result.botEnabledDuringCanary = afterEnable.botEnabled;
    result.notificationsEnabledDuringCanary = afterEnable.notificationsEnabled;
    addGate(result, "bot_enabled", "botEnabled true", afterEnable.botEnabled ? "PASS" : "FAIL", `botEnabled=${afterEnable.botEnabled}.`);
    addGate(result, "notifications_enabled", "notificationsEnabled true", afterEnable.notificationsEnabled ? "PASS" : "FAIL", `notificationsEnabled=${afterEnable.notificationsEnabled}.`);
    addGate(result, "queue_still_empty", "Queue tetap kosong", afterEnable.queue.pending === 0 && afterEnable.queue.processing === 0 && afterEnable.queue.failed === 0 ? "PASS" : "FAIL", `pending=${afterEnable.queue.pending}, processing=${afterEnable.queue.processing}, failed=${afterEnable.queue.failed}.`);

    const queueIds = [];
    if (result.blockers.length === 0) {
      result.canaryExecuted = true;
      for (const recipient of CANARY_RECIPIENTS) {
        const enqueueResult = await enqueueCanaryMessage(recipient);
        const reportRecipient = result.recipients.find((item) => item.maskedPhone === maskPhone(recipient.phone));
        if (enqueueResult.ok && !enqueueResult.duplicate) {
          queueIds.push(enqueueResult.queueId);
          if (reportRecipient) {
            reportRecipient.queueId = enqueueResult.queueId;
            reportRecipient.deliveryStatus = "queued";
          }
        } else if (enqueueResult.duplicate) {
          result.duplicateCount += 1;
          if (reportRecipient) {
            reportRecipient.queueId = enqueueResult.queueId;
            reportRecipient.deliveryStatus = "duplicate";
          }
        } else {
          result.failedCount += 1;
          if (reportRecipient) reportRecipient.deliveryStatus = "enqueue_failed";
          result.warnings.push({ key: "enqueue_failed", label: `Enqueue ${recipient.name}`, detail: enqueueResult.error || "Gagal enqueue." });
        }
      }
      finalSnapshot = await pollQueueItems(queueIds);
      for (const recipient of CANARY_RECIPIENTS) {
        const reportRecipient = result.recipients.find((item) => item.maskedPhone === maskPhone(recipient.phone));
        if (!reportRecipient?.queueId) continue;
        const queueItem = latestQueueItem(finalSnapshot, reportRecipient.queueId);
        const status = String(queueItem?.status || reportRecipient.deliveryStatus || "unknown").toLowerCase();
        reportRecipient.deliveryStatus = status;
        if (status === "sent") result.sentCount += 1;
        if (status === "failed") result.failedCount += 1;
        if (status === "skipped") result.skippedCount += 1;
      }
    } else {
      addAction(result, "send_skipped", "Pesan canary tidak dikirim karena gate sebelum send belum aman.");
    }
  } finally {
    restoreRuntimeConfigFiles(configs);
    addAction(result, "restore_runtime_after_canary", "Runtime config dikembalikan ke state sebelum canary.");
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  finalSnapshot = await getRuntimeSnapshot();
  result.botEnabledFinal = finalSnapshot.botEnabled;
  result.queueAfter = finalSnapshot.queue;
  result.deadLetterActiveAfter = finalSnapshot.activeDeadLetters.length;
  result.summary.after = sanitizeValue({
    whatsappStatus: finalSnapshot.whatsappStatus,
    worker: finalSnapshot.worker,
    queue: finalSnapshot.queue,
    safeSendingWindow: finalSnapshot.safeSendingWindow,
    reminder: finalSnapshot.reminder,
  });

  if (result.sentCount !== CANARY_RECIPIENTS.length) {
    result.blockers.push({
      key: "canary_not_all_sent",
      label: "Canary tidak semua sent",
      detail: `${result.sentCount}/${CANARY_RECIPIENTS.length} sent.`,
    });
  }
  if (result.failedCount > 0) {
    result.blockers.push({ key: "canary_failed_messages", label: "Canary failed", detail: `${result.failedCount} pesan gagal.` });
  }
  if (result.duplicateCount > 0) {
    result.blockers.push({ key: "canary_duplicate", label: "Canary duplicate", detail: `${result.duplicateCount} duplicate.` });
  }
  if (result.outOfWhitelistRecipients > 0) {
    result.blockers.push({ key: "out_of_whitelist", label: "Penerima di luar whitelist", detail: `${result.outOfWhitelistRecipients} penerima di luar whitelist.` });
  }
  if (result.queueAfter.pending > 0 || result.queueAfter.processing > 0 || result.queueAfter.failed > 0) {
    result.blockers.push({
      key: "queue_not_clean_after_canary",
      label: "Queue tidak bersih setelah canary",
      detail: `pending=${result.queueAfter.pending}, processing=${result.queueAfter.processing}, failed=${result.queueAfter.failed}.`,
    });
  }
  if (result.deadLetterActiveAfter > 0) {
    result.blockers.push({ key: "dead_letter_after_canary", label: "Dead-letter setelah canary", detail: `${result.deadLetterActiveAfter} dead-letter aktif.` });
  }
  if (result.botEnabledFinal !== result.botEnabledBefore) {
    result.blockers.push({
      key: "bot_enabled_not_restored",
      label: "botEnabled tidak kembali",
      detail: `Final=${result.botEnabledFinal}, before=${result.botEnabledBefore}.`,
    });
  }

  result.overall = result.blockers.length > 0 ? "FAIL" : "PASS";
  writeReports(result);
  console.log(`Production canary: ${result.overall}. Report: ${REPORT_JSON}`);
  if (result.overall !== "PASS") process.exitCode = 1;
}

main().catch((error) => {
  const result = {
    generatedAt: new Date().toISOString(),
    overall: "FAIL",
    canaryExecuted: false,
    sentCount: 0,
    failedCount: 0,
    duplicateCount: 0,
    outOfWhitelistRecipients: 0,
    recipients: CANARY_RECIPIENTS.map((recipient) => ({
      name: recipient.name,
      role: recipient.role,
      maskedPhone: maskPhone(recipient.phone),
      deliveryStatus: "not_started",
    })),
    gateBeforeSend: [],
    queueAfter: {},
    deadLetterActiveAfter: 0,
    approvalPendingAfter: 0,
    blockers: [{ key: "canary_script_error", label: "Canary script error", detail: sanitizeError(error) }],
    warnings: [],
    actionsTaken: [{ action: "canary_error", detail: "Canary gagal sebelum selesai; cek laporan sanitized." }],
  };
  writeReports(result);
  console.log(`Production canary: FAIL. Report: ${REPORT_JSON}`);
  process.exitCode = 1;
});
