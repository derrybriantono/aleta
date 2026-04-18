import { regulationsKnowledgeBase } from "@/core/knowledge/regulations-db";
import { getHybridModuleDefinition } from "@/core/platform/module-registry";
import {
  type AIGlobalConfig,
  type AIRecommendedAction,
  type AletaAIInsight,
  type KnowledgeBaseEntry,
  type UniversalAIContext,
} from "@/lib/types";

const stopWords = new Set([
  "dan",
  "yang",
  "untuk",
  "dengan",
  "atau",
  "dari",
  "pada",
  "ke",
  "di",
  "ini",
  "itu",
  "agar",
  "serta",
  "oleh",
  "the",
  "with",
  "from",
]);

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s-]/gi, " ");
}

function tokenize(value: string) {
  return normalizeText(value)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !stopWords.has(token));
}

function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}

function collectContextTokens(context: UniversalAIContext) {
  const metadataTokens = Object.values(context.metadata ?? {})
    .flatMap((value) => (Array.isArray(value) ? value : typeof value === "string" ? [value] : []))
    .flatMap((value) => tokenize(String(value)));

  return unique([
    ...tokenize(context.title),
    ...tokenize(context.content),
    ...(context.tags ?? []).flatMap((tag) => tokenize(tag)),
    ...metadataTokens,
  ]);
}

export function contextualSearchRegulations(context: UniversalAIContext, limit = 4) {
  const tokens = collectContextTokens(context);

  return regulationsKnowledgeBase
    .map((entry) => {
      const keywordScore = entry.keywords.reduce(
        (score, keyword) => score + tokens.filter((token) => normalizeText(keyword).includes(token)).length,
        0
      );
      const moduleScore = entry.moduleIds.includes(context.moduleId) ? 3 : 0;
      const titleScore = tokens.filter((token) => normalizeText(entry.title).includes(token)).length * 2;

      return { entry, score: keywordScore + moduleScore + titleScore };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map((item) => item.entry);
}

function buildKeyPoints(context: UniversalAIContext, relatedRegulations: KnowledgeBaseEntry[]) {
  const keyPoints = unique([
    ...context.content
      .split(/[.!?]/)
      .map((segment) => segment.trim())
      .filter((segment) => segment.length > 20)
      .slice(0, 2),
    ...(context.tags ?? []).slice(0, 2).map((tag) => `Fokus konteks: ${tag}`),
    ...relatedRegulations.slice(0, 2).map((entry) => `Dasar rujukan: ${entry.title}`),
  ]);

  return keyPoints.slice(0, 4);
}

function buildActionRecommendations(
  context: UniversalAIContext,
  relatedRegulations: KnowledgeBaseEntry[]
): AIRecommendedAction[] {
  const recommendedPositionIds = unique(relatedRegulations.flatMap((entry) => entry.recommendedPositionIds ?? []));
  const regulationsLabel = relatedRegulations
    .slice(0, 2)
    .map((entry) => entry.citation)
    .join(", ");

  const actions: AIRecommendedAction[] = [];

  if (recommendedPositionIds.length > 0) {
    actions.push({
      id: `${context.moduleId}-routing`,
      type: "routing",
      label: "Jalur tindak lanjut yang paling relevan",
      description: "Gunakan daftar jabatan ini sebagai kandidat awal karena paling sering terkait dengan konteks dokumen yang sedang dibuka.",
      targetPositionIds: recommendedPositionIds.slice(0, 3),
    });
  }

  actions.push({
    id: `${context.moduleId}-instruction`,
    type: "instruction",
    label: "Arahan kerja singkat",
    description:
      context.entityType === "surat"
        ? "Telaah substansi surat, tetapkan PIC, dan minta tindak lanjut tertulis dengan batas waktu yang jelas."
        : "Gunakan hasil pencarian regulasi untuk menyusun arahan kerja atau telaah lanjutan pada modul ini.",
  });

  if (regulationsLabel) {
    actions.push({
      id: `${context.moduleId}-regulation`,
      type: "regulation",
      label: "Dasar regulasi terkait",
      description: `Gunakan ${regulationsLabel} sebagai rujukan awal sebelum menyusun keputusan atau instruksi.`,
    });
  }

  return actions;
}

export async function runAletaIntelligence(
  context: UniversalAIContext,
  config: AIGlobalConfig
): Promise<AletaAIInsight> {
  const relatedRegulations = contextualSearchRegulations(context, 4);
  const moduleDefinition = getHybridModuleDefinition(context.moduleId);
  const keyPoints = buildKeyPoints(context, relatedRegulations);
  const actions = buildActionRecommendations(context, relatedRegulations);
  const languageLabel = config.primaryLanguage === "id" ? "Bahasa Indonesia" : "English";

  const summary = [
    moduleDefinition?.label ?? "Modul aktif",
    `dibaca oleh ${config.modelId}`,
    `dengan keluaran ${languageLabel.toLowerCase()}.`,
    keyPoints[0] ?? context.title,
  ].join(" ");

  const rationale =
    relatedRegulations.length > 0
      ? `Rekomendasi dibentuk dari kecocokan konteks dokumen dengan knowledge base regulasi ${relatedRegulations
          .map((entry) => entry.citation)
          .join(", ")}.`
      : "Tidak ada regulasi yang cukup relevan, sehingga AI memakai ringkasan konteks dokumen sebagai dasar utama.";

  return new Promise((resolve) => {
    globalThis.setTimeout(() => {
      resolve({
        summary,
        keyPoints,
        regulations: relatedRegulations,
        actions,
        rationale,
      });
    }, 180);
  });
}
