import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Dua cacat tampilan yang terlihat hanya di peramban sungguhan (7 Nov 2026), dijaga lewat sumbernya:
 *  1. dialog "Naskah ini masih memuat sisa blangko" menyebut nama berkas "....rtf.rtf" (nama dari server sudah berakhiran .rtf, lalu ditambah lagi);
 *  2. kode bukti (P.1, T.1, ...) memakai warna utama hijau tua yang rasio kontrasnya 2,4:1 di tema gelap; kini zamrud terang di tema gelap (8:1).
 */
const AKAR = path.resolve(__dirname, "..", "components", "portal");

describe("layar cetak ALETA ABT: label teknis dan tema gelap", () => {
  it("nama yang diberikan ke dialog tinjauan tidak berakhiran .rtf", () => {
    const sumber = readFileSync(path.join(AKAR, "cetak-aleta-abt.tsx"), "utf8");
    expect(sumber).toContain('nama: nama.replace(/\\.rtf$/i, "")');
    expect(sumber).not.toContain("nama: `${nama}.rtf`");
  });

  it("kode bukti tidak memakai text-primary polos (tidak terbaca di tema gelap)", () => {
    const sumber = readFileSync(path.join(AKAR, "bukti-aleta-abt.tsx"), "utf8");
    expect(sumber).not.toMatch(/text-primary(?![-\w])/);
    expect(sumber.match(/text-emerald-700 dark:text-emerald-300/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
  });
});
