import type { QueryResultRow } from "pg";

import { JLF_PERMISSION } from "@/lib/judicia-legal-form-types";
import type { UserPersona } from "@/lib/types";
import type { AletaDatabase } from "@/server/db/client";
import { requireJlfPermission } from "@/server/modules/judicia/legal-form/jlf-permission-service";
import { jlfBadRequest, jlfNotFound } from "@/server/modules/judicia/legal-form/jlf-service-errors";
import { nextPrefixedId } from "@/server/shared/ids";

export const JLF_WHATSAPP_EVENTS = [
  "document_waiting_validation",
  "document_approved",
  "document_rejected",
  "document_change_requested",
  "document_finalized",
  "document_ready",
  "regulation_needs_review",
  "account_link_pending",
  "ai_analysis_completed",
] as const;

export type JlfWhatsappEventType = (typeof JLF_WHATSAPP_EVENTS)[number];

type TemplateRow = QueryResultRow & {
  id: string;
  key: string;
  name: string;
  event_type: string;
  message_template: string;
  is_active: boolean | number;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

const DEFAULT_TEMPLATES: Array<{
  key: string;
  name: string;
  eventType: JlfWhatsappEventType;
  messageTemplate: string;
}> = [
  {
    key: "jlf.document.waiting_validation",
    name: "Dokumen menunggu validasi",
    eventType: "document_waiting_validation",
    messageTemplate:
      "Dokumen menunggu validasi di ALETA Judicia (Legal Form). Silakan login ke ALETA: {{link}}.",
  },
  {
    key: "jlf.document.approved",
    name: "Dokumen disetujui",
    eventType: "document_approved",
    messageTemplate: "Dokumen telah disetujui. Silakan login ke ALETA untuk tindak lanjut: {{link}}.",
  },
  {
    key: "jlf.document.rejected",
    name: "Dokumen ditolak",
    eventType: "document_rejected",
    messageTemplate: "Dokumen ditolak di ALETA Judicia (Legal Form). Silakan login ke ALETA untuk melihat catatan: {{link}}.",
  },
  {
    key: "jlf.document.change_requested",
    name: "Permintaan perubahan dokumen",
    eventType: "document_change_requested",
    messageTemplate: "Ada permintaan perubahan dokumen. Silakan login ke ALETA untuk melihat catatan: {{link}}.",
  },
  {
    key: "jlf.document.finalized",
    name: "Dokumen final",
    eventType: "document_finalized",
    messageTemplate: "Dokumen telah difinalisasi di ALETA Judicia (Legal Form). Silakan login untuk melihat status: {{link}}.",
  },
  {
    key: "jlf.document.ready",
    name: "Dokumen siap",
    eventType: "document_ready",
    messageTemplate: "Dokumen siap ditindaklanjuti di ALETA Judicia (Legal Form). Silakan login ke ALETA: {{link}}.",
  },
  {
    key: "jlf.regulation.needs_review",
    name: "Review peraturan",
    eventType: "regulation_needs_review",
    messageTemplate: "Peraturan baru membutuhkan verifikasi di Legal Knowledge Base. Silakan login ke ALETA: {{link}}.",
  },
  {
    key: "jlf.account.link_pending",
    name: "Account link pending",
    eventType: "account_link_pending",
    messageTemplate: "Ada sinergi akun SIPP yang menunggu persetujuan. Silakan login ke ALETA: {{link}}.",
  },
  {
    key: "jlf.ai.analysis_completed",
    name: "Analisis AI selesai",
    eventType: "ai_analysis_completed",
    messageTemplate: "Analisis AI JLF selesai dibuat sebagai draft bantu. Silakan login ke ALETA untuk meninjau: {{link}}.",
  },
];

function normalizeEventType(value: string): JlfWhatsappEventType {
  const normalized = value.trim() as JlfWhatsappEventType;
  if (!JLF_WHATSAPP_EVENTS.includes(normalized)) {
    jlfBadRequest("Event WhatsApp JLF tidak valid.");
  }
  return normalized;
}

function mapTemplate(row: TemplateRow) {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    eventType: row.event_type as JlfWhatsappEventType,
    messageTemplate: row.message_template,
    isActive: Boolean(row.is_active),
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function sanitizeWhatsappMessageTemplate(value: string) {
  const text = value.trim().replace(/\s+/g, " ");
  if (!text) jlfBadRequest("Template pesan wajib diisi.");
  if (text.length > 600) jlfBadRequest("Template pesan maksimal 600 karakter.");
  const risky = /(penggugat|tergugat|pemohon|termohon|alamat|nik|ktp|password|token|rahasia)/i;
  if (risky.test(text)) {
    jlfBadRequest("Template pesan tidak boleh memuat detail perkara atau data pribadi sensitif.");
  }
  return text;
}

export async function ensureDefaultWhatsappTemplates(db: AletaDatabase) {
  const now = new Date().toISOString();
  for (const template of DEFAULT_TEMPLATES) {
    const id = `jlf-wa-template-${template.eventType.replace(/_/g, "-")}`;
    await db.prepare(
      `INSERT INTO jlf_whatsapp_notification_templates (
        id, key, name, event_type, message_template, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 1, ?, ?)
      ON CONFLICT (key) DO NOTHING`
    ).run(id, template.key, template.name, template.eventType, template.messageTemplate, now, now);
  }
}

export async function listWhatsappTemplates(db: AletaDatabase, actor: UserPersona) {
  requireJlfPermission(actor, JLF_PERMISSION.WHATSAPP_VIEW);
  await ensureDefaultWhatsappTemplates(db);
  const rows = await db.prepare(
    `SELECT id, key, name, event_type, message_template, is_active, created_by, updated_by, created_at, updated_at
     FROM jlf_whatsapp_notification_templates
     ORDER BY event_type ASC, name ASC`
  ).all<TemplateRow>();
  return rows.map(mapTemplate);
}

export async function getWhatsappTemplateForEvent(db: AletaDatabase, eventType: JlfWhatsappEventType) {
  await ensureDefaultWhatsappTemplates(db);
  const row = await db.prepare(
    `SELECT id, key, name, event_type, message_template, is_active, created_by, updated_by, created_at, updated_at
     FROM jlf_whatsapp_notification_templates
     WHERE event_type = ? AND is_active = 1
     ORDER BY updated_at DESC
     LIMIT 1`
  ).get<TemplateRow>(eventType);
  return row ? mapTemplate(row) : null;
}

export async function createWhatsappTemplate(
  db: AletaDatabase,
  actor: UserPersona,
  input: { key: string; name: string; eventType: string; messageTemplate: string; isActive?: boolean }
) {
  requireJlfPermission(actor, JLF_PERMISSION.WHATSAPP_MANAGE);
  const eventType = normalizeEventType(input.eventType);
  const key = input.key.trim().toLowerCase();
  if (!/^jlf\.[a-z0-9_.-]+$/.test(key)) jlfBadRequest("Key template WhatsApp JLF tidak valid.");
  const name = input.name.trim();
  if (!name) jlfBadRequest("Nama template WhatsApp wajib diisi.");

  const id = await nextPrefixedId(db, "jlf_whatsapp_notification_templates", "jlf-wa-template");
  const now = new Date().toISOString();
  await db.prepare(
    `INSERT INTO jlf_whatsapp_notification_templates (
      id, key, name, event_type, message_template, is_active, created_by, updated_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    key,
    name,
    eventType,
    sanitizeWhatsappMessageTemplate(input.messageTemplate),
    input.isActive === false ? 0 : 1,
    actor.id,
    actor.id,
    now,
    now
  );

  return (await listWhatsappTemplates(db, actor)).find((item) => item.id === id) ?? null;
}

export async function updateWhatsappTemplate(
  db: AletaDatabase,
  actor: UserPersona,
  input: { id: string; name?: string; messageTemplate?: string; isActive?: boolean }
) {
  requireJlfPermission(actor, JLF_PERMISSION.WHATSAPP_MANAGE);
  const existing = await db.prepare("SELECT id FROM jlf_whatsapp_notification_templates WHERE id = ?").get<{ id: string }>(input.id);
  if (!existing) jlfNotFound("Template WhatsApp JLF tidak ditemukan.");

  await db.prepare(
    `UPDATE jlf_whatsapp_notification_templates
     SET name = COALESCE(?, name),
         message_template = COALESCE(?, message_template),
         is_active = COALESCE(?, is_active),
         updated_by = ?,
         updated_at = ?
     WHERE id = ?`
  ).run(
    input.name?.trim() || null,
    input.messageTemplate ? sanitizeWhatsappMessageTemplate(input.messageTemplate) : null,
    input.isActive === undefined ? null : input.isActive ? 1 : 0,
    actor.id,
    new Date().toISOString(),
    input.id
  );

  return (await listWhatsappTemplates(db, actor)).find((item) => item.id === input.id) ?? null;
}

export function renderWhatsappTemplate(template: string, variables: Record<string, string>) {
  let message = template;
  for (const [key, value] of Object.entries(variables)) {
    message = message.split(`{{${key}}}`).join(value);
  }
  return sanitizeWhatsappMessageTemplate(message);
}

export const JlfWhatsappTemplateService = {
  ensureDefaultWhatsappTemplates,
  listWhatsappTemplates,
  getWhatsappTemplateForEvent,
  createWhatsappTemplate,
  updateWhatsappTemplate,
  renderWhatsappTemplate,
};
