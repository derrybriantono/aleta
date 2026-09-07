// @vitest-environment node
import { inflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";

import { buatDocx, sandikanXml, type AlineaDocx } from "@/lib/docx";
import { buatPdf } from "@/lib/cetak-pdf";

/**
 * Mesin cetak DOCX dan PDF (Tahap 4).
 *
 * ============================================================================
 * YANG DIJAGA DI SINI
 * ============================================================================
 *
 *   - berkasnya harus SUNGGUH terbentuk - ZIP yang cacat gagal dibuka Word
 *     pada hari sidang, dan yang membukanya bukan yang membuatnya;
 *   - "&", "<", dan kutipan pada nama pihak harus disandikan, atau seluruh
 *     dokumen ditolak Word;
 *   - huruf yang tidak dapat dicetak DILAPORKAN, tidak dibuang diam-diam -
 *     kutipan kitab yang kosong di tengah pertimbangan hukum tidak akan
 *     disadari siapa pun;
 *   - dua penerbitan atas naskah yang sama menghasilkan berkas yang sama
 *     persis, supaya keduanya dapat dibandingkan.
 */

const NASKAH: AlineaDocx[] = [
  { teks: "PENETAPAN", rata: "tengah", tebal: true },
  { teks: "Nomor 206/Pdt.P/2026/PA.Dgl", rata: "tengah", tebal: true },
  { teks: "DEMI KEADILAN BERDASARKAN KETUHANAN YANG MAHA ESA", rata: "tengah", tebal: true },
  {
    teks: "Menimbang, bahwa para Pemohon mendalilkan telah menikah berdasarkan hukum Islam, namun tidak tercatat di Kantor Urusan Agama. Karenanya para Pemohon mengajukan permohonan pengesahan nikah kepada Pengadilan Agama.",
  },
  { teks: "Mengabulkan permohonan Pemohon I dan Pemohon II;", nomor: 1, jorok: 1 },
  { teks: "Menyatakan sah pernikahan antara Pemohon I dengan Pemohon II;", nomor: 2, jorok: 1 },
];

function bacaEntriZip(zip: Buffer): Map<string, string> {
  const isi = new Map<string, string>();
  let i = 0;
  while (i < zip.length - 4) {
    if (zip.readUInt32LE(i) !== 0x04034b50) break;
    const panjangMampat = zip.readUInt32LE(i + 18);
    const panjangNama = zip.readUInt16LE(i + 26);
    const panjangTambahan = zip.readUInt16LE(i + 28);
    const nama = zip.subarray(i + 30, i + 30 + panjangNama).toString("utf8");
    const awalData = i + 30 + panjangNama + panjangTambahan;
    const data = zip.subarray(awalData, awalData + panjangMampat);
    isi.set(nama, inflateRawSync(data).toString("utf8"));
    i = awalData + panjangMampat;
  }
  return isi;
}

describe("DOCX yang sungguh terbentuk", () => {
  it("berisi seluruh bagian yang dituntut Word", () => {
    const zip = buatDocx({ alinea: NASKAH });
    const entri = bacaEntriZip(zip);

    for (const bagian of [
      "[Content_Types].xml",
      "_rels/.rels",
      "word/document.xml",
      "word/_rels/document.xml.rels",
      "word/styles.xml",
    ]) {
      expect(entri.has(bagian), bagian).toBe(true);
    }
  });

  it("diawali tanda tangan ZIP dan diakhiri direktori pusat", () => {
    const zip = buatDocx({ alinea: NASKAH });
    expect(zip.readUInt32LE(0)).toBe(0x04034b50);
    expect(zip.subarray(-22).readUInt32LE(0)).toBe(0x06054b50);
  });

  it("seluruh alinea sampai ke dalam dokumen", () => {
    const entri = bacaEntriZip(buatDocx({ alinea: NASKAH }));
    const dokumen = entri.get("word/document.xml") ?? "";
    expect(dokumen).toContain("PENETAPAN");
    expect(dokumen).toContain("DEMI KEADILAN BERDASARKAN KETUHANAN YANG MAHA ESA");
    expect(dokumen).toContain("Mengabulkan permohonan Pemohon I");
  });

  it("nomor daftar ditulis sebagai teks, tidak diserahkan ke penomoran Word", () => {
    // Penomoran otomatis Word menomori ulang sendiri saat alinea disisipkan -
    // itulah yang membuat bukti kedua kehilangan nomornya pada blangko ABT.
    const dokumen = bacaEntriZip(buatDocx({ alinea: NASKAH })).get("word/document.xml") ?? "";
    expect(dokumen).toContain("1. Mengabulkan permohonan");
    expect(dokumen).toContain("2. Menyatakan sah pernikahan");
    expect(dokumen).not.toContain("<w:numPr>");
  });

  it("huruf dan ukuran naskah pengadilan terpasang", () => {
    const gaya = bacaEntriZip(buatDocx({ alinea: NASKAH })).get("word/styles.xml") ?? "";
    expect(gaya).toContain("Times New Roman");
    expect(gaya).toContain('w:sz w:val="24"'); // 12 titik = 24 setengah-titik
  });

  it("dua penerbitan atas naskah yang sama menghasilkan berkas yang sama persis", () => {
    // Berkas yang berubah hanya karena jamnya berbeda membuat perbandingan
    // antara dua penerbitan mustahil.
    const a = buatDocx({ alinea: NASKAH });
    const b = buatDocx({ alinea: NASKAH });
    expect(a.equals(b)).toBe(true);
  });
});

describe("penyandian XML", () => {
  it("dan, kurung siku, dan kutipan disandikan", () => {
    expect(sandikanXml('A & B < C > D "E" \'F\'')).toBe("A &amp; B &lt; C &gt; D &quot;E&quot; &apos;F&apos;");
  });

  it("nama pihak bertanda dan tidak merusak dokumen", () => {
    const dokumen =
      bacaEntriZip(buatDocx({ alinea: [{ teks: 'PT Maju & Jaya <"Persero">' }] })).get("word/document.xml") ?? "";
    expect(dokumen).toContain("PT Maju &amp; Jaya &lt;&quot;Persero&quot;&gt;");
    // Tidak ada tanda kurung siku mentah yang dapat menutup unsur XML.
    expect(dokumen).not.toContain('<"Persero">');
  });

  it("bita kendali dibuang - Word menolak seluruh berkas karenanya", () => {
    const kotor = "Menimbang" + String.fromCharCode(1) + String.fromCharCode(31) + "bahwa";
    expect(sandikanXml(kotor)).toBe("Menimbangbahwa");
  });

  it("huruf Arab dan tanda kutip melengkung dipertahankan di DOCX", () => {
    // DOCX memakai UTF-8, jadi tidak ada alasan membuangnya - kerusakan
    // Unicode pada jalur RTF lama justru inilah yang diperbaiki.
    const arab = "ﺩﺭﺀ ﺍﻟﻤﻔﺎﺳﺪ";
    const dokumen = bacaEntriZip(buatDocx({ alinea: [{ teks: `Kaidah: ${arab} "kutipan"` }] })).get("word/document.xml") ?? "";
    expect(dokumen).toContain(arab);
    expect(dokumen).toContain("&quot;kutipan&quot;");
  });
});

describe("PDF dari susunan yang sama", () => {
  it("terbentuk dan berawalan tanda tangan PDF", async () => {
    const hasil = await buatPdf({ alinea: NASKAH });
    expect(hasil.berkas.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(hasil.jumlahHalaman).toBeGreaterThanOrEqual(1);
  });

  it("naskah panjang berpindah halaman, tidak tertumpuk", async () => {
    const panjang: AlineaDocx[] = Array.from({ length: 120 }, (_, i) => ({
      teks: `Menimbang, bahwa alinea ke-${i + 1} ini cukup panjang untuk memenuhi lebar halaman dan memaksa pemenggalan baris berulang kali sampai halaman penuh.`,
    }));
    const hasil = await buatPdf({ alinea: panjang });
    expect(hasil.jumlahHalaman).toBeGreaterThan(1);
  });

  it("naskah Latin tercetak utuh tanpa huruf yang hilang", async () => {
    const hasil = await buatPdf({ alinea: NASKAH });
    expect(hasil.hurufTakTercetak).toBe(0);
    expect(hasil.alineaTerdampak).toEqual([]);
  });

  it("huruf yang tidak dapat dicetak DILAPORKAN, bukan dibuang diam-diam", async () => {
    // Kutipan kitab berhuruf Arab yang lenyap di tengah pertimbangan hukum
    // tidak akan disadari siapa pun yang membaca hasilnya.
    const hasil = await buatPdf({
      alinea: [
        { teks: "Menimbang, bahwa kaidah fikih menyatakan:" },
        { teks: "ﺩﺭﺀ ﺍﻟﻤﻔﺎﺳﺪ ﻣﻘﺪﻡ ﻋﻠﻰ ﺟﻠﺐ ﺍﻟﻤﺼﺎﻟﺢ" },
      ],
    });
    expect(hasil.hurufTakTercetak).toBeGreaterThan(0);
    expect(hasil.alineaTerdampak).toContain(1);
    expect(hasil.alineaTerdampak).not.toContain(0);
  });

  it("alinea kosong tidak menggagalkan penyusunan", async () => {
    const hasil = await buatPdf({ alinea: [{ teks: "" }, { teks: "Isi." }] });
    expect(hasil.berkas.length).toBeGreaterThan(100);
  });
});
