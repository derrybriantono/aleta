// @vitest-environment node
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

/**
 * ============================================================================
 * PANEL ALETA DI HALAMAN SIPP: 9 BUTIR + 3 TEMUAN (21 Okt 2026)
 * ============================================================================
 *
 * Dijaga di sini:
 *   1. hitungan beban majelis (Tahun ini = SEMUA perkara tahun berjalan yang susunan hakimnya sama
 *      dengan susunan SK, bukan hanya sejak SK berlaku) + penilaian urutan tetap sejak SK;
 *   2-4. rincian beban terlipat bawaan, ringkasan beban + perkara diterima 30 hari di samping judul,
 *      "Centang semua e-Doc" dan "Tetapkan & unggah e-Doc" di bagian Penetapan Otomatis (bukan di bawah detail);
 *   5. urutan dan gaya tiga tombol TETAP (tidak saling memindahkan, tidak berganti warna);
 *   6-8. (tempat unggah berkas Putusan Otomatis, terlipat bawaan, warna mengikuti tema: lihat juga
 *        ekstensi-putusan-sipp-tombol-20okt dan ekstensi-putusan-terjadwal-ui-21okt);
 *   9. hak peran tiap tombol; tombol massal hanya di dashboard dan daftar perkara;
 *   10. "</br>" mentah di antara nama hakim;
 *   11. petugas yang mutasi / tidak bertugas tidak diusulkan.
 *
 * ALETA_TANGKAP_SIPP23=<awalan> menyimpan HTML tiap keadaan untuk tangkapan layar Playwright
 * (docs/rancangan/sipp-tampilan-21okt/tangkap.mjs).
 */

const AKAR_REPO = path.resolve(process.cwd(), "..");
const AKAR = path.join(AKAR_REPO, "ekstensi-sipp");
const baca = (b: string) => readFileSync(path.join(AKAR, b), "utf8").replace(/\r\n/g, "\n");
const req = createRequire(import.meta.url);
const beban = req(path.join(AKAR_REPO, "aleta_bot/services/bebanPenetapanService.js")) as any;

const ALAT = baca("panel-alat.js");
const STAT = baca("penunjukan-statistik.js");
const PENSIPP = baca("penetapan-sipp.js");
const PUSIPP = baca("putusan-sipp.js");
const PTJ = baca("putusan-terjadwal.js");
const PASANGAN = baca("putusan-terjadwal-pasangan.js");
const KONTEN = baca("konten.js");
const CSS = baca("penetapan-sipp.css");

const tunggu = (ms = 0) => new Promise((r) => setTimeout(r, ms));
async function sampai<T>(periksa: () => T, keterangan: string | (() => string), batas = 6000): Promise<NonNullable<T>> {
  const mulai = Date.now();
  for (;;) {
    let hasil: T | undefined;
    try {
      hasil = periksa();
    } catch {
      hasil = undefined;
    }
    if (hasil) return hasil as NonNullable<T>;
    if (Date.now() - mulai > batas) throw new Error(`tidak tercapai: ${typeof keterangan === "function" ? keterangan() : keterangan}`);
    await tunggu(10);
  }
}

function blokCss(css: string, selektor: string): string {
  const bersih = css.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const m of bersih.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    if (m[1].split(",").some((x) => x.trim() === selektor)) return m[2];
  }
  return "";
}

// ============================================================================
// 1. HITUNGAN BEBAN MAJELIS
// ============================================================================
describe("butir 1: Tahun ini majelis = semua perkara tahun berjalan pada susunan SK", () => {
  const HAKIM = [
    { id: 26, kode: "C1", nama: "Himawan" },
    { id: 28, kode: "C2", nama: "Idris" },
    { id: 31, kode: "C3", nama: "Derry" },
    { id: 32, kode: "A", nama: "Fahri" },
    { id: 33, kode: "B", nama: "Sudarmin" },
  ];
  const SK = [
    { majelisKode: "A", hakimKode: ["A", "C1", "C3"] },
    { majelisKode: "B", hakimKode: ["B", "C2", "C3"] },
    { majelisKode: "C", hakimKode: ["C1", "C2", "C3"] },
  ];
  const SEKARANG = "2026-10-21";
  const SK_TANGGAL = "2026-08-27";
  const bobot = () => 1;
  const bukanKebendaan = () => false;

  /** Susunan: id hakim; sebelum = jumlah perkara sebelum SK berlaku, sesudah = sejak SK. */
  function bangun(susunan: Array<{ ids: number[]; sebelum: number; sesudah: number }>) {
    const baris: any[] = [];
    let nomor = 1000;
    for (const s of susunan) {
      for (let i = 0; i < s.sebelum + s.sesudah; i += 1) {
        const tanggal = i < s.sebelum ? `2026-0${1 + (i % 7)}-1${i % 9}` : `2026-09-${String(1 + (i % 20)).padStart(2, "0")}`;
        nomor += 1;
        for (const id of s.ids) baris.push({ perkaraId: nomor, orangId: id, tanggal, jenisId: 347, berjalan: false });
      }
    }
    return baris;
  }
  const hitung = (baris: any[]) =>
    beban.hitungStatistik({ sekarang: SEKARANG, baris: { hakim: baris, panitera: [], jurusita: [] }, orang: { hakim: HAKIM, panitera: [], jurusita: [] }, susunanSk: SK, skTanggal: SK_TANGGAL, bobot, kebendaan: bukanKebendaan });

  const DATA = [
    { ids: [26, 28, 31], sebelum: 20, sesudah: 10 }, // majelis C
    { ids: [33, 28, 31], sebelum: 8, sesudah: 4 }, // majelis B
    { ids: [32, 26, 31], sebelum: 6, sesudah: 0 }, // majelis A (urutan duduk berbeda dari SK)
    { ids: [31, 32, 33], sebelum: 5, sesudah: 1 }, // susunan di luar SK
    { ids: [32], sebelum: 3, sesudah: 1 }, // hakim tunggal
  ];

  it("Tahun ini menghitung juga perkara SEBELUM SK berlaku (dulu hanya sejak SK: tiga majelis 177 dari 561)", () => {
    const s = hitung(bangun(DATA));
    const m = (kode: string) => s.majelis.majelis.find((x: any) => x.kode === kode);
    expect(m("C").tahun).toBe(30);
    expect(m("B").tahun).toBe(12);
    expect(m("A").tahun).toBe(6);
    // Urutan duduk tidak menentukan majelis: {32,26,31} = {A, C1, C3} = Majelis A.
    expect(s.majelis.luarSk.perkara).toBe(6);
    expect(s.majelis.luarSk.tahun).toBe(6);
    expect(s.majelis.tunggal.tahun).toBe(4);
    // Seluruh perkara bermajelis = majelis SK + di luar SK: tidak ada yang hilang.
    const semuaMajelis = DATA.filter((d) => d.ids.length > 1).reduce((n, d) => n + d.sebelum + d.sesudah, 0);
    expect(m("C").tahun + m("B").tahun + m("A").tahun + s.majelis.luarSk.perkara).toBe(semuaMajelis);
  });

  it("kolom lain konsisten: 30 hari dan Berjalan memakai aturan yang sama (semua perkara pada susunan itu)", () => {
    const baris = bangun(DATA).map((b) => (b.perkaraId % 2 === 0 ? { ...b, berjalan: true } : b));
    const s = hitung(baris);
    const berjalan = (ids: number[]) => new Set(baris.filter((b) => b.berjalan && ids.includes(b.orangId)).map((b) => b.perkaraId)).size;
    const c = s.majelis.majelis.find((x: any) => x.kode === "C");
    const perkaraC = new Set(bangun([DATA[0]]).map((b) => b.perkaraId));
    expect(c.aktif).toBe(baris.filter((b) => b.berjalan && b.orangId === 26 && perkaraC.has(b.perkaraId)).length);
    // 30 hari terakhir (22 Sep - 21 Okt): hanya perkara bertanggal >= 2026-09-22, termasuk yang sebelum SK bila ada.
    expect(c.hari30).toBe(new Set(baris.filter((b) => b.orangId === 26 && perkaraC.has(b.perkaraId) && b.tanggal >= "2026-09-22").map((b) => b.perkaraId)).size);
    expect(berjalan([26, 28, 31])).toBeGreaterThan(0);
  });

  it("urutan usulan (skor) tetap dinilai SEJAK SK berlaku: perkara sebelum SK tidak mengubah nisbah majelis", () => {
    const penuh = hitung(bangun(DATA));
    const hanyaSesudah = hitung(bangun(DATA.map((d) => ({ ...d, sebelum: 0 }))));
    for (const kode of ["A", "B", "C"]) {
      const a = penuh.majelis.majelis.find((x: any) => x.kode === kode);
      const b = hanyaSesudah.majelis.majelis.find((x: any) => x.kode === kode);
      expect(a.nisbah, kode).toEqual(b.nisbah);
    }
  });

  it("angka hakim tidak berubah (tiap perkara bermajelis dihitung untuk tiap anggota)", () => {
    const s = hitung(bangun(DATA));
    const h = (kode: string) => s.hakim.orang.find((x: any) => x.kode === kode);
    expect(h("C3").tahun).toBe(30 + 12 + 6 + 6); // anggota semua majelis + luar SK
    expect(h("A").tahun).toBe(6 + 6 + 4); // A di susunan {A,C1,C3}, luar SK, dan tunggal
  });

  it("perkara diterima ikut di statistik; tidak terbaca = null (bukan nol yang menyesatkan)", () => {
    const dasar = { sekarang: SEKARANG, baris: { hakim: [], panitera: [], jurusita: [] }, orang: { hakim: HAKIM, panitera: [], jurusita: [] }, bobot, kebendaan: bukanKebendaan };
    expect(beban.hitungStatistik({ ...dasar, diterima: { tahun: 934, hari30: 99 } }).diterima).toEqual({ tahun: 934, hari30: 99 });
    expect(beban.hitungStatistik({ ...dasar, diterima: null }).diterima).toBeNull();
    expect(beban.hitungStatistik(dasar).diterima).toBeNull();
  });
});

describe("butir 11: petugas yang mutasi atau tidak bertugas tidak diusulkan", () => {
  const SEKARANG = "2026-10-21";
  const orang = [
    { id: 18, nama: "Munifa, S.H." },
    { id: 20, nama: "Qadariyah" },
    { id: 22, nama: "Sri Wahyuni" },
    { id: 23, nama: "Asrah Rachman" },
    { id: 29, nama: "Sitti Nurhidayah, S.H.I.", mulai: "2026-10-01" },
  ];
  const baris = [
    { orangId: 18, perkaraId: 1, tanggal: "2026-10-02" },
    { orangId: 20, perkaraId: 2, tanggal: "2026-10-20" },
    { orangId: 22, perkaraId: 3, tanggal: "2026-06-29" },
    { orangId: 23, perkaraId: 4, tanggal: "2026-04-28" },
  ];

  it("akun portal nonaktif (cocok menurut nama tanpa gelar) dan 60 hari tanpa penetapan disaring; yang baru bertugas tidak", () => {
    const hasil = beban.petugasTidakBertugas({ orang, baris, sekarang: SEKARANG, nonaktifNama: ["sri wahyuni"] });
    expect([...hasil.keys()].sort()).toEqual([22, 23]);
    expect(hasil.get(22)).toMatch(/mutasi/);
    expect(hasil.get(23)).toMatch(/60 hari/);
    expect(hasil.has(29)).toBe(false); // baru bertugas
    expect(hasil.has(18)).toBe(false); // Munifa masih menerima (2 Okt)
  });

  it("nama berbeda gelar tetap cocok; nama yang punya akun aktif lain tidak disaring (urusan portal)", () => {
    expect(beban.namaBersih("Sitti Nurhidayah, S.H.I., M.H")).toBe("sitti nurhidayah");
    expect(beban.namaBersih("Munifa, S.H.")).toBe(beban.namaBersih("Munifa"));
    const hasil = beban.petugasTidakBertugas({ orang, baris, sekarang: SEKARANG, nonaktifNama: ["munifa"] });
    expect(hasil.has(18)).toBe(true);
  });

  it("pengaman: data tak terbaca atau semua petugas tersaring = tidak ada yang disaring", () => {
    expect(beban.petugasTidakBertugas({ orang, baris: [], sekarang: SEKARANG }).size).toBe(0);
    const semua = beban.petugasTidakBertugas({ orang: [orang[2], orang[3]], baris, sekarang: SEKARANG, nonaktifNama: ["sri wahyuni", "asrah rachman"] });
    expect(semua.size).toBe(0);
  });

  it("bot memakai penyaring ini untuk panitera pengganti dan juru sita sebelum menghitung usulan dan tabel beban", () => {
    const sumber = readFileSync(path.join(AKAR_REPO, "aleta_bot/services/penunjukanService.js"), "utf8");
    expect(sumber).toContain("bebanService.petugasTidakBertugas");
    expect(sumber).toContain("pengaturan.petugasNonaktif");
    expect(readFileSync(path.join(AKAR_REPO, "aleta_bot/routes/internalGatewayRoutes.js"), "utf8")).toContain("petugasNonaktif");
    const portal = readFileSync(path.join(AKAR_REPO, "manajemen_surat/src/server/modules/aleta-ecourt/penunjukan-pengaturan.ts"), "utf8");
    expect(portal).toContain("export async function bacaPetugasNonaktif");
    expect(portal).toMatch(/petugasNonaktif,\n/);
    expect(readFileSync(path.join(AKAR_REPO, "manajemen_surat/src/app/api/aleta-bot/penunjukan/route.ts"), "utf8")).toContain("petugasNonaktif: pengaturan.petugasNonaktif");
  });
});

// ============================================================================
// 10. "</br>" MENTAH
// ============================================================================
describe("butir 10: pemisah </br> di antara nama hakim", () => {
  const ambilFungsi = () => {
    const m = /function bersihkanPemisahBr\(teks\) \{[\s\S]*?\n\}\n/.exec(KONTEN);
    expect(m).toBeTruthy();
    const ctx = vm.createContext({});
    vm.runInContext(`${m![0]}; globalThis.f = bersihkanPemisahBr;`, ctx);
    return (ctx as any).f as (t: unknown) => string;
  };

  it("diganti koma, aman dari HTML, tanpa koma ganda", () => {
    const f = ambilFungsi();
    expect(f("Fahri Saifuddin</br>Himawan Tatura Wijaya</br>Derry Briantono")).toBe("Fahri Saifuddin, Himawan Tatura Wijaya, Derry Briantono");
    expect(f("A<br>B<br/>C< / br >D")).toBe("A, B, C, D");
    expect(f("A</br></br>B")).toBe("A, B");
    expect(f("<b>Munifa</b></br>Qadariyah")).toBe("Munifa, Qadariyah");
    expect(f(null)).toBe("");
    expect(f(undefined)).toBe("");
    expect(f("Tanpa pemisah")).toBe("Tanpa pemisah");
  });

  it("baris Penetapan tercatat memakainya; Majelis tercatat di borang juga", () => {
    expect(KONTEN).toMatch(/: bersihkanPemisahBr\(p\[TERCATAT_PENETAPAN\[jenis\]\]\)/);
    expect(baca("penetapan-borang.js")).toContain("bersihkanPemisahBr(p.majelisNama)");
  });
});

// ============================================================================
// Halaman detil perkara tiruan dengan TIGA modul sungguhan
// ============================================================================
const terbuka: JSDOM[] = [];
afterEach(async () => {
  await tunggu(20);
  while (terbuka.length) terbuka.pop()!.window.close();
});

const NOMOR = "684/Pdt.G/2026/PA.Dgl";

function usulanContoh() {
  const orang = (id: number, kode: string, nama: string, o: Record<string, unknown> = {}) => ({
    id,
    kode,
    nama,
    aktif: 19,
    tahun: 132,
    hari30: 12,
    persen30: 12.1,
    rataRata30: 20,
    kebendaan6: 1,
    persenKebendaan6: 11.1,
    rataRataKebendaan6: 20,
    kebendaan6Total: 9,
    skor: 90,
    alasan: "x",
    diusulkan: false,
    urutan: 1,
    ...o,
  });
  return {
    ok: true,
    perkara: { perkaraId: 10260, nomorPerkara: NOMOR, jenisPerkaraId: 347, tanggalDaftar: "2026-10-20" },
    penetapan: { ada: false, pmh: "", ppp: "", pjs: "", phs: "" },
    pmh: { bentuk: "majelis", majelisKode: "C", anggota: [], hitungan: [] },
    ppp: { usulan: { id: 20, nama: "Qadariyah" }, calon: [] },
    pjs: { usulan: { id: 30, nama: "Mustini" }, calon: [] },
    phs: { usulan: "2026-11-02", calon: [] },
    kesesuaianSk: { status: "sesuai", untuk: "usulan", bunyi: "Sesuai SK 254/KPA.W19-A5/SK.HK2.6/VIII/2026 (Majelis C).", rinci: [] },
    statistik: {
      terbaca: true,
      jendela: { sekarang: "2026-10-21", dari30: "2026-09-22", dari6: "2026-04-21" },
      kebendaanPerkara: false,
      diterima: { tahun: 934, hari30: 99 },
      sk: { nomor: "254/KPA.W19-A5/SK.HK2.6/VIII/2026", tanggal: "2026-08-27", dipakai: true, bunyi: "SK 254/KPA.W19-A5/SK.HK2.6/VIII/2026 tanggal Kamis, 2026-08-27", peringatan: [] },
      majelis: [
        { ...orang(0, "", ""), kode: "C", anggotaKode: ["C1", "C2", "C3"], aktif: 63, tahun: 303, urutan: 1, diusulkan: true },
        { ...orang(0, "", ""), kode: "B", anggotaKode: ["B", "C2", "C3"], aktif: 36, tahun: 160, urutan: 2 },
        { ...orang(0, "", ""), kode: "A", anggotaKode: ["A", "C1", "C3"], aktif: 32, tahun: 98, urutan: 3 },
      ],
      luarSk: { perkara: 170, tahun: 170, hari30: 4 },
      tunggal: { tahun: 146 },
      hakim: [orang(31, "C3", "Derry", { aktif: 90, tahun: 767 })],
      panitera: [orang(20, "D", "Qadariyah", { diusulkan: true })],
      jurusita: [orang(30, "E2", "Mustini", { aktif: 40, tahun: 313, diusulkan: true })],
      totalKebendaan6: { hakim: 9, panitera: 9, jurusita: 9, majelis: 9 },
      rekomendasi: { majelis: { kode: "C", anggotaKode: ["C1"], skor: 70, alasan: "x" }, hakim: null, panitera: null, jurusita: null },
    },
  };
}

type Opsi = {
  peran?: string | null;
  peranTambahan?: string[];
  tanpaL1?: boolean;
  urutan?: "l1-dulu" | "l1-akhir";
  simpananAwal?: Record<string, unknown>;
  halaman?: "detil" | "dasbor" | "daftar";
};

const TABEL_DAFTAR =
  `<table id="daftar"><tr><th>No</th><th>Nomor Perkara</th><th>Tanggal Putus</th></tr>` +
  `<tr><td>1</td><td>12/Pdt.G/2026/PA.Dgl</td><td>19 Oktober 2026</td></tr>` +
  `<tr><td>2</td><td>13/Pdt.G/2026/PA.Dgl</td><td>19 Oktober 2026</td></tr>` +
  `<tr><td>3</td><td>14/Pdt.P/2026/PA.Dgl</td><td>20 Oktober 2026</td></tr></table>`;

function htmlHalaman(halaman: string) {
  if (halaman === "dasbor") {
    return (
      `<div class="wrapper"><div class="content-wrapper"><section class="content-header"><h1><small>DASHBOARD PERKARA PERTAMA</small> <small>[Statistik Perkara]</small></h1>` +
      `<ol class="breadcrumb"><li>Home</li><li class="active">Dashboard</li></ol></section>` +
      `<div class="konten"><section class="content"><div class="kotak-stat">Perkara masuk: 934 · Putus: 760 · Sisa: 174</div></section></div></div></div>`
    );
  }
  if (halaman === "daftar") {
    return (
      `<div id="pageTitle">DAFTAR PERKARA PERDATA GUGATAN</div><div id="right"><div class="total_perkara">Total : 934</div></div><br>` +
      `<hr class="thick-line"><div id="left"><input type="submit" value="Search Detil" id="search-btn1"></div>` +
      `<div id="left" style="margin-left:50px;"><input id="cetak_perkara_list" type="submit" value="Cetak" class="btn"><input type="submit" value="Cetak Register Mediasi" id="cetak_reg_mediasi" class="btn"></div>` +
      `<div id="pages">${TABEL_DAFTAR}</div>`
    );
  }
  return (
    `<table width="100%" id="submenus"><tr><td><table><tr>` +
    `<td id="backlist"><a class="btn btn-default btn-sm" href="/index.php/perkara">Kembali</a></td>` +
    `<td><a class="btn btn-default btn-sm" href="#">Penetapan Majelis Hakim</a></td>` +
    `</tr></table></td></tr></table>`
  );
}

function buka(o: Opsi = {}) {
  const halaman = o.halaman || "detil";
  const dom = new JSDOM(
    `<!doctype html><html><head><title>SIPP</title></head><body><div id="konten">${htmlHalaman(halaman)}</div></body></html>`,
    { url: "http://192.168.10.10/SIPP/detil_perkara_agama", runScripts: "outside-only", pretendToBeVisual: true } as ConstructorParameters<typeof JSDOM>[1]
  );
  terbuka.push(dom);
  const w = dom.window as any;
  const simpanan: Record<string, unknown> = { ujiTampilan: "ui", ujiIzinkanNyata: true, ...(o.simpananAwal || {}) };
  w.chrome = {
    runtime: { id: "uji", getManifest: () => ({ version: "1.205.22" }), getURL: (x: string) => x, sendMessage: async () => ({}) },
    storage: {
      local: {
        get: async (k?: string | string[]) => {
          const hasil: Record<string, unknown> = {};
          for (const n of [k].flat()) if (n != null && n in simpanan) hasil[n as string] = JSON.parse(JSON.stringify(simpanan[n as string]));
          return hasil;
        },
        set: async (isi: Record<string, unknown>) => void Object.assign(simpanan, JSON.parse(JSON.stringify(isi))),
        remove: async () => undefined,
      },
      session: { get: async () => ({}), set: async () => undefined },
      onChanged: { addListener: () => undefined },
    },
  };
  w.fetch = async () => {
    const r: any = { ok: false, status: 404, json: async () => ({}), text: async () => "", headers: { get: () => "" }, clone: () => r };
    return r;
  };
  const ctx = (dom as unknown as { getInternalVMContext(): vm.Context }).getInternalVMContext();
  vm.runInContext(ALAT, ctx, { filename: "panel-alat.js" });
  vm.runInContext("alatSetelJedaSkala(0)", ctx);
  const peran = o.peran === undefined ? "Super Admin" : o.peran;
  const usulan = usulanContoh();
  Object.assign(w, {
    penggunaTerakhir: peran === null ? null : { nama: "Derry Briantono", peran, ...(o.peranTambahan ? { peranTambahan: o.peranTambahan } : {}) },
    boleh: () => true,
    cariNomorPerkara: () => NOMOR,
    ambilUsulanPenunjukan: async () => ({ usulan, rencana: null, caraPapan: "otomatis", bolehOtomatis: true }),
    keadaanPenetapanUsulan: () => ({ pmh: "", ppp: "", pjs: "", phs: "" }),
    langkahSisaPenetapan: () => ["pmh", "ppp", "pjs", "phs"],
    gambarPenunjukan: (r: HTMLElement) => {
      for (const [label, isi] of [["Penetapan Majelis Hakim", "Majelis C"], ["Penunjukan Panitera Pengganti", "Qadariyah"], ["Penunjukan Juru Sita", "Mustini"], ["Penetapan Hari Sidang", "Senin, 02 November 2026"]]) {
        const b = w.document.createElement("div");
        b.className = "aleta-tetap";
        b.innerHTML = `<span class="aleta-tetap-label">${label}</span><span class="aleta-tetap-nilai"><span class="aleta-tetap-isi">${isi}</span></span>`;
        r.appendChild(b);
      }
    },
    b6KeadaanPutusanTerisi: async () => ({ terisi: false }),
    a30PerkaraIdUntukAbt: async () => "10260",
    alatAmbil: async (alamat: string, opsi: any) => {
      const jawab = (data: unknown) => ({ ok: true, status: 200, json: async () => ({ ok: true, data }) });
      const metode = String((opsi && opsi.method) || "GET").toUpperCase();
      if (alamat.includes("/putusan-terjadwal/berkas") && metode === "POST") {
        const f = opsi.body.get("berkas") as { name: string; size: number };
        return jawab({ ok: true, berkas: { id: `b-${f.name}`, nama: f.name, bentuk: /\.docx$/i.test(f.name) ? "docx" : /\.pdf$/i.test(f.name) ? "pdf" : "rtf", ukuran: f.size, nomorIsi: "", peringatan: [] } });
      }
      if (alamat.includes("/putusan-terjadwal/pratinjau")) {
        const b = JSON.parse(opsi.body);
        const mulai = new Date(`${String(b.mulai).replace(" ", "T")}:00Z`).getTime();
        return jawab({ ok: true, benih: 7, tidakMuat: 0, peringatan: [], butir: Array.from({ length: b.jumlah }, (_, i) => { const t = new Date(mulai + i * 4 * 60_000).toISOString(); return { urut: i + 1, iso: t, wita: `${t.slice(0, 10)} ${t.slice(11, 16)}` }; }) });
      }
      if (alamat.includes("/ringkasan-form")) return jawab({ ok: true, statusTersedia: ["Dikabulkan", "Ditolak"], ringkasan: {} });
      if (alamat.includes("/putusan-terjadwal")) return jawab({ ok: true, jadwal: [], ringkasan: {}, pengaturan: {} });
      if (alamat.includes("/unggah-massal")) return jawab({ ok: true, putusan: [], tertahan: [] });
      return { ok: false, status: 404, json: async () => ({}) };
    },
    t7AmbilJson: async () => ({ ok: false }),
    namaPenggunaSipp: () => "Derry Briantono",
    alatSidangPadaTanggal: async (tgl: string) => [
      { nomor: "12/Pdt.G/2026/PA.Dgl", perkaraId: "9012", jenis: "Cerai Gugat", agenda: "Putusan", sudahPutus: false, jam: "09:00", tanggalSidang: tgl, majelis: "Majelis C" },
      { nomor: "13/Pdt.G/2026/PA.Dgl", perkaraId: "9013", jenis: "Cerai Talak", agenda: "Putusan", sudahPutus: false, jam: "10:00", tanggalSidang: tgl, majelis: "Majelis B" },
      { nomor: "14/Pdt.P/2026/PA.Dgl", perkaraId: "9014", jenis: "Itsbat Nikah", agenda: "Pembuktian", sudahPutus: false, jam: "11:00", tanggalSidang: tgl, majelis: "Majelis C" },
    ],
    barisPerkaraDiHalaman: () => Array.from(w.document.querySelectorAll("#daftar tr")).slice(1).map((tr: any) => ({ nomor: tr.cells[1].textContent, baris: tr })),
    aletaPutusanEdoc: { cekSlot: async () => ({ ok: true, adaBaris: true, adaPutusan: false, adaAnonim: false }), ambilKunci: async () => ({ ok: true, lepas: async () => undefined }), jalankan: async () => ({ ok: true, langkah: [] }) },
  });
  vm.runInContext(STAT, ctx, { filename: "penunjukan-statistik.js" });
  vm.runInContext(PASANGAN, ctx, { filename: "putusan-terjadwal-pasangan.js" });
  const baris = (halaman === "detil" ? w.document.querySelector("#submenus td#backlist").parentElement : w.document.body) as HTMLElement;
  const pasangL1 = () => {
    const l1 = w.document.createElement("td");
    l1.className = "aleta-sisip aleta-l1 aleta-l1-submenu";
    l1.innerHTML = '<a href="#">Buka di ABT</a> <a href="#">Buka di ALETA</a>';
    baris.appendChild(l1);
  };
  if (halaman === "detil" && !o.tanpaL1 && o.urutan !== "l1-akhir") pasangL1();
  vm.runInContext(PENSIPP, ctx, { filename: "penetapan-sipp.js" });
  vm.runInContext(PUSIPP, ctx, { filename: "putusan-sipp.js" });
  vm.runInContext(PTJ, ctx, { filename: "putusan-terjadwal.js" });
  if (halaman === "detil" && !o.tanpaL1 && o.urutan === "l1-akhir") pasangL1();
  return { w, d: w.document as Document, baris, simpanan, usulan };
}
type Halaman = ReturnType<typeof buka>;

const pasangSemua = (h: Halaman) => {
  h.w.aletaPenetapanSipp.pasang(h.d);
  h.w.aletaPutusanSipp.pasang(h.d);
  h.w.aletaPutusanTerjadwal.pasang(h.d);
};
const urutan = (h: Halaman) =>
  Array.from(h.baris.children)
    .map((x) => (x.classList.contains("aleta-pensipp-sel") ? "pen" : x.classList.contains("aleta-pusipp-sel") ? "put" : x.classList.contains("aleta-ptj-sel") ? "ptj" : x.classList.contains("aleta-l1-submenu") ? "l1" : "lain"))
    .filter((x) => x !== "lain");

function simpanTangkapan(h: Halaman, nama: string) {
  const awalan = process.env.ALETA_TANGKAP_SIPP23;
  if (!awalan) return;
  h.d.querySelectorAll("input[type=checkbox]").forEach((c) => {
    if ((c as HTMLInputElement).checked) c.setAttribute("checked", "");
    else c.removeAttribute("checked");
  });
  h.d.querySelectorAll("details").forEach((x) => (x.open ? x.setAttribute("open", "") : x.removeAttribute("open")));
  h.d.querySelectorAll("input").forEach((i) => i.setAttribute("value", (i as HTMLInputElement).value));
  h.d.querySelectorAll("select").forEach((x) => Array.from((x as HTMLSelectElement).options).forEach((o) => (o.selected ? o.setAttribute("selected", "") : o.removeAttribute("selected"))));
  writeFileSync(`${awalan}-${nama}.html`, h.d.getElementById("konten")!.innerHTML, "utf8");
}

// ============================================================================
// 9 (hak) dan 5 (tombol tetap)
// ============================================================================
describe("hak peran tiap tombol (permintaan tegas pengguna)", () => {
  const TIGA = ["pen", "put", "ptj"];
  const KASUS: Array<[string | null, string[], string[]?]> = [
    ["Super Admin", TIGA],
    ["Admin", TIGA], // golongan admin = pola matriks yang sama dengan Super Admin
    ["Ketua", TIGA],
    ["Wakil Ketua", TIGA],
    ["Hakim", ["put", "ptj"]],
    ["Petugas PTSP", ["pen"]],
    ["Operator", ["pen"]],
    ["Analis Perkara", []],
    ["Panitera Pengganti", []],
    ["Panitera", []],
    ["Panitera Muda", []],
    ["Juru Sita", []],
    ["Kasir", []],
    [null, []],
  ];
  for (const [peran, harap, tambahan] of KASUS) {
    it(`${peran ?? "peran belum terbaca"}: tombol ${harap.length ? harap.join(" + ") : "tidak ada"}`, async () => {
      const h = buka({ peran, peranTambahan: tambahan });
      await sampai(() => typeof h.w.alatUjiMode === "function" && h.w.alatUjiMode() !== "lama", "mode tampilan");
      for (let i = 0; i < 3; i += 1) {
        pasangSemua(h);
        await tunggu(10);
      }
      expect(urutan(h).filter((x) => x !== "l1")).toEqual(harap.length ? TIGA.filter((x) => harap.includes(x)) : []);
      // Panel ikut hilang: peran yang tidak berhak tidak melihat panelnya sama sekali.
      expect(!!h.d.getElementById("aleta-pensipp-panel")).toBe(harap.includes("pen"));
      expect(!!h.d.getElementById("aleta-pusipp-panel")).toBe(harap.includes("put"));
      expect(!!h.d.getElementById("aleta-ptj-panel")).toBe(harap.includes("ptj"));
    });
  }

  it("sub-peran Petugas Meja (peran tambahan) menjalankan penetapan walau jabatannya analis", async () => {
    const h = buka({ peran: "Analis Perkara", peranTambahan: ["petugas_meja_2"] });
    await sampai(() => typeof h.w.alatUjiMode === "function" && h.w.alatUjiMode() !== "lama", "mode tampilan");
    pasangSemua(h);
    await sampai(() => (pasangSemua(h), urutan(h).includes("pen")), "tombol penetapan");
    expect(urutan(h)).toEqual(["pen", "l1"]);
  });
});

describe("butir 5: tiga tombol berurutan TETAP, tidak melompat, tidak berganti warna", () => {
  for (const susunan of ["l1-dulu", "l1-akhir"] as const) {
    it(`urutan Penetapan, Putusan, Jadwalkan, Buka di ABT/ALETA tidak berubah tiap detak (${susunan})`, async () => {
      const h = buka({ urutan: susunan });
      await sampai(() => (pasangSemua(h), urutan(h).length === 4), "keempat sel hadir");
      expect(urutan(h)).toEqual(["pen", "put", "ptj", "l1"]);
      const gerak: string[] = [];
      const pengamat = new h.w.MutationObserver((daftar: MutationRecord[]) => {
        for (const m of daftar) if (m.type === "childList" && (m.addedNodes.length || m.removedNodes.length)) gerak.push("pindah");
      });
      pengamat.observe(h.baris, { childList: true });
      for (let i = 0; i < 12; i += 1) {
        pasangSemua(h);
        await tunggu(8);
      }
      await tunggu(30);
      expect(gerak).toEqual([]);
      expect(urutan(h)).toEqual(["pen", "put", "ptj", "l1"]);
    });
  }

  it("mengklik dan membuka tiap tombol tidak memindahkan tombol mana pun", async () => {
    const h = buka();
    await sampai(() => (pasangSemua(h), urutan(h).length === 4), "keempat sel hadir");
    const tombol = ["pensipp", "pusipp", "ptj"].map((k) => h.d.querySelector(`.aleta-${k}-tombol`) as HTMLButtonElement);
    const sebelum = urutan(h).join();
    for (const t of [...tombol, ...tombol, ...tombol.slice().reverse()]) {
      t.click();
      pasangSemua(h);
      await tunggu(12);
      expect(urutan(h).join()).toBe(sebelum);
    }
  });

  it("gaya SERAGAM: satu aturan untuk ketiganya; keadaan terbuka hanya menambah garis tipis (tanpa ganti warna isi/tepi/ukuran)", () => {
    const dasar = blokCss(CSS, ".aleta-pensipp-tombol");
    expect(blokCss(CSS, ".aleta-pusipp-tombol")).toBe(dasar);
    expect(blokCss(CSS, ".aleta-ptj-tombol")).toBe(dasar);
    const aktif = blokCss(CSS, '.aleta-pensipp-tombol[aria-expanded="true"]');
    expect(aktif).toBe(blokCss(CSS, '.aleta-pusipp-tombol[aria-expanded="true"]'));
    expect(aktif).toBe(blokCss(CSS, '.aleta-ptj-tombol[aria-expanded="true"]'));
    // Hanya box-shadow yang berubah: tidak ada background, border, padding, atau --ps-t-latar.
    expect(aktif).toMatch(/box-shadow/);
    expect(aktif).not.toMatch(/background|border|padding|font|--ps-t-latar/);
    // Satu warna merek (hijau), bukan biru/ungu/hijau yang berbeda-beda.
    expect(dasar).toMatch(/--ps-t-latar:\s*#0f5f4f/);
    const gelap = blokCss(CSS, 'html[data-aleta-tema-sipp="gelap"] .aleta-ptj-tombol');
    expect(gelap).toBe(blokCss(CSS, 'html[data-aleta-tema-sipp="gelap"] .aleta-pusipp-tombol'));
    expect(gelap).toBe(blokCss(CSS, 'html[data-aleta-tema-sipp="gelap"] .aleta-pensipp-tombol'));
    for (const f of ["putusan-sipp.css", "putusan-terjadwal.css"]) expect(baca(f), f).not.toMatch(/#1f4e8c|#173b6b|#8db8f0|#4b2f8f|#3a2370|#c9b5f5|#b49be8/i);
  });
});

// ============================================================================
// 2, 3, 4, 7, 8: terlipat bawaan, ringkasan, tata letak panel penetapan
// ============================================================================
describe("panel Penetapan Otomatis: ringkasan beban, rincian terlipat, aksi di bagian penetapan", () => {
  async function panelPen() {
    const h = buka();
    await sampai(() => (pasangSemua(h), h.d.getElementById("aleta-pensipp-panel")), "panel penetapan");
    await sampai(() => h.d.querySelector("[data-bebanstat]"), "blok beban");
    return h;
  }

  it("rincian beban TERLIPAT bawaan: hanya ringkasan satu-dua baris, tabel muncul saat Rincian diklik", async () => {
    const h = await panelPen();
    const kotak = h.d.querySelector("[data-bebanstat]") as HTMLDetailsElement;
    expect(kotak.open).toBe(false);
    const ring = kotak.querySelector("summary")!;
    expect(ring.querySelector("[data-bebanstat-tanda]")!.textContent).toBe("Rincian");
    expect(ring.textContent).toContain("Beban penetapan");
    expect(ring.textContent).toContain("Beban usulan: Majelis C 63 berjalan · PP Qadariyah 19 berjalan · JS Mustini 40 berjalan");
    expect(ring.textContent).toContain("99 perkara diterima 30 hari terakhir (934 tahun ini)");
    // Ringkasan paling banyak dua baris (atas: judul+SK+Rincian; bawah: beban+diterima).
    expect(ring.children).toHaveLength(2);
    // Tabel rinci ada di DOM tetapi tertutup oleh <details>.
    expect(kotak.querySelectorAll("table").length).toBeGreaterThan(0);
    kotak.open = true;
    expect(kotak.open).toBe(true);
    simpanTangkapan(h, "detil-penetapan");
  });

  it("ringkasan di samping judul: beban usulan + total perkara diterima 30 hari terakhir", async () => {
    const h = await panelPen();
    const r = h.d.querySelector('[data-pensipp="beban-ringkas"]') as HTMLElement;
    await sampai(() => !r.hidden, "ringkasan tampil");
    expect(r.textContent).toContain("Beban usulan: Majelis C 63 berjalan");
    expect(r.textContent).toContain("99 perkara diterima 30 hari terakhir");
    // Berada di blok judul (kepala panel), bukan di bagian detail.
    expect(r.closest(".aleta-pensipp-kepala")).toBeTruthy();
    expect(r.closest("[data-bebanstat]")).toBeNull();
  });

  it("'Centang semua e-Doc' dan 'Tetapkan & unggah e-Doc' ada di bagian penetapan (sesudah daftar PMH-PHS), SEBELUM detail beban dan pilihan lain", async () => {
    const h = await panelPen();
    const panel = h.d.getElementById("aleta-pensipp-panel")!;
    const daftar = panel.querySelector(".aleta-pensipp-daftar")!;
    const semua = panel.querySelector('[data-pensipp="semua"]')!;
    const utama = panel.querySelector('[data-pensipp="utama"]')!;
    const tambahan = panel.querySelector(".aleta-pensipp-tambahan")!;
    const lebihAwal = (a: Node, b: Node) => Boolean(a.compareDocumentPosition(b) & 4);
    expect(lebihAwal(daftar, semua)).toBe(true);
    expect(lebihAwal(semua, tambahan)).toBe(true);
    expect(lebihAwal(utama, tambahan)).toBe(true);
    expect(tambahan.contains(semua)).toBe(false);
    expect(tambahan.contains(utama)).toBe(false);
    expect(tambahan.querySelector("[data-bebanstat]")).toBeTruthy();
    expect(tambahan.querySelector(".aleta-pensipp-rinci-kotak")).toBeTruthy();
    expect(semua.closest("[data-bebanstat]")).toBeNull();
  });

  it("Putusan Otomatis dan Jadwalkan Putusan: panel TERLIPAT bawaan, belum membaca apa pun; Penetapan tetap terbentang", async () => {
    const h = buka();
    await sampai(() => (pasangSemua(h), h.d.getElementById("aleta-pensipp-panel")), "panel penetapan");
    expect(h.d.getElementById("aleta-pensipp-panel")!.hidden).toBe(false);
    for (const [id, tombol] of [["aleta-pusipp-panel", "aleta-pusipp-tombol"], ["aleta-ptj-panel", "aleta-ptj-tombol"]]) {
      const p = h.d.getElementById(id)!;
      expect(p, id).toBeTruthy();
      expect(p.hidden, id).toBe(true);
      expect((h.d.querySelector(`.${tombol}`) as HTMLElement).getAttribute("aria-expanded"), id).toBe("false");
    }
    expect(h.w.aletaPutusanSipp.keadaan().dibaca).toBe(false);
  });

  it("palet panel sama di tema terang dan gelap untuk ketiga panel (tanpa biru/ungu tetap)", () => {
    for (const sel of [".aleta-pensipp-panel", ".aleta-pusipp-panel", ".aleta-ptj-panel", ".aleta-ptj-massal", ".aleta-ptj-spanduk"]) {
      expect(blokCss(CSS, sel), sel).toContain("--ps-merek: #0f5f4f");
      expect(blokCss(CSS, `html[data-aleta-tema-sipp="gelap"] ${sel}`), sel).toContain("--ps-merek: #7fd0a6");
    }
    expect(baca("putusan-sipp.css")).toContain("--pu-merek: var(--ps-merek)");
    expect(baca("putusan-terjadwal.css")).toContain("--pt-merek: var(--ps-merek)");
  });
});

// ============================================================================
// Tangkapan layar (hanya bila ALETA_TANGKAP_SIPP23 diisi)
// ============================================================================
describe.skipIf(!process.env.ALETA_TANGKAP_SIPP23)("tangkapan layar tampilan baru", () => {
  const tekan = async (h: Halaman, sel: string) => {
    (h.d.querySelector(sel) as HTMLElement).click();
    await tunggu(30);
  };
  const berkas = (h: Halaman, nama: string) => new h.w.File([new Uint8Array(30 * 1024)], nama);
  async function seretKe(h: Halaman, zonaSel: string, nama: string[]) {
    const zona = h.d.querySelector(zonaSel) as HTMLElement;
    const evt = new h.w.Event("drop", { bubbles: true, cancelable: true }) as any;
    evt.dataTransfer = { files: nama.map((n) => berkas(h, n)) };
    zona.dispatchEvent(evt);
    await tunggu(400);
  }

  it("halaman detil perkara: tiga tombol berurutan, Penetapan terbentang, Putusan dan Jadwalkan terlipat", async () => {
    const h = buka();
    await sampai(() => (pasangSemua(h), h.d.querySelector("[data-bebanstat]")), "panel");
    await tunggu(60);
    simpanTangkapan(h, "1-detil-awal");
    (h.d.querySelector("[data-bebanstat] summary") as HTMLElement).click();
    (h.d.querySelector("[data-bebanstat]") as HTMLDetailsElement).open = true;
    simpanTangkapan(h, "2-detil-rincian");
    (h.d.querySelector("[data-bebanstat]") as HTMLDetailsElement).open = false;
    await tekan(h, ".aleta-pusipp-tombol");
    await sampai(() => h.w.aletaPutusanSipp.keadaan().dibaca, "putusan dibaca");
    await seretKe(h, '[data-pusipp="zona"]', ["684_Pdt.G_2026_PA.Dgl putusan.docx"]);
    pasangSemua(h);
    simpanTangkapan(h, "3-detil-putusan");
    await tekan(h, ".aleta-pusipp-tombol");
    await tekan(h, ".aleta-ptj-tombol");
    await seretKe(h, '[data-ptj="zona"]', ["684_Pdt.G_2026_PA.Dgl putusan.rtf"]);
    simpanTangkapan(h, "4-detil-jadwal");
  });

  it("dashboard: tombol di samping judul, panel massal terlipat lalu terbuka", async () => {
    const h = buka({ halaman: "dasbor" });
    await sampai(() => (pasangSemua(h), h.d.querySelector("#aleta-ptj-massal")), "tombol massal");
    simpanTangkapan(h, "5-dashboard-awal");
    await tekan(h, "#aleta-ptj-tombol");
    await tekan(h, '[data-ptj="muat-tanggal"]');
    await sampai(() => h.w.aletaPutusanTerjadwal.keadaan().kandidat.length >= 3, "kandidat");
    await seretKe(h, '[data-ptj="zona"]', ["12_Pdt.G_2026_PA.Dgl putusan.rtf", "13_Pdt.G_2026_PA.Dgl putusan.docx", "14_Pdt.P_2026_PA.Dgl putusan.pdf"]);
    await tunggu(500);
    simpanTangkapan(h, "6-dashboard-massal");
  });

  it("daftar perkara perdata gugatan: tombol di samping Cetak, panel massal terbuka", async () => {
    const h = buka({ halaman: "daftar" });
    await sampai(() => (pasangSemua(h), h.d.querySelector("#aleta-ptj-massal")), "tombol massal");
    simpanTangkapan(h, "7-daftar-awal");
    await tekan(h, "#aleta-ptj-tombol");
    await tekan(h, '[data-ptj="dari-halaman"]');
    await seretKe(h, '[data-ptj="zona"]', ["12_Pdt.G_2026_PA.Dgl putusan.rtf", "13_Pdt.G_2026_PA.Dgl putusan.docx"]);
    await tunggu(500);
    simpanTangkapan(h, "8-daftar-massal");
  });
});
