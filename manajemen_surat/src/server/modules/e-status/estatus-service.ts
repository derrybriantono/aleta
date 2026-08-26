import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { access } from "node:fs/promises";
import { createInterface } from "node:readline";

import {
  E_STATUS_PERMISSION,
  hasEStatusPermission,
  type EStatusPermission,
} from "@/lib/e-status-types";
import type { UserPersona } from "@/lib/types";
import { type AletaDatabase, withTransaction } from "@/server/db/client";
import { getAletaBotDbConnectionForIntegration, listAletaBotDbConnectionsForIntegrations } from "@/server/modules/aleta-bot/service";
import { queryGatewaySippBridge } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { appendEStatusAuditLog } from "@/server/modules/e-status/estatus-audit-service";
import {
  estatusBadRequest,
  estatusConflict,
  estatusNotFound,
} from "@/server/modules/e-status/estatus-service-errors";
import { requireEStatusPermission, requireAnyEStatusPermission } from "@/server/modules/e-status/estatus-permission-service";
import {
  validateEStatusRecord,
  type EStatusDuplicateFinding,
  type EStatusPartyForValidation,
  type EStatusRecordForValidation,
  type EStatusValidationRuleForEvaluation,
} from "@/server/modules/e-status/estatus-validation-service";
import { nextPrefixedId } from "@/server/shared/ids";
import { getRequestAuditMetadata } from "@/server/shared/request";
import type { NextRequest } from "next/server";

type CountRow = { count: number };

type EStatusRecordRow = {
  id: string;
  source_connection_id: string | null;
  source_connection_key?: string | null;
  source_case_id: string;
  nomor_perkara: string;
  jenis_perkara: string;
  kategori_perubahan: string;
  status_hukum: string;
  tanggal_pendaftaran: string | null;
  tanggal_putusan: string | null;
  tanggal_bht: string | null;
  tanggal_ikrar_talak: string | null;
  nomor_akta_cerai: string | null;
  tanggal_akta_cerai: string | null;
  amar_ringkas: string;
  source_hash: string;
  source_last_changed_at: string | null;
  validation_status: string;
  workflow_status: string;
  readiness_score: number;
  readiness_reasons: unknown;
  duplicate_status: string;
  duplicate_group_key: string;
  duplicate_reason: string;
  last_validated_rule_version: string;
  destination_agency_id: string | null;
  destination_agency_name?: string | null;
  already_sent: number;
  excluded_reason: string;
  created_at: string;
  updated_at: string;
};

type EStatusPartyRow = {
  id: string;
  estatus_record_id: string;
  party_role: string;
  nama: string;
  nik: string;
  nomor_kk: string;
  tempat_lahir: string;
  tanggal_lahir: string | null;
  jenis_kelamin: string;
  alamat: string;
  desa_kelurahan: string;
  kecamatan: string;
  kabupaten_kota: string;
  provinsi: string;
  agama: string;
  status_kawin_lama: string;
  status_kawin_baru: string;
  pasangan_nama: string;
  pasangan_nik: string;
  data_source: string;
  manual_override: number;
  quality_score: number;
  created_at: string;
  updated_at: string;
};

type EStatusAgencyRow = {
  id: string;
  agency_type: string;
  agency_name: string;
  wilayah: string;
  address: string;
  contact_person: string;
  official_email: string;
  phone: string;
  delivery_method: string;
  required_fields_json?: unknown;
  export_template_json?: unknown;
  letter_template?: string;
  is_active: number;
  cooperation_status: string;
  mou_number: string;
  mou_date: string | null;
  mou_valid_until: string | null;
  cooperation_pic_name: string;
  cooperation_pic_phone: string;
  agreed_data_format: string;
  cooperation_notes: string;
  created_at: string;
  updated_at: string;
};

type EStatusBatchRow = {
  id: string;
  batch_number: string;
  batch_type: string;
  destination_agency_id: string | null;
  destination_agency_name?: string | null;
  status: string;
  total_records: number;
  data_snapshot_hash: string;
  created_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  sent_at: string | null;
  locked_at: string | null;
  revision_of_batch_id: string | null;
  revision_reason: string;
  cancellation_reason: string;
  cancelled_by: string | null;
  cancelled_at: string | null;
  revision_count: number;
  notes: string;
  created_at: string;
  updated_at: string;
};

type EStatusConnectionRow = {
  id: string;
  connection_name: string;
  host: string;
  port: number;
  database_name: string;
  username: string;
  driver: string;
  charset: string;
  connection_mode: string;
  readonly_enforced: number;
  sync_schedule_cron: string;
  is_active: number;
  last_test_status: string;
  last_test_message: string | null;
  last_test_at: string | null;
  created_at: string;
  updated_at: string;
};

type EStatusBridgeParty = {
  role?: string;
  name?: string;
  nik?: string;
  nomorKk?: string;
  tempatLahir?: string;
  tanggalLahir?: string | null;
  jenisKelamin?: string;
  alamat?: string;
  desaKelurahan?: string;
  kecamatan?: string;
  kabupatenKota?: string;
  provinsi?: string;
  agama?: string;
};

type EStatusBridgeRecord = {
  sourceCaseId?: string;
  nomorPerkara?: string;
  jenisPerkara?: string;
  kategoriPerubahan?: string;
  statusHukum?: string;
  tanggalPendaftaran?: string | null;
  tanggalPutusan?: string | null;
  tanggalBht?: string | null;
  tanggalIkrarTalak?: string | null;
  nomorAktaCerai?: string;
  tanggalAktaCerai?: string | null;
  amarRingkas?: string;
  sourceLastChangedAt?: string | null;
  parties?: EStatusBridgeParty[];
};

type EStatusBridgeCandidatesResponse = {
  connectionKey: string;
  scope: string;
  total: number;
  records: EStatusBridgeRecord[];
  queryHash: string;
  warnings?: string[];
};

type EStatusSippMappingRow = {
  id: string;
  connection_key: string;
  mapping_version: string;
  source_schema_hash: string;
  entity_key: string;
  table_name: string;
  column_name: string;
  join_rule: unknown;
  detected_from_sql_sample: number;
  source_sql_path: string;
  query_preview: string;
  query_preview_hash: string;
  last_dry_run_status: string;
  last_dry_run_message: string;
  confidence_score: number;
  is_active: number;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
};

type EStatusAgencyTemplateRow = {
  id: string;
  agency_id: string | null;
  agency_name?: string | null;
  template_name: string;
  template_type: string;
  change_type: string;
  format: string;
  required_fields_json: unknown;
  columns_json: unknown;
  body_template: string;
  is_active: number;
  created_at: string;
  updated_at: string;
};

type EStatusTransmissionRow = {
  id: string;
  batch_id: string;
  batch_number: string;
  agency_id: string | null;
  agency_name: string | null;
  agency_type: string | null;
  method: string;
  status: string;
  idempotency_key: string;
  response_code: string;
  response_message: string;
  sent_at: string | null;
  received_at: string | null;
  processed_at: string | null;
  completed_at: string | null;
  rejected_at: string | null;
  last_status_at: string | null;
  receipt_number: string;
  receipt_file_path: string;
  feedback_note: string;
  rejection_reason: string;
  sla_days: number;
  resend_count: number;
  error_message: string | null;
  created_at: string;
  updated_at: string | null;
};

type BatchPayloadRecordRow = EStatusRecordRow & {
  item_status: string;
  item_notes: string;
};

type EStatusFileExchangeRow = {
  id: string;
  batch_id: string;
  batch_number: string;
  document_id: string | null;
  exchange_method: string;
  encryption_status: string;
  encryption_algorithm: string;
  package_hash: string;
  sftp_host: string;
  destination_path: string;
  download_count: number;
  last_downloaded_at: string | null;
  downloaded_by_name: string | null;
  receipt_file_path: string;
  status: string;
  created_at: string;
  updated_at: string;
};

type EStatusApiIntegrationRow = {
  id: string;
  agency_id: string | null;
  agency_name: string | null;
  integration_name: string;
  api_base_url: string;
  auth_type: string;
  token_secret_ref: string;
  signature_secret_ref: string;
  ip_whitelist_json: unknown;
  rate_limit_per_minute: number;
  is_active: number;
  last_test_status: string;
  last_test_at: string | null;
  created_at: string;
  updated_at: string;
};

type EStatusApiRequestRow = {
  id: string;
  batch_id: string | null;
  batch_number: string | null;
  agency_id: string | null;
  agency_name: string | null;
  integration_id: string | null;
  endpoint_path: string;
  method: string;
  status: string;
  idempotency_key: string;
  request_hash: string;
  response_code: string;
  response_message: string;
  attempt_count: number;
  next_retry_at: string | null;
  callback_received_at: string | null;
  callback_status: string;
  created_at: string;
  updated_at: string;
};

type EStatusIncidentRow = {
  id: string;
  incident_type: string;
  severity: string;
  status: string;
  batch_id: string | null;
  batch_number: string | null;
  record_id: string | null;
  agency_id: string | null;
  agency_name: string | null;
  title: string;
  description: string;
  impact_summary: string;
  containment_action: string;
  reporter_name: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

type EStatusMinimizationFindingRow = {
  id: string;
  entity_type: string;
  entity_id: string;
  field_name: string;
  finding_level: string;
  finding_code: string;
  message: string;
  is_resolved: number;
  created_at: string;
};

type ParsedSippTable = {
  tableName: string;
  columns: Array<{ name: string; definition: string }>;
};

type SippMappingSuggestion = {
  entityKey: string;
  tableName: string;
  columnName: string;
  confidenceScore: number;
  note: string;
};

const DEFAULT_ESTATUS_SIPP_SQL_PATH = "D:/Download File/backup_structure_data_db_2026-05-24.sql";

const RELEVANT_SIPP_TABLES = new Set([
  "jenis_perkara",
  "perkara",
  "perkara_pihak1",
  "perkara_pihak2",
  "perkara_putusan",
  "perkara_akta_cerai",
  "perkara_ikrar_talak",
  "perkara_banding",
  "perkara_kasasi",
  "perkara_pk",
  "perkara_data_itsbat",
  "perkara_data_pernikahan",
]);

function nowIso() {
  return new Date().toISOString();
}

function hashJson(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value ?? {})).digest("hex");
}

function hashText(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function diffDays(startDate: string | null | undefined, endDate: string | null | undefined) {
  if (!startDate || !endDate) return 0;
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  return Math.max(0, Math.ceil((end.getTime() - start.getTime()) / 86_400_000));
}

function readString(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function readStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function readJsonArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function readJsonObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
    } catch {
      return {};
    }
  }
  return {};
}

function normalizeConnectionKey(value: unknown) {
  const key = readString(value, "sipp_primary") || "sipp_primary";
  if (!/^[a-zA-Z0-9_-]{2,80}$/.test(key)) {
    estatusBadRequest("Connection key database tidak valid.");
  }
  return key;
}

function localDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeDateText(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return localDate(value);
  }
  const text = readString(value);
  if (!text || text === "0000-00-00" || text.startsWith("0000-00-00")) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    return text.length > 10 ? text.slice(0, 19).replace(" ", "T") : text;
  }
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) return localDate(parsed);
  return text.slice(0, 19);
}

function maskNik(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 8) return value ? "****" : "";
  return `${digits.slice(0, 4)}********${digits.slice(-4)}`;
}

function mapRecord(row: EStatusRecordRow) {
  return {
    id: row.id,
    sourceConnectionId: row.source_connection_id,
    sourceConnectionKey: row.source_connection_key ?? "sipp_primary",
    sourceCaseId: row.source_case_id,
    nomorPerkara: row.nomor_perkara,
    jenisPerkara: row.jenis_perkara,
    kategoriPerubahan: row.kategori_perubahan,
    statusHukum: row.status_hukum,
    tanggalPendaftaran: row.tanggal_pendaftaran,
    tanggalPutusan: row.tanggal_putusan,
    tanggalBht: row.tanggal_bht,
    tanggalIkrarTalak: row.tanggal_ikrar_talak,
    nomorAktaCerai: row.nomor_akta_cerai,
    tanggalAktaCerai: row.tanggal_akta_cerai,
    amarRingkas: row.amar_ringkas,
    sourceHash: row.source_hash,
    sourceLastChangedAt: row.source_last_changed_at,
    validationStatus: row.validation_status,
    workflowStatus: row.workflow_status,
    readinessScore: row.readiness_score,
    readinessReasons: readJsonArray(row.readiness_reasons),
    duplicateStatus: row.duplicate_status,
    duplicateGroupKey: row.duplicate_group_key,
    duplicateReason: row.duplicate_reason,
    lastValidatedRuleVersion: row.last_validated_rule_version,
    destinationAgencyId: row.destination_agency_id,
    destinationAgencyName: row.destination_agency_name ?? null,
    alreadySent: Boolean(row.already_sent),
    excludedReason: row.excluded_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapParty(row: EStatusPartyRow, canViewFullNik: boolean) {
  return {
    id: row.id,
    estatusRecordId: row.estatus_record_id,
    partyRole: row.party_role,
    nama: row.nama,
    nik: canViewFullNik ? row.nik : maskNik(row.nik),
    nomorKk: canViewFullNik ? row.nomor_kk : maskNik(row.nomor_kk),
    tempatLahir: row.tempat_lahir,
    tanggalLahir: row.tanggal_lahir,
    jenisKelamin: row.jenis_kelamin,
    alamat: row.alamat,
    desaKelurahan: row.desa_kelurahan,
    kecamatan: row.kecamatan,
    kabupatenKota: row.kabupaten_kota,
    provinsi: row.provinsi,
    agama: row.agama,
    statusKawinLama: row.status_kawin_lama,
    statusKawinBaru: row.status_kawin_baru,
    pasanganNama: row.pasangan_nama,
    pasanganNik: canViewFullNik ? row.pasangan_nik : maskNik(row.pasangan_nik),
    dataSource: row.data_source,
    manualOverride: Boolean(row.manual_override),
    qualityScore: row.quality_score,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAgency(row: EStatusAgencyRow) {
  return {
    id: row.id,
    agencyType: row.agency_type,
    agencyName: row.agency_name,
    wilayah: row.wilayah,
    address: row.address,
    contactPerson: row.contact_person,
    officialEmail: row.official_email,
    phone: row.phone,
    deliveryMethod: row.delivery_method,
    requiredFields: readJsonArray(row.required_fields_json),
    exportTemplate: readJsonObject(row.export_template_json),
    letterTemplate: row.letter_template ?? "",
    isActive: Boolean(row.is_active),
    cooperationStatus: row.cooperation_status,
    mouNumber: row.mou_number,
    mouDate: row.mou_date,
    mouValidUntil: row.mou_valid_until,
    cooperationPicName: row.cooperation_pic_name,
    cooperationPicPhone: row.cooperation_pic_phone,
    agreedDataFormat: row.agreed_data_format,
    cooperationNotes: row.cooperation_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapBatch(row: EStatusBatchRow) {
  return {
    id: row.id,
    batchNumber: row.batch_number,
    batchType: row.batch_type,
    destinationAgencyId: row.destination_agency_id,
    destinationAgencyName: row.destination_agency_name ?? null,
    status: row.status,
    totalRecords: row.total_records,
    dataSnapshotHash: row.data_snapshot_hash,
    createdBy: row.created_by,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    sentAt: row.sent_at,
    lockedAt: row.locked_at,
    revisionOfBatchId: row.revision_of_batch_id,
    revisionReason: row.revision_reason,
    cancellationReason: row.cancellation_reason,
    cancelledBy: row.cancelled_by,
    cancelledAt: row.cancelled_at,
    revisionCount: row.revision_count,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSippMapping(row: EStatusSippMappingRow) {
  return {
    id: row.id,
    connectionKey: row.connection_key,
    mappingVersion: row.mapping_version,
    sourceSchemaHash: row.source_schema_hash,
    entityKey: row.entity_key,
    tableName: row.table_name,
    columnName: row.column_name,
    joinRule: readJsonObject(row.join_rule),
    detectedFromSqlSample: Boolean(row.detected_from_sql_sample),
    sourceSqlPath: row.source_sql_path,
    queryPreview: row.query_preview,
    queryPreviewHash: row.query_preview_hash,
    lastDryRunStatus: row.last_dry_run_status,
    lastDryRunMessage: row.last_dry_run_message,
    confidenceScore: Number(row.confidence_score ?? 0),
    isActive: Boolean(row.is_active),
    verifiedAt: row.verified_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAgencyTemplate(row: EStatusAgencyTemplateRow) {
  return {
    id: row.id,
    agencyId: row.agency_id,
    agencyName: row.agency_name ?? null,
    templateName: row.template_name,
    templateType: row.template_type,
    changeType: row.change_type,
    format: row.format,
    requiredFields: readJsonArray(row.required_fields_json),
    columns: readJsonArray(row.columns_json),
    bodyTemplate: row.body_template,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapTransmission(row: EStatusTransmissionRow) {
  return {
    id: row.id,
    batchId: row.batch_id,
    batchNumber: row.batch_number,
    agencyId: row.agency_id,
    agencyName: row.agency_name,
    agencyType: row.agency_type,
    method: row.method,
    status: row.status,
    idempotencyKey: row.idempotency_key,
    responseCode: row.response_code,
    responseMessage: row.response_message,
    sentAt: row.sent_at,
    receivedAt: row.received_at,
    processedAt: row.processed_at,
    completedAt: row.completed_at,
    rejectedAt: row.rejected_at,
    lastStatusAt: row.last_status_at,
    receiptNumber: row.receipt_number,
    receiptFilePath: row.receipt_file_path,
    feedbackNote: row.feedback_note,
    rejectionReason: row.rejection_reason,
    slaDays: row.sla_days,
    resendCount: row.resend_count,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapFileExchange(row: EStatusFileExchangeRow) {
  return {
    id: row.id,
    batchId: row.batch_id,
    batchNumber: row.batch_number,
    documentId: row.document_id,
    exchangeMethod: row.exchange_method,
    encryptionStatus: row.encryption_status,
    encryptionAlgorithm: row.encryption_algorithm,
    packageHash: row.package_hash,
    sftpHost: row.sftp_host,
    destinationPath: row.destination_path,
    downloadCount: row.download_count,
    lastDownloadedAt: row.last_downloaded_at,
    downloadedByName: row.downloaded_by_name,
    receiptFilePath: row.receipt_file_path,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapApiIntegration(row: EStatusApiIntegrationRow) {
  return {
    id: row.id,
    agencyId: row.agency_id,
    agencyName: row.agency_name,
    integrationName: row.integration_name,
    apiBaseUrl: row.api_base_url,
    authType: row.auth_type,
    tokenSecretRef: row.token_secret_ref ? "configured" : "",
    signatureSecretRef: row.signature_secret_ref ? "configured" : "",
    ipWhitelist: readJsonArray(row.ip_whitelist_json),
    rateLimitPerMinute: row.rate_limit_per_minute,
    isActive: Boolean(row.is_active),
    lastTestStatus: row.last_test_status,
    lastTestAt: row.last_test_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapApiRequest(row: EStatusApiRequestRow) {
  return {
    id: row.id,
    batchId: row.batch_id,
    batchNumber: row.batch_number,
    agencyId: row.agency_id,
    agencyName: row.agency_name,
    integrationId: row.integration_id,
    endpointPath: row.endpoint_path,
    method: row.method,
    status: row.status,
    idempotencyKey: row.idempotency_key,
    requestHash: row.request_hash,
    responseCode: row.response_code,
    responseMessage: row.response_message,
    attemptCount: row.attempt_count,
    nextRetryAt: row.next_retry_at,
    callbackReceivedAt: row.callback_received_at,
    callbackStatus: row.callback_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapIncident(row: EStatusIncidentRow) {
  return {
    id: row.id,
    incidentType: row.incident_type,
    severity: row.severity,
    status: row.status,
    batchId: row.batch_id,
    batchNumber: row.batch_number,
    recordId: row.record_id,
    agencyId: row.agency_id,
    agencyName: row.agency_name,
    title: row.title,
    description: row.description,
    impactSummary: row.impact_summary,
    containmentAction: row.containment_action,
    reporterName: row.reporter_name,
    resolvedAt: row.resolved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMinimizationFinding(row: EStatusMinimizationFindingRow) {
  return {
    id: row.id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    fieldName: row.field_name,
    findingLevel: row.finding_level,
    findingCode: row.finding_code,
    message: row.message,
    isResolved: Boolean(row.is_resolved),
    createdAt: row.created_at,
  };
}

function mapConnection(row: EStatusConnectionRow) {
  return {
    id: row.id,
    connectionName: row.connection_name,
    host: row.host,
    port: row.port,
    databaseName: row.database_name,
    username: row.username,
    driver: row.driver,
    charset: row.charset,
    connectionMode: row.connection_mode,
    readonlyEnforced: Boolean(row.readonly_enforced),
    syncScheduleCron: row.sync_schedule_cron,
    isActive: Boolean(row.is_active),
    lastTestStatus: row.last_test_status,
    lastTestMessage: row.last_test_message,
    lastTestAt: row.last_test_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function canViewFullNik(actor: UserPersona) {
  const access = requireEStatusPermission(actor, E_STATUS_PERMISSION.RECORDS_VIEW_MASKED);
  return hasEStatusPermission(access, E_STATUS_PERMISSION.RECORDS_VIEW_FULL_NIK);
}

async function ensureDefaultValidationRules(db: AletaDatabase, actor?: UserPersona | null) {
  const timestamp = nowIso();
  const rules = [
    ["CASE_NUMBER_REQUIRED", "core", "ALL", "Nomor perkara wajib tersedia", "critical", 1, 10],
    ["DECISION_DATE_REQUIRED", "core", "ALL", "Tanggal putusan/penetapan wajib tersedia", "error", 1, 20],
    ["NO_ACTIVE_LEGAL_REMEDY", "legal", "ALL", "Tidak ada upaya hukum aktif", "critical", 1, 30],
    ["DIV_CASE_TYPE_ALLOWED", "legal", "PERCERAIAN", "Jenis perkara perceraian valid", "critical", 1],
    ["DIV_BHT_EXISTS", "legal", "PERCERAIAN", "Tanggal BHT wajib ada", "critical", 1],
    ["DIV_AMAR_NOT_NEGATIVE", "legal", "PERCERAIAN", "Amar tidak boleh ditolak/dicabut/NO", "critical", 1],
    ["DIV_TALAK_IKRAR_WARNING", "legal", "PERCERAIAN", "Cerai Talak perlu cek ikrar/akta cerai", "warning", 0],
    ["DIV_AKTA_CERAI_RECOMMENDED", "administrative", "PERCERAIAN", "Nomor akta cerai disarankan tersedia", "warning", 0],
    ["ITSBAT_CASE_TYPE_ALLOWED", "legal", "ITSBAT_NIKAH", "Jenis perkara itsbat/pengesahan nikah valid", "critical", 1],
    ["ITSBAT_GRANTED", "legal", "ITSBAT_NIKAH", "Itsbat harus dikabulkan", "critical", 1],
    ["ITSBAT_DECISION_FINAL", "legal", "ITSBAT_NIKAH", "Tanggal penetapan itsbat tersedia", "error", 1],
    ["MIN_TWO_PARTIES", "identity", "ALL", "Minimal dua pihak terbaca", "error", 1],
    ["PARTY_NAME_REQUIRED", "identity", "ALL", "Nama pihak wajib tersedia", "critical", 1],
    ["NIK_FORMAT", "identity", "ALL", "NIK 16 digit bila tersedia", "warning", 0],
    ["NIK_RECOMMENDED", "identity", "ALL", "NIK disarankan tersedia", "warning", 0],
    ["ADDRESS_MINIMUM", "identity", "ALL", "Alamat minimal sampai kabupaten/kota", "warning", 0],
    ["DESTINATION_AGENCY_RECOMMENDED", "delivery", "ALL", "Instansi tujuan dipilih sebelum batch final", "warning", 0],
    ["DUPLICATE_RECORD", "delivery", "ALL", "Duplikasi perkara/NIK/batch terdahulu", "critical", 1],
    ["NOT_ALREADY_SENT", "delivery", "ALL", "Tidak terkirim ganda tanpa revisi", "critical", 1],
  ] as const;

  for (const [index, rule] of rules.entries()) {
    const [ruleCode, category, changeType, label, severity, isBlocking, explicitOrder] = rule;
    await db.prepare(
      `INSERT INTO estatus_validation_rules (
        id, rule_code, category, change_type, label, severity, expression, is_blocking,
        is_active, sort_order, created_by, updated_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?::jsonb, ?, 1, ?, ?, ?, ?, ?)
      ON CONFLICT (rule_code) DO NOTHING`
    ).run(
      await nextPrefixedId(db, "estatus_validation_rules", "est-rule"),
      ruleCode,
      category,
      changeType,
      label,
      severity,
      JSON.stringify({ configurable: true }),
      isBlocking,
      explicitOrder ?? index + 1,
      actor?.id ?? null,
      actor?.id ?? null,
      timestamp,
      timestamp
    );
  }
}

async function listValidationRulesForEvaluation(db: AletaDatabase) {
  await ensureDefaultValidationRules(db);
  return db.prepare(
    `SELECT id, rule_code AS "ruleCode", change_type AS "changeType", severity,
      is_blocking AS "isBlocking", is_active AS "isActive"
     FROM estatus_validation_rules
     ORDER BY sort_order ASC, rule_code ASC`
  ).all<EStatusValidationRuleForEvaluation>();
}

async function findEStatusDuplicateFindings(
  db: AletaDatabase,
  record: EStatusRecordForValidation,
  parties: EStatusPartyForValidation[]
) {
  const findings: EStatusDuplicateFinding[] = [];

  const sameCase = await db.prepare(
    `SELECT id, nomor_perkara
     FROM estatus_records
     WHERE id <> ? AND deleted_at IS NULL
      AND LOWER(nomor_perkara) = LOWER(?)
      AND kategori_perubahan = ?
     LIMIT 1`
  ).get<{ id: string; nomor_perkara: string }>(record.id, record.nomorPerkara, record.kategoriPerubahan);

  if (sameCase) {
    findings.push({
      code: "DUPLICATE_RECORD",
      message: `Nomor perkara sudah ada pada kandidat lain (${sameCase.nomor_perkara}).`,
      groupKey: `case:${record.kategoriPerubahan}:${record.nomorPerkara.toLowerCase()}`,
      reason: "Nomor perkara sama pada data kandidat lain.",
      fieldPath: "record.nomor_perkara",
    });
  }

  const partyNiks = [...new Set(parties.map((party) => party.nik.trim()).filter((nik) => /^[0-9]{16}$/.test(nik)))];
  if (partyNiks.length > 0) {
    const duplicateNik = await db.prepare(
      `SELECT p.nik, r.id, r.nomor_perkara
       FROM estatus_parties p
       JOIN estatus_records r ON r.id = p.estatus_record_id
       WHERE r.id <> ? AND r.deleted_at IS NULL AND p.nik = ANY(?::text[])
       LIMIT 1`
    ).get<{ nik: string; id: string; nomor_perkara: string }>(record.id, partyNiks);

    if (duplicateNik) {
      findings.push({
        code: "DUPLICATE_RECORD",
        message: `NIK pihak terdeteksi pada kandidat lain (${duplicateNik.nomor_perkara}).`,
        groupKey: `nik:${duplicateNik.nik}`,
        reason: "NIK sama dengan data kandidat/batch lain.",
        fieldPath: "parties.nik",
      });
    }
  }

  for (const party of parties) {
    if (!party.nama.trim() || !party.tanggalLahir) continue;
    const duplicateIdentity = await db.prepare(
      `SELECT p.nama, p.tanggal_lahir, r.nomor_perkara
       FROM estatus_parties p
       JOIN estatus_records r ON r.id = p.estatus_record_id
       WHERE r.id <> ? AND r.deleted_at IS NULL
        AND LOWER(p.nama) = LOWER(?)
        AND p.tanggal_lahir = ?
       LIMIT 1`
    ).get<{ nama: string; tanggal_lahir: string; nomor_perkara: string }>(record.id, party.nama, party.tanggalLahir);

    if (duplicateIdentity) {
      findings.push({
        code: "DUPLICATE_RECORD",
        message: `Nama dan tanggal lahir cocok dengan kandidat lain (${duplicateIdentity.nomor_perkara}).`,
        groupKey: `identity:${party.nama.toLowerCase()}:${party.tanggalLahir}`,
        reason: "Nama dan tanggal lahir sama dengan kandidat lain.",
        fieldPath: "parties.nama",
      });
      break;
    }
  }

  const lockedBatch = await db.prepare(
    `SELECT b.batch_number, b.status
     FROM estatus_batch_items bi
     JOIN estatus_batches b ON b.id = bi.batch_id
     WHERE bi.estatus_record_id = ?
      AND b.status IN ('LOCKED', 'SENT', 'RECEIVED', 'IN_PROCESS', 'COMPLETED')
     LIMIT 1`
  ).get<{ batch_number: string; status: string }>(record.id);

  if (lockedBatch) {
    findings.push({
      code: "DUPLICATE_RECORD",
      message: `Data sudah masuk batch final ${lockedBatch.batch_number} (${lockedBatch.status}).`,
      groupKey: `batch:${lockedBatch.batch_number}`,
      reason: "Record pernah masuk batch terkunci/terkirim.",
      fieldPath: "record.already_sent",
    });
  }

  return findings;
}

export async function getEStatusDashboardSummary(db: AletaDatabase, actor: UserPersona) {
  const access = requireEStatusPermission(actor, E_STATUS_PERMISSION.DASHBOARD_VIEW);
  await ensureDefaultValidationRules(db, actor);

  const [
    ceraiDetected,
    itsbatDetected,
    readyReview,
    needReview,
    invalid,
    duplicate,
    waitingApproval,
    sent,
    rejected,
    agencies,
    rules,
    activeSippConnection,
    lastSync,
  ] = await Promise.all([
    db.prepare("SELECT COUNT(*)::int AS count FROM estatus_records WHERE deleted_at IS NULL AND kategori_perubahan = 'PERCERAIAN'").get<CountRow>(),
    db.prepare("SELECT COUNT(*)::int AS count FROM estatus_records WHERE deleted_at IS NULL AND kategori_perubahan = 'ITSBAT_NIKAH'").get<CountRow>(),
    db.prepare("SELECT COUNT(*)::int AS count FROM estatus_records WHERE deleted_at IS NULL AND validation_status = 'VALID'").get<CountRow>(),
    db.prepare("SELECT COUNT(*)::int AS count FROM estatus_records WHERE deleted_at IS NULL AND validation_status IN ('NEEDS_REVIEW', 'NEEDS_MANUAL_COMPLETION')").get<CountRow>(),
    db.prepare("SELECT COUNT(*)::int AS count FROM estatus_records WHERE deleted_at IS NULL AND validation_status = 'INVALID'").get<CountRow>(),
    db.prepare("SELECT COUNT(*)::int AS count FROM estatus_records WHERE deleted_at IS NULL AND validation_status = 'DUPLICATE'").get<CountRow>(),
    db.prepare("SELECT COUNT(*)::int AS count FROM estatus_batches WHERE status IN ('WAITING_REVIEW', 'WAITING_APPROVAL', 'APPROVED')").get<CountRow>(),
    db.prepare("SELECT COUNT(*)::int AS count FROM estatus_batches WHERE status IN ('SENT', 'RECEIVED', 'IN_PROCESS', 'COMPLETED')").get<CountRow>(),
    db.prepare("SELECT COUNT(*)::int AS count FROM estatus_batches WHERE status IN ('REJECTED', 'REVISION_REQUIRED', 'FAILED')").get<CountRow>(),
    db.prepare("SELECT COUNT(*)::int AS count FROM estatus_agencies WHERE is_active = 1").get<CountRow>(),
    db.prepare("SELECT COUNT(*)::int AS count FROM estatus_validation_rules WHERE is_active = 1").get<CountRow>(),
    getAletaBotDbConnectionForIntegration(db, "sipp_primary"),
    db.prepare(
      `SELECT id, status, sync_scope, started_at, finished_at, total_scanned, total_candidates, error_message
       FROM estatus_sync_logs
       ORDER BY started_at DESC
       LIMIT 1`
    ).get<{
      id: string;
      status: string;
      sync_scope: string;
      started_at: string;
      finished_at: string | null;
      total_scanned: number;
      total_candidates: number;
      error_message: string | null;
    }>(),
  ]);

  const byAgency = await db.prepare(
    `SELECT COALESCE(a.agency_name, 'Belum ditentukan') AS label, COUNT(r.id)::int AS count
     FROM estatus_records r
     LEFT JOIN estatus_agencies a ON a.id = r.destination_agency_id
     WHERE r.deleted_at IS NULL
     GROUP BY COALESCE(a.agency_name, 'Belum ditentukan')
     ORDER BY count DESC, label ASC
     LIMIT 6`
  ).all<{ label: string; count: number }>();

  const byCaseType = await db.prepare(
    `SELECT kategori_perubahan AS label, COUNT(*)::int AS count
     FROM estatus_records
     WHERE deleted_at IS NULL
     GROUP BY kategori_perubahan
     ORDER BY count DESC`
  ).all<{ label: string; count: number }>();

  const [slaSummary, rejectionReasons, rejectionByAgency] = await Promise.all([
    db.prepare(
      `SELECT
        COALESCE(ROUND(AVG(NULLIF(sla_days, 0)))::int, 0) AS average_sla_days,
        COALESCE(MAX(sla_days), 0)::int AS max_sla_days,
        COUNT(*)::int AS transmitted_batches
       FROM estatus_transmission_logs
       WHERE status IN ('SENT', 'RECEIVED', 'IN_PROCESS', 'COMPLETED', 'REJECTED')`
    ).get<{ average_sla_days: number; max_sla_days: number; transmitted_batches: number }>(),
    db.prepare(
      `SELECT COALESCE(NULLIF(rejection_reason, ''), 'Alasan belum dicatat') AS label, COUNT(*)::int AS count
       FROM estatus_agency_feedbacks
       WHERE feedback_status = 'REJECTED'
       GROUP BY COALESCE(NULLIF(rejection_reason, ''), 'Alasan belum dicatat')
       ORDER BY count DESC, label ASC
       LIMIT 6`
    ).all<{ label: string; count: number }>(),
    db.prepare(
      `SELECT COALESCE(a.agency_name, 'Instansi belum ditentukan') AS label, COUNT(*)::int AS count
       FROM estatus_agency_feedbacks f
       LEFT JOIN estatus_agencies a ON a.id = f.agency_id
       WHERE f.feedback_status = 'REJECTED'
       GROUP BY COALESCE(a.agency_name, 'Instansi belum ditentukan')
       ORDER BY count DESC, label ASC
       LIMIT 6`
    ).all<{ label: string; count: number }>(),
  ]);

  const overdueNotSent = await db.prepare(
    `SELECT COUNT(DISTINCT r.id)::int AS count
     FROM estatus_records r
     LEFT JOIN estatus_batch_items bi ON bi.estatus_record_id = r.id
     LEFT JOIN estatus_batches b ON b.id = bi.batch_id
     WHERE r.deleted_at IS NULL
      AND COALESCE(b.status, r.workflow_status) NOT IN ('SENT', 'RECEIVED', 'IN_PROCESS', 'COMPLETED')
      AND COALESCE(r.tanggal_bht, r.tanggal_putusan) IS NOT NULL
      AND CAST(CURRENT_DATE - CAST(COALESCE(r.tanggal_bht, r.tanggal_putusan) AS DATE) AS INTEGER) > 7`
  ).get<CountRow>();

  return {
    roleView: access.roleView,
    visibility: {
      isAdmin: access.isAdmin,
      isOperator: access.isOperator,
      isValidator: access.isValidator,
      isApprover: access.isApprover,
      isLeader: access.isLeader,
      isAuditor: access.isAuditor,
      canManageSettings: hasEStatusPermission(access, E_STATUS_PERMISSION.SETTINGS_MANAGE),
      canRunSync: hasEStatusPermission(access, E_STATUS_PERMISSION.SIPP_SYNC_RUN),
      canCreateBatch: hasEStatusPermission(access, E_STATUS_PERMISSION.BATCH_CREATE),
      canApproveBatch: hasEStatusPermission(access, E_STATUS_PERMISSION.BATCH_APPROVE),
      canViewAudit: hasEStatusPermission(access, E_STATUS_PERMISSION.AUDIT_VIEW),
      canViewFullNik: hasEStatusPermission(access, E_STATUS_PERMISSION.RECORDS_VIEW_FULL_NIK),
    },
    metrics: {
      divorceDetected: ceraiDetected?.count ?? 0,
      itsbatDetected: itsbatDetected?.count ?? 0,
      readyReview: readyReview?.count ?? 0,
      needsReview: needReview?.count ?? 0,
      invalid: invalid?.count ?? 0,
      duplicate: duplicate?.count ?? 0,
      waitingApproval: waitingApproval?.count ?? 0,
      sent: sent?.count ?? 0,
      rejected: rejected?.count ?? 0,
      activeAgencies: agencies?.count ?? 0,
      activeRules: rules?.count ?? 0,
    },
    lastSync: lastSync ?? null,
    charts: {
      byAgency,
      byCaseType,
      rejectionReasons,
      rejectionByAgency,
    },
    sla: {
      averageDays: slaSummary?.average_sla_days ?? 0,
      maxDays: slaSummary?.max_sla_days ?? 0,
      transmittedBatches: slaSummary?.transmitted_batches ?? 0,
      overdueNotSent: overdueNotSent?.count ?? 0,
    },
    readiness: {
      sippConfigured: Boolean(activeSippConnection?.isActive),
      sippConnectionSource: "ALETA Bot",
      sippConnectionKey: activeSippConnection?.key ?? "sipp_primary",
      sippConnectionName: activeSippConnection?.name ?? "SIPP Utama",
      hasPartnerAgency: (agencies?.count ?? 0) > 0,
      hasValidationRules: (rules?.count ?? 0) > 0,
      hasPendingData: (readyReview?.count ?? 0) + (needReview?.count ?? 0) > 0,
    },
  };
}

export async function listEStatusRecords(
  db: AletaDatabase,
  actor: UserPersona,
  filters: {
    kategori?: string;
    validationStatus?: string;
    workflowStatus?: string;
    q?: string;
    limit?: number;
  } = {}
) {
  requireEStatusPermission(actor, E_STATUS_PERMISSION.RECORDS_VIEW_MASKED);
  const clauses = ["r.deleted_at IS NULL"];
  const params: Array<string | number> = [];

  if (filters.kategori) {
    clauses.push("r.kategori_perubahan = ?");
    params.push(filters.kategori);
  }
  if (filters.validationStatus) {
    clauses.push("r.validation_status = ?");
    params.push(filters.validationStatus);
  }
  if (filters.workflowStatus) {
    clauses.push("r.workflow_status = ?");
    params.push(filters.workflowStatus);
  }
  if (filters.q) {
    clauses.push("(LOWER(r.nomor_perkara) LIKE ? OR LOWER(r.jenis_perkara) LIKE ?)");
    const query = `%${filters.q.toLowerCase()}%`;
    params.push(query, query);
  }

  const limit = Math.max(1, Math.min(100, filters.limit ?? 25));
  params.push(limit);

  const rows = await db.prepare(
    `SELECT r.*, a.agency_name AS destination_agency_name
     FROM estatus_records r
     LEFT JOIN estatus_agencies a ON a.id = r.destination_agency_id
     WHERE ${clauses.join(" AND ")}
     ORDER BY r.updated_at DESC, r.nomor_perkara ASC
     LIMIT ?`
  ).all<EStatusRecordRow>(...params);

  return rows.map(mapRecord);
}

export async function getEStatusRecordDetail(db: AletaDatabase, actor: UserPersona, id: string, request?: NextRequest) {
  const canFull = canViewFullNik(actor);
  const row = await db.prepare(
    `SELECT r.*, a.agency_name AS destination_agency_name
     FROM estatus_records r
     LEFT JOIN estatus_agencies a ON a.id = r.destination_agency_id
     WHERE r.id = ? AND r.deleted_at IS NULL`
  ).get<EStatusRecordRow>(id);
  if (!row) estatusNotFound("Kandidat E-Status tidak ditemukan.");

  const parties = await db.prepare(
    `SELECT * FROM estatus_parties
     WHERE estatus_record_id = ?
     ORDER BY party_role ASC, created_at ASC`
  ).all<EStatusPartyRow>(id);
  const validations = await db.prepare(
    `SELECT id, validation_code, validation_level, validation_message, field_path,
      rule_id, is_configurable, is_resolved, created_at
     FROM estatus_validation_results
     WHERE estatus_record_id = ?
     ORDER BY created_at DESC`
  ).all(id);

  if (canFull && parties.some((party) => party.nik || party.nomor_kk || party.pasangan_nik)) {
    await appendEStatusAuditLog(db, {
      userId: actor.id,
      action: "VIEW_FULL_IDENTITY",
      entityType: "estatus_record",
      entityId: id,
      metadata: {
        nomorPerkara: row.nomor_perkara,
        partyCount: parties.length,
        sensitiveFields: ["nik", "nomor_kk", "pasangan_nik"],
        ...(request ? getRequestAuditMetadata(request) : {}),
      },
    });
  }

  return {
    record: mapRecord(row),
    parties: parties.map((party) => mapParty(party, canFull)),
    validations,
  };
}

async function validateEStatusRecordInternal(db: AletaDatabase, actor: UserPersona, id: string, request?: NextRequest) {
  const record = await db.prepare(
    `SELECT id,
      nomor_perkara AS "nomorPerkara",
      jenis_perkara AS "jenisPerkara",
      kategori_perubahan AS "kategoriPerubahan",
      status_hukum AS "statusHukum",
      tanggal_putusan AS "tanggalPutusan",
      tanggal_bht AS "tanggalBht",
      tanggal_ikrar_talak AS "tanggalIkrarTalak",
      nomor_akta_cerai AS "nomorAktaCerai",
      amar_ringkas AS "amarRingkas",
      destination_agency_id AS "destinationAgencyId",
      already_sent AS "alreadySent"
     FROM estatus_records
     WHERE id = ? AND deleted_at IS NULL`
  ).get<EStatusRecordForValidation>(id);

  if (!record) estatusNotFound("Kandidat E-Status tidak ditemukan.");

  const parties = await db.prepare(
    `SELECT party_role AS "partyRole", nama, nik, tanggal_lahir AS "tanggalLahir",
      alamat, kabupaten_kota AS "kabupatenKota",
      pasangan_nama AS "pasanganNama", pasangan_nik AS "pasanganNik"
     FROM estatus_parties
     WHERE estatus_record_id = ?
     ORDER BY party_role ASC`
  ).all<EStatusPartyForValidation>(id);

  const [rules, duplicateFindings] = await Promise.all([
    listValidationRulesForEvaluation(db),
    findEStatusDuplicateFindings(db, record, parties),
  ]);

  const validation = validateEStatusRecord(
    {
      id: record.id,
      nomorPerkara: record.nomorPerkara,
      jenisPerkara: record.jenisPerkara,
      kategoriPerubahan: record.kategoriPerubahan,
      statusHukum: record.statusHukum,
      tanggalPutusan: record.tanggalPutusan,
      tanggalBht: record.tanggalBht,
      tanggalIkrarTalak: record.tanggalIkrarTalak,
      nomorAktaCerai: record.nomorAktaCerai,
      amarRingkas: record.amarRingkas,
      destinationAgencyId: record.destinationAgencyId,
      alreadySent: record.alreadySent,
    },
    parties,
    { rules, duplicateFindings }
  );

  await db.prepare("DELETE FROM estatus_validation_results WHERE estatus_record_id = ?").run(id);
  for (const result of validation.results) {
    await db.prepare(
      `INSERT INTO estatus_validation_results (
        id, estatus_record_id, validation_code, validation_level, validation_message,
        field_path, rule_id, is_configurable, is_resolved, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`
    ).run(
      await nextPrefixedId(db, "estatus_validation_results", "est-val"),
      id,
      result.code,
      result.level,
      result.message,
      result.fieldPath ?? "",
      result.ruleId ?? null,
      result.isConfigurable ? 1 : 0,
      nowIso()
    );
  }

  await db.prepare(
    `UPDATE estatus_records
     SET validation_status = ?, readiness_score = ?, readiness_reasons = ?::jsonb,
      duplicate_status = ?, duplicate_group_key = ?, duplicate_reason = ?,
      last_validated_rule_version = ?, updated_by = ?, updated_at = ?
     WHERE id = ?`
  ).run(
    validation.status,
    validation.readinessScore,
    JSON.stringify(validation.readinessReasons),
    validation.duplicateStatus,
    validation.duplicateGroupKey,
    validation.duplicateReason,
    `rules:${hashJson(rules.map((rule) => [rule.id, rule.ruleCode, rule.severity, rule.isActive]))}`,
    actor.id,
    nowIso(),
    id
  );

  await db.prepare(
    `UPDATE estatus_parties
     SET quality_score = ?, updated_at = ?
     WHERE estatus_record_id = ?`
  ).run(validation.qualityScore, nowIso(), id);

  await appendEStatusAuditLog(db, {
    userId: actor.id,
    action: "VALIDATE_RECORD",
    entityType: "estatus_record",
    entityId: id,
    metadata: {
      status: validation.status,
      readinessScore: validation.readinessScore,
      duplicateStatus: validation.duplicateStatus,
      resultCount: validation.results.length,
      ...(request ? getRequestAuditMetadata(request) : {}),
    },
  });

  return validation;
}

export async function validateEStatusRecordById(db: AletaDatabase, actor: UserPersona, id: string, request?: NextRequest) {
  requireEStatusPermission(actor, E_STATUS_PERMISSION.RECORDS_VALIDATE);
  return withTransaction(db, (tx) => validateEStatusRecordInternal(tx, actor, id, request));
}

export async function listEStatusAgencies(db: AletaDatabase, actor: UserPersona) {
  requireEStatusPermission(actor, E_STATUS_PERMISSION.ACCESS);

  const rows = await db.prepare(
    `SELECT id, agency_type, agency_name, wilayah, address, contact_person, official_email,
      phone, delivery_method, required_fields_json, export_template_json, letter_template,
      is_active, cooperation_status, mou_number, mou_date, mou_valid_until,
      cooperation_pic_name, cooperation_pic_phone, agreed_data_format, cooperation_notes,
      created_at, updated_at
     FROM estatus_agencies
     ORDER BY agency_type ASC, agency_name ASC`
  ).all<EStatusAgencyRow>();

  return rows.map(mapAgency);
}

export async function createEStatusAgency(db: AletaDatabase, actor: UserPersona, payload: Record<string, unknown>, request?: NextRequest) {
  requireEStatusPermission(actor, E_STATUS_PERMISSION.SETTINGS_MANAGE);
  const agencyType = readString(payload.agencyType).toUpperCase();
  const agencyName = readString(payload.agencyName);
  if (!["DUKCAPIL", "KUA", "KEMENAG"].includes(agencyType)) {
    estatusBadRequest("Jenis instansi harus DUKCAPIL, KUA, atau KEMENAG.");
  }
  if (!agencyName) estatusBadRequest("Nama instansi wajib diisi.");

  const timestamp = nowIso();
  const id = await nextPrefixedId(db, "estatus_agencies", "est-agy");

  await db.prepare(
    `INSERT INTO estatus_agencies (
      id, agency_type, agency_name, wilayah, address, contact_person, official_email,
      phone, delivery_method, required_fields_json, export_template_json, letter_template,
      is_active, cooperation_status, mou_number, mou_date, mou_valid_until,
      cooperation_pic_name, cooperation_pic_phone, agreed_data_format, cooperation_notes,
      created_by, updated_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?::jsonb, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    agencyType,
    agencyName,
    readString(payload.wilayah),
    readString(payload.address),
    readString(payload.contactPerson),
    readString(payload.officialEmail),
    readString(payload.phone),
    readString(payload.deliveryMethod, "manual"),
    JSON.stringify(readStringArray(payload.requiredFields)),
    JSON.stringify(readJsonObject(payload.exportTemplate)),
    readString(payload.letterTemplate),
    readString(payload.cooperationStatus, "draft"),
    readString(payload.mouNumber),
    readString(payload.mouDate) || null,
    readString(payload.mouValidUntil) || null,
    readString(payload.cooperationPicName),
    readString(payload.cooperationPicPhone),
    readString(payload.agreedDataFormat),
    readString(payload.cooperationNotes),
    actor.id,
    actor.id,
    timestamp,
    timestamp
  );

  await appendEStatusAuditLog(db, {
    userId: actor.id,
    action: "CREATE_AGENCY",
    entityType: "estatus_agency",
    entityId: id,
    metadata: {
      agencyType,
      agencyName,
      ...(request ? getRequestAuditMetadata(request) : {}),
    },
  });

  return (await listEStatusAgencies(db, actor)).find((agency) => agency.id === id);
}

export async function listEStatusAgencyTemplates(db: AletaDatabase, actor: UserPersona) {
  requireEStatusPermission(actor, E_STATUS_PERMISSION.ACCESS);
  const rows = await db.prepare(
    `SELECT t.*, a.agency_name AS agency_name
     FROM estatus_agency_templates t
     LEFT JOIN estatus_agencies a ON a.id = t.agency_id
     ORDER BY t.updated_at DESC, t.template_name ASC
     LIMIT 80`
  ).all<EStatusAgencyTemplateRow>();

  return rows.map(mapAgencyTemplate);
}

export async function createEStatusAgencyTemplate(
  db: AletaDatabase,
  actor: UserPersona,
  payload: Record<string, unknown>,
  request?: NextRequest
) {
  requireEStatusPermission(actor, E_STATUS_PERMISSION.TEMPLATES_MANAGE);
  const templateName = readString(payload.templateName);
  const templateType = readString(payload.templateType, "lampiran").toLowerCase();
  const changeType = readString(payload.changeType, "ALL").toUpperCase();
  const format = readString(payload.format, "xlsx").toLowerCase();
  if (!templateName) estatusBadRequest("Nama template wajib diisi.");
  if (!["lampiran", "surat", "payload", "tanda_terima"].includes(templateType)) {
    estatusBadRequest("Jenis template tidak dikenal.");
  }
  if (!["ALL", "PERCERAIAN", "ITSBAT_NIKAH"].includes(changeType)) {
    estatusBadRequest("Jenis perubahan template tidak valid.");
  }

  const timestamp = nowIso();
  const id = await nextPrefixedId(db, "estatus_agency_templates", "est-tpl");
  await db.prepare(
    `INSERT INTO estatus_agency_templates (
      id, agency_id, template_name, template_type, change_type, format,
      required_fields_json, columns_json, body_template, is_active,
      created_by, updated_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?::jsonb, ?::jsonb, ?, 1, ?, ?, ?, ?)`
  ).run(
    id,
    readString(payload.agencyId) || null,
    templateName,
    templateType,
    changeType,
    format,
    JSON.stringify(readStringArray(payload.requiredFields)),
    JSON.stringify(readJsonArray(payload.columns)),
    readString(payload.bodyTemplate),
    actor.id,
    actor.id,
    timestamp,
    timestamp
  );

  await appendEStatusAuditLog(db, {
    userId: actor.id,
    action: "CREATE_AGENCY_TEMPLATE",
    entityType: "estatus_agency_template",
    entityId: id,
    metadata: {
      templateName,
      templateType,
      changeType,
      format,
      ...(request ? getRequestAuditMetadata(request) : {}),
    },
  });

  return (await listEStatusAgencyTemplates(db, actor)).find((template) => template.id === id);
}

export async function listEStatusConnections(db: AletaDatabase, actor: UserPersona) {
  requireEStatusPermission(actor, E_STATUS_PERMISSION.SIPP_CONNECTION_MANAGE);

  const connections = await listAletaBotDbConnectionsForIntegrations(db);
  return connections.map((connection) => ({
    id: connection.id,
    connectionName: connection.name,
    connectionKey: connection.key,
    host: connection.host,
    port: connection.port,
    databaseName: connection.databaseName,
    username: connection.usernameMasked,
    driver: connection.driver,
    charset: "utf8mb4",
    connectionMode: "aleta_bot_registry",
    readonlyEnforced: true,
    syncScheduleCron: "",
    isActive: connection.isActive,
    isDefault: connection.isDefault,
    lastTestStatus: connection.lastTestStatus,
    lastTestMessage: connection.lastTestError,
    lastTestAt: connection.lastTestAt,
    createdAt: connection.createdAt,
    updatedAt: connection.updatedAt,
  }));
}

export async function createEStatusConnection(db: AletaDatabase, actor: UserPersona, payload: Record<string, unknown>, request?: NextRequest) {
  requireEStatusPermission(actor, E_STATUS_PERMISSION.SIPP_CONNECTION_MANAGE);
  await appendEStatusAuditLog(db, {
    userId: actor.id,
    action: "REDIRECT_SIPP_CONNECTION_TO_ALETA_BOT",
    entityType: "aleta_bot_db_connections",
    entityId: normalizeConnectionKey(payload.connectionKey),
    metadata: {
      message: "Konfigurasi database SIPP E-Status dipusatkan melalui Pengaturan ALETA Bot.",
      ...(request ? getRequestAuditMetadata(request) : {}),
    },
  });

  estatusBadRequest("Konfigurasi koneksi SIPP sekarang dikelola dari Pengaturan ALETA Bot. Pilih atau ubah koneksi sipp_primary di Admin ALETA Bot.");
}

function validateSelectOnlySql(sql: string) {
  const normalized = sql
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--.*$/gm, " ")
    .trim()
    .toLowerCase();
  const dangerousTokens = [
    "insert",
    "update",
    "delete",
    "drop",
    "truncate",
    "alter",
    "create",
    "replace",
    "grant",
    "revoke",
    "merge",
    "call",
    "execute",
    "lock table",
  ];
  const findings = dangerousTokens.filter((token) => new RegExp(`\\b${token}\\b`).test(normalized));
  const statementCount = normalized.split(";").filter((part) => part.trim()).length;
  if (!/^(select|with)\b/.test(normalized)) findings.push("not_select");
  if (statementCount > 1) findings.push("multiple_statements");
  return {
    ok: findings.length === 0,
    findings: [...new Set(findings)],
  };
}

function candidateDivorceQuery() {
  return `SELECT
  p.perkara_id AS source_case_id,
  p.nomor_perkara,
  p.jenis_perkara_nama,
  pp.tanggal_putusan,
  pp.tanggal_bht,
  pp.amar_putusan,
  pit.tgl_ikrar_talak AS tanggal_ikrar_talak,
  pac.nomor_akta_cerai,
  pac.tgl_akta_cerai,
  p.pihak1_text,
  p.pihak2_text
FROM perkara p
JOIN perkara_putusan pp ON pp.perkara_id = p.perkara_id
LEFT JOIN perkara_ikrar_talak pit ON pit.perkara_id = p.perkara_id
LEFT JOIN perkara_akta_cerai pac ON pac.perkara_id = p.perkara_id
LEFT JOIN perkara_banding pb ON pb.perkara_id = p.perkara_id AND pb.tanggal_cabut IS NULL
LEFT JOIN perkara_kasasi pk ON pk.perkara_id = p.perkara_id AND pk.tanggal_cabut IS NULL
LEFT JOIN perkara_pk ppk ON ppk.perkara_id = p.perkara_id AND ppk.tanggal_cabut IS NULL
WHERE LOWER(p.jenis_perkara_nama) IN ('cerai gugat', 'cerai talak')
  AND pp.tanggal_bht IS NOT NULL
  AND COALESCE(pp.tanggal_cabut, '') = ''
  AND COALESCE(pp.tanggal_gugur, '') = ''
  AND pb.perkara_id IS NULL
  AND pk.perkara_id IS NULL
  AND ppk.perkara_id IS NULL
LIMIT 100`;
}

function candidateItsbatQuery() {
  return `SELECT
  p.perkara_id AS source_case_id,
  p.nomor_perkara,
  p.jenis_perkara_nama,
  pp.tanggal_putusan AS tanggal_penetapan,
  pp.amar_putusan,
  p.pihak1_text,
  p.pihak2_text,
  pdi.*,
  pdp.*
FROM perkara p
JOIN perkara_putusan pp ON pp.perkara_id = p.perkara_id
LEFT JOIN perkara_data_itsbat pdi ON pdi.perkara_id = p.perkara_id
LEFT JOIN perkara_data_pernikahan pdp ON pdp.perkara_id = p.perkara_id
WHERE (
    LOWER(p.jenis_perkara_nama) LIKE '%itsbat%'
    OR LOWER(p.jenis_perkara_nama) LIKE '%pengesahan nikah%'
    OR LOWER(p.jenis_perkara_nama) LIKE '%pengesahan perkawinan%'
  )
  AND LOWER(COALESCE(pp.amar_putusan, '')) LIKE '%dikabul%'
LIMIT 100`;
}

function buildSippMappingSuggestions(tables: ParsedSippTable[]) {
  const tableMap = new Map(tables.map((table) => [table.tableName, new Set(table.columns.map((column) => column.name))]));
  const candidates: SippMappingSuggestion[] = [
    ["case.id", "perkara", "perkara_id", 0.99, "Primary key perkara"],
    ["case.number", "perkara", "nomor_perkara", 0.99, "Nomor perkara"],
    ["case.type_id", "perkara", "jenis_perkara_id", 0.9, "ID jenis perkara"],
    ["case.type_name", "perkara", "jenis_perkara_nama", 0.99, "Nama jenis perkara"],
    ["case.registration_date", "perkara", "tanggal_pendaftaran", 0.88, "Tanggal pendaftaran"],
    ["case.status_text", "perkara", "proses_terakhir_text", 0.7, "Tahapan/proses terakhir"],
    ["party.plaintiff_text", "perkara", "pihak1_text", 0.72, "Teks pihak pertama dari SIPP"],
    ["party.defendant_text", "perkara", "pihak2_text", 0.72, "Teks pihak kedua dari SIPP"],
    ["party.pihak1.name", "perkara_pihak1", "nama", 0.9, "Nama penggugat/pemohon"],
    ["party.pihak1.address", "perkara_pihak1", "alamat", 0.84, "Alamat penggugat/pemohon"],
    ["party.pihak2.name", "perkara_pihak2", "nama", 0.9, "Nama tergugat/termohon"],
    ["party.pihak2.address", "perkara_pihak2", "alamat", 0.84, "Alamat tergugat/termohon"],
    ["decision.date", "perkara_putusan", "tanggal_putusan", 0.98, "Tanggal putusan/penetapan"],
    ["decision.bht_date", "perkara_putusan", "tanggal_bht", 0.98, "Tanggal BHT/inkracht"],
    ["decision.status", "perkara_putusan", "status_putusan_text", 0.82, "Status putusan"],
    ["decision.amar", "perkara_putusan", "amar_putusan", 0.95, "Amar terbatas untuk validasi"],
    ["divorce.certificate_number", "perkara_akta_cerai", "nomor_akta_cerai", 0.95, "Nomor akta cerai"],
    ["divorce.certificate_date", "perkara_akta_cerai", "tgl_akta_cerai", 0.95, "Tanggal akta cerai"],
    ["divorce.talak_pledge_date", "perkara_ikrar_talak", "tgl_ikrar_talak", 0.84, "Tanggal ikrar talak"],
    ["legal_remedy.appeal_date", "perkara_banding", "permohonan_banding", 0.75, "Indikasi banding"],
    ["legal_remedy.cassation_date", "perkara_kasasi", "permohonan_kasasi", 0.75, "Indikasi kasasi"],
    ["legal_remedy.review_date", "perkara_pk", "permohonan_pk", 0.75, "Indikasi PK"],
    ["itsbat.data", "perkara_data_itsbat", "perkara_id", 0.78, "Data pendukung itsbat"],
    ["marriage.data", "perkara_data_pernikahan", "perkara_id", 0.78, "Data pernikahan pendukung"],
  ].map(([entityKey, tableName, columnName, confidenceScore, note]) => ({
    entityKey: String(entityKey),
    tableName: String(tableName),
    columnName: String(columnName),
    confidenceScore: Number(confidenceScore),
    note: String(note),
  }));

  return candidates.filter((candidate) => tableMap.get(candidate.tableName)?.has(candidate.columnName));
}

async function parseSippSqlStructure(sourceSqlPath: string) {
  await access(sourceSqlPath);
  const input = createReadStream(sourceSqlPath, { encoding: "utf8" });
  const reader = createInterface({ input, crlfDelay: Infinity });
  const tables = new Map<string, ParsedSippTable>();
  let current: ParsedSippTable | null = null;

  for await (const line of reader) {
    const createMatch = line.match(/^CREATE TABLE\s+`([^`]+)`/i);
    if (createMatch) {
      const tableName = createMatch[1];
      current = RELEVANT_SIPP_TABLES.has(tableName) ? { tableName, columns: [] } : null;
      continue;
    }

    if (!current) continue;

    if (/^\)\s*ENGINE=/i.test(line)) {
      tables.set(current.tableName, current);
      current = null;
      continue;
    }

    const columnMatch = line.match(/^\s*`([^`]+)`\s+(.+?)(?:,\s*)?$/);
    if (columnMatch) {
      current.columns.push({
        name: columnMatch[1],
        definition: columnMatch[2].trim(),
      });
    }
  }

  return [...tables.values()];
}

export async function listEStatusSippMappings(db: AletaDatabase, actor: UserPersona) {
  requireEStatusPermission(actor, E_STATUS_PERMISSION.SIPP_MAPPING_MANAGE);

  const [mappings, latestSnapshot] = await Promise.all([
    db.prepare(
      `SELECT *
       FROM estatus_sipp_mappings
       ORDER BY updated_at DESC, entity_key ASC
       LIMIT 120`
    ).all<EStatusSippMappingRow>(),
    db.prepare(
      `SELECT id, connection_key, source_sql_path, schema_hash,
        detected_tables_json, suggested_mappings_json, dangerous_sql_findings_json, created_at
       FROM estatus_sipp_schema_snapshots
       ORDER BY created_at DESC
       LIMIT 1`
    ).get<{
      id: string;
      connection_key: string;
      source_sql_path: string;
      schema_hash: string;
      detected_tables_json: unknown;
      suggested_mappings_json: unknown;
      dangerous_sql_findings_json: unknown;
      created_at: string;
    }>(),
  ]);

  return {
    mappings: mappings.map(mapSippMapping),
    latestSnapshot: latestSnapshot
      ? {
          id: latestSnapshot.id,
          connectionKey: latestSnapshot.connection_key,
          sourceSqlPath: latestSnapshot.source_sql_path,
          schemaHash: latestSnapshot.schema_hash,
          detectedTables: readJsonArray(latestSnapshot.detected_tables_json),
          suggestedMappings: readJsonArray(latestSnapshot.suggested_mappings_json),
          dangerousSqlFindings: readJsonArray(latestSnapshot.dangerous_sql_findings_json),
          createdAt: latestSnapshot.created_at,
        }
      : null,
  };
}

export async function analyzeEStatusSippSqlStructure(
  db: AletaDatabase,
  actor: UserPersona,
  payload: Record<string, unknown>,
  request?: NextRequest
) {
  requireEStatusPermission(actor, E_STATUS_PERMISSION.SIPP_MAPPING_MANAGE);
  const sourceSqlPath = readString(payload.sourceSqlPath, DEFAULT_ESTATUS_SIPP_SQL_PATH) || DEFAULT_ESTATUS_SIPP_SQL_PATH;
  const connectionKey = normalizeConnectionKey(payload.connectionKey || "sipp_primary");
  const timestamp = nowIso();
  const parsedTables = await parseSippSqlStructure(sourceSqlPath);
  const suggestions = buildSippMappingSuggestions(parsedTables);
  const previews = [
    { type: "PERCERAIAN", sql: candidateDivorceQuery() },
    { type: "ITSBAT_NIKAH", sql: candidateItsbatQuery() },
  ];
  const dangerousFindings = previews.flatMap((preview) =>
    validateSelectOnlySql(preview.sql).findings.map((finding) => ({ queryType: preview.type, finding }))
  );
  const schemaHash = `sha256:${hashJson(parsedTables)}`;
  const snapshotId = await nextPrefixedId(db, "estatus_sipp_schema_snapshots", "est-ssh");

  await db.prepare(
    `INSERT INTO estatus_sipp_schema_snapshots (
      id, connection_key, source_sql_path, schema_hash, detected_tables_json,
      suggested_mappings_json, dangerous_sql_findings_json, created_by, created_at
    ) VALUES (?, ?, ?, ?, ?::jsonb, ?::jsonb, ?::jsonb, ?, ?)`
  ).run(
    snapshotId,
    connectionKey,
    sourceSqlPath,
    schemaHash,
    JSON.stringify(parsedTables),
    JSON.stringify(suggestions),
    JSON.stringify(dangerousFindings),
    actor.id,
    timestamp
  );

  for (const suggestion of suggestions) {
    const queryPreview = suggestion.entityKey.startsWith("itsbat") || suggestion.tableName.includes("itsbat")
      ? candidateItsbatQuery()
      : candidateDivorceQuery();
    await db.prepare(
      `INSERT INTO estatus_sipp_mappings (
        id, connection_id, connection_key, mapping_version, source_schema_hash,
        entity_key, table_name, column_name, join_rule, detected_from_sql_sample,
        source_sql_path, query_preview, query_preview_hash, last_dry_run_status,
        last_dry_run_message, confidence_score, is_active, created_by, created_at, updated_at
      ) VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?::jsonb, 1, ?, ?, ?, 'not_run', '', ?, 1, ?, ?, ?)
      ON CONFLICT DO NOTHING`
    ).run(
      await nextPrefixedId(db, "estatus_sipp_mappings", "est-map"),
      connectionKey,
      `sample-${timestamp.slice(0, 10)}`,
      schemaHash,
      suggestion.entityKey,
      suggestion.tableName,
      suggestion.columnName,
      JSON.stringify({ note: suggestion.note, source: "backup_structure_data_db_2026-05-24.sql" }),
      sourceSqlPath,
      queryPreview,
      `sha256:${hashJson(queryPreview)}`,
      suggestion.confidenceScore,
      actor.id,
      timestamp,
      timestamp
    );
  }

  await appendEStatusAuditLog(db, {
    userId: actor.id,
    action: "ANALYZE_SIPP_SQL_STRUCTURE",
    entityType: "estatus_sipp_schema_snapshot",
    entityId: snapshotId,
    metadata: {
      sourceSqlPath,
      connectionKey,
      tableCount: parsedTables.length,
      suggestionCount: suggestions.length,
      dangerousFindings,
      ...(request ? getRequestAuditMetadata(request) : {}),
    },
  });

  return {
    snapshotId,
    sourceSqlPath,
    connectionKey,
    schemaHash,
    detectedTables: parsedTables,
    suggestedMappings: suggestions,
    queryPreviews: previews.map((preview) => ({
      ...preview,
      safety: validateSelectOnlySql(preview.sql),
      queryHash: `sha256:${hashJson(preview.sql)}`,
    })),
    dangerousFindings,
  };
}

function getPartyNewMaritalStatus(kategoriPerubahan: string) {
  return kategoriPerubahan === "ITSBAT_NIKAH" ? "KAWIN_TERCATAT" : "CERAI_HIDUP";
}

function normalizeBridgeRecord(candidate: EStatusBridgeRecord) {
  const sourceCaseId = readString(candidate.sourceCaseId);
  const nomorPerkara = readString(candidate.nomorPerkara);
  const kategoriPerubahan = readString(candidate.kategoriPerubahan).toUpperCase();
  if (!sourceCaseId || !nomorPerkara || !["PERCERAIAN", "ITSBAT_NIKAH"].includes(kategoriPerubahan)) {
    return null;
  }

  return {
    sourceCaseId,
    nomorPerkara,
    jenisPerkara: readString(candidate.jenisPerkara),
    kategoriPerubahan,
    statusHukum: readString(candidate.statusHukum),
    tanggalPendaftaran: normalizeDateText(candidate.tanggalPendaftaran),
    tanggalPutusan: normalizeDateText(candidate.tanggalPutusan),
    tanggalBht: normalizeDateText(candidate.tanggalBht),
    tanggalIkrarTalak: normalizeDateText(candidate.tanggalIkrarTalak),
    nomorAktaCerai: readString(candidate.nomorAktaCerai),
    tanggalAktaCerai: normalizeDateText(candidate.tanggalAktaCerai),
    amarRingkas: readString(candidate.amarRingkas).slice(0, 1200),
    sourceLastChangedAt: normalizeDateText(candidate.sourceLastChangedAt),
    parties: Array.isArray(candidate.parties) ? candidate.parties : [],
  };
}

async function upsertEStatusCandidateFromBridge(
  db: AletaDatabase,
  actor: UserPersona,
  connectionKey: string,
  candidate: EStatusBridgeRecord
) {
  const normalized = normalizeBridgeRecord(candidate);
  if (!normalized) return { action: "skipped" as const, recordId: "" };

  const sourceHash = hashJson({ connectionKey, ...normalized });
  const timestamp = nowIso();
  const existing = await db.prepare(
    `SELECT id, source_hash, already_sent, workflow_status
     FROM estatus_records
     WHERE source_connection_key = ? AND source_case_id = ? AND kategori_perubahan = ? AND deleted_at IS NULL
     LIMIT 1`
  ).get<{ id: string; source_hash: string; already_sent: number; workflow_status: string }>(
    connectionKey,
    normalized.sourceCaseId,
    normalized.kategoriPerubahan
  );

  let recordId = existing?.id ?? "";
  let action: "inserted" | "updated" | "unchanged" = "unchanged";
  const canUpdateExisting = !existing || (!existing.already_sent && ["CANDIDATE", "READY_REVIEW", "NEEDS_REVIEW", "DATA_ISSUE"].includes(existing.workflow_status));

  if (!existing) {
    recordId = await nextPrefixedId(db, "estatus_records", "est-rec");
    await db.prepare(
      `INSERT INTO estatus_records (
        id, source_connection_id, source_connection_key, source_case_id, nomor_perkara,
        jenis_perkara, kategori_perubahan, status_hukum, tanggal_pendaftaran, tanggal_putusan,
        tanggal_bht, tanggal_ikrar_talak, nomor_akta_cerai, tanggal_akta_cerai, amar_ringkas,
        source_hash, source_last_changed_at, validation_status, workflow_status,
        created_by, updated_by, created_at, updated_at
      ) VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'NEEDS_REVIEW', 'CANDIDATE', ?, ?, ?, ?)`
    ).run(
      recordId,
      connectionKey,
      normalized.sourceCaseId,
      normalized.nomorPerkara,
      normalized.jenisPerkara,
      normalized.kategoriPerubahan,
      normalized.statusHukum,
      normalized.tanggalPendaftaran,
      normalized.tanggalPutusan,
      normalized.tanggalBht,
      normalized.tanggalIkrarTalak,
      normalized.nomorAktaCerai,
      normalized.tanggalAktaCerai,
      normalized.amarRingkas,
      sourceHash,
      normalized.sourceLastChangedAt,
      actor.id,
      actor.id,
      timestamp,
      timestamp
    );
    action = "inserted";
  } else if (existing.source_hash !== sourceHash && canUpdateExisting) {
    await db.prepare(
      `UPDATE estatus_records
       SET nomor_perkara = ?, jenis_perkara = ?, status_hukum = ?, tanggal_pendaftaran = ?,
        tanggal_putusan = ?, tanggal_bht = ?, tanggal_ikrar_talak = ?, nomor_akta_cerai = ?,
        tanggal_akta_cerai = ?, amar_ringkas = ?, source_hash = ?, source_last_changed_at = ?,
        updated_by = ?, updated_at = ?
       WHERE id = ?`
    ).run(
      normalized.nomorPerkara,
      normalized.jenisPerkara,
      normalized.statusHukum,
      normalized.tanggalPendaftaran,
      normalized.tanggalPutusan,
      normalized.tanggalBht,
      normalized.tanggalIkrarTalak,
      normalized.nomorAktaCerai,
      normalized.tanggalAktaCerai,
      normalized.amarRingkas,
      sourceHash,
      normalized.sourceLastChangedAt,
      actor.id,
      timestamp,
      existing.id
    );
    action = "updated";
  }

  if (canUpdateExisting && recordId) {
    await db.prepare(
      `DELETE FROM estatus_parties
       WHERE estatus_record_id = ? AND data_source = 'SIPP' AND manual_override = 0`
    ).run(recordId);

    for (const party of normalized.parties) {
      await db.prepare(
        `INSERT INTO estatus_parties (
          id, estatus_record_id, party_role, nama, nik, nomor_kk, tempat_lahir,
          tanggal_lahir, jenis_kelamin, alamat, desa_kelurahan, kecamatan,
          kabupaten_kota, provinsi, agama, status_kawin_lama, status_kawin_baru,
          pasangan_nama, pasangan_nik, data_source, manual_override, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?, '', '', 'SIPP', 0, ?, ?)`
      ).run(
        await nextPrefixedId(db, "estatus_parties", "est-pty"),
        recordId,
        readString(party.role, "PIHAK"),
        readString(party.name),
        readString(party.nik),
        readString(party.nomorKk),
        readString(party.tempatLahir),
        normalizeDateText(party.tanggalLahir),
        readString(party.jenisKelamin),
        readString(party.alamat),
        readString(party.desaKelurahan),
        readString(party.kecamatan),
        readString(party.kabupatenKota),
        readString(party.provinsi),
        readString(party.agama),
        getPartyNewMaritalStatus(normalized.kategoriPerubahan),
        timestamp,
        timestamp
      );
    }

    await validateEStatusRecordInternal(db, actor, recordId);
  }

  return { action, recordId };
}

export async function runEStatusSync(db: AletaDatabase, actor: UserPersona, payload: Record<string, unknown>, request?: NextRequest) {
  requireEStatusPermission(actor, E_STATUS_PERMISSION.SIPP_SYNC_RUN);
  const scope = readString(payload.scope, "ALL").toUpperCase();
  const mode = readString(payload.mode, "manual").toLowerCase();
  const connectionKey = normalizeConnectionKey(payload.connectionKey || "sipp_primary");
  const timestamp = nowIso();
  const logId = await nextPrefixedId(db, "estatus_sync_logs", "est-sync");

  const connection = await getAletaBotDbConnectionForIntegration(db, connectionKey);
  if (!connection?.isActive) {
    const message = `Koneksi ${connectionKey} belum aktif di Pengaturan ALETA Bot.`;
    await db.prepare(
      `INSERT INTO estatus_sync_logs (
        id, connection_id, connection_key, sync_type, sync_scope, started_at, finished_at, status,
        total_scanned, total_candidates, total_inserted, total_updated, total_errors,
        structure_hash, query_hash, error_message, executed_by, created_at
      ) VALUES (?, NULL, ?, ?, ?, ?, ?, 'failed', 0, 0, 0, 0, 1, '', '', ?, ?, ?)`
    ).run(logId, connectionKey, mode === "dry_run" ? "dry_run" : "manual", scope, timestamp, timestamp, message, actor.id, timestamp);

    await appendEStatusAuditLog(db, {
      userId: actor.id,
      action: "RUN_SYNC_FAILED",
      entityType: "estatus_sync_log",
      entityId: logId,
      metadata: { scope, mode, connectionKey, message, ...(request ? getRequestAuditMetadata(request) : {}) },
    });

    return { syncLogId: logId, status: "failed", message, scanned: 0, candidates: 0, inserted: 0, updated: 0, errors: 1 };
  }

  const bridgeResult = await queryGatewaySippBridge<EStatusBridgeCandidatesResponse>("estatus.candidates", {
    scope,
    connectionKey,
    limit: Math.max(1, Math.min(500, Number(payload.limit || 100))),
  });

  if (!bridgeResult.ok || bridgeResult.data.ok === false || !bridgeResult.data.data) {
    const message = bridgeResult.ok
      ? bridgeResult.data.error ?? bridgeResult.data.message ?? "Bridge SIPP ALETA Bot belum tersedia."
      : bridgeResult.error;
    await db.prepare(
      `INSERT INTO estatus_sync_logs (
        id, connection_id, connection_key, sync_type, sync_scope, started_at, finished_at, status,
        total_scanned, total_candidates, total_inserted, total_updated, total_errors,
        structure_hash, query_hash, error_message, executed_by, created_at
      ) VALUES (?, NULL, ?, ?, ?, ?, ?, 'failed', 0, 0, 0, 0, 1, '', '', ?, ?, ?)`
    ).run(logId, connectionKey, mode === "dry_run" ? "dry_run" : "manual", scope, timestamp, nowIso(), message, actor.id, timestamp);

    await appendEStatusAuditLog(db, {
      userId: actor.id,
      action: "RUN_SYNC_FAILED",
      entityType: "estatus_sync_log",
      entityId: logId,
      metadata: { scope, mode, connectionKey, message, ...(request ? getRequestAuditMetadata(request) : {}) },
    });

    return { syncLogId: logId, status: "failed", message, scanned: 0, candidates: 0, inserted: 0, updated: 0, errors: 1 };
  }

  const bridgeData = bridgeResult.data.data;
  const candidates = bridgeData.records ?? [];
  const isDryRun = mode === "dry_run";
  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  if (!isDryRun) {
    await withTransaction(db, async (tx) => {
      for (const candidate of candidates) {
        const result = await upsertEStatusCandidateFromBridge(tx, actor, connectionKey, candidate);
        if (result.action === "inserted") inserted += 1;
        if (result.action === "updated") updated += 1;
        if (result.action === "skipped") skipped += 1;
      }
    });
  }

  const status = isDryRun ? "simulated" : "success";
  const warnings = bridgeData.warnings?.filter(Boolean) ?? [];
  const message = isDryRun
    ? `Dry run selesai dari koneksi ALETA Bot ${connectionKey}. Kandidat terbaca: ${candidates.length}.`
    : `Sinkronisasi selesai dari koneksi ALETA Bot ${connectionKey}. Insert ${inserted}, update ${updated}.`;

  await db.prepare(
    `INSERT INTO estatus_sync_logs (
      id, connection_id, connection_key, sync_type, sync_scope, started_at, finished_at, status,
      total_scanned, total_candidates, total_inserted, total_updated, total_errors,
      structure_hash, query_hash, error_message, executed_by, created_at
    ) VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?, ?, ?, ?)`
  ).run(
    logId,
    connectionKey,
    mode === "dry_run" ? "dry_run" : "manual",
    scope,
    timestamp,
    nowIso(),
    status,
    candidates.length,
    candidates.length,
    inserted,
    updated,
    skipped,
    bridgeData.queryHash ?? "",
    warnings.length > 0 ? `${message} Catatan: ${warnings.join(" ")}` : message,
    actor.id,
    timestamp
  );

  await appendEStatusAuditLog(db, {
    userId: actor.id,
    action: "RUN_SYNC",
    entityType: "estatus_sync_log",
    entityId: logId,
    metadata: {
      scope,
      mode,
      connectionKey,
      status,
      message,
      candidates: candidates.length,
      inserted,
      updated,
      skipped,
      ...(request ? getRequestAuditMetadata(request) : {}),
    },
  });

  return {
    syncLogId: logId,
    status,
    message,
    scanned: candidates.length,
    candidates: candidates.length,
    inserted,
    updated,
    errors: skipped,
  };
}

export async function listEStatusSyncLogs(db: AletaDatabase, actor: UserPersona) {
  requireEStatusPermission(actor, E_STATUS_PERMISSION.SIPP_SYNC_RUN);

  return db.prepare(
    `SELECT id, connection_key, sync_type, sync_scope, started_at, finished_at, status, total_scanned,
      total_candidates, total_inserted, total_updated, total_errors, error_message, created_at
     FROM estatus_sync_logs
     ORDER BY started_at DESC
     LIMIT 30`
  ).all();
}

async function generateBatchNumber(db: AletaDatabase) {
  const year = new Date().getFullYear();
  const row = await db.prepare(
    `SELECT COUNT(*)::int AS count
     FROM estatus_batches
     WHERE batch_number LIKE ?`
  ).get<CountRow>(`EST-${year}-%`);

  return `EST-${year}-${String((row?.count ?? 0) + 1).padStart(4, "0")}`;
}

export async function listEStatusBatches(db: AletaDatabase, actor: UserPersona) {
  requireEStatusPermission(actor, E_STATUS_PERMISSION.ACCESS);

  const rows = await db.prepare(
    `SELECT b.*, a.agency_name AS destination_agency_name
     FROM estatus_batches b
     LEFT JOIN estatus_agencies a ON a.id = b.destination_agency_id
     ORDER BY b.created_at DESC
     LIMIT 50`
  ).all<EStatusBatchRow>();

  return rows.map(mapBatch);
}

export async function createEStatusBatch(db: AletaDatabase, actor: UserPersona, payload: Record<string, unknown>, request?: NextRequest) {
  requireEStatusPermission(actor, E_STATUS_PERMISSION.BATCH_CREATE);
  const recordIds = readStringArray(payload.recordIds);
  const batchType = readString(payload.batchType, "CAMPURAN").toUpperCase();
  const destinationAgencyId = readString(payload.destinationAgencyId) || null;
  if (recordIds.length === 0) estatusBadRequest("Pilih minimal satu data kandidat untuk membuat batch.");

  return withTransaction(db, async (tx) => {
    const records = await tx.prepare(
      `SELECT id, validation_status, workflow_status
       FROM estatus_records
       WHERE deleted_at IS NULL AND id = ANY(?::text[])`
    ).all<{ id: string; validation_status: string; workflow_status: string }>(recordIds);
    if (records.length !== recordIds.length) estatusBadRequest("Sebagian data kandidat tidak ditemukan.");
    const invalidRecords = records.filter((record) => !["VALID", "NEEDS_REVIEW"].includes(record.validation_status));
    if (invalidRecords.length > 0) {
      estatusConflict("Batch hanya dapat memuat data valid atau perlu review.", { invalidIds: invalidRecords.map((record) => record.id) });
    }

    const timestamp = nowIso();
    const id = await nextPrefixedId(tx, "estatus_batches", "est-bat");
    const batchNumber = await generateBatchNumber(tx);

    await tx.prepare(
      `INSERT INTO estatus_batches (
        id, batch_number, batch_type, destination_agency_id, status, total_records,
        created_by, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'DRAFT', ?, ?, ?, ?, ?)`
    ).run(
      id,
      batchNumber,
      batchType,
      destinationAgencyId,
      recordIds.length,
      actor.id,
      readString(payload.notes),
      timestamp,
      timestamp
    );

    for (const recordId of recordIds) {
      await tx.prepare(
        `INSERT INTO estatus_batch_items (
          id, batch_id, estatus_record_id, item_status, notes, created_at
        ) VALUES (?, ?, ?, 'DRAFT', '', ?)`
      ).run(
        await nextPrefixedId(tx, "estatus_batch_items", "est-bit"),
        id,
        recordId,
        timestamp
      );
    }

    await tx.prepare(
      `UPDATE estatus_records
       SET workflow_status = 'BATCHED', destination_agency_id = COALESCE(?, destination_agency_id),
        updated_by = ?, updated_at = ?
       WHERE id = ANY(?::text[])`
    ).run(destinationAgencyId, actor.id, timestamp, recordIds);

    await appendEStatusAuditLog(tx, {
      userId: actor.id,
      action: "CREATE_BATCH",
      entityType: "estatus_batch",
      entityId: id,
      metadata: {
        batchNumber,
        batchType,
        totalRecords: recordIds.length,
        destinationAgencyId,
        ...(request ? getRequestAuditMetadata(request) : {}),
      },
    });

    return (await listEStatusBatches(tx, actor)).find((batch) => batch.id === id);
  });
}

async function getBatchPayloadRows(db: AletaDatabase, batchId: string) {
  const batch = await db.prepare(
    `SELECT b.*, a.agency_name AS destination_agency_name, a.agency_type, a.wilayah,
      a.delivery_method, a.agreed_data_format
     FROM estatus_batches b
     LEFT JOIN estatus_agencies a ON a.id = b.destination_agency_id
     WHERE b.id = ?`
  ).get<EStatusBatchRow & {
    agency_type: string | null;
    wilayah: string | null;
    delivery_method: string | null;
    agreed_data_format: string | null;
  }>(batchId);
  if (!batch) estatusNotFound("Batch E-Status tidak ditemukan.");

  const records = await db.prepare(
    `SELECT r.*, bi.item_status, bi.notes AS item_notes, a.agency_name AS destination_agency_name
     FROM estatus_batch_items bi
     JOIN estatus_records r ON r.id = bi.estatus_record_id
     LEFT JOIN estatus_agencies a ON a.id = r.destination_agency_id
     WHERE bi.batch_id = ? AND r.deleted_at IS NULL
     ORDER BY r.nomor_perkara ASC`
  ).all<BatchPayloadRecordRow>(batchId);

  const partiesByRecord = new Map<string, EStatusPartyRow[]>();
  for (const record of records) {
    const parties = await db.prepare(
      `SELECT *
       FROM estatus_parties
       WHERE estatus_record_id = ?
       ORDER BY party_role ASC, created_at ASC`
    ).all<EStatusPartyRow>(record.id);
    partiesByRecord.set(record.id, parties);
  }

  return { batch, records, partiesByRecord };
}

async function buildEStatusBatchPayloadPreviewInternal(
  db: AletaDatabase,
  actor: UserPersona,
  batchId: string,
  request?: NextRequest
) {
  const access = requireEStatusPermission(actor, E_STATUS_PERMISSION.BATCH_REVIEW);
  const fullIdentity = hasEStatusPermission(access, E_STATUS_PERMISSION.RECORDS_VIEW_FULL_NIK);
  const { batch, records, partiesByRecord } = await getBatchPayloadRows(db, batchId);

  const payload = {
    batchNumber: batch.batch_number,
    batchType: batch.batch_type,
    status: batch.status,
    generatedAt: nowIso(),
    destinationAgency: {
      id: batch.destination_agency_id,
      name: batch.destination_agency_name ?? null,
      type: batch.agency_type ?? null,
      wilayah: batch.wilayah ?? null,
      deliveryMethod: batch.delivery_method ?? null,
      agreedDataFormat: batch.agreed_data_format ?? null,
    },
    privacy: {
      purpose: "Preview data minimal perubahan status perkawinan sebelum approval/pengiriman.",
      identityMode: fullIdentity ? "full_for_authorized_user" : "masked",
      excludes: ["amar_lengkap", "dokumen_perkara_lengkap", "data_saksi_wali_kecuali_diminta_mitra"],
    },
    records: records.map((record) => ({
      recordId: record.id,
      case: {
        caseNumber: record.nomor_perkara,
        caseType: record.jenis_perkara,
        changeType: record.kategori_perubahan,
        decisionDate: record.tanggal_putusan,
        finalLegalDate: record.tanggal_bht,
        talakPledgeDate: record.tanggal_ikrar_talak,
        divorceCertificateNumber: record.nomor_akta_cerai,
        divorceCertificateDate: record.tanggal_akta_cerai,
      },
      readiness: {
        validationStatus: record.validation_status,
        readinessScore: record.readiness_score,
        duplicateStatus: record.duplicate_status,
      },
      parties: (partiesByRecord.get(record.id) ?? []).map((party) => ({
        role: party.party_role,
        name: party.nama,
        nik: fullIdentity ? party.nik : maskNik(party.nik),
        nomorKk: fullIdentity ? party.nomor_kk : maskNik(party.nomor_kk),
        birthPlace: party.tempat_lahir,
        birthDate: party.tanggal_lahir,
        gender: party.jenis_kelamin,
        address: party.alamat,
        village: party.desa_kelurahan,
        district: party.kecamatan,
        city: party.kabupaten_kota,
        province: party.provinsi,
        oldMaritalStatus: party.status_kawin_lama,
        newMaritalStatus: party.status_kawin_baru,
        spouseName: party.pasangan_nama,
        spouseNik: fullIdentity ? party.pasangan_nik : maskNik(party.pasangan_nik),
      })),
    })),
  };

  await appendEStatusAuditLog(db, {
    userId: actor.id,
    action: "PREVIEW_PAYLOAD",
    entityType: "estatus_batch",
    entityId: batchId,
    metadata: {
      batchNumber: batch.batch_number,
      totalRecords: records.length,
      identityMode: payload.privacy.identityMode,
      ...(request ? getRequestAuditMetadata(request) : {}),
    },
  });

  return payload;
}

export async function getEStatusBatchPayloadPreview(db: AletaDatabase, actor: UserPersona, batchId: string, request?: NextRequest) {
  return buildEStatusBatchPayloadPreviewInternal(db, actor, batchId, request);
}

function escapeCsv(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function buildCsvFromPayload(payload: Awaited<ReturnType<typeof buildEStatusBatchPayloadPreviewInternal>>) {
  const rows = [
    [
      "batch_number",
      "nomor_perkara",
      "jenis_perkara",
      "jenis_perubahan",
      "tanggal_putusan",
      "tanggal_bht",
      "role",
      "nama",
      "nik",
      "alamat",
      "kabupaten_kota",
      "status_kawin_baru",
    ],
  ];

  for (const record of payload.records) {
    for (const party of record.parties) {
      rows.push([
        payload.batchNumber,
        record.case.caseNumber,
        record.case.caseType,
        record.case.changeType,
        record.case.decisionDate ?? "",
        record.case.finalLegalDate ?? "",
        party.role,
        party.name,
        party.nik,
        party.address,
        party.city,
        party.newMaritalStatus,
      ]);
    }
  }

  return rows.map((row) => row.map(escapeCsv).join(",")).join("\n");
}

export async function exportEStatusBatchFile(
  db: AletaDatabase,
  actor: UserPersona,
  batchId: string,
  payload: Record<string, unknown>,
  request?: NextRequest
) {
  requireEStatusPermission(actor, E_STATUS_PERMISSION.BATCH_EXPORT);
  const format = readString(payload.format, "csv").toLowerCase();
  if (!["csv", "json"].includes(format)) {
    estatusBadRequest("Format export E-Status tahap ini mendukung csv atau json.");
  }

  const preview = await buildEStatusBatchPayloadPreviewInternal(db, actor, batchId, request);
  const timestamp = nowIso();
  const payloadHash = `sha256:${hashJson(preview)}`;
  const watermark = [
    `ALETA E-Status`,
    `Batch: ${preview.batchNumber}`,
    `Diunduh oleh: ${actor.name} (${actor.username})`,
    `Waktu: ${timestamp}`,
    `Payload hash: ${payloadHash}`,
  ].join(" | ");
  const body = format === "json"
    ? JSON.stringify({ watermark, payloadHash, payload: preview }, null, 2)
    : [
        `# ${watermark}`,
        `# Catatan: QR verifikasi hanya membuka nomor batch, status dokumen, tanggal terbit, dan hash.`,
        buildCsvFromPayload(preview),
      ].join("\n");
  const fileHash = `sha256:${hashText(body)}`;
  const documentId = await nextPrefixedId(db, "estatus_documents", "est-doc");
  const token = randomUUID();
  const verificationTokenHash = `sha256:${hashText(token)}`;
  const verificationPublicId = `ESTATUS-${documentId.slice(-8).toUpperCase()}`;
  const qrUrl = `/api/e-status/verify/${token}`;
  const fileName = `${preview.batchNumber.replaceAll("/", "-")}-estatus.${format}`;

  await db.prepare(
    `INSERT INTO estatus_documents (
      id, batch_id, record_id, document_type, document_number, file_path, file_hash,
      qr_code, verification_token_hash, verification_public_id, payload_hash,
      watermark_text, document_status, generated_by, generated_at, created_at
    ) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'generated', ?, ?, ?)`
  ).run(
    documentId,
    batchId,
    `export_${format}`,
    preview.batchNumber,
    `generated://e-status/${preview.batchNumber}/${fileName}`,
    fileHash,
    qrUrl,
    verificationTokenHash,
    verificationPublicId,
    payloadHash,
    watermark,
    actor.id,
    timestamp,
    timestamp
  );

  await appendEStatusAuditLog(db, {
    userId: actor.id,
    action: "EXPORT_BATCH_FILE",
    entityType: "estatus_batch",
    entityId: batchId,
    metadata: {
      batchNumber: preview.batchNumber,
      format,
      fileName,
      fileHash,
      payloadHash,
      verificationPublicId,
      ...(request ? getRequestAuditMetadata(request) : {}),
    },
  });

  return {
    fileName,
    format,
    mimeType: format === "json" ? "application/json; charset=utf-8" : "text/csv; charset=utf-8",
    body,
    fileHash,
    payloadHash,
    verificationUrl: qrUrl,
    verificationPublicId,
  };
}

export async function verifyEStatusDocumentToken(db: AletaDatabase, token: string) {
  const tokenHash = `sha256:${hashText(token)}`;
  const row = await db.prepare(
    `SELECT d.id, d.document_type, d.document_number, d.file_hash, d.payload_hash,
      d.qr_code, d.verification_public_id, d.document_status, d.generated_at,
      b.batch_number, b.status AS batch_status, a.agency_name
     FROM estatus_documents d
     LEFT JOIN estatus_batches b ON b.id = d.batch_id
     LEFT JOIN estatus_agencies a ON a.id = b.destination_agency_id
     WHERE d.verification_token_hash = ?
     LIMIT 1`
  ).get<{
    id: string;
    document_type: string;
    document_number: string;
    file_hash: string;
    payload_hash: string;
    qr_code: string;
    verification_public_id: string;
    document_status: string;
    generated_at: string;
    batch_number: string | null;
    batch_status: string | null;
    agency_name: string | null;
  }>(tokenHash);

  if (!row) estatusNotFound("Kode verifikasi E-Status tidak valid.");

  return {
    valid: true,
    verificationPublicId: row.verification_public_id,
    documentType: row.document_type,
    documentNumber: row.document_number,
    documentStatus: row.document_status,
    batchNumber: row.batch_number,
    batchStatus: row.batch_status,
    agencyName: row.agency_name,
    generatedAt: row.generated_at,
    fileHash: row.file_hash,
    payloadHash: row.payload_hash,
    privacy: "Tidak ada data pribadi yang ditampilkan pada verifikasi QR.",
  };
}

async function calculateBatchSlaDays(db: AletaDatabase, batchId: string, sentAt: string) {
  const rows = await db.prepare(
    `SELECT COALESCE(tanggal_bht, tanggal_putusan) AS final_date
     FROM estatus_records
     WHERE id IN (
       SELECT estatus_record_id FROM estatus_batch_items WHERE batch_id = ?
     )`
  ).all<{ final_date: string | null }>(batchId);
  return Math.max(0, ...rows.map((row) => diffDays(row.final_date, sentAt)));
}

export async function listEStatusTracking(db: AletaDatabase, actor: UserPersona) {
  requireEStatusPermission(actor, E_STATUS_PERMISSION.ACCESS);

  const rows = await db.prepare(
    `SELECT t.*, b.batch_number, a.agency_name, a.agency_type
     FROM estatus_transmission_logs t
     JOIN estatus_batches b ON b.id = t.batch_id
     LEFT JOIN estatus_agencies a ON a.id = t.agency_id
     ORDER BY COALESCE(t.last_status_at, t.created_at) DESC
     LIMIT 80`
  ).all<EStatusTransmissionRow>();

  return rows.map(mapTransmission);
}

type MinimizationFindingInput = {
  fieldName: string;
  findingLevel: "info" | "warning" | "critical";
  findingCode: string;
  message: string;
};

function scanDataMinimizationSurface(value: unknown, prefix = "payload"): MinimizationFindingInput[] {
  const findings: MinimizationFindingInput[] = [];
  const forbidden = [
    {
      code: "FULL_AMAR_DETECTED",
      level: "critical" as const,
      regex: /(amar lengkap|amar_putusan|amar putusan lengkap|putusan lengkap)/i,
      message: "Data amar/putusan lengkap terdeteksi. E-Status hanya boleh memakai ringkasan terbatas jika diperlukan.",
    },
    {
      code: "FULL_DOCUMENT_DETECTED",
      level: "critical" as const,
      regex: /(dokumen lengkap|berkas perkara|salinan putusan lengkap|file putusan)/i,
      message: "Dokumen perkara lengkap terdeteksi. Jangan dikirim jika instansi hanya memerlukan data perubahan status.",
    },
    {
      code: "EXCESS_IDENTITY_FIELD",
      level: "warning" as const,
      regex: /(nama ibu|biometrik|foto ktp|scan ktp|saksi|wali)/i,
      message: "Ada field identitas tambahan yang perlu dibenarkan dasar kebutuhannya sebelum dikirim.",
    },
  ];

  const visit = (item: unknown, path: string) => {
    if (typeof item === "string") {
      for (const rule of forbidden) {
        if (rule.regex.test(item)) {
          findings.push({
            fieldName: path,
            findingLevel: rule.level,
            findingCode: rule.code,
            message: rule.message,
          });
        }
      }
      return;
    }
    if (Array.isArray(item)) {
      item.forEach((child, index) => visit(child, `${path}[${index}]`));
      return;
    }
    if (item && typeof item === "object") {
      for (const [key, child] of Object.entries(item)) {
        visit(child, `${path}.${key}`);
      }
    }
  };

  visit(value, prefix);
  return findings;
}

async function persistMinimizationFindings(
  db: AletaDatabase,
  entityType: string,
  entityId: string,
  findings: MinimizationFindingInput[]
) {
  const timestamp = nowIso();
  await db.prepare(
    `UPDATE estatus_data_minimization_findings
     SET is_resolved = 1, resolved_at = ?
     WHERE entity_type = ? AND entity_id = ? AND is_resolved = 0`
  ).run(timestamp, entityType, entityId);

  for (const finding of findings) {
    await db.prepare(
      `INSERT INTO estatus_data_minimization_findings (
        id, entity_type, entity_id, field_name, finding_level, finding_code,
        message, is_resolved, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`
    ).run(
      await nextPrefixedId(db, "estatus_data_minimization_findings", "est-min"),
      entityType,
      entityId,
      finding.fieldName,
      finding.findingLevel,
      finding.findingCode,
      finding.message,
      timestamp
    );
  }
}

export async function checkEStatusDataMinimization(
  db: AletaDatabase,
  actor: UserPersona,
  payload: Record<string, unknown>,
  request?: NextRequest
) {
  requireEStatusPermission(actor, E_STATUS_PERMISSION.MINIMIZATION_CHECK);
  const entityType = readString(payload.entityType, "ad_hoc");
  const entityId = readString(payload.entityId);
  const target = payload.payload ?? payload;
  const findings = scanDataMinimizationSurface(target);
  if (entityId) {
    await persistMinimizationFindings(db, entityType, entityId, findings);
  }

  await appendEStatusAuditLog(db, {
    userId: actor.id,
    action: "CHECK_DATA_MINIMIZATION",
    entityType,
    entityId,
    metadata: {
      findingCount: findings.length,
      criticalCount: findings.filter((finding) => finding.findingLevel === "critical").length,
      ...(request ? getRequestAuditMetadata(request) : {}),
    },
  });

  return {
    ok: findings.length === 0,
    findings,
    guidance: findings.length === 0
      ? "Tidak ada indikasi data berlebih pada payload/template yang diperiksa."
      : "Periksa temuan sebelum pengiriman. Jika data memang dibutuhkan instansi, catat dasar kerja sama/format data yang disepakati.",
  };
}

export async function listEStatusAdvancedControls(db: AletaDatabase, actor: UserPersona) {
  requireEStatusPermission(actor, E_STATUS_PERMISSION.ACCESS);
  const [fileExchanges, integrations, apiRequests, incidents, minimizationFindings] = await Promise.all([
    db.prepare(
      `SELECT f.*, b.batch_number, u.name AS downloaded_by_name
       FROM estatus_file_exchange_logs f
       JOIN estatus_batches b ON b.id = f.batch_id
       LEFT JOIN users u ON u.id = f.downloaded_by
       ORDER BY f.created_at DESC
       LIMIT 40`
    ).all<EStatusFileExchangeRow>(),
    db.prepare(
      `SELECT i.*, a.agency_name
       FROM estatus_api_integrations i
       LEFT JOIN estatus_agencies a ON a.id = i.agency_id
       ORDER BY i.updated_at DESC
       LIMIT 40`
    ).all<EStatusApiIntegrationRow>(),
    db.prepare(
      `SELECT r.*, b.batch_number, a.agency_name
       FROM estatus_api_requests r
       LEFT JOIN estatus_batches b ON b.id = r.batch_id
       LEFT JOIN estatus_agencies a ON a.id = r.agency_id
       ORDER BY r.created_at DESC
       LIMIT 40`
    ).all<EStatusApiRequestRow>(),
    db.prepare(
      `SELECT i.*, b.batch_number, a.agency_name, u.name AS reporter_name
       FROM estatus_incident_logs i
       LEFT JOIN estatus_batches b ON b.id = i.batch_id
       LEFT JOIN estatus_agencies a ON a.id = i.agency_id
       LEFT JOIN users u ON u.id = i.reported_by
       ORDER BY i.created_at DESC
       LIMIT 40`
    ).all<EStatusIncidentRow>(),
    db.prepare(
      `SELECT *
       FROM estatus_data_minimization_findings
       WHERE is_resolved = 0
       ORDER BY created_at DESC
       LIMIT 40`
    ).all<EStatusMinimizationFindingRow>(),
  ]);

  return {
    fileExchanges: fileExchanges.map(mapFileExchange),
    integrations: integrations.map(mapApiIntegration),
    apiRequests: apiRequests.map(mapApiRequest),
    incidents: incidents.map(mapIncident),
    minimizationFindings: minimizationFindings.map(mapMinimizationFinding),
  };
}

export async function prepareEStatusSecureFileExchange(
  db: AletaDatabase,
  actor: UserPersona,
  payload: Record<string, unknown>,
  request?: NextRequest
) {
  requireEStatusPermission(actor, E_STATUS_PERMISSION.EXCHANGE_MANAGE);
  const batchId = readString(payload.batchId);
  if (!batchId) estatusBadRequest("Batch wajib dipilih untuk secure file exchange.");
  const batch = await db.prepare("SELECT * FROM estatus_batches WHERE id = ?").get<EStatusBatchRow>(batchId);
  if (!batch) estatusNotFound("Batch E-Status tidak ditemukan.");

  const timestamp = nowIso();
  const passwordSeed = readString(payload.batchPassword) || randomUUID();
  const packageDescriptor = {
    batchId,
    batchNumber: batch.batch_number,
    method: readString(payload.exchangeMethod, "manual_encrypted_file"),
    sftpHost: readString(payload.sftpHost),
    destinationPath: readString(payload.destinationPath),
    generatedAt: timestamp,
  };
  const id = await nextPrefixedId(db, "estatus_file_exchange_logs", "est-xchg");
  await db.prepare(
    `INSERT INTO estatus_file_exchange_logs (
      id, batch_id, document_id, exchange_method, encryption_status, encryption_algorithm,
      password_hash, package_hash, sftp_host, destination_path, status, created_by,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, 'encrypted', ?, ?, ?, ?, ?, 'prepared', ?, ?, ?)`
  ).run(
    id,
    batchId,
    readString(payload.documentId) || null,
    readString(payload.exchangeMethod, "manual_encrypted_file"),
    readString(payload.encryptionAlgorithm, "AES-256"),
    `sha256:${hashText(passwordSeed)}`,
    `sha256:${hashJson(packageDescriptor)}`,
    readString(payload.sftpHost),
    readString(payload.destinationPath),
    actor.id,
    timestamp,
    timestamp
  );

  await appendEStatusAuditLog(db, {
    userId: actor.id,
    action: "PREPARE_SECURE_FILE_EXCHANGE",
    entityType: "estatus_batch",
    entityId: batchId,
    metadata: {
      batchNumber: batch.batch_number,
      exchangeMethod: packageDescriptor.method,
      encryptionAlgorithm: readString(payload.encryptionAlgorithm, "AES-256"),
      sftpConfigured: Boolean(packageDescriptor.sftpHost),
      ...(request ? getRequestAuditMetadata(request) : {}),
    },
  });

  return (await listEStatusAdvancedControls(db, actor)).fileExchanges.find((item) => item.id === id);
}

export async function createEStatusApiIntegration(
  db: AletaDatabase,
  actor: UserPersona,
  payload: Record<string, unknown>,
  request?: NextRequest
) {
  requireEStatusPermission(actor, E_STATUS_PERMISSION.INTEGRATION_MANAGE);
  const integrationName = readString(payload.integrationName);
  if (!integrationName) estatusBadRequest("Nama integrasi API wajib diisi.");
  const timestamp = nowIso();
  const id = await nextPrefixedId(db, "estatus_api_integrations", "est-api");
  await db.prepare(
    `INSERT INTO estatus_api_integrations (
      id, agency_id, integration_name, api_base_url, auth_type, token_secret_ref,
      signature_secret_ref, ip_whitelist_json, rate_limit_per_minute, is_active,
      last_test_status, created_by, updated_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?, ?, 'idle', ?, ?, ?, ?)`
  ).run(
    id,
    readString(payload.agencyId) || null,
    integrationName,
    readString(payload.apiBaseUrl),
    readString(payload.authType, "token"),
    readString(payload.tokenSecretRef),
    readString(payload.signatureSecretRef),
    JSON.stringify(readStringArray(payload.ipWhitelist)),
    Math.max(1, Math.min(300, Number(payload.rateLimitPerMinute || 30))),
    payload.isActive ? 1 : 0,
    actor.id,
    actor.id,
    timestamp,
    timestamp
  );

  await appendEStatusAuditLog(db, {
    userId: actor.id,
    action: "CREATE_API_INTEGRATION",
    entityType: "estatus_api_integration",
    entityId: id,
    metadata: {
      integrationName,
      hasTokenRef: Boolean(readString(payload.tokenSecretRef)),
      hasSignatureRef: Boolean(readString(payload.signatureSecretRef)),
      ...(request ? getRequestAuditMetadata(request) : {}),
    },
  });

  return (await listEStatusAdvancedControls(db, actor)).integrations.find((item) => item.id === id);
}

export async function prepareEStatusApiRequest(
  db: AletaDatabase,
  actor: UserPersona,
  payload: Record<string, unknown>,
  request?: NextRequest
) {
  requireEStatusPermission(actor, E_STATUS_PERMISSION.INTEGRATION_MANAGE);
  const batchId = readString(payload.batchId);
  const integrationId = readString(payload.integrationId);
  if (!batchId) estatusBadRequest("Batch wajib dipilih untuk request API.");

  const batch = await db.prepare("SELECT * FROM estatus_batches WHERE id = ?").get<EStatusBatchRow>(batchId);
  if (!batch) estatusNotFound("Batch E-Status tidak ditemukan.");
  const preview = await buildEStatusBatchPayloadPreviewInternal(db, actor, batchId, request);
  const timestamp = nowIso();
  const idempotencyKey = readString(payload.idempotencyKey) || `estatus-${batch.batch_number}-${Date.now()}`;
  const requestHash = `sha256:${hashJson({ preview, idempotencyKey })}`;
  const id = await nextPrefixedId(db, "estatus_api_requests", "est-req");

  await db.prepare(
    `INSERT INTO estatus_api_requests (
      id, batch_id, agency_id, integration_id, endpoint_path, method, status,
      idempotency_key, request_hash, response_code, response_message, attempt_count,
      next_retry_at, callback_status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'prepared', ?, ?, '', ?, 0, ?, '', ?, ?)`
  ).run(
    id,
    batchId,
    batch.destination_agency_id,
    integrationId || null,
    readString(payload.endpointPath, "/estatus/batches"),
    readString(payload.method, "POST").toUpperCase(),
    idempotencyKey,
    requestHash,
    "Request disiapkan. Pengiriman aktual harus memakai approval/integrasi resmi.",
    readString(payload.nextRetryAt) || null,
    timestamp,
    timestamp
  );

  await appendEStatusAuditLog(db, {
    userId: actor.id,
    action: "PREPARE_API_REQUEST",
    entityType: "estatus_api_request",
    entityId: id,
    metadata: {
      batchNumber: batch.batch_number,
      idempotencyKey,
      requestHash,
      timestamp,
      signatureBase: `${timestamp}.${idempotencyKey}.${requestHash}`,
      ...(request ? getRequestAuditMetadata(request) : {}),
    },
  });

  return (await listEStatusAdvancedControls(db, actor)).apiRequests.find((item) => item.id === id);
}

export async function createEStatusIncident(
  db: AletaDatabase,
  actor: UserPersona,
  payload: Record<string, unknown>,
  request?: NextRequest
) {
  requireEStatusPermission(actor, E_STATUS_PERMISSION.INCIDENT_MANAGE);
  const incidentType = readString(payload.incidentType, "integration_failure");
  const title = readString(payload.title);
  if (!title) estatusBadRequest("Judul insiden wajib diisi.");
  const timestamp = nowIso();
  const id = await nextPrefixedId(db, "estatus_incident_logs", "est-inc");

  await db.prepare(
    `INSERT INTO estatus_incident_logs (
      id, incident_type, severity, status, batch_id, record_id, agency_id,
      title, description, impact_summary, containment_action, reported_by,
      created_at, updated_at
    ) VALUES (?, ?, ?, 'open', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    incidentType,
    readString(payload.severity, "medium"),
    readString(payload.batchId) || null,
    readString(payload.recordId) || null,
    readString(payload.agencyId) || null,
    title,
    readString(payload.description),
    readString(payload.impactSummary),
    readString(payload.containmentAction),
    actor.id,
    timestamp,
    timestamp
  );

  await appendEStatusAuditLog(db, {
    userId: actor.id,
    action: "CREATE_INCIDENT",
    entityType: "estatus_incident",
    entityId: id,
    metadata: {
      incidentType,
      title,
      severity: readString(payload.severity, "medium"),
      ...(request ? getRequestAuditMetadata(request) : {}),
    },
  });

  return (await listEStatusAdvancedControls(db, actor)).incidents.find((item) => item.id === id);
}

export async function runEStatusAiAssist(
  db: AletaDatabase,
  actor: UserPersona,
  payload: Record<string, unknown>,
  request?: NextRequest
) {
  requireEStatusPermission(actor, E_STATUS_PERMISSION.AI_ASSIST_USE);
  const feature = readString(payload.feature, "batch_summary");
  const allowed = new Set(["sipp_mapping", "batch_summary", "draft_letter", "error_analysis"]);
  if (!allowed.has(feature)) estatusBadRequest("Fitur AI assistant E-Status tidak diperbolehkan.");
  const entityType = readString(payload.entityType, "estatus");
  const entityId = readString(payload.entityId);
  const inputText = readString(payload.inputText);
  const guardrails = [
    "AI hanya memberi saran administratif.",
    "AI tidak menentukan valid/tidak valid dan tidak menetapkan status hukum.",
    "Output wajib direview manusia sebelum digunakan.",
    "Jangan masukkan NIK lengkap atau dokumen perkara lengkap ke prompt AI.",
  ];

  const minimization = scanDataMinimizationSurface({ feature, inputText, payload: payload.payload });
  const outputText = feature === "draft_letter"
    ? "Draft awal surat pengantar: mohon verifikasi data perubahan status perkawinan pada lampiran batch E-Status. Rincian identitas hanya mengikuti format data minimal yang disetujui instansi mitra."
    : feature === "sipp_mapping"
      ? "Saran mapping: prioritaskan tabel perkara, perkara_putusan, perkara_pihak1/perkara_pihak2, perkara_akta_cerai, perkara_ikrar_talak, dan tabel upaya hukum. Semua query harus SELECT-only."
      : feature === "error_analysis"
        ? "Analisis error: kelompokkan kendala menjadi koneksi, mapping kolom, data identitas kurang, status hukum belum final, atau penolakan instansi."
        : "Ringkasan batch: tampilkan jumlah perkara, jenis perubahan, instansi tujuan, status readiness, temuan duplikasi, dan item yang perlu review manusia.";
  const timestamp = nowIso();
  const id = await nextPrefixedId(db, "estatus_ai_assist_logs", "est-ai");

  await db.prepare(
    `INSERT INTO estatus_ai_assist_logs (
      id, user_id, feature, entity_type, entity_id, input_hash, output_text,
      guardrails_json, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?::jsonb, 'needs_human_review', ?)`
  ).run(
    id,
    actor.id,
    feature,
    entityType,
    entityId,
    `sha256:${hashJson({ inputText, payload: payload.payload })}`,
    outputText,
    JSON.stringify(guardrails),
    timestamp
  );

  if (entityId && minimization.length > 0) {
    await persistMinimizationFindings(db, entityType, entityId, minimization);
  }

  await appendEStatusAuditLog(db, {
    userId: actor.id,
    action: "RUN_AI_ASSIST",
    entityType,
    entityId,
    metadata: {
      feature,
      guardrails,
      minimizationFindings: minimization.length,
      ...(request ? getRequestAuditMetadata(request) : {}),
    },
  });

  return {
    id,
    feature,
    status: "needs_human_review",
    outputText,
    guardrails,
    minimizationFindings: minimization,
  };
}

export async function updateEStatusTracking(
  db: AletaDatabase,
  actor: UserPersona,
  payload: Record<string, unknown>,
  request?: NextRequest
) {
  const requestedStatus = readString(payload.status).toUpperCase();
  const validStatuses = new Set(["SENT", "RECEIVED", "IN_PROCESS", "COMPLETED", "REJECTED", "FAILED", "RESENT"]);
  if (!validStatuses.has(requestedStatus)) estatusBadRequest("Status tracking E-Status tidak dikenal.");
  const status = requestedStatus === "RESENT" ? "SENT" : requestedStatus;
  const batchId = readString(payload.batchId);
  if (!batchId) estatusBadRequest("Batch wajib dipilih untuk tracking pengiriman.");
  if (status === "SENT") {
    requireEStatusPermission(actor, E_STATUS_PERMISSION.TRANSMISSION_SEND);
  } else {
    requireEStatusPermission(actor, E_STATUS_PERMISSION.TRANSMISSION_FOLLOWUP);
  }

  const batch = await db.prepare("SELECT * FROM estatus_batches WHERE id = ?").get<EStatusBatchRow>(batchId);
  if (!batch) estatusNotFound("Batch E-Status tidak ditemukan.");
  if (status === "REJECTED" && !readString(payload.rejectionReason)) {
    estatusBadRequest("Alasan penolakan wajib dicatat.");
  }

  const timestamp = nowIso();
  const method = readString(payload.method, "manual");
  const rejectionReason = readString(payload.rejectionReason);
  const feedbackNote = readString(payload.feedbackNote);
  const receiptNumber = readString(payload.receiptNumber);
  const receiptFilePath = readString(payload.receiptFilePath);
  const responseMessage = readString(payload.responseMessage);
  const errorMessage = readString(payload.errorMessage) || null;
  const missingFields = readStringArray(payload.missingFields);
  const existing = await db.prepare(
    `SELECT *
     FROM estatus_transmission_logs
     WHERE batch_id = ?
     ORDER BY created_at DESC
     LIMIT 1`
  ).get<EStatusTransmissionRow>(batchId);
  const createNewLog = !existing || requestedStatus === "RESENT";
  const sentAt = status === "SENT" ? timestamp : existing?.sent_at ?? timestamp;
  const slaDays = await calculateBatchSlaDays(db, batchId, sentAt);
  const transmissionId = createNewLog ? await nextPrefixedId(db, "estatus_transmission_logs", "est-trn") : existing.id;

  await withTransaction(db, async (tx) => {
    if (createNewLog) {
      await tx.prepare(
        `INSERT INTO estatus_transmission_logs (
          id, batch_id, agency_id, method, status, idempotency_key, request_payload_hash,
          response_code, response_message, sent_at, received_at, processed_at, completed_at,
          rejected_at, last_status_at, receipt_number, receipt_file_path, feedback_note,
          rejection_reason, sla_days, retry_of_transmission_id, resend_count, updated_by,
          updated_at, error_message, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, '', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        transmissionId,
        batchId,
        batch.destination_agency_id,
        method,
        status,
        `estatus-${batch.batch_number}-${Date.now()}`,
        readString(payload.responseCode),
        responseMessage,
        status === "SENT" ? timestamp : null,
        status === "RECEIVED" ? timestamp : null,
        status === "IN_PROCESS" ? timestamp : null,
        status === "COMPLETED" ? timestamp : null,
        status === "REJECTED" ? timestamp : null,
        timestamp,
        receiptNumber,
        receiptFilePath,
        feedbackNote,
        rejectionReason,
        slaDays,
        existing?.id ?? null,
        requestedStatus === "RESENT" ? (existing?.resend_count ?? 0) + 1 : 0,
        actor.id,
        timestamp,
        errorMessage,
        timestamp
      );
    } else {
      await tx.prepare(
        `UPDATE estatus_transmission_logs
         SET status = ?,
          method = COALESCE(NULLIF(?, ''), method),
          response_code = COALESCE(NULLIF(?, ''), response_code),
          response_message = COALESCE(NULLIF(?, ''), response_message),
          sent_at = CASE WHEN ? = 'SENT' THEN COALESCE(sent_at, ?) ELSE sent_at END,
          received_at = CASE WHEN ? = 'RECEIVED' THEN ? ELSE received_at END,
          processed_at = CASE WHEN ? = 'IN_PROCESS' THEN ? ELSE processed_at END,
          completed_at = CASE WHEN ? = 'COMPLETED' THEN ? ELSE completed_at END,
          rejected_at = CASE WHEN ? = 'REJECTED' THEN ? ELSE rejected_at END,
          last_status_at = ?,
          receipt_number = COALESCE(NULLIF(?, ''), receipt_number),
          receipt_file_path = COALESCE(NULLIF(?, ''), receipt_file_path),
          feedback_note = COALESCE(NULLIF(?, ''), feedback_note),
          rejection_reason = COALESCE(NULLIF(?, ''), rejection_reason),
          sla_days = CASE WHEN sla_days = 0 THEN ? ELSE sla_days END,
          updated_by = ?,
          updated_at = ?,
          error_message = COALESCE(?, error_message)
         WHERE id = ?`
      ).run(
        status,
        method,
        readString(payload.responseCode),
        responseMessage,
        status,
        timestamp,
        status,
        timestamp,
        status,
        timestamp,
        status,
        timestamp,
        status,
        timestamp,
        timestamp,
        receiptNumber,
        receiptFilePath,
        feedbackNote,
        rejectionReason,
        slaDays,
        actor.id,
        timestamp,
        errorMessage,
        transmissionId
      );
    }

    await tx.prepare(
      `INSERT INTO estatus_agency_feedbacks (
        id, batch_id, agency_id, transmission_log_id, feedback_status, feedback_date,
        rejection_reason, missing_fields_json, notes, recorded_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?, ?, ?)`
    ).run(
      await nextPrefixedId(tx, "estatus_agency_feedbacks", "est-fdb"),
      batchId,
      batch.destination_agency_id,
      transmissionId,
      status,
      timestamp,
      rejectionReason,
      JSON.stringify(missingFields),
      feedbackNote || responseMessage || errorMessage || "",
      actor.id,
      timestamp
    );

    await tx.prepare(
      `UPDATE estatus_batches
       SET status = ?,
        sent_by = CASE WHEN ? = 'SENT' THEN COALESCE(sent_by, ?) ELSE sent_by END,
        sent_at = CASE WHEN ? = 'SENT' THEN COALESCE(sent_at, ?) ELSE sent_at END,
        updated_at = ?
       WHERE id = ?`
    ).run(
      status === "FAILED" ? "FAILED" : status === "REJECTED" ? "REJECTED" : status,
      status,
      actor.id,
      status,
      sentAt,
      timestamp,
      batchId
    );

    const nextWorkflowStatus = status === "COMPLETED" ? "COMPLETED" : status === "REJECTED" ? "REVISION_REQUIRED" : status;
    await tx.prepare(
      `UPDATE estatus_records
       SET workflow_status = ?, already_sent = CASE WHEN ? IN ('SENT', 'RECEIVED', 'IN_PROCESS', 'COMPLETED') THEN 1 ELSE already_sent END,
        updated_by = ?, updated_at = ?
       WHERE id IN (
         SELECT estatus_record_id FROM estatus_batch_items WHERE batch_id = ?
       )`
    ).run(nextWorkflowStatus, status, actor.id, timestamp, batchId);

    await appendEStatusAuditLog(tx, {
      userId: actor.id,
      action: "UPDATE_TRANSMISSION_TRACKING",
      entityType: "estatus_batch",
      entityId: batchId,
      oldValue: { status: batch.status },
      newValue: { status, transmissionId },
      metadata: {
        batchNumber: batch.batch_number,
        status,
        method,
        receiptNumber,
        rejectionReason,
        slaDays,
        missingFields,
        ...(request ? getRequestAuditMetadata(request) : {}),
      },
    });
  });

  return (await listEStatusTracking(db, actor)).find((item) => item.id === transmissionId);
}

export async function transitionEStatusBatch(
  db: AletaDatabase,
  actor: UserPersona,
  batchId: string,
  action: "submit_review" | "approve" | "lock" | "reject" | "cancel" | "create_revision",
  payload: Record<string, unknown> = {},
  request?: NextRequest
) {
  const permissionByAction: Record<typeof action, EStatusPermission> = {
    submit_review: E_STATUS_PERMISSION.BATCH_CREATE,
    approve: E_STATUS_PERMISSION.BATCH_APPROVE,
    lock: E_STATUS_PERMISSION.BATCH_LOCK,
    reject: E_STATUS_PERMISSION.BATCH_REVIEW,
    cancel: E_STATUS_PERMISSION.BATCH_REVISION,
    create_revision: E_STATUS_PERMISSION.BATCH_REVISION,
  };
  requireEStatusPermission(actor, permissionByAction[action]);

  return withTransaction(db, async (tx) => {
    const batch = await tx.prepare("SELECT * FROM estatus_batches WHERE id = ?").get<EStatusBatchRow>(batchId);
    if (!batch) estatusNotFound("Batch E-Status tidak ditemukan.");

    const nextStatusByAction = {
      submit_review: "WAITING_APPROVAL",
      approve: "APPROVED",
      lock: "LOCKED",
      reject: "REJECTED",
      cancel: "CANCELLED",
      create_revision: "REVISION_REQUIRED",
    } as const;
    const nextStatus = nextStatusByAction[action];
    const timestamp = nowIso();
    const reason = readString(payload.reason);

    if (batch.status === "LOCKED" && !["cancel", "create_revision"].includes(action)) {
      estatusConflict("Batch yang sudah terkunci tidak dapat diubah tanpa mekanisme revisi.");
    }
    if (["SENT", "RECEIVED", "IN_PROCESS", "COMPLETED"].includes(batch.status) && !["create_revision"].includes(action)) {
      estatusConflict("Batch terkirim tidak dapat diubah. Gunakan alur revisi resmi.");
    }
    if (action === "approve" && !["DRAFT", "WAITING_APPROVAL"].includes(batch.status)) {
      estatusConflict("Batch hanya dapat disetujui dari status draft atau menunggu approval.");
    }
    if (action === "lock" && batch.status !== "APPROVED") {
      estatusConflict("Batch hanya dapat dikunci setelah disetujui.");
    }
    if (action === "cancel" && !reason) {
      estatusBadRequest("Alasan pembatalan batch wajib diisi.");
    }
    if (action === "create_revision" && !reason) {
      estatusBadRequest("Alasan revisi batch wajib diisi.");
    }

    if (action === "create_revision") {
      if (!["LOCKED", "SENT", "RECEIVED", "IN_PROCESS", "COMPLETED", "REJECTED", "REVISION_REQUIRED"].includes(batch.status)) {
        estatusConflict("Revisi resmi hanya dibuat dari batch final, terkirim, ditolak, atau sudah perlu revisi.");
      }
      const itemIds = await tx.prepare(
        `SELECT estatus_record_id
         FROM estatus_batch_items
         WHERE batch_id = ?
         ORDER BY created_at ASC`
      ).all<{ estatus_record_id: string }>(batchId);
      const revisionId = await nextPrefixedId(tx, "estatus_batches", "est-bat");
      const revisionNumber = `${await generateBatchNumber(tx)}-R${(batch.revision_count ?? 0) + 1}`;

      await tx.prepare(
        `INSERT INTO estatus_batches (
          id, batch_number, batch_type, destination_agency_id, status, total_records,
          revision_of_batch_id, revision_reason, created_by, notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 'DRAFT', ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        revisionId,
        revisionNumber,
        batch.batch_type,
        batch.destination_agency_id,
        itemIds.length,
        batchId,
        reason,
        actor.id,
        `Revisi dari ${batch.batch_number}: ${reason}`,
        timestamp,
        timestamp
      );

      for (const item of itemIds) {
        await tx.prepare(
          `INSERT INTO estatus_batch_items (
            id, batch_id, estatus_record_id, item_status, notes, created_at
          ) VALUES (?, ?, ?, 'REVISION_DRAFT', ?, ?)`
        ).run(
          await nextPrefixedId(tx, "estatus_batch_items", "est-bit"),
          revisionId,
          item.estatus_record_id,
          reason,
          timestamp
        );
      }

      await tx.prepare(
        `UPDATE estatus_batches
         SET status = 'REVISION_REQUIRED', revision_count = revision_count + 1,
          revision_reason = ?, updated_at = ?
         WHERE id = ?`
      ).run(reason, timestamp, batchId);

      await tx.prepare(
        `UPDATE estatus_records
         SET workflow_status = 'REVISION_DRAFT', updated_by = ?, updated_at = ?
         WHERE id IN (
           SELECT estatus_record_id FROM estatus_batch_items WHERE batch_id = ?
         )`
      ).run(actor.id, timestamp, revisionId);

      await appendEStatusAuditLog(tx, {
        userId: actor.id,
        action: "BATCH_CREATE_REVISION",
        entityType: "estatus_batch",
        entityId: batchId,
        oldValue: { status: batch.status },
        newValue: { status: "REVISION_REQUIRED", revisionBatchId: revisionId },
        metadata: {
          batchNumber: batch.batch_number,
          revisionNumber,
          reason,
          ...(request ? getRequestAuditMetadata(request) : {}),
        },
      });

      return (await listEStatusBatches(tx, actor)).find((item) => item.id === revisionId);
    }

    await tx.prepare(
      `UPDATE estatus_batches
       SET status = ?,
        approved_by = CASE WHEN ? = 'approve' THEN ? ELSE approved_by END,
        approved_at = CASE WHEN ? = 'approve' THEN ? ELSE approved_at END,
        locked_at = CASE WHEN ? = 'lock' THEN ? ELSE locked_at END,
        cancellation_reason = CASE WHEN ? = 'cancel' THEN ? ELSE cancellation_reason END,
        cancelled_by = CASE WHEN ? = 'cancel' THEN ? ELSE cancelled_by END,
        cancelled_at = CASE WHEN ? = 'cancel' THEN ? ELSE cancelled_at END,
        updated_at = ?
       WHERE id = ?`
    ).run(
      nextStatus,
      action,
      actor.id,
      action,
      timestamp,
      action,
      timestamp,
      action,
      reason,
      action,
      actor.id,
      action,
      timestamp,
      timestamp,
      batchId
    );

    if (action === "lock") {
      const items = await tx.prepare(
        `SELECT r.*
         FROM estatus_batch_items bi
         JOIN estatus_records r ON r.id = bi.estatus_record_id
         WHERE bi.batch_id = ?`
      ).all<EStatusRecordRow>(batchId);
      const snapshotHashes: string[] = [];

      for (const item of items) {
        const parties = await tx.prepare(
          `SELECT * FROM estatus_parties WHERE estatus_record_id = ? ORDER BY party_role ASC`
        ).all<EStatusPartyRow>(item.id);
        const snapshot = { record: item, parties };
        const snapshotHash = `sha256:${hashJson(snapshot)}`;
        snapshotHashes.push(snapshotHash);

        await tx.prepare(
          `INSERT INTO estatus_record_snapshots (
            id, batch_id, estatus_record_id, snapshot_json, snapshot_hash, created_at
          ) VALUES (?, ?, ?, ?::jsonb, ?, ?)`
        ).run(
          await nextPrefixedId(tx, "estatus_record_snapshots", "est-snp"),
          batchId,
          item.id,
          JSON.stringify(snapshot),
          snapshotHash,
          timestamp
        );
      }

      await tx.prepare(
        `UPDATE estatus_batches
         SET data_snapshot_hash = ?, updated_at = ?
         WHERE id = ?`
      ).run(`sha256:${hashJson(snapshotHashes)}`, timestamp, batchId);
      await tx.prepare(
        `UPDATE estatus_records
         SET workflow_status = 'LOCKED', updated_by = ?, updated_at = ?
         WHERE id IN (
           SELECT estatus_record_id FROM estatus_batch_items WHERE batch_id = ?
         )`
      ).run(actor.id, timestamp, batchId);
    }

    if (action === "cancel") {
      await tx.prepare(
        `UPDATE estatus_records
         SET workflow_status = 'REVISION_REQUIRED', updated_by = ?, updated_at = ?
         WHERE id IN (
           SELECT estatus_record_id FROM estatus_batch_items WHERE batch_id = ?
         )`
      ).run(actor.id, timestamp, batchId);
    }

    await appendEStatusAuditLog(tx, {
      userId: actor.id,
      action: `BATCH_${action.toUpperCase()}`,
      entityType: "estatus_batch",
      entityId: batchId,
      oldValue: { status: batch.status },
      newValue: { status: nextStatus },
      metadata: {
        batchNumber: batch.batch_number,
        reason,
        ...(request ? getRequestAuditMetadata(request) : {}),
      },
    });

    return (await listEStatusBatches(tx, actor)).find((item) => item.id === batchId);
  });
}

export async function getEStatusAuditLogs(db: AletaDatabase, actor: UserPersona) {
  requireEStatusPermission(actor, E_STATUS_PERMISSION.AUDIT_VIEW);

  return db.prepare(
    `SELECT a.id, a.user_id, u.name AS user_name, a.action, a.entity_type, a.entity_id,
      a.metadata, a.ip_address, a.user_agent, a.created_at
     FROM estatus_audit_logs a
     LEFT JOIN users u ON u.id = a.user_id
     ORDER BY a.created_at DESC
     LIMIT 80`
  ).all();
}

export async function requireEStatusRouteAccess(actor: UserPersona) {
  return requireAnyEStatusPermission(actor, [
    E_STATUS_PERMISSION.ACCESS,
    E_STATUS_PERMISSION.DASHBOARD_VIEW,
  ]);
}
