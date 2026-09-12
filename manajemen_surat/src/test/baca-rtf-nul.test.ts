// @vitest-environment node

import { describe, expect, it } from "vitest";

import { bacaRtf } from "@/lib/baca-rtf";

/**
 * ============================================================================
 * BITA KENDALI DI DALAM RTF TIDAK PERNAH MENJADI NASKAH
 * ============================================================================
 *
 * Dua penetapan - 204/Pdt.P/2026 (itsbat nikah) dan 180/Pdt.P/2026
 * (dispensasi kawin) - gagal diunggah dengan kalimat "server ALETA tidak
 * terjangkau", padahal portalnya hidup. Yang sebenarnya terjadi, dibaca dari
 * mengulang rutenya tanpa HTTP:
 *
 *   error: invalid byte sequence for encoding "UTF8": 0x00
 *     at simpanDraf (perakit-putusan.ts:376)
 *
 * NUL-nya dari definisi daftar Word: {\leveltext \'02\'00.;} - "dua aksara,
 * yang pertama nomor tingkat 0". Pembaca lama menulis \'00 itu sebagai
 * aksara, 49 kali di satu berkas dan 32 kali di berkas lain, tepat di
 * belakang tiap tanda butir. Postgres menolaknya, rute menjawab 500, dan
 * panel menyimpulkan servernya mati.
 */

/** Aksara NUL, ditulis sebagai lolosan supaya berkas uji ini sendiri bersih. */
const NUL = String.fromCharCode(0);

/** Potongan yang meniru bentuk Word: teks butir dengan \'00 di belakang tanda. */
const RTF_DENGAN_NUL =
  "{\\rtf1\\ansi{\\fonttbl{\\f0 Arial;}}" +
  "\\pard Keterangan saksi:\\par" +
  "{\\pntext -\\'00\\tab}Bahwa saksi kenal dengan Pemohon;\\par" +
  "{\\pntext -\\'00\\tab}Bahwa saksi mengetahui maksud Pemohon;\\par" +
  "Selesai.\\par}";

describe("bita kendali dari \\'xx", () => {
  const teks = bacaRtf(RTF_DENGAN_NUL);

  it("U+0000 tidak pernah sampai ke naskah", () => {
    expect(teks).not.toContain(NUL);
  });

  it("tanda butirnya sendiri tetap ada - hanya bita kendalinya yang dibuang", () => {
    expect(teks).toContain("- Bahwa saksi kenal dengan Pemohon;");
    expect(teks).toContain("- Bahwa saksi mengetahui maksud Pemohon;");
  });

  it("bita kendali lain di bawah 0x20 ikut dibuang, kecuali tab", () => {
    const aneh = "{\\rtf1 A\\'01B\\'07C\\'1fD\\'09E}";
    expect(bacaRtf(aneh)).toBe("ABCD E");
  });

  it("aksara di atas 0x20 tetap dibaca seperti semula - termasuk cp1252", () => {
    expect(bacaRtf("{\\rtf1 ba\\'92in syar\\'92i}")).toBe("ba’in syar’i");
    expect(bacaRtf("{\\rtf1 \\'e9t\\'e9}")).toBe("été");
  });
});

describe("yang lolos lewat \\u", () => {
  it("\\u0 pun tidak menjadi NUL", () => {
    expect(bacaRtf("{\\rtf1 A\\u0 ?B}")).not.toContain(NUL);
    expect(bacaRtf("{\\rtf1 A\\u0 ?B}")).toBe("AB");
  });
});
