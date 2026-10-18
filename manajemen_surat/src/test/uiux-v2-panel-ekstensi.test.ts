// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

/**
 * ============================================================================
 * V2 (18 Okt 2026) - PANEL EKSTENSI UNTUK LAPTOP KECIL SAMPAI TV
 * ============================================================================
 *
 * Yang dijaga:
 *   1. Blok "V2 LAYAR" di panel.css HANYA mengatur ukuran - tidak ada
 *      display:none / visibility:hidden / opacity:0, jadi tidak ada tombol,
 *      tab, atau aksi yang lenyap di layar sempit (fitur lama tidak berkurang).
 *   2. Lebar panel dan huruf mengikuti layar lewat peubah (bukan angka tetap),
 *      panel berlabuh mulai 900px (zoom Windows 125-150% di laptop 1366), dan
 *      tidak pernah melebihi 55% layar.
 *   3. Pada lebar 1280, kode SUNGGUHAN (panel-alat.js + konten.js / abt.js di
 *      jsdom) tetap menggambar SEMUA tab, tombol kepala, dan tombol kerja.
 *   4. Widget kiri bawah dan popup membawa penyesuaian yang sama.
 *   5. Tanpa label teknis dan tanpa token yang tidak ada (bg-popover).
 */

const AKAR = path.resolve(process.cwd(), "../ekstensi-sipp");
const baca = (b: string) => readFileSync(path.join(AKAR, b), "utf8").replace(/\r\n/g, "\n");
const CSS = baca("panel.css");
const ALAT = baca("panel-alat.js");
const KONTEN = baca("konten.js");
const ABT = baca("abt.js");
const CHECKLIST = baca("checklist.js");
const POPUP = baca("popup.html");

const AWAL_V2 = CSS.indexOf("V2 LAYAR (18 Okt 2026)");
const BLOK_V2 = AWAL_V2 > 0 ? CSS.slice(CSS.lastIndexOf("/*", AWAL_V2)) : "";
const BLOK_V2_TANPA_KOMENTAR = BLOK_V2.replace(/\/\*[\s\S]*?\*\//g, "");

const ASAL = "http://192.168.10.10";
const NOMOR = "450/Pdt.G/2026/PA.Dgl";
const polos = <T>(x: T): T => (x === undefined ? x : JSON.parse(JSON.stringify(x)));
const tunggu = (ms = 0) => new Promise((r) => setTimeout(r, ms));
async function sampai<T>(periksa: () => T, keterangan: string, batas = 6000): Promise<NonNullable<T>> {
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
    await tunggu(15);
  }
}

// ============================================================================
describe("V2: blok panel.css hanya mengatur ukuran", () => {
  it("penandanya ada dan bloknya cukup besar", () => {
    expect(AWAL_V2).toBeGreaterThan(0);
    expect(BLOK_V2.length).toBeGreaterThan(1500);
    expect(CSS.lastIndexOf("V2 LAYAR (18 Okt 2026)")).toBe(AWAL_V2);
  });

  it("tidak menyembunyikan apa pun", () => {
    expect(BLOK_V2_TANPA_KOMENTAR).not.toMatch(/display:\s*none/);
    expect(BLOK_V2_TANPA_KOMENTAR).not.toMatch(/visibility:\s*hidden/);
    expect(BLOK_V2_TANPA_KOMENTAR).not.toMatch(/opacity:\s*0\b/);
    expect(BLOK_V2_TANPA_KOMENTAR).not.toMatch(/font-size:\s*0\b/);
  });

  it("tanpa warna mentah dan tanpa token popover yang tidak ada", () => {
    expect(BLOK_V2_TANPA_KOMENTAR).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    for (const sumber of [CSS, CHECKLIST, ALAT, KONTEN, ABT]) {
      expect(sumber).not.toContain("bg-popover");
      expect(sumber).not.toContain("hsl(var(--popover))");
    }
  });

  it("pengali layar: 1 di bawah 2200px, lalu naik di 2200, 2800, dan 3400px", () => {
    expect(BLOK_V2_TANPA_KOMENTAR).toMatch(/html\s*\{[^}]*--aleta-v2-oto:\s*1;/);
    for (const [min, nilai] of [
      [2200, "1.19"],
      [2800, "1.44"],
      [3400, "1.69"],
    ]) {
      expect(BLOK_V2_TANPA_KOMENTAR).toMatch(new RegExp(`@media \\(min-width: ${min}px\\)\\s*\\{\\s*html\\s*\\{[^}]*--aleta-v2-oto:\\s*${nilai};`));
    }
  });

  it("lebar panel berlabuh makin lebar di layar besar dan tidak pernah melebihi 55% layar", () => {
    const lebar = [...BLOK_V2_TANPA_KOMENTAR.matchAll(/--aleta-v2-lebar:\s*([^;]+);/g)].map((m) => m[1].trim());
    expect(lebar.length).toBeGreaterThanOrEqual(5);
    expect(lebar[0]).toMatch(/clamp\(340px, 30vw, 440px\)/);
    const px = lebar.slice(1).map((x) => Number(x.replace("px", "")));
    expect(px).toEqual([...px].sort((a, b) => a - b));
    expect(px[px.length - 1]).toBeGreaterThanOrEqual(800);
    expect(CSS).toContain("min(var(--aleta-t7-lebar, var(--aleta-v2-lebar, 470px)), 55vw)");
  });

  it("panel berlabuh (SIPP dan portal) mulai 900px, bukan 1100px lagi", () => {
    expect(CSS).not.toContain("@media (min-width: 1100px)");
    expect(CSS).toMatch(/@media \(min-width: 900px\) \{\s*html\[data-aleta-sipp-labuh="kanan"\] body/);
    expect(CSS).toMatch(/@media \(min-width: 900px\) \{\s*html\[data-aleta-portal-letak="samping"\] body/);
    expect(KONTEN).toContain('=== "kanan" && lebarLayar >= 900');
  });

  it("panel mengambang ikut layar; ABT tidak melebihi 36% layar di laptop", () => {
    expect(BLOK_V2_TANPA_KOMENTAR).toMatch(/\.aleta-panel \{\s*width: var\(--aleta-v2-mengambang\);/);
    expect(BLOK_V2_TANPA_KOMENTAR).toMatch(/\.aleta-panel-abt \{ width: calc\(400px \* var\(--aleta-v2-oto\)\); \}/);
    expect(BLOK_V2_TANPA_KOMENTAR).toMatch(/min-width: min\(calc\(560px \* var\(--aleta-v2-oto\)\), max\(380px, 36vw\), calc\(100vw - 32px\)\)/);
    // Urutan: aturan umum sebelum ABT/massal (kekhususan sama, yang terakhir menang).
    expect(BLOK_V2.indexOf(".aleta-panel {")).toBeLessThan(BLOK_V2.indexOf(".aleta-panel-abt {"));
  });

  it("tab SIPP digulir di bawah 1500px dan tab pilihan digulir ke tampak", () => {
    expect(BLOK_V2_TANPA_KOMENTAR).toMatch(/@media \(max-width: 1499px\)\s*\{[^@]*\.aleta-t7-tabbar \{\s*flex-wrap: nowrap;\s*overflow-x: auto;/);
    expect(BLOK_V2_TANPA_KOMENTAR).toMatch(/\.aleta-t7-tabbar > \.aleta-t7-tab \{ flex: none; \}/);
    expect(KONTEN).toContain("function t7GulirTabKeTampak(panel)");
    expect(KONTEN).toMatch(/function t7PilihTab[\s\S]*?t7GulirTabKeTampak\(panel\);/);
  });

  it("kepala bagian berlebar penuh tidak meluap; lampu kepala SIPP turun ke baris kedua di layar sempit", () => {
    expect(BLOK_V2_TANPA_KOMENTAR).toMatch(/\.aleta-lipat-kepala \{ box-sizing: border-box; max-width: 100%; \}/);
    expect(BLOK_V2_TANPA_KOMENTAR).toMatch(/\.aleta-kepala > \.aleta-t7-lampu-ringkas \{\s*order: 9;\s*flex: 1 1 100%;/);
  });
});

describe("V2: huruf ikut layar tanpa mengubah pilihan petugas", () => {
  it("panel-alat.js mengalikan pilihan petugas dengan pengali layar", () => {
    expect(ALAT).toContain("`calc(${bersih / 100} * var(--aleta-v2-oto, 1))`");
    expect(ALAT).toContain('document.documentElement.style.setProperty("--aleta-skala-huruf", nilai);');
    // Di bawah 2200px nilainya tetap angka polos (Lama identik sampai atribut <html>).
    expect(ALAT).toContain("alatPengaliLayar(window.innerWidth) === 1 ? String(bersih / 100)");
    expect(ALAT).toContain('window.addEventListener("resize", () => alatTerapkanSkalaHuruf(alatSkalaTerakhir));');
    // Batas dan kunci pilihan petugas tidak berubah (dijaga ekstensi-skala-huruf.test.ts).
    expect(ALAT).toContain('const ALAT_SKALA_KUNCI = "skalaHuruf"');
  });
});

describe("V2: ukuran bawaan panel mengambang memakai pengali layar yang sama dengan CSS", () => {
  it("alatPengaliLayar sama dengan --aleta-v2-oto di panel.css", () => {
    for (const [min, nilai] of [
      [3400, "1.69"],
      [2800, "1.44"],
      [2200, "1.19"],
    ]) {
      expect(ALAT).toContain(`if (w >= ${min}) return ${nilai};`);
      expect(BLOK_V2_TANPA_KOMENTAR).toContain(`@media (min-width: ${min}px) {
  html { --aleta-v2-oto: ${nilai};`);
    }
  });

  it("lebar bawaan: 420px di bawah 1500px, 520-760px dikali pengali di atasnya", () => {
    const hitung = (w: number) => {
      const oto = w >= 3400 ? 1.69 : w >= 2800 ? 1.44 : w >= 2200 ? 1.19 : 1;
      const min = w < 1500 ? 420 : Math.round(520 * oto);
      return Math.min(Math.max(Math.round(w * 0.33), min), Math.round(760 * oto), Math.max(w - 24, 260));
    };
    expect([1280, 1366, 1920, 2560, 3840].map(hitung)).toEqual([422, 451, 634, 845, 1267]);
    expect(ALAT).toContain("const ALAT_AWAL_LEBAR_MIN_SEMPIT = 420;");
    expect(ALAT).toContain("const lebarMin = w < ALAT_AWAL_LAYAR_SEMPIT ? ALAT_AWAL_LEBAR_MIN_SEMPIT : Math.round(ALAT_AWAL_LEBAR_MIN * oto);");
  });
});

describe("V2: widget kiri bawah dan popup", () => {
  it("widget: lebar, tinggi, dan lencana mengikuti pengali layar; tetap dibatasi layar", () => {
    expect(CHECKLIST).toContain("width: calc(348px * var(--aleta-v2-oto, 1));");
    expect(CHECKLIST).not.toMatch(/^\s*width: 348px;/m);
    expect(CHECKLIST).toContain("max-width: calc(100vw - 24px);");
    expect(CHECKLIST).toContain("max-height: min(72vh, calc(580px * var(--aleta-v2-oto, 1)));");
    expect(CHECKLIST).toContain("width: calc(48px * var(--aleta-v2-oto, 1));");
    // Tumpukan dok tetap dibatasi tinggi layar dan boleh digulir.
    expect(CHECKLIST).toContain("max-height: calc(100vh - 96px);");
  });

  it("popup: kepala menempel, tanpa gulir ke samping, merapat di jendela pendek (zoom 125-150%)", () => {
    expect(POPUP).toContain("html { overflow-x: hidden; }");
    expect(POPUP).toContain(".kepala { position: sticky; top: 0; z-index: 20; }");
    expect(POPUP).toContain("@media (max-height: 520px)");
    // Tidak ada isi popup yang disembunyikan oleh blok V2-nya.
    const blok = POPUP.slice(POPUP.indexOf("V2 LAYAR (18 Okt 2026)"), POPUP.indexOf("</style>", POPUP.indexOf("V2 LAYAR (18 Okt 2026)")));
    expect(blok.length).toBeGreaterThan(200);
    expect(blok).not.toMatch(/display:\s*none/);
  });
});

// ============================================================================
// Kode sungguhan di jsdom pada lebar 1280
// ============================================================================
type Ubah = Record<string, { oldValue?: unknown; newValue?: unknown }>;
type JsdomUji = JSDOM & { getInternalVMContext(): vm.Context };
type Opsi = NonNullable<ConstructorParameters<typeof JSDOM>[1]> & { pretendToBeVisual?: boolean };

const terbuka: JSDOM[] = [];
afterEach(async () => {
  await tunggu(30);
  while (terbuka.length) terbuka.pop()!.window.close();
});

function tiruanChrome(w: any, simpananAwal: Record<string, unknown>) {
  const simpanan = polos(simpananAwal);
  const pendengar: Array<(u: Ubah, wilayah: string) => void> = [];
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
      setTimeout(() => pendengar.forEach((f) => f(polos(ubah), "local")), 0);
    },
    remove: async () => undefined,
  };
  w.chrome = {
    runtime: {
      id: "aleta-uji",
      getManifest: () => ({ version: "1.205.5" }),
      getURL: (x: string) => `chrome-extension://aleta-uji/${x}`,
      sendMessage: (_p: unknown, balik?: (x: unknown) => void) => (balik ? balik({ ok: true }) : Promise.resolve({})),
      lastError: undefined,
    },
    storage: {
      local,
      session: { get: async () => ({}), set: async () => undefined },
      onChanged: { addListener: (f: (u: Ubah, wilayah: string) => void) => void pendengar.push(f) },
    },
  };
  return simpanan;
}

function tanggapan(isi: unknown, status = 200, mentah?: string, jenis?: string) {
  if (mentah !== undefined) return new Response(Buffer.from(mentah, "latin1"), { status, headers: { "content-type": jenis || "text/plain" } });
  return new Response(JSON.stringify(isi ?? {}), { status, headers: { "content-type": "application/json" } });
}

/** Lebar 1280: window.innerWidth jsdom disetel sebelum skrip apa pun berjalan. */
function jsdom1280(html: string, url: string): JsdomUji {
  const dom = new JSDOM(html, {
    url,
    runScripts: "outside-only",
    pretendToBeVisual: true,
    beforeParse(w: any) {
      Object.defineProperty(w, "innerWidth", { configurable: true, value: 1280 });
      Object.defineProperty(w, "innerHeight", { configurable: true, value: 720 });
    },
  } as Opsi) as JsdomUji;
  terbuka.push(dom);
  return dom;
}

describe("V2: panel SIPP pada lebar 1280 tetap memuat semua tab dan tombol", () => {
  async function bukaSipp() {
    const dom = jsdom1280(`<!doctype html><html><head><title>SIPP</title></head><body><div id="konten"><h3>Nomor Perkara ${NOMOR}</h3></div></body></html>`, `${ASAL}/SIPP/detil_perkara_agama`);
    const w = dom.window as any;
    Object.defineProperty(w.HTMLElement.prototype, "innerText", {
      configurable: true,
      get() {
        return this.textContent;
      },
    });
    tiruanChrome(w, { ujiTampilan: "ui", ujiIzinkanNyata: true });
    w.fetch = async (alamat: string) => {
      const url = String(alamat);
      if (url.includes("/api/aleta-ecourt/ekstensi/tampilan")) return tanggapan({}, 404);
      if (url.includes("/aleta-bot/sipp-konteks?")) {
        return tanggapan({
          ok: true,
          data: {
            available: true,
            konteks: {
              ok: true,
              nomorPerkara: NOMOR,
              nomorRegister: "PA.DGL-2026-0450",
              identitas: { ditemukan: true, jenisPerkara: "Cerai Gugat", jenisPerkaraLengkap: "Cerai Gugat", adaKumulasi: false, kumulasi: [], adaKuasa: false },
              ringkasan: { dokumen: 0 },
              dokumen: [],
              selisih: [],
              nomorPihak: [],
              diperiksaPada: new Date().toISOString(),
              ambangMendesakHari: 3,
              hakim: null,
            },
            pengguna: { nama: "Pengguna Contoh", peran: "Super Admin" },
            kapabilitas: null,
          },
        });
      }
      return tanggapan({ ok: true, data: {} });
    };
    w.Response = Response;
    const pmAsli = w.postMessage.bind(w);
    w.postMessage = (data: any, asal: string) => {
      if (data && data.sumber === "aleta-jembatan") {
        const { id, ...isi } = data;
        const balas = isi.jenis === "baca" ? { ok: true, medan: [] } : { ok: true };
        setTimeout(() => w.dispatchEvent(new w.MessageEvent("message", { data: { sumber: "aleta-jembatan-jawab", id, ...balas }, source: w })), 0);
        return;
      }
      return pmAsli(data, asal);
    };
    const ctx = dom.getInternalVMContext();
    vm.runInContext(ALAT, ctx, { filename: "panel-alat.js" });
    vm.runInContext(KONTEN, ctx, { filename: "konten.js" });
    const panel = await sampai(() => {
      const p = w.document.getElementById("aleta-panel-sipp");
      return p && p.getAttribute("data-t7") === "ui" && p.querySelector(".aleta-kelompok") ? p : null;
    }, "panel UI Baru tergambar");
    await tunggu(80);
    return { w, panel: panel as any };
  }

  it("lebar jendela 1280: berlabuh di kanan dan semua tab ada, dapat dipilih", async () => {
    const { w, panel } = await bukaSipp();
    expect(w.innerWidth).toBe(1280);
    expect(w.document.documentElement.getAttribute("data-aleta-sipp-labuh")).toBe("kanan");
    const tab = Array.from(panel.querySelectorAll(".aleta-t7-tab")).map((t: any) => t.getAttribute("data-t7-ke"));
    expect(tab).toEqual(["kerjakan", "ptspKel", "putusanKel", "berkas", "perkara"]);
    for (const ke of tab) {
      (panel.querySelector(`.aleta-t7-tab[data-t7-ke="${ke}"]`) as HTMLButtonElement).click();
      expect(panel.getAttribute("data-t7-tab")).toBe(ke);
      expect(panel.querySelector(`.aleta-t7-tab[data-t7-ke="${ke}"]`).getAttribute("aria-selected")).toBe("true");
    }
    // Tab dan bilahnya satu elemen yang sama - tidak ada yang disalin atau dibuang.
    expect(panel.querySelectorAll(".aleta-t7-tabbar").length).toBe(1);
  });

  it("semua tombol kepala dan menunya tetap ada", async () => {
    const { panel } = await bukaSipp();
    for (const k of [".aleta-tema", ".aleta-lipat", ".aleta-penuh", ".aleta-bawaan", ".aleta-matikan"]) {
      expect(panel.querySelectorAll(`.aleta-kepala .aleta-alat-kepala ${k}`).length, k).toBe(1);
    }
    expect(panel.querySelectorAll(".aleta-kepala .aleta-t7-ikon").length).toBe(2); // cari dan menu
    expect(panel.querySelector(".aleta-kepala .aleta-t7-lampu-ringkas")).not.toBeNull();
    expect(panel.querySelector(".aleta-t7-menu")).not.toBeNull();
    expect(panel.querySelector(".aleta-t7-tuas")).not.toBeNull();
    expect(panel.querySelector(".aleta-kaki")).not.toBeNull();
    expect(panel.querySelector(".aleta-kaki-versi")).not.toBeNull();
  });

  it("lebar berlabuh bawaan datang dari CSS; huruf di 1280 tetap angka polos (pengali layar = 1)", async () => {
    const { w, panel } = await bukaSipp();
    // Lebar berlabuh datang dari CSS (--aleta-v2-lebar) kecuali petugas menarik tuasnya.
    expect(w.document.documentElement.style.getPropertyValue("--aleta-t7-lebar")).toBe("");
    // Pengali huruf terpasang sebagai ekspresi yang memuat pengali layar.
    await sampai(() => w.document.documentElement.style.getPropertyValue("--aleta-skala-huruf"), "pengali huruf");
    expect(w.document.documentElement.style.getPropertyValue("--aleta-skala-huruf")).toBe("1");
  });
});

describe("V2: panel ABT pada lebar 1280 tetap memuat tombol kerjanya", () => {
  const NAMA_ABT = "544/Pdt.G/2026/PA.Dgl";
  async function bukaAbt() {
    const ISI: Record<string, string> = {
      "0001": NAMA_ABT,
      "0048": "Cerai Gugat",
      "0046": "Penggugat",
      "0047": "Tergugat",
      "7047": "Penggugat contoh binti Ayah contoh, umur 29 tahun, agama Islam, tempat kediaman di Desa Contoh, sebagai Penggugat;",
      "7048": "Tergugat contoh bin Ayah contoh, umur 33 tahun, sebagai Tergugat;",
      "5125": "Bahwa pada tanggal 14 Maret 2019 Penggugat dan Tergugat melangsungkan pernikahan;<br>Bahwa sejak bulan November 2022 sering terjadi perselisihan;",
      "4001": "Menjatuhkan talak satu ba'in shughra Tergugat terhadap Penggugat;",
      "8503": "G",
      "0222": "DATA_TIDAK_ADA",
      "9944": "DATA_TIDAK_ADA",
      "7035": "DATA_TIDAK_ADA",
      "0132": "DATA_TIDAK_ADA",
      "0156": "DATA_TIDAK_ADA",
    };
    const baris = Object.keys(ISI)
      .map((k) => `<tr valign="top"><td align=center id="${k}">${k}</td><td>Variabel ${k}</td><td>${ISI[k]}</td><td><a class="popup-with-zoom-anim" href="#small-dialog" onclick="load_form('${k}','10018','T1');">edit</a></td></tr>`)
      .join("");
    const dom = jsdom1280(
      `<!doctype html><html><head><title>Blangko</title></head><body><div id="wrapper"><div id="cssmenu"></div><div id="content"><h3 class="w3l_header"><span>${NAMA_ABT}</span></h3><p class="cetak"><a id="cetak" href="${ASAL}/aps_badilag/index.php/abt/preview?c=10018&b=B&a=A">CETAK</a></p><table>${baris}</table></div></div></body></html>`,
      `${ASAL}/aps_badilag/index.php/abt/main/view?a=A&b=B&c=10018&d=3`
    );
    const w = dom.window as any;
    tiruanChrome(w, { ujiTampilan: "ui", ujiIzinkanNyata: true, ujiFitur: Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`abt-${i + 1}`, true])) });
    w.fetch = async (alamat: string, opsi?: { body?: unknown }) => {
      const url = String(alamat);
      if (url.includes("/aleta-bot/abt/usulan")) {
        const m = JSON.parse(typeof opsi?.body === "string" ? opsi.body : "{}");
        if (m.sumber === "siapa") return tanggapan({ data: { available: true, pengguna: { nama: "Pengguna Contoh", peran: "Super Admin" }, kapabilitas: {} } });
        return tanggapan({ data: { available: true } });
      }
      if (url.includes("/edit_data?")) return tanggapan({}, 200, '<input type="hidden" name="var_type" value="data_teks">', "text/html");
      return tanggapan({ ok: true, data: {} });
    };
    w.Response = Response;
    w.TextDecoder = TextDecoder;
    w.TextEncoder = TextEncoder;
    w.console.warn = () => {};
    w.Element.prototype.scrollIntoView = function () {};
    Object.defineProperty(w.HTMLElement.prototype, "innerText", {
      configurable: true,
      get() {
        return String(this.innerHTML || "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "");
      },
    });
    w.confirm = () => false;
    w.eval(`${ALAT}\n;\n${ABT}\n;\nif (typeof alatSetelJedaSkala === "function") alatSetelJedaSkala(0);`);
    let panel: any;
    try {
      panel = await sampai(() => {
        const p = w.document.getElementById("aleta-panel-abt");
        return p && p.getAttribute("data-t6") === "ui" && p.querySelector(".aleta-sore-kerja") ? p : null;
      }, "panel ABT UI Baru tergambar");
    } catch (galat) {
      const p = w.document.getElementById("aleta-panel-abt");
      throw new Error(`${(galat as Error).message}; panel=${p ? p.outerHTML.slice(0, 400) : "tidak ada"}; html=${w.document.documentElement.outerHTML.slice(0, 200)}`);
    }
    await tunggu(80);
    return { w, panel: panel as any };
  }

  it("Isi dari SIPP & Input ke ABT, Susun saksi, tombol kepala, dan kaki tetap ada", async () => {
    const { panel } = await bukaAbt();
    const teks = Array.from(panel.querySelectorAll("button")).map((b: any) => b.textContent.trim());
    for (const wajib of ["Isi blangko dari SIPP", "Input ke ABT", "Susun", "Cetak"]) {
      expect(teks.some((t: string) => t === wajib || t.startsWith(wajib)), wajib).toBe(true);
    }
    expect(panel.querySelector('.aleta-sore-kerja[data-sore-kerja="susun"]')).not.toBeNull();
    expect(panel.querySelector(".aleta-kaki")).not.toBeNull();
    // Kepala bagian kerja tetap membawa tombolnya (Susun) di dalam kepala yang sama.
    expect(panel.querySelector('.aleta-sore-kerja[data-sore-kerja="susun"] .aleta-sore-kerja-kepala .aleta-sore-jalankan')).not.toBeNull();
    // Kartu panjang tetap dapat dilipat.
    expect(panel.querySelectorAll(".aleta-lipatan").length).toBeGreaterThan(0);
    expect(panel.querySelectorAll(".aleta-lipat-kepala").length).toBeGreaterThan(0);
  });
});
