// @vitest-environment node
/**
 * ============================================================================
 * RUTE TANDA TANGAN DAN STATUS PERKARA - AUDIT U5 9 OKTOBER 2026
 * ============================================================================
 *
 * Rute SUNGGUHAN atas pg-mem berbenih, dengan pemeriksa kewenangan sungguhan.
 * Bentuk jawaban yang dibuktikan di sini adalah yang ditiru fetch tiruan
 * layar di status-kendali-ttd-u5-9okt.test.tsx.
 *
 *   - GET tanda tangan: `pengguna` berada di TINGKAT ATAS bungkus, bukan di
 *     dalam data - layar dulu membacanya dari data dan pemilihnya kosong.
 *   - POST tanda tangan: penolakan bot tetap 400 dengan alasannya di `error`;
 *     bot yang tidak menjawab menjadi 502 (dulu 400 - terbaca seperti isian
 *     yang salah).                                         [merah sebelum]
 *   - GET status perkara: bot yang SEHAT menolak 400 "perkara_tidak_ditemukan"
 *     menjadi { available:true, status:null, alasan } - dulu jatuh ke cabang
 *     "bot tidak terjangkau" dan layar menulis kode mentahnya. [merah sebelum]
 *     Bot yang benar-benar mati tetap available:false.
 *
 * Satu basis data untuk seluruh berkas (beforeAll): pembenihannya mahal, dan
 * tidak ada kasus di sini yang menulis ke basis data portal.
 */
import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";

let db: AletaDatabase | null = null;

vi.mock("@/server/db/client", async (asli) => {
  const modul = await asli<typeof import("@/server/db/client")>();
  return { ...modul, getDatabase: async () => db };
});
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => "usr-admin" }));

const tiruan = vi.hoisted(() => ({
  tambah: null as null | (() => Promise<unknown>),
}));
vi.mock("@/server/modules/aleta-bot/whatsapp-gateway-client", async (asli) => {
  const modul = await asli<typeof import("@/server/modules/aleta-bot/whatsapp-gateway-client")>();
  return {
    ...modul,
    getGatewayTandaTangan: vi.fn(async () => ({
      ok: true,
      data: { ok: true, baris: [{ id: 1, namaPejabat: "X", disahkan: false }] },
    })),
    kirimTandaTanganTambah: vi.fn(async () => (tiruan.tambah ? tiruan.tambah() : { ok: true, data: { ok: true } })),
  };
});

const fetchAsli = globalThis.fetch;

beforeAll(async () => {
  db = await createAletaDatabase({ useInMemory: true, seed: true });
});
afterAll(async () => {
  await db?.close();
  db = null;
});
afterEach(() => {
  globalThis.fetch = fetchAsli;
  tiruan.tambah = null;
});

describe("GET /api/aleta-ecourt/tanda-tangan", () => {
  it("baris di dalam data, daftar pengguna di tingkat atas bungkus", async () => {
    const { GET } = await import("@/app/api/aleta-ecourt/tanda-tangan/route");
    const jawaban = await GET(new NextRequest("http://localhost/api/aleta-ecourt/tanda-tangan"));
    expect(jawaban.status).toBe(200);
    const bungkus = (await jawaban.json()) as {
      data?: { baris?: unknown[]; pengguna?: unknown };
      pengguna?: Array<{ id: string; nama: string }>;
    };
    expect(bungkus.data?.baris).toHaveLength(1);
    expect(bungkus.data?.pengguna).toBeUndefined();
    expect(Array.isArray(bungkus.pengguna)).toBe(true);
    expect((bungkus.pengguna ?? []).length).toBeGreaterThan(0);
    // Seperlunya saja - tanpa surel atau nomor.
    expect(Object.keys((bungkus.pengguna ?? [])[0] ?? {}).sort()).toEqual(
      ["id", "jabatan", "nama", "peran", "peranLabel", "subPeran"].sort()
    );
  }, 600_000);
});

describe("POST /api/aleta-ecourt/tanda-tangan - status jawaban", () => {
  async function tambah() {
    const { POST } = await import("@/app/api/aleta-ecourt/tanda-tangan/route");
    return POST(
      new NextRequest("http://localhost/api/aleta-ecourt/tanda-tangan", {
        method: "POST",
        body: JSON.stringify({ tindakan: "tambah", isiBase64: "AAAA", namaPejabat: "X" }),
      })
    );
  }

  it("bot menolak (4xx): 400, alasan bot di ruas error", async () => {
    tiruan.tambah = async () => ({ ok: false, error: "gambar_sudah_ada", status: 400 });
    const jawaban = await tambah();
    expect(jawaban.status).toBe(400);
    expect(await jawaban.json()).toMatchObject({ ok: false, error: "gambar_sudah_ada" });
  }, 600_000);

  it("bot tidak menjawab (tanpa status): 502, bukan 400", async () => {
    tiruan.tambah = async () => ({ ok: false, error: "aleta_bot tidak dapat dihubungi (koneksi ditolak)." });
    const jawaban = await tambah();
    expect(jawaban.status).toBe(502);
    expect(String(((await jawaban.json()) as { error?: string }).error)).toContain("dihubungi");
  }, 600_000);

  it("bot galat 5xx: 502", async () => {
    tiruan.tambah = async () => ({ ok: false, error: "ER_LOCK_WAIT_TIMEOUT", status: 500 });
    expect((await tambah()).status).toBe(502);
  }, 600_000);

  it("berhasil: 200", async () => {
    tiruan.tambah = async () => ({ ok: true, data: { ok: true, id: 9 } });
    expect((await tambah()).status).toBe(200);
  }, 600_000);
});

describe("GET /api/aleta-ecourt/status-perkara?nomor=", () => {
  async function buka() {
    const { GET } = await import("@/app/api/aleta-ecourt/status-perkara/route");
    const jawaban = await GET(
      new NextRequest("http://localhost/api/aleta-ecourt/status-perkara?nomor=999%2FPdt.G%2F2026%2FPA.Dgl")
    );
    return ((await jawaban.json()) as { data?: Record<string, unknown> }).data;
  }

  it("bot SEHAT menolak 'perkara_tidak_ditemukan': available:true + alasan", async () => {
    // Persis jawaban bot: internalGatewayRoutes /sipp/status-perkara memakai
    // res.status(hasil.ok ? 200 : 400), statusLengkap -> { ok:false, alasan }.
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ ok: false, alasan: "perkara_tidak_ditemukan" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    ) as typeof fetch;
    expect(await buka()).toMatchObject({ available: true, status: null, alasan: "perkara_tidak_ditemukan" });
  }, 600_000);

  it("bot MATI (koneksi ditolak): tetap available:false dengan kalimatnya", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw Object.assign(new TypeError("fetch failed"), { cause: { code: "ECONNREFUSED" } });
    }) as typeof fetch;
    const data = await buka();
    expect(data?.available).toBe(false);
    expect(String(data?.message)).toContain("tidak dapat dihubungi");
  }, 600_000);

  it("bot galat 500 berkalimat: tetap available:false, bukan dianggap 'tidak ditemukan'", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ ok: false, error: "Koneksi SIPP putus." }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      })
    ) as typeof fetch;
    const data = await buka();
    expect(data?.available).toBe(false);
    expect(String(data?.message)).toContain("Koneksi SIPP putus");
  }, 600_000);
});
