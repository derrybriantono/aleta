/**
 * Tahap 5 sisi ekstensi (1.173.0): tampilan yang DITERAPKAN admin lewat
 * portal (GET /aleta/api/aleta-ecourt/ekstensi/tampilan, migrasi 0052), dan
 * sinkron tanda Selesai/Tunda ke setelan pribadi di server.
 *
 * Aturan yang dijaga:
 *   - uji lokal Super Admin menang, dan mode coba ikut;
 *   - tampilan yang diterapkan admin berlaku TANPA mode coba - pegawai yang
 *     diberi tampilan baru tetap dapat menyimpan;
 *   - tanpa penerapan (atau belum masuk portal): Lama, persis sebelumnya;
 *   - penggabungan tanda tiga arah tidak menghidupkan lagi butir yang
 *     dikembalikan di salah satu PC.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

const AKAR = path.resolve(__dirname, "../../../ekstensi-sipp");
const baca = (b: string) => readFileSync(path.join(AKAR, b), "utf8").replace(/\r\n/g, "\n");
const sumberAlat = baca("panel-alat.js");
const latar = baca("latar.js");
const popupHtml = baca("popup.html");
const popupJs = baca("popup.js");
const daftarFiturJs = baca("daftar-fitur.js");

function elemenTiruan(tag: string): any {
  const atribut = new Map<string, string>();
  return {
    tagName: String(tag).toUpperCase(),
    dataset: {},
    style: { setProperty() {} },
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    setAttribute: (n: string, v: string) => atribut.set(n, String(v)),
    removeAttribute: (n: string) => atribut.delete(n),
    getAttribute: (n: string) => (atribut.has(n) ? atribut.get(n) : null),
    hasAttribute: (n: string) => atribut.has(n),
    appendChild: (x: any) => x,
    querySelector: () => null,
    addEventListener() {},
  };
}

type Jawab = (alamat: string, opsi?: any) => Promise<any>;

function jalankan(awal: Record<string, unknown>, jawab?: Jawab) {
  const simpanan: Record<string, unknown> = JSON.parse(JSON.stringify(awal));
  const diminta: Array<{ alamat: string; cara: string }> = [];
  const akar = elemenTiruan("html");
  const k: any = {
    console,
    Date,
    JSON,
    Math,
    Number,
    String,
    Boolean,
    Array,
    Object,
    Promise,
    Error,
    Map,
    Set,
    RegExp,
    setTimeout,
    clearTimeout,
    document: { documentElement: akar, createElement: (t: string) => elemenTiruan(t), querySelector: () => null, addEventListener() {} },
    window: {
      location: { hostname: "192.168.10.10", pathname: "/SIPP/x", search: "" },
      sessionStorage: { getItem: () => null, setItem() {} },
      addEventListener() {},
      postMessage() {},
    },
    chrome: {
      runtime: { getManifest: () => ({ version: "1.173.0" }) },
      storage: {
        onChanged: { addListener() {} },
        local: {
          get: async (kunci: string[]) => {
            const h: Record<string, unknown> = {};
            for (const x of kunci) if (x in simpanan) h[x] = JSON.parse(JSON.stringify(simpanan[x]));
            return h;
          },
          set: async (isi: Record<string, unknown>) => void Object.assign(simpanan, JSON.parse(JSON.stringify(isi))),
        },
      },
    },
    fetch: async (alamat: string, opsi?: { method?: string }) => {
      diminta.push({ alamat: String(alamat), cara: String(opsi?.method || "GET").toUpperCase() });
      if (jawab) return jawab(String(alamat), opsi);
      return { ok: true, status: 200, json: async () => ({ ok: true }) };
    },
    navigator: {},
    Response: class {
      body: string;
      status: number;
      ok: boolean;
      constructor(body: string, init: any) {
        this.body = body;
        this.status = init?.status ?? 200;
        this.ok = this.status >= 200 && this.status < 300;
      }
      async json() {
        return JSON.parse(this.body);
      }
    },
    AbortController: class {
      signal = {};
      abort() {}
    },
  };
  k.globalThis = k;
  vm.createContext(k);
  vm.runInContext(sumberAlat, k, { filename: "panel-alat.js" });
  return { k, akar, simpanan, diminta };
}

const DITERAPKAN_UI = { mode: "ui", fitur: { "sipp-5": true }, diterapkan: true, versi: "v1", diambil: Date.now() };
const TULIS = "http://192.168.10.10/aleta/api/aleta-bot/penunjukan/tulis";

describe("tampilan yang diterapkan admin", () => {
  it("tanpa penerapan: Lama, persis sebelumnya", async () => {
    const { k, akar } = jalankan({});
    await k.alatMuatUji();
    expect(k.alatUjiMode()).toBe("lama");
    expect(akar.hasAttribute("data-aleta-kulit")).toBe(false);
  });

  it("diterapkan UI Baru: kulit Modern dan saklarnya berlaku, TANPA mode coba", async () => {
    const { k, akar } = jalankan({ tampilanServer: DITERAPKAN_UI });
    await k.alatMuatUji();
    expect(k.alatUjiMode()).toBe("ui");
    expect(k.alatFiturNyala("sipp-5")).toBe(true);
    expect(k.alatFiturNyala("sipp-6")).toBe(false);
    expect(k.alatCobaAktif()).toBe(false);
    expect(akar.getAttribute("data-aleta-kulit")).toBe("modern");
    expect(akar.hasAttribute("data-aleta-coba")).toBe(false);
    expect((await k.fetch(TULIS, { method: "POST" })).status).toBe(200);
  });

  it("singgahan yang tidak diterapkan (bawaan server) tidak mengubah apa pun", async () => {
    const { k } = jalankan({ tampilanServer: { ...DITERAPKAN_UI, diterapkan: false } });
    await k.alatMuatUji();
    expect(k.alatUjiMode()).toBe("lama");
  });

  it("uji lokal Super Admin menang atas penerapan, dan mode coba ikut", async () => {
    const { k } = jalankan({ tampilanServer: DITERAPKAN_UI, ujiTampilan: "baru", ujiFitur: {} });
    await k.alatMuatUji();
    expect(k.alatUjiMode()).toBe("baru");
    expect(k.alatFiturNyala("sipp-5")).toBe(false);
    expect(k.alatCobaAktif()).toBe(true);
  });

  it("singgahan rusak atau berkode asing dibersihkan", async () => {
    const { k } = jalankan({ tampilanServer: { mode: "<x>", fitur: { "sipp-5": true, "jahat;": true }, diterapkan: true } });
    await k.alatMuatUji();
    expect(k.alatUjiMode()).toBe("lama");
    const b = vm.runInContext("alatBersihTampilanServer({ mode: 'ui', fitur: { 'sipp-5': true, 'x y': true, 'abt-3': 1 }, diterapkan: true })", k);
    expect(b.fitur).toEqual({ "sipp-5": true });
  });
});

describe("membaca dari portal", () => {
  const jawabTampilan = (data: any) => async () => ({ ok: true, status: 200, json: async () => ({ ok: true, data }) });

  it("jawaban portal disinggahkan dan langsung berlaku", async () => {
    const h = jalankan({}, jawabTampilan({ tampilan: { mode: "baru", fitur: { "popup-7": true }, diterapkan: true }, versi: "abc" }));
    await h.k.alatMuatUji();
    await h.k.alatSegarkanTampilanServer(true);
    expect(h.diminta.at(-1)).toEqual({ alamat: "/aleta/api/aleta-ecourt/ekstensi/tampilan", cara: "GET" });
    expect((h.simpanan.tampilanServer as any).versi).toBe("abc");
    expect(h.k.alatUjiMode()).toBe("baru");
    expect(h.k.alatFiturNyala("popup-7")).toBe(true);
  });

  it("401 (belum masuk): Lama", async () => {
    const h = jalankan({ tampilanServer: DITERAPKAN_UI }, async () => ({ ok: false, status: 401, json: async () => ({}) }));
    await h.k.alatMuatUji();
    await h.k.alatSegarkanTampilanServer(true);
    expect(h.k.alatUjiMode()).toBe("lama");
  });

  it("jaringan gagal atau portal lama (404): singgahan terakhir dipakai", async () => {
    const gagal = jalankan({ tampilanServer: DITERAPKAN_UI }, async () => {
      throw new TypeError("Failed to fetch");
    });
    await gagal.k.alatMuatUji();
    await gagal.k.alatSegarkanTampilanServer(true);
    expect(gagal.k.alatUjiMode()).toBe("ui");
    const lama = jalankan({ tampilanServer: DITERAPKAN_UI }, async () => ({ ok: false, status: 404, json: async () => ({}) }));
    await lama.k.alatMuatUji();
    await lama.k.alatSegarkanTampilanServer(true);
    expect(lama.k.alatUjiMode()).toBe("ui");
  });

  it("singgahan yang masih segar (< 5 menit) tidak diminta lagi - SIPP memuat ulang halaman tiap klik", async () => {
    const h = jalankan({ tampilanServer: DITERAPKAN_UI });
    await h.k.alatMuatUji();
    const sebelum = h.diminta.length;
    await h.k.alatSegarkanTampilanServer(false);
    expect(h.diminta.length).toBe(sebelum);
  });

  it("setelan pribadi boleh ditulis selama mode coba; tulisan lain tetap ditahan", async () => {
    const h = jalankan({ ujiTampilan: "ui" });
    await h.k.alatMuatUji();
    expect((await h.k.fetch("/aleta/api/aleta-ecourt/ekstensi/setelan", { method: "PUT" })).status).toBe(200);
    expect((await h.k.fetch(TULIS, { method: "POST" })).status).toBe(423);
  });
});

// ── latar.js: fungsi murni penggabungan tanda ────────────────────────────────
function fungsiLatar() {
  // tampilanBerlakuLatar dipakai bersama angka ikon (letaknya di atas blok
  // angka); fungsi penggabungan ada di blok sinkron. Keduanya diambil tanpa
  // kode tingkat atas di antaranya.
  const awalBerlaku = latar.indexOf("function tampilanBerlakuLatar(");
  const berlaku = latar.slice(awalBerlaku, latar.indexOf("\n}\n", awalBerlaku) + 3);
  const mulai = latar.indexOf("function tandaKeServer(");
  const akhir = latar.indexOf("async function sinkronTandaSekali(");
  const k: any = { Date, JSON, Number, String, Object, Array, Set, Math };
  vm.createContext(k);
  vm.runInContext(`${berlaku}\n${latar.slice(mulai, akhir)}\nthis.gabungTanda = gabungTanda; this.tandaKeServer = tandaKeServer; this.tampilanBerlakuLatar = tampilanBerlakuLatar;`, k);
  return k;
}

describe("sinkron tanda Selesai/Tunda (latar.js)", () => {
  const f = fungsiLatar();
  const L = (tanda: string, pada: number, sampai?: number) => ({ tanda, pada, ...(sampai ? { sampai } : {}), peran: "hakim" });
  const S = (keadaan: string, pada: number, sampai?: number) => ({
    keadaan,
    pada: new Date(pada).toISOString(),
    sampai: sampai ? new Date(sampai).toISOString() : null,
  });

  it("bentuk kiriman sesuai kontrak server: keadaan, sampai ISO/null, pada ISO", () => {
    const k = f.tandaKeServer({ a: L("tunda", 1000, 5000), b: L("selesai", 2000), c: { tanda: "aneh" } });
    expect(k).toEqual({
      a: { keadaan: "tunda", sampai: new Date(5000).toISOString(), pada: new Date(1000).toISOString() },
      b: { keadaan: "selesai", sampai: null, pada: new Date(2000).toISOString() },
    });
  });

  it("gabungan: yang ditandai paling akhir menang; butir baru dari kedua sisi ikut", () => {
    const g = f.gabungTanda({ a: L("selesai", 1000), b: L("tunda", 5000, 9000) }, { a: S("tunda", 3000, 8000), c: S("selesai", 2000) }, { ids: [] });
    expect(g.lokal.a.tanda).toBe("tunda");
    expect(g.lokal.a.sampai).toBe(8000);
    expect(g.lokal.a.peran).toBe("hakim"); // keterangan lokal dipertahankan
    expect(g.lokal.b.tanda).toBe("tunda");
    expect(g.lokal.c.tanda).toBe("selesai");
    expect(g.berubahLokal).toBe(true);
  });

  it("butir yang dikembalikan di PC ini TIDAK hidup lagi dari server", () => {
    const g = f.gabungTanda({}, { a: S("selesai", 1000) }, { ids: ["a"] });
    expect(g.lokal).toEqual({});
  });

  it("butir yang dikembalikan di PC lain (hilang dari server) ikut hilang di sini", () => {
    const g = f.gabungTanda({ a: L("selesai", 1000) }, {}, { ids: ["a"] });
    expect(g.lokal).toEqual({});
  });

  it("mode latihan (tahap 7): sinkron tanda tidak menulis apa pun ke server", () => {
    const badan = latar.slice(latar.indexOf("async function sinkronTandaSekali("));
    const fungsi = badan.slice(0, badan.indexOf("\n}\n"));
    const tahan = fungsi.indexOf("if (s.modeLatihan === true) return;");
    expect(tahan).toBeGreaterThan(0);
    expect(tahan).toBeLessThan(fungsi.indexOf("await fetch("));
    expect(latar).toContain('"sinkronTandaMeta", "modeLatihan"];');
  });

  it("hanya berjalan dalam tampilan yang berlaku: uji lokal atau diterapkan admin", () => {
    expect(f.tampilanBerlakuLatar({}).mode).toBe("lama");
    expect(f.tampilanBerlakuLatar({ ujiTampilan: "baru", ujiFitur: { "popup-7": true } }).fitur["popup-7"]).toBe(true);
    expect(f.tampilanBerlakuLatar({ tampilanServer: { mode: "ui", diterapkan: true, fitur: { "popup-7": true } } }).mode).toBe("ui");
    expect(f.tampilanBerlakuLatar({ tampilanServer: { mode: "ui", diterapkan: false } }).mode).toBe("lama");
    expect(latar).toContain('b.fitur["popup-7"] !== true) return;');
  });
});

// ── popup mengikuti tampilan yang diterapkan ─────────────────────────────────
describe("popup: tampilan yang diterapkan admin", () => {
  const terbuka: JSDOM[] = [];
  afterEach(() => {
    while (terbuka.length) terbuka.pop()!.window.close();
  });

  function buka(peran: string, awal: Record<string, unknown>) {
    const dom = new JSDOM(popupHtml.replace(/<script[\s\S]*?<\/script>/g, ""), {
      url: "chrome-extension://aleta/popup.html",
      runScripts: "outside-only",
    });
    terbuka.push(dom);
    const w = dom.window as any;
    const simpanan: Record<string, unknown> = { asalPortal: "http://192.168.10.10/aleta", ...awal };
    w.chrome = {
      runtime: { id: "x", getManifest: () => ({ version: "1.173.0" }), sendMessage: async () => ({}) },
      storage: {
        local: {
          get: async (kunci?: string | string[] | null) => {
            const d = kunci == null ? Object.keys(simpanan) : [kunci].flat();
            const h: Record<string, unknown> = {};
            for (const x of d) if (x in simpanan) h[x] = JSON.parse(JSON.stringify(simpanan[x]));
            return h;
          },
          set: async (isi: Record<string, unknown>) => void Object.assign(simpanan, isi),
          remove: async () => undefined,
        },
        session: { get: async () => ({}), set: async () => undefined },
        onChanged: { addListener() {} },
      },
    };
    w.fetch = async () => ({ ok: true, status: 200, json: async () => ({ ok: true, pengguna: { nama: "U", peran }, versi: "1.173.0" }) });
    const ctx = (dom as unknown as { getInternalVMContext: () => vm.Context }).getInternalVMContext();
    vm.runInContext(daftarFiturJs, ctx);
    vm.runInContext(popupJs, ctx);
    return w.document as Document;
  }

  it("pegawai yang diberi UI Baru mendapat kulit Modern di popup; pengalih tetap tersembunyi", async () => {
    const d = buka("Hakim", { tampilanServer: DITERAPKAN_UI });
    await new Promise((r) => setTimeout(r, 80));
    expect(d.documentElement.getAttribute("data-kulit")).toBe("modern");
    expect((d.getElementById("bagianUji") as HTMLElement).hidden).toBe(true);
    // Bukan tampilan uji yang tertinggal: pesan "kembali ke Lama" tidak muncul.
    expect((d.getElementById("ujiLainBaris") as HTMLElement).hidden).toBe(true);
  });

  it("tanpa penerapan: popup Lama bagi Super Admin; selain itu UI Baru wajib (12 Okt)", async () => {
    const d = buka("Super Admin", {});
    await new Promise((r) => setTimeout(r, 80));
    expect(d.documentElement.hasAttribute("data-kulit")).toBe(false);
    const h = buka("Hakim", {});
    await new Promise((r) => setTimeout(r, 80));
    expect(h.documentElement.getAttribute("data-kulit")).toBe("modern");
  });
});
