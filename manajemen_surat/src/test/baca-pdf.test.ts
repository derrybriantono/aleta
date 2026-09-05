// @vitest-environment node
import { describe, expect, it } from "vitest";

import { cariDalamPdf, satukanPotongan, type IsiPdf } from "@/server/modules/aleta-ecourt/baca-pdf";
import { kataKunciBlangko } from "@/server/modules/aleta-ecourt/pustaka-pedoman";

/**
 * Pembacaan berkas PDF dan pustaka pedoman.
 *
 * ============================================================================
 * YANG DIJAGA DI SINI
 * ============================================================================
 *
 * Nomor halaman adalah inti B4, bukan hiasan: pedoman dirujuk di ruang sidang
 * dengan menyebut halamannya. Kutipan tanpa halaman memaksa yang memakainya
 * membuka berkas aslinya lagi - lalu pencariannya tidak menghemat apa pun.
 *
 * Penyatuan potongan diuji tersendiri karena di situlah kesalahan paling halus
 * bersembunyi: potongan yang disambung tanpa spasi menghasilkan kata
 * bergandengan, dan yang disambung dengan spasi berlebih memotong kata di
 * tengah. Keduanya menghasilkan naskah yang terbaca hampir benar.
 */

describe("menyatukan potongan halaman", () => {
  it("penanda akhir baris pdfjs menjadi pindah baris", () => {
    const teks = satukanPotongan([
      { str: "BERITA ACARA SIDANG", hasEOL: true },
      { str: "Nomor 551/Pdt.G/2026/PA.Dgl" },
    ]);
    expect(teks).toBe("BERITA ACARA SIDANG\nNomor 551/Pdt.G/2026/PA.Dgl");
  });

  it("potongan pada baris yang sama disambung dengan satu spasi", () => {
    expect(satukanPotongan([{ str: "Pengadilan" }, { str: "Agama" }, { str: "Donggala" }])).toBe(
      "Pengadilan Agama Donggala"
    );
  });

  it("spasi yang sudah ada tidak digandakan", () => {
    // Spasi ganda pada naskah yang dikutip terbaca sebagai kesalahan ketik yang
    // tidak pernah ada di pedoman aslinya.
    expect(satukanPotongan([{ str: "Pengadilan " }, { str: "Agama" }])).toBe("Pengadilan Agama");
    expect(satukanPotongan([{ str: "Pengadilan" }, { str: " Agama" }])).toBe("Pengadilan Agama");
  });

  it("potongan kosong tidak menambah spasi", () => {
    expect(satukanPotongan([{ str: "Satu" }, { str: "" }, { str: "Dua" }])).toBe("Satu Dua");
  });

  it("baris kosong berlebih dirapatkan, tetapi jeda alinea tetap ada", () => {
    const teks = satukanPotongan([
      { str: "Alinea satu", hasEOL: true },
      { str: "", hasEOL: true },
      { str: "", hasEOL: true },
      { str: "", hasEOL: true },
      { str: "Alinea dua" },
    ]);
    expect(teks).toBe("Alinea satu\n\nAlinea dua");
  });
});

describe("mencari di dalam berkas", () => {
  const isi: IsiPdf = {
    ada: true,
    sebab: "",
    berkas: "pedoman.pdf",
    jumlahHalaman: 2,
    halamanKosong: [],
    halaman: [
      { nomor: 1, teks: "Pendahuluan pedoman penyusunan berita acara sidang peradilan agama." },
      { nomor: 175, teks: "BAS Lanjutan Putus Verstek. Tergugat tidak hadir dan telah dipanggil secara patut." },
    ],
  };

  it("temuan membawa nomor halamannya", () => {
    // Inilah inti B4. Tanpa nomor halaman, kutipan tidak dapat dirujuk di
    // ruang sidang.
    const temuan = cariDalamPdf(isi, "verstek");
    expect(temuan).toHaveLength(1);
    expect(temuan[0].halaman).toBe(175);
  });

  it("pencarian tidak peka huruf besar-kecil", () => {
    expect(cariDalamPdf(isi, "VERSTEK")).toHaveLength(1);
    expect(cariDalamPdf(isi, "Berita Acara")).toHaveLength(1);
  });

  it("kutipan memuat kalimat di sekitarnya, bukan kata itu saja", () => {
    const kutipan = cariDalamPdf(isi, "verstek")[0].kutipan;
    expect(kutipan).toContain("BAS Lanjutan Putus Verstek");
    expect(kutipan).toContain("dipanggil secara patut");
  });

  it("kata yang tidak ada menghasilkan kosong, bukan tebakan terdekat", () => {
    expect(cariDalamPdf(isi, "ekonomi syariah")).toEqual([]);
  });

  it("pencarian kosong tidak mengembalikan seluruh berkas", () => {
    expect(cariDalamPdf(isi, "")).toEqual([]);
    expect(cariDalamPdf(isi, "   ")).toEqual([]);
  });

  it("batas temuan dihormati", () => {
    const banyak: IsiPdf = {
      ...isi,
      halaman: [{ nomor: 1, teks: "saksi saksi saksi saksi saksi" }],
    };
    expect(cariDalamPdf(banyak, "saksi", 3)).toHaveLength(3);
  });
});

describe("kata kunci pedoman dari nama blangko", () => {
  it("nama blangko sungguhan menghasilkan kata kunci yang berguna", () => {
    expect(kataKunciBlangko("[01b] (E-Court) BAS 2 P Hadir & T Tidak Hadir Pokok Perkara - Putusan Verstek.rtf")).toContain(
      "Putus Verstek"
    );
    expect(kataKunciBlangko("[02] BAS 1 P & T Hadir Mediasi P dan T PERMA 7 2022.rtf")).toContain("Mediasi");
    expect(kataKunciBlangko("[09] BAS 2 ... - Putusan Verstek - (3 Saksi).rtf")).toContain("Pemeriksaan Saksi");
  });

  it("nama yang tidak dikenali tetap menghasilkan kata kunci umum", () => {
    // Lebih baik menampilkan bagian pedoman yang terlalu umum daripada tidak
    // menampilkan apa pun dan membiarkan yang memakainya mengira pedomannya
    // tidak memuat dokumen ini.
    expect(kataKunciBlangko("Blangko aneh tanpa pola.rtf")).toEqual(["Putusan"]);
    expect(kataKunciBlangko("BAS aneh tanpa pola.rtf")).toEqual(["Berita Acara Sidang"]);
  });

  it("kode dan penanda e-Court tidak ikut menjadi kata kunci", () => {
    const kata = kataKunciBlangko("[01ab] (E-Court) BAS 1 Cabut.rtf");
    expect(kata).toContain("Cabut");
    expect(kata.join(" ")).not.toContain("01ab");
    expect(kata.join(" ")).not.toMatch(/e-?court/i);
  });
});
