// @vitest-environment node

import { describe, expect, it } from "vitest";

import { paragrafButir } from "@/lib/isian-putusan-sipp";
import { usulkanMedanPutusan, type MedanPilihan } from "@/lib/usulan-medan-putusan";

/**
 * Medan borang Putusan Akhir yang dulu tidak pernah diusulkan sama sekali:
 * Status Putusan, Putusan Verstek, dan Sumber Hukum.
 *
 * Ketiganya punya bentuk masalah yang berbeda, dan ketiganya diuji di sini:
 *
 *   Status Putusan  labelnya tertulis di naskah, tetapi berbeda bentuk kata
 *                   ("Dikabulkan" pada borang, "dikabulkan" pada pertimbangan).
 *   Putusan Verstek pilihannya Ya/Tidak - tidak satu pun kata itu menjadi
 *                   bukti apa pun, dan yang menjadi bukti kata "verstek".
 *   Sumber Hukum    kotak centang, hampir selalu lebih dari satu, dan
 *                   pilihannya tidak pernah ditulis persis begitu di putusan.
 */

/** Pilihan sebagaimana benar-benar ditawarkan borang SIPP PA Donggala. */
const SUMBER_HUKUM: MedanPilihan = {
  kunci: 'input[name="sumber_hukum[]"]',
  label: "Sumber Hukum",
  banyak: true,
  pilihan: [
    { nilai: "10", label: "Fiqh Islam" },
    { nilai: "9", label: "Kompilasi Hukum Ekonomi Syariah" },
    { nilai: "8", label: "Kompilasi Hukum Islam" },
    { nilai: "13", label: "Qanun Aceh" },
    { nilai: "11", label: "UU/PP" },
    { nilai: "14", label: "Yurisprudensi" },
  ],
};

const VERSTEK: MedanPilihan = {
  kunci: 'select[name="verstek"]',
  label: "Putusan Verstek",
  pilihan: [
    { nilai: "", label: "Pilih" },
    { nilai: "1", label: "Ya" },
    { nilai: "0", label: "Tidak" },
  ],
};

const STATUS_PUTUSAN: MedanPilihan = {
  kunci: 'select[name="status_putusan"]',
  label: "Status Putusan",
  pilihan: [
    { nilai: "", label: "Pilih Status Putusan" },
    { nilai: "62", label: "Dikabulkan" },
    { nilai: "63", label: "Ditolak" },
    { nilai: "64", label: "Tidak Diterima" },
    { nilai: "65", label: "Dicoret Dari Register" },
    { nilai: "66", label: "Digugurkan" },
  ],
};

/**
 * Petikan pertimbangan dan amar putusan cerai gugat verstek - susunan yang
 * sama dengan naskah sungguhan, nama direka.
 */
const NASKAH_VERSTEK = [
  "Menimbang, bahwa pada hari sidang yang telah ditetapkan Penggugat telah hadir di muka sidang, sedangkan Tergugat tidak pernah hadir;",
  "Menimbang, bahwa berdasarkan ketentuan Pasal 149 RBg, putusan yang dijatuhkan tanpa hadirnya Tergugat (Verstek) dapat dijatuhkan;",
  "Menimbang, bahwa Majelis Hakim telah berusaha memberi nasihat kepada Penggugat agar tidak bercerai, sebagaimana maksud Pasal 39 ayat (1) Undang-Undang Nomor 1 tahun 1974 jo. Pasal 65 Undang-Undang Nomor 7 tahun 1989 jo. Pasal 31 ayat (2) Peraturan Pemerintah Nomor 9 tahun 1975, akan tetapi tidak berhasil;",
  "Menimbang, bahwa sesuai Pasal 116 huruf (f) Kompilasi Hukum Islam, perselisihan dan pertengkaran terus menerus antara suami isteri merupakan alasan perceraian;",
  "Menimbang, bahwa berdasarkan pertimbangan-pertimbangan tersebut di atas maka gugatan Penggugat dapat dikabulkan;",
  "Mengingat, peraturan perundang-undangan yang berlaku dan hukum syar'i yang berkaitan dengan perkara ini;",
  "1. Menyatakan Tergugat yang telah dipanggil secara resmi dan patut untuk menghadap ke persidangan, tidak hadir;",
  "2. Mengabulkan gugatan Penggugat secara verstek;",
].join("\n");

const satu = (naskah: string, medan: MedanPilihan) => usulkanMedanPutusan(naskah, [medan])[0];

describe("Status Putusan", () => {
  it("mengenali Dikabulkan dari pertimbangannya", () => {
    const usul = satu(NASKAH_VERSTEK, STATUS_PUTUSAN);
    expect(usul.nilai).toBe("62");
    expect(usul.nilaiLabel).toBe("Dikabulkan");
    expect(usul.kutipan).toContain("dapat dikabulkan");
  });

  it("tidak mengarang ketika naskahnya tidak menyebut satu pun", () => {
    const usul = satu("Menimbang, bahwa perkara ini diperiksa secara elektronik;", STATUS_PUTUSAN);
    expect(usul.nilai).toBe("");
    expect(usul.alasan).toContain("ALETA tidak menebak");
  });

  it('tidak pernah mengusulkan baris "Pilih Status Putusan"', () => {
    // Baris itu bukan pilihan melainkan ajakan memilih. Mengisikannya
    // meninggalkan borang yang tampak terisi padahal kosong.
    const usul = satu("Pilih status putusan yang sesuai.", STATUS_PUTUSAN);
    expect(usul.nilaiLabel).not.toContain("Pilih Status Putusan");
  });
});

describe("Putusan Verstek", () => {
  it('menjawab Ya ketika naskahnya menyebut "verstek"', () => {
    const usul = satu(NASKAH_VERSTEK, VERSTEK);
    expect(usul.nilai).toBe("1");
    expect(usul.nilaiLabel).toBe("Ya");
    expect(usul.keyakinan).toBe("pasti");
    // Naskah menulisnya "(Verstek)" dengan huruf besar di satu tempat dan
    // "verstek" di tempat lain - yang dijaga di sini kalimat asalnya ikut,
    // bukan ejaannya.
    expect(usul.kutipan.toLowerCase()).toContain("verstek");
  });

  it("menjawab Tidak ketika tidak disebut - dan mengatakan itu kesimpulan", () => {
    // Ketiadaan frasa memang berarti Tidak, tetapi ia kesimpulan dari yang
    // TIDAK tertulis, dan itu tidak pernah sekuat yang tertulis.
    const hadir = [
      "Menimbang, bahwa Tergugat hadir di persidangan dan menyampaikan jawabannya;",
      "1. Mengabulkan gugatan Penggugat sebagian;",
    ].join("\n");
    const usul = satu(hadir, VERSTEK);
    expect(usul.nilai).toBe("0");
    expect(usul.nilaiLabel).toBe("Tidak");
    expect(usul.keyakinan).toBe("cukup");
    expect(usul.alasan).toContain("Periksa sendiri");
  });
});

describe("Sumber Hukum", () => {
  it("mencentang seluruh yang disebut, bukan satu yang menang", () => {
    const usul = satu(NASKAH_VERSTEK, SUMBER_HUKUM);
    const label = (usul.nilaiBanyak ?? []).map((x) => x.label).sort();
    expect(label).toEqual(["Fiqh Islam", "Kompilasi Hukum Islam", "UU/PP"]);
  });

  it("tidak mencentang yang tidak disebut sama sekali", () => {
    const usul = satu(NASKAH_VERSTEK, SUMBER_HUKUM);
    const label = (usul.nilaiBanyak ?? []).map((x) => x.label);
    expect(label).not.toContain("Qanun Aceh");
    expect(label).not.toContain("Yurisprudensi");
    expect(label).not.toContain("Kompilasi Hukum Ekonomi Syariah");
  });

  it("tiap centangnya membawa kalimat asalnya", () => {
    // Sumber hukum yang dicentang tanpa dasar yang dapat dibaca sama saja
    // dengan menebak - dan yang menebak di sini bukan petugasnya.
    const usul = satu(NASKAH_VERSTEK, SUMBER_HUKUM);
    for (const satuNilai of usul.nilaiBanyak ?? []) {
      expect(satuNilai.kutipan.length).toBeGreaterThan(10);
    }
    // Kalimat dipecah pada titik koma juga, sehingga satu Menimbang yang
    // panjang menghasilkan beberapa potongan. Yang dijaga: kutipannya
    // benar-benar memuat rujukan undang-undang atau peraturan pemerintah -
    // bukan potongan mana yang kebetulan menang.
    const uu = (usul.nilaiBanyak ?? []).find((x) => x.label === "UU/PP");
    expect(uu?.kutipan).toMatch(/Undang-Undang Nomor|Peraturan Pemerintah Nomor/);
    const fiqh = (usul.nilaiBanyak ?? []).find((x) => x.label === "Fiqh Islam");
    expect(fiqh?.kutipan).toContain("hukum syar");
  });

  it("mengatakan berapa yang disebut, dan bahwa sisanya sengaja dibiarkan", () => {
    const usul = satu(NASKAH_VERSTEK, SUMBER_HUKUM);
    expect(usul.alasan).toContain("3 pilihan disebut naskah");
    expect(usul.alasan).toContain("Yang tidak disebut tidak dicentang");
  });

  it("tidak mencentang apa pun pada naskah yang tidak menyebut sumber hukum", () => {
    const usul = satu("Menimbang, bahwa Penggugat hadir sendiri di persidangan;", SUMBER_HUKUM);
    expect(usul.nilaiBanyak).toBeUndefined();
    expect(usul.nilai).toBe("");
  });
});

describe("medan biasa tidak berubah perilakunya", () => {
  it("tetap memilih satu, dan tetap menandai yang berselisih", () => {
    // Sebutan lain dan mode banyak hanya berlaku pada medan yang memintanya.
    // Faktor perceraian tetap dinilai persis seperti sebelumnya.
    const faktor: MedanPilihan = {
      kunci: 'select[name="faktor_cerai"]',
      label: "Faktor Penyebab Perceraian",
      pilihan: [
        { nilai: "", label: "Pilih Faktor" },
        { nilai: "12", label: "Perselisihan Dan Pertengkaran Terus Menerus" },
        { nilai: "9", label: "Meninggalkan Salah Satu Pihak" },
      ],
    };
    const usul = satu(NASKAH_VERSTEK, faktor);
    expect(usul.nilai).toBe("12");
    expect(usul.nilaiBanyak).toBeUndefined();
  });
});

describe("amar dikeluarkan sebagai paragraf per butir", () => {
  it("tiap butir berdiri sendiri", () => {
    // Amar dibaca sebagai daftar, bukan sebagai alinea. Empat butir yang
    // mengalir menjadi satu blok memaksa pembacanya mencari nomornya di
    // tengah kalimat - dan itulah bentuk yang tampil di CKEditor selama ini.
    const hasil = paragrafButir(
      [
        "1. Menyatakan Tergugat tidak hadir;",
        "2. Mengabulkan gugatan Penggugat secara verstek;",
        "3. Membebankan biaya perkara kepada Penggugat;",
      ].join("\n")
    );
    expect(hasil.split("<p>").length - 1).toBe(3);
    expect(hasil).toContain("<p>2. Mengabulkan gugatan Penggugat secara verstek;</p>");
  });

  it("butir yang terlanjur mengalir dalam satu baris ikut dipecah", () => {
    const hasil = paragrafButir(
      "1. Menyatakan Tergugat tidak hadir; 2. Mengabulkan gugatan Penggugat; 3. Membebankan biaya perkara;"
    );
    expect(hasil.split("<p>").length - 1).toBe(3);
  });

  it("penomoran di TENGAH kalimat tidak dikira mengawali butir", () => {
    // "Pasal 19 huruf (b) dan (f)" berdiri di tengah kalimat pertimbangan.
    // Memecahnya di situ membelah satu butir menjadi dua.
    const hasil = paragrafButir(
      "1. Mengabulkan gugatan Penggugat sesuai Pasal 19 huruf (b) dan (f) Peraturan Pemerintah Nomor 9 Tahun 1975;"
    );
    expect(hasil.split("<p>").length - 1).toBe(1);
  });

  it("tanda kurung sudut dilarikan, sehingga tidak pernah menjadi tanda HTML", () => {
    const hasil = paragrafButir("1. Menyatakan <Tergugat> tidak hadir;");
    expect(hasil).toContain("&lt;Tergugat&gt;");
    expect(hasil).not.toContain("<Tergugat>");
  });

  it("naskah kosong tetap kosong, bukan menjadi paragraf kosong", () => {
    expect(paragrafButir("")).toBe("");
    expect(paragrafButir("   ")).toBe("");
  });
});
