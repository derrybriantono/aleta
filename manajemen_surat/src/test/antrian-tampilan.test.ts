import { describe, expect, it } from "vitest";

import {
  type BarisAntrian,
  keMenit,
  perkiraanTunggu,
  selangPanggilan,
  warnaRuang,
} from "@/lib/antrian-tampilan";

/**
 * ============================================================================
 * PERKIRAAN WAKTU TUNGGU HARUS JUJUR
 * ============================================================================
 *
 * Ini keterangan yang paling dicari orang yang menunggu, dan paling mudah
 * dikarang. Angka yang meleset membuat orang pergi lalu kehilangan gilirannya
 * - akibatnya nyata, bukan sekadar tampilan yang keliru.
 *
 * Maka yang dijaga di sini bukan "rumusnya benar", melainkan KAPAN ANGKANYA
 * TIDAK BOLEH MUNCUL SAMA SEKALI.
 */

function baris(sebagian: Partial<BarisAntrian>): BarisAntrian {
  return {
    nomor: null,
    keadaan: "menunggu",
    jamPanggil: "",
    waktuAmbil: "",
    noRuang: null,
    ...sebagian,
  };
}

describe("selang antar panggilan", () => {
  it("belum dapat diukur bila baru satu nomor dipanggil", () => {
    // Satu panggilan tidak menghasilkan JARAK. Menebak angka di sini adalah
    // mengarang, dan orang yang mempercayainya akan pergi terlalu jauh.
    const daftar = [
      baris({ nomor: 1, keadaan: "dipanggil", jamPanggil: "09:00" }),
      baris({ nomor: 2, keadaan: "menunggu" }),
    ];
    expect(selangPanggilan(daftar)).toBeNull();
  });

  it("diukur dari jarak nyata antar panggilan", () => {
    const daftar = [
      baris({ nomor: 1, keadaan: "dipanggil", jamPanggil: "09:00" }),
      baris({ nomor: 2, keadaan: "dipanggil", jamPanggil: "09:10" }),
      baris({ nomor: 3, keadaan: "dipanggil", jamPanggil: "09:20" }),
    ];
    expect(selangPanggilan(daftar)).toBe(10);
  });

  it("memakai nilai tengah, bukan rata-rata", () => {
    // Satu perkara yang berlangsung lama - pembuktian dengan banyak saksi -
    // tidak boleh menarik seluruh perkiraan. Jarak: 5, 5, 60.
    const daftar = [
      baris({ nomor: 1, keadaan: "dipanggil", jamPanggil: "09:00" }),
      baris({ nomor: 2, keadaan: "dipanggil", jamPanggil: "09:05" }),
      baris({ nomor: 3, keadaan: "dipanggil", jamPanggil: "09:10" }),
      baris({ nomor: 4, keadaan: "dipanggil", jamPanggil: "10:10" }),
    ];
    // Rata-rata akan 23 menit; nilai tengahnya 5.
    expect(selangPanggilan(daftar)).toBe(5);
  });

  it("mengabaikan jarak yang bukan laju pelayanan", () => {
    // Jarak nol berarti dua nomor dipanggil berbarengan, bukan dilayani dalam
    // nol menit. Jarak lebih dari dua jam biasanya jeda istirahat.
    const daftar = [
      baris({ nomor: 1, keadaan: "dipanggil", jamPanggil: "09:00" }),
      baris({ nomor: 2, keadaan: "dipanggil", jamPanggil: "09:00" }),
      baris({ nomor: 3, keadaan: "dipanggil", jamPanggil: "09:12" }),
      baris({ nomor: 4, keadaan: "dipanggil", jamPanggil: "13:00" }),
    ];
    expect(selangPanggilan(daftar)).toBe(12);
  });

  it("tidak terpengaruh urutan masukan", () => {
    const daftar = [
      baris({ nomor: 3, keadaan: "dipanggil", jamPanggil: "09:20" }),
      baris({ nomor: 1, keadaan: "dipanggil", jamPanggil: "09:00" }),
      baris({ nomor: 2, keadaan: "dipanggil", jamPanggil: "09:10" }),
    ];
    expect(selangPanggilan(daftar)).toBe(10);
  });
});

describe("perkiraan tunggu", () => {
  const contoh = [
    baris({ nomor: 1, keadaan: "dipanggil", jamPanggil: "09:00" }),
    baris({ nomor: 2, keadaan: "dipanggil", jamPanggil: "09:10" }),
    baris({ nomor: 3, keadaan: "menunggu" }),
    baris({ nomor: 4, keadaan: "menunggu" }),
    baris({ nomor: 5, keadaan: "menunggu" }),
  ];

  it("menghitung posisi dari yang MASIH menunggu", () => {
    // Nomor 1 dan 2 sudah dipanggil - keduanya tidak lagi mengantre. Nomor 5
    // karena itu punya dua orang di depannya, bukan empat.
    const hasil = perkiraanTunggu(contoh, 5);
    expect(hasil?.posisi).toBe(2);
  });

  it("mengalikan posisi dengan laju nyata", () => {
    const hasil = perkiraanTunggu(contoh, 5);
    expect(hasil?.menit).toBe(20);
    expect(hasil?.kalimat).toContain("20 menit");
  });

  it("menyebut 'Anda berikutnya' tanpa angka menit", () => {
    const hasil = perkiraanTunggu(contoh, 3);
    expect(hasil?.posisi).toBe(0);
    expect(hasil?.kalimat).toBe("Anda berikutnya");
  });

  it("menyebut jumlah antrian saja bila lajunya belum terukur", () => {
    // Satu panggilan - belum ada jarak. Yang PASTI tetap disebutkan; yang
    // tidak pasti tidak.
    const belumTerukur = [
      baris({ nomor: 1, keadaan: "dipanggil", jamPanggil: "09:00" }),
      baris({ nomor: 2, keadaan: "menunggu" }),
      baris({ nomor: 3, keadaan: "menunggu" }),
    ];
    const hasil = perkiraanTunggu(belumTerukur, 3);
    expect(hasil?.menit).toBeNull();
    expect(hasil?.kalimat).toContain("1 antrian lagi");
    expect(hasil?.kalimat).not.toContain("menit");
  });

  it("dijawab null untuk nomor yang tidak sah", () => {
    expect(perkiraanTunggu(contoh, null)).toBeNull();
  });

  it("dapat dibatasi pada satu ruang", () => {
    const duaRuang = [
      baris({ nomor: 1, keadaan: "dipanggil", jamPanggil: "09:00", noRuang: 1 }),
      baris({ nomor: 2, keadaan: "dipanggil", jamPanggil: "09:10", noRuang: 1 }),
      baris({ nomor: 3, keadaan: "menunggu", noRuang: 2 }),
      baris({ nomor: 4, keadaan: "menunggu", noRuang: 1 }),
      baris({ nomor: 5, keadaan: "menunggu", noRuang: 1 }),
    ];
    // Di ruang 1, yang di depan nomor 5 hanya nomor 4 - antrean ruang 2 tidak
    // menghambat siapa pun di ruang 1.
    expect(perkiraanTunggu(duaRuang, 5, { ruang: 1 })?.posisi).toBe(1);
  });
});

describe("jam dan warna", () => {
  it("membaca jam dinding menjadi menit", () => {
    expect(keMenit("09:35")).toBe(575);
    expect(keMenit("00:00")).toBe(0);
  });

  it("menolak yang bukan jam", () => {
    expect(keMenit("")).toBeNull();
    expect(keMenit("kemarin")).toBeNull();
  });

  it("memberi warna yang TETAP untuk ruang yang sama", () => {
    // Warna yang berpindah antar layar membuat petugas kehilangan kebiasaan
    // membacanya - itulah sebabnya ia dikumpulkan di satu tempat.
    expect(warnaRuang(2).aksen).toBe(warnaRuang(2).aksen);
    expect(warnaRuang(1).aksen).not.toBe(warnaRuang(2).aksen);
  });

  it("ruang yang tidak diketahui tetap punya warna netral", () => {
    expect(warnaRuang(null).aksen).toBeTruthy();
    expect(warnaRuang(0).aksen).toBe(warnaRuang(null).aksen);
  });
});
