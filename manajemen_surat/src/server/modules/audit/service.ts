import { type QueryResultRow } from "pg";

import { type AletaDatabase } from "@/server/db/client";
import { requireActorUser } from "@/server/modules/organization/service";
import { ApiError } from "@/server/shared/errors";

type AuditLogRow = QueryResultRow & {
  id: string;
  actor_user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  payload_json: string | null;
  created_at: string;
  actor_name: string | null;
  actor_role_id: string | null;
};

export type AuditLogEntry = {
  id: string;
  actorUserId: string | null;
  actorName: string;
  actorRoleId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

function parsePayload(payloadJson: string | null) {
  if (!payloadJson) {
    return {};
  }

  try {
    const parsed = JSON.parse(payloadJson) as Record<string, unknown>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function mapAuditRow(row: AuditLogRow): AuditLogEntry {
  return {
    id: row.id,
    actorUserId: row.actor_user_id,
    actorName: row.actor_name ?? "System",
    actorRoleId: row.actor_role_id,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    payload: parsePayload(row.payload_json),
    createdAt: row.created_at,
  };
}

export async function listAuditLogsFromDb(
  db: AletaDatabase,
  {
    actorUserId,
    limit = 200,
  }: {
    actorUserId: string;
    limit?: number;
  }
) {
  const actor = await requireActorUser(db, actorUserId);

  if (actor.roleId !== "super-admin") {
    throw new ApiError(403, "Hanya Super Admin yang dapat melihat audit trail.");
  }

  const safeLimit = Math.max(1, Math.min(limit, 500));
  const rows = await db.prepare(
    `SELECT
      audit_logs.id,
      audit_logs.actor_user_id,
      audit_logs.action,
      audit_logs.entity_type,
      audit_logs.entity_id,
      audit_logs.payload_json,
      audit_logs.created_at,
      users.name AS actor_name,
      users.role_id AS actor_role_id
     FROM audit_logs
     LEFT JOIN users ON users.id = audit_logs.actor_user_id
     ORDER BY audit_logs.created_at DESC
     LIMIT ?`
  ).all<AuditLogRow>(safeLimit);

  return rows.map(mapAuditRow);
}
