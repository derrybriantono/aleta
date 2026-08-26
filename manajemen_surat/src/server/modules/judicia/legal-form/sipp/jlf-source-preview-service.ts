import { JLF_PERMISSION } from "@/lib/judicia-legal-form-types";
import {
  resolveJlfVariableQueryPreview,
  validateJlfSelectOnlySql,
} from "@/lib/judicia-legal-form-query-preview";
import type { UserPersona } from "@/lib/types";
import type { AletaDatabase } from "@/server/db/client";
import { logAction } from "@/server/modules/judicia/legal-form/jlf-audit-log-service";
import { requireJlfPermission } from "@/server/modules/judicia/legal-form/jlf-permission-service";
import { jlfBadRequest } from "@/server/modules/judicia/legal-form/jlf-service-errors";
import { JlfSippProviderRegistry } from "@/server/modules/judicia/legal-form/jlf-sipp-readonly-provider";
import {
  assertNoSqlInSippQueryParams,
  getJlfSippQueryDefinition,
  validateJlfSippQueryRequest,
} from "@/server/modules/judicia/legal-form/sipp/jlf-sipp-query-registry";
import {
  assertJlfLegacySqlRegisteredInDatabase,
  assertJlfSippQueryRegisteredInDatabase,
} from "@/server/modules/judicia/legal-form/sipp/jlf-query-registry-sync";

type SourcePreviewInput = {
  variableId?: string;
  queryKey?: string;
  sourceType?: string;
  sourceKey?: string;
  legacyAbtType?: string;
  variableKey?: string;
  adminNote?: string;
  sqlPreview?: string;
  params?: Record<string, unknown>;
  limit?: number;
};

type SourcePreviewVariableRow = {
  id: string;
  key: string;
  label: string;
  legacy_code: string | null;
  data_type: string;
  source_type: string;
  source_key: string;
  transform_key: string;
  fallback_value: string;
  legacy_abt_type: string;
  admin_note: string;
  sipp_query_preview: string;
  sipp_query_preview_status: string;
  sipp_query_preview_key: string;
};

function normalizeText(value: unknown, maxLength = 160) {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function normalizeLimit(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(1, Math.min(10, Math.floor(number))) : 5;
}

function normalizePositiveInteger(value: unknown) {
  const text = String(value ?? "").trim();
  if (!/^\d+$/.test(text)) return 0;
  const number = Number(text);
  return Number.isSafeInteger(number) && number > 0 ? number : 0;
}

function readPath(value: unknown, path: string): unknown {
  if (!path || !value || typeof value !== "object") return undefined;
  let current: unknown = value;
  for (const segment of path.split(".")) {
    if (!current || typeof current !== "object") return undefined;
    const record = current as Record<string, unknown>;
    current = record[segment] ?? record[toCamelKey(segment)] ?? record[toSnakeKey(segment)];
  }
  return current;
}

function toCamelKey(value: string) {
  return value.replace(/_([a-z])/g, (_, char: string) => char.toUpperCase());
}

function toSnakeKey(value: string) {
  return value.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`);
}

function asRows(value: unknown, limit: number) {
  const rows = Array.isArray(value) ? value : value == null ? [] : [value];
  return rows.slice(0, limit);
}

function resolvePerkaraId(params: Record<string, unknown>, detail: { perkaraId?: string } | null | undefined) {
  return normalizeText(params.perkaraId ?? params.perkara_id ?? detail?.perkaraId, 80);
}

function resolveNomorPerkara(params: Record<string, unknown>) {
  return normalizeText(params.nomorPerkara ?? params.nomor_perkara ?? params.query, 120);
}

function resolveJenisPerkara(params: Record<string, unknown>, detail: unknown) {
  const detailRecord = detail && typeof detail === "object" ? detail as Record<string, unknown> : {};
  return normalizeText(
    params.jenisPerkara ??
      params.jenis_perkara ??
      params.caseType ??
      params.case_type ??
      params.alurPerkara ??
      params.alur_perkara ??
      detailRecord.jenisPerkara ??
      detailRecord.jenis_perkara ??
      detailRecord.jenis_perkara_nama,
    160
  );
}

function resolveSidangUrutan(params: Record<string, unknown>) {
  return normalizePositiveInteger(params.sidangUrutan ?? params.sidang_urutan ?? params.urutan);
}

function putLegacyPlaceholder(values: Record<string, unknown>, code: string, value: unknown) {
  const normalized = code.replace(/\D/g, "").padStart(4, "0");
  if (!normalized || normalized === "0000") return;
  const numeric = String(Number(normalized));
  values[normalized] = value;
  values[`#${normalized}#`] = value;
  values[`legacy_${normalized}`] = value;
  values[`legacy:${normalized}`] = value;
  if (numeric && numeric !== "NaN") {
    values[numeric] = value;
    values[`#${numeric}#`] = value;
    values[`legacy_${numeric}`] = value;
    values[`legacy:${numeric}`] = value;
  }
}

function detectLegacySqlDependencyCodes(sql: string) {
  return Array.from(
    new Set(
      Array.from(String(sql || "").matchAll(/#(\d{1,6})#/g))
        .map((match) => (match[1] ?? "").replace(/\D/g, "").padStart(4, "0"))
        .filter((code) => code && code !== "0000")
    )
  );
}

const PREVIEW_LEGACY_URUTAN_DATA_BY_CODE: Record<string, number> = {
  "0073": 1,
  "0098": 1,
  "0101": 1,
  "0102": 1,
  "0105": 1,
  "0193": 2,
  "0196": 3,
  "0199": 4,
  "0229": 1,
  "0230": 1,
  "1036": 2,
  "3119": 3,
  "5026": 2,
  "5029": 2,
  "5082": 3,
  "5089": 3,
  "5090": 4,
  "5097": 4,
  "5098": 5,
  "5117": 5,
  "7128": 1,
};

const PREVIEW_LEGACY_AUTO_VARIABLES: Record<string, Omit<SourcePreviewVariableRow, "id" | "legacy_code" | "sipp_query_preview">> = {
  "0032": { key: "hari_sidang_terpilih", label: "Hari Sidang Terpilih", data_type: "date", source_type: "sipp_jadwal_sidang", source_key: "sidang.terpilih.tanggal_sidang", transform_key: "hari_indonesia", fallback_value: "", legacy_abt_type: "multi_sidang", admin_note: "", sipp_query_preview_status: "virtual", sipp_query_preview_key: "" },
  "0033": { key: "tanggal_sidang_terpilih", label: "Tanggal Sidang Terpilih", data_type: "date", source_type: "sipp_jadwal_sidang", source_key: "sidang.terpilih.tanggal_sidang", transform_key: "tanggal_indonesia_panjang", fallback_value: "", legacy_abt_type: "multi_sidang", admin_note: "", sipp_query_preview_status: "virtual", sipp_query_preview_key: "" },
  "0046": { key: "sebutan_penggugat_pemohon", label: "Sebutan Penggugat/Pemohon", data_type: "text", source_type: "computed", source_key: "penyebutan_pihak1", transform_key: "", fallback_value: "", legacy_abt_type: "", admin_note: "", sipp_query_preview_status: "virtual", sipp_query_preview_key: "" },
  "0047": { key: "sebutan_tergugat_termohon", label: "Sebutan Tergugat/Termohon", data_type: "text", source_type: "computed", source_key: "penyebutan_pihak2", transform_key: "", fallback_value: "", legacy_abt_type: "", admin_note: "", sipp_query_preview_status: "virtual", sipp_query_preview_key: "" },
  "0050": { key: "persidangan_ke", label: "Persidangan ke-", data_type: "number", source_type: "sipp_jadwal_sidang", source_key: "sidang.terpilih.urutan", transform_key: "", fallback_value: "", legacy_abt_type: "multi_sidang", admin_note: "", sipp_query_preview_status: "virtual", sipp_query_preview_key: "" },
  "0053": { key: "permohonan_gugatan", label: "Permohonan/Gugatan", data_type: "text", source_type: "computed", source_key: "jenis_gugatan_permohonan", transform_key: "", fallback_value: "", legacy_abt_type: "", admin_note: "", sipp_query_preview_status: "virtual", sipp_query_preview_key: "" },
  "0079": { key: "alasan_tunda_sidang", label: "Alasan Tunda", data_type: "text", source_type: "sipp_jadwal_sidang", source_key: "sidang.terpilih.alasan_ditunda", transform_key: "", fallback_value: "", legacy_abt_type: "multi_sidang", admin_note: "", sipp_query_preview_status: "virtual", sipp_query_preview_key: "" },
  "0090": { key: "dihadiri_oleh", label: "Dihadiri oleh", data_type: "text", source_type: "sipp_jadwal_sidang", source_key: "sidang.terpilih.dihadiri_oleh", transform_key: "", fallback_value: "", legacy_abt_type: "multi_sidang", admin_note: "", sipp_query_preview_status: "virtual", sipp_query_preview_key: "" },
  "0133": { key: "hari_tunda_sidang", label: "Hari Tunda Sidang", data_type: "date", source_type: "sipp_jadwal_sidang", source_key: "sidang.terpilih.tanggal_ditunda", transform_key: "hari_indonesia", fallback_value: "", legacy_abt_type: "multi_sidang", admin_note: "", sipp_query_preview_status: "virtual", sipp_query_preview_key: "" },
  "0134": { key: "tanggal_sidang_tunda", label: "Tgl Sidang Tunda", data_type: "date", source_type: "sipp_jadwal_sidang", source_key: "sidang.terpilih.tanggal_ditunda", transform_key: "tanggal_indonesia_panjang", fallback_value: "", legacy_abt_type: "multi_sidang", admin_note: "", sipp_query_preview_status: "virtual", sipp_query_preview_key: "" },
  "0163": { key: "ruang_sidang", label: "Ruang Sidang", data_type: "text", source_type: "sipp_jadwal_sidang", source_key: "sidang.terpilih.ruangan", transform_key: "", fallback_value: "", legacy_abt_type: "multi_sidang", admin_note: "", sipp_query_preview_status: "virtual", sipp_query_preview_key: "" },
};

function parseLegacySippTableColumnSource(sourceKey: string) {
  const raw = String(sourceKey || "").trim();
  const [pathPart, queryPart = ""] = raw.split("?", 2);
  const parts = pathPart.split(".");
  if (parts.length !== 2) return null;
  const [table, column] = parts.map((part) => part.trim());
  if (!/^[a-zA-Z0-9_]+$/.test(table) || !/^[a-zA-Z0-9_]+$/.test(column)) return null;
  const urutanMatch = queryPart.match(/(?:^|&)(?:urutan|urutan_data|sidang_urutan)=(\d+)/i);
  return { table, column, urutanData: normalizePositiveInteger(urutanMatch?.[1]) };
}

function quoteLegacySippIdentifier(identifier: string) {
  if (!/^[a-zA-Z0-9_]+$/.test(identifier)) throw new Error("Identifier SIPP legacy tidak aman.");
  return `\`${identifier}\``;
}

function legacySippWhereColumn(table: string) {
  const normalized = table.toLowerCase();
  if (normalized === "jadwalsidangweb" || normalized === "dataumumweb") return "IDPerkara";
  return "perkara_id";
}

function normalizeLegacyPreviewCode(code: string) {
  return code.replace(/\D/g, "").padStart(4, "0");
}

function inferPreviewUrutanData(variable: Pick<SourcePreviewVariableRow, "legacy_code" | "source_key">) {
  const parsed = parseLegacySippTableColumnSource(variable.source_key);
  if (parsed?.urutanData) return parsed.urutanData;
  const code = normalizeLegacyPreviewCode(variable.legacy_code ?? "");
  return code ? PREVIEW_LEGACY_URUTAN_DATA_BY_CODE[code] ?? 0 : 0;
}

function previewHearingOrder(value: unknown) {
  const raw = normalizeText(
    readPath(value, "sidangKe") ??
      readPath(value, "sidang_ke") ??
      readPath(value, "urutan") ??
      readPath(value, "no_urut"),
    20
  );
  return normalizePositiveInteger(raw);
}

function previewHearingId(value: unknown) {
  return normalizeText(
    readPath(value, "sidangId") ??
      readPath(value, "sidang_id") ??
      readPath(value, "id") ??
      readPath(value, "jadwalSidangId") ??
      readPath(value, "jadwal_sidang_id"),
    80
  );
}

function pickPreviewHearing(schedule: unknown[], params: Record<string, unknown>) {
  if (!schedule.length) return null;
  const sidangId = normalizeText(params.sidangId ?? params.sidang_id, 80);
  if (sidangId) {
    const byId = schedule.find((item) => previewHearingId(item) === sidangId);
    if (byId) return byId;
  }
  const sidangUrutan = resolveSidangUrutan(params);
  if (sidangUrutan) {
    const byOrder = schedule.find((item) => previewHearingOrder(item) === sidangUrutan);
    if (byOrder) return byOrder;
  }
  return null;
}

function pickPreviewHearingByRelativeOrder(schedule: unknown[], selected: unknown, offset: number) {
  const order = previewHearingOrder(selected);
  if (order) return schedule.find((item) => previewHearingOrder(item) === order + offset) ?? null;
  const index = schedule.findIndex((item) => item === selected || previewHearingId(item) === previewHearingId(selected));
  return index >= 0 ? schedule[index + offset] ?? null : null;
}

function readPreviewHearingField(hearing: unknown, sourceKey: string) {
  if (!hearing) return null;
  const normalized = sourceKey
    .replace(/^sidang\.urutan\.\d+\./i, "")
    .replace(/^(sidang\.)?(terpilih|sebelumnya|berikutnya|previous|next)\./i, "");
  const aliases: Record<string, string[]> = {
    urutan: ["urutan", "sidangKe", "sidang_ke", "no_urut"],
    order: ["urutan", "sidangKe", "sidang_ke", "no_urut"],
    tanggal_sidang: ["tanggalSidang", "tanggal_sidang", "tanggal", "tgl_sidang"],
    tanggal: ["tanggalSidang", "tanggal_sidang", "tanggal", "tgl_sidang"],
    hari_sidang: ["tanggalSidang", "tanggal_sidang", "tanggal", "tgl_sidang"],
    jam_sidang: ["jamSidang", "jam_sidang", "jam"],
    agenda: ["agendaSidang", "agenda_sidang", "agenda", "acara"],
    agenda_sidang: ["agendaSidang", "agenda_sidang", "agenda", "acara"],
    ruangan: ["ruangan", "ruang_sidang", "room"],
    ruang_sidang: ["ruangan", "ruang_sidang", "room"],
    dihadiri_oleh: ["dihadiri_oleh", "dihadiriOleh"],
    alasan_ditunda: ["alasan_ditunda", "alasanDitunda"],
    tanggal_ditunda: ["tanggal_ditunda", "tanggalDitunda"],
    agenda_sblmnya: ["agenda_sblmnya", "agendaSblmnya"],
    alasan_sblmnya: ["alasan_sblmnya", "alasanSblmnya"],
  };
  for (const key of aliases[normalized] ?? [normalized]) {
    const value = readPath(hearing, key);
    if (value !== undefined && value !== null && String(value).trim() !== "") return value;
  }
  return null;
}

function resolvePreviewComputedValue(variable: SourcePreviewVariableRow, params: Record<string, unknown>, detail: unknown) {
  const nomorPerkara = resolveNomorPerkara(params);
  const caseType = resolveJenisPerkara(params, detail).toLowerCase();
  const sourceKey = variable.source_key.toLowerCase();
  if (sourceKey.includes("penyebutan_pihak1")) return nomorPerkara.includes("/Pdt.P/") ? "Pemohon" : "Penggugat";
  if (sourceKey.includes("penyebutan_pihak2")) return nomorPerkara.includes("/Pdt.P/") ? "Termohon" : "Tergugat";
  if (sourceKey.includes("jenis_gugatan_permohonan")) return caseType.includes("permohonan") || nomorPerkara.includes("/Pdt.P/") ? "permohonan" : "gugatan";
  if (sourceKey.includes("putusan_atau_penetapan")) return nomorPerkara.includes("/Pdt.P/") ? "penetapan" : "putusan";
  if (sourceKey.includes("nomor_perkara")) return nomorPerkara;
  return variable.fallback_value || null;
}

async function loadPreviewLegacyDependencyVariable(db: AletaDatabase, code: string) {
  const normalized = normalizeLegacyPreviewCode(code);
  const row = await db.prepare(
    `SELECT id, key, label, legacy_code, data_type, source_type, source_key, transform_key, fallback_value,
            legacy_abt_type, admin_note, sipp_query_preview, sipp_query_preview_status, sipp_query_preview_key
     FROM jlf_variables
     WHERE is_active = 1
       AND (
         legacy_code = ?
         OR key = ?
         OR key LIKE ?
         OR key LIKE ?
         OR source_key = ?
       )
     ORDER BY
       CASE
         WHEN legacy_code = ? THEN 0
         WHEN key = ? THEN 1
         WHEN key LIKE ? THEN 2
         ELSE 3
       END,
       updated_at DESC
     LIMIT 1`
  ).get<SourcePreviewVariableRow>(
    normalized,
    `legacy_${normalized}`,
    `legacy_${normalized}_%`,
    `abt_sql_${normalized}_%`,
    `legacy_sql.${normalized}`,
    normalized,
    `legacy_${normalized}`,
    `abt_sql_${normalized}_%`
  );
  if (row) return row;
  const virtual = PREVIEW_LEGACY_AUTO_VARIABLES[normalized];
  return virtual
    ? {
        ...virtual,
        id: `virtual:${normalized}`,
        legacy_code: normalized,
        sipp_query_preview: "",
      } satisfies SourcePreviewVariableRow
    : null;
}

async function resolvePreviewLegacyDependencyValue(
  db: AletaDatabase,
  provider: ReturnType<typeof JlfSippProviderRegistry.getProvider>,
  code: string,
  params: Record<string, unknown>,
  detail: unknown,
  values: Record<string, unknown>,
  depth: number
): Promise<unknown> {
  if (depth > 5) return null;
  const variable = await loadPreviewLegacyDependencyVariable(db, code);
  if (!variable) return null;
  const nomorPerkara = resolveNomorPerkara(params);
  const detailRecord = detail && typeof detail === "object" ? detail as Record<string, unknown> : {};
  const perkaraId = normalizeText(params.perkaraId ?? params.perkara_id ?? detailRecord.perkaraId ?? detailRecord.perkara_id, 80);

  if (variable.source_type === "computed" || variable.source_type === "function") {
    return resolvePreviewComputedValue(variable, params, detail);
  }

  if (variable.source_type === "abt_sql" || variable.legacy_abt_type === "data_sql") {
    for (const nestedCode of detectLegacySqlDependencyCodes(variable.sipp_query_preview)) {
      if (nestedCode === code || nestedCode === "0001" || Object.prototype.hasOwnProperty.call(values, nestedCode)) continue;
      const nestedValue = await resolvePreviewLegacyDependencyValue(db, provider, nestedCode, params, detail, values, depth + 1);
      if (nestedValue !== null && nestedValue !== undefined && nestedValue !== "") putLegacyPlaceholder(values, nestedCode, nestedValue);
    }
    const result = await provider.executeLegacySqlValue({
      sql: variable.sipp_query_preview,
      perkaraId,
      nomorPerkara,
      placeholderValues: values,
    });
    return result.value ?? result.data ?? null;
  }

  const parsed = parseLegacySippTableColumnSource(variable.source_key);
  if (parsed && perkaraId) {
    const table = quoteLegacySippIdentifier(parsed.table);
    const column = quoteLegacySippIdentifier(parsed.column);
    const whereColumn = quoteLegacySippIdentifier(legacySippWhereColumn(parsed.table));
    const urutanData = inferPreviewUrutanData(variable);
    const urutanWhere = urutanData ? ` AND ${quoteLegacySippIdentifier("urutan")}=${urutanData}` : "";
    const result = await provider.executeLegacySqlValue({
      sql: `SELECT ${column} AS data FROM ${table} WHERE CAST(${whereColumn} AS CHAR)=#perkara_id#${urutanWhere} LIMIT 1`,
      perkaraId,
      nomorPerkara,
      placeholderValues: values,
    });
    return result.value ?? result.data ?? null;
  }

  if (variable.source_type === "sipp_jadwal_sidang" && perkaraId) {
    const schedule = await provider.getCaseSchedule(perkaraId, { nomorPerkara });
    const selected = pickPreviewHearing(schedule, params);
    const orderMatch = variable.source_key.match(/^sidang\.urutan\.(\d+)\.(.+)$/i);
    if (orderMatch) {
      const targetOrder = normalizePositiveInteger(orderMatch[1]);
      const target = schedule.find((item) => previewHearingOrder(item) === targetOrder) ?? null;
      return readPreviewHearingField(target, orderMatch[2] ?? "");
    }
    if (/sebelumnya|previous/i.test(variable.source_key)) {
      return readPreviewHearingField(selected ? pickPreviewHearingByRelativeOrder(schedule, selected, -1) : null, variable.source_key);
    }
    if (/berikutnya|next/i.test(variable.source_key)) {
      return readPreviewHearingField(selected ? pickPreviewHearingByRelativeOrder(schedule, selected, 1) : null, variable.source_key);
    }
    return readPreviewHearingField(selected, variable.source_key);
  }

  return variable.fallback_value || null;
}

async function buildLegacyPreviewPlaceholderValues(
  db: AletaDatabase,
  provider: ReturnType<typeof JlfSippProviderRegistry.getProvider>,
  params: Record<string, unknown>,
  detail: unknown,
  variable: SourcePreviewVariableRow | null | undefined,
  sqlPreview: string
) {
  const nomorPerkara = resolveNomorPerkara(params);
  const detailRecord = detail && typeof detail === "object" ? detail as Record<string, unknown> : {};
  const perkaraId = normalizeText(params.perkaraId ?? params.perkara_id ?? detailRecord.perkaraId ?? detailRecord.perkara_id, 80);
  const jenisPerkara = resolveJenisPerkara(params, detail);
  const values: Record<string, unknown> = {
    nomorPerkara,
    nomor_perkara: nomorPerkara,
    perkaraId,
    perkara_id: perkaraId,
    caseType: jenisPerkara,
    case_type: jenisPerkara,
    jenisPerkara,
    jenis_perkara: jenisPerkara,
    alurPerkara: jenisPerkara,
    alur_perkara: jenisPerkara,
  };
  putLegacyPlaceholder(values, "0001", nomorPerkara);
  if (perkaraId) {
    const schedule = await provider.getCaseSchedule(perkaraId, { nomorPerkara });
    const selected = pickPreviewHearing(schedule, params);
    if (selected) {
      putLegacyPlaceholder(values, "0032", readPreviewHearingField(selected, "sidang.terpilih.tanggal_sidang"));
      putLegacyPlaceholder(values, "0033", readPreviewHearingField(selected, "sidang.terpilih.tanggal_sidang"));
      putLegacyPlaceholder(values, "0050", readPreviewHearingField(selected, "sidang.terpilih.urutan"));
      putLegacyPlaceholder(values, "0079", readPreviewHearingField(selected, "sidang.terpilih.alasan_ditunda"));
      putLegacyPlaceholder(values, "0090", readPreviewHearingField(selected, "sidang.terpilih.dihadiri_oleh"));
      putLegacyPlaceholder(values, "0133", readPreviewHearingField(selected, "sidang.terpilih.tanggal_ditunda"));
      putLegacyPlaceholder(values, "0134", readPreviewHearingField(selected, "sidang.terpilih.tanggal_ditunda"));
      putLegacyPlaceholder(values, "0163", readPreviewHearingField(selected, "sidang.terpilih.ruangan"));
    }
  }
  if (variable?.legacy_code) putLegacyPlaceholder(values, variable.legacy_code, "");
  for (const code of detectLegacySqlDependencyCodes(sqlPreview)) {
    if (code === "0001" || code === variable?.legacy_code) continue;
    const value = await resolvePreviewLegacyDependencyValue(db, provider, code, params, detail, values, 0);
    if (value !== null && value !== undefined && value !== "") putLegacyPlaceholder(values, code, value);
  }
  return values;
}

async function loadPreviewVariable(db: AletaDatabase, input: SourcePreviewInput) {
  const variableId = normalizeText(input.variableId, 160);
  if (variableId) {
    return db.prepare(
      `SELECT id, key, legacy_code, source_type, source_key, admin_note,
              label, data_type, transform_key, fallback_value, legacy_abt_type,
              sipp_query_preview, sipp_query_preview_status, sipp_query_preview_key
       FROM jlf_variables
       WHERE id = ?`
    ).get<SourcePreviewVariableRow>(variableId);
  }

  const variableKey = normalizeText(input.variableKey, 140);
  if (!variableKey) return null;
  return db.prepare(
    `SELECT id, key, legacy_code, source_type, source_key, admin_note,
            label, data_type, transform_key, fallback_value, legacy_abt_type,
            sipp_query_preview, sipp_query_preview_status, sipp_query_preview_key
     FROM jlf_variables
     WHERE key = ?
     ORDER BY updated_at DESC
     LIMIT 1`
  ).get<SourcePreviewVariableRow>(variableKey);
}

function resolveStoredSqlPreview(input: SourcePreviewInput, variable: SourcePreviewVariableRow | null | undefined) {
  return normalizeText(variable?.sipp_query_preview || input.sqlPreview, 20000);
}

function shouldUseLegacyAbtPreview(input: SourcePreviewInput, variable: SourcePreviewVariableRow | null | undefined, storedSql: string) {
  if (!storedSql) return false;
  const sourceType = normalizeText(input.sourceType ?? variable?.source_type, 80).toLowerCase();
  const legacyAbtType = normalizeText(input.legacyAbtType, 80).toLowerCase();
  if (sourceType === "abt_sql") return true;
  if (legacyAbtType === "data_sql") return true;
  const storedKey = normalizeText(variable?.sipp_query_preview_key, 120);
  const queryKey = normalizeText(input.queryKey || storedKey, 120);
  return !queryKey;
}

async function requireRegistryCheck<T>(promise: Promise<T>) {
  try {
    return await promise;
  } catch (error) {
    jlfBadRequest(error instanceof Error ? error.message : "Query JLF/SIPP belum valid di database registry.");
  }
}

async function executeRegisteredPreview(db: AletaDatabase, queryKey: string, params: Record<string, unknown>, limit: number) {
  await requireRegistryCheck(assertJlfSippQueryRegisteredInDatabase(db, queryKey));
  const provider = JlfSippProviderRegistry.getProvider();
  const registeredDefinition = getJlfSippQueryDefinition(queryKey);
  assertNoSqlInSippQueryParams(params);
  const validationParams = Object.fromEntries(
    Object.entries(params).filter(([key]) => registeredDefinition.allowedParams.includes(key))
  );
  const definition = validateJlfSippQueryRequest(queryKey, validationParams);
  const nomorPerkara = resolveNomorPerkara(params);
  const detail = nomorPerkara ? await provider.getCaseDetail({ nomorPerkara }) : null;
  const perkaraId = resolvePerkaraId(params, detail);

  switch (definition.bridgeOperation) {
    case "case.searchByNumber":
      return {
        provider: provider.key,
        rows: await provider.searchCasesByNumber(nomorPerkara, { limit }),
      };
    case "case.searchByPartyName":
      return {
        provider: provider.key,
        rows: await provider.searchCasesByPartyName(normalizeText(params.name ?? params.query, 120), { limit }),
      };
    case "case.detail":
      return {
        provider: provider.key,
        rows: detail ? [detail] : [],
      };
    case "case.parties":
      return {
        provider: provider.key,
        rows: perkaraId ? await provider.getCaseParties(perkaraId) : [],
      };
    case "case.witnesses":
      return {
        provider: provider.key,
        rows: perkaraId ? await provider.getCaseWitnesses(perkaraId) : [],
      };
    case "case.schedule": {
      const schedule = perkaraId ? await provider.getCaseSchedule(perkaraId, { nomorPerkara }) : [];
      const sidangId = normalizeText(params.sidangId ?? params.sidang_id, 80);
      const sidangUrutan = resolveSidangUrutan(params);
      return {
        provider: provider.key,
        rows: sidangId || sidangUrutan
          ? schedule.filter((item) => {
              const idMatches = sidangId ? previewHearingId(item) === sidangId : false;
              const orderMatches = sidangUrutan ? previewHearingOrder(item) === sidangUrutan : false;
              return idMatches || orderMatches;
            })
          : schedule,
      };
    }
    case "case.lastHearing":
      return {
        provider: provider.key,
        rows: perkaraId ? asRows(await provider.getLastHearing(perkaraId, { nomorPerkara }), limit) : [],
      };
    case "case.nextHearing":
      return {
        provider: provider.key,
        rows: perkaraId ? asRows(await provider.getNextHearing(perkaraId, { nomorPerkara }), limit) : [],
      };
    case "case.judges":
      return {
        provider: provider.key,
        rows: perkaraId ? await provider.getJudges(perkaraId) : [],
      };
    case "case.panitera":
      return {
        provider: provider.key,
        rows: perkaraId ? await provider.getPanitera(perkaraId) : [],
      };
    case "case.jurusita":
      return {
        provider: provider.key,
        rows: perkaraId ? await provider.getJurusita(perkaraId) : [],
      };
    case "case.mediator":
      return {
        provider: provider.key,
        rows: perkaraId ? await provider.getMediator(perkaraId) : [],
      };
    case "case.decision":
      return {
        provider: provider.key,
        rows: perkaraId ? asRows(await provider.getDecisionData(perkaraId), limit) : [],
      };
    case "satker.config":
      return {
        provider: provider.key,
        rows: asRows(await provider.getSatkerConfig(), limit),
      };
  }
}

async function executeLegacyAbtPreview(
  db: AletaDatabase,
  actor: UserPersona,
  input: SourcePreviewInput,
  params: Record<string, unknown>,
  limit: number,
  variable: SourcePreviewVariableRow | null | undefined,
  audit?: { ipAddress?: string; userAgent?: string }
) {
  const provider = JlfSippProviderRegistry.getProvider();
  const sqlPreview = resolveStoredSqlPreview(input, variable);
  const safety = validateJlfSelectOnlySql(sqlPreview);
  if (!safety.selectOnly) jlfBadRequest(safety.blockedReason ?? "Query ABT tidak lolos SELECT-only guard.");
  const registeredLegacyQuery = await requireRegistryCheck(
    assertJlfLegacySqlRegisteredInDatabase(db, {
      queryKey: input.queryKey || variable?.sipp_query_preview_key,
      sqlPreview,
    })
  );

  const nomorPerkara = resolveNomorPerkara(params);
  const detail = nomorPerkara ? await provider.getCaseDetail({ nomorPerkara }) : null;
  const perkaraId = resolvePerkaraId(params, detail);
  if (!perkaraId) jlfBadRequest("Perkara ID belum ditemukan. Isi nomor perkara valid atau perkara_id untuk preview query ABT.");

  const result = await provider.executeLegacySqlValue({
    sql: sqlPreview,
    perkaraId,
    nomorPerkara,
    placeholderValues: await buildLegacyPreviewPlaceholderValues(db, provider, params, detail, variable, sqlPreview),
  });
  const value = result.value ?? result.data ?? null;
  const rows = asRows(value === null || value === undefined ? [] : [{ data: value }], limit);
  const mappedValues = value === null || value === undefined ? [] : [value];
  const rowCount = result.rowCount ?? rows.length;

  await logAction(db, {
    userId: actor.id,
    action: "source.preview",
    entityType: "jlf_abt_sql",
    entityId: variable?.id ?? input.variableKey ?? "abt_sql",
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
    metadata: {
      provider: provider.key,
      sourceType: input.sourceType ?? variable?.source_type,
      sourceKey: input.sourceKey ?? variable?.source_key,
      variableKey: variable?.key ?? input.variableKey,
      limit,
      rowCount,
      queryHash: result.queryHash,
      nomorPerkara: nomorPerkara ? "provided" : "empty",
      jenisPerkara: resolveJenisPerkara(params, detail) ? "provided" : "empty",
    },
  });

  return {
    provider: provider.key,
    queryKey: registeredLegacyQuery.queryKey,
    queryPreview: {
      status: "needs_review" as const,
      queryKey: registeredLegacyQuery.queryKey,
      title: "Preview SQL ABT tersimpan",
      description: "Query ABT dijalankan melalui adapter SIPP read-only dengan placeholder aman dari perkara sampel.",
      sqlPreview,
      outputPath: input.sourceKey ?? variable?.source_key ?? "data",
      allowedParams: ["nomor_perkara", "perkara_id", "jenis_perkara", "alur_perkara", "sidang_id", "sidang_urutan", "limit"],
      readOnly: true,
      selectOnly: true,
      blockedReason: null,
      safetyNotes: [
        "SQL diambil dari katalog variabel JLF, bukan raw query bebas.",
        "Eksekusi melewati bridge SIPP read-only dan guard SELECT-only.",
      ],
    },
    selectOnly: true,
    rawSqlEndpoint: false,
    rows,
    mappedValues,
    rowCount,
    sqlValue: value,
    queryHash: result.queryHash,
    message: rowCount
      ? "Preview query ABT berhasil dari adapter SIPP read-only."
      : "Query ABT valid tetapi tidak mengembalikan baris untuk perkara/alur sampel ini.",
  };
}

export async function previewJlfSourceData(
  db: AletaDatabase,
  actor: UserPersona,
  input: SourcePreviewInput,
  audit?: { ipAddress?: string; userAgent?: string }
) {
  requireJlfPermission(actor, JLF_PERMISSION.VARIABLE_UPDATE);

  const params = input.params ?? {};
  const variable = await loadPreviewVariable(db, input);
  const storedSqlPreview = resolveStoredSqlPreview(input, variable);
  if (shouldUseLegacyAbtPreview(input, variable, storedSqlPreview)) {
    return executeLegacyAbtPreview(db, actor, input, params, normalizeLimit(input.limit ?? params.limit), variable, audit);
  }

  const detectedPreview = resolveJlfVariableQueryPreview({
    sourceType: input.sourceType ?? variable?.source_type ?? "",
    sourceKey: input.sourceKey ?? variable?.source_key ?? "",
    key: input.variableKey ?? variable?.key ?? "",
    adminNote: input.adminNote ?? variable?.admin_note ?? "",
  });
  const queryKey = normalizeText(input.queryKey || variable?.sipp_query_preview_key || detectedPreview.queryKey, 120);
  if (!queryKey) jlfBadRequest("Query key terdaftar wajib dipilih untuk preview sumber data.");

  const preview = resolveJlfVariableQueryPreview({
    sourceType: input.sourceType ?? variable?.source_type ?? "",
    sourceKey: input.sourceKey || queryKey,
    key: input.variableKey ?? variable?.key ?? "",
    adminNote: input.adminNote ?? variable?.admin_note ?? "",
  });
  const safety = validateJlfSelectOnlySql(preview.sqlPreview);
  if (!safety.selectOnly) jlfBadRequest(safety.blockedReason ?? "Query preview tidak lolos SELECT-only guard.");

  getJlfSippQueryDefinition(queryKey);
  const limit = normalizeLimit(input.limit ?? params.limit);
  const execution = await executeRegisteredPreview(db, queryKey, { ...params, limit }, limit);
  const rows = asRows(execution.rows, limit);
  const mappedValues = input.sourceKey
    ? rows.map((row) => readPath(row, input.sourceKey ?? "")).filter((value) => value !== undefined)
    : [];

  await logAction(db, {
    userId: actor.id,
    action: "source.preview",
    entityType: "jlf_sipp_query",
    entityId: queryKey,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
    metadata: {
      provider: execution.provider,
      sourceType: input.sourceType ?? variable?.source_type,
      sourceKey: input.sourceKey ?? variable?.source_key,
      limit,
      rowCount: rows.length,
    },
  });

  return {
    provider: execution.provider,
    queryKey,
    queryDefinition: getJlfSippQueryDefinition(queryKey),
    queryPreview: preview,
    selectOnly: true,
    rawSqlEndpoint: false,
    rows,
    mappedValues,
    rowCount: rows.length,
    message: rows.length
      ? "Preview berhasil dari adapter SIPP read-only."
      : "Adapter tidak mengembalikan data sampel. Mapping tetap bisa disimpan, tetapi perlu diuji dengan perkara yang valid.",
  };
}

export const JlfSourcePreviewService = {
  previewJlfSourceData,
};
