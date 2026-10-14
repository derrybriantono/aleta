// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

/**
 * ============================================================================
 * 14 OKT - KEPALA RINGKAS YANG MULUS (lanjutan 13 Okt butir 2)
 * ============================================================================
 *
 * Panel SIPP (dan panel ALETA "Mengecil sendiri") tidak lagi menciut seketika
 * saat kursor keluar sepiksel: "ditunjuk" kini atribut data-aleta-ditunjuk
 * yang diatur alatPasangTunjukHalus (panel-alat.js):
 *   - masuk = seketika; keluar = tetap penuh selama dalam toleransi 28 px,
 *     lalu jeda 700 ms; kembali di dalam jeda membatalkan;
 *   - fokus di dalam panel (select yang daftarnya terbuka) menahan panel;
 *   - tirai clip-path 200 ms di peramban (jsdom tidak punya animate -> lepas
 *     seketika sesudah jeda, jalur yang diuji di sini).
 * Diukur juga di Chromium (panel.css + panel-alat.js utuh): sebelum - keluar
 * 15 px sudah 48 px tinggi; sesudah - 596 px s.d. jeda, 48 px sesudahnya,
 * select terbuka + kursor jauh 1,6 dtk tetap 596 px.
 */

const EKSTENSI = path.resolve(process.cwd(), "../ekstensi-sipp");
const baca = (berkas: string) => readFileSync(path.join(EKSTENSI, berkas), "utf8").replace(/\r\n/g, "\n");
const SUMBER_ALAT = baca("panel-alat.js");

type JsdomUji = JSDOM & { getInternalVMContext(): vm.Context };
const tunggu = (ms = 0) => new Promise((r) => setTimeout(r, ms));

const terbuka: JSDOM[] = [];
afterEach(async () => {
  await tunggu(20);
  while (terbuka.length) {
    const dom = terbuka.pop()!;
    const w = dom.window as any;
    for (const p of Array.from(w.document.querySelectorAll(".aleta-panel")) as any[]) {
      if (p.aletaPewaktuRingkas) w.clearInterval(p.aletaPewaktuRingkas);
      if (p.aletaTunjukHalus) p.aletaTunjukHalus.lepas();
      p.remove();
    }
    dom.window.close();
  }
});

function buka(mode: "ui" | "lama" = "ui", simpanan: Record<string, unknown> = {}) {
  const dom = new JSDOM(`<!doctype html><html><head></head><body><table id="t"><tr><td>x</td></tr></table></body></html>`, {
    url: "http://192.168.10.10/SIPP/jurnal_perkara_list",
    runScripts: "outside-only",
  }) as JsdomUji;
  terbuka.push(dom);
  const w = dom.window as any;
  w.chrome = {
    runtime: { id: "aleta-uji", getManifest: () => ({ version: "0.0.0" }), getURL: (x: string) => x, sendMessage: async () => ({}) },
    storage: {
      local: {
        get: async (k: string | string[]) => Object.fromEntries([k].flat().filter((x) => x in simpanan).map((x) => [x, simpanan[x]])),
        set: async (v: Record<string, unknown>) => void Object.assign(simpanan, v),
        remove: async () => undefined,
      },
      session: { get: async () => ({}), set: async () => undefined },
      onChanged: { addListener: () => undefined },
    },
  };
  w.fetch = () => Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
  const ctx = dom.getInternalVMContext();
  vm.runInContext(SUMBER_ALAT, ctx, { filename: "panel-alat.js" });
  vm.runInContext(`alatUji.mode = ${JSON.stringify(mode)};`, ctx);
  const doc = w.document as Document;
  const kotak = (el: Element, r: { left: number; top: number; right: number; bottom: number }) => {
    (el as any).getBoundingClientRect = () => ({ ...r, width: r.right - r.left, height: r.bottom - r.top, x: r.left, y: r.top });
  };
  kotak(doc.getElementById("t")!, { left: 0, top: 0, right: 800, bottom: 900 });
  const panel = doc.createElement("div");
  panel.className = "aleta-panel";
  panel.id = "aleta-panel-sipp";
  const kepala = doc.createElement("div");
  kepala.className = "aleta-kepala";
  panel.appendChild(kepala);
  const isi = doc.createElement("div");
  isi.className = "aleta-isi";
  isi.innerHTML = `<select id="pilih"><option>satu</option><option>dua</option></select><button id="tb" type="button">x</button>`;
  panel.appendChild(isi);
  doc.body.appendChild(panel);
  // Kotak terbentang panel: 500..950 x 50..600 (menutupi tabel).
  kotak(panel, { left: 500, top: 50, right: 950, bottom: 600 });
  const gerak = (x: number, y: number) => {
    const e = new w.MouseEvent("pointermove", { bubbles: true, cancelable: true, clientX: x, clientY: y });
    doc.body.dispatchEvent(e);
    return e;
  };
  const pasang = () => vm.runInContext("alatPasangGembok", ctx)(panel, kepala, "sipp") as Promise<boolean> | null;
  return { w, doc, panel, kepala, gerak, pasang, simpanan, ctx };
}

const ditunjuk = (p: Element) => p.getAttribute("data-aleta-ditunjuk") === "ya";

describe("kepala ringkas mulus: jeda, toleransi, seketika", () => {
  it("masuk = seketika ditunjuk (pointerenter, tanpa menunggu bingkai)", async () => {
    const h = buka();
    await h.pasang();
    await tunggu(5);
    expect(h.panel.getAttribute("data-aleta-kepala-ringkas")).toBe("ya");
    expect(ditunjuk(h.panel)).toBe(false);
    h.panel.dispatchEvent(new h.w.MouseEvent("pointerenter", { clientX: 600, clientY: 60 }));
    expect(ditunjuk(h.panel)).toBe(true);
  });

  it("keluar jauh: tetap penuh selama jeda (±700 ms), lalu dilepas", async () => {
    const h = buka();
    await h.pasang();
    h.gerak(600, 300);
    await tunggu(40);
    expect(ditunjuk(h.panel)).toBe(true);
    h.gerak(1300, 300);
    await tunggu(350);
    expect(ditunjuk(h.panel)).toBe(true);
    await tunggu(700);
    expect(ditunjuk(h.panel)).toBe(false);
  });

  it("kembali di dalam jeda membatalkan penciutan", async () => {
    const h = buka();
    await h.pasang();
    h.gerak(600, 300);
    await tunggu(40);
    h.gerak(1300, 300);
    await tunggu(400);
    h.gerak(700, 300);
    await tunggu(900);
    expect(ditunjuk(h.panel)).toBe(true);
  });

  it("toleransi jarak: 20 px di luar tepi tetap penuh; 60 px di luar menciut sesudah jeda", async () => {
    const h = buka();
    await h.pasang();
    h.gerak(600, 300);
    await tunggu(40);
    h.gerak(950 + 20, 300);
    await tunggu(1100);
    expect(ditunjuk(h.panel)).toBe(true);
    h.gerak(600, 600 + 20); // di bawah tepi bawah, dalam toleransi
    await tunggu(1000);
    expect(ditunjuk(h.panel)).toBe(true);
    h.gerak(950 + 60, 300);
    await tunggu(1000);
    expect(ditunjuk(h.panel)).toBe(false);
  });

  it("masuk butuh kotak sungguhan: kursor di zona toleransi panel yang belum ditunjuk tidak membentangkannya", async () => {
    const h = buka();
    await h.pasang();
    h.gerak(950 + 15, 300);
    await tunggu(60);
    expect(ditunjuk(h.panel)).toBe(false);
  });

  it("select terfokus (daftarnya terbuka) menahan panel walau kursor jauh; lepas fokus -> menciut sesudah jeda", async () => {
    const h = buka();
    await h.pasang();
    const pilih = h.doc.getElementById("pilih") as any;
    h.gerak(600, 300);
    await tunggu(40);
    pilih.focus();
    h.gerak(1300, 850);
    await tunggu(1200);
    expect(ditunjuk(h.panel)).toBe(true);
    // Pemeriksa berkala juga tidak memperbarui ringkas saat ditunjuk.
    expect(h.ctx && vm.runInContext("alatPeriksaRingkas", h.ctx)(h.panel)).toBe(true);
    pilih.blur();
    await tunggu(30);
    h.gerak(1300, 860);
    await tunggu(1000);
    expect(ditunjuk(h.panel)).toBe(false);
  });

  it("tidak membatalkan bawaan apa pun: tekan/klik pada select, opsi, dan tombol isi panel", async () => {
    const h = buka();
    await h.pasang();
    const sasaran = [h.doc.getElementById("pilih")!, (h.doc.getElementById("pilih") as any).options[1], h.doc.getElementById("tb")!];
    for (const s of sasaran) {
      for (const jenis of ["pointermove", "pointerenter", "pointerdown", "mousedown", "pointerup", "mouseup", "click", "mouseout"]) {
        const e = new h.w.MouseEvent(jenis, { bubbles: true, cancelable: true, clientX: 600, clientY: 300 });
        s.dispatchEvent(e);
        expect(e.defaultPrevented, `${jenis} pada ${(s as Element).tagName}`).toBe(false);
      }
    }
  });

  it("gembok terkunci: tetap penuh (ringkas dilepas) dan pengatur tidak menganimasikan apa pun", async () => {
    const h = buka("ui", { gembokKepalaSipp: true });
    await h.pasang();
    await tunggu(5);
    expect(h.panel.getAttribute("data-aleta-gembok")).toBe("kunci");
    expect(h.panel.hasAttribute("data-aleta-kepala-ringkas")).toBe(false);
    h.gerak(600, 300);
    await tunggu(40);
    h.gerak(1300, 300);
    await tunggu(1000);
    expect(h.panel.hasAttribute("data-aleta-kepala-ringkas")).toBe(false);
  });

  it("tampilan Lama: tidak ada gembok, tidak ada pengatur ditunjuk", async () => {
    const h = buka("lama");
    expect(h.pasang()).toBeNull();
    h.gerak(600, 300);
    await tunggu(60);
    expect(h.panel.hasAttribute("data-aleta-ditunjuk")).toBe(false);
    expect((h.panel as any).aletaTunjukHalus).toBeUndefined();
  });
});

describe("CSS & panel ALETA memakai mekanisme yang sama", () => {
  it("aturan ringkas SIPP dan ALETA menghormati data-aleta-ditunjuk (dan tetap :hover/:focus-within/gembok)", () => {
    const css = baca("panel.css");
    expect(css).toContain(
      '#aleta-panel-sipp[data-aleta-kepala-ringkas="ya"]:not([data-aleta-gembok="kunci"]):not(:hover):not(:focus-within):not(.aleta-panel-lencana):not(.aleta-panel-penuh):not([data-aleta-ditunjuk="ya"])'
    );
    expect(css).toContain(
      'html[data-aleta-portal-letak="mengecil"] #aleta-panel-portal[data-t4-menutupi="ya"]:not([data-aleta-gembok="kunci"]):not(:hover):not(:focus-within):not(.aleta-panel-lencana):not([data-aleta-ditunjuk="ya"])'
    );
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{\s*#aleta-panel-sipp\[data-aleta-gembok-situs\]/);
  });

  it("pengecil panel ALETA memasang alatPasangTunjukHalus dan menganggap data-aleta-ditunjuk sebagai ditunjuk", () => {
    const aleta = baca("aleta.js");
    const pengecil = aleta.slice(aleta.indexOf("function t4AturPengecil("), aleta.indexOf("function t4SetelLetak("));
    expect(pengecil).toContain("alatPasangTunjukHalus(");
    expect(pengecil).toContain('panel.getAttribute("data-aleta-ditunjuk") === "ya"');
    expect(pengecil).toMatch(/getAttribute\("data-aleta-gembok"\) === "kunci"\)\s*\{\s*panel\.removeAttribute\("data-t4-menutupi"\)/);
  });
});
