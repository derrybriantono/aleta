import type { QueryResultRow } from "pg";

import { JLF_PERMISSION } from "@/lib/judicia-legal-form-types";
import type { UserPersona } from "@/lib/types";
import type { AletaDatabase } from "@/server/db/client";
import { logAction } from "@/server/modules/judicia/legal-form/jlf-audit-log-service";
import { requireJlfPermission } from "@/server/modules/judicia/legal-form/jlf-permission-service";
import { jlfBadRequest } from "@/server/modules/judicia/legal-form/jlf-service-errors";
import { nextPrefixedId } from "@/server/shared/ids";

type ManualValueRow = QueryResultRow & {
  id: string;
  nomor_perkara: string;
  sipp_perkara_id: string;
  template_id: string | null;
  variable_key: string;
  value_type: string;
  value_text: string;
  value_json: unknown;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type JlfManualValueInput = {
  nomorPerkara: string;
  sippPerkaraId?: string;
  templateId?: string | null;
  variableKey: string;
  valueType?: string;
  valueText?: string;
  valueJson?: unknown;
};

function normalizeNomorPerkara(value: string) {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized) jlfBadRequest("Nomor perkara wajib diisi.");
  if (normalized.length > 120) jlfBadRequest("Nomor perkara maksimal 120 karakter.");
  return normalized;
}

function normalizeVariableKey(value: string) {
  const normalized = value.trim().toLowerCase().replace(/[^\w.-]+/g, "_").replace(/[.-]+/g, "_");
  if (!normalized) jlfBadRequest("Variable key wajib diisi.");
  if (normalized.length > 120) jlfBadRequest("Variable key maksimal 120 karakter.");
  return normalized;
}

function normalizeJsonValue(value: unknown) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return value;
  }
}

function mapManualValue(row: ManualValueRow) {
  return {
    id: row.id,
    nomorPerkara: row.nomor_perkara,
    sippPerkaraId: row.sipp_perkara_id,
    templateId: row.template_id,
    variableKey: row.variable_key,
    valueType: row.value_type,
    valueText: row.value_text,
    valueJson: normalizeJsonValue(row.value_json),
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listManualValues(
  db: AletaDatabase,
  actor: UserPersona,
  filters: { nomorPerkara: string; templateId?: string | null; variableKey?: string }
) {
  requireJlfPermission(actor, JLF_PERMISSION.MANUAL_DATA_VIEW);

  const where = ["nomor_perkara = ?"];
  const params: Array<string | null> = [normalizeNomorPerkara(filters.nomorPerkara)];

  if (filters.templateId !== undefined) {
    where.push(filters.templateId ? "template_id = ?" : "template_id IS NULL");
    if (filters.templateId) params.push(filters.templateId);
  }
  if (filters.variableKey) {
    where.push("variable_key = ?");
    params.push(normalizeVariableKey(filters.variableKey));
  }

  const rows = await db.prepare(
    `SELECT id, nomor_perkara, sipp_perkara_id, template_id, variable_key, value_type, value_text, value_json,
       created_by, updated_by, created_at, updated_at
     FROM jlf_manual_values
     WHERE ${where.join(" AND ")}
     ORDER BY updated_at DESC`
  ).all<ManualValueRow>(...params);

  return rows.map(mapManualValue);
}

export async function getManualValueForVariable(
  db: AletaDatabase,
  input: { nomorPerkara: string; templateId?: string | null; variableKey: string }
) {
  const nomorPerkara = normalizeNomorPerkara(input.nomorPerkara);
  const variableKey = normalizeVariableKey(input.variableKey);
  const rows = await db.prepare(
    `SELECT id, nomor_perkara, sipp_perkara_id, template_id, variable_key, value_type, value_text, value_json,
       created_by, updated_by, created_at, updated_at
     FROM jlf_manual_values
     WHERE nomor_perkara = ?
       AND variable_key = ?
       AND (template_id = ? OR template_id IS NULL)
     ORDER BY CASE WHEN template_id = ? THEN 0 ELSE 1 END, updated_at DESC
     LIMIT 1`
  ).all<ManualValueRow>(
    nomorPerkara,
    variableKey,
    input.templateId ?? null,
    input.templateId ?? null
  );

  return rows[0] ? mapManualValue(rows[0]) : null;
}

export async function saveManualValue(
  db: AletaDatabase,
  actor: UserPersona,
  input: JlfManualValueInput,
  audit?: { ipAddress?: string; userAgent?: string }
) {
  const nomorPerkara = normalizeNomorPerkara(input.nomorPerkara);
  const variableKey = normalizeVariableKey(input.variableKey);
  const valueType = input.valueType?.trim() || "text";
  const valueText = input.valueText?.trim() ?? "";
  const templateId = input.templateId || null;
  const sippPerkaraId = input.sippPerkaraId?.trim() ?? "";
  const now = new Date().toISOString();

  const existing = await getManualValueForVariable(db, { nomorPerkara, templateId, variableKey });
  requireJlfPermission(actor, existing ? JLF_PERMISSION.MANUAL_DATA_UPDATE : JLF_PERMISSION.MANUAL_DATA_CREATE);

  if (existing) {
    await db.prepare(
      `UPDATE jlf_manual_values
       SET sipp_perkara_id = ?, value_type = ?, value_text = ?, value_json = ?::jsonb,
           updated_by = ?, updated_at = ?
       WHERE id = ?`
    ).run(
      sippPerkaraId,
      valueType,
      valueText,
      JSON.stringify(input.valueJson ?? null),
      actor.id,
      now,
      existing.id
    );

    await logAction(db, {
      userId: actor.id,
      action: "manual_data.update",
      entityType: "jlf_manual_value",
      entityId: existing.id,
      nomorPerkara,
      ipAddress: audit?.ipAddress,
      userAgent: audit?.userAgent,
      metadata: { variableKey, templateId },
    });

    return (await listManualValues(db, actor, { nomorPerkara, templateId, variableKey }))[0] ?? null;
  }

  const id = await nextPrefixedId(db, "jlf_manual_values", "jlf-manual");
  await db.prepare(
    `INSERT INTO jlf_manual_values (
      id, nomor_perkara, sipp_perkara_id, template_id, variable_key, value_type, value_text,
      value_json, created_by, updated_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?, ?, ?, ?)`
  ).run(
    id,
    nomorPerkara,
    sippPerkaraId,
    templateId,
    variableKey,
    valueType,
    valueText,
    JSON.stringify(input.valueJson ?? null),
    actor.id,
    actor.id,
    now,
    now
  );

  await logAction(db, {
    userId: actor.id,
    action: "manual_data.create",
    entityType: "jlf_manual_value",
    entityId: id,
    nomorPerkara,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
    metadata: { variableKey, templateId },
  });

  return (await listManualValues(db, actor, { nomorPerkara, templateId, variableKey }))[0] ?? null;
}

export async function deleteManualValue(
  db: AletaDatabase,
  actor: UserPersona,
  input: { nomorPerkara: string; templateId?: string | null; variableKey: string },
  audit?: { ipAddress?: string; userAgent?: string }
) {
  const nomorPerkara = normalizeNomorPerkara(input.nomorPerkara);
  const variableKey = normalizeVariableKey(input.variableKey);
  const templateId = input.templateId || null;
  const existing = await getManualValueForVariable(db, { nomorPerkara, templateId, variableKey });

  requireJlfPermission(actor, JLF_PERMISSION.MANUAL_DATA_DELETE);
  if (!existing) return { deleted: false };

  await db.prepare("DELETE FROM jlf_manual_values WHERE id = ?").run(existing.id);

  await logAction(db, {
    userId: actor.id,
    action: "manual_data.delete",
    entityType: "jlf_manual_value",
    entityId: existing.id,
    nomorPerkara,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
    metadata: { variableKey, templateId },
  });

  return { deleted: true };
}

export const JlfManualValuesService = {
  listManualValues,
  getManualValueForVariable,
  saveManualValue,
  deleteManualValue,
};
