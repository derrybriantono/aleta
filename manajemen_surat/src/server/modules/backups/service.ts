import { spawn } from "node:child_process";
import { lstat, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { gzipSync } from "node:zlib";

import { type QueryResultRow } from "pg";

import { APP_VERSION } from "@/lib/patch-notes";
import { getDatabaseRuntimeStatus, getDatabaseUrl, type AletaDatabase } from "@/server/db/client";

export type BackupType = "database" | "application";

export type BackupSystemSnapshot = {
  appVersion: string;
  checkedAt: string;
  database: {
    capturedAt: string;
    activeMode: string;
    source: string;
    name: string | null;
    host: string | null;
    reachable: boolean;
  };
};

export type BackupFile = {
  filename: string;
  mimeType: string;
  buffer: Buffer;
  metadata: {
    type: BackupType;
    generatedAt: string;
    appVersion: string;
    source: string;
    databaseCapturedAt?: string;
    databaseMode?: string;
    databaseName?: string | null;
    fileCount?: number;
    tableCount?: number;
    byteLength: number;
  };
};

type TableNameRow = QueryResultRow & {
  table_name: string;
};

type ColumnNameRow = QueryResultRow & {
  column_name: string;
};

type DatabaseClockRow = QueryResultRow & {
  database_time: string | Date;
};

const APP_BACKUP_ROOT_ENTRIES = new Set([
  "src",
  "public",
  "drizzle",
  "scripts",
  "docs",
  "e2e",
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "tailwind.config.ts",
  "postcss.config.js",
  "eslint.config.mjs",
  "vitest.config.ts",
  "playwright.config.ts",
  "drizzle.config.ts",
  "README.md",
  "prd.md",
  "next-env.d.ts",
]);

const APP_BACKUP_EXCLUDED_ROOT_ENTRIES = new Set([
  ".git",
  ".next",
  ".runtime-logs",
  ".wwebjs_auth",
  ".vscode",
  "node_modules",
  "tmp",
  "data",
]);
const APP_BACKUP_EXCLUDED_PATH_PREFIXES = ["public/uploads/", "public/aleta-pdf/"];

const APP_BACKUP_EXCLUDED_FILE_PATTERNS = [
  /^\.env(?:\.|$)/,
  /\.log$/i,
  /\.swp$/i,
  /\.tsbuildinfo$/i,
  /^playwright.*\.png$/i,
  /^whatsapp.*\.png$/i,
  /^institution.*\.png$/i,
  /^ai-settings.*\.png$/i,
];

const DATABASE_TABLE_ORDER = [
  "roles",
  "positions",
  "users",
  "acting_assignments",
  "ai_global_settings",
  "ai_providers",
  "ai_module_settings",
  "ai_suggestion_logs",
  "whatsapp_web_settings",
  "assistant_judge_settings",
  "aleta_bot_settings",
  "aleta_bot_templates",
  "aleta_bot_jobs",
  "aleta_bot_queries",
  "aleta_bot_db_connections",
  "aleta_bot_public_qa_intents",
  "aleta_bot_public_qa_examples",
  "aleta_bot_public_qa_logs",
  "aleta_bot_public_qa_sessions",
  "aleta_bot_notifications",
  "aleta_bot_notification_logs",
  "aleta_bot_logs",
  "aleta_bot_policy_skip_logs",
  "aleta_bot_disposition_reminder_runs",
  "institution_identity",
  "panel_settings",
  "institution_identity_enrichments",
  "module_visibility_settings",
  "feedback_requests",
  "user_notification_reads",
  "knowledge_base_regulations",
  "letter_origin_references",
  "classification_catalog",
  "letter_number_sequences",
  "letter_templates",
  "letters",
  "letter_tags",
  "letter_classification_tags",
  "letter_attachments",
  "letter_whatsapp_deliveries",
  "dispositions",
  "disposition_whatsapp_deliveries",
  "audit_logs",
  "accounts",
  "sessions",
  "verifications",
  "password_reset_requests",
];

function formatBackupTimestamp(date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, "0");

  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    "-",
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join("");
}

function toIsoTimestamp(value: unknown, fallback = new Date().toISOString()) {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (Number.isFinite(parsed.getTime())) return parsed.toISOString();
  }
  return fallback;
}

async function getDatabaseCapturedAt(db: AletaDatabase) {
  const fallback = new Date().toISOString();

  try {
    const row = await db.prepare("SELECT CURRENT_TIMESTAMP AS database_time").get<DatabaseClockRow>();
    return toIsoTimestamp(row?.database_time, fallback);
  } catch {
    return fallback;
  }
}

export async function getBackupSystemSnapshot(db: AletaDatabase): Promise<BackupSystemSnapshot> {
  const [runtimeStatus, capturedAt] = await Promise.all([
    getDatabaseRuntimeStatus(),
    getDatabaseCapturedAt(db),
  ]);

  return {
    appVersion: APP_VERSION,
    checkedAt: new Date().toISOString(),
    database: {
      capturedAt,
      activeMode: runtimeStatus.activeMode,
      source: runtimeStatus.activeMode === "postgres" ? "PostgreSQL utama" : "Penyimpanan cadangan",
      name: runtimeStatus.postgres.database,
      host: runtimeStatus.postgres.host,
      reachable: runtimeStatus.postgres.reachable,
    },
  };
}

function quoteIdentifier(identifier: string) {
  return `"${identifier.replace(/"/g, "\"\"")}"`;
}

function sqlString(value: string) {
  return `'${value.replace(/'/g, "''")}'`;
}

function sqlValue(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  if (typeof value === "bigint") return String(value);
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (value instanceof Date) return sqlString(value.toISOString());
  if (Buffer.isBuffer(value)) return `decode('${value.toString("hex")}', 'hex')`;
  if (Array.isArray(value) || typeof value === "object") return sqlString(JSON.stringify(value));
  return sqlString(String(value));
}

function sortDatabaseTables(tables: string[]) {
  const knownOrder = new Map(DATABASE_TABLE_ORDER.map((table, index) => [table, index]));

  return [...tables].sort((left, right) => {
    const leftIndex = knownOrder.get(left) ?? Number.MAX_SAFE_INTEGER;
    const rightIndex = knownOrder.get(right) ?? Number.MAX_SAFE_INTEGER;
    if (leftIndex !== rightIndex) return leftIndex - rightIndex;
    return left.localeCompare(right);
  });
}

async function listDatabaseTables(db: AletaDatabase) {
  const rows = await db.prepare(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
     ORDER BY table_name`
  ).all<TableNameRow>();

  return sortDatabaseTables(rows.map((row) => row.table_name));
}

async function listDatabaseColumns(db: AletaDatabase, tableName: string) {
  const rows = await db.prepare(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = ?
     ORDER BY ordinal_position`
  ).all<ColumnNameRow>(tableName);

  return rows.map((row) => row.column_name);
}

async function createPortableDatabaseSql(db: AletaDatabase, generatedAt: string, databaseCapturedAt: string) {
  const tables = await listDatabaseTables(db);
  const lines: string[] = [
    "-- ALETA portable database backup",
    `-- Application version: ${APP_VERSION}`,
    `-- Generated at: ${generatedAt}`,
    `-- Database timestamp: ${databaseCapturedAt}`,
    "-- Restore target: ALETA database with the same or newer schema.",
    "",
    "BEGIN;",
  ];

  for (const tableName of tables) {
    const columns = await listDatabaseColumns(db, tableName);
    lines.push("", `-- Table: ${tableName}`);

    if (columns.length === 0) {
      lines.push(`-- Skipped ${tableName}: no visible columns.`);
      continue;
    }

    const rows = await db.prepare(
      `SELECT ${columns.map(quoteIdentifier).join(", ")}
       FROM ${quoteIdentifier(tableName)}`
    ).all<Record<string, unknown>>();

    if (rows.length === 0) {
      lines.push(`-- No rows for ${tableName}.`);
      continue;
    }

    const quotedColumns = columns.map(quoteIdentifier).join(", ");
    for (const row of rows) {
      const values = columns.map((column) => sqlValue(row[column])).join(", ");
      lines.push(`INSERT INTO ${quoteIdentifier(tableName)} (${quotedColumns}) VALUES (${values});`);
    }
  }

  lines.push("", "COMMIT;", "");

  return {
    sql: lines.join("\n"),
    tableCount: tables.length,
  };
}

function runPgDump(connectionString: string) {
  return new Promise<Buffer>((resolve, reject) => {
    let parsed: URL;
    try {
      parsed = new URL(connectionString);
    } catch (error) {
      reject(error);
      return;
    }

    const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
    const args = [
      "--format=plain",
      "--no-owner",
      "--no-privileges",
      "--clean",
      "--if-exists",
      "--host",
      parsed.hostname,
      "--port",
      parsed.port || "5432",
      "--username",
      decodeURIComponent(parsed.username || "postgres"),
      "--dbname",
      databaseName || "postgres",
    ];
    const child = spawn("pg_dump", args, {
      env: {
        ...process.env,
        PGPASSWORD: decodeURIComponent(parsed.password || ""),
        PGSSLMODE:
          parsed.searchParams.get("sslmode") ??
          (parsed.searchParams.get("ssl") === "true" ? "require" : process.env.PGSSLMODE),
      },
      windowsHide: true,
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error("pg_dump timeout"));
    }, 120_000);

    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("close", (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        resolve(Buffer.concat(stdout));
        return;
      }

      reject(new Error(Buffer.concat(stderr).toString("utf8") || `pg_dump exited with code ${code}`));
    });
  });
}

export async function createDatabaseBackup(db: AletaDatabase): Promise<BackupFile> {
  const generatedAt = new Date().toISOString();
  const timestamp = formatBackupTimestamp(new Date(generatedAt));
  const runtimeStatus = await getDatabaseRuntimeStatus();
  const databaseCapturedAt = await getDatabaseCapturedAt(db);
  let source = "portable-sql";
  let sqlBuffer: Buffer;
  let tableCount = 0;

  if (runtimeStatus.activeMode === "postgres") {
    try {
      sqlBuffer = await runPgDump(getDatabaseUrl());
      tableCount = (sqlBuffer.toString("utf8").match(/^CREATE TABLE /gm) ?? []).length;
      source = "pg_dump";
      sqlBuffer = Buffer.concat([
        Buffer.from(
          [
            "-- ALETA database backup",
            `-- Application version: ${APP_VERSION}`,
            `-- Generated at: ${generatedAt}`,
            `-- Database timestamp: ${databaseCapturedAt}`,
            "",
          ].join("\n"),
          "utf8"
        ),
        sqlBuffer,
      ]);
    } catch {
      const portable = await createPortableDatabaseSql(db, generatedAt, databaseCapturedAt);
      sqlBuffer = Buffer.from(portable.sql, "utf8");
      tableCount = portable.tableCount;
      source = "portable-sql-fallback";
    }
  } else {
    const portable = await createPortableDatabaseSql(db, generatedAt, databaseCapturedAt);
    sqlBuffer = Buffer.from(portable.sql, "utf8");
    tableCount = portable.tableCount;
  }

  const buffer = gzipSync(sqlBuffer, { level: 9 });

  return {
    filename: `aleta-database-backup-${timestamp}.sql.gz`,
    mimeType: "application/gzip",
    buffer,
    metadata: {
      type: "database",
      generatedAt,
      appVersion: APP_VERSION,
      source,
      databaseCapturedAt,
      databaseMode: runtimeStatus.activeMode,
      databaseName: runtimeStatus.postgres.database,
      tableCount,
      byteLength: buffer.byteLength,
    },
  };
}

function shouldIncludeRootEntry(name: string) {
  return APP_BACKUP_ROOT_ENTRIES.has(name);
}

function shouldSkipRelativePath(relativePath: string) {
  const normalized = relativePath.replace(/\\/g, "/");
  const parts = normalized.split("/");
  const basename = parts[parts.length - 1] ?? normalized;

  if (parts[0] && APP_BACKUP_EXCLUDED_ROOT_ENTRIES.has(parts[0])) return true;
  if (APP_BACKUP_EXCLUDED_PATH_PREFIXES.some((prefix) => normalized.startsWith(prefix))) return true;
  return APP_BACKUP_EXCLUDED_FILE_PATTERNS.some((pattern) => pattern.test(basename));
}

async function listApplicationBackupFiles(rootDir: string, currentDir = rootDir): Promise<string[]> {
  const entries = await readdir(currentDir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(currentDir, entry.name);
    const relativePath = path.relative(rootDir, fullPath).replace(/\\/g, "/");

    if (currentDir === rootDir && !shouldIncludeRootEntry(entry.name)) {
      continue;
    }
    if (shouldSkipRelativePath(relativePath)) {
      continue;
    }

    if (entry.isDirectory()) {
      files.push(...(await listApplicationBackupFiles(rootDir, fullPath)));
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    files.push(relativePath);
  }

  return files.sort((left, right) => left.localeCompare(right));
}

function writeTarString(buffer: Buffer, value: string, offset: number, length: number) {
  buffer.write(value.slice(0, length), offset, length, "utf8");
}

function writeTarOctal(buffer: Buffer, value: number, offset: number, length: number) {
  const text = value.toString(8).padStart(length - 1, "0").slice(-(length - 1));
  buffer.write(`${text}\0`, offset, length, "ascii");
}

function splitTarPath(relativePath: string) {
  const normalized = relativePath.replace(/\\/g, "/");
  if (Buffer.byteLength(normalized) <= 100) {
    return { name: normalized, prefix: "" };
  }

  const parts = normalized.split("/");
  for (let index = parts.length - 1; index > 0; index -= 1) {
    const name = parts.slice(index).join("/");
    const prefix = parts.slice(0, index).join("/");
    if (Buffer.byteLength(name) <= 100 && Buffer.byteLength(prefix) <= 155) {
      return { name, prefix };
    }
  }

  return null;
}

function createTarHeader(relativePath: string, size: number, mtime: number) {
  const splitPath = splitTarPath(relativePath);
  if (!splitPath) return null;

  const header = Buffer.alloc(512, 0);
  writeTarString(header, splitPath.name, 0, 100);
  writeTarOctal(header, 0o644, 100, 8);
  writeTarOctal(header, 0, 108, 8);
  writeTarOctal(header, 0, 116, 8);
  writeTarOctal(header, size, 124, 12);
  writeTarOctal(header, Math.floor(mtime / 1000), 136, 12);
  header.fill(" ", 148, 156);
  writeTarString(header, "0", 156, 1);
  writeTarString(header, "ustar", 257, 6);
  writeTarString(header, "00", 263, 2);
  writeTarString(header, "aleta", 265, 32);
  writeTarString(header, "aleta", 297, 32);
  writeTarString(header, splitPath.prefix, 345, 155);

  let checksum = 0;
  for (const byte of header) {
    checksum += byte;
  }
  const checksumText = checksum.toString(8).padStart(6, "0");
  header.write(`${checksumText}\0 `, 148, 8, "ascii");

  return header;
}

async function createTarGzFromFiles(rootDir: string, relativeFiles: string[]) {
  const chunks: Buffer[] = [];
  let includedCount = 0;

  for (const relativePath of relativeFiles) {
    const fullPath = path.join(rootDir, relativePath);
    const stat = await lstat(fullPath);
    const header = createTarHeader(relativePath, stat.size, stat.mtimeMs);
    if (!header) continue;

    const content = await readFile(fullPath);
    const paddingLength = (512 - (content.length % 512)) % 512;
    chunks.push(header, content);
    if (paddingLength > 0) {
      chunks.push(Buffer.alloc(paddingLength, 0));
    }
    includedCount += 1;
  }

  chunks.push(Buffer.alloc(1024, 0));

  return {
    buffer: gzipSync(Buffer.concat(chunks), { level: 9 }),
    fileCount: includedCount,
  };
}

export async function createApplicationBackup(rootDir = process.cwd()): Promise<BackupFile> {
  const generatedAt = new Date().toISOString();
  const timestamp = formatBackupTimestamp(new Date(generatedAt));
  const files = await listApplicationBackupFiles(rootDir);
  const { buffer, fileCount } = await createTarGzFromFiles(rootDir, files);

  return {
    filename: `aleta-application-backup-${timestamp}.tar.gz`,
    mimeType: "application/gzip",
    buffer,
    metadata: {
      type: "application",
      generatedAt,
      appVersion: APP_VERSION,
      source: "source-tar-gz",
      fileCount,
      byteLength: buffer.byteLength,
    },
  };
}

export { listApplicationBackupFiles };
