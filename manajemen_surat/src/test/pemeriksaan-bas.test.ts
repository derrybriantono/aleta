// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  periksaKesiapan,
  ringkasPemeriksaan,
  saksiDituntut,
  type BahanPeriksa,
  type LembarRingkas,
} from "@/lib/pemeriksaan-bas";

/**
 * Pemeriksaan kelengkapan sebelum naskah dicetak.
 *
 * ============================================================================
 * YANG DIJAGA DI SINI
 * ============================================================================
 *
 * Pemeriksaan yang MELEWATKAN kekurangan lebih berbahaya daripada tidak ada
 * pemeriksaan sama sekali: yang membacanya berhenti memeriksa sendiri, lalu
 * naskah yang kurang ditandatangani karena ALETA berkata tidak ada temuan.
 *
 * Karena itu yang diuji paling keras bukan "menemukan sesuatu", melainkan
 * tidak melewatkan saksi yang kurang, jati diri yang kosong, dan sumpah yang
 * belum dapat ditentukan.
 */

function lembar(sebagian: Partial<LembarRingkas> & { saksiKe: number }): LembarRingkas {
  return {
    saksiNama: "Sitti Aminah",
    saksiUmur: "42",
    saksiAgama: "Islam",
    jumlahPertanyaan: 16,
    jumlahTerjawab: 16,
    ...sebagian,
  };
}

function bahan(sebagian: Partial<BahanPeriksa> = {}): BahanPeriksa {
  return {
    tersisa: [],
    namaPenanda: {},
    penandaBlangko: ["0001", "1197", "5058"],
    lembar: [lembar({ saksiKe: 1 })],
    namaBlangko: "[01b] (E-Court) BAS 2 P Hadir & T Tidak Hadir Pokok Perkara - Putusan Verstek.rtf",
    nomorSidang: 2,
    sidangTercatat: true,
    kehadiranTercatat: true,
    blangkoMenanyakanKehadiran: false,
    selisih: [],
    ...sebagian,
  };
}

describe("berapa saksi yang dituntut blangko", () => {
  it("terbaca dari nama berkasnya", () => {
    expect(saksiDituntut("[09] (E-Court) BAS 2 ... - Putusan Verstek - (3 Saksi).rtf", [])).toBe(3);
    expect(saksiDituntut("[09] ... (4 Saksi).rtf", [])).toBe(4);
  });

  it("terbaca dari tempat tanya-jawab di dalamnya", () => {
    // 5058 tempat saksi pertama, 5059 saksi kedua - dari abt_variabel.
    expect(saksiDituntut("BAS tanpa angka.rtf", ["5058", "5059"])).toBe(2);
    expect(saksiDituntut("BAS tanpa angka.rtf", ["5058"])).toBe(1);
  });

  it("yang terbesar yang dipakai, bukan yang terkecil", () => {
    // Mengambil yang terkecil berarti kekurangan saksi lolos tanpa disebut.
    expect(saksiDituntut("[09] ... (3 Saksi).rtf", ["5058"])).toBe(3);
    expect(saksiDituntut("BAS biasa.rtf", ["5058", "5059"])).toBe(2);
  });

  it("blangko yang tidak menuntut saksi menghasilkan nol", () => {
    expect(saksiDituntut("[01] [Kabul Verstek] Cerai (Format Lengkap).rtf", ["0001", "0046"])).toBe(0);
  });
});

describe("saksi yang kurang", () => {
  it("blangko tiga saksi dengan dua lembar terisi menghasilkan halangan", () => {
    const temuan = periksaKesiapan(
      bahan({
        namaBlangko: "[09] (E-Court) BAS 2 P Hadir & T Tidak Hadir - Putusan Verstek - (3 Saksi).rtf",
        lembar: [lembar({ saksiKe: 1 }), lembar({ saksiKe: 2 })],
      })
    );

    const kurang = temuan.find((item) => item.hal.includes("Keterangan saksi belum lengkap"));
    expect(kurang?.tingkat).toBe("halangan");
    expect(kurang?.keterangan).toContain("3 saksi");
    expect(kurang?.keterangan).toContain("terisi 2");
  });

  it("lembar yang ada tetapi belum satu pun terjawab tidak dihitung terisi", () => {
    // Lembar kosong yang dihitung berarti pemeriksaan menyatakan cukup atas
    // saksi yang keterangannya belum ada sama sekali.
    const temuan = periksaKesiapan(
      bahan({
        penandaBlangko: ["5058", "5059"],
        lembar: [lembar({ saksiKe: 1 }), lembar({ saksiKe: 2, jumlahTerjawab: 0 })],
      })
    );
    expect(temuan.some((item) => item.tingkat === "halangan" && item.hal.includes("Keterangan saksi"))).toBe(true);
  });

  it("saksi cukup tidak menghasilkan halangan", () => {
    const temuan = periksaKesiapan(
      bahan({ penandaBlangko: ["5058", "5059"], lembar: [lembar({ saksiKe: 1 }), lembar({ saksiKe: 2 })] })
    );
    expect(temuan.some((item) => item.tingkat === "halangan")).toBe(false);
  });
});

describe("jati diri saksi", () => {
  it("nama, umur, atau agama yang kosong menghasilkan halangan", () => {
    const temuan = periksaKesiapan(bahan({ lembar: [lembar({ saksiKe: 1, saksiNama: "", saksiUmur: "" })] }));
    const kurang = temuan.find((item) => item.hal.includes("Jati diri saksi ke-1"));

    expect(kurang?.tingkat).toBe("halangan");
    expect(kurang?.keterangan).toContain("nama");
    expect(kurang?.keterangan).toContain("umur");
  });

  it("lembar yang belum diisi sama sekali tidak diperiksa jati dirinya", () => {
    // Lembar yang belum disentuh bukan kekurangan - ia belum dikerjakan.
    const temuan = periksaKesiapan(
      bahan({ penandaBlangko: ["0001"], lembar: [lembar({ saksiKe: 1, saksiNama: "", jumlahTerjawab: 0 })] })
    );
    expect(temuan.some((item) => item.hal.includes("Jati diri"))).toBe(false);
  });

  it("agama kosong pada blangko bersumpah menghasilkan peringatan tersendiri", () => {
    const temuan = periksaKesiapan(
      bahan({ penandaBlangko: ["5058", "7029"], lembar: [lembar({ saksiKe: 1, saksiAgama: "" })] })
    );
    const sumpah = temuan.find((item) => item.hal.includes("Lafal sumpah"));
    expect(sumpah?.tingkat).toBe("peringatan");
  });

  it("blangko tanpa sumpah tidak memperingatkan lafalnya", () => {
    const temuan = periksaKesiapan(
      bahan({ penandaBlangko: ["5058"], lembar: [lembar({ saksiKe: 1, saksiAgama: "" })] })
    );
    expect(temuan.some((item) => item.hal.includes("Lafal sumpah"))).toBe(false);
  });
});

describe("kehadiran para pihak", () => {
  it("blangko yang menanyakan kehadiran tanpa catatannya menghasilkan halangan", () => {
    const temuan = periksaKesiapan(
      bahan({ penandaBlangko: ["1072", "1073"], blangkoMenanyakanKehadiran: true, kehadiranTercatat: false })
    );
    const kehadiran = temuan.find((item) => item.hal.includes("Kehadiran para pihak"));
    expect(kehadiran?.tingkat).toBe("halangan");
  });

  it("blangko yang tidak menanyakan kehadiran tidak diperingatkan", () => {
    // Blangko putusan tidak memuat penanda kehadiran. Memperingatkan kekosongan
    // yang memang tidak diminta hanya menambah bunyi pada daftar.
    const temuan = periksaKesiapan(bahan({ blangkoMenanyakanKehadiran: false, kehadiranTercatat: false }));
    expect(temuan.some((item) => item.hal.includes("Kehadiran para pihak"))).toBe(false);
  });

  it("kehadiran yang sudah dicatat tidak menghasilkan temuan", () => {
    const temuan = periksaKesiapan(bahan({ blangkoMenanyakanKehadiran: true, kehadiranTercatat: true }));
    expect(temuan.some((item) => item.hal.includes("Kehadiran para pihak"))).toBe(false);
  });
});

describe("sidang dan selisih", () => {
  it("sidang yang belum tercatat diperingatkan", () => {
    const temuan = periksaKesiapan(bahan({ nomorSidang: 3, sidangTercatat: false }));
    const sidang = temuan.find((item) => item.hal.includes("Sidang ke-3"));
    expect(sidang?.tingkat).toBe("peringatan");
  });

  it("blangko yang bukan BAS tidak diperiksa sidangnya", () => {
    const temuan = periksaKesiapan(bahan({ nomorSidang: 0, sidangTercatat: false }));
    expect(temuan.some((item) => item.hal.includes("Sidang ke-"))).toBe(false);
  });

  it("selisih antar sumber ikut dilaporkan di sini", () => {
    const temuan = periksaKesiapan(
      bahan({ selisih: [{ hal: "Jumlah saksi", keterangan: "SIPP mencatat nol, ABT memuat lima." }] })
    );
    const selisih = temuan.find((item) => item.hal === "Jumlah saksi");
    expect(selisih?.tingkat).toBe("peringatan");
  });
});

describe("penanda yang tersisa", () => {
  it("disebut dengan namanya, bukan nomornya", () => {
    const temuan = periksaKesiapan(
      bahan({
        tersisa: ["4001", "8505"],
        namaPenanda: { "4001": "AMAR PUTUSAN CERAI UNIVERSAL", "8505": "AMAR BIAYA PERKARA (PRODEO/TIDAK)" },
      })
    );
    const sisa = temuan.find((item) => item.hal.includes("bagian masih perlu"));

    expect(sisa?.tingkat).toBe("catatan");
    expect(sisa?.keterangan).toContain("AMAR PUTUSAN CERAI UNIVERSAL");
    expect(sisa?.keterangan).not.toContain("4001");
  });

  it("penanda tanpa nama tetap disebut nomornya, bukan dilewati", () => {
    const temuan = periksaKesiapan(bahan({ tersisa: ["9999"] }));
    expect(temuan.find((item) => item.hal.includes("bagian masih perlu"))?.keterangan).toContain("9999");
  });

  it("yang tersisa banyak diringkas tanpa menyembunyikan jumlahnya", () => {
    const tersisa = ["1", "2", "3", "4", "5", "6", "7", "8"];
    const temuan = periksaKesiapan(bahan({ tersisa }));
    const sisa = temuan.find((item) => item.hal.includes("bagian masih perlu"));

    expect(sisa?.hal).toContain("8 bagian");
    expect(sisa?.keterangan).toContain("2 lainnya");
  });
});

describe("urutan dan ringkasan", () => {
  it("halangan berdiri lebih dulu daripada peringatan dan catatan", () => {
    const temuan = periksaKesiapan(
      bahan({
        tersisa: ["4001"],
        nomorSidang: 3,
        sidangTercatat: false,
        lembar: [lembar({ saksiKe: 1, saksiNama: "" })],
      })
    );

    const tingkat = temuan.map((item) => item.tingkat);
    expect(tingkat.indexOf("halangan")).toBeLessThan(tingkat.indexOf("peringatan"));
    expect(tingkat.indexOf("peringatan")).toBeLessThan(tingkat.indexOf("catatan"));
  });

  it("ringkasan menyebut halangan lebih dulu bila ada", () => {
    const temuan = periksaKesiapan(bahan({ lembar: [lembar({ saksiKe: 1, saksiNama: "" })] }));
    expect(ringkasPemeriksaan(temuan)).toMatch(/dibereskan/i);
  });

  it("tanpa halangan maupun peringatan, ringkasannya menenangkan tanpa membohongi", () => {
    const kalimat = ringkasPemeriksaan(periksaKesiapan(bahan({ tersisa: ["4001"] })));
    expect(kalimat).toMatch(/tidak ada yang menghalangi/i);
    expect(kalimat).toMatch(/diisi tangan/i);
  });
});
