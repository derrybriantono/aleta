// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

import { susunDrafSaya, type DrafH7 } from "@/lib/agen-h7-putusan";
import { namaAdaDi } from "@/lib/perkara-sendiri";

/**
 * F4.2 (17 Okt 2026) - draf putusan H-7 di WIDGET ALETA (perintah tetap: ALETA,
 * SIPP, ABT, ekstensi, widget sinkron).
 *
 *   - aturan milik akun: majelis, PP, atau konseptor sementara; Admin semua;
 *     hanya Hari Putusan hari ini s.d. tujuh hari lagi, terdekat dulu;
 *   - widget (checklist.js utuh di jsdom): Lama tidak ada apa pun dan tidak
 *     meminta; UI Baru/Baru satu kotak dengan kalimat Jadwal Sidang; saklar
 *     popup widgetDrafH7 (bawaan mati) mematikan kotak DAN permintaannya; di
 *     ABT dengan Blangko Derry pada perkara yang sama, tombolnya memanggil
 *     pakaiDrafH7 (saran saja), selain itu tautan ke Jadwal Sidang.
 */

const draf = (id: string, tanggal: string, lain: Partial<DrafH7> = {}): DrafH7 =>
  ({
    perkaraId: id,
    nomorPerkara: `${id}/Pdt.G/2026/PA.Dgl`,
    jenisPerkara: "Cerai Gugat",
    tanggalSidang: tanggal,
    agenda: "Musyawarah Majelis",
    alasan: "putusan",
    majelis: "Drs. Hakim Satu, M.H.",
    panitera: "PP Dua, S.H.",
    blangko: { utama: { jenis: "putusan", folder: "derry_briantono/1 Perceraian CG", berkas: "[02] [Kabul] CG - F.rtf", menu: "Putusan Cerai Gugat", alias: [], label: "[02] [Kabul] CG - F", alasan: "x", utama: true, perkiraan: true }, alternatif: [], perkiraanVerstek: false, alasan: "x" },
    isian: [],
    otomatis: null,
    ringkasan: [],
    kesiapan: { tingkat: "hampir", jumlah: 4, terisi: 2, pasti: 1, usulan: 1, manusia: 0, persen: 75, perlu: ["Alasan perceraian"], dataSippKosong: 0, perLangkah: {} },
    kendala: [],
    dibuatPada: "2026-10-16T22:00:00.000Z",
    ...lain,
  }) as DrafH7;

describe("susunDrafSaya: draf milik akun untuk widget", () => {
  const daftar = [
    { draf: draf("11", "2026-10-24") },
    { draf: draf("12", "2026-10-18", { majelis: "Hakim Lain", panitera: "PP Lain" }), konseptor: "Hakim Satu" },
    { draf: draf("13", "2026-10-26") },
    { draf: draf("14", "2026-10-16") },
    { draf: draf("15", "2026-10-19", { majelis: "Hakim Lain", panitera: "PP Lain", alasan: "verstek" }) },
  ];
  const opsi = { hariIni: "2026-10-17", cocokNama: namaAdaDi };

  it("hakim: perkara majelisnya dan tunjukan konseptornya, terdekat dulu; di luar tujuh hari tidak", () => {
    const h = susunDrafSaya(daftar, { ...opsi, nama: "Hakim Satu", lihatSemua: false });
    expect(h.perkara.map((p) => [p.perkaraId, p.sisaHari, p.sebagai.join()])).toEqual([
      ["12", 1, "konseptor"],
      ["11", 7, "hakim"],
    ]);
    expect(h.perkara[1]).toMatchObject({ lencana: "Draf H-7 75% - 1 perlu diisi", tingkat: "hampir", perlu: ["Alasan perceraian"] });
    expect(h.perkara[1].checklist.blangko).toMatchObject({ menu: "Putusan Cerai Gugat" });
  });

  it("PP: perkara paniteranya; admin: semua dalam jendela", () => {
    expect(susunDrafSaya(daftar, { ...opsi, nama: "PP Dua", lihatSemua: false }).perkara.map((p) => p.perkaraId)).toEqual(["11"]);
    const a = susunDrafSaya(daftar, { ...opsi, nama: "Admin", lihatSemua: true });
    expect(a.perkara.map((p) => [p.perkaraId, p.alasan])).toEqual([
      ["12", "putusan"],
      ["15", "verstek"],
      ["11", "putusan"],
    ]);
    expect(a.perkara.every((p) => p.sebagai.length === 0)).toBe(true);
  });
});

// ============================================================================
// Widget
// ============================================================================

const EKSTENSI = path.resolve(process.cwd(), "../ekstensi-sipp");
const baca = (b: string) => readFileSync(path.join(EKSTENSI, b), "utf8").replace(/\r\n/g, "\n");
const SUMBER_ALAT = baca("panel-alat.js");
const SUMBER_CHECKLIST = baca("checklist.js");
const API_CHECKLIST = "/aleta/api/aleta-ecourt/checklist";
const API_H7 = "/aleta/api/aleta-ecourt/agen-h7/saya";

type JsdomUji = JSDOM & { getInternalVMContext(): vm.Context };
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

function jawabanChecklist() {
  return {
    ok: true,
    data: {
      pengguna: { nama: "Hakim Satu", peran: ["hakim"], superAdmin: false },
      peranTersedia: [{ kunci: "hakim", label: "Hakim" }],
      peranAktif: "hakim",
      dibuat: new Date().toISOString(),
      ringkas: { lewat: 0, hariIni: 0, mingguIni: 0, selesaiHariIni: 0, totalHariIni: 0 },
      butir: [],
      jenisTidakTersedia: [],
      galat: [],
    },
  };
}

const JAWABAN_H7 = {
  ok: true,
  data: {
    ok: true,
    jumlah: 2,
    perkara: susunDrafSaya(
      [{ draf: draf("12", "2026-10-18") }, { draf: draf("15", "2026-10-22", { alasan: "verstek", kesiapan: { ...draf("x", "").kesiapan, tingkat: "siap", persen: 100, perlu: [] } }) }],
      { hariIni: "2026-10-17", nama: "Hakim Satu", lihatSemua: false, cocokNama: namaAdaDi }
    ).perkara,
  },
};

type Ubah = Record<string, { oldValue?: unknown; newValue?: unknown }>;
const terbuka: JSDOM[] = [];
afterEach(async () => {
  await tunggu(20);
  while (terbuka.length) terbuka.pop()!.window.close();
});

function buka(awal: Record<string, unknown>, opsi: { url?: string; status?: number; blangkoDerryPk?: string } = {}) {
  const dom = new JSDOM(`<!doctype html><html><head></head><body></body></html>`, {
    url: opsi.url ?? "http://192.168.10.10/SIPP/detil_perkara_agama",
    runScripts: "outside-only",
    pretendToBeVisual: true,
  } as ConstructorParameters<typeof JSDOM>[1]) as JsdomUji;
  terbuka.push(dom);
   
  const w = dom.window as any;
  const simpanan: Record<string, unknown> = polos({ posisiChecklistSipp: { kecil: false }, checklistMilestone: true, widgetDrafH7: true, ...awal });
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
  const dipakai: unknown[] = [];
  if (opsi.blangkoDerryPk) {
    w.aletaBlangkoDerryIsian = {
      pakaiDrafH7: async (d: unknown) => void dipakai.push(polos(d)),
      keadaan: () => ({ pk: { perkaraId: opsi.blangkoDerryPk } }),
    };
  }
  const tanggapan = (status: number, isi: unknown) => {
    const r = { ok: status >= 200 && status < 300, status, json: async () => polos(isi), clone: () => r };
    return r;
  };
  const status = opsi.status ?? 200;
  w.fetch = (alamat: string) => {
    const url = String(alamat);
    if (url.includes(API_H7)) {
      minta.push(url);
      return Promise.resolve(tanggapan(status, status === 200 ? JAWABAN_H7 : {}));
    }
    if (url.includes(API_CHECKLIST)) return Promise.resolve(tanggapan(200, jawabanChecklist()));
    return Promise.resolve(tanggapan(200, { ok: true, data: {} }));
  };
  const ctx = dom.getInternalVMContext();
  vm.runInContext(SUMBER_ALAT, ctx, { filename: "panel-alat.js" });
  vm.runInContext(SUMBER_CHECKLIST, ctx, { filename: "checklist.js" });
  const ubahSimpanan = (isi: Record<string, unknown>) => w.chrome.storage.local.set(isi);
  return { w, minta, dipakai, ubahSimpanan };
}

type H = ReturnType<typeof buka>;
 
const q = (h: H, p: string): any => {
  const a = h.w.document.querySelector("aleta-cm-widget");
  return a && a.shadowRoot ? a.shadowRoot.querySelector(p) : null;
};
 
const qs = (h: H, p: string): any[] => {
  const a = h.w.document.querySelector("aleta-cm-widget");
  return a && a.shadowRoot ? Array.from(a.shadowRoot.querySelectorAll(p)) : [];
};

describe("widget ALETA: kotak Draf putusan H-7", () => {
  it("Lama: tidak ada kotak dan tidak ada permintaan", async () => {
    const h = buka({});
    await sampai(() => q(h, ".aleta-cm-kelompok") || q(h, ".aleta-cm-isi"), "widget Lama");
    await tunggu(150);
    expect(q(h, "[data-draf-h7-widget]")).toBeNull();
    expect(h.minta).toEqual([]);
  });

  it("UI Baru: satu kotak, kalimat Jadwal Sidang, nada menurut kesiapan, tautan Jadwal Sidang; satu permintaan", async () => {
    const h = buka({ ujiTampilan: "ui" });
    await sampai(() => qs(h, "[data-draf-h7-widget] .aleta-cmw-kh-chip").length === 2, "dua lencana draf");
    const kotak = q(h, "[data-draf-h7-widget]");
    expect(kotak.textContent).toContain("Draf putusan H-7");
    expect(qs(h, "[data-draf-h7-widget] .aleta-cmw-kh-ket").map((x) => x.textContent)).toEqual(["Hari Putusan besok", "Perkiraan putusan verstek 5 hari lagi"]);
    expect(qs(h, "[data-draf-h7-widget] .aleta-cmw-kh-chip").map((c) => [c.textContent, c.getAttribute("data-nada")])).toEqual([
      ["Draf H-7 75% - 1 perlu diisi", "kuning"],
      ["Draf H-7 siap", "hijau"],
    ]);
    const tautan = qs(h, "[data-draf-h7-widget] a.aleta-cmw-h7-aksi");
    expect(tautan).toHaveLength(2);
    expect(tautan[0].getAttribute("href")).toBe("http://192.168.10.10/aleta/aleta-ecourt");
    expect(h.minta).toEqual([API_H7]);
    expect(kotak.textContent).not.toMatch(/undefined|null|#\d{4}#/);
  });

  it("Baru: kotak di tumpukan atas checklist", async () => {
    const h = buka({ ujiTampilan: "baru" });
    await sampai(() => q(h, ".aleta-cmw-tumpuk-klasik [data-draf-h7-widget] .aleta-cmw-kh-chip"), "kotak di tumpukan Baru");
  });

  it("saklar popup mati (bawaan): tanpa kotak dan tanpa permintaan; dinyalakan/dimatikan tanpa muat ulang", async () => {
    const h = buka({ ujiTampilan: "ui", widgetDrafH7: undefined });
    await sampai(() => q(h, ".aleta-cmw-dok"), "dok UI Baru");
    await tunggu(150);
    expect(q(h, "[data-draf-h7-widget]")).toBeNull();
    expect(h.minta).toEqual([]);
    await h.ubahSimpanan({ widgetDrafH7: true });
    await sampai(() => qs(h, "[data-draf-h7-widget] .aleta-cmw-kh-chip").length === 2, "kotak muncul");
    await h.ubahSimpanan({ widgetDrafH7: false });
    await sampai(() => !q(h, "[data-draf-h7-widget]"), "kotak hilang");
  });

  it("ABT dengan Blangko Derry pada perkara yang sama: tombol memasang draf sebagai saran", async () => {
    // Posisi widget disimpan per aplikasi; tanpa posisi ABT widget tampil mengecil.
    const h = buka({ ujiTampilan: "ui", posisiChecklistAbt: { kecil: false } }, { url: "http://192.168.10.10/aps_badilag/abt/main", blangkoDerryPk: "12" });
    const tombol = await sampai(() => q(h, '[data-h7-pakai="12"]'), "tombol pakai draf");
    expect(tombol.textContent).toBe("Buka blangko draf & pasang saran");
    tombol.click();
    await sampai(() => h.dipakai.length === 1, "pakaiDrafH7 dipanggil");
    expect(h.dipakai[0]).toMatchObject({ blangko: { menu: "Putusan Cerai Gugat" } });
    // Perkara lain (15) tetap bertautan ke Jadwal Sidang.
    expect(q(h, '[data-h7-perkara="15"] a.aleta-cmw-h7-aksi')).not.toBeNull();
  });

  it("belum masuk portal: kalimat awam", async () => {
    const h = buka({ ujiTampilan: "ui" }, { status: 401 });
    await sampai(() => /Masuk ke portal ALETA dulu/.test(q(h, "[data-draf-h7-widget]")?.textContent || ""), "kalimat belum masuk");
  });
});

describe("saklar popup widgetDrafH7 terdaftar di semua tempat", () => {
  it("popup.html, popup.js (saklar, setelan akun, bawaan mati, ringkas, kelompok Portal), latar.js", () => {
    expect(baca("popup.html")).toContain('id="widgetDrafH7"');
    const p = baca("popup.js");
    expect(p).toContain('widgetDrafH7: ["widgetDrafH7", false]');
    expect(p).toContain("widgetDrafH7: false,");
    expect(p).toContain('isi: ["checklistMilestone", "widgetKehadiran", "widgetDrafH7"]');
    expect(p.match(/"widgetDrafH7",/g)?.length).toBeGreaterThanOrEqual(1);
    expect(baca("latar.js")).toContain('"widgetDrafH7",');
  });
});
