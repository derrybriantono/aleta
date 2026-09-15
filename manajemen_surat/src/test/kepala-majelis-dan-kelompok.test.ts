/**
 * Papan penetapan pada perkara 585: kepala "Penetapan Majelis Hakim" hilang
 * di mode manual, dan garis bawah tiap kepala memotong kepala dari
 * dropdown-nya sendiri - seluruh susunan terbaca bergeser satu kolom.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const AKAR = path.resolve(__dirname, "../../..");
const baca = (p: string) => readFileSync(path.join(AKAR, p), "utf8");
const konten = baca("ekstensi-sipp/konten.js");
const css = baca("ekstensi-sipp/panel.css");

describe("kepala Penetapan Majelis Hakim ada di kedua mode", () => {
  it("kepalanya digambar TANPA syarat mode", () => {
    // Sejak mengganti majelis memuat ulang usulannya, kepala ini menampilkan
    // majelis yang dipilih itu sendiri - bukan lagi usulan tandingan.
    const mulai = konten.indexOf('      "Penetapan Majelis Hakim",');
    expect(mulai).toBeGreaterThan(0);
    // Tidak ada `if (!manual) {` yang masih terbuka tepat sebelum kepala ini:
    // blok saklar ditutup dulu dengan `  }` sebelum kepala digambar.
    const sebelum = konten.slice(konten.lastIndexOf("if (!manual) {", mulai), mulai);
    expect(sebelum).toContain("\n  }\n");
  });

  it("kode majelis SK tertulis di depan namanya", () => {
    expect(konten).toContain('(pmh.majelisKode ? `${pmh.majelisKode} — ` : "") + namaMajelis,');
  });

  it("saklar Hakim tunggal tetap hanya di mode otomatis", () => {
    const saklar = konten.indexOf('"Hakim tunggal",');
    const penjaga = konten.lastIndexOf("if (!manual) {", saklar);
    expect(penjaga).toBeGreaterThan(0);
    expect(konten.slice(penjaga, saklar)).not.toContain("\n  }\n");
  });
});

describe("garis pemisah di bawah kelompok, bukan di bawah kepala", () => {
  it("kepala yang diikuti dropdown melepas garis bawahnya", () => {
    expect(css).toContain(".aleta-tetap:has(+ .aleta-pilih),");
    expect(css).toContain(".aleta-tetap:has(+ .aleta-saklar),");
    expect(css).toContain("  border-bottom: 0;\n  padding-bottom: 2px;");
  });

  it("garisnya dipasang di atas kepala berikutnya", () => {
    expect(css).toContain(".aleta-pilih + .aleta-tetap,");
    expect(css).toContain(".aleta-pilih-bebas + .aleta-tetap,");
    expect(css).toContain("  border-top: 1px solid var(--aleta-garis);\n  margin-top: 6px;");
  });

  it("kepala yang berdiri sendiri tetap bergaris bawah", () => {
    // Aturan dasar .aleta-tetap tidak diubah - hanya ditimpa bila ada
    // bagian kelompok di bawahnya.
    expect(css).toContain(".aleta-tetap {\n  display: grid;\n  grid-template-columns: 42px 1fr;\n  gap: 8px;\n  padding: 7px 12px;\n  border-bottom: 1px solid var(--aleta-garis);\n}");
  });
});
