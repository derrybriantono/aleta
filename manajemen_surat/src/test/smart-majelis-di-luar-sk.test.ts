/**
 * Smart Majelis SIPP yang mengusulkan trio di luar SK.
 *
 * Terukur di peladen sesudah 2.19.0 terpasang: Smart Majelis mengusulkan
 * B,C1,C3 untuk perkara 567 - susunan yang tidak ada di SK Ketua. Kode yang
 * jujur kosong membuat hari sidangnya ikut hilang: "menunggu majelisnya
 * ditentukan lebih dulu" pada usulan yang majelisnya sudah ada.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const AKAR = path.resolve(__dirname, "../../..");
const usul = readFileSync(path.join(AKAR, "aleta_bot/services/penunjukanService.js"), "utf8");

describe("Smart Majelis di luar SK -> giliran majelis SK", () => {
  it("ditimpa HANYA bila SK ada, usulan SIPP di luar SK, dan ada majelis SK yang dapat dipakai", () => {
    expect(usul).toContain('if (susunanSk.length > 0 && kodeSmart === "" && majelisSkTersedia.length > 0) {');
  });

  it("usulan Smart Majelis yang majelis SK tetap dihormati", () => {
    // Cabang biasa masih memulangkan kode dari Smart Majelis.
    expect(usul).toContain("      majelisKode: kodeSmart,");
  });

  it("yang ditimpa disebut apa adanya di sebabnya", () => {
    expect(usul).toContain("giliran majelis SK - Smart Majelis SIPP mengusulkan ${anggota.map((x) => x.kode || \"?\").join(\",\")}");
    expect(usul).toContain("Ubah di dropdown bila usulan SIPP memang yang dimaksud.");
  });
});

describe("susunan di luar SK tetap mendapat hari sidang", () => {
  it("hari sidangnya dipinjam dari kode ketuanya", () => {
    expect(usul).toContain('const dariKetua = acuan.majelisKode === "" && kodeKetua !== "" && hariSidang[kodeKetua] !== undefined;');
  });

  it("kodenya TETAP kosong - yang dipinjam hanya harinya", () => {
    // Tidak ada baris yang menulis kode ketua ke majelisKode untuk susunan
    // di luar SK.
    const potong = usul.slice(usul.indexOf("const kodeKetua ="), usul.indexOf("const kodeKetua =") + 700);
    expect(potong).not.toContain("majelisKode = kodeKetua");
    expect(potong).not.toContain("majelisKode: kodeKetua");
  });

  it("sebabnya menyebut bahwa harinya mengikuti ketua", () => {
    expect(usul).toContain("hari sidang mengikuti ketua majelis (kode ${kodeKetua}) - susunan ini di luar SK");
  });
});
