// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

/**
 * ============================================================================
 * PERBAIKAN 30 SEPTEMBER 2026 SORE - MENU PER PERAN DI PANEL SIPP (agen S)
 * ============================================================================
 *
 * Dijaga dengan MENJALANKAN panel-alat.js dan konten.js UTUH di jsdom:
 *
 *   butir 1  menu di dalam perkara mengikuti alatMenuPeran("sipp","perkara")
 *            - urutan kelompok (Baru) / tab (UI Baru), menu pertama terbuka,
 *            yang tidak di menu DISEMBUNYIKAN (tetap di DOM), Admin/Super Admin
 *            melihat semuanya, peran "lain" = susunan lama.
 *   K2       "ditangani" dari majelis/PP/JS status perkara; tidak pasti =
 *            tidak mengurangi. Penetapan Ketua/Wakil hilang bila PMH/PPP/PJS/
 *            PHS lengkap; Ketua bukan majelis tetap melihat Penetapan.
 *   Juru Sita tab Super Admin/Admin tampil walau aletaJurusitaBoleh berkata
 *            tidak (matriks yang memutuskan).
 *   daftar   menu massal mengikuti alatMenuPeran("sipp","daftar"); juru sita
 *            tidak lagi melihat Putusan massal; BAS/Relaas massal lewat fungsi
 *            global agen M/J (tidak ada = dilewati tanpa error); gerbang izin
 *            lama tetap di atas matriks.
 *   butir 3  penjelasan teknis diberi kelas aleta-teknis (error tidak).
 *   Lama     tanpa satu pun jejak.
 *
 * ALETA_UJI_KONTEN menunjuk SALINAN konten.js untuk pembukti gigitan.
 */

const AKAR = path.resolve(process.cwd(), "../ekstensi-sipp");
const baca = (b: string) => readFileSync(path.join(AKAR, b), "utf8").replace(/\r\n/g, "\n");
const KONTEN = () => (process.env.ALETA_UJI_KONTEN ? readFileSync(process.env.ALETA_UJI_KONTEN, "utf8") : baca("konten.js"));
const ALAT = baca("panel-alat.js");
const GAYA = baca("panel.css");

const ASAL = "http://192.168.10.10";
const NOMOR = "450/Pdt.G/2026/PA.Dgl";

const polos = <T>(x: T): T => (x === undefined ? x : JSON.parse(JSON.stringify(x)));
const tunggu = (ms = 0) => new Promise((r) => setTimeout(r, ms));

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
// Portal tiruan
// ----------------------------------------------------------------------------
function konteksContoh() {
  return {
    ok: true,
    nomorPerkara: NOMOR,
    nomorRegister: "PA.DGL-2026-0450",
    identitas: { ditemukan: true, jenisPerkara: "Cerai Gugat", jenisPerkaraLengkap: "Cerai Gugat", adaKumulasi: false, kumulasi: [], adaKuasa: false },
    ringkasan: { dokumen: 1 },
    dokumen: [
      {
        judulDokumen: "Jawaban",
        agenda: "Jawaban",
        sisaHari: 2,
        batasUnggahTeks: "Batas unggah 2 hari lagi",
        statusVerifikasi: "menunggu",
        adaPdf: true,
        adaWord: false,
        documentKey: "k1",
      },
    ],
    selisih: [],
    nomorPihak: [],
    diperiksaPada: new Date().toISOString(),
    ambangMendesakHari: 3,
    hakim: null,
  };
}

type Petugas = { majelis?: string[]; panitera?: string[]; jurusita?: string[]; lengkap?: boolean; tidakTerbaca?: boolean; gagal?: boolean };

function statusContoh(p: Petugas) {
  const orang = (d: string[] = []) => d.map((nama) => ({ nama }));
  const tgl = (isi: boolean) => (isi ? "2026-09-10" : "");
  return {
    majelis: orang(p.majelis),
    panitera: orang(p.panitera),
    jurusita: orang(p.jurusita),
    ikrar: null,
    sumberMajelis: p.tidakTerbaca ? "tidakTerbaca" : "pemeriksa",
    putusan: { sudahPutus: false },
    putusanLengkap: {},
    penilaianSk: { rinci: [] },
    tahapan: {
      terbaca: true,
      tahap: [
        { kunci: "pendaftaran", terbaca: true, tanggal: "2026-09-01" },
        { kunci: "pmh", terbaca: true, tanggal: tgl(true) },
        { kunci: "ppp", terbaca: true, tanggal: tgl(true) },
        { kunci: "pjs", terbaca: true, tanggal: tgl(true) },
        { kunci: "phs", terbaca: true, tanggal: tgl(Boolean(p.lengkap)) },
      ],
    },
  };
}

type Minta = { url: string; cara: string };

type Halaman = {
  dom: JSDOM;
  w: any;
  d: Document;
  minta: Minta[];
  jurusita: Array<Record<string, unknown>>;
  massal: Array<{ jenis: string; opsi: Record<string, unknown> }>;
};

const terbuka: JSDOM[] = [];
afterEach(async () => {
  await tunggu(20);
  while (terbuka.length) terbuka.pop()!.window.close();
});

type Opsi = {
  simpanan?: Record<string, unknown>;
  peran?: string;
  nama?: string;
  petugas?: Petugas;
  daftar?: boolean;
  jurusita?: boolean;
  /** aletaJurusitaBoleh tiruan - bawaannya menolak semua (keadaan Super Admin yang dilaporkan). */
  jurusitaBoleh?: (peran: string) => boolean;
  massalBas?: boolean | "tolak";
  massalRelaas?: boolean | "tolak";
  kapabilitas?: Record<string, boolean> | null;
};

const HTML_DAFTAR = `<table><tr><th>No</th><th>Nomor Perkara</th></tr>
<tr><td>1</td><td>621/Pdt.G/2026/PA.Dgl</td></tr>
<tr><td>2</td><td>620/Pdt.G/2026/PA.Dgl</td></tr>
<tr><td>3</td><td>619/Pdt.G/2026/PA.Dgl</td></tr></table>`;

function buka(p: Opsi = {}): Halaman {
  const peran = p.peran ?? "Super Admin";
  const nama = p.nama ?? "Munifa, S.H.";
  const dom = new JSDOM(
    p.daftar
      ? `<!doctype html><html><head><title>SIPP</title></head><body><div id="konten"><h3>DAFTAR PERKARA</h3>${HTML_DAFTAR}</div></body></html>`
      : `<!doctype html><html><head><title>SIPP</title></head><body><div id="konten"><h3>Nomor Perkara ${NOMOR}</h3></div></body></html>`,
    {
      url: p.daftar ? `${ASAL}/SIPP/main` : `${ASAL}/SIPP/detil_perkara_agama`,
      runScripts: "outside-only",
      pretendToBeVisual: true,
    } as ConstructorParameters<typeof JSDOM>[1]
  );
  terbuka.push(dom);
  const w = dom.window as any;
  Object.defineProperty(w.HTMLElement.prototype, "innerText", {
    configurable: true,
    get() {
      return this.textContent;
    },
  });
  w.TextDecoder = globalThis.TextDecoder;
  w.Response = globalThis.Response;
  const simpanan: Record<string, unknown> = polos(p.simpanan ?? {});
  const pendengar: Array<(u: Record<string, unknown>, wilayah: string) => void> = [];
  const local = {
    get: async (kunci?: string | string[] | null) => {
      const daftar = kunci == null ? Object.keys(simpanan) : [kunci].flat();
      const hasil: Record<string, unknown> = {};
      for (const k of daftar) if (k in simpanan) hasil[k] = polos(simpanan[k]);
      return hasil;
    },
    set: async (isi: Record<string, unknown>) => {
      const ubah: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(isi)) {
        ubah[k] = { oldValue: simpanan[k], newValue: polos(v) };
        simpanan[k] = polos(v);
      }
      setTimeout(() => {
        for (const f of [...pendengar]) f(polos(ubah), "local");
      }, 0);
    },
    remove: async (kunci: string | string[]) => {
      for (const k of [kunci].flat()) delete simpanan[k];
    },
  };
  w.chrome = {
    runtime: { id: "aleta-uji", getManifest: () => ({ version: "1.175.0" }), getURL: (x: string) => `chrome-extension://aleta-uji/${x}`, sendMessage: async () => ({}) },
    storage: { local, session: { get: async () => ({}), set: async () => undefined }, onChanged: { addListener: (f: any) => void pendengar.push(f) } },
  };
  const minta: Minta[] = [];
  const kapabilitas = p.kapabilitas === undefined ? null : p.kapabilitas;
  w.fetch = async (alamat: string, opsi?: { method?: string }) => {
    const url = String(alamat);
    const cara = String((opsi && opsi.method) || "GET").toUpperCase();
    minta.push({ url, cara });
    let status = 200;
    let isi: unknown = { ok: true, data: {} };
    if (url.includes("/api/aleta-ecourt/ekstensi/tampilan")) {
      status = 404;
      isi = {};
    } else if (url.includes("/aleta-bot/sipp-konteks/massal")) {
      // Penandaan baris daftar: tidak ada perkara berkeadaan khusus.
      isi = { ok: true, data: { available: true, perkara: {}, identitas: {} } };
    } else if (url.includes("/aleta-ecourt/ekstensi/siapa")) {
      isi = { ok: true, data: { nama, peran, kapabilitas } };
    } else if (url.includes("/aleta-bot/sipp-konteks?")) {
      isi = { ok: true, data: { available: true, konteks: konteksContoh(), pengguna: { nama, peran }, kapabilitas } };
    } else if (url.includes("/aleta-ecourt/status-perkara?")) {
      if (p.petugas && p.petugas.gagal) {
        status = 500;
        isi = { ok: false, error: { message: "bot mati" } };
      } else {
        isi = { ok: true, data: { available: true, status: statusContoh(p.petugas ?? {}) } };
      }
    }
    const bita = new TextEncoder().encode(JSON.stringify(isi));
    const r: any = {
      ok: status >= 200 && status < 300,
      status,
      statusText: "",
      url,
      redirected: false,
      headers: { get: () => "application/json" },
      json: async () => polos(isi),
      text: async () => new TextDecoder().decode(bita),
      arrayBuffer: async () => bita.buffer.slice(bita.byteOffset, bita.byteOffset + bita.byteLength),
      clone: () => r,
    };
    return r;
  };
  const pmAsli = w.postMessage.bind(w);
  w.postMessage = (data: any, asal: string) => {
    if (data && data.sumber === "aleta-jembatan") {
      const { id } = data;
      setTimeout(() => w.dispatchEvent(new w.MessageEvent("message", { data: { sumber: "aleta-jembatan-jawab", id, ok: true, medan: [] }, source: w })), 0);
      return;
    }
    return pmAsli(data, asal);
  };
  const jurusita: Array<Record<string, unknown>> = [];
  if (p.jurusita) {
    // jurusita.js tiruan (agen J) - dimuat SEBELUM konten.js, seperti di manifest.
    w.aletaJurusitaBoleh = p.jurusitaBoleh ?? (() => false);
    w.aletaJurusitaPasang = async (wadah: HTMLElement, opsi: Record<string, unknown>) => {
      jurusita.push(polos(opsi));
      const el = w.document.createElement("div");
      el.className = "aleta-jurusita";
      el.textContent = "Relaas dan PBT";
      wadah.appendChild(el);
      return true;
    };
  }
  const massal: Array<{ jenis: string; opsi: Record<string, unknown> }> = [];
  const tiruMassal = (jenis: string, cara: boolean | "tolak") => async (wadah: HTMLElement, opsi: Record<string, unknown>) => {
    massal.push({ jenis, opsi: polos(opsi) });
    if (cara === "tolak") return false;
    const el = w.document.createElement("div");
    el.className = `tiruan-${jenis}`;
    el.textContent = jenis;
    wadah.appendChild(el);
    return true;
  };
  if (p.massalBas) w.aletaBasMassalPasang = tiruMassal("bas", p.massalBas);
  if (p.massalRelaas) w.aletaJurusitaPasangMassal = tiruMassal("relaas", p.massalRelaas);
  const ctx = (dom as unknown as { getInternalVMContext(): vm.Context }).getInternalVMContext();
  vm.runInContext(ALAT, ctx, { filename: "panel-alat.js" });
  vm.runInContext(KONTEN(), ctx, { filename: "konten.js" });
  return { dom, w, d: w.document, minta, jurusita, massal };
}

const BARU = { ujiTampilan: "baru", ujiIzinkanNyata: true };
const UI = { ujiTampilan: "ui", ujiIzinkanNyata: true };

const panelDari = (h: Halaman) => h.d.getElementById("aleta-panel-sipp") as any;
const siapUi = (h: Halaman) =>
  sampai(() => {
    const pn = panelDari(h);
    return pn && pn.getAttribute("data-t7") === "ui" && pn.querySelector(".aleta-t7-tab") && pn.getAttribute("data-t7-tab") ? pn : null;
  }, "panel UI Baru bertab");
const siapBaru = (h: Halaman) =>
  sampai(() => {
    const pn = panelDari(h);
    return pn && pn.getAttribute("data-t7-a30") === "baru" && pn.querySelector(".aleta-kelompok") ? pn : null;
  }, "panel Baru tertata");
const siapLama = (h: Halaman) => sampai(() => panelDari(h) && panelDari(h).querySelector(".aleta-kelompok") && panelDari(h), "panel Lama");
const siapDaftar = (h: Halaman) =>
  sampai(() => {
    const pn = panelDari(h);
    return pn && pn.dataset.mode === "daftar" ? pn : null;
  }, "panel daftar");

/** Tab yang TAMPAK, kiri ke kanan. */
const tabTampak = (pn: any) =>
  Array.from(pn.querySelectorAll(".aleta-t7-tab"))
    .filter((t: any) => !t.hasAttribute("data-mps-sembunyi"))
    .map((t: any) => t.getAttribute("data-t7-ke"));
const tabSemua = (pn: any) => Array.from(pn.querySelectorAll(".aleta-t7-tab")).map((t: any) => t.getAttribute("data-t7-ke"));
/** Kelompok yang TAMPAK, atas ke bawah. */
const kelTampak = (pn: any) =>
  Array.from(pn.querySelectorAll(".aleta-isi > .aleta-kelompok"))
    .filter((k: any) => !k.hasAttribute("data-mps-sembunyi"))
    .map((k: any) => k.dataset.kunci);
const kelSemua = (pn: any) => Array.from(pn.querySelectorAll(".aleta-isi > .aleta-kelompok")).map((k: any) => k.dataset.kunci);
const massalDaftar = (pn: any) => Array.from(pn.querySelectorAll("[data-mps-massal]")).map((x: any) => x.getAttribute("data-mps-massal"));

// ============================================================================
describe("tampilan Lama: tanpa satu pun jejak menu per peran", () => {
  for (const peran of ["Hakim", "Jurusita", "Super Admin"]) {
    it(`${peran}: panel perkara tanpa data-mps, tanpa aleta-teknis, susunan kelompok lama`, async () => {
      const h = buka({ peran, jurusita: true, petugas: { majelis: ["Orang Lain"] } });
      const pn = await siapLama(h);
      await tunggu(40);
      expect(pn.outerHTML).not.toMatch(/data-mps-|aleta-teknis|aleta-mps-/);
      expect(kelSemua(pn)).toEqual(["kerjakan", "berkas", "perkara", "putusanKel"]);
      expect(h.jurusita).toEqual([]);
    });
  }

  // Keputusan 9 Okt 2026: putusan massal (unggah putusan ke SIPP) hanya Super
  // Admin, Admin, Hakim (termasuk Ketua/Wakil) - juga di tampilan Lama. Juru
  // Sita melihat kotak terkunci beralasan, bukan lagi Putusan massal.
  it("Jurusita di halaman daftar Lama: Putusan massal diganti kotak terkunci (hak unggah putusan 9 Okt 2026)", async () => {
    const h = buka({ peran: "Jurusita", daftar: true, massalRelaas: true });
    const pn = await siapDaftar(h);
    await tunggu(30);
    expect(pn.querySelector('[data-kunci="putusanMassalSipp"]')).toBeNull();
    expect(pn.querySelector('[data-aleta-terkunci="unggah-putusan"]')).not.toBeNull();
    expect(pn.outerHTML).not.toMatch(/data-mps-|aleta-teknis/);
    expect(h.massal).toEqual([]);
  });
});

// ============================================================================
describe("UI Baru di dalam perkara: tab mengikuti matriks peran", () => {
  it("Super Admin: keenamnya, urut Penetapan-PTSP-Putusan-Juru Sita-Berkas-Perkara (PTSP: perbaikan 5 Okt butir 11); Juru Sita tampil WALAU aletaJurusitaBoleh menolak", async () => {
    const h = buka({ simpanan: UI, peran: "Super Admin", jurusita: true, jurusitaBoleh: () => false });
    const pn = await siapUi(h);
    expect(tabTampak(pn)).toEqual(["kerjakan", "ptspKel", "putusanKel", "juruSitaKel", "berkas", "perkara"]);
    expect(pn.getAttribute("data-t7-tab")).toBe("kerjakan");
    expect(pn.getAttribute("data-mps-peran")).toBe("admin");
    // Admin tidak menunggu status perkara untuk menunya.
    expect(pn.hasAttribute("data-mps-ditangani")).toBe(false);
    pn.querySelector('.aleta-t7-tab[data-t7-ke="juruSitaKel"]').click();
    await sampai(() => h.jurusita.length === 1, "jurusita.js dipasang untuk Super Admin");
  });

  it("Admin: sama dengan Super Admin", async () => {
    const h = buka({ simpanan: UI, peran: "Admin", jurusita: true });
    const pn = await siapUi(h);
    expect(tabTampak(pn)).toEqual(["kerjakan", "ptspKel", "putusanKel", "juruSitaKel", "berkas", "perkara"]);
  });

  it("Wakil Ketua majelis perkara, penunjukan belum lengkap: Penetapan, Putusan, Berkas, Perkara", async () => {
    const h = buka({ simpanan: UI, peran: "Wakil Ketua", nama: "Munifa, S.H.", petugas: { majelis: ["Dra. Hj. Munifa, S.H.I., M.H."], lengkap: false } });
    const pn = await siapUi(h);
    await sampai(() => pn.getAttribute("data-mps-ditangani") === "ya", "status terbaca");
    expect(tabTampak(pn)).toEqual(["kerjakan", "putusanKel", "berkas", "perkara", "ptspKel"]);
    expect(pn.getAttribute("data-t7-tab")).toBe("kerjakan");
  });

  it("Ketua, penunjukan LENGKAP: tab Penetapan hilang, Putusan jadi bawaan", async () => {
    const h = buka({ simpanan: UI, peran: "Ketua", nama: "Munifa", petugas: { majelis: ["Munifa, S.H."], lengkap: true } });
    const pn = await siapUi(h);
    await sampai(() => !tabTampak(pn).includes("kerjakan"), "Penetapan disembunyikan");
    expect(tabTampak(pn)).toEqual(["putusanKel", "berkas", "perkara", "ptspKel"]);
    expect(pn.getAttribute("data-t7-tab")).toBe("putusanKel");
    // Disembunyikan, bukan dibuang.
    expect(pn.querySelector('.aleta-isi > .aleta-kelompok[data-kunci="kerjakan"]')).not.toBeNull();
    expect(tabSemua(pn)).toContain("kerjakan");
  });

  it("Ketua BUKAN majelis perkara ini: Penetapan tetap (K2), Putusan hilang", async () => {
    const h = buka({ simpanan: UI, peran: "Ketua", nama: "Munifa", petugas: { majelis: ["Ahmad Fauzi, S.H.I."], lengkap: false } });
    const pn = await siapUi(h);
    await sampai(() => pn.getAttribute("data-mps-ditangani") === "tidak", "bukan majelis");
    expect(tabTampak(pn)).toEqual(["kerjakan", "berkas", "perkara", "ptspKel"]);
  });

  it("Hakim majelis: Putusan, Berkas, Perkara - Putusan terbuka", async () => {
    const h = buka({ simpanan: UI, peran: "Hakim", nama: "Munifa, S.H.", petugas: { majelis: ["Munifa, S.H."] } });
    const pn = await siapUi(h);
    await sampai(() => pn.getAttribute("data-mps-ditangani") === "ya", "status terbaca");
    expect(tabTampak(pn)).toEqual(["putusanKel", "berkas", "perkara"]);
    expect(pn.getAttribute("data-t7-tab")).toBe("putusanKel");
    // Tab tersembunyi tidak dapat dipilih.
    h.w.t7PilihTab(pn, "kerjakan", false);
    expect(pn.getAttribute("data-t7-tab")).toBe("putusanKel");
  });

  it("Hakim BUKAN majelis: hanya membaca - Perkara dan Berkas (urut matriks: Berkas, Perkara)", async () => {
    const h = buka({ simpanan: UI, peran: "Hakim", nama: "Munifa", petugas: { majelis: ["Ahmad Fauzi"] } });
    const pn = await siapUi(h);
    await sampai(() => pn.getAttribute("data-mps-ditangani") === "tidak", "bukan majelis");
    expect(tabTampak(pn)).toEqual(["berkas", "perkara"]);
    expect(pn.getAttribute("data-t7-tab")).toBe("berkas");
    expect(pn.hasAttribute("data-mps-tanpa-putusan")).toBe(true);
  });

  it("Hakim, status perkara TIDAK terbaca: tidak dikurangi (Putusan tetap)", async () => {
    const h = buka({ simpanan: UI, peran: "Hakim", nama: "Munifa", petugas: { gagal: true } });
    const pn = await siapUi(h);
    await sampai(() => h.minta.some((m) => m.url.includes("status-perkara")), "status diminta");
    await tunggu(40);
    expect(tabTampak(pn)).toEqual(["putusanKel", "berkas", "perkara"]);
  });

  it("Hakim, petugas tidak terbaca (sumberMajelis tidakTerbaca): tidak dikurangi", async () => {
    const h = buka({ simpanan: UI, peran: "Hakim", nama: "Munifa", petugas: { tidakTerbaca: true } });
    const pn = await siapUi(h);
    await sampai(() => pn.getAttribute("data-mps-ditangani") === "?", "tidak pasti");
    expect(tabTampak(pn)).toEqual(["putusanKel", "berkas", "perkara"]);
  });

  it("Panitera Pengganti: Berkas dan Perkara; Juru Sita dibuat tetapi DISEMBUNYIKAN", async () => {
    const h = buka({ simpanan: UI, peran: "Panitera Pengganti", jurusita: true, jurusitaBoleh: () => true, petugas: { panitera: ["Munifa"] } });
    const pn = await siapUi(h);
    expect(tabTampak(pn)).toEqual(["berkas", "perkara"]);
    expect(pn.getAttribute("data-t7-tab")).toBe("berkas");
    const js = pn.querySelector('.aleta-isi > .aleta-kelompok[data-kunci="juruSitaKel"]');
    expect(js).not.toBeNull();
    expect(js.hasAttribute("data-mps-sembunyi")).toBe(true);
    await tunggu(30);
    expect(h.jurusita).toEqual([]);
  });

  it("Jurusita perkara ini: Juru Sita (terbuka, jurusita.js dipasang), Perkara, Berkas", async () => {
    const h = buka({ simpanan: UI, peran: "Jurusita", nama: "Mustini", jurusita: true, petugas: { jurusita: ["Mustini, S.H."] } });
    const pn = await siapUi(h);
    expect(tabTampak(pn)).toEqual(["juruSitaKel", "perkara", "berkas"]);
    expect(pn.getAttribute("data-t7-tab")).toBe("juruSitaKel");
    await sampai(() => h.jurusita.length === 1, "Juru Sita terpasang sebagai menu pertama");
    await sampai(() => pn.getAttribute("data-mps-ditangani") === "ya", "status terbaca");
    expect(tabTampak(pn)).toEqual(["juruSitaKel", "perkara", "berkas"]);
  });

  it("Jurusita perkara LAIN: tab Juru Sita disembunyikan, pindah ke Perkara", async () => {
    const h = buka({ simpanan: UI, peran: "Jurusita", nama: "Mustini", jurusita: true, petugas: { jurusita: ["Rahmat Hidayat"] } });
    const pn = await siapUi(h);
    await sampai(() => pn.getAttribute("data-mps-ditangani") === "tidak", "bukan juru sita perkara ini");
    expect(tabTampak(pn)).toEqual(["perkara", "berkas"]);
    expect(pn.getAttribute("data-t7-tab")).toBe("perkara");
  });

  // 11 Okt 2026 (agen R): Operator/PTSP kini golongan menu "ptsp" - contoh
  // peran "lain" yang tetap susunan lama: Analis Perkara.
  it("peran lain (Analis Perkara): susunan lama, tanpa data-mps", async () => {
    const h = buka({ simpanan: UI, peran: "Analis Perkara" });
    const pn = await siapUi(h);
    await tunggu(30);
    expect(tabSemua(pn)).toEqual(["kerjakan", "ptspKel", "berkas", "perkara", "putusanKel"]);
    expect(pn.hasAttribute("data-mps-peran")).toBe(false);
    expect(pn.querySelector("[data-mps-sembunyi]")).toBeNull();
  });

  it("11 Okt: Operator (PTSP) - PTSP, Berkas, Perkara; Penetapan tetap karena kemampuan penunjukan; Putusan tidak", async () => {
    const h = buka({ simpanan: UI, peran: "Operator" });
    const pn = await siapUi(h);
    await tunggu(30);
    expect(pn.getAttribute("data-mps-peran")).toBe("ptsp");
    expect(tabTampak(pn)).toEqual(["kerjakan", "ptspKel", "berkas", "perkara"]);
    const tanpaPenunjukan = buka({ simpanan: UI, peran: "Operator", kapabilitas: { penunjukan: false } });
    const pn2 = await siapUi(tanpaPenunjukan);
    await tunggu(30);
    expect(tabTampak(pn2)).toEqual(["ptspKel", "berkas", "perkara"]);
  });
});

// ============================================================================
describe("Baru di dalam perkara: kelompok diurutkan, menu pertama terbuka", () => {
  it("Super Admin: Penetapan-Putusan-Juru Sita-Berkas-Perkara; Juru Sita kelompok sendiri", async () => {
    const h = buka({ simpanan: BARU, peran: "Super Admin", jurusita: true });
    const pn = await siapBaru(h);
    expect(kelTampak(pn)).toEqual(["kerjakan", "putusanKel", "juruSitaKel", "berkas", "perkara"]);
    const js = pn.querySelector('.aleta-kelompok[data-kunci="juruSitaKel"]');
    expect(js.querySelector(".aleta-kelompok-isi").style.display).toBe("none");
    js.querySelector(".aleta-kelompok-judul").click();
    await sampai(() => h.jurusita.length === 1, "dibuka = dipasang");
  });

  it("Hakim majelis: Putusan pertama DAN terbuka, Penetapan disembunyikan", async () => {
    const h = buka({ simpanan: BARU, peran: "Hakim", nama: "Munifa", petugas: { majelis: ["Munifa, S.H."] } });
    const pn = await siapBaru(h);
    await sampai(() => pn.getAttribute("data-mps-ditangani") === "ya", "status");
    expect(kelTampak(pn)).toEqual(["putusanKel", "berkas", "perkara"]);
    expect(kelSemua(pn)[0]).toBe("putusanKel");
    expect(pn.querySelector('.aleta-kelompok[data-kunci="putusanKel"] > .aleta-kelompok-isi').style.display).toBe("");
    expect(pn.querySelector('.aleta-kelompok[data-kunci="kerjakan"]').hasAttribute("data-mps-sembunyi")).toBe(true);
  });

  it("Hakim: lipatan tersimpan petugas menang atas bawaan terbuka", async () => {
    const h = buka({ simpanan: { ...BARU, lipatanBagian: { "kel:putusanKel": true } }, peran: "Hakim", petugas: { majelis: ["Munifa"] } });
    const pn = await siapBaru(h);
    await tunggu(30);
    expect(kelTampak(pn)[0]).toBe("putusanKel");
    expect(pn.querySelector('.aleta-kelompok[data-kunci="putusanKel"] > .aleta-kelompok-isi').style.display).toBe("none");
  });

  it("Jurusita: Juru Sita pertama, terbuka, dan langsung dipasang", async () => {
    const h = buka({ simpanan: BARU, peran: "Jurusita", nama: "Mustini", jurusita: true, petugas: { jurusita: ["Mustini"] } });
    const pn = await siapBaru(h);
    expect(kelTampak(pn)).toEqual(["juruSitaKel", "perkara", "berkas"]);
    await sampai(() => h.jurusita.length === 1, "Juru Sita dipasang sebagai menu pertama yang terbuka");
  });
});

// ============================================================================
describe("halaman daftar perkara / dashboard: menu massal per peran", () => {
  it("Super Admin: Penetapan, BAS, Relaas & PBT, Putusan massal - berurutan; fungsi M/J dipanggil dengan situs sipp", async () => {
    const h = buka({ simpanan: UI, peran: "Super Admin", daftar: true, massalBas: true, massalRelaas: true });
    const pn = await siapDaftar(h);
    await sampai(() => h.massal.length === 2, "BAS dan relaas massal dipasang");
    expect(massalDaftar(pn)).toEqual(["penetapan-massal", "bas-massal", "relaas-pbt-massal", "putusan-massal"]);
    expect(h.massal.map((x) => x.opsi)).toEqual([{ situs: "sipp" }, { situs: "sipp" }]);
    expect(pn.querySelector(".tiruan-bas")).not.toBeNull();
    expect(pn.querySelector(".tiruan-relaas")).not.toBeNull();
    expect(pn.querySelector('[data-kunci="putusanMassalSipp"]')).not.toBeNull();
    // Menu pertama (Penetapan massal) terbuka sebagai bawaan.
    expect(pn.querySelector('[data-kunci="penetapanMassal"] > .aleta-bagian-isi').style.display).toBe("");
  });

  it("Jurusita: hanya Relaas & PBT massal - Putusan massal TIDAK tampil", async () => {
    const h = buka({ simpanan: UI, peran: "Jurusita", daftar: true, massalRelaas: true, massalBas: true });
    const pn = await siapDaftar(h);
    await sampai(() => h.massal.length === 1, "relaas massal dipasang");
    expect(massalDaftar(pn)).toEqual(["relaas-pbt-massal"]);
    expect(h.massal[0].jenis).toBe("relaas");
    expect(pn.querySelector('[data-kunci="putusanMassalSipp"]')).toBeNull();
    expect(pn.querySelector('[data-kunci="penetapanMassal"]')).toBeNull();
  });

  it("Jurusita tanpa jurusita.js massal (agen J belum): dilewati tanpa error, tetap tanpa Putusan massal", async () => {
    const h = buka({ simpanan: BARU, peran: "Jurusita", daftar: true });
    const pn = await siapDaftar(h);
    await tunggu(30);
    expect(massalDaftar(pn)).toEqual([]);
    expect(pn.querySelector('[data-kunci="putusanMassalSipp"]')).toBeNull();
    expect(pn.querySelector(".aleta-gagal")).toBeNull();
  });

  it("Hakim: hanya Putusan massal, terbuka dan langsung membaca sidang", async () => {
    const h = buka({ simpanan: BARU, peran: "Hakim", daftar: true, massalBas: true, massalRelaas: true });
    const pn = await siapDaftar(h);
    await tunggu(30);
    expect(massalDaftar(pn)).toEqual(["putusan-massal"]);
    expect(h.massal).toEqual([]);
    expect(pn.querySelector('[data-kunci="putusanMassalSipp"] > .aleta-bagian-isi').style.display).toBe("");
    await sampai(() => /Membaca sidang|bersidang|Tidak ada sidang|gagal/i.test(pn.querySelector('[data-kunci="putusanMassalSipp"] .aleta-abt-kabar').textContent), "sidang dibaca");
  });

  it("Ketua: Penetapan massal dan Putusan massal", async () => {
    const h = buka({ simpanan: UI, peran: "Wakil Ketua", daftar: true, massalBas: true, massalRelaas: true });
    const pn = await siapDaftar(h);
    await tunggu(30);
    expect(massalDaftar(pn)).toEqual(["penetapan-massal", "putusan-massal"]);
  });

  it("Panitera Pengganti: hanya BAS massal", async () => {
    const h = buka({ simpanan: UI, peran: "Panitera Pengganti", daftar: true, massalBas: true, massalRelaas: true });
    const pn = await siapDaftar(h);
    await sampai(() => h.massal.length === 1, "BAS massal");
    expect(massalDaftar(pn)).toEqual(["bas-massal"]);
    expect(pn.querySelector('[data-kunci="putusanMassalSipp"]')).toBeNull();
  });

  it("fungsi massal menolak (false): wadahnya dilepas", async () => {
    const h = buka({ simpanan: UI, peran: "Panitera", daftar: true, massalBas: "tolak" });
    const pn = await siapDaftar(h);
    await sampai(() => h.massal.length === 1, "dipanggil");
    await tunggu(20);
    expect(massalDaftar(pn)).toEqual([]);
  });

  it("gerbang izin lama tetap di atas matriks: Ketua tanpa kewenangan penunjukan tidak mendapat Penetapan massal", async () => {
    const h = buka({ simpanan: UI, peran: "Ketua", daftar: true, kapabilitas: { penunjukan: false } });
    const pn = await siapDaftar(h);
    await tunggu(30);
    expect(massalDaftar(pn)).toEqual(["putusan-massal"]);
  });

  // Keputusan 9 Okt 2026: Operator tidak berhak unggah putusan - Putusan
  // massal diganti kotak terkunci; Penetapan massal (gerbang penetapan) tetap.
  it("11 Okt: Operator (PTSP) - Penetapan massal saja (gerbang penunjukan), tanpa kotak Putusan terkunci", async () => {
    const h = buka({ simpanan: UI, peran: "Operator", daftar: true, massalBas: true, massalRelaas: true });
    const pn = await siapDaftar(h);
    await tunggu(30);
    expect(pn.getAttribute("data-mps-menu")).toBe("penetapan-massal");
    expect(pn.querySelector('[data-kunci="penetapanMassal"]')).not.toBeNull();
    expect(pn.querySelector('[data-aleta-terkunci="unggah-putusan"]')).toBeNull();
    expect(pn.querySelector('[data-mps-massal="kasir-harian"]')).toBeNull();
    expect(h.massal).toEqual([]);
  });

  it("peran lain (Analis Perkara): susunan lama (Penetapan massal; Putusan massal terkunci), tanpa data-mps", async () => {
    const h = buka({ simpanan: UI, peran: "Analis Perkara", daftar: true, massalBas: true, massalRelaas: true });
    const pn = await siapDaftar(h);
    await tunggu(30);
    expect(pn.hasAttribute("data-mps-peran")).toBe(false);
    expect(pn.querySelector('[data-kunci="penetapanMassal"]')).not.toBeNull();
    expect(pn.querySelector('[data-kunci="putusanMassalSipp"]')).toBeNull();
    expect(pn.querySelector('[data-aleta-terkunci="unggah-putusan"]')).not.toBeNull();
    expect(h.massal).toEqual([]);
  });
});

// ============================================================================
describe("butir 3: penjelasan teknis ditandai aleta-teknis (Baru & UI Baru)", () => {
  it("perkara: umur data dan penjelasan 'remeh' beserta ⓘ-nya ditandai; error tidak", async () => {
    const h = buka({ simpanan: BARU, peran: "Operator" });
    const pn = await siapBaru(h);
    const usia = await sampai(() => pn.querySelector(".aleta-kepala-usia.aleta-teknis"), "umur data ditandai");
    expect(usia.textContent).toMatch(/^diperiksa/);
    const remeh = await sampai(
      () => Array.from(pn.querySelectorAll(".aleta-tetap-sebab.aleta-remeh")).find((x: any) => /jawab-menjawab/.test(x.textContent)) as any,
      "penjelasan jawab-menjawab"
    );
    await sampai(() => remeh.classList.contains("aleta-teknis") && remeh.previousElementSibling?.classList.contains("aleta-teknis"), "penjelasan + ⓘ ditandai");
    const isi = pn.querySelector(".aleta-isi");
    const gagal = h.w.buatElemen("div", "aleta-tetap-sebab aleta-remeh aleta-gagal", "Gagal menyimpan: server menolak.");
    isi.appendChild(gagal);
    await tunggu(20);
    expect(gagal.classList.contains("aleta-teknis")).toBe(false);
  });

  it("daftar: penjelasan cara kerja Putusan massal ditandai; peringatan 'MENEKAN SIMPAN SIPP' tidak", async () => {
    const h = buka({ simpanan: UI, peran: "Hakim", daftar: true });
    const pn = await siapDaftar(h);
    const pen = await sampai(
      () => Array.from(pn.querySelectorAll(".aleta-teknis")).find((x: any) => /sudah punya draf putusan/.test(x.textContent)) as any,
      "penjelasan putusan massal ditandai"
    );
    expect(pen).toBeTruthy();
    const simpan = pn.querySelector(".aleta-massal-simpan");
    expect(simpan).not.toBeNull();
    expect(simpan.classList.contains("aleta-teknis")).toBe(false);
  });
});

// ============================================================================
describe("pencocok nama dan keadaan penunjukan", () => {
  it("nama tanpa gelar; longgar ke arah aman", () => {
    const h = buka({ peran: "Operator" });
    const cocok = h.w.mpsNamaCocok;
    expect(h.w.mpsNamaInti("Dra. Hj. Munifa, S.H.I., M.H.")).toEqual(["munifa"]);
    expect(cocok("Munifa, S.H.", "Dra. Hj. Munifa, S.H.I., M.H.")).toBe(true);
    expect(cocok("MUSTINI", "Mustini, S.H.")).toBe(true);
    expect(cocok("Derry Briantono", "Derry Briantono, S.Kom")).toBe(true);
    expect(cocok("Munifa", "Ahmad Fauzi")).toBe(false);
    expect(cocok("", "Ahmad")).toBe(false);
    expect(cocok("Al", "Al Fauzi")).toBe(false);
  });

  it("penunjukanLengkap: empat bertanggal = true; satu kosong = false; tak terbaca = undefined", () => {
    const h = buka({ peran: "Operator" });
    expect(h.w.mpsPenunjukanLengkap(statusContoh({ lengkap: true }))).toBe(true);
    expect(h.w.mpsPenunjukanLengkap(statusContoh({ lengkap: false }))).toBe(false);
    expect(h.w.mpsPenunjukanLengkap({ tahapan: { terbaca: false, tahap: [] } })).toBeUndefined();
    expect(h.w.mpsPenunjukanLengkap(null)).toBeUndefined();
  });
});

// ============================================================================
describe("panel.css blok S", () => {
  it("yang disembunyikan menu peran tidak tampak; blok bertanda S di ujung berkas", () => {
    const a = GAYA.indexOf("/* === S - PERBAIKAN 30 SEP SORE === */");
    const b = GAYA.indexOf("/* === AKHIR S === */");
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(a);
    const blok = GAYA.slice(a, b);
    expect(blok).toContain("#aleta-panel-sipp [data-mps-sembunyi] { display: none !important; }");
    expect(blok).toContain("[data-mps-tanpa-putusan]");
  });
});
