// @vitest-environment node
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import { ApiError } from "@/server/shared/errors";
import { getAISettingsFromDb, testAIProviderConnectionInDb, upsertAISettingsInDb } from "@/server/modules/ai/service";
import { CLAUDE_MODEL_UJI, normalizeClaudeModel } from "@/server/modules/ai/provider-client";
import {
  pilihKoneksiClaudeAletaAi,
  sidikKunci,
  tentukanSumberKunciAletaAi,
  type KoneksiKandidat,
} from "@/server/modules/ai/kunci-claude";
import { ambilKlienAi, kunciApiTerpasang, lupakanKlienAi, statusKunciAi, suntikKlienAi } from "@/server/modules/aleta-ai/klien";
import { tampilPengaturan } from "@/server/modules/aleta-ai/layanan";

/**
 * Kunci Claude untuk ALETA Ai diambil dari Pengaturan AI (27 Okt):
 * pilihan modul > koneksi Claude tersimpan pertama > env ANTHROPIC_API_KEY.
 * Kunci di bawah ini RAKITAN uji, bukan kunci sungguhan.
 */

const K1 = "sk-ant-uji-satu-RAHASIA-1111111111";
const K2 = "sk-ant-uji-dua-RAHASIA-2222222222";
const K_ENV = "sk-ant-uji-env-RAHASIA-3333333333";
const K_GEMINI = "gemini-uji-RAHASIA-4444444444";

const kandidat = (id: string, o: Partial<KoneksiKandidat> = {}): KoneksiKandidat => ({
  id,
  name: `Koneksi ${id}`,
  providerId: "claude",
  punyaKunci: true,
  isActive: false,
  connectionStatus: "idle",
  ...o,
});

describe("pemilihan koneksi Claude untuk ALETA Ai (murni)", () => {
  it("hanya provider Claude yang berkunci yang layak; global non-Claude tak pernah dipakai", () => {
    const hasil = pilihKoneksiClaudeAletaAi({
      koneksi: [kandidat("g", { providerId: "gemini", isActive: true }), kandidat("c-kosong", { punyaKunci: false })],
    });
    expect(hasil.koneksi).toBeNull();
  });

  it("pilihan modul mengalahkan urutan otomatis", () => {
    const koneksi = [kandidat("a", { isActive: true }), kandidat("b"), kandidat("c")];
    expect(pilihKoneksiClaudeAletaAi({ pilihanModulId: "c", koneksi })).toMatchObject({ koneksi: { id: "c" }, dipilihKhusus: true });
    expect(pilihKoneksiClaudeAletaAi({ koneksi })).toMatchObject({ koneksi: { id: "a" }, dipilihKhusus: false });
  });

  it("pilihan modul yang bukan Claude/terhapus diabaikan -> otomatis", () => {
    const koneksi = [kandidat("g", { providerId: "gemini" }), kandidat("b")];
    expect(pilihKoneksiClaudeAletaAi({ pilihanModulId: "g", koneksi }).koneksi?.id).toBe("b");
    expect(pilihKoneksiClaudeAletaAi({ pilihanModulId: "hilang", koneksi }).koneksi?.id).toBe("b");
  });

  it("otomatis: aktif > terhubung > belum diuji > gagal; urutan asli menentukan sisanya", () => {
    const koneksi = [
      kandidat("gagal", { connectionStatus: "failed" }),
      kandidat("idle1"),
      kandidat("ok", { connectionStatus: "connected" }),
      kandidat("idle2"),
    ];
    expect(pilihKoneksiClaudeAletaAi({ koneksi }).koneksi?.id).toBe("ok");
    expect(pilihKoneksiClaudeAletaAi({ koneksi: [koneksi[0], koneksi[1], koneksi[3]] }).koneksi?.id).toBe("idle1");
    expect(pilihKoneksiClaudeAletaAi({ koneksi: [koneksi[0]] }).koneksi?.id).toBe("gagal");
    expect(pilihKoneksiClaudeAletaAi({ koneksi: [...koneksi, kandidat("aktif", { isActive: true })] }).koneksi?.id).toBe("aktif");
  });

  it("sidik kunci stabil, pendek, dan tidak memuat kuncinya", () => {
    expect(sidikKunci(K1)).toBe(sidikKunci(K1));
    expect(sidikKunci(K1)).not.toBe(sidikKunci(K2));
    expect(sidikKunci(K1)).toHaveLength(16);
    expect(sidikKunci(K1)).not.toContain("RAHASIA");
  });
});

describe("pemetaan model Claude (uji koneksi)", () => {
  it("nama katalog dan label lama dipetakan ke model terkini; id lengkap dipakai apa adanya", () => {
    expect(normalizeClaudeModel("Claude Opus 5.5")).toBe("claude-opus-5-5");
    expect(normalizeClaudeModel("Claude Sonnet 5.5")).toBe("claude-sonnet-5-5");
    expect(normalizeClaudeModel("Claude Haiku 5.5")).toBe("claude-haiku-5-5");
    expect(normalizeClaudeModel("Claude Sonnet 4")).toBe("claude-sonnet-5-5");
    expect(normalizeClaudeModel("Claude Haiku 3.5")).toBe("claude-haiku-5-5");
    expect(normalizeClaudeModel("claude-opus-5-5")).toBe("claude-opus-5-5");
    expect(CLAUDE_MODEL_UJI).toBe("claude-haiku-5-5");
  });
});

describe("kunci Claude ALETA Ai dari Pengaturan AI (pg-mem)", () => {
  let db: AletaDatabase;
  const envAwal = process.env.ANTHROPIC_API_KEY;

  const simpanKoneksi = async (providerId: string, label: string, apiKey: string, modelId: string) => {
    const hasil = await upsertAISettingsInDb(db, { actorUserId: "usr-super", connection: { providerId, label, modelId, apiKey } });
    return hasil.providers.find((p) => p.name === label)!;
  };
  const modulAletaAi = async () => (await getAISettingsFromDb(db)).moduleConfigs.find((m) => m.moduleKey === "aleta_ai")!;

  beforeAll(async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: true });
  }, 180000);

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  afterAll(async () => {
    if (envAwal === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = envAwal;
    suntikKlienAi(undefined);
    lupakanKlienAi();
    await db?.close();
  });

  it("tanpa kunci di mana pun: status 'belum ada', klien null, modul 'belum_ada'", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    suntikKlienAi(undefined);
    lupakanKlienAi();
    expect(await tentukanSumberKunciAletaAi(db)).toEqual({ sumber: "belum" });
    expect(await kunciApiTerpasang(db)).toBe(false);
    expect(await statusKunciAi(db)).toEqual({ sumber: "belum" });
    expect(await ambilKlienAi(db)).toBeNull();
    const modul = await modulAletaAi();
    expect(modul).toMatchObject({ status: "belum_ada", onlyProviderId: "claude", label: "ALETA Ai" });
    expect(modul.catatan).toContain("dipilih otomatis oleh tabel rute");
    expect(modul.activeConnectionId).toBeNull();
  });

  it("env tetap berlaku bila Pengaturan AI belum punya koneksi Claude (perilaku lama)", async () => {
    process.env.ANTHROPIC_API_KEY = K_ENV;
    expect(await tentukanSumberKunciAletaAi(db)).toMatchObject({ sumber: "env", kunci: K_ENV });
    expect(await statusKunciAi(db)).toEqual({ sumber: "env" });
    expect(await ambilKlienAi(db)).not.toBeNull();
  });

  it("koneksi global non-Claude (Gemini) tidak pernah dipakai", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const gemini = await simpanKoneksi("gemini", "Gemini Uji", K_GEMINI, "Gemini 2.5 Flash");
    const global = await upsertAISettingsInDb(db, { actorUserId: "usr-super", activeConnectionId: gemini.id });
    expect(global.providerId).toBe("gemini");
    expect(await tentukanSumberKunciAletaAi(db)).toEqual({ sumber: "belum" });
    expect(await ambilKlienAi(db)).toBeNull();
    expect((await modulAletaAi()).status).toBe("belum_ada");
  });

  it("modul ALETA Ai menolak koneksi non-Claude di server", async () => {
    const gemini = (await getAISettingsFromDb(db)).providers.find((p) => p.providerId === "gemini")!;
    await expect(
      upsertAISettingsInDb(db, {
        actorUserId: "usr-super",
        moduleConfigs: [{ moduleKey: "aleta_ai", inheritGlobal: false, activeConnectionId: gemini.id }],
      })
    ).rejects.toThrow("ALETA Ai hanya memakai Claude");
    await expect(
      upsertAISettingsInDb(db, {
        actorUserId: "usr-super",
        moduleConfigs: [{ moduleKey: "aleta_ai", inheritGlobal: false, activeConnectionId: gemini.id }],
      })
    ).rejects.toBeInstanceOf(ApiError);
    expect((await modulAletaAi()).status).toBe("belum_ada");
  });

  it("koneksi Claude tersimpan pertama dipakai otomatis; klien di-cache selama kunci sama", async () => {
    process.env.ANTHROPIC_API_KEY = K_ENV; // env kalah dari Pengaturan AI
    const c1 = await simpanKoneksi("claude", "Claude Utama", K1, "Claude Sonnet 5.5");
    const sumber = await tentukanSumberKunciAletaAi(db);
    expect(sumber).toMatchObject({ sumber: "pengaturan-ai", kunci: K1, koneksiId: c1.id, namaKoneksi: "Claude Utama", dipilihKhusus: false });
    expect(await statusKunciAi(db)).toEqual({ sumber: "pengaturan-ai", namaKoneksi: "Claude Utama" });
    const a = await ambilKlienAi(db);
    expect(a).not.toBeNull();
    expect(await ambilKlienAi(db)).toBe(a);
    const modul = await modulAletaAi();
    expect(modul).toMatchObject({ status: "otomatis", activeConnectionId: c1.id, inheritGlobal: true });
  });

  it("pilihan modul mengalahkan koneksi pertama; klien diganti saat kunci berubah tanpa memulai ulang", async () => {
    const sebelum = await ambilKlienAi(db);
    const c2 = await simpanKoneksi("claude", "Claude Kedua", K2, "Claude Opus 5.5");
    const hasil = await upsertAISettingsInDb(db, {
      actorUserId: "usr-super",
      moduleConfigs: [{ moduleKey: "aleta_ai", inheritGlobal: false, activeConnectionId: c2.id }],
    });
    const modul = hasil.moduleConfigs.find((m) => m.moduleKey === "aleta_ai")!;
    expect(modul).toMatchObject({ status: "custom", configuredConnectionId: c2.id, inheritGlobal: false });
    const sumber = await tentukanSumberKunciAletaAi(db);
    expect(sumber).toMatchObject({ sumber: "pengaturan-ai", kunci: K2, namaKoneksi: "Claude Kedua", dipilihKhusus: true });
    const sesudah = await ambilKlienAi(db);
    expect(sesudah).not.toBeNull();
    expect(sesudah).not.toBe(sebelum);
    expect(await ambilKlienAi(db)).toBe(sesudah);

    // Mengganti kunci koneksi yang sama (edit) -> klien dibuat ulang lagi.
    await upsertAISettingsInDb(db, {
      actorUserId: "usr-super",
      connection: { id: c2.id, providerId: "claude", label: "Claude Kedua", modelId: "Claude Opus 5.5", apiKey: "sk-ant-uji-dua-BARU-9999999999" },
    });
    const baru = await ambilKlienAi(db);
    expect(baru).not.toBe(sesudah);
  });

  it("menghapus koneksi pilihan -> kembali otomatis ke koneksi Claude pertama", async () => {
    const claudeKedua = (await getAISettingsFromDb(db)).providers.find((p) => p.name === "Claude Kedua")!;
    await upsertAISettingsInDb(db, { actorUserId: "usr-super", deleteConnectionId: claudeKedua.id });
    const sumber = await tentukanSumberKunciAletaAi(db);
    expect(sumber).toMatchObject({ sumber: "pengaturan-ai", kunci: K1, dipilihKhusus: false });
    expect((await modulAletaAi()).status).toBe("otomatis");
  });

  it("hanya Super Admin yang dapat memilih atau menyimpan", async () => {
    const claude = (await getAISettingsFromDb(db)).providers.find((p) => p.name === "Claude Utama")!;
    await expect(
      upsertAISettingsInDb(db, {
        actorUserId: "usr-dina",
        moduleConfigs: [{ moduleKey: "aleta_ai", inheritGlobal: false, activeConnectionId: claude.id }],
      })
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      upsertAISettingsInDb(db, {
        actorUserId: "usr-dina",
        connection: { providerId: "claude", label: "Curang", modelId: "Claude Sonnet 5.5", apiKey: "sk-ant-curang-0000000000" },
      })
    ).rejects.toMatchObject({ status: 403 });
  });

  it("kunci tidak pernah muncul di respons pengaturan (Pengaturan AI maupun ALETA Ai)", async () => {
    const klienPengaturan = JSON.stringify(await getAISettingsFromDb(db));
    const hasilSimpan = JSON.stringify(
      await upsertAISettingsInDb(db, { actorUserId: "usr-super", moduleConfigs: [{ moduleKey: "aleta_ai", inheritGlobal: true }] })
    );
    const pengaturanAleta = JSON.stringify(await tampilPengaturan(db));
    for (const teks of [klienPengaturan, hasilSimpan, pengaturanAleta]) {
      for (const rahasia of [K1, K2, K_ENV, K_GEMINI, "RAHASIA"]) expect(teks).not.toContain(rahasia);
    }
    const aleta = JSON.parse(pengaturanAleta) as { kunciTerpasang: boolean; kunciClaude: { sumber: string; namaKoneksi?: string } };
    expect(aleta.kunciTerpasang).toBe(true);
    expect(aleta.kunciClaude).toEqual({ sumber: "pengaturan-ai", namaKoneksi: "Claude Utama" });
    expect(Object.keys(aleta.kunciClaude).sort()).toEqual(["namaKoneksi", "sumber"]);
  });

  it("uji koneksi Claude: model termurah, tanpa temperature, kunci hanya di header dan tidak bocor ke hasil/jejak", async () => {
    const permintaan: Array<{ url: string; headers: Record<string, string>; body: Record<string, unknown> }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL, init?: RequestInit) => {
        permintaan.push({
          url: String(input),
          headers: (init?.headers ?? {}) as Record<string, string>,
          body: JSON.parse(String(init?.body ?? "{}")),
        });
        return new Response(JSON.stringify({ content: [{ type: "text", text: "OK" }] }), { status: 200, headers: { "content-type": "application/json" } });
      }) as typeof fetch
    );
    const claude = (await getAISettingsFromDb(db)).providers.find((p) => p.name === "Claude Utama")!;
    const hasil = await testAIProviderConnectionInDb(db, { actorUserId: "usr-super", connectionId: claude.id });

    expect(hasil.status).toBe("connected");
    expect(permintaan).toHaveLength(1);
    expect(permintaan[0].url).toContain("api.anthropic.com/v1/messages");
    expect(permintaan[0].body.model).toBe("claude-haiku-5-5");
    expect(permintaan[0].body).not.toHaveProperty("temperature");
    expect(permintaan[0].headers["x-api-key"]).toBe(K1);
    expect(JSON.stringify(hasil)).not.toContain(K1);

    const audit = await db.prepare("SELECT payload_json FROM audit_logs WHERE action = 'TEST_AI_PROVIDER_CONNECTION'").all<{ payload_json: unknown }>();
    expect(audit.length).toBeGreaterThan(0);
    expect(JSON.stringify(audit)).not.toContain(K1);
    const semuaAudit = await db.prepare("SELECT payload_json FROM audit_logs").all<{ payload_json: unknown }>();
    expect(JSON.stringify(semuaAudit)).not.toContain("RAHASIA");
  });

  it("uji koneksi Claude yang ditolak: pesan galat tidak memuat kunci", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: { message: `invalid x-api-key ${K1}` } }), { status: 401, headers: { "content-type": "application/json" } })) as typeof fetch
    );
    const claude = (await getAISettingsFromDb(db)).providers.find((p) => p.name === "Claude Utama")!;
    const hasil = await testAIProviderConnectionInDb(db, { actorUserId: "usr-super", connectionId: claude.id });
    expect(hasil.status).toBe("failed");
    expect(JSON.stringify(hasil)).not.toContain(K1);
    const ringkas = JSON.stringify(await getAISettingsFromDb(db));
    expect(ringkas).not.toContain(K1);
  });

  it("klien suntikan (uji) tetap menang atas sumber kunci mana pun", async () => {
    const tiruan = { alirkan: async () => Promise.reject(new Error("x")) };
    suntikKlienAi(tiruan);
    expect(await ambilKlienAi(db)).toBe(tiruan);
    suntikKlienAi(null);
    expect(await ambilKlienAi(db)).toBeNull();
    suntikKlienAi(undefined);
  });
});
