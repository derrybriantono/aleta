// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

/**
 * ============================================================================
 * BUTIR 41 (17 OKT) - KOTAK KEHADIRAN & DRAF H-7 TANPA CHECKLIST MILESTONE
 * ============================================================================
 *
 *   1. Widget (checklist.js utuh di jsdom): di UI Baru kedua kotak tampil
 *      terlipat di dok kiri bawah walau Checklist milestone MATI - checklist
 *      sendiri tidak tampil dan tidak diminta. Saklarnya dimatikan = tidak ada
 *      apa pun. Lama = tidak ada apa pun.
 *   2. Popup: centangnya sama dengan yang tampil - UI Baru bawaan tercentang;
 *      tampilan Baru (Klasik) tanpa Checklist milestone tidak tercentang dan
 *      tidak dapat diubah.
 */

const EKSTENSI = path.resolve(__dirname, "../../../ekstensi-sipp");
const baca = (b: string) => readFileSync(path.join(EKSTENSI, b), "utf8").replace(/\r\n/g, "\n");
const polos = <T>(x: T): T => (x === undefined ? x : JSON.parse(JSON.stringify(x)));
const tunggu = (ms = 0) => new Promise((r) => setTimeout(r, ms));
async function sampai<T>(periksa: () => T, ket: string, batas = 4000): Promise<NonNullable<T>> {
  const mulai = Date.now();
  for (;;) {
    let hasil: T | undefined;
    try {
      hasil = periksa();
    } catch {
      hasil = undefined;
    }
    if (hasil) return hasil as NonNullable<T>;
    if (Date.now() - mulai > batas) throw new Error(`tidak tercapai: ${ket}`);
    await tunggu(10);
  }
}
type Jendela = any;
type Ubah = Record<string, { oldValue?: unknown; newValue?: unknown }>;

const terbuka: JSDOM[] = [];
afterEach(async () => {
  await tunggu(20);
  while (terbuka.length) terbuka.pop()!.window.close();
});

const API_KH = "/aleta/api/aleta-ecourt/antrian/kehadiran-saya";
const API_H7 = "/aleta/api/aleta-ecourt/agen-h7/saya";
const API_CHECKLIST = "/aleta/api/aleta-ecourt/checklist";
/** Permintaan milik widget (panel-alat.js sendiri boleh meminta profil tampilan dsb.). */
const mintaWidget = (m: string[]) => m.filter((a) => [API_KH, API_H7, API_CHECKLIST].some((x) => a.includes(x)));

function bukaWidget(awal: Record<string, unknown>) {
  const dom = new JSDOM(`<!doctype html><html><head></head><body></body></html>`, {
    url: "http://192.168.10.10/SIPP/detil_perkara_agama",
    runScripts: "outside-only",
    pretendToBeVisual: true,
  } as ConstructorParameters<typeof JSDOM>[1]) as JSDOM & { getInternalVMContext(): vm.Context };
  terbuka.push(dom);
  const w = dom.window as Jendela;
  const simpanan: Record<string, unknown> = polos({ posisiChecklistSipp: { kecil: false }, ...awal });
  const pendengar: Array<(u: Ubah, wil: string) => void> = [];
  w.chrome = {
    runtime: { id: "aleta-uji", getManifest: () => ({ version: "0.0.0" }), getURL: (x: string) => `chrome-extension://aleta-uji/${x}`, sendMessage: async () => ({}) },
    storage: {
      local: {
        get: async (kunci?: string | string[] | null) => {
          const daftar = kunci == null ? Object.keys(simpanan) : [kunci].flat();
          const hasil: Record<string, unknown> = {};
          for (const k of daftar) if (k in simpanan) hasil[k] = polos(simpanan[k]);
          return hasil;
        },
        set: async (isi: Record<string, unknown>) => {
          const ubah: Ubah = {};
          for (const [k, v] of Object.entries(isi)) {
            ubah[k] = { oldValue: simpanan[k], newValue: polos(v) };
            simpanan[k] = polos(v);
          }
          setTimeout(() => pendengar.forEach((f) => f(polos(ubah), "local")), 0);
        },
        remove: async () => undefined,
      },
      session: { get: async () => ({}), set: async () => undefined },
      onChanged: { addListener: (f: (u: Ubah, wil: string) => void) => void pendengar.push(f) },
    },
  };
  const minta: string[] = [];
  const jawab = (isi: unknown) => {
    const r = { ok: true, status: 200, json: async () => polos(isi), clone: () => r };
    return r;
  };
  w.fetch = (alamat: string) => {
    const url = String(alamat);
    minta.push(url);
    if (url.includes(API_KH)) return Promise.resolve(jawab({ ok: true, data: { available: true, ok: true, jumlah: 0, perkara: [] } }));
    if (url.includes(API_H7)) return Promise.resolve(jawab({ ok: true, data: { available: true, ok: true, jumlah: 0, perkara: [] } }));
    return Promise.resolve(jawab({ ok: true, data: {} }));
  };
  const ctx = dom.getInternalVMContext();
  vm.runInContext(baca("panel-alat.js"), ctx, { filename: "panel-alat.js" });
  vm.runInContext(baca("checklist.js"), ctx, { filename: "checklist.js" });
  const q = (p: string) => {
    const a = w.document.querySelector("aleta-cm-widget");
    return a && a.shadowRoot ? (a.shadowRoot.querySelector(p) as HTMLElement | null) : null;
  };
  return { w, q, minta, ubah: (isi: Record<string, unknown>) => w.chrome.storage.local.set(isi) };
}

describe("1. widget: kotak sidang tanpa Checklist milestone", () => {
  it("UI Baru, Checklist milestone MATI, saklar belum disentuh: kedua kotak tampil terlipat di dok; checklist tidak tampil dan tidak diminta", async () => {
    const h = bukaWidget({ ujiTampilan: "ui", checklistMilestone: false });
    const kh = await sampai(() => h.q(".aleta-cmw-dok [data-kehadiran-widget]"), "kotak kehadiran di dok");
    expect(h.q(".aleta-cmw-dok [data-draf-h7-widget]")).not.toBeNull();
    expect(kh.getAttribute("data-terbuka")).toBe("tidak");
    await sampai(() => h.minta.some((a) => a.includes(API_KH)) && h.minta.some((a) => a.includes(API_H7)), "kedua permintaan");
    await tunggu(100);
    expect(h.minta.some((a) => a.includes(API_CHECKLIST))).toBe(false);
    // Tanpa lencana/Atur widget/panel checklist.
    expect(h.q(".aleta-cmw-atur-buka")).toBeNull();
    expect(h.q(".aleta-cm-panel, .aleta-cmw-lencana-baris")).toBeNull();
  });

  it("kedua saklar dimatikan: tidak ada widget; dinyalakan lagi: muncul tanpa memuat ulang", async () => {
    const h = bukaWidget({ ujiTampilan: "ui", checklistMilestone: false, widgetKehadiran: false, widgetDrafH7: false });
    await tunggu(300);
    expect(h.w.document.querySelector("aleta-cm-widget")).toBeNull();
    expect(mintaWidget(h.minta)).toEqual([]);
    await h.ubah({ widgetKehadiran: true });
    await sampai(() => h.q("[data-kehadiran-widget]"), "kotak kehadiran sesudah dinyalakan");
    expect(h.q("[data-draf-h7-widget]")).toBeNull();
  });

  it("Lama dan Baru (Klasik) tanpa Checklist milestone: tidak ada apa pun", async () => {
    for (const mode of ["lama", "baru"]) {
      const h = bukaWidget({ ujiTampilan: mode, checklistMilestone: false });
      await tunggu(300);
      expect(h.w.document.querySelector("aleta-cm-widget"), mode).toBeNull();
      expect(mintaWidget(h.minta), mode).toEqual([]);
    }
  });
});

describe("2. popup: centang = kotak yang tampil", () => {
  const popupHtml = baca("popup.html").replace(/<script[\s\S]*?<\/script>/g, "");
  function bukaPopup(simpanan: Record<string, unknown>) {
    const dom = new JSDOM(popupHtml, { url: "chrome-extension://aleta/popup.html", runScripts: "outside-only" });
    terbuka.push(dom);
    const w = dom.window as Jendela;
    const data: Record<string, unknown> = { asalPortal: "http://192.168.10.10/aleta", ...simpanan };
    const pendengar: Array<(u: Record<string, { newValue?: unknown }>, t: string) => void> = [];
    w.chrome = {
      runtime: { id: "aleta-uji", getManifest: () => ({ version: "1.205.0", host_permissions: [] }), sendMessage: async () => ({ ok: true }) },
      storage: {
        local: {
          get: async (kunci?: string | string[] | null) => {
            const daftar = kunci == null ? Object.keys(data) : [kunci].flat();
            const hasil: Record<string, unknown> = {};
            for (const x of daftar) if (x in data) hasil[x] = polos(data[x]);
            return hasil;
          },
          set: async (isi: Record<string, unknown>) => {
            const ubah: Record<string, { newValue?: unknown }> = {};
            for (const [k, v] of Object.entries(polos(isi))) {
              data[k] = v;
              ubah[k] = { newValue: v };
            }
            for (const f of pendengar.slice()) f(ubah, "local");
          },
          remove: async () => undefined,
        },
        session: { get: async () => ({}), set: async () => undefined },
        onChanged: { addListener: (f: (u: Record<string, { newValue?: unknown }>, t: string) => void) => void pendengar.push(f) },
      },
    };
    w.fetch = async (alamat: string) => {
      if (String(alamat).includes("info=siapa")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            data: { pengguna: { nama: "Uji Admin", peran: "Super Admin", kunci: "kk-admin", golongan: { kode: "super-admin", semua: ["super-admin"] } }, versi: "1.205.0" },
          }),
        };
      }
      return { ok: true, status: 200, url: String(alamat), json: async () => ({ ok: true, data: {} }) };
    };
    const ctx = (dom as unknown as { getInternalVMContext: () => vm.Context }).getInternalVMContext();
    vm.runInContext(baca("daftar-fitur.js"), ctx, { filename: "daftar-fitur.js" });
    vm.runInContext(baca("popup.js"), ctx, { filename: "popup.js" });
    return { w, d: w.document as Document, data };
  }
  const kotak = (p: { d: Document }, id: string) => p.d.getElementById(id) as HTMLInputElement;
  const tenang = async (p: { d: Document }) => {
    await sampai(() => !/memuat/.test(p.d.getElementById("akunAleta")!.textContent || ""), "portal terbaca");
    await tunggu(80);
  };

  it("Baru (Klasik), Checklist milestone mati, saklar belum disentuh: TIDAK tercentang dan tidak dapat diubah", async () => {
    const p = bukaPopup({ ujiTampilan: "baru", checklistMilestone: false });
    await tenang(p);
    for (const id of ["widgetKehadiran", "widgetDrafH7"]) {
      expect(kotak(p, id).checked, id).toBe(false);
      expect(kotak(p, id).disabled, id).toBe(true);
    }
    // Checklist milestone dinyalakan: dapat diubah; bawaannya di Baru tetap mati (sama dengan widget).
    kotak(p, "checklistMilestone").checked = true;
    kotak(p, "checklistMilestone").dispatchEvent(new p.w.Event("change", { bubbles: true }));
    await tunggu(30);
    expect(kotak(p, "widgetKehadiran").disabled).toBe(false);
    expect(kotak(p, "widgetKehadiran").checked).toBe(false);
  });

  it("Baru (Klasik) dengan Checklist milestone + saklar dinyalakan sendiri: tercentang", async () => {
    const p = bukaPopup({ ujiTampilan: "baru", checklistMilestone: true, widgetKehadiran: true });
    await tenang(p);
    expect(kotak(p, "widgetKehadiran").checked).toBe(true);
    expect(kotak(p, "widgetDrafH7").checked).toBe(false);
  });

  it("UI Baru: bawaan tercentang walau Checklist milestone mati (kotaknya memang tampil)", async () => {
    const p = bukaPopup({ ujiTampilan: "ui", checklistMilestone: false });
    await tenang(p);
    expect(kotak(p, "widgetKehadiran").checked).toBe(true);
    expect(kotak(p, "widgetKehadiran").disabled).toBe(false);
    expect(kotak(p, "widgetDrafH7").checked).toBe(true);
  });
});
