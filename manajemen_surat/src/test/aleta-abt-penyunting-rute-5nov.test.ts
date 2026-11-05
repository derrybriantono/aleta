// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ============================================================================
 * RUTE PENYUNTING BLANGKO ALETA ABT (5 Nov 2026, Tahap 3): HANYA SUPER ADMIN, DIJAGA DI SERVER, TERCATAT DI AUDIT
 * ============================================================================
 * Keputusan pemilik: ALETA ABT hanya Super Admin sampai stabil. Saklar ALETA ABT di HP hanya izin membuka dari HP dan
 * tidak boleh membuka penyunting. Yang diuji: peran lain 403 di SETIAP bagian GET dan SETIAP tindakan POST (layanan tidak
 * tersentuh sama sekali), Super Admin lolos, mutasi/buka tercatat tanpa isi blangko.
 */

const keadaan = vi.hoisted(() => ({
  aktor: null as Record<string, unknown> | null,
  panggil: [] as string[],
  audit: [] as Array<{ action: string; entityId: string; payload: Record<string, unknown> }>,
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
  appendAuditLog: async (_db: unknown, e: { action: string; entityId: string; payload: Record<string, unknown> }) => {
    keadaan.audit.push({ action: e.action, entityId: e.entityId, payload: e.payload });
  },
}));
vi.mock("@/server/shared/ids", () => ({ nextPrefixedId: async () => "adt-uji" }));
vi.mock("@/server/modules/aleta-abt-penyunting/service", () => {
  const catat = (nama: string, hasil: unknown) => async () => {
    keadaan.panggil.push(nama);
    return hasil;
  };
  return {
    daftarBlangko: catat("daftar", { folder: [] }),
    daftarIsian: catat("isian", []),
    bukaBlangko: catat("buka", { versi: { nomor: 3, md5: "abc" } }),
    riwayatVersi: catat("riwayat", { versi: [] }),
    bedaAntarVersi: catat("beda", { baris: [] }),
    cobaBlangko: catat("coba", { versi: 3, paragraf: [] }),
    simpanSuntingan: catat("simpan", { nomor: 4, md5: "m", ukuran: 10, ringkas: "1 paragraf diubah" }),
    pulihkanVersi: catat("pulih", { nomor: 5, dariNomor: 1, md5: "m" }),
    terbitkanVersi: catat("terbit", { nomor: 5, md5: "m" }),
  };
});

import { GET, POST } from "@/app/api/aleta-abt/penyunting/route";
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

const BAGIAN_GET = ["", "isian", "blangko", "riwayat", "beda", "coba"];
const get = (bagian: string, tambah = "") =>
  GET(new NextRequest(`http://localhost/api/aleta-abt/penyunting?${bagian ? `bagian=${bagian}&` : ""}id=${encodeURIComponent("1 Cerai/[01] Kabul.rtf")}&a=1&b=2${tambah}`));
const post = (badan: Record<string, unknown>) =>
  POST(new NextRequest("http://localhost/api/aleta-abt/penyunting", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(badan) }));
const TINDAKAN_POST = [
  { tindakan: "simpan", id: "x.rtf", dasarNomor: 1, suntingan: [{ i: 0, teks: "x" }] },
  { tindakan: "pulihkan", id: "x.rtf", nomor: 1 },
  { tindakan: "terbitkan", id: "x.rtf", nomor: 2 },
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
      for (const bagian of BAGIAN_GET) expect((await get(bagian)).status, `GET ${bagian || "daftar"}`).toBe(403);
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
  it("saklar ALETA ABT di HP tidak ikut menentukan: rute tidak memakai hak-hp sama sekali", () => {
    const sumber = readFileSync(path.join(process.cwd(), "src/app/api/aleta-abt/penyunting/route.ts"), "utf8");
    expect(sumber).not.toMatch(/hak-hp|hakAbtHp|bolehBlangkoDerry/);
    expect(sumber).toContain('roleId !== "super-admin"');
    // Penjaga dipanggil lebih dulu di kedua penangan.
    for (const penangan of ["GET", "POST"]) {
      const potong = sumber.slice(sumber.indexOf(`export async function ${penangan}`));
      expect(potong.indexOf("aktorSuperAdmin(request)")).toBeGreaterThan(-1);
      expect(potong.indexOf("aktorSuperAdmin(request)")).toBeLessThan(potong.indexOf("getSearchParam") === -1 ? 1e9 : potong.indexOf("getSearchParam"));
    }
  });
});

describe("Super Admin", () => {
  beforeEach(() => {
    keadaan.aktor = SUPER_ADMIN as unknown as Record<string, unknown>;
  });
  it("semua bagian GET dijawab; hanya buka dan coba yang tercatat di audit", async () => {
    for (const bagian of BAGIAN_GET) expect((await get(bagian)).status, bagian || "daftar").toBe(200);
    expect(keadaan.panggil).toEqual(["daftar", "isian", "buka", "riwayat", "beda", "coba"]);
    expect(keadaan.audit.map((a) => a.action)).toEqual(["ALETA_ABT_BLANGKO_BUKA", "ALETA_ABT_BLANGKO_COBA"]);
    expect(keadaan.audit[0].entityId).toBe("1 Cerai/[01] Kabul.rtf");
  });
  it("tiga tindakan POST dijalankan dan masing-masing tercatat tanpa isi blangko", async () => {
    for (const t of TINDAKAN_POST) expect((await post(t)).status, t.tindakan).toBe(200);
    expect(keadaan.panggil).toEqual(["simpan", "pulih", "terbit"]);
    expect(keadaan.audit.map((a) => a.action)).toEqual(["ALETA_ABT_BLANGKO_SIMPAN", "ALETA_ABT_BLANGKO_PULIH", "ALETA_ABT_BLANGKO_TERBIT"]);
    expect(JSON.stringify(keadaan.audit)).not.toMatch(/"isi"|"teks"|suntingan/);
    expect(keadaan.audit[0].payload).toMatchObject({ nomor: 4, ringkas: "1 paragraf diubah" });
  });
  it("masukan tidak sah ditolak 400 tanpa menyentuh layanan", async () => {
    expect((await post({ tindakan: "simpan", suntingan: [{ i: 0, teks: "x" }] })).status).toBe(400);
    expect((await post({ tindakan: "simpan", id: "x.rtf", dasarNomor: 1, suntingan: [] })).status).toBe(400);
    expect((await post({ tindakan: "hapus-semua", id: "x.rtf" })).status).toBe(400);
    expect((await GET(new NextRequest("http://localhost/api/aleta-abt/penyunting?bagian=blangko"))).status).toBe(400);
    expect((await GET(new NextRequest("http://localhost/api/aleta-abt/penyunting?bagian=beda&id=x.rtf&a=1"))).status).toBe(400);
    expect((await GET(new NextRequest("http://localhost/api/aleta-abt/penyunting?bagian=ngawur"))).status).toBe(400);
    expect(keadaan.panggil).toEqual([]);
  });
});
