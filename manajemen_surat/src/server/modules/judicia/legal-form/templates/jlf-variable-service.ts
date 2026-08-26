import type { QueryResultRow } from "pg";

import { JLF_PERMISSION } from "@/lib/judicia-legal-form-types";
import { resolveJlfFieldMode, resolveLegacyAbtType } from "@/lib/judicia-legal-form-abt";
import { resolveJlfVariableQueryPreview } from "@/lib/judicia-legal-form-query-preview";
import type { UserPersona } from "@/lib/types";
import type { AletaDatabase } from "@/server/db/client";
import { logTemplateEvent, logVariableEvent } from "@/server/modules/judicia/legal-form/jlf-audit-log-service";
import { requireJlfPermission } from "@/server/modules/judicia/legal-form/jlf-permission-service";
import { jlfBadRequest, jlfNotFound } from "@/server/modules/judicia/legal-form/jlf-service-errors";
import { normalizePlaceholder } from "@/server/modules/judicia/legal-form/templates/jlf-placeholder-service";
import { nextPrefixedId } from "@/server/shared/ids";

type VariableRow = QueryResultRow & {
  id: string;
  legacy_code: string | null;
  key: string;
  label: string;
  description: string;
  data_type: string;
  source_type: string;
  source_key: string;
  transform_key: string;
  fallback_value: string;
  legacy_abt_type: string;
  field_mode: string;
  ai_enabled: boolean | number;
  manual_override_allowed: boolean | number;
  is_required: boolean | number;
  is_active: boolean | number;
  example_value: string;
  admin_note: string;
  sipp_query_preview: string;
  sipp_query_preview_status: string;
  sipp_query_preview_key: string;
  sipp_query_preview_generated_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

type TemplateVariableRow = QueryResultRow & {
  id: string;
  template_id: string;
  variable_id: string;
  variable_key: string;
  variable_label: string;
  data_type: string;
  source_type: string;
  legacy_code: string | null;
  placeholder: string;
  is_required: boolean | number;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

const DATA_TYPES = new Set([
  "text",
  "number",
  "date",
  "datetime",
  "currency",
  "boolean",
  "long_text",
  "json",
  "list",
  "table",
  "qrcode",
  "image",
  "ai_generated_text",
  "manual_text",
  "manual_date",
]);

const SOURCE_TYPES = new Set([
  "sipp_perkara",
  "sipp_pihak",
  "sipp_jadwal_sidang",
  "sipp_hakim",
  "sipp_panitera",
  "sipp_jurusita",
  "sipp_putusan",
  "sipp_keuangan",
  "jlf_manual",
  "jlf_temp",
  "jlf_bas_qa",
  "function",
  "qrcode",
  "ai",
  "static",
  "computed",
  "abt_sql",
]);

const VARIABLE_SORT_COLUMNS: Record<string, string> = {
  key: "key",
  legacyCode: "legacy_code",
  label: "label",
  dataType: "data_type",
  sourceType: "source_type",
  sourceKey: "source_key",
  status: "is_active",
  createdAt: "created_at",
  updatedAt: "updated_at",
};

const VARIABLE_SELECT_COLUMNS = `id, legacy_code, key, label, description, data_type, source_type, source_key, transform_key,
       fallback_value, legacy_abt_type, field_mode, ai_enabled, manual_override_allowed,
       is_required, is_active, example_value, admin_note,
       sipp_query_preview, sipp_query_preview_status, sipp_query_preview_key, sipp_query_preview_generated_at,
       created_by, updated_by, created_at, updated_at`;

function normalizeKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\w.-]+/g, "_")
    .replace(/[.-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120);
}

function normalizeLegacyCode(value: string | undefined | null) {
  const normalized = (value ?? "").trim().replace(/^#|#$/g, "");
  if (!normalized) return null;
  if (!/^\d{4}$/.test(normalized)) jlfBadRequest("Legacy code harus berupa 4 digit, contoh 0001.");
  return normalized;
}

function normalizeDataType(value: string | undefined) {
  const normalized = (value || "text").trim().toLowerCase();
  if (!DATA_TYPES.has(normalized)) jlfBadRequest("Data type variabel JLF tidak valid.");
  return normalized;
}

function normalizeSourceType(value: string | undefined) {
  const normalized = (value || "jlf_manual").trim().toLowerCase();
  if (!SOURCE_TYPES.has(normalized)) jlfBadRequest("Source type variabel JLF tidak valid.");
  return normalized;
}

function normalizePreviewStatus(status: string | null | undefined) {
  if (status === "registered" || status === "needs_review" || status === "not_sipp") return status;
  return "needs_review";
}

function resolveVariableModeMetadata(row: Pick<VariableRow, "legacy_abt_type" | "field_mode" | "data_type" | "source_type" | "source_key" | "transform_key" | "legacy_code" | "ai_enabled">) {
  const legacyAbtType = resolveLegacyAbtType({
    legacyAbtType: row.legacy_abt_type,
    dataType: row.data_type,
    sourceType: row.source_type,
    sourceKey: row.source_key,
    transformKey: row.transform_key,
    legacyCode: row.legacy_code,
    aiEnabled: row.ai_enabled,
  });
  const fieldMode = resolveJlfFieldMode({
    fieldMode: row.field_mode,
    legacyAbtType,
    dataType: row.data_type,
    sourceType: row.source_type,
    sourceKey: row.source_key,
    transformKey: row.transform_key,
    legacyCode: row.legacy_code,
    aiEnabled: row.ai_enabled,
  });

  return { legacyAbtType, fieldMode };
}

function mapVariable(row: VariableRow) {
  const modeMetadata = resolveVariableModeMetadata(row);
  const computedPreview = resolveJlfVariableQueryPreview({
    sourceType: row.source_type,
    sourceKey: row.source_key,
    key: row.key,
    adminNote: row.admin_note,
  });
  const storedSqlPreview = row.sipp_query_preview?.trim();
  const queryPreview = storedSqlPreview
    ? {
        ...computedPreview,
        status: normalizePreviewStatus(row.sipp_query_preview_status),
        queryKey: row.sipp_query_preview_key || computedPreview.queryKey,
        sqlPreview: row.sipp_query_preview,
        safetyNotes: [
          ...computedPreview.safetyNotes,
          `Preview SQL tersimpan di database pada ${row.sipp_query_preview_generated_at ?? "waktu tidak tercatat"} untuk review admin.`,
        ],
      }
    : computedPreview;

  return {
    id: row.id,
    legacyCode: row.legacy_code,
    key: row.key,
    label: row.label,
    description: row.description,
    dataType: row.data_type,
    sourceType: row.source_type,
    sourceKey: row.source_key,
    transformKey: row.transform_key,
    fallbackValue: row.fallback_value,
    legacyAbtType: modeMetadata.legacyAbtType,
    fieldMode: modeMetadata.fieldMode,
    aiEnabled: Boolean(row.ai_enabled),
    manualOverrideAllowed: Boolean(row.manual_override_allowed),
    isRequired: Boolean(row.is_required),
    isActive: Boolean(row.is_active),
    exampleValue: row.example_value,
    adminNote: row.admin_note,
    sippQueryPreview: row.sipp_query_preview,
    sippQueryPreviewStatus: row.sipp_query_preview_status,
    sippQueryPreviewKey: row.sipp_query_preview_key,
    sippQueryPreviewGeneratedAt: row.sipp_query_preview_generated_at,
    queryPreview,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function refreshStoredQueryPreview(db: AletaDatabase, id: string) {
  const row = await db.prepare(
    `SELECT ${VARIABLE_SELECT_COLUMNS}
     FROM jlf_variables
     WHERE id = ?`
  ).get<VariableRow>(id);
  if (!row) return;

  const preview = resolveJlfVariableQueryPreview({
    sourceType: row.source_type,
    sourceKey: row.source_key,
    key: row.key,
    adminNote: row.admin_note,
  });
  const previewStatus = preview.sqlPreview?.includes("needs_review") ? "needs_review" : preview.status;

  await db.prepare(
    `UPDATE jlf_variables
     SET sipp_query_preview = ?,
         sipp_query_preview_status = ?,
         sipp_query_preview_key = ?,
         sipp_query_preview_generated_at = ?
     WHERE id = ?`
  ).run(preview.sqlPreview ?? "", previewStatus, preview.queryKey ?? "", new Date().toISOString(), id);
}

function mapTemplateVariable(row: TemplateVariableRow) {
  return {
    id: row.id,
    templateId: row.template_id,
    variableId: row.variable_id,
    variableKey: row.variable_key,
    variableLabel: row.variable_label,
    dataType: row.data_type,
    sourceType: row.source_type,
    legacyCode: row.legacy_code,
    placeholder: row.placeholder,
    normalizedPlaceholder: normalizePlaceholder(row.placeholder),
    isRequired: Boolean(row.is_required),
    sortOrder: Number(row.sort_order) || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function readVariableById(db: AletaDatabase, id: string) {
  const row = await db.prepare(
    `SELECT ${VARIABLE_SELECT_COLUMNS}
     FROM jlf_variables
     WHERE id = ?`
  ).get<VariableRow>(id);

  return row ? mapVariable(row) : null;
}

export async function listVariables(
  db: AletaDatabase,
  actor: UserPersona,
  filters: {
    sourceType?: string;
    dataType?: string;
    query?: string;
    includeInactive?: boolean;
    limit?: number;
    offset?: number;
    sortBy?: string;
    sortDir?: string;
  } = {}
) {
  requireJlfPermission(actor, JLF_PERMISSION.VARIABLE_VIEW);

  const where: string[] = [];
  const params: Array<string | number | boolean> = [];
  if (!filters.includeInactive) where.push("is_active = 1");
  if (filters.sourceType) {
    where.push("source_type = ?");
    params.push(normalizeSourceType(filters.sourceType));
  }
  if (filters.dataType) {
    where.push("data_type = ?");
    params.push(normalizeDataType(filters.dataType));
  }
  if (filters.query) {
    where.push("(LOWER(key) LIKE ? OR LOWER(label) LIKE ? OR LOWER(COALESCE(legacy_code, '')) LIKE ? OR LOWER(COALESCE(source_key, '')) LIKE ?)");
    const like = `%${filters.query.toLowerCase()}%`;
    params.push(like, like, like, like);
  }

  const sortColumn = VARIABLE_SORT_COLUMNS[filters.sortBy ?? "key"] ?? VARIABLE_SORT_COLUMNS.key;
  const sortDir = filters.sortDir === "desc" ? "DESC" : "ASC";
  const limit = Math.max(1, Math.min(20000, filters.limit ?? 150));
  const offset = Math.max(0, Math.floor(filters.offset ?? 0));
  const countParams = [...params];
  params.push(limit, offset);

  const rows = await db.prepare(
    `SELECT ${VARIABLE_SELECT_COLUMNS}
     FROM jlf_variables
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY ${sortColumn} ${sortDir}, key ASC
     LIMIT ?
     OFFSET ?`
  ).all<VariableRow>(...params);

  return rows.map(mapVariable);
}

export async function listVariablesPage(
  db: AletaDatabase,
  actor: UserPersona,
  filters: Parameters<typeof listVariables>[2] = {}
) {
  requireJlfPermission(actor, JLF_PERMISSION.VARIABLE_VIEW);

  const where: string[] = [];
  const params: Array<string | number | boolean> = [];
  if (!filters.includeInactive) where.push("is_active = 1");
  if (filters.sourceType) {
    where.push("source_type = ?");
    params.push(normalizeSourceType(filters.sourceType));
  }
  if (filters.dataType) {
    where.push("data_type = ?");
    params.push(normalizeDataType(filters.dataType));
  }
  if (filters.query) {
    where.push("(LOWER(key) LIKE ? OR LOWER(label) LIKE ? OR LOWER(COALESCE(legacy_code, '')) LIKE ? OR LOWER(COALESCE(source_key, '')) LIKE ?)");
    const like = `%${filters.query.toLowerCase()}%`;
    params.push(like, like, like, like);
  }

  const countRow = await db.prepare(
    `SELECT COUNT(*) AS total
     FROM jlf_variables
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}`
  ).get<{ total: number | string }>(...params);
  const total = Number(countRow?.total ?? 0);
  const limit = Math.max(1, Math.min(20000, filters.limit ?? 150));
  const offset = Math.max(0, Math.floor(filters.offset ?? 0));
  const items = await listVariables(db, actor, { ...filters, limit, offset });

  return {
    items,
    pagination: {
      total,
      limit,
      offset,
      page: Math.floor(offset / limit) + 1,
      pageCount: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

export async function getVariable(db: AletaDatabase, actor: UserPersona, id: string) {
  requireJlfPermission(actor, JLF_PERMISSION.VARIABLE_VIEW);

  const variable = await readVariableById(db, id);
  if (!variable) jlfNotFound("Variabel JLF tidak ditemukan.");
  return variable;
}

export async function createVariable(
  db: AletaDatabase,
  actor: UserPersona,
  input: {
    legacyCode?: string | null;
    key: string;
    label: string;
    description?: string;
    dataType?: string;
    sourceType?: string;
    sourceKey?: string;
    transformKey?: string;
    fallbackValue?: string;
    legacyAbtType?: string | null;
    fieldMode?: string | null;
    aiEnabled?: boolean;
    manualOverrideAllowed?: boolean;
    isRequired?: boolean;
    isActive?: boolean;
    exampleValue?: string;
    adminNote?: string;
  }
) {
  requireJlfPermission(actor, JLF_PERMISSION.VARIABLE_CREATE);

  const key = normalizeKey(input.key);
  const label = input.label.trim();
  if (!key) jlfBadRequest("Key variabel wajib diisi.");
  if (!label) jlfBadRequest("Label variabel wajib diisi.");

  const id = await nextPrefixedId(db, "jlf_variables", "jlf-var");
  const now = new Date().toISOString();
  await db.prepare(
    `INSERT INTO jlf_variables (
      id, legacy_code, key, label, description, data_type, source_type, source_key, transform_key,
      fallback_value, legacy_abt_type, field_mode, ai_enabled, manual_override_allowed,
      is_required, is_active, example_value, admin_note, created_by, updated_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    normalizeLegacyCode(input.legacyCode),
    key,
    label,
    input.description?.trim() ?? "",
    normalizeDataType(input.dataType),
    normalizeSourceType(input.sourceType),
    input.sourceKey?.trim() ?? "",
    input.transformKey?.trim() ?? "",
    input.fallbackValue?.trim() ?? "",
    input.legacyAbtType?.trim() ?? "",
    input.fieldMode?.trim() ?? "",
    input.aiEnabled === true ? 1 : 0,
    input.manualOverrideAllowed === false ? 0 : 1,
    input.isRequired === true ? 1 : 0,
    input.isActive === false ? 0 : 1,
    input.exampleValue?.trim() ?? "",
    input.adminNote?.trim() ?? "",
    actor.id,
    actor.id,
    now,
    now
  );
  await refreshStoredQueryPreview(db, id);

  await logVariableEvent(db, {
    userId: actor.id,
    action: "CREATE_VARIABLE",
    entityId: id,
    metadata: { key, legacyCode: input.legacyCode ?? null },
  });

  return readVariableById(db, id);
}

export async function updateVariable(
  db: AletaDatabase,
  actor: UserPersona,
  id: string,
  input: Partial<Parameters<typeof createVariable>[2]>
) {
  requireJlfPermission(actor, JLF_PERMISSION.VARIABLE_UPDATE);

  const existing = await readVariableById(db, id);
  if (!existing) jlfNotFound("Variabel JLF tidak ditemukan.");

  const now = new Date().toISOString();
  await db.prepare(
    `UPDATE jlf_variables
     SET legacy_code = COALESCE(?, legacy_code),
         key = COALESCE(?, key),
         label = COALESCE(?, label),
         description = COALESCE(?, description),
         data_type = COALESCE(?, data_type),
         source_type = COALESCE(?, source_type),
         source_key = COALESCE(?, source_key),
         transform_key = COALESCE(?, transform_key),
         fallback_value = COALESCE(?, fallback_value),
         legacy_abt_type = COALESCE(?, legacy_abt_type),
         field_mode = COALESCE(?, field_mode),
         ai_enabled = COALESCE(?, ai_enabled),
         manual_override_allowed = COALESCE(?, manual_override_allowed),
         is_required = COALESCE(?, is_required),
         is_active = COALESCE(?, is_active),
         example_value = COALESCE(?, example_value),
         admin_note = COALESCE(?, admin_note),
         updated_by = ?,
         updated_at = ?
     WHERE id = ?`
  ).run(
    input.legacyCode === undefined ? null : normalizeLegacyCode(input.legacyCode),
    input.key ? normalizeKey(input.key) : null,
    input.label?.trim() || null,
    input.description?.trim() ?? null,
    input.dataType ? normalizeDataType(input.dataType) : null,
    input.sourceType ? normalizeSourceType(input.sourceType) : null,
    input.sourceKey?.trim() ?? null,
    input.transformKey?.trim() ?? null,
    input.fallbackValue?.trim() ?? null,
    input.legacyAbtType?.trim() ?? null,
    input.fieldMode?.trim() ?? null,
    input.aiEnabled === undefined ? null : input.aiEnabled ? 1 : 0,
    input.manualOverrideAllowed === undefined ? null : input.manualOverrideAllowed ? 1 : 0,
    input.isRequired === undefined ? null : input.isRequired ? 1 : 0,
    input.isActive === undefined ? null : input.isActive ? 1 : 0,
    input.exampleValue?.trim() ?? null,
    input.adminNote?.trim() ?? null,
    actor.id,
    now,
    id
  );
  await refreshStoredQueryPreview(db, id);

  await logVariableEvent(db, {
    userId: actor.id,
    action: "UPDATE_VARIABLE",
    entityId: id,
    metadata: { previousKey: existing.key, input },
  });

  return readVariableById(db, id);
}

export async function deactivateVariable(db: AletaDatabase, actor: UserPersona, id: string) {
  requireJlfPermission(actor, JLF_PERMISSION.VARIABLE_DELETE);
  const result = await updateVariable(db, actor, id, { isActive: false });
  await logVariableEvent(db, {
    userId: actor.id,
    action: "DEACTIVATE_VARIABLE",
    entityId: id,
  });
  return result;
}

export async function mapLegacyCodeToSemanticKey(db: AletaDatabase, actor: UserPersona, legacyCode: string) {
  requireJlfPermission(actor, JLF_PERMISSION.VARIABLE_VIEW);

  const normalized = normalizeLegacyCode(legacyCode);
  if (!normalized) return null;
  const row = await db.prepare(
    `SELECT ${VARIABLE_SELECT_COLUMNS}
     FROM jlf_variables
     WHERE legacy_code = ? AND is_active = 1`
  ).get<VariableRow>(normalized);

  return row ? mapVariable(row) : null;
}

export async function listTemplateVariables(db: AletaDatabase, actor: UserPersona, templateId: string) {
  requireJlfPermission(actor, JLF_PERMISSION.TEMPLATE_VIEW);

  const rows = await db.prepare(
    `SELECT tv.id, tv.template_id, tv.variable_id, v.key AS variable_key, v.label AS variable_label,
       v.data_type, v.source_type, v.legacy_code, tv.placeholder, tv.is_required, tv.sort_order, tv.created_at, tv.updated_at
     FROM jlf_template_variables tv
     JOIN jlf_variables v ON v.id = tv.variable_id
     WHERE tv.template_id = ?
     ORDER BY tv.sort_order ASC, tv.placeholder ASC`
  ).all<TemplateVariableRow>(templateId);

  return rows.map(mapTemplateVariable);
}

export async function mapVariableToTemplate(
  db: AletaDatabase,
  actor: UserPersona,
  input: { templateId: string; variableId: string; placeholder: string; isRequired?: boolean; sortOrder?: number }
) {
  requireJlfPermission(actor, JLF_PERMISSION.TEMPLATE_UPDATE);

  const placeholder = input.placeholder.trim();
  if (!placeholder) jlfBadRequest("Placeholder wajib diisi.");

  const template = await db.prepare("SELECT id FROM jlf_templates WHERE id = ? AND deleted_at IS NULL").get<{ id: string }>(input.templateId);
  if (!template) jlfNotFound("Template JLF tidak ditemukan.");
  const variable = await readVariableById(db, input.variableId);
  if (!variable) jlfNotFound("Variabel JLF tidak ditemukan.");

  const id = await nextPrefixedId(db, "jlf_template_variables", "jlf-mapvar");
  const now = new Date().toISOString();
  await db.prepare(
    `INSERT INTO jlf_template_variables (
      id, template_id, variable_id, placeholder, is_required, sort_order, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (template_id, placeholder) DO UPDATE SET
      variable_id = EXCLUDED.variable_id,
      is_required = EXCLUDED.is_required,
      sort_order = EXCLUDED.sort_order,
      updated_at = EXCLUDED.updated_at`
  ).run(id, input.templateId, input.variableId, placeholder, input.isRequired === true ? 1 : 0, input.sortOrder ?? 0, now, now);

  await logTemplateEvent(db, {
    userId: actor.id,
    action: "MAP_TEMPLATE_VARIABLE",
    entityId: input.templateId,
    metadata: { variableId: input.variableId, placeholder, variableKey: variable.key },
  });

  return listTemplateVariables(db, actor, input.templateId);
}

export async function unmapVariable(db: AletaDatabase, actor: UserPersona, templateVariableId: string) {
  requireJlfPermission(actor, JLF_PERMISSION.TEMPLATE_UPDATE);

  const existing = await db.prepare(
    `SELECT id, template_id, placeholder
     FROM jlf_template_variables
     WHERE id = ?`
  ).get<{ id: string; template_id: string; placeholder: string }>(templateVariableId);
  if (!existing) jlfNotFound("Mapping variabel template tidak ditemukan.");

  await db.prepare("DELETE FROM jlf_template_variables WHERE id = ?").run(templateVariableId);
  await logTemplateEvent(db, {
    userId: actor.id,
    action: "UNMAP_TEMPLATE_VARIABLE",
    entityId: existing.template_id,
    metadata: { placeholder: existing.placeholder, templateVariableId },
  });

  return listTemplateVariables(db, actor, existing.template_id);
}

export async function validateTemplateMappings(db: AletaDatabase, actor: UserPersona, templateId: string) {
  requireJlfPermission(actor, JLF_PERMISSION.TEMPLATE_VIEW);

  const mappings = await listTemplateVariables(db, actor, templateId);
  const duplicatePlaceholders = mappings
    .filter((item, index) => mappings.findIndex((candidate) => candidate.placeholder === item.placeholder) !== index)
    .map((item) => item.placeholder);

  return {
    templateId,
    mappings,
    duplicatePlaceholders,
    unmappedPlaceholders: [],
    valid: duplicatePlaceholders.length === 0,
  };
}

export const JlfVariableService = {
  listVariables,
  listVariablesPage,
  getVariable,
  createVariable,
  updateVariable,
  deactivateVariable,
  mapLegacyCodeToSemanticKey,
};

export const JlfVariableMappingService = {
  mapVariableToTemplate,
  unmapVariable,
  listTemplateVariables,
  validateTemplateMappings,
};
