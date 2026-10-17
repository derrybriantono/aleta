// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PESAN_FITUR_MATI } from "@/lib/fitur-satker";
import { ApiError } from "@/server/shared/errors";

/**
 * Banyak satker, Tahap 0: saklar fitur "putusan-advance" per satker di rute
 * putusan/advance. Syarat TAMBAHAN di atas saklar per akun dan hak lama;
 * satker yang tidak mematikannya tidak melihat perubahan apa pun.
 */

const keadaan = vi.hoisted(() => ({ fiturMenyala: true, serupa: 0 }));

vi.mock("@/server/db/client", () => ({ getDatabase: async () => ({}) }));
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => "usr_uji" }));
vi.mock("@/server/modules/aleta-ecourt/akses", () => ({ pastikanKapabilitas: async () => ({ id: "usr-hakim", name: "Hakim Uji", roleId: "hakim" }) }));
vi.mock("@/server/modules/aleta-ecourt/putusan-advance-akun", () => ({ advanceMenyalaUntuk: async () => true }));
vi.mock("@/server/modules/satker/fitur", () => ({
  fiturMenyala: async () => keadaan.fiturMenyala,
  pastikanFiturMenyala: async () => {
    if (!keadaan.fiturMenyala) throw new ApiError(403, PESAN_FITUR_MATI);
  },
}));
vi.mock("@/server/modules/aleta-bot/whatsapp-gateway-client", () => ({
  getGatewaySippPutusanSerupa: async () => {
    keadaan.serupa += 1;
    return { ok: false, error: "tidak dibaca dalam uji" };
  },
}));
vi.mock("@/server/shared/admin-access-audit", async () => {
  const { NextResponse } = await import("next/server");
  return {
    handleAdminRouteError: (galat: { status?: number; message?: string }) =>
      NextResponse.json({ ok: false, error: { message: String(galat && galat.message) } }, { status: Number(galat && galat.status) || 500 }),
  };
});

async function rute(cara: "GET" | "POST", badan?: Record<string, unknown>) {
  const modul = (await import("@/app/api/aleta-ecourt/putusan/advance/route")) as unknown as Record<string, (r: NextRequest) => Promise<Response>>;
  const res = await modul[cara](
    new NextRequest("http://localhost/api/aleta-ecourt/putusan/advance", {
      method: cara,
      headers: badan ? { "content-type": "application/json" } : undefined,
      body: badan ? JSON.stringify(badan) : undefined,
    })
  );
  return { status: res.status, isi: (await res.json()) as { ok: boolean; data?: Record<string, unknown>; error?: { message: string } } };
}

beforeEach(() => {
  keadaan.fiturMenyala = true;
  keadaan.serupa = 0;
});

describe("saklar fitur satker pada Putusan Advance", () => {
  it("fitur dimatikan di satker: GET melapor mati, POST 403 dan SIPP tidak ditanya", async () => {
    keadaan.fiturMenyala = false;
    expect((await rute("GET")).isi.data).toMatchObject({ menyala: false });
    const r = await rute("POST", { nomorPerkara: "45/Pdt.G/2026/PA.Dgl", teks: "PUTUSAN" });
    expect(r.status).toBe(403);
    expect(r.isi.error?.message).toContain(PESAN_FITUR_MATI);
    expect(keadaan.serupa).toBe(0);
  });

  it("bawaan (menyala): GET melapor menyala dan POST lolos ke langkah berikutnya", async () => {
    expect((await rute("GET")).isi.data).toEqual({ menyala: true, sebab: "" });
    const r = await rute("POST", { nomorPerkara: "", teks: "PUTUSAN" });
    expect(r.status).toBe(200);
    expect(r.isi.data).toMatchObject({ ok: false, sebab: "Nomor perkara belum disebut." });
  });
});
