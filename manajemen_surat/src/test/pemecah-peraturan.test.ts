// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  jangkarBagian,
  pecahPeraturan,
  periksaPecahan,
  romawiKeAngka,
  sebutanBagian,
  type HalamanNaskah,
} from "@/server/modules/aleta-ecourt/pemecah-peraturan";

/**
 * Pemecah naskah peraturan menjadi pasal dan ayat.
 *
 * ============================================================================
 * CONTOH DI SINI MENGUJI SUSUNAN, BUKAN MENYATAKAN HUKUM
 * ============================================================================
 *
 * Bunyi pasal pada contoh di bawah SENGAJA dibuat umum dan tidak menyalin
 * naskah peraturan mana pun. Yang diuji susunannya - BAB, Bagian, Pasal, ayat,
 * huruf - bukan isinya.
 *
 * Naskah yang sesungguhnya masuk pustaka selalu berasal dari berkas resmi yang
 * dibaca modul PDF, tidak pernah dari uji ini dan tidak pernah dari ingatan.
 *
 * ============================================================================
 * YANG DIJAGA
 * ============================================================================
 *
 * Dua kekeliruan yang tidak terlihat sampai ada yang mencari:
 *
 *   - baris yang tidak dikenali DIBUANG, sehingga pustaka menyimpan naskah
 *     yang lebih pendek daripada aslinya; dan
 *   - jangkar berubah saat naskah yang sama diurai ulang, sehingga rujukan
 *     pada putusan lama menunjuk ke tempat yang keliru.
 */

const NASKAH: HalamanNaskah[] = [
  {
    nomor: 3,
    teks: [
      "BAB I",
      "KETENTUAN UMUM",
      "Pasal 1",
      "Dalam ketentuan ini yang dimaksud dengan istilah tertentu adalah sebagaimana diuraikan berikut.",
      "Pasal 2",
      "(1) Ketentuan pertama berlaku sebagaimana diatur pada bagian ini.",
      "(2) Ketentuan kedua berlaku dengan syarat sebagai berikut:",
      "a. syarat pertama yang harus dipenuhi;",
      "b. syarat kedua yang harus dipenuhi.",
      "- 3 -",
    ].join("\n"),
  },
  {
    nomor: 4,
    teks: [
      "BAB II",
      "KETENTUAN LANJUTAN",
      "Bagian Kesatu",
      "Tata Cara",
      "Pasal 3",
      "(1) Tata cara dilaksanakan menurut urutan yang ditetapkan.",
      "Kalimat lanjutan yang menyambung ayat sebelumnya tanpa penomoran.",
      "Pasal 4",
      "Ketentuan penutup berlaku sejak tanggal ditetapkan.",
    ].join("\n"),
  },
];

describe("memecah susunan naskah", () => {
  it("bab, bagian, pasal, ayat, dan huruf dikenali", () => {
    const bagian = pecahPeraturan(NASKAH);
    const jenis = bagian.map((item) => item.jenis);

    expect(jenis).toContain("bab");
    expect(jenis).toContain("bagian");
    expect(jenis).toContain("pasal");
    expect(jenis).toContain("ayat");
    expect(jenis).toContain("huruf");
  });

  it("judul bab terbaca dari baris sesudahnya", () => {
    const bab = pecahPeraturan(NASKAH).filter((item) => item.jenis === "bab");
    expect(bab[0].nomor).toBe("I");
    expect(bab[0].isi).toContain("KETENTUAN UMUM");
  });

  it("ayat berinduk pada pasalnya, huruf berinduk pada ayatnya", () => {
    const bagian = pecahPeraturan(NASKAH);
    const pasal2 = bagian.find((item) => item.jenis === "pasal" && item.nomor === "2")!;
    const ayat2 = bagian.find((item) => item.jenis === "ayat" && item.nomor === "2" && item.indukUrutan === pasal2.urutan)!;
    const hurufA = bagian.find((item) => item.jenis === "huruf" && item.nomor === "a")!;

    expect(ayat2.indukUrutan).toBe(pasal2.urutan);
    expect(hurufA.indukUrutan).toBe(ayat2.urutan);
  });

  it("pasal baru melupakan ayat pasal sebelumnya sebagai induk", () => {
    // Tanpa ini, ayat Pasal 3 akan berinduk pada ayat terakhir Pasal 2.
    const bagian = pecahPeraturan(NASKAH);
    const pasal3 = bagian.find((item) => item.jenis === "pasal" && item.nomor === "3")!;
    const ayatPasal3 = bagian.find(
      (item) => item.jenis === "ayat" && item.indukUrutan === pasal3.urutan
    );

    expect(ayatPasal3).toBeDefined();
    expect(ayatPasal3?.nomor).toBe("1");
  });

  it("halaman asal tiap bagian tercatat", () => {
    const bagian = pecahPeraturan(NASKAH);
    expect(bagian.find((item) => item.jenis === "pasal" && item.nomor === "1")?.halaman).toBe(3);
    expect(bagian.find((item) => item.jenis === "pasal" && item.nomor === "4")?.halaman).toBe(4);
  });
});

describe("yang tidak dikenali tidak dibuang", () => {
  it("baris tanpa penomoran menyambung bagian sebelumnya", () => {
    // Membuangnya berarti pustaka menyimpan naskah yang lebih pendek daripada
    // aslinya, dan tidak ada yang menyadarinya sampai ada yang mencarinya.
    const bagian = pecahPeraturan(NASKAH);
    const ayat = bagian.find((item) => item.jenis === "ayat" && item.isi.includes("Tata cara dilaksanakan"))!;
    expect(ayat.isi).toContain("Kalimat lanjutan yang menyambung");
  });

  it("naskah tanpa satu pun penomoran tetap tersimpan sebagai pembuka", () => {
    const bagian = pecahPeraturan([{ nomor: 1, teks: "Naskah bebas tanpa penomoran apa pun." }]);
    expect(bagian).toHaveLength(1);
    expect(bagian[0].jenis).toBe("pembuka");
    expect(bagian[0].isi).toContain("Naskah bebas");
  });

  it("nomor halaman dan garis pemisah tidak ikut menjadi isi pasal", () => {
    // Bunyi pasal yang tercemar angka halaman akan dikutip apa adanya ke dalam
    // putusan.
    const bagian = pecahPeraturan(NASKAH);
    for (const item of bagian) {
      expect(item.isi, `bagian ${item.jenis} ${item.nomor}`).not.toMatch(/(^|\s)-\s*\d+\s*-($|\s)/);
    }
  });

  it("huruf di luar ayat tidak dianggap penomoran", () => {
    // "a." di awal baris jauh lebih sering awal kalimat biasa daripada
    // penomoran, bila tidak ada ayat yang sedang berjalan.
    const bagian = pecahPeraturan([
      { nomor: 1, teks: "Pasal 9\na. n. Direktur Jenderal menetapkan hal tersebut." },
    ]);
    expect(bagian.some((item) => item.jenis === "huruf")).toBe(false);
  });
});

describe("jangkar kutipan", () => {
  it("sama setiap kali naskah yang sama diurai ulang", () => {
    // Jangkar yang berubah membuat seluruh rujukan pada putusan lama menunjuk
    // ke tempat yang keliru, atau ke tempat yang tidak ada.
    const sekali = pecahPeraturan(NASKAH);
    const duakali = pecahPeraturan(NASKAH);

    const dari = (bagian: typeof sekali) =>
      bagian.filter((item) => item.jenis !== "bab" && item.jenis !== "bagian").map((item) => jangkarBagian("uu-uji", item, bagian));

    expect(dari(sekali)).toEqual(dari(duakali));
  });

  it("memuat pasal, ayat, dan hurufnya", () => {
    const bagian = pecahPeraturan(NASKAH);
    const hurufB = bagian.find((item) => item.jenis === "huruf" && item.nomor === "b")!;
    expect(jangkarBagian("uu-uji", hurufB, bagian)).toBe("uu-uji/pasal-2/ayat-2/huruf-b");
  });

  it("bab dan bagian TIDAK ikut ke dalam jangkar", () => {
    // Penataan ulang naskah sering menggeser pasal ke bab lain tanpa mengubah
    // nomor maupun bunyinya; jangkar yang memuat babnya akan berubah padahal
    // pasalnya sama.
    const bagian = pecahPeraturan(NASKAH);
    const pasal3 = bagian.find((item) => item.jenis === "pasal" && item.nomor === "3")!;
    expect(jangkarBagian("uu-uji", pasal3, bagian)).toBe("uu-uji/pasal-3");
  });
});

describe("sebutan untuk naskah putusan", () => {
  it("ditulis seperti yang dipakai pertimbangan hukum", () => {
    const bagian = pecahPeraturan(NASKAH);
    const hurufB = bagian.find((item) => item.jenis === "huruf" && item.nomor === "b")!;
    expect(sebutanBagian(hurufB, bagian)).toBe("Pasal 2 ayat (2) huruf b");
  });

  it("pasal tanpa ayat disebut pasalnya saja", () => {
    const bagian = pecahPeraturan(NASKAH);
    const pasal4 = bagian.find((item) => item.jenis === "pasal" && item.nomor === "4")!;
    expect(sebutanBagian(pasal4, bagian)).toBe("Pasal 4");
  });
});

describe("memeriksa hasil pemecahan", () => {
  it("nomor pasal yang melompat dilaporkan", () => {
    // Hampir selalu berarti halaman yang gagal terurai - dan pustaka yang
    // kehilangan Pasal 40 tanpa ada yang tahu lebih berbahaya daripada pustaka
    // yang kosong.
    const bagian = pecahPeraturan([{ nomor: 1, teks: "Pasal 1\nSatu.\nPasal 4\nEmpat." }]);
    expect(periksaPecahan(bagian).pasalHilang).toEqual(["2", "3"]);
  });

  it("naskah yang utuh tidak melaporkan pasal hilang", () => {
    expect(periksaPecahan(pecahPeraturan(NASKAH)).pasalHilang).toEqual([]);
  });

  it("jumlah pasal dan ayat terhitung", () => {
    const ringkas = periksaPecahan(pecahPeraturan(NASKAH));
    expect(ringkas.jumlahPasal).toBe(4);
    expect(ringkas.jumlahAyat).toBe(3);
  });
});

describe("angka Romawi", () => {
  it("bab diurutkan dengan benar", () => {
    expect(romawiKeAngka("I")).toBe(1);
    expect(romawiKeAngka("IV")).toBe(4);
    expect(romawiKeAngka("IX")).toBe(9);
    expect(romawiKeAngka("XIV")).toBe(14);
    expect(romawiKeAngka("XL")).toBe(40);
  });
});

/**
 * Tiga cacat yang hanya muncul pada naskah resmi sungguhan.
 *
 * Ketiganya ditemukan saat menguraikan UU Nomor 1 Tahun 1974 dari
 * peraturan.go.id - bukan dari membayangkan bentuk naskah, melainkan dari
 * membacanya. Contoh di bawah menirukan bentuknya, bukan menyalin isinya.
 */
describe("cacat naskah resmi", () => {
  it("kata tangkap di kaki halaman tidak dibaca sebagai pasal", () => {
    // Naskah resmi mencetak judul halaman berikutnya di kaki halaman ini -
    // "Pasal 2 …" - supaya pembaca tahu apa yang menyusul. Membacanya sebagai
    // pasal menghasilkan pasal kembar berisi kosong, dan karena alamatnya sama
    // dengan pasal yang sesungguhnya, rujukan putusan dapat membuka yang
    // kosong. Pada UU 1/1974 saja ia menambah dua belas pasal yang tidak ada.
    const bagian = pecahPeraturan([
      { nomor: 1, teks: "Pasal 1\nKetentuan pertama.\nPasal 2 …" },
      { nomor: 2, teks: "Pasal 2\nKetentuan kedua." },
    ]);

    const pasal2 = bagian.filter((item) => item.jenis === "pasal" && item.nomor === "2");
    expect(pasal2).toHaveLength(1);
    expect(pasal2[0].isi).toContain("Ketentuan kedua");
  });

  it("kepala halaman yang berulang tidak masuk ke bunyi pasal", () => {
    // Bunyi pasal yang tercemar kepala halaman akan dikutip apa adanya ke dalam
    // putusan.
    const halaman = [1, 2, 3, 4].map((nomor) => ({
      nomor,
      teks: `PRESIDEN REPUBLIK INDONESIA\nPasal ${nomor}\nBunyi pasal ${nomor}.`,
    }));

    for (const item of pecahPeraturan(halaman)) {
      expect(item.isi).not.toContain("PRESIDEN REPUBLIK INDONESIA");
    }
  });

  it("rujukan silang di tengah kalimat tidak dibaca sebagai pasal baru", () => {
    // Peraturan menomori pasalnya menaik. Nomor yang mundur bukan pasal baru
    // melainkan penyebutan pasal lain di dalam kalimat.
    const bagian = pecahPeraturan([
      {
        nomor: 1,
        teks: [
          "Pasal 8",
          "Ketentuan kedelapan berlaku.",
          "Pasal 3 ayat (2) ketentuan ini tetap berlaku sepanjang tidak bertentangan.",
        ].join("\n"),
      },
    ]);

    expect(bagian.filter((item) => item.jenis === "pasal")).toHaveLength(1);
    expect(bagian[0].isi).toContain("Pasal 3 ayat (2) ketentuan ini");
  });

  it("nomor pasal bersuffiks tetap dianggap maju", () => {
    // Pasal 19A menyusul Pasal 19; menganggapnya mundur akan membuangnya.
    const bagian = pecahPeraturan([{ nomor: 1, teks: "Pasal 19\nSembilan belas.\nPasal 19A\nSisipan." }]);
    expect(bagian.filter((item) => item.jenis === "pasal").map((item) => item.nomor)).toEqual(["19", "19A"]);
  });
});

describe("penjelasan berdiri di ruang alamatnya sendiri", () => {
  const NASKAH_BERPENJELASAN = [
    { nomor: 1, teks: "Pasal 1\nBunyi pasal satu.\nPasal 2\nBunyi pasal dua." },
    { nomor: 5, teks: "PENJELASAN\nPASAL DEMI PASAL\nPasal 1\nKeterangan atas pasal satu." },
  ];

  it("pasal penjelasan ditandai, batang tubuh tidak", () => {
    const bagian = pecahPeraturan(NASKAH_BERPENJELASAN);
    const batangTubuh = bagian.filter((item) => item.jenis === "pasal" && !item.penjelasan);
    const penjelasan = bagian.filter((item) => item.jenis === "pasal" && item.penjelasan);

    expect(batangTubuh.map((item) => item.nomor)).toEqual(["1", "2"]);
    expect(penjelasan.map((item) => item.nomor)).toEqual(["1"]);
  });

  it("alamatnya berbeda, sehingga rujukan tidak dapat tertukar", () => {
    // Tanpa ini, Pasal 1 dan penjelasan Pasal 1 beralamat sama - dan yang
    // terbuka adalah yang kebetulan tersimpan lebih dulu.
    const bagian = pecahPeraturan(NASKAH_BERPENJELASAN);
    const batangTubuh = bagian.find((item) => item.jenis === "pasal" && !item.penjelasan)!;
    const penjelasan = bagian.find((item) => item.jenis === "pasal" && item.penjelasan)!;

    expect(jangkarBagian("uu-1-1974", batangTubuh, bagian)).toBe("uu-1-1974/pasal-1");
    expect(jangkarBagian("uu-1-1974", penjelasan, bagian)).toBe("uu-1-1974/penjelasan/pasal-1");
  });

  it("sebutannya menyatakan bahwa ia penjelasan", () => {
    // Kutipan "Pasal 39 ayat (2)" yang ternyata dari penjelasannya, bukan dari
    // pasalnya, adalah kekeliruan yang tidak terlihat pada naskah putusan.
    const bagian = pecahPeraturan(NASKAH_BERPENJELASAN);
    const penjelasan = bagian.find((item) => item.jenis === "pasal" && item.penjelasan)!;
    expect(sebutanBagian(penjelasan, bagian)).toBe("Penjelasan Pasal 1");
  });

  it("penjelasan menomori ulang dari Pasal 1 tanpa dianggap rujukan silang", () => {
    // Bila penomoran batang tubuh dan penjelasan disatukan, seluruh penjelasan
    // akan terbaca sebagai rujukan silang dan hilang.
    const bagian = pecahPeraturan(NASKAH_BERPENJELASAN);
    expect(bagian.filter((item) => item.jenis === "pasal" && item.penjelasan)).toHaveLength(1);
  });

  it("pasal hilang dihitung hanya pada batang tubuh", () => {
    const ringkas = periksaPecahan(pecahPeraturan(NASKAH_BERPENJELASAN));
    expect(ringkas.jumlahPasal).toBe(2);
    expect(ringkas.jumlahPasalPenjelasan).toBe(1);
    expect(ringkas.pasalHilang).toEqual([]);
  });

  it("alamat ganda dilaporkan, bukan disembunyikan", () => {
    // Naskah resmi memang menghasilkannya. Yang membaca laporan penyerapan
    // berhak tahu sebelum mengesahkannya.
    const bagian = pecahPeraturan([
      { nomor: 1, teks: "Pasal 1\n(1) Satu.\n(1) Satu lagi." },
    ]);
    expect(periksaPecahan(bagian).jangkarGanda).toContain("x/pasal-1/ayat-1");
  });
});
