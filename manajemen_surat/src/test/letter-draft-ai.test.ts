import { describe, expect, it } from "vitest";

import {
  generateLetterDraftFromPdf,
  normalizeLetterDraftCoreSummary,
} from "@/modules/manajemen-surat/services/letter-draft-ai";
import { defaultAIFeatureFlags } from "@/lib/ai-feature-flags";
import { type AIGlobalConfig, type UserPersona } from "@/lib/types";

const aiConfig: AIGlobalConfig = {
  enabled: true,
  providerId: "gemini",
  modelId: "Gemini 2.0 Flash",
  primaryLanguage: "id",
  providers: [],
  moduleConfigs: [],
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

  it("summarizes the core purpose instead of copying letter metadata", async () => {
    const draft = await generateLetterDraftFromPdf({
      type: "masuk",
      aiConfig,
      suggestedUsers,
      extractedText: `
        MAHKAMAH AGUNG REPUBLIK INDONESIA
        PENGADILAN AGAMA DONGGALA
        Jalan Vatu Bala Nomor 1
        Nomor: 045/ZI/V/2026
        Tanggal: 18 Mei 2026
        Perihal: Permohonan data dukung Zona Integritas
        Kepada Yth. Ketua Pengadilan Agama Donggala

        Dengan hormat,
        Sehubungan dengan pelaksanaan evaluasi Zona Integritas, kami mohon bantuan Saudara
        untuk mengirimkan data dukung layanan dan daftar inovasi paling lambat 20 Mei 2026.
        Data tersebut akan digunakan sebagai bahan penilaian peningkatan layanan publik.

        Atas perhatian Saudara, kami ucapkan terima kasih.
        Kepala Bagian
        NIP 198001012005011001
      `,
    });

    expect(draft.ringkasan).toContain("pelaksanaan evaluasi Zona Integritas");
    expect(draft.ringkasan).toContain("mengirimkan data dukung layanan");
    expect(draft.ringkasan).not.toMatch(/\b(Nomor|Tanggal|Kepada|NIP)\b/i);
    expect(draft.ringkasan).not.toContain("MAHKAMAH AGUNG");
  });

  it("cleans metadata-heavy live AI summaries before saving draft output", () => {
    const extractedText = `
      Nomor: 045/ZI/V/2026
      Tanggal: 18 Mei 2026
      Perihal: Permohonan data dukung Zona Integritas
      Kepada Yth. Ketua Pengadilan Agama Donggala
      Sehubungan dengan evaluasi Zona Integritas, kami meminta pengiriman data dukung
      dan daftar inovasi layanan untuk bahan penilaian peningkatan layanan publik.
    `;

    const summary = normalizeLetterDraftCoreSummary({
      summary:
        "Nomor: 045/ZI/V/2026 Tanggal: 18 Mei 2026 Perihal: Permohonan data dukung Zona Integritas Kepada Yth. Ketua Pengadilan Agama Donggala",
      extractedText,
      subject: "Permohonan data dukung Zona Integritas",
    });

    expect(summary).toContain("evaluasi Zona Integritas");
    expect(summary).toContain("pengiriman data dukung");
    expect(summary).not.toMatch(/\b(Nomor|Tanggal|Kepada)\b/i);
  });
});
