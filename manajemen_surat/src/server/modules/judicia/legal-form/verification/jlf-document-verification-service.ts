import type { QueryResultRow } from "pg";

import { JLF_PERMISSION } from "@/lib/judicia-legal-form-types";
import type { UserPersona } from "@/lib/types";
import type { AletaDatabase } from "@/server/db/client";
import { logAction } from "@/server/modules/judicia/legal-form/jlf-audit-log-service";
import { canActorUseJlfPermission } from "@/server/modules/judicia/legal-form/jlf-permission-service";
import { hashVerificationToken, maskNomorPerkara } from "@/server/modules/judicia/legal-form/verification/jlf-qr-code-service";

type VerificationRow = QueryResultRow & {
  id: string;
  template_id: string;
  template_name: string;
  nomor_perkara: string;
  status: string;
  output_file_type: string;
  checksum: string;
  generated_by: string | null;
  created_at: string;
  finalized_at: string | null;
  verification_token_hash: string | null;
};

function mapPublicVerification(row: VerificationRow, includeDetail: boolean) {
  return {
    valid: row.status === "finalized" || row.status === "approved",
    status: row.status,
    generatedDocumentId: includeDetail ? row.id : "",
    templateId: includeDetail ? row.template_id : "",
    documentType: row.template_name,
    generatedAt: row.created_at,
    finalizedAt: row.finalized_at,
    nomorPerkara: includeDetail ? row.nomor_perkara : maskNomorPerkara(row.nomor_perkara),
    outputFileType: includeDetail ? row.output_file_type : "",
    checksum: includeDetail ? row.checksum : "",
    detailAvailable: includeDetail,
    publicView: !includeDetail,
  };
}

export async function verifyDocumentToken(
  db: AletaDatabase,
  token: string,
  actor?: UserPersona | null,
  audit?: { ipAddress?: string; userAgent?: string }
) {
  const normalized = token.trim();
  const tokenHash = hashVerificationToken(normalized);
  const row = await db.prepare(
    `SELECT d.id, d.template_id, t.name AS template_name, d.nomor_perkara, d.status,
       d.output_file_type, d.checksum, d.generated_by, d.created_at, d.finalized_at, d.verification_token_hash
     FROM jlf_generated_documents d
     JOIN jlf_templates t ON t.id = d.template_id
     WHERE d.verification_token_hash = ?`
  ).get<VerificationRow>(tokenHash);

  if (!row) {
    await logAction(db, {
      userId: actor?.id,
      action: "verify.access.invalid",
      entityType: "jlf_document_verification",
      ipAddress: audit?.ipAddress,
      userAgent: audit?.userAgent,
      metadata: { tokenHashPrefix: tokenHash.slice(0, 12) },
    });

    return {
      valid: false,
      status: "invalid",
      detailAvailable: false,
      publicView: true,
      message: "Token verifikasi tidak valid atau dokumen tidak ditemukan.",
    };
  }

  const includeDetail = actor
    ? canActorUseJlfPermission(actor, JLF_PERMISSION.DOCUMENT_PREVIEW)
    : false;

  await logAction(db, {
    userId: actor?.id,
    action: "verify.access",
    entityType: "jlf_generated_document",
    entityId: row.id,
    nomorPerkara: includeDetail ? row.nomor_perkara : maskNomorPerkara(row.nomor_perkara),
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
    metadata: {
      status: row.status,
      publicView: !includeDetail,
    },
  });

  return mapPublicVerification(row, includeDetail);
}

export const JlfDocumentVerificationService = {
  verifyDocumentToken,
};
