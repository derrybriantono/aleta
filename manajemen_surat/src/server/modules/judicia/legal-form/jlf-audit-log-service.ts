import type { QueryResultRow } from "pg";

import { JLF_PERMISSION } from "@/lib/judicia-legal-form-types";
import type { UserPersona } from "@/lib/types";
import type { AletaDatabase } from "@/server/db/client";
import { requireJlfPermission } from "@/server/modules/judicia/legal-form/jlf-permission-service";
import { nextPrefixedId } from "@/server/shared/ids";

export type JlfAuditMetadata = {
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
};

export type JlfAuditLogInput = JlfAuditMetadata & {
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  nomorPerkara?: string | null;
};

export type JlfAuditLogFilters = {
  userId?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  nomorPerkara?: string;
  eventGroup?: "ai" | "account_sync" | "document" | "whatsapp" | "regulation" | "template" | "variable" | "anonymizer";
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
};

type JlfAuditLogRow = QueryResultRow & {
  id: string;
  user_id: string | null;
  user_name: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  nomor_perkara: string;
  ip_address: string;
  user_agent: string;
  metadata: unknown;
  created_at: string;
};

const SENSITIVE_METADATA_KEYS = [
  "api_key",
  "apikey",
  "authorization",
  "cookie",
  "password",
  "raw",
  "rawinput",
  "secret",
  "token",
  "verificationtoken",
  "whatsapp_token",
];

function normalizeMetadata(value: Record<string, unknown> | undefined) {
  return value ?? {};
}

function isSensitiveMetadataKey(key: string) {
  const normalized = key.replace(/[^a-z0-9]/gi, "").toLowerCase();
  return SENSITIVE_METADATA_KEYS.some((term) => normalized.includes(term));
}

export function sanitizeAuditMetadata(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map((item) => sanitizeAuditMetadata(item));
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        isSensitiveMetadataKey(key) ? "[disamarkan]" : sanitizeAuditMetadata(item),
      ])
    );
  }
  if (typeof value === "string" && value.length > 500) {
    return `${value.slice(0, 500)}...`;
  }
  return value;
}

function mapAuditRow(row: JlfAuditLogRow) {
  return {
    id: row.id,
    userId: row.user_id,
    userName: row.user_name ?? "",
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    nomorPerkara: row.nomor_perkara,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    metadata: sanitizeAuditMetadata(row.metadata ?? {}),
    createdAt: row.created_at,
  };
}

export async function logAction(db: AletaDatabase, input: JlfAuditLogInput) {
  const id = await nextPrefixedId(db, "jlf_audit_logs", "jlf-audit");
  const now = new Date().toISOString();

  await db.prepare(
    `INSERT INTO jlf_audit_logs (
      id, user_id, action, entity_type, entity_id, nomor_perkara,
      ip_address, user_agent, metadata, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?)`
  ).run(
    id,
    input.userId ?? null,
    input.action,
    input.entityType,
    input.entityId ?? "",
    input.nomorPerkara ?? "",
    input.ipAddress ?? "",
    input.userAgent ?? "",
    JSON.stringify(normalizeMetadata(input.metadata)),
    now
  );

  return { id, createdAt: now };
}

export function logTemplateEvent(db: AletaDatabase, input: Omit<JlfAuditLogInput, "entityType">) {
  return logAction(db, { ...input, entityType: "jlf_template" });
}

export function logVariableEvent(db: AletaDatabase, input: Omit<JlfAuditLogInput, "entityType">) {
  return logAction(db, { ...input, entityType: "jlf_variable" });
}

export function logDocumentEvent(db: AletaDatabase, input: Omit<JlfAuditLogInput, "entityType">) {
  return logAction(db, { ...input, entityType: "jlf_generated_document" });
}

export function logSippAccountEvent(db: AletaDatabase, input: Omit<JlfAuditLogInput, "entityType">) {
  return logAction(db, { ...input, entityType: "jlf_sipp_account_link" });
}

export function logRegulationEvent(db: AletaDatabase, input: Omit<JlfAuditLogInput, "entityType">) {
  return logAction(db, { ...input, entityType: "jlf_regulation" });
}

export function logAiEvent(db: AletaDatabase, input: Omit<JlfAuditLogInput, "entityType">) {
  return logAction(db, { ...input, entityType: "jlf_ai" });
}

export function logWhatsappEvent(db: AletaDatabase, input: Omit<JlfAuditLogInput, "entityType">) {
  return logAction(db, { ...input, entityType: "jlf_whatsapp" });
}

function appendEventGroupFilter(where: string[], group: JlfAuditLogFilters["eventGroup"]) {
  if (!group) return;
  switch (group) {
    case "ai":
      where.push("(entity_type = 'jlf_ai' OR action LIKE 'ai.%')");
      return;
    case "account_sync":
      where.push("(entity_type = 'jlf_sipp_account_link' OR action LIKE 'account_link.%')");
      return;
    case "document":
      where.push("(entity_type = 'jlf_generated_document' OR action LIKE 'document.%')");
      return;
    case "whatsapp":
      where.push("(entity_type = 'jlf_whatsapp' OR action LIKE 'whatsapp.%')");
      return;
    case "regulation":
      where.push("(entity_type = 'jlf_regulation' OR action LIKE 'regulation.%')");
      return;
    case "template":
      where.push("(entity_type = 'jlf_template' OR action LIKE 'template.%')");
      return;
    case "variable":
      where.push("(entity_type = 'jlf_variable' OR action LIKE 'variable.%')");
      return;
    case "anonymizer":
      where.push("(entity_type LIKE 'jlf_anonym%' OR action LIKE 'anonymizer.%')");
      return;
  }
}

function buildAuditWhere(filters: JlfAuditLogFilters) {
  const where: string[] = [];
  const params: Array<string | number> = [];

  if (filters.userId) {
    where.push("user_id = ?");
    params.push(filters.userId);
  }
  if (filters.action) {
    where.push("action = ?");
    params.push(filters.action);
  }
  if (filters.entityType) {
    where.push("entity_type = ?");
    params.push(filters.entityType);
  }
  if (filters.entityId) {
    where.push("entity_id = ?");
    params.push(filters.entityId);
  }
  if (filters.nomorPerkara) {
    where.push("nomor_perkara = ?");
    params.push(filters.nomorPerkara);
  }
  if (filters.from) {
    where.push("created_at >= ?");
    params.push(filters.from);
  }
  if (filters.to) {
    where.push("created_at <= ?");
    params.push(filters.to);
  }
  appendEventGroupFilter(where, filters.eventGroup);

  return { where, params };
}

export async function listAuditLogs(db: AletaDatabase, actor: UserPersona, filters: JlfAuditLogFilters = {}) {
  requireJlfPermission(actor, JLF_PERMISSION.AUDIT_VIEW);

  const { where, params } = buildAuditWhere(filters);
  const limit = Math.max(1, Math.min(200, filters.limit ?? 50));
  const offset = Math.max(0, filters.offset ?? 0);
  const countRow = await db.prepare(
    `SELECT COUNT(*) AS total
     FROM jlf_audit_logs
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}`
  ).get<{ total: number | string }>(...params);

  params.push(limit);
  params.push(offset);
  const rows = await db.prepare(
    `SELECT l.id, l.user_id, u.name AS user_name, l.action, l.entity_type, l.entity_id, l.nomor_perkara,
       l.ip_address, l.user_agent, l.metadata, l.created_at
     FROM jlf_audit_logs l
     LEFT JOIN users u ON u.id = l.user_id
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY l.created_at DESC
     LIMIT ? OFFSET ?`
  ).all<JlfAuditLogRow>(...params);

  return {
    items: rows.map(mapAuditRow),
    pagination: {
      total: Number(countRow?.total ?? rows.length),
      limit,
      offset,
    },
  };
}

export async function getAuditLogs(db: AletaDatabase, filters: JlfAuditLogFilters = {}) {
  const { where, params } = buildAuditWhere(filters);
  const limit = Math.max(1, Math.min(200, filters.limit ?? 50));
  params.push(limit);

  const rows = await db.prepare(
    `SELECT l.id, l.user_id, u.name AS user_name, l.action, l.entity_type, l.entity_id, l.nomor_perkara,
       l.ip_address, l.user_agent, l.metadata, l.created_at
     FROM jlf_audit_logs l
     LEFT JOIN users u ON u.id = l.user_id
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY l.created_at DESC
     LIMIT ?`
  ).all<JlfAuditLogRow>(...params);

  return rows.map(mapAuditRow);
}
