// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Rute portal /api/aleta-bot/penunjukan/tulis - cabang `rantai` (uji rilis U1,
 * 9 Okt 2026): sisa penetapan satu perkara diteruskan SEKALIGUS ke bot
 * (tulisRantaiUtuh, satu transaksi). Operator dari sesi, hanya penulisan
 * sungguhan, jenis tertutup.
 */
const keadaan = vi.hoisted(() => ({
  rantai: [] as Array<Record<string, unknown>>,
  tunggal: [] as Array<Record<string, unknown>>,
  jawab: { ok: true, data: { ok: true, utuh: true, hasil: [] } } as Record<string, unknown>,
}));

vi.mock("@/server/db/client", () => ({ getDatabase: async () => ({}) }));
vi.mock("@/server/modules/aleta-ecourt/akses", () => ({ pastikanKapabilitas: async () => ({ name: "SUPER ADMIN DERRY" }) }));
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => "usr_uji" }));
vi.mock("@/server/modules/organization/service", () => ({ getUserByIdFromDb: async () => ({ name: "SUPER ADMIN DERRY" }) }));
vi.mock("@/server/shared/admin-access-audit", () => ({
  handleAdminRouteError: (galat: unknown) => {
    throw galat;
  },
}));
vi.mock("@/server/modules/aleta-bot/whatsapp-gateway-client", () => ({
  kirimPenetapanTulisGateway: async (m: Record<string, unknown>) => {
    keadaan.tunggal.push(m);
    return { ok: true, data: { ok: true } };
  },
  kirimPenetapanTulisRantaiGateway: async (m: Record<string, unknown>) => {
    keadaan.rantai.push(m);
    return keadaan.jawab;
  },
}));

async function kirim(badan: Record<string, unknown>) {
  const mod = await import("@/app/api/aleta-bot/penunjukan/tulis/route");
  const permintaan = new Request("http://127.0.0.1/aleta/api/aleta-bot/penunjukan/tulis", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "192.168.9.109" },
    body: JSON.stringify(badan),
  });
  const r = await mod.POST(permintaan as unknown as Parameters<typeof mod.POST>[0]);
  return { status: r.status, badan: (await r.json()) as Record<string, unknown> };
}

beforeEach(() => {
  keadaan.rantai = [];
  keadaan.tunggal = [];
  keadaan.jawab = { ok: true, data: { ok: true, utuh: true, hasil: [] } };
});

describe("cabang rantai rute tulis", () => {
  it("meneruskan seluruh langkah sekaligus, operator dari sesi (bukan badan)", async () => {
    const { status } = await kirim({
      rantai: [
        { jenis: "PPP", petugasId: 21, pejabatUsername: "Sri Susilowati" },
        { jenis: "pjs", petugasId: 28 },
        { jenis: "phs", tanggalSidang: "2026-10-21", ruanganId: 3 },
      ],
      perkaraId: 10222,
      tanggalPenetapan: "2026-10-09",
      olehUsername: "Derry Briantono",
      operator: "karangan peramban",
      kering: false,
    });
    expect(status).toBe(200);
    expect(keadaan.tunggal).toHaveLength(0);
    expect(keadaan.rantai).toHaveLength(1);
    expect(keadaan.rantai[0]).toMatchObject({ perkaraId: 10222, olehUsername: "Derry Briantono", operator: "SUPER ADMIN DERRY" });
    expect((keadaan.rantai[0].langkah as Array<{ jenis: string }>).map((x) => x.jenis)).toEqual(["ppp", "pjs", "phs"]);
  });

  it("rantai hanya untuk penulisan sungguhan; jenis asing ditolak", async () => {
    expect((await kirim({ rantai: [{ jenis: "pmh" }], perkaraId: 1, olehUsername: "x" })).badan.alasan).toBe("rantai_hanya_untuk_menulis");
    expect((await kirim({ rantai: [{ jenis: "dataUmum" }], perkaraId: 1, olehUsername: "x", kering: false })).badan.alasan).toBe("jenis_tidak_didukung");
    expect((await kirim({ rantai: [{ jenis: "pmh" }], perkaraId: 1, olehUsername: "", kering: false })).badan.alasan).toBe("akun_sipp_belum_terbaca");
    expect(keadaan.rantai).toHaveLength(0);
  });

  it("transaksi dibatalkan bot: rinciannya sampai ke panel (409)", async () => {
    keadaan.jawab = { ok: true, data: { ok: false, alasan: "gagal_menulis", jenisGagal: "pjs", dipulihkan: true, hasil: [{ jenis: "ppp", ok: false }] } };
    const { status, badan } = await kirim({ rantai: [{ jenis: "ppp" }, { jenis: "pjs" }], perkaraId: 1, olehUsername: "x", kering: false });
    expect(status).toBe(409);
    expect(badan).toMatchObject({ ok: false, jenisGagal: "pjs", dipulihkan: true });
  });
});
