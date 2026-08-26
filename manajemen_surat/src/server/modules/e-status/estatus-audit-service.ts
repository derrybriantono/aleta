import { createHash } from "node:crypto";

import type { AletaDatabase } from "@/server/db/client";
import { appendAuditLog } from "@/server/shared/audit";
import { nextPrefixedId } from "@/server/shared/ids";

const SENSITIVE_ESTATUS_KEY_PATTERN = /(nik|nomor_kk|kk|password|token|secret|api[_-]?key|authorization|payload|document)/i;

function hashValue(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value ?? {})).digest("hex");
}

function maskSensitiveMetadata(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[truncated]";
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return value.length > 180 ? `${value.slice(0, 180)}...` : value;
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.slice(0, 40).map((item) => maskSensitiveMetadata(item, depth + 1));
  if (typeof value !== "object") return String(value);

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      SENSITIVE_ESTATUS_KEY_PATTERN.test(key) ? "[redacted]" : maskSensitiveMetadata(item, depth + 1),
    ])
  );
}

export async function appendEStatusAuditLog(
  db: AletaDatabase,
  input: {
    userId?: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    oldValue?: unknown;
    newValue?: unknown;
    metadata?: unknown;
    ipAddress?: string;
    userAgent?: string;
    createdAt?: string;
  }
) {
  const timestamp = input.createdAt ?? new Date().toISOString();
  const id = await nextPrefixedId(db, "estatus_audit_logs", "est-aud");
  const sanitizedMetadata = maskSensitiveMetadata(input.metadata ?? {});

  await db.prepare(
    `INSERT INTO estatus_audit_logs (
      id, user_id, action, entity_type, entity_id, old_value_hash, new_value_hash,
      metadata, ip_address, user_agent, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?, ?, ?)`
  ).run(
    id,
    input.userId ?? null,
    input.action,
    input.entityType,
    input.entityId ?? "",
    input.oldValue ? `sha256:${hashValue(input.oldValue)}` : "",
    input.newValue ? `sha256:${hashValue(input.newValue)}` : "",
    JSON.stringify(sanitizedMetadata),
    input.ipAddress ?? "",
    input.userAgent ?? "",
    timestamp
  );

  await appendAuditLog(db, {
    id: await nextPrefixedId(db, "audit_logs", "aud"),
    actorUserId: input.userId,
    action: `ESTATUS_${input.action}`,
    entityType: input.entityType,
    entityId: input.entityId ?? "",
    payload: sanitizedMetadata,
    createdAt: timestamp,
  });

  return id;
}
