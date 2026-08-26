import { type AletaDatabase } from "@/server/db/client";
import { ApiError } from "@/server/shared/errors";

function looksLikeListKey(key: string) {
  return /(ringkasan|detail|daftar|data|hasil|items?|list|informasi)/i.test(key);
}

function normalizeListItem(value: string) {
  return value
    .replace(/^\s*(?:[-*]|\d+[.)])\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function looksLikeFieldDetailLines(lines: string[]) {
  if (lines.length <= 1) return false;
  const fieldLikeCount = lines
    .map(normalizeListItem)
    .filter((line) => /^[A-Za-z_ /().-]{2,45}:\s+\S/.test(line)).length;
  return fieldLikeCount >= Math.ceil(lines.length * 0.6);
}

export function formatAletaBotTemplateValue(key: string, value: unknown) {
  if (value === undefined || value === null) return "";
  if (Array.isArray(value)) {
    const items = value.map((item) => normalizeListItem(String(item))).filter(Boolean);
    return items.length > 1 ? items.map((item, index) => `${index + 1}. ${item}`).join("\n") : (items[0] ?? "");
  }

  const text = String(value).replace(/\r\n/g, "\n").trim();
  if (key.toLowerCase() === "ringkasan") return text;
  if (!text || !looksLikeListKey(key)) return text;
  if (/^\s*\d+[.)]\s+/m.test(text)) return text;

  const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const separators = text.includes("\n\n")
    ? /\n{2,}/
    : text.includes(" | ")
      ? /\s+\|\s+/
      : text.includes("\n") && !looksLikeFieldDetailLines(lines)
        ? /\n+/
        : null;
  if (!separators) return text;

  const items = text.split(separators).map(normalizeListItem).filter(Boolean);
  return items.length > 1 ? items.map((item, index) => `${index + 1}. ${item}`).join("\n") : text;
}

export function renderAletaBotMessageTemplate(body: string, values: Record<string, unknown>) {
  return body.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => {
    const value = values[key];
    return formatAletaBotTemplateValue(key, value);
  });
}

export async function getAletaBotTemplateBody(
  db: AletaDatabase,
  templateId: string
) {
  const row = await db
    .prepare(`SELECT body FROM aleta_bot_templates WHERE id = ?`)
    .get<{ body: string }>(templateId);
  const body = String(row?.body || "").trim();

  if (!body) {
    throw new ApiError(500, `Template ALETA Bot ${templateId} belum tersedia di database.`);
  }

  return body;
}
