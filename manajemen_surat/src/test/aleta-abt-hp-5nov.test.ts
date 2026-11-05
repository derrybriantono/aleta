// @vitest-environment node
/**
 * ALETA ABT di HP (5 Nov 2026): aturan hak murni, penjagaan rute (bukan Super Admin ditolak mengubah),
 * penyimpanan di aleta_ekstensi_setelan tanpa migrasi, dan penampilan menu portal. Tanpa data pihak nyata.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  KUNCI_ABT_HP,
  alamatPanelAbt,
  bersihkanPengaturanAbtHp,
  hakAbtHp,
  hakPeranAbtHp,
  pilihanPenggunaAbtHp,
  terapkanMenuAletaAbt,
  terapkanUbahanAbtHp,
} from "@/lib/aleta-abt-hp";
import { PETA_ATURAN_APLIKASI } from "@/lib/matriks-peran";
import { portalApps, roles } from "@/lib/mock-data";
import { getAccessiblePortalApps } from "@/lib/permissions";
import { ApiError } from "@/server/shared/errors";

// ─── Aturan murni ────────────────────────────────────────────────────────────

describe("hak ALETA ABT di HP - aturan murni", () => {
  it("bawaan: hanya Super Admin menyala", () => {
    expect(hakAbtHp({ roleId: "super-admin", userId: "u1" }, null)).toEqual({ terbuka: true, sumber: "bawaan" });
    for (const r of roles.filter((x) => x.id !== "super-admin")) {
      expect(hakAbtHp({ roleId: r.id, userId: "u1" }, null), r.id).toEqual({ terbuka: false, sumber: "bawaan" });
    }
  });

  it("peran menimpa bawaan; pengguna menimpa peran", () => {
    const p = { peran: { hakim: true, "super-admin": false }, pengguna: { u9: false, u8: true } };
    expect(hakAbtHp({ roleId: "hakim", userId: "u1" }, p)).toEqual({ terbuka: true, sumber: "peran" });
    expect(hakAbtHp({ roleId: "super-admin", userId: "u1" }, p)).toEqual({ terbuka: false, sumber: "peran" });
    expect(hakAbtHp({ roleId: "hakim", userId: "u9" }, p)).toEqual({ terbuka: false, sumber: "pengguna" });
    expect(hakAbtHp({ roleId: "panitera", userId: "u8" }, p)).toEqual({ terbuka: true, sumber: "pengguna" });
    expect(hakAbtHp({ roleId: "panitera", userId: "u1" }, p)).toEqual({ terbuka: false, sumber: "bawaan" });
  });

  it("masukan rusak atau tidak terbaca = bawaan, tidak pernah menyalakan peran lain", () => {
    const rusak: unknown[] = [undefined, null, 5, "}{", "[]", "null", [], { peran: "x", pengguna: 3 }, { peran: { hakim: "true" } }, { peran: { hakim: 1 } }, "{\"peran\":[1]}"];
    for (const x of rusak) {
      expect(hakAbtHp({ roleId: "hakim", userId: "u1" }, x), JSON.stringify(x)).toEqual({ terbuka: false, sumber: "bawaan" });
      expect(hakAbtHp({ roleId: "super-admin", userId: "u1" }, x), JSON.stringify(x)).toEqual({ terbuka: true, sumber: "bawaan" });
    }
    expect(hakAbtHp(null, null)).toEqual({ terbuka: false, sumber: "bawaan" });
    expect(hakAbtHp({}, { peran: { "": true }, pengguna: { "": true } })).toEqual({ terbuka: false, sumber: "bawaan" });
  });

  it("bentuk JSON tersimpan terbaca; kunci berbahaya dan nilai bukan boolean dibuang", () => {
    const teks = JSON.stringify({ peran: { hakim: true, panitera: "ya" }, pengguna: { u1: true }, diubahOleh: "X", diubahPada: "2026-11-05" });
    const b = bersihkanPengaturanAbtHp(teks);
    expect(b.peran).toEqual({ hakim: true });
    expect(b.pengguna).toEqual({ u1: true });
    const racun = bersihkanPengaturanAbtHp('{"peran":{"__proto__":true,"constructor":true,"hakim":true}}');
    expect(Object.keys(racun.peran)).toEqual(["hakim"]);
    expect(({} as Record<string, unknown>).hakim).toBeUndefined();
    // Peran yang namanya sama dengan sifat bawaan objek tidak ikut "dimiliki".
    expect(hakPeranAbtHp("toString", { peran: {} })).toEqual({ terbuka: false, sumber: "bawaan" });
  });

  it("pilihan pengguna: ikuti / aktif / mati", () => {
    const p = { pengguna: { a: true, b: false } };
    expect(pilihanPenggunaAbtHp("a", p)).toBe("aktif");
    expect(pilihanPenggunaAbtHp("b", p)).toBe("mati");
    expect(pilihanPenggunaAbtHp("c", p)).toBe("ikuti");
    expect(pilihanPenggunaAbtHp("c", "rusak")).toBe("ikuti");
  });

  it("ubahan: peran dan pengguna disetel lalu dikembalikan ke bawaan/ikuti; ubahan tak sah ditolak", () => {
    let p = terapkanUbahanAbtHp(null, { jenis: "peran", id: "hakim", nilai: true }, "SA", "t1");
    p = terapkanUbahanAbtHp(p, { jenis: "pengguna", id: "u1", nilai: "mati" }, "SA", "t2");
    expect(p).toMatchObject({ peran: { hakim: true }, pengguna: { u1: false }, diubahOleh: "SA", diubahPada: "t2" });
    p = terapkanUbahanAbtHp(p, { jenis: "peran", id: "hakim", nilai: "bawaan" }, "SA", "t3");
    p = terapkanUbahanAbtHp(p, { jenis: "pengguna", id: "u1", nilai: "ikuti" }, "SA", "t3");
    expect(p.peran).toEqual({});
    expect(p.pengguna).toEqual({});
    expect(() => terapkanUbahanAbtHp(null, { jenis: "peran", id: "__proto__", nilai: true }, "SA", "t")).toThrow();
    expect(() => terapkanUbahanAbtHp(null, { jenis: "peran", id: "a b", nilai: true }, "SA", "t")).toThrow();
    expect(() => terapkanUbahanAbtHp(null, { jenis: "pengguna", id: "u1", nilai: "mungkin" as never }, "SA", "t")).toThrow();
    expect(() => terapkanUbahanAbtHp(null, { jenis: "peran", id: "hakim", nilai: "ya" as never }, "SA", "t")).toThrow();
  });

  it("alamat panel ABT sama dengan alamatAletaAbt() ekstensi: tanpa port portal, kecuali mesin setempat", () => {
    expect(alamatPanelAbt({ protocol: "http:", hostname: "192.168.10.10", origin: "http://192.168.10.10:3000" })).toBe(
      "http://192.168.10.10/aps_badilag/abt/main/beranda#aleta-derry=1"
    );
    expect(alamatPanelAbt({ protocol: "http:", hostname: "127.0.0.1", origin: "http://127.0.0.1:8056" })).toBe(
      "http://127.0.0.1:8056/aps_badilag/abt/main/beranda#aleta-derry=1"
    );
  });
});

// ─── Rute: penjagaan dan penyimpanan ─────────────────────────────────────────

const rute = vi.hoisted(() => ({
  aktor: { id: "u-sa", name: "Super Admin Uji", roleId: "super-admin", isActive: true } as Record<string, unknown>,
  setelan: new Map<string, string>(),
  audit: [] as Array<Record<string, unknown>>,
  gagal: [] as unknown[],
  pengguna: [
    { id: "u-sa", name: "Super Admin Uji", username: "sa", role_id: "super-admin" },
    { id: "u-hakim", name: "Hakim Uji", username: "hakim", role_id: "hakim" },
    { id: "u-pp", name: "Panitera Uji", username: "pp", role_id: "panitera-pengganti" },
  ],
}));

vi.mock("@/server/db/client", () => {
  const db: Record<string, unknown> = {
    isTransactionClient: () => false,
    queryOne: async (sql: string, params: unknown[]) => {
      if (/FROM aleta_ekstensi_setelan/.test(sql)) {
        const nilai = rute.setelan.get(`${params[0]}|${params[1]}`);
        return nilai === undefined ? null : { nilai };
      }
      if (/FROM users WHERE id = \?/.test(sql)) return rute.pengguna.find((u) => u.id === params[0]) ?? null;
      return null;
    },
    queryAll: async (sql: string, params: unknown[] = []) => {
      if (/FROM users/.test(sql) && /LIKE/.test(sql)) {
        const kata = String(params[0]).replace(/%/g, "");
        return rute.pengguna.filter((u) => u.name.toLowerCase().includes(kata) || u.username.includes(kata));
      }
      if (/FROM users/.test(sql) && /IN \(/.test(sql)) return rute.pengguna.filter((u) => params.includes(u.id));
      return [];
    },
    prepare: (sql: string) => ({
      run: async (...p: unknown[]) => {
        if (/INSERT INTO aleta_ekstensi_setelan/.test(sql)) rute.setelan.set(`${p[0]}|${p[1]}`, String(p[2]));
      },
    }),
  };
  return {
    getDatabase: async () => db,
    withTransaction: async (_db: unknown, fn: (tx: unknown) => Promise<unknown>) => fn(db),
  };
});
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => String(rute.aktor.id) }));
vi.mock("@/server/modules/organization/service", () => ({ requireActorUser: async () => rute.aktor }));
vi.mock("@/server/shared/audit", () => ({ appendAuditLog: async (_db: unknown, baris: Record<string, unknown>) => void rute.audit.push(baris) }));
vi.mock("@/server/shared/ids", () => ({ nextPrefixedId: async () => "adt-uji" }));
vi.mock("@/server/shared/admin-access-audit", () => ({
  handleAdminRouteError: (e: unknown) => {
    rute.gagal.push(e);
    const status = e instanceof ApiError ? e.status : 500;
    return new Response(JSON.stringify({ ok: false, alasan: String((e as Error)?.message || e) }), { status });
  },
}));

type Jawab = { status: number; isi: { ok: boolean; data?: any; alasan?: string } };
async function ambil(q = ""): Promise<Jawab> {
  const m = await import("@/app/api/aleta-abt/hak/route");
  const r = await m.GET({ nextUrl: new URL(`http://localhost/aleta/api/aleta-abt/hak${q}`), url: `http://localhost/aleta/api/aleta-abt/hak${q}` } as never);
  return { status: r.status, isi: await r.json() };
}
async function kirim(badan: unknown): Promise<Jawab> {
  const m = await import("@/app/api/aleta-abt/hak/route");
  const r = await m.POST({ json: async () => badan } as never);
  return { status: r.status, isi: await r.json() };
}
const jadi = (roleId: string, id = "u-x") => {
  rute.aktor = { id, name: `Akun ${roleId}`, roleId, isActive: true };
};

beforeEach(() => {
  rute.setelan.clear();
  rute.audit.length = 0;
  rute.gagal.length = 0;
  jadi("super-admin", "u-sa");
});

describe("rute /api/aleta-abt/hak", () => {
  it("membaca hak akun yang masuk: Super Admin bawaan menyala, peran lain mati", async () => {
    expect((await ambil()).isi.data).toEqual({ terbuka: true, sumber: "bawaan" });
    jadi("hakim", "u-hakim");
    expect((await ambil()).isi.data).toEqual({ terbuka: false, sumber: "bawaan" });
  });

  it("bukan Super Admin ditolak mengubah (peran, pengguna, juga Admin) dan tidak ada yang tersimpan", async () => {
    for (const roleId of ["admin", "hakim", "panitera-pengganti", "ketua"]) {
      jadi(roleId, "u-x");
      for (const badan of [
        { tindakan: "ubah-peran", id: "hakim", nilai: true },
        { tindakan: "ubah-pengguna", id: "u-hakim", nilai: "aktif" },
      ]) {
        const j = await kirim(badan);
        expect(j.status, `${roleId} ${badan.tindakan}`).toBe(403);
      }
    }
    expect(rute.setelan.size).toBe(0);
    expect(rute.audit).toHaveLength(0);
  });

  it("bukan Super Admin ditolak membaca layar pengaturan; Super Admin boleh", async () => {
    jadi("admin", "u-ad");
    expect((await ambil("?bagian=pengaturan")).status).toBe(403);
    jadi("super-admin", "u-sa");
    const j = await ambil("?bagian=pengaturan");
    expect(j.status).toBe(200);
    expect(j.isi.data.peran.length).toBe(roles.length);
    expect(j.isi.data.peran.find((p: { id: string }) => p.id === "super-admin")).toMatchObject({ menyala: true, sumber: "bawaan" });
    expect(j.isi.data.peran.find((p: { id: string }) => p.id === "hakim")).toMatchObject({ menyala: false, sumber: "bawaan" });
  });

  it("Super Admin menyimpan di aleta_ekstensi_setelan, tercatat di audit, dan hak akun berubah", async () => {
    const a = await kirim({ tindakan: "ubah-peran", id: "hakim", nilai: true });
    expect(a.status).toBe(200);
    const kunci = `*sistem*|${KUNCI_ABT_HP}`;
    expect(JSON.parse(rute.setelan.get(kunci)!)).toMatchObject({ peran: { hakim: true }, diubahOleh: "Akun super-admin" });
    expect(rute.audit).toHaveLength(1);
    expect(rute.audit[0]).toMatchObject({ actorUserId: "u-sa", action: "UPDATE_ALETA_ABT_HP", entityType: "aleta_ekstensi_setelan" });

    jadi("hakim", "u-hakim");
    expect((await ambil()).isi.data).toEqual({ terbuka: true, sumber: "peran" });

    // Pilihan pengguna menang atas peran.
    jadi("super-admin", "u-sa");
    expect((await kirim({ tindakan: "ubah-pengguna", id: "u-hakim", nilai: "mati" })).status).toBe(200);
    jadi("hakim", "u-hakim");
    expect((await ambil()).isi.data).toEqual({ terbuka: false, sumber: "pengguna" });

    // Kembali ke ikuti peran / bawaan.
    jadi("super-admin", "u-sa");
    await kirim({ tindakan: "ubah-pengguna", id: "u-hakim", nilai: "ikuti" });
    await kirim({ tindakan: "ubah-peran", id: "hakim", nilai: "bawaan" });
    jadi("hakim", "u-hakim");
    expect((await ambil()).isi.data).toEqual({ terbuka: false, sumber: "bawaan" });
    expect(rute.audit).toHaveLength(4);
  });

  it("pencarian pengguna menampilkan pilihan dan hak efektifnya", async () => {
    await kirim({ tindakan: "ubah-pengguna", id: "u-pp", nilai: "aktif" });
    const cari = await ambil("?bagian=pengaturan&cari=panitera");
    expect(cari.isi.data.pengguna).toEqual([{ id: "u-pp", nama: "Panitera Uji", peran: "panitera-pengganti", pilihan: "aktif", terbuka: true }]);
    // Tanpa kata cari: hanya yang punya pilihan sendiri.
    const tersimpan = await ambil("?bagian=pengaturan");
    expect(tersimpan.isi.data.pengguna.map((u: { id: string }) => u.id)).toEqual(["u-pp"]);
  });

  it("masukan tidak sah ditolak 400 tanpa menyimpan", async () => {
    expect((await kirim({ tindakan: "ubah-peran", id: "peran-ngawur", nilai: true })).status).toBe(400);
    expect((await kirim({ tindakan: "ubah-peran", id: "hakim", nilai: "mungkin" })).status).toBe(400);
    expect((await kirim({ tindakan: "ubah-pengguna", id: "tidak-ada", nilai: "aktif" })).status).toBe(400);
    expect((await kirim({ tindakan: "ubah-pengguna", id: "u-pp", nilai: true })).status).toBe(400);
    expect((await kirim({ tindakan: "lain" })).status).toBe(400);
    expect(rute.setelan.size).toBe(0);
  });

  it("setelan tersimpan yang rusak membuat semua kembali ke bawaan", async () => {
    rute.setelan.set(`*sistem*|${KUNCI_ABT_HP}`, "{bukan json");
    jadi("hakim", "u-hakim");
    expect((await ambil()).isi.data).toEqual({ terbuka: false, sumber: "bawaan" });
    jadi("super-admin", "u-sa");
    expect((await ambil()).isi.data).toEqual({ terbuka: true, sumber: "bawaan" });
  });
});

// ─── Menu portal ─────────────────────────────────────────────────────────────

const pengguna = (roleId: string) => ({ id: `u-${roleId}`, roleId, additionalRoleIds: [] }) as never;
const idMenu = (daftar: Array<{ id: string }>) => daftar.map((a) => a.id);

describe("menu portal ALETA ABT", () => {
  it("terdaftar sebagai aplikasi portal belum-fix (bawaan hanya Super Admin) menuju /aleta-abt", () => {
    const app = portalApps.find((a) => a.id === "aleta-abt");
    expect(app?.href).toBe("/aleta-abt");
    expect(PETA_ATURAN_APLIKASI.get("aleta-abt")?.status).toBe("belum-fix");
  });

  it("penyaring peran: hanya Super Admin; peran lain tidak melihat tanpa hak server", () => {
    expect(idMenu(getAccessiblePortalApps(pengguna("super-admin"), []))).toContain("aleta-abt");
    for (const r of ["admin", "hakim", "panitera", "panitera-pengganti", "ketua"]) {
      expect(idMenu(getAccessiblePortalApps(pengguna(r), [])), r).not.toContain("aleta-abt");
    }
  });

  it("belum diketahui (null): Super Admin tetap melihat, peran lain tidak", () => {
    const sa = terapkanMenuAletaAbt(getAccessiblePortalApps(pengguna("super-admin"), []), portalApps, null);
    expect(idMenu(sa)).toContain("aleta-abt");
    const hakim = terapkanMenuAletaAbt(getAccessiblePortalApps(pengguna("hakim"), []), portalApps, null);
    expect(idMenu(hakim)).not.toContain("aleta-abt");
  });

  it("hak server menyala: peran lain melihat menu, urutan mengikuti daftar aplikasi dan menu lain tidak berubah", () => {
    const dasar = getAccessiblePortalApps(pengguna("hakim"), []);
    const hasil = terapkanMenuAletaAbt(dasar, portalApps, true);
    expect(idMenu(hasil)).toContain("aleta-abt");
    expect(idMenu(hasil).filter((id) => id !== "aleta-abt")).toEqual(idMenu(dasar));
    const urut = idMenu(portalApps);
    expect(idMenu(hasil).map((id) => urut.indexOf(id))).toEqual([...idMenu(hasil).map((id) => urut.indexOf(id))].sort((a, b) => a - b));
  });

  it("hak server mati: menu hilang, juga bagi Super Admin yang dimatikan", () => {
    const sa = terapkanMenuAletaAbt(getAccessiblePortalApps(pengguna("super-admin"), []), portalApps, false);
    expect(idMenu(sa)).not.toContain("aleta-abt");
    expect(idMenu(sa).length).toBe(idMenu(getAccessiblePortalApps(pengguna("super-admin"), [])).length - 1);
  });
});
