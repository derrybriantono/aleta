// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

import { GalatSetelan, KUNCI_SETELAN, normalkanSetelan } from "@/lib/tampilan-ekstensi";

/**
 * ============================================================================
 * PERBAIKAN 2 OKT 2026 - AGEN W (bersama)
 * ============================================================================
 *
 *   K2 / butir 7   tag peran di kepala lipatan (alatLipat/alatJadikanLipat {peran})
 *   butir 19       konvensi bawaan buka/tutup (alatLipatBawaanTerbuka)
 *   K4 / butir 14  alatJedaManusia(jenis) - jeda tulis, tanpa jeda di kering/latihan/coba
 *   butir 1        header/footer panel portal ALETA disamakan dengan SIPP/ABT
 *   butir 4        toggle bawaan tampil/sembunyi per situs (ALETA hide, SIPP/ABT unhide)
 *   butir 11       klik dua kali di sudut panel = pindah ke sudut itu
 *   butir 13       checklist milestone: bawaan hanya bagian milestone; atur bagian di kepala
 *
 * Kode SUNGGUHAN dijalankan di jsdom: panel-alat.js utuh, satu konteks vm per
 * halaman, chrome.storage tiruan.
 */

const EKSTENSI = path.resolve(process.cwd(), "../ekstensi-sipp");
const baca = (berkas: string) => readFileSync(berkas, "utf8").replace(/\r\n/g, "\n");
const SUMBER_ALAT = baca(process.env.ALETA_UJI_ALAT || path.join(EKSTENSI, "panel-alat.js"));
const CSS = baca(path.join(EKSTENSI, "panel.css"));
const SUMBER_ALETA = baca(path.join(EKSTENSI, "aleta.js"));
const SUMBER_CHECKLIST = baca(path.join(EKSTENSI, "checklist.js"));
const SUMBER_POPUP = baca(path.join(EKSTENSI, "popup.js"));
const SUMBER_DAFTAR_FITUR = baca(path.join(EKSTENSI, "daftar-fitur.js"));
const HTML_POPUP = baca(path.join(EKSTENSI, "popup.html"));
const ASAL = "http://192.168.10.10";
const BLOK_W2 = CSS.split("/* === W2 - PERBAIKAN 2 OKT === */")[1]?.split("/* === AKHIR W2 === */")[0] ?? "";

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
    await new Promise((r) => setTimeout(r, 10));
  }
}

type JsdomUji = JSDOM & { getInternalVMContext(): vm.Context };
type OpsiJsdom = NonNullable<ConstructorParameters<typeof JSDOM>[1]> & { pretendToBeVisual?: boolean };
function jsdomUji(url: string): JsdomUji {
  const opsi: OpsiJsdom = { url, runScripts: "outside-only", pretendToBeVisual: true };
  return new JSDOM(`<!doctype html><html><head></head><body></body></html>`, opsi) as JsdomUji;
}
type Ubah = Record<string, { oldValue?: unknown; newValue?: unknown }>;
const polos = <T>(x: T): T => (x === undefined ? x : JSON.parse(JSON.stringify(x)));
const tunggu = (ms = 0) => new Promise((r) => setTimeout(r, ms));

function penyimpanan(awal: Record<string, unknown>) {
  const simpanan: Record<string, unknown> = polos(awal);
  const pendengar: Array<(ubah: Ubah, wilayah: string) => void> = [];
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
      setTimeout(() => {
        for (const f of [...pendengar]) f(polos(ubah), "local");
      }, 0);
    },
    remove: async () => undefined,
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

const terbuka: JSDOM[] = [];
afterEach(async () => {
  await tunggu(20);
  while (terbuka.length) terbuka.pop()!.window.close();
});

type Jawab = (url: string, cara: string, badan?: string) => unknown;
function halaman(
  p: { simpanan?: Record<string, unknown>; alamat?: string; sumber?: string; tambahan?: Array<[string, string]>; jawab?: Jawab } = {}
) {
  const dom = jsdomUji(p.alamat ?? "http://192.168.10.10/SIPP/detil_perkara_agama");
  terbuka.push(dom);
  const w = dom.window as any;
  const { simpanan, storage } = penyimpanan(p.simpanan ?? {});
  // 23 Okt 2026: widget tersembunyi bawaannya; uji yang menyimpan posisi "terbentang" meminta semua bagian ditampilkan
  // lewat peristiwa halaman (jalan yang sama dengan menu gelembung).
  let bukaSemua = false;
  const awalPosisi = p.simpanan ?? {};
  if (["posisiChecklistSipp", "posisiChecklistAbt", "posisiChecklistAleta"].some((k) => (awalPosisi[k] as { kecil?: boolean } | undefined)?.kecil === false)) {
    bukaSemua = true;
  }
  w.chrome = {
    runtime: { id: "aleta-uji", getManifest: () => ({ version: "0.0.0" }), getURL: (x: string) => x, sendMessage: async () => ({}) },
    storage,
  };
  const cara: Array<{ url: string; cara: string; badan?: string }> = [];
  w.fetch = (alamat: string, opsi?: { method?: string; body?: string }) => {
    const url = String(alamat);
    const c = String((opsi && opsi.method) || "GET").toUpperCase();
    cara.push({ url, cara: c, badan: opsi && opsi.body });
    const isi = (p.jawab && p.jawab(url, c, opsi && opsi.body)) || { ok: true, data: {} };
    const r = { ok: true, status: 200, json: async () => polos(isi), clone: () => r };
    return Promise.resolve(r);
  };
  w.Element.prototype.scrollIntoView = function () {};
  const ctx = dom.getInternalVMContext();
  vm.runInContext(p.sumber ?? SUMBER_ALAT, ctx, { filename: "panel-alat.js" });
  for (const [nama, sumber] of p.tambahan ?? []) vm.runInContext(sumber, ctx, { filename: nama });
  if (bukaSemua) vm.runInContext('document.dispatchEvent(new CustomEvent("aleta-widget-tampilkan", { detail: { bagian: "semua" } }));', ctx);
  return { dom, w, d: w.document as Document, simpanan, cara };
}

// ============================================================================
describe("K2 / butir 7 - tag peran di kepala lipatan", () => {
  it("alatLipat {peran}: span .aleta-lipat-peran di KIRI judul (sesudah panah), teks + title", () => {
    const h = halaman();
    const l = h.w.alatLipat("Susun keterangan saksi", { kunci: "uji:saksi", peran: "Panitera" });
    const anak = Array.from(l.kepala.children as HTMLCollection).map((x) => (x as HTMLElement).className);
    expect(anak.slice(0, 3)).toEqual(["aleta-lipat-panah", "aleta-lipat-peran", "aleta-lipat-judul"]);
    const tag = l.kepala.querySelector(".aleta-lipat-peran") as HTMLElement;
    expect(tag.textContent).toBe("Panitera");
    expect(tag.hidden).toBe(false);
    expect(tag.title).toBe("Bagian ini untuk: Panitera");
  });

  it("tanpa peran: tag ada tetapi hidden dan kosong - kepala tampak seperti 1.177.0", () => {
    const h = halaman();
    const l = h.w.alatLipat("Putusan", { kunci: "uji:p" });
    const tag = l.kepala.querySelector(".aleta-lipat-peran") as HTMLElement;
    expect(tag.hidden).toBe(true);
    expect(tag.textContent).toBe("");
    // textContent kepala tetap judul saja (uji lama memakai ini).
    expect(l.kepala.textContent).toBe("Putusan");
  });

  it("kode golongan diganti sebutan; daftar digabung ' · ' tanpa ganda; setelPeran mengubah", () => {
    const h = halaman();
    const l = h.w.alatLipat("Relaas", { peran: ["jurusita", "JURU_SITA", "pp", "Hakim"] });
    const tag = l.kepala.querySelector(".aleta-lipat-peran") as HTMLElement;
    expect(tag.textContent).toBe("Juru Sita · PP · Hakim");
    l.setelPeran("admin");
    expect(tag.textContent).toBe("Admin");
    l.setelPeran(null);
    expect(tag.hidden).toBe(true);
  });

  it("klik pada tag tetap melipat; isi benar-benar hidden + aturan CSS !important", () => {
    const h = halaman();
    const l = h.w.alatLipat("Susun", { peran: "PP" });
    h.d.body.appendChild(l.akar);
    (l.kepala.querySelector(".aleta-lipat-peran") as HTMLElement).click();
    expect(l.terbuka()).toBe(false);
    expect(l.isi.hidden).toBe(true);
    expect(CSS).toContain(".aleta-lipatan > .aleta-lipat-isi[hidden] { display: none !important; }");
  });

  it("alatJadikanLipat {peran}: details, tombol ber-aria-expanded, kartu statis; panggilan ulang memperbarui", () => {
    const h = halaman();
    h.d.body.innerHTML = `
      <details id="a"><summary>Relaas massal</summary><div>isi</div></details>
      <div id="b"><button aria-expanded="true">BAS</button><div class="x-isi">isi</div></div>
      <div id="c"><div class="aleta-bagian-judul">Penetapan</div><p>isi</p></div>`;
    const a = h.w.alatJadikanLipat(h.d.getElementById("a"), { peran: "Juru Sita" });
    const b = h.w.alatJadikanLipat(h.d.getElementById("b"), { peran: "Panitera" });
    const c = h.w.alatJadikanLipat(h.d.getElementById("c"), { peran: ["Ketua", "Admin"] });
    expect(a.kepala.querySelector(".aleta-lipat-peran").textContent).toBe("Juru Sita");
    expect(b.kepala.querySelector(".aleta-lipat-peran").textContent).toBe("Panitera");
    expect(c.kepala.querySelector(".aleta-lipat-peran").textContent).toBe("Ketua · Admin");
    // urutan: panah lalu tag
    expect((a.kepala.children[1] as HTMLElement).className).toBe("aleta-lipat-peran");
    h.w.alatJadikanLipat(h.d.getElementById("c"), { peran: "PP" });
    expect(c.kepala.querySelectorAll(".aleta-lipat-peran").length).toBe(1);
    expect(c.kepala.querySelector(".aleta-lipat-peran").textContent).toBe("PP");
    c.setelPeran("Hakim");
    expect(c.kepala.querySelector(".aleta-lipat-peran").textContent).toBe("Hakim");
  });

  it("alatJadikanLipat tanpa opsi peran tidak menambah tag (bagian lama tidak berubah)", () => {
    const h = halaman();
    h.d.body.innerHTML = `<details id="a"><summary>Relaas</summary><div>isi</div></details>`;
    const a = h.w.alatJadikanLipat(h.d.getElementById("a"), {});
    expect(a.kepala.querySelector(".aleta-lipat-peran")).toBeNull();
  });

  it("rupa tag hanya di blok W2 panel.css, di bawah kulit modern", () => {
    const blok = CSS.split("/* === W2 - PERBAIKAN 2 OKT === */")[1]?.split("/* === AKHIR W2 === */")[0] ?? "";
    expect(blok).toMatch(/html\[data-aleta-kulit="modern"\] \.aleta-lipat-peran \{/);
    expect(blok).toMatch(/\.aleta-lipat-peran\[hidden\] \{ display: none !important; \}/);
  });
});

// ============================================================================
describe("butir 19 - konvensi bawaan buka/tutup", () => {
  it("alatLipatBawaanTerbuka: hanya kunci utama (atau yang pertama) terbuka", () => {
    const h = halaman();
    const buka = h.w.alatLipatBawaanTerbuka(["putusan", "berkas", "perkara"]);
    expect(["putusan", "berkas", "perkara"].map(buka)).toEqual([true, false, false]);
    const buka2 = h.w.alatLipatBawaanTerbuka(["putusan", "berkas", "perkara"], "berkas");
    expect(["putusan", "berkas", "perkara"].map(buka2)).toEqual([false, true, false]);
    const buka3 = h.w.alatLipatBawaanTerbuka(["a", "b"], "tidak-ada");
    expect(["a", "b"].map(buka3)).toEqual([true, false]);
    expect(h.w.alatLipatBawaanTerbuka([])("a")).toBe(false);
  });

  it("alatLipat terbuka:false menutup bila belum diingat; ingatan orang menang", async () => {
    const h = halaman({ simpanan: { lipatTerbuka: { "uji:diingat": true } } });
    await h.w.alatMuatLipat();
    const a = h.w.alatLipat("A", { kunci: "uji:baru", terbuka: false });
    const b = h.w.alatLipat("B", { kunci: "uji:diingat", terbuka: false });
    expect(a.terbuka()).toBe(false);
    expect(a.isi.hidden).toBe(true);
    expect(b.terbuka()).toBe(true);
  });
});

// ============================================================================
describe("K4 / butir 14 - alatJedaManusia", () => {
  it("rentang per jenis; jenis tak dikenal = simpan", () => {
    const h = halaman();
    expect(polos(h.w.alatJedaManusiaRentang("klik"))).toEqual([350, 900]);
    expect(polos(h.w.alatJedaManusiaRentang("unggah"))).toEqual([1500, 3500]);
    expect(polos(h.w.alatJedaManusiaRentang("perkara"))).toEqual([2000, 4500]);
    expect(polos(h.w.alatJedaManusiaRentang("entah"))).toEqual([900, 2200]);
    expect(polos(h.w.alatJedaManusiaRentang())).toEqual([900, 2200]);
  });

  it("benar-benar menunggu dalam rentang (skala diperkecil agar uji cepat)", async () => {
    const h = halaman();
    h.w.alatSetelJedaSkala(0.02); // klik 7..18 ms
    const mulai = Date.now();
    const ms = await h.w.alatJedaManusia("klik");
    const lama = Date.now() - mulai;
    expect(ms).toBeGreaterThanOrEqual(7);
    expect(ms).toBeLessThanOrEqual(18);
    expect(lama).toBeGreaterThanOrEqual(ms - 2);
  });

  it("mode kering: seketika 0", async () => {
    const h = halaman();
    await h.w.alatSetelKering(true);
    expect(await h.w.alatJedaManusia("unggah")).toBe(0);
  });

  it("mode latihan: seketika 0", async () => {
    const h = halaman({ simpanan: { modeLatihan: true } });
    await h.w.alatMuatLatihan();
    expect(h.w.alatLatihanNyala()).toBe(true);
    expect(await h.w.alatJedaManusia("simpan")).toBe(0);
  });

  it("sinyal dibatalkan: selesai seketika 0; skala 0 = tanpa jeda", async () => {
    const h = halaman();
    const c = new h.w.AbortController();
    const janji = h.w.alatJedaManusia("perkara", { sinyal: c.signal });
    c.abort();
    expect(await janji).toBe(0);
    h.w.alatSetelJedaSkala(0);
    expect(await h.w.alatJedaManusia("perkara")).toBe(0);
  });

  it("panel-alat.js tidak menyisipkan kata ALETA ke nilai isian milik halaman (pemeriksa teks)", () => {
    // Penjaga kasar: tidak ada penulisan .value = "...ALETA..." ke isian halaman.
    expect(SUMBER_ALAT).not.toMatch(/\.value\s*=\s*[`"'][^`"'\n]*ALETA/);
  });
});

// ============================================================================
// butir 1 (K7) - kepala dan kaki panel portal = panel SIPP/ABT (UI Baru)
// ============================================================================
const SIAPA = {
  nama: "Derry Briantono",
  peran: "Super Admin",
  roleId: "super-admin",
  kapabilitas: { panel: true },
  keterangan: {},
  menu: [],
  bolehMengatur: true,
  versiEkstensi: "1.178.0",
};
const jawabPortal: Jawab = (url) => (url.includes("/ekstensi/siapa") ? { ok: true, data: SIAPA } : undefined);
function halamanPortal(simpanan: Record<string, unknown>) {
  return halaman({
    alamat: `${ASAL}/aleta/aleta-ecourt`,
    simpanan: { aktif: true, ...simpanan },
    tambahan: [["aleta.js", SUMBER_ALETA]],
    jawab: jawabPortal,
  });
}
const panelPortal = (h: ReturnType<typeof halaman>) => h.d.getElementById("aleta-panel-portal") as any;

describe("butir 1 (K7) - kepala dan kaki panel portal", () => {
  it("UI Baru: tombol ☀ – ⛶ ⟲ × tampil di deret kepala, ⌕/⋯ di dalam deret sebelum ☀; '?' di kiri kaki", async () => {
    const h = halamanPortal({ ujiTampilan: "ui", ujiFitur: {}, panelBawaanTampil: { aleta: true, diubahPada: "2026-10-02T00:00:00Z" } });
    const panel = await sampai(() => {
      const p = panelPortal(h);
      return p && p.getAttribute("data-w2-kepala") === "sama" ? p : null;
    }, "panel UI Baru");
    const deret = panel.querySelector(".aleta-kepala .aleta-alat-kepala");
    const urut = Array.from(deret.children as HTMLCollection).map((x: any) => String(x.className).split(" ")[0]);
    const iMenu = urut.indexOf("aleta-t4-kepala-utama");
    expect(iMenu).toBeGreaterThanOrEqual(0);
    expect(iMenu).toBeLessThan(urut.indexOf("aleta-tema"));
    for (const k of ["aleta-tema", "aleta-lipat", "aleta-penuh", "aleta-bawaan", "aleta-matikan"]) expect(urut, k).toContain(k);
    expect(deret.querySelector(".aleta-t4-menu-tombol")).not.toBeNull();
    // Menu ⋯ tetap lengkap - tidak ada yang dikurangi.
    const butir = Array.from(panel.querySelectorAll(".aleta-t4-menu-butir .aleta-t4-menu-teks")).map((x: any) => x.textContent);
    expect(butir).toEqual(expect.arrayContaining(["Tema gelap / terang", "Ciutkan ke lencana", "Layar penuh", "Tutup panel"]));
    // Kaki: ˄ ? ↻ v (satu baris rata kiri seperti SIPP).
    const kiri = panel.querySelector(".aleta-kaki .aleta-kaki-kiri");
    expect(kiri.querySelector(".aleta-t4-tanya")).not.toBeNull();
    // Aturan rupa: tombol lama TAMPIL lagi, deret Alt+... tidak memakan ruang.
    expect(BLOK_W2).toMatch(/\[data-w2-kepala="sama"\] \.aleta-alat-kepala > \.aleta-matikan \{\s*display: inline-block !important;/);
    expect(BLOK_W2).toMatch(/\[data-w2-kepala="sama"\] \.aleta-kaki-pintasan \{ display: none !important; \}/);
  });

  it("Lama dan Baru: tidak ada data-w2-kepala, '?' (Baru) tetap di tempat lamanya", async () => {
    const lama = halamanPortal({});
    const pl = await sampai(() => panelPortal(lama), "panel Lama");
    await tunggu(150);
    expect(pl.hasAttribute("data-w2-kepala")).toBe(false);
    expect(pl.querySelector(".aleta-alat-kepala .aleta-t4-kepala-utama")).toBeNull();

    const baru = halamanPortal({ ujiTampilan: "baru", ujiFitur: { "portal-27": true } });
    const pb = await sampai(() => {
      const p = panelPortal(baru);
      return p && p.getAttribute("data-t4") === "baru" ? p : null;
    }, "panel Baru");
    expect(pb.hasAttribute("data-w2-kepala")).toBe(false);
    const tanya = pb.querySelector(".aleta-t4-tanya");
    expect(tanya.parentElement.classList.contains("aleta-kaki-baris")).toBe(true);
  });
});

// ============================================================================
// butir 4 - panel terbuka/tersembunyi saat halaman dimuat
// ============================================================================
describe("butir 4 - bawaan tampil per situs", () => {
  it("alatBawaanTampilBerlaku: 21 Okt 2026 SEMUA tersembunyi (lencana); pilihan sebelum keputusan itu tidak berlaku; yang lebih baru menang", () => {
    const h = halaman();
    const f = (l: unknown, s: unknown) => polos(h.w.alatBawaanTampilBerlaku(l, s));
    expect(f(null, undefined)).toEqual({ aleta: false, sipp: false, abt: false, sumber: "bawaan" });
    // Pilihan "terbuka" yang disimpan SEBELUM 21 Okt 2026 16.00 WITA tidak lagi membuka panel.
    expect(f({ sipp: true, abt: true, diubahPada: "2026-10-02T02:00:00Z" }, { nilai: { aleta: true }, diubahPada: "2026-10-02T01:00:00Z" })).toEqual({
      aleta: false,
      sipp: false,
      abt: false,
      sumber: "bawaan",
    });
    const lokal = { sipp: true, diubahPada: "2026-10-22T02:00:00Z" };
    const akun = { nilai: { aleta: true, abt: true }, diubahPada: "2026-10-22T01:00:00Z" };
    expect(f(lokal, akun)).toEqual({ aleta: false, sipp: true, abt: false, sumber: "lokal" });
    expect(f({ ...lokal, diubahPada: "2026-10-01T00:00:00Z" }, akun)).toEqual({ aleta: true, sipp: false, abt: true, sumber: "akun" });
    // Ruas asing dan bukan boolean dibuang.
    expect(f({ aleta: "ya", lain: true, diubahPada: "2026-10-22T00:00:00Z" }, null)).toEqual({ aleta: false, sipp: false, abt: false, sumber: "lokal" });
    expect(h.w.alatSitusPanel("posisiPanelAleta")).toBe("aleta");
    expect(h.w.alatSitusPanel("posisiPanelAbtMassal")).toBe("abt");
    expect(h.w.alatSitusPanel("posisiPanel")).toBe("sipp");
  });

  it("UI Baru portal tanpa setelan: panel ALETA lahir sebagai lencana (tetap ada, dapat dibuka)", async () => {
    const h = halamanPortal({ ujiTampilan: "ui", ujiFitur: {} });
    const panel = await sampai(() => {
      const p = panelPortal(h);
      return p && p.classList.contains("aleta-panel-lencana") ? p : null;
    }, "lencana");
    expect(panel.getAttribute("data-aleta-bawaan-tersembunyi")).toBe("ya");
  });

  it("UI Baru portal dengan aleta:true - terbuka; Lama tanpa setelan - terbuka (tidak berubah)", async () => {
    const buka = halamanPortal({ ujiTampilan: "ui", ujiFitur: {}, panelBawaanTampil: { aleta: true, diubahPada: "2026-10-22T00:00:00Z" } });
    const pb = await sampai(() => {
      const p = panelPortal(buka);
      return p && p.getAttribute("data-t4") === "ui" ? p : null;
    }, "panel ui");
    await tunggu(200);
    expect(pb.classList.contains("aleta-panel-lencana")).toBe(false);

    const lama = halamanPortal({});
    const pl = await sampai(() => panelPortal(lama), "panel lama");
    await tunggu(250);
    expect(pl.classList.contains("aleta-panel-lencana")).toBe(false);
    expect(pl.hasAttribute("data-aleta-bawaan-tersembunyi")).toBe(false);
  });

  it("SIPP (opsi.ciutkan milik konten.js): diciutkan SEKALI per muat halaman walau panel digambar ulang", async () => {
    const h = halaman({ simpanan: { ujiTampilan: "ui", panelBawaanTampil: { sipp: false, diubahPada: "2026-10-02T00:00:00Z" } } });
    await h.w.alatUjiSiap();
    let ciut = 0;
    const gambar = () => {
      const p = h.d.createElement("div");
      p.id = "aleta-panel-sipp";
      h.d.body.appendChild(p);
      h.w.alatPasangJalanKeluar(p, "posisiPanel", { ciutkan: () => (ciut += 1) });
      return p;
    };
    gambar();
    await sampai(() => ciut === 1, "diciutkan");
    h.d.getElementById("aleta-panel-sipp")!.remove();
    gambar();
    await tunggu(150);
    expect(ciut).toBe(1);
  });

  it("21 Okt 2026: ABT bawaan TERSEMBUNYI - diciutkan sekali; pilihan lama 'terbuka' tidak berlaku, pilihan baru berlaku", async () => {
    const pasang = async (simpanan: Record<string, unknown>) => {
      const h = halaman({ alamat: `${ASAL}/aps_badilag/abt/main/beranda`, simpanan: { ujiTampilan: "ui", ...simpanan } });
      await h.w.alatUjiSiap();
      const p = h.d.createElement("div");
      h.d.body.appendChild(p);
      let ciut = 0;
      h.w.alatPasangJalanKeluar(p, "posisiPanelAbt", { ciutkan: () => (ciut += 1) });
      await tunggu(200);
      return ciut;
    };
    expect(await pasang({})).toBe(1);
    expect(await pasang({ panelBawaanTampil: { abt: true, diubahPada: "2026-10-02T00:00:00Z" } })).toBe(1);
    expect(await pasang({ panelBawaanTampil: { abt: true, diubahPada: "2026-10-22T00:00:00Z" } })).toBe(0);
  });

  it("setelan akun 'panel.bawaan' disinggahkan HANYA bila portal mengirimnya", () => {
    const h = halaman();
    expect(polos(h.w.alatSetelanDariJawaban({ setelan: {} }))).toEqual({ "widget.tata": null });
    const isi = { nilai: { aleta: true }, diubahPada: "2026-10-02T00:00:00.000Z" };
    expect(polos(h.w.alatSetelanDariJawaban({ setelan: { "panel.bawaan": isi } }))).toEqual({ "widget.tata": null, "panel.bawaan": isi });
    expect(polos(h.w.alatBersihSetelanSinggah({ "panel.bawaan": isi }))).toEqual({ "panel.bawaan": isi });
  });

  it("daftar putih server: panel.bawaan diizinkan, boolean saja, ruas asing dibuang", () => {
    expect(KUNCI_SETELAN).toContain("panel.bawaan");
    const hasil = normalkanSetelan("panel.bawaan", { aleta: true, sipp: false, posisi: 3 });
    expect(hasil.nilai).toEqual({ aleta: true, sipp: false });
    expect(hasil.dibuang).toEqual(["posisi"]);
    expect(() => normalkanSetelan("panel.bawaan", { aleta: "ya" })).toThrow(GalatSetelan);
    expect(() => normalkanSetelan("panel.bawaan", [true])).toThrow(GalatSetelan);
  });
});

// ── popup: tiga saklar ──
function bukaPopup(simpan: Record<string, unknown>) {
  const html = HTML_POPUP.replace(/<script[\s\S]*?<\/script>/g, "");
  const dom = new JSDOM(html, { url: "chrome-extension://aleta/popup.html", runScripts: "outside-only" }) as JsdomUji;
  terbuka.push(dom);
  const w = dom.window as any;
  const simpanan: Record<string, unknown> = { asalPortal: `${ASAL}/aleta`, ...simpan };
  w.chrome = {
    runtime: { id: "aleta-uji", getManifest: () => ({ version: "1.178.0", host_permissions: [] }), sendMessage: async () => ({}) },
    storage: {
      local: {
        get: async (kunci?: string | string[] | null) => {
          const daftar = kunci == null ? Object.keys(simpanan) : [kunci].flat();
          const hasil: Record<string, unknown> = {};
          for (const x of daftar) if (x in simpanan) hasil[x] = polos(simpanan[x]);
          return hasil;
        },
        set: async (isi: Record<string, unknown>) => void Object.assign(simpanan, polos(isi)),
        remove: async () => undefined,
      },
      session: { get: async () => ({}), set: async () => undefined },
      onChanged: { addListener() {} },
    },
  };
  const panggilan: Array<{ alamat: string; cara: string; badan?: string }> = [];
  w.fetch = async (alamat: string, init?: { method?: string; body?: string }) => {
    const a = String(alamat);
    const cara = String((init && init.method) || "GET").toUpperCase();
    panggilan.push({ alamat: a, cara, badan: init && init.body });
    if (a.includes("info=siapa")) {
      return { ok: true, status: 200, json: async () => ({ ok: true, data: { pengguna: { nama: "Uji", peran: "Super Admin" }, versi: "1.178.0" } }) };
    }
    if (cara === "PUT") {
      const b = JSON.parse(String(init && init.body));
      return { ok: true, status: 200, json: async () => ({ ok: true, data: { kunci: b.kunci, nilai: b.nilai, diubahPada: "2026-10-02T03:00:00.000Z" } }) };
    }
    return { ok: true, status: 200, url: a, json: async () => ({}) };
  };
  const ctx = dom.getInternalVMContext();
  vm.runInContext(SUMBER_DAFTAR_FITUR, ctx, { filename: "daftar-fitur.js" });
  vm.runInContext(SUMBER_POPUP, ctx, { filename: "popup.js" });
  return { w, d: w.document as Document, simpanan, panggilan };
}

describe("butir 4 - popup UI Baru: tiga saklar panel saat halaman dibuka", () => {
  it("21 Okt 2026: bawaan KETIGANYA mati (terlipat); mengubah = cadangan lokal + PUT setelan akun panel.bawaan", async () => {
    const p = bukaPopup({ ujiTampilan: "ui", ujiFitur: {}, tampilanServer: { mode: "lama", fitur: {}, diterapkan: false, versi: "", diambil: Date.now() } });
    const kotak = await sampai(() => p.d.getElementById("bawaanPanel-sipp") as HTMLInputElement | null, "saklar popup");
    expect((p.d.getElementById("bawaanPanel-aleta") as HTMLInputElement).checked).toBe(false);
    expect(kotak.checked).toBe(false);
    expect((p.d.getElementById("bawaanPanel-abt") as HTMLInputElement).checked).toBe(false);
    kotak.checked = true;
    kotak.dispatchEvent(new p.w.Event("change", { bubbles: true }));
    await sampai(() => p.panggilan.some((x) => x.cara === "PUT"), "PUT");
    const put = p.panggilan.find((x) => x.cara === "PUT")!;
    expect(put.alamat).toBe(`${ASAL}/aleta/api/aleta-ecourt/ekstensi/setelan`);
    expect(JSON.parse(put.badan!)).toEqual({ kunci: "panel.bawaan", nilai: { aleta: false, sipp: true, abt: false } });
    expect((p.simpanan.panelBawaanTampil as any).sipp).toBe(true);
    await sampai(() => (p.simpanan.tampilanServer as any)?.setelan?.["panel.bawaan"], "singgahan diperbarui");
    await sampai(() => /akun Anda/.test(p.d.getElementById("bawaanPanelKabar")!.textContent || ""), "kabar");
  });

  it("mode latihan: lokal saja, tanpa PUT; tampilan Lama: tidak ada saklarnya", async () => {
    const p = bukaPopup({ ujiTampilan: "ui", ujiFitur: {}, modeLatihan: true });
    const kotak = await sampai(() => p.d.getElementById("bawaanPanel-abt") as HTMLInputElement | null, "saklar");
    kotak.checked = true;
    kotak.dispatchEvent(new p.w.Event("change", { bubbles: true }));
    await sampai(() => /Mode latihan/.test(p.d.getElementById("bawaanPanelKabar")!.textContent || ""), "kabar latihan");
    expect(p.panggilan.filter((x) => x.cara === "PUT")).toEqual([]);
    expect((p.simpanan.panelBawaanTampil as any).abt).toBe(true);

    const lama = bukaPopup({});
    await tunggu(150);
    expect(lama.d.getElementById("kelompok-bawaan-panel")).toBeNull();
  });
});

// ============================================================================
// butir 11 - klik dua kali di sudut = pindah ke sudut itu
// ============================================================================
function panelUji(h: ReturnType<typeof halaman>, id: string, kotak = { left: 100, top: 50, width: 400, height: 600 }) {
  const p = h.d.createElement("div");
  p.id = id;
  p.className = "aleta-panel";
  const kepala = h.d.createElement("div");
  kepala.className = "aleta-kepala";
  const penuh = h.d.createElement("button");
  penuh.className = "aleta-penuh";
  let ditekanPenuh = 0;
  penuh.addEventListener("click", () => (ditekanPenuh += 1));
  kepala.appendChild(penuh);
  p.appendChild(kepala);
  h.d.body.appendChild(p);
  const r = { ...kotak, right: kotak.left + kotak.width, bottom: kotak.top + kotak.height, x: kotak.left, y: kotak.top };
  p.getBoundingClientRect = () => r as DOMRect;
  return { p, kepala, penuh: () => ditekanPenuh };
}
const tikus = (h: ReturnType<typeof halaman>, sasaran: EventTarget, jenis: string, x: number, y: number) =>
  sasaran.dispatchEvent(new h.w.MouseEvent(jenis, { bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y, detail: 2 }));

describe("butir 11 - sudut panel", () => {
  it("alatSudutDari: pojok terdekat dalam batas; tengah tepi bukan sudut", () => {
    const h = halaman();
    const k = { left: 0, top: 0, right: 400, bottom: 600 };
    expect(h.w.alatSudutDari(k, 5, 5, 20, 0)).toBe("ki-at");
    expect(h.w.alatSudutDari(k, 395, 3, 20, 0)).toBe("ka-at");
    expect(h.w.alatSudutDari(k, 2, 590, 20, 0)).toBe("ki-bw");
    expect(h.w.alatSudutDari(k, 399, 599, 20, 0)).toBe("ka-bw");
    expect(h.w.alatSudutDari(k, 200, 5, 20, 0)).toBe("");
    expect(h.w.alatSudutDari(k, -10, -10, 36, 14)).toBe("ki-at");
    expect(h.w.alatSudutDari(k, -10, -10, 20, 0)).toBe("");
  });

  it("UI Baru: mendekat = sorot; klik dua kali di pojok kanan atas = pindah + tersimpan digabung; kepala TIDAK ke layar penuh", async () => {
    const h = halaman({
      alamat: `${ASAL}/aps_badilag/abt/main/view`,
      // 21 Okt 2026: panel ABT bawaannya lencana; uji sudut memakai panel yang disetel terbuka.
      simpanan: { ujiTampilan: "ui", posisiPanelAbt: { lebar: 400, kiri: 5, atas: 5 }, panelBawaanTampil: { abt: true, diubahPada: "2026-10-22T00:00:00Z" } },
    });
    await h.w.alatUjiSiap();
    const { p, kepala, penuh } = panelUji(h, "aleta-panel-abt");
    h.w.alatPasangJalanKeluar(p, "posisiPanelAbt");
    h.w.alatPasangKlikGandaKepala(p, "posisiPanelAbt", kepala);
    tikus(h, h.d, "pointermove", 495, 55);
    const sorot = await sampai(() => p.querySelector(".aleta-sudut-sorot"), "sorot");
    expect(sorot.getAttribute("data-sudut")).toBe("ka-at");
    expect(p.getAttribute("data-aleta-sudut-dekat")).toBe("ka-at");
    tikus(h, h.d, "pointermove", 300, 300);
    await sampai(() => !p.querySelector(".aleta-sudut-sorot"), "sorot hilang");

    tikus(h, kepala, "dblclick", 495, 55);
    expect(p.style.left).toBe(`${h.w.innerWidth - 400 - 12}px`);
    expect(p.style.top).toBe("12px");
    expect(penuh()).toBe(0);
    await sampai(() => (h.simpanan.posisiPanelAbt as any).atas === 12, "tersimpan");
    expect(h.simpanan.posisiPanelAbt).toEqual({ lebar: 400, kiri: h.w.innerWidth - 412, atas: 12 });
    // Klik dua kali kepala di LUAR sudut tetap layar penuh.
    tikus(h, kepala, "dblclick", 300, 60);
    expect(penuh()).toBe(1);
  });

  it("Lama: klik dua kali di sudut tidak memindahkan, tidak ada sorot", async () => {
    const h = halaman({ simpanan: {} });
    await h.w.alatUjiSiap();
    const { p, kepala } = panelUji(h, "aleta-panel-abt");
    h.w.alatPasangJalanKeluar(p, "posisiPanelAbt");
    tikus(h, h.d, "pointermove", 495, 55);
    tikus(h, kepala, "dblclick", 495, 55);
    await tunggu(60);
    expect(p.style.left).toBe("");
    expect(p.querySelector(".aleta-sudut-sorot")).toBeNull();
  });

  it("panel berlabuh (labuh kanan SIPP, layar lebar) tidak dipindah; dengan pindahKeSudut pemiliknya yang memutuskan", async () => {
    const h = halaman({ simpanan: { ujiTampilan: "ui" } });
    await h.w.alatUjiSiap();
    Object.defineProperty(h.w, "innerWidth", { value: 1400, configurable: true });
    h.d.documentElement.setAttribute("data-aleta-sipp-labuh", "kanan");
    const a = panelUji(h, "aleta-panel-sipp");
    h.w.alatPasangJalanKeluar(a.p, "posisiPanel", { ciutkan: () => undefined });
    tikus(h, a.kepala, "dblclick", 105, 55);
    expect(a.p.style.left).toBe("");
    a.p.remove();
    const dipanggil: string[] = [];
    const b = panelUji(h, "aleta-panel-sipp");
    h.w.alatPasangJalanKeluar(b.p, "posisiPanel", { ciutkan: () => undefined, pindahKeSudut: (s: string) => dipanggil.push(s) });
    tikus(h, b.kepala, "dblclick", 105, 645);
    expect(dipanggil).toEqual(["ki-bw"]);
  });

  it("klik dua kali di sudut panel A bukan 'klik di luar' yang menciutkan panel B", async () => {
    const h = halaman({ simpanan: { ujiTampilan: "ui" } });
    await h.w.alatUjiSiap();
    const a = panelUji(h, "aleta-panel-abt");
    h.w.alatPasangJalanKeluar(a.p, "posisiPanelAbt");
    const b = panelUji(h, "aleta-panel-abt-massal", { left: 600, top: 50, width: 300, height: 300 });
    let ciutB = 0;
    h.w.alatPasangJalanKeluar(b.p, "posisiPanelAbtMassal", { ciutkan: () => (ciutB += 1) });
    tikus(h, a.kepala, "dblclick", 105, 55);
    expect(ciutB).toBe(0);
    // Klik dua kali di halaman (bukan sudut) tetap menciutkan seperti biasa.
    tikus(h, h.d.body, "dblclick", 20, 700);
    expect(ciutB).toBe(1);
  });

  it("rupa sorot ada di blok W2 (dan salinannya di GAYA widget)", () => {
    for (const s of ["ki-at", "ka-at", "ki-bw", "ka-bw"]) {
      expect(BLOK_W2).toContain(`.aleta-sudut-sorot[data-sudut="${s}"]`);
      expect(SUMBER_CHECKLIST).toContain(`.aleta-sudut-sorot[data-sudut="${s}"]`);
    }
  });
});

// ============================================================================
// butir 13 - widget checklist: bawaan hanya checklist; atur bagian di kepala
// ============================================================================
function jawabanChecklist() {
  const kini = new Date();
  const b = (id: string, hari: number, kelompok: string) => {
    const t = new Date(kini);
    t.setDate(t.getDate() + hari);
    return {
      id,
      jenis: "pmh",
      judul: `Butir ${id}`,
      perkara: { id: 1000 + hari, nomor: `${400 + hari}/Pdt.G/2026/PA.Dgl` },
      tenggat: t.toISOString(),
      kelompok,
      keterangan: "",
      kerjakan: { tujuan: "sipp", halaman: "penetapan" },
    };
  };
  return {
    ok: true,
    data: {
      pengguna: { nama: "Hakim Uji", peran: ["hakim"] },
      peranTersedia: [{ kunci: "hakim", label: "Hakim" }],
      peranAktif: "hakim",
      dibuat: kini.toISOString(),
      ringkas: { lewat: 1, hariIni: 1, mingguIni: 0, selesaiHariIni: 0, totalHariIni: 1 },
      butir: [b("l1", -1, "lewat"), b("h1", 0, "hari-ini")],
      jenisTidakTersedia: [],
      galat: [],
    },
  };
}
const SEMUA_WIDGET = { "popup-20": true, "popup-21": true, "popup-22": true };
function halamanWidget(simpanan: Record<string, unknown>, sumber = SUMBER_CHECKLIST) {
  // Sejak 12 Okt widget BAWAAN TERTUTUP; uji-uji ini menguji isinya yang terbentang,
  // jadi dimulai dari posisi tersimpan "terbentang" kecuali disebut lain.
  const terbentang = { posisiChecklistSipp: { kecil: false }, posisiChecklistAbt: { kecil: false }, posisiChecklistAleta: { kecil: false } };
  const h = halaman({
    simpanan: { checklistMilestone: true, ...terbentang, ...simpanan },
    tambahan: [["checklist.js", sumber]],
    jawab: (url) => (url.includes("/aleta-ecourt/checklist") ? jawabanChecklist() : undefined),
  });
  h.d.addEventListener("click", (e: any) => e.preventDefault(), true);
  const akar = () => h.d.querySelector("aleta-cm-widget") as any;
  const q = (s: string) => (akar() && akar().shadowRoot ? (akar().shadowRoot.querySelector(s) as any) : null);
  const qs = (s: string) => (akar() && akar().shadowRoot ? (Array.from(akar().shadowRoot.querySelectorAll(s)) as any[]) : []);
  return { ...h, akar, q, qs };
}
// Widget GALERI saja; kehadiran & draf H-7 (saklar sendiri di popup) diperiksa terpisah.
const tumpukWidget = (h: ReturnType<typeof halamanWidget>) =>
  h
    .qs(".aleta-cmw-tumpuk > *")
    .map((x: any) => x.getAttribute("data-widget-isi") || "checklist")
    .filter((id: string) => id !== "kehadiran" && id !== "drafH7");
const dokSiap = (h: ReturnType<typeof halamanWidget>) => sampai(() => h.q(".aleta-cmw-dok") && h.q(".aleta-cm-kelompok"), "dok");

describe("butir 13 - checklist milestone: bawaan hanya checklist", () => {
  it("UI Baru tanpa susunan tersimpan: hanya checklist, walau saklar fitur bagian lain menyala", async () => {
    const h = halamanWidget({ ujiTampilan: "ui", ujiFitur: { ...SEMUA_WIDGET } });
    await dokSiap(h);
    expect(tumpukWidget(h)).toEqual(["checklist"]);
  });

  it("butir 41 (17 Okt): kehadiran & draf H-7 bawaan MENYALA di UI Baru, tampil TERLIPAT di dok kiri bawah; Baru tanpa saklar tidak", async () => {
    const h = halamanWidget({ ujiTampilan: "ui", ujiFitur: {} });
    await dokSiap(h);
    const kotak = await sampai(() => {
      const k = h.qs(".aleta-cmw-dok .aleta-cmw-tumpuk > [data-widget-isi]").filter((x: any) => ["kehadiran", "drafH7"].includes(x.getAttribute("data-widget-isi")));
      return k.length === 2 ? k : null;
    }, "dua kotak saklar sendiri");
    // 23 Okt 2026: kedua kotak tersembunyi bawaannya (uji ini memintanya ditampilkan); yang dibuka sengaja terbentang.
    for (const k of kotak) {
      expect(k.getAttribute("data-terbuka"), k.getAttribute("data-widget-isi")).toBe("ya");
      expect(k.querySelector(".aleta-lipat-kepala").getAttribute("aria-expanded")).toBe("true");
    }
    const baru = halamanWidget({ ujiTampilan: "baru", ujiFitur: {} });
    await sampai(() => baru.q(".aleta-cm-kelompok") || baru.q(".aleta-cm-isi"), "widget Baru");
    expect(baru.q("[data-kehadiran-widget]")).toBeNull();
    expect(baru.q("[data-draf-h7-widget]")).toBeNull();
  });

  it("susunan tersimpan (tata sendiri) tetap dipakai", async () => {
    const h = halamanWidget({ ujiTampilan: "ui", ujiFitur: { ...SEMUA_WIDGET }, susunanWidget: { semua: { urutan: [], mati: ["lama-sidang"] } } });
    await dokSiap(h);
    await sampai(() => tumpukWidget(h).join() === "checklist,catatan,kalender", "tata sendiri");
  });

  it("Baru (kulit Klasik) tidak berubah: bagian yang saklarnya menyala tetap bertumpuk", async () => {
    const h = halamanWidget({ ujiTampilan: "baru", ujiFitur: { "popup-20": true } });
    await sampai(() => h.q(".aleta-cmw-tumpuk-klasik"), "tumpuk klasik");
    expect(h.q('.aleta-cmw-tumpuk-klasik [data-widget-isi="catatan"]')).not.toBeNull();
    expect(h.q(".aleta-cm-bagian-tombol")).toBeNull();
  });

  it("☰ di kepala checklist: saklar tiap bagian - menampilkan Catatan cepat menyimpan susunan (satu sumber dengan Atur widget)", async () => {
    const h = halamanWidget({ ujiTampilan: "ui", ujiFitur: { "popup-20": true, "popup-22": true } });
    await dokSiap(h);
    const tombol = h.q(".aleta-cm-kepala .aleta-cm-bagian-tombol");
    expect(tombol).not.toBeNull();
    expect(tombol.getAttribute("aria-expanded")).toBe("false");
    tombol.click();
    const menu = await sampai(() => h.q(".aleta-cm-bagian-menu"), "menu bagian");
    const baris = Array.from(menu.querySelectorAll(".aleta-cm-bagian-baris")).map((b: any) => b.getAttribute("data-bagian"));
    expect(baris).toEqual(["catatan", "lama-sidang", "kalender"]);
    // Yang menyusul disebut sebaris, bukan tujuh saklar mati.
    expect(menu.querySelector(".aleta-cm-bagian-ket").textContent).toMatch(/^Menyusul: Jadwal sidang saya, Antrean/);
    const saklar = (id: string) => h.q(`.aleta-cm-bagian-baris[data-bagian="${id}"] .aleta-cmw-saklar`);
    expect(saklar("catatan").getAttribute("aria-checked")).toBe("false");
    expect(saklar("lama-sidang").disabled).toBe(true); // popup-21 mati
    saklar("catatan").click();
    await sampai(() => tumpukWidget(h).includes("catatan"), "catatan tampil");
    expect((h.simpanan.susunanWidget as any).semua.mati).not.toContain("catatan");
    expect((h.simpanan.susunanWidget as any).semua.mati).toContain("kalender");
    // "Atur lengkap" membuka Atur widget.
    h.q('[data-fokus="bagian-atur"]').click();
    await sampai(() => h.q(".aleta-cmw-atur"), "atur widget");
  });

  it("PENJAGA MENGGIGIT: tanpa susunanBawaan, bagian lain tampil lagi (uji pertama akan merah)", async () => {
    const rusak = SUMBER_CHECKLIST.replace("return s || susunanBawaan();", "return s || { urutan: [], mati: [] };");
    expect(rusak).not.toBe(SUMBER_CHECKLIST);
    const h = halamanWidget({ ujiTampilan: "ui", ujiFitur: { ...SEMUA_WIDGET } }, rusak);
    await dokSiap(h);
    await sampai(() => tumpukWidget(h).length === 4, "semua tampil");
  });
});

describe("butir 11 - widget checklist: klik dua kali di sudut", () => {
  it("UI Baru: pojok kanan atas widget -> widget pindah ke kanan atas layar (posisi tersimpan)", async () => {
    const h = halamanWidget({ ujiTampilan: "ui", ujiFitur: {} });
    await dokSiap(h);
    const wadah = h.q(".aleta-cm-wadah");
    const r = { left: 12, top: 400, right: 312, bottom: 756, width: 300, height: 356, x: 12, y: 400 };
    wadah.getBoundingClientRect = () => r;
    h.akar().getBoundingClientRect = () => r;
    tikus(h, wadah, "dblclick", 308, 404);
    await sampai(() => (h.simpanan.posisiChecklistSipp as any)?.bawah > 12, "tersimpan");
    expect(h.simpanan.posisiChecklistSipp).toEqual({ kecil: false, kiri: h.w.innerWidth - 300 - 12, bawah: h.w.innerHeight - 356 - 12 });
  });
});

// ============================================================================
// butir 16b - golongan peran
// ============================================================================
describe("butir 16b - alatGolonganPeran: kepaniteraan bukan panitera", () => {
  it("Staf Kepaniteraan / Kepaniteraan Hukum = lain; Panitera* tetap panitera", () => {
    const h = halaman();
    expect(h.w.alatGolonganPeran("Staf Kepaniteraan")).toBe("lain");
    expect(h.w.alatGolonganPeran("Kepaniteraan Hukum")).toBe("lain");
    expect(h.w.alatGolonganPeran("Panitera Pengganti")).toBe("panitera");
    expect(h.w.alatGolonganPeran("Panitera Muda Hukum")).toBe("panitera");
    expect(h.w.alatGolonganPeran("panitera-sidang")).toBe("panitera");
    expect(h.w.alatGolonganPeran("Operator SIPP")).toBe("lain");
    expect(h.w.alatGolonganPeran("Analis Perkara Peradilan")).toBe("lain");
  });
});
