// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

/**
 * ============================================================================
 * K15 - ANTREAN KERJA PERAMBAN KE BASIS DATA, SISI EKSTENSI (rantai B, 25 Okt 2026)
 * ============================================================================
 *
 *   antrean-server.js    mati bawaan (tanpa satu permintaan pun); menyala: tulisan digabung per antrean dan yang terakhir
 *                        menang, akhiri membatalkan tulisan tertunda, gagal-aman, tertinggal() hanya membaca;
 *   putusan terjadwal    catatan pengerjaan disalin saat disimpan dan ditutup saat dihapus; catatan dari server hanya
 *                        dipulihkan bila sudah >= 10 menit tidak berubah, dan lewat alur catatan lokal yang sama;
 *   relaas massal        (latar.js) bentuk muatan salinan dan pemeriksaan ulang bentuk pemulihan.
 */

const AKAR = path.resolve(process.cwd(), "../ekstensi-sipp");
const baca = (b: string) => readFileSync(path.join(AKAR, b), "utf8").replace(/\r\n/g, "\n");
const ANTREAN = baca("antrean-server.js");
const ALAT = baca("panel-alat.js");
const HUB = baca("pengamat-bersama.js");
const PERAMBAN = baca("putusan-terjadwal-peramban.js");
const LATAR = baca("latar.js");
const tunggu = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const NOMOR = "684/Pdt.G/2026/PA.Dgl";

async function sampai<T>(periksa: () => T, ket: string, batas = 6000): Promise<NonNullable<T>> {
  const mulai = Date.now();
  for (;;) {
    let h: T | undefined;
    try {
      h = periksa();
    } catch {
      h = undefined;
    }
    if (h) return h as NonNullable<T>;
    if (Date.now() - mulai > batas) throw new Error(`tidak tercapai: ${ket}`);
    await tunggu(10);
  }
}

const terbuka: JSDOM[] = [];
afterEach(async () => {
  await tunggu(30);
  while (terbuka.length) terbuka.pop()!.window.close();
});

type Panggilan = { metode: string; alamat: string; badan: any };
type Opsi = {
  saklar?: boolean;
  jalur?: string;
  simpanan?: Record<string, unknown>;
  tertinggal?: any[];
  ambilGalat?: boolean;
  tanpaAlatAmbil?: boolean;
  denganPeramban?: boolean;
};

function buka(o: Opsi = {}) {
  const dom = new JSDOM(`<!doctype html><html><head><title>SIPP</title></head><body><div id="konten"><p>Dashboard</p></div></body></html>`, {
    url: `http://192.168.10.10${o.jalur ?? "/SIPP/main"}`,
    runScripts: "outside-only",
    pretendToBeVisual: true,
  } as ConstructorParameters<typeof JSDOM>[1]);
  terbuka.push(dom);
  const w = dom.window as any;
  const simpanan: Record<string, unknown> = { ujiTampilan: "ui", ujiIzinkanNyata: true, ...(o.simpanan ?? {}) };
  if (o.saklar) simpanan.tampilanServer = { kinerja: { antreanDiServer: true } };
  w.chrome = {
    runtime: { id: "uji", getManifest: () => ({ version: "1.205.39" }), getURL: (x: string) => x, sendMessage: async () => ({ pemimpin: true }) },
    storage: {
      local: {
        get: async (k?: string | string[]) => {
          const hasil: Record<string, unknown> = {};
          for (const n of [k].flat()) if (n != null && n in simpanan) hasil[n as string] = JSON.parse(JSON.stringify(simpanan[n as string]));
          return hasil;
        },
        set: async (isi: Record<string, unknown>) => void Object.assign(simpanan, JSON.parse(JSON.stringify(isi))),
        remove: async (k: string | string[]) => void [k].flat().forEach((n) => delete simpanan[n]),
      },
      session: { get: async () => ({}), set: async () => undefined },
      onChanged: { addListener: () => undefined },
    },
  };
  w.fetch = async () => ({ ok: false, status: 404, json: async () => ({}), text: async () => "" });
  const panggilan: Panggilan[] = [];
  const antrean: Panggilan[] = [];
  const lapor: any[] = [];
  const lepasan: any[] = [];
  const jawab = (data: unknown, status = 200) => ({ ok: status < 400, status, json: async () => ({ ok: status < 400, data }) });
  const ambil = async (alamat: string, opsi: any) => {
    const metode = String((opsi && opsi.method) || "GET").toUpperCase();
    let badan: any = null;
    try {
      badan = opsi && opsi.body ? JSON.parse(opsi.body) : null;
    } catch {
      badan = null;
    }
    const p = { metode, alamat, badan };
    panggilan.push(p);
    if (o.ambilGalat) throw new Error("jaringan putus");
    if (alamat.includes("/ekstensi/antrean")) {
      antrean.push(p);
      if (metode === "GET") return jawab({ aktif: true, antrean: o.tertinggal ?? [] });
      if (metode === "PUT") return jawab({ disimpan: true });
      return jawab({ diakhiri: true });
    }
    if (metode === "GET") return jawab({ ada: false, alasan: "tidak_ada" });
    if (badan && badan.aksi === "lapor") {
      lapor.push(badan);
      return jawab({ ok: true, status: "menunggu", edocSesudah: "" });
    }
    if (badan && badan.aksi === "lepas") {
      lepasan.push(badan);
      return jawab({ ok: true });
    }
    return jawab({ ok: true });
  };
  const ctx = (dom as unknown as { getInternalVMContext(): vm.Context }).getInternalVMContext();
  if (o.denganPeramban) {
    vm.runInContext(HUB, ctx, { filename: "pengamat-bersama.js" });
    vm.runInContext(ALAT, ctx, { filename: "panel-alat.js" });
    vm.runInContext("alatSetelJedaSkala(0)", ctx);
  }
  if (!o.tanpaAlatAmbil) w.alatAmbil = ambil;
  else w.fetch = async (alamat: string, opsi: any) => ambil(alamat, opsi);
  Object.assign(w, {
    penggunaTerakhir: { nama: "Hakim Satu", peran: "Hakim" },
    boleh: () => true,
    cariNomorPerkara: () => "",
    namaPenggunaSipp: () => "Hakim Satu, S.H.",
    b6KeadaanPutusanTerisi: async () => ({ terisi: true, tanggal: "2026-10-24" }),
  });
  if (o.denganPeramban) w.alatAmbil = ambil;
  vm.runInContext(ANTREAN, ctx, { filename: "antrean-server.js" });
  if (o.denganPeramban) vm.runInContext(PERAMBAN, ctx, { filename: "putusan-terjadwal-peramban.js" });
  return { w, simpanan, panggilan, antrean, lapor, lepasan, A: w.ALETA_ANTREAN_SERVER, mod: () => w.aletaPutusanTerjadwalPeramban };
}
type H = ReturnType<typeof buka>;

describe("antrean-server.js", () => {
  it("saklar mati (bawaan): tidak ada satu permintaan pun, tertinggal kosong", async () => {
    const h = buka({ saklar: false });
    await h.A.tungguSiap();
    expect(h.A.aktif()).toBe(false);
    expect(await h.A.catat("cetak-massal", "k", { total: 1 }, { segera: true })).toBe(false);
    expect(await h.A.akhiri("cetak-massal", "k", "selesai")).toBe(false);
    expect(await h.A.tertinggal("cetak-massal")).toEqual([]);
    expect(h.panggilan).toEqual([]);
  });

  it("menyala: tulisan segera dikirim ke rute antrean dengan id perangkat yang menetap; jenis tak dikenal diabaikan", async () => {
    const h = buka({ saklar: true });
    await h.A.tungguSiap();
    expect(h.A.aktif()).toBe(true);
    const id = h.A.idPerangkat();
    expect(id).toMatch(/^pc/);
    expect(h.simpanan.idPerangkatAntrean).toBe(id);
    expect(await h.A.catat("cetak-massal", "bas|2026-10-25", { ringkas: "r", selesai: 1, total: 2, muatan: { butir: [] } }, { segera: true })).toBe(true);
    expect(h.antrean).toHaveLength(1);
    expect(h.antrean[0]).toMatchObject({ metode: "PUT", alamat: "/aleta/api/aleta-ecourt/ekstensi/antrean" });
    expect(h.antrean[0].badan).toMatchObject({ jenis: "cetak-massal", kunci: "bas|2026-10-25", perangkat: id, ringkas: "r", selesai: 1, total: 2, status: "jalan" });
    expect(await h.A.catat("jenis-ngawur", "k", {}, { segera: true })).toBe(false);
    expect(h.antrean).toHaveLength(1);
  });

  it("dua catatan berurutan untuk antrean yang sama digabung: satu PUT berisi yang TERAKHIR, kedua janji selesai", async () => {
    const h = buka({ saklar: true });
    await h.A.tungguSiap();
    const pertama = h.A.catat("cetak-massal", "k", { selesai: 1, total: 3 });
    const kedua = h.A.catat("cetak-massal", "k", { selesai: 2, total: 3 }, { segera: true });
    expect(await kedua).toBe(true);
    expect(await pertama).toBe(true);
    expect(h.antrean).toHaveLength(1);
    expect(h.antrean[0].badan.selesai).toBe(2);
  });

  it("akhiri membatalkan tulisan yang masih menunggu dan mengirim POST selesai/dibuang", async () => {
    const h = buka({ saklar: true });
    await h.A.tungguSiap();
    const janji = h.A.catat("relaas-massal", "relaas-1", { selesai: 1, total: 2 });
    expect(await h.A.akhiri("relaas-massal", "relaas-1", "dibuang")).toBe(true);
    expect(await janji).toBe(false);
    expect(h.antrean.map((a) => [a.metode, a.badan.status])).toEqual([["POST", "dibuang"]]);
    await h.A.akhiri("relaas-massal", "relaas-2");
    expect(h.antrean[1].badan.status).toBe("selesai");
  });

  it("tertinggal hanya membaca; jenis dikirim sebagai kueri; jaringan putus = [] tanpa melempar", async () => {
    const h = buka({ saklar: true, tertinggal: [{ jenis: "cetak-massal", kunci: "k", muatan: {} }] });
    expect(await h.A.tertinggal("cetak-massal")).toHaveLength(1);
    expect(h.antrean[0]).toMatchObject({ metode: "GET", alamat: "/aleta/api/aleta-ecourt/ekstensi/antrean?jenis=cetak-massal" });
    const rusak = buka({ saklar: true, ambilGalat: true });
    expect(await rusak.A.tertinggal()).toEqual([]);
    expect(await rusak.A.catat("cetak-massal", "k", {}, { segera: true })).toBe(false);
    expect(await rusak.A.akhiri("cetak-massal", "k")).toBe(false);
  });

  it("tanpa alatAmbil (halaman tanpa panel) memakai fetch biasa", async () => {
    const h = buka({ saklar: true, tanpaAlatAmbil: true });
    await h.A.tungguSiap();
    expect(await h.A.catat("cetak-massal", "k", { total: 1 }, { segera: true })).toBe(true);
    expect(h.antrean).toHaveLength(1);
  });
});

describe("putusan terjadwal: catatan pengerjaan disalin dan dipulihkan", () => {
  const stale = (menit: number, ubah: Record<string, unknown> = {}) => ({
    id: "ptb-9",
    nomorPerkara: NOMOR,
    perkaraId: "30684",
    pilihan: {},
    akunSipp: "hakim.satu",
    mulai: Date.now() - (menit + 1) * 60000,
    tahap: "menyimpan",
    pemegang: "h-lain",
    pada: Date.now() - menit * 60000,
    ...ubah,
  });

  it("catatan lokal yang terputus: disalin saat direbut lalu ditutup 'selesai' begitu dihapus (alur lama tetap: lapor + dihapus)", async () => {
    const h = buka({ saklar: true, denganPeramban: true, simpanan: { putusanTerjadwalAktif: stale(3) } });
    await h.A.tungguSiap();
    for (let i = 0; i < 100 && typeof h.w.alatUjiMode !== "function"; i++) await tunggu(10);
    await h.mod().lanjutkanCatatan();
    const put = h.antrean.filter((a) => a.metode === "PUT");
    expect(put.length).toBeGreaterThanOrEqual(1);
    expect(put[0].badan).toMatchObject({ jenis: "putusan-terjadwal-catatan", kunci: "ptb-9", status: "jalan" });
    expect(put[0].badan.muatan.catatan).toMatchObject({ id: "ptb-9", nomorPerkara: NOMOR, tahap: "menyimpan" });
    await sampai(() => h.antrean.some((a) => a.metode === "POST"), "salinan ditutup");
    expect(h.antrean.filter((a) => a.metode === "POST")[0].badan).toEqual({ jenis: "putusan-terjadwal-catatan", kunci: "ptb-9", status: "selesai" });
    expect(h.lapor.map((l) => [l.id, l.hasil])).toEqual([["ptb-9", "selesai"]]);
    expect(h.simpanan.putusanTerjadwalAktif).toBeUndefined();
  });

  it("saklar mati: tidak ada permintaan antrean sama sekali, alur lama sama", async () => {
    const h = buka({ saklar: false, denganPeramban: true, simpanan: { putusanTerjadwalAktif: stale(3) } });
    await h.A.tungguSiap();
    for (let i = 0; i < 100 && typeof h.w.alatUjiMode !== "function"; i++) await tunggu(10);
    await h.mod().lanjutkanCatatan();
    expect(h.antrean).toEqual([]);
    expect(h.lapor.map((l) => l.hasil)).toEqual(["selesai"]);
  });

  it("tanpa catatan lokal, catatan server yang sudah basi (>= 10 menit) dipulihkan lewat alur catatan terputus", async () => {
    const lama = new Date(Date.now() - 30 * 60000).toISOString();
    const h = buka({
      saklar: true,
      denganPeramban: true,
      tertinggal: [{ jenis: "putusan-terjadwal-catatan", kunci: "ptb-9", diubahPada: lama, muatan: { catatan: stale(30, { tahap: "jalan", pemegang: "h-pc-lain" }) } }],
    });
    await h.A.tungguSiap();
    for (let i = 0; i < 100 && typeof h.w.alatUjiMode !== "function"; i++) await tunggu(10);
    const r = await h.mod().lanjutkanCatatan();
    expect(r).toBe(false);
    // "jalan" yang terputus: dikembalikan ke antrean portal (dihitung), tidak diulang diam-diam, lalu salinan ditutup.
    expect(h.lepasan.map((l) => [l.id, l.hitung])).toEqual([["ptb-9", true]]);
    await sampai(() => h.antrean.some((a) => a.metode === "POST"), "salinan ditutup");
    expect(h.simpanan.putusanTerjadwalAktif).toBeUndefined();
  });

  it("catatan server yang baru berubah (< 10 menit, mungkin PC lain sedang mengerjakannya) TIDAK diambil alih", async () => {
    const baru = new Date(Date.now() - 2 * 60000).toISOString();
    const h = buka({
      saklar: true,
      denganPeramban: true,
      tertinggal: [{ jenis: "putusan-terjadwal-catatan", kunci: "ptb-9", diubahPada: baru, muatan: { catatan: stale(2, { tahap: "jalan" }) } }],
    });
    await h.A.tungguSiap();
    for (let i = 0; i < 100 && typeof h.w.alatUjiMode !== "function"; i++) await tunggu(10);
    expect(await h.mod().lanjutkanCatatan()).toBe(false);
    expect(h.lepasan).toEqual([]);
    expect(h.simpanan.putusanTerjadwalAktif).toBeUndefined();
    expect(h.antrean.filter((a) => a.metode !== "GET")).toEqual([]);
  });

  it("catatan lokal ada: catatan server tidak dibaca sama sekali (lokal menang)", async () => {
    const h = buka({
      saklar: true,
      denganPeramban: true,
      simpanan: { putusanTerjadwalAktif: stale(0, { pemegang: "h-lain", tahap: "menuju", pada: Date.now() }) },
      tertinggal: [{ jenis: "putusan-terjadwal-catatan", kunci: "lain", diubahPada: new Date(0).toISOString(), muatan: { catatan: stale(60) } }],
    });
    await h.A.tungguSiap();
    for (let i = 0; i < 100 && typeof h.w.alatUjiMode !== "function"; i++) await tunggu(10);
    await h.mod().lanjutkanCatatan();
    expect(h.antrean.filter((a) => a.metode === "GET")).toEqual([]);
  });
});

describe("relaas massal (latar.js): salinan dan pemulihan", () => {
  const ambilFungsi = (nama: string) => {
    const awal = LATAR.indexOf(`function ${nama}(`);
    expect(awal).toBeGreaterThan(0);
    return LATAR.slice(awal, LATAR.indexOf("\n}\n", awal) + 3);
  };
  const relaasAsalPortal = ambilFungsi("relaasAsalPortal");
  const relaasDasarAbt = LATAR.slice(LATAR.indexOf("function relaasDasarAbt("), LATAR.indexOf("\n}\n", LATAR.indexOf("function relaasDasarAbt(")) + 3);
  const muatan = new Function(`${ambilFungsi("relaasMuatanCermin")}; return relaasMuatanCermin;`)() as (p: any) => any;
  const pulihkan = new Function(
    `const RELAAS_GOLONGAN = ["sidang-pertama", "sidang-ditunda", "sidang-lanjutan", "ikrar-talak", "pemberitahuan-putusan", "pengumuman-itsbat"]; ${relaasAsalPortal}; ${relaasDasarAbt}; ${ambilFungsi("relaasPulihkanBentuk")}; return relaasPulihkanBentuk;`
  )() as (p: any) => any;

  const butir = (k: string, ubah: Record<string, unknown> = {}) => ({ kunci: k, perkaraId: "30684", nomorPerkara: NOMOR, golongan: "sidang-pertama", label: "L", d: 1, berkas: "[JS] 1. Relaas", nama: "n", keadaan: "menunggu", percobaan: 0, ...ubah });
  const putaran = (ubah: Record<string, unknown> = {}) => ({
    id: "relaas-abc123-x1",
    tanggal: "2026-10-25",
    asal: "http://192.168.10.10",
    asalAbt: "http://192.168.10.10/aps_badilag",
    butir: [butir("a", { keadaan: "selesai" }), butir("b")],
    selesai: false,
    dihentikan: false,
    ...ubah,
  });

  it("muatan salinan: hitung selesai, status jalan untuk putaran berjalan; selesai ditutup; dihentikan petugas dibuang (tidak ditawarkan lagi)", () => {
    expect(muatan(putaran())).toMatchObject({ status: "jalan", selesai: 1, total: 2, ringkas: "Relaas massal 2026-10-25: 1 dari 2" });
    expect(muatan(putaran({ selesai: true }))).toMatchObject({ status: "selesai" });
    expect(muatan(putaran({ selesai: true, dihentikan: true }))).toMatchObject({ status: "dibuang" });
    expect(muatan(putaran()).muatan.pekerjaan.id).toBe("relaas-abc123-x1");
  });

  it("pemulihan: menjadi putaran TERTAHAN (tidak jalan sendiri), alamat dan butir diperiksa ulang", () => {
    const h = pulihkan(putaran());
    expect(h.pekerjaan.tertahan.sebab).toMatch(/Dipulihkan dari server/);
    expect(h.pekerjaan.selesai).toBe(false);
    expect(h.pekerjaan.butir).toHaveLength(2);
    for (const buruk of [
      null,
      putaran({ id: "bukan-relaas" }),
      putaran({ butir: [] }),
      putaran({ asalAbt: "http://asing.example/aps_badilag" }),
      putaran({ asal: "javascript:1" }),
      putaran({ butir: [butir("a", { perkaraId: "abc" })] }),
      putaran({ butir: [butir("a", { golongan: "ngawur" })] }),
      putaran({ butir: [butir("a", { berkas: "" })] }),
    ]) {
      expect(pulihkan(buruk).sebab, JSON.stringify(buruk)?.slice(0, 80)).toBeTruthy();
    }
  });
});
