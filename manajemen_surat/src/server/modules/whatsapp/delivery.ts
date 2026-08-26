import { type QueryResultRow } from "pg";

import { type AletaDatabase, withTransaction } from "@/server/db/client";
import { appendAuditLog } from "@/server/shared/audit";
import { ApiError } from "@/server/shared/errors";
import { nextPrefixedId } from "@/server/shared/ids";
import { getEffectivePositionId } from "@/lib/permissions";
import { requireActorUser } from "@/server/modules/organization/service";
import {
  getAletaBotTemplateBody,
  renderAletaBotMessageTemplate,
} from "@/server/modules/aleta-bot/template-renderer";
import { ensureAletaBotSeeded, getAletaBotSettings } from "@/server/modules/aleta-bot/service";
import { sendPortalWhatsappMessage } from "@/server/modules/whatsapp/portal-whatsapp-sender";
import {
  getGatewayQueueProgress,
  getWhatsappRuntimeMode,
  type GatewayQueueProgress,
} from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { type WhatsAppDeliveryStatus } from "@/lib/types";

type DeliveryScope = "letter" | "disposition";

type DeliveryAttemptResult = {
  deliveryId: string;
  status: WhatsAppDeliveryStatus;
  attemptedAt: string;
  message: string;
  queueId?: string;
};

type DeliveryGatewayUpdate = {
  queueId?: string;
  gatewayStatus?: string;
  gatewayStage?: string;
  gatewayMessageId?: string;
  gatewayError?: string;
  deliveredAt?: string | null;
  readAt?: string | null;
  failedAt?: string | null;
  lastGatewaySyncAt?: string | null;
};

type SyncableDeliveryRow = QueryResultRow & {
  id: string;
  status: WhatsAppDeliveryStatus;
  queue_id?: string | null;
  gateway_status?: string | null;
  gateway_stage?: string | null;
  gateway_message_id?: string | null;
  gateway_error?: string | null;
  delivered_at?: string | null;
  read_at?: string | null;
  failed_at?: string | null;
  last_gateway_sync_at?: string | null;
};

type LetterDeliveryRow = QueryResultRow & {
  letter_id: string;
  delivery_id: string;
  nomor_surat: string;
  perihal: string;
  jenis_surat: string;
  tanggal_surat: string;
  tanggal_terima: string | null;
  tanggal_kirim: string | null;
  pengirim: string;
  asal_surat: string;
  tujuan_surat: string;
  assigned_unit: string;
  ringkasan: string;
  recipient_name: string;
  recipient_whatsapp: string;
};

type DispositionDeliveryRow = QueryResultRow & {
  disposition_id: string;
  surat_id: string;
  delivery_id: string;
  nomor_surat: string;
  perihal: string;
  jenis_surat: string;
  tanggal_surat: string;
  pengirim: string;
  asal_surat: string;
  tujuan_surat: string;
  instruksi: string;
  deadline_at: string | null;
  pengirim_disposisi: string | null;
  recipient_name: string;
  recipient_whatsapp: string;
};

const LETTER_TEMPLATE_ID = "manajemen-surat-baru";
const DISPOSITION_TEMPLATE_ID = "manajemen-surat-disposisi";

function normalizeRecipientNumber(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  if (digits.startsWith("8")) return `62${digits}`;
  return digits;
}

function formatMessageDate(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function labelLetterType(value: string) {
  return value === "masuk" ? "masuk" : "keluar";
}

async function updateDeliveryStatus(
  db: AletaDatabase,
  scope: DeliveryScope,
  deliveryId: string,
  status: WhatsAppDeliveryStatus,
  attemptedAt: string,
  gateway: DeliveryGatewayUpdate = {}
) {
  const tableName =
    scope === "letter" ? "letter_whatsapp_deliveries" : "disposition_whatsapp_deliveries";
  await db.prepare(
    `UPDATE ${tableName}
     SET status = ?,
         last_attempt_at = ?,
         queue_id = COALESCE(?, queue_id),
         gateway_status = ?,
         gateway_stage = ?,
         gateway_message_id = COALESCE(?, gateway_message_id),
         gateway_error = ?,
         delivered_at = COALESCE(?, delivered_at),
         read_at = COALESCE(?, read_at),
         failed_at = COALESCE(?, failed_at),
         last_gateway_sync_at = COALESCE(?, last_gateway_sync_at),
         updated_at = ?
     WHERE id = ?`
  ).run(
    status,
    attemptedAt,
    gateway.queueId?.trim() || null,
    gateway.gatewayStatus ?? "",
    gateway.gatewayStage ?? "",
    gateway.gatewayMessageId?.trim() || null,
    gateway.gatewayError ?? "",
    gateway.deliveredAt ?? null,
    gateway.readAt ?? null,
    gateway.failedAt ?? null,
    gateway.lastGatewaySyncAt ?? null,
    attemptedAt,
    deliveryId
  );
}

function normalizeGatewayStatus(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function mapGatewayStatusToDeliveryStatus(
  progress: GatewayQueueProgress | null | undefined,
  fallback: WhatsAppDeliveryStatus
): WhatsAppDeliveryStatus {
  const status = normalizeGatewayStatus(progress?.status);
  const stage = normalizeGatewayStatus(progress?.stage);

  if (status === "read") return "Dibaca";
  if (status === "sent" || status === "delivered" || status === "success") return "Terkirim";
  if (status === "failed" || status === "dead_letter" || status === "not_found" || stage === "failed") return "Gagal";
  if (status === "pending" || status === "processing" || status === "queued" || status === "sending" || stage === "queued" || stage === "sending") {
    return "Diantrekan";
  }

  return fallback;
}

function buildGatewayUpdate(
  progress: GatewayQueueProgress | null | undefined,
  now: string,
  status: WhatsAppDeliveryStatus,
  queueIdFallback = ""
): DeliveryGatewayUpdate {
  const gatewayStatus = String(progress?.status ?? "").trim();
  const gatewayStage = String(progress?.stage ?? "").trim();
  const failedAt = status === "Gagal" ? (progress?.failedAt ?? progress?.processedAt ?? now) : null;
  const deliveredAt =
    status === "Terkirim" || status === "Dibaca"
      ? (progress?.deliveredAt ?? progress?.processedAt ?? now)
      : null;

  return {
    queueId: String(progress?.queueId ?? queueIdFallback ?? "").trim(),
    gatewayStatus,
    gatewayStage,
    gatewayMessageId: String(progress?.whatsappMessageId ?? "").trim(),
    gatewayError: String(progress?.lastError ?? "").slice(0, 1000),
    deliveredAt,
    readAt: status === "Dibaca" ? (progress?.readAt ?? now) : null,
    failedAt,
    lastGatewaySyncAt: now,
  };
}

function shouldSyncDeliveryRow(row: SyncableDeliveryRow) {
  if (!row.queue_id) return false;
  if (row.status === "Dibaca") return false;
  if (!row.last_gateway_sync_at) return true;
  const lastSync = new Date(row.last_gateway_sync_at).getTime();
  if (!Number.isFinite(lastSync)) return true;
  return Date.now() - lastSync > 30_000;
}

export async function syncWhatsappDeliveryStatuses<T extends SyncableDeliveryRow>(
  db: AletaDatabase,
  scope: DeliveryScope,
  rows: T[]
): Promise<T[]> {
  if (rows.length === 0 || getWhatsappRuntimeMode() !== "aleta_bot") return rows;

  const tableName =
    scope === "letter" ? "letter_whatsapp_deliveries" : "disposition_whatsapp_deliveries";
  const candidates = rows.filter(shouldSyncDeliveryRow).slice(0, 25);
  if (candidates.length === 0) return rows;

  const synced = new Map<string, Partial<T>>();
  for (const row of candidates) {
    const queueId = String(row.queue_id || "").trim();
    const result = await getGatewayQueueProgress(queueId);
    const now = new Date().toISOString();

    if (!result.ok) {
      await db.prepare(
        `UPDATE ${tableName}
         SET gateway_error = ?, last_gateway_sync_at = ?, updated_at = ?
         WHERE id = ?`
      ).run(result.error.slice(0, 1000), now, now, row.id);
      synced.set(row.id, {
        gateway_error: result.error.slice(0, 1000),
        last_gateway_sync_at: now,
      } as Partial<T>);
      continue;
    }

    const progress = result.data.queueProgress;
    const nextStatus = mapGatewayStatusToDeliveryStatus(progress, row.status);
    const update = buildGatewayUpdate(progress, now, nextStatus, queueId);

    await db.prepare(
      `UPDATE ${tableName}
       SET status = ?,
           gateway_status = ?,
           gateway_stage = ?,
           gateway_message_id = COALESCE(?, gateway_message_id),
           gateway_error = ?,
           delivered_at = COALESCE(?, delivered_at),
           read_at = COALESCE(?, read_at),
           failed_at = COALESCE(?, failed_at),
           last_gateway_sync_at = ?,
           updated_at = ?
       WHERE id = ?`
    ).run(
      nextStatus,
      update.gatewayStatus ?? "",
      update.gatewayStage ?? "",
      update.gatewayMessageId?.trim() || null,
      update.gatewayError ?? "",
      update.deliveredAt ?? null,
      update.readAt ?? null,
      update.failedAt ?? null,
      now,
      now,
      row.id
    );

    synced.set(row.id, {
      status: nextStatus,
      gateway_status: update.gatewayStatus ?? "",
      gateway_stage: update.gatewayStage ?? "",
      gateway_message_id: update.gatewayMessageId || row.gateway_message_id || "",
      gateway_error: update.gatewayError ?? "",
      delivered_at: update.deliveredAt ?? row.delivered_at ?? null,
      read_at: update.readAt ?? row.read_at ?? null,
      failed_at: update.failedAt ?? row.failed_at ?? null,
      last_gateway_sync_at: now,
    } as Partial<T>);
  }

  return rows.map((row) => ({ ...row, ...(synced.get(row.id) ?? {}) }));
}

async function attemptDelivery(
  db: AletaDatabase,
  {
    scope,
    deliveryId,
    entityId,
    recipientWhatsapp,
    recipientName,
    message,
    dryRun,
    metadata,
  }: {
    scope: DeliveryScope;
    deliveryId: string;
    entityId: string;
    recipientWhatsapp: string;
    recipientName: string;
    message: string;
    dryRun?: boolean;
    metadata?: Record<string, unknown>;
  }
): Promise<DeliveryAttemptResult> {
  const attemptedAt = new Date().toISOString();
  const normalizedRecipient = normalizeRecipientNumber(recipientWhatsapp);

  if (!normalizedRecipient) {
    await updateDeliveryStatus(db, scope, deliveryId, "Gagal", attemptedAt, {
      gatewayStatus: "invalid_recipient",
      gatewayStage: "failed",
      gatewayError: "Nomor WhatsApp tujuan belum valid.",
      failedAt: attemptedAt,
      lastGatewaySyncAt: attemptedAt,
    });
    return {
      deliveryId,
      status: "Gagal",
      attemptedAt,
      message: "Nomor WhatsApp tujuan belum valid.",
    };
  }

  const result = await sendPortalWhatsappMessage({
    sourceFeature: scope === "letter" ? "letter_notification" : "disposition_notification",
    entityType: scope === "letter" ? "letter" : "disposition",
    entityId,
    eventType: scope === "letter" ? "notifikasi_baru" : "disposisi_baru",
    recipientNumber: normalizedRecipient,
    recipientName,
    message,
    category: "employee",
    priority: scope === "letter" ? 5 : 6,
    dryRun,
    metadata,
  });

  const queueId = String(result.queueId ?? "").trim();
  const progress = result.queueProgress ?? (queueId ? { queueId, status: result.status } : null);
  const enqueueAccepted = result.status === "enqueued" && Boolean(queueId || result.duplicate);
  const directSendAccepted = result.status === "sent";
  const dbStatus: WhatsAppDeliveryStatus =
    result.ok && directSendAccepted
      ? "Terkirim"
      : result.ok && enqueueAccepted
        ? mapGatewayStatusToDeliveryStatus(progress, "Diantrekan")
        : "Gagal";
  const gatewayUpdate = buildGatewayUpdate(progress, attemptedAt, dbStatus, queueId);

  await updateDeliveryStatus(db, scope, deliveryId, dbStatus, attemptedAt, {
    ...gatewayUpdate,
    queueId,
    gatewayStatus: gatewayUpdate.gatewayStatus || result.status || (result.ok ? "accepted" : "failed"),
    gatewayStage:
      gatewayUpdate.gatewayStage ||
      (dbStatus === "Diantrekan" ? "queued" : dbStatus === "Gagal" ? "failed" : "done"),
    gatewayError: result.ok ? gatewayUpdate.gatewayError || "" : result.message,
    failedAt: dbStatus === "Gagal" ? gatewayUpdate.failedAt ?? attemptedAt : gatewayUpdate.failedAt,
    deliveredAt:
      dbStatus === "Terkirim" || dbStatus === "Dibaca"
        ? gatewayUpdate.deliveredAt ?? attemptedAt
        : gatewayUpdate.deliveredAt,
    lastGatewaySyncAt: attemptedAt,
  });

  return {
    deliveryId,
    status: dbStatus,
    attemptedAt,
    message: result.message,
    queueId,
  };
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
      l.tanggal_surat, l.tanggal_terima, l.tanggal_kirim, l.pengirim, l.asal_surat,
      l.tujuan_surat, l.assigned_unit, l.ringkasan,
      d.recipient_name, d.recipient_whatsapp
     FROM letters l
     INNER JOIN letter_whatsapp_deliveries d ON d.letter_id = l.id
     WHERE l.id = ? AND d.id = ? AND l.deleted_at IS NULL AND d.deleted_at IS NULL`
  ).get<LetterDeliveryRow>(letterId, deliveryId);

  if (!row) {
    throw new ApiError(404, "Data notifikasi surat tidak ditemukan.");
  }

  await ensureAletaBotSeeded(db);
  const [templateBody, settings] = await Promise.all([
    getAletaBotTemplateBody(db, LETTER_TEMPLATE_ID),
    getAletaBotSettings(db),
  ]);
  const message = renderAletaBotMessageTemplate(templateBody, {
    recipient_name: row.recipient_name,
    jenis_surat: labelLetterType(row.jenis_surat),
    nomor_surat: row.nomor_surat,
    perihal: row.perihal,
    tanggal_surat: formatMessageDate(row.tanggal_surat),
    tanggal_terima: formatMessageDate(row.tanggal_terima),
    tanggal_kirim: formatMessageDate(row.tanggal_kirim),
    pengirim: row.pengirim,
    asal_surat: row.asal_surat,
    tujuan_surat: row.tujuan_surat,
    unit_tujuan: row.assigned_unit,
    ringkasan: row.ringkasan,
    link_surat: `/surat/${row.letter_id}`,
  });

  return attemptDelivery(db, {
    scope: "letter",
    deliveryId: row.delivery_id,
    entityId: row.letter_id,
    recipientWhatsapp: row.recipient_whatsapp,
    recipientName: row.recipient_name,
    message,
    dryRun: settings.dryRunEnabled,
    metadata: {
      sourceFeature: "letter_notification",
      entityType: "letter",
      entityId: row.letter_id,
      letterId: row.letter_id,
      nomorSurat: row.nomor_surat,
      perihal: row.perihal,
      jenisSurat: row.jenis_surat,
      templateId: LETTER_TEMPLATE_ID,
      recipientType: "employee",
      recipientName: row.recipient_name,
    },
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
    `SELECT dsp.id AS disposition_id, l.id AS surat_id, d.id AS delivery_id, l.nomor_surat,
      l.perihal, l.type AS jenis_surat, l.tanggal_surat, l.pengirim, l.asal_surat,
      l.tujuan_surat, dsp.instruksi, dsp.deadline_at, sender.name AS pengirim_disposisi,
      d.recipient_name, d.recipient_whatsapp
     FROM dispositions dsp
     INNER JOIN letters l ON l.id = dsp.surat_id
     INNER JOIN disposition_whatsapp_deliveries d ON d.disposition_id = dsp.id
     LEFT JOIN users sender ON sender.id = dsp.pengirim_id
     WHERE dsp.id = ? AND d.id = ? AND dsp.deleted_at IS NULL AND l.deleted_at IS NULL AND d.deleted_at IS NULL`
  ).get<DispositionDeliveryRow>(dispositionId, deliveryId);

  if (!row) {
    throw new ApiError(404, "Data notifikasi disposisi tidak ditemukan.");
  }

  await ensureAletaBotSeeded(db);
  const [templateBody, settings] = await Promise.all([
    getAletaBotTemplateBody(db, DISPOSITION_TEMPLATE_ID),
    getAletaBotSettings(db),
  ]);
  const message = renderAletaBotMessageTemplate(templateBody, {
    recipient_name: row.recipient_name,
    nomor_surat: row.nomor_surat,
    perihal: row.perihal,
    instruksi: row.instruksi,
    jenis_surat: labelLetterType(row.jenis_surat),
    tanggal_surat: formatMessageDate(row.tanggal_surat),
    deadline: formatMessageDate(row.deadline_at),
    pengirim: row.pengirim,
    pengirim_disposisi: row.pengirim_disposisi || "",
    asal_surat: row.asal_surat,
    tujuan_surat: row.tujuan_surat,
    link_surat: `/surat/${row.surat_id}`,
  });

  return attemptDelivery(db, {
    scope: "disposition",
    deliveryId: row.delivery_id,
    entityId: row.disposition_id,
    recipientWhatsapp: row.recipient_whatsapp,
    recipientName: row.recipient_name,
    message,
    dryRun: settings.dryRunEnabled,
    metadata: {
      sourceFeature: "disposition_notification",
      entityType: "disposition",
      entityId: row.disposition_id,
      letterId: row.surat_id,
      dispositionId: row.disposition_id,
      suratId: row.surat_id,
      nomorSurat: row.nomor_surat,
      perihal: row.perihal,
      disposisiDari: "ALETA",
      instruksi: row.instruksi,
      templateId: DISPOSITION_TEMPLATE_ID,
      recipientType: "employee",
      recipientName: row.recipient_name,
    },
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

  // Retry hanya boleh dilakukan Admin/Super Admin, atau pengguna yang memang
  // punya kaitan dengan surat/disposisinya (pembuat, penerima, atau jabatan tujuan).
  const isPrivileged = actor.roleId === "super-admin" || actor.roleId === "admin";
  if (!isPrivileged) {
    const positionId = getEffectivePositionId(actor);
    const related =
      scope === "letter"
        ? await db
            .prepare(
              `SELECT l.id FROM letters l
               LEFT JOIN dispositions d ON d.surat_id = l.id AND d.deleted_at IS NULL
               WHERE l.id = ? AND l.deleted_at IS NULL AND (
                 l.created_by_user_id = ? OR l.target_user_id = ? OR l.target_position_id = ?
                 OR d.penerima_id = ? OR d.pengirim_id = ? OR d.target_position_id = ?
               )
               LIMIT 1`
            )
            .get<{ id: string }>(entityId, actor.id, actor.id, positionId, actor.id, actor.id, positionId)
        : await db
            .prepare(
              `SELECT id FROM dispositions
               WHERE id = ? AND deleted_at IS NULL
                 AND (penerima_id = ? OR pengirim_id = ? OR target_position_id = ?)
               LIMIT 1`
            )
            .get<{ id: string }>(entityId, actor.id, actor.id, positionId);

    if (!related) {
      throw new ApiError(403, "Anda tidak memiliki akses untuk mengirim ulang notifikasi WhatsApp ini.");
    }
  }

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
