/**
 * Sifat ruangan sidang - dalam gedung, keliling, atau terpadu.
 *
 * Seluruh nama ruangan pada berkas ini DIAMBIL APA ADANYA dari sidang
 * 2025-2026 di PA Donggala, beserta jumlah pemakaiannya. Tidak ada satu pun
 * nama karangan: aturan yang diuji atas nama karangan akan benar atas nama
 * karangan dan gagal atas nama sungguhan.
 */
import { describe, expect, it } from "vitest";

import {
  type Ruangan,
  SEBUTAN_SIFAT,
  diLuarGedung,
  kelompokkanRuangan,
  ruanganKeliling,
  sifatRuangan,
} from "@/lib/ruangan-sidang";

describe("nama sungguhan dari SIPP", () => {
  it("yang memuat 'ruang sidang' adalah dalam gedung", () => {
    for (const nama of [
      "Ruang Sidang 1", // 1.911 sidang - yang terbanyak, dan TIDAK terdaftar di ruangan_sidang
      "Ruang Sidang 1 Dalam Gedung", // 1.343
      "Ruang Sidang Dalam Gedung 1", // 211
      "Ruang Sidang 2 Dalam Gedung", // 26
      "Ruang Sidang 2", // 18
      "Ruang Sidang Elektronik 1", // 6
    ]) {
      expect(sifatRuangan(nama), nama).toBe("dalam-gedung");
    }
  });

  it("yang bernama Sidang Keliling adalah keliling", () => {
    for (const nama of [
      "Sidang Keliling Sigi Biromaru", // 126
      "Sidang Keliling Rio Pakava", // 40
      "Sidang Keliling Sirenja", // 14
      "Sidang diluar gedung Pengadilan (sidang keliling)", // 36
    ]) {
      expect(sifatRuangan(nama), nama).toBe("keliling");
    }
  });

  it("TERPADU bukan keliling - dan SIPP sendiri yang mengatakannya", () => {
    // Keempat ruangan Terpadu berbendera sidang_keliling = 0 di ruangan_sidang.
    // Aturan nama semata akan menyatukannya dengan keliling - 115 sidang
    // setahun - dan membuat laporan sidang keliling melebih-lebihkan dirinya.
    for (const [nama, bendera] of [
      ["Terpadu Sindue", false], // 39
      ["Terpadu Labuan", false], // 29
      ["Terpadu Sindue Tombusabura", false], // 27
      ["Terpadu Sirenja", false], // 20
      ["Sidang diluar gedung Pengadilan (sidang terpadu)", null], // 128, tidak terdaftar
    ] as const) {
      expect(sifatRuangan(nama, bendera), nama).toBe("terpadu");
      expect(ruanganKeliling(nama, bendera), nama).toBe(false);
      // Tetapi ia tetap di LUAR gedung - dua pertanyaan yang berbeda.
      expect(diLuarGedung(nama, bendera), nama).toBe(true);
    }
  });
});

describe("bendera SIPP dan nama, ketika berselisih", () => {
  it("bendera menang atas nama yang tidak menyebut apa-apa", () => {
    // Admin pengadilan yang mengisinya, dan ia lebih tahu daripada pola kata.
    expect(sifatRuangan("Balai Desa Banawa", true)).toBe("keliling");
    expect(sifatRuangan("Ruang Sidang 3", false)).toBe("dalam-gedung");
  });

  it("ruangan yang TIDAK terdaftar tetap berketerangan", () => {
    // 2.140 sidang memakai ruangan yang tidak ada di ruangan_sidang sama
    // sekali - termasuk "Ruang Sidang 1" yang paling banyak dipakai.
    // Mengandalkan bendera saja membuat mayoritas sidang tidak berketerangan.
    expect(sifatRuangan("Ruang Sidang 1", null)).toBe("dalam-gedung");
    expect(sifatRuangan("Sidang Keliling Rio Pakava", null)).toBe("keliling");
  });

  it("nama kosong tidak dianggap keliling", () => {
    // 190 sidang ruangannya kosong. Menyebutnya keliling akan melaporkan
    // sidang keliling yang tidak pernah ada.
    expect(sifatRuangan("")).toBe("dalam-gedung");
    expect(sifatRuangan("   ")).toBe("dalam-gedung");
    expect(ruanganKeliling("")).toBe(false);
  });

  it("di luar gedung tanpa keterangan lain dibaca keliling", () => {
    expect(sifatRuangan("Aula KUA Banawa")).toBe("keliling");
  });
});

describe("daftar pilihan", () => {
  const daftar: Ruangan[] = [
    { id: 1, kode: "101", nama: "Ruang Sidang 1 Dalam Gedung", benderaKeliling: false, aktif: true },
    { id: 3, kode: "201", nama: "Sidang Keliling Sigi Biromaru", benderaKeliling: true, aktif: true },
    { id: 4, kode: "202", nama: "Sidang Keliling Sirenja", benderaKeliling: true, aktif: true },
    { id: 6, kode: "302", nama: "Terpadu Sirenja", benderaKeliling: false, aktif: true },
    { id: 99, kode: "999", nama: "Sidang Keliling Lama", benderaKeliling: true, aktif: false },
  ];

  it("dikelompokkan menurut sifatnya dan diurutkan menurut nama", () => {
    const k = kelompokkanRuangan(daftar);
    expect(k["dalam-gedung"].map((r) => r.nama)).toEqual(["Ruang Sidang 1 Dalam Gedung"]);
    expect(k.keliling.map((r) => r.nama)).toEqual([
      "Sidang Keliling Sigi Biromaru",
      "Sidang Keliling Sirenja",
    ]);
    expect(k.terpadu.map((r) => r.nama)).toEqual(["Terpadu Sirenja"]);
  });

  it("yang sudah tidak aktif tidak pernah ditawarkan", () => {
    // Menampilkannya lalu menolaknya sesudah ditekan terbaca sebagai
    // kerusakan, bukan sebagai aturan.
    const k = kelompokkanRuangan(daftar);
    const semua = [...k["dalam-gedung"], ...k.keliling, ...k.terpadu];
    expect(semua.some((r) => r.id === 99)).toBe(false);
  });

  it("tiap sifat punya sebutannya sendiri di layar", () => {
    expect(SEBUTAN_SIFAT.keliling).toBe("Sidang keliling");
    expect(SEBUTAN_SIFAT.terpadu).toBe("Sidang terpadu");
    expect(SEBUTAN_SIFAT["dalam-gedung"]).toBe("Dalam gedung");
  });
});
