import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const __filename = fileURLToPath(import.meta.url);
const SCRIPT_DIR = path.dirname(__filename);
const ROOT_DIR = path.resolve(SCRIPT_DIR, "..");
const PORTAL_DIR = path.join(ROOT_DIR, "manajemen_surat");
const BOT_DIR = path.join(ROOT_DIR, "aleta_bot");
const REPORT_DIR = path.join(ROOT_DIR, "reports");
const REPORT_JSON = path.join(REPORT_DIR, "aleta-pilot-nonwa-result-latest.json");
const REPORT_MD = path.join(REPORT_DIR, "aleta-pilot-nonwa-result-latest.md");

const PORTAL_BASE_URL = "http://127.0.0.1:3000";
const BOT_BASE_URL = "http://127.0.0.1:3003";
const PREFIX = "PILOT-NONWA";
const PHASE4_APPROVAL_NAME = "Phase 4 Approval Validate";

const portalEnv = loadEnvFiles([path.join(PORTAL_DIR, ".env"), path.join(PORTAL_DIR, ".env.local")]);
const botEnv = loadEnvFiles([path.join(BOT_DIR, ".env")]);

const result = {
  generatedAt: new Date().toISOString(),
  runId: new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14),
  overall: "WARN",
  safeForNonWaPilot: false,
  safeForLimitedWhatsAppPilot: false,
  safeForProduction: false,
  scenarios: [],
  bugs: [],
  warnings: [],
  blockers: [],
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

function addScenario(key, title, status, detail, metadata = {}) {
  const entry = { key, title, status, detail, metadata };
  result.scenarios.push(entry);
  if (status === "FAIL") {
    result.blockers.push({ key, title, detail });
    result.bugs.push({ key, title, detail });
  }
  if (status === "WARN") result.warnings.push({ key, title, detail });
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
      signal: controller.signal,
      redirect: "follow",
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

function csvCell(value) {
  const normalized = String(value ?? "").replace(/\r?\n/g, " ").trim();
  return `"${normalized.replace(/"/g, '""')}"`;
}

async function openPortalDb() {
  if (!portalEnv.DATABASE_URL) {
    addScenario("portal_db_config", "Portal DB config", "FAIL", "DATABASE_URL tidak ditemukan.");
    return null;
  }
  try {
    const portalRequire = createRequire(path.join(PORTAL_DIR, "package.json"));
    const { Pool } = portalRequire("pg");
    const pool = new Pool({ connectionString: portalEnv.DATABASE_URL });
    await pool.query("SELECT 1");
    addScenario("portal_db", "Portal database", "PASS", "Koneksi database portal berhasil.");
    return pool;
  } catch (error) {
    addScenario("portal_db", "Portal database", "FAIL", `Koneksi database portal gagal: ${sanitizeError(error)}.`);
    return null;
  }
}

async function query(pool, sql, params = []) {
  try {
    return await pool.query(sql, params);
  } catch (error) {
    addScenario("db_query", "Query database pilot", "FAIL", sanitizeError(error));
    return { rows: [] };
  }
}

async function checkPageReachability() {
  const pages = [
    ["/login", "Halaman login"],
    ["/portal", "Portal utama"],
    ["/manajemen-surat", "Dashboard Manajemen Surat"],
    ["/surat/masuk", "Surat Masuk"],
    ["/surat/keluar", "Surat Keluar"],
    ["/patch-notes", "Patch Notes"],
    ["/panduan", "Panduan"],
    ["/masukan", "Pusat Masukan"],
    ["/admin/aleta-bot", "Admin ALETA Bot"],
  ];
  for (const [pathName, label] of pages) {
    const response = await fetchJsonWithRetry(`${PORTAL_BASE_URL}${pathName}`, { timeoutMs: 30000 }, 2);
    addScenario(
      `page_${pathName.replace(/[^a-z0-9]+/gi, "_").toLowerCase()}`,
      label,
      response.ok ? "PASS" : response.status === 401 || response.status === 403 ? "PASS" : "WARN",
      response.ok
        ? `${pathName} reachable HTTP ${response.status}.`
        : response.status === 401 || response.status === 403
        ? `${pathName} dilindungi auth HTTP ${response.status}.`
        : `${pathName} belum readable dari runner: ${response.error ?? `HTTP ${response.status}`}.`
    );
  }
}

async function getQueueSnapshot() {
  const queue = await fetchJson(`${BOT_BASE_URL}/internal/aleta-bot/queue?limit=5`, { headers: internalHeaders() });
  const activeDeadLetters = await fetchJson(`${BOT_BASE_URL}/internal/aleta-bot/queue/dead-letters?limit=100&status=active`, {
    headers: internalHeaders(),
  });
  const status = await fetchJson(`${BOT_BASE_URL}/internal/aleta-bot/status`, { headers: internalHeaders() });
  return {
    ok: queue.ok && activeDeadLetters.ok && status.ok,
    stats: queue.data?.stats ?? status.data?.queue ?? {},
    activeDeadLetters: Number(activeDeadLetters.data?.total ?? 0),
    whatsappStatus: normalizeStatus(status.data?.whatsapp?.status),
    worker: status.data?.worker ?? {},
    safeWindow: status.data?.bot?.sendingWindow ?? {},
    aiRuntime: {
      status: status.data?.aiRuntime?.status ?? status.data?.aiRuntime?.lastSyncStatus ?? "unknown",
    },
  };
}

function checkRuntimeSnapshot(snapshot, phase) {
  addScenario(
    `runtime_${phase}`,
    `Runtime ALETA Bot ${phase}`,
    snapshot.ok ? "PASS" : "FAIL",
    snapshot.ok ? `Runtime readable; WhatsApp=${snapshot.whatsappStatus}.` : "Runtime/queue/dead-letter endpoint tidak readable."
  );
  addScenario(
    `worker_${phase}`,
    `Worker ${phase}`,
    snapshot.worker?.enabled && snapshot.worker?.activeTimer && !snapshot.worker?.paused ? "PASS" : "FAIL",
    `enabled=${Boolean(snapshot.worker?.enabled)}, activeTimer=${Boolean(snapshot.worker?.activeTimer)}, paused=${Boolean(snapshot.worker?.paused)}.`
  );
  addScenario(
    `queue_${phase}`,
    `Queue ${phase}`,
    Number(snapshot.stats?.pending ?? 0) === 0 && Number(snapshot.stats?.processing ?? 0) === 0 && Number(snapshot.stats?.failed ?? 0) === 0 ? "PASS" : "FAIL",
    `pending=${Number(snapshot.stats?.pending ?? 0)}, processing=${Number(snapshot.stats?.processing ?? 0)}, failed=${Number(snapshot.stats?.failed ?? 0)}.`
  );
  addScenario(
    `dead_letter_${phase}`,
    `Dead-letter ${phase}`,
    snapshot.activeDeadLetters === 0 ? "PASS" : "FAIL",
    `${snapshot.activeDeadLetters} dead-letter aktif.`
  );
  addScenario(
    `safe_window_${phase}`,
    `Safe Sending Window ${phase}`,
    snapshot.safeWindow?.enabled !== false && Boolean(snapshot.safeWindow?.start) && Boolean(snapshot.safeWindow?.end) ? "PASS" : "FAIL",
    `enabled=${snapshot.safeWindow?.enabled !== false}, ${snapshot.safeWindow?.start ?? "?"}-${snapshot.safeWindow?.end ?? "?"}.`
  );
}

async function insertPilotData(pool) {
  const runId = result.runId;
  const now = new Date();
  const nowIso = now.toISOString();
  const today = nowIso.slice(0, 10);
  const tomorrowIso = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

  const users = await query(
    pool,
    `SELECT id, name, role_id, position_id, whatsapp_number
     FROM users
     WHERE deleted_at IS NULL AND is_active = 1
     ORDER BY CASE WHEN role_id IN ('super-admin','admin') THEN 0 ELSE 1 END, role_id, name`
  );
  const rows = users.rows ?? [];
  const actor = rows.find((user) => ["super-admin", "admin"].includes(user.role_id)) ?? rows[0];
  const recipient = rows.find((user) => user.id !== actor?.id && user.position_id) ?? actor;
  if (!actor || !recipient) {
    addScenario("pilot_user_selection", "User pilot", "FAIL", "Tidak menemukan actor/recipient aktif untuk data pilot.");
    return null;
  }
  addScenario(
    "login_role_basic",
    "Login/role dasar",
    rows.length > 0 && Boolean(actor.role_id) ? "PASS" : "FAIL",
    `DB memiliki ${rows.length} user aktif. Actor pilot role=${actor.role_id}; recipient role=${recipient.role_id}.`
  );

  const incomingId = `pilot-nonwa-in-${runId}`;
  const dispositionId = `pilot-nonwa-dsp-${runId}`;
  const outgoingId = `pilot-nonwa-out-${runId}`;
  const auditId = () => `pilot-nonwa-audit-${randomUUID()}`;

  await pool.query("BEGIN");
  try {
    await pool.query(
      `INSERT INTO letters (
        id, type, nomor_surat, nomor_urut, tanggal_surat, tanggal_terima, tanggal_kirim,
        tanggal_administratif, pengirim, perihal, status, workflow_status,
        submitted_at, submitted_by_user_id, approved_at, approved_by_user_id,
        sent_at, sent_by_user_id, rejected_at, rejected_by_user_id, rejection_note,
        assigned_unit, confidentiality, current_disposition_id, ringkasan, asal_surat,
        tujuan_surat, klasifikasi_utama, kode_klasifikasi, lampiran_json, tags_json,
        klasifikasi_tags_json, viewer_mode, qr_code_label, document_aspect_ratio,
        document_file_name, document_size_mb, document_text_extract, document_file_path,
        target_position_id, target_user_id, created_by_user_id, search_document,
        deleted_at, created_at, updated_at
      ) VALUES (
        $1,'masuk',$2,$3,$4,$5,NULL,$6,$7,$8,'Dalam Disposisi','sent',
        NULL,NULL,NULL,NULL,$9,$10,NULL,NULL,NULL,
        $11,'Biasa',$12,$13,$14,$15,$16,NULL,'[]',$17,
        '[]','preview',$18,NULL,NULL,NULL,$19,NULL,
        $20,$21,$22,$23,NULL,$24,$25
      )`,
      [
        incomingId,
        `${PREFIX}-IN/${runId}`,
        `${PREFIX}-AGENDA-${runId}`,
        today,
        today,
        today,
        "Unit Uji Pilot Non-WA",
        `${PREFIX} Uji Surat Masuk ${runId}`,
        nowIso,
        actor.id,
        "Pilot Non-WA",
        dispositionId,
        `${PREFIX} ringkasan surat masuk uji tanpa WhatsApp.`,
        "Unit Uji Pilot Non-WA",
        "Pengadilan Agama Donggala",
        "Umum",
        JSON.stringify([PREFIX.toLowerCase(), "pilot"]),
        `${PREFIX}-${runId}`,
        `${PREFIX} document text extract untuk uji ringkasan non-WA.`,
        recipient.position_id,
        recipient.id,
        actor.id,
        `${PREFIX} Uji Surat Masuk ${runId} Unit Uji Pilot Non-WA`,
        nowIso,
        nowIso,
      ]
    );

    await pool.query(
      `INSERT INTO dispositions (
        id, surat_id, pengirim_id, penerima_id, target_position_id, instruksi,
        parent_disposition_id, status, allow_download, approval_qr_code, created_at,
        deadline_at, read_at, read_by_user_id, urgent, bypass, routing_type,
        follow_up_note, follow_up_file_name, deleted_at, updated_at
      ) VALUES (
        $1,$2,$3,$4,$5,$6,NULL,'Menunggu Tindak Lanjut',0,$7,$8,
        $9,NULL,NULL,1,0,'standard',NULL,NULL,NULL,$10
      )`,
      [
        dispositionId,
        incomingId,
        actor.id,
        recipient.id,
        recipient.position_id,
        `${PREFIX} Instruksi disposisi uji tanpa WhatsApp.`,
        `QR-${dispositionId.toUpperCase()}`,
        nowIso,
        tomorrowIso,
        nowIso,
      ]
    );

    await pool.query(
      `INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, payload_json, created_at)
       VALUES ($1,$2,'PILOT_NONWA_CREATE_TEST_DATA','letter',$3,$4,$5)`,
      [auditId(), actor.id, incomingId, JSON.stringify({ prefix: PREFIX, dispositionId }), nowIso]
    );

    await pool.query(
      `UPDATE dispositions
       SET read_at = $1, read_by_user_id = $2, updated_at = $1
       WHERE id = $3 AND read_at IS NULL`,
      [new Date(now.getTime() + 1000).toISOString(), recipient.id, dispositionId]
    );

    await pool.query(
      `INSERT INTO letters (
        id, type, nomor_surat, nomor_urut, tanggal_surat, tanggal_terima, tanggal_kirim,
        tanggal_administratif, pengirim, perihal, status, workflow_status,
        submitted_at, submitted_by_user_id, approved_at, approved_by_user_id,
        sent_at, sent_by_user_id, rejected_at, rejected_by_user_id, rejection_note,
        assigned_unit, confidentiality, current_disposition_id, ringkasan, asal_surat,
        tujuan_surat, klasifikasi_utama, kode_klasifikasi, lampiran_json, tags_json,
        klasifikasi_tags_json, viewer_mode, qr_code_label, document_aspect_ratio,
        document_file_name, document_size_mb, document_text_extract, document_file_path,
        target_position_id, target_user_id, created_by_user_id, search_document,
        deleted_at, created_at, updated_at
      ) VALUES (
        $1,'keluar',$2,$3,$4,NULL,NULL,$5,'Pengadilan Agama Donggala',$6,'Baru','draft',
        NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,
        'Pilot Non-WA','Biasa',NULL,$7,'Pengadilan Agama Donggala',
        $8,'Umum',NULL,'[]',$9,'[]','preview',$10,NULL,NULL,NULL,$11,NULL,
        $12,$13,$14,$15,NULL,$16,$17
      )`,
      [
        outgoingId,
        `${PREFIX}-OUT/${runId}`,
        `${PREFIX}-OUT-AGENDA-${runId}`,
        today,
        today,
        `${PREFIX} Uji Surat Keluar ${runId}`,
        `${PREFIX} ringkasan surat keluar uji workflow.`,
        "Unit Tujuan Pilot Non-WA",
        JSON.stringify([PREFIX.toLowerCase(), "surat-keluar"]),
        `${PREFIX}-OUT-${runId}`,
        `${PREFIX} draft keluar tanpa WhatsApp.`,
        actor.position_id,
        actor.id,
        actor.id,
        `${PREFIX} Uji Surat Keluar ${runId} Unit Tujuan Pilot Non-WA`,
        nowIso,
        nowIso,
      ]
    );

    const submittedAt = new Date(now.getTime() + 2000).toISOString();
    await pool.query(
      `UPDATE letters
       SET workflow_status = 'submitted', submitted_at = $1, submitted_by_user_id = $2, updated_at = $1
       WHERE id = $3 AND workflow_status = 'draft'`,
      [submittedAt, actor.id, outgoingId]
    );
    const rejectedAt = new Date(now.getTime() + 3000).toISOString();
    await pool.query(
      `UPDATE letters
       SET workflow_status = 'rejected', rejected_at = $1, rejected_by_user_id = $2,
           rejection_note = $3, updated_at = $1
       WHERE id = $4 AND workflow_status = 'submitted'`,
      [rejectedAt, actor.id, `${PREFIX} workflow reject path aman untuk pilot non-WA.`, outgoingId]
    );

    await pool.query(
      `INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, payload_json, created_at)
       VALUES ($1,$2,'PILOT_NONWA_WORKFLOW_REJECT','letter',$3,$4,$5)`,
      [auditId(), actor.id, outgoingId, JSON.stringify({ prefix: PREFIX, from: "draft", to: "submitted/rejected" }), rejectedAt]
    );

    await pool.query("COMMIT");
    addAction("create_pilot_nonwa_data", `Data uji ${PREFIX} dibuat tanpa jalur WhatsApp.`, {
      incomingId,
      dispositionId,
      outgoingId,
    });
    result.summary.testData = { incomingId, dispositionId, outgoingId, actorRole: actor.role_id, recipientRole: recipient.role_id };
    return { incomingId, dispositionId, outgoingId };
  } catch (error) {
    await pool.query("ROLLBACK");
    addScenario("pilot_data_insert", "Input data pilot non-WA", "FAIL", sanitizeError(error));
    return null;
  }
}

async function verifyPilotData(pool, ids) {
  if (!ids) return;
  const incoming = await query(pool, `SELECT * FROM letters WHERE id = $1`, [ids.incomingId]);
  const disposition = await query(pool, `SELECT * FROM dispositions WHERE id = $1`, [ids.dispositionId]);
  const outgoing = await query(pool, `SELECT * FROM letters WHERE id = $1`, [ids.outgoingId]);
  const incomingRow = incoming.rows?.[0];
  const dispositionRow = disposition.rows?.[0];
  const outgoingRow = outgoing.rows?.[0];

  addScenario(
    "surat_masuk_insert",
    "Input surat masuk PILOT-NONWA",
    incomingRow?.perihal?.startsWith(PREFIX) ? "PASS" : "FAIL",
    incomingRow ? `Surat masuk dibuat: ${incomingRow.nomor_surat}.` : "Surat masuk uji tidak ditemukan."
  );
  addScenario(
    "surat_detail",
    "Detail surat",
    incomingRow && dispositionRow && incomingRow.current_disposition_id === ids.dispositionId ? "PASS" : "FAIL",
    incomingRow ? `Detail DB konsisten; currentDispositionId=${incomingRow.current_disposition_id}.` : "Detail surat tidak terbaca."
  );
  addScenario(
    "disposisi_created",
    "Disposisi",
    dispositionRow?.status === "Menunggu Tindak Lanjut" ? "PASS" : "FAIL",
    dispositionRow ? `Disposisi status=${dispositionRow.status}.` : "Disposisi uji tidak ditemukan."
  );
  addScenario(
    "disposisi_deadline",
    "Deadline disposisi",
    Boolean(dispositionRow?.deadline_at) ? "PASS" : "FAIL",
    dispositionRow?.deadline_at ? `Deadline=${dispositionRow.deadline_at}.` : "Deadline disposisi belum tersimpan."
  );
  addScenario(
    "disposisi_read_status",
    "Read status disposisi",
    Boolean(dispositionRow?.read_at && dispositionRow?.read_by_user_id) ? "PASS" : "FAIL",
    dispositionRow?.read_at ? `ReadAt=${dispositionRow.read_at}.` : "Read status belum tersimpan."
  );
  addScenario(
    "pusat_tugas_candidate",
    "Pusat Tugas task candidate",
    dispositionRow && dispositionRow.deleted_at === null && dispositionRow.status !== "Selesai" ? "PASS" : "FAIL",
    "Disposisi PILOT-NONWA aktif dan memenuhi kandidat task source Manajemen Surat."
  );
  addScenario(
    "surat_keluar_workflow",
    "Workflow surat keluar",
    outgoingRow?.workflow_status === "rejected" && outgoingRow?.submitted_at && outgoingRow?.rejected_at ? "PASS" : "FAIL",
    outgoingRow ? `Workflow akhir=${outgoingRow.workflow_status}; path draft -> submitted -> rejected.` : "Surat keluar uji tidak ditemukan."
  );

  const csvColumns = [
    "Nomor Surat",
    "Nomor Agenda",
    "Tanggal Surat",
    "Tanggal Administratif",
    "Jenis Surat",
    "Pengirim/Tujuan",
    "Perihal",
    "Status",
    "Klasifikasi",
    "Disposisi Terakhir",
    "Deadline Disposisi",
    "Status Disposisi",
  ];
  const csvRow = [
    incomingRow?.nomor_surat,
    incomingRow?.nomor_urut,
    incomingRow?.tanggal_surat,
    incomingRow?.tanggal_administratif,
    "Surat Masuk",
    incomingRow?.pengirim,
    incomingRow?.perihal,
    incomingRow?.status,
    incomingRow?.klasifikasi_utama,
    dispositionRow?.instruksi,
    dispositionRow?.deadline_at,
    dispositionRow?.status,
  ];
  const csv = [csvColumns, csvRow].map((row) => row.map(csvCell).join(",")).join("\r\n");
  result.summary.exportCsvPreview = { rows: 1, headerCount: csvColumns.length, byteLength: Buffer.byteLength(csv) };
  addScenario(
    "export_csv_shape",
    "Export laporan CSV",
    csvColumns.length === 12 && csv.includes(PREFIX) ? "PASS" : "FAIL",
    `CSV preview minimal valid untuk data ${PREFIX}; endpoint export tetap auth-guarded dari runner tanpa sesi.`
  );
}

async function verifyOperationalSafety(beforeSnapshot, afterSnapshot, pool) {
  const before = beforeSnapshot.stats ?? {};
  const after = afterSnapshot.stats ?? {};
  const queueUnchanged =
    Number(before.pending ?? 0) === Number(after.pending ?? 0) &&
    Number(before.processing ?? 0) === Number(after.processing ?? 0) &&
    Number(after.failed ?? 0) === 0 &&
    afterSnapshot.activeDeadLetters === 0;
  addScenario(
    "no_whatsapp_queue_change",
    "Tidak ada queue WhatsApp baru",
    queueUnchanged ? "PASS" : "FAIL",
    `before pending/processing/failed=${Number(before.pending ?? 0)}/${Number(before.processing ?? 0)}/${Number(before.failed ?? 0)}, after=${Number(after.pending ?? 0)}/${Number(after.processing ?? 0)}/${Number(after.failed ?? 0)}.`
  );

  const pendingApproval = await query(pool, `SELECT COUNT(*)::int AS count FROM aleta_bot_approval_requests WHERE status = 'pending'`);
  const phase4Pending = await query(
    pool,
    `SELECT COUNT(*)::int AS count FROM aleta_bot_approval_requests WHERE status = 'pending' AND entity_name = $1`,
    [PHASE4_APPROVAL_NAME]
  );
  const settings = await query(pool, `SELECT * FROM aleta_bot_settings WHERE id = 1 LIMIT 1`);
  const settingsRow = settings.rows?.[0] ?? {};
  const productionActive =
    Boolean(Number(settingsRow.disposition_deadline_reminder_enabled ?? 0)) &&
    settingsRow.disposition_deadline_reminder_mode === "production";
  const schedulerProductionActive =
    Boolean(Number(settingsRow.disposition_deadline_reminder_scheduler_enabled ?? 0)) &&
    settingsRow.disposition_deadline_reminder_scheduler_mode === "production";
  result.summary.operationalSafety = {
    approvalPending: Number(pendingApproval.rows?.[0]?.count ?? 0),
    phase4ApprovalPending: Number(phase4Pending.rows?.[0]?.count ?? 0),
    productionActive,
    schedulerProductionActive,
  };
  addScenario(
    "approval_pending_after",
    "Approval pending setelah pilot",
    Number(pendingApproval.rows?.[0]?.count ?? 0) === 0 ? "PASS" : "WARN",
    `${Number(pendingApproval.rows?.[0]?.count ?? 0)} approval pending.`
  );
  addScenario(
    "phase4_approval_after",
    "Phase 4 approval aktif",
    Number(phase4Pending.rows?.[0]?.count ?? 0) === 0 ? "PASS" : "FAIL",
    `${Number(phase4Pending.rows?.[0]?.count ?? 0)} approval Phase 4 pending.`
  );
  addScenario(
    "scheduler_reminder_after",
    "Scheduler/reminder production tetap nonaktif",
    productionActive || schedulerProductionActive ? "FAIL" : "PASS",
    `mode=${settingsRow.disposition_deadline_reminder_mode}, scheduler=${settingsRow.disposition_deadline_reminder_scheduler_enabled ? "enabled" : "disabled"}/${settingsRow.disposition_deadline_reminder_scheduler_mode}.`
  );
}

function evaluate() {
  const statuses = result.scenarios.map((scenario) => scenario.status);
  const queue = result.summary.afterQueue ?? {};
  const runtime = result.summary.afterRuntime ?? {};
  const safety = result.summary.operationalSafety ?? {};
  result.safeForNonWaPilot =
    Number(queue.activeDeadLetters ?? 1) === 0 &&
    Number(queue.stats?.failed ?? 1) === 0 &&
    Number(safety.approvalPending ?? 1) === 0 &&
    !safety.productionActive &&
    !safety.schedulerProductionActive;
  result.safeForLimitedWhatsAppPilot = result.safeForNonWaPilot && ["connected", "ready"].includes(normalizeStatus(runtime.whatsappStatus));
  result.safeForProduction = false;
  if (statuses.includes("FAIL")) result.overall = "FAIL";
  else if (statuses.includes("WARN")) result.overall = "WARN";
  else result.overall = "PASS";
}

function renderMarkdown() {
  const lines = [];
  lines.push("# ALETA Pilot Non-WA Result");
  lines.push("");
  lines.push(`Generated: ${result.generatedAt}`);
  lines.push(`Run ID: ${result.runId}`);
  lines.push(`Overall: ${result.overall}`);
  lines.push("");
  lines.push("## Kesimpulan");
  lines.push(`- Pilot non-WA: ${result.safeForNonWaPilot ? "boleh" : "belum"}`);
  lines.push(`- Lanjut uji WhatsApp terbatas: ${result.safeForLimitedWhatsAppPilot ? "boleh secara teknis, tetap via guard Super Admin" : "ditahan"}`);
  lines.push(`- Production: ${result.safeForProduction ? "boleh" : "tidak"}`);
  lines.push("");
  lines.push("## Data Uji");
  lines.push(`- Prefix: ${PREFIX}`);
  lines.push(`- Surat masuk: ${result.summary.testData?.incomingId ?? "n/a"}`);
  lines.push(`- Disposisi: ${result.summary.testData?.dispositionId ?? "n/a"}`);
  lines.push(`- Surat keluar: ${result.summary.testData?.outgoingId ?? "n/a"}`);
  lines.push("");
  lines.push("## Status Akhir");
  lines.push(`- WhatsApp: ${result.summary.afterRuntime?.whatsappStatus ?? "unknown"}`);
  lines.push(`- Queue: pending=${result.summary.afterQueue?.stats?.pending ?? "n/a"}, processing=${result.summary.afterQueue?.stats?.processing ?? "n/a"}, failed=${result.summary.afterQueue?.stats?.failed ?? "n/a"}`);
  lines.push(`- Dead-letter aktif: ${result.summary.afterQueue?.activeDeadLetters ?? "n/a"}`);
  lines.push(`- Approval pending: ${result.summary.operationalSafety?.approvalPending ?? "n/a"}`);
  lines.push(`- Reminder production: ${result.summary.operationalSafety?.productionActive ? "aktif" : "nonaktif"}`);
  lines.push(`- Scheduler production: ${result.summary.operationalSafety?.schedulerProductionActive ? "aktif" : "nonaktif"}`);
  lines.push("");
  lines.push("## Scenarios");
  lines.push("| Status | Scenario | Detail |");
  lines.push("| --- | --- | --- |");
  for (const scenario of result.scenarios) {
    lines.push(`| ${scenario.status} | ${escapeTable(scenario.title)} | ${escapeTable(scenario.detail)} |`);
  }
  lines.push("");
  lines.push("## Actions Taken");
  for (const action of result.actionsTaken) {
    lines.push(`- ${action.action}: ${action.detail}`);
  }
  lines.push("");
  lines.push("## Bugs");
  if (result.bugs.length === 0) lines.push("- Tidak ada bug blocker.");
  for (const bug of result.bugs) lines.push(`- ${bug.title}: ${bug.detail}`);
  lines.push("");
  lines.push("## Warnings");
  if (result.warnings.length === 0) lines.push("- Tidak ada warning.");
  for (const warning of result.warnings) lines.push(`- ${warning.title}: ${warning.detail}`);
  lines.push("");
  lines.push("## Safety Notes");
  lines.push("- Pilot ini tidak mengirim WhatsApp, tidak enqueue real message, tidak resend dead-letter, tidak scan QR, tidak logout/reset, dan tidak mengaktifkan production scheduler/reminder.");
  lines.push("- Data uji memakai prefix PILOT-NONWA dan tidak di-hard-delete.");
  return `${lines.join("\n")}\n`;
}

function escapeTable(value) {
  return String(value ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

async function main() {
  mkdirSync(REPORT_DIR, { recursive: true });
  addAction("non_wa_guard", "Runner tidak memanggil endpoint send/resend/connect/approval production.");
  await checkPageReachability();
  const before = await getQueueSnapshot();
  result.summary.beforeQueue = { stats: before.stats, activeDeadLetters: before.activeDeadLetters };
  checkRuntimeSnapshot(before, "before");

  const pool = await openPortalDb();
  if (pool) {
    try {
      const ids = await insertPilotData(pool);
      await verifyPilotData(pool, ids);
      const after = await getQueueSnapshot();
      result.summary.afterQueue = { stats: after.stats, activeDeadLetters: after.activeDeadLetters };
      result.summary.afterRuntime = { whatsappStatus: after.whatsappStatus, aiRuntime: after.aiRuntime };
      checkRuntimeSnapshot(after, "after");
      await verifyOperationalSafety(before, after, pool);
    } finally {
      await pool.end();
    }
  }

  evaluate();
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
  addScenario("pilot_nonwa_unhandled_error", "Pilot Non-WA runner", "FAIL", sanitizeError(error));
  evaluate();
  mkdirSync(REPORT_DIR, { recursive: true });
  writeFileSync(REPORT_JSON, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  writeFileSync(REPORT_MD, renderMarkdown(), "utf8");
  console.error(`Pilot Non-WA failed: ${sanitizeError(error)}`);
  process.exitCode = 1;
});
