// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

import { GalatSetelan, KUNCI_SETELAN, normalkanSetelan } from "@/lib/tampilan-ekstensi";

/**
 * ============================================================================
 * PERBAIKAN 1 OKT 2026 - AGEN W (bersama)
 * ============================================================================
 *
 *   K2 / butir 1  lipat seragam: alatLipat + alatJadikanLipat (panel-alat.js)
 *                 dan rupanya di blok W1 panel.css (UI Baru saja).
 *   butir 7       widget Checklist milestone: tiap bagian dapat dilipat,
 *                 disembunyikan, diubah tingginya, diurutkan, dan DIPISAH
 *                 menjadi jendela melayang - tersimpan per AKUN di server
 *                 (setelan "widget.tata"), cadangan lokal, tunduk latihan/kering.
 *
 * Kode SUNGGUHAN dijalankan di jsdom: panel-alat.js utuh, satu konteks vm per
 * halaman, chrome.storage tiruan.
 */

const EKSTENSI = path.resolve(process.cwd(), "../ekstensi-sipp");
const baca = (berkas: string) => readFileSync(berkas, "utf8").replace(/\r\n/g, "\n");
const SUMBER_ALAT = baca(process.env.ALETA_UJI_ALAT || path.join(EKSTENSI, "panel-alat.js"));
const CSS = baca(path.join(EKSTENSI, "panel.css"));
const SUMBER_CHECKLIST = baca(process.env.ALETA_UJI_CHECKLIST || path.join(EKSTENSI, "checklist.js"));
const SUMBER_PORTAL = baca(path.join(EKSTENSI, "aleta.js"));

type JsdomUji = JSDOM & { getInternalVMContext(): vm.Context };
type OpsiJsdom = NonNullable<ConstructorParameters<typeof JSDOM>[1]> & { pretendToBeVisual?: boolean };
function jsdomUji(url: string): JsdomUji {
  const opsi: OpsiJsdom = { url, runScripts: "outside-only", pretendToBeVisual: true };
  return new JSDOM(`<!doctype html><html><head></head><body></body></html>`, opsi) as JsdomUji;
}
type Ubah = Record<string, { oldValue?: unknown; newValue?: unknown }>;
const polos = <T>(x: T): T => (x === undefined ? x : JSON.parse(JSON.stringify(x)));
const tunggu = (ms = 0) => new Promise((r) => setTimeout(r, ms));

async function sampai<T>(periksa: () => T, keterangan: string, batas = 3000): Promise<NonNullable<T>> {
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

function penyimpanan(awal: Record<string, unknown>) {
  const simpanan: Record<string, unknown> = polos(awal);
  const pendengar: Array<(ubah: Ubah, wilayah: string) => void> = [];
  const tulisan: string[] = [];
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
      setTimeout(() => {
        for (const f of [...pendengar]) f(polos(ubah), "local");
      }, 0);
    },
    remove: async () => undefined,
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

const terbuka: JSDOM[] = [];
afterEach(async () => {
  await tunggu(20);
  while (terbuka.length) terbuka.pop()!.window.close();
});

function halaman(p: { simpanan?: Record<string, unknown>; alamat?: string; jawab?: (url: string) => unknown } = {}) {
  const dom = jsdomUji(p.alamat ?? "http://192.168.10.10/SIPP/detil_perkara_agama");
  terbuka.push(dom);
  const w = dom.window as any;
  const { simpanan, tulisan, storage } = penyimpanan(p.simpanan ?? {});
  w.chrome = {
    runtime: { id: "aleta-uji", getManifest: () => ({ version: "0.0.0" }), getURL: (x: string) => x, sendMessage: async () => ({}) },
    storage,
  };
  const cara: Array<{ url: string; cara: string; badan?: string }> = [];
  w.fetch = (alamat: string, opsi?: { method?: string; body?: string }) => {
    cara.push({ url: String(alamat), cara: String((opsi && opsi.method) || "GET").toUpperCase(), badan: opsi && opsi.body });
    const isi = (p.jawab && p.jawab(String(alamat))) || { ok: true, data: {} };
    const r = { ok: true, status: 200, json: async () => polos(isi), clone: () => r };
    return Promise.resolve(r);
  };
  vm.runInContext(SUMBER_ALAT, dom.getInternalVMContext(), { filename: "panel-alat.js" });
  return { dom, w, d: w.document as Document, simpanan, tulisan, cara };
}

// ============================================================================
describe("K2 alatLipat - satu bentuk lipat baru", () => {
  it("struktur dan aria: akar .aleta-lipatan, kepala tombol ber-aria, isi region", async () => {
    const h = halaman();
    const l = h.w.alatLipat("Putusan otomatis", { kunci: "uji:putusan", lencana: { teks: "2 perlu dicek", nada: "mendesak" } });
    h.d.body.appendChild(l.akar);
    expect(l.akar.tagName).toBe("SECTION");
    expect(l.akar.className).toBe("aleta-lipatan");
    // Kelas akar BUKAN aleta-lipat: itu tombol "–" di kepala panel sejak lama.
    expect(l.akar.classList.contains("aleta-lipat")).toBe(false);
    expect(l.akar.getAttribute("data-kunci")).toBe("uji:putusan");
    expect(l.kepala.tagName).toBe("BUTTON");
    expect(l.kepala.type).toBe("button");
    expect(l.kepala.className).toBe("aleta-lipat-kepala");
    expect(l.kepala.getAttribute("aria-expanded")).toBe("true");
    expect(l.kepala.getAttribute("aria-controls")).toBe(l.isi.id);
    expect(l.isi.getAttribute("role")).toBe("region");
    expect(l.isi.getAttribute("aria-labelledby")).toBe(l.kepala.id);
    expect(l.isi.className).toBe("aleta-lipat-isi");
    // Panah tanpa teks: textContent kepala = judul + lencana saja.
    expect(l.kepala.querySelector(".aleta-lipat-panah").textContent).toBe("");
    expect(l.kepala.querySelector(".aleta-lipat-panah").getAttribute("aria-hidden")).toBe("true");
    expect(l.kepala.textContent).toBe("Putusan otomatis2 perlu dicek");
    expect(l.kepala.querySelector(".aleta-lipat-lencana").getAttribute("data-nada")).toBe("mendesak");
    expect(l.terbuka()).toBe(true);

    l.kepala.click();
    expect(l.terbuka()).toBe(false);
    expect(l.isi.hidden).toBe(true);
    expect(l.akar.getAttribute("data-terbuka")).toBe("tidak");
    expect(l.kepala.getAttribute("aria-expanded")).toBe("false");
    l.buka(true);
    expect(l.isi.hidden).toBe(false);
    l.setelLencana("");
    expect(l.kepala.querySelector(".aleta-lipat-lencana").hidden).toBe(true);
  });

  it("ingat buka/tutup per kunci di lipatTerbuka; halaman berikutnya memulihkannya", async () => {
    const h = halaman();
    const l = h.w.alatLipat("A", { kunci: "uji:a" });
    l.kepala.click();
    await sampai(() => (h.simpanan.lipatTerbuka as any)?.["uji:a"] === false, "tersimpan");
    const tanpaKunci = h.w.alatLipat("B", {});
    tanpaKunci.kepala.click();
    const tanpaIngat = h.w.alatLipat("C", { kunci: "uji:c", ingat: false });
    tanpaIngat.kepala.click();
    await tunggu(20);
    expect(Object.keys(h.simpanan.lipatTerbuka as object)).toEqual(["uji:a"]);

    // Halaman baru: bagian yang lahir SEBELUM bacaan selesai menyesuaikan diri.
    const h2 = halaman({ simpanan: { lipatTerbuka: { "uji:a": false, "uji:b": true } } });
    const a = h2.w.alatLipat("A", { kunci: "uji:a" });
    const b = h2.w.alatLipat("B", { kunci: "uji:b", terbuka: false });
    await sampai(() => a.terbuka() === false && b.terbuka() === true, "dipulihkan");
    expect(h2.tulisan.filter((k) => k === "lipatTerbuka")).toEqual([]);
    // Sesudah bacaan selesai: langsung lahir dalam keadaan yang diingat.
    const a2 = h2.w.alatLipat("A", { kunci: "uji:a" });
    expect(a2.terbuka()).toBe(false);
  });

  it("disentuh sebelum bacaan kembali: pilihan orang menang atas ingatan", async () => {
    const h = halaman({ simpanan: { lipatTerbuka: { "uji:a": false } } });
    const a = h.w.alatLipat("A", { kunci: "uji:a" });
    a.kepala.click(); // terbuka -> tertutup sebelum bacaan
    a.kepala.click(); // tertutup -> terbuka
    await tunggu(30);
    expect(a.terbuka()).toBe(true);
    await sampai(() => (h.simpanan.lipatTerbuka as any)["uji:a"] === true, "pilihan orang tersimpan");
  });

  it("ingatan dibatasi: kunci tertua dibuang", async () => {
    const awal: Record<string, boolean> = {};
    for (let i = 0; i < 400; i++) awal[`k${i}`] = true;
    const h = halaman({ simpanan: { lipatTerbuka: awal } });
    await h.w.alatMuatLipat();
    h.w.alatLipat("baru", { kunci: "baru" }).kepala.click();
    await sampai(() => (h.simpanan.lipatTerbuka as any).baru === false, "tersimpan");
    const k = Object.keys(h.simpanan.lipatTerbuka as object);
    expect(k.length).toBe(400);
    expect(k).not.toContain("k0");
    expect(k[k.length - 1]).toBe("baru");
  });
});

// ============================================================================
describe("K2 alatJadikanLipat - bagian lama diberi rupa yang sama", () => {
  it("<details>: summary jadi kepala, buka/tutup tetap milik peramban, diingat bila berkunci", async () => {
    const h = halaman({ simpanan: { lipatTerbuka: { "uji:rinci": true } } });
    await h.w.alatMuatLipat();
    const rinci = h.d.createElement("details");
    rinci.innerHTML = "<summary>Rincian relaas</summary><p>isi</p>";
    h.d.body.appendChild(rinci);
    const p = h.w.alatJadikanLipat(rinci, { kunci: "uji:rinci" });
    expect(p.asal).toBe("details");
    expect(rinci.classList.contains("aleta-lipatan")).toBe(true);
    expect(rinci.querySelector("summary")!.classList.contains("aleta-lipat-kepala")).toBe(true);
    expect(rinci.querySelector("summary")!.textContent).toBe("Rincian relaas");
    expect(rinci.open).toBe(true);
    expect(rinci.getAttribute("data-terbuka")).toBe("ya");
    rinci.open = false;
    rinci.dispatchEvent(new h.w.Event("toggle"));
    await sampai(() => (h.simpanan.lipatTerbuka as any)["uji:rinci"] === false, "tutup diingat");
    expect(rinci.getAttribute("data-terbuka")).toBe("tidak");
    // Dua kali dipanggil: pegangan yang sama, tidak ada panah ganda.
    expect(h.w.alatJadikanLipat(rinci)).toBe(p);
    expect(rinci.querySelectorAll(".aleta-lipat-panah").length).toBe(1);
  });

  it("kepala tombol ber-aria-expanded (bagian() konten.js): hanya rupa, klik tetap milik pemiliknya", async () => {
    const h = halaman();
    h.d.body.innerHTML =
      '<div class="aleta-bagian" data-kunci="x"><button type="button" class="aleta-bagian-judul" aria-expanded="true">' +
      '<span class="aleta-bagian-panah">▾</span><span class="aleta-bagian-teks">Status</span><span class="aleta-bagian-lencana"></span></button>' +
      '<div class="aleta-bagian-isi">isi</div></div>';
    const kotak = h.d.querySelector(".aleta-bagian")!;
    const kepala = kotak.querySelector("button")!;
    const isi = kotak.querySelector(".aleta-bagian-isi") as HTMLElement;
    let klikPemilik = 0;
    kepala.addEventListener("click", () => {
      klikPemilik += 1;
      const tutup = isi.style.display !== "none";
      isi.style.display = tutup ? "none" : "";
      kepala.setAttribute("aria-expanded", tutup ? "false" : "true");
    });
    const p = h.w.alatJadikanLipat(kotak);
    expect(p.asal).toBe("tombol");
    expect(kepala.classList.contains("aleta-lipat-kepala")).toBe(true);
    expect(kepala.querySelector(".aleta-bagian-panah")!.classList.contains("aleta-lipat-panah")).toBe(true);
    expect(isi.classList.contains("aleta-lipat-isi")).toBe(true);
    expect(kepala.textContent).toBe("▾Status");
    p.buka(false);
    expect(klikPemilik).toBe(1);
    await sampai(() => kotak.getAttribute("data-terbuka") === "tidak", "data-terbuka ikut aria-expanded");
    p.buka(false);
    expect(klikPemilik).toBe(1);
    expect(h.tulisan.filter((k) => k === "lipatTerbuka")).toEqual([]);
  });

  it("kepala statis (kartu t7): menjadi dapat dilipat - Enter/Spasi, kendali di kepala tidak ikut melipat", async () => {
    const h = halaman();
    h.d.body.innerHTML =
      '<section class="aleta-t7-kartu"><div class="aleta-t7-kartu-judul">Perkara berikutnya <button class="salin">Salin</button></div>' +
      "<p>satu</p><p>dua</p></section>";
    const kartu = h.d.querySelector(".aleta-t7-kartu")!;
    const judul = kartu.querySelector(".aleta-t7-kartu-judul") as HTMLElement;
    const p = h.w.alatJadikanLipat(kartu, { kunci: "uji:kartu" });
    expect(p.asal).toBe("kartu");
    expect(judul.getAttribute("role")).toBe("button");
    expect(judul.getAttribute("tabindex")).toBe("0");
    expect(judul.getAttribute("aria-expanded")).toBe("true");
    (kartu.querySelector(".salin") as HTMLElement).click();
    expect(p.terbuka()).toBe(true);
    judul.dispatchEvent(new h.w.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(p.terbuka()).toBe(false);
    expect(kartu.getAttribute("data-terbuka")).toBe("tidak");
    await sampai(() => (h.simpanan.lipatTerbuka as any)?.["uji:kartu"] === false, "diingat");
    judul.dispatchEvent(new h.w.KeyboardEvent("keydown", { key: " ", bubbles: true }));
    expect(p.terbuka()).toBe(true);
    // Tanpa kepala yang dapat dikenali: tidak diubah sama sekali.
    const polosEl = h.d.createElement("div");
    polosEl.innerHTML = "<p>a</p>";
    expect(h.w.alatJadikanLipat(polosEl)).toBe(null);
    expect(polosEl.className).toBe("");
  });
});

// ============================================================================
describe("K2 blok W1 panel.css", () => {
  const blok = (() => {
    const awal = CSS.indexOf("/* === W1 - PERBAIKAN 1 OKT === */");
    const akhir = CSS.indexOf("/* === AKHIR W1 === */");
    return awal >= 0 && akhir > awal ? CSS.slice(awal, akhir) : "";
  })();
  const aturan = () =>
    blok
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("}")
      .map((x) => x.split("{")[0].trim())
      .filter((s) => s && !s.startsWith("@media"));

  it("ada, dan RUPA hanya dalam UI Baru; yang tidak bergerbang hanya aturan sembunyi", () => {
    expect(blok).not.toBe("");
    const tanpaGerbang = aturan().filter((s) => s.split(",").some((x) => !x.trim().startsWith('html[data-aleta-kulit="modern"]')));
    expect(tanpaGerbang).toEqual([
      ".aleta-lipatan > .aleta-lipat-isi[hidden]",
      '.aleta-lipatan[data-lipat-asal="kartu"][data-terbuka="tidak"] > :not(.aleta-lipat-kepala)',
    ]);
  });

  it("tidak memakai kelas .aleta-lipat sebagai akar (milik tombol – kepala panel)", () => {
    expect(blok.replace(/\/\*[\s\S]*?\*\//g, "")).not.toMatch(/\.aleta-lipat(?![-\w])/);
  });
});

// ============================================================================
// BUTIR 7 - WIDGET CHECKLIST: lipat, sembunyi, tinggi, urutan, pisah, per akun
// ============================================================================

const API_CHECKLIST = "/aleta/api/aleta-ecourt/checklist";

function hariKe(n: number) {
  const t = new Date();
  t.setDate(t.getDate() + n);
  t.setHours(16, 0, 0, 0);
  return t.toISOString();
}

function jawabanChecklist() {
  const b = (id: string, judul: string, nomor: string, hari: number, kelompok: string) => ({
    id,
    jenis: "pmh",
    judul,
    perkara: { id: 10000 + hari, nomor },
    tenggat: hariKe(hari),
    kelompok,
    keterangan: "",
    kerjakan: { tujuan: "sipp", halaman: "penetapan" },
  });
  return {
    ok: true,
    data: {
      pengguna: { nama: "Hakim Uji", peran: ["hakim"] },
      peranTersedia: [{ kunci: "hakim", label: "Hakim" }],
      peranAktif: "hakim",
      dibuat: new Date().toISOString(),
      ringkas: { lewat: 2, hariIni: 1, mingguIni: 1, selesaiHariIni: 0, totalHariIni: 1 },
      butir: [
        b("l1", "PMH belum ditetapkan", "385/Pdt.G/2026/PA.Dgl", -2, "lewat"),
        b("l2", "Minutasi belum", "386/Pdt.G/2026/PA.Dgl", -1, "lewat"),
        b("h1", "Sidang hari ini", "387/Pdt.G/2026/PA.Dgl", 0, "hari-ini"),
        b("m1", "PHS mendekati tenggat", "390/Pdt.G/2026/PA.Dgl", 3, "minggu-ini"),
      ],
      jenisTidakTersedia: [],
      galat: [],
    },
  };
}

/** Server tiruan SATU akun: setelan pribadinya dipakai bersama oleh "PC" mana pun. */
type ServerUji = {
  setelan: Record<string, { nilai: unknown; diubahPada: string }>;
  detik: number;
  putus: boolean;
  put: Array<{ kunci: string; nilai: any }>;
};
const serverBaru = (): ServerUji => ({ setelan: {}, detik: 0, putus: false, put: [] });

function tanggapanUji(status: number, isi: unknown) {
  const r = { ok: status >= 200 && status < 300, status, statusText: "", json: async () => polos(isi), clone: () => r };
  return r;
}

const SEMUA_WIDGET = { "popup-20": true, "popup-21": true, "popup-22": true };
// Perbaikan 2 Okt butir 13: bawaan UI Baru kini HANYA checklist yang tampil.
// Uji di berkas ini menguji lipat/pisah/tinggi bagian lain, jadi susunan
// "semua tampil" disimpan lebih dulu - seperti akun yang sudah menatanya.
const ui = (lain: Record<string, unknown> = {}) => ({
  checklistMilestone: true,
  ujiTampilan: "ui",
  ujiFitur: { ...SEMUA_WIDGET },
  susunanWidget: { semua: { urutan: [], mati: [] } },
  ...lain,
});

function halamanWidget(p: { simpanan?: Record<string, unknown>; server?: ServerUji; alamat?: string; sumber?: string } = {}) {
  const dom = jsdomUji(p.alamat ?? "http://192.168.10.10/SIPP/detil_perkara_agama");
  terbuka.push(dom);
  const w = dom.window as any;
  const server = p.server ?? serverBaru();
  // 12 Okt: widget BAWAAN TERTUTUP bagi sesi tanpa posisi tersimpan; uji ini menguji bagian yang
  // terbentang (lipat, pisah, tinggi), jadi dimulai dari posisi "terbentang" kecuali disebut.
  const awalSimpanan: Record<string, unknown> = { ...(p.simpanan ?? {}) };
  for (const k of ["posisiChecklistSipp", "posisiChecklistAbt", "posisiChecklistAleta"]) {
    if (!(k in awalSimpanan)) awalSimpanan[k] = { kecil: false };
  }
  const { simpanan, tulisan, storage } = penyimpanan(awalSimpanan);
  w.chrome = {
    runtime: { id: "aleta-uji", getManifest: () => ({ version: "0.0.0" }), getURL: (x: string) => x, sendMessage: async () => ({}) },
    storage,
  };
  const cara: Array<{ url: string; cara: string }> = [];
  w.fetch = async (alamat: string, opsi?: { method?: string; body?: string }) => {
    const url = String(alamat);
    const c = String((opsi && opsi.method) || "GET").toUpperCase();
    cara.push({ url, cara: c });
    if (url.includes(API_CHECKLIST)) return tanggapanUji(200, jawabanChecklist());
    if (url.includes("/ekstensi/tampilan")) {
      if (server.putus) throw new TypeError("Failed to fetch");
      return tanggapanUji(200, {
        ok: true,
        data: { tampilan: { mode: "lama", fitur: {}, diterapkan: false }, versi: "v1", setelan: polos(server.setelan) },
      });
    }
    if (url.includes("/ekstensi/setelan") && c === "PUT") {
      if (server.putus) throw new TypeError("Failed to fetch");
      const badan = JSON.parse(String(opsi && opsi.body));
      server.detik += 1;
      const pada = new Date(Date.UTC(2026, 9, 1, 12, 0, server.detik)).toISOString();
      server.setelan[badan.kunci] = { nilai: badan.nilai, diubahPada: pada };
      server.put.push(polos(badan));
      return tanggapanUji(200, { ok: true, data: { kunci: badan.kunci, nilai: badan.nilai, diubahPada: pada, dihapus: false, dibuang: [] } });
    }
    return tanggapanUji(200, { ok: true, data: {} });
  };
  w.document.addEventListener("click", (e: any) => e.preventDefault(), true);
  const ctx = dom.getInternalVMContext();
  vm.runInContext(SUMBER_ALAT, ctx, { filename: "panel-alat.js" });
  vm.runInContext(p.sumber ?? SUMBER_CHECKLIST, ctx, { filename: "checklist.js" });
  const akar = () => w.document.querySelector("aleta-cm-widget") as any;
  const q = (pemilih: string) => (akar() && akar().shadowRoot ? (akar().shadowRoot.querySelector(pemilih) as any) : null);
  const qs = (pemilih: string) => (akar() && akar().shadowRoot ? Array.from(akar().shadowRoot.querySelectorAll(pemilih)) : []) as any[];
  const tekan = (sasaran: any, jenis: string, x: number, y: number) =>
    sasaran.dispatchEvent(new w.MouseEvent(jenis, { bubbles: true, composed: true, cancelable: true, clientX: x, clientY: y, button: 0 }));
  const setel = (isi: Record<string, unknown>) => storage.local.set(isi);
  return { dom, w, simpanan, tulisan, cara, server, akar, q, qs, tekan, setel };
}
type HalamanWidget = ReturnType<typeof halamanWidget>;

const siapDok = (h: HalamanWidget) => sampai(() => h.q(".aleta-cmw-dok") && h.q(".aleta-cm-kelompok"), "dok tergambar");
const tumpuk = (h: HalamanWidget) => h.qs(".aleta-cmw-tumpuk > *").map((x) => x.getAttribute("data-widget-isi") || "checklist");
const tata = (h: HalamanWidget) => (h.simpanan.tataWidget || {}) as any;
const putTata = (h: HalamanWidget) => h.cara.filter((c) => c.cara === "PUT" && c.url.includes("/ekstensi/setelan"));
const bukaAtur = async (h: HalamanWidget) => {
  if (!h.q(".aleta-cmw-atur")) h.q(".aleta-cmw-atur-buka").click();
  await sampai(() => h.q(".aleta-cmw-atur"), "atur terbuka");
};

describe("butir 7: tiap bagian widget dilipat dengan bentuk K2 (UI Baru)", () => {
  it("checklist, catatan, lama sidang, kalender, dan kelompok memakai kepala lipat yang sama; diingat per bagian", async () => {
    const h = halamanWidget({ simpanan: ui() });
    await siapDok(h);
    expect(tumpuk(h)).toEqual(["checklist", "catatan", "lama-sidang", "kalender"]);
    for (const id of ["catatan", "lama-sidang", "kalender"]) {
      const kotak = h.q(`.aleta-cmw-kotak[data-widget-isi="${id}"]`);
      expect(kotak.classList.contains("aleta-lipatan"), id).toBe(true);
      expect(kotak.querySelector(":scope > .aleta-cmw-kepala > .aleta-lipat-kepala"), id).not.toBeNull();
    }
    expect(h.q(".aleta-cm-kepala > .aleta-lipat-kepala .aleta-cm-judul").textContent).toBe("Checklist milestone");
    expect(h.q('[data-kelompok="lewat"] > .aleta-lipat-kepala')).not.toBeNull();
    // Kalender tetap memperbarui judulnya sendiri di dalam tombol lipat.
    expect(h.q('[data-widget-isi="kalender"] .aleta-cmw-judul').textContent).toMatch(/^Kalender tenggat · /);

    h.q('[data-fokus="lipat-catatan"]').click();
    const isiCatatan = h.q('[data-widget-isi="catatan"] > .aleta-lipat-isi');
    expect(isiCatatan.hidden).toBe(true);
    await sampai(() => (h.simpanan.lipatTerbuka as any)?.["widget:catatan"] === false, "diingat");
    // Digambar ulang (mis. penyegaran checklist): tetap terlipat.
    h.q(".aleta-cm-segar").click();
    await sampai(() => h.q('[data-widget-isi="catatan"] > .aleta-lipat-isi')?.hidden === true, "tetap terlipat");
  });

  it("Lama dan Baru: tidak satu pun kelas lipat, garis tarik, kendali ⧉, maupun jendela melayang - walau tata tersimpan", async () => {
    const tersimpan = {
      tataWidget: { bagian: { catatan: { tinggi: 300, lepas: { x: 0.5, y: 0.2 } }, "kel-lewat": { lepas: { x: 0.1, y: 0.1 } } }, kelompok: { urutan: [], mati: ["minggu-ini"] } },
    };
    for (const mode of ["lama", "baru"]) {
      const h = halamanWidget({ simpanan: { ...ui(tersimpan), ujiTampilan: mode } });
      await sampai(() => h.q(".aleta-cm-kelompok"), "tergambar");
      await tunggu(60);
      expect(h.qs(".aleta-lipatan, .aleta-lipat-kepala, .aleta-cmw-tarik, .aleta-cmw-pisah, .aleta-cmw-lepas-wadah").length, mode).toBe(0);
      expect(h.q('[data-kelompok="minggu-ini"]'), mode).not.toBeNull();
      expect(h.q('[data-kelompok="lewat"]'), mode).not.toBeNull();
      expect(putTata(h), mode).toEqual([]);
      expect(h.tulisan.filter((k) => k === "tataWidget" || k === "lipatTerbuka"), mode).toEqual([]);
    }
  });
});

describe("butir 7: pisah menjadi jendela melayang, geser, gabung", () => {
  it("⧉ memindahkan bagian ke jendela melayang; ⤓ menggabungkannya lagi ke dok", async () => {
    const h = halamanWidget({ simpanan: ui() });
    await siapDok(h);
    h.q('[data-fokus="pisah-catatan"]').click();
    const jendela = await sampai(() => h.q('.aleta-cmw-lepas-wadah [data-lepasan="catatan"]'), "jendela catatan");
    expect(tumpuk(h)).toEqual(["checklist", "lama-sidang", "kalender"]);
    expect(jendela.style.position).toBe("fixed");
    expect(jendela.style.left).toMatch(/px$/);
    expect(jendela.style.top).toMatch(/px$/);
    expect(jendela.querySelector(".aleta-cmw-catatan")).not.toBeNull();
    expect(tata(h).bagian.catatan.lepas).toEqual({ x: expect.any(Number), y: expect.any(Number) });
    // Satu akar saja di <html> - senyap, cetak, dan layar publik tetap berlaku.
    expect(Array.from(h.w.document.documentElement.children).map((x: any) => x.tagName)).toEqual(["HEAD", "BODY", "ALETA-CM-WIDGET"]);

    // Geser dari kepala jendela.
    const kepala = jendela.querySelector(".aleta-cmw-kepala");
    const kiri0 = parseFloat(jendela.style.left);
    const atas0 = parseFloat(jendela.style.top);
    h.tekan(kepala, "pointerdown", 400, 200);
    h.tekan(kepala, "pointermove", 300, 150);
    h.tekan(kepala, "pointerup", 300, 150);
    await sampai(() => Math.abs(tata(h).bagian.catatan.lepas.x * 1024 - (kiri0 - 100)) < 1, "letak baru tersimpan");
    expect(Math.abs(tata(h).bagian.catatan.lepas.y * 768 - (atas0 - 50))).toBeLessThan(1);
    // Dok tidak ikut bergeser.
    expect([h.akar().style.left, h.akar().style.bottom]).toEqual(["12px", "12px"]);

    h.q('.aleta-cmw-lepas-wadah [data-fokus="gabung-catatan"]').click();
    await sampai(() => !h.q(".aleta-cmw-lepas-wadah"), "wadah melayang hilang");
    expect(tumpuk(h)).toEqual(["checklist", "catatan", "lama-sidang", "kalender"]);
    expect(tata(h).bagian.catatan).toBeUndefined();
  });

  it("kelompok Lewat tenggat dapat dipisah: kartunya pindah ke jendelanya sendiri, checklist tidak menggandakannya", async () => {
    const h = halamanWidget({ simpanan: ui() });
    await siapDok(h);
    h.q('[data-fokus="pisah-kel-lewat"]').click();
    const jendela = await sampai(() => h.q('.aleta-cmw-lepas-wadah [data-lepasan="kel-lewat"]'), "jendela lewat");
    expect(Array.from(jendela.querySelectorAll(".aleta-cm-butir")).map((x: any) => x.getAttribute("data-id"))).toEqual(["l1", "l2"]);
    expect(jendela.querySelector(".aleta-cm-hitung").textContent).toBe("2");
    expect(h.q('.aleta-cm [data-kelompok="lewat"]')).toBeNull();
    expect(h.qs(".aleta-cm-butir").map((x) => x.getAttribute("data-id")).sort()).toEqual(["h1", "l1", "l2"]);
    // ⊘ menyembunyikannya; kelompok berisi tugas yang disembunyikan DISEBUT di checklist.
    jendela.querySelector('[data-fokus="sembunyi-kel-lewat"]').click();
    await sampai(() => !h.q('[data-lepasan="kel-lewat"]'), "disembunyikan");
    const sebut = await sampai(() => h.q('[data-kelompok-sembunyi="lewat"]'), "disebut");
    expect(sebut.textContent).toMatch(/Lewat tenggat \(2\) disembunyikan/);
    sebut.querySelector("button").click();
    await sampai(() => h.q('[data-lepasan="kel-lewat"]'), "tampil lagi di jendelanya");
  });
});

describe("butir 7: tinggi tiap bagian - tarik, papan tik, kembali ke bawaan", () => {
  it("garis tarik mengubah tinggi isi; panah atas/bawah dan Home; klik ganda mengembalikan", async () => {
    const h = halamanWidget({ simpanan: ui() });
    await siapDok(h);
    const garis = h.q('[data-tarik="catatan"]');
    expect(garis.getAttribute("role")).toBe("separator");
    h.tekan(garis, "pointerdown", 50, 100);
    h.tekan(garis, "pointermove", 50, 260);
    h.tekan(garis, "pointerup", 50, 260);
    await sampai(() => tata(h).bagian?.catatan?.tinggi === 220, "tinggi tersimpan (60 + 160)");
    const isi = await sampai(() => h.q('[data-widget-isi="catatan"] > .aleta-cmw-isi'), "isi");
    expect(isi.style.height).toBe("220px");
    // Dok tidak ikut tergeser oleh tarikan.
    expect([h.akar().style.left, h.akar().style.bottom]).toEqual(["12px", "12px"]);

    h.q('[data-tarik="catatan"]').dispatchEvent(new h.w.KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    await sampai(() => tata(h).bagian.catatan.tinggi === 240, "panah bawah +20");
    h.q('[data-tarik="catatan"]').dispatchEvent(new h.w.KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));
    await sampai(() => tata(h).bagian.catatan.tinggi === 220, "panah atas -20");
    h.q('[data-tarik="catatan"]').dispatchEvent(new h.w.KeyboardEvent("keydown", { key: "Home", bubbles: true }));
    await sampai(() => !tata(h).bagian.catatan, "Home: bawaan");
    expect(h.q('[data-widget-isi="catatan"] > .aleta-cmw-isi').style.height).toBe("");

    // Checklist: yang diberi tinggi wadah gulungnya, dan kelompok punya garisnya sendiri.
    const g2 = h.q('[data-tarik="checklist"]');
    h.tekan(g2, "pointerdown", 0, 0);
    h.tekan(g2, "pointermove", 0, 240);
    h.tekan(g2, "pointerup", 0, 240);
    await sampai(() => tata(h).bagian?.checklist?.tinggi === 300, "tinggi checklist");
    expect(h.q(".aleta-cm-isi").style.height).toBe("300px");
    expect(h.q('[data-kelompok="lewat"] > [data-tarik="kel-lewat"]')).not.toBeNull();
    h.q('[data-tarik="checklist"]').dispatchEvent(new h.w.MouseEvent("dblclick", { bubbles: true }));
    await sampai(() => !tata(h).bagian.checklist, "klik ganda: bawaan");
  });
});

describe("butir 7: Atur widget - kelompok checklist, pisah, ukuran, keadaan simpan", () => {
  it("kelompok diurutkan, disembunyikan, dan dipisah dari Atur; baris widget lama tetap sama", async () => {
    const h = halamanWidget({ simpanan: ui() });
    await siapDok(h);
    await bukaAtur(h);
    // Baris widget yang sudah ada tidak bertambah (uji tahap 3 bergantung padanya).
    expect(h.qs(".aleta-cmw-atur-baris").map((b) => b.getAttribute("data-widget"))).toEqual([
      "checklist",
      "catatan",
      "lama-sidang",
      "kalender",
      "jadwal-saya",
      "antrean",
      "whatsapp",
      "jendela",
    ]);
    expect(h.qs("[data-kelompok-atur]").map((b) => b.getAttribute("data-kelompok-atur"))).toEqual(["lewat", "hari-ini", "minggu-ini"]);
    expect(h.q(".aleta-cmw-atur .aleta-cmw-ket").textContent).toMatch(/Disimpan di akun Anda di server/);

    h.q('[data-fokus="atur-kel-naik-hari-ini"]').click();
    await sampai(() => JSON.stringify(tata(h).kelompok?.urutan) === JSON.stringify(["hari-ini", "lewat", "minggu-ini"]), "urutan kelompok");
    h.q('[data-fokus="atur-kel-saklar-minggu-ini"]').click();
    await sampai(() => tata(h).kelompok.mati.includes("minggu-ini"), "minggu ini disembunyikan");
    h.q('[data-fokus="atur-pisah-kalender"]').click();
    await sampai(() => h.q('[data-lepasan="kalender"]'), "kalender melayang");
    expect(h.q('[data-fokus="atur-pisah-kalender"]').getAttribute("aria-pressed")).toBe("true");
    h.q(".aleta-cmw-atur-tutup").click();
    await sampai(() => !h.q(".aleta-cmw-atur"), "atur tertutup");
    expect(h.qs(".aleta-cm [data-kelompok]").map((x) => x.getAttribute("data-kelompok"))).toEqual(["hari-ini", "lewat"]);
    expect(h.q('[data-kelompok-sembunyi="minggu-ini"]').textContent).toMatch(/Minggu ini \(1\) disembunyikan/);
    expect(tumpuk(h)).toEqual(["checklist", "catatan", "lama-sidang"]);
  });
});

describe("butir 7: tersimpan per AKUN di server, berlaku di PC mana pun", () => {
  it("perubahan dikirim SEKALI (dirangkum) ke setelan widget.tata; PC lain memakainya tanpa satu tulisan pun", async () => {
    const server = serverBaru();
    const pc1 = halamanWidget({ simpanan: ui(), server });
    await siapDok(pc1);
    pc1.q('[data-fokus="pisah-catatan"]').click();
    await sampai(() => pc1.q('[data-lepasan="catatan"]'), "dipisah");
    // Perubahan berikutnya datang sebentar kemudian - tetap satu kiriman.
    await tunggu(400);
    await bukaAtur(pc1);
    pc1.q('[data-fokus="atur-kel-saklar-minggu-ini"]').click();
    pc1.q('[data-widget="lama-sidang"] .aleta-cmw-saklar').click();
    expect(tata(pc1).tertunda).toBe(true);
    await sampai(() => server.put.length === 1, "satu PUT", 5000);
    await tunggu(100);
    expect(server.put.length).toBe(1);
    const nilai = server.put[0];
    expect(nilai.kunci).toBe("widget.tata");
    expect(nilai.nilai.bagian.catatan.lepas).toEqual({ x: expect.any(Number), y: expect.any(Number) });
    expect(nilai.nilai.kelompok.mati).toEqual(["minggu-ini"]);
    expect(nilai.nilai.susunan.semua.mati).toEqual(["lama-sidang"]);
    await sampai(() => tata(pc1).tertunda === false && tata(pc1).serverPada === server.setelan["widget.tata"].diubahPada, "disepakati");
    // Singgahan tampilan ikut diperbarui - tab lain tidak membaca nilai basi.
    await sampai(() => (pc1.simpanan.tampilanServer as any)?.setelan?.["widget.tata"]?.diubahPada === tata(pc1).serverPada, "singgahan");
    // Mode coba (UI Baru lokal) TIDAK menahan setelan pribadi.
    expect(pc1.w.alatCobaAktif()).toBe(true);
    await sampai(() => pc1.q(".aleta-cmw-sinkron")?.textContent.includes("Tersimpan di akun Anda"), "keadaan simpan disebut");

    // PC lain, peramban kosong, akun yang sama.
    const pc2 = halamanWidget({ simpanan: ui(), server });
    await sampai(() => pc2.q('[data-lepasan="catatan"]'), "PC2 memakai susunan akun");
    expect(tumpuk(pc2)).toEqual(["checklist", "kalender"]);
    expect(pc2.q('.aleta-cm [data-kelompok="minggu-ini"]')).toBeNull();
    expect(tata(pc2).serverPada).toBe(server.setelan["widget.tata"].diubahPada);
    await tunggu(1800);
    expect(putTata(pc2)).toEqual([]);
  }, 15000);

  it("server tidak terjangkau: cadangan lokal dipakai, tertunda, disebut; terkirim begitu server kembali", async () => {
    const server = serverBaru();
    server.putus = true;
    const h = halamanWidget({ simpanan: ui(), server });
    await siapDok(h);
    h.q('[data-fokus="pisah-kalender"]').click();
    await sampai(() => h.q('[data-lepasan="kalender"]'), "dipisah tetap berlaku");
    await sampai(() => h.cara.some((c) => c.cara === "PUT"), "dicoba kirim", 4000);
    await tunggu(50);
    expect(tata(h).tertunda).toBe(true);
    expect(tata(h).bagian.kalender.lepas).toBeTruthy();
    await bukaAtur(h);
    expect(h.q(".aleta-cmw-sinkron").textContent).toMatch(/Belum tersimpan di server \(server tidak terjangkau\)/);

    // Halaman berikutnya, server sudah kembali: cadangan dipakai lalu dikirim.
    server.putus = false;
    const h2 = halamanWidget({ simpanan: polos(h.simpanan), server });
    await sampai(() => h2.q('[data-lepasan="kalender"]'), "cadangan lokal");
    await sampai(() => server.put.length === 1, "terkirim", 5000);
    expect(server.put[0].nilai.bagian.kalender.lepas).toBeTruthy();
    await sampai(() => tata(h2).tertunda === false, "disepakati");
  }, 15000);

  it("akun lain di PC yang sama (server tidak punya tata): kembali ke susunan bawaan, bukan milik akun sebelumnya", async () => {
    const server = serverBaru();
    server.setelan["pintasan.portal"] = { nilai: { urutan: [], sembunyi: [] }, diubahPada: "2026-10-01T00:00:00.000Z" };
    const h = halamanWidget({
      server,
      simpanan: ui({
        tataWidget: { bagian: { catatan: { lepas: { x: 0.4, y: 0.2 } } }, kelompok: { urutan: [], mati: [] }, serverPada: "2026-09-30T10:00:00.000Z", diubah: 1, tertunda: false, lokalSaja: "" },
        susunanWidget: { semua: { urutan: [], mati: ["kalender"] } },
      }),
    });
    await siapDok(h);
    // Bawaan sejak perbaikan 2 Okt butir 13: hanya checklist.
    await sampai(() => tumpuk(h).join() === "checklist", "bawaan");
    expect(h.q(".aleta-cmw-lepas-wadah")).toBeNull();
    expect(tata(h).serverPada).toBe("");
    await tunggu(1700);
    expect(putTata(h)).toEqual([]);
  }, 10000);

  for (const [nama, kunci, kata] of [
    ["mode latihan", "modeLatihan", "Mode latihan"],
    ["mode kering", "modeKering", "Mode kering"],
  ] as const) {
    it(`${nama}: susunan berubah di peramban ini saja - tidak ada PUT ke server`, async () => {
      const server = serverBaru();
      const h = halamanWidget({ simpanan: ui({ [kunci]: true }), server });
      await siapDok(h);
      h.q('[data-fokus="pisah-catatan"]').click();
      await sampai(() => h.q('[data-lepasan="catatan"]'), "dipisah");
      await tunggu(1800);
      expect(server.put).toEqual([]);
      expect(putTata(h)).toEqual([]);
      expect(tata(h).tertunda).toBe(false);
      expect(tata(h).lokalSaja).toBe(kunci === "modeLatihan" ? "latihan" : "kering");
      await bukaAtur(h);
      expect(h.q(".aleta-cmw-sinkron").textContent).toMatch(new RegExp(`^${kata}: susunan disimpan di peramban ini saja`));
    }, 10000);
  }
});

describe("butir 7: panel-alat.js menyinggahkan setelan widget.tata tanpa permintaan tambahan", () => {
  it("jawaban tampilan BERSETELAN -> tampilanServer.setelan; tanpa setelan -> bentuk lama persis", async () => {
    const server = serverBaru();
    server.setelan["widget.tata"] = { nilai: { susunan: {}, bagian: {}, kelompok: { urutan: [], mati: [] } }, diubahPada: "2026-10-01T01:02:03.000Z" };
    const h = halamanWidget({ simpanan: {}, server });
    await sampai(() => (h.simpanan.tampilanServer as any)?.setelan, "tersinggah");
    expect((h.simpanan.tampilanServer as any).setelan).toEqual({ "widget.tata": server.setelan["widget.tata"] });
    expect(h.w.alatSetelanTersinggah("widget.tata")).toEqual(server.setelan["widget.tata"]);
    expect(h.cara.map((c) => c.url).filter((u) => u.includes("/ekstensi/"))).toEqual(["/aleta/api/aleta-ecourt/ekstensi/tampilan"]);

    const kosong = serverBaru();
    const h2 = halamanWidget({ simpanan: {}, server: kosong });
    await sampai(() => (h2.simpanan.tampilanServer as any)?.setelan, "tersinggah null");
    expect((h2.simpanan.tampilanServer as any).setelan).toEqual({ "widget.tata": null });
    expect(h2.w.alatSetelanTersinggah("widget.tata")).toBe(null);

    // Portal lama tanpa ruas setelan: singgahan tanpa ruas setelan sama sekali.
    const h3 = halaman();
    await sampai(() => h3.simpanan.tampilanServer, "tampilan lama");
    expect("setelan" in (h3.simpanan.tampilanServer as object)).toBe(false);
    expect(h3.w.alatSetelanTersinggah("widget.tata")).toBeUndefined();
  });
});

describe("butir 7: daftar putih server - setelan widget.tata", () => {
  const kini = new Date("2026-10-01T00:00:00.000Z");
  it("diizinkan, dinormalkan, ruas asing dibuang dan disebut", () => {
    expect(KUNCI_SETELAN).toContain("widget.tata");
    const hasil = normalkanSetelan(
      "widget.tata",
      {
        susunan: { semua: { urutan: ["checklist", "catatan", "catatan"], mati: ["kalender"] }, entah: { urutan: [] } },
        bagian: { catatan: { tinggi: 220.4, lepas: { x: 0.123456, y: 0.5, lebar: 400 }, warna: "x" }, kalender: { tinggi: 5 } },
        kelompok: { urutan: ["hari-ini", "lewat"], mati: ["minggu-ini"] },
        token: "rahasia",
      },
      kini
    );
    expect(hasil.nilai).toEqual({
      susunan: { semua: { urutan: ["checklist", "catatan"], mati: ["kalender"] } },
      bagian: { catatan: { tinggi: 220, lepas: { x: 0.1235, y: 0.5, lebar: 400 } } },
      kelompok: { urutan: ["hari-ini", "lewat"], mati: ["minggu-ini"] },
    });
    expect(hasil.dibuang.sort()).toEqual(["susunan.entah", "token"]);
  });

  it("bentuk salah ditolak; ukuran dibatasi", () => {
    expect(() => normalkanSetelan("widget.tata", [], kini)).toThrow(GalatSetelan);
    expect(() => normalkanSetelan("widget.tata", { bagian: { "<script>": { tinggi: 100 } } }, kini)).toThrow(GalatSetelan);
    expect(() => normalkanSetelan("widget.tata", { kelompok: { urutan: "lewat" } }, kini)).toThrow(GalatSetelan);
    const banyak: Record<string, unknown> = {};
    for (let i = 0; i < 21; i++) banyak[`b${i}`] = { tinggi: 100 };
    expect(() => normalkanSetelan("widget.tata", { bagian: banyak }, kini)).toThrow(/paling banyak/);
  });
});

describe("K2 dipakai panel portal (aleta.js) di UI Baru", () => {
  it("t4LipatSeragam menjadikan tiap bagian panel portal dapat dilipat dengan kunci portal:<nama>", async () => {
    const h = halaman({ alamat: "http://192.168.10.10/aleta/portal" });
    vm.runInContext(SUMBER_PORTAL, h.dom.getInternalVMContext(), { filename: "aleta.js" });
    const isi = h.d.createElement("div");
    isi.innerHTML =
      '<section class="aleta-bagian aleta-portal-bagian" data-t4-fitur="portal-11"><div class="aleta-bagian-judul">Tugas saya</div><div class="aleta-bagian-isi">a</div></section>' +
      '<section class="aleta-bagian aleta-portal-bagian"><div class="aleta-bagian-judul">Ekstensi</div><div class="aleta-bagian-isi">b</div></section>' +
      '<div class="aleta-t4-bantuan">bukan bagian</div>';
    h.d.body.appendChild(isi);
    expect(h.w.t4LipatSeragam(isi)).toBe(2);
    const [a, b] = Array.from(isi.querySelectorAll(".aleta-bagian")) as HTMLElement[];
    expect(a.getAttribute("data-kunci")).toBe("portal:portal-11");
    expect(b.getAttribute("data-kunci")).toBe("portal:ekstensi");
    expect(a.querySelector(".aleta-bagian-judul")!.getAttribute("role")).toBe("button");
    (b.querySelector(".aleta-bagian-judul") as HTMLElement).click();
    expect(b.getAttribute("data-terbuka")).toBe("tidak");
    await sampai(() => (h.simpanan.lipatTerbuka as any)?.["portal:ekstensi"] === false, "diingat");
  });
});

describe("K2: salinan rupa lipat di Shadow DOM widget sama dengan blok W1 panel.css", () => {
  /** Deklarasi aturan yang pemilihnya PERSIS `pemilih` (sesudah gerbangnya dibuang). */
  function deklarasi(css: string, gerbang: string, pemilih: string) {
    const bersih = css.replace(/\/\*[\s\S]*?\*\//g, "");
    const hasil: Record<string, string> = {};
    const pola = /([^{}]+)\{([^{}]*)\}/g;
    let m: RegExpExecArray | null;
    while ((m = pola.exec(bersih))) {
      const daftar = m[1].split(",").map((x) => x.trim().replace(gerbang, "").trim());
      if (!daftar.includes(pemilih)) continue;
      for (const d of m[2].split(";")) {
        const i = d.indexOf(":");
        if (i > 0) hasil[d.slice(0, i).trim()] = d.slice(i + 1).trim();
      }
    }
    return hasil;
  }
  const W1 = CSS.slice(CSS.indexOf("/* === W1 - PERBAIKAN 1 OKT === */"), CSS.indexOf("/* === AKHIR W1 === */"));
  const GAYA = SUMBER_CHECKLIST.slice(SUMBER_CHECKLIST.indexOf("const GAYA = `"), SUMBER_CHECKLIST.indexOf("`;", SUMBER_CHECKLIST.indexOf("const GAYA = `")));
  const halamanW1 = (p: string) => deklarasi(W1, 'html[data-aleta-kulit="modern"]', p);
  const bayangan = (p: string) => deklarasi(GAYA, ':host([data-kulit="modern"])', p);

  it("panah (bentuk dan putarannya) identik", () => {
    for (const p of [".aleta-lipat-panah", ".aleta-lipat-panah::before"]) {
      expect(bayangan(p), p).toEqual(halamanW1(p));
      expect(Object.keys(halamanW1(p)).length, p).toBeGreaterThan(4);
    }
    const terbukaHalaman = halamanW1('.aleta-lipat-kepala[aria-expanded="true"] > .aleta-lipat-panah::before');
    expect(bayangan('.aleta-lipat-kepala[aria-expanded="true"] > .aleta-lipat-panah::before')).toEqual(terbukaHalaman);
  });

  it("kepala: huruf, warna, jarak, sudut, dan latar sorot sama", () => {
    const a = halamanW1(".aleta-lipat-kepala");
    const b = bayangan(".aleta-lipat-kepala");
    for (const k of ["display", "align-items", "gap", "padding", "border", "border-radius", "background", "color", "font-size", "font-weight", "line-height", "letter-spacing", "text-transform", "cursor"]) {
      expect(b[k], k).toBe(a[k]);
    }
    expect(bayangan(".aleta-lipat-kepala:hover")).toEqual(halamanW1(".aleta-lipat-kepala:hover"));
  });

  it("perilaku sembunyi ada di keduanya", () => {
    expect(deklarasi(GAYA, "", ".aleta-lipatan > .aleta-lipat-isi[hidden]")).toEqual({ display: "none !important" });
    expect(deklarasi(W1, "", ".aleta-lipatan > .aleta-lipat-isi[hidden]")).toEqual({ display: "none !important" });
  });
});

describe("permintaan agen M: alatSidangPadaTanggal meneruskan bahan aletaMassalPutusanLayak", () => {
  it("alasanDitunda, tanggalPutusan, tanggalSidang ikut; ruas lama dan urutannya tetap", async () => {
    const sidang = [
      {
        nomorPerkara: "10/Pdt.G/2026/PA.Dgl",
        perkaraId: 7,
        jenisPerkara: "Cerai Gugat",
        agenda: "Pembuktian",
        sudahPutus: false,
        statusPutusan: "",
        verstekPutusan: false,
        ditunda: true,
        sidangIkrarTalak: false,
        jamSidang: "09:00",
        alasanDitunda: "Musyawarah majelis",
        tanggalPutusan: "",
        tanggalSidang: "2026-10-01",
      },
      { nomorPerkara: "11/Pdt.G/2026/PA.Dgl", perkaraId: 8, sudahPutus: true, tanggalPutusan: "2026-10-01" },
      { nomorPerkara: "10/Pdt.G/2026/PA.Dgl", perkaraId: 7, agenda: "baris kedua - diabaikan" },
    ];
    const h = halaman({ jawab: (url) => (url.includes("/aleta-ecourt/sidang") ? { ok: true, data: { sidang } } : null) });
    const hasil = polos(await h.w.alatSidangPadaTanggal("2026-10-01"));
    expect(hasil).toEqual([
      {
        nomor: "10/Pdt.G/2026/PA.Dgl",
        perkaraId: "7",
        jenis: "Cerai Gugat",
        agenda: "Pembuktian",
        sudahPutus: false,
        statusPutusan: "",
        verstek: false,
        ditunda: true,
        ikrar: false,
        jam: "09:00",
        alasanDitunda: "Musyawarah majelis",
        tanggalPutusan: "",
        tanggalSidang: "2026-10-01",
        // T 13 Okt: kode kumulasi untuk pemilih blangko putusan kumulasi (kosong bila tidak ada).
        kumulasi: [],
      },
      {
        nomor: "11/Pdt.G/2026/PA.Dgl",
        perkaraId: "8",
        jenis: "",
        agenda: "",
        sudahPutus: true,
        statusPutusan: "",
        verstek: false,
        ditunda: false,
        ikrar: false,
        jam: "",
        alasanDitunda: "",
        tanggalPutusan: "2026-10-01",
        // Baris tanpa tanggalSidang: tanggal yang diminta.
        tanggalSidang: "2026-10-01",
        kumulasi: [],
      },
    ]);
    // Urutan ruas lama tidak berubah - tambahan di belakang.
    expect(Object.keys(hasil[0]).slice(0, 10)).toEqual(["nomor", "perkaraId", "jenis", "agenda", "sudahPutus", "statusPutusan", "verstek", "ditunda", "ikrar", "jam"]);
  });
});
