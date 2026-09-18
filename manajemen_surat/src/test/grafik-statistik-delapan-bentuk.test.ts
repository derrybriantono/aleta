/**
 * ============================================================================
 * DELAPAN BENTUK GRAFIK, DAN PALET YANG DIHITUNG
 * ============================================================================
 *
 * Tiga bentuk menjadi delapan, tanpa satu pun pustaka grafik ditambahkan -
 * itulah yang menjaga janji "jangan sampai lag": tidak ada yang diunduh dan
 * tidak ada yang dijalankan sebelum grafiknya tergambar.
 *
 * ============================================================================
 * PALET LAMA GAGAL, DAN ITU DIUKUR - BUKAN DIKIRA
 * ============================================================================
 *
 * Palet enam warna yang dipakai grafik lingkaran dijalankan lewat pengukur
 * palet pada permukaan terang:
 *
 *     Lightness band        LULUS
 *     Chroma floor          GAGAL   #0f766e (0,086) - terbaca ABU-ABU
 *     CVD separation        LULUS   ΔE 11,4 protan
 *     Normal-vision floor   LULUS   ΔE 21,5
 *     Contrast vs surface   LULUS
 *
 * Dan ia DIPUTAR - `colors[index % colors.length]` - sehingga kategori ketujuh
 * berwarna sama dengan yang pertama. Dua juring sewarna pada satu lingkaran
 * adalah kekeliruan yang tidak berbunyi sama sekali.
 *
 * Palet baru delapan slot, diperiksa pada KEDUA tema:
 *
 *     terang   empat lulus; kontras PERINGATAN pada #1baf7a 2,74 · #eda100
 *              2,11 · #e87ba4 2,62 - peringatan itu menuntut label yang
 *              terbaca, dan itulah sebabnya daftar berlabel selalu digambar
 *     gelap    kelima pemeriksaan lulus
 *
 * Tema gelap punya langkahnya sendiri - dipilih, bukan dibalik.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const AKAR = path.resolve(process.cwd(), "..");
const baca = (jalur: string) => readFileSync(path.join(AKAR, jalur), "utf8").replace(/\r\n/g, "\n");

const grafik = baca("manajemen_surat/src/components/portal/statistics-chart.tsx");
const layar = baca("manajemen_surat/src/app/(portal)/statistik/page.tsx");

describe("delapan bentuk, satu sumber daftar", () => {
  it("kedelapan bentuk ada", () => {
    for (const nilai of ["bar", "bar-h", "line", "area", "lollipop", "pie", "donut", "treemap"]) {
      expect(grafik, nilai).toContain(`nilai: "${nilai}"`);
    }
  });

  it("layar membaca daftarnya dari komponen, tidak menyalinnya", () => {
    expect(layar).toContain("JENIS_GRAFIK.map((jenis)");
    // Daftar yang disalin akan tertinggal begitu bentuk baru ditambahkan.
    expect(layar).not.toContain('<option value="bar">Bar Chart</option>');
  });

  it("tiap bentuk menyebut untuk apa ia dipakai", () => {
    const untuk = grafik.match(/untuk: "[^"]+"/g) || [];
    expect(untuk.length).toBe(8);
  });
});

describe("tanpa pustaka grafik", () => {
  it("tidak ada pustaka grafik yang diimpor", () => {
    for (const pustaka of ["recharts", "chart.js", "apexcharts", "d3", "visx", "nivo"]) {
      expect(grafik.toLowerCase(), pustaka).not.toContain(`from "${pustaka}`);
    }
  });

  it("tidak ada pustaka grafik di package.json", () => {
    const paket = baca("manajemen_surat/package.json");
    for (const pustaka of ["recharts", "chart.js", "apexcharts", "nivo"]) {
      expect(paket, pustaka).not.toContain(`"${pustaka}"`);
    }
  });
});

describe("palet kategori dihitung, tidak diputar", () => {
  it("delapan slot, dua tema, langkahnya sendiri-sendiri", () => {
    expect(grafik).toContain("const PALET_TERANG = [");
    expect(grafik).toContain("const PALET_GELAP = [");
    for (const w of ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"]) {
      expect(grafik, w).toContain(w);
    }
  });

  it("warna yang gagal pengukuran tidak dipakai lagi", () => {
    // #0f766e gagal chroma floor - terbaca abu-abu.
    expect(grafik).not.toContain('"#0f766e"');
  });

  it("tidak diputar - slot kesembilan tidak pernah dikarang", () => {
    // Diperiksa atas KODE-nya, bukan atas keterangannya: bentuk lama sengaja
    // dikutip di dalam komentar supaya sebabnya terbaca, dan kutipan itu
    // bukan kode yang berjalan.
    const kode = grafik
      .split("\n")
      .filter((b) => !/^\s*(\*|\/\/|\/\*)/.test(b))
      .join("\n");
    expect(kode).not.toMatch(/%\s*\w*[Cc]olors?\.length/);
    expect(kode).not.toMatch(/%\s*PALET_\w+\.length/);
    expect(kode).toContain("Math.min(indeks, SLOT_MAKSIMUM - 1)");
  });

  it("yang melewati delapan dilipat, dan jumlahnya disebut", () => {
    expect(grafik).toContain("function lipatKeLainnya(");
    expect(grafik).toContain("Lainnya (${ekor.length} kategori)");
    expect(grafik).toContain("Jumlah seluruhnya tidak berubah.");
  });

  it("angka pengukurannya tercatat di sumbernya", () => {
    expect(grafik).toContain("#0f766e (0,086)");
    expect(grafik).toContain("2,74");
  });
});

describe("aturan tanda dan keterbacaan", () => {
  it("garis dua piksel, bukan pita", () => {
    expect(grafik).toContain('strokeWidth="2"');
    expect(grafik).not.toContain('strokeWidth="4"');
  });

  it("tiap tanda punya judul gantung - lapisan hover yang tidak memakan apa pun", () => {
    const judul = grafik.match(/<title>/g) || [];
    expect(judul.length).toBeGreaterThanOrEqual(4);
  });

  it("daftar berlabel selalu ada pada grafik bagian-dari-keseluruhan", () => {
    // Inilah pelunas peringatan kontras: identitas tidak pernah bergantung
    // pada warna semata.
    expect(grafik).toContain("DAFTAR BERLABEL SELALU ADA");
    expect(grafik).toContain("j.persen.toFixed(1)");
  });

  it("angka tidak ditempel pada tiap batang ketika kategorinya banyak", () => {
    expect(grafik).toContain("const semuaBerangka = data.length <= 12;");
  });

  it("dua piksel permukaan memisahkan tanda yang bersebelahan", () => {
    expect(grafik).toContain("const selaBatang = 2;");
    expect(grafik).toContain('stroke="var(--card, #fff)"');
  });
});
