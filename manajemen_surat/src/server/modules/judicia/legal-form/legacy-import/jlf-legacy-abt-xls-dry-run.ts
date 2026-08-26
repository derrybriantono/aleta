import { spawnSync } from "node:child_process";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

import {
  JLF_SIPP_QUERY_KEYS,
  type JlfSippQueryKey,
  suggestJlfSippQueryKeyFromLegacySource,
} from "@/server/modules/judicia/legal-form/sipp/jlf-sipp-query-registry";
import { resolveJlfFieldMode } from "@/lib/judicia-legal-form-abt";
import type { AletaDatabase } from "@/server/db/client";

export type AbtLegacyTableName =
  | "abt_variabel"
  | "abt_variabel_tipe"
  | "abt_tanyajawab_id"
  | "abt_tanyajawab_template"
  | "abt_data_teks"
  | "abt_data_tanggal"
  | "abt_keterangan_saksi"
  | "abt_keterangan_terdakwa";

export type JlfLegacyMigrationStatus = "mapped" | "needs_review" | "conflict" | "ignored";

export type TabularSheet = {
  name: string;
  rows: Record<string, string>[];
};

export type TabularFile = {
  filePath: string;
  fileName: string;
  sheets: TabularSheet[];
  readMethod: "csv" | "python_xlrd" | "excel_com_xls";
};

export type LegacyVariableMapping = {
  legacySource: string;
  legacyCode: string;
  legacyLabel: string;
  suggestedVariableKey: string;
  targetVariableId: string | null;
  status: JlfLegacyMigrationStatus;
  jlfDataType: string;
  jlfSourceType: string;
  sourceKey: string;
  transformKey: string;
  fallbackValue: string;
  dependencyPlaceholders: string[];
  suggestedSippQueryKey: JlfSippQueryKey | null;
  notes: string[];
};

export type LegacyBasQaTemplateCandidate = {
  legacySource: string;
  legacyId: string;
  code: string;
  name: string;
  caseType: string;
  legacyJenisPerkaraId: string;
  status: JlfLegacyMigrationStatus;
  itemCount: number;
  placeholders: string[];
  unknownPlaceholders: string[];
  modernPlaceholderRecommendations: Record<string, string>;
  suggestedJlfTable: "jlf_bas_qa_templates";
  metadata: Record<string, unknown>;
};

export type LegacyBasQaItemCandidate = {
  legacySource: string;
  code: string;
  sortOrder: number;
  questionTemplate: string;
  answerTemplate: string;
  placeholders: string[];
  unknownPlaceholders: string[];
  suggestedJlfTable: "jlf_bas_qa_items";
};

export type ManualValueCandidateSummary = {
  legacySource: string;
  table: "abt_data_teks" | "abt_data_tanggal";
  rows: number;
  distinctLegacyCodes: number;
  distinctPerkaraIds: number;
  suggestedJlfTable: "jlf_manual_values";
  status: "candidate_only";
};

export type SensitiveDataSummary = {
  legacySource: string;
  table: "abt_keterangan_saksi" | "abt_keterangan_terdakwa";
  rows: number;
  distinctPerkaraIds: number;
  distinctSidangIds: number;
  status: "skipped_sensitive";
  reason: string;
};

export type LegacyQueryFinding = {
  legacySource: string;
  legacyCode: string;
  legacyLabel: string;
  status: "needs_review" | "read_only_ready";
  reason: string;
  redactedPreview: string;
};

export type LegacyConflict = {
  legacyCode: string;
  sources: string[];
  labels: string[];
  status: "conflict";
};

export type JlfLegacyAbtDryRunReport = {
  mode: "dry-run";
  sourceRoot: string;
  filesRead: Array<{ fileName: string; sheets: string[]; readMethod: TabularFile["readMethod"]; rows: number }>;
  totals: {
    variablesRead: number;
    variablesMapped: number;
    variablesNeedsReview: number;
    legacySqlQueriesFound: number;
    legacySqlQueriesNeedsReview: number;
    basQaTemplates: number;
    basQaItems: number;
    manualValueRows: number;
    sensitiveRowsSkipped: number;
    legacyCodeConflicts: number;
    unknownPlaceholders: number;
  };
  variableMappings: LegacyVariableMapping[];
  conflicts: LegacyConflict[];
  legacySqlFindings: LegacyQueryFinding[];
  basQaTemplates: LegacyBasQaTemplateCandidate[];
  basQaItems: LegacyBasQaItemCandidate[];
  manualValues: ManualValueCandidateSummary[];
  sensitiveData: SensitiveDataSummary[];
  unknownPlaceholders: string[];
  sippQueryRegistry: Array<{ key: JlfSippQueryKey; source: "allowlist"; readOnly: true }>;
  importExecution: {
    executed: false;
    reason: string;
  };
};

export type JlfLegacyAbtSqlImportResult = {
  executed: true;
  sqlVariablesRead: number;
  insertedOrUpdated: number;
  legacyCodesLinked: number;
  legacyCodesSkipped: number;
  warnings: string[];
};

const TABLE_FILES: Array<{ table: AbtLegacyTableName; patterns: string[] }> = [
  { table: "abt_variabel", patterns: ["abt_variabel.xls", "abt_variabel bungku.csv", "abt_variabel donggala.csv"] },
  { table: "abt_variabel_tipe", patterns: ["abt_variabel_tipe.xls"] },
  { table: "abt_tanyajawab_id", patterns: ["abt_tanyajawab_id.xls"] },
  { table: "abt_tanyajawab_template", patterns: ["abt_tanyajawab_template.xls"] },
  { table: "abt_data_teks", patterns: ["abt_data_teks.xls"] },
  { table: "abt_data_tanggal", patterns: ["abt_data_tanggal.xls"] },
  { table: "abt_keterangan_saksi", patterns: ["abt_keterangan_saksi.xls"] },
  { table: "abt_keterangan_terdakwa", patterns: ["abt_keterangan_terdakwa.xls"] },
];

const LEGACY_TO_MODERN_PLACEHOLDER: Record<string, string> = {
  "0001": "nomor_perkara",
  "0002": "qr_perkara",
  "0046": "nama_penggugat",
  "0047": "nama_tergugat",
  "0048": "nama_pihak",
  "0053": "pokok_gugatan_permohonan",
  "0667": "majelis_hakim",
  "0668": "ketua_majelis",
};

const SIPP_SOURCE_TYPES = new Set([
  "sipp_perkara",
  "sipp_pihak",
  "sipp_jadwal_sidang",
  "sipp_hakim",
  "sipp_panitera",
  "sipp_jurusita",
  "sipp_putusan",
  "sipp_keuangan",
]);

type MappedAbtVariableType = {
  dataType: string;
  sourceType: string;
  transformKey: string;
  suggestedSippQueryKey: JlfSippQueryKey | null;
  sourceKeyOverride?: string;
};

function stripBom(value: string) {
  return value.replace(/^\uFEFF/, "");
}

function normalizeHeader(value: string) {
  return stripBom(value).trim();
}

function normalizeCell(value: unknown) {
  return String(value ?? "").replace(/\u0000/g, "").trim();
}

function normalizeLegacySource(fileName: string, sheetName: string) {
  const baseName = path.basename(fileName, path.extname(fileName)).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const sheet = sheetName.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return sheet && sheet !== baseName ? `${baseName}:${sheet}` : baseName;
}

function normalizeLegacyCode(value: unknown) {
  const raw = normalizeCell(value).replace(/^#|#$/g, "");
  const digits = raw.match(/\d{1,5}/)?.[0] ?? "";
  if (!digits) return "";
  return digits.length <= 4 ? digits.padStart(4, "0") : digits;
}

function normalizeSemanticKey(label: string, fallback: string) {
  const normalized = label
    .trim()
    .toLowerCase()
    .replace(/<[^>]*>/g, " ")
    .replace(/#(\d{4})#/g, " legacy_$1 ")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 100);
  return normalized || fallback;
}

function detectLegacyPlaceholders(value: string) {
  return Array.from(new Set((value.match(/#\d{4}#/g) ?? []).map((placeholder) => placeholder.replace(/#/g, "")))).sort();
}

function redactSensitiveText(value: string, maxLength = 240) {
  return value
    .replace(/\b\d{16}\b/g, "[NIK]")
    .replace(/\b\d{10,15}\b/g, "[NUMBER]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[EMAIL]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function parseDelimitedRows(content: string, delimiter = ",") {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuote = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    const next = content[index + 1];
    if (char === '"') {
      if (inQuote && next === '"') {
        cell += '"';
        index += 1;
      } else {
        inQuote = !inQuote;
      }
      continue;
    }
    if (char === delimiter && !inQuote) {
      row.push(cell);
      cell = "";
      continue;
    }
    if ((char === "\n" || char === "\r") && !inQuote) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some((item) => item.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += char;
  }

  row.push(cell);
  if (row.some((item) => item.trim() !== "")) rows.push(row);
  return rows;
}

function guessDelimiter(firstLine: string) {
  const commaCount = (firstLine.match(/,/g) ?? []).length;
  const semicolonCount = (firstLine.match(/;/g) ?? []).length;
  const tabCount = (firstLine.match(/\t/g) ?? []).length;
  if (tabCount > commaCount && tabCount > semicolonCount) return "\t";
  return semicolonCount > commaCount ? ";" : ",";
}

export function parseCsvContent(filePath: string, content: string): TabularFile {
  const firstLine = content.split(/\r?\n/, 1)[0] ?? "";
  const rows = parseDelimitedRows(content, guessDelimiter(firstLine));
  const headers = (rows[0] ?? []).map(normalizeHeader);
  const dataRows = rows.slice(1).map((cells) => {
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header || `col_${index + 1}`] = normalizeCell(cells[index]);
    });
    return row;
  });
  return {
    filePath,
    fileName: path.basename(filePath),
    readMethod: "csv",
    sheets: [{ name: path.basename(filePath, path.extname(filePath)), rows: dataRows }],
  };
}

async function readCsvFile(filePath: string): Promise<TabularFile> {
  return parseCsvContent(filePath, await readFile(filePath, "utf8"));
}

function readXlsViaPythonXlrd(filePath: string): TabularFile {
  const encodedPath = Buffer.from(filePath, "utf8").toString("base64");
  const script = `
import base64
import json
import os
import re
import sys

try:
    import xlrd
except Exception as exc:
    sys.stderr.write("xlrd_unavailable: %s" % exc)
    sys.exit(3)

path = base64.b64decode(os.environ["JLF_XLS_PATH_B64"]).decode("utf-8")

def clean(value):
    if value is None:
        return ""
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value).replace("\\x00", "").strip()

def normalize_header(value, index):
    text = clean(value)
    return text if text else "col_%s" % (index + 1)

book = xlrd.open_workbook(path, on_demand=True)
sheets = []
for sheet in book.sheets():
    if sheet.nrows <= 0 or sheet.ncols <= 0:
        sheets.append({"name": sheet.name, "rows": []})
        continue
    headers = [normalize_header(sheet.cell_value(0, c), c) for c in range(sheet.ncols)]
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
    sheets.append({"name": sheet.name, "rows": rows})

print(json.dumps({"sheets": sheets}, ensure_ascii=False))
`;

  const result = spawnSync("python", ["-c", script], {
    encoding: "utf8",
    env: { ...process.env, JLF_XLS_PATH_B64: encodedPath },
    maxBuffer: 256 * 1024 * 1024,
  });

  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || "Python xlrd gagal membaca XLS.");
  }

  const parsed = JSON.parse(result.stdout) as { sheets?: Array<{ name?: string; rows?: Array<Record<string, unknown>> }> };
  const rawSheets = Array.isArray(parsed.sheets) ? parsed.sheets : [];
  return {
    filePath,
    fileName: path.basename(filePath),
    readMethod: "python_xlrd",
    sheets: rawSheets.map((sheet) => ({
      name: sheet.name ?? path.basename(filePath, path.extname(filePath)),
      rows: (sheet.rows ?? []).map((row) =>
        Object.fromEntries(Object.entries(row).map(([key, value]) => [normalizeHeader(key), normalizeCell(value)]))
      ),
    })),
  };
}

function readXlsViaExcelCom(filePath: string): TabularFile {
  const encodedPath = Buffer.from(filePath, "utf8").toString("base64");
  const script = `
$ErrorActionPreference = 'Stop'
$path = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($env:JLF_XLS_PATH_B64))
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
try { $excel.AutomationSecurity = 3 } catch {}
try {
  $wb = $excel.Workbooks.Open($path, $null, $true)
  $sheets = @()
  foreach ($ws in $wb.Worksheets) {
    $ur = $ws.UsedRange
    $rowCount = [int]$ur.Rows.Count
    $colCount = [int]$ur.Columns.Count
    $values = $ur.Value2
    $headers = @()
    for ($c = 1; $c -le $colCount; $c++) {
      if ($rowCount -eq 1 -and $colCount -eq 1) { $header = [string]$values } else { $header = [string]$values[1, $c] }
      if ([string]::IsNullOrWhiteSpace($header)) { $header = "col_$c" }
      $headers += $header.Trim()
    }
    $rows = @()
    for ($r = 2; $r -le $rowCount; $r++) {
      $obj = [ordered]@{}
      for ($c = 1; $c -le $colCount; $c++) {
        $cellValue = if ($rowCount -eq 1 -and $colCount -eq 1) { $null } else { $values[$r, $c] }
        $obj[$headers[$c - 1]] = [string]$cellValue
      }
      $rows += [pscustomobject]$obj
    }
    $sheets += [pscustomobject]@{ name = [string]$ws.Name; rows = $rows }
  }
  $wb.Close($false)
  [pscustomobject]@{ sheets = $sheets } | ConvertTo-Json -Depth 8 -Compress
} finally {
  try { if ($wb) { $wb.Close($false) } } catch {}
  $excel.Quit()
  [void][Runtime.InteropServices.Marshal]::ReleaseComObject($excel)
}
`;

  const result = spawnSync("powershell", ["-NoProfile", "-NonInteractive", "-Command", script], {
    encoding: "utf8",
    env: { ...process.env, JLF_XLS_PATH_B64: encodedPath },
    maxBuffer: 256 * 1024 * 1024,
  });

  if (result.status !== 0) {
    throw new Error(
      `File XLS tidak dapat dibaca tanpa dependency baru. Konversi ke CSV atau jalankan di Windows dengan Excel COM tersedia. ${result.stderr.trim()}`
    );
  }

  const parsed = JSON.parse(result.stdout) as { sheets?: Array<{ name?: string; rows?: Array<Record<string, unknown>> }> | { name?: string; rows?: Array<Record<string, unknown>> } };
  const rawSheets = Array.isArray(parsed.sheets) ? parsed.sheets : parsed.sheets ? [parsed.sheets] : [];
  return {
    filePath,
    fileName: path.basename(filePath),
    readMethod: "excel_com_xls",
    sheets: rawSheets.map((sheet) => {
      const rawRows = Array.isArray(sheet.rows) ? sheet.rows : sheet.rows ? [sheet.rows] : [];
      return {
        name: sheet.name ?? path.basename(filePath, path.extname(filePath)),
        rows: rawRows.map((row) =>
        Object.fromEntries(Object.entries(row).map(([key, value]) => [normalizeHeader(key), normalizeCell(value)]))
      ),
      };
    }),
  };
}

export async function readAbtTabularFile(filePath: string): Promise<TabularFile> {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".csv" || extension === ".tsv" || extension === ".txt") return readCsvFile(filePath);
  if (extension === ".xls") {
    const header = await readFile(filePath).then((buffer) => buffer.subarray(0, 8));
    const isOleWorkbook = header[0] === 0xd0 && header[1] === 0xcf && header[2] === 0x11 && header[3] === 0xe0;
    if (!isOleWorkbook) return readCsvFile(filePath);
    try {
      return readXlsViaPythonXlrd(filePath);
    } catch {
      // Excel COM is a Windows-only fallback for environments without xlrd.
    }
    return readXlsViaExcelCom(filePath);
  }
  throw new Error(`Format file tidak didukung untuk dry-run XLS ABT: ${extension}`);
}

async function collectCandidateFiles(sourceRoot: string) {
  const files: string[] = [];
  const lowerPatterns = TABLE_FILES.flatMap((item) => item.patterns).map((item) => item.toLowerCase());
  const entries = await readdir(sourceRoot, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (lowerPatterns.includes(entry.name.toLowerCase())) files.push(path.join(sourceRoot, entry.name));
  }
  return files.sort();
}

function inferTableName(fileName: string, sheetName: string): AbtLegacyTableName | null {
  const normalized = `${fileName} ${sheetName}`.toLowerCase();
  for (const config of TABLE_FILES) {
    if (config.patterns.some((pattern) => normalized.includes(path.basename(pattern, path.extname(pattern)).toLowerCase()))) {
      return config.table;
    }
  }
  return null;
}

function normalizeLegacyReferenceCode(value: string) {
  const text = normalizeCell(value);
  if (!text) return "";
  const numeric = Number(text);
  const raw = Number.isFinite(numeric) ? String(Math.trunc(numeric)) : text;
  return normalizeLegacyCode(raw);
}

function mapMultiSidangSourceKey(value: string) {
  const normalized = normalizeCell(value).toLowerCase();
  if (!normalized) return "sidang.terpilih";
  if (normalized.includes("hari") || normalized.includes("tanggal") || normalized.includes("tgl")) return "sidang.terpilih.tanggal_sidang";
  if (normalized.includes("agenda") || normalized.includes("acara")) return "sidang.terpilih.agenda";
  if (normalized.includes("ruang")) return "sidang.terpilih.ruangan";
  if (normalized.includes("jam")) return "sidang.terpilih.jam_sidang";
  return `sidang.terpilih.${normalized.replace(/[^a-z0-9_]+/g, "_")}`;
}

function mapReferenceSourceKey(value: string) {
  const legacyCode = normalizeLegacyReferenceCode(value);
  if (!legacyCode) return "";
  if (legacyCode === "0032" || legacyCode === "0033") return "sidang.terpilih.tanggal_sidang";
  return `legacy.${legacyCode}`;
}

function normalizeUrutanData(value: string) {
  const text = normalizeCell(value);
  if (!/^\d+(\.0+)?$/.test(text)) return "";
  const number = Number(text);
  return Number.isSafeInteger(Math.trunc(number)) && number > 0 ? String(Math.trunc(number)) : "";
}

function appendUrutanDataToSourceKey(sourceKey: string, urutanData: string) {
  if (!sourceKey || !urutanData) return sourceKey;
  const separator = sourceKey.includes("?") ? "&" : "?";
  return `${sourceKey}${separator}urutan=${urutanData}`;
}

function mapAbtVariableType(
  dataType: string,
  dataTable: string,
  dataColumn: string,
  multiSidang: string,
  referensi: string
): MappedAbtVariableType {
  const normalized = dataType.trim().toLowerCase();
  const suggestedSippQueryKey = suggestJlfSippQueryKeyFromLegacySource(dataTable, dataColumn);

  if (normalized === "data_sipp") {
    let sourceType = "sipp_perkara";
    if (suggestedSippQueryKey?.includes("pihak")) sourceType = "sipp_pihak";
    if (suggestedSippQueryKey?.includes("sidang")) sourceType = "sipp_jadwal_sidang";
    if (suggestedSippQueryKey?.includes("hakim")) sourceType = "sipp_hakim";
    if (suggestedSippQueryKey?.includes("panitera")) sourceType = "sipp_panitera";
    if (suggestedSippQueryKey?.includes("jurusita")) sourceType = "sipp_jurusita";
    if (suggestedSippQueryKey?.includes("putusan")) sourceType = "sipp_putusan";
    if (suggestedSippQueryKey?.includes("biaya")) sourceType = "sipp_keuangan";
    return { dataType: "text", sourceType, transformKey: "", suggestedSippQueryKey };
  }

  if (normalized === "data_teks") return { dataType: "manual_text", sourceType: "jlf_manual", transformKey: "", suggestedSippQueryKey: null };
  if (normalized === "data_tanggal") return { dataType: "manual_date", sourceType: "jlf_manual", transformKey: "", suggestedSippQueryKey: null };
  if (normalized === "tanggal_hari") return { dataType: "date", sourceType: "computed", transformKey: "hari_indonesia", suggestedSippQueryKey, sourceKeyOverride: mapReferenceSourceKey(referensi) };
  if (normalized === "tanggal_hijriah") return { dataType: "date", sourceType: "computed", transformKey: "tanggal_hijriah", suggestedSippQueryKey, sourceKeyOverride: mapReferenceSourceKey(referensi) };
  if (normalized === "terbilang") return { dataType: "text", sourceType: "computed", transformKey: "angka_terbilang", suggestedSippQueryKey: null };
  if (normalized === "multi_sidang") {
    const sourceKeyOverride = mapMultiSidangSourceKey(multiSidang);
    const transformKey = multiSidang.toLowerCase().includes("hari")
      ? "hari_indonesia"
      : /tanggal|tgl/i.test(multiSidang)
        ? "tanggal_indonesia_panjang"
        : "";
    return { dataType: "text", sourceType: "sipp_jadwal_sidang", transformKey, suggestedSippQueryKey: "sipp.sidang.list" as JlfSippQueryKey, sourceKeyOverride };
  }
  if (normalized === "tanya_jawab") return { dataType: "long_text", sourceType: "jlf_bas_qa", transformKey: "bas_qa_section", suggestedSippQueryKey: null };
  if (normalized === "qrcode") return { dataType: "qrcode", sourceType: "computed", transformKey: "qr_perkara", suggestedSippQueryKey: null };
  if (normalized === "data_sql") return { dataType: "text", sourceType: "abt_sql", transformKey: "", suggestedSippQueryKey: null };
  return { dataType: "text", sourceType: "jlf_manual", transformKey: "", suggestedSippQueryKey: null };
}

function buildVariableMapping(row: Record<string, string>, legacySource: string): LegacyVariableMapping | null {
  const legacyCode = normalizeLegacyCode(row.no_var ?? row.kode ?? row.col_1);
  if (!legacyCode || legacyCode.toLowerCase() === "no_var") return null;

  const legacyLabel = normalizeCell(row.nama || row.label || row.keterangan || `Variabel ${legacyCode}`);
  const legacyDataType = normalizeCell(row.data_type);
  const dataTable = normalizeCell(row.data_tabel);
  const dataColumn = normalizeCell(row.data_kolom);
  const urutanData = normalizeUrutanData(row.urutan_data ?? row.urutan ?? "");
  const multiSidang = normalizeCell(row.multi_sidang);
  const referensi = normalizeCell(row.referensi);
  const sqlQuery = normalizeCell(row.sql_query);
  const defaultData = normalizeCell(row.default_data);
  const mappedType = mapAbtVariableType(legacyDataType, dataTable, dataColumn, multiSidang, referensi);
  const dependencyPlaceholders = detectLegacyPlaceholders(defaultData);
  const notes: string[] = [];
  let status: JlfLegacyMigrationStatus = "mapped";

  if (!legacyDataType) {
    status = "needs_review";
    notes.push("data_type ABT kosong; perlu penentuan source_type JLF.");
  }
  if (sqlQuery) {
    notes.push("sql_query ABT dipakai sebagai resolver read-only melalui bridge SIPP ALETA Bot.");
  }
  if (sqlQuery && legacyDataType !== "data_sql") {
    status = "needs_review";
    notes.push("sql_query ditemukan pada tipe non-data_sql; perlu review admin.");
  }
  if (legacyDataType === "data_sql" && !sqlQuery) {
    status = "needs_review";
    notes.push("data_sql ABT belum memiliki sql_query.");
  }
  if (dependencyPlaceholders.length > 0) {
    notes.push("default_data berisi placeholder legacy; perlu dependency mapping.");
  }
  if (legacyDataType === "data_sipp" && urutanData) {
    notes.push(`urutan_data ABT ${urutanData} dipakai sebagai filter urutan pada source_key.`);
  }
  if (SIPP_SOURCE_TYPES.has(mappedType.sourceType) && !mappedType.suggestedSippQueryKey) {
    status = "needs_review";
    notes.push("Sumber SIPP belum punya query key allowlist yang jelas.");
  }

  const baseSourceKey = mappedType.sourceKeyOverride || [dataTable, dataColumn].filter(Boolean).join(".");
  const sourceKey = legacyDataType === "data_sipp"
    ? appendUrutanDataToSourceKey(baseSourceKey, urutanData)
    : baseSourceKey;

  return {
    legacySource,
    legacyCode,
    legacyLabel,
    suggestedVariableKey: normalizeSemanticKey(legacyLabel, `legacy_${legacyCode}`),
    targetVariableId: null,
    status,
    jlfDataType: mappedType.dataType,
    jlfSourceType: mappedType.sourceType,
    sourceKey,
    transformKey: mappedType.transformKey,
    fallbackValue: dependencyPlaceholders.length > 0 ? "" : defaultData,
    dependencyPlaceholders,
    suggestedSippQueryKey: mappedType.suggestedSippQueryKey,
    notes,
  };
}

function buildQueryFinding(row: Record<string, string>, legacySource: string): LegacyQueryFinding | null {
  const sqlQuery = normalizeCell(row.sql_query);
  if (!sqlQuery) return null;
  return {
    legacySource,
    legacyCode: normalizeLegacyCode(row.no_var),
    legacyLabel: normalizeCell(row.nama),
    status: "read_only_ready",
    reason: "Kolom sql_query dari ABT disimpan sebagai resolver read-only; eksekusi tetap dibatasi SELECT/SHOW melalui bridge SIPP.",
    redactedPreview: redactSensitiveText(sqlQuery, 12_000),
  };
}

function buildSqlVariableKey(finding: LegacyQueryFinding) {
  const labelPart = normalizeSemanticKey(finding.legacyLabel, "query");
  return normalizeSemanticKey(`abt_sql_${finding.legacyCode || "tanpa_kode"}_${labelPart}`, `abt_sql_${finding.legacyCode || "tanpa_kode"}`);
}

function findVariableMappingForSql(report: JlfLegacyAbtDryRunReport, finding: LegacyQueryFinding) {
  return report.variableMappings.find(
    (mapping) => mapping.legacyCode === finding.legacyCode && mapping.legacySource === finding.legacySource
  ) ?? report.variableMappings.find((mapping) => mapping.legacyCode === finding.legacyCode);
}

async function resolveImportLegacyCode(
  db: AletaDatabase,
  variableKey: string,
  finding: LegacyQueryFinding,
  blockedLegacyCodes: Set<string>,
  alreadyLinked: Set<string>
) {
  const legacyCode = finding.legacyCode;
  if (!legacyCode || blockedLegacyCodes.has(legacyCode) || alreadyLinked.has(legacyCode)) return null;

  const existing = await db
    .prepare(`SELECT "key" FROM jlf_variables WHERE legacy_code = ? LIMIT 1`)
    .get<{ key: string }>(legacyCode);
  if (existing && existing.key !== variableKey) return null;

  alreadyLinked.add(legacyCode);
  return legacyCode;
}

export async function importJlfLegacyAbtSqlVariables(
  db: AletaDatabase,
  report: JlfLegacyAbtDryRunReport,
  options: { actorId?: string | null } = {}
): Promise<JlfLegacyAbtSqlImportResult> {
  const now = new Date().toISOString();
  const blockedLegacyCodes = new Set(report.conflicts.map((item) => item.legacyCode));
  const alreadyLinked = new Set<string>();
  const warnings: string[] = [];
  let insertedOrUpdated = 0;
  let legacyCodesLinked = 0;
  let legacyCodesSkipped = 0;

  const insert = db.prepare(
    `INSERT INTO jlf_variables (
       id, legacy_code, "key", label, description, data_type, source_type, source_key, transform_key,
       fallback_value, legacy_abt_type, field_mode, ai_enabled, manual_override_allowed,
       is_required, is_active, example_value, admin_note,
       sipp_query_preview, sipp_query_preview_status, sipp_query_preview_key, sipp_query_preview_generated_at,
       created_by, updated_by, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '', 'data_sql', ?, 0, 1, 0, 1, '', ?, ?, 'read_only_ready', ?, ?, ?, ?, ?, ?)
     ON CONFLICT ("key") DO UPDATE SET
       legacy_code = COALESCE(jlf_variables.legacy_code, EXCLUDED.legacy_code),
       label = EXCLUDED.label,
       description = EXCLUDED.description,
       data_type = EXCLUDED.data_type,
       source_type = EXCLUDED.source_type,
       source_key = EXCLUDED.source_key,
       transform_key = EXCLUDED.transform_key,
       legacy_abt_type = EXCLUDED.legacy_abt_type,
       field_mode = EXCLUDED.field_mode,
       manual_override_allowed = EXCLUDED.manual_override_allowed,
       admin_note = EXCLUDED.admin_note,
       sipp_query_preview = EXCLUDED.sipp_query_preview,
       sipp_query_preview_status = EXCLUDED.sipp_query_preview_status,
       sipp_query_preview_key = EXCLUDED.sipp_query_preview_key,
       sipp_query_preview_generated_at = EXCLUDED.sipp_query_preview_generated_at,
       updated_by = EXCLUDED.updated_by,
       updated_at = EXCLUDED.updated_at`
  );

  for (const finding of report.legacySqlFindings) {
    const key = buildSqlVariableKey(finding);
    const mapping = findVariableMappingForSql(report, finding);
    const legacyCode = await resolveImportLegacyCode(db, key, finding, blockedLegacyCodes, alreadyLinked);
    if (legacyCode) legacyCodesLinked += 1;
    else legacyCodesSkipped += 1;

    const dataType = mapping?.jlfDataType || "text";
    const sourceType = mapping?.jlfSourceType || "abt_sql";
    const sourceKey = mapping?.sourceKey || `legacy_sql.${finding.legacyCode || key}`;
    const transformKey = mapping?.transformKey || "";
    const fieldMode = resolveJlfFieldMode({
      legacyAbtType: "data_sql",
      dataType,
      sourceType,
      sourceKey,
      transformKey,
      legacyCode,
      aiEnabled: false,
    });
    const queryKey = mapping?.suggestedSippQueryKey || `abt.sql.${finding.legacyCode || key}`;
    const adminNote = [
      "Import aman dari abt_variabel.xls.",
      "Tipe ABT: data_sql.",
      "SQL legacy dijalankan sebagai SELECT/SHOW read-only lewat bridge SIPP saat variabel dirender.",
      `Sumber: ${finding.legacySource}.`,
      finding.reason,
      ...(mapping?.notes ?? []),
    ].filter(Boolean).join(" ");

    await insert.run(
      `jlf-var-${key}`,
      legacyCode,
      key,
      finding.legacyLabel || `ABT SQL #${finding.legacyCode || "----"}`,
      "Variabel SQL ABT legacy yang masuk ke katalog JLF sebagai resolver read-only. Output HTML sederhana seperti <br> tetap boleh dipakai dan akan dirapikan renderer dokumen.",
      dataType,
      sourceType,
      sourceKey,
      transformKey,
      fieldMode,
      adminNote,
      finding.redactedPreview,
      queryKey,
      now,
      options.actorId ?? null,
      options.actorId ?? null,
      now,
      now
    );
    insertedOrUpdated += 1;
  }

  if (blockedLegacyCodes.size > 0) {
    warnings.push(`${blockedLegacyCodes.size} legacy code konflik tidak ditautkan ke kolom legacy_code; variabel tetap masuk dengan key unik.`);
  }

  return {
    executed: true,
    sqlVariablesRead: report.legacySqlFindings.length,
    insertedOrUpdated,
    legacyCodesLinked,
    legacyCodesSkipped,
    warnings,
  };
}

function buildBasTemplates(rows: Record<string, string>[], legacySource: string): LegacyBasQaTemplateCandidate[] {
  const templates: LegacyBasQaTemplateCandidate[] = [];
  for (const row of rows) {
    const code = normalizeCell(row.kode);
    if (!code || code.toLowerCase() === "kode") continue;
    templates.push({
      legacySource,
      legacyId: normalizeCell(row.id),
      code,
      name: normalizeCell(row.nama) || `Template Tanya Jawab ${code}`,
      caseType: "",
      legacyJenisPerkaraId: normalizeCell(row.jenis_perkara_id),
      status: "mapped",
      itemCount: 0,
      placeholders: [],
      unknownPlaceholders: [],
      modernPlaceholderRecommendations: {},
      suggestedJlfTable: "jlf_bas_qa_templates",
      metadata: { legacy_jenis_perkara_id: normalizeCell(row.jenis_perkara_id) },
    });
  }
  return templates;
}

function buildBasItems(rows: Record<string, string>[], legacySource: string): LegacyBasQaItemCandidate[] {
  return rows
    .map((row, index) => {
      const code = normalizeCell(row.kode_tanyajawab);
      if (!code || code.toLowerCase() === "kode_tanyajawab") return null;
      const questionTemplate = normalizeCell(row.pertanyaan);
      const answerTemplate = normalizeCell(row.jawaban);
      const placeholders = Array.from(new Set([...detectLegacyPlaceholders(questionTemplate), ...detectLegacyPlaceholders(answerTemplate)])).sort();
      const unknownPlaceholders = placeholders.filter((placeholder) => !LEGACY_TO_MODERN_PLACEHOLDER[placeholder]);
      return {
        legacySource,
        code,
        sortOrder: Number(row.urutan_pertanyaan) || index + 1,
        questionTemplate,
        answerTemplate,
        placeholders,
        unknownPlaceholders,
        suggestedJlfTable: "jlf_bas_qa_items" as const,
      };
    })
    .filter((item): item is LegacyBasQaItemCandidate => Boolean(item));
}

function summarizeManualValues(table: "abt_data_teks" | "abt_data_tanggal", rows: Record<string, string>[], legacySource: string): ManualValueCandidateSummary {
  return {
    legacySource,
    table,
    rows: rows.length,
    distinctLegacyCodes: new Set(rows.map((row) => normalizeLegacyCode(row.no_var)).filter(Boolean)).size,
    distinctPerkaraIds: new Set(rows.map((row) => normalizeCell(row.perkara_id)).filter(Boolean)).size,
    suggestedJlfTable: "jlf_manual_values",
    status: "candidate_only",
  };
}

function summarizeSensitive(table: "abt_keterangan_saksi" | "abt_keterangan_terdakwa", rows: Record<string, string>[], legacySource: string): SensitiveDataSummary {
  return {
    legacySource,
    table,
    rows: rows.length,
    distinctPerkaraIds: new Set(rows.map((row) => normalizeCell(row.perkara_id)).filter(Boolean)).size,
    distinctSidangIds: new Set(rows.map((row) => normalizeCell(row.sidang_id)).filter(Boolean)).size,
    status: "skipped_sensitive",
    reason: "Data jawaban/keterangan aktual berisi substansi perkara sehingga tidak diimpor otomatis pada dry-run.",
  };
}

function detectConflicts(mappings: LegacyVariableMapping[]): LegacyConflict[] {
  const grouped = new Map<string, LegacyVariableMapping[]>();
  for (const mapping of mappings) {
    const current = grouped.get(mapping.legacyCode) ?? [];
    current.push(mapping);
    grouped.set(mapping.legacyCode, current);
  }

  const conflicts: LegacyConflict[] = [];
  for (const [legacyCode, items] of grouped) {
    const labels = Array.from(new Set(items.map((item) => item.legacyLabel).filter(Boolean)));
    const sources = Array.from(new Set(items.map((item) => item.legacySource)));
    if (labels.length > 1 || sources.length > 1) {
      conflicts.push({ legacyCode, sources, labels, status: "conflict" });
      for (const item of items) {
        item.status = item.status === "ignored" ? item.status : "conflict";
        item.notes.push("legacy_code konflik antar sumber/label; gunakan legacy_source + legacy_code.");
      }
    }
  }
  return conflicts.sort((left, right) => left.legacyCode.localeCompare(right.legacyCode));
}

function applyBasItemCounts(templates: LegacyBasQaTemplateCandidate[], items: LegacyBasQaItemCandidate[]) {
  const itemsByCode = new Map<string, LegacyBasQaItemCandidate[]>();
  for (const item of items) {
    const current = itemsByCode.get(item.code) ?? [];
    current.push(item);
    itemsByCode.set(item.code, current);
  }

  for (const template of templates) {
    const templateItems = itemsByCode.get(template.code) ?? [];
    const placeholders = Array.from(new Set(templateItems.flatMap((item) => item.placeholders))).sort();
    template.itemCount = templateItems.length;
    template.placeholders = placeholders;
    template.unknownPlaceholders = placeholders.filter((placeholder) => !LEGACY_TO_MODERN_PLACEHOLDER[placeholder]);
    template.modernPlaceholderRecommendations = Object.fromEntries(
      placeholders
        .filter((placeholder) => LEGACY_TO_MODERN_PLACEHOLDER[placeholder])
        .map((placeholder) => [`#${placeholder}#`, `{{${LEGACY_TO_MODERN_PLACEHOLDER[placeholder]}}}`])
    );
    if (template.unknownPlaceholders.length > 0) template.status = "needs_review";
  }
}

export async function buildJlfLegacyAbtDryRunReport(sourceRoot: string): Promise<JlfLegacyAbtDryRunReport> {
  const rootStat = await stat(sourceRoot).catch(() => null);
  if (!rootStat?.isDirectory()) throw new Error("Source root XLS ABT tidak ditemukan atau bukan folder.");

  const candidateFiles = await collectCandidateFiles(sourceRoot);
  const files = await Promise.all(candidateFiles.map(readAbtTabularFile));
  const variableMappings: LegacyVariableMapping[] = [];
  const legacySqlFindings: LegacyQueryFinding[] = [];
  const basQaTemplates: LegacyBasQaTemplateCandidate[] = [];
  const basQaItems: LegacyBasQaItemCandidate[] = [];
  const manualValues: ManualValueCandidateSummary[] = [];
  const sensitiveData: SensitiveDataSummary[] = [];

  for (const file of files) {
    for (const sheet of file.sheets) {
      const table = inferTableName(file.fileName, sheet.name);
      const legacySource = normalizeLegacySource(file.fileName, sheet.name);
      if (table === "abt_variabel") {
        for (const row of sheet.rows) {
          const mapping = buildVariableMapping(row, legacySource);
          if (mapping) variableMappings.push(mapping);
          const finding = buildQueryFinding(row, legacySource);
          if (finding) legacySqlFindings.push(finding);
        }
      }
      if (table === "abt_tanyajawab_id") basQaTemplates.push(...buildBasTemplates(sheet.rows, legacySource));
      if (table === "abt_tanyajawab_template") basQaItems.push(...buildBasItems(sheet.rows, legacySource));
      if (table === "abt_data_teks" || table === "abt_data_tanggal") manualValues.push(summarizeManualValues(table, sheet.rows, legacySource));
      if (table === "abt_keterangan_saksi" || table === "abt_keterangan_terdakwa") sensitiveData.push(summarizeSensitive(table, sheet.rows, legacySource));
    }
  }

  const conflicts = detectConflicts(variableMappings);
  applyBasItemCounts(basQaTemplates, basQaItems);
  const unknownPlaceholders = Array.from(new Set(basQaItems.flatMap((item) => item.unknownPlaceholders))).sort();

  return {
    mode: "dry-run",
    sourceRoot,
    filesRead: files.map((file) => ({
      fileName: file.fileName,
      sheets: file.sheets.map((sheet) => sheet.name),
      readMethod: file.readMethod,
      rows: file.sheets.reduce((sum, sheet) => sum + sheet.rows.length, 0),
    })),
    totals: {
      variablesRead: variableMappings.length,
      variablesMapped: variableMappings.filter((item) => item.status === "mapped").length,
      variablesNeedsReview: variableMappings.filter((item) => item.status === "needs_review" || item.status === "conflict").length,
      legacySqlQueriesFound: legacySqlFindings.length,
      legacySqlQueriesNeedsReview: legacySqlFindings.filter((item) => item.status === "needs_review").length,
      basQaTemplates: basQaTemplates.length,
      basQaItems: basQaItems.length,
      manualValueRows: manualValues.reduce((sum, item) => sum + item.rows, 0),
      sensitiveRowsSkipped: sensitiveData.reduce((sum, item) => sum + item.rows, 0),
      legacyCodeConflicts: conflicts.length,
      unknownPlaceholders: unknownPlaceholders.length,
    },
    variableMappings,
    conflicts,
    legacySqlFindings,
    basQaTemplates,
    basQaItems,
    manualValues,
    sensitiveData,
    unknownPlaceholders,
    sippQueryRegistry: JLF_SIPP_QUERY_KEYS.map((key) => ({ key: key as JlfSippQueryKey, source: "allowlist", readOnly: true })),
    importExecution: {
      executed: false,
      reason: "Dry-run only. File XLS/CSV ABT hanya dibaca untuk laporan mapping; SQL legacy tidak dieksekusi saat import dan tidak ada write ke SIPP.",
    },
  };
}

export function formatJlfLegacyAbtDryRunMarkdown(report: JlfLegacyAbtDryRunReport) {
  return `# JLF Legacy ABT XLS/CSV Dry-run Report

- Mode: ${report.mode}
- Source: ${report.sourceRoot}
- Files read: ${report.filesRead.length}
- Variables read: ${report.totals.variablesRead}
- Variables mapped safely: ${report.totals.variablesMapped}
- Variables needs review/conflict: ${report.totals.variablesNeedsReview}
- Legacy SQL queries found: ${report.totals.legacySqlQueriesFound}
- BAS/Q&A templates: ${report.totals.basQaTemplates}
- BAS/Q&A items: ${report.totals.basQaItems}
- Manual value rows candidate: ${report.totals.manualValueRows}
- Sensitive Q/A rows skipped: ${report.totals.sensitiveRowsSkipped}
- Legacy code conflicts: ${report.totals.legacyCodeConflicts}
- Unknown placeholders: ${report.totals.unknownPlaceholders}

## Import Execution

${report.importExecution.reason}

## Catatan Aman

- sql_query ABT disimpan sebagai resolver read-only; eksekusi runtime dibatasi SELECT/SHOW melalui bridge SIPP.
- Kode legacy konflik harus dimapping dengan legacy_source + legacy_code.
- Data keterangan saksi/terdakwa adalah data sensitif dan default skipped_sensitive.
`;
}
