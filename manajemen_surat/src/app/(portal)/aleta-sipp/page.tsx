"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  BookOpenText,
  ChevronLeft,
  ChevronRight,
  Database,
  Download,
  Edit3,
  Eye,
  FileText,
  GitCompare,
  History,
  ListChecks,
  PlayCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  UploadCloud,
  Wand2,
  X,
} from "lucide-react";

import { PageIntro } from "@/components/portal/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiPath } from "@/lib/base-path";

type ApiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: { message?: string };
};

type AletaSippSummary = {
  generatedAt: string;
  access: {
    roleView: "superadmin" | "admin" | "operator" | "viewer";
    workstreamLabels: string[];
    isAdmin?: boolean;
    isSuperAdmin?: boolean;
  };
  datasource: {
    mode: string;
    label: string;
    readOnly: boolean;
    source: string;
    productionReady: boolean;
    connectionKey: string;
    bridgeBaseUrl: string;
    bridgeUrlSource: string;
    tokenConfigured: boolean;
    sqlDumpPath: string;
    localDbConfigured: boolean;
    notes: string[];
  };
  metadataStatus: "READY" | "BELUM_IMPORT_METADATA";
  counts: {
    tables: number;
    columns: number;
    relations: number;
    queries: number;
    variables: number;
    assessmentIndicators: number;
    importJobs: number;
  };
  lastImport?: {
    import_type: string;
    source_path: string;
    mode: string;
    status: string;
    started_at: string | null;
    finished_at: string | null;
    error_message: string | null;
  } | null;
  dictionaryPreview: Array<{
    id: string;
    tableName: string;
    humanName: string;
    category: string;
    priority: number;
    shortDescription: string;
    longDescription: string;
    functionInCaseProcess: string;
    tableKind: string;
    riskNotes: string[];
    columnCount: number;
    relationCount: number;
  }>;
  audit: {
    applications: Array<{
      name: string;
      path: string;
      exists: boolean;
      framework: string;
      language: string;
      database: string;
      queryFindings: number;
      writeRiskFindings: number;
      securityRisks: string[];
      reusableReferences: string[];
      doNotCopy: string[];
    }>;
    sql: {
      exists: boolean;
      sizeBytes: number;
      tableCount: number;
      columnCount: number;
      categories: Record<string, number>;
      focusTables: Array<{
        name: string;
        humanName: string;
        category: string;
        priority: 1 | 2 | 3;
        shortDescription: string;
        longDescription: string;
        functionInCaseProcess: string;
        columns: Array<{ name: string; type: string; notNull: boolean }>;
        keys: string[];
        relations: Array<{ column: string; targetTable: string; confidence: string; note: string }>;
        riskNotes: string[];
      }>;
    };
    abtXls: {
      exists: boolean;
      readMethod: string;
      variableCount: number;
      sqlQueryCount: number;
      placeholderCount: number;
      status: string;
      sheets: Array<{ name: string; rowCount: number; headers: string[] }>;
    };
    wordQueries: {
      exists: boolean;
      paragraphCount: number;
      queryCount: number;
      placeholders: string[];
      status: string;
      querySamples: Array<{ name: string; tables: string[]; parameters: string[]; status: string; preview: string }>;
    };
    assessmentPdf: {
      exists: boolean;
      pageCount: number;
      extractedChars: number;
      status: string;
    };
  };
  queryRegistry: Array<{
    queryId: string;
    queryKey: string;
    name: string;
    category: string;
    source: string;
    shortDescription: string;
    tables: string[];
    outputColumns: string[];
    parameters: Array<{ name: string; label: string; type: string; required: boolean; example?: string }>;
    normalizedSql: string;
    securityStatus: string;
    allowedForAi: boolean;
    allowedForWhatsapp: boolean;
    allowedForPdf: boolean;
    riskNotes: string[];
  }>;
  variableRegistryPreview: Array<{
    legacySource: string;
    legacyCode: string;
    modernKey: string;
    displayName: string;
    sourceType: string;
    status: string;
  }>;
  assessmentIndicators: Array<{ kode: string; nama: string; status: string; sourceHint: string }>;
  schedulePreview: Array<{
    nomorUrut: number;
    tanggalSidang?: string;
    nomorPerkara: string;
    paraPihak: string;
    majelis: string;
    panitera: string;
    agenda: string;
    ruangSidang: string;
    jamSidang: string;
  }>;
  safetyNotes: string[];
};

type DictionaryStats = {
  totalTables: number;
  totalColumns: number;
  totalRelations: number;
  analyzedTables: number;
  partialTables: number;
  needsReviewTables: number;
  unknownTables: number;
  lastAnalyzedAt: string | null;
};

type DictionaryTableListRow = {
  tableName: string;
  humanName: string;
  category: string;
  shortDescription: string;
  columnCount: number;
  relationCount: number;
  analysisStatus: string;
  confidenceScore: number;
  reviewStatus: string;
};

type DictionaryListResponse = {
  rows: DictionaryTableListRow[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  categories: Array<{ category: string; count: number }>;
};

type DictionaryDetail = {
  table: {
    tableName: string;
    humanName: string;
    category: string;
    shortDescription: string;
    longDescription: string;
    businessFunction: string;
    mainColumnsSummary: string;
    relationSummary: string;
    usageExamples: string[];
    dataQualityNotes: string;
    analysisStatus: string;
    confidenceScore: number;
    reviewStatus: string;
    reviewNotes: string;
    columnCount: number;
    relationCount: number;
  };
  longDescription: string;
  businessFunction: string;
  mainColumnsSummary: string;
  relationSummary: string;
  usageExamples: string[];
  dataQualityNotes: string;
  exampleQueries: string[];
  columns: Array<{
    columnName: string;
    humanName: string;
    dataType: string;
    isNullable: boolean;
    isPrimaryKey: boolean;
    isIndexed: boolean;
    defaultValue: string;
    relationHint: string;
    description: string;
    usageNotes: string;
    analysisStatus: string;
    confidenceScore: number;
  }>;
  relations: Array<{
    sourceTable: string;
    sourceColumn: string;
    targetTable: string;
    targetColumn: string;
    relationType: string;
    confidence: string;
    description: string;
  }>;
  relatedQueryRegistry: Array<{ queryKey: string; name: string; securityStatus: string; normalizedSql: string }>;
  relatedVariables: Array<{ modernKey: string; displayName: string; status: string }>;
  notes: {
    riskNotes: string[];
    reviewNotes: string;
  };
};

type AnalyzeBatchResult = {
  total: number;
  nextOffset: number;
  processed: number;
  failed: number;
  needsReview: number;
  finished: boolean;
  continueToken: string | null;
};

type RegistryPagination = {
  limit: number;
  offset: number;
  total: number;
};

type QueryRegistryRow = {
  id: string;
  queryKey: string;
  name: string;
  queryName?: string;
  category: string;
  sourceType?: string;
  sourceFile?: string;
  shortDescription: string;
  tables: string[];
  outputColumns: string[];
  normalizedSql: string;
  parameterizedSql?: string;
  sqlPreviewRedacted?: boolean;
  securityStatus: string;
  reviewStatus?: string;
  executionMode?: string;
  confidenceScore?: number;
  allowedForAi: boolean;
  allowedForWhatsapp: boolean;
  allowedForPdf: boolean;
};

type QueryRegistryListResponse = {
  rows: QueryRegistryRow[];
  pagination: RegistryPagination;
  categories: Array<{ category: string; count: number }>;
  sources: Array<{ sourceType: string; count: number }>;
  statusCounts: Record<string, number>;
};

type QueryRegistryStats = {
  total: number;
  safeReadOnly: number;
  needsReview: number;
  rejectedWrite: number;
  unsafeRawSql?: number;
  executableReadOnly: number;
  readyReadOnly?: number;
  dictionaryOnly?: number;
  tableLinks: number;
  variableLinks: number;
  categories: Array<{ category: string; count: number }>;
  sources: Array<{ sourceType: string; count: number }>;
  safetyStatuses?: Array<{ safetyStatus: string; count: number }>;
  executionModes?: Array<{ executionMode: string; count: number }>;
  reviews?: Array<{ reviewStatus: string; count: number }>;
};

type QueryRegistryDetail = QueryRegistryRow & {
  longDescription: string;
  businessPurpose?: string;
  sourceLocation?: string;
  sourceLine?: number | null;
  originalSql: string;
  riskNotes: string[];
  usageNotes?: string;
  registryParameters: Array<Record<string, unknown>>;
  registryOutputs: Array<Record<string, unknown>>;
  tableLinks: Array<Record<string, unknown>>;
  variableLinks: Array<Record<string, unknown>>;
};

type VariableRegistryRow = {
  id: string;
  variableKey: string;
  legacySource: string;
  legacyCode: string;
  legacyNumber?: number | null;
  modernKey: string;
  displayName: string;
  shortDescription?: string;
  longDescription?: string;
  category?: string;
  dataType: string;
  variableType?: string;
  sourceType: string;
  sourceTable: string;
  sourceColumn: string;
  sourceQueryKey?: string;
  sourceSqlFragment?: string;
  placeholderPattern?: string;
  mappingStatus?: string;
  reviewStatus?: string;
  confidenceScore?: number;
  status: string;
  usageNotes?: string;
  riskNotes?: string;
};

type VariableRegistryListResponse = {
  rows: VariableRegistryRow[];
  pagination: RegistryPagination;
  categories: Array<{ category: string; count: number }>;
  sources: Array<{ sourceType: string; count: number }>;
  statusCounts: Record<string, number>;
};

type VariableRegistryStats = {
  total: number;
  mapped: number;
  partial?: number;
  unresolved: number;
  conflict?: number;
  needsReview: number;
  templateLinks: number;
  categories: Array<{ category: string; count: number }>;
  sources: Array<{ sourceType: string; count: number }>;
  legacySources?: Array<{ legacySource: string; count: number }>;
  variableTypes?: Array<{ variableType: string; count: number }>;
  mappingStatuses?: Array<{ mappingStatus: string; count: number }>;
  reviews?: Array<{ reviewStatus: string; count: number }>;
};

type VariableRegistryDetail = VariableRegistryRow & {
  templateLinks: Array<Record<string, unknown>>;
  queryLinks: Array<Record<string, unknown>>;
  sourceQuery: QueryRegistryRow | null;
};

type ImportRegistryResult = {
  jobId: string;
  totalCandidates: number;
  imported: number;
  failed: number;
  rejected?: number;
  templateLinkCount?: number;
  unresolvedCount?: number;
  processed: number;
  nextOffset: number;
  finished: boolean;
  continueToken: string | null;
};

type ConvertLegacyTextResult = {
  convertedText: string;
  placeholders: Array<{
    legacyCode: string;
    replacement: string;
    displayName?: string;
    mappingStatus: string;
  }>;
  unresolved: Array<{
    legacyCode: string;
    replacement: string;
    displayName?: string;
    mappingStatus: string;
  }>;
};

type MonitoringStats = {
  pendukung2018Indicators: number;
  skIndicators: number;
  readyIndicators: number;
  needsReviewIndicators: number;
  queryNotReadyIndicators: number;
  dataNotEnoughIndicators: number;
  manualInputIndicators: number;
  runCount: number;
  datasourceStatus: {
    mode: string;
    label: string;
    readOnly: boolean;
    source: string;
    productionReady: boolean;
  };
  lastRun?: Record<string, unknown> | null;
  lastRunAt: string;
  sources: Array<{
    source_key: string;
    source_type: string;
    source_name: string;
    source_path: string;
    status: string;
    last_imported_at?: string | null;
    summary?: Record<string, unknown>;
  }>;
  mappings: Array<{ mappingType: string; count: number }>;
};

type AutoReviewResult = {
  totalItems: number;
  successCount: number;
  warningCount: number;
  failedCount: number;
  statusCounts: Record<string, number>;
  rows: Array<{
    featureKey: string;
    featureName: string;
    queryKey: string;
    implementationStatus: string;
    safetyStatus: string;
    reasonCode: string;
    reason: string;
    promoted: boolean;
  }>;
};

type MonitoringIndicatorRow = {
  id: string;
  indicatorKey: string;
  indicatorCode: string;
  indicatorName: string;
  shortDescription: string;
  longDescription?: string;
  sourceType: string;
  sourceFile: string;
  sourceLocation: string;
  category: string;
  subCategory: string;
  periodType: string;
  formulaText: string;
  formula?: Record<string, unknown>;
  weight: number;
  maxScore: number;
  thresholdGreen: number | null;
  thresholdYellow: number | null;
  thresholdRed: number | null;
  queryKey: string;
  queryId: string | null;
  tablesUsed: string[];
  columnsUsed: string[];
  resultType: string;
  calculationMode: string;
  safetyStatus: string;
  status: string;
  reviewStatus: string;
  confidenceScore: number;
  riskNotes: string;
  recommendationTemplate: string;
  skBasis: string;
  assumptionNotes: string;
  latestRunKey?: string | null;
  latestResultStatus?: string | null;
  latestScorePercent?: number | null;
};

type MonitoringIndicatorList = {
  rows: MonitoringIndicatorRow[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
  categories: Array<{ category: string; count: number }>;
  sources: Array<{ sourceType: string; count: number }>;
  statuses: Array<{ status: string; count: number }>;
};

type MonitoringIndicatorDetail = MonitoringIndicatorRow & {
  query: Record<string, unknown> | null;
  latestResult: Record<string, unknown> | null;
  mappings: Array<Record<string, unknown>>;
};

type MonitoringRunRow = {
  id: string;
  run_key: string;
  run_name: string;
  run_type: string;
  year: number | null;
  quarter: number | null;
  date_start: string;
  date_end: string;
  datasource_mode: string;
  status: string;
  total_indicators: number;
  completed_indicators: number;
  score_percent: number;
  green_count: number;
  yellow_count: number;
  red_count: number;
  needs_review_count: number;
  data_not_enough_count: number;
  manual_input_count: number;
  query_not_ready_count: number;
  started_at?: string | null;
  finished_at?: string | null;
  created_at: string;
};

type MonitoringRunList = {
  rows: MonitoringRunRow[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};

type MonitoringRunDetail = MonitoringRunRow & {
  summary?: Record<string, unknown>;
  resultStatusCounts?: Array<{ status: string; count: number }>;
};

type MonitoringRunResultRow = {
  id: string;
  status: string;
  score_percent?: string | number | null;
  result_summary?: string | null;
  recommendation?: string | null;
  indicator_key?: string | null;
  indicator_name?: string | null;
  category?: string | null;
  source_type?: string | null;
  item_count?: string | number | null;
};

type MonitoringRunResults = {
  runKey: string;
  rows: MonitoringRunResultRow[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};

type MonitoringResultItemRow = {
  id: string;
  result_id?: string | null;
  resultId?: string | null;
  run_key?: string | null;
  runKey?: string | null;
  indicator_key?: string | null;
  indicatorKey?: string | null;
  indicator_name?: string | null;
  indicatorName?: string | null;
  feature_key?: string | null;
  featureKey?: string | null;
  feature_name?: string | null;
  featureName?: string | null;
  group_key?: string | null;
  groupKey?: string | null;
  group_name?: string | null;
  groupName?: string | null;
  perkara_id?: string | null;
  nomor_perkara?: string | null;
  item_type?: string | null;
  item_title?: string | null;
  item_description?: string | null;
  item_status?: string | null;
  followup_status?: string | null;
  source_table?: string | null;
  recommendation?: string | null;
  admin_notes?: string | null;
  sourceData?: Record<string, unknown>;
};

type MonitoringItemsResponse = {
  rows: MonitoringResultItemRow[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};

type Pendukung2018FeatureRow = {
  id: string;
  featureKey: string;
  featureCode: string;
  featureName: string;
  groupKey: string;
  groupName: string;
  sortOrder: number;
  sourceFiles: string[];
  sourceEvidence: string[];
  implementationStatus: string;
  migrationStatus: string;
  safetyStatus: string;
  reviewStatus: string;
  relatedQueryKey: string;
  relatedIndicatorKey: string;
  tablesUsed: string[];
  columnsUsed: string[];
  periodType: string;
  calculationMode: string;
  resultType: string;
  noQueryReason: string;
  requiresManualInput: boolean;
  externalDependency: string;
  uiRoute: string;
  riskNotes: string;
  recommendationTemplate: string;
  adminNotes: string;
  operationalStatus?: string;
  readinessReason?: string;
  availableActions?: string[];
  subFeatures?: Array<{ key: string; label: string; status: string; reason: string; actions: string[] }>;
  latestRunKey?: string | null;
  latestResultId?: string | null;
  latestResultStatus?: string | null;
  latestScorePercent?: number | null;
};

type Pendukung2018FeatureList = {
  rows: Pendukung2018FeatureRow[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
  groups: Array<{ groupKey: string; groupName: string; count: number }>;
  statuses: Array<{ status: string; count: number }>;
  safetyStatuses: Array<{ status: string; count: number }>;
};

type Pendukung2018FeatureDetail = Pendukung2018FeatureRow & {
  query: Record<string, unknown> | null;
  indicator: Record<string, unknown> | null;
  latestResult: Record<string, unknown> | null;
};

type TriwulanOptions = {
  defaultYear: number;
  officialSkPeriodicity: string;
  note: string;
  options: Array<{
    label: string;
    quarter: number;
    dateStart: string;
    dateEnd: string;
    lastRun?: Record<string, unknown> | null;
  }>;
};

type ExternalConnectorList = {
  rows: Array<{
    featureKey: string;
    featureName: string;
    groupName: string;
    connectorName: string;
    sourceKey: string;
    endpoint: string;
    host: string;
    mode: string;
    credentialReference: string;
    status: string;
    lastCheckedAt?: unknown;
    updatedAt?: unknown;
  }>;
};

const tabItems = [
  { value: "dashboard", label: "Dashboard" },
  { value: "kamus", label: "Kamus Database" },
  { value: "query", label: "Query Registry" },
  { value: "variabel", label: "Variable Registry" },
  { value: "pendukung2018", label: "Katalog Monitoring" },
  { value: "monitoring", label: "Monitoring SIPP" },
  { value: "triwulan", label: "Penilaian SK SIPP" },
  { value: "evaluasi", label: "Evaluasi Gabungan" },
  { value: "indikator", label: "Indikator Monitoring" },
  { value: "runs", label: "Riwayat Run" },
  { value: "temuan", label: "Temuan" },
  { value: "mapping", label: "Mapping" },
  { value: "external-connectors", label: "Konektor Eksternal" },
  { value: "admin-monitoring", label: "Admin Monitoring" },
  { value: "penilaian", label: "Manual Input" },
  { value: "jadwal", label: "Jadwal PDF" },
  { value: "audit", label: "Audit" },
] as const;

function statusVariant(status: string) {
  if (["SAFE_READ_ONLY", "MAPPED", "MAPPED_TO_TABLE_COLUMN", "MAPPED_TO_QUERY", "MAPPED_TO_COMPUTED", "MAPPED_TO_MANUAL_INPUT", "READY", "SUCCESS", "HIJAU", "READY_MONITORING", "READY_ASSESSMENT", "READY_TRIWULAN_ASSESSMENT", "READY_DRY_RUN", "COMPLETED", "READY_READ_ONLY", "AUTO_IMPLEMENTED", "READY_OPERATIONAL", "READY_WITH_DATASOURCE", "READY_WITH_AUTO_REVIEWED_QUERY", "MANUAL_INPUT_READY", "REPORT_TEMPLATE_READY", "AUTO_REVIEWED", "APPROVED", "REVIEWED", "SIAP_READ_ONLY", "TERKONFIGURASI"].includes(status)) return "success";
  if (["BELUM_IMPORT_METADATA", "NEEDS_REVIEW", "PARTIAL", "PARTIAL_READ_ONLY", "QUERY_NEEDS_REVIEW", "DATA_TIDAK_CUKUP", "PERLU_INPUT_MANUAL", "MANUAL_INPUT_REQUIRED", "LEGACY_WRITE_REFERENCE_ONLY", "REFERENCE_ONLY", "DEPRECATED_REFERENCE_ONLY", "EXTERNAL_CONNECTOR_REQUIRED", "EXTERNAL_CONNECTOR_WAITING_CONFIG", "RUNNING", "QUERY_NOT_READY", "FORMULA_NEEDS_REVIEW", "FORMULA_CONFIGURATION_REQUIRED", "COMPLETED_WITH_WARNINGS", "KUNING", "SK_NOT_FOUND", "SCHEMA_MAPPING_REQUIRED", "REPORT_TEMPLATE_REQUIRED", "MISSING_PERIOD_FILTER", "MENUNGGU_KONFIGURASI", "BELUM_TERKONFIGURASI", "SUBMITTED", "DRAFT"].includes(status)) return "warning";
  if (["UNSAFE_RAW_SQL", "REJECTED_WRITE_QUERY", "UNSAFE_LEGACY_QUERY_REJECTED", "UNSAFE_KEYWORD", "MULTI_STATEMENT", "CONFLICT", "FAILED", "ERROR", "MERAH", "REJECTED", "GAGAL_KONEKSI"].includes(status)) return "danger";
  return "outline";
}

function formatRunTypeLabel(runType: string) {
  const map: Record<string, string> = {
    PENDUKUNG2018_MONITORING: "Monitoring SIPP",
    SK_TRIWULAN_ASSESSMENT: "Penilaian SK SIPP Triwulan",
    COMBINED_EVALUATION: "Evaluasi Gabungan",
    SK_ASSESSMENT: "Penilaian SK SIPP",
    MONITORING_RUN: "Run Monitoring",
    DRY_RUN: "Simulasi",
  };
  return map[runType] ?? runType.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatStatusLabel(status: string) {
  const map: Record<string, string> = {
    READY_OPERATIONAL: "Siap Operasional",
    READY_WITH_DATASOURCE: "Siap Setelah Datasource Aktif",
    READY_WITH_AUTO_REVIEWED_QUERY: "Query Aman Otomatis",
    READY_WITH_REVIEWED_QUERY: "Query Aman",
    NEEDS_REVIEW: "Perlu Konfigurasi",
    QUERY_NEEDS_REVIEW: "Perlu Konfigurasi Query",
    PERLU_INPUT_MANUAL: "Membutuhkan Input Manual",
    MANUAL_INPUT_REQUIRED: "Membutuhkan Input Manual",
    MANUAL_INPUT_READY: "Input Manual Siap",
    EXTERNAL_CONNECTOR_REQUIRED: "Membutuhkan Konektor Eksternal",
    EXTERNAL_CONNECTOR_WAITING_CONFIG: "Menunggu Konfigurasi Konektor",
    SCHEMA_MAPPING_REQUIRED: "Butuh Pemetaan Schema",
    FORMULA_CONFIGURATION_REQUIRED: "Butuh Konfigurasi Formula",
    FORMULA_NEEDS_REVIEW: "Butuh Konfigurasi Formula",
    REPORT_TEMPLATE_REQUIRED: "Butuh Template Laporan",
    UNSAFE_LEGACY_QUERY_REJECTED: "Query Legacy Ditolak",
    MISSING_PERIOD_FILTER: "Butuh Filter Periode",
    DATA_TIDAK_CUKUP: "Data Tidak Cukup",
    QUERY_NOT_READY: "Query Belum Siap",
    REFERENCE_ONLY: "Butuh Desain Modul",
    LEGACY_WRITE_REFERENCE_ONLY: "Dialihkan ke Input Manual",
    PARTIAL_READ_ONLY: "Siap Parsial Read-only",
    PARTIAL: "Parsial",
    READY_READ_ONLY: "Siap Read-only",
    READY_MONITORING: "Siap Monitoring",
    READY_ASSESSMENT: "Siap Penilaian",
    READY_TRIWULAN_ASSESSMENT: "Siap Penilaian Triwulan",
    READY_SCHEDULE_PDF: "Siap Jadwal PDF",
    DICTIONARY_ONLY: "Kamus Database",
    ADMIN_TEST_ONLY: "Uji Admin",
    UNSAFE_RAW_SQL: "SQL Tidak Aman",
    REJECTED_WRITE_QUERY: "Query Write Ditolak",
    SAFE_READ_ONLY: "Aman Read-only",
    ANALYZED: "Terverifikasi",
    AUTO_GENERATED: "Dibuat Otomatis",
    AUTO_IMPLEMENTED: "Diimplementasi Otomatis",
    UNKNOWN: "Belum Dikenal",
    MAPPED_TO_TABLE_COLUMN: "Terhubung ke Tabel/Kolom",
    MAPPED_TO_QUERY: "Terhubung ke Query",
    MAPPED_TO_COMPUTED: "Terhubung ke Rumus",
    MAPPED_TO_MANUAL_INPUT: "Terhubung ke Input Manual",
    UNRESOLVED: "Belum Terhubung",
    AUTO_ANALYZED: "Dianalisis Otomatis",
    SNAPSHOT_CACHE: "Cache Snapshot",
    READ_ONLY_SIPP: "Datasource SIPP Read-only",
    COMPLETED: "Selesai",
    FAILED: "Gagal",
    RUNNING: "Berjalan",
    READY_DRY_RUN: "Siap Simulasi",
    COMPLETED_WITH_WARNINGS: "Selesai Dengan Catatan",
    AUTO_REVIEWED: "Ditinjau Otomatis",
    ADMIN_REVIEWED: "Ditinjau Admin",
    AUTO_IMPORTED: "Diimpor Otomatis",
    NEEDS_ADMIN_REVIEW: "Perlu Konfigurasi Admin",
    BELUM_DITINDAKLANJUTI: "Belum Ditindaklanjuti",
    DALAM_PROSES: "Dalam Proses",
    SELESAI: "Selesai",
    DIABAIKAN: "Diabaikan",
    SIAP_READ_ONLY: "Siap Read-only",
    TERKONFIGURASI: "Terkonfigurasi",
    MENUNGGU_KONFIGURASI: "Menunggu Konfigurasi",
    GAGAL_KONEKSI: "Gagal Koneksi",
  };
  return map[status] ?? formatRunTypeLabel(status);
}

async function readApi<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.error?.message ?? "Ringkasan ALETA x SIPP belum berhasil dimuat.");
  }
  return payload?.data as T;
}

function shortDate(value?: string | null) {
  if (!value) return "-";
  return value.slice(0, 10);
}

function numericText(value: unknown, suffix = "") {
  const numberValue = Number(value ?? 0);
  if (!Number.isFinite(numberValue)) return `0${suffix}`;
  return `${numberValue.toLocaleString("id-ID", { maximumFractionDigits: 2 })}${suffix}`;
}

function sourceLabel(sourceType: string) {
  if (sourceType === "PENDUKUNG2018") return "Monitoring SIPP";
  if (sourceType === "SK_PENILAIAN_SIPP_2024") return "SK Penilaian SIPP 2024";
  return sourceType || "-";
}

function formulaDraftFromIndicator(detail: MonitoringIndicatorDetail) {
  const formula = detail.formula ?? {};
  return {
    formulaType: String(formula.formulaType ?? "percentage"),
    numeratorField: String(formula.numeratorField ?? ""),
    denominatorField: String(formula.denominatorField ?? ""),
    formulaText: detail.formulaText ?? "",
    weight: String(detail.weight ?? ""),
    maxScore: String(detail.maxScore ?? ""),
    thresholdGreen: String(detail.thresholdGreen ?? 90),
    thresholdYellow: String(detail.thresholdYellow ?? 60),
    thresholdRed: String(detail.thresholdRed ?? 0),
    notes: String(formula.notes ?? ""),
  };
}

export default function AletaSippPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [summary, setSummary] = useState<AletaSippSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dictionaryStats, setDictionaryStats] = useState<DictionaryStats | null>(null);
  const [dictionaryList, setDictionaryList] = useState<DictionaryListResponse | null>(null);
  const [dictionaryLoading, setDictionaryLoading] = useState(true);
  const [dictionaryError, setDictionaryError] = useState("");
  const [dictionaryFilters, setDictionaryFilters] = useState({
    q: "",
    category: "",
    analysisStatus: "",
    reviewStatus: "",
    page: 1,
    pageSize: 25,
  });
  const [selectedTableName, setSelectedTableName] = useState("");
  const [dictionaryDetail, setDictionaryDetail] = useState<DictionaryDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [dictionaryAction, setDictionaryAction] = useState("");
  const [dictionaryProgress, setDictionaryProgress] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [editDraft, setEditDraft] = useState({
    humanName: "",
    category: "",
    shortDescription: "",
    longDescription: "",
    businessFunction: "",
    dataQualityNotes: "",
    reviewNotes: "",
  });
  const [queryStats, setQueryStats] = useState<QueryRegistryStats | null>(null);
  const [queryList, setQueryList] = useState<QueryRegistryListResponse | null>(null);
  const [queryLoading, setQueryLoading] = useState(true);
  const [queryError, setQueryError] = useState("");
  const [queryProgress, setQueryProgress] = useState("");
  const [queryAction, setQueryAction] = useState("");
  const [queryFilters, setQueryFilters] = useState({
    q: "",
    category: "",
    sourceType: "",
    executionMode: "",
    securityStatus: "",
    reviewStatus: "",
    tableName: "",
    variableCode: "",
    page: 1,
    pageSize: 25,
  });
  const [selectedQueryKey, setSelectedQueryKey] = useState("");
  const [queryDetail, setQueryDetail] = useState<QueryRegistryDetail | null>(null);
  const [queryDetailLoading, setQueryDetailLoading] = useState(false);
  const [queryEditMode, setQueryEditMode] = useState(false);
  const [queryEditDraft, setQueryEditDraft] = useState({
    name: "",
    category: "",
    shortDescription: "",
    longDescription: "",
    businessPurpose: "",
    usageNotes: "",
    riskNotes: "",
  });
  const [variableStats, setVariableStats] = useState<VariableRegistryStats | null>(null);
  const [variableList, setVariableList] = useState<VariableRegistryListResponse | null>(null);
  const [variableLoading, setVariableLoading] = useState(true);
  const [variableError, setVariableError] = useState("");
  const [variableProgress, setVariableProgress] = useState("");
  const [variableAction, setVariableAction] = useState("");
  const [variableFilters, setVariableFilters] = useState({
    q: "",
    legacySource: "",
    category: "",
    sourceType: "",
    variableType: "",
    mappingStatus: "",
    reviewStatus: "",
    queryKey: "",
    tableName: "",
    page: 1,
    pageSize: 25,
  });
  const [selectedVariableKey, setSelectedVariableKey] = useState("");
  const [variableDetail, setVariableDetail] = useState<VariableRegistryDetail | null>(null);
  const [variableDetailLoading, setVariableDetailLoading] = useState(false);
  const [variableEditMode, setVariableEditMode] = useState(false);
  const [variableEditDraft, setVariableEditDraft] = useState({
    displayName: "",
    category: "",
    shortDescription: "",
    longDescription: "",
    sourceType: "",
    sourceTable: "",
    sourceColumn: "",
    mappingStatus: "",
    usageNotes: "",
    riskNotes: "",
  });
  const [legacyText, setLegacyText] = useState("");
  const [convertResult, setConvertResult] = useState<ConvertLegacyTextResult | null>(null);
  const [convertAction, setConvertAction] = useState("");
  const currentYear = new Date().getFullYear();
  const currentQuarter = Math.floor(new Date().getMonth() / 3) + 1;
  const [monitoringStats, setMonitoringStats] = useState<MonitoringStats | null>(null);
  const [monitoringIndicators, setMonitoringIndicators] = useState<MonitoringIndicatorList | null>(null);
  const [monitoringRuns, setMonitoringRuns] = useState<MonitoringRunList | null>(null);
  const [triwulanOptions, setTriwulanOptions] = useState<TriwulanOptions | null>(null);
  const [monitoringLoading, setMonitoringLoading] = useState(true);
  const [monitoringError, setMonitoringError] = useState("");
  const [monitoringProgress, setMonitoringProgress] = useState("");
  const [monitoringAction, setMonitoringAction] = useState("");
  const [monitoringFilters, setMonitoringFilters] = useState({
    q: "",
    sourceType: "",
    category: "",
    status: "",
    reviewStatus: "",
    page: 1,
    pageSize: 25,
  });
  const [pendukungFeatures, setPendukungFeatures] = useState<Pendukung2018FeatureList | null>(null);
  const [pendukungFeatureDetail, setPendukungFeatureDetail] = useState<Pendukung2018FeatureDetail | null>(null);
  const [selectedPendukungFeatureKey, setSelectedPendukungFeatureKey] = useState("");
  const [pendukungFeatureDetailLoading, setPendukungFeatureDetailLoading] = useState(false);
  const [pendukungFeatureFilters, setPendukungFeatureFilters] = useState({
    q: "",
    groupKey: "",
    implementationStatus: "",
    safetyStatus: "",
    reviewStatus: "",
    page: 1,
    pageSize: 25,
  });
  const [runFilters, setRunFilters] = useState({
    runType: "",
    year: currentYear,
    quarter: 0,
    status: "",
    page: 1,
    pageSize: 10,
  });
  const [runForm, setRunForm] = useState({
    year: currentYear,
    quarter: currentQuarter,
    dateStart: "",
    dateEnd: "",
    datasourceMode: "SNAPSHOT_CACHE",
  });
  const [selectedMonitoringIndicatorKey, setSelectedMonitoringIndicatorKey] = useState("");
  const [monitoringIndicatorDetail, setMonitoringIndicatorDetail] = useState<MonitoringIndicatorDetail | null>(null);
  const [monitoringIndicatorDetailLoading, setMonitoringIndicatorDetailLoading] = useState(false);
  const [manualInputDraft, setManualInputDraft] = useState({ value: "", notes: "", evidence: "" });
  const [formulaDraft, setFormulaDraft] = useState({
    formulaType: "percentage",
    numeratorField: "",
    denominatorField: "",
    formulaText: "",
    weight: "",
    maxScore: "",
    thresholdGreen: "90",
    thresholdYellow: "60",
    thresholdRed: "0",
    notes: "",
  });
  const [externalConnectors, setExternalConnectors] = useState<ExternalConnectorList | null>(null);
  const [connectorDrafts, setConnectorDrafts] = useState<Record<string, { connectorName: string; endpoint: string; host: string; credentialReference: string }>>({});
  const [selectedRunKey, setSelectedRunKey] = useState("");
  const [selectedRunDetail, setSelectedRunDetail] = useState<MonitoringRunDetail | null>(null);
  const [selectedRunResults, setSelectedRunResults] = useState<MonitoringRunResults | null>(null);
  const [monitoringItems, setMonitoringItems] = useState<MonitoringItemsResponse | null>(null);
  const [monitoringItemsLoading, setMonitoringItemsLoading] = useState(false);
  const [selectedResultItemFilter, setSelectedResultItemFilter] = useState("");
  const [runDetailLoading, setRunDetailLoading] = useState(false);
  const activeTab = searchParams.get("section") ?? "dashboard";
  const canRenderDetailPortal = typeof document !== "undefined";

  useEffect(() => {
    let cancelled = false;
    void fetch(apiPath("/api/aleta-sipp/summary"), {
      cache: "no-store",
      credentials: "include",
    })
      .then((response) => readApi<AletaSippSummary>(response))
      .then((data) => {
        if (cancelled) return;
        setSummary(data);
        setError("");
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : "Gagal memuat ALETA x SIPP.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (activeTab !== "kamus") {
      return;
    }
    let cancelled = false;
    const params = new URLSearchParams({
      page: String(dictionaryFilters.page),
      pageSize: String(dictionaryFilters.pageSize),
    });
    if (dictionaryFilters.q.trim()) params.set("q", dictionaryFilters.q.trim());
    if (dictionaryFilters.category) params.set("category", dictionaryFilters.category);
    if (dictionaryFilters.analysisStatus) params.set("analysisStatus", dictionaryFilters.analysisStatus);
    if (dictionaryFilters.reviewStatus) params.set("reviewStatus", dictionaryFilters.reviewStatus);

    void Promise.all([
      fetch(apiPath("/api/aleta-sipp/dictionary/stats"), { cache: "no-store", credentials: "include" }).then((response) =>
        readApi<DictionaryStats>(response)
      ),
      fetch(apiPath(`/api/aleta-sipp/dictionary/tables?${params.toString()}`), { cache: "no-store", credentials: "include" }).then((response) =>
        readApi<DictionaryListResponse>(response)
      ),
    ])
      .then(([stats, list]) => {
        if (cancelled) return;
        setDictionaryStats(stats);
        setDictionaryList(list);
        setDictionaryError("");
        if (selectedTableName && !list.rows.some((row) => row.tableName === selectedTableName)) {
          setSelectedTableName("");
          setDictionaryDetail(null);
        }
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setDictionaryError(cause instanceof Error ? cause.message : "Gagal memuat Kamus Database SIPP.");
      })
      .finally(() => {
        if (!cancelled) setDictionaryLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeTab, dictionaryFilters.analysisStatus, dictionaryFilters.category, dictionaryFilters.page, dictionaryFilters.pageSize, dictionaryFilters.q, dictionaryFilters.reviewStatus, selectedTableName]);

  useEffect(() => {
    if (activeTab !== "query") {
      return;
    }
    let cancelled = false;
    const params = new URLSearchParams({
      limit: String(queryFilters.pageSize),
      offset: String((queryFilters.page - 1) * queryFilters.pageSize),
    });
    if (queryFilters.q.trim()) params.set("q", queryFilters.q.trim());
    if (queryFilters.category) params.set("category", queryFilters.category);
    if (queryFilters.sourceType) params.set("sourceType", queryFilters.sourceType);
    if (queryFilters.executionMode) params.set("executionMode", queryFilters.executionMode);
    if (queryFilters.securityStatus) params.set("securityStatus", queryFilters.securityStatus);
    if (queryFilters.reviewStatus) params.set("reviewStatus", queryFilters.reviewStatus);
    if (queryFilters.tableName.trim()) params.set("tableName", queryFilters.tableName.trim());
    if (queryFilters.variableCode.trim()) params.set("variableCode", queryFilters.variableCode.trim());

    void Promise.all([
      fetch(apiPath("/api/aleta-sipp/query-registry/stats"), { cache: "no-store", credentials: "include" }).then((response) =>
        readApi<QueryRegistryStats>(response)
      ),
      fetch(apiPath(`/api/aleta-sipp/query-registry?${params.toString()}`), { cache: "no-store", credentials: "include" }).then((response) =>
        readApi<QueryRegistryListResponse>(response)
      ),
    ])
      .then(([stats, list]) => {
        if (cancelled) return;
        setQueryStats(stats);
        setQueryList(list);
        setQueryError("");
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setQueryError(cause instanceof Error ? cause.message : "Gagal memuat Query Registry SIPP.");
      })
      .finally(() => {
        if (!cancelled) setQueryLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeTab, queryFilters.category, queryFilters.executionMode, queryFilters.page, queryFilters.pageSize, queryFilters.q, queryFilters.reviewStatus, queryFilters.securityStatus, queryFilters.sourceType, queryFilters.tableName, queryFilters.variableCode]);

  useEffect(() => {
    if (activeTab !== "variabel") {
      return;
    }
    let cancelled = false;
    const params = new URLSearchParams({
      limit: String(variableFilters.pageSize),
      offset: String((variableFilters.page - 1) * variableFilters.pageSize),
    });
    if (variableFilters.q.trim()) params.set("q", variableFilters.q.trim());
    if (variableFilters.legacySource) params.set("legacySource", variableFilters.legacySource);
    if (variableFilters.category) params.set("category", variableFilters.category);
    if (variableFilters.sourceType) params.set("sourceType", variableFilters.sourceType);
    if (variableFilters.variableType) params.set("variableType", variableFilters.variableType);
    if (variableFilters.mappingStatus) params.set("mappingStatus", variableFilters.mappingStatus);
    if (variableFilters.reviewStatus) params.set("reviewStatus", variableFilters.reviewStatus);
    if (variableFilters.queryKey.trim()) params.set("queryKey", variableFilters.queryKey.trim());
    if (variableFilters.tableName.trim()) params.set("tableName", variableFilters.tableName.trim());

    void Promise.all([
      fetch(apiPath("/api/aleta-sipp/variable-registry/stats"), { cache: "no-store", credentials: "include" }).then((response) =>
        readApi<VariableRegistryStats>(response)
      ),
      fetch(apiPath(`/api/aleta-sipp/variable-registry?${params.toString()}`), { cache: "no-store", credentials: "include" }).then((response) =>
        readApi<VariableRegistryListResponse>(response)
      ),
    ])
      .then(([stats, list]) => {
        if (cancelled) return;
        setVariableStats(stats);
        setVariableList(list);
        setVariableError("");
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setVariableError(cause instanceof Error ? cause.message : "Gagal memuat Variable Registry SIPP.");
      })
      .finally(() => {
        if (!cancelled) setVariableLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeTab, variableFilters.category, variableFilters.legacySource, variableFilters.mappingStatus, variableFilters.page, variableFilters.pageSize, variableFilters.q, variableFilters.queryKey, variableFilters.reviewStatus, variableFilters.sourceType, variableFilters.tableName, variableFilters.variableType]);

  useEffect(() => {
    const shouldLoadMonitoring = ["pendukung2018", "monitoring", "triwulan", "evaluasi", "indikator", "runs", "temuan", "mapping", "external-connectors", "admin-monitoring"].includes(activeTab);
    if (!shouldLoadMonitoring) {
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    const indicatorParams = new URLSearchParams({
      page: String(monitoringFilters.page),
      pageSize: String(monitoringFilters.pageSize),
    });
    if (monitoringFilters.q.trim()) indicatorParams.set("q", monitoringFilters.q.trim());
    if (monitoringFilters.sourceType) indicatorParams.set("sourceType", monitoringFilters.sourceType);
    if (monitoringFilters.category) indicatorParams.set("category", monitoringFilters.category);
    if (monitoringFilters.status) indicatorParams.set("status", monitoringFilters.status);
    if (monitoringFilters.reviewStatus) indicatorParams.set("reviewStatus", monitoringFilters.reviewStatus);

    const runParams = new URLSearchParams({
      page: String(runFilters.page),
      pageSize: String(runFilters.pageSize),
    });
    if (runFilters.runType) runParams.set("runType", runFilters.runType);
    if (runFilters.year) runParams.set("year", String(runFilters.year));
    if (runFilters.quarter) runParams.set("quarter", String(runFilters.quarter));
    if (runFilters.status) runParams.set("status", runFilters.status);

    void Promise.all([
      fetch(apiPath("/api/aleta-sipp/monitoring/stats"), { cache: "no-store", credentials: "include", signal: controller.signal }).then((response) =>
        readApi<MonitoringStats>(response)
      ),
      fetch(apiPath(`/api/aleta-sipp/monitoring/indicators?${indicatorParams.toString()}`), { cache: "no-store", credentials: "include", signal: controller.signal }).then((response) =>
        readApi<MonitoringIndicatorList>(response)
      ),
      fetch(apiPath(`/api/aleta-sipp/monitoring/runs?${runParams.toString()}`), { cache: "no-store", credentials: "include", signal: controller.signal }).then((response) =>
        readApi<MonitoringRunList>(response)
      ),
      fetch(apiPath(`/api/aleta-sipp/monitoring/triwulan/options?year=${runForm.year}`), { cache: "no-store", credentials: "include", signal: controller.signal }).then((response) =>
        readApi<TriwulanOptions>(response)
      ),
    ])
      .then(([stats, indicators, runs, options]) => {
        if (cancelled) return;
        setMonitoringStats(stats);
        setMonitoringIndicators(indicators);
        setMonitoringRuns(runs);
        setTriwulanOptions(options);
        setMonitoringError("");
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setMonitoringError(cause instanceof Error ? cause.message : "Gagal memuat monitoring ALETA x SIPP.");
      })
      .finally(() => {
        if (!cancelled) setMonitoringLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [activeTab, monitoringFilters.category, monitoringFilters.page, monitoringFilters.pageSize, monitoringFilters.q, monitoringFilters.reviewStatus, monitoringFilters.sourceType, monitoringFilters.status, runFilters.page, runFilters.pageSize, runFilters.quarter, runFilters.runType, runFilters.status, runFilters.year, runForm.year]);

  useEffect(() => {
    if (activeTab !== "pendukung2018") return;
    let cancelled = false;
    const controller = new AbortController();
    const params = new URLSearchParams({
      page: String(pendukungFeatureFilters.page),
      pageSize: String(pendukungFeatureFilters.pageSize),
    });
    if (pendukungFeatureFilters.q.trim()) params.set("q", pendukungFeatureFilters.q.trim());
    if (pendukungFeatureFilters.groupKey) params.set("groupKey", pendukungFeatureFilters.groupKey);
    if (pendukungFeatureFilters.implementationStatus) params.set("implementationStatus", pendukungFeatureFilters.implementationStatus);
    if (pendukungFeatureFilters.safetyStatus) params.set("safetyStatus", pendukungFeatureFilters.safetyStatus);
    if (pendukungFeatureFilters.reviewStatus) params.set("reviewStatus", pendukungFeatureFilters.reviewStatus);

    void fetch(apiPath(`/api/aleta-sipp/monitoring-features?${params.toString()}`), {
      cache: "no-store",
      credentials: "include",
      signal: controller.signal,
    })
      .then((response) => readApi<Pendukung2018FeatureList>(response))
      .then((list) => {
        if (cancelled) return;
        setPendukungFeatures(list);
        setMonitoringError("");
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setMonitoringError(cause instanceof Error ? cause.message : "Gagal memuat katalog monitoring SIPP.");
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [activeTab, pendukungFeatureFilters.groupKey, pendukungFeatureFilters.implementationStatus, pendukungFeatureFilters.page, pendukungFeatureFilters.pageSize, pendukungFeatureFilters.q, pendukungFeatureFilters.reviewStatus, pendukungFeatureFilters.safetyStatus]);

  useEffect(() => {
    if (activeTab !== "external-connectors") return;
    let cancelled = false;
    void fetch(apiPath("/api/aleta-sipp/admin/monitoring/external-connectors"), {
      cache: "no-store",
      credentials: "include",
    })
      .then((response) => readApi<ExternalConnectorList>(response))
      .then((list) => {
        if (cancelled) return;
        setExternalConnectors(list);
        setConnectorDrafts((current) => {
          const next = { ...current };
          for (const row of list.rows) {
            if (!next[row.featureKey]) {
              next[row.featureKey] = {
                connectorName: row.connectorName || row.featureName,
                endpoint: row.endpoint || "",
                host: row.host || "",
                credentialReference: row.credentialReference || "",
              };
            }
          }
          return next;
        });
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setMonitoringError(cause instanceof Error ? cause.message : "Konektor eksternal belum berhasil dimuat.");
      });
    return () => {
      cancelled = true;
    };
  }, [activeTab]);

  useEffect(() => {
    if (!selectedPendukungFeatureKey) return;
    let cancelled = false;
    void fetch(apiPath(`/api/aleta-sipp/monitoring-features/${encodeURIComponent(selectedPendukungFeatureKey)}`), {
      cache: "no-store",
      credentials: "include",
    })
      .then((response) => readApi<Pendukung2018FeatureDetail>(response))
      .then((detail) => {
        if (cancelled) return;
        setPendukungFeatureDetail(detail);
        setMonitoringError("");
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setMonitoringError(cause instanceof Error ? cause.message : "Detail fitur monitoring belum berhasil dimuat.");
      })
      .finally(() => {
        if (!cancelled) setPendukungFeatureDetailLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedPendukungFeatureKey]);

  useEffect(() => {
    if (!selectedMonitoringIndicatorKey) return;
    let cancelled = false;
    void fetch(apiPath(`/api/aleta-sipp/monitoring/indicators/${encodeURIComponent(selectedMonitoringIndicatorKey)}`), {
      cache: "no-store",
      credentials: "include",
    })
      .then((response) => readApi<MonitoringIndicatorDetail>(response))
      .then((detail) => {
        if (cancelled) return;
        setMonitoringIndicatorDetail(detail);
        setFormulaDraft(formulaDraftFromIndicator(detail));
        setMonitoringError("");
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setMonitoringError(cause instanceof Error ? cause.message : "Detail indikator monitoring belum berhasil dimuat.");
      })
      .finally(() => {
        if (!cancelled) setMonitoringIndicatorDetailLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedMonitoringIndicatorKey]);

  useEffect(() => {
    if (!selectedRunKey) return;
    let cancelled = false;
    void Promise.all([
      fetch(apiPath(`/api/aleta-sipp/monitoring/runs/${encodeURIComponent(selectedRunKey)}`), {
        cache: "no-store",
        credentials: "include",
      }).then((response) => readApi<MonitoringRunDetail>(response)),
      fetch(apiPath(`/api/aleta-sipp/monitoring/runs/${encodeURIComponent(selectedRunKey)}/results?page=1&pageSize=25`), {
        cache: "no-store",
        credentials: "include",
      }).then((response) => readApi<MonitoringRunResults>(response)),
      fetch(apiPath(`/api/aleta-sipp/monitoring/items?runKey=${encodeURIComponent(selectedRunKey)}&page=1&pageSize=50`), {
        cache: "no-store",
        credentials: "include",
      }).then((response) => readApi<MonitoringItemsResponse>(response)),
    ])
      .then(([detail, results, items]) => {
        if (cancelled) return;
        setSelectedRunDetail(detail);
        setSelectedRunResults(results);
        setMonitoringItems(items);
        setSelectedResultItemFilter("");
        setMonitoringError("");
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setMonitoringError(cause instanceof Error ? cause.message : "Detail run monitoring belum berhasil dimuat.");
      })
      .finally(() => {
        if (!cancelled) {
          setRunDetailLoading(false);
          setMonitoringItemsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedRunKey]);

  useEffect(() => {
    if (!selectedTableName) return;
    let cancelled = false;
    void fetch(apiPath(`/api/aleta-sipp/dictionary/tables/${encodeURIComponent(selectedTableName)}`), {
      cache: "no-store",
      credentials: "include",
    })
      .then((response) => readApi<DictionaryDetail>(response))
      .then((detail) => {
        if (cancelled) return;
        setDictionaryDetail(detail);
        setEditMode(false);
        setEditDraft({
          humanName: detail.table.humanName,
          category: detail.table.category,
          shortDescription: detail.table.shortDescription,
          longDescription: detail.longDescription,
          businessFunction: detail.businessFunction,
          dataQualityNotes: detail.dataQualityNotes,
          reviewNotes: detail.notes.reviewNotes,
        });
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setDictionaryError(cause instanceof Error ? cause.message : "Detail tabel belum berhasil dimuat.");
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedTableName]);

  useEffect(() => {
    if (!selectedQueryKey) return;
    let cancelled = false;
    void fetch(apiPath(`/api/aleta-sipp/query-registry/${encodeURIComponent(selectedQueryKey)}`), {
      cache: "no-store",
      credentials: "include",
    })
      .then((response) => readApi<QueryRegistryDetail>(response))
      .then((detail) => {
        if (cancelled) return;
        setQueryDetail(detail);
        setQueryEditMode(false);
        setQueryEditDraft({
          name: detail.name,
          category: detail.category,
          shortDescription: detail.shortDescription,
          longDescription: detail.longDescription,
          businessPurpose: detail.businessPurpose ?? "",
          usageNotes: detail.usageNotes ?? "",
          riskNotes: detail.riskNotes.join("\n"),
        });
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setQueryError(cause instanceof Error ? cause.message : "Detail query belum berhasil dimuat.");
      })
      .finally(() => {
        if (!cancelled) setQueryDetailLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedQueryKey]);

  useEffect(() => {
    if (!selectedVariableKey) return;
    let cancelled = false;
    void fetch(apiPath(`/api/aleta-sipp/variable-registry/${encodeURIComponent(selectedVariableKey)}`), {
      cache: "no-store",
      credentials: "include",
    })
      .then((response) => readApi<VariableRegistryDetail>(response))
      .then((detail) => {
        if (cancelled) return;
        setVariableDetail(detail);
        setVariableEditMode(false);
        setVariableEditDraft({
          displayName: detail.displayName,
          category: detail.category ?? "",
          shortDescription: detail.shortDescription ?? "",
          longDescription: detail.longDescription ?? "",
          sourceType: detail.sourceType,
          sourceTable: detail.sourceTable,
          sourceColumn: detail.sourceColumn,
          mappingStatus: detail.mappingStatus ?? detail.status,
          usageNotes: detail.usageNotes ?? "",
          riskNotes: detail.riskNotes ?? "",
        });
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setVariableError(cause instanceof Error ? cause.message : "Detail variabel belum berhasil dimuat.");
      })
      .finally(() => {
        if (!cancelled) setVariableDetailLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedVariableKey]);

  useEffect(() => {
    if (!selectedTableName) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setSelectedTableName("");
      setDictionaryDetail(null);
      setDetailLoading(false);
      setEditMode(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedTableName]);

  useEffect(() => {
    if (!selectedQueryKey && !selectedVariableKey) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setSelectedQueryKey("");
      setQueryDetail(null);
      setQueryDetailLoading(false);
      setQueryEditMode(false);
      setSelectedVariableKey("");
      setVariableDetail(null);
      setVariableDetailLoading(false);
      setVariableEditMode(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedQueryKey, selectedVariableKey]);

  async function reloadDictionary() {
    const params = new URLSearchParams({
      page: String(dictionaryFilters.page),
      pageSize: String(dictionaryFilters.pageSize),
    });
    if (dictionaryFilters.q.trim()) params.set("q", dictionaryFilters.q.trim());
    if (dictionaryFilters.category) params.set("category", dictionaryFilters.category);
    if (dictionaryFilters.analysisStatus) params.set("analysisStatus", dictionaryFilters.analysisStatus);
    if (dictionaryFilters.reviewStatus) params.set("reviewStatus", dictionaryFilters.reviewStatus);
    const [stats, list] = await Promise.all([
      fetch(apiPath("/api/aleta-sipp/dictionary/stats"), { cache: "no-store", credentials: "include" }).then((response) =>
        readApi<DictionaryStats>(response)
      ),
      fetch(apiPath(`/api/aleta-sipp/dictionary/tables?${params.toString()}`), { cache: "no-store", credentials: "include" }).then((response) =>
        readApi<DictionaryListResponse>(response)
      ),
    ]);
    setDictionaryStats(stats);
    setDictionaryList(list);
  }

  async function loadDictionaryDetail(tableName: string) {
    setDetailLoading(true);
    setSelectedTableName(tableName);
  }

  function closeDictionaryDetail() {
    setSelectedTableName("");
    setDictionaryDetail(null);
    setDetailLoading(false);
    setEditMode(false);
  }

  async function runAnalyzeAllDictionary() {
    setDictionaryAction("analyze-all");
    setDictionaryError("");
    setDictionaryProgress("Menyiapkan analisis semua tabel...");
    try {
      let continueToken: string | null = null;
      let finished = false;
      do {
        const result: AnalyzeBatchResult = await fetch(apiPath("/api/aleta-sipp/admin/dictionary/analyze-all"), {
          method: "POST",
          cache: "no-store",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ batchSize: 50, continueToken }),
        }).then((response) =>
          readApi<AnalyzeBatchResult>(response)
        );
        finished = result.finished;
        continueToken = result.continueToken;
        setDictionaryProgress(
          `Analisis berjalan: ${Math.min(result.nextOffset, result.total)} / ${result.total} tabel. Batch terakhir ${result.processed} tabel, ${result.failed} gagal, ${result.needsReview} perlu review.`
        );
      } while (!finished && continueToken);
      await reloadDictionary();
      setDictionaryProgress("Analisis semua tabel selesai.");
      if (selectedTableName) {
        const detail = await fetch(apiPath(`/api/aleta-sipp/dictionary/tables/${encodeURIComponent(selectedTableName)}`), {
          cache: "no-store",
          credentials: "include",
        }).then((response) => readApi<DictionaryDetail>(response));
        setDictionaryDetail(detail);
      }
    } catch (cause) {
      setDictionaryError(cause instanceof Error ? cause.message : "Analisis semua tabel gagal.");
    } finally {
      setDictionaryAction("");
    }
  }

  async function runAnalyzeSelectedTable(force = false) {
    if (!selectedTableName) return;
    setDictionaryAction("analyze-one");
    setDictionaryError("");
    try {
      await fetch(apiPath(`/api/aleta-sipp/admin/dictionary/tables/${encodeURIComponent(selectedTableName)}/analyze`), {
        method: "POST",
        cache: "no-store",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ force }),
      }).then((response) => readApi(response));
      await reloadDictionary();
      const detail = await fetch(apiPath(`/api/aleta-sipp/dictionary/tables/${encodeURIComponent(selectedTableName)}`), {
        cache: "no-store",
        credentials: "include",
      }).then((response) => readApi<DictionaryDetail>(response));
      setDictionaryDetail(detail);
    } catch (cause) {
      setDictionaryError(cause instanceof Error ? cause.message : "Analisis ulang tabel gagal.");
    } finally {
      setDictionaryAction("");
    }
  }

  async function saveDictionaryEdit() {
    if (!selectedTableName) return;
    setDictionaryAction("save-edit");
    setDictionaryError("");
    try {
      const detail = await fetch(apiPath(`/api/aleta-sipp/admin/dictionary/tables/${encodeURIComponent(selectedTableName)}`), {
        method: "PATCH",
        cache: "no-store",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(editDraft),
      }).then((response) => readApi<DictionaryDetail>(response));
      setDictionaryDetail(detail);
      setEditMode(false);
      await reloadDictionary();
    } catch (cause) {
      setDictionaryError(cause instanceof Error ? cause.message : "Edit penjelasan tabel gagal.");
    } finally {
      setDictionaryAction("");
    }
  }

  async function reloadQueryRegistry() {
    const params = new URLSearchParams({
      limit: String(queryFilters.pageSize),
      offset: String((queryFilters.page - 1) * queryFilters.pageSize),
    });
    if (queryFilters.q.trim()) params.set("q", queryFilters.q.trim());
    if (queryFilters.category) params.set("category", queryFilters.category);
    if (queryFilters.sourceType) params.set("sourceType", queryFilters.sourceType);
    if (queryFilters.executionMode) params.set("executionMode", queryFilters.executionMode);
    if (queryFilters.securityStatus) params.set("securityStatus", queryFilters.securityStatus);
    if (queryFilters.reviewStatus) params.set("reviewStatus", queryFilters.reviewStatus);
    if (queryFilters.tableName.trim()) params.set("tableName", queryFilters.tableName.trim());
    if (queryFilters.variableCode.trim()) params.set("variableCode", queryFilters.variableCode.trim());
    const [stats, list] = await Promise.all([
      fetch(apiPath("/api/aleta-sipp/query-registry/stats"), { cache: "no-store", credentials: "include" }).then((response) =>
        readApi<QueryRegistryStats>(response)
      ),
      fetch(apiPath(`/api/aleta-sipp/query-registry?${params.toString()}`), { cache: "no-store", credentials: "include" }).then((response) =>
        readApi<QueryRegistryListResponse>(response)
      ),
    ]);
    setQueryStats(stats);
    setQueryList(list);
  }

  async function reloadVariableRegistry() {
    const params = new URLSearchParams({
      limit: String(variableFilters.pageSize),
      offset: String((variableFilters.page - 1) * variableFilters.pageSize),
    });
    if (variableFilters.q.trim()) params.set("q", variableFilters.q.trim());
    if (variableFilters.legacySource) params.set("legacySource", variableFilters.legacySource);
    if (variableFilters.category) params.set("category", variableFilters.category);
    if (variableFilters.sourceType) params.set("sourceType", variableFilters.sourceType);
    if (variableFilters.variableType) params.set("variableType", variableFilters.variableType);
    if (variableFilters.mappingStatus) params.set("mappingStatus", variableFilters.mappingStatus);
    if (variableFilters.reviewStatus) params.set("reviewStatus", variableFilters.reviewStatus);
    if (variableFilters.queryKey.trim()) params.set("queryKey", variableFilters.queryKey.trim());
    if (variableFilters.tableName.trim()) params.set("tableName", variableFilters.tableName.trim());
    const [stats, list] = await Promise.all([
      fetch(apiPath("/api/aleta-sipp/variable-registry/stats"), { cache: "no-store", credentials: "include" }).then((response) =>
        readApi<VariableRegistryStats>(response)
      ),
      fetch(apiPath(`/api/aleta-sipp/variable-registry?${params.toString()}`), { cache: "no-store", credentials: "include" }).then((response) =>
        readApi<VariableRegistryListResponse>(response)
      ),
    ]);
    setVariableStats(stats);
    setVariableList(list);
  }

  function loadQueryDetail(queryKey: string) {
    setQueryDetailLoading(true);
    setSelectedQueryKey(queryKey);
  }

  function closeQueryDetail() {
    setSelectedQueryKey("");
    setQueryDetail(null);
    setQueryDetailLoading(false);
    setQueryEditMode(false);
  }

  function loadVariableDetail(variableKey: string) {
    setVariableDetailLoading(true);
    setSelectedVariableKey(variableKey);
  }

  function closeVariableDetail() {
    setSelectedVariableKey("");
    setVariableDetail(null);
    setVariableDetailLoading(false);
    setVariableEditMode(false);
  }

  async function runImportQueryRegistry() {
    setQueryAction("import");
    setQueryError("");
    setQueryProgress("Menyiapkan import Query Registry dari metadata, XLS, DOCX, dan sumber lama...");
    try {
      let continueToken: string | null = null;
      let finished = false;
      do {
        const result: ImportRegistryResult = await fetch(apiPath("/api/aleta-sipp/admin/query-registry/import-all"), {
          method: "POST",
          cache: "no-store",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ batchSize: 500, continueToken }),
        }).then((response) => readApi<ImportRegistryResult>(response));
        finished = result.finished;
        continueToken = result.continueToken;
        setQueryProgress(
          `Import Query Registry: ${Math.min(result.nextOffset, result.totalCandidates)} / ${result.totalCandidates}. Batch ${result.processed}, gagal ${result.failed}, rejected ${result.rejected ?? 0}.`
        );
      } while (!finished && continueToken);
      await reloadQueryRegistry();
      setQueryProgress("Import Query Registry selesai.");
    } catch (cause) {
      setQueryError(cause instanceof Error ? cause.message : "Import Query Registry gagal.");
    } finally {
      setQueryAction("");
    }
  }

  async function runImportVariableRegistry() {
    setVariableAction("import");
    setVariableError("");
    setVariableProgress("Menyiapkan import Variable Registry dari XLS ABT dan placeholder sumber lama...");
    try {
      let continueToken: string | null = null;
      let finished = false;
      do {
        const result: ImportRegistryResult = await fetch(apiPath("/api/aleta-sipp/admin/variable-registry/import-all"), {
          method: "POST",
          cache: "no-store",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ batchSize: 500, continueToken }),
        }).then((response) => readApi<ImportRegistryResult>(response));
        finished = result.finished;
        continueToken = result.continueToken;
        setVariableProgress(
          `Import Variable Registry: ${Math.min(result.nextOffset, result.totalCandidates)} / ${result.totalCandidates}. Batch ${result.processed}, gagal ${result.failed}, template ${result.templateLinkCount ?? 0}.`
        );
      } while (!finished && continueToken);
      await reloadVariableRegistry();
      setVariableProgress("Import Variable Registry selesai.");
    } catch (cause) {
      setVariableError(cause instanceof Error ? cause.message : "Import Variable Registry gagal.");
    } finally {
      setVariableAction("");
    }
  }

  async function runAnalyzeSelectedQuery() {
    if (!selectedQueryKey) return;
    setQueryAction("analyze");
    setQueryError("");
    try {
      const detail = await fetch(apiPath(`/api/aleta-sipp/admin/query-registry/${encodeURIComponent(selectedQueryKey)}/analyze`), {
        method: "POST",
        cache: "no-store",
        credentials: "include",
      }).then((response) => readApi<QueryRegistryDetail>(response));
      setQueryDetail(detail);
      await reloadQueryRegistry();
    } catch (cause) {
      setQueryError(cause instanceof Error ? cause.message : "Analisis query gagal.");
    } finally {
      setQueryAction("");
    }
  }

  async function runAnalyzeSelectedVariable() {
    if (!selectedVariableKey) return;
    setVariableAction("analyze");
    setVariableError("");
    try {
      const detail = await fetch(apiPath(`/api/aleta-sipp/admin/variable-registry/${encodeURIComponent(selectedVariableKey)}/analyze`), {
        method: "POST",
        cache: "no-store",
        credentials: "include",
      }).then((response) => readApi<VariableRegistryDetail>(response));
      setVariableDetail(detail);
      await reloadVariableRegistry();
    } catch (cause) {
      setVariableError(cause instanceof Error ? cause.message : "Analisis variabel gagal.");
    } finally {
      setVariableAction("");
    }
  }

  async function saveQueryEdit() {
    if (!selectedQueryKey) return;
    setQueryAction("save");
    setQueryError("");
    try {
      const detail = await fetch(apiPath(`/api/aleta-sipp/admin/query-registry/${encodeURIComponent(selectedQueryKey)}`), {
        method: "PATCH",
        cache: "no-store",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(queryEditDraft),
      }).then((response) => readApi<QueryRegistryDetail>(response));
      setQueryDetail(detail);
      setQueryEditMode(false);
      await reloadQueryRegistry();
    } catch (cause) {
      setQueryError(cause instanceof Error ? cause.message : "Simpan Query Registry gagal.");
    } finally {
      setQueryAction("");
    }
  }

  async function saveVariableEdit() {
    if (!selectedVariableKey) return;
    setVariableAction("save");
    setVariableError("");
    try {
      const detail = await fetch(apiPath(`/api/aleta-sipp/admin/variable-registry/${encodeURIComponent(selectedVariableKey)}`), {
        method: "PATCH",
        cache: "no-store",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(variableEditDraft),
      }).then((response) => readApi<VariableRegistryDetail>(response));
      setVariableDetail(detail);
      setVariableEditMode(false);
      await reloadVariableRegistry();
    } catch (cause) {
      setVariableError(cause instanceof Error ? cause.message : "Simpan Variable Registry gagal.");
    } finally {
      setVariableAction("");
    }
  }

  async function convertLegacyText() {
    setConvertAction("convert");
    setVariableError("");
    try {
      const result = await fetch(apiPath("/api/aleta-sipp/variable-registry/convert-legacy-text"), {
        method: "POST",
        cache: "no-store",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: legacyText }),
      }).then((response) => readApi<ConvertLegacyTextResult>(response));
      setConvertResult(result);
    } catch (cause) {
      setVariableError(cause instanceof Error ? cause.message : "Konversi narasi sumber lama gagal.");
    } finally {
      setConvertAction("");
    }
  }

  async function reloadMonitoring() {
    const indicatorParams = new URLSearchParams({
      page: String(monitoringFilters.page),
      pageSize: String(monitoringFilters.pageSize),
    });
    if (monitoringFilters.q.trim()) indicatorParams.set("q", monitoringFilters.q.trim());
    if (monitoringFilters.sourceType) indicatorParams.set("sourceType", monitoringFilters.sourceType);
    if (monitoringFilters.category) indicatorParams.set("category", monitoringFilters.category);
    if (monitoringFilters.status) indicatorParams.set("status", monitoringFilters.status);
    if (monitoringFilters.reviewStatus) indicatorParams.set("reviewStatus", monitoringFilters.reviewStatus);

    const runParams = new URLSearchParams({
      page: String(runFilters.page),
      pageSize: String(runFilters.pageSize),
    });
    if (runFilters.runType) runParams.set("runType", runFilters.runType);
    if (runFilters.year) runParams.set("year", String(runFilters.year));
    if (runFilters.quarter) runParams.set("quarter", String(runFilters.quarter));
    if (runFilters.status) runParams.set("status", runFilters.status);

    const [stats, indicators, runs, options] = await Promise.all([
      fetch(apiPath("/api/aleta-sipp/monitoring/stats"), { cache: "no-store", credentials: "include" }).then((response) =>
        readApi<MonitoringStats>(response)
      ),
      fetch(apiPath(`/api/aleta-sipp/monitoring/indicators?${indicatorParams.toString()}`), { cache: "no-store", credentials: "include" }).then((response) =>
        readApi<MonitoringIndicatorList>(response)
      ),
      fetch(apiPath(`/api/aleta-sipp/monitoring/runs?${runParams.toString()}`), { cache: "no-store", credentials: "include" }).then((response) =>
        readApi<MonitoringRunList>(response)
      ),
      fetch(apiPath(`/api/aleta-sipp/monitoring/triwulan/options?year=${runForm.year}`), { cache: "no-store", credentials: "include" }).then((response) =>
        readApi<TriwulanOptions>(response)
      ),
    ]);
    setMonitoringStats(stats);
    setMonitoringIndicators(indicators);
    setMonitoringRuns(runs);
    setTriwulanOptions(options);
  }

  async function reloadPendukungFeatures() {
    const params = new URLSearchParams({
      page: String(pendukungFeatureFilters.page),
      pageSize: String(pendukungFeatureFilters.pageSize),
    });
    if (pendukungFeatureFilters.q.trim()) params.set("q", pendukungFeatureFilters.q.trim());
    if (pendukungFeatureFilters.groupKey) params.set("groupKey", pendukungFeatureFilters.groupKey);
    if (pendukungFeatureFilters.implementationStatus) params.set("implementationStatus", pendukungFeatureFilters.implementationStatus);
    if (pendukungFeatureFilters.safetyStatus) params.set("safetyStatus", pendukungFeatureFilters.safetyStatus);
    if (pendukungFeatureFilters.reviewStatus) params.set("reviewStatus", pendukungFeatureFilters.reviewStatus);
    const list = await fetch(apiPath(`/api/aleta-sipp/monitoring-features?${params.toString()}`), {
      cache: "no-store",
      credentials: "include",
    }).then((response) => readApi<Pendukung2018FeatureList>(response));
    setPendukungFeatures(list);
  }

  async function reloadExternalConnectors() {
    const list = await fetch(apiPath("/api/aleta-sipp/admin/monitoring/external-connectors"), {
      cache: "no-store",
      credentials: "include",
    }).then((response) => readApi<ExternalConnectorList>(response));
    setExternalConnectors(list);
    setConnectorDrafts((current) => {
      const next = { ...current };
      for (const row of list.rows) {
        if (!next[row.featureKey]) {
          next[row.featureKey] = {
            connectorName: row.connectorName || row.featureName,
            endpoint: row.endpoint || "",
            host: row.host || "",
            credentialReference: row.credentialReference || "",
          };
        }
      }
      return next;
    });
  }

  function loadPendukungFeatureDetail(featureKey: string) {
    setPendukungFeatureDetailLoading(true);
    setPendukungFeatureDetail(null);
    setSelectedPendukungFeatureKey(featureKey);
  }

  function closePendukungFeatureDetail() {
    setSelectedPendukungFeatureKey("");
    setPendukungFeatureDetail(null);
    setPendukungFeatureDetailLoading(false);
  }

  function loadMonitoringIndicatorDetail(indicatorKey: string) {
    setMonitoringIndicatorDetailLoading(true);
    setMonitoringIndicatorDetail(null);
    setManualInputDraft({ value: "", notes: "", evidence: "" });
    setSelectedMonitoringIndicatorKey(indicatorKey);
  }

  function closeMonitoringIndicatorDetail() {
    setSelectedMonitoringIndicatorKey("");
    setMonitoringIndicatorDetail(null);
    setMonitoringIndicatorDetailLoading(false);
    setManualInputDraft({ value: "", notes: "", evidence: "" });
  }

  function loadRunDetail(runKey: string) {
    setRunDetailLoading(true);
    setMonitoringItemsLoading(true);
    setSelectedRunDetail(null);
    setSelectedRunResults(null);
    setMonitoringItems(null);
    setSelectedResultItemFilter("");
    setSelectedRunKey(runKey);
  }

  function closeRunDetail() {
    setSelectedRunKey("");
    setSelectedRunDetail(null);
    setSelectedRunResults(null);
    setMonitoringItems(null);
    setSelectedResultItemFilter("");
    setRunDetailLoading(false);
  }

  async function loadRunResultItems(resultId?: string) {
    if (!selectedRunKey && !resultId) return;
    const params = new URLSearchParams({ page: "1", pageSize: "50" });
    if (selectedRunKey) params.set("runKey", selectedRunKey);
    if (resultId) params.set("resultId", resultId);
    setMonitoringItemsLoading(true);
    setMonitoringError("");
    try {
      const items = await fetch(apiPath(`/api/aleta-sipp/monitoring/items?${params.toString()}`), {
        cache: "no-store",
        credentials: "include",
      }).then((response) => readApi<MonitoringItemsResponse>(response));
      setMonitoringItems(items);
      setSelectedResultItemFilter(resultId ?? "");
      router.push(`/aleta-sipp?section=temuan`);
    } catch (cause) {
      setMonitoringError(cause instanceof Error ? cause.message : "Temuan monitoring belum berhasil dimuat.");
    } finally {
      setMonitoringItemsLoading(false);
    }
  }

  async function markMonitoringItemDone(itemId: string) {
    setMonitoringAction(`followup-${itemId}`);
    setMonitoringError("");
    try {
      await fetch(apiPath(`/api/aleta-sipp/monitoring/items/${encodeURIComponent(itemId)}/follow-up`), {
        method: "PATCH",
        cache: "no-store",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ followupStatus: "SELESAI", itemStatus: "SELESAI" }),
      }).then((response) => readApi<Record<string, unknown>>(response));
      await loadRunResultItems(selectedResultItemFilter || undefined);
      setMonitoringProgress("Tindak lanjut temuan diperbarui.");
    } catch (cause) {
      setMonitoringError(cause instanceof Error ? cause.message : "Tindak lanjut temuan gagal diperbarui.");
    } finally {
      setMonitoringAction("");
    }
  }

  async function runMonitoringAdminAction(action: string, endpoint: string, progress: string) {
    setMonitoringAction(action);
    setMonitoringError("");
    setMonitoringProgress(progress);
    try {
      const result = await fetch(apiPath(endpoint), {
        method: "POST",
        cache: "no-store",
        credentials: "include",
      }).then((response) => readApi<Record<string, unknown>>(response));
      await reloadMonitoring();
      if (activeTab === "pendukung2018") await reloadPendukungFeatures();
      const imported = result.importedIndicators ?? result.indicatorCount ?? result.created ?? 0;
      setMonitoringProgress(`${progress} Selesai. Item utama: ${numericText(imported)}.`);
    } catch (cause) {
      setMonitoringError(cause instanceof Error ? cause.message : "Aksi monitoring gagal.");
    } finally {
      setMonitoringAction("");
    }
  }

  function importPendukung2018() {
    return runMonitoringAdminAction(
      "import-pendukung2018",
      "/api/aleta-sipp/admin/monitoring-features/import-catalog",
      "Sinkronisasi katalog 65 fitur monitoring sedang berjalan."
    );
  }

  function importSkSipp() {
    return runMonitoringAdminAction(
      "import-sk-sipp",
      "/api/aleta-sipp/admin/monitoring/import-sk-sipp",
      "Import SK PENILAIAN SIPP 2024.pdf sedang berjalan."
    );
  }

  function generateIndicatorMapping() {
    return runMonitoringAdminAction(
      "map-indicators",
      "/api/aleta-sipp/admin/monitoring/map-indicators",
      "Membuat mapping otomatis katalog monitoring ke indikator SK."
    );
  }

  async function autoReviewMonitoringQueries(featureKey?: string) {
    const action = featureKey ? `auto-review-${featureKey}` : "auto-review-monitoring";
    setMonitoringAction(action);
    setMonitoringError("");
    setMonitoringProgress("Auto-review query monitoring sedang berjalan.");
    try {
      const result = await fetch(apiPath("/api/aleta-sipp/admin/monitoring-features/auto-review"), {
        method: "POST",
        cache: "no-store",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ featureKeys: featureKey ? [featureKey] : undefined, includeReviewed: Boolean(featureKey) }),
      }).then((response) => readApi<AutoReviewResult>(response));
      await Promise.all([reloadMonitoring(), reloadPendukungFeatures()]);
      if (featureKey) {
        const detail = await fetch(apiPath(`/api/aleta-sipp/monitoring-features/${encodeURIComponent(featureKey)}`), {
          cache: "no-store",
          credentials: "include",
        }).then((response) => readApi<Pendukung2018FeatureDetail>(response));
        setPendukungFeatureDetail(detail);
      }
      setMonitoringProgress(`Auto-review selesai. Dipromosikan: ${numericText(result.successCount)}, perlu konfigurasi: ${numericText(result.warningCount)}.`);
    } catch (cause) {
      setMonitoringError(cause instanceof Error ? cause.message : "Auto-review query monitoring gagal.");
    } finally {
      setMonitoringAction("");
    }
  }

  async function runMonitoringJob(runType: "PENDUKUNG2018_MONITORING" | "SK_TRIWULAN_ASSESSMENT" | "COMBINED_EVALUATION", dryRun = true) {
    const quarterOption = triwulanOptions?.options.find((item) => item.quarter === runForm.quarter);
    const dateStart = runForm.dateStart || (runType === "PENDUKUNG2018_MONITORING" ? `${runForm.year}-01-01` : quarterOption?.dateStart) || `${runForm.year}-01-01`;
    const dateEnd = runForm.dateEnd || (runType === "PENDUKUNG2018_MONITORING" ? `${runForm.year}-12-31` : quarterOption?.dateEnd) || `${runForm.year}-12-31`;
    setMonitoringAction(`run-${runType}`);
    setMonitoringError("");
    setMonitoringProgress(`${dryRun ? "Simulasi" : "Run"} ${formatRunTypeLabel(runType)} untuk periode ${dateStart} sampai ${dateEnd}.`);
    try {
      const detail = await fetch(apiPath("/api/aleta-sipp/monitoring/run"), {
        method: "POST",
        cache: "no-store",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          runType,
          year: runForm.year,
          quarter: runType === "PENDUKUNG2018_MONITORING" ? undefined : runForm.quarter,
          dateStart,
          dateEnd,
          datasourceMode: runForm.datasourceMode,
          dryRun,
        }),
      }).then((response) => readApi<MonitoringRunDetail>(response));
      await reloadMonitoring();
      setSelectedRunKey(detail.run_key);
      setSelectedRunDetail(detail);
      setMonitoringProgress(`Run tersimpan: ${detail.run_key}. ${numericText(detail.total_indicators)} indikator diproses.`);
    } catch (cause) {
      setMonitoringError(cause instanceof Error ? cause.message : "Run monitoring gagal.");
    } finally {
      setMonitoringAction("");
    }
  }

  async function runPendukungFeature(featureKey: string, dryRun = true) {
    const dateStart = runForm.dateStart || `${runForm.year}-01-01`;
    const dateEnd = runForm.dateEnd || `${runForm.year}-12-31`;
    setMonitoringAction(`run-feature-${featureKey}`);
    setMonitoringError("");
    setMonitoringProgress(`${dryRun ? "Dry-run" : "Run"} fitur monitoring untuk periode ${dateStart} sampai ${dateEnd}.`);
    try {
      const detail = await fetch(apiPath("/api/aleta-sipp/monitoring/run"), {
        method: "POST",
        cache: "no-store",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          runType: "PENDUKUNG2018_MONITORING",
          year: runForm.year,
          dateStart,
          dateEnd,
          datasourceMode: runForm.datasourceMode,
          selectedFeatureKeys: [featureKey],
          dryRun,
        }),
      }).then((response) => readApi<MonitoringRunDetail>(response));
      await Promise.all([reloadMonitoring(), reloadPendukungFeatures()]);
      setSelectedRunKey(detail.run_key);
      setSelectedRunDetail(detail);
      setMonitoringProgress(`Run fitur tersimpan: ${detail.run_key}.`);
    } catch (cause) {
      setMonitoringError(cause instanceof Error ? cause.message : "Run fitur monitoring gagal.");
    } finally {
      setMonitoringAction("");
    }
  }

  async function reviewMonitoringFeatureQuery(featureKey: string) {
    setMonitoringAction(`review-feature-${featureKey}`);
    setMonitoringError("");
    try {
      const detail = await fetch(apiPath(`/api/aleta-sipp/admin/monitoring-features/${encodeURIComponent(featureKey)}/review-query`), {
        method: "POST",
        cache: "no-store",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "PROMOTE_SAFE_READ_ONLY", notes: "Review admin dari UI katalog monitoring." }),
      }).then((response) => readApi<Pendukung2018FeatureDetail>(response));
      setPendukungFeatureDetail(detail);
      await Promise.all([reloadMonitoring(), reloadPendukungFeatures()]);
      setMonitoringProgress("Query monitoring direview dan dipromosikan sebagai read-only bila valid.");
    } catch (cause) {
      setMonitoringError(cause instanceof Error ? cause.message : "Review query monitoring gagal.");
    } finally {
      setMonitoringAction("");
    }
  }

  async function saveManualInputForSelected(status: "DRAFT" | "SUBMITTED" | "REVIEWED" | "APPROVED" = "SUBMITTED") {
    if (!selectedMonitoringIndicatorKey) return;
    const quarterOption = triwulanOptions?.options.find((item) => item.quarter === runForm.quarter);
    setMonitoringAction("manual-input");
    setMonitoringError("");
    try {
      await fetch(apiPath("/api/aleta-sipp/admin/monitoring/manual-input"), {
        method: "POST",
        cache: "no-store",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          indicatorKey: selectedMonitoringIndicatorKey,
          periodStart: runForm.dateStart || quarterOption?.dateStart || `${runForm.year}-01-01`,
          periodEnd: runForm.dateEnd || quarterOption?.dateEnd || `${runForm.year}-12-31`,
          value: manualInputDraft.value,
          notes: manualInputDraft.notes,
          status,
          evidence: manualInputDraft.evidence.trim() ? [{ note: manualInputDraft.evidence.trim(), type: "CATATAN" }] : [],
        }),
      }).then((response) => readApi(response));
      setManualInputDraft({ value: "", notes: "", evidence: "" });
      setMonitoringProgress(`Input manual indikator tersimpan sebagai ${formatStatusLabel(status)}.`);
    } catch (cause) {
      setMonitoringError(cause instanceof Error ? cause.message : "Input manual gagal disimpan.");
    } finally {
      setMonitoringAction("");
    }
  }

  async function saveFormulaForSelected() {
    if (!selectedMonitoringIndicatorKey) return;
    setMonitoringAction("formula-config");
    setMonitoringError("");
    try {
      const detail = await fetch(apiPath(`/api/aleta-sipp/admin/monitoring/indicators/${encodeURIComponent(selectedMonitoringIndicatorKey)}/formula`), {
        method: "PATCH",
        cache: "no-store",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...formulaDraft,
          weight: Number(formulaDraft.weight || 0),
          maxScore: Number(formulaDraft.maxScore || 100),
          thresholdGreen: Number(formulaDraft.thresholdGreen || 90),
          thresholdYellow: Number(formulaDraft.thresholdYellow || 60),
          thresholdRed: Number(formulaDraft.thresholdRed || 0),
        }),
      }).then((response) => readApi<MonitoringIndicatorDetail>(response));
      setMonitoringIndicatorDetail(detail);
      setFormulaDraft(formulaDraftFromIndicator(detail));
      await reloadMonitoring();
      setMonitoringProgress("Konfigurasi formula indikator tersimpan.");
    } catch (cause) {
      setMonitoringError(cause instanceof Error ? cause.message : "Konfigurasi formula gagal disimpan.");
    } finally {
      setMonitoringAction("");
    }
  }

  async function saveExternalConnector(featureKey: string, testConnection = false) {
    const draft = connectorDrafts[featureKey];
    setMonitoringAction(`connector-${featureKey}`);
    setMonitoringError("");
    try {
      await fetch(apiPath("/api/aleta-sipp/admin/monitoring/external-connectors"), {
        method: "POST",
        cache: "no-store",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ featureKey, mode: "READ_ONLY", testConnection, ...draft }),
      }).then((response) => readApi<Record<string, unknown>>(response));
      await reloadExternalConnectors();
      setMonitoringProgress(testConnection ? "Status konektor diperiksa." : "Konfigurasi konektor tersimpan.");
    } catch (cause) {
      setMonitoringError(cause instanceof Error ? cause.message : "Konfigurasi konektor gagal disimpan.");
    } finally {
      setMonitoringAction("");
    }
  }

  const metrics = useMemo(() => {
    if (!summary) return [];
    return [
      { label: "Tabel Metadata", value: summary.counts.tables, hint: `${summary.counts.columns} kolom tersimpan di ALETA`, icon: Database },
      { label: "Query Registry", value: summary.counts.queries, hint: "Whitelist SELECT/read-only, tanpa raw SQL client", icon: Search },
      { label: "Variabel", value: summary.counts.variables, hint: "Cache variable registry ABT/SIPP", icon: BookOpenText },
      { label: "Indikator SK", value: summary.counts.assessmentIndicators, hint: "Cache penilaian SIPP", icon: ShieldCheck },
    ];
  }, [summary]);
  const canManageDictionary = Boolean(summary?.access.isAdmin || summary?.access.isSuperAdmin);
  const canManageMonitoring = canManageDictionary;
  const selectedQuarterOption = triwulanOptions?.options.find((item) => item.quarter === runForm.quarter);
  const pendukungStatusCount = (status: string) => pendukungFeatures?.statuses.find((item) => item.status === status)?.count ?? 0;
  const pendukungSafetyCount = (status: string) => pendukungFeatures?.safetyStatuses.find((item) => item.status === status)?.count ?? 0;
  const pendukungReadyCount = pendukungStatusCount("READY_READ_ONLY") + pendukungStatusCount("READY_OPERATIONAL") + pendukungStatusCount("READY_WITH_DATASOURCE") + pendukungStatusCount("READY_WITH_AUTO_REVIEWED_QUERY");
  const pendukungPartialCount = pendukungStatusCount("PARTIAL_READ_ONLY") + pendukungStatusCount("QUERY_NEEDS_REVIEW") + pendukungStatusCount("SCHEMA_MAPPING_REQUIRED") + pendukungStatusCount("FORMULA_CONFIGURATION_REQUIRED") + pendukungStatusCount("REPORT_TEMPLATE_REQUIRED");
  const pendukungManualCount = pendukungSafetyCount("PERLU_INPUT_MANUAL") + pendukungStatusCount("MANUAL_INPUT_READY");
  const pendukungExternalCount = pendukungSafetyCount("EXTERNAL_CONNECTOR_REQUIRED");
  const monitoringMetrics = [
    { label: "Katalog Monitoring", value: monitoringStats?.pendukung2018Indicators ?? 0, icon: Activity },
    { label: "Indikator SK", value: monitoringStats?.skIndicators ?? 0, icon: BarChart3 },
    { label: "Siap Jalan", value: monitoringStats?.readyIndicators ?? 0, icon: ShieldCheck },
    { label: "Perlu Review", value: monitoringStats?.needsReviewIndicators ?? 0, icon: AlertTriangle },
  ];
  const monitoringItemRows = monitoringItems?.rows ?? [];
  const mappingTotal = monitoringStats?.mappings.reduce((total, item) => total + item.count, 0) ?? 0;

  function renderMonitoringNotice() {
    return (
      <>
        {monitoringError ? (
          <Card className="border-rose-200 bg-rose-50/60 dark:border-rose-900/50 dark:bg-rose-950/30">
            <CardContent className="flex items-center gap-3 p-4 text-sm text-rose-700 dark:text-rose-300">
              <AlertTriangle className="h-4 w-4" />
              {monitoringError}
            </CardContent>
          </Card>
        ) : null}
        {monitoringProgress ? (
          <Card className="border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/50 dark:bg-emerald-950/30">
            <CardContent className="p-4 text-sm text-emerald-800 dark:text-emerald-300">{monitoringProgress}</CardContent>
          </Card>
        ) : null}
      </>
    );
  }

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="ALETA x SIPP"
        title="Pusat Pengetahuan SIPP"
        description="Kamus database, query registry, variabel ABT/SIPP, monitoring penilaian, dan jadwal sidang membaca metadata/cache ALETA secara read-only."
        actions={
          <Button asChild variant="outline">
            <Link href={apiPath("/api/aleta-sipp/schedule/pdf")} target="_blank">
              <Download className="h-4 w-4" />
              PDF Jadwal
            </Link>
          </Button>
        }
      />

      {loading ? (
        <Card className="border-border/80">
          <CardContent className="flex items-center gap-3 p-5 text-sm text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Memuat metadata/cache ALETA x SIPP.
          </CardContent>
        </Card>
      ) : null}

      {error ? (
        <Card className="border-rose-200 bg-rose-50/60 dark:border-rose-900/50 dark:bg-rose-950/30">
          <CardContent className="flex items-center gap-3 p-5 text-sm text-rose-700 dark:text-rose-300">
            <AlertTriangle className="h-4 w-4" />
            {error}
          </CardContent>
        </Card>
      ) : null}

      {summary ? (
        <Tabs
          value={tabItems.some((item) => item.value === activeTab) ? activeTab : "dashboard"}
          onValueChange={(value) => router.push(value === "dashboard" ? "/aleta-sipp" : `/aleta-sipp?section=${value}`)}
          className="space-y-5"
        >
          <div className="overflow-x-auto">
            <TabsList className="min-w-max">
              {tabItems.map((item) => (
                <TabsTrigger key={item.value} value={item.value}>
                  {item.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <TabsContent value="dashboard" className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {metrics.map((metric) => {
                const Icon = metric.icon;
                return (
                  <Card key={metric.label} className="border-border/80">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <CardDescription className="uppercase tracking-[0.16em]">{metric.label}</CardDescription>
                        <Icon className="h-4 w-4 text-primary" />
                      </div>
                      <CardTitle className="text-3xl">{metric.value}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">{metric.hint}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <Card className="border-border/80">
                <CardHeader>
                  <CardTitle>Status Datasource</CardTitle>
                  <CardDescription>Dashboard membaca metadata/cache ALETA; import dan scan hanya dari admin.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-border/80 p-3">
                    <span>Mode datasource</span>
                    <Badge variant={summary.datasource.readOnly ? "success" : "warning"}>{summary.datasource.mode}</Badge>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-border/80 p-3">
                    <span>Status metadata</span>
                    <Badge variant={statusVariant(summary.metadataStatus)}>{summary.metadataStatus}</Badge>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-border/80 p-3">
                    <span>Koneksi ALETA Bot</span>
                    <Badge variant={summary.datasource.productionReady ? "success" : "warning"}>{summary.datasource.connectionKey}</Badge>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-border/80 p-3">
                    <span>Import terakhir</span>
                    <Badge variant={statusVariant(summary.lastImport?.status ?? "BELUM_IMPORT_METADATA")}>{summary.lastImport?.status ?? "Belum ada"}</Badge>
                  </div>
                  <p className="break-all rounded-xl border border-border/80 p-3 text-xs text-muted-foreground">
                    SQL dump local/testing: {summary.datasource.sqlDumpPath}
                  </p>
                </CardContent>
              </Card>

              <Card className="border-border/80">
                <CardHeader>
                  <CardTitle>Guardrail</CardTitle>
                  <CardDescription>Aturan fondasi yang aktif pada modul baru.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {summary.safetyNotes.map((note) => (
                    <div key={note} className="flex gap-2 rounded-xl border border-border/80 p-3 text-sm text-muted-foreground">
                      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>{note}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="kamus" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              {[
                { label: "Total Tabel", value: dictionaryStats?.totalTables ?? summary.counts.tables },
                { label: "Total Kolom", value: dictionaryStats?.totalColumns ?? summary.counts.columns },
                { label: "Analyzed", value: dictionaryStats?.analyzedTables ?? 0 },
                { label: "Partial", value: dictionaryStats?.partialTables ?? 0 },
                { label: "Needs Review", value: (dictionaryStats?.needsReviewTables ?? 0) + (dictionaryStats?.unknownTables ?? 0) },
              ].map((item) => (
                <Card key={item.label} className="border-border/80">
                  <CardHeader className="pb-3">
                    <CardDescription className="uppercase tracking-[0.14em]">{item.label}</CardDescription>
                    <CardTitle className="text-2xl">{item.value}</CardTitle>
                  </CardHeader>
                </Card>
              ))}
            </div>

            {dictionaryError ? (
              <Card className="border-rose-200 bg-rose-50/60 dark:border-rose-900/50 dark:bg-rose-950/30">
                <CardContent className="flex items-center gap-3 p-4 text-sm text-rose-700 dark:text-rose-300">
                  <AlertTriangle className="h-4 w-4" />
                  {dictionaryError}
                </CardContent>
              </Card>
            ) : null}

            {dictionaryProgress ? (
              <Card className="border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/50 dark:bg-emerald-950/30">
                <CardContent className="p-4 text-sm text-emerald-800 dark:text-emerald-300">{dictionaryProgress}</CardContent>
              </Card>
            ) : null}

            <Card className="border-border/80">
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle>Kamus Database SIPP</CardTitle>
                    <CardDescription>Daftar ringan memakai pagination server-side; detail kolom dimuat setelah tabel dipilih.</CardDescription>
                  </div>
                  {canManageDictionary ? (
                    <Button onClick={runAnalyzeAllDictionary} disabled={Boolean(dictionaryAction)}>
                      {dictionaryAction === "analyze-all" ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                      Lengkapi Analisis Semua Tabel
                    </Button>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 lg:grid-cols-[1.3fr_0.9fr_0.8fr_0.9fr_auto]">
                  <label className="space-y-1 text-sm">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Cari</span>
                    <input
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                      placeholder="Nama tabel atau nama manusiawi"
                      value={dictionaryFilters.q}
                      onChange={(event) => setDictionaryFilters((current) => ({ ...current, q: event.target.value, page: 1 }))}
                    />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Kategori</span>
                    <select
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                      value={dictionaryFilters.category}
                      onChange={(event) => setDictionaryFilters((current) => ({ ...current, category: event.target.value, page: 1 }))}
                    >
                      <option value="">Semua kategori</option>
                      {(dictionaryList?.categories ?? []).map((item) => (
                        <option key={item.category} value={item.category}>
                          {item.category} ({item.count})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Analisis</span>
                    <select
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                      value={dictionaryFilters.analysisStatus}
                      onChange={(event) => setDictionaryFilters((current) => ({ ...current, analysisStatus: event.target.value, page: 1 }))}
                    >
                      <option value="">Semua</option>
                      <option value="ANALYZED">{formatStatusLabel("ANALYZED")}</option>
                      <option value="PARTIAL">{formatStatusLabel("PARTIAL")}</option>
                      <option value="NEEDS_REVIEW">{formatStatusLabel("NEEDS_REVIEW")}</option>
                      <option value="UNKNOWN">{formatStatusLabel("UNKNOWN")}</option>
                    </select>
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Review</span>
                    <select
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                      value={dictionaryFilters.reviewStatus}
                      onChange={(event) => setDictionaryFilters((current) => ({ ...current, reviewStatus: event.target.value, page: 1 }))}
                    >
                      <option value="">Semua</option>
                      <option value="AUTO_GENERATED">{formatStatusLabel("AUTO_GENERATED")}</option>
                      <option value="ADMIN_REVIEWED">{formatStatusLabel("ADMIN_REVIEWED")}</option>
                      <option value="NEEDS_ADMIN_REVIEW">{formatStatusLabel("NEEDS_ADMIN_REVIEW")}</option>
                    </select>
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Per halaman</span>
                    <select
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                      value={dictionaryFilters.pageSize}
                      onChange={(event) => setDictionaryFilters((current) => ({ ...current, pageSize: Number(event.target.value), page: 1 }))}
                    >
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                    </select>
                  </label>
                </div>

                <div className="space-y-3">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                      <span>
                        {dictionaryLoading ? "Memuat tabel..." : `${dictionaryList?.pagination.total ?? 0} tabel ditemukan`}
                      </span>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDictionaryFilters((current) => ({ ...current, page: Math.max(1, current.page - 1) }))}
                          disabled={dictionaryFilters.page <= 1 || dictionaryLoading}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span>
                          Hal. {dictionaryList?.pagination.page ?? dictionaryFilters.page} / {dictionaryList?.pagination.totalPages ?? 1}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDictionaryFilters((current) => ({ ...current, page: current.page + 1 }))}
                          disabled={dictionaryLoading || dictionaryFilters.page >= (dictionaryList?.pagination.totalPages ?? 1)}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="overflow-x-auto rounded-md border border-border/80">
                      <table className="w-full min-w-[920px] text-left text-sm">
                        <thead className="bg-muted/70 text-xs uppercase tracking-[0.12em] text-muted-foreground">
                          <tr>
                            <th className="px-3 py-3 font-semibold">Tabel</th>
                            <th className="px-3 py-3 font-semibold">Nama Manusiawi</th>
                            <th className="px-3 py-3 font-semibold">Kategori</th>
                            <th className="px-3 py-3 font-semibold">Penjelasan Singkat</th>
                            <th className="px-3 py-3 font-semibold">Kolom</th>
                            <th className="px-3 py-3 font-semibold">Relasi</th>
                            <th className="px-3 py-3 font-semibold">Status</th>
                            <th className="px-3 py-3 font-semibold">Aksi</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(dictionaryList?.rows ?? []).map((table) => (
                            <tr key={table.tableName} className="border-t border-border/70 align-top">
                              <td className="px-3 py-3 font-mono text-xs">{table.tableName}</td>
                              <td className="px-3 py-3 font-medium">{table.humanName}</td>
                              <td className="px-3 py-3"><Badge variant="outline">{table.category}</Badge></td>
                              <td className="max-w-[360px] px-3 py-3 text-muted-foreground">{table.shortDescription}</td>
                              <td className="px-3 py-3">{table.columnCount}</td>
                              <td className="px-3 py-3">{table.relationCount}</td>
                              <td className="px-3 py-3">
                                <div className="flex flex-col gap-1">
                                  <Badge variant={statusVariant(table.analysisStatus)}>{table.analysisStatus}</Badge>
                                  <span className="text-xs text-muted-foreground">{table.confidenceScore}%</span>
                                </div>
                              </td>
                              <td className="px-3 py-3">
                                <Button size="sm" variant="outline" onClick={() => loadDictionaryDetail(table.tableName)}>
                                  <Eye className="h-4 w-4" />
                                  Detail
                                </Button>
                              </td>
                            </tr>
                          ))}
                          {dictionaryList?.rows.length === 0 ? (
                            <tr>
                              <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                                Tidak ada tabel sesuai filter.
                              </td>
                            </tr>
                          ) : null}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {canRenderDetailPortal && selectedTableName ? createPortal((
                    <div
                      className="fixed inset-0 z-[100] flex items-start justify-center overflow-hidden bg-slate-950/75 px-4 pb-[6vh] pt-[7vh] backdrop-blur-sm"
                      role="dialog"
                      aria-modal="true"
                      aria-labelledby="dictionary-detail-title"
                      onClick={closeDictionaryDetail}
                    >
                  <Card className="max-h-[87vh] w-full max-w-6xl overflow-hidden border-border/80 bg-background shadow-2xl" onClick={(event) => event.stopPropagation()}>
                    <CardHeader className="sticky top-0 z-10 border-b border-border/80 bg-background/95 backdrop-blur">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <CardTitle id="dictionary-detail-title">{dictionaryDetail ? dictionaryDetail.table.humanName : "Detail Tabel"}</CardTitle>
                          <CardDescription>{selectedTableName || "Pilih tabel dari daftar untuk melihat penjelasan lengkap."}</CardDescription>
                        </div>
                        <div className="flex items-start gap-2">
                          {dictionaryDetail ? (
                            <div className="flex flex-wrap gap-2 pt-1">
                              <Badge variant={statusVariant(dictionaryDetail.table.analysisStatus)}>{dictionaryDetail.table.analysisStatus}</Badge>
                              <Badge variant="outline">{dictionaryDetail.table.reviewStatus}</Badge>
                            </div>
                          ) : null}
                          <Button type="button" variant="ghost" size="icon" className="shrink-0" onClick={closeDictionaryDetail} aria-label="Tutup detail tabel">
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="max-h-[calc(87vh-104px)] space-y-5 overflow-y-auto overscroll-contain p-5 text-sm">
                      {detailLoading ? (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          Memuat detail tabel.
                        </div>
                      ) : null}

                      {dictionaryDetail ? (
                        <>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="outline">{dictionaryDetail.table.category}</Badge>
                            <Badge variant="muted">{dictionaryDetail.table.columnCount} kolom</Badge>
                            <Badge variant="muted">{dictionaryDetail.table.relationCount} relasi</Badge>
                            <Badge variant="muted">Confidence {dictionaryDetail.table.confidenceScore}%</Badge>
                          </div>

                          <div className="space-y-2">
                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Penjelasan Lengkap</p>
                            {dictionaryDetail.longDescription.split("\n\n").map((paragraph) => (
                              <p key={paragraph.slice(0, 60)} className="leading-6 text-muted-foreground">{paragraph}</p>
                            ))}
                          </div>

                          <div className="grid gap-3 md:grid-cols-2">
                            <div className="rounded-md border border-border/80 p-3">
                              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Fungsi Bisnis</p>
                              <p className="leading-6 text-muted-foreground">{dictionaryDetail.businessFunction}</p>
                            </div>
                            <div className="rounded-md border border-border/80 p-3">
                              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Kolom Penting</p>
                              <p className="leading-6 text-muted-foreground">{dictionaryDetail.mainColumnsSummary}</p>
                            </div>
                          </div>

                          <div className="rounded-md border border-border/80 p-3">
                            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Contoh Query</p>
                            <pre className="overflow-auto rounded-md bg-muted/50 p-3 text-xs leading-5 text-muted-foreground">
                              {dictionaryDetail.exampleQueries.join("\n\n")}
                            </pre>
                          </div>

                          <div className="space-y-2">
                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Kolom</p>
                            <div className="max-h-[360px] overflow-auto rounded-md border border-border/80">
                              <table className="w-full min-w-[760px] text-left text-xs">
                                <thead className="bg-muted/70 text-muted-foreground">
                                  <tr>
                                    <th className="px-3 py-2 font-semibold">Kolom</th>
                                    <th className="px-3 py-2 font-semibold">Arti</th>
                                    <th className="px-3 py-2 font-semibold">Tipe</th>
                                    <th className="px-3 py-2 font-semibold">Nullable</th>
                                    <th className="px-3 py-2 font-semibold">Penjelasan</th>
                                    <th className="px-3 py-2 font-semibold">Status</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {dictionaryDetail.columns.map((column) => (
                                    <tr key={column.columnName} className="border-t border-border/70 align-top">
                                      <td className="px-3 py-2 font-mono">{column.columnName}</td>
                                      <td className="px-3 py-2 font-medium">{column.humanName}</td>
                                      <td className="px-3 py-2">{column.dataType}</td>
                                      <td className="px-3 py-2">{column.isNullable ? "Ya" : "Tidak"}</td>
                                      <td className="px-3 py-2 text-muted-foreground">{column.description}</td>
                                      <td className="px-3 py-2"><Badge variant={statusVariant(column.analysisStatus)}>{column.analysisStatus}</Badge></td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>

                          <div className="grid gap-3 md:grid-cols-2">
                            <div className="rounded-md border border-border/80 p-3">
                              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Relasi</p>
                              {dictionaryDetail.relations.length > 0 ? (
                                <div className="space-y-2">
                                  {dictionaryDetail.relations.slice(0, 10).map((relation) => (
                                    <p key={`${relation.sourceTable}-${relation.sourceColumn}-${relation.targetTable}`} className="font-mono text-xs text-muted-foreground">
                                      {relation.sourceTable}.{relation.sourceColumn} {"->"} {relation.targetTable}.{relation.targetColumn}
                                    </p>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-muted-foreground">Belum ada relasi tersimpan.</p>
                              )}
                            </div>
                            <div className="rounded-md border border-border/80 p-3">
                              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Catatan Risiko/Kualitas Data</p>
                              <p className="leading-6 text-muted-foreground">{dictionaryDetail.dataQualityNotes || dictionaryDetail.notes.riskNotes.join(" ")}</p>
                            </div>
                          </div>

                          <div className="grid gap-3 md:grid-cols-2">
                            <div className="rounded-md border border-border/80 p-3">
                              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Query Registry Terkait</p>
                              {dictionaryDetail.relatedQueryRegistry.length > 0 ? dictionaryDetail.relatedQueryRegistry.map((query) => (
                                <p key={query.queryKey} className="mb-2 text-muted-foreground">{query.queryKey} - {query.name}</p>
                              )) : <p className="text-muted-foreground">Belum ada query registry terkait.</p>}
                            </div>
                            <div className="rounded-md border border-border/80 p-3">
                              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Variabel Terkait</p>
                              {dictionaryDetail.relatedVariables.length > 0 ? dictionaryDetail.relatedVariables.map((variable) => (
                                <p key={variable.modernKey} className="mb-2 text-muted-foreground">{variable.modernKey} - {variable.displayName}</p>
                              )) : <p className="text-muted-foreground">Belum ada variabel terkait.</p>}
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <Button variant="outline" disabled>
                              <Search className="h-4 w-4" />
                              Tanya AI
                            </Button>
                            {canManageDictionary ? (
                              <>
                                <Button variant="outline" onClick={() => runAnalyzeSelectedTable(false)} disabled={Boolean(dictionaryAction)}>
                                  {dictionaryAction === "analyze-one" ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                                  Analisis Ulang Tabel Ini
                                </Button>
                                <Button variant="outline" onClick={() => setEditMode((value) => !value)}>
                                  <Edit3 className="h-4 w-4" />
                                  Edit Penjelasan
                                </Button>
                              </>
                            ) : null}
                          </div>

                          {editMode && canManageDictionary ? (
                            <div className="space-y-3 rounded-md border border-border/80 p-3">
                              <div className="grid gap-3 md:grid-cols-2">
                                <label className="space-y-1">
                                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Nama Manusiawi</span>
                                  <input className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={editDraft.humanName} onChange={(event) => setEditDraft((current) => ({ ...current, humanName: event.target.value }))} />
                                </label>
                                <label className="space-y-1">
                                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Kategori</span>
                                  <input className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={editDraft.category} onChange={(event) => setEditDraft((current) => ({ ...current, category: event.target.value }))} />
                                </label>
                              </div>
                              <label className="space-y-1 block">
                                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Penjelasan Singkat</span>
                                <textarea className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={editDraft.shortDescription} onChange={(event) => setEditDraft((current) => ({ ...current, shortDescription: event.target.value }))} />
                              </label>
                              <label className="space-y-1 block">
                                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Penjelasan Lengkap</span>
                                <textarea className="min-h-36 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={editDraft.longDescription} onChange={(event) => setEditDraft((current) => ({ ...current, longDescription: event.target.value }))} />
                              </label>
                              <label className="space-y-1 block">
                                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Catatan Risiko/Kualitas Data</span>
                                <textarea className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={editDraft.dataQualityNotes} onChange={(event) => setEditDraft((current) => ({ ...current, dataQualityNotes: event.target.value }))} />
                              </label>
                              <Button onClick={saveDictionaryEdit} disabled={dictionaryAction === "save-edit"}>
                                {dictionaryAction === "save-edit" ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Edit3 className="h-4 w-4" />}
                                Simpan Review Admin
                              </Button>
                            </div>
                          ) : null}
                        </>
                      ) : (
                        <p className="text-muted-foreground">Detail tabel sedang dimuat.</p>
                      )}
                    </CardContent>
                  </Card>
                    </div>
                  ), document.body) : null}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="query" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              {[
                { label: "Total Query", value: queryStats?.total ?? summary.counts.queries },
                { label: "Safe Read-only", value: queryStats?.safeReadOnly ?? 0 },
                { label: "Needs Review", value: queryStats?.needsReview ?? 0 },
                { label: "Rejected Write", value: queryStats?.rejectedWrite ?? 0 },
                { label: "Variable Links", value: queryStats?.variableLinks ?? 0 },
              ].map((item) => (
                <Card key={item.label} className="border-border/80">
                  <CardHeader className="pb-3">
                    <CardDescription className="uppercase tracking-[0.14em]">{item.label}</CardDescription>
                    <CardTitle className="text-2xl">{item.value}</CardTitle>
                  </CardHeader>
                </Card>
              ))}
            </div>

            {queryError ? (
              <Card className="border-rose-200 bg-rose-50/60 dark:border-rose-900/50 dark:bg-rose-950/30">
                <CardContent className="flex items-center gap-3 p-4 text-sm text-rose-700 dark:text-rose-300">
                  <AlertTriangle className="h-4 w-4" />
                  {queryError}
                </CardContent>
              </Card>
            ) : null}

            {queryProgress ? (
              <Card className="border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/50 dark:bg-emerald-950/30">
                <CardContent className="p-4 text-sm text-emerald-800 dark:text-emerald-300">{queryProgress}</CardContent>
              </Card>
            ) : null}

            <Card className="border-border/80">
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle>Query Registry SIPP</CardTitle>
                    <CardDescription>Daftar query tersimpan di metadata ALETA; halaman ini tidak parsing sumber lama saat dibuka.</CardDescription>
                  </div>
                  {canManageDictionary ? (
                    <Button onClick={runImportQueryRegistry} disabled={Boolean(queryAction)}>
                      {queryAction === "import" ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                      Import/Scan Query
                    </Button>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <label className="space-y-1 text-sm">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Cari</span>
                    <input
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                      placeholder="Query key, nama, kategori"
                      value={queryFilters.q}
                      onChange={(event) => setQueryFilters((current) => ({ ...current, q: event.target.value, page: 1 }))}
                    />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Kategori</span>
                    <select
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                      value={queryFilters.category}
                      onChange={(event) => setQueryFilters((current) => ({ ...current, category: event.target.value, page: 1 }))}
                    >
                      <option value="">Semua</option>
                      {(queryList?.categories ?? queryStats?.categories ?? []).map((item) => (
                        <option key={item.category} value={item.category}>{item.category} ({item.count})</option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Sumber</span>
                    <select
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                      value={queryFilters.sourceType}
                      onChange={(event) => setQueryFilters((current) => ({ ...current, sourceType: event.target.value, page: 1 }))}
                    >
                      <option value="">Semua</option>
                      {(queryList?.sources ?? queryStats?.sources ?? []).map((item) => (
                        <option key={item.sourceType} value={item.sourceType}>{item.sourceType} ({item.count})</option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Execution</span>
                    <select
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                      value={queryFilters.executionMode}
                      onChange={(event) => setQueryFilters((current) => ({ ...current, executionMode: event.target.value, page: 1 }))}
                    >
                      <option value="">Semua</option>
                      <option value="DICTIONARY_ONLY">{formatStatusLabel("DICTIONARY_ONLY")}</option>
                      <option value="READY_READ_ONLY">{formatStatusLabel("READY_READ_ONLY")}</option>
                      <option value="READY_MONITORING">{formatStatusLabel("READY_MONITORING")}</option>
                      <option value="READY_ASSESSMENT">{formatStatusLabel("READY_ASSESSMENT")}</option>
                      <option value="READY_SCHEDULE_PDF">{formatStatusLabel("READY_SCHEDULE_PDF")}</option>
                      <option value="ADMIN_TEST_ONLY">{formatStatusLabel("ADMIN_TEST_ONLY")}</option>
                      <option value="NEEDS_REVIEW">{formatStatusLabel("NEEDS_REVIEW")}</option>
                      <option value="UNSAFE_RAW_SQL">{formatStatusLabel("UNSAFE_RAW_SQL")}</option>
                    </select>
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Status</span>
                    <select
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                      value={queryFilters.securityStatus}
                      onChange={(event) => setQueryFilters((current) => ({ ...current, securityStatus: event.target.value, page: 1 }))}
                    >
                      <option value="">Semua</option>
                      <option value="SAFE_READ_ONLY">{formatStatusLabel("SAFE_READ_ONLY")}</option>
                      <option value="NEEDS_REVIEW">{formatStatusLabel("NEEDS_REVIEW")}</option>
                      <option value="REJECTED_WRITE_QUERY">{formatStatusLabel("REJECTED_WRITE_QUERY")}</option>
                    </select>
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Review</span>
                    <select
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                      value={queryFilters.reviewStatus}
                      onChange={(event) => setQueryFilters((current) => ({ ...current, reviewStatus: event.target.value, page: 1 }))}
                    >
                      <option value="">Semua</option>
                      <option value="AUTO_IMPORTED">{formatStatusLabel("AUTO_IMPORTED")}</option>
                      <option value="AUTO_GENERATED">{formatStatusLabel("AUTO_GENERATED")}</option>
                      <option value="NEEDS_ADMIN_REVIEW">{formatStatusLabel("NEEDS_ADMIN_REVIEW")}</option>
                      <option value="ADMIN_REVIEWED">{formatStatusLabel("ADMIN_REVIEWED")}</option>
                    </select>
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Tabel</span>
                    <input
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                      placeholder="perkara_jadwal_sidang"
                      value={queryFilters.tableName}
                      onChange={(event) => setQueryFilters((current) => ({ ...current, tableName: event.target.value, page: 1 }))}
                    />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Variabel</span>
                    <input
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                      placeholder="#4048# atau ##nama##"
                      value={queryFilters.variableCode}
                      onChange={(event) => setQueryFilters((current) => ({ ...current, variableCode: event.target.value, page: 1 }))}
                    />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Per halaman</span>
                    <select
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                      value={queryFilters.pageSize}
                      onChange={(event) => setQueryFilters((current) => ({ ...current, pageSize: Number(event.target.value), page: 1 }))}
                    >
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                    </select>
                  </label>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                  <span>{queryLoading ? "Memuat query..." : `${queryList?.pagination.total ?? 0} query ditemukan`}</span>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setQueryFilters((current) => ({ ...current, page: Math.max(1, current.page - 1) }))} disabled={queryFilters.page <= 1 || queryLoading}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span>Hal. {queryFilters.page} / {Math.max(1, Math.ceil((queryList?.pagination.total ?? 0) / queryFilters.pageSize))}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setQueryFilters((current) => ({ ...current, page: current.page + 1 }))}
                      disabled={queryLoading || queryFilters.page >= Math.max(1, Math.ceil((queryList?.pagination.total ?? 0) / queryFilters.pageSize))}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-md border border-border/80">
                  <table className="w-full min-w-[980px] text-left text-sm">
                    <thead className="bg-muted/70 text-xs uppercase tracking-[0.12em] text-muted-foreground">
                      <tr>
                        <th className="px-3 py-3 font-semibold">Query Key</th>
                        <th className="px-3 py-3 font-semibold">Nama</th>
                        <th className="px-3 py-3 font-semibold">Kategori</th>
                        <th className="px-3 py-3 font-semibold">Sumber</th>
                        <th className="px-3 py-3 font-semibold">Tabel</th>
                        <th className="px-3 py-3 font-semibold">Status</th>
                        <th className="px-3 py-3 font-semibold">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(queryList?.rows ?? []).map((query) => (
                        <tr key={query.queryKey} className="border-t border-border/70 align-top">
                          <td className="px-3 py-3 font-mono text-xs">{query.queryKey}</td>
                          <td className="px-3 py-3">
                            <p className="font-medium">{query.queryName || query.name}</p>
                            <p className="mt-1 line-clamp-2 max-w-[320px] text-xs text-muted-foreground">{query.shortDescription}</p>
                          </td>
                          <td className="px-3 py-3"><Badge variant="outline">{query.category}</Badge></td>
                          <td className="px-3 py-3 text-xs text-muted-foreground">{query.sourceType || "-"}</td>
                          <td className="px-3 py-3 font-mono text-xs">{query.tables.slice(0, 3).join(", ") || "-"}</td>
                          <td className="px-3 py-3">
                            <div className="flex flex-col gap-1">
                              <Badge variant={statusVariant(query.securityStatus)}>{query.securityStatus}</Badge>
                              <span className="text-xs text-muted-foreground">{query.reviewStatus ?? "-"}</span>
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <Button size="sm" variant="outline" onClick={() => loadQueryDetail(query.queryKey)}>
                              <Eye className="h-4 w-4" />
                              Detail
                            </Button>
                          </td>
                        </tr>
                      ))}
                      {queryList?.rows.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">Tidak ada query sesuai filter.</td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>

                {canRenderDetailPortal && selectedQueryKey ? createPortal((
                  <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-hidden bg-slate-950/75 px-4 pb-[6vh] pt-[7vh] backdrop-blur-sm" role="dialog" aria-modal="true" onClick={closeQueryDetail}>
                    <Card className="max-h-[87vh] w-full max-w-6xl overflow-hidden border-border/80 bg-background shadow-2xl" onClick={(event) => event.stopPropagation()}>
                      <CardHeader className="sticky top-0 z-10 border-b border-border/80 bg-background/95 backdrop-blur">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <CardTitle>{queryDetail ? queryDetail.name : "Detail Query"}</CardTitle>
                            <CardDescription>{selectedQueryKey}</CardDescription>
                          </div>
                          <div className="flex items-start gap-2">
                            {queryDetail ? <Badge variant={statusVariant(queryDetail.securityStatus)}>{queryDetail.securityStatus}</Badge> : null}
                            <Button type="button" variant="ghost" size="icon" className="shrink-0" onClick={closeQueryDetail} aria-label="Tutup detail query">
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="max-h-[calc(87vh-104px)] space-y-5 overflow-y-auto overscroll-contain p-5 text-sm">
                        {queryDetailLoading ? (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <RefreshCw className="h-4 w-4 animate-spin" />
                            Memuat detail query.
                          </div>
                        ) : null}
                        {queryDetail ? (
                          <>
                            <div className="flex flex-wrap gap-2">
                              <Badge variant="outline">{queryDetail.category}</Badge>
                              <Badge variant="muted">{queryDetail.sourceType || "metadata"}</Badge>
                              <Badge variant="muted">{queryDetail.reviewStatus || "NEEDS_ADMIN_REVIEW"}</Badge>
                              <Badge variant={queryDetail.allowedForAi ? "success" : "muted"}>AI</Badge>
                              <Badge variant={queryDetail.allowedForPdf ? "success" : "muted"}>PDF</Badge>
                            </div>
                            <p className="leading-6 text-muted-foreground">{queryDetail.longDescription || queryDetail.shortDescription}</p>
                            <div className="grid gap-3 md:grid-cols-3">
                              <div className="rounded-md border border-border/80 p-3">
                                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Tabel</p>
                                <p className="font-mono text-xs">{queryDetail.tables.join(", ") || "-"}</p>
                              </div>
                              <div className="rounded-md border border-border/80 p-3">
                                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Parameter</p>
                                <p className="font-mono text-xs">{queryDetail.registryParameters.map((item) => String(item.name ?? "")).filter(Boolean).join(", ") || "-"}</p>
                              </div>
                              <div className="rounded-md border border-border/80 p-3">
                                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Variabel</p>
                                <p className="font-mono text-xs">{queryDetail.variableLinks.map((item) => String(item.legacy_code ?? item.variable_key ?? "")).filter(Boolean).slice(0, 8).join(", ") || "-"}</p>
                              </div>
                            </div>
                            <div className="rounded-md border border-border/80 p-3">
                              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Parameterized SQL</p>
                              {queryDetail.sqlPreviewRedacted ? (
                                <p className="rounded-md bg-muted/50 p-3 text-xs leading-5 text-muted-foreground">
                                  SQL lengkap disembunyikan. Hanya role dengan izin preview SQL yang dapat melihat query asli dan parameterized SQL.
                                </p>
                              ) : (
                                <pre className="max-h-56 overflow-auto rounded-md bg-muted/50 p-3 text-xs leading-5 text-muted-foreground">{queryDetail.parameterizedSql || queryDetail.normalizedSql}</pre>
                              )}
                            </div>
                            <div className="grid gap-3 md:grid-cols-2">
                              <div className="rounded-md border border-border/80 p-3">
                                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Mapping Variabel</p>
                                <div className="max-h-48 space-y-2 overflow-auto">
                                  {queryDetail.variableLinks.length > 0 ? queryDetail.variableLinks.map((item, index) => (
                                    <p key={`${String(item.legacy_code)}-${index}`} className="font-mono text-xs text-muted-foreground">
                                      {String(item.legacy_code ?? "-")} {"->"} {String(item.variable_key ?? item.modern_key ?? "-")} ({String(item.mapping_status ?? "-")})
                                    </p>
                                  )) : <p className="text-muted-foreground">Belum ada mapping variabel.</p>}
                                </div>
                              </div>
                              <div className="rounded-md border border-border/80 p-3">
                                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Catatan</p>
                                <p className="leading-6 text-muted-foreground">{queryDetail.usageNotes || queryDetail.riskNotes.join(" ") || "Belum ada catatan."}</p>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {canManageDictionary ? (
                                <>
                                  <Button variant="outline" onClick={runAnalyzeSelectedQuery} disabled={Boolean(queryAction)}>
                                    {queryAction === "analyze" ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                                    Analisis Ulang
                                  </Button>
                                  <Button variant="outline" onClick={() => setQueryEditMode((value) => !value)}>
                                    <Edit3 className="h-4 w-4" />
                                    Edit Admin
                                  </Button>
                                </>
                              ) : null}
                            </div>
                            {queryEditMode && canManageDictionary ? (
                              <div className="space-y-3 rounded-md border border-border/80 p-3">
                                <div className="grid gap-3 md:grid-cols-2">
                                  <input className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={queryEditDraft.name} onChange={(event) => setQueryEditDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Nama query" />
                                  <input className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={queryEditDraft.category} onChange={(event) => setQueryEditDraft((current) => ({ ...current, category: event.target.value }))} placeholder="Kategori" />
                                </div>
                                <textarea className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={queryEditDraft.shortDescription} onChange={(event) => setQueryEditDraft((current) => ({ ...current, shortDescription: event.target.value }))} placeholder="Penjelasan singkat" />
                                <textarea className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={queryEditDraft.longDescription} onChange={(event) => setQueryEditDraft((current) => ({ ...current, longDescription: event.target.value }))} placeholder="Penjelasan lengkap" />
                                <textarea className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={queryEditDraft.usageNotes} onChange={(event) => setQueryEditDraft((current) => ({ ...current, usageNotes: event.target.value }))} placeholder="Catatan penggunaan" />
                                <Button onClick={saveQueryEdit} disabled={queryAction === "save"}>
                                  {queryAction === "save" ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Edit3 className="h-4 w-4" />}
                                  Simpan Review Query
                                </Button>
                              </div>
                            ) : null}
                          </>
                        ) : (
                          <p className="text-muted-foreground">Detail query sedang dimuat.</p>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                ), document.body) : null}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="variabel" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              {[
                { label: "Total Variabel", value: variableStats?.total ?? summary.counts.variables },
                { label: "Mapped", value: variableStats?.mapped ?? 0 },
                { label: "Unresolved", value: variableStats?.unresolved ?? 0 },
                { label: "Needs Review", value: variableStats?.needsReview ?? 0 },
                { label: "Template Links", value: variableStats?.templateLinks ?? 0 },
              ].map((item) => (
                <Card key={item.label} className="border-border/80">
                  <CardHeader className="pb-3">
                    <CardDescription className="uppercase tracking-[0.14em]">{item.label}</CardDescription>
                    <CardTitle className="text-2xl">{item.value}</CardTitle>
                  </CardHeader>
                </Card>
              ))}
            </div>

            {variableError ? (
              <Card className="border-rose-200 bg-rose-50/60 dark:border-rose-900/50 dark:bg-rose-950/30">
                <CardContent className="flex items-center gap-3 p-4 text-sm text-rose-700 dark:text-rose-300">
                  <AlertTriangle className="h-4 w-4" />
                  {variableError}
                </CardContent>
              </Card>
            ) : null}

            {variableProgress ? (
              <Card className="border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/50 dark:bg-emerald-950/30">
                <CardContent className="p-4 text-sm text-emerald-800 dark:text-emerald-300">{variableProgress}</CardContent>
              </Card>
            ) : null}

            <Card className="border-border/80">
              <CardHeader>
                <CardTitle>Konversi Narasi Sumber Lama</CardTitle>
                <CardDescription>Deteksi placeholder `#angka#` dan tampilkan key modern dari metadata Variable Registry.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <textarea
                  className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Fotokopi KTP atas nama #4048#, NIK #0335#, panitera #4004#..."
                  value={legacyText}
                  onChange={(event) => setLegacyText(event.target.value)}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Button onClick={convertLegacyText} disabled={convertAction === "convert" || !legacyText.trim()}>
                    {convertAction === "convert" ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                    Konversi
                  </Button>
                  {convertResult ? (
                    <span className="text-sm text-muted-foreground">
                      {convertResult.placeholders.length} placeholder, {convertResult.unresolved.length} unresolved.
                    </span>
                  ) : null}
                </div>
                {convertResult ? (
                  <div className="grid gap-3 lg:grid-cols-2">
                    <div className="rounded-md border border-border/80 p-3">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Narasi Modern</p>
                      <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{convertResult.convertedText}</p>
                    </div>
                    <div className="rounded-md border border-border/80 p-3">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Mapping</p>
                      <div className="max-h-48 space-y-2 overflow-auto">
                        {convertResult.placeholders.map((item) => (
                          <p key={`${item.legacyCode}-${item.replacement}`} className="font-mono text-xs text-muted-foreground">
                            {item.legacyCode} {"->"} {item.replacement} ({item.mappingStatus})
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card className="border-border/80">
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle>Variable Registry ABT/SIPP</CardTitle>
                    <CardDescription>Mapping kode asal `#angka#`, key modern, sumber SIPP, dan template usage dari metadata ALETA.</CardDescription>
                  </div>
                  {canManageDictionary ? (
                    <Button onClick={runImportVariableRegistry} disabled={Boolean(variableAction)}>
                      {variableAction === "import" ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                      Import/Scan Variabel
                    </Button>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <label className="space-y-1 text-sm">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Cari</span>
                    <input className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" placeholder="#0001#, key, nama, tabel" value={variableFilters.q} onChange={(event) => setVariableFilters((current) => ({ ...current, q: event.target.value, page: 1 }))} />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Sumber Asal</span>
                    <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" value={variableFilters.legacySource} onChange={(event) => setVariableFilters((current) => ({ ...current, legacySource: event.target.value, page: 1 }))}>
                      <option value="">Semua</option>
                      {(variableStats?.legacySources ?? []).map((item) => <option key={item.legacySource} value={item.legacySource}>{item.legacySource} ({item.count})</option>)}
                    </select>
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Kategori</span>
                    <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" value={variableFilters.category} onChange={(event) => setVariableFilters((current) => ({ ...current, category: event.target.value, page: 1 }))}>
                      <option value="">Semua</option>
                      {(variableList?.categories ?? variableStats?.categories ?? []).map((item) => <option key={item.category} value={item.category}>{item.category} ({item.count})</option>)}
                    </select>
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Sumber</span>
                    <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" value={variableFilters.sourceType} onChange={(event) => setVariableFilters((current) => ({ ...current, sourceType: event.target.value, page: 1 }))}>
                      <option value="">Semua</option>
                      {(variableList?.sources ?? variableStats?.sources ?? []).map((item) => <option key={item.sourceType} value={item.sourceType}>{item.sourceType} ({item.count})</option>)}
                    </select>
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Tipe</span>
                    <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" value={variableFilters.variableType} onChange={(event) => setVariableFilters((current) => ({ ...current, variableType: event.target.value, page: 1 }))}>
                      <option value="">Semua</option>
                      {(variableStats?.variableTypes ?? []).map((item) => <option key={item.variableType} value={item.variableType}>{item.variableType} ({item.count})</option>)}
                    </select>
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Mapping</span>
                    <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" value={variableFilters.mappingStatus} onChange={(event) => setVariableFilters((current) => ({ ...current, mappingStatus: event.target.value, page: 1 }))}>
                      <option value="">Semua</option>
                      <option value="MAPPED_TO_TABLE_COLUMN">{formatStatusLabel("MAPPED_TO_TABLE_COLUMN")}</option>
                      <option value="MAPPED_TO_QUERY">{formatStatusLabel("MAPPED_TO_QUERY")}</option>
                      <option value="MAPPED_TO_COMPUTED">{formatStatusLabel("MAPPED_TO_COMPUTED")}</option>
                      <option value="MAPPED_TO_MANUAL_INPUT">{formatStatusLabel("MAPPED_TO_MANUAL_INPUT")}</option>
                      <option value="PARTIAL">{formatStatusLabel("PARTIAL")}</option>
                      <option value="UNRESOLVED">{formatStatusLabel("UNRESOLVED")}</option>
                      <option value="CONFLICT">{formatStatusLabel("CONFLICT")}</option>
                    </select>
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Review</span>
                    <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" value={variableFilters.reviewStatus} onChange={(event) => setVariableFilters((current) => ({ ...current, reviewStatus: event.target.value, page: 1 }))}>
                      <option value="">Semua</option>
                      <option value="AUTO_IMPORTED">{formatStatusLabel("AUTO_IMPORTED")}</option>
                      <option value="AUTO_ANALYZED">{formatStatusLabel("AUTO_ANALYZED")}</option>
                      <option value="NEEDS_ADMIN_REVIEW">{formatStatusLabel("NEEDS_ADMIN_REVIEW")}</option>
                      <option value="ADMIN_REVIEWED">{formatStatusLabel("ADMIN_REVIEWED")}</option>
                    </select>
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Query</span>
                    <input className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" placeholder="QRY_SIPP_..." value={variableFilters.queryKey} onChange={(event) => setVariableFilters((current) => ({ ...current, queryKey: event.target.value, page: 1 }))} />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Tabel</span>
                    <input className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" placeholder="perkara" value={variableFilters.tableName} onChange={(event) => setVariableFilters((current) => ({ ...current, tableName: event.target.value, page: 1 }))} />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Per halaman</span>
                    <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" value={variableFilters.pageSize} onChange={(event) => setVariableFilters((current) => ({ ...current, pageSize: Number(event.target.value), page: 1 }))}>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                    </select>
                  </label>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                  <span>{variableLoading ? "Memuat variabel..." : `${variableList?.pagination.total ?? 0} variabel ditemukan`}</span>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setVariableFilters((current) => ({ ...current, page: Math.max(1, current.page - 1) }))} disabled={variableFilters.page <= 1 || variableLoading}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span>Hal. {variableFilters.page} / {Math.max(1, Math.ceil((variableList?.pagination.total ?? 0) / variableFilters.pageSize))}</span>
                    <Button variant="outline" size="sm" onClick={() => setVariableFilters((current) => ({ ...current, page: current.page + 1 }))} disabled={variableLoading || variableFilters.page >= Math.max(1, Math.ceil((variableList?.pagination.total ?? 0) / variableFilters.pageSize))}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-md border border-border/80">
                  <table className="w-full min-w-[980px] text-left text-sm">
                    <thead className="bg-muted/70 text-xs uppercase tracking-[0.12em] text-muted-foreground">
                      <tr>
                        <th className="px-3 py-3 font-semibold">Kode Asal</th>
                        <th className="px-3 py-3 font-semibold">Modern Key</th>
                        <th className="px-3 py-3 font-semibold">Nama</th>
                        <th className="px-3 py-3 font-semibold">Kategori</th>
                        <th className="px-3 py-3 font-semibold">Sumber SIPP</th>
                        <th className="px-3 py-3 font-semibold">Status</th>
                        <th className="px-3 py-3 font-semibold">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(variableList?.rows ?? []).map((item) => (
                        <tr key={`${item.legacySource}-${item.modernKey}`} className="border-t border-border/70 align-top">
                          <td className="px-3 py-3 font-mono text-xs">{item.legacyCode || "-"}</td>
                          <td className="px-3 py-3 font-mono text-xs">{item.modernKey}</td>
                          <td className="px-3 py-3">
                            <p className="font-medium">{item.displayName}</p>
                            <p className="mt-1 line-clamp-2 max-w-[320px] text-xs text-muted-foreground">{item.shortDescription}</p>
                          </td>
                          <td className="px-3 py-3"><Badge variant="outline">{item.category || "Lainnya"}</Badge></td>
                          <td className="px-3 py-3 font-mono text-xs">{[item.sourceTable, item.sourceColumn].filter(Boolean).join(".") || item.sourceQueryKey || "-"}</td>
                          <td className="px-3 py-3">
                            <div className="flex flex-col gap-1">
                              <Badge variant={statusVariant(item.mappingStatus || item.status)}>{formatStatusLabel(item.mappingStatus || item.status)}</Badge>
                              <span className="text-xs text-muted-foreground">{item.reviewStatus ?? "-"}</span>
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <Button size="sm" variant="outline" onClick={() => loadVariableDetail(item.modernKey || item.legacyCode)}>
                              <Eye className="h-4 w-4" />
                              Detail
                            </Button>
                          </td>
                        </tr>
                      ))}
                      {variableList?.rows.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">Tidak ada variabel sesuai filter.</td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>

                {canRenderDetailPortal && selectedVariableKey ? createPortal((
                  <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-hidden bg-slate-950/75 px-4 pb-[6vh] pt-[7vh] backdrop-blur-sm" role="dialog" aria-modal="true" onClick={closeVariableDetail}>
                    <Card className="max-h-[87vh] w-full max-w-6xl overflow-hidden border-border/80 bg-background shadow-2xl" onClick={(event) => event.stopPropagation()}>
                      <CardHeader className="sticky top-0 z-10 border-b border-border/80 bg-background/95 backdrop-blur">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <CardTitle>{variableDetail ? variableDetail.displayName : "Detail Variabel"}</CardTitle>
                            <CardDescription>{selectedVariableKey}</CardDescription>
                          </div>
                          <div className="flex items-start gap-2">
                            {variableDetail ? <Badge variant={statusVariant(variableDetail.mappingStatus || variableDetail.status)}>{variableDetail.mappingStatus || variableDetail.status}</Badge> : null}
                            <Button type="button" variant="ghost" size="icon" className="shrink-0" onClick={closeVariableDetail} aria-label="Tutup detail variabel">
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="max-h-[calc(87vh-104px)] space-y-5 overflow-y-auto overscroll-contain p-5 text-sm">
                        {variableDetailLoading ? (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <RefreshCw className="h-4 w-4 animate-spin" />
                            Memuat detail variabel.
                          </div>
                        ) : null}
                        {variableDetail ? (
                          <>
                            <div className="flex flex-wrap gap-2">
                              <Badge variant="outline">{variableDetail.category || "Lainnya"}</Badge>
                              <Badge variant="muted">{variableDetail.legacySource}</Badge>
                              <Badge variant="muted">{variableDetail.variableType || "UNKNOWN"}</Badge>
                              <Badge variant="muted">{variableDetail.reviewStatus || "NEEDS_ADMIN_REVIEW"}</Badge>
                            </div>
                            <p className="leading-6 text-muted-foreground">{variableDetail.longDescription || variableDetail.shortDescription || "Belum ada penjelasan lengkap."}</p>
                            <div className="grid gap-3 md:grid-cols-3">
                              <div className="rounded-md border border-border/80 p-3">
                                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Kode Asal</p>
                                <p className="font-mono text-xs">{variableDetail.legacyCode || "-"}</p>
                              </div>
                              <div className="rounded-md border border-border/80 p-3">
                                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Modern Key</p>
                                <p className="font-mono text-xs">{variableDetail.modernKey}</p>
                              </div>
                              <div className="rounded-md border border-border/80 p-3">
                                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Sumber SIPP</p>
                                <p className="font-mono text-xs">{[variableDetail.sourceTable, variableDetail.sourceColumn].filter(Boolean).join(".") || variableDetail.sourceQueryKey || "-"}</p>
                              </div>
                            </div>
                            <div className="grid gap-3 md:grid-cols-2">
                              <div className="rounded-md border border-border/80 p-3">
                                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Query Terkait</p>
                                <div className="max-h-48 space-y-2 overflow-auto">
                                  {variableDetail.queryLinks.length > 0 ? variableDetail.queryLinks.map((item, index) => (
                                    <p key={`${String(item.query_key)}-${index}`} className="font-mono text-xs text-muted-foreground">
                                      {String(item.query_key ?? "-")} ({String(item.mapping_status ?? "-")})
                                    </p>
                                  )) : <p className="text-muted-foreground">Belum ada query terkait.</p>}
                                </div>
                              </div>
                              <div className="rounded-md border border-border/80 p-3">
                                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Template Usage</p>
                                <div className="max-h-48 space-y-2 overflow-auto">
                                  {variableDetail.templateLinks.length > 0 ? variableDetail.templateLinks.slice(0, 20).map((item, index) => (
                                    <p key={`${String(item.source_file)}-${index}`} className="text-xs text-muted-foreground">
                                      {String(item.source_type ?? "-")} - {String(item.source_location ?? item.source_file ?? "-")}
                                    </p>
                                  )) : <p className="text-muted-foreground">Belum ada template usage.</p>}
                                </div>
                              </div>
                            </div>
                            {variableDetail.sourceSqlFragment ? (
                              <div className="rounded-md border border-border/80 p-3">
                                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">SQL Fragment</p>
                                <pre className="max-h-48 overflow-auto rounded-md bg-muted/50 p-3 text-xs leading-5 text-muted-foreground">{variableDetail.sourceSqlFragment}</pre>
                              </div>
                            ) : null}
                            <div className="flex flex-wrap gap-2">
                              {canManageDictionary ? (
                                <>
                                  <Button variant="outline" onClick={runAnalyzeSelectedVariable} disabled={Boolean(variableAction)}>
                                    {variableAction === "analyze" ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                                    Analisis Ulang
                                  </Button>
                                  <Button variant="outline" onClick={() => setVariableEditMode((value) => !value)}>
                                    <Edit3 className="h-4 w-4" />
                                    Edit Admin
                                  </Button>
                                </>
                              ) : null}
                            </div>
                            {variableEditMode && canManageDictionary ? (
                              <div className="space-y-3 rounded-md border border-border/80 p-3">
                                <div className="grid gap-3 md:grid-cols-2">
                                  <input className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={variableEditDraft.displayName} onChange={(event) => setVariableEditDraft((current) => ({ ...current, displayName: event.target.value }))} placeholder="Nama variabel" />
                                  <input className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={variableEditDraft.category} onChange={(event) => setVariableEditDraft((current) => ({ ...current, category: event.target.value }))} placeholder="Kategori" />
                                  <input className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={variableEditDraft.sourceTable} onChange={(event) => setVariableEditDraft((current) => ({ ...current, sourceTable: event.target.value }))} placeholder="Tabel SIPP" />
                                  <input className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={variableEditDraft.sourceColumn} onChange={(event) => setVariableEditDraft((current) => ({ ...current, sourceColumn: event.target.value }))} placeholder="Kolom SIPP" />
                                </div>
                                <textarea className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={variableEditDraft.shortDescription} onChange={(event) => setVariableEditDraft((current) => ({ ...current, shortDescription: event.target.value }))} placeholder="Penjelasan singkat" />
                                <textarea className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={variableEditDraft.usageNotes} onChange={(event) => setVariableEditDraft((current) => ({ ...current, usageNotes: event.target.value }))} placeholder="Catatan penggunaan" />
                                <Button onClick={saveVariableEdit} disabled={variableAction === "save"}>
                                  {variableAction === "save" ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Edit3 className="h-4 w-4" />}
                                  Simpan Review Variabel
                                </Button>
                              </div>
                            ) : null}
                          </>
                        ) : (
                          <p className="text-muted-foreground">Detail variabel sedang dimuat.</p>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                ), document.body) : null}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pendukung2018" className="space-y-4">
            {renderMonitoringNotice()}
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              {[
                { label: "Total Fitur", value: pendukungFeatures?.pagination.total ?? "-", icon: ListChecks },
                { label: "Siap Bersyarat", value: pendukungReadyCount, icon: ShieldCheck },
                { label: "Butuh Konfigurasi", value: pendukungPartialCount, icon: AlertTriangle },
                { label: "Manual", value: pendukungManualCount, icon: Edit3 },
                { label: "Eksternal", value: pendukungExternalCount, icon: GitCompare },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <Card key={item.label} className="border-border/80">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <CardDescription className="uppercase tracking-[0.14em]">{item.label}</CardDescription>
                        <Icon className="h-4 w-4 text-primary" />
                      </div>
                      <CardTitle className="text-2xl">{item.value}</CardTitle>
                    </CardHeader>
                  </Card>
                );
              })}
            </div>

            <Card className="border-border/80">
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle>Katalog Monitoring SIPP</CardTitle>
                    <CardDescription>{pendukungFeatures?.pagination.total ?? "Seluruh"} fitur monitoring hasil audit legacy, dimigrasikan sebagai metadata dan Query Registry read-only ALETA.</CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={reloadPendukungFeatures}>
                      <RefreshCw className="h-4 w-4" />
                      Refresh
                    </Button>
                    <Button onClick={importPendukung2018} disabled={!canManageMonitoring || Boolean(monitoringAction)}>
                      {monitoringAction === "import-pendukung2018" ? <RefreshCw className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                      Sinkronisasi Katalog
                    </Button>
                    <Button variant="outline" onClick={() => autoReviewMonitoringQueries()} disabled={!canManageMonitoring || Boolean(monitoringAction)}>
                      {monitoringAction === "auto-review-monitoring" ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                      Perbaiki Otomatis Query
                    </Button>
                    {pendukungFeatureFilters.groupKey ? (
                      <>
                        <Button asChild variant="outline">
                          <Link href={apiPath(`/api/aleta-sipp/monitoring/export/group/${encodeURIComponent(pendukungFeatureFilters.groupKey)}/export.xlsx`)} target="_blank">
                            <Download className="h-4 w-4" />
                            XLSX Grup
                          </Link>
                        </Button>
                        <Button asChild variant="outline">
                          <Link href={apiPath(`/api/aleta-sipp/monitoring/export/group/${encodeURIComponent(pendukungFeatureFilters.groupKey)}/export.pdf`)} target="_blank">
                            <FileText className="h-4 w-4" />
                            PDF Grup
                          </Link>
                        </Button>
                      </>
                    ) : (
                      <Button variant="outline" disabled>
                        <Download className="h-4 w-4" />
                        Export Grup
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                  <label className="space-y-1 text-sm xl:col-span-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Cari</span>
                    <input className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={pendukungFeatureFilters.q} onChange={(event) => setPendukungFeatureFilters((current) => ({ ...current, q: event.target.value, page: 1 }))} placeholder="nama fitur, file, query" />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Grup</span>
                    <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={pendukungFeatureFilters.groupKey} onChange={(event) => setPendukungFeatureFilters((current) => ({ ...current, groupKey: event.target.value, page: 1 }))}>
                      <option value="">Semua</option>
                      {(pendukungFeatures?.groups ?? []).map((item) => (
                        <option key={item.groupKey} value={item.groupKey}>{item.groupName} ({item.count})</option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Implementasi</span>
                    <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={pendukungFeatureFilters.implementationStatus} onChange={(event) => setPendukungFeatureFilters((current) => ({ ...current, implementationStatus: event.target.value, page: 1 }))}>
                      <option value="">Semua</option>
                      {(pendukungFeatures?.statuses ?? []).map((item) => (
                        <option key={item.status} value={item.status}>{formatStatusLabel(item.status)} ({item.count})</option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Safety</span>
                    <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={pendukungFeatureFilters.safetyStatus} onChange={(event) => setPendukungFeatureFilters((current) => ({ ...current, safetyStatus: event.target.value, page: 1 }))}>
                      <option value="">Semua</option>
                      {(pendukungFeatures?.safetyStatuses ?? []).map((item) => (
                        <option key={item.status} value={item.status}>{formatStatusLabel(item.status)} ({item.count})</option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Per halaman</span>
                    <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={pendukungFeatureFilters.pageSize} onChange={(event) => setPendukungFeatureFilters((current) => ({ ...current, pageSize: Number(event.target.value), page: 1 }))}>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                  </label>
                </div>

                <div className="overflow-x-auto rounded-md border border-border/80">
                  <table className="w-full min-w-[1180px] text-left text-sm">
                    <thead className="bg-muted/70 text-xs uppercase tracking-[0.12em] text-muted-foreground">
                      <tr>
                        <th className="px-3 py-3 font-semibold">Fitur</th>
                        <th className="px-3 py-3 font-semibold">Grup</th>
                        <th className="px-3 py-3 font-semibold">Implementasi</th>
                        <th className="px-3 py-3 font-semibold">Query</th>
                        <th className="px-3 py-3 font-semibold">Sumber</th>
                        <th className="px-3 py-3 font-semibold">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(pendukungFeatures?.rows ?? []).map((item) => (
                        <tr key={item.featureKey} className="border-t border-border/70 align-top">
                          <td className="px-3 py-3">
                            <p className="font-medium">{item.featureName}</p>
                            <p className="mt-1 font-mono text-xs text-muted-foreground">{item.featureCode} / {item.featureKey}</p>
                          </td>
                          <td className="px-3 py-3">{item.groupName}</td>
                          <td className="px-3 py-3">
                            <div className="flex flex-col gap-1">
                              <Badge variant={statusVariant(item.operationalStatus || item.implementationStatus)}>{formatStatusLabel(item.operationalStatus || item.implementationStatus)}</Badge>
                              <span className="text-xs text-muted-foreground">{formatStatusLabel(item.safetyStatus)}</span>
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            {item.relatedQueryKey ? (
                              <p className="font-mono text-xs">{item.relatedQueryKey}</p>
                            ) : (
                              <p className="max-w-[260px] text-xs text-muted-foreground">{item.noQueryReason || "-"}</p>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            <p className="max-w-[260px] font-mono text-xs text-muted-foreground">{item.sourceFiles.slice(0, 2).join(", ") || "-"}</p>
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex flex-wrap gap-2">
                              <Button size="sm" variant="outline" onClick={() => loadPendukungFeatureDetail(item.featureKey)}>
                                <Eye className="h-4 w-4" />
                                Detail
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => runPendukungFeature(item.featureKey, true)} disabled={!canManageMonitoring || Boolean(monitoringAction)}>
                                {monitoringAction === `run-feature-${item.featureKey}` ? <RefreshCw className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
                                Dry-run
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {pendukungFeatures?.rows.length === 0 ? (
                        <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">Tidak ada fitur sesuai filter.</td></tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                  <span>{pendukungFeatures?.pagination.total ?? 0} fitur</span>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setPendukungFeatureFilters((current) => ({ ...current, page: Math.max(1, current.page - 1) }))} disabled={pendukungFeatureFilters.page <= 1}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span>Hal. {pendukungFeatureFilters.page} / {pendukungFeatures?.pagination.totalPages ?? 1}</span>
                    <Button variant="outline" size="sm" onClick={() => setPendukungFeatureFilters((current) => ({ ...current, page: current.page + 1 }))} disabled={pendukungFeatureFilters.page >= (pendukungFeatures?.pagination.totalPages ?? 1)}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {selectedPendukungFeatureKey ? (
              <Card className="border-border/80">
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle>{pendukungFeatureDetail?.featureName ?? "Detail Fitur Monitoring"}</CardTitle>
                      <CardDescription>{selectedPendukungFeatureKey}</CardDescription>
                    </div>
                    <Button variant="ghost" size="icon" onClick={closePendukungFeatureDetail} aria-label="Tutup detail fitur">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {pendukungFeatureDetailLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Memuat detail fitur.
                    </div>
                  ) : null}
                  {pendukungFeatureDetail ? (
                    <>
                      <div className="grid gap-3 md:grid-cols-4">
                        <div className="rounded-md border border-border/80 p-3 text-sm">
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Status</p>
                          <Badge className="mt-2" variant={statusVariant(pendukungFeatureDetail.operationalStatus || pendukungFeatureDetail.implementationStatus)}>{formatStatusLabel(pendukungFeatureDetail.operationalStatus || pendukungFeatureDetail.implementationStatus)}</Badge>
                        </div>
                        <div className="rounded-md border border-border/80 p-3 text-sm">
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Mode</p>
                          <p className="mt-2 font-medium">{formatStatusLabel(pendukungFeatureDetail.calculationMode)}</p>
                        </div>
                        <div className="rounded-md border border-border/80 p-3 text-sm">
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Query</p>
                          <p className="mt-2 break-all font-mono text-xs">{pendukungFeatureDetail.relatedQueryKey || "-"}</p>
                        </div>
                        <div className="rounded-md border border-border/80 p-3 text-sm">
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Run Terakhir</p>
                          <Badge className="mt-2" variant={statusVariant(String(pendukungFeatureDetail.latestResultStatus ?? ""))}>{pendukungFeatureDetail.latestResultStatus ? formatStatusLabel(pendukungFeatureDetail.latestResultStatus) : "Belum run"}</Badge>
                        </div>
                      </div>
                      <div className="grid gap-4 lg:grid-cols-2">
                        <div className="rounded-md border border-border/80 p-4 text-sm">
                           <p className="font-medium">Evidence Katalog</p>
                          <div className="mt-3 space-y-2 text-muted-foreground">
                            {pendukungFeatureDetail.sourceEvidence.map((item) => <p key={item}>{item}</p>)}
                            <p className="break-all font-mono text-xs">{pendukungFeatureDetail.sourceFiles.join(", ")}</p>
                          </div>
                        </div>
                        <div className="rounded-md border border-border/80 p-4 text-sm">
                          <p className="font-medium">Risk dan Rekomendasi</p>
                          <p className="mt-3 text-muted-foreground">{pendukungFeatureDetail.readinessReason || pendukungFeatureDetail.riskNotes || "-"}</p>
                          <p className="mt-2 text-muted-foreground">{pendukungFeatureDetail.recommendationTemplate || "-"}</p>
                          {pendukungFeatureDetail.noQueryReason ? <p className="mt-2 text-muted-foreground">{pendukungFeatureDetail.noQueryReason}</p> : null}
                          {pendukungFeatureDetail.availableActions?.length ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {pendukungFeatureDetail.availableActions.map((action) => <Badge key={action} variant="outline">{action}</Badge>)}
                            </div>
                          ) : null}
                        </div>
                      </div>
                      {pendukungFeatureDetail.subFeatures?.length ? (
                        <div className="overflow-x-auto rounded-md border border-border/80">
                          <table className="w-full min-w-[760px] text-left text-sm">
                            <thead className="bg-muted/70 text-xs uppercase tracking-[0.12em] text-muted-foreground">
                              <tr>
                                <th className="px-3 py-3 font-semibold">Subfitur</th>
                                <th className="px-3 py-3 font-semibold">Status</th>
                                <th className="px-3 py-3 font-semibold">Alasan</th>
                                <th className="px-3 py-3 font-semibold">Aksi</th>
                              </tr>
                            </thead>
                            <tbody>
                              {pendukungFeatureDetail.subFeatures.map((subFeature) => (
                                <tr key={subFeature.key} className="border-t border-border/70 align-top">
                                  <td className="px-3 py-3 font-medium">{subFeature.label}</td>
                                  <td className="px-3 py-3">
                                    <Badge variant={statusVariant(subFeature.status)}>{formatStatusLabel(subFeature.status)}</Badge>
                                  </td>
                                  <td className="px-3 py-3 text-muted-foreground">{subFeature.reason}</td>
                                  <td className="px-3 py-3">
                                    <div className="flex flex-wrap gap-2">
                                      {subFeature.actions.map((action) => <Badge key={action} variant="outline">{action}</Badge>)}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : null}
                      <div className="flex flex-wrap gap-2">
                        <Button onClick={() => runPendukungFeature(pendukungFeatureDetail.featureKey, true)} disabled={!canManageMonitoring || Boolean(monitoringAction)}>
                          <PlayCircle className="h-4 w-4" />
                          Dry-run Fitur
                        </Button>
                        <Button variant="outline" onClick={() => runPendukungFeature(pendukungFeatureDetail.featureKey, false)} disabled={!canManageMonitoring || Boolean(monitoringAction)}>
                          <Activity className="h-4 w-4" />
                          Run Fitur
                        </Button>
                        {pendukungFeatureDetail.relatedIndicatorKey ? (
                          <Button variant="outline" onClick={() => loadMonitoringIndicatorDetail(pendukungFeatureDetail.relatedIndicatorKey)}>
                            <ListChecks className="h-4 w-4" />
                            Buka Indikator
                          </Button>
                        ) : null}
                        {pendukungFeatureDetail.relatedQueryKey ? (
                          <Button variant="outline" onClick={() => reviewMonitoringFeatureQuery(pendukungFeatureDetail.featureKey)} disabled={!canManageMonitoring || Boolean(monitoringAction)}>
                            {monitoringAction === `review-feature-${pendukungFeatureDetail.featureKey}` ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                            Review Query
                          </Button>
                        ) : null}
                        {pendukungFeatureDetail.relatedQueryKey ? (
                          <Button variant="outline" onClick={() => autoReviewMonitoringQueries(pendukungFeatureDetail.featureKey)} disabled={!canManageMonitoring || Boolean(monitoringAction)}>
                            {monitoringAction === `auto-review-${pendukungFeatureDetail.featureKey}` ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                            Perbaiki Otomatis
                          </Button>
                        ) : null}
                        {String(pendukungFeatureDetail.latestResult?.result_id ?? pendukungFeatureDetail.latestResultId ?? "").trim() ? (
                          <Button variant="outline" onClick={() => loadRunResultItems(String(pendukungFeatureDetail.latestResult?.result_id ?? pendukungFeatureDetail.latestResultId))}>
                            <Search className="h-4 w-4" />
                            Buka Drill-down
                          </Button>
                        ) : null}
                      </div>
                    </>
                  ) : null}
                </CardContent>
              </Card>
            ) : null}
          </TabsContent>

          <TabsContent value="monitoring" className="space-y-4">
            {renderMonitoringNotice()}
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {monitoringMetrics.map((item) => {
                const Icon = item.icon;
                return (
                  <Card key={item.label} className="border-border/80">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <CardDescription className="uppercase tracking-[0.14em]">{item.label}</CardDescription>
                        <Icon className="h-4 w-4 text-primary" />
                      </div>
                      <CardTitle className="text-2xl">{monitoringLoading ? "..." : item.value}</CardTitle>
                    </CardHeader>
                  </Card>
                );
              })}
            </div>

            <Card className="border-border/80">
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle>Monitoring SIPP</CardTitle>
                    <CardDescription>Menjalankan evaluasi dari indikator yang sudah diimport ke metadata ALETA.</CardDescription>
                  </div>
                  <Button variant="outline" onClick={reloadMonitoring} disabled={monitoringLoading}>
                    <RefreshCw className={`h-4 w-4 ${monitoringLoading ? "animate-spin" : ""}`} />
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-4">
                  <label className="space-y-1 text-sm">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Tahun</span>
                    <input className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" type="number" value={runForm.year} onChange={(event) => setRunForm((current) => ({ ...current, year: Number(event.target.value) || currentYear }))} />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Awal</span>
                    <input className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" type="date" value={runForm.dateStart} onChange={(event) => setRunForm((current) => ({ ...current, dateStart: event.target.value }))} />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Akhir</span>
                    <input className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" type="date" value={runForm.dateEnd} onChange={(event) => setRunForm((current) => ({ ...current, dateEnd: event.target.value }))} />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Mode</span>
                    <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={runForm.datasourceMode} onChange={(event) => setRunForm((current) => ({ ...current, datasourceMode: event.target.value }))}>
                      <option value="SNAPSHOT_CACHE">{formatStatusLabel("SNAPSHOT_CACHE")}</option>
                      <option value="READ_ONLY_SIPP">{formatStatusLabel("READ_ONLY_SIPP")}</option>
                    </select>
                  </label>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => runMonitoringJob("PENDUKUNG2018_MONITORING", true)} disabled={!canManageMonitoring || Boolean(monitoringAction)}>
                    {monitoringAction === "run-PENDUKUNG2018_MONITORING" ? <RefreshCw className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
                    Dry-run Monitoring
                  </Button>
                  <Button variant="outline" onClick={() => runMonitoringJob("PENDUKUNG2018_MONITORING", false)} disabled={!canManageMonitoring || Boolean(monitoringAction)}>
                    <Activity className="h-4 w-4" />
                    Run Monitoring
                  </Button>
                  <Button variant="outline" onClick={() => setMonitoringFilters((current) => ({ ...current, sourceType: "PENDUKUNG2018", page: 1 }))}>
                    <ListChecks className="h-4 w-4" />
                    Lihat Indikator Monitoring
                  </Button>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-md border border-border/80 p-3 text-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Run Terakhir</p>
                    <p className="mt-2 font-mono text-xs">{String(monitoringStats?.lastRun?.run_key ?? "-")}</p>
                    <Badge className="mt-2" variant={statusVariant(String(monitoringStats?.lastRun?.status ?? ""))}>{String(monitoringStats?.lastRun?.status ?? "Belum ada")}</Badge>
                  </div>
                  <div className="rounded-md border border-border/80 p-3 text-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Query Belum Siap</p>
                    <p className="mt-2 text-2xl font-semibold">{monitoringStats?.queryNotReadyIndicators ?? 0}</p>
                  </div>
                  <div className="rounded-md border border-border/80 p-3 text-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Data Tidak Cukup</p>
                    <p className="mt-2 text-2xl font-semibold">{monitoringStats?.dataNotEnoughIndicators ?? 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/80">
              <CardHeader>
                <CardTitle>Indikator Monitoring Terbaru</CardTitle>
                <CardDescription>Ringkasan dari daftar indikator; detail dan mapping ada di tab Indikator.</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead className="bg-muted/70 text-xs uppercase tracking-[0.12em] text-muted-foreground">
                    <tr>
                      <th className="px-3 py-3 font-semibold">Indikator</th>
                      <th className="px-3 py-3 font-semibold">Sumber</th>
                      <th className="px-3 py-3 font-semibold">Kategori</th>
                      <th className="px-3 py-3 font-semibold">Status</th>
                      <th className="px-3 py-3 font-semibold">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(monitoringIndicators?.rows ?? []).slice(0, 10).map((item) => (
                      <tr key={item.indicatorKey} className="border-t border-border/70 align-top">
                        <td className="px-3 py-3">
                          <p className="font-medium">{item.indicatorName}</p>
                          <p className="mt-1 font-mono text-xs text-muted-foreground">{item.indicatorKey}</p>
                        </td>
                        <td className="px-3 py-3">{sourceLabel(item.sourceType)}</td>
                        <td className="px-3 py-3">{item.category || "-"}</td>
                        <td className="px-3 py-3"><Badge variant={statusVariant(item.safetyStatus)}>{formatStatusLabel(item.safetyStatus)}</Badge></td>
                        <td className="px-3 py-3">
                          <Button size="sm" variant="outline" onClick={() => loadMonitoringIndicatorDetail(item.indicatorKey)}>
                            <Eye className="h-4 w-4" />
                            Detail
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {monitoringIndicators?.rows.length === 0 ? (
                      <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">Belum ada indikator monitoring. Jalankan import admin terlebih dahulu.</td></tr>
                    ) : null}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="triwulan" className="space-y-4">
            {renderMonitoringNotice()}
            <Card className="border-border/80">
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle>Penilaian Triwulan SK</CardTitle>
                    <CardDescription>{triwulanOptions?.note ?? "Memakai asumsi triwulan kalender untuk kebutuhan monitoring internal."}</CardDescription>
                  </div>
                  <Badge variant="warning">{triwulanOptions?.officialSkPeriodicity ?? "SK: periodisasi dua minggu"}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <label className="space-y-1 text-sm">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Tahun</span>
                    <input className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" type="number" value={runForm.year} onChange={(event) => setRunForm((current) => ({ ...current, year: Number(event.target.value) || currentYear }))} />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Triwulan</span>
                    <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={runForm.quarter} onChange={(event) => setRunForm((current) => ({ ...current, quarter: Number(event.target.value) || 1 }))}>
                      {(triwulanOptions?.options ?? [1, 2, 3, 4].map((quarter) => ({ quarter, label: `Triwulan ${quarter}`, dateStart: "", dateEnd: "" }))).map((item) => (
                        <option key={item.quarter} value={item.quarter}>{item.label}</option>
                      ))}
                    </select>
                  </label>
                  <div className="rounded-md border border-border/80 p-3 text-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Rentang</p>
                    <p className="mt-2 font-medium">{selectedQuarterOption?.dateStart ?? "-"} sampai {selectedQuarterOption?.dateEnd ?? "-"}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => runMonitoringJob("SK_TRIWULAN_ASSESSMENT", true)} disabled={!canManageMonitoring || Boolean(monitoringAction)}>
                    {monitoringAction === "run-SK_TRIWULAN_ASSESSMENT" ? <RefreshCw className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
                    Dry-run SK
                  </Button>
                  <Button variant="outline" onClick={() => runMonitoringJob("SK_TRIWULAN_ASSESSMENT", false)} disabled={!canManageMonitoring || Boolean(monitoringAction)}>
                    <BarChart3 className="h-4 w-4" />
                    Run Penilaian
                  </Button>
                  <Button variant="outline" onClick={() => setMonitoringFilters((current) => ({ ...current, sourceType: "SK_PENILAIAN_SIPP_2024", page: 1 }))}>
                    <ListChecks className="h-4 w-4" />
                    Lihat Indikator SK
                  </Button>
                </div>
                <div className="grid gap-3 md:grid-cols-4">
                  {(triwulanOptions?.options ?? []).map((item) => (
                    <div key={item.quarter} className="rounded-md border border-border/80 p-3 text-sm">
                      <p className="font-medium">{item.label}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{item.dateStart} - {item.dateEnd}</p>
                      <Badge className="mt-2" variant={statusVariant(String(item.lastRun?.status ?? ""))}>{String(item.lastRun?.status ?? "Belum run")}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="evaluasi" className="space-y-4">
            {renderMonitoringNotice()}
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="border-border/80">
                <CardHeader>
                  <CardDescription className="uppercase tracking-[0.14em]">Mapping Aktif</CardDescription>
                  <CardTitle className="text-3xl">{mappingTotal}</CardTitle>
                </CardHeader>
              </Card>
              <Card className="border-border/80">
                <CardHeader>
                  <CardDescription className="uppercase tracking-[0.14em]">Run Tersimpan</CardDescription>
                  <CardTitle className="text-3xl">{monitoringStats?.runCount ?? 0}</CardTitle>
                </CardHeader>
              </Card>
              <Card className="border-border/80">
                <CardHeader>
                  <CardDescription className="uppercase tracking-[0.14em]">Butuh Input Manual</CardDescription>
                  <CardTitle className="text-3xl">{monitoringStats?.manualInputIndicators ?? 0}</CardTitle>
                </CardHeader>
              </Card>
            </div>
            <Card className="border-border/80">
              <CardHeader>
                <CardTitle>Evaluasi Gabungan</CardTitle>
                <CardDescription>Membandingkan katalog monitoring dengan indikator SK dalam satu run cache.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => runMonitoringJob("COMBINED_EVALUATION", true)} disabled={!canManageMonitoring || Boolean(monitoringAction)}>
                    {monitoringAction === "run-COMBINED_EVALUATION" ? <RefreshCw className="h-4 w-4 animate-spin" /> : <GitCompare className="h-4 w-4" />}
                    Dry-run Evaluasi Gabungan
                  </Button>
                  <Button variant="outline" onClick={generateIndicatorMapping} disabled={!canManageMonitoring || Boolean(monitoringAction)}>
                    <Wand2 className="h-4 w-4" />
                    Generate Mapping
                  </Button>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {(monitoringStats?.mappings ?? []).map((item) => (
                    <div key={item.mappingType} className="flex items-center justify-between rounded-md border border-border/80 p-3 text-sm">
                      <span>{item.mappingType}</span>
                      <Badge variant="outline">{item.count}</Badge>
                    </div>
                  ))}
                  {(monitoringStats?.mappings ?? []).length === 0 ? <p className="text-sm text-muted-foreground">Belum ada mapping. Jalankan sinkronisasi katalog monitoring, import SK, lalu generate mapping.</p> : null}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="indikator" className="space-y-4">
            {renderMonitoringNotice()}
            <Card className="border-border/80">
              <CardHeader>
                <CardTitle>Indikator Monitoring</CardTitle>
                <CardDescription>Daftar indikator hasil sinkronisasi katalog monitoring dan SK, lengkap dengan status safety query.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                  <label className="space-y-1 text-sm">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Cari</span>
                    <input className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={monitoringFilters.q} onChange={(event) => setMonitoringFilters((current) => ({ ...current, q: event.target.value, page: 1 }))} placeholder="nama, kode, file" />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Sumber</span>
                    <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={monitoringFilters.sourceType} onChange={(event) => setMonitoringFilters((current) => ({ ...current, sourceType: event.target.value, page: 1 }))}>
                      <option value="">Semua</option>
                      {(monitoringIndicators?.sources ?? []).map((item) => <option key={item.sourceType} value={item.sourceType}>{sourceLabel(item.sourceType)} ({item.count})</option>)}
                    </select>
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Kategori</span>
                    <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={monitoringFilters.category} onChange={(event) => setMonitoringFilters((current) => ({ ...current, category: event.target.value, page: 1 }))}>
                      <option value="">Semua</option>
                      {(monitoringIndicators?.categories ?? []).map((item) => <option key={item.category} value={item.category}>{item.category} ({item.count})</option>)}
                    </select>
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Status</span>
                    <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={monitoringFilters.status} onChange={(event) => setMonitoringFilters((current) => ({ ...current, status: event.target.value, page: 1 }))}>
                      <option value="">Semua</option>
                      {(monitoringIndicators?.statuses ?? []).map((item) => <option key={item.status} value={item.status}>{formatStatusLabel(item.status)} ({item.count})</option>)}
                    </select>
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Review</span>
                    <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={monitoringFilters.reviewStatus} onChange={(event) => setMonitoringFilters((current) => ({ ...current, reviewStatus: event.target.value, page: 1 }))}>
                      <option value="">Semua</option>
                      <option value="AUTO_IMPORTED">{formatStatusLabel("AUTO_IMPORTED")}</option>
                      <option value="NEEDS_ADMIN_REVIEW">{formatStatusLabel("NEEDS_ADMIN_REVIEW")}</option>
                      <option value="ADMIN_REVIEWED">{formatStatusLabel("ADMIN_REVIEWED")}</option>
                    </select>
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Per halaman</span>
                    <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={monitoringFilters.pageSize} onChange={(event) => setMonitoringFilters((current) => ({ ...current, pageSize: Number(event.target.value), page: 1 }))}>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                    </select>
                  </label>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                  <span>{monitoringLoading ? "Memuat indikator..." : `${monitoringIndicators?.pagination.total ?? 0} indikator ditemukan`}</span>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setMonitoringFilters((current) => ({ ...current, page: Math.max(1, current.page - 1) }))} disabled={monitoringFilters.page <= 1 || monitoringLoading}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span>Hal. {monitoringFilters.page} / {monitoringIndicators?.pagination.totalPages ?? 1}</span>
                    <Button variant="outline" size="sm" onClick={() => setMonitoringFilters((current) => ({ ...current, page: current.page + 1 }))} disabled={monitoringLoading || monitoringFilters.page >= (monitoringIndicators?.pagination.totalPages ?? 1)}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="overflow-x-auto rounded-md border border-border/80">
                  <table className="w-full min-w-[1100px] text-left text-sm">
                    <thead className="bg-muted/70 text-xs uppercase tracking-[0.12em] text-muted-foreground">
                      <tr>
                        <th className="px-3 py-3 font-semibold">Indikator</th>
                        <th className="px-3 py-3 font-semibold">Sumber</th>
                        <th className="px-3 py-3 font-semibold">Kategori</th>
                        <th className="px-3 py-3 font-semibold">Query</th>
                        <th className="px-3 py-3 font-semibold">Bobot</th>
                        <th className="px-3 py-3 font-semibold">Status</th>
                        <th className="px-3 py-3 font-semibold">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(monitoringIndicators?.rows ?? []).map((item) => (
                        <tr key={item.indicatorKey} className="border-t border-border/70 align-top">
                          <td className="px-3 py-3">
                            <p className="font-medium">{item.indicatorName}</p>
                            <p className="mt-1 font-mono text-xs text-muted-foreground">{item.indicatorCode || item.indicatorKey}</p>
                            <p className="mt-1 line-clamp-2 max-w-[360px] text-xs text-muted-foreground">{item.shortDescription}</p>
                          </td>
                          <td className="px-3 py-3">{sourceLabel(item.sourceType)}</td>
                          <td className="px-3 py-3">{item.category || "-"}</td>
                          <td className="px-3 py-3 font-mono text-xs">{item.queryKey || "-"}</td>
                          <td className="px-3 py-3">{numericText(item.weight)}</td>
                          <td className="px-3 py-3">
                            <div className="flex flex-col gap-1">
                              <Badge variant={statusVariant(item.safetyStatus)}>{formatStatusLabel(item.safetyStatus)}</Badge>
                              <span className="text-xs text-muted-foreground">{item.reviewStatus}</span>
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <Button size="sm" variant="outline" onClick={() => loadMonitoringIndicatorDetail(item.indicatorKey)}>
                              <Eye className="h-4 w-4" />
                              Detail
                            </Button>
                          </td>
                        </tr>
                      ))}
                      {monitoringIndicators?.rows.length === 0 ? (
                        <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">Tidak ada indikator sesuai filter.</td></tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {selectedMonitoringIndicatorKey ? (
              <Card className="border-border/80">
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle>{monitoringIndicatorDetail?.indicatorName ?? "Detail Indikator"}</CardTitle>
                      <CardDescription>{selectedMonitoringIndicatorKey}</CardDescription>
                    </div>
                    <Button variant="ghost" size="icon" onClick={closeMonitoringIndicatorDetail} aria-label="Tutup detail indikator">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  {monitoringIndicatorDetailLoading ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Memuat detail indikator.
                    </div>
                  ) : null}
                  {monitoringIndicatorDetail ? (
                    <>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant={statusVariant(monitoringIndicatorDetail.safetyStatus)}>{formatStatusLabel(monitoringIndicatorDetail.safetyStatus)}</Badge>
                        <Badge variant="outline">{sourceLabel(monitoringIndicatorDetail.sourceType)}</Badge>
                        <Badge variant="outline">{monitoringIndicatorDetail.category || "Lainnya"}</Badge>
                      </div>
                      <p className="leading-6 text-muted-foreground">{monitoringIndicatorDetail.longDescription || monitoringIndicatorDetail.shortDescription}</p>
                      <div className="grid gap-3 md:grid-cols-3">
                        <div className="rounded-md border border-border/80 p-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Query</p>
                          <p className="mt-2 break-all font-mono text-xs">{monitoringIndicatorDetail.queryKey || "-"}</p>
                        </div>
                        <div className="rounded-md border border-border/80 p-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Bobot</p>
                          <p className="mt-2 font-semibold">{numericText(monitoringIndicatorDetail.weight)}</p>
                        </div>
                        <div className="rounded-md border border-border/80 p-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Latest Result</p>
                          <p className="mt-2">{monitoringIndicatorDetail.latestResult?.status || monitoringIndicatorDetail.latestResultStatus ? formatStatusLabel(String(monitoringIndicatorDetail.latestResult?.status ?? monitoringIndicatorDetail.latestResultStatus)) : "-"}</p>
                        </div>
                      </div>
                      <div className="rounded-md border border-border/80 p-3">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Rekomendasi</p>
                        <p className="text-muted-foreground">{monitoringIndicatorDetail.recommendationTemplate || "Belum ada rekomendasi."}</p>
                      </div>
                      <div className="rounded-md border border-border/80 p-3">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Mapping Terkait</p>
                        <div className="space-y-2">
                          {monitoringIndicatorDetail.mappings.length > 0 ? monitoringIndicatorDetail.mappings.map((item, index) => (
                            <div key={`${String(item.source_indicator_key)}-${String(item.target_indicator_key)}-${index}`} className="rounded-md bg-muted/50 p-2 text-xs">
                              <p className="font-mono">{String(item.source_indicator_key ?? "-")}{" -> "}{String(item.target_indicator_key ?? "-")}</p>
                              <p className="text-muted-foreground">{String(item.mapping_type ?? "-")} | similarity {String(item.similarity_score ?? "-")}</p>
                            </div>
                          )) : <p className="text-muted-foreground">Belum ada mapping untuk indikator ini.</p>}
                        </div>
                      </div>
                      <div className="space-y-3 rounded-md border border-border/80 p-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Input Manual</p>
                        <div className="grid gap-3 md:grid-cols-3">
                          <input className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={manualInputDraft.value} onChange={(event) => setManualInputDraft((current) => ({ ...current, value: event.target.value }))} placeholder="nilai/status" />
                          <input className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={manualInputDraft.notes} onChange={(event) => setManualInputDraft((current) => ({ ...current, notes: event.target.value }))} placeholder="catatan admin" />
                          <input className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={manualInputDraft.evidence} onChange={(event) => setManualInputDraft((current) => ({ ...current, evidence: event.target.value }))} placeholder="evidence/catatan bukti" />
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button variant="outline" onClick={() => saveManualInputForSelected("DRAFT")} disabled={!canManageMonitoring || monitoringAction === "manual-input" || !manualInputDraft.value.trim()}>
                            {monitoringAction === "manual-input" ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Edit3 className="h-4 w-4" />}
                            Simpan Draft
                          </Button>
                          <Button variant="outline" onClick={() => saveManualInputForSelected("SUBMITTED")} disabled={!canManageMonitoring || monitoringAction === "manual-input" || !manualInputDraft.value.trim()}>
                            <UploadCloud className="h-4 w-4" />
                            Ajukan
                          </Button>
                          <Button onClick={() => saveManualInputForSelected("APPROVED")} disabled={!canManageMonitoring || monitoringAction === "manual-input" || !manualInputDraft.value.trim()}>
                            <ShieldCheck className="h-4 w-4" />
                            Setujui
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-3 rounded-md border border-border/80 p-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Konfigurasi Formula</p>
                        <div className="grid gap-3 md:grid-cols-4">
                          <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={formulaDraft.formulaType} onChange={(event) => setFormulaDraft((current) => ({ ...current, formulaType: event.target.value }))}>
                            <option value="percentage">Persentase</option>
                            <option value="issue_count">Jumlah Temuan</option>
                            <option value="issue_list">Daftar Temuan</option>
                            <option value="manual_score">Nilai Manual</option>
                            <option value="deduction">Pengurang</option>
                          </select>
                          <input className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={formulaDraft.numeratorField} onChange={(event) => setFormulaDraft((current) => ({ ...current, numeratorField: event.target.value }))} placeholder="field numerator" />
                          <input className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={formulaDraft.denominatorField} onChange={(event) => setFormulaDraft((current) => ({ ...current, denominatorField: event.target.value }))} placeholder="field denominator" />
                          <input className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={formulaDraft.weight} onChange={(event) => setFormulaDraft((current) => ({ ...current, weight: event.target.value }))} placeholder="bobot" />
                          <input className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={formulaDraft.maxScore} onChange={(event) => setFormulaDraft((current) => ({ ...current, maxScore: event.target.value }))} placeholder="nilai maksimal" />
                          <input className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={formulaDraft.thresholdGreen} onChange={(event) => setFormulaDraft((current) => ({ ...current, thresholdGreen: event.target.value }))} placeholder="ambang hijau" />
                          <input className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={formulaDraft.thresholdYellow} onChange={(event) => setFormulaDraft((current) => ({ ...current, thresholdYellow: event.target.value }))} placeholder="ambang kuning" />
                          <input className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={formulaDraft.thresholdRed} onChange={(event) => setFormulaDraft((current) => ({ ...current, thresholdRed: event.target.value }))} placeholder="ambang merah" />
                        </div>
                        <textarea className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={formulaDraft.formulaText} onChange={(event) => setFormulaDraft((current) => ({ ...current, formulaText: event.target.value }))} placeholder="dasar formula / catatan SK" />
                        <div className="flex flex-wrap gap-2">
                          <input className="h-10 min-w-[260px] flex-1 rounded-md border border-input bg-background px-3 text-sm" value={formulaDraft.notes} onChange={(event) => setFormulaDraft((current) => ({ ...current, notes: event.target.value }))} placeholder="catatan konfigurasi" />
                          <Button onClick={saveFormulaForSelected} disabled={!canManageMonitoring || monitoringAction === "formula-config"}>
                            {monitoringAction === "formula-config" ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                            Simpan Formula
                          </Button>
                        </div>
                      </div>
                    </>
                  ) : null}
                </CardContent>
              </Card>
            ) : null}
          </TabsContent>

          <TabsContent value="runs" className="space-y-4">
            {renderMonitoringNotice()}
            <Card className="border-border/80">
              <CardHeader>
                <CardTitle>Riwayat Run</CardTitle>
                <CardDescription>Semua run monitoring tersimpan di metadata ALETA dan dapat dibuka ulang.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-5">
                  <label className="space-y-1 text-sm">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Tipe</span>
                    <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={runFilters.runType} onChange={(event) => setRunFilters((current) => ({ ...current, runType: event.target.value, page: 1 }))}>
                      <option value="">Semua</option>
                      <option value="PENDUKUNG2018_MONITORING">Monitoring SIPP</option>
                      <option value="SK_TRIWULAN_ASSESSMENT">Penilaian SK SIPP Triwulan</option>
                      <option value="COMBINED_EVALUATION">Evaluasi Gabungan</option>
                    </select>
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Tahun</span>
                    <input className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" type="number" value={runFilters.year} onChange={(event) => setRunFilters((current) => ({ ...current, year: Number(event.target.value) || currentYear, page: 1 }))} />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Triwulan</span>
                    <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={runFilters.quarter} onChange={(event) => setRunFilters((current) => ({ ...current, quarter: Number(event.target.value), page: 1 }))}>
                      <option value={0}>Semua</option>
                      <option value={1}>1</option>
                      <option value={2}>2</option>
                      <option value={3}>3</option>
                      <option value={4}>4</option>
                    </select>
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Status</span>
                    <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={runFilters.status} onChange={(event) => setRunFilters((current) => ({ ...current, status: event.target.value, page: 1 }))}>
                      <option value="">Semua</option>
                      <option value="COMPLETED">{formatStatusLabel("COMPLETED")}</option>
                      <option value="COMPLETED_WITH_WARNINGS">{formatStatusLabel("COMPLETED_WITH_WARNINGS")}</option>
                      <option value="FAILED">{formatStatusLabel("FAILED")}</option>
                    </select>
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Per halaman</span>
                    <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={runFilters.pageSize} onChange={(event) => setRunFilters((current) => ({ ...current, pageSize: Number(event.target.value), page: 1 }))}>
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                    </select>
                  </label>
                </div>
                <div className="overflow-x-auto rounded-md border border-border/80">
                  <table className="w-full min-w-[1000px] text-left text-sm">
                    <thead className="bg-muted/70 text-xs uppercase tracking-[0.12em] text-muted-foreground">
                      <tr>
                        <th className="px-3 py-3 font-semibold">Run</th>
                        <th className="px-3 py-3 font-semibold">Tipe</th>
                        <th className="px-3 py-3 font-semibold">Periode</th>
                        <th className="px-3 py-3 font-semibold">Status</th>
                        <th className="px-3 py-3 font-semibold">Temuan</th>
                        <th className="px-3 py-3 font-semibold">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(monitoringRuns?.rows ?? []).map((run) => (
                        <tr key={run.run_key} className="border-t border-border/70 align-top">
                          <td className="px-3 py-3">
                            <p className="font-medium">{run.run_name}</p>
                            <p className="mt-1 font-mono text-xs text-muted-foreground">{run.run_key}</p>
                          </td>
                          <td className="px-3 py-3">{formatRunTypeLabel(run.run_type)}</td>
                          <td className="px-3 py-3">{shortDate(run.date_start)} - {shortDate(run.date_end)}</td>
                          <td className="px-3 py-3"><Badge variant={statusVariant(run.status)}>{formatStatusLabel(run.status)}</Badge></td>
                          <td className="px-3 py-3">{numericText((run.query_not_ready_count ?? 0) + (run.data_not_enough_count ?? 0) + (run.needs_review_count ?? 0))}</td>
                          <td className="px-3 py-3">
                            <Button size="sm" variant="outline" onClick={() => loadRunDetail(run.run_key)}>
                              <Eye className="h-4 w-4" />
                              Detail
                            </Button>
                          </td>
                        </tr>
                      ))}
                      {monitoringRuns?.rows.length === 0 ? (
                        <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">Belum ada run monitoring.</td></tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                  <span>{monitoringRuns?.pagination.total ?? 0} run</span>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setRunFilters((current) => ({ ...current, page: Math.max(1, current.page - 1) }))} disabled={runFilters.page <= 1 || monitoringLoading}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span>Hal. {runFilters.page} / {monitoringRuns?.pagination.totalPages ?? 1}</span>
                    <Button variant="outline" size="sm" onClick={() => setRunFilters((current) => ({ ...current, page: current.page + 1 }))} disabled={monitoringLoading || runFilters.page >= (monitoringRuns?.pagination.totalPages ?? 1)}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {selectedRunKey ? (
              <Card className="border-border/80">
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle>{selectedRunDetail?.run_name ?? "Detail Run"}</CardTitle>
                      <CardDescription>{selectedRunKey}</CardDescription>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button asChild variant="outline" size="sm">
                        <Link href={apiPath(`/api/aleta-sipp/monitoring/export/${encodeURIComponent(selectedRunKey)}.xlsx`)} target="_blank">
                          <Download className="h-4 w-4" />
                          XLSX
                        </Link>
                      </Button>
                      <Button asChild variant="outline" size="sm">
                        <Link href={apiPath(`/api/aleta-sipp/monitoring/export/${encodeURIComponent(selectedRunKey)}.pdf`)} target="_blank">
                          <FileText className="h-4 w-4" />
                          PDF
                        </Link>
                      </Button>
                      <Button variant="ghost" size="icon" onClick={closeRunDetail} aria-label="Tutup detail run">
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {runDetailLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Memuat detail run.
                    </div>
                  ) : null}
                  <div className="grid gap-3 md:grid-cols-4">
                    {(selectedRunDetail?.resultStatusCounts ?? []).map((item) => (
                      <div key={item.status} className="flex items-center justify-between rounded-md border border-border/80 p-3 text-sm">
                        <Badge variant={statusVariant(item.status)}>{formatStatusLabel(item.status)}</Badge>
                        <span className="font-semibold">{item.count}</span>
                      </div>
                    ))}
                  </div>
                  <div className="overflow-x-auto rounded-md border border-border/80">
                    <table className="w-full min-w-[900px] text-left text-sm">
                      <thead className="bg-muted/70 text-xs uppercase tracking-[0.12em] text-muted-foreground">
                        <tr>
                          <th className="px-3 py-3 font-semibold">Indikator</th>
                          <th className="px-3 py-3 font-semibold">Status</th>
                          <th className="px-3 py-3 font-semibold">Skor</th>
                          <th className="px-3 py-3 font-semibold">Temuan</th>
                          <th className="px-3 py-3 font-semibold">Rekomendasi</th>
                          <th className="px-3 py-3 font-semibold">Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(selectedRunResults?.rows ?? []).map((row) => (
                          <tr key={row.id} className="border-t border-border/70 align-top">
                            <td className="px-3 py-3">
                              <p className="font-medium">{row.indicator_name ?? "-"}</p>
                              <p className="mt-1 font-mono text-xs text-muted-foreground">{row.indicator_key ?? "-"}</p>
                            </td>
                            <td className="px-3 py-3"><Badge variant={statusVariant(row.status)}>{formatStatusLabel(row.status)}</Badge></td>
                            <td className="px-3 py-3">{numericText(row.score_percent, "%")}</td>
                            <td className="px-3 py-3">{numericText(row.item_count)}</td>
                            <td className="px-3 py-3 text-muted-foreground">{row.recommendation ?? row.result_summary ?? "-"}</td>
                            <td className="px-3 py-3">
                              <Button size="sm" variant="outline" onClick={() => loadRunResultItems(row.id)} disabled={!Number(row.item_count ?? 0)}>
                                <Search className="h-4 w-4" />
                                Drill-down
                              </Button>
                            </td>
                          </tr>
                        ))}
                        {selectedRunResults?.rows.length === 0 ? (
                          <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">Hasil run belum tersedia.</td></tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </TabsContent>

          <TabsContent value="temuan" className="space-y-4">
            {renderMonitoringNotice()}
            <Card className="border-border/80">
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle>Temuan dan Rekomendasi</CardTitle>
                    <CardDescription>Drill-down perkara/item dari hasil monitoring, termasuk status tindak lanjut.</CardDescription>
                  </div>
                  {selectedResultItemFilter ? <Badge variant="outline">Result {selectedResultItemFilter}</Badge> : selectedRunKey ? <Badge variant="outline">{selectedRunKey}</Badge> : null}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {monitoringItemsLoading ? (
                  <div className="flex items-center gap-2 rounded-md border border-border/80 p-4 text-sm text-muted-foreground">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Memuat temuan monitoring.
                  </div>
                ) : null}
                {!selectedRunKey && monitoringItemRows.length === 0 ? (
                  <div className="rounded-md border border-border/80 p-4 text-sm text-muted-foreground">
                    Pilih salah satu run di tab Riwayat Run atau tombol Drill-down untuk melihat daftar temuan dan rekomendasi tindak lanjut.
                  </div>
                ) : null}
                <div className="overflow-x-auto rounded-md border border-border/80">
                  <table className="w-full min-w-[1180px] text-left text-sm">
                    <thead className="bg-muted/70 text-xs uppercase tracking-[0.12em] text-muted-foreground">
                      <tr>
                        <th className="px-3 py-3 font-semibold">Temuan</th>
                        <th className="px-3 py-3 font-semibold">Perkara</th>
                        <th className="px-3 py-3 font-semibold">Indikator</th>
                        <th className="px-3 py-3 font-semibold">Status</th>
                        <th className="px-3 py-3 font-semibold">Tindak Lanjut</th>
                        <th className="px-3 py-3 font-semibold">Rekomendasi</th>
                        <th className="px-3 py-3 font-semibold">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monitoringItemRows.map((row) => (
                        <tr key={row.id} className="border-t border-border/70 align-top">
                          <td className="px-3 py-3">
                            <p className="font-medium">{row.item_title ?? "-"}</p>
                            <p className="mt-1 max-w-[340px] text-xs text-muted-foreground">{row.item_description ?? "-"}</p>
                          </td>
                          <td className="px-3 py-3">
                            <p className="font-mono text-xs">{row.nomor_perkara || "-"}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{row.perkara_id || "-"}</p>
                          </td>
                          <td className="px-3 py-3">
                            <p className="font-medium">{row.indicator_name ?? row.indicatorName ?? "-"}</p>
                            <p className="mt-1 font-mono text-xs text-muted-foreground">{row.indicator_key ?? row.indicatorKey ?? "-"}</p>
                          </td>
                          <td className="px-3 py-3"><Badge variant={statusVariant(String(row.item_status ?? ""))}>{formatStatusLabel(String(row.item_status ?? "-"))}</Badge></td>
                          <td className="px-3 py-3"><Badge variant={statusVariant(String(row.followup_status ?? ""))}>{formatStatusLabel(String(row.followup_status ?? "-"))}</Badge></td>
                          <td className="px-3 py-3 text-muted-foreground">{row.recommendation ?? "-"}</td>
                          <td className="px-3 py-3">
                            <Button size="sm" variant="outline" onClick={() => markMonitoringItemDone(row.id)} disabled={!canManageMonitoring || monitoringAction === `followup-${row.id}` || row.followup_status === "SELESAI"}>
                              {monitoringAction === `followup-${row.id}` ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                              Selesai
                            </Button>
                          </td>
                        </tr>
                      ))}
                      {monitoringItemRows.length === 0 ? (
                        <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">Belum ada temuan yang dimuat.</td></tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="mapping" className="space-y-4">
            {renderMonitoringNotice()}
            <Card className="border-border/80">
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle>Mapping Indikator</CardTitle>
                <CardDescription>Auto-suggest hubungan antara menu/query monitoring dan butir SK.</CardDescription>
                  </div>
                  <Button onClick={generateIndicatorMapping} disabled={!canManageMonitoring || Boolean(monitoringAction)}>
                    {monitoringAction === "map-indicators" ? <RefreshCw className="h-4 w-4 animate-spin" /> : <GitCompare className="h-4 w-4" />}
                    Generate Mapping
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-md border border-border/80 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Total Mapping</p>
                    <p className="mt-2 text-2xl font-semibold">{mappingTotal}</p>
                  </div>
                  <div className="rounded-md border border-border/80 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Katalog Monitoring</p>
                    <p className="mt-2 text-2xl font-semibold">{monitoringStats?.pendukung2018Indicators ?? 0}</p>
                  </div>
                  <div className="rounded-md border border-border/80 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">SK</p>
                    <p className="mt-2 text-2xl font-semibold">{monitoringStats?.skIndicators ?? 0}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {(monitoringStats?.mappings ?? []).map((item) => (
                    <div key={item.mappingType} className="flex items-center justify-between rounded-md border border-border/80 p-3 text-sm">
                      <span>{item.mappingType}</span>
                      <Badge variant="outline">{item.count}</Badge>
                    </div>
                  ))}
                  {(monitoringStats?.mappings ?? []).length === 0 ? <p className="text-sm text-muted-foreground">Belum ada mapping. Import kedua sumber lalu jalankan Generate Mapping.</p> : null}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="external-connectors" className="space-y-4">
            {renderMonitoringNotice()}
            <Card className="border-border/80">
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle>Konektor Eksternal</CardTitle>
                    <CardDescription>Status konfigurasi read-only untuk fitur yang membutuhkan sistem di luar SIPP.</CardDescription>
                  </div>
                  <Button variant="outline" onClick={reloadExternalConnectors}>
                    <RefreshCw className="h-4 w-4" />
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {(externalConnectors?.rows ?? []).map((connector) => {
                  const draft = connectorDrafts[connector.featureKey] ?? { connectorName: connector.connectorName, endpoint: connector.endpoint, host: connector.host, credentialReference: connector.credentialReference };
                  return (
                    <div key={connector.featureKey} className="space-y-3 rounded-md border border-border/80 p-3 text-sm">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">{connector.featureName}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{connector.groupName}</p>
                        </div>
                        <Badge variant={statusVariant(connector.status)}>{formatStatusLabel(connector.status)}</Badge>
                      </div>
                      <div className="grid gap-3 md:grid-cols-4">
                        <input className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={draft.connectorName} onChange={(event) => setConnectorDrafts((current) => ({ ...current, [connector.featureKey]: { ...draft, connectorName: event.target.value } }))} placeholder="nama konektor" />
                        <input className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={draft.endpoint} onChange={(event) => setConnectorDrafts((current) => ({ ...current, [connector.featureKey]: { ...draft, endpoint: event.target.value } }))} placeholder="endpoint/URL" />
                        <input className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={draft.host} onChange={(event) => setConnectorDrafts((current) => ({ ...current, [connector.featureKey]: { ...draft, host: event.target.value } }))} placeholder="host" />
                        <input className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={draft.credentialReference} onChange={(event) => setConnectorDrafts((current) => ({ ...current, [connector.featureKey]: { ...draft, credentialReference: event.target.value } }))} placeholder="credential reference" />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">Read-only</Badge>
                        <Button size="sm" variant="outline" onClick={() => saveExternalConnector(connector.featureKey, false)} disabled={!canManageMonitoring || monitoringAction === `connector-${connector.featureKey}`}>
                          <ShieldCheck className="h-4 w-4" />
                          Simpan Konfigurasi
                        </Button>
                        <Button size="sm" onClick={() => saveExternalConnector(connector.featureKey, true)} disabled={!canManageMonitoring || monitoringAction === `connector-${connector.featureKey}`}>
                          {monitoringAction === `connector-${connector.featureKey}` ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}
                          Test Status
                        </Button>
                      </div>
                    </div>
                  );
                })}
                {externalConnectors?.rows.length === 0 ? (
                  <div className="rounded-md border border-border/80 p-4 text-sm text-muted-foreground">Belum ada fitur yang membutuhkan konektor eksternal.</div>
                ) : null}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="admin-monitoring" className="space-y-4">
            {renderMonitoringNotice()}
            <Card className="border-border/80">
              <CardHeader>
                <CardTitle>Admin Import Monitoring</CardTitle>
                <CardDescription>Refresh katalog monitoring, indikator, Query Registry, dan SK hanya berjalan dari tombol admin ini.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 lg:grid-cols-2">
                  {(monitoringStats?.sources ?? []).map((source) => (
                    <div key={source.source_key} className="rounded-md border border-border/80 p-3 text-sm">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">{source.source_name}</p>
                          <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{source.source_path}</p>
                        </div>
                        <Badge variant={statusVariant(source.status)}>{formatStatusLabel(source.status)}</Badge>
                      </div>
                      <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
                        <span>Last import: {shortDate(source.last_imported_at)}</span>
                        <span>Indikator: {String(source.summary?.indicatorCount ?? source.summary?.importedIndicators ?? "-")}</span>
                        <span>Query: {String(source.summary?.queryCount ?? source.summary?.importedQueries ?? "-")}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={importPendukung2018} disabled={!canManageMonitoring || Boolean(monitoringAction)}>
                    {monitoringAction === "import-pendukung2018" ? <RefreshCw className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                    Sinkronisasi Katalog
                  </Button>
                  <Button variant="outline" onClick={importSkSipp} disabled={!canManageMonitoring || Boolean(monitoringAction)}>
                    {monitoringAction === "import-sk-sipp" ? <RefreshCw className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                    Import SK SIPP
                  </Button>
                  <Button variant="outline" onClick={generateIndicatorMapping} disabled={!canManageMonitoring || Boolean(monitoringAction)}>
                    {monitoringAction === "map-indicators" ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                    Generate Mapping
                  </Button>
                  <Button variant="outline" onClick={() => autoReviewMonitoringQueries()} disabled={!canManageMonitoring || Boolean(monitoringAction)}>
                    {monitoringAction === "auto-review-monitoring" ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                    Perbaiki Otomatis Query
                  </Button>
                </div>
                <div className="rounded-md border border-border/80 p-3 text-sm text-muted-foreground">
                  Query hasil import yang mengandung INSERT/UPDATE/DELETE/DDL ditandai rejected dan tidak bisa dijalankan dari modul monitoring.
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="penilaian" className="space-y-4">
            {summary.assessmentIndicators.map((indicator) => (
              <Card key={indicator.kode} className="border-border/80">
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-lg">{indicator.nama}</CardTitle>
                      <CardDescription>{indicator.kode}</CardDescription>
                    </div>
                    <Badge variant={statusVariant(indicator.status)}>{formatStatusLabel(indicator.status)}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-6 text-muted-foreground">{indicator.sourceHint}</p>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="jadwal" className="space-y-4">
            <Card className="border-border/80">
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle>Preview Jadwal Persidangan</CardTitle>
                    <CardDescription>Struktur PDF mengikuti registry jadwal sidang read-only.</CardDescription>
                  </div>
                  <Button asChild>
                    <Link href={apiPath("/api/aleta-sipp/schedule/pdf")} target="_blank">
                      <FileText className="h-4 w-4" />
                      Buka PDF
                    </Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead className="bg-muted/70 text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-semibold">No</th>
                      <th className="px-3 py-2 font-semibold">Tanggal</th>
                      <th className="px-3 py-2 font-semibold">Nomor Perkara</th>
                      <th className="px-3 py-2 font-semibold">Para Pihak</th>
                      <th className="px-3 py-2 font-semibold">Majelis</th>
                      <th className="px-3 py-2 font-semibold">Agenda</th>
                      <th className="px-3 py-2 font-semibold">Ruang/Jam</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.schedulePreview.map((row) => (
                      <tr key={row.nomorPerkara} className="border-t border-border/70">
                        <td className="px-3 py-2">{row.nomorUrut}</td>
                        <td className="px-3 py-2">{row.tanggalSidang ?? "-"}</td>
                        <td className="px-3 py-2 font-medium">{row.nomorPerkara}</td>
                        <td className="px-3 py-2">{row.paraPihak}</td>
                        <td className="px-3 py-2">{row.majelis}</td>
                        <td className="px-3 py-2">{row.agenda}</td>
                        <td className="px-3 py-2">{row.ruangSidang} / {row.jamSidang}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="audit" className="space-y-4">
            <Card className="border-border/80">
              <CardHeader>
                <CardTitle>Audit Ringan</CardTitle>
                <CardDescription>Dashboard tidak melakukan scan folder sumber lama atau parse dokumen pada request ini.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {summary.datasource.notes.map((note) => (
                  <div key={note} className="rounded-xl border border-border/80 p-3 text-muted-foreground">
                    {note}
                  </div>
                ))}
                <div className="rounded-xl border border-border/80 p-3">
                  Import job tersimpan: <span className="font-semibold">{summary.counts.importJobs}</span>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      ) : null}
    </div>
  );
}
