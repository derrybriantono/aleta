import { type QueryResultRow } from "pg";

import { type SqlInputValue, type AletaDatabase, getDatabaseRuntimeStatus } from "@/server/db/client";
import { appendAuditLog } from "@/server/shared/audit";
import { ApiError } from "@/server/shared/errors";
import { nextPrefixedId } from "@/server/shared/ids";

export type DatabaseAdminTable = {
  name: string;
  rowCount: number;
  primaryKeyColumns: string[];
  columns: DatabaseAdminColumn[];
};

export type DatabaseAdminColumn = {
  name: string;
  dataType: string;
  nullable: boolean;
  protected: boolean;
};

export type DatabaseAdminSnapshot = {
  database: {
    name: string | null;
    host: string | null;
    activeMode: string;
    reachable: boolean;
    checkedAt: string;
  };
  tables: DatabaseAdminTable[];
  selectedTable: DatabaseAdminTable | null;
  rows: Array<Record<string, unknown>>;
  page: number;
  pageSize: number;
  totalRows: number;
};

export type DatabaseAdminQueryResult = {
  columns: string[];
  rows: Array<Record<string, unknown>>;
  rowCount: number;
  sql: string;
  executedAt: string;
};

type TableRow = QueryResultRow & {
  table_name: string;
};

type ColumnRow = QueryResultRow & {
  column_name: string;
  data_type: string;
  is_nullable: string;
};

type ConstraintRow = QueryResultRow & {
  table_name: string;
  column_name: string;
  ordinal_position: number;
};

type CountRow = QueryResultRow & {
  count: string | number;
};

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 25;
const QUERY_RESULT_LIMIT = 100;
const MAX_MANUAL_QUERY_LENGTH = 5000;

const DANGEROUS_MANUAL_QUERY_PATTERNS: Array<{ pattern: RegExp; message: string }> = [
  {
    pattern: /\bpg_sleep(?:_for|_until)?\s*\(/i,
    message: "Fungsi jeda seperti pg_sleep tidak diizinkan karena dapat menggantung koneksi database.",
  },
  {
    pattern: /\bpg_(?:read_file|read_binary_file|ls_dir|stat_file|logdir_ls|file_(?:read|write|sync|rename|unlink))\s*\(/i,
    message: "Fungsi akses file server PostgreSQL tidak diizinkan dari query manual.",
  },
  {
    pattern: /\blo_(?:import|export|unlink|put|from_bytea)\s*\(/i,
    message: "Fungsi large object/file PostgreSQL tidak diizinkan dari query manual.",
  },
  {
    pattern: /\b(?:dblink|postgres_fdw|file_fdw|adminpack)\b/i,
    message: "Ekstensi koneksi/file eksternal tidak diizinkan dari query manual.",
  },
  {
    pattern: /\bpg_(?:terminate_backend|cancel_backend|reload_conf|rotate_logfile|promote|start_backup|stop_backup|create_restore_point)\s*\(/i,
    message: "Fungsi administrasi server PostgreSQL tidak diizinkan dari query manual.",
  },
  {
    pattern: /\bpg_(?:advisory_lock|try_advisory_lock)\s*\(/i,
    message: "Fungsi lock manual tidak diizinkan karena dapat mengganggu transaksi aplikasi.",
  },
  {
    pattern: /\bset_config\s*\(/i,
    message: "Perubahan parameter sesi database tidak diizinkan dari query manual.",
  },
  {
    pattern: /\bgenerate_series\s*\(/i,
    message: "Fungsi generate_series tidak diizinkan dari query manual karena dapat menghasilkan beban besar.",
  },
];

function quoteIdentifier(identifier: string) {
  return `"${identifier.replace(/"/g, "\"\"")}"`;
}

function normalizePage(value: unknown) {
  const page = Number(value);
  if (!Number.isFinite(page) || page < 1) return 1;
  return Math.floor(page);
}

function normalizePageSize(value: unknown) {
  const pageSize = Number(value);
  if (!Number.isFinite(pageSize) || pageSize < 1) return DEFAULT_PAGE_SIZE;
  return Math.min(MAX_PAGE_SIZE, Math.floor(pageSize));
}

function normalizeTableName(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeCellValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return `[binary ${value.byteLength} bytes]`;
  if (Array.isArray(value)) return value.map((item) => normalizeCellValue(item));
  if (value && typeof value === "object") return value;
  return value ?? null;
}

function normalizeRow(row: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(row).map(([column, value]) => [column, normalizeCellValue(value)]));
}

function sanitizeSearchTerm(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 120) : "";
}

function stripFinalSemicolon(sql: string) {
  return sql.trim().replace(/;+$/g, "").trim();
}

function normalizeReadOnlySql(sql: unknown) {
  if (typeof sql !== "string") {
    throw new ApiError(400, "SQL wajib berupa teks.");
  }
  if (sql.length > MAX_MANUAL_QUERY_LENGTH) {
    throw new ApiError(400, `SQL terlalu panjang. Maksimal ${MAX_MANUAL_QUERY_LENGTH} karakter.`);
  }

  const normalized = stripFinalSemicolon(sql);
  if (!normalized) {
    throw new ApiError(400, "SQL belum diisi.");
  }
  if (normalized.includes(";")) {
    throw new ApiError(400, "SQL hanya boleh berisi satu perintah SELECT.");
  }
  if (/\/\*|\*\//.test(normalized)) {
    throw new ApiError(400, "Komentar blok SQL tidak diizinkan di panel ini.");
  }
  if (/--/.test(normalized)) {
    throw new ApiError(400, "Komentar SQL tidak diizinkan di panel ini.");
  }
  if (!/^(select|with)\b/i.test(normalized)) {
    throw new ApiError(400, "Panel query hanya mengizinkan SELECT/WITH untuk melihat data.");
  }
  if (/\b(insert|update|delete|drop|alter|truncate|create|grant|revoke|copy|call|do)\b/i.test(normalized)) {
    throw new ApiError(400, "Perintah perubahan data tidak boleh dijalankan dari query bebas.");
  }
  for (const blocker of DANGEROUS_MANUAL_QUERY_PATTERNS) {
    if (blocker.pattern.test(normalized)) {
      throw new ApiError(400, blocker.message);
    }
  }

  return normalized;
}

function normalizeJsonPatch(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiError(400, "Data edit wajib berupa objek JSON.");
  }

  return value as Record<string, unknown>;
}

function normalizeSqlInputValue(value: unknown): SqlInputValue {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (value instanceof Date || Buffer.isBuffer(value)) return value;
  if (Array.isArray(value)) {
    if (value.every((item) => typeof item === "string")) return value as string[];
    if (value.every((item) => typeof item === "number")) return value as number[];
  }
  if (value && typeof value === "object") return value as Record<string, unknown>;
  return String(value);
}

export async function listDatabaseTables(db: AletaDatabase) {
  const tableRows = await db.queryAll<TableRow>(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
     ORDER BY table_name ASC`
  );
  const pkRows = await db.queryAll<ConstraintRow>(
    `SELECT kcu.table_name, kcu.column_name, kcu.ordinal_position
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu
       ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
      AND tc.table_name = kcu.table_name
     WHERE tc.table_schema = 'public' AND tc.constraint_type = 'PRIMARY KEY'
     ORDER BY kcu.table_name ASC, kcu.ordinal_position ASC`
  );
  const pkMap = new Map<string, string[]>();
  for (const row of pkRows) {
    pkMap.set(row.table_name, [...(pkMap.get(row.table_name) ?? []), row.column_name]);
  }

  const tables: DatabaseAdminTable[] = [];
  for (const row of tableRows) {
    const columns = await listTableColumns(db, row.table_name);
    const primaryKeyColumns = pkMap.get(row.table_name) ?? (columns.some((column) => column.name === "id") ? ["id"] : []);
    tables.push({
      name: row.table_name,
      rowCount: await countTableRows(db, row.table_name),
      primaryKeyColumns,
      columns,
    });
  }

  return tables;
}

export async function listTableColumns(db: AletaDatabase, tableName: string): Promise<DatabaseAdminColumn[]> {
  const rows = await db.queryAll<ColumnRow>(
    `SELECT column_name, data_type, is_nullable
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = ?
     ORDER BY ordinal_position ASC`,
    [tableName]
  );

  return rows.map((row) => ({
    name: row.column_name,
    dataType: row.data_type,
    nullable: row.is_nullable === "YES",
    protected: false,
  }));
}

async function countTableRows(db: AletaDatabase, tableName: string) {
  try {
    const row = await db.queryOne<CountRow>(`SELECT COUNT(*) AS count FROM ${quoteIdentifier(tableName)}`);
    return Number(row?.count ?? 0);
  } catch {
    return 0;
  }
}

function getTableByName(tables: DatabaseAdminTable[], tableName: string) {
  const table = tables.find((item) => item.name === tableName);
  if (!table) {
    throw new ApiError(404, "Tabel database tidak ditemukan.");
  }
  return table;
}

async function getTableRows(
  db: AletaDatabase,
  table: DatabaseAdminTable,
  {
    page,
    pageSize,
    search,
  }: {
    page: number;
    pageSize: number;
    search: string;
  }
) {
  const offset = (page - 1) * pageSize;
  const searchableColumns = table.columns.filter((column) =>
    /char|text|uuid|date|time|json/i.test(column.dataType)
  );
  const params: SqlInputValue[] = [];
  let whereClause = "";

  if (search && searchableColumns.length > 0) {
    params.push(`%${search}%`);
    whereClause = `WHERE ${searchableColumns
      .map((column) => `CAST(${quoteIdentifier(column.name)} AS TEXT) ILIKE ?`)
      .join(" OR ")}`;
    params.push(...Array(Math.max(0, searchableColumns.length - 1)).fill(`%${search}%`));
  }

  const orderColumns = table.primaryKeyColumns.length > 0 ? table.primaryKeyColumns : [table.columns[0]?.name].filter(Boolean);
  const orderClause = orderColumns.length > 0
    ? `ORDER BY ${orderColumns.map(quoteIdentifier).join(", ")}`
    : "";
  const total = search && whereClause
    ? Number((await db.queryOne<CountRow>(
        `SELECT COUNT(*) AS count FROM ${quoteIdentifier(table.name)} ${whereClause}`,
        params
      ))?.count ?? 0)
    : table.rowCount;

  const rows = await db.queryAll<Record<string, unknown>>(
    `SELECT *
     FROM ${quoteIdentifier(table.name)}
     ${whereClause}
     ${orderClause}
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );

  return {
    rows: rows.map((row) => normalizeRow(row)),
    total,
  };
}

export async function getDatabaseAdminSnapshot(
  db: AletaDatabase,
  {
    tableName,
    page,
    pageSize,
    search,
  }: {
    tableName?: unknown;
    page?: unknown;
    pageSize?: unknown;
    search?: unknown;
  } = {}
): Promise<DatabaseAdminSnapshot> {
  const [runtimeStatus, tables] = await Promise.all([getDatabaseRuntimeStatus(), listDatabaseTables(db)]);
  const normalizedTable = normalizeTableName(tableName) || tables[0]?.name || "";
  const selectedTable = normalizedTable ? getTableByName(tables, normalizedTable) : null;
  const nextPage = normalizePage(page);
  const nextPageSize = normalizePageSize(pageSize);
  const searchTerm = sanitizeSearchTerm(search);
  const result = selectedTable
    ? await getTableRows(db, selectedTable, { page: nextPage, pageSize: nextPageSize, search: searchTerm })
    : { rows: [], total: 0 };

  return {
    database: {
      name: runtimeStatus.postgres.database,
      host: runtimeStatus.postgres.host,
      activeMode: runtimeStatus.activeMode,
      reachable: runtimeStatus.postgres.reachable,
      checkedAt: new Date().toISOString(),
    },
    tables,
    selectedTable,
    rows: result.rows,
    page: nextPage,
    pageSize: nextPageSize,
    totalRows: result.total,
  };
}

export async function runReadOnlyDatabaseQuery(
  db: AletaDatabase,
  actorUserId: string,
  sqlInput: unknown,
  auditMetadata: Record<string, unknown> = {}
): Promise<DatabaseAdminQueryResult> {
  const sql = normalizeReadOnlySql(sqlInput);
  const wrappedSql = `SELECT * FROM (${sql}) AS aleta_query_result LIMIT ?`;
  const rows = await db.queryAll<Record<string, unknown>>(wrappedSql, [QUERY_RESULT_LIMIT]);
  const normalizedRows = rows.map((row) => normalizeRow(row));

  await appendAuditLog(db, {
    id: await nextPrefixedId(db, "audit_logs", "adt"),
    actorUserId,
    action: "RUN_DATABASE_READ_QUERY",
    entityType: "database",
    entityId: "read-query",
    payload: {
      sqlPreview: sql.slice(0, 1000),
      rowCount: normalizedRows.length,
      limitedTo: QUERY_RESULT_LIMIT,
      ...auditMetadata,
    },
  });

  return {
    columns: normalizedRows[0] ? Object.keys(normalizedRows[0]) : [],
    rows: normalizedRows,
    rowCount: normalizedRows.length,
    sql,
    executedAt: new Date().toISOString(),
  };
}

export async function updateDatabaseTableRow(
  db: AletaDatabase,
  actorUserId: string,
  {
    tableName,
    primaryKey,
    patch,
    auditMetadata,
  }: {
    tableName: unknown;
    primaryKey: unknown;
    patch: unknown;
    auditMetadata?: Record<string, unknown>;
  }
) {
  const tables = await listDatabaseTables(db);
  const table = getTableByName(tables, normalizeTableName(tableName));
  if (table.primaryKeyColumns.length === 0) {
    throw new ApiError(400, "Tabel ini tidak punya primary key, jadi edit baris dimatikan agar tidak salah ubah data.");
  }
  if (!primaryKey || typeof primaryKey !== "object" || Array.isArray(primaryKey)) {
    throw new ApiError(400, "Primary key baris tidak valid.");
  }

  const primaryKeyRecord = primaryKey as Record<string, unknown>;
  const patchRecord = normalizeJsonPatch(patch);
  const columnMap = new Map(table.columns.map((column) => [column.name, column]));
  const editableEntries = Object.entries(patchRecord).filter(([columnName]) => {
    const column = columnMap.get(columnName);
    return Boolean(column && !table.primaryKeyColumns.includes(columnName));
  });

  if (editableEntries.length === 0) {
    throw new ApiError(400, "Tidak ada kolom yang dapat diedit. Kolom primary key tidak boleh diubah dari panel ini.");
  }

  for (const pkColumn of table.primaryKeyColumns) {
    if (!(pkColumn in primaryKeyRecord)) {
      throw new ApiError(400, `Primary key ${pkColumn} belum lengkap.`);
    }
  }

  const setClause = editableEntries.map(([columnName]) => `${quoteIdentifier(columnName)} = ?`).join(", ");
  const whereClause = table.primaryKeyColumns.map((columnName) => `${quoteIdentifier(columnName)} = ?`).join(" AND ");
  const params = [
    ...editableEntries.map(([, value]) => normalizeSqlInputValue(value)),
    ...table.primaryKeyColumns.map((columnName) => normalizeSqlInputValue(primaryKeyRecord[columnName])),
  ];
  const result = await db.run(
    `UPDATE ${quoteIdentifier(table.name)}
     SET ${setClause}
     WHERE ${whereClause}`,
    params
  );

  await appendAuditLog(db, {
    id: await nextPrefixedId(db, "audit_logs", "adt"),
    actorUserId,
    action: "UPDATE_DATABASE_ROW",
    entityType: "database_table",
    entityId: table.name,
    payload: {
      tableName: table.name,
      primaryKey: primaryKeyRecord,
      changedColumns: editableEntries.map(([column]) => column),
      changes: result.changes,
      ...(auditMetadata ?? {}),
    },
  });

  return {
    tableName: table.name,
    changes: result.changes,
    updatedColumns: editableEntries.map(([column]) => column),
  };
}
