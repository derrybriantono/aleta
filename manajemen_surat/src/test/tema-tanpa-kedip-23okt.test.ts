/**
 * ============================================================================
 * TEMA TERANG / GELAP / IKUTI SISTEM: TANPA BUG KLIK, TANPA KEDIP (23 Okt 2026)
 * ============================================================================
 *
 * Laporan pengguna: klik pilihan tema kadang tidak berubah atau berubah ke
 * kebalikannya; "ikuti sistem" tampil terbalik; pindah halaman membuat warna
 * berkedip gelap-terang bergantian.
 *
 * Yang diuji di sini PERILAKUNYA, dengan menjalankan skrip sungguhan
 * (tema-pusat.js, tema-awal.js, skrip awal portal, dan modul tema-pilihan.ts)
 * di JSDOM dengan chrome.storage, localStorage, dan matchMedia tiruan:
 *
 *   1. memilih terang/gelap/sistem -> atribut benar SEKETIKA (sinkron);
 *   2. sistem gelap -> gelap, sistem berubah -> ikut, tanpa penulisan;
 *   3. pindah halaman -> atribut sudah benar sebelum chrome.storage menjawab
 *      dan TIDAK ditulis ulang sesudahnya (tidak ada tulisan berlawanan
 *      berturut-turut), termasuk bolak-balik SIPP <-> ABT dengan lapisan SIPP
 *      dimatikan (sebab kedip lama);
 *   4. portal <-> ekstensi tidak ping-pong: jumlah penulisan terbatas;
 *   5. nilai lama tersimpan dipetakan, tidak hilang;
 *   6. skrip awal portal sama dengan modul TypeScript-nya.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ATRIBUT_SALINAN_TEMA,
  KUNCI_SALINAN_TEMA,
  aturPilihanTema,
  ambilKeadaanTema,
  bacaKeadaanTersimpan,
  mulaiTemaPortal,
  resolusiTema,
  setelUlangTemaUntukUji,
  susunSalinanTema,
  uraiSalinanTema,
} from "@/lib/tema-pilihan";
import { SKRIP_TEMA_AWAL } from "@/lib/tema-skrip-awal";

const EKSTENSI = path.resolve(__dirname, "../../../ekstensi-sipp");
const bacaEkstensi = (n: string) => readFileSync(path.join(EKSTENSI, n), "utf8");
const SUMBER_PUSAT = bacaEkstensi("tema-pusat.js");
const SUMBER_AWAL = bacaEkstensi("tema-awal.js");

type Bebas = Record<string, any>;
const g = globalThis as unknown as Bebas;

// ─── Tiruan ──────────────────────────────────────────────────────────────────

function pasangSistem(gelap: boolean) {
  const pendengar = new Set<(e: { matches: boolean }) => void>();
  const mq: Bebas = {
    matches: gelap,
    media: "(prefers-color-scheme: dark)",
    addEventListener: (_n: string, fn: (e: { matches: boolean }) => void) => pendengar.add(fn),
    removeEventListener: (_n: string, fn: (e: { matches: boolean }) => void) => pendengar.delete(fn),
  };
  window.matchMedia = vi.fn(() => mq) as unknown as typeof window.matchMedia;
  return {
    balik(baru: boolean) {
      mq.matches = baru;
      pendengar.forEach((fn) => fn({ matches: baru }));
    },
    jumlahPendengar: () => pendengar.size,
  };
}

function buatChrome(awal: Bebas = {}) {
  const gudang: Bebas = { ...awal };
  const pendengar: Array<(ubah: Bebas, tempat: string) => void> = [];
  const catat = { set: [] as Bebas[], get: 0 };
  const chrome = {
    storage: {
      local: {
        get(kunci: string[] | string, cb?: (h: Bebas) => void) {
          catat.get += 1;
          const hasil: Bebas = {};
          for (const k of Array.isArray(kunci) ? kunci : [kunci]) if (k in gudang) hasil[k] = gudang[k];
          // Seperti Chrome sungguhan: jawaban SELALU asinkron; dengan callback tidak ada janji.
          if (cb) {
            setTimeout(() => cb(hasil), 0);
            return undefined;
          }
          return new Promise((selesai) => setTimeout(() => selesai(hasil), 0));
        },
        set(nilai: Bebas) {
          catat.set.push(nilai);
          if (process.env.DEBUG_TEMA) console.log("SET", JSON.stringify(nilai), (new Error().stack || "").split("\n").slice(2, 7).join(" | "));
          const ubah: Bebas = {};
          for (const [k, v] of Object.entries(nilai)) {
            if (gudang[k] !== v) ubah[k] = { oldValue: gudang[k], newValue: v };
            gudang[k] = v;
          }
          if (Object.keys(ubah).length) queueMicrotask(() => pendengar.forEach((fn) => fn(ubah, "local")));
          return Promise.resolve();
        },
        remove(kunci: string[]) {
          const ubah: Bebas = {};
          for (const k of kunci) {
            if (k in gudang) ubah[k] = { oldValue: gudang[k] };
            delete gudang[k];
          }
          if (Object.keys(ubah).length) queueMicrotask(() => pendengar.forEach((fn) => fn(ubah, "local")));
          return Promise.resolve();
        },
      },
      onChanged: {
        addListener: (fn: (ubah: Bebas, tempat: string) => void) => pendengar.push(fn),
        removeListener: (fn: (ubah: Bebas, tempat: string) => void) => {
          const i = pendengar.indexOf(fn);
          if (i >= 0) pendengar.splice(i, 1);
        },
      },
    },
  };
  return { chrome, gudang, catat };
}

const tunggu = () => new Promise<void>((s) => setTimeout(s, 0));
async function reda(kali = 6) {
  for (let i = 0; i < kali; i += 1) await tunggu();
}

/** Mencatat tiap perubahan atribut/kelas <html> beserta isinya SESUDAH berubah. */
function rekamAkar(nama: string[]) {
  const catatan: Array<{ nama: string; nilai: string | null }> = [];
  const pengamat = new MutationObserver((daftar) => {
    for (const r of daftar) {
      if (r.attributeName) catatan.push({ nama: r.attributeName, nilai: (r.target as Element).getAttribute(r.attributeName) });
    }
  });
  pengamat.observe(document.documentElement, { attributes: true, attributeFilter: nama });
  return {
    catatan,
    ambil: () => {
      for (const r of pengamat.takeRecords()) {
        if (r.attributeName) catatan.push({ nama: r.attributeName, nilai: (r.target as Element).getAttribute(r.attributeName) });
      }
      return catatan.slice();
    },
    berhenti: () => pengamat.disconnect(),
  };
}

function pindahKe(jalur: string) {
  window.history.pushState({}, "", jalur);
}

const instansPusat: Bebas[] = [];
const penghentiPortal: Array<() => void> = [];

/** Memuat tema-pusat.js seperti content script: instans baru, halaman baru. */
function muatPusat(chrome: Bebas | null) {
  if (g.AletaTemaPusat) g.AletaTemaPusat.hentikan();
  delete g.AletaTemaPusat;
  if (chrome) g.chrome = chrome;
  else delete g.chrome;
  new Function(SUMBER_PUSAT)();
  instansPusat.push(g.AletaTemaPusat);
  return g.AletaTemaPusat as Bebas;
}

function akar() {
  return document.documentElement;
}

function bersihkanHalaman() {
  while (instansPusat.length) instansPusat.pop()!.hentikan();
  while (penghentiPortal.length) penghentiPortal.pop()!();
  const a = akar();
  for (const n of Array.from(a.getAttributeNames())) {
    if (n.startsWith("data-aleta") || n === "class" || n === "style") a.removeAttribute(n);
  }
  localStorage.clear();
  delete g.AletaTemaPusat;
  delete g.chrome;
  pindahKe("/SIPP/index.php");
  setelUlangTemaUntukUji();
}

beforeEach(() => {
  bersihkanHalaman();
  pasangSistem(false);
});

afterEach(() => {
  bersihkanHalaman();
  vi.restoreAllMocks();
});

// ============================================================================
describe("1 - memilih terang, gelap, sistem: atribut benar seketika", () => {
  it("SIPP/ABT: pilih() memasang penanda di <html> SINKRON, tanpa menunggu chrome.storage", async () => {
    const { chrome, catat } = buatChrome();
    const pusat = muatPusat(chrome);
    pusat.mulai();
    expect(akar().getAttribute("data-aleta-tema")).toBe("gelap"); // bawaan produk
    expect(akar().getAttribute("data-aleta-tema-sipp")).toBe("gelap");

    pusat.pilih("terang");
    expect(akar().getAttribute("data-aleta-tema")).toBe("terang");
    expect(akar().hasAttribute("data-aleta-tema-sipp")).toBe(false);
    expect(pusat.keadaan().pilihan).toBe("terang");

    pusat.pilih("gelap");
    expect(akar().getAttribute("data-aleta-tema")).toBe("gelap");
    expect(akar().getAttribute("data-aleta-tema-sipp")).toBe("gelap");

    pusat.pilih("sistem");
    // Sistem terang (beforeEach) -> terang.
    expect(akar().getAttribute("data-aleta-tema")).toBe("terang");
    expect(akar().getAttribute("data-aleta-tema-pilihan")).toBe("sistem");
    expect(akar().hasAttribute("data-aleta-tema-sipp")).toBe(false);

    await reda();
    // Tersimpan: pilihan + waktu + cermin hasil uraian.
    expect(catat.set.at(-1)).toMatchObject({ pilihanTema: "sistem", temaPanel: "terang" });
    expect(localStorage.getItem(KUNCI_SALINAN_TEMA)).toMatch(/^sistem\|\d+$/);
  });

  it("siklus tombol terang -> gelap -> sistem -> terang menghasilkan keadaan yang diminta, tiap kali", () => {
    const pusat = muatPusat(buatChrome().chrome);
    pusat.mulai();
    const urutan: Record<string, string> = { terang: "gelap", gelap: "sistem", sistem: "terang" };
    pusat.pilih("terang");
    const lihat: string[] = [];
    for (let i = 0; i < 7; i += 1) {
      const sekarang = pusat.keadaan().pilihan;
      pusat.pilih(urutan[sekarang]);
      lihat.push(pusat.keadaan().pilihan);
    }
    expect(lihat).toEqual(["gelap", "sistem", "terang", "gelap", "sistem", "terang", "gelap"]);
  });

  it("klik berturut-turut cepat tidak membalik: tiap klik membawa pilihan tegas, waktu selalu naik", () => {
    const pusat = muatPusat(buatChrome().chrome);
    pusat.mulai();
    const waktu: number[] = [];
    for (const p of ["terang", "gelap", "terang", "sistem", "gelap"]) {
      pusat.pilih(p);
      waktu.push(pusat.keadaan().waktu);
      expect(pusat.keadaan().pilihan).toBe(p);
    }
    for (let i = 1; i < waktu.length; i += 1) expect(waktu[i]).toBeGreaterThan(waktu[i - 1]);
  });

  it("portal: aturPilihanTema memasang kelas dark dan atribut salinan seketika, dan menulis SATU kali", () => {
    const tulis = vi.spyOn(Storage.prototype, "setItem");
    aturPilihanTema("terang");
    expect(akar().classList.contains("dark")).toBe(false);
    expect(akar().getAttribute("data-aleta-tema")).toBe("terang");
    expect(akar().getAttribute(ATRIBUT_SALINAN_TEMA)).toMatch(/^terang\|\d+$/);
    expect(ambilKeadaanTema().pilihan).toBe("terang");
    aturPilihanTema("gelap");
    expect(akar().classList.contains("dark")).toBe(true);
    aturPilihanTema("sistem");
    expect(akar().classList.contains("dark")).toBe(false); // sistem terang
    expect(tulis.mock.calls.filter((c) => c[0] === KUNCI_SALINAN_TEMA)).toHaveLength(3);
  });

  it("portal: pilihan yang sama dengan yang berlaku tidak menulis apa pun", () => {
    aturPilihanTema("terang");
    const tulis = vi.spyOn(Storage.prototype, "setItem");
    aturPilihanTema("terang");
    expect(tulis).not.toHaveBeenCalled();
  });
});

// ============================================================================
describe("2 - ikuti sistem: sistem gelap -> gelap, sistem berubah -> ikut", () => {
  it("SIPP/ABT: pilihan sistem mengikuti matchMedia di jendela halaman, dan pergantiannya tanpa penulisan", async () => {
    const sistem = pasangSistem(true);
    localStorage.setItem(KUNCI_SALINAN_TEMA, "sistem|10");
    const { chrome, catat } = buatChrome({ pilihanTema: "sistem", pilihanTemaWaktu: 10 });
    const pusat = muatPusat(chrome);
    pusat.mulai();
    expect(akar().getAttribute("data-aleta-tema")).toBe("gelap");
    await reda();
    const tulisSebelum = catat.set.length;
    const tulisLokal = vi.spyOn(Storage.prototype, "setItem");

    sistem.balik(false);
    expect(akar().getAttribute("data-aleta-tema")).toBe("terang");
    expect(akar().hasAttribute("data-aleta-tema-sipp")).toBe(false);
    sistem.balik(true);
    expect(akar().getAttribute("data-aleta-tema")).toBe("gelap");
    expect(akar().getAttribute("data-aleta-tema-sipp")).toBe("gelap");
    await reda();
    // Tampilan sistem bukan pilihan pengguna: tidak ada yang ditulis.
    expect(catat.set.length).toBe(tulisSebelum);
    expect(tulisLokal).not.toHaveBeenCalled();
  });

  it("pilihan terang/gelap TIDAK ikut tampilan sistem", () => {
    const sistem = pasangSistem(true);
    localStorage.setItem(KUNCI_SALINAN_TEMA, "terang|10");
    const pusat = muatPusat(buatChrome().chrome);
    pusat.mulai();
    expect(akar().getAttribute("data-aleta-tema")).toBe("terang");
    sistem.balik(false);
    sistem.balik(true);
    expect(akar().getAttribute("data-aleta-tema")).toBe("terang");
  });

  it("portal: pilihan sistem diuraikan lewat matchMedia dan dipantau perubahannya (tanpa menulis)", () => {
    const sistem = pasangSistem(true);
    localStorage.setItem(KUNCI_SALINAN_TEMA, "sistem|10");
    const henti = mulaiTemaPortal();
    penghentiPortal.push(henti);
    expect(akar().classList.contains("dark")).toBe(true);
    const tulis = vi.spyOn(Storage.prototype, "setItem");
    sistem.balik(false);
    expect(akar().classList.contains("dark")).toBe(false);
    sistem.balik(true);
    expect(akar().classList.contains("dark")).toBe(true);
    expect(tulis).not.toHaveBeenCalled();
    henti();
    expect(sistem.jumlahPendengar()).toBe(0);
  });

  it("popup memakai matchMedia jendelanya sendiri untuk uraian sistem", () => {
    const popup = bacaEkstensi("popup.js");
    expect(popup).toContain('window.matchMedia("(prefers-color-scheme: dark)")');
    expect(popup).toContain("if (temaPopup === \"sistem\") terapkanTemaPopup();");
  });

  it("latar.js (pekerja latar tanpa matchMedia) tidak menguraikan tema sama sekali", () => {
    const latar = bacaEkstensi("latar.js");
    expect(latar).not.toContain("prefers-color-scheme");
    expect(latar).not.toContain("matchMedia");
  });
});

// ============================================================================
describe("3 - pindah halaman: atribut benar SEBELUM lukis pertama dan tidak berbalik sesudahnya", () => {
  async function muatHalaman(jalur: string, chrome: Bebas) {
    for (const n of Array.from(akar().getAttributeNames())) if (n.startsWith("data-aleta")) akar().removeAttribute(n);
    pindahKe(jalur);
    const rekam = rekamAkar(["data-aleta-tema-sipp", "data-aleta-tema", "data-aleta-tema-pilihan", "class"]);
    const pusat = muatPusat(chrome);
    // document_start: tema-awal.js memulai pusat; satu kali, sinkron.
    new Function(SUMBER_AWAL)();
    const sesudahMulai = {
      tema: akar().getAttribute("data-aleta-tema"),
      sipp: akar().getAttribute("data-aleta-tema-sipp"),
      jumlahTulisan: rekam.ambil().length,
    };
    await reda(); // chrome.storage menjawab
    const akhir = rekam.ambil();
    rekam.berhenti();
    return { pusat, sesudahMulai, tulisanSesudahChrome: akhir.length - sesudahMulai.jumlahTulisan, akhir };
  }

  it("cache dan chrome sama: nol penulisan atribut sesudah chrome.storage menjawab", async () => {
    localStorage.setItem(KUNCI_SALINAN_TEMA, "terang|50");
    const { chrome, catat } = buatChrome({ pilihanTema: "terang", pilihanTemaWaktu: 50, temaPanel: "terang" });
    const h = await muatHalaman("/SIPP/index.php", chrome);
    expect(h.sesudahMulai.tema).toBe("terang");
    expect(h.sesudahMulai.sipp).toBeNull();
    expect(h.tulisanSesudahChrome).toBe(0);
    expect(catat.set).toHaveLength(0);
  });

  it("bolak-balik SIPP <-> ABT <-> SIPP dengan lapisan SIPP dimatikan: tidak ada kedip, kunci tidak ditimpa", async () => {
    // Sebab lama: konten.js menulis "mati", panel ABT menulis "gelap" ke kunci
    // yang SAMA; tiap pindah halaman lahir dengan nilai penulis sebelumnya.
    localStorage.setItem(KUNCI_SALINAN_TEMA, "gelap|50");
    localStorage.setItem("aleta-tema-lapisan", "0");
    const { chrome, catat } = buatChrome({ pilihanTema: "gelap", pilihanTemaWaktu: 50, temaPanel: "gelap", temaSipp: false });
    const urutan = ["/SIPP/index.php", "/aps_badilag/index.php", "/SIPP/index.php", "/aps_badilag/index.php", "/SIPP/index.php"];
    const hasil: Array<{ jalur: string; sipp: string | null; kedip: number }> = [];
    for (const jalur of urutan) {
      const h = await muatHalaman(jalur, chrome);
      hasil.push({ jalur, sipp: h.sesudahMulai.sipp, kedip: h.tulisanSesudahChrome });
    }
    // SIPP: lapisan mati -> asli; ABT: gelap selalu gelap. Dan tidak berubah sesudah lukis pertama.
    expect(hasil.map((x) => x.sipp)).toEqual([null, "gelap", null, "gelap", null]);
    expect(hasil.every((x) => x.kedip === 0)).toBe(true);
    expect(localStorage.getItem(KUNCI_SALINAN_TEMA)).toBe("gelap|50");
    expect(localStorage.getItem("aleta-tema-lapisan")).toBe("0");
    expect(catat.set).toHaveLength(0);
  });

  it("chrome lebih BARU dari cache (popup mengganti saat tab tertutup): diadopsi SEKALI, lalu stabil", async () => {
    localStorage.setItem(KUNCI_SALINAN_TEMA, "gelap|50");
    const { chrome } = buatChrome({ pilihanTema: "terang", pilihanTemaWaktu: 90, temaPanel: "terang" });
    const h = await muatHalaman("/SIPP/index.php", chrome);
    expect(h.sesudahMulai.tema).toBe("gelap"); // lukis pertama dari cache sinkron
    expect(akar().getAttribute("data-aleta-tema")).toBe("terang"); // lalu mengikuti chrome
    expect(localStorage.getItem(KUNCI_SALINAN_TEMA)).toBe("terang|90"); // disalin APA ADANYA
    // Halaman berikutnya: lahir sudah benar, nol koreksi.
    const berikut = await muatHalaman("/aps_badilag/x", chrome);
    expect(berikut.sesudahMulai.tema).toBe("terang");
    expect(berikut.tulisanSesudahChrome).toBe(0);
  });

  it("cache lebih BARU dari chrome: chrome disegarkan dengan nilai dan waktu yang SAMA persis", async () => {
    localStorage.setItem(KUNCI_SALINAN_TEMA, "sistem|120");
    const { chrome, catat, gudang } = buatChrome({ pilihanTema: "gelap", pilihanTemaWaktu: 50, temaPanel: "gelap" });
    await muatHalaman("/SIPP/index.php", chrome);
    expect(gudang.pilihanTema).toBe("sistem");
    expect(gudang.pilihanTemaWaktu).toBe(120);
    expect(catat.set).toHaveLength(1);
    // Halaman lain di tab lain melihat keadaan yang sudah sama: tidak menulis.
    const lagi = await muatHalaman("/aps_badilag/x", chrome);
    expect(lagi.tulisanSesudahChrome).toBe(0);
    expect(catat.set).toHaveLength(1);
  });

  it("tanpa cache sama sekali: bawaan gelap sejak lukis pertama, tanpa menulis penyimpanan", async () => {
    const { chrome, catat } = buatChrome();
    const h = await muatHalaman("/SIPP/index.php", chrome);
    expect(h.sesudahMulai.tema).toBe("gelap");
    expect(h.sesudahMulai.sipp).toBe("gelap");
    expect(catat.set).toHaveLength(0);
    expect(localStorage.getItem(KUNCI_SALINAN_TEMA)).toBeNull();
  });

  it("pergantian dibungkus tanpa-transisi, sehingga koreksi tidak tampak sebagai kedip", async () => {
    const { chrome } = buatChrome();
    const pusat = muatPusat(chrome);
    pusat.mulai();
    const kelas: boolean[] = [];
    const pengamat = new MutationObserver(() => kelas.push(akar().classList.contains("aleta-ganti-tema")));
    pengamat.observe(akar(), { attributes: true, attributeFilter: ["class"] });
    pusat.pilih("terang");
    await reda(2);
    pengamat.disconnect();
    expect(kelas[0]).toBe(true); // dinyalakan sebelum penanda berubah
    await reda(4);
    expect(akar().classList.contains("aleta-ganti-tema")).toBe(false); // dan dicabut lagi
  });

  it("tab lain mengubah salinan (peristiwa storage): diikuti tanpa menulis balik", async () => {
    localStorage.setItem(KUNCI_SALINAN_TEMA, "gelap|50");
    const { chrome, catat } = buatChrome({ pilihanTema: "gelap", pilihanTemaWaktu: 50 });
    const pusat = muatPusat(chrome);
    pusat.mulai();
    await reda();
    const tulis = vi.spyOn(Storage.prototype, "setItem");
    localStorage.setItem(KUNCI_SALINAN_TEMA, "terang|200");
    tulis.mockClear();
    window.dispatchEvent(new StorageEvent("storage", { key: KUNCI_SALINAN_TEMA, newValue: "terang|200" }));
    expect(akar().getAttribute("data-aleta-tema")).toBe("terang");
    await reda();
    expect(tulis).not.toHaveBeenCalled(); // salinan tidak ditulis ulang
    // Penulisnya mungkin tab tanpa ekstensi: chrome ikut dibawa, SEKALI, dengan waktu yang sama.
    expect(catat.set).toHaveLength(1);
    expect(catat.set[0]).toMatchObject({ pilihanTema: "terang", pilihanTemaWaktu: 200 });
  });
});

// ============================================================================
describe("4 - portal <-> ekstensi tidak ping-pong", () => {
  async function pasangPortalDanEkstensi(awalLocal: string | null, awalChrome: Bebas) {
    pindahKe("/aleta/");
    if (awalLocal) localStorage.setItem(KUNCI_SALINAN_TEMA, awalLocal);
    // Skrip awal portal (head), lalu ekstensi (document_start), lalu React (mount).
    new Function(SKRIP_TEMA_AWAL)();
    const c = buatChrome(awalChrome);
    const pusat = muatPusat(c.chrome);
    new Function(SUMBER_AWAL)();
    const henti = mulaiTemaPortal();
    penghentiPortal.push(henti);
    const tulisLokal = vi.spyOn(Storage.prototype, "setItem");
    await reda();
    return { ...c, pusat, henti, tulisLokal };
  }

  it("klik di portal: tersalin ke chrome SEKALI (nilai+waktu sama), lalu sunyi", async () => {
    const t = await pasangPortalDanEkstensi("gelap|50", { pilihanTema: "gelap", pilihanTemaWaktu: 50, temaPanel: "gelap" });
    t.tulisLokal.mockClear();
    t.catat.set.length = 0;

    aturPilihanTema("terang");
    await reda(10);

    expect(akar().classList.contains("dark")).toBe(false);
    expect(t.gudang.pilihanTema).toBe("terang");
    expect(t.gudang.pilihanTemaWaktu).toBe(ambilKeadaanTema().waktu);
    expect(t.catat.set).toHaveLength(1); // bukan bolak-balik
    expect(t.tulisLokal.mock.calls.filter((c) => c[0] === KUNCI_SALINAN_TEMA)).toHaveLength(1);
    // Dan tetap sunyi sesudah itu.
    await reda(10);
    expect(t.catat.set).toHaveLength(1);
    t.henti();
  });

  it("popup mengganti (chrome lebih baru): portal mengikuti, penulisan terbatas dan tidak berulang", async () => {
    const t = await pasangPortalDanEkstensi("gelap|50", { pilihanTema: "gelap", pilihanTemaWaktu: 50, temaPanel: "gelap" });
    t.tulisLokal.mockClear();
    t.catat.set.length = 0;
    const atribut = rekamAkar(["class", ATRIBUT_SALINAN_TEMA]);

    // Popup (origin lain) menulis chrome.storage saja.
    t.chrome.storage.local.set({ pilihanTema: "terang", pilihanTemaWaktu: 300, temaPanel: "terang" });
    t.catat.set.length = 0; // yang dihitung: tanggapan ekstensi, bukan tulisan popup
    await reda(12);

    expect(akar().classList.contains("dark")).toBe(false);
    expect(localStorage.getItem(KUNCI_SALINAN_TEMA)).toBe("terang|300");
    expect(ambilKeadaanTema()).toEqual({ pilihan: "terang", waktu: 300 });
    expect(t.catat.set).toHaveLength(0); // ekstensi tidak menulis balik ke chrome
    expect(t.tulisLokal.mock.calls.filter((c) => c[0] === KUNCI_SALINAN_TEMA)).toHaveLength(1);
    // Kelas dark berubah paling banyak sekali (gelap -> terang), tanpa berbalik.
    const keadaanDark = atribut
      .ambil()
      .filter((x) => x.nama === "class")
      .map((x) => /(^| )dark( |$)/.test(String(x.nilai)));
    const berubahDark = keadaanDark.filter((nilai, i) => i > 0 && nilai !== keadaanDark[i - 1]).length + (keadaanDark[0] === false ? 1 : 0);
    expect(berubahDark).toBe(1); // gelap -> terang SEKALI
    expect(keadaanDark.at(-1)).toBe(false);
    atribut.berhenti();
    t.henti();
  });

  it("dua klik di dua sisi berturut-turut: yang terakhir menang di semua tempat, jumlah tulisan tetap kecil", async () => {
    const t = await pasangPortalDanEkstensi("gelap|50", { pilihanTema: "gelap", pilihanTemaWaktu: 50, temaPanel: "gelap" });
    t.tulisLokal.mockClear();
    t.catat.set.length = 0;

    aturPilihanTema("terang"); // di portal
    await reda(8);
    t.pusat.pilih("sistem"); // di panel ekstensi pada halaman yang sama
    await reda(8);
    aturPilihanTema("gelap"); // di portal lagi
    await reda(12);

    expect(ambilKeadaanTema().pilihan).toBe("gelap");
    expect(t.pusat.keadaan().pilihan).toBe("gelap");
    expect(t.gudang.pilihanTema).toBe("gelap");
    expect(akar().classList.contains("dark")).toBe(true);
    expect(localStorage.getItem(KUNCI_SALINAN_TEMA)).toBe(susunSalinanTema(ambilKeadaanTema()));
    // Tiga tindakan -> paling banyak 3 tulisan chrome dan 3 tulisan salinan (tanpa gema).
    expect(t.catat.set.length).toBeLessThanOrEqual(3);
    expect(t.tulisLokal.mock.calls.filter((c) => c[0] === KUNCI_SALINAN_TEMA).length).toBeLessThanOrEqual(3);
    t.henti();
  });

  it("salinan basi di tab portal lain tidak dapat menimpa: waktu lebih lama kalah", async () => {
    const t = await pasangPortalDanEkstensi("terang|500", { pilihanTema: "terang", pilihanTemaWaktu: 500, temaPanel: "terang" });
    t.catat.set.length = 0;
    // Chrome menyiarkan nilai LEBIH LAMA (mis. tab basi menulis): diabaikan.
    t.chrome.storage.local.set({ pilihanTema: "gelap", pilihanTemaWaktu: 100, temaPanel: "gelap" });
    t.catat.set.length = 0;
    await reda(10);
    expect(ambilKeadaanTema().pilihan).toBe("terang");
    expect(akar().classList.contains("dark")).toBe(false);
    t.henti();
  });

  it("app-state tidak lagi menulis `theme` ke localStorage (tab basi tak dapat menimpa pilihan)", () => {
    const sumber = readFileSync(path.resolve(__dirname, "../lib/app-state.tsx"), "utf8");
    expect(sumber).not.toContain("theme: nextState.theme");
    expect(sumber).not.toContain('document.documentElement.classList.toggle("dark"');
    expect(sumber).toContain("setTheme: (theme) => aturPilihanTema(modeKePilihan(theme)),");
  });
});

// ============================================================================
describe("5 - nilai lama tersimpan dipetakan, tidak hilang", () => {
  it("portal: portal-terpadu-pa-v2.theme light/dark -> terang/gelap (waktu 0)", () => {
    localStorage.setItem("aleta:theme-default-dark-v1", "1");
    localStorage.setItem("portal-terpadu-pa-v2", JSON.stringify({ currentUserId: "u1", theme: "light" }));
    expect(bacaKeadaanTersimpan()).toEqual({ pilihan: "terang", waktu: 0 });
    localStorage.setItem("portal-terpadu-pa-v2", JSON.stringify({ theme: "dark" }));
    expect(bacaKeadaanTersimpan()).toEqual({ pilihan: "gelap", waktu: 0 });
  });

  it("portal: salinan baru mendahului nilai lama; rusak -> bawaan gelap", () => {
    localStorage.setItem("aleta:theme-default-dark-v1", "1");
    localStorage.setItem("portal-terpadu-pa-v2", JSON.stringify({ theme: "light" }));
    localStorage.setItem(KUNCI_SALINAN_TEMA, "sistem|77");
    expect(bacaKeadaanTersimpan()).toEqual({ pilihan: "sistem", waktu: 77 });
    localStorage.setItem(KUNCI_SALINAN_TEMA, "ngawur");
    localStorage.setItem("portal-terpadu-pa-v2", "{bukan json");
    expect(bacaKeadaanTersimpan()).toEqual({ pilihan: "gelap", waktu: 0 });
  });

  it("ekstensi SIPP/ABT: aleta-tema-sipp terang/gelap/mati dan temaPanel dipetakan", async () => {
    localStorage.setItem("aleta-tema-sipp", "mati");
    let pusat = muatPusat(buatChrome().chrome);
    pusat.mulai();
    expect(akar().getAttribute("data-aleta-tema")).toBe("gelap");
    expect(akar().hasAttribute("data-aleta-tema-sipp")).toBe(false); // lapisan mati dihormati

    for (const n of Array.from(akar().getAttributeNames())) if (n.startsWith("data-aleta")) akar().removeAttribute(n);
    localStorage.clear();
    localStorage.setItem("aleta-tema-sipp", "terang");
    pusat = muatPusat(buatChrome().chrome);
    pusat.mulai();
    expect(akar().getAttribute("data-aleta-tema")).toBe("terang");

    for (const n of Array.from(akar().getAttributeNames())) if (n.startsWith("data-aleta")) akar().removeAttribute(n);
    localStorage.clear();
    const c = buatChrome({ temaPanel: "terang" }); // hanya cermin lama di chrome
    pusat = muatPusat(c.chrome);
    pusat.mulai();
    await reda();
    expect(pusat.keadaan().pilihan).toBe("terang");
    expect(localStorage.getItem(KUNCI_SALINAN_TEMA)).toBe("terang|0");
    expect(akar().getAttribute("data-aleta-tema")).toBe("terang");
  });

  it("popup: dariChrome memetakan temaPanel lama; pilihan baru mengalahkannya", () => {
    const pusat = muatPusat(null);
    expect(pusat.dariChrome({ temaPanel: "terang" })).toEqual({ pilihan: "terang", waktu: 0 });
    expect(pusat.dariChrome({ temaPanel: "ngawur" })).toBeNull();
    expect(pusat.dariChrome({ pilihanTema: "sistem", pilihanTemaWaktu: 9, temaPanel: "terang" })).toEqual({ pilihan: "sistem", waktu: 9 });
  });

  it("popup.js menyalin aturan murni pusat PERSIS (bukan skrip), diuji dengan masukan yang sama", () => {
    const popup = bacaEkstensi("popup.js");
    const awal = popup.indexOf("const PUSAT_TEMA_POPUP = (() => {");
    const akhir = popup.indexOf("})();", awal) + "})();".length;
    const salinan = new Function(`${popup.slice(awal, akhir)}; return PUSAT_TEMA_POPUP;`)() as Bebas;
    const pusat = muatPusat(null);
    for (const p of ["terang", "gelap", "sistem", "ngawur", ""]) {
      expect(salinan.bersihkan(p)).toBe(pusat.bersihkan(p));
      for (const gs of [true, false]) expect(salinan.resolusiDari(p, gs)).toBe(pusat.resolusiDari(p, gs));
    }
    const contoh = [{}, { temaPanel: "gelap" }, { pilihanTema: "terang", pilihanTemaWaktu: 5 }, { pilihanTema: "x", temaPanel: "terang" }];
    for (const c of contoh) expect(salinan.dariChrome(c)).toEqual(pusat.dariChrome(c));
    expect(salinan.tulisanChrome("sistem", 7, "gelap")).toEqual(pusat.tulisanChrome("sistem", 7, "gelap"));
    const a = { pilihan: "terang", waktu: 5 };
    for (const b of [null, { pilihan: "terang", waktu: 5 }, { pilihan: "gelap", waktu: 5 }, { pilihan: "gelap", waktu: 4 }, { pilihan: "gelap", waktu: 6 }]) {
      expect(salinan.chromeMenang(a, b)).toBe(pusat.chromeMenang(a, b));
    }
  });
});

// ============================================================================
describe("6 - skrip awal portal sama dengan modul TypeScript-nya", () => {
  const MATRIKS: Array<{ nama: string; simpan: Record<string, string>; sistemGelap: boolean }> = [];
  for (const sg of [true, false]) {
    MATRIKS.push({ nama: "kosong", simpan: {}, sistemGelap: sg });
    for (const p of ["terang", "gelap", "sistem"]) MATRIKS.push({ nama: `salinan ${p}`, simpan: { [KUNCI_SALINAN_TEMA]: `${p}|42` }, sistemGelap: sg });
    MATRIKS.push({ nama: "ngawur", simpan: { [KUNCI_SALINAN_TEMA]: "kuning|1" }, sistemGelap: sg });
    MATRIKS.push({
      nama: "lama light + penanda",
      simpan: { "aleta:theme-default-dark-v1": "1", "portal-terpadu-pa-v2": JSON.stringify({ theme: "light" }) },
      sistemGelap: sg,
    });
    MATRIKS.push({ nama: "lama light tanpa penanda", simpan: { "portal-terpadu-pa-v2": JSON.stringify({ theme: "light" }) }, sistemGelap: sg });
    MATRIKS.push({ nama: "lama rusak", simpan: { "aleta:theme-default-dark-v1": "1", "portal-terpadu-pa-v2": "{rusak" }, sistemGelap: sg });
  }

  for (const kasus of MATRIKS) {
    it(`${kasus.nama}, sistem ${kasus.sistemGelap ? "gelap" : "terang"}`, () => {
      pasangSistem(kasus.sistemGelap);
      for (const [k, v] of Object.entries(kasus.simpan)) localStorage.setItem(k, v);
      const tulis = vi.spyOn(Storage.prototype, "setItem");
      tulis.mockClear();
      new Function(SKRIP_TEMA_AWAL)();
      const dariSkrip = { gelap: akar().classList.contains("dark"), salinan: akar().getAttribute("data-aleta-tema-salinan") };
      expect(tulis).not.toHaveBeenCalled(); // skrip awal hanya membaca
      const keadaan = bacaKeadaanTersimpan();
      expect(dariSkrip.gelap).toBe(resolusiTema(keadaan.pilihan, kasus.sistemGelap) === "gelap");
      expect(dariSkrip.salinan).toBe(susunSalinanTema(keadaan));
      expect(uraiSalinanTema(dariSkrip.salinan)).toEqual(keadaan);
    });
  }

  it("skrip awal menerapkan SEBELUM React: dipasang di <head> layout, tanpa className dark tertulis", () => {
    const layout = readFileSync(path.resolve(__dirname, "../app/layout.tsx"), "utf8");
    expect(layout).toContain("<script dangerouslySetInnerHTML={{ __html: SKRIP_TEMA_AWAL }} />");
    expect(layout.indexOf("SKRIP_TEMA_AWAL }}")).toBeLessThan(layout.indexOf("<body"));
    expect(layout).not.toMatch(/<html[^>]*className="dark"/);
    expect(layout).not.toContain("next/script");
  });

  it("kegagalan skrip awal jatuh ke gelap (bawaan produk), bukan ke terang", () => {
    const rusak = Object.getOwnPropertyDescriptor(window, "localStorage");
    Object.defineProperty(window, "localStorage", { configurable: true, get: () => { throw new Error("ditolak"); } });
    try {
      new Function(SKRIP_TEMA_AWAL)();
      expect(akar().classList.contains("dark")).toBe(true);
    } finally {
      if (rusak) Object.defineProperty(window, "localStorage", rusak);
    }
  });
});

// ============================================================================
describe("7 - sambungan antar berkas", () => {
  it("manifest: pusat dimuat SEBELUM tema-awal.js di SIPP, ABT, dan portal (document_start)", () => {
    const m = JSON.parse(bacaEkstensi("manifest.json")) as { content_scripts: Array<{ matches: string[]; js: string[]; run_at?: string }> };
    const awal = m.content_scripts.filter((c) => c.js.includes("tema-awal.js"));
    expect(awal.length).toBe(2);
    for (const c of awal) {
      expect(c.run_at).toBe("document_start");
      expect(c.js.indexOf("tema-pusat.js")).toBeGreaterThanOrEqual(0);
      expect(c.js.indexOf("tema-pusat.js")).toBeLessThan(c.js.indexOf("tema-awal.js"));
    }
    const cakupan = awal.flatMap((c) => c.matches);
    for (const pola of ["http://192.168.10.10/SIPP/*", "http://192.168.10.10/aps_badilag/*", "http://192.168.10.10/aleta/*"]) {
      expect(cakupan).toContain(pola);
    }
  });

  it("susun-ekstensi mendaftarkan tema-pusat.js; popup tidak memuatnya (salinan murni di popup.js)", () => {
    const susun = readFileSync(path.resolve(__dirname, "../../scripts/susun-ekstensi.mjs"), "utf8");
    expect(susun).toContain('"tema-pusat.js",');
  });

  it("tombol di kepala tiap panel memanggil pusat (tidak menulis penyimpanan atau atribut sendiri)", () => {
    const alat = bacaEkstensi("panel-alat.js");
    const konten = bacaEkstensi("konten.js");
    expect(alat).toContain("pusat.pilih(ALAT_URUTAN_TEMA[sekarang] || \"terang\");");
    expect(konten).toContain("pusat.pilih(ALAT_URUTAN_TEMA[sekarang] || \"terang\");");
    // Tidak ada lagi penulis atribut tema halaman selain pusat dan terapkanTemaSipp (aturan yang sama).
    expect(alat).not.toContain("alatTerapkanTemaHalaman");
    const dariBlangko = bacaEkstensi("blangko-derry.js");
    expect(dariBlangko).toContain("pusat.pilih(t.value);");
  });

  it("popup: pergantian akun memulihkan pilihan tema akun dengan WAKTU SEGAR (tidak kalah oleh salinan halaman)", () => {
    const popup = bacaEkstensi("popup.js");
    expect(popup).toContain("Math.max(Date.now(), temaWaktu + 1)");
    expect(popup).toContain("const temaAkun = pusatAkun ? pusatAkun.dariChrome(tulis) : null;");
    const latar = bacaEkstensi("latar.js");
    expect(latar).toContain('"pilihanTema",');
    expect(popup).toContain('"pilihanTema",');
  });

  it("globals.css mematikan transisi saat kelas pergantian terpasang", () => {
    const css = readFileSync(path.resolve(__dirname, "../app/globals.css"), "utf8");
    expect(css).toContain("html.aleta-ganti-tema *");
    expect(css).toContain("transition: none !important;");
  });
});
