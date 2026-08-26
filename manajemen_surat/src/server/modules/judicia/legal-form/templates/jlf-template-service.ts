import type { QueryResultRow } from "pg";

import { JLF_PERMISSION } from "@/lib/judicia-legal-form-types";
import type { UserPersona } from "@/lib/types";
import type { AletaDatabase } from "@/server/db/client";
import { logTemplateEvent } from "@/server/modules/judicia/legal-form/jlf-audit-log-service";
import { requireJlfPermission } from "@/server/modules/judicia/legal-form/jlf-permission-service";
import { getJsonSetting } from "@/server/modules/judicia/legal-form/jlf-settings-service";
import { jlfBadRequest, jlfNotFound } from "@/server/modules/judicia/legal-form/jlf-service-errors";
import { buildPlaceholderReport } from "@/server/modules/judicia/legal-form/templates/jlf-placeholder-service";
import { readStoredJlfTemplateFile, storeJlfTemplateFile } from "@/server/shared/jlf-template-storage";
import { nextPrefixedId } from "@/server/shared/ids";

type UploadableTemplateFile = {
  name: string;
  size: number;
  type?: string;
  arrayBuffer: () => Promise<ArrayBuffer>;
};

type TemplateRow = QueryResultRow & {
  id: string;
  category_id: string;
  category_name: string | null;
  name: string;
  slug: string;
  description: string;
  document_type: string;
  file_type: string;
  storage_path: string;
  original_filename: string;
  status: string;
  requires_validation: boolean | number;
  supports_ai: boolean | number;
  supports_whatsapp_notification: boolean | number;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

type VersionRow = QueryResultRow & {
  id: string;
  template_id: string;
  version_number: number;
  storage_path: string;
  checksum: string;
  detected_placeholders: unknown;
  change_note: string;
  created_by: string | null;
  created_at: string;
};

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

function normalizeStatus(status: string | undefined, fallback = "draft") {
  const normalized = (status || fallback).trim().toLowerCase();
  if (!["draft", "active", "inactive", "archived"].includes(normalized)) {
    jlfBadRequest("Status template JLF tidak valid.");
  }
  return normalized;
}

function mapTemplate(row: TemplateRow) {
  return {
    id: row.id,
    categoryId: row.category_id,
    categoryName: row.category_name ?? "",
    name: row.name,
    slug: row.slug,
    description: row.description,
    documentType: row.document_type,
    fileType: row.file_type,
    storagePath: row.storage_path,
    originalFilename: row.original_filename,
    status: row.status,
    requiresValidation: Boolean(row.requires_validation),
    supportsAi: Boolean(row.supports_ai),
    supportsWhatsappNotification: Boolean(row.supports_whatsapp_notification),
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

function mapVersion(row: VersionRow) {
  return {
    id: row.id,
    templateId: row.template_id,
    versionNumber: Number(row.version_number) || 0,
    storagePath: row.storage_path,
    checksum: row.checksum,
    detectedPlaceholders: row.detected_placeholders ?? [],
    changeNote: row.change_note,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

async function readTemplateById(db: AletaDatabase, id: string) {
  const row = await db.prepare(
    `SELECT t.*, c.name AS category_name
     FROM jlf_templates t
     LEFT JOIN jlf_categories c ON c.id = t.category_id
     WHERE t.id = ? AND t.deleted_at IS NULL`
  ).get<TemplateRow>(id);

  return row ? mapTemplate(row) : null;
}

export async function listTemplates(
  db: AletaDatabase,
  actor: UserPersona,
  filters: { categoryId?: string; status?: string; query?: string; limit?: number } = {}
) {
  requireJlfPermission(actor, JLF_PERMISSION.TEMPLATE_VIEW);

  const where = ["t.deleted_at IS NULL"];
  const params: Array<string | number> = [];
  if (filters.categoryId) {
    where.push("t.category_id = ?");
    params.push(filters.categoryId);
  }
  if (filters.status) {
    where.push("t.status = ?");
    params.push(normalizeStatus(filters.status));
  }
  if (filters.query) {
    where.push("(LOWER(t.name) LIKE ? OR LOWER(t.slug) LIKE ? OR LOWER(t.description) LIKE ?)");
    const like = `%${filters.query.toLowerCase()}%`;
    params.push(like, like, like);
  }

  const limit = Math.max(1, Math.min(200, filters.limit ?? 100));
  params.push(limit);

  const rows = await db.prepare(
    `SELECT t.*, c.name AS category_name
     FROM jlf_templates t
     LEFT JOIN jlf_categories c ON c.id = t.category_id
     WHERE ${where.join(" AND ")}
     ORDER BY t.updated_at DESC
     LIMIT ?`
  ).all<TemplateRow>(...params);

  return rows.map(mapTemplate);
}

export async function getTemplate(db: AletaDatabase, actor: UserPersona, id: string) {
  requireJlfPermission(actor, JLF_PERMISSION.TEMPLATE_VIEW);

  const template = await readTemplateById(db, id);
  if (!template) jlfNotFound("Template JLF tidak ditemukan.");
  return template;
}

export async function createTemplateMetadata(
  db: AletaDatabase,
  actor: UserPersona,
  input: {
    categoryId: string;
    name: string;
    slug?: string;
    description?: string;
    documentType?: string;
    fileType?: string;
    status?: string;
    requiresValidation?: boolean;
    supportsAi?: boolean;
    supportsWhatsappNotification?: boolean;
  }
) {
  requireJlfPermission(actor, JLF_PERMISSION.TEMPLATE_CREATE);

  const category = await db.prepare("SELECT id FROM jlf_categories WHERE id = ? AND deleted_at IS NULL").get<{ id: string }>(input.categoryId);
  if (!category) jlfBadRequest("Kategori template JLF tidak valid.");

  const name = input.name.trim();
  if (!name) jlfBadRequest("Nama template wajib diisi.");

  const slug = slugify(input.slug || name);
  if (!slug) jlfBadRequest("Slug template tidak valid.");

  const id = await nextPrefixedId(db, "jlf_templates", "jlf-tpl");
  const now = new Date().toISOString();
  await db.prepare(
    `INSERT INTO jlf_templates (
      id, category_id, name, slug, description, document_type, file_type, storage_path,
      original_filename, status, requires_validation, supports_ai, supports_whatsapp_notification,
      created_by, updated_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, '', '', ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.categoryId,
    name,
    slug,
    input.description?.trim() ?? "",
    input.documentType?.trim() || "legal_form",
    input.fileType?.trim().toLowerCase() || "docx",
    normalizeStatus(input.status, "draft"),
    input.requiresValidation === false ? 0 : 1,
    input.supportsAi === true ? 1 : 0,
    input.supportsWhatsappNotification === true ? 1 : 0,
    actor.id,
    actor.id,
    now,
    now
  );

  await logTemplateEvent(db, {
    userId: actor.id,
    action: "CREATE_TEMPLATE",
    entityId: id,
    metadata: { name, slug },
  });

  return readTemplateById(db, id);
}

export async function updateTemplate(
  db: AletaDatabase,
  actor: UserPersona,
  id: string,
  input: {
    categoryId?: string;
    name?: string;
    slug?: string;
    description?: string;
    documentType?: string;
    fileType?: string;
    status?: string;
    requiresValidation?: boolean;
    supportsAi?: boolean;
    supportsWhatsappNotification?: boolean;
  }
) {
  requireJlfPermission(actor, JLF_PERMISSION.TEMPLATE_UPDATE);

  const existing = await readTemplateById(db, id);
  if (!existing) jlfNotFound("Template JLF tidak ditemukan.");

  const name = input.name?.trim();
  const slug = input.slug ? slugify(input.slug) : name ? slugify(name) : undefined;
  const now = new Date().toISOString();
  await db.prepare(
    `UPDATE jlf_templates
     SET category_id = COALESCE(?, category_id),
         name = COALESCE(?, name),
         slug = COALESCE(?, slug),
         description = COALESCE(?, description),
         document_type = COALESCE(?, document_type),
         file_type = COALESCE(?, file_type),
         status = COALESCE(?, status),
         requires_validation = COALESCE(?, requires_validation),
         supports_ai = COALESCE(?, supports_ai),
         supports_whatsapp_notification = COALESCE(?, supports_whatsapp_notification),
         updated_by = ?,
         updated_at = ?
     WHERE id = ?`
  ).run(
    input.categoryId ?? null,
    name || null,
    slug || null,
    input.description?.trim() ?? null,
    input.documentType?.trim() || null,
    input.fileType?.trim().toLowerCase() || null,
    input.status ? normalizeStatus(input.status) : null,
    input.requiresValidation === undefined ? null : input.requiresValidation ? 1 : 0,
    input.supportsAi === undefined ? null : input.supportsAi ? 1 : 0,
    input.supportsWhatsappNotification === undefined ? null : input.supportsWhatsappNotification ? 1 : 0,
    actor.id,
    now,
    id
  );

  await logTemplateEvent(db, {
    userId: actor.id,
    action: "UPDATE_TEMPLATE",
    entityId: id,
    metadata: { previousStatus: existing.status, input },
  });

  return readTemplateById(db, id);
}

export async function archiveTemplate(db: AletaDatabase, actor: UserPersona, id: string) {
  requireJlfPermission(actor, JLF_PERMISSION.TEMPLATE_DELETE);

  const existing = await readTemplateById(db, id);
  if (!existing) jlfNotFound("Template JLF tidak ditemukan.");

  const now = new Date().toISOString();
  await db.prepare(
    `UPDATE jlf_templates
     SET status = 'archived', deleted_at = ?, updated_by = ?, updated_at = ?
     WHERE id = ?`
  ).run(now, actor.id, now, id);

  await logTemplateEvent(db, {
    userId: actor.id,
    action: "ARCHIVE_TEMPLATE",
    entityId: id,
    metadata: { name: existing.name },
  });

  return { id, archived: true };
}

export async function duplicateTemplate(db: AletaDatabase, actor: UserPersona, id: string) {
  requireJlfPermission(actor, JLF_PERMISSION.TEMPLATE_CREATE);

  const existing = await getTemplate(db, actor, id);
  const copy = await createTemplateMetadata(db, actor, {
    categoryId: existing.categoryId,
    name: `${existing.name} Copy`,
    description: existing.description,
    documentType: existing.documentType,
    fileType: existing.fileType,
    status: "draft",
    requiresValidation: existing.requiresValidation,
    supportsAi: existing.supportsAi,
    supportsWhatsappNotification: existing.supportsWhatsappNotification,
  });

  await logTemplateEvent(db, {
    userId: actor.id,
    action: "DUPLICATE_TEMPLATE",
    entityId: copy?.id ?? "",
    metadata: { sourceTemplateId: id },
  });

  return copy;
}

export function activateTemplate(db: AletaDatabase, actor: UserPersona, id: string) {
  return updateTemplate(db, actor, id, { status: "active" });
}

export function deactivateTemplate(db: AletaDatabase, actor: UserPersona, id: string) {
  return updateTemplate(db, actor, id, { status: "inactive" });
}

async function nextVersionNumber(db: AletaDatabase, templateId: string) {
  const row = await db.prepare(
    `SELECT COALESCE(MAX(version_number), 0) + 1 AS next_version
     FROM jlf_template_versions
     WHERE template_id = ?`
  ).get<{ next_version: number }>(templateId);

  return Number(row?.next_version) || 1;
}

async function getTemplateUploadSettings(db: AletaDatabase) {
  const maxSize = await getJsonSetting<number>(db, "jlf.upload.max_file_size_mb", 25);
  const allowed = await getJsonSetting<string[]>(db, "jlf.upload.allowed_template_types", ["docx", "rtf"]);
  return {
    maxSizeMb: Number(maxSize) || 25,
    allowedExtensions: allowed,
  };
}

export async function createVersion(
  db: AletaDatabase,
  actor: UserPersona,
  templateId: string,
  file: UploadableTemplateFile,
  options: { changeNote?: string } = {}
) {
  requireJlfPermission(actor, JLF_PERMISSION.TEMPLATE_VERSION_MANAGE);

  const template = await getTemplate(db, actor, templateId);
  const uploadSettings = await getTemplateUploadSettings(db);
  const storedFile = await storeJlfTemplateFile(file, uploadSettings);
  const versionNumber = await nextVersionNumber(db, templateId);
  const id = await nextPrefixedId(db, "jlf_template_versions", "jlf-tplver");
  const now = new Date().toISOString();

  await db.prepare(
    `INSERT INTO jlf_template_versions (
      id, template_id, version_number, storage_path, checksum, detected_placeholders, change_note, created_by, created_at
    ) VALUES (?, ?, ?, ?, ?, '[]'::jsonb, ?, ?, ?)`
  ).run(id, templateId, versionNumber, storedFile.storagePath, storedFile.checksum, options.changeNote?.trim() ?? "", actor.id, now);

  await db.prepare(
    `UPDATE jlf_templates
     SET file_type = ?, storage_path = ?, original_filename = ?, updated_by = ?, updated_at = ?
     WHERE id = ?`
  ).run(storedFile.fileType, storedFile.storagePath, storedFile.originalFileName, actor.id, now, templateId);

  const report = await buildPlaceholderReport(db, id);
  await db.prepare(
    `UPDATE jlf_template_versions
     SET detected_placeholders = ?::jsonb
     WHERE id = ?`
  ).run(JSON.stringify(report.placeholders), id);

  await logTemplateEvent(db, {
    userId: actor.id,
    action: "UPLOAD_TEMPLATE_VERSION",
    entityId: templateId,
    metadata: {
      templateName: template.name,
      versionId: id,
      versionNumber,
      fileType: storedFile.fileType,
      placeholders: report.placeholders.length,
      unknownPlaceholders: report.unknownPlaceholders.length,
    },
  });

  return getVersion(db, actor, id);
}

export function uploadTemplateFile(
  db: AletaDatabase,
  actor: UserPersona,
  input: { templateId: string; file: UploadableTemplateFile; changeNote?: string }
) {
  return createVersion(db, actor, input.templateId, input.file, { changeNote: input.changeNote });
}

export async function listVersions(db: AletaDatabase, actor: UserPersona, templateId: string) {
  requireJlfPermission(actor, JLF_PERMISSION.TEMPLATE_VIEW);

  const rows = await db.prepare(
    `SELECT id, template_id, version_number, storage_path, checksum, detected_placeholders, change_note, created_by, created_at
     FROM jlf_template_versions
     WHERE template_id = ?
     ORDER BY version_number DESC`
  ).all<VersionRow>(templateId);

  return rows.map(mapVersion);
}

export async function getVersion(db: AletaDatabase, actor: UserPersona, versionId: string) {
  requireJlfPermission(actor, JLF_PERMISSION.TEMPLATE_VIEW);

  const row = await db.prepare(
    `SELECT id, template_id, version_number, storage_path, checksum, detected_placeholders, change_note, created_by, created_at
     FROM jlf_template_versions
     WHERE id = ?`
  ).get<VersionRow>(versionId);

  if (!row) jlfNotFound("Versi template JLF tidak ditemukan.");
  return mapVersion(row);
}

export async function detectPlaceholdersForVersion(db: AletaDatabase, actor: UserPersona, versionId: string) {
  requireJlfPermission(actor, JLF_PERMISSION.TEMPLATE_VIEW);

  const report = await buildPlaceholderReport(db, versionId);
  await db.prepare(
    `UPDATE jlf_template_versions
     SET detected_placeholders = ?::jsonb
     WHERE id = ?`
  ).run(JSON.stringify(report.placeholders), versionId);

  return report;
}

export async function detectPlaceholdersForLatestTemplateVersion(db: AletaDatabase, actor: UserPersona, templateId: string) {
  const versions = await listVersions(db, actor, templateId);
  const latest = versions[0];
  if (!latest) {
    return {
      templateVersionId: undefined,
      placeholders: [],
      unknownPlaceholders: [],
      duplicatePlaceholders: [],
      mappedPlaceholders: [],
      parserWarnings: ["Template belum memiliki versi file."],
    };
  }

  return detectPlaceholdersForVersion(db, actor, latest.id);
}

export async function readTemplateVersionContent(db: AletaDatabase, actor: UserPersona, versionId: string) {
  const version = await getVersion(db, actor, versionId);
  return readStoredJlfTemplateFile(version.storagePath);
}

export const JlfTemplateService = {
  listTemplates,
  getTemplate,
  createTemplateMetadata,
  uploadTemplateFile,
  updateTemplate,
  archiveTemplate,
  duplicateTemplate,
  activateTemplate,
  deactivateTemplate,
};

export const JlfTemplateVersionService = {
  createVersion,
  listVersions,
  getVersion,
  detectPlaceholdersForVersion,
  detectPlaceholdersForLatestTemplateVersion,
};
