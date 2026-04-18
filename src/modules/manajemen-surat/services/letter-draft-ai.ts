import { contextualSearchRegulations } from "@/core/intelligence/aleta-intelligence-service";
import {
  inferLetterClassificationFromText,
  normalizeLetterClassificationDraft,
} from "@/lib/letter-taxonomy";
import { type AIGlobalConfig, type LetterType, type UserPersona } from "@/lib/types";

function inferSubject(text: string) {
  const sentence = text
    .split(/[.!?\n]/)
    .map((item) => item.trim())
    .find((item) => item.length > 24);

  return sentence ?? "Ringkasan surat hasil deteksi AI";
}

function inferSender(text: string) {
  const senderLine = text
    .split(/\n/)
    .map((item) => item.trim())
    .find((item) => /(pengadilan|mahkamah|badan|sekretariat|pta|badilag|bua)/i.test(item));

  return senderLine ?? "Instansi pengirim terdeteksi dari dokumen";
}

function inferTags(text: string, regulations: ReturnType<typeof contextualSearchRegulations>) {
  const suggested = [
    /audit/i.test(text) ? "Audit" : null,
    /keamanan|enkripsi|backup/i.test(text) ? "Keamanan" : null,
    /sarpras|inventaris/i.test(text) ? "Sarpras" : null,
    /laporan|triwulan/i.test(text) ? "Laporan" : null,
    /prioritas|urgent/i.test(text) ? "Prioritas" : null,
    ...regulations.slice(0, 2).map((item) => item.jurisdiction),
  ].filter(Boolean) as string[];

  return Array.from(new Set(suggested)).slice(0, 4);
}

function inferConfidentiality(text: string) {
  if (/rahasia|audit keamanan|sensitif/i.test(text)) return "Rahasia" as const;
  if (/prioritas|segera|urgent|pimpinan/i.test(text)) return "Penting" as const;
  return "Biasa" as const;
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
}) {
  const regulations = contextualSearchRegulations({
    moduleId: "manajemen-surat",
    entityType: "surat-draft",
    title: extractedText.slice(0, 120),
    content: extractedText,
    tags: ["surat", type, aiConfig.providerId, aiConfig.modelId],
  });
  const subject = inferSubject(extractedText);
  const classificationMatch = inferLetterClassificationFromText(extractedText);
  const normalizedClassification = normalizeLetterClassificationDraft({
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
  const tags = inferTags(extractedText, regulations);
  const confidentiality = inferConfidentiality(extractedText);
  const summary = extractedText.replace(/\s+/g, " ").slice(0, 480);
  const primaryTargetUser = suggestedUsers[0] ?? null;

  return {
    nomorSurat: `AI/${new Date().getFullYear()}/${String(new Date().getTime()).slice(-4)}`,
    nomorUrut: String(new Date().getDate()).padStart(3, "0"),
    pengirim: inferSender(extractedText),
    perihal: subject,
    assignedUnit: type === "masuk" ? "Kesekretariatan" : "Kesekretariatan",
    confidentiality,
    asalSurat: inferSender(extractedText),
    tujuanSurat: primaryTargetUser?.name ?? "Pimpinan terkait",
    kodeKlasifikasi: normalizedClassification.kodeKlasifikasi,
    klasifikasi: normalizedClassification.klasifikasi,
    klasifikasiTags: normalizedClassification.klasifikasiTags,
    ringkasan: summary || "Ringkasan hasil deteksi AI belum cukup spesifik. Mohon tinjau manual sebelum menyimpan.",
    tags,
    lampiran: [],
    suggestedTargetUserId: primaryTargetUser?.id ?? "",
    suggestedTargetPositionId: primaryTargetUser?.actingAssignment?.positionId ?? primaryTargetUser?.positionId ?? "",
    aiReviewNote:
      "Deteksi AI hanya menghasilkan draft awal. Mohon verifikasi nomor, klasifikasi, tujuan jabatan, dan ringkasan sebelum menyimpan.",
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
