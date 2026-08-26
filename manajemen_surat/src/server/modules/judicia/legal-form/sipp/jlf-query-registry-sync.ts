import { createHash } from "node:crypto";

import { listJlfSippQueryPreviewDefinitions } from "@/lib/judicia-legal-form-query-preview";
import type { AletaDatabase } from "@/server/db/client";
import { normalizeAletaSippSql, validateReadOnlySql } from "@/server/modules/aleta-sipp/aleta-sipp-sql-validator";

export type JlfQueryRegistrySeed = {
  queryKey: string;
  queryName: string;
  category: string;
  sourceType: string;
  sourceFile: string;
  sourceLocation?: string;
  sourceLine?: number | null;
  description: string;
  businessPurpose: string;
  sql: string;
  relatedVariableCodes?: string[];
  relatedVariableKeys?: string[];
  confidenceScore?: number;
  reviewStatus?: string;
  executionMode?: string;
  isPdfUsable?: boolean;
};

type JlfVariablePreviewRow = {
  key: string;
  legacy_code: string | null;
  label: string;
  source_type: string;
  source_key: string;
  legacy_abt_type: string;
  sipp_query_preview: string;
  sipp_query_preview_key: string;
  sipp_query_preview_status: string;
  updated_at: string;
};

export type JlfQueryRegistrySyncSummary = {
  discovered: number;
  inserted: number;
  updated: number;
  unchanged: number;
  invalid: number;
  needsReview: number;
  failed: number;
  sourceCounts: Record<string, number>;
  failures: Array<{ queryKey: string; error: string }>;
};

type RegistryRow = {
  id: string;
  query_key: string;
  original_sql: string;
  normalized_sql: string;
  parameterized_sql: string;
  sql_hash: string;
  security_status: string;
  review_status: string;
  is_active: number;
};

const QUERY_REGISTRY_SOURCE_FILE = "src/server/modules/judicia/legal-form/sipp/jlf-query-registry-sync.ts";

const CANONICAL_JLF_QUERIES: JlfQueryRegistrySeed[] = [
  {
    queryKey: "jlf.jadwal_sidang.by_perkara_id",
    queryName: "JLF Jadwal Sidang Berdasarkan Perkara",
    category: "JLF Persidangan",
    sourceType: "JLF_CANONICAL",
    sourceFile: QUERY_REGISTRY_SOURCE_FILE,
    description: "Query canonical jadwal sidang JLF berdasarkan perkara_id dengan parameter aman.",
    businessPurpose: "Mendukung template legal form yang membutuhkan daftar jadwal sidang perkara.",
    sql: `SELECT
  p.nomor_perkara AS nomor_perkara,
  pjs.tanggal_sidang AS jadwal_sidang
FROM perkara p
INNER JOIN perkara_jadwal_sidang pjs
  ON p.perkara_id = pjs.perkara_id
WHERE p.alur_perkara_id != 114
  AND p.perkara_id = :perkara_id
  AND pjs.tanggal_sidang IS NOT NULL
ORDER BY
  pjs.tanggal_sidang ASC,
  p.nomor_perkara ASC`,
    confidenceScore: 92,
    isPdfUsable: true,
  },
  {
    queryKey: "jlf.nomor_perkara.by_perkara_id",
    queryName: "JLF Nomor Perkara Berdasarkan Perkara ID",
    category: "JLF Perkara",
    sourceType: "JLF_CANONICAL",
    sourceFile: QUERY_REGISTRY_SOURCE_FILE,
    description: "Mengambil nomor perkara dari tabel perkara.",
    businessPurpose: "Mengisi variabel nomor perkara pada template legal form.",
    sql: "SELECT p.perkara_id, p.nomor_perkara FROM perkara AS p WHERE p.perkara_id = :perkara_id LIMIT 1",
    confidenceScore: 94,
  },
  {
    queryKey: "jlf.pihak.pemohon.by_perkara_id",
    queryName: "JLF Penggugat/Pemohon Berdasarkan Perkara",
    category: "JLF Pihak",
    sourceType: "JLF_CANONICAL",
    sourceFile: QUERY_REGISTRY_SOURCE_FILE,
    description: "Mengambil pihak pertama perkara, yaitu penggugat atau pemohon.",
    businessPurpose: "Mengisi identitas pihak pertama pada template legal form.",
    sql: `SELECT pp.perkara_id,
  pp.urutan,
  COALESCE(pp.nama, ph.nama) AS nama,
  COALESCE(pp.alamat, ph.alamat) AS alamat,
  ph.pekerjaan,
  ph.tempat_lahir,
  ph.tanggal_lahir
FROM perkara_pihak1 AS pp
LEFT JOIN pihak AS ph ON ph.id = pp.pihak_id
WHERE pp.perkara_id = :perkara_id
ORDER BY pp.urutan ASC`,
    confidenceScore: 88,
  },
  {
    queryKey: "jlf.pihak.termohon.by_perkara_id",
    queryName: "JLF Tergugat/Termohon Berdasarkan Perkara",
    category: "JLF Pihak",
    sourceType: "JLF_CANONICAL",
    sourceFile: QUERY_REGISTRY_SOURCE_FILE,
    description: "Mengambil pihak kedua perkara, yaitu tergugat atau termohon.",
    businessPurpose: "Mengisi identitas pihak kedua pada template legal form.",
    sql: `SELECT pp.perkara_id,
  pp.urutan,
  COALESCE(pp.nama, ph.nama) AS nama,
  COALESCE(pp.alamat, ph.alamat) AS alamat,
  ph.pekerjaan,
  ph.tempat_lahir,
  ph.tanggal_lahir
FROM perkara_pihak2 AS pp
LEFT JOIN pihak AS ph ON ph.id = pp.pihak_id
WHERE pp.perkara_id = :perkara_id
ORDER BY pp.urutan ASC`,
    confidenceScore: 88,
  },
  {
    queryKey: "jlf.kuasa_hukum.by_perkara_id",
    queryName: "JLF Kuasa Hukum Berdasarkan Perkara",
    category: "JLF Pihak",
    sourceType: "JLF_CANONICAL",
    sourceFile: QUERY_REGISTRY_SOURCE_FILE,
    description: "Mengambil data kuasa hukum para pihak.",
    businessPurpose: "Mengisi variabel kuasa hukum pada template legal form.",
    sql: `SELECT pa.perkara_id,
  pa.pihak_ke,
  pa.urutan,
  pa.nama,
  pa.tanggal_kuasa,
  pa.keterangan
FROM perkara_pengacara AS pa
WHERE pa.perkara_id = :perkara_id
ORDER BY pa.pihak_ke ASC, pa.urutan ASC`,
    confidenceScore: 84,
  },
  {
    queryKey: "jlf.hakim.by_perkara_id",
    queryName: "JLF Hakim Majelis/Tunggal Berdasarkan Perkara",
    category: "JLF Aparatur",
    sourceType: "JLF_CANONICAL",
    sourceFile: QUERY_REGISTRY_SOURCE_FILE,
    description: "Mengambil daftar hakim perkara.",
    businessPurpose: "Mengisi variabel hakim/majelis pada template legal form.",
    sql: `SELECT php.perkara_id,
  php.urutan,
  hp.id AS hakim_id,
  COALESCE(hp.nama_gelar, hp.nama) AS nama,
  php.jabatan_hakim_nama AS jabatan,
  php.aktif
FROM perkara_hakim_pn AS php
LEFT JOIN hakim_pn AS hp ON hp.id = php.hakim_id
WHERE php.perkara_id = :perkara_id
ORDER BY php.urutan ASC`,
    confidenceScore: 88,
    isPdfUsable: true,
  },
  {
    queryKey: "jlf.panitera_pengganti.by_perkara_id",
    queryName: "JLF Panitera Pengganti Berdasarkan Perkara",
    category: "JLF Aparatur",
    sourceType: "JLF_CANONICAL",
    sourceFile: QUERY_REGISTRY_SOURCE_FILE,
    description: "Mengambil panitera pengganti perkara.",
    businessPurpose: "Mengisi variabel panitera pengganti pada template legal form.",
    sql: `SELECT ppp.perkara_id,
  pp.id AS panitera_id,
  COALESCE(pp.nama_gelar, pp.nama) AS nama,
  ppp.aktif
FROM perkara_panitera_pn AS ppp
LEFT JOIN panitera_pn AS pp ON pp.id = ppp.panitera_id
WHERE ppp.perkara_id = :perkara_id
ORDER BY ppp.aktif DESC, ppp.id DESC`,
    confidenceScore: 86,
    isPdfUsable: true,
  },
  {
    queryKey: "jlf.jurusita.by_perkara_id",
    queryName: "JLF Jurusita/JSP Berdasarkan Perkara",
    category: "JLF Aparatur",
    sourceType: "JLF_CANONICAL",
    sourceFile: QUERY_REGISTRY_SOURCE_FILE,
    description: "Mengambil jurusita atau jurusita pengganti perkara.",
    businessPurpose: "Mengisi variabel jurusita/JSP pada template legal form.",
    sql: `SELECT pj.perkara_id,
  j.id AS jurusita_id,
  COALESCE(j.nama_gelar, j.nama) AS nama,
  pj.aktif
FROM perkara_jurusita AS pj
LEFT JOIN jurusita AS j ON j.id = pj.jurusita_id
WHERE pj.perkara_id = :perkara_id
ORDER BY pj.aktif DESC, pj.id DESC`,
    confidenceScore: 86,
  },
  {
    queryKey: "jlf.mediator.by_perkara_id",
    queryName: "JLF Mediator Berdasarkan Perkara",
    category: "JLF Mediasi",
    sourceType: "JLF_CANONICAL",
    sourceFile: QUERY_REGISTRY_SOURCE_FILE,
    description: "Mengambil mediator dan hasil mediasi perkara.",
    businessPurpose: "Mengisi variabel mediator/mediasi pada template legal form.",
    sql: `SELECT pm.perkara_id,
  pm.mediator_id,
  pm.mediator_text AS mediator,
  COALESCE(pm.dimulai_mediasi, pm.penetapan_tanggal_mediasi) AS tanggal_mediasi,
  pm.hasil_mediasi
FROM perkara_mediasi AS pm
WHERE pm.perkara_id = :perkara_id
ORDER BY COALESCE(pm.dimulai_mediasi, pm.penetapan_tanggal_mediasi) DESC
LIMIT 1`,
    confidenceScore: 84,
  },
  {
    queryKey: "jlf.putusan.by_perkara_id",
    queryName: "JLF Data Putusan Berdasarkan Perkara",
    category: "JLF Putusan",
    sourceType: "JLF_CANONICAL",
    sourceFile: QUERY_REGISTRY_SOURCE_FILE,
    description: "Mengambil ringkasan data putusan perkara.",
    businessPurpose: "Mengisi variabel putusan pada template legal form.",
    sql: `SELECT pt.perkara_id,
  pt.tanggal_putusan,
  pt.amar_putusan,
  pt.status_putusan_nama,
  pt.tanggal_minutasi
FROM perkara_putusan AS pt
WHERE pt.perkara_id = :perkara_id
LIMIT 1`,
    confidenceScore: 88,
    isPdfUsable: true,
  },
  {
    queryKey: "jlf.amar_putusan.by_perkara_id",
    queryName: "JLF Amar Putusan Berdasarkan Perkara",
    category: "JLF Putusan",
    sourceType: "JLF_CANONICAL",
    sourceFile: QUERY_REGISTRY_SOURCE_FILE,
    description: "Mengambil amar putusan perkara.",
    businessPurpose: "Mengisi variabel amar putusan pada template legal form.",
    sql: "SELECT pt.perkara_id, pt.amar_putusan FROM perkara_putusan AS pt WHERE pt.perkara_id = :perkara_id LIMIT 1",
    confidenceScore: 88,
    isPdfUsable: true,
  },
  {
    queryKey: "jlf.tanggal_putusan.by_perkara_id",
    queryName: "JLF Tanggal Putusan Berdasarkan Perkara",
    category: "JLF Putusan",
    sourceType: "JLF_CANONICAL",
    sourceFile: QUERY_REGISTRY_SOURCE_FILE,
    description: "Mengambil tanggal putusan perkara.",
    businessPurpose: "Mengisi variabel tanggal putusan pada template legal form.",
    sql: "SELECT pt.perkara_id, pt.tanggal_putusan FROM perkara_putusan AS pt WHERE pt.perkara_id = :perkara_id LIMIT 1",
    confidenceScore: 88,
  },
  {
    queryKey: "jlf.mediasi.by_perkara_id",
    queryName: "JLF Data Mediasi Berdasarkan Perkara",
    category: "JLF Mediasi",
    sourceType: "JLF_CANONICAL",
    sourceFile: QUERY_REGISTRY_SOURCE_FILE,
    description: "Mengambil data mediasi perkara.",
    businessPurpose: "Mengisi variabel mediasi pada template legal form.",
    sql: "SELECT pm.* FROM perkara_mediasi AS pm WHERE pm.perkara_id = :perkara_id LIMIT 1",
    confidenceScore: 80,
  },
  {
    queryKey: "jlf.relaas_panggilan.by_perkara_id",
    queryName: "JLF Relaas/Panggilan Berdasarkan Perkara",
    category: "JLF Relaas",
    sourceType: "JLF_CANONICAL",
    sourceFile: QUERY_REGISTRY_SOURCE_FILE,
    description: "Mengambil data relaas/panggilan perkara bila tersedia pada SIPP.",
    businessPurpose: "Mengisi variabel relaas dan panggilan pada template legal form.",
    sql: `SELECT pr.perkara_id,
  pr.tanggal_relaas,
  pr.tanggal_jursit_pos,
  pr.no_resi_pos,
  pr.status_pos,
  pr.ket_temu,
  pr.ket_hasil_relaas
FROM perkara_pelaksanaan_relaas AS pr
WHERE pr.perkara_id = :perkara_id
ORDER BY pr.tanggal_relaas DESC, pr.id DESC`,
    confidenceScore: 72,
    reviewStatus: "NEEDS_ADMIN_REVIEW",
  },
  {
    queryKey: "jlf.data_sidang.by_perkara_id",
    queryName: "JLF Data Sidang Berdasarkan Perkara",
    category: "JLF Persidangan",
    sourceType: "JLF_CANONICAL",
    sourceFile: QUERY_REGISTRY_SOURCE_FILE,
    description: "Mengambil data sidang lengkap berdasarkan perkara.",
    businessPurpose: "Mengisi variabel data sidang/multi_sidang pada template legal form.",
    sql: `SELECT js.id AS sidang_id,
  js.perkara_id,
  js.urutan,
  js.tanggal_sidang,
  js.jam_sidang,
  js.agenda,
  js.ruangan,
  js.dihadiri_oleh
FROM perkara_jadwal_sidang AS js
WHERE js.perkara_id = :perkara_id
ORDER BY js.urutan ASC, js.tanggal_sidang ASC, js.id ASC`,
    confidenceScore: 90,
    isPdfUsable: true,
  },
  {
    queryKey: "jlf.durasi_perkara.by_perkara_id",
    queryName: "JLF Durasi Perkara Berdasarkan Perkara",
    category: "JLF Monitoring",
    sourceType: "JLF_CANONICAL",
    sourceFile: QUERY_REGISTRY_SOURCE_FILE,
    description: "Menghitung durasi perkara dari tanggal pendaftaran sampai putusan atau hari ini.",
    businessPurpose: "Mendukung template dan monitoring durasi perkara.",
    sql: `SELECT p.perkara_id,
  p.nomor_perkara,
  p.tanggal_pendaftaran,
  pt.tanggal_putusan,
  DATEDIFF(COALESCE(pt.tanggal_putusan, CURRENT_DATE), p.tanggal_pendaftaran) AS durasi_hari
FROM perkara AS p
LEFT JOIN perkara_putusan AS pt ON pt.perkara_id = p.perkara_id
WHERE p.perkara_id = :perkara_id
LIMIT 1`,
    confidenceScore: 82,
  },
];

function jsonString(value: unknown) {
  return JSON.stringify(value);
}

function stableId(prefix: string, key: string) {
  return `${prefix}_${createHash("sha1").update(key).digest("hex").slice(0, 32)}`;
}

function sqlHash(sql: string) {
  return createHash("sha1").update(normalizeAletaSippSql(sql).toLowerCase()).digest("hex");
}

function normalizeRegistryKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 180);
}

function toRegistrySql(sql: string) {
  return normalizeAletaSippSql(
    String(sql || "")
      .replace(/#([a-zA-Z_][a-zA-Z0-9_]*)#/g, ":$1")
      .replace(/;+\s*$/g, "")
  );
}

function parameterizedSql(sql: string) {
  return normalizeAletaSippSql(sql).replace(/:[a-zA-Z_][a-zA-Z0-9_]*/g, "?");
}

function extractParameters(sql: string) {
  const names = Array.from(new Set(Array.from(sql.matchAll(/:([a-zA-Z_][a-zA-Z0-9_]*)/g)).map((match) => match[1])));
  return names.map((name) => ({
    name,
    label: name.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()),
    type: /tanggal|date|mulai|selesai/i.test(name) ? "date" : /id|urutan|limit/i.test(name) ? "number" : "text",
    required: true,
    example: /tanggal|date/i.test(name) ? "2026-01-01" : name === "perkara_id" ? "12345" : "contoh",
  }));
}

function extractTables(sql: string) {
  return Array.from(new Set(Array.from(sql.matchAll(/\b(?:FROM|JOIN)\s+`?([a-zA-Z_][a-zA-Z0-9_]*)`?/gi)).map((match) => match[1])));
}

function extractOutputColumns(sql: string) {
  const aliases = Array.from(sql.matchAll(/\bAS\s+`?([a-zA-Z_][a-zA-Z0-9_]*)`?/gi)).map((match) => match[1]);
  if (aliases.length > 0) return Array.from(new Set(aliases)).slice(0, 40);
  const selectMatch = sql.match(/^\s*SELECT\s+([\s\S]+?)\s+FROM\s/i);
  if (!selectMatch) return [];
  return selectMatch[1]
    .split(",")
    .map((part) => part.trim().replace(/`/g, "").split(".").pop()?.replace(/\W.+$/, "") ?? "")
    .filter(Boolean)
    .slice(0, 40);
}

function extractLegacyCodes(sql: string) {
  return Array.from(new Set((sql.match(/#\d{1,5}#/g) ?? []).map((code) => `#${code.replace(/\D/g, "").padStart(4, "0")}#`)));
}

function toSeedFromPreview(preview: ReturnType<typeof listJlfSippQueryPreviewDefinitions>[number]): JlfQueryRegistrySeed | null {
  if (!preview.queryKey || !preview.sqlPreview) return null;
  return {
    queryKey: preview.queryKey,
    queryName: preview.title,
    category: "JLF SIPP Preview",
    sourceType: "JLF_PREVIEW_CATALOG",
    sourceFile: "src/lib/judicia-legal-form-query-preview.ts",
    description: preview.description,
    businessPurpose: "Mendukung preview dan resolver sumber data JLF melalui adapter SIPP read-only.",
    sql: preview.sqlPreview,
    confidenceScore: preview.readOnly ? 86 : 50,
    reviewStatus: preview.status === "registered" ? "AUTO_IMPORTED" : "NEEDS_ADMIN_REVIEW",
    executionMode: preview.status === "registered" ? "READY_READ_ONLY" : "NEEDS_REVIEW",
  };
}

function toSeedFromVariablePreview(row: JlfVariablePreviewRow): JlfQueryRegistrySeed | null {
  if (!row.sipp_query_preview?.trim()) return null;
  const keyBase = normalizeRegistryKey(row.key || row.label || "variable");
  const queryKey = `jlf.variable.${keyBase || stableId("variable", row.sipp_query_preview).slice(0, 16)}`;
  const legacyCode = row.legacy_code?.trim() ? `#${row.legacy_code.replace(/\D/g, "").padStart(4, "0")}#` : "";
  return {
    queryKey,
    queryName: `JLF Variable ${row.label || row.key}`,
    category: row.legacy_abt_type === "data_sql" || row.source_type === "abt_sql" ? "JLF ABT Legacy" : "JLF Variable Preview",
    sourceType: row.legacy_abt_type === "data_sql" || row.source_type === "abt_sql" ? "JLF_VARIABLE_DATA_SQL" : "JLF_VARIABLE_PREVIEW",
    sourceFile: "jlf_variables.sipp_query_preview",
    sourceLocation: row.key,
    description: `Query preview tersimpan untuk variabel JLF ${row.key}.`,
    businessPurpose: "Mendukung audit query variable legal form dan eksekusi preview melalui registry database.",
    sql: row.sipp_query_preview,
    relatedVariableCodes: legacyCode ? [legacyCode] : [],
    relatedVariableKeys: [row.key].filter(Boolean),
    confidenceScore: row.sipp_query_preview_status === "registered" ? 82 : 58,
    reviewStatus: row.sipp_query_preview_status === "registered" ? "AUTO_IMPORTED" : "NEEDS_ADMIN_REVIEW",
  };
}

function evaluateSeed(seed: JlfQueryRegistrySeed) {
  const originalSql = toRegistrySql(seed.sql);
  const validation = validateReadOnlySql(originalSql);
  const parameters = extractParameters(originalSql);
  const tables = extractTables(originalSql);
  const outputColumns = extractOutputColumns(originalSql);
  const relatedVariableCodes = Array.from(new Set([...(seed.relatedVariableCodes ?? []), ...extractLegacyCodes(seed.sql)]));
  const securityStatus = validation.ok ? "SAFE_READ_ONLY" : "REJECTED_WRITE_QUERY";
  const reviewStatus = validation.ok ? seed.reviewStatus ?? "AUTO_IMPORTED" : "NEEDS_ADMIN_REVIEW";
  return {
    ...seed,
    originalSql,
    normalizedSql: validation.normalizedSql || originalSql,
    parameterizedSql: parameterizedSql(originalSql),
    sqlHash: sqlHash(originalSql),
    parameters,
    tables,
    outputColumns,
    relatedVariableCodes,
    relatedVariableKeys: seed.relatedVariableKeys ?? [],
    securityStatus,
    executionMode: validation.ok ? seed.executionMode ?? "READY_READ_ONLY" : "UNSAFE_RAW_SQL",
    reviewStatus,
    isActive: validation.ok ? 1 : 0,
    validationMessage: validation.ok ? validation.reason : validation.blockedReason ?? validation.reason,
    confidenceScore: validation.ok ? seed.confidenceScore ?? 80 : 10,
  };
}

export function listJlfCanonicalQueryRegistrySeeds() {
  return CANONICAL_JLF_QUERIES.map(evaluateSeed);
}

export async function collectJlfQueryRegistrySeeds(db: AletaDatabase) {
  const seeds = [
    ...CANONICAL_JLF_QUERIES,
    ...listJlfSippQueryPreviewDefinitions().map(toSeedFromPreview).filter((item): item is JlfQueryRegistrySeed => Boolean(item)),
  ];
  const variableRows = await db.queryAll<JlfVariablePreviewRow>(
    `SELECT key, legacy_code, label, source_type, source_key, legacy_abt_type,
            sipp_query_preview, sipp_query_preview_key, sipp_query_preview_status, updated_at
     FROM jlf_variables
     WHERE COALESCE(sipp_query_preview, '') != ''
       AND COALESCE(is_active, 1) = 1
     ORDER BY key`
  ).catch(() => []);
  for (const row of variableRows) {
    const seed = toSeedFromVariablePreview(row);
    if (seed) seeds.push(seed);
  }

  const deduped = new Map<string, ReturnType<typeof evaluateSeed>>();
  for (const seed of seeds) {
    const evaluated = evaluateSeed(seed);
    if (!deduped.has(evaluated.queryKey)) {
      deduped.set(evaluated.queryKey, evaluated);
    }
  }
  return Array.from(deduped.values());
}

async function upsertJlfRegistrySeed(db: AletaDatabase, seed: Awaited<ReturnType<typeof collectJlfQueryRegistrySeeds>>[number], actorUserId: string | null) {
  const now = new Date().toISOString();
  const id = stableId("jlf_qry", seed.queryKey);
  const existing = await db.queryOne<RegistryRow>(
    "SELECT id, query_key, original_sql, normalized_sql, parameterized_sql, sql_hash, security_status, review_status, is_active FROM aleta_sipp_query_registry WHERE query_key = ? LIMIT 1",
    [seed.queryKey]
  );
  const changed = !existing || existing.sql_hash !== seed.sqlHash || existing.security_status !== seed.securityStatus;
  const reviewStatus = existing?.review_status === "ADMIN_REVIEWED" ? "ADMIN_REVIEWED" : seed.reviewStatus;
  const queryId = existing?.id ?? id;

  await db.run(
    `
    INSERT INTO aleta_sipp_query_registry (
      id, query_key, name, query_name, query_title, category, source, business_purpose,
      source_type, source_file, source_location, source_line, short_description, long_description,
      tables_json, output_columns_json, original_sql, normalized_sql, parameterized_sql, sql_hash,
      columns_used_json, parameters_json, outputs_json, related_table_names_json,
      related_variable_codes_json, related_variable_keys_json, execution_mode, security_status,
      review_status, confidence_score, role_scope_json, ai_allowed, whatsapp_allowed, pdf_allowed,
      is_ai_usable, is_whatsapp_usable, is_pdf_usable, risk_notes_json, risk_notes, usage_notes,
      example_params, example_output, is_active, created_by, updated_by, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?::jsonb, ?, ?, ?, ?, ?::jsonb, ?::jsonb, ?::jsonb, ?::jsonb,
      ?::jsonb, ?::jsonb, ?, ?, ?, ?, ?::jsonb, ?, ?, ?, ?, ?, ?, ?::jsonb, ?, ?, ?::jsonb, ?::jsonb, ?, ?, ?, ?, ?)
    ON CONFLICT (query_key) DO UPDATE SET
      name = EXCLUDED.name,
      query_name = CASE WHEN aleta_sipp_query_registry.review_status = 'ADMIN_REVIEWED' THEN aleta_sipp_query_registry.query_name ELSE EXCLUDED.query_name END,
      query_title = CASE WHEN aleta_sipp_query_registry.review_status = 'ADMIN_REVIEWED' THEN aleta_sipp_query_registry.query_title ELSE EXCLUDED.query_title END,
      category = EXCLUDED.category,
      source = EXCLUDED.source,
      business_purpose = CASE WHEN aleta_sipp_query_registry.review_status = 'ADMIN_REVIEWED' THEN aleta_sipp_query_registry.business_purpose ELSE EXCLUDED.business_purpose END,
      source_type = EXCLUDED.source_type,
      source_file = EXCLUDED.source_file,
      source_location = EXCLUDED.source_location,
      source_line = EXCLUDED.source_line,
      short_description = CASE WHEN aleta_sipp_query_registry.review_status = 'ADMIN_REVIEWED' THEN aleta_sipp_query_registry.short_description ELSE EXCLUDED.short_description END,
      long_description = CASE WHEN aleta_sipp_query_registry.review_status = 'ADMIN_REVIEWED' THEN aleta_sipp_query_registry.long_description ELSE EXCLUDED.long_description END,
      tables_json = EXCLUDED.tables_json,
      output_columns_json = EXCLUDED.output_columns_json,
      original_sql = EXCLUDED.original_sql,
      normalized_sql = EXCLUDED.normalized_sql,
      parameterized_sql = EXCLUDED.parameterized_sql,
      sql_hash = EXCLUDED.sql_hash,
      columns_used_json = EXCLUDED.columns_used_json,
      parameters_json = EXCLUDED.parameters_json,
      outputs_json = EXCLUDED.outputs_json,
      related_table_names_json = EXCLUDED.related_table_names_json,
      related_variable_codes_json = EXCLUDED.related_variable_codes_json,
      related_variable_keys_json = EXCLUDED.related_variable_keys_json,
      execution_mode = EXCLUDED.execution_mode,
      security_status = EXCLUDED.security_status,
      review_status = CASE WHEN aleta_sipp_query_registry.review_status = 'ADMIN_REVIEWED' THEN aleta_sipp_query_registry.review_status ELSE EXCLUDED.review_status END,
      confidence_score = EXCLUDED.confidence_score,
      ai_allowed = EXCLUDED.ai_allowed,
      whatsapp_allowed = EXCLUDED.whatsapp_allowed,
      pdf_allowed = EXCLUDED.pdf_allowed,
      is_ai_usable = EXCLUDED.is_ai_usable,
      is_whatsapp_usable = EXCLUDED.is_whatsapp_usable,
      is_pdf_usable = EXCLUDED.is_pdf_usable,
      risk_notes_json = EXCLUDED.risk_notes_json,
      risk_notes = EXCLUDED.risk_notes,
      usage_notes = EXCLUDED.usage_notes,
      example_params = EXCLUDED.example_params,
      example_output = EXCLUDED.example_output,
      is_active = CASE WHEN aleta_sipp_query_registry.review_status = 'ADMIN_REVIEWED' THEN aleta_sipp_query_registry.is_active ELSE EXCLUDED.is_active END,
      updated_by = EXCLUDED.updated_by,
      updated_at = EXCLUDED.updated_at
    `,
    [
      queryId,
      seed.queryKey,
      seed.queryName,
      seed.queryName,
      seed.queryName,
      seed.category,
      seed.sourceType,
      seed.businessPurpose,
      seed.sourceType,
      seed.sourceFile,
      seed.sourceLocation ?? "",
      seed.sourceLine ?? null,
      seed.description,
      `${seed.description} Validasi: ${seed.validationMessage}`,
      jsonString(seed.tables),
      jsonString(seed.outputColumns),
      seed.originalSql,
      seed.normalizedSql,
      seed.parameterizedSql,
      seed.sqlHash,
      jsonString(seed.outputColumns),
      jsonString(seed.parameters),
      jsonString(seed.outputColumns.map((column) => ({ name: column, label: column.replace(/_/g, " "), dataType: "text" }))),
      jsonString(seed.tables),
      jsonString(seed.relatedVariableCodes),
      jsonString(seed.relatedVariableKeys),
      seed.executionMode,
      seed.securityStatus,
      reviewStatus,
      seed.confidenceScore,
      jsonString(["super-admin", "admin", "hakim", "panitera", "panitera-pengganti", "jurusita"]),
      1,
      0,
      seed.isPdfUsable ? 1 : 0,
      1,
      0,
      seed.isPdfUsable ? 1 : 0,
      jsonString([seed.validationMessage]),
      seed.validationMessage,
      "Disinkronkan otomatis dari katalog/query JLF ke database registry. Runtime JLF wajib memeriksa registry ini sebelum preview/eksekusi SIPP.",
      jsonString(Object.fromEntries(seed.parameters.map((param) => [param.name, param.example ?? "contoh"]))),
      jsonString({}),
      seed.isActive,
      actorUserId,
      actorUserId,
      now,
      now,
    ]
  );

  for (const [index, parameter] of seed.parameters.entries()) {
    await db.run(
      `
      INSERT INTO aleta_sipp_query_parameters (
        id, query_id, name, label, data_type, required, default_value, validation_rule, example_value, sort_order, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, '', '', ?, ?, ?, ?)
      ON CONFLICT (query_id, name) DO UPDATE SET
        label = EXCLUDED.label,
        data_type = EXCLUDED.data_type,
        required = EXCLUDED.required,
        example_value = EXCLUDED.example_value,
        sort_order = EXCLUDED.sort_order,
        updated_at = EXCLUDED.updated_at
      `,
      [stableId("jlf_qp", `${seed.queryKey}:${parameter.name}`), queryId, parameter.name, parameter.label, parameter.type, parameter.required ? 1 : 0, parameter.example ?? "", index + 1, now, now]
    );
  }

  for (const [index, columnName] of seed.outputColumns.entries()) {
    await db.run(
      `
      INSERT INTO aleta_sipp_query_outputs (
        id, query_id, column_name, label, data_type, description, sensitive, sort_order, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, 'text', '', ?, ?, ?, ?)
      ON CONFLICT (query_id, column_name) DO UPDATE SET
        label = EXCLUDED.label,
        sensitive = EXCLUDED.sensitive,
        sort_order = EXCLUDED.sort_order,
        updated_at = EXCLUDED.updated_at
      `,
      [stableId("jlf_qo", `${seed.queryKey}:${columnName}`), queryId, columnName, columnName.replace(/_/g, " "), /nama|alamat|nik|telepon|email/i.test(columnName) ? 1 : 0, index + 1, now, now]
    );
  }

  return existing ? (changed ? "updated" : "unchanged") : "inserted";
}

export async function syncJlfQueryRegistry(db: AletaDatabase, options: { actorUserId?: string | null } = {}): Promise<JlfQueryRegistrySyncSummary> {
  const seeds = await collectJlfQueryRegistrySeeds(db);
  const summary: JlfQueryRegistrySyncSummary = {
    discovered: seeds.length,
    inserted: 0,
    updated: 0,
    unchanged: 0,
    invalid: 0,
    needsReview: 0,
    failed: 0,
    sourceCounts: {},
    failures: [],
  };

  for (const seed of seeds) {
    summary.sourceCounts[seed.sourceType] = (summary.sourceCounts[seed.sourceType] ?? 0) + 1;
    if (seed.securityStatus !== "SAFE_READ_ONLY") summary.invalid += 1;
    if (seed.reviewStatus === "NEEDS_ADMIN_REVIEW") summary.needsReview += 1;
    try {
      const status = await upsertJlfRegistrySeed(db, seed, options.actorUserId ?? null);
      summary[status] += 1;
    } catch (error) {
      summary.failed += 1;
      summary.failures.push({ queryKey: seed.queryKey, error: error instanceof Error ? error.message : "Sync query registry gagal." });
    }
  }

  return summary;
}

async function findRegistryRow(db: AletaDatabase, input: { queryKey?: string | null; sqlPreview?: string | null }) {
  const queryKey = input.queryKey?.trim() ?? "";
  const normalizedSql = input.sqlPreview ? toRegistrySql(input.sqlPreview) : "";
  const hash = normalizedSql ? sqlHash(normalizedSql) : "";
  if (hash && queryKey) {
    return db.queryOne<RegistryRow>(
      `SELECT id, query_key, original_sql, normalized_sql, parameterized_sql, sql_hash, security_status, review_status, is_active
       FROM aleta_sipp_query_registry
       WHERE is_active = 1
         AND (sql_hash = ? OR query_key = ?)
       ORDER BY CASE WHEN sql_hash = ? THEN 0 ELSE 1 END
       LIMIT 1`,
      [hash, queryKey, hash]
    );
  }
  if (hash) {
    return db.queryOne<RegistryRow>(
      `SELECT id, query_key, original_sql, normalized_sql, parameterized_sql, sql_hash, security_status, review_status, is_active
       FROM aleta_sipp_query_registry
       WHERE is_active = 1 AND sql_hash = ?
       LIMIT 1`,
      [hash]
    );
  }
  if (queryKey) {
    return db.queryOne<RegistryRow>(
      `SELECT id, query_key, original_sql, normalized_sql, parameterized_sql, sql_hash, security_status, review_status, is_active
       FROM aleta_sipp_query_registry
       WHERE is_active = 1 AND query_key = ?
       LIMIT 1`,
      [queryKey]
    );
  }
  return null;
}

function assertRegistryRowSafe(row: RegistryRow | null | undefined, queryKey: string) {
  if (!row) {
    throw new Error(`Query JLF/SIPP '${queryKey || "tanpa key"}' belum tersinkron ke database registry. Jalankan npm run sync:query-registry.`);
  }
  if (row.is_active !== 1) {
    throw new Error(`Query JLF/SIPP '${row.query_key}' tidak aktif di database registry.`);
  }
  if (row.security_status === "REJECTED_WRITE_QUERY" || row.security_status === "UNSAFE_RAW_SQL") {
    throw new Error(`Query JLF/SIPP '${row.query_key}' ditolak karena status keamanan ${row.security_status}.`);
  }
  const sql = row.normalized_sql || row.original_sql || row.parameterized_sql;
  const validation = validateReadOnlySql(sql);
  if (!validation.ok) {
    throw new Error(validation.blockedReason ?? `Query JLF/SIPP '${row.query_key}' tidak lolos SELECT-only guard.`);
  }
  return {
    id: row.id,
    queryKey: row.query_key,
    securityStatus: row.security_status,
    reviewStatus: row.review_status,
    sqlHash: row.sql_hash,
    parameterizedSql: row.parameterized_sql,
  };
}

export async function assertJlfSippQueryRegisteredInDatabase(db: AletaDatabase, queryKey: string) {
  const row = await findRegistryRow(db, { queryKey });
  return assertRegistryRowSafe(row, queryKey);
}

export async function assertJlfLegacySqlRegisteredInDatabase(
  db: AletaDatabase,
  input: { queryKey?: string | null; sqlPreview: string }
) {
  const normalizedSql = toRegistrySql(input.sqlPreview);
  const expectedHash = sqlHash(normalizedSql);
  const row = await findRegistryRow(db, { queryKey: input.queryKey, sqlPreview: input.sqlPreview });
  const safe = assertRegistryRowSafe(row, input.queryKey || expectedHash);
  if (safe.sqlHash !== expectedHash) {
    throw new Error("Query SQL legacy JLF belum tersinkron sebagai entry exact di database registry.");
  }
  return safe;
}
