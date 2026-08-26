import type { QueryResultRow } from "pg";

import { JLF_PERMISSION } from "@/lib/judicia-legal-form-types";
import type { UserPersona } from "@/lib/types";
import type { AletaDatabase } from "@/server/db/client";
import { logRegulationEvent } from "@/server/modules/judicia/legal-form/jlf-audit-log-service";
import { requireJlfPermission } from "@/server/modules/judicia/legal-form/jlf-permission-service";
import { jlfBadRequest, jlfNotFound } from "@/server/modules/judicia/legal-form/jlf-service-errors";
import { nextPrefixedId } from "@/server/shared/ids";

type AuditMeta = { ipAddress?: string; userAgent?: string; metadata?: Record<string, unknown> };

type RegulationTypeRow = QueryResultRow & {
  id: string;
  code: string;
  name: string;
  description: string;
  hierarchy_level: number;
  issuing_scope: string;
  is_binding: boolean | number;
  is_active: boolean | number;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

type RegulationRow = QueryResultRow & {
  id: string;
  regulation_type_id: string;
  regulation_type_name?: string;
  title: string;
  short_title: string;
  regulation_number: string;
  regulation_year: number | null;
  issuing_body: string;
  jurisdiction: string;
  subject: string;
  summary: string;
  status: string;
  verification_status: string;
  source_url: string;
  source_name: string;
  official_document_path: string;
  effective_date: string | null;
  promulgation_date: string | null;
  revoked_at: string | null;
  revoked_by_regulation_id: string | null;
  superseded_by_regulation_id: string | null;
  tags: unknown;
  metadata: unknown;
  created_by: string | null;
  verified_by: string | null;
  verified_at: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

type RegulationVersionRow = QueryResultRow & {
  id: string;
  regulation_id: string;
  version_number: number;
  version_label: string;
  document_path: string;
  checksum: string;
  text_content: string;
  extracted_text_status: string;
  change_note: string;
  created_by: string | null;
  created_at: string;
};

type RegulationSectionRow = QueryResultRow & {
  id: string;
  regulation_id: string;
  regulation_version_id: string | null;
  section_type: string;
  section_number: string;
  parent_section_id: string | null;
  title: string;
  content: string;
  normalized_content: string;
  page_number: number | null;
  sort_order: number;
  metadata: unknown;
  created_at: string;
  updated_at: string;
};

type RegulationTopicRow = QueryResultRow & {
  id: string;
  name: string;
  slug: string;
  description: string;
  parent_id: string | null;
  is_active: boolean | number;
  created_at: string;
  updated_at: string;
};

type RegulationLinkRow = QueryResultRow & {
  id: string;
  relation_type: string;
  note: string;
  created_by: string | null;
  created_at: string;
  regulation_id: string;
  regulation_title: string;
  regulation_section_id: string | null;
  section_label: string | null;
};

const REGULATION_STATUSES = new Set(["draft", "active", "revoked", "partially_revoked", "superseded", "archived", "unknown"]);
const VERIFICATION_STATUSES = new Set(["unverified", "needs_review", "verified", "rejected"]);
const SECTION_TYPES = new Set(["pembukaan", "konsiderans", "bab", "bagian", "paragraf", "pasal", "ayat", "huruf", "angka", "lampiran", "penjelasan", "lainnya"]);
const RELATION_TYPES = new Set(["dasar_hukum", "rujukan_format", "syarat_formil", "syarat_materiil", "pedoman_redaksi", "validasi_kelengkapan", "lainnya"]);

function bool(value: boolean | number | null | undefined) {
  return value === true || value === 1;
}

function clean(value: string | undefined | null, max = 1000) {
  return (value ?? "").trim().slice(0, max);
}

function normalizeCode(value: string) {
  const code = clean(value, 80).toUpperCase().replace(/[^A-Z0-9_.-]+/g, "_").replace(/^_+|_+$/g, "");
  if (!code) jlfBadRequest("Kode jenis peraturan wajib diisi.");
  return code;
}

function normalizeSlug(value: string) {
  const slug = clean(value, 160)
    .toLocaleLowerCase("id-ID")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!slug) jlfBadRequest("Slug/topik tidak valid.");
  return slug;
}

function normalizeStatus(value: string | undefined, fallback: string, allowed: Set<string>, label: string) {
  const status = clean(value, 60) || fallback;
  if (!allowed.has(status)) jlfBadRequest(`${label} tidak valid.`);
  return status;
}

function normalizeJsonArray(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === "string" && value.trim()) return value.split(",").map((item) => item.trim()).filter(Boolean);
  return [];
}

function normalizeJsonObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function mapRegulationType(row: RegulationTypeRow) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    hierarchyLevel: row.hierarchy_level,
    issuingScope: row.issuing_scope,
    isBinding: bool(row.is_binding),
    isActive: bool(row.is_active),
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRegulation(row: RegulationRow) {
  return {
    id: row.id,
    regulationTypeId: row.regulation_type_id,
    regulationTypeName: row.regulation_type_name ?? "",
    title: row.title,
    shortTitle: row.short_title,
    regulationNumber: row.regulation_number,
    regulationYear: row.regulation_year,
    issuingBody: row.issuing_body,
    jurisdiction: row.jurisdiction,
    subject: row.subject,
    summary: row.summary,
    status: row.status,
    verificationStatus: row.verification_status,
    sourceUrl: row.source_url,
    sourceName: row.source_name,
    officialDocumentPath: row.official_document_path,
    effectiveDate: row.effective_date,
    promulgationDate: row.promulgation_date,
    revokedAt: row.revoked_at,
    revokedByRegulationId: row.revoked_by_regulation_id,
    supersededByRegulationId: row.superseded_by_regulation_id,
    tags: Array.isArray(row.tags) ? row.tags : [],
    metadata: normalizeJsonObject(row.metadata),
    createdBy: row.created_by,
    verifiedBy: row.verified_by,
    verifiedAt: row.verified_at,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapVersion(row: RegulationVersionRow) {
  return {
    id: row.id,
    regulationId: row.regulation_id,
    versionNumber: row.version_number,
    versionLabel: row.version_label,
    documentPath: row.document_path,
    checksum: row.checksum,
    textContent: row.text_content,
    extractedTextStatus: row.extracted_text_status,
    changeNote: row.change_note,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

function mapSection(row: RegulationSectionRow) {
  return {
    id: row.id,
    regulationId: row.regulation_id,
    regulationVersionId: row.regulation_version_id,
    sectionType: row.section_type,
    sectionNumber: row.section_number,
    parentSectionId: row.parent_section_id,
    title: row.title,
    content: row.content,
    normalizedContent: row.normalized_content,
    pageNumber: row.page_number,
    sortOrder: row.sort_order,
    metadata: normalizeJsonObject(row.metadata),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapTopic(row: RegulationTopicRow) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    parentId: row.parent_id,
    isActive: bool(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapLink(row: RegulationLinkRow) {
  return {
    id: row.id,
    regulationId: row.regulation_id,
    regulationTitle: row.regulation_title,
    regulationSectionId: row.regulation_section_id,
    sectionLabel: row.section_label,
    relationType: row.relation_type,
    note: row.note,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

async function audit(db: AletaDatabase, actor: UserPersona, action: string, entityId: string, meta?: AuditMeta) {
  await logRegulationEvent(db, {
    userId: actor.id,
    action,
    entityId,
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
    metadata: meta?.metadata,
  });
}

export async function listRegulationTypes(db: AletaDatabase, actor: UserPersona, filters: { includeInactive?: boolean } = {}) {
  requireJlfPermission(actor, JLF_PERMISSION.REGULATION_VIEW);
  const rows = await db.prepare(
    `SELECT id, code, name, description, hierarchy_level, issuing_scope, is_binding, is_active,
       sort_order, created_at, updated_at
     FROM jlf_regulation_types
     ${filters.includeInactive ? "" : "WHERE is_active = 1"}
     ORDER BY sort_order ASC, hierarchy_level ASC, name ASC`
  ).all<RegulationTypeRow>();
  return rows.map(mapRegulationType);
}

export async function createRegulationType(
  db: AletaDatabase,
  actor: UserPersona,
  input: { code: string; name: string; description?: string; hierarchyLevel?: number; issuingScope?: string; isBinding?: boolean; sortOrder?: number },
  meta?: AuditMeta
) {
  requireJlfPermission(actor, JLF_PERMISSION.REGULATION_TYPE_MANAGE);
  const id = await nextPrefixedId(db, "jlf_regulation_types", "jlf-reg-type");
  const now = new Date().toISOString();
  await db.prepare(
    `INSERT INTO jlf_regulation_types (
      id, code, name, description, hierarchy_level, issuing_scope, is_binding, is_active,
      sort_order, created_by, updated_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)`
  ).run(
    id,
    normalizeCode(input.code),
    clean(input.name, 180),
    clean(input.description),
    Math.max(0, input.hierarchyLevel ?? 0),
    clean(input.issuingScope, 120),
    input.isBinding === false ? 0 : 1,
    input.sortOrder ?? 0,
    actor.id,
    actor.id,
    now,
    now
  );
  await audit(db, actor, "regulation_type.create", id, meta);
  return (await listRegulationTypes(db, actor, { includeInactive: true })).find((item) => item.id === id) ?? null;
}

export async function updateRegulationType(
  db: AletaDatabase,
  actor: UserPersona,
  id: string,
  input: Partial<{ code: string; name: string; description: string; hierarchyLevel: number; issuingScope: string; isBinding: boolean; isActive: boolean; sortOrder: number }>,
  meta?: AuditMeta
) {
  requireJlfPermission(actor, JLF_PERMISSION.REGULATION_TYPE_MANAGE);
  await db.prepare(
    `UPDATE jlf_regulation_types
     SET code = COALESCE(?, code),
         name = COALESCE(?, name),
         description = COALESCE(?, description),
         hierarchy_level = COALESCE(?, hierarchy_level),
         issuing_scope = COALESCE(?, issuing_scope),
         is_binding = COALESCE(?, is_binding),
         is_active = COALESCE(?, is_active),
         sort_order = COALESCE(?, sort_order),
         updated_by = ?,
         updated_at = ?
     WHERE id = ?`
  ).run(
    input.code ? normalizeCode(input.code) : null,
    input.name !== undefined ? clean(input.name, 180) : null,
    input.description !== undefined ? clean(input.description) : null,
    input.hierarchyLevel ?? null,
    input.issuingScope !== undefined ? clean(input.issuingScope, 120) : null,
    input.isBinding === undefined ? null : input.isBinding ? 1 : 0,
    input.isActive === undefined ? null : input.isActive ? 1 : 0,
    input.sortOrder ?? null,
    actor.id,
    new Date().toISOString(),
    id
  );
  await audit(db, actor, "regulation_type.update", id, meta);
  return (await listRegulationTypes(db, actor, { includeInactive: true })).find((item) => item.id === id) ?? null;
}

export function disableRegulationType(db: AletaDatabase, actor: UserPersona, id: string, meta?: AuditMeta) {
  return updateRegulationType(db, actor, id, { isActive: false }, { ...meta, metadata: { ...(meta?.metadata ?? {}), disabled: true } });
}

export async function listRegulations(
  db: AletaDatabase,
  actor: UserPersona,
  filters: {
    query?: string;
    regulationTypeId?: string;
    regulationYear?: number;
    status?: string;
    verificationStatus?: string;
    topicId?: string;
    limit?: number;
  } = {}
) {
  requireJlfPermission(actor, JLF_PERMISSION.REGULATION_VIEW);
  const where = ["r.deleted_at IS NULL"];
  const params: Array<string | number> = [];
  if (filters.query) {
    where.push("(LOWER(r.title) LIKE ? OR LOWER(r.summary) LIKE ? OR LOWER(r.subject) LIKE ? OR LOWER(r.regulation_number) LIKE ?)");
    const like = `%${filters.query.toLocaleLowerCase("id-ID")}%`;
    params.push(like, like, like, like);
  }
  if (filters.regulationTypeId) {
    where.push("r.regulation_type_id = ?");
    params.push(filters.regulationTypeId);
  }
  if (filters.regulationYear) {
    where.push("r.regulation_year = ?");
    params.push(filters.regulationYear);
  }
  if (filters.status) {
    where.push("r.status = ?");
    params.push(filters.status);
  }
  if (filters.verificationStatus) {
    where.push("r.verification_status = ?");
    params.push(filters.verificationStatus);
  }
  if (filters.topicId) {
    where.push("EXISTS (SELECT 1 FROM jlf_regulation_topic_links tl WHERE tl.regulation_id = r.id AND tl.topic_id = ?)");
    params.push(filters.topicId);
  }
  params.push(Math.max(1, Math.min(200, filters.limit ?? 50)));

  const rows = await db.prepare(
    `SELECT r.*, rt.name AS regulation_type_name
     FROM jlf_regulations r
     JOIN jlf_regulation_types rt ON rt.id = r.regulation_type_id
     WHERE ${where.join(" AND ")}
     ORDER BY r.updated_at DESC, r.title ASC
     LIMIT ?`
  ).all<RegulationRow>(...params);
  return rows.map(mapRegulation);
}

export async function getRegulation(db: AletaDatabase, actor: UserPersona, id: string) {
  requireJlfPermission(actor, JLF_PERMISSION.REGULATION_VIEW);
  const row = await db.prepare(
    `SELECT r.*, rt.name AS regulation_type_name
     FROM jlf_regulations r
     JOIN jlf_regulation_types rt ON rt.id = r.regulation_type_id
     WHERE r.id = ? AND r.deleted_at IS NULL`
  ).get<RegulationRow>(id);
  if (!row) jlfNotFound("Peraturan JLF tidak ditemukan.");
  return mapRegulation(row);
}

export async function createRegulation(
  db: AletaDatabase,
  actor: UserPersona,
  input: {
    regulationTypeId: string;
    title: string;
    shortTitle?: string;
    regulationNumber?: string;
    regulationYear?: number | null;
    issuingBody?: string;
    jurisdiction?: string;
    subject?: string;
    summary?: string;
    status?: string;
    verificationStatus?: string;
    sourceUrl?: string;
    sourceName?: string;
    officialDocumentPath?: string;
    effectiveDate?: string | null;
    promulgationDate?: string | null;
    tags?: unknown;
    metadata?: unknown;
  },
  meta?: AuditMeta
) {
  requireJlfPermission(actor, JLF_PERMISSION.REGULATION_CREATE);
  const id = await nextPrefixedId(db, "jlf_regulations", "jlf-reg");
  const now = new Date().toISOString();
  const status = normalizeStatus(input.status, "draft", REGULATION_STATUSES, "Status peraturan");
  const verificationStatus = normalizeStatus(input.verificationStatus, status === "active" ? "needs_review" : "unverified", VERIFICATION_STATUSES, "Status verifikasi");
  await db.prepare(
    `INSERT INTO jlf_regulations (
      id, regulation_type_id, title, short_title, regulation_number, regulation_year,
      issuing_body, jurisdiction, subject, summary, status, verification_status,
      source_url, source_name, official_document_path, effective_date, promulgation_date,
      tags, metadata, created_by, updated_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?::jsonb, ?, ?, ?, ?)`
  ).run(
    id,
    input.regulationTypeId,
    clean(input.title, 400),
    clean(input.shortTitle, 180),
    clean(input.regulationNumber, 120),
    input.regulationYear ?? null,
    clean(input.issuingBody, 180),
    clean(input.jurisdiction, 120),
    clean(input.subject, 240),
    clean(input.summary, 4000),
    status,
    verificationStatus,
    clean(input.sourceUrl, 600),
    clean(input.sourceName, 240),
    clean(input.officialDocumentPath, 600),
    input.effectiveDate || null,
    input.promulgationDate || null,
    JSON.stringify(normalizeJsonArray(input.tags)),
    JSON.stringify(normalizeJsonObject(input.metadata)),
    actor.id,
    actor.id,
    now,
    now
  );
  await audit(db, actor, "regulation.create", id, meta);
  return getRegulation(db, actor, id);
}

export async function updateRegulation(
  db: AletaDatabase,
  actor: UserPersona,
  id: string,
  input: Partial<Parameters<typeof createRegulation>[2]>,
  meta?: AuditMeta
) {
  requireJlfPermission(actor, JLF_PERMISSION.REGULATION_UPDATE);
  await getRegulation(db, actor, id);
  await db.prepare(
    `UPDATE jlf_regulations
     SET regulation_type_id = COALESCE(?, regulation_type_id),
         title = COALESCE(?, title),
         short_title = COALESCE(?, short_title),
         regulation_number = COALESCE(?, regulation_number),
         regulation_year = COALESCE(?, regulation_year),
         issuing_body = COALESCE(?, issuing_body),
         jurisdiction = COALESCE(?, jurisdiction),
         subject = COALESCE(?, subject),
         summary = COALESCE(?, summary),
         status = COALESCE(?, status),
         verification_status = COALESCE(?, verification_status),
         source_url = COALESCE(?, source_url),
         source_name = COALESCE(?, source_name),
         official_document_path = COALESCE(?, official_document_path),
         effective_date = COALESCE(?, effective_date),
         promulgation_date = COALESCE(?, promulgation_date),
         tags = COALESCE(?::jsonb, tags),
         metadata = COALESCE(?::jsonb, metadata),
         updated_by = ?,
         updated_at = ?
     WHERE id = ? AND deleted_at IS NULL`
  ).run(
    input.regulationTypeId ?? null,
    input.title !== undefined ? clean(input.title, 400) : null,
    input.shortTitle !== undefined ? clean(input.shortTitle, 180) : null,
    input.regulationNumber !== undefined ? clean(input.regulationNumber, 120) : null,
    input.regulationYear ?? null,
    input.issuingBody !== undefined ? clean(input.issuingBody, 180) : null,
    input.jurisdiction !== undefined ? clean(input.jurisdiction, 120) : null,
    input.subject !== undefined ? clean(input.subject, 240) : null,
    input.summary !== undefined ? clean(input.summary, 4000) : null,
    input.status ? normalizeStatus(input.status, "draft", REGULATION_STATUSES, "Status peraturan") : null,
    input.verificationStatus ? normalizeStatus(input.verificationStatus, "unverified", VERIFICATION_STATUSES, "Status verifikasi") : null,
    input.sourceUrl !== undefined ? clean(input.sourceUrl, 600) : null,
    input.sourceName !== undefined ? clean(input.sourceName, 240) : null,
    input.officialDocumentPath !== undefined ? clean(input.officialDocumentPath, 600) : null,
    input.effectiveDate ?? null,
    input.promulgationDate ?? null,
    input.tags === undefined ? null : JSON.stringify(normalizeJsonArray(input.tags)),
    input.metadata === undefined ? null : JSON.stringify(normalizeJsonObject(input.metadata)),
    actor.id,
    new Date().toISOString(),
    id
  );
  await audit(db, actor, "regulation.update", id, meta);
  return getRegulation(db, actor, id);
}

export async function archiveRegulation(db: AletaDatabase, actor: UserPersona, id: string, meta?: AuditMeta) {
  requireJlfPermission(actor, JLF_PERMISSION.REGULATION_DELETE);
  const now = new Date().toISOString();
  await db.prepare(
    `UPDATE jlf_regulations
     SET status = 'archived', deleted_at = ?, updated_by = ?, updated_at = ?
     WHERE id = ? AND deleted_at IS NULL`
  ).run(now, actor.id, now, id);
  await audit(db, actor, "regulation.archive", id, meta);
  return { id, archived: true };
}

export async function createRegulationVersion(
  db: AletaDatabase,
  actor: UserPersona,
  input: { regulationId: string; versionLabel?: string; documentPath?: string; checksum?: string; textContent?: string; extractedTextStatus?: string; changeNote?: string },
  meta?: AuditMeta
) {
  requireJlfPermission(actor, JLF_PERMISSION.REGULATION_UPDATE);
  await getRegulation(db, actor, input.regulationId);
  const latest = await db.prepare(
    `SELECT COALESCE(MAX(version_number), 0) AS version_number
     FROM jlf_regulation_versions
     WHERE regulation_id = ?`
  ).get<{ version_number: number }>(input.regulationId);
  const id = await nextPrefixedId(db, "jlf_regulation_versions", "jlf-reg-ver");
  const now = new Date().toISOString();
  await db.prepare(
    `INSERT INTO jlf_regulation_versions (
      id, regulation_id, version_number, version_label, document_path, checksum,
      text_content, extracted_text_status, change_note, created_by, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.regulationId,
    (latest?.version_number ?? 0) + 1,
    clean(input.versionLabel, 120),
    clean(input.documentPath, 600),
    clean(input.checksum, 180),
    clean(input.textContent, 200000),
    clean(input.extractedTextStatus, 60) || "manual",
    clean(input.changeNote, 1000),
    actor.id,
    now
  );
  await audit(db, actor, "regulation.version.create", input.regulationId, meta);
  return listRegulationVersions(db, actor, input.regulationId);
}

export async function listRegulationVersions(db: AletaDatabase, actor: UserPersona, regulationId: string) {
  requireJlfPermission(actor, JLF_PERMISSION.REGULATION_VIEW);
  const rows = await db.prepare(
    `SELECT id, regulation_id, version_number, version_label, document_path, checksum,
      text_content, extracted_text_status, change_note, created_by, created_at
     FROM jlf_regulation_versions
     WHERE regulation_id = ?
     ORDER BY version_number DESC`
  ).all<RegulationVersionRow>(regulationId);
  return rows.map(mapVersion);
}

export async function listSections(db: AletaDatabase, actor: UserPersona, regulationId: string) {
  requireJlfPermission(actor, JLF_PERMISSION.REGULATION_VIEW);
  const rows = await db.prepare(
    `SELECT id, regulation_id, regulation_version_id, section_type, section_number,
      parent_section_id, title, content, normalized_content, page_number, sort_order,
      metadata, created_at, updated_at
     FROM jlf_regulation_sections
     WHERE regulation_id = ?
     ORDER BY sort_order ASC, section_type ASC, section_number ASC`
  ).all<RegulationSectionRow>(regulationId);
  return rows.map(mapSection);
}

export async function createSection(
  db: AletaDatabase,
  actor: UserPersona,
  input: {
    regulationId: string;
    regulationVersionId?: string | null;
    sectionType: string;
    sectionNumber?: string;
    parentSectionId?: string | null;
    title?: string;
    content?: string;
    normalizedContent?: string;
    pageNumber?: number | null;
    sortOrder?: number;
    metadata?: unknown;
  },
  meta?: AuditMeta
) {
  requireJlfPermission(actor, JLF_PERMISSION.REGULATION_UPDATE);
  const sectionType = clean(input.sectionType, 60) || "lainnya";
  if (!SECTION_TYPES.has(sectionType)) jlfBadRequest("Tipe section peraturan tidak valid.");
  const id = await nextPrefixedId(db, "jlf_regulation_sections", "jlf-reg-sec");
  const now = new Date().toISOString();
  const content = clean(input.content, 200000);
  await db.prepare(
    `INSERT INTO jlf_regulation_sections (
      id, regulation_id, regulation_version_id, section_type, section_number, parent_section_id,
      title, content, normalized_content, page_number, sort_order, metadata, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?, ?)`
  ).run(
    id,
    input.regulationId,
    input.regulationVersionId ?? null,
    sectionType,
    clean(input.sectionNumber, 80),
    input.parentSectionId ?? null,
    clean(input.title, 300),
    content,
    clean(input.normalizedContent, 200000) || content.toLocaleLowerCase("id-ID"),
    input.pageNumber ?? null,
    input.sortOrder ?? 0,
    JSON.stringify(normalizeJsonObject(input.metadata)),
    now,
    now
  );
  await audit(db, actor, "regulation.section.create", input.regulationId, meta);
  return (await listSections(db, actor, input.regulationId)).find((item) => item.id === id) ?? null;
}

export async function updateSection(
  db: AletaDatabase,
  actor: UserPersona,
  sectionId: string,
  input: Partial<Parameters<typeof createSection>[2]>,
  meta?: AuditMeta
) {
  requireJlfPermission(actor, JLF_PERMISSION.REGULATION_UPDATE);
  const existing = await db.prepare("SELECT regulation_id FROM jlf_regulation_sections WHERE id = ?").get<{ regulation_id: string }>(sectionId);
  if (!existing) jlfNotFound("Section peraturan tidak ditemukan.");
  const sectionType = input.sectionType ? clean(input.sectionType, 60) : null;
  if (sectionType && !SECTION_TYPES.has(sectionType)) jlfBadRequest("Tipe section peraturan tidak valid.");
  await db.prepare(
    `UPDATE jlf_regulation_sections
     SET regulation_version_id = COALESCE(?, regulation_version_id),
         section_type = COALESCE(?, section_type),
         section_number = COALESCE(?, section_number),
         parent_section_id = COALESCE(?, parent_section_id),
         title = COALESCE(?, title),
         content = COALESCE(?, content),
         normalized_content = COALESCE(?, normalized_content),
         page_number = COALESCE(?, page_number),
         sort_order = COALESCE(?, sort_order),
         metadata = COALESCE(?::jsonb, metadata),
         updated_at = ?
     WHERE id = ?`
  ).run(
    input.regulationVersionId ?? null,
    sectionType,
    input.sectionNumber !== undefined ? clean(input.sectionNumber, 80) : null,
    input.parentSectionId ?? null,
    input.title !== undefined ? clean(input.title, 300) : null,
    input.content !== undefined ? clean(input.content, 200000) : null,
    input.normalizedContent !== undefined ? clean(input.normalizedContent, 200000) : null,
    input.pageNumber ?? null,
    input.sortOrder ?? null,
    input.metadata === undefined ? null : JSON.stringify(normalizeJsonObject(input.metadata)),
    new Date().toISOString(),
    sectionId
  );
  await audit(db, actor, "regulation.section.update", existing.regulation_id, meta);
  return (await listSections(db, actor, existing.regulation_id)).find((item) => item.id === sectionId) ?? null;
}

export async function deleteSection(db: AletaDatabase, actor: UserPersona, sectionId: string, meta?: AuditMeta) {
  requireJlfPermission(actor, JLF_PERMISSION.REGULATION_UPDATE);
  const existing = await db.prepare("SELECT regulation_id FROM jlf_regulation_sections WHERE id = ?").get<{ regulation_id: string }>(sectionId);
  if (!existing) jlfNotFound("Section peraturan tidak ditemukan.");
  await db.prepare("DELETE FROM jlf_regulation_sections WHERE id = ?").run(sectionId);
  await audit(db, actor, "regulation.section.delete", existing.regulation_id, meta);
  return { id: sectionId, deleted: true };
}

export async function listTopics(db: AletaDatabase, actor: UserPersona, filters: { includeInactive?: boolean } = {}) {
  requireJlfPermission(actor, JLF_PERMISSION.REGULATION_VIEW);
  const rows = await db.prepare(
    `SELECT id, name, slug, description, parent_id, is_active, created_at, updated_at
     FROM jlf_regulation_topics
     ${filters.includeInactive ? "" : "WHERE is_active = 1"}
     ORDER BY name ASC`
  ).all<RegulationTopicRow>();
  return rows.map(mapTopic);
}

export async function createTopic(
  db: AletaDatabase,
  actor: UserPersona,
  input: { name: string; slug?: string; description?: string; parentId?: string | null; isActive?: boolean },
  meta?: AuditMeta
) {
  requireJlfPermission(actor, JLF_PERMISSION.REGULATION_TOPIC_MANAGE);
  const id = await nextPrefixedId(db, "jlf_regulation_topics", "jlf-reg-topic");
  const now = new Date().toISOString();
  await db.prepare(
    `INSERT INTO jlf_regulation_topics (
      id, name, slug, description, parent_id, is_active, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    clean(input.name, 180),
    normalizeSlug(input.slug || input.name),
    clean(input.description),
    input.parentId ?? null,
    input.isActive === false ? 0 : 1,
    now,
    now
  );
  await audit(db, actor, "regulation.topic.create", id, meta);
  return (await listTopics(db, actor, { includeInactive: true })).find((item) => item.id === id) ?? null;
}

export async function updateTopic(
  db: AletaDatabase,
  actor: UserPersona,
  id: string,
  input: Partial<{ name: string; slug: string; description: string; parentId: string | null; isActive: boolean }>,
  meta?: AuditMeta
) {
  requireJlfPermission(actor, JLF_PERMISSION.REGULATION_TOPIC_MANAGE);
  await db.prepare(
    `UPDATE jlf_regulation_topics
     SET name = COALESCE(?, name),
         slug = COALESCE(?, slug),
         description = COALESCE(?, description),
         parent_id = COALESCE(?, parent_id),
         is_active = COALESCE(?, is_active),
         updated_at = ?
     WHERE id = ?`
  ).run(
    input.name !== undefined ? clean(input.name, 180) : null,
    input.slug !== undefined ? normalizeSlug(input.slug) : null,
    input.description !== undefined ? clean(input.description) : null,
    input.parentId ?? null,
    input.isActive === undefined ? null : input.isActive ? 1 : 0,
    new Date().toISOString(),
    id
  );
  await audit(db, actor, "regulation.topic.update", id, meta);
  return (await listTopics(db, actor, { includeInactive: true })).find((item) => item.id === id) ?? null;
}

async function createRegulationLink(
  db: AletaDatabase,
  actor: UserPersona,
  table: "jlf_template_regulations" | "jlf_variable_regulations",
  ownerColumn: "template_id" | "variable_id",
  input: { ownerId: string; regulationId: string; regulationSectionId?: string | null; relationType?: string; note?: string },
  meta?: AuditMeta
) {
  requireJlfPermission(actor, table === "jlf_template_regulations" ? JLF_PERMISSION.TEMPLATE_UPDATE : JLF_PERMISSION.VARIABLE_UPDATE);
  const relationType = clean(input.relationType, 80) || "dasar_hukum";
  if (!RELATION_TYPES.has(relationType)) jlfBadRequest("Tipe relasi peraturan tidak valid.");
  const id = await nextPrefixedId(db, table, table === "jlf_template_regulations" ? "jlf-template-reg" : "jlf-variable-reg");
  await db.prepare(
    `INSERT INTO ${table} (
      id, ${ownerColumn}, regulation_id, regulation_section_id, relation_type, note, created_by, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.ownerId,
    input.regulationId,
    input.regulationSectionId ?? null,
    relationType,
    clean(input.note),
    actor.id,
    new Date().toISOString()
  );
  await audit(db, actor, table === "jlf_template_regulations" ? "template.regulation.link" : "variable.regulation.link", input.regulationId, meta);
  return { id };
}

async function listRegulationLinks(
  db: AletaDatabase,
  actor: UserPersona,
  table: "jlf_template_regulations" | "jlf_variable_regulations",
  ownerColumn: "template_id" | "variable_id",
  ownerId: string
) {
  requireJlfPermission(actor, JLF_PERMISSION.REGULATION_VIEW);
  const rows = await db.prepare(
    `SELECT l.id, l.regulation_id, r.title AS regulation_title, l.regulation_section_id,
       CASE WHEN s.id IS NULL THEN NULL ELSE TRIM(s.section_type || ' ' || s.section_number || ' ' || s.title) END AS section_label,
       l.relation_type, l.note, l.created_by, l.created_at
     FROM ${table} l
     JOIN jlf_regulations r ON r.id = l.regulation_id
     LEFT JOIN jlf_regulation_sections s ON s.id = l.regulation_section_id
     WHERE l.${ownerColumn} = ?
     ORDER BY l.created_at DESC`
  ).all<RegulationLinkRow>(ownerId);
  return rows.map(mapLink);
}

export function linkTemplateToRegulation(db: AletaDatabase, actor: UserPersona, input: { templateId: string; regulationId: string; regulationSectionId?: string | null; relationType?: string; note?: string }, meta?: AuditMeta) {
  return createRegulationLink(db, actor, "jlf_template_regulations", "template_id", { ownerId: input.templateId, ...input }, meta);
}

export function linkVariableToRegulation(db: AletaDatabase, actor: UserPersona, input: { variableId: string; regulationId: string; regulationSectionId?: string | null; relationType?: string; note?: string }, meta?: AuditMeta) {
  return createRegulationLink(db, actor, "jlf_variable_regulations", "variable_id", { ownerId: input.variableId, ...input }, meta);
}

export function listRegulationsForTemplate(db: AletaDatabase, actor: UserPersona, templateId: string) {
  return listRegulationLinks(db, actor, "jlf_template_regulations", "template_id", templateId);
}

export function listRegulationsForVariable(db: AletaDatabase, actor: UserPersona, variableId: string) {
  return listRegulationLinks(db, actor, "jlf_variable_regulations", "variable_id", variableId);
}

export async function verifyRegulation(db: AletaDatabase, actor: UserPersona, id: string, meta?: AuditMeta) {
  requireJlfPermission(actor, JLF_PERMISSION.REGULATION_VERIFY);
  const now = new Date().toISOString();
  await db.prepare(
    `UPDATE jlf_regulations
     SET verification_status = 'verified', status = CASE WHEN status = 'draft' THEN 'active' ELSE status END,
         verified_by = ?, verified_at = ?, updated_by = ?, updated_at = ?
     WHERE id = ? AND deleted_at IS NULL`
  ).run(actor.id, now, actor.id, now, id);
  await audit(db, actor, "regulation.verify", id, meta);
  return getRegulation(db, actor, id);
}

export async function rejectRegulation(db: AletaDatabase, actor: UserPersona, id: string, reason: string, meta?: AuditMeta) {
  requireJlfPermission(actor, JLF_PERMISSION.REGULATION_VERIFY);
  const normalizedReason = clean(reason, 1000);
  if (!normalizedReason) jlfBadRequest("Alasan penolakan peraturan wajib diisi.");
  const existing = await getRegulation(db, actor, id);
  await db.prepare(
    `UPDATE jlf_regulations
     SET verification_status = 'rejected',
         metadata = metadata || ?::jsonb,
         updated_by = ?, updated_at = ?
     WHERE id = ? AND deleted_at IS NULL`
  ).run(JSON.stringify({ verificationRejectReason: normalizedReason }), actor.id, new Date().toISOString(), id);
  await audit(db, actor, "regulation.reject", id, { ...meta, metadata: { ...(meta?.metadata ?? {}), reason: normalizedReason, previousStatus: existing.verificationStatus } });
  return getRegulation(db, actor, id);
}

export const JlfRegulationTypeService = {
  listRegulationTypes,
  createRegulationType,
  updateRegulationType,
  disableRegulationType,
};

export const JlfRegulationService = {
  listRegulations,
  getRegulation,
  createRegulation,
  updateRegulation,
  archiveRegulation,
};

export const JlfRegulationVersionService = {
  createRegulationVersion,
  listRegulationVersions,
};

export const JlfRegulationSectionService = {
  listSections,
  createSection,
  updateSection,
  deleteSection,
};

export const JlfRegulationTopicService = {
  listTopics,
  createTopic,
  updateTopic,
};

export const JlfTemplateRegulationService = {
  linkTemplateToRegulation,
  listRegulationsForTemplate,
};

export const JlfVariableRegulationService = {
  linkVariableToRegulation,
  listRegulationsForVariable,
};

export const JlfRegulationVerificationService = {
  verifyRegulation,
  rejectRegulation,
};
