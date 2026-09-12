// @vitest-environment node

import { describe, expect, it } from "vitest";

import { paragrafButir } from "@/lib/isian-putusan-sipp";

/**
 * ============================================================================
 * BARIS HAMPA SESUDAH KETERANGAN SAKSI
 * ============================================================================
 *
 * Keterangan saksi tersimpan di perkara_pertimbangan_hukum.pertimbangan_hukum -
 * kolom yang ditulis "Putusan otomatis". Dicari dengan menyisir 186 kolom teks
 * sipp_donggala; 421 baris memuat frasa "di bawah sumpah", seluruhnya di kolom
 * itu dan tidak di kolom lain mana pun.
 *
 * Yang dilaporkan: sesudah tiap blok saksi ada satu baris kosong sebelum
 * alinea berikutnya. Satu baris hampa menjadi paragrafnya sendiri, lalu \par
 * tersendiri di dokumen cetak.
 *
 * paragrafButir menerima TEKS BIASA - ia memecah pada ganti baris dan
 * melolosi HTML pada isinya, sebab yang masuk naskah ALETA sendiri. Baris
 * yang benar-benar kosong sudah lama dibuang; yang lolos adalah baris yang
 * isinya hanya &nbsp; atau spasi tak-putus, dan penyunting menghasilkan
 * keduanya.
 */

const SAKSI_DENGAN_HAMPA = [
  "1. Sahrul, umur 35 tahun, di bawah sumpahnya memberikan keterangan:",
  "- Bahwa saksi kenal dengan Penggugat;",
  "- Bahwa Tergugat tidak pernah mau berubah;",
  "&nbsp;",
  "2. Ziqni, umur 21 tahun, di bawah sumpahnya memberikan keterangan:",
  "- Bahwa saksi adalah tetangga Penggugat;",
  " ",
  "Bahwa Penggugat telah menyampaikan kesimpulan;",
].join("\n");

describe("baris hampa tidak sampai ke dokumen cetak", () => {
  const hasil = paragrafButir(SAKSI_DENGAN_HAMPA);

  it("tidak satu pun paragraf berdiri tanpa isi", () => {
    expect(hasil).not.toMatch(/<p>\s*<\/p>/);
    expect(hasil).not.toMatch(/<p>(?:&amp;nbsp;|\s| )*<\/p>/i);
  });

  it("jumlah paragrafnya persis jumlah kalimat yang berisi", () => {
    // Enam: dua pengantar saksi, tiga keterangan, satu kesimpulan.
    expect((hasil.match(/<p>/g) || []).length).toBe(6);
  });

  it("kalimat sesudah saksi menyusul langsung, tanpa jarak", () => {
    expect(hasil).toContain(
      "<p>- Bahwa saksi adalah tetangga Penggugat;</p><p>Bahwa Penggugat telah menyampaikan kesimpulan;</p>"
    );
  });

  it("tidak satu kata pun keterangan saksi hilang", () => {
    const hanyaHuruf = (x: string) => x.replace(/<[^>]*>|&nbsp;|&amp;nbsp;|[\s ]+/g, "");
    expect(hanyaHuruf(hasil)).toBe(hanyaHuruf(SAKSI_DENGAN_HAMPA));
  });
});

describe("yang berisi tetap utuh", () => {
  it("baris kosong berturut-turut tidak meninggalkan paragraf hampa", () => {
    const teks = "Menimbang, bahwa pertama;\n\n\nMenimbang, bahwa kedua;";
    expect(paragrafButir(teks)).toBe(
      "<p>Menimbang, bahwa pertama;</p><p>Menimbang, bahwa kedua;</p>"
    );
  });

  it("teks yang seluruhnya hampa menghasilkan kosong, bukan paragraf hampa", () => {
    expect(paragrafButir("&nbsp;\n \n   ")).toBe("");
  });

  it("HTML pada isinya TETAP dilolosi - masukannya teks, bukan tag", () => {
    // Kalau ini berubah, naskah yang memuat "<" akan menyuntikkan tag ke
    // borang putusan SIPP.
    expect(paragrafButir("Pasal 5 < Pasal 6")).toBe("<p>Pasal 5 &lt; Pasal 6</p>");
  });
});
