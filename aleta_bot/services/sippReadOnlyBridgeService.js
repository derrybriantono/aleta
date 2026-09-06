"use strict";

const crypto = require("crypto");

const externalDbService = require("./externalDbService");
const botDbService = require("./botDbService");
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
    tanggalSurat: dateString(row.tanggal_surat),
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
  // Tanggal surat gugatan/permohonan - beda dengan tanggal pendaftaran, dan
  // blangko BAS maupun putusan menyebut keduanya di kalimat yang berbeda.
  const tanggalSurat = columnExpr("p", pCols, ["tanggal_surat", "tgl_surat"], "NULL");
  const updatedAt = columnExpr("p", pCols, ["diperbaharui_tanggal", "updated_at", "diinput_tanggal"], "NULL");

  const sql = `
SELECT
  CAST(p.${quoteIdentifier("perkara_id")} AS CHAR) AS perkara_id,
  p.${quoteIdentifier("nomor_perkara")} AS nomor_perkara,
  ${jenis} AS jenis_perkara,
  ${pihak} AS para_pihak,
  ${tahapan} AS tahapan,
  ${tanggalDaftar} AS tanggal_daftar,
  ${tanggalSurat} AS tanggal_surat,
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

  // Jabatan yang SESUNGGUHNYA tercatat SIPP, bukan sebutan seragam.
  //
  // perkara_hakim_pn membedakan "Hakim Ketua" dari "Hakim Anggota", dan blangko
  // BAS memang menanyakan ketua majelisnya (#4004#). Menyeragamkan ketiganya
  // menjadi "Hakim" membuang satu-satunya keterangan yang membedakannya - lalu
  // yang membacanya harus menebak, dan tebakan itu masuk ke naskah resmi.
  const jabatan = columnExpr(
    "x",
    cols,
    ["jabatan_hakim_nama", "jabatan_panitera_nama", "jabatan_jurusita_nama", "jabatan_nama"],
    "''"
  );
  const urutan = hasColumn(cols, "urutan") ? `x.${quoteIdentifier("urutan")}` : "0";

  const sql = `
SELECT ${nama} AS nama,
       ${jabatan} AS jabatan,
       ${urutan} AS urutan
FROM ${quoteIdentifier(tableName)} x
WHERE CAST(x.${quoteIdentifier("perkara_id")} AS CHAR) = ?
ORDER BY ${urutan}
LIMIT 20`;
  const rows = await runReadOnly(connectionKey, sql, [perkaraId]);

  return (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      role: roleLabel,
      // Sebutan seragam tetap disertakan sebagai role supaya pemakai lama tidak
      // pecah; jabatan sesungguhnya ditambahkan di sebelahnya.
      jabatan: safeString(row.jabatan),
      urutan: Number(row.urutan) || 0,
      name: safeString(row.nama),
    }))
    .filter((item) => item.name);
}

/**
 * Sidik sandi SIPP - tiruan persis arr2md5() milik SIPP.
 *
 * Disalin dari application/models/Login/validation_user.php:
 *
 *     hasil = md5(kode_aktivasi)                       32 huruf heksadesimal
 *     code  = md5(sandi)                               32 huruf heksadesimal
 *     hasil[i] = chr(ord(hasil[i]) XOR ord(code[i]))   tiap huruf
 *     kembalikan md5(hasil)
 *
 * DUA HAL YANG MUDAH KELIRU:
 *
 *   1. XOR-nya atas HURUF heksadesimalnya, bukan atas byte yang diwakilinya.
 *      Menerjemahkan hex ke byte lebih dulu menghasilkan sidik yang salah.
 *
 *   2. Hasil XOR di-md5 sebagai DERET BYTE, bukan teks UTF-8. Huruf
 *      heksadesimal ada di 0x30-0x39 dan 0x61-0x66, jadi XOR-nya selalu di
 *      bawah 0x80 - masih aman di latin1, tetapi itu KEBETULAN. Disebut tegas
 *      supaya tidak bergantung pada kebetulan.
 *
 * Dicocokkan terhadap PHP asli di server untuk lima masukan berbeda; lihat
 * scripts/verify-sidik-sandi.js.
 */
function sidikSandiSipp(kodeAktivasi, sandi) {
  const md5Hex = (nilai) => crypto.createHash("md5").update(String(nilai == null ? "" : nilai)).digest("hex");

  let hasil = md5Hex(kodeAktivasi);
  const kode = md5Hex(sandi);

  const batas = Math.min(hasil.length, kode.length);
  let campur = "";
  for (let i = 0; i < batas; i += 1) {
    campur += String.fromCharCode(hasil.charCodeAt(i) ^ kode.charCodeAt(i));
  }
  hasil = campur + hasil.slice(batas);

  return crypto.createHash("md5").update(Buffer.from(hasil, "latin1")).digest("hex");
}

/**
 * Memeriksa apakah sebuah sandi SIPP masih berlaku - TANPA memasukinya.
 *
 * ============================================================================
 * MENGAPA MEMBANDINGKAN DI SINI, BUKAN DI PORTAL
 * ============================================================================
 *
 * Yang keluar dari sini hanya "cocok" atau "tidak". Sidik sandi tersimpan dan
 * kode aktivasinya TIDAK PERNAH meninggalkan sisi SIPP. Bila portal yang
 * membandingkan, keduanya harus dikirim keluar - dan sepasang sidik beserta
 * garamnya adalah bahan pembongkaran sandi secara luring.
 *
 * ============================================================================
 * MENGAPA TIDAK MENCOBA MASUK SAJA
 * ============================================================================
 *
 * Mencoba masuk akan MENULIS ke SIPP: insertSession() menghapus lalu mengisi
 * ulang sys_user_online, dan sys_users.last_login ikut diperbarui. Pemeriksaan
 * kesehatan tidak boleh menyamar menjadi kehadiran orang - apalagi
 * pemeriksaannya bisa berjalan atas akun hakim dan panitera. Cara ini murni
 * membaca.
 */
async function verifikasiSandiPengguna(params = {}) {
  const connectionKey = normalizeConnectionKey(params.connectionKey);
  const username = safeString(params.username);
  const sandi = String(params.sandi == null ? "" : params.sandi);

  if (!username || !sandi) {
    return { ditemukan: false, cocok: false, alasan: "username atau sandi tidak disebutkan" };
  }

  const cols = await getTableColumns(connectionKey, "sys_users");
  if (cols.size === 0) {
    return { ditemukan: false, cocok: false, alasan: "tabel sys_users tidak terbaca" };
  }

  const kolomUsername = columnExpr("u", cols, ["username", "userid"], "''");
  const kolomSandi = columnExpr("u", cols, ["password"], "''");
  const kolomKode = columnExpr("u", cols, ["code_activation"], "''");
  const kolomBlokir = columnExpr("u", cols, ["block"], "0");

  const sql = `
SELECT ${kolomSandi} AS sandi_tersimpan, ${kolomKode} AS kode_aktivasi, ${kolomBlokir} AS diblokir
FROM ${quoteIdentifier("sys_users")} u
WHERE ${kolomUsername} = ?
LIMIT 1`;

  const rows = await runReadOnly(connectionKey, sql, [username]);
  const baris = Array.isArray(rows) ? rows[0] : null;
  if (!baris) {
    return { ditemukan: false, cocok: false, alasan: "username tidak terdaftar di SIPP" };
  }

  const tersimpan = safeString(baris.sandi_tersimpan);
  if (!tersimpan) {
    return { ditemukan: true, cocok: false, alasan: "akun SIPP belum bersandi" };
  }

  const cocok = sidikSandiSipp(baris.kode_aktivasi, sandi) === tersimpan;
  const diblokir = String(baris.diblokir || "0") === "1";

  return {
    ditemukan: true,
    cocok,
    diblokir,
    // Akun yang diblokir tetap ditolak SIPP walau sandinya benar, dan itu
    // harus terbaca berbeda dari sandi yang salah - kalau tidak, pemakainya
    // akan mengetik ulang sandi yang sebenarnya sudah benar berkali-kali.
    alasan: cocok ? (diblokir ? "sandi benar tetapi akun diblokir" : "") : "sandi tidak cocok",
  };
}

/**
 * Menautkan akun SIPP dengan jabatannya - hakim, panitera, juru sita.
 *
 * ============================================================================
 * UNTUK APA
 * ============================================================================
 *
 * Penetapan Hari Sidang dikerjakan ketua majelis perkara itu. Ketuanya
 * diketahui dari perkara_hakim_pn sebagai hakim_id - sebuah ANGKA. Yang
 * dibutuhkan untuk masuk adalah akun SIPP-nya. Tabel inilah jembatannya.
 *
 * Dulu penautan itu saya simpulkan dari kebiasaan pemakaian pada 770
 * penetapan. Cara itu keliru: ia menjawab siapa yang DULU memegang majelis,
 * bukan siapa yang sekarang. Contohnya Majelis B - pemakaian menunjuk akun
 * Waka062024, padahal itu Akbar Ali yang kini diblokir; yang berlaku sekarang
 * Sudarmin. Penautan harus dibaca, bukan ditebak.
 *
 * ============================================================================
 * MENGAPA KESEHATAN AKUN IKUT DIBAWA
 * ============================================================================
 *
 * Satu orang kerap punya beberapa akun SIPP - hakim yang berpindah satker,
 * akun lama yang tidak dihapus. Pada data yang berjalan, hakim_id 30 punya
 * tiga akun sekaligus. Yang membedakan hanya "block": untuk tiap kode majelis
 * ternyata tersisa PERSIS SATU akun yang tidak diblokir.
 *
 * Karena itu block dan user_expired ikut dibawa apa adanya, dan penyaringannya
 * diserahkan ke pemanggil. Menyaring di sini akan menyembunyikan alasan
 * sebuah akun tidak terpilih - dan alasan itulah yang perlu dibaca petugas
 * ketika penetapan tidak dapat dikerjakan.
 */
async function pemetaanAkunJabatan(params = {}) {
  const connectionKey = normalizeConnectionKey(params.connectionKey);
  const kolomUser = await getTableColumns(connectionKey, "sys_users");
  if (kolomUser.size === 0) return { hakim: [], panitera: [], jurusita: [] };

  const username = columnExpr("u", kolomUser, ["username", "userid"], "''");
  const namaLengkap = columnExpr("u", kolomUser, ["fullname", "nama"], "''");
  const diblokir = columnExpr("u", kolomUser, ["block"], "0");
  const kedaluwarsa = columnExpr("u", kolomUser, ["user_expired"], "NULL");
  const terakhirMasuk = columnExpr("u", kolomUser, ["last_login"], "NULL");

  // Peran SIPP diambil lewat anak kueri, BUKAN join.
  //
  // Sebuah akun dapat tercatat pada lebih dari satu grup, dan join akan
  // MELIPATGANDAKAN barisnya - satu akun muncul dua kali sebagai dua calon
  // yang tampak berbeda. Anak kueri selalu memberi satu nilai.
  const grup = `(SELECT g.${quoteIdentifier("name")}
    FROM ${quoteIdentifier("sys_user_group")} ug
    JOIN ${quoteIdentifier("sys_groups")} g ON g.${quoteIdentifier("groupid")} = ug.${quoteIdentifier("groupid")}
    WHERE ug.${quoteIdentifier("userid")} = u.${quoteIdentifier("userid")} LIMIT 1)`;

  async function ambil(tabelTaut, kolomTaut, tabelPejabat) {
    const kolomPejabat = await getTableColumns(connectionKey, tabelPejabat);
    const kolomTautAda = await getTableColumns(connectionKey, tabelTaut);
    if (kolomPejabat.size === 0 || kolomTautAda.size === 0) return [];

    const kode = columnExpr("p", kolomPejabat, ["kode"], "''");
    const nama = columnExpr("p", kolomPejabat, ["nama"], "''");
    const nip = columnExpr("p", kolomPejabat, ["nip"], "''");

    const sql = `
SELECT ${username} AS username, ${namaLengkap} AS nama_lengkap, ${grup} AS grup,
  ${diblokir} AS diblokir, ${kedaluwarsa} AS kedaluwarsa,
  ${terakhirMasuk} AS terakhir_masuk, p.${quoteIdentifier("id")} AS pejabat_id,
  ${kode} AS kode, ${nama} AS nama, ${nip} AS nip
FROM ${quoteIdentifier("sys_users")} u
JOIN ${quoteIdentifier(tabelTaut)} t ON t.${quoteIdentifier("userid")} = u.${quoteIdentifier("userid")}
JOIN ${quoteIdentifier(tabelPejabat)} p ON p.${quoteIdentifier("id")} = t.${quoteIdentifier(kolomTaut)}
ORDER BY ${kode}, ${terakhirMasuk} DESC`;

    const rows = await runReadOnly(connectionKey, sql, []);
    return (Array.isArray(rows) ? rows : []).map((row) => {
      const kedaluwarsaPada = row.kedaluwarsa ? new Date(row.kedaluwarsa) : null;
      const sudahLewat = kedaluwarsaPada instanceof Date
        && !Number.isNaN(kedaluwarsaPada.valueOf())
        && kedaluwarsaPada.valueOf() < Date.now();
      return {
        username: safeString(row.username),
        // Nama yang DITAMPILKAN SIPP di kepala halaman sesudah masuk. Dipakai
        // membuktikan sesi yang terbentuk benar-benar milik akun yang dimaksud,
        // bukan sekadar "berhasil masuk sebagai seseorang".
        namaLengkap: safeString(row.nama_lengkap),
        grup: safeString(row.grup),
        pejabatId: safeString(row.pejabat_id),
        kode: safeString(row.kode),
        nama: safeString(row.nama),
        nip: safeString(row.nip),
        diblokir: String(row.diblokir || "0") === "1",
        kedaluwarsa: sudahLewat,
        aktif: String(row.diblokir || "0") !== "1" && !sudahLewat,
        terakhirMasuk: row.terakhir_masuk ? new Date(row.terakhir_masuk).toISOString() : null,
      };
    }).filter((item) => item.username && item.pejabatId);
  }

  return {
    hakim: await ambil("user_hakim", "hakim_id", "hakim_pn"),
    panitera: await ambil("user_panitera", "panitera_id", "panitera_pn"),
    jurusita: await ambil("user_jurusita", "jurusita_id", "jurusita"),
  };
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



/**
 * Daftar perkara e-Court menurut SIPP.
 *
 * ============================================================================
 * SIPP ADALAH ACUANNYA, BUKAN HALAMAN E-COURT
 * ============================================================================
 *
 * Sebelumnya jembatan mengambil perkara dari tautan apa pun yang kebetulan ada
 * di halaman setelah login. Akibatnya perkara di halaman kedua tidak pernah
 * terlihat, dan tidak ada cara mengetahui apa yang SEHARUSNYA ada - kalau satu
 * perkara terlewat, tidak ada yang menyadarinya.
 *
 * SIPP sudah memegang jawabannya secara resmi:
 *
 *   perkara.perkara_id
 *     -> perkara_efiling_id.perkara_id / .efiling_id
 *       -> perkara_efiling.nomor_register
 *
 * PENDAFTARAN GANDA
 *
 * Satu perkara dapat memiliki LEBIH DARI SATU pendaftaran e-Court - pada
 * database PA Donggala, perkara_id 4227 memetakan ke efiling_id 9168 dan
 * 13739. Yang dipakai adalah yang TERBARU, sesuai ketetapan pimpinan. Urutan
 * ditentukan tanggal pendaftaran lebih dulu, baru efiling_id sebagai pemutus
 * bila tanggalnya sama atau kosong.
 *
 * Penyaringan duplikat dilakukan di sisi Node, bukan dengan window function.
 * SIPP berjalan di MySQL lama yang belum tentu mendukungnya, dan kegagalannya
 * akan berupa galat sintaks yang membingungkan di server pengadilan.
 */
async function listEcourtCases(params = {}) {
  const connectionKey = normalizeConnectionKey(params.connectionKey);
  const limit = Math.min(Math.max(Number(params.limit) || 200, 1), 2000);

  // Menyaring perkara lama: menarik ulang perkara bertahun lalu hanya
  // membebani server Mahkamah Agung tanpa menemukan dokumen baru.
  const sejakHari = Math.min(Math.max(Number(params.sejakHari) || 365, 1), 3650);

  const rows = await runReadOnly(
    connectionKey,
    `SELECT p.perkara_id      AS perkaraId,
            p.nomor_perkara   AS nomorPerkara,
            e.efiling_id      AS efilingId,
            e.nomor_register  AS nomorRegister,
            e.tanggal_pendaftaran     AS tanggalPendaftaran,
            e.status_pendaftaran_text AS statusPendaftaran,
            e.status_pembayaran       AS statusPembayaran,
            e.nomor_perkara           AS nomorPerkaraEfiling,
            p.alur_perkara_id         AS alurId,
            a.kode                    AS alurKode,
            a.nama                    AS alurNama
       FROM perkara p
       JOIN perkara_efiling_id k ON k.perkara_id = p.perkara_id
       JOIN perkara_efiling e    ON e.efiling_id = k.efiling_id
       LEFT JOIN alur_perkara a  ON a.id = p.alur_perkara_id
      WHERE p.tanggal_pendaftaran >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      ORDER BY p.perkara_id DESC, e.tanggal_pendaftaran DESC, e.efiling_id DESC
      LIMIT ?`,
    [sejakHari, limit * 4]
  );

  const daftar = Array.isArray(rows) ? rows : [];
  const terpilih = new Map();
  let pendaftaranGanda = 0;

  for (const row of daftar) {
    const perkaraId = safeString(row.perkaraId);
    if (!perkaraId) continue;

    // Baris sudah terurut terbaru lebih dulu, jadi yang pertama masuk adalah
    // yang dipakai. Sisanya dihitung, bukan dibuang diam-diam - jumlahnya
    // adalah keterangan yang berguna bagi petugas.
    if (terpilih.has(perkaraId)) {
      pendaftaranGanda += 1;
      continue;
    }

    terpilih.set(perkaraId, {
      perkaraId,
      nomorPerkara: safeString(row.nomorPerkara),
      efilingId: safeString(row.efilingId),
      nomorRegister: safeString(row.nomorRegister),
      tanggalPendaftaran: safeString(row.tanggalPendaftaran).slice(0, 10),
      statusPendaftaran: safeString(row.statusPendaftaran),
      sudahDibayar: safeString(row.statusPembayaran) === "1",
      // Nomor perkara versi e-Court, untuk dibandingkan dengan versi SIPP.
      nomorPerkaraEfiling: safeString(row.nomorPerkaraEfiling),
      // Alur perkara menentukan menu mana yang harus dibuka di e-Court:
      // Pdt.G ke Gugatan, Pdt.P ke Permohonan, Pdt.G.S ke Gugatan
      // Sederhana. Diambil dari SIPP, bukan diurai dari nomor perkara -
      // SIPP sudah menyimpannya sebagai data, dan mengurai teks nomor
      // perkara hanya menambah satu tempat lagi yang bisa salah.
      alurId: safeString(row.alurId),
      alurKode: safeString(row.alurKode),
      alurNama: safeString(row.alurNama),
    });

    if (terpilih.size >= limit) break;
  }

  return {
    diperiksaPada: new Date().toISOString(),
    sejakHari,
    jumlah: terpilih.size,
    pendaftaranGanda,
    perkara: [...terpilih.values()],
  };
}

/**
 * Membaca struktur SIPP dari information_schema.
 *
 * Ini yang membuat ALETA benar-benar "hafal tabel SIPP" alih-alih menebak.
 * Kamus Database SIPP selama ini diisi tangan, sehingga selalu tertinggal dari
 * SIPP yang sesungguhnya terpasang - dan setiap kueri baru dibangun di atas
 * dugaan tentang nama kolom.
 *
 * YANG DIBACA HANYA STRUKTUR. information_schema tidak memuat satu pun baris
 * data perkara: tidak ada nama pihak, tidak ada alamat, tidak ada NIK. Yang
 * keluar dari sini hanyalah nama tabel, nama kolom, tipe data, dan komentar
 * yang memang ditulis pembuat SIPP sebagai dokumentasi.
 *
 * DATABASE() dipakai, bukan nama skema dari parameter. Menerima nama skema
 * dari luar berarti membuka jalan membaca struktur database lain di server
 * MySQL yang sama - termasuk yang bukan urusan ALETA.
 */
async function introspectSchema(params = {}) {
  const connectionKey = normalizeConnectionKey(params.connectionKey);

  const tabel = await runReadOnly(
    connectionKey,
    `SELECT TABLE_NAME AS nama, TABLE_TYPE AS jenis, TABLE_COMMENT AS keterangan
       FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
      ORDER BY TABLE_NAME`
  );

  const kolom = await runReadOnly(
    connectionKey,
    `SELECT TABLE_NAME AS tabel, COLUMN_NAME AS nama, DATA_TYPE AS tipe,
            COLUMN_TYPE AS tipeLengkap, IS_NULLABLE AS bolehKosong,
            COLUMN_KEY AS kunci, COLUMN_COMMENT AS keterangan,
            ORDINAL_POSITION AS urutan
       FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
      ORDER BY TABLE_NAME, ORDINAL_POSITION`
  );

  const daftarTabel = Array.isArray(tabel) ? tabel : [];
  const daftarKolom = Array.isArray(kolom) ? kolom : [];

  return {
    diperiksaPada: new Date().toISOString(),
    jumlahTabel: daftarTabel.filter((t) => safeString(t.jenis) === "BASE TABLE").length,
    jumlahView: daftarTabel.filter((t) => safeString(t.jenis) === "VIEW").length,
    jumlahKolom: daftarKolom.length,
    tabel: daftarTabel.map((t) => ({
      nama: safeString(t.nama),
      jenis: safeString(t.jenis) === "VIEW" ? "view" : "tabel",
      keterangan: safeString(t.keterangan),
    })),
    kolom: daftarKolom.map((k) => ({
      tabel: safeString(k.tabel),
      nama: safeString(k.nama),
      tipe: safeString(k.tipe),
      tipeLengkap: safeString(k.tipeLengkap),
      bolehKosong: safeString(k.bolehKosong) === "YES",
      kunciUtama: safeString(k.kunci) === "PRI",
      terindeks: safeString(k.kunci) !== "",
      keterangan: safeString(k.keterangan),
      urutan: Number(k.urutan) || 0,
    })),
  };
}

/**
 * Pertimbangan hukum yang sudah ditulis majelis untuk satu perkara.
 *
 * ============================================================================
 * BAHAN PUSTAKA PERTIMBANGAN, BUKAN SEKADAR TAMPILAN
 * ============================================================================
 *
 * Tabel perkara_pertimbangan_hukum memuat 2.224 pertimbangan tulisan hakim
 * pengadilan ini sendiri - rata-rata delapan ribu huruf, sejak Mei 2024. Inilah
 * bahan yang kelak dipecah menjadi butir pustaka.
 *
 * Dikembalikan APA ADANYA, tanpa dipotong dan tanpa dirapikan. Yang membaca
 * berhak melihat naskah yang sesungguhnya ditandatangani, bukan ringkasan yang
 * dibuat di tengah jalan.
 */
async function getPertimbanganHukum(params = {}) {
  const connectionKey = normalizeConnectionKey(params.connectionKey);
  const perkaraId = safeString(params.perkaraId);
  if (!perkaraId) return null;

  const cols = await getTableColumns(connectionKey, "perkara_pertimbangan_hukum");
  if (cols.size === 0 || !hasColumn(cols, "perkara_id")) return null;

  const naskah = columnExpr("ph", cols, ["pertimbangan_hukum"], "''");
  const tanggal = columnExpr("ph", cols, ["tanggal_pertimbangan_hukum"], "NULL");
  const oleh = columnExpr("ph", cols, ["diinput_oleh"], "''");
  const diperbaharuiOleh = columnExpr("ph", cols, ["diperbaharui_oleh"], "''");
  const diperbaharuiTanggal = columnExpr("ph", cols, ["diperbaharui_tanggal"], "NULL");

  const sql = `
SELECT ${naskah} AS naskah, ${tanggal} AS tanggal, ${oleh} AS oleh,
       ${diperbaharuiOleh} AS diperbaharui_oleh, ${diperbaharuiTanggal} AS diperbaharui_tanggal
FROM ${quoteIdentifier("perkara_pertimbangan_hukum")} ph
WHERE CAST(ph.${quoteIdentifier("perkara_id")} AS CHAR) = ?
LIMIT 1`;

  const rows = await runReadOnly(connectionKey, sql, [perkaraId]);
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row) return null;

  const naskahTeks = safeString(row.naskah);
  return {
    ada: naskahTeks.length > 0,
    naskah: naskahTeks,
    panjangHuruf: naskahTeks.length,
    tanggal: safeString(row.tanggal),
    diinputOleh: safeString(row.oleh),
    diperbaharuiOleh: safeString(row.diperbaharui_oleh),
    diperbaharuiTanggal: safeString(row.diperbaharui_tanggal),
  };
}

/**
 * Nama basis data APS Badilag pada server ini.
 *
 * Dicari, tidak dipatok. Nama "aps_badilag" berlaku di pengadilan ini, tetapi
 * pemasangan lain dapat berbeda - dan aplikasi yang mati karena nama basis data
 * berbeda adalah kegagalan yang sepele sekaligus membingungkan. Cadangan
 * (Backup_aps_badilag) sengaja dilewati: yang dibaca harus yang hidup.
 */
let cacheSkemaAbt;
async function cariSkemaAbt(connectionKey) {
  if (cacheSkemaAbt !== undefined) return cacheSkemaAbt;
  try {
    const rows = await runReadOnly(
      connectionKey,
      `SELECT TABLE_SCHEMA AS skema
         FROM information_schema.TABLES
        WHERE TABLE_NAME = 'abt_keterangan_saksi'
          AND TABLE_SCHEMA NOT LIKE 'Backup%'
        ORDER BY TABLE_SCHEMA
        LIMIT 1`,
      []
    );
    cacheSkemaAbt = safeString(Array.isArray(rows) ? rows[0]?.skema : "") || null;
  } catch {
    cacheSkemaAbt = null;
  }
  return cacheSkemaAbt;
}

/**
 * Pemeriksaan saksi dari APS Badilag ABT - transkrip, bukan ringkasan.
 *
 * ============================================================================
 * MENGAPA DIBACA LANGSUNG, BUKAN DISALIN
 * ============================================================================
 *
 * ABT dan SIPP berada di satu server MariaDB yang sama, dan kuncinya identik:
 * dari 2.223 perkara di ABT, seluruhnya ditemukan di SIPP dengan perkara_id
 * yang sama. Karena itu cukup dibaca langsung - tidak ada penyalinan berkala
 * yang harus dijaga tetap sinkron, dan tidak ada jendela waktu tempat keduanya
 * berselisih.
 *
 * Yang tersimpan bukan ringkasan melainkan tanya-jawab: siapa bertanya, saksi
 * ke berapa, urutan, pertanyaannya, jawabannya. 65.526 baris dari 4.529 saksi.
 *
 * HANYA DIBACA. ABT adalah aplikasi resmi yang dipakai panitera setiap hari;
 * menulis ke dalamnya dari luar berarti mengubah alat kerja orang lain tanpa
 * sepengetahuannya.
 */
async function getPemeriksaanSaksi(params = {}) {
  const connectionKey = normalizeConnectionKey(params.connectionKey);
  const perkaraId = safeNumericId(params.perkaraId);
  if (!perkaraId) return { ada: false, sebab: "perkara_id bukan angka", saksi: [] };

  const skema = await cariSkemaAbt(connectionKey);
  if (!skema) return { ada: false, sebab: "Basis data APS Badilag tidak ditemukan di server ini.", saksi: [] };

  // Batas 400 baris: satu perkara terpanjang yang tercatat memuat 121 tanya
  // jawab, jadi ambang ini lapang - tetapi tetap ada, supaya satu perkara yang
  // tidak wajar tidak menarik puluhan ribu baris ke dalam memori.
  const sql = `
SELECT ks.${quoteIdentifier("saksi_id")} AS saksi_id,
       ks.${quoteIdentifier("sidang_id")} AS sidang_id,
       ks.${quoteIdentifier("penanya_id")} AS penanya_id,
       ks.${quoteIdentifier("urutan_pertanyaan")} AS urutan,
       ks.${quoteIdentifier("pertanyaan")} AS pertanyaan,
       ks.${quoteIdentifier("jawaban")} AS jawaban
FROM ${quoteIdentifier(skema)}.${quoteIdentifier("abt_keterangan_saksi")} ks
WHERE ks.${quoteIdentifier("perkara_id")} = ?
ORDER BY ks.${quoteIdentifier("saksi_id")}, ks.${quoteIdentifier("urutan_pertanyaan")}
LIMIT 400`;

  let rows = [];
  try {
    rows = await runReadOnly(connectionKey, sql, [perkaraId]);
  } catch (error) {
    return { ada: false, sebab: externalDbService.sanitizeError(error), saksi: [] };
  }

  const perSaksi = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const id = safeString(row.saksi_id) || "-";
    if (!perSaksi.has(id)) perSaksi.set(id, { saksiId: id, sidangId: safeString(row.sidang_id), tanyaJawab: [] });
    perSaksi.get(id).tanyaJawab.push({
      urutan: Number(row.urutan) || 0,
      penanya: safeString(row.penanya_id),
      pertanyaan: safeString(row.pertanyaan),
      jawaban: safeString(row.jawaban),
    });
  }

  // Nomor urut saksi DINYATAKAN, tidak dititipkan pada urutan larik.
  //
  // saksi_id di ABT adalah nomor global (17346, 17347), bukan "saksi ke-1" dan
  // "saksi ke-2". Blangko BAS menyediakan tempat menurut urutannya - #5058#
  // untuk yang pertama, #5059# untuk yang kedua - jadi urutannya harus terbaca
  // tegas. Membiarkan pembaca menyimpulkannya dari posisi larik berarti satu
  // perubahan urutan di kemudian hari memindahkan keterangan saksi pertama ke
  // tempat saksi kedua tanpa satu pun tanda di layar.
  const saksi = [...perSaksi.values()].map((item, urutan) => ({ ...item, saksiKe: urutan + 1 }));

  return {
    ada: saksi.length > 0,
    sumber: `${skema}.abt_keterangan_saksi`,
    jumlahSaksi: saksi.length,
    jumlahTanyaJawab: rows.length,
    saksi,
  };
}

/**
 * Katalog tanya-jawab ABT untuk satu jenis perkara.
 *
 * ============================================================================
 * TIDAK MENYUSUN ULANG APA YANG SUDAH ADA
 * ============================================================================
 *
 * ABT sudah memuat kumpulan pertanyaan pemeriksaan yang terpakai bertahun-tahun,
 * berkunci jenis perkara: A1a untuk saksi Penggugat cerai gugat, A2a untuk saksi
 * Tergugat, IN untuk isbat nikah, dan seterusnya. Menyusun ulang daftar itu di
 * ALETA berarti membuat salinan kedua yang pasti berselisih dengan aslinya.
 *
 * Yang dikerjakan ALETA bukan menggantinya, melainkan mengisinya dari berkas
 * perkara supaya panitera tidak mengetik ulang yang sudah ada di SIPP.
 */
async function getKatalogTanyaJawab(params = {}) {
  const connectionKey = normalizeConnectionKey(params.connectionKey);
  const skema = await cariSkemaAbt(connectionKey);
  if (!skema) return { ada: false, sebab: "Basis data APS Badilag tidak ditemukan.", kumpulan: [] };

  const jenisPerkaraId = safeNumericId(params.jenisPerkaraId);
  const syarat = jenisPerkaraId ? "WHERE t.`jenis_perkara_id` = ?" : "";
  const nilai = jenisPerkaraId ? [jenisPerkaraId] : [];

  const sql = `
SELECT t.${quoteIdentifier("kode")} AS kode,
       t.${quoteIdentifier("nama")} AS nama,
       t.${quoteIdentifier("jenis_perkara_id")} AS jenis_perkara_id,
       (SELECT COUNT(*) FROM ${quoteIdentifier(skema)}.${quoteIdentifier("abt_tanyajawab_template")} q
         WHERE q.${quoteIdentifier("kode_tanyajawab")} = t.${quoteIdentifier("kode")}) AS jumlah_pertanyaan
FROM ${quoteIdentifier(skema)}.${quoteIdentifier("abt_tanyajawab_id")} t
${syarat}
ORDER BY t.${quoteIdentifier("kode")}
LIMIT 200`;

  try {
    const rows = await runReadOnly(connectionKey, sql, nilai);
    const kumpulan = (Array.isArray(rows) ? rows : []).map((row) => ({
      kode: safeString(row.kode),
      nama: safeString(row.nama),
      jenisPerkaraId: safeString(row.jenis_perkara_id),
      jumlahPertanyaan: Number(row.jumlah_pertanyaan) || 0,
    }));
    return { ada: kumpulan.length > 0, sumber: `${skema}.abt_tanyajawab_id`, kumpulan };
  } catch (error) {
    return { ada: false, sebab: externalDbService.sanitizeError(error), kumpulan: [] };
  }
}

/**
 * Satu kumpulan tanya-jawab, beserta variabel yang dirujuknya.
 *
 * ============================================================================
 * PENANDA #NNNN# TIDAK DIISI DI SINI
 * ============================================================================
 *
 * Pertanyaan ABT memuat penanda seperti #0046# yang menunjuk nomor variabel.
 * Jembatan ini mengembalikan pertanyaannya APA ADANYA beserta daftar variabel
 * yang dirujuk - lengkap dengan tabel dan kolom SIPP asalnya, karena ABT sendiri
 * yang mendeklarasikannya.
 *
 * Pengisiannya dikerjakan di portal, dari berkas perkara yang sudah dirakit.
 * Mengisinya di sini berarti jembatan harus tahu perkara mana yang sedang
 * dibuka, dan itu menjadikan operasi baca sederhana ini bergantung pada seluruh
 * rantai perakitan berkas.
 */
async function getTanyaJawab(params = {}) {
  const connectionKey = normalizeConnectionKey(params.connectionKey);
  const kode = safeString(params.kode);
  if (!kode) return { ada: false, sebab: "kode tanya-jawab kosong", pertanyaan: [], variabel: [] };

  const skema = await cariSkemaAbt(connectionKey);
  if (!skema) return { ada: false, sebab: "Basis data APS Badilag tidak ditemukan.", pertanyaan: [], variabel: [] };

  const sqlTanya = `
SELECT q.${quoteIdentifier("urutan_pertanyaan")} AS urutan,
       q.${quoteIdentifier("pertanyaan")} AS pertanyaan,
       q.${quoteIdentifier("jawaban")} AS jawaban
FROM ${quoteIdentifier(skema)}.${quoteIdentifier("abt_tanyajawab_template")} q
WHERE q.${quoteIdentifier("kode_tanyajawab")} = ?
ORDER BY q.${quoteIdentifier("urutan_pertanyaan")}
LIMIT 200`;

  try {
    const rows = await runReadOnly(connectionKey, sqlTanya, [kode]);
    const pertanyaan = (Array.isArray(rows) ? rows : []).map((row) => ({
      urutan: Number(row.urutan) || 0,
      pertanyaan: safeString(row.pertanyaan),
      jawabanBawaan: safeString(row.jawaban),
    }));

    // Variabel yang benar-benar dirujuk saja - mengembalikan seluruh 1.253
    // variabel untuk satu kumpulan pertanyaan adalah pemborosan yang akan
    // terasa pada tiap pembukaan halaman.
    const dipakai = new Set();
    for (const baris of pertanyaan) {
      for (const teks of [baris.pertanyaan, baris.jawabanBawaan]) {
        for (const cocok of teks.matchAll(/#(\d{3,5})#/g)) dipakai.add(cocok[1]);
      }
    }

    let variabel = [];
    if (dipakai.size > 0) {
      const tanda = [...dipakai].map(() => "?").join(",");
      const sqlVar = `
SELECT v.${quoteIdentifier("no_var")} AS no_var,
       v.${quoteIdentifier("nama")} AS nama,
       v.${quoteIdentifier("data_type")} AS jenis,
       v.${quoteIdentifier("data_tabel")} AS tabel,
       v.${quoteIdentifier("data_kolom")} AS kolom,
       v.${quoteIdentifier("default_data")} AS bawaan
FROM ${quoteIdentifier(skema)}.${quoteIdentifier("abt_variabel")} v
WHERE v.${quoteIdentifier("no_var")} IN (${tanda})
LIMIT 200`;
      const baris = await runReadOnly(connectionKey, sqlVar, [...dipakai]);
      variabel = (Array.isArray(baris) ? baris : []).map((row) => ({
        noVar: safeString(row.no_var),
        nama: safeString(row.nama),
        jenis: safeString(row.jenis) || "manual",
        tabelSipp: safeString(row.tabel),
        kolomSipp: safeString(row.kolom),
        bawaan: safeString(row.bawaan),
      }));
    }

    return {
      ada: pertanyaan.length > 0,
      sumber: `${skema}.abt_tanyajawab_template`,
      kode,
      jumlahPertanyaan: pertanyaan.length,
      pertanyaan,
      variabel,
    };
  } catch (error) {
    return { ada: false, sebab: externalDbService.sanitizeError(error), pertanyaan: [], variabel: [] };
  }
}

/**
 * Dokumen e-Court satu perkara.
 *
 * ============================================================================
 * DARI BASIS DATA BOT, BUKAN DARI MENGETUK E-COURT LAGI
 * ============================================================================
 *
 * Penarik e-Court sudah berjalan dan menyimpan hasilnya di
 * aleta_bot_ecourt_documents. Membaca dari sana berarti membuka perkara TIDAK
 * memanggil server Mahkamah Agung - halaman perkara yang menunggu jaringan
 * luar akan terasa berat, dan yang terasa berat ditinggalkan.
 *
 * Berkas yang sudah terunduh disertakan lewat aleta_bot_ecourt_files supaya
 * yang membaca tahu dokumen itu benar-benar ada di gedung ini, bukan sekadar
 * tercatat namanya di portal.
 */
async function getDokumenECourt(params = {}) {
  const perkaraId = safeString(params.perkaraId);
  const nomorPerkara = safeString(params.nomorPerkara);
  if (!perkaraId && !nomorPerkara) return { ada: false, sebab: "Perkara tidak dikenali.", dokumen: [] };

  const syarat = perkaraId ? "d.perkara_id = ?" : "d.nomor_perkara = ?";
  const nilai = [perkaraId || nomorPerkara];

  try {
    const rows = await botDbService.query(
      `SELECT d.document_key, d.nomor_perkara, d.perkara_id, d.judul_dokumen, d.jenis_dokumen,
              d.peran_pengunggah, d.diunggah_pada, d.agenda, d.tanggal_sidang, d.batas_unggah,
              d.status_verifikasi, d.berkas_pdf, d.berkas_word, d.pertama_terlihat, d.terakhir_terlihat,
              f.jalur_berkas, f.ukuran_byte, f.diunduh_pada, f.format
         FROM aleta_bot_ecourt_documents d
         LEFT JOIN aleta_bot_ecourt_files f ON f.document_key = d.document_key
        WHERE ${syarat}
        ORDER BY d.tanggal_sidang, d.judul_dokumen
        LIMIT 300`,
      nilai
    );

    const daftar = Array.isArray(rows) ? rows : [];

    // Satu dokumen dapat punya beberapa berkas - PDF dan Word. Digabung per
    // dokumen supaya yang membaca melihat DOKUMEN, bukan daftar berkas yang
    // sebagian namanya sama.
    const perDokumen = new Map();
    for (const row of daftar) {
      const kunci = safeString(row.document_key);
      if (!perDokumen.has(kunci)) {
        perDokumen.set(kunci, {
          kunci,
          nomorPerkara: safeString(row.nomor_perkara),
          perkaraId: safeString(row.perkara_id),
          judul: safeString(row.judul_dokumen),
          jenis: safeString(row.jenis_dokumen),
          peranPengunggah: safeString(row.peran_pengunggah),
          diunggahPada: dateString(row.diunggah_pada),
          agenda: safeString(row.agenda),
          tanggalSidang: dateString(row.tanggal_sidang),
          batasUnggah: dateString(row.batas_unggah),
          statusVerifikasi: safeString(row.status_verifikasi),
          pertamaTerlihat: dateString(row.pertama_terlihat),
          terakhirTerlihat: dateString(row.terakhir_terlihat),
          berkas: [],
        });
      }
      const jalur = safeString(row.jalur_berkas);
      if (jalur) {
        perDokumen.get(kunci).berkas.push({
          jalur,
          format: safeString(row.format),
          besarByte: Number(row.ukuran_byte) || 0,
          diunduhPada: dateString(row.diunduh_pada),
        });
      }
    }

    const dokumen = [...perDokumen.values()];
    return {
      ada: dokumen.length > 0,
      sumber: "aleta_bot.aleta_bot_ecourt_documents",
      jumlahDokumen: dokumen.length,
      jumlahBerkasTerunduh: dokumen.reduce((jumlah, item) => jumlah + item.berkas.length, 0),
      dokumen,
    };
  } catch (error) {
    return { ada: false, sebab: externalDbService.sanitizeError(error), dokumen: [] };
  }
}

/**
 * Nama dan jenis variabel ABT untuk sekumpulan nomor penanda.
 *
 * ============================================================================
 * SUPAYA TEMUAN TERBACA DALAM BAHASA PANITERA
 * ============================================================================
 *
 * Pemeriksaan kelengkapan yang berbunyi "penanda 4001 dan 8505 belum terisi"
 * memaksa panitera menghafal nomor variabel - persis yang membuat JLF terasa
 * memusingkan. Dengan namanya, kalimat yang sama menjadi "amar putusan dan
 * amar biaya perkara belum terisi", dan itu langsung dapat ditindaklanjuti.
 *
 * Dibatasi 300 nomor sekali baca: blangko terpanjang memuat 75 penanda, jadi
 * batas ini longgar - tetapi tetap ada, supaya permintaan yang keliru tidak
 * menarik seluruh tabel.
 */
async function getNamaVariabel(params = {}) {
  const connectionKey = normalizeConnectionKey(params.connectionKey);
  const daftar = [...new Set((Array.isArray(params.noVar) ? params.noVar : []).map(safeString).filter(Boolean))].slice(
    0,
    300
  );
  if (daftar.length === 0) return { ada: false, sebab: "Tidak ada penanda yang ditanyakan.", variabel: [] };

  const skema = await cariSkemaAbt(connectionKey);
  if (!skema) return { ada: false, sebab: "Basis data APS Badilag tidak ditemukan.", variabel: [] };

  try {
    const tanda = daftar.map(() => "?").join(",");
    const sql = `
SELECT v.${quoteIdentifier("no_var")} AS no_var,
       v.${quoteIdentifier("nama")} AS nama,
       v.${quoteIdentifier("data_type")} AS jenis
FROM ${quoteIdentifier(skema)}.${quoteIdentifier("abt_variabel")} v
WHERE v.${quoteIdentifier("no_var")} IN (${tanda})
LIMIT 300`;
    const baris = await runReadOnly(connectionKey, sql, daftar);

    return {
      ada: true,
      sumber: `${skema}.abt_variabel`,
      variabel: (Array.isArray(baris) ? baris : []).map((row) => ({
        noVar: safeString(row.no_var),
        nama: safeString(row.nama),
        jenis: safeString(row.jenis) || "manual",
      })),
    };
  } catch (error) {
    return { ada: false, sebab: externalDbService.sanitizeError(error), variabel: [] };
  }
}

/**
 * SELURUH definisi variabel ABT - untuk disalin sekali ke kamus ALETA.
 *
 * ============================================================================
 * BERBEDA DARI abt.namaVariabel, DAN SENGAJA
 * ============================================================================
 *
 * abt.namaVariabel menjawab "apa nama penanda ini" untuk segelintir nomor,
 * supaya temuan pemeriksaan terbaca dalam bahasa panitera. Yang ini menjawab
 * "apa definisi seluruh variabel" satu kali, supaya ALETA dapat berhenti
 * bergantung pada tabel ini sama sekali.
 *
 * Karena itu ia mengembalikan sql_query juga. Empat ratus enam puluh enam
 * variabel sudah memuat kueri yang berjalan, dan selama ini ALETA menulis
 * ulang pemetaannya dengan tangan - 87 dari 749 kode yang dipakai blangko,
 * tujuh di antaranya keliru karena artinya ditebak dari namanya.
 *
 * ============================================================================
 * TIDAK ADA PARAMETER DARI PEMANGGIL
 * ============================================================================
 *
 * Operasi ini tidak menerima satu pun masukan yang masuk ke dalam kueri. Ia
 * membaca satu tabel utuh, dan tidak ada bagian yang dapat dipengaruhi dari
 * luar - jadi tidak ada jalan masuk yang perlu dijaga. Kuerinya sendiri tetap
 * lewat runReadOnly, sama dengan seluruh jembatan ini.
 */
async function getSemuaVariabel(params = {}) {
  const connectionKey = normalizeConnectionKey(params.connectionKey);
  const skema = await cariSkemaAbt(connectionKey);
  if (!skema) return { ada: false, sebab: "Basis data APS Badilag tidak ditemukan.", skema: "", variabel: [] };

  try {
    const sql = `
SELECT v.${quoteIdentifier("no_var")} AS no_var,
       v.${quoteIdentifier("nama")} AS nama,
       v.${quoteIdentifier("data_type")} AS jenis,
       v.${quoteIdentifier("sql_query")} AS sql_query,
       v.${quoteIdentifier("data_tabel")} AS data_tabel,
       v.${quoteIdentifier("data_kolom")} AS data_kolom,
       v.${quoteIdentifier("default_data")} AS default_data
FROM ${quoteIdentifier(skema)}.${quoteIdentifier("abt_variabel")} v
ORDER BY v.${quoteIdentifier("no_var")}`;
    const baris = await runReadOnly(connectionKey, sql, []);

    return {
      ada: true,
      skema,
      jumlah: Array.isArray(baris) ? baris.length : 0,
      variabel: (Array.isArray(baris) ? baris : []).map((row) => ({
        noVar: safeString(row.no_var),
        nama: safeString(row.nama),
        jenis: safeString(row.jenis),
        // sql_query TIDAK dirapikan. Yang menyatakan arti sebuah variabel
        // adalah definisinya, bukan pembacanya.
        sqlQuery: safeString(row.sql_query),
        dataTabel: safeString(row.data_tabel),
        dataKolom: safeString(row.data_kolom),
        defaultData: safeString(row.default_data),
      })),
    };
  } catch (error) {
    return { ada: false, sebab: externalDbService.sanitizeError(error), skema, variabel: [] };
  }
}

/**
 * Katalog blangko BAS dan putusan dari APS Badilag.
 *
 * ============================================================================
 * DIBACA DARI FOLDER ASLINYA, TIDAK DISALIN
 * ============================================================================
 *
 * Blangko adalah alat kerja panitera yang dipakai lewat aplikasi aslinya dan
 * kadang disunting di sana. Menyalinnya ke ALETA berarti membuat salinan kedua
 * yang akan berselisih dengan aslinya tanpa ada yang menyadari - dan yang
 * dipakai menyusun BAS resmi haruslah yang sama dengan yang dipegang panitera.
 *
 * Foldernya dipasang BACA-SAJA di /usr/src/app/blangko_abt. Bahkan bila kode
 * ini keliru dan mencoba menulis, sistem berkasnya yang menolak.
 *
 * ============================================================================
 * PENAMAAN BERKAS ADALAH DATANYA
 * ============================================================================
 *
 * Nama blangko mengkodekan seluruh keterangannya, dan itu bukan kebetulan -
 * begitulah panitera mencarinya:
 *
 *   [01ab] [Tolak Verstek] Cerai - Unus Testis Nullus Testis.rtf
 *   [01a] (E-Court) BAS 1 P Hadir & T Tidak Hadir - Tunda Panggil T.rtf
 *
 * Kode urut, kategori putusan dalam kurung siku kedua, penanda e-Court, lalu
 * keadaan dan hasilnya. Nama aslinya SELALU ikut dikembalikan: penguraian ini
 * kemudahan, dan yang menyusun dokumen resmi berhak melihat nama sebenarnya.
 */
const path = require("path");
const fs = require("fs/promises");

const AKAR_BLANGKO = process.env.ALETA_BOT_BLANGKO_DIR || "/usr/src/app/blangko_abt";

/**
 * Menolak nama folder yang keluar dari akar blangko.
 *
 * Nama folder datang dari permintaan. Tanpa penjagaan ini, "../../etc" menjadi
 * jalan membaca berkas mana pun yang terjangkau bot - dan folder blangko justru
 * dipasang supaya bot membaca lebih banyak, bukan supaya membaca apa saja.
 */
function jalurBlangkoAman(bagian) {
  const bersih = String(bagian || "").trim();
  if (!bersih) return AKAR_BLANGKO;
  if (bersih.includes("\0")) return null;
  const gabung = path.resolve(AKAR_BLANGKO, bersih);
  const akar = path.resolve(AKAR_BLANGKO);
  return gabung === akar || gabung.startsWith(`${akar}${path.sep}`) ? gabung : null;
}

/**
 * Menguraikan nama berkas blangko menjadi jenjang yang dapat dipilih.
 *
 * ============================================================================
 * JENJANGNYA DARI NAMA BERKAS, BUKAN DARI DAFTAR YANG DITULIS TANGAN
 * ============================================================================
 *
 * ABT sudah menyusun jenjangnya di dalam nama berkas sendiri, dan bentuknya
 * ajek pada 812 blangko:
 *
 *   [01b] (E-Court) BAS 2 P Hadir & T Tidak Hadir Pokok Perkara - Putusan Verstek
 *    kode    ecourt  sidang  ---------- keadaan ----------   ---- tindakan ----
 *
 *   [01] [Kabul Verstek] Cerai (Format Lengkap)
 *    kode    skenario    ------- judul -------
 *
 * Menuliskan jenjangnya sebagai daftar tersendiri berarti daftar itu harus
 * dijaga tetap cocok dengan folder yang isinya berubah tanpa sepengetahuan
 * ALETA - dan begitu keduanya berselisih, yang muncul di layar adalah blangko
 * yang tidak ada atau blangko yang ada tetapi tidak terlihat.
 */
function uraikanNamaBlangko(namaBerkas) {
  const tanpaAkhiran = namaBerkas.replace(/\.(rtf|doc|docx|odt)$/i, "");
  const kurung = [...tanpaAkhiran.matchAll(/\[([^\]]+)\]/g)].map((c) => c[1].trim());
  const eCourt = /\(e-?court\)/i.test(tanpaAkhiran);
  const sisa = tanpaAkhiran
    .replace(/\[[^\]]*\]/g, "")
    .replace(/\(e-?court\)/i, "")
    .replace(/\s{2,}/g, " ")
    .trim()
    .replace(/^[-\s]+/, "");

  // "BAS 2 ..." atau "BAS 5a ..." - nomor sidangnya, bila blangko ini BAS.
  const sidang = sisa.match(/^BAS\s+(\d+)([a-z]?)\s+/i);
  const basKe = sidang ? Number(sidang[1]) : 0;
  const basVarian = sidang ? (sidang[2] || "") : "";
  const setelahBas = sidang ? sisa.slice(sidang[0].length).trim() : sisa;

  // Keadaan dipisah dari tindakan pada " - " PERTAMA. Pemisahan pada yang
  // terakhir akan memotong "Putusan Verstek - (3 Saksi)" di tempat yang salah,
  // dan keadaan sidang berpindah menjadi bagian dari tindakan.
  const pisah = setelahBas.indexOf(" - ");
  const keadaan = pisah >= 0 ? setelahBas.slice(0, pisah).trim() : setelahBas;
  const tindakan = pisah >= 0 ? setelahBas.slice(pisah + 3).trim() : "";

  return {
    berkas: namaBerkas,
    kode: kurung[0] ?? "",
    kategori: kurung[1] ?? "",
    eCourt,
    judul: sisa,
    basKe,
    basVarian,
    keadaan,
    tindakan,
  };
}

async function getKatalogBlangko(params = {}) {
  const folder = jalurBlangkoAman(params.folder);
  if (!folder) return { ada: false, sebab: "Nama folder tidak sah.", isi: [] };

  try {
    const entri = await fs.readdir(folder, { withFileTypes: true });
    const set = [];
    const blangko = [];

    for (const item of entri) {
      if (item.name.startsWith(".")) continue;
      if (item.isDirectory()) {
        set.push({ nama: item.name });
      } else if (/\.(rtf|doc|docx|odt)$/i.test(item.name)) {
        // Baris pemisah yang isinya hanya garis - ada di beberapa folder ABT
        // sebagai pembatas visual, bukan blangko yang dapat dipakai.
        if (/^\[\d+\]\s*-{5,}/.test(item.name)) continue;
        blangko.push(uraikanNamaBlangko(item.name));
      }
    }

    set.sort((a, b) => a.nama.localeCompare(b.nama, "id"));
    blangko.sort((a, b) => a.berkas.localeCompare(b.berkas, "id"));

    return {
      ada: set.length > 0 || blangko.length > 0,
      folder: path.relative(path.resolve(AKAR_BLANGKO), folder) || ".",
      jumlahSet: set.length,
      jumlahBlangko: blangko.length,
      set,
      blangko,
      isi: [...set.map((s) => s.nama), ...blangko.map((b) => b.berkas)],
    };
  } catch (error) {
    const sebab = error && error.code === "ENOENT" ? "Folder blangko tidak ditemukan." : "Folder blangko tidak terbaca.";
    return { ada: false, sebab, isi: [] };
  }
}

/**
 * Membaca dan mengisi blangko RTF.
 *
 * ============================================================================
 * MENGISI TIDAK MENUNTUT MENGURAI
 * ============================================================================
 *
 * Sudah diperiksa pada blangko sungguhan: penanda #0046# tersimpan UTUH di
 * dalam RTF - 138 kemunculan dari 75 penanda, tidak satu pun terpecah oleh
 * perintah format. Karena itu pengisian cukup penggantian teks, dan seluruh
 * tata letak, huruf, penomoran, serta tabel blangko tetap persis seperti
 * aslinya.
 *
 * Ini penting: blangko putusan dan BAS punya bentuk baku yang ditetapkan
 * pedoman Badilag. Mengurai lalu menyusun ulang RTF berarti mempertaruhkan
 * bentuk itu pada ketelitian penyusun ulang - risiko besar tanpa keuntungan
 * apa pun.
 *
 * Penguraian tetap ada, tetapi HANYA untuk pratinjau di layar. Yang diunduh
 * dan dicetak selalu RTF asli yang sudah terisi, bukan hasil penguraian.
 */

const BATAS_BLANGKO_BYTE = 8 * 1024 * 1024;

/**
 * Menyiapkan nilai agar aman disisipkan ke dalam RTF.
 *
 * Tiga huruf punya arti khusus di RTF - tanda miring balik dan kedua kurung
 * kurawal. Nama yang memuatnya akan merusak struktur berkas, dan rusaknya baru
 * ketahuan saat dibuka Word. Huruf di luar ASCII disandikan sebagai \\uN? yang
 * dipahami semua pengolah kata; tanpa itu, nama beraksen berubah menjadi
 * huruf acak pada sebagian mesin.
 */
function amankanUntukRtf(nilai) {
  let hasil = "";
  for (const huruf of String(nilai ?? "")) {
    const kode = huruf.codePointAt(0);
    if (huruf === "\\" || huruf === "{" || huruf === "}") hasil += `\\${huruf}`;
    else if (huruf === "\n") hasil += "\\par ";
    else if (kode < 128) hasil += huruf;
    else hasil += `\\u${kode > 32767 ? kode - 65536 : kode}?`;
  }
  return hasil;
}

/**
 * Mengubah RTF menjadi teks biasa - untuk dilihat di layar, bukan untuk dicetak.
 *
 * Sengaja sederhana. Yang dibutuhkan hanyalah panitera dapat membaca isinya
 * sebelum mengunduh; kesetiaan tata letak dijamin oleh berkas aslinya yang
 * tidak pernah diurai.
 */
function rtfKeTeks(rtf) {
  // Kelompok yang isinya BUKAN naskah. Tiga yang terakhir ditemukan dari
  // blangko sungguhan: tabel penomoran dan instruksi medan menumpahkan sampah
  // seperti " .;" dan "PAGE \* Arabic" ke baris pertama pratinjau.
  const abaikan = new Set([
    "fonttbl", "colortbl", "stylesheet", "info", "pict", "themedata",
    "colorschememapping", "latentstyles", "datastore", "generator", "xmlnstbl",
    "rsidtbl", "upr", "mmathpr", "wgrffmtfilter", "listtable",
    "listoverridetable", "listtext", "leveltext", "levelnumbers", "fldinst",
    "bkmkstart", "bkmkend", "nonshppict", "shppict", "objdata", "template",
    // Tabel tanda baca CJK - warisan Word, tidak pernah menjadi naskah.
    "lchars", "fchars", "punctuation", "pgptbl", "sttbrgbwrd", "sttbfnpref",
  ]);
  let hasil = "";
  let i = 0;
  let lewatiGrup = 0;
  let dalam = 0;

  while (i < rtf.length) {
    const huruf = rtf[i];

    if (huruf === "{") {
      dalam += 1;
      i += 1;
      continue;
    }
    if (huruf === "}") {
      dalam -= 1;
      if (lewatiGrup && dalam < lewatiGrup) lewatiGrup = 0;
      i += 1;
      continue;
    }
    if (huruf === "\\") {
      const cocok = /^\\([a-zA-Z]+)(-?\d+)? ?/.exec(rtf.slice(i));
      if (cocok) {
        const kata = cocok[1];
        if (!lewatiGrup && abaikan.has(kata.toLowerCase())) lewatiGrup = dalam;
        if (kata === "par" || kata === "line" || kata === "sect") hasil += "\n";
        if (kata === "tab") hasil += "\t";
        if (kata === "u" && cocok[2]) {
          const kode = Number(cocok[2]);
          if (!lewatiGrup) hasil += String.fromCodePoint(kode < 0 ? kode + 65536 : kode);
          i += cocok[0].length;
          // Huruf pengganti sesudah \\uN dilewati - itulah gunanya tanda "?".
          if (rtf[i] === "?") i += 1;
          continue;
        }
        i += cocok[0].length;
        continue;
      }
      const hex = /^\\'([0-9a-fA-F]{2})/.exec(rtf.slice(i));
      if (hex) {
        if (!lewatiGrup) hasil += Buffer.from(hex[1], "hex").toString("latin1");
        i += hex[0].length;
        continue;
      }
      // Tanda miring balik yang melindungi huruf khusus.
      if (!lewatiGrup && "\\{}".includes(rtf[i + 1])) hasil += rtf[i + 1];
      i += 2;
      continue;
    }

    if (!lewatiGrup && huruf !== "\r" && huruf !== "\n") hasil += huruf;
    i += 1;
  }

  return hasil.replace(/\n{3,}/g, "\n\n").trim();
}

function jalurBerkasBlangko(folder, berkas) {
  const nama = String(berkas || "").trim();
  if (!nama || nama.includes("/") || nama.includes("\\") || nama.includes("\0")) return null;
  const induk = jalurBlangkoAman(folder);
  if (!induk) return null;
  return path.join(induk, nama);
}

async function bacaBlangko(params = {}) {
  const jalur = jalurBerkasBlangko(params.folder, params.berkas);
  if (!jalur) return { ada: false, sebab: "Nama folder atau berkas tidak sah." };

  try {
    const info = await fs.stat(jalur);
    if (info.size > BATAS_BLANGKO_BYTE) {
      return { ada: false, sebab: `Blangko terlalu besar (${Math.round(info.size / 1024)} KB).` };
    }
    const rtf = await fs.readFile(jalur, "latin1");
    const penanda = [...new Set([...rtf.matchAll(/#(\d{3,5})#/g)].map((c) => c[1]))].sort();

    return {
      ada: true,
      berkas: path.basename(jalur),
      besarByte: info.size,
      jumlahPenanda: penanda.length,
      penanda,
      teks: rtfKeTeks(rtf).slice(0, 20000),
    };
  } catch (error) {
    return { ada: false, sebab: error && error.code === "ENOENT" ? "Blangko tidak ditemukan." : "Blangko tidak terbaca." };
  }
}

async function isiBlangko(params = {}) {
  const jalur = jalurBerkasBlangko(params.folder, params.berkas);
  if (!jalur) return { ok: false, sebab: "Nama folder atau berkas tidak sah." };

  const nilai = params.nilai && typeof params.nilai === "object" ? params.nilai : {};

  try {
    const info = await fs.stat(jalur);
    if (info.size > BATAS_BLANGKO_BYTE) {
      return { ok: false, sebab: `Blangko terlalu besar (${Math.round(info.size / 1024)} KB).` };
    }
    const rtf = await fs.readFile(jalur, "latin1");

    const terisi = new Set();
    const hasil = rtf.replace(/#(\d{3,5})#/g, (utuh, noVar) => {
      const isi = nilai[noVar];
      if (isi === undefined || isi === null || String(isi).trim() === "") return utuh;
      terisi.add(noVar);
      return amankanUntukRtf(isi);
    });

    // Penanda yang TERSISA disebutkan satu per satu, bukan dihitung saja.
    // Yang menandatangani berhak tahu persis bagian mana yang masih kosong -
    // dan penanda yang tertinggal di naskah resmi jauh lebih mudah ketahuan
    // sekarang daripada sesudah ditandatangani.
    const tersisa = [...new Set([...hasil.matchAll(/#(\d{3,5})#/g)].map((c) => c[1]))].sort();

    return {
      ok: true,
      berkas: path.basename(jalur),
      jumlahTerisi: terisi.size,
      terisi: [...terisi].sort(),
      tersisa,
      rtfBase64: Buffer.from(hasil, "latin1").toString("base64"),
    };
  } catch (error) {
    return { ok: false, sebab: error && error.code === "ENOENT" ? "Blangko tidak ditemukan." : "Blangko tidak terbaca." };
  }
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
    "case.pertimbangan": getPertimbanganHukum,
    "case.pemeriksaanSaksi": getPemeriksaanSaksi,
    "abt.katalogTanyaJawab": getKatalogTanyaJawab,
    "abt.tanyaJawab": getTanyaJawab,
    "blangko.katalog": getKatalogBlangko,
    "abt.namaVariabel": getNamaVariabel,
    "abt.semuaVariabel": getSemuaVariabel,
    "ecourt.dokumenPerkara": getDokumenECourt,
    "blangko.baca": bacaBlangko,
    "blangko.isi": isiBlangko,
    "legacy.sqlValue": executeLegacySqlValue,
    "user.search": searchUsers,
    "user.byUsername": async (input) => (await searchUsers({ ...input, query: input.username, limit: 1 }))[0] || null,
    "user.byNip": async (input) => (await searchUsers({ ...input, query: input.nip, limit: 1 }))[0] || null,
    "user.byEmail": async (input) => (await searchUsers({ ...input, query: input.email, limit: 1 }))[0] || null,
    "user.byId": async (input) => (await searchUsers({ ...input, query: input.id, limit: 1 }))[0] || null,
    "user.verifikasiSandi": verifikasiSandiPengguna,
    "jabatan.pemetaanAkun": pemetaanAkunJabatan,
    "estatus.candidates": getEStatusCandidates,
    "schema.introspect": introspectSchema,
    "ecourt.caseList": listEcourtCases,
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
  // Dibuka agar dapat dibuktikan sendiri terhadap PHP SIPP tanpa menyentuh
  // basis data - lihat scripts/verify-sidik-sandi.js.
  sidikSandiSipp,
};
