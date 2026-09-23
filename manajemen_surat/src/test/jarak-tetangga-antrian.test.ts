// @vitest-environment node

import { describe, expect, it } from "vitest";

import { petaJarakAntarSidang, petaJarakBerikutSidang } from "@/lib/jarak-antar-sidang";

/**
 * ============================================================================
 * ANGKA YANG BENAR, DAN TETAP TIDAK DAPAT DIPERIKSA
 * ============================================================================
 *
 * Keluhan pengguna 23 September 2026 atas layar Antrian Sidang: jeda antara
 * perkara sebelumnya, yang sedang berjalan, dan yang berikutnya terasa tidak
 * cocok satu sama lain.
 *
 * Contoh dari tangkapan layarnya sendiri - antrian 1, 2, dan 3 berurutan:
 *
 *     antrian 1  dipanggil 09:22   ->35 menit
 *     antrian 2  dipanggil 10:01   +4 menit   ->3 menit
 *     antrian 3  dipanggil 10:04   +3 menit
 *
 * Dibaca sebagai deret, "->35" pada baris pertama dan "+4" pada baris kedua
 * saling membantah: 09:22 ke 10:01 berjarak 39 menit, bukan 35 dan bukan 4.
 *
 * Keduanya BENAR. Jaraknya dihitung terhadap tetangga di RUANG YANG SAMA
 * menurut jam panggil - dan tetangga itu belum tentu baris di atas atau di
 * bawahnya pada tabel, sebab tabelnya sedang disaring, diurutkan menurut hal
 * lain, atau memuat lebih dari satu ruang.
 *
 * Yang salah bukan hitungannya, melainkan bahwa angkanya tidak dapat
 * diperiksa siapa pun: tidak ada yang menyebutkan tetangga MANA yang
 * dimaksud. Uji ini mengunci perilakunya supaya perbaikan tampilannya tidak
 * diam-diam mengubah angkanya.
 */

/** Persis keadaan pada tangkapan layar, plus satu perkara yang tidak tampil. */
const DERET = [
  { kunci: "a1", ruangan: "Ruang Sidang 1", jamPanggil: "09:22" },
  { kunci: "x", ruangan: "Ruang Sidang 1", jamPanggil: "09:57" },
  { kunci: "a2", ruangan: "Ruang Sidang 1", jamPanggil: "10:01" },
  { kunci: "a3", ruangan: "Ruang Sidang 1", jamPanggil: "10:04" },
];

describe("jarak dihitung ke tetangga di ruang yang sama, bukan ke baris di atasnya", () => {
  it("angka pada tangkapan layar memang keluar dari deret ini", () => {
    const sebelum = petaJarakAntarSidang(DERET);
    const berikut = petaJarakBerikutSidang(DERET);

    // Inilah yang tergambar: 1 -> 35, 2 -> +4 dan ->3, 3 -> +3.
    expect(berikut.a1).toBe(35);
    expect(sebelum.a2).toBe(4);
    expect(berikut.a2).toBe(3);
    expect(sebelum.a3).toBe(3);

    // Dan inilah sebabnya keduanya tampak membantah: ada satu perkara di
    // antara a1 dan a2 yang tidak ikut tergambar.
    expect(sebelum.x).toBe(35);
    expect(berikut.x).toBe(4);
  });

  it("yang pertama tidak punya jarak ke belakang, yang terakhir tidak ke depan", () => {
    // Bukan nol. Nol berarti dipanggil bersamaan - keadaan yang sungguh
    // terjadi dan patut diwarnai merah.
    expect(petaJarakAntarSidang(DERET).a1).toBeUndefined();
    expect(petaJarakBerikutSidang(DERET).a3).toBeUndefined();
  });

  it("dua ruang tidak pernah dijadikan satu deret", () => {
    // Menggabungnya menghasilkan jarak nol dan satu menit yang tidak pernah
    // terjadi di ruang mana pun - dan seluruh warnanya menjadi hijau justru
    // pada hari yang tersibuk.
    const duaRuang = [
      { kunci: "r1a", ruangan: "Ruang 1", jamPanggil: "09:00" },
      { kunci: "r2a", ruangan: "Ruang 2", jamPanggil: "09:01" },
      { kunci: "r1b", ruangan: "Ruang 1", jamPanggil: "09:30" },
    ];
    expect(petaJarakAntarSidang(duaRuang).r1b).toBe(30);
    expect(petaJarakAntarSidang(duaRuang).r2a).toBeUndefined();
  });

  it("urutannya menurut jam panggil, bukan menurut urutan masuk", () => {
    // Daftar di layar dapat diurutkan menurut apa saja. Angka yang berubah
    // karena pengurutan bukan angka tentang sidang.
    const acak = [DERET[3], DERET[0], DERET[2], DERET[1]];
    expect(petaJarakAntarSidang(acak)).toEqual(petaJarakAntarSidang(DERET));
    expect(petaJarakBerikutSidang(acak)).toEqual(petaJarakBerikutSidang(DERET));
  });
});
