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

/**
 * ============================================================================
 * 25 SEPTEMBER 2026 - JUDUL BERTITIK DUA DAN PENUTUP YANG BERBUNYI LAIN
 * ============================================================================
 *
 * Diukur atas 39 e-Doc PA Donggala yang SUDAH diterima SIPP (dibandingkan
 * dengan perkara_putusan.amar_putusan dan perkara_pertimbangan_hukum):
 *
 *   amar kosong 18 dari 39   - judul "MENGADILI:" (12) dan "MENETAPKAN:" (6)
 *   amar kebablasan 5 dari 39 - penutup "Demikianlah penetapan ini dijatuhkan"
 *                               atau "Demikian dalam rapat musyawarah", jadi
 *                               amar menyeret biaya, meterai, tanda tangan
 *
 * Sesudah perbaikan: amar cocok 15 -> 36, kosong 18 -> 0; atas 158 naskah
 * ABT 2026 tidak ada satu pun keluaran yang berubah. Kalimat di bawah ini
 * direka mengikuti bentuk yang terukur; nama pihaknya karangan.
 */
describe("pecahNaskahResmi - bentuk judul dan penutup yang terukur di e-Doc satker", () => {
  it("judul amar bertitik dua tetap dikenali: MENGADILI:", () => {
    const { bagian, halangan } = pecahNaskahResmi(NASKAH.replace("MENGADILI", "MENGADILI:"));
    expect(halangan.amar).toBeUndefined();
    expect(bagian.amar?.startsWith("1. Mengabulkan")).toBe(true);
    // Judulnya sendiri tidak ikut menjadi isi amar.
    expect(bagian.amar).not.toContain("MENGADILI");
    expect(bagian.pertimbangan).not.toContain("Mengabulkan gugatan");
  });

  it("judul amar berenggang dan bertitik dua: M E N E T A P K A N :", () => {
    const penetapan = NASKAH.replace("PUTUSAN\nNomor", "PENETAPAN\nNomor").replace(
      "MENGADILI",
      "M E N E T A P K A N :"
    );
    const { bagian, halangan } = pecahNaskahResmi(penetapan);
    expect(halangan.amar).toBeUndefined();
    expect(bagian.amar?.startsWith("1. Mengabulkan")).toBe(true);
  });

  it("judul bagian lain yang bertitik dua pun dikenali", () => {
    const berTitikDua = NASKAH.replace("DUDUK PERKARA", "DUDUK PERKARA:").replace(
      "PERTIMBANGAN HUKUM",
      "PERTIMBANGAN HUKUM :"
    );
    const { bagian, halangan } = pecahNaskahResmi(berTitikDua);
    expect(halangan).toEqual({});
    expect(bagian.dudukPerkara).toContain("surat gugatannya");
    expect(bagian.pertimbangan?.startsWith("Menimbang, bahwa")).toBe(true);
  });

  it("kalimat biasa yang berakhir titik dua TETAP bukan judul", () => {
    // Hanya titik dua di UJUNG yang dibuang, dan perbandingannya tetap
    // sama-persis: kalimat panjang tidak pernah menjadi judul.
    const jebakan = NASKAH.replace(
      "Mengingat, peraturan perundang-undangan yang berlaku;",
      "Menimbang, bahwa oleh karena itu Majelis Hakim mengadili sebagai berikut:"
    );
    const { bagian } = pecahNaskahResmi(jebakan);
    expect(bagian.pertimbangan).toContain("mengadili sebagai berikut:");
    expect(bagian.amar?.startsWith("1. Mengabulkan")).toBe(true);
  });

  it("penutup 'Demikianlah penetapan ini dijatuhkan' mengakhiri amar", () => {
    const naskah = NASKAH.replace(
      "Demikian diputuskan dalam rapat musyawarah Majelis Hakim pada hari Selasa tanggal 1 September 2026;",
      "Demikianlah penetapan ini dijatuhkan pada hari Selasa tanggal 1 September 2026;\nRincian biaya:\nMeterai Rp10.000,00"
    );
    const { bagian, halangan } = pecahNaskahResmi(naskah);
    expect(halangan.penutup).toBeUndefined();
    expect(bagian.amar?.endsWith("biaya perkara sejumlah Rp199.000,00;")).toBe(true);
    expect(bagian.amar).not.toContain("Meterai");
    expect(bagian.penutup?.startsWith("Demikianlah penetapan ini dijatuhkan")).toBe(true);
  });

  it("penutup 'Demikian dalam rapat musyawarah' mengakhiri amar", () => {
    const naskah = NASKAH.replace(
      "Demikian diputuskan dalam rapat musyawarah Majelis Hakim",
      "Demikian dalam rapat musyawarah Majelis Hakim"
    );
    const { bagian } = pecahNaskahResmi(naskah);
    expect(bagian.amar).not.toContain("Ketua Majelis");
    expect(bagian.penutup?.startsWith("Demikian dalam rapat musyawarah")).toBe(true);
  });

  it("'Demikian ...' di duduk perkara TIDAK dikira penutup (dicari sesudah amar)", () => {
    // 546/Pdt.G/2024: "Demikian Duplik Tergugat..." di duduk perkara. Pola
    // yang luas hanya dicari SESUDAH jangkar amar.
    const naskah = NASKAH.replace(
      "1. Bahwa pada tanggal 15 Mei 2010 Penggugat dan Tergugat menikah;",
      "1. Bahwa pada tanggal 15 Mei 2010 Penggugat dan Tergugat menikah;\nDemikian Duplik Tergugat yang dibacakan dalam persidangan;"
    );
    const { bagian } = pecahNaskahResmi(naskah);
    expect(bagian.dudukPerkara).toContain("Demikian Duplik Tergugat");
    expect(bagian.amar?.startsWith("1. Mengabulkan")).toBe(true);
    expect(bagian.penutup?.startsWith("Demikian diputuskan")).toBe(true);
  });

  it("tanpa jangkar amar, penutup dicari dengan pola lama seperti sebelumnya", () => {
    const tanpaAmar = NASKAH.replace("MENGADILI\n", "");
    const { bagian } = pecahNaskahResmi(tanpaAmar);
    expect(bagian.amar).toBeUndefined();
    expect(bagian.penutup?.startsWith("Demikian diputuskan")).toBe(true);
    // Pertimbangan tetap berhenti di penutup, tidak menyeret tanda tangan.
    expect(bagian.pertimbangan).not.toContain("Ketua Majelis");
  });
});
