// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  dimensiKosong,
  kelengkapanDimensi,
  kunciDimensi,
  uraikanDimensi,
} from "@/lib/taksonomi-blangko";

/**
 * Taksonomi blangko - membaca dimensi keadaan dari nama berkas.
 *
 * ============================================================================
 * YANG DIJAGA DI SINI
 * ============================================================================
 *
 * Dimensi menentukan blok kalimat mana yang terpilih. Dimensi yang keliru
 * memilih kalimat yang keliru, dan kalimat itu masuk ke naskah yang
 * ditandatangani. Karena itu yang diuji paling keras bukan "berhasil
 * menguraikan", melainkan:
 *
 *   - "Tidak Hadir" tidak pernah terbaca sebagai "Hadir" - kebalikan persis
 *     dari keadaan yang sesungguhnya;
 *   - yang tidak terbaca dikembalikan KOSONG, bukan ditebak;
 *   - "PA" pada akhiran ".PA.Mj.rtf" tidak terbaca sebagai Penggugat.
 *
 * Seluruh nama berkas di bawah adalah nama SUNGGUHAN dari folder ABT
 * PA Donggala.
 */

const F = "berita_acara_sidang/1 BAS Pertama Standar/";

describe("kehadiran tidak boleh terbalik", () => {
  it("\"Tidak Hadir\" tidak terbaca sebagai \"Hadir\"", () => {
    const d = uraikanDimensi(
      F + "04-a. BAS Pertama P Hadir _ T Tidak Hadir - Tunda Panggil T.PA.Mj.rtf"
    );
    expect(d.kehadiranPihak1).toBe("hadir");
    expect(d.kehadiranPihak2).toBe("tidak-hadir");
  });

  it("kebalikannya juga terbaca benar", () => {
    const d = uraikanDimensi(
      F + "05-a. BAS Pertama P Tidak Hadir _ T Hadir - Tunda Panggi P.PAmj.rtf"
    );
    expect(d.kehadiranPihak1).toBe("tidak-hadir");
    expect(d.kehadiranPihak2).toBe("hadir");
  });

  it("keduanya tidak hadir terbaca dua-duanya", () => {
    const d = uraikanDimensi(
      F + "02-a. BAS Pertama P _ T Tidak Hadir - Tunda Panggil P dan T.PA.Mj.rtf"
    );
    expect(d.kehadiranPihak2).toBe("tidak-hadir");
  });

  it("ghoib dibedakan dari tidak hadir", () => {
    const d = uraikanDimensi(
      F + "37-d. BAS Pertama P Hadir _ T Ghoib, Pembuktian - Tunda Tambah Bukti P.rtf"
    );
    expect(d.kehadiranPihak2).toBe("ghoib");
    expect(d.peristiwa).toContain("pembuktian");
  });
});

describe("kuasa, peristiwa, akibat, susunan", () => {
  it("kuasa dibaca pada pihak yang menyebutnya", () => {
    const d = uraikanDimensi(
      F + "01-b. BAS Pertama P (Kuasa) Tidak Hadir _ T Hadir - Tunda Panggil PKuasanya .PA. Mj.rtf"
    );
    expect(d.kuasa).toBe("pihak1");
    expect(d.kehadiranPihak1).toBe("tidak-hadir");
  });

  it("kedua pihak berkuasa terbaca \"keduanya\"", () => {
    const d = uraikanDimensi(
      F + "03-a. BAS Pertama P (Kuasa) Tidak Hadir _ T (Kuasa) Hadir.PAMj.rtf"
    );
    expect(d.kuasa).toBe("keduanya");
  });

  it("mediasi dan akibat tunda tanggal terbaca", () => {
    const d = uraikanDimensi(
      F + "06-a. BAS Pertama P _ T Hadir Mediasi - Tunda Tanggal Sidang.PA.Mj.rtf"
    );
    expect(d.peristiwa).toContain("mediasi");
    expect(d.akibat).toBe("tunda-tanggal");
  });

  it("derden verzet dan voluntair terbaca", () => {
    expect(
      uraikanDimensi(F + "07-a. BAS Pertama Derden Verzet - Tunda panggil T1 _ T2.PA. Mj.rtf").peristiwa
    ).toContain("derden-verzet");
    expect(
      uraikanDimensi(F + "41-a. BAS Pertama Voluntair - Tundi Bukti PA.Mj.rtf").peristiwa
    ).toContain("voluntair");
  });

  it("izin atasan bagi PNS terbaca sebagai peristiwa", () => {
    const d = uraikanDimensi(
      F + "11-a. BAS Pertama P _ T Hadir, P PNS - Tunda S Izin.PA.Mj.rtf"
    );
    expect(d.peristiwa).toContain("izin-atasan");
  });

  it("susunan majelis terbaca dari akhiran PA.Mj", () => {
    expect(uraikanDimensi(F + "04-a. BAS Pertama P Hadir - Tunda.PA.Mj.rtf").susunan).toBe("majelis");
  });
});

describe("tahapan dan golongan dokumen", () => {
  it("tahapan pertama, lanjutan, dan putus dibedakan", () => {
    expect(uraikanDimensi(F + "04-a. BAS Pertama P Hadir - Tunda.rtf").tahapan).toBe("pertama");
    expect(
      uraikanDimensi("berita_acara_sidang/2 BAS Lanjutan Standar/01-d. BAS Lanjutan - Tunda.rtf").tahapan
    ).toBe("lanjutan");
    expect(
      uraikanDimensi("berita_acara_sidang/3 BAS Putus Standar/01. BAS Putus.rtf").tahapan
    ).toBe("putus");
  });

  it("golongan dokumen dibaca dari foldernya", () => {
    expect(uraikanDimensi(F + "04-a. BAS Pertama.rtf").jenis).toBe("bas");
    expect(uraikanDimensi("putusan_penetapan/[01] [Kabul] IN.rtf").jenis).toBe("putusan");
    expect(uraikanDimensi("RELAAS PA DONGGALA/RELASS ECOURT PENGGUGAT - PEMOHON.rtf").jenis).toBe("relaas");
    expect(uraikanDimensi("_formulir_jinayat/contoh.rtf").jenis).toBe("jinayat");
    expect(uraikanDimensi("_ikrar_talak/contoh.rtf").jenis).toBe("ikrar-talak");
  });

  it("folder pribadi tidak menyatakan golongan - namanya yang menjawab", () => {
    expect(uraikanDimensi("derry_briantono/BAS Pertama Cerai.rtf").jenis).toBe("bas");
    expect(uraikanDimensi("blangko_lainnya/Putusan Sela.rtf").jenis).toBe("putusan");
  });

  it("nomor sidang terbaca dari \"BAS 2\"", () => {
    expect(uraikanDimensi("e-court/[01b] (E-Court) BAS 2 P Hadir - Putusan.rtf").sidangKe).toBe(2);
    expect(uraikanDimensi("e-court/[01b] (E-Court) BAS 2 P Hadir - Putusan.rtf").eCourt).toBe(true);
  });
});

describe("yang tidak terbaca dibiarkan kosong", () => {
  it("nama tanpa keterangan keadaan menghasilkan dimensi kosong", () => {
    const d = uraikanDimensi("blangko_lainnya/Formulir.rtf");
    expect(d.kehadiranPihak1).toBe("");
    expect(d.kehadiranPihak2).toBe("");
    expect(d.kuasa).toBe("");
    expect(d.akibat).toBe("");
  });

  it("\"PA\" pada akhiran tidak terbaca sebagai Penggugat", () => {
    // Kalau POLA_P mencocoki "PA", setiap blangko bermajelis akan tampak
    // menyebut penggugat - dan kehadirannya akan dibaca dari potongan yang
    // sebenarnya hanya menyebut nama pengadilan.
    const d = uraikanDimensi("berita_acara_sidang/x/08-a. BAS Pertama Penolakan Hakim.PA.Mj.rtf");
    expect(d.kehadiranPihak1).toBe("");
    expect(d.kehadiranPihak2).toBe("");
  });

  it("dimensi kosong benar-benar kosong seluruhnya", () => {
    const d = dimensiKosong();
    expect(kelengkapanDimensi(d)).toBe(0);
  });
});

describe("kunci kombinasi", () => {
  it("dua blangko berdimensi sama menghasilkan kunci yang sama", () => {
    const a = uraikanDimensi(F + "04-a. BAS Pertama P Hadir _ T Tidak Hadir - Tunda Panggil T.PA.Mj.rtf");
    const b = uraikanDimensi(F + "04-a. BAS Pertama P Hadir _ T Tidak Hadir - Tunda Panggil T -  TOLIS.rtf");
    // Keduanya sel matriks yang sama; bedanya hanya susunan majelis yang
    // disebut pada yang pertama.
    expect(a.kehadiranPihak1).toBe(b.kehadiranPihak1);
    expect(a.kehadiranPihak2).toBe(b.kehadiranPihak2);
    expect(a.akibat).toBe(b.akibat);
  });

  it("dimensi berbeda menghasilkan kunci berbeda", () => {
    const a = uraikanDimensi(F + "04-a. BAS Pertama P Hadir _ T Tidak Hadir - Tunda Panggil T.PA.Mj.rtf");
    const b = uraikanDimensi(F + "05-a. BAS Pertama P Tidak Hadir _ T Hadir - Tunda Panggi P.PAmj.rtf");
    expect(kunciDimensi(a)).not.toBe(kunciDimensi(b));
  });
});
