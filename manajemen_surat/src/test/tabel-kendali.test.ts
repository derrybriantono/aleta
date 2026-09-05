// @vitest-environment node

import { describe, expect, it } from "vitest";

import { bandingkan, cocokTeks, dalamRentang, urutkan } from "@/components/portal/tabel-kendali";

/**
 * Mesin urut, saring, dan cari yang dipakai Jadwal Sidang dan Jadwal Mediasi.
 *
 * ============================================================================
 * YANG DIJAGA DI SINI
 * ============================================================================
 *
 *   - nilai kosong SELALU di bawah, berapa pun arah urutannya,
 *   - urutannya stabil: baris yang nilainya sama tidak berpindah,
 *   - menekan kepala tiga kali kembali ke urutan asal,
 *   - rentang angka yang tidak berbatas di satu sisi tetap bekerja.
 *
 * Yang pertama pernah gagal: kekosongan sempat disimpulkan dari angka hasil
 * pembandingnya, padahal localeCompare juga mengembalikan 1 dan -1 untuk teks
 * biasa. Akibatnya urutan menurun berhenti bekerja - tanpa satu pun galat.
 */

type Baris = { nama: string; jam: string; sisa: number | null; ruang: string };

const DATA: Baris[] = [
  { nama: "Ani", jam: "09:41", sisa: 24, ruang: "Ruang 1" },
  { nama: "Budi", jam: "09:22", sisa: -3, ruang: "" },
  { nama: "citra", jam: "10:00", sisa: null, ruang: "Ruang 2" },
  { nama: "Dedi", jam: "09:44", sisa: 4, ruang: "" },
];

const ambil = (baris: Baris, kunci: string) => (baris as unknown as Record<string, unknown>)[kunci];

describe("mengurutkan", () => {
  it("mengurut teks menaik menurut kaidah bahasa Indonesia", () => {
    const hasil = urutkan(DATA, { kunci: "nama", arah: "naik" }, ambil);
    // "citra" huruf kecil tetap di antara Budi dan Dedi - bukan dibuang ke
    // ujung seperti pada perbandingan menurut kode karakter.
    expect(hasil.map((x) => x.nama)).toEqual(["Ani", "Budi", "citra", "Dedi"]);
  });

  it("mengurut teks menurun", () => {
    const hasil = urutkan(DATA, { kunci: "nama", arah: "turun" }, ambil);
    expect(hasil.map((x) => x.nama)).toEqual(["Dedi", "citra", "Budi", "Ani"]);
  });

  it("menaruh nilai kosong di bawah saat MENAIK", () => {
    const hasil = urutkan(DATA, { kunci: "ruang", arah: "naik" }, ambil);
    expect(hasil.map((x) => x.ruang)).toEqual(["Ruang 1", "Ruang 2", "", ""]);
  });

  it("menaruh nilai kosong di bawah saat MENURUN juga", () => {
    // Inilah yang pernah gagal. Kalau kekosongan ikut dibalik arahnya, dua
    // baris tanpa ruang naik ke puncak dan menutupi yang terisi.
    const hasil = urutkan(DATA, { kunci: "ruang", arah: "turun" }, ambil);
    expect(hasil.map((x) => x.ruang)).toEqual(["Ruang 2", "Ruang 1", "", ""]);
  });

  it("mengurut angka sebagai angka, bukan sebagai teks", () => {
    const hasil = urutkan(DATA, { kunci: "sisa", arah: "naik" }, ambil);
    // Sebagai teks, "-3" < "24" < "4". Sebagai angka, -3 < 4 < 24.
    expect(hasil.map((x) => x.sisa)).toEqual([-3, 4, 24, null]);
  });

  it("menaruh angka null di bawah saat menurun", () => {
    const hasil = urutkan(DATA, { kunci: "sisa", arah: "turun" }, ambil);
    expect(hasil.map((x) => x.sisa)).toEqual([24, 4, -3, null]);
  });

  it("stabil: baris bernilai sama tidak berpindah urutan", () => {
    const sama = [
      { nama: "a", jam: "09:00", sisa: 1, ruang: "R" },
      { nama: "b", jam: "09:00", sisa: 2, ruang: "R" },
      { nama: "c", jam: "09:00", sisa: 3, ruang: "R" },
    ];
    // Tanpa kestabilan, mengurut menurut majelis akan mengacak jam sidang di
    // dalam tiap majelis - dan jadwal yang tadinya urut jam jadi tak terbaca.
    expect(urutkan(sama, { kunci: "jam", arah: "naik" }, ambil).map((x) => x.nama)).toEqual([
      "a",
      "b",
      "c",
    ]);
    expect(urutkan(sama, { kunci: "jam", arah: "turun" }, ambil).map((x) => x.nama)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("tanpa urutan mengembalikan daftar apa adanya", () => {
    expect(urutkan(DATA, null, ambil)).toBe(DATA);
  });

  it("tidak mengubah daftar aslinya", () => {
    const salinan = [...DATA];
    urutkan(DATA, { kunci: "nama", arah: "turun" }, ambil);
    expect(DATA).toEqual(salinan);
  });

  it("kunci yang tidak dikenal tidak melempar, hanya tidak mengurut", () => {
    const hasil = urutkan(DATA, { kunci: "entah", arah: "naik" }, () => undefined);
    expect(hasil.map((x) => x.nama)).toEqual(["Ani", "Budi", "citra", "Dedi"]);
  });
});

describe("membandingkan satuan", () => {
  it("kosong selalu sesudah yang terisi", () => {
    expect(bandingkan("", "a")).toBe(1);
    expect(bandingkan("a", "")).toBe(-1);
    expect(bandingkan(null, undefined)).toBe(0);
  });

  it("angka di dalam teks dibandingkan sebagai angka", () => {
    // "Ruang Sidang 10" harus sesudah "Ruang Sidang 2", bukan sebelumnya.
    expect(bandingkan("Ruang Sidang 2", "Ruang Sidang 10")).toBeLessThan(0);
  });

  it("benar dianggap lebih dulu daripada salah", () => {
    expect(bandingkan(true, false)).toBeLessThan(0);
  });
});

describe("mencari teks", () => {
  it("mengabaikan huruf besar-kecil", () => {
    expect(cocokTeks("521/Pdt.G/2026/PA.Dgl", "pdt.g")).toBe(true);
    expect(cocokTeks("521/Pdt.G/2026/PA.Dgl", "521")).toBe(true);
  });

  it("kata kosong mencocoki semuanya", () => {
    // Medan pencarian yang dikosongkan tidak boleh ikut menyaring.
    expect(cocokTeks("apa pun", "")).toBe(true);
    expect(cocokTeks("apa pun", "   ")).toBe(true);
  });

  it("sumber kosong tidak dicocoki kata apa pun", () => {
    expect(cocokTeks("", "budi")).toBe(false);
    expect(cocokTeks(null, "budi")).toBe(false);
  });
});

describe("rentang angka", () => {
  it("tanpa batas sama sekali mencocoki semuanya", () => {
    expect(dalamRentang(5, "", "")).toBe(true);
    expect(dalamRentang(null, "", "")).toBe(true);
  });

  it("berbatas satu sisi saja", () => {
    expect(dalamRentang(10, "5", "")).toBe(true);
    expect(dalamRentang(3, "5", "")).toBe(false);
    expect(dalamRentang(3, "", "5")).toBe(true);
    expect(dalamRentang(10, "", "5")).toBe(false);
  });

  it("batasnya termasuk", () => {
    expect(dalamRentang(5, "5", "5")).toBe(true);
  });

  it("angka negatif ikut terbandingkan", () => {
    // Sisa tenggang yang sudah lewat bernilai negatif, dan "sampai 0" adalah
    // cara menanyakan "yang sudah lewat atau habis hari ini".
    expect(dalamRentang(-3, "", "0")).toBe(true);
    expect(dalamRentang(-3, "0", "")).toBe(false);
  });

  it("baris tanpa angka TIDAK masuk saat rentangnya diisi", () => {
    // Menyatakannya masuk akan menyelipkan baris tanpa data ke dalam hasil
    // yang justru dicari karena angkanya.
    expect(dalamRentang(null, "1", "10")).toBe(false);
    expect(dalamRentang(undefined, "", "10")).toBe(false);
  });
});
