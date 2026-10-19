// @vitest-environment node
/**
 * ============================================================================
 * MENU KIRI ABT BISA DIGULIR (19 Okt 2026) - ekstensi-sipp/abt-gulir.js
 * ============================================================================
 *
 * Keluhan: menu kiri beranda ABT (#navbar, accordion "Blangko Derry ...") tidak
 * bisa digulir; submenu di bawah layar tidak terjangkau. Sebabnya: beranda.php
 * menambah .stickynav (position: fixed) begitu halaman digulir, dan #navbar tak
 * punya max-height. abt-gulir.js memberinya max-height + overflow-y dan
 * mengingat posisi gulirnya. Tangkapan Playwright atas replika:
 * docs/rancangan/abt-gulir-19okt/.
 *
 * Yang dijaga: (1) hanya terpasang di halaman ABT yang punya menu accordion,
 * (2) tidak ada elemen ABT dihapus/disembunyikan/ditulisi, tidak ada kata
 * "aleta" di DOM ABT, (3) posisi gulir diingat dan dipulihkan, menu aktif
 * ditampakkan, (4) terdaftar di manifest (hanya grup ABT) dan susun-ekstensi.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

const EKSTENSI = path.resolve(process.cwd(), "../ekstensi-sipp");
const SUMBER = readFileSync(path.join(EKSTENSI, "abt-gulir.js"), "utf8").replace(/\r\n/g, "\n");
const MANIFEST = JSON.parse(readFileSync(path.join(EKSTENSI, "manifest.json"), "utf8"));
const SUSUN = readFileSync(path.resolve(process.cwd(), "scripts/susun-ekstensi.mjs"), "utf8");

const ASAL = "http://192.168.10.10";
const ABT = `${ASAL}/aps_badilag/index.php/abt/main/beranda?a=XYZ&c=`;
const KUNCI = "gulir-menu-abt-v1";
const tunggu = (ms = 0) => new Promise((r) => setTimeout(r, ms));

function halamanAbt(opsi: { aktif?: boolean } = {}) {
  const grup = ["Gugatan & Permohonan", "Cerai Gugat", "Blangko Derry (Daftar s.d. Produk)"];
  let menu = "";
  grup.forEach((g, i) => {
    menu += `<button class="accordion">${g}</button><div class="panel">`;
    const n = i === 2 ? 60 : 3;
    for (let k = 0; k < n; k++) menu += `<a ${opsi.aktif && i === 2 && k === 45 ? 'class="active" ' : ""}href="#g${i}-${k}">Item ${i}-${k}</a>`;
    menu += "</div>";
  });
  return `<!doctype html><html><head><title>Blangko Tambahan SIPP</title></head><body>
<div id="nav"><div id="navbar" class="pricing_inner_w3ls navbar">${menu}</div></div>
<div class="pricing" id="pricing"><div class="col-md-4 pricing_inner_w3ls"><h3>Daftar</h3></div></div>
</body></html>`;
}

function buka(alamat: string, html: string, sesi?: Record<string, string>) {
  const dom = new JSDOM(html, { url: alamat, runScripts: "outside-only" });
  const w = dom.window as any;
  for (const [k, v] of Object.entries(sesi || {})) w.sessionStorage.setItem(k, v);
  // jsdom tidak punya tata letak: scrollTop/getBoundingClientRect ditiru supaya perilaku gulirnya dapat diukur.
  const menu = w.document.getElementById("navbar");
  if (menu) {
    let atas = 0;
    Object.defineProperty(menu, "scrollTop", { get: () => atas, set: (v: number) => (atas = Math.max(0, Math.min(v, 900))), configurable: true });
    menu.getBoundingClientRect = () => ({ top: 100, bottom: 700, height: 600, left: 0, right: 200, width: 200 });
    const dasar = 100;
    w.document.querySelectorAll("#navbar a").forEach((a: any, i: number) => {
      a.getBoundingClientRect = () => {
        const t = dasar + i * 16 - atas;
        return { top: t, bottom: t + 16, height: 16, left: 0, right: 100, width: 100 };
      };
    });
  }
  w.eval(SUMBER);
  return { dom, w, menu };
}

describe("abt-gulir.js - menu kiri ABT bisa digulir", () => {
  it("terpasang di halaman ABT: max-height + overflow-y pada #navbar, bilah gulir tipis", () => {
    const { w } = buka(ABT, halamanAbt());
    const gaya = w.document.getElementById("gulir-menu-gaya");
    expect(gaya).toBeTruthy();
    const css = gaya.textContent as string;
    expect(css).toMatch(/#navbar\s*\{[^}]*max-height:[^;]*100vh/);
    expect(css).toMatch(/overflow-y:\s*auto/);
    expect(css).toMatch(/scrollbar-width:\s*thin/);
    // ruang untuk pita bawah widget dan jarak atas menu terhitung (bukan 100vh polos)
    expect(css).toMatch(/calc\(100vh - \d+px - \d+px\)/);
    // ukuran kotak dan lebar menu ABT tidak diubah
    const blokUtama = (css.match(/#navbar\s*\{([^}]*)\}/) || [])[1] || "";
    expect(blokUtama).not.toMatch(/box-sizing|(?<![-\w])width\s*:|position\s*:|margin|padding|float/);
    expect(w.document.documentElement.getAttribute("data-gulir-menu")).toBe("1");
  });

  it("tidak terpasang di SIPP, portal, atau halaman ABT tanpa menu accordion", () => {
    for (const alamat of [`${ASAL}/SIPP/index.php/perkara`, `${ASAL}/aleta/dashboard`, "http://127.0.0.1/index.php/home"]) {
      const { w } = buka(alamat, halamanAbt());
      expect(w.document.getElementById("gulir-menu-gaya"), alamat).toBeNull();
    }
    const tanpaMenu = buka(ABT, "<!doctype html><html><body><div id='navbar'>kosong</div></body></html>");
    expect(tanpaMenu.w.document.getElementById("gulir-menu-gaya")).toBeNull();
  });

  it("tidak menghapus, menyembunyikan, atau menulisi elemen ABT; tidak ada kata aleta di DOM", () => {
    const html = halamanAbt();
    const sebelum = new JSDOM(html).window.document.body.innerHTML;
    const { w } = buka(ABT, html);
    expect(w.document.body.innerHTML).toBe(sebelum);
    const css = w.document.getElementById("gulir-menu-gaya").textContent as string;
    expect(css).not.toMatch(/display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0\b|height\s*:\s*0/);
    expect(w.document.documentElement.outerHTML.toLowerCase()).not.toContain("aleta");
    // kode skrip sendiri (di luar komentar) tidak menyebut kata itu
    const tanpaKomentar = SUMBER.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(tanpaKomentar.toLowerCase()).not.toContain("aleta");
    // tidak ada penulisan ke ABT: tanpa fetch/XHR/borang
    expect(tanpaKomentar).not.toMatch(/\bfetch\(|XMLHttpRequest|\.submit\(|\.remove\(\)|removeChild|innerHTML\s*=|\.hidden\s*=/);
  });

  it("memulihkan posisi gulir menu dari sessionStorage", () => {
    const { menu } = buka(ABT, halamanAbt(), { [KUNCI]: JSON.stringify({ atas: 345 }) });
    expect(menu.scrollTop).toBe(345);
  });

  it("menyimpan posisi gulir sesudah petugas menggulir menu sendiri", async () => {
    const { w, menu } = buka(ABT, halamanAbt());
    menu.dispatchEvent(new w.Event("wheel"));
    menu.scrollTop = 410;
    menu.dispatchEvent(new w.Event("scroll"));
    await tunggu(220);
    expect(JSON.parse(w.sessionStorage.getItem(KUNCI)).atas).toBe(410);
  });

  it("tidak menimpa ingatan oleh gulir yang dilakukan pemulihan sendiri", async () => {
    const { w, menu } = buka(ABT, halamanAbt(), { [KUNCI]: JSON.stringify({ atas: 200 }) });
    menu.dispatchEvent(new w.Event("scroll")); // gulir akibat pemulihan, bukan petugas
    await tunggu(220);
    expect(JSON.parse(w.sessionStorage.getItem(KUNCI)).atas).toBe(200);
  });

  it("menu yang sedang aktif digulir ke tampak (menu saja), dan posisi tersimpan yang sudah menampakkannya dibiarkan", () => {
    const { w, menu } = buka(ABT, halamanAbt({ aktif: true }));
    const aktif = w.document.querySelector("#navbar a.active");
    const r = aktif.getBoundingClientRect();
    expect(menu.scrollTop).toBeGreaterThan(0);
    expect(r.top).toBeGreaterThanOrEqual(100);
    expect(r.bottom).toBeLessThanOrEqual(700);
    // posisi tersimpan yang sudah menampakkan item aktif tidak ditimpa
    const lagi = buka(ABT, halamanAbt({ aktif: true }), { [KUNCI]: JSON.stringify({ atas: 650 }) });
    expect(lagi.menu.scrollTop).toBe(650);
  });

  it("sessionStorage rusak/hilang tidak membuat skrip gagal", () => {
    const { w } = buka(ABT, halamanAbt(), { [KUNCI]: "{bukan json" });
    expect(w.document.getElementById("gulir-menu-gaya")).toBeTruthy();
  });

  it("pemasangan dua kali tidak menggandakan gaya", () => {
    const { w } = buka(ABT, halamanAbt());
    w.gulirMenuAbt.pasang(w.document);
    expect(w.document.querySelectorAll("#gulir-menu-gaya").length).toBe(1);
  });
});

describe("abt-gulir.js - terdaftar", () => {
  it("manifest: hanya di grup skrip konten ABT (aps_badilag), tidak di SIPP/portal", () => {
    const grup = MANIFEST.content_scripts.filter((c: any) => (c.js || []).includes("abt-gulir.js"));
    expect(grup.length).toBe(1);
    expect(grup[0].matches).toEqual(expect.arrayContaining([`${ASAL}/aps_badilag/*`]));
    expect(grup[0].matches.every((m: string) => /aps_badilag/.test(m))).toBe(true);
    expect(grup[0].js).toContain("abt.js");
    expect(grup[0].run_at).toBe("document_idle");
  });

  it("susun-ekstensi: berkas ikut ditanam dan ada di folder", () => {
    expect(SUSUN).toMatch(/"abt-gulir\.js",/);
    expect(() => readFileSync(path.join(EKSTENSI, "abt-gulir.js"))).not.toThrow();
  });
});
