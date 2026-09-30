// @vitest-environment node
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

/**
 * ============================================================================
 * TAHAP 3 RENCANA "EKSTENSI DULU" - DOK, LENCANA, DAN WIDGET KECIL
 * ============================================================================
 *
 * Yang dijalankan kode SUNGGUHAN: panel-alat.js UTUH (pengalih Lama / Baru /
 * UI Baru, saklar fitur, alatAmbil) lalu checklist.js UTUH, di jendela jsdom
 * beralamat SIPP, ABT, atau portal - satu konteks vm per halaman, seperti
 * skrip konten yang berbagi satu lingkup. Blok angka ikon di latar.js
 * dijalankan tersendiri dengan chrome.action tiruan.
 *
 * Yang dijaga:
 *   - tampilan Lama IDENTIK dengan checklist.js sebelum tahap 3 (commit
 *     99ab5f8): isi widget, atribut akarnya, penyimpanan, dan permintaannya -
 *     walau seluruh saklar fitur tersimpan menyala;
 *   - tiap fitur popup-N hanya bila saklarnya menyala, di Baru dan UI Baru;
 *   - Selesai / Tunda menyembunyikan butir, tersimpan LOKAL, tunda habis ->
 *     muncul lagi, tanda yatim dibersihkan hanya bila tidak ada ruang ragu;
 *   - dok, lencana, kartu, dan Atur widget hanya dalam UI Baru;
 *   - widget yang menyusul tidak dapat dinyalakan;
 *   - angka ikon mengikuti jumlah yang belum selesai (widget -> latar.js);
 *   - tidak ada permintaan selain GET, dan tidak ada akar baru di <html>.
 */

const EKSTENSI = path.resolve(process.cwd(), "../ekstensi-sipp");
const baca = (berkas: string) => readFileSync(berkas, "utf8").replace(/\r\n/g, "\n");
const SUMBER_ALAT = baca(path.join(EKSTENSI, "panel-alat.js"));
const SUMBER_CHECKLIST = baca(process.env.ALETA_UJI_CHECKLIST || path.join(EKSTENSI, "checklist.js"));
const SUMBER_LATAR = baca(process.env.ALETA_UJI_LATAR || path.join(EKSTENSI, "latar.js"));
/**
 * checklist.js SEBELUM tahap 3 - pembanding "Lama identik". Diambil dari
 * sejarah git (commit tetap), bukan dari salinan di pohon kerja yang dapat
 * ikut tersunting.
 */
const SUMBER_CHECKLIST_LAMA = execFileSync("git", ["show", "99ab5f8:ekstensi-sipp/checklist.js"], {
  cwd: EKSTENSI,
  encoding: "utf8",
}).replace(/\r\n/g, "\n");

const API = "/aleta/api/aleta-ecourt/checklist";
const ASAL = "http://192.168.10.10";
const NYALA = { checklistMilestone: true };
const SEMUA_POPUP = Array.from({ length: 30 }, (_, i) => `popup-${i + 1}`);
const KUNCI_BARU = ["tandaChecklist", "angkaChecklist", "catatanCepat", "lamaSidang", "susunanWidget", "sudutWidget"];

type OpsiJsdom = NonNullable<ConstructorParameters<typeof JSDOM>[1]> & { pretendToBeVisual?: boolean };
type JsdomUji = JSDOM & { getInternalVMContext(): vm.Context };
const jsdomBaru = (html: string, opsi: OpsiJsdom = {}): JsdomUji => new JSDOM(html, opsi) as JsdomUji;

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
// Jawaban portal menurut kontrak (sama dengan ekstensi-checklist-milestone)
// ----------------------------------------------------------------------------
function hariKe(n: number) {
  const t = new Date();
  t.setDate(t.getDate() + n);
  t.setHours(16, 0, 0, 0);
  return t.toISOString();
}

function butirContoh(): Array<Record<string, unknown>> {
  const b = (id: string, jenis: string, judul: string, perkaraId: number, nomor: string, hari: number, kelompok: string, kerjakan: unknown) => ({
    id,
    jenis,
    judul,
    perkara: { id: perkaraId, nomor },
    tenggat: hariKe(hari),
    kelompok,
    keterangan: "",
    kerjakan,
  });
  return [
    b("l1", "pmh", "PMH belum ditetapkan", 10018, "385/Pdt.G/2026/PA.Dgl", -2, "lewat", { tujuan: "sipp", halaman: "penetapan" }),
    b("l2", "minutasi", "Minutasi belum dikerjakan", 10020, "386/Pdt.G/2026/PA.Dgl", -1, "lewat", { tujuan: "abt" }),
    b("h1", "sidang", "Sidang hari ini", 10021, "387/Pdt.G/2026/PA.Dgl", 0, "hari-ini", { tujuan: "aleta", alamat: "/aleta-ecourt?tab=jadwal" }),
    b("h2", "ecourt", "Dokumen e-Court belum diunggah", 10022, "388/Pdt.G/2026/PA.Dgl", 0, "hari-ini", { tujuan: "ecourt" }),
    b("h3", "bas", "BAS belum diunggah", 10023, "389/Pdt.G/2026/PA.Dgl", 0, "hari-ini", { tujuan: "sipp", halaman: "jadwal-sidang" }),
    b("m1", "phs", "PHS mendekati tenggat", 10024, "390/Pdt.G/2026/PA.Dgl", 3, "minggu-ini", { tujuan: "sipp" }),
  ];
}

function jawabanContoh(ubah: Record<string, unknown> = {}) {
  return {
    ok: true,
    data: {
      pengguna: { nama: "Hakim Uji", peran: ["hakim", "ketua"] },
      peranTersedia: [
        { kunci: "hakim", label: "Hakim" },
        { kunci: "ketua", label: "Ketua" },
      ],
      peranAktif: "hakim",
      dibuat: new Date().toISOString(),
      ringkas: { lewat: 2, hariIni: 3, mingguIni: 1, selesaiHariIni: 1, totalHariIni: 4 },
      butir: butirContoh(),
      jenisTidakTersedia: [],
      galat: [],
      ...ubah,
    },
  };
}

// ----------------------------------------------------------------------------
// Tepi luar: chrome.storage dan fetch
// ----------------------------------------------------------------------------
type Ubah = Record<string, { oldValue?: unknown; newValue?: unknown }>;

function penyimpananTiruan(awal: Record<string, unknown>) {
  const simpanan: Record<string, unknown> = polos(awal);
  const pendengar: Array<(ubah: Ubah, wilayah: string) => void> = [];
  const tulisan: string[] = [];
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
        tulisan.push(k);
        ubah[k] = { oldValue: simpanan[k], newValue: polos(v) };
        simpanan[k] = polos(v);
      }
      siarkan(ubah);
    },
    remove: async (kunci: string | string[]) => {
      const ubah: Ubah = {};
      for (const k of [kunci].flat()) {
        tulisan.push(`-${k}`);
        if (!(k in simpanan)) continue;
        ubah[k] = { oldValue: simpanan[k] };
        delete simpanan[k];
      }
      siarkan(ubah);
    },
  };
  return {
    simpanan,
    tulisan,
    storage: {
      local,
      session: { get: async () => ({}), set: async () => undefined },
      onChanged: { addListener: (f: (ubah: Ubah, wilayah: string) => void) => void pendengar.push(f) },
    },
  };
}

function tanggapan(status: number, isi: unknown) {
  const r = { ok: status >= 200 && status < 300, status, json: async () => polos(isi), clone: () => r };
  return r;
}

type Hasil = { status?: number; isi?: unknown };
type Jawab = (url: string) => Hasil | Promise<Hasil>;
const jawabBaku: Jawab = () => ({ isi: jawabanContoh() });

type Halaman = {
  dom: JsdomUji;
  w: any;
  simpanan: Record<string, unknown>;
  tulisan: string[];
  minta: string[];
  /** Setiap permintaan halaman beserta caranya - untuk "tidak ada selain GET". */
  cara: Array<{ url: string; cara: string }>;
  jam: Array<{ ms: number; f: () => void }>;
  setel: (isi: Record<string, unknown>) => Promise<void>;
  hapus: (kunci: string[]) => Promise<void>;
};

const terbuka: Array<{ dom: JSDOM; terbang: () => number }> = [];
afterEach(async () => {
  const mulai = Date.now();
  while (terbuka.some((t) => t.terbang() > 0) && Date.now() - mulai < 4000) await tunggu(10);
  await tunggu(10);
  while (terbuka.length) terbuka.pop()!.dom.window.close();
});

function buka(p: { alamat?: string; simpanan?: Record<string, unknown>; jawab?: Jawab; sumber?: string } = {}): Halaman {
  const dom = jsdomBaru(`<!doctype html><html><head></head><body></body></html>`, {
    url: p.alamat ?? `${ASAL}/SIPP/detil_perkara_agama`,
    runScripts: "outside-only",
    pretendToBeVisual: true,
  });
  let terbang = 0;
  terbuka.push({ dom, terbang: () => terbang });
  const w = dom.window as any;
  const { simpanan, tulisan, storage } = penyimpananTiruan(p.simpanan ?? {});
  w.chrome = {
    runtime: {
      id: "aleta-uji",
      getManifest: () => ({ version: "0.0.0" }),
      getURL: (x: string) => `chrome-extension://aleta-uji/${x}`,
      sendMessage: async () => ({}),
    },
    storage,
  };
  const minta: string[] = [];
  const cara: Array<{ url: string; cara: string }> = [];
  w.fetch = (alamat: string, opsi?: { method?: string }) => {
    const url = String(alamat);
    cara.push({ url, cara: String((opsi && opsi.method) || "GET").toUpperCase() });
    if (!url.includes(API)) return Promise.resolve(tanggapan(200, { ok: true, data: {} }));
    minta.push(url);
    terbang += 1;
    let hasil: Hasil | Promise<Hasil>;
    try {
      hasil = (p.jawab ?? jawabBaku)(url);
    } catch (galat) {
      hasil = Promise.reject(galat);
    }
    const janji = Promise.resolve(hasil).then((x) => tanggapan(x.status ?? 200, x.isi));
    void janji
      .then(
        () => undefined,
        () => undefined
      )
      .then(() =>
        setTimeout(() => {
          terbang -= 1;
        }, 5)
      );
    return janji;
  };
  const jam: Array<{ ms: number; f: () => void }> = [];
  const setIntervalAsli = w.setInterval.bind(w);
  w.setInterval = (f: () => void, ms: number) => {
    jam.push({ ms, f });
    return setIntervalAsli(f, ms);
  };
  w.document.addEventListener("click", (e: any) => e.preventDefault(), true);
  const ctx = dom.getInternalVMContext();
  vm.runInContext(SUMBER_ALAT, ctx, { filename: "panel-alat.js" });
  vm.runInContext(p.sumber ?? SUMBER_CHECKLIST, ctx, { filename: "checklist.js" });
  return {
    dom,
    w,
    simpanan,
    tulisan,
    minta,
    cara,
    jam,
    setel: (isi) => storage.local.set(isi),
    hapus: (kunci) => storage.local.remove(kunci),
  };
}

const akarDari = (h: Halaman) => h.w.document.querySelector("aleta-cm-widget") as any;
const q = (h: Halaman, pemilih: string) => {
  const akar = akarDari(h);
  return akar && akar.shadowRoot ? (akar.shadowRoot.querySelector(pemilih) as any) : null;
};
const qs = (h: Halaman, pemilih: string) => {
  const akar = akarDari(h);
  return (akar && akar.shadowRoot ? Array.from(akar.shadowRoot.querySelectorAll(pemilih)) : []) as any[];
};
const siap = (h: Halaman) => sampai(() => q(h, ".aleta-cm-kelompok"), "kelompok tergambar");
const siapDok = (h: Halaman) => sampai(() => q(h, ".aleta-cmw-dok") && q(h, ".aleta-cm-kelompok"), "dok tergambar");
const idTampil = (h: Halaman) => qs(h, ".aleta-cm-butir").map((li) => li.getAttribute("data-id"));

function tekan(h: Halaman, sasaran: any, jenis: string, x: number, y: number) {
  sasaran.dispatchEvent(
    new h.w.MouseEvent(jenis, { bubbles: true, composed: true, cancelable: true, clientX: x, clientY: y, button: 0 })
  );
}

const fiturDari = (kode: string[]) => Object.fromEntries(kode.map((k) => [k, true]));
const baru = (kode: string[] = [], lain: Record<string, unknown> = {}) => ({
  ...NYALA,
  ujiTampilan: "baru",
  ujiFitur: fiturDari(kode),
  ...lain,
});
const ui = (kode: string[] = [], lain: Record<string, unknown> = {}) => ({
  ...NYALA,
  ujiTampilan: "ui",
  ujiFitur: fiturDari(kode),
  ...lain,
});

/** Isi widget untuk dibandingkan: jam "Diperbarui 10.14" dinormalkan. */
const isiWadah = (h: Halaman) =>
  String(q(h, ".aleta-cm-wadah")?.innerHTML ?? "").replace(/\d{2}\.\d{2}/g, "HH.MM");
/** Atribut akar; gaya dinormalkan per deklarasi - urutan penulisan properti bukan perbedaan tampilan. */
const atributAkar = (h: Halaman) => {
  const a = akarDari(h);
  return Object.fromEntries(
    a.getAttributeNames().map((n: string) => {
      const v = String(a.getAttribute(n));
      return [n, n === "style" ? v.split(";").map((x) => x.trim()).filter(Boolean).sort().join("; ") : v];
    })
  );
};

// ============================================================================
describe("tampilan Lama IDENTIK dengan checklist.js sebelum tahap 3", () => {
  /** Rangkaian tindakan yang sama di dua halaman; potret isi sesudah tiap langkah. */
  async function jalani(h: Halaman) {
    const potret: string[] = [];
    await siap(h);
    await tunggu(40);
    potret.push(isiWadah(h), JSON.stringify(atributAkar(h)));
    q(h, '[data-kelompok="minggu-ini"] .aleta-cm-kelompok-kepala').click();
    await sampai(() => q(h, '[data-id="m1"]'), "minggu ini terbuka");
    potret.push(isiWadah(h));
    q(h, ".aleta-cm-kecilkan").click();
    await sampai(() => q(h, ".aleta-cm-pil"), "pil");
    potret.push(isiWadah(h));
    const pil = q(h, ".aleta-cm-pil");
    tekan(h, pil, "pointerdown", 50, 750);
    tekan(h, pil, "pointermove", 900, 100);
    tekan(h, pil, "pointerup", 900, 100);
    pil.click();
    await tunggu(30);
    potret.push(isiWadah(h), JSON.stringify(atributAkar(h)));
    q(h, ".aleta-cm-pil").click();
    await sampai(() => q(h, ".aleta-cm"), "terbentang");
    await tunggu(40);
    potret.push(isiWadah(h));
    return potret;
  }

  for (const [nama, simpananUji] of [
    ["tanpa kunci ujiTampilan, seluruh 30 saklar popup tersimpan menyala", { ujiFitur: fiturDari(SEMUA_POPUP) }],
    ["ujiTampilan 'lama' tertulis, seluruh saklar menyala", { ujiTampilan: "lama", ujiFitur: fiturDari(SEMUA_POPUP) }],
    ["nilai tampilan asing (diperlakukan Lama)", { ujiTampilan: "entah", ujiFitur: fiturDari(SEMUA_POPUP) }],
  ] as const) {
    it(`${nama}: isi, atribut akar, penyimpanan, dan permintaan sama persis`, async () => {
      const awal = { ...NYALA, ...simpananUji, lamaSidang: { berjalan: { mulai: Date.now() - 60000 } } };
      const lama = buka({ simpanan: awal, sumber: SUMBER_CHECKLIST_LAMA });
      const kini = buka({ simpanan: awal });
      const [a, b] = await Promise.all([jalani(lama), jalani(kini)]);
      expect(b).toEqual(a);
      await tunggu(30);
      // tampilanServer.diambil = cap waktu pembacaan tampilan dari portal
      // (tahap 5), sama di kedua sisi kecuali selisih milidetiknya.
      const tanpaCap = (x: Record<string, any>) => {
        const y = JSON.parse(JSON.stringify(x));
        if (y.tampilanServer) delete y.tampilanServer.diambil;
        return y;
      };
      expect(tanpaCap(kini.simpanan)).toEqual(tanpaCap(lama.simpanan));
      expect(kini.tulisan).toEqual(lama.tulisan);
      expect(kini.cara).toEqual(lama.cara);
      for (const k of KUNCI_BARU) expect(kini.tulisan.some((t) => t.endsWith(k)), k).toBe(false);
      expect(kini.w.document.documentElement.hasAttribute("data-aleta-kulit")).toBe(false);
    });
  }

  it("tampilan Baru TANPA saklar pun sama dengan Lama - hanya saklar yang membawa perubahan", async () => {
    const lama = buka({ simpanan: NYALA, sumber: SUMBER_CHECKLIST_LAMA });
    const kini = buka({ simpanan: baru([]) });
    await Promise.all([siap(lama), siap(kini)]);
    await tunggu(60);
    // Satu-satunya selisih yang sah: perbaikan 30 Sep sore butir 3 (K5) -
    // saklar "Sembunyikan penjelasan teknis" di kaki dan kelas aleta-teknis
    // pada keterangannya. Diminta pengguna untuk Baru DAN UI Baru.
    const tanpaTeknis = (x: string) =>
      x.replace(/<div class="aleta-cmw-teknis" data-widget-teknis="ya">[\s\S]*?<\/button><\/div>/g, "").replace(/ aleta-teknis/g, "");
    expect(isiWadah(kini)).toContain('data-widget-teknis="ya"');
    expect(tanpaTeknis(isiWadah(kini))).toBe(isiWadah(lama));
    q(kini, ".aleta-cm-kecilkan").click();
    q(lama, ".aleta-cm-kecilkan").click();
    await Promise.all([sampai(() => q(kini, ".aleta-cm-pil"), "pil"), sampai(() => q(lama, ".aleta-cm-pil"), "pil")]);
    expect(isiWadah(kini)).toBe(isiWadah(lama));
    for (const k of KUNCI_BARU) expect(k in kini.simpanan, k).toBe(false);
  });

  it("UI Baru -> Lama seketika: tidak ada sisa dok, kartu, kulit, maupun jangkar sudut", async () => {
    const pembanding = buka({ simpanan: NYALA, sumber: SUMBER_CHECKLIST_LAMA });
    const h = buka({
      simpanan: ui(["popup-7", "popup-9", "popup-20", "popup-22"], { sudutWidget: { sipp: "kanan-atas" } }),
    });
    await Promise.all([siap(pembanding), siapDok(h)]);
    expect(akarDari(h).style.right).toBe("12px");
    await h.setel({ ujiTampilan: "lama" });
    await sampai(() => !q(h, ".aleta-cmw-dok"), "dok hilang");
    await tunggu(30);
    expect(isiWadah(h)).toBe(isiWadah(pembanding));
    expect(atributAkar(h)).toEqual(atributAkar(pembanding));
  });
});

// ============================================================================
describe("popup-7: Selesai dan Tunda - lokal, hanya menyembunyikan", () => {
  it("tombolnya hanya ada bila saklar popup-7 menyala (Baru dan UI Baru)", async () => {
    const mati = buka({ simpanan: baru(["popup-6", "popup-8", "popup-9", "popup-20"]) });
    const nyalaBaru = buka({ simpanan: baru(["popup-7"]) });
    const nyalaUi = buka({ simpanan: ui(["popup-7"]) });
    const uiMati = buka({ simpanan: ui([]) });
    await Promise.all([siap(mati), siap(nyalaBaru), siapDok(nyalaUi), siapDok(uiMati)]);
    await tunggu(30);
    expect(qs(mati, ".aleta-cm-tanda").length).toBe(0);
    expect(qs(uiMati, ".aleta-cm-tanda").length).toBe(0);
    // Lewat dan hari ini terbuka bawaan: 5 butir x 2 tombol.
    expect(qs(nyalaBaru, ".aleta-cm-tanda-selesai").length).toBe(5);
    expect(qs(nyalaBaru, ".aleta-cm-tanda-tunda").length).toBe(5);
    expect(qs(nyalaUi, ".aleta-cm-kartu .aleta-cm-tanda-selesai").length).toBe(5);
  });

  it("Selesai: butir hilang, hitungan turun, tanda tersimpan LOKAL dalam bentuk yang disebut; Kembalikan memulihkannya", async () => {
    const h = buka({ simpanan: baru(["popup-7"]) });
    await siap(h);
    q(h, '[data-id="h1"] .aleta-cm-tanda-selesai').click();
    await sampai(() => !q(h, '[data-id="h1"]'), "h1 hilang");
    expect(q(h, '[data-kelompok="hari-ini"] .aleta-cm-hitung').textContent).toBe("2");
    await sampai(() => h.simpanan.tandaChecklist, "tanda tersimpan");
    const t = (h.simpanan.tandaChecklist as any).h1;
    expect(t).toEqual({
      tanda: "selesai",
      pada: expect.any(Number),
      peran: "hakim",
      jenis: "sidang",
      nomor: "387/Pdt.G/2026/PA.Dgl",
      judul: "Sidang hari ini",
    });
    expect(Math.abs(t.pada - Date.now())).toBeLessThan(5000);
    // Kabar menyebut bahwa data SIPP tidak diubah.
    expect(q(h, ".aleta-cm-kabar").textContent).toMatch(/Data SIPP tidak diubah/);
    // Tetap terjangkau dari kaki.
    const baris = await sampai(() => q(h, '[data-tersembunyi="h1"]'), "baris tersembunyi");
    expect(q(h, ".aleta-cm-tersembunyi summary").textContent).toMatch(/1 disembunyikan/);
    baris.querySelector(".aleta-cm-kembalikan").click();
    await sampai(() => q(h, '[data-id="h1"]'), "h1 kembali");
    await sampai(() => !("h1" in ((h.simpanan.tandaChecklist as any) || {})), "tanda dilepas");
    // Tidak ada satu pun permintaan tulisan.
    expect(h.cara.every((c) => c.cara === "GET")).toBe(true);
  });

  it("Tunda: sampai AWAL HARI BESOK; saklar dimatikan -> butir kembali, tandanya tidak dihapus", async () => {
    const h = buka({ simpanan: baru(["popup-7"]) });
    await siap(h);
    q(h, '[data-id="l1"] .aleta-cm-tanda-tunda').click();
    await sampai(() => !q(h, '[data-id="l1"]'), "l1 hilang");
    await sampai(() => h.simpanan.tandaChecklist, "tersimpan");
    const t = (h.simpanan.tandaChecklist as any).l1;
    const kini = new Date();
    expect(t.tanda).toBe("tunda");
    expect(t.sampai).toBe(new Date(kini.getFullYear(), kini.getMonth(), kini.getDate() + 1).getTime());
    expect(q(h, ".aleta-cm-kabar").textContent).toMatch(/ditunda sampai besok/);

    await h.setel({ ujiFitur: {} });
    await sampai(() => q(h, '[data-id="l1"]'), "l1 kembali saat saklar mati");
    expect((h.simpanan.tandaChecklist as any).l1.tanda).toBe("tunda");
    expect(qs(h, ".aleta-cm-tanda").length).toBe(0);
  });

  it("tunda yang habis: butirnya muncul lagi SENDIRI, tanpa muat ulang", async () => {
    const h = buka({
      simpanan: baru(["popup-7"], {
        tandaChecklist: {
          h2: { tanda: "tunda", pada: Date.now(), sampai: Date.now() + 500, peran: "hakim", jenis: "ecourt", nomor: "", judul: "" },
        },
      }),
    });
    await siap(h);
    await sampai(() => idTampil(h).length === 4 && !idTampil(h).includes("h2"), "h2 tertunda");
    await sampai(() => q(h, '[data-id="h2"]'), "h2 muncul lagi", 3000);
  });

  it("tanda yatim dibersihkan hanya bila tidak ada ruang ragu", async () => {
    const tanda = (peran: string, jenis: string) => ({
      tanda: "selesai",
      pada: Date.now() - 1000,
      peran,
      jenis,
      nomor: "",
      judul: "",
    });
    const awal = {
      "x:hilang": tanda("hakim", "x"),
      "y:peran-lain": tanda("ketua", "y"),
      "z:terpangkas": tanda("hakim", "z"),
      "w:belum-terhitung": tanda("hakim", "w"),
      l1: tanda("hakim", "pmh"),
      "tua:sekali": { ...tanda("", "t"), pada: Date.now() - 31 * 24 * 60 * 60 * 1000 },
      "tunda:habis": { ...tanda("", "t"), tanda: "tunda", sampai: Date.now() - 1 },
    };
    const lengkap = jawabanContoh({
      butir: [...butirContoh(), { id: "z:lainnya", jenis: "z", judul: "Z", perkara: null, tenggat: null, kelompok: "lewat", kerjakan: { tujuan: "sipp" } }],
      jenisTidakTersedia: [{ jenis: "w", sebab: "belum terbaca" }],
    });
    const h = buka({ simpanan: baru(["popup-7"], { tandaChecklist: awal }), jawab: () => ({ isi: lengkap }) });
    await siap(h);
    await sampai(() => !("x:hilang" in (h.simpanan.tandaChecklist as any)), "yatim dibersihkan");
    expect(Object.keys(h.simpanan.tandaChecklist as any).sort()).toEqual(
      ["l1", "w:belum-terhitung", "y:peran-lain", "z:terpangkas"].sort()
    );
    expect(idTampil(h)).not.toContain("l1");
    // Butir ringkasan ("... dan 7 perkara lain") tidak dapat ditandai.
    expect(q(h, '[data-id="z:lainnya"] .aleta-cm-tanda')).toBeNull();

    // Jawaban dengan bacaan yang gagal: tidak ada yang diputuskan yatim.
    const g = buka({
      simpanan: baru(["popup-7"], { tandaChecklist: { "x:hilang": tanda("hakim", "x") } }),
      jawab: () => ({ isi: jawabanContoh({ galat: ["Koleksi jadwal gagal dibaca"] }) }),
    });
    await siap(g);
    await tunggu(60);
    expect(Object.keys(g.simpanan.tandaChecklist as any)).toEqual(["x:hilang"]);
  });
});

// ============================================================================
describe("popup-6: angka belum selesai ke ikon ekstensi", () => {
  it("angkaChecklist ditulis HANYA bila saklarnya menyala, dan mengikuti Selesai / Tunda", async () => {
    const mati = buka({ simpanan: baru(["popup-7", "popup-8"]) });
    const h = buka({ simpanan: baru(["popup-6", "popup-7"]) });
    await Promise.all([siap(mati), siap(h)]);
    await sampai(() => (h.simpanan.angkaChecklist as any)?.belum === 6, "enam belum selesai");
    expect(h.simpanan.angkaChecklist).toEqual({
      belum: 6,
      lewat: 2,
      hariIni: 3,
      sambungan: "baik",
      pada: expect.any(Number),
    });
    q(h, '[data-id="h1"] .aleta-cm-tanda-selesai').click();
    await sampai(() => (h.simpanan.angkaChecklist as any)?.belum === 5, "lima");
    q(h, '[data-id="l1"] .aleta-cm-tanda-tunda').click();
    await sampai(() => (h.simpanan.angkaChecklist as any)?.belum === 4, "empat");
    expect((h.simpanan.angkaChecklist as any).lewat).toBe(1);
    await tunggu(30);
    expect("angkaChecklist" in mati.simpanan).toBe(false);
  });

  it("latar.js: angka di ikon hanya dalam Baru/UI Baru, saklar popup-6, ALETA dan checklist menyala, dan belum basi", async () => {
    const i = SUMBER_LATAR.indexOf("// ANGKA TUGAS DI IKON EKSTENSI");
    expect(i, "blok angka ikon di latar.js").toBeGreaterThan(0);
    // Hanya blok angka ikon: blok sinkron tanda (tahap 5) sesudahnya punya
    // pewaktu dan setelan server sendiri, dan diuji di ekstensi-tampilan-server.
    const ujung = SUMBER_LATAR.indexOf("// SINKRON TANDA SELESAI", i);
    const blok = SUMBER_LATAR.slice(
      SUMBER_LATAR.lastIndexOf("// =====", i),
      ujung > 0 ? SUMBER_LATAR.lastIndexOf("// =====", ujung) : undefined
    );
    const simpanan: Record<string, unknown> = {};
    const pendengar: Array<(u: Record<string, unknown>, w: string) => void> = [];
    const lencana: Array<{ teks?: string; warna?: string }> = [];
    const chrome = {
      storage: {
        local: { get: async (k: string[]) => Object.fromEntries(k.filter((x) => x in simpanan).map((x) => [x, polos(simpanan[x])])) },
        onChanged: { addListener: (f: any) => void pendengar.push(f) },
      },
      action: {
        setBadgeText: async (o: { text: string }) => void lencana.push({ teks: o.text }),
        setBadgeBackgroundColor: async (o: { color: string }) => void lencana.push({ warna: o.color }),
      },
    };
    vm.runInNewContext(blok, { chrome, Date, Number, Math, String, console });
    const ubah = async (isi: Record<string, unknown>) => {
      Object.assign(simpanan, isi);
      for (const f of pendengar) f(Object.fromEntries(Object.keys(isi).map((k) => [k, { newValue: isi[k] }])), "local");
      await tunggu(10);
    };
    const teksTerakhir = () => [...lencana].reverse().find((x) => x.teks !== undefined)?.teks;
    await tunggu(10);
    expect(teksTerakhir()).toBe("");

    const angka = { belum: 4, lewat: 1, hariIni: 2, sambungan: "baik", pada: Date.now() };
    await ubah({ angkaChecklist: angka, checklistMilestone: true });
    expect(teksTerakhir(), "Lama: tanpa angka").toBe("");
    await ubah({ ujiTampilan: "ui", ujiFitur: { "popup-6": false } });
    expect(teksTerakhir(), "saklar mati").toBe("");
    await ubah({ ujiFitur: { "popup-6": true } });
    expect(teksTerakhir()).toBe("4");
    expect(lencana.at(-1)).toEqual({ warna: "#c62828" });
    await ubah({ angkaChecklist: { ...angka, belum: 3, lewat: 0 } });
    expect(teksTerakhir()).toBe("3");
    expect(lencana.at(-1)).toEqual({ warna: "#b45309" });
    await ubah({ angkaChecklist: { ...angka, belum: 250 } });
    expect(teksTerakhir()).toBe("99+");
    await ubah({ checklistMilestone: false });
    expect(teksTerakhir(), "checklist dimatikan").toBe("");
    await ubah({ checklistMilestone: true, aktif: false });
    expect(teksTerakhir(), "ALETA dimatikan").toBe("");
    await ubah({ aktif: true, angkaChecklist: { ...angka, pada: Date.now() - 13 * 60 * 60 * 1000 } });
    expect(teksTerakhir(), "angka basi").toBe("");
    await ubah({ angkaChecklist: { ...angka, pada: Date.now() } });
    expect(teksTerakhir()).toBe("4");
    await ubah({ ujiTampilan: "lama" });
    expect(teksTerakhir(), "kembali ke Lama").toBe("");
  });

  it("kunci yang ditulis widget sama dengan yang dibaca latar.js", () => {
    expect(SUMBER_CHECKLIST).toContain('const KUNCI_ANGKA = "angkaChecklist";');
    expect(SUMBER_LATAR).toContain('"angkaChecklist", "ujiTampilan", "ujiFitur", "tampilanServer", "aktif", "checklistMilestone"');
  });
});

// ============================================================================
describe("popup-8 dan D10: lencana logo berkabar", () => {
  it("Baru + popup-8: bentuk ciutnya lencana berangka dengan cincin hijau; tanpa saklar tetap pil", async () => {
    const h = buka({ simpanan: baru(["popup-8"], { posisiChecklistSipp: { kecil: true } }) });
    const pil = buka({ simpanan: baru([], { posisiChecklistSipp: { kecil: true } }) });
    const l = await sampai(() => (q(h, ".aleta-cmw-lencana-angka") ? q(h, ".aleta-cmw-lencana") : null), "lencana berangka");
    expect(q(h, ".aleta-cmw-lencana-angka").textContent).toBe("6");
    expect(q(h, ".aleta-cmw-lencana-angka").getAttribute("data-nada")).toBe("lewat");
    expect(l.getAttribute("data-sambungan")).toBe("baik");
    expect(l.title).toMatch(/cincin hijau/);
    expect(q(h, ".aleta-cm-pil")).toBeNull();
    await sampai(() => q(pil, ".aleta-cm-pil"), "pil");
    expect(q(pil, ".aleta-cmw-lencana")).toBeNull();
    // Ditekan: terbentang.
    l.click();
    await sampai(() => q(h, ".aleta-cm"), "terbentang");
  });

  for (const [nama, jawab, harap] of [
    ["portal tidak terjangkau -> merah", () => { throw new TypeError("Failed to fetch"); }, "putus"],
    ["500 -> merah", () => ({ status: 500, isi: {} }), "putus"],
    ["401 -> oranye, belum masuk", () => ({ status: 401, isi: {} }), "belum-masuk"],
  ] as Array<[string, Jawab, string]>) {
    it(`UI Baru: ${nama}`, async () => {
      const h = buka({ simpanan: ui([]), jawab });
      const l = await sampai(() => (q(h, ".aleta-cmw-lencana")?.getAttribute("data-sambungan") === harap ? q(h, ".aleta-cmw-lencana") : null), harap, 5000);
      expect(l).not.toBeNull();
    });
  }

  it("UI Baru: jawaban yang lebih lama dari ambang 'portal lambat' -> oranye", async () => {
    const h = buka({ simpanan: ui([]), jawab: () => new Promise((r) => setTimeout(() => r({ isi: jawabanContoh() }), 2700)) });
    const l = await sampai(() => (q(h, ".aleta-cmw-lencana")?.getAttribute("data-sambungan") === "lambat" ? q(h, ".aleta-cmw-lencana") : null), "lambat", 6000);
    expect(l.title).toMatch(/cincin oranye: portal lambat/);
  }, 10000);
});

// ============================================================================
describe("popup-9: menempel ke sudut terdekat, diingat per situs", () => {
  it("dilepas: menempel ke sudut terdekat, diingat untuk SIPP saja, dan disebut di kaki", async () => {
    const h = buka({ simpanan: baru(["popup-9"]) });
    await siap(h);
    const akar = akarDari(h);
    const judul = q(h, ".aleta-cm-judul");
    tekan(h, judul, "pointerdown", 100, 700);
    tekan(h, judul, "pointermove", 900, 100);
    tekan(h, judul, "pointerup", 900, 100);
    await sampai(() => h.simpanan.sudutWidget, "sudut tersimpan");
    expect(h.simpanan.sudutWidget).toEqual({ sipp: "kanan-atas" });
    expect([akar.style.left, akar.style.right, akar.style.top, akar.style.bottom]).toEqual(["auto", "12px", "12px", "auto"]);
    expect(q(h, ".aleta-cm-sudut").textContent).toBe("Menempel kanan atas · diingat untuk SIPP");

    // Digeser lagi dari sudut kanan atas: titik awalnya dari kotaknya, bukan
    // melompat. Judulnya dicari ulang - widget sudah digambar ulang.
    const judul2 = q(h, ".aleta-cm-judul");
    tekan(h, judul2, "pointerdown", 900, 20);
    tekan(h, judul2, "pointermove", 100, 700);
    tekan(h, judul2, "pointerup", 100, 700);
    await sampai(() => (h.simpanan.sudutWidget as any).sipp === "kiri-bawah", "kiri bawah");
    expect([akar.style.left, akar.style.bottom]).toEqual(["12px", "12px"]);
  });

  it("halaman ABT dan portal punya sudutnya sendiri; halaman berikutnya memakainya; popup mengembalikannya", async () => {
    const simpanan = baru(["popup-9"], {
      sudutWidget: { sipp: "kanan-atas", abt: "kanan-bawah" },
      posisiChecklistAbt: { kecil: false },
    });
    const abt = buka({ simpanan, alamat: `${ASAL}/aps_badilag/abt/main/beranda` });
    const portal = buka({ simpanan, alamat: `${ASAL}/aleta/aleta-ecourt` });
    await Promise.all([siap(abt), siap(portal)]);
    expect([akarDari(abt).style.right, akarDari(abt).style.bottom]).toEqual(["12px", "12px"]);
    expect([akarDari(portal).style.left, akarDari(portal).style.bottom]).toEqual(["12px", "12px"]);
    await abt.hapus(["posisiChecklistAbt"]);
    await sampai(() => !("abt" in (abt.simpanan.sudutWidget as any)), "sudut ABT dilupakan");
    expect((abt.simpanan.sudutWidget as any).sipp).toBe("kanan-atas");
    expect([akarDari(abt).style.left, akarDari(abt).style.bottom]).toEqual(["12px", "12px"]);
  });

  it("tanpa saklarnya: tidak menempel dan tidak menulis apa pun", async () => {
    const h = buka({ simpanan: baru(["popup-7"], { sudutWidget: { sipp: "kanan-atas" } }) });
    await siap(h);
    const akar = akarDari(h);
    expect([akar.style.left, akar.style.bottom]).toEqual(["12px", "12px"]);
    const judul = q(h, ".aleta-cm-judul");
    tekan(h, judul, "pointerdown", 100, 700);
    tekan(h, judul, "pointermove", 900, 100);
    tekan(h, judul, "pointerup", 900, 100);
    await tunggu(40);
    expect(h.simpanan.sudutWidget).toEqual({ sipp: "kanan-atas" });
    expect(akar.style.right).toBe("auto");
  });
});

// ============================================================================
describe("popup-20, 21, 22: catatan, lama sidang, kalender - lokal", () => {
  it("masing-masing hanya tampil bila saklarnya menyala", async () => {
    const tanpa = buka({ simpanan: baru(["popup-7", "popup-8"]) });
    const catatan = buka({ simpanan: baru(["popup-20"]) });
    const semua = buka({ simpanan: baru(["popup-20", "popup-21", "popup-22"]) });
    await Promise.all([siap(tanpa), siap(catatan), siap(semua)]);
    await tunggu(30);
    const isi = (h: Halaman) => qs(h, "[data-widget-isi]").map((x) => x.getAttribute("data-widget-isi"));
    expect(isi(tanpa)).toEqual([]);
    expect(isi(catatan)).toEqual(["catatan"]);
    expect(isi(semua)).toEqual(["catatan", "lama-sidang", "kalender"]);
    // Baru (kulit Klasik): ditumpuk di atas checklist, tanpa dok dan tanpa galeri.
    expect(q(semua, ".aleta-cmw-dok")).toBeNull();
    expect(q(semua, ".aleta-cmw-atur-buka")).toBeNull();
  });

  it("catatan cepat: tersimpan di peramban, elemennya bertahan saat digambar ulang, dan ikut tab lain", async () => {
    const h = buka({ simpanan: baru(["popup-20"], { catatanCepat: { teks: "awal", pada: 1 } }) });
    await siap(h);
    const kotak = await sampai(() => q(h, ".aleta-cmw-catatan"), "kotak catatan");
    expect(kotak.value).toBe("awal");
    kotak.value = "511 - tanya juru sita soal alamat baru";
    kotak.dispatchEvent(new h.w.Event("input", { bubbles: true }));
    await sampai(() => (h.simpanan.catatanCepat as any)?.teks === "511 - tanya juru sita soal alamat baru", "tersimpan", 3000);
    q(h, ".aleta-cm-segar").click();
    await tunggu(60);
    expect(q(h, ".aleta-cmw-catatan")).toBe(kotak);
    expect(kotak.value).toBe("511 - tanya juru sita soal alamat baru");
    await h.setel({ catatanCepat: { teks: "dari tab lain", pada: Date.now() } });
    await sampai(() => kotak.value === "dari tab lain", "ikut tab lain");
  });

  it("lama sidang: Skors tidak dihitung, Selesai dicatat, rata-rata HANYA dari catatan lokal", async () => {
    const mulai = Date.now() - 5 * 60 * 1000 - 3000;
    const h = buka({ simpanan: baru(["popup-21"], { lamaSidang: { berjalan: { mulai, skorsSejak: 0, skorsMs: 0 }, riwayat: [] } }) });
    await siap(h);
    const jam = await sampai(() => q(h, ".aleta-cmw-jam"), "jam");
    expect(jam.textContent).toMatch(/^00:05:0\d$/);
    expect(q(h, ".aleta-cmw-sidang-rata").textContent).toMatch(/sesudah sidang pertama/);
    // Berdetak.
    const sebelum = jam.textContent;
    await sampai(() => q(h, ".aleta-cmw-jam").textContent !== sebelum, "jam berdetak", 2500);

    q(h, '[data-fokus="sidang-skors"]').click();
    await sampai(() => (h.simpanan.lamaSidang as any)?.berjalan?.skorsSejak > 0, "diskors");
    expect(q(h, ".aleta-cmw-jam").getAttribute("data-skors")).toBe("ya");
    await tunggu(50);
    q(h, '[data-fokus="sidang-lanjut"]').click();
    await sampai(() => (h.simpanan.lamaSidang as any)?.berjalan?.skorsSejak === 0, "lanjut");
    expect((h.simpanan.lamaSidang as any).berjalan.skorsMs).toBeGreaterThanOrEqual(40);
    q(h, '[data-fokus="sidang-selesai"]').click();
    await sampai(() => (h.simpanan.lamaSidang as any)?.berjalan === null, "selesai");
    const r = (h.simpanan.lamaSidang as any).riwayat;
    expect(r.length).toBe(1);
    expect(r[0].lamaMs).toBeGreaterThan(5 * 60 * 1000);
    expect(r[0].lamaMs).toBeLessThan(5 * 60 * 1000 + 10000);
    await sampai(() => /Rata-rata 5 menit dari 1 sidang/.test(q(h, ".aleta-cmw-sidang-rata").textContent), "rata-rata");

    // Mulai lalu Batal: tidak dicatat. Salah tekan kurang dari semenit pun tidak.
    q(h, '[data-fokus="sidang-mulai"]').click();
    await sampai(() => (h.simpanan.lamaSidang as any)?.berjalan, "mulai");
    q(h, '[data-fokus="sidang-selesai"]').click();
    await sampai(() => (h.simpanan.lamaSidang as any)?.berjalan === null, "selesai singkat");
    expect((h.simpanan.lamaSidang as any).riwayat.length).toBe(1);
  }, 10000);

  it("kalender tenggat: dua minggu dari Senin, dari data checklist yang SUDAH ada, tanpa permintaan baru", async () => {
    const h = buka({ simpanan: baru(["popup-22"]) });
    await siap(h);
    const sel = await sampai(() => (qs(h, ".aleta-cmw-kal-tgl").length === 14 ? qs(h, ".aleta-cmw-kal-tgl") : null), "14 hari");
    const kini = new Date();
    const senin = new Date(kini.getFullYear(), kini.getMonth(), kini.getDate() - ((kini.getDay() + 6) % 7));
    const kunci = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    expect(sel[0].getAttribute("data-tanggal")).toBe(kunci(senin));
    const hariIni = q(h, '.aleta-cmw-kal-tgl[data-kini="ya"]');
    expect(hariIni.getAttribute("data-tanggal")).toBe(kunci(kini));
    expect(hariIni.getAttribute("data-jumlah")).toBe("3");
    expect(hariIni.getAttribute("data-nada")).toBe("mendesak");
    hariIni.click();
    await sampai(() => qs(h, ".aleta-cmw-kal-daftar li").length === 3, "daftar hari ini");
    expect(qs(h, ".aleta-cmw-kal-daftar .aleta-cm-kerjakan").length).toBe(3);
    expect(h.minta.length).toBe(1);
  });
});

// ============================================================================
describe("UI Baru: dok, kartu, dan Atur widget (D8-D11, popup-23)", () => {
  it("dok, lencana, kartu, dan Atur widget HANYA dalam UI Baru", async () => {
    const b = buka({ simpanan: baru(SEMUA_POPUP) });
    const u = buka({ simpanan: ui([]) });
    await Promise.all([siap(b), siapDok(u)]);
    await tunggu(30);
    expect(q(b, ".aleta-cmw-dok")).toBeNull();
    expect(q(b, ".aleta-cmw-atur-buka")).toBeNull();
    expect(q(b, ".aleta-cm-kartu")).toBeNull();
    expect(akarDari(b).hasAttribute("data-kulit")).toBe(false);

    expect(akarDari(u).getAttribute("data-kulit")).toBe("modern");
    expect(qs(u, ".aleta-cm-kartu").map((k) => k.getAttribute("data-nada"))).toEqual([
      "lewat",
      "lewat",
      "mendesak",
      "mendesak",
      "mendesak",
    ]);
    expect(q(u, '[data-id="l1"] .aleta-cm-kartu-tenggat').textContent).toBe("2 hari lewat");
    // D9 + D10: satu dok, lencana berangka di kakinya.
    expect(q(u, ".aleta-cmw-dok .aleta-cmw-lencana .aleta-cmw-lencana-angka").textContent).toBe("6");
    expect(q(u, ".aleta-cmw-lencana-teks").textContent).toBe("6 tugas · cincin hijau: portal tersambung");
    // Ciut: hanya lencana.
    q(u, ".aleta-cmw-lencana").click();
    await sampai(() => q(u, '.aleta-cmw-dok[data-dok="ciut"]'), "ciut");
    expect(q(u, ".aleta-cm")).toBeNull();
    expect(q(u, ".aleta-cmw-atur-buka")).toBeNull();
  });

  it("Atur widget: yang saklarnya mati dan yang menyusul DISEBUT tetapi tidak dapat dinyalakan", async () => {
    // Saklar popup-17..19 dan 24 pun menyala: tetap menyusul.
    const h = buka({ simpanan: ui(["popup-20", "popup-17", "popup-18", "popup-19", "popup-24"]) });
    await siapDok(h);
    q(h, ".aleta-cmw-atur-buka").click();
    await sampai(() => q(h, ".aleta-cmw-atur"), "atur terbuka");
    const baris = qs(h, ".aleta-cmw-atur-baris");
    expect(baris.map((b) => b.getAttribute("data-widget"))).toEqual([
      "checklist",
      "catatan",
      "lama-sidang",
      "kalender",
      "jadwal-saya",
      "antrean",
      "whatsapp",
      "jendela",
    ]);
    const saklar = (id: string) => q(h, `[data-widget="${id}"] .aleta-cmw-saklar`);
    expect(saklar("checklist").getAttribute("aria-checked")).toBe("true");
    expect(saklar("catatan").getAttribute("aria-checked")).toBe("true");
    expect(saklar("lama-sidang").disabled).toBe(true);
    expect(q(h, '[data-widget="lama-sidang"] small').textContent).toMatch(/popup-21 .* masih mati/);
    for (const id of ["jadwal-saya", "antrean", "whatsapp", "jendela"]) {
      const b = q(h, `[data-widget="${id}"]`);
      expect(b.getAttribute("data-menyusul"), id).toBe("ya");
      expect(b.querySelector(".aleta-cmw-menyusul").textContent, id).toBe("menyusul");
      expect(saklar(id).disabled, id).toBe(true);
      expect(saklar(id).getAttribute("aria-checked"), id).toBe("false");
      saklar(id).click();
    }
    await tunggu(40);
    expect("susunanWidget" in h.simpanan).toBe(false);
  });

  it("Atur widget: saklar menyembunyikan, ↑ ↓ dan seret mengurutkan - satu susunan untuk semua situs", async () => {
    const h = buka({ simpanan: ui(["popup-20", "popup-22"]) });
    await siapDok(h);
    const urutanDok = () => qs(h, ".aleta-cmw-tumpuk > *").map((x) => x.getAttribute("data-widget-isi") || "checklist");
    await sampai(() => urutanDok().length === 3, "tiga widget");
    expect(urutanDok()).toEqual(["checklist", "catatan", "kalender"]);
    q(h, ".aleta-cmw-atur-buka").click();
    await sampai(() => q(h, ".aleta-cmw-atur"), "atur");
    q(h, '[data-widget="catatan"] .aleta-cmw-saklar').click();
    await sampai(() => (h.simpanan.susunanWidget as any)?.semua?.mati?.includes("catatan"), "catatan disembunyikan");
    q(h, '[data-fokus="atur-naik-kalender"]').click();
    await sampai(
      () => JSON.stringify((h.simpanan.susunanWidget as any).semua.urutan) === JSON.stringify(["checklist", "catatan", "kalender", "lama-sidang"]),
      "kalender naik"
    );
    // Seret ⋮⋮: baris diberi kotak tiruan (jsdom tidak menata letak).
    const daftar = qs(h, ".aleta-cmw-atur-baris[data-urut]");
    daftar.forEach((b, i) => (b.getBoundingClientRect = () => ({ top: i * 40, bottom: i * 40 + 40, height: 40, left: 0, right: 300, width: 300 })));
    const pegangan = q(h, '[data-widget="kalender"] .aleta-cmw-pegangan');
    tekan(h, pegangan, "pointerdown", 10, 100);
    tekan(h, pegangan, "pointermove", 10, 10);
    tekan(h, pegangan, "pointerup", 10, 10);
    await sampai(() => (h.simpanan.susunanWidget as any).semua.urutan[0] === "kalender", "diseret ke atas");
    expect((h.simpanan.susunanWidget as any).semua.urutan).toEqual(["kalender", "checklist", "catatan", "lama-sidang"]);
    // Menyeret baris tidak menggeser dok.
    expect([akarDari(h).style.left, akarDari(h).style.bottom]).toEqual(["12px", "12px"]);
    q(h, ".aleta-cmw-atur-tutup").click();
    await sampai(() => !q(h, ".aleta-cmw-atur"), "atur tertutup");
    expect(urutanDok()).toEqual(["kalender", "checklist"]);
    // Checklist boleh disembunyikan dari dok; lencana dan permintaannya tetap.
    q(h, ".aleta-cmw-atur-buka").click();
    await sampai(() => q(h, ".aleta-cmw-atur"), "atur");
    q(h, '[data-widget="checklist"] .aleta-cmw-saklar').click();
    q(h, ".aleta-cmw-atur-tutup").click();
    await sampai(() => urutanDok().join() === "kalender", "hanya kalender");
    expect(q(h, ".aleta-cmw-lencana-angka").textContent).toBe("6");
  });

  it("popup-23: susunan per situs - SIPP menulis miliknya sendiri, ABT tetap memakai susunan bersama", async () => {
    const simpanan = ui(["popup-20", "popup-23"], {
      susunanWidget: { semua: { urutan: ["catatan", "checklist"], mati: [] } },
    });
    const h = buka({ simpanan });
    await siapDok(h);
    q(h, ".aleta-cmw-atur-buka").click();
    await sampai(() => q(h, ".aleta-cmw-atur"), "atur");
    expect(q(h, ".aleta-cmw-atur .aleta-cmw-ket").textContent).toMatch(/untuk SIPP saja/);
    q(h, '[data-fokus="atur-turun-catatan"]').click();
    await sampai(() => (h.simpanan.susunanWidget as any).sipp, "susunan SIPP");
    expect((h.simpanan.susunanWidget as any).sipp.urutan.slice(0, 2)).toEqual(["checklist", "catatan"]);
    expect((h.simpanan.susunanWidget as any).semua.urutan).toEqual(["catatan", "checklist"]);

    const abt = buka({ simpanan: polos(h.simpanan), alamat: `${ASAL}/aps_badilag/abt/main/beranda` });
    await siapDok(abt);
    const urutan = qs(abt, ".aleta-cmw-tumpuk > *").map((x) => x.getAttribute("data-widget-isi") || "checklist");
    expect(urutan).toEqual(["catatan", "checklist"]);
  });
});

// ============================================================================
describe("batas yang tidak berubah: mode coba, akar, layar publik", () => {
  it("seluruh fitur dinyalakan dan dipakai: tidak ada satu pun permintaan selain GET", async () => {
    const h = buka({ simpanan: ui(SEMUA_POPUP) });
    await siapDok(h);
    q(h, '[data-id="h1"] .aleta-cm-tanda-selesai').click();
    await sampai(() => !q(h, '[data-id="h1"]'), "selesai");
    q(h, '[data-id="l1"] .aleta-cm-tanda-tunda').click();
    const catatan = await sampai(() => q(h, ".aleta-cmw-catatan"), "catatan");
    catatan.value = "uji";
    catatan.dispatchEvent(new h.w.Event("input", { bubbles: true }));
    q(h, '[data-fokus="sidang-mulai"]').click();
    q(h, ".aleta-cmw-atur-buka").click();
    await sampai(() => q(h, ".aleta-cmw-atur"), "atur");
    q(h, '[data-widget="catatan"] .aleta-cmw-saklar').click();
    await tunggu(700);
    expect(h.cara.length).toBeGreaterThan(0);
    expect(h.cara.filter((c) => c.cara !== "GET")).toEqual([]);
    // Selain checklist hanya satu bacaan: tampilan yang diterapkan admin (tahap 5).
    expect(h.cara.every((c) => c.url.includes(API) || c.url.includes("/api/aleta-ecourt/ekstensi/tampilan"))).toBe(true);
    // Semuanya di dalam SATU akar - senyap 1 jam dan blok cetak panel.css
    // menyembunyikan aleta-cm-widget, jadi tidak ada inang baru yang lolos.
    expect(Array.from(h.w.document.documentElement.children).map((x: any) => x.tagName)).toEqual([
      "HEAD",
      "BODY",
      "ALETA-CM-WIDGET",
    ]);
  });

  it("layar publik portal: UI Baru dengan seluruh fitur pun tidak memuat apa pun", async () => {
    const h = buka({ simpanan: ui(SEMUA_POPUP), alamat: `${ASAL}/aleta/antrian-layar` });
    await tunggu(150);
    expect(Boolean(akarDari(h))).toBe(false);
    expect(h.minta).toEqual([]);
    expect(h.tulisan).toEqual([]);
  });

  it("tetap tidak ikut tercetak: aturan cetak :host tidak tersentuh", () => {
    expect(SUMBER_CHECKLIST).toMatch(/@media print \{\s*:host \{ display: none !important; \}\s*\}/);
  });
});
