// @vitest-environment node

import { describe, expect, it } from "vitest";

import { pecahNaskahResmi } from "@/lib/naskah-putusan-resmi";

/**
 * Pemecahan naskah putusan resmi.
 *
 * Yang dijaga di sini SALAH POTONG, bukan gagal potong. Naskah yang gagal
 * dipotong berhenti di layar dan dibaca petugas; naskah yang salah potong
 * masuk ke borang SIPP, disimpan, lalu tercetak sebagai amar.
 */

/** Kerangka putusan sebagaimana ditulis templat satker. Nama direka. */
const NASKAH = [
  "1 dari 13 Halaman",
  "Putusan Nomor 9/Pdt.G/2026/PA.Dgl",
  "SALINAN",
  "",
  "PUTUSAN",
  "Nomor 9/Pdt.G/2026/PA.Dgl",
  "",
  "DEMI KEADILAN BERDASARKAN KETUHANAN YANG MAHA ESA",
  "PENGADILAN AGAMA DONGGALA",
  "",
  "Memeriksa dan mengadili perkara perdata agama pada tingkat pertama telah menjatuhkan putusan dalam perkara Cerai Gugat antara:",
  "Ani binti Budi, sebagai Penggugat;",
  "melawan",
  "Candra bin Dedi, sebagai Tergugat;",
  "Pengadilan Agama tersebut;",
  "DUDUK PERKARA",
  "Bahwa Penggugat dalam surat gugatannya tanggal 6 Januari 2026 mengemukakan hal-hal sebagai berikut;",
  "1. Bahwa pada tanggal 15 Mei 2010 Penggugat dan Tergugat menikah;",
  "PERTIMBANGAN HUKUM",
  "Menimbang, bahwa maksud dan tujuan gugatan Penggugat adalah sebagaimana diuraikan diatas;",
  "Mengingat, peraturan perundang-undangan yang berlaku;",
  "MENGADILI",
  "1. Mengabulkan gugatan Penggugat secara verstek;",
  "2. Membebankan kepada Penggugat biaya perkara sejumlah Rp199.000,00;",
  "Demikian diputuskan dalam rapat musyawarah Majelis Hakim pada hari Selasa tanggal 1 September 2026;",
  "Ketua Majelis,",
  "Eka Fajar, S.H.I., M.H.",
].join("\n");

describe("pecahNaskahResmi", () => {
  it("memotong keenam bagiannya pada jangkarnya", () => {
    const { bagian, halangan } = pecahNaskahResmi(NASKAH);

    expect(halangan).toEqual({});
    expect(bagian.kepala).toBe(
      ["PUTUSAN", "Nomor 9/Pdt.G/2026/PA.Dgl", "", "DEMI KEADILAN BERDASARKAN KETUHANAN YANG MAHA ESA", "PENGADILAN AGAMA DONGGALA"].join(
        "\n"
      )
    );
    expect(bagian.identitas).toContain("Ani binti Budi");
    expect(bagian.identitas).toContain("melawan");
    expect(bagian.dudukPerkara).toContain("surat gugatannya");
    expect(bagian.pertimbangan?.startsWith("Menimbang, bahwa")).toBe(true);
    expect(bagian.amar?.startsWith("1. Mengabulkan")).toBe(true);
    expect(bagian.penutup?.startsWith("Demikian diputuskan")).toBe(true);
  });

  it("tidak membiarkan satu bagian pun bocor ke bagian lain", () => {
    // Inilah kerusakan yang paling mahal: amar yang tertulis di kolom
    // Pertimbangan Hukum tetap tersimpan dan tetap tercetak.
    const { bagian } = pecahNaskahResmi(NASKAH);
    expect(bagian.pertimbangan).not.toContain("MENGADILI");
    expect(bagian.pertimbangan).not.toContain("Mengabulkan gugatan");
    expect(bagian.amar).not.toContain("Menimbang");
    expect(bagian.amar).not.toContain("Demikian diputuskan");
    expect(bagian.dudukPerkara).not.toContain("PERTIMBANGAN HUKUM");
    expect(bagian.identitas).not.toContain("DUDUK PERKARA");
  });

  it("membuang judul bagiannya sendiri dari isinya", () => {
    const { bagian } = pecahNaskahResmi(NASKAH);
    expect(bagian.dudukPerkara?.startsWith("DUDUK PERKARA")).toBe(false);
    expect(bagian.pertimbangan?.startsWith("PERTIMBANGAN")).toBe(false);
    expect(bagian.amar?.startsWith("MENGADILI")).toBe(false);
  });

  it("mengenali judul berenggang - gaya tetap naskah pengadilan", () => {
    // "M E N G A D I L I" bukan salah ketik; ia gaya templat sejak mesin tik.
    const berenggang = NASKAH.replace("MENGADILI", "M E N G A D I L I")
      .replace("DUDUK PERKARA", "D U D U K   P E R K A R A")
      .replace("PUTUSAN\nNomor", "P U T U S A N\nNomor");
    const { bagian, halangan } = pecahNaskahResmi(berenggang);
    expect(halangan).toEqual({});
    expect(bagian.amar?.startsWith("1. Mengabulkan")).toBe(true);
    expect(bagian.dudukPerkara).toContain("surat gugatannya");
  });

  it("mengenali ejaan judul yang berbeda antar templat", () => {
    const lain = NASKAH.replace("DUDUK PERKARA", "TENTANG DUDUK PERKARA").replace(
      "PERTIMBANGAN HUKUM",
      "TENTANG HUKUMNYA"
    );
    const { bagian, halangan } = pecahNaskahResmi(lain);
    expect(halangan).toEqual({});
    expect(bagian.pertimbangan?.startsWith("Menimbang, bahwa")).toBe(true);
  });

  it("membuang perabot halaman dan menghitungnya", () => {
    const { bagian, perabotDibuang } = pecahNaskahResmi(NASKAH);
    expect(perabotDibuang).toBe(3);
    expect(bagian.kepala).not.toContain("Halaman");
    expect(bagian.kepala).not.toContain("SALINAN");
  });

  it("membuang perabot yang berulang tiap halaman, seperti pada naskah dari PDF", () => {
    const dariPdf = NASKAH.split("\n")
      .flatMap((b, n) => (n % 8 === 0 ? [`${n} dari 13 Halaman`, "Putusan Nomor 9/Pdt.G/2026/PA.Dgl", b] : [b]))
      .join("\n");
    const { bagian, perabotDibuang } = pecahNaskahResmi(dariPdf);
    expect(perabotDibuang).toBeGreaterThan(3);
    expect(bagian.pertimbangan).not.toContain("Halaman");
    expect(bagian.pertimbangan).not.toContain("Putusan Nomor");
  });

  it("tidak menyangka kalimat panjang sebagai judul", () => {
    // Dicocokkan sama-persis, bukan dengan "memuat". Kalau tidak, kalimat
    // "Menimbang, bahwa gugatan a quo diadili secara verstek" akan memotong
    // pertimbangan di tengah-tengah.
    const jebakan = NASKAH.replace(
      "Mengingat, peraturan perundang-undangan yang berlaku;",
      "Menimbang, bahwa Majelis Hakim akan mengadili perkara ini secara verstek sebagaimana MENGADILI dimaksud;"
    );
    const { bagian } = pecahNaskahResmi(jebakan);
    expect(bagian.pertimbangan).toContain("secara verstek sebagaimana MENGADILI dimaksud");
    expect(bagian.amar?.startsWith("1. Mengabulkan")).toBe(true);
  });

  it("mengenali penetapan, bukan hanya putusan", () => {
    const penetapan = NASKAH.replace("PUTUSAN\nNomor", "PENETAPAN\nNomor")
      .replace("MENGADILI", "MENETAPKAN")
      .replace("Demikian diputuskan", "Demikian ditetapkan");
    const { bagian, halangan } = pecahNaskahResmi(penetapan);
    expect(halangan).toEqual({});
    expect(bagian.amar?.startsWith("1. Mengabulkan")).toBe(true);
  });

  it("menyatakan bagian yang jangkarnya hilang, bukan mengira-ngirakannya", () => {
    const tanpaAmar = NASKAH.replace("MENGADILI\n", "");
    const { bagian, halangan } = pecahNaskahResmi(tanpaAmar);
    expect(bagian.amar).toBeUndefined();
    expect(halangan.amar).toContain("MENGADILI");
    // Yang lain tetap terpotong - satu jangkar hilang tidak menggagalkan
    // seluruhnya.
    expect(bagian.pertimbangan?.startsWith("Menimbang, bahwa")).toBe(true);
  });

  it("menyatakan seluruhnya hilang pada naskah yang bukan putusan", () => {
    const { bagian, halangan } = pecahNaskahResmi("Sekadar catatan rapat.\nTidak ada putusan di sini.");
    expect(Object.keys(bagian)).toHaveLength(0);
    expect(halangan.kepala).toBeTruthy();
    expect(halangan.pertimbangan).toBeTruthy();
    expect(halangan.amar).toBeTruthy();
  });

  it("tidak memaksakan nama pengadilan bila barisnya bukan nama pengadilan", () => {
    const tanpaPengadilan = NASKAH.replace("PENGADILAN AGAMA DONGGALA\n", "");
    const { bagian } = pecahNaskahResmi(tanpaPengadilan);
    expect(bagian.kepala?.endsWith("DEMI KEADILAN BERDASARKAN KETUHANAN YANG MAHA ESA")).toBe(true);
    expect(bagian.identitas).toContain("Memeriksa dan mengadili");
  });
});
