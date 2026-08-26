export type JlfLegacyAbtType =
  | "data_sql"
  | "data_sipp"
  | "data_teks"
  | "data_tanggal"
  | "tanggal_hari"
  | "tanggal_hijriah"
  | "terbilang"
  | "multi_sidang"
  | "tanya_jawab"
  | "qrcode"
  | "legacy_manual"
  | "ai";

export type JlfFieldMode =
  | "data_source"
  | "manual_input"
  | "date_mode"
  | "number_words"
  | "multi_data_sidang"
  | "qa_mode"
  | "qr_verification"
  | "ai_assist"
  | "computed";

export type JlfVariableModeInput = {
  legacyAbtType?: string | null;
  fieldMode?: string | null;
  dataType?: string | null;
  sourceType?: string | null;
  sourceKey?: string | null;
  transformKey?: string | null;
  legacyCode?: string | null;
  aiEnabled?: boolean | number | null;
};

const KNOWN_MULTI_SIDANG_LEGACY_CODES = new Set([
  "0032",
  "0033",
  "0041",
  "0050",
  "0076",
  "0182",
  "0183",
  "0184",
  "0185",
]);

const LEGACY_ABT_TYPE_LABELS: Record<JlfLegacyAbtType, string> = {
  data_sql: "ABT Query MySQL",
  data_sipp: "ABT Data SIPP",
  data_teks: "ABT Data Teks",
  data_tanggal: "ABT Data Tanggal",
  tanggal_hari: "ABT Hari Tanggal",
  tanggal_hijriah: "ABT Hijriah Tanggal",
  terbilang: "ABT Terbilang",
  multi_sidang: "ABT Multi Sidang",
  tanya_jawab: "ABT Tanya Jawab",
  qrcode: "ABT QR Code",
  legacy_manual: "ABT Manual Legacy",
  ai: "AI Assist",
};

const FIELD_MODE_LABELS: Record<JlfFieldMode, string> = {
  data_source: "Mode Sumber Data",
  manual_input: "Mode Input Manual",
  date_mode: "Mode Tanggal",
  number_words: "Mode Angka/Terbilang",
  multi_data_sidang: "Mode Multi Sidang",
  qa_mode: "Mode Tanya Jawab",
  qr_verification: "Mode QR/Verifikasi",
  ai_assist: "Mode AI Assist",
  computed: "Mode Computed",
};

export const JLF_LEGACY_ABT_TYPE_OPTIONS = Object.entries(LEGACY_ABT_TYPE_LABELS).map(([value, label]) => ({
  value: value as JlfLegacyAbtType,
  label,
}));

export const JLF_FIELD_MODE_OPTIONS = Object.entries(FIELD_MODE_LABELS).map(([value, label]) => ({
  value: value as JlfFieldMode,
  label,
}));

function normalizeValue(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function normalizeLegacyCode(value: string | null | undefined) {
  return (value ?? "").trim().replace(/^#|#$/g, "");
}

export function resolveLegacyAbtType(input: JlfVariableModeInput): JlfLegacyAbtType {
  const explicit = normalizeValue(input.legacyAbtType);
  if (explicit && explicit in LEGACY_ABT_TYPE_LABELS) return explicit as JlfLegacyAbtType;

  const dataType = normalizeValue(input.dataType);
  const sourceType = normalizeValue(input.sourceType);
  const sourceKey = normalizeValue(input.sourceKey);
  const transformKey = normalizeValue(input.transformKey);
  const legacyCode = normalizeLegacyCode(input.legacyCode);

  if (Boolean(input.aiEnabled) || sourceType === "ai" || dataType === "ai_generated_text") return "ai";
  if (sourceType === "qrcode" || dataType === "qrcode") return "qrcode";
  if (sourceType === "jlf_bas_qa") return "tanya_jawab";
  if (
    sourceType === "sipp_jadwal_sidang" &&
    (sourceKey.startsWith("sidang.") || KNOWN_MULTI_SIDANG_LEGACY_CODES.has(legacyCode))
  ) {
    return "multi_sidang";
  }
  if (transformKey.includes("hijriah")) return "tanggal_hijriah";
  if (transformKey.includes("hari_indonesia")) return "tanggal_hari";
  if (transformKey.includes("terbilang")) return "terbilang";
  if (sourceType === "jlf_manual" && (dataType === "manual_date" || dataType === "date")) return "data_tanggal";
  if (sourceType === "jlf_manual" || dataType === "manual_text") return "data_teks";
  if (sourceType.startsWith("sipp_")) return "data_sipp";
  if (sourceType === "abt_sql" || sourceType === "computed" || sourceType === "function" || sourceType === "static") return "data_sql";
  return "legacy_manual";
}

export function resolveJlfFieldMode(input: JlfVariableModeInput): JlfFieldMode {
  const explicit = normalizeValue(input.fieldMode);
  if (explicit && explicit in FIELD_MODE_LABELS) return explicit as JlfFieldMode;

  switch (resolveLegacyAbtType(input)) {
    case "data_sql":
    case "data_sipp":
      return "data_source";
    case "data_teks":
    case "legacy_manual":
      return "manual_input";
    case "data_tanggal":
    case "tanggal_hari":
    case "tanggal_hijriah":
      return "date_mode";
    case "terbilang":
      return "number_words";
    case "multi_sidang":
      return "multi_data_sidang";
    case "tanya_jawab":
      return "qa_mode";
    case "qrcode":
      return "qr_verification";
    case "ai":
      return "ai_assist";
  }
}

export function getLegacyAbtTypeLabel(value: string | null | undefined) {
  const normalized = resolveLegacyAbtType({ legacyAbtType: value });
  return LEGACY_ABT_TYPE_LABELS[normalized] ?? value ?? "-";
}

export function getJlfFieldModeLabel(value: string | null | undefined) {
  const normalized = resolveJlfFieldMode({ fieldMode: value });
  return FIELD_MODE_LABELS[normalized] ?? value ?? "-";
}
