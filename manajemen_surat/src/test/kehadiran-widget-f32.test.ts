// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

import { susunKehadiranSaya, type BarisKehadiranSaya } from "@/app/api/aleta-ecourt/antrian/kehadiran-saya/susun";

/**
 * F3.2 (17 Okt 2026) - kehadiran sidang hari ini di WIDGET ALETA.
 *
 *   - rute: hanya sidang HARI INI milik akun (majelis/PP/JS), kalimat sama
 *     dengan Jadwal Sidang; Admin melihat semua;
 *   - widget (checklist.js utuh di jsdom beralamat SIPP): Lama tidak ada apa
 *     pun dan tidak meminta; Baru/UI Baru satu kotak; saklar popup
 *     widgetKehadiran mematikan kotak DAN permintaannya, menyalakannya lagi
 *     tanpa memuat ulang; 401 dijawab dengan kalimat awam.
 */

/** 23 Okt 2026: widget tersembunyi bawaannya - uji lama meminta semua bagian ditampilkan seperti sebelum aturan itu. */
const BUKA_SEMUA = 'document.dispatchEvent(new CustomEvent("aleta-widget-tampilkan", { detail: { bagian: "semua" } }));';
const HARI = "2026-10-17";

describe("rute kehadiran-saya: susunKehadiranSaya", () => {
  const baris = [
    {
      perkaraId: "11",
      nomorPerkara: "11/Pdt.G/2026/PA.Dgl",
      tanggalSidang: HARI,
      jamSidang: "09:00:00",
      ruangan: "Ruang Sidang 1",
      majelisNama: "Hakim Satu",
      paniteraNama: "PP Dua",
      pihak: { penggugat: ["A"], tergugat: ["B"] },
      saksiPihak1: 2,
    },
    { perkaraId: "12", nomorPerkara: "12/Pdt.G/2026/PA.Dgl", tanggalSidang: HARI, jamSidang: "10:00:00", majelisNama: "Hakim Lain", pihak: { penggugat: ["C"], tergugat: ["D"] } },
    { perkaraId: "13", nomorPerkara: "13/Pdt.G/2026/PA.Dgl", tanggalSidang: "2026-10-20", majelisNama: "Hakim Satu", pihak: { penggugat: ["E"], tergugat: ["F"] } },
  ] as unknown as BarisKehadiranSaya[];
  const antrian = {
    peta: { "11": { tanggalSidang: HARI, nomor: 3, pihak1: "08:47", pihak2: "", saksi: "", diRuang: 1 } },
    kehadiran: {
      [`11|${HARI}`]: { hadir: [{ id: "s", peran: "saksi", saksiUntuk: "pihak_1", jam: "09:40", nama: "Siti" }] },
    },
  };

  it("hanya sidang hari ini milik akun, kalimat sama dengan Jadwal Sidang, yang disidang di atas", () => {
    const h = susunKehadiranSaya(baris, antrian, { hariIni: HARI, nama: "Hakim Satu", lihatSemua: false });
    expect(h.perkara.map((p) => p.nomorPerkara)).toEqual(["11/Pdt.G/2026/PA.Dgl"]);
    const p = h.perkara[0];
    expect(p.nomorAntrian).toBe(3);
    expect(p.sedangDisidang).toBe(true);
    expect(p.sebagai).toContain("hakim");
    expect(p.ringkas.map((r) => r.teks)).toEqual(["Penggugat hadir 08.47", "Tergugat belum", "Saksi P 1/2", "sedang disidang R1"]);
  });

  it("Admin melihat semua sidang hari ini; tanpa catatan = 'Belum ada yang tercatat hadir'", () => {
    const h = susunKehadiranSaya(baris, antrian, { hariIni: HARI, nama: "Admin", lihatSemua: true });
    expect(h.jumlah).toBe(2);
    expect(h.perkara[1].ringkas[0].teks).toBe("Belum ada yang tercatat hadir");
  });

  it("antrian bertanggal lain tidak dipakai (gagal-tertutup)", () => {
    const lain = { peta: { "11": { tanggalSidang: "2026-10-16", nomor: 9, pihak1: "08:00" } } };
    const h = susunKehadiranSaya(baris, lain, { hariIni: HARI, nama: "Hakim Satu", lihatSemua: false });
    expect(h.perkara[0].nomorAntrian).toBeNull();
    expect(h.perkara[0].ringkas[0].teks).toBe("Belum ada yang tercatat hadir");
  });
});

// ============================================================================
// Widget di halaman SIPP
// ============================================================================

const EKSTENSI = path.resolve(process.cwd(), "../ekstensi-sipp");
const baca = (b: string) => readFileSync(path.join(EKSTENSI, b), "utf8").replace(/\r\n/g, "\n");
const SUMBER_ALAT = baca("panel-alat.js");
const SUMBER_CHECKLIST = baca("checklist.js");
const API_CHECKLIST = "/aleta/api/aleta-ecourt/checklist";
const API_KH = "/aleta/api/aleta-ecourt/antrian/kehadiran-saya";

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
      pengguna: { nama: "PP Dua", peran: ["pp"], superAdmin: false },
      peranTersedia: [{ kunci: "pp", label: "Panitera Pengganti" }],
      peranAktif: "pp",
      dibuat: new Date().toISOString(),
      ringkas: { lewat: 0, hariIni: 0, mingguIni: 0, selesaiHariIni: 0, totalHariIni: 0 },
      butir: [],
      jenisTidakTersedia: [],
      galat: [],
    },
  };
}

const JAWABAN_KH = {
  ok: true,
  data: {
    ok: true,
    jumlah: 1,
    perkara: [
      {
        perkaraId: "11",
        nomorPerkara: "11/Pdt.G/2026/PA.Dgl",
        jam: "09:00",
        ruangan: "Ruang Sidang 1",
        nomorAntrian: 3,
        sedangDisidang: true,
        selesai: false,
        ringkas: [
          { teks: "Penggugat hadir 08.47", nada: "hijau", judul: "x" },
          { teks: "Tergugat belum", nada: "abu", judul: "" },
          { teks: "Saksi P 1/2", nada: "kuning", judul: "" },
          { teks: "sedang disidang R1", nada: "biru", judul: "" },
        ],
      },
    ],
  },
};

type Ubah = Record<string, { oldValue?: unknown; newValue?: unknown }>;
const terbuka: JSDOM[] = [];
afterEach(async () => {
  await tunggu(20);
  while (terbuka.length) terbuka.pop()!.window.close();
});

function buka(awal: Record<string, unknown>, statusKh = 200) {
  const dom = new JSDOM(`<!doctype html><html><head></head><body></body></html>`, {
    url: "http://192.168.10.10/SIPP/detil_perkara_agama",
    runScripts: "outside-only",
    pretendToBeVisual: true,
  } as ConstructorParameters<typeof JSDOM>[1]) as JsdomUji;
  terbuka.push(dom);
  const w = dom.window as any;
  const simpanan: Record<string, unknown> = polos({ posisiChecklistSipp: { kecil: false }, checklistMilestone: true, widgetKehadiran: true, ...awal });
  // 21 Okt 2026 (semua panel ekstensi bawaannya terlipat): widget terbentang hanya bila dibentangkan pada SESI TAB
  // ini (panel-alat.js alatPanelTerbuka sesiTab). Uji kotak Kehadiran di dalam dok memakai widget yang dibentangkan.
  if ((simpanan.posisiChecklistSipp as { kecil?: boolean } | undefined)?.kecil === false) {
    w.sessionStorage.setItem("aleta-panel-terbuka:checklist-widget", "1");
  }
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
  const tanggapan = (status: number, isi: unknown) => {
    const r = { ok: status >= 200 && status < 300, status, json: async () => polos(isi), clone: () => r };
    return r;
  };
  w.fetch = (alamat: string) => {
    const url = String(alamat);
    if (url.includes(API_KH)) {
      minta.push(url);
      return Promise.resolve(tanggapan(statusKh, statusKh === 200 ? JAWABAN_KH : {}));
    }
    if (url.includes(API_CHECKLIST)) return Promise.resolve(tanggapan(200, jawabanChecklist()));
    return Promise.resolve(tanggapan(200, { ok: true, data: {} }));
  };
  const ctx = dom.getInternalVMContext();
  vm.runInContext(SUMBER_ALAT, ctx, { filename: "panel-alat.js" });
  vm.runInContext(SUMBER_CHECKLIST, ctx, { filename: "checklist.js" });
  if (awal.__tersembunyi !== true) vm.runInContext(BUKA_SEMUA, ctx);
  const ubahSimpanan = (isi: Record<string, unknown>) => w.chrome.storage.local.set(isi);
  return { w, minta, ubahSimpanan };
}

type H = ReturnType<typeof buka>;
const q = (h: H, p: string) => {
  const a = h.w.document.querySelector("aleta-cm-widget");
  return a && a.shadowRoot ? (a.shadowRoot.querySelector(p) as any) : null;
};
const qs = (h: H, p: string) => {
  const a = h.w.document.querySelector("aleta-cm-widget");
  return (a && a.shadowRoot ? Array.from(a.shadowRoot.querySelectorAll(p)) : []) as any[];
};

describe("widget ALETA: kotak Kehadiran sidang hari ini", () => {
  it("Lama: tidak ada kotak dan tidak ada permintaan", async () => {
    const h = buka({});
    await sampai(() => q(h, ".aleta-cm-kelompok") || q(h, ".aleta-cm-isi"), "widget Lama");
    await tunggu(150);
    expect(q(h, "[data-kehadiran-widget]")).toBeNull();
    expect(h.minta).toEqual([]);
  });

  it("UI Baru: satu kotak, kalimat dan warna dari portal, satu permintaan", async () => {
    const h = buka({ ujiTampilan: "ui" });
    await sampai(() => qs(h, ".aleta-cmw-kh-chip").length === 4, "empat lencana kehadiran");
    expect(q(h, "[data-kehadiran-widget]").textContent).toContain("Kehadiran sidang hari ini");
    expect(q(h, ".aleta-cmw-kh-nomor").textContent).toBe("11/Pdt.G/2026/PA.Dgl");
    expect(q(h, ".aleta-cmw-kh-ket").textContent).toBe("antrian 3 · jadwal 09.00 · Ruang Sidang 1");
    expect(qs(h, ".aleta-cmw-kh-chip").map((c) => [c.textContent, c.getAttribute("data-nada")])).toEqual([
      ["Penggugat hadir 08.47", "hijau"],
      ["Tergugat belum", "abu"],
      ["Saksi P 1/2", "kuning"],
      ["sedang disidang R1", "biru"],
    ]);
    expect(q(h, ".aleta-cmw-kh-perkara").getAttribute("data-sedang")).toBe("ya");
    expect(h.minta).toEqual([API_KH]);
    // Tanpa istilah teknis di layar.
    expect(q(h, "[data-kehadiran-widget]").textContent).not.toMatch(/pihak_1|undefined|null|sandi/);
  });

  it("Baru: kotak di atas checklist", async () => {
    const h = buka({ ujiTampilan: "baru" });
    await sampai(() => q(h, ".aleta-cmw-tumpuk-klasik [data-kehadiran-widget] .aleta-cmw-kh-chip"), "kotak di tumpukan Baru");
  });

  it("butir 41 + 23 Okt: saklar belum disentuh = MENYALA di UI Baru, tetapi kotak TERSEMBUNYI sampai dipilih dari gelembung; lalu terbentang di dok kiri bawah dengan jumlah di kepala", async () => {
    const h = buka({ ujiTampilan: "ui", widgetKehadiran: undefined, __tersembunyi: true });
    await sampai(() => q(h, ".aleta-cmw-lencana"), "gelembung");
    await sampai(() => h.minta.includes(API_KH), "data kehadiran tetap diminta");
    expect(q(h, "[data-kehadiran-widget]")).toBeNull();
    q(h, ".aleta-cmw-lencana").click();
    await sampai(() => q(h, '[data-menu-bagian="kehadiran"]'), "menu");
    q(h, '[data-menu-bagian="kehadiran"]').click();
    const kotak = await sampai(() => q(h, ".aleta-cmw-dok [data-kehadiran-widget]"), "kotak di dok");
    expect(kotak.getAttribute("data-terbuka")).toBe("ya");
    await sampai(() => /1 sidang/.test(kotak.querySelector(".aleta-lipat-ringkas")?.textContent || ""), "jumlah di kepala");
  });

  it("23 Okt: ingatan lama 'terbuka' tidak memunculkan kotak di muat halaman; sekali dipilih bertahan (juga saat setelan berubah), dapat dilipat dan disembunyikan dengan ×; tidak ditulis ke sesi tab", async () => {
    const h = buka({ ujiTampilan: "ui", widgetKehadiran: undefined, lipatTerbuka: { "widget:kehadiran": true }, __tersembunyi: true });
    await sampai(() => q(h, ".aleta-cmw-lencana"), "gelembung");
    await tunggu(80);
    expect(q(h, "[data-kehadiran-widget]")).toBeNull();
    h.w.document.dispatchEvent(new h.w.CustomEvent("aleta-widget-tampilkan", { detail: { bagian: "kehadiran" } }));
    const kotak = await sampai(() => q(h, ".aleta-cmw-dok [data-kehadiran-widget]"), "kotak di dok");
    expect(kotak.getAttribute("data-terbuka")).toBe("ya");
    expect(h.w.sessionStorage.getItem("aleta-panel-terbuka:widget:kehadiran")).toBeNull();
    await h.ubahSimpanan({ widgetKehadiran: true });
    await tunggu(120);
    expect(q(h, "[data-kehadiran-widget]").getAttribute("data-terbuka")).toBe("ya");
    q(h, "[data-kehadiran-widget] .aleta-lipat-kepala").click();
    expect(q(h, "[data-kehadiran-widget]").getAttribute("data-terbuka")).toBe("tidak");
    q(h, "[data-kehadiran-widget] .aleta-cmw-tutup-kotak").click();
    await sampai(() => !q(h, "[data-kehadiran-widget]"), "kotak disembunyikan oleh x");
  });

  it("saklar popup dimatikan: tanpa kotak dan tanpa permintaan; dinyalakan tanpa muat ulang", async () => {
    const h = buka({ ujiTampilan: "ui", widgetKehadiran: false });
    await sampai(() => q(h, ".aleta-cmw-dok"), "dok UI Baru");
    await tunggu(150);
    expect(q(h, "[data-kehadiran-widget]")).toBeNull();
    expect(h.minta).toEqual([]);
    await h.ubahSimpanan({ widgetKehadiran: true });
    await sampai(() => qs(h, ".aleta-cmw-kh-chip").length === 4, "kotak muncul sesudah saklar dinyalakan");
    await h.ubahSimpanan({ widgetKehadiran: false });
    await sampai(() => !q(h, "[data-kehadiran-widget]"), "kotak hilang sesudah saklar dimatikan");
  });

  it("belum masuk portal: kalimat awam", async () => {
    const h = buka({ ujiTampilan: "ui" }, 401);
    await sampai(() => /Masuk ke portal ALETA dulu/.test(q(h, "[data-kehadiran-widget]")?.textContent || ""), "kalimat belum masuk");
  });
});
