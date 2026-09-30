// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

/**
 * ============================================================================
 * JEMBATAN HALAMAN <-> EKSTENSI DI aleta.js (KONTRAK K3) - DIJALANKAN
 * ============================================================================
 *
 * aleta.js dimuat SUNGGUHAN ke jendela jsdom beralamat portal
 * (http://127.0.0.1:8056/aleta/...), dengan chrome.runtime tiruan dan dua
 * fungsi panel-alat.js yang disentuhnya di tingkat atas. Pesan halaman
 * dikirim sebagai MessageEvent sungguhan dengan origin dan source yang
 * diatur uji - itulah dua hal yang WAJIB diperiksa jembatan, dan keduanya
 * tidak dapat dipalsukan halaman lain di peramban sungguhan.
 *
 * Bagian terakhir menyambungkan jembatan ke latar.js yang juga SUNGGUHAN
 * (node:vm): halaman -> jembatan -> pekerja latar -> jembatan -> halaman.
 */

const AKAR = path.resolve(__dirname, "../../../ekstensi-sipp");
// ALETA_UJI_ALETA / ALETA_UJI_LATAR hanya dipakai skrip pembukti gigitan: cacat
// dipasang pada SALINAN, bukan pada berkas yang sedang dipakai agen/uji lain.
const SUMBER_ALETA = readFileSync(process.env.ALETA_UJI_ALETA || path.join(AKAR, "aleta.js"), "utf8");
const SUMBER_LATAR = readFileSync(process.env.ALETA_UJI_LATAR || path.join(AKAR, "latar.js"), "utf8");
const ASAL = "http://127.0.0.1:8056";
const VERSI = JSON.parse(readFileSync(path.join(AKAR, "manifest.json"), "utf8")).version as string;

type Kiriman = { data: any; origin: string };

const halamanTerbuka: JSDOM[] = [];

afterEach(() => {
  while (halamanTerbuka.length) halamanTerbuka.pop()!.window.close();
});

/**
 * Satu halaman portal dengan aleta.js terpasang.
 * `teruskan` menggantikan pekerja latar: (pesan, balik, runtime) - ia boleh
 * menyetel runtime.lastError sebelum memanggil balik, seperti Chrome.
 */
function bukaHalaman(
  teruskan?: (pesan: any, balik: (x?: unknown) => void, runtime: any) => void,
  runtimeTambahan: Record<string, unknown> = {},
  akhiranSumber = ""
) {
  const dom = new JSDOM(`<!doctype html><html><head></head><body></body></html>`, {
    url: `${ASAL}/aleta/aleta-ecourt`,
    runScripts: "outside-only",
  });
  halamanTerbuka.push(dom);
  const w = dom.window as any;
  const kiriman: Kiriman[] = [];
  w.postMessage = (data: unknown, origin: string) => kiriman.push({ data, origin });
  const diteruskan: any[] = [];
  const runtime: any = {
    id: "aleta-uji",
    lastError: undefined,
    getManifest: () => ({ version: VERSI }),
    getURL: (p: string) => `chrome-extension://aleta-uji/${p}`,
    sendMessage: (pesan: any, balik: (x?: unknown) => void) => {
      diteruskan.push(JSON.parse(JSON.stringify(pesan)));
      if (teruskan) teruskan(pesan, balik, runtime);
      else balik({ ok: true, gema: pesan.jenis });
    },
    ...runtimeTambahan,
  };
  w.chrome = {
    runtime,
    storage: {
      local: { get: async () => ({}), set: async () => {} },
      onChanged: { addListener: () => {} },
    },
  };
  // Tiga fungsi panel-alat.js yang disentuh aleta.js saat dimuat. Portal
  // menjawab 401 (belum masuk) sehingga panelnya diam - yang diuji jembatannya.
  // Halamannya meja petugas (/aleta/aleta-ecourt), bukan layar publik.
  w.alatCatatAsalPortal = () => {};
  w.alatAmbil = async () => ({ status: 401, ok: false, json: async () => ({}) });
  w.alatHalamanPublikPortal = () => false;
  // akhiranSumber berjalan di LINGKUP yang sama dengan aleta.js - "use strict"
  // membuat eval berlingkup sendiri, jadi fungsinya hanya terjangkau dari sana.
  w.eval(SUMBER_ALETA + akhiranSumber);
  return { dom, w, kiriman, diteruskan, runtime };
}

function dariHalaman(w: any, data: unknown, opsi: { origin?: string; source?: unknown } = {}) {
  const e = new w.MessageEvent("message", {
    data,
    origin: opsi.origin ?? ASAL,
    source: opsi.source === undefined ? w : opsi.source,
  });
  w.dispatchEvent(e);
}

const balasanUntuk = (kiriman: Kiriman[], id: string) => kiriman.filter((k) => k.data && k.data.balasan === id);
const tunggu = () => new Promise((r) => setTimeout(r, 0));

describe("kehadiran ekstensi diumumkan ke halaman", () => {
  it("dataset pada <html> dan satu pesan 'siap' ke asal halaman sendiri", () => {
    const { w, kiriman } = bukaHalaman();
    expect(w.document.documentElement.dataset.aletaEkstensi).toBe(VERSI);
    expect(w.document.documentElement.dataset.aletaRelaas).toBe("1");
    expect(kiriman[0]).toEqual({ data: { sumber: "aleta-ekstensi", jenis: "siap", versi: VERSI }, origin: ASAL });
  });
});

describe("pesan yang sah diteruskan, dan jawabannya kembali ke idPesan yang sama", () => {
  it("relaas-keadaan: diteruskan sebagai aleta-panel beserta asal yang DIHITUNG jembatan", () => {
    const { w, kiriman, diteruskan } = bukaHalaman();
    dariHalaman(w, { sumber: "aleta-portal", jenis: "relaas-keadaan", idPesan: "q1", muatan: {} });
    expect(diteruskan).toEqual([
      { sumber: "aleta-panel", jenis: "relaas-keadaan", asal: ASAL, asalAbt: `${ASAL}/aps_badilag` },
    ]);
    expect(balasanUntuk(kiriman, "q1")).toEqual([
      { data: { sumber: "aleta-ekstensi", balasan: "q1", jawaban: { ok: true, gema: "relaas-keadaan" } }, origin: ASAL },
    ]);
  });

  it("asal dan asalAbt kiriman halaman DIBUANG - termasuk yang diselipkan ke dalam pekerjaan", () => {
    const { w, diteruskan } = bukaHalaman();
    dariHalaman(w, {
      sumber: "aleta-portal",
      jenis: "relaas-mulai",
      idPesan: "m1",
      muatan: {
        asal: "http://jahat.example",
        asalAbt: "http://jahat.example/aps_badilag",
        perintah: "hapus-semua",
        pekerjaan: {
          tanggal: "2026-09-25",
          asal: "http://jahat.example",
          asalAbt: "http://jahat.example/aps_badilag",
          dokumen: [
            {
              kunci: "sidang-ditunda:10120:3:0",
              perkaraId: "10120",
              nomorPerkara: "385/Pdt.G/2026/PA.Dgl",
              golongan: "sidang-ditunda",
              label: "Sidang ditunda - Panggilan sidang lanjutan (T)",
              d: 3,
              berkas: "[JS] 1. Relaas Panggilan Sidang T (Sidang Lanjutan) .rtf",
              nama: "385-Pdt.G-2026-PA.Dgl - panggilan sidang ke-3",
              jurusita: { nama: "Andi Juru Sita", nip: "1990" },
              sisipan: "<script>",
            },
          ],
          dilewati: [],
        },
      },
    });
    expect(diteruskan).toHaveLength(1);
    const p = diteruskan[0];
    expect(p.asal).toBe(ASAL);
    expect(p.asalAbt).toBe(`${ASAL}/aps_badilag`);
    expect(p.pekerjaan.asal).toBe(ASAL);
    expect(p.pekerjaan.asalAbt).toBe(`${ASAL}/aps_badilag`);
    expect(p).not.toHaveProperty("perintah");
    expect(p.pekerjaan.dokumen[0]).not.toHaveProperty("sisipan");
    // Nama blangko TIDAK dirapikan - spasi sebelum ".rtf" adalah bagian namanya.
    expect(p.pekerjaan.dokumen[0].berkas).toBe("[JS] 1. Relaas Panggilan Sidang T (Sidang Lanjutan) .rtf");
    expect(p.pekerjaan.dokumen[0].jurusita).toBe("Andi Juru Sita");
    expect(p.pekerjaan.dokumen[0].d).toBe(3);
  });
});

describe("yang WAJIB ditolak tidak pernah sampai ke pekerja latar", () => {
  const sah = { sumber: "aleta-portal", jenis: "relaas-keadaan", idPesan: "t1", muatan: {} };

  it("source bukan jendela ini", () => {
    const { w, diteruskan, kiriman } = bukaHalaman();
    const lain = new JSDOM("", { url: `${ASAL}/aleta/lain` });
    halamanTerbuka.push(lain);
    dariHalaman(w, sah, { source: lain.window });
    dariHalaman(w, sah, { source: null });
    expect(diteruskan).toEqual([]);
    expect(balasanUntuk(kiriman, "t1")).toEqual([]);
  });

  it("origin bukan asal halaman ini", () => {
    const { w, diteruskan } = bukaHalaman();
    dariHalaman(w, sah, { origin: "http://jahat.example" });
    dariHalaman(w, sah, { origin: "http://127.0.0.1:3000" });
    expect(diteruskan).toEqual([]);
  });

  it("sumber lain - termasuk balasan jembatan sendiri, supaya tidak berputar", () => {
    const { w, diteruskan } = bukaHalaman();
    dariHalaman(w, { ...sah, sumber: "lain" });
    dariHalaman(w, { sumber: "aleta-ekstensi", balasan: "t1", jawaban: { ok: true } });
    dariHalaman(w, "relaas-keadaan");
    expect(diteruskan).toEqual([]);
  });

  it("idPesan bukan string pendek - diabaikan (tidak dapat dibalas)", () => {
    const { w, diteruskan, kiriman } = bukaHalaman();
    for (const idPesan of [undefined, 7, "", "x".repeat(65), { a: 1 }]) dariHalaman(w, { ...sah, idPesan });
    expect(diteruskan).toEqual([]);
    expect(kiriman.filter((k) => k.data.balasan !== undefined)).toEqual([]);
  });

  it("jenis di luar tujuh jenis relaas - dibalas error, TIDAK diteruskan", () => {
    const { w, diteruskan, kiriman } = bukaHalaman();
    for (const jenis of ["perbarui", "muat-ulang", "unduh", "relaas-apa"]) {
      dariHalaman(w, { ...sah, jenis, idPesan: `j-${jenis}` });
      const [b] = balasanUntuk(kiriman, `j-${jenis}`);
      expect(b.data.jawaban.ok, jenis).toBe(false);
      expect(b.data.jawaban.sebab).toContain(jenis);
    }
    expect(diteruskan).toEqual([]);
  });

  it("relaas-mulai tanpa daftar dokumen - dibalas error, TIDAK diteruskan", () => {
    const { w, diteruskan, kiriman } = bukaHalaman();
    dariHalaman(w, { sumber: "aleta-portal", jenis: "relaas-mulai", idPesan: "m0", muatan: { pekerjaan: { dokumen: "semua" } } });
    expect(diteruskan).toEqual([]);
    expect(balasanUntuk(kiriman, "m0")[0].data.jawaban).toMatchObject({ ok: false });
  });
});

describe("halaman TIDAK PERNAH menunggu selamanya", () => {
  const sah = { sumber: "aleta-portal", jenis: "relaas-keadaan", idPesan: "g1", muatan: {} };

  it("chrome.runtime.lastError dibalas { ok:false, sebab } beserta pesannya", () => {
    const { w, kiriman } = bukaHalaman((_p, balik, runtime) => {
      runtime.lastError = { message: "Could not establish connection. Receiving end does not exist." };
      balik(undefined);
      runtime.lastError = undefined;
    });
    dariHalaman(w, sah);
    const [b] = balasanUntuk(kiriman, "g1");
    expect(b.data.jawaban.ok).toBe(false);
    expect(b.data.jawaban.sebab).toContain("Receiving end does not exist");
  });

  it("ekstensi dimuat ulang (skrip konten yatim: runtime.id hilang) dibalas seketika", () => {
    const { w, kiriman, diteruskan } = bukaHalaman(undefined, { id: undefined });
    dariHalaman(w, sah);
    expect(diteruskan).toEqual([]);
    expect(balasanUntuk(kiriman, "g1")[0].data.jawaban).toMatchObject({ ok: false });
    expect(balasanUntuk(kiriman, "g1")[0].data.jawaban.sebab).toMatch(/dimuat ulang/);
  });

  it("sendMessage yang MELEMPAR ('Extension context invalidated') dibalas beserta sebabnya", () => {
    const { w, kiriman } = bukaHalaman(undefined, {
      sendMessage: () => {
        throw new Error("Extension context invalidated.");
      },
    });
    dariHalaman(w, sah);
    const [b] = balasanUntuk(kiriman, "g1");
    expect(b.data.jawaban.ok).toBe(false);
    expect(b.data.jawaban.sebab).toContain("Extension context invalidated.");
  });

  it("pekerja yang menjawab kosong tanpa lastError pun dibalas error, tepat SEKALI", async () => {
    const { w, kiriman } = bukaHalaman((_p, balik) => {
      balik(undefined);
      balik({ ok: true });
    });
    dariHalaman(w, sah);
    await tunggu();
    const b = balasanUntuk(kiriman, "g1");
    expect(b).toHaveLength(1);
    expect(b[0].data.jawaban.ok).toBe(false);
  });
});

// ===========================================================================
// Ujung ke ujung: halaman -> jembatan (aleta.js) -> latar.js -> halaman
// ===========================================================================

function nyalakanLatar(fetchPalsu: (alamat: string, init?: any) => Promise<any>, runtimeTambahan: Record<string, unknown> = {}) {
  const sesi: Record<string, any> = {};
  const lokal: Record<string, any> = {};
  const pendengar: any[] = [];
  const gudang = (isi: Record<string, any>) => ({
    get: async (k: string | string[]) => Object.fromEntries((Array.isArray(k) ? k : [k]).map((x) => [x, isi[x]])),
    set: async (o: Record<string, any>) => void Object.assign(isi, JSON.parse(JSON.stringify(o))),
    remove: async (k: string | string[]) => {
      for (const x of Array.isArray(k) ? k : [k]) delete isi[x];
    },
  });
  const konteks: Record<string, any> = {
    console,
    chrome: {
      runtime: {
        lastError: undefined,
        getManifest: () => ({ version: VERSI }),
        onUpdateAvailable: { addListener: () => {} },
        onMessage: { addListener: (f: any) => pendengar.push(f) },
        ...runtimeTambahan,
      },
      downloads: {
        onDeterminingFilename: { addListener: () => {} },
        onChanged: { addListener: () => {}, removeListener: () => {} },
        download: () => {},
        search: (_q: unknown, b: (x: unknown[]) => void) => b([]),
      },
      storage: { session: gudang(sesi), local: gudang(lokal) },
    },
    fetch: fetchPalsu,
    // Jeda panen dipersingkat: yang diuji di sini jembatannya, jeda diuji di
    // ekstensi-relaas-massal.test.ts dengan jam maya.
    setTimeout: (f: () => void) => setTimeout(f, 0),
    clearTimeout,
    setInterval,
    clearInterval,
    URL,
    URLSearchParams,
    TextDecoder,
    TextEncoder,
    btoa,
    crypto: globalThis.crypto,
  };
  konteks.self = konteks;
  konteks.globalThis = konteks;
  vm.createContext(konteks);
  vm.runInContext(SUMBER_LATAR, konteks, { filename: "latar.js" });
  return { pendengar, sesi };
}

describe("ujung ke ujung dengan latar.js sungguhan", () => {
  async function sambungkan(fetchPalsu: (alamat: string, init?: any) => Promise<any>) {
    const latar = nyalakanLatar(fetchPalsu);
    const halaman = bukaHalaman((pesan, balik) => {
      // Chrome mengirim salinan terserialkan, bersama tab pengirimnya.
      const pengirim = { url: `${ASAL}/aleta/aleta-ecourt`, origin: ASAL };
      let dijawab = false;
      for (const f of latar.pendengar) {
        f(JSON.parse(JSON.stringify(pesan)), pengirim, (x: unknown) => {
          if (dijawab) return;
          dijawab = true;
          balik(JSON.parse(JSON.stringify(x)));
        });
      }
    });
    return { latar, ...halaman };
  }

  async function tungguBalasan(kiriman: Kiriman[], id: string) {
    for (let i = 0; i < 400; i += 1) {
      const b = balasanUntuk(kiriman, id);
      if (b.length) return b[0].data.jawaban;
      await new Promise((r) => setTimeout(r, 5));
    }
    throw new Error(`tidak ada balasan untuk ${id}`);
  }

  it("relaas-panen dan relaas-perkiraan DITOLAK jembatan tanpa menyentuh ABT; relaas-keadaan dijawab pekerja latar", async () => {
    // Dialog tidak memakai keduanya (telaah 25 Sep 2026), dan relaas-panen
    // {paksa:true} dari skrip mana pun di asal portal akan memanen ABT dengan
    // kuki petugas - pintu yang terbuka hanya yang dipakai.
    const diminta: string[] = [];
    const { w, kiriman } = await sambungkan(async (alamat: string) => {
      diminta.push(alamat);
      throw new Error("tidak boleh ada fetch");
    });
    dariHalaman(w, {
      sumber: "aleta-portal",
      jenis: "relaas-panen",
      idPesan: "pn1",
      muatan: { berkas: ["[JS] 3.b. Relaas Panggilan Sidang P dan T.rtf"], paksa: true },
    });
    dariHalaman(w, { sumber: "aleta-portal", jenis: "relaas-perkiraan", idPesan: "p1", muatan: { jumlah: 10 } });
    for (const id of ["pn1", "p1"]) {
      const tolak = await tungguBalasan(kiriman, id);
      expect(tolak.ok, id).toBe(false);
      expect(tolak.sebab, id).toContain("tidak diterima jembatan relaas");
    }
    expect(diminta).toEqual([]);

    dariHalaman(w, { sumber: "aleta-portal", jenis: "relaas-keadaan", idPesan: "k1", muatan: {} });
    const keadaan = await tungguBalasan(kiriman, "k1");
    expect(keadaan).toMatchObject({ ok: true, pekerjaan: null, berjalan: false });
  });

  it("relaas-mulai dengan asalAbt palsu: ABT yang dihubungi tetap ABT seasal halaman, dan 'belum masuk' sampai ke halaman", async () => {
    const diminta: string[] = [];
    const { w, kiriman } = await sambungkan(async (alamat: string) => {
      diminta.push(alamat);
      const url = `${ASAL}/aps_badilag/index.php/login`;
      return { ok: true, status: 200, url, text: async () => `<form action="${url}/signin"><input type="password"></form>` };
    });
    dariHalaman(w, {
      sumber: "aleta-portal",
      jenis: "relaas-mulai",
      idPesan: "m2",
      muatan: {
        pekerjaan: {
          tanggal: "2026-09-25",
          asalAbt: "http://jahat.example/aps_badilag",
          dokumen: [
            {
              kunci: "sidang-pertama:10120:1:0",
              perkaraId: "10120",
              nomorPerkara: "385/Pdt.G/2026/PA.Dgl",
              golongan: "sidang-pertama",
              label: "Panggilan sidang pertama",
              d: 1,
              berkas: "[JS] 3.b. Relaas Panggilan Sidang P dan T.rtf",
              nama: "385 - panggilan",
              jurusita: "Andi",
            },
          ],
          dilewati: [],
        },
      },
    });
    const j = await tungguBalasan(kiriman, "m2");
    expect(j).toMatchObject({ ok: false, perluMasuk: true });
    expect(diminta).toEqual([`${ASAL}/aps_badilag/abt/main/beranda`]);
  });
});

// ===========================================================================
// Tombol Perbarui di panel ALETA selagi putaran cetak relaas belum selesai
// ===========================================================================

describe("tombol Perbarui panel ALETA - aleta.js dan latar.js sungguhan", () => {
  /** Putaran belum selesai seperti yang disimpan latar.js di storage.session. */
  function putaranBelumSelesai() {
    const butir = (keadaan: string, i: number) => ({
      kunci: `sidang-ditunda:${100 + i}:3:0`,
      perkaraId: String(100 + i),
      nomorPerkara: `${100 + i}/Pdt.G/2026/PA.Dgl`,
      keadaan,
    });
    return {
      id: "relaas-uji",
      tanggal: "2026-09-25",
      selesai: false,
      butir: [butir("selesai", 1), butir("selesai", 2), butir("menunggu", 3), butir("menunggu", 4)],
      dilewati: [],
    };
  }

  function pasangPanel(dimuatUlang: { n: number }) {
    const latar = nyalakanLatar(
      async () => {
        throw new Error("tidak boleh ada fetch");
      },
      {
        requestUpdateCheck: async () => ({ status: "update_available", version: "9.9.9" }),
        reload: () => {
          dimuatUlang.n += 1;
        },
      }
    );
    latar.sesi.aletaRelaasMassal = putaranBelumSelesai();
    const dikirim: any[] = [];
    // Bentuk janji chrome.runtime.sendMessage - yang dipakai panel.
    const sendMessage = (pesan: any) =>
      new Promise((selesai) => {
        dikirim.push(JSON.parse(JSON.stringify(pesan)));
        for (const f of latar.pendengar) f(JSON.parse(JSON.stringify(pesan)), {}, selesai);
      });
    const { w } = bukaHalaman(undefined, { sendMessage }, "\n;window.__ujiPanel = { bagianEkstensi };");
    const kotak = w.__ujiPanel.bagianEkstensi({ versiEkstensi: "9.9.9" });
    w.document.body.appendChild(kotak);
    const tombol = kotak.querySelector("button.aleta-tombol") as HTMLButtonElement;
    const kabar = kotak.querySelector(".aleta-portal-sebab") as HTMLElement;
    return { latar, dikirim, tombol, kabar };
  }

  async function tungguTombolHidup(tombol: HTMLButtonElement) {
    for (let i = 0; i < 400; i += 1) {
      await new Promise((r) => setTimeout(r, 5));
      if (!tombol.disabled) return;
    }
    throw new Error("tombol tidak pernah hidup lagi");
  }

  it("tekanan pertama: peringatan tertulis dan TIDAK dimuat ulang; tekanan kedua baru mengirim paksa", async () => {
    const dimuatUlang = { n: 0 };
    const { dikirim, tombol, kabar } = pasangPanel(dimuatUlang);
    expect(tombol.textContent).toBe("Perbarui sekarang");

    tombol.click();
    await tungguTombolHidup(tombol);
    expect(dikirim).toEqual([{ sumber: "aleta-panel", jenis: "perbarui" }]);
    expect(kabar.hidden).toBe(false);
    expect(kabar.textContent).toContain("2 dari 4 dokumen selesai, 2 belum");
    expect(kabar.textContent).toContain("MENGHAPUS putaran itu");
    expect(kabar.classList.contains("aleta-portal-awas")).toBe(true);
    expect(tombol.textContent).toBe("Tetap perbarui - putaran cetak hilang");
    await new Promise((r) => setTimeout(r, 20));
    expect(dimuatUlang.n).toBe(0);

    tombol.click();
    for (let i = 0; i < 400 && dimuatUlang.n === 0; i += 1) await new Promise((r) => setTimeout(r, 5));
    expect(dikirim[1]).toEqual({ sumber: "aleta-panel", jenis: "perbarui", paksa: true });
    expect(dimuatUlang.n).toBe(1);
  });
});
