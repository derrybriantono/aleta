// @vitest-environment node

import { describe, expect, it } from "vitest";

import { usulkanAlasanPerkara } from "@/lib/alasan-perkara-sipp";
import { type MedanPilihan } from "@/lib/usulan-medan-putusan";

/**
 * ============================================================================
 * ALASAN ISBAT NIKAH PADA DATA UMUM - BAWAANNYA "NIKAH DIBAWAH TANGAN"
 * ============================================================================
 *
 * Diukur atas 403 permohonan isbat 2025-2026 PA Donggala yang alasannya sudah
 * dipilih petugas (sipp_donggala, hanya SELECT): 396 "Nikah dibawah tangan",
 * 7 "Kelengkapan administrasi". Kode lama menjawab benar 2 dari 403 - kata
 * "akta" pada "tidak mempunyai kutipan akta nikah" memenangkan "Akta nikah
 * hilang". Aturan baru 396 dari 403.
 *
 * Fixture di bawah dipetik dari posita/petitum sungguhan dan DISAMARKAN (nama
 * "xxx", tanggal "xx xxxx", tanpa NIK dan alamat). Yang ditandai "buatan"
 * disusun tangan: data satker tidak memuat satu pun isbat berlasan akta hilang
 * atau kumulasi cerai, tetapi aturannya tetap harus menangkap keduanya.
 *
 * Penjaga ini MENJALANKAN usulkanAlasanPerkara - bukan memeriksa teks sumber.
 */

const ISBAT: MedanPilihan = {
  kunci: 'select[name="alasan_isbat"]',
  label: "Alasan Pengajuan Isbat Nikah",
  pilihan: [
    { nilai: "0", label: "- Pilih -" },
    { nilai: "1", label: "Perceraian" },
    { nilai: "2", label: "Nikah dibawah tangan" },
    { nilai: "3", label: "Akta nikah hilang" },
    { nilai: "4", label: "Kelengkapan administrasi" },
  ],
};

const ASAL_USUL: MedanPilihan = {
  kunci: 'select[name="alasan_asalusul"]',
  label: "Alasan Pengajuan Asal Usul Anak",
  pilihan: [
    { nilai: "0", label: "- Pilih -" },
    { nilai: "1", label: "Kepastian hukum / kelengkapan administrasi" },
    { nilai: "2", label: "Pengingkaran anak" },
  ],
};

/** Posita/petitum isbat sungguhan (disamarkan); kode lama menjawab "Akta nikah hilang" pada semuanya. */
const ISBAT_DIBAWAH_TANGAN: Array<{ benar: string; posita: string[]; petitum: string[] }> = [
  {
    benar: "Nikah dibawah tangan",
    posita: [
      "Bahwa sampai sekarang xxx dan Pemohon tidak mempunyai kutipan akta nikah, karena pernikahan tersebut tidak terdaftar di Kantor Urusan Agama Kecamatan xxx, Kabupaten Donggala sehingga pernikahan tersebut tidak dicatatkan di KUA yang berwenang;",
      "Bahwa xxx telah meninggal lebih dulu pada tanggal xx xxxx sesuai dengan Kutipan Akta xxx Nomor :",
    ],
    petitum: [
      "Menetapkan sah pernikahan xxx Pemohon ( xxx ) dengan Pemohon ( xxx ) yang dilangsungkan pada hari sabtu xx xxxx di Desa xxx wilayah hukum Kantor Urusan Agama Kecamatan xxx, Kabupaten Donggala, Provinsi Sulawesi Tengah dan untuk pengurusan xxx atas nama xxx ;",
      "Majelis Hakim berpendapat lain mohon putusan yang seadil-adilnya;",
    ],
  },
  {
    benar: "Nikah dibawah tangan",
    posita: [
      "Bahwa sampai sekarang Pemohon I dan Pemohon II tidak mempunyai Kutipan Akta Nikah, karena pernikahan tersebut tidak terdaftar di Kantor Urusan Agama Kecamatan xxx, Kabupaten xxx, Provinsi Sulawesi Tengah, sehingga pernikahan tersebut tidak dicatatkan di KUA yang berwenang, sementara saat ini para Pemohon I dan Pemohon II membutuhkan Akta Nikah tersebut untuk mengurus Buku Nikah dan untuk kepenting",
    ],
    petitum: [
      "Menetapkan sah pernikahan Pemohon I dengan Pemohon II yang dilangsungkan pada hari Rabu, xxx xx xxxx di Desa xxx wilayah Kantor Urusan Agama Kecamatan xxx, Kabupaten xxx, Provinsi Sulawesi Tengah;",
    ],
  },
  {
    benar: "Nikah dibawah tangan",
    posita: [
      "Bahwa sampai sekarang Pemohon I dan Pemohon II tidak mempunyai Kutipan Akta Nikah, karena pernikahan tersebut tidak terdaftar di Kantor Urusan Agama Desa xxx, Kecamatan xxx, Kabupaten Donggala, Provinsi Sulawesi Tengah, sehingga pernikahan tersebut tidak dicatatkan di KUA yang berwenang, sementara saat ini para Pemohon I dan Pemohon II membutuhkan Akta Nikah tersebut untuk mengurus Buku Nikah dan",
    ],
    petitum: [
      "Menetapkan sah pernikahan Pemohon I dengan Pemohon II yang dilangsungkan di Desa xxx pada xxx Minggu tanggal xx xxxx di wilayah Kantor Urusan Agama Kecamatan xxx, Kabupaten Donggala, Provinsi Sulawesi Tengah;",
    ],
  },
  {
    benar: "Nikah dibawah tangan",
    posita: [
      "Bahwa sampai sekarang Pemohon dan xxx tidak mempunyai kutipan akta nikah, karena pernikahan tersebut tidak terdaftar di Kantor Urusan Agama Kecamatan xxx, Kabupaten Donggala sehingga pernikahan tersebut tidak dicatatkan di KUA yang berwenang;",
      "Bahwa xxx telah meninggal dunia pada tanggal xx xxxx sesuai dengan Kutipan Akta xxx Nomor :",
    ],
    petitum: [
      "Menetapkan sah pernikahan Pemohon ( xxx ) dengan perempuan bernama ( xxx ) yang dilangsungkan di Desa xxx pada hari Minggu tanggal xx xxxx di Desa xxx wilayah hukum Kantor Urusan Agama Kecamatan xxx, Kabupaten Donggala, Provinsi Sulawesi Tengah;",
    ],
  },
  {
    benar: "Nikah dibawah tangan",
    posita: [
      "Bahwa sampai sekarang Pemohon I dan Pemohon II tidak mempunyai Kutipan Akta Nikah, karena pernikahan tersebut tidak terdaftar di Kantor Urusan Agama Kecamatan xxx, Kabupaten Donggala, Provinsi Sulawesi Tengah, sehingga pernikahan tersebut tidak dicatatkan di KUA yang berwenang, sementara saat ini para Pemohon I dan Pemohon II membutuhkan Akta Nikah tersebut untuk mengurus Buku Nikah dan untuk kepe",
    ],
    petitum: [
      "Menetapkan sah pernikahan Pemohon I dengan Pemohon II yang dilangsungkan pada xxx Minggu, tanggal xx xxxx di Kelurahan xxx di wilayah hukum Kantor Urusan Agama Kecamatan xxx, Kabupaten Donggala, Provinsi Sulawesi Tengah;",
    ],
  },
  // Dua dari tujuh "Kelengkapan administrasi": positanya sama bunyinya dengan dibawah tangan,
  // jadi usulannya "Nikah dibawah tangan" - DIBIARKAN salah dan diukur (7/403), bukan ditebak.
  {
    benar: "Kelengkapan administrasi",
    posita: [
      "Bahwa sampai sekarang Pemohon I dan Pemohon II tidak mempunyai Kutipan Akta Nikah, karena pernikahan tersebut tidak terdaftar di Kantor Urusan Agama Kecamatan xxx, Kabupaten Donggala, Provinsi Sulawesi Tengah, sehingga pernikahan",
    ],
    petitum: [
      "Menetapkan sah pernikahan Pemohon I dengan Pemohon II yang dilangsungkan pada xxx Minggu, xx xxxx di Kelurahan xxx di wilayah hukum Kantor Urusan Agama",
    ],
  },
  {
    benar: "Kelengkapan administrasi",
    posita: [
      "xxx dan Pemohon tidak mempunyai kutipan akta nikah, karena pernikahan tersebut tidak terdaftar di Kantor Urusan Agama Kecamatan xxx, Kabupaten xxx sehingga pernikahan tersebut tidak dicatatkan di KUA yang berwenang;",
    ],
    petitum: ["Menetapkan sah pernikahan xxx Pemohon ( xxx.", "Majelis Hakim berpendapat lain mohon putusan yang seadil-adilnya;"],
  },
];

const usul = (posita: string[], petitum: string[], medan: MedanPilihan = ISBAT) =>
  usulkanAlasanPerkara({ posita: posita.join("\n"), petitum: petitum.join("\n") }, [medan])[0];

describe("alasan isbat: bawaan Nikah dibawah tangan", () => {
  it.each(ISBAT_DIBAWAH_TANGAN)("posita tanpa akta hilang -> Nikah dibawah tangan (petugas: $benar)", ({ posita, petitum }) => {
    const u = usul(posita, petitum);
    expect(u.nilaiLabel).toBe("Nikah dibawah tangan");
    expect(u.keyakinan).toBe("cukup");
    // Kata "akta" saja tidak pernah lagi menjadi "Akta nikah hilang".
    expect(u.nilaiLabel).not.toBe("Akta nikah hilang");
  });

  it("isbat sungguhan: buku nikah HILANG karena banjir -> Akta nikah hilang", () => {
    const u = usul(
      [
        "Bahwa, pernikahan Pemohon dan xxx sudah pernah terdaftar di Kantor Urusan Agama Kecamatan xxx, Kabupaten Donggala dan telah memiliki buku nikah namun buku nikah tersebut hilang karena musibah banjir bandang;",
      ],
      ["Menetapkan sah pernikahan xxx Pemohon ( xxx ) dengan Pemohon ( xxx );"]
    );
    expect(u.nilaiLabel).toBe("Akta nikah hilang");
    expect(u.keyakinan).toBe("cukup");
    expect(u.saingan.map((x) => x.label)).toContain("Nikah dibawah tangan");
  });

  it("(buatan) kutipan akta nikah TERBAKAR -> Akta nikah hilang", () => {
    const u = usul(["Bahwa Kutipan Akta Nikah para Pemohon terbakar bersama rumah para Pemohon;"], ["Menetapkan sah pernikahan Pemohon I dengan Pemohon II;"]);
    expect(u.nilaiLabel).toBe("Akta nikah hilang");
  });

  it("(buatan) hilang dan dibawah tangan sama-sama tegas -> bentrok, petugas yang menentukan", () => {
    const u = usul(
      ["Bahwa pernikahan para Pemohon dilakukan di bawah tangan;", "Bahwa buku nikah yang pernah diterbitkan telah hilang;"],
      ["Menetapkan sah pernikahan Pemohon I dengan Pemohon II;"]
    );
    expect(u.keyakinan).toBe("bentrok");
  });

  it("(buatan) kumulasi cerai: petitum meminta talak dijatuhkan -> Perceraian", () => {
    const u = usul(
      ["Bahwa Penggugat dan Tergugat menikah secara agama dan tidak mempunyai kutipan akta nikah;"],
      ["Menyatakan sah perkawinan Penggugat dengan Tergugat;", "Menjatuhkan talak satu ba'in sughra Tergugat terhadap Penggugat;"]
    );
    expect(u.nilaiLabel).toBe("Perceraian");
  });

  it("kata 'cerai' pada POSITA (status janda) bukan kumulasi cerai", () => {
    const u = usul(
      ["Bahwa saat menikah Pemohon II berstatus janda cerai sesuai Akta Cerai Nomor xxx;", "Bahwa para Pemohon tidak mempunyai kutipan akta nikah;"],
      ["Menetapkan sah pernikahan Pemohon I dengan Pemohon II;"]
    );
    expect(u.nilaiLabel).toBe("Nikah dibawah tangan");
  });

  it("nilai yang sudah terpilih di layar didahulukan (kontrak K9)", () => {
    const u = usulkanAlasanPerkara(
      { posita: ISBAT_DIBAWAH_TANGAN[0].posita.join("\n"), petitum: ISBAT_DIBAWAH_TANGAN[0].petitum.join("\n") },
      [{ ...ISBAT, terpilih: "4" }]
    )[0];
    expect(u.nilaiLabel).toBe("Kelengkapan administrasi");
    expect(u.sumberUsulan).toBe("halaman");
  });

  it("medan isbat tanpa pilihan 'dibawah tangan' jatuh ke mesin umum, tidak mengarang", () => {
    const tanpa: MedanPilihan = { ...ISBAT, pilihan: ISBAT.pilihan.filter((x) => !/bawah/.test(x.label)) };
    const u = usul(ISBAT_DIBAWAH_TANGAN[1].posita, ISBAT_DIBAWAH_TANGAN[1].petitum, tanpa);
    expect(u.nilaiLabel).not.toBe("Nikah dibawah tangan");
  });
});

describe("asal usul anak: tidak ada pola, usulan tetap KOSONG", () => {
  // 7 perkara 2025-2026, ketujuhnya "Kepastian hukum / kelengkapan administrasi"; positanya tidak
  // memuat kata yang membedakannya dari "Pengingkaran anak" (diukur: 0/7 sebelum dan sesudah).
  const POSITA_ASAL_USUL = [
    "Bahwa pada tanggal xx xxxx Pemohon I dan Pemohon II melangsungkan pernikahan menurut agama Islam di wilayah hukum Kantor Urusan Agama Kecamatan xxx Kabupaten xxx Provinsi Sulawesi Tengah;",
    "Bahwa pada tanggal xx xxxx Pemohon I dan Pemohon II melangsungkan pernikahan menurut agama Islam di wilayah hukum Kantor Urusan Agama Kecamatan xxx Kota xxx Provinsi Sulawesi Tengah;",
  ];
  it.each(POSITA_ASAL_USUL)("tanpa usulan - %s", (posita) => {
    const u = usul([posita], [], ASAL_USUL);
    expect(u.nilai).toBe("");
    expect(u.keyakinan).toBe("kosong");
  });
});
