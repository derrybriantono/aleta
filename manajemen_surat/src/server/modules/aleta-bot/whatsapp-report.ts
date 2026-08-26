import { type AletaDatabase, type SqlInputValue } from "@/server/db/client";
import { requireActorUser } from "@/server/modules/organization/service";
import { getGatewayMessageLogs, type GatewayMessageLog } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { ApiError } from "@/server/shared/errors";
import { assertExportRowLimit, exportOverflowLimit, EXPORT_ROW_LIMITS } from "@/server/shared/export-limits";
import { createXlsxWorkbook, type XlsxSheet } from "@/server/shared/xlsx";

export type WhatsappReportRangeKey =
  | "5m"
  | "10m"
  | "30m"
  | "1h"
  | "6h"
  | "12h"
  | "1d"
  | "3d"
  | "7d"
  | "14d"
  | "30d"
  | "90d"
  | "180d"
  | "365d"
  | "all";

export type WhatsappReportStatusKey = "all" | "sent" | "failed" | "simulated" | "pending";
export type WhatsappReportSourceKey = "all" | "aleta_bot" | "manajemen_surat" | "e_kepegawaian";

export type WhatsappReportOptions = {
  range?: string | null;
  status?: string | null;
  sourceApp?: string | null;
  search?: string | null;
  limit?: number | null;
};

export type WhatsappLatestRowsExportOptions = WhatsappReportOptions & {
  tableSearch?: string | null;
  tableStatus?: string | null;
  tableApp?: string | null;
  tableFeature?: string | null;
  sortKey?: string | null;
  sortDirection?: string | null;
};

type RawWhatsappLogRow = {
  id: string;
  queue_id?: string | null;
  idempotency_key?: string | null;
  notification_id: string | null;
  query_id: string | null;
  recipient_number: string;
  recipient_name: string;
  category: string;
  message_preview: string;
  status: string;
  whatsapp_message_id?: string | null;
  ack?: number | string | null;
  error_message: string | null;
  source_app: string;
  source_feature: string;
  entity_type: string;
  entity_id: string;
  metadata_json: string;
  sent_at: string | null;
  delivered_at?: string | null;
  read_at?: string | null;
  failed_at?: string | null;
  created_at: string;
};

type RawSystemLogRow = {
  id: string;
  level: string;
  event_type: string;
  message: string;
  metadata_json: string;
  actor_user_id: string | null;
  created_at: string;
};

export const WHATSAPP_REPORT_RANGES: Array<{ key: WhatsappReportRangeKey; label: string; minutes: number | null }> = [
  { key: "5m", label: "5 menit", minutes: 5 },
  { key: "10m", label: "10 menit", minutes: 10 },
  { key: "30m", label: "30 menit", minutes: 30 },
  { key: "1h", label: "1 jam", minutes: 60 },
  { key: "6h", label: "6 jam", minutes: 360 },
  { key: "12h", label: "12 jam", minutes: 720 },
  { key: "1d", label: "1 hari", minutes: 1440 },
  { key: "3d", label: "3 hari", minutes: 4320 },
  { key: "7d", label: "7 hari", minutes: 10080 },
  { key: "14d", label: "2 minggu", minutes: 20160 },
  { key: "30d", label: "1 bulan", minutes: 43200 },
  { key: "90d", label: "3 bulan", minutes: 129600 },
  { key: "180d", label: "6 bulan", minutes: 259200 },
  { key: "365d", label: "1 tahun", minutes: 525600 },
  { key: "all", label: "Seluruh data", minutes: null },
];

export const WHATSAPP_REPORT_SOURCES: Array<{ key: WhatsappReportSourceKey; label: string }> = [
  { key: "all", label: "Semua aplikasi" },
  { key: "aleta_bot", label: "Notifikasi Perkara / ALETA Bot" },
  { key: "manajemen_surat", label: "Manajemen Surat" },
  { key: "e_kepegawaian", label: "E-Kepegawaian" },
];

const STATUS_LABELS: Record<string, string> = {
  success: "Terkirim",
  sent: "Terkirim",
  queued: "Masuk Antrean",
  delivered: "Tersampaikan",
  read: "Dibaca",
  failed: "Gagal",
  dead_letter: "Gagal Permanen",
  simulated: "Simulasi",
  dry_run: "Simulasi",
  sending: "Diproses",
  pending: "Menunggu",
  processing: "Diproses",
  enqueued: "Masuk Antrean",
  skipped: "Dilewati",
  cancelled: "Dibatalkan",
};

const SOURCE_LABELS: Record<string, string> = {
  disposition: "Disposisi",
  disposition_notification: "Disposisi",
  disposition_deadline_reminder: "Pengingat Tenggat",
  letter: "Surat",
  letter_notification: "Surat Baru",
  public_qa: "Pertanyaan WhatsApp",
  notification: "Notifikasi",
  employee: "Pegawai",
  party: "Para Pihak",
  system: "Sistem",
  hr_leave_submitted: "HR - Pengajuan Cuti",
  hr_leave_approved: "HR - Cuti Disetujui",
  hr_leave_rejected: "HR - Cuti Ditolak",
  hr_leave_revision: "HR - Revisi Cuti",
  hr_leave_forwarded: "HR - Cuti Diteruskan",
  hr_submission_created: "HR - Setoran Dokumen",
  hr_submission_verified: "HR - Dokumen Terverifikasi",
  hr_submission_rejected: "HR - Dokumen Ditolak",
  hr_submission_revision: "HR - Revisi Dokumen",
  hr_annual_document_reminder: "HR - Reminder Dokumen",
};

const SOURCE_APP_LABELS: Record<string, string> = {
  aleta_bot: "Notifikasi Perkara / ALETA Bot",
  manajemen_surat: "Manajemen Surat",
  e_kepegawaian: "E-Kepegawaian",
};

const MANAGEMENT_LETTER_FEATURES = new Set([
  "letter_notification",
  "disposition_notification",
  "disposition_deadline_reminder",
]);

const SOURCE_APP_SQL = `CASE
  WHEN COALESCE(source_app, '') = 'manajemen_surat'
    OR COALESCE(source_feature, '') IN ('letter_notification', 'disposition_notification', 'disposition_deadline_reminder')
    THEN 'manajemen_surat'
  WHEN COALESCE(source_app, '') IN ('', 'aleta_bot', 'aleta_bot_admin')
    THEN 'aleta_bot'
  ELSE source_app
END`;

function resolveRange(input?: string | null) {
  const found = WHATSAPP_REPORT_RANGES.find((item) => item.key === input) ?? WHATSAPP_REPORT_RANGES.find((item) => item.key === "7d")!;
  if (found.minutes === null) {
    return { ...found, from: null as string | null, to: new Date().toISOString() };
  }
  const fromDate = new Date(Date.now() - found.minutes * 60 * 1000);
  return { ...found, from: fromDate.toISOString(), to: new Date().toISOString() };
}

function normalizeStatus(input?: string | null): WhatsappReportStatusKey {
  const value = String(input || "all").toLowerCase();
  if (["sent", "failed", "simulated", "pending"].includes(value)) return value as WhatsappReportStatusKey;
  return "all";
}

function normalizeSourceFilter(input?: string | null): WhatsappReportSourceKey {
  const value = String(input || "all").toLowerCase();
  if (value === "aleta_bot" || value === "manajemen_surat" || value === "e_kepegawaian") return value;
  return "all";
}

function statusAliases(status: WhatsappReportStatusKey) {
  if (status === "sent") return ["sent", "success", "delivered", "read"];
  if (status === "failed") return ["failed", "dead_letter"];
  if (status === "simulated") return ["simulated", "dry_run"];
  if (status === "pending") return ["pending", "processing", "enqueued", "queued", "sending"];
  return [];
}

async function requireReportAccess(db: AletaDatabase, actorUserId: string) {
  const actor = await requireActorUser(db, actorUserId);
  if (actor.roleId !== "super-admin" && actor.roleId !== "admin") {
    throw new ApiError(403, "Hanya Super Admin/Admin yang dapat mencetak laporan WhatsApp ALETA Bot.");
  }
  return actor;
}

function parseMetadata(value: string | Record<string, unknown> | null | undefined): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function labelStatus(status: string) {
  return STATUS_LABELS[status] ?? (status || "-");
}

function labelSource(source: string, category = "") {
  return SOURCE_LABELS[source] ?? SOURCE_LABELS[category] ?? (source || category || "-");
}

function normalizeSourceAppValue(sourceApp: string, sourceFeature: string) {
  if (sourceApp === "manajemen_surat" || MANAGEMENT_LETTER_FEATURES.has(sourceFeature)) return "manajemen_surat";
  if (!sourceApp || sourceApp === "aleta_bot" || sourceApp === "aleta_bot_admin" || sourceApp.startsWith("aleta_bot")) return "aleta_bot";
  return sourceApp;
}

function labelSourceApp(sourceApp: string) {
  return SOURCE_APP_LABELS[sourceApp] ?? sourceApp.replace(/_/g, " ") ?? "-";
}

function labelSourceFilter(sourceApp: WhatsappReportSourceKey) {
  return WHATSAPP_REPORT_SOURCES.find((item) => item.key === sourceApp)?.label ?? "Semua aplikasi";
}

function sanitizeErrorMessage(value: string | null | undefined) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return raw
    .replace(/password=[^&\s]+/gi, "password=[redacted]")
    .replace(/token[:=][^&\s]+/gi, "token=[redacted]")
    .slice(0, 500);
}

function getCaseOrPosition(metadata: Record<string, unknown>) {
  return String(
    metadata.nomorPerkara ||
      metadata.nomor_perkara ||
      metadata.caseNumber ||
      metadata.recipientPosition ||
      metadata.recipient_position ||
      ""
  ).trim();
}

function toIsoDateString(value: unknown) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toISOString();
}

function normalizeRuntimeMessageLog(row: GatewayMessageLog): RawWhatsappLogRow {
  const metadata = parseMetadata(row.metadata_json);
  const sourceFeature = String(metadata.sourceFeature || metadata.source_feature || row.notification_key || row.category || "whatsapp_message");
  const sourceApp = String(metadata.sourceApp || metadata.source_app || "aleta_bot");
  return {
    id: `runtime:${String(row.id || "")}`,
    queue_id: row.queue_id === undefined || row.queue_id === null ? null : String(row.queue_id),
    idempotency_key: row.idempotency_key || null,
    notification_id: row.notification_key || "",
    query_id: String(metadata.queryId || metadata.query_id || metadata.queryKey || metadata.query_key || ""),
    recipient_number: row.recipient_number || "",
    recipient_name: row.recipient_name || "",
    category: row.category || "system",
    message_preview: row.message_preview || "",
    status: row.status || "pending",
    whatsapp_message_id: row.whatsapp_message_id || null,
    ack: row.ack ?? null,
    error_message: row.error_message || null,
    source_app: sourceApp,
    source_feature: sourceFeature,
    entity_type: String(metadata.entityType || metadata.entity_type || ""),
    entity_id: String(metadata.entityId || metadata.entity_id || ""),
    metadata_json: typeof row.metadata_json === "string" ? row.metadata_json : JSON.stringify(metadata),
    sent_at: toIsoDateString(row.sent_at) || null,
    delivered_at: toIsoDateString(row.delivered_at) || null,
    read_at: toIsoDateString(row.read_at) || null,
    failed_at: toIsoDateString(row.failed_at) || null,
    created_at: toIsoDateString(row.created_at) || new Date().toISOString(),
  };
}

const STATUS_PRIORITY: Record<string, number> = {
  read: 80,
  delivered: 70,
  sent: 60,
  success: 60,
  failed: 50,
  dead_letter: 50,
  simulated: 45,
  dry_run: 45,
  skipped: 40,
  sending: 30,
  processing: 30,
  queued: 20,
  enqueued: 20,
  pending: 20,
};

function rawWhatsappLogKey(row: RawWhatsappLogRow) {
  return row.idempotency_key || row.queue_id || row.id;
}

function pickMoreUsefulWhatsappLogRow(left: RawWhatsappLogRow, right: RawWhatsappLogRow) {
  const leftPriority = STATUS_PRIORITY[left.status] ?? 0;
  const rightPriority = STATUS_PRIORITY[right.status] ?? 0;
  if (leftPriority !== rightPriority) return leftPriority > rightPriority ? left : right;
  const leftTime = new Date(left.sent_at || left.created_at || "").getTime();
  const rightTime = new Date(right.sent_at || right.created_at || "").getTime();
  return (Number.isFinite(leftTime) ? leftTime : 0) >= (Number.isFinite(rightTime) ? rightTime : 0) ? left : right;
}

function mergeWhatsappLogRows(rows: RawWhatsappLogRow[]) {
  const map = new Map<string, RawWhatsappLogRow>();
  for (const row of rows) {
    const key = rawWhatsappLogKey(row);
    const existing = map.get(key);
    map.set(key, existing ? pickMoreUsefulWhatsappLogRow(existing, row) : row);
  }
  return Array.from(map.values()).sort((a, b) => {
    const left = new Date(a.created_at || a.sent_at || "").getTime();
    const right = new Date(b.created_at || b.sent_at || "").getTime();
    return (Number.isFinite(right) ? right : 0) - (Number.isFinite(left) ? left : 0);
  });
}

function rawWhatsappRowMatchesOptions(row: RawWhatsappLogRow, options: WhatsappReportOptions) {
  const { range, status, sourceApp } = buildWhere(options);
  const createdTime = new Date(row.created_at || "").getTime();
  if (range.from) {
    const fromTime = new Date(range.from).getTime();
    if (Number.isFinite(createdTime) && Number.isFinite(fromTime) && createdTime < fromTime) return false;
  }

  const aliases = statusAliases(status);
  if (aliases.length > 0 && !aliases.includes(row.status)) return false;

  const metadata = parseMetadata(row.metadata_json);
  const sourceFeature = row.source_feature || String(metadata.sourceFeature || metadata.source_feature || row.category || "");
  const normalizedSourceApp = normalizeSourceAppValue(row.source_app || String(metadata.sourceApp || metadata.source_app || ""), sourceFeature);
  if (sourceApp !== "all" && normalizedSourceApp !== sourceApp) return false;

  const search = String(options.search || "").trim().toLowerCase();
  if (!search) return true;
  return [
    row.recipient_name,
    row.recipient_number,
    row.message_preview,
    row.entity_id,
    row.notification_id,
    row.query_id,
    sourceFeature,
  ].join(" ").toLowerCase().includes(search);
}

async function getRuntimeWhatsappRows(options: WhatsappReportOptions, limit: number | null) {
  const runtimeLimit = Math.max(1, Math.min(5001, Number(limit || 200)));
  const result = await getGatewayMessageLogs({ limit: runtimeLimit });
  if (!result.ok) return [];
  return result.data.logs.map(normalizeRuntimeMessageLog).filter((row) => rawWhatsappRowMatchesOptions(row, options));
}

function normalizeWhatsappLogRow(row: RawWhatsappLogRow) {
  const metadata = parseMetadata(row.metadata_json);
  const sourceFeature = row.source_feature || String(metadata.sourceFeature || metadata.source_feature || row.category || "");
  const entityType = row.entity_type || String(metadata.entityType || metadata.entity_type || "");
  const entityId = row.entity_id || String(metadata.entityId || metadata.entity_id || "");
  const sourceApp = normalizeSourceAppValue(row.source_app || String(metadata.sourceApp || metadata.source_app || ""), sourceFeature);
  return {
    id: row.id,
    notificationId: row.notification_id || "",
    queryId: row.query_id || "",
    recipientName: row.recipient_name || "",
    recipientNumber: row.recipient_number || "",
    category: row.category || "",
    categoryLabel: row.category === "employee" ? "Pegawai" : row.category === "party" ? "Para Pihak" : row.category || "",
    status: row.status || "",
    statusLabel: labelStatus(row.status || ""),
    whatsappMessageId: row.whatsapp_message_id || "",
    ack: row.ack === null || row.ack === undefined ? null : Number(row.ack),
    sourceApp,
    sourceAppLabel: labelSourceApp(sourceApp),
    sourceFeature,
    sourceFeatureLabel: labelSource(sourceFeature, row.category),
    entityType,
    entityId,
    caseOrPosition: getCaseOrPosition(metadata),
    messagePreview: row.message_preview || "",
    errorMessage: sanitizeErrorMessage(row.error_message),
    sentAt: row.sent_at || "",
    deliveredAt: row.delivered_at || "",
    readAt: row.read_at || "",
    failedAt: row.failed_at || "",
    createdAt: row.created_at || "",
    metadata,
  };
}

type NormalizedWhatsappLogRow = ReturnType<typeof normalizeWhatsappLogRow>;

function normalizeSystemLogRow(row: RawSystemLogRow) {
  return {
    id: row.id,
    level: row.level,
    eventType: row.event_type,
    message: row.message,
    actorUserId: row.actor_user_id || "",
    createdAt: row.created_at,
    metadata: parseMetadata(row.metadata_json),
  };
}

function countBy<T>(items: T[], getKey: (item: T) => string) {
  return items.reduce<Record<string, number>>((acc, item) => {
    const key = getKey(item) || "Tidak diketahui";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

function entriesByCount(data: Record<string, number>) {
  return Object.entries(data).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function buildDailyTrend(rows: ReturnType<typeof normalizeWhatsappLogRow>[]) {
  return entriesByCount(countBy(rows, (row) => (row.createdAt || "").slice(0, 10))).map(([date, total]) => ({
    date,
    total,
    sent: rows.filter((row) => (row.createdAt || "").startsWith(date) && ["sent", "success", "delivered", "read"].includes(row.status)).length,
    failed: rows.filter((row) => (row.createdAt || "").startsWith(date) && ["failed", "dead_letter"].includes(row.status)).length,
  }));
}

function buildStats(rows: ReturnType<typeof normalizeWhatsappLogRow>[]) {
  const total = rows.length;
  const sent = rows.filter((row) => ["sent", "success", "delivered", "read"].includes(row.status)).length;
  const delivered = rows.filter((row) => ["delivered", "read"].includes(row.status)).length;
  const read = rows.filter((row) => row.status === "read").length;
  const failed = rows.filter((row) => ["failed", "dead_letter"].includes(row.status)).length;
  const simulated = rows.filter((row) => ["simulated", "dry_run"].includes(row.status)).length;
  const pending = rows.filter((row) => ["pending", "processing", "enqueued", "queued", "sending"].includes(row.status)).length;
  return {
    total,
    sent,
    delivered,
    read,
    failed,
    simulated,
    pending,
    successRate: total > 0 ? Math.round((sent / total) * 100) : 0,
    byStatus: entriesByCount(countBy(rows, (row) => row.statusLabel)),
    byApp: entriesByCount(countBy(rows, (row) => row.sourceAppLabel)),
    byFeature: entriesByCount(countBy(rows, (row) => row.sourceFeatureLabel)),
    byCategory: entriesByCount(countBy(rows, (row) => row.categoryLabel || row.category)),
    topErrors: entriesByCount(countBy(rows.filter((row) => row.errorMessage), (row) => row.errorMessage)).slice(0, 20),
    dailyTrend: buildDailyTrend(rows),
  };
}

function buildWhere(options: WhatsappReportOptions) {
  const range = resolveRange(options.range);
  const status = normalizeStatus(options.status);
  const sourceApp = normalizeSourceFilter(options.sourceApp);
  const clauses: string[] = [];
  const params: SqlInputValue[] = [];

  if (range.from) {
    clauses.push("created_at >= ?");
    params.push(range.from);
  }

  const aliases = statusAliases(status);
  if (aliases.length > 0) {
    clauses.push(`status IN (${aliases.map(() => "?").join(", ")})`);
    params.push(...aliases);
  }

  if (sourceApp !== "all") {
    clauses.push(`${SOURCE_APP_SQL} = ?`);
    params.push(sourceApp);
  }

  const search = String(options.search || "").trim();
  if (search) {
    clauses.push("(recipient_name ILIKE ? OR recipient_number ILIKE ? OR message_preview ILIKE ? OR entity_id ILIKE ?)");
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }

  return {
    range,
    status,
    sourceApp,
    whereSql: clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "",
    params,
  };
}

export async function getAletaBotWhatsappReport(db: AletaDatabase, actorUserId: string, options: WhatsappReportOptions = {}) {
  const actor = await requireReportAccess(db, actorUserId);
  const { range, status, sourceApp, whereSql, params } = buildWhere(options);
  const limit = options.limit === null ? null : Math.max(1, Math.min(exportOverflowLimit(EXPORT_ROW_LIMITS.whatsappReportXlsx), Number(options.limit || 100)));
  const limitSql = limit ? `LIMIT ${limit}` : "";

  const portalRows = await db.queryAll<RawWhatsappLogRow>(
    `SELECT id, NULL AS queue_id, NULL AS idempotency_key, notification_id, query_id, recipient_number, recipient_name, category,
      message_preview, status, whatsapp_message_id, ack, error_message, source_app, source_feature, entity_type, entity_id,
      metadata_json, sent_at, delivered_at, read_at, failed_at, created_at
     FROM aleta_bot_notification_logs
     ${whereSql}
     ORDER BY created_at DESC
     ${limitSql}`,
    params
  );
  const runtimeRows = await getRuntimeWhatsappRows(options, limit);
  const rows = mergeWhatsappLogRows([...portalRows, ...runtimeRows]).slice(0, limit ?? undefined);
  const systemRows = await db.queryAll<RawSystemLogRow>(
    `SELECT id, level, event_type, message, metadata_json, actor_user_id, created_at
     FROM aleta_bot_logs
     ${range.from ? "WHERE created_at >= ?" : ""}
     ORDER BY created_at DESC
     LIMIT 500`,
    range.from ? [range.from] : []
  );

  const normalizedRows = rows.map(normalizeWhatsappLogRow);
  return {
    generatedAt: new Date().toISOString(),
    actor: {
      id: actor.id,
      name: actor.name,
      roleId: actor.roleId,
    },
    range: {
      key: range.key,
      label: range.label,
      from: range.from,
      to: range.to,
    },
    status,
    source: {
      key: sourceApp,
      label: labelSourceFilter(sourceApp),
    },
    stats: buildStats(normalizedRows),
    rows: normalizedRows,
    systemLogs: systemRows.map(normalizeSystemLogRow),
  };
}

function statsSheet(report: Awaited<ReturnType<typeof getAletaBotWhatsappReport>>): XlsxSheet {
  return {
    name: "Ringkasan",
    freezeHeader: true,
    autoFilter: true,
    columns: [
      { key: "metric", header: "Data", width: 32 },
      { key: "value", header: "Nilai", width: 32 },
      { key: "note", header: "Keterangan", width: 52 },
    ],
    rows: [
      { metric: "Dibuat pada", value: report.generatedAt, note: "Waktu export laporan." },
      { metric: "Rentang", value: report.range.label, note: report.range.from ? `${report.range.from} sampai ${report.range.to}` : "Seluruh data yang tersimpan." },
      { metric: "Filter status", value: report.status, note: "all berarti semua status." },
      { metric: "Sumber aplikasi", value: report.source.label, note: "Filter pemisah Notifikasi Perkara dan Manajemen Surat." },
      { metric: "Total diproses", value: report.stats.total, note: "Semua log WhatsApp pada filter ini." },
      { metric: "Terkirim", value: report.stats.sent, note: "Status sent/success/delivered/read." },
      { metric: "Tersampaikan", value: report.stats.delivered, note: "Status delivered/read dari ACK WhatsApp." },
      { metric: "Dibaca", value: report.stats.read, note: "Status read dari ACK WhatsApp." },
      { metric: "Gagal", value: report.stats.failed, note: "Status failed/dead_letter." },
      { metric: "Simulasi", value: report.stats.simulated, note: "Status simulated/dry_run." },
      { metric: "Menunggu/diproses", value: report.stats.pending, note: "Status pending/processing/queued/enqueued." },
      { metric: "Tingkat berhasil", value: `${report.stats.successRate}%`, note: "Terkirim dibagi total diproses." },
    ],
  };
}

function whatsappRowsSheet(report: Awaited<ReturnType<typeof getAletaBotWhatsappReport>>): XlsxSheet {
  return {
    name: "Pesan WhatsApp",
    freezeHeader: true,
    autoFilter: true,
    columns: [
      { key: "createdAt", header: "Waktu Diproses", width: 24 },
      { key: "sentAt", header: "Waktu Terkirim", width: 24 },
      { key: "deliveredAt", header: "Waktu Tersampaikan", width: 24 },
      { key: "readAt", header: "Waktu Dibaca", width: 24 },
      { key: "statusLabel", header: "Status", width: 18 },
      { key: "recipientName", header: "Nama Penerima", width: 28 },
      { key: "recipientNumber", header: "Nomor WhatsApp", width: 20 },
      { key: "categoryLabel", header: "Jenis Penerima", width: 18 },
      { key: "sourceApp", header: "Aplikasi", width: 18 },
      { key: "sourceFeatureLabel", header: "Sumber/Fitur", width: 24 },
      { key: "caseOrPosition", header: "Nomor Perkara/Jabatan", width: 28 },
      { key: "entityType", header: "Jenis Data", width: 18 },
      { key: "entityId", header: "ID Data", width: 24 },
      { key: "notificationId", header: "ID Notifikasi", width: 26 },
      { key: "queryId", header: "ID Sumber Data", width: 24 },
      { key: "messagePreview", header: "Isi Pesan", width: 70 },
      { key: "errorMessage", header: "Error", width: 48 },
      { key: "whatsappMessageId", header: "ID Pesan WhatsApp", width: 36 },
      { key: "ack", header: "ACK", width: 10 },
      { key: "id", header: "ID Log", width: 28 },
    ],
    rows: report.rows.map((row) => ({
      createdAt: row.createdAt,
      sentAt: row.sentAt,
      deliveredAt: row.deliveredAt,
      readAt: row.readAt,
      statusLabel: row.statusLabel,
      recipientName: row.recipientName,
      recipientNumber: row.recipientNumber,
      categoryLabel: row.categoryLabel,
      sourceApp: row.sourceAppLabel,
      sourceFeatureLabel: row.sourceFeatureLabel,
      caseOrPosition: row.caseOrPosition,
      entityType: row.entityType,
      entityId: row.entityId,
      notificationId: row.notificationId,
      queryId: row.queryId,
      messagePreview: row.messagePreview,
      errorMessage: row.errorMessage,
      whatsappMessageId: row.whatsappMessageId,
      ack: row.ack,
      id: row.id,
    })),
  };
}

function pairSheet(name: string, firstHeader: string, rows: Array<[string, number]>): XlsxSheet {
  return {
    name,
    freezeHeader: true,
    autoFilter: true,
    columns: [
      { key: "label", header: firstHeader, width: 36 },
      { key: "count", header: "Jumlah", width: 14 },
    ],
    rows: rows.map(([label, count]) => ({ label, count })),
  };
}

function trendSheet(report: Awaited<ReturnType<typeof getAletaBotWhatsappReport>>): XlsxSheet {
  return {
    name: "Tren Harian",
    freezeHeader: true,
    autoFilter: true,
    columns: [
      { key: "date", header: "Tanggal", width: 16 },
      { key: "total", header: "Total", width: 12 },
      { key: "sent", header: "Terkirim", width: 12 },
      { key: "failed", header: "Gagal", width: 12 },
    ],
    rows: report.stats.dailyTrend,
  };
}

function systemLogSheet(report: Awaited<ReturnType<typeof getAletaBotWhatsappReport>>): XlsxSheet {
  return {
    name: "Log Sistem",
    freezeHeader: true,
    autoFilter: true,
    columns: [
      { key: "createdAt", header: "Waktu", width: 24 },
      { key: "level", header: "Level", width: 14 },
      { key: "eventType", header: "Jenis", width: 18 },
      { key: "message", header: "Pesan", width: 70 },
      { key: "actorUserId", header: "User", width: 24 },
      { key: "id", header: "ID Log", width: 28 },
    ],
    rows: report.systemLogs.map((row) => ({
      createdAt: row.createdAt,
      level: row.level,
      eventType: row.eventType,
      message: row.message,
      actorUserId: row.actorUserId,
      id: row.id,
    })),
  };
}

const LATEST_ROW_SORT_KEYS = new Set([
  "createdAt",
  "sentAt",
  "deliveredAt",
  "readAt",
  "statusLabel",
  "recipientName",
  "recipientNumber",
  "sourceAppLabel",
  "sourceFeatureLabel",
  "caseOrPosition",
  "messagePreview",
]);

function latestRowSearchText(row: NormalizedWhatsappLogRow) {
  return [
    row.createdAt,
    row.sentAt,
    row.deliveredAt,
    row.readAt,
    row.statusLabel,
    row.recipientName,
    row.recipientNumber,
    row.categoryLabel,
    row.sourceAppLabel,
    row.sourceFeatureLabel,
    row.caseOrPosition,
    row.messagePreview,
    row.errorMessage,
  ].join(" ").toLowerCase();
}

function latestSortValue(row: NormalizedWhatsappLogRow, sortKey: string) {
  if (sortKey === "createdAt") {
    const timestamp = new Date(row.createdAt || "").getTime();
    return Number.isNaN(timestamp) ? 0 : timestamp;
  }
  if (sortKey === "sentAt" || sortKey === "deliveredAt" || sortKey === "readAt") {
    const timestamp = new Date(String(row[sortKey as keyof NormalizedWhatsappLogRow] || "")).getTime();
    return Number.isNaN(timestamp) ? 0 : timestamp;
  }
  return String(row[sortKey as keyof NormalizedWhatsappLogRow] || "").toLowerCase();
}

function sortLatestRows(rows: NormalizedWhatsappLogRow[], sortKeyInput?: string | null, sortDirectionInput?: string | null) {
  const sortKey = LATEST_ROW_SORT_KEYS.has(String(sortKeyInput || "")) ? String(sortKeyInput) : "createdAt";
  const direction = String(sortDirectionInput || "desc").toLowerCase() === "asc" ? "asc" : "desc";
  return [...rows].sort((a, b) => {
    const left = latestSortValue(a, sortKey);
    const right = latestSortValue(b, sortKey);
    const result = typeof left === "number" && typeof right === "number"
      ? left - right
      : String(left).localeCompare(String(right), "id-ID", { numeric: true, sensitivity: "base" });
    return direction === "asc" ? result : -result;
  });
}

function filterLatestRows(rows: NormalizedWhatsappLogRow[], options: WhatsappLatestRowsExportOptions) {
  const search = String(options.tableSearch || "").trim().toLowerCase();
  const status = String(options.tableStatus || "all");
  const app = String(options.tableApp || "all");
  const feature = String(options.tableFeature || "all");

  return sortLatestRows(
    rows.filter((row) => {
      if (status !== "all" && row.statusLabel !== status) return false;
      if (app !== "all" && row.sourceAppLabel !== app) return false;
      if (feature !== "all" && row.sourceFeatureLabel !== feature) return false;
      if (search && !latestRowSearchText(row).includes(search)) return false;
      return true;
    }),
    options.sortKey,
    options.sortDirection
  );
}

function latestRowsSummarySheet(
  report: Awaited<ReturnType<typeof getAletaBotWhatsappReport>>,
  rows: NormalizedWhatsappLogRow[],
  options: WhatsappLatestRowsExportOptions
): XlsxSheet {
  return {
    name: "Ringkasan",
    freezeHeader: true,
    autoFilter: true,
    columns: [
      { key: "metric", header: "Data", width: 32 },
      { key: "value", header: "Nilai", width: 42 },
      { key: "note", header: "Keterangan", width: 56 },
    ],
    rows: [
      { metric: "Dibuat pada", value: report.generatedAt, note: "Waktu export Data Terbaru." },
      { metric: "Rentang laporan", value: report.range.label, note: report.range.from ? `${report.range.from} sampai ${report.range.to}` : "Seluruh data yang tersimpan." },
      { metric: "Filter status laporan", value: report.status, note: "Filter utama di atas card laporan." },
      { metric: "Filter aplikasi laporan", value: report.source.label, note: "Filter utama di atas card laporan." },
      { metric: "Cari tabel", value: options.tableSearch || "-", note: "Pencarian lokal di tabel Data Terbaru." },
      { metric: "Filter status tabel", value: options.tableStatus || "all", note: "Filter lokal Data Terbaru." },
      { metric: "Filter aplikasi tabel", value: options.tableApp || "all", note: "Filter lokal Data Terbaru." },
      { metric: "Filter fitur tabel", value: options.tableFeature || "all", note: "Filter lokal Data Terbaru." },
      { metric: "Urutan", value: `${options.sortKey || "createdAt"} ${options.sortDirection || "desc"}`, note: "Urutan yang dipakai di tabel Data Terbaru." },
      { metric: "Jumlah data", value: rows.length, note: "Jumlah baris setelah filter tabel diterapkan." },
    ],
  };
}

function latestRowsSheet(rows: NormalizedWhatsappLogRow[]): XlsxSheet {
  return {
    name: "Data Terbaru",
    freezeHeader: true,
    autoFilter: true,
    columns: [
      { key: "createdAt", header: "Waktu Diproses", width: 24 },
      { key: "sentAt", header: "Waktu Terkirim", width: 24 },
      { key: "deliveredAt", header: "Waktu Tersampaikan", width: 24 },
      { key: "readAt", header: "Waktu Dibaca", width: 24 },
      { key: "statusLabel", header: "Status", width: 18 },
      { key: "recipientName", header: "Nama Penerima", width: 28 },
      { key: "recipientNumber", header: "Nomor WhatsApp", width: 20 },
      { key: "categoryLabel", header: "Jenis Penerima", width: 18 },
      { key: "sourceAppLabel", header: "Aplikasi", width: 24 },
      { key: "sourceFeatureLabel", header: "Fitur", width: 24 },
      { key: "caseOrPosition", header: "Data", width: 28 },
      { key: "messagePreview", header: "Isi Pesan", width: 70 },
      { key: "errorMessage", header: "Error", width: 48 },
      { key: "whatsappMessageId", header: "ID Pesan WhatsApp", width: 36 },
      { key: "ack", header: "ACK", width: 10 },
      { key: "entityType", header: "Jenis Data", width: 18 },
      { key: "entityId", header: "ID Data", width: 24 },
      { key: "id", header: "ID Log", width: 28 },
    ],
    rows: rows.map((row) => ({
      createdAt: row.createdAt,
      sentAt: row.sentAt,
      deliveredAt: row.deliveredAt,
      readAt: row.readAt,
      statusLabel: row.statusLabel,
      recipientName: row.recipientName,
      recipientNumber: row.recipientNumber,
      categoryLabel: row.categoryLabel,
      sourceAppLabel: row.sourceAppLabel,
      sourceFeatureLabel: row.sourceFeatureLabel,
      caseOrPosition: row.caseOrPosition,
      messagePreview: row.messagePreview,
      errorMessage: row.errorMessage,
      whatsappMessageId: row.whatsappMessageId,
      ack: row.ack,
      entityType: row.entityType,
      entityId: row.entityId,
      id: row.id,
    })),
  };
}

export async function exportAletaBotLatestWhatsappRowsXlsx(
  db: AletaDatabase,
  actorUserId: string,
  options: WhatsappLatestRowsExportOptions = {}
) {
  const report = await getAletaBotWhatsappReport(db, actorUserId, {
    ...options,
    limit: 80,
  });
  const rows = filterLatestRows(report.rows, options);
  const buffer = createXlsxWorkbook([
    latestRowsSummarySheet(report, rows, options),
    latestRowsSheet(rows),
  ], {
    creator: "ALETA Bot",
    createdAt: new Date(report.generatedAt),
  });
  const safeRange = report.range.key.replace(/[^a-z0-9-]/gi, "");
  const safeSource = report.source.key.replace(/[^a-z0-9-]/gi, "");
  return {
    buffer,
    filename: `data-terbaru-whatsapp-${safeSource}-${safeRange}-${new Date().toISOString().slice(0, 10)}.xlsx`,
    rowCount: rows.length,
    report,
  };
}

export async function exportAletaBotWhatsappReportXlsx(db: AletaDatabase, actorUserId: string, options: WhatsappReportOptions = {}) {
  const exportLimit = EXPORT_ROW_LIMITS.whatsappReportXlsx;
  const report = await getAletaBotWhatsappReport(db, actorUserId, {
    ...options,
    limit: exportOverflowLimit(exportLimit),
  });
  assertExportRowLimit(report.rows.length, exportLimit, "Export laporan WhatsApp");
  const sheets: XlsxSheet[] = [
    statsSheet(report),
    whatsappRowsSheet(report),
    pairSheet("Per Status", "Status", report.stats.byStatus),
    pairSheet("Per Aplikasi", "Aplikasi", report.stats.byApp),
    pairSheet("Per Fitur", "Sumber/Fitur", report.stats.byFeature),
    pairSheet("Per Jenis Penerima", "Jenis Penerima", report.stats.byCategory),
    pairSheet("Error", "Error", report.stats.topErrors),
    trendSheet(report),
    systemLogSheet(report),
  ];
  const buffer = createXlsxWorkbook(sheets, {
    creator: "ALETA Bot",
    createdAt: new Date(report.generatedAt),
  });
  const safeRange = report.range.key.replace(/[^a-z0-9-]/gi, "");
  const safeSource = report.source.key.replace(/[^a-z0-9-]/gi, "");
  return {
    buffer,
    filename: `laporan-whatsapp-${safeSource}-${safeRange}-${new Date().toISOString().slice(0, 10)}.xlsx`,
    rowCount: report.rows.length,
    report,
  };
}
