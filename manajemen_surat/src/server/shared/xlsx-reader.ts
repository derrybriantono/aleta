import { inflateRawSync } from "node:zlib";

import { ApiError } from "@/server/shared/errors";

type ZipEntry = {
  name: string;
  compression: number;
  compressedSize: number;
  localHeaderOffset: number;
};

function decodeXml(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function getAttribute(source: string, name: string) {
  const match = source.match(new RegExp(`\\b${name}="([^"]*)"`, "i"));
  return match ? decodeXml(match[1] ?? "") : "";
}

function findEndOfCentralDirectory(buffer: Buffer) {
  const signature = 0x06054b50;
  const minOffset = Math.max(0, buffer.length - 0xffff - 22);
  for (let offset = buffer.length - 22; offset >= minOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === signature) return offset;
  }
  throw new ApiError(400, "File XLSX tidak valid: struktur ZIP tidak ditemukan.");
}

function listZipEntries(buffer: Buffer) {
  const endOffset = findEndOfCentralDirectory(buffer);
  const entryCount = buffer.readUInt16LE(endOffset + 10);
  const directoryOffset = buffer.readUInt32LE(endOffset + 16);
  const entries: ZipEntry[] = [];
  let offset = directoryOffset;

  for (let index = 0; index < entryCount; index += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) {
      throw new ApiError(400, "File XLSX tidak valid: central directory rusak.");
    }
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

function readZipEntry(buffer: Buffer, entry: ZipEntry) {
  const offset = entry.localHeaderOffset;
  if (buffer.readUInt32LE(offset) !== 0x04034b50) {
    throw new ApiError(400, `File XLSX tidak valid: local header ${entry.name} rusak.`);
  }
  const nameLength = buffer.readUInt16LE(offset + 26);
  const extraLength = buffer.readUInt16LE(offset + 28);
  const dataStart = offset + 30 + nameLength + extraLength;
  const compressed = buffer.subarray(dataStart, dataStart + entry.compressedSize);

  if (entry.compression === 0) return compressed;
  if (entry.compression === 8) return inflateRawSync(compressed);
  throw new ApiError(400, `File XLSX memakai kompresi yang belum didukung (${entry.compression}).`);
}

function readZipFiles(buffer: Buffer) {
  const files = new Map<string, Buffer>();
  for (const entry of listZipEntries(buffer)) {
    files.set(entry.name.replace(/^\/+/, ""), readZipEntry(buffer, entry));
  }
  return files;
}

function parseSharedStrings(xml: string) {
  const strings: string[] = [];
  const itemRegex = /<si\b[^>]*>([\s\S]*?)<\/si>/gi;
  let match: RegExpExecArray | null;
  while ((match = itemRegex.exec(xml))) {
    const body = match[1] ?? "";
    const textParts = Array.from(body.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/gi)).map((part) => decodeXml(part[1] ?? ""));
    strings.push(textParts.join(""));
  }
  return strings;
}

function columnIndexFromReference(reference: string, fallback: number) {
  const letters = reference.match(/[A-Z]+/i)?.[0]?.toUpperCase();
  if (!letters) return fallback;
  let value = 0;
  for (const letter of letters) {
    value = value * 26 + (letter.charCodeAt(0) - 64);
  }
  return Math.max(0, value - 1);
}

function resolveFirstSheetPath(files: Map<string, Buffer>) {
  const workbookXml = files.get("xl/workbook.xml")?.toString("utf8") ?? "";
  const workbookRels = files.get("xl/_rels/workbook.xml.rels")?.toString("utf8") ?? "";
  const sheetMatch = workbookXml.match(/<sheet\b[^>]*r:id="([^"]+)"[^>]*>/i);
  const relationshipId = sheetMatch ? sheetMatch[1] : "";

  if (relationshipId && workbookRels) {
    const relRegex = /<Relationship\b[^>]*>/gi;
    let relMatch: RegExpExecArray | null;
    while ((relMatch = relRegex.exec(workbookRels))) {
      const tag = relMatch[0] ?? "";
      if (getAttribute(tag, "Id") !== relationshipId) continue;
      const target = getAttribute(tag, "Target").replace(/^\/+/, "");
      return target.startsWith("xl/") ? target : `xl/${target}`;
    }
  }

  return "xl/worksheets/sheet1.xml";
}

function cellValue(attributes: string, body: string, sharedStrings: string[]) {
  const type = getAttribute(attributes, "t");
  if (type === "inlineStr") {
    return Array.from(body.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/gi)).map((match) => decodeXml(match[1] ?? "")).join("");
  }

  const value = decodeXml(body.match(/<v\b[^>]*>([\s\S]*?)<\/v>/i)?.[1] ?? "");
  if (type === "s") return sharedStrings[Number(value)] ?? "";
  if (type === "b") return value === "1" ? "TRUE" : "FALSE";
  return value;
}

export function readXlsxRows(buffer: Buffer, options: { maxRows?: number; maxColumns?: number } = {}) {
  const maxRows = options.maxRows ?? 5000;
  const maxColumns = options.maxColumns ?? 80;
  const files = readZipFiles(buffer);
  const sharedStrings = parseSharedStrings(files.get("xl/sharedStrings.xml")?.toString("utf8") ?? "");
  const sheetPath = resolveFirstSheetPath(files);
  const sheetXml = files.get(sheetPath)?.toString("utf8");
  if (!sheetXml) throw new ApiError(400, "Sheet pertama tidak ditemukan dalam file XLSX.");

  const rows: string[][] = [];
  const rowRegex = /<row\b[^>]*>([\s\S]*?)<\/row>/gi;
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowRegex.exec(sheetXml)) && rows.length < maxRows) {
    const body = rowMatch[1] ?? "";
    const row: string[] = [];
    const cellRegex = /<c\b([^>]*)>([\s\S]*?)<\/c>/gi;
    let cellMatch: RegExpExecArray | null;
    let fallbackColumn = 0;

    while ((cellMatch = cellRegex.exec(body)) && row.length < maxColumns) {
      const attributes = cellMatch[1] ?? "";
      const columnIndex = columnIndexFromReference(getAttribute(attributes, "r"), fallbackColumn);
      row[columnIndex] = cellValue(attributes, cellMatch[2] ?? "", sharedStrings).trim();
      fallbackColumn = columnIndex + 1;
    }

    if (row.some((value) => value)) rows.push(row.map((value) => value ?? ""));
  }

  if (rows.length < 2) throw new ApiError(400, "File XLSX minimal harus berisi header dan satu baris data pegawai.");
  return rows;
}

export function rowsToDelimitedText(rows: string[][]) {
  return rows
    .map((row) => row.map((value) => {
      const text = String(value ?? "");
      return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    }).join(","))
    .join("\n");
}
