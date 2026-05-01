import {
  type AIGlobalConfig,
  type AIProviderConfig,
  type DispositionNode,
  type DispositionSuggestionAutofill,
  type DispositionSuggestionConfidenceLevel,
  type DispositionSuggestionFollowUp,
  type DispositionSuggestionPayload,
  type DispositionSuggestionPriorityLevel,
  type DispositionSuggestionProviderMeta,
  type DispositionSuggestionSource,
  type KnowledgeBaseEntry,
  type LetterDetail,
} from "@/lib/types";
import { getPosition } from "@/lib/permissions";
import { getAIProviderById } from "@/lib/ai-catalog";
import { normalizeAIFeatureFlags } from "@/lib/ai-feature-flags";
import {
  isProviderLiveSupported,
  requestStructuredDataFromProvider,
} from "@/server/modules/ai/provider-client";
import { searchRegulationsInDb } from "@/server/modules/ai/knowledge-base";
import { type AletaDatabase } from "@/server/db/client";
import { stringifyJson } from "@/server/shared/json";

const ALLOWED_PRIORITIES: DispositionSuggestionPriorityLevel[] = ["low", "medium", "high", "urgent"];

function clampConfidenceScore(value: unknown, fallback: number) {
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value <= 1 && value >= 0) return value;
    if (value > 1 && value <= 100) return value / 100;
  }
  return fallback;
}

function confidenceLevelFromScore(score: number): DispositionSuggestionConfidenceLevel {
  if (score >= 0.75) return "high";
  if (score >= 0.45) return "medium";
  return "low";
}

function confidenceLabel(level: DispositionSuggestionConfidenceLevel) {
  if (level === "high") return "Tingkat keyakinan tinggi";
  if (level === "medium") return "Tingkat keyakinan sedang";
  return "Tingkat keyakinan rendah";
}

function normalizePriority(
  value: unknown,
  fallback: DispositionSuggestionPriorityLevel
): DispositionSuggestionPriorityLevel {
  if (typeof value !== "string") return fallback;
  const normalized = value.toLowerCase().trim();
  if (ALLOWED_PRIORITIES.includes(normalized as DispositionSuggestionPriorityLevel)) {
    return normalized as DispositionSuggestionPriorityLevel;
  }
  if (["mendesak", "darurat", "segera"].some((keyword) => normalized.includes(keyword))) return "urgent";
  if (["tinggi", "high", "prioritas"].some((keyword) => normalized.includes(keyword))) return "high";
  if (["sedang", "medium"].some((keyword) => normalized.includes(keyword))) return "medium";
  if (["rendah", "low", "biasa"].some((keyword) => normalized.includes(keyword))) return "low";
  return fallback;
}

function sanitizeStringArray(value: unknown, limit: number) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0)
    .slice(0, limit);
}

function sanitizeFollowUps(value: unknown, limit: number): DispositionSuggestionFollowUp[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((raw, index) => {
      if (typeof raw === "string") {
        const text = raw.trim();
        if (!text) return null;
        return {
          id: `ai-${index + 1}`,
          label: text.length > 80 ? `${text.slice(0, 77)}...` : text,
          detail: text,
        } satisfies DispositionSuggestionFollowUp;
      }
      if (raw && typeof raw === "object") {
        const candidate = raw as Partial<DispositionSuggestionFollowUp>;
        const detail = (candidate.detail ?? candidate.label ?? "").toString().trim();
        const label = (candidate.label ?? candidate.detail ?? "").toString().trim();
        if (!detail && !label) return null;
        return {
          id: `ai-${index + 1}`,
          label: label || (detail.length > 80 ? `${detail.slice(0, 77)}...` : detail),
          detail: detail || label,
        } satisfies DispositionSuggestionFollowUp;
      }
      return null;
    })
    .filter((item): item is DispositionSuggestionFollowUp => item !== null)
    .slice(0, limit);
}

function resolveActiveProvider(aiConfig: AIGlobalConfig): AIProviderConfig | null {
  return (
    aiConfig.providers.find((provider) => provider.id === aiConfig.activeConnectionId) ??
    aiConfig.providers.find((provider) => provider.isActive) ??
    aiConfig.providers.find(
      (provider) =>
        provider.providerId === aiConfig.providerId &&
        provider.modelId === aiConfig.modelId
    ) ??
    aiConfig.providers.find((provider) => provider.providerId === aiConfig.providerId) ??
    null
  );
}

function buildProviderMeta(
  aiConfig: AIGlobalConfig,
  provider: AIProviderConfig | null,
  overrides: {
    isLive: boolean;
    providerModelId?: string;
  }
): DispositionSuggestionProviderMeta {
  const providerId = provider?.providerId ?? aiConfig.providerId;
  const providerName = provider?.providerName ?? getAIProviderById(providerId)?.name ?? providerId;
  const modelId = provider?.modelId ?? aiConfig.modelId;
  return {
    connectionId: provider?.id ?? aiConfig.activeConnectionId ?? null,
    providerId,
    providerName,
    modelId,
    providerModelId: overrides.providerModelId ?? modelId,
    connectionLabel: provider?.name ?? null,
    connectionStatus: provider?.connectionStatus ?? "idle",
    language: aiConfig.primaryLanguage,
    hasActiveApiKey: Boolean(provider?.apiKey?.trim()),
    isLive: overrides.isLive,
  };
}

function computeHeuristicPriority(
  letter: LetterDetail,
  timeline: DispositionNode[],
  currentInstruction: string
): { level: DispositionSuggestionPriorityLevel; reason: string } {
  const urgentFromTimeline = timeline.some((node) => node.urgent || node.bypass);
  const confidentialityRank = letter.confidentiality === "Rahasia" ? 2 : letter.confidentiality === "Penting" ? 1 : 0;
  const urgentKeywords = ["segera", "mendesak", "penting", "urgent", "asap", "prioritas"];
  const haystack = `${letter.perihal} ${letter.ringkasan} ${currentInstruction}`.toLowerCase();
  const keywordHit = urgentKeywords.some((keyword) => haystack.includes(keyword));

  if (urgentFromTimeline && confidentialityRank >= 1) {
    return {
      level: "urgent",
      reason: `Timeline disposisi mencatat urgent/bypass dan surat berklasifikasi ${letter.confidentiality}.`,
    };
  }
  if (confidentialityRank === 2 || keywordHit) {
    return {
      level: "high",
      reason:
        confidentialityRank === 2
          ? "Surat rahasia; disposisi wajib jalur terbatas dan segera."
          : "Ada kata kunci prioritas pada perihal, ringkasan, atau instruksi saat ini.",
    };
  }
  if (confidentialityRank === 1) {
    return {
      level: "medium",
      reason: "Surat berlabel Penting, disposisi perlu dipantau sesuai jadwal internal.",
    };
  }
  return {
    level: "low",
    reason: "Tidak ada indikator prioritas khusus dari klasifikasi atau timeline disposisi.",
  };
}

function pickHeuristicTargetPositionId(
  regulations: KnowledgeBaseEntry[],
  targetOptions: { id: string; label: string }[]
): string | null {
  const regPositionIds = regulations.flatMap((entry) => entry.recommendedPositionIds ?? []);
  const firstMatch = regPositionIds.find((positionId) =>
    targetOptions.some((option) => option.id === positionId)
  );
  if (firstMatch) return firstMatch;
  return targetOptions[0]?.id ?? null;
}

function buildHeuristicInstruction(
  letter: LetterDetail,
  currentInstruction: string,
  targetLabel: string
) {
  const trimmed = currentInstruction.trim();
  if (trimmed) return trimmed;
  const subject = letter.perihal.trim();
  const subjectClause = subject ? `"${subject}"` : "surat ini";
  return `Telaah ${subjectClause}, tetapkan PIC pada ${targetLabel || "pejabat terkait"}, dan laporkan progres tindak lanjut beserta tenggat konkret.`;
}

function buildHeuristicFollowUps(
  letter: LetterDetail,
  regulations: KnowledgeBaseEntry[],
  targetLabel: string
): DispositionSuggestionFollowUp[] {
  const suggestions: DispositionSuggestionFollowUp[] = [];
  suggestions.push({
    id: "follow-up-telaah",
    label: "Telaah substansi surat",
    detail: `Baca ulang ringkasan dan lampiran (${letter.lampiran.length}), identifikasi instruksi utama sebelum menetapkan PIC.`,
  });
  suggestions.push({
    id: "follow-up-pic",
    label: "Tetapkan PIC dan tenggat",
    detail: `Arahkan ke ${targetLabel || letter.assignedUnit || "unit terkait"}, minta laporan tertulis dengan tenggat yang jelas.`,
  });
  if (regulations.length > 0) {
    suggestions.push({
      id: "follow-up-regulasi",
      label: "Sertakan rujukan regulasi",
      detail: `Gunakan ${regulations
        .slice(0, 2)
        .map((entry) => entry.citation)
        .join(", ")} sebagai dasar pertimbangan pada instruksi disposisi.`,
    });
  }
  return suggestions;
}

function buildVerificationChecklist(letter: LetterDetail) {
  const checklist: string[] = [];
  checklist.push(`Pastikan target jabatan memang sesuai kewenangan untuk menindaklanjuti "${letter.perihal}".`);
  checklist.push("Periksa ulang redaksi instruksi agar jelas, terukur, dan ada batas waktu.");
  checklist.push(
    `Verifikasi ${letter.lampiran.length > 0 ? `${letter.lampiran.length} lampiran` : "ketiadaan lampiran"} sebelum disposisi dilanjutkan.`
  );
  checklist.push("Konfirmasi klasifikasi dan sifat surat agar penanganan sesuai kebijakan kerahasiaan.");
  checklist.push("AI dapat salah, wajib verifikasi manual sebelum mengirim disposisi.");
  return checklist;
}

function buildRegulationHint(regulations: KnowledgeBaseEntry[]) {
  if (regulations.length === 0) {
    return "Tidak ada regulasi lokal yang cukup relevan; saran menggunakan data surat yang tersedia saja.";
  }
  return `Regulasi rujukan yang relevan: ${regulations
    .map((entry) => `${entry.title} (${entry.citation})`)
    .join("; ")}.`;
}

function buildHeuristicPayload(input: {
  letter: LetterDetail;
  timeline: DispositionNode[];
  currentInstruction: string;
  targetOptions: { id: string; label: string }[];
  aiConfig: AIGlobalConfig;
  provider: AIProviderConfig | null;
  regulations: KnowledgeBaseEntry[];
  source: DispositionSuggestionSource;
  providerMeta: DispositionSuggestionProviderMeta;
  message: string | null;
  confidenceScore: number;
}): DispositionSuggestionPayload {
  const {
    letter,
    timeline,
    currentInstruction,
    targetOptions,
    regulations,
    source,
    providerMeta,
    message,
    confidenceScore,
  } = input;
  const priority = computeHeuristicPriority(letter, timeline, currentInstruction);
  const targetPositionId = pickHeuristicTargetPositionId(regulations, targetOptions);
  const targetLabel = targetPositionId
    ? targetOptions.find((option) => option.id === targetPositionId)?.label ??
      getPosition(targetPositionId)?.name ??
      targetPositionId
    : targetOptions[0]?.label ?? "";
  const instruction = buildHeuristicInstruction(letter, currentInstruction, targetLabel);
  const followUpSuggestions = buildHeuristicFollowUps(letter, regulations, targetLabel);
  const clampedScore = Math.min(0.6, Math.max(0.2, confidenceScore));
  const level = confidenceLevelFromScore(clampedScore);

  const compactSummary = letter.ringkasan.trim()
    ? letter.ringkasan.replace(/\s+/g, " ").trim()
    : letter.perihal.trim() || "Tidak ada ringkasan pada data surat.";
  const summary = compactSummary.length > 320 ? `${compactSummary.slice(0, 317)}...` : compactSummary;

  const keyFindings = [
    summary,
    `Klasifikasi: ${letter.klasifikasi || "(tidak tercantum)"} / Sifat: ${letter.confidentiality}`,
    targetLabel
      ? `Rekomendasi tujuan: ${targetLabel}`
      : "Belum ada target dengan jalur yang jelas pada opsi yang tersedia.",
  ];

  return {
    source,
    provider: providerMeta,
    summary,
    keyFindings,
    priority,
    suggestedInstruction: instruction,
    suggestedTargetPositionId: targetPositionId,
    suggestedTargetLabel: targetLabel,
    autofill: {
      suggestedInstruction: instruction,
      suggestedTargetPositionId: targetPositionId,
      suggestedTargetLabel: targetLabel,
      allowDownload: null,
      urgent: priority.level === "urgent" ? true : null,
    },
    followUpSuggestions,
    verificationChecklist: buildVerificationChecklist(letter),
    regulations,
    confidence: {
      score: clampedScore,
      level,
      label: confidenceLabel(level),
    },
    rationale:
      source === "disabled"
        ? "Fitur AI sedang dimatikan dari Pengaturan AI. Saran di bawah berasal dari data surat + regulasi lokal, bukan AI live."
        : source === "error"
          ? "Panggilan ke provider AI gagal. Saran di bawah berasal dari heuristik fallback, bukan hasil analisis AI live."
          : `Saran awal menggunakan heuristik lokal karena AI live belum tersedia. ${buildRegulationHint(regulations)}`,
    message,
    generatedAt: new Date().toISOString(),
  };
}

type LiveDispositionAnalysis = {
  summary?: string;
  keyFindings?: unknown;
  priority?: { level?: string; reason?: string } | string;
  priorityReason?: string;
  suggestedInstruction?: string;
  suggestedTargetPositionId?: string | null;
  suggestedTargetLabel?: string;
  autofill?: {
    suggestedInstruction?: string;
    suggestedTargetPositionId?: string | null;
    suggestedTargetLabel?: string;
    allowDownload?: boolean | null;
    urgent?: boolean | null;
  };
  followUpSuggestions?: unknown;
  verificationChecklist?: unknown;
  confidence?: number | { score?: number };
  rationale?: string;
};

function buildAnalysisUserPrompt(
  letter: LetterDetail,
  timeline: DispositionNode[],
  currentInstruction: string,
  regulations: KnowledgeBaseEntry[],
  targetOptions: { id: string; label: string }[]
) {
  const timelineSummary = timeline.map((node) => ({
    status: node.status,
    instruksi: node.instruksi,
    urgent: node.urgent,
    bypass: node.bypass,
    createdAt: node.createdAt,
  }));

  return [
    "Tugas: bantu petugas menyiapkan disposisi lanjutan pada surat kedinasan ALETA.",
    "Balas HANYA dalam bentuk JSON sesuai skema. Jangan menambah markdown atau penjelasan di luar JSON.",
    "Gunakan bahasa Indonesia resmi, ringkas, dan faktual. Jangan mengarang nomor, tanggal, nama, atau instansi di luar data yang diberikan.",
    "Jika data tidak cukup untuk sebuah field, kembalikan string kosong / null / array kosong. Jangan menebak.",
    "suggestedTargetPositionId HARUS salah satu id dari targetOptions; jika ragu kembalikan null dan kosongkan suggestedTargetLabel.",
    "",
    "Skema keluaran JSON:",
    "{",
    '  "summary": string,                     // 2-4 kalimat, fokus pada konteks disposisi',
    '  "keyFindings": string[],                // maks 5 poin konkret (latar, urgensi, PIC, dll)',
    '  "priority": { "level": "low" | "medium" | "high" | "urgent", "reason": string },',
    '  "suggestedInstruction": string,         // kalimat instruksi yang bisa langsung dipakai',
    '  "suggestedTargetPositionId": string | null,  // id dari targetOptions',
    '  "suggestedTargetLabel": string,         // label yang cocok dengan id target di atas',
    '  "autofill": {',
    '    "suggestedInstruction": string,',
    '    "suggestedTargetPositionId": string | null,',
    '    "suggestedTargetLabel": string,',
    '    "allowDownload": boolean | null,      // null jika tidak yakin',
    '    "urgent": boolean | null              // null jika tidak yakin',
    "  },",
    '  "followUpSuggestions": Array<{ "label": string, "detail": string }>, // maks 4',
    '  "verificationChecklist": string[],      // hal konkret yang wajib diperiksa manusia',
    '  "confidence": number,                    // 0.0 sampai 1.0',
    '  "rationale": string                      // 1-2 kalimat dasar penilaian',
    "}",
    "",
    "Data surat:",
    stringifyJson({
      id: letter.id,
      tipe: letter.type,
      nomorSurat: letter.nomorSurat,
      nomorUrut: letter.nomorUrut ?? "",
      tanggal: letter.tanggal,
      tanggalAdministratif: letter.tanggalAdministratif ?? "",
      perihal: letter.perihal,
      ringkasan: letter.ringkasan,
      asalSurat: letter.asalSurat,
      pengirim: letter.pengirim,
      tujuanSurat: letter.tujuanSurat,
      assignedUnit: letter.assignedUnit,
      klasifikasi: letter.klasifikasi,
      kodeKlasifikasi: letter.kodeKlasifikasi ?? "",
      klasifikasiTags: letter.klasifikasiTags ?? [],
      confidentiality: letter.confidentiality,
      tags: letter.tags,
      lampiran: letter.lampiran,
      status: letter.status,
    }),
    "",
    "Instruksi saat ini (boleh kosong) yang sedang diketik user:",
    stringifyJson(currentInstruction),
    "",
    "Linimasa disposisi sebelumnya (boleh kosong):",
    stringifyJson(timelineSummary),
    "",
    "Regulasi lokal paling relevan (boleh dikutip pada rationale):",
    stringifyJson(
      regulations.map((entry) => ({
        id: entry.id,
        title: entry.title,
        citation: entry.citation,
        summary: entry.summary,
      }))
    ),
    "",
    "targetOptions (whitelist untuk suggestedTargetPositionId dan suggestedTargetLabel):",
    stringifyJson(targetOptions),
  ].join("\n");
}

function coerceNullableBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (value === null) return null;
  if (typeof value === "string") {
    const normalized = value.toLowerCase().trim();
    if (["true", "ya", "yes", "1"].includes(normalized)) return true;
    if (["false", "tidak", "no", "0"].includes(normalized)) return false;
  }
  return null;
}

function applyDispositionFeatureFlags(
  payload: DispositionSuggestionPayload,
  aiConfig: AIGlobalConfig
): DispositionSuggestionPayload {
  const flags = normalizeAIFeatureFlags(aiConfig.featureFlags).oneStopDisposition;
  const hiddenText = "Subfitur ini sedang dinonaktifkan oleh administrator.";

  return {
    ...payload,
    summary: flags.recommendation ? payload.summary : "",
    keyFindings: flags.recommendation ? payload.keyFindings : [],
    priority: flags.priorityDetection ? payload.priority : { level: "low", reason: hiddenText },
    suggestedInstruction: flags.instructionSuggestion ? payload.suggestedInstruction : "",
    suggestedTargetPositionId: flags.targetSuggestion ? payload.suggestedTargetPositionId : null,
    suggestedTargetLabel: flags.targetSuggestion ? payload.suggestedTargetLabel : "",
    autofill: flags.autofill
      ? {
          suggestedInstruction: flags.instructionSuggestion ? payload.autofill.suggestedInstruction : "",
          suggestedTargetPositionId: flags.targetSuggestion ? payload.autofill.suggestedTargetPositionId : null,
          suggestedTargetLabel: flags.targetSuggestion ? payload.autofill.suggestedTargetLabel : "",
          allowDownload: payload.autofill.allowDownload,
          urgent: flags.priorityDetection ? payload.autofill.urgent : null,
        }
      : {
          suggestedInstruction: "",
          suggestedTargetPositionId: null,
          suggestedTargetLabel: "",
          allowDownload: null,
          urgent: null,
        },
    rationale: flags.rationale ? payload.rationale : "",
    confidence: flags.diagnostics
      ? payload.confidence
      : {
          score: 0,
          level: "low",
          label: "Diagnostic AI dinonaktifkan",
        },
  };
}

export async function generateDispositionSuggestionInsight(
  db: AletaDatabase,
  {
    letter,
    timeline,
    currentInstruction,
    targetOptions,
    aiConfig,
  }: {
    letter: LetterDetail;
    timeline: DispositionNode[];
    currentInstruction: string;
    targetOptions: { id: string; label: string }[];
    aiConfig: AIGlobalConfig;
  }
): Promise<DispositionSuggestionPayload> {
  const activeProvider = resolveActiveProvider(aiConfig);
  const regulations = await searchRegulationsInDb(db, {
    moduleId: "manajemen-surat",
    entityType: "disposisi",
    title: letter.perihal,
    content: [letter.ringkasan, currentInstruction, letter.klasifikasi]
      .filter(Boolean)
      .join(". "),
    tags: [...letter.tags, letter.confidentiality, letter.assignedUnit, "disposisi"],
    metadata: {
      targetLabels: targetOptions.map((option) => option.label),
      classification: letter.klasifikasi,
      sender: letter.pengirim,
      currentStatus: letter.status,
    },
  });

  if (!aiConfig.enabled) {
    return applyDispositionFeatureFlags(buildHeuristicPayload({
      letter,
      timeline,
      currentInstruction,
      targetOptions,
      aiConfig,
      provider: activeProvider,
      regulations,
      source: "disabled",
      providerMeta: buildProviderMeta(aiConfig, activeProvider, { isLive: false }),
      message:
        "ALETA Intelligence sedang dimatikan oleh Super Admin. Aktifkan terlebih dahulu pada Pengaturan AI untuk memakai analisis AI nyata.",
      confidenceScore: 0.2,
    }), aiConfig);
  }

  const activeProviderId = activeProvider?.providerId ?? activeProvider?.id ?? aiConfig.providerId;
  const providerSupportsLive = activeProvider ? isProviderLiveSupported(activeProviderId) : false;
  const hasApiKey = Boolean(activeProvider?.apiKey?.trim());

  if (!activeProvider || !providerSupportsLive || !hasApiKey) {
    return applyDispositionFeatureFlags(buildHeuristicPayload({
      letter,
      timeline,
      currentInstruction,
      targetOptions,
      aiConfig,
      provider: activeProvider,
      regulations,
      source: "heuristic",
      providerMeta: buildProviderMeta(aiConfig, activeProvider, { isLive: false }),
      message: !activeProvider
        ? "Tidak ada koneksi AI aktif. Tambahkan koneksi di Pengaturan AI lalu tandai sebagai aktif."
        : !providerSupportsLive
          ? `Provider "${activeProvider.providerName ?? activeProviderId}" belum didukung untuk analisis live.`
          : "API key koneksi AI aktif belum diisi. Lengkapi API key di Pengaturan AI untuk memicu analisis AI nyata.",
      confidenceScore: 0.3,
    }), aiConfig);
  }

  const heuristicFallback = buildHeuristicPayload({
    letter,
    timeline,
    currentInstruction,
    targetOptions,
    aiConfig,
    provider: activeProvider,
    regulations,
    source: "heuristic",
    providerMeta: buildProviderMeta(aiConfig, activeProvider, { isLive: false }),
    message: "Fallback heuristik disiapkan jika provider AI gagal menjawab.",
    confidenceScore: 0.35,
  });

  const liveResult = await requestStructuredDataFromProvider<LiveDispositionAnalysis>({
    providerId: activeProviderId,
    endpointUrl: activeProvider.endpointUrl ?? null,
    apiKey: activeProvider.apiKey,
    modelId: activeProvider.modelId ?? aiConfig.modelId,
    fallback: {
      summary: heuristicFallback.summary,
      keyFindings: heuristicFallback.keyFindings,
      priority: heuristicFallback.priority,
      suggestedInstruction: heuristicFallback.suggestedInstruction,
      suggestedTargetPositionId: heuristicFallback.suggestedTargetPositionId,
      suggestedTargetLabel: heuristicFallback.suggestedTargetLabel,
      autofill: heuristicFallback.autofill,
      followUpSuggestions: heuristicFallback.followUpSuggestions.map((item) => ({
        label: item.label,
        detail: item.detail,
      })),
      verificationChecklist: heuristicFallback.verificationChecklist,
      confidence: heuristicFallback.confidence.score,
      rationale: heuristicFallback.rationale,
    },
    systemPrompt: [
      "Anda adalah asisten disposisi ALETA untuk petugas tata persuratan kedinasan.",
      "Tujuan: menyarankan instruksi disposisi, target jabatan, prioritas, dan langkah tindak lanjut yang relevan.",
      "Aturan keras:",
      "1. JANGAN mengarang data (nomor surat, nama, tanggal, jabatan, regulasi) di luar data yang diberikan.",
      "2. Jika data kurang untuk field tertentu, kembalikan string kosong / null / array kosong.",
      "3. suggestedTargetPositionId HARUS dari targetOptions; jika tidak yakin kembalikan null.",
      "4. Confidence harus merefleksikan keyakinan nyata; turunkan bila data kurang lengkap.",
      "5. Seluruh output Bahasa Indonesia formal, JSON valid sesuai skema.",
    ].join(" "),
    userPrompt: buildAnalysisUserPrompt(letter, timeline, currentInstruction, regulations, targetOptions),
  });

  if (!liveResult.ok) {
    return applyDispositionFeatureFlags({
      ...heuristicFallback,
      source: "error",
      provider: buildProviderMeta(aiConfig, activeProvider, {
        isLive: false,
        providerModelId: liveResult.providerModelId,
      }),
      rationale:
        "Permintaan ke provider AI gagal diproses sehingga saran ini berasal dari fallback heuristik, bukan hasil AI live.",
      message: liveResult.message ?? "Provider AI tidak mengembalikan data yang bisa dipakai.",
    }, aiConfig);
  }

  const live = liveResult.data;
  const providerMeta = buildProviderMeta(aiConfig, activeProvider, {
    isLive: true,
    providerModelId: liveResult.providerModelId,
  });

  const liveKeyFindings = sanitizeStringArray(live.keyFindings, 5);
  const priorityPayload = typeof live.priority === "object" ? live.priority : null;
  const priorityLevel = normalizePriority(
    typeof live.priority === "string" ? live.priority : priorityPayload?.level,
    heuristicFallback.priority.level
  );
  const priorityReason =
    (typeof priorityPayload?.reason === "string" && priorityPayload.reason.trim()) ||
    (typeof live.priorityReason === "string" && live.priorityReason.trim()) ||
    heuristicFallback.priority.reason;
  const liveFollowUps = sanitizeFollowUps(live.followUpSuggestions, 5);
  const liveVerification = sanitizeStringArray(live.verificationChecklist, 6);

  const validTargetIds = targetOptions.map((option) => option.id);
  const rawTargetId =
    typeof live.suggestedTargetPositionId === "string" ? live.suggestedTargetPositionId.trim() : "";
  const suggestedTargetPositionId =
    rawTargetId && validTargetIds.includes(rawTargetId)
      ? rawTargetId
      : heuristicFallback.suggestedTargetPositionId;
  const liveTargetLabelText =
    typeof live.suggestedTargetLabel === "string" ? live.suggestedTargetLabel.trim() : "";
  const suggestedTargetLabel = suggestedTargetPositionId
    ? targetOptions.find((option) => option.id === suggestedTargetPositionId)?.label ??
      getPosition(suggestedTargetPositionId)?.name ??
      (liveTargetLabelText || heuristicFallback.suggestedTargetLabel)
    : liveTargetLabelText || heuristicFallback.suggestedTargetLabel;

  const liveInstructionText =
    typeof live.suggestedInstruction === "string" ? live.suggestedInstruction.trim() : "";
  const suggestedInstruction = liveInstructionText || heuristicFallback.suggestedInstruction;

  const liveAutofill = live.autofill ?? {};
  const autofillInstruction =
    (typeof liveAutofill.suggestedInstruction === "string" && liveAutofill.suggestedInstruction.trim()) ||
    suggestedInstruction;
  const autofillTargetRaw =
    typeof liveAutofill.suggestedTargetPositionId === "string"
      ? liveAutofill.suggestedTargetPositionId.trim()
      : "";
  const autofillTargetId =
    autofillTargetRaw && validTargetIds.includes(autofillTargetRaw)
      ? autofillTargetRaw
      : suggestedTargetPositionId;
  const liveAutofillLabelText =
    typeof liveAutofill.suggestedTargetLabel === "string" ? liveAutofill.suggestedTargetLabel.trim() : "";
  const autofillTargetLabel = autofillTargetId
    ? targetOptions.find((option) => option.id === autofillTargetId)?.label ??
      getPosition(autofillTargetId)?.name ??
      (liveAutofillLabelText || suggestedTargetLabel)
    : suggestedTargetLabel;

  const autofill: DispositionSuggestionAutofill = {
    suggestedInstruction: autofillInstruction,
    suggestedTargetPositionId: autofillTargetId,
    suggestedTargetLabel: autofillTargetLabel,
    allowDownload: coerceNullableBoolean(liveAutofill.allowDownload),
    urgent:
      coerceNullableBoolean(liveAutofill.urgent) ??
      (priorityLevel === "urgent" ? true : null),
  };

  const liveConfidenceRaw =
    typeof live.confidence === "number"
      ? live.confidence
      : typeof live.confidence === "object" && live.confidence !== null
        ? (live.confidence as { score?: number }).score
        : undefined;
  const confidenceScore = clampConfidenceScore(liveConfidenceRaw, 0.55);
  const level = confidenceLevelFromScore(confidenceScore);

  const summaryText = typeof live.summary === "string" ? live.summary.trim() : "";
  const rationaleText = typeof live.rationale === "string" ? live.rationale.trim() : "";
  const manualVerificationTip =
    "AI dapat salah, wajib verifikasi manual sebelum mengirim disposisi.";

  const verificationChecklist =
    liveVerification.length > 0
      ? Array.from(new Set([...liveVerification, manualVerificationTip])).slice(0, 6)
      : heuristicFallback.verificationChecklist;

  return applyDispositionFeatureFlags({
    source: "ai-live",
    provider: providerMeta,
    summary: summaryText || heuristicFallback.summary,
    keyFindings: liveKeyFindings.length > 0 ? liveKeyFindings : heuristicFallback.keyFindings,
    priority: { level: priorityLevel, reason: priorityReason },
    suggestedInstruction,
    suggestedTargetPositionId,
    suggestedTargetLabel,
    autofill,
    followUpSuggestions: liveFollowUps.length > 0 ? liveFollowUps : heuristicFallback.followUpSuggestions,
    verificationChecklist,
    regulations,
    confidence: {
      score: confidenceScore,
      level,
      label: confidenceLabel(level),
    },
    rationale:
      rationaleText ||
      `Saran disposisi disusun oleh ${providerMeta.providerName} (${providerMeta.providerModelId}) dari data surat, timeline, dan regulasi lokal yang relevan.`,
    message: null,
    generatedAt: new Date().toISOString(),
  }, aiConfig);
}
