import { type AletaDatabase } from "@/server/db/client";

export async function appendAuditLog(db: AletaDatabase, {
  id,
  actorUserId,
  action,
  entityType,
  entityId,
  payload,
  createdAt,
}: {
  id: string;
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  payload?: unknown;
  createdAt?: string;
}) {
  const timestamp = createdAt ?? new Date().toISOString();

  await db.prepare(
    `INSERT INTO audit_logs (
      id, actor_user_id, action, entity_type, entity_id, payload_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, actorUserId ?? null, action, entityType, entityId, JSON.stringify(payload ?? {}), timestamp);
}
