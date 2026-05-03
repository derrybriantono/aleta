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
const REPORT_JSON = path.join(REPORT_DIR, "aleta-smoke-dry-run-latest.json");
const REPORT_MD = path.join(REPORT_DIR, "aleta-smoke-dry-run-latest.md");

const PORTAL_BASE_URL = "http://127.0.0.1:3000";
const BOT_BASE_URL = "http://127.0.0.1:3003";
const PHASE4_DEAD_LETTER_MESSAGE = "Phase 4 dead-letter validation only. Do not send.";
const PHASE4_DEAD_LETTER_ERROR = "Phase 4 simulated failure";
const PHASE4_APPROVAL_NAME = "Phase 4 Approval Validate";

const portalEnv = loadEnvFiles([path.join(PORTAL_DIR, ".env"), path.join(PORTAL_DIR, ".env.local")]);
const botEnv = loadEnvFiles([path.join(BOT_DIR, ".env")]);

const result = {
  generatedAt: new Date().toISOString(),
  overall: "WARN",
  safeForNonWaPilot: false,
  safeForLimitedWhatsAppPilot: false,
  safeForProduction: false,
  checks: [],
  blockers: [],
  warnings: [],
  actionsTaken: [],
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

function addCheck(key, label, status, detail, metadata = {}) {
  const entry = { key, label, status, detail, metadata };
  result.checks.push(entry);
  if (status === "FAIL") result.blockers.push({ key, label, detail });
  if (status === "WARN") result.warnings.push({ key, label, detail });
  return entry;
}

function addAction(action, detail, metadata = {}) {
  const entry = { action, detail, metadata };
  result.actionsTaken.push(entry);
  return entry;
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 8000);
  try {
    const response = await fetch(url, {
      method: options.method ?? "GET",
      headers: options.headers,
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

async function fetchJsonWithRetry(url, options = {}, attempts = 2) {
  let last = null;
  for (let index = 0; index < attempts; index += 1) {
    last = await fetchJson(url, options);
    if (last.ok || last.status > 0) return last;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return last;
}

function sanitizeError(error) {
  return String(error?.message ?? error ?? "unknown_error")
    .replace(/[A-Za-z]:\\[^\s"'<>]+/g, "[path]")
    .replace(/(token|password|api[_-]?key)=([^&\s]+)/gi, "$1=[redacted]")
    .slice(0, 300);
}

function normalizeStatus(value) {
  return String(value ?? "unknown").toLowerCase();
}

function normalizeWhatsappNumber(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("62")) return digits;
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  if (digits.startsWith("8")) return `62${digits}`;
  return digits;
}

function isValidWhatsappNumber(value) {
  return /^62\d{8,15}$/.test(normalizeWhatsappNumber(value));
}

function hasKeyDeep(value, keyName) {
  if (!value || typeof value !== "object") return false;
  if (Object.prototype.hasOwnProperty.call(value, keyName)) return true;
  return Object.values(value).some((child) => hasKeyDeep(child, keyName));
}

function containsSensitivePayload(value) {
  const safeSecretIndicatorKeys = new Set([
    "apikeyconfigured",
    "apikeymasked",
    "apikeyenvkey",
    "maxtokens",
    "input_tokens",
    "output_tokens",
    "passwordenvkey",
    "passwordsource",
    "fallbackpasswordenvkey",
    "passwordconfigured",
    "secretavailable",
    "secretsource",
  ]);

  const walk = (current, key = "") => {
    const normalizedKey = key.toLowerCase();
    if (current === null || current === undefined) return false;
    if (typeof current === "string") {
      if (/\.wwebjs_auth|session-[a-z0-9_-]+|userdataDir/i.test(current)) return true;
      if (/^data:image\/|^2@[A-Za-z0-9+/=]{100,}/.test(current)) return true;
      if (safeSecretIndicatorKeys.has(normalizedKey)) return false;
      if (/(token|api_?key|password|secret|stack)/i.test(normalizedKey)) {
        return Boolean(current && !/^\[?(configured|masked|redacted|hidden|available|env|none|null|true|false)?\]?$/i.test(current));
      }
      return false;
    }
    if (typeof current !== "object") return false;
    for (const [childKey, childValue] of Object.entries(current)) {
      const childKeyLower = childKey.toLowerCase();
      if (["lastqrstring", "qrstring", "rawqr", "sessionpath", "stack"].includes(childKeyLower) && childValue) {
        return true;
      }
      if (walk(childValue, childKey)) return true;
    }
    return false;
  };

  return walk(value);
}

function exactPhase4DeadLetter(item = {}) {
  const preview = String(item.messagePreview ?? item.message ?? item.message_body ?? "");
  const error = String(item.lastError ?? item.error ?? item.last_error ?? "");
  const title = String(item.title ?? item.name ?? item.notificationKey ?? item.notification_key ?? "");
  return (
    title.includes("Phase 4 Validation") ||
    (preview.includes(PHASE4_DEAD_LETTER_MESSAGE) && error.includes(PHASE4_DEAD_LETTER_ERROR))
  );
}

async function openPortalDb() {
  const databaseUrl = portalEnv.DATABASE_URL;
  if (!databaseUrl) {
    addCheck("portal_db_config", "Portal DB config", "WARN", "DATABASE_URL tidak ditemukan untuk smoke DB langsung.");
    return null;
  }
  try {
    const portalRequire = createRequire(path.join(PORTAL_DIR, "package.json"));
    const { Pool } = portalRequire("pg");
    const pool = new Pool({ connectionString: databaseUrl });
    await pool.query("SELECT 1");
    addCheck("portal_db", "Portal database", "PASS", "Koneksi database portal berhasil.");
    return pool;
  } catch (error) {
    addCheck("portal_db", "Portal database", "FAIL", `Koneksi database portal gagal: ${sanitizeError(error)}.`);
    return null;
  }
}

async function query(pool, sql, params = []) {
  if (!pool) return { rows: [] };
  try {
    return await pool.query(sql, params);
  } catch (error) {
    addCheck("db_query_warning", "DB query optional", "WARN", `Query optional gagal: ${sanitizeError(error)}.`);
    return { rows: [] };
  }
}

function summarizeRuntime(statusData, waData, diagnosticsData) {
  const whatsapp = statusData?.whatsapp ?? waData ?? {};
  const diagnostics = diagnosticsData ?? {};
  const aiRuntime = statusData?.aiRuntime
    ? {
        status: statusData.aiRuntime.status ?? statusData.aiRuntime.lastSyncStatus ?? "unknown",
        provider: statusData.aiRuntime.provider ?? statusData.aiRuntime.providerId ?? "",
        model: statusData.aiRuntime.model ?? statusData.aiRuntime.modelId ?? "",
        publicQaEnabled: Boolean(statusData.aiRuntime.publicQaEnabled),
        publicQaAiAnswerEnabled: Boolean(statusData.aiRuntime.publicQaAiAnswerEnabled),
      }
    : null;
  return {
    whatsappStatus: normalizeStatus(whatsapp.status ?? diagnostics.status),
    initializing: Boolean(whatsapp.initializing ?? diagnostics.initializing),
    hasClient: Boolean(whatsapp.hasClient ?? diagnostics.hasClient),
    hasQr: Boolean(whatsapp.qrAvailable ?? whatsapp.hasQr ?? diagnostics.hasQr),
    lastErrorType: whatsapp.lastErrorType ?? diagnostics.lastErrorType ?? "",
    sessionName: diagnostics.sessionName ?? whatsapp.sessionName ?? null,
    authPathConfigured: Boolean(diagnostics.authPathConfigured),
    initializeAgeMs: Number(whatsapp.initializeAgeMs ?? diagnostics.initializeAgeMs ?? 0),
    worker: statusData?.worker ?? null,
    queue: statusData?.queue ?? null,
    safeSendingWindow: statusData?.bot?.sendingWindow ?? null,
    aiRuntime,
    registry: statusData?.registry
      ? {
          active: Number(statusData.registry.active ?? 0),
          dryRun: Number(statusData.registry.dryRun ?? 0),
          requiresApproval: Number(statusData.registry.requiresApproval ?? 0),
          skippedPolicy: Number(statusData.registry.skippedPolicy ?? 0),
        }
      : null,
  };
}

async function checkRuntime() {
  const portalRoot = await fetchJsonWithRetry(PORTAL_BASE_URL, { timeoutMs: 30000 }, 2);
  addCheck(
    "portal_reachable",
    "Portal reachable",
    portalRoot.ok ? "PASS" : "FAIL",
    portalRoot.ok ? `Portal HTTP ${portalRoot.status}.` : `Portal tidak reachable: ${portalRoot.error ?? portalRoot.status}.`
  );

  const botStatus = await fetchJson(`${BOT_BASE_URL}/internal/aleta-bot/status`, { headers: internalHeaders() });
  const waStatus = await fetchJson(`${BOT_BASE_URL}/internal/aleta-bot/whatsapp/status`, { headers: internalHeaders() });
  const diagnostics = await fetchJson(`${BOT_BASE_URL}/internal/aleta-bot/whatsapp/diagnostics`, { headers: internalHeaders() });

  addCheck(
    "bot_reachable",
    "ALETA Bot reachable",
    botStatus.ok ? "PASS" : "FAIL",
    botStatus.ok ? "Runtime ALETA Bot reachable." : `Runtime ALETA Bot tidak reachable: ${botStatus.error ?? botStatus.status}.`
  );
  addCheck(
    "whatsapp_status_endpoint",
    "WhatsApp status endpoint",
    waStatus.ok ? "PASS" : "FAIL",
    waStatus.ok ? "Endpoint status WhatsApp reachable." : `Endpoint status WhatsApp gagal: ${waStatus.error ?? waStatus.status}.`
  );
  addCheck(
    "whatsapp_diagnostics_endpoint",
    "WhatsApp diagnostics endpoint",
    diagnostics.ok ? "PASS" : "FAIL",
    diagnostics.ok ? "Endpoint diagnostics WhatsApp reachable." : `Endpoint diagnostics gagal: ${diagnostics.error ?? diagnostics.status}.`
  );

  addCheck(
    "runtime_response_sanitized",
    "Sanitasi response runtime",
    containsSensitivePayload(botStatus.data) || containsSensitivePayload(waStatus.data) || containsSensitivePayload(diagnostics.data) ? "FAIL" : "PASS",
    "Smoke runner tidak menemukan token, QR raw, path session, stack trace, atau API key pada response runtime."
  );

  result.summary.runtime = summarizeRuntime(botStatus.data, waStatus.data, diagnostics.data);
}

function checkWhatsapp() {
  const rt = result.summary.runtime ?? {};
  const status = normalizeStatus(rt.whatsappStatus);
  if (status === "connected" || status === "ready") {
    addCheck("whatsapp_runtime", "WhatsApp Gateway", "PASS", "WhatsApp connected.");
  } else if (status === "browser_locked" || rt.lastErrorType === "browser_locked") {
    addCheck("whatsapp_runtime", "WhatsApp Gateway", "FAIL", "Session WhatsApp terkunci proses browser lain.");
  } else if (status === "initialize_timeout") {
    addCheck("whatsapp_runtime", "WhatsApp Gateway", "FAIL", "Inisialisasi WhatsApp timeout tanpa QR/ready.");
  } else if (status === "initializing" && !rt.hasQr && rt.initializing === false) {
    addCheck("whatsapp_runtime", "WhatsApp Gateway", "FAIL", "Status initializing tetapi runtime tidak memiliki proses initialize aktif atau QR.");
  } else if (status === "qr_needed") {
    addCheck("whatsapp_runtime", "WhatsApp Gateway", "WARN", `WhatsApp membutuhkan QR. qrAvailable=${rt.hasQr}. Smoke tidak scan QR.`);
  } else {
    addCheck("whatsapp_runtime", "WhatsApp Gateway", "WARN", `WhatsApp belum connected: ${status}.`);
  }
}

async function checkPortalProxyAndApps() {
  const checks = [
    ["portal_whatsapp_status", `${PORTAL_BASE_URL}/api/whatsapp/status`],
    ["portal_whatsapp_qr", `${PORTAL_BASE_URL}/api/whatsapp/qr`],
    ["portal_tasks", `${PORTAL_BASE_URL}/api/tasks`],
    ["portal_kpi", `${PORTAL_BASE_URL}/api/stats/kpi`],
    ["portal_sla", `${PORTAL_BASE_URL}/api/stats/surat/sla`],
    ["portal_disposisi_stats", `${PORTAL_BASE_URL}/api/stats/disposisi`],
  ];

  for (const [key, url] of checks) {
    const response = await fetchJson(url);
    const status = response.ok || response.status === 401 ? "PASS" : "WARN";
    const detail = response.ok
      ? `Endpoint readable HTTP ${response.status}.`
      : response.status === 401
      ? `Endpoint HTTP 401; auth guard aktif dan tidak dilonggarkan.`
      : `Endpoint belum readable dari runner: ${response.error ?? `HTTP ${response.status}`}.`;
    addCheck(key, url.replace(PORTAL_BASE_URL, ""), status, detail);
    if ((key === "portal_whatsapp_status" || key === "portal_whatsapp_qr") && response.data && hasKeyDeep(response.data, "lastQrString")) {
      addCheck(`${key}_qr_leak`, `${key} QR leak`, "FAIL", "Endpoint portal membocorkan lastQrString.");
    }
  }
}

function checkWorkerAndSafeWindow() {
  const rt = result.summary.runtime ?? {};
  const worker = rt.worker ?? {};
  const activeTimer = Boolean(worker.activeTimer);
  const paused = Boolean(worker.paused);
  const enabled = Boolean(worker.enabled);
  addCheck(
    "worker_operational",
    "Worker antrean",
    enabled && activeTimer && !paused ? "PASS" : "FAIL",
    `enabled=${enabled}, activeTimer=${activeTimer}, paused=${paused}, running=${Boolean(worker.running)}.`
  );
  result.summary.worker = {
    enabled,
    activeTimer,
    paused,
    running: Boolean(worker.running),
    intervalMs: worker.intervalMs ?? null,
    batchSize: worker.batchSize ?? null,
  };

  const safeWindow = rt.safeSendingWindow ?? worker.sendingWindow ?? {};
  const start = safeWindow.start ?? safeWindow.startTime;
  const end = safeWindow.end ?? safeWindow.endTime;
  const enabledWindow = safeWindow.enabled !== false;
  addCheck(
    "safe_sending_window",
    "Safe Sending Window",
    enabledWindow && Boolean(start) && Boolean(end) ? "PASS" : "FAIL",
    enabledWindow && start && end
      ? `enabled ${start}-${end}; insideWindow=${Boolean(safeWindow.insideWindow ?? safeWindow.inside)}, allowed=${Boolean(safeWindow.allowed ?? safeWindow.isAllowed)}.`
      : "Safe Sending Window belum terbaca/sinkron."
  );
  result.summary.safeSendingWindow = safeWindow;
}

async function checkQueue() {
  const activeDeadLetters = await fetchJson(`${BOT_BASE_URL}/internal/aleta-bot/queue/dead-letters?limit=100&status=active`, {
    headers: internalHeaders(),
  });
  const resolvedDeadLetters = await fetchJson(`${BOT_BASE_URL}/internal/aleta-bot/queue/dead-letters?limit=100&status=resolved`, {
    headers: internalHeaders(),
  });
  const queueEndpoint = await fetchJson(`${BOT_BASE_URL}/internal/aleta-bot/queue?limit=10`, {
    headers: internalHeaders(),
  });

  const activeItems = activeDeadLetters.data?.items ?? [];
  const activeCount = Number(activeDeadLetters.data?.total ?? activeItems.length ?? 0);
  const resolvedCount = Number(resolvedDeadLetters.data?.total ?? 0);
  const phase4Active = activeItems.filter(exactPhase4DeadLetter).length;
  const queueStats = queueEndpoint.data?.stats ?? result.summary.runtime?.queue ?? {};
  const pending = Number(queueStats.pending ?? 0);
  const processing = Number(queueStats.processing ?? 0);
  const failed = Number(queueStats.failed ?? activeCount);

  addCheck(
    "dead_letters_active",
    "Dead-letter aktif",
    activeCount === 0 ? "PASS" : "FAIL",
    `${activeCount} dead-letter aktif. ${resolvedCount} sudah ditangani.`
  );
  addCheck(
    "phase4_dead_letter_active",
    "Artefak dead-letter Phase 4",
    phase4Active === 0 ? "PASS" : "FAIL",
    phase4Active === 0 ? "Tidak ada dead-letter Phase 4 aktif." : `${phase4Active} artefak Phase 4 masih aktif.`
  );
  addCheck(
    "queue_health",
    "Queue health",
    failed > 0 ? "FAIL" : pending > 0 || processing > 0 ? "WARN" : "PASS",
    `pending=${pending}, processing=${processing}, failed=${failed}.`
  );
  result.summary.queue = {
    pending,
    processing,
    failed,
    resolved: Number(queueStats.resolved ?? resolvedCount),
    dryRun: Number(queueStats.dry_run ?? 0),
    activeDeadLetters: activeCount,
    resolvedDeadLetters: resolvedCount,
    phase4Active,
  };
}

async function checkPortalDb() {
  const pool = await openPortalDb();
  if (!pool) return;
  try {
    const users = await query(
      pool,
      `SELECT id, name, role_id, position_id, whatsapp_number
       FROM users
       WHERE deleted_at IS NULL AND is_active = 1`
    );
    const userRows = users.rows ?? [];
    const complete = userRows.filter((user) => isValidWhatsappNumber(user.whatsapp_number)).length;
    const missing = Math.max(0, userRows.length - complete);
    const importantRoles = new Set(["super-admin", "admin", "ketua", "wakil-ketua", "hakim", "panitera", "sekretaris"]);
    const priorityMissing = userRows.filter(
      (user) => importantRoles.has(String(user.role_id)) && !isValidWhatsappNumber(user.whatsapp_number)
    ).length;
    result.summary.whatsappNumbers = { total: userRows.length, complete, missing, priorityMissing };
    addCheck(
      "whatsapp_number_completeness",
      "Kelengkapan nomor WhatsApp pegawai",
      missing === 0 ? "PASS" : priorityMissing > 0 ? "FAIL" : "WARN",
      `${complete}/${userRows.length} pegawai punya nomor WhatsApp. Missing=${missing}, priorityMissing=${priorityMissing}.`
    );

    const pendingApproval = await query(pool, `SELECT COUNT(*)::int AS count FROM aleta_bot_approval_requests WHERE status = 'pending'`);
    const pendingCount = Number(pendingApproval.rows?.[0]?.count ?? 0);
    result.summary.approvals = { pending: pendingCount };
    addCheck(
      "approval_pending",
      "Approval pending",
      pendingCount === 0 ? "PASS" : "FAIL",
      `${pendingCount} approval masih pending.`
    );

    const phase4Approval = await query(
      pool,
      `SELECT COUNT(*)::int AS count
       FROM aleta_bot_approval_requests
       WHERE entity_name = $1 AND status = 'pending'`,
      [PHASE4_APPROVAL_NAME]
    );
    const pendingPhase4 = Number(phase4Approval.rows?.[0]?.count ?? 0);
    addCheck(
      "phase4_approval_pending",
      "Approval Phase 4 pending",
      pendingPhase4 === 0 ? "PASS" : "FAIL",
      pendingPhase4 === 0 ? "Tidak ada approval Phase 4 pending." : `${pendingPhase4} approval Phase 4 masih pending.`
    );

    const settings = await query(pool, `SELECT * FROM aleta_bot_settings WHERE id = 1 LIMIT 1`);
    const settingsRow = settings.rows?.[0] ?? {};
    const mode = settingsRow.disposition_deadline_reminder_mode ?? "unknown";
    const schedulerMode = settingsRow.disposition_deadline_reminder_scheduler_mode ?? "unknown";
    const enabled = Boolean(Number(settingsRow.disposition_deadline_reminder_enabled ?? 0));
    const schedulerEnabled = Boolean(Number(settingsRow.disposition_deadline_reminder_scheduler_enabled ?? 0));
    const killSwitch = Boolean(Number(settingsRow.disposition_deadline_reminder_kill_switch ?? 0));
    const approved = Boolean(settingsRow.disposition_deadline_reminder_approved_at);
    const productionActive = enabled && mode === "production";
    const schedulerProductionActive = schedulerEnabled && schedulerMode === "production";
    const productionApproved = (productionActive || schedulerProductionActive) && approved && !killSwitch;
    result.summary.reminder = { mode, enabled, schedulerEnabled, schedulerMode, killSwitch, approved };
    addCheck(
      "reminder_scheduler_safety",
      "Reminder dan scheduler",
      productionActive || schedulerProductionActive ? (productionApproved ? "PASS" : "FAIL") : "PASS",
      `mode=${mode}, enabled=${enabled}, scheduler=${schedulerEnabled ? "enabled" : "disabled"}/${schedulerMode}, killSwitch=${killSwitch}, approved=${approved}.`
    );
    if ((productionActive || schedulerProductionActive) && !approved) {
      addCheck("reminder_production_without_approval", "Reminder production approval", "FAIL", "Production reminder/scheduler aktif tanpa approval eksplisit.");
    }

    const publicQa = await query(
      pool,
      `SELECT COUNT(*)::int AS count
       FROM aleta_bot_public_qa_logs
       WHERE COALESCE(needs_human_review, 0) = 1
         AND COALESCE(review_status, 'pending') = 'pending'`
    );
    result.summary.publicQa = { pendingHumanReview: Number(publicQa.rows?.[0]?.count ?? 0) };
    addCheck(
      "public_qa_pending_review",
      "Public Q&A pending review",
      Number(publicQa.rows?.[0]?.count ?? 0) === 0 ? "PASS" : "WARN",
      `${Number(publicQa.rows?.[0]?.count ?? 0)} pertanyaan publik perlu review.`
    );
  } finally {
    await pool.end();
  }
}

function checkAiBridge() {
  const ai = result.summary.runtime?.aiRuntime ?? {};
  const status = normalizeStatus(ai.status);
  addCheck(
    "ai_bridge",
    "AI Bridge",
    status === "synced" ? "PASS" : "WARN",
    `AI Bridge status=${status}. Smoke tidak memanggil provider eksternal.`
  );
}

function evaluateSafety() {
  const statuses = result.checks.map((check) => check.status);
  const runtimeStatus = normalizeStatus(result.summary.runtime?.whatsappStatus);
  const worker = result.summary.worker ?? {};
  const queue = result.summary.queue ?? {};
  const numbers = result.summary.whatsappNumbers ?? {};
  const approvals = result.summary.approvals ?? {};
  const reminder = result.summary.reminder ?? {};
  const productionUnsafe =
    reminder.enabled && reminder.mode === "production" ||
    reminder.schedulerEnabled && reminder.schedulerMode === "production";
  const productionApproved = productionUnsafe && reminder.approved && !reminder.killSwitch;

  result.safeForNonWaPilot =
    Boolean(worker.enabled && worker.activeTimer && !worker.paused) &&
    Number(queue.activeDeadLetters ?? 1) === 0 &&
    Number(queue.failed ?? 1) === 0 &&
    Number(approvals.pending ?? 1) === 0 &&
    Number(numbers.missing ?? 1) === 0;

  result.safeForLimitedWhatsAppPilot =
    result.safeForNonWaPilot &&
    ["connected", "ready"].includes(runtimeStatus) &&
    Number(numbers.priorityMissing ?? 1) === 0 &&
    (!productionUnsafe || productionApproved);

  result.safeForProduction =
    result.safeForLimitedWhatsAppPilot &&
    productionApproved &&
    Number(queue.pending ?? 0) === 0 &&
    Number(queue.processing ?? 0) === 0;
  if (statuses.includes("FAIL")) result.overall = "FAIL";
  else if (statuses.includes("WARN")) result.overall = "WARN";
  else result.overall = "PASS";
}

function renderMarkdown() {
  const lines = [];
  lines.push("# ALETA Smoke Dry-run Report");
  lines.push("");
  lines.push(`Generated: ${result.generatedAt}`);
  lines.push(`Overall: ${result.overall}`);
  lines.push("");
  lines.push("## Kesimpulan");
  lines.push(`- Siap pilot non-WA: ${result.safeForNonWaPilot ? "ya" : "tidak"}`);
  lines.push(`- Siap pilot WhatsApp terbatas: ${result.safeForLimitedWhatsAppPilot ? "ya" : "tidak"}`);
  lines.push(`- Siap production: ${result.safeForProduction ? "ya" : "tidak"}`);
  lines.push("");
  lines.push("## Status Akhir");
  lines.push(`- WhatsApp runtime: ${result.summary.runtime?.whatsappStatus ?? "unknown"}`);
  lines.push(`- Worker: enabled=${result.summary.worker?.enabled ?? "n/a"}, activeTimer=${result.summary.worker?.activeTimer ?? "n/a"}, paused=${result.summary.worker?.paused ?? "n/a"}`);
  lines.push(`- Queue: pending=${result.summary.queue?.pending ?? "n/a"}, processing=${result.summary.queue?.processing ?? "n/a"}, failed=${result.summary.queue?.failed ?? "n/a"}`);
  lines.push(`- Dead-letter aktif: ${result.summary.queue?.activeDeadLetters ?? "n/a"}`);
  lines.push(`- Approval pending: ${result.summary.approvals?.pending ?? "n/a"}`);
  lines.push(`- Nomor WA pegawai: ${result.summary.whatsappNumbers?.complete ?? "n/a"}/${result.summary.whatsappNumbers?.total ?? "n/a"}, missing=${result.summary.whatsappNumbers?.missing ?? "n/a"}`);
  lines.push(`- Safe sending window: ${JSON.stringify(result.summary.safeSendingWindow ?? {})}`);
  lines.push(`- Reminder/scheduler: ${JSON.stringify(result.summary.reminder ?? {})}`);
  lines.push(`- AI Bridge: ${result.summary.runtime?.aiRuntime?.status ?? "unknown"}`);
  lines.push("");
  lines.push("## Actions Taken");
  for (const action of result.actionsTaken) {
    lines.push(`- ${action.action}: ${action.detail}`);
  }
  lines.push("");
  lines.push("## Checks");
  lines.push("| Status | Key | Detail |");
  lines.push("| --- | --- | --- |");
  for (const check of result.checks) {
    lines.push(`| ${check.status} | ${escapeTable(check.key)} | ${escapeTable(check.detail)} |`);
  }
  lines.push("");
  lines.push("## Blockers");
  if (result.blockers.length === 0) lines.push("- Tidak ada blocker untuk smoke dry-run/non-WA pilot.");
  for (const blocker of result.blockers) {
    lines.push(`- ${blocker.label}: ${blocker.detail}`);
  }
  lines.push("");
  lines.push("## Warnings");
  if (result.warnings.length === 0) lines.push("- Tidak ada warning.");
  for (const warning of result.warnings) {
    lines.push(`- ${warning.label}: ${warning.detail}`);
  }
  lines.push("");
  lines.push("## Safety Notes");
  lines.push("- Smoke runner ini read-only: tidak mengirim WhatsApp, tidak enqueue, tidak resend, tidak approve, tidak scan QR, dan tidak mengubah scheduler.");
  if (result.safeForLimitedWhatsAppPilot) {
    lines.push("- Pilot WhatsApp terbatas lolos smoke dry-run teknis; tetap jalankan hanya lewat kontrol Super Admin dan guard approval yang sudah ada.");
  } else {
    lines.push("- Pilot WhatsApp terbatas tetap ditahan sampai WhatsApp Gateway connected dan warning operasional selesai.");
  }
  if (result.safeForProduction) {
    lines.push("- Production automation terbaca aktif dengan approval/gate dan queue sehat.");
  } else {
    lines.push("- Production tetap tidak siap tanpa approval dan gate terpisah.");
  }
  return `${lines.join("\n")}\n`;
}

function escapeTable(value) {
  return String(value ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

async function main() {
  mkdirSync(REPORT_DIR, { recursive: true });
  addAction("read_only_smoke", "Tidak ada send, resend, enqueue, approve, scan QR, logout/reset, atau production activation.");
  await checkRuntime();
  checkWhatsapp();
  await checkPortalProxyAndApps();
  checkWorkerAndSafeWindow();
  await checkQueue();
  await checkPortalDb();
  checkAiBridge();
  evaluateSafety();
  writeFileSync(REPORT_JSON, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  writeFileSync(REPORT_MD, renderMarkdown(), "utf8");
  console.log(`Overall: ${result.overall}`);
  console.log(`safeForNonWaPilot: ${result.safeForNonWaPilot}`);
  console.log(`safeForLimitedWhatsAppPilot: ${result.safeForLimitedWhatsAppPilot}`);
  console.log(`safeForProduction: ${result.safeForProduction}`);
  console.log(`Report JSON: ${REPORT_JSON}`);
  console.log(`Report MD: ${REPORT_MD}`);
}

main().catch((error) => {
  addCheck("smoke_unhandled_error", "Smoke dry-run runner", "FAIL", sanitizeError(error));
  evaluateSafety();
  mkdirSync(REPORT_DIR, { recursive: true });
  writeFileSync(REPORT_JSON, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  writeFileSync(REPORT_MD, renderMarkdown(), "utf8");
  console.error(`Smoke dry-run failed: ${sanitizeError(error)}`);
  process.exitCode = 1;
});
