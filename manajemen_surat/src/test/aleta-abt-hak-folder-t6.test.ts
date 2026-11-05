// @vitest-environment node
/**
 * ============================================================================
 * HAK PER FOLDER ALETA ABT (5 Nov 2026, Tahap 6) - DIUJI PER PERAN, BUKAN HANYA SUPER ADMIN
 * ============================================================================
 * Super Admin melewati pemeriksaan, jadi salah hak tidak terlihat bila hanya diuji dengan akun itu. Baris menu di bawah mengikuti bentuk
 * abt_menu ABT (konfigurasi hak, bukan data perkara atau pihak). Akun rekaan; golongan dihitung oleh golonganPengguna seperti di aplikasi.
 */
import { describe, expect, it } from "vitest";

import {
  GRUP_KE_GOLONGAN,
  GOLONGAN_TANPA_GRUP_ABT,
  barisMenuDari,
  barisTetapanPemilik,
  daftarAngka,
  labelJenis,
  labelTahapan,
  periksaHakFolder,
  periksaTahapan,
  sidikTeks,
  susunMatriks,
  tingkatHak,
  tingkatHakGabungan,
  type BarisMenu,
} from "@/lib/aleta-abt-hak-folder";
import { matriksKeHtml } from "@/lib/aleta-abt-hak-folder-html";
import { putusanHakFolder } from "@/server/modules/aleta-abt-alur/hak-folder";
import { GOLONGAN_PERAN, golonganPengguna, type GolonganPeran } from "@/lib/matriks-peran";
import type { UserPersona } from "@/lib/types";

function akun(roleId: string, positionId = "", additionalRoleIds: string[] = []): UserPersona {
  return { id: `usr-${roleId}`, username: roleId, password: "", name: `Uji ${roleId}`, email: `${roleId}@uji.lokal`, roleId, positionId, additionalRoleIds, isActive: true } as unknown as UserPersona;
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
  analis: akun("analis-perkara", "pos-analis-perkara"),
  staf: akun("staf", "pos-staf-umum"),
};

const baris = (m: Record<string, unknown>) => barisMenuDari({ status: "aktif", ...m });

/** Baris menu bentuk ABT: Putusan Cerai Gugat, BAS Cerai Gugat, Relaas, dan satu folder cek=2. */
const PUTUSAN_CG = baris({ direktori: "1 Perceraian CG", nama: "Putusan Cerai Gugat", parent_direktori: "derry_briantono", proses_id_min: "80", proses_id_max: "297", perkara_id_min: "347", perkara_id_max: "347", perkara_id_referensi: "jenis_perkara_id", user_cek: "3", user_grup_id: "1|10|20", user_top_id: "1", user_validator: null });
const BAS_CG = baris({ direktori: "1 Perceraian CG - BAS", nama: "Cerai Gugat - BAS", parent_direktori: "derry_briantono", proses_id_min: "80", proses_id_max: "297", perkara_id_min: "347", perkara_id_max: "347", perkara_id_referensi: "jenis_perkara_id", user_cek: "3", user_grup_id: "1|30|500|430|1000|1010|1020", user_top_id: "1|30", user_validator: "10|20" });
const RELAAS = baris({ direktori: "98 Relaas", nama: "Relaas", parent_direktori: "derry_briantono", proses_id_min: "20", proses_id_max: "1000", perkara_id_min: "15", perkara_id_max: "17", perkara_id_referensi: "alur_perkara_id", user_cek: "0", user_grup_id: "600", user_top_id: "1", user_validator: null });
const ATAU = baris({ direktori: "Contoh cek dua", parent_direktori: "derry_briantono", proses_id_min: "0", proses_id_max: "1000", user_cek: "2", user_grup_id: "20", user_top_id: "1", user_validator: null });

const golongan = (a: UserPersona) => golonganPengguna(a);

describe("membaca baris menu", () => {
  it("daftar angka: pemisah garis tegak, NULL dan sampah dipisahkan", () => {
    expect(daftarAngka("1|10|20")).toEqual({ angka: [1, 10, 20], taksah: [] });
    expect(daftarAngka(null)).toEqual({ angka: [], taksah: [] });
    expect(daftarAngka("NULL")).toEqual({ angka: [], taksah: [] });
    expect(daftarAngka("-1")).toEqual({ angka: [-1], taksah: [] });
    expect(daftarAngka("30|abc|500")).toEqual({ angka: [30, 500], taksah: ["abc"] });
  });
  it("acuan jenis atau alur dikenali, acuan lain dikosongkan", () => {
    expect(PUTUSAN_CG.referensi).toBe("jenis_perkara_id");
    expect(RELAAS.referensi).toBe("alur_perkara_id");
    expect(baris({ direktori: "x", perkara_id_referensi: "lain" }).referensi).toBe("");
  });
});

describe("hak tiap peran atas folder putusan (cek 3, grup 1|10|20)", () => {
  it("hakim dan pimpinan: boleh bila ditunjuk di perkara; peran lain tidak diberi; Super Admin bebas", () => {
    expect(tingkatHakGabungan(PUTUSAN_CG, golongan(AKUN.hakim))).toBe("ditunjuk");
    expect(tingkatHakGabungan(PUTUSAN_CG, golongan(AKUN.ketua))).toBe("ditunjuk");
    expect(tingkatHakGabungan(PUTUSAN_CG, golongan(AKUN.superadmin))).toBe("bebas");
    for (const k of ["panitera", "panmud", "pp", "js", "kasir", "ptsp", "analis", "staf", "admin"] as const) {
      expect(tingkatHakGabungan(PUTUSAN_CG, golongan(AKUN[k])), k).toBe("tidak");
    }
  });
});

describe("hak tiap peran atas folder BAS (cek 3, top 1|30, validator 10|20)", () => {
  it("panitera bebas; panitera pengganti dan panitera muda bila ditunjuk; hakim dan ketua hanya memvalidasi", () => {
    expect(tingkatHakGabungan(BAS_CG, golongan(AKUN.panitera))).toBe("bebas");
    expect(tingkatHakGabungan(BAS_CG, golongan(AKUN.pp))).toBe("ditunjuk");
    expect(tingkatHakGabungan(BAS_CG, golongan(AKUN.panmud))).toBe("ditunjuk");
    expect(tingkatHakGabungan(BAS_CG, golongan(AKUN.hakim))).toBe("validasi");
    expect(tingkatHakGabungan(BAS_CG, golongan(AKUN.ketua))).toBe("validasi");
    expect(tingkatHakGabungan(BAS_CG, golongan(AKUN.superadmin))).toBe("bebas");
    for (const k of ["js", "kasir", "ptsp", "analis", "staf", "admin"] as const) expect(tingkatHakGabungan(BAS_CG, golongan(AKUN[k])), k).toBe("tidak");
  });
  it("memvalidasi BUKAN membuka: periksaHakFolder menolak hakim atas isi folder BAS", () => {
    const h = periksaHakFolder(BAS_CG, golongan(AKUN.hakim));
    expect(h).toMatchObject({ boleh: false, tingkat: "validasi" });
  });
});

describe("hak atas relaas (cek 0, grup 600) dan cek 2", () => {
  it("hanya juru sita (dan Super Admin) membuka relaas", () => {
    expect(tingkatHakGabungan(RELAAS, golongan(AKUN.js))).toBe("bebas");
    for (const k of ["hakim", "panitera", "pp", "ptsp", "kasir"] as const) expect(tingkatHakGabungan(RELAAS, golongan(AKUN[k])), k).toBe("tidak");
  });
  it("cek 2: yang ditunjuk di perkara boleh walau perannya di luar daftar, kecuali golongan tanpa padanan ABT", () => {
    expect(tingkatHak(ATAU, "hakim")).toBe("bebas");
    expect(tingkatHak(ATAU, "pp")).toBe("ditunjuk");
    for (const g of GOLONGAN_TANPA_GRUP_ABT) expect(tingkatHak(ATAU, g), g).toBe("tidak");
  });
});

describe("putusan hak runtime", () => {
  it("folder tanpa baris menu: hanya Super Admin sampai ditetapkan; peran lain ditolak dengan alasan", () => {
    expect(periksaHakFolder(null, ["super-admin"])).toMatchObject({ boleh: true });
    for (const g of GOLONGAN_PERAN.filter((x) => x !== "super-admin")) expect(periksaHakFolder(null, [g]), g).toMatchObject({ boleh: false });
    expect(periksaHakFolder(null, ["hakim"]).alasan).toContain("hanya Super Admin");
  });
  it("ditunjuk: ya, tidak, belum diketahui", () => {
    expect(periksaHakFolder(PUTUSAN_CG, ["hakim"], { ditunjuk: true })).toMatchObject({ boleh: true, perluDitunjuk: true });
    expect(periksaHakFolder(PUTUSAN_CG, ["hakim"], { ditunjuk: false })).toMatchObject({ boleh: false, perluDitunjuk: true });
    expect(periksaHakFolder(PUTUSAN_CG, ["hakim"])).toMatchObject({ boleh: null, perluDitunjuk: true });
  });
  it("orang dengan dua golongan memperoleh yang tertinggi", () => {
    expect(tingkatHakGabungan(BAS_CG, ["hakim", "panitera"])).toBe("bebas");
  });
});

describe("tahapan dan jenis (peringatan bagi Super Admin)", () => {
  it("di dalam rentang: sesuai", () => {
    expect(periksaTahapan(BAS_CG, { prosesId: 200, jenisPerkaraId: 347, alurPerkaraId: 15 })).toEqual({ sesuai: true, alasan: "" });
  });
  it("proses di luar rentang atau jenis lain: tidak sesuai dengan alasan", () => {
    expect(periksaTahapan(BAS_CG, { prosesId: 50, jenisPerkaraId: 347 }).sesuai).toBe(false);
    const j = periksaTahapan(BAS_CG, { prosesId: 200, jenisPerkaraId: 346 });
    expect(j.sesuai).toBe(false);
    expect(j.alasan).toContain("cerai gugat");
  });
  it("acuan alur: relaas untuk alur 15-17, bukan alur lain", () => {
    expect(periksaTahapan(RELAAS, { prosesId: 100, alurPerkaraId: 16 }).sesuai).toBe(true);
    expect(periksaTahapan(RELAAS, { prosesId: 100, alurPerkaraId: 122 }).sesuai).toBe(false);
  });
  it("keadaan perkara belum diketahui: null, bukan tebakan", () => {
    expect(periksaTahapan(BAS_CG, { jenisPerkaraId: 347 }).sesuai).toBeNull();
    expect(periksaTahapan(BAS_CG, { prosesId: 200 }).sesuai).toBeNull();
  });
  it("label sehari-hari tanpa kata teknis", () => {
    expect(labelTahapan(BAS_CG)).toContain("penetapan hari sidang");
    expect(labelJenis(BAS_CG)).toBe("cerai gugat");
    expect(labelTahapan(baris({ direktori: "x", proses_id_min: "0", proses_id_max: "1000" }))).toBe("semua tahapan");
  });
});

describe("matriks", () => {
  const menu: BarisMenu[] = [PUTUSAN_CG, BAS_CG, RELAAS, baris({ direktori: "- BAS LAMA -", parent_direktori: "_arsip_derry_briantono", proses_id_min: "80", proses_id_max: "220", user_cek: "3", user_grup_id: "1|30", user_top_id: "1|30" })];
  const m = susunMatriks(menu, [{ folder: "1 Perceraian CG", arsip: false }, { folder: "Folder tanpa menu", arsip: false }]);

  it("memuat semua folder: yang punya menu, yang hanya ada di pustaka, dan arsip", () => {
    expect(m.jumlahFolder).toBe(5);
    expect(m.jumlahFolder).toBe(m.baris.length);
    expect(m.baris.map((b) => b.folder)).toContain("Folder tanpa menu");
  });
  it("folder tanpa baris menu ditandai ragu; folder arsip dan folder biasa tidak (arsip sudah diputuskan)", () => {
    const ragu = new Set(m.baris.filter((b) => b.ragu.length).map((b) => b.folder));
    expect(ragu.has("Folder tanpa menu")).toBe(true);
    expect(ragu.has("- BAS LAMA -")).toBe(false);
    expect(ragu.has("1 Perceraian CG")).toBe(false);
    expect(ragu.has("98 Relaas")).toBe(false);
    expect(m.jumlahRagu).toBe(1);
  });
  it("folder tanpa menu: hanya Super Admin yang diberi hak", () => {
    const b = m.baris.find((x) => x.folder === "Folder tanpa menu")!;
    expect(b.hak["super-admin"]).toBe("bebas");
    expect(GOLONGAN_PERAN.filter((g) => g !== "super-admin").every((g) => b.hak[g] === "tidak")).toBe(true);
  });
  it("folder arsip: hanya Super Admin, walau grupnya di ABT masih tertulis untuk peran lain", () => {
    const b = m.baris.find((x) => x.folder === "- BAS LAMA -")!;
    expect(b.arsip).toBe(true);
    expect(b.hak["super-admin"]).toBe("bebas");
    for (const g of GOLONGAN_PERAN.filter((x) => x !== "super-admin")) expect(b.hak[g], g).toBe("tidak");
  });
  it("folder arsip menurut pustaka (bendera arsip) juga disembunyikan walau baris menunya bukan di induk arsip", () => {
    const r = susunMatriks([PUTUSAN_CG], [{ folder: "1 Perceraian CG", arsip: true }]);
    expect(r.baris[0].arsip).toBe(true);
    expect(r.baris[0].hak.hakim).toBe("tidak");
    expect(r.baris[0].hak["super-admin"]).toBe("bebas");
  });
  it("peran tanpa padanan di ABT terdaftar apa adanya", () => {
    expect(m.tanpaPadananAbt).toEqual(expect.arrayContaining(["mediator", "petugas-sidang", "ti", "pelaksana"]));
    for (const g of m.tanpaPadananAbt) expect(Object.values(GRUP_KE_GOLONGAN).some((p) => p.golongan === g)).toBe(false);
  });
  it("sidik berubah bila hak berubah dan tetap bila sama", () => {
    const sama = susunMatriks([...menu].reverse(), [{ folder: "Folder tanpa menu", arsip: false }, { folder: "1 Perceraian CG", arsip: false }]);
    expect(sama.sidik).toBe(m.sidik);
    const ubah = susunMatriks([{ ...PUTUSAN_CG, grup: [1, 10] }, BAS_CG, RELAAS, menu[3]], [{ folder: "1 Perceraian CG", arsip: false }, { folder: "Folder tanpa menu", arsip: false }]);
    expect(ubah.sidik).not.toBe(m.sidik);
  });
  it("sidik teks stabil", () => {
    expect(sidikTeks("abc")).toBe(sidikTeks("abc"));
    expect(sidikTeks("abc")).not.toBe(sidikTeks("abd"));
  });
  it("Meja I = PTSP dan Meja II/III = Analis Perkara sudah diputuskan: dipakai tanpa tanda ragu", () => {
    const r = susunMatriks([baris({ direktori: "Folder meja", parent_direktori: "derry_briantono", user_cek: "0", user_grup_id: "1|1001|1002|1033", user_top_id: "1" })], []);
    expect(r.baris[0].ragu).toEqual([]);
    expect(r.baris[0].hak.ptsp).toBe("bebas");
    expect(r.baris[0].hak["analis-perkara"]).toBe("bebas");
  });
  it("padanan yang belum diputuskan (Staf Panitera Hukum, Koordinator Delegasi) tetap ditandai ragu", () => {
    const r = susunMatriks([baris({ direktori: "Folder lain", parent_direktori: "derry_briantono", user_cek: "0", user_grup_id: "1|431|650", user_top_id: "1" })], []);
    expect(r.baris[0].ragu.join(" ")).toContain("Staf Panitera Hukum");
  });
  it("mediator, petugas sidang, TI, pelaksana, dan Admin tanpa hak atas folder mana pun yang normal", () => {
    const r = susunMatriks([PUTUSAN_CG, BAS_CG, RELAAS, ATAU], []);
    for (const g of ["mediator", "petugas-sidang", "ti", "pelaksana"] as const) {
      for (const b of r.baris.filter((x) => x.folder !== "Contoh cek dua")) expect(b.hak[g], `${g} ${b.folder}`).toBe("tidak");
    }
    for (const b of r.baris) expect(b.hak.admin, `admin ${b.folder}`).toBe("tidak");
  });
});

describe("keputusan 6 Nov: folder mengikuti Blangko Derry, tiga folder tanpa baris menu ditetapkan pemilik", () => {
  const m = susunMatriks(
    [PUTUSAN_CG, RELAAS],
    [
      { folder: "4 Kebendaan", arsip: false },
      { folder: "PTSP", arsip: false },
      { folder: "Relaas", arsip: false },
      { folder: "98 Relaas", arsip: false },
      { folder: "12 Folder Baru", arsip: false },
    ]
  );
  const hak = (folder: string) => m.baris.find((b) => b.folder === folder)!.hak;
  const berhak = (folder: string) => GOLONGAN_PERAN.filter((g) => hak(folder)[g] !== "tidak");

  it("4 Kebendaan: hakim dan Ketua/Wakil bila ditunjuk, sama seperti folder putusan lain; Super Admin bebas", () => {
    expect(berhak("4 Kebendaan").sort()).toEqual(["hakim", "pimpinan", "super-admin"]);
    expect(hak("4 Kebendaan").hakim).toBe("ditunjuk");
    expect(hak("4 Kebendaan").pimpinan).toBe("ditunjuk");
    expect(hak("4 Kebendaan")["super-admin"]).toBe("bebas");
  });
  it("PTSP hanya untuk PTSP dan Relaas hanya untuk juru sita, tanpa perlu ditunjuk; Super Admin melihat semua", () => {
    expect(berhak("PTSP").sort()).toEqual(["ptsp", "super-admin"]);
    expect(hak("PTSP").ptsp).toBe("bebas");
    expect(berhak("Relaas").sort()).toEqual(["jurusita", "super-admin"]);
    expect(hak("Relaas").jurusita).toBe("bebas");
  });
  it("ketiganya tidak lagi ragu dan tetap tertulis sebagai folder tanpa baris menu", () => {
    for (const f of ["4 Kebendaan", "PTSP", "Relaas"]) {
      const b = m.baris.find((x) => x.folder === f)!;
      expect(b.ragu, f).toEqual([]);
      expect(b.adaMenu, f).toBe(false);
    }
  });
  it("folder baru yang belum ada di ABT ikut tampil, hanya untuk Super Admin, dan ditandai agar terlihat", () => {
    expect(berhak("12 Folder Baru")).toEqual(["super-admin"]);
    expect(m.baris.find((x) => x.folder === "12 Folder Baru")!.ragu.length).toBeGreaterThan(0);
  });
  it("bila ABT punya baris menunya, hak ABT yang dipakai, bukan tetapan", () => {
    const r = susunMatriks([baris({ direktori: "PTSP", parent_direktori: "derry_briantono", user_cek: "0", user_grup_id: "1|500", user_top_id: "1" })], [{ folder: "PTSP", arsip: false }]);
    expect(r.baris[0].adaMenu).toBe(true);
    expect(r.baris[0].hak.pp).toBe("bebas");
    expect(r.baris[0].hak.ptsp).toBe("tidak");
  });
  it("tetapan pada folder yang berbendera arsip tetap hanya Super Admin", () => {
    const r = susunMatriks([], [{ folder: "Relaas", arsip: true }]);
    expect(r.baris[0].hak.jurusita).toBe("tidak");
    expect(r.baris[0].hak["super-admin"]).toBe("bebas");
  });
  it("pemeriksaan saat dipakai memakai tetapan bila matriks berlaku, dan tidak memutuskan apa pun bila belum disetujui", () => {
    const berlaku = { berlaku: true, menu: [] as BarisMenu[], folder: [{ folder: "Relaas", arsip: false }] };
    expect(putusanHakFolder(berlaku, "Relaas", ["jurusita"])).toMatchObject({ boleh: true });
    expect(putusanHakFolder(berlaku, "Relaas", ["hakim"])).toMatchObject({ boleh: false });
    expect(putusanHakFolder(berlaku, "12 Folder Baru", ["jurusita"])).toMatchObject({ boleh: false });
    expect(putusanHakFolder(berlaku, "12 Folder Baru", ["super-admin"])).toMatchObject({ boleh: true });
    expect(putusanHakFolder({ ...berlaku, berlaku: false }, "Relaas", ["jurusita"])).toBeNull();
  });
  it("saat dipakai: nama tidak peka huruf besar, dan nama lain tidak ikut", () => {
    expect(periksaHakFolder(barisTetapanPemilik(" relaas "), ["jurusita"])).toMatchObject({ boleh: true });
    expect(periksaHakFolder(barisTetapanPemilik("Relaas"), ["hakim"])).toMatchObject({ boleh: false });
    expect(periksaHakFolder(barisTetapanPemilik("4 Kebendaan"), ["hakim"], { ditunjuk: true })).toMatchObject({ boleh: true, perluDitunjuk: true });
    expect(periksaHakFolder(barisTetapanPemilik("4 Kebendaan"), ["hakim"], { ditunjuk: false })).toMatchObject({ boleh: false });
    expect(barisTetapanPemilik("Relaas Lain")).toBeNull();
    expect(barisTetapanPemilik("constructor")).toBeNull();
  });
});

describe("berkas HTML untuk pemilik", () => {
  const m = susunMatriks([PUTUSAN_CG, baris({ direktori: "<script>alert(1)</script>", parent_direktori: "derry_briantono", user_cek: "0", user_grup_id: "20", user_top_id: "1" })], []);
  const html = matriksKeHtml(m, { sumber: "uji", dibuat: "2026-11-05 10.00" });
  it("memuat jumlah, sidik, cara membaca, dan menyebut belum berlaku", () => {
    expect(html).toContain("Belum berlaku");
    expect(html).toContain(m.sidik);
    expect(html).toContain('name="viewport"');
  });
  it("nama folder di-escape; tanpa skrip dan tanpa sumber luar", () => {
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toMatch(/<script|https?:\/\//i);
  });
  it("tanpa kata teknis yang dilarang untuk layar", () => {
    expect(html).not.toMatch(/renderer|md5|skrip/i);
  });
});

describe("ALETA tidak menyamar sebagai hak ABT baru", () => {
  it("setiap padanan merujuk golongan yang ada", () => {
    for (const p of Object.values(GRUP_KE_GOLONGAN)) expect((GOLONGAN_PERAN as readonly string[]).includes(p.golongan as GolonganPeran)).toBe(true);
  });
});
