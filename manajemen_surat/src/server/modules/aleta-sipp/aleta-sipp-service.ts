import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { createReadStream } from "node:fs";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";
import { promisify } from "node:util";
import { inflateRawSync } from "node:zlib";

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import { ALETA_SIPP_PERMISSION, resolveAletaSippAccess } from "@/lib/aleta-sipp-types";
import type { UserPersona } from "@/lib/types";
import type { AletaDatabase } from "@/server/db/client";
import { badRequest, forbidden, notFound } from "@/server/shared/http";
import {
  assertAletaSippRegisteredReadOnlySql,
  getAletaSippDataSourceStatus,
  callAletaBotSippBridge,
  getAletaSippSqlDumpPath,
  testAletaBotSippDataSource,
} from "@/server/modules/aleta-sipp/aleta-sipp-datasource";
import {
  listAletaSippQueryDefinitions,
  validateAletaSippSelectOnlySql,
} from "@/server/modules/aleta-sipp/aleta-sipp-query-registry";

const execFileAsync = promisify(execFile);

const DEFAULT_PATHS = {
  sqlBackup: "D:/Download File/backup_structure_data_db_2026-05-24.sql",
  abtXls: "C:/Users/Delota13/OneDrive/Desktop/abt_variabel.xls",
  wordQueries: "D:/Satker Asal/Website PA Bungku/Jenis Query SIPP variabel variable.docx",
  assessmentPdf: "D:/Download File/SK PENILAIAN SIPP 2024.pdf",
  sippApp: "D:/Download File/SIPP",
  legacyAbtApp: "D:/Download File/backup derry/backup derry/aps_badilag",
  pendukung2018: "D:/Satker Asal/Website PA Bungku/xampp/htdocs/pendukung2018",
  antrianApp: "D:/Satker Asal/Website PA Bungku/APLIKASI ABT DLL/antrian",
};

type SippColumn = {
  name: string;
  type: string;
  notNull: boolean;
  auto: boolean;
  hasDefault: boolean;
  defaultValue: string;
  enum: boolean;
};

type SippTableSummary = {
  name: string;
  humanName: string;
  category: string;
  priority: 1 | 2 | 3;
  shortDescription: string;
  longDescription: string;
  functionInCaseProcess: string;
  columns: SippColumn[];
  keys: string[];
  relations: Array<{ column: string; targetTable: string; confidence: "high" | "medium" | "low"; note: string }>;
  riskNotes: string[];
};

type SqlStructureSummary = {
  file: string;
  exists: boolean;
  sizeBytes: number;
  parsedAt: string;
  tableCount: number;
  columnCount: number;
  categories: Record<string, number>;
  tables: SippTableSummary[];
  focusTables: SippTableSummary[];
  relationCount: number;
};

type AppAuditSummary = {
  name: string;
  path: string;
  exists: boolean;
  framework: string;
  language: string;
  database: string;
  sippConnection: string;
  mainFunctions: string[];
  relevantModules: string[];
  importantFiles: string[];
  queryFindings: number;
  writeRiskFindings: number;
  securityRisks: string[];
  reusableReferences: string[];
  doNotCopy: string[];
};

type XlsAuditSummary = {
  file: string;
  exists: boolean;
  readMethod: "python_xlrd" | "unavailable";
  sheets: Array<{ name: string; rowCount: number; headers: string[]; sampleRows: Record<string, string>[] }>;
  variableCount: number;
  sqlQueryCount: number;
  placeholderCount: number;
  status: string;
};

type WordQuerySummary = {
  file: string;
  exists: boolean;
  paragraphCount: number;
  queryCount: number;
  placeholders: string[];
  querySamples: Array<{ name: string; tables: string[]; parameters: string[]; status: "NEEDS_REVIEW" | "SAFE_READ_ONLY"; preview: string }>;
  status: string;
};

type AssessmentPdfSummary = {
  file: string;
  exists: boolean;
  pageCount: number;
  extractedChars: number;
  indicatorHints: Array<{ kode: string; nama: string; status: "DATA_TIDAK_CUKUP" | "PERLU_INPUT_MANUAL" | "NEEDS_REVIEW"; sourceHint: string }>;
  status: string;
};

type AletaSippDashboardSummary = {
  generatedAt: string;
  access: ReturnType<typeof resolveAletaSippAccess>;
  paths: typeof DEFAULT_PATHS;
  audit: {
    applications: AppAuditSummary[];
    sql: SqlStructureSummary;
    abtXls: XlsAuditSummary;
    wordQueries: WordQuerySummary;
    assessmentPdf: AssessmentPdfSummary;
  };
  queryRegistry: ReturnType<typeof listAletaSippQueryDefinitions>;
  variableRegistryPreview: Array<{
    legacySource: string;
    legacyCode: string;
    modernKey: string;
    displayName: string;
    sourceType: string;
    status: "MAPPED" | "NEEDS_REVIEW";
  }>;
  assessmentIndicators: AssessmentPdfSummary["indicatorHints"];
  schedulePreview: Array<{
    nomorUrut: number;
    nomorPerkara: string;
    paraPihak: string;
    majelis: string;
    panitera: string;
    agenda: string;
    ruangSidang: string;
    jamSidang: string;
  }>;
  safetyNotes: string[];
};

type ZipEntry = {
  name: string;
  compression: number;
  compressedSize: number;
  localHeaderOffset: number;
};

const FOCUS_TABLES = [
  "perkara",
  "perkara_putusan",
  "perkara_pihak1",
  "perkara_pihak2",
  "perkara_pihak3",
  "perkara_pihak4",
  "perkara_pihak5",
  "perkara_proses",
  "perkara_akta_cerai",
  "perkara_biaya",
  "perkara_court_calendar",
  "perkara_data_pernikahan",
  "perkara_hakim_pn",
  "perkara_ikrar_talak",
  "perkara_jadwal_mediasi",
  "perkara_eksekusi",
  "perkara_jadwal_sidang",
  "perkara_jurusita",
  "perkara_mediasi",
  "perkara_mediator",
  "perkara_panitera_pn",
  "perkara_penetapan",
  "perkara_pengacara",
  "perkara_putusan_anonim",
  "perkara_rekonvensi",
  "pihak",
  "proses",
  "proses_alur_perkara",
  "agama",
  "biaya_perkara",
  "dirput_antrian",
  "dirput_dokumen",
  "mediator",
  "kabupaten",
  "pengadilan_negeri",
  "panitera_pn",
];

function normalizeWhitespace(value: string, maxLength = 600) {
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function humanizeIdentifier(value: string) {
  return value
    .replace(/^perkara_/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function describeTable(name: string) {
  const n = name.toLowerCase();
  if (n === "perkara") {
    return {
      humanName: "Data Induk Perkara",
      category: "Perkara / Induk",
      priority: 1 as const,
      shortDescription: "Tabel induk yang menyimpan nomor perkara, jenis perkara, tanggal pendaftaran, dan identitas proses utama.",
      longDescription:
        "Tabel `perkara` adalah pusat relasi SIPP. Hampir semua tabel transaksi perkara memakai `perkara_id` dari tabel ini, sedangkan user biasanya mencari melalui `nomor_perkara`.",
      functionInCaseProcess: "Menjadi pintu masuk untuk pencarian perkara, monitoring, jadwal, putusan, pihak, dan dokumen.",
    };
  }
  if (n === "perkara_hakim_pn") {
    return {
      humanName: "Majelis Hakim/Hakim Tunggal Perkara",
      category: "Persidangan / Majelis Hakim / Perkara",
      priority: 1 as const,
      shortDescription:
        "Tabel ini menyimpan data hakim yang ditunjuk untuk memeriksa dan mengadili suatu perkara, baik sebagai Ketua Majelis, Hakim Anggota, maupun Hakim Tunggal.",
      longDescription:
        "Tabel `perkara_hakim_pn` menghubungkan perkara dengan hakim yang menangani perkara tersebut. Data ini penting untuk susunan majelis, laporan perkara per hakim, jadwal sidang per majelis, putusan per hakim, dan pengisian variabel dokumen.",
      functionInCaseProcess: "Menentukan majelis hakim aktif dan histori pergantian hakim pada perkara.",
    };
  }
  if (n.includes("jadwal_sidang") || n.includes("court_calendar")) {
    return {
      humanName: "Jadwal Persidangan",
      category: "Persidangan / Jadwal",
      priority: 1 as const,
      shortDescription: "Tabel jadwal sidang, agenda, ruang, jam, dan status penundaan/pelaksanaan sidang.",
      longDescription:
        "Tabel jadwal persidangan dipakai untuk monitoring sidang, antrian sidang, cetak jadwal, dan variabel tanggal/agenda persidangan pada dokumen.",
      functionInCaseProcess: "Mengatur kalender sidang dan menjadi sumber utama PDF jadwal persidangan.",
    };
  }
  if (n.includes("pihak") || n === "pihak") {
    return {
      humanName: humanizeIdentifier(name),
      category: "Pihak / Identitas",
      priority: 1 as const,
      shortDescription: "Tabel yang menyimpan pihak perkara atau relasi pihak ke perkara.",
      longDescription:
        "Data pihak adalah data sensitif. Akses, query, dan AI harus mengikuti role serta masking bila user tidak berwenang.",
      functionInCaseProcess: "Menjadi sumber nama pihak, alamat, status pihak, dan variabel dokumen perkara.",
    };
  }
  if (n.includes("putusan") || n.includes("penetapan")) {
    return {
      humanName: humanizeIdentifier(name),
      category: "Putusan / Penetapan",
      priority: 1 as const,
      shortDescription: "Tabel yang menyimpan putusan, penetapan, amar, status, atau dokumen putusan.",
      longDescription:
        "Kelompok tabel ini dipakai untuk monitoring perkara putus, upload putusan, anonimisasi, minutasi, dan indikator penilaian.",
      functionInCaseProcess: "Mencatat hasil akhir atau produk hukum perkara.",
    };
  }
  if (n.includes("biaya")) {
    return {
      humanName: humanizeIdentifier(name),
      category: "Biaya / Keuangan Perkara",
      priority: 1 as const,
      shortDescription: "Tabel biaya perkara atau referensi komponen biaya.",
      longDescription:
        "Data biaya perkara diperlukan untuk monitoring panjar, jurnal, dan laporan keuangan perkara sesuai kewenangan.",
      functionInCaseProcess: "Menjadi sumber perhitungan dan laporan biaya perkara.",
    };
  }
  if (n.includes("ecourt") || n.includes("e_court")) {
    return {
      humanName: humanizeIdentifier(name),
      category: "e-Court",
      priority: 1 as const,
      shortDescription: "Tabel yang berkaitan dengan integrasi e-Court atau data perkara elektronik.",
      longDescription:
        "Kelompok e-Court perlu dipetakan terpisah karena beberapa indikator dan workflow memakai sumber data elektronik.",
      functionInCaseProcess: "Mendukung monitoring perkara elektronik dan validasi data e-Court.",
    };
  }
  if (n.startsWith("sys") || n.includes("user") || n.includes("log")) {
    return {
      humanName: humanizeIdentifier(name),
      category: "Sistem / Log",
      priority: 3 as const,
      shortDescription: "Tabel sistem, konfigurasi, user, atau log operasional.",
      longDescription: "Tabel sistem tidak boleh dibuka luas. Gunakan hanya untuk audit dan konfigurasi sesuai kewenangan.",
      functionInCaseProcess: "Pendukung teknis aplikasi, bukan sumber utama data perkara.",
    };
  }
  return {
    humanName: humanizeIdentifier(name),
    category: n.startsWith("ref") || n.includes("jenis") || n.includes("status") ? "Referensi / Master" : "Pendukung",
    priority: (n.startsWith("ref") || n.includes("jenis") || n.includes("status") ? 2 : 3) as 2 | 3,
    shortDescription: `Tabel ${humanizeIdentifier(name)} dari struktur SIPP.`,
    longDescription:
      "Penjelasan awal dibuat dari nama tabel dan kolom hasil parsing SQL. Admin dapat menyunting penjelasan setelah validasi manual.",
    functionInCaseProcess: "Perlu validasi fungsi detail dari query aplikasi SIPP/pendukung.",
  };
}

function splitSqlDefinitions(body: string) {
  const out: string[] = [];
  let current = "";
  let quote = "";
  let depth = 0;
  let escaped = false;

  for (const char of body) {
    if (quote) {
      current += char;
      if (char === quote && !escaped) quote = "";
      escaped = char === "\\" && !escaped;
      if (char !== "\\") escaped = false;
      continue;
    }
    if (char === "`" || char === "\"" || char === "'") {
      quote = char;
      current += char;
      continue;
    }
    if (char === "(") {
      depth += 1;
      current += char;
      continue;
    }
    if (char === ")") {
      depth = Math.max(0, depth - 1);
      current += char;
      continue;
    }
    if (char === "," && depth === 0) {
      if (current.trim()) out.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }

  if (current.trim()) out.push(current.trim());
  return out;
}

function inferRelations(tableName: string, columns: SippColumn[], knownTables: Set<string>) {
  return columns
    .map((column) => {
      if (column.name === "perkara_id" && tableName !== "perkara" && knownTables.has("perkara")) {
        return { column: column.name, targetTable: "perkara", confidence: "high" as const, note: "Kolom perkara_id umum dipakai sebagai relasi ke tabel perkara." };
      }
      if (column.name === "pihak_id" && knownTables.has("pihak")) {
        return { column: column.name, targetTable: "pihak", confidence: "high" as const, note: "Kolom pihak_id mengarah ke tabel pihak." };
      }
      const base = column.name.replace(/_id$/, "");
      if (column.name.endsWith("_id") && knownTables.has(base)) {
        return { column: column.name, targetTable: base, confidence: "medium" as const, note: "Relasi diduga dari pola nama kolom *_id." };
      }
      return null;
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
}

async function parseSippSqlStructure(filePath: string): Promise<SqlStructureSummary> {
  const fileStat = await stat(filePath).catch(() => null);
  if (!fileStat?.isFile()) {
    return {
      file: filePath,
      exists: false,
      sizeBytes: 0,
      parsedAt: new Date().toISOString(),
      tableCount: 0,
      columnCount: 0,
      categories: {},
      tables: [],
      focusTables: [],
      relationCount: 0,
    };
  }

  const tableMap = new Map<string, { columns: SippColumn[]; keys: string[] }>();
  const createTable = /^CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?`?([\w$]+)`?\s*\(/i;
  const stream = createReadStream(filePath, { encoding: "utf8" });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  let currentName = "";
  let bodyLines: string[] = [];

  const finishTable = (name: string, lines: string[]) => {
    const body = lines.join("\n").replace(/\)\s*(ENGINE|TYPE)\b[\s\S]*$/i, "").trim();
    const columns: SippColumn[] = [];
    const keys: string[] = [];

    for (const definition of splitSqlDefinitions(body)) {
      const match = definition.match(/^`([^`]+)`\s+([\s\S]+)$/);
      if (match) {
        const rest = normalizeWhitespace(match[2] ?? "", 400);
        columns.push({
          name: match[1] ?? "",
          type: rest.split(/\s+/, 1)[0] ?? "",
          notNull: /\bNOT\s+NULL\b/i.test(rest),
          auto: /\bAUTO_INCREMENT\b/i.test(rest),
          hasDefault: /\bDEFAULT\b/i.test(rest),
          defaultValue: normalizeWhitespace(rest.match(/\bDEFAULT\s+((?:'[^']*')|(?:"[^"]*")|[^\s,]+)/i)?.[1] ?? "", 120),
          enum: /^enum\s*\(/i.test(rest),
        });
      } else if (/\b(KEY|PRIMARY|CONSTRAINT|UNIQUE|INDEX)\b/i.test(definition)) {
        keys.push(normalizeWhitespace(definition, 300));
      }
    }

    tableMap.set(name, { columns, keys });
  };

  for await (const line of rl) {
    if (!currentName) {
      const match = line.trim().match(createTable);
      if (!match) continue;
      currentName = match[1] ?? "";
      bodyLines = [line.slice(line.indexOf("(") + 1)];
      continue;
    }

    bodyLines.push(line);
    if (/\)\s*(ENGINE|TYPE)\b/i.test(line)) {
      finishTable(currentName, bodyLines);
      currentName = "";
      bodyLines = [];
    }
  }

  if (currentName) finishTable(currentName, bodyLines);

  const categories: Record<string, number> = {
    perkara: 0,
    persidangan: 0,
    putusan: 0,
    biaya: 0,
    ecourt: 0,
    referensi: 0,
    sistem: 0,
    log: 0,
  };
  const knownTables = new Set(tableMap.keys());
  const tables: SippTableSummary[] = [];
  let relationCount = 0;

  for (const [name, table] of tableMap) {
    const lower = name.toLowerCase();
    if (lower.startsWith("perkara")) categories.perkara += 1;
    if (lower.includes("sidang") || lower.includes("court_calendar")) categories.persidangan += 1;
    if (lower.includes("putusan") || lower.includes("penetapan")) categories.putusan += 1;
    if (lower.includes("biaya") || lower.includes("keuangan")) categories.biaya += 1;
    if (lower.includes("ecourt") || lower.includes("e_court")) categories.ecourt += 1;
    if (lower.startsWith("ref") || lower.includes("jenis") || lower.includes("status") || ["agama", "kabupaten", "proses"].includes(lower)) categories.referensi += 1;
    if (lower.startsWith("sys") || lower.includes("user")) categories.sistem += 1;
    if (lower.includes("log") || lower.includes("histori") || lower.includes("history")) categories.log += 1;
  }

  for (const [name, table] of tableMap) {
    const description = describeTable(name);
    const relations = inferRelations(name, table.columns, knownTables);
    relationCount += relations.length;
    tables.push({
      name,
      ...description,
      columns: table.columns,
      keys: table.keys,
      relations,
      riskNotes: [
        table.columns.some((column) => ["nama", "alamat", "telepon", "email", "nik"].includes(column.name.toLowerCase()))
          ? "Berpotensi memuat data pribadi/pihak; tampilkan sesuai role dan masking."
          : "Validasi kualitas data tetap diperlukan sebelum dipakai indikator atau dokumen.",
      ],
    });
  }
  const tableByName = new Map(tables.map((table) => [table.name, table]));
  const focusTables = FOCUS_TABLES.map((name) => tableByName.get(name)).filter(
    (table): table is SippTableSummary => Boolean(table)
  );

  return {
    file: filePath,
    exists: true,
    sizeBytes: fileStat.size,
    parsedAt: new Date().toISOString(),
    tableCount: tableMap.size,
    columnCount: Array.from(tableMap.values()).reduce((sum, table) => sum + table.columns.length, 0),
    categories,
    tables,
    focusTables,
    relationCount,
  };
}

function findEndOfCentralDirectory(buffer: Buffer) {
  const signature = 0x06054b50;
  const minOffset = Math.max(0, buffer.length - 0xffff - 22);
  for (let offset = buffer.length - 22; offset >= minOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === signature) return offset;
  }
  throw new Error("ZIP tidak valid.");
}

function listZipEntries(buffer: Buffer) {
  const endOffset = findEndOfCentralDirectory(buffer);
  const entryCount = buffer.readUInt16LE(endOffset + 10);
  const directoryOffset = buffer.readUInt32LE(endOffset + 16);
  const entries: ZipEntry[] = [];
  let offset = directoryOffset;

  for (let index = 0; index < entryCount; index += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) throw new Error("Central directory ZIP rusak.");
    const compression = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.subarray(offset + 46, offset + 46 + nameLength).toString("utf8");
    entries.push({ name, compression, compressedSize, localHeaderOffset });
    offset += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
}

function readZipEntry(buffer: Buffer, entryName: string) {
  const entry = listZipEntries(buffer).find((item) => item.name === entryName);
  if (!entry) return null;
  const offset = entry.localHeaderOffset;
  if (buffer.readUInt32LE(offset) !== 0x04034b50) throw new Error("Local header ZIP rusak.");
  const nameLength = buffer.readUInt16LE(offset + 26);
  const extraLength = buffer.readUInt16LE(offset + 28);
  const dataStart = offset + 30 + nameLength + extraLength;
  const compressed = buffer.subarray(dataStart, dataStart + entry.compressedSize);
  if (entry.compression === 0) return compressed;
  if (entry.compression === 8) return inflateRawSync(compressed);
  throw new Error(`Kompresi ZIP belum didukung: ${entry.compression}.`);
}

function decodeXml(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

async function auditXls(filePath: string): Promise<XlsAuditSummary> {
  const fileStat = await stat(filePath).catch(() => null);
  if (!fileStat?.isFile()) {
    return { file: filePath, exists: false, readMethod: "unavailable", sheets: [], variableCount: 0, sqlQueryCount: 0, placeholderCount: 0, status: "File tidak ditemukan." };
  }

  const script = `
import json, os, sys, xlrd
path = os.environ["ALETA_SIPP_XLS_PATH"]
def clean(value):
    if value is None:
        return ""
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value).replace("\\x00", "").strip()
book = xlrd.open_workbook(path, on_demand=True)
payload = []
for sheet in book.sheets():
    if sheet.nrows <= 0 or sheet.ncols <= 0:
        payload.append({"name": sheet.name, "headers": [], "rows": []})
        continue
    headers = [clean(sheet.cell_value(0, c)) or "col_%s" % (c + 1) for c in range(sheet.ncols)]
    rows = []
    for r in range(1, sheet.nrows):
        obj = {}
        has_value = False
        for c, header in enumerate(headers):
            value = clean(sheet.cell_value(r, c))
            if value:
                has_value = True
            obj[header] = value
        if has_value:
            rows.append(obj)
    payload.append({"name": sheet.name, "headers": headers, "rows": rows})
print(json.dumps(payload, ensure_ascii=False))
`;
  const result = spawnSync("python", ["-c", script], {
    encoding: "utf8",
    env: { ...process.env, ALETA_SIPP_XLS_PATH: filePath },
    maxBuffer: 64 * 1024 * 1024,
  });

  if (result.status !== 0) {
    return { file: filePath, exists: true, readMethod: "unavailable", sheets: [], variableCount: 0, sqlQueryCount: 0, placeholderCount: 0, status: result.stderr.trim() || "XLS belum dapat dibaca." };
  }

  const sheets = JSON.parse(result.stdout) as Array<{ name: string; headers: string[]; rows: Array<Record<string, string>> }>;
  const allRows = sheets.flatMap((sheet) => sheet.rows);
  const sqlQueryCount = allRows.filter((row) => Object.values(row).some((value) => /\bSELECT\b/i.test(value))).length;
  const placeholderCount = new Set(allRows.flatMap((row) => Object.values(row).flatMap((value) => value.match(/#\d{1,6}#/g) ?? []))).size;

  return {
    file: filePath,
    exists: true,
    readMethod: "python_xlrd",
    sheets: sheets.map((sheet) => ({
      name: sheet.name,
      rowCount: sheet.rows.length,
      headers: sheet.headers,
      sampleRows: sheet.rows.slice(0, 5),
    })),
    variableCount: allRows.length,
    sqlQueryCount,
    placeholderCount,
    status: "Berhasil dibaca read-only melalui xlrd.",
  };
}

async function auditWordQueries(filePath: string): Promise<WordQuerySummary> {
  const fileStat = await stat(filePath).catch(() => null);
  if (!fileStat?.isFile()) {
    return { file: filePath, exists: false, paragraphCount: 0, queryCount: 0, placeholders: [], querySamples: [], status: "File tidak ditemukan." };
  }

  const buffer = await readFile(filePath);
  const documentXml = readZipEntry(buffer, "word/document.xml")?.toString("utf8") ?? "";
  const paragraphs = Array.from(documentXml.matchAll(/<w:p\b[^>]*>([\s\S]*?)<\/w:p>/gi))
    .map((match) =>
      Array.from((match[1] ?? "").matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/gi))
        .map((textMatch) => decodeXml(textMatch[1] ?? ""))
        .join("")
    )
    .map((text) => normalizeWhitespace(text, 4000))
    .filter(Boolean);
  const text = paragraphs.join("\n");
  const rawQueries = Array.from(text.matchAll(/\bSELECT\b[\s\S]{20,2500}?(?=(?:\n\s*(?:SELECT|Query|Jenis|Variabel)\b)|$)/gi))
    .map((match) => normalizeWhitespace(match[0] ?? "", 2000))
    .slice(0, 40);
  const placeholders = Array.from(new Set(text.match(/#\d{1,6}#/g) ?? [])).sort();
  const querySamples = rawQueries.slice(0, 12).map((query, index) => {
    const tables = Array.from(new Set(Array.from(query.matchAll(/\b(?:FROM|JOIN)\s+`?([a-zA-Z0-9_]+)`?/gi)).map((match) => match[1] ?? ""))).filter(Boolean);
    const parameters = Array.from(new Set(Array.from(query.matchAll(/#(\d{1,6})#|:(\w+)|\?(\w+)/g)).map((match) => match[1] || match[2] || match[3] || ""))).filter(Boolean);
    const safety = validateAletaSippSelectOnlySql(query);
    return {
      name: `QRY_WORD_${String(index + 1).padStart(3, "0")}`,
      tables,
      parameters,
      status: safety.selectOnly ? "NEEDS_REVIEW" as const : "NEEDS_REVIEW" as const,
      preview: query,
    };
  });

  return {
    file: filePath,
    exists: true,
    paragraphCount: paragraphs.length,
    queryCount: rawQueries.length,
    placeholders,
    querySamples,
    status: "DOCX berhasil dibaca; query Word masuk status NEEDS_REVIEW sampai dinormalisasi parameter.",
  };
}

type MinimalPdfTextItem = { str?: string };
type MinimalPdfPage = {
  getTextContent: () => Promise<{ items: MinimalPdfTextItem[] }>;
};
type MinimalPdfDocument = {
  numPages: number;
  getPage: (pageNumber: number) => Promise<MinimalPdfPage>;
};
type MinimalPdfModule = {
  getDocument: (options: { data: Uint8Array; disableWorker: boolean }) => { promise: Promise<MinimalPdfDocument> };
};

async function auditAssessmentPdf(filePath: string): Promise<AssessmentPdfSummary> {
  const fileStat = await stat(filePath).catch(() => null);
  if (!fileStat?.isFile()) {
    return { file: filePath, exists: false, pageCount: 0, extractedChars: 0, indicatorHints: [], status: "File tidak ditemukan." };
  }

  try {
    const pdfjs = (await import("pdfjs-dist/legacy/build/pdf.mjs")) as unknown as MinimalPdfModule;
    const data = new Uint8Array(await readFile(filePath));
    const pdf = await pdfjs.getDocument({ data, disableWorker: true }).promise;
    const pageLimit = Math.min(pdf.numPages, 20);
    const pageTexts: string[] = [];
    for (let pageNumber = 1; pageNumber <= pageLimit; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      pageTexts.push(content.items.map((item) => item.str ?? "").join(" "));
    }
    const text = normalizeWhitespace(pageTexts.join("\n"), 80_000);
    const lines = text
      .split(/(?=Indikator|Kriteria|Bobot|Minutasi|Putusan|Mediasi|e-Court|Akta Cerai)/i)
      .map((line) => normalizeWhitespace(line, 500))
      .filter((line) => /(indikator|bobot|minutasi|putusan|mediasi|e-court|akta cerai|penilaian)/i.test(line));
    const indicatorHints = lines.slice(0, 12).map((line, index) => ({
      kode: `SK2024-${String(index + 1).padStart(3, "0")}`,
      nama: line.slice(0, 120),
      status: "NEEDS_REVIEW" as const,
      sourceHint: "Diekstrak dari teks PDF; rumus final perlu diverifikasi manusia sebelum query dihitung.",
    }));

    return {
      file: filePath,
      exists: true,
      pageCount: pdf.numPages,
      extractedChars: text.length,
      indicatorHints: indicatorHints.length > 0 ? indicatorHints : fallbackAssessmentIndicators(),
      status: "PDF berhasil dibaca secara best-effort. Indikator tetap perlu validasi manual terhadap SK.",
    };
  } catch (error) {
    return {
      file: filePath,
      exists: true,
      pageCount: 0,
      extractedChars: 0,
      indicatorHints: fallbackAssessmentIndicators(),
      status: `PDF belum dapat diekstrak otomatis: ${error instanceof Error ? error.message : "unknown"}. Indikator fallback diberi status DATA_TIDAK_CUKUP.`,
    };
  }
}

function fallbackAssessmentIndicators(): AssessmentPdfSummary["indicatorHints"] {
  return [
    { kode: "SK2024-MINUTASI", nama: "Ketepatan minutasi perkara", status: "DATA_TIDAK_CUKUP", sourceHint: "Butuh rumus/batas waktu eksplisit dari SK Penilaian SIPP 2024." },
    { kode: "SK2024-UPLOAD-PUTUSAN", nama: "Kelengkapan upload putusan/dokumen", status: "DATA_TIDAK_CUKUP", sourceHint: "Butuh pemetaan dokumen SIPP/Dirput dan parameter periode." },
    { kode: "SK2024-MEDIASI", nama: "Kelengkapan data mediasi", status: "DATA_TIDAK_CUKUP", sourceHint: "Butuh indikator resmi dan relasi tabel mediasi." },
    { kode: "SK2024-ECOURT", nama: "Kepatuhan data e-Court", status: "DATA_TIDAK_CUKUP", sourceHint: "Butuh validasi tabel e-Court yang dipakai satker." },
  ];
}

async function auditApplication(name: string, rootPath: string): Promise<AppAuditSummary> {
  const rootStat = await stat(rootPath).catch(() => null);
  if (!rootStat?.isDirectory()) {
    return {
      name,
      path: rootPath,
      exists: false,
      framework: "Tidak diketahui",
      language: "Tidak diketahui",
      database: "Tidak diketahui",
      sippConnection: "Tidak diketahui",
      mainFunctions: [],
      relevantModules: [],
      importantFiles: [],
      queryFindings: 0,
      writeRiskFindings: 0,
      securityRisks: ["Path tidak ditemukan atau bukan folder."],
      reusableReferences: [],
      doNotCopy: [],
    };
  }

  const importantFiles: string[] = [];
  let queryFindings = 0;
  let writeRiskFindings = 0;
  const extensions = new Map<string, number>();
  const stack: string[] = [rootPath];
  let scannedFiles = 0;

  while (stack.length > 0 && scannedFiles < 700) {
    const current = stack.pop()!;
    const entries = await readdir(current, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (!["node_modules", "vendor", "system", ".git", "dokumen_arsip"].includes(entry.name)) stack.push(fullPath);
        continue;
      }
      scannedFiles += 1;
      const ext = path.extname(entry.name).toLowerCase() || "(none)";
      extensions.set(ext, (extensions.get(ext) ?? 0) + 1);
      if (/config|koneksi|database|db|lap|sidang|putusan|minutasi|variabel|template|pdf|print/i.test(entry.name)) {
        importantFiles.push(fullPath);
      }
      if (![".php", ".sql", ".txt", ".rtf", ".js"].includes(ext)) continue;
      const text = await readFile(fullPath, "utf8").catch(() => "");
      if (/\bSELECT\b/i.test(text)) queryFindings += 1;
      if (/\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE)\b/i.test(text)) writeRiskFindings += 1;
    }
  }

  const phpDominant = (extensions.get(".php") ?? 0) > 0;
  const nodeDominant = (extensions.get(".js") ?? 0) > 0 || (extensions.get(".ts") ?? 0) > 0;
  const isAntrian = /antrian/i.test(name);
  const isPendukung = /pendukung/i.test(name);
  const isSipp = /^SIPP/i.test(name);
  const isAbt = /ABT/i.test(name);

  return {
    name,
    path: rootPath,
    exists: true,
    framework: isSipp || isAbt ? "CodeIgniter/PHP legacy" : phpDominant ? "PHP procedural/legacy" : nodeDominant ? "Node/Next" : "Campuran",
    language: phpDominant ? "PHP" : nodeDominant ? "TypeScript/JavaScript" : "Tidak dominan",
    database: phpDominant ? "MySQL/MariaDB" : "PostgreSQL/MySQL tergantung modul",
    sippConnection: queryFindings > 0 ? "Terdeteksi query ke struktur SIPP atau database legacy." : "Belum terdeteksi pada scan ringkas.",
    mainFunctions: [
      isSipp ? "Aplikasi sumber SIPP" : "",
      isAbt ? "Template/variabel/dokumen ABT legacy" : "",
      isPendukung ? "Monitoring dan laporan pendukung SIPP" : "",
      isAntrian ? "Antrian sidang, display ruang, dan laporan sidang" : "",
    ].filter(Boolean),
    relevantModules: importantFiles.slice(0, 12),
    importantFiles: importantFiles.slice(0, 20),
    queryFindings,
    writeRiskFindings,
    securityRisks: [
      writeRiskFindings > 0 ? "Ditemukan pola query write; tidak boleh dipindahkan ke ALETA x SIPP tanpa normalisasi read-only." : "",
      phpDominant ? "Query legacy banyak berupa string interpolation; wajib parameterized/registry." : "",
    ].filter(Boolean),
    reusableReferences: [
      isAntrian ? "Layout jadwal sidang/PDF dan field ruang sidang." : "",
      isPendukung ? "Daftar menu monitoring dan logika indikator yang masih relevan." : "",
      isAbt ? "Pola variabel #angka#, template RTF, BAS/tanya jawab, dan query resolver." : "",
      isSipp ? "Model/query dan struktur relasi SIPP." : "",
    ].filter(Boolean),
    doNotCopy: [
      "Endpoint raw SQL dari client.",
      "Query write/update/delete/drop ke database SIPP.",
      "Credential atau token dari file config legacy.",
    ],
  };
}

type AletaSippCountRow = { count?: string | number | bigint | null };
type AletaSippCategoryRow = { category: string; count?: string | number | bigint | null };
type AletaSippImportJobRow = {
  id: string;
  import_type: string;
  source_path: string;
  mode: string;
  status: string;
  summary_json: unknown;
  error_message: string | null;
  executed_by: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
};
type AletaSippTableRow = {
  id: string;
  table_name: string;
  human_name: string;
  category: string;
  priority: number;
  short_description: string;
  long_description: string;
  function_in_case_process: string;
  table_kind: string;
  risk_notes: unknown;
  example_usage: string;
  example_query_key: string;
  business_function?: string;
  main_columns_summary?: string;
  relation_summary?: string;
  usage_examples?: unknown;
  data_quality_notes?: string;
  analysis_status?: string;
  confidence_score?: string | number | null;
  review_status?: string;
  review_notes?: string;
  analyzed_at?: string | null;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
  column_count?: string | number | bigint | null;
  relation_count?: string | number | bigint | null;
};
type AletaSippColumnRow = {
  id: string;
  table_id: string;
  table_name: string;
  column_name: string;
  human_name: string;
  data_type: string;
  is_nullable: number;
  is_primary_key: number;
  is_indexed: number;
  description: string;
  example_value: string;
  relation_hint: string;
  query_usage_json: unknown;
  quality_notes: string;
  default_value?: string;
  usage_notes?: string;
  analysis_status?: string;
  confidence_score?: string | number | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};
type AletaSippRelationRow = {
  id: string;
  source_table: string;
  source_column: string;
  target_table: string;
  target_column: string;
  relation_type: string;
  confidence: string;
  description: string;
  example_query_key: string;
  is_active: number;
  created_at: string;
  updated_at: string;
};
type AletaSippQueryRegistryRow = {
  id: string;
  query_key: string;
  name: string;
  query_name?: string;
  query_title?: string;
  category: string;
  sub_category?: string;
  source: string;
  business_purpose?: string;
  source_type?: string;
  source_file?: string;
  source_location?: string;
  source_line?: number | null;
  short_description: string;
  long_description: string;
  tables_json: unknown;
  output_columns_json: unknown;
  original_sql: string;
  normalized_sql: string;
  parameterized_sql?: string;
  sql_hash?: string;
  columns_used_json?: unknown;
  parameters_json?: unknown;
  outputs_json?: unknown;
  related_table_names_json?: unknown;
  related_variable_codes_json?: unknown;
  related_variable_keys_json?: unknown;
  execution_mode?: string;
  security_status: string;
  review_status?: string;
  confidence_score?: string | number | null;
  role_scope_json: unknown;
  ai_allowed: number;
  whatsapp_allowed: number;
  pdf_allowed: number;
  is_ai_usable?: number;
  is_whatsapp_usable?: number;
  is_pdf_usable?: number;
  risk_notes_json: unknown;
  risk_notes?: string;
  usage_notes?: string;
  example_params?: unknown;
  example_output?: unknown;
  is_active: number;
  created_at: string;
  updated_at: string;
};
type AletaSippVariableRow = {
  id: string;
  variable_key?: string;
  legacy_source: string;
  legacy_code: string;
  legacy_number?: number | null;
  modern_key: string;
  display_name: string;
  short_description?: string;
  long_description?: string;
  description: string;
  category?: string;
  data_type: string;
  variable_type?: string;
  source_type: string;
  source_table: string;
  source_column: string;
  query_id: string | null;
  source_query_key?: string;
  source_sql_fragment?: string;
  placeholder_pattern?: string;
  template_files_json?: unknown;
  transform_key: string;
  example_value: string;
  fallback_value?: string;
  fallback_strategy?: string;
  required?: number;
  is_repeating?: number;
  repeat_group?: string;
  mapping_status?: string;
  review_status?: string;
  confidence_score?: string | number | null;
  risk_notes?: string;
  usage_notes?: string;
  status: string;
  sensitive: number;
  is_active: number;
  created_at: string;
  updated_at: string;
};
type AletaSippAssessmentIndicatorRow = {
  id: string;
  indicator_code: string;
  name: string;
  category: string;
  sk_basis: string;
  description: string;
  weight: string | number | null;
  formula: string;
  source_tables_json: unknown;
  query_id: string | null;
  parameter_period: string;
  status: string;
  assumption_notes: string;
  is_active: number;
  created_at: string;
  updated_at: string;
};

function requireAletaSippPermissionForAction(
  actor: UserPersona,
  permission: (typeof ALETA_SIPP_PERMISSION)[keyof typeof ALETA_SIPP_PERMISSION],
  message: string
) {
  const access = resolveAletaSippAccess(actor);
  if (!access.canView || !access.permissions.includes(permission)) forbidden(message);
  return access;
}

function canViewAletaSippSqlPreview(actor: UserPersona) {
  return resolveAletaSippAccess(actor).permissions.includes(ALETA_SIPP_PERMISSION.VIEW_SQL_PREVIEW);
}

function countValue(row: AletaSippCountRow | undefined) {
  const value = row?.count;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value) || 0;
  return 0;
}

function numericValue(value: string | number | bigint | null | undefined) {
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value) || 0;
  return 0;
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function asObjectArray<T extends Record<string, unknown>>(value: unknown): T[] {
  if (Array.isArray(value)) return value.filter((item): item is T => typeof item === "object" && item !== null);
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is T => typeof item === "object" && item !== null) : [];
  } catch {
    return [];
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value !== "string" || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function jsonString(value: unknown) {
  return JSON.stringify(value ?? null);
}

function slugId(value: string, maxLength = 90) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, maxLength);
  return slug || createHash("sha1").update(value).digest("hex").slice(0, 16);
}

function stableId(prefix: string, ...parts: string[]) {
  const raw = parts.join("__");
  const hash = createHash("sha1").update(raw).digest("hex").slice(0, 10);
  return `${prefix}_${slugId(raw, 100)}_${hash}`;
}

function schemaHashForTable(table: SippTableSummary) {
  return createHash("sha256")
    .update(JSON.stringify({ columns: table.columns, keys: table.keys, relations: table.relations }))
    .digest("hex");
}

function tableKindFromCategory(category: string) {
  const lower = category.toLowerCase();
  if (lower.includes("perkara")) return "perkara";
  if (lower.includes("persidangan")) return "persidangan";
  if (lower.includes("putusan")) return "putusan";
  if (lower.includes("referensi")) return "referensi";
  if (lower.includes("sistem") || lower.includes("log")) return "sistem";
  return "pendukung";
}

function isPrimaryKeyColumn(table: SippTableSummary, columnName: string) {
  const pattern = new RegExp(`PRIMARY\\s+KEY[\\s\\S]*\`${columnName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\``, "i");
  return table.keys.some((key) => pattern.test(key));
}

function isIndexedColumn(table: SippTableSummary, columnName: string) {
  const pattern = new RegExp(`\`${columnName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\``, "i");
  return table.keys.some((key) => pattern.test(key));
}

function targetColumnForRelation(targetTable: string) {
  if (targetTable === "perkara") return "perkara_id";
  if (targetTable === "pihak") return "pihak_id";
  return `${targetTable}_id`;
}

function baseVariableSeeds() {
  return [
    { legacySource: "ABT", legacyCode: "#0001#", modernKey: "##nomor_perkara##", displayName: "Nomor Perkara", sourceType: "sipp_perkara", sourceTable: "perkara", sourceColumn: "nomor_perkara", status: "MAPPED" },
    { legacySource: "ABT", legacyCode: "#0668#", modernKey: "##ketua_majelis##", displayName: "Ketua Majelis", sourceType: "sipp_hakim", sourceTable: "perkara_hakim_pn", sourceColumn: "nama_hakim", status: "MAPPED" },
    { legacySource: "ABT", legacyCode: "#0033#", modernKey: "##tanggal_sidang##", displayName: "Tanggal Sidang", sourceType: "sipp_jadwal_sidang", sourceTable: "perkara_jadwal_sidang", sourceColumn: "tanggal_sidang", status: "MAPPED" },
    { legacySource: "Word Query", legacyCode: "#4048#", modernKey: "##variabel_4048_perlu_review##", displayName: "Variabel legacy 4048", sourceType: "word_query", sourceTable: "", sourceColumn: "", status: "NEEDS_REVIEW" },
    { legacySource: "Word Query", legacyCode: "#4004#", modernKey: "##variabel_4004_perlu_review##", displayName: "Variabel legacy 4004", sourceType: "word_query", sourceTable: "", sourceColumn: "", status: "NEEDS_REVIEW" },
  ];
}

async function readCount(db: AletaDatabase, query: string, params: Array<string | number | boolean | null> = []) {
  return countValue(await db.queryOne<AletaSippCountRow>(query, params));
}

function mapQueryRegistryRow(row: AletaSippQueryRegistryRow, options?: { includeSql?: boolean } | number) {
  const outputColumns = asStringArray(row.output_columns_json);
  const outputs = asObjectArray(row.outputs_json).length > 0 ? asObjectArray(row.outputs_json) : outputColumns.map((name) => ({ name }));
  const tableNames = asStringArray(row.related_table_names_json).length > 0 ? asStringArray(row.related_table_names_json) : asStringArray(row.tables_json);
  const includeSql = typeof options === "object" && options.includeSql === true;
  return {
    queryId: row.id,
    queryKey: row.query_key,
    name: row.query_name || row.name,
    queryName: row.query_name || row.name,
    queryTitle: row.query_title || row.query_name || row.name,
    category: row.category,
    subCategory: row.sub_category ?? "",
    source: row.source,
    sourceType: row.source_type || row.source || "AUTO_GENERATED",
    sourceFile: row.source_file ?? "",
    sourceLocation: row.source_location ?? "",
    sourceLine: row.source_line ?? null,
    shortDescription: row.short_description,
    longDescription: row.long_description,
    businessPurpose: row.business_purpose ?? "",
    tables: tableNames,
    outputColumns,
    columnsUsed: asStringArray(row.columns_used_json),
    parameters: asObjectArray(row.parameters_json) as Array<Record<string, unknown>>,
    outputs,
    relatedTableNames: tableNames,
    relatedVariableCodes: asStringArray(row.related_variable_codes_json),
    relatedVariableKeys: asStringArray(row.related_variable_keys_json),
    originalSql: includeSql ? row.original_sql : "",
    normalizedSql: includeSql ? row.normalized_sql : "",
    parameterizedSql: includeSql ? row.parameterized_sql || row.normalized_sql : "",
    sqlPreviewRedacted: !includeSql,
    sqlHash: row.sql_hash ?? "",
    executionMode: row.execution_mode || (row.security_status === "SAFE_READ_ONLY" ? "READY_READ_ONLY" : "NEEDS_REVIEW"),
    safetyStatus: row.security_status,
    securityStatus: row.security_status,
    reviewStatus: row.review_status ?? "NEEDS_ADMIN_REVIEW",
    confidenceScore: numericValue(row.confidence_score),
    allowedForAi: row.is_ai_usable === 1 || row.ai_allowed === 1,
    allowedForWhatsapp: row.is_whatsapp_usable === 1 || row.whatsapp_allowed === 1,
    allowedForPdf: row.is_pdf_usable === 1 || row.pdf_allowed === 1,
    roles: asStringArray(row.role_scope_json),
    riskNotes: row.risk_notes ? [row.risk_notes] : asStringArray(row.risk_notes_json),
    usageNotes: row.usage_notes ?? "",
    exampleParams: asRecord(row.example_params),
    exampleOutput: asRecord(row.example_output),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapVariableRow(row: AletaSippVariableRow) {
  return {
    id: row.id,
    variableKey: row.variable_key || row.modern_key,
    legacySource: row.legacy_source,
    legacyCode: row.legacy_code,
    legacyNumber: row.legacy_number ?? (Number(row.legacy_code.replace(/\D/g, "")) || null),
    modernKey: row.modern_key,
    displayName: row.display_name,
    shortDescription: row.short_description || row.description,
    longDescription: row.long_description || row.description,
    description: row.description,
    category: row.category ?? "Lainnya",
    dataType: row.data_type,
    variableType: row.variable_type ?? "UNKNOWN",
    sourceType: row.source_type,
    sourceTable: row.source_table,
    sourceColumn: row.source_column,
    sourceQueryKey: row.source_query_key ?? "",
    sourceSqlFragment: row.source_sql_fragment ?? "",
    placeholderPattern: row.placeholder_pattern || row.legacy_code,
    templateFiles: asStringArray(row.template_files_json),
    status: row.status,
    mappingStatus: row.mapping_status ?? row.status,
    reviewStatus: row.review_status ?? "NEEDS_ADMIN_REVIEW",
    confidenceScore: numericValue(row.confidence_score),
    exampleValue: row.example_value,
    fallbackValue: row.fallback_value ?? "",
    fallbackStrategy: row.fallback_strategy ?? "",
    required: row.required === 1,
    isRepeating: row.is_repeating === 1,
    repeatGroup: row.repeat_group ?? "",
    riskNotes: row.risk_notes ?? "",
    usageNotes: row.usage_notes ?? "",
    sensitive: row.sensitive === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAssessmentIndicatorRow(row: AletaSippAssessmentIndicatorRow) {
  return {
    id: row.id,
    kode: row.indicator_code,
    nama: row.name,
    category: row.category,
    status: row.status,
    weight: Number(row.weight ?? 0),
    sourceTables: asStringArray(row.source_tables_json),
    sourceHint: row.assumption_notes || row.description || "Indikator tersimpan di cache ALETA dan perlu validasi manual.",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

type RegistryQueryCandidate = {
  queryKey: string;
  queryName: string;
  category: string;
  subCategory?: string;
  shortDescription: string;
  longDescription: string;
  businessPurpose: string;
  sourceType: string;
  sourceFile: string;
  sourceLocation?: string;
  sourceLine?: number | null;
  originalSql: string;
  normalizedSql: string;
  parameterizedSql: string;
  tablesUsed: string[];
  columnsUsed: string[];
  parameters: Array<Record<string, unknown>>;
  outputs: Array<Record<string, unknown>>;
  relatedVariableCodes: string[];
  relatedVariableKeys: string[];
  executionMode: string;
  safetyStatus: string;
  reviewStatus: string;
  confidenceScore: number;
  riskNotes: string;
  usageNotes: string;
  exampleParams?: Record<string, unknown>;
  exampleOutput?: Record<string, unknown>;
  isAiUsable?: boolean;
  isWhatsappUsable?: boolean;
  isPdfUsable?: boolean;
};

type RegistryVariableCandidate = {
  legacySource: string;
  legacyCode: string;
  variableKey: string;
  modernKey: string;
  displayName: string;
  shortDescription: string;
  longDescription: string;
  category: string;
  variableType: string;
  sourceType: string;
  sourceTable: string;
  sourceColumn: string;
  sourceQueryKey: string;
  sourceSqlFragment: string;
  placeholderPattern: string;
  templateFiles: string[];
  exampleValue: string;
  fallbackValue: string;
  fallbackStrategy: string;
  required: boolean;
  isRepeating: boolean;
  repeatGroup: string;
  mappingStatus: string;
  reviewStatus: string;
  confidenceScore: number;
  riskNotes: string;
  usageNotes: string;
};

function normalizeSqlText(sql: string) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\n\r]*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parameterizeSql(sql: string) {
  return normalizeSqlText(sql)
    .replace(/:\w+/g, "?")
    .replace(/\$[a-zA-Z_][a-zA-Z0-9_]*/g, "?");
}

function sqlHash(sql: string) {
  return createHash("sha1").update(normalizeSqlText(sql).toLowerCase()).digest("hex");
}

function legacyCodeFromNumber(value: string | number | null | undefined) {
  const raw = String(value ?? "").trim();
  const digits = raw.includes("#") ? raw.replace(/\D/g, "") : String(Math.trunc(Number(raw) || 0));
  if (!digits || digits === "0") return "";
  return `#${digits.padStart(4, "0")}#`;
}

function modernKeyFromLabel(label: string, fallbackCode: string) {
  const base = label
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_")
    .slice(0, 70);
  const legacyNumber = fallbackCode.replace(/\D/g, "");
  if (!base || base.length < 3) return `##unresolved_${legacyNumber || "unknown"}##`;
  return `##${base}##`;
}

const knownLegacyVariableKeys: Record<string, { key: string; name: string; category?: string }> = {
  "#4048#": { key: "##nama_pemilik_ktp##", name: "Nama Pemilik KTP", category: "Identitas Pihak" },
  "#0335#": { key: "##nik_pemilik_ktp##", name: "NIK Pemilik KTP", category: "Identitas Pihak" },
  "#4004#": { key: "##panitera_pengganti##", name: "Panitera Pengganti", category: "Persidangan" },
  "#1004#": { key: "##nomor_akta_nikah##", name: "Nomor Akta Nikah", category: "Data Perkawinan" },
  "#1012#": { key: "##tanggal_akta_nikah##", name: "Tanggal Akta Nikah", category: "Data Perkawinan" },
  "#1005#": { key: "##kua_penerbit_akta_nikah##", name: "KUA Penerbit Akta Nikah", category: "Data Perkawinan" },
};

function extractLegacyPlaceholders(text: string) {
  return Array.from(new Set((text.match(/#\d+#/g) ?? []).map((item) => `#${item.replace(/\D/g, "").padStart(4, "0")}#`)));
}

function inferVariableType(dataType: string, sourceTable: string, sourceSql: string) {
  const lower = `${dataType} ${sourceTable} ${sourceSql}`.toLowerCase();
  if (lower.includes("qrcode") || lower.includes("qr")) return "COMPUTED";
  if (lower.includes("terbilang")) return "TERBILANG";
  if (lower.includes("hijri")) return "HIJRI_DATE";
  if (lower.includes("tanggal") || lower.includes("date")) return "DATE_FORMAT";
  if (lower.includes("multi")) return "MULTI_ROW";
  if (lower.includes("sipp") || sourceTable) return "SIPP_FIELD";
  if (lower.includes("teks") || lower.includes("text")) return "STATIC_TEXT";
  return "UNKNOWN";
}

function inferVariableSourceType(dataType: string, sourceTable: string, sourceSql: string) {
  if (sourceSql.trim()) return "QUERY_REGISTRY";
  if (sourceTable.trim()) return "SIPP_TABLE";
  const lower = dataType.toLowerCase();
  if (lower.includes("qrcode") || lower.includes("terbilang") || lower.includes("tanggal")) return "COMPUTED";
  if (lower.includes("teks") || lower.includes("manual")) return "MANUAL_INPUT";
  return "UNKNOWN";
}

function safetyForSql(sql: string) {
  const normalized = normalizeSqlText(sql);
  const hasWrite = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|REPLACE|GRANT|REVOKE|CALL|LOAD_FILE|INTO\s+OUTFILE|INTO\s+DUMPFILE)\b/i.test(normalized);
  if (hasWrite) {
    return {
      safetyStatus: "REJECTED_WRITE_QUERY",
      executionMode: "UNSAFE_RAW_SQL",
      reviewStatus: "NEEDS_ADMIN_REVIEW",
      confidenceScore: 10,
      riskNotes: "SQL mengandung operasi write/DDL sehingga hanya disimpan sebagai temuan dan tidak boleh dieksekusi.",
    };
  }
  const safe = validateAletaSippSelectOnlySql(normalized).selectOnly;
  if (safe && /\bLIMIT\s+\d+\b/i.test(normalized)) {
    return {
      safetyStatus: "SAFE_READ_ONLY",
      executionMode: "READY_READ_ONLY",
      reviewStatus: "AUTO_IMPORTED",
      confidenceScore: 80,
      riskNotes: "SQL terdeteksi SELECT/read-only dan memiliki pembatas LIMIT. Tetap perlu validasi struktur sebelum dipakai operasional.",
    };
  }
  if (safe) {
    return {
      safetyStatus: "NEEDS_REVIEW",
      executionMode: "NEEDS_REVIEW",
      reviewStatus: "NEEDS_ADMIN_REVIEW",
      confidenceScore: 55,
      riskNotes: "SQL terdeteksi SELECT/read-only tetapi belum memiliki pembatas/parameterisasi yang cukup jelas.",
    };
  }
  return {
    safetyStatus: "NEEDS_REVIEW",
    executionMode: "DICTIONARY_ONLY",
    reviewStatus: "NEEDS_ADMIN_REVIEW",
    confidenceScore: 35,
    riskNotes: "Potongan SQL belum lengkap atau tidak dapat dipastikan aman dari sumber yang tersedia.",
  };
}

async function runPythonJson<T>(script: string, args: string[] = []) {
  const { stdout } = await execFileAsync("python", ["-c", script, ...args], {
    maxBuffer: 80 * 1024 * 1024,
    windowsHide: true,
  });
  return JSON.parse(stdout) as T;
}

async function readAbtXlsRows() {
  const script = String.raw`
import json, sys, xlrd
path = sys.argv[1]
wb = xlrd.open_workbook(path)
sheet = wb.sheet_by_name('abt_variabel') if 'abt_variabel' in wb.sheet_names() else wb.sheet_by_index(0)
headers = [str(sheet.cell_value(0, c)).strip() for c in range(sheet.ncols)]
rows = []
for r in range(1, sheet.nrows):
    item = {}
    empty = True
    for c, header in enumerate(headers):
        value = sheet.cell_value(r, c)
        if isinstance(value, float) and value.is_integer():
            value = int(value)
        if str(value).strip():
            empty = False
        item[header or f'col_{c}'] = value
    if not empty:
        rows.append(item)
print(json.dumps(rows, ensure_ascii=False))
`;
  return runPythonJson<Array<Record<string, unknown>>>(script, [DEFAULT_PATHS.abtXls]);
}

async function readDocxText(filePath: string) {
  const script = String.raw`
import html, json, re, sys, zipfile
path = sys.argv[1]
with zipfile.ZipFile(path) as z:
    xml = z.read('word/document.xml').decode('utf-8', 'ignore')
text = re.sub(r'<w:tab[^>]*>', '\t', xml)
text = re.sub(r'</w:p>', '\n', text)
text = re.sub(r'<[^>]+>', '', text)
text = html.unescape(text)
print(json.dumps({'text': text}, ensure_ascii=False))
`;
  const payload = await runPythonJson<{ text: string }>(script, [filePath]);
  return payload.text;
}

function extractSqlSnippetsFromText(text: string, limit = 4000) {
  const normalized = text.replace(/\r/g, "\n");
  const snippets: Array<{ sql: string; line: number; title: string }> = [];
  const selectRegex = /\b(?:WITH|SELECT)\b[\s\S]{20,4000}?(?=(?:\n\s*\d{1,4}\s*\n)|(?:\n\s*(?:SELECT|WITH)\b)|$)/gi;
  let match: RegExpExecArray | null;
  while ((match = selectRegex.exec(normalized)) && snippets.length < limit) {
    const sql = normalizeSqlText(match[0].replace(/\u00a0/g, " "));
    if (!sql || sql.length < 25) continue;
    const before = normalized.slice(0, match.index);
    const line = before.split("\n").length;
    const previousLines = before.split("\n").slice(-4).map((item) => item.trim()).filter(Boolean);
    const title = previousLines.findLast((item) => !/^\d+$/.test(item) && !/^query$/i.test(item)) ?? "Query Kandidat";
    snippets.push({ sql, line, title });
  }
  return snippets;
}

function extractTablesFromSql(sql: string, knownTables: Set<string>) {
  const candidates = Array.from(sql.matchAll(/\b(?:FROM|JOIN)\s+`?([a-zA-Z0-9_]+)`?/gi)).map((match) => match[1].toLowerCase());
  return Array.from(new Set(candidates.filter((table) => knownTables.size === 0 || knownTables.has(table))));
}

function extractColumnsFromSql(sql: string) {
  const columns = Array.from(sql.matchAll(/(?:SELECT|,)\s*(?:`?([a-zA-Z0-9_]+)`?\.)?`?([a-zA-Z0-9_]+)`?(?:\s+AS\s+`?([a-zA-Z0-9_]+)`?)?/gi))
    .map((match) => match[3] || match[2])
    .filter((value) => value && !["select", "from", "case", "when", "then", "else"].includes(value.toLowerCase()));
  return Array.from(new Set(columns)).slice(0, 60);
}

function extractParametersFromSql(sql: string) {
  const colonParams = Array.from(sql.matchAll(/:([a-zA-Z_][a-zA-Z0-9_]*)/g)).map((match) => match[1]);
  const likelyParams = ["perkara_id", "nomor_perkara", "tanggal_sidang", "tanggal_awal", "tanggal_akhir", "jenis_perkara_id", "hakim_id", "panitera_id"]
    .filter((param) => new RegExp(`\\b${param}\\b`, "i").test(sql) && /WHERE|BETWEEN|LIKE|=|>=|<=/i.test(sql));
  return Array.from(new Set([...colonParams, ...likelyParams])).map((name) => ({
    name,
    label: humanizeIdentifier(name),
    type: /tanggal|date/i.test(name) ? "date" : /_id$|id$/i.test(name) ? "number" : "text",
    required: !/akhir|selesai|ruang/i.test(name),
  }));
}

function makeQueryKey(prefix: string, category: string, title: string, sql: string) {
  const base = `${prefix}_${slugId(category, 24).toUpperCase()}_${slugId(title, 42).toUpperCase()}`.replace(/_+/g, "_");
  return `${base}_${sqlHash(sql).slice(0, 4).toUpperCase()}`.slice(0, 110);
}

async function listKnownSippTables(db: AletaDatabase) {
  return db.queryAll<{ table_name: string; human_name: string; category: string }>(
    "SELECT table_name, human_name, category FROM aleta_sipp_tables WHERE is_active = 1 ORDER BY table_name"
  );
}

async function columnsForTables(db: AletaDatabase, tableNames: string[]) {
  if (tableNames.length === 0) return new Map<string, Array<{ column_name: string; human_name: string; data_type: string }>>();
  const placeholders = tableNames.map(() => "?").join(", ");
  const rows = await db.queryAll<{ table_name: string; column_name: string; human_name: string; data_type: string }>(
    `SELECT table_name, column_name, human_name, data_type FROM aleta_sipp_columns WHERE table_name IN (${placeholders}) ORDER BY table_name, sort_order`,
    tableNames
  );
  const map = new Map<string, Array<{ column_name: string; human_name: string; data_type: string }>>();
  for (const row of rows) {
    const items = map.get(row.table_name) ?? [];
    items.push(row);
    map.set(row.table_name, items);
  }
  return map;
}

function candidateFromSql(input: {
  prefix: string;
  title: string;
  category: string;
  sourceType: string;
  sourceFile: string;
  sourceLocation?: string;
  sourceLine?: number | null;
  sql: string;
  knownTables: Set<string>;
  relatedVariableCodes?: string[];
  executionModeOverride?: string;
}) {
  const normalizedSql = normalizeSqlText(input.sql);
  const safety = safetyForSql(normalizedSql);
  const tablesUsed = extractTablesFromSql(normalizedSql, input.knownTables);
  const columnsUsed = extractColumnsFromSql(normalizedSql);
  const parameters = extractParametersFromSql(normalizedSql);
  const relatedVariableCodes = input.relatedVariableCodes ?? extractLegacyPlaceholders(normalizedSql);
  return {
    queryKey: makeQueryKey(input.prefix, input.category, input.title, normalizedSql),
    queryName: input.title,
    category: input.category,
    shortDescription: `Kandidat query ${input.title} dari sumber ${input.sourceType}.`,
    longDescription:
      `Query ini diinventarisasi otomatis dari ${input.sourceFile || input.sourceType}. Status awal mengikuti hasil deteksi keamanan dan perlu review admin sebelum dipakai operasional.`,
    businessPurpose: `Mendukung inventarisasi data ${input.category.toLowerCase()} dari sumber legacy/metadata SIPP.`,
    sourceType: input.sourceType,
    sourceFile: input.sourceFile,
    sourceLocation: input.sourceLocation ?? "",
    sourceLine: input.sourceLine ?? null,
    originalSql: input.sql,
    normalizedSql,
    parameterizedSql: parameterizeSql(normalizedSql),
    tablesUsed,
    columnsUsed,
    parameters,
    outputs: columnsUsed.slice(0, 20).map((name) => ({ name, label: humanizeIdentifier(name), dataType: "text" })),
    relatedVariableCodes,
    relatedVariableKeys: relatedVariableCodes.map((code) => knownLegacyVariableKeys[code]?.key ?? `##unresolved_${code.replace(/\D/g, "")}##`),
    executionMode: input.executionModeOverride ?? safety.executionMode,
    safetyStatus: safety.safetyStatus,
    reviewStatus: safety.reviewStatus,
    confidenceScore: safety.confidenceScore,
    riskNotes: safety.riskNotes,
    usageNotes: "Hasil inventarisasi otomatis. Validasi tabel, kolom, parameter, dan batas data sebelum dipakai.",
    exampleParams: Object.fromEntries(parameters.map((param) => [String(param.name), param.type === "date" ? "2026-01-01" : "contoh"])),
    exampleOutput: {},
    isAiUsable: safety.safetyStatus !== "REJECTED_WRITE_QUERY",
    isWhatsappUsable: false,
    isPdfUsable: /jadwal|pdf|sidang/i.test(input.title),
  } satisfies RegistryQueryCandidate;
}

function requiredBaseQueryDefinitions(knownTables: Set<string>) {
  const required: Array<{ key: string; name: string; category: string; table: string; param: string; filter?: string; output?: string[] }> = [
    { key: "QRY_SIPP_PERKARA_BY_NOMOR", name: "Cari Perkara Berdasarkan Nomor", category: "Perkara", table: "perkara", param: "nomor_perkara", filter: "nomor_perkara = :nomor_perkara" },
    { key: "QRY_SIPP_PERKARA_BY_ID", name: "Cari Perkara Berdasarkan ID", category: "Perkara", table: "perkara", param: "perkara_id", filter: "perkara_id = :perkara_id" },
    { key: "QRY_SIPP_PERKARA_LIST_BY_TANGGAL_DAFTAR", name: "Daftar Perkara Berdasarkan Tanggal Daftar", category: "Perkara", table: "perkara", param: "tanggal_awal", filter: "tanggal_pendaftaran BETWEEN :tanggal_awal AND :tanggal_akhir" },
    { key: "QRY_SIPP_PERKARA_AKTIF", name: "Daftar Perkara Aktif", category: "Perkara", table: "perkara", param: "tanggal_awal", filter: "tanggal_pendaftaran >= :tanggal_awal" },
    { key: "QRY_SIPP_PERKARA_BELUM_PUTUS", name: "Perkara Belum Putus", category: "Perkara", table: "perkara_putusan", param: "tanggal_awal", filter: "tanggal_putusan IS NULL" },
    { key: "QRY_SIPP_PERKARA_SUDAH_PUTUS", name: "Perkara Sudah Putus", category: "Perkara", table: "perkara_putusan", param: "tanggal_awal", filter: "tanggal_putusan IS NOT NULL" },
    { key: "QRY_SIPP_PERKARA_BELUM_MINUTASI", name: "Perkara Belum Minutasi", category: "Perkara", table: "perkara_putusan", param: "tanggal_awal", filter: "tanggal_minutasi IS NULL" },
    { key: "QRY_SIPP_PERKARA_BY_JENIS_PERKARA", name: "Perkara Berdasarkan Jenis Perkara", category: "Perkara", table: "perkara", param: "jenis_perkara_id", filter: "jenis_perkara_id = :jenis_perkara_id" },
    { key: "QRY_SIPP_PIHAK_BY_PERKARA_ID", name: "Para Pihak Berdasarkan Perkara", category: "Pihak", table: "perkara_pihak1", param: "perkara_id" },
    { key: "QRY_SIPP_PENGGUGAT_BY_PERKARA_ID", name: "Penggugat Berdasarkan Perkara", category: "Pihak", table: "perkara_pihak1", param: "perkara_id" },
    { key: "QRY_SIPP_TERGUGAT_BY_PERKARA_ID", name: "Tergugat Berdasarkan Perkara", category: "Pihak", table: "perkara_pihak2", param: "perkara_id" },
    { key: "QRY_SIPP_PEMOHON_BY_PERKARA_ID", name: "Pemohon Berdasarkan Perkara", category: "Pihak", table: "perkara_pihak1", param: "perkara_id" },
    { key: "QRY_SIPP_TERMOHON_BY_PERKARA_ID", name: "Termohon Berdasarkan Perkara", category: "Pihak", table: "perkara_pihak2", param: "perkara_id" },
    { key: "QRY_SIPP_KUASA_HUKUM_BY_PERKARA_ID", name: "Kuasa Hukum Berdasarkan Perkara", category: "Pihak", table: "perkara_pengacara", param: "perkara_id" },
    { key: "QRY_SIPP_JADWAL_SIDANG_BY_TANGGAL", name: "Jadwal Sidang Berdasarkan Tanggal", category: "Persidangan", table: "perkara_jadwal_sidang", param: "tanggal_sidang", filter: "tanggal_sidang = :tanggal_sidang" },
    { key: "QRY_SIPP_JADWAL_SIDANG_BY_PERKARA_ID", name: "Jadwal Sidang Berdasarkan Perkara", category: "Persidangan", table: "perkara_jadwal_sidang", param: "perkara_id" },
    { key: "QRY_SIPP_JADWAL_SIDANG_TERAKHIR_BY_PERKARA_ID", name: "Jadwal Sidang Terakhir Berdasarkan Perkara", category: "Persidangan", table: "perkara_jadwal_sidang", param: "perkara_id" },
    { key: "QRY_SIPP_JADWAL_SIDANG_BERIKUTNYA_BY_PERKARA_ID", name: "Jadwal Sidang Berikutnya Berdasarkan Perkara", category: "Persidangan", table: "perkara_jadwal_sidang", param: "perkara_id" },
    { key: "QRY_SIPP_AGENDA_SIDANG_BY_PERKARA_ID", name: "Agenda Sidang Berdasarkan Perkara", category: "Persidangan", table: "perkara_jadwal_sidang", param: "perkara_id" },
    { key: "QRY_SIPP_MAJELIS_HAKIM_BY_PERKARA_ID", name: "Susunan Majelis Hakim Berdasarkan Perkara", category: "Majelis Hakim", table: "perkara_hakim_pn", param: "perkara_id" },
    { key: "QRY_SIPP_KETUA_MAJELIS_BY_PERKARA_ID", name: "Ketua Majelis Berdasarkan Perkara", category: "Majelis Hakim", table: "perkara_hakim_pn", param: "perkara_id" },
    { key: "QRY_SIPP_HAKIM_ANGGOTA_BY_PERKARA_ID", name: "Hakim Anggota Berdasarkan Perkara", category: "Majelis Hakim", table: "perkara_hakim_pn", param: "perkara_id" },
    { key: "QRY_SIPP_HAKIM_TUNGGAL_BY_PERKARA_ID", name: "Hakim Tunggal Berdasarkan Perkara", category: "Majelis Hakim", table: "perkara_hakim_pn", param: "perkara_id" },
    { key: "QRY_SIPP_PANITERA_PENGGANTI_BY_PERKARA_ID", name: "Panitera Pengganti Berdasarkan Perkara", category: "Panitera", table: "perkara_panitera_pn", param: "perkara_id" },
    { key: "QRY_SIPP_JURUSITA_BY_PERKARA_ID", name: "Jurusita Berdasarkan Perkara", category: "Jurusita", table: "perkara_jurusita", param: "perkara_id" },
    { key: "QRY_SIPP_PUTUSAN_BY_PERKARA_ID", name: "Putusan Berdasarkan Perkara", category: "Putusan", table: "perkara_putusan", param: "perkara_id" },
    { key: "QRY_SIPP_TANGGAL_PUTUS_BY_PERKARA_ID", name: "Tanggal Putus Berdasarkan Perkara", category: "Putusan", table: "perkara_putusan", param: "perkara_id" },
    { key: "QRY_SIPP_AMAR_PUTUSAN_BY_PERKARA_ID", name: "Amar Putusan Berdasarkan Perkara", category: "Putusan", table: "perkara_putusan", param: "perkara_id" },
    { key: "QRY_SIPP_STATUS_MINUTASI_BY_PERKARA_ID", name: "Status Minutasi Berdasarkan Perkara", category: "Putusan", table: "perkara_putusan", param: "perkara_id" },
    { key: "QRY_SIPP_MEDIASI_BY_PERKARA_ID", name: "Data Mediasi Berdasarkan Perkara", category: "Mediasi", table: "perkara_mediasi", param: "perkara_id" },
    { key: "QRY_SIPP_MEDIATOR_BY_PERKARA_ID", name: "Mediator Berdasarkan Perkara", category: "Mediasi", table: "perkara_mediasi", param: "perkara_id" },
    { key: "QRY_SIPP_HASIL_MEDIASI_BY_PERKARA_ID", name: "Hasil Mediasi Berdasarkan Perkara", category: "Mediasi", table: "perkara_mediasi", param: "perkara_id" },
    { key: "QRY_SIPP_BIAYA_PERKARA_BY_PERKARA_ID", name: "Biaya Perkara Berdasarkan Perkara", category: "Biaya Perkara", table: "perkara_biaya", param: "perkara_id" },
    { key: "QRY_SIPP_PANJAR_BIAYA_BY_PERKARA_ID", name: "Panjar Biaya Berdasarkan Perkara", category: "Biaya Perkara", table: "perkara_biaya", param: "perkara_id" },
    { key: "QRY_SIPP_SISA_PANJAR_BY_PERKARA_ID", name: "Sisa Panjar Berdasarkan Perkara", category: "Biaya Perkara", table: "perkara_biaya", param: "perkara_id" },
    { key: "QRY_SIPP_ECOURT_BY_PERKARA_ID", name: "Data e-Court Berdasarkan Perkara", category: "e-Court", table: "ecourt", param: "perkara_id" },
    { key: "QRY_SIPP_DOKUMEN_PUTUSAN_BY_PERKARA_ID", name: "Dokumen Putusan Berdasarkan Perkara", category: "Dokumen", table: "perkara_putusan", param: "perkara_id" },
    { key: "QRY_SIPP_UPLOAD_PUTUSAN_BY_PERKARA_ID", name: "Upload Putusan Berdasarkan Perkara", category: "Dokumen", table: "perkara_putusan", param: "perkara_id" },
    { key: "QRY_SIPP_AKTA_CERAI_BY_PERKARA_ID", name: "Akta Cerai Berdasarkan Perkara", category: "Akta Cerai", table: "perkara_akta_cerai", param: "perkara_id" },
    { key: "QRY_SIPP_IKRAR_TALAK_BY_PERKARA_ID", name: "Ikrar Talak Berdasarkan Perkara", category: "Akta Cerai", table: "perkara_ikrar_talak", param: "perkara_id" },
    { key: "QRY_ABT_ALAT_BUKTI_PENGGUGAT", name: "Alat Bukti Penggugat", category: "ABT", table: "perkara", param: "perkara_id" },
    { key: "QRY_ABT_ALAT_BUKTI_TERGUGAT", name: "Alat Bukti Tergugat", category: "ABT", table: "perkara", param: "perkara_id" },
    { key: "QRY_ABT_IDENTITAS_PARA_PIHAK", name: "Identitas Para Pihak", category: "ABT", table: "pihak", param: "perkara_id" },
    { key: "QRY_ABT_DATA_PERKAWINAN", name: "Data Perkawinan", category: "ABT", table: "perkara_data_pernikahan", param: "perkara_id" },
    { key: "QRY_ABT_DATA_SIDANG", name: "Data Sidang", category: "ABT", table: "perkara_jadwal_sidang", param: "perkara_id" },
    { key: "QRY_ABT_DATA_MAJELIS", name: "Data Majelis", category: "ABT", table: "perkara_hakim_pn", param: "perkara_id" },
    { key: "QRY_ABT_DATA_PANITERA", name: "Data Panitera", category: "ABT", table: "perkara_panitera_pn", param: "perkara_id" },
    { key: "QRY_ABT_DATA_PUTUSAN", name: "Data Putusan", category: "ABT", table: "perkara_putusan", param: "perkara_id" },
    { key: "QRY_ANTRIAN_JADWAL_SIDANG_PDF_BY_TANGGAL", name: "Jadwal Sidang PDF Berdasarkan Tanggal", category: "Antrian", table: "perkara_jadwal_sidang", param: "tanggal_sidang", filter: "tanggal_sidang = :tanggal_sidang" },
    { key: "QRY_ANTRIAN_JADWAL_SIDANG_BY_RUANG", name: "Jadwal Sidang Berdasarkan Ruang", category: "Antrian", table: "perkara_jadwal_sidang", param: "ruangan", filter: "ruangan = :ruangan" },
  ];

  return required.map((item) => {
    const table = knownTables.has(item.table) ? item.table : "perkara";
    const columns = item.output ?? ["id", "perkara_id", "nomor_perkara", item.param].filter((value, index, arr) => arr.indexOf(value) === index);
    const sql = `SELECT ${columns.map((column) => `\`${column}\``).join(", ")} FROM \`${table}\` WHERE ${item.filter ?? `${item.param} = :${item.param}`} LIMIT 25`;
    return {
      queryKey: item.key,
      queryName: item.name,
      category: item.category,
      shortDescription: `Query dasar untuk ${item.name.toLowerCase()}.`,
      longDescription: `Query dasar ini dibuat dari metadata SIPP sebagai registry awal. Query perlu divalidasi terhadap struktur SIPP aktif sebelum dipakai sebagai query operasional.`,
      businessPurpose: `Mendukung pencarian data ${item.category.toLowerCase()} pada integrasi ALETA x SIPP.`,
      sourceType: "SIPP_METADATA",
      sourceFile: "aleta_sipp_metadata",
      originalSql: sql,
      normalizedSql: normalizeSqlText(sql),
      parameterizedSql: parameterizeSql(sql),
      tablesUsed: [table],
      columnsUsed: columns,
      parameters: extractParametersFromSql(sql),
      outputs: columns.map((name) => ({ name, label: humanizeIdentifier(name), dataType: "text" })),
      relatedVariableCodes: [],
      relatedVariableKeys: [],
      executionMode: "DICTIONARY_ONLY",
      safetyStatus: "NEEDS_REVIEW",
      reviewStatus: "NEEDS_ADMIN_REVIEW",
      confidenceScore: 70,
      riskNotes: "Query dasar dibuat otomatis dari metadata; validasi nama kolom wajib dilakukan sebelum eksekusi.",
      usageNotes: "Dipakai sebagai kandidat registry dan penjelasan kamus, bukan raw SQL bebas.",
      isAiUsable: true,
      isWhatsappUsable: false,
      isPdfUsable: item.category === "Antrian" || item.category === "Persidangan",
    } satisfies RegistryQueryCandidate;
  });
}

async function dictionaryQueryCandidates(db: AletaDatabase, tables: Array<{ table_name: string; human_name: string; category: string }>) {
  const columnMap = await columnsForTables(db, tables.map((table) => table.table_name));
  const candidates: RegistryQueryCandidate[] = [];
  for (const table of tables) {
    const columns = (columnMap.get(table.table_name) ?? []).slice(0, 8).map((column) => column.column_name);
    const selectedColumns = columns.length > 0 ? columns : ["id"];
    const sampleSql = `SELECT ${selectedColumns.map((column) => `\`${column}\``).join(", ")} FROM \`${table.table_name}\` LIMIT 25`;
    candidates.push({
      queryKey: `QRY_DICT_${table.table_name.toUpperCase()}_SAMPLE`.replace(/[^A-Z0-9_]/g, "_"),
      queryName: `Contoh Query ${table.human_name}`,
      category: table.category,
      shortDescription: `Query contoh untuk membaca sampel tabel ${table.table_name}.`,
      longDescription: `Query ini dibuat otomatis dari Kamus Database SIPP untuk membantu penjelasan tabel ${table.table_name}. Statusnya dictionary-only dan tidak menjadi query operasional.`,
      businessPurpose: "Mendukung penjelasan kamus database dan pemetaan tabel/kolom.",
      sourceType: "SIPP_METADATA",
      sourceFile: "aleta_sipp_tables",
      originalSql: sampleSql,
      normalizedSql: normalizeSqlText(sampleSql),
      parameterizedSql: parameterizeSql(sampleSql),
      tablesUsed: [table.table_name],
      columnsUsed: selectedColumns,
      parameters: [],
      outputs: selectedColumns.map((name) => ({ name, label: humanizeIdentifier(name), dataType: "text" })),
      relatedVariableCodes: [],
      relatedVariableKeys: [],
      executionMode: "DICTIONARY_ONLY",
      safetyStatus: "NEEDS_REVIEW",
      reviewStatus: "AUTO_GENERATED",
      confidenceScore: 72,
      riskNotes: "Query contoh dictionary-only. Jangan dijalankan sebagai raw SQL client.",
      usageNotes: "Dipakai untuk dokumentasi metadata dan AI internal.",
      isAiUsable: true,
      isWhatsappUsable: false,
      isPdfUsable: false,
    });
    if (selectedColumns.includes("perkara_id")) {
      const byPerkaraSql = `SELECT ${selectedColumns.map((column) => `\`${column}\``).join(", ")} FROM \`${table.table_name}\` WHERE \`perkara_id\` = :perkara_id LIMIT 25`;
      candidates.push({
        ...candidates[candidates.length - 1],
        queryKey: `QRY_DICT_${table.table_name.toUpperCase()}_BY_PERKARA_ID`.replace(/[^A-Z0-9_]/g, "_"),
        queryName: `${table.human_name} Berdasarkan Perkara`,
        shortDescription: `Query contoh tabel ${table.table_name} dengan filter perkara_id.`,
        originalSql: byPerkaraSql,
        normalizedSql: normalizeSqlText(byPerkaraSql),
        parameterizedSql: parameterizeSql(byPerkaraSql),
        parameters: extractParametersFromSql(byPerkaraSql),
      });
    }
  }
  return candidates;
}

async function scanTextFilesForRegistry(root: string, sourceType: string, prefix: string, knownTables: Set<string>, maxFiles = 6000) {
  const extensions = new Set([".php", ".js", ".ts", ".sql", ".txt", ".rtf", ".html", ".htm", ".dat"]);
  const files: string[] = [];
  async function walk(dir: string) {
    if (files.length >= maxFiles) return;
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!/node_modules|vendor|\.git|cache/i.test(full)) await walk(full);
      } else if (extensions.has(path.extname(entry.name).toLowerCase())) {
        files.push(full);
      }
      if (files.length >= maxFiles) break;
    }
  }
  await walk(root);
  const queries: RegistryQueryCandidate[] = [];
  const placeholders: Array<{ legacyCode: string; sourceType: string; sourceFile: string; context: string }> = [];
  for (const file of files) {
    const info = await stat(file).catch(() => null);
    if (!info || info.size > 1_500_000) continue;
    const text = await readFile(file, "utf8").catch(() => "");
    if (!text) continue;
    for (const snippet of extractSqlSnippetsFromText(text, 20)) {
      queries.push(candidateFromSql({
        prefix,
        title: snippet.title || path.basename(file),
        category: /jadwal|sidang|antrian/i.test(`${file} ${snippet.sql}`) ? "Persidangan" : "Legacy",
        sourceType,
        sourceFile: file,
        sourceLocation: path.relative(root, file).replace(/\\/g, "/"),
        sourceLine: snippet.line,
        sql: snippet.sql,
        knownTables,
      }));
    }
    for (const code of extractLegacyPlaceholders(text)) {
      const index = text.indexOf(code);
      placeholders.push({
        legacyCode: code,
        sourceType,
        sourceFile: file,
        context: text.slice(Math.max(0, index - 100), index + 140).replace(/\s+/g, " ").trim(),
      });
    }
  }
  return { queries, placeholders, scannedFiles: files.length };
}

async function upsertRegistryQuery(db: AletaDatabase, actor: UserPersona, candidate: RegistryQueryCandidate) {
  const now = new Date().toISOString();
  const id = stableId("sipp_qry", candidate.queryKey);
  const existing = await db.queryOne<{ id: string; review_status?: string }>(
    "SELECT id, review_status FROM aleta_sipp_query_registry WHERE query_key = ? LIMIT 1",
    [candidate.queryKey]
  );
  const queryId = existing?.id ?? id;
  const reviewStatus = existing?.review_status === "ADMIN_REVIEWED" ? "ADMIN_REVIEWED" : candidate.reviewStatus;

  await db.run(
    `
    INSERT INTO aleta_sipp_query_registry (
      id, query_key, name, query_name, query_title, category, sub_category, source, business_purpose,
      source_type, source_file, source_location, source_line, short_description, long_description,
      tables_json, output_columns_json, original_sql, normalized_sql, parameterized_sql, sql_hash,
      columns_used_json, parameters_json, outputs_json, related_table_names_json,
      related_variable_codes_json, related_variable_keys_json, execution_mode, security_status,
      review_status, confidence_score, role_scope_json, ai_allowed, whatsapp_allowed, pdf_allowed,
      is_ai_usable, is_whatsapp_usable, is_pdf_usable, risk_notes_json, risk_notes, usage_notes,
      example_params, example_output, is_active, created_by, updated_by, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?::jsonb, ?, ?, ?, ?, ?::jsonb, ?::jsonb, ?::jsonb, ?::jsonb,
      ?::jsonb, ?::jsonb, ?, ?, ?, ?, ?::jsonb, ?, ?, ?, ?, ?, ?, ?::jsonb, ?, ?, ?::jsonb, ?::jsonb, ?, ?, ?, ?, ?)
    ON CONFLICT (query_key) DO UPDATE SET
      name = EXCLUDED.name,
      query_name = CASE WHEN aleta_sipp_query_registry.review_status = 'ADMIN_REVIEWED' THEN aleta_sipp_query_registry.query_name ELSE EXCLUDED.query_name END,
      query_title = CASE WHEN aleta_sipp_query_registry.review_status = 'ADMIN_REVIEWED' THEN aleta_sipp_query_registry.query_title ELSE EXCLUDED.query_title END,
      category = EXCLUDED.category,
      sub_category = EXCLUDED.sub_category,
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
      candidate.queryKey,
      candidate.queryName,
      candidate.queryName,
      candidate.queryName,
      candidate.category,
      candidate.subCategory ?? "",
      candidate.sourceType,
      candidate.businessPurpose,
      candidate.sourceType,
      candidate.sourceFile,
      candidate.sourceLocation ?? "",
      candidate.sourceLine ?? null,
      candidate.shortDescription,
      candidate.longDescription,
      jsonString(candidate.tablesUsed),
      jsonString(candidate.outputs.map((item) => String(item.name ?? item.columnName ?? ""))),
      candidate.originalSql,
      candidate.normalizedSql,
      candidate.parameterizedSql,
      sqlHash(candidate.normalizedSql || candidate.originalSql),
      jsonString(candidate.columnsUsed),
      jsonString(candidate.parameters),
      jsonString(candidate.outputs),
      jsonString(candidate.tablesUsed),
      jsonString(candidate.relatedVariableCodes),
      jsonString(candidate.relatedVariableKeys),
      candidate.executionMode,
      candidate.safetyStatus,
      reviewStatus,
      candidate.confidenceScore,
      jsonString([]),
      candidate.isAiUsable ? 1 : 0,
      candidate.isWhatsappUsable ? 1 : 0,
      candidate.isPdfUsable ? 1 : 0,
      candidate.isAiUsable ? 1 : 0,
      candidate.isWhatsappUsable ? 1 : 0,
      candidate.isPdfUsable ? 1 : 0,
      jsonString(candidate.riskNotes ? [candidate.riskNotes] : []),
      candidate.riskNotes,
      candidate.usageNotes,
      jsonString(candidate.exampleParams ?? {}),
      jsonString(candidate.exampleOutput ?? {}),
      candidate.safetyStatus === "REJECTED_WRITE_QUERY" ? 0 : 1,
      actor.id,
      actor.id,
      now,
      now,
    ]
  );

  for (const [index, parameter] of candidate.parameters.entries()) {
    const name = String(parameter.name ?? "");
    if (!name) continue;
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
      [
        stableId("sipp_qp", candidate.queryKey, name),
        queryId,
        name,
        String(parameter.label ?? humanizeIdentifier(name)),
        String(parameter.type ?? "text"),
        parameter.required === false ? 0 : 1,
        String(parameter.example ?? ""),
        index + 1,
        now,
        now,
      ]
    );
  }

  for (const [index, output] of candidate.outputs.entries()) {
    const columnName = String(output.name ?? output.columnName ?? "");
    if (!columnName) continue;
    await db.run(
      `
      INSERT INTO aleta_sipp_query_outputs (
        id, query_id, column_name, label, data_type, description, sensitive, sort_order, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (query_id, column_name) DO UPDATE SET
        label = EXCLUDED.label,
        data_type = EXCLUDED.data_type,
        description = EXCLUDED.description,
        sensitive = EXCLUDED.sensitive,
        sort_order = EXCLUDED.sort_order,
        updated_at = EXCLUDED.updated_at
      `,
      [
        stableId("sipp_qo", candidate.queryKey, columnName),
        queryId,
        columnName,
        String(output.label ?? humanizeIdentifier(columnName)),
        String(output.dataType ?? "text"),
        String(output.description ?? ""),
        /nama|alamat|nik|telepon|email|hp/i.test(columnName) ? 1 : 0,
        index + 1,
        now,
        now,
      ]
    );
  }

  for (const tableName of candidate.tablesUsed) {
    await db.run(
      `
      INSERT INTO aleta_sipp_query_table_links (
        id, query_id, query_key, table_name, column_names_json, relation_role, confidence_score, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?::jsonb, 'uses', ?, ?, ?)
      ON CONFLICT (query_key, table_name) DO UPDATE SET
        column_names_json = EXCLUDED.column_names_json,
        confidence_score = EXCLUDED.confidence_score,
        updated_at = EXCLUDED.updated_at
      `,
      [stableId("sipp_qtl", candidate.queryKey, tableName), queryId, candidate.queryKey, tableName, jsonString(candidate.columnsUsed), candidate.confidenceScore, now, now]
    );
  }

  for (const legacyCode of candidate.relatedVariableCodes) {
    const variable = await db.queryOne<{ id: string; variable_key: string; modern_key: string }>(
      "SELECT id, variable_key, modern_key FROM aleta_sipp_variables WHERE legacy_code = ? OR variable_key = ? OR modern_key = ? ORDER BY is_active DESC LIMIT 1",
      [legacyCode, knownLegacyVariableKeys[legacyCode]?.key ?? "", knownLegacyVariableKeys[legacyCode]?.key ?? ""]
    );
    const variableKey = variable?.variable_key || variable?.modern_key || knownLegacyVariableKeys[legacyCode]?.key || `##unresolved_${legacyCode.replace(/\D/g, "")}##`;
    await db.run(
      `
      INSERT INTO aleta_sipp_query_variable_links (
        id, query_id, variable_id, query_key, legacy_code, variable_key, mapping_status, source_context, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (query_key, legacy_code, variable_key) DO UPDATE SET
        variable_id = EXCLUDED.variable_id,
        mapping_status = EXCLUDED.mapping_status,
        source_context = EXCLUDED.source_context,
        updated_at = EXCLUDED.updated_at
      `,
      [
        stableId("sipp_qvl", candidate.queryKey, legacyCode, variableKey),
        queryId,
        variable?.id ?? null,
        candidate.queryKey,
        legacyCode,
        variableKey,
        variable ? "MAPPED_TO_QUERY" : "UNRESOLVED",
        candidate.sourceLocation ?? "",
        now,
        now,
      ]
    );
  }

  return queryId;
}

async function upsertRegistryVariable(db: AletaDatabase, actor: UserPersona, candidate: RegistryVariableCandidate) {
  const now = new Date().toISOString();
  const legacyNumber = Number(candidate.legacyCode.replace(/\D/g, "")) || null;
  const existing = await db.queryOne<{ id: string; review_status?: string }>(
    "SELECT id, review_status FROM aleta_sipp_variables WHERE modern_key = ? OR variable_key = ? LIMIT 1",
    [candidate.modernKey, candidate.variableKey]
  );
  const id = existing?.id ?? stableId("sipp_var", candidate.legacySource, candidate.legacyCode || "", candidate.modernKey || candidate.variableKey);
  const reviewStatus = existing?.review_status === "ADMIN_REVIEWED" ? "ADMIN_REVIEWED" : candidate.reviewStatus;
  await db.run(
    `
    INSERT INTO aleta_sipp_variables (
      id, variable_key, legacy_source, legacy_code, legacy_number, modern_key, display_name,
      short_description, long_description, description, category, data_type, variable_type,
      source_type, source_table, source_column, query_id, source_query_key, source_sql_fragment,
      placeholder_pattern, template_files_json, transform_key, example_value, fallback_value,
      fallback_strategy, required, is_repeating, repeat_group, mapping_status, review_status,
      confidence_score, risk_notes, usage_notes, status, sensitive, is_active, created_by,
      updated_by, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'text', ?, ?, ?, ?, NULL, ?, ?, ?, ?::jsonb, '', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
    ON CONFLICT (modern_key) DO UPDATE SET
      variable_key = EXCLUDED.variable_key,
      legacy_source = EXCLUDED.legacy_source,
      legacy_code = EXCLUDED.legacy_code,
      legacy_number = EXCLUDED.legacy_number,
      display_name = CASE WHEN aleta_sipp_variables.review_status = 'ADMIN_REVIEWED' THEN aleta_sipp_variables.display_name ELSE EXCLUDED.display_name END,
      short_description = CASE WHEN aleta_sipp_variables.review_status = 'ADMIN_REVIEWED' THEN aleta_sipp_variables.short_description ELSE EXCLUDED.short_description END,
      long_description = CASE WHEN aleta_sipp_variables.review_status = 'ADMIN_REVIEWED' THEN aleta_sipp_variables.long_description ELSE EXCLUDED.long_description END,
      description = CASE WHEN aleta_sipp_variables.review_status = 'ADMIN_REVIEWED' THEN aleta_sipp_variables.description ELSE EXCLUDED.description END,
      category = EXCLUDED.category,
      variable_type = EXCLUDED.variable_type,
      source_type = EXCLUDED.source_type,
      source_table = EXCLUDED.source_table,
      source_column = EXCLUDED.source_column,
      source_query_key = EXCLUDED.source_query_key,
      source_sql_fragment = EXCLUDED.source_sql_fragment,
      placeholder_pattern = EXCLUDED.placeholder_pattern,
      template_files_json = EXCLUDED.template_files_json,
      example_value = EXCLUDED.example_value,
      fallback_value = EXCLUDED.fallback_value,
      fallback_strategy = EXCLUDED.fallback_strategy,
      required = EXCLUDED.required,
      is_repeating = EXCLUDED.is_repeating,
      repeat_group = EXCLUDED.repeat_group,
      mapping_status = EXCLUDED.mapping_status,
      review_status = CASE WHEN aleta_sipp_variables.review_status = 'ADMIN_REVIEWED' THEN aleta_sipp_variables.review_status ELSE EXCLUDED.review_status END,
      confidence_score = EXCLUDED.confidence_score,
      risk_notes = EXCLUDED.risk_notes,
      usage_notes = EXCLUDED.usage_notes,
      status = EXCLUDED.status,
      sensitive = EXCLUDED.sensitive,
      updated_by = EXCLUDED.updated_by,
      updated_at = EXCLUDED.updated_at
    `,
    [
      id,
      candidate.variableKey,
      candidate.legacySource,
      candidate.legacyCode,
      legacyNumber,
      candidate.modernKey,
      candidate.displayName,
      candidate.shortDescription,
      candidate.longDescription,
      candidate.shortDescription,
      candidate.category,
      candidate.variableType,
      candidate.sourceType,
      candidate.sourceTable,
      candidate.sourceColumn,
      candidate.sourceQueryKey,
      candidate.sourceSqlFragment,
      candidate.placeholderPattern,
      jsonString(candidate.templateFiles),
      candidate.exampleValue,
      candidate.fallbackValue,
      candidate.fallbackStrategy,
      candidate.required ? 1 : 0,
      candidate.isRepeating ? 1 : 0,
      candidate.repeatGroup,
      candidate.mappingStatus,
      reviewStatus,
      candidate.confidenceScore,
      candidate.riskNotes,
      candidate.usageNotes,
      candidate.mappingStatus,
      /nama|alamat|nik|telepon|email|hp/i.test(`${candidate.displayName} ${candidate.sourceColumn}`) ? 1 : 0,
      actor.id,
      actor.id,
      now,
      now,
    ]
  );
  return id;
}

const ALETA_SIPP_QUERY_REGISTRY_SELECT = `
  id, query_key, name, query_name, query_title, category, sub_category, source, business_purpose,
  source_type, source_file, source_location, source_line, short_description, long_description,
  tables_json, output_columns_json, original_sql, normalized_sql, parameterized_sql, sql_hash,
  columns_used_json, parameters_json, outputs_json, related_table_names_json,
  related_variable_codes_json, related_variable_keys_json, execution_mode, security_status,
  review_status, confidence_score, role_scope_json, ai_allowed, whatsapp_allowed, pdf_allowed,
  is_ai_usable, is_whatsapp_usable, is_pdf_usable, risk_notes_json, risk_notes, usage_notes,
  example_params, example_output, is_active, created_at, updated_at
`;

const ALETA_SIPP_VARIABLE_REGISTRY_SELECT = `
  id, variable_key, legacy_source, legacy_code, legacy_number, modern_key, display_name,
  short_description, long_description, description, category, data_type, variable_type,
  source_type, source_table, source_column, query_id, source_query_key, source_sql_fragment,
  placeholder_pattern, template_files_json, transform_key, example_value, fallback_value,
  fallback_strategy, required, is_repeating, repeat_group, mapping_status, review_status,
  confidence_score, risk_notes, usage_notes, status, sensitive, is_active, created_at, updated_at
`;

function parseRegistryContinueToken(value: string | undefined, fallbackPrefix: string) {
  if (!value?.trim()) return null;
  const [jobId, offset] = value.split(":");
  if (!jobId || !offset) return null;
  return { jobId, offset: Number(offset) || 0, prefix: fallbackPrefix };
}

function registryBatch(input: { batchSize?: number; offset?: number; continueToken?: string }, fallbackPrefix: string) {
  const token = parseRegistryContinueToken(input.continueToken, fallbackPrefix);
  const hasExplicitBatch = Number.isFinite(Number(input.batchSize)) && Number(input.batchSize) > 0;
  const batchSize = hasExplicitBatch ? Math.max(1, Math.min(1000, Number(input.batchSize))) : Number.MAX_SAFE_INTEGER;
  const offset = Math.max(0, token?.offset ?? Number(input.offset || 0));
  const jobId = token?.jobId || stableId(fallbackPrefix, String(Date.now()));
  return { batchSize, offset, jobId, isContinuation: Boolean(token), hasExplicitBatch };
}

function inferVariableCategory(displayName: string, sourceTable: string, sourceColumn: string) {
  const lower = `${displayName} ${sourceTable} ${sourceColumn}`.toLowerCase();
  if (/pihak|penggugat|tergugat|pemohon|termohon|ktp|nik|alamat/.test(lower)) return "Identitas Pihak";
  if (/nikah|perkawinan|akta|kua|cerai|talak/.test(lower)) return "Data Perkawinan";
  if (/sidang|agenda|ruang|majelis|hakim|panitera/.test(lower)) return "Persidangan";
  if (/putusan|amar|minutasi/.test(lower)) return "Putusan";
  if (/biaya|panjar|radius/.test(lower)) return "Biaya Perkara";
  if (/perkara|nomor_perkara|jenis_perkara/.test(lower)) return "Perkara";
  return "ABT Legacy";
}

function abtVariableSqlQueryKey(legacyCode: string, displayName: string, sql: string) {
  return makeQueryKey("QRY_ABT_XLS", "ABT Variable", `${legacyCode} ${displayName}`.trim() || "ABT Variable", sql);
}

function variableCandidateFromAbtRow(row: Record<string, unknown>, rowNumber: number): RegistryVariableCandidate | null {
  const legacyCode = legacyCodeFromNumber(row.no_var as string | number | null | undefined) || legacyCodeFromNumber(row.legacy_code as string | number | null | undefined);
  if (!legacyCode) return null;
  const displayName = normalizeWhitespace(String(row.nama ?? row.name ?? legacyCode), 160) || legacyCode;
  const sourceTable = String(row.data_tabel ?? row.source_table ?? "").trim();
  const sourceColumn = String(row.data_kolom ?? row.source_column ?? "").trim();
  const dataType = String(row.data_type ?? "").trim();
  const sourceSqlFragment = normalizeSqlText(String(row.sql_query ?? ""));
  const known = knownLegacyVariableKeys[legacyCode];
  const modernKey = known?.key ?? modernKeyFromLabel(displayName, legacyCode);
  const sourceType = inferVariableSourceType(dataType, sourceTable, sourceSqlFragment);
  const category = known?.category ?? inferVariableCategory(displayName, sourceTable, sourceColumn);
  const variableType = inferVariableType(dataType, sourceTable, sourceSqlFragment);
  const mappingStatus = sourceTable && sourceColumn ? "MAPPED_TO_TABLE_COLUMN" : sourceSqlFragment ? "MAPPED_TO_QUERY" : "UNRESOLVED";
  const confidenceScore = mappingStatus === "MAPPED_TO_TABLE_COLUMN" ? 82 : mappingStatus === "MAPPED_TO_QUERY" ? 68 : 38;
  return {
    legacySource: "ABT_XLS",
    legacyCode,
    variableKey: modernKey,
    modernKey,
    displayName,
    shortDescription: sourceTable && sourceColumn
      ? `${displayName} diambil dari ${sourceTable}.${sourceColumn}.`
      : `${displayName} diinventarisasi dari abt_variabel.xls.`,
    longDescription:
      `Variabel legacy ${legacyCode} berasal dari baris ${rowNumber} file abt_variabel.xls. Mapping awal dibuat otomatis dan perlu review admin sebelum dipakai untuk dokumen resmi.`,
    category,
    variableType,
    sourceType,
    sourceTable,
    sourceColumn,
    sourceQueryKey: sourceSqlFragment ? abtVariableSqlQueryKey(legacyCode, displayName, sourceSqlFragment) : "",
    sourceSqlFragment,
    placeholderPattern: legacyCode,
    templateFiles: [DEFAULT_PATHS.abtXls],
    exampleValue: String(row.default_data ?? ""),
    fallbackValue: String(row.default_data ?? ""),
    fallbackStrategy: String(row.referensi ?? "") || (mappingStatus === "UNRESOLVED" ? "ADMIN_REVIEW_REQUIRED" : "SIPP_FIELD"),
    required: String(row.locked ?? "").trim() === "1",
    isRepeating: String(row.multi_sidang ?? "").trim() === "1",
    repeatGroup: String(row.urutan_data ?? "").trim(),
    mappingStatus,
    reviewStatus: mappingStatus === "UNRESOLVED" ? "NEEDS_ADMIN_REVIEW" : "AUTO_IMPORTED",
    confidenceScore,
    riskNotes: mappingStatus === "UNRESOLVED" ? "Mapping belum menunjuk tabel/kolom/query yang jelas." : "Mapping otomatis dari XLS ABT; validasi terhadap struktur SIPP aktif tetap diperlukan.",
    usageNotes: "Dibaca dari metadata ALETA setelah proses import admin, bukan parsing XLS saat halaman dibuka.",
  };
}

function variableCandidateFromPlaceholder(input: {
  legacyCode: string;
  sourceType: string;
  sourceFile: string;
  context: string;
}): RegistryVariableCandidate {
  const known = knownLegacyVariableKeys[input.legacyCode];
  const modernKey = known?.key ?? `##unresolved_${input.legacyCode.replace(/\D/g, "")}##`;
  const displayName = known?.name ?? `Placeholder Legacy ${input.legacyCode}`;
  return {
    legacySource: input.sourceType,
    legacyCode: input.legacyCode,
    variableKey: modernKey,
    modernKey,
    displayName,
    shortDescription: `${displayName} ditemukan pada template/source legacy.`,
    longDescription: `Placeholder ${input.legacyCode} ditemukan pada ${input.sourceFile}. Detail konteks disimpan agar admin bisa memetakan ke Variable Registry.`,
    category: known?.category ?? "Placeholder Legacy",
    variableType: "UNKNOWN",
    sourceType: "TEMPLATE_PLACEHOLDER",
    sourceTable: "",
    sourceColumn: "",
    sourceQueryKey: "",
    sourceSqlFragment: "",
    placeholderPattern: input.legacyCode,
    templateFiles: [input.sourceFile],
    exampleValue: "",
    fallbackValue: "",
    fallbackStrategy: "ADMIN_REVIEW_REQUIRED",
    required: false,
    isRepeating: false,
    repeatGroup: "",
    mappingStatus: known ? "PARTIAL" : "UNRESOLVED",
    reviewStatus: known ? "AUTO_IMPORTED" : "NEEDS_ADMIN_REVIEW",
    confidenceScore: known ? 70 : 25,
    riskNotes: known ? "Placeholder dikenali dari alias legacy awal." : "Placeholder belum ditemukan di XLS ABT dan perlu pemetaan admin.",
    usageNotes: input.context,
  };
}

function queryCandidateFromStoredRow(row: AletaSippQueryRegistryRow, knownTables: Set<string>): RegistryQueryCandidate {
  const normalizedSql = normalizeSqlText(row.normalized_sql || row.original_sql);
  const safety = safetyForSql(normalizedSql);
  const tablesUsed = extractTablesFromSql(normalizedSql, knownTables);
  const columnsUsed = extractColumnsFromSql(normalizedSql);
  const parameters = extractParametersFromSql(normalizedSql);
  const relatedVariableCodes = extractLegacyPlaceholders(`${row.original_sql} ${row.normalized_sql}`);
  return {
    queryKey: row.query_key,
    queryName: row.query_name || row.name,
    category: row.category,
    subCategory: row.sub_category,
    shortDescription: row.short_description || `Query registry ${row.query_key}.`,
    longDescription: row.long_description || row.short_description || `Query registry ${row.query_key}.`,
    businessPurpose: row.business_purpose || `Mendukung akses metadata ${row.category}.`,
    sourceType: row.source_type || row.source || "ALETA_METADATA",
    sourceFile: row.source_file || row.source || "",
    sourceLocation: row.source_location || "",
    sourceLine: row.source_line ?? null,
    originalSql: row.original_sql,
    normalizedSql,
    parameterizedSql: parameterizeSql(normalizedSql),
    tablesUsed: tablesUsed.length ? tablesUsed : asStringArray(row.tables_json),
    columnsUsed: columnsUsed.length ? columnsUsed : asStringArray(row.columns_used_json),
    parameters,
    outputs: columnsUsed.slice(0, 20).map((name) => ({ name, label: humanizeIdentifier(name), dataType: "text" })),
    relatedVariableCodes,
    relatedVariableKeys: relatedVariableCodes.map((code) => knownLegacyVariableKeys[code]?.key ?? `##unresolved_${code.replace(/\D/g, "")}##`),
    executionMode: safety.executionMode,
    safetyStatus: safety.safetyStatus,
    reviewStatus: row.review_status === "ADMIN_REVIEWED" ? "ADMIN_REVIEWED" : safety.reviewStatus,
    confidenceScore: safety.confidenceScore,
    riskNotes: safety.riskNotes,
    usageNotes: row.usage_notes || "Analisis ulang otomatis dari metadata query registry.",
    exampleParams: Object.fromEntries(parameters.map((param) => [String(param.name), param.type === "date" ? "2026-01-01" : "contoh"])),
    exampleOutput: asRecord(row.example_output),
    isAiUsable: safety.safetyStatus !== "REJECTED_WRITE_QUERY",
    isWhatsappUsable: row.is_whatsapp_usable === 1 || row.whatsapp_allowed === 1,
    isPdfUsable: row.is_pdf_usable === 1 || row.pdf_allowed === 1,
  };
}

async function collectQueryRegistryCandidates(db: AletaDatabase) {
  const tables = await listKnownSippTables(db);
  const knownTables = new Set(tables.map((table) => table.table_name));
  const candidates: RegistryQueryCandidate[] = [];
  const sourceCounts: Record<string, number> = {};
  const scanned: Record<string, number> = {};
  const add = (items: RegistryQueryCandidate[]) => {
    for (const item of items) {
      candidates.push(item);
      sourceCounts[item.sourceType] = (sourceCounts[item.sourceType] ?? 0) + 1;
    }
  };

  add(requiredBaseQueryDefinitions(knownTables));
  add(await dictionaryQueryCandidates(db, tables));

  const abtRows = await readAbtXlsRows().catch(() => []);
  const abtSqlCandidates: RegistryQueryCandidate[] = [];
  for (const [index, row] of abtRows.entries()) {
    const sourceSql = normalizeSqlText(String(row.sql_query ?? ""));
    if (!sourceSql) continue;
    const legacyCode = legacyCodeFromNumber(row.no_var as string | number | null | undefined);
    const displayName = normalizeWhitespace(String(row.nama ?? (legacyCode || `Variabel ${index + 1}`)), 160);
    abtSqlCandidates.push(candidateFromSql({
      prefix: "QRY_ABT_XLS",
      title: `${legacyCode} ${displayName}`.trim(),
      category: "ABT Variable",
      sourceType: "ABT_XLS",
      sourceFile: DEFAULT_PATHS.abtXls,
      sourceLocation: `abt_variabel row ${index + 2}`,
      sourceLine: index + 2,
      sql: sourceSql,
      knownTables,
      relatedVariableCodes: legacyCode ? [legacyCode] : [],
    }));
  }
  add(abtSqlCandidates);

  const wordText = await readDocxText(DEFAULT_PATHS.wordQueries).catch(() => "");
  if (wordText) {
    add(
      extractSqlSnippetsFromText(wordText, 2000).map((snippet) =>
        candidateFromSql({
          prefix: "QRY_WORD_DOCX",
          title: snippet.title,
          category: "Word Query",
          sourceType: "WORD_QUERY_DOCX",
          sourceFile: DEFAULT_PATHS.wordQueries,
          sourceLocation: `line ${snippet.line}`,
          sourceLine: snippet.line,
          sql: snippet.sql,
          knownTables,
        })
      )
    );
  }

  for (const source of [
    { root: DEFAULT_PATHS.legacyAbtApp, sourceType: "ABT_LEGACY_APP", prefix: "QRY_ABT_LEGACY" },
    { root: DEFAULT_PATHS.pendukung2018, sourceType: "PENDUKUNG2018", prefix: "QRY_PENDUKUNG2018" },
    { root: DEFAULT_PATHS.antrianApp, sourceType: "ANTRIAN_SIDANG", prefix: "QRY_ANTRIAN" },
  ]) {
    const result = await scanTextFilesForRegistry(source.root, source.sourceType, source.prefix, knownTables).catch(() => ({
      queries: [] as RegistryQueryCandidate[],
      placeholders: [] as Array<{ legacyCode: string; sourceType: string; sourceFile: string; context: string }>,
      scannedFiles: 0,
    }));
    scanned[source.sourceType] = result.scannedFiles;
    add(result.queries);
  }

  const seen = new Set<string>();
  const deduped = candidates.filter((candidate) => {
    const key = `${candidate.queryKey}:${sqlHash(candidate.normalizedSql || candidate.originalSql)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return { candidates: deduped, sourceCounts, scanned, tableCount: tables.length, abtRowCount: abtRows.length };
}

async function collectVariableRegistryCandidates() {
  const candidates = new Map<string, RegistryVariableCandidate>();
  const templateLinks: Array<{ legacyCode: string; variableKey: string; sourceType: string; sourceFile: string; sourceLocation: string; context: string }> = [];
  const unresolved: Array<{ legacyCode: string; legacyNumber: number | null; sourceType: string; sourceFile: string; sourceLocation: string; context: string; suggestedVariableKey: string }> = [];
  const sourceCounts: Record<string, number> = {};
  const scanned: Record<string, number> = {};

  const abtRows = await readAbtXlsRows().catch(() => []);
  for (const [index, row] of abtRows.entries()) {
    const candidate = variableCandidateFromAbtRow(row, index + 2);
    if (!candidate) continue;
    candidates.set(candidate.modernKey, candidate);
    sourceCounts[candidate.legacySource] = (sourceCounts[candidate.legacySource] ?? 0) + 1;
    templateLinks.push({
      legacyCode: candidate.legacyCode,
      variableKey: candidate.variableKey,
      sourceType: "ABT_XLS",
      sourceFile: DEFAULT_PATHS.abtXls,
      sourceLocation: `abt_variabel row ${index + 2}`,
      context: candidate.shortDescription,
    });
  }

  const wordText = await readDocxText(DEFAULT_PATHS.wordQueries).catch(() => "");
  for (const code of extractLegacyPlaceholders(wordText)) {
    const candidate = candidates.get(knownLegacyVariableKeys[code]?.key ?? `##unresolved_${code.replace(/\D/g, "")}##`) ??
      variableCandidateFromPlaceholder({ legacyCode: code, sourceType: "WORD_QUERY_DOCX", sourceFile: DEFAULT_PATHS.wordQueries, context: "Placeholder ditemukan pada dokumen query Word." });
    candidates.set(candidate.modernKey, candidate);
    sourceCounts.WORD_QUERY_DOCX = (sourceCounts.WORD_QUERY_DOCX ?? 0) + 1;
    templateLinks.push({ legacyCode: code, variableKey: candidate.variableKey, sourceType: "WORD_QUERY_DOCX", sourceFile: DEFAULT_PATHS.wordQueries, sourceLocation: "", context: candidate.usageNotes });
  }

  for (const source of [
    { root: DEFAULT_PATHS.legacyAbtApp, sourceType: "ABT_LEGACY_APP", prefix: "QRY_ABT_LEGACY" },
    { root: DEFAULT_PATHS.pendukung2018, sourceType: "PENDUKUNG2018", prefix: "QRY_PENDUKUNG2018" },
    { root: DEFAULT_PATHS.antrianApp, sourceType: "ANTRIAN_SIDANG", prefix: "QRY_ANTRIAN" },
  ]) {
    const result = await scanTextFilesForRegistry(source.root, source.sourceType, source.prefix, new Set()).catch(() => ({
      queries: [] as RegistryQueryCandidate[],
      placeholders: [] as Array<{ legacyCode: string; sourceType: string; sourceFile: string; context: string }>,
      scannedFiles: 0,
    }));
    scanned[source.sourceType] = result.scannedFiles;
    for (const item of result.placeholders) {
      const knownKey = knownLegacyVariableKeys[item.legacyCode]?.key ?? `##unresolved_${item.legacyCode.replace(/\D/g, "")}##`;
      const candidate = candidates.get(knownKey) ?? variableCandidateFromPlaceholder(item);
      candidates.set(candidate.modernKey, candidate);
      sourceCounts[item.sourceType] = (sourceCounts[item.sourceType] ?? 0) + 1;
      templateLinks.push({
        legacyCode: item.legacyCode,
        variableKey: candidate.variableKey,
        sourceType: item.sourceType,
        sourceFile: item.sourceFile,
        sourceLocation: "",
        context: item.context,
      });
      if (candidate.mappingStatus === "UNRESOLVED") {
        unresolved.push({
          legacyCode: item.legacyCode,
          legacyNumber: Number(item.legacyCode.replace(/\D/g, "")) || null,
          sourceType: item.sourceType,
          sourceFile: item.sourceFile,
          sourceLocation: "",
          context: item.context,
          suggestedVariableKey: candidate.variableKey,
        });
      }
    }
  }

  return { candidates: Array.from(candidates.values()), templateLinks, unresolved, sourceCounts, scanned, abtRowCount: abtRows.length };
}

async function upsertVariableTemplateLink(
  db: AletaDatabase,
  variableId: string | null,
  link: { legacyCode: string; variableKey: string; sourceType: string; sourceFile: string; sourceLocation: string; context: string }
) {
  const now = new Date().toISOString();
  await db.run(
    `
    INSERT INTO aleta_sipp_variable_template_links (
      id, variable_id, legacy_code, variable_key, source_type, source_file, source_location, usage_context, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (legacy_code, variable_key, source_file, source_location) DO UPDATE SET
      variable_id = EXCLUDED.variable_id,
      source_type = EXCLUDED.source_type,
      usage_context = EXCLUDED.usage_context,
      updated_at = EXCLUDED.updated_at
    `,
    [
      stableId("sipp_vtl", link.legacyCode, link.variableKey, link.sourceFile, link.sourceLocation),
      variableId,
      link.legacyCode,
      link.variableKey,
      link.sourceType,
      link.sourceFile,
      link.sourceLocation,
      link.context.slice(0, 2000),
      now,
      now,
    ]
  );
}

async function upsertUnresolvedPlaceholder(
  db: AletaDatabase,
  item: { legacyCode: string; legacyNumber: number | null; sourceType: string; sourceFile: string; sourceLocation: string; context: string; suggestedVariableKey: string }
) {
  const now = new Date().toISOString();
  await db.run(
    `
    INSERT INTO aleta_sipp_unresolved_placeholders (
      id, legacy_code, legacy_number, source_type, source_file, source_location, context_text, suggested_variable_key, status, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'UNRESOLVED', ?, ?)
    ON CONFLICT (legacy_code, source_file, source_location) DO UPDATE SET
      context_text = EXCLUDED.context_text,
      suggested_variable_key = EXCLUDED.suggested_variable_key,
      updated_at = EXCLUDED.updated_at
    `,
    [
      stableId("sipp_unresolved", item.legacyCode, item.sourceFile, item.sourceLocation),
      item.legacyCode,
      item.legacyNumber,
      item.sourceType,
      item.sourceFile,
      item.sourceLocation,
      item.context.slice(0, 2000),
      item.suggestedVariableKey,
      now,
      now,
    ]
  );
}

function mapTableRow(row: AletaSippTableRow) {
  return {
    id: row.id,
    name: row.table_name,
    tableName: row.table_name,
    humanName: row.human_name,
    category: row.category,
    priority: row.priority,
    shortDescription: row.short_description,
    longDescription: row.long_description,
    functionInCaseProcess: row.function_in_case_process,
    tableKind: row.table_kind,
    riskNotes: asStringArray(row.risk_notes),
    exampleUsage: row.example_usage,
    exampleQueryKey: row.example_query_key,
    businessFunction: row.business_function ?? row.function_in_case_process,
    mainColumnsSummary: row.main_columns_summary ?? "",
    relationSummary: row.relation_summary ?? "",
    usageExamples: asStringArray(row.usage_examples),
    dataQualityNotes: row.data_quality_notes ?? "",
    analysisStatus: row.analysis_status ?? "UNKNOWN",
    confidenceScore: numericValue(row.confidence_score),
    reviewStatus: row.review_status ?? "NEEDS_ADMIN_REVIEW",
    reviewNotes: row.review_notes ?? "",
    analyzedAt: row.analyzed_at ?? null,
    reviewedAt: row.reviewed_at ?? null,
    reviewedBy: row.reviewed_by ?? null,
    columnCount: countValue({ count: row.column_count }),
    relationCount: countValue({ count: row.relation_count }),
    isActive: row.is_active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapColumnRow(row: AletaSippColumnRow) {
  return {
    id: row.id,
    tableId: row.table_id,
    tableName: row.table_name,
    columnName: row.column_name,
    humanName: row.human_name,
    dataType: row.data_type,
    isNullable: row.is_nullable === 1,
    isPrimaryKey: row.is_primary_key === 1,
    isIndexed: row.is_indexed === 1,
    description: row.description,
    exampleValue: row.example_value,
    relationHint: row.relation_hint,
    queryUsage: asObjectArray(row.query_usage_json),
    qualityNotes: row.quality_notes,
    defaultValue: row.default_value ?? "",
    usageNotes: row.usage_notes ?? "",
    analysisStatus: row.analysis_status ?? "UNKNOWN",
    confidenceScore: numericValue(row.confidence_score),
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const TABLE_HUMAN_NAME_OVERRIDES: Record<string, string> = {
  perkara: "Data Induk Perkara",
  perkara_hakim_pn: "Majelis Hakim/Hakim Tunggal Perkara",
  perkara_jadwal_sidang: "Jadwal Persidangan Perkara",
  perkara_court_calendar: "Kalender Persidangan Perkara",
  perkara_panitera_pn: "Panitera Pengganti Perkara",
  perkara_jurusita: "Jurusita/Jurusita Pengganti Perkara",
  perkara_putusan: "Putusan Perkara",
  perkara_penetapan: "Penetapan Perkara",
  perkara_mediasi: "Data Mediasi Perkara",
  perkara_jadwal_mediasi: "Jadwal Mediasi Perkara",
  perkara_biaya: "Rincian Biaya Perkara",
  perkara_akta_cerai: "Akta Cerai Perkara",
  perkara_pihak1: "Pihak Pertama Perkara",
  perkara_pihak2: "Pihak Kedua Perkara",
  perkara_pihak3: "Pihak Ketiga Perkara",
  perkara_pihak4: "Pihak Keempat Perkara",
  perkara_pihak5: "Pihak Kelima Perkara",
  pihak: "Master Identitas Pihak",
  agama: "Referensi Agama",
  kabupaten: "Referensi Kabupaten/Kota",
  pengadilan_negeri: "Referensi Pengadilan Negeri",
  dirput_antrian: "Antrian Direktori Putusan",
  dirput_dokumen: "Dokumen Direktori Putusan",
};

const TECHNICAL_TERM_LABELS: Record<string, string> = {
  id: "ID",
  pn: "Pengadilan",
  perkara: "Perkara",
  pihak: "Pihak",
  hakim: "Hakim",
  panitera: "Panitera",
  jurusita: "Jurusita",
  putusan: "Putusan",
  penetapan: "Penetapan",
  jadwal: "Jadwal",
  sidang: "Sidang",
  mediasi: "Mediasi",
  biaya: "Biaya",
  ecourt: "e-Court",
  e_court: "e-Court",
  dirput: "Direktori Putusan",
  sys: "Sistem",
  ref: "Referensi",
  log: "Log",
  kabupaten: "Kabupaten/Kota",
};

function titleFromIdentifier(value: string) {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => TECHNICAL_TERM_LABELS[part.toLowerCase()] ?? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function tableHasColumn(columns: AletaSippColumnRow[], ...names: string[]) {
  const set = new Set(columns.map((column) => column.column_name.toLowerCase()));
  return names.some((name) => set.has(name.toLowerCase()));
}

function importantColumns(columns: AletaSippColumnRow[], limit = 8) {
  const priority = [
    "perkara_id",
    "nomor_perkara",
    "pihak_id",
    "nama",
    "nama_pihak",
    "tanggal_pendaftaran",
    "tanggal_sidang",
    "tanggal_putusan",
    "agenda",
    "aktif",
    "status",
    "created_at",
    "updated_at",
  ];
  const ordered = [
    ...priority.flatMap((name) => columns.filter((column) => column.column_name.toLowerCase() === name)),
    ...columns.filter((column) => !priority.includes(column.column_name.toLowerCase())),
  ];
  return Array.from(new Map(ordered.map((column) => [column.column_name, column])).values()).slice(0, limit);
}

function inferDictionaryCategory(tableName: string, columns: AletaSippColumnRow[]) {
  const name = tableName.toLowerCase();
  if (name === "perkara") return "Perkara";
  if (name.includes("pihak") || name === "pihak" || tableHasColumn(columns, "pihak_id")) return "Pihak";
  if (name.includes("hakim")) return "Majelis Hakim";
  if (name.includes("panitera")) return "Panitera";
  if (name.includes("jurusita")) return "Jurusita";
  if (name.includes("jadwal_sidang") || name.includes("sidang") || name.includes("court_calendar")) return "Persidangan";
  if (name.includes("putusan") || name.includes("dirput")) return "Putusan";
  if (name.includes("penetapan")) return "Penetapan";
  if (name.includes("mediasi") || name.includes("mediator")) return "Mediasi";
  if (name.includes("biaya") || name.includes("keuangan")) return "Biaya Perkara";
  if (name.includes("ecourt") || name.includes("e_court")) return "e-Court";
  if (name.includes("dokumen") || name.includes("file") || name.includes("arsip")) return "Dokumen";
  if (name.includes("akta_cerai")) return "Akta Cerai";
  if (name.includes("eksekusi")) return "Eksekusi";
  if (name.includes("antrian")) return "Antrian";
  if (name.startsWith("ref") || name.includes("jenis") || name.includes("status") || ["agama", "kabupaten", "proses"].includes(name)) return "Referensi";
  if (name.startsWith("sys") || name.includes("user") || name.includes("hak_akses")) return "Sistem";
  if (name.includes("log") || name.includes("history") || name.includes("histori")) return "Log";
  if (name.includes("config") || name.includes("setting") || name.includes("konfigurasi")) return "Konfigurasi";
  if (tableHasColumn(columns, "perkara_id", "nomor_perkara")) return "Perkara";
  return "Lainnya";
}

function priorityFromCategory(category: string) {
  if (["Perkara", "Pihak", "Persidangan", "Putusan", "Penetapan"].includes(category)) return 1;
  if (["Majelis Hakim", "Panitera", "Jurusita", "Mediasi", "Biaya Perkara", "e-Court", "Dokumen", "Akta Cerai", "Eksekusi"].includes(category)) return 2;
  return 3;
}

function inferHumanTableName(tableName: string, category: string) {
  if (TABLE_HUMAN_NAME_OVERRIDES[tableName]) return TABLE_HUMAN_NAME_OVERRIDES[tableName];
  const lower = tableName.toLowerCase();
  if (lower.startsWith("ref_")) return `Referensi ${titleFromIdentifier(tableName.replace(/^ref_/, ""))}`;
  if (lower.startsWith("sys_")) return `Data Sistem ${titleFromIdentifier(tableName.replace(/^sys_/, ""))}`;
  if (lower.startsWith("log_")) return `Log ${titleFromIdentifier(tableName.replace(/^log_/, ""))}`;
  if (lower.startsWith("dirput_")) return `Direktori Putusan ${titleFromIdentifier(tableName.replace(/^dirput_/, ""))}`;
  if (lower.startsWith("perkara_")) return `${titleFromIdentifier(tableName.replace(/^perkara_/, ""))} Perkara`;
  if (category === "Referensi") return `Referensi ${titleFromIdentifier(tableName)}`;
  if (category === "Sistem") return `Data Sistem ${titleFromIdentifier(tableName)}`;
  if (category === "Log") return `Log ${titleFromIdentifier(tableName)}`;
  return titleFromIdentifier(tableName);
}

function inferColumnHumanName(columnName: string) {
  const lower = columnName.toLowerCase();
  if (lower === "perkara_id") return "ID Internal Perkara";
  if (lower === "nomor_perkara") return "Nomor Perkara";
  if (lower === "pihak_id") return "ID Internal Pihak";
  if (lower === "tanggal_sidang") return "Tanggal Sidang";
  if (lower === "tanggal_putusan") return "Tanggal Putusan";
  if (lower === "tanggal_pendaftaran") return "Tanggal Pendaftaran";
  if (lower === "created_at") return "Waktu Dibuat";
  if (lower === "updated_at") return "Waktu Diperbarui";
  if (lower === "aktif") return "Status Aktif";
  return titleFromIdentifier(columnName);
}

function describeColumn(tableName: string, column: AletaSippColumnRow, relations: AletaSippRelationRow[]) {
  const lower = column.column_name.toLowerCase();
  const relation = relations.find((item) => item.source_column === column.column_name);
  if (lower === "perkara_id") {
    return {
      description:
        "Kolom ini adalah identitas internal perkara di database SIPP. Kolom ini biasanya dipakai untuk menghubungkan tabel ini dengan tabel induk `perkara` dan tidak boleh disamakan dengan `nomor_perkara`.",
      usageNotes: "Gunakan untuk join teknis antar tabel SIPP, bukan untuk ditampilkan sebagai nomor perkara kepada pengguna.",
      analysisStatus: "ANALYZED",
      confidenceScore: 95,
    };
  }
  if (lower === "nomor_perkara") {
    return {
      description: "Kolom ini menyimpan nomor perkara yang dikenal pengguna dan biasa dipakai sebagai parameter pencarian perkara.",
      usageNotes: "Gunakan sebagai input pencarian, tetapi tetap join melalui `perkara_id` bila mengambil data turunan.",
      analysisStatus: "ANALYZED",
      confidenceScore: 95,
    };
  }
  if (relation) {
    return {
      description: `Kolom ini diduga menjadi relasi dari tabel \`${tableName}\` ke tabel \`${relation.target_table}\`. Dugaan dibuat dari pola nama kolom dan struktur metadata.`,
      usageNotes: `Gunakan sebagai join ke \`${relation.target_table}.${relation.target_column}\` setelah divalidasi terhadap struktur SIPP aktif.`,
      analysisStatus: relation.confidence === "high" ? "ANALYZED" : "PARTIAL",
      confidenceScore: relation.confidence === "high" ? 88 : 68,
    };
  }
  if (lower.includes("tanggal")) {
    return {
      description: "Kolom tanggal yang dipakai untuk mencatat waktu kejadian atau tahapan proses pada tabel ini.",
      usageNotes: "Perhatikan format tanggal dan gunakan filter periode saat membuat laporan.",
      analysisStatus: "PARTIAL",
      confidenceScore: 70,
    };
  }
  if (lower.includes("nama")) {
    return {
      description: "Kolom nama atau label yang membantu menampilkan identitas data pada tabel ini.",
      usageNotes: /pihak|alamat|nik/i.test(tableName) ? "Berpotensi memuat data pribadi; tampilkan sesuai kewenangan role." : "Gunakan sebagai label tampilan atau hasil laporan.",
      analysisStatus: "PARTIAL",
      confidenceScore: 70,
    };
  }
  if (lower.includes("status") || lower === "aktif") {
    return {
      description: "Kolom status yang membantu membedakan data aktif, tahapan, atau keadaan record pada tabel ini.",
      usageNotes: "Gunakan filter status yang tepat agar data lama/nonaktif tidak ikut terbawa.",
      analysisStatus: "PARTIAL",
      confidenceScore: 72,
    };
  }
  return {
    description: `Kolom \`${column.column_name}\` tersimpan pada tabel \`${tableName}\`. Makna bisnis detailnya perlu dikonfirmasi dari penggunaan aplikasi SIPP atau validasi admin.`,
    usageNotes: "Gunakan setelah memeriksa konteks tabel, tipe data, dan query yang memakai kolom ini.",
    analysisStatus: "NEEDS_REVIEW",
    confidenceScore: 45,
  };
}

function relationSummaryText(relations: AletaSippRelationRow[]) {
  if (relations.length === 0) {
    return "Belum ada relasi eksplisit/terduga yang tersimpan. Jika tabel ini dipakai dalam query, relasinya perlu divalidasi dari struktur SIPP atau query aplikasi.";
  }
  return relations
    .slice(0, 8)
    .map((relation) => `\`${relation.source_column}\` -> \`${relation.target_table}.${relation.target_column}\``)
    .join("; ");
}

function inferDataQualityNotes(tableName: string, category: string, columns: AletaSippColumnRow[], relations: AletaSippRelationRow[]) {
  const notes: string[] = [];
  if (/pihak|alamat|nik|telepon|email/i.test(`${tableName} ${columns.map((column) => column.column_name).join(" ")}`)) {
    notes.push("Berpotensi memuat data pribadi; tampilkan sesuai role dan masking bila perlu.");
  }
  if (tableHasColumn(columns, "aktif") || columns.some((column) => column.column_name.toLowerCase().includes("status"))) {
    notes.push("Perlu filter status/aktif agar data lama atau histori tidak ikut terbaca sebagai data berjalan.");
  }
  if (relations.length === 0 && category !== "Referensi") {
    notes.push("Relasi belum kuat dari metadata; perlu review admin atau pembanding query SIPP.");
  }
  if (notes.length === 0) notes.push("Validasi kualitas data tetap diperlukan sebelum dipakai untuk laporan atau dokumen resmi.");
  return notes.join(" ");
}

function buildUsageExamples(tableName: string, humanName: string, category: string) {
  if (tableName === "perkara") {
    return ["Mencari perkara berdasarkan nomor perkara.", "Menjadi titik awal join ke pihak, jadwal sidang, putusan, biaya, dan dokumen."];
  }
  if (tableName === "perkara_hakim_pn") return ["Mengambil susunan majelis hakim atau hakim tunggal suatu perkara.", "Membuat laporan beban perkara per hakim."];
  if (tableName === "perkara_jadwal_sidang") return ["Menampilkan agenda dan jadwal sidang per tanggal.", "Menyusun daftar sidang per ruang sidang."];
  if (tableName === "perkara_putusan") return ["Memantau perkara yang sudah diputus.", "Mengambil tanggal putusan untuk laporan dan indikator kinerja."];
  if (tableName === "pihak") return ["Mengambil identitas pihak berdasarkan ID internal pihak.", "Membantu normalisasi data pihak lintas perkara."];
  if (category === "Referensi") return [`Menjadi sumber pilihan/label untuk data ${humanName.toLowerCase()}.`];
  if (category === "Log") return ["Membantu audit teknis dan penelusuran histori perubahan data."];
  return [`Mendukung pembacaan data ${humanName.toLowerCase()} dalam query, laporan, atau validasi metadata SIPP.`];
}

function buildExampleQuery(tableName: string, columns: AletaSippColumnRow[]) {
  const selectedColumns = importantColumns(columns, 5).map((column) => column.column_name);
  const projection = selectedColumns.length > 0 ? selectedColumns.map((column) => `\`${column}\``).join(", ") : "*";
  const filter = tableHasColumn(columns, "perkara_id") ? " WHERE `perkara_id` = :perkara_id" : tableHasColumn(columns, "nomor_perkara") ? " WHERE `nomor_perkara` = :nomor_perkara" : "";
  return `SELECT ${projection} FROM \`${tableName}\`${filter} LIMIT 25`;
}

function analyzeTableMetadata(table: AletaSippTableRow, columns: AletaSippColumnRow[], relations: AletaSippRelationRow[]) {
  const tableName = table.table_name;
  const category = inferDictionaryCategory(tableName, columns);
  const humanName = inferHumanTableName(tableName, category);
  const relationSummary = relationSummaryText(relations);
  const mainColumns = importantColumns(columns, 8);
  const mainColumnsSummary =
    mainColumns.length > 0
      ? mainColumns.map((column) => `\`${column.column_name}\` (${inferColumnHumanName(column.column_name)})`).join(", ")
      : "Belum ada kolom yang terbaca dari metadata.";
  const usageExamples = buildUsageExamples(tableName, humanName, category);
  const dataQualityNotes = inferDataQualityNotes(tableName, category, columns, relations);
  let confidenceScore = 45;
  if (TABLE_HUMAN_NAME_OVERRIDES[tableName]) confidenceScore += 25;
  if (category !== "Lainnya") confidenceScore += 15;
  if (tableHasColumn(columns, "perkara_id", "nomor_perkara", "pihak_id")) confidenceScore += 10;
  if (relations.length > 0) confidenceScore += 8;
  if (columns.length > 0) confidenceScore += 5;
  confidenceScore = Math.min(98, confidenceScore);
  const analysisStatus = confidenceScore >= 78 ? "ANALYZED" : confidenceScore >= 60 ? "PARTIAL" : "NEEDS_REVIEW";
  const caveat =
    analysisStatus === "NEEDS_REVIEW"
      ? "Fungsi tabel ini belum dapat dipastikan sepenuhnya dari struktur yang tersedia. Penjelasan berikut adalah dugaan awal dari nama tabel, kolom, dan relasi yang tersimpan."
      : analysisStatus === "PARTIAL"
        ? "Penjelasan ini dibuat otomatis dari struktur metadata dan masih perlu review admin untuk memastikan istilah bisnisnya."
        : "Penjelasan ini dibuat otomatis dari struktur metadata dengan sinyal nama tabel, kolom, dan relasi yang cukup kuat.";
  const shortDescription =
    tableName === "perkara"
      ? "Menyimpan data induk perkara seperti nomor perkara, jenis perkara, tanggal pendaftaran, dan identitas proses utama perkara."
      : tableName === "perkara_hakim_pn"
      ? "Menyimpan data hakim yang ditunjuk untuk menangani suatu perkara, baik sebagai Ketua Majelis, Hakim Anggota, maupun Hakim Tunggal."
      : tableName === "perkara_jadwal_sidang"
        ? "Menyimpan jadwal persidangan perkara, termasuk tanggal sidang, agenda, ruang, dan informasi pelaksanaan sidang."
        : tableName === "perkara_putusan"
          ? "Menyimpan data putusan perkara dan informasi penting yang dibutuhkan untuk laporan putusan serta monitoring perkara putus."
          : tableName === "pihak"
            ? "Menyimpan master identitas pihak yang dapat direlasikan ke perkara melalui tabel pihak perkara."
            : category === "Referensi"
              ? `Menyimpan data referensi ${humanName.toLowerCase()} yang dipakai sebagai pilihan atau label pada proses SIPP.`
              : `Menyimpan metadata ${humanName.toLowerCase()} dalam kategori ${category.toLowerCase()} pada struktur SIPP.`;
  const businessFunction =
    category === "Referensi"
      ? `Menjadi data master/referensi untuk menstandarkan nilai ${humanName.toLowerCase()} pada proses SIPP.`
      : tableHasColumn(columns, "perkara_id", "nomor_perkara")
        ? `Mendukung proses administrasi perkara dengan mengaitkan data ${humanName.toLowerCase()} ke perkara.`
        : `Mendukung kebutuhan ${category.toLowerCase()} dalam aplikasi SIPP.`;
  const longDescription = [
    `${caveat} Tabel \`${tableName}\` menyimpan data ${humanName.toLowerCase()} dan dikelompokkan dalam kategori ${category}.`,
    `Dalam alur SIPP, tabel ini dipakai untuk ${businessFunction.charAt(0).toLowerCase()}${businessFunction.slice(1)}`,
    `Kolom penting yang terbaca antara lain ${mainColumnsSummary}. ${relationSummary}`,
    `Contoh penggunaan: ${usageExamples.join(" ")} Contoh query awal: \`${buildExampleQuery(tableName, columns)}\`.`,
    `Catatan kualitas data: ${dataQualityNotes}`,
  ].join("\n\n");

  return {
    humanName,
    category,
    priority: priorityFromCategory(category),
    shortDescription: shortDescription.slice(0, 250),
    longDescription,
    businessFunction,
    mainColumnsSummary,
    relationSummary,
    usageExamples,
    dataQualityNotes,
    analysisStatus,
    confidenceScore,
    reviewStatus: analysisStatus === "ANALYZED" ? "AUTO_GENERATED" : "NEEDS_ADMIN_REVIEW",
    exampleUsage: usageExamples[0] ?? "",
    exampleQuery: buildExampleQuery(tableName, columns),
    riskNotes: [dataQualityNotes],
  };
}

function buildSchedulePreviewRows(tanggalSidang?: string) {
  const dateLabel = tanggalSidang || new Date().toISOString().slice(0, 10);
  return [
    {
      nomorUrut: 1,
      tanggalSidang: dateLabel,
      nomorPerkara: "123/Pdt.G/2026/PA.Bku",
      paraPihak: "Penggugat melawan Tergugat",
      majelis: "Ketua Majelis, Hakim Anggota I, Hakim Anggota II",
      panitera: "Panitera Pengganti",
      agenda: "Pembuktian",
      ruangSidang: "Ruang Sidang 1",
      jamSidang: "09:00",
    },
    {
      nomorUrut: 2,
      tanggalSidang: dateLabel,
      nomorPerkara: "124/Pdt.P/2026/PA.Bku",
      paraPihak: "Pemohon",
      majelis: "Hakim Tunggal",
      panitera: "Panitera Pengganti",
      agenda: "Pemeriksaan permohonan",
      ruangSidang: "Ruang Sidang 2",
      jamSidang: "10:00",
    },
  ];
}

export async function seedAletaSippQueryRegistryService(db: AletaDatabase, actor: UserPersona) {
  requireAletaSippPermissionForAction(
    actor,
    ALETA_SIPP_PERMISSION.MANAGE_QUERY_REGISTRY,
    "Anda tidak memiliki izin mengelola Query Registry ALETA x SIPP."
  );
  const now = new Date().toISOString();
  let insertedOrUpdated = 0;
  let rejected = 0;

  for (const definition of listAletaSippQueryDefinitions()) {
    const safety = validateAletaSippSelectOnlySql(definition.normalizedSql);
    if (!safety.selectOnly) {
      rejected += 1;
      continue;
    }
    assertAletaSippRegisteredReadOnlySql(definition.normalizedSql);
    await db.run(
      `
      INSERT INTO aleta_sipp_query_registry (
        id, query_key, name, category, source, short_description, long_description,
        tables_json, output_columns_json, original_sql, normalized_sql, security_status,
        role_scope_json, ai_allowed, whatsapp_allowed, pdf_allowed, risk_notes_json,
        is_active, created_by, updated_by, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?::jsonb, ?, ?, ?, ?::jsonb, ?, ?, ?, ?::jsonb, 1, ?, ?, ?, ?)
      ON CONFLICT (query_key) DO UPDATE SET
        name = EXCLUDED.name,
        category = EXCLUDED.category,
        source = EXCLUDED.source,
        short_description = EXCLUDED.short_description,
        long_description = EXCLUDED.long_description,
        tables_json = EXCLUDED.tables_json,
        output_columns_json = EXCLUDED.output_columns_json,
        original_sql = EXCLUDED.original_sql,
        normalized_sql = EXCLUDED.normalized_sql,
        security_status = EXCLUDED.security_status,
        role_scope_json = EXCLUDED.role_scope_json,
        ai_allowed = EXCLUDED.ai_allowed,
        whatsapp_allowed = EXCLUDED.whatsapp_allowed,
        pdf_allowed = EXCLUDED.pdf_allowed,
        risk_notes_json = EXCLUDED.risk_notes_json,
        updated_by = EXCLUDED.updated_by,
        updated_at = EXCLUDED.updated_at
      `,
      [
        definition.queryId,
        definition.queryKey,
        definition.name,
        definition.category,
        definition.source,
        definition.shortDescription,
        definition.longDescription,
        jsonString(definition.tables),
        jsonString(definition.outputColumns),
        definition.originalSql,
        definition.normalizedSql,
        definition.securityStatus,
        jsonString(definition.roles),
        definition.allowedForAi ? 1 : 0,
        definition.allowedForWhatsapp ? 1 : 0,
        definition.allowedForPdf ? 1 : 0,
        jsonString(definition.riskNotes),
        actor.id,
        actor.id,
        now,
        now,
      ]
    );

    for (const [index, parameter] of definition.parameters.entries()) {
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
        [
          stableId("sipp_qp", definition.queryKey, parameter.name),
          definition.queryId,
          parameter.name,
          parameter.label,
          parameter.type,
          parameter.required ? 1 : 0,
          parameter.example ?? "",
          index + 1,
          now,
          now,
        ]
      );
    }

    for (const [index, columnName] of definition.outputColumns.entries()) {
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
        [
          stableId("sipp_qo", definition.queryKey, columnName),
          definition.queryId,
          columnName,
          humanizeIdentifier(columnName),
          /nama|alamat|nik|telepon|email/i.test(columnName) ? 1 : 0,
          index + 1,
          now,
          now,
        ]
      );
    }
    insertedOrUpdated += 1;
  }

  return { insertedOrUpdated, rejected };
}

async function seedAletaSippVariables(db: AletaDatabase, actor: UserPersona) {
  const now = new Date().toISOString();
  for (const variable of baseVariableSeeds()) {
    await db.run(
      `
      INSERT INTO aleta_sipp_variables (
        id, legacy_source, legacy_code, modern_key, display_name, description, data_type,
        source_type, source_table, source_column, query_id, transform_key, example_value,
        status, sensitive, is_active, created_by, updated_by, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, '', 'text', ?, ?, ?, NULL, '', '', ?, ?, 1, ?, ?, ?, ?)
      ON CONFLICT (modern_key) DO UPDATE SET
        legacy_source = EXCLUDED.legacy_source,
        legacy_code = EXCLUDED.legacy_code,
        display_name = EXCLUDED.display_name,
        source_type = EXCLUDED.source_type,
        source_table = EXCLUDED.source_table,
        source_column = EXCLUDED.source_column,
        status = EXCLUDED.status,
        sensitive = EXCLUDED.sensitive,
        updated_by = EXCLUDED.updated_by,
        updated_at = EXCLUDED.updated_at
      `,
      [
        stableId("sipp_var", variable.modernKey),
        variable.legacySource,
        variable.legacyCode,
        variable.modernKey,
        variable.displayName,
        variable.sourceType,
        variable.sourceTable,
        variable.sourceColumn,
        variable.status,
        /pihak|alamat|nik|telepon|email/i.test(`${variable.displayName} ${variable.sourceColumn}`) ? 1 : 0,
        actor.id,
        actor.id,
        now,
        now,
      ]
    );
  }
}

async function seedAletaSippAssessmentIndicators(db: AletaDatabase, actor: UserPersona) {
  const now = new Date().toISOString();
  for (const indicator of fallbackAssessmentIndicators()) {
    await db.run(
      `
      INSERT INTO aleta_sipp_assessment_indicators (
        id, indicator_code, name, category, sk_basis, description, weight, formula,
        source_tables_json, query_id, parameter_period, status, assumption_notes,
        is_active, created_by, updated_by, created_at, updated_at
      )
      VALUES (?, ?, ?, 'SK Penilaian SIPP 2024', 'SK PENILAIAN SIPP 2024.pdf', ?, 0, '', ?::jsonb, NULL, 'period', ?, ?, 1, ?, ?, ?, ?)
      ON CONFLICT (indicator_code) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        source_tables_json = EXCLUDED.source_tables_json,
        status = EXCLUDED.status,
        assumption_notes = EXCLUDED.assumption_notes,
        updated_by = EXCLUDED.updated_by,
        updated_at = EXCLUDED.updated_at
      `,
      [
        stableId("sipp_ai", indicator.kode),
        indicator.kode,
        indicator.nama,
        indicator.sourceHint,
        jsonString([]),
        indicator.status,
        indicator.sourceHint,
        actor.id,
        actor.id,
        now,
        now,
      ]
    );
  }
}

export async function importSippMetadataFromSqlDump(db: AletaDatabase, actor: UserPersona, input: { sourcePath?: string } = {}) {
  const access = requireAletaSippPermissionForAction(
    actor,
    ALETA_SIPP_PERMISSION.IMPORT_SQL_STRUCTURE,
    "Anda tidak memiliki izin import struktur SQL SIPP."
  );
  const sourcePath = input.sourcePath?.trim() || getAletaSippSqlDumpPath();
  const datasource = getAletaSippDataSourceStatus();
  const jobId = stableId("sipp_import", "sql_dump_metadata", String(Date.now()));
  const startedAt = new Date().toISOString();

  await db.run(
    `
    INSERT INTO aleta_sipp_import_jobs (
      id, import_type, source_path, mode, status, summary_json, error_message, executed_by, started_at, finished_at, created_at
    )
    VALUES (?, 'SQL_DUMP_METADATA', ?, ?, 'RUNNING', ?::jsonb, NULL, ?, ?, NULL, ?)
    `,
    [jobId, sourcePath, datasource.mode, jsonString({ sourcePath, datasourceMode: datasource.mode }), actor.id, startedAt, startedAt]
  );

  try {
    const parsed = await parseSippSqlStructure(sourcePath);
    if (!parsed.exists) {
      throw new Error(`SQL dump tidak ditemukan: ${sourcePath}`);
    }

    const now = new Date().toISOString();
    const tableIds = new Map<string, string>();
    let importedColumns = 0;
    let importedRelations = 0;

    for (const table of parsed.tables) {
      const tableId = stableId("sipp_table", table.name);
      tableIds.set(table.name, tableId);
      await db.run(
        `
        INSERT INTO aleta_sipp_tables (
          id, table_name, human_name, category, priority, short_description, long_description,
          function_in_case_process, table_kind, source_schema_hash, risk_notes, example_usage,
          example_query_key, is_active, created_by, updated_by, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, '', '', 1, ?, ?, ?, ?)
        ON CONFLICT (table_name) DO UPDATE SET
          human_name = EXCLUDED.human_name,
          category = EXCLUDED.category,
          priority = EXCLUDED.priority,
          short_description = EXCLUDED.short_description,
          long_description = EXCLUDED.long_description,
          function_in_case_process = EXCLUDED.function_in_case_process,
          table_kind = EXCLUDED.table_kind,
          source_schema_hash = EXCLUDED.source_schema_hash,
          risk_notes = EXCLUDED.risk_notes,
          is_active = 1,
          updated_by = EXCLUDED.updated_by,
          updated_at = EXCLUDED.updated_at
        `,
        [
          tableId,
          table.name,
          table.humanName,
          table.category,
          table.priority,
          table.shortDescription,
          table.longDescription,
          table.functionInCaseProcess,
          tableKindFromCategory(table.category),
          schemaHashForTable(table),
          jsonString(table.riskNotes),
          actor.id,
          actor.id,
          now,
          now,
        ]
      );

      for (const [index, column] of table.columns.entries()) {
        const relationHint = table.relations.find((relation) => relation.column === column.name);
        const primaryKey = isPrimaryKeyColumn(table, column.name);
        await db.run(
          `
          INSERT INTO aleta_sipp_columns (
            id, table_id, table_name, column_name, human_name, data_type, is_nullable,
            is_primary_key, is_indexed, description, example_value, relation_hint,
            query_usage_json, quality_notes, sort_order, created_at, updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '', '', ?, ?::jsonb, '', ?, ?, ?)
          ON CONFLICT (table_name, column_name) DO UPDATE SET
            table_id = EXCLUDED.table_id,
            human_name = EXCLUDED.human_name,
            data_type = EXCLUDED.data_type,
            is_nullable = EXCLUDED.is_nullable,
            is_primary_key = EXCLUDED.is_primary_key,
            is_indexed = EXCLUDED.is_indexed,
            relation_hint = EXCLUDED.relation_hint,
            sort_order = EXCLUDED.sort_order,
            updated_at = EXCLUDED.updated_at
          `,
          [
            stableId("sipp_col", table.name, column.name),
            tableId,
            table.name,
            column.name,
            humanizeIdentifier(column.name),
            column.type,
            column.notNull ? 0 : 1,
            primaryKey ? 1 : 0,
            primaryKey || isIndexedColumn(table, column.name) ? 1 : 0,
            relationHint ? `${column.name} -> ${relationHint.targetTable}` : "",
            jsonString([]),
            index + 1,
            now,
            now,
          ]
        );
        importedColumns += 1;
      }
    }

    await db.run("DELETE FROM aleta_sipp_relations WHERE relation_type = 'inferred_sql_dump'");
    for (const table of parsed.tables) {
      const sourceTableId = tableIds.get(table.name) ?? stableId("sipp_table", table.name);
      for (const relation of table.relations) {
        const targetTableId = tableIds.get(relation.targetTable) ?? stableId("sipp_table", relation.targetTable);
        await db.run(
          `
          INSERT INTO aleta_sipp_relations (
            id, source_table_id, source_table, source_column, target_table_id, target_table,
            target_column, relation_type, confidence, description, example_query_key, is_active, created_at, updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, 'inferred_sql_dump', ?, ?, '', 1, ?, ?)
          ON CONFLICT (id) DO UPDATE SET
            source_table_id = EXCLUDED.source_table_id,
            target_table_id = EXCLUDED.target_table_id,
            target_column = EXCLUDED.target_column,
            confidence = EXCLUDED.confidence,
            description = EXCLUDED.description,
            is_active = 1,
            updated_at = EXCLUDED.updated_at
          `,
          [
            stableId("sipp_rel", table.name, relation.column, relation.targetTable),
            sourceTableId,
            table.name,
            relation.column,
            targetTableId,
            relation.targetTable,
            targetColumnForRelation(relation.targetTable),
            relation.confidence,
            relation.note,
            now,
            now,
          ]
        );
        importedRelations += 1;
      }
    }

    const querySeed = await seedAletaSippQueryRegistryService(db, actor);
    await seedAletaSippVariables(db, actor);
    await seedAletaSippAssessmentIndicators(db, actor);

    const finishedAt = new Date().toISOString();
    const summary = {
      metadataStatus: "READY",
      sourcePath,
      datasourceMode: datasource.mode,
      tableCount: parsed.tableCount,
      columnCount: importedColumns,
      relationCount: importedRelations,
      categories: parsed.categories,
      queryRegistrySeeded: querySeed.insertedOrUpdated,
      queryRegistryRejected: querySeed.rejected,
      accessRole: access.roleView,
    };

    await db.run(
      `
      UPDATE aleta_sipp_import_jobs
      SET status = 'SUCCESS', summary_json = ?::jsonb, error_message = NULL, finished_at = ?
      WHERE id = ?
      `,
      [jsonString(summary), finishedAt, jobId]
    );

    return { jobId, status: "SUCCESS", ...summary, startedAt, finishedAt };
  } catch (error) {
    const finishedAt = new Date().toISOString();
    const message = error instanceof Error ? error.message : "Import metadata SQL dump gagal.";
    await db.run(
      `
      UPDATE aleta_sipp_import_jobs
      SET status = 'FAILED', summary_json = ?::jsonb, error_message = ?, finished_at = ?
      WHERE id = ?
      `,
      [jsonString({ sourcePath, datasourceMode: datasource.mode, error: message }), message, finishedAt, jobId]
    );
    throw error;
  }
}

export async function getAletaSippDashboardSummary(db: AletaDatabase, actor: UserPersona) {
  const access = requireAletaSippPermissionForAction(
    actor,
    ALETA_SIPP_PERMISSION.VIEW_DASHBOARD,
    "Anda tidak memiliki akses ALETA x SIPP."
  );
  const datasource = getAletaSippDataSourceStatus();
  const [
    tableCount,
    columnCount,
    relationCount,
    queryCount,
    variableCount,
    assessmentIndicatorCount,
    importJobCount,
    categoryRows,
    lastImport,
    tableRows,
    queryRows,
    variableRows,
    assessmentRows,
  ] = await Promise.all([
    readCount(db, "SELECT COUNT(*) AS count FROM aleta_sipp_tables WHERE is_active = 1"),
    readCount(db, "SELECT COUNT(*) AS count FROM aleta_sipp_columns"),
    readCount(db, "SELECT COUNT(*) AS count FROM aleta_sipp_relations WHERE is_active = 1"),
    readCount(db, "SELECT COUNT(*) AS count FROM aleta_sipp_query_registry WHERE is_active = 1"),
    readCount(db, "SELECT COUNT(*) AS count FROM aleta_sipp_variables WHERE is_active = 1"),
    readCount(db, "SELECT COUNT(*) AS count FROM aleta_sipp_assessment_indicators WHERE is_active = 1"),
    readCount(db, "SELECT COUNT(*) AS count FROM aleta_sipp_import_jobs"),
    db.queryAll<AletaSippCategoryRow>("SELECT category, COUNT(*) AS count FROM aleta_sipp_tables WHERE is_active = 1 GROUP BY category ORDER BY category"),
    db.queryOne<AletaSippImportJobRow>(
      "SELECT id, import_type, source_path, mode, status, summary_json, error_message, executed_by, started_at, finished_at, created_at FROM aleta_sipp_import_jobs ORDER BY created_at DESC LIMIT 1"
    ),
    db.queryAll<AletaSippTableRow>(
      `
      SELECT
        t.id, t.table_name, t.human_name, t.category, t.priority, t.short_description,
        t.long_description, t.function_in_case_process, t.table_kind, t.risk_notes,
        t.example_usage, t.example_query_key, t.is_active, t.created_at, t.updated_at,
        (SELECT COUNT(*) FROM aleta_sipp_columns c WHERE c.table_id = t.id) AS column_count,
        (SELECT COUNT(*) FROM aleta_sipp_relations r WHERE r.source_table = t.table_name AND r.is_active = 1) AS relation_count
      FROM aleta_sipp_tables t
      WHERE t.is_active = 1
      ORDER BY t.priority ASC, t.table_name ASC
      LIMIT 12
      `
    ),
    db.queryAll<AletaSippQueryRegistryRow>(
      `
      SELECT id, query_key, name, category, source, short_description, long_description,
        tables_json, output_columns_json, original_sql, normalized_sql, security_status,
        role_scope_json, ai_allowed, whatsapp_allowed, pdf_allowed, risk_notes_json,
        is_active, created_at, updated_at
      FROM aleta_sipp_query_registry
      WHERE is_active = 1
      ORDER BY category, query_key
      LIMIT 12
      `
    ),
    db.queryAll<AletaSippVariableRow>(
      `
      SELECT id, legacy_source, legacy_code, modern_key, display_name, description, data_type,
        source_type, source_table, source_column, query_id, transform_key, example_value,
        status, sensitive, is_active, created_at, updated_at
      FROM aleta_sipp_variables
      WHERE is_active = 1
      ORDER BY legacy_source, legacy_code, modern_key
      LIMIT 12
      `
    ),
    db.queryAll<AletaSippAssessmentIndicatorRow>(
      `
      SELECT id, indicator_code, name, category, sk_basis, description, weight, formula,
        source_tables_json, query_id, parameter_period, status, assumption_notes,
        is_active, created_at, updated_at
      FROM aleta_sipp_assessment_indicators
      WHERE is_active = 1
      ORDER BY indicator_code
      LIMIT 12
      `
    ),
  ]);
  const categories = Object.fromEntries(categoryRows.map((row) => [row.category, countValue(row)]));
  const dictionaryPreview = tableRows.map(mapTableRow);
  const queryRegistry = queryRows.map(mapQueryRegistryRow);
  const variables = variableRows.map(mapVariableRow);
  const assessmentIndicators = assessmentRows.map(mapAssessmentIndicatorRow);
  const metadataStatus = tableCount > 0 ? "READY" : "BELUM_IMPORT_METADATA";

  return {
    generatedAt: new Date().toISOString(),
    access,
    datasource,
    metadataStatus,
    counts: {
      tables: tableCount,
      columns: columnCount,
      relations: relationCount,
      queries: queryCount,
      variables: variableCount,
      assessmentIndicators: assessmentIndicatorCount,
      importJobs: importJobCount,
    },
    lastImport,
    dictionaryPreview,
    queryRegistry,
    variableRegistryPreview: variables,
    assessmentIndicators,
    assessment: {
      cacheStatus: assessmentIndicatorCount > 0 ? "READY" : "DATA_TIDAK_CUKUP",
      indicatorCount: assessmentIndicatorCount,
      indicators: assessmentIndicators,
    },
    schedulePreview: buildSchedulePreviewRows(),
    paths: {
      ...DEFAULT_PATHS,
      sqlBackup: datasource.sqlDumpPath,
    },
    audit: {
      applications: [],
      sql: {
        file: datasource.sqlDumpPath,
        exists: tableCount > 0,
        sizeBytes: 0,
        parsedAt: lastImport?.finished_at ?? lastImport?.created_at ?? "",
        tableCount,
        columnCount,
        categories,
        tables: [],
        focusTables: dictionaryPreview.map((table) => ({
          name: table.tableName,
          humanName: table.humanName,
          category: table.category,
          priority: Math.min(3, Math.max(1, table.priority)) as 1 | 2 | 3,
          shortDescription: table.shortDescription,
          longDescription: table.longDescription,
          functionInCaseProcess: table.functionInCaseProcess,
          columns: [],
          keys: [],
          relations: [],
          riskNotes: table.riskNotes,
        })),
        relationCount,
      },
      abtXls: {
        file: DEFAULT_PATHS.abtXls,
        exists: variableCount > 0,
        readMethod: "unavailable" as const,
        sheets: [],
        variableCount,
        sqlQueryCount: queryCount,
        placeholderCount: variableCount,
        status: variableCount > 0 ? "Metadata variabel dibaca dari cache ALETA." : "Belum import variabel ABT/Word.",
      },
      wordQueries: {
        file: DEFAULT_PATHS.wordQueries,
        exists: queryCount > 0,
        paragraphCount: 0,
        queryCount,
        placeholders: [],
        querySamples: [],
        status: "Summary tidak membaca DOCX; gunakan import admin untuk refresh metadata.",
      },
      assessmentPdf: {
        file: DEFAULT_PATHS.assessmentPdf,
        exists: assessmentIndicatorCount > 0,
        pageCount: 0,
        extractedChars: 0,
        indicatorHints: [],
        status: "Summary membaca cache indikator ALETA, bukan PDF.",
      },
    },
    safetyNotes: [
      "Summary ALETA x SIPP membaca metadata/cache dari tabel ALETA, bukan parse SQL/XLS/DOCX/PDF tiap request.",
      "SQL dump hanya mode local/testing untuk import metadata, bukan datasource production.",
      "Production memakai database SIPP yang dikelola ALETA Bot melalui bridge read-only.",
      "Endpoint raw SQL client tidak disediakan; query harus terdaftar di Query Registry dan SELECT/read-only.",
      "Import legacy ABT/Word/PDF dilakukan manual dari admin dan masuk status review sebelum dipakai.",
    ],
  };
}

function pagination(input: { limit?: number; offset?: number }) {
  const limit = Math.max(1, Math.min(100, Number(input.limit || 25)));
  const offset = Math.max(0, Number(input.offset || 0));
  return { limit, offset };
}

function normalizeLike(value: string) {
  return `%${value.trim().toLowerCase()}%`;
}

function normalizeScheduleDate(value: string | undefined) {
  const date = value?.trim() || new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    badRequest("Tanggal sidang harus berformat YYYY-MM-DD.");
  }
  return date;
}

export async function getAletaSippDatasourceStatusService(actor: UserPersona) {
  requireAletaSippPermissionForAction(
    actor,
    ALETA_SIPP_PERMISSION.VIEW_DASHBOARD,
    "Anda tidak memiliki akses status datasource ALETA x SIPP."
  );
  return getAletaSippDataSourceStatus();
}

export async function testAletaSippDatasourceService(actor: UserPersona) {
  requireAletaSippPermissionForAction(
    actor,
    ALETA_SIPP_PERMISSION.MANAGE_SETTINGS,
    "Anda tidak memiliki izin menguji datasource ALETA x SIPP."
  );
  return testAletaBotSippDataSource();
}

export async function getAletaSippTables(
  db: AletaDatabase,
  actor: UserPersona,
  input: { q?: string; category?: string; limit?: number; offset?: number } = {}
) {
  requireAletaSippPermissionForAction(
    actor,
    ALETA_SIPP_PERMISSION.VIEW_DICTIONARY,
    "Anda tidak memiliki izin melihat kamus tabel SIPP."
  );
  const { limit, offset } = pagination(input);
  const where: string[] = ["t.is_active = 1"];
  const params: Array<string | number | boolean | null> = [];
  if (input.q?.trim()) {
    where.push("(LOWER(t.table_name) LIKE ? OR LOWER(t.human_name) LIKE ? OR LOWER(t.short_description) LIKE ?)");
    const q = normalizeLike(input.q);
    params.push(q, q, q);
  }
  if (input.category?.trim()) {
    where.push("t.category = ?");
    params.push(input.category.trim());
  }
  const whereSql = where.join(" AND ");
  const [rows, total] = await Promise.all([
    db.queryAll<AletaSippTableRow>(
      `
      SELECT
        t.id, t.table_name, t.human_name, t.category, t.priority, t.short_description,
        t.long_description, t.function_in_case_process, t.table_kind, t.risk_notes,
        t.example_usage, t.example_query_key, t.is_active, t.created_at, t.updated_at,
        (SELECT COUNT(*) FROM aleta_sipp_columns c WHERE c.table_id = t.id) AS column_count,
        (SELECT COUNT(*) FROM aleta_sipp_relations r WHERE r.source_table = t.table_name AND r.is_active = 1) AS relation_count
      FROM aleta_sipp_tables t
      WHERE ${whereSql}
      ORDER BY t.priority ASC, t.table_name ASC
      LIMIT ? OFFSET ?
      `,
      [...params, limit, offset]
    ),
    readCount(db, `SELECT COUNT(*) AS count FROM aleta_sipp_tables t WHERE ${whereSql}`, params),
  ]);
  return {
    rows: rows.map(mapTableRow),
    pagination: { limit, offset, total },
  };
}

export async function getAletaSippTableDetail(db: AletaDatabase, actor: UserPersona, tableName: string) {
  requireAletaSippPermissionForAction(
    actor,
    ALETA_SIPP_PERMISSION.VIEW_DICTIONARY,
    "Anda tidak memiliki izin melihat detail tabel SIPP."
  );
  const normalizedTable = decodeURIComponent(tableName || "").trim();
  const row = await db.queryOne<AletaSippTableRow>(
    `
    SELECT
      t.id, t.table_name, t.human_name, t.category, t.priority, t.short_description,
      t.long_description, t.function_in_case_process, t.table_kind, t.risk_notes,
      t.example_usage, t.example_query_key, t.is_active, t.created_at, t.updated_at,
      (SELECT COUNT(*) FROM aleta_sipp_columns c WHERE c.table_id = t.id) AS column_count,
      (SELECT COUNT(*) FROM aleta_sipp_relations r WHERE r.source_table = t.table_name AND r.is_active = 1) AS relation_count
    FROM aleta_sipp_tables t
    WHERE t.table_name = ? AND t.is_active = 1
    LIMIT 1
    `,
    [normalizedTable]
  );
  if (!row) notFound("Metadata tabel SIPP belum ditemukan. Jalankan import struktur SQL dari admin.");
  const [columns, relations] = await Promise.all([
    db.queryAll<AletaSippColumnRow>(
      `
      SELECT id, table_id, table_name, column_name, human_name, data_type, is_nullable,
        is_primary_key, is_indexed, description, example_value, relation_hint,
        query_usage_json, quality_notes, sort_order, created_at, updated_at
      FROM aleta_sipp_columns
      WHERE table_name = ?
      ORDER BY sort_order, column_name
      `,
      [normalizedTable]
    ),
    db.queryAll<AletaSippRelationRow>(
      `
      SELECT id, source_table, source_column, target_table, target_column, relation_type,
        confidence, description, example_query_key, is_active, created_at, updated_at
      FROM aleta_sipp_relations
      WHERE is_active = 1 AND (source_table = ? OR target_table = ?)
      ORDER BY source_table, source_column, target_table
      `,
      [normalizedTable, normalizedTable]
    ),
  ]);
  return {
    table: mapTableRow(row),
    columns: columns.map(mapColumnRow),
    relations: relations.map((relation) => ({
      id: relation.id,
      sourceTable: relation.source_table,
      sourceColumn: relation.source_column,
      targetTable: relation.target_table,
      targetColumn: relation.target_column,
      relationType: relation.relation_type,
      confidence: relation.confidence,
      description: relation.description,
      exampleQueryKey: relation.example_query_key,
      createdAt: relation.created_at,
      updatedAt: relation.updated_at,
    })),
  };
}

export async function getAletaSippColumns(
  db: AletaDatabase,
  actor: UserPersona,
  input: { q?: string; tableName?: string; limit?: number; offset?: number } = {}
) {
  requireAletaSippPermissionForAction(
    actor,
    ALETA_SIPP_PERMISSION.VIEW_DICTIONARY,
    "Anda tidak memiliki izin melihat kolom SIPP."
  );
  const { limit, offset } = pagination(input);
  const where: string[] = ["1 = 1"];
  const params: Array<string | number | boolean | null> = [];
  if (input.tableName?.trim()) {
    where.push("table_name = ?");
    params.push(input.tableName.trim());
  }
  if (input.q?.trim()) {
    where.push("(LOWER(table_name) LIKE ? OR LOWER(column_name) LIKE ? OR LOWER(human_name) LIKE ?)");
    const q = normalizeLike(input.q);
    params.push(q, q, q);
  }
  const whereSql = where.join(" AND ");
  const [rows, total] = await Promise.all([
    db.queryAll<AletaSippColumnRow>(
      `
      SELECT id, table_id, table_name, column_name, human_name, data_type, is_nullable,
        is_primary_key, is_indexed, description, example_value, relation_hint,
        query_usage_json, quality_notes, sort_order, created_at, updated_at
      FROM aleta_sipp_columns
      WHERE ${whereSql}
      ORDER BY table_name, sort_order, column_name
      LIMIT ? OFFSET ?
      `,
      [...params, limit, offset]
    ),
    readCount(db, `SELECT COUNT(*) AS count FROM aleta_sipp_columns WHERE ${whereSql}`, params),
  ]);
  return { rows: rows.map(mapColumnRow), pagination: { limit, offset, total } };
}

function dictionaryPage(input: { page?: number; pageSize?: number }) {
  const pageSize = Math.max(1, Math.min(50, Number(input.pageSize || 25)));
  const page = Math.max(1, Number(input.page || 1));
  return { page, pageSize, offset: (page - 1) * pageSize };
}

const DICTIONARY_TABLE_SELECT = `
  t.id, t.table_name, t.human_name, t.category, t.priority, t.short_description,
  t.long_description, t.function_in_case_process, t.table_kind, t.risk_notes,
  t.example_usage, t.example_query_key, t.business_function, t.main_columns_summary,
  t.relation_summary, t.usage_examples, t.data_quality_notes, t.analysis_status,
  t.confidence_score, t.review_status, t.review_notes, t.analyzed_at, t.reviewed_at,
  t.reviewed_by, t.is_active, t.created_at, t.updated_at,
  (SELECT COUNT(*) FROM aleta_sipp_columns c WHERE c.table_id = t.id) AS column_count,
  (SELECT COUNT(*) FROM aleta_sipp_relations r WHERE r.source_table = t.table_name AND r.is_active = 1) AS relation_count
`;

const DICTIONARY_COLUMN_SELECT = `
  id, table_id, table_name, column_name, human_name, data_type, is_nullable,
  is_primary_key, is_indexed, description, example_value, relation_hint,
  query_usage_json, quality_notes, default_value, usage_notes, analysis_status,
  confidence_score, sort_order, created_at, updated_at
`;

function mapDictionaryListRow(row: AletaSippTableRow) {
  const table = mapTableRow(row);
  return {
    tableName: table.tableName,
    humanName: table.humanName,
    category: table.category,
    shortDescription: table.shortDescription,
    columnCount: table.columnCount,
    relationCount: table.relationCount,
    analysisStatus: table.analysisStatus,
    confidenceScore: table.confidenceScore,
    reviewStatus: table.reviewStatus,
  };
}

export async function getAletaSippDictionaryStats(db: AletaDatabase, actor: UserPersona) {
  requireAletaSippPermissionForAction(
    actor,
    ALETA_SIPP_PERMISSION.VIEW_DICTIONARY,
    "Anda tidak memiliki izin melihat statistik kamus SIPP."
  );
  const [tableCount, columnCount, relationCount, analysisRows, reviewRows, lastJob] = await Promise.all([
    readCount(db, "SELECT COUNT(*) AS count FROM aleta_sipp_tables WHERE is_active = 1"),
    readCount(db, "SELECT COUNT(*) AS count FROM aleta_sipp_columns"),
    readCount(db, "SELECT COUNT(*) AS count FROM aleta_sipp_relations WHERE is_active = 1"),
    db.queryAll<{ analysis_status: string; count?: string | number | bigint | null }>(
      "SELECT analysis_status, COUNT(*) AS count FROM aleta_sipp_tables WHERE is_active = 1 GROUP BY analysis_status"
    ),
    db.queryAll<{ review_status: string; count?: string | number | bigint | null }>(
      "SELECT review_status, COUNT(*) AS count FROM aleta_sipp_tables WHERE is_active = 1 GROUP BY review_status"
    ),
    db.queryOne<AletaSippImportJobRow>(
      "SELECT id, import_type, source_path, mode, status, summary_json, error_message, executed_by, started_at, finished_at, created_at FROM aleta_sipp_import_jobs WHERE import_type = 'DICTIONARY_ANALYZE' ORDER BY created_at DESC LIMIT 1"
    ),
  ]);
  const analysisCounts = Object.fromEntries(analysisRows.map((row) => [row.analysis_status || "UNKNOWN", countValue(row)]));
  const reviewCounts = Object.fromEntries(reviewRows.map((row) => [row.review_status || "NEEDS_ADMIN_REVIEW", countValue(row)]));
  return {
    totalTables: tableCount,
    totalColumns: columnCount,
    totalRelations: relationCount,
    analyzedTables: analysisCounts.ANALYZED ?? 0,
    partialTables: analysisCounts.PARTIAL ?? 0,
    needsReviewTables: analysisCounts.NEEDS_REVIEW ?? 0,
    unknownTables: analysisCounts.UNKNOWN ?? 0,
    adminReviewedTables: reviewCounts.ADMIN_REVIEWED ?? 0,
    autoGeneratedTables: reviewCounts.AUTO_GENERATED ?? 0,
    needsAdminReviewTables: reviewCounts.NEEDS_ADMIN_REVIEW ?? 0,
    lastAnalyzedAt: lastJob?.finished_at ?? lastJob?.started_at ?? null,
    lastAnalyzeJob: lastJob ?? null,
  };
}

export async function getAletaSippDictionaryTables(
  db: AletaDatabase,
  actor: UserPersona,
  input: { q?: string; category?: string; analysisStatus?: string; reviewStatus?: string; page?: number; pageSize?: number } = {}
) {
  requireAletaSippPermissionForAction(
    actor,
    ALETA_SIPP_PERMISSION.VIEW_DICTIONARY,
    "Anda tidak memiliki izin melihat daftar kamus tabel SIPP."
  );
  const { page, pageSize, offset } = dictionaryPage(input);
  const where: string[] = ["t.is_active = 1"];
  const params: Array<string | number | boolean | null> = [];
  if (input.q?.trim()) {
    where.push("(LOWER(t.table_name) LIKE ? OR LOWER(t.human_name) LIKE ? OR LOWER(t.short_description) LIKE ?)");
    const q = normalizeLike(input.q);
    params.push(q, q, q);
  }
  if (input.category?.trim()) {
    where.push("t.category = ?");
    params.push(input.category.trim());
  }
  if (input.analysisStatus?.trim()) {
    where.push("t.analysis_status = ?");
    params.push(input.analysisStatus.trim());
  }
  if (input.reviewStatus?.trim()) {
    where.push("t.review_status = ?");
    params.push(input.reviewStatus.trim());
  }
  const whereSql = where.join(" AND ");
  const [rows, total, categories] = await Promise.all([
    db.queryAll<AletaSippTableRow>(
      `
      SELECT ${DICTIONARY_TABLE_SELECT}
      FROM aleta_sipp_tables t
      WHERE ${whereSql}
      ORDER BY t.priority ASC, t.category ASC, t.table_name ASC
      LIMIT ? OFFSET ?
      `,
      [...params, pageSize, offset]
    ),
    readCount(db, `SELECT COUNT(*) AS count FROM aleta_sipp_tables t WHERE ${whereSql}`, params),
    db.queryAll<{ category: string; count?: string | number | bigint | null }>(
      "SELECT category, COUNT(*) AS count FROM aleta_sipp_tables WHERE is_active = 1 GROUP BY category ORDER BY category"
    ),
  ]);
  return {
    rows: rows.map(mapDictionaryListRow),
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    categories: categories.map((row) => ({ category: row.category, count: countValue(row) })),
  };
}

async function getDictionaryTableCore(db: AletaDatabase, tableName: string) {
  const normalizedTable = decodeURIComponent(tableName || "").trim();
  const table = await db.queryOne<AletaSippTableRow>(
    `
    SELECT ${DICTIONARY_TABLE_SELECT}
    FROM aleta_sipp_tables t
    WHERE t.table_name = ? AND t.is_active = 1
    LIMIT 1
    `,
    [normalizedTable]
  );
  if (!table) notFound("Metadata tabel SIPP belum ditemukan. Jalankan import struktur SQL dari admin.");
  const [columns, relations] = await Promise.all([
    db.queryAll<AletaSippColumnRow>(
      `
      SELECT ${DICTIONARY_COLUMN_SELECT}
      FROM aleta_sipp_columns
      WHERE table_name = ?
      ORDER BY sort_order, column_name
      `,
      [normalizedTable]
    ),
    db.queryAll<AletaSippRelationRow>(
      `
      SELECT id, source_table, source_column, target_table, target_column, relation_type,
        confidence, description, example_query_key, is_active, created_at, updated_at
      FROM aleta_sipp_relations
      WHERE is_active = 1 AND (source_table = ? OR target_table = ?)
      ORDER BY source_table, source_column, target_table
      `,
      [normalizedTable, normalizedTable]
    ),
  ]);
  return { normalizedTable, table, columns, relations };
}

export async function getAletaSippDictionaryTableDetail(db: AletaDatabase, actor: UserPersona, tableName: string) {
  requireAletaSippPermissionForAction(
    actor,
    ALETA_SIPP_PERMISSION.VIEW_DICTIONARY,
    "Anda tidak memiliki izin melihat detail kamus tabel SIPP."
  );
  const { normalizedTable, table, columns, relations } = await getDictionaryTableCore(db, tableName);
  const [relatedQueryRegistry, relatedVariables] = await Promise.all([
    db.queryAll<AletaSippQueryRegistryRow>(
      `
      SELECT id, query_key, name, category, source, short_description, long_description,
        tables_json, output_columns_json, original_sql, normalized_sql, security_status,
        role_scope_json, ai_allowed, whatsapp_allowed, pdf_allowed, risk_notes_json,
        is_active, created_at, updated_at
      FROM aleta_sipp_query_registry
      WHERE is_active = 1 AND LOWER(tables_json::text) LIKE ?
      ORDER BY category, query_key
      LIMIT 20
      `,
      [`%"${normalizedTable.toLowerCase()}"%`]
    ),
    db.queryAll<AletaSippVariableRow>(
      `
      SELECT id, legacy_source, legacy_code, modern_key, display_name, description, data_type,
        source_type, source_table, source_column, query_id, transform_key, example_value,
        status, sensitive, is_active, created_at, updated_at
      FROM aleta_sipp_variables
      WHERE is_active = 1 AND source_table = ?
      ORDER BY legacy_source, legacy_code, modern_key
      LIMIT 25
      `,
      [normalizedTable]
    ),
  ]);
  return {
    table: mapTableRow(table),
    longDescription: table.long_description,
    businessFunction: table.business_function ?? table.function_in_case_process,
    mainColumnsSummary: table.main_columns_summary ?? "",
    relationSummary: table.relation_summary ?? "",
    usageExamples: asStringArray(table.usage_examples),
    dataQualityNotes: table.data_quality_notes ?? "",
    exampleQueries: [buildExampleQuery(normalizedTable, columns)],
    columns: columns.map(mapColumnRow),
    relations: relations.map((relation) => ({
      id: relation.id,
      sourceTable: relation.source_table,
      sourceColumn: relation.source_column,
      targetTable: relation.target_table,
      targetColumn: relation.target_column,
      relationType: relation.relation_type,
      confidence: relation.confidence,
      description: relation.description,
      exampleQueryKey: relation.example_query_key,
      createdAt: relation.created_at,
      updatedAt: relation.updated_at,
    })),
    relatedQueryRegistry: relatedQueryRegistry.map(mapQueryRegistryRow),
    relatedVariables: relatedVariables.map(mapVariableRow),
    notes: {
      riskNotes: asStringArray(table.risk_notes),
      reviewNotes: table.review_notes ?? "",
    },
  };
}

async function applyDictionaryAnalysisToTable(
  db: AletaDatabase,
  actor: UserPersona,
  tableName: string,
  options: { force?: boolean } = {}
) {
  const { table, columns, relations } = await getDictionaryTableCore(db, tableName);
  if (table.review_status === "ADMIN_REVIEWED" && !options.force) {
    return {
      tableName: table.table_name,
      status: "SKIPPED_ADMIN_REVIEWED",
      analysisStatus: table.analysis_status ?? "UNKNOWN",
      reviewStatus: table.review_status,
    };
  }
  const analysis = analyzeTableMetadata(table, columns, relations);
  const now = new Date().toISOString();

  await db.run(
    `
    UPDATE aleta_sipp_tables
    SET
      human_name = ?,
      category = ?,
      priority = ?,
      short_description = ?,
      long_description = ?,
      function_in_case_process = ?,
      business_function = ?,
      main_columns_summary = ?,
      relation_summary = ?,
      usage_examples = ?::jsonb,
      data_quality_notes = ?,
      analysis_status = ?,
      confidence_score = ?,
      review_status = ?,
      risk_notes = ?::jsonb,
      example_usage = ?,
      updated_by = ?,
      updated_at = ?,
      analyzed_at = ?
    WHERE table_name = ?
    `,
    [
      analysis.humanName,
      analysis.category,
      analysis.priority,
      analysis.shortDescription,
      analysis.longDescription,
      analysis.businessFunction,
      analysis.businessFunction,
      analysis.mainColumnsSummary,
      analysis.relationSummary,
      jsonString(analysis.usageExamples),
      analysis.dataQualityNotes,
      analysis.analysisStatus,
      analysis.confidenceScore,
      analysis.reviewStatus,
      jsonString(analysis.riskNotes),
      analysis.exampleUsage,
      actor.id,
      now,
      now,
      table.table_name,
    ]
  );

  for (const column of columns) {
    const columnAnalysis = describeColumn(table.table_name, column, relations.filter((relation) => relation.source_table === table.table_name));
    await db.run(
      `
      UPDATE aleta_sipp_columns
      SET
        human_name = ?,
        description = ?,
        usage_notes = ?,
        analysis_status = ?,
        confidence_score = ?,
        quality_notes = ?,
        updated_at = ?
      WHERE id = ?
      `,
      [
        inferColumnHumanName(column.column_name),
        columnAnalysis.description,
        columnAnalysis.usageNotes,
        columnAnalysis.analysisStatus,
        columnAnalysis.confidenceScore,
        columnAnalysis.usageNotes,
        now,
        column.id,
      ]
    );
  }

  return {
    tableName: table.table_name,
    status: "ANALYZED",
    analysisStatus: analysis.analysisStatus,
    reviewStatus: analysis.reviewStatus,
    confidenceScore: analysis.confidenceScore,
  };
}

export async function analyzeAletaSippDictionaryTable(
  db: AletaDatabase,
  actor: UserPersona,
  tableName: string,
  options: { force?: boolean } = {}
) {
  requireAletaSippPermissionForAction(
    actor,
    ALETA_SIPP_PERMISSION.MANAGE_SETTINGS,
    "Anda tidak memiliki izin menganalisis kamus tabel SIPP."
  );
  return applyDictionaryAnalysisToTable(db, actor, tableName, options);
}

function parseAnalyzeContinueToken(value: string | undefined) {
  if (!value?.trim()) return null;
  const [jobId, offset] = value.split(":");
  if (!jobId || !offset) return null;
  return { jobId, offset: Number(offset) || 0 };
}

export async function analyzeAllAletaSippDictionary(
  db: AletaDatabase,
  actor: UserPersona,
  input: { batchSize?: number; offset?: number; continueToken?: string; force?: boolean } = {}
) {
  requireAletaSippPermissionForAction(
    actor,
    ALETA_SIPP_PERMISSION.MANAGE_SETTINGS,
    "Anda tidak memiliki izin menganalisis semua tabel kamus SIPP."
  );
  const batchSize = Math.max(1, Math.min(100, Number(input.batchSize || 25)));
  const parsedToken = parseAnalyzeContinueToken(input.continueToken);
  const offset = Math.max(0, parsedToken?.offset ?? Number(input.offset || 0));
  const total = await readCount(db, "SELECT COUNT(*) AS count FROM aleta_sipp_tables WHERE is_active = 1");
  const now = new Date().toISOString();
  const jobId = parsedToken?.jobId || stableId("sipp_dictionary_analyze", String(Date.now()));

  if (!parsedToken) {
    await db.run(
      `
      INSERT INTO aleta_sipp_import_jobs (
        id, import_type, source_path, mode, status, summary_json, error_message, executed_by, started_at, finished_at, created_at
      )
      VALUES (?, 'DICTIONARY_ANALYZE', 'aleta_sipp_metadata', ?, 'RUNNING', ?::jsonb, NULL, ?, ?, NULL, ?)
      `,
      [jobId, input.force ? "force" : "auto", jsonString({ total, done: 0, batchSize }), actor.id, now, now]
    );
  }

  const rows = await db.queryAll<{ table_name: string }>(
    `
    SELECT table_name
    FROM aleta_sipp_tables
    WHERE is_active = 1
    ORDER BY table_name ASC
    LIMIT ? OFFSET ?
    `,
    [batchSize, offset]
  );
  const results = [];
  let failed = 0;
  let needsReview = 0;

  for (const row of rows) {
    try {
      const result = await applyDictionaryAnalysisToTable(db, actor, row.table_name, { force: input.force });
      if (result.analysisStatus === "NEEDS_REVIEW" || result.reviewStatus === "NEEDS_ADMIN_REVIEW") needsReview += 1;
      results.push(result);
    } catch (error) {
      failed += 1;
      results.push({
        tableName: row.table_name,
        status: "FAILED",
        error: error instanceof Error ? error.message : "Analisis tabel gagal.",
      });
    }
  }

  const nextOffset = offset + rows.length;
  const finished = nextOffset >= total || rows.length === 0;
  const finishedAt = finished ? new Date().toISOString() : null;
  const summary = {
    total,
    batchSize,
    offset,
    nextOffset,
    processedThisBatch: rows.length,
    failedThisBatch: failed,
    needsReviewThisBatch: needsReview,
    finished,
  };
  await db.run(
    `
    UPDATE aleta_sipp_import_jobs
    SET status = ?, summary_json = ?::jsonb, error_message = ?, finished_at = ?
    WHERE id = ?
    `,
    [
      finished ? "SUCCESS" : "RUNNING",
      jsonString(summary),
      failed > 0 ? `${failed} tabel gagal dianalisis pada batch ini.` : null,
      finishedAt,
      jobId,
    ]
  );

  return {
    jobId,
    total,
    batchSize,
    offset,
    nextOffset,
    processed: rows.length,
    failed,
    needsReview,
    finished,
    continueToken: finished ? null : `${jobId}:${nextOffset}`,
    results,
  };
}

export async function updateAletaSippDictionaryTable(
  db: AletaDatabase,
  actor: UserPersona,
  tableName: string,
  input: {
    humanName?: string;
    category?: string;
    shortDescription?: string;
    longDescription?: string;
    businessFunction?: string;
    dataQualityNotes?: string;
    reviewNotes?: string;
    analysisStatus?: string;
  }
) {
  requireAletaSippPermissionForAction(
    actor,
    ALETA_SIPP_PERMISSION.MANAGE_SETTINGS,
    "Anda tidak memiliki izin mengedit kamus tabel SIPP."
  );
  const current = await db.queryOne<AletaSippTableRow>(
    `SELECT ${DICTIONARY_TABLE_SELECT} FROM aleta_sipp_tables t WHERE t.table_name = ? AND t.is_active = 1 LIMIT 1`,
    [decodeURIComponent(tableName || "").trim()]
  );
  if (!current) notFound("Metadata tabel SIPP tidak ditemukan.");
  const now = new Date().toISOString();
  await db.run(
    `
    UPDATE aleta_sipp_tables
    SET
      human_name = ?,
      category = ?,
      short_description = ?,
      long_description = ?,
      function_in_case_process = ?,
      business_function = ?,
      data_quality_notes = ?,
      review_notes = ?,
      analysis_status = ?,
      review_status = 'ADMIN_REVIEWED',
      reviewed_by = ?,
      reviewed_at = ?,
      updated_by = ?,
      updated_at = ?
    WHERE table_name = ?
    `,
    [
      input.humanName?.trim() || current.human_name,
      input.category?.trim() || current.category,
      input.shortDescription?.trim() || current.short_description,
      input.longDescription?.trim() || current.long_description,
      input.businessFunction?.trim() || current.function_in_case_process,
      input.businessFunction?.trim() || current.business_function || current.function_in_case_process,
      input.dataQualityNotes?.trim() || current.data_quality_notes || "",
      input.reviewNotes?.trim() || current.review_notes || "",
      input.analysisStatus?.trim() || current.analysis_status || "ANALYZED",
      actor.id,
      now,
      actor.id,
      now,
      current.table_name,
    ]
  );
  return getAletaSippDictionaryTableDetail(db, actor, current.table_name);
}

export async function getAletaSippQueries(
  db: AletaDatabase,
  actor: UserPersona,
  input: { q?: string; status?: string; limit?: number; offset?: number } = {}
) {
  requireAletaSippPermissionForAction(
    actor,
    ALETA_SIPP_PERMISSION.VIEW_QUERY_REGISTRY,
    "Anda tidak memiliki izin melihat Query Registry SIPP."
  );
  const { limit, offset } = pagination(input);
  const where: string[] = ["is_active = 1"];
  const params: Array<string | number | boolean | null> = [];
  if (input.status?.trim()) {
    where.push("security_status = ?");
    params.push(input.status.trim());
  }
  if (input.q?.trim()) {
    where.push("(LOWER(query_key) LIKE ? OR LOWER(name) LIKE ? OR LOWER(category) LIKE ?)");
    const q = normalizeLike(input.q);
    params.push(q, q, q);
  }
  const whereSql = where.join(" AND ");
  const [rows, total, statusRows] = await Promise.all([
    db.queryAll<AletaSippQueryRegistryRow>(
      `
      SELECT id, query_key, name, category, source, short_description, long_description,
        tables_json, output_columns_json, original_sql, normalized_sql, security_status,
        role_scope_json, ai_allowed, whatsapp_allowed, pdf_allowed, risk_notes_json,
        is_active, created_at, updated_at
      FROM aleta_sipp_query_registry
      WHERE ${whereSql}
      ORDER BY category, query_key
      LIMIT ? OFFSET ?
      `,
      [...params, limit, offset]
    ),
    readCount(db, `SELECT COUNT(*) AS count FROM aleta_sipp_query_registry WHERE ${whereSql}`, params),
    db.queryAll<{ security_status: string; count?: string | number | bigint | null }>(
      "SELECT security_status, COUNT(*) AS count FROM aleta_sipp_query_registry WHERE is_active = 1 GROUP BY security_status ORDER BY security_status"
    ),
  ]);
  return {
    rows: rows.map(mapQueryRegistryRow),
    statusCounts: Object.fromEntries(statusRows.map((row) => [row.security_status, countValue(row)])),
    pagination: { limit, offset, total },
  };
}

export async function getAletaSippVariables(
  db: AletaDatabase,
  actor: UserPersona,
  input: { q?: string; status?: string; limit?: number; offset?: number } = {}
) {
  requireAletaSippPermissionForAction(
    actor,
    ALETA_SIPP_PERMISSION.VIEW_VARIABLE_REGISTRY,
    "Anda tidak memiliki izin melihat Variable Registry SIPP."
  );
  const { limit, offset } = pagination(input);
  const where: string[] = ["is_active = 1"];
  const params: Array<string | number | boolean | null> = [];
  if (input.status?.trim()) {
    where.push("status = ?");
    params.push(input.status.trim());
  }
  if (input.q?.trim()) {
    where.push("(LOWER(legacy_code) LIKE ? OR LOWER(modern_key) LIKE ? OR LOWER(display_name) LIKE ?)");
    const q = normalizeLike(input.q);
    params.push(q, q, q);
  }
  const whereSql = where.join(" AND ");
  const [rows, total] = await Promise.all([
    db.queryAll<AletaSippVariableRow>(
      `
      SELECT id, legacy_source, legacy_code, modern_key, display_name, description, data_type,
        source_type, source_table, source_column, query_id, transform_key, example_value,
        status, sensitive, is_active, created_at, updated_at
      FROM aleta_sipp_variables
      WHERE ${whereSql}
      ORDER BY legacy_source, legacy_code, modern_key
      LIMIT ? OFFSET ?
      `,
      [...params, limit, offset]
    ),
    readCount(db, `SELECT COUNT(*) AS count FROM aleta_sipp_variables WHERE ${whereSql}`, params),
  ]);
  return { rows: rows.map(mapVariableRow), pagination: { limit, offset, total } };
}

export async function getAletaSippQueryRegistryStats(db: AletaDatabase, actor: UserPersona) {
  requireAletaSippPermissionForAction(
    actor,
    ALETA_SIPP_PERMISSION.VIEW_QUERY_REGISTRY,
    "Anda tidak memiliki izin melihat Query Registry SIPP."
  );
  const [total, safe, needsReview, rejected, unsafeRaw, executable, dictionaryOnly, categories, sources, safetyStatuses, executionModes, reviews, tableLinks, variableLinks, lastImport] = await Promise.all([
    readCount(db, "SELECT COUNT(*) AS count FROM aleta_sipp_query_registry WHERE is_active = 1"),
    readCount(db, "SELECT COUNT(*) AS count FROM aleta_sipp_query_registry WHERE is_active = 1 AND security_status = 'SAFE_READ_ONLY'"),
    readCount(db, "SELECT COUNT(*) AS count FROM aleta_sipp_query_registry WHERE is_active = 1 AND security_status = 'NEEDS_REVIEW'"),
    readCount(db, "SELECT COUNT(*) AS count FROM aleta_sipp_query_registry WHERE is_active = 1 AND security_status = 'REJECTED_WRITE_QUERY'"),
    readCount(db, "SELECT COUNT(*) AS count FROM aleta_sipp_query_registry WHERE is_active = 1 AND security_status = 'UNSAFE_RAW_SQL'"),
    readCount(db, "SELECT COUNT(*) AS count FROM aleta_sipp_query_registry WHERE is_active = 1 AND execution_mode = 'READY_READ_ONLY'"),
    readCount(db, "SELECT COUNT(*) AS count FROM aleta_sipp_query_registry WHERE is_active = 1 AND execution_mode = 'DICTIONARY_ONLY'"),
    db.queryAll<{ category: string; count?: string | number | bigint | null }>(
      "SELECT category, COUNT(*) AS count FROM aleta_sipp_query_registry WHERE is_active = 1 GROUP BY category ORDER BY COUNT(*) DESC, category"
    ),
    db.queryAll<{ source_type: string; count?: string | number | bigint | null }>(
      "SELECT COALESCE(NULLIF(source_type, ''), source) AS source_type, COUNT(*) AS count FROM aleta_sipp_query_registry WHERE is_active = 1 GROUP BY COALESCE(NULLIF(source_type, ''), source) ORDER BY COUNT(*) DESC"
    ),
    db.queryAll<{ security_status: string; count?: string | number | bigint | null }>(
      "SELECT COALESCE(NULLIF(security_status, ''), 'NEEDS_REVIEW') AS security_status, COUNT(*) AS count FROM aleta_sipp_query_registry WHERE is_active = 1 GROUP BY COALESCE(NULLIF(security_status, ''), 'NEEDS_REVIEW') ORDER BY security_status"
    ),
    db.queryAll<{ execution_mode: string; count?: string | number | bigint | null }>(
      "SELECT COALESCE(NULLIF(execution_mode, ''), 'NEEDS_REVIEW') AS execution_mode, COUNT(*) AS count FROM aleta_sipp_query_registry WHERE is_active = 1 GROUP BY COALESCE(NULLIF(execution_mode, ''), 'NEEDS_REVIEW') ORDER BY execution_mode"
    ),
    db.queryAll<{ review_status: string; count?: string | number | bigint | null }>(
      "SELECT COALESCE(NULLIF(review_status, ''), 'NEEDS_ADMIN_REVIEW') AS review_status, COUNT(*) AS count FROM aleta_sipp_query_registry WHERE is_active = 1 GROUP BY COALESCE(NULLIF(review_status, ''), 'NEEDS_ADMIN_REVIEW') ORDER BY review_status"
    ),
    readCount(db, "SELECT COUNT(*) AS count FROM aleta_sipp_query_table_links"),
    readCount(db, "SELECT COUNT(*) AS count FROM aleta_sipp_query_variable_links"),
    db.queryOne<AletaSippImportJobRow>(
      "SELECT id, import_type, source_path, mode, status, summary_json, error_message, executed_by, started_at, finished_at, created_at FROM aleta_sipp_import_jobs WHERE import_type = 'QUERY_REGISTRY_IMPORT' ORDER BY created_at DESC LIMIT 1"
    ),
  ]);
  return {
    total,
    safeReadOnly: safe,
    needsReview,
    rejectedWrite: rejected,
    unsafeRawSql: unsafeRaw,
    executableReadOnly: executable,
    readyReadOnly: executable,
    dictionaryOnly,
    tableLinks,
    variableLinks,
    categories: categories.map((row) => ({ category: row.category, count: countValue(row) })),
    sources: sources.map((row) => ({ sourceType: row.source_type, count: countValue(row) })),
    safetyStatuses: safetyStatuses.map((row) => ({ safetyStatus: row.security_status, count: countValue(row) })),
    executionModes: executionModes.map((row) => ({ executionMode: row.execution_mode, count: countValue(row) })),
    reviews: reviews.map((row) => ({ reviewStatus: row.review_status, count: countValue(row) })),
    lastImport,
  };
}

export async function getAletaSippQueryRegistry(
  db: AletaDatabase,
  actor: UserPersona,
  input: {
    q?: string;
    category?: string;
    sourceType?: string;
    status?: string;
    securityStatus?: string;
    reviewStatus?: string;
    executionMode?: string;
    tableName?: string;
    variableCode?: string;
    limit?: number;
    offset?: number;
  } = {}
) {
  requireAletaSippPermissionForAction(
    actor,
    ALETA_SIPP_PERMISSION.VIEW_QUERY_REGISTRY,
    "Anda tidak memiliki izin melihat Query Registry SIPP."
  );
  const { limit, offset } = pagination(input);
  const where: string[] = ["is_active = 1"];
  const params: Array<string | number | boolean | null> = [];
  const securityStatus = input.securityStatus || input.status;
  if (input.q?.trim()) {
    where.push("(LOWER(query_key) LIKE ? OR LOWER(name) LIKE ? OR LOWER(query_name) LIKE ? OR LOWER(category) LIKE ? OR LOWER(source_file) LIKE ?)");
    const q = normalizeLike(input.q);
    params.push(q, q, q, q, q);
  }
  if (input.category?.trim()) {
    where.push("category = ?");
    params.push(input.category.trim());
  }
  if (input.sourceType?.trim()) {
    where.push("COALESCE(NULLIF(source_type, ''), source) = ?");
    params.push(input.sourceType.trim());
  }
  if (securityStatus?.trim()) {
    where.push("security_status = ?");
    params.push(securityStatus.trim());
  }
  if (input.reviewStatus?.trim()) {
    where.push("review_status = ?");
    params.push(input.reviewStatus.trim());
  }
  if (input.executionMode?.trim()) {
    where.push("execution_mode = ?");
    params.push(input.executionMode.trim());
  }
  if (input.tableName?.trim()) {
    where.push(
      `(EXISTS (
        SELECT 1 FROM aleta_sipp_query_table_links qtl
        WHERE qtl.query_key = aleta_sipp_query_registry.query_key AND qtl.table_name = ?
      ) OR LOWER(COALESCE(related_table_names_json::text, tables_json::text, '')) LIKE ?)`
    );
    params.push(input.tableName.trim(), normalizeLike(input.tableName.trim()));
  }
  if (input.variableCode?.trim()) {
    where.push(
      `(EXISTS (
        SELECT 1 FROM aleta_sipp_query_variable_links qvl
        WHERE qvl.query_key = aleta_sipp_query_registry.query_key AND (qvl.legacy_code = ? OR qvl.variable_key = ?)
      ) OR LOWER(COALESCE(related_variable_codes_json::text, '') || COALESCE(related_variable_keys_json::text, '')) LIKE ?)`
    );
    params.push(input.variableCode.trim(), input.variableCode.trim(), normalizeLike(input.variableCode.trim()));
  }
  const whereSql = where.join(" AND ");
  const [rows, total, categories, sources, statuses] = await Promise.all([
    db.queryAll<AletaSippQueryRegistryRow>(
      `
      SELECT ${ALETA_SIPP_QUERY_REGISTRY_SELECT}
      FROM aleta_sipp_query_registry
      WHERE ${whereSql}
      ORDER BY category, query_key
      LIMIT ? OFFSET ?
      `,
      [...params, limit, offset]
    ),
    readCount(db, `SELECT COUNT(*) AS count FROM aleta_sipp_query_registry WHERE ${whereSql}`, params),
    db.queryAll<{ category: string; count?: string | number | bigint | null }>(
      "SELECT category, COUNT(*) AS count FROM aleta_sipp_query_registry WHERE is_active = 1 GROUP BY category ORDER BY category"
    ),
    db.queryAll<{ source_type: string; count?: string | number | bigint | null }>(
      "SELECT COALESCE(NULLIF(source_type, ''), source) AS source_type, COUNT(*) AS count FROM aleta_sipp_query_registry WHERE is_active = 1 GROUP BY COALESCE(NULLIF(source_type, ''), source) ORDER BY source_type"
    ),
    db.queryAll<{ security_status: string; count?: string | number | bigint | null }>(
      "SELECT security_status, COUNT(*) AS count FROM aleta_sipp_query_registry WHERE is_active = 1 GROUP BY security_status ORDER BY security_status"
    ),
  ]);
  return {
    rows: rows.map(mapQueryRegistryRow),
    pagination: { limit, offset, total },
    categories: categories.map((row) => ({ category: row.category, count: countValue(row) })),
    sources: sources.map((row) => ({ sourceType: row.source_type, count: countValue(row) })),
    statusCounts: Object.fromEntries(statuses.map((row) => [row.security_status, countValue(row)])),
  };
}

export async function getAletaSippQueryRegistryDetail(db: AletaDatabase, actor: UserPersona, queryKey: string) {
  requireAletaSippPermissionForAction(
    actor,
    ALETA_SIPP_PERMISSION.VIEW_QUERY_REGISTRY,
    "Anda tidak memiliki izin melihat Query Registry SIPP."
  );
  const normalizedKey = decodeURIComponent(queryKey || "").trim();
  const row = await db.queryOne<AletaSippQueryRegistryRow>(
    `SELECT ${ALETA_SIPP_QUERY_REGISTRY_SELECT} FROM aleta_sipp_query_registry WHERE query_key = ? AND is_active = 1 LIMIT 1`,
    [normalizedKey]
  );
  if (!row) notFound("Query Registry SIPP tidak ditemukan.");
  const [parameters, outputs, tableLinks, variableLinks] = await Promise.all([
    db.queryAll<Record<string, unknown>>(
      "SELECT name, label, data_type, required, default_value, validation_rule, example_value, sort_order FROM aleta_sipp_query_parameters WHERE query_id = ? ORDER BY sort_order, name",
      [row.id]
    ),
    db.queryAll<Record<string, unknown>>(
      "SELECT column_name, label, data_type, description, sensitive, sort_order FROM aleta_sipp_query_outputs WHERE query_id = ? ORDER BY sort_order, column_name",
      [row.id]
    ),
    db.queryAll<Record<string, unknown>>(
      "SELECT table_name, column_names_json, relation_role, confidence_score FROM aleta_sipp_query_table_links WHERE query_key = ? ORDER BY table_name",
      [row.query_key]
    ),
    db.queryAll<Record<string, unknown>>(
      `
      SELECT qvl.legacy_code, qvl.variable_key, qvl.mapping_status, qvl.source_context,
        v.modern_key, v.display_name, v.category, v.source_table, v.source_column, v.status
      FROM aleta_sipp_query_variable_links qvl
      LEFT JOIN aleta_sipp_variables v ON v.id = qvl.variable_id OR v.legacy_code = qvl.legacy_code OR v.modern_key = qvl.variable_key
      WHERE qvl.query_key = ?
      ORDER BY qvl.legacy_code, qvl.variable_key
      `,
      [row.query_key]
    ),
  ]);
  return {
    ...mapQueryRegistryRow(row, { includeSql: canViewAletaSippSqlPreview(actor) }),
    registryParameters: parameters,
    registryOutputs: outputs,
    tableLinks: tableLinks.map((link) => ({ ...link, columnNames: asStringArray(link.column_names_json) })),
    variableLinks,
  };
}

export async function updateAletaSippQueryRegistry(
  db: AletaDatabase,
  actor: UserPersona,
  queryKey: string,
  input: {
    name?: string;
    queryName?: string;
    queryTitle?: string;
    category?: string;
    subCategory?: string;
    businessPurpose?: string;
    shortDescription?: string;
    longDescription?: string;
    usageNotes?: string;
    riskNotes?: string;
    originalSql?: string;
    normalizedSql?: string;
    securityStatus?: string;
    reviewStatus?: string;
    allowedForAi?: boolean;
    allowedForWhatsapp?: boolean;
    allowedForPdf?: boolean;
  }
) {
  requireAletaSippPermissionForAction(
    actor,
    ALETA_SIPP_PERMISSION.MANAGE_QUERY_REGISTRY,
    "Anda tidak memiliki izin mengedit Query Registry SIPP."
  );
  const current = await db.queryOne<AletaSippQueryRegistryRow>(
    `SELECT ${ALETA_SIPP_QUERY_REGISTRY_SELECT} FROM aleta_sipp_query_registry WHERE query_key = ? AND is_active = 1 LIMIT 1`,
    [decodeURIComponent(queryKey || "").trim()]
  );
  if (!current) notFound("Query Registry SIPP tidak ditemukan.");

  const originalSql = input.originalSql !== undefined ? input.originalSql.trim() : current.original_sql;
  const normalizedSql = normalizeSqlText(input.normalizedSql !== undefined ? input.normalizedSql : (originalSql || current.normalized_sql));
  const safety = safetyForSql(normalizedSql);
  const securityStatus = safety.safetyStatus === "REJECTED_WRITE_QUERY" ? "REJECTED_WRITE_QUERY" : (input.securityStatus?.trim() || safety.safetyStatus);
  const executionMode = safety.safetyStatus === "SAFE_READ_ONLY" ? safety.executionMode : "DICTIONARY_ONLY";
  const now = new Date().toISOString();
  const allowedForAi = input.allowedForAi ?? (current.is_ai_usable === 1 || current.ai_allowed === 1);
  const allowedForWhatsapp = input.allowedForWhatsapp ?? (current.is_whatsapp_usable === 1 || current.whatsapp_allowed === 1);
  const allowedForPdf = input.allowedForPdf ?? (current.is_pdf_usable === 1 || current.pdf_allowed === 1);

  await db.run(
    `
    UPDATE aleta_sipp_query_registry
    SET
      name = ?,
      query_name = ?,
      query_title = ?,
      category = ?,
      sub_category = ?,
      business_purpose = ?,
      short_description = ?,
      long_description = ?,
      original_sql = ?,
      normalized_sql = ?,
      parameterized_sql = ?,
      sql_hash = ?,
      execution_mode = ?,
      security_status = ?,
      review_status = ?,
      confidence_score = ?,
      ai_allowed = ?,
      whatsapp_allowed = ?,
      pdf_allowed = ?,
      is_ai_usable = ?,
      is_whatsapp_usable = ?,
      is_pdf_usable = ?,
      risk_notes = ?,
      risk_notes_json = ?::jsonb,
      usage_notes = ?,
      updated_by = ?,
      updated_at = ?
    WHERE id = ?
    `,
    [
      input.name?.trim() || current.name,
      input.queryName?.trim() || current.query_name || current.name,
      input.queryTitle?.trim() || current.query_title || current.query_name || current.name,
      input.category?.trim() || current.category,
      input.subCategory?.trim() ?? current.sub_category ?? "",
      input.businessPurpose?.trim() || current.business_purpose || "",
      input.shortDescription?.trim() || current.short_description,
      input.longDescription?.trim() || current.long_description,
      originalSql,
      normalizedSql,
      parameterizeSql(normalizedSql),
      sqlHash(normalizedSql),
      executionMode,
      securityStatus,
      input.reviewStatus?.trim() || "ADMIN_REVIEWED",
      safety.confidenceScore,
      allowedForAi ? 1 : 0,
      allowedForWhatsapp ? 1 : 0,
      allowedForPdf ? 1 : 0,
      allowedForAi ? 1 : 0,
      allowedForWhatsapp ? 1 : 0,
      allowedForPdf ? 1 : 0,
      input.riskNotes?.trim() || safety.riskNotes || current.risk_notes || "",
      jsonString(input.riskNotes?.trim() ? [input.riskNotes.trim()] : asStringArray(current.risk_notes_json)),
      input.usageNotes?.trim() || current.usage_notes || "",
      actor.id,
      now,
      current.id,
    ]
  );
  return getAletaSippQueryRegistryDetail(db, actor, current.query_key);
}

export async function analyzeAletaSippQueryRegistry(db: AletaDatabase, actor: UserPersona, queryKey: string) {
  requireAletaSippPermissionForAction(
    actor,
    ALETA_SIPP_PERMISSION.MANAGE_QUERY_REGISTRY,
    "Anda tidak memiliki izin menganalisis Query Registry SIPP."
  );
  const current = await db.queryOne<AletaSippQueryRegistryRow>(
    `SELECT ${ALETA_SIPP_QUERY_REGISTRY_SELECT} FROM aleta_sipp_query_registry WHERE query_key = ? AND is_active = 1 LIMIT 1`,
    [decodeURIComponent(queryKey || "").trim()]
  );
  if (!current) notFound("Query Registry SIPP tidak ditemukan.");
  const tables = await listKnownSippTables(db);
  const knownTables = new Set(tables.map((table) => table.table_name));
  await db.run("DELETE FROM aleta_sipp_query_table_links WHERE query_key = ?", [current.query_key]);
  await db.run("DELETE FROM aleta_sipp_query_variable_links WHERE query_key = ?", [current.query_key]);
  await upsertRegistryQuery(db, actor, queryCandidateFromStoredRow(current, knownTables));
  return getAletaSippQueryRegistryDetail(db, actor, current.query_key);
}

export async function testAletaSippQueryRegistry(db: AletaDatabase, actor: UserPersona, queryKey: string, input: { params?: Record<string, unknown> } = {}) {
  requireAletaSippPermissionForAction(
    actor,
    ALETA_SIPP_PERMISSION.RUN_REGISTERED_QUERY,
    "Anda tidak memiliki izin menguji Query Registry SIPP."
  );
  const current = await db.queryOne<AletaSippQueryRegistryRow>(
    `SELECT ${ALETA_SIPP_QUERY_REGISTRY_SELECT} FROM aleta_sipp_query_registry WHERE query_key = ? AND is_active = 1 LIMIT 1`,
    [decodeURIComponent(queryKey || "").trim()]
  );
  if (!current) notFound("Query Registry SIPP tidak ditemukan.");
  const normalizedSql = normalizeSqlText(current.normalized_sql || current.original_sql);
  const safety = safetyForSql(normalizedSql);
  const parameters = extractParametersFromSql(normalizedSql);
  const missing = parameters.filter((param) => param.required !== false && input.params?.[String(param.name)] === undefined).map((param) => String(param.name));
  const executable = safety.safetyStatus === "SAFE_READ_ONLY" && missing.length === 0;
  return {
    queryKey: current.query_key,
    dryRun: true,
    executable,
    securityStatus: safety.safetyStatus,
    executionMode: executable ? "READY_READ_ONLY" : "BLOCKED_DRY_RUN",
    parameterizedSql: parameterizeSql(normalizedSql),
    requiredParameters: parameters,
    missingParameters: missing,
    note: executable
      ? "Query lolos validasi read-only dan parameter wajib tersedia. Endpoint test ini tidak menerima raw SQL bebas dari client."
      : "Query tidak dieksekusi karena belum aman/parameter belum lengkap. Unsafe/write SQL tetap tersimpan sebagai kandidat/rejected.",
  };
}

export async function importAletaSippQueryRegistry(
  db: AletaDatabase,
  actor: UserPersona,
  input: { batchSize?: number; offset?: number; continueToken?: string } = {}
) {
  requireAletaSippPermissionForAction(
    actor,
    ALETA_SIPP_PERMISSION.MANAGE_QUERY_REGISTRY,
    "Anda tidak memiliki izin import Query Registry SIPP."
  );
  const batch = registryBatch(input, "sipp_query_registry_import");
  const startedAt = new Date().toISOString();
  if (!batch.isContinuation) {
    await db.run(
      `
      INSERT INTO aleta_sipp_import_jobs (
        id, import_type, source_path, mode, status, summary_json, error_message, executed_by, started_at, finished_at, created_at
      )
      VALUES (?, 'QUERY_REGISTRY_IMPORT', 'ABT_XLS|WORD_DOCX|LEGACY_APPS|SIPP_METADATA', 'admin_scan', 'RUNNING', ?::jsonb, NULL, ?, ?, NULL, ?)
      `,
      [batch.jobId, jsonString({ offset: batch.offset, batchSize: batch.batchSize }), actor.id, startedAt, startedAt]
    );
  }

  const collected = await collectQueryRegistryCandidates(db);
  const selected = collected.candidates.slice(batch.offset, batch.offset + batch.batchSize);
  let imported = 0;
  let rejected = 0;
  let failed = 0;
  const failures: Array<{ queryKey: string; error: string }> = [];
  for (const candidate of selected) {
    try {
      await upsertRegistryQuery(db, actor, candidate);
      imported += 1;
      if (candidate.safetyStatus === "REJECTED_WRITE_QUERY") rejected += 1;
    } catch (error) {
      failed += 1;
      failures.push({ queryKey: candidate.queryKey, error: error instanceof Error ? error.message : "Import query gagal." });
    }
  }
  const nextOffset = batch.offset + selected.length;
  const finished = nextOffset >= collected.candidates.length;
  const finishedAt = finished ? new Date().toISOString() : null;
  const summary = {
    totalCandidates: collected.candidates.length,
    imported,
    rejected,
    failed,
    offset: batch.offset,
    nextOffset,
    finished,
    sourceCounts: collected.sourceCounts,
    scanned: collected.scanned,
    tableCount: collected.tableCount,
    abtRowCount: collected.abtRowCount,
  };
  await db.run(
    `
    UPDATE aleta_sipp_import_jobs
    SET status = ?, summary_json = ?::jsonb, error_message = ?, finished_at = ?
    WHERE id = ?
    `,
    [finished ? "SUCCESS" : "RUNNING", jsonString(summary), failed ? `${failed} query gagal diimport.` : null, finishedAt, batch.jobId]
  );
  return {
    jobId: batch.jobId,
    ...summary,
    processed: selected.length,
    batchSize: batch.hasExplicitBatch ? batch.batchSize : selected.length,
    continueToken: finished ? null : `${batch.jobId}:${nextOffset}`,
    failures: failures.slice(0, 20),
  };
}

export async function getAletaSippVariableRegistryStats(db: AletaDatabase, actor: UserPersona) {
  requireAletaSippPermissionForAction(
    actor,
    ALETA_SIPP_PERMISSION.VIEW_VARIABLE_REGISTRY,
    "Anda tidak memiliki izin melihat Variable Registry SIPP."
  );
  const [total, mapped, partial, unresolved, conflict, needsReview, categories, sources, legacySources, variableTypes, mappingStatuses, reviews, templateLinks] = await Promise.all([
    readCount(db, "SELECT COUNT(*) AS count FROM aleta_sipp_variables WHERE is_active = 1"),
    readCount(db, "SELECT COUNT(*) AS count FROM aleta_sipp_variables WHERE is_active = 1 AND mapping_status IN ('MAPPED_TO_TABLE_COLUMN', 'MAPPED_TO_QUERY', 'MAPPED_TO_COMPUTED', 'MAPPED_TO_MANUAL_INPUT', 'MAPPED_TO_SIPP_COLUMN', 'MAPPED_TO_QUERY_CANDIDATE', 'KNOWN_LEGACY_ALIAS', 'MAPPED')"),
    readCount(db, "SELECT COUNT(*) AS count FROM aleta_sipp_variables WHERE is_active = 1 AND mapping_status = 'PARTIAL'"),
    readCount(db, "SELECT COUNT(*) AS count FROM aleta_sipp_variables WHERE is_active = 1 AND mapping_status IN ('UNRESOLVED', 'NEEDS_REVIEW')"),
    readCount(db, "SELECT COUNT(*) AS count FROM aleta_sipp_variables WHERE is_active = 1 AND mapping_status = 'CONFLICT'"),
    readCount(db, "SELECT COUNT(*) AS count FROM aleta_sipp_variables WHERE is_active = 1 AND review_status = 'NEEDS_ADMIN_REVIEW'"),
    db.queryAll<{ category: string; count?: string | number | bigint | null }>(
      "SELECT category, COUNT(*) AS count FROM aleta_sipp_variables WHERE is_active = 1 GROUP BY category ORDER BY COUNT(*) DESC, category"
    ),
    db.queryAll<{ source_type: string; count?: string | number | bigint | null }>(
      "SELECT COALESCE(NULLIF(source_type, ''), legacy_source) AS source_type, COUNT(*) AS count FROM aleta_sipp_variables WHERE is_active = 1 GROUP BY COALESCE(NULLIF(source_type, ''), legacy_source) ORDER BY COUNT(*) DESC"
    ),
    db.queryAll<{ legacy_source: string; count?: string | number | bigint | null }>(
      "SELECT COALESCE(NULLIF(legacy_source, ''), 'UNKNOWN') AS legacy_source, COUNT(*) AS count FROM aleta_sipp_variables WHERE is_active = 1 GROUP BY COALESCE(NULLIF(legacy_source, ''), 'UNKNOWN') ORDER BY COUNT(*) DESC"
    ),
    db.queryAll<{ variable_type: string; count?: string | number | bigint | null }>(
      "SELECT COALESCE(NULLIF(variable_type, ''), 'UNKNOWN') AS variable_type, COUNT(*) AS count FROM aleta_sipp_variables WHERE is_active = 1 GROUP BY COALESCE(NULLIF(variable_type, ''), 'UNKNOWN') ORDER BY COUNT(*) DESC"
    ),
    db.queryAll<{ mapping_status: string; count?: string | number | bigint | null }>(
      "SELECT COALESCE(NULLIF(mapping_status, ''), 'UNRESOLVED') AS mapping_status, COUNT(*) AS count FROM aleta_sipp_variables WHERE is_active = 1 GROUP BY COALESCE(NULLIF(mapping_status, ''), 'UNRESOLVED') ORDER BY mapping_status"
    ),
    db.queryAll<{ review_status: string; count?: string | number | bigint | null }>(
      "SELECT COALESCE(NULLIF(review_status, ''), 'NEEDS_ADMIN_REVIEW') AS review_status, COUNT(*) AS count FROM aleta_sipp_variables WHERE is_active = 1 GROUP BY COALESCE(NULLIF(review_status, ''), 'NEEDS_ADMIN_REVIEW') ORDER BY review_status"
    ),
    readCount(db, "SELECT COUNT(*) AS count FROM aleta_sipp_variable_template_links"),
  ]);
  return {
    total,
    mapped,
    partial,
    unresolved,
    conflict,
    needsReview,
    templateLinks,
    categories: categories.map((row) => ({ category: row.category, count: countValue(row) })),
    sources: sources.map((row) => ({ sourceType: row.source_type, count: countValue(row) })),
    legacySources: legacySources.map((row) => ({ legacySource: row.legacy_source, count: countValue(row) })),
    variableTypes: variableTypes.map((row) => ({ variableType: row.variable_type, count: countValue(row) })),
    mappingStatuses: mappingStatuses.map((row) => ({ mappingStatus: row.mapping_status, count: countValue(row) })),
    reviews: reviews.map((row) => ({ reviewStatus: row.review_status, count: countValue(row) })),
  };
}

export async function getAletaSippVariableRegistry(
  db: AletaDatabase,
  actor: UserPersona,
  input: {
    q?: string;
    legacySource?: string;
    category?: string;
    sourceType?: string;
    variableType?: string;
    status?: string;
    mappingStatus?: string;
    reviewStatus?: string;
    queryKey?: string;
    tableName?: string;
    limit?: number;
    offset?: number;
  } = {}
) {
  requireAletaSippPermissionForAction(
    actor,
    ALETA_SIPP_PERMISSION.VIEW_VARIABLE_REGISTRY,
    "Anda tidak memiliki izin melihat Variable Registry SIPP."
  );
  const { limit, offset } = pagination(input);
  const where: string[] = ["is_active = 1"];
  const params: Array<string | number | boolean | null> = [];
  if (input.q?.trim()) {
    where.push("(LOWER(legacy_code) LIKE ? OR LOWER(variable_key) LIKE ? OR LOWER(modern_key) LIKE ? OR LOWER(display_name) LIKE ? OR LOWER(source_table) LIKE ? OR LOWER(source_column) LIKE ?)");
    const q = normalizeLike(input.q);
    params.push(q, q, q, q, q, q);
  }
  if (input.category?.trim()) {
    where.push("category = ?");
    params.push(input.category.trim());
  }
  if (input.legacySource?.trim()) {
    where.push("legacy_source = ?");
    params.push(input.legacySource.trim());
  }
  if (input.sourceType?.trim()) {
    where.push("source_type = ?");
    params.push(input.sourceType.trim());
  }
  if (input.variableType?.trim()) {
    where.push("variable_type = ?");
    params.push(input.variableType.trim());
  }
  if (input.queryKey?.trim()) {
    where.push(
      `(source_query_key = ? OR EXISTS (
        SELECT 1 FROM aleta_sipp_query_variable_links qvl
        WHERE (qvl.legacy_code = aleta_sipp_variables.legacy_code OR qvl.variable_key = aleta_sipp_variables.variable_key OR qvl.variable_key = aleta_sipp_variables.modern_key)
          AND qvl.query_key = ?
      ))`
    );
    params.push(input.queryKey.trim(), input.queryKey.trim());
  }
  if (input.tableName?.trim()) {
    where.push("source_table = ?");
    params.push(input.tableName.trim());
  }
  if (input.mappingStatus?.trim() || input.status?.trim()) {
    where.push("mapping_status = ?");
    params.push((input.mappingStatus || input.status || "").trim());
  }
  if (input.reviewStatus?.trim()) {
    where.push("review_status = ?");
    params.push(input.reviewStatus.trim());
  }
  const whereSql = where.join(" AND ");
  const [rows, total, categories, sources, statuses] = await Promise.all([
    db.queryAll<AletaSippVariableRow>(
      `
      SELECT ${ALETA_SIPP_VARIABLE_REGISTRY_SELECT}
      FROM aleta_sipp_variables
      WHERE ${whereSql}
      ORDER BY legacy_number NULLS LAST, legacy_code, modern_key
      LIMIT ? OFFSET ?
      `,
      [...params, limit, offset]
    ),
    readCount(db, `SELECT COUNT(*) AS count FROM aleta_sipp_variables WHERE ${whereSql}`, params),
    db.queryAll<{ category: string; count?: string | number | bigint | null }>(
      "SELECT category, COUNT(*) AS count FROM aleta_sipp_variables WHERE is_active = 1 GROUP BY category ORDER BY category"
    ),
    db.queryAll<{ source_type: string; count?: string | number | bigint | null }>(
      "SELECT COALESCE(NULLIF(source_type, ''), legacy_source) AS source_type, COUNT(*) AS count FROM aleta_sipp_variables WHERE is_active = 1 GROUP BY COALESCE(NULLIF(source_type, ''), legacy_source) ORDER BY source_type"
    ),
    db.queryAll<{ mapping_status: string; count?: string | number | bigint | null }>(
      "SELECT mapping_status, COUNT(*) AS count FROM aleta_sipp_variables WHERE is_active = 1 GROUP BY mapping_status ORDER BY mapping_status"
    ),
  ]);
  return {
    rows: rows.map(mapVariableRow),
    pagination: { limit, offset, total },
    categories: categories.map((row) => ({ category: row.category, count: countValue(row) })),
    sources: sources.map((row) => ({ sourceType: row.source_type, count: countValue(row) })),
    statusCounts: Object.fromEntries(statuses.map((row) => [row.mapping_status, countValue(row)])),
  };
}

export async function getAletaSippVariableRegistryDetail(db: AletaDatabase, actor: UserPersona, variableKeyOrLegacyCode: string) {
  requireAletaSippPermissionForAction(
    actor,
    ALETA_SIPP_PERMISSION.VIEW_VARIABLE_REGISTRY,
    "Anda tidak memiliki izin melihat Variable Registry SIPP."
  );
  const key = decodeURIComponent(variableKeyOrLegacyCode || "").trim();
  const row = await db.queryOne<AletaSippVariableRow>(
    `
    SELECT ${ALETA_SIPP_VARIABLE_REGISTRY_SELECT}
    FROM aleta_sipp_variables
    WHERE is_active = 1 AND (legacy_code = ? OR variable_key = ? OR modern_key = ?)
    ORDER BY legacy_source = 'ABT_XLS' DESC, confidence_score DESC
    LIMIT 1
    `,
    [key, key, key]
  );
  if (!row) notFound("Variable Registry SIPP tidak ditemukan.");
  const [templateLinks, queryLinks, sourceQuery] = await Promise.all([
    db.queryAll<Record<string, unknown>>(
      "SELECT source_type, source_file, source_location, usage_context FROM aleta_sipp_variable_template_links WHERE legacy_code = ? OR variable_key = ? ORDER BY source_type, source_file LIMIT 200",
      [row.legacy_code, row.variable_key || row.modern_key]
    ),
    getAletaSippVariableRegistryQueries(db, actor, row.legacy_code || row.modern_key),
    row.source_query_key
      ? db.queryOne<AletaSippQueryRegistryRow>(
          `SELECT ${ALETA_SIPP_QUERY_REGISTRY_SELECT} FROM aleta_sipp_query_registry WHERE query_key = ? AND is_active = 1 LIMIT 1`,
          [row.source_query_key]
        )
      : Promise.resolve(undefined),
  ]);
  return {
    ...mapVariableRow(row),
    templateLinks,
    queryLinks: queryLinks.rows,
    sourceQuery: sourceQuery ? mapQueryRegistryRow(sourceQuery, { includeSql: canViewAletaSippSqlPreview(actor) }) : null,
  };
}

export async function updateAletaSippVariableRegistry(
  db: AletaDatabase,
  actor: UserPersona,
  variableKeyOrLegacyCode: string,
  input: {
    variableKey?: string;
    modernKey?: string;
    displayName?: string;
    shortDescription?: string;
    longDescription?: string;
    category?: string;
    variableType?: string;
    sourceType?: string;
    sourceTable?: string;
    sourceColumn?: string;
    sourceQueryKey?: string;
    fallbackValue?: string;
    fallbackStrategy?: string;
    mappingStatus?: string;
    reviewStatus?: string;
    riskNotes?: string;
    usageNotes?: string;
    required?: boolean;
    isRepeating?: boolean;
  }
) {
  requireAletaSippPermissionForAction(
    actor,
    ALETA_SIPP_PERMISSION.MANAGE_VARIABLES,
    "Anda tidak memiliki izin mengedit Variable Registry SIPP."
  );
  const key = decodeURIComponent(variableKeyOrLegacyCode || "").trim();
  const current = await db.queryOne<AletaSippVariableRow>(
    `SELECT ${ALETA_SIPP_VARIABLE_REGISTRY_SELECT} FROM aleta_sipp_variables WHERE is_active = 1 AND (legacy_code = ? OR variable_key = ? OR modern_key = ?) LIMIT 1`,
    [key, key, key]
  );
  if (!current) notFound("Variable Registry SIPP tidak ditemukan.");
  const now = new Date().toISOString();
  const variableKey = input.variableKey?.trim() || current.variable_key || current.modern_key;
  const modernKey = input.modernKey?.trim() || current.modern_key;
  await db.run(
    `
    UPDATE aleta_sipp_variables
    SET
      variable_key = ?,
      modern_key = ?,
      display_name = ?,
      short_description = ?,
      long_description = ?,
      description = ?,
      category = ?,
      variable_type = ?,
      source_type = ?,
      source_table = ?,
      source_column = ?,
      source_query_key = ?,
      fallback_value = ?,
      fallback_strategy = ?,
      required = ?,
      is_repeating = ?,
      mapping_status = ?,
      review_status = ?,
      risk_notes = ?,
      usage_notes = ?,
      status = ?,
      updated_by = ?,
      updated_at = ?
    WHERE id = ?
    `,
    [
      variableKey,
      modernKey,
      input.displayName?.trim() || current.display_name,
      input.shortDescription?.trim() || current.short_description || current.description,
      input.longDescription?.trim() || current.long_description || current.description,
      input.shortDescription?.trim() || current.description,
      input.category?.trim() || current.category || "Lainnya",
      input.variableType?.trim() || current.variable_type || "UNKNOWN",
      input.sourceType?.trim() || current.source_type || "UNKNOWN",
      input.sourceTable?.trim() ?? current.source_table ?? "",
      input.sourceColumn?.trim() ?? current.source_column ?? "",
      input.sourceQueryKey?.trim() ?? current.source_query_key ?? "",
      input.fallbackValue?.trim() ?? current.fallback_value ?? "",
      input.fallbackStrategy?.trim() ?? current.fallback_strategy ?? "",
      input.required === undefined ? current.required ?? 0 : input.required ? 1 : 0,
      input.isRepeating === undefined ? current.is_repeating ?? 0 : input.isRepeating ? 1 : 0,
      input.mappingStatus?.trim() || current.mapping_status || current.status,
      input.reviewStatus?.trim() || "ADMIN_REVIEWED",
      input.riskNotes?.trim() ?? current.risk_notes ?? "",
      input.usageNotes?.trim() ?? current.usage_notes ?? "",
      input.mappingStatus?.trim() || current.status,
      actor.id,
      now,
      current.id,
    ]
  );
  return getAletaSippVariableRegistryDetail(db, actor, modernKey);
}

export async function analyzeAletaSippVariableRegistry(db: AletaDatabase, actor: UserPersona, variableKeyOrLegacyCode: string) {
  requireAletaSippPermissionForAction(
    actor,
    ALETA_SIPP_PERMISSION.MANAGE_VARIABLES,
    "Anda tidak memiliki izin menganalisis Variable Registry SIPP."
  );
  const key = decodeURIComponent(variableKeyOrLegacyCode || "").trim();
  const current = await db.queryOne<AletaSippVariableRow>(
    `SELECT ${ALETA_SIPP_VARIABLE_REGISTRY_SELECT} FROM aleta_sipp_variables WHERE is_active = 1 AND (legacy_code = ? OR variable_key = ? OR modern_key = ?) LIMIT 1`,
    [key, key, key]
  );
  if (!current) notFound("Variable Registry SIPP tidak ditemukan.");
  const variableType = inferVariableType(current.data_type, current.source_table, current.source_sql_fragment ?? "");
  const sourceType = inferVariableSourceType(current.data_type, current.source_table, current.source_sql_fragment ?? "");
  const mappingStatus = current.source_table && current.source_column ? "MAPPED_TO_TABLE_COLUMN" : current.source_query_key ? "MAPPED_TO_QUERY" : current.mapping_status || "UNRESOLVED";
  const confidenceScore = mappingStatus === "MAPPED_TO_TABLE_COLUMN" ? 84 : mappingStatus === "MAPPED_TO_QUERY" ? 70 : 35;
  await db.run(
    `
    UPDATE aleta_sipp_variables
    SET variable_type = ?, source_type = ?, mapping_status = ?, review_status = ?, confidence_score = ?, updated_by = ?, updated_at = ?
    WHERE id = ?
    `,
    [
      variableType,
      sourceType,
      mappingStatus,
        current.review_status === "ADMIN_REVIEWED" ? "ADMIN_REVIEWED" : mappingStatus === "UNRESOLVED" ? "NEEDS_ADMIN_REVIEW" : "AUTO_ANALYZED",
      confidenceScore,
      actor.id,
      new Date().toISOString(),
      current.id,
    ]
  );
  return getAletaSippVariableRegistryDetail(db, actor, current.modern_key);
}

export async function importAletaSippVariableRegistry(
  db: AletaDatabase,
  actor: UserPersona,
  input: { batchSize?: number; offset?: number; continueToken?: string } = {}
) {
  requireAletaSippPermissionForAction(
    actor,
    ALETA_SIPP_PERMISSION.MANAGE_VARIABLES,
    "Anda tidak memiliki izin import Variable Registry SIPP."
  );
  const batch = registryBatch(input, "sipp_variable_registry_import");
  const startedAt = new Date().toISOString();
  if (!batch.isContinuation) {
    await db.run(
      `
      INSERT INTO aleta_sipp_import_jobs (
        id, import_type, source_path, mode, status, summary_json, error_message, executed_by, started_at, finished_at, created_at
      )
      VALUES (?, 'VARIABLE_REGISTRY_IMPORT', 'ABT_XLS|WORD_DOCX|LEGACY_APPS', 'admin_scan', 'RUNNING', ?::jsonb, NULL, ?, ?, NULL, ?)
      `,
      [batch.jobId, jsonString({ offset: batch.offset, batchSize: batch.batchSize }), actor.id, startedAt, startedAt]
    );
  }

  const collected = await collectVariableRegistryCandidates();
  const selected = collected.candidates.slice(batch.offset, batch.offset + batch.batchSize);
  const selectedKeys = new Set(selected.flatMap((candidate) => [candidate.variableKey, candidate.modernKey]));
  const variableIds = new Map<string, string>();
  let imported = 0;
  let failed = 0;
  const failures: Array<{ variableKey: string; error: string }> = [];
  for (const candidate of selected) {
    try {
      const variableId = await upsertRegistryVariable(db, actor, candidate);
      variableIds.set(candidate.variableKey, variableId);
      variableIds.set(candidate.modernKey, variableId);
      imported += 1;
    } catch (error) {
      failed += 1;
      failures.push({ variableKey: candidate.modernKey, error: error instanceof Error ? error.message : "Import variabel gagal." });
    }
  }

  let templateLinkCount = 0;
  for (const link of collected.templateLinks) {
    if (!selectedKeys.has(link.variableKey)) continue;
    await upsertVariableTemplateLink(db, variableIds.get(link.variableKey) ?? null, link);
    templateLinkCount += 1;
  }
  let unresolvedCount = 0;
  for (const item of collected.unresolved) {
    if (!selectedKeys.has(item.suggestedVariableKey)) continue;
    await upsertUnresolvedPlaceholder(db, item);
    unresolvedCount += 1;
  }
  await db.run(
    `
    UPDATE aleta_sipp_query_variable_links qvl
    SET variable_id = v.id, mapping_status = 'MAPPED_TO_QUERY', updated_at = ?
    FROM aleta_sipp_variables v
    WHERE qvl.legacy_code = v.legacy_code AND qvl.mapping_status = 'UNRESOLVED'
    `,
    [new Date().toISOString()]
  );

  const nextOffset = batch.offset + selected.length;
  const finished = nextOffset >= collected.candidates.length;
  const finishedAt = finished ? new Date().toISOString() : null;
  const summary = {
    totalCandidates: collected.candidates.length,
    abtRowCount: collected.abtRowCount,
    imported,
    failed,
    templateLinkCount,
    unresolvedCount,
    offset: batch.offset,
    nextOffset,
    finished,
    sourceCounts: collected.sourceCounts,
    scanned: collected.scanned,
  };
  await db.run(
    `
    UPDATE aleta_sipp_import_jobs
    SET status = ?, summary_json = ?::jsonb, error_message = ?, finished_at = ?
    WHERE id = ?
    `,
    [finished ? "SUCCESS" : "RUNNING", jsonString(summary), failed ? `${failed} variabel gagal diimport.` : null, finishedAt, batch.jobId]
  );
  return {
    jobId: batch.jobId,
    ...summary,
    processed: selected.length,
    batchSize: batch.hasExplicitBatch ? batch.batchSize : selected.length,
    continueToken: finished ? null : `${batch.jobId}:${nextOffset}`,
    failures: failures.slice(0, 20),
  };
}

export async function convertAletaSippLegacyText(db: AletaDatabase, actor: UserPersona, input: { text?: string }) {
  requireAletaSippPermissionForAction(
    actor,
    ALETA_SIPP_PERMISSION.VIEW_VARIABLE_REGISTRY,
    "Anda tidak memiliki izin memakai Variable Registry SIPP."
  );
  const text = String(input.text ?? "");
  const codes = extractLegacyPlaceholders(text);
  if (codes.length === 0) return { convertedText: text, placeholders: [], unresolved: [] };
  const placeholders = codes.map(() => "?").join(", ");
  const rows = await db.queryAll<AletaSippVariableRow>(
    `SELECT ${ALETA_SIPP_VARIABLE_REGISTRY_SELECT} FROM aleta_sipp_variables WHERE legacy_code IN (${placeholders}) AND is_active = 1`,
    codes
  );
  const map = new Map(rows.map((row) => [row.legacy_code, row]));
  let convertedText = text;
  const placeholdersResult = codes.map((code) => {
    const variable = map.get(code);
    const replacement = variable?.variable_key || variable?.modern_key || knownLegacyVariableKeys[code]?.key || `##unresolved_${code.replace(/\D/g, "")}##`;
    convertedText = convertedText.replace(new RegExp(code.replace(/[#]/g, "\\#"), "g"), replacement);
    return {
      legacyCode: code,
      replacement,
      displayName: variable?.display_name || knownLegacyVariableKeys[code]?.name || "",
      mappingStatus: variable?.mapping_status || (knownLegacyVariableKeys[code] ? "PARTIAL" : "UNRESOLVED"),
    };
  });
  return {
    convertedText,
    placeholders: placeholdersResult,
    unresolved: placeholdersResult.filter((item) => item.mappingStatus === "UNRESOLVED"),
  };
}

export async function getAletaSippQueryRegistryVariables(db: AletaDatabase, actor: UserPersona, queryKey: string) {
  requireAletaSippPermissionForAction(
    actor,
    ALETA_SIPP_PERMISSION.VIEW_QUERY_REGISTRY,
    "Anda tidak memiliki izin melihat mapping Query-Variable SIPP."
  );
  const key = decodeURIComponent(queryKey || "").trim();
  const rows = await db.queryAll<Record<string, unknown>>(
    `
    SELECT qvl.query_key, qvl.legacy_code, qvl.variable_key, qvl.mapping_status, qvl.source_context,
      v.id AS variable_id, v.modern_key, v.display_name, v.category, v.source_type, v.source_table, v.source_column, v.review_status
    FROM aleta_sipp_query_variable_links qvl
    LEFT JOIN aleta_sipp_variables v ON v.id = qvl.variable_id OR v.legacy_code = qvl.legacy_code OR v.modern_key = qvl.variable_key OR v.variable_key = qvl.variable_key
    WHERE qvl.query_key = ?
    ORDER BY qvl.legacy_code, qvl.variable_key
    `,
    [key]
  );
  return { queryKey: key, rows };
}

export async function getAletaSippVariableRegistryQueries(db: AletaDatabase, actor: UserPersona, variableKeyOrLegacyCode: string) {
  requireAletaSippPermissionForAction(
    actor,
    ALETA_SIPP_PERMISSION.VIEW_VARIABLE_REGISTRY,
    "Anda tidak memiliki izin melihat mapping Variable-Query SIPP."
  );
  const key = decodeURIComponent(variableKeyOrLegacyCode || "").trim();
  const variable = await db.queryOne<AletaSippVariableRow>(
    `SELECT ${ALETA_SIPP_VARIABLE_REGISTRY_SELECT} FROM aleta_sipp_variables WHERE is_active = 1 AND (legacy_code = ? OR variable_key = ? OR modern_key = ?) LIMIT 1`,
    [key, key, key]
  );
  const rows = await db.queryAll<Record<string, unknown>>(
    `
    SELECT q.query_key, q.name, q.query_name, q.category, q.source_type, q.security_status, q.review_status,
      qvl.legacy_code, qvl.variable_key, qvl.mapping_status, qvl.source_context
    FROM aleta_sipp_query_variable_links qvl
    JOIN aleta_sipp_query_registry q ON q.query_key = qvl.query_key
    WHERE q.is_active = 1 AND (
      qvl.legacy_code = ? OR qvl.variable_key = ? OR qvl.variable_id = ? OR q.related_variable_keys_json::text ILIKE ?
    )
    ORDER BY q.category, q.query_key
    `,
    [variable?.legacy_code || key, variable?.variable_key || variable?.modern_key || key, variable?.id ?? "", `%${variable?.modern_key || key}%`]
  );
  return { variable: variable ? mapVariableRow(variable) : null, rows };
}

export async function getAletaSippAssessmentSummary(db: AletaDatabase, actor: UserPersona) {
  requireAletaSippPermissionForAction(
    actor,
    ALETA_SIPP_PERMISSION.VIEW_ASSESSMENT,
    "Anda tidak memiliki izin melihat penilaian SIPP."
  );
  const [indicators, lastRun] = await Promise.all([
    db.queryAll<AletaSippAssessmentIndicatorRow>(
      `
      SELECT id, indicator_code, name, category, sk_basis, description, weight, formula,
        source_tables_json, query_id, parameter_period, status, assumption_notes,
        is_active, created_at, updated_at
      FROM aleta_sipp_assessment_indicators
      WHERE is_active = 1
      ORDER BY indicator_code
      `
    ),
    db.queryOne<{
      id: string;
      period_start: string;
      period_end: string;
      status: string;
      total_score: number;
      summary_json: unknown;
      started_at: string | null;
      finished_at: string | null;
      created_at: string;
    }>(
      "SELECT id, period_start, period_end, status, total_score, summary_json, started_at, finished_at, created_at FROM aleta_sipp_assessment_runs ORDER BY created_at DESC LIMIT 1"
    ),
  ]);
  return {
    cacheStatus: indicators.length > 0 ? "READY" : "DATA_TIDAK_CUKUP",
    indicatorCount: indicators.length,
    indicators: indicators.map(mapAssessmentIndicatorRow),
    lastRun,
  };
}

export async function getAletaSippSchedulePreview(actor: UserPersona, input: { tanggalSidang?: string; ruangan?: string } = {}) {
  requireAletaSippPermissionForAction(
    actor,
    ALETA_SIPP_PERMISSION.PRINT_SCHEDULE_PDF,
    "Anda tidak memiliki izin melihat jadwal sidang ALETA x SIPP."
  );
  const tanggalSidang = normalizeScheduleDate(input.tanggalSidang);
  const rows = buildSchedulePreviewRows(tanggalSidang).filter((row) => !input.ruangan || row.ruangSidang === input.ruangan);
  return {
    tanggalSidang,
    ruangan: input.ruangan || "",
    source: "preview_cache",
    datasource: getAletaSippDataSourceStatus(),
    rows,
  };
}

export async function scanAletaSippLegacyReferences(actor: UserPersona): Promise<
  Pick<AletaSippDashboardSummary, "generatedAt" | "access" | "audit" | "safetyNotes">
> {
  const access = requireAletaSippPermissionForAction(
    actor,
    ALETA_SIPP_PERMISSION.MANAGE_SETTINGS,
    "Anda tidak memiliki izin scan referensi legacy ALETA x SIPP."
  );
  const [sql, abtXls, wordQueries, assessmentPdf, ...applications] = await Promise.all([
    parseSippSqlStructure(getAletaSippSqlDumpPath()),
    auditXls(DEFAULT_PATHS.abtXls),
    auditWordQueries(DEFAULT_PATHS.wordQueries),
    auditAssessmentPdf(DEFAULT_PATHS.assessmentPdf),
    auditApplication("SIPP", DEFAULT_PATHS.sippApp),
    auditApplication("ABT Legacy / APS Badilag", DEFAULT_PATHS.legacyAbtApp),
    auditApplication("pendukung2018", DEFAULT_PATHS.pendukung2018),
    auditApplication("Antrian Sidang", DEFAULT_PATHS.antrianApp),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    access,
    audit: {
      applications,
      sql,
      abtXls,
      wordQueries,
      assessmentPdf,
    },
    safetyNotes: [
      "Scan legacy hanya berjalan lewat aksi admin, bukan dashboard.",
      "Hasil scan harus masuk proses review sebelum query atau variabel dipakai production.",
      "Tidak ada write query ke database SIPP pada proses scan ini.",
    ],
  };
}

export async function createAletaSippSchedulePdf(actor: UserPersona, input: { tanggalSidang?: string; ruangan?: string }) {
  const access = resolveAletaSippAccess(actor);
  if (!access.permissions.includes(ALETA_SIPP_PERMISSION.PRINT_SCHEDULE_PDF)) {
    forbidden("Anda tidak memiliki izin mencetak jadwal sidang ALETA x SIPP.");
  }

  const tanggalSidang = normalizeScheduleDate(input.tanggalSidang);
  const rows = buildSchedulePreviewRows(tanggalSidang).filter((row) => !input.ruangan || row.ruangSidang === input.ruangan);
  const pdf = await PDFDocument.create();
  let page = pdf.addPage([842, 595]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const margin = 42;
  let y = 540;

  const drawText = (text: string, x: number, size = 10, isBold = false) => {
    page.drawText(text.slice(0, 130), { x, y, size, font: isBold ? bold : font, color: rgb(0.08, 0.1, 0.13) });
  };

  page.drawText("ALETA x SIPP", { x: margin, y, size: 16, font: bold, color: rgb(0.04, 0.25, 0.33) });
  y -= 22;
  page.drawText(`Jadwal Persidangan ${tanggalSidang}${input.ruangan ? ` - ${input.ruangan}` : ""}`, { x: margin, y, size: 12, font, color: rgb(0.2, 0.22, 0.25) });
  y -= 28;
  page.drawLine({ start: { x: margin, y }, end: { x: 800, y }, thickness: 1, color: rgb(0.75, 0.78, 0.82) });
  y -= 22;

  const headers = ["No", "Nomor Perkara", "Para Pihak", "Majelis/Panitera", "Agenda", "Ruang/Jam"];
  const xs = [margin, 72, 210, 365, 560, 685];
  headers.forEach((header, index) => {
    page.drawText(header, { x: xs[index], y, size: 9, font: bold, color: rgb(0.08, 0.1, 0.13) });
  });
  y -= 16;

  for (const row of rows) {
    if (y < 80) {
      page = pdf.addPage([842, 595]);
      y = 540;
    }
    drawText(String(row.nomorUrut), xs[0], 9);
    drawText(row.nomorPerkara, xs[1], 9);
    drawText(row.paraPihak, xs[2], 9);
    drawText(`${row.majelis}; ${row.panitera}`, xs[3], 8);
    drawText(row.agenda, xs[4], 9);
    drawText(`${row.ruangSidang} / ${row.jamSidang}`, xs[5], 9);
    y -= 26;
  }

  y -= 12;
  page.drawText("Catatan: PDF ini memakai data preview. Eksekusi produksi wajib memakai Query Registry read-only dan audit log.", {
    x: margin,
    y,
    size: 8,
    font,
    color: rgb(0.45, 0.28, 0.05),
  });

  return Buffer.from(await pdf.save());
}

export const AletaSippService = {
  getAletaSippDatasourceStatusService,
  testAletaSippDatasourceService,
  getAletaSippDashboardSummary,
  importSippMetadataFromSqlDump,
  syncAletaSippDictionaryFromLive,
  getAletaSippTables,
  getAletaSippTableDetail,
  getAletaSippColumns,
  getAletaSippDictionaryStats,
  getAletaSippDictionaryTables,
  getAletaSippDictionaryTableDetail,
  analyzeAletaSippDictionaryTable,
  analyzeAllAletaSippDictionary,
  updateAletaSippDictionaryTable,
  getAletaSippQueries,
  getAletaSippVariables,
  getAletaSippQueryRegistryStats,
  getAletaSippQueryRegistry,
  getAletaSippQueryRegistryDetail,
  updateAletaSippQueryRegistry,
  importAletaSippQueryRegistry,
  analyzeAletaSippQueryRegistry,
  testAletaSippQueryRegistry,
  getAletaSippVariableRegistryStats,
  getAletaSippVariableRegistry,
  getAletaSippVariableRegistryDetail,
  updateAletaSippVariableRegistry,
  importAletaSippVariableRegistry,
  analyzeAletaSippVariableRegistry,
  convertAletaSippLegacyText,
  getAletaSippQueryRegistryVariables,
  getAletaSippVariableRegistryQueries,
  getAletaSippAssessmentSummary,
  getAletaSippSchedulePreview,
  seedAletaSippQueryRegistryService,
  scanAletaSippLegacyReferences,
  createAletaSippSchedulePdf,
};

// ─── Menyelaraskan Kamus SIPP langsung dari SIPP yang terpasang ─────────────
//
// Kamus Database SIPP selama ini diisi dua cara: tangan, dan pengurai berkas
// dump SQL yang jalurnya di-hardcode ke folder Windows pengembang - jalur yang
// tidak akan pernah ada di server. Akibatnya kamus di produksi selalu
// tertinggal dari SIPP yang sesungguhnya, dan setiap kueri baru dibangun di
// atas dugaan tentang nama kolom.
//
// Penyelaras ini membaca information_schema dari SIPP yang benar-benar
// terpasang, lewat jembatan baca-saja di ALETA Bot.
//
// DUA ATURAN YANG TIDAK BOLEH DILANGGAR:
//
//   1. TIDAK MENIMPA TULISAN MANUSIA. Nama manusiawi, kategori, dan penjelasan
//      yang sudah diisi petugas dipertahankan apa adanya. Introspeksi hanya
//      mengisi yang masih kosong dan menyegarkan fakta struktural - tipe data,
//      kunci utama, boleh kosong atau tidak. Dokumentasi yang disusun
//      bertahun-tahun tidak boleh hilang karena satu tombol ditekan.
//
//   2. TIDAK MENGHAPUS. Tabel yang hilang dari SIPP ditandai tidak aktif,
//      bukan dibuang. Kueri lama yang menyebutnya tetap dapat ditelusuri.

type IntrospeksiTabel = { nama: string; jenis: string; keterangan: string };

type IntrospeksiKolom = {
  tabel: string;
  nama: string;
  tipe: string;
  tipeLengkap: string;
  bolehKosong: boolean;
  kunciUtama: boolean;
  terindeks: boolean;
  keterangan: string;
  urutan: number;
};

type IntrospeksiHasil = {
  diperiksaPada: string;
  jumlahTabel: number;
  jumlahView: number;
  jumlahKolom: number;
  tabel: IntrospeksiTabel[];
  kolom: IntrospeksiKolom[];
};

/** Menebak kategori dari nama tabel - hanya dipakai untuk tabel yang BELUM ada di kamus. */
function kategoriDariNamaTabel(nama: string): string {
  const n = nama.toLowerCase();
  if (n.startsWith("ref_") || n.startsWith("jenis_") || n.startsWith("alur_")) return "referensi";
  if (n.includes("putusan") || n.includes("akta_cerai") || n.includes("ikrar")) return "putusan";
  if (n.includes("sidang") || n.includes("mediasi") || n.includes("saksi")) return "persidangan";
  if (n.startsWith("perkara")) return "perkara";
  if (n.startsWith("log_") || n.includes("_log")) return "sistem";
  return "pendukung";
}

/** Mengubah nama_seperti_ini menjadi "Nama Seperti Ini". */
function namaManusiawiDariKode(nama: string): string {
  return nama
    .split("_")
    .filter(Boolean)
    .map((kata) => kata.charAt(0).toUpperCase() + kata.slice(1))
    .join(" ");
}

export async function syncAletaSippDictionaryFromLive(db: AletaDatabase, actor: UserPersona) {
  // Izin yang sama dengan impor struktur dari berkas SQL: keduanya menulis
  // Kamus Database SIPP, hanya sumbernya yang berbeda.
  requireAletaSippPermissionForAction(
    actor,
    ALETA_SIPP_PERMISSION.IMPORT_SQL_STRUCTURE,
    "Anda tidak memiliki izin menyelaraskan struktur SIPP."
  );

  const jawaban = await callAletaBotSippBridge<IntrospeksiHasil>(
    "schema.introspect",
    {},
    { timeoutMs: 120_000 }
  );
  if (!jawaban.ok || !jawaban.data) {
    throw badRequest(
      `Struktur SIPP tidak dapat dibaca: ${jawaban.ok ? "jawaban kosong" : jawaban.error}`
    );
  }

  const hasil = jawaban.data;
  const sekarang = new Date().toISOString();

  const kolomPerTabel = new Map<string, IntrospeksiKolom[]>();
  for (const kolom of hasil.kolom ?? []) {
    const daftar = kolomPerTabel.get(kolom.tabel) ?? [];
    daftar.push(kolom);
    kolomPerTabel.set(kolom.tabel, daftar);
  }

  const rowsLama = await db.queryAll<{ table_name: string }>(
    "SELECT table_name FROM aleta_sipp_tables"
  );
  const adaSebelumnya = new Set(rowsLama.map((row) => row.table_name));

  let tabelBaru = 0;
  let tabelDiperbarui = 0;
  let kolomTersimpan = 0;

  for (const tabel of hasil.tabel ?? []) {
    const tableId = stableId("sipp_table", tabel.nama);
    if (adaSebelumnya.has(tabel.nama)) tabelDiperbarui += 1;
    else tabelBaru += 1;

    const kolomTabel = kolomPerTabel.get(tabel.nama) ?? [];
    const sidikJari = createHash("sha1")
      .update(JSON.stringify(kolomTabel))
      .digest("hex")
      .slice(0, 16);

    // COALESCE NULLIF: nilai lama dipertahankan bila sudah terisi manusia.
    await db.run(
      `INSERT INTO aleta_sipp_tables (
        id, table_name, human_name, category, priority, short_description, long_description,
        function_in_case_process, table_kind, source_schema_hash, risk_notes, example_usage,
        example_query_key, is_active, created_by, updated_by, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, 3, ?, '', '', ?, ?, '[]'::jsonb, '', '', 1, ?, ?, ?, ?)
      ON CONFLICT (table_name) DO UPDATE SET
        human_name = COALESCE(NULLIF(aleta_sipp_tables.human_name, ''), EXCLUDED.human_name),
        category = COALESCE(NULLIF(aleta_sipp_tables.category, ''), EXCLUDED.category),
        short_description = COALESCE(NULLIF(aleta_sipp_tables.short_description, ''), EXCLUDED.short_description),
        source_schema_hash = EXCLUDED.source_schema_hash,
        is_active = 1,
        updated_by = EXCLUDED.updated_by,
        updated_at = EXCLUDED.updated_at`,
      [
        tableId,
        tabel.nama,
        namaManusiawiDariKode(tabel.nama),
        kategoriDariNamaTabel(tabel.nama),
        tabel.keterangan ?? "",
        tabel.jenis === "view" ? "referensi" : kategoriDariNamaTabel(tabel.nama),
        sidikJari,
        actor.id,
        actor.id,
        sekarang,
        sekarang,
      ]
    );

    for (const kolom of kolomTabel) {
      await db.run(
        `INSERT INTO aleta_sipp_columns (
          id, table_id, table_name, column_name, human_name, data_type, is_nullable,
          is_primary_key, is_indexed, description, example_value, relation_hint,
          query_usage_json, quality_notes, sort_order, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', '', '[]'::jsonb, '', ?, ?, ?)
        ON CONFLICT (table_name, column_name) DO UPDATE SET
          table_id = EXCLUDED.table_id,
          human_name = COALESCE(NULLIF(aleta_sipp_columns.human_name, ''), EXCLUDED.human_name),
          description = COALESCE(NULLIF(aleta_sipp_columns.description, ''), EXCLUDED.description),
          data_type = EXCLUDED.data_type,
          is_nullable = EXCLUDED.is_nullable,
          is_primary_key = EXCLUDED.is_primary_key,
          is_indexed = EXCLUDED.is_indexed,
          sort_order = EXCLUDED.sort_order,
          updated_at = EXCLUDED.updated_at`,
        [
          stableId("sipp_column", tabel.nama, kolom.nama),
          tableId,
          tabel.nama,
          kolom.nama,
          namaManusiawiDariKode(kolom.nama),
          kolom.tipeLengkap || kolom.tipe,
          kolom.bolehKosong ? 1 : 0,
          kolom.kunciUtama ? 1 : 0,
          kolom.terindeks ? 1 : 0,
          kolom.keterangan ?? "",
          kolom.urutan,
          sekarang,
          sekarang,
        ]
      );
      kolomTersimpan += 1;
    }
  }

  // Tabel yang tidak lagi ada di SIPP ditandai tidak aktif, bukan dihapus.
  const namaSekarang = new Set((hasil.tabel ?? []).map((tabel: IntrospeksiTabel) => tabel.nama));
  const tabelTidakAktif = [...adaSebelumnya].filter((nama) => !namaSekarang.has(nama));
  for (const nama of tabelTidakAktif) {
    await db.run(
      "UPDATE aleta_sipp_tables SET is_active = 0, updated_at = ?, updated_by = ? WHERE table_name = ?",
      [sekarang, actor.id, nama]
    );
  }

  return {
    diperiksaPada: hasil.diperiksaPada,
    jumlahTabel: hasil.jumlahTabel,
    jumlahView: hasil.jumlahView,
    jumlahKolom: hasil.jumlahKolom,
    tabelBaru,
    tabelDiperbarui,
    kolomTersimpan,
    tabelTidakAktif,
  };
}
