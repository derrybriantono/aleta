import type { QueryResultRow } from "pg";

import type { AletaDatabase } from "@/server/db/client";
import type { UserPersona } from "@/lib/types";
import { JLF_PERMISSION } from "@/lib/judicia-legal-form-types";
import { nextPrefixedId } from "@/server/shared/ids";
import { requireJlfPermission } from "@/server/modules/judicia/legal-form/jlf-permission-service";
import { logAction, type JlfAuditMetadata } from "@/server/modules/judicia/legal-form/jlf-audit-log-service";
import { normalizeJlfSettingKey } from "@/server/modules/judicia/legal-form/jlf-validation";

type JlfSettingRow = QueryResultRow & {
  id: string;
  key: string;
  value: unknown;
  description: string;
  updated_by: string | null;
  updated_at: string;
  created_at: string;
};

function mapSettingRow(row: JlfSettingRow) {
  return {
    id: row.id,
    key: row.key,
    value: row.value,
    description: row.description,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
    createdAt: row.created_at,
  };
}

function normalizeSettingId(key: string) {
  return `jlf-setting-${key.replace(/^jlf\./, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase()}`;
}

export async function getSetting(db: AletaDatabase, key: string) {
  const normalizedKey = normalizeJlfSettingKey(key);
  const row = await db.prepare(
    `SELECT id, key, value, description, updated_by, updated_at, created_at
     FROM jlf_settings
     WHERE key = ?`
  ).get<JlfSettingRow>(normalizedKey);

  return row ? mapSettingRow(row) : null;
}

export async function setSetting(
  db: AletaDatabase,
  key: string,
  value: unknown,
  options: { actorUserId?: string | null; description?: string } = {}
) {
  const normalizedKey = normalizeJlfSettingKey(key);
  const id = normalizeSettingId(normalizedKey);
  const now = new Date().toISOString();

  await db.prepare(
    `INSERT INTO jlf_settings (id, key, value, description, updated_by, updated_at, created_at)
     VALUES (?, ?, ?::jsonb, ?, ?, ?, ?)
     ON CONFLICT (key) DO UPDATE SET
       value = EXCLUDED.value,
       description = CASE
         WHEN EXCLUDED.description = '' THEN jlf_settings.description
         ELSE EXCLUDED.description
       END,
       updated_by = EXCLUDED.updated_by,
       updated_at = EXCLUDED.updated_at`
  ).run(
    id,
    normalizedKey,
    JSON.stringify(value),
    options.description ?? "",
    options.actorUserId ?? null,
    now,
    now
  );

  return getSetting(db, normalizedKey);
}

export async function getBooleanSetting(db: AletaDatabase, key: string, fallback = false) {
  const setting = await getSetting(db, key);
  const value = setting?.value;

  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") return value === "true" || value === "1";
  return fallback;
}

export async function getJsonSetting<T>(db: AletaDatabase, key: string, fallback: T): Promise<T> {
  const setting = await getSetting(db, key);
  return setting?.value === undefined || setting.value === null ? fallback : (setting.value as T);
}

export async function listSettingsByPrefix(db: AletaDatabase, prefix: string) {
  const normalizedPrefix = normalizeJlfSettingKey(prefix.endsWith(".") ? `${prefix}x` : prefix).replace(/x$/, "");
  const rows = await db.prepare(
    `SELECT id, key, value, description, updated_by, updated_at, created_at
     FROM jlf_settings
     WHERE key LIKE ?
     ORDER BY key ASC`
  ).all<JlfSettingRow>(`${normalizedPrefix}%`);

  return rows.map(mapSettingRow);
}

export async function updateSettingWithAudit(
  db: AletaDatabase,
  actor: UserPersona,
  input: {
    key: string;
    value: unknown;
    description?: string;
  },
  audit?: JlfAuditMetadata
) {
  requireJlfPermission(actor, JLF_PERMISSION.SETTINGS_MANAGE);

  const previous = await getSetting(db, input.key);
  const setting = await setSetting(db, input.key, input.value, {
    actorUserId: actor.id,
    description: input.description ?? previous?.description,
  });

  await logAction(db, {
    userId: actor.id,
    action: "settings.update",
    entityType: "jlf_settings",
    entityId: input.key,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
    metadata: {
      key: input.key,
      previousValue: previous?.value ?? null,
      nextValue: input.value,
      ...audit?.metadata,
    },
  });

  return setting;
}

export async function ensureDefaultJlfSetting(
  db: AletaDatabase,
  key: string,
  value: unknown,
  description: string
) {
  const existing = await getSetting(db, key);
  if (existing) return existing;

  const id = await nextPrefixedId(db, "jlf_settings", "jlf-setting");
  const now = new Date().toISOString();
  await db.prepare(
    `INSERT INTO jlf_settings (id, key, value, description, updated_at, created_at)
     VALUES (?, ?, ?::jsonb, ?, ?, ?)
     ON CONFLICT (key) DO NOTHING`
  ).run(id, normalizeJlfSettingKey(key), JSON.stringify(value), description, now, now);

  return getSetting(db, key);
}
