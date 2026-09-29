/**
 * Tahap 2 bagian bersama (ekstensi 1.173.0):
 *   - × di kepala panel: dalam UI Baru hanya MENUTUP (menciut ke lencana),
 *     ALETA tetap aktif; Lama dan Baru tetap mematikan saklar induk seperti
 *     sebelumnya (perbaikan desain popup/widget nomor 12).
 *   - Senyap 1 jam (ide popup-12): <html data-aleta-senyap> hanya bila saklar
 *     fiturnya menyala dan waktunya belum habis; lepas sendiri saat habis.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

const AKAR = path.resolve(__dirname, "../../../ekstensi-sipp");
const baca = (b: string) => readFileSync(path.join(AKAR, b), "utf8").replace(/\r\n/g, "\n");
const sumberAlat = baca("panel-alat.js");
const konten = baca("konten.js");
const gaya = baca("panel.css");

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

function jalankan(awal: Record<string, unknown>) {
  const simpanan: Record<string, unknown> = { ...awal };
  const pewaktu: Array<{ f: () => void; ms: number }> = [];
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
    setTimeout: (f: () => void, ms: number) => (pewaktu.push({ f, ms }), pewaktu.length),
    clearTimeout() {},
    document: { documentElement: akar, createElement: (t: string) => elemenTiruan(t), querySelector: () => null, addEventListener() {} },
    window: {
      location: { hostname: "127.0.0.1", pathname: "/index.php/x", search: "" },
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
            for (const x of kunci) if (x in simpanan) h[x] = simpanan[x];
            return h;
          },
          set: async (isi: Record<string, unknown>) => void Object.assign(simpanan, isi),
        },
      },
    },
    fetch: async () => ({ ok: true, status: 200, json: async () => ({}) }),
    navigator: {},
    Response: class {},
    AbortController: class {
      signal = {};
      abort() {}
    },
  };
  k.globalThis = k;
  vm.createContext(k);
  vm.runInContext(sumberAlat, k, { filename: "panel-alat.js" });
  return { k, akar, pewaktu };
}

async function siap(awal: Record<string, unknown>) {
  const h = jalankan(awal);
  await h.k.alatMuatUji();
  await h.k.alatMuatSenyap();
  return h;
}

describe("× di kepala panel", () => {
  it("Lama dan Baru: tetap mematikan saklar induk seperti sebelumnya", async () => {
    expect((await siap({})).k.alatTutupHanyaMenciut()).toBe(false);
    expect((await siap({ ujiTampilan: "baru" })).k.alatTutupHanyaMenciut()).toBe(false);
  });

  it("UI Baru: hanya menutup - menciut ke lencana, saklar induk tidak disentuh", async () => {
    expect((await siap({ ujiTampilan: "ui" })).k.alatTutupHanyaMenciut()).toBe(true);
    const badan = sumberAlat.slice(sumberAlat.indexOf("function alatTombolKepala("));
    const bagian = badan.slice(badan.indexOf('"aleta-matikan"'), badan.indexOf('"aleta-matikan"') + 600);
    expect(bagian).toContain("if (alatTutupHanyaMenciut()) {");
    expect(bagian).toContain("alatCiutkan(panel, kunci, true);");
    expect(bagian).toContain("pilihan.saatTutup();");
  });

  it("panel SIPP: cabang yang sama, dan saklar induk tetap dimatikan di luar UI Baru", () => {
    const badan = konten.slice(konten.indexOf("function tombolMatikan() {"));
    const fungsi = badan.slice(0, badan.indexOf("\n}\n"));
    const menciut = fungsi.indexOf("ciutkanKeLencana(panelIni, true);");
    const matikan = fungsi.indexOf("chrome.storage.local.set({ aktif: false })");
    expect(menciut).toBeGreaterThan(0);
    expect(matikan).toBeGreaterThan(menciut);
    expect(fungsi).toContain("if (alatTutupHanyaMenciut() && panelIni) {");
  });

  it("judulnya menyebut bahwa ALETA tetap aktif dan di mana mematikannya", async () => {
    const { k } = await siap({});
    const judul = vm.runInContext("ALAT_JUDUL_TUTUP_BARU", k);
    expect(judul).toMatch(/tetap aktif/);
    expect(judul).toMatch(/popup/);
  });
});

describe("senyap 1 jam", () => {
  const sejam = () => Date.now() + 3600_000;

  it("Lama: tidak pernah senyap, walau waktunya tersimpan", async () => {
    const { akar } = await siap({ senyapSampai: sejam(), ujiFitur: { "popup-12": true } });
    expect(akar.hasAttribute("data-aleta-senyap")).toBe(false);
  });

  it("saklar fitur popup-12 mati: tidak senyap", async () => {
    const { akar } = await siap({ ujiTampilan: "baru", senyapSampai: sejam() });
    expect(akar.hasAttribute("data-aleta-senyap")).toBe(false);
  });

  it("saklar menyala dan waktunya belum habis: senyap, dan dibangunkan saat habis", async () => {
    const { akar, pewaktu, k } = await siap({ ujiTampilan: "ui", ujiFitur: { "popup-12": true }, senyapSampai: sejam() });
    expect(akar.getAttribute("data-aleta-senyap")).toBe("ya");
    const bangun = pewaktu.at(-1)!;
    expect(bangun.ms).toBeGreaterThan(3500_000);
    // Waktunya habis: pewaktu memanggil alatTandaiSenyap, dan penandanya lepas.
    vm.runInContext("alatSenyapSampai = Date.now() - 1;", k);
    bangun.f();
    expect(akar.hasAttribute("data-aleta-senyap")).toBe(false);
  });

  it("waktu yang sudah lewat tidak menyenyapkan", async () => {
    const { akar } = await siap({ ujiTampilan: "baru", ujiFitur: { "popup-12": true }, senyapSampai: Date.now() - 1000 });
    expect(akar.hasAttribute("data-aleta-senyap")).toBe(false);
  });

  it("yang disembunyikan: panel, penanda, sisipan, dan widget - hanya di bawah penandanya", () => {
    const i = gaya.indexOf('html[data-aleta-senyap="ya"] .aleta-panel,');
    expect(i).toBeGreaterThan(0);
    const blok = gaya.slice(i, gaya.indexOf("}", i));
    for (const x of ["aleta-cm-widget", "aleta-cm-kabar", ".aleta-sisip", 'aleta-tanda"]']) expect(blok).toContain(x);
    expect(blok).toContain("display: none !important;");
  });
});
