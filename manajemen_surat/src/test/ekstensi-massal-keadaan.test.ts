// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

/**
 * ============================================================================
 * PENETAPAN MASSAL DALAM KEADAAN BURUK (uji rilis 12 Okt 2026, wilayah U2a)
 * ============================================================================
 *
 * Pelengkap ekstensi-penetapan-sisa.test.ts: harness yang sama (panel-alat.js,
 * basmassal.js, konten.js UTUH di jsdom atas halaman daftar SIPP tiruan,
 * bot tiruan = penjaga penetapanTulisService), tetapi keadaannya yang buruk:
 *
 *   - satu perkara di tengah antrean dijawab 502 (halaman HTML Apache),
 *     500 JSON portal, batas waktu, atau jaringan putus - antrean LANJUT,
 *     sebabnya terbaca manusia (bukan "Unexpected token <" atau "ditolak");
 *   - sesi ALETA habis (401) di tengah - antrean BERHENTI dengan kalimat
 *     yang dapat dikerjakan, tombol tidak mati;
 *   - mode kering dan mode latihan - tidak ada yang sampai ke bot, antrean
 *     berhenti di perkara pertama dengan sebab yang benar;
 *   - akun SIPP tidak terbaca (kepala halaman tanpa "Selamat Datang");
 *   - ekstensi dimuat ulang di tengah (chrome.* melempar "Extension context
 *     invalidated") - penulisan tetap dilaporkan menurut jawaban bot.
 */

const AKAR = path.resolve(process.cwd(), "../ekstensi-sipp");
const baca = (b: string) => readFileSync(path.join(AKAR, b), "utf8").replace(/\r\n/g, "\n");
const KONTEN = () =>
  (process.env.ALETA_UJI_KONTEN ? readFileSync(process.env.ALETA_UJI_KONTEN, "utf8") : baca("konten.js")).replace(/\r\n/g, "\n");
const ALAT = baca("panel-alat.js");
const BASMASSAL = baca("basmassal.js");

const ASAL = "http://192.168.10.10";
const AKUN = "Derry Briantono";
const tunggu = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const polos = <T>(x: T): T => (x === undefined ? x : JSON.parse(JSON.stringify(x)));

async function sampai<T>(periksa: () => T, keteranganNya: string | (() => string), batas = 15000): Promise<NonNullable<T>> {
  const keterangan = () => (typeof keteranganNya === "function" ? keteranganNya() : keteranganNya);
  const mulai = Date.now();
  for (;;) {
    let hasil: T | undefined;
    try {
      hasil = periksa();
    } catch {
      hasil = undefined;
    }
    if (hasil) return hasil as NonNullable<T>;
    if (Date.now() - mulai > batas) throw new Error(`tidak tercapai: ${keterangan()}`);
    await tunggu(10);
  }
}

type Jenis = "pmh" | "ppp" | "pjs" | "phs";
type Keadaan = Record<Jenis, string>;
type Tulis = { nomor: string; jenis: Jenis; kering: boolean };

/** Gangguan pada penulisan SUNGGUHAN (kering=false) satu perkara. */
type Gangguan =
  | { macam: "http"; status: number; html?: string; badan?: unknown }
  | { macam: "batas" }
  | { macam: "jaringan" };

type Perkara = { id: number; keadaan: Keadaan; gangguanNyata?: Gangguan; usulanStatus?: number };

const kosong = (): Keadaan => ({ pmh: "", ppp: "", pjs: "", phs: "" });
const T = "2026-10-07";

function usulanUntuk(nomor: string, p: Perkara) {
  return {
    ok: true,
    perkara: { perkaraId: p.id, nomorPerkara: nomor, jenisPerkaraId: 347, tanggalDaftar: T },
    penetapan: { ada: Boolean(p.keadaan.pmh), ...p.keadaan },
    tanggalPenetapan: p.keadaan.pmh || T,
    bentuk: { bentuk: "majelis" },
    pmh: {
      bentuk: "majelis",
      majelisKode: "A",
      anggota: [
        { hakimId: 32, nama: "Fahri" },
        { hakimId: 26, nama: "Himawan" },
        { hakimId: 31, nama: "Derry" },
      ],
      hitungan: [],
    },
    ppp: { usulan: { id: 30, paniteraId: 30, nama: "Sri" }, calon: [] },
    pjs: { usulan: { id: 30, jurusitaId: 30, nama: "Tanty" }, calon: [] },
    phs: { usulan: "2026-10-22", calon: [] },
    tercatat: { ada: Boolean(p.keadaan.pmh), ketuaHakimId: p.keadaan.pmh ? 32 : 0, hakim: [] },
  };
}

const terbuka: JSDOM[] = [];
afterEach(async () => {
  await tunggu(30);
  while (terbuka.length) terbuka.pop()!.window.close();
});

type OpsiBuka = { kepala?: boolean; simpanan?: Record<string, unknown> };

function buka(perkara: Record<string, Perkara>, opsi: OpsiBuka = {}) {
  const baris = Object.keys(perkara)
    .map((nomor, i) => `<tr><td>${i + 1}</td><td>${nomor}</td><td>Cerai Gugat</td></tr>`)
    .join("");
  const kepala =
    opsi.kepala === false
      ? `<table class="badge"><tr><td>SIPP</td></tr></table>`
      : `<table class="badge"><tr><td>Selamat Datang <font color='red'>${AKUN}</font>` +
        `<br> Anda Login Sebagai <font color='red'>Administrator</font></td></tr></table>`;
  const html = `${kepala}<table id="daftar"><tr><th>No</th><th>Nomor Perkara</th><th>Jenis</th></tr>${baris}</table>`;
  const dom = new JSDOM(`<!doctype html><html><head><title>SIPP</title></head><body><div id="konten">${html}</div></body></html>`, {
    url: `${ASAL}/SIPP/main`,
    runScripts: "outside-only",
    pretendToBeVisual: true,
  } as ConstructorParameters<typeof JSDOM>[1]);
  terbuka.push(dom);
  const w = dom.window as any;
  w.TextDecoder = globalThis.TextDecoder;
  w.Response = globalThis.Response;
  const simpanan: Record<string, unknown> = { ujiTampilan: "ui", ujiIzinkanNyata: true, ...(opsi.simpanan || {}) };
  /** Ekstensi dimuat ulang: seluruh chrome.* melempar seperti Chrome sungguhan. */
  const putus = { ya: false };
  const jagaPutus = () => {
    if (putus.ya) throw new Error("Extension context invalidated.");
  };
  const runtime: Record<string, unknown> = {
    id: "aleta-uji",
    getManifest: () => ({ version: "1.188.0" }),
    getURL: (x: string) => `chrome-extension://aleta-uji/${x}`,
    sendMessage: async () => {
      jagaPutus();
      return {};
    },
  };
  w.chrome = {
    runtime,
    storage: {
      local: {
        get: async (kunci?: string | string[] | null) => {
          jagaPutus();
          const daftar = kunci == null ? Object.keys(simpanan) : [kunci].flat();
          const hasil: Record<string, unknown> = {};
          for (const k of daftar) if (k in simpanan) hasil[k] = polos(simpanan[k]);
          return hasil;
        },
        set: async (isi: Record<string, unknown>) => {
          jagaPutus();
          Object.assign(simpanan, polos(isi));
        },
        remove: async () => {
          jagaPutus();
        },
      },
      session: {
        get: async () => {
          jagaPutus();
          return {};
        },
        set: async () => {
          jagaPutus();
        },
      },
      onChanged: { addListener: () => undefined },
    },
  };
  const tulis: Tulis[] = [];
  const usulanDiminta: string[] = [];
  const nomorDariId = (id: number) => Object.keys(perkara).find((n) => perkara[n].id === id) || "";
  const jawaban = (status: number, isi: unknown, html?: string) => {
    const r: any = {
      ok: status >= 200 && status < 300,
      status,
      statusText: "",
      redirected: false,
      headers: { get: () => (html !== undefined ? "text/html" : "application/json") },
      json: async () => {
        if (html !== undefined) return JSON.parse(html);
        return polos(isi);
      },
      text: async () => (html !== undefined ? html : JSON.stringify(isi ?? {})),
      clone: () => r,
    };
    return r;
  };
  w.fetch = async (alamat: string, o?: { method?: string; body?: string }) => {
    const url = String(alamat);
    const cara = String((o && o.method) || "GET").toUpperCase();
    if (url.includes("/api/aleta-ecourt/ekstensi/tampilan")) return jawaban(404, {});
    if (url.includes("/aleta-ecourt/ekstensi/siapa")) {
      return jawaban(200, { ok: true, data: { nama: "SUPER ADMIN DERRY", peran: "Super Admin", kapabilitas: null } });
    }
    if (url.includes("/aleta-bot/sipp-konteks/massal")) {
      const identitas: Record<string, unknown> = {};
      const lencana: Record<string, unknown> = {};
      for (const [nomor, p] of Object.entries(perkara)) {
        lencana[nomor] = {};
        identitas[nomor] = {
          penetapan: { pmh: Boolean(p.keadaan.pmh), ppp: Boolean(p.keadaan.ppp), pjs: Boolean(p.keadaan.pjs), phs: Boolean(p.keadaan.phs) },
        };
      }
      return jawaban(200, { ok: true, data: { available: true, perkara: lencana, identitas } });
    }
    if (url.includes("/aleta-bot/penunjukan/ruangan")) return jawaban(200, { ok: true, data: { ruangan: [] } });
    if (url.includes("/aleta-bot/penunjukan?")) {
      const nomor = decodeURIComponent((/nomor=([^&]+)/.exec(url) || [])[1] || "");
      usulanDiminta.push(nomor);
      const p = perkara[nomor];
      if (p && p.usulanStatus) return jawaban(p.usulanStatus, { ok: false, error: { message: "Sesi berakhir." } });
      return jawaban(200, { ok: true, data: { available: true, usulan: usulanUntuk(nomor, p), rencana: { langkah: [] } } });
    }
    if (url.includes("/aleta-bot/penunjukan/tulis") && cara === "POST") {
      const badan = JSON.parse(String((o && o.body) || "{}"));
      const nomor = nomorDariId(Number(badan.perkaraId));
      const p = perkara[nomor];
      const jenis = badan.jenis as Jenis;
      const kering = badan.kering !== false;
      tulis.push({ nomor, jenis, kering });
      if (!kering && p.gangguanNyata) {
        const g = p.gangguanNyata;
        if (g.macam === "jaringan") throw new TypeError("Failed to fetch");
        if (g.macam === "batas") {
          const e = new Error("The operation was aborted.");
          e.name = "AbortError";
          throw e;
        }
        return jawaban(g.status, g.badan ?? {}, g.html);
      }
      if (p.keadaan[jenis]) return jawaban(409, { ok: false, alasan: `${jenis}_sudah_ada` });
      if (!kering) p.keadaan[jenis] = badan.tanggalPenetapan;
      return jawaban(200, { ok: true, langkah: [{ tabel: "perkara_penetapan" }], andaian: [], tanggalPenetapan: badan.tanggalPenetapan });
    }
    return jawaban(200, { ok: true, data: {} });
  };
  const ctx = (dom as unknown as { getInternalVMContext(): vm.Context }).getInternalVMContext();
  vm.runInContext(ALAT, ctx, { filename: "panel-alat.js" });
  vm.runInContext("alatSetelJedaSkala(0)", ctx);
  vm.runInContext(BASMASSAL, ctx, { filename: "basmassal.js" });
  vm.runInContext(KONTEN(), ctx, { filename: "konten.js" });
  const galatLepas: string[] = [];
  w.addEventListener("unhandledrejection", (e: any) => galatLepas.push(String(e && e.reason)));
  w.addEventListener("error", (e: any) => galatLepas.push(String(e && e.message)));
  return {
    dom,
    w,
    d: w.document as Document,
    tulis,
    usulanDiminta,
    galatLepas,
    simpanan,
    putuskanEkstensi() {
      putus.ya = true;
      delete runtime.id;
    },
  };
}

async function bagianMassal(h: ReturnType<typeof buka>) {
  return sampai(() => {
    const kotak = h.d.querySelector('.aleta-bagian[data-kunci="penetapanMassal"]') as HTMLElement | null;
    return kotak && (kotak.querySelector(".aleta-massal-centang") || kotak.querySelector(".aleta-kosong")) ? kotak : null;
  }, () => `bagian Penetapan massal; halaman: ${String(h.d.body.textContent || "").slice(0, 300)}`);
}

function centangSemua(kotak: HTMLElement) {
  for (const c of Array.from(kotak.querySelectorAll<HTMLInputElement>(".aleta-massal-centang"))) {
    c.checked = true;
    c.dispatchEvent(new c.ownerDocument.defaultView!.Event("change"));
  }
}

const tombolDari = (kotak: HTMLElement) => kotak.querySelector(".aleta-tetap-kaki button") as HTMLButtonElement;
const kabarDari = (kotak: HTMLElement) => String(kotak.querySelector(".aleta-tetap-kaki .aleta-tetap-sebab")?.textContent || "");

async function tekanDanTunggu(kotak: HTMLElement, cocok: RegExp) {
  tombolDari(kotak).click();
  return sampai(() => (cocok.test(kabarDari(kotak)) ? kabarDari(kotak) : null), () => `kabar ${cocok}; kini: "${kabarDari(kotak)}"`);
}

const keadaanBaris = (kotak: HTMLElement, nomor: string) => {
  const butir = Array.from(kotak.querySelectorAll(".aleta-massal-butir")).find((b) => (b.textContent || "").includes(nomor));
  return String(butir?.textContent || "");
};

const N = ["801/Pdt.G/2026/PA.Dgl", "802/Pdt.G/2026/PA.Dgl", "803/Pdt.G/2026/PA.Dgl", "804/Pdt.G/2026/PA.Dgl"];

function empatPerkara(gangguanKedua?: Gangguan): Record<string, Perkara> {
  return {
    [N[0]]: { id: 9801, keadaan: kosong() },
    [N[1]]: { id: 9802, keadaan: kosong(), gangguanNyata: gangguanKedua },
    [N[2]]: { id: 9803, keadaan: { ...kosong(), pmh: T } },
    [N[3]]: { id: 9804, keadaan: kosong() },
  };
}

/** Periksa lalu Tetapkan; pulang kabar akhir. */
async function periksaLaluTetapkan(h: ReturnType<typeof buka>, akhir: RegExp) {
  const kotak = await bagianMassal(h);
  centangSemua(kotak);
  await tekanDanTunggu(kotak, /Tekan sekali lagi/);
  const kabar = await tekanDanTunggu(kotak, akhir);
  return { kotak, kabar };
}

const nyataPer = (h: ReturnType<typeof buka>, nomor: string) => h.tulis.filter((x) => !x.kering && x.nomor === nomor).map((x) => x.jenis);

// ============================================================================
describe("satu perkara terganggu di tengah antrean (ke-2 dari 4): antrean LANJUT, sebabnya terbaca", () => {
  it("502 halaman HTML (portal sedang dibangun ulang): bukan 'Unexpected token', perkara 3 dan 4 tetap ditetapkan", async () => {
    const h = buka(empatPerkara({ macam: "http", status: 502, html: "<html><body><h1>502 Bad Gateway</h1></body></html>" }));
    const { kotak, kabar } = await periksaLaluTetapkan(h, /^Selesai/);
    expect(nyataPer(h, N[0])).toEqual(["pmh", "ppp", "pjs", "phs"]);
    expect(nyataPer(h, N[1])).toEqual(["pmh"]);
    expect(nyataPer(h, N[2])).toEqual(["ppp", "pjs", "phs"]);
    expect(nyataPer(h, N[3])).toEqual(["pmh", "ppp", "pjs", "phs"]);
    expect(kabar).toMatch(/3 perkara ditetapkan/);
    expect(kabar).toMatch(/1 perkara gagal/);
    expect(kabar).not.toMatch(/Unexpected token|is not valid JSON|SyntaxError/);
    expect(kabar).toMatch(/502/);
    expect(keadaanBaris(kotak, N[1])).toMatch(/gagal/);
    expect(keadaanBaris(kotak, N[1])).not.toMatch(/Unexpected token|SyntaxError/);
    expect(h.galatLepas).toEqual([]);
  });

  it("500 JSON portal ({ ok:false, error:{ message } }): pesannya dibawa, bukan satu kata 'ditolak'", async () => {
    const h = buka(empatPerkara({ macam: "http", status: 500, badan: { ok: false, error: { message: "Basis data SIPP tidak terjangkau." } } }));
    const { kabar } = await periksaLaluTetapkan(h, /^Selesai/);
    expect(kabar).toMatch(/3 perkara ditetapkan/);
    expect(kabar).toMatch(/Basis data SIPP tidak terjangkau/);
    expect(nyataPer(h, N[3])).toEqual(["pmh", "ppp", "pjs", "phs"]);
  });

  it("batas waktu (AbortError): perkara itu gagal 'tidak menjawab', antrean lanjut, tidak menggantung", async () => {
    const h = buka(empatPerkara({ macam: "batas" }));
    const { kotak, kabar } = await periksaLaluTetapkan(h, /^Selesai/);
    expect(kabar).toMatch(/3 perkara ditetapkan/);
    expect(kabar).toMatch(/tidak menjawab/);
    expect(nyataPer(h, N[3])).toEqual(["pmh", "ppp", "pjs", "phs"]);
    expect(keadaanBaris(kotak, N[1])).toMatch(/gagal/);
  });

  it("jaringan putus untuk satu permintaan (TypeError): disebut 'tidak terjangkau', antrean lanjut", async () => {
    const h = buka(empatPerkara({ macam: "jaringan" }));
    const { kabar } = await periksaLaluTetapkan(h, /^Selesai/);
    expect(kabar).toMatch(/3 perkara ditetapkan/);
    expect(kabar).toMatch(/tidak terjangkau/);
  });

  it("bot menolak satu perkara (409 beralasan): antrean lanjut, kodenya diterjemahkan", async () => {
    const h = buka(empatPerkara({ macam: "http", status: 409, badan: { ok: false, alasan: "tanggal_penetapan_hari_libur" } }));
    const { kabar } = await periksaLaluTetapkan(h, /^Selesai/);
    expect(kabar).toMatch(/3 perkara ditetapkan/);
    expect(kabar).toMatch(/Sabtu\/Minggu/);
  });
});

// ============================================================================
describe("penolakan menyeluruh: antrean BERHENTI, kalimatnya dapat dikerjakan, tombol tidak mati", () => {
  it("sesi ALETA habis (401) saat menulis perkara ke-2: berhenti, perkara 3 dan 4 tidak disentuh", async () => {
    const h = buka(empatPerkara({ macam: "http", status: 401, badan: { ok: false, error: { message: "Sesi tidak valid." } } }));
    const { kotak, kabar } = await periksaLaluTetapkan(h, /Dihentikan|^Selesai/);
    expect(kabar).toMatch(/^Dihentikan di 802/);
    expect(kabar).toMatch(/masuk/i);
    expect(kabar).toMatch(/1 perkara sudah tertulis/);
    expect(nyataPer(h, N[2])).toEqual([]);
    expect(nyataPer(h, N[3])).toEqual([]);
    expect(tombolDari(kotak).disabled).toBe(false);
  });

  it("sesi ALETA habis saat MEMERIKSA (usulan 401 di perkara ke-2): berhenti, belum ada yang ditulis", async () => {
    const perkara = empatPerkara();
    perkara[N[1]].usulanStatus = 401;
    const h = buka(perkara);
    const kotak = await bagianMassal(h);
    centangSemua(kotak);
    const kabar = await tekanDanTunggu(kotak, /Dihentikan|siap/);
    expect(kabar).toMatch(/^Dihentikan di 802\/Pdt\.G\/2026\/PA\.Dgl: Belum masuk ALETA/);
    expect(kabar).toMatch(/Belum ada yang ditulis/);
    expect(h.tulis.filter((x) => !x.kering)).toEqual([]);
    expect(h.usulanDiminta).toEqual([N[0], N[1]]);
    expect(tombolDari(kotak).disabled).toBe(false);
  });

  it("akun SIPP tidak terbaca (kepala tanpa 'Selamat Datang'): berhenti di perkara pertama, bot tidak menerima apa pun", async () => {
    const h = buka(empatPerkara(), { kepala: false });
    const kotak = await bagianMassal(h);
    centangSemua(kotak);
    const kabar = await tekanDanTunggu(kotak, /Dihentikan|siap/);
    expect(kabar).toMatch(/^Dihentikan di 801/);
    expect(kabar).toMatch(/Akun SIPP Anda tidak terbaca/);
    expect(h.tulis).toEqual([]);
    expect(h.usulanDiminta).toEqual([N[0]]);
    expect(tombolDari(kotak).disabled).toBe(false);
  });

  it("mode kering: tidak ada kiriman ke bot, berhenti di perkara pertama dengan sebab 'mode kering'", async () => {
    // Dinyalakan SESUDAH panel daftar tergambar: mode kering yang menyala sejak
    // halaman dimuat menahan pula bacaan sipp-konteks/massal (POST), sehingga
    // panel daftar tidak tergambar sama sekali - dilaporkan terpisah (di luar
    // wilayah U2a: alatKeringMenahan).
    const h = buka(empatPerkara());
    const kotak = await bagianMassal(h);
    vm.runInContext("alatKeringNyalaKini = true", (h.dom as unknown as { getInternalVMContext(): vm.Context }).getInternalVMContext());
    centangSemua(kotak);
    const kabar = await tekanDanTunggu(kotak, /Dihentikan|siap|gagal/);
    expect(h.tulis).toEqual([]);
    expect(kabar).toMatch(/^Dihentikan di 801/);
    expect(kabar).toMatch(/[Mm]ode kering/);
    expect(kabar).not.toMatch(/mode_kering/);
    expect(h.usulanDiminta).toEqual([N[0]]);
  });

  it("mode latihan: tidak ada kiriman ke bot, berhenti di perkara pertama dengan sebab 'latihan'", async () => {
    const h = buka(empatPerkara(), { simpanan: { modeLatihan: true } });
    const kotak = await bagianMassal(h);
    centangSemua(kotak);
    const kabar = await tekanDanTunggu(kotak, /Dihentikan|siap|gagal/);
    expect(h.tulis).toEqual([]);
    expect(kabar).toMatch(/^Dihentikan di 801/);
    expect(kabar).toMatch(/[Ll]atihan/);
    expect(kabar).not.toMatch(/mode_latihan/);
    expect(h.usulanDiminta).toEqual([N[0]]);
  });
});

// ============================================================================
describe("daftar yang seluruhnya lengkap, dan ekstensi yang dimuat ulang di tengah", () => {
  it("seluruh perkara di halaman sudah lengkap: tidak ada yang ditawarkan, tidak ada tombol", async () => {
    const L = { pmh: T, ppp: T, pjs: T, phs: T };
    const h = buka({ [N[0]]: { id: 9901, keadaan: { ...L } }, [N[1]]: { id: 9902, keadaan: { ...L } } });
    const kotak = await bagianMassal(h);
    expect(kotak.textContent).toMatch(/Keempat penetapan sudah lengkap pada 2 perkara/);
    expect(kotak.querySelector(".aleta-massal-centang")).toBeNull();
    expect(kotak.querySelector(".aleta-tetap-kaki button")).toBeNull();
  });

  it("ekstensi dimuat ulang sesudah diperiksa: penulisan dilaporkan menurut jawaban bot, tanpa galat lepas", async () => {
    const h = buka(empatPerkara());
    const kotak = await bagianMassal(h);
    centangSemua(kotak);
    await tekanDanTunggu(kotak, /Tekan sekali lagi/);
    h.putuskanEkstensi();
    const kabar = await tekanDanTunggu(kotak, /^Selesai|Dihentikan|terhenti/);
    expect(kabar).toMatch(/^Selesai: 4 perkara ditetapkan/);
    // Yang dilaporkan ditetapkan memang tertulis di bot tiruan.
    expect(nyataPer(h, N[0])).toEqual(["pmh", "ppp", "pjs", "phs"]);
    expect(nyataPer(h, N[2])).toEqual(["ppp", "pjs", "phs"]);
    expect(h.galatLepas).toEqual([]);
  });
});

// ============================================================================
describe("antrean putusan massal (lanjutan SIPP): ekstensi dimuat ulang di tengah antrean", () => {
  const NP = "811/Pdt.G/2026/PA.Dgl";
  function antreanSatu(h: ReturnType<typeof buka>, keadaanButir = "menunggu") {
    const antrean = {
      id: "massal-uji-u2a",
      dibuat: "2026-10-09T00:00:00.000Z",
      tanggalSidang: "2026-10-09",
      tahap: "sipp",
      asal: "sidang",
      modus: "manual",
      kering: false,
      posisi: 0,
      butir: [{ nomor: NP, perkaraId: "1", jenis: "Cerai Gugat", enc: "", keadaan: keadaanButir, catatan: "", dokumen: {} }],
    };
    h.simpanan.antreanPutusanMassal = polos(antrean);
    return antrean;
  }

  it("alatUbahButirAntrean / alatBacaButirAntrean: penyimpanan yang putus disebut 'terputus', bukan 'diakhiri'", async () => {
    const h = buka(empatPerkara());
    await bagianMassal(h);
    const antrean = antreanSatu(h);
    h.putuskanEkstensi();
    const ubah = polos(await h.w.alatUbahButirAntrean(antrean.id, NP, (b: any) => void (b.keadaan = "jalan")));
    expect(ubah).toMatchObject({ ok: false, sebab: "terputus" });
    const bacaan = polos(await h.w.alatBacaButirAntrean(antrean.id, NP));
    expect(bacaan).toMatchObject({ ok: false, sebab: "terputus" });
  });

  it("menekan 'Isi putusan & simpan' sesudah ekstensi dimuat ulang: berhenti rapi, kalimatnya menyuruh memuat ulang halaman, Simpan tidak ditekan", async () => {
    const h = buka(empatPerkara());
    await bagianMassal(h);
    const antrean = antreanSatu(h);
    let simpanDitekan = 0;
    h.w.simpanPutusanLaluBuka = async () => {
      simpanDitekan += 1;
      return { ok: true, bunyi: "Tersimpan di SIPP." };
    };
    h.putuskanEkstensi();
    const kabar = h.d.createElement("div");
    const tombol = h.d.createElement("button");
    await h.w.jalankanAntreanSippSekali(antrean, antrean.butir[0], kabar, tombol, false);
    expect(simpanDitekan).toBe(0);
    expect(kabar.textContent).toMatch(/dimuat ulang atau diperbarui/);
    expect(kabar.textContent).toMatch(/[Mm]uat ulang halaman/);
    expect(kabar.textContent).not.toMatch(/sudah diakhiri atau diganti/);
    // Penyimpanan tidak berubah: perkaranya tetap menunggu, tidak ditandai selesai.
    expect((h.simpanan.antreanPutusanMassal as any).butir[0].keadaan).toBe("menunggu");
    expect(h.galatLepas).toEqual([]);
  });

  it("'Akhiri antrean' sesudah ekstensi dimuat ulang: panel TIDAK dibuang, disebut belum diakhiri", async () => {
    const h = buka(empatPerkara());
    await bagianMassal(h);
    antreanSatu(h);
    const kotak = await h.w.bagianAntreanSipp("");
    expect(kotak).toBeTruthy();
    h.d.body.appendChild(kotak);
    h.putuskanEkstensi();
    const tombol = Array.from(kotak.querySelectorAll("button") as NodeListOf<HTMLButtonElement>).find((b) => b.textContent === "Akhiri antrean")!;
    tombol.click();
    await sampai(() => /BELUM diakhiri/.test(String(kotak.textContent)), () => `kabar; kini ${kotak.textContent}`);
    expect(kotak.isConnected).toBe(true);
    expect(h.simpanan.antreanPutusanMassal).toBeTruthy();
  });

  it("antrean yang memang diakhiri tetap disebut diakhiri (perilaku lama)", async () => {
    const h = buka(empatPerkara());
    await bagianMassal(h);
    const antrean = antreanSatu(h);
    delete h.simpanan.antreanPutusanMassal;
    const kabar = h.d.createElement("div");
    await h.w.jalankanAntreanSippSekali(antrean, antrean.butir[0], kabar, null, false);
    expect(kabar.textContent).toMatch(/sudah diakhiri atau diganti/);
  });
});
