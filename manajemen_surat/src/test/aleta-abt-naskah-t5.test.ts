// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  alineaDariRtf,
  bacaLaporanBanding,
  bandingAlinea,
  bandingRingkasPdf,
  golonganBeda,
  kertasDariRtf,
  TOLERANSI_LETAK_MM,
} from "@/lib/aleta-abt-naskah";
import { ringkasDariItem } from "@/server/modules/aleta-abt-cetak/pdf-ringkas";

/**
 * TAHAP 5 ALETA ABT - pembanding naskah (5 Nov 2026). Semua data rekaan; tidak ada data pihak nyata.
 */

const rtf = (...par: string[]) => "{\\rtf1\\ansi\\paperw11906\\paperh16838\\deff0{\\fonttbl{\\f0 Times New Roman;}}\n" + par.map((p) => `\\pard ${p}\\par\n`).join("") + "}";

describe("alinea dari RTF", () => {
  it("satu butir per paragraf, spasi dilipat, alinea kosong dibuang", () => {
    expect(alineaDariRtf(rtf("Satu   dua", "", "Tiga"))).toEqual(["Satu dua", "Tiga"]);
  });
});

describe("banding alinea", () => {
  it("identik penuh = 100 persen", () => {
    const h = bandingAlinea(["a", "b", "c"], ["a", "b", "c"]);
    expect(h).toMatchObject({ total: 3, identik: 3, persen: 100, beda: [] });
  });

  it("menggolongkan beda: spasi, tanda baca, isi", () => {
    const h = bandingAlinea(["Kota Palu", "Hari Senin.", "Biaya Rp 100"], ["KotaPalu", "hari senin", "Biaya Rp 200"]);
    expect(h.identik).toBe(0);
    expect(h.perKelas).toMatchObject({ "tata-letak": 1, "tanda-baca": 1, isi: 1, "hanya-abt": 0, "hanya-aleta": 0 });
    expect(h.total).toBe(3);
  });

  it("isian kosong: ALETA mencetak titik-titik, ABT kosong -> tanda-kosong, bukan beda isi", () => {
    const h = bandingAlinea(["Sebelum", "Sesudah"], ["Sebelum", "...", "Sesudah"]);
    expect(h.perKelas["tanda-kosong"]).toBe(1);
    expect(h.perKelas["hanya-aleta"]).toBe(0);
    expect(h.identik).toBe(2);
    expect(golonganBeda("Nafkah", "Nafkah ...")).toBe("tanda-kosong");
    expect(golonganBeda("Nafkah", "Nafkah Rp 1")).toBe("isi");
    expect(golonganBeda("a ...", "b ...")).toBe("isi");
  });

  it("alinea yang hanya ada di satu sisi", () => {
    const h = bandingAlinea(["a", "b", "c"], ["a", "c", "d"]);
    expect(h.identik).toBe(2);
    expect(h.perKelas["hanya-abt"] + h.perKelas.isi).toBeGreaterThanOrEqual(1);
    expect(h.total).toBe(h.identik + h.beda.length);
  });

  it("jumlah identik + beda selalu sama dengan total, apa pun urutannya", () => {
    const a = ["p1", "p2", "p3", "p4", "p5", "p6"];
    const b = ["p1", "x2", "p3", "p5", "p6", "p7", "p8"];
    const h = bandingAlinea(a, b);
    expect(h.identik + h.beda.length).toBe(h.total);
    expect(h.persen).toBeCloseTo((h.identik / h.total) * 100, 6);
  });

  it("dua sisi kosong dianggap sama", () => {
    expect(bandingAlinea([], []).persen).toBe(100);
  });
});

describe("kertas", () => {
  it("A4 dan F4 dari kata kendali kepala", () => {
    expect(kertasDariRtf("{\\rtf1\\paperw11906\\paperh16838 x}").nama).toBe("A4");
    expect(kertasDariRtf("{\\rtf1\\paperw12191\\paperh18709 x}").nama).toBe("F4");
    expect(kertasDariRtf("{\\rtf1\\paperw12240\\paperh20160 x}").nama).toBe("Legal");
    expect(kertasDariRtf("{\\rtf1\\paperw5000\\paperh5000 x}").nama).toBe("Lainnya");
    expect(kertasDariRtf("{\\rtf1 x}").nama).toBe("Tak terbaca");
  });
});

describe("halaman dan letak tanda tangan dari PDF", () => {
  const halaman = [
    { lebar: 595, tinggi: 842 },
    { lebar: 595, tinggi: 842 },
  ];
  const butir = (str: string, y: number, hal: number) => ({ str, x: 100, y, lebar: 200, tinggi: 12, halaman: hal });

  it("jumlah halaman dan baris jabatan terakhir", () => {
    const r = ringkasDariItem(halaman, [butir("Demikian putusan ini", 700, 1), butir("Hakim Ketua,", 400, 2), butir("Panitera Pengganti,", 300, 2), butir("Halaman 2", 40, 2)]);
    expect(r.jumlahHalaman).toBe(2);
    expect(r.letakTandaTangan?.halaman).toBe(2);
    expect(r.letakTandaTangan?.dariAtasMm).toBeGreaterThan(150);
  });

  it("tanpa baris jabatan -> tidak ditemukan", () => {
    expect(ringkasDariItem(halaman, [butir("isi saja", 700, 1)]).letakTandaTangan).toBeNull();
  });

  it("sama bila halaman sama dan selisih dalam toleransi; berbeda bila halaman lain", () => {
    const a = { jumlahHalaman: 5, letakTandaTangan: { halaman: 5, dariAtasMm: 100 } };
    expect(bandingRingkasPdf(a, { jumlahHalaman: 5, letakTandaTangan: { halaman: 5, dariAtasMm: 100 + TOLERANSI_LETAK_MM } })).toMatchObject({
      jumlahHalaman: { sama: true },
      letakTandaTangan: { sama: true },
    });
    expect(bandingRingkasPdf(a, { jumlahHalaman: 6, letakTandaTangan: { halaman: 6, dariAtasMm: 100 } })).toMatchObject({ jumlahHalaman: { sama: false }, letakTandaTangan: { sama: false } });
    expect(bandingRingkasPdf(a, { jumlahHalaman: 5, letakTandaTangan: null }).letakTandaTangan.sama).toBeNull();
  });
});

describe("laporan dari skrip", () => {
  it("menolak bentuk rusak dan membuang ruas tak dikenal", () => {
    expect(bacaLaporanBanding(null)).toBeNull();
    expect(bacaLaporanBanding({ ringkas: "x" })).toBeNull();
    const l = bacaLaporanBanding({
      ringkas: [{ jenis: "Cerai Gugat", naskah: 2, alinea: 10, identik: 9, persen: 90, naskahIdentik: 1, rahasia: "nama pihak" }],
      beda: [{ jenis: "Cerai Gugat", blangko: "X", perkara: "p1", kelas: "aneh", nomorAbt: 3, nomorAleta: 3, isian: ["PIHAK I"], abt: "teks pihak" }],
    });
    expect(l?.ringkas[0]).toEqual({ jenis: "Cerai Gugat", naskah: 2, alinea: 10, identik: 9, persen: 90, naskahIdentik: 1 });
    expect(l?.beda[0]).toEqual({ jenis: "Cerai Gugat", blangko: "X", perkara: "p1", kelas: "isi", nomorAbt: 3, nomorAleta: 3, isian: ["PIHAK I"] });
    expect(JSON.stringify(l)).not.toContain("teks pihak");
  });
});
