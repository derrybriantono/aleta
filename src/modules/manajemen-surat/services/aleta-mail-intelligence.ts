import { runAletaIntelligence } from "@/core/intelligence/aleta-intelligence-service";
import { getPosition } from "@/lib/permissions";
import { type AIGlobalConfig, type DispositionNode, type LetterDetail } from "@/lib/types";

export type MailIntelligenceInsight = Awaited<ReturnType<typeof getMailIntelligenceInsight>>;

export async function getMailIntelligenceInsight({
  letter,
  timeline,
  aiConfig,
}: {
  letter: LetterDetail;
  timeline: DispositionNode[];
  aiConfig: AIGlobalConfig;
}) {
  const insight = await runAletaIntelligence(
    {
      moduleId: "manajemen-surat",
      entityType: "surat",
      title: letter.perihal,
      content: [
        letter.ringkasan,
        `Nomor surat ${letter.nomorSurat}`,
        `Klasifikasi ${letter.klasifikasi}`,
        `Asal ${letter.asalSurat}`,
        `Tujuan ${letter.tujuanSurat}`,
        `Unit terkait ${letter.assignedUnit}`,
      ].join(". "),
      tags: [...letter.tags, letter.confidentiality, letter.assignedUnit],
      metadata: {
        type: letter.type,
        classification: letter.klasifikasi,
        sender: letter.pengirim,
        currentStatus: letter.status,
        timeline: timeline.map((item) => item.instruksi),
      },
    },
    aiConfig
  );

  const routingAction = insight.actions.find((action) => action.type === "routing");
  const suggestedPositionIds = routingAction?.targetPositionIds ?? [];
  const suggestedPositionLabels = suggestedPositionIds.map((positionId) => getPosition(positionId)?.name ?? positionId);
  const instructionPrefix =
    letter.type === "masuk" ? "Mohon telaah substansi surat ini" : "Mohon pastikan tindak lanjut surat keluar ini";
  const suggestedInstruction = `${instructionPrefix}, tetapkan PIC pada unit ${
    suggestedPositionLabels[0] ?? letter.assignedUnit
  }, dan laporkan progres singkat berikut dasar regulasi yang digunakan.`;

  return {
    ...insight,
    suggestedPositionIds,
    suggestedPositionLabels,
    suggestedInstruction,
  };
}
