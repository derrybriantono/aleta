// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

/**
 * ============================================================================
 * 13 OKT BUTIR 2 & 5 - GEMBOK KEPALA RINGKAS, DAN ABT DAPAT DIGULIR LAGI
 * ============================================================================
 *
 *   2  Panel SIPP (dan panel ALETA pada letak "Mengecil sendiri") tinggal
 *      kepalanya saat menutupi tabel dan tidak ditunjuk. Tombol GEMBOK tepat
 *      di bawah kepala: bawaan TERBUKA = ringkas; TERKUNCI = kepala & isi tidak
 *      pernah disembunyikan. Keadaannya di chrome.storage.local
 *      (gembokKepalaSipp / gembokKepalaAleta), bukan variabel modul.
 *   5  Halaman ABT "tidak bisa digulir": overscroll-behavior: contain pada
 *      panel setinggi layar memutus rantai gulir walau isinya tidak meluap
 *      (diukur di replika ABT, Chromium: scrollY tetap 0; sesudah perbaikan
 *      500). Contain kini hanya berlaku selama isi panel meluap.
 *
 * panel-alat.js dijalankan UTUH di jsdom dengan chrome.storage tiruan; sisi
 * CSS dan pemanggil (konten.js, aleta.js) dibaca dari berkasnya.
 */

const EKSTENSI = path.resolve(process.cwd(), "../ekstensi-sipp");
const baca = (berkas: string) => readFileSync(path.join(EKSTENSI, berkas), "utf8").replace(/\r\n/g, "\n");
const SUMBER_ALAT = baca("panel-alat.js");

type Ubah = Record<string, { oldValue?: unknown; newValue?: unknown }>;
type JsdomUji = JSDOM & { getInternalVMContext(): vm.Context };
const tunggu = (ms = 0) => new Promise((r) => setTimeout(r, ms));

function penyimpanan(awal: Record<string, unknown>) {
  const simpanan: Record<string, unknown> = { ...awal };
  const pendengar: Array<(u: Ubah, w: string) => void> = [];
  const siarkan = (u: Ubah) => {
    for (const f of pendengar) f(u, "local");
  };
  return {
    simpanan,
    siarkan,
    storage: {
      local: {
        get: async (kunci: string | string[]) => {
          const hasil: Record<string, unknown> = {};
          for (const k of [kunci].flat()) if (k in simpanan) hasil[k] = simpanan[k];
          return hasil;
        },
        set: async (isi: Record<string, unknown>) => {
          const u: Ubah = {};
          for (const [k, v] of Object.entries(isi)) {
            u[k] = { oldValue: simpanan[k], newValue: v };
            simpanan[k] = v;
          }
          siarkan(u);
        },
        remove: async () => undefined,
      },
      session: { get: async () => ({}), set: async () => undefined },
      onChanged: { addListener: (f: (u: Ubah, w: string) => void) => void pendengar.push(f) },
    },
  };
}

const terbuka: JSDOM[] = [];
afterEach(async () => {
  await tunggu(20);
  while (terbuka.length) {
    const dom = terbuka.pop()!;
    const w = dom.window as any;
    for (const p of Array.from(w.document.querySelectorAll(".aleta-panel")) as any[]) {
      if (p.aletaPewaktuRingkas) w.clearInterval(p.aletaPewaktuRingkas);
      p.remove();
    }
    dom.window.close();
  }
});

function buka(awal: Record<string, unknown> = {}) {
  const dom = new JSDOM(`<!doctype html><html><head></head><body><table id="t"><tr><td>x</td></tr></table></body></html>`, {
    url: "http://192.168.10.10/SIPP/jurnal_perkara_list",
    runScripts: "outside-only",
  }) as JsdomUji;
  terbuka.push(dom);
  const w = dom.window as any;
  const p = penyimpanan(awal);
  w.chrome = {
    runtime: { id: "aleta-uji", getManifest: () => ({ version: "0.0.0" }), getURL: (x: string) => x, sendMessage: async () => ({}) },
    storage: p.storage,
  };
  w.fetch = () => Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
  const ctx = dom.getInternalVMContext();
  vm.runInContext(SUMBER_ALAT, ctx, { filename: "panel-alat.js" });
  // Gembok hanya di Baru/UI Baru (SYARAT MUTLAK tahap 7: Lama identik fd9aad7). Pegawai
  // selain Super Admin selalu UI Baru (UIBARU-WAJIB 12 Okt) - uji memakai UI Baru kecuali diminta Lama.
  vm.runInContext(`alatUji.mode = ${JSON.stringify(awal.ujiTampilan === "lama" ? "lama" : "ui")};`, ctx);
  const doc = w.document as Document;
  const kotak = (el: Element, r: { left: number; top: number; right: number; bottom: number }) => {
    (el as any).getBoundingClientRect = () => ({ ...r, width: r.right - r.left, height: r.bottom - r.top, x: r.left, y: r.top });
  };
  // Tabel halaman di kiri atas, 0..800 x 0..900.
  kotak(doc.getElementById("t")!, { left: 0, top: 0, right: 800, bottom: 900 });
  const panelBaru = (id = "aleta-panel-sipp", menutupi = true) => {
    const panel = doc.createElement("div");
    panel.className = "aleta-panel";
    panel.id = id;
    const kepala = doc.createElement("div");
    kepala.className = "aleta-kepala";
    kepala.appendChild(doc.createElement("button"));
    panel.appendChild(kepala);
    const isi = doc.createElement("div");
    isi.className = "aleta-isi";
    panel.appendChild(isi);
    doc.body.appendChild(panel);
    kotak(panel, menutupi ? { left: 500, top: 50, right: 950, bottom: 600 } : { left: 1000, top: 50, right: 1400, bottom: 600 });
    return { panel, kepala, isi };
  };
  const jalankan = <T>(kode: string) => vm.runInContext(kode, ctx) as T;
  return { dom, w, doc, simpanan: p.simpanan, siarkan: p.siarkan, panelBaru, jalankan };
}

describe("butir 2: gembok di bawah kepala, bawaan terbuka = kepala ringkas", () => {
  it("tampilan Lama: tidak ada gembok sama sekali (Lama identik fd9aad7)", () => {
    const h = buka({ ujiTampilan: "lama" });
    const { panel, kepala } = h.panelBaru();
    h.w.__p = panel;
    h.w.__k = kepala;
    expect(h.jalankan('alatPasangGembok(__p, __k, "sipp")')).toBeNull();
    expect(panel.querySelector(".aleta-gembok-baris")).toBeNull();
    expect(panel.hasAttribute("data-aleta-gembok")).toBe(false);
  });

  it("bawaan (belum pernah memilih): gembok terbuka, baris gembok tepat di bawah kepala, panel yang menutupi tabel meringkas", async () => {
    const h = buka();
    const { panel, kepala } = h.panelBaru();
    const pasang = h.jalankan<(p: Element, k: Element, s: string) => Promise<boolean>>("alatPasangGembok");
    expect(await pasang(panel, kepala, "sipp")).toBe(false);
    expect(panel.getAttribute("data-aleta-gembok")).toBe("buka");
    expect(kepala.nextElementSibling?.className).toBe("aleta-gembok-baris");
    const tombol = panel.querySelector(".aleta-gembok")!;
    expect(tombol.getAttribute("aria-pressed")).toBe("false");
    expect(panel.querySelector(".aleta-gembok-ikon")!.textContent).toBe("🔓");
    // Pemeriksaan pertama berjalan sesudah keadaan terbaca.
    await tunggu(5);
    expect(panel.getAttribute("data-aleta-kepala-ringkas")).toBe("ya");
    // Semua tombol kepala tetap di kepala (tidak ada yang dipindah/dibuang).
    expect(kepala.querySelectorAll("button").length).toBe(1);
  });

  it("panel yang tidak menutupi tabel tidak diringkas", async () => {
    const h = buka();
    const { panel, kepala } = h.panelBaru("aleta-panel-sipp", false);
    await h.jalankan<(p: Element, k: Element, s: string) => Promise<boolean>>("alatPasangGembok")(panel, kepala, "sipp");
    await tunggu(5);
    expect(panel.hasAttribute("data-aleta-kepala-ringkas")).toBe(false);
  });

  it("dikunci: kepala & isi tidak disembunyikan, keadaannya DISIMPAN di chrome.storage", async () => {
    const h = buka();
    const { panel, kepala } = h.panelBaru();
    await h.jalankan<(p: Element, k: Element, s: string) => Promise<boolean>>("alatPasangGembok")(panel, kepala, "sipp");
    await tunggu(5);
    expect(panel.getAttribute("data-aleta-kepala-ringkas")).toBe("ya");
    (panel.querySelector(".aleta-gembok") as HTMLButtonElement).click();
    await tunggu(5);
    expect(h.simpanan.gembokKepalaSipp).toBe(true);
    expect(panel.getAttribute("data-aleta-gembok")).toBe("kunci");
    expect(panel.hasAttribute("data-aleta-kepala-ringkas")).toBe(false);
    expect(panel.querySelector(".aleta-gembok")!.getAttribute("aria-pressed")).toBe("true");
    expect(panel.querySelector(".aleta-gembok-ikon")!.textContent).toBe("🔒");
    // Pemeriksa berikutnya tidak meringkas panel yang terkunci.
    h.jalankan<(p: Element) => boolean>("alatPeriksaRingkas")(panel);
    expect(panel.hasAttribute("data-aleta-kepala-ringkas")).toBe(false);
    // Dibuka lagi: kembali ringkas dan tersimpan false.
    (panel.querySelector(".aleta-gembok") as HTMLButtonElement).click();
    await tunggu(5);
    expect(h.simpanan.gembokKepalaSipp).toBe(false);
    h.jalankan<(p: Element) => boolean>("alatPeriksaRingkas")(panel);
    expect(panel.getAttribute("data-aleta-kepala-ringkas")).toBe("ya");
  });

  it("keadaan tersimpan dipakai saat panel lahir (halaman baru), dan perubahan dari tab lain diikuti", async () => {
    const h = buka({ gembokKepalaSipp: true });
    const { panel, kepala } = h.panelBaru();
    expect(await h.jalankan<(p: Element, k: Element, s: string) => Promise<boolean>>("alatPasangGembok")(panel, kepala, "sipp")).toBe(true);
    await tunggu(5);
    expect(panel.getAttribute("data-aleta-gembok")).toBe("kunci");
    expect(panel.hasAttribute("data-aleta-kepala-ringkas")).toBe(false);
    h.siarkan({ gembokKepalaSipp: { oldValue: true, newValue: false } });
    expect(panel.getAttribute("data-aleta-gembok")).toBe("buka");
  });

  it("kunci per situs: gembok ALETA tidak ikut mengunci panel SIPP; ALETA tanpa pemeriksa sendiri", async () => {
    const h = buka({ gembokKepalaAleta: true });
    const sipp = h.panelBaru("aleta-panel-sipp");
    const aleta = h.panelBaru("aleta-panel-portal");
    const pasang = h.jalankan<(p: Element, k: Element, s: string, o?: object) => Promise<boolean>>("alatPasangGembok");
    await pasang(sipp.panel, sipp.kepala, "sipp");
    await pasang(aleta.panel, aleta.kepala, "aleta", { ringkas: false });
    await tunggu(5);
    expect(sipp.panel.getAttribute("data-aleta-gembok")).toBe("buka");
    expect(aleta.panel.getAttribute("data-aleta-gembok")).toBe("kunci");
    // Panel ALETA diringkas t4AturPengecil, bukan pemeriksa SIPP.
    expect(aleta.panel.hasAttribute("data-aleta-kepala-ringkas")).toBe(false);
    expect((aleta.panel as any).aletaPewaktuRingkas).toBeFalsy();
  });

  it("panel SIPP (perkara & daftar) dan panel ALETA memasang gembok; pengecil ALETA menghormati kunci", () => {
    const konten = baca("konten.js");
    expect(konten.split('alatPasangGembok(panel, kepala, "sipp")').length - 1).toBe(2);
    const aleta = baca("aleta.js");
    expect(aleta).toContain('alatPasangGembok(panel, kepala, "aleta", { ringkas: false })');
    const pengecil = aleta.slice(aleta.indexOf("function t4AturPengecil("), aleta.indexOf("function t4SetelLetak("));
    expect(pengecil).toMatch(/getAttribute\("data-aleta-gembok"\) === "kunci"\)\s*\{\s*panel\.removeAttribute\("data-t4-menutupi"\)/);
  });

  it("CSS: ringkas hanya bila TIDAK terkunci dan tidak ditunjuk - di SIPP dan di ALETA", () => {
    const css = baca("panel.css");
    expect(css).toContain(
      '#aleta-panel-sipp[data-aleta-kepala-ringkas="ya"]:not([data-aleta-gembok="kunci"]):not(:hover):not(:focus-within):not(.aleta-panel-lencana):not(.aleta-panel-penuh)'
    );
    expect(css).toContain(
      'html[data-aleta-portal-letak="mengecil"] #aleta-panel-portal[data-t4-menutupi="ya"]:not([data-aleta-gembok="kunci"]):not(:hover)'
    );
  });
});

describe("butir 5: halaman ABT dapat digulir dari atas panel yang isinya pas", () => {
  const ukur = (el: Element, tinggiIsi: number, tinggiKotak: number, overflow = "auto") => {
    (el as HTMLElement).style.overflowY = overflow;
    Object.defineProperty(el, "scrollHeight", { value: tinggiIsi, configurable: true });
    Object.defineProperty(el, "clientHeight", { value: tinggiKotak, configurable: true });
  };

  it("isi tidak meluap -> data-aleta-meluap=tidak (contain dilepas); meluap -> ya", () => {
    const h = buka();
    const { panel, isi } = h.panelBaru("aleta-panel-abt");
    ukur(panel, 600, 600, "hidden");
    ukur(isi, 554, 554);
    const segarkan = h.jalankan<(p: Element) => boolean>("alatSegarkanMeluap");
    expect(segarkan(panel)).toBe(false);
    expect(panel.getAttribute("data-aleta-meluap")).toBe("tidak");
    ukur(isi, 2400, 554);
    expect(segarkan(panel)).toBe(true);
    expect(panel.getAttribute("data-aleta-meluap")).toBe("ya");
  });

  it("penanda disegarkan saat penunjuk bergerak di atas panel - sebelum roda diputar", async () => {
    const h = buka();
    const { panel, isi } = h.panelBaru("aleta-panel-abt");
    ukur(panel, 600, 600, "hidden");
    ukur(isi, 554, 554);
    h.jalankan<(p: Element) => void>("alatJagaGulirHalaman")(panel);
    expect(panel.getAttribute("data-aleta-meluap")).toBe("tidak");
    ukur(isi, 3000, 554);
    panel.dispatchEvent(new h.w.Event("pointermove"));
    await tunggu(40);
    expect(panel.getAttribute("data-aleta-meluap")).toBe("ya");
  });

  it("dipasang untuk tiap panel alatPasangPanel (panel ABT, ABT massal, ALETA)", () => {
    const awal = SUMBER_ALAT.indexOf("async function alatPasangPanel(");
    const badan = SUMBER_ALAT.slice(awal, SUMBER_ALAT.indexOf("\n}\n", awal));
    expect(badan).toContain("alatJagaGulirHalaman(panel);");
  });

  it("CSS: contain dilepas saat tidak meluap; tidak ada aturan ekstensi yang mengunci gulir html/body ABT", () => {
    const css = baca("panel.css");
    const aturan = css.slice(css.indexOf('.aleta-panel[data-aleta-meluap="tidak"],'));
    expect(aturan).toMatch(/^\.aleta-panel\[data-aleta-meluap="tidak"\],\n\.aleta-panel\[data-aleta-meluap="tidak"\] \.aleta-isi,\n\.aleta-panel\[data-aleta-meluap="tidak"\] \.aleta-perkakas-isi \{\n {2}overscroll-behavior: auto;/);
    const tanpaKomentar = css.replace(/\/\*[\s\S]*?\*\//g, "");
    for (const m of tanpaKomentar.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const pemilih = m[1].trim();
      const isi = m[2];
      if (!/overflow[^:]*:\s*hidden|height:\s*100vh/.test(isi)) continue;
      for (const satu of pemilih.split(",").map((s) => s.trim())) {
        const ujung = satu.split(/[\s>+~]+/).pop() || "";
        expect(/^(html|body)(\[|:|$)/.test(ujung) && /abt|^html|^body/.test(satu), `${satu} mengunci gulir halaman`).toBe(false);
      }
    }
    // Tak satu pun skrip ABT menulis overflow pada html/body.
    for (const berkas of ["abt.js", "panel-alat.js", "tema-awal.js", "checklist.js"]) {
      expect(baca(berkas), berkas).not.toMatch(/(documentElement|body)\.style\.overflow/);
    }
  });
});
