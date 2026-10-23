// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * ============================================================================
 * KEPUTUSAN PENGGUNA 23 OKT 2026 ATAS AUDIT HAK (agen W67, butir 2-5) - SERVER & MATRIKS
 * ============================================================================
 *   2. "Lihat sebagai akun" = Super Admin DAN Admin (peta hak akses dibetulkan).
 *   3. PTSP memegang "permintaan" (tarik satu perkara di Kendali Berkas) sebagai bawaan; pencabutan per orang tetap berlaku.
 *   4. Catat kehadiran pihak (POST antrian/hadir) = aksi sidang.antrian; membaca tetap semua pemegang panel.
 *   5. Catat kirim laporan perkara LIPA (POST aleta-penilaian/laporan) = Panitera, Panmud, Admin, Super Admin.
 * Layarnya diuji di audit-hak-keputusan-23okt-layar.test.tsx.
 */

const keadaan = vi.hoisted(() => ({
  aktor: null as Record<string, unknown> | null,
  hadir: 0,
  laporan: 0,
  pengecualian: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/server/db/client", () => ({
  getDatabase: async () => ({
    queryOne: async () => null,
    queryAll: async () => [],
    prepare: (sql: string) => ({
      all: async () => (sql.includes("ecourt_extension_access_user") ? keadaan.pengecualian : []),
      get: async () => null,
      run: async () => ({ changes: 0 }),
    }),
  }),
  withTransaction: async (_db: unknown, f: (t: unknown) => unknown) => f(_db),
}));
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => "usr_uji" }));
vi.mock("@/server/modules/organization/service", () => ({
  requireActorUser: async () => {
    if (!keadaan.aktor) throw Object.assign(new Error("tanpa aktor"), { status: 401 });
    return keadaan.aktor;
  },
  getUserByIdFromDb: async () => keadaan.aktor,
  getPositionByIdFromDb: async () => null,
}));
vi.mock("@/server/shared/admin-access-audit", async () => {
  const { NextResponse } = await import("next/server");
  return {
    handleAdminRouteError: (galat: { status?: number; message?: string }) =>
      NextResponse.json({ ok: false, error: { message: String(galat && galat.message) } }, { status: Number(galat && galat.status) || 500 }),
  };
});
vi.mock("@/server/modules/aleta-bot/whatsapp-gateway-client", async (asli) => ({
  ...(await asli<Record<string, unknown>>()),
  catatKehadiranAntrian: async () => {
    keadaan.hadir += 1;
    return { ok: true, data: { ok: true, sebutan: "Penggugat" } };
  },
  getGatewayPeranAntrian: async () => ({ ok: true, data: { peran: [] } }),
  postGatewayCatatLaporanPerkara: async () => {
    keadaan.laporan += 1;
    return { ok: true, data: { ok: true } };
  },
  getGatewayDaftarLaporanPerkara: async () => ({ ok: true, data: { lipa: [] } }),
  getGatewayBlangkoLaporanPerkara: async () => ({ ok: true, data: {} }),
}));

import { bolehAksi } from "@/lib/matriks-peran";
import { susunPetaHakAkses } from "@/lib/hak-akses-peta";
import type { UserPersona } from "@/lib/types";
import { kapabilitasPengguna } from "@/server/modules/aleta-ecourt/akses";

function akun(roleId: string, positionId = "", additionalRoleIds: string[] = []): UserPersona {
  return {
    id: `usr-${roleId}-${positionId}-${additionalRoleIds.join("+")}`,
    username: roleId,
    password: "",
    name: `Uji ${roleId}`,
    email: "",
    roleId,
    positionId,
    additionalRoleIds,
    isActive: true,
  } as unknown as UserPersona;
}

const AKUN = {
  superadmin: akun("super-admin", "pos-pranata-komputer"),
  admin: akun("admin", "pos-pranata-komputer"),
  ketua: akun("ketua", "pos-ketua"),
  wakil: akun("wakil-ketua", "pos-wakil"),
  hakim: akun("hakim", "pos-hakim"),
  panitera: akun("panitera", "pos-panitera"),
  panmudHukum: akun("panitera-muda", "pos-panitera-muda-hukum"),
  pp: akun("panitera-pengganti", "pos-panitera-pengganti"),
  js: akun("jurusita", "pos-jurusita"),
  analis: akun("analis-perkara", "pos-analis-perkara"),
  kasir: akun("pelaksana", "pos-staf-umum", ["kasir"]),
  ptsp: akun("pelaksana", "pos-ptsp", ["petugas_ptsp"]),
  operator: akun("operator", "pos-staf-umum"),
  meja1: akun("pelaksana", "pos-staf-umum", ["petugas_meja_1_gugatan"]),
  mediator: akun("pelaksana", "pos-staf-umum", ["mediator"]),
  penjaga: akun("pelaksana", "pos-staf-umum", ["penjaga_sidang"]),
  sekretaris: akun("sekretaris", "pos-sekretaris"),
  ti: akun("pranata-komputer", "pos-pranata-komputer"),
  staf: akun("pelaksana", "pos-staf-umum"),
};
type NamaAkun = keyof typeof AKUN;
const SEMUA = Object.keys(AKUN) as NamaAkun[];

afterEach(() => {
  keadaan.aktor = null;
  keadaan.hadir = 0;
  keadaan.laporan = 0;
  keadaan.pengecualian = [];
});

const minta = (url: string, method = "GET", body: unknown = {}) =>
  new NextRequest(`http://127.0.0.1:3000/aleta${url}`, {
    method,
    headers: { "content-type": "application/json" },
    body: method === "GET" ? undefined : JSON.stringify(body),
  });

const sebagai = (n: NamaAkun) => {
  keadaan.aktor = AKUN[n] as unknown as Record<string, unknown>;
};

describe("2. Lihat sebagai akun - Super Admin dan Admin", () => {
  it("peta hak akses mencatat Admin ikut", () => {
    const butir = susunPetaHakAkses().find((b) => b.id === "fitur.lihat-sebagai");
    expect(butir?.hak["super-admin"]).toBe("U");
    expect(butir?.hak.admin).toBe("U");
    expect(butir?.hak.hakim).toBeUndefined();
  });
});

describe("3. PTSP memegang 'permintaan' (tarik satu perkara) sebagai bawaan", () => {
  it("golongan PTSP (jabatan, peran tambahan, Operator, Meja 1) mendapat permintaan; kasir/kesekretariatan tidak", async () => {
    const db = await (await import("@/server/db/client")).getDatabase();
    for (const n of ["ptsp", "operator", "meja1"] as const) {
      const k = await kapabilitasPengguna(db as never, AKUN[n] as never);
      expect(k.permintaan, n).toBe(true);
      // Hanya menambah "permintaan": berkas & blangko tetap seperti bawaan perannya.
      expect(k["blangko-abt"], n).toBe(false);
    }
    for (const n of ["kasir", "sekretaris", "staf", "penjaga"] as const) {
      expect((await kapabilitasPengguna(db as never, AKUN[n] as never)).permintaan, n).toBe(false);
    }
    for (const n of ["hakim", "pp", "js"] as const) {
      expect((await kapabilitasPengguna(db as never, AKUN[n] as never)).permintaan, n).toBe(true);
    }
  });

  it("pengecualian per orang tetap dapat mencabutnya", async () => {
    const db = await (await import("@/server/db/client")).getDatabase();
    keadaan.pengecualian = [{ user_id: AKUN.ptsp.id, capability: "permintaan", enabled: 0, alasan: "uji", berlaku_sampai: null, updated_at: "", updated_by: "" }];
    expect((await kapabilitasPengguna(db as never, AKUN.ptsp as never)).permintaan).toBe(false);
  });

  it("matriks berkas.tarik memuat PTSP (layar dan server kini selaras)", () => {
    expect(bolehAksi(AKUN.ptsp, "berkas.tarik")).toBe(true);
  });
});

const HADIR_BOLEH: NamaAkun[] = ["superadmin", "admin", "ketua", "wakil", "hakim", "panitera", "panmudHukum", "pp", "ptsp", "operator", "meja1", "penjaga"];
const HADIR_TOLAK: NamaAkun[] = ["js", "analis", "kasir", "mediator", "sekretaris", "ti", "staf"];

describe("4. catat kehadiran pihak di layar Ambil Antrian = sidang.antrian", () => {
  it("rute POST: 403 tanpa mencatat bagi yang tidak berhak; berhak mencatat; GET tetap terbuka", async () => {
    expect([...HADIR_BOLEH, ...HADIR_TOLAK].sort()).toEqual([...SEMUA].sort());
    const { GET, POST } = await import("@/app/api/aleta-ecourt/antrian/hadir/route");
    const badan = { perkaraId: "77", nomorPerkara: "600/Pdt.G/2026/PA.Dgl", peran: "pihak_1", urutanPihak: "1" };
    for (const n of HADIR_TOLAK) {
      sebagai(n);
      expect(bolehAksi(AKUN[n], "sidang.antrian"), n).toBe(false);
      expect((await POST(minta("/api/aleta-ecourt/antrian/hadir", "POST", badan))).status, n).toBe(403);
      expect((await GET(minta("/api/aleta-ecourt/antrian/hadir"))).status, `${n} GET`).not.toBe(403);
    }
    expect(keadaan.hadir).toBe(0);
    for (const n of HADIR_BOLEH) {
      sebagai(n);
      expect(bolehAksi(AKUN[n], "sidang.antrian"), n).toBe(true);
      expect((await POST(minta("/api/aleta-ecourt/antrian/hadir", "POST", badan))).status, n).toBe(200);
    }
    expect(keadaan.hadir).toBe(HADIR_BOLEH.length);
  });
});

const LIPA_BOLEH: NamaAkun[] = ["superadmin", "admin", "panitera", "panmudHukum"];

describe("5. catat kirim laporan perkara (LIPA) = Panitera, Panmud, Admin, Super Admin", () => {
  it("rute POST per peran", async () => {
    const { POST } = await import("@/app/api/aleta-penilaian/laporan/route");
    const badan = { lipaNomor: 1, bulanLaporan: "2026-09", tanggalKirim: "2026-10-05", angkaLaporan: 12 };
    for (const n of SEMUA) {
      sebagai(n);
      const boleh = LIPA_BOLEH.includes(n);
      expect(bolehAksi(AKUN[n], "penilaian.catat-laporan"), n).toBe(boleh);
      const r = await POST(minta("/api/aleta-penilaian/laporan", "POST", badan));
      if (boleh) expect(r.status, n).not.toBe(403);
      else expect(r.status, n).toBe(403);
    }
    expect(keadaan.laporan).toBe(LIPA_BOLEH.length);
  });
});
