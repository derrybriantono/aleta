// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

/**
 * ============================================================================
 * LATAR REDUP DI BELAKANG POP-UP (26 Okt 2026)
 * ============================================================================
 *
 * Keluhan: di tema gelap, latar pop-up (mis. "Jadwalkan Putusan") memakai warna TULISAN tema sebagai latar,
 * sehingga halaman SIPP di belakangnya tampak putih terang dan menyilaukan. Kini satu token bersama
 * (--aleta-tirai-* di ekstensi-sipp/panel.css) memberi: terang = redup sedang + kabur 2px; gelap = redup kuat +
 * kabur 3px; mode ringan / prefers-reduced-transparency = redup saja. Yang dijaga:
 *   - nilai token per tema dan per mode (dievaluasi dari panel.css), diletakkan SEBELUM blok "V2 LAYAR";
 *   - setiap pop-up memakai token itu (bukan warna tetap atau warna tulisan tema);
 *   - pop-up aksi sungguhan (popup-aksi.js di jsdom): lapisan latar ada saat buka, hilang saat tutup, tidak ada
 *     kunci gulir tersisa; perilaku tutup lama (klik satu tidak, klik dua kali ya, Esc dua kali) tidak berubah;
 *   - dialog portal memakai satu kelas .tirai-latar dengan nilai yang sama.
 */

const AKAR = path.resolve(process.cwd(), "../ekstensi-sipp");
const baca = (b: string) => readFileSync(path.join(AKAR, b), "utf8").replace(/\r\n/g, "\n");
const PANEL = baca("panel.css");
const PENETAPAN = baca("penetapan-sipp.css");
const DERRY = baca("blangko-derry.css");
const POPUP = baca("popup-aksi.js");

// ---------------------------------------------------------------------------
// Penafsir kecil untuk blok token di panel.css
// ---------------------------------------------------------------------------
const MULAI = PANEL.indexOf("/* === LATAR REDUP POP-UP (26 Okt 2026)");
const AKHIR = PANEL.indexOf("/* === AKHIR LATAR REDUP POP-UP === */");
const BLOK = PANEL.slice(MULAI, AKHIR);

type Keadaan = { gelap: boolean; portalGelap?: boolean; ringan: boolean; kurangiTransparansi: boolean };

function nilaiToken(k: Keadaan): Record<string, string> {
  const nilai: Record<string, string> = {};
  const bersih = BLOK.replace(/\/\*[\s\S]*?\*\//g, "");
  // Aturan berurutan: "pemilih { deklarasi }" dan "@media (...) { pemilih { deklarasi } }".
  const aturan: { media: boolean; pemilih: string[]; isi: string }[] = [];
  const re = /(@media[^{]+\{\s*)?([^{}@]+)\{([^}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(bersih))) {
    aturan.push({ media: Boolean(m[1]), pemilih: m[2].split(",").map((x) => x.trim()), isi: m[3] });
  }
  const cocok = (p: string) => {
    if (p === "html") return true;
    if (p === 'html[data-aleta-tema-sipp="gelap"]') return k.gelap;
    if (p === "html.dark") return Boolean(k.portalGelap);
    if (p === "html[data-aleta-ringan]") return k.ringan;
    return false; // mis. .aleta-tirai-latar: bukan penentu token
  };
  for (const a of aturan) {
    if (a.media && !k.kurangiTransparansi) continue;
    if (!a.pemilih.some(cocok)) continue;
    for (const d of a.isi.split(";")) {
      const i = d.indexOf(":");
      if (i < 0) continue;
      nilai[d.slice(0, i).trim()] = d.slice(i + 1).trim();
    }
  }
  return nilai;
}
function selesaikan(nama: string, n: Record<string, string>): string {
  let v = n[nama] ?? "";
  for (let i = 0; i < 6; i += 1) {
    const m = /^var\((--[a-z0-9-]+)\)$/.exec(v);
    if (!m) break;
    v = n[m[1]] ?? "";
  }
  return v;
}
const warna = (k: Keadaan) => selesaikan("--aleta-tirai-warna", nilaiToken(k));
const kabur = (k: Keadaan) => selesaikan("--aleta-tirai-filter", nilaiToken(k));
const dasar: Keadaan = { gelap: false, ringan: false, kurangiTransparansi: false };

describe("token latar redup di panel.css", () => {
  it("blok ada dan diletakkan sebelum blok V2 LAYAR (ujung berkas tidak ditambah)", () => {
    expect(MULAI).toBeGreaterThan(0);
    expect(AKHIR).toBeGreaterThan(MULAI);
    const v2 = PANEL.indexOf("V2 LAYAR (18 Okt 2026)");
    expect(v2).toBeGreaterThan(AKHIR);
  });

  it("tema terang: redup sedang + kabur 2px", () => {
    expect(warna(dasar)).toBe("rgba(15, 23, 42, 0.38)");
    expect(kabur(dasar)).toBe("blur(2px)");
  });

  it("tema gelap: redup kuat + kabur 3px (agak kabur, tidak berlebihan)", () => {
    const g = { ...dasar, gelap: true };
    expect(warna(g)).toBe("rgba(5, 8, 12, 0.62)");
    expect(kabur(g)).toBe("blur(3px)");
    // Redup gelap lebih pekat daripada terang.
    const alfa = (s: string) => Number(/,\s*([0-9.]+)\)$/.exec(s)![1]);
    expect(alfa(warna(g))).toBeGreaterThan(alfa(warna(dasar)));
  });

  it("portal (html.dark) memakai nilai gelap yang sama", () => {
    const p = { ...dasar, portalGelap: true };
    expect(warna(p)).toBe("rgba(5, 8, 12, 0.62)");
    expect(kabur(p)).toBe("blur(3px)");
  });

  it("mode ringan: tanpa kabur, redup tetap - terang maupun gelap", () => {
    for (const gelap of [false, true]) {
      const k = { ...dasar, gelap, ringan: true };
      expect(kabur(k)).toBe("none");
      expect(warna(k)).toBe(gelap ? "rgba(5, 8, 12, 0.62)" : "rgba(15, 23, 42, 0.38)");
    }
    expect(selesaikan("--aleta-tirai-kabur-gelap", nilaiToken({ ...dasar, gelap: true, ringan: true }))).toBe("none");
  });

  it("prefers-reduced-transparency: tanpa kabur, redup tetap", () => {
    for (const gelap of [false, true]) {
      const k = { ...dasar, gelap, kurangiTransparansi: true };
      expect(kabur(k)).toBe("none");
      expect(warna(k)).not.toBe("");
    }
  });

  it("kelas .aleta-tirai-latar memakai token (untuk pemakai kelas) dan tidak memakai warna tema tulisan", () => {
    const m = /\.aleta-tirai-latar\s*\{([^}]*)\}/.exec(BLOK);
    expect(m).not.toBeNull();
    expect(m![1]).toMatch(/background:\s*var\(--aleta-tirai-warna/);
    expect(m![1]).toMatch(/backdrop-filter:\s*var\(--aleta-tirai-filter/);
  });
});

describe("setiap pop-up memakai token latar (bukan warna tetap / warna tulisan tema)", () => {
  it("pop-up aksi (Jadwalkan Putusan, Putusan/Penetapan Otomatis, Massal): latar dari token, bukan --ps-tinta", () => {
    const m = /\.aleta-sisip\.aleta-pa-latar\s*\{([^}]*)\}/.exec(PENETAPAN);
    expect(m).not.toBeNull();
    const isi = m![1];
    expect(isi).toMatch(/background:\s*var\(--aleta-tirai-warna\)/);
    expect(isi).toMatch(/backdrop-filter:\s*var\(--aleta-tirai-filter\)/);
    expect(isi).not.toMatch(/background:[^;]*--ps-tinta/);
    // Bayangan kotak tidak lagi berwarna terang di tema gelap.
    const kotak = /\.aleta-pa-kotak\s*\{([^}]*)\}/.exec(PENETAPAN)![1];
    expect(kotak).not.toMatch(/box-shadow:[^;]*--ps-tinta/);
  });

  const SUMBER_LAIN: [string, RegExp][] = [
    ["deteksi-sisa-blangko.js", /position:fixed;inset:0;z-index:2147483600;background:var\(--aleta-tirai-warna,/],
    ["abt.js", /\.aleta-f43-tirai\{[^}]*background:var\(--aleta-tirai-warna,/],
    ["abt.js", /\.aleta-f41-tirai\{[^}]*background:var\(--aleta-tirai-warna,/],
    ["konten.js", /tirai\.className = "aleta-tirai-latar"/],
    ["basmassal.js", /tirai\.className = "aleta-tirai-latar"/],
  ];
  for (const [berkas, pola] of SUMBER_LAIN) {
    it(`${berkas}: ${pola.source.slice(0, 48)}...`, () => {
      expect(baca(berkas)).toMatch(pola);
    });
  }

  it("dialog Blangko Derry (pilih blangko, cetak massal): gelap bawaan, terang lewat data-tema, keduanya dari token", () => {
    expect(DERRY).toMatch(/#aleta-bd-akar \.bd-modal \{[^}]*background: var\(--aleta-tirai-warna-gelap,/);
    expect(DERRY).toMatch(/#aleta-bd-akar \.bd-modal \{[^}]*backdrop-filter: var\(--aleta-tirai-kabur-gelap,/);
    expect(DERRY).toMatch(/#aleta-bd-akar\[data-tema="terang"\] \.bd-modal \{[^}]*background: var\(--aleta-tirai-warna-terang,/);
    expect(DERRY).not.toMatch(/\.bd-modal \{[^}]*rgba\(0, 0, 0, \.5\)/);
  });

  it("panel ABT (dialog T6): tirai memakai token", () => {
    expect(PANEL).toMatch(/\.aleta-t6-tirai\s*\{[^}]*background:\s*var\(--aleta-tirai-warna,[^}]*backdrop-filter:\s*var\(--aleta-tirai-filter/);
  });

  it("dialog Shadow DOM (arsip mediasi, pratinjau BAS/relaas): nilai harfiah per tema di GAYA + token dipasang lewat gaya baris, tanpa nama token di teks gaya", () => {
    const med = baca("mediasi-arsip.js");
    const pra = baca("pratinjau-bas-relaas.js");
    expect(med).toMatch(/\.latar \{[^}]*background:rgba\(15,23,42,\.38\)[^}]*backdrop-filter:blur\(2px\)/);
    expect(med).toMatch(/\.latar\[data-tema="gelap"\] \{ background:rgba\(5,8,12,\.62\)[^}]*backdrop-filter:blur\(3px\)/);
    expect(pra).toMatch(/\.latar \{[^}]*background:rgba\(5,8,12,\.62\)[^}]*backdrop-filter:blur\(3px\)/);
    expect(pra).toMatch(/\.latar\[data-tema="terang"\] \{ background:rgba\(15,23,42,\.38\)[^}]*backdrop-filter:blur\(2px\)/);
    for (const s of [med, pra]) {
      expect(s).not.toMatch(/background:rgba\(2,6,23,\.(55|66)\)/);
      expect(s).toMatch(/getPropertyValue\("--aleta-tirai-warna-" \+ t\)/);
      expect(s).toMatch(/getPropertyValue\("--aleta-tirai-kabur-" \+ t\)/);
      // Teks gaya (GAYA) tidak memuat kata aleta: yang tampak di DOM SIPP tetap bersih.
      const gaya = /const GAYA = `([\s\S]*?)`;/.exec(s)![1];
      expect(gaya).not.toMatch(/aleta/i);
    }
  });

  it("tidak ada lagi latar pop-up berwarna tetap lama di berkas ekstensi", () => {
    for (const b of ["deteksi-sisa-blangko.js", "abt.js", "mediasi-arsip.js", "pratinjau-bas-relaas.js"]) {
      expect(baca(b)).not.toMatch(/inset:0[^"`]*background:rgba\((15,23,42|2,6,23),\.(55|66)\)/);
    }
  });

  it("tidak membuat penyimpan tema kedua: token mengikuti penanda dari pusat tema", () => {
    expect(BLOK).toContain('html[data-aleta-tema-sipp="gelap"]');
    expect(BLOK).not.toMatch(/localStorage|chrome\.storage|prefers-color-scheme/);
  });
});

// ---------------------------------------------------------------------------
// Pop-up aksi sungguhan di jsdom
// ---------------------------------------------------------------------------
function bukaJsdom() {
  const dom = new JSDOM('<!doctype html><html data-aleta-tema-sipp="gelap"><body><div id="halaman" style="background:#fff">SIPP</div></body></html>', {
    url: "http://192.168.10.10/SIPP/perkara_detil/abc",
    runScripts: "outside-only",
    pretendToBeVisual: true,
  } as ConstructorParameters<typeof JSDOM>[1]);
  const w = dom.window as unknown as Record<string, any>;
  const ctx = (dom as unknown as { getInternalVMContext(): vm.Context }).getInternalVMContext();
  vm.runInContext(POPUP, ctx, { filename: "popup-aksi.js" });
  const d = w.document as Document;
  const akar = d.createElement("div");
  akar.id = "aleta-panel-uji";
  const tombol = d.createElement("button");
  tombol.textContent = "Isi";
  akar.appendChild(tombol);
  d.body.appendChild(akar);
  return { w, d, akar, pa: w.aletaPopupAksi };
}
const latar = (d: Document) => d.querySelector(".aleta-pa-latar") as HTMLElement | null;

describe("pop-up aksi sungguhan: lapisan latar", () => {
  it("saat dibuka ada lapisan latar penuh (kelas aleta-pa-latar, di <body>, memuat kotak) dan halaman terkunci gulir", () => {
    const { d, akar, pa } = bukaJsdom();
    expect(latar(d)).toBeNull();
    expect(pa.atur("uji", akar, true, { judul: "Jadwalkan Putusan" })).toBe(true);
    const l = latar(d)!;
    expect(l).not.toBeNull();
    expect(l.parentElement).toBe(d.body);
    expect(l.classList.contains("aleta-sisip")).toBe(true); // gaya latar (token) hidup pada kelas ini di penetapan-sipp.css
    expect(l.querySelector(".aleta-pa-kotak")).not.toBeNull();
    expect(d.documentElement.classList.contains("aleta-pa-kunci")).toBe(true);
    expect(d.querySelectorAll(".aleta-pa-latar").length).toBe(1);
  });

  it("saat ditutup lapisan dibuang dan kunci gulir dicabut (tanpa sisa)", () => {
    const { d, akar, pa } = bukaJsdom();
    pa.atur("uji", akar, true, { judul: "Uji" });
    pa.atur("uji", akar, false);
    expect(latar(d)).toBeNull();
    expect(d.documentElement.classList.contains("aleta-pa-kunci")).toBe(false);
    expect(d.querySelectorAll("[class*='aleta-pa-latar'], [class*='aleta-tirai']").length).toBe(0);
  });

  it("klik satu di latar tidak menutup; klik DUA KALI di latar menutup", () => {
    const { w, d, akar, pa } = bukaJsdom();
    pa.atur("uji", akar, true, { judul: "Uji" });
    const l = latar(d)!;
    l.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
    expect(latar(d)).not.toBeNull();
    l.dispatchEvent(new w.MouseEvent("dblclick", { bubbles: true }));
    expect(latar(d)).toBeNull();
  });

  it("Escape pertama bertanya, Escape kedua menutup", () => {
    const { w, d, akar, pa } = bukaJsdom();
    pa.atur("uji", akar, true, { judul: "Uji" });
    const esc = () => (d.activeElement || d.body).dispatchEvent(new w.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    esc();
    expect(pa.keadaan().tanya).toBe(true);
    expect(latar(d)).not.toBeNull();
    esc();
    expect(latar(d)).toBeNull();
  });
});

describe("dialog portal: satu kelas .tirai-latar", () => {
  const CSS = readFileSync(path.resolve(process.cwd(), "src/app/globals.css"), "utf8").replace(/\r\n/g, "\n");

  it("globals.css: terang redup sedang + kabur 2px, .dark redup kuat + kabur 3px, tanpa kabur bila transparansi dikurangi", () => {
    expect(CSS).toMatch(/:root \{\s*--tirai-warna: rgba\(15, 23, 42, 0\.38\);\s*--tirai-kabur: blur\(2px\);/);
    expect(CSS).toMatch(/\.dark \{\s*--tirai-warna: rgba\(5, 8, 12, 0\.62\);\s*--tirai-kabur: blur\(3px\);/);
    expect(CSS).toMatch(/\.tirai-latar \{[^}]*background-color: var\(--tirai-warna\);[^}]*backdrop-filter: var\(--tirai-kabur\);/);
    expect(CSS).toMatch(/prefers-reduced-transparency: reduce\) \{\s*\.tirai-latar \{[^}]*backdrop-filter: none;/);
  });

  it("nilai portal sama dengan token ekstensi", () => {
    expect(warna(dasar)).toBe("rgba(15, 23, 42, 0.38)");
    expect(warna({ ...dasar, gelap: true })).toBe("rgba(5, 8, 12, 0.62)");
  });

  it("dialog portal tidak lagi memakai latar hitam/putih tetap dengan kabur sendiri", () => {
    const lama = /fixed inset-0[^"`\n]*(bg-black\/(40|50)|bg-background\/(70|75|80)|bg-slate-950\/(60|75))/;
    const sisa: string[] = [];
    const jelajah = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const jalur = path.join(dir, e.name);
        if (e.isDirectory()) jelajah(jalur);
        else if (/\.tsx$/.test(e.name) && lama.test(readFileSync(jalur, "utf8"))) sisa.push(jalur);
      }
    };
    for (const d of ["app", "components", "lib"]) jelajah(path.resolve(process.cwd(), "src", d));
    expect(sisa).toEqual([]);
  });
});
