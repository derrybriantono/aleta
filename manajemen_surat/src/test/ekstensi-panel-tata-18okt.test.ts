// @vitest-environment node
/**
 * AUDIT-GALAT 18 Okt 2026 - dua cacat tata letak panel yang terukur di Chromium
 * sungguhan (ekstensi unpacked, panel putusan massal ABT, tema gelap):
 *
 *  1. Nama jenis yang panjang (.aleta-perkakas-nama, flex:none tanpa batas)
 *     menghimpit kolom nilai sampai nama berkasnya terbaca "[01 ] [Ka" dan isi
 *     panel bergulir menyamping. Terukur sesudah perbaikan: .aleta-isi tidak lagi
 *     punya bilah gulir mendatar.
 *  2. Sudut pertemuan dua bilah gulir tidak diwarnai -> kotak putih di tema gelap.
 *
 * jsdom tidak menata letak, jadi yang diuji di sini adalah KASKADE yang benar-benar
 * berlaku pada unsur panel (getComputedStyle atas panel.css asli), bukan teks CSS-nya.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

const CSS = readFileSync(path.resolve(process.cwd(), "../ekstensi-sipp/panel.css"), "utf8");

function halaman() {
  const dom = new JSDOM(
    `<!doctype html><html><head><style>${CSS}</style></head><body>` +
      `<div class="aleta-panel" data-tema="gelap"><div class="aleta-isi">` +
      `<div class="aleta-perkakas-baris"><span class="aleta-perkakas-nama">Asal Usul Anak · Dikabulkan (anak sah perkawinan tercatat)</span>` +
      `<span class="aleta-perkakas-nilai">[01] [Kabul] AUA - Anak Sah dari Perkawinan Tercatat</span></div>` +
      `</div></div></body></html>`
  );
  return dom.window;
}

describe("panel ALETA: baris perkakas dan bilah gulir", () => {
  it("nama jenis dibatasi separuh baris dan boleh dipatahkan, nilai tetap mengisi sisa", () => {
    const w = halaman();
    const nama = w.document.querySelector(".aleta-perkakas-nama")!;
    const gaya = w.getComputedStyle(nama);
    expect(gaya.maxWidth).toBe("45%");
    expect(gaya.overflowWrap).toBe("anywhere");
    // tetap tidak menyusut di bawah lebar minimumnya (nama pendek tidak berubah)
    expect(gaya.minWidth).toBe("8.5em");
    const nilai = w.getComputedStyle(w.document.querySelector(".aleta-perkakas-nilai")!);
    expect(nilai.overflowWrap).toBe("anywhere");
  });

  it("sudut bilah gulir panel dan isinya tembus pandang (bukan putih bawaan)", () => {
    const w = halaman();
    const aturan = Array.from(w.document.styleSheets[0].cssRules) as CSSStyleRule[];
    const sudut = aturan.filter((r) => typeof r.selectorText === "string" && /::-webkit-scrollbar-corner/.test(r.selectorText));
    const pemilih = sudut.flatMap((r) => r.selectorText.split(",").map((s) => s.trim()));
    for (const p of [".aleta-panel::-webkit-scrollbar-corner", ".aleta-panel .aleta-isi::-webkit-scrollbar-corner"]) {
      expect(pemilih).toContain(p);
    }
    for (const r of sudut) expect(r.style.background || r.style.backgroundColor).toBe("transparent");
  });
});
