// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

/**
 * ============================================================================
 * MATRIKS MENU PER PERAN (perbaikan 30 Sep sore butir 1, kontrak K1)
 * ============================================================================
 *
 * panel-alat.js dijalankan UTUH di jsdom, lalu alatGolonganPeran dan
 * alatMenuPeran ditanya untuk SETIAP peran portal - nama dan id-nya, dibaca
 * langsung dari src/lib/types.ts (RoleId) dan src/lib/mock-data.ts (roles),
 * supaya peran yang kelak ditambahkan ke portal tidak lolos tanpa golongan
 * yang diputuskan di sini.
 *
 * Urutan menu = urutan kiri ke kanan di DAFTAR.md butir 1 (menu pertama =
 * bawaan terbuka). Peran "lain" (operator, analis perkara, staf, ...) = null:
 * pemanggil memakai susunan lama, tidak dikurangi.
 */

const AKAR = path.resolve(__dirname, "../../..");
const baca = (b: string) => readFileSync(path.join(AKAR, b), "utf8").replace(/\r\n/g, "\n");
// ALETA_UJI_ALAT: salinan yang sengaja dirusak, untuk membuktikan penjaga ini menggigit.
const SUMBER_ALAT = process.env.ALETA_UJI_ALAT
  ? readFileSync(process.env.ALETA_UJI_ALAT, "utf8").replace(/\r\n/g, "\n")
  : baca("ekstensi-sipp/panel-alat.js");
const TYPES = baca("manajemen_surat/src/lib/types.ts");
const MOCK = baca("manajemen_surat/src/lib/mock-data.ts");

const terbuka: JSDOM[] = [];
afterEach(async () => {
  // Rantai pemuatan panel-alat.js (tampilan, senyap, tampilan server) masih
  // berjalan sesaat sesudah uji - jendela ditutup sesudah rantainya reda.
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
  vm.runInContext(SUMBER_ALAT, ctx, { filename: "panel-alat.js" });
  return {
    golongan: (p: unknown): string => w.alatGolonganPeran(p),
    menu: (situs: string, halaman: string, peran: unknown, opsi?: unknown): string[] | null => {
      const m = w.alatMenuPeran(situs, halaman, peran, opsi);
      // Larik dari konteks vm lain: disalin supaya toEqual membandingkan isinya.
      return m === null ? null : Array.from(m as string[]);
    },
    mentah: (situs: string, halaman: string, peran: unknown): string[] | null => w.alatMenuPeran(situs, halaman, peran),
    tabel: () => vm.runInContext("ALAT_MENU_PERAN", ctx) as Record<string, Record<string, Record<string, string[]>>>,
  };
}

// ── Peran portal, dibaca dari sumbernya ─────────────────────────────────────

const ROLE_ID = (() => {
  const blok = TYPES.slice(TYPES.indexOf("export type RoleId"), TYPES.indexOf(";", TYPES.indexOf("export type RoleId")));
  return Array.from(blok.matchAll(/\|\s*"([a-z-]+)"/g)).map((m) => m[1]);
})();

const PERAN_MOCK = (() => {
  const blok = MOCK.slice(MOCK.indexOf("export const roles"), MOCK.indexOf("export const positions"));
  return Array.from(blok.matchAll(/id:\s*"([a-z-]+)",\s*\n\s*name:\s*"([^"]+)"/g)).map((m) => ({ id: m[1], nama: m[2] }));
})();

/**
 * Golongan tiap RoleId - keputusan DAFTAR.md butir 1:
 *   Super Admin & Admin -> admin; Ketua/Wakil -> ketua; Hakim -> hakim;
 *   Panitera/Panmud/PP -> panitera; Jurusita -> jurusita;
 *   selebihnya (Kepala Subbagian, Sekretaris, Pejabat Struktural, operator,
 *   analis, staf, ...) -> lain = susunan lama.
 */
const GOLONGAN: Record<string, string> = {
  "super-admin": "admin",
  admin: "admin",
  ketua: "ketua",
  "wakil-ketua": "ketua",
  hakim: "hakim",
  sekretaris: "lain",
  panitera: "panitera",
  "panitera-muda": "panitera",
  "panitera-pengganti": "panitera",
  kasubag: "lain",
  jurusita: "jurusita",
  "pranata-komputer": "lain",
  "analis-keuangan": "lain",
  "analis-perkara": "lain",
  pelaksana: "lain",
  pppk: "lain",
  "pejabat-struktural": "lain",
  staf: "lain",
  operator: "lain",
};

describe("sumber peran terbaca utuh", () => {
  it("RoleId di types.ts dan roles di mock-data.ts sama, dan semuanya punya golongan yang diputuskan", () => {
    expect(ROLE_ID.length).toBeGreaterThanOrEqual(19);
    expect(PERAN_MOCK.map((x) => x.id).sort()).toEqual([...ROLE_ID].sort());
    // Peran baru di portal = keputusan baru: uji ini merah sampai golongannya ditulis di atas.
    expect([...ROLE_ID].sort()).toEqual(Object.keys(GOLONGAN).sort());
  });
});

// ============================================================================
describe("alatGolonganPeran: setiap nama DAN id peran portal", () => {
  it("id peran (RoleId)", () => {
    const m = muat();
    for (const id of ROLE_ID) expect(m.golongan(id), id).toBe(GOLONGAN[id]);
  });

  it("nama peran (mock-data roles) - golongannya sama dengan id-nya", () => {
    const m = muat();
    for (const { id, nama } of PERAN_MOCK) expect(m.golongan(nama), `${nama} (${id})`).toBe(GOLONGAN[id]);
  });

  it("jebakan nama: Kepala Subbagian, Sekretaris, Pejabat Struktural bukan ketua/admin; Panitera Muda = panitera", () => {
    const m = muat();
    expect(m.golongan("Kepala Subbagian")).toBe("lain");
    expect(m.golongan("Sekretaris")).toBe("lain");
    expect(m.golongan("Pejabat Struktural")).toBe("lain");
    expect(m.golongan("Panitera Muda")).toBe("panitera");
    expect(m.golongan("PPPK")).toBe("lain");
    expect(m.golongan("Staf Pelaksana")).toBe("lain");
    expect(m.golongan("Pranata Komputer")).toBe("lain");
  });

  it("nama jabatan portal yang mungkin terbawa (positions) tidak salah golongan", () => {
    const m = muat();
    const harap: Array<[string, string]> = [
      ["Ketua Pengadilan", "ketua"],
      ["Wakil Ketua", "ketua"],
      // "wakil" saja tidak menjadikan ketua (temuan agen J).
      ["Wakil Panitera", "panitera"],
      ["Panitera Muda Hukum", "panitera"],
      ["Panitera Muda Gugatan", "panitera"],
      ["Panitera Muda Permohonan", "panitera"],
      ["Jurusita Pengganti", "jurusita"],
      ["Juru Sita", "jurusita"],
      ["PP", "panitera"],
      ["Kasubag Umum dan Keuangan", "lain"],
      ["Kasubag Kepegawaian", "lain"],
      ["Analis Perkara Peradilan", "lain"],
      ["Pengelola Penanganan Perkara - Gugatan", "lain"],
      ["Petugas PTSP", "lain"],
      ["Operator Layanan Operasional - Umum", "lain"],
      ["Administrator", "admin"],
    ];
    for (const [nama, g] of harap) expect(m.golongan(nama), nama).toBe(g);
  });

  it("huruf besar/kecil, tanda hubung, garis bawah, dan spasi tepi tidak berpengaruh; kosong = lain", () => {
    const m = muat();
    expect(m.golongan("  SUPER_ADMIN ")).toBe("admin");
    expect(m.golongan("Panitera-Pengganti")).toBe("panitera");
    expect(m.golongan("WAKIL KETUA")).toBe("ketua");
    for (const x of ["", null, undefined, 0]) expect(m.golongan(x), String(x)).toBe("lain");
  });
});

// ============================================================================
// Matriks - DAFTAR.md butir 1, urutan PERSIS kiri ke kanan
// ============================================================================
const SIPP_PERKARA: Record<string, string[]> = {
  admin: ["penetapan", "putusan", "jurusita", "berkas", "perkara"],
  ketua: ["penetapan", "putusan", "berkas", "perkara"],
  hakim: ["putusan", "berkas", "perkara"],
  panitera: ["berkas", "perkara"],
  jurusita: ["jurusita", "perkara", "berkas"],
};
const SIPP_DAFTAR: Record<string, string[]> = {
  admin: ["penetapan-massal", "bas-massal", "relaas-pbt-massal", "putusan-massal"],
  ketua: ["penetapan-massal", "putusan-massal"],
  hakim: ["putusan-massal"],
  panitera: ["bas-massal"],
  jurusita: ["relaas-pbt-massal"],
};
const ABT_PERKARA: Record<string, string[]> = {
  admin: ["semua"],
  ketua: ["isi-input", "unggah-putusan"],
  hakim: ["isi-input", "unggah-putusan"],
  panitera: ["susun-saksi"],
  jurusita: ["jurusita"],
};
const ABT_DAFTAR: Record<string, string[]> = {
  admin: ["putusan-massal", "bas-massal", "relaas-pbt-massal"],
  ketua: ["putusan-massal"],
  hakim: ["putusan-massal"],
  panitera: ["bas-massal"],
  jurusita: ["relaas-pbt-massal"],
};

describe("alatMenuPeran: tiap peran portal, tiap situs dan halaman", () => {
  const kasus: Array<[string, string, Record<string, string[]>]> = [
    ["sipp", "perkara", SIPP_PERKARA],
    ["sipp", "daftar", SIPP_DAFTAR],
    ["abt", "perkara", ABT_PERKARA],
    ["abt", "daftar", ABT_DAFTAR],
  ];
  for (const [situs, halaman, harap] of kasus) {
    it(`${situs} / ${halaman} - ditangani belum diketahui (tidak mengurangi)`, () => {
      const m = muat();
      for (const { id, nama } of PERAN_MOCK) {
        const g = GOLONGAN[id];
        const hasil = g === "lain" ? null : harap[g];
        expect(m.menu(situs, halaman, id), `${id}`).toEqual(hasil);
        expect(m.menu(situs, halaman, nama), `${nama}`).toEqual(hasil);
        expect(m.menu(situs, halaman, nama, { ditangani: true }), `${nama} ditangani`).toEqual(hasil);
      }
    });
  }

  it("tab Juru Sita ADA bagi Super Admin dan Admin di SIPP (perkara)", () => {
    const m = muat();
    for (const p of ["Super Admin", "Admin", "super-admin", "admin"]) expect(m.menu("sipp", "perkara", p)).toContain("jurusita");
  });

  it("putusan massal TIDAK tampil bagi juru sita (U1); relaas & PBT massal ada di daftar SIPP dan beranda ABT (U2)", () => {
    const m = muat();
    for (const situs of ["sipp", "abt"]) {
      expect(m.menu(situs, "daftar", "Jurusita")).not.toContain("putusan-massal");
      expect(m.menu(situs, "daftar", "Jurusita")).toContain("relaas-pbt-massal");
    }
  });

  it("BAS massal (U4) bagi panitera dan PP di kedua situs", () => {
    const m = muat();
    for (const p of ["Panitera", "Panitera Muda", "Panitera Pengganti"]) {
      expect(m.menu("sipp", "daftar", p)).toEqual(["bas-massal"]);
      expect(m.menu("abt", "daftar", p)).toEqual(["bas-massal"]);
    }
  });
});

describe("perkara yang TIDAK ditangani: membaca boleh, mengerjakan tidak", () => {
  it("SIPP: hanya Perkara dan Berkas (urutan peran dipertahankan); Admin tetap semua", () => {
    const m = muat();
    const t = { ditangani: false };
    expect(m.menu("sipp", "perkara", "Hakim", t)).toEqual(["berkas", "perkara"]);
    expect(m.menu("sipp", "perkara", "Panitera Pengganti", t)).toEqual(["berkas", "perkara"]);
    expect(m.menu("sipp", "perkara", "Jurusita", t)).toEqual(["perkara", "berkas"]);
    expect(m.menu("sipp", "perkara", "Super Admin", t)).toEqual(SIPP_PERKARA.admin);
    expect(m.menu("sipp", "perkara", "Admin", t)).toEqual(SIPP_PERKARA.admin);
  });

  it("SIPP Ketua/Wakil: Penetapan TETAP ada (PMH ditetapkan sebelum ada majelis - K2), Putusan tidak", () => {
    const m = muat();
    for (const p of ["Ketua", "Wakil Ketua", "wakil-ketua"]) {
      expect(m.menu("sipp", "perkara", p, { ditangani: false }), p).toEqual(["penetapan", "berkas", "perkara"]);
      expect(m.menu("sipp", "perkara", p, { ditangani: false, penunjukanLengkap: true }), p).toEqual(["berkas", "perkara"]);
    }
  });

  it("ABT: tidak ada menu kerja; Admin tetap semua", () => {
    const m = muat();
    for (const p of ["Ketua", "Hakim", "Panitera Pengganti", "Jurusita"]) {
      expect(m.menu("abt", "perkara", p, { ditangani: false }), p).toEqual([]);
    }
    expect(m.menu("abt", "perkara", "Super Admin", { ditangani: false })).toEqual(["semua"]);
  });

  it("halaman daftar/beranda tidak dikurangi oleh 'ditangani'", () => {
    const m = muat();
    expect(m.menu("sipp", "daftar", "Hakim", { ditangani: false })).toEqual(SIPP_DAFTAR.hakim);
    expect(m.menu("abt", "daftar", "Jurusita", { ditangani: false })).toEqual(ABT_DAFTAR.jurusita);
  });

  it("peran 'lain' tetap null walau tidak menangani - susunan lama tidak dikurangi", () => {
    const m = muat();
    for (const p of ["Operator", "Analis Perkara", "Kepala Subbagian", "Sekretaris", "Staf Pelaksana"]) {
      expect(m.menu("sipp", "perkara", p, { ditangani: false }), p).toBeNull();
      expect(m.menu("abt", "daftar", p), p).toBeNull();
    }
  });
});

describe("penunjukan lengkap (PMH, PPP, PJS, PHS): tab Penetapan Ketua/Wakil hilang", () => {
  it("hanya Ketua/Wakil di SIPP perkara; Admin tetap melihat Penetapan", () => {
    const m = muat();
    const o = { penunjukanLengkap: true };
    expect(m.menu("sipp", "perkara", "Ketua", o)).toEqual(["putusan", "berkas", "perkara"]);
    expect(m.menu("sipp", "perkara", "Wakil Ketua", o)).toEqual(["putusan", "berkas", "perkara"]);
    expect(m.menu("sipp", "perkara", "Super Admin", o)).toEqual(SIPP_PERKARA.admin);
    expect(m.menu("sipp", "perkara", "Ketua", { penunjukanLengkap: false })).toEqual(SIPP_PERKARA.ketua);
    // Penetapan massal di daftar tidak ikut hilang.
    expect(m.menu("sipp", "daftar", "Ketua", o)).toEqual(SIPP_DAFTAR.ketua);
  });
});

describe("ketahanan", () => {
  it("situs/halaman asing dan nama properti Object = null, tidak melempar", () => {
    const m = muat();
    for (const [s, h] of [
      ["ecourt", "perkara"],
      ["sipp", "beranda"],
      ["constructor", "perkara"],
      ["sipp", "constructor"],
      ["__proto__", "daftar"],
      ["sipp", "hasOwnProperty"],
    ]) {
      expect(m.menu(s, h, "Super Admin"), `${s}/${h}`).toBeNull();
    }
  });

  it("hasilnya salinan: mengubahnya tidak mengubah matriks", () => {
    const m = muat();
    const sebelum = JSON.stringify(m.tabel());
    for (const [s, h, p] of [
      ["sipp", "perkara", "Super Admin"],
      ["sipp", "perkara", "Ketua"],
      ["abt", "daftar", "Hakim"],
    ]) {
      const hasil = m.mentah(s, h, p)!;
      hasil.length = 0;
      hasil.push("rusak");
    }
    expect(m.menu("sipp", "perkara", "Super Admin")).toEqual(SIPP_PERKARA.admin);
    expect(m.menu("sipp", "perkara", "Ketua")).toEqual(SIPP_PERKARA.ketua);
    expect(m.menu("abt", "daftar", "Hakim")).toEqual(ABT_DAFTAR.hakim);
    expect(JSON.stringify(m.tabel())).toBe(sebelum);
  });

  it("opsi bukan objek diperlakukan kosong", () => {
    const m = muat();
    for (const o of [null, "x", 5, true]) expect(m.menu("sipp", "perkara", "Hakim", o)).toEqual(SIPP_PERKARA.hakim);
  });
});
