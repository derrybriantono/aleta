import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { QueryResultRow } from "pg";

import { JLF_PERMISSION } from "@/lib/judicia-legal-form-types";
import type { UserPersona } from "@/lib/types";
import type { AletaDatabase } from "@/server/db/client";
import { runAnonymizationAssistant } from "@/server/modules/judicia/legal-form/ai/jlf-ai-services";
import { logAction } from "@/server/modules/judicia/legal-form/jlf-audit-log-service";
import { getJsonSetting } from "@/server/modules/judicia/legal-form/jlf-settings-service";
import { requireJlfPermission } from "@/server/modules/judicia/legal-form/jlf-permission-service";
import { jlfBadRequest, jlfNotFound } from "@/server/modules/judicia/legal-form/jlf-service-errors";
import { ApiError } from "@/server/shared/errors";

type UploadableAnonymizerFile = {
  name: string;
  size: number;
  type?: string;
  arrayBuffer: () => Promise<ArrayBuffer>;
};

export type JlfSensitiveEntityType =
  | "party_name"
  | "address"
  | "nik"
  | "phone"
  | "email"
  | "birth_date"
  | "identity_number"
  | "child_data"
  | "custom"
  | "other";

export type JlfSensitiveEntitySuggestion = {
  id: string;
  type: JlfSensitiveEntityType;
  label: string;
  value: string;
  replacement: string;
  start: number;
  end: number;
  confidence: number;
  source: "rule" | "case_context" | "ai";
  reason: string;
  acceptedByDefault: boolean;
};

type AuditMeta = {
  ipAddress?: string;
  userAgent?: string;
};

type AnonymizedDocumentMeta = {
  id: string;
  fileName: string;
  originalFileName: string;
  fileType: string;
  checksum: string;
  size: number;
  createdAt: string;
  createdBy: string;
  entityCount: number;
};

type ManualScanContext = {
  nomorPerkara?: string;
  partyNames?: string[];
  customTerms?: string[];
};

type SettingRow = QueryResultRow & {
  value: unknown;
};

const ANONYMIZED_STORAGE_PREFIX = "jlf/anonymized/";
const EXECUTABLE_EXTENSIONS = new Set(["bat", "cmd", "com", "dll", "exe", "js", "msi", "ps1", "scr", "sh", "vbs"]);
const DEFAULT_ALLOWED_EXTENSIONS = ["txt", "rtf"];
const MAX_PREVIEW_CHARS = 220_000;

function getAnonymizedStorageDirectory() {
  const root = process.env.ALETA_UPLOAD_DIR?.trim();
  return root ? path.join(root, "jlf", "anonymized") : path.join(process.cwd(), "uploads", "jlf", "anonymized");
}

function sanitizeFileName(fileName: string) {
  return (
    path
      .basename(fileName || "dokumen-anonim")
      .replace(/\s+/g, "_")
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^\.+/, "")
      .slice(0, 180) || "dokumen-anonim"
  );
}

function getExtension(fileName: string) {
  return path.extname(fileName || "").replace(/^\./, "").toLowerCase();
}

function resolveCandidatePath(directory: string, fileName: string) {
  const absolutePath = path.resolve(directory, fileName);
  const relativePath = path.relative(directory, absolutePath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new ApiError(400, "Path dokumen anonimisasi JLF tidak valid.");
  }

  return absolutePath;
}

function normalizeAllowedExtensions(value: unknown) {
  const configured = Array.isArray(value) ? value.map((item) => String(item).toLowerCase().replace(/^\./, "").trim()) : [];
  return Array.from(new Set([...DEFAULT_ALLOWED_EXTENSIONS, ...configured.filter(Boolean)]));
}

function normalizeText(value: string) {
  return value.replace(/\u0000/g, "").replace(/\r\n/g, "\n");
}

function compactWhitespace(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function replacementForType(type: JlfSensitiveEntityType) {
  switch (type) {
    case "party_name":
      return "[NAMA PIHAK DIANONIMKAN]";
    case "address":
      return "[ALAMAT DIANONIMKAN]";
    case "nik":
      return "[NIK DIANONIMKAN]";
    case "phone":
      return "[TELEPON DIANONIMKAN]";
    case "email":
      return "[EMAIL DIANONIMKAN]";
    case "birth_date":
      return "[TANGGAL LAHIR DIANONIMKAN]";
    case "identity_number":
      return "[NOMOR IDENTITAS DIANONIMKAN]";
    case "child_data":
      return "[DATA ANAK DIANONIMKAN]";
    case "custom":
      return "[DATA SENSITIF DIANONIMKAN]";
    default:
      return "[DATA DIANONIMKAN]";
  }
}

function makeEntityId(type: string, value: string, start: number, end: number) {
  return createHash("sha1").update(`${type}:${value}:${start}:${end}`).digest("hex").slice(0, 20);
}

function createSuggestion(input: {
  type: JlfSensitiveEntityType;
  label: string;
  value: string;
  start: number;
  end: number;
  confidence: number;
  source: JlfSensitiveEntitySuggestion["source"];
  reason: string;
  acceptedByDefault?: boolean;
}): JlfSensitiveEntitySuggestion {
  return {
    id: makeEntityId(input.type, input.value, input.start, input.end),
    type: input.type,
    label: input.label,
    value: input.value,
    replacement: replacementForType(input.type),
    start: input.start,
    end: input.end,
    confidence: Math.max(0, Math.min(1, input.confidence)),
    source: input.source,
    reason: input.reason,
    acceptedByDefault: input.acceptedByDefault ?? true,
  };
}

function findRegexSuggestions(text: string, regex: RegExp, input: Omit<Parameters<typeof createSuggestion>[0], "value" | "start" | "end">) {
  const suggestions: JlfSensitiveEntitySuggestion[] = [];
  for (const match of text.matchAll(regex)) {
    if (match.index === undefined || !match[0]) continue;
    suggestions.push(createSuggestion({
      ...input,
      value: compactWhitespace(match[0]),
      start: match.index,
      end: match.index + match[0].length,
    }));
  }
  return suggestions;
}

function findLiteralSuggestions(
  text: string,
  values: string[] | undefined,
  input: Omit<Parameters<typeof createSuggestion>[0], "value" | "start" | "end">
) {
  const suggestions: JlfSensitiveEntitySuggestion[] = [];
  const seen = new Set<string>();

  for (const rawValue of values ?? []) {
    const value = compactWhitespace(rawValue);
    if (value.length < 3) continue;
    const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escaped, "giu");
    for (const match of text.matchAll(regex)) {
      if (match.index === undefined) continue;
      const key = `${input.type}:${match.index}:${match[0].length}`;
      if (seen.has(key)) continue;
      seen.add(key);
      suggestions.push(createSuggestion({
        ...input,
        value: match[0],
        start: match.index,
        end: match.index + match[0].length,
      }));
    }
  }

  return suggestions;
}

function deduplicateSuggestions(suggestions: JlfSensitiveEntitySuggestion[]) {
  const sorted = suggestions
    .filter((item) => item.start >= 0 && item.end > item.start)
    .sort((a, b) => a.start - b.start || b.confidence - a.confidence || b.end - a.end);
  const accepted: JlfSensitiveEntitySuggestion[] = [];

  for (const suggestion of sorted) {
    const overlaps = accepted.some((item) => suggestion.start < item.end && suggestion.end > item.start);
    if (!overlaps) accepted.push(suggestion);
  }

  return accepted.sort((a, b) => a.start - b.start);
}

export function assertAnonymizerUploadMetadata(file: Pick<UploadableAnonymizerFile, "name" | "size" | "type">, allowedExtensions: string[], maxSizeMb: number) {
  if (file.size <= 0) {
    jlfBadRequest("File anonimisasi kosong.");
  }

  if (file.size > maxSizeMb * 1024 * 1024) {
    throw new ApiError(413, `Ukuran file anonimisasi melebihi batas ${maxSizeMb}MB.`);
  }

  const extension = getExtension(file.name);
  if (EXECUTABLE_EXTENSIONS.has(extension)) {
    jlfBadRequest("File executable tidak boleh diproses anonimisasi.");
  }

  if (!allowedExtensions.includes(extension)) {
    jlfBadRequest(`Ekstensi .${extension || "-"} belum diizinkan untuk anonimisasi JLF.`);
  }

  const contentType = file.type?.trim().toLowerCase();
  const looseAllowedMimeTypes = new Set([
    "",
    "application/octet-stream",
    "application/rtf",
    "text/rtf",
    "text/plain",
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ]);

  if (contentType && !looseAllowedMimeTypes.has(contentType)) {
    jlfBadRequest("Tipe file anonimisasi tidak sesuai dengan daftar yang diizinkan.");
  }
}

async function readUploadSettings(db: AletaDatabase) {
  const row = await db.prepare("SELECT value FROM jlf_settings WHERE key = ?").get<SettingRow>("jlf.upload.allowed_anonymizer_types");
  const allowedExtensions = normalizeAllowedExtensions(row?.value);
  const maxSizeMb = await getJsonSetting<number>(db, "jlf.upload.max_file_size_mb", 25);
  return { allowedExtensions, maxSizeMb: Number(maxSizeMb) || 25 };
}

async function extractTextFromFile(file: UploadableAnonymizerFile) {
  const extension = getExtension(file.name);
  const buffer = Buffer.from(await file.arrayBuffer());

  if (extension === "txt") {
    return { text: normalizeText(buffer.toString("utf8")), fileType: "txt", checksum: createHash("sha256").update(buffer).digest("hex") };
  }

  if (extension === "rtf") {
    return { text: normalizeText(buffer.toString("latin1")), fileType: "rtf", checksum: createHash("sha256").update(buffer).digest("hex") };
  }

  jlfBadRequest("Pemrosesan isi DOCX/PDF belum diaktifkan tanpa worker/sandbox. Gunakan TXT/RTF untuk tahap ini.");
}

export function detectSensitiveEntities(text: string, context: ManualScanContext = {}) {
  const source = normalizeText(text).slice(0, MAX_PREVIEW_CHARS);
  const suggestions = [
    ...findRegexSuggestions(source, /\b\d{16}\b/gu, {
      type: "nik",
      label: "NIK",
      confidence: 0.98,
      source: "rule",
      reason: "Pola 16 digit menyerupai NIK.",
    }),
    ...findRegexSuggestions(source, /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu, {
      type: "email",
      label: "Email",
      confidence: 0.98,
      source: "rule",
      reason: "Pola alamat email.",
    }),
    ...findRegexSuggestions(source, /(?:\+62|62|0)8[\d\s().-]{7,16}\d/gu, {
      type: "phone",
      label: "Nomor telepon",
      confidence: 0.9,
      source: "rule",
      reason: "Pola nomor telepon Indonesia.",
    }),
    ...findRegexSuggestions(source, /\b(?:tanggal lahir|ttl|lahir)\s*[:\-]?\s*[A-Za-zÀ-ÿ\s,]*\d{1,2}[\/\-\s](?:\d{1,2}|[A-Za-zÀ-ÿ]+)[\/\-\s]\d{2,4}\b/giu, {
      type: "birth_date",
      label: "Tanggal lahir",
      confidence: 0.82,
      source: "rule",
      reason: "Teks mengandung label tanggal lahir.",
    }),
    ...findRegexSuggestions(source, /\b(?:no\.?\s*)?(?:ktp|kk|paspor|sim|identitas)\s*[:\-]?\s*[A-Z0-9.\-\/]{6,32}\b/giu, {
      type: "identity_number",
      label: "Nomor identitas",
      confidence: 0.78,
      source: "rule",
      reason: "Pola nomor identitas berlabel.",
    }),
    ...findRegexSuggestions(source, /\b(?:jl\.?|jalan|lorong|desa|kelurahan|kecamatan|kabupaten|kota)\s+[^\n,;]{6,140}/giu, {
      type: "address",
      label: "Alamat",
      confidence: 0.72,
      source: "rule",
      reason: "Teks mengandung penanda alamat.",
    }),
    ...findRegexSuggestions(source, /\b(?:anak\s+(?:bernama|yang bernama)|nama anak)\s*[:\-]?\s+[A-ZÀ-Ý][A-Za-zÀ-ÿ.'\-\s]{2,80}/gu, {
      type: "child_data",
      label: "Data anak",
      confidence: 0.76,
      source: "rule",
      reason: "Teks mengandung label data anak.",
    }),
    ...findLiteralSuggestions(source, context.partyNames, {
      type: "party_name",
      label: "Nama pihak",
      confidence: 0.9,
      source: "case_context",
      reason: "Nama ditemukan dari konteks perkara.",
    }),
    ...findLiteralSuggestions(source, context.customTerms, {
      type: "custom",
      label: "Data sensitif kustom",
      confidence: 0.86,
      source: "case_context",
      reason: "Istilah terdaftar sebagai data sensitif kustom.",
    }),
  ];

  return deduplicateSuggestions(suggestions);
}

export async function scanAnonymizationDocument(
  db: AletaDatabase,
  actor: UserPersona,
  file: UploadableAnonymizerFile,
  input: ManualScanContext & { includeAiSuggestions?: boolean } = {},
  audit?: AuditMeta
) {
  requireJlfPermission(actor, JLF_PERMISSION.AI_USE);
  const settings = await readUploadSettings(db);
  assertAnonymizerUploadMetadata(file, settings.allowedExtensions, settings.maxSizeMb);
  const extracted = await extractTextFromFile(file);
  const ruleSuggestions = detectSensitiveEntities(extracted.text, input);
  const warnings: string[] = [];
  let aiResult: unknown = null;

  if (input.includeAiSuggestions) {
    try {
      aiResult = await runAnonymizationAssistant(db, actor, {
        inputText: extracted.text.slice(0, 12_000),
        context: {
          nomorPerkara: input.nomorPerkara,
          partyNames: input.partyNames,
          note: "AI hanya memberi saran. User wajib approve manual.",
        },
      }, audit);
      warnings.push("Saran AI bersifat bahan bantu dan belum otomatis diterapkan.");
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : "Saran AI anonimisasi belum tersedia.");
    }
  }

  await logAction(db, {
    userId: actor.id,
    action: "anonymizer.scan",
    entityType: "jlf_anonymizer",
    nomorPerkara: input.nomorPerkara,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
    metadata: {
      originalFileName: file.name,
      fileType: extracted.fileType,
      checksum: extracted.checksum,
      detectedEntities: ruleSuggestions.length,
      aiRequested: Boolean(input.includeAiSuggestions),
    },
  });

  return {
    originalFileName: file.name,
    fileType: extracted.fileType,
    checksum: extracted.checksum,
    text: extracted.text,
    textTruncated: extracted.text.length > MAX_PREVIEW_CHARS,
    suggestions: ruleSuggestions,
    aiResult,
    warnings,
    limits: {
      maxUploadSizeMb: settings.maxSizeMb,
      allowedExtensions: settings.allowedExtensions,
      supportedExtractionTypes: DEFAULT_ALLOWED_EXTENSIONS,
    },
  };
}

function applyAcceptedSuggestions(text: string, suggestions: JlfSensitiveEntitySuggestion[], acceptedIds: string[]) {
  const acceptedSet = new Set(acceptedIds);
  const selected = suggestions
    .filter((item) => acceptedSet.has(item.id))
    .sort((a, b) => b.start - a.start);
  let output = text;

  for (const item of selected) {
    output = `${output.slice(0, item.start)}${item.replacement}${output.slice(item.end)}`;
  }

  return {
    text: output,
    appliedCount: selected.length,
  };
}

export async function storeAnonymizedDocument(
  actor: UserPersona,
  input: {
    originalFileName: string;
    fileType?: string;
    text: string;
    entityCount: number;
  }
) {
  const fileType = input.fileType === "rtf" ? "rtf" : "txt";
  const id = randomUUID();
  const now = new Date().toISOString();
  const directory = getAnonymizedStorageDirectory();
  await mkdir(directory, { recursive: true });

  const safeBaseName = sanitizeFileName(input.originalFileName).replace(/\.[^.]+$/, "") || "dokumen";
  const fileName = `${Date.now()}-${id.slice(0, 8)}-${safeBaseName}-anonim.${fileType}`;
  const metaFileName = `${fileName}.json`;
  const absolutePath = resolveCandidatePath(directory, fileName);
  const metaAbsolutePath = resolveCandidatePath(directory, metaFileName);
  const buffer = Buffer.from(input.text, fileType === "rtf" ? "latin1" : "utf8");
  const metadata: AnonymizedDocumentMeta = {
    id,
    fileName,
    originalFileName: input.originalFileName,
    fileType,
    checksum: createHash("sha256").update(buffer).digest("hex"),
    size: buffer.byteLength,
    createdAt: now,
    createdBy: actor.id,
    entityCount: input.entityCount,
  };

  await writeFile(absolutePath, buffer);
  await writeFile(metaAbsolutePath, JSON.stringify(metadata, null, 2));

  return metadata;
}

export async function generateAnonymizedDocument(
  db: AletaDatabase,
  actor: UserPersona,
  input: {
    originalFileName: string;
    fileType?: string;
    text: string;
    suggestions: JlfSensitiveEntitySuggestion[];
    acceptedSuggestionIds: string[];
    nomorPerkara?: string;
  },
  audit?: AuditMeta
) {
  requireJlfPermission(actor, JLF_PERMISSION.AI_USE);
  const sourceText = normalizeText(input.text);
  if (!sourceText.trim()) {
    jlfBadRequest("Isi dokumen untuk anonimisasi wajib tersedia.");
  }

  const applied = applyAcceptedSuggestions(sourceText, input.suggestions, input.acceptedSuggestionIds);
  const stored = await storeAnonymizedDocument(actor, {
    originalFileName: input.originalFileName,
    fileType: input.fileType,
    text: applied.text,
    entityCount: applied.appliedCount,
  });

  await logAction(db, {
    userId: actor.id,
    action: "anonymizer.generate",
    entityType: "jlf_anonymized_document",
    entityId: stored.id,
    nomorPerkara: input.nomorPerkara,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
    metadata: {
      originalFileName: input.originalFileName,
      outputFileType: stored.fileType,
      checksum: stored.checksum,
      appliedEntities: applied.appliedCount,
    },
  });

  return {
    ...stored,
    downloadUrl: `/api/judicia/legal-form/anonymizer/documents/${stored.id}/download`,
  };
}

async function readAnonymizedMetadata(id: string) {
  const directory = getAnonymizedStorageDirectory();
  const fs = await import("node:fs/promises");
  const files = await fs.readdir(directory).catch(() => []);
  const metaFileName = files.find((file) => file.endsWith(".json") && file.includes(id.slice(0, 8)));
  if (!metaFileName) jlfNotFound("Dokumen anonim JLF tidak ditemukan.");
  const metaPath = resolveCandidatePath(directory, metaFileName);
  const metadata = JSON.parse(await readFile(metaPath, "utf8")) as AnonymizedDocumentMeta;
  if (metadata.id !== id) jlfNotFound("Dokumen anonim JLF tidak ditemukan.");
  return metadata;
}

export async function getAnonymizedDocumentDownload(
  db: AletaDatabase,
  actor: UserPersona,
  id: string,
  audit?: AuditMeta
) {
  const access = requireJlfPermission(actor, JLF_PERMISSION.DOCUMENT_DOWNLOAD);
  const metadata = await readAnonymizedMetadata(id);

  if (metadata.createdBy !== actor.id && !access.isAdmin && !access.isSuperAdmin) {
    jlfNotFound("Dokumen anonim JLF tidak ditemukan.");
  }

  const directory = getAnonymizedStorageDirectory();
  const absolutePath = resolveCandidatePath(directory, metadata.fileName);
  const fileInfo = await stat(absolutePath).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") jlfNotFound("File dokumen anonim JLF tidak ditemukan.");
    throw error;
  });

  if (!fileInfo.isFile() || fileInfo.size <= 0) {
    jlfNotFound("File dokumen anonim JLF tidak valid.");
  }

  await logAction(db, {
    userId: actor.id,
    action: "anonymizer.download",
    entityType: "jlf_anonymized_document",
    entityId: id,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
    metadata: {
      outputFileType: metadata.fileType,
      checksum: metadata.checksum,
    },
  });

  return {
    buffer: await readFile(absolutePath),
    fileName: metadata.fileName,
    contentType: metadata.fileType === "rtf" ? "application/rtf" : "text/plain; charset=utf-8",
  };
}

export const JlfSensitiveEntityDetector = {
  detectSensitiveEntities,
};

export const JlfAnonymizationSuggestionService = {
  scanAnonymizationDocument,
};

export const JlfAnonymizedDocumentService = {
  generateAnonymizedDocument,
  getAnonymizedDocumentDownload,
};

export const JlfAnonymizationService = {
  scanAnonymizationDocument,
  generateAnonymizedDocument,
  getAnonymizedDocumentDownload,
};
