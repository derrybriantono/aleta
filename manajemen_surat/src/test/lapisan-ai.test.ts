// @vitest-environment node
import { describe, expect, it } from "vitest";

import { kutipanAdaDiNaskah, periksaTarikan, susunPerintah } from "@/lib/fakta-tak-berpola";
import {
  jawabanKosong,
  jawabanModel,
  jawabanPustaka,
  pilihSumber,
  sebutkanAsal,
  siapkanKiriman,
} from "@/lib/penjawab";
import { BATAS_BAWAAN } from "@/lib/batas-data";
import { buatPenyamar } from "@/lib/penyamaran";
import { periksaUsulan, susunPerintahPertimbangan } from "@/lib/usulan-pertimbangan";

/**
 * Lapisan AI (I1-I5).
 *
 * ============================================================================
 * YANG DIJAGA DI SINI
 * ============================================================================
 *
 * Empat penolakan, dan seluruh nilai berkas ini ada padanya:
 *
 *   - pustaka yang menjawab TIDAK memanggil model sama sekali;
 *   - jawaban tanpa asal tidak dapat dibentuk, dan jawaban model selalu
 *     usulan - tidak ada parameter yang mengubahnya;
 *   - fakta yang kutipannya tidak ada di naskah DIBUANG, bukan ditandai ragu;
 *   - satu ruas tanpa aturan batas menahan SELURUH kiriman.
 */

// ── I5 penjawab ────────────────────────────────────────────────────────────

const PUSTAKA_ISI = {
  jumlah: 2,
  isi: "Menimbang, bahwa alinea dari pustaka;",
  rujukan: ["b1", "b2"],
  disahkan: true,
};
const PUSTAKA_KOSONG = { jumlah: 0, isi: "", rujukan: [], disahkan: true };

describe("pustaka dulu, model terakhir", () => {
  it("pustaka yang menjawab membuat model TIDAK dipilih", () => {
    // Membandingkan keduanya berarti isi berkas tetap terkirim ke luar pada
    // tiap pertanyaan, dan risikonya tetap terbayar meski jawabannya dibuang.
    expect(pilihSumber(PUSTAKA_ISI, { menyala: true, sebab: "" })).toBe("pustaka");
  });

  it("model dipilih hanya saat pustaka kosong", () => {
    expect(pilihSumber(PUSTAKA_KOSONG, { menyala: true, sebab: "" })).toBe("model");
  });

  it("pustaka kosong dan AI mati menghasilkan tidak dijawab, bukan jawaban kosong yang terlihat sah", () => {
    expect(pilihSumber(PUSTAKA_KOSONG, { menyala: false, sebab: "dimatikan admin" })).toBe("tidakDijawab");
  });

  it("pustaka yang isinya kosong meski jumlahnya tidak nol tetap bukan jawaban", () => {
    expect(pilihSumber({ ...PUSTAKA_ISI, isi: "   " }, { menyala: true, sebab: "" })).toBe("model");
  });
});

describe("layar wajib menyebut siapa yang menjawab", () => {
  it("jawaban model SELALU usulan", () => {
    // Model yang jawabannya dapat berstatus pendirian adalah model yang
    // jawabannya akan ditandatangani tanpa dibaca.
    const jawaban = jawabanModel({ isi: "apa pun", kutipanTakTerbukti: [], namaModel: "model-x" });
    expect(jawaban.usulan).toBe(true);
    expect(jawaban.dijawabOleh).toBe("model");
  });

  it("jawaban model membawa peringatan asalnya, bahkan tanpa kutipan bermasalah", () => {
    const jawaban = jawabanModel({ isi: "apa pun", kutipanTakTerbukti: [], namaModel: "model-x" });
    expect(jawaban.peringatan.join(" ")).toContain("bukan diambil dari pustaka");
  });

  it("kutipan yang tidak terbukti disebut satu per satu", () => {
    const jawaban = jawabanModel({
      isi: "apa pun",
      kutipanTakTerbukti: ["Pasal 99 UU 1/1974", "Pasal 5 Perda"],
      namaModel: "model-x",
    });
    expect(jawaban.peringatan.filter((item) => item.includes("TIDAK ditemukan"))).toHaveLength(2);
  });

  it("jawaban pustaka yang butirnya belum disahkan tetap ditandai usulan", () => {
    const jawaban = jawabanPustaka({ ...PUSTAKA_ISI, disahkan: false });
    expect(jawaban.usulan).toBe(true);
    expect(jawaban.peringatan.join(" ")).toContain("belum disahkan");
  });

  it("asalnya disebut lebih dulu, bukan isinya", () => {
    expect(sebutkanAsal(jawabanPustaka(PUSTAKA_ISI))).toContain("pustaka");
    expect(sebutkanAsal(jawabanModel({ isi: "x", kutipanTakTerbukti: [], namaModel: "m" }))).toContain(
      "usulan, bukan pendirian"
    );
    expect(sebutkanAsal(jawabanKosong("sebab"))).toBe("Belum terjawab");
  });
});

describe("tidak ada yang keluar sebelum disaring", () => {
  it("satu ruas tanpa aturan batas menahan SELURUH kiriman", () => {
    // Mengirim sisanya membuat ketiadaan aturan tidak pernah terasa, dan ruas
    // baru terus bertambah tanpa ada yang memutuskannya.
    const penyamar = buatPenyamar("garam-uji");
    const kiriman = siapkanKiriman(
      { jenisPerkara: "Cerai Gugat", ruasBaruYangBelumDiatur: "isi" },
      penyamar
    );
    expect(kiriman.boleh).toBe(false);
    expect(kiriman.sebab).toContain("ruasBaruYangBelumDiatur");
  });

  it("ruas pertanyaan punya aturannya sendiri, sehingga tidak menahan kirimannya sendiri", () => {
    // Cacat yang pernah ada: "pertanyaan" tidak punya aturan batas, sehingga
    // bawaan-ketat menahan SELURUH kiriman - dan model tidak pernah dapat
    // dipanggil sama sekali. Bawaan yang ketat memang benar; yang kurang
    // adalah ruas milik lapisan ini sendiri tidak pernah diklasifikasikan.
    const penyamar = buatPenyamar("garam-uji");
    const kiriman = siapkanKiriman({ pertanyaan: "apakah verstek layak?" }, penyamar);
    expect(kiriman.boleh).toBe(true);
    expect(kiriman.belumBeraturan).toEqual([]);
  });

  it("naskah berkas utuh TERLARANG sebagai bawaan", () => {
    // Menariknya sesudah disamarkan tidak mungkin - tanggal yang sudah menjadi
    // [TANGGAL] tidak dapat ditarik sebagai tanggal nikah. Jadi pilihannya
    // hanya dikirim utuh atau tidak dikirim, dan pilihan itu terlalu besar
    // untuk diambil diam-diam.
    const penyamar = buatPenyamar("garam-uji");
    const kiriman = siapkanKiriman({ naskah: "Bahwa Penggugat dan Tergugat menikah..." }, penyamar);
    expect(kiriman.isi.naskah).toBeUndefined();
    expect(kiriman.ditahan.map((item) => item.ruas)).toContain("naskah");
    // Bukan "belum beraturan" - ia punya aturan, dan aturannya melarang.
    expect(kiriman.belumBeraturan).toEqual([]);
  });

  it("pengadilan dapat mengizinkan naskah lewat aturan tersendiri yang tercatat", () => {
    const penyamar = buatPenyamar("garam-uji");
    const kiriman = siapkanKiriman({ naskah: "Bahwa Penggugat..." }, penyamar, [
      { ruas: "naskah", batas: "bebas", sebab: "Diputuskan Ketua Pengadilan pada rapat 5 September 2026." },
      ...BATAS_BAWAAN,
    ]);
    expect(kiriman.boleh).toBe(true);
    expect(kiriman.isi.naskah).toContain("Bahwa Penggugat");
  });

  it("ruas terlarang ditahan, ruas samar disamarkan, ruas bebas lewat", () => {
    const penyamar = buatPenyamar("garam-uji");
    const kiriman = siapkanKiriman(
      { jenisPerkara: "Cerai Gugat", nik: "7201234567890123", namaPenggugat: "Reka Febrianti" },
      penyamar
    );
    expect(kiriman.boleh).toBe(true);
    expect(kiriman.isi.jenisPerkara).toBe("Cerai Gugat");
    expect(kiriman.isi.nik).toBeUndefined();
    expect(kiriman.isi.namaPenggugat).toBe("Orang A");
  });
});

// ── I1 fakta tak berpola ───────────────────────────────────────────────────

const NASKAH =
  "Bahwa Penggugat dan Tergugat menikah pada tanggal 12 Maret 2015 di Kantor Urusan Agama Kecamatan Banawa. " +
  "Bahwa sejak bulan Januari 2024 telah terjadi perselisihan yang terus-menerus.";

describe("menarik fakta tak berpola", () => {
  it("fakta yang kutipannya ada di naskah diterima", () => {
    const hasil = periksaTarikan({
      naskah: NASKAH,
      ruasDiminta: ["tanggalNikah"],
      dariModel: [
        {
          nama: "tanggalNikah",
          jenis: "tanggal",
          nilai: "12 Maret 2015",
          kutipan: "menikah pada tanggal 12 Maret 2015",
        },
      ],
    });
    expect(hasil.fakta).toHaveLength(1);
    expect(hasil.dibuang).toEqual([]);
  });

  it("fakta yang kutipannya TIDAK ada di naskah DIBUANG, bukan ditandai ragu", () => {
    // Menandainya ragu berarti ia tetap muncul di layar, dan yang muncul di
    // layar akhirnya dipakai.
    const hasil = periksaTarikan({
      naskah: NASKAH,
      ruasDiminta: ["tanggalNikah"],
      dariModel: [
        {
          nama: "tanggalNikah",
          jenis: "tanggal",
          nilai: "3 Juni 2016",
          kutipan: "menikah pada tanggal 3 Juni 2016 di Palu",
        },
      ],
    });
    expect(hasil.fakta).toEqual([]);
    expect(hasil.dibuang[0].sebab).toContain("dikarang");
  });

  it("fakta tanpa kutipan dibuang", () => {
    const hasil = periksaTarikan({
      naskah: NASKAH,
      ruasDiminta: ["tanggalNikah"],
      dariModel: [{ nama: "tanggalNikah", nilai: "12 Maret 2015" }],
    });
    expect(hasil.fakta).toEqual([]);
    expect(hasil.dibuang[0].sebab).toContain("kutipan");
  });

  it("ruas yang TIDAK diminta dibuang", () => {
    // Model yang boleh menambah ruas akan menambah ruas, dan yang
    // ditambahkannya tidak pernah diperiksa siapa pun.
    const hasil = periksaTarikan({
      naskah: NASKAH,
      ruasDiminta: ["tanggalNikah"],
      dariModel: [
        {
          nama: "penghasilanTergugat",
          nilai: "lima juta",
          kutipan: "Bahwa sejak bulan Januari 2024 telah terjadi perselisihan",
        },
      ],
    });
    expect(hasil.fakta).toEqual([]);
    expect(hasil.dibuang[0].sebab).toContain("tidak diminta");
  });

  it("ruas yang tidak tertulis dilaporkan kosong, bukan ditebak", () => {
    const hasil = periksaTarikan({
      naskah: NASKAH,
      ruasDiminta: ["tanggalNikah", "jumlahAnak"],
      dariModel: [
        { nama: "tanggalNikah", nilai: "12 Maret 2015", kutipan: "menikah pada tanggal 12 Maret 2015" },
      ],
    });
    expect(hasil.tidakTertulis).toEqual(["jumlahAnak"]);
  });

  it("hasilnya selalu menyatakan bahwa ini yang TERTULIS, bukan yang terbukti", () => {
    const hasil = periksaTarikan({ naskah: NASKAH, ruasDiminta: [], dariModel: [] });
    expect(hasil.peringatan.join(" ")).toContain("TERTULIS, bukan yang terbukti");
  });

  it("kutipan yang hanya berbeda spasi tetap dikenali", () => {
    expect(kutipanAdaDiNaskah("menikah   pada  tanggal 12 Maret 2015", NASKAH)).toBe(true);
  });

  it("kutipan yang katanya ditulis ulang TIDAK dikenali", () => {
    // Penulisan ulang bukan penyalinan, dan tidak dapat dipakai memeriksa apa pun.
    expect(kutipanAdaDiNaskah("melangsungkan pernikahan pada 12 Maret 2015", NASKAH)).toBe(false);
  });

  it("kutipan terlalu pendek ditolak", () => {
    expect(kutipanAdaDiNaskah("Bahwa", NASKAH)).toBe(false);
  });

  it("perintahnya menyebut larangan menebak", () => {
    const perintah = susunPerintah(["tanggalNikah"]);
    expect(perintah).toContain("jangan menebak");
    expect(perintah).toContain("DISALIN PERSIS");
  });
});

// ── I2 dan I4 usulan pertimbangan ──────────────────────────────────────────

const JANGKAR_ADA = new Set(["uu-7-1989/pasal-49", "uu-1-1974/pasal-39"]);

describe("usulan pertimbangan susunan model", () => {
  it("alinea yang seluruh kutipannya terbukti layak diusulkan", () => {
    const usulan = periksaUsulan(
      { teks: "Menimbang, bahwa berdasarkan Pasal 39 Undang-Undang Nomor 1 tahun 1974, maka;" },
      JANGKAR_ADA
    );
    expect(usulan.layakDiusulkan).toBe(true);
    expect(usulan.takTerbukti).toEqual([]);
  });

  it("satu kutipan yang tidak terbukti menolak SELURUH usulan", () => {
    // Alinea yang mengutip satu pasal karangan tidak menjadi benar dengan
    // membuang kutipannya - yang salah penalarannya.
    const usulan = periksaUsulan(
      { teks: "Menimbang, bahwa berdasarkan Pasal 99 Undang-Undang Nomor 1 tahun 1974, maka;" },
      JANGKAR_ADA
    );
    expect(usulan.layakDiusulkan).toBe(false);
    expect(usulan.takTerbukti).toHaveLength(1);
    expect(usulan.sebab).toContain("tidak ditemukan di pustaka");
  });

  it("peraturan yang tidak dikenali dibedakan dari pasal yang tidak ada", () => {
    const usulan = periksaUsulan(
      { teks: "Menimbang, bahwa menurut Pasal 5 Peraturan Daerah Kabupaten Sesuatu, maka;" },
      JANGKAR_ADA
    );
    expect(usulan.tanpaJangkar.length).toBeGreaterThan(0);
    expect(usulan.layakDiusulkan).toBe(false);
    expect(usulan.sebab).toContain("belum dikenali");
  });

  it("alinea tanpa kutipan pasal BOLEH diusulkan", () => {
    // Banyak alinea pertimbangan memang tidak mengutip apa pun. Yang tidak
    // boleh adalah mengutip pasal yang tidak ada, bukan tidak mengutip.
    const usulan = periksaUsulan(
      { teks: "Menimbang, bahwa keterangan kedua saksi saling bersesuaian;" },
      JANGKAR_ADA
    );
    expect(usulan.kutipan).toEqual([]);
    expect(usulan.layakDiusulkan).toBe(true);
  });

  it("usulan kosong tidak layak", () => {
    expect(periksaUsulan({ teks: "   " }, JANGKAR_ADA).layakDiusulkan).toBe(false);
  });

  it("perintah menyusun membatasi kutipan pada daftar yang diberikan", () => {
    const perintah = susunPerintahPertimbangan({
      jenisPerkara: "Cerai Gugat",
      isu: "pembuktian",
      fakta: { jumlahSaksi: 2 },
      pasalTersedia: [{ jangkar: "uu-7-1989/pasal-49", sebutan: "Pasal 49", isi: "bunyinya" }],
    });
    expect(perintah).toContain("hanya dari daftar ini");
    expect(perintah).toContain("uu-7-1989/pasal-49");
    expect(perintah).toContain("Jangan menyebut nama orang");
  });

  it("tanpa pasal tersedia, model diperintahkan TIDAK mengutip sama sekali", () => {
    // Tanpa daftar, model mengutip dari ingatannya - yang memuat pasal dari
    // peraturan yang sudah dicabut dan dari yang tidak pernah ada.
    const perintah = susunPerintahPertimbangan({
      jenisPerkara: "Cerai Gugat",
      isu: "",
      fakta: {},
      pasalTersedia: [],
    });
    expect(perintah).toContain("TIDAK ada pasal yang tersedia");
  });
});
