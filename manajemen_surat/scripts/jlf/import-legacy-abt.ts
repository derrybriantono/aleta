import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

type LegacyVariable = {
  legacyCode: string;
  semanticKey: string;
  label: string;
  sourceHint: string;
  needsReview: boolean;
};

type LegacyTemplate = {
  filePath: string;
  fileName: string;
  placeholders: string[];
  unreadable?: boolean;
  errorMessage?: string;
};

type ImportReport = {
  mode: "dry-run" | "import-requested";
  sourceRoot: string;
  sqlFiles: string[];
  templateRoot: string;
  templatesFound: number;
  templatesProcessed: number;
  variablesFound: number;
  variablesMapped: number;
  unknownPlaceholders: string[];
  duplicateVariables: string[];
  variablesWithoutClearSource: LegacyVariable[];
  riskyLegacyQueries: Array<{ file: string; table?: string; reason: string; sample: string }>;
  unreadableTemplates: Array<{ file: string; errorMessage: string }>;
  semanticKeyRecommendations: LegacyVariable[];
  importExecution: {
    requested: boolean;
    executed: boolean;
    reason: string;
  };
};

type Args = {
  sourceRoot: string;
  templateRoot?: string;
  format: "json" | "markdown";
  importRequested: boolean;
};

const legacyTables = [
  "abt_variabel",
  "abt_variabel_tipe",
  "abt_menu",
  "abt_menu_grup",
  "abt_data_teks",
  "abt_data_tanggal",
  "abt_data_validasi_bas",
  "abt_tanyajawab_id",
  "abt_tanyajawab_template",
];

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const readValue = (flag: string) => {
    const index = args.indexOf(flag);
    return index >= 0 ? args[index + 1] : undefined;
  };

  return {
    sourceRoot: path.resolve(readValue("--source") ?? "assets/abt"),
    templateRoot: readValue("--templates") ? path.resolve(readValue("--templates") ?? "") : undefined,
    format: readValue("--format") === "markdown" ? "markdown" : "json",
    importRequested: args.includes("--import"),
  };
}

function normalizeSemanticKey(value: string, fallback: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/<[^>]+>/g, " ")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);

  return normalized || fallback;
}

function detectLegacyPlaceholders(content: string) {
  return Array.from(new Set(content.match(/#\d{4}#/g) ?? [])).sort();
}

function parseSqlString(raw: string) {
  const trimmed = raw.trim();
  if (/^null$/i.test(trimmed)) return "";
  if (!trimmed.startsWith("'")) return trimmed.replace(/^`|`$/g, "");

  return trimmed
    .slice(1, -1)
    .replace(/\\'/g, "'")
    .replace(/''/g, "'")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t");
}

function splitSqlValues(tuple: string) {
  const values: string[] = [];
  let current = "";
  let inQuote = false;
  let escape = false;

  for (const char of tuple) {
    if (escape) {
      current += char;
      escape = false;
      continue;
    }
    if (char === "\\") {
      current += char;
      escape = true;
      continue;
    }
    if (char === "'") {
      inQuote = !inQuote;
      current += char;
      continue;
    }
    if (char === "," && !inQuote) {
      values.push(parseSqlString(current));
      current = "";
      continue;
    }
    current += char;
  }

  if (current.trim()) values.push(parseSqlString(current));
  return values;
}

function splitTuples(valuesBlock: string) {
  const tuples: string[] = [];
  let depth = 0;
  let inQuote = false;
  let escape = false;
  let current = "";

  for (const char of valuesBlock) {
    if (escape) {
      current += char;
      escape = false;
      continue;
    }
    if (char === "\\") {
      current += char;
      escape = true;
      continue;
    }
    if (char === "'") {
      inQuote = !inQuote;
      current += char;
      continue;
    }
    if (char === "(" && !inQuote) {
      depth += 1;
      if (depth === 1) continue;
    }
    if (char === ")" && !inQuote) {
      depth -= 1;
      if (depth === 0) {
        tuples.push(current);
        current = "";
        continue;
      }
    }
    if (depth > 0) current += char;
  }

  return tuples;
}

function extractInsertBlocks(sql: string) {
  const blocks: Array<{ table: string; columns: string[]; tuples: string[][]; sample: string }> = [];
  const insertPattern = /INSERT\s+INTO\s+`?([a-zA-Z0-9_]+)`?\s*(?:\(([^)]*)\))?\s+VALUES\s+([\s\S]*?);/gi;
  let match: RegExpExecArray | null;

  while ((match = insertPattern.exec(sql))) {
    const table = match[1];
    if (!legacyTables.includes(table)) continue;

    const columns = (match[2] ?? "")
      .split(",")
      .map((item) => item.trim().replace(/^`|`$/g, ""))
      .filter(Boolean);
    const tuples = splitTuples(match[3]).map(splitSqlValues);
    blocks.push({ table, columns, tuples, sample: match[0].slice(0, 500) });
  }

  return blocks;
}

function mapTuple(columns: string[], values: string[]) {
  if (columns.length === 0) {
    return Object.fromEntries(values.map((value, index) => [`col_${index}`, value]));
  }

  return Object.fromEntries(columns.map((column, index) => [column, values[index] ?? ""]));
}

async function collectFiles(root: string, matcher: (filePath: string) => boolean) {
  const result: string[] = [];

  async function walk(directory: string) {
    const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      const filePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await walk(filePath);
      } else if (entry.isFile() && matcher(filePath)) {
        result.push(filePath);
      }
    }
  }

  await walk(root);
  return result.sort();
}

function inspectRiskySql(file: string, table: string | undefined, sample: string) {
  const risky: Array<{ file: string; table?: string; reason: string; sample: string }> = [];
  const normalized = sample.toLowerCase();
  if (/\b(update|delete|drop|truncate|alter|create\s+user|grant|revoke)\b/.test(normalized)) {
    risky.push({ file, table, reason: "Query legacy mengandung operasi write/DDL dan wajib review manual.", sample: sample.slice(0, 500) });
  }
  if (/\b(password|passwd|token|secret|api_key|hash)\b/.test(normalized)) {
    risky.push({ file, table, reason: "Query legacy tampak berisi kredensial atau secret dan tidak boleh diimpor otomatis.", sample: sample.slice(0, 500) });
  }
  if (/\b(select\s+\*|where\s+1\s*=\s*1|concat\s*\(|\$_(get|post|request))\b/i.test(sample)) {
    risky.push({ file, table, reason: "Query legacy berpotensi dinamis/raw SQL dan harus ditandai needs_review.", sample: sample.slice(0, 500) });
  }
  return risky;
}

function buildVariableFromRow(row: Record<string, string>, index: number): LegacyVariable | null {
  const legacyCodeCandidate = row.kode || row.kd_variabel || row.id_variabel || row.variabel || row.col_0 || "";
  const digits = String(legacyCodeCandidate).match(/\d{1,4}/)?.[0]?.padStart(4, "0") ?? "";
  if (!digits) return null;

  const label = row.nama || row.nama_variabel || row.label || row.keterangan || row.col_1 || `Variabel ${digits}`;
  const sourceHint = row.query || row.sql || row.sumber || row.source || row.tipe || "";
  const semanticKey = normalizeSemanticKey(label, `legacy_${digits}`);
  const needsReview = !sourceHint || /\b(select|update|delete|insert|drop|alter)\b/i.test(sourceHint);

  return {
    legacyCode: digits,
    semanticKey,
    label,
    sourceHint,
    needsReview,
  };
}

async function main() {
  const args = parseArgs();
  const sqlRoot = path.join(args.sourceRoot, "database");
  const templateRoot = args.templateRoot ?? path.join(args.sourceRoot, "_blangko_abt");
  const sqlFiles = await collectFiles(sqlRoot, (filePath) => filePath.toLowerCase().endsWith(".sql"));
  const templateFiles = await collectFiles(templateRoot, (filePath) => /\.(rtf|docx)$/i.test(filePath));
  const variables = new Map<string, LegacyVariable>();
  const riskyLegacyQueries: ImportReport["riskyLegacyQueries"] = [];

  for (const sqlFile of sqlFiles) {
    const sql = await readFile(sqlFile, "utf8").catch(() => "");
    riskyLegacyQueries.push(...inspectRiskySql(sqlFile, undefined, sql));

    for (const block of extractInsertBlocks(sql)) {
      riskyLegacyQueries.push(...inspectRiskySql(sqlFile, block.table, block.sample));
      for (const tuple of block.tuples) {
        const row = mapTuple(block.columns, tuple);
        if (block.table === "abt_variabel") {
          const variable = buildVariableFromRow(row, variables.size);
          if (variable) variables.set(variable.legacyCode, variable);
        }
      }
    }
  }

  const templates: LegacyTemplate[] = [];
  for (const templateFile of templateFiles) {
    try {
      const fileStat = await stat(templateFile);
      if (!fileStat.isFile()) continue;
      const buffer = await readFile(templateFile);
      templates.push({
        filePath: templateFile,
        fileName: path.basename(templateFile),
        placeholders: detectLegacyPlaceholders(buffer.toString("latin1")),
      });
    } catch (error) {
      templates.push({
        filePath: templateFile,
        fileName: path.basename(templateFile),
        placeholders: [],
        unreadable: true,
        errorMessage: error instanceof Error ? error.message : "Template tidak terbaca.",
      });
    }
  }

  const allPlaceholders = new Set(templates.flatMap((template) => template.placeholders));
  const knownLegacyCodes = new Set(variables.keys());
  const unknownPlaceholders = Array.from(allPlaceholders)
    .filter((placeholder) => !knownLegacyCodes.has(placeholder.replace(/#/g, "")))
    .sort();
  const duplicateVariables = Array.from(
    new Set(
      Array.from(variables.values())
        .map((variable) => variable.semanticKey)
        .filter((key, index, values) => values.indexOf(key) !== index)
    )
  ).sort();

  const report: ImportReport = {
    mode: args.importRequested ? "import-requested" : "dry-run",
    sourceRoot: args.sourceRoot,
    sqlFiles,
    templateRoot,
    templatesFound: templateFiles.length,
    templatesProcessed: templates.filter((template) => !template.unreadable).length,
    variablesFound: variables.size,
    variablesMapped: Array.from(variables.values()).filter((variable) => !variable.needsReview).length,
    unknownPlaceholders,
    duplicateVariables,
    variablesWithoutClearSource: Array.from(variables.values()).filter((variable) => variable.needsReview),
    riskyLegacyQueries,
    unreadableTemplates: templates
      .filter((template) => template.unreadable)
      .map((template) => ({ file: template.filePath, errorMessage: template.errorMessage ?? "Template tidak terbaca." })),
    semanticKeyRecommendations: Array.from(variables.values()).sort((left, right) => left.legacyCode.localeCompare(right.legacyCode)),
    importExecution: {
      requested: args.importRequested,
      executed: false,
      reason: args.importRequested
        ? "Mode import write belum dieksekusi pada tahap ini. Script hanya menghasilkan laporan aman; pembuatan data JLF harus dilakukan melalui service setelah hasil dry-run direview."
        : "Dry-run default. Tidak ada SQL legacy yang dieksekusi dan tidak ada data JLF yang ditulis.",
    },
  };

  if (args.format === "markdown") {
    console.log(`# JLF Legacy ABT Dry-run Report

- Mode: ${report.mode}
- Source: ${report.sourceRoot}
- SQL files: ${report.sqlFiles.length}
- Templates found: ${report.templatesFound}
- Templates processed: ${report.templatesProcessed}
- Variables found: ${report.variablesFound}
- Variables mapped without review: ${report.variablesMapped}
- Unknown placeholders: ${report.unknownPlaceholders.length}
- Duplicate variable keys: ${report.duplicateVariables.length}
- Risky legacy query samples: ${report.riskyLegacyQueries.length}
- Unreadable templates: ${report.unreadableTemplates.length}

## Import Execution

${report.importExecution.reason}
`);
    return;
  }

  console.log(JSON.stringify(report, null, 2));
}

void main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : "Importer legacy ABT gagal." }, null, 2));
  process.exitCode = 1;
});
