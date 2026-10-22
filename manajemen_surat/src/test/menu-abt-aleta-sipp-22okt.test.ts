// @vitest-environment node
/**
 * ============================================================================
 * MENU "ABT BY DERRY" DAN "ALETA" DI BILAH ATAS SIPP (22 Okt 2026)
 * ============================================================================
 *
 * ekstensi-sipp/menu-atas.js dijalankan SUNGGUHAN di jsdom di atas bilah menu
 * tiruan yang disalin dari cetakan SIPP (application/views/Menu/menu.php):
 * div#cssmenu > ul.nav.navbar-nav > li.has-sub > a + ul. Yang dibuktikan:
 *
 *   1. urutan Perdata -> ABT By Derry -> ALETA -> Jinayat, bentuknya sama dengan
 *      butir SIPP, tidak ganda walau SIPP menggambar ulang bilahnya;
 *   2. belum masuk ALETA -> pesan + tautan masuk, ABT TIDAK dibuka;
 *   3. sudah masuk ALETA -> tab baru ke ABT (lewat pekerja latar);
 *   4. akun ABT belum masuk -> catatan di halaman masuk, niat tersimpan, sesudah
 *      masuk diarahkan ke Blangko ABT by Derry; sandi tidak pernah diisi/disimpan;
 *   5. peran tanpa hak tidak melihat ABT By Derry; saklar mematikan semuanya;
 *   6. pekerja latar menyusun alamat tujuan sendiri dan menolak pengirim asing.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

import { Dunia, jawaban, minta, nyalakan } from "./dunia-latar";

const EKSTENSI = path.resolve(process.cwd(), "../ekstensi-sipp");
const baca = (b: string) => readFileSync(path.join(EKSTENSI, b), "utf8").replace(/\r\n/g, "\n");
const SUMBER = baca("menu-atas.js");
const MANIFEST = JSON.parse(baca("manifest.json"));

const ASAL = "http://192.168.10.10";
const SIPP = `${ASAL}/SIPP/index.php/home`;
const tunggu = (ms = 0) => new Promise((r) => setTimeout(r, ms));
async function sampai<T>(periksa: () => T, apa: string, batas = 3000): Promise<NonNullable<T>> {
  const mulai = Date.now();
  for (;;) {
    let h: T | undefined;
    try {
      h = periksa();
    } catch {
      h = undefined;
    }
    if (h) return h as NonNullable<T>;
    if (Date.now() - mulai > batas) throw new Error(`tidak tercapai: ${apa}`);
    await tunggu(10);
  }
}

// ─── bilah menu tiruan (cetakan menu.php) ────────────────────────────────────

const MENU_SIPP = [
  "Home",
  "Jurnal Perkara",
  "Register Induk Keuangan",
  "Perdata",
  "Jinayat",
  "Jinayat Anak",
  "Delegasi",
  "Laporan",
  "Jadwal Sidang",
  "Arsip Perkara",
  "Antrian",
  "e-Court",
  "e-Payment",
  "Referensi",
  "Smart Majelis",
  "System",
];
const SUBMENU: Record<string, string[]> = { Perdata: ["Gugatan", "Permohonan", "Verzet"], Jinayat: ["Jinayat Dewasa"], Laporan: ["Statistik"] };

function bilahSipp(tanpa: string[] = []) {
  const li = MENU_SIPP.filter((m) => !tanpa.includes(m))
    .map((m) => {
      const lencana = m === "Delegasi" ? "<div class='notif_delegasi hidden'></div>" : m === "e-Court" ? "<div class='notif_efiling hidden'></div>" : "";
      const anak = (SUBMENU[m] || []).map((s) => `<li class="has-sub"><a href="${ASAL}/SIPP/${s}">${s}</a><ul></ul></li>`).join("");
      return `<li class="has-sub"><a href="${ASAL}/SIPP/${m.replace(/\s/g, "_")}">${m}${lencana}</a><ul>${anak}</ul></li>`;
    })
    .join("");
  return `<div id="cssmenu"><ul class='nav navbar-nav'>${li}</ul><div class="about">Help</div></div>`;
}
const halamanSipp = (tanpa: string[] = []) =>
  `<!doctype html><html><head><title>SIPP</title></head><body><div id="header"><div class="h_right"><table class="badge"><tr><td>Selamat Datang <font color="yellow">Derry Briantono</font></td></tr></table></div></div>${bilahSipp(tanpa)}<div id="isi">Beranda</div></body></html>`;

const HALAMAN_MASUK_ABT = `<!doctype html><html><head><title>ABT</title></head><body><div id="kotak"><form action="/aps_badilag/login/signin" method="post"><input name="userName" value=""><input name="password" type="password" value=""><button type="submit">Masuk</button></form></div></body></html>`;
const HALAMAN_APS = `<!doctype html><html><head><title>APS</title></head><body><div id="menu-aps">Aplikasi</div></body></html>`;
const HALAMAN_ABT = `<!doctype html><html><head><title>ABT</title></head><body><div id="header"><div class="h_right"><b>derry.briantono</b></div></div><div id="navbar"><button class="accordion">Blangko Derry (Daftar s.d. Produk)</button><div class="panel"><a href="#x">Item</a></div></div></body></html>`;

// ─── dunia halaman ───────────────────────────────────────────────────────────

type Panggilan = { url: string; opsi?: unknown };
type Hasil = {
  w: any;
  d: Document;
  pesan: any[];
  fetchLog: Panggilan[];
  lokal: Record<string, any>;
  tombolDitekan: number;
  alih: string[];
  open: unknown[][];
};
const terbuka: JSDOM[] = [];
afterEach(() => {
  while (terbuka.length) terbuka.pop()!.window.close();
});

type Opsi = {
  html?: string;
  alamat?: string;
  /** Jawaban /ekstensi/siapa: status + isi. */
  siapa?: { status: number; data?: unknown };
  saklar?: boolean;
  lokal?: Record<string, unknown>;
  masukDariSesiSipp?: (manual: boolean) => Promise<unknown>;
  derry?: unknown;
  sesi?: Record<string, string>;
};

const SIAPA_HAKIM = {
  status: 200,
  data: { id: "u1", nama: "Derry Briantono", peran: "Hakim", roleId: "hakim", peranTambahan: [], golonganMenu: ["hakim"], bolehKasir: false },
};
const SIAPA_KASIR = {
  status: 200,
  data: { id: "u2", nama: "Kasir Uji", peran: "Kasir", roleId: "kasir", peranTambahan: [], golonganMenu: ["kasir"], bolehKasir: true },
};
const BELUM_MASUK = { status: 401, data: { error: { message: "Belum masuk" } } };

function bukaHalaman(o: Opsi = {}): Hasil {
  const dom = new JSDOM(o.html ?? halamanSipp(), { url: o.alamat ?? SIPP, runScripts: "outside-only" });
  terbuka.push(dom);
  const w = dom.window as any;
  const h: Hasil = { w, d: w.document, pesan: [], fetchLog: [], lokal: { ...(o.lokal || {}) }, tombolDitekan: 0, alih: [], open: [] };
  void h.alih;
  if (o.saklar === false) h.lokal.menuAtasSipp = false;
  const dengar: Array<(u: any, wil: string) => void> = [];
  w.chrome = {
    runtime: {
      id: "aleta-uji",
      lastError: undefined,
      sendMessage: (p: any, balik?: (j: unknown) => void) => {
        h.pesan.push(p);
        if (balik) setTimeout(() => balik(p.jenis === "menu-buka-tab" ? { ok: true } : undefined), 0);
      },
    },
    storage: {
      local: {
        get: async (k?: string | string[]) => {
          const daftar = k == null ? Object.keys(h.lokal) : [k].flat();
          const r: Record<string, unknown> = {};
          for (const x of daftar) if (x in h.lokal) r[x] = JSON.parse(JSON.stringify(h.lokal[x]));
          return r;
        },
        set: async (isi: Record<string, unknown>) => {
          const ubah: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(isi)) {
            ubah[k] = { newValue: v };
            h.lokal[k] = JSON.parse(JSON.stringify(v));
          }
          for (const f of dengar) f(ubah, "local");
        },
        remove: async (k: string | string[]) => {
          for (const x of [k].flat()) delete h.lokal[x];
        },
      },
      onChanged: { addListener: (f: any) => dengar.push(f) },
    },
  };
  w.fetch = async (url: string, opsi?: unknown) => {
    h.fetchLog.push({ url: String(url), opsi });
    const s = String(url).includes("/ekstensi/siapa") ? o.siapa || SIAPA_HAKIM : { status: 404, data: {} };
    return { ok: s.status >= 200 && s.status < 300, status: s.status, json: async () => ({ ok: s.status < 300, data: s.data }) };
  };
  w.open = (...a: unknown[]) => (h.open.push(a), null);
  for (const [k, v] of Object.entries(o.sesi || {})) w.sessionStorage.setItem(k, v);
  if (o.masukDariSesiSipp) w.masukAletaDariSesiSipp = o.masukDariSesiSipp;
  if (o.derry !== undefined) w.aletaBlangkoDerry = o.derry;
  // Penekanan tombol masuk ABT dihitung: ekstensi tidak boleh menekannya.
  w.document.addEventListener("submit", () => (h.tombolDitekan += 1), true);
  w.document.addEventListener("click", (e: any) => {
    if (e.target && e.target.type === "submit") h.tombolDitekan += 1;
  }, true);
  w.eval(SUMBER);
  return h;
}

const butir = (d: Document) => Array.from(d.querySelectorAll("#cssmenu > ul > li")).map((li) => (li.querySelector(":scope > a")!.childNodes[0].textContent || "").trim());
const teksKabar = (d: Document) => (d.querySelector(".aleta-menu-kabar")?.textContent || "").trim();

// ============================================================================
describe("bilah atas SIPP: urutan, bentuk, dan tidak ganda", () => {
  it("ABT By Derry dan ALETA tepat sesudah Perdata, sebelum Jinayat; butir lain tak bergeser", async () => {
    const h = bukaHalaman();
    await sampai(() => butir(h.d).includes("ABT By Derry"), "butir terpasang");
    const urut = butir(h.d);
    const i = urut.indexOf("Perdata");
    expect(urut.slice(i, i + 5)).toEqual(["Perdata", "ABT By Derry", "ALETA", "E-Court", "Jinayat"]);
    expect(urut.filter((x) => !["ABT By Derry", "ALETA", "E-Court"].includes(x))).toEqual(MENU_SIPP);
    // butir "e-Court" milik SIPP sendiri tetap ada dan tidak tertukar dengan "E-Court" kita
    expect(urut.filter((x) => x === "e-Court").length).toBe(1);
  });

  it("bentuknya SAMA dengan butir SIPP: li.has-sub > a + ul kosong, tanpa kelas/gaya ALETA di tautan", async () => {
    const h = bukaHalaman();
    await sampai(() => h.d.querySelector('li[data-aleta-menu="abt"]'), "butir abt");
    const asli = h.d.querySelector("#cssmenu > ul > li:not([data-aleta-menu])") as HTMLElement;
    for (const kode of ["abt", "aleta"]) {
      const li = h.d.querySelector(`li[data-aleta-menu="${kode}"]`) as HTMLElement;
      expect(li.tagName).toBe("LI");
      expect(li.parentElement).toBe(asli.parentElement);
      expect(li.classList.contains("has-sub")).toBe(true);
      expect(Array.from(li.children).map((c) => c.tagName)).toEqual(["A", "UL"]);
      expect(li.querySelector("ul")!.children.length).toBe(0);
      const a = li.querySelector("a")!;
      expect(a.getAttribute("style")).toBeNull();
      expect(a.className).toBe("");
      expect(li.getAttribute("style")).toBeNull();
    }
    // tidak menyentuh submenu SIPP
    const perdata = Array.from(h.d.querySelectorAll("#cssmenu > ul > li")).find((li) => li.textContent!.startsWith("Perdata"))!;
    expect(Array.from(perdata.querySelectorAll(":scope > ul > li > a")).map((a) => a.textContent)).toEqual(["Gugatan", "Permohonan", "Verzet"]);
  });

  it("tidak ganda: dipasang berulang dan SIPP menggambar ulang bilahnya -> tetap satu pasang di tempat yang benar", async () => {
    const h = bukaHalaman();
    await sampai(() => butir(h.d).includes("ALETA"), "terpasang");
    const api = h.w.aletaMenuAtas;
    api.pasangMenu(h.d, {});
    api.pasangMenu(h.d, {});
    expect(h.d.querySelectorAll('li[data-aleta-menu]').length).toBe(3);
    // SIPP memuat ulang sebagian halaman: bilah diganti utuh (butir kita hilang)
    h.d.getElementById("cssmenu")!.outerHTML = bilahSipp();
    expect(h.d.querySelectorAll('li[data-aleta-menu]').length).toBe(0);
    await sampai(() => h.d.querySelectorAll('li[data-aleta-menu]').length === 3, "dipasang ulang oleh pengamat");
    await tunggu(300);
    const urut = butir(h.d);
    const i = urut.indexOf("Perdata");
    expect(urut.slice(i, i + 5)).toEqual(["Perdata", "ABT By Derry", "ALETA", "E-Court", "Jinayat"]);
    expect(h.d.querySelectorAll('li[data-aleta-menu]').length).toBe(3);
  });

  it("tanpa Perdata di akun itu: disisipkan sebelum Jinayat; halaman tanpa bilah (masuk SIPP): tidak ada yang ditambahkan", async () => {
    const h = bukaHalaman({ html: halamanSipp(["Perdata"]) });
    await sampai(() => butir(h.d).includes("ALETA"), "terpasang");
    const urut = butir(h.d);
    expect(urut.slice(urut.indexOf("ABT By Derry"), urut.indexOf("ABT By Derry") + 3)).toEqual(["ABT By Derry", "ALETA", "E-Court"]);
    expect(urut[urut.indexOf("E-Court") + 1]).toBe("Jinayat");
    const masuk = bukaHalaman({ html: `<!doctype html><html><body><div id="cssmenu" style="height:15px;"></div></body></html>` });
    await tunggu(150);
    expect(masuk.d.querySelectorAll("[data-aleta-menu]").length).toBe(0);
  });

  it("ALETA: tautan biasa ke portal (basePath /aleta), tab baru, tanpa JS tambahan", async () => {
    const h = bukaHalaman();
    await sampai(() => h.d.querySelector('li[data-aleta-menu="aleta"] a'), "butir aleta");
    const a = h.d.querySelector('li[data-aleta-menu="aleta"] a') as HTMLAnchorElement;
    expect(a.getAttribute("href")).toBe(`${ASAL}/aleta`);
    expect(a.target).toBe("_blank");
    expect(a.rel).toContain("noopener");
  });

  it("SIPP setempat (127.0.0.1/index.php) juga dikenali dan menghormati asalnya", async () => {
    const h = bukaHalaman({ alamat: "http://127.0.0.1/index.php/home" });
    await sampai(() => h.d.querySelector('li[data-aleta-menu="aleta"] a'), "butir aleta");
    expect((h.d.querySelector('li[data-aleta-menu="aleta"] a') as HTMLAnchorElement).getAttribute("href")).toBe("http://127.0.0.1/aleta");
  });
});

// ============================================================================
describe("saklar di popup mematikan butir", () => {
  it("mati: tidak ada butir sama sekali; dinyalakan dari popup (tanpa muat ulang) butir muncul, dimatikan hilang", async () => {
    const h = bukaHalaman({ saklar: false });
    await tunggu(200);
    expect(h.d.querySelectorAll("[data-aleta-menu]").length).toBe(0);
    expect(butir(h.d)).toEqual(MENU_SIPP);
    await h.w.chrome.storage.local.set({ menuAtasSipp: true });
    await sampai(() => h.d.querySelectorAll("[data-aleta-menu]").length === 3, "menyala");
    await h.w.chrome.storage.local.set({ menuAtasSipp: false });
    await sampai(() => h.d.querySelectorAll("[data-aleta-menu]").length === 0, "padam");
    expect(butir(h.d)).toEqual(MENU_SIPP);
  });

  it("bawaan MENYALA (kunci belum pernah ditulis)", async () => {
    const h = bukaHalaman();
    await sampai(() => h.d.querySelectorAll("[data-aleta-menu]").length === 3, "menyala");
    expect(h.lokal.menuAtasSipp).toBeUndefined();
  });
});

// ============================================================================
describe("klik ABT By Derry di SIPP", () => {
  const klik = async (h: Hasil) => {
    await sampai(() => h.d.querySelector('li[data-aleta-menu="abt"] a'), "butir abt");
    (h.d.querySelector('li[data-aleta-menu="abt"] a') as HTMLElement).click();
  };
  const bukaTab = (h: Hasil) => h.pesan.filter((p) => p.jenis === "menu-buka-tab");

  it("belum masuk ALETA: pesan 'Masuk ke ALETA dulu' + tautan masuk, ABT TIDAK dibuka", async () => {
    const h = bukaHalaman({ siapa: BELUM_MASUK });
    await klik(h);
    await sampai(() => teksKabar(h.d), "pesan tampil");
    expect(teksKabar(h.d)).toContain("Masuk ke ALETA dulu");
    const tautan = h.d.querySelector(".aleta-menu-kabar a") as HTMLAnchorElement;
    expect(tautan.getAttribute("href")).toBe(`${ASAL}/aleta/login`);
    expect(bukaTab(h)).toEqual([]);
    expect(h.open).toEqual([]);
  });

  it("belum masuk ALETA tetapi sesi SIPP terbuka: dicoba masuk lewat sesi SIPP (tanpa sandi), lalu ABT dibuka", async () => {
    let masuk = false;
    const h = bukaHalaman({
      siapa: BELUM_MASUK,
      masukDariSesiSipp: async (manual) => {
        expect(manual).toBe(true);
        masuk = true;
        return { jenis: "masuk" };
      },
    });
    // setelah masuk lewat sesi SIPP, jawaban siapa berubah
    const asli = h.w.fetch;
    h.w.fetch = async (u: string, o: unknown) => (masuk && String(u).includes("/ekstensi/siapa") ? { ok: true, status: 200, json: async () => ({ data: SIAPA_HAKIM.data }) } : asli(u, o));
    await klik(h);
    await sampai(() => bukaTab(h).length === 1, "tab dibuka");
    expect(masuk).toBe(true);
    expect(bukaTab(h)[0].tujuan).toBe("abt");
  });

  it("sesi SIPP tak dapat dipakai masuk: tetap pesan, ABT tidak dibuka", async () => {
    const h = bukaHalaman({ siapa: BELUM_MASUK, masukDariSesiSipp: async () => ({ jenis: "ragu" }) });
    await klik(h);
    await sampai(() => teksKabar(h.d), "pesan");
    expect(teksKabar(h.d)).toContain("Masuk ke ALETA dulu");
    expect(bukaTab(h)).toEqual([]);
  });

  it("sudah masuk ALETA dan berhak: tab ABT dibuka lewat pekerja latar (tujuan abt), tanpa sandi dalam pesan", async () => {
    const h = bukaHalaman({ siapa: SIAPA_HAKIM });
    await klik(h);
    await sampai(() => bukaTab(h).length === 1, "tab dibuka");
    expect(bukaTab(h)[0]).toEqual({ sumber: "aleta-panel", jenis: "menu-buka-tab", tujuan: "abt" });
    expect(JSON.stringify(h.pesan).toLowerCase()).not.toMatch(/sandi|password/);
    expect(teksKabar(h.d)).toBe("");
  });

  it("ALETA tak terjangkau: pesan sopan, tidak membuka apa pun", async () => {
    const h = bukaHalaman({ siapa: { status: 500 } });
    await klik(h);
    await sampai(() => teksKabar(h.d), "pesan");
    expect(teksKabar(h.d)).toContain("ALETA belum dapat dihubungi");
    expect(bukaTab(h)).toEqual([]);
  });
});

// ============================================================================
describe("hak: peran tanpa Blangko Derry tidak melihat ABT By Derry", () => {
  it("akun kasir: ABT By Derry hilang dari bilah, ALETA tetap", async () => {
    const h = bukaHalaman({ siapa: SIAPA_KASIR });
    await sampai(() => h.d.querySelector('li[data-aleta-menu="aleta"]'), "terpasang");
    await sampai(() => !h.d.querySelector('li[data-aleta-menu="abt"]'), "abt disembunyikan");
    expect(butir(h.d)).toContain("ALETA");
    expect(butir(h.d)).not.toContain("ABT By Derry");
    expect(JSON.parse(h.w.sessionStorage.getItem("aletaMenuAtasHak")).abt).toBe(false);
  });

  it("hakim, panitera pengganti, jurusita, PTSP, dan admin berhak; kasir dan lainnya tidak", async () => {
    const { bolehDerry } = (bukaHalaman().w as any).aletaMenuAtas.murni;
    const d = (golonganMenu: string[], roleId = "x") => bolehDerry({ roleId, peran: roleId, golonganMenu });
    expect(d(["hakim"])).toBe(true);
    expect(d(["pp"])).toBe(true);
    expect(d(["panitera"])).toBe(true);
    expect(d(["jurusita"])).toBe(true);
    expect(d(["ptsp"])).toBe(true);
    expect(d(["admin"])).toBe(true);
    expect(d([], "super-admin")).toBe(true);
    expect(d(["kasir"])).toBe(false);
    expect(d([])).toBe(false);
    expect(bolehDerry(null)).toBe(false);
  });

  it("akun belum diketahui (belum masuk ALETA): butir tetap tampil supaya pesan masuk bisa muncul", async () => {
    const h = bukaHalaman({ siapa: BELUM_MASUK });
    await sampai(() => h.d.querySelector('li[data-aleta-menu="abt"]'), "terpasang");
    await tunggu(150);
    expect(h.d.querySelector('li[data-aleta-menu="abt"]')).toBeTruthy();
  });

  it("klik oleh akun tanpa hak (hak berubah di server): pesan, butir dibuang, ABT tidak dibuka", async () => {
    const h = bukaHalaman({ siapa: SIAPA_HAKIM });
    await sampai(() => h.d.querySelector('li[data-aleta-menu="abt"] a'), "butir");
    await tunggu(100);
    h.w.sessionStorage.removeItem("aletaMenuAtasHak");
    const asli = h.w.fetch;
    h.w.fetch = async (u: string, o: unknown) => (String(u).includes("/ekstensi/siapa") ? { ok: true, status: 200, json: async () => ({ data: SIAPA_KASIR.data }) } : asli(u, o));
    (h.d.querySelector('li[data-aleta-menu="abt"] a') as HTMLElement).click();
    await sampai(() => teksKabar(h.d), "pesan");
    expect(teksKabar(h.d)).toContain("tidak memakai Blangko ABT by Derry");
    expect(h.pesan.filter((p) => p.jenis === "menu-buka-tab")).toEqual([]);
    expect(h.d.querySelector('li[data-aleta-menu="abt"]')).toBeNull();
  });
});

// ============================================================================
describe("di ABT: niat, catatan di halaman masuk, arahan sesudah masuk, tanpa sandi", () => {
  const ALAMAT_ABT_DERRY = `${ASAL}/aps_badilag/abt/main/beranda#aleta-derry=1`;

  it("ABT belum masuk (halaman masuk, hash ikut): catatan tampil, niat tersimpan, kolom & tombol masuk TIDAK disentuh", async () => {
    const h = bukaHalaman({ html: HALAMAN_MASUK_ABT, alamat: `${ASAL}/aps_badilag/login#aleta-derry=1` });
    await sampai(() => h.d.querySelector(".aleta-menu-catatan"), "catatan");
    expect(h.d.querySelector(".aleta-menu-catatan")!.textContent).toContain("Masuk dengan akun SIPP Anda");
    expect(h.d.querySelector(".aleta-menu-catatan")!.textContent).toContain("Blangko ABT by Derry Briantono terbuka sendiri");
    expect(typeof h.lokal.menuAtasNiatDerry.saat).toBe("number");
    expect(Object.keys(h.lokal.menuAtasNiatDerry)).toEqual(["saat"]);
    expect((h.d.querySelector('input[name="userName"]') as HTMLInputElement).value).toBe("");
    expect((h.d.querySelector('input[name="password"]') as HTMLInputElement).value).toBe("");
    expect(h.tombolDitekan).toBe(0);
    expect(h.pesan).toEqual([]);
    expect(JSON.stringify(h.lokal).toLowerCase()).not.toMatch(/sandi|password/);
    // tidak ada permintaan jaringan apa pun dari halaman masuk
    expect(h.fetchLog).toEqual([]);
  });

  it("sesudah pengguna masuk sendiri dan tiba di menu APS: diarahkan ke Blangko ABT by Derry, niat dihabiskan", async () => {
    const h = bukaHalaman({ html: HALAMAN_APS, alamat: `${ASAL}/aps_badilag/`, lokal: { menuAtasNiatDerry: { saat: Date.now() - 20000 } } });
    await sampai(() => h.w.location.href !== `${ASAL}/aps_badilag/` || !h.lokal.menuAtasNiatDerry, "niat dihabiskan", 1500);
    expect(h.lokal.menuAtasNiatDerry).toBeUndefined();
    // jsdom tidak mengikuti navigasi: yang dibuktikan alamat tujuan lewat api murni
    expect(h.w.aletaMenuAtas.murni.alamatAbtDerry(h.w.location)).toBe(ALAMAT_ABT_DERRY);
  });

  it("arahan memanggil location.replace ke alamat Blangko ABT by Derry (bukan ke halaman lain)", async () => {
    const h = bukaHalaman({ html: HALAMAN_APS, alamat: `${ASAL}/aps_badilag/`, lokal: { menuAtasNiatDerry: { saat: Date.now() - 1000 } } });
    const alih: string[] = [];
    const hasil = await h.w.aletaMenuAtas.terimaDiAbt({ alih: (u: string) => alih.push(u) });
    expect(hasil.aksi).toBe("alih");
    expect(alih).toEqual([ALAMAT_ABT_DERRY]);
    expect(h.lokal.menuAtasNiatDerry).toBeUndefined();
  });

  it("niat basi (lebih dari 5 menit) tidak mengarahkan siapa pun", async () => {
    const h = bukaHalaman({ html: HALAMAN_APS, alamat: `${ASAL}/aps_badilag/`, lokal: { menuAtasNiatDerry: { saat: Date.now() - 6 * 60 * 1000 } } });
    const alih: string[] = [];
    const hasil = await h.w.aletaMenuAtas.terimaDiAbt({ alih: (u: string) => alih.push(u) });
    expect(hasil.aksi).toBe("tidak-ada-niat");
    expect(alih).toEqual([]);
  });

  it("tanpa niat dan tanpa hash: ABT tidak disentuh sama sekali", async () => {
    const h = bukaHalaman({ html: HALAMAN_APS, alamat: `${ASAL}/aps_badilag/` });
    const hasil = await h.w.aletaMenuAtas.terimaDiAbt({ alih: () => { throw new Error("tidak boleh"); } });
    expect(hasil.aksi).toBe("tidak-ada-niat");
    expect(h.d.body.innerHTML).toBe(new JSDOM(HALAMAN_APS).window.document.body.innerHTML);
  });

  it("arahan beruntun dibatasi (dua kali per dua menit) supaya tidak memutar tanpa henti", async () => {
    const h = bukaHalaman({ html: HALAMAN_APS, alamat: `${ASAL}/aps_badilag/` });
    const api = h.w.aletaMenuAtas;
    const alih: string[] = [];
    for (let i = 0; i < 3; i += 1) {
      await h.w.chrome.storage.local.set({ menuAtasNiatDerry: { saat: Date.now() } });
      await api.terimaDiAbt({ alih: (u: string) => alih.push(u) });
    }
    expect(alih.length).toBe(2);
    expect(teksKabar(h.d)).toContain("belum dapat dibuka dari halaman ini");
  });

  it("sudah masuk ABT (halaman aplikasi, hash ikut): hash dihapus, Blangko Derry dibuka, catatan akun ABT ditampilkan", async () => {
    const toast: string[] = [];
    let dibuka = 0;
    let aktif = false;
    const derry = {
      keadaan: () => ({ aktif }),
      siapa: () => ({ nama: "Derry" }),
      buka: () => {
        dibuka += 1;
        aktif = true;
      },
      toast: (t: string) => toast.push(t),
    };
    const h = bukaHalaman({ html: HALAMAN_ABT, alamat: ALAMAT_ABT_DERRY, derry });
    await sampai(() => dibuka === 1, "Blangko Derry dibuka");
    await sampai(() => toast.length === 1, "catatan akun");
    expect(h.w.location.hash).toBe("");
    expect(toast[0]).toContain("derry.briantono");
    expect(toast[0]).toContain("Blangko ABT by Derry Briantono dibuka");
    expect(h.lokal.menuAtasNiatDerry).toBeUndefined();
    expect(h.tombolDitekan).toBe(0);
  });

  it("akun ABT tanpa grup Blangko Derry: pesan jelas, tidak berputar", async () => {
    const html = HALAMAN_ABT.replace("Blangko Derry (Daftar s.d. Produk)", "Gugatan");
    const h = bukaHalaman({ html, alamat: ALAMAT_ABT_DERRY, derry: { keadaan: () => ({ aktif: false }), siapa: () => ({}), buka: () => {}, toast: () => {} } });
    const hasil = await h.w.aletaMenuAtas.bukaDerryDiAbt({ tanpaDerryMs: 0, batasMs: 800, detakMs: 5 });
    expect(hasil).toEqual({ ok: false, sebab: "tanpa-derry" });
  });

  it("akun ALETA belum masuk di ABT: pesan + tautan masuk, bukan galat teknis", async () => {
    // Halaman dibuka TANPA hash (pemuatan otomatis tidak berbuat apa-apa); hash disuntikkan lewat loc.
    const h = bukaHalaman({ html: HALAMAN_ABT, alamat: `${ASAL}/aps_badilag/abt/main/beranda`, derry: { keadaan: () => ({ aktif: false }), siapa: () => null, buka: () => {}, toast: () => {} } });
    const loc = { origin: ASAL, pathname: "/aps_badilag/abt/main/beranda", search: "", hash: "#aleta-derry=1" };
    const hasil = await h.w.aletaMenuAtas.terimaDiAbt({ loc, batasMs: 300, detakMs: 5, tanpaDerryMs: 0 });
    expect(hasil).toMatchObject({ aksi: "gagal", sebab: "belum-masuk" });
    expect(teksKabar(h.d)).toContain("Masuk ke ALETA dulu");
    expect((h.d.querySelector(".aleta-menu-kabar a") as HTMLAnchorElement).getAttribute("href")).toBe(`${ASAL}/aleta/login`);
  });

  it("berkas ini tidak pernah mengisi sandi, menekan tombol masuk, atau menyimpan sandi", () => {
    const tanpaKomentar = SUMBER.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(tanpaKomentar).not.toMatch(/\.click\(\)/);
    expect(tanpaKomentar).not.toMatch(/requestSubmit|\.submit\(/);
    expect(tanpaKomentar).not.toMatch(/\.value\s*=/);
    expect(tanpaKomentar).not.toMatch(/input\[name="password"\][^;]*\.(value|focus)/);
    expect(tanpaKomentar).not.toMatch(/storage\.(local|session)\.set\(\{[^}]*(sandi|password)/i);
    // satu-satunya isian yang dibaca dari halaman masuk ABT adalah keberadaan kolom
    expect(tanpaKomentar).not.toMatch(/userName"\]\)\.value/);
  });
});

// ============================================================================
describe("pekerja latar: tab baru disusun dari asal halaman pengirim", () => {
  const SIPP_PENGIRIM = { url: `${ASAL}/SIPP/index.php/home`, origin: ASAL, frameId: 0 };
  const siapkan = () => {
    const dunia = new Dunia(() => jawaban(404, "", ""));
    const pekerja = nyalakan(dunia);
    const dibuat: any[] = [];
    pekerja.konteks.chrome.tabs = { create: async (o: any) => (dibuat.push(o), { id: 7 }) };
    return { dunia, pekerja, dibuat };
  };

  it("abt dan aleta: alamat disusun di latar dari asal SIPP, bukan dari isi pesan", async () => {
    const { dunia, pekerja, dibuat } = siapkan();
    expect(await minta(dunia, pekerja, { jenis: "menu-buka-tab", tujuan: "abt", url: "http://jahat.example/" }, SIPP_PENGIRIM)).toMatchObject({ ok: true });
    expect(await minta(dunia, pekerja, { jenis: "menu-buka-tab", tujuan: "aleta" }, SIPP_PENGIRIM)).toMatchObject({ ok: true });
    expect(dibuat.map((o) => o.url)).toEqual([`${ASAL}/aps_badilag/abt/main/beranda#aleta-derry=1`, `${ASAL}/aleta`]);
  });

  it("menolak tujuan lain, pengirim bukan SIPP, dan bingkai bukan teratas", async () => {
    const { dunia, pekerja, dibuat } = siapkan();
    expect((await minta(dunia, pekerja, { jenis: "menu-buka-tab", tujuan: "http://jahat.example/" }, SIPP_PENGIRIM)).ok).toBe(false);
    expect((await minta(dunia, pekerja, { jenis: "menu-buka-tab", tujuan: "abt" }, { url: "https://situs.example/SIPP/x", frameId: 0 })).ok).toBe(false);
    expect((await minta(dunia, pekerja, { jenis: "menu-buka-tab", tujuan: "abt" }, { url: `${ASAL}/aleta/portal`, frameId: 0 })).ok).toBe(false);
    expect((await minta(dunia, pekerja, { jenis: "menu-buka-tab", tujuan: "abt" }, { ...SIPP_PENGIRIM, frameId: 3 })).ok).toBe(false);
    expect(dibuat).toEqual([]);
  });
});

// ============================================================================
describe("pendaftaran: manifest, popup, dan latar", () => {
  it("menu-atas.js dimuat di SIPP dan ABT (tidak di portal ALETA)", () => {
    const grup = (cocok: string) => MANIFEST.content_scripts.filter((c: any) => (c.js || []).includes("menu-atas.js") && c.matches.some((m: string) => m.includes(cocok)));
    expect(grup("/SIPP/").length).toBe(1);
    expect(grup("/aps_badilag/").length).toBe(1);
    expect(grup("/aleta/").length).toBe(0);
  });

  it("saklar menuAtasSipp terdaftar di popup (bawaan menyala, bagian SIPP) dan di daftar kunci per akun latar.js", () => {
    const html = baca("popup.html");
    expect(html).toMatch(/<input type="checkbox" id="menuAtasSipp" checked>/);
    expect(baca("popup.js")).toMatch(/menuAtasSipp: \["menuAtasSipp", true\]/);
    expect(baca("popup.js")).toMatch(/"pratinjauBasRelaas", "menuAtasSipp"/);
    expect(baca("latar.js")).toContain('"menuAtasSipp"');
    expect(baca("popup.js")).toMatch(/menuAtasSipp: true,/);
  });

  it("tanpa tanda ALETA di nilai form/DB: berkas tidak menulis ke isian apa pun", () => {
    const tanpaKomentar = SUMBER.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(tanpaKomentar).not.toMatch(/\.value\s*=|\.append\(["']|FormData|method:\s*["'](POST|PUT|PATCH|DELETE)/);
  });
});
