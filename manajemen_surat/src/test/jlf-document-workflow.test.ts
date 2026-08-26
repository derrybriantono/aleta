// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { type AletaDatabase, createAletaDatabase } from "@/server/db/client";
import { requireActorUser } from "@/server/modules/organization/service";
import {
  approveDocument,
  finalizeDocument,
  rejectDocument,
  requestChange,
  submitForValidation,
} from "@/server/modules/judicia/legal-form/documents/jlf-document-validation-service";
import { verifyDocumentToken } from "@/server/modules/judicia/legal-form/verification/jlf-document-verification-service";
import { sendJlfWhatsappNotification } from "@/server/modules/judicia/legal-form/whatsapp/jlf-whatsapp-notification-service";
import { listWhatsappNotificationLogs } from "@/server/modules/judicia/legal-form/whatsapp/jlf-whatsapp-log-service";
import { getWhatsappTemplateForEvent } from "@/server/modules/judicia/legal-form/whatsapp/jlf-whatsapp-template-service";

const NOW = "2026-05-24T00:00:00.000Z";

describe("JLF document workflow, verification, and WhatsApp safety", () => {
  let db: AletaDatabase | null = null;
  let oldRuntimeMode: string | undefined;
  let sequence = 0;

  beforeEach(async () => {
    oldRuntimeMode = process.env.WHATSAPP_RUNTIME_MODE;
    process.env.WHATSAPP_RUNTIME_MODE = "disabled";
    db = await createAletaDatabase({ useInMemory: true, seed: true });
    sequence = 0;

    const category = await db.prepare("SELECT id FROM jlf_categories LIMIT 1").get<{ id: string }>();
    expect(category?.id).toBeTruthy();
    await db.prepare(
      `INSERT INTO jlf_templates (
        id, category_id, name, slug, description, document_type, file_type, storage_path,
        original_filename, status, requires_validation, supports_ai, supports_whatsapp_notification,
        created_by, updated_by, created_at, updated_at
      ) VALUES (?, ?, 'Workflow Test Template', 'workflow-test-template', '', 'legal_form', 'rtf', '',
        '', 'active', 1, 0, 1, 'usr-super', 'usr-super', ?, ?)`
    ).run("jlf-workflow-template", category!.id, NOW, NOW);
  });

  afterEach(async () => {
    if (oldRuntimeMode === undefined) {
      delete process.env.WHATSAPP_RUNTIME_MODE;
    } else {
      process.env.WHATSAPP_RUNTIME_MODE = oldRuntimeMode;
    }
    vi.unstubAllGlobals();
    await db?.close();
    db = null;
  });

  async function createDocument(status = "draft") {
    sequence += 1;
    const id = `jlf-workflow-doc-${sequence}`;
    await db!.prepare(
      `INSERT INTO jlf_generated_documents (
        id, template_id, template_version_id, nomor_perkara, sipp_perkara_id, status,
        output_file_path, output_file_type, checksum, verification_token, verification_token_hash,
        generated_by, validated_by, validated_at, finalized_at, metadata, created_at, updated_at
      ) VALUES (?, 'jlf-workflow-template', NULL, '123/Pdt.G/2026/PA.Mks', 'sipp-123', ?,
        'private/jlf/test.rtf', 'rtf', ?, NULL, NULL, 'usr-super', NULL, NULL, NULL, '{}'::jsonb, ?, ?)`
    ).run(id, status, `checksum-${sequence}`, NOW, NOW);
    return id;
  }

  async function readStatus(documentId: string) {
    const row = await db!.prepare("SELECT status FROM jlf_generated_documents WHERE id = ?").get<{ status: string }>(documentId);
    return row?.status;
  }

  it("moves draft/generated documents through submit and approve with validation logs", async () => {
    const actor = await requireActorUser(db!, "usr-super");
    const documentId = await createDocument("generated");

    const submitted = await submitForValidation(db!, actor, documentId, "Mohon validasi");
    expect(submitted.document.status).toBe("waiting_validation");
    expect(await readStatus(documentId)).toBe("waiting_validation");

    const approved = await approveDocument(db!, actor, documentId, "Sesuai");
    expect(approved.document.status).toBe("approved");
    expect(approved.timeline.map((item) => item.action)).toEqual(["submit", "approve"]);
  });

  it("requires comments for reject and request change", async () => {
    const actor = await requireActorUser(db!, "usr-super");
    const rejectId = await createDocument("draft");
    await submitForValidation(db!, actor, rejectId);

    await expect(rejectDocument(db!, actor, rejectId, "")).rejects.toThrow("Komentar wajib diisi");
    await rejectDocument(db!, actor, rejectId, "Belum lengkap");
    expect(await readStatus(rejectId)).toBe("rejected");

    const changeId = await createDocument("generated");
    await submitForValidation(db!, actor, changeId);
    await expect(requestChange(db!, actor, changeId, "")).rejects.toThrow("Komentar wajib diisi");
    await requestChange(db!, actor, changeId, "Perbaiki redaksi");
    expect(await readStatus(changeId)).toBe("change_requested");
  });

  it("finalizes approved documents, stores only token hash, and verifies public token minimally", async () => {
    const actor = await requireActorUser(db!, "usr-super");
    const documentId = await createDocument("generated");
    await submitForValidation(db!, actor, documentId);
    await approveDocument(db!, actor, documentId);

    const finalized = await finalizeDocument(db!, actor, documentId);
    expect(finalized.document.status).toBe("finalized");
    expect(finalized.verificationToken).toBeTruthy();
    expect(finalized.qrPayload?.nomor_perkara_masked).toBe("12***/2026/PA.Mks");

    const tokenRow = await db!.prepare(
      `SELECT verification_token, verification_token_hash
       FROM jlf_generated_documents
       WHERE id = ?`
    ).get<{ verification_token: string | null; verification_token_hash: string | null }>(documentId);
    expect(tokenRow?.verification_token).toBeNull();
    expect(tokenRow?.verification_token_hash).toBeTruthy();

    const valid = await verifyDocumentToken(db!, finalized.verificationToken!);
    expect(valid.valid).toBe(true);
    expect(valid.publicView).toBe(true);
    expect("generatedDocumentId" in valid ? valid.generatedDocumentId : "").toBe("");
    expect("nomorPerkara" in valid ? valid.nomorPerkara : "").toBe("12***/2026/PA.Mks");

    const invalid = await verifyDocumentToken(db!, "invalid-token");
    expect(invalid.valid).toBe(false);
    expect(invalid.status).toBe("invalid");

    await expect(requestChange(db!, actor, documentId, "Tidak boleh")).rejects.toThrow("Dokumen final tidak dapat diubah");
  });

  it("skips WhatsApp when disabled and logs safe previews without sending", async () => {
    const result = await sendJlfWhatsappNotification(db!, {
      eventType: "document_ready",
      recipientPhone: "628123450001",
      relatedEntityType: "jlf_generated_document",
      relatedEntityId: "doc-disabled",
      nomorPerkara: "123/Pdt.G/2026/PA.Mks",
      createdBy: "usr-super",
    });

    expect(result.status).toBe("skipped");
    const logs = await listWhatsappNotificationLogs(db!, { limit: 10 });
    expect(logs[0]?.status).toBe("skipped");
    expect(logs[0]?.messagePreview.toLowerCase()).not.toContain("penggugat");
    expect(logs[0]?.messagePreview).toContain("ALETA");
  });

  it("uses the global ALETA Bot gateway when enabled and records the gateway log", async () => {
    process.env.WHATSAPP_RUNTIME_MODE = "aleta_bot";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ ok: true, queueId: "queue-jlf-1" }), { status: 200 }))
    );
    await db!.prepare("UPDATE jlf_settings SET value = 'true'::jsonb WHERE key = ?").run("jlf.whatsapp.enabled");
    await db!.prepare("UPDATE jlf_settings SET value = 'true'::jsonb WHERE key = ?").run("jlf.whatsapp.send_document_ready_notifications");

    const result = await sendJlfWhatsappNotification(db!, {
      eventType: "document_ready",
      recipientPhone: "628123450001",
      recipientName: "Validator",
      relatedEntityType: "jlf_generated_document",
      relatedEntityId: "doc-enabled",
      nomorPerkara: "123/Pdt.G/2026/PA.Mks",
      createdBy: "usr-super",
      dryRun: true,
    });

    expect(result.status).toBe("enqueued");
    const logs = await listWhatsappNotificationLogs(db!, { status: "enqueued", limit: 10 });
    expect(logs[0]?.gatewayMessageId).toBe("queue-jlf-1");
    expect(logs[0]?.messagePreview).not.toContain("123/Pdt.G/2026/PA.Mks");
    expect(logs[0]?.messagePreview).toContain("/judicia/legal-form/documents/doc-enabled");
  });

  it("keeps default WhatsApp templates free from sensitive case-party wording", async () => {
    const sensitiveTerms = /(penggugat|tergugat|pemohon|termohon|alamat|nik|ktp|password|token|rahasia)/i;
    const template = await getWhatsappTemplateForEvent(db!, "document_waiting_validation");
    expect(template?.messageTemplate).toBeTruthy();
    expect(template?.messageTemplate).not.toMatch(sensitiveTerms);
  });
});
