// @vitest-environment node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

/**
 * ============================================================================
 * PENETAPAN SISA - PER PERKARA DAN MASSAL (7 Oktober 2026, keluhan 4 & 5)
 * ============================================================================
 *
 * "penetapan massal itu tidak berfungsi, ingat yang ditetapkan itu apabila
 * sudah ada satu tahapannya yang dikerja manual maka aleta kerjakan penetapan
 * sisa lainnya secara massal (tadi saya coba error)".
 *
 * Dijaga dengan MENJALANKAN panel-alat.js, basmassal.js, dan konten.js UTUH di
 * jsdom atas halaman daftar SIPP tiruan (/SIPP/main, kepala "Selamat Datang"
 * seperti header.php SIPP), dengan bot tiruan yang menolak langkah yang sudah
 * ada persis seperti penetapanTulisService (`<jenis>_sudah_ada`).
 *
 * ALETA_UJI_KONTEN menunjuk SALINAN konten.js untuk pembukti gigitan.
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
type Tulis = { nomor: string; perkaraId: number; jenis: Jenis; kering: boolean; olehUsername: string; tanggalPenetapan: string; rantaiSebelum: string[] };

/** Perkara tiruan: nomor -> { id, keadaan penetapan, usulanGagal? , tulisGagal? }. */
type Perkara = { id: number; keadaan: Keadaan; usulanGagal?: boolean; tulisGagal?: Jenis };

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

function buka(perkara: Record<string, Perkara>, opsi: { alamat?: string; html?: string; nyata?: boolean } = {}) {
  const baris = Object.keys(perkara)
    .map((nomor, i) => `<tr><td>${i + 1}</td><td>${nomor}</td><td>Cerai Gugat</td></tr>`)
    .join("");
  const kepala =
    `<table class="badge"><tr><td>Selamat Datang <font color='red'>${AKUN}</font>` +
    `<br> Anda Login Sebagai <font color='red'>Administrator</font></td></tr></table>`;
  const html = opsi.html ?? `${kepala}<table id="daftar"><tr><th>No</th><th>Nomor Perkara</th><th>Jenis</th></tr>${baris}</table>`;
  const dom = new JSDOM(`<!doctype html><html><head><title>SIPP</title></head><body><div id="konten">${html}</div></body></html>`, {
    url: `${ASAL}${opsi.alamat ?? "/SIPP/main"}`,
    runScripts: "outside-only",
    pretendToBeVisual: true,
  } as ConstructorParameters<typeof JSDOM>[1]);
  terbuka.push(dom);
  const w = dom.window as any;
  w.TextDecoder = globalThis.TextDecoder;
  w.Response = globalThis.Response;
  const simpanan: Record<string, unknown> = { ujiTampilan: "ui", ujiIzinkanNyata: opsi.nyata !== false };
  w.chrome = {
    runtime: { id: "aleta-uji", getManifest: () => ({ version: "1.187.1" }), getURL: (x: string) => `chrome-extension://aleta-uji/${x}`, sendMessage: async () => ({}) },
    storage: {
      local: {
        get: async (kunci?: string | string[] | null) => {
          const daftar = kunci == null ? Object.keys(simpanan) : [kunci].flat();
          const hasil: Record<string, unknown> = {};
          for (const k of daftar) if (k in simpanan) hasil[k] = polos(simpanan[k]);
          return hasil;
        },
        set: async (isi: Record<string, unknown>) => void Object.assign(simpanan, polos(isi)),
        remove: async () => undefined,
      },
      session: { get: async () => ({}), set: async () => undefined },
      onChanged: { addListener: () => undefined },
    },
  };
  const tulis: Tulis[] = [];
  const usulanDiminta: string[] = [];
  const nomorDariId = (id: number) => Object.keys(perkara).find((n) => perkara[n].id === id) || "";
  w.fetch = async (alamat: string, opsi?: { method?: string; body?: string }) => {
    const url = String(alamat);
    const cara = String((opsi && opsi.method) || "GET").toUpperCase();
    let status = 200;
    let isi: unknown = { ok: true, data: {} };
    if (url.includes("/api/aleta-ecourt/ekstensi/tampilan")) {
      status = 404;
      isi = {};
    } else if (url.includes("/aleta-ecourt/ekstensi/siapa")) {
      isi = { ok: true, data: { nama: "SUPER ADMIN DERRY", peran: "Super Admin", kapabilitas: null } };
    } else if (url.includes("/aleta-bot/sipp-konteks/massal")) {
      const identitas: Record<string, unknown> = {};
      const lencana: Record<string, unknown> = {};
      for (const [nomor, p] of Object.entries(perkara)) {
        lencana[nomor] = {};
        identitas[nomor] = {
          penetapan: { pmh: Boolean(p.keadaan.pmh), ppp: Boolean(p.keadaan.ppp), pjs: Boolean(p.keadaan.pjs), phs: Boolean(p.keadaan.phs) },
        };
      }
      isi = { ok: true, data: { available: true, perkara: lencana, identitas } };
    } else if (url.includes("/aleta-bot/penunjukan/ruangan")) {
      isi = { ok: true, data: { ruangan: [] } };
    } else if (url.includes("/aleta-bot/penunjukan?")) {
      const nomor = decodeURIComponent((/nomor=([^&]+)/.exec(url) || [])[1] || "");
      usulanDiminta.push(nomor);
      const p = perkara[nomor];
      if (!p || p.usulanGagal) {
        status = 500;
        isi = { ok: false, error: "bot tidak menjawab" };
      } else {
        isi = { ok: true, data: { available: true, usulan: usulanUntuk(nomor, p), rencana: { langkah: [] } } };
      }
    } else if (url.includes("/aleta-bot/penunjukan/tulis") && cara === "POST") {
      const badan = JSON.parse(String(opsi?.body || "{}"));
      const nomor = nomorDariId(Number(badan.perkaraId));
      const p = perkara[nomor];
      const jenis = badan.jenis as Jenis;
      tulis.push({ nomor, perkaraId: badan.perkaraId, jenis, kering: badan.kering !== false, olehUsername: badan.olehUsername, tanggalPenetapan: badan.tanggalPenetapan, rantaiSebelum: badan.rantaiSebelum || [] });
      // Bot tiruan = penjaga penetapanTulisService.
      if (p.keadaan[jenis]) {
        status = 409;
        isi = { ok: false, alasan: `${jenis}_sudah_ada` };
      } else if (p.tulisGagal === jenis) {
        status = 409;
        isi = { ok: false, alasan: "hakim_tidak_ketemu" };
      } else {
        const urut: Jenis[] = ["pmh", "ppp", "pjs", "phs"];
        const sebelum = urut.slice(0, urut.indexOf(jenis));
        const kurang = sebelum.find((x) => !p.keadaan[x] && !(badan.rantaiSebelum || []).includes(x));
        if (kurang && jenis !== "ppp" && jenis !== "pjs") {
          status = 409;
          isi = { ok: false, alasan: `${kurang}_belum_ada` };
        } else {
          if (badan.kering === false) p.keadaan[jenis] = badan.tanggalPenetapan;
          isi = { ok: true, langkah: [{ tabel: "perkara_penetapan" }], andaian: [], tanggalPenetapan: badan.tanggalPenetapan };
        }
      }
    }
    const r: any = {
      ok: status >= 200 && status < 300,
      status,
      statusText: "",
      url,
      redirected: false,
      headers: { get: () => "application/json" },
      json: async () => polos(isi),
      text: async () => JSON.stringify(isi ?? {}),
      clone: () => r,
    };
    return r;
  };
  // Jeda manusia tiruan - nol detik di uji.
  const ctx = (dom as unknown as { getInternalVMContext(): vm.Context }).getInternalVMContext();
  vm.runInContext(ALAT, ctx, { filename: "panel-alat.js" });
  vm.runInContext("alatSetelJedaSkala(0)", ctx);
  vm.runInContext(BASMASSAL, ctx, { filename: "basmassal.js" });
  vm.runInContext(KONTEN(), ctx, { filename: "konten.js" });
  return { dom, w, d: w.document as Document, tulis, usulanDiminta };
}

async function bagianMassal(h: ReturnType<typeof buka>) {
  return sampai(() => {
    const kotak = h.d.querySelector('.aleta-bagian[data-kunci="penetapanMassal"]') as HTMLElement | null;
    return kotak && kotak.querySelector(".aleta-massal-centang") ? kotak : null;
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

// ============================================================================
describe("rantai penetapan per perkara: hanya SISANYA, berurutan PMH -> PPP -> PJS -> PHS", () => {
  async function rantai(keadaan: Keadaan, kering: boolean) {
    const nomor = "700/Pdt.G/2026/PA.Dgl";
    const h = buka({ [nomor]: { id: 9001, keadaan }, "701/Pdt.G/2026/PA.Dgl": { id: 9002, keadaan: kosong() } });
    await bagianMassal(h);
    const usulan = usulanUntuk(nomor, { id: 9001, keadaan });
    const hasil = await h.w.rantaiPenetapan(usulan, { usulan, rencana: { langkah: [] } }, kering);
    return { h, hasil: polos(hasil) as Array<{ jenis: string; ok: boolean; alasan: string; sudahAda?: boolean }> };
  }

  it("kosong -> keempat langkah dikirim, urut PMH, PPP, PJS, PHS", async () => {
    const { h, hasil } = await rantai(kosong(), false);
    expect(h.tulis.map((x) => x.jenis)).toEqual(["pmh", "ppp", "pjs", "phs"]);
    expect(hasil.every((x) => x.ok)).toBe(true);
    // Atas akun SIPP yang sedang masuk - bukan pejabat, bukan "PP".
    expect(h.tulis.every((x) => x.olehUsername === AKUN)).toBe(true);
  });

  it("PMH sudah ada (manual) -> yang DIKIRIM hanya PPP, PJS, PHS; PMH dilewati tanpa menyentuh bot", async () => {
    const { h, hasil } = await rantai({ ...kosong(), pmh: "2026-10-06" }, false);
    expect(h.tulis.map((x) => x.jenis)).toEqual(["ppp", "pjs", "phs"]);
    expect(hasil.find((x) => x.jenis === "pmh")).toMatchObject({ ok: false, alasan: "pmh_sudah_ada", sudahAda: true });
    // Setanggal PMH yang sudah ada - bukan hari ini.
    expect(h.tulis.every((x) => x.tanggalPenetapan === "2026-10-06")).toBe(true);
    // PMH yang sudah ada ikut rantaiSebelum - PHS menuntutnya.
    expect(h.tulis.find((x) => x.jenis === "phs")!.rantaiSebelum).toEqual(["pmh", "ppp", "pjs"]);
  });

  it("PMH + PPP sudah ada -> hanya PJS dan PHS", async () => {
    const { h } = await rantai({ ...kosong(), pmh: T, ppp: T }, false);
    expect(h.tulis.map((x) => x.jenis)).toEqual(["pjs", "phs"]);
  });

  it("PMH + PPP + PJS sudah ada -> hanya PHS", async () => {
    const { h } = await rantai({ pmh: T, ppp: T, pjs: T, phs: "" }, false);
    expect(h.tulis.map((x) => x.jenis)).toEqual(["phs"]);
  });

  it("lengkap -> tidak satu pun dikirim, keempatnya tercatat sudah ada", async () => {
    const { h, hasil } = await rantai({ pmh: T, ppp: T, pjs: T, phs: T }, false);
    expect(h.tulis).toEqual([]);
    expect(hasil.map((x) => x.alasan)).toEqual(["pmh_sudah_ada", "ppp_sudah_ada", "pjs_sudah_ada", "phs_sudah_ada"]);
  });

  it("PMH yang sudah ada tetapi usulannya tidak dapat disusun (belum-tentu) TIDAK memutus rantai", async () => {
    const nomor = "702/Pdt.G/2026/PA.Dgl";
    const keadaan = { ...kosong(), pmh: T };
    const h = buka({ [nomor]: { id: 9003, keadaan }, "703/Pdt.G/2026/PA.Dgl": { id: 9004, keadaan: kosong() } });
    await bagianMassal(h);
    const usulan: any = usulanUntuk(nomor, { id: 9003, keadaan });
    usulan.pmh = { bentuk: "belum-tentu", anggota: [], hitungan: [] };
    const hasil = polos(await h.w.rantaiPenetapan(usulan, { usulan }, true)) as Array<{ jenis: string; ok: boolean }>;
    expect(h.tulis.map((x) => x.jenis)).toEqual(["ppp", "pjs", "phs"]);
    expect(hasil.filter((x) => x.ok).map((x) => x.jenis)).toEqual(["ppp", "pjs", "phs"]);
  });

  it("langkah yang ternyata sudah ada di SIPP (bot menjawab _sudah_ada) tetap dilewati, rantai berjalan", async () => {
    // Keadaan usulan basi: panel mengira PPP belum ada, SIPP sudah punya.
    const nomor = "704/Pdt.G/2026/PA.Dgl";
    const h = buka({ [nomor]: { id: 9005, keadaan: { ...kosong(), pmh: T, ppp: T } }, "705/Pdt.G/2026/PA.Dgl": { id: 9006, keadaan: kosong() } });
    await bagianMassal(h);
    const usulan = usulanUntuk(nomor, { id: 9005, keadaan: { ...kosong(), pmh: T } });
    await h.w.rantaiPenetapan(usulan, { usulan }, false);
    expect(h.tulis.map((x) => x.jenis)).toEqual(["ppp", "pjs", "phs"]);
  });
});

// ============================================================================
describe("penetapan massal: campuran perkara, satu gagal tidak menghentikan yang lain", () => {
  const A = "710/Pdt.G/2026/PA.Dgl"; // kosong
  const B = "711/Pdt.G/2026/PA.Dgl"; // PMH manual
  const C = "712/Pdt.G/2026/PA.Dgl"; // PMH + PPP manual
  const D = "713/Pdt.G/2026/PA.Dgl"; // usulan gagal disusun
  const E = "714/Pdt.G/2026/PA.Dgl"; // bot menolak PMH
  const F = "715/Pdt.G/2026/PA.Dgl"; // lengkap - tidak ditawarkan

  function campuran(): Record<string, Perkara> {
    return {
      [D]: { id: 9104, keadaan: kosong(), usulanGagal: true },
      [E]: { id: 9105, keadaan: kosong(), tulisGagal: "pmh" },
      [A]: { id: 9101, keadaan: kosong() },
      [B]: { id: 9102, keadaan: { ...kosong(), pmh: "2026-10-06" } },
      [C]: { id: 9103, keadaan: { ...kosong(), pmh: T, ppp: T } },
      [F]: { id: 9106, keadaan: { pmh: T, ppp: T, pjs: T, phs: T } },
    };
  }

  it("Periksa: perkara yang gagal di urutan PERTAMA tidak menghentikan antrean - semua diperiksa", async () => {
    const h = buka(campuran());
    const kotak = await bagianMassal(h);
    expect(kotak.textContent).not.toContain(F);
    centangSemua(kotak);
    const kabar = await tekanDanTunggu(kotak, /siap ditetapkan|Tekan sekali lagi|Tidak ada/);
    // Seluruh perkara terpilih diminta usulannya - tidak berhenti di D.
    expect(h.usulanDiminta).toEqual(expect.arrayContaining([A, B, C, D, E]));
    expect(h.tulis.every((x) => x.kering)).toBe(true);
    expect(kabar).toMatch(/3 perkara siap/);
    expect(kabar).toMatch(/2 perkara gagal/);
    expect(keadaanBaris(kotak, D)).toMatch(/gagal/i);
    expect(keadaanBaris(kotak, E)).toMatch(/gagal/i);
    expect(keadaanBaris(kotak, B)).toMatch(/PPP, PJS, PHS/);
    expect(keadaanBaris(kotak, B)).toMatch(/PMH sudah ada/);
    expect(tombolDari(kotak).disabled).toBe(false);
    expect(tombolDari(kotak).textContent).toMatch(/Tetapkan 3 perkara/);
  });

  it("Tetapkan: hanya SISA tiap perkara yang ditulis, berurutan; yang gagal dilewati dengan sebab", async () => {
    const perkara = campuran();
    const h = buka(perkara);
    const kotak = await bagianMassal(h);
    centangSemua(kotak);
    await tekanDanTunggu(kotak, /Tekan sekali lagi/);
    h.tulis.length = 0;
    const kabar = await tekanDanTunggu(kotak, /^Selesai/);
    const nyata = h.tulis.filter((x) => !x.kering);
    const per = (n: string) => nyata.filter((x) => x.nomor === n).map((x) => x.jenis);
    expect(per(A)).toEqual(["pmh", "ppp", "pjs", "phs"]);
    expect(per(B)).toEqual(["ppp", "pjs", "phs"]);
    expect(per(C)).toEqual(["pjs", "phs"]);
    // D dan E tidak ditulis sungguhan sama sekali - gagal saat diperiksa.
    expect(per(D)).toEqual([]);
    expect(per(E)).toEqual([]);
    expect(perkara[B].keadaan).toEqual({ pmh: "2026-10-06", ppp: "2026-10-06", pjs: "2026-10-06", phs: "2026-10-06" });
    expect(kabar).toMatch(/3 perkara ditetapkan/);
    expect(keadaanBaris(kotak, A)).toMatch(/ditetapkan/);
  });

  it("satu perkara gagal SAAT DITULIS tidak menghentikan perkara sesudahnya", async () => {
    const perkara: Record<string, Perkara> = {
      [A]: { id: 9101, keadaan: kosong() },
      [B]: { id: 9102, keadaan: { ...kosong(), pmh: T } },
      [C]: { id: 9103, keadaan: { ...kosong(), pmh: T, ppp: T } },
    };
    const h = buka(perkara);
    const kotak = await bagianMassal(h);
    centangSemua(kotak);
    await tekanDanTunggu(kotak, /Tekan sekali lagi/);
    // Sesudah diperiksa, PPP perkara B mendadak ditolak bot.
    perkara[B].tulisGagal = "ppp";
    const kabar = await tekanDanTunggu(kotak, /^Selesai/);
    const nyata = h.tulis.filter((x) => !x.kering);
    expect(nyata.filter((x) => x.nomor === C).map((x) => x.jenis)).toEqual(["pjs", "phs"]);
    expect(nyata.filter((x) => x.nomor === B).map((x) => x.jenis)).toEqual(["ppp"]);
    expect(kabar).toMatch(/2 perkara ditetapkan/);
    expect(kabar).toMatch(/1 perkara gagal/);
    expect(keadaanBaris(kotak, B)).toMatch(/PPP/);
  });
});

// ============================================================================
describe("penolakan menyeluruh menghentikan antrean dengan kalimat yang dapat dikerjakan", () => {
  it("mode coba (tanpa 'Izinkan tindakan nyata'): berhenti di perkara pertama, sebabnya disebut", async () => {
    const A = "720/Pdt.G/2026/PA.Dgl";
    const B = "721/Pdt.G/2026/PA.Dgl";
    const h = buka({ [A]: { id: 9201, keadaan: kosong() }, [B]: { id: 9202, keadaan: kosong() } }, { nyata: false });
    const kotak = await bagianMassal(h);
    centangSemua(kotak);
    const kabar = await tekanDanTunggu(kotak, /Dihentikan|siap/);
    expect(kabar).toMatch(/^Dihentikan di 720/);
    expect(kabar).toMatch(/Mode coba sedang aktif/);
    expect(kabar).toMatch(/Izinkan tindakan nyata/);
    // Mode coba menahan kiriman di peramban - bot tidak pernah menerimanya.
    expect(h.tulis).toEqual([]);
    // Perkara kedua tidak diulang dengan penolakan yang sama.
    expect(h.usulanDiminta).toEqual([A]);
  });
});

// ============================================================================
describe("tombol per perkara: PMH yang sudah ada tidak lagi mengunci langkah tulis", () => {
  it("tetapkanLewatAleta: PMH sudah ada -> ok (sisa siap ditulis), dikerjakan 3", async () => {
    const nomor = "730/Pdt.G/2026/PA.Dgl";
    const keadaan = { ...kosong(), pmh: T };
    const h = buka({ [nomor]: { id: 9301, keadaan }, "731/Pdt.G/2026/PA.Dgl": { id: 9302, keadaan: kosong() } });
    await bagianMassal(h);
    const usulan = usulanUntuk(nomor, { id: 9301, keadaan });
    const kabar = h.d.createElement("div");
    const r = polos(await h.w.tetapkanLewatAleta(null, kabar, usulan, { usulan }, {}, true)) as any;
    expect(r.ok).toBe(true);
    expect(r.dikerjakan).toBe(3);
    expect(kabar.textContent).toMatch(/PMH\s*sudah ada di SIPP/);
  });

  it("tetapkanLewatAleta: lengkap -> ok tanpa satu pun langkah (tombol tulis tidak dibuka)", async () => {
    const nomor = "732/Pdt.G/2026/PA.Dgl";
    const keadaan = { pmh: T, ppp: T, pjs: T, phs: T };
    const h = buka({ [nomor]: { id: 9303, keadaan }, "733/Pdt.G/2026/PA.Dgl": { id: 9304, keadaan: kosong() } });
    await bagianMassal(h);
    const usulan = usulanUntuk(nomor, { id: 9303, keadaan });
    const r = polos(await h.w.tetapkanLewatAleta(null, h.d.createElement("div"), usulan, { usulan }, {}, true)) as any;
    expect(r).toMatchObject({ ok: true, dikerjakan: 0 });
    expect(h.tulis).toEqual([]);
    expect(KONTEN()).toContain('tombol.textContent = "Keempat penetapan sudah ada";');
  });
});

// ============================================================================
describe("bot: PPP dan PHS mengikuti majelis TERCATAT bila PMH sudah ada", () => {
  const akarRepo = path.resolve(process.cwd(), "..");
  const require_ = createRequire(path.join(akarRepo, "aleta_bot/package.json"));
  const { majelisAcuan } = require_("./services/penunjukanService.js");
  const sk = [
    { majelisKode: "A", hakimKode: ["A", "C1", "C3"] },
    { majelisKode: "B", hakimKode: ["B", "C2", "C3"] },
  ];
  const aktif = [
    { hakimId: 32, kode: "A", nama: "Fahri" },
    { hakimId: 26, kode: "C1", nama: "Himawan" },
    { hakimId: 31, kode: "C3", nama: "Derry" },
    { hakimId: 33, kode: "B", nama: "Wakil" },
    { hakimId: 28, kode: "C2", nama: "Hakim C2" },
  ];
  const usulanPmh = { majelisKode: "A", anggota: [{ hakimId: 32, kode: "A" }, { hakimId: 26, kode: "C1" }, { hakimId: 31, kode: "C3" }] };

  it("belum ada PMH: acuannya usulan (perilaku lama)", () => {
    expect(majelisAcuan(usulanPmh, { pmh: "" }, [], aktif, sk)).toMatchObject({ majelisKode: "A", dariTercatat: false });
  });

  it("PMH tangan memakai majelis B: acuan B, ketua lebih dahulu - bukan usulan A", () => {
    const tercatat = [
      { hakimId: 31, nama: "Derry", jabatanId: 2 },
      { hakimId: 33, nama: "Wakil", jabatanId: 1 },
      { hakimId: 28, nama: "Hakim C2", jabatanId: 2 },
    ];
    const acuan = majelisAcuan(usulanPmh, { pmh: T }, tercatat, aktif, sk);
    expect(acuan.dariTercatat).toBe(true);
    expect(acuan.majelisKode).toBe("B");
    expect(acuan.anggota[0]).toMatchObject({ hakimId: 33, kode: "B" });
  });

  it("susunan tercatat di luar SK: kode kosong (hari sidang lalu mengikuti ketua)", () => {
    const acuan = majelisAcuan(usulanPmh, { pmh: T }, [{ hakimId: 26, nama: "Himawan", jabatanId: 3 }], aktif, sk);
    expect(acuan).toMatchObject({ majelisKode: "", dariTercatat: true });
    expect(acuan.anggota[0].kode).toBe("C1");
  });

  it("PPP dan PHS di usulanPenunjukan membaca acuan, bukan pmh usulan", () => {
    const layanan = readFileSync(path.join(akarRepo, "aleta_bot/services/penunjukanService.js"), "utf8");
    const awal = layanan.indexOf("const acuan = majelisAcuan(");
    const akhir = layanan.indexOf("const tanggalPenetapan = penetapan.pmh || isoTanggal(new Date());", awal);
    expect(awal).toBeGreaterThan(0);
    const bagian = layanan.slice(awal, akhir);
    expect(bagian).not.toMatch(/\bpmh\.majelisKode\b|\bpmh\.anggota\b/);
    expect(bagian).toContain("susunanSk.find((x) => x.majelisKode === acuan.majelisKode)");
  });
});

// ============================================================================
describe("urutan audit PMH (+ Smart Majelis) -> PPP -> PJS -> PHS", () => {
  const tulisService = readFileSync(path.join(path.resolve(process.cwd(), ".."), "aleta_bot/services/penetapanTulisService.js"), "utf8");

  it("Smart Majelis ditulis DI DALAM langkah PMH (judul audit hakim_pn), bukan langkah tersendiri", () => {
    // SIPP sendiri (diukur 7 Okt 2026 di SIPP satker): 879 dari 879 perkara
    // 2026 ber-PMH punya baris perkara_smartmajelis, ditulis pada Simpan PMH
    // tanpa baris audit sendiri; kata "Smart Majelis" hanya ada pada judul
    // audit perkara_hakim_pn. PMH tangan karena itu sudah membawa Smart
    // Majelis-nya, dan sisa rantai langsung ke PPP.
    expect(tulisService).toContain("judulHalaman: lewatSmart ? ` Smart Majelis ${jejak.formulir}` : undefined,");
    const awalPmh = tulisService.indexOf('if (jenis === "pmh") {');
    const smart = tulisService.indexOf('tabel: "perkara_smartmajelis"', awalPmh);
    const hakimPn = tulisService.indexOf('tabel: "perkara_hakim_pn"', awalPmh);
    expect(smart).toBeGreaterThan(awalPmh);
    expect(smart).toBeLessThan(hakimPn);
  });

  it("rantai ekstensi: URUTAN_TULIS tetap pmh, ppp, pjs, phs; yang sudah ada tidak dikirim", () => {
    const konten = KONTEN();
    expect(konten).toContain('const URUTAN_TULIS = ["pmh", "ppp", "pjs", "phs"];');
    expect(konten).toContain("const sudahDiSipp = keadaanPenetapanUsulan(usulan);");
  });
});
