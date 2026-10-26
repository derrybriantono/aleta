// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  BATAS_NAMA_PERIKSA,
  GalatEjaan,
  batasMirip,
  bersihkanEntriKamus,
  bersihkanSumberNama,
  jarakEdit,
  kunciEjaan,
  kunciRapat,
  periksaEjaan,
  periksaSatuNama,
  tokenNama,
  tulisanDasar,
} from "@/lib/ejaan-nama";

/**
 * ============================================================================
 * U18 - ATURAN PEMERIKSA EJAAN DAN NAMA PIHAK (rantai B, 25 Okt 2026)
 * ============================================================================
 * Nama rekaan semua. Aturan: tulisan sama setelah gelar/tanda baca diabaikan = aman; kunci ejaan sama tetapi tulisan
 * beda = "beda-ejaan"; kunci berbeda tipis = "mirip"; terdaftar di kamus = "alias". Semuanya usulan.
 */

const S = (asal: string, nama: string) => ({ asal, nama });

describe("normalisasi", () => {
  it("token: huruf kecil, tanpa tanda baca dan gelar (juga gelar yang terpecah S.H.)", () => {
    expect(tokenNama("H. Muhammad Alwi, S.H.")).toEqual(["muhammad", "alwi"]);
    expect(tokenNama("Hj. Siti Nur-Haliza binti Ahmad")).toEqual(["siti", "nur", "haliza", "binti", "ahmad"]);
    expect(tokenNama("  Dr. Ir. Budi   Santoso, M.Si ")).toEqual(["budi", "santoso"]);
    expect(tokenNama("D'Angelo Éric")).toEqual(["dangelo", "eric"]);
    expect(tokenNama("")).toEqual([]);
    expect(tulisanDasar("ALM. Ahmad  Yani")).toBe("ahmad yani");
  });

  it("kunci ejaan: Muhammad/Muhamad/Mohammad/Moh./Muh./M. satu kunci; Abdul/Abd.; ejaan lama; huruf rangkap", () => {
    const k = kunciEjaan("Muhammad Alwi");
    for (const v of ["Muhamad Alwi", "Mohammad Alwi", "Moh. Alwi", "Muh. Alwi", "M. Alwi", "Mochammad Alwi", "MUHAMMAD  ALWI"]) expect(kunciEjaan(v), v).toBe(k);
    expect(kunciEjaan("Abdul Rahman")).toBe(kunciEjaan("Abd. Rahman"));
    expect(kunciEjaan("Abdoel Rachman")).toBe("abdul rakhman");
    expect(kunciEjaan("Soeharto")).toBe(kunciEjaan("Suharto"));
    expect(kunciEjaan("Djamaluddin")).toBe(kunciEjaan("Jamaludin"));
    expect(kunciEjaan("Hassan")).toBe(kunciEjaan("Hasan"));
    expect(kunciEjaan("Bt Rahma")).toBe(kunciEjaan("binti Rahma"));
    // "M" di tengah/akhir bukan Muhammad
    expect(kunciEjaan("Ahmad M")).not.toContain("muhammad");
    expect(kunciRapat("Siti Nur Haliza")).toBe(kunciRapat("Siti Nurhaliza"));
  });

  it("jarakEdit dan batas mirip", () => {
    expect(jarakEdit("alwi", "alwi")).toBe(0);
    expect(jarakEdit("kitten", "sitting")).toBe(3);
    expect(jarakEdit("", "abc")).toBe(3);
    expect([batasMirip(4), batasMirip(5), batasMirip(9), batasMirip(10), batasMirip(20)]).toEqual([0, 1, 1, 2, 2]);
  });
});

describe("periksaEjaan tanpa kamus", () => {
  it("penulisan sama setelah gelar/tanda baca/huruf besar diabaikan = tidak ada usulan", () => {
    expect(periksaEjaan([S("SIPP", "H. Ahmad Yani, S.H."), S("BAS", "AHMAD YANI"), S("Blangko", "Ahmad  Yani")])).toEqual([]);
  });

  it("satu nama dua ejaan: beda-ejaan dengan sumbernya, usulan = penulisan terbanyak", () => {
    const u = periksaEjaan([S("SIPP", "Muhammad Alwi"), S("BAS", "Muhamad Alwi"), S("Blangko", "Muhammad Alwi")]);
    expect(u).toHaveLength(1);
    expect(u[0]).toMatchObject({ jenis: "beda-ejaan", tingkat: "periksa", usulanBaku: "Muhammad Alwi" });
    expect(u[0].nama.map((n) => n.asal).sort()).toEqual(["BAS", "Blangko", "SIPP"]);
    expect(u[0].pesan).toContain('BAS: "Muhamad Alwi"');
  });

  it("spasi: Nur Haliza = Nurhaliza dilaporkan; nama berbeda jauh tidak", () => {
    const u = periksaEjaan([S("SIPP", "Siti Nur Haliza"), S("BAS", "Siti Nurhaliza"), S("SIPP", "Joko Widodo")]);
    expect(u.map((x) => x.jenis)).toEqual(["beda-ejaan"]);
  });

  it("mirip: selisih satu-dua huruf pada nama panjang diperiksa; nama pendek tidak ditebak", () => {
    const u = periksaEjaan([S("SIPP", "Ahmad Fauzi"), S("BAS", "Ahmad Fauzan")]);
    expect(u.map((x) => x.jenis)).toEqual(["mirip"]);
    expect(u[0].tingkat).toBe("periksa");
    expect(periksaEjaan([S("SIPP", "Ali"), S("BAS", "Ani")])).toEqual([]);
    expect(periksaEjaan([S("SIPP", "Budi Santoso"), S("BAS", "Joko Widodo")])).toEqual([]);
  });

  it("sumber ganda yang sama (asal dan tulisan sama) tidak dihitung dua kali", () => {
    expect(periksaEjaan([S("SIPP", "Ahmad Yani"), S("SIPP", "ahmad  yani")])).toEqual([]);
  });
});

describe("periksaEjaan dengan kamus", () => {
  const kamus = [{ baku: "Muhammad Alwi", varian: ["Muhamad Alwi bin Ali", "Alwi M", "Mohd Alwi"] }];

  it("varian yang tercatat: alias (info) dengan ejaan baku; ejaan baku sendiri tidak diusulkan", () => {
    const u = periksaEjaan([S("SIPP", "Mohd Alwi"), S("BAS", "Muhammad Alwi")], kamus);
    const alias = u.filter((x) => x.jenis === "alias");
    expect(alias).toHaveLength(1);
    expect(alias[0]).toMatchObject({ tingkat: "info", usulanBaku: "Muhammad Alwi" });
    expect(alias[0].nama).toEqual([S("SIPP", "Mohd Alwi")]);
    // dua penulisan yang berbeda untuk satu orang juga dilaporkan beda-ejaan dengan usulan baku dari kamus
    expect(u.find((x) => x.jenis === "beda-ejaan")?.usulanBaku).toBe("Muhammad Alwi");
  });

  it("nama yang tidak ada di kamus tidak mendapat alias", () => {
    expect(periksaEjaan([S("SIPP", "Siti Aminah")], kamus)).toEqual([]);
  });

  it("periksaSatuNama hanya menjawab alias dari kamus", () => {
    expect(periksaSatuNama("Mohd Alwi", kamus).map((x) => [x.jenis, x.usulanBaku])).toEqual([["alias", "Muhammad Alwi"]]);
    expect(periksaSatuNama("Muhammad Alwi", kamus)).toEqual([]);
    expect(periksaSatuNama("", kamus)).toEqual([]);
    expect(periksaSatuNama("Siti Aminah", [])).toEqual([]);
  });

  it("urutan: beda-ejaan, mirip, lalu alias", () => {
    const u = periksaEjaan([S("SIPP", "Mohd Alwi"), S("BAS", "Muhammad Alwi"), S("SIPP", "Ahmad Fauzi"), S("BAS", "Ahmad Fauzan")], kamus);
    expect(u.map((x) => x.jenis)).toEqual(["beda-ejaan", "mirip", "alias"]);
  });
});

describe("pembersih masukan", () => {
  it("sumber nama: larik {asal, nama}; kosong dibuang; terlalu banyak atau bentuk salah ditolak", () => {
    expect(bersihkanSumberNama([{ asal: "SIPP", nama: "  Ahmad   Yani " }, { asal: "BAS", nama: "" }, { nama: "Budi Santoso" }, { asal: "X", nama: "S.H." }])).toEqual([
      { asal: "SIPP", nama: "Ahmad Yani" },
      { asal: "(tanpa asal)", nama: "Budi Santoso" },
    ]);
    expect(() => bersihkanSumberNama("Ahmad")).toThrow(GalatEjaan);
    expect(() => bersihkanSumberNama([1])).toThrow(GalatEjaan);
    expect(() => bersihkanSumberNama(Array.from({ length: BATAS_NAMA_PERIKSA + 1 }, () => ({ asal: "a", nama: "Ahmad Yani" })))).toThrow(/Paling banyak/);
  });

  it("entri kamus: baku wajib, varian unik dan berbeda dari baku, batas jumlah", () => {
    expect(bersihkanEntriKamus({ baku: "Muhammad Alwi", varian: "Muhamad Alwi\nMoh. Alwi\nmuhammad  alwi\n" })).toEqual({ baku: "Muhammad Alwi", varian: ["Muhamad Alwi", "Moh. Alwi"] });
    expect(() => bersihkanEntriKamus({ baku: "S.H.", varian: ["x y"] })).toThrow(/Nama baku/);
    expect(() => bersihkanEntriKamus({ baku: "Ahmad Yani", varian: ["Ahmad Yani"] })).toThrow(/varian/);
    expect(() => bersihkanEntriKamus({ baku: "Ahmad Yani", varian: Array.from({ length: 25 }, (_, i) => `Ahmad Yani ${i}x`) })).toThrow(/Paling banyak/);
    expect(() => bersihkanEntriKamus(null)).toThrow(GalatEjaan);
  });
});
