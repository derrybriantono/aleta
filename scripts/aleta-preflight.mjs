import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const SCRIPT_DIR = path.dirname(__filename);
const ROOT_DIR = path.resolve(SCRIPT_DIR, "..");
const PORTAL_DIR = path.join(ROOT_DIR, "manajemen_surat");
const BOT_DIR = path.join(ROOT_DIR, "aleta_bot");
const REPORT_DIR = path.join(ROOT_DIR, "reports");
const REPORT_JSON = path.join(REPORT_DIR, "aleta-preflight-latest.json");
const REPORT_MD = path.join(REPORT_DIR, "aleta-preflight-latest.md");

const PORTAL_BASE_URL = "http://127.0.0.1:3000";
const BOT_BASE_URL = "http://127.0.0.1:3003";
const PHASE4_DEAD_LETTER_MESSAGE = "Phase 4 dead-letter validation only. Do not send.";
const PHASE4_DEAD_LETTER_ERROR = "Phase 4 simulated failure";
const PHASE4_APPROVAL_NAME = "Phase 4 Approval Validate";
const PHASE4_RESOLVE_NOTE = "Artefak validasi Phase 4. Simulated failure only. Do not send.";
const PHASE4_REJECT_NOTE =
  "Ditolak karena merupakan artefak validasi Phase 4, bukan permintaan produksi. Tidak boleh dikirim.";

const portalEnv = loadEnvFiles([
  path.join(PORTAL_DIR, ".env"),
  path.join(PORTAL_DIR, ".env.local"),
]);
const botEnv = loadEnvFiles([
  path.join(BOT_DIR, ".env"),
]);

const result = {
  generatedAt: new Date().toISOString(),
  overall: "WARN",
  safeToRunSmokeTest: false,
  safeForNonWaPilot: false,
  safeForLimitedWhatsAppPilot: false,
  safeForProduction: false,
  checks: [],
  blockers: [],
  warnings: [],
  actionsTaken: [],
  validation: [],
  summary: {},
};

function loadEnvFiles(files) {
  const values = { ...process.env };
  for (const file of files) {
    if (!existsSync(file)) continue;
    const lines = readFileSync(file, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const match = trimmed.match(/^([^=]+)=(.*)$/);
      if (!match) continue;
      const key = match[1].trim();
      let value = match[2].trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
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
    ...(token
      ? {
          "x-aleta-internal-token": token,
          "x-aleta-bot-token": token,
        }
      : {}),
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

function sanitizeError(error) {
  return String(error?.message ?? error ?? "unknown_error")
    .replace(/[A-Za-z]:\\[^\s"'<>]+/g, "[path]")
    .slice(0, 300);
}

function hasKeyDeep(value, keyName) {
  if (!value || typeof value !== "object") return false;
  if (Object.prototype.hasOwnProperty.call(value, keyName)) return true;
  return Object.values(value).some((child) => hasKeyDeep(child, keyName));
}

function stringIncludesSensitivePath(value) {
  const text = JSON.stringify(value ?? {});
  return /\\.wwebjs_auth|session-[A-Za-z0-9_-]+|userDataDir/i.test(text);
}

function getNested(obj, pathText) {
  return pathText.split(".").reduce((current, part) => {
    if (current && typeof current === "object" && part in current) return current[part];
    return undefined;
  }, obj);
}

function normalizeStatus(status) {
  return String(status ?? "unknown").toLowerCase();
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
    addCheck("portal_db_config", "Portal DB config", "WARN", "DATABASE_URL tidak ditemukan untuk cek DB langsung.");
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
    addCheck("portal_db", "Portal database", "FAIL", `Koneksi database portal gagal: ${sanitizeError(error)}`);
    return null;
  }
}

async function query(pool, sql, params = []) {
  if (!pool) return null;
  try {
    return await pool.query(sql, params);
  } catch (error) {
    return { error: sanitizeError(error), rows: [] };
  }
}

async function checkRuntimeEndpoints() {
  const portalRoot = await fetchJson(PORTAL_BASE_URL);
  addCheck(
    "portal_reachable",
    "Portal manajemen_surat reachable",
    portalRoot.ok ? "PASS" : "FAIL",
    portalRoot.ok ? `Portal reachable HTTP ${portalRoot.status}.` : `Portal tidak reachable: ${portalRoot.error ?? portalRoot.status}.`
  );

  const botStatus = await fetchJson(`${BOT_BASE_URL}/internal/aleta-bot/status`, {
    headers: internalHeaders(),
  });
  addCheck(
    "bot_runtime_status",
    "Runtime ALETA Bot status",
    botStatus.ok ? "PASS" : "FAIL",
    botStatus.ok ? "Runtime ALETA Bot reachable." : `Runtime ALETA Bot tidak reachable: ${botStatus.error ?? botStatus.status}.`
  );

  const waStatus = await fetchJson(`${BOT_BASE_URL}/internal/aleta-bot/whatsapp/status`, {
    headers: internalHeaders(),
  });
  addCheck(
    "bot_whatsapp_status_endpoint",
    "WhatsApp status endpoint",
    waStatus.ok ? "PASS" : "FAIL",
    waStatus.ok ? "Endpoint status WhatsApp reachable." : `Endpoint status WhatsApp gagal: ${waStatus.error ?? waStatus.status}.`
  );

  const diagnostics = await fetchJson(`${BOT_BASE_URL}/internal/aleta-bot/whatsapp/diagnostics`, {
    headers: internalHeaders(),
  });
  addCheck(
    "bot_whatsapp_diagnostics",
    "WhatsApp diagnostics endpoint",
    diagnostics.ok ? "PASS" : "FAIL",
    diagnostics.ok ? "Endpoint diagnostics WhatsApp reachable." : `Endpoint diagnostics gagal: ${diagnostics.error ?? diagnostics.status}.`
  );

  if (botStatus.ok) {
    const leakedQr = hasKeyDeep(botStatus.data, "lastQrString") || hasKeyDeep(botStatus.data, "qrString");
    addCheck(
      "bot_status_no_raw_qr",
      "Status runtime tidak membocorkan QR raw",
      leakedQr ? "FAIL" : "PASS",
      leakedQr ? "Status runtime masih memiliki field QR raw." : "Tidak ada field QR raw pada status runtime."
    );
  }
  if (diagnostics.ok) {
    const hasSecret =
      hasKeyDeep(diagnostics.data, "token") ||
      hasKeyDeep(diagnostics.data, "apiKey") ||
      hasKeyDeep(diagnostics.data, "lastQrString") ||
      stringIncludesSensitivePath(diagnostics.data);
    addCheck(
      "diagnostics_sanitized",
      "Diagnostics aman",
      hasSecret ? "FAIL" : "PASS",
      hasSecret
        ? "Diagnostics mengandung token, QR, stack/path session sensitif, atau secret."
        : "Diagnostics tidak menampilkan token, QR raw, atau path session sensitif."
    );
  }

  result.summary.runtime = summarizeRuntime(botStatus.data, waStatus.data, diagnostics.data);
  return { portalRoot, botStatus, waStatus, diagnostics };
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
  const registry = statusData?.registry
    ? {
        useRegistryNotifications: Boolean(statusData.registry.useRegistryNotifications),
        registryPilotMode: Boolean(statusData.registry.registryPilotMode),
        registryDryRunDefault: Boolean(statusData.registry.registryDryRunDefault),
        total: Number(statusData.registry.total ?? 0),
        active: Number(statusData.registry.active ?? 0),
        dryRun: Number(statusData.registry.dryRun ?? 0),
        requiresApproval: Number(statusData.registry.requiresApproval ?? 0),
        skippedPolicy: Number(statusData.registry.skippedPolicy ?? 0),
        policySkipStats: {
          skippedCount: Number(statusData.registry.policySkipStats?.skippedCount ?? 0),
          totalToday: Number(statusData.registry.policySkipStats?.totalToday ?? 0),
          lastSkippedAt: statusData.registry.policySkipStats?.lastSkippedAt ?? null,
          reasons: statusData.registry.policySkipStats?.reasons ?? {},
        },
      }
    : null;
  return {
    whatsappStatus: normalizeStatus(whatsapp.status ?? diagnostics.status),
    initializing: Boolean(whatsapp.initializing ?? diagnostics.initializing),
    hasClient: Boolean(whatsapp.hasClient ?? diagnostics.hasClient),
    hasQr: Boolean(whatsapp.qrAvailable ?? whatsapp.hasQr ?? diagnostics.hasQr),
    lastErrorType: whatsapp.lastErrorType ?? diagnostics.lastErrorType ?? null,
    sessionName: diagnostics.sessionName ?? whatsapp.sessionName ?? null,
    authPathConfigured: diagnostics.authPathConfigured ?? null,
    initializeAgeMs: whatsapp.initializeAgeMs ?? diagnostics.initializeAgeMs ?? null,
    worker: statusData?.worker ?? null,
    queue: statusData?.queue ?? null,
    safeSendingWindow: statusData?.bot?.sendingWindow ?? null,
    aiRuntime,
    registry,
  };
}

function evaluateWhatsappRuntime() {
  const rt = result.summary.runtime ?? {};
  const status = normalizeStatus(rt.whatsappStatus);
  const initializeAgeMs = Number(rt.initializeAgeMs ?? 0);
  if (status === "connected" || status === "ready") {
    addCheck("whatsapp_connection", "WhatsApp Gateway", "PASS", "WhatsApp runtime connected.");
  } else if (status === "browser_locked" || rt.lastErrorType === "browser_locked") {
    addCheck("whatsapp_connection", "WhatsApp Gateway", "FAIL", "Session WhatsApp terkunci oleh proses browser lain.");
  } else if (status === "initialize_timeout") {
    addCheck("whatsapp_connection", "WhatsApp Gateway", "FAIL", "Inisialisasi WhatsApp timeout tanpa QR/ready. Client dihentikan aman tanpa logout.");
  } else if (status === "initializing" && initializeAgeMs > 120000 && !rt.hasQr) {
    addCheck("whatsapp_connection", "WhatsApp Gateway", "FAIL", "WhatsApp initializing terlalu lama tanpa QR/error.");
  } else if (status === "initializing" && rt.initializing === false && !rt.hasQr) {
    addCheck("whatsapp_connection", "WhatsApp Gateway", "FAIL", "Status WhatsApp terlihat initializing, tetapi runtime tidak memiliki proses initialize aktif atau QR.");
  } else if (status === "qr_needed") {
    addCheck("whatsapp_connection", "WhatsApp Gateway", "WARN", `WhatsApp membutuhkan QR. qrAvailable=${rt.hasQr}.`);
  } else if (status === "disconnected" || status === "unknown") {
    addCheck("whatsapp_connection", "WhatsApp Gateway", "WARN", `WhatsApp belum connected: ${status}.`);
  } else {
    addCheck("whatsapp_connection", "WhatsApp Gateway", "WARN", `Status WhatsApp: ${status}.`);
  }
}

async function checkPortalProxy() {
  const portalStatus = await fetchJson(`${PORTAL_BASE_URL}/api/whatsapp/status`);
  const portalQr = await fetchJson(`${PORTAL_BASE_URL}/api/whatsapp/qr`);
  const portalStatusText = normalizeStatus(
    portalStatus.data?.status ??
      portalStatus.data?.runtimeStatus ??
      portalStatus.data?.data?.status ??
      portalStatus.data?.data?.runtimeStatus
  );
  const runtimeStatus = normalizeStatus(result.summary.runtime?.whatsappStatus);
  const qrAvailable = Boolean(
    portalQr.data?.qrAvailable ??
      portalQr.data?.available ??
      portalQr.data?.data?.qrAvailable ??
      portalQr.data?.data?.available ??
      portalQr.data?.qrCode ??
      portalQr.data?.qr
  );

  const leakedQrInStatus = hasKeyDeep(portalStatus.data, "lastQrString") || hasKeyDeep(portalStatus.data, "qrString");
  addCheck(
    "portal_whatsapp_status_proxy",
    "Portal proxy status WhatsApp",
    portalStatus.ok && !leakedQrInStatus ? "PASS" : "WARN",
    portalStatus.ok
      ? `Portal status reachable. portal=${portalStatusText || "unknown"}, runtime=${runtimeStatus}.`
      : `Portal status tidak readable tanpa sesi atau gagal: HTTP ${portalStatus.status}.`
  );
  if (runtimeStatus === "connected" && portalStatus.ok && !["connected", "ready"].includes(portalStatusText)) {
    addCheck("portal_whatsapp_mapping", "Mapping runtime ke portal", "FAIL", "Runtime connected tetapi portal tidak memetakan connected.");
  } else {
    addCheck("portal_whatsapp_mapping", "Mapping runtime ke portal", "PASS", "Tidak ada mismatch connected runtime vs portal.");
  }
  addCheck(
    "portal_qr_proxy",
    "Portal proxy QR",
    portalQr.ok || portalQr.status === 401 ? "PASS" : "WARN",
    portalQr.ok ? `Endpoint QR portal reachable. qrAvailable=${qrAvailable}. QR raw tidak ditulis ke laporan.` : `Endpoint QR portal HTTP ${portalQr.status}.`
  );
  result.summary.portalProxy = {
    statusEndpoint: portalStatus.ok ? "reachable" : `http_${portalStatus.status}`,
    qrEndpoint: portalQr.ok ? "reachable" : `http_${portalQr.status}`,
    portalStatus: portalStatusText || "unknown",
    qrAvailable,
  };
}

async function checkQueueAndCleanupDeadLetters() {
  const activeBefore = await fetchJson(`${BOT_BASE_URL}/internal/aleta-bot/queue/dead-letters?limit=100&status=active`, {
    headers: internalHeaders(),
  });
  const resolvedBefore = await fetchJson(`${BOT_BASE_URL}/internal/aleta-bot/queue/dead-letters?limit=100&status=resolved`, {
    headers: internalHeaders(),
  });

  if (!activeBefore.ok) {
    addCheck("dead_letters_active", "Dead-letter aktif", "WARN", `Dead-letter endpoint tidak readable: HTTP ${activeBefore.status}.`);
    return;
  }

  const phase4 = (activeBefore.data?.items ?? []).find(exactPhase4DeadLetter);
  if (phase4) {
    const cleanup = await fetchJson(`${BOT_BASE_URL}/internal/aleta-bot/queue/dead-letters/resolve`, {
      method: "POST",
      headers: internalHeaders({ "content-type": "application/json" }),
      body: JSON.stringify({
        id: phase4.id,
        note: PHASE4_RESOLVE_NOTE,
        resolvedBy: "aleta-preflight-runner",
      }),
    });
    if (cleanup.ok) {
      addAction("resolve_phase4_dead_letter", "Phase 4 dead-letter exact match ditandai resolved tanpa resend.", {
        id: phase4.id,
      });
    } else {
      addCheck(
        "phase4_dead_letter_cleanup",
        "Cleanup dead-letter Phase 4",
        "FAIL",
        `Gagal menandai Phase 4 dead-letter sebagai resolved: HTTP ${cleanup.status}.`
      );
    }
  } else {
    addAction("resolve_phase4_dead_letter", "Tidak ada Phase 4 dead-letter aktif yang perlu di-resolve.");
  }

  const activeAfter = await fetchJson(`${BOT_BASE_URL}/internal/aleta-bot/queue/dead-letters?limit=100&status=active`, {
    headers: internalHeaders(),
  });
  const resolvedAfter = await fetchJson(`${BOT_BASE_URL}/internal/aleta-bot/queue/dead-letters?limit=100&status=resolved`, {
    headers: internalHeaders(),
  });
  const activeCount = Number(activeAfter.data?.total ?? 0);
  const resolvedCount = Number(resolvedAfter.data?.total ?? resolvedBefore.data?.total ?? 0);
  addCheck(
    "dead_letters_active",
    "Dead-letter aktif",
    activeCount === 0 ? "PASS" : "WARN",
    `${activeCount} dead-letter aktif. ${resolvedCount} sudah ditangani.`
  );

  const queueEndpoint = await fetchJson(`${BOT_BASE_URL}/internal/aleta-bot/queue?limit=10`, {
    headers: internalHeaders(),
  });
  const queueStats = queueEndpoint.data?.stats ?? result.summary.runtime?.queue ?? {};
  result.summary.queue = {
    pending: Number(queueStats.pending ?? 0),
    processing: Number(queueStats.processing ?? 0),
    failed: Number(queueStats.failed ?? activeCount),
    resolved: Number(queueStats.resolved ?? resolvedCount),
    dryRun: Number(queueStats.dry_run ?? 0),
    activeDeadLetters: activeCount,
    resolvedDeadLetters: resolvedCount,
  };
}

async function checkWorkerAndSafeWindow() {
  const rt = result.summary.runtime ?? {};
  const worker = rt.worker ?? {};
  const operational = Boolean(worker.enabled && worker.activeTimer && !worker.paused);
  addCheck(
    "worker_operational",
    "Worker antrean",
    operational ? "PASS" : "FAIL",
    `enabled=${Boolean(worker.enabled)}, activeTimer=${Boolean(worker.activeTimer)}, paused=${Boolean(worker.paused)}, running=${Boolean(worker.running)}.`
  );

  const safeWindow = rt.safeSendingWindow ?? {};
  const insideWindow = safeWindow.insideWindow ?? safeWindow.inside;
  const allowed = safeWindow.allowed ?? safeWindow.isAllowed;
  const safeWindowOk = safeWindow.enabled !== false && Boolean(safeWindow.start || safeWindow.startTime) && Boolean(safeWindow.end || safeWindow.endTime);
  addCheck(
    "safe_sending_window",
    "Safe Sending Window",
    safeWindowOk ? "PASS" : "WARN",
    safeWindowOk
      ? `enabled ${safeWindow.start ?? safeWindow.startTime}-${safeWindow.end ?? safeWindow.endTime}. insideWindow=${Boolean(insideWindow)}, allowed=${Boolean(allowed)}.`
      : "Safe Sending Window runtime belum lengkap atau belum terbaca."
  );
  result.summary.worker = {
    enabled: Boolean(worker.enabled),
    activeTimer: Boolean(worker.activeTimer),
    paused: Boolean(worker.paused),
    running: Boolean(worker.running),
    intervalMs: worker.intervalMs ?? null,
    batchSize: worker.batchSize ?? null,
  };
  result.summary.safeSendingWindow = safeWindow;
}

async function checkPortalDbAndCleanupApproval() {
  const pool = await openPortalDb();
  if (!pool) return;
  try {
    const users = await query(
      pool,
      `SELECT id, name, role_id, position_id, whatsapp_number
       FROM users
       WHERE deleted_at IS NULL AND is_active = 1`
    );
    const userRows = users?.rows ?? [];
    const complete = userRows.filter((user) => isValidWhatsappNumber(user.whatsapp_number)).length;
    const missing = Math.max(0, userRows.length - complete);
    const importantRoles = new Set(["super-admin", "admin", "ketua", "wakil-ketua", "hakim", "panitera", "sekretaris"]);
    const priorityMissing = userRows.filter(
      (user) => importantRoles.has(String(user.role_id)) && !isValidWhatsappNumber(user.whatsapp_number)
    ).length;
    result.summary.whatsappNumbers = {
      total: userRows.length,
      complete,
      missing,
      priorityMissing,
    };
    addCheck(
      "whatsapp_number_completeness",
      "Kelengkapan nomor WhatsApp pegawai",
      missing === 0 ? "PASS" : priorityMissing > 0 ? "FAIL" : "WARN",
      `${complete}/${userRows.length} pegawai punya nomor WhatsApp. Missing=${missing}, priorityMissing=${priorityMissing}.`
    );

    const phase4Approval = await query(
      pool,
      `SELECT id, entity_name, status
       FROM aleta_bot_approval_requests
       WHERE entity_name = $1
       ORDER BY created_at DESC
       LIMIT 5`,
      [PHASE4_APPROVAL_NAME]
    );
    const pendingPhase4 = (phase4Approval?.rows ?? []).filter((row) => row.status === "pending");
    if (pendingPhase4.length > 0) {
      for (const approval of pendingPhase4) {
        await query(
          pool,
          `UPDATE aleta_bot_approval_requests
           SET status = 'rejected',
               reviewed_by = 'aleta-preflight-runner',
               reviewed_at = $1,
               notes = $2,
               updated_at = $1
           WHERE id = $3 AND status = 'pending' AND entity_name = $4`,
          [new Date().toISOString(), PHASE4_REJECT_NOTE, approval.id, PHASE4_APPROVAL_NAME]
        );
      }
      addAction("reject_phase4_approval", `${pendingPhase4.length} approval Phase 4 exact match ditolak/cancel aman.`);
    } else {
      addAction("reject_phase4_approval", "Tidak ada approval Phase 4 pending yang perlu ditolak.");
    }

    const pendingApproval = await query(
      pool,
      `SELECT COUNT(*)::int AS count FROM aleta_bot_approval_requests WHERE status = 'pending'`
    );
    const pendingCount = Number(pendingApproval?.rows?.[0]?.count ?? 0);
    result.summary.approvals = { pending: pendingCount };
    addCheck(
      "approval_pending",
      "Approval pending",
      pendingCount === 0 ? "PASS" : "WARN",
      `${pendingCount} approval masih pending. Phase 4 exact match sudah dibersihkan jika ada.`
    );

    const settings = await query(pool, `SELECT * FROM aleta_bot_settings WHERE id = 1 LIMIT 1`);
    const settingsRow = settings?.rows?.[0] ?? {};
    const productionUnsafe =
      settingsRow.disposition_deadline_reminder_mode === "production" ||
      settingsRow.disposition_deadline_reminder_scheduler_mode === "production";
    const approved = Boolean(settingsRow.disposition_deadline_reminder_approved_at);
    const killSwitch = Boolean(Number(settingsRow.disposition_deadline_reminder_kill_switch ?? 0));
    result.summary.reminder = {
      mode: settingsRow.disposition_deadline_reminder_mode ?? "unknown",
      enabled: Boolean(Number(settingsRow.disposition_deadline_reminder_enabled ?? 0)),
      schedulerEnabled: Boolean(Number(settingsRow.disposition_deadline_reminder_scheduler_enabled ?? 0)),
      schedulerMode: settingsRow.disposition_deadline_reminder_scheduler_mode ?? "unknown",
      killSwitch,
      approved,
    };
    addCheck(
      "reminder_scheduler_safety",
      "Reminder dan scheduler",
      productionUnsafe && !approved ? "FAIL" : productionUnsafe ? "WARN" : "PASS",
      `mode=${result.summary.reminder.mode}, scheduler=${result.summary.reminder.schedulerEnabled ? "enabled" : "disabled"}/${result.summary.reminder.schedulerMode}, killSwitch=${killSwitch}.`
    );

    const publicQa = await query(
      pool,
      `SELECT COUNT(*)::int AS count
       FROM aleta_bot_public_qa_logs
       WHERE COALESCE(needs_human_review, 0) = 1
         AND COALESCE(review_status, 'pending') = 'pending'`
    );
    result.summary.publicQa = { pendingHumanReview: Number(publicQa?.rows?.[0]?.count ?? 0) };
  } finally {
    await pool.end();
  }
}

async function checkAiAndTasks() {
  const ai = result.summary.runtime?.aiRuntime ?? {};
  const aiStatus = normalizeStatus(ai.status ?? ai.lastSyncStatus);
  addCheck(
    "ai_bridge",
    "AI Bridge",
    aiStatus === "synced" ? "PASS" : "WARN",
    `AI Bridge status=${aiStatus || "unknown"}. API key tidak ditampilkan.`
  );

  const tasks = await fetchJson(`${PORTAL_BASE_URL}/api/tasks`);
  addCheck(
    "portal_tasks_endpoint",
    "Pusat Tugas endpoint",
    tasks.ok || tasks.status === 401 ? "PASS" : "WARN",
    tasks.ok ? "Endpoint /api/tasks readable." : `Endpoint /api/tasks HTTP ${tasks.status}; auth guard dianggap aktif bila 401.`
  );
}

function evaluatePilotSafety() {
  const statuses = result.checks.map((check) => check.status);
  const runtimeStatus = normalizeStatus(result.summary.runtime?.whatsappStatus);
  const worker = result.summary.worker ?? {};
  const queue = result.summary.queue ?? {};
  const numbers = result.summary.whatsappNumbers ?? {};
  const reminder = result.summary.reminder ?? {};
  const approvalPending = Number(result.summary.approvals?.pending ?? 0);
  const hardFail = result.blockers.length > 0;

  const productionUnsafe =
    reminder.mode === "production" ||
    (reminder.schedulerEnabled && reminder.schedulerMode === "production");
  const productionApproved = productionUnsafe && reminder.approved && !reminder.killSwitch;

  result.safeToRunSmokeTest =
    !["browser_locked"].includes(runtimeStatus) && (!productionUnsafe || productionApproved) && queue.activeDeadLetters === 0;
  result.safeForNonWaPilot = !hardFail || (hardFail && runtimeStatus !== "browser_locked" && queue.activeDeadLetters === 0);
  result.safeForLimitedWhatsAppPilot =
    ["connected", "ready"].includes(runtimeStatus) &&
    Boolean(worker.enabled && worker.activeTimer && !worker.paused) &&
    Number(numbers.missing ?? 1) === 0 &&
    Number(numbers.priorityMissing ?? 1) === 0 &&
    Number(queue.activeDeadLetters ?? 1) === 0 &&
    approvalPending === 0 &&
    (!productionUnsafe || productionApproved);
  result.safeForProduction =
    result.safeForLimitedWhatsAppPilot &&
    productionApproved &&
    Number(queue.pending ?? 0) === 0 &&
    Number(queue.processing ?? 0) === 0 &&
    Number(queue.failed ?? 0) === 0;

  if (statuses.includes("FAIL")) result.overall = "FAIL";
  else if (statuses.includes("WARN")) result.overall = "WARN";
  else result.overall = "PASS";
}

function runValidation() {
  const node = process.execPath;
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  const npx = process.platform === "win32" ? "npx.cmd" : "npx";
  const commands = [
    { cwd: ROOT_DIR, cmd: node, args: ["--check", "scripts/aleta-preflight.mjs"], label: "node --check scripts/aleta-preflight.mjs", timeoutMs: 30000 },
    { cwd: BOT_DIR, cmd: node, args: ["--check", "app.js"], label: "node --check app.js", timeoutMs: 30000 },
    { cwd: BOT_DIR, cmd: node, args: ["--check", "whatsapp.js"], label: "node --check whatsapp.js", timeoutMs: 30000 },
    { cwd: BOT_DIR, cmd: node, args: ["--check", "services/whatsappStatusService.js"], label: "node --check services/whatsappStatusService.js", timeoutMs: 30000 },
    { cwd: BOT_DIR, cmd: node, args: ["--check", "routes/internalGatewayRoutes.js"], label: "node --check routes/internalGatewayRoutes.js", timeoutMs: 30000 },
    { cwd: PORTAL_DIR, cmd: npx, args: ["tsc", "--noEmit", "--pretty", "false"], label: "npx tsc --noEmit --pretty false", timeoutMs: 120000, shell: process.platform === "win32" },
    { cwd: PORTAL_DIR, cmd: npm, args: ["run", "lint"], label: "npm run lint", timeoutMs: 120000, shell: process.platform === "win32" },
    { cwd: PORTAL_DIR, cmd: npm, args: ["run", "build"], label: "npm run build", timeoutMs: 180000, shell: process.platform === "win32" },
    { cwd: PORTAL_DIR, cmd: npm, args: ["test"], label: "npm test", timeoutMs: 180000, shell: process.platform === "win32" },
  ];

  for (const item of commands) {
    const started = Date.now();
    const run = spawnSync(item.cmd, item.args, {
      cwd: item.cwd,
      encoding: "utf8",
      timeout: item.timeoutMs,
      shell: item.shell ?? false,
      env: process.env,
    });
    const stdoutTail = String(run.stdout ?? "").split(/\r?\n/).filter(Boolean).slice(-8).join("\n");
    const rawStderrTail = String(run.stderr ?? "").split(/\r?\n/).filter(Boolean).slice(-8).join("\n");
    const stderrTail = rawStderrTail || (run.error ? run.error.message : "");
    result.validation.push({
      command: item.label,
      cwd: item.cwd,
      status: !run.error && run.status === 0 ? "PASS" : "FAIL",
      exitCode: run.status,
      durationMs: Date.now() - started,
      stdoutTail: sanitizeValidationOutput(stdoutTail),
      stderrTail: sanitizeValidationOutput(stderrTail),
    });
  }

  for (const validation of result.validation) {
    addCheck(
      `validation_${validation.command.replace(/[^a-z0-9]+/gi, "_").toLowerCase()}`,
      validation.command,
      validation.status,
      validation.status === "PASS" ? "Command passed." : `Command failed with exit code ${validation.exitCode}.`
    );
  }
}

function sanitizeValidationOutput(text) {
  return String(text)
    .replace(/(DATABASE_URL|TOKEN|SECRET|PASSWORD|API_KEY)=\S+/gi, "$1=[redacted]")
    .replace(/[A-Za-z]:\\[^\s"'<>]+\.wwebjs_auth[^\s"'<>]*/gi, "[session-path]")
    .slice(0, 2000);
}

function renderMarkdown() {
  const lines = [];
  lines.push("# ALETA Automated Preflight Report");
  lines.push("");
  lines.push(`Generated: ${result.generatedAt}`);
  lines.push(`Overall: ${result.overall}`);
  lines.push("");
  lines.push("## Kesimpulan");
  lines.push(`- Siap smoke test dry-run: ${result.safeToRunSmokeTest ? "ya" : "tidak"}`);
  lines.push(`- Siap pilot non-WA: ${result.safeForNonWaPilot ? "ya" : "tidak"}`);
  lines.push(`- Siap pilot WhatsApp terbatas: ${result.safeForLimitedWhatsAppPilot ? "ya" : "tidak"}`);
  lines.push(`- Siap production: ${result.safeForProduction ? "ya" : "tidak"}`);
  lines.push("");
  lines.push("## Status Akhir");
  lines.push(`- WhatsApp runtime: ${result.summary.runtime?.whatsappStatus ?? "unknown"}`);
  lines.push(`- Worker: enabled=${result.summary.worker?.enabled ?? false}, activeTimer=${result.summary.worker?.activeTimer ?? false}, paused=${result.summary.worker?.paused ?? true}`);
  lines.push(`- Queue: pending=${result.summary.queue?.pending ?? "n/a"}, processing=${result.summary.queue?.processing ?? "n/a"}, failed=${result.summary.queue?.failed ?? "n/a"}, resolved=${result.summary.queue?.resolved ?? "n/a"}`);
  lines.push(`- Dead-letter aktif: ${result.summary.queue?.activeDeadLetters ?? "n/a"}`);
  lines.push(`- Approval pending: ${result.summary.approvals?.pending ?? "n/a"}`);
  lines.push(`- Nomor WA pegawai: ${result.summary.whatsappNumbers?.complete ?? "n/a"}/${result.summary.whatsappNumbers?.total ?? "n/a"}, missing=${result.summary.whatsappNumbers?.missing ?? "n/a"}`);
  lines.push(`- Safe sending window: ${JSON.stringify(result.summary.safeSendingWindow ?? {})}`);
  lines.push(`- Reminder/scheduler: ${JSON.stringify(result.summary.reminder ?? {})}`);
  lines.push(`- AI bridge: ${result.summary.runtime?.aiRuntime?.status ?? result.summary.runtime?.aiRuntime?.lastSyncStatus ?? "unknown"}`);
  lines.push(`- Portal proxy: ${JSON.stringify(result.summary.portalProxy ?? {})}`);
  lines.push("");
  lines.push("## Automated Cleanup");
  for (const action of result.actionsTaken) {
    lines.push(`- ${action.action}: ${action.detail}`);
  }
  lines.push("");
  lines.push("## Checks");
  lines.push("| Status | Key | Detail |");
  lines.push("| --- | --- | --- |");
  for (const check of result.checks) {
    lines.push(`| ${check.status} | ${check.key} | ${escapeTable(check.detail)} |`);
  }
  lines.push("");
  lines.push("## Validation");
  lines.push("| Status | Command | Duration |");
  lines.push("| --- | --- | --- |");
  for (const validation of result.validation) {
    lines.push(`| ${validation.status} | ${escapeTable(validation.command)} | ${validation.durationMs} ms |`);
  }
  lines.push("");
  lines.push("## Blockers");
  if (result.blockers.length === 0) lines.push("- Tidak ada blocker teknis kritis dari runner.");
  for (const blocker of result.blockers) lines.push(`- ${blocker.label}: ${blocker.detail}`);
  lines.push("");
  lines.push("## Warnings");
  if (result.warnings.length === 0) lines.push("- Tidak ada warning.");
  for (const warning of result.warnings) lines.push(`- ${warning.label}: ${warning.detail}`);
  lines.push("");
  lines.push("## Risiko Tersisa");
  lines.push("- Runner tidak melakukan scan QR, connect berulang, resend, enqueue real, atau production reminder.");
  lines.push("- Endpoint admin berbasis sesi tetap perlu diuji dari UI Super Admin bila ingin memverifikasi tampilan per-role.");
  if (!result.safeForLimitedWhatsAppPilot) {
    lines.push("- Pilot WhatsApp terbatas belum disarankan sampai status WhatsApp connected dan semua warning operasional selesai.");
  }
  lines.push("- Production tetap tidak disarankan tanpa approval eksplisit dan gate terpisah.");
  return `${lines.join("\n")}\n`;
}

function escapeTable(value) {
  return String(value ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

async function main() {
  mkdirSync(REPORT_DIR, { recursive: true });

  await checkRuntimeEndpoints();
  evaluateWhatsappRuntime();
  await checkPortalProxy();
  await checkWorkerAndSafeWindow();
  await checkQueueAndCleanupDeadLetters();
  await checkPortalDbAndCleanupApproval();
  await checkAiAndTasks();

  runValidation();
  evaluatePilotSafety();

  writeFileSync(REPORT_JSON, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  writeFileSync(REPORT_MD, renderMarkdown(), "utf8");

  console.log(`Overall: ${result.overall}`);
  console.log(`safeToRunSmokeTest: ${result.safeToRunSmokeTest}`);
  console.log(`safeForNonWaPilot: ${result.safeForNonWaPilot}`);
  console.log(`safeForLimitedWhatsAppPilot: ${result.safeForLimitedWhatsAppPilot}`);
  console.log(`safeForProduction: ${result.safeForProduction}`);
  console.log(`Report JSON: ${REPORT_JSON}`);
  console.log(`Report MD: ${REPORT_MD}`);
}

main().catch((error) => {
  addCheck("preflight_unhandled_error", "Preflight runner", "FAIL", sanitizeError(error));
  evaluatePilotSafety();
  mkdirSync(REPORT_DIR, { recursive: true });
  writeFileSync(REPORT_JSON, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  writeFileSync(REPORT_MD, renderMarkdown(), "utf8");
  console.error(`Preflight failed: ${sanitizeError(error)}`);
  process.exitCode = 1;
});
