// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

/**
 * ============================================================================
 * K12 - PENGAMAT TUNGGAL, KEJADIAN GANTI INTERVAL (rantai B, 25 Okt 2026)
 * ============================================================================
 *
 * pengamat-bersama.js dijalankan SUNGGUHAN di jsdom dengan MutationObserver yang dihitung.
 * Yang dijaga:
 *   - saklar mati = tiap pemanggil mendapat MutationObserver/setInterval asli (perilaku lama);
 *   - saklar menyala = SATU MutationObserver asli untuk banyak pelanggan, tiap pelanggan hanya
 *     menerima catatan miliknya, hasil sama dengan mode lama;
 *   - tab tersembunyi: catatan ditahan lalu dikirim sekali; pewaktu dilewati; tidak ditahan
 *     selama ada pekerjaan otomatis (sibuk);
 *   - saklar berubah di tab yang sedang terbuka memindahkan pelanggan di tempat;
 *   - satu tab per PC (latar.js putusPemimpin).
 */

const AKAR = path.resolve(process.cwd(), "../ekstensi-sipp");
const baca = (b: string) => readFileSync(path.join(AKAR, b), "utf8").replace(/\r\n/g, "\n");
const HUB = baca("pengamat-bersama.js");
const tunggu = (ms = 0) => new Promise((r) => setTimeout(r, ms));

const terbuka: JSDOM[] = [];
afterEach(() => {
  while (terbuka.length) terbuka.pop()!.window.close();
});

type Opsi = { saklar?: boolean; tersembunyi?: boolean; kirim?: (p: any) => any };

function buka(o: Opsi = {}) {
  const dom = new JSDOM(
    `<!doctype html><html><body><div id="a"></div><div id="b"></div><div id="aleta-panel"></div><p id="sipp"></p></body></html>`,
    { url: "http://192.168.10.10/SIPP/main", runScripts: "outside-only", pretendToBeVisual: true } as ConstructorParameters<typeof JSDOM>[1]
  );
  terbuka.push(dom);
  const w = dom.window as any;
  let nampak = !o.tersembunyi;
  Object.defineProperty(w.document, "visibilityState", { get: () => (nampak ? "visible" : "hidden"), configurable: true });
  const hitung = { asli: 0 };
  const AsliMO = w.MutationObserver;
  w.MutationObserver = class extends AsliMO {
    constructor(fn: any) {
      super(fn);
      hitung.asli += 1;
    }
  };
  const simpan: Record<string, unknown> = {};
  if (o.saklar) simpan.tampilanServer = { kinerja: { pengamatTunggal: true } };
  const pendengar: Array<(u: any, w: string) => void> = [];
  const pesan: any[] = [];
  w.chrome = {
    runtime: { sendMessage: async (p: any) => (pesan.push(p), o.kirim ? o.kirim(p) : { pemimpin: true }) },
    storage: {
      local: { get: async (k: string[]) => Object.fromEntries([k].flat().filter((n) => n in simpan).map((n) => [n, simpan[n]])) },
      onChanged: { addListener: (f: any) => pendengar.push(f) },
    },
  };
  const ctx = (dom as unknown as { getInternalVMContext(): vm.Context }).getInternalVMContext();
  vm.runInContext(HUB, ctx, { filename: "pengamat-bersama.js" });
  const P = w.ALETA_PENGAMAT;
  return {
    w,
    d: w.document as Document,
    P,
    hitung,
    pesan,
    tampak: (v: boolean) => {
      nampak = v;
      w.document.dispatchEvent(new w.Event("visibilitychange"));
    },
    ubahSaklar: (nyala: boolean) => {
      simpan.tampilanServer = { kinerja: nyala ? { pengamatTunggal: true } : {} };
      for (const f of pendengar) f({ tampilanServer: { newValue: simpan.tampilanServer } }, "local");
    },
  };
}
type H = ReturnType<typeof buka>;
const sampaiNyala = async (h: H, nyala = true) => {
  for (let i = 0; i < 100 && h.P.nyala() !== nyala; i++) await tunggu(5);
  expect(h.P.nyala()).toBe(nyala);
};
const tambah = (h: H, induk: string, id?: string) => {
  const e = h.d.createElement("span");
  if (id) e.id = id;
  h.d.querySelector(induk)!.appendChild(e);
  return e;
};

describe("saklar mati = perilaku lama persis", () => {
  it("tiap Pengamat memakai MutationObserver aslinya sendiri dan callback menerima catatan seperti biasa", async () => {
    const h = buka({ saklar: false });
    await tunggu(20);
    expect(h.P.nyala()).toBe(false);
    const diterima: string[][] = [[], []];
    const p1 = new h.P.Pengamat((c: any[]) => diterima[0].push(...c.map((x) => x.type)));
    const p2 = new h.P.Pengamat((c: any[]) => diterima[1].push(...c.map((x) => x.type)));
    p1.observe(h.d.body, { childList: true, subtree: true });
    p2.observe(h.d.body, { childList: true, subtree: true });
    expect(h.hitung.asli).toBe(2);
    tambah(h, "#a");
    await tunggu(20);
    expect(diterima).toEqual([["childList"], ["childList"]]);
  });

  it("interval lama: berdetak walau tab tersembunyi", async () => {
    const h = buka({ saklar: false, tersembunyi: true });
    let n = 0;
    h.P.interval(() => void n++, 15);
    await tunggu(300);
    expect(n).toBeGreaterThanOrEqual(2);
  });
});

describe("saklar menyala: satu pengamat untuk banyak pelanggan", () => {
  it("sepuluh pelanggan atas body = SATU MutationObserver asli, tiap pelanggan menerima catatannya", async () => {
    const h = buka({ saklar: true });
    await sampaiNyala(h);
    const terima = Array.from({ length: 10 }, () => 0);
    const daftar = terima.map((_, i) => {
      const p = new h.P.Pengamat(() => void terima[i]++);
      p.observe(h.d.body, { childList: true, subtree: true });
      return p;
    });
    expect(h.hitung.asli).toBe(1);
    expect(h.P.ukur()).toMatchObject({ pengamatAsli: 1, pelanggan: 10 });
    tambah(h, "#a");
    await tunggu(20);
    expect(terima).toEqual(Array.from({ length: 10 }, () => 1));
    daftar.forEach((p) => p.disconnect());
    expect(h.P.ukur().bersamaHidup).toBe(false);
  });

  it("tiap pelanggan hanya menerima catatan di targetnya (subtree, tanpa subtree, filter atribut)", async () => {
    const h = buka({ saklar: true });
    await sampaiNyala(h);
    const a: any[] = [];
    const b: any[] = [];
    const c: any[] = [];
    new h.P.Pengamat((r: any[]) => a.push(...r)).observe(h.d.getElementById("a"), { childList: true, subtree: true });
    new h.P.Pengamat((r: any[]) => b.push(...r)).observe(h.d.getElementById("b"), { childList: true });
    new h.P.Pengamat((r: any[]) => c.push(...r)).observe(h.d.body, { attributes: true, attributeFilter: ["data-x"], subtree: true });
    const dalam = tambah(h, "#a");
    await tunggu(10);
    tambah(h, "#b");
    dalam.appendChild(h.d.createElement("i"));
    h.d.getElementById("sipp")!.setAttribute("data-y", "1");
    h.d.getElementById("sipp")!.setAttribute("data-x", "1");
    await tunggu(20);
    expect(a.map((x) => x.type)).toEqual(["childList", "childList"]);
    expect(b.map((x) => x.type)).toEqual(["childList"]);
    expect(c.map((x) => [x.type, x.attributeName])).toEqual([["attributes", "data-x"]]);
    expect(h.hitung.asli).toBe(1);
  });

  it("hasil sama dengan mode lama untuk rangkaian perubahan yang sama (uji perbandingan)", async () => {
    async function jalankan(saklar: boolean) {
      const h = buka({ saklar });
      if (saklar) await sampaiNyala(h);
      else await tunggu(20);
      const catatan: string[] = [];
      new h.P.Pengamat((r: any[]) =>
        r.forEach((x) => catatan.push(`${x.type}:${x.target.id || x.target.tagName}:${x.addedNodes.length}/${x.removedNodes.length}`))
      ).observe(h.d.body, { childList: true, subtree: true });
      const e = tambah(h, "#a", "baru");
      await tunggu(10);
      e.remove();
      tambah(h, "#b");
      await tunggu(20);
      return catatan;
    }
    expect(await jalankan(true)).toEqual(await jalankan(false));
  });

  it("target di luar dokumen jatuh ke pengamat asli (tidak hilang)", async () => {
    const h = buka({ saklar: true });
    await sampaiNyala(h);
    const lepas = h.d.createElement("div");
    const terima: any[] = [];
    new h.P.Pengamat((r: any[]) => terima.push(...r)).observe(lepas, { childList: true });
    lepas.appendChild(h.d.createElement("b"));
    await tunggu(20);
    expect(terima).toHaveLength(1);
  });
});

describe("tab tersembunyi", () => {
  it("catatan ditahan lalu dikirim sekali begitu tab terlihat; sibuk meniadakan penahanan", async () => {
    const h = buka({ saklar: true, tersembunyi: true });
    await sampaiNyala(h);
    const terima: number[] = [];
    new h.P.Pengamat((r: any[]) => terima.push(r.length)).observe(h.d.body, { childList: true, subtree: true });
    tambah(h, "#a");
    tambah(h, "#b");
    await tunggu(20);
    expect(terima).toEqual([]);
    h.tampak(true);
    expect(terima).toEqual([2]);
    h.tampak(false);
    const lepas = h.P.sibuk("uji");
    tambah(h, "#a");
    await tunggu(20);
    expect(terima).toEqual([2, 1]);
    lepas();
  });

  it("setiap/interval dilewati selama tersembunyi dan dijalankan sekali saat terlihat; opsi tetap tidak dilewati", async () => {
    const h = buka({ saklar: true, tersembunyi: true });
    await sampaiNyala(h);
    let biasa = 0;
    let tetap = 0;
    h.P.interval(() => void biasa++, 10);
    h.P.interval(() => void tetap++, 10, { tetap: true });
    await tunggu(300);
    expect(biasa).toBe(0);
    expect(tetap).toBeGreaterThanOrEqual(2);
    expect(h.P.ukur().dilewati).toBeGreaterThanOrEqual(2);
    h.tampak(true);
    expect(biasa).toBe(1);
  });
});

describe("denyut: kejadian ganti interval", () => {
  it("dijalankan oleh perubahan DOM sipp, tidak oleh perubahan buatan ALETA, dan dihapus dengan hapus()", async () => {
    const h = buka({ saklar: true });
    await sampaiNyala(h);
    let n = 0;
    const id = h.P.denyut(() => void n++, 1000, { jedaMinMs: 20, cadanganMs: 5000 });
    expect(typeof id).toBe("number");
    await tunggu(30);
    tambah(h, "#aleta-panel");
    await tunggu(80);
    expect(n).toBe(0);
    tambah(h, "#sipp");
    await tunggu(80);
    expect(n).toBe(1);
    h.P.hapus(id);
    tambah(h, "#sipp");
    await tunggu(60);
    expect(n).toBe(1);
  });

  it("denyut cadangan tidak mati tanpa perubahan DOM (data yang tidak mengubah DOM tetap tersinkron)", async () => {
    const h = buka({ saklar: true });
    await sampaiNyala(h);
    let n = 0;
    h.P.denyut(() => void n++, 20, { cadanganMs: 30 });
    await tunggu(40);
    // cadangan = max(1500, 30) ms: belum berdetak dalam 40 ms, tetapi pelanggan tetap hidup
    expect(n).toBe(0);
    expect(h.P.ukur().langganan).toBe(1);
  });

  it("mode lama: denyut = setInterval biasa pada jeda semula", async () => {
    const h = buka({ saklar: false });
    await tunggu(20);
    let n = 0;
    h.P.denyut(() => void n++, 15);
    await tunggu(200);
    expect(n).toBeGreaterThanOrEqual(2);
  });
});

describe("saklar berubah di tab yang sedang terbuka", () => {
  it("lama -> tunggal -> lama: pelanggan dipindahkan di tempat dan tetap menerima", async () => {
    const h = buka({ saklar: false });
    await tunggu(20);
    const terima: number[] = [];
    new h.P.Pengamat((r: any[]) => terima.push(r.length)).observe(h.d.body, { childList: true, subtree: true });
    new h.P.Pengamat(() => undefined).observe(h.d.body, { childList: true, subtree: true });
    expect(h.hitung.asli).toBe(2);
    h.ubahSaklar(true);
    await sampaiNyala(h);
    tambah(h, "#a");
    await tunggu(20);
    expect(terima).toEqual([1]);
    expect(h.P.ukur().langganan).toBe(2);
    h.ubahSaklar(false);
    await sampaiNyala(h, false);
    tambah(h, "#b");
    await tunggu(20);
    expect(terima).toEqual([1, 1]);
    expect(h.P.ukur().langganan).toBe(0);
  });
});

describe("satu tab per PC", () => {
  const sumber = baca("latar.js");
  const potong = sumber.slice(sumber.indexOf("function putusPemimpin"), sumber.indexOf("let rantaiPemimpin"));
  const putus = new Function(`${potong}; return putusPemimpin;`)() as (c: any, m: any, s: number) => { pemimpin: boolean; catatan: any };

  it("tab pertama memimpin, tab kedua ditolak, tab yang sama memperpanjang", () => {
    const a = putus({}, { kunci: "k", ttlMs: 60000, terlihat: true, tab: 1 }, 1000);
    expect(a.pemimpin).toBe(true);
    const b = putus(a.catatan, { kunci: "k", ttlMs: 60000, terlihat: true, tab: 2 }, 2000);
    expect(b.pemimpin).toBe(false);
    const a2 = putus(b.catatan, { kunci: "k", ttlMs: 60000, terlihat: true, tab: 1 }, 30000);
    expect(a2.pemimpin).toBe(true);
    expect(a2.catatan.k.sampai).toBe(90000);
  });

  it("sewa habis -> tab lain mengambil alih; tab terlihat merebut dari tab tersembunyi; kunci berbeda saling bebas", () => {
    const a = putus({}, { kunci: "k", ttlMs: 10000, terlihat: false, tab: 1 }, 1000);
    expect(putus(a.catatan, { kunci: "k", ttlMs: 10000, terlihat: false, tab: 2 }, 2000).pemimpin).toBe(false);
    expect(putus(a.catatan, { kunci: "k", ttlMs: 10000, terlihat: true, tab: 3 }, 2000).pemimpin).toBe(true);
    expect(putus(a.catatan, { kunci: "k", ttlMs: 10000, terlihat: false, tab: 2 }, 20000).pemimpin).toBe(true);
    expect(putus(a.catatan, { kunci: "lain", ttlMs: 10000, terlihat: false, tab: 2 }, 2000).pemimpin).toBe(true);
  });

  it("hub: saklar mati -> selalu pemimpin tanpa bertanya; menyala -> bertanya ke pekerja latar; galat -> tetap bekerja", async () => {
    const mati = buka({ saklar: false });
    await tunggu(20);
    expect(await mati.P.pemimpin("k")).toBe(true);
    expect(mati.pesan).toEqual([]);
    const nyala = buka({ saklar: true, kirim: () => ({ pemimpin: false }) });
    await sampaiNyala(nyala);
    expect(await nyala.P.pemimpin("k", 5000)).toBe(false);
    expect(nyala.pesan[0]).toMatchObject({ sumber: "aleta-panel", jenis: "aleta-pemimpin", kunci: "k", ttlMs: 5000, terlihat: true });
    const rusak = buka({ saklar: true, kirim: () => Promise.reject(new Error("x")) });
    await sampaiNyala(rusak);
    expect(await rusak.P.pemimpin("k")).toBe(true);
  });
});

describe("terpasang di manifest dan pemanggil", () => {
  const manifest = JSON.parse(baca("manifest.json"));
  it("pengamat-bersama.js dimuat paling awal di tiga kelompok skrip konten (hanya pembungkus fetch portal-jalur.js yang boleh mendahului)", () => {
    const kelompok = manifest.content_scripts.filter((c: any) => c.js.includes("pengamat-bersama.js"));
    expect(kelompok).toHaveLength(3);
    // Gabung rantai 26 Okt: portal-jalur.js (F/K7) paling depan di SIPP dan ABT; ia tidak memakai pewaktu atau pengamat.
    for (const k of kelompok) expect(k.js[0] === "portal-jalur.js" ? k.js[1] : k.js[0]).toBe("pengamat-bersama.js");
  });

  it("pengamat badan halaman memakai Pengamat bersama dengan cadangan MutationObserver asli", () => {
    const berkas = [
      "konten.js",
      "mediasi-arsip.js",
      "menu-atas.js",
      "panduan-kasir.js",
      "penetapan-borang.js",
      "saksiscan.js",
      "sipp-ide-l1.js",
      "sipp-ide-l2.js",
      "sipp-ide-m1.js",
      "sipp-ide-m2.js",
      "panel-alat.js",
      "blangko-derry.js",
    ];
    let jumlah = 0;
    for (const b of berkas) {
      const s = baca(b);
      const n = (s.match(/globalThis\.ALETA_PENGAMAT \? globalThis\.ALETA_PENGAMAT\.Pengamat : MutationObserver/g) || []).length;
      expect(n, b).toBeGreaterThan(0);
      jumlah += n;
    }
    expect(jumlah).toBeGreaterThanOrEqual(14);
  });
});
