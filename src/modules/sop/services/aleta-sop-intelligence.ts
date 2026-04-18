import { runAletaIntelligence } from "@/core/intelligence/aleta-intelligence-service";
import { type AIGlobalConfig } from "@/lib/types";

export function getSopIntelligenceInsight({
  title,
  draftText,
  aiConfig,
}: {
  title: string;
  draftText: string;
  aiConfig: AIGlobalConfig;
}) {
  return runAletaIntelligence(
    {
      moduleId: "sop",
      entityType: "draft-sop",
      title,
      content: draftText,
      tags: ["SOP", "regulasi", "prosedur"],
    },
    aiConfig
  );
}
