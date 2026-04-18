// @vitest-environment node

import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { users as usersTable } from "@/server/db/drizzle-schema";
import { type AletaDatabase, createAletaDatabase } from "@/server/db/client";
import { ApiError } from "@/server/shared/errors";
import { stringifyJson } from "@/server/shared/json";
import {
  extractSuratDraftInDb,
  suggestDispositionInDb,
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
        const responseText = prompt.includes("summary, suggestedInstruction, suggestedTargetLabel")
          ? stringifyJson({
              summary: "Audit keamanan aplikasi internal.",
              suggestedInstruction:
                "Telaah hasil audit keamanan, tetapkan PIC TI, dan laporkan progres perbaikan secara singkat.",
              suggestedTargetLabel: "Pranata Komputer",
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
    expect(result.initialDisposition?.status).toBe("Riwayat Awal Disposisi");

    const timeline = await getDispositionsByLetterIdFromDb(db!, result.letter.id);
    expect(timeline).toHaveLength(1);
    expect(timeline[0]?.status).toBe("Riwayat Awal Disposisi");
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

  it("stores dynamic AI provider settings and uses database regulations for AI drafts", async () => {
    const connection = await testAIProviderConnectionInDb(db!, {
      actorUserId: "usr-super",
      providerId: "gemini",
      apiKey: "1234567890-valid-key",
    });
    expect(connection.status).toBe("connected");

    const settings = await upsertAISettingsInDb(db!, {
      actorUserId: "usr-super",
      enabled: true,
      providerId: "gemini",
      modelId: "Gemini 2.5 Pro",
      primaryLanguage: "id",
      provider: {
        id: "gemini",
        apiKey: "1234567890-valid-key",
        models: ["Gemini 2.5 Pro"],
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

    const suggestion = await suggestDispositionInDb(db!, {
      actorUserId: "usr-ketua",
      letterSubject: "Audit keamanan aplikasi internal",
      letterSummary: "Audit keamanan aplikasi internal, backup, enkripsi, dan penetapan PIC TI.",
      currentInstruction: "",
      targetOptions: [
        { id: "pos-pranata-komputer", label: "Pranata Komputer" },
        { id: "pos-kasubag-umum", label: "Kasubag Umum dan Keuangan" },
      ],
    });

    expect(suggestion.verifyBeforeSave).toBe(true);
    expect(suggestion.suggestion.relatedRegulations.length).toBeGreaterThan(0);
    expect(suggestion.suggestion.suggestedInstruction.length).toBeGreaterThan(10);
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
      .where(eq(usersTable.email, "rahmawati@pa.go.id"))
      .limit(1);

    expect(matchedUsers[0]?.username).toBe("superadmin");
    expect(matchedUsers[0]?.email).toBe("rahmawati@pa.go.id");
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

    const recoveryDraft = await createPasswordRecoveryDraftInDb(db!, "199001012026041002");
    await confirmPasswordRecoveryInDb(db!, {
      userId: recoveryDraft.userId,
      otp: recoveryDraft.otp,
      password: "ketua456",
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
});
