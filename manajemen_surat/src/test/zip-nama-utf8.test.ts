// @vitest-environment node
import { describe, expect, it } from "vitest";

import { susunZip } from "@/server/shared/zip";

import { bacaZip, penandaZip } from "./eviden-skp-baca";

/**
 * ============================================================================
 * server/shared/zip.ts - NAMA NON-ASCII DITANDAI UTF-8 (2.40.0)
 * ============================================================================
 *
 * Arsip eviden SKP memuat nama hakim di nama berkasnya ("Ma’ruf"). Tanpa
 * penanda bit 11 pembuka ZIP membaca nama itu sebagai sandi DOS lama. Nama
 * ASCII TIDAK diberi penanda, sehingga arsip ekstensi yang sudah beredar
 * tetap sama byte demi byte.
 */

describe("penanda nama UTF-8", () => {
  it("nama ASCII: tanpa penanda, di kepala lokal maupun daftar isi", () => {
    const arsip = susunZip([{ nama: "ekstensi-sipp/manifest.json", isi: Buffer.from("{}") }]);
    expect(arsip.readUInt16LE(6)).toBe(0);
    expect(penandaZip(arsip).get("ekstensi-sipp/manifest.json")).toBe(0);
  });

  it("nama non-ASCII: bit 11 di kedua kepala, dan namanya kembali utuh", () => {
    const nama = "Eviden SKP 2026 - Triwulan II - Rekap Perkara - Ma’ruf.pdf";
    const arsip = susunZip([
      { nama: "biasa.txt", isi: Buffer.from("a") },
      { nama, isi: Buffer.from("%PDF-") },
    ]);
    expect(penandaZip(arsip).get(nama)).toBe(0x0800);
    expect(penandaZip(arsip).get("biasa.txt")).toBe(0);
    // Kepala lokal entri kedua: sesudah kepala + nama + isi entri pertama.
    const letakKedua = 30 + "biasa.txt".length + 1;
    expect(arsip.readUInt32LE(letakKedua)).toBe(0x04034b50);
    expect(arsip.readUInt16LE(letakKedua + 6)).toBe(0x0800);
    expect(bacaZip(arsip).get(nama)?.toString("latin1")).toBe("%PDF-");
  });
});
