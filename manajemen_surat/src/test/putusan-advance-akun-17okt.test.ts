// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PESAN_ADVANCE_MATI, advanceMenyala, bersihkanPengaturanAdvance } from "@/lib/putusan-advance-akun";

/**
 * Keputusan pengguna 17 Okt 2026: Putusan Advance diatur PER AKUN dari
 * Pengaturan SIPP & ABT. Bawaan: hanya hakim Derry Briantono menyala; akun
 * lain mati (masih memakai ABT). Saklar = syarat TAMBAHAN di atas hak lama.
 */

const keadaan = vi.hoisted(() => ({
  aktor: null as Record<string, unknown> | null,
  menyala: true,
  serupa: 0,
}));

vi.mock("@/server/db/client", () => ({ getDatabase: async () => ({ queryOne: async () => null, queryAll: async () => [] }) }));
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => "usr_uji" }));
vi.mock("@/server/modules/aleta-ecourt/akses", () => ({ pastikanKapabilitas: async () => keadaan.aktor }));
vi.mock("@/server/modules/aleta-ecourt/putusan-advance-akun", () => ({ advanceMenyalaUntuk: async () => keadaan.menyala }));
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
  const req = new NextRequest("http://localhost/api/aleta-ecourt/putusan/advance", {
    method: cara,
    headers: badan ? { "content-type": "application/json" } : undefined,
    body: badan ? JSON.stringify(badan) : undefined,
  });
  const res = await modul[cara](req);
  return { status: res.status, isi: (await res.json()) as { ok: boolean; data?: Record<string, unknown>; error?: { message: string } } };
}

beforeEach(() => {
  keadaan.aktor = { id: "usr-hakim", name: "Hakim Uji", roleId: "hakim" };
  keadaan.menyala = true;
  keadaan.serupa = 0;
});

describe("aturan saklar per akun (murni)", () => {
  it("belum pernah diatur: hanya Derry Briantono (dengan atau tanpa gelar) yang menyala", () => {
    expect(advanceMenyala(null, { id: "a", name: "Derry Briantono" })).toBe(true);
    expect(advanceMenyala(null, { id: "a", name: "Derry Briantono, S.H.I., M.H." })).toBe(true);
    expect(advanceMenyala(null, { id: "b", name: "Hj. Nur Aisyah" })).toBe(false);
    expect(advanceMenyala(null, { id: "c", name: "SUPER ADMIN DERRY" })).toBe(false);
    expect(advanceMenyala(null, null)).toBe(false);
  });
  it("sesudah disimpan: hanya id akun yang dipilih admin - nama tidak lagi menentukan", () => {
    const p = bersihkanPengaturanAdvance({ akun: ["usr-hakim", "usr-hakim", " ", "x;drop"], diubahOleh: "Admin", diubahPada: "2026-10-17T00:00:00Z" });
    expect(p?.akun).toEqual(["usr-hakim"]);
    expect(advanceMenyala(p, { id: "usr-hakim", name: "Hj. Nur Aisyah" })).toBe(true);
    expect(advanceMenyala(p, { id: "usr-derry", name: "Derry Briantono" })).toBe(false);
    expect(bersihkanPengaturanAdvance({ akun: "usr-hakim" })).toBeNull();
  });
});

describe("rute putusan/advance", () => {
  it("akun yang dimatikan: 403 dengan kalimat awam, SIPP tidak ditanya", async () => {
    keadaan.menyala = false;
    const r = await rute("POST", { nomorPerkara: "45/Pdt.G/2026/PA.Dgl", teks: "PUTUSAN" });
    expect(r.status).toBe(403);
    expect(r.isi.error?.message).toBe(PESAN_ADVANCE_MATI);
    expect(keadaan.serupa).toBe(0);
  });
  it("akun menyala tetap melewati hak lama: bukan hakim/konseptor ditolak dengan sebab lama", async () => {
    keadaan.aktor = { id: "usr-budi", name: "Budi Santoso", roleId: "staf" };
    const r = await rute("POST", { nomorPerkara: "45/Pdt.G/2026/PA.Dgl", teks: "PUTUSAN" });
    expect(r.status).toBe(403);
    expect(r.isi.error?.message).toMatch(/hanya untuk hakim, konseptor/);
  });
  it("GET memberi tahu ekstensi keadaan saklar akun ini", async () => {
    expect((await rute("GET")).isi.data).toEqual({ menyala: true, sebab: "" });
    keadaan.menyala = false;
    expect((await rute("GET")).isi.data).toEqual({ menyala: false, sebab: PESAN_ADVANCE_MATI });
  });
});

describe("ekstensi: alat disembunyikan untuk akun yang dimatikan", () => {
  const akar = path.resolve(process.cwd(), "..", "ekstensi-sipp");
  it("putusan-advance.js membaca saklar (GET) dan menampilkan kalimat awam; blangko-derry.js menyaring alat 'advance'", () => {
    const pa = readFileSync(path.join(akar, "putusan-advance.js"), "utf8");
    expect(pa).toContain('ambil(API, { method: "GET" })');
    expect(pa).toContain(PESAN_ADVANCE_MATI);
    expect(pa).toMatch(/menyala: \(\) => S\.menyala/);
    const bd = readFileSync(path.join(akar, "blangko-derry.js"), "utf8");
    expect(bd).toMatch(/ALAT\[g\]\.filter\(\(\[id\]\) => id !== "advance" \|\| alatAdvanceTampil\(\)\)/);
  });
});
