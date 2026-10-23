// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";

import { JSDOM } from "jsdom";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * ============================================================================
 * AUDIT HAK AKSES & TAMPIL PER PERAN - 23 OKT 2026 (agen W67)
 * ============================================================================
 *
 * Tiap fitur yang diubah audit ini diuji per peran, di layar (atau ekstensi) DAN di penjaga server:
 *   1. isian perkara Kelas B (POST /api/aleta-ecourt/isian): dulu kemampuan panel = semua peran;
 *      kini aksi matriks isian.perkara (pemegang perkara + Admin) - 403 bagi kasir, PTSP, kesekretariatan.
 *   2. tunda/putus otomatis: GET mengirim bolehBatal per peran (aksi sidang.tunda-putus) supaya tombol
 *      "Jangan tunda/putus otomatis" tidak tampil bagi yang ditolak POST batal/pulihkan; saklar tetap Super Admin.
 *   3. ekstensi: "Tarik dari e-Court" di panel lama mengikuti kemampuan "permintaan"; tombol "Unggah massal ke
 *      e-Doc SIPP" di panel massal ABT mengikuti hakUnggahMassal; mode latihan/Tarik data e-Court di popup
 *      memakai golongan portal (Super Admin/Admin), bukan tebakan nama peran.
 * Layar Jadwal Sidang (keterangan perkara, unduhan pada tautan rahasia) diuji di audit-hak-tampil-23okt-layar.test.tsx.
 */

const keadaan = vi.hoisted(() => ({ aktor: null as Record<string, unknown> | null, simpan: 0 }));

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
vi.mock("@/server/modules/aleta-ecourt/akses", () => ({
  pastikanKapabilitas: async () => keadaan.aktor,
  bolehMenyuntingAkses: (u: { roleId?: string } | null) => String(u?.roleId || "") === "super-admin",
}));
vi.mock("@/server/shared/admin-access-audit", async () => {
  const { NextResponse } = await import("next/server");
  return {
    handleAdminRouteError: (galat: { status?: number; message?: string }) =>
      NextResponse.json({ ok: false, error: { message: String(galat && galat.message) } }, { status: Number(galat && galat.status) || 500 }),
  };
});
vi.mock("@/server/modules/aleta-ecourt/isian-perkara", () => ({
  kesiapanIsian: async () => ({}),
  penandaKelasB: async () => [],
  riwayatIsian: async () => [],
  simpanIsian: async () => {
    keadaan.simpan += 1;
    return { ok: true, jumlahDisimpan: 1, ditolak: [] };
  },
}));
const SETELAN = { nyala: false, kering: true, jam: "16:30", diubahOleh: "", diubahPada: "", ip: "" };
vi.mock("@/server/modules/tunda-otomatis/layanan", () => ({
  bacaDaftarHari: async () => ({ tanggal: "2026-10-23", setelan: { ...SETELAN }, butir: [], tahap: "pratinjau" }),
  jalankanTundaOtomatis: async () => ({ jalan: false, butir: [] }),
  simpanSetelan: async () => ({ ...SETELAN }),
  tandaiBatal: async () => ({ ok: true }),
}));
vi.mock("@/server/modules/putus-otomatis/layanan", () => ({
  bacaDaftarPutus: async () => ({ tanggal: "2026-10-23", setelan: { ...SETELAN, diubahOlehId: "" }, butir: [], tahap: "pratinjau" }),
  jalankanPutusOtomatis: async () => ({ jalan: false, butir: [] }),
  simpanSetelanPutus: async () => ({ ...SETELAN }),
  tandaiBatalPutus: async () => ({ ok: true }),
}));

import { bolehAksi } from "@/lib/matriks-peran";
import type { UserPersona } from "@/lib/types";

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
  analis: akun("analis-perkara", "pos-analis-perkara"),
  kasir: akun("pelaksana", "pos-staf-umum", ["kasir"]),
  ptsp: akun("pelaksana", "pos-ptsp", ["petugas_ptsp"]),
  mediator: akun("pelaksana", "pos-staf-umum", ["mediator"]),
  sekretaris: akun("sekretaris", "pos-sekretaris"),
  ti: akun("pranata-komputer", "pos-pranata-komputer"),
  staf: akun("pelaksana", "pos-staf-umum"),
  penjaga: akun("pelaksana", "pos-staf-umum", ["penjaga_sidang"]),
};
type NamaAkun = keyof typeof AKUN;
const SEMUA = Object.keys(AKUN) as NamaAkun[];

afterEach(() => {
  keadaan.aktor = null;
  keadaan.simpan = 0;
});

const permintaan = (url: string, method = "GET", body: unknown = {}) =>
  new NextRequest(`http://127.0.0.1:3000/aleta${url}`, {
    method,
    headers: { "content-type": "application/json" },
    body: method === "GET" ? undefined : JSON.stringify(body),
  });

async function panggil(f: (r: NextRequest) => Promise<Response>, req: NextRequest) {
  const r = await f(req);
  let isi: Record<string, unknown> = {};
  try {
    isi = await r.clone().json();
  } catch {
    /* bukan JSON */
  }
  return { status: r.status, isi };
}

// ─── 1. Isian perkara Kelas B ────────────────────────────────────────────────

const ISIAN_BOLEH: NamaAkun[] = ["superadmin", "admin", "ketua", "hakim", "panitera", "panmud", "pp", "js", "analis"];
const ISIAN_TOLAK: NamaAkun[] = ["kasir", "ptsp", "mediator", "sekretaris", "ti", "staf", "penjaga"];

describe("1. isian perkara Kelas B - aksi isian.perkara", () => {
  it("matriks: pemegang perkara + Admin boleh, peran lain tidak", () => {
    expect([...ISIAN_BOLEH, ...ISIAN_TOLAK].sort()).toEqual([...SEMUA].sort());
    for (const n of ISIAN_BOLEH) expect(bolehAksi(AKUN[n], "isian.perkara"), n).toBe(true);
    for (const n of ISIAN_TOLAK) expect(bolehAksi(AKUN[n], "isian.perkara"), n).toBe(false);
  });

  it("rute POST menolak 403 tanpa menyimpan; yang berhak menyimpan", async () => {
    const { POST } = await import("@/app/api/aleta-ecourt/isian/route");
    for (const n of ISIAN_TOLAK) {
      keadaan.aktor = AKUN[n] as unknown as Record<string, unknown>;
      const r = await panggil(POST, permintaan("/api/aleta-ecourt/isian", "POST", { perkaraId: "1", nilai: { "1001": "x" } }));
      expect(r.status, n).toBe(403);
      expect(String((r.isi.error as { message?: string } | undefined)?.message), n).toMatch(/Menyimpan isian perkara/);
    }
    expect(keadaan.simpan).toBe(0);
    for (const n of ISIAN_BOLEH) {
      keadaan.aktor = AKUN[n] as unknown as Record<string, unknown>;
      const r = await panggil(POST, permintaan("/api/aleta-ecourt/isian", "POST", { perkaraId: "1", nilai: { "1001": "x" } }));
      expect(r.status, n).toBe(200);
    }
    expect(keadaan.simpan).toBe(ISIAN_BOLEH.length);
  });

  it("membaca isian tetap terbuka bagi pemegang panel (kasir pun)", async () => {
    const { GET } = await import("@/app/api/aleta-ecourt/isian/route");
    keadaan.aktor = AKUN.kasir as unknown as Record<string, unknown>;
    const r = await panggil(GET, permintaan("/api/aleta-ecourt/isian?perkaraId=1"));
    expect(r.status).not.toBe(403);
  });
});

// ─── 2. Tunda / putus otomatis - bolehBatal ───────────────────────────────────

const BATAL_BOLEH: NamaAkun[] = ["superadmin", "admin", "ketua", "hakim", "panitera", "panmud", "pp"];
const BATAL_TOLAK: NamaAkun[] = ["js", "analis", "kasir", "ptsp", "mediator", "sekretaris", "ti", "staf", "penjaga"];

describe("2. tunda & putus otomatis - tombol pengecualian per peran, saklar hanya Super Admin", () => {
  for (const [nama, impor] of [
    ["tunda-otomatis", () => import("@/app/api/aleta-ecourt/tunda-otomatis/route")],
    ["putus-otomatis", () => import("@/app/api/aleta-ecourt/putus-otomatis/route")],
  ] as const) {
    it(`${nama}: GET mengirim bolehBatal sama dengan penjaga POST batal`, async () => {
      const { GET, POST } = await impor();
      expect([...BATAL_BOLEH, ...BATAL_TOLAK].sort()).toEqual([...SEMUA].sort());
      for (const n of SEMUA) {
        keadaan.aktor = AKUN[n] as unknown as Record<string, unknown>;
        const baca = await panggil(GET, permintaan(`/api/aleta-ecourt/${nama}?tanggal=2026-10-23`));
        expect(baca.status, n).toBe(200);
        const data = (baca.isi.data ?? baca.isi) as { bolehBatal?: boolean; bolehUbahSetelan?: boolean };
        const boleh = BATAL_BOLEH.includes(n);
        expect(data.bolehBatal, `${n} bolehBatal`).toBe(boleh);
        expect(data.bolehUbahSetelan, `${n} bolehUbahSetelan`).toBe(n === "superadmin");
        const batal = await panggil(POST, permintaan(`/api/aleta-ecourt/${nama}`, "POST", { aksi: "batal", tanggal: "2026-10-23", jadwalId: "11" }));
        if (boleh) expect(batal.status, `${n} batal`).toBe(200);
        else expect(batal.status, `${n} batal`).toBe(403);
        const setel = await panggil(POST, permintaan(`/api/aleta-ecourt/${nama}`, "POST", { aksi: "setelan", nyala: true }));
        expect(setel.status, `${n} setelan`).toBe(n === "superadmin" ? 200 : 403);
      }
    });
  }
});

// ─── 3. Ekstensi ─────────────────────────────────────────────────────────────

const AKAR = path.resolve(process.cwd(), "..");
const baca = (b: string) => readFileSync(path.join(AKAR, b), "utf8").replace(/\r\n/g, "\n");

function potongFungsi(isi: string, kepala: string): string {
  const awal = isi.indexOf(kepala);
  if (awal < 0) throw new Error(`fungsi tidak ada: ${kepala}`);
  const akhir = isi.indexOf("\n}\n", awal);
  return isi.slice(awal, akhir + 3);
}

describe("3a. panel lama SIPP: Tarik dari e-Court mengikuti kemampuan permintaan", () => {
  const sumber = potongFungsi(baca("ekstensi-sipp/konten.js"), "async function sisipkanPermintaan(panel, nomorPerkara) {");
  async function jalankan(bolehPermintaan: boolean | null) {
    const dom = new JSDOM(`<!doctype html><div id="p"><div class="aleta-isi"></div></div>`, { runScripts: "outside-only" });
    const w = dom.window as unknown as Record<string, unknown> & { document: Document; eval: (s: string) => unknown };
    let ambil = 0;
    w.boleh = (k: string) => (k === "permintaan" ? bolehPermintaan !== false : true);
    w.ALETA_API_PERMINTAAN = "/aleta/api/aleta-bot/ecourt/permintaan";
    w.fetch = async () => {
      ambil += 1;
      return { ok: true, json: async () => ({ data: { keadaan: null } }) };
    };
    w.kotakPermintaan = () => {
      const d = w.document.createElement("div");
      d.className = "aleta-permintaan";
      return d;
    };
    w.eval(`${sumber}\nwindow.__sisip = sisipkanPermintaan;`);
    await (w.__sisip as (p: Element, n: string) => Promise<void>)(w.document.getElementById("p")!, "600/Pdt.G/2026/PA.Dgl");
    const ada = Boolean(w.document.querySelector(".aleta-permintaan"));
    dom.window.close();
    return { ada, ambil };
  }
  it("tidak diberi kemampuan -> tanpa tombol, tanpa permintaan ke portal", async () => {
    expect(await jalankan(false)).toEqual({ ada: false, ambil: 0 });
  });
  it("diberi (atau belum terbaca) -> tombol tetap ditawarkan seperti dulu", async () => {
    expect((await jalankan(true)).ada).toBe(true);
    expect((await jalankan(null)).ada).toBe(true);
  });
});

describe("3b. panel massal ABT: tombol Unggah massal ke e-Doc SIPP mengikuti hakUnggahMassal", () => {
  const isi = baca("ekstensi-sipp/abt.js");
  const sumber = potongFungsi(isi, "function f41Pasang() {");
  function pasang(golongan: string[] | null) {
    const dom = new JSDOM(`<!doctype html><div id="aleta-panel-abt-massal"><div class="aleta-isi"></div></div>`, {
      url: "http://192.168.10.10/aps_badilag/abt/main/beranda",
      runScripts: "outside-only",
    });
    const w = dom.window as unknown as Record<string, unknown> & { document: Document; eval: (s: string) => unknown };
    w.setTimeout = (f: () => void) => {
      f();
      return 0;
    };
    w.aletaUnggahMassalBuka = () => undefined;
    w.F41_HASH = "#aleta-unggah-massal";
    w.alatPenggunaAkunAleta = () => (golongan ? { nama: "Uji", golonganMenu: golongan } : null);
    w.alatGolonganMenuSemua = () => golongan ?? ["lain"];
    w.eval(`${sumber}\nf41Pasang();`);
    const ada = Boolean(w.document.querySelector(".aleta-f41-bagian"));
    dom.window.close();
    return ada;
  }
  it("hakim, ketua, PP, panitera, panmud, staf kepaniteraan, admin melihat tombolnya", () => {
    for (const g of [["hakim"], ["ketua"], ["pp"], ["panitera-utama"], ["panmud"], ["analis"], ["admin"]]) expect(pasang(g), g.join()).toBe(true);
  });
  it("juru sita, kasir, PTSP, mediator, kesekretariatan, staf tidak", () => {
    for (const g of [["jurusita"], ["kasir"], ["ptsp"], ["mediator"], ["sekretariat"], ["lain-tetap"]]) expect(pasang(g), g.join()).toBe(false);
  });
  it("akun belum terbaca -> tetap ditawarkan (rute unggah-massal yang menolak)", () => {
    expect(pasang(null)).toBe(true);
  });
});

describe("3c. popup: mode latihan & Tarik data e-Court memakai golongan portal", () => {
  const isi = baca("ekstensi-sipp/popup.js");
  const sumber = [potongFungsi(isi, "function popupAdmin() {"), potongFungsi(isi, "function peranBolehLatihan(peran) {")].join("\n");
  const uji = (identitas: unknown, peran: string) =>
    new Function("identitasPopup", `${sumber}\nreturn peranBolehLatihan(${JSON.stringify(peran)});`)(identitas) as boolean;
  const id = (...semua: string[]) => ({ golongan: { kode: semua[0], semua } });
  it("golongan Super Admin/Admin dari portal -> boleh; golongan lain -> tidak, apa pun nama perannya", () => {
    expect(uji(id("super-admin"), "Super Admin")).toBe(true);
    expect(uji(id("admin"), "Admin")).toBe(true);
    expect(uji(id("hakim"), "Hakim")).toBe(false);
    expect(uji(id("umum"), "Supervisor Administrasi")).toBe(false);
    expect(uji(id("kasir"), "Admin Keuangan")).toBe(false);
  });
  it("portal belum menjawab golongan -> cadangan nama peran seperti dulu", () => {
    expect(uji(null, "Super Admin")).toBe(true);
    expect(uji(null, "Admin")).toBe(true);
    expect(uji(null, "Hakim")).toBe(false);
  });
});
