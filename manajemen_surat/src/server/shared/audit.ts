import { type AletaDatabase } from "@/server/db/client";

const SENSITIVE_AUDIT_KEY_PATTERN = /(password|passphrase|token|secret|api[_-]?key|otp|session|qr|cookie|authorization)/i;
const SENSITIVE_FIELD_NAME_KEYS = new Set(["column", "columnName", "field", "key", "name"]);
const SENSITIVE_FIELD_VALUE_KEYS = new Set([
  "after",
  "before",
  "currentValue",
  "newValue",
  "oldValue",
  "originalValue",
  "value",
]);
const REDACTED_AUDIT_VALUE = "[redacted]";

function redactSensitiveString(value: string) {
  const truncated = value.length > 1200 ? `${value.slice(0, 1200)}...` : value;
  return truncated.replace(
    /\b(password|passphrase|token|secret|api[_-]?key|otp|session|cookie|authorization)\b\s*[:=]\s*("[^"]*"|'[^']*'|[^\s,;&]+)/gi,
    "$1=[redacted]"
  );
}

function objectReferencesSensitiveField(value: Record<string, unknown>) {
  return Object.entries(value).some(([key, item]) => (
    SENSITIVE_FIELD_NAME_KEYS.has(key) &&
    typeof item === "string" &&
    SENSITIVE_AUDIT_KEY_PATTERN.test(item)
  ));
}

function sanitizeAuditPayload(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[truncated]";
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return redactSensitiveString(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => sanitizeAuditPayload(item, depth + 1));
  if (typeof value !== "object") return String(value);

  const record = value as Record<string, unknown>;
  const hasSensitiveFieldReference = objectReferencesSensitiveField(record);

  return Object.fromEntries(
    Object.entries(record).map(([key, item]) => [
      key,
      SENSITIVE_AUDIT_KEY_PATTERN.test(key) ||
      (hasSensitiveFieldReference && SENSITIVE_FIELD_VALUE_KEYS.has(key))
        ? REDACTED_AUDIT_VALUE
        : sanitizeAuditPayload(item, depth + 1),
    ])
  );
}

function stringifyAuditPayload(payload: unknown) {
  try {
    return JSON.stringify(sanitizeAuditPayload(payload ?? {}));
  } catch {
    return JSON.stringify({ serializationError: true });
  }
}

function normalizeActorUserId(actorUserId?: string | null) {
  const trimmed = actorUserId?.trim();
  return trimmed ? trimmed : null;
}

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
  ).run(id, normalizeActorUserId(actorUserId), action, entityType, entityId, stringifyAuditPayload(payload), timestamp);
}
