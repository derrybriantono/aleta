// @vitest-environment node

import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { users as usersTable } from "@/server/db/drizzle-schema";
import { type AletaDatabase, createAletaDatabase } from "@/server/db/client";
import { ApiError } from "@/server/shared/errors";
import { stringifyJson } from "@/server/shared/json";
import {
  extractSuratDraftInDb,
  generateDispositionSuggestionInDb,
  generateMailIntelligenceInDb,
  getAISettingsFromDb,
  testAIProviderConnectionInDb,
  upsertAISettingsInDb,
} from "@/server/modules/ai/service";
import { getDispositionsByLetterIdFromDb } from "@/server/modules/dispositions/service";
import { createLetterInDb, deleteLetterInDb, getLetterByIdFromDb, searchLettersInDb } from "@/server/modules/letters/service";
import { createActingAssignmentInDb } from "@/server/modules/organization/service";
import { getLetterStatisticsInDb } from "@/server/modules/stats/service";
import {
  confirmPasswordRecoveryInDb,
  createManagedUserInDb,
  createPasswordRecoveryDraftInDb,
  lookupUserForLoginInDb,
  updateManagedUserInDb,
} from "@/server/modules/users/service";

describe("backend modular monolith services", () => {
  let db: AletaDatabase | null = null;

  beforeEach(async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: true });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input, init) => {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url;

        if (!url.includes("generativelanguage.googleapis.com")) {
          throw new Error(`Unhandled fetch URL in test: ${url}`);
        }

        const body = JSON.parse(String(init?.body ?? "{}")) as {
          contents?: Array<{ parts?: Array<{ text?: string }> }>;
        };
        const prompt = body.contents?.[0]?.parts?.[0]?.text ?? "";
        const responseText = prompt.includes("targetOptions (whitelist untuk suggestedTargetPositionId")
          ? stringifyJson({
              summary:
                "Surat meminta audit keamanan aplikasi internal dengan penetapan PIC TI dan jadwal jelas.",
              keyFindings: [
                "Mandat audit keamanan aplikasi internal dari Mahkamah Agung RI.",
                "Wajib menetapkan PIC TI dan jadwal tindak lanjut.",
              ],
              priority: { level: "high", reason: "Klasifikasi Penting dan terkait keamanan sistem." },
              suggestedInstruction:
                "Tugaskan PIC TI untuk menyusun rencana kerja audit, siapkan dokumen pendukung, dan laporkan progres dalam 3 hari kerja.",
              suggestedTargetPositionId: "pos-pranata-komputer",
              suggestedTargetLabel: "Pranata Komputer",
              autofill: {
                suggestedInstruction:
                  "Tugaskan PIC TI untuk menyusun rencana kerja audit, siapkan dokumen pendukung, dan laporkan progres dalam 3 hari kerja.",
                suggestedTargetPositionId: "pos-pranata-komputer",
                suggestedTargetLabel: "Pranata Komputer",
                allowDownload: true,
                urgent: false,
              },
              followUpSuggestions: [
                { label: "Susun rencana kerja audit", detail: "Libatkan tim TI dan anggaran terkait." },
                { label: "Laporkan progres mingguan", detail: "Sampaikan ke pimpinan setiap Jumat." },
              ],
              verificationChecklist: [
                "Pastikan PIC TI sesuai kewenangan audit.",
                "Konfirmasi cakupan audit sesuai permintaan Mahkamah Agung.",
              ],
              confidence: 0.8,
              rationale: "Data surat, klasifikasi, dan target jabatan cukup lengkap untuk menurunkan saran konkret.",
            })
          : stringifyJson({
              nomorSurat: "AI/2026/0001",
              nomorUrut: "001",
              pengirim: "Mahkamah Agung RI",
              perihal: "Audit keamanan aplikasi internal",
              assignedUnit: "Kesekretariatan",
              confidentiality: "Penting",
              asalSurat: "Mahkamah Agung RI",
              tujuanSurat: "Ketua Pengadilan",
              kodeKlasifikasi: "TI.1.1",
              klasifikasi: "Infrastruktur, Jaringan, dan Keamanan",
              klasifikasiTags: ["Keamanan", "Audit"],
              ringkasan: "Audit keamanan aplikasi internal, backup, enkripsi, dan penetapan PIC TI.",
              tags: ["Audit", "Keamanan"],
              lampiran: [],
              suggestedTargetUserId: "usr-ketua",
              suggestedTargetPositionId: "pos-ketua",
              aiReviewNote: "Periksa kembali hasil AI sebelum menyimpan.",
            });

        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [{ text: responseText }],
                },
              },
            ],
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json",
            },
          }
        );
      }) as typeof fetch
    );
  });

  afterEach(async () => {
    await db?.close();
    db = null;
    vi.unstubAllGlobals();
  });

  it("creates a letter transactionally and generates the initial disposition history", async () => {
    const result = await createLetterInDb(db!, {
      actorUserId: "usr-dina",
      type: "masuk",
      nomorUrut: "015",
      nomorSurat: "B-015/ALETA/IV/2026",
      tanggalSurat: "2026-04-11",
      tanggalTerima: "2026-04-11",
      pengirim: "Mahkamah Agung RI",
      perihal: "Permintaan monitoring layanan terpadu",
      assignedUnit: "Kesekretariatan",
      confidentiality: "Penting",
      kodeKlasifikasi: "UM.1.1",
      klasifikasi: "Tata Naskah Dinas dan Persuratan",
      klasifikasiTags: ["UM.1.1", "Persuratan", "Monitoring"],
      ringkasan: "Surat meminta monitoring layanan terpadu dan tindak lanjut pimpinan.",
      asalSurat: "Mahkamah Agung RI",
      tujuanSurat: "Ketua Pengadilan",
      lampiran: ["monitoring-layanan.pdf"],
      tags: ["#Badilag", "TagBackendTest"],
      viewerMode: "download",
      targetPositionId: "pos-ketua",
      documentFileName: "monitoring-layanan.pdf",
      documentSizeMb: 1.2,
      documentTextExtract: "Monitoring layanan terpadu Pengadilan Agama Makassar.",
    });

    expect(result.letter.nomorUrut).toBe("015");
    expect(result.letter.tanggalAdministratif).toBe("2026-04-11");
    expect(result.letter.viewerMode).toBe("download");
    expect(result.letter.whatsappDeliveries[0]?.recipientWhatsapp).toBeTruthy();
    expect(result.initialDisposition).toBeTruthy();
    expect(result.initialDisposition?.status).toBe("Menunggu Tindak Lanjut");

    const timeline = await getDispositionsByLetterIdFromDb(db!, result.letter.id);
    expect(timeline).toHaveLength(1);
    expect(timeline[0]?.status).toBe("Menunggu Tindak Lanjut");
    expect(timeline[0]?.penerimaId).toBe("usr-ketua");
  });

  it("supports advanced archive search across tags and classification metadata", async () => {
    const created = await createLetterInDb(db!, {
      actorUserId: "usr-kepeg-staff",
      type: "keluar",
      nomorUrut: "099",
      nomorSurat: "B-099/ALETA/IV/2026",
      tanggalSurat: "2026-04-11",
      tanggalKirim: "2026-04-11",
      pengirim: "Pengadilan Agama Makassar",
      perihal: "Usul pembaruan SOP kepegawaian",
      assignedUnit: "Kesekretariatan",
      confidentiality: "Biasa",
      kodeKlasifikasi: "KP.1.1",
      klasifikasi: "Formasi, Mutasi, dan Penempatan",
      klasifikasiTags: ["Kepegawaian", "SOP Backend"],
      ringkasan: "Usul pembaruan SOP kepegawaian dan sinkronisasi kebutuhan formasi.",
      asalSurat: "Internal Pengadilan",
      tujuanSurat: "Kasubag Kepegawaian",
      lampiran: ["draft-sop-kepegawaian.pdf"],
      tags: ["TagBackendSearch", "#MahkamahAgung"],
      viewerMode: "download",
      targetPositionId: "pos-kasubag-kepegawaian",
    });

    const results = await searchLettersInDb(db!, {
      type: "keluar",
      code: "KP.1.1",
      tags: ["TagBackendSearch"],
      classificationTags: ["SOP Backend"],
    });

    expect(results.some((item) => item.id === created.letter.id)).toBe(true);
  });

  it("rejects PLH assignment outside direct hierarchy with 403", async () => {
    try {
      await createActingAssignmentInDb(db!, {
        actorUserId: "usr-sekretaris",
        userIdPengganti: "usr-budi",
        jabatanIdTarget: "pos-sekretaris",
        tipe: "PLH",
        tanggalMulai: "2026-04-11",
        tanggalSelesai: "2026-04-18",
      });
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(403);
      return;
    }

    throw new Error("Penugasan PLH seharusnya ditolak bila bukan bawahan langsung.");
  });

  it("soft deletes for admin and hard deletes for super admin", async () => {
    const created = await createLetterInDb(db!, {
      actorUserId: "usr-dina",
      type: "masuk",
      nomorUrut: "021",
      nomorSurat: "B-021/ALETA/IV/2026",
      tanggalSurat: "2026-04-11",
      tanggalTerima: "2026-04-11",
      pengirim: "Ditjen Badilag",
      perihal: "Permintaan data arsip backend",
      assignedUnit: "Kesekretariatan",
      confidentiality: "Biasa",
      kodeKlasifikasi: "UM.3.1",
      klasifikasi: "Kearsipan dan Dokumentasi",
      klasifikasiTags: ["Arsip", "Backend"],
      ringkasan: "Permintaan data arsip untuk validasi backend.",
      asalSurat: "Ditjen Badilag",
      tujuanSurat: "Ketua Pengadilan",
      lampiran: [],
      tags: ["TagDeleteSoft"],
      viewerMode: "download",
      targetPositionId: "pos-ketua",
    });

    const softDelete = await deleteLetterInDb(db!, {
      actorUserId: "usr-admin",
      letterId: created.letter.id,
    });
    expect(softDelete.mode).toBe("soft");
    expect(await getLetterByIdFromDb(db!, created.letter.id)).toBeNull();
    expect(
      (await getLetterByIdFromDb(db!, created.letter.id, { includeDeleted: true }))?.deletedState
    ).toBeTruthy();

    const second = await createLetterInDb(db!, {
      actorUserId: "usr-dina",
      type: "masuk",
      nomorUrut: "022",
      nomorSurat: "B-022/ALETA/IV/2026",
      tanggalSurat: "2026-04-11",
      tanggalTerima: "2026-04-11",
      pengirim: "Badan Pengawasan Mahkamah Agung",
      perihal: "Permintaan audit keamanan backend",
      assignedUnit: "Kesekretariatan",
      confidentiality: "Rahasia",
      kodeKlasifikasi: "TI.1.1",
      klasifikasi: "Infrastruktur, Jaringan, dan Keamanan",
      klasifikasiTags: ["Audit", "Keamanan"],
      ringkasan: "Permintaan audit keamanan backend ALETA.",
      asalSurat: "Badan Pengawasan Mahkamah Agung",
      tujuanSurat: "Ketua Pengadilan",
      lampiran: [],
      tags: ["TagDeleteHard"],
      viewerMode: "download",
      targetPositionId: "pos-ketua",
    });

    const hardDelete = await deleteLetterInDb(db!, {
      actorUserId: "usr-super",
      letterId: second.letter.id,
    });
    expect(hardDelete.mode).toBe("hard");
    expect(await getLetterByIdFromDb(db!, second.letter.id, { includeDeleted: true })).toBeNull();
  });

  it("aggregates statistics and can return AI insight", async () => {
    await createLetterInDb(db!, {
      actorUserId: "usr-admin",
      type: "masuk",
      nomorUrut: "321",
      nomorSurat: "AI/2026/STAT-001",
      tanggalSurat: "2026-04-18",
      tanggalTerima: "2026-04-18",
      pengirim: "Mahkamah Agung RI",
      perihal: "Surat uji statistik backend ALETA",
      assignedUnit: "Kesekretariatan",
      confidentiality: "Penting",
      kodeKlasifikasi: "UM.1.1",
      klasifikasi: "Tata Naskah Dinas dan Persuratan",
      klasifikasiTags: ["Statistik", "Persuratan"],
      ringkasan: "Surat uji untuk memastikan statistik berbasis data riil tetap terbentuk.",
      asalSurat: "Mahkamah Agung RI",
      tujuanSurat: "Ketua Pengadilan",
      lampiran: [],
      tags: ["Statistik"],
      viewerMode: "download",
      targetPositionId: "pos-ketua",
    });

    const result = await getLetterStatisticsInDb(db!, {
      dimension: "jenis",
      includeAIInsight: true,
      year: "2026",
    });

    expect(result.total).toBeGreaterThan(0);
    expect(result.data.some((item) => item.label === "Surat Masuk")).toBe(true);
    expect(result.aiInsight).toBeTruthy();
  });

  it("stores masked AI connections and can switch active connection", async () => {
    const firstConnection = await upsertAISettingsInDb(db!, {
      actorUserId: "usr-super",
      connection: {
        providerId: "gemini",
        label: "Gemini 2.5 Flash Gratis",
        modelId: "Gemini 2.5 Flash",
        apiKey: "gemini-valid-key-1234567890",
      },
    });

    const geminiConnection = firstConnection.providers.find((provider) => provider.name === "Gemini 2.5 Flash Gratis");
    expect(geminiConnection).toBeTruthy();
    expect(geminiConnection?.maskedApiKey).toContain("••••");
    expect(geminiConnection?.apiKey).toBe("");

    const secondConnection = await upsertAISettingsInDb(db!, {
      actorUserId: "usr-super",
      connection: {
        providerId: "chatgpt",
        label: "OpenAI Utama",
        modelId: "GPT-4.1",
        apiKey: "openai-valid-key-1234567890",
      },
    });

    const openAiConnection = secondConnection.providers.find((provider) => provider.name === "OpenAI Utama");
    expect(openAiConnection).toBeTruthy();

    const activated = await upsertAISettingsInDb(db!, {
      actorUserId: "usr-super",
      activeConnectionId: openAiConnection?.id ?? null,
    });

    expect(activated.activeConnectionId).toBe(openAiConnection?.id);
    expect(activated.providerId).toBe("chatgpt");
    expect(activated.modelId).toBe("GPT-4.1");

    const internalConfig = await getAISettingsFromDb(db!, { includeSecrets: true });
    const activeConnection = internalConfig.providers.find((provider) => provider.id === internalConfig.activeConnectionId);
    expect(activeConnection?.providerId).toBe("chatgpt");
    expect(activeConnection?.apiKey).toBe("openai-valid-key-1234567890");
  });

  it("stores dynamic AI provider settings and uses database regulations for AI drafts", async () => {
    const connection = await testAIProviderConnectionInDb(db!, {
      actorUserId: "usr-super",
      providerId: "gemini",
      modelId: "Gemini 2.5 Pro",
      apiKey: "1234567890-valid-key",
    });
    expect(connection.status).toBe("connected");

    const settings = await upsertAISettingsInDb(db!, {
      actorUserId: "usr-super",
      enabled: true,
      primaryLanguage: "id",
      connection: {
        providerId: "gemini",
        label: "Gemini Analisis Surat",
        modelId: "Gemini 2.5 Pro",
        apiKey: "1234567890-valid-key",
        connectionStatus: "connected",
        lastTestedAt: connection.testedAt,
        lastConnectionMessage: connection.message,
      },
    });
    expect(settings.providerId).toBe("gemini");
    expect(settings.modelId).toBe("Gemini 2.5 Pro");

    const draft = await extractSuratDraftInDb(db!, {
      actorUserId: "usr-dina",
      type: "masuk",
      extractedText:
        "Audit keamanan aplikasi internal, backup, enkripsi, dan penetapan PIC TI untuk Pengadilan Agama Makassar.",
    });
    expect(draft.verifyBeforeSave).toBe(true);
    expect(draft.relatedRegulations.length).toBeGreaterThan(0);

  });

  it("uses live AI connection for ALETA mail intelligence and returns honest fallback when disabled", async () => {
    const letter = await createLetterInDb(db!, {
      actorUserId: "usr-dina",
      type: "masuk",
      nomorUrut: "501",
      nomorSurat: "B-501/ALETA/IV/2026",
      tanggalSurat: "2026-04-12",
      tanggalTerima: "2026-04-12",
      pengirim: "Mahkamah Agung RI",
      perihal: "Permintaan audit keamanan aplikasi internal",
      assignedUnit: "Kesekretariatan",
      confidentiality: "Penting",
      kodeKlasifikasi: "TI.1.1",
      klasifikasi: "Infrastruktur, Jaringan, dan Keamanan",
      klasifikasiTags: ["Audit", "Keamanan"],
      ringkasan:
        "Audit keamanan aplikasi internal, backup, enkripsi, dan penetapan PIC TI untuk Pengadilan Agama Makassar.",
      asalSurat: "Mahkamah Agung RI",
      tujuanSurat: "Ketua Pengadilan",
      lampiran: ["laporan-audit.pdf"],
      tags: ["Audit", "Keamanan", "TI"],
      viewerMode: "download",
      targetPositionId: "pos-ketua",
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input, init) => {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url;

        if (!url.includes("generativelanguage.googleapis.com")) {
          throw new Error(`Unhandled fetch URL in test: ${url}`);
        }

        const body = JSON.parse(String(init?.body ?? "{}")) as {
          contents?: Array<{ parts?: Array<{ text?: string }> }>;
        };
        const prompt = body.contents?.[0]?.parts?.[0]?.text ?? "";
        expect(prompt).toContain(letter.letter.nomorSurat);
        expect(prompt).toContain(letter.letter.ringkasan);

        const aiJson = stringifyJson({
          summary: "AI menyimpulkan surat menginstruksikan audit keamanan aplikasi internal dengan PIC TI.",
          keyFindings: [
            "Mandat audit keamanan aplikasi internal",
            "Perlu backup dan enkripsi sesuai pedoman",
            "PIC TI ditetapkan sebagai pelaksana",
          ],
          priority: { level: "high", reason: "Klasifikasi Penting dan berkaitan dengan keamanan sistem." },
          followUpSuggestions: [
            { label: "Tetapkan PIC TI", detail: "Tugaskan Pranata Komputer sebagai PIC audit dan minta rencana kerja." },
            { label: "Susun jadwal audit", detail: "Rapatkan lingkup audit dengan pimpinan maksimal 3 hari." },
          ],
          suggestedPositionIds: ["pos-pranata-komputer"],
          verificationChecklist: [
            "Verifikasi nomor dan tanggal surat dengan naskah asli",
            "Pastikan lampiran laporan-audit.pdf tersedia",
          ],
          confidence: 0.82,
          rationale: "Data surat lengkap: klasifikasi, ringkasan audit, dan PIC TI eksplisit.",
        });

        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [{ text: aiJson }],
                },
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }) as typeof fetch
    );

    await upsertAISettingsInDb(db!, {
      actorUserId: "usr-super",
      enabled: true,
      primaryLanguage: "id",
      connection: {
        providerId: "gemini",
        label: "Gemini Intelligence",
        modelId: "Gemini 2.5 Pro",
        apiKey: "gemini-live-key-intelligence",
        connectionStatus: "connected",
      },
    });

    const liveInsight = await generateMailIntelligenceInDb(db!, {
      actorUserId: "usr-ketua",
      letterId: letter.letter.id,
    });

    expect(liveInsight.source).toBe("ai-live");
    expect(liveInsight.provider.providerId).toBe("gemini");
    expect(liveInsight.provider.modelId).toBe("Gemini 2.5 Pro");
    expect(liveInsight.provider.providerModelId).toBe("gemini-2.5-pro");
    expect(liveInsight.provider.isLive).toBe(true);
    expect(liveInsight.provider.hasActiveApiKey).toBe(true);
    expect(liveInsight.summary).toContain("audit keamanan aplikasi internal");
    expect(liveInsight.keyFindings.length).toBeGreaterThanOrEqual(2);
    expect(liveInsight.priority.level).toBe("high");
    expect(liveInsight.followUpSuggestions.length).toBeGreaterThanOrEqual(2);
    expect(liveInsight.confidence.score).toBeCloseTo(0.82, 2);
    expect(liveInsight.confidence.level).toBe("high");
    expect(liveInsight.suggestedPositionIds).toContain("pos-pranata-komputer");
    expect(liveInsight.verificationChecklist.join(" ")).toContain("verifikasi manual");

    await upsertAISettingsInDb(db!, {
      actorUserId: "usr-super",
      enabled: false,
    });

    const disabledInsight = await generateMailIntelligenceInDb(db!, {
      actorUserId: "usr-ketua",
      letterId: letter.letter.id,
    });
    expect(disabledInsight.source).toBe("disabled");
    expect(disabledInsight.provider.isLive).toBe(false);
    expect(disabledInsight.message ?? "").toContain("Pengaturan AI");
    expect(disabledInsight.verificationChecklist.length).toBeGreaterThan(0);
  });

  it("uses live AI connection for One-Stop Disposition suggestions and falls back honestly", async () => {
    const letter = await createLetterInDb(db!, {
      actorUserId: "usr-dina",
      type: "masuk",
      nomorUrut: "611",
      nomorSurat: "B-611/ALETA/IV/2026",
      tanggalSurat: "2026-04-18",
      tanggalTerima: "2026-04-18",
      pengirim: "Mahkamah Agung RI",
      perihal: "Permintaan audit keamanan aplikasi internal",
      assignedUnit: "Kesekretariatan",
      confidentiality: "Penting",
      kodeKlasifikasi: "TI.1.1",
      klasifikasi: "Infrastruktur, Jaringan, dan Keamanan",
      klasifikasiTags: ["Audit", "Keamanan"],
      ringkasan:
        "Audit keamanan aplikasi internal, backup, enkripsi, dan penetapan PIC TI untuk Pengadilan Agama Makassar.",
      asalSurat: "Mahkamah Agung RI",
      tujuanSurat: "Ketua Pengadilan",
      lampiran: ["laporan-audit.pdf"],
      tags: ["Audit", "Keamanan", "TI"],
      viewerMode: "download",
      targetPositionId: "pos-ketua",
    });

    await upsertAISettingsInDb(db!, {
      actorUserId: "usr-super",
      enabled: true,
      primaryLanguage: "id",
      connection: {
        providerId: "gemini",
        label: "Gemini Intelligence",
        modelId: "Gemini 2.5 Pro",
        apiKey: "gemini-live-key-disposition",
        connectionStatus: "connected",
      },
    });

    const liveInsight = await generateDispositionSuggestionInDb(db!, {
      actorUserId: "usr-ketua",
      letterId: letter.letter.id,
      currentInstruction: "",
      targetOptions: [
        { id: "pos-pranata-komputer", label: "Pranata Komputer" },
        { id: "pos-kasubag-umum", label: "Kasubag Umum dan Keuangan" },
      ],
    });

    expect(liveInsight.source).toBe("ai-live");
    expect(liveInsight.provider.providerId).toBe("gemini");
    expect(liveInsight.provider.modelId).toBe("Gemini 2.5 Pro");
    expect(liveInsight.provider.providerModelId).toBe("gemini-2.5-pro");
    expect(liveInsight.provider.isLive).toBe(true);
    expect(liveInsight.provider.hasActiveApiKey).toBe(true);
    expect(liveInsight.suggestedTargetPositionId).toBe("pos-pranata-komputer");
    expect(liveInsight.suggestedTargetLabel).toContain("Pranata Komputer");
    expect(liveInsight.suggestedInstruction).toContain("PIC TI");
    expect(liveInsight.priority.level).toBe("high");
    expect(liveInsight.confidence.score).toBeCloseTo(0.8, 2);
    expect(liveInsight.confidence.level).toBe("high");
    expect(liveInsight.followUpSuggestions.length).toBeGreaterThanOrEqual(2);
    expect(liveInsight.autofill.suggestedTargetPositionId).toBe("pos-pranata-komputer");
    expect(liveInsight.autofill.suggestedInstruction.length).toBeGreaterThan(20);
    expect(liveInsight.verificationChecklist.join(" ")).toContain("verifikasi manual");

    await upsertAISettingsInDb(db!, {
      actorUserId: "usr-super",
      enabled: false,
    });

    const disabledInsight = await generateDispositionSuggestionInDb(db!, {
      actorUserId: "usr-ketua",
      letterId: letter.letter.id,
      currentInstruction: "",
      targetOptions: [
        { id: "pos-pranata-komputer", label: "Pranata Komputer" },
        { id: "pos-kasubag-umum", label: "Kasubag Umum dan Keuangan" },
      ],
    });

    expect(disabledInsight.source).toBe("disabled");
    expect(disabledInsight.provider.isLive).toBe(false);
    expect(disabledInsight.message ?? "").toContain("Pengaturan AI");
    expect(disabledInsight.verificationChecklist.length).toBeGreaterThan(0);
    expect(disabledInsight.suggestedInstruction.length).toBeGreaterThan(0);
  });

  it("creates managed users in PostgreSQL and mirrors credential accounts", async () => {
    const createdUser = await createManagedUserInDb(db!, "usr-super", {
      username: "derry",
      password: "derry123",
      email: "derry@pa.go.id",
      whatsappNumber: "628123459999",
      name: "Derry",
      nip: "199001012026041001",
      positionId: "pos-ketua",
    });

    expect(createdUser.username).toBe("derry");
    expect(createdUser.positionId).toBe("pos-ketua");
    expect(createdUser.roleId).toBe("ketua");

    const loginLookup = await lookupUserForLoginInDb(db!, {
      username: "derry",
    });
    expect(loginLookup?.email).toBe("derry@pa.go.id");

    const accountRow = await db!.prepare(
      `SELECT account_id, provider_id
       FROM accounts
       WHERE user_id = ? AND provider_id = 'credential'`
    ).get<{ account_id: string; provider_id: string }>(createdUser.id);
    expect(accountRow?.account_id).toBe("derry@pa.go.id");
    expect(accountRow?.provider_id).toBe("credential");
  });

  it("supports Drizzle ORM user lookups in the in-memory fallback used by Better Auth", async () => {
    const matchedUsers = await db!
      .getOrm()
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, "superderry@gmail.com"))
      .limit(1);

    expect(matchedUsers[0]?.username).toBe("superadmin");
    expect(matchedUsers[0]?.email).toBe("superderry@gmail.com");
  });

  it("updates managed users and password recovery against backend records", async () => {
    const createdUser = await createManagedUserInDb(db!, "usr-super", {
      username: "derry2",
      password: "derry456",
      email: "derry2@pa.go.id",
      whatsappNumber: "628123458888",
      name: "Derry Dua",
      nip: "199001012026041002",
      positionId: "pos-sekretaris",
    });

    const updatedUser = await updateManagedUserInDb(db!, {
      actorUserId: "usr-super",
      userId: createdUser.id,
      payload: {
        email: "derry.ketua@pa.go.id",
        positionId: "pos-ketua",
        whatsappNumber: "628123457777",
        name: "Derry Ketua",
        nip: "199001012026041002",
        username: "derryketua",
      },
    });

    expect(updatedUser.email).toBe("derry.ketua@pa.go.id");
    expect(updatedUser.positionId).toBe("pos-ketua");
    expect(updatedUser.roleId).toBe("ketua");

    const recoveryDraft = await createPasswordRecoveryDraftInDb(db!, { identifier: "199001012026041002" });
    await confirmPasswordRecoveryInDb(db!, {
      userId: recoveryDraft.userId,
      otp: recoveryDraft.otp,
      password: "ketua456A1",
    });

    const updatedAccountRow = await db!.prepare(
      `SELECT account_id, password
       FROM accounts
       WHERE user_id = ? AND provider_id = 'credential'`
    ).get<{ account_id: string; password: string }>(createdUser.id);
    expect(updatedAccountRow?.account_id).toBe("derry.ketua@pa.go.id");
    expect(updatedAccountRow?.password).toBeTruthy();
    expect(updatedAccountRow?.password).not.toBe("ketua456");
  });

  it("enforces admin-level RBAC: admin cannot create super-admin, super-admin can promote", async () => {
    // Admin trying to create a super-admin → must throw 403
    await expect(
      createManagedUserInDb(db!, "usr-admin", {
        username: "new-super",
        password: "Password1",
        email: "new-super@pa.go.id",
        whatsappNumber: "628123451111",
        name: "New Super",
        nip: "199001012026041099",
        positionId: "pos-pranata-komputer",
        roleOverride: "super-admin",
      })
    ).rejects.toThrow();

    // Admin can create a regular admin
    const newAdmin = await createManagedUserInDb(db!, "usr-admin", {
      username: "new-admin",
      password: "Password1",
      email: "new-admin@pa.go.id",
      whatsappNumber: "628123452222",
      name: "New Admin",
      nip: "199001012026041098",
      positionId: "pos-pranata-komputer",
      roleOverride: "admin",
    });
    expect(newAdmin.roleId).toBe("admin");

    // Super-admin can create a super-admin
    const newSuper = await createManagedUserInDb(db!, "usr-super", {
      username: "new-super2",
      password: "Password1",
      email: "new-super2@pa.go.id",
      whatsappNumber: "628123453333",
      name: "New Super2",
      nip: "199001012026041097",
      positionId: "pos-pranata-komputer",
      roleOverride: "super-admin",
    });
    expect(newSuper.roleId).toBe("super-admin");

    // Super-admin can promote a regular user to admin
    const plainUser = await createManagedUserInDb(db!, "usr-super", {
      username: "plain-user",
      password: "Password1",
      email: "plain@pa.go.id",
      whatsappNumber: "628123454444",
      name: "Plain User",
      nip: "199001012026041096",
      positionId: "pos-staf-umum",
    });
    expect(plainUser.roleId).toBe("staf");

    const promoted = await updateManagedUserInDb(db!, {
      actorUserId: "usr-super",
      userId: plainUser.id,
      payload: { roleOverride: "admin" },
    });
    expect(promoted.roleId).toBe("admin");

    // Admin cannot update a super-admin → must throw 403
    await expect(
      updateManagedUserInDb(db!, {
        actorUserId: "usr-admin",
        userId: "usr-super",
        payload: { name: "Tampered Name" },
      })
    ).rejects.toThrow();
  });

  it("prevents blocking or demoting the last active super-admin", async () => {
    // There is exactly 1 active super-admin (usr-super) in the seed.
    // Trying to block them must throw.
    await expect(
      updateManagedUserInDb(db!, {
        actorUserId: "usr-super",
        userId: "usr-super",
        payload: { isActive: false },
      })
    ).rejects.toThrow(); // self-deactivation already blocked

    // Create a second super-admin so we can test role demotion
    const secondSuper = await createManagedUserInDb(db!, "usr-super", {
      username: "second-super",
      password: "Password1",
      email: "second-super@pa.go.id",
      whatsappNumber: "628123455555",
      name: "Second Super",
      nip: "199001012026041095",
      positionId: "pos-pranata-komputer",
      roleOverride: "super-admin",
    });
    expect(secondSuper.roleId).toBe("super-admin");

    // Now demoting the first super-admin to admin is OK (second still exists)
    const demoted = await updateManagedUserInDb(db!, {
      actorUserId: secondSuper.id,
      userId: "usr-super",
      payload: { roleOverride: null },
    });
    expect(demoted.roleId).not.toBe("super-admin");

    // Trying to demote the last remaining super-admin must throw
    await expect(
      updateManagedUserInDb(db!, {
        actorUserId: secondSuper.id,
        userId: secondSuper.id,
        payload: { roleOverride: null },
      })
    ).rejects.toThrow();
  });
});
