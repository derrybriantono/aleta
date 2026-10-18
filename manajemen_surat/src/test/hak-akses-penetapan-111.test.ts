// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

import { bolehMenjalankanPenetapan } from "@/lib/matriks-peran";
import type { UserPersona } from "@/lib/types";
import { kapabilitasPengguna } from "@/server/modules/aleta-ecourt/akses";

/**
 * Keputusan 111 (18 Okt 2026): penetapan PMH/PPP/PJS/PHS di panel dijalankan Ketua, Wakil, Super Admin, Admin, dan
 * pengguna bersub-peran Operator, Petugas Meja, atau PTSP. Hakim dan Panitera tidak mendapat tab sendiri.
 * Keputusan 112: PTSP di panel ABT hanya "Isi dari SIPP & input ke ABT".
 */

function akun(roleId: string, positionId = "", additionalRoleIds: string[] = []): UserPersona {
  return {
    id: `usr-${roleId}-${positionId}-${additionalRoleIds.join("+")}`,
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

const A = {
  superadmin: akun("super-admin", "pos-pranata-komputer"),
  admin: akun("admin", "pos-pranata-komputer"),
  ketua: akun("ketua", "pos-ketua"),
  wakil: akun("wakil-ketua", "pos-wakil"),
  hakim: akun("hakim", "pos-hakim"),
  panitera: akun("panitera", "pos-panitera"),
  panmud: akun("panitera-muda", "pos-panitera-muda-gugatan"),
  pp: akun("panitera-pengganti", "pos-panitera-pengganti"),
  js: akun("jurusita", "pos-jurusita"),
  analis: akun("analis-perkara", "pos-analis-perkara"),
  operatorUtama: akun("operator", ""),
  ptspJabatan: akun("pelaksana", "pos-ptsp"),
  ptspTambahan: akun("pelaksana", "pos-staf-umum", ["petugas_ptsp"]),
  operatorTambahan: akun("pelaksana", "pos-staf-umum", ["operator"]),
  meja1: akun("pelaksana", "pos-staf-umum", ["petugas_meja_1_gugatan"]),
  meja2: akun("pelaksana", "pos-staf-umum", ["petugas_meja_2_permohonan"]),
  meja3: akun("pelaksana", "pos-staf-umum", ["petugas_meja_3_gugatan"]),
  hakimOperator: akun("hakim", "pos-hakim", ["operator"]),
  panitera2: akun("panitera", "pos-panitera", ["kasir"]),
  kasir: akun("pelaksana", "pos-staf-umum", ["kasir"]),
  sekretaris: akun("sekretaris", "pos-sekretaris"),
  ti: akun("pranata-komputer", "pos-pranata-komputer"),
};

describe("bolehMenjalankanPenetapan", () => {
  it.each(["superadmin", "admin", "ketua", "wakil", "ptspJabatan", "ptspTambahan", "operatorUtama", "operatorTambahan", "meja1", "meja2", "meja3", "hakimOperator"] as const)(
    "%s boleh menjalankan",
    (nama) => expect(bolehMenjalankanPenetapan(A[nama])).toBe(true)
  );

  it.each(["hakim", "panitera", "panitera2", "panmud", "pp", "js", "analis", "kasir", "sekretaris", "ti"] as const)("%s tidak", (nama) =>
    expect(bolehMenjalankanPenetapan(A[nama])).toBe(false)
  );

  it("tanpa pengguna: tidak", () => {
    expect(bolehMenjalankanPenetapan(null)).toBe(false);
    expect(bolehMenjalankanPenetapan(undefined)).toBe(false);
  });
});

/** Basis data tiruan: tabel kemampuan kosong -> bawaan; pengecualian dapat disisipkan. */
function dbTiruan(pengecualian: Array<Record<string, unknown>> = []) {
  return {
    prepare: (sql: string) => ({
      all: async () => (/ecourt_extension_access_user/.test(sql) ? pengecualian : []),
      get: async () => null,
      run: async () => ({ changes: 0 }),
    }),
  } as never;
}

const kap = (a: UserPersona, pengecualian: Array<Record<string, unknown>> = []) =>
  kapabilitasPengguna(dbTiruan(pengecualian), {
    id: a.id,
    roleId: String(a.roleId),
    additionalRoleIds: a.additionalRoleIds ?? [],
    positionId: a.positionId,
  });

describe("kemampuan penunjukan mengikuti keputusan 111 (menjadi 403 di semua rute penetapan)", () => {
  it("yang boleh memegang penunjukan OTOMATIS, tanpa diatur per peran", async () => {
    for (const nama of ["ketua", "wakil", "ptspJabatan", "ptspTambahan", "operatorTambahan", "meja1", "meja2", "meja3"] as const) {
      expect((await kap(A[nama])).penunjukan, nama).toBe(true);
    }
  });

  it("hakim, panitera, panmud, PP, juru sita, analis tanpa sub-peran: penunjukan dan tombol otomatis TERTUTUP", async () => {
    for (const nama of ["hakim", "panitera", "panitera2", "panmud", "pp", "js", "analis", "kasir", "sekretaris", "ti"] as const) {
      const k = await kap(A[nama]);
      expect(k.penunjukan, nama).toBe(false);
      expect(k["penunjukan-otomatis"], nama).toBe(false);
    }
  });

  it("pengecualian per orang tidak membukanya bagi hakim atau panitera", async () => {
    const aktif = (id: string, capability: string) => ({
      user_id: id,
      capability,
      enabled: 1,
      alasan: "uji",
      berlaku_sampai: null,
      updated_at: "2026-10-18T00:00:00.000Z",
      updated_by: "x",
    });
    for (const nama of ["hakim", "panitera"] as const) {
      const k = await kap(A[nama], [aktif(A[nama].id, "penunjukan"), aktif(A[nama].id, "penunjukan-otomatis")]);
      expect(k.penunjukan, nama).toBe(false);
      expect(k["penunjukan-otomatis"], nama).toBe(false);
    }
  });

  it("kemampuan lain tidak ikut berubah (hakim tetap memegang panel dan blangko ABT)", async () => {
    const k = await kap(A.hakim);
    expect(k.panel).toBe(true);
    expect(k["blangko-abt"]).toBe(true);
  });
});

// ── ekstensi: panel-alat.js dijalankan sungguhan ────────────────────────────
const AKAR = path.resolve(__dirname, "../../..");
const SUMBER = readFileSync(path.join(AKAR, "ekstensi-sipp/panel-alat.js"), "utf8").replace(/\r\n/g, "\n");
const terbuka: JSDOM[] = [];
afterEach(async () => {
  await new Promise((r) => setTimeout(r, 60));
  while (terbuka.length) terbuka.pop()!.window.close();
});

function muat() {
  const dom = new JSDOM(`<!doctype html><html><head></head><body></body></html>`, {
    url: "http://192.168.10.10/SIPP/detil_perkara_agama",
    runScripts: "outside-only",
  });
  terbuka.push(dom);
  const w = dom.window as unknown as Record<string, unknown> & { alatMenuPeran: (...a: unknown[]) => string[] | null };
  w.chrome = {
    runtime: { id: "aleta-uji", getManifest: () => ({ version: "0.0.0" }), getURL: (x: string) => x, sendMessage: async () => ({}) },
    storage: {
      local: { get: async () => ({}), set: async () => undefined, remove: async () => undefined },
      session: { get: async () => ({}), set: async () => undefined },
      onChanged: { addListener() {} },
    },
  };
  w.fetch = async () => ({ ok: false, status: 404, json: async () => ({}), clone() { return this; } });
  const ctx = (dom as JSDOM & { getInternalVMContext(): vm.Context }).getInternalVMContext();
  vm.runInContext(SUMBER, ctx, { filename: "panel-alat.js" });
  return {
    menu: (situs: string, halaman: string, pengguna: unknown, opsi?: unknown) => {
      const m = w.alatMenuPeran(situs, halaman, pengguna, opsi);
      return m === null ? null : Array.from(m);
    },
  };
}

describe("alatMenuPeran: Penetapan (111) dan PTSP di ABT (112)", () => {
  it("PTSP: menu massal Penetapan di daftar SIPP; tab Penetapan di perkara ditambahkan konten.js bila kemampuan penunjukan ada (server memberinya otomatis)", () => {
    const { menu } = muat();
    const ptsp = { peran: "Staf Pelaksana", golonganMenu: ["ptsp"], peranTambahan: ["petugas_ptsp"] };
    expect(menu("sipp", "perkara", ptsp)).toEqual(["ptsp", "berkas", "perkara"]);
    expect(menu("sipp", "daftar", ptsp)).toEqual(["penetapan-massal"]);
  });

  it("Petugas Meja 2/3 dan Operator (sub-peran, golongan analis/umum) mendapat Penetapan; tanpa sub-peran tidak", () => {
    const { menu } = muat();
    const meja2 = { peran: "Analis Perkara", golonganMenu: ["analis"], peranTambahan: ["petugas_meja_2_permohonan"] };
    expect(menu("sipp", "perkara", meja2)).toContain("penetapan");
    expect(menu("sipp", "perkara", meja2, { ditangani: false })).toContain("penetapan");
    expect(menu("sipp", "daftar", meja2)).toContain("penetapan-massal");
    const analisBiasa = { peran: "Analis Perkara", golonganMenu: ["analis"], peranTambahan: [] };
    expect(menu("sipp", "perkara", analisBiasa)).not.toContain("penetapan");
    expect(menu("sipp", "daftar", analisBiasa)).not.toContain("penetapan-massal");
  });

  it("hakim dan Panitera tidak mendapat tab Penetapan; Ketua dan Admin tetap", () => {
    const { menu } = muat();
    expect(menu("sipp", "perkara", { peran: "Hakim", golonganMenu: ["hakim"], peranTambahan: [] })).not.toContain("penetapan");
    expect(menu("sipp", "perkara", { peran: "Panitera", golonganMenu: ["panitera"], peranTambahan: [] })).not.toContain("penetapan");
    expect(menu("sipp", "perkara", { peran: "Ketua", golonganMenu: ["ketua"], peranTambahan: [] })).toContain("penetapan");
    expect(menu("sipp", "perkara", { peran: "Super Admin", golonganMenu: ["admin"], peranTambahan: [] })).toContain("penetapan");
  });

  it("PTSP di ABT hanya 'Isi dari SIPP & input ke ABT'; tidak ada menu massal", () => {
    const { menu } = muat();
    const ptsp = { peran: "Staf Pelaksana", golonganMenu: ["ptsp"], peranTambahan: ["petugas_ptsp"] };
    expect(menu("abt", "perkara", ptsp)).toEqual(["isi-input"]);
    expect(menu("abt", "daftar", ptsp)).toEqual([]);
  });
});
