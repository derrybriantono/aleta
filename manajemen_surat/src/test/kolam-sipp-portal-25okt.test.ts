// @vitest-environment node
/**
 * Kolam SIPP, sisi portal (K3, rantai F1, 25 Okt 2026).
 *
 *   A. kembaran portal dan bot menghasilkan nilai yang sama untuk masukan yang sama;
 *   B. rute: hanya Super Admin, simpan + jejak audit, kembali ke bawaan, masukan sampah ditolak;
 *   C. sinkron ke bot: kunci kolamSipp ikut HANYA bila pernah disimpan (bawaan = tidak mengirim apa pun).
 */
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { KOLAM_SIPP_BAWAAN, peringatanKolamSipp, rapikanKolamSipp, totalSambunganMaks } from "@/lib/kolam-sipp";
import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import { bacaKolamSippTersimpan } from "@/server/modules/aleta-bot/kolam-sipp";
import { syncAletaBotRuntimeConfigFromDb } from "@/server/modules/aleta-bot/service";

const AKAR = path.resolve(__dirname, "../../..");
const muat = createRequire(path.join(AKAR, "aleta_bot/package.json"));
const bot = muat("./services/kolamSippService.js") as {
  bawaan: () => Record<string, unknown>;
  rapikan: (x: unknown, dasar?: unknown) => Record<string, unknown>;
  RENTANG: Record<string, { min: number; maks: number }>;
};

let db: AletaDatabase | null = null;
let aktor: string | null = "usr-super";

vi.mock("@/server/db/client", async (asli) => {
  const modul = await asli<typeof import("@/server/db/client")>();
  return { ...modul, getDatabase: async () => db };
});
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => aktor }));

const d = () => db as AletaDatabase;

describe("A. kembaran portal dan bot", () => {
  it("bawaan sama: satu kolam 10 sambungan, semua tambahan mati", () => {
    expect(KOLAM_SIPP_BAWAAN).toEqual(bot.bawaan());
    expect(totalSambunganMaks(KOLAM_SIPP_BAWAAN)).toBe(10);
  });

  it("masukan yang sama dirapikan sama oleh keduanya (termasuk sampah dan di luar rentang)", () => {
    const kasus: unknown[] = [
      {},
      null,
      "x",
      { batas: 999, batasInteraktif: -3, antreMaksMs: 1e9, antreanMaks: "7", terpisah: true, putusKueriLambat: true },
      { batas: "abc", terpisah: "ya" },
      { batas: 12.6, antreMaksMs: 4000.4 },
    ];
    for (const k of kasus) expect(rapikanKolamSipp(k)).toEqual(bot.rapikan(k));
    expect(bot.RENTANG.batas).toEqual({ min: 1, maks: 50 });
  });

  it("peringatan: total sambungan melebihi separuh batas SIPP, batas tunggu dan antrean terlalu kecil", () => {
    const s = rapikanKolamSipp({ terpisah: true, batas: 20, batasInteraktif: 20 });
    expect(peringatanKolamSipp(s, 60)).toHaveLength(1);
    expect(peringatanKolamSipp(s, 151)).toEqual([]);
    expect(peringatanKolamSipp(s, null)).toEqual([]);
    expect(peringatanKolamSipp(rapikanKolamSipp({ antreMaksMs: 300, antreanMaks: 2 }))).toHaveLength(2);
  });
});

type Hasil = { status: number; isi: { ok: boolean; data: Record<string, any>; error?: { message: string } } };

async function panggil(cara: "GET" | "PUT", badan?: unknown): Promise<Hasil> {
  const modul = await import("@/app/api/admin/aleta-bot/kolam-sipp/route");
  const req = new NextRequest("http://localhost/api/admin/aleta-bot/kolam-sipp", {
    method: cara,
    headers: badan !== undefined ? { "content-type": "application/json" } : undefined,
    body: badan !== undefined ? JSON.stringify(badan) : undefined,
  });
  const jawaban = await modul[cara](req);
  return { status: jawaban.status, isi: (await jawaban.json()) as Hasil["isi"] };
}

describe("B. rute Super Admin", () => {
  beforeEach(async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: true });
    aktor = "usr-super";
    // tanpa bot: sinkron tidak boleh menulis berkas runtime sungguhan di repo
    vi.spyOn(process, "cwd").mockReturnValue(path.join(AKAR, "manajemen_surat", ".uji-kolam-sipp", "portal"));
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    rmSync(path.join(AKAR, "manajemen_surat", ".uji-kolam-sipp"), { recursive: true, force: true });
    await db?.close();
    db = null;
  });

  it("belum pernah disimpan: bawaan dan tersimpan=false; Admin biasa, hakim, dan tanpa sesi ditolak", async () => {
    const r = await panggil("GET");
    expect(r.status).toBe(200);
    expect(r.isi.data).toEqual({ setelan: KOLAM_SIPP_BAWAAN, tersimpan: false });
    for (const siapa of ["usr-admin", "usr-hakim"]) {
      aktor = siapa;
      expect((await panggil("GET")).status).toBe(403);
      expect((await panggil("PUT", { ...KOLAM_SIPP_BAWAAN, terpisah: true })).status).toBe(403);
    }
    aktor = null;
    expect((await panggil("GET")).status).toBe(401);
    expect(await bacaKolamSippTersimpan(d())).toBeNull();
  });

  it("PUT menyimpan, menjepit angka, mencatat jejak audit; bawaan:true mengembalikan", async () => {
    const r = await panggil("PUT", { terpisah: true, putusKueriLambat: true, batas: 8, batasInteraktif: 14, antreMaksMs: 4000, antreanMaks: 30 });
    expect(r.status).toBe(200);
    expect(r.isi.data.setelan).toEqual({ terpisah: true, putusKueriLambat: true, batas: 8, batasInteraktif: 14, antreMaksMs: 4000, antreanMaks: 30 });
    expect(await bacaKolamSippTersimpan(d())).toEqual(r.isi.data.setelan);

    const baris = await d().prepare("SELECT action, actor_user_id FROM audit_logs WHERE action = ?").all<{ action: string; actor_user_id: string }>("UPDATE_KOLAM_SIPP");
    expect(baris).toHaveLength(1);
    expect(baris[0].actor_user_id).toBe("usr-super");

    const kembali = await panggil("PUT", { bawaan: true });
    expect(kembali.status).toBe(200);
    expect(kembali.isi.data.setelan).toEqual(KOLAM_SIPP_BAWAAN);
    expect((await panggil("GET")).isi.data.setelan).toEqual(KOLAM_SIPP_BAWAAN);
  });

  it("masukan sampah ditolak 400 dan tidak menyimpan apa pun", async () => {
    expect((await panggil("PUT", { terpisah: "ya", putusKueriLambat: false, batas: 8, batasInteraktif: 8, antreMaksMs: 0, antreanMaks: 0 })).status).toBe(400);
    expect((await panggil("PUT", { terpisah: true, putusKueriLambat: false, batas: 500, batasInteraktif: 8, antreMaksMs: 0, antreanMaks: 0 })).status).toBe(400);
    expect((await panggil("PUT", { terpisah: true, putusKueriLambat: false, batas: 8, batasInteraktif: 8, antreMaksMs: -1, antreanMaks: 0 })).status).toBe(400);
    expect((await panggil("PUT", { terpisah: true })).status).toBe(400);
    expect(await bacaKolamSippTersimpan(d())).toBeNull();
  });
});

describe("C. sinkron ke bot", () => {
  const dasar = path.join(AKAR, "manajemen_surat", ".uji-kolam-sipp-c");
  beforeEach(async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: true });
    mkdirSync(path.join(dasar, "portal"), { recursive: true });
    vi.spyOn(process, "cwd").mockReturnValue(path.join(dasar, "portal"));
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    rmSync(dasar, { recursive: true, force: true });
    await db?.close();
    db = null;
  });

  it("tanpa pengaturan tersimpan: berkas runtime TIDAK memuat kunci kolamSipp (bot memakai bawaannya)", async () => {
    await syncAletaBotRuntimeConfigFromDb(d());
    const isi = JSON.parse(readFileSync(path.join(dasar, "portal", "data", "aleta-bot-runtime.json"), "utf8"));
    expect("kolamSipp" in isi).toBe(false);
  });

  it("sesudah disimpan: kunci kolamSipp ikut terkirim apa adanya", async () => {
    aktor = "usr-super";
    const { simpanKolamSipp } = await import("@/server/modules/aleta-bot/kolam-sipp");
    await simpanKolamSipp(d(), "usr-super", { terpisah: true, putusKueriLambat: false, batas: 6, batasInteraktif: 12, antreMaksMs: 4000, antreanMaks: 0 });
    await syncAletaBotRuntimeConfigFromDb(d());
    const isi = JSON.parse(readFileSync(path.join(dasar, "portal", "data", "aleta-bot-runtime.json"), "utf8"));
    expect(isi.kolamSipp).toEqual({ terpisah: true, putusKueriLambat: false, batas: 6, batasInteraktif: 12, antreMaksMs: 4000, antreanMaks: 0 });
  });
});
