import { describe, expect, it } from "vitest";

import { contextualSearchRegulations } from "@/core/intelligence/aleta-intelligence-service";
import { getMailIntelligenceInsight } from "@/modules/manajemen-surat/services/aleta-mail-intelligence";
import { defaultAIConfig, dispositions, letters } from "@/lib/mock-data";

describe("ALETA intelligence service", () => {
  it("finds relevant regulations from contextual search", () => {
    const regulations = contextualSearchRegulations({
      moduleId: "manajemen-surat",
      entityType: "surat",
      title: "Permintaan kesiapan audit keamanan aplikasi internal",
      content: "Audit keamanan aplikasi internal, backup, enkripsi, dan penetapan PIC TI.",
      tags: ["Audit", "Keamanan", "TI"],
    });

    expect(regulations.some((entry) => entry.id === "reg-int-002")).toBe(true);
  });

  it("suggests relevant routing for audit-oriented mail", async () => {
    const letter = letters.find((item) => item.id === "srt-003")!;
    const timeline = dispositions.filter((item) => item.suratId === letter.id);
    const insight = await getMailIntelligenceInsight({
      letter,
      timeline,
      aiConfig: defaultAIConfig,
    });

    expect(insight.regulations.some((entry) => entry.id === "reg-int-002")).toBe(true);
    expect(insight.suggestedPositionIds).toContain("pos-pranata-komputer");
  });
});
