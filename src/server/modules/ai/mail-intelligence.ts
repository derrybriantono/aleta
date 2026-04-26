import {
  type AIGlobalConfig,
  type AIProviderConfig,
  type DispositionNode,
  type KnowledgeBaseEntry,
  type LetterDetail,
  type MailIntelligenceConfidenceLevel,
  type MailIntelligenceFollowUp,
  type MailIntelligencePayload,
  type MailIntelligencePriorityLevel,
  type MailIntelligenceProviderMeta,
  type MailIntelligenceSource,
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

const ALLOWED_PRIORITIES: MailIntelligencePriorityLevel[] = ["low", "medium", "high", "urgent"];

function clampConfidenceScore(value: unknown, fallback: number) {
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value <= 1 && value >= 0) return value;
    if (value > 1 && value <= 100) return value / 100;
  }
  return fallback;
}

function confidenceLevelFromScore(score: number): MailIntelligenceConfidenceLevel {
  if (score >= 0.75) return "high";
  if (score >= 0.45) return "medium";
  return "low";
}

function confidenceLabel(level: MailIntelligenceConfidenceLevel) {
  if (level === "high") return "Tingkat keyakinan tinggi";
  if (level === "medium") return "Tingkat keyakinan sedang";
  return "Tingkat keyakinan rendah";
}

function normalizePriority(value: unknown, fallback: MailIntelligencePriorityLevel): MailIntelligencePriorityLevel {
  if (typeof value !== "string") return fallback;
  const normalized = value.toLowerCase().trim();
  if (ALLOWED_PRIORITIES.includes(normalized as MailIntelligencePriorityLevel)) {
    return normalized as MailIntelligencePriorityLevel;
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

function sanitizeFollowUps(value: unknown, limit: number): MailIntelligenceFollowUp[] {
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
        } satisfies MailIntelligenceFollowUp;
      }
      if (raw && typeof raw === "object") {
        const candidate = raw as Partial<MailIntelligenceFollowUp>;
        const detail = (candidate.detail ?? candidate.label ?? "").toString().trim();
        const label = (candidate.label ?? candidate.detail ?? "").toString().trim();
        if (!detail && !label) return null;
        return {
          id: `ai-${index + 1}`,
          label: label || (detail.length > 80 ? `${detail.slice(0, 77)}...` : detail),
          detail: detail || label,
        } satisfies MailIntelligenceFollowUp;
      }
      return null;
    })
    .filter((item): item is MailIntelligenceFollowUp => item !== null)
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
): MailIntelligenceProviderMeta {
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
  timeline: DispositionNode[]
): { level: MailIntelligencePriorityLevel; reason: string } {
  const urgentFromTimeline = timeline.some((node) => node.urgent || node.bypass);
  const confidentialityRank = letter.confidentiality === "Rahasia" ? 2 : letter.confidentiality === "Penting" ? 1 : 0;
  const urgentKeywords = ["segera", "mendesak", "penting", "urgent", "asap", "prioritas"];
  const haystack = `${letter.perihal} ${letter.ringkasan}`.toLowerCase();
  const keywordHit = urgentKeywords.some((keyword) => haystack.includes(keyword));

  if (urgentFromTimeline && confidentialityRank >= 1) {
    return {
      level: "urgent",
      reason: `Terdapat disposisi ditandai urgent/bypass dan surat berklasifikasi ${letter.confidentiality}.`,
    };
  }

  if (confidentialityRank === 2 || keywordHit) {
    return {
      level: "high",
      reason: confidentialityRank === 2
        ? "Surat bersifat rahasia sehingga harus ditangani di jalur terbatas."
        : "Ada kata kunci prioritas pada perihal atau ringkasan surat.",
    };
  }

  if (confidentialityRank === 1) {
    return {
      level: "medium",
      reason: "Surat berlabel Penting, pastikan ditindaklanjuti sesuai jadwal internal.",
    };
  }

  return {
    level: "low",
    reason: "Tidak ada indikator prioritas khusus dari klasifikasi atau disposisi.",
  };
}

function buildHeuristicFindings(letter: LetterDetail, timeline: DispositionNode[]) {
  const findings: string[] = [];
  if (letter.ringkasan.trim()) {
    const compact = letter.ringkasan.replace(/\s+/g, " ").trim();
    findings.push(compact.length > 220 ? `${compact.slice(0, 217)}...` : compact);
  }
  findings.push(`Asal surat: ${letter.asalSurat || "(tidak tercantum)"}`);
  findings.push(`Klasifikasi: ${letter.klasifikasi || "(tidak tercantum)"} / Sifat: ${letter.confidentiality}`);
  if (letter.tags.length > 0) {
    findings.push(`Tag kontekstual: ${letter.tags.join(", ")}`);
  }
  if (timeline.length > 0) {
    findings.push(
      `Alur disposisi: ${timeline.length} tahap tercatat, status terakhir "${timeline[timeline.length - 1].status}".`
    );
  }
  return findings.slice(0, 5);
}

function buildHeuristicFollowUps(
  letter: LetterDetail,
  regulations: KnowledgeBaseEntry[]
): MailIntelligenceFollowUp[] {
  const suggestions: MailIntelligenceFollowUp[] = [];
  suggestions.push({
    id: "follow-up-telaah",
    label: "Telaah substansi surat",
    detail:
      letter.type === "masuk"
        ? `Baca ulang ringkasan dan lampiran (${letter.lampiran.length}), lalu tentukan PIC pada unit ${letter.assignedUnit}.`
        : `Pastikan tujuan surat (${letter.tujuanSurat}) sudah benar sebelum distribusi akhir.`,
  });
  suggestions.push({
    id: "follow-up-pic",
    label: "Tetapkan PIC dan target waktu",
    detail: `Unit yang diarahkan: ${letter.assignedUnit}. Minta laporan tindak lanjut tertulis dengan tenggat konkret.`,
  });
  if (regulations.length > 0) {
    suggestions.push({
      id: "follow-up-regulasi",
      label: "Kaitkan ke regulasi rujukan",
      detail: `Gunakan ${regulations
        .slice(0, 2)
        .map((entry) => entry.citation)
        .join(", ")} sebagai dasar pertimbangan sebelum memutuskan.`,
    });
  }
  return suggestions;
}

function buildVerificationChecklist(letter: LetterDetail) {
  const checklist: string[] = [];
  checklist.push(`Verifikasi nomor surat "${letter.nomorSurat}" dan tanggal "${letter.tanggal}" dengan naskah asli.`);
  checklist.push(`Konfirmasi asal surat "${letter.asalSurat || "-"}" dan pengirim "${letter.pengirim || "-"}" tidak tertukar.`);
  if (letter.lampiran.length > 0) {
    checklist.push(`Pastikan ${letter.lampiran.length} lampiran tersedia dan sesuai pencatatan.`);
  } else {
    checklist.push("Pastikan tidak ada lampiran yang terlewat sebelum menyelesaikan disposisi.");
  }
  checklist.push("Cross-check klasifikasi surat dengan pedoman klasifikasi sebelum arsip akhir.");
  checklist.push("AI dapat salah, wajib verifikasi manual sebelum mengambil keputusan akhir.");
  return checklist;
}

function buildRegulationHint(regulations: KnowledgeBaseEntry[]) {
  if (regulations.length === 0) {
    return "Tidak ada regulasi lokal yang cukup relevan; AI berkonsentrasi pada data surat yang tersedia.";
  }
  return `Regulasi pendukung yang relevan dari knowledge base internal: ${regulations
    .map((entry) => `${entry.title} (${entry.citation})`)
    .join("; ")}.`;
}

function buildHeuristicPayload(input: {
  letter: LetterDetail;
  timeline: DispositionNode[];
  aiConfig: AIGlobalConfig;
  provider: AIProviderConfig | null;
  regulations: KnowledgeBaseEntry[];
  source: MailIntelligenceSource;
  providerMeta: MailIntelligenceProviderMeta;
  message: string | null;
  confidenceScore: number;
}): MailIntelligencePayload {
  const { letter, timeline, regulations, source, providerMeta, message, confidenceScore } = input;
  const priority = computeHeuristicPriority(letter, timeline);
  const keyFindings = buildHeuristicFindings(letter, timeline);
  const followUpSuggestions = buildHeuristicFollowUps(letter, regulations);
  const suggestedPositionIds = Array.from(
    new Set(regulations.flatMap((entry) => entry.recommendedPositionIds ?? []))
  ).slice(0, 4);
  const suggestedPositionLabels = suggestedPositionIds.map(
    (positionId) => getPosition(positionId)?.name ?? positionId
  );
  const clampedScore = Math.min(0.6, Math.max(0.2, confidenceScore));
  const level = confidenceLevelFromScore(clampedScore);

  const summaryBase = letter.ringkasan.trim()
    ? letter.ringkasan.replace(/\s+/g, " ").trim()
    : letter.perihal.trim() || "Tidak ada ringkasan pada data surat.";
  const summary = summaryBase.length > 340 ? `${summaryBase.slice(0, 337)}...` : summaryBase;

  return {
    source,
    provider: providerMeta,
    summary,
    keyFindings,
    priority,
    followUpSuggestions,
    regulations,
    suggestedPositionIds,
    suggestedPositionLabels,
    verificationChecklist: buildVerificationChecklist(letter),
    confidence: {
      score: clampedScore,
      level,
      label: confidenceLabel(level),
    },
    rationale:
      source === "disabled"
        ? "Fitur AI sedang dimatikan dari Pengaturan AI. Ringkasan di bawah memakai data surat apa adanya tanpa analisis AI."
        : source === "error"
          ? "Panggilan ke provider AI gagal. ALETA mengembalikan ringkasan berbasis data surat sebagai fallback, bukan hasil analisis AI."
          : `Analisis AI live belum tersedia untuk koneksi ini. ${buildRegulationHint(regulations)}`,
    message,
    generatedAt: new Date().toISOString(),
  };
}

type LiveMailAnalysis = {
  summary?: string;
  keyFindings?: unknown;
  priority?: { level?: string; reason?: string } | string;
  priorityReason?: string;
  followUpSuggestions?: unknown;
  suggestedPositionIds?: unknown;
  verificationChecklist?: unknown;
  confidence?: number | { score?: number };
  rationale?: string;
};

function applyMailFeatureFlags(
  payload: MailIntelligencePayload,
  aiConfig: AIGlobalConfig
): MailIntelligencePayload {
  const flags = normalizeAIFeatureFlags(aiConfig.featureFlags).mailIntelligence;
  const hiddenText = "Subfitur ini sedang dinonaktifkan oleh administrator.";

  return {
    ...payload,
    summary: flags.summary ? payload.summary : "",
    keyFindings: flags.findings ? payload.keyFindings : [],
    priority: flags.riskNotes ? payload.priority : { level: "low", reason: hiddenText },
    followUpSuggestions: flags.recommendedActions ? payload.followUpSuggestions : [],
    regulations: flags.relatedRegulations ? payload.regulations : [],
    suggestedPositionIds: flags.recommendedActions ? payload.suggestedPositionIds : [],
    suggestedPositionLabels: flags.recommendedActions ? payload.suggestedPositionLabels : [],
    confidence: flags.diagnostics
      ? payload.confidence
      : {
          score: 0,
          level: "low",
          label: "Diagnostic AI dinonaktifkan",
        },
    rationale: flags.diagnostics ? payload.rationale : "",
  };
}

function buildAnalysisUserPrompt(
  letter: LetterDetail,
  timeline: DispositionNode[],
  regulations: KnowledgeBaseEntry[],
  validPositionIds: string[]
) {
  const timelineSummary = timeline.map((node) => ({
    status: node.status,
    instruksi: node.instruksi,
    urgent: node.urgent,
    bypass: node.bypass,
    createdAt: node.createdAt,
  }));

  return [
    "Tugas: analisis surat kedinasan ALETA untuk pegawai yang akan mendisposisi atau menindaklanjuti.",
    "Balas HANYA dalam bentuk JSON sesuai skema. Jangan menambah markdown atau penjelasan di luar JSON.",
    "Gunakan bahasa Indonesia resmi, ringkas, dan faktual. Jangan mengarang nomor, tanggal, nama, atau instansi di luar data yang diberikan.",
    "Jika data tidak cukup, kembalikan string kosong atau array kosong untuk field terkait. Jangan menebak.",
    "",
    "Skema keluaran JSON:",
    "{",
    '  "summary": string,                  // 2-4 kalimat, tanpa mengulang header surat secara mentah',
    '  "keyFindings": string[],             // maks 5 item, tiap item satu poin konkret dari isi/metadata surat',
    '  "priority": { "level": "low" | "medium" | "high" | "urgent", "reason": string },',
    '  "followUpSuggestions": Array<{ "label": string, "detail": string }>, // maks 4 langkah lanjutan',
    '  "suggestedPositionIds": string[],    // hanya ID dari daftar positionIdsCandidates jika ada. Kosongkan jika ragu.',
    '  "verificationChecklist": string[],   // hal konkret yang wajib diverifikasi manusia (nomor, tanggal, lampiran)',
    '  "confidence": number,                // 0.0 sampai 1.0, refleksi keyakinan terhadap analisis sendiri',
    '  "rationale": string                   // 1-2 kalimat dasar analisis, sebut jika data kurang',
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
    "Linimasa disposisi (boleh kosong):",
    stringifyJson(timelineSummary),
    "",
    "Regulasi lokal yang paling relevan (hanya referensi, bisa dipakai di rationale):",
    stringifyJson(
      regulations.map((entry) => ({
        id: entry.id,
        title: entry.title,
        citation: entry.citation,
        summary: entry.summary,
      }))
    ),
    "",
    "positionIdsCandidates (whitelist untuk suggestedPositionIds):",
    stringifyJson(validPositionIds),
  ].join("\n");
}

export async function generateMailIntelligenceInsight(
  db: AletaDatabase,
  {
    letter,
    timeline,
    aiConfig,
  }: {
    letter: LetterDetail;
    timeline: DispositionNode[];
    aiConfig: AIGlobalConfig;
  }
): Promise<MailIntelligencePayload> {
  const activeProvider = resolveActiveProvider(aiConfig);
  const regulations = await searchRegulationsInDb(db, {
    moduleId: "manajemen-surat",
    entityType: "surat",
    title: letter.perihal,
    content: [letter.ringkasan, letter.asalSurat, letter.klasifikasi, letter.tujuanSurat]
      .filter(Boolean)
      .join(". "),
    tags: [...letter.tags, letter.confidentiality, letter.assignedUnit],
    metadata: {
      classification: letter.klasifikasi,
      sender: letter.pengirim,
      currentStatus: letter.status,
    },
  });

  if (!aiConfig.enabled) {
    return applyMailFeatureFlags(buildHeuristicPayload({
      letter,
      timeline,
      aiConfig,
      provider: activeProvider,
      regulations,
      source: "disabled",
      providerMeta: buildProviderMeta(aiConfig, activeProvider, { isLive: false }),
      message:
        "ALETA Intelligence sedang dimatikan oleh Super Admin. Aktifkan terlebih dahulu di menu Pengaturan AI untuk mendapatkan analisis AI nyata.",
      confidenceScore: 0.2,
    }), aiConfig);
  }

  const activeProviderId = activeProvider?.providerId ?? activeProvider?.id ?? aiConfig.providerId;
  const providerSupportsLive = activeProvider ? isProviderLiveSupported(activeProviderId) : false;
  const hasApiKey = Boolean(activeProvider?.apiKey?.trim());

  if (!activeProvider || !providerSupportsLive || !hasApiKey) {
    return applyMailFeatureFlags(buildHeuristicPayload({
      letter,
      timeline,
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

  const validPositionIds = Array.from(
    new Set(regulations.flatMap((entry) => entry.recommendedPositionIds ?? []))
  );
  const heuristicFallback = buildHeuristicPayload({
    letter,
    timeline,
    aiConfig,
    provider: activeProvider,
    regulations,
    source: "heuristic",
    providerMeta: buildProviderMeta(aiConfig, activeProvider, { isLive: false }),
    message: "Fallback heuristik disiapkan jika provider AI gagal menjawab.",
    confidenceScore: 0.35,
  });

  const liveResult = await requestStructuredDataFromProvider<LiveMailAnalysis>({
    providerId: activeProviderId,
    endpointUrl: activeProvider.endpointUrl ?? null,
    apiKey: activeProvider.apiKey,
    modelId: activeProvider.modelId ?? aiConfig.modelId,
    fallback: {
      summary: heuristicFallback.summary,
      keyFindings: heuristicFallback.keyFindings,
      priority: heuristicFallback.priority,
      followUpSuggestions: heuristicFallback.followUpSuggestions.map((item) => ({
        label: item.label,
        detail: item.detail,
      })),
      suggestedPositionIds: heuristicFallback.suggestedPositionIds,
      verificationChecklist: heuristicFallback.verificationChecklist,
      confidence: heuristicFallback.confidence.score,
      rationale: heuristicFallback.rationale,
    },
    systemPrompt: [
      "Anda adalah ALETA Intelligence Service, asisten tata persuratan kedinasan di lingkungan peradilan.",
      "Tujuan Anda: membantu petugas memahami surat dan memberi saran tindak lanjut.",
      "Aturan keras:",
      "1. JANGAN mengarang data (nomor surat, tanggal, nama pihak, klasifikasi, regulasi) yang tidak ada di data masukan.",
      "2. Jika data kurang, cukup kembalikan string kosong / array kosong pada field bersangkutan.",
      "3. Confidence harus merefleksikan keyakinan nyata; turunkan bila data ringkasan/metadata kurang lengkap.",
      "4. Seluruh output dalam Bahasa Indonesia formal. Balas HANYA JSON sesuai skema yang diminta.",
    ].join(" "),
    userPrompt: buildAnalysisUserPrompt(letter, timeline, regulations, validPositionIds),
  });

  if (!liveResult.ok) {
    return applyMailFeatureFlags({
      ...heuristicFallback,
      source: "error",
      provider: buildProviderMeta(aiConfig, activeProvider, {
        isLive: false,
        providerModelId: liveResult.providerModelId,
      }),
      rationale:
        "Permintaan ke provider AI gagal diproses sehingga ALETA memakai ringkasan berbasis data surat sebagai fallback. Hasil ini bukan analisis AI live.",
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

  const providedPositionIds = Array.isArray(live.suggestedPositionIds)
    ? live.suggestedPositionIds
        .filter((id): id is string => typeof id === "string")
        .filter((id) => validPositionIds.includes(id))
    : [];
  const suggestedPositionIds = providedPositionIds.length > 0
    ? Array.from(new Set(providedPositionIds)).slice(0, 4)
    : heuristicFallback.suggestedPositionIds;
  const suggestedPositionLabels = suggestedPositionIds.map(
    (positionId) => getPosition(positionId)?.name ?? positionId
  );

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
    "AI dapat salah, wajib verifikasi manual sebelum mengambil keputusan akhir.";

  const verificationChecklist = liveVerification.length > 0
    ? Array.from(new Set([...liveVerification, manualVerificationTip])).slice(0, 6)
    : heuristicFallback.verificationChecklist;

  return applyMailFeatureFlags({
    source: "ai-live",
    provider: providerMeta,
    summary: summaryText || heuristicFallback.summary,
    keyFindings: liveKeyFindings.length > 0 ? liveKeyFindings : heuristicFallback.keyFindings,
    priority: { level: priorityLevel, reason: priorityReason },
    followUpSuggestions: liveFollowUps.length > 0 ? liveFollowUps : heuristicFallback.followUpSuggestions,
    regulations,
    suggestedPositionIds,
    suggestedPositionLabels,
    verificationChecklist,
    confidence: {
      score: confidenceScore,
      level,
      label: confidenceLabel(level),
    },
    rationale:
      rationaleText ||
      `Analisis disusun oleh ${providerMeta.providerName} (${providerMeta.providerModelId}) menggunakan data surat dan regulasi lokal yang relevan.`,
    message: null,
    generatedAt: new Date().toISOString(),
  }, aiConfig);
}
