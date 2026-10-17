// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ============================================================================
 * HAK & TAMPILAN PER PERAN - MATRIKS 12 OKT 2026 (Agen A)
 * ============================================================================
 *
 * Satu sumber: src/lib/matriks-peran.ts. Yang diuji PERILAKUNYA, bukan teks:
 *   1. golongan tiap akun (peran + jabatan + peran tambahan);
 *   2. ubin portal & modul sidebar tiap peran, termasuk aplikasi BELUM FIX
 *      yang hanya tampil bagi Super Admin dan timpaan Akses Menu buka/tutup;
 *   3. tab e-Court, aksi, dan saklar Jadwal Sidang yang dimatikan;
 *   4. rute yang MENJAWAB 403 bagi peran tak berhak (dan meloloskan yang berhak);
 *   5. ekstensi: panel-alat.js membaca golonganMenu dari server.
 */

const keadaan = vi.hoisted(() => ({
  aktor: null as Record<string, unknown> | null,
  timpaan: [] as Array<{ module_id: string; enabled: number }>,
}));

vi.mock("@/server/db/client", () => ({
  getDatabase: async () => ({
    queryOne: async () => null,
    prepare: () => ({
      all: async (_peran: string, buka: string, tutup: string) =>
        keadaan.timpaan.filter((b) => b.module_id === buka || b.module_id === tutup),
      get: async () => null,
      run: async () => ({ changes: 0 }),
    }),
  }),
}));
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => "usr_uji" }));
vi.mock("@/server/modules/organization/service", () => ({
  requireActorUser: async () => {
    if (!keadaan.aktor) throw Object.assign(new Error("tanpa aktor"), { status: 401 });
    return keadaan.aktor;
  },
  getUserByIdFromDb: async () => keadaan.aktor,
  // Rute yang lolos pagar matriks lanjut membaca daftar pengguna; tanpa tiruan ini
  // vitest mencatat "unhandled rejection" sesudah ujinya selesai (bukan kegagalan pagar).
  getUsersFromDb: async () => (keadaan.aktor ? [keadaan.aktor] : []),
}));
// Kemampuan ekstensi lama dianggap ada - yang diuji pagar MATRIKS di atasnya.
vi.mock("@/server/modules/aleta-ecourt/akses", () => ({
  pastikanKapabilitas: async () => keadaan.aktor,
}));
vi.mock("@/server/shared/admin-access-audit", async () => {
  const { NextResponse } = await import("next/server");
  return {
    handleAdminRouteError: (galat: { status?: number; message?: string }) =>
      NextResponse.json({ ok: false, error: { message: String(galat && galat.message) } }, { status: Number(galat && galat.status) || 500 }),
  };
});

import {
  AKSI,
  APLIKASI_BELUM_FIX,
  bolehAksi,
  golonganMenuEkstensi,
  golonganPengguna,
  kunciBukaAplikasi,
  kunciTutupAplikasi,
  saringSaklarSidang,
  subPanmud,
  tabEcourtTampil,
  type KunciAksi,
  type TabEcourt,
} from "@/lib/matriks-peran";
import { getAccessibleModules, getAccessiblePortalApps } from "@/lib/permissions";
import { DEFAULT_PORTAL_APP_IDS } from "@/lib/app-state";
import { moduleVisibility as visibilitasBawaan } from "@/lib/mock-data";
import type { ModuleVisibility, UserPersona } from "@/lib/types";

// ── Akun uji (sama bentuknya dengan akun lokal uji_*) ───────────────────────

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
  panmudGugatan: akun("panitera-muda", "pos-panitera-muda-gugatan"),
  pp: akun("panitera-pengganti", "pos-panitera-pengganti"),
  js: akun("jurusita", "pos-jurusita"),
  jsp: akun("pelaksana", "pos-jurusita-pengganti"),
  kasir: akun("pelaksana", "pos-staf-umum", ["kasir"]),
  ptsp: akun("pelaksana", "pos-ptsp", ["petugas_ptsp"]),
  mediator: akun("pelaksana", "pos-staf-umum", ["mediator"]),
  operator: akun("pelaksana", "pos-staf-umum", ["operator"]),
  analis: akun("analis-perkara", "pos-analis-perkara"),
  sekretaris: akun("sekretaris", "pos-sekretaris"),
  ti: akun("pranata-komputer", "pos-pranata-komputer"),
  staf: akun("pelaksana", "pos-staf-umum"),
};
type NamaAkun = keyof typeof AKUN;

/**
 * Akses Menu seperti di salinan server 9 Okt: baris lama terisi benih yang
 * MENUTUP perkara/bas/aleta-ecourt bagi hampir semua peran dan MEMBUKA judicia.
 * Matriks tidak boleh tertipu oleh baris lama itu.
 */
function visibilitasServer9Okt(): ModuleVisibility[] {
  return visibilitasBawaan.map((v) => ({
    roleId: v.roleId,
    modules: {
      ...v.modules,
      perkara: v.roleId === "super-admin",
      bas: v.roleId === "super-admin",
      "aleta-ecourt": ["super-admin", "admin", "hakim", "operator"].includes(v.roleId),
      "judicia-legal-form": true,
      "e-status": true,
    } as ModuleVisibility["modules"],
  }));
}

const ubin = (a: UserPersona, vis = visibilitasServer9Okt()) => getAccessiblePortalApps(a, vis).map((x) => x.id).sort();

afterEach(() => {
  keadaan.aktor = null;
  keadaan.timpaan = [];
});

// ════════════════════════════════════════════════════════════════════════════
describe("1. golongan: peran + jabatan + peran tambahan", () => {
  it.each([
    ["superadmin", ["super-admin"]],
    ["admin", ["admin"]],
    ["ketua", ["pimpinan"]],
    ["hakim", ["hakim"]],
    ["panitera", ["panitera"]],
    ["panmudGugatan", ["panmud"]],
    ["pp", ["pp"]],
    ["js", ["jurusita"]],
    ["jsp", ["jurusita"]],
    ["kasir", ["sekretariat", "kasir"]],
    ["ptsp", ["ptsp"]],
    ["mediator", ["sekretariat", "mediator"]],
    ["operator", ["sekretariat", "ptsp", "petugas-sidang"]],
    ["analis", ["analis-perkara"]],
    ["sekretaris", ["sekretariat"]],
    ["ti", ["ti"]],
    ["staf", ["sekretariat"]],
  ] as Array<[NamaAkun, string[]]>)("%s -> %j", (nama, harap) => {
    expect(golonganPengguna(AKUN[nama])).toEqual(harap);
  });

  it("pelaksana tanpa jabatan khusus jatuh ke 'pelaksana'; sub-peran panmud terbaca", () => {
    expect(golonganPengguna(akun("pppk", "pos-pppk"))).toEqual(["pelaksana"]);
    expect(subPanmud(AKUN.panmudGugatan)).toBe("gugatan");
    expect(subPanmud(akun("panitera-muda", "pos-panitera-muda-hukum"))).toBe("hukum");
  });

  it("Plt yang berlaku menggantikan jabatan; yang sudah usai tidak", () => {
    const plt = { ...AKUN.hakim, actingAssignment: { type: "PLT", roleId: "ketua", positionId: "pos-ketua" } } as unknown as UserPersona;
    expect(golonganPengguna(plt)).toEqual(["pimpinan"]);
    const usai = {
      ...AKUN.hakim,
      actingAssignment: { type: "PLT", roleId: "ketua", positionId: "pos-ketua", endDate: "2020-01-01" },
    } as unknown as UserPersona;
    expect(golonganPengguna(usai)).toEqual(["hakim"]);
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe("2. ubin portal & modul per peran", () => {
  const MATANG_SEMUA = ["aleta-ecourt", "e-kepegawaian", "manajemen-surat", "sipp"];

  it.each([
    ["admin", ["aleta-bot", "aleta-ecourt", "aps-badilag", "asisten-hakim", "audit-trail", "bas", "e-kepegawaian", "manajemen-surat", "perkara", "sipp"]],
    ["ketua", ["aleta-bot", "aleta-ecourt", "aps-badilag", "asisten-hakim", "bas", "e-kepegawaian", "manajemen-surat", "perkara", "sipp"]],
    ["hakim", ["aleta-bot", "aleta-ecourt", "aps-badilag", "asisten-hakim", "bas", "e-kepegawaian", "manajemen-surat", "perkara", "sipp"]],
    ["pp", ["aleta-bot", "aleta-ecourt", "aps-badilag", "bas", "e-kepegawaian", "manajemen-surat", "perkara", "sipp"]],
    ["panitera", ["aleta-bot", "aleta-ecourt", "aps-badilag", "bas", "e-kepegawaian", "manajemen-surat", "perkara", "sipp"]],
    ["js", ["aleta-bot", "aleta-ecourt", "aps-badilag", "e-kepegawaian", "manajemen-surat", "sipp"]],
    ["kasir", ["aleta-bot", "aleta-ecourt", "e-kepegawaian", "manajemen-surat", "sipp"]],
    ["ptsp", ["aleta-bot", "aleta-ecourt", "aps-badilag", "e-kepegawaian", "manajemen-surat", "sipp"]],
    ["sekretaris", MATANG_SEMUA],
    ["staf", MATANG_SEMUA],
  ] as Array<[NamaAkun, string[]]>)("%s melihat tepat ubin matriksnya", (nama, harap) => {
    // "skp" (17 Okt 2026): layar SKP terbuka bagi semua pegawai (tab di dalamnya mengikuti hak dari server).
    expect(ubin(AKUN[nama])).toEqual([...harap, "skp"].sort());
  });

  it("aplikasi BELUM FIX hanya Super Admin - walau baris lama Akses Menu membukanya", () => {
    const sa = ubin(AKUN.superadmin);
    for (const id of ["aleta-sipp", "judicia-legal-form", "aleta-e-audit", "e-status", "aleta-antrian", "e-keuangan"]) {
      expect(APLIKASI_BELUM_FIX).toContain(id);
      expect(sa).toContain(id);
      for (const nama of Object.keys(AKUN) as NamaAkun[]) {
        if (nama === "superadmin") continue;
        expect(ubin(AKUN[nama]), `${nama} tidak boleh melihat ${id}`).not.toContain(id);
      }
    }
    // DEFAULT_PORTAL_APP_IDS kini turunan matriks: tanpa satu pun aplikasi belum fix.
    for (const id of APLIKASI_BELUM_FIX) expect(DEFAULT_PORTAL_APP_IDS.has(id)).toBe(false);
  });

  it("Akses Menu: buka:<id> membuka aplikasi belum fix untuk peran itu; tutup:<id> menutup aplikasi matang", () => {
    const vis = visibilitasServer9Okt().map((v) =>
      v.roleId === "hakim"
        ? { ...v, modules: { ...v.modules, [kunciBukaAplikasi("judicia-legal-form")]: true, [kunciTutupAplikasi("aleta-bot")]: true } }
        : v
    ) as ModuleVisibility[];
    const h = ubin(AKUN.hakim, vis);
    expect(h).toContain("judicia-legal-form");
    expect(h).not.toContain("aleta-bot");
    // Peran lain tidak ikut terbuka.
    expect(ubin(AKUN.ketua, vis)).not.toContain("judicia-legal-form");
    // Modul sidebar Judicia ikut terbuka bagi hakim, pengaturannya tetap tidak (roleIds modul).
    const modul = getAccessibleModules(AKUN.hakim, vis).map((m) => m.id);
    expect(modul).toContain("judicia-legal-form");
    expect(modul).not.toContain("judicia-legal-form-settings");
  });

  it("modul sidebar aplikasi belum fix tidak bocor (dulu Judicia/E-Status tampil di sidebar ketua)", () => {
    const modul = getAccessibleModules(AKUN.ketua, visibilitasServer9Okt()).map((m) => m.id);
    for (const id of ["judicia-legal-form", "aleta-sipp", "aleta-e-audit", "e-status"]) expect(modul).not.toContain(id);
    expect(modul).toContain("peta-perkara");
    expect(modul).toContain("beban-konseptor");
    // Modul lama di luar matriks tetap mengikuti baris Akses Menu.
    expect(modul).toContain("disposisi");
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe("3. e-Court: tab, aksi, saklar Jadwal Sidang", () => {
  const tab = (nama: NamaAkun) =>
    (["dasbor", "sidang", "mediasi", "status", "berkas", "riwayat", "ttd", "ekstensi"] as TabEcourt[]).filter((t) =>
      tabEcourtTampil(AKUN[nama], t)
    );

  it.each([
    ["admin", ["dasbor", "sidang", "mediasi", "status", "berkas", "riwayat", "ttd", "ekstensi"]],
    ["hakim", ["dasbor", "sidang", "mediasi", "status", "berkas", "riwayat", "ekstensi"]],
    ["pp", ["dasbor", "sidang", "mediasi", "status", "berkas", "ekstensi"]],
    ["js", ["dasbor", "sidang", "status", "berkas", "ekstensi"]],
    ["kasir", ["dasbor", "sidang", "status", "berkas", "ekstensi"]],
    ["ptsp", ["dasbor", "sidang", "mediasi", "status", "berkas", "riwayat", "ekstensi"]],
    ["mediator", ["dasbor", "sidang", "mediasi", "status", "berkas", "ekstensi"]],
    ["sekretaris", ["dasbor", "sidang", "status", "berkas", "ekstensi"]],
  ] as Array<[NamaAkun, string[]]>)("tab %s", (nama, harap) => {
    expect(tab(nama)).toEqual(harap);
  });

  const BOLEH: Record<string, NamaAkun[]> = {
    "sidang.tunda-putus": ["ketua", "hakim", "panitera", "panmudGugatan", "pp"],
    "sidang.kasir": ["panitera", "panmudGugatan", "kasir"],
    "sidang.court-calendar": ["panitera", "panmudGugatan", "pp"],
    "sidang.antrian": ["ketua", "hakim", "panitera", "panmudGugatan", "pp", "ptsp", "operator"],
    "sidang.cetak-relaas": ["js", "jsp"],
    "ecourt.verifikasi": ["ketua", "hakim"],
    "ecourt.tte": ["panitera", "panmudGugatan"],
    "mediasi.catat": ["ketua", "hakim", "panitera", "panmudGugatan", "pp", "mediator"],
    "putusan.unggah": ["ketua", "hakim"],
    "ttd.kelola": [],
    "status.data-pihak": ["ketua", "hakim", "panitera", "panmudGugatan", "pp", "js", "jsp", "kasir", "ptsp", "mediator", "operator", "analis"],
  };

  it.each(Object.entries(BOLEH))("aksi %s hanya untuk golongannya (+Admin/Super Admin)", (aksi, harap) => {
    const nyata = (Object.keys(AKUN) as NamaAkun[]).filter((n) => bolehAksi(AKUN[n], aksi as KunciAksi));
    expect(nyata.sort()).toEqual(["superadmin", "admin", ...harap].sort());
  });

  it("unggah putusan tetap keputusan 9 Okt (sama dengan PERAN_UNGGAH_PUTUSAN)", async () => {
    const { bolehUnggahPutusan } = await import("@/server/modules/aleta-ecourt/hak-putusan");
    for (const nama of Object.keys(AKUN) as NamaAkun[]) {
      expect(bolehAksi(AKUN[nama], "putusan.unggah"), nama).toBe(bolehUnggahPutusan(AKUN[nama]));
    }
  });

  it("aksi Kasir & Court Calendar sejalan dengan bolehKasir / bolehIsiCourtCalendar lama", async () => {
    const { bolehKasir } = await import("@/lib/kasir-jurnal");
    const { bolehIsiCourtCalendar } = await import("@/lib/court-calendar-hak");
    for (const nama of Object.keys(AKUN) as NamaAkun[]) {
      expect(bolehAksi(AKUN[nama], "sidang.kasir"), `kasir ${nama}`).toBe(bolehKasir(AKUN[nama]));
      expect(bolehAksi(AKUN[nama], "sidang.court-calendar"), `cc ${nama}`).toBe(bolehIsiCourtCalendar(AKUN[nama]));
    }
  });

  it("saklar Jadwal Sidang: tombol aksi yang tidak boleh dimatikan, pilihan lain utuh", () => {
    const pilihan = { "tombol-tunda-putus": true, "tombol-kasir": true, "court-calendar": true, retur: true, kehadiran: true };
    const kasir = saringSaklarSidang(pilihan, AKUN.kasir);
    expect(kasir["tombol-tunda-putus"]).toBe(false);
    expect(kasir["court-calendar"]).toBe(false);
    expect(kasir["tombol-kasir"]).toBe(true);
    expect(kasir.kehadiran).toBe(true);
    const pp = saringSaklarSidang(pilihan, AKUN.pp);
    expect(pp["tombol-tunda-putus"]).toBe(true);
    expect(pp["tombol-kasir"]).toBe(false);
    // Super Admin: pilihan apa adanya (obyek yang sama).
    expect(saringSaklarSidang(pilihan, AKUN.superadmin)).toBe(pilihan);
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe("4. rute menjawab 403 bagi peran tak berhak (penjaga sisi server)", () => {
  const permintaan = (url: string, method = "POST", body: unknown = {}) =>
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

  const RUTE: Array<{ nama: string; impor: () => Promise<Record<string, unknown>>; method: string; url: string; aksi: KunciAksi; tolak: NamaAkun; terima: NamaAkun; badan?: unknown }> = [
    { nama: "sidang-tunda", impor: () => import("@/app/api/aleta-ecourt/sidang-tunda/route"), method: "POST", url: "/api/aleta-ecourt/sidang-tunda", aksi: "sidang.tunda-putus", tolak: "kasir", terima: "pp" },
    { nama: "sidang-putus (jalur sidang)", impor: () => import("@/app/api/aleta-ecourt/sidang-putus/route"), method: "POST", url: "/api/aleta-ecourt/sidang-putus", aksi: "sidang.tunda-putus", tolak: "js", terima: "pp", badan: { jalur: "sidang" } },
    { nama: "sidang/selesai", impor: () => import("@/app/api/aleta-ecourt/sidang/selesai/route"), method: "POST", url: "/api/aleta-ecourt/sidang/selesai", aksi: "sidang.jalannya", tolak: "kasir", terima: "operator" },
    { nama: "sidang/mediator", impor: () => import("@/app/api/aleta-ecourt/sidang/mediator/route"), method: "POST", url: "/api/aleta-ecourt/sidang/mediator", aksi: "sidang.mediator", tolak: "ptsp", terima: "pp" },
    { nama: "antrian-ambil", impor: () => import("@/app/api/aleta-ecourt/antrian-ambil/route"), method: "POST", url: "/api/aleta-ecourt/antrian-ambil", aksi: "sidang.antrian", tolak: "kasir", terima: "ptsp" },
    { nama: "keterangan-perkara", impor: () => import("@/app/api/aleta-ecourt/keterangan-perkara/route"), method: "POST", url: "/api/aleta-ecourt/keterangan-perkara", aksi: "sidang.keterangan", tolak: "sekretaris", terima: "js" },
    { nama: "konseptor-sementara", impor: () => import("@/app/api/aleta-ecourt/konseptor-sementara/route"), method: "POST", url: "/api/aleta-ecourt/konseptor-sementara", aksi: "sidang.konseptor", tolak: "pp", terima: "hakim" },
    { nama: "ecourt-aksi/verifikasi", impor: () => import("@/app/api/aleta-ecourt/ecourt-aksi/verifikasi/route"), method: "POST", url: "/api/aleta-ecourt/ecourt-aksi/verifikasi", aksi: "ecourt.verifikasi", tolak: "pp", terima: "hakim" },
    { nama: "ecourt-aksi/tte", impor: () => import("@/app/api/aleta-ecourt/ecourt-aksi/tte/route"), method: "POST", url: "/api/aleta-ecourt/ecourt-aksi/tte", aksi: "ecourt.tte", tolak: "hakim", terima: "panitera" },
    { nama: "kehadiran-mediasi", impor: () => import("@/app/api/aleta-ecourt/kehadiran-mediasi/route"), method: "POST", url: "/api/aleta-ecourt/kehadiran-mediasi", aksi: "mediasi.catat", tolak: "kasir", terima: "mediator" },
    { nama: "mediasi-status", impor: () => import("@/app/api/aleta-ecourt/mediasi-status/route"), method: "POST", url: "/api/aleta-ecourt/mediasi-status", aksi: "mediasi.catat", tolak: "js", terima: "mediator" },
    { nama: "putusan (draf)", impor: () => import("@/app/api/aleta-ecourt/putusan/route"), method: "POST", url: "/api/aleta-ecourt/putusan", aksi: "putusan.draf", tolak: "js", terima: "pp" },
    { nama: "tanda-tangan", impor: () => import("@/app/api/aleta-ecourt/tanda-tangan/route"), method: "POST", url: "/api/aleta-ecourt/tanda-tangan", aksi: "ttd.kelola", tolak: "hakim", terima: "admin" },
    { nama: "identitas-pihak", impor: () => import("@/app/api/aleta-ecourt/identitas-pihak/route"), method: "GET", url: "/api/aleta-ecourt/identitas-pihak?nomorPerkara=1/Pdt.G/2026/PA.Dgl", aksi: "status.data-pihak", tolak: "sekretaris", terima: "kasir" },
    { nama: "kontak-para-pihak (Agen D)", impor: () => import("@/app/api/aleta-ecourt/kontak-para-pihak/route"), method: "GET", url: "/api/aleta-ecourt/kontak-para-pihak?nomor=1/Pdt.G/2026/PA.Dgl", aksi: "status.data-pihak", tolak: "staf", terima: "mediator" },
    { nama: "prompt-putusan", impor: () => import("@/app/api/aleta-ecourt/prompt-putusan/route"), method: "GET", url: "/api/aleta-ecourt/prompt-putusan?nomor=1/Pdt.G/2026/PA.Dgl", aksi: "status.analisa", tolak: "kasir", terima: "hakim" },
  ];

  it.each(RUTE)("$nama: $tolak 403, $terima lolos pagar matriks", async ({ impor, method, url, tolak, terima, badan }) => {
    const modul = await impor();
    keadaan.aktor = AKUN[tolak] as unknown as Record<string, unknown>;
    const ditolak = await panggil(modul, method, permintaan(url, method, badan ?? {}));
    expect(ditolak.status).toBe(403);
    expect(ditolak.pesan).toMatch(/matriks peran/);

    keadaan.aktor = AKUN[terima] as unknown as Record<string, unknown>;
    const diterima = await panggil(modul, method, permintaan(url, method, badan ?? {}));
    // Sesudah pagar boleh gagal karena isian kosong/bot mati - asal BUKAN tolakan matriks.
    expect(diterima.pesan).not.toMatch(/matriks peran/);
  });

  it("setiap aksi yang menyebut rute benar-benar terpasang di rute itu", () => {
    const AKAR = path.resolve(__dirname, "..");
    const terpasang: string[] = [];
    for (const [kunci, a] of Object.entries(AKSI)) {
      for (const r of a.rute) {
        const m = r.match(/\/api\/(aleta-ecourt\/[\w\-/]+)/);
        if (!m || r.includes("*") || r.includes("unggah") || r.includes("isian-sipp") || r.includes("kasir") || r.includes("court-calendar") || r.includes("relaas") || r.includes("penarikan") || r.includes("kendali-berkas") || r.includes("hasil-mediasi")) continue;
        const teks = readFileSync(path.join(AKAR, "app/api", m[1], "route.ts"), "utf8");
        expect(
          teks.includes(`pastikanAksi(db, actorUserId, "${kunci}")`) || teks.includes(`"${kunci}"); // HAK-PERAN`),
          `${kunci} di ${m[1]}`
        ).toBe(true);
        terpasang.push(m[1]);
      }
    }
    expect(terpasang.length).toBeGreaterThanOrEqual(25);
  });

  it("API aplikasi belum fix 403 bagi hakim; Super Admin & timpaan buka:<id> lolos", async () => {
    const ringkas = await import("@/app/api/aleta-sipp/summary/route");
    const audit = await import("@/app/api/aleta-e-audit/katalog/route");
    keadaan.aktor = AKUN.hakim as unknown as Record<string, unknown>;
    for (const m of [ringkas, audit]) {
      const r = await panggil(m as Record<string, unknown>, "GET", permintaan("/api/x", "GET"));
      expect(r.status).toBe(403);
      expect(r.pesan).toMatch(/belum dibuka untuk peran Anda/);
    }
    keadaan.timpaan = [{ module_id: kunciBukaAplikasi("aleta-e-audit"), enabled: 1 }];
    const dibuka = await panggil(audit as Record<string, unknown>, "GET", permintaan("/api/x", "GET"));
    expect(dibuka.pesan).not.toMatch(/belum dibuka/);
    keadaan.timpaan = [];
    keadaan.aktor = AKUN.superadmin as unknown as Record<string, unknown>;
    const sa = await panggil(ringkas as Record<string, unknown>, "GET", permintaan("/api/x", "GET"));
    expect(sa.pesan).not.toMatch(/belum dibuka/);
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe("5. ekstensi: panel-alat.js memakai golonganMenu dari server", () => {
  const AKAR = path.resolve(__dirname, "../../..");
  const SUMBER = readFileSync(path.join(AKAR, "ekstensi-sipp/panel-alat.js"), "utf8").replace(/\r\n/g, "\n");
  const terbuka: JSDOM[] = [];
  beforeEach(() => undefined);
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
    const w = dom.window as any;
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
    const salin = (m: unknown) => (m === null ? null : Array.from(m as string[]));
    return {
      menu: (situs: string, halaman: string, p: unknown, o?: unknown) => salin(w.alatMenuPeran(situs, halaman, p, o)),
      setel: (d: unknown) => w.alatSetelGolonganServer(d),
    };
  }

  // Objek pengguna seperti jawaban sipp-konteks / ekstensi/siapa.
  const dari = (nama: NamaAkun, peran: string) => ({ peran, golonganMenu: golonganMenuEkstensi(AKUN[nama]) });

  it.each([
    ["kasir", "Pelaksana", ["kasir", "perkara"]],
    ["ptsp", "Pelaksana", ["ptsp", "berkas", "perkara"]],
    ["pp", "Panitera Pengganti", ["berkas", "perkara"]],
    ["panitera", "Panitera", ["berkas", "perkara", "ptsp"]],
    ["panmudGugatan", "Panitera Muda", ["berkas", "perkara", "ptsp"]],
    ["jsp", "Pelaksana", ["jurusita", "perkara", "berkas"]],
    ["mediator", "Pelaksana", ["perkara", "berkas"]],
    ["analis", "Analis Perkara", ["berkas", "perkara"]],
    ["sekretaris", "Sekretaris", ["perkara"]],
    ["staf", "Pelaksana", ["perkara"]],
    ["hakim", "Hakim", ["putusan", "berkas", "perkara"]],
  ] as Array<[NamaAkun, string, string[]]>)("SIPP perkara %s (nama peran %s) -> %j", (nama, peran, harap) => {
    const x = muat();
    expect(x.menu("sipp", "perkara", dari(nama, peran), { ditangani: true })).toEqual(harap);
  });

  it("Jurusita PENGGANTI (jabatan, role pelaksana) kini dikenali - dulu 'lain' = semua tab", () => {
    const x = muat();
    expect(x.menu("sipp", "perkara", "Pelaksana")).toBeNull(); // tebakan nama: susunan lama
    expect(x.menu("sipp", "perkara", dari("jsp", "Pelaksana"))).toEqual(["jurusita", "perkara", "berkas"]);
  });

  it("ABT (memanggil dengan NAMA peran) memakai golongan server yang diingat", () => {
    const x = muat();
    expect(x.menu("abt", "perkara", "Pelaksana")).toBeNull();
    // PTSP di ABT: susunan lama (keputusan R 11 Okt butir 5 belum dijawab) - null.
    x.setel(golonganMenuEkstensi(AKUN.ptsp));
    expect(x.menu("abt", "perkara", "Pelaksana", { ditangani: true })).toBeNull();
    x.setel(golonganMenuEkstensi(AKUN.sekretaris));
    expect(x.menu("abt", "perkara", "Sekretaris", { ditangani: true })).toEqual([]);
    x.setel(golonganMenuEkstensi(AKUN.pp));
    expect(x.menu("abt", "perkara", "Panitera Pengganti", { ditangani: true })).toEqual(["susun-saksi", "isi-bas"]);
    x.setel(golonganMenuEkstensi(AKUN.hakim));
    expect(x.menu("abt", "daftar", "Hakim")).toEqual(["putusan-massal"]);
  });

  it("tanpa golonganMenu (portal lama) tidak ada yang bergeser: tebakan nama lama", () => {
    const x = muat();
    expect(x.menu("sipp", "perkara", "Panitera Pengganti")).toEqual(["berkas", "perkara"]);
    expect(x.menu("sipp", "perkara", { peran: "Pelaksana", peranTambahan: ["kasir"] })).toEqual(["kasir", "perkara"]);
  });

  it("setiap golonganMenu yang dapat dikirim server punya tabel di keempat matriks", () => {
    const x = muat();
    const semua = new Set<string>();
    for (const a of Object.values(AKUN)) for (const g of golonganMenuEkstensi(a)) semua.add(g);
    for (const g of semua) {
      for (const [situs, halaman] of [
        ["sipp", "perkara"],
        ["sipp", "daftar"],
        ["abt", "perkara"],
        ["abt", "daftar"],
      ]) {
        if (g === "ptsp" && situs === "abt") continue; // susunan lama (lihat di atas)
        expect(x.menu(situs, halaman, { peran: "x", golonganMenu: [g] }, { ditangani: true }), `${g} ${situs}/${halaman}`).not.toBeNull();
      }
    }
  });
});
