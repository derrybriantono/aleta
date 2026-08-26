const MONTHS_ID = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

const DAYS_ID = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const HIJRI_MONTHS_ABT = [
  "Muharram",
  "Safar",
  "Rabiul Awwal",
  "Rabiul Akhir",
  "Jumadil Awwal",
  "Jumadil Akhir",
  "Rajab",
  "Sya'ban",
  "Ramadhan",
  "Syawwal",
  "Zulqaidah",
  "Zulhijjah",
];

function parseDate(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value !== "string" && typeof value !== "number") return null;

  const text = String(value).trim();
  if (!text) return null;

  const date = new Date(text);
  if (!Number.isNaN(date.getTime())) return date;

  const match = text.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (!match) return null;

  const [, day, month, year] = match;
  const parsed = new Date(Number(year), Number(month) - 1, Number(day));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function makeAbtInt(value: number) {
  return value < -0.0000001 ? Math.ceil(value - 0.0000001) : Math.floor(value + 0.0000001);
}

function parseDateParts(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return { day: value.getDate(), month: value.getMonth() + 1, year: value.getFullYear() };
  }

  const text = String(value ?? "").trim();
  const iso = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (iso) return { year: Number(iso[1]), month: Number(iso[2]), day: Number(iso[3]) };

  const local = text.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (local) return { day: Number(local[1]), month: Number(local[2]), year: Number(local[3]) };

  const date = parseDate(value);
  if (!date) return null;
  return { day: date.getDate(), month: date.getMonth() + 1, year: date.getFullYear() };
}

export function sanitizeTextForDocument(value: unknown, options: { preserveLineBreaks?: boolean } = {}) {
  const normalized = String(value ?? "")
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\/\s*p\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, " ");

  if (!options.preserveLineBreaks) return normalized.replace(/\s+/g, " ").trim();

  return normalized
    .split(/\n+/)
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

export function formatTanggalIndonesiaPanjang(value: unknown) {
  const date = parseDate(value);
  if (!date) return sanitizeTextForDocument(value);
  return `${date.getDate()} ${MONTHS_ID[date.getMonth()]} ${date.getFullYear()}`;
}

export function formatTanggalIndonesiaPendek(value: unknown) {
  const date = parseDate(value);
  if (!date) return sanitizeTextForDocument(value);
  return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()}`;
}

export function formatHariIndonesia(value: unknown) {
  const date = parseDate(value);
  if (!date) return "";
  return DAYS_ID[date.getDay()] ?? "";
}

export function formatBulanIndonesia(value: unknown) {
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric >= 1 && numeric <= 12) {
    return MONTHS_ID[Math.floor(numeric) - 1] ?? "";
  }
  const date = parseDate(value);
  return date ? MONTHS_ID[date.getMonth()] ?? "" : sanitizeTextForDocument(value);
}

export function formatTanggalHijriahIndonesia(value: unknown) {
  const parts = parseDateParts(value);
  if (!parts || !parts.day || !parts.month || !parts.year) return sanitizeTextForDocument(value);

  const { day, month, year } = parts;
  const jd = year > 1582 || (year === 1582 && month > 10) || (year === 1582 && month === 10 && day > 14)
    ? makeAbtInt((1461 * (year + 4800 + makeAbtInt((month - 14) / 12))) / 4) +
      makeAbtInt((367 * (month - 2 - 12 * makeAbtInt((month - 14) / 12))) / 12) -
      makeAbtInt((3 * makeAbtInt((year + 4900 + makeAbtInt((month - 14) / 12)) / 100)) / 4) +
      day -
      32075
    : 367 * year -
      makeAbtInt((7 * (year + 5001 + makeAbtInt((month - 9) / 7))) / 4) +
      makeAbtInt((275 * month) / 9) +
      day +
      1729777;

  let lunar = jd - 1948440 + 10632;
  const cycle = makeAbtInt((lunar - 1) / 10631);
  lunar = lunar - 10631 * cycle + 354;
  const correction =
    makeAbtInt((10985 - lunar) / 5316) * makeAbtInt((50 * lunar) / 17719) +
    makeAbtInt(lunar / 5670) * makeAbtInt((43 * lunar) / 15238);
  lunar =
    lunar -
    makeAbtInt((30 - correction) / 15) * makeAbtInt((17719 * correction) / 50) -
    makeAbtInt(correction / 16) * makeAbtInt((15238 * correction) / 43) +
    29;
  const hijriMonth = makeAbtInt((24 * lunar) / 709);
  const hijriDay = lunar - makeAbtInt((709 * hijriMonth) / 24);
  const hijriYear = 30 * cycle + correction - 30;
  let monthIndex = (hijriMonth % 12) - 1;
  if (monthIndex === -1) monthIndex = 11;

  return `${hijriDay} ${HIJRI_MONTHS_ABT[monthIndex] ?? ""} ${hijriYear}`.replace(/\s+/g, " ").trim();
}

function terbilangBelowThousand(value: number): string {
  const words = [
    "",
    "satu",
    "dua",
    "tiga",
    "empat",
    "lima",
    "enam",
    "tujuh",
    "delapan",
    "sembilan",
    "sepuluh",
    "sebelas",
  ];

  if (value < 12) return words[value] ?? "";
  if (value < 20) return `${terbilangBelowThousand(value - 10)} belas`;
  if (value < 100) {
    const puluh = Math.floor(value / 10);
    const sisa = value % 10;
    return `${terbilangBelowThousand(puluh)} puluh${sisa ? ` ${terbilangBelowThousand(sisa)}` : ""}`;
  }
  if (value < 200) return `seratus${value > 100 ? ` ${terbilangBelowThousand(value - 100)}` : ""}`;

  const ratus = Math.floor(value / 100);
  const sisa = value % 100;
  return `${terbilangBelowThousand(ratus)} ratus${sisa ? ` ${terbilangBelowThousand(sisa)}` : ""}`;
}

export function angkaTerbilang(value: unknown) {
  const number = Math.floor(Math.abs(Number(String(value).replace(/[^\d.-]/g, ""))));
  if (!Number.isFinite(number)) return sanitizeTextForDocument(value);
  if (number === 0) return "nol";

  const groups = [
    { value: 1_000_000_000_000, label: "triliun" },
    { value: 1_000_000_000, label: "miliar" },
    { value: 1_000_000, label: "juta" },
    { value: 1_000, label: "ribu" },
  ];

  let remaining = number;
  const parts: string[] = [];

  for (const group of groups) {
    const amount = Math.floor(remaining / group.value);
    if (amount <= 0) continue;

    if (group.value === 1_000 && amount === 1) {
      parts.push("seribu");
    } else {
      parts.push(`${angkaTerbilang(amount)} ${group.label}`);
    }
    remaining %= group.value;
  }

  if (remaining > 0) parts.push(terbilangBelowThousand(remaining));
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

export function formatRupiah(value: unknown) {
  const number = Number(String(value ?? "").replace(/[^\d.-]/g, ""));
  if (!Number.isFinite(number)) return sanitizeTextForDocument(value);
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(number).replace(/\s+/g, "");
}

function pickName(item: unknown) {
  if (!item || typeof item !== "object") return sanitizeTextForDocument(item);
  const record = item as Record<string, unknown>;
  return sanitizeTextForDocument(
    record.nama ??
      record.name ??
      record.fullname ??
      record.nama_lengkap ??
      record.hakim_nama ??
      record.pp_nama ??
      record.jurusita_nama ??
      ""
  );
}

export function formatNameList(value: unknown) {
  const items = Array.isArray(value) ? value : value ? [value] : [];
  return items.map(pickName).filter(Boolean).join(", ");
}

export function formatJadwalSidang(value: unknown) {
  if (!value || typeof value !== "object") return sanitizeTextForDocument(value);
  const record = value as Record<string, unknown>;
  const tanggal = record.tanggal ?? record.tanggal_sidang ?? record.date ?? record.sidang_date;
  const jam = sanitizeTextForDocument(record.jam ?? record.jam_sidang ?? record.time ?? "");
  const agenda = sanitizeTextForDocument(record.agenda ?? record.agenda_sidang ?? record.keterangan ?? "");
  const parts = [formatTanggalIndonesiaPanjang(tanggal), jam, agenda].filter(Boolean);
  return parts.join(", ");
}

export function formatUmur(value: unknown, now = new Date()) {
  const birthDate = parseDate(value);
  if (!birthDate) return sanitizeTextForDocument(value);
  let age = now.getFullYear() - birthDate.getFullYear();
  const monthDiff = now.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthDate.getDate())) age -= 1;
  return `${age} tahun`;
}

export function escapeRtfText(value: unknown) {
  const text = stringifyValueForDocument(value, { preserveLineBreaks: true }).replace(/\r\n?/g, "\n");
  const lines = text.split("\n").map((line) => line.replace(/[ \t]+/g, " ").trim());

  function escapeLine(line: string) {
    let output = "";
    for (const char of line) {
      const code = char.charCodeAt(0);
      if (char === "\\") output += "\\\\";
      else if (char === "{") output += "\\{";
      else if (char === "}") output += "\\}";
      else if (code > 127) output += `\\u${code}?`;
      else output += char;
    }
    return output;
  }

  if (lines.length <= 1) return escapeLine(lines[0] ?? "");
  return lines.map(escapeLine).join("\\line ");
}

export function escapeRtfInlineText(value: unknown) {
  const text = sanitizeTextForDocument(value);
  let output = "";
  for (const char of text) {
    const code = char.charCodeAt(0);
    if (char === "\\") output += "\\\\";
    else if (char === "{") output += "\\{";
    else if (char === "}") output += "\\}";
    else if (code > 127) output += `\\u${code}?`;
    else output += char;
  }
  return output;
}

export function escapeDocxText(value: unknown) {
  return String(value ?? "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function stringifyValueForDocument(value: unknown, options: { preserveLineBreaks?: boolean } = {}): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    const separator = options.preserveLineBreaks ? "\n" : ", ";
    return value.map((item) => stringifyValueForDocument(item, options)).filter(Boolean).join(separator);
  }
  if (typeof value === "object") return JSON.stringify(value);
  return sanitizeTextForDocument(value, options);
}

export function formatQrPayload(value: unknown) {
  if (typeof value === "string") return sanitizeTextForDocument(value);
  return JSON.stringify(value ?? {});
}

export function applyJlfTransform(value: unknown, transformKey?: string) {
  const key = (transformKey ?? "").trim().toLowerCase();
  if (!key) return value;

  switch (key) {
    case "tanggal_indonesia_panjang":
    case "tanggal_panjang":
      return formatTanggalIndonesiaPanjang(value);
    case "tanggal_indonesia_pendek":
    case "tanggal_pendek":
      return formatTanggalIndonesiaPendek(value);
    case "hari_indonesia":
    case "hari":
      return formatHariIndonesia(value);
    case "bulan_indonesia":
    case "bulan":
      return formatBulanIndonesia(value);
    case "angka_terbilang":
    case "terbilang":
      return angkaTerbilang(value);
    case "rupiah":
    case "format_rupiah":
      return formatRupiah(value);
    case "nama_pihak":
    case "alamat":
    case "sanitize_text":
      return sanitizeTextForDocument(value);
    case "daftar_majelis_hakim":
    case "daftar_panitera":
    case "daftar_jurusita":
      return formatNameList(value);
    case "jadwal_sidang":
      return formatJadwalSidang(value);
    case "umur":
      return formatUmur(value);
    case "escape_rtf":
      return escapeRtfText(value);
    case "escape_docx":
      return escapeDocxText(value);
    case "qr_payload":
      return formatQrPayload(value);
    case "tanggal_hijriah":
    case "tanggal_hijriah_todo":
    case "tanggal_hijriah_needs_review":
    case "convert_hijriah":
    case "hijriah":
      return formatTanggalHijriahIndonesia(value);
    default:
      return value;
  }
}

export const JlfTransformService = {
  apply: applyJlfTransform,
  tanggalIndonesiaPanjang: formatTanggalIndonesiaPanjang,
  tanggalIndonesiaPendek: formatTanggalIndonesiaPendek,
  hariIndonesia: formatHariIndonesia,
  bulanIndonesia: formatBulanIndonesia,
  tanggalHijriahIndonesia: formatTanggalHijriahIndonesia,
  angkaTerbilang,
  rupiah: formatRupiah,
  sanitizeText: sanitizeTextForDocument,
  escapeRtf: escapeRtfText,
  escapeDocx: escapeDocxText,
  formatQrPayload,
  stringifyValueForDocument,
};
