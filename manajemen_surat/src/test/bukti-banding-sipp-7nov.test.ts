import { describe, expect, it } from "vitest";

import { bandingBaris, buktiDariAlinea, samarkanNik, sidikNik } from "@/lib/bukti-tertulis";

/**
 * Pembanding bukti dengan SIPP memberi "isian berbeda" palsu pada data nyata (7 Nov 2026):
 *  - nama pada isian #4048# berbentuk "SITI CONTOH (Penggugat)" dan SIPP menulis "... alias ... binti ...";
 *  - SIPP menyimpan nomor duplikat akta nikah sebagai "Duplikat B-100/...", sedangkan kalimat bukti menulis "Duplikat Kutipan Akta Nikah, Nomor B-100/...".
 * Yang sungguh berbeda (orang lain, nomor lain) harus tetap terbaca beda.
 */
const pihak = (nama: string, nik: string) => ({ nama, nikSamar: samarkanNik(nik), nikSidik: sidikNik(nik) });
const baris = (kalimat: string) => buktiDariAlinea([{ teks: kalimat }])[0];

const ktp = (nama: string, nik = "0000000000000001") =>
  `Fotokopi Kartu Tanda Penduduk Elektronik (KTP-el) atas nama ${nama}, NIK ${nik} tanggal 01-01-2020, yang dikeluarkan oleh Pemerintah Kabupaten Contoh, Provinsi Contoh, bukti surat tersebut telah diberi meterai cukup, di-nazegelen, serta telah dicocokkan dengan aslinya yang ternyata sesuai, lalu diberi tanda P.1 serta diberi tanggal dan paraf oleh Ketua Majelis;`;

describe("bandingBaris: nama pada KTP", () => {
  const sipp = { P: [pihak("Siti Contoh alias Sitti Contoh binti Fulan", "0000000000000001")], T: [], nikah: null };

  it("penanda peran dalam kurung dan nama sebutan tidak dianggap beda", () => {
    const h = bandingBaris(baris(ktp("SITI CONTOH (Penggugat)")).baris, "P", 0, sipp as never);
    expect(h.an?.keadaan).toBe("sama");
    expect(h.no?.keadaan).toBe("sama");
  });

  it("nama polos dan nama dengan bin/binti tetap sama", () => {
    expect(bandingBaris(baris(ktp("Siti Contoh")).baris, "P", 0, sipp as never).an?.keadaan).toBe("sama");
    expect(bandingBaris(baris(ktp("SITI CONTOH binti Fulan")).baris, "P", 0, sipp as never).an?.keadaan).toBe("sama");
  });

  it("orang lain tetap terbaca beda, juga bila berpenanda peran", () => {
    const h = bandingBaris(baris(ktp("RINA CONTOH (Penggugat)", "0000000000000002")).baris, "P", 0, sipp as never);
    expect(h.an?.keadaan).toBe("beda");
    expect(h.no?.keadaan).toBe("beda");
  });
});

describe("bandingBaris: nomor duplikat akta nikah", () => {
  const nikah = { nomor: "Duplikat B-100/Kua.00.00.00/PW.01/03/2021", tglKutipan: "2021-03-04", kua: "KUA Kecamatan Contoh Kabupaten Contoh", tglNikah: "2020-02-03" };
  const sipp = { P: [], T: [], nikah };
  const akta = (nomor: string) =>
    `Duplikat Kutipan Akta Nikah, Nomor ${nomor} tanggal 4 Maret 2021, yang dikeluarkan oleh KUA Kecamatan Contoh Kabupaten Contoh, bukti surat tersebut telah diberi meterai cukup, di-nazegelen, serta telah dicocokkan dengan aslinya yang ternyata sesuai, lalu diberi tanda P.2 serta diberi tanggal dan paraf oleh Ketua Majelis;`;

  it("nomor yang sama tanpa awalan Duplikat terbaca sama", () => {
    expect(bandingBaris(baris(akta("B-100/Kua.00.00.00/PW.01/03/2021")).baris, "P", 0, sipp as never).no?.keadaan).toBe("sama");
  });

  it("nomor yang ditulis dengan awalan seperti di SIPP tetap sama", () => {
    expect(bandingBaris(baris(akta("Duplikat B-100/Kua.00.00.00/PW.01/03/2021")).baris, "P", 0, sipp as never).no?.keadaan).toBe("sama");
  });

  it("nomor lain tetap beda dan 'pakai' mengambil nilai SIPP apa adanya", () => {
    const h = bandingBaris(baris(akta("B-999/Kua.00.00.00/PW.01/03/2021")).baris, "P", 0, sipp as never);
    expect(h.no?.keadaan).toBe("beda");
    expect(h.no?.pakai).toBe(nikah.nomor);
  });
});
