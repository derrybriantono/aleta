// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

/**
 * ============================================================================
 * TAMPILAN KASIR & PER PERAN (perbaikan 11 Okt 2026, agen R)
 * ============================================================================
 *
 * panel-alat.js + konten.js UTUH di jsdom, panel.css ditempel (blok Tahap 7
 * dan blok R), lalu yang TAMPAK diperiksa lewat getComputedStyle:
 *
 *  1. jurnal per perkara (detil_biaya): Kasir saja - juga Super Admin; tab
 *     Kasir terpilih menyembunyikan kelompok lain (sebelumnya CSS penyaring
 *     tab tidak memuat kasirKel); baris atas (Langkah/Perkara berikutnya)
 *     milik tab utama saja.
 *  3. lencana bulat tab Kasir: aletaKasirRingkas (agen K) atau cadangan rute
 *     kasir; galat = tanpa lencana.
 *  4. Kasir massal/pengingat/rekap hanya di daftar jurnal keuangan
 *     (jurnal_perkara_list, all_jurnal_perkara), tidak di dashboard dan tidak
 *     di tab per perkara.
 *  5. menu per peran: Kasir, PP, Juru Sita, Hakim, Panitera Muda, Operator.
 */

// ALETA_UJI_EKS: folder ekstensi lain (mis. salinan 21a6815) untuk membuktikan uji ini menggigit.
const AKAR = process.env.ALETA_UJI_EKS || path.resolve(process.cwd(), "../ekstensi-sipp");
const baca = (b: string) => readFileSync(path.join(AKAR, b), "utf8").replace(/\r\n/g, "\n");
const ALAT = baca("panel-alat.js");
const KONTEN = baca("konten.js");
const GAYA_PENUH = baca("panel.css");
/** Blok Tahap 7 (penyaring tab) + blok S (data-mps-sembunyi) + blok R. */
const GAYA = (() => {
  const potong = (awal: string, akhir: string) => {
    const a = GAYA_PENUH.indexOf(awal);
    const b = GAYA_PENUH.indexOf(akhir, a);
    if (a < 0 || b < 0) throw new Error(`blok CSS tidak ditemukan: ${awal}`);
    return GAYA_PENUH.slice(a, b + akhir.length);
  };
  return [
    // Sampai SEBELUM komentar "D6" (potongan berakhir di pembuka komentar
    // akan menelan seluruh aturan sesudahnya).
    potong("/* Hanya kelompok tab yang dipilih yang tampil", "/* D6:").replace(/\/\* D6:$/, ""),
    "#aleta-panel-sipp [data-mps-sembunyi] { display: none !important; }",
    potong("/* === R 11 Okt === */", "/* === AKHIR R 11 Okt === */"),
  ].join("\n");
})();

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

function konteksContoh() {
  return {
    ok: true,
    nomorPerkara: NOMOR,
    nomorRegister: "PA.DGL-2026-0450",
    identitas: { ditemukan: true, perkaraId: 9950, jenisPerkara: "Cerai Gugat", jenisPerkaraLengkap: "Cerai Gugat", adaKumulasi: false, kumulasi: [], adaKuasa: false },
    ringkasan: { dokumen: 0 },
    dokumen: [],
    selisih: [],
    nomorPihak: [],
    diperiksaPada: new Date().toISOString(),
    ambangMendesakHari: 3,
    hakim: null,
  };
}

type Minta = { url: string; cara: string };
type Opsi = {
  /** jalur sesudah /SIPP/ */
  jalur?: string;
  daftar?: boolean | "satu";
  peran?: string;
  bolehKasir?: boolean;
  peranTambahan?: string[];
  simpanan?: Record<string, unknown>;
  ringkas?: unknown;
  /** jawaban rute kasir cadangan: larik usulan, atau "gagal" */
  ruteKasir?: Array<Record<string, unknown>> | "gagal";
  kapabilitas?: Record<string, boolean> | null;
};
type Halaman = {
  w: any;
  d: Document;
  minta: Minta[];
  kasir: Array<Record<string, unknown>>;
  harian: Array<Record<string, unknown>>;
};

const terbuka: JSDOM[] = [];
afterEach(async () => {
  await tunggu(20);
  while (terbuka.length) terbuka.pop()!.window.close();
});

const BARIS = (n: number) =>
  `<table><tr><th>No</th><th>Nomor Perkara</th></tr>${Array.from({ length: n }, (_, i) => `<tr><td>${i + 1}</td><td>${621 - i}/Pdt.G/2026/PA.Dgl</td></tr>`).join("")}</table>`;

function buka(p: Opsi = {}): Halaman {
  const peran = p.peran ?? "Super Admin";
  const nama = "Munifa, S.H.";
  const tubuh = p.daftar
    ? `<div id="konten"><h3>JURNAL KEUANGAN PERKARA PERDATA GUGATAN/PERMOHONAN</h3>${BARIS(p.daftar === "satu" ? 1 : 3)}</div>`
    : `<div id="konten"><h3>BUKU JURNAL KEUANGAN PERKARA GUGATAN TINGKAT PERTAMA</h3><p>Nomor Perkara ${NOMOR}</p><input type="hidden" name="perkara_id" value="9950"></div>`;
  const dom = new JSDOM(`<!doctype html><html><head><title>SIPP</title><style>${GAYA}</style></head><body>${tubuh}</body></html>`, {
    url: `${ASAL}/SIPP/${p.jalur ?? (p.daftar ? "main" : "detil_perkara_agama")}`,
    runScripts: "outside-only",
    pretendToBeVisual: true,
  } as ConstructorParameters<typeof JSDOM>[1]);
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
  const simpanan: Record<string, unknown> = polos(p.simpanan ?? { ujiTampilan: "ui", ujiIzinkanNyata: true });
  const local = {
    get: async (kunci?: string | string[] | null) => {
      const daftar = kunci == null ? Object.keys(simpanan) : [kunci].flat();
      const hasil: Record<string, unknown> = {};
      for (const k of daftar) if (k in simpanan) hasil[k] = polos(simpanan[k]);
      return hasil;
    },
    set: async (isi: Record<string, unknown>) => {
      for (const [k, v] of Object.entries(isi)) simpanan[k] = polos(v);
    },
    remove: async (kunci: string | string[]) => {
      for (const k of [kunci].flat()) delete simpanan[k];
    },
  };
  w.chrome = {
    runtime: { id: "aleta-uji", getManifest: () => ({ version: "1.192.0" }), getURL: (x: string) => `chrome-extension://aleta-uji/${x}`, sendMessage: async () => ({}) },
    storage: { local, session: { get: async () => ({}), set: async () => undefined }, onChanged: { addListener() {} } },
  };
  const pengguna: Record<string, unknown> = { nama, peran };
  if (typeof p.bolehKasir === "boolean") pengguna.bolehKasir = p.bolehKasir;
  if (p.peranTambahan) pengguna.peranTambahan = p.peranTambahan;
  const kapabilitas = p.kapabilitas === undefined ? null : p.kapabilitas;
  const minta: Minta[] = [];
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
      isi = { ok: true, data: { available: true, perkara: {}, identitas: {} } };
    } else if (url.includes("/aleta-ecourt/ekstensi/siapa")) {
      isi = { ok: true, data: { ...pengguna, kapabilitas } };
    } else if (url.includes("/aleta-bot/sipp-konteks?")) {
      isi = { ok: true, data: { available: true, konteks: konteksContoh(), pengguna, kapabilitas } };
    } else if (url.includes("/aleta-ecourt/status-perkara?")) {
      isi = { ok: true, data: { available: true, status: { majelis: [], panitera: [], jurusita: [], tahapan: { terbaca: false, tahap: [] }, putusan: {}, putusanLengkap: {}, penilaianSk: { rinci: [] } } } };
    } else if (/\/sidang\/kasir\?perkaraId=/.test(url)) {
      if (p.ruteKasir === "gagal") {
        status = 500;
        isi = { ok: false, error: { message: "bot mati" } };
      } else {
        isi = { ok: true, data: { available: true, ok: true, saldo: 0, usulan: p.ruteKasir ?? [] } };
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
  // basmassal.js tiruan (bagian Kasir milik agen K) - dimuat SEBELUM konten.js.
  const kasir: Array<Record<string, unknown>> = [];
  const harian: Array<Record<string, unknown>> = [];
  w.aletaKasirPasang = async (wadah: HTMLElement, o: Record<string, unknown>) => {
    kasir.push(polos(o));
    const el = w.document.createElement("div");
    el.className = "tiruan-kasir-perkara";
    el.textContent = "Kasir per perkara";
    wadah.appendChild(el);
    return true;
  };
  w.aletaKasirPasangHarian = async (wadah: HTMLElement, o: Record<string, unknown>) => {
    harian.push(polos(o));
    const el = w.document.createElement("div");
    el.className = "tiruan-kasir-harian";
    el.textContent = "Kasir otomatis massal (satu hari)";
    wadah.appendChild(el);
    return true;
  };
  if (p.ringkas !== undefined) {
    w.aletaKasirRingkas = typeof p.ringkas === "function" ? p.ringkas : async () => polos(p.ringkas);
  }
  const ctx = (dom as unknown as { getInternalVMContext(): vm.Context }).getInternalVMContext();
  vm.runInContext(ALAT, ctx, { filename: "panel-alat.js" });
  vm.runInContext(KONTEN, ctx, { filename: "konten.js" });
  return { w, d: w.document, minta, kasir, harian };
}

const panelDari = (h: Halaman) => h.d.getElementById("aleta-panel-sipp") as any;
const siapUi = (h: Halaman) =>
  sampai(() => {
    const pn = panelDari(h);
    return pn && pn.getAttribute("data-t7") === "ui" && pn.querySelector(".aleta-t7-tab") && pn.getAttribute("data-t7-tab") ? pn : null;
  }, "panel UI Baru bertab");
const siapDaftar = (h: Halaman) =>
  sampai(() => {
    const pn = panelDari(h);
    return pn && pn.dataset.mode === "daftar" ? pn : null;
  }, "panel daftar");

const tampak = (h: Halaman, el: Element | null) => {
  if (!el) return false;
  for (let x: Element | null = el; x && x !== h.d.documentElement; x = x.parentElement) {
    if (h.w.getComputedStyle(x).display === "none") return false;
  }
  return true;
};
const tabTampak = (h: Halaman, pn: any) =>
  Array.from(pn.querySelectorAll(".aleta-t7-tab"))
    .filter((t: any) => tampak(h, t))
    .map((t: any) => t.getAttribute("data-t7-ke"));
/** Kelompok yang BENAR-BENAR tampak (CSS), atas ke bawah. */
const kelTampak = (h: Halaman, pn: any) =>
  Array.from(pn.querySelectorAll(":scope > .aleta-isi > .aleta-kelompok"))
    .filter((k: any) => tampak(h, k))
    .map((k: any) => k.dataset.kunci);
const lencanaTab = (pn: any, kunci: string) =>
  String(pn.querySelector(`.aleta-t7-tab[data-t7-ke="${kunci}"] .aleta-t7-tab-lencana`)?.textContent || "").trim();

// ============================================================================
describe("1. jurnal per perkara (detil_biaya) = Kasir saja", () => {
  it("Super Admin: hanya tab Kasir & isinya yang tampak; baris atas tersembunyi; Kasir per perkara terpasang, massal TIDAK di tab ini", async () => {
    const h = buka({ jalur: "detil_biaya" });
    const pn = await siapUi(h);
    await sampai(() => pn.getAttribute("data-t7-tab") === "kasirKel", "tab Kasir terpilih");
    await sampai(() => h.kasir.length, "Kasir per perkara dipasang");
    expect(pn.getAttribute("data-r11-halaman")).toBe("jurnal-perkara");
    expect(tabTampak(h, pn)).toEqual(["kasirKel"]);
    expect(kelTampak(h, pn)).toEqual(["kasirKel"]);
    // Penetapan (Keputusan penetapan, Riwayat ALETA) dan PTSP ada di DOM tetapi tidak tampak.
    expect(pn.querySelector('.aleta-kelompok[data-kunci="kerjakan"]')).not.toBeNull();
    expect(tampak(h, pn.querySelector('[data-kunci="riwayatAleta"]'))).toBe(false);
    expect(tampak(h, pn.querySelector('.aleta-kelompok[data-kunci="ptspKel"]'))).toBe(false);
    const atas = pn.querySelector(".aleta-isi > .aleta-t7-atas");
    if (atas) expect(tampak(h, atas)).toBe(false);
    expect(h.kasir[0]).toMatchObject({ perkaraId: "9950", nomorPerkara: NOMOR });
    await tunggu(30);
    expect(h.harian).toEqual([]);
    expect(pn.querySelector(".tiruan-kasir-harian")).toBeNull();
  });

  it("Hakim (tidak boleh Kasir) di detil_biaya: menu perannya sendiri, tanpa Kasir", async () => {
    const h = buka({ jalur: "detil_biaya", peran: "Hakim", bolehKasir: false });
    const pn = await siapUi(h);
    await tunggu(40);
    expect(pn.hasAttribute("data-r11-halaman")).toBe(false);
    expect(tabTampak(h, pn)).toEqual(["putusanKel", "berkas", "perkara"]);
    expect(h.kasir).toEqual([]);
  });
});

describe("1b. halaman perkara biasa: tab mana pun hanya menampilkan isinya sendiri", () => {
  it("Super Admin: memilih Kasir menyembunyikan Penetapan/PTSP/Putusan; baris atas hanya di tab utama", async () => {
    const h = buka({ simpanan: { ujiTampilan: "ui", ujiIzinkanNyata: true, ujiFitur: { "sipp-1": true } } });
    const pn = await siapUi(h);
    expect(pn.hasAttribute("data-r11-halaman")).toBe(false);
    const tab = tabTampak(h, pn);
    expect(tab[0]).toBe("kerjakan");
    expect(tab).toContain("kasirKel");
    const atas = await sampai(() => pn.querySelector(".aleta-isi > .aleta-t7-atas"), "baris atas (Langkah berikutnya)");
    expect(pn.getAttribute("data-t7-tab")).toBe("kerjakan");
    expect(tampak(h, atas)).toBe(true);

    h.w.t7PilihTab(pn, "kasirKel", false);
    expect(kelTampak(h, pn)).toEqual(["kasirKel"]);
    expect(tampak(h, atas)).toBe(false);
    await sampai(() => h.kasir.length, "Kasir dipasang saat tabnya dibuka");

    for (const kunci of tab) {
      h.w.t7PilihTab(pn, kunci, false);
      expect(kelTampak(h, pn), kunci).toEqual([kunci]);
      expect(tampak(h, atas), `baris atas di ${kunci}`).toBe(kunci === tab[0]);
    }
  });
});

describe("3. lencana bulat tab Kasir", () => {
  it("aletaKasirRingkas (agen K): 3 terbuka -> '3 usulan' bernada mendesak; dipanggil dengan perkaraId", async () => {
    const panggil: unknown[] = [];
    const h = buka({
      ringkas: async (o: unknown) => {
        panggil.push(JSON.parse(JSON.stringify(o)));
        return { terbuka: 3 };
      },
    });
    const pn = await siapUi(h);
    await sampai(() => lencanaTab(pn, "kasirKel") === "3 usulan", "lencana 3 usulan");
    expect(pn.querySelector('.aleta-t7-tab[data-t7-ke="kasirKel"] .aleta-t7-tab-lencana').className).toContain("aleta-lencana-mendesak");
    expect(panggil[0]).toMatchObject({ perkaraId: "9950", nomorPerkara: NOMOR });
    // Tanpa rute cadangan bila fungsi agen K ada.
    expect(h.minta.some((m) => /\/sidang\/kasir\?/.test(m.url))).toBe(false);
  });

  it("aletaKasirRingkas bentuk agen K (5d751d7): { usulan, kejadian, keadaan, saldo }; 'aleta-kasir-berubah' menyegarkan", async () => {
    let usulan = 4;
    const h = buka({ ringkas: async () => ({ usulan, kejadian: 2, keadaan: "Putus verstek", saldo: 120000 }) });
    const pn = await siapUi(h);
    await sampai(() => lencanaTab(pn, "kasirKel") === "4 usulan", "lencana 4 usulan");
    usulan = 0;
    h.d.dispatchEvent(new h.w.CustomEvent("aleta-kasir-berubah", { detail: { perkaraId: "9950" } }));
    await sampai(() => lencanaTab(pn, "kasirKel") === "lengkap", "lencana segar sesudah simpan");
  });

  it("aletaKasirRingkas: lengkap -> 'lengkap' bernada aman; teks sendiri dipakai apa adanya", async () => {
    const h = buka({ ringkas: { lengkap: true } });
    const pn = await siapUi(h);
    await sampai(() => lencanaTab(pn, "kasirKel") === "lengkap", "lencana lengkap");
    expect(pn.querySelector('.aleta-t7-tab[data-t7-ke="kasirKel"] .aleta-t7-tab-lencana').className).toContain("aleta-lencana-aman");
    const h2 = buka({ ringkas: { teks: "2 kejadian", nada: "lewat" } });
    const pn2 = await siapUi(h2);
    await sampai(() => lencanaTab(pn2, "kasirKel") === "2 kejadian", "teks agen K");
  });

  it("cadangan rute kasir: usulan tercentang dihitung (sisa otomatis nol tidak); kosong = lengkap; galat = tanpa lencana", async () => {
    const h = buka({
      ruteKasir: [
        { uraian: "Redaksi", pilih: true, jumlah: 10000 },
        { uraian: "Meterai", pilih: true, jumlah: 10000 },
        { uraian: "Sisa panjar", pilih: true, sisaOtomatis: true, jumlah: 0 },
        { uraian: "Pemberitahuan", pilih: false, jumlah: 50000 },
      ],
    });
    const pn = await siapUi(h);
    await sampai(() => lencanaTab(pn, "kasirKel") === "2 usulan", "lencana cadangan 2 usulan");
    expect(h.minta.filter((m) => /\/sidang\/kasir\?perkaraId=9950/.test(m.url)).length).toBe(1);

    const k = buka({ ruteKasir: [] });
    const pnk = await siapUi(k);
    await sampai(() => lencanaTab(pnk, "kasirKel") === "lengkap", "lencana cadangan lengkap");

    const g = buka({ ruteKasir: "gagal" });
    const png = await siapUi(g);
    await sampai(() => g.minta.some((m) => /\/sidang\/kasir\?/.test(m.url)), "rute ditanya");
    await tunggu(60);
    expect(lencanaTab(png, "kasirKel")).toBe("");
    expect(png.isConnected).toBe(true);
  });
});

describe("4. Kasir massal/pengingat/rekap hanya di daftar jurnal keuangan", () => {
  it("dashboard (main): tidak ada Kasir massal - menu massal Super Admin tetap", async () => {
    const h = buka({ daftar: true, jalur: "main" });
    const pn = await siapDaftar(h);
    await tunggu(40);
    expect(pn.querySelector('[data-mps-massal="kasir-harian"]')).toBeNull();
    expect(h.harian).toEqual([]);
    expect(pn.querySelector('[data-kunci="penetapanMassal"]')).not.toBeNull();
  });

  for (const jalur of ["jurnal_perkara_list/index", "jurnal_all_perkara/all_jurnal_perkara"]) {
    it(`${jalur}: Super Admin melihat Kasir massal SAJA (konteks halaman mengalahkan "semua")`, async () => {
      const h = buka({ daftar: true, jalur });
      const pn = await siapDaftar(h);
      await sampai(() => pn.querySelector(".tiruan-kasir-harian"), "Kasir massal terpasang");
      expect(pn.getAttribute("data-r11-halaman")).toBe("jurnal-daftar");
      expect(h.harian).toEqual([{ situs: "sipp" }]);
      expect(pn.querySelector('[data-kunci="penetapanMassal"]')).toBeNull();
      expect(pn.querySelector('[data-kunci="putusanMassalSipp"]')).toBeNull();
    });
  }

  it("daftar jurnal yang tersaring ke SATU perkara tetap halaman daftar dengan Kasir massal", async () => {
    const h = buka({ daftar: "satu", jalur: "jurnal_perkara_list/index", peran: "Pelaksana", bolehKasir: true, peranTambahan: ["kasir"] });
    const pn = await siapDaftar(h);
    await sampai(() => pn.querySelector(".tiruan-kasir-harian"), "Kasir massal terpasang");
    expect(pn.textContent).toContain("Penanda baris tidak dipasang");
  });

  it("Hakim di daftar jurnal: tanpa Kasir massal, menu massal perannya tetap", async () => {
    const h = buka({ daftar: true, jalur: "jurnal_perkara_list/index", peran: "Hakim", bolehKasir: false });
    const pn = await siapDaftar(h);
    await tunggu(40);
    expect(pn.querySelector('[data-mps-massal="kasir-harian"]')).toBeNull();
    expect(pn.getAttribute("data-mps-menu")).toBe("putusan-massal");
  });

  it("Tampilan Lama di daftar jurnal: tidak ada Kasir apa pun", async () => {
    const h = buka({ daftar: true, jalur: "jurnal_perkara_list/index", simpanan: {} });
    const pn = await siapDaftar(h);
    await tunggu(40);
    expect(pn.querySelector('[data-mps-massal="kasir-harian"]')).toBeNull();
    expect(pn.hasAttribute("data-r11-halaman")).toBe(false);
  });
});

describe("5. menu per peran di halaman perkara (UI Baru)", () => {
  const kasus: Array<[string, Opsi, string[]]> = [
    ["Kasir (Pelaksana + peran tambahan kasir)", { peran: "Pelaksana", bolehKasir: true, peranTambahan: ["kasir"] }, ["kasirKel", "perkara"]],
    ["Analis Keuangan", { peran: "Analis Keuangan", bolehKasir: true }, ["kasirKel", "perkara"]],
    ["Panitera Pengganti", { peran: "Panitera Pengganti", bolehKasir: false }, ["berkas", "perkara"]],
    ["Panitera Muda", { peran: "Panitera Muda", bolehKasir: true }, ["berkas", "perkara", "kasirKel"]],
    ["Hakim", { peran: "Hakim", bolehKasir: false }, ["putusanKel", "berkas", "perkara"]],
    ["Operator (PTSP)", { peran: "Operator", bolehKasir: false }, ["kerjakan", "ptspKel", "berkas", "perkara"]],
    ["Petugas PTSP tanpa penunjukan", { peran: "Pelaksana", bolehKasir: false, peranTambahan: ["petugas_ptsp"], kapabilitas: { penunjukan: false } }, ["ptspKel", "berkas", "perkara"]],
  ];
  for (const [judul, opsi, harap] of kasus) {
    it(`${judul}: ${harap.join(", ")}`, async () => {
      const h = buka(opsi);
      const pn = await siapUi(h);
      await tunggu(40);
      expect(tabTampak(h, pn)).toEqual(harap);
      // Tab pertama terpilih; hanya kelompoknya yang tampak.
      expect(pn.getAttribute("data-t7-tab")).toBe(harap[0]);
      expect(kelTampak(h, pn)).toEqual([harap[0]]);
    });
  }

  it("Kasir di detil_biaya: Kasir saja (Perkara ikut tersembunyi)", async () => {
    const h = buka({ jalur: "detil_biaya", peran: "Pelaksana", bolehKasir: true, peranTambahan: ["kasir"] });
    const pn = await siapUi(h);
    await sampai(() => h.kasir.length, "Kasir per perkara dipasang");
    expect(tabTampak(h, pn)).toEqual(["kasirKel"]);
    expect(kelTampak(h, pn)).toEqual(["kasirKel"]);
  });

  it("Kasir di dashboard: tanpa menu massal apa pun (bukan Putusan terkunci)", async () => {
    const h = buka({ daftar: true, jalur: "main", peran: "Pelaksana", bolehKasir: true, peranTambahan: ["kasir"] });
    const pn = await siapDaftar(h);
    await tunggu(40);
    expect(pn.getAttribute("data-mps-menu")).toBe("");
    expect(pn.querySelector('[data-aleta-terkunci="unggah-putusan"]')).toBeNull();
    expect(pn.querySelector('[data-kunci="penetapanMassal"]')).toBeNull();
    expect(pn.querySelector('[data-mps-massal="kasir-harian"]')).toBeNull();
  });
});
