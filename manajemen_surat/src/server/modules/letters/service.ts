import { type QueryResultRow } from "pg";

import { canCreateIncomingLetter, canCreateOutgoingLetter, getEffectivePositionId, getEffectiveRoleId } from "@/lib/permissions";
import { letterClassificationCatalog } from "@/lib/letter-taxonomy";
import {
  type LetterDetail,
  type LetterTemplate,
  type LetterTemplateCategory,
  type LetterWorkflowStatus,
  type RoleId,
  type WhatsAppDeliveryStatus,
} from "@/lib/types";
import { type AletaDatabase, type SqlInputValue, withTransaction } from "@/server/db/client";
import { appendAuditLog } from "@/server/shared/audit";
import { ApiError } from "@/server/shared/errors";
import { nextPrefixedId } from "@/server/shared/ids";
import { parseJsonArray, stringifyJson, toBooleanInt } from "@/server/shared/json";
import { deleteStoredPdfFile } from "@/server/shared/pdf-storage";
import { getDispositionByIdFromDb } from "@/server/modules/dispositions/service";
import { requireActorUser, resolveTargetRecipientFromDb } from "@/server/modules/organization/service";
import {
  sendDispositionNotification,
  sendLetterNotification,
  syncWhatsappDeliveryStatuses,
} from "@/server/modules/whatsapp/delivery";

type LetterRow = QueryResultRow & {
  id: string;
  type: LetterDetail["type"];
  nomor_surat: string;
  nomor_urut: string | null;
  tanggal_surat: string;
  tanggal_terima: string | null;
  tanggal_kirim: string | null;
  tanggal_administratif: string | null;
  pengirim: string;
  perihal: string;
  status: string;
  workflow_status: LetterWorkflowStatus | null;
  submitted_at: string | null;
  submitted_by_user_id: string | null;
  approved_at: string | null;
  approved_by_user_id: string | null;
  sent_at: string | null;
  sent_by_user_id: string | null;
  rejected_at: string | null;
  rejected_by_user_id: string | null;
  rejection_note: string | null;
  assigned_unit: string;
  confidentiality: LetterDetail["confidentiality"];
  current_disposition_id: string | null;
  ringkasan: string;
  asal_surat: string;
  tujuan_surat: string;
  klasifikasi_utama: string;
  kode_klasifikasi: string | null;
  lampiran_json: string;
  tags_json: string;
  klasifikasi_tags_json: string;
  viewer_mode: LetterDetail["viewerMode"];
  qr_code_label: string;
  document_aspect_ratio: number | null;
  document_file_name: string | null;
  document_size_mb: number | null;
  document_text_extract: string | null;
  document_file_path: string | null;
  target_position_id: string | null;
  target_user_id: string | null;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

type DeliveryRow = QueryResultRow & {
  id: string;
  parent_id: string;
  recipient_name: string;
  recipient_whatsapp: string;
  status: WhatsAppDeliveryStatus;
  queue_id: string | null;
  gateway_status: string | null;
  gateway_stage: string | null;
  gateway_message_id: string | null;
  gateway_error: string | null;
  delivered_at: string | null;
  read_at: string | null;
  failed_at: string | null;
  last_gateway_sync_at: string | null;
  last_attempt_at: string;
};

type LetterTemplateRow = QueryResultRow & {
  id: string;
  name: string;
  category: LetterTemplateCategory;
  description: string;
  body: string;
  placeholders_json: string;
  is_active: number;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateLetterRequest = {
  actorUserId: string;
  type: LetterDetail["type"];
  nomorUrut: string;
  nomorSurat: string;
  tanggalSurat: string;
  tanggal?: string; // Fallback alias dari frontend
  tanggalTerima?: string | null;
  tanggalKirim?: string | null;
  tanggalAdministratif?: string | null;
  pengirim: string;
  perihal: string;
  assignedUnit: string;
  confidentiality: LetterDetail["confidentiality"];
  kodeKlasifikasi?: string;
  klasifikasi?: string;
  klasifikasiTags: string[];
  ringkasan: string;
  asalSurat: string;
  tujuanSurat: string;
  lampiran: string[];
  tags: string[];
  viewerMode: LetterDetail["viewerMode"];
  targetPositionId: string;
  targetUserId?: string | null;
  documentAspectRatio?: number | null;
  documentFileName?: string | null;
  documentSizeMb?: number | null;
  documentTextExtract?: string | null;
  documentFilePath?: string | null;
  aiGenerated?: boolean;
};

export type UpdateLetterRequest = Partial<Omit<CreateLetterRequest, "actorUserId" | "type">> & {
  actorUserId: string;
  letterId: string;
};

export type LetterSearchFilters = {
  query?: string;
  type?: string;
  status?: string;
  workflowStatus?: string;
  priority?: string;
  year?: string;
  month?: string;
  quarter?: string;
  origin?: string;
  code?: string;
  dateFrom?: string;
  dateTo?: string;
  uploadedFrom?: string;
  uploadedTo?: string;
  tags?: string[];
  classificationTags?: string[];
  dispositionStatus?: string;
  unreadOnly?: boolean;
  overdueOnly?: boolean;
  dueTodayOnly?: boolean;
  includeDeleted?: boolean;
  limit?: number;
};

export const LETTER_PAGE_SIZE_OPTIONS = [5, 10, 25, 50, 100] as const;
export type LetterPageSize = (typeof LETTER_PAGE_SIZE_OPTIONS)[number] | "all";
export type LetterSortBy =
  | "createdAt"
  | "updatedAt"
  | "tanggal"
  | "tanggalSurat"
  | "nomorAgenda"
  | "nomorSurat"
  | "asalTujuan"
  | "status"
  | "priority"
  | "workflowStatus";
export type LetterSortDirection = "asc" | "desc";

export type LetterListQuery = {
  page: number;
  pageSize: LetterPageSize;
  sortBy: LetterSortBy;
  sortDirection: LetterSortDirection;
};

export type LetterWorkflowAction = "submit" | "approve" | "reject" | "mark-sent" | "return-draft";

export type LetterTemplateInput = {
  actorUserId: string;
  id?: string;
  name: string;
  category: LetterTemplateCategory;
  description?: string;
  body: string;
  isActive?: boolean;
};

const outgoingApproverRoleIds = new Set<RoleId>([
  "super-admin",
  "admin",
  "ketua",
  "wakil-ketua",
  "sekretaris",
  "panitera",
  "panitera-muda",
  "kasubag",
]);
const letterTemplateCategories = new Set<LetterTemplateCategory>([
  "undangan",
  "permintaan_data",
  "balasan_surat",
  "surat_tugas",
  "lainnya",
]);
export const allowedLetterTemplatePlaceholders = [
  "nomor_surat",
  "tanggal_surat",
  "tujuan",
  "perihal",
  "nama_pengadilan",
  "alamat_pengadilan",
  "nama_penandatangan",
  "jabatan_penandatangan",
] as const;

function placeholders(values: readonly SqlInputValue[]) {
  return values.map(() => "?").join(", ");
}

function buildSearchDocument(input: {
  nomorSurat: string;
  nomorUrut?: string | null;
  pengirim: string;
  perihal: string;
  asalSurat: string;
  tujuanSurat: string;
  klasifikasi?: string;
  kodeKlasifikasi?: string;
  ringkasan: string;
  tags: string[];
  klasifikasiTags: string[];
  lampiran: string[];
}) {
  return [
    input.perihal,
    input.nomorSurat,
    input.nomorUrut ?? "",
    input.pengirim,
    input.asalSurat,
    input.tujuanSurat,
    input.klasifikasi ?? "",
    input.kodeKlasifikasi ?? "",
    input.ringkasan,
    ...input.tags,
    ...input.klasifikasiTags,
    ...input.lampiran,
  ]
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function getSequenceYear(dateValue: string) {
  const date = new Date(dateValue);
  return Number.isNaN(date.getTime()) ? new Date().getFullYear() : date.getFullYear();
}

function formatNomorAgenda(sequence: number, year: number) {
  return `${String(sequence).padStart(3, "0")}/${year}`;
}

function getLetterTemplatePlaceholders(body: string) {
  return Array.from(new Set(Array.from(body.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)).map((match) => match[1])));
}

function validateLetterTemplateBody(body: string) {
  const text = body.trim();
  if (text.length < 10 || text.length > 8000) {
    throw new ApiError(400, "Isi template harus berisi 10-8000 karakter.");
  }
  if (text.includes("{{") || text.includes("}}")) {
    const withoutValidPlaceholders = text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, "");
    if (withoutValidPlaceholders.includes("{{") || withoutValidPlaceholders.includes("}}")) {
      throw new ApiError(400, "Template memiliki placeholder tidak valid. Gunakan format {{nama_placeholder}}.");
    }
  }

  const placeholders = getLetterTemplatePlaceholders(text);
  const allowed = new Set<string>(allowedLetterTemplatePlaceholders);
  const unknown = placeholders.filter((placeholder) => !allowed.has(placeholder));

  return { text, placeholders, unknown };
}

function mapLetterTemplate(row: LetterTemplateRow): LetterTemplate {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    description: row.description,
    body: row.body,
    placeholders: parseJsonArray<string>(row.placeholders_json),
    isActive: row.is_active === 1,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function requireLetterTemplateManager(db: AletaDatabase, actorUserId: string) {
  const actor = await requireActorUser(db, actorUserId);
  if (!canCreateOutgoingLetter(actor)) {
    throw new ApiError(403, "Role aktif tidak memiliki izin mengelola template surat keluar.");
  }
  return actor;
}

export async function generateNomorAgenda(
  db: AletaDatabase,
  type: LetterDetail["type"],
  dateValue: string
) {
  const now = new Date().toISOString();
  const year = getSequenceYear(dateValue);
  const sequenceId = await nextPrefixedId(db, "letter_number_sequences", "seq");

  const row = await db.prepare(
    `INSERT INTO letter_number_sequences (id, type, year, last_sequence, created_at, updated_at)
     VALUES (?, ?, ?, 1, ?, ?)
     ON CONFLICT (type, year) DO UPDATE
       SET last_sequence = letter_number_sequences.last_sequence + 1,
           updated_at = EXCLUDED.updated_at
     RETURNING last_sequence`
  ).get<{ last_sequence: number }>(sequenceId, type, year, now, now);

  const nextSequence = Number(row?.last_sequence ?? 1);
  return formatNomorAgenda(nextSequence, year);
}

function getActorRoleId(actor: Awaited<ReturnType<typeof requireActorUser>>) {
  return getEffectiveRoleId(actor);
}

function isOutgoingWorkflowApprover(actor: Awaited<ReturnType<typeof requireActorUser>>) {
  const roleId = getActorRoleId(actor);
  return roleId ? outgoingApproverRoleIds.has(roleId) : false;
}

function isLetterCreatorOrAdmin(actor: Awaited<ReturnType<typeof requireActorUser>>, letter: LetterDetail) {
  const roleId = getActorRoleId(actor);
  return roleId === "super-admin" || roleId === "admin" || letter.createdByUserId === actor.id;
}

function mapLightweightLetterRow(row: LetterRow): LetterDetail {
  return {
    id: row.id,
    type: row.type,
    nomorSurat: row.nomor_surat,
    nomorUrut: row.nomor_urut ?? undefined,
    workflowStatus: row.workflow_status ?? (row.type === "keluar" ? "draft" : "sent"),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    submittedAt: row.submitted_at,
    submittedByUserId: row.submitted_by_user_id,
    approvedAt: row.approved_at,
    approvedByUserId: row.approved_by_user_id,
    sentAt: row.sent_at,
    sentByUserId: row.sent_by_user_id,
    rejectedAt: row.rejected_at,
    rejectedByUserId: row.rejected_by_user_id,
    rejectionNote: row.rejection_note,
    tanggal: row.tanggal_surat,
    tanggalAdministratif: row.tanggal_administratif ?? undefined,
    pengirim: row.pengirim,
    perihal: row.perihal,
    status: row.status as LetterDetail["status"],
    assignedUnit: row.assigned_unit,
    confidentiality: row.confidentiality,
    currentDispositionId: row.current_disposition_id ?? "",
    tags: parseJsonArray<string>(row.tags_json),
    ringkasan: row.ringkasan,
    asalSurat: row.asal_surat,
    tujuanSurat: row.tujuan_surat,
    klasifikasi: row.klasifikasi_utama,
    lampiran: [],
    viewerMode: row.viewer_mode,
    qrCodeLabel: row.qr_code_label,
    documentAspectRatio: row.document_aspect_ratio ?? undefined,
    documentFileName: row.document_file_name ?? undefined,
    documentSizeMb: row.document_size_mb ?? undefined,
    documentUrl: row.document_file_path ?? undefined,
    documentTextExtract: undefined,
    kodeKlasifikasi: row.kode_klasifikasi ?? undefined,
    klasifikasiTags: parseJsonArray<string>(row.klasifikasi_tags_json),
    targetPositionId: row.target_position_id ?? undefined,
    targetUserId: row.target_user_id ?? undefined,
    createdByUserId: row.created_by_user_id ?? undefined,
    createdByUserName: undefined,
    whatsappDeliveries: [],
    deletedState: row.deleted_at
      ? {
          deletedAt: row.deleted_at,
          deletedByUserId: "",
          deletedMode: "soft",
        }
      : undefined,
  };
}

async function hydrateLetters(db: AletaDatabase, rows: LetterRow[]) {
  if (rows.length === 0) return [];

  const ids = rows.map((row) => row.id);
  const params = placeholders(ids);

  const tagRows = await db.prepare(
    `SELECT letter_id, tag_value
     FROM letter_tags
     WHERE letter_id IN (${params})
     ORDER BY tag_value ASC`
  ).all<{ letter_id: string; tag_value: string }>(...ids);
  const classificationTagRows = await db.prepare(
    `SELECT letter_id, tag_value
     FROM letter_classification_tags
     WHERE letter_id IN (${params})
     ORDER BY tag_value ASC`
  ).all<{ letter_id: string; tag_value: string }>(...ids);
  const attachmentRows = await db.prepare(
    `SELECT letter_id, file_name
     FROM letter_attachments
     WHERE letter_id IN (${params})
     ORDER BY file_name ASC`
  ).all<{ letter_id: string; file_name: string }>(...ids);
  const rawDeliveryRows = await db.prepare(
    `SELECT id, letter_id AS parent_id, recipient_name, recipient_whatsapp, status,
      queue_id, gateway_status, gateway_stage, gateway_message_id, gateway_error,
      delivered_at, read_at, failed_at, last_gateway_sync_at, last_attempt_at
     FROM letter_whatsapp_deliveries
     WHERE deleted_at IS NULL AND letter_id IN (${params})
     ORDER BY last_attempt_at ASC`
  ).all<DeliveryRow>(...ids);
  const deliveryRows = await syncWhatsappDeliveryStatuses(db, "letter", rawDeliveryRows);

  const creatorIds = Array.from(new Set(rows.map((row) => row.created_by_user_id).filter(Boolean))) as string[];
  const creatorParams = placeholders(creatorIds);
  const creatorRows = creatorIds.length > 0
    ? await db.prepare(`SELECT id, name FROM users WHERE id IN (${creatorParams})`).all<{ id: string; name: string }>(...creatorIds)
    : [];

  const tagsByLetter = tagRows.reduce<Map<string, string[]>>((map, row) => {
    map.set(row.letter_id, [...(map.get(row.letter_id) ?? []), row.tag_value]);
    return map;
  }, new Map());
  const classificationTagsByLetter = classificationTagRows.reduce<Map<string, string[]>>((map, row) => {
    map.set(row.letter_id, [...(map.get(row.letter_id) ?? []), row.tag_value]);
    return map;
  }, new Map());
  const attachmentsByLetter = attachmentRows.reduce<Map<string, string[]>>((map, row) => {
    map.set(row.letter_id, [...(map.get(row.letter_id) ?? []), row.file_name]);
    return map;
  }, new Map());
  const deliveriesByLetter = deliveryRows.reduce<Map<string, LetterDetail["whatsappDeliveries"]>>((map, row) => {
    map.set(row.parent_id, [
      ...(map.get(row.parent_id) ?? []),
      {
        id: row.id,
        recipientName: row.recipient_name,
        recipientWhatsapp: row.recipient_whatsapp,
        status: row.status,
        queueId: row.queue_id || undefined,
        gatewayStatus: row.gateway_status || undefined,
        gatewayStage: row.gateway_stage || undefined,
        gatewayMessageId: row.gateway_message_id || undefined,
        gatewayError: row.gateway_error || undefined,
        deliveredAt: row.delivered_at,
        readAt: row.read_at,
        failedAt: row.failed_at,
        lastGatewaySyncAt: row.last_gateway_sync_at,
        lastAttemptAt: row.last_attempt_at,
      },
    ]);
    return map;
  }, new Map());
  const creatorMap = new Map(creatorRows.map((u) => [u.id, u.name]));

  return rows.map<LetterDetail>((row) => ({
    id: row.id,
    type: row.type,
    nomorSurat: row.nomor_surat,
    nomorUrut: row.nomor_urut ?? undefined,
    workflowStatus: row.workflow_status ?? (row.type === "keluar" ? "draft" : "sent"),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    submittedAt: row.submitted_at,
    submittedByUserId: row.submitted_by_user_id,
    approvedAt: row.approved_at,
    approvedByUserId: row.approved_by_user_id,
    sentAt: row.sent_at,
    sentByUserId: row.sent_by_user_id,
    rejectedAt: row.rejected_at,
    rejectedByUserId: row.rejected_by_user_id,
    rejectionNote: row.rejection_note,
    tanggal: row.tanggal_surat,
    tanggalAdministratif: row.tanggal_administratif ?? undefined,
    pengirim: row.pengirim,
    perihal: row.perihal,
    status: row.status as LetterDetail["status"],
    assignedUnit: row.assigned_unit,
    confidentiality: row.confidentiality,
    currentDispositionId: row.current_disposition_id ?? "",
    tags: tagsByLetter.get(row.id) ?? parseJsonArray<string>(row.tags_json),
    ringkasan: row.ringkasan,
    asalSurat: row.asal_surat,
    tujuanSurat: row.tujuan_surat,
    klasifikasi: row.klasifikasi_utama,
    lampiran: attachmentsByLetter.get(row.id) ?? parseJsonArray<string>(row.lampiran_json),
    viewerMode: row.viewer_mode,
    qrCodeLabel: row.qr_code_label,
    documentAspectRatio: row.document_aspect_ratio ?? undefined,
    documentFileName: row.document_file_name ?? undefined,
    documentSizeMb: row.document_size_mb ?? undefined,
    documentUrl: row.document_file_path ?? undefined,
    documentTextExtract: row.document_text_extract ?? undefined,
    kodeKlasifikasi: row.kode_klasifikasi ?? undefined,
    klasifikasiTags:
      classificationTagsByLetter.get(row.id) ?? parseJsonArray<string>(row.klasifikasi_tags_json),
    targetPositionId: row.target_position_id ?? undefined,
    targetUserId: row.target_user_id ?? undefined,
    createdByUserId: row.created_by_user_id ?? undefined,
    createdByUserName: row.created_by_user_id ? creatorMap.get(row.created_by_user_id) : undefined,
    whatsappDeliveries: deliveriesByLetter.get(row.id) ?? [],
    deletedState: row.deleted_at
      ? {
          deletedAt: row.deleted_at,
          deletedByUserId: "",
          deletedMode: "soft",
        }
      : undefined,
  }));
}

async function insertLetterCollections(
  db: AletaDatabase,
  letterId: string,
  {
    tags,
    classificationTags,
    lampiran,
  }: {
    tags: string[];
    classificationTags: string[];
    lampiran: string[];
  }
) {
  for (const tag of Array.from(new Set(tags.map((item) => item.trim()).filter(Boolean)))) {
    await db.prepare("INSERT INTO letter_tags (letter_id, tag_value) VALUES (?, ?)").run(letterId, tag);
  }

  for (const tag of Array.from(
    new Set(classificationTags.map((item) => item.trim()).filter(Boolean))
  )) {
    await db
      .prepare("INSERT INTO letter_classification_tags (letter_id, tag_value) VALUES (?, ?)")
      .run(letterId, tag);
  }

  for (const attachment of Array.from(
    new Set(lampiran.map((item) => item.trim()).filter(Boolean))
  )) {
    await db.prepare("INSERT INTO letter_attachments (letter_id, file_name) VALUES (?, ?)").run(
      letterId,
      attachment
    );
  }
}

async function syncLetterSearchIndex(db: AletaDatabase, letterId: string, searchText: string) {
  await db.prepare(
    `UPDATE letters
     SET search_document = ?
     WHERE id = ?`
  ).run(searchText, letterId);
}

function buildSearchQuery(db: AletaDatabase, filters: LetterSearchFilters) {
  const clauses = [filters.includeDeleted ? "1 = 1" : "letters.deleted_at IS NULL"];
  const params: SqlInputValue[] = [];
  const referenceDate = "COALESCE(letters.tanggal_administratif, letters.tanggal_terima, letters.tanggal_kirim, letters.tanggal_surat)";

  if (filters.type && filters.type !== "Semua") {
    clauses.push("letters.type = ?");
    params.push(filters.type);
  }

  if (filters.status && filters.status !== "Semua") {
    clauses.push("letters.status = ?");
    params.push(filters.status);
  }

  if (filters.workflowStatus && filters.workflowStatus !== "Semua") {
    clauses.push("letters.workflow_status = ?");
    params.push(filters.workflowStatus);
  }

  if (filters.priority && filters.priority !== "Semua") {
    clauses.push("letters.confidentiality = ?");
    params.push(filters.priority);
  }

  if (filters.origin && filters.origin !== "Semua") {
    clauses.push("letters.asal_surat = ?");
    params.push(filters.origin);
  }

  if (filters.code && filters.code !== "Semua") {
    clauses.push("letters.kode_klasifikasi = ?");
    params.push(filters.code);
  }

  if (filters.year && filters.year !== "Semua") {
    clauses.push(`SUBSTRING(${referenceDate} FROM 1 FOR 4) = ?`);
    params.push(filters.year);
  }

  if (filters.month && filters.month !== "Semua") {
    clauses.push(`SUBSTRING(${referenceDate} FROM 6 FOR 2) = ?`);
    params.push(filters.month.padStart(2, "0"));
  }

  if (filters.quarter && filters.quarter !== "Semua") {
    const quarterMonths =
      filters.quarter === "TW 1"
        ? ["01", "02", "03"]
        : filters.quarter === "TW 2"
          ? ["04", "05", "06"]
          : filters.quarter === "TW 3"
            ? ["07", "08", "09"]
            : ["10", "11", "12"];
    clauses.push(
      `SUBSTRING(${referenceDate} FROM 6 FOR 2) IN (${placeholders(
        quarterMonths
      )})`
    );
    params.push(...quarterMonths);
  }

  if (filters.dateFrom) {
    clauses.push(`${referenceDate} >= ?`);
    params.push(filters.dateFrom);
  }

  if (filters.dateTo) {
    clauses.push(`${referenceDate} <= ?`);
    params.push(filters.dateTo);
  }

  if (filters.uploadedFrom) {
    clauses.push("SUBSTRING(letters.created_at FROM 1 FOR 10) >= ?");
    params.push(filters.uploadedFrom);
  }

  if (filters.uploadedTo) {
    clauses.push("SUBSTRING(letters.created_at FROM 1 FOR 10) <= ?");
    params.push(filters.uploadedTo);
  }

  const tags = (filters.tags ?? []).filter(Boolean);
  if (tags.length > 0) {
    clauses.push(
      `letters.id IN (
        SELECT lt.letter_id
        FROM letter_tags lt
        WHERE lt.tag_value IN (${placeholders(tags)})
      )`
    );
    params.push(...tags);
  }

  const classificationTags = (filters.classificationTags ?? []).filter(Boolean);
  if (classificationTags.length > 0) {
    clauses.push(
      `letters.id IN (
        SELECT lct.letter_id
        FROM letter_classification_tags lct
        WHERE lct.tag_value IN (${placeholders(classificationTags)})
      )`
    );
    params.push(...classificationTags);
  }

  if (filters.query?.trim()) {
    if (db.supportsFullTextSearch()) {
      clauses.push("to_tsvector('simple', letters.search_document) @@ websearch_to_tsquery('simple', ?)");
      params.push(filters.query.trim());
    } else {
      const normalizedQuery = filters.query.trim().toLowerCase();
      clauses.push("LOWER(letters.search_document) LIKE ?");
      params.push(`%${normalizedQuery}%`);
    }
  }

  return {
    whereClause: clauses.join(" AND "),
    params,
  };
}

function buildActorAccessQuery(actor: Awaited<ReturnType<typeof requireActorUser>>, tableAlias = "letters") {
  const roleId = getActorRoleId(actor);
  if (roleId === "super-admin" || roleId === "admin") {
    return { clause: "1 = 1", params: [] as SqlInputValue[] };
  }

  const effectivePositionId = getEffectivePositionId(actor) ?? null;

  return {
    clause: `${tableAlias}.id IN (
      SELECT access_dispositions.surat_id
      FROM dispositions access_dispositions
      LEFT JOIN positions disposition_positions ON disposition_positions.id = access_dispositions.target_position_id
      LEFT JOIN positions actor_positions ON actor_positions.id = ?
      WHERE access_dispositions.deleted_at IS NULL
        AND (
          access_dispositions.penerima_id = ?
          OR access_dispositions.pengirim_id = ?
          OR (CAST(? AS text) IS NOT NULL AND access_dispositions.target_position_id = ?)
          OR (CAST(? AS text) IS NOT NULL AND disposition_positions.unit_kerja = actor_positions.unit_kerja)
        )
    )`,
    params: [
      effectivePositionId,
      actor.id,
      actor.id,
      effectivePositionId,
      effectivePositionId,
      effectivePositionId,
    ] as SqlInputValue[],
  };
}

function buildDispositionFilterQuery(
  filters: LetterSearchFilters,
  actor: Awaited<ReturnType<typeof requireActorUser>>,
  tableAlias = "letters"
) {
  const clauses: string[] = [];
  const params: SqlInputValue[] = [];
  const today = new Date().toISOString().slice(0, 10);

  if (filters.dispositionStatus === "active") {
    clauses.push(`${tableAlias}.id IN (
      SELECT filter_dispositions.surat_id FROM dispositions filter_dispositions
      WHERE filter_dispositions.deleted_at IS NULL
        AND filter_dispositions.status <> 'Selesai'
        AND (filter_dispositions.penerima_id = ? OR filter_dispositions.pengirim_id = ?)
    )`);
    params.push(actor.id, actor.id);
  }

  if (filters.dispositionStatus === "completed") {
    clauses.push(`${tableAlias}.id IN (
      SELECT filter_dispositions.surat_id FROM dispositions filter_dispositions
      WHERE filter_dispositions.deleted_at IS NULL
        AND filter_dispositions.status = 'Selesai'
        AND (filter_dispositions.penerima_id = ? OR filter_dispositions.pengirim_id = ?)
    )`);
    params.push(actor.id, actor.id);
  }

  if (filters.unreadOnly) {
    clauses.push(`${tableAlias}.id IN (
      SELECT unread_dispositions.surat_id FROM dispositions unread_dispositions
      WHERE unread_dispositions.deleted_at IS NULL
        AND unread_dispositions.penerima_id = ?
        AND unread_dispositions.read_at IS NULL
    )`);
    params.push(actor.id);
  }

  if (filters.overdueOnly) {
    clauses.push(`${tableAlias}.id IN (
      SELECT overdue_dispositions.surat_id FROM dispositions overdue_dispositions
      WHERE overdue_dispositions.deleted_at IS NULL
        AND overdue_dispositions.status <> 'Selesai'
        AND overdue_dispositions.deadline_at IS NOT NULL
        AND SUBSTRING(overdue_dispositions.deadline_at FROM 1 FOR 10) < ?
    )`);
    params.push(today);
  }

  if (filters.dueTodayOnly) {
    clauses.push(`${tableAlias}.id IN (
      SELECT due_today_dispositions.surat_id FROM dispositions due_today_dispositions
      WHERE due_today_dispositions.deleted_at IS NULL
        AND due_today_dispositions.status <> 'Selesai'
        AND due_today_dispositions.deadline_at IS NOT NULL
        AND SUBSTRING(due_today_dispositions.deadline_at FROM 1 FOR 10) = ?
    )`);
    params.push(today);
  }

  return {
    clause: clauses.length > 0 ? clauses.join(" AND ") : "1 = 1",
    params,
  };
}

function getLetterSortExpression(sortBy: LetterSortBy) {
  const referenceDate = "COALESCE(letters.tanggal_administratif, letters.tanggal_terima, letters.tanggal_kirim, letters.tanggal_surat)";
  const sortMap: Record<LetterSortBy, string> = {
    createdAt: "letters.created_at",
    updatedAt: "letters.updated_at",
    tanggal: referenceDate,
    tanggalSurat: "letters.tanggal_surat",
    nomorAgenda: "letters.nomor_urut",
    nomorSurat: "letters.nomor_surat",
    asalTujuan: "CASE WHEN letters.type = 'masuk' THEN letters.asal_surat ELSE letters.tujuan_surat END",
    status: "letters.status",
    priority: "CASE letters.confidentiality WHEN 'Rahasia' THEN 3 WHEN 'Penting' THEN 2 ELSE 1 END",
    workflowStatus: "letters.workflow_status",
  };

  return sortMap[sortBy];
}

export async function getLetterByIdFromDb(
  db: AletaDatabase,
  letterId: string,
  options?: { includeDeleted?: boolean }
) {
  const row = await db.prepare(
    `SELECT *
     FROM letters
     WHERE id = ?
       AND (${options?.includeDeleted ? "1 = 1" : "deleted_at IS NULL"})`
  ).get<LetterRow>(letterId);

  return row ? (await hydrateLetters(db, [row]))[0] ?? null : null;
}

export async function searchLettersInDb(db: AletaDatabase, filters: LetterSearchFilters = {}) {
  const { whereClause, params } = buildSearchQuery(db, filters);
  const limit = Number.isFinite(filters.limit) ? Number(filters.limit) : 100;
  const rows = await db.prepare(
    `SELECT *
     FROM letters
     WHERE ${whereClause}
     ORDER BY COALESCE(tanggal_administratif, tanggal_terima, tanggal_kirim, tanggal_surat) DESC
     LIMIT ?`
  ).all<LetterRow>(...params, limit);

  return hydrateLetters(db, rows);
}

export async function searchLettersPageForActorInDb(
  db: AletaDatabase,
  actor: Awaited<ReturnType<typeof requireActorUser>>,
  filters: LetterSearchFilters = {},
  query: LetterListQuery
): Promise<{
  items: LetterDetail[];
  pagination: {
    page: number;
    pageSize: LetterPageSize;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
  sort: {
    sortBy: LetterSortBy;
    sortDirection: LetterSortDirection;
  };
  meta: {
    mode: "paginated" | "all";
    limited: boolean;
    lightweight: boolean;
    allGuardLimit: number;
  };
}> {
  const letterAlias = "page_letters";
  const base = buildSearchQuery(db, filters);
  const baseWhereClause = base.whereClause.replaceAll("letters.", `${letterAlias}.`);
  const access = buildActorAccessQuery(actor, letterAlias);
  const dispositionFilter = buildDispositionFilterQuery(filters, actor, letterAlias);
  const whereClause = [baseWhereClause, access.clause, dispositionFilter.clause].join(" AND ");
  const params = [...base.params, ...access.params, ...dispositionFilter.params];
  const countRow = await db
    .prepare(`SELECT COUNT(*)::int AS count FROM letters ${letterAlias} WHERE ${whereClause}`)
    .get<{ count: number }>(...params);
  const total = Number(countRow?.count ?? 0);
  const allGuardLimit = 500;
  const pageSize = query.pageSize;

  if (pageSize === "all" && total > allGuardLimit) {
    throw new ApiError(
      400,
      "Data terlalu banyak untuk ditampilkan sekaligus. Gunakan filter atau Export CSV."
    );
  }

  const resolvedPageSize = pageSize === "all" ? Math.max(total, 1) : pageSize;
  const totalPages = total === 0 ? 0 : Math.max(1, Math.ceil(total / resolvedPageSize));
  const page = pageSize === "all" ? 1 : Math.min(Math.max(1, query.page), Math.max(totalPages, 1));
  const offset = pageSize === "all" ? 0 : (page - 1) * resolvedPageSize;
  const sortExpression = getLetterSortExpression(query.sortBy).replaceAll("letters.", `${letterAlias}.`);
  const sortDirection = query.sortDirection === "asc" ? "ASC" : "DESC";
  const listColumnSql = `SELECT
        letters.id, letters.type, letters.nomor_surat, letters.nomor_urut,
        letters.tanggal_surat, letters.tanggal_terima, letters.tanggal_kirim,
        letters.tanggal_administratif, letters.pengirim, letters.perihal, letters.status,
        letters.workflow_status, letters.submitted_at, letters.submitted_by_user_id,
        letters.approved_at, letters.approved_by_user_id, letters.sent_at, letters.sent_by_user_id,
        letters.rejected_at, letters.rejected_by_user_id, letters.rejection_note,
        letters.assigned_unit, letters.confidentiality, letters.current_disposition_id,
        SUBSTRING(letters.ringkasan FROM 1 FOR 320) AS ringkasan, letters.asal_surat, letters.tujuan_surat,
        letters.klasifikasi_utama, letters.kode_klasifikasi,
        '[]' AS lampiran_json, letters.tags_json, letters.klasifikasi_tags_json,
        letters.viewer_mode, letters.qr_code_label, letters.document_aspect_ratio,
        letters.document_file_name, letters.document_size_mb,
        NULL AS document_text_extract, letters.document_file_path,
        letters.target_position_id, letters.target_user_id, letters.created_by_user_id,
        letters.created_at, letters.updated_at, letters.deleted_at`.replaceAll("letters.", `${letterAlias}.`);
  const rows = await db
    .prepare(
      `${listColumnSql}
       FROM letters ${letterAlias}
       WHERE ${whereClause}
       ORDER BY ${sortExpression} ${sortDirection}, ${letterAlias}.created_at DESC, ${letterAlias}.id ASC
       LIMIT ? OFFSET ?`
    )
    .all<LetterRow>(...params, resolvedPageSize, offset);

  return {
    items: rows.map(mapLightweightLetterRow),
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
      hasNextPage: pageSize !== "all" && page < totalPages,
      hasPreviousPage: pageSize !== "all" && page > 1,
    },
    sort: {
      sortBy: query.sortBy,
      sortDirection: query.sortDirection,
    },
    meta: {
      mode: pageSize === "all" ? "all" : "paginated",
      limited: pageSize !== "all",
      lightweight: true,
      allGuardLimit,
    },
  };
}

export async function listLetterTemplatesInDb(db: AletaDatabase, actorUserId: string, options?: { activeOnly?: boolean }) {
  await requireLetterTemplateManager(db, actorUserId);
  const rows = await db
    .prepare(
      `SELECT id, name, category, description, body, placeholders_json, is_active,
        created_by_user_id, created_at, updated_at
       FROM letter_templates
       WHERE (? = 0 OR is_active = 1)
       ORDER BY is_active DESC, category ASC, name ASC`
    )
    .all<LetterTemplateRow>(options?.activeOnly ? 1 : 0);

  return rows.map(mapLetterTemplate);
}

export async function upsertLetterTemplateInDb(db: AletaDatabase, input: LetterTemplateInput) {
  const actor = await requireLetterTemplateManager(db, input.actorUserId);
  const name = input.name.trim();
  if (!name) throw new ApiError(400, "Nama template wajib diisi.");
  if (!letterTemplateCategories.has(input.category)) {
    throw new ApiError(400, "Kategori template surat keluar tidak valid.");
  }

  const validation = validateLetterTemplateBody(input.body);
  if (input.isActive !== false && validation.unknown.length > 0) {
    throw new ApiError(
      400,
      `Template aktif tidak boleh memakai placeholder tidak dikenal: ${validation.unknown.join(", ")}.`
    );
  }

  return withTransaction(db, async (tx) => {
    const now = new Date().toISOString();
    const id = input.id?.trim() || (await nextPrefixedId(tx, "letter_templates", "ltpl"));
    const duplicate = await tx
      .prepare(`SELECT id FROM letter_templates WHERE lower(name) = lower(?) AND id <> ?`)
      .get<{ id: string }>(name, id);
    if (duplicate) {
      throw new ApiError(400, "Nama template surat keluar sudah dipakai.");
    }

    const existing = await tx.prepare(`SELECT id FROM letter_templates WHERE id = ?`).get<{ id: string }>(id);
    if (existing) {
      await tx
        .prepare(
          `UPDATE letter_templates
           SET name = ?, category = ?, description = ?, body = ?, placeholders_json = ?,
             is_active = ?, updated_at = ?
           WHERE id = ?`
        )
        .run(
          name,
          input.category,
          String(input.description ?? "").trim(),
          validation.text,
          JSON.stringify(validation.placeholders),
          input.isActive === false ? 0 : 1,
          now,
          id
        );
    } else {
      await tx
        .prepare(
          `INSERT INTO letter_templates (
            id, name, category, description, body, placeholders_json, is_active,
            created_by_user_id, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          id,
          name,
          input.category,
          String(input.description ?? "").trim(),
          validation.text,
          JSON.stringify(validation.placeholders),
          input.isActive === false ? 0 : 1,
          actor.id,
          now,
          now
        );
    }

    await appendAuditLog(tx, {
      id: await nextPrefixedId(tx, "audit_logs", "adt"),
      actorUserId: actor.id,
      action: existing ? "UPDATE_LETTER_TEMPLATE" : "CREATE_LETTER_TEMPLATE",
      entityType: "letter_template",
      entityId: id,
      payload: {
        name,
        category: input.category,
        isActive: input.isActive !== false,
        placeholders: validation.placeholders,
        unknownPlaceholders: validation.unknown,
      },
    });

    const row = await tx
      .prepare(
        `SELECT id, name, category, description, body, placeholders_json, is_active,
          created_by_user_id, created_at, updated_at
         FROM letter_templates
         WHERE id = ?`
      )
      .get<LetterTemplateRow>(id);
    if (!row) throw new ApiError(500, "Template berhasil disimpan tetapi gagal dibaca ulang.");
    return mapLetterTemplate(row);
  });
}

export async function deactivateLetterTemplateInDb(
  db: AletaDatabase,
  {
    actorUserId,
    templateId,
  }: {
    actorUserId: string;
    templateId: string;
  }
) {
  const actor = await requireLetterTemplateManager(db, actorUserId);
  const existing = await db
    .prepare(`SELECT id FROM letter_templates WHERE id = ?`)
    .get<{ id: string }>(templateId);
  if (!existing) throw new ApiError(404, "Template surat keluar tidak ditemukan.");

  return withTransaction(db, async (tx) => {
    const now = new Date().toISOString();
    const result = await tx
      .prepare(`UPDATE letter_templates SET is_active = 0, updated_at = ? WHERE id = ?`)
      .run(now, templateId);

    if (Number(result.changes ?? 0) === 0) {
      throw new ApiError(404, "Template surat keluar tidak ditemukan.");
    }

    await appendAuditLog(tx, {
      id: await nextPrefixedId(tx, "audit_logs", "adt"),
      actorUserId: actor.id,
      action: "DEACTIVATE_LETTER_TEMPLATE",
      entityType: "letter_template",
      entityId: templateId,
    });

    return { id: templateId, isActive: false };
  });
}

async function ensureClassificationExists(db: AletaDatabase, code: string) {
  if (!code.trim()) return;

  const existing = await db
    .prepare("SELECT code FROM classification_catalog WHERE code = ?")
    .get<{ code: string }>(code);

  if (existing) return;

  const catalogEntry = letterClassificationCatalog.find((item) => item.value === code);
  if (!catalogEntry) return;

  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO classification_catalog (
        code, label, category, keywords_json, is_system, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      catalogEntry.value,
      catalogEntry.label,
      catalogEntry.category,
      stringifyJson(catalogEntry.keywords),
      1,
      now,
      now
    );
}

async function ensureOriginReferenceExists(db: AletaDatabase, originLabel: string) {
  const normalizedOrigin = originLabel.trim();
  if (!normalizedOrigin) return;

  const existing = await db
    .prepare("SELECT id FROM letter_origin_references WHERE LOWER(label) = LOWER(?)")
    .get<{ id: string }>(normalizedOrigin);

  if (existing) return;

  const now = new Date().toISOString();
  const originId = await nextPrefixedId(db, "letter_origin_references", "origin");
  await db.prepare(
    `INSERT INTO letter_origin_references (id, label, created_at)
     VALUES (?, ?, ?)`
  ).run(originId, normalizedOrigin, now);
}

async function assertLetterNumberAvailable(
  tx: AletaDatabase,
  { type, nomorSurat, excludeLetterId }: { type: string; nomorSurat: string; excludeLetterId?: string }
) {
  const normalized = nomorSurat.trim();
  if (!normalized) return;

  // Serialisasi antar-request bernomor sama (advisory lock per nomor+tipe) agar
  // submit ganda paralel tidak lolos dua-duanya. Mode fallback non-Postgres
  // tidak mendukung lock ini; pemeriksaan duplikat di bawah tetap berjalan.
  try {
    await tx
      .prepare(`SELECT pg_advisory_xact_lock(hashtext(?)) AS locked`)
      .get(`letters:${type}:${normalized.toLowerCase()}`);
  } catch {
    // fallback database mode
  }

  const params: string[] = [type, normalized];
  if (excludeLetterId) params.push(excludeLetterId);
  const existing = await tx
    .prepare(
      `SELECT id FROM letters
       WHERE deleted_at IS NULL AND type = ? AND LOWER(nomor_surat) = LOWER(?)${excludeLetterId ? " AND id != ?" : ""}
       LIMIT 1`
    )
    .get<{ id: string }>(...params);

  if (existing) {
    throw new ApiError(
      409,
      `Nomor surat "${normalized}" sudah terdaftar pada surat ${type === "masuk" ? "masuk" : "keluar"} lain. Gunakan nomor surat yang berbeda.`
    );
  }
}

export async function createLetterInDb(db: AletaDatabase, input: CreateLetterRequest) {
  const actor = await requireActorUser(db, input.actorUserId);
  const canCreate =
    input.type === "masuk" ? canCreateIncomingLetter(actor) : canCreateOutgoingLetter(actor);

  if (!canCreate) {
    throw new ApiError(403, "Role aktif tidak memiliki izin untuk menambah surat pada tipe ini.");
  }

  if (!input.nomorSurat.trim() || !input.perihal.trim()) {
    throw new ApiError(400, "Nomor surat dan perihal wajib diisi.");
  }

  const recipient = await resolveTargetRecipientFromDb(db, {
    targetPositionId: input.targetPositionId,
    targetUserId: input.targetUserId,
  });
  const now = new Date().toISOString();
  const tanggalSurat = input.tanggalSurat || input.tanggal;
  if (!tanggalSurat) {
    throw new ApiError(400, "Tanggal surat wajib diisi.");
  }

  const tanggalAdministratif =
    input.tanggalAdministratif ??
    (input.type === "masuk" ? input.tanggalTerima : input.tanggalKirim) ??
    tanggalSurat;
  const rootStatus = "Menunggu Tindak Lanjut";
  const rootInstruction = input.aiGenerated
    ? "Disposisi awal dibuat dari draft AI yang sudah diverifikasi pengguna sebelum disimpan."
    : "Disposisi awal dibuat saat registrasi surat oleh petugas.";
  const qrCodeLabel = `Validasi internal ${actor.name} - ${new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
  }).format(new Date(tanggalSurat))}`;

  await ensureClassificationExists(db, input.kodeKlasifikasi?.trim() ?? "");
  await ensureOriginReferenceExists(db, input.asalSurat);

  return withTransaction(db, async (tx) => {
    await assertLetterNumberAvailable(tx, { type: input.type, nomorSurat: input.nomorSurat });
    const letterId = await nextPrefixedId(tx, "letters", "srt");
    const rootDispositionId = await nextPrefixedId(tx, "dispositions", "dsp");
    const deliveryId = await nextPrefixedId(tx, "letter_whatsapp_deliveries", "wa-letter");
    const rootDeliveryId = await nextPrefixedId(tx, "disposition_whatsapp_deliveries", "wa-dsp");
    const nomorAgenda = input.nomorUrut.trim() || await generateNomorAgenda(tx, input.type, tanggalAdministratif);
    const workflowStatus: LetterWorkflowStatus = input.type === "keluar" ? "draft" : "sent";
    const sentAt = input.type === "keluar" ? null : now;
    const sentByUserId = input.type === "keluar" ? null : actor.id;
    const searchDocument = buildSearchDocument({
      nomorSurat: input.nomorSurat,
      nomorUrut: nomorAgenda,
      pengirim: input.pengirim,
      perihal: input.perihal,
      asalSurat: input.asalSurat,
      tujuanSurat: input.tujuanSurat,
      klasifikasi: input.klasifikasi,
      kodeKlasifikasi: input.kodeKlasifikasi,
      ringkasan: input.ringkasan,
      tags: input.tags,
      klasifikasiTags: input.klasifikasiTags,
      lampiran: input.lampiran,
    });

    await tx.prepare(
      `INSERT INTO letters (
        id, type, nomor_surat, nomor_urut, tanggal_surat, tanggal_terima, tanggal_kirim,
        tanggal_administratif, pengirim, perihal, status, workflow_status,
        submitted_at, submitted_by_user_id, approved_at, approved_by_user_id,
        sent_at, sent_by_user_id, rejected_at, rejected_by_user_id, rejection_note,
        assigned_unit, confidentiality,
        current_disposition_id, ringkasan, asal_surat, tujuan_surat, klasifikasi_utama,
        kode_klasifikasi, lampiran_json, tags_json, klasifikasi_tags_json, viewer_mode,
        qr_code_label, document_aspect_ratio, document_file_name, document_size_mb,
        document_text_extract, document_file_path, target_position_id, target_user_id,
        created_by_user_id, search_document, deleted_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      letterId,
      input.type,
      input.nomorSurat.trim(),
      nomorAgenda,
      tanggalSurat,
      input.type === "masuk" ? input.tanggalTerima ?? tanggalAdministratif : null,
      input.type === "keluar" ? input.tanggalKirim ?? tanggalAdministratif : null,
      tanggalAdministratif,
      input.pengirim.trim(),
      input.perihal.trim(),
      "Dalam Disposisi",
      workflowStatus,
      null,
      null,
      null,
      null,
      sentAt,
      sentByUserId,
      null,
      null,
      null,
      input.assignedUnit.trim(),
      input.confidentiality,
      rootDispositionId,
      input.ringkasan.trim(),
      input.asalSurat.trim(),
      input.tujuanSurat.trim(),
      input.klasifikasi?.trim() ?? "",
      input.kodeKlasifikasi?.trim() || null,
      stringifyJson(input.lampiran),
      stringifyJson(input.tags),
      stringifyJson(input.klasifikasiTags),
      input.viewerMode,
      qrCodeLabel,
      input.documentAspectRatio ?? 210 / 297,
      input.documentFileName ?? null,
      input.documentSizeMb ?? null,
      input.documentTextExtract ?? null,
      input.documentFilePath ?? null,
      input.targetPositionId,
      recipient.id,
      actor.id,
      searchDocument,
      null,
      now,
      now
    );

    await insertLetterCollections(tx, letterId, {
      tags: input.tags,
      classificationTags: input.klasifikasiTags,
      lampiran: input.lampiran,
    });

    await tx.prepare(
      `INSERT INTO letter_whatsapp_deliveries (
        id, letter_id, recipient_name, recipient_whatsapp, status, last_attempt_at,
        deleted_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      deliveryId,
      letterId,
      recipient.name,
      recipient.whatsappNumber,
      "Diantrekan",
      now,
      null,
      now,
      now
    );

    await sendLetterNotification(tx, {
      letterId,
      deliveryId,
    });

    await tx.prepare(
      `INSERT INTO dispositions (
        id, surat_id, pengirim_id, penerima_id, target_position_id, instruksi,
        parent_disposition_id, status, allow_download, approval_qr_code, created_at,
        deadline_at, read_at, read_by_user_id, urgent, bypass, routing_type,
        follow_up_note, follow_up_file_name, deleted_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      rootDispositionId,
      letterId,
      actor.id,
      recipient.id,
      input.targetPositionId,
      rootInstruction,
      null,
      rootStatus,
      toBooleanInt(input.viewerMode === "download"),
      `QR-${rootDispositionId.toUpperCase()}`,
      now,
      null,
      null,
      null,
      toBooleanInt(input.confidentiality !== "Biasa"),
      0,
      "standard",
      null,
      null,
      null,
      now
    );

    await tx.prepare(
      `INSERT INTO disposition_whatsapp_deliveries (
        id, disposition_id, recipient_name, recipient_whatsapp, status, last_attempt_at,
        deleted_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      rootDeliveryId,
      rootDispositionId,
      recipient.name,
      recipient.whatsappNumber,
      "Diantrekan",
      now,
      null,
      now,
      now
    );

    await sendDispositionNotification(tx, {
      dispositionId: rootDispositionId,
      deliveryId: rootDeliveryId,
    });

    await syncLetterSearchIndex(tx, letterId, searchDocument);

    await appendAuditLog(tx, {
      id: await nextPrefixedId(tx, "audit_logs", "adt"),
      actorUserId: actor.id,
      action: "CREATE_LETTER",
      entityType: "letter",
      entityId: letterId,
      payload: {
        type: input.type,
        nomorSurat: input.nomorSurat,
        targetPositionId: input.targetPositionId,
        targetUserId: recipient.id,
        initialDispositionId: rootDispositionId,
      },
    });

    const letter = await getLetterByIdFromDb(tx, letterId);
    const initialDisposition = await getDispositionByIdFromDb(tx, rootDispositionId);
    if (!letter) {
      throw new ApiError(500, "Surat berhasil dibuat tetapi gagal diambil kembali dari database.");
    }

    return {
      letter,
      initialDisposition,
    };
  });
}

export async function updateLetterInDb(db: AletaDatabase, input: UpdateLetterRequest) {
  const actor = await requireActorUser(db, input.actorUserId);
  const existing = await getLetterByIdFromDb(db, input.letterId);

  if (!existing) {
    throw new ApiError(404, "Surat tidak ditemukan.");
  }

  if (
    actor.roleId !== "admin" &&
    actor.roleId !== "super-admin" &&
    existing.createdByUserId !== actor.id
  ) {
    throw new ApiError(403, "Anda tidak memiliki izin untuk mengedit surat ini.");
  }

  const now = new Date().toISOString();

  if (input.kodeKlasifikasi !== undefined) {
    await ensureClassificationExists(db, input.kodeKlasifikasi.trim());
  }
  if (input.asalSurat !== undefined) {
    await ensureOriginReferenceExists(db, input.asalSurat);
  }

  return withTransaction(db, async (tx) => {
    if (input.nomorSurat !== undefined && input.nomorSurat.trim().toLowerCase() !== existing.nomorSurat.trim().toLowerCase()) {
      await assertLetterNumberAvailable(tx, {
        type: existing.type,
        nomorSurat: input.nomorSurat,
        excludeLetterId: existing.id,
      });
    }

    const updates: Record<string, SqlInputValue> = {
      updated_at: now,
    };

    if (input.nomorSurat !== undefined) updates.nomor_surat = input.nomorSurat.trim();
    if (input.nomorUrut !== undefined) updates.nomor_urut = input.nomorUrut.trim();
    if (input.tanggalSurat !== undefined || input.tanggal !== undefined) {
      updates.tanggal_surat = input.tanggalSurat || input.tanggal || existing.tanggal;
    }
    if (input.tanggalAdministratif !== undefined)
      updates.tanggal_administratif = input.tanggalAdministratif;
    if (input.pengirim !== undefined) updates.pengirim = input.pengirim.trim();
    if (input.perihal !== undefined) updates.perihal = input.perihal.trim();
    if (input.assignedUnit !== undefined) updates.assigned_unit = input.assignedUnit.trim();
    if (input.confidentiality !== undefined) updates.confidentiality = input.confidentiality;
    if (input.asalSurat !== undefined) updates.asal_surat = input.asalSurat.trim();
    if (input.tujuanSurat !== undefined) updates.tujuan_surat = input.tujuanSurat.trim();
    if (input.klasifikasi !== undefined) updates.klasifikasi_utama = input.klasifikasi.trim();
    if (input.kodeKlasifikasi !== undefined) updates.kode_klasifikasi = input.kodeKlasifikasi.trim() || null;
    if (input.ringkasan !== undefined) updates.ringkasan = input.ringkasan.trim();
    if (input.viewerMode !== undefined) updates.viewer_mode = input.viewerMode;
    if (input.documentFilePath !== undefined) updates.document_file_path = input.documentFilePath;
    if (input.documentFileName !== undefined) updates.document_file_name = input.documentFileName;
    if (input.documentSizeMb !== undefined) updates.document_size_mb = input.documentSizeMb;
    if (input.documentTextExtract !== undefined)
      updates.document_text_extract = input.documentTextExtract;

    if (input.tags !== undefined) updates.tags_json = stringifyJson(input.tags);
    if (input.klasifikasiTags !== undefined)
      updates.klasifikasi_tags_json = stringifyJson(input.klasifikasiTags);
    if (input.lampiran !== undefined) updates.lampiran_json = stringifyJson(input.lampiran);

    const keys = Object.keys(updates);
    const sql = `UPDATE letters SET ${keys.map((k) => `${k} = ?`).join(", ")} WHERE id = ?`;
    const params = [...Object.values(updates), input.letterId];

    await tx.prepare(sql).run(...params);

    if (
      input.tags !== undefined ||
      input.klasifikasiTags !== undefined ||
      input.lampiran !== undefined
    ) {
      if (input.tags !== undefined)
        await tx.prepare("DELETE FROM letter_tags WHERE letter_id = ?").run(input.letterId);
      if (input.klasifikasiTags !== undefined)
        await tx
          .prepare("DELETE FROM letter_classification_tags WHERE letter_id = ?")
          .run(input.letterId);
      if (input.lampiran !== undefined)
        await tx.prepare("DELETE FROM letter_attachments WHERE letter_id = ?").run(input.letterId);

      await insertLetterCollections(tx, input.letterId, {
        tags: input.tags ?? existing.tags ?? [],
        classificationTags: input.klasifikasiTags ?? existing.klasifikasiTags ?? [],
        lampiran: input.lampiran ?? existing.lampiran ?? [],
      });
    }

    const updated = await getLetterByIdFromDb(tx, input.letterId);
    if (updated) {
      const searchDocument = buildSearchDocument({
        nomorSurat: updated.nomorSurat,
        nomorUrut: updated.nomorUrut ?? null,
        pengirim: updated.pengirim,
        perihal: updated.perihal,
        asalSurat: updated.asalSurat,
        tujuanSurat: updated.tujuanSurat,
        klasifikasi: updated.klasifikasi,
        kodeKlasifikasi: updated.kodeKlasifikasi ?? "",
        ringkasan: updated.ringkasan,
        tags: updated.tags,
        klasifikasiTags: updated.klasifikasiTags ?? [],
        lampiran: updated.lampiran,
      });
      await syncLetterSearchIndex(tx, input.letterId, searchDocument);
    }

    await appendAuditLog(tx, {
      id: await nextPrefixedId(tx, "audit_logs", "adt"),
      actorUserId: actor.id,
      action: "UPDATE_LETTER",
      entityType: "letter",
      entityId: input.letterId,
      payload: input,
    });

    return getLetterByIdFromDb(tx, input.letterId);
  });
}

export async function transitionOutgoingLetterWorkflowInDb(
  db: AletaDatabase,
  {
    actorUserId,
    letterId,
    action,
    rejectionNote,
  }: {
    actorUserId: string;
    letterId: string;
    action: LetterWorkflowAction;
    rejectionNote?: string | null;
  }
) {
  const actor = await requireActorUser(db, actorUserId);
  const existing = await getLetterByIdFromDb(db, letterId);

  if (!existing) {
    throw new ApiError(404, "Surat tidak ditemukan.");
  }

  if (existing.type !== "keluar") {
    throw new ApiError(400, "Workflow review hanya berlaku untuk surat keluar.");
  }

  const roleId = getActorRoleId(actor);
  const currentStatus = existing.workflowStatus ?? "draft";
  const now = new Date().toISOString();
  const updates: Record<string, SqlInputValue> = {
    updated_at: now,
  };

  if (action === "submit") {
    if (!["draft", "rejected"].includes(currentStatus)) {
      throw new ApiError(400, "Surat keluar hanya bisa diajukan dari status Draft atau Ditolak.");
    }
    if (!isLetterCreatorOrAdmin(actor, existing)) {
      throw new ApiError(403, "Hanya pembuat surat, Admin, atau Super Admin yang dapat mengajukan review.");
    }

    updates.workflow_status = "submitted";
    updates.submitted_at = now;
    updates.submitted_by_user_id = actor.id;
    updates.rejected_at = null;
    updates.rejected_by_user_id = null;
    updates.rejection_note = null;
  } else if (action === "approve") {
    if (currentStatus !== "submitted") {
      throw new ApiError(400, "Surat keluar hanya bisa disetujui setelah diajukan.");
    }
    if (!isOutgoingWorkflowApprover(actor)) {
      throw new ApiError(403, "Role aktif tidak memiliki izin menyetujui surat keluar.");
    }

    updates.workflow_status = "approved";
    updates.approved_at = now;
    updates.approved_by_user_id = actor.id;
  } else if (action === "reject") {
    if (currentStatus !== "submitted") {
      throw new ApiError(400, "Surat keluar hanya bisa ditolak saat status Diajukan.");
    }
    if (!isOutgoingWorkflowApprover(actor)) {
      throw new ApiError(403, "Role aktif tidak memiliki izin menolak surat keluar.");
    }

    updates.workflow_status = "rejected";
    updates.rejected_at = now;
    updates.rejected_by_user_id = actor.id;
    updates.rejection_note = rejectionNote?.trim() || "Perlu perbaikan sebelum diajukan kembali.";
  } else if (action === "mark-sent") {
    if (currentStatus !== "approved") {
      throw new ApiError(400, "Surat keluar hanya dapat ditandai terbit/dikirim setelah disetujui.");
    }
    if (!isLetterCreatorOrAdmin(actor, existing) && roleId !== "sekretaris") {
      throw new ApiError(403, "Hanya pembuat surat, Sekretaris, Admin, atau Super Admin yang dapat menandai terkirim.");
    }

    updates.workflow_status = "sent";
    updates.sent_at = now;
    updates.sent_by_user_id = actor.id;
  } else if (action === "return-draft") {
    if (!["submitted", "rejected"].includes(currentStatus)) {
      throw new ApiError(400, "Surat keluar hanya bisa dikembalikan ke draft dari status Diajukan atau Ditolak.");
    }
    if (!isLetterCreatorOrAdmin(actor, existing)) {
      throw new ApiError(403, "Hanya pembuat surat, Admin, atau Super Admin yang dapat mengembalikan ke draft.");
    }

    updates.workflow_status = "draft";
  } else {
    throw new ApiError(400, "Aksi workflow surat keluar tidak dikenali.");
  }

  return withTransaction(db, async (tx) => {
    const keys = Object.keys(updates);
    await tx.prepare(
      `UPDATE letters SET ${keys.map((key) => `${key} = ?`).join(", ")} WHERE id = ?`
    ).run(...Object.values(updates), letterId);

    await appendAuditLog(tx, {
      id: await nextPrefixedId(tx, "audit_logs", "adt"),
      actorUserId: actor.id,
      action: `LETTER_WORKFLOW_${action.toUpperCase().replace(/-/g, "_")}`,
      entityType: "letter",
      entityId: letterId,
      payload: {
        previousStatus: currentStatus,
        nextStatus: updates.workflow_status,
        rejectionNote: updates.rejection_note ? "[MASKED_NOTE_PRESENT]" : undefined,
      },
    });

    return getLetterByIdFromDb(tx, letterId);
  });
}

export async function deleteLetterInDb(
  db: AletaDatabase,
  {
    actorUserId,
    letterId,
    mode,
  }: {
    actorUserId: string;
    letterId: string;
    mode?: "soft" | "hard";
  }
) {
  const actor = await requireActorUser(db, actorUserId);
  const existing = await db.prepare(
    "SELECT id, type, nomor_surat, deleted_at, document_file_path FROM letters WHERE id = ?"
  ).get<{
    id: string;
    type: LetterDetail["type"];
    nomor_surat: string;
    deleted_at: string | null;
    document_file_path: string | null;
  }>(letterId);

  if (!existing) {
    throw new ApiError(404, "Surat tidak ditemukan.");
  }

  const now = new Date().toISOString();
  const effectiveMode = mode ?? (actor.roleId === "super-admin" ? "hard" : "soft");

  if (actor.roleId !== "super-admin" && actor.roleId !== "admin") {
    throw new ApiError(403, "Hanya Admin atau Super Admin yang dapat menghapus surat.");
  }

  if (effectiveMode === "hard" && actor.roleId !== "super-admin") {
    throw new ApiError(403, "Hanya Super Admin yang dapat melakukan hard delete.");
  }

  const activeDispositionCount = await db.prepare(
    `SELECT COUNT(*) AS cnt
     FROM dispositions
     WHERE surat_id = ?
       AND deleted_at IS NULL
       AND status != 'Selesai'`
  ).get<{ cnt: number }>(letterId);
  const activeCount = Number(activeDispositionCount?.cnt ?? 0);

  if (effectiveMode === "hard") {
    const hardDeleteResult = await withTransaction(db, async (tx) => {
      const dispositionRows = await tx.prepare(
        "SELECT id FROM dispositions WHERE surat_id = ?"
      ).all<{ id: string }>(letterId);
      const dispositionIds = dispositionRows.map((row) => row.id);
      const dispositionParams = dispositionIds.map(() => "?").join(", ");

      const readDeleteResult = dispositionIds.length > 0
        ? await tx.prepare(
            `DELETE FROM user_notification_reads
             WHERE (entity_type = 'letter' AND entity_id = ?)
                OR (entity_type = 'disposition' AND entity_id IN (${dispositionParams}))`
          ).run(letterId, ...dispositionIds)
        : await tx.prepare(
            "DELETE FROM user_notification_reads WHERE entity_type = 'letter' AND entity_id = ?"
          ).run(letterId);
      const dispositionWhatsappDeleteResult = dispositionIds.length > 0
        ? await tx.prepare(
            `DELETE FROM disposition_whatsapp_deliveries WHERE disposition_id IN (${dispositionParams})`
          ).run(...dispositionIds)
        : { changes: 0 };

      await tx.prepare(
        "UPDATE dispositions SET parent_disposition_id = NULL WHERE surat_id = ?"
      ).run(letterId);

      const dispositionDeleteResult = await tx.prepare(
        "DELETE FROM dispositions WHERE surat_id = ?"
      ).run(letterId);
      const letterWhatsappDeleteResult = await tx.prepare(
        "DELETE FROM letter_whatsapp_deliveries WHERE letter_id = ?"
      ).run(letterId);
      const attachmentDeleteResult = await tx.prepare(
        "DELETE FROM letter_attachments WHERE letter_id = ?"
      ).run(letterId);
      const classificationTagDeleteResult = await tx.prepare(
        "DELETE FROM letter_classification_tags WHERE letter_id = ?"
      ).run(letterId);
      const tagDeleteResult = await tx.prepare(
        "DELETE FROM letter_tags WHERE letter_id = ?"
      ).run(letterId);
      const letterDeleteResult = await tx.prepare("DELETE FROM letters WHERE id = ?").run(letterId);

      if ((letterDeleteResult.changes ?? 0) === 0) {
        throw new ApiError(404, "Surat tidak ditemukan atau sudah dihapus permanen.");
      }

      await appendAuditLog(tx, {
        id: await nextPrefixedId(tx, "audit_logs", "adt"),
        actorUserId: actor.id,
        action: "HARD_DELETE_LETTER",
        entityType: "letter",
        entityId: letterId,
        payload: {
          nomorSurat: existing.nomor_surat,
          type: existing.type,
          previousDeletedAt: existing.deleted_at,
          activeDispositionCount: activeCount,
          deletedRelations: {
            userNotificationReads: readDeleteResult.changes ?? 0,
            dispositionWhatsappDeliveries: dispositionWhatsappDeleteResult.changes ?? 0,
            dispositions: dispositionDeleteResult.changes ?? 0,
            letterWhatsappDeliveries: letterWhatsappDeleteResult.changes ?? 0,
            attachments: attachmentDeleteResult.changes ?? 0,
            classificationTags: classificationTagDeleteResult.changes ?? 0,
            tags: tagDeleteResult.changes ?? 0,
          },
          documentFilePath: existing.document_file_path ? "[INTERNAL_PDF_PATH_PRESENT]" : null,
        },
      });

      return {
        mode: "hard" as const,
        deletedAt: now,
        activeDispositionCount: activeCount,
        deletedRelations: {
          userNotificationReads: readDeleteResult.changes ?? 0,
          dispositionWhatsappDeliveries: dispositionWhatsappDeleteResult.changes ?? 0,
          dispositions: dispositionDeleteResult.changes ?? 0,
          letterWhatsappDeliveries: letterWhatsappDeleteResult.changes ?? 0,
          attachments: attachmentDeleteResult.changes ?? 0,
          classificationTags: classificationTagDeleteResult.changes ?? 0,
          tags: tagDeleteResult.changes ?? 0,
        },
      };
    });

    let deletedDocument: { fileName: string; deleted: boolean } | null = null;
    if (existing.document_file_path) {
      try {
        deletedDocument = await deleteStoredPdfFile(existing.document_file_path);
      } catch {
        deletedDocument = null;
      }
    }

    return {
      ...hardDeleteResult,
      deletedDocument,
    };
  }

  return withTransaction(db, async (tx) => {
    await tx.prepare(
      `UPDATE letters
       SET deleted_at = ?, updated_at = ?
       WHERE id = ?`
    ).run(now, now, letterId);

    await appendAuditLog(tx, {
      id: await nextPrefixedId(tx, "audit_logs", "adt"),
      actorUserId: actor.id,
      action: "SOFT_DELETE_LETTER",
      entityType: "letter",
      entityId: letterId,
      payload: {
        previousDeletedAt: existing.deleted_at,
        activeDispositionCount: activeCount,
      },
    });

    return { mode: "soft" as const, deletedAt: now };
  });
}

export async function getLetterSummaryForStats(db: AletaDatabase, filters: LetterSearchFilters = {}) {
  const { whereClause, params } = buildSearchQuery(db, filters);

  return db.prepare(
    `SELECT id, type, status, asal_surat, klasifikasi_utama, kode_klasifikasi,
      COALESCE(tanggal_administratif, tanggal_terima, tanggal_kirim, tanggal_surat) AS tanggal_ref
     FROM letters
     WHERE ${whereClause}`
  ).all<{
    id: string;
    type: string;
    status: string;
    asal_surat: string;
    klasifikasi_utama: string;
    kode_klasifikasi: string | null;
    tanggal_ref: string;
  }>(...params);
}
