import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const SCRIPT_DIR = path.dirname(__filename);
const ROOT_DIR = path.resolve(SCRIPT_DIR, "..");
const PORTAL_DIR = path.join(ROOT_DIR, "manajemen_surat");
const BOT_DIR = path.join(ROOT_DIR, "aleta_bot");
const CONFIG_DIR = path.join(ROOT_DIR, "config");
const REPORT_DIR = path.join(ROOT_DIR, "reports");
const WHITELIST_PATHS = [
  path.join(CONFIG_DIR, "pilot-whatsapp-small-whitelist.json"),
  path.join(REPORT_DIR, "pilot-whatsapp-small-whitelist.json"),
];
const WHITELIST_EXAMPLE = path.join(CONFIG_DIR, "pilot-whatsapp-small-whitelist.example.json");
const REPORT_JSON = path.join(REPORT_DIR, "aleta-whatsapp-small-pilot-latest.json");
const REPORT_MD = path.join(REPORT_DIR, "aleta-whatsapp-small-pilot-latest.md");
const AUDIT_JSONL = path.join(REPORT_DIR, "aleta-whatsapp-small-pilot-audit.jsonl");
const WHITELIST_REPORT_JSON = path.join(REPORT_DIR, "aleta-whatsapp-small-pilot-whitelist-generated.json");
const WHITELIST_REPORT_MD = path.join(REPORT_DIR, "aleta-whatsapp-small-pilot-whitelist-generated.md");
const PREFLIGHT_JSON = path.join(REPORT_DIR, "aleta-preflight-latest.json");
const SMOKE_JSON = path.join(REPORT_DIR, "aleta-smoke-dry-run-latest.json");

const RUNTIME_CONFIG_PATHS = [
  path.join(BOT_DIR, "config", "aleta-runtime.json"),
  path.join(PORTAL_DIR, "data", "aleta-bot-runtime.json"),
];
const BOT_BASE_URL = "http://127.0.0.1:3003";
const ACTIVE_WHITELIST_PATH = path.join(CONFIG_DIR, "pilot-whatsapp-small-whitelist.json");
const DERRY_PHONE = process.env.ALETA_DERRY_TEST_PHONE || "";
const DERRY_NAME = "DERRY BRIANTONO";
const DERRY_ROLE = "Hakim";
const MESSAGE_DEFAULT =
  "UJI PILOT ALETA - pesan WhatsApp internal terbatas. Mohon abaikan jika tidak berkepentingan. Tidak perlu membalas.";
const DERRY_MESSAGE =
  "UJI PILOT ALETA - pesan WhatsApp internal terbatas untuk DERRY BRIANTONO (Hakim). Mohon abaikan jika tidak berkepentingan. Tidak perlu membalas.";
const ENABLE_REASON =
  "Enable bot for small internal WhatsApp pilot whitelist only. Scheduler/reminder production remains disabled.";

const portalEnv = loadEnvFiles([path.join(PORTAL_DIR, ".env"), path.join(PORTAL_DIR, ".env.local")]);
const botEnv = loadEnvFiles([path.join(BOT_DIR, ".env")]);

const result = {
  generatedAt: new Date().toISOString(),
  overall: "WARN",
  pilotType: "small_internal_whatsapp_db_whitelist",
  whitelistSource: "database_plus_explicit_derry",
  botEnabledBefore: null,
  botEnabledDuringPilot: null,
  botEnabledFinal: null,
  recipientCount: 0,
  sentCount: 0,
  enqueuedCount: 0,
  failedCount: 0,
  skippedCount: 0,
  recipients: [],
  databaseCandidateSummary: {
    candidateCount: 0,
    validCandidateCount: 0,
    selectedCount: 0,
  },
  gateBeforeEnable: [],
  gateBeforeSend: [],
  queueAfterPilot: {},
  deadLetterActiveAfterPilot: 0,
  approvalPendingAfterPilot: 0,
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
      .replace(/session-[a-z0-9_-]+/gi, "[session-name]");
  }
  return value;
}

function containsSensitivePayload(value) {
  const text = JSON.stringify(value ?? {});
  return /\.wwebjs_auth|lastQrString|rawQr|qrString|sessionPath|api[_-]?key|password|token|stack/i.test(text);
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

function ensureWhitelistExample() {
  mkdirSync(CONFIG_DIR, { recursive: true });
  if (!existsSync(WHITELIST_EXAMPLE)) {
    writeFileSync(
      WHITELIST_EXAMPLE,
      `${JSON.stringify(
        [
          {
            name: "NAMA PENERIMA PILOT",
            role: "Jabatan internal",
            phone: "628xxxxxxxxxx",
          },
          {
            name: "NAMA PENERIMA PILOT 2",
            role: "Jabatan internal",
            phone: "628xxxxxxxxxx",
          },
        ],
        null,
        2
      )}\n`,
      "utf8"
    );
  }
}

function findWhitelistFile() {
  return WHITELIST_PATHS.find((file) => existsSync(file)) || "";
}

function validateWhitelist(items) {
  const blockers = [];
  const warnings = [];
  if (!Array.isArray(items)) {
    blockers.push("Whitelist harus berupa array.");
    return { ok: false, blockers, warnings, recipients: [] };
  }
  if (items.length < 2) blockers.push("Whitelist minimal 2 penerima untuk pilot kecil.");
  if (items.length > 3) blockers.push("Whitelist maksimal 3 penerima untuk pilot kecil tahap ini.");
  const seen = new Set();
  const recipients = items.map((item, index) => {
    const name = String(item?.name || "").trim();
    const role = String(item?.role || "").trim();
    const phone = normalizePhone(item?.phone);
    const maskedPhone = maskPhone(phone);
    if (!name) blockers.push(`Penerima #${index + 1} tidak punya nama.`);
    if (!role) blockers.push(`Penerima #${index + 1} tidak punya role/jabatan.`);
    if (!/^62\d{8,15}$/.test(phone)) blockers.push(`Penerima #${index + 1} punya nomor tidak valid.`);
    if (/^628x+/i.test(String(item?.phone || "")) || /dummy|contoh/i.test(name)) {
      blockers.push(`Penerima #${index + 1} terlihat seperti dummy/contoh.`);
    }
    if (seen.has(phone)) blockers.push(`Nomor duplikat ditemukan untuk ${maskedPhone}.`);
    seen.add(phone);
    return {
      name,
      role,
      phone,
      maskedPhone,
      slug: slugName(name),
      idempotencyKey: `pilot-wa-small-db-2026-05-02-001-${slugName(name)}`,
    };
  });
  return { ok: blockers.length === 0, blockers, warnings, recipients };
}

function isTruthyDisabled(row = {}) {
  const status = String(row.status || row.account_status || "").toLowerCase();
  return Boolean(
    row.deleted_at ||
      row.blocked_at ||
      row.disabled_at ||
      row.is_blocked === true ||
      row.is_blocked === 1 ||
      row.is_active === false ||
      row.is_active === 0 ||
      ["inactive", "disabled", "blocked", "deleted"].includes(status)
  );
}

function isDummyPhone(phone) {
  const digits = normalizePhone(phone);
  if (!digits) return true;
  if (/^62812345000\d$/.test(digits)) return true;
  if (/^6280+$/.test(digits)) return true;
  if (/^62(\d)\1{7,}$/.test(digits)) return true;
  if (/^628(?:12345678|87654321|11111111|22222222|99999999)/.test(digits)) return true;
  return false;
}

function rolePriority(row = {}) {
  const text = `${row.role_id || ""} ${row.role || ""} ${row.role_name || ""} ${row.position_id || ""} ${row.position || ""} ${row.position_name || ""} ${row.jabatan || ""}`.toLowerCase();
  if (text.includes("super-admin") || text.includes("super admin")) return 1;
  if (/\badmin\b/.test(text)) return 2;
  if (text.includes("ketua") || text.includes("wakil")) return 3;
  if (text.includes("hakim")) return 4;
  if (text.includes("panitera") || text.includes("sekretaris") || text.includes("jurusita")) return 5;
  return 6;
}

function displayRole(row = {}) {
  const raw = String(row.position_name || row.position || row.jabatan || row.role_name || row.role_id || row.role || "").trim();
  if (!raw) return "Pegawai Internal";
  return raw
    .replace(/^pos-/i, "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatRecipientFromRow(row, reason) {
  const name = String(row.name || row.full_name || row.username || "").trim();
  const phone = normalizePhone(row.whatsapp_number || row.whatsappNumber || row.phone || row.phone_number);
  return {
    name,
    role: displayRole(row),
    phone,
    maskedPhone: maskPhone(phone),
    selectionReason: reason,
    priority: rolePriority(row),
    sourceId: String(row.id || row.user_id || ""),
  };
}

async function generateWhitelistFromDatabase(pool) {
  const blockers = [];
  const exclusionCounts = {};
  const addExclusion = (reason) => {
    exclusionCounts[reason] = (exclusionCounts[reason] || 0) + 1;
  };

  if (!pool) {
    return {
      ok: false,
      blockers: ["Database portal tidak tersedia untuk membuat whitelist."],
      whitelist: [],
      report: {
        generatedAt: new Date().toISOString(),
        candidateCount: 0,
        validCandidateCount: 0,
        selectedCount: 0,
        selectedRecipients: [],
        excludedSummary: {},
      },
    };
  }

  const rows = (await query(pool, "SELECT * FROM users")).rows || [];
  const candidates = rows.filter((row) => {
    if (isTruthyDisabled(row)) {
      addExclusion("inactive_blocked_or_deleted");
      return false;
    }
    return true;
  });

  const valid = [];
  for (const row of candidates) {
    const phone = normalizePhone(row.whatsapp_number || row.whatsappNumber || row.phone || row.phone_number);
    const name = String(row.name || row.full_name || row.username || "").trim();
    if (!name) {
      addExclusion("missing_name");
      continue;
    }
    if (!/^62\d{8,15}$/.test(phone)) {
      addExclusion("invalid_or_missing_whatsapp_number");
      continue;
    }
    if (isDummyPhone(phone)) {
      addExclusion("dummy_number");
      continue;
    }
    valid.push(row);
  }

  const byPhone = new Map();
  for (const row of valid) {
    const phone = normalizePhone(row.whatsapp_number || row.whatsappNumber || row.phone || row.phone_number);
    if (byPhone.has(phone)) {
      const existing = byPhone.get(phone);
      const better =
        rolePriority(row) < rolePriority(existing) ||
        (rolePriority(row) === rolePriority(existing) &&
          String(row.name || row.username || "").localeCompare(String(existing.name || existing.username || ""), "id") < 0);
      if (better) byPhone.set(phone, row);
      addExclusion("duplicate_number_collapsed");
      continue;
    }
    byPhone.set(phone, row);
  }
  const uniqueValid = [...byPhone.values()];
  const derryRow = uniqueValid.find((row) => normalizePhone(row.whatsapp_number || row.whatsappNumber || row.phone || row.phone_number) === DERRY_PHONE);
  const selected = [];
  selected.push(
    derryRow
      ? formatRecipientFromRow(derryRow, "Penerima wajib sesuai persetujuan eksplisit dan ditemukan di database.")
      : {
          name: DERRY_NAME,
          role: DERRY_ROLE,
          phone: DERRY_PHONE,
          maskedPhone: maskPhone(DERRY_PHONE),
          selectionReason: "Penerima wajib sesuai persetujuan eksplisit; tidak ditemukan di database.",
          priority: 4,
          sourceId: "explicit-derry",
        }
  );

  const selectedPhones = new Set([DERRY_PHONE]);
  const additional = uniqueValid
    .filter((row) => !selectedPhones.has(normalizePhone(row.whatsapp_number || row.whatsappNumber || row.phone || row.phone_number)))
    .sort((a, b) => {
      const priorityDiff = rolePriority(a) - rolePriority(b);
      if (priorityDiff !== 0) return priorityDiff;
      const nameDiff = String(a.name || a.username || "").localeCompare(String(b.name || b.username || ""), "id");
      if (nameDiff !== 0) return nameDiff;
      return String(a.id || "").localeCompare(String(b.id || ""), "id");
    })
    .slice(0, 2)
    .map((row) => formatRecipientFromRow(row, `Dipilih otomatis berdasarkan prioritas role ${rolePriority(row)} dan urutan nama/id deterministik.`));
  selected.push(...additional);

  if (selected.length < 2) blockers.push("Kandidat valid kurang dari 2 penerima total; pilot kecil tidak dijalankan.");
  if (selected.length > 3) blockers.push("Whitelist otomatis melebihi batas 3 penerima.");

  const whitelist = selected.slice(0, 3).map((recipient) => ({
    name: recipient.name,
    role: recipient.role,
    phone: recipient.phone,
  }));
  const report = {
    generatedAt: new Date().toISOString(),
    candidateCount: candidates.length,
    validCandidateCount: uniqueValid.length,
    selectedCount: whitelist.length,
    selectedRecipients: selected.slice(0, 3).map((recipient) => ({
      name: recipient.name,
      role: recipient.role,
      maskedPhone: recipient.maskedPhone,
      selectionReason: recipient.selectionReason,
      priority: recipient.priority,
    })),
    excludedSummary: exclusionCounts,
  };
  return {
    ok: blockers.length === 0,
    blockers,
    whitelist,
    report,
  };
}

function writeWhitelistArtifacts(generation) {
  mkdirSync(CONFIG_DIR, { recursive: true });
  mkdirSync(REPORT_DIR, { recursive: true });
  writeFileSync(ACTIVE_WHITELIST_PATH, `${JSON.stringify(generation.whitelist, null, 2)}\n`, "utf8");
  const safeReport = sanitizeValue(generation.report);
  if (containsSensitivePayload(safeReport)) throw new Error("Sensitive content detected in whitelist JSON report.");
  writeFileSync(WHITELIST_REPORT_JSON, `${JSON.stringify(safeReport, null, 2)}\n`, "utf8");
  const md = [
    "# ALETA Small WhatsApp Pilot Whitelist",
    "",
    `Generated at: ${safeReport.generatedAt}`,
    "",
    `Database candidates: ${safeReport.candidateCount}`,
    `Valid candidates: ${safeReport.validCandidateCount}`,
    `Selected recipients: ${safeReport.selectedCount}`,
    "",
    "## Selected",
    ...(safeReport.selectedRecipients.length
      ? safeReport.selectedRecipients.map(
          (recipient) =>
            `- ${recipient.name} (${recipient.role}), ${recipient.maskedPhone}: ${recipient.selectionReason}`
        )
      : ["- Tidak ada penerima dipilih."]),
    "",
    "## Excluded Summary",
    ...Object.entries(safeReport.excludedSummary || {}).map(([reason, count]) => `- ${reason}: ${count}`),
  ].join("\n");
  if (containsSensitivePayload(md)) throw new Error("Sensitive content detected in whitelist Markdown report.");
  writeFileSync(WHITELIST_REPORT_MD, `${md}\n`, "utf8");
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
    addGate("gateBeforeEnable", "portal_db", "Portal database", "FAIL", `Koneksi DB portal gagal: ${sanitizeError(error)}.`);
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

async function verifyRecipientsInternal(pool, recipients) {
  if (!pool) return recipients.map((recipient) => ({ ...recipient, internalFound: false }));
  const rows = (await query(pool, "SELECT * FROM users")).rows || [];
  const active = rows.filter((row) => !row.deleted_at && row.is_active !== false && row.is_active !== 0);
  return recipients.map((recipient) => ({
    ...recipient,
    internalFound: active.some((row) => normalizePhone(row.whatsapp_number) === recipient.phone),
  }));
}

async function countPendingApprovals(pool) {
  const queryResult = await query(
    pool,
    "SELECT COUNT(*)::int AS count FROM aleta_bot_approval_requests WHERE status = 'pending'"
  );
  return Number(queryResult.rows?.[0]?.count ?? 0);
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
      smallPilotAudit: {
        changedBy: "aleta-whatsapp-small-pilot.mjs",
        changedAt,
        oldValue: Boolean(config.parsed.botEnabled),
        newValue: enabled,
        reason,
      },
    };
    writeFileSync(config.file, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  }
  appendFileSync(AUDIT_JSONL, `${JSON.stringify({ changedAt, newValue: enabled, reason })}\n`, "utf8");
}

function restoreRuntimeConfigFiles(configs) {
  for (const config of configs) writeFileSync(config.file, config.raw, "utf8");
}

async function getRuntimeSnapshot() {
  const [statusResponse, waResponse, diagnosticsResponse, queueResponse, activeDeadLettersResponse] = await Promise.all([
    fetchJson(`${BOT_BASE_URL}/internal/aleta-bot/status`, { headers: internalHeaders() }),
    fetchJson(`${BOT_BASE_URL}/internal/aleta-bot/whatsapp/status`, { headers: internalHeaders() }),
    fetchJson(`${BOT_BASE_URL}/internal/aleta-bot/whatsapp/diagnostics`, { headers: internalHeaders() }),
    fetchJson(`${BOT_BASE_URL}/internal/aleta-bot/queue?limit=80`, { headers: internalHeaders() }),
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
  const config = readJsonFile(RUNTIME_CONFIG_PATHS.find((file) => existsSync(file)) || "") || {};
  const reminder = config.dispositionDeadlineReminder || {};
  const scheduler = reminder.scheduler || {};
  return {
    rawOk: statusResponse.ok && waResponse.ok && diagnosticsResponse.ok && queueResponse.ok,
    whatsappStatus: String(whatsapp.status || diagnostics.status || "unknown").toLowerCase(),
    initializing: Boolean(whatsapp.initializing ?? diagnostics.initializing),
    lastErrorType: String(whatsapp.lastErrorType || diagnostics.lastErrorType || ""),
    initializeAgeMs: Number(whatsapp.initializeAgeMs ?? diagnostics.initializeAgeMs ?? 0),
    botEnabled: Boolean(statusData.bot?.botEnabled ?? statusData.bot?.enabled ?? config.botEnabled),
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

function latestQueueItem(snapshot, queueId) {
  return (snapshot.queueItems || []).find((item) => item.id === queueId) || null;
}

async function sendPilotMessage(recipient) {
  const isDerry = /derry briantono/i.test(recipient.name);
  const response = await fetchJson(`${BOT_BASE_URL}/internal/aleta-bot/messages/enqueue`, {
    method: "POST",
    headers: internalHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({
      sourceApp: "aleta_pilot",
      sourceFeature: "small_internal_whatsapp_pilot",
      entityType: "pilot_test",
      entityId: `small-pilot-2026-05-02-${recipient.slug}`,
      recipientNumber: recipient.phone,
      recipientName: recipient.name,
      message: isDerry ? DERRY_MESSAGE : MESSAGE_DEFAULT,
      category: "manual",
      priority: 1,
      dryRun: false,
      idempotencyKey: recipient.idempotencyKey,
      metadata: {
        recipientType: "employee",
        recipientRole: recipient.role,
        smallPilot: true,
        whitelistOnly: true,
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

async function pollQueueItems(queueIds, maxWaitMs = 120000) {
  const startedAt = Date.now();
  let snapshot = await getRuntimeSnapshot();
  while (Date.now() - startedAt < maxWaitMs) {
    const statuses = queueIds.map((id) => latestQueueItem(snapshot, id)?.status || "unknown");
    if (statuses.every((status) => ["sent", "failed", "resolved", "skipped", "dry_run"].includes(String(status).toLowerCase()))) {
      return snapshot;
    }
    await new Promise((resolve) => setTimeout(resolve, 3000));
    snapshot = await getRuntimeSnapshot();
  }
  return snapshot;
}

function writeReports() {
  mkdirSync(REPORT_DIR, { recursive: true });
  const safe = sanitizeValue(result);
  if (containsSensitivePayload(safe)) throw new Error("Sensitive content detected in JSON report.");
  writeFileSync(REPORT_JSON, `${JSON.stringify(safe, null, 2)}\n`, "utf8");
  const md = [
    "# ALETA Small Internal WhatsApp Pilot",
    "",
    `Generated at: ${safe.generatedAt}`,
    "",
    `Overall: ${safe.overall}`,
    `Recipient count: ${safe.recipientCount}`,
    `Sent count: ${safe.sentCount}`,
    `Enqueued count: ${safe.enqueuedCount}`,
    `botEnabled before/during/final: ${safe.botEnabledBefore}/${safe.botEnabledDuringPilot}/${safe.botEnabledFinal}`,
    "",
    "## Recipients",
    ...(safe.recipients.length
      ? safe.recipients.map((recipient) => `- ${recipient.name} (${recipient.role}), ${recipient.maskedPhone}: ${recipient.deliveryStatus || "-"}`)
      : ["- Tidak ada whitelist aktif."]),
    "",
    "## Gates Before Enable",
    ...safe.gateBeforeEnable.map((gate) => `- ${gate.status} - ${gate.label}: ${gate.detail}`),
    "",
    "## Gates Before Send",
    ...(safe.gateBeforeSend.length ? safe.gateBeforeSend.map((gate) => `- ${gate.status} - ${gate.label}: ${gate.detail}`) : ["- Tidak dijalankan."]),
    "",
    "## Queue After Pilot",
    `- pending=${safe.queueAfterPilot.pending ?? "-"}, processing=${safe.queueAfterPilot.processing ?? "-"}, failed=${safe.queueAfterPilot.failed ?? "-"}, sent=${safe.queueAfterPilot.sent ?? "-"}, skipped=${safe.queueAfterPilot.skipped ?? "-"}`,
    `- dead-letter active=${safe.deadLetterActiveAfterPilot}`,
    `- approval pending=${safe.approvalPendingAfterPilot}`,
    "",
    "## Actions",
    ...(safe.actionsTaken.length ? safe.actionsTaken.map((action) => `- ${action.action}: ${action.detail}`) : ["- Tidak ada aksi."]),
    "",
    "## Blockers",
    ...(safe.blockers.length ? safe.blockers.map((blocker) => `- ${blocker.label}: ${blocker.detail}`) : ["- Tidak ada blocker."]),
    "",
    "## Warnings",
    ...(safe.warnings.length ? safe.warnings.map((warning) => `- ${warning.label || warning.key}: ${warning.detail}`) : ["- Tidak ada warning."]),
  ].join("\n");
  if (containsSensitivePayload(md)) throw new Error("Sensitive content detected in Markdown report.");
  writeFileSync(REPORT_MD, `${md}\n`, "utf8");
}

async function main() {
  mkdirSync(REPORT_DIR, { recursive: true });
  ensureWhitelistExample();
  const preflight = readJsonFile(PREFLIGHT_JSON);
  const smoke = readJsonFile(SMOKE_JSON);
  const pool = await openPortalDb();
  const generation = await generateWhitelistFromDatabase(pool);
  result.databaseCandidateSummary = {
    candidateCount: generation.report.candidateCount,
    validCandidateCount: generation.report.validCandidateCount,
    selectedCount: generation.report.selectedCount,
  };
  writeWhitelistArtifacts(generation);
  if (!generation.ok) {
    for (const blocker of generation.blockers) {
      result.blockers.push({
        key: "whitelist_generation_failed",
        label: "Whitelist database tidak valid",
        detail: blocker,
      });
    }
    addAction("generate_database_whitelist", "Whitelist otomatis dibuat dari database, tetapi belum memenuhi gate pilot.");
    result.overall = "FAIL";
    await pool?.end();
    writeReports();
    console.log(`ALETA small WhatsApp pilot ${result.overall}. Whitelist generation blocked. Report: ${REPORT_MD}`);
    return;
  }
  addAction("generate_database_whitelist", `Whitelist otomatis dibuat di ${ACTIVE_WHITELIST_PATH}.`);
  const whitelistFile = ACTIVE_WHITELIST_PATH;
  const whitelistValidation = validateWhitelist(readJsonFile(whitelistFile));
  const verifiedRecipients = await verifyRecipientsInternal(pool, whitelistValidation.recipients);
  result.recipients = verifiedRecipients.map((recipient) => ({
    name: recipient.name,
    role: recipient.role,
    maskedPhone: recipient.maskedPhone,
    internalFound: recipient.internalFound,
    deliveryStatus: "not_started",
  }));
  result.recipientCount = verifiedRecipients.length;
  const before = await getRuntimeSnapshot();
  const approvalPendingBefore = await countPendingApprovals(pool);
  result.botEnabledBefore = before.botEnabled;
  result.summary.before = sanitizeValue({ whatsappStatus: before.whatsappStatus, worker: before.worker, queue: before.queue, reminder: before.reminder });

  addGate("gateBeforeEnable", "preflight_latest", "Preflight terakhir", preflight && preflight.overall !== "FAIL" ? "PASS" : "FAIL", preflight ? `overall=${preflight.overall}.` : "Tidak tersedia.");
  addGate("gateBeforeEnable", "smoke_latest", "Smoke dry-run terakhir", smoke?.overall === "PASS" && smoke?.safeForLimitedWhatsAppPilot ? "PASS" : "FAIL", smoke ? `overall=${smoke.overall}.` : "Tidak tersedia.");
  addGate("gateBeforeEnable", "whitelist_valid", "Whitelist valid", whitelistValidation.ok ? "PASS" : "FAIL", whitelistValidation.ok ? `${verifiedRecipients.length} penerima whitelist valid.` : whitelistValidation.blockers.join(" "));
  for (const recipient of verifiedRecipients) {
    if (!recipient.internalFound) {
      addGate("gateBeforeEnable", `recipient_internal_${recipient.slug}`, `Penerima internal ${recipient.name}`, "FAIL", `${recipient.maskedPhone} tidak ditemukan sebagai user internal aktif.`);
    }
  }
  addGate("gateBeforeEnable", "runtime_reachable", "Runtime reachable", before.rawOk ? "PASS" : "FAIL", "Status runtime, WhatsApp, diagnostics, dan queue dibaca.");
  addGate("gateBeforeEnable", "whatsapp_connected", "WhatsApp connected", before.whatsappStatus === "connected" ? "PASS" : "FAIL", `status=${before.whatsappStatus}.`);
  addGate("gateBeforeEnable", "whatsapp_not_stuck", "WhatsApp tidak lock/stuck", before.lastErrorType === "browser_locked" || before.lastErrorType === "initialize_timeout" || before.initializeAgeMs > 120000 ? "FAIL" : "PASS", `lastErrorType=${before.lastErrorType || "-"}, initializing=${before.initializing}.`);
  addGate("gateBeforeEnable", "worker_operational", "Worker operasional", before.worker.enabled && before.worker.activeTimer && !before.worker.paused ? "PASS" : "FAIL", `enabled=${before.worker.enabled}, activeTimer=${before.worker.activeTimer}, paused=${before.worker.paused}.`);
  addGate("gateBeforeEnable", "queue_empty", "Queue kosong", before.queue.pending === 0 && before.queue.processing === 0 && before.queue.failed === 0 ? "PASS" : "FAIL", `pending=${before.queue.pending}, processing=${before.queue.processing}, failed=${before.queue.failed}.`);
  addGate("gateBeforeEnable", "dead_letter_zero", "Dead-letter aktif", before.activeDeadLetters.length === 0 ? "PASS" : "FAIL", `${before.activeDeadLetters.length} dead-letter aktif.`);
  addGate("gateBeforeEnable", "approval_zero", "Approval pending", approvalPendingBefore === 0 ? "PASS" : "FAIL", `${approvalPendingBefore} approval pending.`);
  addGate("gateBeforeEnable", "safe_window_allowed", "Safe Sending Window allowed", before.safeSendingWindow.enabled && before.safeSendingWindow.allowed ? "PASS" : "FAIL", `enabled=${before.safeSendingWindow.enabled}, ${before.safeSendingWindow.start}-${before.safeSendingWindow.end}, allowed=${before.safeSendingWindow.allowed}.`);
  result.schedulerProductionActive = before.reminder.schedulerEnabled && before.reminder.schedulerMode === "production";
  result.reminderProductionActive = before.reminder.enabled && before.reminder.mode === "production";
  addGate("gateBeforeEnable", "production_disabled", "Scheduler/reminder non-production", !result.schedulerProductionActive && !result.reminderProductionActive && !before.reminder.killSwitch ? "PASS" : "FAIL", `reminder=${before.reminder.enabled}/${before.reminder.mode}, scheduler=${before.reminder.schedulerEnabled}/${before.reminder.schedulerMode}.`);

  if (result.blockers.length > 0) {
    addAction("pilot_skipped", "Pilot tidak dijalankan karena gate belum aman.");
    result.botEnabledFinal = before.botEnabled;
    result.overall = "FAIL";
    await pool?.end();
    writeReports();
    console.log(`ALETA small WhatsApp pilot ${result.overall}. Report: ${REPORT_MD}`);
    return;
  }

  const configs = readRuntimeConfigFiles();
  let finalSnapshot = null;
  try {
    writeRuntimeConfigFiles(configs, true, ENABLE_REASON);
    addAction("enable_bot_temporarily", "botEnabled=true ditulis sementara untuk pilot whitelist kecil.");
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const afterEnable = await getRuntimeSnapshot();
    result.botEnabledDuringPilot = afterEnable.botEnabled;
    addGate("gateBeforeSend", "bot_enabled", "botEnabled true", afterEnable.botEnabled ? "PASS" : "FAIL", `botEnabled=${afterEnable.botEnabled}.`);
    addGate("gateBeforeSend", "queue_still_empty", "Queue tetap kosong", afterEnable.queue.pending === 0 && afterEnable.queue.processing === 0 && afterEnable.queue.failed === 0 ? "PASS" : "FAIL", `pending=${afterEnable.queue.pending}, processing=${afterEnable.queue.processing}, failed=${afterEnable.queue.failed}.`);
    addGate("gateBeforeSend", "production_still_disabled", "Production tetap disabled", !afterEnable.reminder.enabled && afterEnable.reminder.mode !== "production" && !afterEnable.reminder.schedulerEnabled && afterEnable.reminder.schedulerMode !== "production" ? "PASS" : "FAIL", `reminder=${afterEnable.reminder.enabled}/${afterEnable.reminder.mode}, scheduler=${afterEnable.reminder.schedulerEnabled}/${afterEnable.reminder.schedulerMode}.`);

    if (result.blockers.length === 0) {
      const sentQueueIds = [];
      for (const recipient of verifiedRecipients) {
        const sendResult = await sendPilotMessage(recipient);
        const reportRecipient = result.recipients.find((item) => item.maskedPhone === recipient.maskedPhone && item.name === recipient.name);
        if (sendResult.ok) {
          sentQueueIds.push(sendResult.queueId);
          result.enqueuedCount += sendResult.duplicate ? 0 : 1;
          if (reportRecipient) {
            reportRecipient.queueId = sendResult.queueId;
            reportRecipient.deliveryStatus = sendResult.duplicate ? "duplicate" : "queued";
          }
        } else {
          result.failedCount += 1;
          if (reportRecipient) reportRecipient.deliveryStatus = "enqueue_failed";
          result.warnings.push({ key: "enqueue_failed", label: `Enqueue ${recipient.name}`, detail: sendResult.error || "Gagal enqueue." });
        }
      }
      const afterPoll = await pollQueueItems(sentQueueIds);
      for (const recipient of verifiedRecipients) {
        const reportRecipient = result.recipients.find((item) => item.maskedPhone === recipient.maskedPhone && item.name === recipient.name);
        if (!reportRecipient?.queueId) continue;
        const queueItem = latestQueueItem(afterPoll, reportRecipient.queueId);
        const status = String(queueItem?.status || reportRecipient.deliveryStatus || "unknown");
        reportRecipient.deliveryStatus = status;
        if (status === "sent") result.sentCount += 1;
        if (status === "failed") result.failedCount += 1;
        if (status === "skipped") result.skippedCount += 1;
      }
      finalSnapshot = afterPoll;
    } else {
      addAction("send_skipped", "Pesan tidak dikirim karena gate sebelum send belum aman.");
    }
  } finally {
    restoreRuntimeConfigFiles(configs);
    addAction("disable_bot_after_pilot", "botEnabled dikembalikan ke nilai awal setelah pilot kecil.");
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  finalSnapshot = await getRuntimeSnapshot();
  result.botEnabledFinal = finalSnapshot.botEnabled;
  result.deadLetterActiveAfterPilot = finalSnapshot.activeDeadLetters.length;
  result.approvalPendingAfterPilot = await countPendingApprovals(pool);
  result.schedulerProductionActive = finalSnapshot.reminder.schedulerEnabled && finalSnapshot.reminder.schedulerMode === "production";
  result.reminderProductionActive = finalSnapshot.reminder.enabled && finalSnapshot.reminder.mode === "production";
  result.queueAfterPilot = {
    pending: finalSnapshot.queue.pending,
    processing: finalSnapshot.queue.processing,
    failed: finalSnapshot.queue.failed,
    sent: finalSnapshot.queue.sent,
    skipped: finalSnapshot.queue.skipped,
    deadLetter: finalSnapshot.queue.deadLetter,
    activeDeadLetters: finalSnapshot.activeDeadLetters.length,
  };
  result.summary.after = sanitizeValue({ whatsappStatus: finalSnapshot.whatsappStatus, worker: finalSnapshot.worker, queue: finalSnapshot.queue, reminder: finalSnapshot.reminder });

  if (result.enqueuedCount > verifiedRecipients.length) result.blockers.push({ key: "over_enqueue", label: "Jumlah enqueue melebihi whitelist", detail: `${result.enqueuedCount}/${verifiedRecipients.length}.` });
  if (result.deadLetterActiveAfterPilot > 0) result.blockers.push({ key: "dead_letter_after", label: "Dead-letter setelah pilot", detail: `${result.deadLetterActiveAfterPilot} dead-letter aktif.` });
  if (result.schedulerProductionActive || result.reminderProductionActive) result.blockers.push({ key: "production_active", label: "Production aktif", detail: "Scheduler/reminder production aktif setelah pilot." });
  if (result.botEnabledFinal !== result.botEnabledBefore) result.warnings.push({ key: "bot_enabled_final_changed", label: "botEnabled final berubah", detail: `Final=${result.botEnabledFinal}, before=${result.botEnabledBefore}.` });
  if (result.sentCount < verifiedRecipients.length) result.warnings.push({ key: "not_all_sent", label: "Tidak semua penerima sent", detail: `${result.sentCount}/${verifiedRecipients.length} sent.` });
  result.overall = result.blockers.length > 0 ? "FAIL" : result.sentCount === verifiedRecipients.length ? "PASS" : "WARN";
  await pool?.end();
  writeReports();
  console.log(`ALETA small WhatsApp pilot ${result.overall}. Report: ${REPORT_MD}`);
}

main().catch((error) => {
  result.overall = "FAIL";
  result.blockers.push({ key: "runner_crashed", label: "Runner gagal", detail: sanitizeError(error) });
  try {
    writeReports();
  } catch {
    // keep output safe
  }
  console.error(`ALETA small WhatsApp pilot failed: ${sanitizeError(error)}`);
  process.exitCode = 1;
});
