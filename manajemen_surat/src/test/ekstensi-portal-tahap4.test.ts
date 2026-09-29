// @vitest-environment node
/**
 * ============================================================================
 * TAHAP 4 RENCANA "EKSTENSI DULU" - PANEL EKSTENSI DI PORTAL ALETA
 * ============================================================================
 *
 * panel-alat.js dan aleta.js dijalankan SUNGGUHAN di satu konteks vm jendela
 * jsdom beralamat portal - urutan yang sama dengan manifest. Yang ditiru hanya
 * tepi luarnya: chrome.storage dan jawaban portal.
 *
 * Yang dijaga, menurut pentingnya:
 *   1. Tampilan Lama IDENTIK - saklar fitur yang tersimpan menyala, letak
 *      samping, dan layar publik yang tersimpan pun tidak mengubah satu
 *      karakter pun DOM panelnya, tidak menambah satu permintaan pun.
 *   2. Ide portal-N hanya tampil bila saklarnya menyala.
 *   3. Letak samping menggeser halaman lewat atribut <html>, dan melepasnya
 *      saat panel diciutkan, dipilih mengambang, atau kembali ke Lama.
 *   4. Layar publik menyamarkan nama pihak.
 *   5. Panel tetap hanya MEMBACA portal (GET/HEAD), dan jawaban 423 mode coba
 *      disebut apa adanya - tidak berpura-pura berhasil.
 *   6. Dua rute baca baru: /ekstensi-panel/catatan dan /ekstensi-panel/sambungan.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import { CATATAN_EKSTENSI } from "@/lib/catatan-ekstensi";
import { APP_VERSION } from "@/lib/patch-notes";

const EKSTENSI = path.resolve(process.cwd(), "../ekstensi-sipp");
const baca = (berkas: string) => readFileSync(path.join(EKSTENSI, berkas), "utf8").replace(/\r\n/g, "\n");
const SUMBER_ALAT = baca("panel-alat.js");
const SUMBER_ALETA = baca("aleta.js");
const GAYA = baca("panel.css");

const ASAL = "http://192.168.10.10";
const tunggu = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const polos = <T>(x: T): T => (x === undefined ? x : JSON.parse(JSON.stringify(x)));

async function sampai<T>(periksa: () => T, keterangan: string, batas = 4000): Promise<NonNullable<T>> {
  const mulai = Date.now();
  for (;;) {
    let hasil: T | undefined;
    try {
      hasil = periksa();
    } catch {
      hasil = undefined;
    }
    if (hasil) return hasil as NonNullable<T>;
    if (Date.now() - mulai > batas) throw new Error(`tidak tercapai: ${keterangan}`);
    await tunggu(10);
  }
}

// ----------------------------------------------------------------------------
// Jawaban portal tiruan
// ----------------------------------------------------------------------------
const SIAPA = {
  nama: "Derry Briantono",
  peran: "Super Admin",
  roleId: "super-admin",
  peranTambahan: ["hakim"],
  kapabilitas: { panel: true, berkas: true, kerjakan: false },
  keterangan: {
    panel: { label: "Panel di halaman SIPP", penjelasan: "Melihat panel ALETA di SIPP." },
    berkas: { label: "Unduh berkas e-Court", penjelasan: "Mengunduh berkas e-Court." },
    kerjakan: { label: "Tombol Kerjakan", penjelasan: "Menulis ke SIPP." },
  },
  menu: [
    { href: "/admin/aleta-ecourt", label: "Integrasi e-Court", keterangan: "kewenangan ekstensi dan pengaturan" },
    { href: "/aleta-sipp", label: "ALETA x SIPP", keterangan: "penetapan dan penunjukan" },
    { href: "/admin/pembaruan-sistem", label: "Pembaruan Sistem", keterangan: "versi dan cadangan" },
  ],
  bolehMengatur: true,
  versiEkstensi: "1.172.0",
  dirilis: "2026-09-29T16:10:00+08:00",
  versiTipe: null,
};

const RIWAYAT = [
  { nomor: "459/Pdt.G/2026/PA.Dgl", url: `${ASAL}/SIPP/perkara_detil_agama/AAA`, jenis: "Cerai Gugat", waktu: new Date().toISOString() },
  { nomor: "548/Pdt.G/2026/PA.Dgl", url: `${ASAL}/SIPP/perkara_detil_agama/BBB`, jenis: "Cerai Talak", waktu: new Date().toISOString() },
];

const CHECKLIST = {
  pengguna: { nama: "Derry Briantono", peran: ["hakim", "operator"] },
  peranTersedia: [
    { kunci: "hakim", label: "Hakim" },
    { kunci: "operator", label: "Operator" },
  ],
  peranAktif: "hakim",
  dibuat: new Date().toISOString(),
  ringkas: { lewat: 1, hariIni: 2, mingguIni: 3, selesaiHariIni: 1, totalHariIni: 3 },
  butir: [
    {
      id: "a",
      jenis: "pmh",
      judul: "PMH belum ditetapkan",
      perkara: { id: "1", nomor: "459/Pdt.G/2026/PA.Dgl" },
      tenggat: null,
      kelompok: "lewat",
      keterangan: "terlambat 1 hari",
      kerjakan: { tujuan: "sipp", halaman: "penetapan" },
    },
  ],
  jenisTidakTersedia: [],
  galat: [],
};

const PIHAK_ASLI = "Sri Rahayu binti Ikhsan";
const CARI = {
  available: true,
  perkara: [
    {
      perkaraId: "10018",
      nomorPerkara: "544/Pdt.G/2026/PA.Dgl",
      jenisPerkara: "Cerai Gugat",
      tanggalDaftar: "2026-09-01",
      sudahPutus: false,
      tanggalPutusan: "",
      tahapan: "Putusan",
      pihak1: PIHAK_ASLI,
      pihak2: "Hasan bin Mahmud",
    },
  ],
  adaLagi: false,
};

type Jawab = { status?: number; isi?: unknown };
type Pengganti = (url: string, cara: string) => Jawab | undefined;

function jawabBaku(url: string, cara: string): Jawab {
  if (cara === "HEAD") return { status: 200, isi: {} };
  if (url.includes("/ekstensi/siapa")) return { isi: { ok: true, data: SIAPA } };
  if (url.includes("/ekstensi-panel/catatan"))
    return {
      isi: {
        ok: true,
        data: {
          versiPortal: "2.40.1",
          versiEkstensi: "1.172.0",
          catatan: [
            { versi: "1.172.0", dirilis: "2026-09-29T16:10:00+08:00", judul: "Fondasi tampilan baru" },
            { versi: "1.171.0", dirilis: "2026-09-27T10:30:00+08:00", judul: "Panel tidak tampil di layar publik" },
          ],
        },
      },
    };
  if (url.includes("/ekstensi-panel/sambungan"))
    return {
      isi: {
        ok: true,
        data: {
          versiPortal: "2.40.1",
          bot: { hidup: true, ms: 40 },
          whatsapp: { keadaan: "tersambung", sebab: "" },
          ecourt: { keadaan: "hidup", sebab: "" },
        },
      },
    };
  if (url.includes("/aleta-ecourt/checklist")) return { isi: { ok: true, data: CHECKLIST } };
  if (url.includes("/aleta-ecourt/status-perkara")) return { isi: { ok: true, data: CARI } };
  if (url.includes("/api/tasks"))
    return {
      isi: {
        ok: true,
        data: {
          summary: { total: 1, unread: 1, urgent: 0 },
          sources: [{ tasks: [{ title: "5 penetapan menunggu", sourceLabel: "ALETA", href: "/aleta-sipp", seen: false }] }],
        },
      },
    };
  if (url.includes("/aleta-ecourt/sidang")) return { isi: { ok: true, data: { available: true, sidang: [] } } };
  return { isi: { ok: true, data: {} } };
}

function tanggapan(status: number, isi: unknown) {
  const r = { ok: status >= 200 && status < 300, status, statusText: "", json: async () => polos(isi), clone: () => r };
  return r;
}

// ----------------------------------------------------------------------------
// Halaman portal dengan panel-alat.js + aleta.js
// ----------------------------------------------------------------------------
type Ubah = Record<string, { oldValue?: unknown; newValue?: unknown }>;
type Halaman = {
  dom: JSDOM;
  w: any;
  simpanan: Record<string, unknown>;
  minta: Array<{ url: string; cara: string }>;
  jam: number[];
  setel: (isi: Record<string, unknown>) => Promise<void>;
  tersalin: string[];
};

const terbuka: JSDOM[] = [];
afterEach(async () => {
  await tunggu(20);
  while (terbuka.length) terbuka.pop()!.window.close();
});

function buka(p: { simpanan?: Record<string, unknown>; ganti?: Pengganti } = {}): Halaman {
  const dom = new JSDOM(`<!doctype html><html><head></head><body><main><table><tr><td>isi</td></tr></table></main></body></html>`, {
    url: `${ASAL}/aleta/aleta-ecourt`,
    runScripts: "outside-only",
    pretendToBeVisual: true,
  } as ConstructorParameters<typeof JSDOM>[1]);
  terbuka.push(dom);
  const w = dom.window as any;
  const simpanan: Record<string, unknown> = polos(p.simpanan ?? {});
  const pendengar: Array<(u: Ubah, wilayah: string) => void> = [];
  const siarkan = (ubah: Ubah) => {
    if (Object.keys(ubah).length === 0) return;
    setTimeout(() => {
      for (const f of [...pendengar]) f(polos(ubah), "local");
    }, 0);
  };
  const local = {
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
      siarkan(ubah);
    },
    remove: async () => undefined,
  };
  w.chrome = {
    runtime: {
      id: "aleta-uji",
      getManifest: () => ({ version: "1.172.0" }),
      getURL: (x: string) => `chrome-extension://aleta-uji/${x}`,
      sendMessage: async () => ({}),
    },
    storage: {
      local,
      session: { get: async () => ({}), set: async () => undefined },
      onChanged: { addListener: (f: (u: Ubah, wilayah: string) => void) => void pendengar.push(f) },
    },
  };
  const minta: Array<{ url: string; cara: string }> = [];
  w.fetch = (alamat: string, opsi?: { method?: string }) => {
    const url = String(alamat);
    const cara = String(opsi?.method || "GET").toUpperCase();
    minta.push({ url, cara });
    const j = (p.ganti && p.ganti(url, cara)) || jawabBaku(url, cara);
    return Promise.resolve(tanggapan(j.status ?? 200, j.isi));
  };
  const jam: number[] = [];
  const setIntervalAsli = w.setInterval.bind(w);
  w.setInterval = (f: () => void, ms: number) => {
    jam.push(ms);
    return setIntervalAsli(f, ms);
  };
  // jsdom belum mengenal keduanya; peramban sungguhan mengenalnya.
  w.Element.prototype.scrollIntoView = function () {};
  const tersalin: string[] = [];
  w.document.execCommand = (perintah: string) => {
    if (perintah !== "copy") return false;
    const kotak = w.document.querySelector("textarea[readonly]");
    tersalin.push(kotak ? kotak.value : "");
    return true;
  };
  // Tautan ber-target _blank tidak dinavigasikan jsdom.
  w.document.addEventListener("click", (e: any) => {
    if (e.target && e.target.closest && e.target.closest("a")) e.preventDefault();
  });
  // src/test/jsdom.d.ts tidak mendeklarasikan konteks vm halaman - sama
  // dengan ekstensi-checklist-milestone.test.ts, ditambahkan di sini saja.
  const ctx = (dom as JSDOM & { getInternalVMContext(): vm.Context }).getInternalVMContext();
  vm.runInContext(SUMBER_ALAT, ctx, { filename: "panel-alat.js" });
  vm.runInContext(SUMBER_ALETA, ctx, { filename: "aleta.js" });
  return { dom, w, simpanan, minta, jam, setel: (isi) => local.set(isi), tersalin };
}

const panelDari = (h: Halaman) => h.w.document.getElementById("aleta-panel-portal") as any;
const akar = (h: Halaman) => h.w.document.documentElement as any;
const panelLahir = (h: Halaman) => sampai(() => panelDari(h), "panel portal lahir");
/** Panel yang sudah ditata Tahap 4 dalam tampilan yang diharapkan. */
const panelTertata = (h: Halaman, jenis: "baru" | "ui") =>
  sampai(() => {
    const p = panelDari(h);
    return p && p.getAttribute("data-t4") === jenis ? p : null;
  }, `panel ditata (${jenis})`);

function semuaFiturPortal(): Record<string, boolean> {
  const f: Record<string, boolean> = {};
  for (let i = 1; i <= 30; i += 1) f[`portal-${i}`] = true;
  return f;
}

/** Permintaan yang hanya dapat berasal dari blok Tahap 4 aleta.js. */
function mintaTahap4(h: Halaman) {
  return h.minta
    .filter(
      (m) =>
        m.cara === "HEAD" ||
        /\/ekstensi-panel\/|\/aleta-ecourt\/checklist|\/api\/tasks|\/status-perkara|\/aleta-ecourt\/sidang|\/sipp-tautan/.test(m.url)
    )
    .map((m) => `${m.cara} ${m.url.replace(ASAL, "")}`);
}

function tekanAlt(h: Halaman, kunci: string) {
  h.w.document.dispatchEvent(new h.w.KeyboardEvent("keydown", { key: kunci, altKey: true, bubbles: true, cancelable: true }));
}

// ============================================================================
describe("SYARAT MUTLAK: tampilan Lama identik", () => {
  it("saklar fitur, letak samping, dan layar publik yang tersimpan tidak mengubah satu karakter pun", async () => {
    const polosan = buka({ simpanan: { riwayatPerkaraSipp: RIWAYAT } });
    const panelPolos = await panelLahir(polosan);
    await tunggu(150);

    const tersimpan = buka({
      simpanan: {
        riwayatPerkaraSipp: RIWAYAT,
        ujiTampilan: "lama",
        ujiFitur: semuaFiturPortal(),
        letakPanelPortal: "samping",
        modeLayarPublik: true,
        sematanPerkaraPortal: ["548/Pdt.G/2026/PA.Dgl"],
      },
    });
    const panelLama = await panelLahir(tersimpan);
    await tunggu(150);

    expect(panelLama.outerHTML).toBe(panelPolos.outerHTML);
    // Permintaan yang sama persis dengan halaman tanpa satu pun simpanan uji.
    const daftar = (h: Halaman) => h.minta.map((m) => `${m.cara} ${m.url.replace(ASAL, "")}`).sort();
    expect(daftar(tersimpan)).toEqual(daftar(polosan));
    expect(panelLama.outerHTML).not.toMatch(/data-t4|aleta-t4-/);
    for (const h of [polosan, tersimpan]) {
      expect(akar(h).hasAttribute("data-aleta-portal-letak")).toBe(false);
      expect(akar(h).hasAttribute("data-aleta-kulit")).toBe(false);
      // Tidak satu pun permintaan milik Tahap 4 - panel-alat.js boleh punya
      // bacaannya sendiri, dan itu dibandingkan di bawah.
      expect(mintaTahap4(h)).toEqual([]);
      // Tidak ada pewaktu Tahap 4 - hanya penjaga perpindahan halaman 800 ms.
      expect(h.jam.filter((ms) => ms === 1200 || ms === 30 * 60 * 1000)).toEqual([]);
    }
  });

  it("pintasan kaki tetap empat dalam Lama - Alt+K dan Alt+L tidak ikut", async () => {
    const h = buka({ simpanan: { ujiTampilan: "lama", ujiFitur: semuaFiturPortal() } });
    const panel = await panelLahir(h);
    expect(panel.querySelector(".aleta-kaki-pintasan").textContent).toBe("Alt+A · Alt+P · Alt+R · Alt+Enter");
  });
});

// ============================================================================
describe("ide portal-N hanya tampil bila saklarnya menyala", () => {
  it("Baru tanpa satu saklar pun: tidak ada bagian ide, dan tidak ada permintaan tambahan", async () => {
    const h = buka({ simpanan: { ujiTampilan: "baru", ujiFitur: { "sipp-5": true } } });
    const panel = await panelTertata(h, "baru");
    await tunggu(100);
    expect(panel.querySelectorAll("[data-t4-fitur]").length).toBe(0);
    expect(panel.querySelector(".aleta-t4-tabbar")).toBeNull();
    expect(mintaTahap4(h)).toEqual([]);
  });

  it("portal-13 menyala: kotak cari ada, bagian lain tidak; Alt+K ikut di kaki", async () => {
    const h = buka({ simpanan: { ujiTampilan: "baru", ujiFitur: { "portal-13": true } } });
    const panel = await panelTertata(h, "baru");
    expect(panel.querySelectorAll('[data-t4-fitur="portal-13"]').length).toBe(1);
    expect(panel.querySelector('[data-t4-fitur="portal-14"]')).toBeNull();
    expect(panel.querySelector('[data-t4-fitur="portal-11"]')).toBeNull();
    expect(panel.querySelector(".aleta-kaki-pintasan").textContent).toContain("Alt+K");
  });

  it("saklar dinyalakan SELAGI halaman terbuka: panel disusun ulang tanpa memuat ulang", async () => {
    const h = buka({ simpanan: { ujiTampilan: "baru", ujiFitur: {} } });
    await panelTertata(h, "baru");
    await h.setel({ ujiFitur: { "portal-14": true } });
    const panel = await sampai(() => panelDari(h)?.querySelector('[data-t4-fitur="portal-14"]') && panelDari(h), "bagian sambungan muncul");
    await sampai(() => panel.querySelector(".aleta-t4-pita"), "pita sambungan terisi");
    expect(panel.querySelector(".aleta-t4-pita").textContent).toContain("Semua tersambung");
  });
});

// ============================================================================
describe("portal-8 / D1: letak samping menggeser halaman, dan melepasnya", () => {
  it("Baru + portal-8: bawaannya samping; kembali ke Lama melepas atributnya dan panel lama kembali", async () => {
    const h = buka({ simpanan: { ujiTampilan: "baru", ujiFitur: { "portal-8": true } } });
    await panelTertata(h, "baru");
    await sampai(() => akar(h).getAttribute("data-aleta-portal-letak") === "samping", "atribut samping terpasang");

    await h.setel({ ujiTampilan: "lama" });
    await sampai(() => !akar(h).hasAttribute("data-aleta-portal-letak"), "atribut samping dilepas");
    const panel = await sampai(() => {
      const p = panelDari(h);
      return p && !p.hasAttribute("data-t4") ? p : null;
    }, "panel lama disusun ulang");
    expect(panel.outerHTML).not.toMatch(/aleta-t4-/);
  });

  it("UI Baru tanpa portal-8: tetap berlabuh di samping (perbaikan desain D1)", async () => {
    const h = buka({ simpanan: { ujiTampilan: "ui", ujiFitur: {} } });
    await panelTertata(h, "ui");
    await sampai(() => akar(h).getAttribute("data-aleta-portal-letak") === "samping", "samping di UI Baru");
  });

  it("diciutkan ke lencana: halaman kembali selebar semula", async () => {
    const h = buka({ simpanan: { ujiTampilan: "baru", ujiFitur: { "portal-8": true } } });
    const panel = await panelTertata(h, "baru");
    await sampai(() => akar(h).getAttribute("data-aleta-portal-letak") === "samping", "samping");
    panel.querySelector(".aleta-lipat").click();
    await sampai(() => !akar(h).hasAttribute("data-aleta-portal-letak"), "dilepas saat menjadi lencana");
  });

  it("memilih Mengambang melepas atributnya dan menyimpan pilihannya", async () => {
    const h = buka({ simpanan: { ujiTampilan: "baru", ujiFitur: { "portal-8": true } } });
    const panel = await panelTertata(h, "baru");
    await sampai(() => akar(h).getAttribute("data-aleta-portal-letak") === "samping", "samping");
    panel.querySelector('.aleta-t4-letak-pilih[data-t4-letak="mengambang"]').click();
    await sampai(() => !akar(h).hasAttribute("data-aleta-portal-letak"), "mengambang");
    await sampai(() => h.simpanan.letakPanelPortal === "mengambang", "pilihan tersimpan");
  });

  it("panel yang ditutup (saklar induk mati) ikut melepas atributnya", async () => {
    const h = buka({ simpanan: { ujiTampilan: "baru", ujiFitur: { "portal-8": true } } });
    await panelTertata(h, "baru");
    await sampai(() => akar(h).getAttribute("data-aleta-portal-letak") === "samping", "samping");
    await h.setel({ aktif: false });
    await sampai(() => !panelDari(h) && !akar(h).hasAttribute("data-aleta-portal-letak"), "panel dan atribut hilang");
  });
});

// ============================================================================
describe("portal-28: mode layar publik menyamarkan nama pihak", () => {
  async function cari(h: Halaman, kata: string) {
    const panel = panelDari(h);
    const masukan = panel.querySelector(".aleta-t4-cari-masukan");
    masukan.value = kata;
    panel.querySelector(".aleta-t4-cari").dispatchEvent(new h.w.Event("submit", { cancelable: true, bubbles: true }));
    return sampai(() => panelDari(h).querySelector(".aleta-t4-cari-hasil .aleta-t4-hasil"), "hasil cari");
  }

  it("menyala: pita dan cap PUBLIK tampil, nama pihak disamarkan", async () => {
    const h = buka({ simpanan: { ujiTampilan: "baru", ujiFitur: { "portal-13": true, "portal-28": true }, modeLayarPublik: true } });
    const panel = await panelTertata(h, "baru");
    expect(panel.querySelector(".aleta-t4-pita-publik").textContent).toContain("nama pihak disamarkan");
    expect(panel.querySelector(".aleta-t4-chip-publik")).not.toBeNull();
    const hasil = await cari(h, "544");
    expect(hasil.textContent).toContain("Sr*** Ra*** binti Ik***");
    expect(hasil.textContent).toContain("Ha*** bin Ma***");
    expect(panelDari(h).textContent).not.toContain(PIHAK_ASLI);
  });

  it("mati: nama pihak utuh", async () => {
    const h = buka({ simpanan: { ujiTampilan: "baru", ujiFitur: { "portal-13": true, "portal-28": true } } });
    await panelTertata(h, "baru");
    const hasil = await cari(h, "544");
    expect(hasil.textContent).toContain(PIHAK_ASLI);
  });

  it("Alt+L menyalakannya, bertahan di penyimpanan, dan panel disusun ulang bertanda", async () => {
    const h = buka({ simpanan: { ujiTampilan: "baru", ujiFitur: { "portal-28": true } } });
    await panelTertata(h, "baru");
    tekanAlt(h, "l");
    await sampai(() => h.simpanan.modeLayarPublik === true, "tersimpan menyala");
    await sampai(() => panelDari(h)?.querySelector(".aleta-t4-pita-publik"), "pita publik muncul");
    await sampai(() => panelDari(h)?.querySelector(".aleta-t4-kabar")?.textContent.includes("MENYALA"), "kabar menyebutnya");
  });

  it("saklar portal-28 mati: nilai tersimpan diabaikan, Alt+L tidak berbuat apa-apa", async () => {
    const h = buka({ simpanan: { ujiTampilan: "baru", ujiFitur: { "portal-13": true }, modeLayarPublik: true } });
    const panel = await panelTertata(h, "baru");
    expect(panel.querySelector(".aleta-t4-pita-publik")).toBeNull();
    tekanAlt(h, "l");
    await tunggu(60);
    expect(h.simpanan.modeLayarPublik).toBe(true);
    const hasil = await cari(h, "544");
    expect(hasil.textContent).toContain(PIHAK_ASLI);
  });
});

// ============================================================================
describe("hanya membaca portal, dan mode coba disebut jujur", () => {
  it("UI Baru dengan SEMUA ide portal menyala dan dijelajahi: setiap permintaan GET atau HEAD", async () => {
    const h = buka({
      simpanan: {
        ujiTampilan: "ui",
        ujiFitur: semuaFiturPortal(),
        riwayatPerkaraSipp: RIWAYAT,
      },
    });
    const panel = await panelTertata(h, "ui");
    await tunggu(120);
    // Tab, menu, cari, sematan, atur urutan, peran, catatan, bantuan.
    for (const t of Array.from(panel.querySelectorAll(".aleta-t4-tab")) as any[]) t.click();
    panel.querySelector(".aleta-t4-menu-tombol").click();
    const masukan = panel.querySelector(".aleta-t4-cari-masukan");
    masukan.value = "544";
    panel.querySelector(".aleta-t4-cari").dispatchEvent(new h.w.Event("submit", { cancelable: true, bubbles: true }));
    await sampai(() => panel.querySelector(".aleta-t4-hasil"), "hasil cari");
    panel.querySelector(".aleta-t4-pin").click();
    await sampai(() => Array.isArray(h.simpanan.sematanPerkaraPortal), "sematan tersimpan");
    const atur = (Array.from(panelDari(h).querySelectorAll(".aleta-t4-tombol")) as any[]).find((b) => /Atur urutan/.test(b.textContent));
    atur.click();
    await sampai(() => panelDari(h).querySelector(".aleta-t4-peran-pilih"), "tombol peran");
    const catatan = panelDari(h).querySelector(".aleta-t4-catatan-teks");
    catatan.value = "Telepon juru sita";
    catatan.dispatchEvent(new h.w.Event("input", { bubbles: true }));
    await sampai(() => h.simpanan.catatanTempelPortal, "catatan tersimpan", 3000);
    panelDari(h).querySelector(".aleta-t4-tanya").click();

    const caraLain = h.minta.filter((m) => m.cara !== "GET" && m.cara !== "HEAD");
    expect(caraLain, JSON.stringify(caraLain)).toEqual([]);
    // Dan yang dibaca memang rute-rute baca.
    const jalur = new Set(h.minta.filter((m) => m.cara === "GET").map((m) => m.url.replace(ASAL, "").split("?")[0]));
    for (const j of jalur) expect(j).toMatch(/^\/aleta\/api\/(aleta-ecourt\/|tasks$)/);
  });

  it("jawaban 423 mode coba: kalimatnya ditampilkan, bukan hasil kosong yang berpura-pura berhasil", async () => {
    const PESAN = "Mode coba aktif - Super Admin sedang mencoba tampilan baru, jadi tidak ada yang dikirim atau disimpan.";
    const h = buka({
      simpanan: { ujiTampilan: "baru", ujiFitur: { "portal-13": true } },
      ganti: (url) => (url.includes("status-perkara") ? { status: 423, isi: { ok: false, alasan: "mode_coba", pesan: PESAN } } : undefined),
    });
    const panel = await panelTertata(h, "baru");
    panel.querySelector(".aleta-t4-cari-masukan").value = "544";
    panel.querySelector(".aleta-t4-cari").dispatchEvent(new h.w.Event("submit", { cancelable: true, bubbles: true }));
    const kabar = await sampai(() => panel.querySelector(".aleta-t4-cari-hasil .aleta-t4-belum"), "kabar mode coba");
    expect(kabar.textContent).toBe(PESAN);
  });

  it("aleta.js tetap tanpa satu pun method POST/PUT/PATCH/DELETE", () => {
    const tanpaCatatan = SUMBER_ALETA.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "");
    expect(tanpaCatatan).not.toMatch(/method:\s*"(POST|PUT|PATCH|DELETE)"/);
  });
});

// ============================================================================
describe("UI Baru: tab (D3), menu berlabel (D2), dan fitur lama tetap terjangkau", () => {
  it("empat tab, tab Akun memuat Ekstensi; tombol lama tetap ada di DOM dan dapat dicapai dari menu ⋯", async () => {
    const h = buka({ simpanan: { ujiTampilan: "ui", ujiFitur: {}, riwayatPerkaraSipp: RIWAYAT } });
    const panel = await panelTertata(h, "ui");
    const tab = (Array.from(panel.querySelectorAll(".aleta-t4-tab")) as any[]).map((t) => t.textContent);
    // Perkara kosong tanpa ide portal-13/19/20/25/26 - tab kosong tidak digambar.
    expect(tab).toEqual(["Beranda", "Pintasan", "Akun"]);
    expect(panel.getAttribute("data-t4-tab-aktif")).toBe("beranda");
    panel.querySelector('.aleta-t4-tab[data-t4-ke="akun"]').click();
    expect(panel.getAttribute("data-t4-tab-aktif")).toBe("akun");
    expect(panel.querySelector('[data-t4-tab="akun"] .aleta-portal-versi')).not.toBeNull();
    // D7: kalimat pertama bagian Ekstensi.
    expect(panel.querySelector(".aleta-t4-terbaru").textContent).toContain("Ekstensi terbaru ✓");

    // Fitur lama: seluruh tombol kepala masih ada; menu memberi mereka nama.
    for (const kelas of [".aleta-tema", ".aleta-lipat", ".aleta-penuh", ".aleta-bawaan", ".aleta-matikan"]) {
      expect(panel.querySelector(kelas), kelas).not.toBeNull();
    }
    const butir = (Array.from(panel.querySelectorAll(".aleta-t4-menu-butir .aleta-t4-menu-teks")) as any[]).map((x) => x.textContent);
    expect(butir).toEqual(
      expect.arrayContaining(["Tema gelap / terang", "Ciutkan ke lencana", "Layar penuh", "Kembalikan posisi dan ukuran", "Tutup panel", "Muat ulang panel"])
    );
    // D5: tiap baris Terakhir dibuka punya SIPP ↗ dan ABT ↗.
    const baris = panel.querySelector(".aleta-t4-riwayat li");
    expect(baris.textContent).toContain("SIPP ↗");
    expect(baris.textContent).toContain("ABT ↗");
    expect(panel.querySelector('[data-t4-tab="beranda"] .aleta-bagian-judul').textContent).toBe("Terakhir dibuka");

    // Butir menu meneruskan ke tombol lama - ciutkan sungguh menciutkan.
    panel.querySelector(".aleta-t4-menu-tombol").click();
    const ciut = (Array.from(panel.querySelectorAll(".aleta-t4-menu-butir")) as any[]).find((b) => /Ciutkan/.test(b.textContent));
    ciut.click();
    expect(panel.classList.contains("aleta-panel-lencana")).toBe(true);
  });

  it("Alt+Enter di UI Baru membuka tab Akun lebih dahulu - tombolnya ada di sana", async () => {
    const h = buka({ simpanan: { ujiTampilan: "ui", ujiFitur: {} } });
    const panel = await panelTertata(h, "ui");
    expect(panel.getAttribute("data-t4-tab-aktif")).toBe("beranda");
    tekanAlt(h, "Enter");
    expect(panel.getAttribute("data-t4-tab-aktif")).toBe("akun");
  });
});

// ============================================================================
describe("isi ide per bagian", () => {
  it("portal-5 + D10: dikelompokkan, yang tidak dimiliki redup dengan cara memintanya, dan diringkas 'x dari y'", async () => {
    const h = buka({ simpanan: { ujiTampilan: "ui", ujiFitur: { "portal-5": true } } });
    const panel = await panelTertata(h, "ui");
    const judul = (Array.from(panel.querySelectorAll(".aleta-t4-kelompok-judul")) as any[]).map((x) => x.textContent);
    expect(judul).toEqual(["Melihat", "Mengunduh", "Menulis ke SIPP"]);
    expect(panel.querySelector(".aleta-t4-lipat-kewenangan > summary").textContent).toContain("2 dari 3 kewenangan dimiliki");
    const tidak = panel.querySelector(".aleta-t4-kewenangan .aleta-portal-tidak");
    expect(tidak.textContent).toContain("Tombol Kerjakan");
    expect(tidak.querySelector(".aleta-t4-minta").textContent).toContain("Hubungi Super Admin");
    // "Atur kewenangan ekstensi" tetap ada.
    expect(panel.textContent).toContain("Atur kewenangan ekstensi");
  });

  it("portal-4: urutan pintasan disimpan PER ORANG, dan yang disembunyikan dapat ditampilkan lagi", async () => {
    const h = buka({ simpanan: { ujiTampilan: "baru", ujiFitur: { "portal-4": true } } });
    const panel = await panelTertata(h, "baru");
    const atur = (Array.from(panel.querySelectorAll(".aleta-t4-tombol")) as any[]).find((b) => /Atur urutan/.test(b.textContent));
    atur.click();
    const pertama = panel.querySelector(".aleta-portal-pintasan li");
    (Array.from(pertama.querySelectorAll(".aleta-t4-tombol")) as any[]).find((b) => b.textContent === "↓").click();
    await sampai(() => (h.simpanan.urutanPintasanPortal as any)?.["derry briantono"], "tersimpan per orang");
    const milik = (h.simpanan.urutanPintasanPortal as any)["derry briantono"];
    expect(milik.urutan.slice(0, 2)).toEqual(["/aleta/aleta-sipp", "/aleta/admin/aleta-ecourt"]);
    const hrefPertama = panel.querySelector(".aleta-portal-pintasan li a").getAttribute("href");
    expect(hrefPertama).toBe("/aleta/aleta-sipp");
    (Array.from(panel.querySelectorAll(".aleta-portal-pintasan li .aleta-t4-tombol")) as any[]).find((b) => b.textContent === "Sembunyikan").click();
    await sampai(() => panel.querySelector(".aleta-t4-sembunyi .aleta-t4-tombol"), "daftar tersembunyi");
    expect(panel.querySelector(".aleta-t4-sembunyi").textContent).toContain("ALETA x SIPP · tampilkan");
  });

  it("portal-16: hanya peran milik akun, dan memilihnya mengganti peran checklist", async () => {
    const h = buka({ simpanan: { ujiTampilan: "baru", ujiFitur: { "portal-16": true, "portal-11": true } } });
    const panel = await panelTertata(h, "baru");
    const tombol = await sampai(() => {
      const t = Array.from(panel.querySelectorAll(".aleta-t4-peran-pilih")) as any[];
      return t.length === 2 ? t : null;
    }, "dua tombol peran");
    expect(tombol.map((t) => t.textContent)).toEqual(["Hakim", "Operator"]);
    expect(tombol[0].getAttribute("aria-pressed")).toBe("true");
    tombol[1].click();
    await sampai(() => h.simpanan.peranChecklistMilestone === "operator", "peran checklist tersimpan");
    await sampai(() => h.minta.some((m) => m.url.includes("/checklist?peran=operator")), "checklist dibaca ulang sebagai operator");
    expect(panel.textContent).toContain("berganti peran portal belum tersedia");
  });

  it("portal-22: salin tautan dijalankan SEREMPAK di dalam klik - sebelum await apa pun", async () => {
    const h = buka({ simpanan: { ujiTampilan: "baru", ujiFitur: { "portal-22": true }, riwayatPerkaraSipp: RIWAYAT } });
    const panel = await panelTertata(h, "baru");
    const salin = await sampai(() => panel.querySelector(".aleta-t4-riwayat li .aleta-t4-kecil"), "tombol salin");
    salin.click();
    // Tanpa menunggu apa pun: papan klip sudah ditulis.
    expect(h.tersalin).toEqual([RIWAYAT[0].url]);
  });

  it("portal-11 dan portal-19: tugas dari checklist; yang datanya belum ada berkata 'belum tersedia'", async () => {
    const h = buka({ simpanan: { ujiTampilan: "baru", ujiFitur: { "portal-11": true, "portal-19": true, "portal-25": true } } });
    const panel = await panelTertata(h, "baru");
    await sampai(() => panel.querySelector('[data-t4-fitur="portal-11"] .aleta-t4-ubin-angka'), "angka tugas");
    expect(panel.querySelector('[data-t4-fitur="portal-11"]').textContent).toContain("PMH belum ditetapkan");
    expect(panel.querySelector('[data-t4-fitur="portal-19"] .aleta-t4-belum').textContent).toMatch(/^Belum tersedia/);
    expect(panel.querySelector('[data-t4-fitur="portal-25"] .aleta-t4-belum').textContent).toMatch(/^Belum tersedia/);
  });

  it("portal-7: lencana SERVER menyebut versi server", async () => {
    const h = buka({ simpanan: { ujiTampilan: "baru", ujiFitur: { "portal-7": true } } });
    const panel = await panelTertata(h, "baru");
    await sampai(() => panel.querySelector(".aleta-lingkungan")?.textContent.includes("ALETA 2.40.1"), "lencana bercerita");
  });

  it("istilah tampilan: 'server' dan 'blangko', bukan 'peladen' dan 'borang'", () => {
    const blok = SUMBER_ALETA.slice(SUMBER_ALETA.indexOf("TAHAP 4 - PANEL PORTAL"), SUMBER_ALETA.indexOf("// ─── Panel ───"));
    const tanpaCatatan = blok.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "");
    expect(tanpaCatatan).not.toMatch(/peladen|borang/i);
  });
});

// ============================================================================
describe("panel.css: blok Tahap 4 seluruhnya bersyarat", () => {
  const i = GAYA.indexOf("PANEL PORTAL - TAHAP 4");
  // Dipotong dari pembuka komentar judulnya, supaya komentar itu ikut terbuang.
  const blok = GAYA.slice(GAYA.lastIndexOf("/*", i)).replace(/\/\*[\s\S]*?\*\//g, "");

  it("blok bertanda ada di akhir berkas", () => {
    expect(i).toBeGreaterThan(0);
    expect(GAYA.lastIndexOf("PANEL PORTAL - TAHAP 4")).toBe(i);
  });

  it("tiap pemilih diawali syarat yang tidak pernah terpenuhi dalam tampilan Lama", () => {
    const salah: string[] = [];
    for (const m of blok.matchAll(/([^{}]+)\{[^{}]*\}/g)) {
      const pemilih = m[1].trim();
      for (const bagian of pemilih.split(",")) {
        const b = bagian.trim();
        if (!/^(#aleta-panel-portal\[data-t4|html\[data-aleta-portal-letak="|html\[data-aleta-kulit="modern"\])/.test(b)) salah.push(b);
      }
    }
    expect(salah).toEqual([]);
  });

  it("tidak ada ukuran huruf yang dipatok, dan tidak ada angka warna selain bayangan", () => {
    expect(blok).not.toMatch(/font-size:\s*[\d.]+px/);
    expect(blok).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});

// ============================================================================
// Rute baca baru
// ============================================================================
let db: AletaDatabase | null = null;
let aktor: string | null = "usr-admin";

vi.mock("@/server/db/client", async (asli) => {
  const modul = await asli<typeof import("@/server/db/client")>();
  return { ...modul, getDatabase: async () => db };
});
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => aktor }));

describe("rute GET /api/aleta-ecourt/ekstensi-panel/*", () => {
  let jawabBot: (url: string) => Promise<Response> = async () => {
    throw new Error("bot mati");
  };
  const envAwal = {
    ALETA_BOT_BASE_URL: process.env.ALETA_BOT_BASE_URL,
    ALETA_BOT_INTERNAL_API_TOKEN: process.env.ALETA_BOT_INTERNAL_API_TOKEN,
    WHATSAPP_RUNTIME_MODE: process.env.WHATSAPP_RUNTIME_MODE,
  };

  beforeEach(async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: true });
    aktor = "usr-admin";
    process.env.ALETA_BOT_BASE_URL = "http://bot-uji:3003";
    process.env.ALETA_BOT_INTERNAL_API_TOKEN = "token-uji";
    delete process.env.WHATSAPP_RUNTIME_MODE;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL) => jawabBot(String(url)))
    );
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    for (const [k, v] of Object.entries(envAwal)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    await db?.close();
    db = null;
  });

  const JSON_BOT = (isi: unknown, status = 200) =>
    new Response(JSON.stringify(isi), { status, headers: { "content-type": "application/json" } });

  async function catatan(kueri = "") {
    const { GET } = await import("@/app/api/aleta-ecourt/ekstensi-panel/catatan/route");
    const r = await GET(new NextRequest(`http://localhost/api/aleta-ecourt/ekstensi-panel/catatan${kueri}`));
    return { status: r.status, isi: (await r.json()) as any };
  }

  async function sambungan() {
    const { GET } = await import("@/app/api/aleta-ecourt/ekstensi-panel/sambungan/route");
    const r = await GET(new NextRequest("http://localhost/api/aleta-ecourt/ekstensi-panel/sambungan"));
    return { status: r.status, isi: (await r.json()) as any, mentah: "" };
  }

  it("catatan: tanpa sesi 401", async () => {
    aktor = null;
    expect((await catatan()).status).toBe(401);
  });

  it("catatan: tiga teratas dari CATATAN_EKSTENSI, hanya versi-dirilis-judul, beserta versi server", async () => {
    const r = await catatan();
    expect(r.status).toBe(200);
    expect(r.isi.data.versiPortal).toBe(APP_VERSION);
    expect(r.isi.data.catatan).toHaveLength(3);
    expect(r.isi.data.catatan[0]).toEqual({
      versi: CATATAN_EKSTENSI[0].versi,
      dirilis: CATATAN_EKSTENSI[0].dirilis,
      judul: CATATAN_EKSTENSI[0].judul,
    });
    expect((await catatan("?batas=500")).isi.data.catatan).toHaveLength(Math.min(10, CATATAN_EKSTENSI.length));
    expect((await catatan("?batas=abc")).isi.data.catatan).toHaveLength(3);
  });

  it("sambungan: tanpa sesi 401, bot tidak dipanggil", async () => {
    aktor = null;
    const panggilan = vi.fn(async () => JSON_BOT({}));
    jawabBot = panggilan;
    expect((await sambungan()).status).toBe(401);
    expect(panggilan).not.toHaveBeenCalled();
  });

  it("sambungan: kata keadaan saja - nomor telepon dan QR tidak pernah ikut", async () => {
    jawabBot = async (url) => {
      if (url.includes("/whatsapp/status"))
        return JSON_BOT({ ok: true, status: "connected", phoneNumber: "6281234567890", sessionName: "aleta", qrAvailable: false });
      if (url.includes("/ecourt/login/status")) {
        expect(url).toContain("periksa=cepat");
        return JSON_BOT({ ok: true, sesi: { tersimpan: true, berlaku: true, alasan: "" }, menunggu: false });
      }
      return JSON_BOT({}, 404);
    };
    const r = await sambungan();
    expect(r.status).toBe(200);
    expect(r.isi.data.whatsapp.keadaan).toBe("tersambung");
    expect(r.isi.data.ecourt.keadaan).toBe("hidup");
    expect(r.isi.data.bot.hidup).toBe(true);
    expect(r.isi.data.versiPortal).toBe(APP_VERSION);
    expect(JSON.stringify(r.isi)).not.toContain("6281234567890");
  });

  it("sambungan: bot mati tetap 200 dengan keadaan 'tidak-diketahui', bukan galat", async () => {
    jawabBot = async () => {
      throw new TypeError("fetch failed");
    };
    const r = await sambungan();
    expect(r.status).toBe(200);
    expect(r.isi.data.bot.hidup).toBe(false);
    expect(r.isi.data.whatsapp.keadaan).toBe("tidak-diketahui");
    expect(r.isi.data.ecourt.keadaan).toBe("tidak-diketahui");
  });

  it("sambungan: sesi e-Court habis disebut habis", async () => {
    jawabBot = async (url) =>
      url.includes("/ecourt/login/status")
        ? JSON_BOT({ ok: true, sesi: { tersimpan: true, berlaku: false, alasan: "kedaluwarsa" }, menunggu: false })
        : JSON_BOT({ ok: true, status: "disconnected" });
    const r = await sambungan();
    expect(r.isi.data.ecourt.keadaan).toBe("habis");
    expect(r.isi.data.whatsapp.keadaan).toBe("terputus");
  });
});
