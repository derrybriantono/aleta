import { isPrivilegedAdmin } from "@/lib/permissions";
import { type AletaDatabase, withTransaction } from "@/server/db/client";
import { requireActorUser } from "@/server/modules/organization/service";
import { ApiError } from "@/server/shared/errors";
import { nextPrefixedId } from "@/server/shared/ids";

export type NotificationReadEntityType = "disposition" | "letter" | "wa_failed" | "feedback" | "approval" | "system_task";

export type NotificationReadItem = {
  entityType: NotificationReadEntityType;
  entityId: string;
  seenAt: string;
};

export type MarkNotificationSeenPayload = {
  items?: Array<{
    entityType?: string;
    entityId?: string;
  }>;
};

type NotificationReadRow = {
  entity_type: string;
  entity_id: string;
  seen_at: string;
};

type DispositionAccessRow = {
  id: string;
  pengirim_id: string;
  penerima_id: string;
  target_position_id: string;
};

type FeedbackAccessRow = {
  id: string;
  reporter_user_id: string;
};

const allowedEntityTypes = new Set<NotificationReadEntityType>([
  "disposition",
  "letter",
  "wa_failed",
  "feedback",
  "approval",
  "system_task",
]);

function normalizeEntityType(value: string | undefined): NotificationReadEntityType {
  if (value && allowedEntityTypes.has(value as NotificationReadEntityType)) {
    return value as NotificationReadEntityType;
  }

  throw new ApiError(400, "Jenis notifikasi tidak valid.");
}

function normalizeEntityId(value: string | undefined) {
  const normalized = value?.trim();
  if (!normalized || normalized.length > 180) {
    throw new ApiError(400, "ID notifikasi tidak valid.");
  }
  return normalized;
}

function mapReadRow(row: NotificationReadRow): NotificationReadItem {
  return {
    entityType: row.entity_type as NotificationReadEntityType,
    entityId: row.entity_id,
    seenAt: row.seen_at,
  };
}

async function assertCanMarkEntitySeen(
  db: AletaDatabase,
  actor: Awaited<ReturnType<typeof requireActorUser>>,
  entityType: NotificationReadEntityType,
  entityId: string
) {
  if (isPrivilegedAdmin(actor)) return;

  if (entityType === "feedback") {
    const row = await db.queryOne<FeedbackAccessRow>(
      `SELECT id, reporter_user_id
       FROM feedback_requests
       WHERE id = ?`,
      [entityId]
    );

    if (!row) {
      throw new ApiError(404, "Masukan tidak ditemukan.");
    }

    if (row.reporter_user_id !== actor.id) {
      throw new ApiError(403, "Anda tidak dapat menandai masukan user lain.");
    }

    return;
  }

  if (entityType === "approval") {
    throw new ApiError(403, "Hanya admin yang dapat menandai persetujuan.");
  }

  if (entityType !== "disposition") {
    return;
  }

  const row = await db.queryOne<DispositionAccessRow>(
    `SELECT id, pengirim_id, penerima_id, target_position_id
     FROM dispositions
     WHERE id = ? AND deleted_at IS NULL`,
    [entityId]
  );

  if (!row) {
    throw new ApiError(404, "Disposisi tidak ditemukan.");
  }

  const effectivePositionId = actor.actingAssignment?.positionId ?? actor.positionId;
  const isRelevant =
    row.penerima_id === actor.id ||
    row.pengirim_id === actor.id ||
    row.target_position_id === effectivePositionId;

  if (!isRelevant) {
    throw new ApiError(403, "Anda tidak dapat menandai notifikasi user lain.");
  }
}

export async function listNotificationReadsFromDb(
  db: AletaDatabase,
  actorUserId: string | null | undefined,
  entityType?: string | null
) {
  const actor = await requireActorUser(db, actorUserId);
  const normalizedType = entityType ? normalizeEntityType(entityType) : null;

  const rows = normalizedType
    ? await db.queryAll<NotificationReadRow>(
        `SELECT entity_type, entity_id, seen_at
         FROM user_notification_reads
         WHERE user_id = ? AND entity_type = ?
         ORDER BY seen_at DESC`,
        [actor.id, normalizedType]
      )
    : await db.queryAll<NotificationReadRow>(
        `SELECT entity_type, entity_id, seen_at
         FROM user_notification_reads
         WHERE user_id = ?
         ORDER BY seen_at DESC`,
        [actor.id]
      );

  return rows.map(mapReadRow);
}

export async function markNotificationReadsSeenInDb(
  db: AletaDatabase,
  actorUserId: string | null | undefined,
  payload: MarkNotificationSeenPayload
) {
  const actor = await requireActorUser(db, actorUserId);
  const rawItems = payload.items ?? [];

  if (rawItems.length === 0) {
    return [];
  }

  const uniqueItems = Array.from(
    new Map(
      rawItems.map((item) => {
        const entityType = normalizeEntityType(item.entityType);
        const entityId = normalizeEntityId(item.entityId);
        return [`${entityType}:${entityId}`, { entityType, entityId }];
      })
    ).values()
  );

  if (uniqueItems.length > 100) {
    throw new ApiError(400, "Terlalu banyak notifikasi untuk ditandai sekaligus.");
  }

  return withTransaction(db, async (tx) => {
    const now = new Date().toISOString();

    for (const item of uniqueItems) {
      await assertCanMarkEntitySeen(tx, actor, item.entityType, item.entityId);
      const id = await nextPrefixedId(tx, "user_notification_reads", "nrd");

      await tx.prepare(
        `INSERT INTO user_notification_reads (
          id, user_id, entity_type, entity_id, seen_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (user_id, entity_type, entity_id)
        DO UPDATE SET seen_at = EXCLUDED.seen_at, updated_at = EXCLUDED.updated_at`
      ).run(id, actor.id, item.entityType, item.entityId, now, now, now);
    }

    return listNotificationReadsFromDb(tx, actor.id, undefined);
  });
}
