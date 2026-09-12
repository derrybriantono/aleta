// @vitest-environment node

import { describe, expect, it } from "vitest";

import { petikDataNikah, tanggalKeBorang } from "@/lib/data-nikah-sipp";

/**
 * ============================================================================
 * DATA PERNIKAHAN DIPETIK DARI POSITA
 * ============================================================================
 *
 * Seluruh posita di bawah ini disalin dari berkas sungguhan PA Donggala -
 * hanya nama orangnya yang diganti. Yang diuji bukan "apakah polanya cocok"
 * melainkan apakah yang terpetik sama dengan yang benar-benar disimpan
 * petugas pada perkara itu.
 *
 * Hasil ukur menyeluruh, atas 1.200 gugatan cerai dan 115 permohonan itsbat
 * yang data nikahnya sudah tersimpan:
 *
 *   Tanggal menikah (cerai)   1.139 sama, 13 berbeda, 48 tidak terpetik
 *   Tgl kutipan akta          1.088 sama, 16 berbeda, 96 tidak terpetik
 *   No kutipan akta           1.025 sama persis, 54 berbeda hanya pada kata
 *                             "Duplikat", 46 nomornya memang lain, 75 tidak
 *                             terpetik
 *   Tanggal menikah (itsbat)    108 sama, 0 berbeda, 7 tidak terpetik
 *   Tempat menikah (itsbat)     105 sama, 4 berbeda, 6 tidak terpetik
 *
 * Yang 46 itu bukan salah baca: petugas memakai nomor kutipan PENGGANTI yang
 * baru diterbitkan KUA, sedangkan positanya menyebut nomor yang asli. Berkas
 * fisiknya ada di mejanya, positanya tidak tahu apa-apa tentang itu - dan
 * karena itulah tiap petikan dapat disunting sebelum diisikan.
 */

/** Alinea pertama gugatan cerai PA Donggala - bentuk yang paling lazim. */
const POSITA_CERAI =
  "<ol><li>Bahwa pada tanggal 18 Juni 2020, Penggugat dan Tergugat telah melangsungkan " +
  "pernikahan yang dicatat oleh Pegawai Pencatat Nikah pada Kantor Urusan Agama (KUA) " +
  "Kecamatan Sindue Tobata, Kabupaten Donggala, Provinsi Sulawesi Tengah, sebagaimana " +
  "sesuai dengan Kutipan Akta Nikah Nomor : 119/009/XI/2020, tertanggal 30 November 2020;</li>" +
  "<li>Bahwa setelah menikah, Penggugat dan Tergugat tinggal bersama di rumah orang tua " +
  "Penggugat selama kurang lebih 2 bulan;</li>" +
  "<li>Bahwa sejak bulan Mei 2023 rumah tangga mulai tidak harmonis;</li></ol>";

/** Alinea pertama permohonan itsbat nikah - harinya disebut, kata "tanggal" tidak ada. */
const POSITA_ITSBAT =
  "<p>1. Bahwa pada hari Jumat, 14 Agustus 2020 Pemohon I dan Pemohon II melangsungkan " +
  "pernikahan menurut agama Islam, bertempat di Desa Kotarindau, di wilayah hukum Kantor " +
  "Urusan Agama Kecamatan Dolo Tengah, Kabupaten Sigi, Provinsi Sulawesi Tengah;</p>" +
  "<p>2. Bahwa pada saat pernikahan tersebut Pemohon I berstatus Perjaka dalam usia 16 tahun;</p>";

describe("tanggal Indonesia menjadi bentuk yang diminta borang", () => {
  it("nama bulan diterjemahkan", () => {
    expect(tanggalKeBorang("18 Juni 2020")).toBe("18/06/2020");
    expect(tanggalKeBorang("08 Februari 2017")).toBe("08/02/2017");
  });

  it("ejaan lama Nopember dan Pebruari ikut diterima", () => {
    // Keduanya masih dipakai pada akta yang terbit sebelum 2000, dan positanya
    // menyalin apa yang tertulis di akta.
    expect(tanggalKeBorang("21 Nopember 1996")).toBe("21/11/1996");
    expect(tanggalKeBorang("3 Pebruari 1984")).toBe("03/02/1984");
  });

  it("bentuk berangka juga diterima", () => {
    expect(tanggalKeBorang("18/06/2020")).toBe("18/06/2020");
    expect(tanggalKeBorang("18-06-2020")).toBe("18/06/2020");
  });

  it("tanggal yang tidak ada di kalender DITOLAK, bukan digeser", () => {
    // "31 April" lolos pemeriksaan bentuk tetapi bukan tanggal. Dibiarkan
    // lewat, yang tersimpan menjadi 1 Mei - satu hari yang tidak pernah
    // tertulis di akta mana pun, dan tidak seorang pun akan melihatnya.
    expect(tanggalKeBorang("31 April 2020")).toBe("");
    expect(tanggalKeBorang("30 Februari 2021")).toBe("");
    expect(tanggalKeBorang("29 Februari 2021")).toBe("");
  });

  it("29 Februari pada tahun kabisat tetap sah", () => {
    expect(tanggalKeBorang("29 Februari 2020")).toBe("29/02/2020");
  });

  it("yang bukan tanggal memulangkan kosong", () => {
    expect(tanggalKeBorang("")).toBe("");
    expect(tanggalKeBorang("Penggugat dan Tergugat")).toBe("");
  });
});

describe("memetik data pernikahan dari gugatan cerai", () => {
  const hasil = petikDataNikah(POSITA_CERAI);

  it("tanggal menikah, bukan tanggal akta yang ada di kalimat yang sama", () => {
    expect(hasil.tglNikah?.nilai).toBe("18/06/2020");
  });

  it("nomor kutipan akta apa adanya", () => {
    expect(hasil.noKutipanAktaNikah?.nilai).toBe("119/009/XI/2020");
  });

  it("tanggal kutipan akta - yang MENGIKUTI nomornya, bukan tanggal pertama pada kalimat", () => {
    // Kalimat yang sama memuat tanggal pernikahan di awalnya, dan keduanya
    // kerap berbeda beberapa bulan. Mengambil "tanggal" yang pertama
    // memulangkan tanggal nikah untuk kedua medan sekaligus.
    expect(hasil.tglKutipanAktaNikah?.nilai).toBe("30/11/2020");
  });

  it("nama KUA dipetik untuk diperlihatkan", () => {
    expect(hasil.kua?.nilai).toBe("Sindue Tobata");
  });

  it("tiap petikan membawa kalimat asalnya", () => {
    expect(hasil.tglNikah?.kutipan).toContain("18 Juni 2020");
    expect(hasil.noKutipanAktaNikah?.kutipan).toContain("119/009/XI/2020");
  });
});

describe("memetik data pernikahan dari permohonan itsbat", () => {
  const hasil = petikDataNikah(POSITA_ITSBAT);

  it("tanggal terbaca walau kata \"tanggal\" tidak ada dan harinya disebut lebih dulu", () => {
    expect(hasil.tglNikah?.nilai).toBe("14/08/2020");
  });

  it("tempat menikah dipetik dari \"bertempat di\"", () => {
    expect(hasil.tempatNikah?.nilai).toBe("Desa Kotarindau");
  });

  it("tidak ada akta yang dikarang untuk perkara yang memang belum punya akta", () => {
    // Itsbat diajukan justru KARENA pernikahannya belum tercatat. Memulangkan
    // nomor akta di sini berarti mengarang benda yang keberadaannya sedang
    // dipersoalkan perkara itu sendiri.
    expect(hasil.noKutipanAktaNikah).toBeNull();
    expect(hasil.tglKutipanAktaNikah).toBeNull();
  });
});

describe("tidak memetik yang tidak tertulis", () => {
  it("posita tanpa penanda apa pun memulangkan seluruhnya kosong", () => {
    const hasil = petikDataNikah("<p>Bahwa Pemohon adalah warga Kabupaten Donggala.</p>");
    expect(hasil.tglNikah).toBeNull();
    expect(hasil.noKutipanAktaNikah).toBeNull();
    expect(hasil.tglKutipanAktaNikah).toBeNull();
    expect(hasil.tempatNikah).toBeNull();
  });

  it("tanggal lain pada posita tidak dijadikan tanggal menikah", () => {
    // Posita memuat tanggal pisah rumah, puncak pertengkaran, dan kelahiran
    // anak. Satu pun di antaranya tidak boleh menjadi tanggal pernikahan.
    const hasil = petikDataNikah(
      "<p>Bahwa sejak tanggal 5 Mei 2023 Penggugat dan Tergugat pisah rumah.</p>" +
        "<p>Bahwa puncak pertengkaran terjadi pada tanggal 12 Juni 2024.</p>"
    );
    expect(hasil.tglNikah).toBeNull();
  });

  it("posita kosong tidak melempar", () => {
    const hasil = petikDataNikah("");
    expect(hasil.tglNikah).toBeNull();
    expect(hasil.kua).toBeNull();
  });
});

describe("bentuk penulisan yang benar-benar ditemui di berkas", () => {
  it("nomor akta enam belas angka - bentuk yang baru", () => {
    const hasil = petikDataNikah(
      "<p>Bahwa pada tanggal 25 Agustus 2024, Penggugat dan Tergugat telah melangsungkan " +
        "pernikahan, sebagaimana Kutipan Akta Nikah Nomor : 7203081082024015, tertanggal " +
        "25 Agustus 2024;</p>"
    );
    expect(hasil.noKutipanAktaNikah?.nilai).toBe("7203081082024015");
  });

  it("nomor akta yang bagiannya dipisah SPASI tetap utuh", () => {
    // "0437 012 XII 2020" ada di berkas sungguhan. Berhenti pada spasi
    // pertama memulangkan "0437" - nomor sepotong yang tampak berhasil.
    const hasil = petikDataNikah(
      "<p>Bahwa Penggugat dan Tergugat menikah pada tanggal 3 Desember 2020, sesuai " +
        "Kutipan Akta Nikah Nomor 0437 012 XII 2020, tertanggal 3 Desember 2020;</p>"
    );
    expect(hasil.noKutipanAktaNikah?.nilai).toBe("0437 012 XII 2020");
  });

  it("kata sesudah nomor tidak ikut tersedot", () => {
    const hasil = petikDataNikah(
      "<p>Bahwa Penggugat menikah pada tanggal 1 Maret 2016 sebagaimana Kutipan Akta Nikah " +
        "Nomor 27/27/IX/2016 sebagaimana ternyata dalam bukti P.1;</p>"
    );
    expect(hasil.noKutipanAktaNikah?.nilai).toBe("27/27/IX/2016");
  });

  it("huruf pengganti di tengah nama desa dibersihkan", () => {
    // Posita SIPP kerap memuat sisa penyalinan dari pengolah kata tepat di
    // tengah nama desa. Yang terisi ke borang tidak boleh memuat huruf yang
    // tidak dapat dicari siapa pun.
    const hasil = petikDataNikah(
      "<p>Bahwa Pemohon melangsungkan pernikahan pada tanggal 24 Januari 1984, bertempat " +
        "di Desa\uFFFD Tibo, di wilayah hukum Kantor Urusan Agama Kecamatan Sindue;</p>"
    );
    expect(hasil.tempatNikah?.nilai).toBe("Desa Tibo");
  });
});
