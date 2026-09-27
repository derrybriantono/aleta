// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getGatewayJadwalSidang } from "@/server/modules/aleta-bot/whatsapp-gateway-client";

/**
 * ============================================================================
 * WAKTU ANTRIAN HANYA DIMINTA OLEH LAYAR YANG MEMAKAINYA - TEMUAN PENELAAH
 * ============================================================================
 *
 * Temuan 3 penelaah gabungan atas 2.39: /sipp/jadwal-sidang di bot SELALU
 * menyusun waktu antrian (tiga kueri ke basis data antrian dan bot), padahal
 * rute yang ikut memanggilnya - antrian-publik, antrian-tampil, sidang-ruang,
 * yang dipanggil berulang oleh layar tanpa login - membuang hasilnya.
 *
 * Kini ia PILIHAN: ?waktu=1. Hanya rute jadwal sidang yang mengirimnya
 * (dijaga rekam-antrian-lampau.test.ts); di sini dijaga fungsi gerbangnya
 * sendiri - tanpa pilihan, alamat yang diminta SAMA dengan sebelumnya.
 */

const alamat: string[] = [];

beforeEach(() => {
  alamat.length = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      alamat.push(String(url));
      return new Response(JSON.stringify({ ok: true, dari: "", sampai: "", diperiksaPada: "", sidang: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    })
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getGatewayJadwalSidang - ?waktu=1 hanya bila diminta", () => {
  const dasar = { dari: "2026-09-27", sampai: "2026-09-27", cari: "", batas: 200 };

  it("tanpa pilihan: alamatnya sama dengan sebelum 2.39, tanpa waktu", async () => {
    const hasil = await getGatewayJadwalSidang(dasar);
    expect(hasil.ok).toBe(true);
    expect(alamat).toHaveLength(1);
    const url = new URL(alamat[0]);
    expect(url.pathname).toBe("/internal/aleta-bot/sipp/jadwal-sidang");
    expect(url.searchParams.has("waktu")).toBe(false);
    expect([...url.searchParams.keys()].sort()).toEqual(["batas", "cari", "dari", "sampai"]);
  });

  it("waktu: false juga tidak meminta", async () => {
    await getGatewayJadwalSidang({ ...dasar, waktu: false });
    expect(new URL(alamat[0]).searchParams.has("waktu")).toBe(false);
  });

  it("waktu: true meminta waktu=1", async () => {
    await getGatewayJadwalSidang({ ...dasar, waktu: true });
    expect(new URL(alamat[0]).searchParams.get("waktu")).toBe("1");
  });
});
