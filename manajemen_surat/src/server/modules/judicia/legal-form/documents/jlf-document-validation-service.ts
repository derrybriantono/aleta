import type { QueryResultRow } from "pg";

import { getJlfAccessForActor, requireJlfPermission } from "@/server/modules/judicia/legal-form/jlf-permission-service";
import { JLF_PERMISSION } from "@/lib/judicia-legal-form-types";
import type { UserPersona } from "@/lib/types";
import type { AletaDatabase } from "@/server/db/client";
import { logDocumentEvent } from "@/server/modules/judicia/legal-form/jlf-audit-log-service";
import { jlfBadRequest, jlfForbidden, jlfNotFound } from "@/server/modules/judicia/legal-form/jlf-service-errors";
import { nextPrefixedId } from "@/server/shared/ids";
import {
  buildQrVerificationPayload,
  ensureDocumentVerificationToken,
} from "@/server/modules/judicia/legal-form/verification/jlf-qr-code-service";
import { sendJlfWhatsappNotification } from "@/server/modules/judicia/legal-form/whatsapp/jlf-whatsapp-notification-service";

type DocumentWorkflowRow = QueryResultRow & {
  id: string;
  template_id: string;
  template_name: string;
  nomor_perkara: string;
  status: string;
  generated_by: string | null;
  validated_by: string | null;
  validated_at: string | null;
  finalized_at: string | null;
  checksum: string;
  created_at: string;
  updated_at: string;
};

type ValidationLogRow = QueryResultRow & {
  id: string;
  generated_document_id: string;
  action: string;
  comment: string;
  actor_id: string | null;
  actor_name: string | null;
  metadata: unknown;
  created_at: string;
};

type WorkflowAudit = { ipAddress?: string; userAgent?: string };

const VALID_STATUSES = new Set([
  "draft",
  "generated",
  "waiting_validation",
  "change_requested",
  "approved",
  "rejected",
  "finalized",
  "archived",
]);

function normalizeComment(comment: string | undefined | null, required = false) {
  const normalized = (comment ?? "").trim();
  if (required && !normalized) jlfBadRequest("Komentar wajib diisi untuk aksi ini.");
  if (normalized.length > 2000) jlfBadRequest("Komentar maksimal 2000 karakter.");
  return normalized;
}

function mapDocument(row: DocumentWorkflowRow) {
  return {
    id: row.id,
    templateId: row.template_id,
    templateName: row.template_name,
    nomorPerkara: row.nomor_perkara,
    status: row.status,
    generatedBy: row.generated_by,
    validatedBy: row.validated_by,
    validatedAt: row.validated_at,
    finalizedAt: row.finalized_at,
    checksum: row.checksum,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapValidationLog(row: ValidationLogRow) {
  return {
    id: row.id,
    generatedDocumentId: row.generated_document_id,
    action: row.action,
    comment: row.comment,
    actorId: row.actor_id,
    actorName: row.actor_name,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
  };
}

async function readDocument(db: AletaDatabase, documentId: string) {
  const row = await db.prepare(
    `SELECT d.id, d.template_id, t.name AS template_name, d.nomor_perkara, d.status,
       d.generated_by, d.validated_by, d.validated_at, d.finalized_at, d.checksum,
       d.created_at, d.updated_at
     FROM jlf_generated_documents d
     JOIN jlf_templates t ON t.id = d.template_id
     WHERE d.id = ?`
  ).get<DocumentWorkflowRow>(documentId);
  if (!row) jlfNotFound("Dokumen JLF tidak ditemukan.");
  return row;
}

async function appendValidationLog(
  db: AletaDatabase,
  input: {
    documentId: string;
    action: string;
    comment?: string;
    actorId?: string | null;
    metadata?: Record<string, unknown>;
  }
) {
  const id = await nextPrefixedId(db, "jlf_document_validation_logs", "jlf-val-log");
  const now = new Date().toISOString();
  await db.prepare(
    `INSERT INTO jlf_document_validation_logs (
      id, generated_document_id, action, comment, actor_id, metadata, created_at
    ) VALUES (?, ?, ?, ?, ?, ?::jsonb, ?)`
  ).run(
    id,
    input.documentId,
    input.action,
    input.comment ?? "",
    input.actorId ?? null,
    JSON.stringify(input.metadata ?? {}),
    now
  );
  return { id, createdAt: now };
}

async function updateDocumentStatus(
  db: AletaDatabase,
  documentId: string,
  status: string,
  extra: { validatedBy?: string | null; validatedAt?: string | null; finalizedAt?: string | null } = {}
) {
  if (!VALID_STATUSES.has(status)) jlfBadRequest("Status dokumen JLF tidak valid.");
  const now = new Date().toISOString();
  await db.prepare(
    `UPDATE jlf_generated_documents
     SET status = ?,
         validated_by = COALESCE(?, validated_by),
         validated_at = COALESCE(?, validated_at),
         finalized_at = COALESCE(?, finalized_at),
         updated_at = ?
     WHERE id = ?`
  ).run(
    status,
    extra.validatedBy ?? null,
    extra.validatedAt ?? null,
    extra.finalizedAt ?? null,
    now,
    documentId
  );
}

function canSubmit(actor: UserPersona, document: DocumentWorkflowRow) {
  const access = getJlfAccessForActor(actor);
  return access.isSuperAdmin || access.isAdmin || document.generated_by === actor.id || access.permissions.includes(JLF_PERMISSION.DOCUMENT_GENERATE);
}

function assertNotFinalizedOrArchived(document: DocumentWorkflowRow) {
  if (document.status === "finalized") jlfBadRequest("Dokumen final tidak dapat diubah melalui aksi ini.");
  if (document.status === "archived") jlfBadRequest("Dokumen arsip tidak dapat diubah melalui aksi ini.");
}

async function auditWorkflow(
  db: AletaDatabase,
  actor: UserPersona,
  document: DocumentWorkflowRow,
  action: string,
  audit?: WorkflowAudit,
  metadata?: Record<string, unknown>
) {
  await logDocumentEvent(db, {
    userId: actor.id,
    action,
    entityId: document.id,
    nomorPerkara: document.nomor_perkara,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
    metadata: {
      status: document.status,
      templateId: document.template_id,
      ...metadata,
    },
  });
}

async function notifyDocumentOwner(
  db: AletaDatabase,
  document: DocumentWorkflowRow,
  eventType: Parameters<typeof sendJlfWhatsappNotification>[1]["eventType"],
  actor: UserPersona
) {
  await sendJlfWhatsappNotification(db, {
    eventType,
    recipientUserId: document.generated_by,
    relatedEntityType: "jlf_generated_document",
    relatedEntityId: document.id,
    nomorPerkara: document.nomor_perkara,
    createdBy: actor.id,
  });
}

export async function submitForValidation(
  db: AletaDatabase,
  actor: UserPersona,
  documentId: string,
  comment?: string,
  audit?: WorkflowAudit
) {
  const document = await readDocument(db, documentId);
  if (!canSubmit(actor, document)) jlfForbidden("Hanya pembuat dokumen atau admin yang dapat mengajukan validasi.");
  if (!["draft", "generated", "change_requested"].includes(document.status)) {
    jlfBadRequest("Hanya dokumen draft/generated/change_requested yang dapat diajukan validasi.");
  }

  const normalizedComment = normalizeComment(comment);
  await updateDocumentStatus(db, documentId, "waiting_validation");
  await appendValidationLog(db, { documentId, action: "submit", comment: normalizedComment, actorId: actor.id });
  await auditWorkflow(db, actor, document, "document.submit_validation", audit);
  await notifyDocumentOwner(db, document, "document_waiting_validation", actor);
  return getValidationTimeline(db, actor, documentId);
}

export async function addValidationComment(
  db: AletaDatabase,
  actor: UserPersona,
  documentId: string,
  comment: string,
  audit?: WorkflowAudit
) {
  const document = await readDocument(db, documentId);
  const access = getJlfAccessForActor(actor);
  if (!access.isSuperAdmin && !access.isAdmin && document.generated_by !== actor.id && !access.permissions.includes(JLF_PERMISSION.DOCUMENT_VALIDATE)) {
    jlfForbidden("Anda tidak memiliki izin untuk memberi komentar validasi dokumen ini.");
  }
  if (document.status === "archived") jlfBadRequest("Dokumen arsip tidak dapat diberi komentar.");

  const normalizedComment = normalizeComment(comment, true);
  await appendValidationLog(db, { documentId, action: "comment", comment: normalizedComment, actorId: actor.id });
  await auditWorkflow(db, actor, document, "document.comment", audit);
  return getValidationTimeline(db, actor, documentId);
}

export async function requestChange(
  db: AletaDatabase,
  actor: UserPersona,
  documentId: string,
  comment: string,
  audit?: WorkflowAudit
) {
  requireJlfPermission(actor, JLF_PERMISSION.DOCUMENT_VALIDATE);
  const document = await readDocument(db, documentId);
  assertNotFinalizedOrArchived(document);
  if (document.status !== "waiting_validation") jlfBadRequest("Permintaan perubahan hanya dapat dilakukan saat menunggu validasi.");

  const normalizedComment = normalizeComment(comment, true);
  await updateDocumentStatus(db, documentId, "change_requested");
  await appendValidationLog(db, { documentId, action: "request_change", comment: normalizedComment, actorId: actor.id });
  await auditWorkflow(db, actor, document, "document.request_change", audit);
  await notifyDocumentOwner(db, document, "document_change_requested", actor);
  return getValidationTimeline(db, actor, documentId);
}

export async function approveDocument(
  db: AletaDatabase,
  actor: UserPersona,
  documentId: string,
  comment?: string,
  audit?: WorkflowAudit
) {
  requireJlfPermission(actor, JLF_PERMISSION.DOCUMENT_APPROVE);
  const document = await readDocument(db, documentId);
  assertNotFinalizedOrArchived(document);
  if (document.status !== "waiting_validation") jlfBadRequest("Dokumen hanya dapat disetujui saat menunggu validasi.");

  const now = new Date().toISOString();
  await updateDocumentStatus(db, documentId, "approved", { validatedBy: actor.id, validatedAt: now });
  await appendValidationLog(db, { documentId, action: "approve", comment: normalizeComment(comment), actorId: actor.id });
  await auditWorkflow(db, actor, document, "document.approve", audit);
  await notifyDocumentOwner(db, document, "document_approved", actor);
  return getValidationTimeline(db, actor, documentId);
}

export async function rejectDocument(
  db: AletaDatabase,
  actor: UserPersona,
  documentId: string,
  comment: string,
  audit?: WorkflowAudit
) {
  requireJlfPermission(actor, JLF_PERMISSION.DOCUMENT_REJECT);
  const document = await readDocument(db, documentId);
  assertNotFinalizedOrArchived(document);
  if (document.status !== "waiting_validation") jlfBadRequest("Dokumen hanya dapat ditolak saat menunggu validasi.");

  const normalizedComment = normalizeComment(comment, true);
  const now = new Date().toISOString();
  await updateDocumentStatus(db, documentId, "rejected", { validatedBy: actor.id, validatedAt: now });
  await appendValidationLog(db, { documentId, action: "reject", comment: normalizedComment, actorId: actor.id });
  await auditWorkflow(db, actor, document, "document.reject", audit);
  await notifyDocumentOwner(db, document, "document_rejected", actor);
  return getValidationTimeline(db, actor, documentId);
}

export async function finalizeDocument(
  db: AletaDatabase,
  actor: UserPersona,
  documentId: string,
  audit?: WorkflowAudit
) {
  requireJlfPermission(actor, JLF_PERMISSION.DOCUMENT_FINALIZE);
  const document = await readDocument(db, documentId);
  if (document.status !== "approved") jlfBadRequest("Hanya dokumen approved yang dapat difinalisasi.");

  const now = new Date().toISOString();
  await updateDocumentStatus(db, documentId, "finalized", { finalizedAt: now });
  const tokenResult = await ensureDocumentVerificationToken(db, documentId);
  await appendValidationLog(db, {
    documentId,
    action: "finalize",
    actorId: actor.id,
    metadata: { verificationTokenCreated: tokenResult.created },
  });
  await auditWorkflow(db, actor, document, "document.finalize", audit, { verificationTokenCreated: tokenResult.created });
  await notifyDocumentOwner(db, document, "document_finalized", actor);

  const timeline = await getValidationTimeline(db, actor, documentId);
  return {
    ...timeline,
    verificationToken: tokenResult.token,
    qrPayload: tokenResult.token
      ? buildQrVerificationPayload({
          generatedDocumentId: document.id,
          nomorPerkara: document.nomor_perkara,
          templateId: document.template_id,
          generatedAt: document.created_at,
          verificationToken: tokenResult.token,
          checksum: document.checksum,
        })
      : null,
  };
}

export async function archiveValidationDocument(
  db: AletaDatabase,
  actor: UserPersona,
  documentId: string,
  audit?: WorkflowAudit
) {
  requireJlfPermission(actor, JLF_PERMISSION.DOCUMENT_ARCHIVE);
  const document = await readDocument(db, documentId);
  await updateDocumentStatus(db, documentId, "archived");
  await appendValidationLog(db, { documentId, action: "archive", actorId: actor.id });
  await auditWorkflow(db, actor, document, "document.archive", audit);
  return getValidationTimeline(db, actor, documentId);
}

export async function listPendingValidations(
  db: AletaDatabase,
  actor: UserPersona,
  filters: { status?: string; limit?: number } = {}
) {
  requireJlfPermission(actor, JLF_PERMISSION.DOCUMENT_VALIDATE);
  const status = filters.status || "waiting_validation";
  const limit = Math.max(1, Math.min(200, filters.limit ?? 100));
  const rows = await db.prepare(
    `SELECT d.id, d.template_id, t.name AS template_name, d.nomor_perkara, d.status,
       d.generated_by, d.validated_by, d.validated_at, d.finalized_at, d.checksum, d.created_at, d.updated_at
     FROM jlf_generated_documents d
     JOIN jlf_templates t ON t.id = d.template_id
     WHERE d.status = ?
     ORDER BY d.updated_at DESC
     LIMIT ?`
  ).all<DocumentWorkflowRow>(status, limit);
  return rows.map(mapDocument);
}

export async function getValidationTimeline(db: AletaDatabase, actor: UserPersona, documentId: string) {
  const document = await readDocument(db, documentId);
  const access = getJlfAccessForActor(actor);
  if (!access.isSuperAdmin && !access.isAdmin && document.generated_by !== actor.id && !access.permissions.includes(JLF_PERMISSION.DOCUMENT_VALIDATE)) {
    jlfForbidden("Anda tidak memiliki izin melihat timeline validasi dokumen ini.");
  }

  const rows = await db.prepare(
    `SELECT l.id, l.generated_document_id, l.action, l.comment, l.actor_id, u.name AS actor_name,
       l.metadata, l.created_at
     FROM jlf_document_validation_logs l
     LEFT JOIN users u ON u.id = l.actor_id
     WHERE l.generated_document_id = ?
     ORDER BY l.created_at ASC`
  ).all<ValidationLogRow>(documentId);

  return {
    document: mapDocument(document),
    timeline: rows.map(mapValidationLog),
  };
}

export const JlfDocumentValidationService = {
  submitForValidation,
  addValidationComment,
  requestChange,
  approveDocument,
  rejectDocument,
  finalizeDocument,
  archiveDocument: archiveValidationDocument,
  listPendingValidations,
  getValidationTimeline,
};

export const JlfDocumentWorkflowService = JlfDocumentValidationService;
