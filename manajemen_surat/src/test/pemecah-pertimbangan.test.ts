// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  jangkarRujukan,
  kenaliRujukan,
  kenaliTempatKosong,
  pecahPertimbangan,
  sidikButir,
  slugDariSebutan,
} from "@/server/modules/aleta-ecourt/pemecah-pertimbangan";

/**
 * Pemecah pertimbangan hukum menjadi butir pustaka.
 *
 * ============================================================================
 * CONTOH DI SINI MENIRUKAN BENTUK NASKAH, BUKAN MENYATAKAN HUKUM
 * ============================================================================
 *
 * Bentuk alinea dan cara menulis rujukan diambil dari
 * perkara_pertimbangan_hukum di server - itulah yang membuat pola ini benar.
 * Bunyi hukumnya sendiri tidak dinyatakan di sini dan tidak boleh dibaca
 * sebagai rujukan.
 *
 * ============================================================================
 * YANG DIJAGA
 * ============================================================================
 *
 * Dua kekeliruan yang merusak pustaka secara diam-diam:
 *
 *   - alinea yang sama menjadi butir berbeda hanya karena nama pihaknya
 *     berbeda, sehingga pustaka menjadi salinan putusan; dan
 *   - rujukan pasal ditautkan ke peraturan yang tidak menyebutnya, sehingga
 *     putusan merujuk aturan yang keliru dengan meyakinkan.
 */

const NASKAH = [
  "<p>Menimbang, bahwa maksud dan tujuan gugatan Penggugat adalah sebagaimana diuraikan diatas;</p>",
  "<p>Menimbang, bahwa Majelis Hakim telah berusaha memberi nasihat kepada Penggugat, sebagaimana maksud Pasal 39 ayat (1) Undang-Undang Nomor 1 tahun 1974 <em>jo.</em> Pasal 65 dan Pasal 82 ayat (1) dan ayat (4) Undang-Undang Nomor 7 tahun 1989, akan tetapi tidak berhasil;</p>",
  "<p>Menimbang, bahwa berdasarkan ketentuan Pasal 149 RBg, putusan tanpa hadirnya Tergugat dapat dikabulkan sepanjang beralasan;</p>",
  "<p>MENGADILI</p>",
].join("\n");

describe("memecah naskah menjadi alinea", () => {
  it("tiap alinea HTML menjadi satu butir", () => {
    const butir = pecahPertimbangan(NASKAH);
    expect(butir).toHaveLength(4);
    expect(butir[0].teks).toContain("maksud dan tujuan gugatan");
  });

  it("alinea Menimbang ditandai, yang lain tidak", () => {
    // Kepala putusan, amar, dan penutup bukan pertimbangan - memasukkannya
    // berarti perakit kelak menyisipkan amar di tengah pertimbangan.
    const butir = pecahPertimbangan(NASKAH);
    expect(butir.filter((item) => item.menimbang)).toHaveLength(3);
    expect(butir[3].menimbang).toBe(false);
  });

  it("tanda HTML dibuang, bunyinya tidak", () => {
    const butir = pecahPertimbangan(NASKAH);
    expect(butir[1].teks).not.toContain("<em>");
    expect(butir[1].teks).toContain("jo.");
  });

  it("naskah tanpa tanda alinea dipecah pada baris kosong", () => {
    // Naskah lama ditulis dengan penyunting berbeda-beda; pemecahan yang
    // menuntut satu bentuk akan mengembalikan seluruh putusan sebagai satu
    // butir raksasa.
    const butir = pecahPertimbangan("Menimbang, bahwa satu;\n\nMenimbang, bahwa dua;");
    expect(butir).toHaveLength(2);
  });

  it("naskah kosong tidak menghasilkan butir", () => {
    expect(pecahPertimbangan("")).toEqual([]);
    expect(pecahPertimbangan("   ")).toEqual([]);
  });
});

describe("membaca rujukan pasal", () => {
  it("pasal, ayat, dan peraturannya terbaca dari bunyi alineanya", () => {
    const rujukan = kenaliRujukan(pecahPertimbangan(NASKAH)[1].teks);
    const pertama = rujukan[0];

    expect(pertama.pasal).toBe("39");
    expect(pertama.ayat).toBe("1");
    expect(pertama.peraturan).toContain("Undang-Undang Nomor 1 tahun 1974");
  });

  it("rujukan berantai menumpang satu nama peraturan", () => {
    // "Pasal 65 dan Pasal 82 ayat (1) ... Undang-Undang Nomor 7 tahun 1989" -
    // undang-undang itu menaungi KEDUA pasalnya. Bagi yang membaca itu jelas;
    // bagi pencocok yang hanya melihat kata berikutnya, Pasal 65 tampak tanpa
    // peraturan.
    const rujukan = kenaliRujukan(pecahPertimbangan(NASKAH)[1].teks);
    const pasal65 = rujukan.find((item) => item.pasal === "65")!;
    expect(pasal65.peraturan).toContain("Undang-Undang Nomor 7 tahun 1989");
    expect(jangkarRujukan(pasal65)).toBe("uu-7-1989/pasal-65");
  });

  it("beberapa ayat pada satu rujukan dibaca apa adanya", () => {
    // Memecahnya menjadi dua rujukan berarti menyatakan hakim menulis sesuatu
    // yang tidak ditulisnya.
    const rujukan = kenaliRujukan("Pasal 82 ayat (1) dan ayat (4) Undang-Undang Nomor 7 tahun 1989");
    expect(rujukan[0].ayat).toBe("1, 4");
  });

  it("huruf ikut terbaca", () => {
    const rujukan = kenaliRujukan("Pasal 4 Ayat 2 Huruf b Peraturan Mahkamah Agung Nomor 1 Tahun 2016");
    expect(rujukan[0].ayat).toBe("2");
    expect(rujukan[0].huruf).toBe("b");
    expect(jangkarRujukan(rujukan[0])).toBe("perma-1-2016/pasal-4/ayat-2/huruf-b");
  });

  it("alinea tanpa rujukan menghasilkan kosong", () => {
    expect(kenaliRujukan(pecahPertimbangan(NASKAH)[0].teks)).toEqual([]);
  });
});

describe("menautkan rujukan ke pustaka hukum", () => {
  it("nama peraturan menjadi nama pendek yang sama dengan jangkar pustaka", () => {
    expect(slugDariSebutan("Undang-Undang Nomor 1 tahun 1974")).toBe("uu-1-1974");
    expect(slugDariSebutan("Peraturan Pemerintah Nomor 9 tahun 1975")).toBe("pp-9-1975");
    expect(slugDariSebutan("Peraturan Mahkamah Agung Republik Indonesia Nomor 1 Tahun 2016")).toBe("perma-1-2016");
    expect(slugDariSebutan("RBg")).toBe("rbg");
    expect(slugDariSebutan("Kompilasi Hukum Islam")).toBe("khi");
  });

  it("peraturan yang tidak dikenali TIDAK ditebak", () => {
    // Rujukan yang mengarah ke peraturan yang keliru lebih berbahaya daripada
    // rujukan yang belum tersambung: yang kedua terlihat, yang pertama tidak.
    expect(slugDariSebutan("Peraturan Daerah Kabupaten Sesuatu")).toBe("");
    expect(slugDariSebutan("")).toBe("");
    expect(jangkarRujukan({ tertulis: "Pasal 19", pasal: "19", ayat: "", huruf: "", peraturan: "" })).toBe("");
  });

  it("hanya ayat pertama yang masuk jangkar", () => {
    // Rujukan "ayat (1) dan ayat (4)" menunjuk dua tempat, dan satu alamat
    // tidak dapat mewakili keduanya.
    const rujukan = kenaliRujukan("Pasal 82 ayat (1) dan ayat (4) Undang-Undang Nomor 7 tahun 1989");
    expect(jangkarRujukan(rujukan[0])).toBe("uu-7-1989/pasal-82/ayat-1");
  });
});

describe("sidik butir", () => {
  it("alinea yang sama dengan nama pihak berbeda bersidik SAMA", () => {
    // Tanpa ini, alinea yang bunyinya persis sama pada dua ratus putusan
    // menghasilkan dua ratus butir - dan pustaka menjadi salinan putusan.
    const satu = "Menimbang, bahwa Reka Febrianti binti Rajab telah hadir pada 1 September 2026 dalam perkara 551/Pdt.G/2026/PA.Dgl;";
    const dua = "Menimbang, bahwa Sitti Aminah binti Umar telah hadir pada 15 Oktober 2025 dalam perkara 120/Pdt.G/2025/PA.Dgl;";
    expect(sidikButir(satu)).toBe(sidikButir(dua));
  });

  it("alinea yang bunyinya berbeda bersidik berbeda", () => {
    expect(sidikButir("Menimbang, bahwa gugatan dikabulkan;")).not.toBe(
      sidikButir("Menimbang, bahwa gugatan ditolak;")
    );
  });

  it("beda huruf besar-kecil dan tanda baca tidak membedakan", () => {
    expect(sidikButir("Menimbang, bahwa hal itu terbukti;")).toBe(sidikButir("MENIMBANG BAHWA HAL ITU TERBUKTI"));
  });
});

describe("tempat kosong", () => {
  it("nama orang dikenali, sebutan peran tidak", () => {
    // Sebutan peran memang bagian dari bunyi pertimbangan dan tidak perlu
    // diganti; yang perlu ditandai justru bila nama orang muncul, karena itu
    // tanda alineanya belum siap dipakai ulang.
    const kosong = kenaliTempatKosong("Menimbang, bahwa Penggugat bernama Reka Febrianti telah hadir;");
    const nama = kosong.filter((item) => item.jenis === "nama").map((item) => item.nilai);

    expect(nama).toContain("Reka Febrianti");
    expect(nama).not.toContain("Penggugat");
  });

  it("nama peraturan tidak dianggap nama orang", () => {
    const kosong = kenaliTempatKosong("sebagaimana Undang-Undang Nomor 1 tahun 1974 dan Peraturan Pemerintah");
    expect(kosong.filter((item) => item.jenis === "nama")).toEqual([]);
  });

  it("tanggal dan nomor perkara dikenali", () => {
    const kosong = kenaliTempatKosong("pada tanggal 15 September 2026 dalam perkara 551/Pdt.G/2026/PA.Dgl");
    expect(kosong).toContainEqual({ jenis: "tanggal", nilai: "15 September 2026" });
    expect(kosong).toContainEqual({ jenis: "nomor", nilai: "551/Pdt.G/2026/PA.Dgl" });
  });

  it("alinea tanpa nama, tanggal, maupun nomor menghasilkan kosong", () => {
    expect(kenaliTempatKosong("Menimbang, bahwa gugatan tersebut beralasan menurut hukum;")).toEqual([]);
  });
});
