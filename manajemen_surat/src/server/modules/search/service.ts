import { runAletaIntelligence } from "@/core/intelligence/aleta-intelligence-service";
import { type AletaDatabase } from "@/server/db/client";
import { searchLettersInDb, type LetterSearchFilters } from "@/server/modules/letters/service";
import { getAISettingsFromDb } from "@/server/modules/ai/service";

export async function searchLettersArchiveInDb(db: AletaDatabase, {
  aiQuery,
  ...filters
}: LetterSearchFilters & { aiQuery?: string }) {
  const items = await searchLettersInDb(db, filters);
  const aiConfig = await getAISettingsFromDb(db);

  let aiSummary: string | null = null;

  if (aiConfig.enabled && aiQuery?.trim()) {
    const insight = await runAletaIntelligence(
      {
        moduleId: "manajemen-surat",
        entityType: "arsip-search",
        title: aiQuery,
        content: items
          .slice(0, 8)
          .map((item) => `${item.perihal}. ${item.ringkasan}`)
          .join(" "),
        tags: [
          "arsip",
          "search",
          ...(filters.tags ?? []),
          ...(filters.classificationTags ?? []),
        ],
      },
      aiConfig
    );
    aiSummary = insight.summary;
  }

  return {
    total: items.length,
    items,
    aiSummary,
  };
}
