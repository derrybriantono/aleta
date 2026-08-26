import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import {
  ALETA_SIPP_PERMISSION,
  hasAletaSippPermission,
  resolveAletaSippAccess,
  type AletaSippPermission,
} from "@/lib/aleta-sipp-types";
import type { UserPersona } from "@/lib/types";
import type { AletaDatabase, SqlInputValue } from "@/server/db/client";
import { AletaBotSippDataSource, getAletaSippDataSourceStatus } from "@/server/modules/aleta-sipp/aleta-sipp-datasource";
import {
  PENDUKUNG2018_FEATURES,
  PENDUKUNG2018_GROUPS,
  type Pendukung2018FeatureDefinition,
} from "@/server/modules/aleta-sipp/aleta-sipp-pendukung2018-catalog";
import {
  normalizeAletaSippSql,
  validateReadOnlySql,
  type AletaSippReadOnlySqlValidation,
} from "@/server/modules/aleta-sipp/aleta-sipp-sql-validator";
import { appendAuditLog } from "@/server/shared/audit";
import { badRequest, forbidden, notFound } from "@/server/shared/http";
import { nextPrefixedId } from "@/server/shared/ids";
import { createXlsxWorkbook, type XlsxSheet } from "@/server/shared/xlsx";

export const ALETA_SIPP_MONITORING_PATHS = {
  pendukung2018: "D:/Satker Asal/Website PA Bungku/xampp/htdocs/pendukung2018",
  skPenilaianSipp2024: "D:/Download File/SK PENILAIAN SIPP 2024.pdf",
};

const MONITORING_GROUP_LABELS: Record<string, string> = {
  KEUANGAN: "Keuangan Perkara",
  VALIDASI_KEUANGAN: "Validasi Keuangan Perkara",
  KEADAAN_KEUANGAN: "Keadaan Keuangan Perkara",
  MONITORING_PERKARA: "Monitoring Perkara",
  KONTROL_PERKARA: "Kontrol Perkara",
  KINERJA_SIPP: "Kinerja SIPP",
  AKTA_CERAI: "Akta Cerai",
  LAPORAN: "Laporan SIPP",
  EKSTERNAL: "Konektor Eksternal",
  MANUAL_REFERENSI: "Manual Input dan Referensi",
};

const MANUAL_INPUT_STATUSES = new Set(["DRAFT", "SUBMITTED", "REVIEWED", "APPROVED", "REJECTED"]);
const REVIEWED_MANUAL_INPUT_STATUSES = new Set(["REVIEWED", "APPROVED", "REJECTED"]);
const FOLLOWUP_STATUSES = new Set(["BELUM_DITINDAKLANJUTI", "PROSES", "DALAM_PROSES", "SELESAI", "DITOLAK", "DIABAIKAN"]);
const COMPLETED_FOLLOWUP_STATUSES = new Set(["SELESAI", "DITOLAK", "DIABAIKAN"]);

type CountRow = { count?: string | number | bigint | null };
type MonitoringIndicatorRow = {
  id: string;
  indicator_key: string;
  indicator_code: string;
  indicator_name: string;
  short_description: string;
  long_description: string;
  source_type: string;
  source_file: string;
  source_location: string;
  category: string;
  sub_category: string;
  period_type: string;
  formula_text: string;
  formula_json: unknown;
  weight: string | number | null;
  max_score: string | number | null;
  threshold_green: string | number | null;
  threshold_yellow: string | number | null;
  threshold_red: string | number | null;
  query_key: string;
  query_id: string | null;
  tables_used: unknown;
  columns_used: unknown;
  data_scope: string;
  result_type: string;
  calculation_mode: string;
  safety_status: string;
  review_status: string;
  confidence_score: string | number | null;
  risk_notes: string;
  recommendation_template: string;
  sk_basis: string;
  assumption_notes: string;
  is_active: number;
  created_at: string;
  updated_at: string;
  latest_run_key?: string | null;
  latest_result_status?: string | null;
  latest_score_percent?: string | number | null;
};

type QueryRegistryRow = {
  id: string;
  query_key: string;
  original_sql: string;
  normalized_sql: string;
  parameterized_sql: string;
  parameters_json: unknown;
  outputs_json: unknown;
  related_table_names_json: unknown;
  security_status: string;
  execution_mode: string;
  review_status: string;
  risk_notes: string;
};

type MonitoringAutoReviewRow = Pendukung2018FeatureCatalogRow & {
  query_id: string | null;
  query_original_sql: string | null;
  query_normalized_sql: string | null;
  query_parameterized_sql: string | null;
  query_tables_json: unknown;
  query_columns_json: unknown;
  query_security_status: string | null;
  query_execution_mode: string | null;
  query_review_status: string | null;
  query_risk_notes: string | null;
};

type Pendukung2018FeatureCatalogRow = {
  id: string;
  feature_key: string;
  feature_code: string;
  feature_name: string;
  group_key: string;
  group_name: string;
  sort_order: number;
  source_type: string;
  source_files_json: unknown;
  source_evidence_json: unknown;
  implementation_status: string;
  migration_status: string;
  safety_status: string;
  review_status: string;
  related_query_key: string;
  related_indicator_key: string;
  tables_used_json: unknown;
  columns_used_json: unknown;
  period_type: string;
  calculation_mode: string;
  result_type: string;
  no_query_reason: string;
  requires_manual_input: number;
  external_dependency: string;
  ui_route: string;
  risk_notes: string;
  recommendation_template: string;
  admin_notes: string;
  is_active: number;
  created_at: string;
  updated_at: string;
  latest_run_key?: string | null;
  latest_result_id?: string | null;
  latest_result_status?: string | null;
  latest_score_percent?: string | number | null;
};

type MonitoringRunContext = {
  runId: string;
  runKey: string;
  runType: string;
  year: number;
  quarter: number | null;
  dateStart: string;
  dateEnd: string;
  dryRun: boolean;
  datasourceMode: string;
  actor: UserPersona;
};

type MonitoringResultItemInput = {
  perkaraId: string;
  nomorPerkara: string;
  itemType: string;
  itemTitle: string;
  itemDescription: string;
  itemStatus: string;
  responsibleRole: string;
  responsibleName: string;
  sourceTable: string;
  sourceData: Record<string, unknown>;
  recommendation: string;
};

type MonitoringCalculation = {
  status: string;
  numerator: number | null;
  denominator: number | null;
  rawValue: number | null;
  score: number;
  maxScore: number;
  scorePercent: number;
  weight: number;
  weightedScore: number;
  resultSummary: string;
  recommendation: string;
  errorMessage: string | null;
  items: MonitoringResultItemInput[];
  executed: boolean;
  queryHash?: string;
  datasourceNote?: string;
};

type QueryCandidate = {
  queryKey: string;
  queryName: string;
  category: string;
  sourceType: string;
  sourceFile: string;
  sourceLocation: string;
  sourceLine: number | null;
  originalSql: string;
  normalizedSql: string;
  parameterizedSql: string;
  tablesUsed: string[];
  columnsUsed: string[];
  parameters: Array<Record<string, unknown>>;
  outputs: Array<Record<string, unknown>>;
  securityStatus: string;
  executionMode: string;
  reviewStatus: string;
  confidenceScore: number;
  riskNotes: string;
};

type AutoReviewFeatureOutcome = {
  featureKey: string;
  featureName: string;
  queryKey: string;
  status: string;
  implementationStatus: string;
  safetyStatus: string;
  reviewStatus: string;
  reasonCode: string;
  reason: string;
  promoted: boolean;
};

type IndicatorCandidate = {
  indicatorKey: string;
  indicatorCode: string;
  indicatorName: string;
  shortDescription: string;
  longDescription: string;
  sourceType: string;
  sourceFile: string;
  sourceLocation: string;
  category: string;
  subCategory: string;
  periodType: string;
  formulaText: string;
  formulaJson: Record<string, unknown>;
  weight: number;
  maxScore: number;
  thresholdGreen: number | null;
  thresholdYellow: number | null;
  thresholdRed: number | null;
  queryKey: string;
  tablesUsed: string[];
  columnsUsed: string[];
  dataScope: string;
  resultType: string;
  calculationMode: string;
  safetyStatus: string;
  reviewStatus: string;
  confidenceScore: number;
  riskNotes: string;
  recommendationTemplate: string;
  skBasis: string;
  assumptionNotes: string;
};

const READABLE_EXTENSIONS = new Set([".php", ".sql", ".txt", ".json", ".html", ".htm", ".js", ".css", ".inc", ".bc"]);
const KEYWORDS = [
  "monitoring",
  "evaluasi",
  "penilaian",
  "sipp",
  "minutasi",
  "putus",
  "putusan",
  "jadwal",
  "sidang",
  "mediasi",
  "ecourt",
  "e-court",
  "e_litigasi",
  "perkara",
  "hakim",
  "panitera",
  "jurusita",
  "akta_cerai",
  "ikrar",
  "upload",
  "dokumen",
  "direktori",
  "dirput",
  "antrian",
  "panggilan",
  "relaas",
  "biaya",
  "indikator",
  "nilai",
  "bobot",
  "triwulan",
  "laporan",
  "statistik",
  "perkara_lama",
  "perkara_aktif",
  "belum_putus",
  "belum_minutasi",
];
const READY_EXECUTION_MODES = new Set(["READY_MONITORING", "READY_ASSESSMENT", "READY_TRIWULAN_ASSESSMENT", "READY_READ_ONLY"]);

const MONITORING_CATEGORIES = [
  "Perkara",
  "Persidangan",
  "Putusan",
  "Minutasi",
  "Mediasi",
  "e-Court",
  "Akta Cerai",
  "Biaya",
  "Dokumen",
  "Jadwal Sidang",
  "Hakim/Panitera/Jurusita",
  "Kepatuhan Input",
  "Kinerja SIPP",
  "Penilaian Triwulan",
  "Lainnya",
];

const SK_INDICATORS = [
  { code: "SK-KIN-01", name: "Waktu Putus Perkara", category: "Kinerja SIPP", weight: 20 },
  { code: "SK-KIN-02", name: "Waktu Minutasi Berkas Perkara", category: "Minutasi", weight: 15 },
  { code: "SK-KIN-03", name: "Waktu Publikasi Putusan", category: "Putusan", weight: 15 },
  { code: "SK-INP-01", name: "Pendaftaran Perkara", category: "Kepatuhan Input", weight: 2 },
  { code: "SK-INP-02", name: "Penetapan Majelis Hakim", category: "Hakim/Panitera/Jurusita", weight: 2.5 },
  { code: "SK-INP-03", name: "Penginputan Penetapan Majelis Hakim", category: "Hakim/Panitera/Jurusita", weight: 2 },
  { code: "SK-INP-04", name: "Penunjukan PP", category: "Hakim/Panitera/Jurusita", weight: 2.5 },
  { code: "SK-INP-05", name: "Penginputan Penunjukan PP", category: "Hakim/Panitera/Jurusita", weight: 2 },
  { code: "SK-INP-06", name: "Penunjukan Juru Sita", category: "Hakim/Panitera/Jurusita", weight: 2.5 },
  { code: "SK-INP-07", name: "Penginputan Penunjukan Juru Sita", category: "Hakim/Panitera/Jurusita", weight: 2 },
  { code: "SK-INP-08", name: "Penetapan Hari Sidang Pertama", category: "Persidangan", weight: 2.5 },
  { code: "SK-INP-09", name: "Penginputan Penetapan Hari Sidang", category: "Persidangan", weight: 2 },
  { code: "SK-INP-10", name: "Pengisian Data Relaas", category: "Persidangan", weight: 2.5 },
  { code: "SK-INP-11", name: "Data Mediasi", category: "Mediasi", weight: 2.5 },
  { code: "SK-INP-12", name: "Kelengkapan Data Saksi", category: "Kepatuhan Input", weight: 2.5 },
  { code: "SK-INP-13", name: "Pemberitahuan Putusan/Penetapan", category: "Putusan", weight: 2.5 },
  { code: "SK-INP-14", name: "Pengisian BHT", category: "Putusan", weight: 2.5 },
  { code: "SK-INP-15", name: "Pencatatan Sisa Panjar Biaya Perkara", category: "Biaya", weight: 2.5 },
  { code: "SK-INP-16", name: "Penginputan Data Arsip", category: "Dokumen", weight: 2.5 },
  { code: "SK-INP-17", name: "Pelaksanaan Penerimaan Panggilan/Pemberitahuan Delegasi", category: "Persidangan", weight: 2.5 },
  { code: "SK-DOC-01", name: "E-Dokumen Petitum/Tuntutan", category: "Dokumen", weight: 2.5 },
  { code: "SK-DOC-02", name: "E-Dokumen Relaas", category: "Dokumen", weight: 2.5 },
  { code: "SK-DOC-03", name: "E-Dokumen BAS", category: "Dokumen", weight: 3 },
  { code: "SK-DOC-04", name: "E-Dokumen AC", category: "Akta Cerai", weight: 2 },
  { code: "SK-DOC-05", name: "E-Dokumen Amar Putusan", category: "Dokumen", weight: 10 },
  { code: "SK-KES-01", name: "Agenda Sidang Terakhir Tidak Sesuai", category: "Persidangan", weight: -2 },
  { code: "SK-KES-02", name: "Sinkronisasi Tidak Dilakukan Tiap Hari", category: "Kinerja SIPP", weight: -2 },
  { code: "SK-KES-03", name: "Pengiriman Panggilan Delegasi", category: "Persidangan", weight: -2 },
  { code: "SK-KES-04", name: "Status Putus Perkara Tidak Sesuai Proses Persidangan", category: "Putusan", weight: -2 },
  { code: "SK-KES-05", name: "Validasi Data Perkara", category: "Kepatuhan Input", weight: -2 },
];

function countValue(row: CountRow | undefined) {
  return Number(row?.count ?? 0);
}

function numeric(value: string | number | null | undefined) {
  return Number(value ?? 0);
}

function jsonString(value: unknown) {
  return JSON.stringify(value ?? null);
}

function asArray(value: unknown) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function asRecord(value: unknown) {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value) as unknown;
      return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
    } catch {
      return {};
    }
  }
  return {};
}

function normalizeWhitespace(value: string, maxLength = 800) {
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function slugKey(value: string, maxLength = 72) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_")
    .slice(0, maxLength) || "item";
}

function stableId(prefix: string, ...parts: string[]) {
  const raw = parts.join("__");
  return `${prefix}_${slugKey(raw, 96)}_${createHash("sha1").update(raw).digest("hex").slice(0, 10)}`;
}

function sqlHash(sql: string) {
  return createHash("sha1").update(normalizeSql(sql).toLowerCase()).digest("hex");
}

function normalizeLike(value: string) {
  return `%${value.trim().toLowerCase().replace(/[%_]/g, "\\$&")}%`;
}

function pageInput(input: { page?: number; pageSize?: number; limit?: number; offset?: number }) {
  if (input.limit !== undefined || input.offset !== undefined) {
    const pageSize = Math.max(1, Math.min(100, Number(input.limit || input.pageSize || 25)));
    const offset = Math.max(0, Number(input.offset || 0));
    return { page: Math.floor(offset / pageSize) + 1, pageSize, offset };
  }
  const pageSize = Math.max(1, Math.min(100, Number(input.pageSize || 25)));
  const page = Math.max(1, Number(input.page || 1));
  return { page, pageSize, offset: (page - 1) * pageSize };
}

async function readCount(db: AletaDatabase, sql: string, params: SqlInputValue[] = []) {
  return countValue(await db.queryOne<CountRow>(sql, params));
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function finiteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function firstNumber(row: Record<string, unknown> | undefined, keys: string[]) {
  if (!row) return null;
  const lowerEntries = Object.entries(row).map(([key, value]) => [key.toLowerCase(), value] as const);
  for (const key of keys) {
    const found = lowerEntries.find(([candidate]) => candidate === key.toLowerCase());
    const numberValue = finiteNumber(found?.[1]);
    if (numberValue !== null) return numberValue;
  }
  return null;
}

function firstString(row: Record<string, unknown>, keys: string[]) {
  const lowerEntries = Object.entries(row).map(([key, value]) => [key.toLowerCase(), value] as const);
  for (const key of keys) {
    const found = lowerEntries.find(([candidate]) => candidate === key.toLowerCase());
    if (found && found[1] !== null && found[1] !== undefined && String(found[1]).trim()) return String(found[1]).trim();
  }
  return "";
}

function truthyIssueValue(value: unknown) {
  if (typeof value === "boolean") return value;
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return false;
  return ["1", "true", "ya", "y", "yes", "bermasalah", "tidak_sesuai", "terlambat", "lewat_batas", "merah", "kuning", "missing", "belum"].includes(normalized);
}

function rowLooksProblematic(row: Record<string, unknown>) {
  for (const key of ["is_problem", "problem", "bermasalah", "is_late", "terlambat", "lewat_batas", "tidak_sesuai", "missing", "invalid"]) {
    if (Object.prototype.hasOwnProperty.call(row, key) && truthyIssueValue(row[key])) return true;
  }
  const status = firstString(row, ["status", "item_status", "warna", "kategori_status", "compliance_status"]);
  if (!status) return false;
  return !["hijau", "ok", "aman", "sesuai", "lengkap", "valid", "success", "selesai"].includes(status.toLowerCase());
}

function parameterDefinitions(query: QueryRegistryRow) {
  const fromJson = asArray(query.parameters_json)
    .map((item) => asRecord(item))
    .filter((item) => String(item.name ?? "").trim());
  if (fromJson.length > 0) return fromJson;
  const names = Array.from(new Set(Array.from((query.original_sql || query.normalized_sql).matchAll(/:([a-zA-Z_][a-zA-Z0-9_]*)/g)).map((match) => match[1])));
  return names.map((name) => ({ name, required: true }));
}

function orderedParameterNames(query: QueryRegistryRow) {
  const named = Array.from((query.original_sql || "").matchAll(/:([a-zA-Z_][a-zA-Z0-9_]*)/g)).map((match) => match[1]);
  if (named.length > 0) return named;
  return parameterDefinitions(query).map((param) => String(param.name));
}

function contextValueForParameter(name: string, context: MonitoringRunContext) {
  const key = name.toLowerCase();
  if (["date_start", "tanggal_mulai", "tgl_mulai", "tgl1", "period_start", "periode_awal", "start_date", "tanggal_awal"].includes(key)) return context.dateStart;
  if (["date_end", "tanggal_selesai", "tgl_selesai", "tgl2", "period_end", "periode_akhir", "end_date", "tanggal_akhir"].includes(key)) return context.dateEnd;
  if (["year", "tahun"].includes(key)) return context.year;
  if (["quarter", "triwulan"].includes(key)) return context.quarter;
  if (["limit", "page_size", "pageSize"].includes(key)) return 250;
  return undefined;
}

function monitoringQueryParams(query: QueryRegistryRow, context: MonitoringRunContext) {
  const definitions = parameterDefinitions(query);
  const placeholderValues: Record<string, unknown> = {
    date_start: context.dateStart,
    date_end: context.dateEnd,
    tanggal_mulai: context.dateStart,
    tanggal_selesai: context.dateEnd,
    tahun: context.year,
    year: context.year,
    quarter: context.quarter,
    triwulan: context.quarter,
  };
  const missing: string[] = [];
  for (const definition of definitions) {
    const name = String(definition.name ?? "").trim();
    if (!name) continue;
    const value = contextValueForParameter(name, context);
    if (value !== undefined && value !== null) placeholderValues[name] = value;
    const required = definition.required !== false && definition.required !== "false";
    if (required && placeholderValues[name] === undefined) missing.push(name);
  }
  const positionalParams = orderedParameterNames(query).map((name) => placeholderValues[name] ?? contextValueForParameter(name, context) ?? null);
  return { placeholderValues, positionalParams, missing };
}

function queryReadyForMonitoring(query: QueryRegistryRow | null) {
  if (!query) return { ready: false, status: "DATA_TIDAK_CUKUP", reason: "Indikator belum memiliki query registry." };
  const sql = query.original_sql || query.normalized_sql || query.parameterized_sql;
  const safety = validateReadOnlySql(sql);
  if (query.security_status !== "SAFE_READ_ONLY") {
    return { ready: false, status: query.security_status || "QUERY_NOT_READY", reason: `Query registry masih berstatus ${query.security_status}.` };
  }
  if (!READY_EXECUTION_MODES.has(query.execution_mode)) {
    return { ready: false, status: query.execution_mode || "QUERY_NOT_READY", reason: `Execution mode ${query.execution_mode || "-"} belum siap monitoring/assessment.` };
  }
  if (!safety.ok) return { ready: false, status: safety.status, reason: safety.blockedReason ?? "SQL registry tidak lolos validasi read-only." };
  return { ready: true, status: "READY", reason: "" };
}

async function loadRegisteredMonitoringQuery(db: AletaDatabase, queryKey: string) {
  if (!queryKey) return null;
  return db.queryOne<QueryRegistryRow>(
    `
    SELECT id, query_key, original_sql, normalized_sql, parameterized_sql, parameters_json, outputs_json,
      related_table_names_json, security_status, execution_mode, review_status, risk_notes
    FROM aleta_sipp_query_registry
    WHERE query_key = ? AND is_active = 1
    LIMIT 1
    `,
    [queryKey]
  );
}

async function executeRegisteredMonitoringQuery(
  query: QueryRegistryRow,
  context: MonitoringRunContext,
  purpose: "monitoring" | "assessment"
) {
  const params = monitoringQueryParams(query, context);
  if (params.missing.length > 0) {
    return {
      ok: false,
      rows: [] as Array<Record<string, unknown>>,
      rowCount: 0,
      error: `Parameter wajib belum tersedia: ${params.missing.join(", ")}.`,
      blockedReason: "MISSING_PARAMS",
    };
  }
  if (context.dryRun) {
    return {
      ok: true,
      rows: [] as Array<Record<string, unknown>>,
      rowCount: 0,
      dryRun: true,
      queryHash: "",
    };
  }
  const sql = query.original_sql || query.normalized_sql || query.parameterized_sql;
  const result = purpose === "assessment"
    ? await AletaBotSippDataSource.runAssessmentQuery({
        queryKey: query.query_key,
        sql,
        placeholderValues: params.placeholderValues,
        positionalParams: params.positionalParams,
        options: { limit: 500, timeoutMs: 15000 },
      })
    : await AletaBotSippDataSource.runMonitoringQuery({
        queryKey: query.query_key,
        sql,
        placeholderValues: params.placeholderValues,
        positionalParams: params.positionalParams,
        options: { limit: 500, timeoutMs: 15000 },
      });
  return result;
}

function recommendationForIndicator(indicator: MonitoringIndicatorRow, status: string) {
  if (indicator.recommendation_template?.trim()) return indicator.recommendation_template;
  const haystack = `${indicator.indicator_name} ${indicator.category}`.toLowerCase();
  if (haystack.includes("minut")) return "Periksa perkara yang sudah putus tetapi belum memiliki data minutasi lengkap. Pastikan tanggal minutasi dan dokumen terkait telah diinput sesuai ketentuan.";
  if (haystack.includes("lebih dari 6") || haystack.includes("perkara lama")) return "Evaluasi penyebab perkara belum selesai, cek jadwal sidang terakhir, agenda, dan hambatan proses.";
  if (haystack.includes("putusan") || haystack.includes("publikasi") || haystack.includes("upload")) return "Periksa status dokumen putusan dan lakukan upload/publikasi sesuai ketentuan.";
  if (haystack.includes("pmh") || haystack.includes("phs") || haystack.includes("majelis")) return "Periksa tanggal pendaftaran, tanggal penetapan majelis, dan tanggal penetapan hari sidang.";
  if (haystack.includes("relaas") || haystack.includes("pbt") || haystack.includes("bht")) return "Periksa data pemberitahuan, relaas, dan status berkekuatan hukum tetap.";
  if (haystack.includes("panjar") || haystack.includes("biaya") || haystack.includes("keuangan")) return "Periksa transaksi biaya perkara, pengembalian sisa panjar, dan validasi kas.";
  if (haystack.includes("mediasi")) return "Periksa jadwal mediasi, mediator, hasil mediasi, dan kelengkapan input mediasi.";
  if (status === "DATA_TIDAK_CUKUP") return "Lengkapi sumber data, query registry, atau input manual agar indikator dapat dihitung.";
  return "Review hasil indikator dan tindak lanjuti data yang belum sesuai.";
}

function buildMonitoringResultItems(
  indicator: MonitoringIndicatorRow,
  rows: Array<Record<string, unknown>>,
  status: string,
  limit = 100
) {
  const sourceTable = asArray(indicator.tables_used).map(String)[0] ?? "";
  const problematicRows = rows.filter(rowLooksProblematic);
  const selectedRows = problematicRows.length > 0 ? problematicRows : status === "HIJAU" ? [] : rows;
  return selectedRows.slice(0, limit).map((row, index) => {
    const perkaraId = firstString(row, ["perkara_id", "id_perkara", "source_case_id", "perkaraId"]);
    const nomorPerkara = firstString(row, ["nomor_perkara", "no_perkara", "nomor", "nomorPerkara"]);
    const title = nomorPerkara || firstString(row, ["item_title", "judul", "nama", "label"]) || `${indicator.indicator_name} #${index + 1}`;
    const descriptionParts = [
      firstString(row, ["item_description", "keterangan", "uraian", "issue_description", "catatan"]),
      firstString(row, ["status", "item_status", "warna", "kategori_status"]),
    ].filter(Boolean);
    return {
      perkaraId,
      nomorPerkara,
      itemType: indicator.category || indicator.result_type || "MONITORING",
      itemTitle: title,
      itemDescription: descriptionParts.join(" - ") || `Data perlu ditindaklanjuti untuk indikator ${indicator.indicator_name}.`,
      itemStatus: status === "MERAH" ? "BELUM_DITINDAKLANJUTI" : status === "KUNING" ? "PROSES" : "BELUM_DITINDAKLANJUTI",
      responsibleRole: firstString(row, ["responsible_role", "jabatan", "role", "petugas_role"]),
      responsibleName: firstString(row, ["responsible_name", "nama_petugas", "petugas", "panitera_pengganti", "nama_hakim", "nama_jurusita"]),
      sourceTable: firstString(row, ["source_table", "table_name"]) || sourceTable,
      sourceData: row,
      recommendation: recommendationForIndicator(indicator, status),
    } satisfies MonitoringResultItemInput;
  });
}

function calculateIndicatorScore(
  indicator: MonitoringIndicatorRow,
  rows: Array<Record<string, unknown>>,
  context: MonitoringRunContext,
  options: { dryRun?: boolean; queryHash?: string; datasourceError?: string } = {}
): MonitoringCalculation {
  const maxScore = Math.max(0, numeric(indicator.max_score) || 100);
  const weight = numeric(indicator.weight);
  const recommendation = recommendationForIndicator(indicator, options.datasourceError ? "DATA_TIDAK_CUKUP" : "");

  if (options.dryRun) {
    return {
      status: "READY_DRY_RUN",
      numerator: null,
      denominator: null,
      rawValue: null,
      score: 0,
      maxScore,
      scorePercent: 0,
      weight,
      weightedScore: 0,
      resultSummary: "Dry-run: query registry lolos safety gate, tetapi data SIPP tidak dieksekusi.",
      recommendation,
      errorMessage: null,
      items: [],
      executed: false,
      queryHash: options.queryHash,
    };
  }

  if (options.datasourceError) {
    return {
      status: "DATA_TIDAK_CUKUP",
      numerator: null,
      denominator: null,
      rawValue: null,
      score: 0,
      maxScore,
      scorePercent: 0,
      weight,
      weightedScore: 0,
      resultSummary: `Datasource SIPP belum tersedia untuk menghitung indikator: ${options.datasourceError}`,
      recommendation,
      errorMessage: options.datasourceError,
      items: [],
      executed: false,
      queryHash: options.queryHash,
      datasourceNote: options.datasourceError,
    };
  }

  const first = rows[0];
  const explicitPercent = firstNumber(first, ["score_percent", "percent", "persentase", "percentage", "pct", "nilai_persen"]);
  const numerator = firstNumber(first, ["numerator", "jumlah_baik", "valid_count", "valid", "sesuai_count", "sesuai", "success_count"]);
  const denominator = firstNumber(first, ["denominator", "total", "total_count", "jumlah_total", "total_perkara", "row_count"]);
  const issueCountFromRow = firstNumber(first, ["issue_count", "problem_count", "jumlah_masalah", "bermasalah_count", "invalid_count", "late_count"]);
  const rowIssueCount = rows.filter(rowLooksProblematic).length;
  const issueCount = issueCountFromRow ?? (rowIssueCount > 0 ? rowIssueCount : rows.length);
  let scorePercent: number | null = explicitPercent === null ? null : clampPercent(explicitPercent);

  if (scorePercent === null && denominator !== null && denominator > 0) {
    if (numerator !== null) scorePercent = clampPercent((numerator / denominator) * 100);
    else scorePercent = clampPercent(((denominator - issueCount) / denominator) * 100);
  }

  if (scorePercent === null) {
    if (rows.length === 0) scorePercent = 100;
    else if (indicator.result_type === "ISSUE_LIST" || indicator.calculation_mode === "QUERY_REGISTRY") scorePercent = 0;
  }

  if (scorePercent === null) {
    return {
      status: "DATA_TIDAK_CUKUP",
      numerator,
      denominator,
      rawValue: rows.length,
      score: 0,
      maxScore,
      scorePercent: 0,
      weight,
      weightedScore: 0,
      resultSummary: `Query dijalankan, tetapi hasil ${rows.length} baris belum menyediakan percent/numerator/denominator yang cukup untuk scoring.`,
      recommendation,
      errorMessage: null,
      items: [],
      executed: true,
      queryHash: options.queryHash,
    };
  }

  const greenThreshold = indicator.threshold_green === null ? 90 : numeric(indicator.threshold_green);
  const yellowThreshold = indicator.threshold_yellow === null ? 60 : numeric(indicator.threshold_yellow);
  let status = scorePercent >= greenThreshold ? "HIJAU" : scorePercent >= yellowThreshold ? "KUNING" : "MERAH";
  if (weight < 0) {
    status = issueCount > 0 ? "MERAH" : "HIJAU";
    scorePercent = issueCount > 0 ? 0 : 100;
  }
  const score = weight < 0 ? (issueCount > 0 ? weight : 0) : (maxScore * scorePercent) / 100;
  const weightedScore = weight === 0 ? score : weight < 0 ? score : (weight * scorePercent) / 100;
  const items = buildMonitoringResultItems(indicator, rows, status);
  const denominatorText = denominator !== null ? denominator : rows.length;
  const problemText = status === "HIJAU" ? 0 : items.length || issueCount;

  return {
    status,
    numerator: numerator ?? (denominator !== null ? Math.max(0, denominator - issueCount) : null),
    denominator: denominator ?? rows.length,
    rawValue: issueCount,
    score,
    maxScore,
    scorePercent,
    weight,
    weightedScore,
    resultSummary: `Query registry dijalankan untuk periode ${context.dateStart} sampai ${context.dateEnd}. Total data: ${denominatorText}, temuan: ${problemText}, skor: ${scorePercent.toFixed(2)}%.`,
    recommendation,
    errorMessage: null,
    items,
    executed: true,
    queryHash: options.queryHash,
  };
}

async function manualCalculationIfAvailable(
  db: AletaDatabase,
  indicator: MonitoringIndicatorRow,
  context: MonitoringRunContext
): Promise<MonitoringCalculation | null> {
  const row = await db.queryOne<Record<string, unknown>>(
    `
    SELECT value_json, notes, status
    FROM aleta_sipp_monitoring_manual_inputs
    WHERE indicator_id = ? AND period_start <= ? AND period_end >= ?
      AND status IN ('REVIEWED', 'APPROVED', 'VERIFIED', 'ADMIN_CONFIRMED', 'FINAL')
    ORDER BY created_at DESC
    LIMIT 1
    `,
    [indicator.id, context.dateStart, context.dateEnd]
  );
  if (!row) return null;
  const value = asRecord(row.value_json);
  const percent = clampPercent(finiteNumber(value.scorePercent ?? value.percent ?? value.score ?? value.value) ?? 0);
  const maxScore = Math.max(0, numeric(indicator.max_score) || 100);
  const weight = numeric(indicator.weight);
  const status = percent >= (indicator.threshold_green === null ? 90 : numeric(indicator.threshold_green)) ? "HIJAU" : percent >= (indicator.threshold_yellow === null ? 60 : numeric(indicator.threshold_yellow)) ? "KUNING" : "MERAH";
  return {
    status,
    numerator: null,
    denominator: null,
    rawValue: percent,
    score: (maxScore * percent) / 100,
    maxScore,
    scorePercent: percent,
    weight,
    weightedScore: weight ? (weight * percent) / 100 : (maxScore * percent) / 100,
    resultSummary: `Nilai manual terverifikasi dipakai untuk periode ${context.dateStart} sampai ${context.dateEnd}. Catatan: ${String(row.notes ?? "-")}`,
    recommendation: recommendationForIndicator(indicator, status),
    errorMessage: null,
    items: [],
    executed: false,
  };
}

function requirePermission(actor: UserPersona, permission: AletaSippPermission, message: string) {
  const access = resolveAletaSippAccess(actor);
  if (!hasAletaSippPermission(access, permission)) forbidden(message);
  return access;
}

function requireAnyPermission(actor: UserPersona, permissions: AletaSippPermission[], message: string) {
  const access = resolveAletaSippAccess(actor);
  if (!permissions.some((permission) => hasAletaSippPermission(access, permission))) forbidden(message);
  return access;
}

function mapIndicatorRow(row: MonitoringIndicatorRow) {
  return {
    id: row.id,
    indicatorKey: row.indicator_key,
    indicatorCode: row.indicator_code,
    indicatorName: row.indicator_name,
    shortDescription: row.short_description,
    longDescription: row.long_description,
    sourceType: row.source_type,
    sourceFile: row.source_file,
    sourceLocation: row.source_location,
    category: row.category,
    subCategory: row.sub_category,
    periodType: row.period_type,
    formulaText: row.formula_text,
    formula: asRecord(row.formula_json),
    weight: numeric(row.weight),
    maxScore: numeric(row.max_score),
    thresholdGreen: row.threshold_green === null ? null : numeric(row.threshold_green),
    thresholdYellow: row.threshold_yellow === null ? null : numeric(row.threshold_yellow),
    thresholdRed: row.threshold_red === null ? null : numeric(row.threshold_red),
    queryKey: row.query_key,
    queryId: row.query_id,
    tablesUsed: asArray(row.tables_used).map(String),
    columnsUsed: asArray(row.columns_used).map(String),
    dataScope: row.data_scope,
    resultType: row.result_type,
    calculationMode: row.calculation_mode,
    safetyStatus: row.safety_status,
    status: row.safety_status,
    reviewStatus: row.review_status,
    confidenceScore: numeric(row.confidence_score),
    riskNotes: row.risk_notes,
    recommendationTemplate: row.recommendation_template,
    skBasis: row.sk_basis,
    assumptionNotes: row.assumption_notes,
    latestRunKey: row.latest_run_key ?? null,
    latestResultStatus: row.latest_result_status ?? null,
    latestScorePercent: row.latest_score_percent === null || row.latest_score_percent === undefined ? null : numeric(row.latest_score_percent),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeSql(sql: string) {
  return normalizeAletaSippSql(sql);
}

function parameterizeSql(sql: string) {
  return normalizeSql(sql)
    .replace(/:\w+/g, "?")
    .replace(/\$[a-zA-Z_][a-zA-Z0-9_]*/g, "?");
}

function humanize(value: string) {
  return value
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();
}

function monitoringGroupName(groupKey: string, fallback?: string | null) {
  return MONITORING_GROUP_LABELS[groupKey] ?? fallback ?? humanize(groupKey || "monitoring");
}

function categoryForText(value: string) {
  const lower = value.toLowerCase();
  if (lower.includes("minut")) return "Minutasi";
  if (lower.includes("mediasi")) return "Mediasi";
  if (lower.includes("ecourt") || lower.includes("e-court") || lower.includes("elitigasi")) return "e-Court";
  if (lower.includes("akta") || lower.includes("_ac") || lower.includes(" ac")) return "Akta Cerai";
  if (lower.includes("keuangan") || lower.includes("biaya") || lower.includes("panjar")) return "Biaya";
  if (lower.includes("dok") || lower.includes("upload") || lower.includes("direktori")) return "Dokumen";
  if (lower.includes("sidang") || lower.includes("panggilan") || lower.includes("relaas")) return "Persidangan";
  if (lower.includes("putus") || lower.includes("bht")) return "Putusan";
  if (lower.includes("hakim") || lower.includes("majelis") || lower.includes("panitera") || lower.includes("jurusita") || lower.includes("_pp")) return "Hakim/Panitera/Jurusita";
  if (lower.includes("kinerja") || lower.includes("kepatuhan")) return "Kinerja SIPP";
  return "Perkara";
}

function extractTables(sql: string) {
  return Array.from(new Set(Array.from(sql.matchAll(/\b(?:FROM|JOIN)\s+`?([a-zA-Z0-9_]+)`?/gi)).map((match) => match[1].toLowerCase()))).slice(0, 30);
}

function extractColumns(sql: string) {
  return Array.from(
    new Set(
      Array.from(sql.matchAll(/(?:SELECT|,)\s*(?:`?[a-zA-Z0-9_]+`?\.)?`?([a-zA-Z0-9_]+)`?(?:\s+AS\s+`?([a-zA-Z0-9_]+)`?)?/gi))
        .map((match) => match[2] || match[1])
        .filter((value) => !["select", "from", "case", "when", "then", "else", "end"].includes(value.toLowerCase()))
    )
  ).slice(0, 60);
}

function extractParameters(sql: string) {
  const parameters = Array.from(new Set(Array.from(sql.matchAll(/:([a-zA-Z_][a-zA-Z0-9_]*)/g)).map((match) => match[1])));
  if (/tanggal|periode| BETWEEN |\$tgl|\$tahun|\$bulan/i.test(sql)) {
    if (!parameters.includes("date_start")) parameters.push("date_start");
    if (!parameters.includes("date_end")) parameters.push("date_end");
  }
  return parameters.map((name) => ({
    name,
    label: humanize(name),
    dataType: /tanggal|date|tgl/i.test(name) ? "date" : /id$/.test(name) ? "number" : "text",
    required: true,
  }));
}

function safetyForQuery(sql: string, sourceType: string) {
  const normalized = normalizeSql(sql);
  const validation = validateReadOnlySql(normalized);
  if (validation.status === "UNSAFE_KEYWORD" || validation.status === "MULTI_STATEMENT" || validation.status === "COMMENTED_SQL") {
    return {
      securityStatus: "REJECTED_WRITE_QUERY",
      executionMode: "UNSAFE_RAW_SQL",
      reviewStatus: "NEEDS_ADMIN_REVIEW",
      confidenceScore: 10,
      riskNotes: "Query mengandung operasi write/DDL dari aplikasi lama sehingga tidak akan dieksekusi.",
    };
  }
  const hasDynamicPhp = /\$[a-zA-Z_][a-zA-Z0-9_]*/.test(normalized);
  const hasPeriodHint = /tanggal|periode| BETWEEN |\$tgl|\$tahun|\$bulan/i.test(normalized);
  const hasLimit = /\bLIMIT\s+\d+\b/i.test(normalized);
  if (validation.ok && !hasDynamicPhp && hasPeriodHint && hasLimit) {
    return {
      securityStatus: "SAFE_READ_ONLY",
      executionMode: sourceType === "SK_PENILAIAN_SIPP_2024" ? "READY_ASSESSMENT" : "READY_MONITORING",
      reviewStatus: "AUTO_IMPORTED",
      confidenceScore: 82,
      riskNotes: "Query terdeteksi read-only, memiliki petunjuk periode, dan dibatasi LIMIT.",
    };
  }
  if (validation.ok) {
    return {
      securityStatus: "NEEDS_REVIEW",
      executionMode: sourceType === "PENDUKUNG2018" ? "PENDUKUNG2018_REFERENCE_ONLY" : "SK_REFERENCE_ONLY",
      reviewStatus: "NEEDS_ADMIN_REVIEW",
      confidenceScore: 55,
      riskNotes: "Query read-only dari sumber referensi, tetapi belum aman untuk eksekusi monitoring karena perlu parameter periode/limit/validasi admin.",
    };
  }
  return {
    securityStatus: "NEEDS_REVIEW",
    executionMode: sourceType === "PENDUKUNG2018" ? "PENDUKUNG2018_REFERENCE_ONLY" : "SK_REFERENCE_ONLY",
    reviewStatus: "NEEDS_ADMIN_REVIEW",
    confidenceScore: 25,
    riskNotes: "Potongan SQL belum lengkap atau tidak cukup jelas untuk dieksekusi.",
  };
}

function extractSqlSnippets(text: string, limit = 2000) {
  const snippets: Array<{ sql: string; line: number; title: string }> = [];
  const patterns = [
    /\$[A-Za-z0-9_]*\s*=\s*["']([\s\S]*?\b(?:SELECT|INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|REPLACE)\b[\s\S]*?)["']\s*;/gi,
    /\b(?:mysql_query|mysqli_query)\s*\(\s*(?:\$[A-Za-z0-9_]+\s*,\s*)?["']([\s\S]*?)["']\s*\)/gi,
    /\b(?:SELECT|WITH)\b[\s\S]{20,2500}?(?=(?:\n\s*(?:SELECT|WITH|INSERT|UPDATE|DELETE)\b)|$)/gi,
  ];
  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) && snippets.length < limit) {
      const raw = match[1] || match[0];
      const sql = normalizeSql(raw.replace(/\\[rn]/g, " "));
      if (!/\b(SELECT|WITH|INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|REPLACE)\b/i.test(sql) || sql.length < 20) continue;
      const line = text.slice(0, match.index).split(/\r?\n/).length;
      const before = text.slice(0, match.index).split(/\r?\n/).slice(-5).map((item) => item.trim()).filter(Boolean);
      const title = before.reverse().find((item) => item.length > 4 && !item.includes("<?")) ?? "Query Kandidat";
      snippets.push({ sql, line, title: normalizeWhitespace(title, 100) });
    }
  }
  return snippets;
}

function queryCandidateFromSql(input: {
  sql: string;
  title: string;
  sourceType: string;
  sourceFile: string;
  sourceLocation: string;
  sourceLine: number | null;
}) {
  const normalizedSql = normalizeSql(input.sql);
  const category = categoryForText(`${input.sourceLocation} ${input.title} ${normalizedSql}`);
  const safety = safetyForQuery(normalizedSql, input.sourceType);
  const tablesUsed = extractTables(normalizedSql);
  const columnsUsed = extractColumns(normalizedSql);
  const keyPrefix = input.sourceType === "PENDUKUNG2018" ? "QRY_PENDUKUNG2018" : "QRY_SK_SIPP";
  const queryKey = `${keyPrefix}_${slugKey(category, 24).toUpperCase()}_${slugKey(input.sourceLocation || input.title, 48).toUpperCase()}_${sqlHash(normalizedSql).slice(0, 6).toUpperCase()}`.slice(0, 118);
  return {
    queryKey,
    queryName: humanize(input.title || path.basename(input.sourceFile)),
    category,
    sourceType: input.sourceType,
    sourceFile: input.sourceFile,
    sourceLocation: input.sourceLocation,
    sourceLine: input.sourceLine,
    originalSql: input.sql,
    normalizedSql,
    parameterizedSql: parameterizeSql(normalizedSql),
    tablesUsed,
    columnsUsed,
    parameters: extractParameters(normalizedSql),
    outputs: columnsUsed.map((name) => ({ name, label: humanize(name), dataType: "text" })),
    ...safety,
  } satisfies QueryCandidate;
}

async function walkFiles(root: string) {
  const files: string[] = [];
  async function walk(dir: string) {
    const entries = await readdir(/* turbopackIgnore: true */ dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      const full = path.join(/* turbopackIgnore: true */ dir, entry.name);
      if (entry.isDirectory()) {
        if (!/node_modules|vendor|\.git|cache/i.test(full)) await walk(full);
      } else {
        files.push(full);
      }
    }
  }
  await walk(root);
  return files;
}

function relativeSource(root: string, file: string) {
  return path.relative(root, file).replace(/\\/g, "/");
}

function menuItemsFromText(text: string) {
  return Array.from(text.matchAll(/href\s*=\s*["']([^"'#?]+\.php)[^"']*["'][^>]*>([^<]{2,120})/gi))
    .map((match) => ({ href: match[1], label: normalizeWhitespace(match[2], 120) }))
    .filter((item) => item.label && !["kode", "hapus", "detail", "cetak"].includes(item.label.toLowerCase()));
}

function indicatorFromFile(input: {
  root: string;
  file: string;
  text: string;
  queryKey: string;
  querySafetyStatus: string;
  tablesUsed: string[];
  columnsUsed: string[];
}) {
  const location = relativeSource(input.root, input.file);
  const label = humanize(path.basename(input.file));
  const category = categoryForText(`${location} ${input.text.slice(0, 2000)}`);
  const hasFormulaHint = /\b(nilai|bobot|persen|prosentase|rumus|tepat|tidak tepat|hari|bulan)\b/i.test(input.text);
  const safetyStatus = input.queryKey
    ? input.querySafetyStatus === "SAFE_READ_ONLY" ? "READY_MONITORING" : "QUERY_NOT_READY"
    : hasFormulaHint ? "NEEDS_REVIEW" : "DATA_TIDAK_CUKUP";
  return {
    indicatorKey: `P2018_${slugKey(location, 86).toUpperCase()}`,
    indicatorCode: `P2018-${createHash("sha1").update(location).digest("hex").slice(0, 8).toUpperCase()}`,
    indicatorName: label,
    shortDescription: `Indikator/laporan hasil audit katalog monitoring SIPP: ${label}.`,
    longDescription: normalizeWhitespace(`Sumber ${location}. ${hasFormulaHint ? "File memuat petunjuk nilai/bobot/periode yang perlu dikonfirmasi admin." : "File terdeteksi sebagai menu/laporan terkait monitoring SIPP."}`, 900),
    sourceType: "PENDUKUNG2018",
    sourceFile: ALETA_SIPP_MONITORING_PATHS.pendukung2018,
    sourceLocation: location,
    category,
    subCategory: "Audit Sumber Lama",
    periodType: /tanggal|bulan|tahun|periode/i.test(input.text) ? "PERIODE_TANGGAL" : "NEEDS_REVIEW",
    formulaText: hasFormulaHint ? "Formula/ambang ditemukan sebagai narasi/kode sumber lama dan perlu review admin sebelum dieksekusi." : "Formula tidak eksplisit di file sumber lama; perlu review admin.",
    formulaJson: { source: "pendukung2018", hasFormulaHint },
    weight: 0,
    maxScore: 100,
    thresholdGreen: null,
    thresholdYellow: null,
    thresholdRed: null,
    queryKey: input.queryKey,
    tablesUsed: input.tablesUsed,
    columnsUsed: input.columnsUsed,
    dataScope: "SIPP_LOCAL_OR_ALETA_BOT_READ_ONLY",
    resultType: "ISSUE_LIST",
    calculationMode: input.queryKey ? "QUERY_REGISTRY" : "REFERENCE_ONLY",
    safetyStatus,
    reviewStatus: safetyStatus === "READY_MONITORING" ? "AUTO_IMPORTED" : "NEEDS_ADMIN_REVIEW",
    confidenceScore: hasFormulaHint ? 68 : 48,
    riskNotes: input.queryKey ? "Query sumber lama hanya boleh dijalankan setelah berstatus SAFE_READ_ONLY dan READY_MONITORING." : "Belum ada query terhubung; indikator disimpan sebagai referensi.",
    recommendationTemplate: "Validasi query, parameter periode, dan hasil drill-down sebelum dipakai sebagai monitoring operasional.",
    skBasis: "",
    assumptionNotes: "Katalog monitoring dipakai sebagai referensi logika/menu, bukan disalin mentah-mentah.",
  } satisfies IndicatorCandidate;
}

async function auditPendukung2018() {
  const root = ALETA_SIPP_MONITORING_PATHS.pendukung2018;
  const exists = existsSync(/* turbopackIgnore: true */ root);
  if (!exists) {
    return {
      exists,
      root,
      filesScanned: 0,
      readableFiles: 0,
      menus: [] as Array<{ href: string; label: string }>,
      queryCandidates: [] as QueryCandidate[],
      indicatorCandidates: [] as IndicatorCandidate[],
      queryByFile: new Map<string, QueryCandidate[]>(),
      queryCounts: { total: 0, safeReadOnly: 0, needsReview: 0, rejectedWrite: 0, unsafe: 0 },
    };
  }
  const files = await walkFiles(root);
  const menus = new Map<string, string>();
  const queryCandidates: QueryCandidate[] = [];
  const indicatorCandidates: IndicatorCandidate[] = [];
  const queryByFile = new Map<string, QueryCandidate[]>();
  let readableFiles = 0;
  for (const file of files) {
    const extension = path.extname(file).toLowerCase();
    if (!READABLE_EXTENSIONS.has(extension)) continue;
    const fileStat = await stat(/* turbopackIgnore: true */ file).catch(() => null);
    if (!fileStat || fileStat.size > 1_800_000) continue;
    const text = await readFile(/* turbopackIgnore: true */ file, "utf8").catch(() => "");
    if (!text) continue;
    readableFiles += 1;
    for (const item of menuItemsFromText(text)) {
      menus.set(item.href, item.label);
    }
    const location = relativeSource(root, file);
    const snippets = extractSqlSnippets(text, 50).map((snippet) =>
      queryCandidateFromSql({
        sql: snippet.sql,
        title: snippet.title || path.basename(file),
        sourceType: "PENDUKUNG2018",
        sourceFile: root,
        sourceLocation: location,
        sourceLine: snippet.line,
      })
    );
    if (snippets.length > 0) {
      queryByFile.set(location, snippets);
      queryCandidates.push(...snippets);
    }
    const lower = `${location} ${text.slice(0, 5000)}`.toLowerCase();
    const relevant = KEYWORDS.some((keyword) => lower.includes(keyword));
    if (relevant && extension === ".php") {
      const primaryQuery = snippets[0];
      indicatorCandidates.push(
        indicatorFromFile({
          root,
          file,
          text,
          queryKey: primaryQuery?.queryKey ?? "",
          querySafetyStatus: primaryQuery?.securityStatus ?? "",
          tablesUsed: primaryQuery?.tablesUsed ?? [],
          columnsUsed: primaryQuery?.columnsUsed ?? [],
        })
      );
    }
  }
  const queryCounts = {
    total: queryCandidates.length,
    safeReadOnly: queryCandidates.filter((item) => item.securityStatus === "SAFE_READ_ONLY").length,
    needsReview: queryCandidates.filter((item) => item.securityStatus === "NEEDS_REVIEW").length,
    rejectedWrite: queryCandidates.filter((item) => item.securityStatus === "REJECTED_WRITE_QUERY").length,
    unsafe: queryCandidates.filter((item) => item.executionMode === "UNSAFE_RAW_SQL").length,
  };
  return {
    exists,
    root,
    filesScanned: files.length,
    readableFiles,
    menus: Array.from(menus.entries()).map(([href, label]) => ({ href, label })),
    queryCandidates,
    indicatorCandidates,
    queryByFile,
    queryCounts,
  };
}

async function ensureMonitoringSeeds(db: AletaDatabase) {
  const now = new Date().toISOString();
  const sources = [
    {
      sourceKey: "PENDUKUNG2018",
      sourceType: "PENDUKUNG2018",
      sourceName: "Katalog Monitoring SIPP",
      sourcePath: ALETA_SIPP_MONITORING_PATHS.pendukung2018,
      sourceVersion: "sumber-lama-lokal",
      status: existsSync(/* turbopackIgnore: true */ ALETA_SIPP_MONITORING_PATHS.pendukung2018) ? "ACTIVE" : "SOURCE_NOT_FOUND",
    },
    {
      sourceKey: "SK_PENILAIAN_SIPP_2024",
      sourceType: "SK_PENILAIAN_SIPP_2024",
      sourceName: "SK Penilaian SIPP 2024",
      sourcePath: ALETA_SIPP_MONITORING_PATHS.skPenilaianSipp2024,
      sourceVersion: "048/DJA/SK.KP3.4.3/IV/2024",
      status: existsSync(/* turbopackIgnore: true */ ALETA_SIPP_MONITORING_PATHS.skPenilaianSipp2024) ? "ACTIVE" : "NEEDS_SK_IMPORT",
    },
  ];
  for (const source of sources) {
    await db.run(
      `
      INSERT INTO aleta_sipp_monitoring_sources (
        id, source_key, source_type, source_name, source_path, source_version, status, summary_json, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, '{}'::jsonb, ?, ?)
      ON CONFLICT (source_key) DO UPDATE SET
        source_type = EXCLUDED.source_type,
        source_name = EXCLUDED.source_name,
        source_path = EXCLUDED.source_path,
        source_version = EXCLUDED.source_version,
        status = EXCLUDED.status,
        updated_at = EXCLUDED.updated_at
      `,
      [stableId("sipp_mon_src", source.sourceKey), source.sourceKey, source.sourceType, source.sourceName, source.sourcePath, source.sourceVersion, source.status, now, now]
    );
  }
  for (const [index, name] of MONITORING_CATEGORIES.entries()) {
    await db.run(
      `
      INSERT INTO aleta_sipp_monitoring_categories (
        id, category_key, category_name, description, sort_order, is_active, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, 1, ?, ?)
      ON CONFLICT (category_key) DO UPDATE SET
        category_name = EXCLUDED.category_name,
        description = EXCLUDED.description,
        sort_order = EXCLUDED.sort_order,
        updated_at = EXCLUDED.updated_at
      `,
      [stableId("sipp_mon_cat", name), slugKey(name).toUpperCase(), name, `Kategori monitoring ${name}.`, index + 1, now, now]
    );
  }
}

async function upsertQueryCandidate(db: AletaDatabase, actor: UserPersona, candidate: QueryCandidate) {
  const now = new Date().toISOString();
  const id = stableId("sipp_qry", candidate.queryKey);
  await db.run(
    `
    INSERT INTO aleta_sipp_query_registry (
      id, query_key, name, query_name, query_title, category, sub_category, source, business_purpose,
      source_type, source_file, source_location, source_line, short_description, long_description,
      tables_json, output_columns_json, original_sql, normalized_sql, parameterized_sql, sql_hash,
      columns_used_json, parameters_json, outputs_json, related_table_names_json,
      related_variable_codes_json, related_variable_keys_json, execution_mode, security_status,
      review_status, confidence_score, role_scope_json, ai_allowed, whatsapp_allowed, pdf_allowed,
      is_ai_usable, is_whatsapp_usable, is_pdf_usable, risk_notes_json, risk_notes, usage_notes,
      example_params, example_output, is_active, created_by, updated_by, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, '', ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?::jsonb, ?, ?, ?, ?, ?::jsonb, ?::jsonb, ?::jsonb,
      ?::jsonb, '[]'::jsonb, '[]'::jsonb, ?, ?, ?, ?, '[]'::jsonb, 0, 0, 0, 0, 0, 0, ?::jsonb, ?, ?, '{}'::jsonb, '{}'::jsonb, ?, ?, ?, ?, ?)
    ON CONFLICT (query_key) DO UPDATE SET
      source_type = EXCLUDED.source_type,
      source_file = EXCLUDED.source_file,
      source_location = EXCLUDED.source_location,
      source_line = EXCLUDED.source_line,
      original_sql = EXCLUDED.original_sql,
      normalized_sql = EXCLUDED.normalized_sql,
      parameterized_sql = EXCLUDED.parameterized_sql,
      sql_hash = EXCLUDED.sql_hash,
      tables_json = EXCLUDED.tables_json,
      output_columns_json = EXCLUDED.output_columns_json,
      columns_used_json = EXCLUDED.columns_used_json,
      parameters_json = EXCLUDED.parameters_json,
      outputs_json = EXCLUDED.outputs_json,
      related_table_names_json = EXCLUDED.related_table_names_json,
      execution_mode = CASE
        WHEN aleta_sipp_query_registry.review_status IN ('ADMIN_REVIEWED', 'AUTO_REVIEWED') THEN aleta_sipp_query_registry.execution_mode
        ELSE EXCLUDED.execution_mode
      END,
      security_status = CASE
        WHEN aleta_sipp_query_registry.review_status IN ('ADMIN_REVIEWED', 'AUTO_REVIEWED') THEN aleta_sipp_query_registry.security_status
        ELSE EXCLUDED.security_status
      END,
      review_status = CASE WHEN aleta_sipp_query_registry.review_status IN ('ADMIN_REVIEWED', 'AUTO_REVIEWED') THEN aleta_sipp_query_registry.review_status ELSE EXCLUDED.review_status END,
      confidence_score = EXCLUDED.confidence_score,
      risk_notes_json = EXCLUDED.risk_notes_json,
      risk_notes = EXCLUDED.risk_notes,
      usage_notes = EXCLUDED.usage_notes,
      is_active = CASE
        WHEN aleta_sipp_query_registry.review_status IN ('ADMIN_REVIEWED', 'AUTO_REVIEWED') THEN aleta_sipp_query_registry.is_active
        ELSE EXCLUDED.is_active
      END,
      updated_by = EXCLUDED.updated_by,
      updated_at = EXCLUDED.updated_at
    `,
    [
      id,
      candidate.queryKey,
      candidate.queryName,
      candidate.queryName,
      candidate.queryName,
      candidate.category,
      candidate.sourceType,
      `Referensi query ${candidate.sourceType} untuk monitoring/evaluasi SIPP.`,
      candidate.sourceType,
      candidate.sourceFile,
      candidate.sourceLocation,
      candidate.sourceLine,
      `Kandidat query dari ${candidate.sourceType}: ${candidate.queryName}.`,
      `Query ini diinventarisasi dari ${candidate.sourceType}. Query tidak dieksekusi sampai lolos status SAFE_READ_ONLY dan mode eksekusi monitoring/assessment.`,
      jsonString(candidate.tablesUsed),
      jsonString(candidate.columnsUsed),
      candidate.originalSql,
      candidate.normalizedSql,
      candidate.parameterizedSql,
      sqlHash(candidate.normalizedSql),
      jsonString(candidate.columnsUsed),
      jsonString(candidate.parameters),
      jsonString(candidate.outputs),
      jsonString(candidate.tablesUsed),
      candidate.executionMode,
      candidate.securityStatus,
      candidate.reviewStatus,
      candidate.confidenceScore,
      jsonString([candidate.riskNotes]),
      candidate.riskNotes,
      "Dipakai sebagai referensi indikator monitoring/evaluasi; tidak ada raw SQL bebas dari client.",
      candidate.securityStatus === "REJECTED_WRITE_QUERY" || candidate.securityStatus === "UNSAFE_RAW_SQL" ? 0 : 1,
      actor.id,
      actor.id,
      now,
      now,
    ]
  );
  await db.run("DELETE FROM aleta_sipp_query_table_links WHERE query_key = ?", [candidate.queryKey]);
  for (const table of candidate.tablesUsed) {
    await db.run(
      `
      INSERT INTO aleta_sipp_query_table_links (
        id, query_id, query_key, table_name, column_names_json, relation_role, confidence_score, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?::jsonb, 'monitoring_reference', ?, ?, ?)
      ON CONFLICT (query_key, table_name) DO UPDATE SET
        column_names_json = EXCLUDED.column_names_json,
        confidence_score = EXCLUDED.confidence_score,
        updated_at = EXCLUDED.updated_at
      `,
      [stableId("sipp_qtl", candidate.queryKey, table), id, candidate.queryKey, table, jsonString(candidate.columnsUsed), candidate.confidenceScore, now, now]
    );
  }
  return id;
}

async function upsertIndicator(db: AletaDatabase, actor: UserPersona, candidate: IndicatorCandidate) {
  const now = new Date().toISOString();
  const query = candidate.queryKey
    ? await db.queryOne<{ id: string }>("SELECT id FROM aleta_sipp_query_registry WHERE query_key = ? LIMIT 1", [candidate.queryKey])
    : null;
  await db.run(
    `
    INSERT INTO aleta_sipp_monitoring_indicators (
      id, indicator_key, indicator_code, indicator_name, short_description, long_description,
      source_type, source_file, source_location, category, sub_category, period_type, formula_text,
      formula_json, weight, max_score, threshold_green, threshold_yellow, threshold_red, query_key, query_id,
      tables_used, columns_used, data_scope, result_type, calculation_mode, safety_status, review_status,
      confidence_score, risk_notes, recommendation_template, sk_basis, assumption_notes, is_active,
      created_by, updated_by, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?::jsonb, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
    ON CONFLICT (indicator_key) DO UPDATE SET
      indicator_code = EXCLUDED.indicator_code,
      indicator_name = EXCLUDED.indicator_name,
      short_description = EXCLUDED.short_description,
      long_description = EXCLUDED.long_description,
      source_type = EXCLUDED.source_type,
      source_file = EXCLUDED.source_file,
      source_location = EXCLUDED.source_location,
      category = EXCLUDED.category,
      sub_category = EXCLUDED.sub_category,
      period_type = EXCLUDED.period_type,
      formula_text = CASE
        WHEN aleta_sipp_monitoring_indicators.review_status IN ('ADMIN_REVIEWED', 'AUTO_REVIEWED') THEN aleta_sipp_monitoring_indicators.formula_text
        ELSE EXCLUDED.formula_text
      END,
      formula_json = CASE
        WHEN aleta_sipp_monitoring_indicators.review_status IN ('ADMIN_REVIEWED', 'AUTO_REVIEWED') THEN aleta_sipp_monitoring_indicators.formula_json
        ELSE EXCLUDED.formula_json
      END,
      weight = CASE
        WHEN aleta_sipp_monitoring_indicators.review_status IN ('ADMIN_REVIEWED', 'AUTO_REVIEWED') THEN aleta_sipp_monitoring_indicators.weight
        ELSE EXCLUDED.weight
      END,
      max_score = CASE
        WHEN aleta_sipp_monitoring_indicators.review_status IN ('ADMIN_REVIEWED', 'AUTO_REVIEWED') THEN aleta_sipp_monitoring_indicators.max_score
        ELSE EXCLUDED.max_score
      END,
      threshold_green = CASE
        WHEN aleta_sipp_monitoring_indicators.review_status IN ('ADMIN_REVIEWED', 'AUTO_REVIEWED') THEN aleta_sipp_monitoring_indicators.threshold_green
        ELSE EXCLUDED.threshold_green
      END,
      threshold_yellow = CASE
        WHEN aleta_sipp_monitoring_indicators.review_status IN ('ADMIN_REVIEWED', 'AUTO_REVIEWED') THEN aleta_sipp_monitoring_indicators.threshold_yellow
        ELSE EXCLUDED.threshold_yellow
      END,
      threshold_red = CASE
        WHEN aleta_sipp_monitoring_indicators.review_status IN ('ADMIN_REVIEWED', 'AUTO_REVIEWED') THEN aleta_sipp_monitoring_indicators.threshold_red
        ELSE EXCLUDED.threshold_red
      END,
      query_key = EXCLUDED.query_key,
      query_id = EXCLUDED.query_id,
      tables_used = EXCLUDED.tables_used,
      columns_used = EXCLUDED.columns_used,
      data_scope = EXCLUDED.data_scope,
      result_type = EXCLUDED.result_type,
      calculation_mode = EXCLUDED.calculation_mode,
      safety_status = CASE
        WHEN aleta_sipp_monitoring_indicators.review_status IN ('ADMIN_REVIEWED', 'AUTO_REVIEWED') THEN aleta_sipp_monitoring_indicators.safety_status
        ELSE EXCLUDED.safety_status
      END,
      review_status = CASE WHEN aleta_sipp_monitoring_indicators.review_status IN ('ADMIN_REVIEWED', 'AUTO_REVIEWED') THEN aleta_sipp_monitoring_indicators.review_status ELSE EXCLUDED.review_status END,
      confidence_score = EXCLUDED.confidence_score,
      risk_notes = EXCLUDED.risk_notes,
      recommendation_template = EXCLUDED.recommendation_template,
      sk_basis = EXCLUDED.sk_basis,
      assumption_notes = EXCLUDED.assumption_notes,
      updated_by = EXCLUDED.updated_by,
      updated_at = EXCLUDED.updated_at
    `,
    [
      stableId("sipp_mon_ind", candidate.indicatorKey),
      candidate.indicatorKey,
      candidate.indicatorCode,
      candidate.indicatorName,
      candidate.shortDescription,
      candidate.longDescription,
      candidate.sourceType,
      candidate.sourceFile,
      candidate.sourceLocation,
      candidate.category,
      candidate.subCategory,
      candidate.periodType,
      candidate.formulaText,
      jsonString(candidate.formulaJson),
      candidate.weight,
      candidate.maxScore,
      candidate.thresholdGreen,
      candidate.thresholdYellow,
      candidate.thresholdRed,
      candidate.queryKey,
      query?.id ?? null,
      jsonString(candidate.tablesUsed),
      jsonString(candidate.columnsUsed),
      candidate.dataScope,
      candidate.resultType,
      candidate.calculationMode,
      candidate.safetyStatus,
      candidate.reviewStatus,
      candidate.confidenceScore,
      candidate.riskNotes,
      candidate.recommendationTemplate,
      candidate.skBasis,
      candidate.assumptionNotes,
      actor.id,
      actor.id,
      now,
      now,
    ]
  );
}

async function createMonitoringJob(db: AletaDatabase, actor: UserPersona, jobType: string, sourcePath: string) {
  const now = new Date().toISOString();
  const jobKey = `${jobType}_${Date.now()}`;
  const id = await nextPrefixedId(db, "aleta_sipp_monitoring_jobs", "sipp-mon-job");
  await db.run(
    `
    INSERT INTO aleta_sipp_monitoring_jobs (
      id, job_key, job_type, source_path, status, total_items, success_count, failed_count,
      warning_count, summary_json, error_message, started_at, finished_at, created_by, created_at
    )
    VALUES (?, ?, ?, ?, 'RUNNING', 0, 0, 0, 0, '{}'::jsonb, NULL, ?, NULL, ?, ?)
    `,
    [id, jobKey, jobType, sourcePath, now, actor.id, now]
  );
  return { id, jobKey, startedAt: now };
}

async function finishMonitoringJob(
  db: AletaDatabase,
  jobId: string,
  summary: Record<string, unknown>,
  options: { status?: string; errorMessage?: string | null } = {}
) {
  const total = Number(summary.totalItems ?? summary.total ?? 0);
  const success = Number(summary.successCount ?? summary.importedIndicators ?? summary.imported ?? 0);
  const failed = Number(summary.failedCount ?? summary.failed ?? 0);
  const warning = Number(summary.warningCount ?? summary.warnings ?? 0);
  const status = options.status ?? (failed > 0 ? "COMPLETED_WITH_WARNINGS" : "SUCCESS");
  const finishedAt = new Date().toISOString();
  await db.run(
    `
    UPDATE aleta_sipp_monitoring_jobs
    SET status = ?, total_items = ?, success_count = ?, failed_count = ?, warning_count = ?,
      summary_json = ?::jsonb, error_message = ?, finished_at = ?
    WHERE id = ?
    `,
    [status, total, success, failed, warning, jsonString(summary), options.errorMessage ?? null, finishedAt, jobId]
  );
  return finishedAt;
}

async function updateMonitoringSourceAfterImport(
  db: AletaDatabase,
  sourceKey: string,
  jobId: string,
  summary: Record<string, unknown>
) {
  await db.run(
    `
    UPDATE aleta_sipp_monitoring_sources
    SET summary_json = ?::jsonb, last_import_job_id = ?, last_imported_at = ?, updated_at = ?
    WHERE source_key = ?
    `,
    [jsonString(summary), jobId, new Date().toISOString(), new Date().toISOString(), sourceKey]
  );
}

function featureTemplateStatus(feature: Pick<Pendukung2018FeatureCatalogRow, "feature_name" | "group_key" | "result_type" | "no_query_reason">) {
  const name = `${feature.feature_name} ${feature.no_query_reason}`.toLowerCase();
  if (feature.group_key === "LAPORAN" || feature.result_type === "EXPORT_REFERENCE") return "REPORT_TEMPLATE_REQUIRED";
  if (name.includes("delegasi") || name.includes("register") || name.includes("sapm") || name.includes("dokumen")) return "SCHEMA_MAPPING_REQUIRED";
  return "SCHEMA_MAPPING_REQUIRED";
}

function runtimeOperationalStatusForFeature(feature: Pick<Pendukung2018FeatureCatalogRow, "implementation_status" | "safety_status" | "feature_code" | "feature_name" | "group_key" | "result_type" | "no_query_reason" | "requires_manual_input" | "external_dependency">) {
  if (feature.implementation_status === "REFERENCE_ONLY") return featureTemplateStatus(feature);
  if (feature.implementation_status === "LEGACY_WRITE_REFERENCE_ONLY" || feature.requires_manual_input || feature.safety_status === "PERLU_INPUT_MANUAL") return "MANUAL_INPUT_READY";
  if (feature.implementation_status === "EXTERNAL_CONNECTOR_REQUIRED" || feature.safety_status === "EXTERNAL_CONNECTOR_REQUIRED" || feature.external_dependency) return "EXTERNAL_CONNECTOR_WAITING_CONFIG";
  return feature.implementation_status;
}

function runtimeSafetyStatusForFeature(feature: Pick<Pendukung2018FeatureCatalogRow, "safety_status" | "implementation_status" | "feature_code" | "feature_name" | "group_key" | "result_type" | "no_query_reason" | "requires_manual_input" | "external_dependency">) {
  if (feature.safety_status === "REFERENCE_ONLY" || feature.safety_status === "PERLU_INPUT_MANUAL" || feature.safety_status === "EXTERNAL_CONNECTOR_REQUIRED") {
    return runtimeOperationalStatusForFeature(feature);
  }
  return feature.safety_status;
}

function subFeaturesForFeature(feature: Pick<Pendukung2018FeatureCatalogRow, "feature_code" | "feature_key" | "feature_name">) {
  if (feature.feature_code === "P2018-060" || /lipa\s*1-?17/i.test(feature.feature_name)) {
    return Array.from({ length: 17 }, (_, index) => {
      const number = index + 1;
      const isReadyExport = number === 7;
      return {
        key: `${feature.feature_key}_LIPA_${number}`,
        label: `LIPA ${number}`,
        status: isReadyExport ? "READY_WITH_DATASOURCE" : "REPORT_TEMPLATE_REQUIRED",
        reason: isReadyExport
          ? "LIPA 7 memakai agregasi Keuangan Perkara dan siap dijalankan setelah datasource SIPP read-only aktif."
          : "Kerangka laporan tersedia; template/export rinci perlu dikonfigurasi sebelum operasional penuh.",
        actions: isReadyExport ? ["Dry-run", "Export", "Lihat hasil terakhir"] : ["Konfigurasi template", "Lihat alasan"],
      };
    });
  }
  if (feature.feature_code === "P2018-065" || /delegasi|register|sapm|dokumen/i.test(feature.feature_name)) {
    return ["Delegasi", "Register", "SAPM", "Dokumen"].map((label) => ({
      key: `${feature.feature_key}_${label.toUpperCase()}`,
      label,
      status: "SCHEMA_MAPPING_REQUIRED",
      reason: "Subfitur aktif sebagai modul awal dan menunggu pemetaan tabel/kolom read-only yang sesuai.",
      actions: ["Pemetaan schema", "Lihat alasan"],
    }));
  }
  return [];
}

function operationalReasonForStatus(status: string) {
  switch (status) {
    case "READY_OPERATIONAL":
      return "Query aman dan datasource read-only tersedia untuk dijalankan.";
    case "READY_WITH_DATASOURCE":
      return "Siap dijalankan setelah datasource SIPP read-only aktif.";
    case "READY_WITH_AUTO_REVIEWED_QUERY":
      return "Query lolos auto-review dan siap masuk run monitoring.";
    case "MANUAL_INPUT_READY":
      return "Fitur memakai input manual terverifikasi di ALETA.";
    case "EXTERNAL_CONNECTOR_WAITING_CONFIG":
      return "Fitur menunggu konfigurasi konektor eksternal read-only.";
    case "REPORT_TEMPLATE_REQUIRED":
      return "Fitur membutuhkan template/format laporan sebelum export penuh.";
    case "SCHEMA_MAPPING_REQUIRED":
      return "Fitur membutuhkan pemetaan tabel/kolom pada Kamus Database SIPP.";
    case "FORMULA_CONFIGURATION_REQUIRED":
      return "Fitur membutuhkan konfigurasi rumus sebelum dihitung otomatis.";
    case "UNSAFE_LEGACY_QUERY_REJECTED":
      return "Query legacy mengandung operasi tidak aman dan ditolak.";
    case "MISSING_PERIOD_FILTER":
      return "Query belum memiliki filter/parameter periode yang dibutuhkan.";
    default:
      return status ? humanize(status) : "Status belum tersedia.";
  }
}

function availableActionsForFeature(feature: {
  implementation_status: string;
  safety_status: string;
  related_query_key: string;
  related_indicator_key: string;
  latest_result_id?: string | null;
  requires_manual_input: number;
  external_dependency: string;
  group_key: string;
}) {
  const actions = ["Lihat alasan"];
  if (feature.related_indicator_key) actions.push("Dry-run", "Jalankan");
  if (feature.related_query_key) actions.push("Perbaiki otomatis query");
  if (feature.latest_result_id) actions.push("Lihat hasil terakhir", "Lihat temuan");
  if (feature.requires_manual_input || feature.safety_status === "MANUAL_INPUT_REQUIRED" || feature.safety_status === "PERLU_INPUT_MANUAL") actions.push("Input manual");
  if (feature.external_dependency || feature.safety_status === "EXTERNAL_CONNECTOR_REQUIRED") actions.push("Konfigurasi konektor");
  if (feature.group_key === "LAPORAN" || feature.implementation_status.includes("REPORT_TEMPLATE")) actions.push("Export");
  return Array.from(new Set(actions));
}

async function schemaReviewForAutoReview(
  db: AletaDatabase,
  feature: Pick<Pendukung2018FeatureCatalogRow, "period_type" | "tables_used_json" | "columns_used_json">,
  query: Pick<MonitoringAutoReviewRow, "query_tables_json" | "query_columns_json">,
  validation: AletaSippReadOnlySqlValidation
) {
  if (!validation.ok) {
    return { ok: false, status: validation.status, reason: validation.reason };
  }
  const candidateTables = Array.from(new Set([...asArray(feature.tables_used_json), ...asArray(query.query_tables_json)].map(String).filter(Boolean)));
  const dictionaryCount = await readCount(db, "SELECT COUNT(*) AS count FROM aleta_sipp_tables WHERE is_active = 1");
  if (dictionaryCount > 0 && candidateTables.length > 0) {
    const rows = await db.queryAll<{ table_name: string }>(
      `SELECT table_name FROM aleta_sipp_tables WHERE table_name IN (${candidateTables.map(() => "?").join(", ")}) AND is_active = 1`,
      candidateTables
    );
    const known = new Set(rows.map((row) => row.table_name.toLowerCase()));
    const unknown = candidateTables.filter((name) => !known.has(name.toLowerCase()));
    if (unknown.length > 0) {
      return {
        ok: false,
        status: "SCHEMA_MAPPING_REQUIRED",
        reason: `Tabel belum ditemukan di Kamus Database SIPP: ${unknown.join(", ")}.`,
      };
    }
  }
  if (feature.period_type !== "ON_DEMAND" && !validation.usesPeriodParameter) {
    return {
      ok: false,
      status: "MISSING_PERIOD_FILTER",
      reason: "Query monitoring berbasis periode belum memiliki parameter/filter periode.",
    };
  }
  return { ok: true, status: "SAFE_READ_ONLY", reason: validation.reason };
}

async function ensureExternalConnectorPlaceholder(
  db: AletaDatabase,
  actor: UserPersona,
  feature: Pick<Pendukung2018FeatureCatalogRow, "feature_key" | "feature_name" | "external_dependency" | "group_name">
) {
  const now = new Date().toISOString();
  const sourceKey = `EXTERNAL_${feature.feature_key}`.replace(/[^A-Z0-9_]/gi, "_").toUpperCase();
  await db.run(
    `
    INSERT INTO aleta_sipp_monitoring_sources (
      id, source_key, source_type, source_name, source_path, source_version, status,
      summary_json, created_at, updated_at
    )
    VALUES (?, ?, 'EXTERNAL_CONNECTOR', ?, '', 'read_only_config', 'MENUNGGU_KONFIGURASI', ?::jsonb, ?, ?)
    ON CONFLICT (source_key) DO UPDATE SET
      source_name = EXCLUDED.source_name,
      source_type = EXCLUDED.source_type,
      source_version = EXCLUDED.source_version,
      summary_json = CASE
        WHEN aleta_sipp_monitoring_sources.status IN ('TERKONFIGURASI', 'SIAP_READ_ONLY', 'GAGAL_KONEKSI') THEN aleta_sipp_monitoring_sources.summary_json
        ELSE EXCLUDED.summary_json
      END,
      updated_at = EXCLUDED.updated_at
    `,
    [
      stableId("sipp_external_connector", sourceKey),
      sourceKey,
      feature.feature_name,
      jsonString({
        featureKey: feature.feature_key,
        connectorName: feature.external_dependency || feature.feature_name,
        groupName: feature.group_name,
        mode: "READ_ONLY",
        credentialReference: "",
        secretVisible: false,
        lastCheckedAt: null,
        configuredBy: actor.id,
      }),
      now,
      now,
    ]
  );
}

async function applyAutoReviewOutcome(
  db: AletaDatabase,
  actor: UserPersona,
  row: MonitoringAutoReviewRow,
  outcome: AutoReviewFeatureOutcome,
  validation?: AletaSippReadOnlySqlValidation
) {
  const now = new Date().toISOString();
  const adminNotes = normalizeWhitespace([row.admin_notes, `Auto-review ${outcome.reasonCode}: ${outcome.reason}`].filter(Boolean).join(" | "), 1600);
  await db.run(
    `
    UPDATE aleta_sipp_legacy_feature_catalog
    SET implementation_status = ?, safety_status = ?, review_status = ?, admin_notes = ?, updated_by = ?, updated_at = ?
    WHERE id = ?
    `,
    [outcome.implementationStatus, outcome.safetyStatus, outcome.reviewStatus, adminNotes, actor.id, now, row.id]
  );

  if (row.query_id) {
    const querySecurity = outcome.promoted ? "SAFE_READ_ONLY" : outcome.reasonCode;
    const queryExecution = outcome.promoted ? "READY_MONITORING" : "REFERENCE_ONLY";
    const riskNotes = normalizeWhitespace([row.query_risk_notes ?? "", `Auto-review ${outcome.reasonCode}: ${outcome.reason}`].filter(Boolean).join(" | "), 1600);
    await db.run(
      `
      UPDATE aleta_sipp_query_registry
      SET security_status = ?, execution_mode = ?, review_status = ?, risk_notes = ?,
        normalized_sql = COALESCE(?, normalized_sql),
        parameterized_sql = COALESCE(?, parameterized_sql),
        confidence_score = CASE WHEN ? THEN GREATEST(confidence_score, 88) ELSE confidence_score END,
        updated_by = ?, updated_at = ?
      WHERE id = ?
      `,
      [
        querySecurity,
        queryExecution,
        outcome.reviewStatus,
        riskNotes,
        validation?.normalizedSql ?? null,
        validation?.statementSql ? parameterizeSql(validation.statementSql) : null,
        outcome.promoted,
        actor.id,
        now,
        row.query_id,
      ]
    );
  }

  if (row.related_indicator_key) {
    const indicatorSafety = outcome.promoted
      ? "READY_MONITORING"
      : outcome.safetyStatus === "MANUAL_INPUT_REQUIRED" ? "PERLU_INPUT_MANUAL"
        : outcome.safetyStatus;
    await db.run(
      `
      UPDATE aleta_sipp_monitoring_indicators
      SET safety_status = ?, review_status = ?, risk_notes = ?, updated_by = ?, updated_at = ?
      WHERE indicator_key = ?
      `,
      [indicatorSafety, outcome.reviewStatus, outcome.reason, actor.id, now, row.related_indicator_key]
    );
  }

  if (outcome.implementationStatus === "EXTERNAL_CONNECTOR_WAITING_CONFIG") {
    await ensureExternalConnectorPlaceholder(db, actor, row);
  }
}

function autoReviewOutcomeForNonQuery(row: MonitoringAutoReviewRow): AutoReviewFeatureOutcome {
  if (row.requires_manual_input || row.safety_status === "PERLU_INPUT_MANUAL" || row.implementation_status === "LEGACY_WRITE_REFERENCE_ONLY") {
    return {
      featureKey: row.feature_key,
      featureName: row.feature_name,
      queryKey: row.related_query_key,
      status: "MANUAL_INPUT_READY",
      implementationStatus: "MANUAL_INPUT_READY",
      safetyStatus: "MANUAL_INPUT_REQUIRED",
      reviewStatus: "AUTO_REVIEWED",
      reasonCode: "NEEDS_MANUAL_INPUT",
      reason: "Fitur legacy membutuhkan nilai manual/cache ALETA; input manual dan approval dipakai sebagai jalur operasional.",
      promoted: false,
    };
  }
  if (row.external_dependency || row.safety_status === "EXTERNAL_CONNECTOR_REQUIRED" || row.implementation_status === "EXTERNAL_CONNECTOR_REQUIRED") {
    return {
      featureKey: row.feature_key,
      featureName: row.feature_name,
      queryKey: row.related_query_key,
      status: "EXTERNAL_CONNECTOR_WAITING_CONFIG",
      implementationStatus: "EXTERNAL_CONNECTOR_WAITING_CONFIG",
      safetyStatus: "EXTERNAL_CONNECTOR_REQUIRED",
      reviewStatus: "AUTO_REVIEWED",
      reasonCode: "NEEDS_EXTERNAL_CONNECTOR",
      reason: "Fitur membutuhkan konektor eksternal read-only yang harus dikonfigurasi admin.",
      promoted: false,
    };
  }
  const templateStatus = featureTemplateStatus(row);
  return {
    featureKey: row.feature_key,
    featureName: row.feature_name,
    queryKey: row.related_query_key,
    status: templateStatus,
    implementationStatus: templateStatus,
    safetyStatus: templateStatus,
    reviewStatus: "AUTO_REVIEWED",
    reasonCode: templateStatus,
    reason: operationalReasonForStatus(templateStatus),
    promoted: false,
  };
}

async function autoReviewMonitoringQueries(
  db: AletaDatabase,
  actor: UserPersona,
  input: { featureKeys?: string[]; includeReviewed?: boolean } = {}
) {
  requireAnyPermission(
    actor,
    [ALETA_SIPP_PERMISSION.REVIEW_MONITORING_QUERY, ALETA_SIPP_PERMISSION.MANAGE_MONITORING_FEATURES, ALETA_SIPP_PERMISSION.MANAGE_QUERY_REGISTRY],
    "Anda tidak memiliki izin menjalankan auto-review query monitoring."
  );
  await ensurePendukung2018FeatureCatalog(db, actor);
  const datasource = getAletaSippDataSourceStatus();
  const where = ["f.source_type = 'PENDUKUNG2018'", "f.is_active = 1"];
  const params: SqlInputValue[] = [];
  const featureKeys = Array.from(new Set(input.featureKeys?.map((item) => item.trim()).filter(Boolean) ?? []));
  if (featureKeys.length > 0) {
    where.push(`f.feature_key IN (${featureKeys.map(() => "?").join(", ")})`);
    params.push(...featureKeys);
  }
  if (!input.includeReviewed) {
    where.push("(f.review_status NOT IN ('AUTO_REVIEWED', 'ADMIN_REVIEWED') OR f.implementation_status IN ('READY_READ_ONLY', 'PARTIAL_READ_ONLY', 'QUERY_NEEDS_REVIEW', 'REFERENCE_ONLY', 'LEGACY_WRITE_REFERENCE_ONLY', 'EXTERNAL_CONNECTOR_REQUIRED'))");
  }
  const rows = await db.queryAll<MonitoringAutoReviewRow>(
    `
    SELECT f.*,
      q.id AS query_id,
      q.original_sql AS query_original_sql,
      q.normalized_sql AS query_normalized_sql,
      q.parameterized_sql AS query_parameterized_sql,
      q.related_table_names_json AS query_tables_json,
      q.columns_used_json AS query_columns_json,
      q.security_status AS query_security_status,
      q.execution_mode AS query_execution_mode,
      q.review_status AS query_review_status,
      q.risk_notes AS query_risk_notes
    FROM aleta_sipp_legacy_feature_catalog f
    LEFT JOIN aleta_sipp_query_registry q ON q.query_key = f.related_query_key AND q.is_active = 1
    WHERE ${where.join(" AND ")}
    ORDER BY f.sort_order
    `,
    params
  );
  const outcomes: AutoReviewFeatureOutcome[] = [];
  for (const row of rows) {
    const querySql = String(row.query_original_sql || row.query_normalized_sql || row.query_parameterized_sql || "");
    if (!row.related_query_key || !querySql.trim()) {
      const outcome = autoReviewOutcomeForNonQuery(row);
      await applyAutoReviewOutcome(db, actor, row, outcome);
      outcomes.push(outcome);
      continue;
    }
    const validation = validateReadOnlySql(querySql, { requirePeriodParameter: row.period_type !== "ON_DEMAND" });
    const schema = await schemaReviewForAutoReview(db, row, row, validation);
    if (!validation.ok || !schema.ok) {
      const status = schema.status === "UNSAFE_KEYWORD" ? "UNSAFE_LEGACY_QUERY_REJECTED" : schema.status;
      const outcome = {
        featureKey: row.feature_key,
        featureName: row.feature_name,
        queryKey: row.related_query_key,
        status,
        implementationStatus: status,
        safetyStatus: status,
        reviewStatus: "AUTO_REVIEWED",
        reasonCode: schema.status,
        reason: schema.reason,
        promoted: false,
      } satisfies AutoReviewFeatureOutcome;
      await applyAutoReviewOutcome(db, actor, row, outcome, validation);
      outcomes.push(outcome);
      continue;
    }
    const readyStatus = datasource.capabilities.runRegisteredQuery ? "READY_OPERATIONAL" : "READY_WITH_DATASOURCE";
    const outcome = {
      featureKey: row.feature_key,
      featureName: row.feature_name,
      queryKey: row.related_query_key,
      status: readyStatus,
      implementationStatus: readyStatus,
      safetyStatus: "READY_WITH_AUTO_REVIEWED_QUERY",
      reviewStatus: "AUTO_REVIEWED",
      reasonCode: "SAFE_READ_ONLY",
      reason: operationalReasonForStatus(readyStatus),
      promoted: true,
    } satisfies AutoReviewFeatureOutcome;
    await applyAutoReviewOutcome(db, actor, row, outcome, validation);
    outcomes.push(outcome);
  }
  const summary = {
    totalItems: outcomes.length,
    successCount: outcomes.filter((item) => item.promoted).length,
    failedCount: outcomes.filter((item) => item.reasonCode === "UNSAFE_KEYWORD" || item.implementationStatus === "UNSAFE_LEGACY_QUERY_REJECTED").length,
    warningCount: outcomes.filter((item) => !item.promoted).length,
    datasourceReady: datasource.capabilities.runRegisteredQuery,
    statusCounts: outcomes.reduce<Record<string, number>>((acc, item) => {
      acc[item.implementationStatus] = (acc[item.implementationStatus] ?? 0) + 1;
      return acc;
    }, {}),
  };
  await appendAuditLog(db, {
    id: await nextPrefixedId(db, "audit_logs", "adt"),
    actorUserId: actor.id,
    action: "aleta_sipp.monitoring.auto_review_queries",
    entityType: "aleta_sipp_legacy_feature_catalog",
    entityId: featureKeys.join(",") || "ALL",
    payload: summary,
  });
  return { ...summary, rows: outcomes };
}

function featureQueryToCandidate(feature: Pendukung2018FeatureDefinition): QueryCandidate | null {
  if (!feature.query) return null;
  const normalizedSql = normalizeSql(feature.query.sql);
  const columns = feature.query.columns.length ? feature.query.columns : extractColumns(normalizedSql);
  return {
    queryKey: feature.query.queryKey,
    queryName: feature.query.queryName,
    category: feature.groupName,
    sourceType: "PENDUKUNG2018",
    sourceFile: ALETA_SIPP_MONITORING_PATHS.pendukung2018,
    sourceLocation: feature.sourceFiles.join(", "),
    sourceLine: null,
    originalSql: feature.query.sql,
    normalizedSql,
    parameterizedSql: parameterizeSql(normalizedSql),
    tablesUsed: feature.query.tables,
    columnsUsed: columns,
    parameters: feature.query.parameters,
    outputs: columns.map((name) => ({ name, label: humanize(name), dataType: "text" })),
    securityStatus: feature.query.securityStatus,
    executionMode: feature.query.executionMode,
    reviewStatus: feature.query.reviewStatus,
    confidenceScore: feature.query.confidenceScore,
    riskNotes: feature.query.riskNotes,
  };
}

function featureSafetyStatusForIndicator(feature: Pendukung2018FeatureDefinition) {
  if (feature.safetyStatus === "PERLU_INPUT_MANUAL" || feature.implementationStatus === "MANUAL_INPUT_REQUIRED" || feature.implementationStatus === "LEGACY_WRITE_REFERENCE_ONLY") return "PERLU_INPUT_MANUAL";
  if (feature.safetyStatus === "EXTERNAL_CONNECTOR_REQUIRED") return "EXTERNAL_CONNECTOR_REQUIRED";
  if (feature.safetyStatus === "REFERENCE_ONLY") return "DEPRECATED_REFERENCE_ONLY";
  if (feature.query?.securityStatus === "SAFE_READ_ONLY") return "READY_MONITORING";
  if (feature.query) return "QUERY_NOT_READY";
  return "DATA_TIDAK_CUKUP";
}

function featureToIndicatorCandidate(feature: Pendukung2018FeatureDefinition): IndicatorCandidate {
  const safetyStatus = featureSafetyStatusForIndicator(feature);
  const queryReady = safetyStatus === "READY_MONITORING";
  return {
    indicatorKey: feature.relatedIndicatorKey,
    indicatorCode: feature.featureCode,
    indicatorName: feature.featureName,
    shortDescription: `Katalog Monitoring SIPP: ${feature.featureName}.`,
    longDescription: normalizeWhitespace(`${feature.groupName}. Evidence: ${feature.sourceEvidence.join(" ")} ${feature.noQueryReason}`, 1000),
    sourceType: "PENDUKUNG2018",
    sourceFile: ALETA_SIPP_MONITORING_PATHS.pendukung2018,
    sourceLocation: feature.sourceFiles.join(", "),
    category: feature.groupName,
    subCategory: feature.groupKey,
    periodType: feature.periodType,
    formulaText: feature.query ? "Query registry read-only membentuk data laporan/temuan. Scoring otomatis memakai percent/numerator/denominator bila tersedia." : feature.noQueryReason,
    formulaJson: {
      featureKey: feature.featureKey,
      featureCode: feature.featureCode,
      groupKey: feature.groupKey,
      implementationStatus: feature.implementationStatus,
      migrationStatus: feature.migrationStatus,
      sourceEvidence: feature.sourceEvidence,
      noQueryReason: feature.noQueryReason,
    },
    weight: 0,
    maxScore: 100,
    thresholdGreen: 90,
    thresholdYellow: 60,
    thresholdRed: 60,
    queryKey: feature.relatedQueryKey,
    tablesUsed: feature.tablesUsed,
    columnsUsed: feature.columnsUsed,
    dataScope: feature.externalDependency || "DATABASE_SIPP_ALETA_BOT_READ_ONLY",
    resultType: feature.resultType,
    calculationMode: feature.calculationMode,
    safetyStatus,
    reviewStatus: queryReady ? "AUTO_IMPORTED" : "NEEDS_ADMIN_REVIEW",
    confidenceScore: feature.query?.confidenceScore ?? (feature.requiresManualInput ? 45 : 35),
    riskNotes: feature.riskNotes,
    recommendationTemplate: feature.recommendationTemplate,
    skBasis: "",
    assumptionNotes: "Katalog monitoring dipakai sebagai referensi logika SIPP; operasi write ditolak dan diganti metadata, cache, atau input manual terverifikasi di ALETA.",
  };
}

function mapPendukung2018FeatureRow(row: Pendukung2018FeatureCatalogRow) {
  const operationalStatus = runtimeOperationalStatusForFeature(row);
  const safetyStatus = runtimeSafetyStatusForFeature(row);
  const runtimeRow = { ...row, implementation_status: operationalStatus, safety_status: safetyStatus };
  return {
    id: row.id,
    featureKey: row.feature_key,
    featureCode: row.feature_code,
    featureName: row.feature_name,
    groupKey: row.group_key,
    groupName: row.group_name,
    sortOrder: Number(row.sort_order ?? 0),
    sourceType: row.source_type,
    sourceFiles: asArray(row.source_files_json).map(String),
    sourceEvidence: asArray(row.source_evidence_json).map(String),
    implementationStatus: row.implementation_status,
    migrationStatus: row.migration_status,
    safetyStatus,
    reviewStatus: row.review_status,
    relatedQueryKey: row.related_query_key,
    relatedIndicatorKey: row.related_indicator_key,
    tablesUsed: asArray(row.tables_used_json).map(String),
    columnsUsed: asArray(row.columns_used_json).map(String),
    periodType: row.period_type,
    calculationMode: row.calculation_mode,
    resultType: row.result_type,
    noQueryReason: row.no_query_reason,
    requiresManualInput: Number(row.requires_manual_input ?? 0) === 1,
    externalDependency: row.external_dependency,
    uiRoute: row.ui_route,
    riskNotes: row.risk_notes,
    recommendationTemplate: row.recommendation_template,
    adminNotes: row.admin_notes,
    operationalStatus,
    readinessReason: operationalReasonForStatus(operationalStatus),
    availableActions: availableActionsForFeature(runtimeRow),
    subFeatures: subFeaturesForFeature(row),
    latestRunKey: row.latest_run_key ?? null,
    latestResultId: row.latest_result_id ?? null,
    latestResultStatus: row.latest_result_status ?? null,
    latestScorePercent: row.latest_score_percent === null || row.latest_score_percent === undefined ? null : Number(row.latest_score_percent),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function upsertPendukung2018FeatureCatalog(db: AletaDatabase, actor: UserPersona, feature: Pendukung2018FeatureDefinition) {
  const now = new Date().toISOString();
  await db.run(
    `
    INSERT INTO aleta_sipp_legacy_feature_catalog (
      id, feature_key, feature_code, feature_name, group_key, group_name, sort_order, source_type,
      source_files_json, source_evidence_json, implementation_status, migration_status, safety_status,
      review_status, related_query_key, related_indicator_key, tables_used_json, columns_used_json,
      period_type, calculation_mode, result_type, no_query_reason, requires_manual_input,
      external_dependency, ui_route, risk_notes, recommendation_template, admin_notes, is_active,
      created_by, updated_by, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDUKUNG2018', ?::jsonb, ?::jsonb, ?, ?, ?, ?, ?, ?, ?::jsonb, ?::jsonb,
      ?, ?, ?, ?, ?, ?, ?, ?, ?, '', 1, ?, ?, ?, ?)
    ON CONFLICT (feature_key) DO UPDATE SET
      feature_code = EXCLUDED.feature_code,
      feature_name = EXCLUDED.feature_name,
      group_key = EXCLUDED.group_key,
      group_name = EXCLUDED.group_name,
      sort_order = EXCLUDED.sort_order,
      source_files_json = EXCLUDED.source_files_json,
      source_evidence_json = EXCLUDED.source_evidence_json,
      implementation_status = CASE
        WHEN aleta_sipp_legacy_feature_catalog.review_status IN ('ADMIN_REVIEWED', 'AUTO_REVIEWED') THEN aleta_sipp_legacy_feature_catalog.implementation_status
        ELSE EXCLUDED.implementation_status
      END,
      migration_status = EXCLUDED.migration_status,
      safety_status = CASE
        WHEN aleta_sipp_legacy_feature_catalog.review_status IN ('ADMIN_REVIEWED', 'AUTO_REVIEWED') THEN aleta_sipp_legacy_feature_catalog.safety_status
        ELSE EXCLUDED.safety_status
      END,
      review_status = CASE WHEN aleta_sipp_legacy_feature_catalog.review_status IN ('ADMIN_REVIEWED', 'AUTO_REVIEWED') THEN aleta_sipp_legacy_feature_catalog.review_status ELSE EXCLUDED.review_status END,
      related_query_key = EXCLUDED.related_query_key,
      related_indicator_key = EXCLUDED.related_indicator_key,
      tables_used_json = EXCLUDED.tables_used_json,
      columns_used_json = EXCLUDED.columns_used_json,
      period_type = EXCLUDED.period_type,
      calculation_mode = EXCLUDED.calculation_mode,
      result_type = EXCLUDED.result_type,
      no_query_reason = EXCLUDED.no_query_reason,
      requires_manual_input = EXCLUDED.requires_manual_input,
      external_dependency = EXCLUDED.external_dependency,
      ui_route = EXCLUDED.ui_route,
      risk_notes = EXCLUDED.risk_notes,
      recommendation_template = EXCLUDED.recommendation_template,
      is_active = 1,
      updated_by = EXCLUDED.updated_by,
      updated_at = EXCLUDED.updated_at
    `,
    [
      stableId("sipp_p2018_feature", feature.featureKey),
      feature.featureKey,
      feature.featureCode,
      feature.featureName,
      feature.groupKey,
      feature.groupName,
      feature.sortOrder,
      jsonString(feature.sourceFiles),
      jsonString(feature.sourceEvidence),
      feature.implementationStatus,
      feature.migrationStatus,
      feature.safetyStatus,
      feature.reviewStatus,
      feature.relatedQueryKey,
      feature.relatedIndicatorKey,
      jsonString(feature.tablesUsed),
      jsonString(feature.columnsUsed),
      feature.periodType,
      feature.calculationMode,
      feature.resultType,
      feature.noQueryReason,
      feature.requiresManualInput ? 1 : 0,
      feature.externalDependency,
      feature.uiRoute,
      feature.riskNotes,
      feature.recommendationTemplate,
      actor.id,
      actor.id,
      now,
      now,
    ]
  );
}

async function upsertPendukung2018FeatureRegistry(db: AletaDatabase, actor: UserPersona, feature: Pendukung2018FeatureDefinition) {
  await upsertPendukung2018FeatureCatalog(db, actor, feature);
  const query = featureQueryToCandidate(feature);
  if (query) await upsertQueryCandidate(db, actor, query);
  await upsertIndicator(db, actor, featureToIndicatorCandidate(feature));
}

async function ensurePendukung2018FeatureCatalog(db: AletaDatabase, actor: UserPersona) {
  await ensureMonitoringSeeds(db);
  const queryKeys = PENDUKUNG2018_FEATURES.map((feature) => feature.relatedQueryKey).filter(Boolean);
  const indicatorKeys = PENDUKUNG2018_FEATURES.map((feature) => feature.relatedIndicatorKey).filter(Boolean);
  const [count, queryCount, indicatorCount] = await Promise.all([
    readCount(db, "SELECT COUNT(*) AS count FROM aleta_sipp_legacy_feature_catalog WHERE source_type = 'PENDUKUNG2018' AND is_active = 1"),
    queryKeys.length
      ? readCount(db, `SELECT COUNT(*) AS count FROM aleta_sipp_query_registry WHERE query_key IN (${queryKeys.map(() => "?").join(", ")}) AND is_active = 1`, queryKeys)
      : Promise.resolve(0),
    indicatorKeys.length
      ? readCount(db, `SELECT COUNT(*) AS count FROM aleta_sipp_monitoring_indicators WHERE indicator_key IN (${indicatorKeys.map(() => "?").join(", ")}) AND is_active = 1`, indicatorKeys)
      : Promise.resolve(0),
  ]);
  if (count >= PENDUKUNG2018_FEATURES.length && queryCount >= queryKeys.length && indicatorCount >= indicatorKeys.length) return { seeded: false, count };
  for (const feature of PENDUKUNG2018_FEATURES) {
    await upsertPendukung2018FeatureRegistry(db, actor, feature);
  }
  return { seeded: true, count: PENDUKUNG2018_FEATURES.length };
}

async function importPendukung2018FeatureCatalog(db: AletaDatabase, actor: UserPersona) {
  requireAnyPermission(
    actor,
    [ALETA_SIPP_PERMISSION.MANAGE_MONITORING_FEATURES, ALETA_SIPP_PERMISSION.MANAGE_PENDUKUNG2018_IMPORT],
    "Anda tidak memiliki izin menyinkronkan katalog monitoring SIPP."
  );
  await ensureMonitoringSeeds(db);
  const job = await createMonitoringJob(db, actor, "IMPORT_PENDUKUNG2018_FEATURE_CATALOG", ALETA_SIPP_MONITORING_PATHS.pendukung2018);
  try {
    let importedFeatures = 0;
    let importedQueries = 0;
    let importedIndicators = 0;
    let readyReadOnly = 0;
    let needsReview = 0;
    let manualInput = 0;
    let externalRequired = 0;
    for (const feature of PENDUKUNG2018_FEATURES) {
      await upsertPendukung2018FeatureRegistry(db, actor, feature);
      importedFeatures += 1;
      if (feature.query) importedQueries += 1;
      importedIndicators += 1;
      if (feature.implementationStatus === "READY_READ_ONLY") readyReadOnly += 1;
      if (feature.safetyStatus === "NEEDS_REVIEW" || feature.implementationStatus === "QUERY_NEEDS_REVIEW" || feature.implementationStatus === "PARTIAL_READ_ONLY") needsReview += 1;
      if (feature.requiresManualInput || feature.safetyStatus === "PERLU_INPUT_MANUAL") manualInput += 1;
      if (feature.safetyStatus === "EXTERNAL_CONNECTOR_REQUIRED") externalRequired += 1;
    }
    const byGroup = PENDUKUNG2018_GROUPS.map((group) => ({
      groupKey: group.groupKey,
      groupName: group.groupName,
      count: PENDUKUNG2018_FEATURES.filter((feature) => feature.groupKey === group.groupKey).length,
    }));
    const summary = {
      path: ALETA_SIPP_MONITORING_PATHS.pendukung2018,
      exists: existsSync(/* turbopackIgnore: true */ ALETA_SIPP_MONITORING_PATHS.pendukung2018),
      mode: "deterministic_monitoring_catalog",
      featureCount: PENDUKUNG2018_FEATURES.length,
      importedFeatures,
      importedQueries,
      importedIndicators,
      readyReadOnly,
      needsReview,
      manualInput,
      externalRequired,
      groups: byGroup,
      totalItems: importedFeatures + importedQueries + importedIndicators,
      successCount: importedFeatures + importedQueries + importedIndicators,
      failedCount: 0,
      warningCount: needsReview + manualInput + externalRequired,
    };
    const finishedAt = await finishMonitoringJob(db, job.id, summary, { status: summary.warningCount > 0 ? "COMPLETED_WITH_WARNINGS" : "SUCCESS" });
    await updateMonitoringSourceAfterImport(db, "PENDUKUNG2018", job.id, summary);
    await appendAuditLog(db, {
      id: await nextPrefixedId(db, "audit_logs", "adt"),
      actorUserId: actor.id,
      action: "aleta_sipp.monitoring.import_feature_catalog",
      entityType: "aleta_sipp_monitoring_job",
      entityId: job.id,
      payload: summary,
    });
    return { jobId: job.id, jobKey: job.jobKey, startedAt: job.startedAt, finishedAt, ...summary };
  } catch (error) {
    await finishMonitoringJob(db, job.id, { failedCount: 1, totalItems: 1 }, { status: "FAILED", errorMessage: error instanceof Error ? error.message : "Sinkronisasi katalog monitoring gagal." });
    throw error;
  }
}

async function listPendukung2018Features(
  db: AletaDatabase,
  actor: UserPersona,
  input: { q?: string; groupKey?: string; implementationStatus?: string; safetyStatus?: string; reviewStatus?: string; page?: number; pageSize?: number; limit?: number; offset?: number } = {}
) {
  requireAnyPermission(
    actor,
    [ALETA_SIPP_PERMISSION.VIEW_MONITORING, ALETA_SIPP_PERMISSION.VIEW_PENDUKUNG2018_FEATURES],
    "Anda tidak memiliki izin melihat katalog monitoring SIPP."
  );
  const seed = await ensurePendukung2018FeatureCatalog(db, actor);
  const { page, pageSize, offset } = pageInput(input);
  const where = ["f.is_active = 1", "f.source_type = 'PENDUKUNG2018'"];
  const params: SqlInputValue[] = [];
  if (input.q?.trim()) {
    where.push("(LOWER(f.feature_key) LIKE ? OR LOWER(f.feature_name) LIKE ? OR LOWER(f.source_files_json::text) LIKE ? OR LOWER(f.source_evidence_json::text) LIKE ?)");
    const q = normalizeLike(input.q);
    params.push(q, q, q, q);
  }
  if (input.groupKey?.trim()) {
    where.push("f.group_key = ?");
    params.push(input.groupKey.trim());
  }
  if (input.implementationStatus?.trim()) {
    where.push("f.implementation_status = ?");
    params.push(input.implementationStatus.trim());
  }
  if (input.safetyStatus?.trim()) {
    where.push("f.safety_status = ?");
    params.push(input.safetyStatus.trim());
  }
  if (input.reviewStatus?.trim()) {
    where.push("f.review_status = ?");
    params.push(input.reviewStatus.trim());
  }
  const whereSql = where.join(" AND ");
  const [rows, total, groups, statuses, safetyStatuses] = await Promise.all([
    db.queryAll<Pendukung2018FeatureCatalogRow>(
      `
      SELECT f.*,
        lr.run_key AS latest_run_key,
        lr.result_id AS latest_result_id,
        lr.status AS latest_result_status,
        lr.score_percent AS latest_score_percent
      FROM aleta_sipp_legacy_feature_catalog f
      LEFT JOIN LATERAL (
        SELECT r.run_key, res.id AS result_id, res.status, res.score_percent
        FROM aleta_sipp_monitoring_indicators i
        JOIN aleta_sipp_monitoring_results res ON res.indicator_id = i.id
        JOIN aleta_sipp_monitoring_runs r ON r.id = res.run_id
        WHERE i.indicator_key = f.related_indicator_key
        ORDER BY res.created_at DESC
        LIMIT 1
      ) lr ON TRUE
      WHERE ${whereSql}
      ORDER BY f.sort_order
      LIMIT ? OFFSET ?
      `,
      [...params, pageSize, offset]
    ),
    readCount(db, `SELECT COUNT(*) AS count FROM aleta_sipp_legacy_feature_catalog f WHERE ${whereSql}`, params),
    db.queryAll<{ group_key: string; group_name: string; count?: string | number | bigint | null }>(
      "SELECT group_key, group_name, COUNT(*) AS count FROM aleta_sipp_legacy_feature_catalog WHERE source_type = 'PENDUKUNG2018' AND is_active = 1 GROUP BY group_key, group_name ORDER BY MIN(sort_order)"
    ),
    db.queryAll<{ implementation_status: string; count?: string | number | bigint | null }>(
      "SELECT implementation_status, COUNT(*) AS count FROM aleta_sipp_legacy_feature_catalog WHERE source_type = 'PENDUKUNG2018' AND is_active = 1 GROUP BY implementation_status ORDER BY implementation_status"
    ),
    db.queryAll<{ safety_status: string; count?: string | number | bigint | null }>(
      "SELECT safety_status, COUNT(*) AS count FROM aleta_sipp_legacy_feature_catalog WHERE source_type = 'PENDUKUNG2018' AND is_active = 1 GROUP BY safety_status ORDER BY safety_status"
    ),
  ]);
  return {
    seeded: seed.seeded,
    rows: rows.map(mapPendukung2018FeatureRow),
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    groups: groups.map((row) => ({ groupKey: row.group_key, groupName: row.group_name, count: countValue(row) })),
    statuses: statuses.map((row) => ({ status: row.implementation_status, count: countValue(row) })),
    safetyStatuses: safetyStatuses.map((row) => ({ status: row.safety_status, count: countValue(row) })),
  };
}

async function getPendukung2018FeatureDetail(db: AletaDatabase, actor: UserPersona, featureKey: string) {
  requireAnyPermission(
    actor,
    [ALETA_SIPP_PERMISSION.VIEW_MONITORING, ALETA_SIPP_PERMISSION.VIEW_PENDUKUNG2018_FEATURES],
    "Anda tidak memiliki izin melihat detail fitur monitoring SIPP."
  );
  await ensurePendukung2018FeatureCatalog(db, actor);
  const key = decodeURIComponent(featureKey || "").trim();
  const row = await db.queryOne<Pendukung2018FeatureCatalogRow>("SELECT * FROM aleta_sipp_legacy_feature_catalog WHERE feature_key = ? AND is_active = 1 LIMIT 1", [key]);
  if (!row) notFound("Fitur monitoring tidak ditemukan.");
  const [query, indicator, latestResult] = await Promise.all([
    row.related_query_key
      ? db.queryOne<Record<string, unknown>>(
          "SELECT query_key, query_name, category, source_type, security_status, execution_mode, review_status, related_table_names_json, risk_notes FROM aleta_sipp_query_registry WHERE query_key = ? LIMIT 1",
          [row.related_query_key]
        )
      : null,
    row.related_indicator_key
      ? db.queryOne<Record<string, unknown>>(
          "SELECT indicator_key, indicator_name, category, safety_status, review_status, calculation_mode, result_type FROM aleta_sipp_monitoring_indicators WHERE indicator_key = ? LIMIT 1",
          [row.related_indicator_key]
        )
      : null,
    row.related_indicator_key
      ? db.queryOne<Record<string, unknown>>(
          `
          SELECT r.run_key, r.run_type, r.date_start, r.date_end, res.id AS result_id, res.status, res.score_percent, res.result_summary, res.recommendation
          FROM aleta_sipp_monitoring_results res
          JOIN aleta_sipp_monitoring_indicators i ON i.id = res.indicator_id
          JOIN aleta_sipp_monitoring_runs r ON r.id = res.run_id
          WHERE i.indicator_key = ?
          ORDER BY res.created_at DESC
          LIMIT 1
          `,
          [row.related_indicator_key]
        )
      : null,
  ]);
  return {
    ...mapPendukung2018FeatureRow(row),
    query: query ? { ...query, relatedTableNames: asArray(query.related_table_names_json).map(String) } : null,
    indicator,
    latestResult,
  };
}

async function getPendukung2018GroupStats(db: AletaDatabase, actor: UserPersona, groupKey?: string) {
  requireAnyPermission(
    actor,
    [ALETA_SIPP_PERMISSION.VIEW_MONITORING, ALETA_SIPP_PERMISSION.VIEW_PENDUKUNG2018_FEATURES],
    "Anda tidak memiliki izin melihat statistik katalog monitoring SIPP."
  );
  await ensurePendukung2018FeatureCatalog(db, actor);
  const params: SqlInputValue[] = [];
  const where = ["source_type = 'PENDUKUNG2018'", "is_active = 1"];
  if (groupKey?.trim()) {
    where.push("group_key = ?");
    params.push(groupKey.trim());
  }
  const whereSql = where.join(" AND ");
  const [total, ready, partial, manual, external, noQuery, groups, statuses] = await Promise.all([
    readCount(db, `SELECT COUNT(*) AS count FROM aleta_sipp_legacy_feature_catalog WHERE ${whereSql}`, params),
    readCount(db, `SELECT COUNT(*) AS count FROM aleta_sipp_legacy_feature_catalog WHERE ${whereSql} AND implementation_status = 'READY_READ_ONLY'`, params),
    readCount(db, `SELECT COUNT(*) AS count FROM aleta_sipp_legacy_feature_catalog WHERE ${whereSql} AND implementation_status IN ('PARTIAL_READ_ONLY', 'QUERY_NEEDS_REVIEW')`, params),
    readCount(db, `SELECT COUNT(*) AS count FROM aleta_sipp_legacy_feature_catalog WHERE ${whereSql} AND safety_status = 'PERLU_INPUT_MANUAL'`, params),
    readCount(db, `SELECT COUNT(*) AS count FROM aleta_sipp_legacy_feature_catalog WHERE ${whereSql} AND safety_status = 'EXTERNAL_CONNECTOR_REQUIRED'`, params),
    readCount(db, `SELECT COUNT(*) AS count FROM aleta_sipp_legacy_feature_catalog WHERE ${whereSql} AND related_query_key = ''`, params),
    db.queryAll<{ group_key: string; group_name: string; count?: string | number | bigint | null }>(
      `SELECT group_key, group_name, COUNT(*) AS count FROM aleta_sipp_legacy_feature_catalog WHERE ${whereSql} GROUP BY group_key, group_name ORDER BY MIN(sort_order)`,
      params
    ),
    db.queryAll<{ implementation_status: string; count?: string | number | bigint | null }>(
      `SELECT implementation_status, COUNT(*) AS count FROM aleta_sipp_legacy_feature_catalog WHERE ${whereSql} GROUP BY implementation_status ORDER BY implementation_status`,
      params
    ),
  ]);
  return {
    total,
    readyReadOnly: ready,
    partialReadOnly: partial,
    manualInput: manual,
    externalRequired: external,
    noQuery,
    groups: groups.map((row) => ({ groupKey: row.group_key, groupName: row.group_name, count: countValue(row) })),
    statuses: statuses.map((row) => ({ status: row.implementation_status, count: countValue(row) })),
  };
}

async function reviewMonitoringFeatureQuery(
  db: AletaDatabase,
  actor: UserPersona,
  featureKey: string,
  input: { action?: string; notes?: string; executionMode?: string; confidenceScore?: number } = {}
) {
  requireAnyPermission(
    actor,
    [ALETA_SIPP_PERMISSION.REVIEW_MONITORING_QUERY, ALETA_SIPP_PERMISSION.REVIEW_PENDUKUNG2018_QUERIES, ALETA_SIPP_PERMISSION.MANAGE_QUERY_REGISTRY],
    "Anda tidak memiliki izin mereview query monitoring SIPP."
  );
  await ensurePendukung2018FeatureCatalog(db, actor);
  const key = decodeURIComponent(featureKey || "").trim();
  if (!key) badRequest("featureKey wajib diisi.");
  const feature = await db.queryOne<Pendukung2018FeatureCatalogRow>("SELECT * FROM aleta_sipp_legacy_feature_catalog WHERE feature_key = ? AND is_active = 1 LIMIT 1", [key]);
  if (!feature) notFound("Fitur monitoring tidak ditemukan.");
  const action = (input.action || "PROMOTE_SAFE_READ_ONLY").trim().toUpperCase();
  const now = new Date().toISOString();
  const note = input.notes?.trim() || "";
  const query = feature.related_query_key ? await loadRegisteredMonitoringQuery(db, feature.related_query_key) : null;
  const querySql = query ? query.original_sql || query.normalized_sql || query.parameterized_sql : "";
  const safety = querySql
    ? validateReadOnlySql(querySql)
    : {
        ok: false,
        selectOnly: false,
        status: "EMPTY_SQL",
        reason: "Fitur belum memiliki query registry.",
        blockedReason: "Fitur belum memiliki query registry.",
        normalizedSql: "",
        statementSql: "",
        hasLimit: false,
        usesPeriodParameter: false,
      } satisfies AletaSippReadOnlySqlValidation;

  let featureImplementationStatus = feature.implementation_status;
  let featureSafetyStatus = feature.safety_status;
  let featureReviewStatus = feature.review_status;
  let indicatorSafetyStatus = "QUERY_NOT_READY";
  let indicatorReviewStatus = "NEEDS_ADMIN_REVIEW";
  let querySecurityStatus = query?.security_status ?? "NEEDS_REVIEW";
  let queryExecutionMode = query?.execution_mode ?? "PENDUKUNG2018_REFERENCE_ONLY";
  let queryReviewStatus = query?.review_status ?? "NEEDS_ADMIN_REVIEW";

  if (action === "PROMOTE_SAFE_READ_ONLY") {
    if (!query) badRequest("Fitur ini belum memiliki query registry untuk direview.");
    if (!safety.ok) badRequest(safety.blockedReason ?? "SQL registry tidak lolos validasi read-only.");
    featureImplementationStatus = "READY_READ_ONLY";
    featureSafetyStatus = "SAFE_READ_ONLY";
    featureReviewStatus = "ADMIN_REVIEWED";
    indicatorSafetyStatus = "READY_MONITORING";
    indicatorReviewStatus = "ADMIN_REVIEWED";
    querySecurityStatus = "SAFE_READ_ONLY";
    queryExecutionMode = input.executionMode?.trim() || "READY_MONITORING";
    queryReviewStatus = "ADMIN_REVIEWED";
  } else if (action === "MARK_NEEDS_REVIEW") {
    featureImplementationStatus = feature.related_query_key ? "QUERY_NEEDS_REVIEW" : "REFERENCE_ONLY";
    featureSafetyStatus = feature.related_query_key ? "NEEDS_REVIEW" : "REFERENCE_ONLY";
    featureReviewStatus = "NEEDS_ADMIN_REVIEW";
    indicatorSafetyStatus = feature.related_query_key ? "QUERY_NOT_READY" : "DATA_TIDAK_CUKUP";
    querySecurityStatus = "NEEDS_REVIEW";
    queryExecutionMode = "PENDUKUNG2018_REFERENCE_ONLY";
    queryReviewStatus = "NEEDS_ADMIN_REVIEW";
  } else if (action === "MARK_MANUAL_INPUT") {
    featureImplementationStatus = "MANUAL_INPUT_REQUIRED";
    featureSafetyStatus = "PERLU_INPUT_MANUAL";
    featureReviewStatus = "ADMIN_REVIEWED";
    indicatorSafetyStatus = "PERLU_INPUT_MANUAL";
    indicatorReviewStatus = "ADMIN_REVIEWED";
    querySecurityStatus = "MANUAL_ONLY";
    queryExecutionMode = "PENDUKUNG2018_REFERENCE_ONLY";
    queryReviewStatus = "ADMIN_REVIEWED";
  } else if (action === "MARK_EXTERNAL_CONNECTOR") {
    featureImplementationStatus = "EXTERNAL_CONNECTOR_REQUIRED";
    featureSafetyStatus = "EXTERNAL_CONNECTOR_REQUIRED";
    featureReviewStatus = "ADMIN_REVIEWED";
    indicatorSafetyStatus = "EXTERNAL_CONNECTOR_REQUIRED";
    indicatorReviewStatus = "ADMIN_REVIEWED";
    querySecurityStatus = "MANUAL_ONLY";
    queryExecutionMode = "PENDUKUNG2018_REFERENCE_ONLY";
    queryReviewStatus = "ADMIN_REVIEWED";
  } else {
    badRequest("Aksi review query monitoring tidak dikenal.");
  }

  const adminNotes = normalizeWhitespace([feature.admin_notes, note].filter(Boolean).join(" | "), 1200);
  await db.run(
    `
    UPDATE aleta_sipp_legacy_feature_catalog
    SET implementation_status = ?, safety_status = ?, review_status = ?, admin_notes = ?, updated_by = ?, updated_at = ?
    WHERE id = ?
    `,
    [featureImplementationStatus, featureSafetyStatus, featureReviewStatus, adminNotes, actor.id, now, feature.id]
  );
  if (query) {
    const riskNotes = normalizeWhitespace([String(query.risk_notes ?? ""), note ? `Review admin: ${note}` : ""].filter(Boolean).join(" | "), 1600);
    await db.run(
      `
      UPDATE aleta_sipp_query_registry
      SET security_status = ?, execution_mode = ?, review_status = ?, risk_notes = ?,
        confidence_score = COALESCE(?, confidence_score), updated_by = ?, updated_at = ?
      WHERE id = ?
      `,
      [querySecurityStatus, queryExecutionMode, queryReviewStatus, riskNotes, typeof input.confidenceScore === "number" && Number.isFinite(input.confidenceScore) ? input.confidenceScore : null, actor.id, now, query.id]
    );
  }
  if (feature.related_indicator_key) {
    await db.run(
      `
      UPDATE aleta_sipp_monitoring_indicators
      SET safety_status = ?, review_status = ?, risk_notes = ?, updated_by = ?, updated_at = ?
      WHERE indicator_key = ?
      `,
      [indicatorSafetyStatus, indicatorReviewStatus, note || feature.risk_notes, actor.id, now, feature.related_indicator_key]
    );
  }
  await appendAuditLog(db, {
    id: await nextPrefixedId(db, "audit_logs", "adt"),
    actorUserId: actor.id,
    action: "aleta_sipp.monitoring.review_query",
    entityType: "aleta_sipp_legacy_feature_catalog",
    entityId: feature.id,
    payload: { featureKey: key, action, queryKey: feature.related_query_key, selectOnly: safety.ok, safetyStatus: safety.status, note },
  });
  return getPendukung2018FeatureDetail(db, actor, key);
}

async function importPendukung2018(db: AletaDatabase, actor: UserPersona) {
  return importPendukung2018FeatureCatalog(db, actor);
}

async function extractPdfText(pdfPath: string) {
  (globalThis as unknown as { DOMMatrix?: unknown }).DOMMatrix ??= class DOMMatrix {
    a = 1;
    b = 0;
    c = 0;
    d = 1;
    e = 0;
    f = 0;
    multiply() { return this; }
    translate() { return this; }
    scale() { return this; }
    rotate() { return this; }
    inverse() { return this; }
    transformPoint(point: unknown) { return point; }
  };
  (globalThis as unknown as { ImageData?: unknown }).ImageData ??= class ImageData {};
  (globalThis as unknown as { Path2D?: unknown }).Path2D ??= class Path2D {};
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const data = await readFile(/* turbopackIgnore: true */ pdfPath);
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(data),
    disableWorker: true,
    disableFontFace: true,
    isEvalSupported: false,
  } as Record<string, unknown>).promise;
  let text = "";
  for (let pageNo = 1; pageNo <= doc.numPages; pageNo += 1) {
    const page = await doc.getPage(pageNo);
    const content = await page.getTextContent();
    text += `\n---PAGE ${pageNo}---\n${content.items.map((item) => ("str" in item ? item.str : "")).join(" ")}`;
  }
  return { pageCount: doc.numPages, text: normalizeWhitespace(text, 200_000), chars: text.length };
}

function snippetFor(text: string, name: string) {
  const normalized = text.toLowerCase();
  const index = normalized.indexOf(name.toLowerCase().replace("e-dokumen", "e - dokumen"));
  if (index < 0) return "";
  return normalizeWhitespace(text.slice(Math.max(0, index - 300), index + 1300), 1600);
}

function queryKeyForSkIndicator(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes("minutasi")) return "QRY_SIPP_MONITORING_MINUTASI";
  if (lower.includes("mediasi")) return "QRY_SIPP_MEDIASI_BY_PERKARA_ID";
  if (lower.includes("akta") || lower.includes(" ac")) return "QRY_SIPP_AKTA_CERAI_BY_PERKARA_ID";
  if (lower.includes("biaya") || lower.includes("panjar")) return "QRY_SIPP_BIAYA_PERKARA_BY_PERKARA_ID";
  if (lower.includes("sidang") || lower.includes("relaas") || lower.includes("panggilan")) return "QRY_SIPP_JADWAL_SIDANG_BY_TANGGAL";
  if (lower.includes("putusan") || lower.includes("bht") || lower.includes("amar")) return "QRY_SIPP_PUTUSAN_BY_PERKARA_ID";
  if (lower.includes("majelis") || lower.includes("hakim")) return "QRY_SIPP_MAJELIS_HAKIM_BY_PERKARA_ID";
  if (lower.includes("pp") || lower.includes("panitera")) return "QRY_SIPP_PANITERA_PENGGANTI_BY_PERKARA_ID";
  if (lower.includes("juru sita") || lower.includes("jurusita")) return "QRY_SIPP_JURUSITA_BY_PERKARA_ID";
  if (lower.includes("pendaftaran") || lower.includes("validasi data perkara")) return "QRY_SIPP_PERKARA_BY_PERIODE";
  return "";
}

async function ensureSkQueryCandidate(db: AletaDatabase, actor: UserPersona, queryKey: string, indicatorName: string, category: string) {
  if (!queryKey) return;
  const exists = await db.queryOne<{ id: string }>("SELECT id FROM aleta_sipp_query_registry WHERE query_key = ? LIMIT 1", [queryKey]);
  if (exists) return;
  const table = category === "Persidangan" ? "perkara_jadwal_sidang" : category === "Putusan" ? "perkara_putusan" : category === "Mediasi" ? "perkara_mediasi" : "perkara";
  const sql = `SELECT perkara_id, nomor_perkara FROM ${table} WHERE tanggal_input BETWEEN :date_start AND :date_end LIMIT 25`;
  await upsertQueryCandidate(db, actor, {
    queryKey,
    queryName: `${indicatorName} - Kandidat SK`,
    category,
    sourceType: "SK_PENILAIAN_SIPP_2024",
    sourceFile: ALETA_SIPP_MONITORING_PATHS.skPenilaianSipp2024,
    sourceLocation: "auto_mapping",
    sourceLine: null,
    originalSql: sql,
    normalizedSql: normalizeSql(sql),
    parameterizedSql: parameterizeSql(sql),
    tablesUsed: [table],
    columnsUsed: ["perkara_id", "nomor_perkara"],
    parameters: extractParameters(sql),
    outputs: ["perkara_id", "nomor_perkara"].map((name) => ({ name, label: humanize(name), dataType: "text" })),
    securityStatus: "NEEDS_REVIEW",
    executionMode: "SK_REFERENCE_ONLY",
    reviewStatus: "NEEDS_ADMIN_REVIEW",
    confidenceScore: 45,
    riskNotes: "Query candidate dibuat dari mapping SK dan wajib divalidasi terhadap struktur SIPP aktif sebelum eksekusi.",
  });
}

async function importSkSipp(db: AletaDatabase, actor: UserPersona) {
  requirePermission(actor, ALETA_SIPP_PERMISSION.IMPORT_SK_ASSESSMENT, "Anda tidak memiliki izin import SK Penilaian SIPP.");
  await ensureMonitoringSeeds(db);
  const job = await createMonitoringJob(db, actor, "IMPORT_SK_PENILAIAN_SIPP_2024", ALETA_SIPP_MONITORING_PATHS.skPenilaianSipp2024);
  try {
    if (!existsSync(/* turbopackIgnore: true */ ALETA_SIPP_MONITORING_PATHS.skPenilaianSipp2024)) {
      const indicator: IndicatorCandidate = {
        indicatorKey: "SK_SIPP_2024_NOT_FOUND",
        indicatorCode: "SK-NOT-FOUND",
        indicatorName: "SK PENILAIAN SIPP 2024.pdf BELUM DITEMUKAN",
        shortDescription: "File SK Penilaian SIPP 2024 belum ditemukan pada path pencarian.",
        longDescription: "Struktur modul dibuat, tetapi indikator SK menunggu import file resmi.",
        sourceType: "SK_PENILAIAN_SIPP_2024",
        sourceFile: ALETA_SIPP_MONITORING_PATHS.skPenilaianSipp2024,
        sourceLocation: "SK_NOT_FOUND",
        category: "Penilaian Triwulan",
        subCategory: "SK",
        periodType: "TRIWULAN",
        formulaText: "SK_NOT_FOUND",
        formulaJson: { status: "SK_NOT_FOUND" },
        weight: 0,
        maxScore: 100,
        thresholdGreen: null,
        thresholdYellow: null,
        thresholdRed: null,
        queryKey: "",
        tablesUsed: [],
        columnsUsed: [],
        dataScope: "SK_NOT_FOUND",
        resultType: "SCORE",
        calculationMode: "SK_REFERENCE_ONLY",
        safetyStatus: "SK_NOT_FOUND",
        reviewStatus: "NEEDS_ADMIN_REVIEW",
        confidenceScore: 0,
        riskNotes: "SK belum ditemukan; jangan mengarang indikator.",
        recommendationTemplate: "Unggah atau letakkan SK PENILAIAN SIPP 2024.pdf lalu jalankan import ulang.",
        skBasis: "SK PENILAIAN SIPP 2024.pdf BELUM DITEMUKAN",
        assumptionNotes: "SK_NOT_FOUND",
      };
      await upsertIndicator(db, actor, indicator);
      const summary = { skFound: false, skPath: ALETA_SIPP_MONITORING_PATHS.skPenilaianSipp2024, indicatorCount: 1, formulaNeedsReview: 1, totalItems: 1, successCount: 1, failedCount: 0, warningCount: 1 };
      const finishedAt = await finishMonitoringJob(db, job.id, summary, { status: "COMPLETED_WITH_WARNINGS" });
      await updateMonitoringSourceAfterImport(db, "SK_PENILAIAN_SIPP_2024", job.id, summary);
      return { jobId: job.id, jobKey: job.jobKey, startedAt: job.startedAt, finishedAt, ...summary };
    }
    let pdf = { pageCount: 25, text: "", chars: 0 };
    let pdfExtractError = "";
    try {
      pdf = await extractPdfText(ALETA_SIPP_MONITORING_PATHS.skPenilaianSipp2024);
    } catch (error) {
      pdfExtractError = error instanceof Error ? error.message : "Ekstraksi PDF gagal.";
    }
    const skNumber = pdf.text.match(/NOMOR\s*:?\s*([0-9A-Z/.\\-]+\/2024)/i)?.[1] ?? "048/DJA/SK.KP3.4.3/IV/2024";
    const title = "Evaluasi Kinerja pada Sistem Informasi Penelusuran Perkara (SIPP) di Lingkungan Peradilan Agama";
    let importedIndicators = 0;
    let formulaNeedsReview = 0;
    for (const item of SK_INDICATORS) {
      const snippet = snippetFor(pdf.text, item.name);
      const queryKey = queryKeyForSkIndicator(item.name);
      await ensureSkQueryCandidate(db, actor, queryKey, item.name, item.category);
      const hasFormula = Boolean(snippet && /\b(nilai|perhitungan|ketentuan|rumus|bobot)\b/i.test(snippet));
      if (!hasFormula) formulaNeedsReview += 1;
      await upsertIndicator(db, actor, {
        indicatorKey: `SK_SIPP_2024_${item.code}`,
        indicatorCode: item.code,
        indicatorName: item.name,
        shortDescription: `Indikator SK Penilaian SIPP 2024: ${item.name}.`,
        longDescription: snippet || `Indikator ${item.name} diekstrak dari daftar bobot SK dan perlu verifikasi manual.`,
        sourceType: "SK_PENILAIAN_SIPP_2024",
        sourceFile: ALETA_SIPP_MONITORING_PATHS.skPenilaianSipp2024,
        sourceLocation: `PDF:${item.code}`,
        category: item.category,
        subCategory: item.weight < 0 ? "Kesesuaian/Pengurang" : item.code.startsWith("SK-KIN") ? "Kinerja" : item.code.startsWith("SK-DOC") ? "Kelengkapan Dokumen" : "Input Data",
        periodType: "TRIWULAN",
        formulaText: hasFormula ? snippet : "Formula terperinci belum dapat dipastikan dari ekstraksi PDF; perlu review admin.",
        formulaJson: {
          source: "SK PENILAIAN SIPP 2024.pdf",
          skNumber,
          extracted: hasFormula,
          pdfExtracted: !pdfExtractError,
          officialPeriodicity: "dua_minggu",
          triwulanAssumption: "Asumsi triwulan kalender karena definisi triwulan tidak ditemukan dalam SK.",
        },
        weight: item.weight,
        maxScore: item.weight < 0 ? 0 : 100,
        thresholdGreen: 90,
        thresholdYellow: 60,
        thresholdRed: 60,
        queryKey,
        tablesUsed: [],
        columnsUsed: [],
        dataScope: "DATABASE_SIPP_ALETA_BOT_READ_ONLY",
        resultType: item.weight < 0 ? "DEDUCTION" : "SCORE",
        calculationMode: queryKey ? "QUERY_REGISTRY" : "SK_REFERENCE_ONLY",
        safetyStatus: hasFormula ? "QUERY_NOT_READY" : "FORMULA_NEEDS_REVIEW",
        reviewStatus: "NEEDS_ADMIN_REVIEW",
        confidenceScore: hasFormula ? 72 : 45,
        riskNotes: queryKey ? "Query terkait wajib divalidasi SAFE_READ_ONLY dan READY_ASSESSMENT sebelum eksekusi." : "Belum ada query registry kandidat yang cukup jelas.",
        recommendationTemplate: "Validasi rumus, bobot, sumber tabel, dan query periode sebelum menjalankan penilaian operasional.",
        skBasis: `${skNumber} - ${title}`,
        assumptionNotes: "SK menyebut periodisasi penilaian dua minggu; fitur triwulan ALETA memakai asumsi kalender untuk kebutuhan monitoring internal.",
      });
      importedIndicators += 1;
    }
    const summary = {
      skFound: true,
      skPath: ALETA_SIPP_MONITORING_PATHS.skPenilaianSipp2024,
      title,
      skNumber,
      pageCount: pdf.pageCount,
      extractedChars: pdf.chars,
      pdfExtractStatus: pdfExtractError ? "FAILED_FALLBACK_TO_SK_TABLE" : "SUCCESS",
      pdfExtractError,
      indicatorCount: SK_INDICATORS.length,
      indicatorsWithFormula: SK_INDICATORS.length - formulaNeedsReview,
      formulaNeedsReview,
      officialPeriodicity: "dua_minggu",
      triwulanNote: "Asumsi triwulan kalender karena definisi triwulan tidak ditemukan dalam SK.",
      totalItems: SK_INDICATORS.length,
      successCount: SK_INDICATORS.length,
      failedCount: 0,
      warningCount: formulaNeedsReview,
    };
    const finishedAt = await finishMonitoringJob(db, job.id, summary, { status: formulaNeedsReview > 0 ? "COMPLETED_WITH_WARNINGS" : "SUCCESS" });
    await updateMonitoringSourceAfterImport(db, "SK_PENILAIAN_SIPP_2024", job.id, summary);
    await appendAuditLog(db, {
      id: await nextPrefixedId(db, "audit_logs", "adt"),
      actorUserId: actor.id,
      action: "aleta_sipp.monitoring.import_sk_sipp",
      entityType: "aleta_sipp_monitoring_job",
      entityId: job.id,
      payload: summary,
    });
    return { jobId: job.id, jobKey: job.jobKey, startedAt: job.startedAt, finishedAt, ...summary };
  } catch (error) {
    await finishMonitoringJob(db, job.id, { failedCount: 1, totalItems: 1 }, { status: "FAILED", errorMessage: error instanceof Error ? error.message : "Import SK gagal." });
    throw error;
  }
}

function wordSet(value: string) {
  const stop = new Set(["dan", "yang", "dengan", "data", "perkara", "sipp", "penginputan", "pengisian"]);
  return new Set(slugKey(value, 180).split("_").filter((word) => word.length > 2 && !stop.has(word)));
}

function similarity(left: string, right: string) {
  const a = wordSet(left);
  const b = wordSet(right);
  if (a.size === 0 || b.size === 0) return 0;
  const intersection = Array.from(a).filter((word) => b.has(word)).length;
  return Math.round((intersection / Math.max(a.size, b.size)) * 100);
}

async function mapIndicators(db: AletaDatabase, actor: UserPersona) {
  requirePermission(actor, ALETA_SIPP_PERMISSION.MANAGE_INDICATOR_MAPPING, "Anda tidak memiliki izin mengelola mapping indikator.");
  const [pendukung, sk] = await Promise.all([
    db.queryAll<MonitoringIndicatorRow>("SELECT * FROM aleta_sipp_monitoring_indicators WHERE is_active = 1 AND source_type = 'PENDUKUNG2018' ORDER BY indicator_name"),
    db.queryAll<MonitoringIndicatorRow>("SELECT * FROM aleta_sipp_monitoring_indicators WHERE is_active = 1 AND source_type = 'SK_PENILAIAN_SIPP_2024' ORDER BY indicator_name"),
  ]);
  const counts: Record<string, number> = { EXACT_MATCH: 0, SIMILAR: 0, RELATED: 0, NO_MATCH: 0, CONFLICT: 0, NEEDS_REVIEW: 0 };
  const now = new Date().toISOString();
  let created = 0;
  for (const source of pendukung) {
    let best: { target: MonitoringIndicatorRow; score: number } | null = null;
    for (const target of sk) {
      const score = similarity(`${source.indicator_name} ${source.category}`, `${target.indicator_name} ${target.category}`);
      if (!best || score > best.score) best = { target, score };
    }
    const mappingType = !best || best.score < 15 ? "NO_MATCH" : best.score >= 80 ? "EXACT_MATCH" : best.score >= 45 ? "SIMILAR" : best.score >= 25 ? "RELATED" : "NEEDS_REVIEW";
    counts[mappingType] = (counts[mappingType] ?? 0) + 1;
    if (!best || mappingType === "NO_MATCH") continue;
    await db.run(
      `
      INSERT INTO aleta_sipp_monitoring_indicator_mappings (
        id, source_indicator_id, target_indicator_id, mapping_type, similarity_score, notes,
        review_status, created_by, updated_by, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, 'NEEDS_ADMIN_REVIEW', ?, ?, ?, ?)
      ON CONFLICT (source_indicator_id, target_indicator_id) DO UPDATE SET
        mapping_type = EXCLUDED.mapping_type,
        similarity_score = EXCLUDED.similarity_score,
        notes = EXCLUDED.notes,
        updated_by = EXCLUDED.updated_by,
        updated_at = EXCLUDED.updated_at
      `,
      [
        stableId("sipp_mon_map", source.id, best.target.id),
        source.id,
        best.target.id,
        mappingType,
        best.score,
        `Auto-suggest berdasarkan kemiripan nama/kategori: ${source.indicator_name} -> ${best.target.indicator_name}.`,
        actor.id,
        actor.id,
        now,
        now,
      ]
    );
    created += 1;
  }
  await appendAuditLog(db, {
    id: await nextPrefixedId(db, "audit_logs", "adt"),
    actorUserId: actor.id,
    action: "aleta_sipp.monitoring.map_indicators",
    entityType: "aleta_sipp_monitoring_indicator_mapping",
    entityId: "auto_mapping",
    payload: { created, counts },
  });
  return { created, sourceIndicators: pendukung.length, targetIndicators: sk.length, counts };
}

function quarterRange(year: number, quarter: number) {
  const q = Math.min(4, Math.max(1, Math.trunc(quarter || 1)));
  const starts = [`${year}-01-01`, `${year}-04-01`, `${year}-07-01`, `${year}-10-01`];
  const ends = [`${year}-03-31`, `${year}-06-30`, `${year}-09-30`, `${year}-12-31`];
  return { quarter: q, dateStart: starts[q - 1], dateEnd: ends[q - 1] };
}

async function runMonitoring(
  db: AletaDatabase,
  actor: UserPersona,
  input: {
    runType?: string;
    year?: number;
    quarter?: number;
    dateStart?: string;
    dateEnd?: string;
    datasourceMode?: string;
    selectedIndicatorKeys?: string[];
    selectedFeatureKeys?: string[];
    dryRun?: boolean;
  }
) {
  const runType = input.runType || "PENDUKUNG2018_MONITORING";
  const permissions = runType === "SK_TRIWULAN_ASSESSMENT"
    ? [ALETA_SIPP_PERMISSION.RUN_SK_ASSESSMENT, ALETA_SIPP_PERMISSION.RUN_ASSESSMENT, ALETA_SIPP_PERMISSION.RUN_MONITORING]
    : runType === "PENDUKUNG2018_MONITORING"
      ? [ALETA_SIPP_PERMISSION.RUN_MONITORING, ALETA_SIPP_PERMISSION.RUN_PENDUKUNG2018_MONITORING]
      : [ALETA_SIPP_PERMISSION.RUN_MONITORING, ALETA_SIPP_PERMISSION.RUN_ASSESSMENT];
  requireAnyPermission(actor, permissions, "Anda tidak memiliki izin menjalankan monitoring/evaluasi SIPP.");
  const year = Number(input.year || new Date().getFullYear());
  const q = input.quarter ? quarterRange(year, Number(input.quarter)) : null;
  const dateStart = input.dateStart || q?.dateStart || `${year}-01-01`;
  const dateEnd = input.dateEnd || q?.dateEnd || `${year}-12-31`;
  const allowedTypes = new Set(["PENDUKUNG2018_MONITORING", "SK_TRIWULAN_ASSESSMENT", "COMBINED_EVALUATION"]);
  if (!allowedTypes.has(runType)) badRequest("runType monitoring tidak dikenal.");
  await ensureMonitoringSeeds(db);
  const sourceWhere = runType === "PENDUKUNG2018_MONITORING"
    ? "source_type = 'PENDUKUNG2018'"
    : runType === "SK_TRIWULAN_ASSESSMENT"
      ? "source_type = 'SK_PENILAIAN_SIPP_2024'"
      : "source_type IN ('PENDUKUNG2018', 'SK_PENILAIAN_SIPP_2024')";
  const params: SqlInputValue[] = [];
  let selectedWhere = "";
  const selectedFeatureKeys = Array.from(new Set(input.selectedFeatureKeys?.filter(Boolean) ?? []));
  let selectedIndicatorKeys = Array.from(new Set(input.selectedIndicatorKeys?.filter(Boolean) ?? []));
  if (selectedFeatureKeys.length > 0) {
    await ensurePendukung2018FeatureCatalog(db, actor);
    const selectedFeatureSet = new Set(selectedFeatureKeys);
    for (const feature of PENDUKUNG2018_FEATURES.filter((item) => selectedFeatureSet.has(item.featureKey))) {
      await upsertPendukung2018FeatureRegistry(db, actor, feature);
    }
    const featureRows = await db.queryAll<{ related_indicator_key: string }>(
      `SELECT related_indicator_key FROM aleta_sipp_legacy_feature_catalog WHERE feature_key IN (${selectedFeatureKeys.map(() => "?").join(", ")}) AND is_active = 1`,
      selectedFeatureKeys
    );
    selectedIndicatorKeys = Array.from(new Set([...selectedIndicatorKeys, ...featureRows.map((row) => row.related_indicator_key).filter(Boolean)]));
  }
  if (selectedIndicatorKeys.length) {
    selectedWhere = ` AND indicator_key IN (${selectedIndicatorKeys.map(() => "?").join(", ")})`;
    params.push(...selectedIndicatorKeys);
  }
  const indicators = await db.queryAll<MonitoringIndicatorRow>(
    `SELECT * FROM aleta_sipp_monitoring_indicators WHERE is_active = 1 AND ${sourceWhere}${selectedWhere} ORDER BY source_type, category, indicator_name LIMIT 500`,
    params
  );
  if (indicators.length === 0) badRequest("Belum ada indikator monitoring. Jalankan sinkronisasi katalog monitoring atau import SK SIPP terlebih dahulu.");
  const now = new Date().toISOString();
  const runId = await nextPrefixedId(db, "aleta_sipp_monitoring_runs", "sipp-mon-run");
  const runKey = `${runType}_${year}${input.quarter ? `_Q${input.quarter}` : ""}_${Date.now()}`;
  const auditId = await nextPrefixedId(db, "audit_logs", "adt");
  const datasource = getAletaSippDataSourceStatus();
  const datasourceMode = input.dryRun ? "DRY_RUN" : input.datasourceMode || datasource.mode;
  const context: MonitoringRunContext = {
    runId,
    runKey,
    runType,
    year,
    quarter: input.quarter ?? null,
    dateStart,
    dateEnd,
    dryRun: Boolean(input.dryRun),
    datasourceMode,
    actor,
  };
  await db.run(
    `
    INSERT INTO aleta_sipp_monitoring_runs (
      id, run_key, run_name, run_type, year, quarter, date_start, date_end, datasource_mode,
      status, total_indicators, summary_json, started_at, created_by, audit_log_id, created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'RUNNING', ?, ?::jsonb, ?, ?, ?, ?)
    `,
    [
      runId,
      runKey,
      `${input.dryRun ? "Dry-run " : ""}${runType} ${dateStart} - ${dateEnd}`,
      runType,
      year,
      input.quarter ?? null,
      dateStart,
      dateEnd,
      datasourceMode,
      indicators.length,
      jsonString({ dryRun: Boolean(input.dryRun), datasource, dateStart, dateEnd, selectedFeatureKeys, selectedIndicatorKeys }),
      now,
      actor.id,
      auditId,
      now,
    ]
  );
  let green = 0;
  let yellow = 0;
  let red = 0;
  let needsReview = 0;
  let dataNotEnough = 0;
  let manualInput = 0;
  let queryNotReady = 0;
  let completed = 0;
  let failed = 0;
  let scoreTotal = 0;
  let scoreMax = 0;
  const executionWarnings: Array<{ indicatorKey: string; status: string; reason: string }> = [];
  for (const indicator of indicators) {
    let calculation: MonitoringCalculation;
    try {
      const manual = await manualCalculationIfAvailable(db, indicator, context);
      if (manual) {
        calculation = manual;
      } else if (indicator.safety_status === "PERLU_INPUT_MANUAL" || indicator.calculation_mode === "MANUAL_INPUT") {
        calculation = {
          status: "PERLU_INPUT_MANUAL",
          numerator: null,
          denominator: null,
          rawValue: null,
          score: 0,
          maxScore: Math.max(0, numeric(indicator.max_score) || 100),
          scorePercent: 0,
          weight: numeric(indicator.weight),
          weightedScore: 0,
          resultSummary: "Indikator membutuhkan input manual terverifikasi untuk periode ini.",
          recommendation: recommendationForIndicator(indicator, "PERLU_INPUT_MANUAL"),
          errorMessage: null,
          items: [],
          executed: false,
        };
      } else if (indicator.safety_status === "SK_NOT_FOUND") {
        calculation = {
          status: "SK_NOT_FOUND",
          numerator: null,
          denominator: null,
          rawValue: null,
          score: 0,
          maxScore: 0,
          scorePercent: 0,
          weight: numeric(indicator.weight),
          weightedScore: 0,
          resultSummary: "File SK belum tersedia, indikator belum dapat dihitung.",
          recommendation: recommendationForIndicator(indicator, "SK_NOT_FOUND"),
          errorMessage: null,
          items: [],
          executed: false,
        };
      } else if (indicator.safety_status === "EXTERNAL_CONNECTOR_REQUIRED" || indicator.calculation_mode === "EXTERNAL_CONNECTOR") {
        calculation = {
          status: "EXTERNAL_CONNECTOR_REQUIRED",
          numerator: null,
          denominator: null,
          rawValue: null,
          score: 0,
          maxScore: Math.max(0, numeric(indicator.max_score) || 100),
          scorePercent: 0,
          weight: numeric(indicator.weight),
          weightedScore: 0,
          resultSummary: "Fitur membutuhkan connector eksternal read-only yang belum dikonfigurasi.",
          recommendation: recommendationForIndicator(indicator, "EXTERNAL_CONNECTOR_REQUIRED"),
          errorMessage: null,
          items: [],
          executed: false,
        };
      } else if (indicator.safety_status === "DEPRECATED_REFERENCE_ONLY" || indicator.calculation_mode === "REFERENCE_ONLY") {
        calculation = {
          status: "REFERENCE_ONLY",
          numerator: null,
          denominator: null,
          rawValue: null,
          score: 0,
          maxScore: Math.max(0, numeric(indicator.max_score) || 100),
          scorePercent: 0,
          weight: numeric(indicator.weight),
          weightedScore: 0,
          resultSummary: "Fitur disimpan sebagai referensi sumber lama dan belum memiliki query monitoring yang aman.",
          recommendation: recommendationForIndicator(indicator, "REFERENCE_ONLY"),
          errorMessage: null,
          items: [],
          executed: false,
        };
      } else if (indicator.safety_status === "FORMULA_NEEDS_REVIEW") {
        calculation = {
          status: "FORMULA_NEEDS_REVIEW",
          numerator: null,
          denominator: null,
          rawValue: null,
          score: 0,
          maxScore: Math.max(0, numeric(indicator.max_score) || 100),
          scorePercent: 0,
          weight: numeric(indicator.weight),
          weightedScore: 0,
          resultSummary: "Formula indikator belum cukup jelas dari SK/kode sumber lama, sehingga tidak dihitung otomatis.",
          recommendation: recommendationForIndicator(indicator, "FORMULA_NEEDS_REVIEW"),
          errorMessage: null,
          items: [],
          executed: false,
        };
      } else {
        const query = await loadRegisteredMonitoringQuery(db, indicator.query_key);
        const readiness = queryReadyForMonitoring(query);
        if (!readiness.ready || !query) {
          calculation = {
            status: readiness.status,
            numerator: null,
            denominator: null,
            rawValue: null,
            score: 0,
            maxScore: Math.max(0, numeric(indicator.max_score) || 100),
            scorePercent: 0,
            weight: numeric(indicator.weight),
            weightedScore: 0,
            resultSummary: readiness.reason,
            recommendation: recommendationForIndicator(indicator, readiness.status),
            errorMessage: null,
            items: [],
            executed: false,
          };
        } else {
          const execution = await executeRegisteredMonitoringQuery(query, context, runType === "SK_TRIWULAN_ASSESSMENT" ? "assessment" : "monitoring");
          if (execution.ok) {
            calculation = calculateIndicatorScore(indicator, execution.rows, context, { dryRun: Boolean("dryRun" in execution && execution.dryRun), queryHash: execution.queryHash });
          } else {
            calculation = calculateIndicatorScore(indicator, [], context, { datasourceError: execution.error ?? "Query registry belum dapat dieksekusi.", queryHash: "queryHash" in execution ? execution.queryHash : undefined });
          }
        }
      }
    } catch (error) {
      failed += 1;
      calculation = {
        status: "ERROR",
        numerator: null,
        denominator: null,
        rawValue: null,
        score: 0,
        maxScore: Math.max(0, numeric(indicator.max_score) || 100),
        scorePercent: 0,
        weight: numeric(indicator.weight),
        weightedScore: 0,
        resultSummary: "Indikator gagal dihitung, indikator lain tetap diproses.",
        recommendation: recommendationForIndicator(indicator, "ERROR"),
        errorMessage: error instanceof Error ? error.message : "Indikator gagal dihitung.",
        items: [],
        executed: false,
      };
    }

    const status = calculation.status;
    if (status === "HIJAU") green += 1;
    else if (status === "KUNING") yellow += 1;
    else if (status === "MERAH") red += 1;
    else if (status === "PERLU_INPUT_MANUAL") manualInput += 1;
    else if (status === "QUERY_NOT_READY") queryNotReady += 1;
    else if (status === "DATA_TIDAK_CUKUP") dataNotEnough += 1;
    else needsReview += 1;
    if (!["HIJAU", "KUNING", "MERAH"].includes(status)) {
      executionWarnings.push({ indicatorKey: indicator.indicator_key, status, reason: calculation.resultSummary });
    }
    scoreTotal += calculation.weight ? calculation.weightedScore : calculation.score;
    scoreMax += calculation.weight > 0 ? calculation.weight : calculation.maxScore;

    const resultId = stableId("sipp_mon_res", runId, indicator.id);
    await db.run(
      `
      INSERT INTO aleta_sipp_monitoring_results (
        id, run_id, indicator_id, query_key, status, numerator, denominator, raw_value, score,
        max_score, score_percent, weight, weighted_score, result_summary, recommendation,
        error_message, calculated_at, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (run_id, indicator_id) DO UPDATE SET
        query_key = EXCLUDED.query_key,
        status = EXCLUDED.status,
        numerator = EXCLUDED.numerator,
        denominator = EXCLUDED.denominator,
        raw_value = EXCLUDED.raw_value,
        score = EXCLUDED.score,
        max_score = EXCLUDED.max_score,
        score_percent = EXCLUDED.score_percent,
        weight = EXCLUDED.weight,
        weighted_score = EXCLUDED.weighted_score,
        result_summary = EXCLUDED.result_summary,
        recommendation = EXCLUDED.recommendation,
        error_message = EXCLUDED.error_message,
        calculated_at = EXCLUDED.calculated_at
      `,
      [
        resultId,
        runId,
        indicator.id,
        indicator.query_key,
        calculation.status,
        calculation.numerator,
        calculation.denominator,
        calculation.rawValue,
        calculation.score,
        calculation.maxScore,
        calculation.scorePercent,
        calculation.weight,
        calculation.weightedScore,
        calculation.resultSummary,
        calculation.recommendation,
        calculation.errorMessage,
        new Date().toISOString(),
        now,
      ]
    );
    if (calculation.items.length > 0) {
      await db.run("DELETE FROM aleta_sipp_monitoring_result_items WHERE result_id = ?", [resultId]);
      for (const item of calculation.items) {
      await db.run(
        `
        INSERT INTO aleta_sipp_monitoring_result_items (
          id, result_id, perkara_id, nomor_perkara, item_type, item_title, item_description,
          item_status, responsible_role, responsible_name, source_table, source_data_json,
          recommendation, followup_status, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?, 'BELUM_DITINDAKLANJUTI', ?, ?)
        `,
        [
          await nextPrefixedId(db, "aleta_sipp_monitoring_result_items", "sipp-mon-item"),
          resultId,
          item.perkaraId,
          item.nomorPerkara,
          item.itemType,
          item.itemTitle,
          item.itemDescription,
          item.itemStatus,
          item.responsibleRole,
          item.responsibleName,
          item.sourceTable,
          jsonString(item.sourceData),
          item.recommendation,
          now,
          now,
        ]
      );
      }
    }
    completed += 1;
  }
  const finishedAt = new Date().toISOString();
  const status = failed + queryNotReady + dataNotEnough + manualInput + needsReview > 0 ? "COMPLETED_WITH_WARNINGS" : "COMPLETED";
  const scorePercent = scoreMax > 0 ? clampPercent((scoreTotal / scoreMax) * 100) : 0;
  await db.run(
    `
    UPDATE aleta_sipp_monitoring_runs
    SET status = ?, completed_indicators = ?, failed_indicators = ?, score_total = ?, score_max = ?,
      score_percent = ?, green_count = ?, yellow_count = ?, red_count = ?, needs_review_count = ?,
      data_not_enough_count = ?, manual_input_count = ?, query_not_ready_count = ?,
      summary_json = ?::jsonb, finished_at = ?
    WHERE id = ?
    `,
    [
      status,
      completed,
      failed,
      scoreTotal,
      scoreMax,
      scorePercent,
      green,
      yellow,
      red,
      needsReview,
      dataNotEnough,
      manualInput,
      queryNotReady,
      jsonString({
        dryRun: Boolean(input.dryRun),
        datasource,
        dateStart,
        dateEnd,
        scoreTotal,
        scoreMax,
        scorePercent,
        warnings: executionWarnings.slice(0, 50),
        selectedFeatureKeys,
        selectedIndicatorKeys,
      }),
      finishedAt,
      runId,
    ]
  );
  await appendAuditLog(db, {
    id: auditId,
    actorUserId: actor.id,
    action: "aleta_sipp.monitoring.run",
    entityType: "aleta_sipp_monitoring_run",
    entityId: runId,
    payload: { runKey, runType, dateStart, dateEnd, dryRun: Boolean(input.dryRun), datasourceMode, selectedFeatureKeys, selectedIndicatorKeys, queryNotReady, dataNotEnough, failed, scorePercent },
  });
  return getRunDetail(db, actor, runKey);
}

async function getMonitoringStats(db: AletaDatabase, actor: UserPersona) {
  requirePermission(actor, ALETA_SIPP_PERMISSION.VIEW_MONITORING, "Anda tidak memiliki izin melihat statistik monitoring SIPP.");
  await ensureMonitoringSeeds(db);
  const [pendukung, sk, ready, needsReview, queryNotReady, dataNotEnough, manualInput, runCount, lastRun, sourceRows, mappingRows] = await Promise.all([
    readCount(db, "SELECT COUNT(*) AS count FROM aleta_sipp_monitoring_indicators WHERE is_active = 1 AND source_type = 'PENDUKUNG2018'"),
    readCount(db, "SELECT COUNT(*) AS count FROM aleta_sipp_monitoring_indicators WHERE is_active = 1 AND source_type = 'SK_PENILAIAN_SIPP_2024'"),
    readCount(db, "SELECT COUNT(*) AS count FROM aleta_sipp_monitoring_indicators WHERE is_active = 1 AND safety_status IN ('READY_MONITORING', 'READY_ASSESSMENT', 'READY_TRIWULAN_ASSESSMENT')"),
    readCount(db, "SELECT COUNT(*) AS count FROM aleta_sipp_monitoring_indicators WHERE is_active = 1 AND review_status = 'NEEDS_ADMIN_REVIEW'"),
    readCount(db, "SELECT COUNT(*) AS count FROM aleta_sipp_monitoring_indicators WHERE is_active = 1 AND safety_status = 'QUERY_NOT_READY'"),
    readCount(db, "SELECT COUNT(*) AS count FROM aleta_sipp_monitoring_indicators WHERE is_active = 1 AND safety_status = 'DATA_TIDAK_CUKUP'"),
    readCount(db, "SELECT COUNT(*) AS count FROM aleta_sipp_monitoring_indicators WHERE is_active = 1 AND safety_status = 'PERLU_INPUT_MANUAL'"),
    readCount(db, "SELECT COUNT(*) AS count FROM aleta_sipp_monitoring_runs"),
    db.queryOne<Record<string, unknown>>("SELECT * FROM aleta_sipp_monitoring_runs ORDER BY created_at DESC LIMIT 1"),
    db.queryAll<Record<string, unknown>>("SELECT source_key, source_type, source_name, source_path, status, summary_json, last_imported_at FROM aleta_sipp_monitoring_sources ORDER BY source_key"),
    db.queryAll<{ mapping_type: string; count?: string | number | bigint | null }>("SELECT mapping_type, COUNT(*) AS count FROM aleta_sipp_monitoring_indicator_mappings GROUP BY mapping_type ORDER BY mapping_type"),
  ]);
  return {
    pendukung2018Indicators: pendukung,
    skIndicators: sk,
    readyIndicators: ready,
    needsReviewIndicators: needsReview,
    queryNotReadyIndicators: queryNotReady,
    dataNotEnoughIndicators: dataNotEnough,
    manualInputIndicators: manualInput,
    runCount,
    datasourceStatus: getAletaSippDataSourceStatus(),
    lastRun,
    lastRunAt: String(lastRun?.finished_at ?? lastRun?.created_at ?? ""),
    sources: sourceRows.map((row) => ({ ...row, summary: asRecord(row.summary_json) })),
    mappings: mappingRows.map((row) => ({ mappingType: row.mapping_type, count: countValue(row) })),
  };
}

async function listIndicators(
  db: AletaDatabase,
  actor: UserPersona,
  input: { q?: string; sourceType?: string; category?: string; status?: string; reviewStatus?: string; page?: number; pageSize?: number; limit?: number; offset?: number } = {}
) {
  requirePermission(actor, ALETA_SIPP_PERMISSION.VIEW_MONITORING, "Anda tidak memiliki izin melihat indikator monitoring.");
  const { page, pageSize, offset } = pageInput(input);
  const where = ["i.is_active = 1"];
  const params: SqlInputValue[] = [];
  if (input.q?.trim()) {
    where.push("(LOWER(i.indicator_key) LIKE ? OR LOWER(i.indicator_name) LIKE ? OR LOWER(i.short_description) LIKE ? OR LOWER(i.source_location) LIKE ?)");
    const q = normalizeLike(input.q);
    params.push(q, q, q, q);
  }
  if (input.sourceType?.trim()) {
    where.push("i.source_type = ?");
    params.push(input.sourceType.trim());
  }
  if (input.category?.trim()) {
    where.push("i.category = ?");
    params.push(input.category.trim());
  }
  if (input.status?.trim()) {
    where.push("i.safety_status = ?");
    params.push(input.status.trim());
  }
  if (input.reviewStatus?.trim()) {
    where.push("i.review_status = ?");
    params.push(input.reviewStatus.trim());
  }
  const whereSql = where.join(" AND ");
  const [rows, total, categories, sources, statuses] = await Promise.all([
    db.queryAll<MonitoringIndicatorRow>(
      `
      SELECT i.*,
        lr.run_key AS latest_run_key,
        lr.status AS latest_result_status,
        lr.score_percent AS latest_score_percent
      FROM aleta_sipp_monitoring_indicators i
      LEFT JOIN LATERAL (
        SELECT r.run_key, res.status, res.score_percent
        FROM aleta_sipp_monitoring_results res
        JOIN aleta_sipp_monitoring_runs r ON r.id = res.run_id
        WHERE res.indicator_id = i.id
        ORDER BY res.created_at DESC
        LIMIT 1
      ) lr ON TRUE
      WHERE ${whereSql}
      ORDER BY i.source_type, i.category, i.indicator_name
      LIMIT ? OFFSET ?
      `,
      [...params, pageSize, offset]
    ),
    readCount(db, `SELECT COUNT(*) AS count FROM aleta_sipp_monitoring_indicators i WHERE ${whereSql}`, params),
    db.queryAll<{ category: string; count?: string | number | bigint | null }>("SELECT category, COUNT(*) AS count FROM aleta_sipp_monitoring_indicators WHERE is_active = 1 GROUP BY category ORDER BY category"),
    db.queryAll<{ source_type: string; count?: string | number | bigint | null }>("SELECT source_type, COUNT(*) AS count FROM aleta_sipp_monitoring_indicators WHERE is_active = 1 GROUP BY source_type ORDER BY source_type"),
    db.queryAll<{ safety_status: string; count?: string | number | bigint | null }>("SELECT safety_status, COUNT(*) AS count FROM aleta_sipp_monitoring_indicators WHERE is_active = 1 GROUP BY safety_status ORDER BY safety_status"),
  ]);
  return {
    rows: rows.map(mapIndicatorRow),
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    categories: categories.map((row) => ({ category: row.category, count: countValue(row) })),
    sources: sources.map((row) => ({ sourceType: row.source_type, count: countValue(row) })),
    statuses: statuses.map((row) => ({ status: row.safety_status, count: countValue(row) })),
  };
}

async function getIndicatorDetail(db: AletaDatabase, actor: UserPersona, indicatorKey: string) {
  requirePermission(actor, ALETA_SIPP_PERMISSION.VIEW_MONITORING_DETAIL, "Anda tidak memiliki izin melihat detail indikator monitoring.");
  const key = decodeURIComponent(indicatorKey || "").trim();
  const row = await db.queryOne<MonitoringIndicatorRow>("SELECT * FROM aleta_sipp_monitoring_indicators WHERE indicator_key = ? AND is_active = 1 LIMIT 1", [key]);
  if (!row) notFound("Indikator monitoring tidak ditemukan.");
  const [query, latestResult, mappings] = await Promise.all([
    row.query_key
      ? db.queryOne<Record<string, unknown>>("SELECT query_key, query_name, name, category, source_type, security_status, execution_mode, review_status, related_table_names_json, risk_notes FROM aleta_sipp_query_registry WHERE query_key = ? LIMIT 1", [row.query_key])
      : null,
    db.queryOne<Record<string, unknown>>(
      `
      SELECT r.run_key, r.run_type, r.date_start, r.date_end, res.*
      FROM aleta_sipp_monitoring_results res
      JOIN aleta_sipp_monitoring_runs r ON r.id = res.run_id
      WHERE res.indicator_id = ?
      ORDER BY res.created_at DESC
      LIMIT 1
      `,
      [row.id]
    ),
    db.queryAll<Record<string, unknown>>(
      `
      SELECT m.mapping_type, m.similarity_score, m.notes, m.review_status,
        src.indicator_key AS source_indicator_key, src.indicator_name AS source_indicator_name,
        tgt.indicator_key AS target_indicator_key, tgt.indicator_name AS target_indicator_name
      FROM aleta_sipp_monitoring_indicator_mappings m
      JOIN aleta_sipp_monitoring_indicators src ON src.id = m.source_indicator_id
      JOIN aleta_sipp_monitoring_indicators tgt ON tgt.id = m.target_indicator_id
      WHERE m.source_indicator_id = ? OR m.target_indicator_id = ?
      ORDER BY m.similarity_score DESC
      LIMIT 30
      `,
      [row.id, row.id]
    ),
  ]);
  return {
    ...mapIndicatorRow(row),
    query: query ? { ...query, relatedTableNames: asArray(query.related_table_names_json).map(String) } : null,
    latestResult,
    mappings,
  };
}

async function listRuns(
  db: AletaDatabase,
  actor: UserPersona,
  input: { runType?: string; year?: number; quarter?: number; status?: string; page?: number; pageSize?: number; limit?: number; offset?: number } = {}
) {
  requirePermission(actor, ALETA_SIPP_PERMISSION.VIEW_MONITORING, "Anda tidak memiliki izin melihat riwayat run monitoring.");
  const { page, pageSize, offset } = pageInput(input);
  const where = ["1 = 1"];
  const params: SqlInputValue[] = [];
  if (input.runType?.trim()) {
    where.push("run_type = ?");
    params.push(input.runType.trim());
  }
  if (input.year) {
    where.push("year = ?");
    params.push(Number(input.year));
  }
  if (input.quarter) {
    where.push("quarter = ?");
    params.push(Number(input.quarter));
  }
  if (input.status?.trim()) {
    where.push("status = ?");
    params.push(input.status.trim());
  }
  const whereSql = where.join(" AND ");
  const [rows, total] = await Promise.all([
    db.queryAll<Record<string, unknown>>(`SELECT * FROM aleta_sipp_monitoring_runs WHERE ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`, [...params, pageSize, offset]),
    readCount(db, `SELECT COUNT(*) AS count FROM aleta_sipp_monitoring_runs WHERE ${whereSql}`, params),
  ]);
  return { rows, pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) } };
}

async function getRunDetail(db: AletaDatabase, actor: UserPersona, runKey: string) {
  requirePermission(actor, ALETA_SIPP_PERMISSION.VIEW_MONITORING, "Anda tidak memiliki izin melihat detail run monitoring.");
  const key = decodeURIComponent(runKey || "").trim();
  const row = await db.queryOne<Record<string, unknown>>("SELECT * FROM aleta_sipp_monitoring_runs WHERE run_key = ? LIMIT 1", [key]);
  if (!row) notFound("Run monitoring tidak ditemukan.");
  const statusRows = await db.queryAll<{ status: string; count?: string | number | bigint | null }>(
    "SELECT status, COUNT(*) AS count FROM aleta_sipp_monitoring_results WHERE run_id = ? GROUP BY status ORDER BY status",
    [String(row.id)]
  );
  return { ...row, summary: asRecord(row.summary_json), resultStatusCounts: statusRows.map((item) => ({ status: item.status, count: countValue(item) })) };
}

async function getRunResults(db: AletaDatabase, actor: UserPersona, runKey: string, input: { status?: string; page?: number; pageSize?: number; limit?: number; offset?: number } = {}) {
  requirePermission(actor, ALETA_SIPP_PERMISSION.VIEW_MONITORING, "Anda tidak memiliki izin melihat hasil run monitoring.");
  const run = await db.queryOne<{ id: string; run_key: string }>("SELECT id, run_key FROM aleta_sipp_monitoring_runs WHERE run_key = ? LIMIT 1", [decodeURIComponent(runKey || "").trim()]);
  if (!run) notFound("Run monitoring tidak ditemukan.");
  const { page, pageSize, offset } = pageInput(input);
  const where = ["res.run_id = ?"];
  const params: SqlInputValue[] = [run.id];
  if (input.status?.trim()) {
    where.push("res.status = ?");
    params.push(input.status.trim());
  }
  const whereSql = where.join(" AND ");
  const [rows, total] = await Promise.all([
    db.queryAll<Record<string, unknown>>(
      `
      SELECT res.*, i.indicator_key, i.indicator_name, i.category, i.source_type,
        (SELECT COUNT(*) FROM aleta_sipp_monitoring_result_items item WHERE item.result_id = res.id) AS item_count
      FROM aleta_sipp_monitoring_results res
      JOIN aleta_sipp_monitoring_indicators i ON i.id = res.indicator_id
      WHERE ${whereSql}
      ORDER BY i.source_type, i.category, i.indicator_name
      LIMIT ? OFFSET ?
      `,
      [...params, pageSize, offset]
    ),
    readCount(db, `SELECT COUNT(*) AS count FROM aleta_sipp_monitoring_results res WHERE ${whereSql}`, params),
  ]);
  return { runKey: run.run_key, rows, pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) } };
}

async function getResultItems(db: AletaDatabase, actor: UserPersona, resultId: string, input: { status?: string; page?: number; pageSize?: number; limit?: number; offset?: number } = {}) {
  requirePermission(actor, ALETA_SIPP_PERMISSION.VIEW_MONITORING_DETAIL, "Anda tidak memiliki izin melihat drill-down hasil monitoring.");
  const result = await db.queryOne<{ id: string }>("SELECT id FROM aleta_sipp_monitoring_results WHERE id = ? LIMIT 1", [decodeURIComponent(resultId || "").trim()]);
  if (!result) notFound("Hasil monitoring tidak ditemukan.");
  const { page, pageSize, offset } = pageInput(input);
  const where = ["result_id = ?"];
  const params: SqlInputValue[] = [result.id];
  if (input.status?.trim()) {
    where.push("item_status = ?");
    params.push(input.status.trim());
  }
  const whereSql = where.join(" AND ");
  const [rows, total] = await Promise.all([
    db.queryAll<Record<string, unknown>>(`SELECT * FROM aleta_sipp_monitoring_result_items WHERE ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`, [...params, pageSize, offset]),
    readCount(db, `SELECT COUNT(*) AS count FROM aleta_sipp_monitoring_result_items WHERE ${whereSql}`, params),
  ]);
  return { rows: rows.map((row) => ({ ...row, sourceData: asRecord(row.source_data_json) })), pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) } };
}

async function listMonitoringItems(
  db: AletaDatabase,
  actor: UserPersona,
  input: { runKey?: string; resultId?: string; groupKey?: string; status?: string; followupStatus?: string; q?: string; page?: number; pageSize?: number; limit?: number; offset?: number } = {}
) {
  requireAnyPermission(
    actor,
    [ALETA_SIPP_PERMISSION.VIEW_MONITORING_DETAIL, ALETA_SIPP_PERMISSION.VIEW_MONITORING],
    "Anda tidak memiliki izin melihat temuan monitoring."
  );
  const { page, pageSize, offset } = pageInput(input);
  const where = ["1 = 1"];
  const params: SqlInputValue[] = [];
  if (input.runKey?.trim()) {
    where.push("r.run_key = ?");
    params.push(decodeURIComponent(input.runKey).trim());
  }
  if (input.resultId?.trim()) {
    where.push("item.result_id = ?");
    params.push(decodeURIComponent(input.resultId).trim());
  }
  if (input.groupKey?.trim()) {
    where.push("f.group_key = ?");
    params.push(input.groupKey.trim());
  }
  if (input.status?.trim()) {
    where.push("item.item_status = ?");
    params.push(input.status.trim());
  }
  if (input.followupStatus?.trim()) {
    where.push("item.followup_status = ?");
    params.push(input.followupStatus.trim());
  }
  if (input.q?.trim()) {
    where.push("(LOWER(item.nomor_perkara) LIKE ? OR LOWER(item.item_title) LIKE ? OR LOWER(item.item_description) LIKE ? OR LOWER(i.indicator_name) LIKE ?)");
    const q = normalizeLike(input.q);
    params.push(q, q, q, q);
  }
  const whereSql = where.join(" AND ");
  const fromSql = `
    FROM aleta_sipp_monitoring_result_items item
    JOIN aleta_sipp_monitoring_results res ON res.id = item.result_id
    JOIN aleta_sipp_monitoring_indicators i ON i.id = res.indicator_id
    JOIN aleta_sipp_monitoring_runs r ON r.id = res.run_id
    LEFT JOIN aleta_sipp_legacy_feature_catalog f ON f.related_indicator_key = i.indicator_key AND f.is_active = 1
  `;
  const [rows, total] = await Promise.all([
    db.queryAll<Record<string, unknown>>(
      `
      SELECT item.*, res.status AS result_status, res.score_percent, res.query_key,
        i.indicator_key, i.indicator_name, i.category, i.source_type,
        r.run_key, r.run_type, r.date_start, r.date_end,
        f.feature_key, f.feature_name, f.group_key, f.group_name
      ${fromSql}
      WHERE ${whereSql}
      ORDER BY item.created_at DESC
      LIMIT ? OFFSET ?
      `,
      [...params, pageSize, offset]
    ),
    readCount(db, `SELECT COUNT(*) AS count ${fromSql} WHERE ${whereSql}`, params),
  ]);
  return {
    rows: rows.map((row) => ({
      ...row,
      id: String(row.id ?? ""),
      resultId: String(row.result_id ?? ""),
      runKey: String(row.run_key ?? ""),
      indicatorKey: String(row.indicator_key ?? ""),
      indicatorName: String(row.indicator_name ?? ""),
      featureKey: String(row.feature_key ?? ""),
      featureName: String(row.feature_name ?? ""),
      groupKey: String(row.group_key ?? ""),
      groupName: String(row.group_name ?? ""),
      sourceData: asRecord(row.source_data_json),
    })),
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  };
}

async function updateMonitoringItemFollowUp(
  db: AletaDatabase,
  actor: UserPersona,
  itemId: string,
  input: { followupStatus?: string; itemStatus?: string; adminNotes?: string } = {}
) {
  requirePermission(actor, ALETA_SIPP_PERMISSION.MANAGE_FOLLOWUP, "Anda tidak memiliki izin memperbarui tindak lanjut temuan monitoring.");
  const id = decodeURIComponent(itemId || "").trim();
  if (!id) badRequest("itemId wajib diisi.");
  const row = await db.queryOne<Record<string, unknown>>("SELECT * FROM aleta_sipp_monitoring_result_items WHERE id = ? LIMIT 1", [id]);
  if (!row) notFound("Temuan monitoring tidak ditemukan.");
  const followupStatus = (input.followupStatus?.trim() || String(row.followup_status ?? "BELUM_DITINDAKLANJUTI")).toUpperCase();
  if (!FOLLOWUP_STATUSES.has(followupStatus)) badRequest("Status tindak lanjut tidak dikenal.");
  const itemStatus = input.itemStatus?.trim() ? input.itemStatus.trim().toUpperCase() : String(row.item_status ?? "BELUM_DITINDAKLANJUTI");
  const adminNotes = input.adminNotes === undefined ? String(row.admin_notes ?? "") : input.adminNotes;
  const now = new Date().toISOString();
  const completedAt = COMPLETED_FOLLOWUP_STATUSES.has(followupStatus) ? now : null;
  await db.run(
    `
    UPDATE aleta_sipp_monitoring_result_items
    SET followup_status = ?, item_status = ?, admin_notes = ?, completed_at = ?, updated_by = ?, updated_at = ?
    WHERE id = ?
    `,
    [followupStatus, itemStatus, adminNotes, completedAt, actor.id, now, id]
  );
  await appendAuditLog(db, {
    id: await nextPrefixedId(db, "audit_logs", "adt"),
    actorUserId: actor.id,
    action: "aleta_sipp.monitoring.item_followup",
    entityType: "aleta_sipp_monitoring_result_item",
    entityId: id,
    payload: { followupStatus, itemStatus, adminNotes },
  });
  return db.queryOne<Record<string, unknown>>("SELECT * FROM aleta_sipp_monitoring_result_items WHERE id = ? LIMIT 1", [id]);
}

async function getTriwulanOptions(db: AletaDatabase, actor: UserPersona, yearInput?: number) {
  requireAnyPermission(
    actor,
    [ALETA_SIPP_PERMISSION.VIEW_SK_ASSESSMENT, ALETA_SIPP_PERMISSION.VIEW_ASSESSMENT],
    "Anda tidak memiliki izin melihat opsi penilaian SK SIPP."
  );
  const year = Number(yearInput || new Date().getFullYear());
  const options = [];
  for (const quarter of [1, 2, 3, 4]) {
    const range = quarterRange(year, quarter);
    const lastRun = await db.queryOne<Record<string, unknown>>(
      "SELECT run_key, status, score_percent, finished_at, created_at FROM aleta_sipp_monitoring_runs WHERE run_type = 'SK_TRIWULAN_ASSESSMENT' AND year = ? AND quarter = ? ORDER BY created_at DESC LIMIT 1",
      [year, quarter]
    );
    options.push({ label: `Triwulan ${quarter}`, ...range, lastRun });
  }
  return {
    defaultYear: year,
    officialSkPeriodicity: "dua_minggu",
    note: "Asumsi triwulan kalender karena definisi triwulan tidak ditemukan dalam SK.",
    options,
  };
}

async function saveManualInput(
  db: AletaDatabase,
  actor: UserPersona,
  input: { indicatorKey?: string; periodStart?: string; periodEnd?: string; value?: unknown; notes?: string; status?: string; evidence?: unknown }
) {
  requireAnyPermission(
    actor,
    [ALETA_SIPP_PERMISSION.MANAGE_MANUAL_INPUT, ALETA_SIPP_PERMISSION.INPUT_PENDUKUNG2018_MANUAL, ALETA_SIPP_PERMISSION.MANAGE_ASSESSMENT],
    "Anda tidak memiliki izin menyimpan input manual monitoring."
  );
  const indicatorKey = input.indicatorKey?.trim() ?? "";
  if (!indicatorKey) badRequest("indicatorKey wajib diisi.");
  const indicator = await db.queryOne<{ id: string }>("SELECT id FROM aleta_sipp_monitoring_indicators WHERE indicator_key = ? LIMIT 1", [indicatorKey]);
  if (!indicator) notFound("Indikator monitoring tidak ditemukan.");
  const now = new Date().toISOString();
  const status = (input.status?.trim() || "DRAFT").toUpperCase();
  if (!MANUAL_INPUT_STATUSES.has(status)) badRequest("Status input manual tidak dikenal.");
  const evidence = Array.isArray(input.evidence) ? input.evidence : input.evidence === undefined ? [] : [input.evidence];
  const submittedAt = status === "SUBMITTED" ? now : null;
  const id = await nextPrefixedId(db, "aleta_sipp_monitoring_manual_inputs", "sipp-mon-manual");
  await db.run(
    `
    INSERT INTO aleta_sipp_monitoring_manual_inputs (
      id, indicator_id, period_start, period_end, value_json, notes, status, evidence_json,
      submitted_at, created_by, updated_by, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?::jsonb, ?, ?, ?::jsonb, ?, ?, ?, ?, ?)
    `,
    [id, indicator.id, input.periodStart || "", input.periodEnd || "", jsonString(input.value ?? {}), input.notes || "", status, jsonString(evidence), submittedAt, actor.id, actor.id, now, now]
  );
  await appendAuditLog(db, {
    id: await nextPrefixedId(db, "audit_logs", "adt"),
    actorUserId: actor.id,
    action: "aleta_sipp.monitoring.manual_input_save",
    entityType: "aleta_sipp_monitoring_manual_input",
    entityId: id,
    payload: { indicatorKey, status, periodStart: input.periodStart || "", periodEnd: input.periodEnd || "", evidenceCount: evidence.length },
  });
  return { id, indicatorKey, status, submittedAt, createdAt: now };
}

async function reviewManualInput(
  db: AletaDatabase,
  actor: UserPersona,
  inputId: string,
  input: { status?: string; reviewNotes?: string } = {}
) {
  requireAnyPermission(
    actor,
    [ALETA_SIPP_PERMISSION.MANAGE_MANUAL_INPUT, ALETA_SIPP_PERMISSION.MANAGE_ASSESSMENT],
    "Anda tidak memiliki izin mereview input manual monitoring."
  );
  const id = decodeURIComponent(inputId || "").trim();
  if (!id) badRequest("inputId wajib diisi.");
  const row = await db.queryOne<Record<string, unknown>>(
    `
    SELECT manual.*, i.indicator_key, i.indicator_name
    FROM aleta_sipp_monitoring_manual_inputs manual
    JOIN aleta_sipp_monitoring_indicators i ON i.id = manual.indicator_id
    WHERE manual.id = ?
    LIMIT 1
    `,
    [id]
  );
  if (!row) notFound("Input manual monitoring tidak ditemukan.");
  const status = (input.status?.trim() || String(row.status ?? "REVIEWED")).toUpperCase();
  if (!MANUAL_INPUT_STATUSES.has(status)) badRequest("Status review input manual tidak dikenal.");
  const now = new Date().toISOString();
  const reviewedAt = REVIEWED_MANUAL_INPUT_STATUSES.has(status) ? now : null;
  const reviewedBy = reviewedAt ? actor.id : null;
  const submittedAt = status === "SUBMITTED" && !row.submitted_at ? now : row.submitted_at ? String(row.submitted_at) : null;
  const reviewNotes = input.reviewNotes === undefined ? String(row.review_notes ?? "") : input.reviewNotes;
  await db.run(
    `
    UPDATE aleta_sipp_monitoring_manual_inputs
    SET status = ?, submitted_at = ?, reviewed_by = ?, reviewed_at = ?, review_notes = ?, updated_by = ?, updated_at = ?
    WHERE id = ?
    `,
    [status, submittedAt, reviewedBy, reviewedAt, reviewNotes, actor.id, now, id]
  );
  await appendAuditLog(db, {
    id: await nextPrefixedId(db, "audit_logs", "adt"),
    actorUserId: actor.id,
    action: "aleta_sipp.monitoring.manual_input_review",
    entityType: "aleta_sipp_monitoring_manual_input",
    entityId: id,
    payload: { status, reviewNotes, indicatorKey: row.indicator_key },
  });
  return db.queryOne<Record<string, unknown>>(
    `
    SELECT manual.*, i.indicator_key, i.indicator_name
    FROM aleta_sipp_monitoring_manual_inputs manual
    JOIN aleta_sipp_monitoring_indicators i ON i.id = manual.indicator_id
    WHERE manual.id = ?
    LIMIT 1
    `,
    [id]
  );
}

async function updateIndicatorFormulaConfig(
  db: AletaDatabase,
  actor: UserPersona,
  indicatorKey: string,
  input: {
    formulaType?: string;
    numeratorField?: string;
    denominatorField?: string;
    formulaText?: string;
    weight?: number;
    maxScore?: number;
    thresholdGreen?: number | null;
    thresholdYellow?: number | null;
    thresholdRed?: number | null;
    notes?: string;
  } = {}
) {
  requireAnyPermission(
    actor,
    [ALETA_SIPP_PERMISSION.MANAGE_MONITORING_FEATURES, ALETA_SIPP_PERMISSION.RUN_SK_ASSESSMENT, ALETA_SIPP_PERMISSION.MANAGE_ASSESSMENT],
    "Anda tidak memiliki izin mengatur formula indikator."
  );
  const key = decodeURIComponent(indicatorKey || "").trim();
  if (!key) badRequest("indicatorKey wajib diisi.");
  const row = await db.queryOne<MonitoringIndicatorRow>("SELECT * FROM aleta_sipp_monitoring_indicators WHERE indicator_key = ? AND is_active = 1 LIMIT 1", [key]);
  if (!row) notFound("Indikator monitoring tidak ditemukan.");
  const formulaType = (input.formulaType?.trim() || String(asRecord(row.formula_json).formulaType ?? "") || "percentage").toLowerCase();
  const allowedTypes = new Set(["percentage", "issue_count", "issue_list", "manual_score", "deduction"]);
  if (!allowedTypes.has(formulaType)) badRequest("Tipe formula tidak dikenal.");
  const formula = {
    ...asRecord(row.formula_json),
    formulaType,
    numeratorField: input.numeratorField?.trim() || "",
    denominatorField: input.denominatorField?.trim() || "",
    notes: input.notes?.trim() || "",
    configuredAt: new Date().toISOString(),
    configuredBy: actor.id,
  };
  const hasQuery = Boolean(row.query_key?.trim());
  const calculationMode = formulaType === "manual_score" ? "MANUAL_INPUT" : hasQuery ? "QUERY_REGISTRY" : "MANUAL_INPUT";
  const safetyStatus = formulaType === "manual_score"
    ? "PERLU_INPUT_MANUAL"
    : hasQuery ? (row.source_type === "SK_PENILAIAN_SIPP_2024" ? "READY_ASSESSMENT" : "READY_MONITORING") : "FORMULA_CONFIGURATION_REQUIRED";
  const now = new Date().toISOString();
  await db.run(
    `
    UPDATE aleta_sipp_monitoring_indicators
    SET formula_text = ?, formula_json = ?::jsonb, weight = ?, max_score = ?,
      threshold_green = ?, threshold_yellow = ?, threshold_red = ?,
      calculation_mode = ?, safety_status = ?, review_status = 'ADMIN_REVIEWED',
      risk_notes = ?, updated_by = ?, updated_at = ?
    WHERE id = ?
    `,
    [
      input.formulaText?.trim() || row.formula_text || `Formula ${formulaType} dikonfigurasi admin.`,
      jsonString(formula),
      typeof input.weight === "number" && Number.isFinite(input.weight) ? input.weight : numeric(row.weight),
      typeof input.maxScore === "number" && Number.isFinite(input.maxScore) ? input.maxScore : numeric(row.max_score) || 100,
      input.thresholdGreen === undefined ? row.threshold_green : input.thresholdGreen,
      input.thresholdYellow === undefined ? row.threshold_yellow : input.thresholdYellow,
      input.thresholdRed === undefined ? row.threshold_red : input.thresholdRed,
      calculationMode,
      safetyStatus,
      normalizeWhitespace([row.risk_notes, input.notes ? `Formula admin: ${input.notes}` : ""].filter(Boolean).join(" | "), 1600),
      actor.id,
      now,
      row.id,
    ]
  );
  await appendAuditLog(db, {
    id: await nextPrefixedId(db, "audit_logs", "adt"),
    actorUserId: actor.id,
    action: "aleta_sipp.monitoring.indicator_formula_config",
    entityType: "aleta_sipp_monitoring_indicator",
    entityId: row.id,
    payload: { indicatorKey: key, formulaType, calculationMode, safetyStatus },
  });
  return getIndicatorDetail(db, actor, key);
}

async function listExternalConnectors(db: AletaDatabase, actor: UserPersona) {
  requireAnyPermission(
    actor,
    [ALETA_SIPP_PERMISSION.VIEW_MONITORING, ALETA_SIPP_PERMISSION.MANAGE_MONITORING_FEATURES],
    "Anda tidak memiliki izin melihat konektor eksternal monitoring."
  );
  await ensurePendukung2018FeatureCatalog(db, actor);
  const features = await db.queryAll<Pendukung2018FeatureCatalogRow>(
    `
    SELECT *
    FROM aleta_sipp_legacy_feature_catalog f
    WHERE f.is_active = 1
      AND (f.external_dependency <> '' OR f.implementation_status = 'EXTERNAL_CONNECTOR_WAITING_CONFIG' OR f.safety_status = 'EXTERNAL_CONNECTOR_REQUIRED')
    ORDER BY f.sort_order
    `
  );
  const sources = await db.queryAll<Record<string, unknown>>("SELECT * FROM aleta_sipp_monitoring_sources WHERE source_type = 'EXTERNAL_CONNECTOR'");
  const sourceByFeature = new Map(sources.map((source) => [String(asRecord(source.summary_json).featureKey ?? ""), source]));
  return {
    rows: features.map((feature) => {
      const source = sourceByFeature.get(feature.feature_key) ?? null;
      const summary = asRecord(source?.summary_json);
      return {
        featureKey: feature.feature_key,
        featureName: feature.feature_name,
        groupName: feature.group_name,
        connectorName: String(summary.connectorName ?? feature.external_dependency ?? feature.feature_name),
        sourceKey: String(source?.source_key ?? ""),
        endpoint: String(summary.endpoint ?? ""),
        host: String(summary.host ?? ""),
        mode: String(summary.mode ?? "READ_ONLY"),
        credentialReference: String(summary.credentialReference ?? ""),
        secretVisible: false,
        status: String(source?.status ?? "MENUNGGU_KONFIGURASI"),
        lastCheckedAt: summary.lastCheckedAt ?? null,
        updatedAt: source?.updated_at ?? null,
      };
    }),
  };
}

async function saveExternalConnectorConfig(
  db: AletaDatabase,
  actor: UserPersona,
  featureKey: string,
  input: { connectorName?: string; endpoint?: string; host?: string; mode?: string; credentialReference?: string; status?: string; testConnection?: boolean } = {}
) {
  requirePermission(actor, ALETA_SIPP_PERMISSION.MANAGE_MONITORING_FEATURES, "Anda tidak memiliki izin mengatur konektor eksternal.");
  const key = decodeURIComponent(featureKey || "").trim();
  if (!key) badRequest("featureKey wajib diisi.");
  const feature = await db.queryOne<Pendukung2018FeatureCatalogRow>("SELECT * FROM aleta_sipp_legacy_feature_catalog WHERE feature_key = ? AND is_active = 1 LIMIT 1", [key]);
  if (!feature) notFound("Fitur konektor eksternal tidak ditemukan.");
  const now = new Date().toISOString();
  const sourceKey = `EXTERNAL_${feature.feature_key}`.replace(/[^A-Z0-9_]/gi, "_").toUpperCase();
  const mode = (input.mode?.trim() || "READ_ONLY").toUpperCase();
  if (mode !== "READ_ONLY") badRequest("Konektor eksternal hanya boleh mode READ_ONLY.");
  const endpoint = input.endpoint?.trim() || "";
  const host = input.host?.trim() || "";
  const configured = Boolean(endpoint || host);
  const status = input.testConnection
    ? configured ? "SIAP_READ_ONLY" : "GAGAL_KONEKSI"
    : input.status?.trim().toUpperCase() || (configured ? "TERKONFIGURASI" : "MENUNGGU_KONFIGURASI");
  const summary = {
    featureKey: feature.feature_key,
    connectorName: input.connectorName?.trim() || feature.external_dependency || feature.feature_name,
    endpoint,
    host,
    mode,
    credentialReference: input.credentialReference?.trim() || "",
    secretVisible: false,
    lastCheckedAt: input.testConnection ? now : null,
    testMessage: input.testConnection ? configured ? "Konfigurasi read-only tersedia; uji koneksi runtime dapat dilakukan oleh bridge resmi." : "Endpoint/host belum dikonfigurasi." : "",
    updatedBy: actor.id,
  };
  await db.run(
    `
    INSERT INTO aleta_sipp_monitoring_sources (
      id, source_key, source_type, source_name, source_path, source_version, status,
      summary_json, created_at, updated_at
    )
    VALUES (?, ?, 'EXTERNAL_CONNECTOR', ?, ?, 'read_only_config', ?, ?::jsonb, ?, ?)
    ON CONFLICT (source_key) DO UPDATE SET
      source_name = EXCLUDED.source_name,
      source_path = EXCLUDED.source_path,
      status = EXCLUDED.status,
      summary_json = EXCLUDED.summary_json,
      updated_at = EXCLUDED.updated_at
    `,
    [stableId("sipp_external_connector", sourceKey), sourceKey, summary.connectorName, endpoint || host, status, jsonString(summary), now, now]
  );
  await db.run(
    `
    UPDATE aleta_sipp_legacy_feature_catalog
    SET implementation_status = 'EXTERNAL_CONNECTOR_WAITING_CONFIG',
      safety_status = 'EXTERNAL_CONNECTOR_REQUIRED',
      review_status = 'AUTO_REVIEWED',
      admin_notes = ?, updated_by = ?, updated_at = ?
    WHERE id = ?
    `,
    [configured ? "Konektor eksternal sudah memiliki konfigurasi metadata read-only." : "Konektor eksternal menunggu endpoint/host read-only.", actor.id, now, feature.id]
  );
  await appendAuditLog(db, {
    id: await nextPrefixedId(db, "audit_logs", "adt"),
    actorUserId: actor.id,
    action: input.testConnection ? "aleta_sipp.monitoring.external_connector_test" : "aleta_sipp.monitoring.external_connector_config",
    entityType: "aleta_sipp_monitoring_source",
    entityId: sourceKey,
    payload: { featureKey: key, status, mode, hasEndpoint: Boolean(endpoint), hasHost: Boolean(host), credentialReference: Boolean(summary.credentialReference) },
  });
  return { sourceKey, status, summary };
}

type MonitoringExportPayload = {
  body: ArrayBuffer;
  contentType: string;
  filename: string;
};

function toArrayBuffer(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

async function runExportRows(db: AletaDatabase, runId: string) {
  const [results, items] = await Promise.all([
    db.queryAll<Record<string, unknown>>(
      `
      SELECT res.*, i.indicator_key, i.indicator_code, i.indicator_name, i.category, i.source_type,
        i.safety_status, i.review_status
      FROM aleta_sipp_monitoring_results res
      JOIN aleta_sipp_monitoring_indicators i ON i.id = res.indicator_id
      WHERE res.run_id = ?
      ORDER BY i.source_type, i.category, i.indicator_name
      LIMIT 1000
      `,
      [runId]
    ),
    db.queryAll<Record<string, unknown>>(
      `
      SELECT item.*, i.indicator_key, i.indicator_name, i.category, res.status AS result_status
      FROM aleta_sipp_monitoring_result_items item
      JOIN aleta_sipp_monitoring_results res ON res.id = item.result_id
      JOIN aleta_sipp_monitoring_indicators i ON i.id = res.indicator_id
      WHERE res.run_id = ?
      ORDER BY item.created_at DESC
      LIMIT 500
      `,
      [runId]
    ),
  ]);
  return { results, items };
}

async function groupExportRows(db: AletaDatabase, groupKeyInput: string) {
  const groupKey = decodeURIComponent(groupKeyInput || "").trim().toUpperCase();
  if (!groupKey) badRequest("groupKey wajib diisi.");
  const group = PENDUKUNG2018_GROUPS.find((item) => item.groupKey === groupKey);
  if (!group) notFound("Grup monitoring tidak ditemukan.");
  const [features, items] = await Promise.all([
    db.queryAll<Record<string, unknown>>(
      `
      SELECT f.*,
        lr.run_key AS latest_run_key,
        lr.result_id AS latest_result_id,
        lr.status AS latest_result_status,
        lr.score_percent AS latest_score_percent,
        lr.result_summary AS latest_result_summary,
        COALESCE(item_counts.item_count, 0) AS item_count
      FROM aleta_sipp_legacy_feature_catalog f
      LEFT JOIN LATERAL (
        SELECT r.run_key, res.id AS result_id, res.status, res.score_percent, res.result_summary
        FROM aleta_sipp_monitoring_indicators i
        JOIN aleta_sipp_monitoring_results res ON res.indicator_id = i.id
        JOIN aleta_sipp_monitoring_runs r ON r.id = res.run_id
        WHERE i.indicator_key = f.related_indicator_key
        ORDER BY res.created_at DESC
        LIMIT 1
      ) lr ON TRUE
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS item_count
        FROM aleta_sipp_monitoring_result_items item
        WHERE item.result_id = lr.result_id
      ) item_counts ON TRUE
      WHERE f.group_key = ? AND f.source_type = 'PENDUKUNG2018' AND f.is_active = 1
      ORDER BY f.sort_order
      `,
      [groupKey]
    ),
    db.queryAll<Record<string, unknown>>(
      `
      SELECT item.*, res.status AS result_status, res.score_percent,
        i.indicator_key, i.indicator_name, i.category,
        r.run_key, r.date_start, r.date_end,
        f.feature_key, f.feature_name, f.group_key, f.group_name
      FROM aleta_sipp_monitoring_result_items item
      JOIN aleta_sipp_monitoring_results res ON res.id = item.result_id
      JOIN aleta_sipp_monitoring_indicators i ON i.id = res.indicator_id
      JOIN aleta_sipp_monitoring_runs r ON r.id = res.run_id
      JOIN aleta_sipp_legacy_feature_catalog f ON f.related_indicator_key = i.indicator_key AND f.is_active = 1
      WHERE f.group_key = ?
      ORDER BY item.created_at DESC
      LIMIT 1000
      `,
      [groupKey]
    ),
  ]);
  return { groupKey, groupName: monitoringGroupName(groupKey, group?.groupName), features, items };
}

function exportBaseName(runKey: string) {
  return slugKey(runKey, 120).replace(/_/g, "-") || "aleta-sipp-monitoring";
}

function createMonitoringXlsx(detail: Record<string, unknown>, results: Record<string, unknown>[], items: Record<string, unknown>[]) {
  const sheets: XlsxSheet[] = [
    {
      name: "Ringkasan Run",
      columns: [
        { key: "field", header: "Field", width: 28 },
        { key: "value", header: "Nilai", width: 52 },
      ],
      rows: [
        { field: "Run Key", value: String(detail.run_key ?? "") },
        { field: "Run Type", value: String(detail.run_type ?? "") },
        { field: "Status", value: String(detail.status ?? "") },
        { field: "Tahun", value: String(detail.year ?? "") },
        { field: "Triwulan", value: String(detail.quarter ?? "") },
        { field: "Periode", value: `${String(detail.date_start ?? "")} - ${String(detail.date_end ?? "")}` },
        { field: "Skor Total", value: Number(detail.score_total ?? 0) },
        { field: "Skor Maksimal", value: Number(detail.score_max ?? 0) },
        { field: "Persentase", value: Number(detail.score_percent ?? 0) },
        { field: "Hijau", value: Number(detail.green_count ?? 0) },
        { field: "Kuning", value: Number(detail.yellow_count ?? 0) },
        { field: "Merah", value: Number(detail.red_count ?? 0) },
        { field: "Query Not Ready", value: Number(detail.query_not_ready_count ?? 0) },
        { field: "Data Tidak Cukup", value: Number(detail.data_not_enough_count ?? 0) },
      ],
      autoFilter: false,
      freezeHeader: true,
    },
    {
      name: "Hasil Indikator",
      columns: [
        { key: "indicatorKey", header: "Indicator Key", width: 34 },
        { key: "indicatorName", header: "Indikator", width: 42 },
        { key: "sourceType", header: "Sumber", width: 22 },
        { key: "category", header: "Kategori", width: 22 },
        { key: "status", header: "Status", width: 20 },
        { key: "scorePercent", header: "Skor %", width: 14 },
        { key: "score", header: "Skor", width: 14 },
        { key: "weightedScore", header: "Skor Bobot", width: 14 },
        { key: "queryKey", header: "Query Key", width: 36 },
        { key: "summary", header: "Ringkasan", width: 70 },
      ],
      rows: results.map((row) => ({
        indicatorKey: String(row.indicator_key ?? ""),
        indicatorName: String(row.indicator_name ?? ""),
        sourceType: String(row.source_type ?? ""),
        category: String(row.category ?? ""),
        status: String(row.status ?? ""),
        scorePercent: Number(row.score_percent ?? 0),
        score: Number(row.score ?? 0),
        weightedScore: Number(row.weighted_score ?? 0),
        queryKey: String(row.query_key ?? ""),
        summary: String(row.result_summary ?? ""),
      })),
      freezeHeader: true,
    },
    {
      name: "Temuan Drilldown",
      columns: [
        { key: "indicatorKey", header: "Indicator Key", width: 34 },
        { key: "indicatorName", header: "Indikator", width: 42 },
        { key: "nomorPerkara", header: "Nomor Perkara", width: 34 },
        { key: "perkaraId", header: "Perkara ID", width: 18 },
        { key: "title", header: "Judul Item", width: 42 },
        { key: "description", header: "Deskripsi", width: 70 },
        { key: "status", header: "Status Item", width: 22 },
        { key: "role", header: "Role", width: 22 },
        { key: "name", header: "Nama", width: 26 },
        { key: "sourceTable", header: "Source Table", width: 22 },
        { key: "recommendation", header: "Rekomendasi", width: 70 },
      ],
      rows: items.map((row) => ({
        indicatorKey: String(row.indicator_key ?? ""),
        indicatorName: String(row.indicator_name ?? ""),
        nomorPerkara: String(row.nomor_perkara ?? ""),
        perkaraId: String(row.perkara_id ?? ""),
        title: String(row.item_title ?? ""),
        description: String(row.item_description ?? ""),
        status: String(row.item_status ?? ""),
        role: String(row.responsible_role ?? ""),
        name: String(row.responsible_name ?? ""),
        sourceTable: String(row.source_table ?? ""),
        recommendation: String(row.recommendation ?? ""),
      })),
      freezeHeader: true,
    },
    {
      name: "Query Status",
      columns: [
        { key: "indicatorKey", header: "Indicator Key", width: 34 },
        { key: "queryKey", header: "Query Key", width: 38 },
        { key: "resultStatus", header: "Result Status", width: 22 },
        { key: "safetyStatus", header: "Safety Status", width: 22 },
        { key: "reviewStatus", header: "Review Status", width: 24 },
        { key: "error", header: "Error", width: 60 },
      ],
      rows: results.map((row) => ({
        indicatorKey: String(row.indicator_key ?? ""),
        queryKey: String(row.query_key ?? ""),
        resultStatus: String(row.status ?? ""),
        safetyStatus: String(row.safety_status ?? ""),
        reviewStatus: String(row.review_status ?? ""),
        error: String(row.error_message ?? ""),
      })),
      freezeHeader: true,
    },
    {
      name: "Rekomendasi",
      columns: [
        { key: "indicatorKey", header: "Indicator Key", width: 34 },
        { key: "indicatorName", header: "Indikator", width: 42 },
        { key: "status", header: "Status", width: 20 },
        { key: "recommendation", header: "Rekomendasi", width: 90 },
      ],
      rows: results.map((row) => ({
        indicatorKey: String(row.indicator_key ?? ""),
        indicatorName: String(row.indicator_name ?? ""),
        status: String(row.status ?? ""),
        recommendation: String(row.recommendation ?? ""),
      })),
      freezeHeader: true,
    },
  ];
  return createXlsxWorkbook(sheets, { creator: "ALETA x SIPP" });
}

function createGroupMonitoringXlsx(group: { groupKey: string; groupName: string }, features: Record<string, unknown>[], items: Record<string, unknown>[]) {
  const total = features.length;
  const ready = features.filter((row) => String(row.implementation_status ?? "") === "READY_READ_ONLY").length;
  const needsReview = features.filter((row) => String(row.review_status ?? "") === "NEEDS_ADMIN_REVIEW" || String(row.safety_status ?? "") === "NEEDS_REVIEW").length;
  const manual = features.filter((row) => String(row.safety_status ?? "") === "PERLU_INPUT_MANUAL").length;
  const external = features.filter((row) => String(row.safety_status ?? "") === "EXTERNAL_CONNECTOR_REQUIRED").length;
  const sheets: XlsxSheet[] = [
    {
      name: "Ringkasan Grup",
      columns: [
        { key: "field", header: "Field", width: 28 },
        { key: "value", header: "Nilai", width: 56 },
      ],
      rows: [
        { field: "Grup", value: group.groupName },
        { field: "Group Key", value: group.groupKey },
        { field: "Total Fitur", value: total },
        { field: "Ready Read-only", value: ready },
        { field: "Perlu Review", value: needsReview },
        { field: "Manual Input", value: manual },
        { field: "Konektor Eksternal", value: external },
        { field: "Temuan Terakhir", value: items.length },
        { field: "Dibuat", value: new Date().toISOString() },
      ],
      freezeHeader: true,
    },
    {
      name: "Katalog Fitur",
      columns: [
        { key: "featureCode", header: "Kode", width: 16 },
        { key: "featureName", header: "Fitur", width: 46 },
        { key: "implementationStatus", header: "Implementasi", width: 24 },
        { key: "safetyStatus", header: "Safety", width: 24 },
        { key: "reviewStatus", header: "Review", width: 24 },
        { key: "queryKey", header: "Query Key", width: 38 },
        { key: "indicatorKey", header: "Indicator Key", width: 38 },
        { key: "latestRunKey", header: "Run Terakhir", width: 38 },
        { key: "latestStatus", header: "Status Terakhir", width: 20 },
        { key: "latestScore", header: "Skor %", width: 14 },
        { key: "itemCount", header: "Jumlah Temuan", width: 18 },
        { key: "notes", header: "Catatan", width: 70 },
      ],
      rows: features.map((row) => ({
        featureCode: String(row.feature_code ?? ""),
        featureName: String(row.feature_name ?? ""),
        implementationStatus: String(row.implementation_status ?? ""),
        safetyStatus: String(row.safety_status ?? ""),
        reviewStatus: String(row.review_status ?? ""),
        queryKey: String(row.related_query_key ?? ""),
        indicatorKey: String(row.related_indicator_key ?? ""),
        latestRunKey: String(row.latest_run_key ?? ""),
        latestStatus: String(row.latest_result_status ?? ""),
        latestScore: row.latest_score_percent === null || row.latest_score_percent === undefined ? "" : Number(row.latest_score_percent),
        itemCount: Number(row.item_count ?? 0),
        notes: String(row.no_query_reason ?? row.risk_notes ?? ""),
      })),
      freezeHeader: true,
    },
    {
      name: "Temuan",
      columns: [
        { key: "runKey", header: "Run Key", width: 38 },
        { key: "featureName", header: "Fitur", width: 42 },
        { key: "indicatorName", header: "Indikator", width: 42 },
        { key: "nomorPerkara", header: "Nomor Perkara", width: 34 },
        { key: "title", header: "Judul Temuan", width: 42 },
        { key: "description", header: "Deskripsi", width: 72 },
        { key: "itemStatus", header: "Status Item", width: 22 },
        { key: "followupStatus", header: "Tindak Lanjut", width: 22 },
        { key: "recommendation", header: "Rekomendasi", width: 72 },
      ],
      rows: items.map((row) => ({
        runKey: String(row.run_key ?? ""),
        featureName: String(row.feature_name ?? ""),
        indicatorName: String(row.indicator_name ?? ""),
        nomorPerkara: String(row.nomor_perkara ?? ""),
        title: String(row.item_title ?? ""),
        description: String(row.item_description ?? ""),
        itemStatus: String(row.item_status ?? ""),
        followupStatus: String(row.followup_status ?? ""),
        recommendation: String(row.recommendation ?? ""),
      })),
      freezeHeader: true,
    },
  ];
  return createXlsxWorkbook(sheets, { creator: "ALETA x SIPP" });
}

function drawWrappedText(page: import("pdf-lib").PDFPage, text: string, x: number, y: number, options: { font: import("pdf-lib").PDFFont; size: number; maxWidth: number; lineHeight: number; color?: import("pdf-lib").RGB }) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  let line = "";
  let cursorY = y;
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (options.font.widthOfTextAtSize(candidate, options.size) > options.maxWidth && line) {
      page.drawText(line, { x, y: cursorY, size: options.size, font: options.font, color: options.color ?? rgb(0.12, 0.16, 0.22) });
      cursorY -= options.lineHeight;
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) {
    page.drawText(line, { x, y: cursorY, size: options.size, font: options.font, color: options.color ?? rgb(0.12, 0.16, 0.22) });
    cursorY -= options.lineHeight;
  }
  return cursorY;
}

async function createMonitoringPdf(detail: Record<string, unknown>, results: Record<string, unknown>[], items: Record<string, unknown>[]) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([595.28, 841.89]);
  let y = 790;
  const margin = 48;
  const maxWidth = 500;
  const newPageIfNeeded = (needed = 80) => {
    if (y > needed) return;
    page = pdf.addPage([595.28, 841.89]);
    y = 790;
  };

  page.drawText("Laporan Monitoring ALETA x SIPP", { x: margin, y, size: 18, font: bold, color: rgb(0.08, 0.18, 0.32) });
  y -= 28;
  y = drawWrappedText(page, `Run ${String(detail.run_key ?? "")} | ${String(detail.run_type ?? "")} | ${String(detail.date_start ?? "")} sampai ${String(detail.date_end ?? "")}`, margin, y, { font: regular, size: 10, maxWidth, lineHeight: 14 });
  y -= 12;
  const summaryLines = [
    `Status: ${String(detail.status ?? "")}`,
    `Skor: ${Number(detail.score_total ?? 0).toFixed(2)} / ${Number(detail.score_max ?? 0).toFixed(2)} (${Number(detail.score_percent ?? 0).toFixed(2)}%)`,
    `Hijau/Kuning/Merah: ${String(detail.green_count ?? 0)} / ${String(detail.yellow_count ?? 0)} / ${String(detail.red_count ?? 0)}`,
    `Query Not Ready: ${String(detail.query_not_ready_count ?? 0)} | Data Tidak Cukup: ${String(detail.data_not_enough_count ?? 0)}`,
  ];
  for (const line of summaryLines) {
    page.drawText(line, { x: margin, y, size: 10, font: regular, color: rgb(0.12, 0.16, 0.22) });
    y -= 16;
  }

  y -= 14;
  page.drawText("Indikator Merah/Kuning", { x: margin, y, size: 13, font: bold, color: rgb(0.08, 0.18, 0.32) });
  y -= 20;
  for (const row of results.filter((item) => ["MERAH", "KUNING", "ERROR", "DATA_TIDAK_CUKUP", "QUERY_NOT_READY"].includes(String(item.status ?? ""))).slice(0, 20)) {
    newPageIfNeeded();
    page.drawText(`${String(row.status ?? "")} - ${String(row.indicator_name ?? "")}`, { x: margin, y, size: 10, font: bold, color: rgb(0.12, 0.16, 0.22) });
    y -= 14;
    y = drawWrappedText(page, String(row.result_summary ?? ""), margin + 12, y, { font: regular, size: 9, maxWidth: maxWidth - 12, lineHeight: 12 });
    y = drawWrappedText(page, `Rekomendasi: ${String(row.recommendation ?? "")}`, margin + 12, y, { font: regular, size: 9, maxWidth: maxWidth - 12, lineHeight: 12, color: rgb(0.34, 0.25, 0.08) });
    y -= 8;
  }

  newPageIfNeeded(150);
  page.drawText("Temuan Penting", { x: margin, y, size: 13, font: bold, color: rgb(0.08, 0.18, 0.32) });
  y -= 20;
  for (const item of items.slice(0, 25)) {
    newPageIfNeeded();
    page.drawText(`${String(item.nomor_perkara ?? "-")} - ${String(item.item_title ?? "")}`, { x: margin, y, size: 10, font: bold, color: rgb(0.12, 0.16, 0.22) });
    y -= 14;
    y = drawWrappedText(page, String(item.item_description ?? ""), margin + 12, y, { font: regular, size: 9, maxWidth: maxWidth - 12, lineHeight: 12 });
    y -= 6;
  }

  return pdf.save();
}

async function createGroupMonitoringPdf(group: { groupKey: string; groupName: string }, features: Record<string, unknown>[], items: Record<string, unknown>[]) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([595.28, 841.89]);
  let y = 790;
  const margin = 48;
  const maxWidth = 500;
  const newPageIfNeeded = (needed = 80) => {
    if (y > needed) return;
    page = pdf.addPage([595.28, 841.89]);
    y = 790;
  };
  const ready = features.filter((row) => String(row.implementation_status ?? "") === "READY_READ_ONLY").length;
  const needsReview = features.filter((row) => String(row.review_status ?? "") === "NEEDS_ADMIN_REVIEW" || String(row.safety_status ?? "") === "NEEDS_REVIEW").length;
  const manual = features.filter((row) => String(row.safety_status ?? "") === "PERLU_INPUT_MANUAL").length;
  const external = features.filter((row) => String(row.safety_status ?? "") === "EXTERNAL_CONNECTOR_REQUIRED").length;

  page.drawText(`Monitoring SIPP - ${group.groupName}`, { x: margin, y, size: 18, font: bold, color: rgb(0.08, 0.18, 0.32) });
  y -= 28;
  for (const line of [
    `Total fitur: ${features.length}`,
    `Ready read-only: ${ready} | Perlu review: ${needsReview}`,
    `Manual input: ${manual} | Konektor eksternal: ${external}`,
    `Temuan terbaru: ${items.length}`,
  ]) {
    page.drawText(line, { x: margin, y, size: 10, font: regular, color: rgb(0.12, 0.16, 0.22) });
    y -= 16;
  }

  y -= 14;
  page.drawText("Fitur Belum Operasional Penuh", { x: margin, y, size: 13, font: bold, color: rgb(0.08, 0.18, 0.32) });
  y -= 20;
  for (const row of features.filter((item) => String(item.implementation_status ?? "") !== "READY_READ_ONLY").slice(0, 25)) {
    newPageIfNeeded();
    page.drawText(`${String(row.feature_code ?? "")} - ${String(row.feature_name ?? "")}`, { x: margin, y, size: 10, font: bold, color: rgb(0.12, 0.16, 0.22) });
    y -= 14;
    y = drawWrappedText(page, `${String(row.implementation_status ?? "")} | ${String(row.safety_status ?? "")} | ${String(row.no_query_reason ?? row.risk_notes ?? "")}`, margin + 12, y, { font: regular, size: 9, maxWidth: maxWidth - 12, lineHeight: 12 });
    y -= 6;
  }

  newPageIfNeeded(150);
  page.drawText("Temuan Terbaru", { x: margin, y, size: 13, font: bold, color: rgb(0.08, 0.18, 0.32) });
  y -= 20;
  for (const item of items.slice(0, 25)) {
    newPageIfNeeded();
    page.drawText(`${String(item.nomor_perkara ?? "-")} - ${String(item.item_title ?? "")}`, { x: margin, y, size: 10, font: bold, color: rgb(0.12, 0.16, 0.22) });
    y -= 14;
    y = drawWrappedText(page, String(item.item_description ?? ""), margin + 12, y, { font: regular, size: 9, maxWidth: maxWidth - 12, lineHeight: 12 });
    y -= 6;
  }

  return pdf.save();
}

async function exportRun(db: AletaDatabase, actor: UserPersona, runKey: string, exportType: "xlsx" | "pdf") {
  requirePermission(actor, ALETA_SIPP_PERMISSION.EXPORT_MONITORING, "Anda tidak memiliki izin export monitoring.");
  const detail = await getRunDetail(db, actor, runKey);
  const detailRecord = detail as Record<string, unknown>;
  const { results, items } = await runExportRows(db, String(detailRecord.id));
  const now = new Date().toISOString();
  const baseName = exportBaseName(runKey);
  const rawBody = exportType === "xlsx"
    ? createMonitoringXlsx(detailRecord, results, items)
    : await createMonitoringPdf(detailRecord, results, items);
  const body = toArrayBuffer(rawBody);
  const contentType = exportType === "xlsx"
    ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    : "application/pdf";
  const filename = `${baseName}.${exportType}`;
  await db.run(
    `
    INSERT INTO aleta_sipp_monitoring_exports (
      id, run_id, export_type, status, file_path, error_message, created_by, created_at
    )
    VALUES (?, ?, ?, 'SUCCESS', ?, NULL, ?, ?)
    `,
    [await nextPrefixedId(db, "aleta_sipp_monitoring_exports", "sipp-mon-export"), String(detailRecord.id), exportType, filename, actor.id, now]
  );
  await appendAuditLog(db, {
    id: await nextPrefixedId(db, "audit_logs", "adt"),
    actorUserId: actor.id,
    action: "aleta_sipp.monitoring.export",
    entityType: "aleta_sipp_monitoring_run",
    entityId: String(detailRecord.id),
    payload: { runKey, exportType, filename, resultRows: results.length, itemRows: items.length },
  });
  return { body, contentType, filename } satisfies MonitoringExportPayload;
}

async function exportGroup(db: AletaDatabase, actor: UserPersona, groupKey: string, exportType: "xlsx" | "pdf") {
  requireAnyPermission(
    actor,
    [ALETA_SIPP_PERMISSION.EXPORT_MONITORING, ALETA_SIPP_PERMISSION.EXPORT_PENDUKUNG2018_REPORTS],
    "Anda tidak memiliki izin export grup monitoring."
  );
  await ensurePendukung2018FeatureCatalog(db, actor);
  const group = await groupExportRows(db, groupKey);
  const rawBody = exportType === "xlsx"
    ? createGroupMonitoringXlsx(group, group.features, group.items)
    : await createGroupMonitoringPdf(group, group.features, group.items);
  const body = toArrayBuffer(rawBody);
  const contentType = exportType === "xlsx"
    ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    : "application/pdf";
  const filename = `aleta-sipp-${slugKey(group.groupName, 80).replace(/_/g, "-")}.${exportType}`;
  const now = new Date().toISOString();
  await db.run(
    `
    INSERT INTO aleta_sipp_monitoring_exports (
      id, run_id, export_type, status, file_path, error_message, created_by, created_at
    )
    VALUES (?, NULL, ?, 'SUCCESS', ?, NULL, ?, ?)
    `,
    [await nextPrefixedId(db, "aleta_sipp_monitoring_exports", "sipp-mon-export"), `group_${exportType}`, filename, actor.id, now]
  );
  await appendAuditLog(db, {
    id: await nextPrefixedId(db, "audit_logs", "adt"),
    actorUserId: actor.id,
    action: "aleta_sipp.monitoring.export_group",
    entityType: "aleta_sipp_feature_group",
    entityId: group.groupKey,
    payload: { groupKey: group.groupKey, exportType, filename, featureRows: group.features.length, itemRows: group.items.length },
  });
  return { body, contentType, filename } satisfies MonitoringExportPayload;
}

export const AletaSippMonitoringService = {
  paths: ALETA_SIPP_MONITORING_PATHS,
  importPendukung2018,
  importPendukung2018FeatureCatalog,
  importSkSipp,
  mapIndicators,
  runMonitoring,
  getMonitoringStats,
  listPendukung2018Features,
  getPendukung2018FeatureDetail,
  getPendukung2018GroupStats,
  reviewMonitoringFeatureQuery,
  autoReviewMonitoringQueries,
  listIndicators,
  getIndicatorDetail,
  updateIndicatorFormulaConfig,
  listExternalConnectors,
  saveExternalConnectorConfig,
  listRuns,
  getRunDetail,
  getRunResults,
  getResultItems,
  listMonitoringItems,
  updateMonitoringItemFollowUp,
  getTriwulanOptions,
  saveManualInput,
  reviewManualInput,
  exportRun,
  exportGroup,
};
