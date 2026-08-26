import type { AletaDatabase } from "@/server/db/client";
import { readStoredJlfTemplateFile } from "@/server/shared/jlf-template-storage";

export type JlfDetectedPlaceholder = {
  placeholder: string;
  normalizedKey: string;
  kind: "legacy" | "modern";
  count: number;
};

export type JlfPlaceholderReport = {
  templateVersionId?: string;
  placeholders: JlfDetectedPlaceholder[];
  unknownPlaceholders: JlfDetectedPlaceholder[];
  duplicatePlaceholders: JlfDetectedPlaceholder[];
  mappedPlaceholders: Array<JlfDetectedPlaceholder & { variableId: string; variableKey: string; label: string }>;
  parserWarnings: string[];
};

function countPlaceholders(matches: string[], kind: "legacy" | "modern") {
  const map = new Map<string, JlfDetectedPlaceholder>();

  for (const placeholder of matches) {
    const normalizedKey = normalizePlaceholder(placeholder);
    const existing = map.get(placeholder);
    if (existing) {
      existing.count += 1;
    } else {
      map.set(placeholder, { placeholder, normalizedKey, kind, count: 1 });
    }
  }

  return Array.from(map.values()).sort((left, right) => left.placeholder.localeCompare(right.placeholder));
}

export function detectLegacyPlaceholders(content: string) {
  return countPlaceholders(content.match(/#\d{4}#/g) ?? [], "legacy");
}

export function detectModernPlaceholders(content: string) {
  const curly = content.match(/\{\{\s*[a-zA-Z][a-zA-Z0-9_.-]*\s*\}\}/g) ?? [];
  const bracket = content.match(/\[\[\s*[a-zA-Z][a-zA-Z0-9_.-]*\s*\]\]/g) ?? [];
  const angle = content.match(/<<\s*[a-zA-Z][a-zA-Z0-9_.-]*\s*>>/g) ?? [];
  return countPlaceholders([...curly, ...bracket, ...angle], "modern");
}

export function normalizePlaceholder(placeholder: string) {
  const trimmed = placeholder.trim();
  const legacy = trimmed.match(/^#(\d{4})#$/);
  if (legacy) return legacy[1];

  const modern =
    trimmed.match(/^\{\{\s*([a-zA-Z][a-zA-Z0-9_.-]*)\s*\}\}$/) ??
    trimmed.match(/^\[\[\s*([a-zA-Z][a-zA-Z0-9_.-]*)\s*\]\]$/) ??
    trimmed.match(/^<<\s*([a-zA-Z][a-zA-Z0-9_.-]*)\s*>>$/);
  if (modern) return modern[1].trim().toLowerCase().replace(/[.-]+/g, "_");

  return trimmed.toLowerCase();
}

export function detectAllPlaceholders(content: string) {
  return [...detectLegacyPlaceholders(content), ...detectModernPlaceholders(content)];
}

export function listDuplicatePlaceholders(placeholders: JlfDetectedPlaceholder[]) {
  return placeholders.filter((placeholder) => placeholder.count > 1);
}

export async function validatePlaceholdersAgainstRegistry(
  db: AletaDatabase,
  placeholders: JlfDetectedPlaceholder[]
) {
  if (placeholders.length === 0) {
    return {
      mappedPlaceholders: [],
      unknownPlaceholders: [],
    };
  }

  const legacyCodes = placeholders.filter((item) => item.kind === "legacy").map((item) => item.normalizedKey);
  const semanticKeys = placeholders.filter((item) => item.kind === "modern").map((item) => item.normalizedKey);
  const params: string[] = [];
  const clauses: string[] = [];

  if (legacyCodes.length) {
    clauses.push(`legacy_code IN (${legacyCodes.map(() => "?").join(", ")})`);
    params.push(...legacyCodes);
  }
  if (semanticKeys.length) {
    clauses.push(`key IN (${semanticKeys.map(() => "?").join(", ")})`);
    params.push(...semanticKeys);
  }

  const rows = clauses.length
    ? await db.prepare(
        `SELECT id, legacy_code, key, label
         FROM jlf_variables
         WHERE is_active = 1 AND (${clauses.join(" OR ")})`
      ).all<{ id: string; legacy_code: string | null; key: string; label: string }>(...params)
    : [];

  const mapped = new Map<string, { variableId: string; variableKey: string; label: string }>();
  for (const row of rows) {
    if (row.legacy_code) mapped.set(`legacy:${row.legacy_code}`, { variableId: row.id, variableKey: row.key, label: row.label });
    mapped.set(`modern:${row.key}`, { variableId: row.id, variableKey: row.key, label: row.label });
  }

  const mappedPlaceholders = [];
  const unknownPlaceholders = [];
  for (const placeholder of placeholders) {
    const key = placeholder.kind === "legacy" ? `legacy:${placeholder.normalizedKey}` : `modern:${placeholder.normalizedKey}`;
    const variable = mapped.get(key);
    if (variable) {
      mappedPlaceholders.push({ ...placeholder, ...variable });
    } else {
      unknownPlaceholders.push(placeholder);
    }
  }

  return { mappedPlaceholders, unknownPlaceholders };
}

export async function listUnknownPlaceholders(db: AletaDatabase, placeholders: JlfDetectedPlaceholder[]) {
  return (await validatePlaceholdersAgainstRegistry(db, placeholders)).unknownPlaceholders;
}

function decodeTemplateBuffer(buffer: Buffer, fileType: string) {
  const warnings: string[] = [];
  if (fileType === "docx") {
    warnings.push(
      "DOCX parser penuh belum tersedia. Deteksi placeholder DOCX pada tahap ini memakai scan aman terhadap konten file dan dapat melewatkan placeholder dalam XML terkompresi."
    );
  }

  const content = fileType === "rtf" ? buffer.toString("latin1") : buffer.toString("utf8");
  return { content, warnings };
}

export async function buildPlaceholderReport(
  db: AletaDatabase,
  templateVersionId: string
): Promise<JlfPlaceholderReport> {
  const version = await db.prepare(
    `SELECT id, storage_path
     FROM jlf_template_versions
     WHERE id = ?`
  ).get<{ id: string; storage_path: string }>(templateVersionId);

  if (!version) {
    return {
      templateVersionId,
      placeholders: [],
      unknownPlaceholders: [],
      duplicatePlaceholders: [],
      mappedPlaceholders: [],
      parserWarnings: ["Versi template tidak ditemukan."],
    };
  }

  const storedFile = await readStoredJlfTemplateFile(version.storage_path);
  const extension = version.storage_path.toLowerCase().endsWith(".rtf") ? "rtf" : "docx";
  const decoded = decodeTemplateBuffer(storedFile.buffer, extension);
  const placeholders = detectAllPlaceholders(decoded.content);
  const registry = await validatePlaceholdersAgainstRegistry(db, placeholders);

  return {
    templateVersionId,
    placeholders,
    unknownPlaceholders: registry.unknownPlaceholders,
    duplicatePlaceholders: listDuplicatePlaceholders(placeholders),
    mappedPlaceholders: registry.mappedPlaceholders,
    parserWarnings: decoded.warnings,
  };
}

export const JlfPlaceholderDetector = {
  detectLegacyPlaceholders,
  detectModernPlaceholders,
  detectAllPlaceholders,
};

export const JlfPlaceholderNormalizer = {
  normalizePlaceholder,
};

export const JlfTemplatePlaceholderReportService = {
  buildPlaceholderReport,
  validatePlaceholdersAgainstRegistry,
  listUnknownPlaceholders,
  listDuplicatePlaceholders,
};
