import { describe, expect, it } from "vitest";

import { generateLetterDraftFromPdf } from "@/modules/manajemen-surat/services/letter-draft-ai";
import { defaultAIFeatureFlags } from "@/lib/ai-feature-flags";
import { type AIGlobalConfig, type UserPersona } from "@/lib/types";

const aiConfig: AIGlobalConfig = {
  enabled: true,
  providerId: "gemini",
  modelId: "Gemini 2.0 Flash",
  primaryLanguage: "id",
  providers: [],
  featureFlags: defaultAIFeatureFlags,
  featureDispositionAi: true,
  featureMailIntelligence: true,
  featureDraftMetadata: true,
  featureManajemenSuratAi: true,
  featureDisposisiAi: true,
};

const suggestedUsers: UserPersona[] = [
  {
    id: "usr-1",
    username: "sekretaris",
    password: "",
    name: "Sekretaris PA Donggala",
    nip: "198001012005011001",
    email: "sekretaris@example.go.id",
    whatsappNumber: "6281234567890",
    roleId: "sekretaris",
    positionId: "pos-sekretaris",
    isActive: true,
    actingAssignment: null,
  },
];

describe("generateLetterDraftFromPdf", () => {
  it("separates tanggal surat and tanggal terima while detecting origin", async () => {
    const draft = await generateLetterDraftFromPdf({
      type: "masuk",
      aiConfig,
      suggestedUsers,
      extractedText: `
        PEMERINTAH DESA KALAWARA
        Nomor: 140/12/Pem-DS/IV/2026
        Perihal: Permohonan data penduduk
        Kalawara, 18 April 2026
        Diterima di Pengadilan Agama Donggala pada 19 April 2026
      `,
    });

    expect(draft.asalSurat).toBe("Pemerintah Desa Kalawara");
    expect(draft.pengirim).toBe("Pemerintah Desa Kalawara");
    expect(draft.tanggalSurat).toBe("2026-04-18");
    expect(draft.tanggalAdministratif).toBe("2026-04-19");
    expect(draft.kodeKlasifikasi).toBe("");
    expect(draft.klasifikasi).toBe("");
  });

  it("fills classification only when match is strong", async () => {
    const draft = await generateLetterDraftFromPdf({
      type: "masuk",
      aiConfig,
      suggestedUsers,
      extractedText: `
        PENGADILAN AGAMA DONGGALA
        Nomor: 123/Pdt.G/2026/PA.Dgl
        Perihal: Penyampaian salinan putusan perkara
        Donggala, 17 April 2026
      `,
    });

    expect(draft.asalSurat).toBe("Pengadilan Agama Donggala");
    expect(draft.tanggalSurat).toBe("2026-04-17");
    expect(draft.tanggalAdministratif).toBe("");
    expect(draft.kodeKlasifikasi).toBe("YD.1.1");
    expect(draft.klasifikasi).toContain("Pemeriksaan Berkas");
  });
});
