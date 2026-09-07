// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  alineaBerguna,
  alineaBergunaSaja,
  bentukAlinea,
  buatBlok,
  rapikanAlinea,
  susunKorpus,
  susunUlang,
} from "@/lib/blok-kalimat";

/**
 * Blok kalimat - satu alinea hukum, ditulis sekali dan dipakai berkali-kali.
 *
 * ============================================================================
 * YANG DIJAGA DI SINI
 * ============================================================================
 *
 * Satu hal, dan seluruh berkas ini ada untuknya: MENYUSUN ULANG SEBUAH BLANGKO
 * DARI KORPUS HARUS TEPAT KATA DEMI KATA. Kalau tidak, korpus kehilangan atau
 * menukar sesuatu, dan blangko ALETA akan berbunyi lain dari blangko yang
 * sudah teruji dipakai bertahun-tahun.
 *
 * Yang kedua, sama pentingnya: alinea yang MIRIP tidak boleh disatukan
 * sendiri oleh mesin. Blok identitas para pihak di ABT sungguhan berbeda antar
 * berkas - satu memuat NIK, satu tidak; "bertempat tinggal di" berhadapan
 * dengan "tempat kediaman di". Memilih mana yang benar adalah pekerjaan hakim.
 * Mesin hanya boleh MELAPORKAN pergeserannya.
 */

// Alinea sungguhan dari dua BAS bersaudara di folder ABT PA Donggala.
const ALINEA_A = [
  "BERITA ACARA SIDANG",
  "#0098#, NIK #0335#, tempat dan tanggal lahir #0341#, #0345#, agama #0011#, pendidikan #0021#, pekerjaan #0100#, bertempat tinggal di #0101#, sebagai #0046#;",
  "Selanjutnya Ketua Majelis memeriksa identitas #0046#, yang ternyata identitas #0046# sesuai dengan yang tertera dalam surat #0053#;",
  "Kemudian Ketua Majelis berusaha mendamaikan dengan cara menasehati #0046# untuk mengurungkan niatnya bercerai dengan #0047#, namun tidak berhasil;",
  "MENETAPKAN",
];

const ALINEA_B = [
  "BERITA ACARA SIDANG",
  "#0098#, tempat dan tanggal lahir #0341#, #0345#, agama #0011#, pekerjaan #0100#, pendidikan #0021#, tempat kediaman di #0101#, sebagai #0046#;",
  "Selanjutnya Ketua Majelis memeriksa identitas #0047#, yang ternyata identitas #0047# sesuai dengan yang tertera dalam surat #0053#;",
  "Oleh karena #4046# tidak hadir, maka Ketua Majelis menunda sidang sampai dengan hari #0133# tanggal #0134#, pukul 09.00 #0150#, untuk memanggil #0046#;",
  "MENETAPKAN",
];

describe("menyusun ulang harus tepat kata demi kata", () => {
  it("tiap blangko tersusun kembali persis seperti aslinya", () => {
    const korpus = susunKorpus([
      { jalur: "a.rtf", alinea: ALINEA_A },
      { jalur: "b.rtf", alinea: ALINEA_B },
    ]);

    for (const [asli, susun] of [
      [ALINEA_A, korpus.susunan[0]],
      [ALINEA_B, korpus.susunan[1]],
    ] as const) {
      const hasil = susunUlang(susun.urutan, korpus.blok);
      expect(hasil.berhasil).toBe(true);
      expect(hasil.hilang).toEqual([]);
      expect(hasil.alinea).toEqual(alineaBergunaSaja(asli));
    }
  });

  it("blok yang hilang dilaporkan, bukan dilewati diam-diam", () => {
    // Alinea yang lenyap menjadi ruang kosong pada naskah resmi tidak akan
    // disadari siapa pun. Yang hilang harus disebut namanya.
    const korpus = susunKorpus([{ jalur: "a.rtf", alinea: ALINEA_A }]);
    const hasil = susunUlang([...korpus.susunan[0].urutan, "sidik-yang-tidak-ada"], korpus.blok);
    expect(hasil.berhasil).toBe(false);
    expect(hasil.hilang).toEqual(["sidik-yang-tidak-ada"]);
  });

  it("alinea yang sama persis di dua blangko menjadi SATU blok", () => {
    const korpus = susunKorpus([
      { jalur: "a.rtf", alinea: ALINEA_A },
      { jalur: "b.rtf", alinea: ALINEA_B },
    ]);
    const kepala = buatBlok("BERITA ACARA SIDANG");
    expect(korpus.blok.get(kepala.sidik)?.jumlahPakai).toBe(2);
  });
});

describe("yang mirip TIDAK disatukan sendiri", () => {
  it("blok identitas yang bergeser dilaporkan sebagai pergeseran, bukan digabung", () => {
    const korpus = susunKorpus([
      { jalur: "a.rtf", alinea: ALINEA_A },
      { jalur: "b.rtf", alinea: ALINEA_B },
    ]);

    // Kedua blok identitas tetap ada sebagai blok terpisah.
    const a = buatBlok(ALINEA_A[1]);
    const b = buatBlok(ALINEA_B[1]);
    expect(a.sidik).not.toBe(b.sidik);
    expect(korpus.blok.has(a.sidik)).toBe(true);
    expect(korpus.blok.has(b.sidik)).toBe(true);
  });

  it("pergeseran yang terdeteksi menyebut seluruh variannya", () => {
    // "memeriksa identitas #0046#" lawan "memeriksa identitas #0047#":
    // bentuknya sama karena penanda disamarkan, teksnya berbeda.
    const korpus = susunKorpus([
      { jalur: "a.rtf", alinea: ALINEA_A },
      { jalur: "b.rtf", alinea: ALINEA_B },
    ]);
    const geser = korpus.pergeseran.find((g) => g.bentuk.includes("memeriksa identitas"));
    expect(geser).toBeDefined();
    expect(geser?.varian).toHaveLength(2);
  });

  it("varian tersering disebut lebih dulu, tetapi tidak dipilihkan", () => {
    const korpus = susunKorpus([
      { jalur: "a.rtf", alinea: ALINEA_A },
      { jalur: "b.rtf", alinea: ALINEA_A },
      { jalur: "c.rtf", alinea: ALINEA_B },
    ]);
    const geser = korpus.pergeseran.find((g) => g.bentuk.includes("memeriksa identitas"));
    expect(geser?.varian[0].jumlahPakai).toBe(2);
    // Tidak ada ruas "terpilih" - mesin melaporkan, manusia memutuskan.
    expect(geser).not.toHaveProperty("terpilih");
  });

  it("alinea yang benar-benar sama tidak muncul sebagai pergeseran", () => {
    const korpus = susunKorpus([
      { jalur: "a.rtf", alinea: ALINEA_A },
      { jalur: "b.rtf", alinea: ALINEA_A },
    ]);
    expect(korpus.pergeseran).toHaveLength(0);
  });
});

describe("memilah alinea yang berguna", () => {
  it("sisa kendali RTF dibuang", () => {
    expect(alineaBerguna("\\*shapeType202fFlipH0fFlipV0fLockAspectRatio0WrapText0")).toBe(false);
    expect(alineaBerguna("* PAGE * Arabic 1")).toBe(false);
    expect(alineaBerguna("SC Z 1x")).toBe(false);
  });

  it("penanda bagian dipertahankan meski pendek", () => {
    // "MENETAPKAN" hanya 10 huruf tetapi ia struktur dokumen, bukan sampah.
    for (const kepala of ["MENETAPKAN", "MENGADILI", "DUDUK PERKARA", "PERTIMBANGAN HUKUM", "Panitera Pengganti,"]) {
      expect(alineaBerguna(kepala), kepala).toBe(true);
    }
  });

  it("potongan tanpa makna dibuang", () => {
    expect(alineaBerguna("...")).toBe(false);
    expect(alineaBerguna("1.")).toBe(false);
    expect(alineaBerguna("")).toBe(false);
    expect(alineaBerguna("P.1")).toBe(false);
  });

  it("kalimat panjang selalu dipertahankan", () => {
    expect(alineaBerguna(ALINEA_A[2])).toBe(true);
  });

  it("baris pendek yang bermakna TIDAK dibuang", () => {
    // Menyaring dengan ambang panjang akan membuang seluruh baris di bawah ini,
    // dan tiap satunya adalah isi dokumen yang sesungguhnya.
    for (const pendek of [
      "BERITA ACARA SIDANG",
      "Sidang Pertama",
      "Sudah cukup.",
      "03 September 2026",
      "Kepada para Pemohon;",
      "PENETAPAN",
      "SALINAN",
    ]) {
      expect(alineaBerguna(pendek), pendek).toBe(true);
    }
  });

  it("gumpalan heksadesimal gambar tertanam dibuang", () => {
    const gambar = "ffd8ffe000104a464946000101000001000100" + "0a1b2c3d4e5f".repeat(20);
    expect(alineaBerguna(gambar)).toBe(false);
  });
});

describe("pembersihan tidak mengubah kalimat hukum", () => {
  it("hanya ruang kosong yang dirapikan", () => {
    expect(rapikanAlinea("  Menimbang,   bahwa  ")).toBe("Menimbang, bahwa");
  });

  it("tanda baca dan huruf besar TIDAK disentuh", () => {
    // Perbedaan sekecil apa pun pada kalimat hukum harus tetap terlihat.
    const asli = "Menimbang, bahwa Pemohon I; DAN Pemohon II.";
    expect(rapikanAlinea(asli)).toBe(asli);
  });

  it("spasi tanpa-putus dari RTF ikut dirapikan", () => {
    expect(rapikanAlinea("Pemohon I")).toBe("Pemohon I");
  });
});

describe("bentuk alinea", () => {
  it("menyamarkan penanda dan angka supaya pergeseran terlihat", () => {
    const a = bentukAlinea("umur #1198# tahun, agama #1199#");
    const b = bentukAlinea("umur #1204# tahun, agama #1205#");
    expect(a).toBe(b);
  });

  it("kalimat yang benar-benar berbeda tetap berbeda bentuknya", () => {
    expect(bentukAlinea("Ketua Majelis membuka sidang")).not.toBe(
      bentukAlinea("Ketua Majelis menutup sidang")
    );
  });
});

describe("penanda di dalam blok", () => {
  it("dikumpulkan dan diurutkan tanpa kembar", () => {
    const b = buatBlok("identitas #0046#, sesuai #0046# dan #0053#");
    expect(b.penanda).toEqual(["0046", "0053"]);
  });
});
