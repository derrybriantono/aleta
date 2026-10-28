/**
 * 28 Okt 2026 (perkara 627, penyakit stroke): menu "Alasan perceraian" tidak memuat huruf E (dan G), padahal kueri blangko [01]
 * di ABT mengenali keduanya lewat cabang umum A-H. Menu harus memuat delapan huruf Pasal 116 KHI, satu kali masing-masing.
 */
import { describe, expect, it } from "vitest";

import { PILIHAN_ALASAN } from "@/app/api/aleta-ecourt/blangko-derry/susun";

describe("pilihan huruf alasan perceraian", () => {
  it("memuat A-H tanpa ganda; F tetap pilihan pertama (saran)", () => {
    const huruf = PILIHAN_ALASAN.map((p) => p.split("·")[0].trim());
    expect([...huruf].sort()).toEqual(["A", "B", "C", "D", "E", "F", "G", "H"]);
    expect(huruf[0]).toBe("F");
  });

  it("E menyebut cacat badan/penyakit, G menyebut taklik talak", () => {
    expect(PILIHAN_ALASAN.find((p) => p.startsWith("E ·"))).toMatch(/cacat badan atau penyakit/);
    expect(PILIHAN_ALASAN.find((p) => p.startsWith("G ·"))).toMatch(/taklik talak/);
  });
});
