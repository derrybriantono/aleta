import { type QueryResultRow } from "pg";

import { canUserForwardToLeadership, isPrivilegedAdmin } from "@/lib/permissions";
import { type DispositionNode } from "@/lib/types";
import { sendDispositionNotification } from "@/server/modules/whatsapp/delivery";
import { type AletaDatabase, withTransaction } from "@/server/db/client";
import { appendAuditLog } from "@/server/shared/audit";
import { ApiError } from "@/server/shared/errors";
import { nextPrefixedId } from "@/server/shared/ids";
import { toBooleanInt } from "@/server/shared/json";
import {
  getLeadershipRecipientsFromDb,
  requireActorUser,
  resolveTargetRecipientFromDb,
} from "@/server/modules/organization/service";

type DispositionRow = QueryResultRow & {
  id: string;
  surat_id: string;
  pengirim_id: string;
  penerima_id: string;
  target_position_id: string;
  instruksi: string;
  parent_disposition_id: string | null;
  status: string;
  allow_download: number;
  approval_qr_code: string;
  created_at: string;
  urgent: number;
  bypass: number;
  routing_type: string;
  follow_up_note: string | null;
  follow_up_file_name: string | null;
};

type DeliveryRow = QueryResultRow & {
  id: string;
  disposition_id: string;
  recipient_name: string;
  recipient_whatsapp: string;
  status: "Terkirim" | "Gagal";
  last_attempt_at: string;
};

export type CreateDispositionRequest = {
  actorUserId: string;
  suratId: string;
  parentDispositionId: string | null;
  targetPositionId: string;
  penerimaId?: string | null;
  instruksi: string;
  allowDownload: boolean;
  urgent: boolean;
  bypass: boolean;
  routingType?: "standard" | "leadership-notification";
};

export type CompleteDispositionRequest = {
  actorUserId: string;
  dispositionId: string;
  note: string;
  fileName: string;
};

export type StartDispositionRequest = {
  actorUserId: string;
  dispositionId: string;
};

async function hydrateDispositions(db: AletaDatabase, rows: DispositionRow[]) {
  if (rows.length === 0) return [];

  const ids = rows.map((row) => row.id);
  const params = ids.map(() => "?").join(", ");
  const deliveries = await db.prepare(
    `SELECT id, disposition_id, recipient_name, recipient_whatsapp, status, last_attempt_at
     FROM disposition_whatsapp_deliveries
     WHERE deleted_at IS NULL AND disposition_id IN (${params})
     ORDER BY last_attempt_at ASC`
  ).all<DeliveryRow>(...ids);
  const deliveryMap = deliveries.reduce<Map<string, DispositionNode["whatsappDeliveries"]>>((map, row) => {
    map.set(row.disposition_id, [
      ...(map.get(row.disposition_id) ?? []),
      {
        id: row.id,
        recipientName: row.recipient_name,
        recipientWhatsapp: row.recipient_whatsapp,
        status: row.status,
        lastAttemptAt: row.last_attempt_at,
      },
    ]);
    return map;
  }, new Map());

  return rows.map<DispositionNode>((row) => ({
    id: row.id,
    suratId: row.surat_id,
    pengirimId: row.pengirim_id,
    penerimaId: row.penerima_id,
    targetPositionId: row.target_position_id,
    instruksi: row.instruksi,
    parentDispositionId: row.parent_disposition_id,
    status: row.status as DispositionNode["status"],
    allowDownload: Boolean(row.allow_download),
    approvalQrCode: row.approval_qr_code,
    createdAt: row.created_at,
    urgent: Boolean(row.urgent),
    bypass: Boolean(row.bypass),
    routingType: row.routing_type as DispositionNode["routingType"],
    followUpNote: row.follow_up_note ?? undefined,
    followUpFileName: row.follow_up_file_name ?? undefined,
    whatsappDeliveries: deliveryMap.get(row.id) ?? [],
  }));
}

export async function getDispositionByIdFromDb(db: AletaDatabase, dispositionId: string) {
  const row = await db.prepare(
    `SELECT *
     FROM dispositions
     WHERE id = ? AND deleted_at IS NULL`
  ).get<DispositionRow>(dispositionId);

  return row ? (await hydrateDispositions(db, [row]))[0] ?? null : null;
}

export async function getDispositionsByLetterIdFromDb(db: AletaDatabase, suratId: string) {
  const rows = await db.prepare(
    `SELECT *
     FROM dispositions
     WHERE surat_id = ? AND deleted_at IS NULL
     ORDER BY created_at ASC`
  ).all<DispositionRow>(suratId);

  return hydrateDispositions(db, rows);
}

export async function listDispositionsFromDb(db: AletaDatabase) {
  const rows = await db.prepare(
    `SELECT *
     FROM dispositions
     WHERE deleted_at IS NULL
     ORDER BY created_at ASC`
  ).all<DispositionRow>();

  return hydrateDispositions(db, rows);
}

export async function createDispositionInDb(db: AletaDatabase, input: CreateDispositionRequest) {
  const actor = await requireActorUser(db, input.actorUserId);
  const parent = input.parentDispositionId
    ? await getDispositionByIdFromDb(db, input.parentDispositionId)
    : null;

  if (!input.instruksi.trim()) {
    throw new ApiError(400, "Instruksi disposisi wajib diisi.");
  }

  if (parent && !isPrivilegedAdmin(actor) && parent.penerimaId !== actor.id) {
    throw new ApiError(403, "Hanya penerima aktif atau admin yang dapat meneruskan disposisi ini.");
  }

  const recipient = await resolveTargetRecipientFromDb(db, {
    targetPositionId: input.targetPositionId,
    targetUserId: input.penerimaId,
  });

  return withTransaction(db, async (tx) => {
    const now = new Date().toISOString();
    const dispositionId = await nextPrefixedId(tx, "dispositions", "dsp");
    const deliveryId = await nextPrefixedId(tx, "disposition_whatsapp_deliveries", "wa-dsp");

    await tx.prepare(
      `INSERT INTO dispositions (
        id, surat_id, pengirim_id, penerima_id, target_position_id, instruksi,
        parent_disposition_id, status, allow_download, approval_qr_code, created_at,
        urgent, bypass, routing_type, follow_up_note, follow_up_file_name, deleted_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      dispositionId,
      input.suratId,
      actor.id,
      recipient.id,
      input.targetPositionId,
      input.instruksi.trim(),
      input.parentDispositionId,
      "Menunggu Tindak Lanjut",
      toBooleanInt(input.allowDownload),
      `QR-${dispositionId.toUpperCase()}`,
      now,
      toBooleanInt(input.urgent),
      toBooleanInt(input.bypass),
      input.routingType ?? "standard",
      null,
      null,
      null,
      now
    );

    await tx.prepare(
      `INSERT INTO disposition_whatsapp_deliveries (
        id, disposition_id, recipient_name, recipient_whatsapp, status, last_attempt_at,
        deleted_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      deliveryId,
      dispositionId,
      recipient.name,
      recipient.whatsappNumber,
      "Terkirim",
      now,
      null,
      now,
      now
    );

    await sendDispositionNotification(tx, {
      dispositionId,
      deliveryId,
    });

    if (input.parentDispositionId) {
      await tx.prepare(
        `UPDATE dispositions
         SET status = 'Diteruskan', updated_at = ?
         WHERE id = ? AND deleted_at IS NULL`
      ).run(now, input.parentDispositionId);
    }

    await tx.prepare(
      `UPDATE letters
       SET status = 'Dalam Disposisi', current_disposition_id = ?, viewer_mode = ?, updated_at = ?
       WHERE id = ?`
    ).run(dispositionId, input.allowDownload ? "download" : "preview", now, input.suratId);

    await appendAuditLog(tx, {
      id: await nextPrefixedId(tx, "audit_logs", "adt"),
      actorUserId: actor.id,
      action: "CREATE_DISPOSITION",
      entityType: "disposition",
      entityId: dispositionId,
      payload: {
        suratId: input.suratId,
        parentDispositionId: input.parentDispositionId,
        recipientId: recipient.id,
        targetPositionId: input.targetPositionId,
      },
    });

    return getDispositionByIdFromDb(tx, dispositionId);
  });
}

export async function startDispositionInDb(db: AletaDatabase, input: StartDispositionRequest) {
  const actor = await requireActorUser(db, input.actorUserId);
  const disposition = await getDispositionByIdFromDb(db, input.dispositionId);

  if (!disposition) {
    throw new ApiError(404, "Node disposisi tidak ditemukan.");
  }

  if (!isPrivilegedAdmin(actor) && disposition.penerimaId !== actor.id) {
    throw new ApiError(403, "Hanya penerima aktif atau admin yang dapat memulai disposisi ini.");
  }

  if (disposition.status !== "Menunggu Tindak Lanjut") {
    throw new ApiError(400, "Disposisi hanya dapat dimulai dari status Menunggu Tindak Lanjut.");
  }

  const now = new Date().toISOString();
  await db.prepare(
    `UPDATE dispositions SET status = 'Sedang Dikerjakan', updated_at = ? WHERE id = ?`
  ).run(now, input.dispositionId);

  return getDispositionByIdFromDb(db, input.dispositionId);
}

export async function completeDispositionInDb(db: AletaDatabase, input: CompleteDispositionRequest) {
  const actor = await requireActorUser(db, input.actorUserId);
  const disposition = await getDispositionByIdFromDb(db, input.dispositionId);

  if (!disposition) {
    throw new ApiError(404, "Node disposisi tidak ditemukan.");
  }

  if (!isPrivilegedAdmin(actor) && disposition.penerimaId !== actor.id) {
    throw new ApiError(403, "Hanya penerima aktif atau admin yang dapat menutup disposisi.");
  }

  if (!input.note.trim()) {
    throw new ApiError(400, "Catatan tindak lanjut wajib diisi.");
  }

  return withTransaction(db, async (tx) => {
    const now = new Date().toISOString();

    await tx.prepare(
      `UPDATE dispositions
       SET status = 'Selesai', follow_up_note = ?, follow_up_file_name = ?, updated_at = ?
       WHERE id = ?`
    ).run(input.note.trim(), input.fileName.trim() || null, now, input.dispositionId);

    // Letter becomes Selesai only when ALL standard leaf nodes (no standard children) are Selesai.
    // Leadership-notification nodes do not count toward completion.
    const pendingLeafCount = await tx.prepare(
      `SELECT COUNT(*) AS cnt
       FROM dispositions
       WHERE surat_id = ?
         AND deleted_at IS NULL
         AND routing_type = 'standard'
         AND status != 'Selesai'
         AND id NOT IN (
           SELECT DISTINCT parent_disposition_id
           FROM dispositions
           WHERE surat_id = ?
             AND deleted_at IS NULL
             AND routing_type = 'standard'
             AND parent_disposition_id IS NOT NULL
         )`
    ).get<{ cnt: number }>(disposition.suratId, disposition.suratId);

    if ((pendingLeafCount?.cnt ?? 1) === 0) {
      await tx.prepare(
        `UPDATE letters
         SET status = 'Selesai', updated_at = ?
         WHERE id = ?`
      ).run(now, disposition.suratId);
    }

    await appendAuditLog(tx, {
      id: await nextPrefixedId(tx, "audit_logs", "adt"),
      actorUserId: actor.id,
      action: "COMPLETE_DISPOSITION",
      entityType: "disposition",
      entityId: input.dispositionId,
      payload: {
        suratId: disposition.suratId,
        fileName: input.fileName,
      },
    });

    return getDispositionByIdFromDb(tx, input.dispositionId);
  });
}

export async function forwardLetterToLeadershipInDb(
  db: AletaDatabase,
  {
    actorUserId,
    suratId,
  }: {
    actorUserId: string;
    suratId: string;
  }
) {
  const actor = await requireActorUser(db, actorUserId);

  if (!canUserForwardToLeadership(actor)) {
    throw new ApiError(403, "Role aktif tidak memiliki akses untuk meneruskan surat ke pimpinan.");
  }

  const letter = await db.prepare(
    "SELECT id, current_disposition_id FROM letters WHERE id = ? AND deleted_at IS NULL"
  ).get<{ id: string; current_disposition_id: string | null }>(suratId);

  if (!letter) {
    throw new ApiError(404, "Surat tidak ditemukan.");
  }

  const currentDisposition = letter.current_disposition_id
    ? await getDispositionByIdFromDb(db, letter.current_disposition_id)
    : null;
  const leadershipRecipients = (await getLeadershipRecipientsFromDb(db)).filter(
    (recipient) => recipient.id !== actor.id
  );
  const existingLeadershipRecipientIds = new Set(
    (
      await db.prepare(
        `SELECT penerima_id
         FROM dispositions
         WHERE surat_id = ? AND routing_type = 'leadership-notification' AND status <> 'Selesai' AND deleted_at IS NULL`
      ).all<{ penerima_id: string }>(suratId)
    ).map((row) => row.penerima_id)
  );
  const recipientsToNotify = leadershipRecipients.filter(
    (recipient) => !existingLeadershipRecipientIds.has(recipient.id)
  );

  if (recipientsToNotify.length === 0) {
    throw new ApiError(400, "Tidak ada pimpinan tambahan yang perlu diberi notifikasi saat ini.");
  }

  return withTransaction(db, async (tx) => {
    const now = new Date().toISOString();
    let lastDispositionId = currentDisposition?.id ?? "";

    for (const recipient of recipientsToNotify) {
      const dispositionId = await nextPrefixedId(tx, "dispositions", "dsp");
      const deliveryId = await nextPrefixedId(tx, "disposition_whatsapp_deliveries", "wa-dsp");

      await tx.prepare(
        `INSERT INTO dispositions (
          id, surat_id, pengirim_id, penerima_id, target_position_id, instruksi,
          parent_disposition_id, status, allow_download, approval_qr_code, created_at,
          urgent, bypass, routing_type, follow_up_note, follow_up_file_name, deleted_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        dispositionId,
        suratId,
        actor.id,
        recipient.id,
        recipient.actingAssignment?.positionId ?? recipient.positionId,
        "Notifikasi cepat: surat masuk menunggu arahan pimpinan untuk disposisi lanjutan.",
        currentDisposition?.id ?? null,
        "Menunggu Tindak Lanjut",
        0,
        `QR-${dispositionId.toUpperCase()}`,
        now,
        1,
        0,
        "leadership-notification",
        null,
        null,
        null,
        now
      );

      await tx.prepare(
        `INSERT INTO disposition_whatsapp_deliveries (
          id, disposition_id, recipient_name, recipient_whatsapp, status, last_attempt_at,
          deleted_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        deliveryId,
        dispositionId,
        recipient.name,
        recipient.whatsappNumber,
        "Terkirim",
        now,
        null,
        now,
        now
      );

      await sendDispositionNotification(tx, {
        dispositionId,
        deliveryId,
      });

      lastDispositionId = dispositionId;
    }

    if (currentDisposition) {
      await tx.prepare(
        `UPDATE dispositions
         SET status = 'Diteruskan', updated_at = ?
         WHERE id = ?`
      ).run(now, currentDisposition.id);
    }

    await tx.prepare(
      `UPDATE letters
       SET status = 'Dalam Disposisi', current_disposition_id = ?, updated_at = ?
       WHERE id = ?`
    ).run(lastDispositionId, now, suratId);

    await appendAuditLog(tx, {
      id: await nextPrefixedId(tx, "audit_logs", "adt"),
      actorUserId: actor.id,
      action: "FORWARD_TO_LEADERSHIP",
      entityType: "letter",
      entityId: suratId,
      payload: {
        currentDispositionId: currentDisposition?.id ?? null,
        recipientIds: recipientsToNotify.map((recipient) => recipient.id),
      },
    });

    const allDispositions = await getDispositionsByLetterIdFromDb(tx, suratId);
    return allDispositions.filter((item) => item.routingType === "leadership-notification");
  });
}
