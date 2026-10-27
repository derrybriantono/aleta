// @vitest-environment node
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import { ApiError } from "@/server/shared/errors";
import { getAISettingsFromDb, testAIProviderConnectionInDb, upsertAISettingsInDb } from "@/server/modules/ai/service";
import { tentukanSumberKunciAletaAi } from "@/server/modules/ai/kunci-claude";
import {
  AWALAN_KUNCI_API,
  KunciTakTerbacaError,
  PESAN_KUNCI_TAK_TERBACA,
  bacaKunciApiAman,
  bungkusUlangKunciPolos,
  dekripsiKunciApi,
  enkripsiKunciApi,
  kunciApiTerenkripsi,
  setRahasiaUntukUji,
  setelUlangPeringatanKunciApi,
} from "@/server/modules/ai/kunci-tersimpan";
import { statusKunciAi } from "@/server/modules/aleta-ai/klien";
import { maskApiKey } from "@/server/shared/security";

/**
 * Kunci API Pengaturan AI tersimpan terenkripsi (AES-256-GCM, kunci HKDF dari BETTER_AUTH_SECRET).
 * Kunci di bawah RAKITAN uji, bukan kunci sungguhan.
 */

const RAHASIA_A = "rahasia-server-uji-A-0123456789abcdef";
const RAHASIA_B = "rahasia-server-uji-B-fedcba9876543210";
const KUNCI = "sk-ant-uji-ENKRIPSI-1234567890abcd";
const KUNCI_LAMA = "sk-ant-uji-POLOS-LAMA-0987654321zz";

const envAwal = { anthropic: process.env.ANTHROPIC_API_KEY };

/** null = rahasia server tidak ada (tanpa menyentuh NODE_ENV: itu memicu penulisan salinan basis data ke disk). */
function setRahasia(nilai: string | null) {
  setRahasiaUntukUji(nilai);
}

afterAll(() => {
  setRahasiaUntukUji(undefined);
  if (envAwal.anthropic === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = envAwal.anthropic;
});

describe("enkripsi kunci API (murni)", () => {
  beforeEach(() => {
    setRahasia(RAHASIA_A);
    setelUlangPeringatanKunciApi();
  });
  afterEach(() => vi.restoreAllMocks());

  it("bolak-balik: terenkripsi berawalan penanda, tidak memuat kunci, acak tiap kali, kembali persis", () => {
    const a = enkripsiKunciApi(KUNCI);
    const b = enkripsiKunciApi(KUNCI);
    expect(a.startsWith(AWALAN_KUNCI_API)).toBe(true);
    expect(kunciApiTerenkripsi(a)).toBe(true);
    expect(a).not.toContain(KUNCI);
    expect(a).not.toContain("ENKRIPSI");
    expect(a).not.toBe(b);
    expect(dekripsiKunciApi(a)).toBe(KUNCI);
    expect(dekripsiKunciApi(b)).toBe(KUNCI);
  });

  it("kosong tetap kosong; yang sudah terenkripsi tidak dienkripsi dua kali", () => {
    expect(enkripsiKunciApi("")).toBe("");
    const a = enkripsiKunciApi(KUNCI);
    expect(enkripsiKunciApi(a)).toBe(a);
  });

  it("nilai polos lama tetap terbaca apa adanya (kompatibel mundur)", () => {
    expect(dekripsiKunciApi(KUNCI_LAMA)).toBe(KUNCI_LAMA);
    expect(bacaKunciApiAman(KUNCI_LAMA)).toEqual({ kunci: KUNCI_LAMA, tidakTerbaca: false });
    expect(bacaKunciApiAman("")).toEqual({ kunci: "", tidakTerbaca: false });
    expect(bacaKunciApiAman(null)).toEqual({ kunci: "", tidakTerbaca: false });
  });

  it("rahasia berganti: galat jelas tanpa kunci, bukan kunci kosong diam-diam", () => {
    const a = enkripsiKunciApi(KUNCI);
    setRahasia(RAHASIA_B);
    expect(() => dekripsiKunciApi(a)).toThrow(KunciTakTerbacaError);
    try {
      dekripsiKunciApi(a);
    } catch (e) {
      expect((e as Error).message).toBe(PESAN_KUNCI_TAK_TERBACA);
      expect((e as Error).message).not.toContain(KUNCI);
    }
    expect(bacaKunciApiAman(a)).toEqual({ kunci: "", tidakTerbaca: true });
  });

  it("nilai terenkripsi rusak/terpotong: galat jelas", () => {
    const a = enkripsiKunciApi(KUNCI);
    expect(() => dekripsiKunciApi(a.slice(0, -6))).toThrow(KunciTakTerbacaError);
    expect(() => dekripsiKunciApi(`${AWALAN_KUNCI_API}x`)).toThrow(KunciTakTerbacaError);
  });

  it("rahasia tidak ada: simpan polos + satu peringatan; nilai terenkripsi lama jadi tak terbaca (tidak dihapus)", () => {
    const a = enkripsiKunciApi(KUNCI);
    setRahasia(null);
    const aman = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(enkripsiKunciApi(KUNCI)).toBe(KUNCI);
    expect(enkripsiKunciApi(KUNCI_LAMA)).toBe(KUNCI_LAMA);
    expect(aman).toHaveBeenCalledTimes(1);
    expect(String(aman.mock.calls[0][0])).not.toContain(KUNCI);
    expect(() => dekripsiKunciApi(a)).toThrow(KunciTakTerbacaError);
    // nilainya sendiri tetap utuh dan terbuka lagi begitu rahasia kembali
    setRahasia(RAHASIA_A);
    expect(dekripsiKunciApi(a)).toBe(KUNCI);
  });

  it("hanya 4 huruf terakhir yang terlihat pada petunjuk kunci", () => {
    expect(maskApiKey(KUNCI)).toBe(`••••${KUNCI.slice(-4)}`);
    expect(maskApiKey("pendek")).toBe("••••");
    expect(maskApiKey("")).toBe("");
    expect(maskApiKey(KUNCI)).not.toContain("sk-a");
  });
});

describe("Pengaturan AI atas basis data (pg-mem)", () => {
  let db: AletaDatabase;

  const simpan = async (providerId: string, label: string, apiKey: string, modelId: string) => {
    const hasil = await upsertAISettingsInDb(db, { actorUserId: "usr-super", connection: { providerId, label, modelId, apiKey } });
    return hasil.providers.find((p) => p.name === label)!;
  };
  const mentah = async (id: string) =>
    (await db.prepare(`SELECT api_key, masked_api_key FROM ai_providers WHERE id = ?`).get<{ api_key: string; masked_api_key: string }>(id))!;

  beforeAll(async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: true });
  }, 180000);

  beforeEach(() => {
    setRahasia(RAHASIA_A);
    setelUlangPeringatanKunciApi();
    delete process.env.ANTHROPIC_API_KEY;
  });

  afterAll(async () => {
    await db?.close();
  });

  it("simpan: kolom berisi sandi (bukan kunci); dibaca-dalam (includeSecrets) kembali persis; respons peramban tanpa kunci", async () => {
    const k = await simpan("claude", "Claude Enkripsi", KUNCI, "Claude Sonnet");
    const baris = await mentah(k.id);
    expect(baris.api_key.startsWith(AWALAN_KUNCI_API)).toBe(true);
    expect(baris.api_key).not.toContain("ENKRIPSI");
    expect(baris.masked_api_key).toBe(`••••${KUNCI.slice(-4)}`);

    // respons simpan + GET biasa: tidak pernah kunci utuh, hanya petunjuk 4 huruf terakhir
    const respons = JSON.stringify(await getAISettingsFromDb(db));
    expect(respons).not.toContain(KUNCI);
    expect(respons).not.toContain("ENKRIPSI");
    expect(respons).not.toContain(AWALAN_KUNCI_API);
    expect(k.apiKey).toBe("");
    expect(k.maskedApiKey).toBe(`••••${KUNCI.slice(-4)}`);

    const dalam = (await getAISettingsFromDb(db, { includeSecrets: true })).providers.find((p) => p.id === k.id);
    expect(dalam?.apiKey).toBe(KUNCI);
    expect(dalam?.apiKeyTakTerbaca).toBeUndefined();
  });

  it("nilai polos lama: terbaca, dan dienkripsi ulang secara malas saat dibaca", async () => {
    const k = await simpan("claude", "Claude Polos Lama", KUNCI, "Claude Sonnet");
    // meniru baris lama: kunci polos + petunjuk lama (4 huruf awal)
    await db.prepare(`UPDATE ai_providers SET api_key = ?, masked_api_key = ? WHERE id = ?`).run(KUNCI_LAMA, "sk-a••••zz", k.id);
    expect((await mentah(k.id)).api_key).toBe(KUNCI_LAMA);

    // GET biasa pun tidak membocorkan: petunjuk dihitung ulang dari kunci
    const biasa = (await getAISettingsFromDb(db)).providers.find((p) => p.id === k.id)!;
    expect(biasa.apiKey).toBe("");
    expect(biasa.maskedApiKey).toBe(`••••${KUNCI_LAMA.slice(-4)}`);

    // pembacaan di atas sudah membungkus ulang
    const sesudah = await mentah(k.id);
    expect(sesudah.api_key.startsWith(AWALAN_KUNCI_API)).toBe(true);
    expect(sesudah.api_key).not.toContain("POLOS");
    expect(sesudah.masked_api_key).toBe(`••••${KUNCI_LAMA.slice(-4)}`);
    const dalam = (await getAISettingsFromDb(db, { includeSecrets: true })).providers.find((p) => p.id === k.id);
    expect(dalam?.apiKey).toBe(KUNCI_LAMA);
  });

  it("memperbarui koneksi tanpa mengisi kunci baru mempertahankan kunci lama (tetap terenkripsi)", async () => {
    const k = await simpan("claude", "Claude Ubah Label", KUNCI, "Claude Sonnet");
    await upsertAISettingsInDb(db, { actorUserId: "usr-super", connection: { id: k.id, providerId: "claude", label: "Claude Label Baru", modelId: "Claude Sonnet" } });
    const baris = await mentah(k.id);
    expect(baris.api_key.startsWith(AWALAN_KUNCI_API)).toBe(true);
    const dalam = (await getAISettingsFromDb(db, { includeSecrets: true })).providers.find((p) => p.id === k.id);
    expect(dalam).toMatchObject({ name: "Claude Label Baru", apiKey: KUNCI });
  });

  it("rahasia berganti: koneksi ditandai gagal + keterangan jelas, tidak ada kunci kosong diam-diam; simpan tanpa kunci baru ditolak; isi ulang memulihkan", async () => {
    const k = await simpan("claude", "Claude Rahasia Berganti", KUNCI, "Claude Sonnet");
    const sandi = (await mentah(k.id)).api_key;
    setRahasia(RAHASIA_B);

    const daftar = await getAISettingsFromDb(db, { includeSecrets: true });
    const rusak = daftar.providers.find((p) => p.id === k.id)!;
    expect(rusak.apiKeyTakTerbaca).toBe(true);
    expect(rusak.apiKey).toBe("");
    expect(rusak.connectionStatus).toBe("failed");
    expect(rusak.lastConnectionMessage).toBe(PESAN_KUNCI_TAK_TERBACA);
    // barisnya sendiri tidak disentuh (tidak dihapus, tidak ditimpa)
    expect((await mentah(k.id)).api_key).toBe(sandi);

    await expect(
      upsertAISettingsInDb(db, { actorUserId: "usr-super", connection: { id: k.id, providerId: "claude", label: "Claude Rahasia Berganti", modelId: "Claude Sonnet" } })
    ).rejects.toMatchObject({ status: 409, message: PESAN_KUNCI_TAK_TERBACA });
    await expect(testAIProviderConnectionInDb(db, { actorUserId: "usr-super", connectionId: k.id })).rejects.toBeInstanceOf(ApiError);

    // sumber kunci ALETA Ai: tidak ada kunci, alasannya jelas
    expect(await tentukanSumberKunciAletaAi(db)).toMatchObject({ sumber: "belum", alasan: PESAN_KUNCI_TAK_TERBACA });
    expect(await statusKunciAi(db)).toMatchObject({ sumber: "belum", alasan: PESAN_KUNCI_TAK_TERBACA });

    // isi ulang kunci -> pulih, kini terenkripsi dengan rahasia baru
    await upsertAISettingsInDb(db, { actorUserId: "usr-super", connection: { id: k.id, providerId: "claude", label: "Claude Rahasia Berganti", modelId: "Claude Sonnet", apiKey: KUNCI_LAMA } });
    const pulih = (await getAISettingsFromDb(db, { includeSecrets: true })).providers.find((p) => p.id === k.id)!;
    expect(pulih.apiKeyTakTerbaca).toBeUndefined();
    expect(pulih.apiKey).toBe(KUNCI_LAMA);
    // hapus supaya uji lain tidak terganggu koneksi yang berstatus lain
    await upsertAISettingsInDb(db, { actorUserId: "usr-super", deleteConnectionId: k.id });
  });

  it("sumber kunci Claude ALETA Ai membuka kunci terenkripsi", async () => {
    const k = await simpan("claude", "Claude Sumber Kunci", KUNCI, "Claude Sonnet");
    const sumber = await tentukanSumberKunciAletaAi(db);
    expect(sumber).toMatchObject({ sumber: "pengaturan-ai", kunci: KUNCI });
    await upsertAISettingsInDb(db, { actorUserId: "usr-super", deleteConnectionId: k.id });
  });

  it("tanpa rahasia server: disimpan polos + peringatan, tetap terbaca, dan tidak pernah melempar", async () => {
    setRahasia(null);
    const aman = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const k = await simpan("claude", "Claude Tanpa Rahasia", KUNCI, "Claude Sonnet");
    expect((await mentah(k.id)).api_key).toBe(KUNCI);
    expect(aman).toHaveBeenCalled();
    const dalam = (await getAISettingsFromDb(db, { includeSecrets: true })).providers.find((p) => p.id === k.id);
    expect(dalam?.apiKey).toBe(KUNCI);
    // begitu rahasia ada, baris polos itu terbungkus pada pembacaan berikutnya
    setRahasia(RAHASIA_A);
    await getAISettingsFromDb(db);
    expect((await mentah(k.id)).api_key.startsWith(AWALAN_KUNCI_API)).toBe(true);
    vi.restoreAllMocks();
  });

  it("bungkusUlangKunciPolos: tidak menimpa baris yang kuncinya berubah di antara baca dan tulis", async () => {
    const k = await simpan("claude", "Claude Balapan", KUNCI, "Claude Sonnet");
    await db.prepare(`UPDATE ai_providers SET api_key = ? WHERE id = ?`).run(KUNCI_LAMA, k.id);
    // pembaca memegang nilai yang sudah usang
    const jumlah = await bungkusUlangKunciPolos(db, [{ id: k.id, api_key: "kunci-usang-yang-sudah-diganti" }]);
    expect(jumlah).toBe(0);
    expect((await mentah(k.id)).api_key).toBe(KUNCI_LAMA);
  });

  it("route GET Pengaturan AI tidak meminta rahasia", async () => {
    const { readFileSync } = await import("node:fs");
    const path = await import("node:path");
    const teks = readFileSync(path.join(process.cwd(), "src/app/api/ai/settings/route.ts"), "utf8");
    expect(teks).not.toContain("includeSecrets");
  });
});
