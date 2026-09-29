// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

import { ALAMAT_ALETA, KATALOG_CHECKLIST, KUNCI_PERAN, LABEL_PERAN } from "@/lib/checklist-milestone-katalog";

/**
 * ============================================================================
 * CHECKLIST MILESTONE - WIDGET TERSENDIRI, DIJALANKAN SUNGGUHAN
 * ============================================================================
 *
 * Yang dijalankan kode SUNGGUHAN: panel-alat.js UTUH (alatAmbil dengan batas
 * waktu, percobaan kedua, dan kalimat kegagalannya) lalu checklist.js UTUH, di
 * dalam jendela jsdom beralamat SIPP, ABT, atau portal - satu konteks vm per
 * halaman, persis seperti skrip konten yang berbagi satu lingkup. Popup
 * dijalankan dengan popup.html dan popup.js sungguhan.
 *
 * Yang ditiru hanya tepi luarnya: chrome.storage (dengan onChanged yang
 * sampai SESUDAH penulisan, seperti Chrome) dan jawaban portal
 * GET /aleta/api/aleta-ecourt/checklist menurut kontraknya.
 *
 * Yang dijaga:
 *   - saklar bawaan MATI, muncul/hilang seketika, tunduk pada saklar induk,
 *     tidak pernah di halaman cetak, dan × mematikan saklarnya sendiri;
 *   - widget bukan bagian panel ALETA dan panel ALETA tidak berubah;
 *   - kelompok, hitungan, kemajuan hari ini, dan kaki dari jawaban;
 *   - alamat Kerjakan untuk tiap tujuan dari halaman SIPP, ABT, dan portal;
 *   - pil dan geser, posisi per aplikasi, kembali dari popup;
 *   - 401, portal mati, 404, 500 - dan butir lama yang tetap tampil;
 *   - ganti peran memanggil ?peran= dan diingat;
 *   - penyegaran lima menit, saat fokus kembali, dan tab di belakang;
 *   - palet sama dengan panel.css; popup; manifest; lingkup bersama;
 *   - tidak pernah tercetak, tidak pernah di layar yang menghadap masyarakat;
 *   - teks portal digambar sebagai teks; alamat Kerjakan yang diserang;
 *   - badan jawaban basi; panen hanya selama menyala; pintu masuk SIPP sah.
 *
 * ALETA_UJI_CHECKLIST / ALETA_UJI_POPUP_JS / ALETA_UJI_POPUP_HTML /
 * ALETA_UJI_MANIFEST / ALETA_UJI_PANEL_CSS / ALETA_UJI_ALAT (panel-alat.js) /
 * ALETA_UJI_ALETA (aleta.js) menunjuk SALINAN berkas untuk pembukti gigitan.
 */

const EKSTENSI = path.resolve(process.cwd(), "../ekstensi-sipp");
const baca = (berkas: string) => readFileSync(berkas, "utf8").replace(/\r\n/g, "\n");
const BERKAS_CHECKLIST = process.env.ALETA_UJI_CHECKLIST || path.join(EKSTENSI, "checklist.js");
const BERKAS_POPUP_JS = process.env.ALETA_UJI_POPUP_JS || path.join(EKSTENSI, "popup.js");
const BERKAS_POPUP_HTML = process.env.ALETA_UJI_POPUP_HTML || path.join(EKSTENSI, "popup.html");
const BERKAS_MANIFEST = process.env.ALETA_UJI_MANIFEST || path.join(EKSTENSI, "manifest.json");
const BERKAS_PANEL_CSS = process.env.ALETA_UJI_PANEL_CSS || path.join(EKSTENSI, "panel.css");
const SUMBER_ALAT = baca(process.env.ALETA_UJI_ALAT || path.join(EKSTENSI, "panel-alat.js"));
/** Skrip halaman yang boleh ditukar salinannya: nama berkas -> variabel lingkungan. */
const SALINAN_SKRIP: Record<string, string | undefined> = { "aleta.js": process.env.ALETA_UJI_ALETA };
const SUMBER_CHECKLIST = baca(BERKAS_CHECKLIST);

const API = "/aleta/api/aleta-ecourt/checklist";
const ASAL = "http://192.168.10.10";
const NYALA = { checklistMilestone: true };
const LIMA_MENIT = 5 * 60 * 1000;

/**
 * src/test/jsdom.d.ts hanya mendeklarasikan yang dipakai uji SSO. Dua bagian
 * jsdom yang dipakai di sini - konteks vm halaman (tempat skrip konten
 * berbagi satu lingkup) dan pretendToBeVisual - ditambahkan untuk berkas ini
 * saja, tanpa mengubah deklarasi bersama.
 */
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
// Jawaban portal menurut kontrak
// ----------------------------------------------------------------------------
function hariKe(n: number) {
  const t = new Date();
  t.setDate(t.getDate() + n);
  t.setHours(16, 0, 0, 0);
  return t.toISOString();
}

const perkara = (id: number, nomor: string) => ({ id, nomor });

function butirContoh(): Array<Record<string, unknown>> {
  return [
    {
      id: "l1",
      jenis: "pmh",
      judul: "PMH belum ditetapkan",
      perkara: perkara(10018, "385/Pdt.G/2026/PA.Dgl"),
      tenggat: hariKe(-2),
      kelompok: "lewat",
      keterangan: "didaftarkan 20 Sep",
      kerjakan: { tujuan: "sipp", halaman: "penetapan" },
    },
    {
      id: "l2",
      jenis: "minutasi",
      judul: "Minutasi belum dikerjakan",
      perkara: perkara(10020, "386/Pdt.G/2026/PA.Dgl"),
      tenggat: hariKe(-1),
      kelompok: "lewat",
      keterangan: "putus 10 Sep",
      kerjakan: { tujuan: "abt", halaman: "Putusan CG" },
    },
    {
      id: "h1",
      jenis: "sidang",
      judul: "Sidang hari ini",
      perkara: perkara(10021, "387/Pdt.G/2026/PA.Dgl"),
      tenggat: hariKe(0),
      kelompok: "hari-ini",
      keterangan: "Ruang 1",
      kerjakan: { tujuan: "aleta", alamat: "/aleta-ecourt?tab=jadwal" },
    },
    {
      id: "h2",
      jenis: "ecourt",
      judul: "Dokumen e-Court belum diunggah",
      perkara: perkara(10022, "388/Pdt.G/2026/PA.Dgl"),
      tenggat: hariKe(0),
      kelompok: "hari-ini",
      keterangan: "",
      kerjakan: { tujuan: "ecourt", alamat: "https://ecourt.mahkamahagung.go.id/perkara/388" },
    },
    {
      id: "h3",
      jenis: "bas",
      judul: "BAS belum diunggah",
      perkara: perkara(10023, "389/Pdt.G/2026/PA.Dgl"),
      tenggat: hariKe(0),
      kelompok: "hari-ini",
      keterangan: "",
      kerjakan: { tujuan: "sipp", halaman: "jadwal-sidang" },
    },
    {
      id: "m1",
      jenis: "phs",
      judul: "PHS mendekati tenggat",
      perkara: perkara(10024, "390/Pdt.G/2026/PA.Dgl"),
      tenggat: hariKe(3),
      kelompok: "minggu-ini",
      keterangan: "",
      kerjakan: { tujuan: "sipp" },
    },
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
      jenisTidakTersedia: [
        { jenis: "panitera-pengganti.akta-cerai", sebab: "tabel akta cerai belum terbaca dari SIPP" },
        { jenis: "hakim.panggilan-tunda", judul: "Panggilan sidang tunda", sebab: "hari libur belum terbaca" },
      ],
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
  // onChanged sampai SESUDAH penulisan dan di putaran berikutnya - seperti Chrome.
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
    remove: async (kunci: string | string[]) => {
      const ubah: Ubah = {};
      for (const k of [kunci].flat()) {
        if (!(k in simpanan)) continue;
        ubah[k] = { oldValue: simpanan[k] };
        delete simpanan[k];
      }
      siarkan(ubah);
    },
  };
  return {
    simpanan,
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
/** Jawaban portal tiruan; melempar = portal tidak terjangkau; janji = jawaban yang tertunda. */
type Jawab = (url: string) => Hasil | Promise<Hasil>;
const jawabBaku: Jawab = () => ({ isi: jawabanContoh() });

type Halaman = {
  dom: JsdomUji;
  w: any;
  simpanan: Record<string, unknown>;
  minta: string[];
  /** SELURUH alamat yang diminta halaman - termasuk "siapa saya" milik panel aleta.js. */
  semua: string[];
  jam: Array<{ ms: number; f: () => void }>;
  setel: (isi: Record<string, unknown>) => Promise<void>;
  hapus: (kunci: string[]) => Promise<void>;
};

/**
 * Jendela yang terbuka, beserta jumlah permintaan portal yang masih di jalan.
 * Jendela yang ditutup di tengah permintaan membuat penggambaran sesudahnya
 * menyentuh document yang sudah tiada - galat milik uji, bukan milik widget.
 */
const terbuka: Array<{ dom: JSDOM; terbang: () => number }> = [];
afterEach(async () => {
  const mulai = Date.now();
  while (terbuka.some((t) => t.terbang() > 0) && Date.now() - mulai < 3000) await tunggu(10);
  await tunggu(10);
  while (terbuka.length) terbuka.pop()!.dom.window.close();
});

/** Jawaban "siapa saya" portal - hanya untuk panel portal sungguhan (aleta.js). */
const SIAPA = {
  ok: true,
  data: {
    nama: "Hakim Uji",
    peran: "Hakim",
    roleId: "hakim",
    peranTambahan: [],
    kapabilitas: {},
    keterangan: {},
    menu: [],
    bolehMengatur: false,
    versiEkstensi: "0.0.0",
    dirilis: "",
    versiTipe: null,
  },
};

function buka(
  p: {
    alamat?: string;
    html?: string;
    simpanan?: Record<string, unknown>;
    jawab?: Jawab;
    /** Skrip halaman yang dimuat di antara panel-alat.js dan checklist.js - urutan manifest. */
    skrip?: string[];
    /**
     * Kode yang dijalankan tepat SESUDAH panel-alat.js, sebelum skrip lain -
     * untuk menukar perkakas bersama dan membuktikan skrip sesudahnya
     * sungguh memakainya, bukan salinannya sendiri.
     */
    awal?: string;
  } = {}
): Halaman {
  const dom = jsdomBaru(`<!doctype html><html><head></head><body>${p.html ?? ""}</body></html>`, {
    url: p.alamat ?? `${ASAL}/SIPP/detil_perkara_agama`,
    runScripts: "outside-only",
    pretendToBeVisual: true,
  });
  let terbang = 0;
  terbuka.push({ dom, terbang: () => terbang });
  const w = dom.window as any;
  const { simpanan, storage } = penyimpananTiruan(p.simpanan ?? {});
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
  const semua: string[] = [];
  w.fetch = (alamat: string) => {
    const url = String(alamat);
    semua.push(url);
    if (url.includes("/ekstensi/siapa")) return Promise.resolve(tanggapan(200, SIAPA));
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
    // Dikurangi SESUDAH rantai janji penggambarannya selesai.
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
  // Pewaktu berulang dicatat supaya putaran lima menit dapat dipanggil tanpa
  // menunggu lima menit.
  const jam: Array<{ ms: number; f: () => void }> = [];
  const setIntervalAsli = w.setInterval.bind(w);
  w.setInterval = (f: () => void, ms: number) => {
    jam.push({ ms, f });
    return setIntervalAsli(f, ms);
  };
  // Tautan ber-target _blank tidak dinavigasikan jsdom; penangan di dalam
  // widget tetap berjalan (fase tangkap di dokumen tidak menghentikannya).
  w.document.addEventListener("click", (e: any) => e.preventDefault(), true);
  const ctx = dom.getInternalVMContext();
  vm.runInContext(SUMBER_ALAT, ctx, { filename: "panel-alat.js" });
  if (p.awal) vm.runInContext(p.awal, ctx, { filename: "awal-uji.js" });
  for (const nama of p.skrip ?? []) {
    vm.runInContext(baca(SALINAN_SKRIP[nama] || path.join(EKSTENSI, nama)), ctx, { filename: nama });
  }
  vm.runInContext(SUMBER_CHECKLIST, ctx, { filename: "checklist.js" });
  return {
    dom,
    w,
    simpanan,
    minta,
    semua,
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
const kerjakan = (h: Halaman, id: string) => q(h, `[data-id="${id}"] .aleta-cm-kerjakan`);

function tekan(h: Halaman, sasaran: any, jenis: string, x: number, y: number) {
  sasaran.dispatchEvent(
    new h.w.MouseEvent(jenis, { bubbles: true, composed: true, cancelable: true, clientX: x, clientY: y, button: 0 })
  );
}

// ============================================================================
describe("saklar: bawaan mati, seketika, tunduk pada induk", () => {
  it("tanpa checklistMilestone tidak ada widget dan tidak ada permintaan ke portal", async () => {
    const h = buka();
    await tunggu(80);
    expect(akarDari(h)).toBeNull();
    expect(h.minta).toEqual([]);
  });

  it("dinyalakan dari popup: widget muncul SEKETIKA, tanpa memuat ulang halaman", async () => {
    const h = buka();
    await tunggu(30);
    expect(akarDari(h)).toBeNull();
    await h.setel({ checklistMilestone: true });
    await sampai(() => akarDari(h), "widget muncul");
    await siap(h);
    expect(h.minta).toEqual([API]);
  });

  it("saklar induk dimatikan: widget hilang; dinyalakan lagi: kembali", async () => {
    const h = buka({ simpanan: NYALA });
    await siap(h);
    await h.setel({ aktif: false });
    await sampai(() => !akarDari(h), "widget hilang");
    await h.setel({ aktif: true });
    await sampai(() => akarDari(h), "widget kembali");
  });

  it("induk mati sejak awal: tidak pernah muncul walau saklarnya menyala", async () => {
    const h = buka({ simpanan: { ...NYALA, aktif: false } });
    await tunggu(80);
    expect(akarDari(h)).toBeNull();
    expect(h.minta).toEqual([]);
  });

  it("halaman cetak SIPP tidak pernah memuatnya - relas adalah dokumen resmi", async () => {
    const h = buka({ simpanan: NYALA, alamat: `${ASAL}/SIPP/c_template_relaas_agama/popup_relaas/QUJD` });
    await tunggu(80);
    expect(akarDari(h)).toBeNull();
    expect(h.minta).toEqual([]);
  });

  it("halaman masuk portal tidak memuatnya", async () => {
    const h = buka({ simpanan: NYALA, alamat: `${ASAL}/aleta/login` });
    await tunggu(80);
    expect(akarDari(h)).toBeNull();
  });

  it("× mematikan saklarnya sendiri, dan kabarnya menyebut jalan pulang lewat popup", async () => {
    const h = buka({ simpanan: NYALA });
    await siap(h);
    q(h, ".aleta-cm-tutup").click();
    await sampai(() => h.simpanan.checklistMilestone === false, "saklar mati");
    expect(akarDari(h)).toBeNull();
    // Saklar induk tidak ikut: panel ALETA tetap di tempatnya.
    expect(h.simpanan.aktif).toBeUndefined();
    const kabar = h.w.document.querySelector("aleta-cm-kabar") as any;
    expect(kabar).not.toBeNull();
    expect(kabar.shadowRoot.querySelector(".aleta-cm-kabar-tutup").textContent).toMatch(/popup ikon ALETA/);
    await h.setel({ checklistMilestone: true });
    await sampai(() => akarDari(h), "widget kembali");
    expect(h.w.document.querySelector("aleta-cm-kabar")).toBeNull();
  });
});

// ============================================================================
describe("terpisah dari panel ALETA", () => {
  const PANEL = {
    sipp: ["aleta-panel-sipp", `${ASAL}/SIPP/detil_perkara_agama`],
    abt: ["aleta-panel-abt", `${ASAL}/aps_badilag/abt/main/view?a=A&b=B&c=10018`],
    portal: ["aleta-panel-portal", `${ASAL}/aleta/aleta-ecourt`],
  } as const;

  for (const [nama, [id, alamat]] of Object.entries(PANEL)) {
    it(`${nama}: akar sendiri di <html>, bukan di dalam panel ALETA - dan panel ALETA tidak berubah`, async () => {
      const html =
        `<div id="${id}" class="aleta-panel" data-tema="gelap" style="top:12px;right:12px">` +
        `<div class="aleta-kepala">ALETA</div><div class="aleta-isi">isi panel</div></div>`;
      const h = buka({ simpanan: NYALA, html, alamat });
      const panel = h.w.document.getElementById(id);
      const sebelum = panel.outerHTML;
      await siap(h);

      const akar = akarDari(h);
      expect(akar.parentElement).toBe(h.w.document.documentElement);
      expect(panel.contains(akar)).toBe(false);
      expect(akar.closest(".aleta-panel")).toBeNull();
      expect(akar.className).toBe("");
      expect(qs(h, "[class*='aleta-panel']")).toEqual([]);

      // Dipakai: dikecilkan, dibentangkan, dilipat, digeser, disegarkan.
      q(h, ".aleta-cm-kecilkan").click();
      (await sampai(() => q(h, ".aleta-cm-pil"), "pil")).click();
      await sampai(() => q(h, ".aleta-cm-kelompok-kepala"), "terbentang");
      q(h, ".aleta-cm-kelompok-kepala").click();
      const judul = await sampai(() => q(h, ".aleta-cm-judul"), "judul");
      tekan(h, judul, "pointerdown", 100, 700);
      tekan(h, judul, "pointermove", 200, 600);
      tekan(h, judul, "pointerup", 200, 600);
      q(h, ".aleta-cm-segar").click();
      await tunggu(40);

      expect(panel.outerHTML).toBe(sebelum);
      expect(h.w.document.querySelectorAll(".aleta-panel").length).toBe(1);
      expect(h.w.document.body.children.length).toBe(1);
    });
  }

  it("portal: panel ALETA SUNGGUHAN (aleta.js) berdampingan dan tidak berubah", async () => {
    const h = buka({ simpanan: NYALA, alamat: `${ASAL}/aleta/aleta-ecourt`, skrip: ["aleta.js"] });
    const panel = await sampai(() => h.w.document.getElementById("aleta-panel-portal"), "panel portal lahir");
    await siap(h);
    await tunggu(150);
    const sebelum = panel.outerHTML;
    // Kontrol: tanpa campur tangan widget, panelnya memang diam - kalau tidak,
    // perbandingan di bawah tidak membuktikan apa pun.
    await tunggu(150);
    expect(panel.outerHTML).toBe(sebelum);

    const akar = akarDari(h);
    expect(panel.contains(akar)).toBe(false);
    expect(akar.parentElement).toBe(h.w.document.documentElement);
    q(h, ".aleta-cm-kecilkan").click();
    (await sampai(() => q(h, ".aleta-cm-pil"), "pil")).click();
    await sampai(() => q(h, ".aleta-cm-judul"), "terbentang");
    const judul = q(h, ".aleta-cm-judul");
    tekan(h, judul, "pointerdown", 100, 700);
    tekan(h, judul, "pointermove", 220, 640);
    tekan(h, judul, "pointerup", 220, 640);
    q(h, ".aleta-cm-segar").click();
    await tunggu(150);
    expect(panel.outerHTML).toBe(sebelum);
    expect(h.w.document.querySelectorAll(".aleta-panel").length).toBe(1);
  });
});

// ============================================================================
describe("isi dari jawaban portal", () => {
  const kelompok = (h: Halaman, k: string) => q(h, `[data-kelompok="${k}"]`);

  it("kelompok, hitungan, kemajuan hari ini, butir, dan kaki", async () => {
    const h = buka({ simpanan: NYALA });
    await siap(h);
    expect(qs(h, "[data-kelompok]").map((x) => x.getAttribute("data-kelompok"))).toEqual([
      "lewat",
      "hari-ini",
      "minggu-ini",
    ]);
    expect(kelompok(h, "lewat").querySelector(".aleta-cm-kelompok-judul").textContent).toMatch(/lewat tenggat/i);
    expect(kelompok(h, "lewat").querySelector(".aleta-cm-hitung").textContent).toBe("2");
    expect(kelompok(h, "lewat").querySelectorAll(".aleta-cm-butir").length).toBe(2);
    expect(kelompok(h, "hari-ini").querySelector(".aleta-cm-hitung").textContent).toBe("3");
    expect(kelompok(h, "hari-ini").querySelectorAll(".aleta-cm-butir").length).toBe(3);
    expect(kelompok(h, "minggu-ini").querySelector(".aleta-cm-hitung").textContent).toBe("1");
    // Minggu ini tertutup bawaan.
    expect(kelompok(h, "minggu-ini").querySelector(".aleta-cm-kelompok-kepala").getAttribute("aria-expanded")).toBe(
      "false"
    );
    expect(kelompok(h, "minggu-ini").querySelectorAll(".aleta-cm-butir").length).toBe(0);

    expect(q(h, ".aleta-cm-kemajuan-teks").textContent).toBe("Hari ini 1 dari 4 selesai");
    expect(q(h, ".aleta-cm-bilah-isi").style.width).toBe("25%");

    const l1 = q(h, '[data-id="l1"]');
    expect(l1.querySelector(".aleta-cm-butir-judul").textContent).toBe("PMH belum ditetapkan");
    expect(l1.querySelector(".aleta-cm-nomor").textContent).toBe("385/Pdt.G/2026/PA.Dgl");
    expect(l1.querySelector(".aleta-cm-butir-ket").textContent).toContain("didaftarkan 20 Sep");
    expect(l1.querySelector(".aleta-cm-butir-ket").textContent).toContain("lewat 2 hari");
    expect(q(h, '[data-id="h3"] .aleta-cm-butir-ket').textContent).toContain("tenggat hari ini");

    const kaki = q(h, ".aleta-cm-kaki").textContent;
    expect(kaki).toContain("butir hilang sendiri saat datanya lengkap");
    expect(kaki).toMatch(/Diperbarui \d{2}\.\d{2}/);
    // Yang tidak dapat dihitung DISEBUT, terlipat - bukan disembunyikan - dan
    // dengan nama yang terbaca, bukan kunci katalog.
    expect(q(h, ".aleta-cm-tidak-tersedia summary").textContent).toBe("2 jenis belum dapat dihitung");
    const tak = q(h, ".aleta-cm-tidak-tersedia");
    expect(tak.open).toBe(false);
    expect(tak.textContent).toContain("Akta cerai - tabel akta cerai belum terbaca dari SIPP");
    expect(tak.textContent).toContain("Panggilan sidang tunda - hari libur belum terbaca");
    expect(tak.textContent).not.toContain("panitera-pengganti.akta-cerai");
    expect(q(h, "select.aleta-cm-peran").value).toBe("hakim");
  });

  it("minggu ini dibuka: butirnya tampil, dan lipatannya diingat halaman berikutnya", async () => {
    const h = buka({ simpanan: NYALA });
    await siap(h);
    kelompok(h, "minggu-ini").querySelector(".aleta-cm-kelompok-kepala").click();
    await sampai(() => q(h, '[data-id="m1"]'), "butir minggu ini tampil");
    await sampai(() => (h.simpanan.lipatanChecklistMilestone as any)?.["minggu-ini"] === true, "lipatan diingat");
    const h2 = buka({ simpanan: { ...NYALA, lipatanChecklistMilestone: h.simpanan.lipatanChecklistMilestone } });
    await siap(h2);
    expect(q(h2, '[data-id="m1"]')).not.toBeNull();
  });

  it("tidak ada yang tertunda: dikatakan, bukan kotak kosong", async () => {
    const h = buka({
      simpanan: NYALA,
      jawab: () => ({
        isi: jawabanContoh({ butir: [], ringkas: { lewat: 0, hariIni: 0, mingguIni: 0, selesaiHariIni: 2, totalHariIni: 2 } }),
      }),
    });
    const kosong = await sampai(() => q(h, ".aleta-cm-kosong"), "keterangan kosong");
    expect(kosong.textContent).toBe("Tidak ada pekerjaan tertunda untuk Hakim.");
    expect(q(h, ".aleta-cm-kemajuan-teks").textContent).toBe("Hari ini 2 dari 2 selesai");
  });

  it("portal memangkas daftar: hitungan penuh tetap, dan selisihnya disebut", async () => {
    const h = buka({
      simpanan: NYALA,
      jawab: () => ({
        isi: jawabanContoh({ ringkas: { lewat: 5, hariIni: 3, mingguIni: 1, selesaiHariIni: 1, totalHariIni: 4 } }),
      }),
    });
    await siap(h);
    expect(kelompok(h, "lewat").querySelector(".aleta-cm-hitung").textContent).toBe("5");
    expect(kelompok(h, "lewat").querySelector(".aleta-cm-sebagian").textContent).toBe("2 ditampilkan");
  });
});

// ============================================================================
describe("Kerjakan: alamat tiap tujuan, dari tiap halaman", () => {
  const RIWAYAT = [
    {
      nomor: "385/Pdt.G/2026/PA.Dgl",
      url: `${ASAL}/SIPP/perkara_detil/ZW5jMzg1`,
      jenis: "Cerai Gugat",
      waktu: "2026-09-26T01:00:00.000Z",
    },
  ];

  it("halaman SIPP server", async () => {
    const h = buka({ simpanan: { ...NYALA, riwayatPerkaraSipp: RIWAYAT } });
    await siap(h);

    // SIPP, perkara yang pernah dibuka: pintu masuk dari riwayat konten.js.
    expect(kerjakan(h, "l1").getAttribute("href")).toBe(RIWAYAT[0].url);
    expect(kerjakan(h, "l1").textContent).toBe("Kerjakan di SIPP");
    expect(kerjakan(h, "l1").title).toContain("tab Penetapan");

    // ABT: beranda dengan perkara terpilih; blangko yang dituju disebut.
    expect(kerjakan(h, "l2").getAttribute("href")).toBe(`${ASAL}/aps_badilag/abt/main/beranda?c=10020`);
    expect(kerjakan(h, "l2").textContent).toBe("Kerjakan di ABT");
    expect(kerjakan(h, "l2").title).toContain("Putusan CG");

    // ALETA: basePath /aleta ditambahkan pada rute Next.js.
    expect(kerjakan(h, "h1").getAttribute("href")).toBe(`${ASAL}/aleta/aleta-ecourt?tab=jadwal`);
    expect(kerjakan(h, "h1").textContent).toBe("Kerjakan di ALETA");

    // e-Court: alamat luar apa adanya.
    expect(kerjakan(h, "h2").getAttribute("href")).toBe("https://ecourt.mahkamahagung.go.id/perkara/388");
    expect(kerjakan(h, "h2").textContent).toBe("Kerjakan di e-Court");

    // SIPP, perkara yang belum pernah terlihat: beranda SIPP - dan itu DISEBUT.
    expect(kerjakan(h, "h3").getAttribute("href")).toBe(`${ASAL}/SIPP/`);
    expect(kerjakan(h, "h3").title).toContain("belum pernah terbuka");

    for (const a of qs(h, "a.aleta-cm-kerjakan")) {
      expect(a.target).toBe("_blank");
      expect(a.rel).toContain("noopener");
    }

    // Tekanan menyebut nomor yang harus dicari.
    kerjakan(h, "h3").click();
    await sampai(
      () => String(q(h, ".aleta-cm-kabar")?.textContent || "").includes("389/Pdt.G/2026/PA.Dgl"),
      "kabar menyebut nomor"
    );
  });

  it("halaman ABT mesin setempat (127.0.0.1:8056, lewat index.php)", async () => {
    const h = buka({
      simpanan: NYALA,
      alamat: "http://127.0.0.1:8056/aps_badilag/index.php/abt/main/view?a=A&b=B&c=10018&d=3",
    });
    await siap(h);
    expect(kerjakan(h, "l2").getAttribute("href")).toBe(
      "http://127.0.0.1:8056/aps_badilag/index.php/abt/main/beranda?c=10020"
    );
    expect(kerjakan(h, "h3").getAttribute("href")).toBe("http://127.0.0.1:8056/index.php/dashboard");
    expect(kerjakan(h, "h1").getAttribute("href")).toBe("http://127.0.0.1:8056/aleta/aleta-ecourt?tab=jadwal");
  });

  it("halaman portal: tautan detil hasil panen dipakai; alamat asing dan tujuan asing mati beserta sebabnya", async () => {
    const tautan = { "389/PDT.G/2026/PA.DGL": { url: `${ASAL}/SIPP/perkara_detil_agama/ZW5jMzg5`, pada: Date.now() } };
    const tambahan = [
      {
        id: "x1",
        jenis: "lain",
        judul: "Alamat asing",
        perkara: null,
        tenggat: null,
        kelompok: "hari-ini",
        keterangan: "",
        kerjakan: { tujuan: "aleta", alamat: "http://jahat.example/aleta/x" },
      },
      {
        id: "x2",
        jenis: "lain",
        judul: "Skema terlarang",
        perkara: null,
        tenggat: null,
        kelompok: "hari-ini",
        keterangan: "",
        kerjakan: { tujuan: "aleta", alamat: "javascript:alert(1)" },
      },
      {
        id: "x3",
        jenis: "lain",
        judul: "Tujuan asing",
        perkara: null,
        tenggat: null,
        kelompok: "hari-ini",
        keterangan: "",
        kerjakan: { tujuan: "constructor" },
      },
      {
        id: "x4",
        jenis: "relaas",
        judul: "Relaas belum dicetak",
        perkara: perkara(10030, "400/Pdt.G/2026/PA.Dgl"),
        tenggat: hariKe(0),
        kelompok: "hari-ini",
        keterangan: "",
        kerjakan: { tujuan: "abt", halaman: "blangko-relaas" },
      },
      {
        id: "x5",
        jenis: "ecourt",
        judul: "e-Court di host asing",
        perkara: perkara(10031, "401/Pdt.G/2026/PA.Dgl"),
        tenggat: hariKe(0),
        kelompok: "hari-ini",
        keterangan: "",
        kerjakan: { tujuan: "ecourt", alamat: "https://ecourt.jahat.example/perkara/401" },
      },
      {
        id: "x6",
        jenis: "ecourt",
        judul: "e-Court tanpa alamat",
        perkara: perkara(10032, "402/Pdt.G/2026/PA.Dgl"),
        tenggat: hariKe(0),
        kelompok: "hari-ini",
        keterangan: "",
        kerjakan: { tujuan: "ecourt" },
      },
    ];
    const h = buka({
      simpanan: { ...NYALA, tautanPerkaraSipp: tautan },
      alamat: `${ASAL}/aleta/aleta-ecourt`,
      jawab: () => ({ isi: jawabanContoh({ butir: [...butirContoh(), ...tambahan] }) }),
    });
    await siap(h);
    expect(kerjakan(h, "h3").getAttribute("href")).toBe(`${ASAL}/SIPP/perkara_detil_agama/ZW5jMzg5`);
    expect(kerjakan(h, "l2").getAttribute("href")).toBe(`${ASAL}/aps_badilag/abt/main/beranda?c=10020`);
    expect(kerjakan(h, "l1").getAttribute("href")).toBe(`${ASAL}/SIPP/`);
    for (const id of ["x1", "x2", "x3", "x5"]) {
      const mati = kerjakan(h, id);
      expect(mati.tagName, id).toBe("SPAN");
      expect(mati.getAttribute("aria-disabled"), id).toBe("true");
      expect(mati.getAttribute("href"), id).toBeNull();
    }
    expect(kerjakan(h, "x1").title).toContain("ditolak");
    expect(kerjakan(h, "x3").title).toContain("belum dikenal");
    expect(kerjakan(h, "x5").title).toContain("ditolak");

    // Kelompok blangko ABT disebut dengan nama yang dicari petugas, bukan kuncinya.
    expect(kerjakan(h, "x4").getAttribute("href")).toBe(`${ASAL}/aps_badilag/abt/main/beranda?c=10030`);
    expect(kerjakan(h, "x4").title).toContain("kelompok blangko Relaas");
    expect(kerjakan(h, "x4").title).not.toContain("blangko-relaas");

    // e-Court tanpa alamat: berandanya, dan nomornya disalin untuk dicari di sana.
    expect(kerjakan(h, "x6").getAttribute("href")).toBe("https://ecourt.mahkamahagung.go.id/");
    expect(kerjakan(h, "x6").title).toContain("402/Pdt.G/2026/PA.Dgl");
    kerjakan(h, "x6").click();
    await sampai(
      () => /402\/Pdt\.G\/2026\/PA\.Dgl[\s\S]*e-Court/.test(String(q(h, ".aleta-cm-kabar")?.textContent || "")),
      "kabar menyebut nomor dan e-Court"
    );
  });

  const DAFTAR =
    "<table>" +
    "<tr><td>1</td><td>389/Pdt.G/2026/PA.Dgl</td><td>Cerai Gugat</td>" +
    '<td align="center">[<a href="/SIPP/perkara_detil_agama/QUJDMzg5">detil</a>]</td></tr>' +
    "<tr><td>2</td><td>391/Pdt.G/2026/PA.Dgl</td><td>Cerai Talak</td>" +
    '<td align="center">[<a href="/SIPP/perkara_detil_agama/QUJDMzkx">detil</a>]</td></tr>' +
    "</table>";

  it("daftar perkara SIPP dipanen: nomor -> tautan detil, lalu dipakai tombolnya", async () => {
    const h = buka({ simpanan: NYALA, alamat: `${ASAL}/SIPP/perkara_list`, html: DAFTAR });
    await siap(h);
    const peta = await sampai(() => h.simpanan.tautanPerkaraSipp as any, "tautan dipanen");
    expect(peta["389/PDT.G/2026/PA.DGL"].url).toBe(`${ASAL}/SIPP/perkara_detil_agama/QUJDMzg5`);
    expect(peta["391/PDT.G/2026/PA.DGL"].url).toBe(`${ASAL}/SIPP/perkara_detil_agama/QUJDMzkx`);
    await sampai(
      () => kerjakan(h, "h3")?.getAttribute("href") === `${ASAL}/SIPP/perkara_detil_agama/QUJDMzg5`,
      "tombol memakai tautan hasil panen"
    );
  });

  it("saklar mati: halaman SIPP tidak dibaca sama sekali", async () => {
    const h = buka({ alamat: `${ASAL}/SIPP/perkara_list`, html: DAFTAR });
    await tunggu(80);
    expect(h.simpanan.tautanPerkaraSipp).toBeUndefined();
  });
});

// ============================================================================
describe("kontrak dengan katalog portal (src/lib/checklist-milestone-katalog.ts)", () => {
  /**
   * Ekstensi dan portal dirilis terpisah, dan ekstensi berjalan dalam
   * beberapa versi sekaligus. Halaman atau tujuan baru di katalog yang tidak
   * dikenal widget akan tampil sebagai tombol mati atau kunci mentah - uji
   * ini yang memerahkannya lebih dulu.
   */
  const TAB_SIPP: Record<string, string> = {
    perkara: "Data Umum",
    penetapan: "Penetapan",
    "jadwal-sidang": "Jadwal Sidang",
    putusan: "Putusan Akhir",
    relaas: "Jadwal Sidang (Cetak Relas)",
    "akta-cerai": "Akta Cerai",
    keuangan: "Biaya Perkara",
    saksi: "Saksi",
  };
  const BLANGKO_ABT: Record<string, string> = {
    "blangko-putusan": "Putusan",
    "blangko-penetapan": "Penetapan",
    "blangko-bas": "BAS",
    "blangko-relaas": "Relaas",
    "blangko-akta": "Akta",
  };

  it("setiap kerjakan yang dapat dipancarkan portal menjadi tombol hidup dengan nama halaman yang terbaca", async () => {
    const bentuk = new Map<string, Record<string, unknown>>();
    for (const j of KATALOG_CHECKLIST) {
      if (j.tersedia) bentuk.set(JSON.stringify(j.kerjakan), j.kerjakan as Record<string, unknown>);
    }
    // Di luar katalog, penyusun memancarkan alamat portal dan alamat dokumen e-Court.
    for (const alamat of Object.values(ALAMAT_ALETA)) bentuk.set(`aleta ${alamat}`, { tujuan: "aleta", alamat });
    bentuk.set("ecourt url", { tujuan: "ecourt", alamat: "https://ecourt.mahkamahagung.go.id/perkara/x" });
    expect(bentuk.size).toBeGreaterThan(5);

    const butir = [...bentuk.values()].map((kerjakan, i) => ({
      id: `k${i}`,
      jenis: "kontrak",
      judul: `Kontrak ${i}`,
      perkara: perkara(20000 + i, `${500 + i}/Pdt.G/2026/PA.Dgl`),
      tenggat: hariKe(0),
      kelompok: "hari-ini",
      keterangan: "",
      kerjakan,
    }));
    const peranTersedia = KUNCI_PERAN.map((kunci) => ({ kunci, label: LABEL_PERAN[kunci] }));
    const h = buka({
      simpanan: NYALA,
      jawab: () => ({
        isi: jawabanContoh({
          butir,
          peranTersedia,
          ringkas: { lewat: 0, hariIni: butir.length, mingguIni: 0, selesaiHariIni: 0, totalHariIni: butir.length },
        }),
      }),
    });
    await siap(h);

    butir.forEach((b, i) => {
      const k = b.kerjakan as { tujuan: string; halaman?: string; alamat?: string };
      const ket = JSON.stringify(k);
      const t = kerjakan(h, `k${i}`);
      expect(t, ket).not.toBeNull();
      expect(t.tagName, `${ket}: tombol mati`).toBe("A");
      expect(t.getAttribute("href"), ket).toBeTruthy();
      if (k.tujuan === "sipp" && k.halaman) {
        expect(TAB_SIPP[k.halaman], `halaman SIPP baru di katalog: ${k.halaman}`).toBeTruthy();
        expect(t.title, ket).toContain(`tab ${TAB_SIPP[k.halaman]}`);
      }
      if (k.tujuan === "abt") {
        expect(BLANGKO_ABT[k.halaman || ""], `blangko ABT baru di katalog: ${k.halaman}`).toBeTruthy();
        expect(t.title, ket).toContain(`kelompok blangko ${BLANGKO_ABT[k.halaman || ""]}`);
        expect(t.getAttribute("href"), ket).toBe(`${ASAL}/aps_badilag/abt/main/beranda?c=${20000 + i}`);
      }
      if (k.tujuan === "aleta") expect(t.getAttribute("href"), ket).toBe(`${ASAL}${k.alamat}`);
    });

    // Tiap kunci peran katalog lolos penyaring widget - yang tertolak akan
    // hilang diam-diam dari pilihan peran.
    const pilihan = Array.from(q(h, "select.aleta-cm-peran").options).map((o: any) => o.value);
    expect(pilihan).toEqual([...KUNCI_PERAN]);
  });
});

// ============================================================================
describe("kecil menjadi pil, dan digeser", () => {
  it("dikecilkan menjadi pil berhitungan, lalu dibentangkan lagi", async () => {
    const h = buka({ simpanan: NYALA });
    await siap(h);
    q(h, ".aleta-cm-kecilkan").click();
    const pil = await sampai(() => q(h, ".aleta-cm-pil"), "pil");
    expect(pil.textContent).toBe("Checklist · 2 lewat · 3 hari ini");
    expect(pil.getAttribute("data-nada")).toBe("lewat");
    expect(q(h, ".aleta-cm")).toBeNull();
    await sampai(() => (h.simpanan.posisiChecklistSipp as any)?.kecil === true, "pil diingat");
    pil.click();
    await sampai(() => q(h, ".aleta-cm"), "terbentang");
    expect(q(h, ".aleta-cm-pil")).toBeNull();
    await sampai(() => (h.simpanan.posisiChecklistSipp as any)?.kecil === false, "bentangan diingat");
  });

  it("pil tetap pil di halaman berikutnya", async () => {
    const h = buka({ simpanan: { ...NYALA, posisiChecklistSipp: { kecil: true } } });
    const pil = await sampai(
      () => (q(h, ".aleta-cm-pil")?.textContent === "Checklist · 2 lewat · 3 hari ini" ? q(h, ".aleta-cm-pil") : null),
      "pil berhitungan"
    );
    expect(pil).not.toBeNull();
    expect(q(h, ".aleta-cm")).toBeNull();
  });

  it("digeser dari kepala: tersimpan per aplikasi; tombol tidak ikut menggeser; popup mengembalikannya", async () => {
    const h = buka({ simpanan: NYALA });
    await siap(h);
    const akar = akarDari(h);
    expect([akar.style.left, akar.style.bottom]).toEqual(["12px", "12px"]);

    const judul = q(h, ".aleta-cm-judul");
    tekan(h, judul, "pointerdown", 100, 700);
    tekan(h, judul, "pointermove", 130, 650);
    tekan(h, judul, "pointermove", 160, 600);
    tekan(h, judul, "pointerup", 160, 600);
    expect([akar.style.left, akar.style.bottom]).toEqual(["72px", "112px"]);
    await sampai(() => h.simpanan.posisiChecklistSipp, "posisi tersimpan");
    expect(h.simpanan.posisiChecklistSipp).toEqual({ kecil: false, kiri: 72, bawah: 112 });
    expect(h.simpanan.posisiChecklistAbt).toBeUndefined();
    expect(h.simpanan.posisiChecklistAleta).toBeUndefined();

    const segar = q(h, ".aleta-cm-segar");
    tekan(h, segar, "pointerdown", 160, 600);
    tekan(h, segar, "pointermove", 400, 300);
    tekan(h, segar, "pointerup", 400, 300);
    expect([akar.style.left, akar.style.bottom]).toEqual(["72px", "112px"]);

    // "Kembalikan posisi panel" di popup menghapus kuncinya.
    await h.hapus(["posisiChecklistSipp"]);
    await sampai(() => akar.style.left === "12px" && akar.style.bottom === "12px", "kembali ke kiri bawah");
  });

  it("pil yang digeser tidak ikut terbentang", async () => {
    const h = buka({ simpanan: { ...NYALA, posisiChecklistSipp: { kecil: true } } });
    const pil = await sampai(() => q(h, ".aleta-cm-pil"), "pil");
    tekan(h, pil, "pointerdown", 50, 750);
    tekan(h, pil, "pointermove", 90, 700);
    tekan(h, pil, "pointerup", 90, 700);
    pil.click();
    await tunggu(30);
    expect(q(h, ".aleta-cm-pil")).not.toBeNull();
    expect(q(h, ".aleta-cm")).toBeNull();
    expect(h.simpanan.posisiChecklistSipp).toEqual({ kecil: true, kiri: 52, bawah: 62 });
  });

  it("posisi tersimpan dipulihkan saat dimuat - dijepit ke layar", async () => {
    const h = buka({ simpanan: { ...NYALA, posisiChecklistAbt: { kiri: 5000, bawah: 90, kecil: false } }, alamat: `${ASAL}/aps_badilag/abt/main/beranda` });
    await siap(h);
    const akar = akarDari(h);
    expect(akar.style.bottom).toBe("90px");
    expect(parseFloat(akar.style.left)).toBeLessThan(h.w.innerWidth);
    expect(parseFloat(akar.style.left)).toBeGreaterThan(h.w.innerWidth - 100);
  });
});

// ============================================================================
describe("kabar jujur", () => {
  it("401: 'Masuk ke portal ALETA dulu', dengan jalan ke portal", async () => {
    const h = buka({
      simpanan: NYALA,
      jawab: () => ({ status: 401, isi: { ok: false, error: { message: "Anda belum login." } } }),
    });
    const kabar = await sampai(() => q(h, '[data-galat="masuk"]'), "kabar masuk");
    expect(kabar.textContent).toContain("Masuk ke portal ALETA dulu");
    expect(kabar.querySelector("a").getAttribute("href")).toBe(`${ASAL}/aleta`);
    expect(q(h, ".aleta-cm-kelompok")).toBeNull();
    q(h, ".aleta-cm-kecilkan").click();
    expect((await sampai(() => q(h, ".aleta-cm-pil"), "pil")).textContent).toBe("Checklist · belum masuk ALETA");
  });

  it("portal mati: disebut dengan kalimat, bukan 'Failed to fetch' mentah", async () => {
    const h = buka({
      simpanan: NYALA,
      jawab: () => {
        throw new TypeError("Failed to fetch");
      },
    });
    const kabar = await sampai(() => q(h, '[data-galat="jaringan"]'), "kabar jaringan", 5000);
    expect(kabar.textContent).toContain("Portal ALETA tidak menjawab");
    expect(kabar.textContent).toContain("tidak terjangkau");
    expect(kabar.textContent).not.toContain("Failed to fetch");
  });

  it("portal mati SESUDAH pernah menjawab: butir lama tetap, dengan tanda belum diperbarui", async () => {
    let mati = false;
    const h = buka({
      simpanan: NYALA,
      jawab: () => {
        if (mati) throw new TypeError("Failed to fetch");
        return { isi: jawabanContoh() };
      },
    });
    await siap(h);
    mati = true;
    q(h, ".aleta-cm-segar").click();
    const kabar = await sampai(() => q(h, '[data-galat="jaringan"]'), "kabar", 5000);
    expect(kabar.textContent).toContain("belum diperbarui");
    expect(qs(h, ".aleta-cm-butir").length).toBe(5);
  });

  it("rute belum ada di portal (404): disebut perlu pembaruan portal", async () => {
    const h = buka({ simpanan: NYALA, jawab: () => ({ status: 404, isi: { ok: false } }) });
    const kabar = await sampai(() => q(h, '[data-galat="tidak-ada"]'), "kabar 404");
    expect(kabar.textContent).toContain("belum mengenal checklist");
  });

  it("500: angka dan pesannya disebut", async () => {
    const h = buka({
      simpanan: NYALA,
      jawab: () => ({ status: 500, isi: { ok: false, error: { message: "Basis data SIPP tidak terjangkau." } } }),
    });
    const kabar = await sampai(() => q(h, '[data-galat="jawaban"]'), "kabar 500", 5000);
    expect(kabar.textContent).toContain("ALETA menjawab 500");
    expect(kabar.textContent).toContain("Basis data SIPP tidak terjangkau.");
  });
});

// ============================================================================
describe("peran", () => {
  it("ganti peran memanggil ?peran=, diingat, dan dipakai halaman berikutnya", async () => {
    const jawab: Jawab = (url) => ({
      isi: jawabanContoh({ peranAktif: url.includes("peran=ketua") ? "ketua" : "hakim" }),
    });
    const h = buka({ simpanan: NYALA, jawab });
    await siap(h);
    expect(h.minta).toEqual([API]);
    const pilih = q(h, "select.aleta-cm-peran");
    pilih.value = "ketua";
    pilih.dispatchEvent(new h.w.Event("change", { bubbles: true }));
    await sampai(() => h.minta.length === 2, "permintaan kedua");
    expect(h.minta[1]).toBe(`${API}?peran=ketua`);
    await sampai(() => h.simpanan.peranChecklistMilestone === "ketua", "peran diingat");
    await sampai(() => q(h, "select.aleta-cm-peran")?.value === "ketua", "chip mengikuti");

    const h2 = buka({ simpanan: { ...NYALA, peranChecklistMilestone: "ketua" }, jawab });
    await sampai(() => h2.minta.length === 1, "permintaan halaman berikutnya");
    expect(h2.minta[0]).toBe(`${API}?peran=ketua`);
  });

  it("jawaban lama yang tiba belakangan tidak menimpa checklist peran yang baru dipilih", async () => {
    let ke = 0;
    const satu = (id: string, judul: string) => [{ ...butirContoh()[0], id, judul }];
    const jawab: Jawab = async (url) => {
      ke += 1;
      if (ke === 2) {
        await tunggu(250);
        return { isi: jawabanContoh({ butir: satu("basi", "JAWABAN BASI") }) };
      }
      if (url.includes("peran=ketua")) {
        return { isi: jawabanContoh({ peranAktif: "ketua", butir: satu("baru", "JAWABAN BARU") }) };
      }
      return { isi: jawabanContoh() };
    };
    const h = buka({ simpanan: NYALA, jawab });
    await siap(h);
    q(h, ".aleta-cm-segar").click();
    await sampai(() => h.minta.length === 2, "permintaan lambat berangkat");
    const pilih = q(h, "select.aleta-cm-peran");
    pilih.value = "ketua";
    pilih.dispatchEvent(new h.w.Event("change", { bubbles: true }));
    await sampai(() => q(h, '[data-id="baru"]'), "jawaban peran baru tergambar");
    await tunggu(350);
    // Digambar ulang dari keadaan yang tersimpan: jawaban basi yang diam-diam
    // menimpa datanya baru tampak pada penggambaran BERIKUTNYA, bukan saat ia
    // tiba.
    q(h, ".aleta-cm-kecilkan").click();
    (await sampai(() => q(h, ".aleta-cm-pil"), "pil")).click();
    await sampai(() => q(h, ".aleta-cm-kelompok"), "terbentang lagi");
    expect(q(h, '[data-id="basi"]')).toBeNull();
    expect(q(h, '[data-id="baru"]')).not.toBeNull();
    expect(q(h, "select.aleta-cm-peran").value).toBe("ketua");
  });

  it("satu peran saja: chip diam, bukan pilihan", async () => {
    const h = buka({
      simpanan: NYALA,
      jawab: () => ({ isi: jawabanContoh({ peranTersedia: [{ kunci: "jurusita", label: "Jurusita" }], peranAktif: "jurusita" }) }),
    });
    await siap(h);
    expect(q(h, "select.aleta-cm-peran")).toBeNull();
    expect(q(h, "span.aleta-cm-peran").textContent).toBe("Jurusita");
  });
});

// ============================================================================
describe("penyegaran", () => {
  it("tiap lima menit, dan saat jendela kembali fokus - tidak berulang dalam setengah menit", async () => {
    const h = buka({ simpanan: NYALA });
    await siap(h);
    expect(h.minta.length).toBe(1);
    const berkala = h.jam.find((j) => j.ms === LIMA_MENIT);
    expect(berkala, "putaran lima menit").toBeTruthy();
    berkala!.f();
    await sampai(() => h.minta.length === 2, "putaran lima menit meminta");
    // Ditunggu sampai SELESAI: alatAmbil menyatukan GET yang masih terbang,
    // jadi fokus di tengah permintaan tidak pernah melahirkan permintaan kedua
    // - dengan atau tanpa jeda - dan uji ini tidak akan membuktikan apa pun.
    await sampai(() => q(h, ".aleta-cm")?.getAttribute("aria-busy") === "false", "putaran selesai digambar");
    await tunggu(20);

    h.w.dispatchEvent(new h.w.Event("focus"));
    await tunggu(60);
    expect(h.minta.length).toBe(2);

    const kini = Date.now();
    h.w.Date.now = () => kini + 31_000;
    h.w.dispatchEvent(new h.w.Event("focus"));
    await sampai(() => h.minta.length === 3, "fokus kembali meminta");
  });

  it("tab di belakang tidak meminta; yang tertunda ditebus saat tabnya kembali dilihat", async () => {
    const h = buka({ simpanan: NYALA });
    await siap(h);
    let tampak = "hidden";
    Object.defineProperty(h.w.document, "visibilityState", { configurable: true, get: () => tampak });
    h.jam.find((j) => j.ms === LIMA_MENIT)!.f();
    await tunggu(60);
    expect(h.minta.length).toBe(1);
    tampak = "visible";
    h.w.document.dispatchEvent(new h.w.Event("visibilitychange"));
    await sampai(() => h.minta.length === 2, "ditebus saat terlihat");
  });

  it("widget dimatikan: putaran berhenti, tidak ada permintaan lagi", async () => {
    const h = buka({ simpanan: NYALA });
    await siap(h);
    const berkala = h.jam.find((j) => j.ms === LIMA_MENIT)!;
    await h.setel({ checklistMilestone: false });
    await sampai(() => !akarDari(h), "hilang");
    berkala.f();
    h.w.Date.now = () => Date.now() + 60_000;
    h.w.dispatchEvent(new h.w.Event("focus"));
    await tunggu(60);
    expect(h.minta.length).toBe(1);
  });
});

// ============================================================================
describe("tema mengikuti panel ekstensi", () => {
  it("temaPanel dan warnaGelap dipasang, dan ikut seketika", async () => {
    const h = buka({ simpanan: { ...NYALA, temaPanel: "terang" } });
    await siap(h);
    const akar = akarDari(h);
    expect(akar.getAttribute("data-tema")).toBe("terang");
    expect(akar.hasAttribute("data-warna")).toBe(false);
    await h.setel({ temaPanel: "gelap", warnaGelap: "arang" });
    await sampai(
      () => akar.getAttribute("data-tema") === "gelap" && akar.getAttribute("data-warna") === "arang",
      "tema dan warna ikut"
    );
    await h.setel({ warnaGelap: "bukan-warna" });
    await sampai(() => !akar.hasAttribute("data-warna"), "warna asing dibuang");
  });

  it("paletnya sama dengan panel.css - bawaan gelap, terang, dan enam warna", () => {
    const css = baca(path.join(EKSTENSI, "panel.css")).replace(/\/\*[\s\S]*?\*\//g, "");
    const token = (mentah: string, pemilih: string) => {
      // Sisipan template literal (${Z_WIDGET}) memuat "}" yang akan memotong blok.
      const teks = mentah.replace(/\$\{[^}]*\}/g, "0");
      const i = teks.indexOf(`${pemilih} {`);
      if (i < 0) throw new Error(`blok ${pemilih} tidak ada`);
      const blok = teks.slice(i, teks.indexOf("}", i));
      const peta: Record<string, string> = {};
      for (const m of blok.matchAll(/--aleta-([a-z-]+):\s*(#[0-9a-fA-F]{3,8})\s*;/g)) peta[m[1]] = m[2].toLowerCase();
      return peta;
    };
    const pasangan: Array<[string, string]> = [
      [".aleta-panel", ":host"],
      ['.aleta-panel[data-tema="terang"]', ':host([data-tema="terang"])'],
      ...["arang", "neon", "hangat", "pastel", "permata", "vibran"].map(
        (w): [string, string] => [
          `.aleta-panel[data-warna="${w}"]:not([data-tema="terang"])`,
          `:host([data-warna="${w}"]:not([data-tema="terang"]))`,
        ]
      ),
    ];
    for (const [diCss, diJs] of pasangan) {
      const harap = token(css, diCss);
      expect(Object.keys(harap).length, diCss).toBeGreaterThanOrEqual(8);
      expect(token(SUMBER_CHECKLIST, diJs), diCss).toEqual(harap);
    }
  });
});

// ============================================================================
describe("popup: saklarnya", () => {
  function bukaPopup(awal: Record<string, unknown> = {}) {
    const html = baca(BERKAS_POPUP_HTML).replace(/<script[\s\S]*?<\/script>/g, "");
    const dom = jsdomBaru(html, { url: "http://localhost/popup.html", runScripts: "outside-only" });
    terbuka.push({ dom, terbang: () => 0 });
    const w = dom.window as any;
    const { simpanan, storage } = penyimpananTiruan(awal);
    w.chrome = {
      runtime: { id: "aleta-uji", getManifest: () => ({ version: "1.169.0" }), sendMessage: async () => ({}) },
      storage,
    };
    w.fetch = async () => {
      throw new TypeError("Failed to fetch");
    };
    vm.runInContext(baca(BERKAS_POPUP_JS), dom.getInternalVMContext(), { filename: "popup.js" });
    return { w, simpanan, setel: (isi: Record<string, unknown>) => storage.local.set(isi) };
  }

  it("ada, bergaya .saklar, dan TIDAK tercentang di markupnya", () => {
    const dom = jsdomBaru(baca(BERKAS_POPUP_HTML));
    terbuka.push({ dom, terbang: () => 0 });
    const kotak = dom.window.document.getElementById("checklistMilestone") as HTMLInputElement | null;
    expect(kotak).not.toBeNull();
    expect(kotak!.type).toBe("checkbox");
    expect(kotak!.hasAttribute("checked")).toBe(false);
    const label = kotak!.closest("label.saklar");
    expect(label).not.toBeNull();
    expect(label!.querySelector(".saklar-nama")!.textContent).toBe("Checklist milestone");
    expect(label!.querySelector(".saklar-ket")!.textContent).toMatch(/kiri bawah/);
    expect(label!.querySelector(".saklar-ket")!.textContent).toMatch(/Kerjakan/);
  });

  it("bawaan mati saat penyimpanan kosong; tercentang bila tersimpan menyala", async () => {
    const a = bukaPopup({});
    await tunggu(40);
    expect(a.w.document.getElementById("checklistMilestone").checked).toBe(false);
    const b = bukaPopup({ checklistMilestone: true });
    await sampai(() => b.w.document.getElementById("checklistMilestone").checked, "tercentang");
  });

  it("dicentang: tersimpan; × di widget melepas centangnya seketika", async () => {
    const p = bukaPopup({});
    await tunggu(40);
    const kotak = p.w.document.getElementById("checklistMilestone");
    kotak.checked = true;
    kotak.dispatchEvent(new p.w.Event("change", { bubbles: true }));
    await sampai(() => p.simpanan.checklistMilestone === true, "tersimpan");
    await p.setel({ checklistMilestone: false });
    await sampai(() => kotak.checked === false, "centang lepas");
  });

  it("Kembalikan posisi panel ikut mengembalikan widget di ketiga aplikasi, dan tidak lebih", async () => {
    const p = bukaPopup({
      posisiChecklistSipp: { kiri: 50, bawah: 60, kecil: true },
      posisiChecklistAbt: { kecil: true },
      posisiChecklistAleta: { kiri: 1, bawah: 2, kecil: false },
      checklistMilestone: true,
      peranChecklistMilestone: "ketua",
      temaPanel: "terang",
    });
    await tunggu(40);
    p.w.document.getElementById("resetPosisi").click();
    await sampai(
      () =>
        !("posisiChecklistSipp" in p.simpanan) &&
        !("posisiChecklistAbt" in p.simpanan) &&
        !("posisiChecklistAleta" in p.simpanan),
      "posisi widget terhapus"
    );
    expect(p.simpanan.checklistMilestone).toBe(true);
    expect(p.simpanan.peranChecklistMilestone).toBe("ketua");
    expect(p.simpanan.temaPanel).toBe("terang");
  });
});

// ============================================================================
describe("manifest", () => {
  it("checklist.js dimuat di SIPP, ABT, dan portal - sesudah panel-alat.js, sekali", () => {
    const m = JSON.parse(baca(BERKAS_MANIFEST));
    const kelompok = m.content_scripts as Array<{ matches: string[]; js?: string[]; world?: string; run_at?: string }>;
    for (const pola of [
      "http://192.168.10.10/SIPP/*",
      "http://127.0.0.1/index.php/*",
      "http://192.168.10.10/aps_badilag/*",
      "http://127.0.0.1/aps_badilag/*",
      "http://192.168.10.10/aleta/*",
      "http://127.0.0.1/aleta/*",
    ]) {
      const entri = kelompok.find((c) => (c.js || []).includes("panel-alat.js") && c.matches.includes(pola));
      expect(entri, pola).toBeTruthy();
      const js = entri!.js || [];
      expect(js.filter((x) => x === "checklist.js").length, pola).toBe(1);
      expect(js.indexOf("checklist.js"), pola).toBeGreaterThan(js.indexOf("panel-alat.js"));
    }
    // Bukan di dunia halaman (jembatan) dan bukan pada document_start.
    const berisi = kelompok.filter((c) => (c.js || []).includes("checklist.js"));
    expect(berisi.length).toBe(3);
    for (const c of berisi) {
      expect(c.world).toBeUndefined();
      expect(c.run_at).toBe("document_idle");
    }
  });
});

// ============================================================================
describe("lingkup bersama skrip konten", () => {
  it("tidak ada nama puncak: seluruh isi satu fungsi", () => {
    const tanpaKomentar = SUMBER_CHECKLIST.replace(/\/\*[\s\S]*?\*\//g, "");
    const puncak = tanpaKomentar
      .split("\n")
      .filter((b) => b.trim() !== "" && !/^\s/.test(b) && !b.startsWith("//"));
    expect(puncak).toEqual(['"use strict";', "(function checklistMilestone() {", "})();"]);
  });

  it("dimuat dua kali di satu halaman: tidak meledak, dan widgetnya tetap satu", async () => {
    const h = buka({ simpanan: NYALA });
    await siap(h);
    expect(() =>
      vm.runInContext(SUMBER_CHECKLIST, h.dom.getInternalVMContext(), { filename: "checklist.js" })
    ).not.toThrow();
    await tunggu(60);
    expect(h.w.document.querySelectorAll("aleta-cm-widget").length).toBe(1);
    expect(h.minta.length).toBe(1);
  });

  it("daftar halaman cetak dan pola nomornya sama dengan milik konten.js", () => {
    const konten = baca(path.join(EKSTENSI, "konten.js"));
    const cetak = (teks: string) => {
      const m = /const POLA_HALAMAN_CETAK = \[([\s\S]*?)\];/.exec(teks);
      return m ? [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]) : null;
    };
    expect(cetak(SUMBER_CHECKLIST)).toEqual(cetak(konten));
    expect(cetak(SUMBER_CHECKLIST)!.length).toBeGreaterThan(5);

    const polaKonten = /const POLA_PERKARA = \/(.*)\/g;/.exec(konten);
    const polaKu = /const SUMBER_POLA_NOMOR =\s*"((?:[^"\\]|\\.)*)"/.exec(SUMBER_CHECKLIST);
    expect(polaKonten && polaKu).toBeTruthy();
    expect(new RegExp(JSON.parse(`"${polaKu![1]}"`)).source).toBe(new RegExp(polaKonten![1]).source);
  });
});

// ============================================================================
describe("tidak pernah ikut tercetak - dua lapisan", () => {
  /**
   * Akar widget dan kabar tutupnya duduk di <html>, bukan di <body>: aturan
   * cetak halaman portal ("body > *:not(#lembar) { display: none }" di relaas
   * massal, cetak jadwal, status perkara, riwayat bot; "body * { visibility:
   * hidden }" di tiket antrian) tidak menjangkaunya. Dua lapisan, dengan
   * alasan yang sama dengan panel ALETA di panel.css: aturan cetak di dalam
   * bayangannya sendiri, dan pemilihnya di blok cetak panel.css.
   */
  function disembunyikanSaatCetak(inang: any) {
    const d = inang.ownerDocument;
    for (const gaya of Array.from(inang.shadowRoot.querySelectorAll("style")) as any[]) {
      // jsdom tidak mengurai <style> di dalam bayangan (sheet-nya null); teksnya
      // diurai pengurai yang sama lewat salinan sementara di <head>.
      const salinan = d.createElement("style");
      salinan.textContent = gaya.textContent;
      d.head.appendChild(salinan);
      try {
        for (const aturan of Array.from(salinan.sheet?.cssRules ?? []) as any[]) {
          if (!aturan.media || !/\bprint\b/.test(String(aturan.media.mediaText))) continue;
          for (const dalam of Array.from(aturan.cssRules ?? []) as any[]) {
            if (
              dalam.selectorText === ":host" &&
              dalam.style.getPropertyValue("display") === "none" &&
              dalam.style.getPropertyPriority("display") === "important"
            ) {
              return true;
            }
          }
        }
      } finally {
        salinan.remove();
      }
    }
    return false;
  }

  /** Pemilih aturan pertama blok @media print panel.css yang cocok dengan inangnya. */
  function cocokBlokCetakPanelCss(inang: any) {
    const css = baca(BERKAS_PANEL_CSS).replace(/\/\*[\s\S]*?\*\//g, "");
    const i = css.indexOf("@media print");
    expect(i, "blok cetak panel.css").toBeGreaterThanOrEqual(0);
    const awal = css.indexOf("{", i) + 1;
    return css
      .slice(awal, css.indexOf("{", awal))
      .split(",")
      .map((s) => s.trim())
      .filter((p) => {
        try {
          return p !== "" && inang.matches(p);
        } catch {
          return false;
        }
      });
  }

  it("widget: aturan cetak di bayangannya sendiri, dan pemilihnya di blok cetak panel.css", async () => {
    const h = buka({ simpanan: NYALA, alamat: `${ASAL}/aleta/aleta-ecourt` });
    await siap(h);
    const akar = akarDari(h);
    expect(akar.parentElement.tagName).toBe("HTML");
    expect(akar.matches("body > *, body *")).toBe(false);
    expect(disembunyikanSaatCetak(akar)).toBe(true);
    expect(cocokBlokCetakPanelCss(akar)).not.toEqual([]);
  });

  it("kabar sesudah ×: sama", async () => {
    const h = buka({ simpanan: NYALA });
    await siap(h);
    q(h, ".aleta-cm-tutup").click();
    const kabar = await sampai(() => h.w.document.querySelector("aleta-cm-kabar") as any, "kabar tutup");
    expect(disembunyikanSaatCetak(kabar)).toBe(true);
    expect(cocokBlokCetakPanelCss(kabar)).not.toEqual([]);
  });
});

// ============================================================================
describe("layar yang menghadap masyarakat", () => {
  /**
   * Widget memuat nomor perkara dan pekerjaan tertunda petugas. Televisi ruang
   * tunggu, layar sentuh ambil antrian, papan pintu ruang sidang, dan tautan
   * tanpa login dibuka di peramban yang sama dengan ekstensi petugas - di sana
   * widget membeberkan isinya ke ruang tunggu.
   *
   * Panel ALETA (aleta.js) sama bocornya: nama petugas, pintasan jabatannya,
   * dan jalan kembali ke perkara yang baru dibukanya di SIPP. Sampai ekstensi
   * 1.171.0 panel itu hanya mengecualikan halaman masuk dan verifikasi
   * dokumen, sehingga tetap tergambar di televisi ruang tunggu. Kini keduanya
   * bertanya ke SATU daftar - alatHalamanPublikPortal di panel-alat.js - dan
   * blok ini menjaga keduanya sekaligus.
   */
  const APP = path.resolve(process.cwd(), "src/app");
  /** Rute tingkat atas di luar (portal) yang memuat halaman publik. */
  const PUBLIK = ["antrian", "antrian-layar", "antrian-tampil", "antrian-ruang", "sidang-ruang", "public", "judicia"];
  /** Rute tingkat atas lain: halaman kerja petugas, halaman masuk, atau bukan halaman. */
  const BUKAN_PUBLIK = ["(portal)", "api", "login", "pdf-viewer", "setup"];
  /** Satu alamat nyata untuk tiap rute publik, ditambah verifikasi dokumen. */
  const ALAMAT_PUBLIK = [
    "/aleta/antrian",
    "/aleta/antrian-layar",
    "/aleta/antrian-tampil?ruang=1",
    "/aleta/antrian-ruang",
    "/aleta/sidang-ruang",
    "/aleta/public/e-kepegawaian",
    "/aleta/public/e-kepegawaian/cuti",
    "/aleta/judicia/legal-form/verify/abc123",
    "/aleta/verifikasi-dokumen",
  ];
  const panelPortal = (h: Halaman) => h.w.document.getElementById("aleta-panel-portal");

  it("tiap rute tingkat atas portal sudah digolongkan publik atau bukan", () => {
    const rute = readdirSync(APP, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
    expect(rute.length).toBeGreaterThan(5);
    expect(
      rute.filter((r) => !PUBLIK.includes(r) && !BUKAN_PUBLIK.includes(r)),
      "rute baru di src/app - golongkan; bila publik, tambahkan ke ALAT_POLA_HALAMAN_PUBLIK di panel-alat.js"
    ).toEqual([]);
  });

  it("layar publik: tidak ada widget dan tidak ada permintaan", async () => {
    const alamat = ALAMAT_PUBLIK;
    for (const r of PUBLIK) expect(alamat.some((a) => a.startsWith(`/aleta/${r}`)), `rute publik ${r} tidak diuji`).toBe(true);
    const halaman = alamat.map((a) => [a, buka({ simpanan: NYALA, alamat: `${ASAL}${a}` })] as const);
    await tunggu(120);
    for (const [a, h] of halaman) {
      // Boolean, bukan simpulnya: pencetak galat vitest tersandung elemen bayangan jsdom.
      expect(Boolean(akarDari(h)), `widget di ${a}`).toBe(false);
      expect(h.minta, a).toEqual([]);
    }
  });

  it("halaman petugas yang namanya mirip tetap memuatnya", async () => {
    for (const a of ["/aleta/aleta-antrian", "/aleta/aleta-antrian/panggil"]) {
      const h = buka({ simpanan: NYALA, alamat: `${ASAL}${a}` });
      await siap(h);
      expect(akarDari(h), a).not.toBeNull();
    }
  });

  it("portal berpindah ke layar publik tanpa memuat ulang: widget dilepas", async () => {
    const h = buka({ simpanan: NYALA, alamat: `${ASAL}/aleta/aleta-antrian` });
    await siap(h);
    const jaga = h.jam.find((j) => j.ms === 1000);
    expect(jaga, "penjaga perpindahan halaman portal").toBeTruthy();
    h.w.history.pushState({}, "", "/aleta/antrian-layar");
    jaga!.f();
    await sampai(() => !akarDari(h), "widget dilepas");
  });

  it("layar publik: panel ALETA SUNGGUHAN (aleta.js) pun tidak lahir, dan tidak bertanya 'siapa saya'", async () => {
    // Pertanyaan "siapa saya" itu sendiri sudah membawa kuki petugas ke rute
    // yang menjawab nama dan jabatannya - di layar publik ia tidak boleh
    // diajukan sama sekali, bukan hanya jawabannya yang tidak digambar.
    const halaman = ALAMAT_PUBLIK.map(
      (a) => [a, buka({ simpanan: NYALA, alamat: `${ASAL}${a}`, skrip: ["aleta.js"] })] as const
    );
    await tunggu(200);
    for (const [a, h] of halaman) {
      expect(Boolean(panelPortal(h)), `panel ALETA di ${a}`).toBe(false);
      expect(
        h.semua.filter((u) => u.includes("/ekstensi/siapa")),
        `permintaan "siapa saya" di ${a}`
      ).toEqual([]);
      expect(Boolean(akarDari(h)), `widget di ${a}`).toBe(false);
    }
  });

  it("halaman petugas yang namanya mirip: panel ALETA tetap lahir", async () => {
    // /aleta/aleta-antrian adalah meja petugas antrian, bukan layar ruang
    // tunggu. Pola yang mencocokkan awalan kata, bukan segmen utuh, akan
    // menghilangkan panel dari pekerjaan sehari-hari mereka.
    for (const a of ["/aleta/aleta-antrian", "/aleta/aleta-antrian/panggil", "/aleta/aleta-ecourt"]) {
      const h = buka({ simpanan: NYALA, alamat: `${ASAL}${a}`, skrip: ["aleta.js"] });
      await sampai(() => panelPortal(h), `panel ALETA di ${a}`);
    }
  });

  it("portal berpindah ke layar publik tanpa memuat ulang: panel ALETA dilepas", async () => {
    const h = buka({ simpanan: NYALA, alamat: `${ASAL}/aleta/aleta-antrian`, skrip: ["aleta.js"] });
    await sampai(() => panelPortal(h), "panel ALETA lahir");
    const jaga = h.jam.find((j) => j.ms === 800);
    expect(jaga, "penjaga perpindahan halaman aleta.js").toBeTruthy();
    h.w.history.pushState({}, "", "/aleta/antrian-layar");
    jaga!.f();
    await sampai(() => !panelPortal(h), "panel ALETA dilepas");
  });

  it("satu sumber: panel dan widget sama-sama bertanya ke alatHalamanPublikPortal (panel-alat.js)", async () => {
    // Perkakas bersama ditukar dengan yang menganggap halaman PETUGAS ini
    // publik. Skrip yang masih menyimpan daftarnya sendiri tetap menggambar
    // di sini - dan itulah yang ditangkap: daftar kedua yang diam-diam
    // tertinggal saat rute publik baru ditambahkan ke yang pertama.
    const h = buka({
      simpanan: NYALA,
      alamat: `${ASAL}/aleta/aleta-antrian`,
      skrip: ["aleta.js"],
      awal:
        "alatHalamanPublikPortal = function (jalur) {\n" +
        "  return /aleta-antrian/.test(String(jalur === undefined ? location.pathname : jalur));\n" +
        "};",
    });
    await tunggu(200);
    expect(Boolean(panelPortal(h)), "panel ALETA").toBe(false);
    expect(Boolean(akarDari(h)), "widget").toBe(false);
    expect(h.semua.filter((u) => u.includes("/ekstensi/siapa")), "siapa saya").toEqual([]);

    // Kontrol: tanpa penukaran, halaman yang sama memuat keduanya - kalau
    // tidak, dua pemeriksaan di atas tidak membuktikan apa pun.
    const kontrol = buka({ simpanan: NYALA, alamat: `${ASAL}/aleta/aleta-antrian`, skrip: ["aleta.js"] });
    await sampai(() => panelPortal(kontrol), "panel ALETA kontrol");
    await siap(kontrol);
  });
});

// ============================================================================
describe("teks portal digambar sebagai teks", () => {
  const JAHAT = '<img src=x onerror="window.__xss=1"><script>window.__xss=2</script><b>tebal</b>';

  function markupJahat(h: Halaman) {
    const sr = akarDari(h).shadowRoot;
    const img = Array.from(sr.querySelectorAll("img")).filter((i: any) => !i.classList.contains("aleta-cm-ikon"));
    return { script: sr.querySelectorAll("script").length, img: img.length, b: sr.querySelectorAll("b").length };
  }

  it("judul, keterangan, nomor, jenis, sebab, galat, label peran, dan nama", async () => {
    const h = buka({
      simpanan: { ...NYALA, lipatanChecklistMilestone: { lewat: true } },
      jawab: () => ({
        isi: jawabanContoh({
          pengguna: { nama: JAHAT },
          peranTersedia: [
            { kunci: "hakim", label: JAHAT },
            { kunci: "ketua", label: "Ketua" },
          ],
          butir: [
            {
              id: "j1",
              jenis: JAHAT,
              judul: JAHAT,
              perkara: { id: 1, nomor: JAHAT },
              tenggat: hariKe(-1),
              kelompok: "lewat",
              keterangan: JAHAT,
              kerjakan: { tujuan: "sipp", halaman: JAHAT },
            },
            { id: "j2", judul: "lain", kelompok: JAHAT, kerjakan: { tujuan: JAHAT } },
          ],
          jenisTidakTersedia: [{ jenis: JAHAT, judul: JAHAT, sebab: JAHAT }],
          galat: [JAHAT],
        }),
      }),
    });
    await siap(h);
    for (const d of qs(h, "details")) d.open = true;
    expect(markupJahat(h)).toEqual({ script: 0, img: 0, b: 0 });
    expect(q(h, '[data-id="j1"] .aleta-cm-butir-judul').textContent).toBe(JAHAT);
    expect(String(akarDari(h).shadowRoot.textContent)).toContain(JAHAT);
    expect(h.w.__xss).toBeUndefined();
  });

  it("pesan galat 403 dan 500 dari portal", async () => {
    for (const status of [403, 500]) {
      const h = buka({ simpanan: NYALA, jawab: () => ({ status, isi: { error: { message: JAHAT } } }) });
      const kabar = await sampai(() => q(h, ".aleta-cm-kabar-galat"), `kabar ${status}`);
      expect(markupJahat(h), String(status)).toEqual({ script: 0, img: 0, b: 0 });
      expect(String(kabar.textContent), String(status)).toContain(JAHAT);
    }
  });
});

// ============================================================================
describe("alamat Kerjakan yang diserang", () => {
  /**
   * Alamat datang dari jawaban portal. Tombol yang hidup hanya boleh membuka
   * halaman portal di bawah /aleta/ (sesudah jalurnya dinormalkan), e-Court
   * Mahkamah Agung lewat https, atau alamat ABT/SIPP yang dibangun ekstensi
   * sendiri dari perkaranya. `alamat` untuk ABT dan SIPP diabaikan: katalog
   * tidak pernah memancarkannya, dan ABT punya GET yang menghapus
   * (tanyajawab_template?hapus=).
   */
  it("skema berbahaya, host mirip, jalur keluar /aleta, e-Court tanpa https, dan alamat bawaan untuk ABT/SIPP", async () => {
    const serang: Array<[string, string, string]> = [
      ["a1", "aleta", "javascript:alert(1)"],
      ["a2", "aleta", "JaVaScRiPt:alert(1)"],
      ["a3", "aleta", " \tjavascript:alert(1)"],
      ["a4", "aleta", "java\tscript:alert(1)"],
      ["a5", "aleta", "data:text/html,<script>alert(1)</script>"],
      ["a6", "aleta", "//evil.example/x"],
      ["a7", "aleta", "\\\\evil.example/x"],
      ["a8", "aleta", "/\\evil.example/x"],
      ["a9", "aleta", "http://192.168.10.10.evil.example/aleta"],
      ["a10", "aleta", "http://192.168.10.10@evil.example/"],
      ["a11", "aleta", "/aleta/../SIPP/perkara_hapus/1"],
      ["a12", "aleta", "https://192.168.10.10/aleta/x"],
      ["a13", "aleta", "/aleta/%2e%2e/SIPP/perkara_hapus/1"],
      ["a14", "aleta", "http://192.168.10.10/aps_badilag/abt/main/tanyajawab_template?hapus=5"],
      ["e1", "ecourt", "https://ecourt.mahkamahagung.go.id.evil.example/x"],
      ["e2", "ecourt", "https://evilmahkamahagung.go.id/x"],
      ["e3", "ecourt", "https://ecourt.mahkamahagung.go.id@evil.example/x"],
      ["e4", "ecourt", "https://evil.example\\@ecourt.mahkamahagung.go.id/"],
      ["e5", "ecourt", "javascript://ecourt.mahkamahagung.go.id/%0aalert(1)"],
      ["e6", "ecourt", "http://ecourt.mahkamahagung.go.id/x"],
      ["e7", "ecourt", "https://ECOURT.MAHKAMAHAGUNG.GO.ID./x"],
      ["e8", "ecourt", "/aleta/../SIPP/perkara_hapus/1"],
      ["b1", "abt", "//evil.example/x"],
      ["b2", "abt", "javascript:alert(1)"],
      ["b3", "abt", "/aleta/../SIPP/perkara_hapus/1"],
      ["b4", "abt", "main/tanyajawab_template?hapus=5"],
      ["b5", "abt", "http://192.168.10.10/aps_badilag/abt/main/tanyajawab_template?hapus=5"],
      ["s1", "sipp", "data:text/html,x"],
      ["s2", "sipp", "//evil.example/x"],
      ["s3", "sipp", "/SIPP/perkara_hapus/1"],
    ];
    const sah: Record<string, (href: string) => boolean> = {
      aleta: (href) => href.startsWith(`${ASAL}/aleta/`),
      ecourt: (href) => /^https:\/\/([a-z0-9-]+\.)*mahkamahagung\.go\.id\//.test(href),
      abt: (href) => href === `${ASAL}/aps_badilag/abt/main/beranda?c=10099`,
      sipp: (href) => href === `${ASAL}/SIPP/`,
    };
    const butir = serang.map(([id, tujuan, alamat]) => ({
      id,
      jenis: "x",
      judul: id,
      perkara: perkara(10099, "399/Pdt.G/2026/PA.Dgl"),
      tenggat: hariKe(0),
      kelompok: "hari-ini",
      keterangan: "",
      kerjakan: { tujuan, alamat },
    }));
    const h = buka({ simpanan: NYALA, alamat: `${ASAL}/aleta/aleta-ecourt`, jawab: () => ({ isi: jawabanContoh({ butir }) }) });
    await siap(h);
    const lolos: string[] = [];
    for (const [id, tujuan, alamat] of serang) {
      const href = kerjakan(h, id).getAttribute("href");
      if (href !== null && (!sah[tujuan](href) || /^\s*(javascript|data|vbscript):/i.test(href))) {
        lolos.push(`${id} ${JSON.stringify(alamat)} -> ${href}`);
      }
    }
    expect(lolos).toEqual([]);
    // Yang tidak dapat dibuka dengan aman: tombol MATI, dan sebabnya disebut.
    const mati = ["a1", "a2", "a3", "a4", "a5", "a6", "a7", "a9", "a10", "a11", "a12", "a13", "a14"];
    for (const id of [...mati, "e1", "e2", "e3", "e4", "e5", "e6", "e7", "e8"]) {
      const t = kerjakan(h, id);
      expect(t.tagName, id).toBe("SPAN");
      expect(t.getAttribute("aria-disabled"), id).toBe("true");
      expect(t.title, id).toContain("ditolak");
    }
  });
});

// ============================================================================
describe("jawaban basi: diperiksa lagi SESUDAH badannya terbaca", () => {
  /**
   * Kepala jawaban lama sudah tiba sebelum peran diganti; BADANNYA yang
   * tertahan. Pemeriksaan yang hanya dilakukan sebelum badan dibaca
   * meloloskannya: sesudah jawaban peran baru tergambar, badan lama menimpa
   * keadaan, dan penggambaran berikutnya menampilkan yang basi.
   */
  for (const status of [200, 403, 500]) {
    it(`badan jawaban ${status} yang tertahan tidak menimpa checklist peran yang baru`, async () => {
      let lepas: () => void = () => {};
      const tertahan = new Promise<void>((r) => {
        lepas = () => r();
      });
      const h = buka({ simpanan: NYALA });
      const fetchAsli = h.w.fetch;
      let ke = 0;
      let lambat = 0;
      h.w.fetch = (alamat: string) => {
        const url = String(alamat);
        if (!url.includes(API)) return fetchAsli(alamat);
        ke += 1;
        if (ke === 1) return fetchAsli(alamat);
        if (url.includes("peran=ketua")) {
          const baru = [{ ...butirContoh()[0], id: "baru", judul: "JAWABAN BARU" }];
          return Promise.resolve(tanggapan(200, jawabanContoh({ peranAktif: "ketua", butir: baru })));
        }
        // "Segarkan" (dan ulangan 5xx milik alatAmbil): kepalanya segera, badannya tertahan.
        lambat += 1;
        const isi =
          status === 200
            ? jawabanContoh({ butir: [{ ...butirContoh()[0], id: "basi", judul: "JAWABAN BASI" }] })
            : { error: { message: "PESAN BASI" } };
        const r: any = {
          ok: status === 200,
          status,
          json: async () => {
            await tertahan;
            return polos(isi);
          },
          clone: () => r,
        };
        return Promise.resolve(r);
      };
      await siap(h);
      q(h, ".aleta-cm-segar").click();
      await sampai(() => lambat === (status >= 500 ? 2 : 1), "kepala jawaban lama tiba");
      await tunggu(30);
      const pilih = q(h, "select.aleta-cm-peran");
      pilih.value = "ketua";
      pilih.dispatchEvent(new h.w.Event("change", { bubbles: true }));
      await sampai(() => q(h, '[data-id="baru"]'), "jawaban peran baru tergambar");
      lepas();
      await tunggu(50);
      // Digambar ulang dari keadaan yang tersimpan.
      await h.setel({ tautanPerkaraSipp: {} });
      await tunggu(30);
      expect(q(h, '[data-id="basi"]')).toBeNull();
      expect(q(h, '[data-id="baru"]')).not.toBeNull();
      expect(String(akarDari(h).shadowRoot.textContent)).not.toContain("PESAN BASI");
      expect(q(h, ".aleta-cm-kabar-galat")).toBeNull();
      expect(q(h, "select.aleta-cm-peran").value).toBe("ketua");
    });
  }

  // 401 dan 404 mengubah keadaan tanpa membaca badan: satu-satunya penjaganya
  // pemeriksaan sesudah KEPALA jawaban.
  for (const status of [401, 404]) {
    it(`kepala jawaban ${status} yang tiba sesudah peran diganti tidak menimpa checklist peran yang baru`, async () => {
      let ke = 0;
      let lepas: () => void = () => {};
      const jawab: Jawab = (url) => {
        ke += 1;
        if (ke === 2) {
          return new Promise<Hasil>((r) => {
            lepas = () => r({ status, isi: { error: { message: "PESAN BASI" } } });
          });
        }
        if (url.includes("peran=ketua")) {
          const baru = [{ ...butirContoh()[0], id: "baru", judul: "JAWABAN BARU" }];
          return { isi: jawabanContoh({ peranAktif: "ketua", butir: baru }) };
        }
        return { isi: jawabanContoh() };
      };
      const h = buka({ simpanan: NYALA, jawab });
      await siap(h);
      q(h, ".aleta-cm-segar").click();
      await sampai(() => h.minta.length === 2, "permintaan lama berangkat");
      const pilih = q(h, "select.aleta-cm-peran");
      pilih.value = "ketua";
      pilih.dispatchEvent(new h.w.Event("change", { bubbles: true }));
      await sampai(() => q(h, '[data-id="baru"]'), "jawaban peran baru tergambar");
      lepas();
      await tunggu(50);
      await h.setel({ tautanPerkaraSipp: {} });
      await tunggu(30);
      expect(q(h, '[data-id="baru"]')).not.toBeNull();
      expect(q(h, ".aleta-cm-kabar-galat")).toBeNull();
    });
  }
});

// ============================================================================
describe("panen tautan SIPP hanya selama widget menyala", () => {
  const BARIS =
    "<tr><td>1</td><td>389/Pdt.G/2026/PA.Dgl</td><td>Cerai Gugat</td>" +
    '<td>[<a href="/SIPP/perkara_detil_agama/QUJDMzg5">detil</a>]</td></tr>';
  const TAUTAN = { "389/PDT.G/2026/PA.DGL": { url: `${ASAL}/SIPP/perkara_detil_agama/QUJDMzg5`, pada: Date.now() } };

  it("permintaan yang masih terbang saat widget dimatikan: daftar SIPP tidak dibaca, tidak ada yang tersimpan", async () => {
    let lepas: () => void = () => {};
    const h = buka({
      simpanan: NYALA,
      alamat: `${ASAL}/SIPP/perkara_list`,
      html: '<table id="t"></table>',
      jawab: () =>
        new Promise<Hasil>((r) => {
          lepas = () => r({ isi: jawabanContoh() });
        }),
    });
    await sampai(() => akarDari(h), "widget terpasang");
    await sampai(() => h.minta.length === 1, "permintaan berangkat");
    // Daftar SIPP terisi belakangan (DataTables/ajax).
    h.w.document.getElementById("t").innerHTML = BARIS;
    const a = h.w.document.querySelector("#t a");
    const hrefAsli = a.href;
    let dibaca = 0;
    Object.defineProperty(a, "href", {
      configurable: true,
      get: () => {
        dibaca += 1;
        return hrefAsli;
      },
    });
    await h.setel({ checklistMilestone: false });
    await sampai(() => !akarDari(h), "widget hilang");
    lepas();
    await tunggu(100);
    expect(dibaca, "tautan daftar SIPP dibaca sesudah saklar mati").toBe(0);
    expect(h.simpanan.tautanPerkaraSipp).toBeUndefined();
  });

  it("saklar dimatikan saat panen menunggu penyimpanan: hasilnya tidak ditulis", async () => {
    const h = buka({ simpanan: NYALA, alamat: `${ASAL}/SIPP/perkara_list`, html: '<table id="t"></table>' });
    await siap(h);
    const local = h.w.chrome.storage.local;
    const getAsli = local.get;
    let lepas: () => void = () => {};
    let ditahan = false;
    local.get = (kunci: unknown) => {
      if (JSON.stringify(kunci) !== '["tautanPerkaraSipp"]') return getAsli(kunci);
      ditahan = true;
      return new Promise((r) => {
        lepas = () => r(getAsli(kunci));
      });
    };
    h.w.document.getElementById("t").innerHTML = BARIS;
    q(h, ".aleta-cm-segar").click();
    await sampai(() => ditahan, "panen membaca penyimpanan");
    await h.setel({ checklistMilestone: false });
    await sampai(() => !akarDari(h), "widget hilang");
    lepas();
    await tunggu(60);
    expect(h.simpanan.tautanPerkaraSipp).toBeUndefined();
  });

  it("saklar dimatikan - dari popup, dari ×, atau selagi tidak ada tab terbuka: tautan yang pernah dipanen dihapus", async () => {
    const h = buka({ simpanan: { ...NYALA, tautanPerkaraSipp: TAUTAN } });
    await siap(h);
    await h.setel({ checklistMilestone: false });
    await sampai(() => !("tautanPerkaraSipp" in h.simpanan), "dihapus saat saklar dimatikan dari popup");

    const h2 = buka({ simpanan: { ...NYALA, tautanPerkaraSipp: TAUTAN } });
    await siap(h2);
    q(h2, ".aleta-cm-tutup").click();
    await sampai(() => !("tautanPerkaraSipp" in h2.simpanan), "dihapus saat ×");

    // Dimatikan saat tidak ada halaman yang terbuka: sisanya dihapus halaman berikutnya.
    const h3 = buka({ simpanan: { checklistMilestone: false, tautanPerkaraSipp: TAUTAN } });
    await sampai(() => !("tautanPerkaraSipp" in h3.simpanan), "sisa dihapus saat halaman dimuat");
    expect(akarDari(h3)).toBeNull();
    expect(h3.minta).toEqual([]);

    // Menyala: yang tersimpan tidak disentuh.
    const h4 = buka({ simpanan: { ...NYALA, tautanPerkaraSipp: TAUTAN } });
    await siap(h4);
    await tunggu(30);
    expect(h4.simpanan.tautanPerkaraSipp).toEqual(TAUTAN);
  });
});

// ============================================================================
describe("pintu masuk perkara SIPP yang diingat", () => {
  const TAUTAN_389 = { "389/PDT.G/2026/PA.DGL": { url: `${ASAL}/SIPP/perkara_detil_agama/QUJDMzg5`, pada: Date.now() } };

  it("riwayat beralamat flash-session (detil tanpa <enc>) tidak mengalahkan tautan detil hasil panen", async () => {
    const h = buka({
      simpanan: {
        ...NYALA,
        riwayatPerkaraSipp: [{ nomor: "389/Pdt.G/2026/PA.Dgl", url: `${ASAL}/SIPP/detil_perkara_agama` }],
        tautanPerkaraSipp: TAUTAN_389,
      },
    });
    await siap(h);
    expect(kerjakan(h, "h3").getAttribute("href")).toBe(`${ASAL}/SIPP/perkara_detil_agama/QUJDMzg5`);
  });

  it("riwayat dan tautan tersimpan yang bukan pintu masuk sah di asal ini diabaikan", async () => {
    const h = buka({
      simpanan: {
        ...NYALA,
        lipatanChecklistMilestone: { "minggu-ini": true },
        riwayatPerkaraSipp: [
          { nomor: "389/Pdt.G/2026/PA.Dgl", url: "http://jahat.example/SIPP/perkara_detil/QUJDMzg5" },
          { nomor: "385/Pdt.G/2026/PA.Dgl", url: "javascript:alert(1)//perkara_detil/x" },
          { nomor: "390/Pdt.G/2026/PA.Dgl", url: `${ASAL}/SIPP/perkara_hapus/1?x=/perkara_detil/QUJD` },
        ],
        tautanPerkaraSipp: {
          "390/PDT.G/2026/PA.DGL": { url: "http://jahat.example/SIPP/perkara_detil_agama/QUJDMzkw", pada: Date.now() },
        },
      },
    });
    await siap(h);
    for (const id of ["h3", "l1", "m1"]) expect(kerjakan(h, id).getAttribute("href"), id).toBe(`${ASAL}/SIPP/`);
  });

  it("baris daftar yang memuat lebih dari satu nomor tidak dipanen - bukan baris satu perkara", async () => {
    const html =
      "<table>" +
      "<tr><td>1</td><td>392/Pdt.G/2026/PA.Dgl</td><td>rekonvensi 393/Pdt.G/2026/PA.Dgl</td>" +
      '<td>[<a href="/SIPP/perkara_detil_agama/QUJDMzky">detil</a>]</td></tr>' +
      "<tr><td>2</td><td>391/Pdt.G/2026/PA.Dgl</td><td>Cerai Talak</td>" +
      '<td>[<a href="/SIPP/perkara_detil_agama/QUJDMzkx">detil</a>]</td></tr>' +
      "</table>";
    const h = buka({ simpanan: NYALA, alamat: `${ASAL}/SIPP/perkara_list`, html });
    await siap(h);
    const peta = await sampai(() => h.simpanan.tautanPerkaraSipp as any, "baris tunggal dipanen");
    expect(Object.keys(peta)).toEqual(["391/PDT.G/2026/PA.DGL"]);
  });
});
