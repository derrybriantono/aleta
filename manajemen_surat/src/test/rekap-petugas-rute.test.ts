// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import { simpanAksesEkstensi } from "@/server/modules/aleta-ecourt/akses";

/**
 * ============================================================================
 * GET /api/aleta-ecourt/rekap-petugas - KEWENANGAN DAN ALAMAT
 * ============================================================================
 *
 * Handler sungguhan atas pg-mem berbenih, dengan pemeriksa kewenangan yang
 * SUNGGUHAN (pastikanKapabilitas "panel" - sama dengan Status Perkara). Yang
 * ditiru hanya gerbang bot. Yang dijaga:
 *
 *   - tanpa sesi: 401, dan bot tidak dipanggil
 *   - peran yang kemampuan panelnya dimatikan: 403, bot tidak dipanggil
 *   - kewenangan diperiksa SEBELUM alamat: tanpa sesi + alamat salah tetap 401
 *   - alamat yang salah atau kosong: 400 beserta kalimatnya, bot tidak dipanggil
 *   - alamat yang sah diteruskan sebagai ID BILANGAN, beserta saringannya
 *   - bot yang gagal: 200 available:false beserta kalimat bot apa adanya
 */

vi.mock("@/server/modules/aleta-bot/whatsapp-gateway-client", async (asli) => {
  const modul = await asli<typeof import("@/server/modules/aleta-bot/whatsapp-gateway-client")>();
  return { ...modul, getGatewayRekapPetugas: vi.fn() };
});

let db: AletaDatabase | null = null;
let aktor: string | null = "usr-hakim";

vi.mock("@/server/db/client", async (asli) => {
  const modul = await asli<typeof import("@/server/db/client")>();
  return { ...modul, getDatabase: async () => db };
});
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => aktor }));

const { getGatewayRekapPetugas } = await import("@/server/modules/aleta-bot/whatsapp-gateway-client");
const gerbang = vi.mocked(getGatewayRekapPetugas);

beforeEach(async () => {
  db = await createAletaDatabase({ useInMemory: true, seed: true });
  aktor = "usr-hakim";
  gerbang.mockReset();
  gerbang.mockImplementation(async (p) => ({
    ok: true,
    data: { ok: true, peran: p.peran, id: p.id } as never,
  }));
});

afterEach(async () => {
  await db?.close();
  db = null;
});

async function panggil(kueri: string) {
  const { GET } = await import("@/app/api/aleta-ecourt/rekap-petugas/route");
  const jawaban = await GET(new NextRequest(`http://localhost/api/aleta-ecourt/rekap-petugas${kueri}`));
  return {
    status: jawaban.status,
    isi: (await jawaban.json()) as {
      ok: boolean;
      data?: { available: boolean; rekap: unknown; pesan: string };
      error?: { message?: string };
    },
  };
}

describe("kewenangan - sama dengan Status Perkara", () => {
  it("tanpa sesi: 401, bot tidak dipanggil", async () => {
    aktor = null;
    const r = await panggil("?peran=hakim&id=26");
    expect(r.status).toBe(401);
    expect(r.isi.ok).toBe(false);
    expect(gerbang).not.toHaveBeenCalled();
  });

  it("peran yang kemampuan panelnya dimatikan: 403, bot tidak dipanggil", async () => {
    await simpanAksesEkstensi(db!, { actorUserId: "usr-super", roleId: "hakim", kapabilitas: "panel", aktif: false });
    const r = await panggil("?peran=hakim&id=26");
    expect(r.status).toBe(403);
    expect(r.isi.error?.message).toMatch(/tidak diberi akses/);
    expect(gerbang).not.toHaveBeenCalled();
  });

  it("kemampuan panel yang menyala: dibuka", async () => {
    const r = await panggil("?peran=hakim&id=26");
    expect(r.status).toBe(200);
    expect(r.isi.data?.available).toBe(true);
  });

  it("kewenangan diperiksa lebih dahulu: tanpa sesi dan alamat salah tetap 401", async () => {
    aktor = null;
    const r = await panggil("?peran=ketua&id=abc");
    expect(r.status).toBe(401);
  });
});

describe("alamat yang salah atau kosong ditolak 400 tanpa memanggil bot", () => {
  const kasus: Array<[string, RegExp]> = [
    ["", /Peran/],
    ["?id=26", /Peran/],
    ["?peran=ketua&id=26", /Peran/],
    ["?peran=hakim", /ID SIPP/],
    ["?peran=hakim&id=", /ID SIPP/],
    ["?peran=hakim&id=abc", /ID SIPP/],
    ["?peran=hakim&id=12abc", /ID SIPP/],
    ["?peran=hakim&id=0", /ID SIPP/],
    ["?peran=hakim&id=-5", /ID SIPP/],
    ["?peran=hakim&id=1.5", /ID SIPP/],
    ["?peran=hakim&id=99999999999", /ID SIPP/],
    ["?peran=hakim&id=26&tahun=20255", /Tahun/],
    ["?peran=hakim&id=26&keadaan=selesai", /Keadaan/],
    ["?peran=hakim&id=26&kedudukan=ketua%3B%20DROP", /Kedudukan/],
    ["?peran=hakim&id=26&lewati=-1", /Lewati/],
    ["?peran=hakim&id=26&batas=0", /Batas/],
  ];
  for (const [kueri, pesan] of kasus) {
    it(`"${kueri || "(kosong)"}" -> 400`, async () => {
      const r = await panggil(kueri);
      expect(r.status).toBe(400);
      expect(r.isi.ok).toBe(false);
      expect(r.isi.error?.message).toMatch(pesan);
      expect(gerbang).not.toHaveBeenCalled();
    });
  }
});

describe("alamat yang sah diteruskan ke bot", () => {
  it("id dikirim sebagai BILANGAN, peran dan saringan ikut", async () => {
    const r = await panggil("?peran=Mediator&id=025&tahun=2026&keadaan=proses&kedudukan=mediator&lewati=100&batas=500");
    // "025" bukan bilangan bulat sah (angka depan nol) - ditolak, bukan dibaca 25.
    expect(r.status).toBe(400);

    const sah = await panggil("?peran=Mediator&id=25&tahun=2026&keadaan=proses&kedudukan=mediator&lewati=100&batas=500");
    expect(sah.status).toBe(200);
    expect(gerbang).toHaveBeenCalledTimes(1);
    expect(gerbang.mock.calls[0][0]).toEqual({
      peran: "mediator",
      id: 25,
      tahun: "2026",
      keadaan: "proses",
      kedudukan: "mediator",
      lewati: 100,
      // Dijepit ke pagu, bukan ditolak.
      batas: 200,
    });
    expect(sah.isi.data).toEqual({ available: true, rekap: { ok: true, peran: "mediator", id: 25 }, pesan: "" });
  });

  it("tanpa saringan: bawaan 100 baris dari awal", async () => {
    await panggil("?peran=jurusita&id=28");
    expect(gerbang.mock.calls[0][0]).toEqual({
      peran: "jurusita",
      id: 28,
      tahun: "",
      keadaan: "",
      kedudukan: "",
      lewati: 0,
      batas: 100,
    });
  });

  it("bot gagal: kalimat bot diteruskan apa adanya, bukan diganti kalimat umum", async () => {
    gerbang.mockResolvedValueOnce({ ok: false, error: "Tidak ada hakim dengan ID SIPP 999." });
    const r = await panggil("?peran=hakim&id=999");
    expect(r.status).toBe(200);
    expect(r.isi.data).toEqual({ available: false, rekap: null, pesan: "Tidak ada hakim dengan ID SIPP 999." });
  });

  it("bot gagal tanpa kalimat: sebab umum yang tetap dapat dibaca", async () => {
    gerbang.mockResolvedValueOnce({ ok: false, error: "" });
    const r = await panggil("?peran=hakim&id=26");
    expect(r.isi.data?.pesan).toBe("ALETA Bot belum dapat dihubungi.");
  });
});

// ============================================================================
// SEKALI ATAS BOT HIDUP
// ============================================================================
//
// Dijalankan HANYA bila ALETA_UJI_BOT_HIDUP=1: rangkaian uji penuh tidak boleh
// bergantung pada bot yang menyala di mesin pengujinya. Rute dan gerbangnya
// SUNGGUHAN (gatewayFetch asli) - hanya sesi portal yang dipalsukan. Alamat
// dan token bot dari lingkungan (ALETA_BOT_BASE_URL, ALETA_BOT_INTERNAL_API_TOKEN),
// atau dari .env.local bila keduanya tidak disetel. ALETA_UJI_HAKIM_ID memilih
// hakimnya (bawaan 26).
const BOT_HIDUP = process.env.ALETA_UJI_BOT_HIDUP === "1";

describe.skipIf(!BOT_HIDUP)("rute rekap petugas atas bot hidup (ALETA_UJI_BOT_HIDUP=1)", () => {
  it("rekap hakim sungguhan: angkanya utuh, tiap persen sepadan dengan pembilang/penyebutnya", async () => {
    const { existsSync, readFileSync } = await import("node:fs");
    const path = await import("node:path");
    const env = path.resolve(process.cwd(), ".env.local");
    if (existsSync(env)) {
      for (const baris of readFileSync(env, "utf8").split(/\r?\n/)) {
        const cocok = /^(ALETA_BOT_[A-Z_]+)=(.*)$/.exec(baris.trim());
        if (cocok && !process.env[cocok[1]]) process.env[cocok[1]] = cocok[2].replace(/^["']|["']$/g, "");
      }
    }
    const asli = await vi.importActual<typeof import("@/server/modules/aleta-bot/whatsapp-gateway-client")>(
      "@/server/modules/aleta-bot/whatsapp-gateway-client"
    );
    gerbang.mockImplementation(asli.getGatewayRekapPetugas);
    const idHakim = process.env.ALETA_UJI_HAKIM_ID || "26";

    const r = await panggil(`?peran=hakim&id=${idHakim}`);
    expect(r.status).toBe(200);
    expect(r.isi.data?.available, r.isi.data?.pesan).toBe(true);
    const rekap = r.isi.data!.rekap as import("@/lib/rekap-petugas").RekapPetugas;
    expect(rekap.identitas.id).toBe(Number(idHakim));
    expect(rekap.ringkas.jumlah).toBeGreaterThan(0);
    expect(rekap.daftar.baris.length).toBeLessThanOrEqual(100);

    // Tiap bagian di seluruh jawaban: pembilang <= penyebut, dan persen null
    // TEPAT bila penyebutnya nol.
    const periksaBagian = (nilai: unknown): void => {
      if (!nilai || typeof nilai !== "object") return;
      const b = nilai as Record<string, unknown>;
      if ("pembilang" in b && "penyebut" in b && "persen" in b) {
        expect(Number(b.pembilang)).toBeLessThanOrEqual(Number(b.penyebut));
        expect(b.persen === null).toBe(Number(b.penyebut) === 0);
      }
      Object.values(b).forEach(periksaBagian);
    };
    periksaBagian(rekap);
    console.log(
      `[bot hidup] hakim ${idHakim} ${rekap.identitas.nama}: ${rekap.ringkas.jumlah} perkara, ` +
        `jalur ${rekap.jalurBaca}, dari singgahan ${rekap.dariSinggahan}`
    );

    const tidakAda = await panggil("?peran=hakim&id=999999");
    expect(tidakAda.isi.data).toMatchObject({ available: false, rekap: null });
    expect(tidakAda.isi.data?.pesan).toMatch(/999999/);
  }, 120_000);
});
