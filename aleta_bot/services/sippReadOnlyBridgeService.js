"use strict";

const crypto = require("crypto");

const externalDbService = require("./externalDbService");
const logService = require("./logService");

const DEFAULT_CONNECTION_KEY = "sipp_primary";
const MAX_LIMIT = 500;

const columnCache = new Map();

function normalizeLimit(value, fallback = 50) {
  return Math.max(1, Math.min(MAX_LIMIT, Number(value || fallback)));
}

function normalizeConnectionKey(value) {
  const key = String(value || DEFAULT_CONNECTION_KEY).trim();
  if (!/^[a-zA-Z0-9_-]{2,80}$/.test(key)) {
    throw new Error("connection_key_invalid");
  }
  return key;
}

function assertSafeIdentifier(value) {
  const text = String(value || "");
  if (!/^[a-zA-Z0-9_]+$/.test(text)) {
    throw new Error("unsafe_identifier");
  }
  return text;
}

function quoteIdentifier(value) {
  return `\`${assertSafeIdentifier(value)}\``;
}

function stripSqlQuotedStrings(sql) {
  return String(sql || "")
    .replace(/'(?:''|\\'|[^'])*'/g, "''")
    .replace(/"(?:\\"|[^"])*"/g, '""');
}

function hasSemicolonOutsideQuotedString(sql) {
  const text = String(sql || "");
  let quote = "";
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (quote) {
      if (char === "\\" && next) {
        index += 1;
        continue;
      }
      if (char === quote) {
        if (next === quote) {
          index += 1;
          continue;
        }
        quote = "";
      }
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }
    if (char === ";") return true;
  }
  return false;
}

function assertReadOnlySql(sql) {
  const text = String(sql || "").trim();
  if (!/^(select|show)\b/i.test(text)) {
    throw new Error("only_read_only_select_or_show_allowed");
  }
  const singleStatement = text.replace(/;\s*$/, "");
  const scanText = stripSqlQuotedStrings(singleStatement);
  if (hasSemicolonOutsideQuotedString(singleStatement)) {
    throw new Error("multiple_statement_blocked");
  }
  if (/\b(insert|update|delete|drop|alter|truncate|create|grant|revoke|call|exec|execute)\b/i.test(scanText)) {
    throw new Error("write_keyword_blocked");
  }
  if (/\breplace\s+into\b/i.test(scanText)) {
    throw new Error("write_keyword_blocked");
  }
}

function safeString(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function localDate(value) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateString(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return localDate(value);
  }
  const text = safeString(value);
  if (!text || text === "0000-00-00" || text.startsWith("0000-00-00")) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    return text.length > 10 ? text.slice(0, 19).replace(" ", "T") : text;
  }
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) return localDate(parsed);
  return text.slice(0, 19);
}

function columnSet(rows) {
  return new Set(rows.map((row) => String(row.Field || row.field || "").toLowerCase()).filter(Boolean));
}

function hasColumn(columns, name) {
  return columns.has(String(name || "").toLowerCase());
}

function firstColumn(columns, names) {
  return names.find((name) => hasColumn(columns, name)) || "";
}

function columnExpr(alias, columns, names, fallback = "NULL") {
  const column = firstColumn(columns, names);
  return column ? `${alias}.${quoteIdentifier(column)}` : fallback;
}

function tableCacheKey(connectionKey, tableName) {
  return `${connectionKey}:${tableName}`;
}

async function getTableColumns(connectionKey, tableName) {
  assertSafeIdentifier(tableName);
  const key = tableCacheKey(connectionKey, tableName);
  if (columnCache.has(key)) return columnCache.get(key);

  try {
    const rows = await externalDbService.query(connectionKey, `SHOW COLUMNS FROM ${quoteIdentifier(tableName)}`);
    const columns = columnSet(Array.isArray(rows) ? rows : []);
    columnCache.set(key, columns);
    return columns;
  } catch {
    const empty = new Set();
    columnCache.set(key, empty);
    return empty;
  }
}

async function runReadOnly(connectionKey, sql, params = []) {
  assertReadOnlySql(sql);
  return externalDbService.query(connectionKey, sql, params);
}

function safeNumericId(value) {
  const text = safeString(value);
  return /^\d+$/.test(text) ? text : "";
}

async function runPerkaraJadwalSidangReorder(connectionKey, perkaraId) {
  const numericPerkaraId = safeNumericId(perkaraId);
  if (!numericPerkaraId) return false;
  try {
    await externalDbService.query(connectionKey, "CALL perkara_jadwal_sidang_reorder(?)", [numericPerkaraId]);
    return true;
  } catch (error) {
    void logService.logQueryError({
      eventType: "jlf_sipp_schedule_reorder_failed",
      severity: "warning",
      message: "Stored procedure perkara_jadwal_sidang_reorder gagal dijalankan sebelum membaca jadwal sidang.",
      metadata: {
        connectionKey,
        perkaraId: numericPerkaraId,
        errorMessage: externalDbService.sanitizeError(error),
      },
    });
    return false;
  }
}

async function logScheduleStrategyFailure(connectionKey, strategy, error, context = {}) {
  await logService.logQueryError({
    eventType: "jlf_sipp_schedule_strategy_failed",
    severity: "warning",
    message: "Strategi baca jadwal sidang SIPP gagal, bridge mencoba strategi fallback berikutnya.",
    metadata: {
      connectionKey,
      strategy,
      perkaraId: safeString(context.perkaraId),
      nomorPerkara: safeString(context.nomorPerkara),
      errorMessage: externalDbService.sanitizeError(error),
    },
  });
}

function tagScheduleRows(rows, strategy) {
  return rows.map((row) => ({
    ...row,
    scheduleSourceAttempt: strategy,
    metadata: {
      ...(row && typeof row.metadata === "object" ? row.metadata : {}),
      scheduleSourceAttempt: strategy,
    },
  }));
}

async function tryGetScheduleRows(connectionKey, strategy, context, loader) {
  try {
    const rows = await loader();
    return Array.isArray(rows) && rows.length > 0 ? tagScheduleRows(rows, strategy) : [];
  } catch (error) {
    await logScheduleStrategyFailure(connectionKey, strategy, error, context);
    return [];
  }
}

async function resolveCorePerkaraIdByNomor(connectionKey, nomorPerkara) {
  const normalizedNomor = safeString(nomorPerkara);
  if (!normalizedNomor) return "";
  const cols = await getTableColumns(connectionKey, "perkara");
  if (cols.size === 0 || !hasColumn(cols, "perkara_id") || !hasColumn(cols, "nomor_perkara")) return "";

  const rows = await runReadOnly(
    connectionKey,
    `SELECT CAST(${quoteIdentifier("perkara_id")} AS CHAR) AS perkara_id
     FROM ${quoteIdentifier("perkara")}
     WHERE ${quoteIdentifier("nomor_perkara")} = ?
     LIMIT 1`,
    [normalizedNomor]
  );
  return safeString(Array.isArray(rows) ? rows[0]?.perkara_id : "");
}

async function resolveWebPerkaraIdByNomor(connectionKey, nomorPerkara) {
  const normalizedNomor = safeString(nomorPerkara);
  if (!normalizedNomor) return "";
  const cols = await getTableColumns(connectionKey, "dataumumweb");
  if (cols.size === 0 || !hasColumn(cols, "IDPerkara") || !hasColumn(cols, "noPerkara")) return "";

  const rows = await runReadOnly(
    connectionKey,
    `SELECT CAST(${quoteIdentifier("IDPerkara")} AS CHAR) AS perkara_id
     FROM ${quoteIdentifier("dataumumweb")}
     WHERE ${quoteIdentifier("noPerkara")} = ?
     LIMIT 1`,
    [normalizedNomor]
  );
  return safeString(Array.isArray(rows) ? rows[0]?.perkara_id : "");
}

function hashQuery(sql) {
  return crypto.createHash("sha256").update(String(sql || "")).digest("hex");
}

function sqlStringLiteral(value) {
  if (value === null || value === undefined) return "''";
  const text = value instanceof Date
    ? value.toISOString().slice(0, 19).replace("T", " ")
    : typeof value === "object"
      ? JSON.stringify(value)
      : String(value);
  return `'${text.replace(/\u0000/g, "").replace(/\\/g, "\\\\").replace(/'/g, "''")}'`;
}

function readPlaceholderValue(params, code) {
  const values = params && typeof params.placeholderValues === "object" && params.placeholderValues
    ? params.placeholderValues
    : {};
  const normalized = String(code || "").replace(/\D/g, "").padStart(4, "0");
  const numeric = String(Number(normalized));
  const candidates = [
    normalized,
    `#${normalized}#`,
    `legacy_${normalized}`,
    `legacy:${normalized}`,
    numeric,
    `#${numeric}#`,
    `legacy_${numeric}`,
    `legacy:${numeric}`,
  ];
  for (const key of candidates) {
    if (Object.prototype.hasOwnProperty.call(values, key)) return values[key];
  }
  if (normalized === "0001") return params.nomorPerkara || params.nomor_perkara || params.caseNumber || "";
  return "";
}

function readNamedPlaceholderValue(params, name) {
  const values = params && typeof params.placeholderValues === "object" && params.placeholderValues
    ? params.placeholderValues
    : {};
  const normalized = String(name || "").trim();
  const snake = normalized.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`).toLowerCase();
  const camel = snake.replace(/_([a-z])/g, (_match, char) => char.toUpperCase());
  const candidates = [normalized, snake, camel, `#${normalized}#`, `#${snake}#`, `#${camel}#`];
  for (const key of candidates) {
    if (Object.prototype.hasOwnProperty.call(values, key)) return values[key];
  }
  if (snake === "nomor_perkara") return params.nomorPerkara || params.nomor_perkara || params.caseNumber || "";
  if (snake === "perkara_id") return params.perkaraId || params.perkara_id || "";
  return "";
}

function prepareLegacyAbtSql(rawSql, params = {}) {
  let sql = String(rawSql || "").trim().replace(/;\s*$/, "");
  const queryParams = [];
  const perkaraId = safeString(params.perkaraId || params.perkara_id);
  const nomorPerkara = safeString(params.nomorPerkara || params.nomor_perkara || params.caseNumber);

  sql = sql.replace(/(['"])#perkara_id#\1/gi, () => {
    queryParams.push(perkaraId);
    return "?";
  });
  sql = sql.replace(/#perkara_id#/gi, () => {
    queryParams.push(perkaraId);
    return "?";
  });
  sql = sql.replace(/(['"])#nomor_perkara#\1/gi, () => sqlStringLiteral(nomorPerkara));
  sql = sql.replace(/#nomor_perkara#/gi, () => sqlStringLiteral(nomorPerkara));
  sql = sql.replace(/(['"])#(\d{1,6})#\1/g, (_match, _quote, code) => sqlStringLiteral(readPlaceholderValue(params, code)));
  sql = sql.replace(/#(\d{1,6})#/g, (_match, code) => sqlStringLiteral(readPlaceholderValue(params, code)));
  sql = sql.replace(/(['"])#([a-z][a-z0-9_]*)#\1/gi, (_match, _quote, name) => sqlStringLiteral(readNamedPlaceholderValue(params, name)));
  sql = sql.replace(/#([a-z][a-z0-9_]*)#/gi, (_match, name) => sqlStringLiteral(readNamedPlaceholderValue(params, name)));

  assertReadOnlySql(sql);
  return { sql, params: queryParams };
}

function pickLegacySqlValue(row) {
  if (!row || typeof row !== "object") return null;
  const preferredKeys = ["data", "DATA", "nilai", "value", "hasil", "result"];
  for (const key of preferredKeys) {
    if (Object.prototype.hasOwnProperty.call(row, key)) return row[key];
  }
  const firstKey = Object.keys(row)[0];
  return firstKey ? row[firstKey] : null;
}

function mapCaseRow(row) {
  return {
    perkaraId: safeString(row.perkara_id),
    nomorPerkara: safeString(row.nomor_perkara),
    jenisPerkara: safeString(row.jenis_perkara),
    paraPihak: safeString(row.para_pihak),
    tahapan: safeString(row.tahapan),
    tanggalDaftar: dateString(row.tanggal_daftar),
    statusPerkara: safeString(row.status_perkara),
    metadata: {
      sourceConnectionKey: safeString(row.source_connection_key),
      updatedAt: dateString(row.updated_at),
    },
  };
}

async function buildPerkaraSelect(connectionKey, whereSql, params, limit) {
  const pCols = await getTableColumns(connectionKey, "perkara");
  if (pCols.size === 0) return [];

  const jenis = columnExpr("p", pCols, ["jenis_perkara_nama", "jenis_perkara_text", "jenis_perkara"], "''");
  const tahapan = columnExpr("p", pCols, ["tahapan_terakhir_text", "status_perkara", "proses_terakhir_text"], "''");
  const pihak = columnExpr("p", pCols, ["para_pihak", "pihak", "nama_pihak"], "''");
  const tanggalDaftar = columnExpr("p", pCols, ["tanggal_pendaftaran", "tanggal_daftar", "tgl_pendaftaran"], "NULL");
  const updatedAt = columnExpr("p", pCols, ["diperbaharui_tanggal", "updated_at", "diinput_tanggal"], "NULL");

  const sql = `
SELECT
  CAST(p.${quoteIdentifier("perkara_id")} AS CHAR) AS perkara_id,
  p.${quoteIdentifier("nomor_perkara")} AS nomor_perkara,
  ${jenis} AS jenis_perkara,
  ${pihak} AS para_pihak,
  ${tahapan} AS tahapan,
  ${tanggalDaftar} AS tanggal_daftar,
  ${tahapan} AS status_perkara,
  ${updatedAt} AS updated_at,
  ? AS source_connection_key
FROM ${quoteIdentifier("perkara")} p
WHERE ${whereSql}
ORDER BY ${updatedAt === "NULL" ? "p.perkara_id" : updatedAt} DESC
LIMIT ${normalizeLimit(limit, 20)}`;

  return runReadOnly(connectionKey, sql, [connectionKey, ...params]);
}

async function health(params = {}) {
  const connectionKey = normalizeConnectionKey(params.connectionKey);
  const startedAt = Date.now();
  await runReadOnly(connectionKey, "SELECT 1 AS ok");
  return {
    status: "connected",
    connectionKey,
    message: `Koneksi ${connectionKey} tersedia melalui ALETA Bot database registry.`,
    latencyMs: Date.now() - startedAt,
  };
}

async function searchCasesByNumber(params = {}) {
  const connectionKey = normalizeConnectionKey(params.connectionKey);
  const nomorPerkara = safeString(params.nomorPerkara);
  if (!nomorPerkara) return [];
  const rows = await buildPerkaraSelect(
    connectionKey,
    "LOWER(p.`nomor_perkara`) LIKE LOWER(?)",
    [`%${nomorPerkara}%`],
    params.filters?.limit || params.limit || 20
  );
  return rows.map(mapCaseRow);
}

async function searchCasesByPartyName(params = {}) {
  const connectionKey = normalizeConnectionKey(params.connectionKey);
  const query = safeString(params.name || params.query);
  if (!query) return [];
  const pCols = await getTableColumns(connectionKey, "perkara");
  const pihakColumn = firstColumn(pCols, ["para_pihak", "pihak", "nama_pihak"]);
  const where = pihakColumn
    ? `LOWER(p.${quoteIdentifier(pihakColumn)}) LIKE LOWER(?)`
    : "LOWER(p.`nomor_perkara`) LIKE LOWER(?)";
  const rows = await buildPerkaraSelect(connectionKey, where, [`%${query}%`], params.filters?.limit || params.limit || 20);
  return rows.map(mapCaseRow);
}

async function getCaseDetail(params = {}) {
  const connectionKey = normalizeConnectionKey(params.connectionKey);
  const perkaraId = safeString(params.perkaraId);
  const nomorPerkara = safeString(params.nomorPerkara);
  const rows = perkaraId
    ? await buildPerkaraSelect(connectionKey, "CAST(p.`perkara_id` AS CHAR) = ?", [perkaraId], 1)
    : await buildPerkaraSelect(connectionKey, "p.`nomor_perkara` = ?", [nomorPerkara], 1);
  return rows[0] ? mapCaseRow(rows[0]) : null;
}

async function getParties(params = {}) {
  const connectionKey = normalizeConnectionKey(params.connectionKey);
  const perkaraId = safeString(params.perkaraId);
  if (!perkaraId) return [];

  const pihakCols = await getTableColumns(connectionKey, "pihak");
  const result = [];
  const relationTables = [
    ["perkara_pihak1", "Penggugat/Pemohon"],
    ["perkara_pihak2", "Tergugat/Termohon"],
    ["perkara_pihak3", "Turut Tergugat"],
    ["perkara_pihak4", "Intervensi"],
  ];

  for (const [tableName, defaultRole] of relationTables) {
    const relCols = await getTableColumns(connectionKey, tableName);
    if (relCols.size === 0 || !hasColumn(relCols, "perkara_id")) continue;
    const relName = columnExpr("rel", relCols, ["nama", "nama_pihak"], "''");
    const relPihakId = firstColumn(relCols, ["pihak_id", "id_pihak"]);
    const pihakId = firstColumn(pihakCols, ["id", "pihak_id"]);
    const join = relPihakId && pihakId ? `LEFT JOIN ${quoteIdentifier("pihak")} ph ON ph.${quoteIdentifier(pihakId)} = rel.${quoteIdentifier(relPihakId)}` : "";
    const name = pihakCols.size > 0 ? `COALESCE(NULLIF(${relName}, ''), ${columnExpr("ph", pihakCols, ["nama"], "''")})` : relName;
    const nik = pihakCols.size > 0 ? columnExpr("ph", pihakCols, ["nik", "nomor_identitas", "nomor_indentitas", "no_ktp"], "''") : "''";
    const nomorKk = pihakCols.size > 0 ? columnExpr("ph", pihakCols, ["nomor_kk", "no_kk"], "''") : "''";
    const tempatLahir = pihakCols.size > 0 ? columnExpr("ph", pihakCols, ["tempat_lahir"], "''") : "''";
    const tanggalLahir = pihakCols.size > 0 ? columnExpr("ph", pihakCols, ["tanggal_lahir", "tgl_lahir"], "NULL") : "NULL";
    const jenisKelamin = pihakCols.size > 0 ? columnExpr("ph", pihakCols, ["jenis_kelamin", "kelamin"], "''") : "''";
    const alamat = pihakCols.size > 0 ? columnExpr("ph", pihakCols, ["alamat"], "''") : "''";
    const desa = pihakCols.size > 0 ? columnExpr("ph", pihakCols, ["kelurahan", "desa", "desa_kelurahan"], "''") : "''";
    const kecamatan = pihakCols.size > 0 ? columnExpr("ph", pihakCols, ["kecamatan"], "''") : "''";
    const kabupaten = pihakCols.size > 0 ? columnExpr("ph", pihakCols, ["kabupaten", "kabupaten_kota", "kota"], "''") : "''";
    const provinsi = pihakCols.size > 0 ? columnExpr("ph", pihakCols, ["propinsi", "provinsi"], "''") : "''";
    const agama = pihakCols.size > 0 ? columnExpr("ph", pihakCols, ["agama"], "''") : "''";

    const sql = `
SELECT
  ? AS party_role,
  ${name} AS nama,
  ${nik} AS nik,
  ${nomorKk} AS nomor_kk,
  ${tempatLahir} AS tempat_lahir,
  ${tanggalLahir} AS tanggal_lahir,
  ${jenisKelamin} AS jenis_kelamin,
  ${alamat} AS alamat,
  ${desa} AS desa_kelurahan,
  ${kecamatan} AS kecamatan,
  ${kabupaten} AS kabupaten_kota,
  ${provinsi} AS provinsi,
  ${agama} AS agama
FROM ${quoteIdentifier(tableName)} rel
${join}
WHERE CAST(rel.${quoteIdentifier("perkara_id")} AS CHAR) = ?
ORDER BY rel.${quoteIdentifier("perkara_id")} ASC
LIMIT 20`;
    const rows = await runReadOnly(connectionKey, sql, [defaultRole, perkaraId]);
    result.push(...(Array.isArray(rows) ? rows : []).map((row) => ({
      role: safeString(row.party_role),
      name: safeString(row.nama),
      nik: safeString(row.nik),
      nomorKk: safeString(row.nomor_kk),
      tempatLahir: safeString(row.tempat_lahir),
      tanggalLahir: dateString(row.tanggal_lahir),
      jenisKelamin: safeString(row.jenis_kelamin),
      alamat: safeString(row.alamat),
      desaKelurahan: safeString(row.desa_kelurahan),
      kecamatan: safeString(row.kecamatan),
      kabupatenKota: safeString(row.kabupaten_kota),
      provinsi: safeString(row.provinsi),
      agama: safeString(row.agama),
    })));
  }

  return result.filter((party) => party.name);
}

async function getDecision(params = {}) {
  const connectionKey = normalizeConnectionKey(params.connectionKey);
  const perkaraId = safeString(params.perkaraId);
  if (!perkaraId) return null;
  const cols = await getTableColumns(connectionKey, "perkara_putusan");
  if (cols.size === 0) return null;
  const tanggalPutusan = columnExpr("pp", cols, ["tanggal_putusan", "tgl_putusan", "tanggal_penetapan"], "NULL");
  const tanggalBht = columnExpr("pp", cols, ["tanggal_bht", "tgl_bht"], "NULL");
  const amar = columnExpr("pp", cols, ["amar_putusan", "amar", "putusan"], "''");
  const sql = `
SELECT
  ${tanggalPutusan} AS tanggal_putusan,
  ${tanggalBht} AS tanggal_bht,
  ${amar} AS amar_putusan
FROM ${quoteIdentifier("perkara_putusan")} pp
WHERE CAST(pp.${quoteIdentifier("perkara_id")} AS CHAR) = ?
LIMIT 1`;
  const rows = await runReadOnly(connectionKey, sql, [perkaraId]);
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row) return null;
  return {
    decisionDate: dateString(row.tanggal_putusan),
    finalLegalDate: dateString(row.tanggal_bht),
    amar: safeString(row.amar_putusan),
  };
}

function mapScheduleRow(row) {
  const sourceTable = safeString(row.source_table);
  return {
    id: safeString(row.sidang_id),
    sidangId: safeString(row.sidang_id),
    sidang_id: safeString(row.sidang_id),
    perkaraId: safeString(row.perkara_id),
    perkara_id: safeString(row.perkara_id),
    sidangKe: safeString(row.urutan),
    sidang_ke: safeString(row.urutan),
    urutan: safeString(row.urutan),
    tanggalSidang: dateString(row.tanggal_sidang),
    tanggal_sidang: dateString(row.tanggal_sidang),
    tanggal: dateString(row.tanggal_sidang),
    hariSidang: dateString(row.tanggal_sidang),
    hari_sidang: dateString(row.tanggal_sidang),
    jamSidang: safeString(row.jam_sidang),
    jam_sidang: safeString(row.jam_sidang),
    sampaiJam: safeString(row.sampai_jam),
    sampai_jam: safeString(row.sampai_jam),
    agenda: safeString(row.agenda),
    agendaSidang: safeString(row.agenda),
    agenda_sidang: safeString(row.agenda),
    ruangan: safeString(row.ruangan),
    dihadiriOleh: safeString(row.dihadiri_oleh),
    dihadiri_oleh: safeString(row.dihadiri_oleh),
    ditunda: safeString(row.ditunda),
    alasanDitunda: safeString(row.alasan_ditunda),
    alasan_ditunda: safeString(row.alasan_ditunda),
    status: safeString(row.alasan_ditunda) || safeString(row.ditunda),
    keterangan: safeString(row.keterangan),
    alasanSebelumnya: safeString(row.alasan_sblmnya),
    alasan_sblmnya: safeString(row.alasan_sblmnya),
    tanggalSebelumnya: dateString(row.tanggal_sblmnya),
    tanggal_sblmnya: dateString(row.tanggal_sblmnya),
    hariSebelumnya: dateString(row.tanggal_sblmnya),
    hari_sblmnya: dateString(row.tanggal_sblmnya),
    agendaSebelumnya: safeString(row.agenda_sblmnya),
    agenda_sblmnya: safeString(row.agenda_sblmnya),
    tanggalDitunda: dateString(row.tanggal_ditunda),
    tanggal_ditunda: dateString(row.tanggal_ditunda),
    hariDitunda: dateString(row.tanggal_ditunda),
    hari_ditunda: dateString(row.tanggal_ditunda),
    agendaDitunda: safeString(row.agenda_ditunda),
    agenda_ditunda: safeString(row.agenda_ditunda),
    sourceTable,
    source_table: sourceTable,
    metadata: { sourceTable },
  };
}

async function getScheduleFromPerkaraJadwalSidang(connectionKey, perkaraId, nomorPerkara, options = {}) {
  const tableName = "perkara_jadwal_sidang";
  const cols = await getTableColumns(connectionKey, tableName);
  if (cols.size === 0 || !hasColumn(cols, "perkara_id")) return [];
  await runPerkaraJadwalSidangReorder(connectionKey, perkaraId);

  const perkaraCols = await getTableColumns(connectionKey, "perkara");
  const useNomorJoin = Boolean(
    nomorPerkara &&
    perkaraCols.size > 0 &&
    hasColumn(perkaraCols, "perkara_id") &&
    hasColumn(perkaraCols, "nomor_perkara")
  );
  if (!perkaraId && !useNomorJoin) return [];

  const hasUrutan = hasColumn(cols, "urutan");
  const sidangId = columnExpr("js", cols, ["id", "sidang_id"], "''");
  const sourcePerkaraId = columnExpr("js", cols, ["perkara_id"], "''");
  const urutan = columnExpr("js", cols, ["urutan"], "0");
  const tanggalSidang = columnExpr("js", cols, ["tanggal_sidang", "tgl_sidang"], "NULL");
  const jamSidang = columnExpr("js", cols, ["jam_sidang", "jam"], "''");
  const sampaiJam = columnExpr("js", cols, ["sampai_jam"], "''");
  const agenda = columnExpr("js", cols, ["agenda", "agenda_sidang"], "''");
  const ruangan = columnExpr("js", cols, ["ruangan", "ruang_sidang"], "''");
  const dihadiriOleh = columnExpr("js", cols, ["dihadiri_oleh"], "''");
  const ditunda = columnExpr("js", cols, ["ditunda"], "''");
  const alasanDitunda = columnExpr("js", cols, ["alasan_ditunda"], "''");
  const keterangan = columnExpr("js", cols, ["keterangan"], "''");
  const tanggalFilter = tanggalSidang === "NULL" ? "" : ` AND ${tanggalSidang} IS NOT NULL`;
  const previousSelect = hasUrutan
    ? `${columnExpr("prev", cols, ["alasan_ditunda"], "''")} AS alasan_sblmnya,
       ${columnExpr("prev", cols, ["tanggal_sidang", "tgl_sidang"], "NULL")} AS tanggal_sblmnya,
       ${columnExpr("prev", cols, ["agenda", "agenda_sidang"], "''")} AS agenda_sblmnya`
    : "'' AS alasan_sblmnya, NULL AS tanggal_sblmnya, '' AS agenda_sblmnya";
  const nextSelect = hasUrutan
    ? `${columnExpr("nxt", cols, ["tanggal_sidang", "tgl_sidang"], "NULL")} AS tanggal_ditunda,
       ${columnExpr("nxt", cols, ["agenda", "agenda_sidang"], "''")} AS agenda_ditunda`
    : "NULL AS tanggal_ditunda, '' AS agenda_ditunda";
  const previousJoin = hasUrutan
    ? `LEFT JOIN ${quoteIdentifier(tableName)} prev ON prev.${quoteIdentifier("perkara_id")} = js.${quoteIdentifier("perkara_id")} AND prev.${quoteIdentifier("urutan")} = js.${quoteIdentifier("urutan")} - 1`
    : "";
  const nextJoin = hasUrutan
    ? `LEFT JOIN ${quoteIdentifier(tableName)} nxt ON nxt.${quoteIdentifier("perkara_id")} = js.${quoteIdentifier("perkara_id")} AND nxt.${quoteIdentifier("urutan")} = js.${quoteIdentifier("urutan")} + 1`
    : "";
  const usePerkaraJoin = perkaraCols.size > 0 && hasColumn(perkaraCols, "perkara_id");
  const perkaraJoin = usePerkaraJoin
    ? `LEFT JOIN ${quoteIdentifier("perkara")} p ON p.${quoteIdentifier("perkara_id")} = js.${quoteIdentifier("perkara_id")}`
    : "";
  const whereSql = useNomorJoin
    ? `(CAST(js.${quoteIdentifier("perkara_id")} AS CHAR) = ? OR p.${quoteIdentifier("nomor_perkara")} = ?)`
    : `CAST(js.${quoteIdentifier("perkara_id")} AS CHAR) = ?`;
  const queryParams = useNomorJoin ? [perkaraId, nomorPerkara] : [perkaraId];
  const selectedSidangId = safeString(options.sidangId || options.sidang_id);
  const selectedSidangUrutan = safeNumericId(options.sidangUrutan || options.sidang_urutan || options.urutan);
  const selectedFilters = [];
  if (selectedSidangId) {
    selectedFilters.push(`${sidangId} = ?`);
    queryParams.push(selectedSidangId);
  }
  if (selectedSidangUrutan && hasUrutan) {
    selectedFilters.push(`${urutan} = ?`);
    queryParams.push(selectedSidangUrutan);
  }
  const selectedWhere = selectedFilters.length ? ` AND (${selectedFilters.join(" OR ")})` : "";
  const alurFilter = usePerkaraJoin && hasColumn(perkaraCols, "alur_perkara_id")
    ? ` AND (p.${quoteIdentifier("alur_perkara_id")} IS NULL OR p.${quoteIdentifier("alur_perkara_id")} <> 114)`
    : "";
  const orderBy = hasUrutan
    ? `${urutan} ASC, ${tanggalSidang === "NULL" ? "1" : tanggalSidang} ASC, ${sidangId} ASC`
    : `${tanggalSidang === "NULL" ? "1" : tanggalSidang} ASC, ${sidangId} ASC`;
  const sql = `
SELECT
  ${sidangId} AS sidang_id,
  ${sourcePerkaraId} AS perkara_id,
  ${urutan} AS urutan,
  ${tanggalSidang} AS tanggal_sidang,
  ${jamSidang} AS jam_sidang,
  ${sampaiJam} AS sampai_jam,
  ${agenda} AS agenda,
  ${ruangan} AS ruangan,
  ${dihadiriOleh} AS dihadiri_oleh,
  ${ditunda} AS ditunda,
  ${alasanDitunda} AS alasan_ditunda,
  ${keterangan} AS keterangan,
  ${previousSelect},
  ${nextSelect},
  '${tableName}' AS source_table
FROM ${quoteIdentifier(tableName)} js
${previousJoin}
${nextJoin}
${perkaraJoin}
WHERE ${whereSql}${selectedWhere}${tanggalFilter}${alurFilter}
ORDER BY ${orderBy}
LIMIT 100`;
  const rows = await runReadOnly(connectionKey, sql, queryParams);
  return (Array.isArray(rows) ? rows : []).map(mapScheduleRow);
}

async function getScheduleFromJadwalSidangWeb(connectionKey, perkaraId, nomorPerkara) {
  const tableName = "jadwalsidangweb";
  const cols = await getTableColumns(connectionKey, tableName);
  if (cols.size === 0 || !hasColumn(cols, "IDPerkara")) return [];
  const dataCols = nomorPerkara ? await getTableColumns(connectionKey, "dataumumweb") : new Set();
  const useNomorJoin = Boolean(
    nomorPerkara &&
    dataCols.size > 0 &&
    hasColumn(dataCols, "IDPerkara") &&
    hasColumn(dataCols, "noPerkara")
  );
  if (!perkaraId && !useNomorJoin) return [];

  const sidangId = columnExpr("jw", cols, ["ID", "id"], "''");
  const sourcePerkaraId = columnExpr("jw", cols, ["IDPerkara", "idperkara", "perkara_id"], "''");
  const tanggalSidang = columnExpr("jw", cols, ["tglSidang", "tglsidang", "tanggal_sidang"], "NULL");
  const jamSidang = columnExpr("jw", cols, ["jamSidang", "jamsidang", "jam_sidang"], "''");
  const sampaiJam = columnExpr("jw", cols, ["selesaiSidang", "selesaisidang", "sampai_jam"], "''");
  const agenda = columnExpr("jw", cols, ["agenda"], "''");
  const ruangan = columnExpr("jw", cols, ["ruangan"], "''");
  const dihadiriOleh = columnExpr("jw", cols, ["dihadiriOleh", "dihadiri_oleh"], "''");
  const ditunda = columnExpr("jw", cols, ["ditunda"], "''");
  const alasanDitunda = columnExpr("jw", cols, ["alasanDitunda", "alasan_ditunda"], "''");
  const keterangan = columnExpr("jw", cols, ["keterangan"], "''");
  const nomorJoin = useNomorJoin
    ? `LEFT JOIN ${quoteIdentifier("dataumumweb")} du ON du.${quoteIdentifier("IDPerkara")} = jw.${quoteIdentifier("IDPerkara")}`
    : "";
  const whereSql = useNomorJoin
    ? `(CAST(jw.${quoteIdentifier("IDPerkara")} AS CHAR) = ? OR du.${quoteIdentifier("noPerkara")} = ?)`
    : `CAST(jw.${quoteIdentifier("IDPerkara")} AS CHAR) = ?`;
  const queryParams = useNomorJoin ? [perkaraId, nomorPerkara] : [perkaraId];
  const sql = `
SELECT
  ${sidangId} AS sidang_id,
  ${sourcePerkaraId} AS perkara_id,
  ${sidangId} AS urutan,
  ${tanggalSidang} AS tanggal_sidang,
  ${jamSidang} AS jam_sidang,
  ${sampaiJam} AS sampai_jam,
  ${agenda} AS agenda,
  ${ruangan} AS ruangan,
  ${dihadiriOleh} AS dihadiri_oleh,
  ${ditunda} AS ditunda,
  ${alasanDitunda} AS alasan_ditunda,
  ${keterangan} AS keterangan,
  '' AS alasan_sblmnya,
  NULL AS tanggal_sblmnya,
  '' AS agenda_sblmnya,
  NULL AS tanggal_ditunda,
  '' AS agenda_ditunda,
  '${tableName}' AS source_table
FROM ${quoteIdentifier(tableName)} jw
${nomorJoin}
WHERE ${whereSql}
ORDER BY ${tanggalSidang === "NULL" ? "1" : tanggalSidang} ASC, ${sidangId} ASC
LIMIT 100`;
  const rows = await runReadOnly(connectionKey, sql, queryParams);
  return (Array.isArray(rows) ? rows : []).map(mapScheduleRow);
}

async function getSchedule(params = {}) {
  const connectionKey = normalizeConnectionKey(params.connectionKey);
  const perkaraId = safeString(params.perkaraId || params.perkara_id);
  const nomorPerkara = safeString(params.nomorPerkara || params.nomor_perkara || params.caseNumber);
  if (!perkaraId && !nomorPerkara) return [];

  const context = { perkaraId, nomorPerkara };
  const primaryRows = await tryGetScheduleRows(
    connectionKey,
    "perkara_jadwal_sidang",
    context,
    () => getScheduleFromPerkaraJadwalSidang(connectionKey, perkaraId, nomorPerkara, params)
  );
  if (primaryRows.length > 0) return primaryRows;

  const resolvedCorePerkaraId = await tryGetScheduleRows(
    connectionKey,
    "perkara_id_by_nomor",
    context,
    async () => {
      const resolvedId = await resolveCorePerkaraIdByNomor(connectionKey, nomorPerkara);
      return resolvedId && resolvedId !== perkaraId
        ? getScheduleFromPerkaraJadwalSidang(connectionKey, resolvedId, nomorPerkara, params)
        : [];
    }
  );
  if (resolvedCorePerkaraId.length > 0) return resolvedCorePerkaraId;

  const webRows = await tryGetScheduleRows(
    connectionKey,
    "jadwalsidangweb",
    context,
    () => getScheduleFromJadwalSidangWeb(connectionKey, perkaraId, nomorPerkara)
  );
  if (webRows.length > 0) return webRows;

  const resolvedWebRows = await tryGetScheduleRows(
    connectionKey,
    "jadwalsidangweb_by_nomor",
    context,
    async () => {
      const resolvedId = await resolveWebPerkaraIdByNomor(connectionKey, nomorPerkara);
      return resolvedId && resolvedId !== perkaraId
        ? getScheduleFromJadwalSidangWeb(connectionKey, resolvedId, nomorPerkara)
        : [];
    }
  );
  return resolvedWebRows;
}

async function executeLegacySqlValue(params = {}) {
  const connectionKey = normalizeConnectionKey(params.connectionKey);
  const rawSql = safeString(params.sql || params.query);
  if (!rawSql) return { value: null, rowCount: 0, queryHash: "" };

  const prepared = prepareLegacyAbtSql(rawSql, params);
  const rows = await runReadOnly(connectionKey, prepared.sql, prepared.params);
  const list = Array.isArray(rows) ? rows : [];
  const firstRow = list[0] || null;
  const value = pickLegacySqlValue(firstRow);

  return {
    value,
    data: value,
    rowCount: list.length,
    queryHash: hashQuery(prepared.sql),
  };
}

async function getSimplePersonnel(params = {}, tableName, roleLabel) {
  const connectionKey = normalizeConnectionKey(params.connectionKey);
  const perkaraId = safeString(params.perkaraId);
  if (!perkaraId) return [];
  const cols = await getTableColumns(connectionKey, tableName);
  if (cols.size === 0 || !hasColumn(cols, "perkara_id")) return [];
  const nama = columnExpr("x", cols, ["nama", "nama_gelar", "hakim_nama", "panitera_nama", "jurusita_nama"], "''");
  const sql = `
SELECT ${nama} AS nama
FROM ${quoteIdentifier(tableName)} x
WHERE CAST(x.${quoteIdentifier("perkara_id")} AS CHAR) = ?
LIMIT 20`;
  const rows = await runReadOnly(connectionKey, sql, [perkaraId]);
  return (Array.isArray(rows) ? rows : []).map((row) => ({ role: roleLabel, name: safeString(row.nama) })).filter((item) => item.name);
}

async function searchUsers(params = {}) {
  const connectionKey = normalizeConnectionKey(params.connectionKey);
  const query = safeString(params.query || params.username || params.nip || params.email);
  const limit = normalizeLimit(params.limit, 20);
  if (!query) return [];
  const cols = await getTableColumns(connectionKey, "sys_users");
  if (cols.size === 0) return [];
  const id = columnExpr("u", cols, ["id", "user_id"], "''");
  const username = columnExpr("u", cols, ["username", "userid"], "''");
  const fullname = columnExpr("u", cols, ["nama", "fullname", "full_name"], "''");
  const nip = columnExpr("u", cols, ["nip"], "''");
  const email = columnExpr("u", cols, ["email"], "''");
  const groupId = columnExpr("u", cols, ["group_id", "id_group"], "''");
  const sql = `
SELECT ${id} AS id, ${username} AS username, ${fullname} AS fullname, ${nip} AS nip, ${email} AS email, ${groupId} AS group_id
FROM ${quoteIdentifier("sys_users")} u
WHERE LOWER(CONCAT_WS(' ', ${username}, ${fullname}, ${nip}, ${email})) LIKE LOWER(?)
ORDER BY ${fullname}
LIMIT ${limit}`;
  const rows = await runReadOnly(connectionKey, sql, [`%${query}%`]);
  return (Array.isArray(rows) ? rows : []).map((row) => ({
    id: safeString(row.id),
    username: safeString(row.username),
    fullname: safeString(row.fullname),
    nip: safeString(row.nip),
    email: safeString(row.email),
    groupId: safeString(row.group_id),
    groupName: "",
  })).filter((user) => user.id || user.username);
}

async function getSatkerConfig(params = {}) {
  const connectionKey = normalizeConnectionKey(params.connectionKey);
  const cols = await getTableColumns(connectionKey, "sys_config");
  if (cols.size === 0) return {};
  const nameCol = firstColumn(cols, ["name", "nama", "config_name", "key"]);
  const valueCol = firstColumn(cols, ["value", "nilai", "config_value"]);
  if (!nameCol || !valueCol) return {};
  const rows = await runReadOnly(
    connectionKey,
    `SELECT ${quoteIdentifier(nameCol)} AS name, ${quoteIdentifier(valueCol)} AS value FROM ${quoteIdentifier("sys_config")} LIMIT 100`
  );
  return (Array.isArray(rows) ? rows : []).reduce((config, row) => {
    const key = safeString(row.name);
    if (key) config[key] = safeString(row.value);
    return config;
  }, {});
}

function mapEStatusCandidate(row, parties) {
  return {
    sourceCaseId: safeString(row.source_case_id),
    nomorPerkara: safeString(row.nomor_perkara),
    jenisPerkara: safeString(row.jenis_perkara),
    kategoriPerubahan: safeString(row.kategori_perubahan),
    statusHukum: safeString(row.status_hukum),
    tanggalPendaftaran: dateString(row.tanggal_pendaftaran),
    tanggalPutusan: dateString(row.tanggal_putusan),
    tanggalBht: dateString(row.tanggal_bht),
    tanggalIkrarTalak: dateString(row.tanggal_ikrar_talak),
    nomorAktaCerai: safeString(row.nomor_akta_cerai),
    tanggalAktaCerai: dateString(row.tanggal_akta_cerai),
    amarRingkas: safeString(row.amar_ringkas).slice(0, 1200),
    sourceLastChangedAt: dateString(row.source_last_changed_at),
    parties,
  };
}

async function queryEStatusBaseCandidates(connectionKey, category, limit) {
  const pCols = await getTableColumns(connectionKey, "perkara");
  const putusanCols = await getTableColumns(connectionKey, "perkara_putusan");
  if (pCols.size === 0 || putusanCols.size === 0) {
    return { rows: [], queryHash: "", warning: "Tabel perkara/perkara_putusan belum terbaca dari SIPP." };
  }

  const jenis = columnExpr("p", pCols, ["jenis_perkara_nama", "jenis_perkara_text", "jenis_perkara"], "''");
  const tanggalDaftar = columnExpr("p", pCols, ["tanggal_pendaftaran", "tanggal_daftar", "tgl_pendaftaran"], "NULL");
  const sourceChanged = columnExpr("p", pCols, ["diperbaharui_tanggal", "updated_at", "diinput_tanggal"], "NULL");
  const tanggalPutusan = columnExpr("pp", putusanCols, ["tanggal_putusan", "tgl_putusan", "tanggal_penetapan"], "NULL");
  const tanggalBht = columnExpr("pp", putusanCols, ["tanggal_bht", "tgl_bht"], "NULL");
  const amar = columnExpr("pp", putusanCols, ["amar_putusan", "amar", "putusan"], "''");

  const ikrarCols = await getTableColumns(connectionKey, "perkara_ikrar_talak");
  const aktaCols = await getTableColumns(connectionKey, "perkara_akta_cerai");
  const hasIkrar = ikrarCols.size > 0;
  const hasAkta = aktaCols.size > 0;
  const tanggalIkrar = hasIkrar ? columnExpr("it", ikrarCols, ["tanggal_ikrar_talak", "tgl_ikrar_talak", "tanggal_sidang_ikrar"], "NULL") : "NULL";
  const nomorAkta = hasAkta ? columnExpr("ac", aktaCols, ["nomor_akta_cerai", "no_akta_cerai", "nomor_akta"], "''") : "''";
  const tanggalAkta = hasAkta ? columnExpr("ac", aktaCols, ["tanggal_akta_cerai", "tgl_akta_cerai", "tanggal_akta"], "NULL") : "NULL";
  const ikrarJoin = hasIkrar ? `LEFT JOIN ${quoteIdentifier("perkara_ikrar_talak")} it ON it.${quoteIdentifier("perkara_id")} = p.${quoteIdentifier("perkara_id")}` : "";
  const aktaJoin = hasAkta ? `LEFT JOIN ${quoteIdentifier("perkara_akta_cerai")} ac ON ac.${quoteIdentifier("perkara_id")} = p.${quoteIdentifier("perkara_id")}` : "";

  const isDivorce = category === "PERCERAIAN";
  const where = isDivorce
    ? `LOWER(${jenis}) REGEXP 'cerai[[:space:]]+(gugat|talak)' AND ${tanggalBht} IS NOT NULL AND ${tanggalBht} <> '0000-00-00'`
    : `LOWER(${jenis}) REGEXP 'itsbat|isbat|pengesahan[[:space:]]+nikah|pengesahan[[:space:]]+perkawinan'
       AND LOWER(${amar}) LIKE '%kabul%'
       AND LOWER(${amar}) NOT LIKE '%ditolak%'`;
  const statusHukum = isDivorce ? "BHT" : "PENETAPAN_FINAL";

  const sql = `
SELECT
  CAST(p.${quoteIdentifier("perkara_id")} AS CHAR) AS source_case_id,
  p.${quoteIdentifier("nomor_perkara")} AS nomor_perkara,
  ${jenis} AS jenis_perkara,
  ? AS kategori_perubahan,
  ? AS status_hukum,
  ${tanggalDaftar} AS tanggal_pendaftaran,
  ${tanggalPutusan} AS tanggal_putusan,
  ${tanggalBht} AS tanggal_bht,
  ${tanggalIkrar} AS tanggal_ikrar_talak,
  ${nomorAkta} AS nomor_akta_cerai,
  ${tanggalAkta} AS tanggal_akta_cerai,
  ${amar} AS amar_ringkas,
  COALESCE(${sourceChanged}, ${tanggalBht}, ${tanggalPutusan}, ${tanggalDaftar}) AS source_last_changed_at
FROM ${quoteIdentifier("perkara")} p
JOIN ${quoteIdentifier("perkara_putusan")} pp ON pp.${quoteIdentifier("perkara_id")} = p.${quoteIdentifier("perkara_id")}
${ikrarJoin}
${aktaJoin}
WHERE ${where}
ORDER BY source_last_changed_at DESC
LIMIT ${normalizeLimit(limit, 100)}`;

  const rows = await runReadOnly(connectionKey, sql, [category, statusHukum]);
  return { rows: Array.isArray(rows) ? rows : [], queryHash: hashQuery(sql), warning: "" };
}

async function getEStatusCandidates(params = {}) {
  const connectionKey = normalizeConnectionKey(params.connectionKey);
  const scope = safeString(params.scope || "ALL").toUpperCase();
  const limit = normalizeLimit(params.limit, 100);
  const categories = scope === "PERCERAIAN" ? ["PERCERAIAN"] : scope === "ITSBAT_NIKAH" ? ["ITSBAT_NIKAH"] : ["PERCERAIAN", "ITSBAT_NIKAH"];
  const records = [];
  const queryHashes = [];
  const warnings = [];

  for (const category of categories) {
    const result = await queryEStatusBaseCandidates(connectionKey, category, limit);
    if (result.queryHash) queryHashes.push(result.queryHash);
    if (result.warning) warnings.push(result.warning);
    for (const row of result.rows) {
      const parties = await getParties({ connectionKey, perkaraId: row.source_case_id });
      records.push(mapEStatusCandidate(row, parties));
    }
  }

  return {
    connectionKey,
    scope,
    total: records.length,
    records,
    queryHash: hashQuery(queryHashes.join(":")),
    warnings,
  };
}

async function handleBridgeOperation(operation, params = {}) {
  const op = String(operation || "").trim();
  const handlers = {
    health,
    "satker.config": getSatkerConfig,
    "case.searchByNumber": searchCasesByNumber,
    "case.searchByPartyName": searchCasesByPartyName,
    "case.detail": getCaseDetail,
    "case.parties": getParties,
    "case.schedule": getSchedule,
    "case.lastHearing": async (input) => (await getSchedule(input)).slice(-1)[0] || null,
    "case.nextHearing": async (input) => {
      const rows = await getSchedule(input);
      const now = new Date().toISOString().slice(0, 10);
      return rows.find((row) => safeString(row.tanggalSidang).slice(0, 10) >= now) || null;
    },
    "case.judges": (input) => getSimplePersonnel(input, "perkara_hakim_pn", "Hakim"),
    "case.panitera": (input) => getSimplePersonnel(input, "perkara_panitera_pn", "Panitera Pengganti"),
    "case.jurusita": (input) => getSimplePersonnel(input, "perkara_jurusita", "Jurusita/Jurusita Pengganti"),
    "case.mediator": (input) => getSimplePersonnel(input, "perkara_mediasi", "Mediator"),
    "case.witnesses": (input) => getSimplePersonnel(input, "perkara_saksi", "Saksi"),
    "case.decision": getDecision,
    "legacy.sqlValue": executeLegacySqlValue,
    "user.search": searchUsers,
    "user.byUsername": async (input) => (await searchUsers({ ...input, query: input.username, limit: 1 }))[0] || null,
    "user.byNip": async (input) => (await searchUsers({ ...input, query: input.nip, limit: 1 }))[0] || null,
    "user.byEmail": async (input) => (await searchUsers({ ...input, query: input.email, limit: 1 }))[0] || null,
    "user.byId": async (input) => (await searchUsers({ ...input, query: input.id, limit: 1 }))[0] || null,
    "estatus.candidates": getEStatusCandidates,
  };

  const handler = handlers[op];
  if (!handler) throw new Error(`operation_not_registered:${op}`);
  return handler(params);
}

async function safeHandleBridgeOperation(operation, params = {}) {
  try {
    const data = await handleBridgeOperation(operation, params);
    return { ok: true, data };
  } catch (error) {
    const message = externalDbService.sanitizeError(error);
    await logService.logSystemEvent({
      eventType: "sipp_readonly_bridge_failed",
      severity: "warning",
      message: "Bridge SIPP read-only gagal memproses operasi.",
      metadata: {
        operation,
        connectionKey: safeString(params.connectionKey || DEFAULT_CONNECTION_KEY),
        errorMessage: message,
      },
    });
    return { ok: false, error: message, message };
  }
}

module.exports = {
  handleBridgeOperation,
  safeHandleBridgeOperation,
};
