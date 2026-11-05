// @vitest-environment node
/**
 * ============================================================================
 * APS BADILAG: UBIN "ALETA ABT" + HALAMAN MENU TANPA BEBAN EKSTENSI (3 Nov 2026)
 * ============================================================================
 *
 * ekstensi-sipp/aps-beranda.js dijalankan SUNGGUHAN di jsdom di atas tiruan
 * halaman menu APS Badilag 4.05 (cetakan application/views/homepage.php di
 * server satker, dibaca saja). Data di sini REKAAN. Yang dibuktikan:
 *
 *   1. ubin ALETA ABT tepat sesudah BLANGKO TAMBAHAN SIPP, E-PELAPORAN pindah ke
 *      baris berikutnya (juga bila ubin peran lebih sedikit), urutan ubin lain tetap;
 *   2. tautannya = alamat ubin ABT milik APS + /main/beranda#aleta-derry=1;
 *   3. peran tanpa hak Blangko Derry / ALETA tak terjangkau: halaman tidak berubah; belum masuk
 *      ALETA (5 Nov 2026, Cara A): ubin tampil dan mengantar ke layar masuk dengan tujuan kembali;
 *   4. tidak ada kerja sebelum halaman selesai dimuat; satu GET, lalu tersimpan di sesi;
 *   5. manifest: berkas ABT lengkap (3,8 MB) tidak lagi dimuat di halaman menu,
 *      e-Keuangan, e-Pelaporan, dan e-Register; aplikasi ABT dan halaman masuk tetap.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

import { KEMBALI_DARI_UBIN_APS, bolehBlangkoDerry } from "@/lib/aleta-abt-hp";
import { tujuanKembaliAman } from "@/lib/tujuan-kembali";

const EKSTENSI = path.resolve(process.cwd(), "../ekstensi-sipp");
const baca = (b: string) => readFileSync(path.join(EKSTENSI, b), "utf8").replace(/\r\n/g, "\n");
const SUMBER = baca("aps-beranda.js");
const MENU_ATAS = baca("menu-atas.js");
const MANIFEST = JSON.parse(baca("manifest.json"));

const ASAL = "http://192.168.10.10";
const MAIN = `${ASAL}/aps_badilag/main`;
const tunggu = (ms = 0) => new Promise((r) => setTimeout(r, ms));

// ─── tiruan homepage.php (REKAAN) ────────────────────────────────────────────
type Ubin = [string, string];
const UBIN_ADMIN: Ubin[] = [
  ["register", "logo_register"],
  ["keuangan/dashboard", "logo_keuangan"],
  ["abt", "logo_abt"],
  ["pelaporan/mediator", "logo_pelaporan"],
  ["pelaporan", "logo_siperdi"],
  ["pelaporan/Data_akta_nikah", "logo_cek_buku_nikah"],
  ["pelaporan/E_Berbanding", "logo_e_berbanding"],
  ["pelaporan/E_akta_cerai", "logo_akta_elektronik"],
];
// Hakim: tanpa E-KEUANGAN dan tanpa EAC (Main.php group 20).
const UBIN_HAKIM = UBIN_ADMIN.filter(([h]) => h !== "keuangan/dashboard" && h !== "pelaporan/E_akta_cerai");

const halamanMenu = (ubin: Ubin[] = UBIN_ADMIN) =>
  `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>APS Badilag</title></head><body style="padding: 1rem;">
<div class="container-scroller"><div class="container-fluid page-body-wrapper full-page-wrapper auth-page"><div class="content-wrapper d-flex align-items-center auth auth-bg-1 theme-one"><div class="row w-100"><div class="col-lg-10 mx-auto">
<div class="warna_text">Selamat Datang <b>Pengguna Rekaan</b></div>
<div class="auto-form-wrapper"><div class="row justify-content-center">${ubin
    .map(([h, i]) => `<div class="col-lg-3 mb-4"><a href="${ASAL}/aps_badilag/${h}"><img class="img-fluid" src="${ASAL}/aps_badilag/assets/images/${i}.png" alt="logo" /></a></div>`)
    .join("")}</div>
<p class="footer-text text-center text-success mt-4">APS BADILAG Versi 4.05</p></div></div></div></div></div></div></body></html>`;

const SIAPA = (peran: string, golongan: string[], roleId = peran.toLowerCase()) => ({
  status: 200,
  data: { id: "u-rekaan", nama: "Pengguna Rekaan", peran, roleId, peranTambahan: [], golonganMenu: golongan, bolehKasir: false },
});
const HAKIM = SIAPA("Hakim", ["hakim"]);
const SUPER = SIAPA("Super Admin", ["admin"], "super-admin");
const KASIR = SIAPA("Kasir", ["kasir"]);
const PP = SIAPA("Panitera Pengganti", ["pp"]);
const BELUM_MASUK = { status: 401, data: { error: { message: "Belum masuk" } } };

type Hasil = { w: any; d: Document; fetchLog: { url: string; opsi?: any }[]; api: any; awal: string };
const terbuka: JSDOM[] = [];
afterEach(() => {
  while (terbuka.length) terbuka.pop()!.window.close();
});

function buka(o: { html?: string; alamat?: string; siapa?: { status: number; data?: unknown }; sesi?: Record<string, string>; otomatis?: boolean; menuAtas?: boolean } = {}): Hasil {
  const dom = new JSDOM(o.html ?? halamanMenu(), { url: o.alamat ?? MAIN, runScripts: "outside-only" });
  terbuka.push(dom);
  const w = dom.window as any;
  const fetchLog: Hasil["fetchLog"] = [];
  w.chrome = {
    runtime: { id: "aleta-uji", getURL: (p: string) => `chrome-extension://aleta-uji/${p}`, sendMessage: () => undefined },
    storage: { local: { get: async () => ({}), set: async () => undefined, remove: async () => undefined }, onChanged: { addListener: () => undefined } },
  };
  w.fetch = async (url: string, opsi?: unknown) => {
    fetchLog.push({ url: String(url), opsi });
    const s = String(url).includes("/ekstensi/siapa") ? o.siapa || HAKIM : { status: 404, data: {} };
    return { ok: s.status >= 200 && s.status < 300, status: s.status, json: async () => ({ ok: s.status < 300, data: s.data }) };
  };
  for (const [k, v] of Object.entries(o.sesi || {})) w.sessionStorage.setItem(k, v);
  const awal = w.document.querySelector(".auto-form-wrapper").innerHTML;
  if (o.menuAtas !== false) w.eval(MENU_ATAS);
  if (!o.otomatis) w.__aletaApsBerandaUji = true;
  w.eval(SUMBER);
  return { w, d: w.document, fetchLog, api: w.aletaApsBeranda, awal };
}

/** Isi baris ubin: href ubin APS, "ALETA" untuk ubin kita, "|" untuk pemisah baris. */
const susunan = (d: Document) =>
  Array.from(d.querySelectorAll(".auto-form-wrapper .row.justify-content-center > div")).map((c) => {
    if (c.getAttribute("data-aleta-ubin") === "pemisah") return "|";
    if (c.getAttribute("data-aleta-ubin") === "aleta-abt") return "ALETA";
    return String(c.querySelector("a")!.getAttribute("href")).replace(`${ASAL}/aps_badilag/`, "");
  });

// ============================================================================
describe("ubin ALETA ABT: letak dan tujuan", () => {
  it("Super Admin: sesudah BLANGKO TAMBAHAN SIPP, E-PELAPORAN mulai di baris berikutnya, urutan lain tetap", async () => {
    const h = buka({ siapa: SUPER });
    const r = await h.api.mulai({ segera: true });
    expect(r).toMatchObject({ aksi: "dari-server", dipasang: true });
    expect(susunan(h.d)).toEqual(["register", "keuangan/dashboard", "abt", "ALETA", "|", "pelaporan/mediator", "pelaporan", "pelaporan/Data_akta_nikah", "pelaporan/E_Berbanding", "pelaporan/E_akta_cerai"]);
    // ubin asli tidak tersentuh: urutan & isinya sama persis dengan aslinya
    const asli = susunan(h.d).filter((x) => x !== "ALETA" && x !== "|");
    expect(asli).toEqual(UBIN_ADMIN.map(([x]) => x));
  });

  it("Hakim (ubin lebih sedikit): E-PELAPORAN tetap turun ke baris bawah karena pemisah baris", async () => {
    const h = buka({ html: halamanMenu(UBIN_HAKIM), siapa: HAKIM });
    await h.api.mulai({ segera: true });
    expect(susunan(h.d)).toEqual(["register", "abt", "ALETA", "|", "pelaporan/mediator", "pelaporan", "pelaporan/Data_akta_nikah", "pelaporan/E_Berbanding"]);
    const pemisah = h.d.querySelector('[data-aleta-ubin="pemisah"]')!;
    expect(pemisah.className).toBe("w-100");
  });

  it("bentuk sama dengan ubin APS: kelas kolom yang sama, gambar 900x520, tanpa kelas panel ALETA", async () => {
    const h = buka({ siapa: HAKIM });
    await h.api.mulai({ segera: true });
    const kolom = h.d.querySelector('[data-aleta-ubin="aleta-abt"]')!;
    const abt = h.d.querySelector(`a[href="${ASAL}/aps_badilag/abt"]`)!.closest("div")!;
    expect(kolom.className).toBe(abt.className);
    expect(kolom.className).not.toMatch(/aleta-sisip/);
    const svg = kolom.querySelector("svg")!;
    expect(svg.getAttribute("viewBox")).toBe("0 0 900 520");
    expect(svg.textContent).toContain("ALETA ABT");
    expect(svg.querySelector("image")!.getAttribute("href")).toBe("chrome-extension://aleta-uji/ikon/aleta-128.png");
  });

  it("tujuan klik = alamat ubin ABT milik APS + /main/beranda#aleta-derry=1 (tab yang sama)", async () => {
    const h = buka({ siapa: PP });
    await h.api.mulai({ segera: true });
    const a = h.d.querySelector('[data-aleta-ubin="aleta-abt"] a') as HTMLAnchorElement;
    expect(a.href).toBe(`${ASAL}/aps_badilag/abt/main/beranda#aleta-derry=1`);
    expect(a.getAttribute("target")).toBeNull();
    // penanda yang sama dengan menu-atas.js, yang di halaman ABT membuka Blangko Derry sendiri
    expect(h.w.aletaMenuAtas.HASH_DERRY).toBe("aleta-derry=1");
  });

  it("idempoten: dijalankan ulang tidak menggandakan ubin", async () => {
    const h = buka({ siapa: HAKIM });
    await h.api.mulai({ segera: true });
    expect(h.api.pasangUbin(h.d, { tampil: true })).toMatchObject({ alasan: "sudah" });
    expect(h.d.querySelectorAll('[data-aleta-ubin="aleta-abt"]').length).toBe(1);
    expect(h.d.querySelectorAll('[data-aleta-ubin="pemisah"]').length).toBe(1);
  });
});

// ============================================================================
describe("hak per peran dan tanpa ekstensi", () => {
  it("Kasir (tanpa hak Blangko Derry): ubin tidak tampil, halaman persis seperti aslinya", async () => {
    const h = buka({ siapa: KASIR });
    const r = await h.api.mulai({ segera: true });
    expect(r).toMatchObject({ dipasang: false, alasan: "tanpa-hak" });
    expect(h.d.querySelector(".auto-form-wrapper")!.innerHTML).toBe(h.awal);
  });

  it("ALETA tak terjangkau (bukan 401): ubin tetap tersembunyi, halaman tidak berubah", async () => {
    for (const siapa of [{ status: 500, data: {} }, { status: 502, data: {} }, { status: 404, data: {} }]) {
      const h = buka({ siapa });
      const r = await h.api.mulai({ segera: true });
      expect(r, String(siapa.status)).toMatchObject({ aksi: "hak-belum-diketahui", dipasang: false });
      expect(h.d.querySelector(".auto-form-wrapper")!.innerHTML).toBe(h.awal);
    }
    // galat jaringan (fetch melempar)
    const h = buka({ siapa: HAKIM });
    h.w.fetch = async () => {
      throw new Error("jaringan putus");
    };
    expect(await h.api.mulai({ segera: true })).toMatchObject({ aksi: "hak-belum-diketahui", dipasang: false });
    expect(h.d.querySelector(".auto-form-wrapper")!.innerHTML).toBe(h.awal);
  });

  it("aturan hak sama dengan butir ABT By Derry (menu-atas.js bolehDerry)", () => {
    const h = buka();
    const boleh = h.api.murni.boleh;
    for (const s of [SUPER, HAKIM, PP, SIAPA("Juru Sita", ["jurusita"]), SIAPA("PTSP", ["ptsp"])]) expect(boleh(s.data)).toBe(true);
    for (const s of [KASIR, SIAPA("Sekretaris", ["sekretariat"]), SIAPA("Staf", ["lain"])]) expect(boleh(s.data)).toBe(false);
  });

  it("tanpa ekstensi halaman APS tidak berubah: ubin hanya dibuat oleh skrip ekstensi", () => {
    const dom = new JSDOM(halamanMenu(), { url: MAIN });
    terbuka.push(dom);
    expect(dom.window.document.querySelector("[data-aleta-ubin]")).toBeNull();
    const pemuat = MANIFEST.content_scripts.filter((c: any) => (c.js || []).includes("aps-beranda.js"));
    expect(pemuat.length).toBe(1);
  });

  it("hanya di halaman menu APS - tidak di e-Keuangan, aplikasi ABT, atau halaman masuk", async () => {
    const m = buka().api.murni.halamanMenuAps;
    for (const p of ["/aps_badilag/", "/aps_badilag/main", "/aps_badilag/index.php/main", "/aps_badilag/index.php"]) expect(m({ pathname: p })).toBe(true);
    for (const p of ["/aps_badilag/keuangan/dashboard", "/aps_badilag/abt/main/beranda", "/aps_badilag/login", "/SIPP/index.php/home"]) expect(m({ pathname: p })).toBe(false);
    const h = buka({ alamat: `${ASAL}/aps_badilag/keuangan/dashboard` });
    expect(await h.api.mulai({ segera: true })).toEqual({ aksi: "bukan-menu-aps" });
    expect(h.fetchLog).toEqual([]);
  });
});

// ============================================================================
describe("ubin ALETA ABT bagi akun yang belum masuk ALETA (Cara A, 5 Nov 2026)", () => {
  const LOGIN = `${ASAL}/aleta/login?kembali=${encodeURIComponent("/aleta-abt?dari=aps")}`;

  it("belum masuk (401): ubin tampil di tempat yang sama dan mengantar ke layar masuk ALETA dengan tujuan kembali", async () => {
    const h = buka({ siapa: BELUM_MASUK });
    const r = await h.api.mulai({ segera: true });
    expect(r).toMatchObject({ aksi: "belum-masuk", dipasang: true });
    expect(susunan(h.d)).toEqual(["register", "keuangan/dashboard", "abt", "ALETA", "|", "pelaporan/mediator", "pelaporan", "pelaporan/Data_akta_nikah", "pelaporan/E_Berbanding", "pelaporan/E_akta_cerai"]);
    const a = h.d.querySelector('[data-aleta-ubin="aleta-abt"] a') as HTMLAnchorElement;
    expect(a.href).toBe(LOGIN);
    expect(a.getAttribute("target")).toBeNull();
  });

  it("keadaan belum masuk tidak disimpan di sesi (sesudah masuk, kunjungan berikutnya langsung benar)", async () => {
    const h = buka({ siapa: BELUM_MASUK });
    await h.api.mulai({ segera: true });
    expect(h.w.sessionStorage.getItem("aletaMenuAtasHak")).toBeNull();
  });

  it("sudah masuk dan berhak: ubin kembali ke panel Blangko Derry (tidak lagi ke layar masuk), tanpa menggandakan", async () => {
    const h = buka({ siapa: BELUM_MASUK });
    await h.api.mulai({ segera: true });
    h.w.fetch = async () => ({ ok: true, status: 200, json: async () => ({ ok: true, data: HAKIM.data }) });
    const r = await h.api.mulai({ segera: true });
    expect(r).toMatchObject({ aksi: "dari-server", dipasang: true });
    const a = h.d.querySelectorAll('[data-aleta-ubin="aleta-abt"] a');
    expect(a.length).toBe(1);
    expect((a[0] as HTMLAnchorElement).href).toBe(`${ASAL}/aps_badilag/abt/main/beranda#aleta-derry=1`);
    expect(h.d.querySelectorAll('[data-aleta-ubin="pemisah"]').length).toBe(1);
  });

  it("sudah masuk tetapi tidak berhak: ubin disembunyikan, juga bila sebelumnya tampil sebagai ubin masuk", async () => {
    const h = buka({ siapa: BELUM_MASUK });
    await h.api.mulai({ segera: true });
    h.w.fetch = async () => ({ ok: true, status: 200, json: async () => ({ ok: true, data: KASIR.data }) });
    expect(await h.api.mulai({ segera: true })).toMatchObject({ dipasang: false, alasan: "tanpa-hak" });
    expect(h.d.querySelector(".auto-form-wrapper")!.innerHTML).toBe(h.awal);
  });

  it("tujuan kembali hanya jalur di dalam portal dan lolos tujuanKembaliAman apa adanya", async () => {
    const h = buka();
    const url = new URL(h.api.murni.alamatMasukAleta({ origin: ASAL }));
    expect(url.origin + url.pathname).toBe(`${ASAL}/aleta/login`);
    const kembali = url.searchParams.get("kembali")!;
    expect(kembali).toBe("/aleta-abt?dari=aps");
    expect(kembali).toBe(h.api.KEMBALI_ALETA_ABT);
    expect(tujuanKembaliAman(kembali)).toBe(kembali);
    expect(KEMBALI_DARI_UBIN_APS).toBe(kembali);
    // Pengalih ke alamat bebas tetap ditolak (tujuanKembaliAman tidak dilonggarkan).
    for (const jahat of ["//evil.example/aleta-abt", "https://evil.example", "/\\evil.example", "/login", "/api/x"]) expect(tujuanKembaliAman(jahat)).toBe("/portal");
  });

  it("halaman portal: ?dari=aps + ekstensi aktif + akun berhak membuka panel; tanpa hak atau tanpa penanda tidak", () => {
    for (const s of [SUPER, HAKIM, PP, SIAPA("Juru Sita", ["jurusita"]), SIAPA("PTSP", ["ptsp"])]) expect(bolehBlangkoDerry(s.data)).toBe(true);
    for (const s of [KASIR, SIAPA("Sekretaris", ["sekretariat"])]) expect(bolehBlangkoDerry(s.data)).toBe(false);
    expect(bolehBlangkoDerry(null)).toBe(false);
    // Aturan portal = aturan ubin (aps-beranda.js boleh) untuk semua contoh.
    const h = buka();
    for (const s of [SUPER, HAKIM, PP, KASIR, SIAPA("Staf", ["lain"]), SIAPA("Ketua", ["ketua"])]) expect(bolehBlangkoDerry(s.data), String((s.data as any).peran)).toBe(h.api.murni.boleh(s.data));
  });
});

// ============================================================================
describe("ringan: tidak ada kerja sebelum halaman siap", () => {
  it("hak belum diketahui: GET /ekstensi/siapa baru sesudah load + senggang, hanya sekali", async () => {
    const h = buka({ siapa: HAKIM });
    Object.defineProperty(h.d, "readyState", { configurable: true, get: () => "loading" });
    let senggang: (() => void) | null = null;
    h.w.requestIdleCallback = (f: () => void) => (senggang = f);
    const janji = h.api.mulai();
    await tunggu(20);
    expect(h.fetchLog).toEqual([]);
    h.w.dispatchEvent(new h.w.Event("load"));
    await tunggu(5);
    expect(h.fetchLog).toEqual([]);
    expect(senggang).not.toBeNull();
    senggang!();
    await janji;
    expect(h.fetchLog.map((x) => x.url)).toEqual(["/aleta/api/aleta-ecourt/ekstensi/siapa"]);
    expect(h.fetchLog[0].opsi).toMatchObject({ credentials: "include" });
  });

  it("jawaban hak disimpan 5 menit di sesi (kunci sama dengan menu-atas.js): kunjungan berikutnya tanpa permintaan", async () => {
    const h = buka({ siapa: HAKIM });
    await h.api.mulai({ segera: true });
    const tersimpan = h.w.sessionStorage.getItem("aletaMenuAtasHak");
    expect(JSON.parse(tersimpan)).toMatchObject({ abt: true });
    const h2 = buka({ sesi: { aletaMenuAtasHak: tersimpan } });
    const r = await h2.api.mulai();
    expect(r).toMatchObject({ aksi: "dari-sesi", dipasang: true });
    expect(h2.fetchLog).toEqual([]);
  });

  it("berkas tanpa pengamat DOM, tanpa pewaktu berulang, dan tanpa tulisan ke server/isian", () => {
    const kode = SUMBER.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(kode).not.toMatch(/MutationObserver|setInterval|ALETA_PENGAMAT/);
    expect(kode).not.toMatch(/\.value\s*=|FormData|method:\s*["'](POST|PUT|PATCH|DELETE)/);
    expect(kode).not.toMatch(/localStorage/);
  });
});

// ============================================================================
describe("manifest: berkas ABT lengkap hanya di aplikasi ABT", () => {
  // Pencocok pola Chrome sederhana: * = apa saja; pola dicocokkan atas host + jalur (+ kueri).
  const cocok = (pola: string, url: string) => new RegExp(`^${pola.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`).test(url);
  const dimuat = (url: string) =>
    MANIFEST.content_scripts
      .filter((c: any) => (c.matches || []).some((p: string) => cocok(p, url)) && !(c.exclude_matches || []).some((p: string) => cocok(p, url)))
      .flatMap((c: any) => c.js || []);

  it("halaman menu APS, e-Keuangan, e-Pelaporan, e-Register: tanpa abt.js/panel-alat.js/blangko-derry*.js", () => {
    for (const j of ["/aps_badilag/", "/aps_badilag/main", "/aps_badilag/index.php/main", "/aps_badilag/keuangan/dashboard", "/aps_badilag/keuangan/menu_jsp", "/aps_badilag/pelaporan/mediator", "/aps_badilag/pelaporan", "/aps_badilag/register", "/aps_badilag/transaksi_harian/index"]) {
      const js = dimuat(`${ASAL}${j}`);
      expect(js, j).not.toContain("abt.js");
      expect(js, j).not.toContain("panel-alat.js");
      expect(js, j).not.toContain("checklist.js");
      expect(js.filter((x: string) => x.startsWith("blangko-derry")), j).toEqual([]);
      expect(js, j).toContain("menu-atas.js"); // niat "ABT By Derry" sesudah masuk tetap diteruskan
      expect(js, j).toContain("aps-beranda.js");
      expect(js, j).toContain("tema-awal.js"); // tema terang/gelap tetap
    }
  });

  it("aplikasi ABT dan halaman masuk APS tetap memuat berkas lengkap (fitur lama tidak berkurang)", () => {
    for (const j of ["/aps_badilag/abt", "/aps_badilag/abt/main/beranda", "/aps_badilag/abt/main/cari", "/aps_badilag/login", "/aps_badilag/login/signin"]) {
      const js = dimuat(`${ASAL}${j}`);
      for (const b of ["abt.js", "panel-alat.js", "checklist.js", "blangko-derry.js", "menu-atas.js"]) expect(js, `${j} ${b}`).toContain(b);
      expect(js, j).not.toContain("aps-beranda.js");
      expect(js.filter((x: string) => x === "menu-atas.js").length, j).toBe(1);
    }
  });

  it("grup ringan: menu-atas.js + aps-beranda.js + panel.css (token tema), ikon dapat dibaca halaman", () => {
    const ringan = MANIFEST.content_scripts.find((c: any) => (c.js || []).includes("aps-beranda.js"));
    expect(ringan.js).toEqual(["menu-atas.js", "aps-beranda.js"]);
    expect(ringan.css).toEqual(["panel.css"]);
    expect(ringan.run_at).toBe("document_idle");
    expect(MANIFEST.web_accessible_resources[0].resources).toContain("ikon/aleta-128.png");
  });
});

// ============================================================================
describe("portal ALETA: tautan ALETA ABT hanya lewat panel ekstensi", () => {
  const ALETA_JS = baca("aleta.js");
  // Potongan murni (aturan hak + alamat) dijalankan apa adanya.
  const mulaiPotong = ALETA_JS.indexOf("const ALETA_ABT_GOLONGAN");
  const akhirPotong = ALETA_JS.indexOf("/** Perkara yang terakhir dibuka di SIPP");
  const potong = ALETA_JS.slice(mulaiPotong, akhirPotong);
  const murni = new Function("asalSatkerPortal", `${potong}; return { bolehAletaAbt, alamatAletaAbt };`)(() => ASAL) as {
    bolehAletaAbt: (s: unknown) => boolean;
    alamatAletaAbt: () => string;
  };

  it("hak sama dengan ubin APS: admin, hakim, PP, juru sita, PTSP ya; kasir/sekretariat/belum masuk tidak", () => {
    expect(mulaiPotong).toBeGreaterThan(0);
    for (const s of [SUPER, HAKIM, PP, SIAPA("Juru Sita", ["jurusita"]), SIAPA("PTSP", ["ptsp"]), SIAPA("Ketua", ["ketua"])]) expect(murni.bolehAletaAbt(s.data), String((s.data as any).peran)).toBe(true);
    for (const s of [KASIR, SIAPA("Sekretaris", ["sekretariat"]), SIAPA("Staf", ["lain"])]) expect(murni.bolehAletaAbt(s.data)).toBe(false);
    expect(murni.bolehAletaAbt(null)).toBe(false);
  });

  it("tujuannya sama dengan ubin APS: beranda ABT + #aleta-derry=1 (tab baru)", () => {
    expect(murni.alamatAletaAbt()).toBe(`${ASAL}/aps_badilag/abt/main/beranda#aleta-derry=1`);
    expect(ALETA_JS).toMatch(/const aletaAbt = tautan\(alamatAletaAbt\(\), "ALETA ABT"\);\n\s+aletaAbt\.target = "_blank";/);
    expect(ALETA_JS).toContain("isi.appendChild(await bagianSipp(siapa));");
    expect(ALETA_JS).toMatch(/if \(bolehAletaAbt\(siapa\)\) \{/);
  });

  it("tanpa ekstensi aktif tautan tidak ada: aleta.js hanya dimuat ekstensi di halaman portal, kode portal tidak menyebutnya", () => {
    const pemuat = MANIFEST.content_scripts.filter((c: any) => (c.js || []).includes("aleta.js"));
    expect(pemuat.length).toBe(1);
    expect(pemuat[0].matches).toContain("http://192.168.10.10/aleta/*");
    const shell = readFileSync(path.resolve(process.cwd(), "src/lib/mock-data.ts"), "utf8");
    expect(shell).not.toContain("aleta-derry=1");
  });
});
