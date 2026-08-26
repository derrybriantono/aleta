import { runAletaIntelligence } from "@/core/intelligence/aleta-intelligence-service";
import { getAccessibleLetters } from "@/lib/permissions";
import { type UserPersona } from "@/lib/types";
import { type AletaDatabase } from "@/server/db/client";
import { listDispositionsFromDb } from "@/server/modules/dispositions/service";
import { searchLettersInDb, type LetterSearchFilters } from "@/server/modules/letters/service";
import { getAISettingsFromDb } from "@/server/modules/ai/service";
import { getPositionsFromDb } from "@/server/modules/organization/service";

function clampSearchLimit(limit: number | undefined) {
  if (!Number.isFinite(limit)) return 100;
  return Math.max(1, Math.min(Number(limit), 100));
}

export async function searchLettersArchiveInDb(
  db: AletaDatabase,
  actorUser: UserPersona,
  {
    aiQuery,
    ...filters
  }: LetterSearchFilters & { aiQuery?: string }
) {
  const requestedLimit = clampSearchLimit(filters.limit);
  const rawItems = await searchLettersInDb(db, {
    ...filters,
    limit: Math.min(Math.max(requestedLimit * 5, 200), 5000),
  });
  const [dispositions, positions] = await Promise.all([
    listDispositionsFromDb(db),
    getPositionsFromDb(db),
  ]);
  const items = getAccessibleLetters(actorUser, rawItems, dispositions, positions).slice(0, requestedLimit);
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
