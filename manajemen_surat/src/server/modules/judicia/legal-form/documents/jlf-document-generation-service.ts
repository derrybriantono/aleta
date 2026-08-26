import { createHash, randomUUID } from "node:crypto";
import type { QueryResultRow } from "pg";

import { getJlfAccessForActor, requireJlfPermission } from "@/server/modules/judicia/legal-form/jlf-permission-service";
import { JLF_PERMISSION } from "@/lib/judicia-legal-form-types";
import type { UserPersona } from "@/lib/types";
import type { AletaDatabase } from "@/server/db/client";
import { logDocumentEvent } from "@/server/modules/judicia/legal-form/jlf-audit-log-service";
import { jlfBadRequest, jlfForbidden, jlfNotFound } from "@/server/modules/judicia/legal-form/jlf-service-errors";
import { readStoredJlfTemplateFile } from "@/server/shared/jlf-template-storage";
import { nextPrefixedId } from "@/server/shared/ids";
import { JlfTemplateRenderService } from "@/server/modules/judicia/legal-form/documents/jlf-template-render-service";
import {
  getVariablePreview,
  type JlfVariableResolution,
} from "@/server/modules/judicia/legal-form/documents/jlf-variable-resolver-service";
import {
  getJlfDocumentContentType,
  readStoredJlfGeneratedDocumentFile,
  storeJlfGeneratedDocumentFile,
} from "@/server/modules/judicia/legal-form/documents/jlf-document-storage-service";
import {
  listDocumentVariableSnapshots,
  saveDocumentVariableSnapshots,
} from "@/server/modules/judicia/legal-form/documents/jlf-document-snapshot-service";

type TemplateRow = QueryResultRow & {
  id: string;
  name: string;
  slug: string;
  file_type: string;
  storage_path: string;
  original_filename: string;
  status: string;
  requires_validation: boolean | number;
};

type VersionRow = QueryResultRow & {
  id: string;
  template_id: string;
  version_number: number;
  storage_path: string;
  checksum: string;
  created_at: string;
};

type DocumentRow = QueryResultRow & {
  id: string;
  template_id: string;
  template_name: string | null;
  template_version_id: string | null;
  version_number: number | null;
  nomor_perkara: string;
  sipp_perkara_id: string;
  status: string;
  output_file_path: string;
  output_file_type: string;
  checksum: string;
  verification_token_hash: string | null;
  generated_by: string | null;
  generated_by_name: string | null;
  validated_by: string | null;
  validated_at: string | null;
  finalized_at: string | null;
  metadata: unknown;
  created_at: string;
  updated_at: string;
};

type DocumentTimelineRow = QueryResultRow & {
  id: string;
  generated_document_id: string;
  action: string;
  comment: string;
  actor_id: string | null;
  actor_name: string | null;
  metadata: unknown;
  created_at: string;
};

export type JlfDocumentGenerationInput = {
  templateId: string;
  nomorPerkara: string;
  sippPerkaraId?: string;
  selectedHearing?: unknown;
  mode?: "preview" | "generate_draft" | "generate_final" | "regenerate";
};

function normalizeNomorPerkara(value: string) {
  const normalized = decodeURIComponent(value).trim().replace(/\s+/g, " ");
  if (!normalized) jlfBadRequest("Nomor perkara wajib diisi.");
  if (normalized.length > 120) jlfBadRequest("Nomor perkara maksimal 120 karakter.");
  return normalized;
}

function mapDocumentRow(row: DocumentRow) {
  return {
    id: row.id,
    templateId: row.template_id,
    templateName: row.template_name ?? "",
    templateVersionId: row.template_version_id,
    versionNumber: row.version_number,
    nomorPerkara: row.nomor_perkara,
    sippPerkaraId: row.sipp_perkara_id,
    status: row.status,
    outputFileType: row.output_file_type,
    checksum: row.checksum,
    generatedBy: row.generated_by,
    generatedByName: row.generated_by_name,
    validatedBy: row.validated_by,
    validatedAt: row.validated_at,
    finalizedAt: row.finalized_at,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getTemplateForGeneration(db: AletaDatabase, templateId: string) {
  const template = await db.prepare(
    `SELECT id, name, slug, file_type, storage_path, original_filename, status, requires_validation
     FROM jlf_templates
     WHERE id = ? AND deleted_at IS NULL`
  ).get<TemplateRow>(templateId);
  if (!template) jlfNotFound("Template JLF tidak ditemukan.");

  const version = await db.prepare(
    `SELECT id, template_id, version_number, storage_path, checksum, created_at
     FROM jlf_template_versions
     WHERE template_id = ?
     ORDER BY version_number DESC
     LIMIT 1`
  ).get<VersionRow>(templateId);
  if (!version) jlfBadRequest("Template belum memiliki versi file untuk generate dokumen.");

  return { template, version };
}

function assertDocumentOwnerOrAdmin(actor: UserPersona, row: DocumentRow) {
  const access = getJlfAccessForActor(actor);
  if (access.isSuperAdmin || access.isAdmin) return;
  if (row.generated_by === actor.id) return;
  jlfForbidden("Dokumen JLF ini hanya dapat dibuka oleh pembuat dokumen atau admin berwenang.");
}

function getRenderedValueInput(variables: JlfVariableResolution[]) {
  return variables.map((variable) => ({
    key: variable.key,
    placeholder: variable.placeholder,
    value: variable.value,
    warnings: variable.warnings,
    error: variable.error,
  }));
}

function sanitizeFileSegment(value: string, fallback: string, options: { preserveDots?: boolean } = {}) {
  const pattern = options.preserveDots ? /[\\/:*?"<>|]+/g : /[\\/:*?"<>|.]+/g;
  const cleaned = value
    .replace(/\s+/g, " ")
    .replace(/\//g, "_")
    .replace(pattern, "_")
    .replace(/_+/g, "_")
    .replace(/\s+_/g, "_")
    .replace(/_\s+/g, "_")
    .trim()
    .replace(/^[-_.\s]+|[-_.\s]+$/g, "");
  return cleaned || fallback;
}

function cleanTemplateNameForFile(value: string | null | undefined) {
  return sanitizeFileSegment(
    (value || "Template JLF")
      .replace(/\s*\((?:RTF|DOCX|PDF|TXT)\)\s*-\s*.*$/i, "")
      .replace(/\s+-\s*(?:active|draft|inactive)$/i, "")
      .trim(),
    "Template JLF",
    { preserveDots: true }
  );
}

export function buildJlfOutputFileName(nomorPerkara: string, templateName: string | null | undefined, fileType: string) {
  const safeNomor = sanitizeFileSegment(nomorPerkara, "perkara", { preserveDots: true });
  const safeTemplate = cleanTemplateNameForFile(templateName);
  const safeFileType = fileType.replace(/[^a-zA-Z0-9]+/g, "").toLowerCase() || "rtf";
  return `${safeNomor} - ${safeTemplate} - by JLF.${safeFileType}`;
}

function getOutputFileName(template: TemplateRow, nomorPerkara: string, fileType: string) {
  return buildJlfOutputFileName(nomorPerkara, template.name, fileType);
}

export async function previewDocumentGeneration(
  db: AletaDatabase,
  actor: UserPersona,
  input: JlfDocumentGenerationInput,
  audit?: { ipAddress?: string; userAgent?: string }
) {
  requireJlfPermission(actor, JLF_PERMISSION.DOCUMENT_PREVIEW);

  const nomorPerkara = normalizeNomorPerkara(input.nomorPerkara);
  const { template, version } = await getTemplateForGeneration(db, input.templateId);
  const preview = await getVariablePreview(db, actor, {
    templateId: template.id,
    nomorPerkara,
    sippPerkaraId: input.sippPerkaraId,
    options: {
      selectedHearing: input.selectedHearing,
    },
  });
  const formatWarnings =
    template.file_type === "docx"
      ? ["Generate DOCX penuh belum aktif. Template DOCX dapat dipreview variabelnya, tetapi output dokumen belum dirender."]
      : [];

  await logDocumentEvent(db, {
    userId: actor.id,
    action: "document.preview",
    entityId: template.id,
    nomorPerkara,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
    metadata: {
      templateId: template.id,
      templateVersionId: version.id,
      selectedHearing: input.selectedHearing ? true : false,
      missingRequiredVariables: preview.missingRequiredVariables.length,
      unknownPlaceholders: preview.unknownPlaceholders.length,
    },
  });

  return {
    template: {
      id: template.id,
      name: template.name,
      status: template.status,
      fileType: template.file_type,
      requiresValidation: Boolean(template.requires_validation),
    },
    version: {
      id: version.id,
      versionNumber: Number(version.version_number) || 0,
      checksum: version.checksum,
    },
    ...preview,
    warnings: Array.from(new Set([...preview.warnings, ...formatWarnings])),
    canRender: template.file_type === "rtf",
    supportedOutputFormats: ["rtf"],
  };
}

export async function generateDocument(
  db: AletaDatabase,
  actor: UserPersona,
  input: JlfDocumentGenerationInput,
  audit?: { ipAddress?: string; userAgent?: string }
) {
  requireJlfPermission(actor, JLF_PERMISSION.DOCUMENT_GENERATE);

  if (input.mode === "generate_final") {
    jlfBadRequest("Generate final menunggu workflow validasi Tahap 7. Gunakan generate draft.");
  }

  const nomorPerkara = normalizeNomorPerkara(input.nomorPerkara);
  const { template, version } = await getTemplateForGeneration(db, input.templateId);
  if (template.status !== "active") {
    jlfBadRequest("Hanya template berstatus active yang dapat dipakai untuk generate dokumen.");
  }

  const preview = await previewDocumentGeneration(db, actor, input, audit);
  if (preview.missingRequiredVariables.length > 0) {
    jlfBadRequest("Masih ada variabel wajib yang belum terisi.", {
      missingRequiredVariables: preview.missingRequiredVariables.map((item) => item.key),
    });
  }

  const storedTemplate = await readStoredJlfTemplateFile(version.storage_path);
  const rendered = JlfTemplateRenderService.renderTemplateBuffer({
    buffer: storedTemplate.buffer,
    fileType: template.file_type,
    values: getRenderedValueInput(preview.variables),
  });
  const output = await storeJlfGeneratedDocumentFile({
    buffer: rendered.buffer,
    fileType: rendered.outputFileType,
    suggestedFileName: getOutputFileName(template, nomorPerkara, rendered.outputFileType),
  });

  const id = await nextPrefixedId(db, "jlf_generated_documents", "jlf-doc");
  const now = new Date().toISOString();
  const verificationToken = randomUUID();
  const verificationTokenHash = createHash("sha256").update(verificationToken).digest("hex");
  const metadata = {
    mode: input.mode ?? "generate_draft",
    templateName: template.name,
    versionNumber: version.version_number,
    warnings: Array.from(new Set([...preview.warnings, ...rendered.warnings])),
    unknownPlaceholders: rendered.unknownPlaceholders.map((item) => item.placeholder),
    emptyPlaceholders: rendered.emptyPlaceholders,
    replacedPlaceholders: rendered.replacedPlaceholders,
    requiresValidation: Boolean(template.requires_validation),
    downloadFileName: output.fileName,
    selectedHearing: input.selectedHearing ?? null,
  };

  await db.prepare(
    `INSERT INTO jlf_generated_documents (
      id, template_id, template_version_id, nomor_perkara, sipp_perkara_id, status,
      output_file_path, output_file_type, checksum, verification_token, verification_token_hash,
      generated_by, metadata, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?, ?)`
  ).run(
    id,
    template.id,
    version.id,
    nomorPerkara,
    input.sippPerkaraId?.trim() ?? "",
    "draft",
    output.storagePath,
    output.fileType,
    output.checksum,
    null,
    verificationTokenHash,
    actor.id,
    JSON.stringify(metadata),
    now,
    now
  );

  await saveDocumentVariableSnapshots(db, id, preview.variables);
  await logDocumentEvent(db, {
    userId: actor.id,
    action: "document.generate",
    entityId: id,
    nomorPerkara,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
    metadata: {
      templateId: template.id,
      templateVersionId: version.id,
      outputFileType: output.fileType,
      checksum: output.checksum,
      unknownPlaceholders: rendered.unknownPlaceholders.length,
    },
  });

  return getGeneratedDocument(db, actor, id);
}

async function readGeneratedDocumentRow(db: AletaDatabase, id: string) {
  const row = await db.prepare(
    `SELECT d.*, t.name AS template_name, v.version_number, u.name AS generated_by_name
     FROM jlf_generated_documents d
     JOIN jlf_templates t ON t.id = d.template_id
     LEFT JOIN jlf_template_versions v ON v.id = d.template_version_id
     LEFT JOIN users u ON u.id = d.generated_by
     WHERE d.id = ?`
  ).get<DocumentRow>(id);
  if (!row) jlfNotFound("Dokumen JLF tidak ditemukan.");
  return row;
}

export async function listGeneratedDocuments(
  db: AletaDatabase,
  actor: UserPersona,
  filters: {
    status?: string;
    templateId?: string;
    nomorPerkara?: string;
    from?: string;
    to?: string;
    limit?: number;
  } = {}
) {
  requireJlfPermission(actor, JLF_PERMISSION.DOCUMENT_PREVIEW);

  const access = getJlfAccessForActor(actor);
  const where: string[] = [];
  const params: Array<string | number> = [];

  if (!access.isSuperAdmin && !access.isAdmin) {
    where.push("d.generated_by = ?");
    params.push(actor.id);
  }
  if (filters.status) {
    where.push("d.status = ?");
    params.push(filters.status);
  }
  if (filters.templateId) {
    where.push("d.template_id = ?");
    params.push(filters.templateId);
  }
  if (filters.nomorPerkara) {
    where.push("LOWER(d.nomor_perkara) LIKE ?");
    params.push(`%${filters.nomorPerkara.toLowerCase()}%`);
  }
  if (filters.from) {
    where.push("d.created_at >= ?");
    params.push(filters.from);
  }
  if (filters.to) {
    where.push("d.created_at <= ?");
    params.push(filters.to);
  }

  const limit = Math.max(1, Math.min(200, filters.limit ?? 100));
  params.push(limit);

  const rows = await db.prepare(
    `SELECT d.*, t.name AS template_name, v.version_number, u.name AS generated_by_name
     FROM jlf_generated_documents d
     JOIN jlf_templates t ON t.id = d.template_id
     LEFT JOIN jlf_template_versions v ON v.id = d.template_version_id
     LEFT JOIN users u ON u.id = d.generated_by
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY d.created_at DESC
     LIMIT ?`
  ).all<DocumentRow>(...params);

  return rows.map(mapDocumentRow);
}

export async function getGeneratedDocument(db: AletaDatabase, actor: UserPersona, id: string) {
  requireJlfPermission(actor, JLF_PERMISSION.DOCUMENT_PREVIEW);
  const row = await readGeneratedDocumentRow(db, id);
  assertDocumentOwnerOrAdmin(actor, row);
  const snapshots = await listDocumentVariableSnapshots(db, id);
  const timelineRows = await db.prepare(
    `SELECT l.id, l.generated_document_id, l.action, l.comment, l.actor_id, u.name AS actor_name,
       l.metadata, l.created_at
     FROM jlf_document_validation_logs l
     LEFT JOIN users u ON u.id = l.actor_id
     WHERE l.generated_document_id = ?
     ORDER BY l.created_at ASC`
  ).all<DocumentTimelineRow>(id);

  return {
    ...mapDocumentRow(row),
    snapshots,
    validationTimeline: timelineRows.map((item) => ({
      id: item.id,
      generatedDocumentId: item.generated_document_id,
      action: item.action,
      comment: item.comment,
      actorId: item.actor_id,
      actorName: item.actor_name,
      metadata: item.metadata ?? {},
      createdAt: item.created_at,
    })),
  };
}

export async function getGeneratedDocumentDownload(
  db: AletaDatabase,
  actor: UserPersona,
  id: string,
  audit?: { ipAddress?: string; userAgent?: string }
) {
  requireJlfPermission(actor, JLF_PERMISSION.DOCUMENT_DOWNLOAD);
  const row = await readGeneratedDocumentRow(db, id);
  assertDocumentOwnerOrAdmin(actor, row);

  if (!row.output_file_path) {
    jlfNotFound("File output dokumen JLF belum tersedia.");
  }

  const stored = await readStoredJlfGeneratedDocumentFile(row.output_file_path);
  await logDocumentEvent(db, {
    userId: actor.id,
    action: "document.download",
    entityId: id,
    nomorPerkara: row.nomor_perkara,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
    metadata: {
      outputFileType: row.output_file_type,
      checksum: row.checksum,
    },
  });

  return {
    buffer: stored.buffer,
    fileName: buildJlfOutputFileName(row.nomor_perkara, row.template_name, row.output_file_type || "rtf"),
    contentType: getJlfDocumentContentType(row.output_file_type),
  };
}

export async function archiveGeneratedDocument(
  db: AletaDatabase,
  actor: UserPersona,
  id: string,
  audit?: { ipAddress?: string; userAgent?: string }
) {
  requireJlfPermission(actor, JLF_PERMISSION.DOCUMENT_ARCHIVE);
  const row = await readGeneratedDocumentRow(db, id);
  assertDocumentOwnerOrAdmin(actor, row);

  const now = new Date().toISOString();
  await db.prepare(
    `UPDATE jlf_generated_documents
     SET status = 'archived', updated_at = ?
     WHERE id = ?`
  ).run(now, id);

  await logDocumentEvent(db, {
    userId: actor.id,
    action: "document.archive",
    entityId: id,
    nomorPerkara: row.nomor_perkara,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  });

  return getGeneratedDocument(db, actor, id);
}

export const JlfDocumentGenerationService = {
  previewDocument: previewDocumentGeneration,
  generateDocument,
  listGeneratedDocuments,
  getGeneratedDocument,
  getGeneratedDocumentDownload,
  archiveGeneratedDocument,
};
