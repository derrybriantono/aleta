import { describe, expect, it } from "vitest";

import { buktiDariAlinea, kalimatBaris } from "@/lib/bukti-tertulis";

const baca = (teks: string) => buktiDariAlinea([{ teks }])[0];

/**
 * Isian ABT yang belum diisi ditulis "..." (mis. "NIK 7203... tanggal ..."). Kasus nyata 7 Nov 2026: tanggal berupa titik-titik tidak dikenali
 * sebagai tanggal, sehingga nama menelan ", NIK ... tanggal ...", NIK terbaca kosong, dan paragraf pertimbangan otomatis memuat "TANGGAL ...".
 */
describe("kalimat bukti dengan isian titik-titik", () => {
  const ktp = (tgl: string) =>
    `Fotokopi Kartu Tanda Penduduk Elektronik (KTP-el) atas nama HESTI, NIK 72031847011950001 tanggal ${tgl}, yang dikeluarkan oleh Pemerintah Kabupaten Donggala, Provinsi Sulawesi Tengah, bukti surat tersebut telah diberi meterai cukup, di-nazegelen, serta telah dicocokkan dengan aslinya yang ternyata sesuai, lalu diberi tanda P.1 serta diberi tanggal dan paraf oleh Ketua Majelis;`;

  it("tanggal titik-titik dibaca kosong; nama dan NIK terbaca benar", () => {
    for (const tgl of ["...", "........", "…"]) {
      const b = baca(ktp(tgl));
      expect(b.baris.an).toBe("HESTI");
      expect(b.baris.no).toBe("72031847011950001");
      expect(b.baris.tgl).toBe("");
      expect(b.baris.tglTeks ?? "").toBe("");
      expect(b.baris.oleh).toBe("Pemerintah Kabupaten Donggala, Provinsi Sulawesi Tengah");
    }
  });

  it("tanggal sungguhan tetap terbaca seperti semula", () => {
    const b = baca(ktp("02-03-2026"));
    expect(b.baris.an).toBe("HESTI");
    expect(b.baris.no).toBe("72031847011950001");
    expect(b.baris.tgl).toBe("2026-03-02");
  });

  it("akta nikah dengan nomor, tanggal, dan penerbit titik-titik: ketiganya kosong", () => {
    const b = baca(
      "Fotokopi Kutipan Akta Nikah atas nama SELAMET (Pemohon I) dan Eni Mursidah (Pemohon II), Nomor ... tanggal ..., yang dikeluarkan oleh ..., bukti surat tersebut telah diberi meterai cukup, di-nazegelen, serta telah dicocokkan dengan aslinya yang ternyata sesuai, lalu diberi tanda P.3 serta diberi tanggal dan paraf oleh Ketua Majelis;"
    );
    expect(b.baris.no).toBe("");
    expect(b.baris.tgl).toBe("");
    expect(b.baris.oleh).toBe("");
    expect(b.baris.an).toContain("SELAMET");
  });

  it("kalimat yang disusun ulang dari isian tidak lagi memuat titik-titik", () => {
    const b = baca(ktp("..."));
    expect(kalimatBaris(b.baris, "P", 0, b.kode)).not.toMatch(/\.\.\./);
  });
});
