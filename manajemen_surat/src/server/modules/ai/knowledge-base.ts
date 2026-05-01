import { type KnowledgeBaseEntry, type UniversalAIContext } from "@/lib/types";
import { type AletaDatabase } from "@/server/db/client";
import { parseJsonArray } from "@/server/shared/json";

type RegulationRow = {
  id: string;
  title: string;
  source: KnowledgeBaseEntry["source"];
  jurisdiction: string;
  module_ids_json: string;
  keywords_json: string;
  summary: string;
  citation: string;
  recommended_position_ids_json: string;
};

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

function mapRegulationRow(row: RegulationRow): KnowledgeBaseEntry {
  return {
    id: row.id,
    title: row.title,
    source: row.source,
    jurisdiction: row.jurisdiction,
    moduleIds: parseJsonArray<string>(row.module_ids_json),
    keywords: parseJsonArray<string>(row.keywords_json),
    summary: row.summary,
    citation: row.citation,
    recommendedPositionIds: parseJsonArray<string>(row.recommended_position_ids_json),
  };
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

export async function searchRegulationsInDb(
  db: AletaDatabase,
  context: UniversalAIContext,
  limit = 4
) {
  const rows = await db.prepare(
    `SELECT id, title, source, jurisdiction, module_ids_json, keywords_json, summary, citation,
      recommended_position_ids_json
     FROM knowledge_base_regulations
     WHERE deleted_at IS NULL`
  ).all<RegulationRow>();
  const tokens = collectContextTokens(context);

  return rows
    .map(mapRegulationRow)
    .map((entry) => {
      const keywordScore = entry.keywords.reduce(
        (score, keyword) =>
          score + tokens.filter((token) => normalizeText(keyword).includes(token)).length,
        0
      );
      const moduleScore = entry.moduleIds.includes(context.moduleId) ? 3 : 0;
      const titleScore =
        tokens.filter((token) => normalizeText(entry.title).includes(token)).length * 2;
      const summaryScore =
        tokens.filter((token) => normalizeText(entry.summary).includes(token)).length;

      return {
        entry,
        score: keywordScore + moduleScore + titleScore + summaryScore,
      };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map((item) => item.entry);
}
