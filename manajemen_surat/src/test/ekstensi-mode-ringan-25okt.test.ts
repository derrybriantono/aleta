// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

import { PILIHAN_MODE_RINGAN, bersihkanPilihanRingan, perangkatTua, putuskanModeRingan } from "@/lib/mode-ringan";

/**
 * ============================================================================
 * K16 - MODE RINGAN OTOMATIS UNTUK PC TUA (rantai B, 25 Okt 2026)
 * ============================================================================
 *   - satu aturan, dua salinan: lib TS = ekstensi JS atas SEMUA kombinasi;
 *   - ekstensi dijalankan SUNGGUHAN di jsdom: saklar Super Admin mati = tidak ada yang berubah walau komputer
 *     tua; saklar menyala + komputer tua = atribut + gaya + pewaktu diperpanjang; pilihan pengguna menang
 *     atas deteksi (nyala/mati) dan perubahan di tab yang terbuka berlaku seketika;
 *   - gaya hanya menyentuh elemen ALETA, tidak menyembunyikan apa pun.
 */

const AKAR = path.resolve(process.cwd(), "../ekstensi-sipp");
const baca = (b: string) => readFileSync(path.join(AKAR, b), "utf8").replace(/\r\n/g, "\n");
const HUB = baca("pengamat-bersama.js");
const RINGAN = baca("mode-ringan.js");
const tunggu = (ms = 0) => new Promise((r) => setTimeout(r, ms));

const terbuka: JSDOM[] = [];
afterEach(() => {
  while (terbuka.length) terbuka.pop()!.window.close();
});

type Opsi = { memori?: number; inti?: number; pilihan?: string; saklarOtomatis?: boolean; tanpaHub?: boolean };
function buka(o: Opsi = {}) {
  const dom = new JSDOM(`<!doctype html><html><head></head><body><div id="aleta-panel"></div><p id="sipp">SIPP</p></body></html>`, {
    url: "http://192.168.10.10/SIPP/main",
    runScripts: "outside-only",
    pretendToBeVisual: true,
  } as ConstructorParameters<typeof JSDOM>[1]);
  terbuka.push(dom);
  const w = dom.window as any;
  Object.defineProperty(w.navigator, "deviceMemory", { value: o.memori, configurable: true });
  Object.defineProperty(w.navigator, "hardwareConcurrency", { value: o.inti ?? 8, configurable: true });
  const simpan: Record<string, unknown> = {};
  if (o.pilihan) simpan.modeRingan = o.pilihan;
  if (o.saklarOtomatis !== undefined) simpan.tampilanServer = { kinerja: o.saklarOtomatis ? { modeRinganOtomatis: true } : {} };
  const pendengar: Array<(u: any, w: string) => void> = [];
  w.chrome = {
    runtime: { sendMessage: async () => ({}) },
    storage: {
      local: { get: async (k: string[]) => Object.fromEntries([k].flat().filter((n) => n in simpan).map((n) => [n, simpan[n]])) },
      onChanged: { addListener: (f: any) => pendengar.push(f) },
    },
  };
  // Jeda setiap setInterval yang dipasang di halaman dicatat: ukuran yang menentukan, bukan hitungan detak (rapuh saat beban).
  const jeda: number[] = [];
  const asliInterval = w.setInterval.bind(w);
  w.setInterval = (fn: unknown, ms: number, ...sisa: unknown[]) => (jeda.push(ms), asliInterval(fn, ms, ...sisa));
  const ctx = (dom as unknown as { getInternalVMContext(): vm.Context }).getInternalVMContext();
  if (!o.tanpaHub) vm.runInContext(HUB, ctx, { filename: "pengamat-bersama.js" });
  vm.runInContext(RINGAN, ctx, { filename: "mode-ringan.js" });
  const ubah = (kunci: string, nilai: unknown) => {
    simpan[kunci] = nilai;
    for (const f of pendengar) f({ [kunci]: { newValue: nilai } }, "local");
  };
  return { w, d: w.document as Document, R: w.ALETA_RINGAN, P: w.ALETA_PENGAMAT, ubah, jeda };
}
type H = ReturnType<typeof buka>;
const ringan = (h: H) => h.d.documentElement.hasAttribute("data-aleta-ringan");
async function sampai(h: H, nilai: boolean) {
  for (let i = 0; i < 100 && h.R.aktif() !== nilai; i++) await tunggu(5);
  expect(h.R.aktif()).toBe(nilai);
}

describe("aturan: lib TS dan ekstensi JS sama untuk semua kombinasi", () => {
  const R = buka({}).R;
  const pilihan = [...PILIHAN_MODE_RINGAN, "ngawur", undefined, null, 5];
  it("putuskan() ekstensi = putuskanModeRingan() lib", () => {
    for (const p of pilihan) {
      for (const saklarOtomatis of [true, false]) {
        for (const tua of [true, false]) {
          expect(R.murni.putuskan({ pilihan: p, saklarOtomatis, tua }), JSON.stringify({ p, saklarOtomatis, tua })).toEqual(
            putuskanModeRingan({ pilihan: p, saklarOtomatis, tua })
          );
        }
      }
    }
  });
  it("terdeteksiTua() ekstensi = perangkatTua() lib: memori <= 4 atau inti <= 2; tak diketahui bukan tua", () => {
    const kasus = [
      { deviceMemory: 4, hardwareConcurrency: 8 },
      { deviceMemory: 8, hardwareConcurrency: 8 },
      { deviceMemory: 8, hardwareConcurrency: 2 },
      { deviceMemory: 2, hardwareConcurrency: 1 },
      { deviceMemory: 0.5, hardwareConcurrency: 4 },
      { deviceMemory: undefined, hardwareConcurrency: 4 },
      { deviceMemory: undefined, hardwareConcurrency: undefined },
      { deviceMemory: "4", hardwareConcurrency: "8" },
      {},
    ];
    for (const k of kasus) expect(R.murni.terdeteksiTua(k), JSON.stringify(k)).toBe(perangkatTua(k));
    expect(perangkatTua({ deviceMemory: 4, hardwareConcurrency: 8 })).toBe(true);
    expect(perangkatTua({ deviceMemory: 8, hardwareConcurrency: 8 })).toBe(false);
    expect(perangkatTua({ deviceMemory: 8, hardwareConcurrency: 2 })).toBe(true);
    expect(perangkatTua({})).toBe(false);
  });
  it("pilihan tidak sah jatuh ke otomatis", () => {
    expect(bersihkanPilihanRingan("ngawur")).toBe("otomatis");
    expect(R.murni.bersihPilihan("ngawur")).toBe("otomatis");
  });
});

describe("saklar Super Admin mati (bawaan): tidak ada yang berubah", () => {
  it("komputer tua + pilihan otomatis + saklar mati = tampilan dan pewaktu seperti dulu", async () => {
    const h = buka({ memori: 2, inti: 2 });
    await tunggu(30);
    expect(h.R.aktif()).toBe(false);
    expect(h.R.keadaan()).toMatchObject({ tua: true, sebab: "saklar-mati", ringan: false });
    expect(ringan(h)).toBe(false);
    expect(h.d.getElementById("aleta-ringan-gaya")).toBeNull();
    expect(h.P.faktor()).toBe(1);
  });
});

describe("saklar menyala", () => {
  it("komputer tua: atribut + gaya khusus elemen ALETA + pewaktu hub diperpanjang dua kali", async () => {
    const h = buka({ memori: 4, saklarOtomatis: true });
    await sampai(h, true);
    expect(ringan(h)).toBe(true);
    const gaya = h.d.getElementById("aleta-ringan-gaya")!;
    expect(gaya.textContent).toContain("animation: none");
    expect(gaya.textContent).toContain('[id^="aleta"]');
    // hanya elemen ALETA: tidak ada pemilih yang berdiri sendiri (mis. "*" atau "body")
    for (const aturan of gaya.textContent!.split("{")[0].split(",")) expect(aturan.trim()).toMatch(/^html\[data-aleta-ringan\] \[(id\^="aleta"|class\*="aleta")\]( \*)?$/);
    expect(h.P.faktor()).toBe(2);
    expect(h.R.keadaan().sebab).toBe("terdeteksi-tua");
  });

  it("komputer kuat tidak diringankan", async () => {
    const h = buka({ memori: 8, inti: 8, saklarOtomatis: true });
    await tunggu(40);
    expect(h.R.aktif()).toBe(false);
    expect(h.R.keadaan().sebab).toBe("bukan-tua");
    expect(ringan(h)).toBe(false);
  });

  it("pewaktu hub dipasang dengan jeda dua kali lipat saat ringan, jeda semula saat tidak", async () => {
    async function jedaDipasang(ringanNyala: boolean) {
      const h = buka({ memori: 4, saklarOtomatis: ringanNyala });
      if (ringanNyala) await sampai(h, true);
      else await tunggu(30);
      const sebelum = h.jeda.length;
      const id = h.P.interval(() => undefined, 20);
      const dipasang = h.jeda.slice(sebelum);
      h.P.hapus(id);
      return dipasang;
    }
    expect(await jedaDipasang(false)).toEqual([20]);
    expect(await jedaDipasang(true)).toEqual([40]);
  });

  it("pilihan tiba sesudah pewaktu dipasang: jeda dipasang ulang di tempat (dua kali lipat, lalu kembali)", async () => {
    const h = buka({ memori: 16, inti: 16 });
    await tunggu(30);
    const id = h.P.interval(() => undefined, 20);
    expect(h.jeda).toContain(20);
    h.ubah("modeRingan", "nyala");
    await sampai(h, true);
    expect(h.jeda[h.jeda.length - 1]).toBe(40);
    h.ubah("modeRingan", "mati");
    await sampai(h, false);
    expect(h.jeda[h.jeda.length - 1]).toBe(20);
    h.P.hapus(id);
  });
});

describe("pilihan pengguna menang atas deteksi dan saklar", () => {
  it("nyala: ringan walau saklar mati dan komputer kuat", async () => {
    const h = buka({ memori: 16, inti: 16, pilihan: "nyala" });
    await sampai(h, true);
    expect(h.R.keadaan().sebab).toBe("pilihan-nyala");
    expect(ringan(h)).toBe(true);
  });

  it("mati: tidak ringan walau saklar menyala dan komputer tua", async () => {
    const h = buka({ memori: 2, saklarOtomatis: true, pilihan: "mati" });
    await tunggu(40);
    expect(h.R.aktif()).toBe(false);
    expect(h.R.keadaan().sebab).toBe("pilihan-mati");
    expect(ringan(h)).toBe(false);
  });

  it("berubah di tab yang terbuka tanpa memuat ulang: pilihan lalu saklar", async () => {
    const h = buka({ memori: 2, saklarOtomatis: true });
    await sampai(h, true);
    h.ubah("modeRingan", "mati");
    await sampai(h, false);
    expect(ringan(h)).toBe(false);
    expect(h.d.getElementById("aleta-ringan-gaya")).toBeNull();
    expect(h.P.faktor()).toBe(1);
    h.ubah("modeRingan", "otomatis");
    await sampai(h, true);
    h.ubah("tampilanServer", { kinerja: {} });
    await sampai(h, false);
    expect(ringan(h)).toBe(false);
  });

  it("tanpa pengamat-bersama.js tetap berjalan (hanya hiasan yang dimatikan)", async () => {
    const h = buka({ memori: 2, saklarOtomatis: true, tanpaHub: true });
    await sampai(h, true);
    expect(ringan(h)).toBe(true);
  });
});

describe("terpasang di manifest", () => {
  const manifest = JSON.parse(baca("manifest.json"));
  it("mode-ringan.js dimuat tepat sesudah pengamat-bersama.js di tiga kelompok skrip konten", () => {
    const kelompok = manifest.content_scripts.filter((c: any) => c.js.includes("mode-ringan.js"));
    expect(kelompok).toHaveLength(3);
    // Gabung rantai 26 Okt: portal-jalur.js (F/K7) boleh mendahului di SIPP dan ABT.
    for (const k of kelompok) expect((k.js[0] === "portal-jalur.js" ? k.js.slice(1) : k.js).slice(0, 2)).toEqual(["pengamat-bersama.js", "mode-ringan.js"]);
  });
});
