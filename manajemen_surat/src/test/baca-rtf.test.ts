// @vitest-environment node

import { describe, expect, it } from "vitest";

import { bacaRtf, bacaRtfDariBita, tampakRtf } from "@/lib/baca-rtf";

/**
 * Pembacaan RTF.
 *
 * Yang dijaga di sini satu hal: naskah putusan yang masuk ke borang SIPP
 * harus sama persis dengan yang tertulis di berkasnya. Kesalahan penguraian
 * tidak berhenti sebagai tampilan yang jelek - ia tersimpan sebagai amar.
 */
describe("bacaRtf", () => {
  it("mengenali berkas RTF dari kepalanya", () => {
    expect(tampakRtf("{\\rtf1\\ansi hai}")).toBe(true);
    expect(tampakRtf("%PDF-1.7")).toBe(false);
    expect(tampakRtf("PUTUSAN")).toBe(false);
  });

  it("memetik teks dan menjadikan \\par sebagai batas paragraf", () => {
    expect(bacaRtf("{\\rtf1\\ansi Baris satu\\par Baris dua\\par Baris tiga}")).toBe(
      "Baris satu\nBaris dua\nBaris tiga"
    );
  });

  it("membuang tabel fon, supaya namanya tidak masuk ke naskah", () => {
    // Tanpa penyaringan ini, "Times New Roman" menjadi kalimat pembuka
    // putusan - dan itu benar-benar terbaca sebagai bagian kepala.
    const rtf =
      "{\\rtf1\\ansi{\\fonttbl{\\f0\\froman Times New Roman;}{\\f1\\fnil SimSun;}}" +
      "{\\colortbl;\\red0\\green0\\blue0;}PUTUSAN\\par Nomor 1}";
    expect(bacaRtf(rtf)).toBe("PUTUSAN\nNomor 1");
  });

  it("membuang kelompok {\\*\\...} yang memang bukan naskah", () => {
    expect(bacaRtf("{\\rtf1\\ansi {\\*\\generator Writer}Isi sebenarnya}")).toBe("Isi sebenarnya");
  });

  it("menerjemahkan larian \\'xx menurut cp1252", () => {
    // Templat putusan memakai apostrof miring pada "ba'in" dan "syar'i".
    // Tanpa peta cp1252, 0x92 terbaca sebagai aksara kendali.
    expect(bacaRtf("{\\rtf1\\ansi talak ba\\'92in shughra}")).toBe("talak ba’in shughra");
    expect(bacaRtf("{\\rtf1\\ansi Rp199.000,00 \\'96 lunas}")).toBe("Rp199.000,00 – lunas");
  });

  it("memakai \\u dan melewati aksara cadangannya sebanyak uc", () => {
    // 舗 diikuti cadangan "'" yang harus dibuang - kalau tidak, tiap
    // apostrof miring menjadi dua aksara.
    expect(bacaRtf("{\\rtf1\\ansi\\uc1 ba\\u8217'in}")).toBe("ba’in");
    // uc0 berarti tidak ada cadangan sama sekali.
    expect(bacaRtf("{\\rtf1\\ansi\\uc0 ba\\u8217 in}")).toBe("ba’in");
  });

  it("mengembalikan uc ketika kelompoknya ditutup", () => {
    // uc berlaku per kelompok. Membiarkannya bocor keluar membuat huruf
    // pertama kata sesudahnya raib satu per satu.
    expect(bacaRtf("{\\rtf1\\ansi\\uc1 {\\uc0 \\u65 }\\u66 Xsesudah}")).toBe("ABsesudah");
  });

  it("mengabaikan baris baru mentah - yang menandai paragraf hanya \\par", () => {
    // Berkas RTF dibungkus supaya barisnya tidak terlalu panjang. Membaca
    // bungkus itu sebagai paragraf akan memecah satu pertimbangan menjadi
    // lima - persis kerusakan yang membuat PDF tidak dipakai di sini.
    //
    // Menurut spesifikasinya, CR dan LF mentah TIDAK menghasilkan apa pun:
    // hanya "\<baris baru>" yang berarti paragraf. Word memutus barisnya
    // sesudah spasi atau sesudah kata kendali, jadi spasi antar katanya
    // memang sudah ada di dalam teksnya sendiri - bukan disimpulkan dari
    // tempat putusnya.
    expect(bacaRtf("{\\rtf1\\ansi Menimbang, bahwa \nmaksud dan tujuan \ngugatan;}")).toBe(
      "Menimbang, bahwa maksud dan tujuan gugatan;"
    );
    // Yang diawali garis miring memang paragraf.
    expect(bacaRtf("{\\rtf1\\ansi Baris satu\\\nBaris dua}")).toBe("Baris satu\nBaris dua");
  });

  it("melarikan kurung kurawal dan garis miring", () => {
    expect(bacaRtf("{\\rtf1\\ansi Pasal 1 \\{a\\} dan \\\\ lainnya}")).toBe("Pasal 1 {a} dan \\ lainnya");
  });

  it("melompati data biner \\bin apa adanya", () => {
    expect(bacaRtf("{\\rtf1\\ansi sebelum {\\*\\shppict\\bin5 ABCDE}sesudah}")).toBe("sebelum sesudah");
  });

  it("membaca dari bita tanpa merusak larian \\'xx", () => {
    // Bita 0x92 bukan UTF-8 yang sah. Mendekodenya sebagai UTF-8 lebih dahulu
    // akan menggantinya dengan aksara pengganti sebelum sempat diurai.
    const bita = new Uint8Array([...'{\\rtf1\\ansi ba\\\'92in}'].map((h) => h.charCodeAt(0)));
    expect(bacaRtfDariBita(bita)).toBe("ba’in");
  });

  it("tidak tersedak berkas besar", () => {
    // String.fromCharCode(...bita) pada berkas 195 KB melampaui batas
    // tumpukan bila tidak dipotong - dan putusan memang sebesar itu.
    const panjang = "Menimbang, bahwa ".repeat(12000);
    const bita = new Uint8Array([...`{\\rtf1\\ansi ${panjang}}`].map((h) => h.charCodeAt(0)));
    expect(bacaRtfDariBita(bita).length).toBeGreaterThan(190_000);
  });
});
