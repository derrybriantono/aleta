// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ============================================================================
 * RUTE BEDA DENGAN ABT (5 Nov 2026, Tahap 9): HANYA SUPER ADMIN, DIJAGA DI SERVER, TERCATAT DI AUDIT
 * ============================================================================
 * Peran lain 403 di SETIAP bagian GET dan SETIAP tindakan POST (layanan tidak tersentuh sama sekali, tidak ada audit), Super
 * Admin lolos, buka beda / pilihan / jadwal / unduh paket tercatat tanpa isi blangko, paket diunduh sebagai ZIP dan tidak dipasang.
 */

const keadaan = vi.hoisted(() => ({
  aktor: null as Record<string, unknown> | null,
  panggil: [] as string[],
  audit: [] as Array<{ action: string; entityType: string; entityId: string; payload: Record<string, unknown> }>,
}));

vi.mock("@/server/db/client", () => ({ getDatabase: async () => ({ marker: "db" }) }));
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => "usr_uji" }));
vi.mock("@/server/modules/organization/service", () => ({
  requireActorUser: async () => {
    if (!keadaan.aktor) throw Object.assign(new Error("tanpa aktor"), { status: 401, name: "ApiError" });
    return keadaan.aktor;
  },
}));
vi.mock("@/server/shared/admin-access-audit", async () => {
  const { NextResponse } = await import("next/server");
  return {
    handleAdminRouteError: (galat: { status?: number; message?: string }) =>
      NextResponse.json({ ok: false, error: { message: String(galat && galat.message) } }, { status: Number(galat && galat.status) || 500 }),
  };
});
vi.mock("@/server/shared/audit", () => ({
  appendAuditLog: async (_db: unknown, e: { action: string; entityType: string; entityId: string; payload: Record<string, unknown> }) => {
    keadaan.audit.push({ action: e.action, entityType: e.entityType, entityId: e.entityId, payload: e.payload });
  },
}));
vi.mock("@/server/shared/ids", () => ({ nextPrefixedId: async () => "adt-uji" }));
vi.mock("@/server/modules/aleta-abt-sinkron/service", () => {
  const catat = (nama: string, hasil: unknown) => async () => {
    keadaan.panggil.push(nama);
    return hasil;
  };
  return {
    ringkasanBeda: catat("ringkas", { menunggu: 2, daftar: [] }),
    bacaSetelanSinkronAbt: catat("setelan-baca", { jadwal: false, jam: "23:00" }),
    bukaBeda: catat("beda", { id: "x.rtf", md5Aleta: "aaa", md5Abt: "bbb", beda: null }),
    daftarEkspor: catat("ekspor-daftar", { siap: [], tidakSiap: [] }),
    buatPaketEkspor: catat("ekspor", { nama: "abt-ubahan-20261106", zip: Buffer.from("PK-uji"), berkas: 2, potongan: 5, tidakSiap: [{ id: "y" }], sidikBerkas: [{ id: "x", md5Lama: "1", md5Baru: "2" }] }),
    simpanSetelanSinkronAbt: catat("setelan", { jadwal: true, jam: "23:00", izinJamKerja: false }),
    putuskanBeda: catat("putuskan", { id: "x.rtf", pilihan: "tetap", nomor: 0 }),
  };
});

import { GET, POST } from "@/app/api/aleta-abt/sinkron/route";
import type { UserPersona } from "@/lib/types";

function akun(roleId: string, positionId = "", additionalRoleIds: string[] = []): UserPersona {
  return {
    id: `usr-${roleId}`,
    username: roleId,
    password: "",
    name: `Uji ${roleId}`,
    email: `${roleId}@uji.lokal`,
    roleId,
    positionId,
    additionalRoleIds,
    isActive: true,
  } as unknown as UserPersona;
}

const BUKAN_SUPER_ADMIN = {
  admin: akun("admin", "pos-pranata-komputer"),
  ketua: akun("ketua", "pos-ketua"),
  hakim: akun("hakim", "pos-hakim"),
  panitera: akun("panitera", "pos-panitera"),
  panmud: akun("panitera-muda", "pos-panitera-muda-gugatan"),
  pp: akun("panitera-pengganti", "pos-panitera-pengganti"),
  js: akun("jurusita", "pos-jurusita"),
  kasir: akun("pelaksana", "pos-staf-umum", ["kasir"]),
  ptsp: akun("pelaksana", "pos-ptsp", ["petugas_ptsp"]),
  analis: akun("analis-perkara", "pos-analis-perkara"),
};
const SUPER_ADMIN = akun("super-admin", "pos-pranata-komputer");

const BAGIAN_GET = ["", "setelan", "beda", "ekspor-daftar", "ekspor"];
const get = (bagian: string) => GET(new NextRequest(`http://localhost/api/aleta-abt/sinkron?${bagian ? `bagian=${bagian}&` : ""}id=${encodeURIComponent("1 Cerai/[01] Kabul.rtf")}`));
const post = (badan: Record<string, unknown>) =>
  POST(new NextRequest("http://localhost/api/aleta-abt/sinkron", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(badan) }));
const TINDAKAN_POST = [
  { tindakan: "setelan", jadwal: true },
  { tindakan: "putuskan", id: "x.rtf", pilihan: "tetap", md5Abt: "bbb", md5Aleta: "aaa" },
  { tindakan: "putuskan", id: "x.rtf", pilihan: "ambil", md5Abt: "bbb", md5Aleta: "aaa" },
];

beforeEach(() => {
  keadaan.aktor = null;
  keadaan.panggil = [];
  keadaan.audit = [];
});

describe("peran selain Super Admin: 403 di setiap bagian dan tindakan, layanan tidak tersentuh", () => {
  for (const [nama, a] of Object.entries(BUKAN_SUPER_ADMIN)) {
    it(`${nama}`, async () => {
      keadaan.aktor = a as unknown as Record<string, unknown>;
      for (const bagian of BAGIAN_GET) expect((await get(bagian)).status, `GET ${bagian || "ringkas"}`).toBe(403);
      for (const t of TINDAKAN_POST) expect((await post(t)).status, `POST ${t.tindakan}`).toBe(403);
      expect(keadaan.panggil).toEqual([]);
      expect(keadaan.audit).toEqual([]);
    });
  }
  it("tanpa akun masuk: 401", async () => {
    expect((await get("")).status).toBe(401);
    expect((await post(TINDAKAN_POST[0])).status).toBe(401);
    expect(keadaan.panggil).toEqual([]);
  });
  it("rute tidak memakai saklar ALETA ABT di HP dan penjaga dipanggil lebih dulu di kedua penangan", () => {
    const sumber = readFileSync(path.join(process.cwd(), "src/app/api/aleta-abt/sinkron/route.ts"), "utf8");
    expect(sumber).not.toMatch(/hak-hp|hakAbtHp|bolehBlangkoDerry/);
    expect(sumber).toContain('roleId !== "super-admin"');
    for (const penangan of ["GET", "POST"]) {
      const potong = sumber.slice(sumber.indexOf(`export async function ${penangan}`));
      expect(potong.indexOf("aktorSuperAdmin(request)")).toBeGreaterThan(-1);
      expect(potong.indexOf("aktorSuperAdmin(request)")).toBeLessThan(potong.indexOf("getSearchParam") === -1 ? 1e9 : potong.indexOf("getSearchParam"));
    }
  });
  it("rute tidak menulis ke ABT/SIPP dan tidak memasang paket: tanpa bot, tanpa ssh, tanpa penulisan berkas", () => {
    const sumber = readFileSync(path.join(process.cwd(), "src/app/api/aleta-abt/sinkron/route.ts"), "utf8");
    expect(sumber).not.toMatch(/panggilBot|child_process|writeFile|execSync|spawn|ssh /);
  });
});

describe("Super Admin", () => {
  beforeEach(() => {
    keadaan.aktor = SUPER_ADMIN as unknown as Record<string, unknown>;
  });

  it("semua bagian GET dijawab; buka beda dan unduh paket tercatat di audit tanpa isi blangko", async () => {
    for (const bagian of ["", "setelan", "beda", "ekspor-daftar"]) expect((await get(bagian)).status, bagian || "ringkas").toBe(200);
    const unduh = await get("ekspor");
    expect(unduh.status).toBe(200);
    expect(keadaan.panggil).toEqual(["ringkas", "setelan-baca", "beda", "ekspor-daftar", "ekspor"]);
    expect(keadaan.audit.map((a) => a.action)).toEqual(["ALETA_ABT_BEDA_BUKA", "ALETA_ABT_BEDA_EKSPOR"]);
    expect(keadaan.audit[0]).toMatchObject({ entityId: "1 Cerai/[01] Kabul.rtf", payload: { md5Aleta: "aaa", md5Abt: "bbb" } });
    expect(keadaan.audit[1]).toMatchObject({ entityType: "aleta_abt_paket", entityId: "abt-ubahan-20261106", payload: { berkas: 2, potongan: 5, tidakSiap: 1, dipasang: false } });
    expect(JSON.stringify(keadaan.audit)).not.toMatch(/"isi"|"teks"|rtf1/);
  });

  it("unduhan berupa ZIP, tidak disimpan di cache, nama berkas dari paket", async () => {
    const r = await get("ekspor");
    expect(r.headers.get("content-type")).toBe("application/zip");
    expect(r.headers.get("content-disposition")).toBe('attachment; filename="abt-ubahan-20261106.zip"');
    expect(r.headers.get("cache-control")).toMatch(/no-store/);
    expect(Buffer.from(await r.arrayBuffer()).toString()).toBe("PK-uji");
  });

  it("tiga tindakan POST dijalankan dan masing-masing tercatat", async () => {
    for (const t of TINDAKAN_POST) expect((await post(t)).status, t.tindakan).toBe(200);
    expect(keadaan.panggil).toEqual(["setelan", "putuskan", "putuskan"]);
    expect(keadaan.audit.map((a) => a.action)).toEqual(["ALETA_ABT_SINKRON_SETELAN", "ALETA_ABT_BEDA_TETAP", "ALETA_ABT_BEDA_AMBIL"]);
    expect(keadaan.audit[0].payload).toEqual({ jadwal: true, jam: "23:00", izinJamKerja: false });
    expect(keadaan.audit[2].payload).toMatchObject({ pilihan: "ambil", md5Abt: "bbb", md5Aleta: "aaa" });
  });

  it("masukan tidak sah ditolak 400 tanpa menyentuh layanan", async () => {
    expect((await post({ tindakan: "putuskan", pilihan: "tetap" })).status).toBe(400);
    expect((await post({ tindakan: "putuskan", id: "x.rtf", pilihan: "hapus" })).status).toBe(400);
    expect((await post({ tindakan: "hapus-semua" })).status).toBe(400);
    expect((await GET(new NextRequest("http://localhost/api/aleta-abt/sinkron?bagian=beda"))).status).toBe(400);
    expect((await GET(new NextRequest("http://localhost/api/aleta-abt/sinkron?bagian=ngawur"))).status).toBe(400);
    expect(keadaan.panggil).toEqual([]);
  });
});
