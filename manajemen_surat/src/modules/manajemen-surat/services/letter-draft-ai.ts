import { contextualSearchRegulations } from "@/core/intelligence/aleta-intelligence-service";
import {
  inferLetterClassificationFromText,
  normalizeLetterClassificationDraft,
} from "@/lib/letter-taxonomy";
import { type AIGlobalConfig, type LetterType, type UserPersona } from "@/lib/types";

export type GeneratedLetterDraft = {
  nomorSurat: string;
  nomorUrut: string;
  tanggalSurat: string;
  tanggalAdministratif: string;
  pengirim: string;
  perihal: string;
  assignedUnit: string;
  confidentiality: "Biasa" | "Penting" | "Rahasia";
  asalSurat: string;
  tujuanSurat: string;
  kodeKlasifikasi: string;
  klasifikasi: string;
  klasifikasiTags: string[];
  ringkasan: string;
  tags: string[];
  lampiran: string[];
  suggestedTargetUserId: string;
  suggestedTargetPositionId: string;
  aiReviewNote: string;
};

const INDONESIAN_MONTHS: Record<string, string> = {
  januari: "01",
  februari: "02",
  maret: "03",
  april: "04",
  mei: "05",
  juni: "06",
  juli: "07",
  agustus: "08",
  september: "09",
  oktober: "10",
  november: "11",
  desember: "12",
};

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function toReadableCase(value: string) {
  const normalized = normalizeWhitespace(value);
  if (!normalized) return "";

  const hasLowercase = /[a-z]/.test(normalized);
  if (hasLowercase) {
    return normalized;
  }

  return normalized
    .toLowerCase()
    .split(" ")
    .map((segment) => {
      if (!segment) return segment;
      return segment.charAt(0).toUpperCase() + segment.slice(1);
    })
    .join(" ");
}

function normalizeLine(value: string) {
  return normalizeWhitespace(value.replace(/[|•]/g, " ").replace(/\u00a0/g, " "));
}

function getUsefulLines(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => normalizeLine(line))
    .filter(Boolean);
}

function normalizeDateParts(year: string, month: string, day: string) {
  const normalizedYear = year.length === 2 ? `20${year}` : year;
  const numericMonth = Number(month);
  const numericDay = Number(day);

  if (!Number.isFinite(numericMonth) || !Number.isFinite(numericDay)) {
    return null;
  }

  if (numericMonth < 1 || numericMonth > 12 || numericDay < 1 || numericDay > 31) {
    return null;
  }

  return `${normalizedYear.padStart(4, "0")}-${String(numericMonth).padStart(2, "0")}-${String(numericDay).padStart(2, "0")}`;
}

function parseDateCandidate(value: string) {
  const normalized = normalizeWhitespace(value).toLowerCase();
  if (!normalized) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return normalized;
  }

  const indoMatch = normalized.match(
    /\b(\d{1,2})\s+(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)\s+(\d{2,4})\b/i
  );
  if (indoMatch) {
    return normalizeDateParts(indoMatch[3], INDONESIAN_MONTHS[indoMatch[2].toLowerCase()] ?? "", indoMatch[1]);
  }

  const numericMatch = normalized.match(/\b(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})\b/);
  if (numericMatch) {
    return normalizeDateParts(numericMatch[3], numericMatch[2], numericMatch[1]);
  }

  return null;
}

type DateCandidate = {
  date: string;
  score: number;
  index: number;
};

function extractDateCandidates(
  lines: string[],
  keywords: string[],
  fallbackBoost = 0,
  requireKeyword = false
) {
  const candidates: DateCandidate[] = [];

  for (const [index, line] of lines.entries()) {
    const lowerLine = line.toLowerCase();
    const foundDate =
      parseDateCandidate(line) ??
      Array.from(
        line.matchAll(
          /\b\d{1,2}\s+(?:januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)\s+\d{2,4}\b|\b\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}\b/gi
        )
      )
        .map((match) => parseDateCandidate(match[0]))
        .find(Boolean) ??
      null;

    if (!foundDate) continue;

    let score = fallbackBoost;
    if (index < 12) score += 1;
    if (/,/.test(line)) score += 1;
    const keywordMatched = keywords.some((keyword) => lowerLine.includes(keyword));
    if (keywordMatched) {
      score += 6;
    }
    if (requireKeyword && !keywordMatched) {
      continue;
    }

    candidates.push({
      date: foundDate,
      score,
      index,
    });
  }

  return candidates.sort((left, right) => right.score - left.score || left.index - right.index);
}

function inferDocumentDates(text: string, type: LetterType) {
  const lines = getUsefulLines(text);
  const receiptCandidates = extractDateCandidates(
    lines,
    ["tanggal terima", "diterima", "penerimaan", "registrasi", "agenda", "diterima di", "diterima pada"],
    0,
    true
  );
  const letterCandidates = extractDateCandidates(
    lines,
    ["tanggal surat", "ditetapkan", "dikeluarkan", "ditandatangani", "pada tanggal", "tanggal:"],
    1
  );
  const genericCandidates = extractDateCandidates(lines, [], 0);

  const tanggalSurat =
    letterCandidates[0]?.date ??
    genericCandidates[0]?.date ??
    "";

  const tanggalAdministratif =
    type === "masuk"
      ? receiptCandidates[0]?.date ?? ""
      : extractDateCandidates(
          lines,
          ["tanggal kirim", "dikirim", "pengiriman", "outgoing", "tanggal keluar"],
          0,
          true
        )[0]?.date ?? "";

  return {
    tanggalSurat,
    tanggalAdministratif,
  };
}

function pickFirstMatch(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const value = match?.[1] ?? match?.[0];
    const normalized = value ? normalizeWhitespace(value) : "";
    if (normalized) {
      return normalized;
    }
  }

  return "";
}

function inferLetterNumber(text: string) {
  return pickFirstMatch(text, [
    /\bnomor\s*(?:surat)?\s*[:.]?\s*([A-Za-z0-9./_-]{4,})/i,
    /\bno\.?\s*[:.]?\s*([A-Za-z0-9./_-]{4,})/i,
  ]);
}

function inferSubject(text: string) {
  const explicitSubject = pickFirstMatch(text, [
    /\bperihal\s*[:.]?\s*(.+)$/im,
    /\bhal\s*[:.]?\s*(.+)$/im,
    /\btentang\s*[:.]?\s*(.+)$/im,
  ]);

  if (explicitSubject) {
    return explicitSubject.slice(0, 180);
  }

  const sentence = text
    .split(/[.!?\n]/)
    .map((item) => normalizeWhitespace(item))
    .find((item) => item.length > 24);

  return sentence ?? "Ringkasan surat hasil deteksi AI";
}

function sanitizeOriginCandidate(value: string) {
  return toReadableCase(
    value
      .replace(/^(asal surat|pengirim|dari|instansi|kepada)\s*[:.-]?\s*/i, "")
      .replace(/\b(?:nomor|no\.?)\b.*$/i, "")
  );
}

function inferOrigin(text: string) {
  const lines = getUsefulLines(text);
  const windows = lines.flatMap((line, index) => {
    const next = lines[index + 1];
    return [line, next ? `${line} ${next}` : line];
  });

  const prioritized = [
    ...windows.slice(0, 24),
    ...windows.slice(24),
  ];

  const originPatterns = [
    /(pengadilan tinggi agama [a-z][a-z\s.-]+)/i,
    /(pengadilan agama [a-z][a-z\s.-]+)/i,
    /(pengadilan negeri [a-z][a-z\s.-]+)/i,
    /(mahkamah agung(?: republik indonesia)?)/i,
    /(badan peradilan agama)/i,
    /(badan urusan administrasi(?: ma ri| mahkamah agung)?)/i,
    /(sekretariat daerah [a-z][a-z\s.-]+)/i,
    /(pemerintah (?:desa|kabupaten|kota|provinsi) [a-z][a-z\s.-]+)/i,
    /(dinas [a-z][a-z\s.-]+)/i,
    /(kementerian [a-z][a-z\s.-]+)/i,
    /(kejaksaan [a-z][a-z\s.-]+)/i,
    /(kepolisian [a-z][a-z\s.-]+)/i,
  ];

  for (const candidate of prioritized) {
    for (const pattern of originPatterns) {
      const match = candidate.match(pattern);
      if (!match) continue;

      const normalized = sanitizeOriginCandidate(match[1] ?? match[0]);
      if (normalized.length >= 6) {
        return normalized;
      }
    }
  }

  const labeledOrigin = pickFirstMatch(text, [
    /\basal surat\s*[:.]?\s*(.+)$/im,
    /\bpengirim\s*[:.]?\s*(.+)$/im,
    /\bdari\s*[:.]?\s*(.+)$/im,
  ]);
  if (labeledOrigin) {
    return sanitizeOriginCandidate(labeledOrigin);
  }

  return "Instansi pengirim terdeteksi dari dokumen";
}

function inferSender(text: string) {
  return inferOrigin(text);
}

function inferTags(text: string, subject: string, origin: string, regulations: ReturnType<typeof contextualSearchRegulations>) {
  const normalized = `${subject} ${text} ${origin}`.toLowerCase();
  const suggested = [
    /putusan|penetapan|berkas perkara/i.test(normalized) ? "Perkara" : null,
    /audit/i.test(normalized) ? "Audit" : null,
    /keamanan|enkripsi|backup|server/i.test(normalized) ? "Keamanan" : null,
    /sarpras|inventaris/i.test(normalized) ? "Sarpras" : null,
    /laporan|triwulan/i.test(normalized) ? "Laporan" : null,
    /prioritas|urgent|segera/i.test(normalized) ? "Prioritas" : null,
    ...regulations.slice(0, 2).map((item) => item.jurisdiction),
  ].filter(Boolean) as string[];

  return Array.from(new Set(suggested)).slice(0, 6);
}

function inferConfidentiality(text: string) {
  if (/rahasia|sangat rahasia|sensitif/i.test(text)) return "Rahasia" as const;
  if (/prioritas|segera|urgent|pimpinan|penting/i.test(text)) return "Penting" as const;
  return "Biasa" as const;
}

function inferClassification(text: string, subject: string, origin: string) {
  const composite = [subject, origin, text].filter(Boolean).join("\n");
  const classificationMatch = inferLetterClassificationFromText(composite);

  return normalizeLetterClassificationDraft({
    kodeKlasifikasi: classificationMatch?.code ?? "",
    klasifikasi: classificationMatch?.title ?? "",
    klasifikasiTags: classificationMatch
      ? [
          classificationMatch.label,
          classificationMatch.category,
          ...classificationMatch.keywordHits,
        ]
      : [],
  });
}

export async function generateLetterDraftFromPdf({
  type,
  extractedText,
  aiConfig,
  suggestedUsers,
}: {
  type: LetterType;
  extractedText: string;
  aiConfig: AIGlobalConfig;
  suggestedUsers: UserPersona[];
}): Promise<GeneratedLetterDraft> {
  const regulations = contextualSearchRegulations({
    moduleId: "manajemen-surat",
    entityType: "surat-draft",
    title: extractedText.slice(0, 120),
    content: extractedText,
    tags: ["surat", type, aiConfig.providerId, aiConfig.modelId],
  });
  const subject = inferSubject(extractedText);
  const origin = inferOrigin(extractedText);
  const sender = inferSender(extractedText);
  const letterNumber = inferLetterNumber(extractedText);
  const inferredDates = inferDocumentDates(extractedText, type);
  const normalizedClassification = inferClassification(extractedText, subject, origin);
  const tags = inferTags(extractedText, subject, origin, regulations);
  const confidentiality = inferConfidentiality(extractedText);
  const summary = normalizeWhitespace(extractedText).slice(0, 480);
  const primaryTargetUser = suggestedUsers[0] ?? null;
  const reviewNotes = [
    inferredDates.tanggalSurat
      ? `Tanggal surat terdeteksi ${inferredDates.tanggalSurat}.`
      : "Tanggal surat belum terdeteksi kuat; verifikasi manual.",
    inferredDates.tanggalAdministratif
      ? `${type === "masuk" ? "Tanggal terima" : "Tanggal kirim"} terdeteksi ${inferredDates.tanggalAdministratif}.`
      : `${type === "masuk" ? "Tanggal terima" : "Tanggal kirim"} belum ditemukan kuat; pertahankan nilai administrasi manual bila perlu.`,
    normalizedClassification.kodeKlasifikasi
      ? `Klasifikasi terpetakan ke ${normalizedClassification.kodeKlasifikasi}.`
      : "Kode klasifikasi belum cukup kuat untuk diisi otomatis.",
  ];

  return {
    nomorSurat:
      letterNumber || `AI/${new Date().getFullYear()}/${String(new Date().getTime()).slice(-4)}`,
    nomorUrut: String(new Date().getDate()).padStart(3, "0"),
    tanggalSurat: inferredDates.tanggalSurat,
    tanggalAdministratif: inferredDates.tanggalAdministratif,
    pengirim: sender,
    perihal: subject,
    assignedUnit: "Kesekretariatan",
    confidentiality,
    asalSurat: origin,
    tujuanSurat: primaryTargetUser?.name ?? "Pimpinan terkait",
    kodeKlasifikasi: normalizedClassification.kodeKlasifikasi,
    klasifikasi: normalizedClassification.klasifikasi,
    klasifikasiTags: normalizedClassification.klasifikasiTags,
    ringkasan: summary || "Ringkasan hasil deteksi AI belum cukup spesifik. Mohon tinjau manual sebelum menyimpan.",
    tags,
    lampiran: [],
    suggestedTargetUserId: primaryTargetUser?.id ?? "",
    suggestedTargetPositionId: primaryTargetUser?.actingAssignment?.positionId ?? primaryTargetUser?.positionId ?? "",
    aiReviewNote: reviewNotes.join(" "),
  };
}

export async function generateDispositionAssist({
  letterSubject,
  letterSummary,
  currentInstruction,
  targetOptions,
}: {
  letterSubject: string;
  letterSummary: string;
  currentInstruction: string;
  targetOptions: { id: string; label: string }[];
}) {
  const compactSummary = letterSummary.replace(/\s+/g, " ").slice(0, 180);
  const primaryTarget = targetOptions[0]?.label ?? "pejabat terkait";

  return new Promise<{ summary: string; suggestedInstruction: string; suggestedTargetLabel: string }>((resolve) => {
    globalThis.setTimeout(() => {
      resolve({
        summary: compactSummary || letterSubject,
        suggestedInstruction:
          currentInstruction.trim() ||
          `Telaah singkat surat "${letterSubject}", tetapkan PIC pada ${primaryTarget}, dan laporkan progres inti secara ringkas.`,
        suggestedTargetLabel: primaryTarget,
      });
    }, 120);
  });
}
