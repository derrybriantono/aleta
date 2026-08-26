import { ApiError } from "@/server/shared/errors";
import {
  detectAllPlaceholders,
  normalizePlaceholder,
  type JlfDetectedPlaceholder,
} from "@/server/modules/judicia/legal-form/templates/jlf-placeholder-service";
import {
  escapeDocxText,
  escapeRtfText,
  stringifyValueForDocument,
} from "@/server/modules/judicia/legal-form/documents/jlf-transform-service";

export type JlfRenderVariableValue = {
  key: string;
  placeholder: string;
  value: unknown;
  warnings?: string[];
  error?: string;
};

export type JlfRenderResult = {
  buffer: Buffer;
  outputFileType: "rtf" | "txt";
  renderedText: string;
  replacedPlaceholders: string[];
  emptyPlaceholders: string[];
  unknownPlaceholders: JlfDetectedPlaceholder[];
  warnings: string[];
};

function escapeValueForFileType(value: unknown, fileType: string) {
  if (fileType === "rtf") return escapeRtfText(value);
  if (fileType === "docx") return escapeDocxText(value);
  return stringifyValueForDocument(value);
}

export function buildRenderValueMap(values: JlfRenderVariableValue[], fileType: string) {
  const map = new Map<string, string>();
  const normalizedMap = new Map<string, string>();
  const emptyPlaceholders: string[] = [];

  for (const item of values) {
    const rawValue = stringifyValueForDocument(item.value);
    if (!rawValue) emptyPlaceholders.push(item.placeholder);
    const escaped = escapeValueForFileType(item.value, fileType);
    map.set(item.placeholder, escaped);
    normalizedMap.set(normalizePlaceholder(item.placeholder), escaped);
  }

  return { map, normalizedMap, emptyPlaceholders };
}

export function renderStringTemplate(input: {
  content: string;
  fileType: "rtf" | "txt";
  values: JlfRenderVariableValue[];
}) {
  const detected = detectAllPlaceholders(input.content);
  const { map, normalizedMap, emptyPlaceholders } = buildRenderValueMap(input.values, input.fileType);
  const knownNormalized = new Set(input.values.map((item) => normalizePlaceholder(item.placeholder)));
  const unknownPlaceholders = detected.filter((item) => !knownNormalized.has(item.normalizedKey));
  const warnings = input.values.flatMap((item) => item.warnings ?? []);
  const replacedPlaceholders: string[] = [];

  let renderedText = input.content;
  for (const item of detected) {
    const replacement = map.get(item.placeholder) ?? normalizedMap.get(item.normalizedKey);
    if (replacement === undefined) {
      renderedText = renderedText.split(item.placeholder).join("");
      continue;
    }
    renderedText = renderedText.split(item.placeholder).join(replacement);
    replacedPlaceholders.push(item.placeholder);
  }

  return {
    buffer: Buffer.from(renderedText, input.fileType === "rtf" ? "latin1" : "utf8"),
    outputFileType: input.fileType,
    renderedText,
    replacedPlaceholders: Array.from(new Set(replacedPlaceholders)),
    emptyPlaceholders: Array.from(new Set(emptyPlaceholders)),
    unknownPlaceholders,
    warnings: Array.from(new Set([
      ...warnings,
      ...unknownPlaceholders.map((item) => `${item.placeholder} belum dimapping dan dikosongkan saat render.`),
    ])),
  } satisfies JlfRenderResult;
}

export function renderTemplateBuffer(input: {
  buffer: Buffer;
  fileType: string;
  values: JlfRenderVariableValue[];
}) {
  const fileType = input.fileType.trim().toLowerCase();

  if (fileType === "rtf") {
    return renderStringTemplate({
      content: input.buffer.toString("latin1"),
      fileType: "rtf",
      values: input.values,
    });
  }

  if (fileType === "txt" || fileType === "text") {
    return renderStringTemplate({
      content: input.buffer.toString("utf8"),
      fileType: "txt",
      values: input.values,
    });
  }

  if (fileType === "docx") {
    throw new ApiError(
      422,
      "Rendering DOCX penuh belum aktif. Tahap ini baru mendukung render RTF/text-safe tanpa dependency dokumen baru."
    );
  }

  throw new ApiError(422, "Format template JLF belum didukung untuk generate dokumen.");
}

export const JlfTemplateRenderService = {
  renderStringTemplate,
  renderTemplateBuffer,
  buildRenderValueMap,
};
