// @vitest-environment node
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ============================================================================
 * BUTIR 24 - FAKTA POSITA UNTUK KETERANGAN SAKSI DIBACA PER PERISTIWA
 * ============================================================================
 *
 * "Susun keterangan saksi" (panel ABT) meninggalkan "...", "sejak ...",
 * "yaitu ...", "adalah ...", "kurang lebih ..." dan "[BELUM TERISI ...]"
 * padahal faktanya tertulis di posita. Diukur atas 4.572 posita cerai PA
 * Donggala (angkanya di pesan commit butir 24).
 *
 * Seluruh posita di bawah KARANGAN yang meniru bentuk posita satker - tidak
 * ada nama, nomor, atau kalimat perkara sungguhan.
 *
 * pelaku = 0047 = Tergugat/Termohon; lawan = 0046 = Penggugat/Pemohon. Nama
 * di sini sengaja menyebut perannya supaya pertukaran sisi langsung terlihat.
 */

const AKAR = path.resolve(__dirname, "../../..");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const layanan = require(path.join(AKAR, "aleta_bot/services/abtUsulanService.js"));

const TERGUGAT = "Tergugat"; // 0047 - argumen `pelaku`
const PENGGUGAT = "Penggugat"; // 0046 - argumen `lawan`

const fakta = (posita: string, opsi?: { tanggalSidang?: string }) =>
  layanan.faktaDariPosita(posita, TERGUGAT, PENGGUGAT, opsi);

// Bentuk paling umum di satker: riwayat tempat tinggal "... selama N tahun,
// ... hingga pisah rumah" DI DEPAN kalimat puncak yang bertanggal.
const POSITA_TEMPLAT_SATKER = [
  "<ol>",
  "<li>Bahwa pada tanggal 3 Mei 2015, Penggugat dan Tergugat telah melangsungkan pernikahan yang dicatat oleh Pegawai Pencatat Nikah;</li>",
  "<li>Bahwa setelah menikah, Penggugat dan Tergugat tinggal bersama di rumah orang tua Penggugat di Desa Contoh selama 2 tahun, setelah itu Penggugat dan Tergugat tinggal di rumah bersama di Desa Contoh hingga pisah rumah;</li>",
  "<li>Bahwa sejak bulan Maret 2021 keadaan rumah tangga Penggugat dan Tergugat mulai tidak harmonis dan sering terjadi perselisihan dan pertengkaran yang disebabkan karena :",
  "<ol><li>Tergugat tidak memberikan nafkah yang cukup kepada Penggugat</li><li>Tergugat sering berkata kasar kepada Penggugat</li></ol></li>",
  "<li>Bahwa puncak keretakan hubungan rumah tangga Penggugat dengan Tergugat tersebut terjadi pada bulan Agustus 2023, Tergugat pergi meninggalkan rumah kediaman bersama ke rumah orang tua Tergugat sehingga Penggugat dan Tergugat telah pisah rumah selama kurang lebih 1 tahun 4 bulan. Sejak saat itu hak dan kewajiban suami isteri tidak terlaksana sebagaimana mestinya;</li>",
  "<li>Bahwa atas permasalahan dan kemelut rumah tangga yang dihadapi, keluarga Tergugat telah mencoba memusyawarahkan dengan keluarga Penggugat untuk mencari penyelesaian namun usaha tersebut tidak membuahkan hasil;</li>",
  "</ol>",
].join("\n");

describe("butir 24 - lama dan sejak pisah dari peristiwa pisahnya", () => {
  it("lama MENUMPANG di riwayat tempat tinggal bukan lama berpisah", () => {
    // Kode lama: kalimat pertama yang memuat "pisah" = riwayat tinggal, lalu
    // "2 tahun" di dalamnya masuk berita acara (13 dari 30 sampel salah).
    const f = fakta(POSITA_TEMPLAT_SATKER);
    expect(f.lamaPisah).toBe("1 tahun 4 bulan");
    expect(f.lamaPisahDihitung).toBe(false);
  });

  it("tanggal pisah diambil dari kalimat puncak walau kalimat pisah pertama tidak bertanggal", () => {
    expect(fakta(POSITA_TEMPLAT_SATKER).pisahSejak).toBe("bulan Agustus 2023");
  });

  it("riwayat tinggal saja: lama pisah tetap kosong, tidak diambil dari lama menumpang", () => {
    const f = fakta(
      "Bahwa setelah menikah, Pemohon dan Termohon tinggal bersama di rumah orang tua Termohon selama 1 bulan, setelah itu tinggal di rumah pribadi Pemohon hingga pisah rumah;"
    );
    expect(f.lamaPisah).toBe("");
  });

  it("masih serumah tetapi pisah kamar BUKAN pisah tempat tinggal", () => {
    const f = fakta("Bahwa Penggugat dan Tergugat masih tinggal bersama namun tidak lagi seranjang sehingga telah pisah kamar selama kurang lebih 9 bulan;");
    expect(f.lamaPisah).toBe("");
    expect(f.pisahSejak).toBe("");
  });

  it("kepergian yang sudah rujuk kembali tidak dipakai", () => {
    const f = fakta(
      "Bahwa pada tahun 2021 Tergugat pernah pergi meninggalkan rumah, namun pada bulan April 2022 Penggugat dan Tergugat rujuk kembali;"
    );
    expect(f.pisahSejak).toBe("");
    expect(f.siapaPergi).toBe("");
  });

  it("hanya tanggalnya tertulis: lamanya dihitung sampai tanggal sidang dan ditandai dihitung", () => {
    const posita = "Bahwa sejak bulan Mei 2024 Tergugat dan Penggugat tidak tinggal bersama lagi hingga sekarang;";
    const f = fakta(posita, { tanggalSidang: "2026-10-05" });
    expect(f.pisahSejak).toBe("bulan Mei 2024");
    expect(f.lamaPisah).toBe("2 tahun 5 bulan");
    expect(f.lamaPisahDihitung).toBe(true);
    // Tanpa tanggal sidang: tidak ada acuan, tidak dikarang.
    expect(fakta(posita).lamaPisah).toBe("");
  });

  it("hanya lamanya tertulis: tanggal pisah TIDAK dihitung mundur", () => {
    const f = fakta(
      "Bahwa Tergugat memutus komunikasi dengan Penggugat dan tidak lagi dapat dihubungi sehingga Penggugat dan Tergugat telah pisah rumah selama kurang lebih 2 tahun 11 bulan;",
      { tanggalSidang: "2026-10-05" }
    );
    expect(f.lamaPisah).toBe("2 tahun 11 bulan");
    expect(f.pisahSejak).toBe("");
  });
});

describe("butir 24 - awal perselisihan", () => {
  it("'keretakan ... terjadi pada April 2024' dikenali walau tanpa kata selisih/tengkar", () => {
    const f = fakta(
      "Bahwa keretakan rumah tangga Penggugat dan Tergugat terjadi pada April 2024 dimana Tergugat memutus komunikasi dengan Penggugat;"
    );
    expect(f.awalKonflik).toBe("bulan April 2024");
  });

  it("'mulai tidak harmonis', 'goyah', 'sejak awal tahun' dikenali", () => {
    expect(fakta("Bahwa sejak awal tahun 2020 rumah tangga Penggugat dan Tergugat mulai goyah;").awalKonflik).toBe("awal tahun 2020");
    expect(fakta("Bahwa sejak pertengahan 2019 keadaan rumah tangga mulai tidak harmonis;").awalKonflik).toBe("pertengahan tahun 2019");
  });

  it("tanggal PUNCAK bukan awal perselisihan - tanpa tanggal mulai, kosong", () => {
    // Kode lama mengambil tahun apa pun di kalimat perselisihan pertama.
    const f = fakta("Bahwa antara Penggugat dan Tergugat sering terjadi perselisihan dan pertengkaran, puncaknya pada bulan Mei 2023;");
    expect(f.awalKonflik).toBe("");
  });

  it("tanggal kepergian sesudah 'namun' bukan awal perselisihan", () => {
    const f = fakta(
      "Bahwa dalam rumah tangga Penggugat dan Tergugat pernah terjadi perselisihan dan pertengkaran namun pada tahun 2015, Tergugat pergi meninggalkan Penggugat sampai dengan sekarang;"
    );
    expect(f.awalKonflik).toBe("");
    expect(f.pisahSejak).toBe("tahun 2015");
  });

  it("tanggal nikah dan tahun peraturan tidak terbaca sebagai awal perselisihan", () => {
    expect(
      fakta("Bahwa pertengkaran terus-menerus memenuhi Peraturan Pemerintah Nomor 9 Tahun 1975 sehingga tidak mungkin rukun;").awalKonflik
    ).toBe("");
  });
});

describe("butir 24 - penyebab perselisihan", () => {
  it("butir daftar sesudah 'disebabkan karena :' menjadi penyebab", () => {
    expect(fakta(POSITA_TEMPLAT_SATKER).penyebab).toBe(
      "Tergugat tidak memberikan nafkah yang cukup kepada Penggugat dan Tergugat sering berkata kasar kepada Penggugat"
    );
  });

  it("penyebab sebaris: sisa kalimat sesudah 'karena', dipotong pada 'sehingga'", () => {
    const f = fakta(
      "Bahwa sejak tahun 2013 antara Penggugat dan Tergugat sering terlibat perselisihan dan pertengkaran karena tergugat tidak memberikan nafkah kepada Penggugat sehingga Penggugat bekerja sendiri;"
    );
    expect(f.penyebab).toBe("Tergugat tidak memberikan nafkah kepada Penggugat");
  });

  it("tanpa kalimat perselisihan yang menyebut sebabnya: kosong", () => {
    expect(fakta("Bahwa Penggugat dan Tergugat telah pisah rumah selama 1 tahun;").penyebab).toBe("");
  });

  it("'yang saya tahu yaitu ...' diisi penyebabnya; 'Bagaimana ... mengetahui penyebab' tidak", () => {
    const f = fakta(POSITA_TEMPLAT_SATKER);
    const isi = layanan.lengkapiJawabanTemplat({
      tanya: "Apakah saksi tahu penyebab perselisihan dan pertengkaran Penggugat dan Tergugat?",
      jawab: "Ya, penyebab mereka berselisih dan bertengkar, yang saya tahu yaitu ...;",
      fakta: f,
    });
    expect(isi).toContain("yang saya tahu yaitu Tergugat tidak memberikan nafkah");
    expect(isi).not.toContain("...");
    const cara = layanan.lengkapiJawabanTemplat({
      tanya: "Bagaimana saksi bisa mengetahui penyebab perselisihan tersebut?",
      jawab: "Saya mengetahui karena ...;",
      fakta: f,
    });
    expect(cara).toContain("...");
  });
});

describe("butir 24 - siapa yang pergi", () => {
  it("yang DIUSIR adalah yang pergi", () => {
    const f = fakta(
      "Bahwa puncak keretakan terjadi pada bulan Juli 2022, Penggugat diusir oleh Tergugat sehingga Penggugat dan Tergugat telah pisah rumah selama kurang lebih 7 bulan;"
    );
    expect(f.siapaPergi).toBe(PENGGUGAT);
  });

  it("'Tergugat mengantar Penggugat kembali ke rumah orang tua Penggugat' - yang pergi Penggugat", () => {
    const f = fakta(
      "Bahwa puncak keretakan terjadi pada bulan Oktober 2021, Tergugat mengantar Penggugat kembali ke rumah orang tua Penggugat sehingga telah pisah rumah selama kurang lebih 1 tahun;"
    );
    expect(f.siapaPergi).toBe(PENGGUGAT);
  });

  it("'Tergugat pulang ke rumah orang tuanya' - yang pergi Tergugat (arah sebaliknya juga diuji)", () => {
    const f = fakta(
      "Bahwa puncak keretakan terjadi pada bulan Maret 2024, Tergugat pulang ke rumah orang tua Tergugat sehingga telah pisah rumah selama kurang lebih 6 bulan;"
    );
    expect(f.siapaPergi).toBe(TERGUGAT);
  });

  it("sebutan OBJEK sebelum 'pergi' bukan yang pergi - ragu tetap kosong", () => {
    // Kode lama: sebutan terdekat sebelum 'meninggalkan' = Penggugat (objek).
    const f = fakta("Bahwa Tergugat marah kepada Penggugat lalu pergi meninggalkan rumah sampai sekarang dan telah pisah rumah;");
    expect(f.siapaPergi).toBe("");
  });

  it("dua butir seperingkat menyebut pihak berbeda pergi: kosong, tidak ditebak", () => {
    const f = fakta(
      [
        "Bahwa pada bulan Februari 2024 Tergugat marah lalu mengusir Penggugat sampai sekarang;",
        "Bahwa Tergugat pergi meninggalkan rumah dan sampai sekarang tidak pernah kembali;",
      ].join("\n")
    );
    expect(f.siapaPergi).toBe("");
  });

  it("pergi bekerja dengan pamit dan hubungan masih baik bukan perpisahan", () => {
    const f = fakta(
      "Bahwa pada September 2023 Tergugat berpamitan kepada Penggugat untuk pergi bekerja ke luar daerah dan hubungan antara Penggugat dan Tergugat masih terjalin dengan baik;"
    );
    expect(f.siapaPergi).toBe("");
    expect(f.pisahSejak).toBe("");
  });
});

describe("butir 24 - jawaban templat pisah", () => {
  it("hanya lama yang diketahui: 'sejak ...' menjadi 'selama kurang lebih N', bukan 'sejak N tahun'", () => {
    const f = fakta("Bahwa Penggugat dan Tergugat telah pisah rumah selama kurang lebih 2 tahun 11 bulan;");
    const isi = layanan.lengkapiJawabanTemplat({
      tanya: "Apakah saat ini Penggugat dan Tergugat masih tinggal serumah?",
      jawab: "Penggugat dan Tergugat sudah pisah tempat tinggal sejak ... sampai sekarang;",
      fakta: f,
    });
    expect(isi).toBe("Penggugat dan Tergugat sudah pisah tempat tinggal selama kurang lebih 2 tahun 11 bulan sampai sekarang;");
  });

  it("lama yang dihitung tidak menggandakan 'kurang lebih' yang sudah ada di templat", () => {
    const f = fakta("Bahwa sejak bulan Mei 2024 Tergugat dan Penggugat tidak tinggal bersama lagi;", { tanggalSidang: "05/10/2026" });
    const isi = layanan.lengkapiJawabanTemplat({
      tanya: "Sudah berapa lama Penggugat dan Tergugat berpisah tempat tinggal?",
      jawab: "Penggugat dan Tergugat berpisah tempat tinggal sudah kurang lebih ...;",
      fakta: f,
    });
    expect(isi).toBe("Penggugat dan Tergugat berpisah tempat tinggal sudah kurang lebih 2 tahun 5 bulan;");
  });
});

describe("butir 24 - upaya rukun dari posita dan mediasi", () => {
  const sumber = (posita: string, mediasi?: object) =>
    layanan.sumberUpayaDamai({ nilai1268: "", posita, mediasi, pelaku: TERGUGAT, lawan: PENGGUGAT });

  it("'sulit untuk dirukunkan lagi' adalah keadaan, bukan upaya", () => {
    const u = sumber("Bahwa sejak tahun 2018 sering terjadi perselisihan dan pertengkaran yang sulit untuk dirukunkan lagi;");
    expect(u.sumber).toBe("");
  });

  it("nasihat suami kepada isteri bukan upaya merukunkan", () => {
    expect(sumber("Bahwa Tergugat malas bekerja dan marah ketika Penggugat menasehatinya;").sumber).toBe("");
  });

  it("'tidak ada harapan untuk hidup rukun kembali' bukan upaya", () => {
    expect(sumber("Bahwa Penggugat sudah tidak sanggup lagi dan tidak ada harapan untuk hidup rukun kembali;").sumber).toBe("");
  });

  it("'keluarga ... tidak pernah memusyawarahkan' = belum pernah ada upaya", () => {
    const u = sumber("Bahwa keluarga Tergugat tidak pernah memusyawarahkan dengan keluarga Penggugat untuk mencari penyelesaian;");
    expect(u.kalimat).toMatch(/^Belum pernah ada upaya/);
  });

  it("musyawarah keluarga yang gagal tetap terbaca, beserta perukunnya", () => {
    const u = sumber(POSITA_TEMPLAT_SATKER);
    expect(u.sumber).toBe("posita");
    expect(u.kalimat).toBe("Penggugat dan Tergugat sudah pernah diupayakan untuk dirukunkan oleh keluarga Tergugat, namun tidak berhasil");
  });

  it("mediasi 'tidak dapat dilaksanakan' (hasil D) bukan mediasi yang gagal", () => {
    expect(sumber("", { selesai: true, berhasil: false, dilaksanakan: false }).sumber).toBe("");
    expect(sumber("", { selesai: true, berhasil: false }).sumber).toBe("mediasi");
  });
});

describe("butir 24 - templat 04 ABT utuh (584/Pdt.G/2026 memakai templat ini)", () => {
  // Bunyi templat 04 SESUDAH ABT mengganti variabelnya; variabel yang kosong
  // di ABT tercetak "...", persis yang terlihat pada 584/Pdt.G/2026/PA.Dgl.
  const TEMPLAT_04 = [
    { no: "6", tanya: "Kapan mulai terjadi perselisihan dan pertengkaran antara Penggugat dan Tergugat?", jawab: "Perselisihan dan pertengkaran Penggugat dan Tergugat terjadi sejak ...;" },
    { no: "7", tanya: "Apakah saksi tahu penyebab perselisihan dan pertengkaran Penggugat dan Tergugat?", jawab: "Ya, penyebab mereka berselisih dan bertengkar, yang saya tahu yaitu ...;" },
    { no: "10", tanya: "Apakah saat ini Penggugat dan Tergugat masih tinggal serumah?", jawab: "Penggugat dan Tergugat sudah pisah tempat tinggal sejak ...;" },
    { no: "11", tanya: "Siapa yang meninggalkan tempat tinggal bersama?", jawab: "Yang meninggalkan kediaman bersama adalah ...;" },
    { no: "12", tanya: "Sudah berapa lama Penggugat dan Tergugat berpisah tempat tinggal?", jawab: "Penggugat dan Tergugat berpisah tempat tinggal sudah kurang lebih ...;" },
    { no: "14", tanya: "Apakah sejak ada masalah, Penggugat dan Tergugat pernah diupayakan untuk rukun kembali?", jawab: "Ya, ...;" },
  ];

  it("posita templat satker mengisi keenam jawaban yang dahulu kosong", () => {
    const hasil = layanan.susunKeteranganSaksiSdg({
      templat: TEMPLAT_04,
      posita: POSITA_TEMPLAT_SATKER,
      pelaku: TERGUGAT,
      lawan: PENGGUGAT,
      nomorPerkara: "1/Pdt.G/2026/PA.Uji",
      kodeKumpulan: "04",
      modus: { saksi1: { modus: "sama" }, saksi2: { modus: "sama" } },
    });
    expect(hasil.ok).toBe(true);
    const jawab = Object.fromEntries(hasil.saksi1.map((b: { no: string; jawab: string }) => [b.no, b.jawab]));
    for (const no of ["6", "7", "10", "11", "12", "14"]) {
      expect(jawab[no], `pertanyaan ${no}: ${jawab[no]}`).not.toMatch(/\.{3}|BELUM TERISI/);
    }
    expect(jawab["6"]).toContain("Maret 2021");
    expect(jawab["10"]).toContain("Agustus 2023");
    expect(jawab["11"]).toContain(TERGUGAT);
    expect(jawab["12"]).toContain("1 tahun 4 bulan");
    expect(jawab["12"]).not.toContain("2 tahun");
    expect(jawab["14"]).toContain("keluarga Tergugat");
    expect(hasil.belumTerisi).toEqual([]);
  });

  it("posita yang tidak menyebut faktanya: jawaban tetap bertitik-titik, tidak dikarang", () => {
    const hasil = layanan.susunKeteranganSaksiSdg({
      templat: TEMPLAT_04,
      posita: "Bahwa Penggugat dan Tergugat adalah suami isteri yang sah;",
      pelaku: TERGUGAT,
      lawan: PENGGUGAT,
      modus: { saksi1: { modus: "sama" }, saksi2: { modus: "sama" } },
    });
    const jawab = Object.fromEntries(hasil.saksi1.map((b: { no: string; jawab: string }) => [b.no, b.jawab]));
    for (const no of ["6", "10", "11", "12"]) expect(jawab[no]).toContain("...");
    expect(jawab["14"]).toBe(layanan.TANDA_BELUM_TERISI);
  });
});
