import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * ============================================================================
 * KANVAS LEAFLET SELEBAR NOL - CACAT YANG TIDAK BERBUNYI SAMA SEKALI
 * ============================================================================
 *
 * globals.css memberi seluruh img, svg, video, dan canvas `max-width: 100%`.
 * Itu benar bagi hampir semuanya - dan menghancurkan peta.
 *
 * Kanvas Leaflet duduk di dalam PANEL yang berposisi mutlak tanpa lebar. Anak
 * satu-satunya - kanvas itu sendiri - juga berposisi mutlak, sehingga tidak
 * menyumbang lebar apa pun kepada induknya: lebar panelnya NOL. `max-width:
 * 100%` terhadap nol berarti NOL, dan max-width MENGALAHKAN width sebaris yang
 * dipasang Leaflet.
 *
 * ============================================================================
 * KENAPA IA BERTAHAN LAMA
 * ============================================================================
 *
 * Terukur di peramban satker sebelum diperbaiki:
 *
 *     KANVAS css  0x595    | attr 2180x1190
 *     PETA   css  908x496
 *     ISI    kotak piksel x 890..1273  y 28..1051
 *
 * Lingkarannya SUDAH tergambar - 40.729 piksel tidak tembus pandang, tepat di
 * tengah simpanan kanvasnya - dan TINGGINYA pun benar (496 x 1,2 = 595). Yang
 * nol hanya lebar tampilnya.
 *
 * Akibatnya tidak ada satu pun yang berbunyi: petanya tampak sehat, ubinannya
 * lengkap, Console bersih, tidak ada galat, dan seluruh angka di bawah peta
 * benar - "150 desa tergambar" memang benar, ia memang tergambar. Yang hilang
 * hanya lapisan vektornya, tanpa sebab yang terlihat.
 *
 * Ubinan selamat karena leaflet.css melindunginya secara tegas:
 *
 *     .leaflet-container .leaflet-tile-pane img, ... { max-width: none !important }
 *
 * Daftar itu memuat `img`, TIDAK memuat `canvas`.
 *
 * ============================================================================
 * KENAPA UJI PUN TIDAK MENANGKAPNYA
 * ============================================================================
 *
 * Tidak ada yang salah pada kode petanya, jadi penjaga yang menyisir kode tidak
 * punya yang dapat ditemukan. Replika susunan komponennya pun menggambar 150
 * lingkaran dengan benar - sebab ia halaman polos TANPA CSS global. Cacatnya
 * hanya muncul ketika kedua berkas itu bertemu.
 *
 * Penjaga ini karena itu menjaga PERTEMUANNYA: aturan globalnya boleh ada,
 * asalkan kanvas Leaflet dikecualikan.
 */

const AKAR = path.resolve(process.cwd(), "..");
const baca = (jalur: string) =>
  readFileSync(path.join(AKAR, jalur), "utf8").replace(/\r\n/g, "\n");

const css = baca("manajemen_surat/src/app/globals.css");

describe("kanvas Leaflet dikecualikan dari max-width global", () => {
  it("aturan max-width globalnya memang masih ada", () => {
    // Bukan basa-basi: bila kelak aturan itu dibuang, penjaga di bawah tidak
    // lagi menjaga apa pun dan harus ikut ditinjau.
    // [\s\S] dan bukan bendera /s: sasaran tsc repo ini masih di bawah es2018,
    // dan benderanya ditolak sebagai galat - bukan diabaikan.
    expect(css).toMatch(/canvas[\s\S]*?\{[^}]*max-width:\s*100%/);
  });

  it("kanvas di dalam peta dikecualikan", () => {
    // Terukur pada replika susunan yang sama:
    //   dengan aturan global   kanvas 0 x 1060
    //   sesudah dikecualikan   kanvas 1906 x 1060
    expect(css).toContain(".leaflet-pane > canvas");
    expect(css).toContain(".leaflet-container canvas");
    const i = css.indexOf(".leaflet-container canvas");
    const blok = css.slice(i, css.indexOf("}", i));
    expect(blok).toContain("max-width: none");
  });

  it("svg ikut dikecualikan - penggambar Leaflet dapat berganti", () => {
    // preferCanvas hanya PREFERENSI. Leaflet jatuh ke penggambar SVG pada
    // peramban yang tidak mendukung kanvas, dan svg terkena aturan global yang
    // sama persis.
    expect(css).toContain(".leaflet-pane > svg");
    expect(css).toContain(".leaflet-container svg");
  });

  it("pengecualiannya diterangkan, bukan berdiri tanpa sebab", () => {
    // Aturan CSS tanpa sebab adalah aturan yang dibuang orang berikutnya saat
    // merapikan - dan cacatnya kembali tanpa berbunyi.
    const i = css.indexOf(".leaflet-container canvas");
    const sebelum = css.slice(Math.max(0, i - 2000), i);
    expect(sebelum).toContain("lebar panelnya NOL");
    expect(sebelum).toContain("2180x1190");
  });
});
