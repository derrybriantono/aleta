import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const SCRIPT_DIR = path.dirname(__filename);
const ROOT_DIR = path.resolve(SCRIPT_DIR, "..");
const PORTAL_DIR = path.join(ROOT_DIR, "manajemen_surat");
const BOT_DIR = path.join(ROOT_DIR, "aleta_bot");
const REPORT_DIR = path.join(ROOT_DIR, "reports");
const REPORT_JSON = path.join(REPORT_DIR, "aleta-whatsapp-limited-test-latest.json");
const REPORT_MD = path.join(REPORT_DIR, "aleta-whatsapp-limited-test-latest.md");
const PREFLIGHT_JSON = path.join(REPORT_DIR, "aleta-preflight-latest.json");
const SMOKE_JSON = path.join(REPORT_DIR, "aleta-smoke-dry-run-latest.json");

const PORTAL_BASE_URL = "http://127.0.0.1:3000";
const BOT_BASE_URL = "http://127.0.0.1:3003";
const RECIPIENT_NAME = "DERRY BRIANTONO";
const RECIPIENT_ROLE = "Hakim";
const RECIPIENT_PHONE = process.env.ALETA_TEST_RECIPIENT_PHONE || "";
const MASKED_PHONE = process.env.ALETA_TEST_RECIPIENT_MASKED || "628****0000";
const LIMITED_TEST_ID = "limited-whatsapp-test-2026-05-02-derry-briantono";
const LIMITED_TEST_IDEMPOTENCY_KEY = "limited-whatsapp-test:2026-05-02:derry-briantono";
const MESSAGE =
  "UJI COBA ALETA - pesan test internal untuk DERRY BRIANTONO (Hakim). Abaikan pesan ini.";

const portalEnv = loadEnvFiles([path.join(PORTAL_DIR, ".env"), path.join(PORTAL_DIR, ".env.local")]);
const botEnv = loadEnvFiles([path.join(BOT_DIR, ".env")]);

const result = {
  generatedAt: new Date().toISOString(),
  overall: "WARN",
  messageSent: false,
  messageEnqueued: false,
  recipient: {
    name: RECIPIENT_NAME,
    role: RECIPIENT_ROLE,
    maskedPhone: MASKED_PHONE,
  },
  sentCount: 0,
  enqueuedCount: 0,
  gateBeforeSend: [],
  queueAfterSend: {},
  deliveryHistory: {},
  deadLetterActiveAfterSend: null,
  approvalPendingAfterSend: null,
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

function addGate(key, label, status, detail, metadata = {}) {
  const entry = { key, label, status, detail, metadata };
  result.gateBeforeSend.push(entry);
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

function isSafePhone(value) {
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
    addGate("portal_db", "Portal database", "FAIL", `Koneksi database portal gagal: ${sanitizeError(error)}.`);
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
  if (!match) {
    return { found: false, detail: `Penerima internal ${MASKED_PHONE} tidak ditemukan pada user aktif.` };
  }
  const name = String(match.name || match.full_name || "").toUpperCase();
  const roleText = String(match.role || match.role_name || match.position || match.jabatan || "").toLowerCase();
  return {
    found: true,
    nameMatches: name.includes("DERRY") || name.includes("BRIANTONO"),
    roleLooksInternal: /hakim|admin|pegawai|panitera|ketua|sekretaris|jurusita/.test(roleText) || Boolean(match.role_id || match.position_id),
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
    fetchJson(`${BOT_BASE_URL}/internal/aleta-bot/queue?limit=30`, { headers: internalHeaders() }),
    fetchJson(`${BOT_BASE_URL}/internal/aleta-bot/queue/dead-letters?limit=100&status=active`, { headers: internalHeaders() }),
  ]);

  const statusData = statusResponse.data || {};
  const waData = waResponse.data || {};
  const diagnosticsData = diagnosticsResponse.data || {};
  const whatsapp = statusData.whatsapp || waData || {};
  const worker = statusData.worker || {};
  const queue = queueResponse.data?.stats || statusData.queue || {};
  const safeSendingWindow = statusData.bot?.sendingWindow || waData.sendingWindow || worker.sendingWindow || {};
  const aiRuntime = statusData.aiRuntime || null;

  return {
    rawStatusOk: statusResponse.ok,
    rawWaOk: waResponse.ok,
    rawDiagnosticsOk: diagnosticsResponse.ok,
    rawQueueOk: queueResponse.ok,
    whatsappStatus: normalizeStatus(whatsapp.status || diagnosticsData.status),
    initializing: Boolean(whatsapp.initializing ?? diagnosticsData.initializing),
    hasClient: Boolean(whatsapp.hasClient ?? diagnosticsData.hasClient),
    hasQr: Boolean(whatsapp.qrAvailable ?? whatsapp.hasQr ?? diagnosticsData.hasQr),
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
    botEnabled: Boolean(statusData.bot?.enabled ?? statusData.bot?.botEnabled ?? statusData.botEnabled),
    aiRuntime: aiRuntime
      ? {
          status: aiRuntime.status || aiRuntime.lastSyncStatus || "unknown",
          provider: aiRuntime.provider || aiRuntime.providerId || "",
          publicQaEnabled: Boolean(aiRuntime.publicQaEnabled),
        }
      : null,
    sanitizedRuntime: sanitizeValue({
      status: statusData,
      whatsapp: waData,
      diagnostics: diagnosticsData,
      queue: queueResponse.data,
      deadLetters: activeDeadLettersResponse.data,
    }),
  };
}

function latestQueueItem(snapshot, queueId) {
  return (snapshot.queueItems || []).find((item) => item.id === queueId) || null;
}

async function pollQueueItem(queueId, maxWaitMs = 70000) {
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

async function sendLimitedMessage() {
  const response = await fetchJson(`${BOT_BASE_URL}/internal/aleta-bot/messages/enqueue`, {
    method: "POST",
    headers: internalHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({
      sourceApp: "aleta_pilot",
      sourceFeature: "limited_whatsapp_test",
      entityType: "pilot_test",
      entityId: LIMITED_TEST_ID,
      recipientNumber: RECIPIENT_PHONE,
      recipientName: RECIPIENT_NAME,
      message: MESSAGE,
      category: "employee",
      priority: 1,
      dryRun: false,
      idempotencyKey: LIMITED_TEST_IDEMPOTENCY_KEY,
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

function evaluateOutcome(before, after, sendResult, deliveryItem) {
  const deliveryStatus = normalizeStatus(deliveryItem?.status || sendResult?.queueStatus);
  const deadLetterActive = Number(after.activeDeadLetters?.length || 0);
  const approvalPending = Number(result.approvalPendingAfterSend || 0);
  result.deadLetterActiveAfterSend = deadLetterActive;
  result.queueAfterSend = {
    pending: after.queue.pending,
    processing: after.queue.processing,
    failed: after.queue.failed,
    sent: after.queue.sent,
    deadLetter: after.queue.deadLetter,
    activeDeadLetters: deadLetterActive,
  };
  result.deliveryHistory = {
    queueId: sendResult?.queueId || null,
    status: deliveryItem?.status || sendResult?.queueStatus || "unknown",
    recipient: MASKED_PHONE,
    source: "aleta_bot_queue_public",
    waitedMs: sendResult?.waitedMs || 0,
  };

  if (sendResult?.ok) {
    result.messageEnqueued = true;
    result.enqueuedCount = 1;
    result.messageSent = deliveryStatus === "sent";
    result.sentCount = deliveryStatus === "sent" ? 1 : 0;
    addAction(
      sendResult.duplicate ? "send_skipped_duplicate_idempotency" : "send_limited_internal_test",
      sendResult.duplicate
        ? `Idempotency key uji terbatas sudah ada; tidak membuat enqueue baru untuk ${MASKED_PHONE}.`
        : `Satu pesan test internal dimasukkan ke queue resmi ALETA Bot untuk ${MASKED_PHONE}.`,
      { queueId: sendResult.queueId, duplicate: Boolean(sendResult.duplicate) }
    );
  }

  if (deadLetterActive > 0) {
    result.blockers.push({
      key: "dead_letter_after_send",
      label: "Dead-letter setelah uji",
      detail: `${deadLetterActive} dead-letter aktif setelah uji.`,
    });
  }
  if (after.queue.failed > before.queue.failed) {
    result.blockers.push({
      key: "queue_failed_after_send",
      label: "Queue failed bertambah",
      detail: `Queue failed naik dari ${before.queue.failed} ke ${after.queue.failed}.`,
    });
  }
  if (approvalPending > 0) {
    result.warnings.push({
      key: "approval_pending_after_send",
      label: "Approval pending setelah uji",
      detail: `${approvalPending} approval pending setelah uji.`,
    });
  }

  if (sendResult?.ok && deliveryStatus === "sent" && result.blockers.length === 0) {
    result.overall = "PASS";
    return;
  }
  if (sendResult?.ok && deliveryStatus === "skipped" && result.blockers.length === 0) {
    result.overall = "WARN";
    result.warnings.push({
      key: "delivery_skipped",
      label: "Pesan uji tidak terkirim",
      detail: "Queue item diproses tetapi ditandai skipped oleh runtime. Tidak ada retry otomatis.",
    });
    return;
  }
  if (sendResult?.ok && ["pending", "processing", "unknown"].includes(deliveryStatus) && result.blockers.length === 0) {
    result.overall = "WARN";
    result.warnings.push({
      key: "delivery_not_final",
      label: "Status delivery belum final",
      detail: `Pesan sudah masuk queue, tetapi status terakhir ${deliveryStatus}. Tidak ada retry otomatis.`,
    });
    return;
  }
  result.overall = result.blockers.length > 0 ? "FAIL" : "WARN";
}

function writeReports() {
  mkdirSync(REPORT_DIR, { recursive: true });
  const safeResult = sanitizeValue(result);
  if (containsSensitivePayload(safeResult)) {
    throw new Error("Report sanitization failed: sensitive payload detected.");
  }
  writeFileSync(REPORT_JSON, `${JSON.stringify(safeResult, null, 2)}\n`, "utf8");
  const md = [
    "# ALETA WhatsApp Limited Internal Test",
    "",
    `Generated at: ${safeResult.generatedAt}`,
    "",
    `Overall: ${safeResult.overall}`,
    `Message sent: ${safeResult.messageSent ? "yes" : "no"}`,
    `Message enqueued: ${safeResult.messageEnqueued ? "yes" : "no"}`,
    `Sent count: ${safeResult.sentCount}`,
    `Enqueued count in this run: ${safeResult.enqueuedCount}`,
    `Recipient: ${RECIPIENT_NAME} (${RECIPIENT_ROLE}), ${MASKED_PHONE}`,
    "",
    "## Gate Sebelum Kirim",
    ...safeResult.gateBeforeSend.map((gate) => `- ${gate.status} - ${gate.label}: ${gate.detail}`),
    "",
    "## Status Setelah Uji",
    `- WhatsApp: ${safeResult.summary?.after?.whatsappStatus ?? "-"}`,
    `- Worker: enabled=${safeResult.summary?.after?.worker?.enabled ?? "-"}, activeTimer=${safeResult.summary?.after?.worker?.activeTimer ?? "-"}, paused=${safeResult.summary?.after?.worker?.paused ?? "-"}`,
    `- Queue: pending=${safeResult.queueAfterSend.pending ?? "-"}, processing=${safeResult.queueAfterSend.processing ?? "-"}, failed=${safeResult.queueAfterSend.failed ?? "-"}, sent=${safeResult.queueAfterSend.sent ?? "-"}`,
    `- Dead-letter aktif: ${safeResult.deadLetterActiveAfterSend ?? "-"}`,
    `- Approval pending: ${safeResult.approvalPendingAfterSend ?? "-"}`,
    `- Delivery: ${safeResult.deliveryHistory.status ?? "unknown"} (${safeResult.deliveryHistory.queueId ?? "no-queue-id"})`,
    "",
    "## Actions Taken",
    ...(safeResult.actionsTaken.length
      ? safeResult.actionsTaken.map((action) => `- ${action.action}: ${action.detail}`)
      : ["- Tidak ada pengiriman dilakukan."]),
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
    "- Tidak ada resend dead-letter.",
    "- Tidak ada scheduler/reminder production yang diaktifkan.",
    "- Tidak ada scan QR, logout/reset session, atau perubahan session.",
  ].join("\n");
  if (containsSensitivePayload(md)) {
    throw new Error("Markdown report sanitization failed: sensitive payload detected.");
  }
  writeFileSync(REPORT_MD, `${md}\n`, "utf8");
}

async function main() {
  const preflight = readJsonFile(PREFLIGHT_JSON);
  const smoke = readJsonFile(SMOKE_JSON);
  const pool = await openPortalDb();
  const before = await getRuntimeSnapshot();
  const recipient = await findInternalRecipient(pool);
  const approvalPendingBefore = await countPendingApprovals(pool);

  result.summary.before = sanitizeValue({
    whatsappStatus: before.whatsappStatus,
    worker: before.worker,
    queue: before.queue,
    activeDeadLetters: before.activeDeadLetters.length,
    safeSendingWindow: before.safeSendingWindow,
    aiRuntime: before.aiRuntime,
    approvalPending: approvalPendingBefore,
  });

  addGate(
    "preflight_latest",
    "Preflight terakhir",
    preflight && preflight.overall !== "FAIL" && preflight.safeToRunSmokeTest ? "PASS" : "FAIL",
    preflight
      ? `overall=${preflight.overall}, safeToRunSmokeTest=${Boolean(preflight.safeToRunSmokeTest)}.`
      : "Laporan preflight belum tersedia."
  );
  addGate(
    "smoke_latest",
    "Smoke dry-run terakhir",
    smoke && smoke.overall === "PASS" && smoke.safeForLimitedWhatsAppPilot ? "PASS" : "FAIL",
    smoke
      ? `overall=${smoke.overall}, safeForLimitedWhatsAppPilot=${Boolean(smoke.safeForLimitedWhatsAppPilot)}.`
      : "Laporan smoke dry-run belum tersedia."
  );
  addGate(
    "runtime_reachable",
    "Runtime ALETA Bot reachable",
    before.rawStatusOk && before.rawWaOk && before.rawDiagnosticsOk && before.rawQueueOk ? "PASS" : "FAIL",
    "Status, WhatsApp, diagnostics, dan queue runtime dibaca sebelum uji."
  );
  addGate(
    "whatsapp_connected",
    "WhatsApp runtime connected",
    before.whatsappStatus === "connected" ? "PASS" : "FAIL",
    `status=${before.whatsappStatus}.`
  );
  addGate(
    "whatsapp_no_lock_or_stuck",
    "WhatsApp tidak terkunci/stuck",
    before.lastErrorType === "browser_locked" || before.lastErrorType === "initialize_timeout" || before.initializeAgeMs > 120000
      ? "FAIL"
      : "PASS",
    `lastErrorType=${before.lastErrorType || "-"}, initializing=${before.initializing}, initializeAgeMs=${before.initializeAgeMs}.`
  );
  addGate(
    "worker_operational",
    "Worker operasional",
    before.worker.enabled && before.worker.activeTimer && !before.worker.paused ? "PASS" : "FAIL",
    `enabled=${before.worker.enabled}, activeTimer=${before.worker.activeTimer}, paused=${before.worker.paused}, running=${before.worker.running}.`
  );
  addGate(
    "queue_empty_before_send",
    "Queue kosong sebelum uji",
    before.queue.pending === 0 && before.queue.processing === 0 && before.queue.failed === 0 ? "PASS" : "FAIL",
    `pending=${before.queue.pending}, processing=${before.queue.processing}, failed=${before.queue.failed}.`
  );
  addGate(
    "dead_letter_active_zero",
    "Dead-letter aktif",
    before.activeDeadLetters.length === 0 ? "PASS" : "FAIL",
    `${before.activeDeadLetters.length} dead-letter aktif.`
  );
  addGate(
    "approval_pending_zero",
    "Approval pending",
    approvalPendingBefore === 0 ? "PASS" : "FAIL",
    `${approvalPendingBefore} approval pending sebelum uji.`
  );
  addGate(
    "target_internal_valid",
    "Nomor tujuan internal valid",
    isSafePhone(RECIPIENT_PHONE) && recipient.found ? "PASS" : "FAIL",
    recipient.detail
  );
  if (recipient.found && !recipient.nameMatches) {
    addGate(
      "target_name_match",
      "Nama tujuan sesuai",
      "WARN",
      "Nomor ditemukan, tetapi nama DB tidak bisa dipastikan sama persis. Target tetap dibatasi ke satu nomor eksplisit."
    );
  }
  addGate(
    "safe_window_allowed",
    "Safe Sending Window allowed",
    before.safeSendingWindow.enabled && before.safeSendingWindow.allowed ? "PASS" : "FAIL",
    `enabled=${before.safeSendingWindow.enabled}, ${before.safeSendingWindow.start}-${before.safeSendingWindow.end}, allowed=${before.safeSendingWindow.allowed}.`
  );
  const reminder = smoke?.summary?.reminder || preflight?.summary?.reminder || {};
  addGate(
    "reminder_scheduler_safe",
    "Reminder/scheduler production tidak aktif",
    reminder.mode !== "production" &&
      reminder.schedulerMode !== "production" &&
      reminder.enabled !== true &&
      reminder.schedulerEnabled !== true
      ? "PASS"
      : "FAIL",
    `mode=${reminder.mode ?? "-"}, enabled=${Boolean(reminder.enabled)}, scheduler=${Boolean(reminder.schedulerEnabled)}/${reminder.schedulerMode ?? "-"}.`
  );
  addGate(
    "bot_enabled",
    "Global bot notification switch",
    before.botEnabled ? "PASS" : "WARN",
    before.botEnabled
      ? "botEnabled=true."
      : "botEnabled=false; uji tetap dibatasi ke satu pesan internal eksplisit melalui queue manual, bukan scheduler/notifikasi production."
  );
  addGate(
    "ai_bridge_observed",
    "AI Bridge dicatat tanpa provider call",
    "PASS",
    `status=${before.aiRuntime?.status || "unknown"}. Pesan test memakai teks statis non-AI.`
  );

  if (result.blockers.length > 0) {
    addAction("send_skipped", "Pesan tidak dikirim karena gate wajib belum aman.");
    const after = await getRuntimeSnapshot();
    result.summary.after = sanitizeValue({
      whatsappStatus: after.whatsappStatus,
      worker: after.worker,
      queue: after.queue,
      activeDeadLetters: after.activeDeadLetters.length,
      safeSendingWindow: after.safeSendingWindow,
      aiRuntime: after.aiRuntime,
    });
    result.queueAfterSend = {
      pending: after.queue.pending,
      processing: after.queue.processing,
      failed: after.queue.failed,
      sent: after.queue.sent,
      deadLetter: after.queue.deadLetter,
      activeDeadLetters: after.activeDeadLetters.length,
    };
    result.deadLetterActiveAfterSend = after.activeDeadLetters.length;
    result.approvalPendingAfterSend = approvalPendingBefore;
    result.overall = "FAIL";
    await pool?.end();
    writeReports();
    console.log(`ALETA WhatsApp limited test ${result.overall}. Report: ${REPORT_MD}`);
    return;
  }

  const sendResult = await sendLimitedMessage();
  if (!sendResult.ok) {
    result.blockers.push({
      key: "limited_send_failed",
      label: "Pengiriman uji gagal",
      detail: sendResult.error || "Endpoint test tidak menerima enqueue.",
    });
    addAction("send_attempt_failed_once", "Satu percobaan pengiriman dilakukan dan tidak diulang otomatis.");
    const after = await getRuntimeSnapshot();
    result.summary.after = sanitizeValue({
      whatsappStatus: after.whatsappStatus,
      worker: after.worker,
      queue: after.queue,
      activeDeadLetters: after.activeDeadLetters.length,
      safeSendingWindow: after.safeSendingWindow,
      aiRuntime: after.aiRuntime,
    });
    result.queueAfterSend = {
      pending: after.queue.pending,
      processing: after.queue.processing,
      failed: after.queue.failed,
      sent: after.queue.sent,
      deadLetter: after.queue.deadLetter,
      activeDeadLetters: after.activeDeadLetters.length,
    };
    result.deadLetterActiveAfterSend = after.activeDeadLetters.length;
    result.approvalPendingAfterSend = await countPendingApprovals(pool);
    result.overall = "FAIL";
    await pool?.end();
    writeReports();
    console.log(`ALETA WhatsApp limited test ${result.overall}. Report: ${REPORT_MD}`);
    return;
  }

  const pollResult = await pollQueueItem(sendResult.queueId);
  const after = pollResult.snapshot || (await getRuntimeSnapshot());
  const deliveryItem = pollResult.item || latestQueueItem(after, sendResult.queueId);
  result.approvalPendingAfterSend = await countPendingApprovals(pool);
  evaluateOutcome(before, after, { ...sendResult, waitedMs: pollResult.waitedMs }, deliveryItem);
  result.summary.after = sanitizeValue({
    whatsappStatus: after.whatsappStatus,
    worker: after.worker,
    queue: after.queue,
    activeDeadLetters: after.activeDeadLetters.length,
    safeSendingWindow: after.safeSendingWindow,
    aiRuntime: after.aiRuntime,
    approvalPending: result.approvalPendingAfterSend,
  });
  await pool?.end();
  writeReports();
  console.log(`ALETA WhatsApp limited test ${result.overall}. Report: ${REPORT_MD}`);
}

main().catch((error) => {
  result.overall = "FAIL";
  result.blockers.push({
    key: "runner_crashed",
    label: "Runner gagal",
    detail: sanitizeError(error),
  });
  try {
    writeReports();
  } catch {
    // Last resort: avoid printing secrets and keep the failure visible.
  }
  console.error(`ALETA WhatsApp limited test failed: ${sanitizeError(error)}`);
  process.exitCode = 1;
});
