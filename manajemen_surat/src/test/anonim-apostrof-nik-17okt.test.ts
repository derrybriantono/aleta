// @vitest-environment node
import { describe, expect, it } from "vitest";

import { bacaRtf } from "@/lib/baca-rtf";
import { hitungNama, polaNama } from "@/lib/anonim-nama-pihak";
import { anonimkanRtf, anonimkanTeks, periksaSisa, type EntitasAnonim } from "@/lib/anonimisasi-putusan";
import { petaRtf, samarkanSisaRtf } from "@/lib/samarkan-sisa-rtf";

/**
 * 17 Okt 2026 - audit ABT (A1-A3). Nama, NIK di uji ini karangan.
 *
 * A1: nama berapostrof (Nur'aini, Ma'ruf, Ja'far) bocor utuh: Word menulis
 *     apostrofnya \'92 (cp1252), \rquote, atau 舗?, sedangkan SIPP
 *     menyimpan ASCII '.
 * A2: NIK/KK berpemisah (titik, spasi, tanda hubung) tidak tersamar.
 * A3: nama depan saja bocor tanpa peringatan di periksaSisa.
 */

const NAMA = ["Nur'aini binti Hasan", "Ja'far bin Darmo", "Ma'ruf bin Lagu"];

/** Satu naskah, tiga cara Word menulis apostrof + bentuk ASCII polos. */
const RTF_APOSTROF =
  "{\\rtf1\\ansi{\\fonttbl{\\f0 Arial;}}\\pard " +
  "Nur\\'92aini binti Hasan sebagai Penggugat;\\par " +
  "Ja\\u8217?far bin Darmo sebagai Tergugat;\\par " +
  "Bahwa Nur\\rquote aini pergi;\\par " +
  "Bahwa Ma'ruf hadir dan Ja\\'92far pulang;\\par }";

function teksRtf(rtf: string): string {
  return bacaRtf(rtf);
}

describe("A1 - apostrof lentur", () => {
  it("petaRtf: \\'92 dibaca sebagai ’ (bukan U+0092) dan \\rquote sebagai ’", () => {
    const t = petaRtf("{\\rtf1 Nur\\'92aini dan Nur\\rquote aini dan \\lquote x\\par }").teks;
    expect(t).toContain("Nur’aini dan Nur’aini dan ‘x");
    expect(t).not.toContain("\u0092");
  });

  it("bacaRtf (penjaga unggah): \\rquote dibaca sebagai ’", () => {
    expect(teksRtf("{\\rtf1 Nur\\rquote aini\\par }")).toContain("Nur’aini");
  });

  it("samarkanSisaRtf menyamarkan nama berapostrof dalam semua bentuk RTF", () => {
    const hasil = samarkanSisaRtf(RTF_APOSTROF, NAMA);
    const t = teksRtf(hasil.rtf);
    expect(t).not.toMatch(/aini|ruf|far/i);
    expect(hasil.rtf.startsWith("{\\rtf1")).toBe(true);
    expect(t).toContain("xxx sebagai Penggugat");
  });

  it("anonimkanRtf menyamarkan nama berapostrof dan periksa sisa kosong", () => {
    const entitas: EntitasAnonim = {
      sebutan: { satu: "Penggugat", dua: "Tergugat" },
      pihak: [
        { pihakKe: 1, urutan: 1, nama: NAMA[0] },
        { pihakKe: 2, urutan: 1, nama: NAMA[1] },
        { pihakKe: 2, urutan: 2, nama: NAMA[2] },
      ],
    };
    const hasil = anonimkanRtf(RTF_APOSTROF, entitas);
    const t = teksRtf(hasil.rtf);
    expect(t).not.toMatch(/aini|ruf|far/i);
    expect(hasil.sisa).toEqual([]);
    expect(t).toContain("PENGGUGAT sebagai Penggugat");
  });

  it("polaNama / hitungNama / periksaSisa menemukan nama ASCII ' di naskah ’ (dan sebaliknya)", () => {
    expect(hitungNama("Bahwa Nur’aini pergi", "Nur'aini")).toBe(1);
    expect(hitungNama("Bahwa Nur'aini pergi", "Nur’aini")).toBe(1);
    expect(hitungNama("Bahwa Nur\u0092aini pergi", "Nur'aini")).toBe(1);
    expect(polaNama("Ja'far").test("JA’FAR hadir")).toBe(true);
    const sisa = periksaSisa("Bahwa Nur’aini pergi", { pihak: [{ pihakKe: 1, nama: "Nur'aini binti Ma'ruf" }] });
    expect(sisa.map((x) => x.kata)).toContain("Nur’aini");
  });
});

describe("A2 - NIK/KK berpemisah", () => {
  const BENTUK = ["72.03.01.410190.0001", "7203 0141 0190 0001", "7203-0141-0190-0001", "7203014101900001"];

  it.each(BENTUK)("samarkanSisaRtf menyamarkan NIK %s", (nik) => {
    const hasil = samarkanSisaRtf(`{\\rtf1 NIK ${nik}, pekerjaan petani\\par }`, []);
    expect(teksRtf(hasil.rtf)).toBe("NIK xxxxxxxxxxxxxxxx, pekerjaan petani");
  });

  it.each(BENTUK)("anonimkanTeks menyamarkan NIK %s tanpa data SIPP", (nik) => {
    const h = anonimkanTeks(`NIK ${nik}, pekerjaan petani`, { pihak: [] });
    expect(h.teks).toBe("NIK xxxxxxxxxxxxxxxx, pekerjaan petani");
    expect(h.sisa).toEqual([]);
  });

  it.each(BENTUK.slice(0, 3))("periksaSisa melaporkan NIK %s yang masih tampil", (nik) => {
    const sisa = periksaSisa(`NIK ${nik} dst`, { pihak: [] });
    expect(sisa.map((x) => x.jenis)).toContain("NIK");
  });

  it("bukan NIK: 15 angka, 17 angka, telepon 12 angka tidak tersamar sebagai NIK", () => {
    const teks = "a 7203 0141 0190 000 b 7203014101900001 2 c 0812-3456-7890 d";
    const h = samarkanSisaRtf(`{\\rtf1 ${teks}\\par }`, []);
    const t = teksRtf(h.rtf);
    expect(t).toContain("a 7203 0141 0190 000 b");
    expect(t).toContain("0812-3456-7890");
    // 16 angka yang diikuti " 2" berdiri sendiri (angka ke-17 dipisah spasi) - batas kanan bukan angka lolos.
    const tujuhBelas = samarkanSisaRtf("{\\rtf1 x 72030141019000012 y\\par }", []);
    expect(teksRtf(tujuhBelas.rtf)).toContain("72030141019000012");
  });
});

describe("A3 - nama depan saja dilaporkan periksaSisa", () => {
  const entitas: EntitasAnonim = {
    pihak: [
      { pihakKe: 1, nama: "Melki Saputra bin Ardan" },
      { pihakKe: 2, nama: "Siti Aminah binti Hasan" },
    ],
    lindungi: ["Idris, S.H.I."],
  };

  it("melaporkan 'Melki' lepas", () => {
    const sisa = periksaSisa("Bahwa Pak Melki datang ke rumah", entitas);
    expect(sisa.some((x) => x.kata === "Melki")).toBe(true);
  });

  it("anonimkanTeks: 'Melki' lepas yang lolos tetap muncul di sisa", () => {
    const h = anonimkanTeks("Melki Saputra bin Ardan hadir. Kemudian Pak Melki pulang.", entitas);
    expect(h.teks).toContain("Pak Melki pulang");
    expect(h.sisa.some((x) => x.kata === "Melki")).toBe(true);
  });

  it("melewati gelar/sebutan ('Siti'), kata huruf kecil, dan nama pelindung", () => {
    expect(periksaSisa("Siti datang", entitas)).toEqual([]);
    expect(periksaSisa("melki lupa", entitas)).toEqual([]);
    const lain = periksaSisa("Hakim Idris memutus", { pihak: [{ pihakKe: 1, nama: "Idris Lamale bin X" }], lindungi: ["Idris, S.H.I."] });
    expect(lain).toEqual([]);
  });

  it("mengambil kata pertama bukan gelar: 'Muh. Rizal Hamid' -> 'Rizal'", () => {
    const sisa = periksaSisa("Bahwa Rizal datang", { pihak: [{ pihakKe: 1, nama: "Muh. Rizal Hamid bin Y" }] });
    expect(sisa.some((x) => x.kata === "Rizal")).toBe(true);
  });
});
