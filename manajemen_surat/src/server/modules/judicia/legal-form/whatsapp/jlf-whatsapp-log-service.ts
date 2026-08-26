import type { QueryResultRow } from "pg";

import type { AletaDatabase } from "@/server/db/client";
import { logWhatsappEvent } from "@/server/modules/judicia/legal-form/jlf-audit-log-service";
import { nextPrefixedId } from "@/server/shared/ids";

type WhatsappLogRow = QueryResultRow & {
  id: string;
  event_type: string;
  recipient_user_id: string | null;
  recipient_phone_masked: string;
  related_entity_type: string;
  related_entity_id: string;
  nomor_perkara: string;
  message_preview: string;
  status: string;
  gateway_provider: string;
  gateway_message_id: string;
  error_message: string | null;
  created_by: string | null;
  created_at: string;
};

export function maskPhoneNumber(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length <= 6) return digits ? "***" : "";
  return `${digits.slice(0, 4)}****${digits.slice(-3)}`;
}

function mapWhatsappLog(row: WhatsappLogRow) {
  return {
    id: row.id,
    eventType: row.event_type,
    recipientUserId: row.recipient_user_id,
    recipientPhoneMasked: row.recipient_phone_masked,
    relatedEntityType: row.related_entity_type,
    relatedEntityId: row.related_entity_id,
    nomorPerkara: row.nomor_perkara,
    messagePreview: row.message_preview,
    status: row.status,
    gatewayProvider: row.gateway_provider,
    gatewayMessageId: row.gateway_message_id,
    errorMessage: row.error_message,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

export async function createWhatsappNotificationLog(
  db: AletaDatabase,
  input: {
    eventType: string;
    recipientUserId?: string | null;
    recipientPhone?: string | null;
    relatedEntityType?: string;
    relatedEntityId?: string;
    nomorPerkara?: string;
    messagePreview?: string;
    status: string;
    gatewayProvider?: string;
    gatewayMessageId?: string;
    errorMessage?: string | null;
    createdBy?: string | null;
  }
) {
  const id = await nextPrefixedId(db, "jlf_whatsapp_notification_logs", "jlf-wa-log");
  const now = new Date().toISOString();
  await db.prepare(
    `INSERT INTO jlf_whatsapp_notification_logs (
      id, event_type, recipient_user_id, recipient_phone_masked, related_entity_type,
      related_entity_id, nomor_perkara, message_preview, status, gateway_provider,
      gateway_message_id, error_message, created_by, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.eventType,
    input.recipientUserId ?? null,
    maskPhoneNumber(input.recipientPhone ?? ""),
    input.relatedEntityType ?? "",
    input.relatedEntityId ?? "",
    input.nomorPerkara ?? "",
    (input.messagePreview ?? "").slice(0, 500),
    input.status,
    input.gatewayProvider ?? "aleta_bot",
    input.gatewayMessageId ?? "",
    input.errorMessage ?? null,
    input.createdBy ?? null,
    now
  );

  await logWhatsappEvent(db, {
    userId: input.createdBy,
    action: input.status === "sent" || input.status === "enqueued" ? "whatsapp.send" : `whatsapp.${input.status}`,
    entityId: id,
    nomorPerkara: input.nomorPerkara,
    metadata: {
      eventType: input.eventType,
      relatedEntityType: input.relatedEntityType ?? "",
      relatedEntityId: input.relatedEntityId ?? "",
    },
  });

  return { id, createdAt: now };
}

export async function listWhatsappNotificationLogs(
  db: AletaDatabase,
  filters: { eventType?: string; status?: string; relatedEntityId?: string; limit?: number } = {}
) {
  const where: string[] = [];
  const params: Array<string | number> = [];

  if (filters.eventType) {
    where.push("event_type = ?");
    params.push(filters.eventType);
  }
  if (filters.status) {
    where.push("status = ?");
    params.push(filters.status);
  }
  if (filters.relatedEntityId) {
    where.push("related_entity_id = ?");
    params.push(filters.relatedEntityId);
  }

  params.push(Math.max(1, Math.min(200, filters.limit ?? 100)));
  const rows = await db.prepare(
    `SELECT id, event_type, recipient_user_id, recipient_phone_masked, related_entity_type,
       related_entity_id, nomor_perkara, message_preview, status, gateway_provider,
       gateway_message_id, error_message, created_by, created_at
     FROM jlf_whatsapp_notification_logs
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY created_at DESC
     LIMIT ?`
  ).all<WhatsappLogRow>(...params);

  return rows.map(mapWhatsappLog);
}

export const JlfWhatsappLogService = {
  createWhatsappNotificationLog,
  listWhatsappNotificationLogs,
  maskPhoneNumber,
};
