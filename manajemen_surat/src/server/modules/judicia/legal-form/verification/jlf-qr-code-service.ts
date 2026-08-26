import { createHash, randomBytes } from "node:crypto";

import type { AletaDatabase } from "@/server/db/client";

export function createVerificationToken() {
  return randomBytes(32).toString("base64url");
}

export function hashVerificationToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function maskNomorPerkara(nomorPerkara: string) {
  const normalized = nomorPerkara.trim();
  if (!normalized) return "";
  const [register, ...rest] = normalized.split("/");
  const year = rest.find((part) => /^\d{4}$/.test(part));
  const suffix = rest.slice(-1)[0];
  const maskedRegister = register.length > 2 ? `${register.slice(0, 2)}***` : "***";
  return [maskedRegister, year, suffix].filter(Boolean).join("/");
}

export async function ensureDocumentVerificationToken(
  db: AletaDatabase,
  documentId: string
) {
  const existing = await db.prepare(
    `SELECT verification_token_hash
     FROM jlf_generated_documents
     WHERE id = ?`
  ).get<{ verification_token_hash: string | null }>(documentId);

  if (existing?.verification_token_hash) {
    return { token: null as string | null, tokenHash: existing.verification_token_hash, created: false };
  }

  const token = createVerificationToken();
  const tokenHash = hashVerificationToken(token);
  await db.prepare(
    `UPDATE jlf_generated_documents
     SET verification_token = NULL, verification_token_hash = ?, updated_at = ?
     WHERE id = ?`
  ).run(tokenHash, new Date().toISOString(), documentId);

  return { token, tokenHash, created: true };
}

export function buildQrVerificationPayload(input: {
  generatedDocumentId: string;
  nomorPerkara: string;
  templateId: string;
  generatedAt: string;
  verificationToken: string;
  checksum?: string;
  baseUrl?: string;
}) {
  const verificationPath = `/judicia/legal-form/verify/${encodeURIComponent(input.verificationToken)}`;
  return {
    type: "jlf_document_verification",
    generated_document_id: input.generatedDocumentId,
    nomor_perkara_masked: maskNomorPerkara(input.nomorPerkara),
    template_id: input.templateId,
    timestamp_generate: input.generatedAt,
    verification_token: input.verificationToken,
    checksum: input.checksum ?? "",
    url: input.baseUrl ? `${input.baseUrl.replace(/\/$/, "")}${verificationPath}` : verificationPath,
  };
}

export const JlfQrCodeService = {
  createVerificationToken,
  hashVerificationToken,
  maskNomorPerkara,
  ensureDocumentVerificationToken,
  buildQrVerificationPayload,
};
