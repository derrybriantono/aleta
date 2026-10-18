// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";

import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * ============================================================================
 * HAK AKSES 18 OKT 2026 - RUTE MENJAWAB 403 BAGI PERAN TAK BERHAK
 * ============================================================================
 *
 * Pola sama dengan hak-tampilan-per-peran-12okt (bagian 4): kemampuan panel dianggap ada; yang diuji
 * pagar matriks di atasnya. Rute yang baru dijaga 18 Okt:
 *   - data pribadi pihak (status.data-pihak): kontak-pihak, ktp-pihak, ktp-terbit, pekerjaan-pihak,
 *     isi-gugatan, kuasa-gugatan, saksi-scan;
 *   - BAS (bas.baca / bas.tulis): lembar, naskah, blangko, tanya-jawab, periksa;
 *   - set pertanyaan saksi (saksi.susun), isi draf H-7 (putusan.draf);
 *   - acc BAS: Super Admin ikut, Admin tidak.
 */

const keadaan = vi.hoisted(() => ({ aktor: null as Record<string, unknown> | null, saklarBlangkoSaya: false }));

vi.mock("@/server/db/client", () => ({
  getDatabase: async () => ({
    queryOne: async () => null,
    queryAll: async () => [],
    prepare: () => ({ all: async () => [], get: async () => null, run: async () => ({ changes: 0 }) }),
  }),
}));
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => "usr_uji" }));
vi.mock("@/server/modules/organization/service", () => ({
  requireActorUser: async () => {
    if (!keadaan.aktor) throw Object.assign(new Error("tanpa aktor"), { status: 401 });
    return keadaan.aktor;
  },
  getUserByIdFromDb: async () => keadaan.aktor,
  getUsersFromDb: async () => (keadaan.aktor ? [keadaan.aktor] : []),
}));
vi.mock("@/server/modules/aleta-ecourt/akses", () => ({ pastikanKapabilitas: async () => keadaan.aktor }));
vi.mock("@/server/modules/satker/fitur", () => ({ fiturMenyala: async () => keadaan.saklarBlangkoSaya }));
vi.mock("@/server/shared/admin-access-audit", async () => {
  const { NextResponse } = await import("next/server");
  return {
    handleAdminRouteError: (galat: { status?: number; message?: string }) =>
      NextResponse.json({ ok: false, error: { message: String(galat && galat.message) } }, { status: Number(galat && galat.status) || 500 }),
  };
});

import { AKSI, golonganPengguna, type KunciAksi } from "@/lib/matriks-peran";
import type { UserPersona } from "@/lib/types";
import { bolehMengaccPeran } from "@/server/modules/aleta-ecourt/bas-acc";

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

const AKUN = {
  superadmin: akun("super-admin", "pos-pranata-komputer"),
  admin: akun("admin", "pos-pranata-komputer"),
  ketua: akun("ketua", "pos-ketua"),
  hakim: akun("hakim", "pos-hakim"),
  panitera: akun("panitera", "pos-panitera"),
  panmud: akun("panitera-muda", "pos-panitera-muda-gugatan"),
  pp: akun("panitera-pengganti", "pos-panitera-pengganti"),
  js: akun("jurusita", "pos-jurusita"),
  kasir: akun("pelaksana", "pos-staf-umum", ["kasir"]),
  ptsp: akun("pelaksana", "pos-ptsp", ["petugas_ptsp"]),
  mediator: akun("pelaksana", "pos-staf-umum", ["mediator"]),
  analis: akun("analis-perkara", "pos-analis-perkara"),
  sekretaris: akun("sekretaris", "pos-sekretaris"),
  ti: akun("pranata-komputer", "pos-pranata-komputer"),
  staf: akun("pelaksana", "pos-staf-umum"),
  penjaga: akun("pelaksana", "pos-staf-umum", ["penjaga_sidang"]),
};
type NamaAkun = keyof typeof AKUN;

afterEach(() => {
  keadaan.aktor = null;
  keadaan.saklarBlangkoSaya = false;
});

const permintaan = (url: string, method = "GET", body: unknown = {}) =>
  new NextRequest(`http://127.0.0.1:3000/aleta${url}`, {
    method,
    headers: { "content-type": "application/json" },
    body: method === "GET" ? undefined : JSON.stringify(body),
  });

async function panggil(modul: Record<string, unknown>, method: string, req: NextRequest) {
  const f = modul[method] as (r: NextRequest) => Promise<Response>;
  const r = await f(req);
  let isi: { error?: { message?: string } } = {};
  try {
    isi = await r.clone().json();
  } catch {
    /* bukan JSON */
  }
  return { status: r.status, pesan: String(isi?.error?.message ?? "") };
}

type Rute = {
  nama: string;
  impor: () => Promise<Record<string, unknown>>;
  method: string;
  url: string;
  aksi: KunciAksi;
  tolak: NamaAkun[];
  terima: NamaAkun[];
};

const URL_BIASA = "/api/aleta-ecourt";
const RUTE: Rute[] = [
  // ── data pribadi pihak ────────────────────────────────────────────────────
  { nama: "kontak-pihak", impor: () => import("@/app/api/aleta-ecourt/kontak-pihak/route"), method: "GET", url: `${URL_BIASA}/kontak-pihak`, aksi: "status.data-pihak", tolak: ["sekretaris", "ti", "staf", "penjaga"], terima: ["hakim", "pp", "kasir", "ptsp", "mediator", "js", "analis"] },
  { nama: "ktp-pihak", impor: () => import("@/app/api/aleta-ecourt/ktp-pihak/route"), method: "GET", url: `${URL_BIASA}/ktp-pihak`, aksi: "status.data-pihak", tolak: ["sekretaris", "ti", "staf"], terima: ["ketua", "panitera", "ptsp"] },
  { nama: "ktp-terbit", impor: () => import("@/app/api/aleta-ecourt/ktp-terbit/route"), method: "GET", url: `${URL_BIASA}/ktp-terbit`, aksi: "status.data-pihak", tolak: ["sekretaris", "staf"], terima: ["hakim", "analis"] },
  { nama: "pekerjaan-pihak", impor: () => import("@/app/api/aleta-ecourt/pekerjaan-pihak/route"), method: "GET", url: `${URL_BIASA}/pekerjaan-pihak`, aksi: "status.data-pihak", tolak: ["ti", "staf"], terima: ["pp", "mediator"] },
  { nama: "isi-gugatan", impor: () => import("@/app/api/aleta-ecourt/isi-gugatan/route"), method: "GET", url: `${URL_BIASA}/isi-gugatan`, aksi: "status.data-pihak", tolak: ["sekretaris", "penjaga"], terima: ["hakim", "js"] },
  { nama: "kuasa-gugatan", impor: () => import("@/app/api/aleta-ecourt/kuasa-gugatan/route"), method: "GET", url: `${URL_BIASA}/kuasa-gugatan`, aksi: "status.data-pihak", tolak: ["staf", "ti"], terima: ["panmud", "ptsp"] },
  { nama: "saksi-scan", impor: () => import("@/app/api/aleta-ecourt/saksi-scan/route"), method: "POST", url: `${URL_BIASA}/saksi-scan`, aksi: "status.data-pihak", tolak: ["sekretaris", "ti", "staf"], terima: ["ptsp", "analis", "pp"] },
  // ── BAS ───────────────────────────────────────────────────────────────────
  { nama: "bas/lembar (baca)", impor: () => import("@/app/api/aleta-ecourt/bas/lembar/route"), method: "GET", url: `${URL_BIASA}/bas/lembar`, aksi: "bas.baca", tolak: ["kasir", "ptsp", "js", "mediator", "sekretaris", "ti", "staf"], terima: ["ketua", "hakim", "panitera", "panmud", "pp", "analis"] },
  { nama: "bas/lembar (simpan)", impor: () => import("@/app/api/aleta-ecourt/bas/lembar/route"), method: "PUT", url: `${URL_BIASA}/bas/lembar`, aksi: "bas.tulis", tolak: ["ketua", "kasir", "ptsp", "js", "mediator", "sekretaris"], terima: ["hakim", "panitera", "panmud", "pp", "analis"] },
  { nama: "bas/naskah", impor: () => import("@/app/api/aleta-ecourt/bas/naskah/route"), method: "GET", url: `${URL_BIASA}/bas/naskah`, aksi: "bas.baca", tolak: ["kasir", "js", "ti"], terima: ["hakim", "pp"] },
  { nama: "bas/blangko", impor: () => import("@/app/api/aleta-ecourt/bas/blangko/route"), method: "GET", url: `${URL_BIASA}/bas/blangko`, aksi: "bas.baca", tolak: ["ptsp", "staf"], terima: ["panitera", "analis"] },
  { nama: "bas/tanya-jawab", impor: () => import("@/app/api/aleta-ecourt/bas/tanya-jawab/route"), method: "GET", url: `${URL_BIASA}/bas/tanya-jawab`, aksi: "bas.baca", tolak: ["mediator", "sekretaris"], terima: ["ketua", "pp"] },
  { nama: "bas/periksa", impor: () => import("@/app/api/aleta-ecourt/bas/periksa/route"), method: "GET", url: `${URL_BIASA}/bas/periksa`, aksi: "bas.baca", tolak: ["kasir", "penjaga"], terima: ["hakim", "panmud"] },
  // ── mediasi (tab disembunyikan -> rute ikut dijaga) ───────────────────────
  { nama: "jadwal-mediasi (tab mediasi)", impor: () => import("@/app/api/aleta-ecourt/jadwal-mediasi/route"), method: "GET", url: `${URL_BIASA}/jadwal-mediasi`, aksi: "status.data-pihak", tolak: ["kasir", "js", "sekretaris", "ti", "staf", "penjaga"], terima: ["ketua", "hakim", "panitera", "panmud", "pp", "mediator", "ptsp", "analis"] },
  // ── saksi ─────────────────────────────────────────────────────────────────
  { nama: "blangko-derry/set-saksi", impor: () => import("@/app/api/aleta-ecourt/blangko-derry/set-saksi/route"), method: "GET", url: `${URL_BIASA}/blangko-derry/set-saksi`, aksi: "saksi.susun", tolak: ["js", "kasir", "ptsp", "sekretaris"], terima: ["hakim", "ketua", "pp", "panitera", "analis"] },
];

describe("rute data pribadi, BAS, dan saksi menjawab 403 bagi peran tak berhak", () => {
  it.each(RUTE)("$nama ($aksi): yang tak berhak 403 'matriks peran', yang berhak, Admin, dan Super Admin lolos pagar", async ({ impor, method, url, tolak, terima }) => {
    const modul = await impor();
    for (const nama of tolak) {
      keadaan.aktor = AKUN[nama] as unknown as Record<string, unknown>;
      const hasil = await panggil(modul, method, permintaan(url, method));
      expect(hasil.status, `${nama} harus 403`).toBe(403);
      expect(hasil.pesan, nama).toMatch(/matriks peran/);
    }
    for (const nama of [...terima, "admin", "superadmin"] as NamaAkun[]) {
      keadaan.aktor = AKUN[nama] as unknown as Record<string, unknown>;
      const hasil = await panggil(modul, method, permintaan(url, method));
      // Sesudah pagar boleh gagal karena isian kosong atau bot mati - asal BUKAN tolakan matriks.
      expect(hasil.pesan, `${nama} tidak boleh ditolak matriks`).not.toMatch(/matriks peran/);
    }
  });

  it("tanpa sesi: 401, bukan 200 (rute baru tidak terbuka)", async () => {
    const modul = await import("@/app/api/aleta-ecourt/kontak-pihak/route");
    keadaan.aktor = null;
    const hasil = await panggil(modul as Record<string, unknown>, "GET", permintaan(`${URL_BIASA}/kontak-pihak`));
    expect([401, 403, 500]).toContain(hasil.status);
    expect(hasil.status).not.toBe(200);
  });

  it("isi lengkap draf H-7: juru sita 403, PP lolos pagar matriks; lencana ringkas tetap terbuka", async () => {
    const modul = await import("@/app/api/aleta-ecourt/agen-h7/route");
    keadaan.aktor = AKUN.js as unknown as Record<string, unknown>;
    const lengkap = await panggil(modul as Record<string, unknown>, "GET", permintaan(`${URL_BIASA}/agen-h7?perkaraId=1`));
    expect(lengkap.status).toBe(403);
    expect(lengkap.pesan).toMatch(/matriks peran/);
    const ringkas = await panggil(modul as Record<string, unknown>, "GET", permintaan(`${URL_BIASA}/agen-h7?perkaraId=1&ringkas=1`));
    expect(ringkas.status).not.toBe(403);
    keadaan.aktor = AKUN.pp as unknown as Record<string, unknown>;
    const pp = await panggil(modul as Record<string, unknown>, "GET", permintaan(`${URL_BIASA}/agen-h7?perkaraId=1`));
    expect(pp.pesan).not.toMatch(/matriks peran/);
  });

  it("setiap rute yang disebut aksi baru benar-benar memasang pastikanAksi dengan kunci itu", () => {
    const AKAR = path.resolve(__dirname, "..");
    for (const kunci of ["bas.baca", "bas.tulis", "saksi.susun", "status.data-pihak"] as KunciAksi[]) {
      for (const r of AKSI[kunci].rute) {
        const m = r.match(/\/api\/(aleta-ecourt\/[\w\-/]+)/);
        if (!m) continue;
        const teks = readFileSync(path.join(AKAR, "app/api", m[1], "route.ts"), "utf8");
        expect(teks, `${kunci} di ${m[1]}`).toContain(`"${kunci}"`);
      }
    }
  });
});

describe("data ALETA Bot hanya bagi peran yang diberi aplikasinya", () => {
  const RUTE_BOT = [
    { nama: "panitera", impor: () => import("@/app/api/aleta-bot/panitera/route"), url: "/api/aleta-bot/panitera" },
    { nama: "antrian-online", impor: () => import("@/app/api/aleta-bot/antrian-online/route"), url: "/api/aleta-bot/antrian-online" },
    { nama: "ecourt/pengaturan", impor: () => import("@/app/api/aleta-bot/ecourt/pengaturan/route"), url: "/api/aleta-bot/ecourt/pengaturan" },
    { nama: "verifikasi", impor: () => import("@/app/api/aleta-bot/verifikasi/route"), url: "/api/aleta-bot/verifikasi" },
  ];

  it.each(RUTE_BOT)("$nama: kesekretariatan, pelaksana, dan petugas sidang 403; pemegang aplikasi dan pengelola lolos", async ({ impor, url }) => {
    const modul = (await impor()) as Record<string, unknown>;
    for (const nama of ["sekretaris", "staf", "penjaga"] as NamaAkun[]) {
      keadaan.aktor = AKUN[nama] as unknown as Record<string, unknown>;
      const hasil = await panggil(modul, "GET", permintaan(url));
      expect(hasil.status, `${nama} harus 403`).toBe(403);
      expect(hasil.pesan, nama).toMatch(/ALETA Bot tidak dibuka untuk peran Anda/);
    }
    for (const nama of ["hakim", "pp", "panitera", "kasir", "ptsp", "ti", "admin", "superadmin"] as NamaAkun[]) {
      keadaan.aktor = AKUN[nama] as unknown as Record<string, unknown>;
      const hasil = await panggil(modul, "GET", permintaan(url));
      expect(hasil.pesan, `${nama} tidak boleh ditolak pagar aplikasi`).not.toMatch(/tidak dibuka untuk peran Anda/);
    }
  });
});

describe("acc BAS: Super Admin ikut, Admin dan panitera tidak", () => {
  it("bolehMengaccPeran", () => {
    for (const ok of ["ketua", "wakil-ketua", "hakim", "super-admin"]) expect(bolehMengaccPeran(ok), ok).toBe(true);
    for (const tidak of ["admin", "panitera", "panitera-muda", "panitera-pengganti", "jurusita", "pelaksana", "", undefined, null]) {
      expect(bolehMengaccPeran(tidak), String(tidak)).toBe(false);
    }
  });

  it("rute acc: Admin 403, Super Admin lolos pagar acc", async () => {
    const modul = (await import("@/app/api/aleta-ecourt/bas/acc/route")) as Record<string, unknown>;
    keadaan.aktor = AKUN.admin as unknown as Record<string, unknown>;
    const admin = await panggil(modul, "POST", permintaan(`${URL_BIASA}/bas/acc`, "POST", { lembarId: "x", tindakan: "acc" }));
    expect(admin.status).toBe(403);
    expect(admin.pesan).toMatch(/Hanya hakim/);
    keadaan.aktor = AKUN.panitera as unknown as Record<string, unknown>;
    const panitera = await panggil(modul, "POST", permintaan(`${URL_BIASA}/bas/acc`, "POST", { lembarId: "x", tindakan: "acc" }));
    expect(panitera.status).toBe(403);
    keadaan.aktor = AKUN.superadmin as unknown as Record<string, unknown>;
    const sa = await panggil(modul, "POST", permintaan(`${URL_BIASA}/bas/acc`, "POST", { lembarId: "x", tindakan: "acc" }));
    expect(sa.pesan).not.toMatch(/Hanya hakim/);
  });
});

describe("/api/hak-akses/saya: menu Blangko Saya mengikuti saklar tahap awal", () => {
  async function tanya(nama: NamaAkun) {
    const modul = (await import("@/app/api/hak-akses/saya/route")) as Record<string, unknown>;
    keadaan.aktor = AKUN[nama] as unknown as Record<string, unknown>;
    const r = await (modul.GET as (r: NextRequest) => Promise<Response>)(permintaan("/api/hak-akses/saya"));
    return (await r.json()) as { data: { blangkoSayaTerbuka: boolean; golongan: Array<{ kode: string }> } };
  }

  it("saklar mati (bawaan): hanya Super Admin; peran lain tertutup walau berhak menurut matriks", async () => {
    keadaan.saklarBlangkoSaya = false;
    expect((await tanya("superadmin")).data.blangkoSayaTerbuka).toBe(true);
    for (const nama of ["admin", "hakim", "panitera", "pp", "ketua"] as NamaAkun[]) expect((await tanya(nama)).data.blangkoSayaTerbuka, nama).toBe(false);
  });

  it("saklar menyala: terbuka bagi yang diberi aplikasinya", async () => {
    keadaan.saklarBlangkoSaya = true;
    for (const nama of ["admin", "hakim", "panitera", "pp"] as NamaAkun[]) expect((await tanya(nama)).data.blangkoSayaTerbuka, nama).toBe(true);
    expect((await tanya("hakim")).data.golongan.map((g) => g.kode)).toContain("hakim");
  });
});

describe("peta hak akses: rute baca untuk Admin dan Super Admin saja", () => {
  it("/api/hak-akses/peta: peran lain 403; Admin tanpa rincian teknis; Super Admin lengkap", async () => {
    const modul = (await import("@/app/api/hak-akses/peta/route")) as Record<string, unknown>;
    for (const nama of ["hakim", "pp", "kasir", "sekretaris", "ti", "ketua"] as NamaAkun[]) {
      keadaan.aktor = AKUN[nama] as unknown as Record<string, unknown>;
      const r = await (modul.GET as (r: NextRequest) => Promise<Response>)(permintaan("/api/hak-akses/peta"));
      expect(r.status, nama).toBe(403);
    }
    keadaan.aktor = AKUN.admin as unknown as Record<string, unknown>;
    const a = await (modul.GET as (r: NextRequest) => Promise<Response>)(permintaan("/api/hak-akses/peta"));
    expect(a.status).toBe(200);
    const adminIsi = (await a.json()) as { data: { teknis: boolean; butir: Array<{ sumber?: string; rute?: unknown }>; perubahan: unknown[] } };
    expect(adminIsi.data.teknis).toBe(false);
    expect(adminIsi.data.butir.every((b) => b.sumber === undefined && b.rute === undefined)).toBe(true);
    expect(adminIsi.data.perubahan).toEqual([]);
    keadaan.aktor = AKUN.superadmin as unknown as Record<string, unknown>;
    const s = await (modul.GET as (r: NextRequest) => Promise<Response>)(permintaan("/api/hak-akses/peta"));
    const saIsi = (await s.json()) as { data: { teknis: boolean; butir: Array<{ sumber?: string }>; perubahan: unknown[]; golongan: unknown[] } };
    expect(saIsi.data.teknis).toBe(true);
    expect(saIsi.data.butir.some((b) => Boolean(b.sumber))).toBe(true);
    expect(saIsi.data.perubahan.length).toBeGreaterThan(0);
    expect(saIsi.data.golongan.length).toBe(16);
  });

  it("golonganPengguna tetap membaca peran tambahan (dasar tabel uji)", () => {
    expect(golonganPengguna(AKUN.kasir)).toContain("kasir");
    expect(golonganPengguna(AKUN.ptsp)).toContain("ptsp");
  });
});
