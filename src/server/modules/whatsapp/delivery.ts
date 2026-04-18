import { type QueryResultRow } from "pg";

import { type AletaDatabase, withTransaction } from "@/server/db/client";
import { appendAuditLog } from "@/server/shared/audit";
import { ApiError } from "@/server/shared/errors";
import { nextPrefixedId } from "@/server/shared/ids";
import { requireActorUser } from "@/server/modules/organization/service";
import { getWhatsAppSettingsFromDb } from "@/server/modules/settings/service";

type DeliveryScope = "letter" | "disposition";

type DeliveryAttemptResult = {
  deliveryId: string;
  status: "Terkirim" | "Gagal";
  attemptedAt: string;
  message: string;
};

type LetterDeliveryRow = QueryResultRow & {
  letter_id: string;
  delivery_id: string;
  nomor_surat: string;
  perihal: string;
  jenis_surat: string;
  recipient_name: string;
  recipient_whatsapp: string;
};

type DispositionDeliveryRow = QueryResultRow & {
  disposition_id: string;
  delivery_id: string;
  nomor_surat: string;
  perihal: string;
  instruksi: string;
  recipient_name: string;
  recipient_whatsapp: string;
};

function normalizeRecipientNumber(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  if (digits.startsWith("8")) return `62${digits}`;
  return digits;
}

async function updateDeliveryStatus(
  db: AletaDatabase,
  scope: DeliveryScope,
  deliveryId: string,
  status: "Terkirim" | "Gagal",
  attemptedAt: string
) {
  const tableName =
    scope === "letter" ? "letter_whatsapp_deliveries" : "disposition_whatsapp_deliveries";
  await db.prepare(
    `UPDATE ${tableName}
     SET status = ?, last_attempt_at = ?, updated_at = ?
     WHERE id = ?`
  ).run(status, attemptedAt, attemptedAt, deliveryId);
}

async function attemptDelivery(
  db: AletaDatabase,
  {
    scope,
    deliveryId,
    recipientWhatsapp,
    message,
  }: {
    scope: DeliveryScope;
    deliveryId: string;
    recipientWhatsapp: string;
    message: string;
  }
): Promise<DeliveryAttemptResult> {
  const attemptedAt = new Date().toISOString();
  const normalizedRecipient = normalizeRecipientNumber(recipientWhatsapp);
  const settings = await getWhatsAppSettingsFromDb(db);

  if (!normalizedRecipient) {
    await updateDeliveryStatus(db, scope, deliveryId, "Gagal", attemptedAt);
    return {
      deliveryId,
      status: "Gagal",
      attemptedAt,
      message: "Nomor WhatsApp tujuan belum valid.",
    };
  }

  if (settings.status !== "active") {
    await updateDeliveryStatus(db, scope, deliveryId, "Gagal", attemptedAt);
    return {
      deliveryId,
      status: "Gagal",
      attemptedAt,
      message: "WhatsApp Web ALETA belum aktif atau belum siap dipakai mengirim pesan.",
    };
  }

  try {
    const { whatsappService } = await import("@/server/modules/whatsapp/service");
    await whatsappService.sendMessage(normalizedRecipient, message);
    await updateDeliveryStatus(db, scope, deliveryId, "Terkirim", attemptedAt);

    return {
      deliveryId,
      status: "Terkirim",
      attemptedAt,
      message: "Notifikasi WhatsApp berhasil dikirim.",
    };
  } catch (error) {
    await updateDeliveryStatus(db, scope, deliveryId, "Gagal", attemptedAt);
    return {
      deliveryId,
      status: "Gagal",
      attemptedAt,
      message: error instanceof Error ? error.message : "Pengiriman WhatsApp gagal diproses.",
    };
  }
}

export async function sendLetterNotification(
  db: AletaDatabase,
  {
    letterId,
    deliveryId,
  }: {
    letterId: string;
    deliveryId: string;
  }
) {
  const row = await db.prepare(
    `SELECT l.id AS letter_id, d.id AS delivery_id, l.nomor_surat, l.perihal, l.type AS jenis_surat,
      d.recipient_name, d.recipient_whatsapp
     FROM letters l
     INNER JOIN letter_whatsapp_deliveries d ON d.letter_id = l.id
     WHERE l.id = ? AND d.id = ? AND l.deleted_at IS NULL AND d.deleted_at IS NULL`
  ).get<LetterDeliveryRow>(letterId, deliveryId);

  if (!row) {
    throw new ApiError(404, "Data notifikasi surat tidak ditemukan.");
  }

  const message = [
    "ALETA Notification",
    `Surat ${row.jenis_surat === "masuk" ? "masuk" : "keluar"} baru telah tercatat.`,
    `Nomor: ${row.nomor_surat}`,
    `Perihal: ${row.perihal}`,
    `Penerima: ${row.recipient_name}`,
  ].join("\n");

  return attemptDelivery(db, {
    scope: "letter",
    deliveryId: row.delivery_id,
    recipientWhatsapp: row.recipient_whatsapp,
    message,
  });
}

export async function sendDispositionNotification(
  db: AletaDatabase,
  {
    dispositionId,
    deliveryId,
  }: {
    dispositionId: string;
    deliveryId: string;
  }
) {
  const row = await db.prepare(
    `SELECT dsp.id AS disposition_id, d.id AS delivery_id, l.nomor_surat, l.perihal, dsp.instruksi,
      d.recipient_name, d.recipient_whatsapp
     FROM dispositions dsp
     INNER JOIN letters l ON l.id = dsp.surat_id
     INNER JOIN disposition_whatsapp_deliveries d ON d.disposition_id = dsp.id
     WHERE dsp.id = ? AND d.id = ? AND dsp.deleted_at IS NULL AND l.deleted_at IS NULL AND d.deleted_at IS NULL`
  ).get<DispositionDeliveryRow>(dispositionId, deliveryId);

  if (!row) {
    throw new ApiError(404, "Data notifikasi disposisi tidak ditemukan.");
  }

  const message = [
    "ALETA Disposisi",
    `Surat: ${row.nomor_surat}`,
    `Perihal: ${row.perihal}`,
    `Untuk: ${row.recipient_name}`,
    `Instruksi: ${row.instruksi}`,
  ].join("\n");

  return attemptDelivery(db, {
    scope: "disposition",
    deliveryId: row.delivery_id,
    recipientWhatsapp: row.recipient_whatsapp,
    message,
  });
}

export async function retryWhatsAppDeliveryInDb(
  db: AletaDatabase,
  {
    actorUserId,
    scope,
    entityId,
    deliveryId,
  }: {
    actorUserId: string;
    scope: DeliveryScope;
    entityId: string;
    deliveryId: string;
  }
) {
  const actor = await requireActorUser(db, actorUserId);

  return withTransaction(db, async (tx) => {
    const result =
      scope === "letter"
        ? await sendLetterNotification(tx, { letterId: entityId, deliveryId })
        : await sendDispositionNotification(tx, { dispositionId: entityId, deliveryId });

    await appendAuditLog(tx, {
      id: await nextPrefixedId(tx, "audit_logs", "adt"),
      actorUserId: actor.id,
      action: "RETRY_WHATSAPP_DELIVERY",
      entityType: scope === "letter" ? "letter_whatsapp_delivery" : "disposition_whatsapp_delivery",
      entityId: deliveryId,
      payload: {
        scope,
        parentEntityId: entityId,
        status: result.status,
        attemptedAt: result.attemptedAt,
      },
    });

    return result;
  });
}
