// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ============================================================================
 * RUTE PINDAH KE ALETA ABT (TAHAP 8): HANYA SUPER ADMIN, DIJAGA DI SERVER (5 Nov 2026)
 * ============================================================================
 * Akun tiap peran selain Super Admin ditolak 403 di SETIAP tindakan dan layanan di baliknya tidak tersentuh. Super Admin: membuka, mengubah
 * tombol, penolakan karena syarat belum terpenuhi, dan memuat hasil pengukuran semuanya tercatat di audit TANPA isi naskah dan nama pihak.
 * Data rekaan.
 */

const keadaan = vi.hoisted(() => ({
  aktor: null as unknown,
  panggil: [] as string[],
  audit: [] as Array<{ action: string; entityId: string; entityType: string; payload: Record<string, unknown> }>,
  siap: new Set<string>(),
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
  appendAuditLog: async (_db: unknown, e: { action: string; entityId: string; entityType: string; payload: Record<string, unknown> }) => {
    keadaan.audit.push({ action: e.action, entityId: e.entityId, entityType: e.entityType, payload: e.payload });
  },
}));
vi.mock("@/server/shared/ids", () => ({ nextPrefixedId: async () => "adt-uji" }));
vi.mock("@/server/modules/aleta-abt-pindah/service", async () => {
  const { ApiError } = await import("@/server/shared/errors");
  return {
    bacaKeadaanPindah: async () => {
      keadaan.panggil.push("baca");
      return { keluarga: [], laporan: { ada: false, dibuat: "", keterangan: "", dimuatOleh: "", dimuatPada: "" }, dimatikanServer: false, menyala: 0, siap: keadaan.siap.size, terukur: 0 };
    },
    ubahSaklarPindah: async (_db: unknown, _a: unknown, kunci: string, aktif: boolean) => {
      keadaan.panggil.push(`saklar:${kunci}:${aktif}`);
      if (kunci === "tidak-ada") throw new ApiError(400, "Jenis perkara tidak dikenal.");
      if (aktif && !keadaan.siap.has(kunci)) throw new ApiError(409, "Saklar belum dapat dinyalakan. syarat belum terpenuhi");
      return { keluarga: kunci, aktif, diubahOleh: "Derry", diubahPada: "t" };
    },
    simpanLaporanUkur: async (_db: unknown, _a: unknown, laporan: unknown) => {
      keadaan.panggil.push("laporan");
      if (!laporan || typeof laporan !== "object") throw new ApiError(400, "Berkas ini bukan hasil pengukuran semua jenis perkara.");
      return { keluarga: 33, terukur: 21, dibuat: "2026-11-05T10:00:00Z" };
    },
  };
});

import { GET, POST } from "@/app/api/aleta-abt/pindah/route";
import type { UserPersona } from "@/lib/types";

function akun(roleId: string, positionId = "", additionalRoleIds: string[] = []): UserPersona {
  return { id: "usr_uji", username: roleId, password: "", name: `Uji ${roleId}`, email: `${roleId}@uji.lokal`, roleId, positionId, additionalRoleIds, isActive: true } as unknown as UserPersona;
}

const SUPER = akun("super-admin");
const BUKAN_SUPER_ADMIN: Record<string, UserPersona> = {
  admin: akun("admin", "pos-pranata-komputer"),
  ketua: akun("ketua", "pos-ketua"),
  wakil: akun("wakil-ketua", "pos-wakil"),
  hakim: akun("hakim", "pos-hakim"),
  panitera: akun("panitera", "pos-panitera"),
  panmud: akun("panitera-muda", "pos-panitera-muda-gugatan"),
  pp: akun("panitera-pengganti", "pos-panitera-pengganti"),
  jurusita: akun("jurusita", "pos-jurusita"),
  kasir: akun("pelaksana", "pos-staf-umum", ["kasir"]),
  ptsp: akun("pelaksana", "pos-ptsp", ["petugas_ptsp"]),
  mediator: akun("pelaksana", "pos-staf-umum", ["mediator"]),
  analis: akun("analis-perkara", "pos-analis-perkara"),
  sekretaris: akun("sekretaris", "pos-sekretaris"),
  pranata: akun("pranata-komputer", "pos-pranata-komputer"),
  staf: akun("staf", "pos-staf-umum"),
  operator: akun("operator", "pos-ptsp"),
};

const alamat = "http://localhost/api/aleta-abt/pindah";
const get = () => new NextRequest(alamat);
const post = (badan: unknown) => new NextRequest(alamat, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(badan) });

const PERMINTAAN: Array<[string, () => Promise<Response>]> = [
  ["GET", () => GET(get())],
  ["POST saklar nyalakan", () => POST(post({ tindakan: "saklar", keluarga: "cerai-gugat", aktif: true }))],
  ["POST saklar matikan", () => POST(post({ tindakan: "saklar", keluarga: "cerai-gugat", aktif: false }))],
  ["POST laporan", () => POST(post({ tindakan: "laporan", laporan: { keluarga: [] } }))],
];

beforeEach(() => {
  keadaan.aktor = SUPER;
  keadaan.panggil = [];
  keadaan.audit = [];
  keadaan.siap = new Set();
});

describe("akun tiap peran selain Super Admin ditolak 403 di server, layanan tidak tersentuh", () => {
  for (const [nama, a] of Object.entries(BUKAN_SUPER_ADMIN)) {
    it(`${nama}: ${PERMINTAAN.length} permintaan semuanya 403`, async () => {
      keadaan.aktor = a;
      for (const [label, minta] of PERMINTAAN) expect((await minta()).status, `${nama} -> ${label}`).toBe(403);
      expect(keadaan.panggil, nama).toEqual([]);
      expect(keadaan.audit, nama).toEqual([]);
    });
  }
  it("tanpa akun masuk: 401, layanan tidak tersentuh", async () => {
    keadaan.aktor = null;
    for (const [label, minta] of PERMINTAAN) expect((await minta()).status, label).toBe(401);
    expect(keadaan.panggil).toEqual([]);
  });
  it("pilihan peran lewat alamat atau badan tidak memberi hak: diputuskan dari peran akunnya", async () => {
    keadaan.aktor = BUKAN_SUPER_ADMIN.hakim;
    expect((await GET(new NextRequest(`${alamat}?sebagai=super-admin&peran=super-admin`))).status).toBe(403);
    expect((await POST(post({ tindakan: "saklar", keluarga: "cerai-gugat", aktif: true, sebagai: "super-admin", roleId: "super-admin" }))).status).toBe(403);
    expect(keadaan.panggil).toEqual([]);
  });
});

describe("Super Admin", () => {
  it("membaca kesiapan: tercatat dengan angka saja", async () => {
    const r = await GET(get());
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(keadaan.audit).toHaveLength(1);
    expect(keadaan.audit[0]).toMatchObject({ action: "ALETA_ABT_PINDAH_BACA", entityType: "aleta_abt_alur", payload: { menyala: 0, siap: 0, terukur: 0 } });
  });

  it("menyalakan yang belum memenuhi syarat: 409, tercatat sebagai penolakan, tidak ada catatan menyala", async () => {
    const r = await POST(post({ tindakan: "saklar", keluarga: "cerai-gugat", aktif: true }));
    expect(r.status).toBe(409);
    expect(((await r.json()) as { error: { message: string } }).error.message).toContain("belum dapat dinyalakan");
    expect(keadaan.audit.map((a) => a.action)).toEqual(["ALETA_ABT_PINDAH_SAKLAR_DITOLAK"]);
    expect(keadaan.audit[0]).toMatchObject({ entityId: "cerai-gugat", payload: { aktif: true } });
  });

  it("menyalakan yang memenuhi syarat dan mematikan: tercatat dengan penanda jenis saja", async () => {
    keadaan.siap.add("cerai-talak");
    expect((await POST(post({ tindakan: "saklar", keluarga: "cerai-talak", aktif: true }))).status).toBe(200);
    expect((await POST(post({ tindakan: "saklar", keluarga: "cerai-talak", aktif: false }))).status).toBe(200);
    expect(keadaan.audit.map((a) => [a.action, a.entityId, a.payload])).toEqual([
      ["ALETA_ABT_PINDAH_SAKLAR", "cerai-talak", { aktif: true }],
      ["ALETA_ABT_PINDAH_SAKLAR", "cerai-talak", { aktif: false }],
    ]);
  });

  it("masukan tak sah ditolak: jenis tak dikenal, aktif bukan boolean, tindakan lain, badan bukan JSON", async () => {
    expect((await POST(post({ tindakan: "saklar", keluarga: "tidak-ada", aktif: true }))).status).toBe(400);
    expect((await POST(post({ tindakan: "saklar", keluarga: "cerai-gugat", aktif: "true" }))).status).toBe(400);
    expect((await POST(post({ tindakan: "saklar", keluarga: "cerai-gugat" }))).status).toBe(400);
    expect((await POST(post({ tindakan: "lain" }))).status).toBe(400);
    expect((await POST(new NextRequest(alamat, { method: "POST", body: "bukan json" }))).status).toBe(400);
    expect(keadaan.audit.filter((a) => a.action === "ALETA_ABT_PINDAH_SAKLAR")).toEqual([]);
  });

  it("memuat hasil pengukuran: tercatat dengan angka; yang bukan hasil pengukuran ditolak", async () => {
    expect((await POST(post({ tindakan: "laporan", laporan: { keluarga: [{ kunci: "cerai-gugat" }] } }))).status).toBe(200);
    expect(keadaan.audit[0]).toMatchObject({ action: "ALETA_ABT_PINDAH_LAPORAN", payload: { keluarga: 33, terukur: 21 } });
    expect((await POST(post({ tindakan: "laporan" }))).status).toBe(400);
  });

  it("tidak ada kalimat naskah atau nama pihak di catatan audit", async () => {
    keadaan.siap.add("kewarisan");
    await POST(post({ tindakan: "saklar", keluarga: "kewarisan", aktif: true, nama: "Budi Santoso" }));
    await POST(post({ tindakan: "laporan", laporan: { keluarga: [], posita: "isi gugatan rahasia" } }));
    const tulis = JSON.stringify(keadaan.audit);
    expect(tulis).not.toContain("Budi");
    expect(tulis).not.toContain("rahasia");
  });
});
