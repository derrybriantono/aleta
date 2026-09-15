/**
 * Agen Penyusun Pertimbangan (Tahap 4) - draf daftar alat bukti.
 *
 * Dua hal yang dijaga di sini, dan keduanya tentang KEENGGANAN:
 *
 *   1. ia tidak pernah menyimpan sendiri
 *   2. ia tidak pernah menambal lubang dengan tanggal yang kebetulan ada
 *
 * Yang kedua yang paling mudah dilanggar tanpa disadari: tanggal terbit KTP
 * tidak ada di SIPP, dan tanggal lain berlimpah. Tanggal yang salah pada
 * daftar alat bukti lebih buruk daripada lubang yang jelas - lubang dibaca
 * dan diisi; tanggal yang salah dibaca dan dipercaya.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  type FaktaBukti,
  EKOR_BUKTI_SURAT,
  LUBANG,
  butirAktaNikah,
  butirKtp,
  keteranganDraf,
  susunDrafBukti,
  tanggalNaskah,
} from "@/lib/penyusun-pertimbangan";

/** Perkara sungguhan, dibaca dari SIPP 15 September 2026. */
function fakta(ubah: Partial<FaktaBukti> = {}): FaktaBukti {
  return {
    nomorPerkara: "544/Pdt.G/2026/PA.Dgl",
    jenisPerkara: "Cerai Gugat",
    penggugat: {
      nama: "Indriani binti Barman",
      nomorIdentitas: "7203185111960002",
      peran: "Penggugat",
    },
    nikah: {
      nomorKutipan: "103/19/VII/2021",
      tanggalKutipan: "2021-07-30",
      kuaTempatNikah: "KUA Banawa Selatan Kabupaten Donggala Provinsi Sulawesi Tengah",
    },
    ...ubah,
  };
}

// ============================================================================
describe("bentuk kalimatnya sama dengan yang sudah terbit", () => {
  it("ekor bakunya disalin apa adanya dari ABT, termasuk di-nazegelen", () => {
    // Disalin dari 2.025 pengisian sungguhnya. Menulis ulang dengan kata-kata
    // sendiri membuat putusan baru tidak seragam dengan yang sudah terbit -
    // dan keseragaman itu bukan selera, ia yang membuat salinan lama dan baru
    // dapat dibandingkan.
    expect(EKOR_BUKTI_SURAT).toContain("telah diberi meterai cukup");
    expect(EKOR_BUKTI_SURAT).toContain("di-nazegelen");
    expect(EKOR_BUKTI_SURAT).toContain("dicocokkan dengan aslinya yang ternyata sesuai");
    expect(EKOR_BUKTI_SURAT).toContain("paraf oleh Ketua Majelis");
  });

  it("tanggal ditulis sebagai naskah putusan, bukan angka", () => {
    expect(tanggalNaskah("2021-07-30")).toBe("30 Juli 2021");
    expect(tanggalNaskah("2016-06-21")).toBe("21 Juni 2016");
    expect(tanggalNaskah(null)).toBe("");
    expect(tanggalNaskah("bukan tanggal")).toBe("");
  });

  it("P.2 tersusun UTUH dari SIPP - nomor, tanggal, dan KUA-nya", () => {
    const b = butirAktaNikah(fakta())!;
    expect(b.tanda).toBe("P.2");
    expect(b.lubang).toEqual([]);
    expect(b.kalimat).toContain("Fotokopi Kutipan Akta Nikah, Nomor 103/19/VII/2021 tanggal 30 Juli 2021");
    expect(b.kalimat).toContain("KUA Banawa Selatan");
    expect(b.kalimat).toContain("diberi tanda P.2");
  });
});

// ============================================================================
describe("lubang tidak pernah ditambal dengan tanggal yang kebetulan ada", () => {
  it("tanggal terbit KTP SELALU menjadi lubang - kolomnya tidak ada di SIPP", () => {
    const b = butirKtp(fakta())!;
    expect(b.lubang).toContain("tanggal terbit KTP");
    expect(b.kalimat).toContain(`tanggal ${LUBANG}`);
    // Tidak satu pun tanggal lain menyelinap masuk menggantikannya.
    expect(b.kalimat).not.toMatch(/tanggal \d/);
  });

  it("nama dan NIK yang ADA tetap dipakai - lubangnya bukan alasan menyerah", () => {
    const b = butirKtp(fakta())!;
    expect(b.kalimat).toContain("atas nama Indriani binti Barman");
    expect(b.kalimat).toContain("NIK 7203185111960002");
  });

  it("NIK yang kosong menjadi lubang, bukan tanda kosong yang menyamar", () => {
    const b = butirKtp(fakta({ penggugat: { nama: "A", nomorIdentitas: "", peran: "Penggugat" } }))!;
    expect(b.lubang).toContain("NIK");
    expect(b.kalimat).toContain(`NIK ${LUBANG}`);
  });

  it("KUA yang kosong - 5 dari 548 perkara - menjadi lubang", () => {
    const b = butirAktaNikah(
      fakta({ nikah: { nomorKutipan: "1/2/III/2020", tanggalKutipan: "2020-03-01", kuaTempatNikah: "" } })
    )!;
    expect(b.lubang).toEqual(["KUA tempat nikah"]);
    expect(b.kalimat).toContain(`dikeluarkan oleh ${LUBANG}`);
  });

  it("perkara tanpa data nikah tidak melahirkan P.2 yang mengarang", () => {
    const draf = susunDrafBukti(fakta({ nikah: null }));
    expect(draf.butir.map((b) => b.tanda)).toEqual(["P.1"]);
  });
});

// ============================================================================
describe("draf menyebut dirinya draf, dan menyebut apa yang kurang", () => {
  it("selalu bertanda hanyaDraf", () => {
    expect(susunDrafBukti(fakta()).hanyaDraf).toBe(true);
  });

  it("tidak pernah lengkap selama tanggal KTP masih lubang", () => {
    // Inilah keadaan yang BERLAKU pada seluruh 548 perkara cerai 2026:
    // SIPP tidak punya kolomnya, jadi tidak ada satu pun perkara yang dapat
    // menghasilkan daftar bukti yang utuh tanpa tangan orang.
    const draf = susunDrafBukti(fakta());
    expect(draf.lengkap).toBe(false);
    expect(draf.lubang).toContain("tanggal terbit KTP");
  });

  it("keterangannya menyebut APA yang kurang, bukan hanya bahwa ada yang kurang", () => {
    const ket = keteranganDraf(susunDrafBukti(fakta()));
    expect(ket).toContain("tanggal terbit KTP");
    expect(ket).toContain(LUBANG);
  });

  it("perkara tanpa pihak dan tanpa data nikah menjawab apa adanya", () => {
    const draf = susunDrafBukti(fakta({ penggugat: null, nikah: null }));
    expect(draf.butir).toHaveLength(0);
    expect(keteranganDraf(draf)).toContain("Tidak ada alat bukti yang dapat disusun");
  });

  it("teksnya satu butir satu baris - siap ditempel ke variabel 1214", () => {
    const draf = susunDrafBukti(fakta());
    expect(draf.teks.split("\n")).toHaveLength(2);
    expect(draf.teks.split("\n")[0]).toContain("P.1");
    expect(draf.teks.split("\n")[1]).toContain("P.2");
  });
});

// ============================================================================
describe("TIDAK PERNAH MENYIMPAN SENDIRI - dijaga pada berkasnya", () => {
  const AKAR = path.resolve(__dirname, "../..");
  const baca = (p: string) => readFileSync(path.join(AKAR, p), "utf8");

  /**
   * Komentar dibuang lebih dahulu.
   *
   * Penjaga versi pertama gagal atas berkasnya sendiri: catatan kepala
   * berkas berbunyi "layanannya tidak punya satu pun INSERT", dan penjaganya
   * membaca kata INSERT itu sebagai pelanggaran. Yang dijaga adalah KODENYA;
   * membaca komentar sebagai kode membuat penjelasan menjadi terlarang, dan
   * berkas yang tidak boleh menjelaskan dirinya adalah berkas yang akan
   * kehilangan sebabnya.
   */
  const tanpaKomentar = (teks: string) =>
    teks.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  it("mesin penyusunnya tidak punya satu pun fungsi yang menulis", () => {
    const sumber = tanpaKomentar(baca("src/lib/penyusun-pertimbangan.ts"));
    for (const larangan of ["fetch(", "INSERT", "UPDATE ", "localStorage", "chrome.storage"]) {
      expect(sumber, larangan).not.toContain(larangan);
    }
  });

  it("layanan botnya hanya SELECT", () => {
    const sumber = readFileSync(
      path.resolve(AKAR, "..", "aleta_bot", "services", "penyusunPertimbanganService.js"),
      "utf8"
    );
    const kode = tanpaKomentar(sumber);
    for (const larangan of ["INSERT INTO", "UPDATE ", "DELETE FROM"]) {
      expect(kode, larangan).not.toContain(larangan);
    }
    // Sebabnya tetap harus tertulis - pada komentarnya, bukan pada kodenya.
    expect(sumber).toContain("HANYA MEMBACA");
  });

  it("alasannya ditulis, bukan hanya diberlakukan", () => {
    // Aturan tanpa sebab adalah aturan yang dicabut penggantinya pada
    // kesempatan pertama.
    const sumber = baca("src/lib/penyusun-pertimbangan.ts");
    expect(sumber).toContain("Mesin dapat menyusun kalimatnya");
    expect(sumber).toContain("tidak dapat menyaksikannya");
  });
});
