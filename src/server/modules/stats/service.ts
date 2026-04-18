import { runAletaIntelligence } from "@/core/intelligence/aleta-intelligence-service";
import { type AletaDatabase } from "@/server/db/client";
import { getAISettingsFromDb } from "@/server/modules/ai/service";
import { getLetterSummaryForStats, type LetterSearchFilters } from "@/server/modules/letters/service";

type StatsDimension = "jenis" | "tahun" | "triwulan" | "klasifikasi" | "asal" | "status";
type LetterStatsRow = Awaited<ReturnType<typeof getLetterSummaryForStats>>[number];

function getQuarter(dateValue: string) {
  const month = new Date(dateValue).getMonth();
  return `TW ${Math.floor(month / 3) + 1}`;
}

function getLabel(dimension: StatsDimension, row: LetterStatsRow) {
  if (dimension === "jenis") return row.type === "masuk" ? "Surat Masuk" : "Surat Keluar";
  if (dimension === "tahun") return new Date(row.tanggal_ref).getFullYear().toString();
  if (dimension === "triwulan") return getQuarter(row.tanggal_ref);
  if (dimension === "asal") return row.asal_surat;
  if (dimension === "status") return row.status;
  return row.klasifikasi_utama?.trim() ? row.klasifikasi_utama : "Belum Terklasifikasi";
}

export async function getLetterStatisticsInDb(db: AletaDatabase, {
  dimension = "jenis",
  includeAIInsight = false,
  ...filters
}: LetterSearchFilters & { dimension?: StatsDimension; includeAIInsight?: boolean }) {
  const rows = await getLetterSummaryForStats(db, filters);
  const grouped = rows.reduce<Map<string, number>>((map, row) => {
    const label = getLabel(dimension, row);
    map.set(label, (map.get(label) ?? 0) + 1);
    return map;
  }, new Map());
  const data = Array.from(grouped.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((left, right) => right.value - left.value || left.label.localeCompare(right.label));

  let aiInsight: string | null = null;
  const aiConfig = await getAISettingsFromDb(db);

  if (includeAIInsight && aiConfig.enabled) {
    const insight = await runAletaIntelligence(
      {
        moduleId: "manajemen-surat",
        entityType: "statistik",
        title: `Analisis statistik ${dimension}`,
        content: data.map((item) => `${item.label}: ${item.value}`).join(". "),
        tags: ["statistik", dimension],
      },
      aiConfig
    );
    aiInsight = insight.summary;
  }

  return {
    total: rows.length,
    dimension,
    data,
    aiInsight,
  };
}
