import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  akunNonaktif,
  hitungAkunNonaktif,
  saklarNonaktifTerlihat,
  saringAkunNonaktif,
} from "@/lib/saring-akun-nonaktif";

const akun = (id: string, isActive: boolean | number | string | undefined) => ({ id, isActive });
const daftar = [akun("a", true), akun("b", false), akun("c", true), akun("d", false), akun("e", undefined)];

describe("saring akun nonaktif (Admin > Akun)", () => {
  it("menyembunyikan akun nonaktif secara bawaan dan mempertahankan urutan", () => {
    expect(saringAkunNonaktif(daftar, false).map((x) => x.id)).toEqual(["a", "c", "e"]);
  });

  it("memperlihatkan semua akun bila saklar menyala, tanpa mengubah daftar asli", () => {
    const hasil = saringAkunNonaktif(daftar, true);
    expect(hasil.map((x) => x.id)).toEqual(["a", "b", "c", "d", "e"]);
    expect(hasil).not.toBe(daftar);
    expect(daftar).toHaveLength(5);
  });

  it("menghitung nonaktif hanya bila isActive jelas salah", () => {
    expect(hitungAkunNonaktif(daftar)).toBe(2);
    expect(akunNonaktif({ isActive: 0 })).toBe(true);
    expect(akunNonaktif({ isActive: "0" })).toBe(true);
    expect(akunNonaktif({ isActive: 1 })).toBe(false);
    expect(akunNonaktif({})).toBe(false);
  });

  it("akun yang baru dinonaktifkan hilang dengan aman dan daftar kosong tidak galat", () => {
    const setelah = daftar.map((x) => (x.id === "a" ? { ...x, isActive: false } : x));
    expect(saringAkunNonaktif(setelah, false).map((x) => x.id)).toEqual(["c", "e"]);
    expect(saringAkunNonaktif([], false)).toEqual([]);
    expect(saringAkunNonaktif([akun("x", false)], false)).toEqual([]);
  });

  it("saklar tersembunyi bila tidak ada akun nonaktif, kecuali sedang menyala", () => {
    expect(saklarNonaktifTerlihat(0, false)).toBe(false);
    expect(saklarNonaktifTerlihat(2, false)).toBe(true);
    expect(saklarNonaktifTerlihat(0, true)).toBe(true);
  });

  it("daftar akun Admin memakai saklar, hitungan, lencana Nonaktif, dan penyimpanan aman", () => {
    const sumber = readFileSync(join(process.cwd(), "src/components/portal/admin-panels.tsx"), "utf8");
    expect(sumber).toContain("Tampilkan akun nonaktif ({jumlahNonaktif})");
    expect(sumber).toContain("saringAkunNonaktif(searchedUsers, tampilkanNonaktif)");
    expect(sumber).toContain("hitungAkunNonaktif(searchedUsers)");
    expect(sumber).toContain('data-akun-nonaktif="1"');
    expect(sumber).toContain(">Nonaktif</Badge>");
    const lib = readFileSync(join(process.cwd(), "src/lib/saring-akun-nonaktif.ts"), "utf8");
    expect(lib).toMatch(/try \{[\s\S]*localStorage\.getItem[\s\S]*\} catch/);
    expect(lib).toMatch(/try \{[\s\S]*localStorage\.setItem[\s\S]*\} catch/);
  });
});
