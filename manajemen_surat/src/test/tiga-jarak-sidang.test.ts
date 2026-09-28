// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  bacaWaktu,
  detikBerjalan,
  hitungTigaJarak,
  jamBerjalan,
  kunciWaktu,
  pitaTunggu,
  sebutanDurasi,
  sebutanDurasiLengkap,
  sebutanDurasiRingkas,
  type BarisWaktuAntrian,
} from "@/lib/tiga-jarak-sidang";

/**
 * ============================================================================
 * TIGA JARAK WAKTU SIDANG - PERILAKU FUNGSI MURNINYA
 * ============================================================================
 *
 * Diminta pengguna 27 September 2026: tiga jarak yang jelas - Tunggu (ambil
 * nomor -> dipanggil), Dari sebelumnya (panggilan ini - panggilan sebelumnya
 * di ruang yang sama; urutan pertama tidak dihitung), dan Lama sidang
 * (panggilan berikutnya di ruang yang sama - panggilan ini).
 *
 * Hari sidangnya 27 September 2026; dua ruang berjalan bersamaan.
 *
 *   Ruang 1                                   Ruang 2
 *   A  ambil 08:10:00  panggil 09:00:00       R  ambil 08:05:00  panggil 09:01:00
 *   B  ambil 08:20:30  panggil 09:12:30
 *   X  ambil 08:40:00  panggil 09:30:00   <- TIDAK ada di daftar SIPP yang tampil
 *   C  ambil 08:50:00  panggil 09:45:10   <- terakhir di Ruang 1
 *   W  ambil 09:00:00  belum dipanggil
 */

const HARI = "2026-09-27";

function baris(ubah: Partial<BarisWaktuAntrian> & { perkaraId: string }): BarisWaktuAntrian {
  return {
    tanggalSidang: HARI,
    nomorAntrian: null,
    noRuang: 1,
    ruanganId: 1,
    ambilPihak1: "",
    ambilPihak2: "",
    ambilSaksi: "",
    ambilTerawal: "",
    jamJadwal: "",
    panggilPertama: "",
    panggilTerakhir: "",
    jumlahPanggil: 0,
    online: null,
    namaPetugas: "",
    sumber: "rekaman",
    ...ubah,
  };
}

const A = baris({ perkaraId: "1", nomorAntrian: 1, ambilTerawal: `${HARI} 08:10:00`, panggilPertama: `${HARI} 09:00:00`, panggilTerakhir: `${HARI} 09:00:00`, jumlahPanggil: 1 });
const B = baris({ perkaraId: "2", nomorAntrian: 2, ambilTerawal: `${HARI} 08:20:30`, panggilPertama: `${HARI} 09:12:30`, panggilTerakhir: `${HARI} 09:12:30`, jumlahPanggil: 1 });
const X = baris({ perkaraId: "9", nomorAntrian: 4, ambilTerawal: `${HARI} 08:40:00`, panggilPertama: `${HARI} 09:30:00`, panggilTerakhir: `${HARI} 09:30:00`, jumlahPanggil: 1 });
const C = baris({ perkaraId: "3", nomorAntrian: 5, ambilTerawal: `${HARI} 08:50:00`, panggilPertama: `${HARI} 09:45:10`, panggilTerakhir: `${HARI} 09:45:10`, jumlahPanggil: 1 });
const W = baris({ perkaraId: "4", nomorAntrian: 6, ambilTerawal: `${HARI} 09:00:00` });
const R = baris({ perkaraId: "5", nomorAntrian: 3, noRuang: 2, ambilTerawal: `${HARI} 08:05:00`, panggilPertama: `${HARI} 09:01:00`, panggilTerakhir: `${HARI} 09:01:00`, jumlahPanggil: 1 });

const SEMUA = [A, B, X, C, W, R];
const k = (b: BarisWaktuAntrian) => kunciWaktu(b.tanggalSidang, b.perkaraId);

describe("(a) Tunggu - ambil nomor sampai dipanggil", () => {
  const tiga = hitungTigaJarak(SEMUA, { hariIni: HARI });

  it("yang sudah dipanggil: selisihnya sampai detik", () => {
    expect(tiga[k(A)].tunggu).toMatchObject({ keadaan: "selesai", detik: 50 * 60 });
    // 08:20:30 -> 09:12:30 = 52 menit tepat.
    expect(tiga[k(B)].tunggu.detik).toBe(52 * 60);
  });

  it("yang masih menunggu HARI INI: berjalan dari waktu ambilnya", () => {
    expect(tiga[k(W)].tunggu.keadaan).toBe("berjalan");
    expect(tiga[k(W)].tunggu.mulaiMs).toBe(bacaWaktu(`${HARI} 09:00:00`));
    // "Sekarang" menurut jam antrian 09:41:30 -> 41 menit 30 detik.
    expect(detikBerjalan(tiga[k(W)].tunggu, bacaWaktu(`${HARI} 09:41:30`)!)).toBe(41 * 60 + 30);
  });

  it("belum mengambil nomor: tidak ada Tunggu - bukan nol", () => {
    const tanpa = hitungTigaJarak([baris({ perkaraId: "7" })], { hariIni: HARI });
    expect(tanpa[kunciWaktu(HARI, "7")].tunggu).toMatchObject({ keadaan: "kosong", detik: null });
  });

  it("dipanggil SEBELUM mengambil nomor: janggal, tidak dipaksa nol", () => {
    const D = baris({ perkaraId: "8", ambilTerawal: `${HARI} 09:50:00`, panggilTerakhir: `${HARI} 09:40:00` });
    const hasil = hitungTigaJarak([D], { hariIni: HARI })[k(D)];
    expect(hasil.tunggu.keadaan).toBe("janggal");
    expect(hasil.tunggu.detik).toBeNull();
    expect(hasil.tunggu.sebab).toMatch(/SEBELUM mengambil nomor/);
  });
});

describe("(b) Dari sebelumnya dan (c) Lama sidang - per ruang, menurut waktu panggil", () => {
  const tiga = hitungTigaJarak(SEMUA, { hariIni: HARI });

  it("urutan PERTAMA di ruangnya tidak dihitung - kosong, bukan nol", () => {
    expect(tiga[k(A)].dariSebelumnya).toMatchObject({ keadaan: "kosong", detik: null });
    expect(tiga[k(A)].urutanRuang).toBe(1);
    // R dipanggil 09:01:00, SEMENIT sesudah A - tetapi di ruang lain. Satu
    // deret untuk dua ruang akan menulis "1 menit" yang tidak pernah terjadi.
    expect(tiga[k(R)].dariSebelumnya.keadaan).toBe("kosong");
    expect(tiga[k(R)].urutanRuang).toBe(1);
  });

  it("dari sebelumnya = panggilan ini - panggilan sebelumnya di ruang yang sama", () => {
    expect(tiga[k(B)].dariSebelumnya).toMatchObject({ keadaan: "selesai", detik: 12 * 60 + 30 });
    expect(tiga[k(B)].dariSebelumnya.tetangga?.perkaraId).toBe("1");
    expect(tiga[k(B)].dariSebelumnya.tetangga?.nomorAntrian).toBe(1);
  });

  it("lama sidang = panggilan berikutnya di ruang yang sama - panggilan ini", () => {
    expect(tiga[k(A)].lamaSidang).toMatchObject({ keadaan: "selesai", detik: 12 * 60 + 30 });
    expect(tiga[k(A)].lamaSidang.tetangga?.perkaraId).toBe("2");
  });

  it("tetangga yang TIDAK tampil di daftar SIPP tetap menjadi pembanding", () => {
    // X tidak ada di daftar yang tampil, tetapi ia dipanggil di antara B dan C.
    // Tanpa X, "Lama sidang" B terbaca 32 menit 40 detik - lamanya dua sidang.
    expect(tiga[k(B)].lamaSidang.detik).toBe(17 * 60 + 30);
    expect(tiga[k(B)].lamaSidang.tetangga?.perkaraId).toBe("9");
    expect(tiga[k(C)].dariSebelumnya.tetangga?.perkaraId).toBe("9");
  });

  it("dari-sebelumnya satu baris SAMA dengan lama-sidang baris sebelumnya", () => {
    for (const [sebelum, sesudah] of [[A, B], [B, X], [X, C]] as const) {
      expect(tiga[k(sesudah)].dariSebelumnya.detik).toBe(tiga[k(sebelum)].lamaSidang.detik);
    }
  });

  it("yang terakhir HARI INI dan belum selesai: berjalan dari panggilannya", () => {
    expect(tiga[k(C)].lamaSidang.keadaan).toBe("berjalan");
    expect(tiga[k(C)].lamaSidang.mulaiMs).toBe(bacaWaktu(`${HARI} 09:45:10`));
    expect(tiga[k(R)].lamaSidang.keadaan).toBe("berjalan");
  });

  it("yang terakhir hari ini tetapi hasil sidangnya sudah dicatat: tidak diketahui, bukan berjalan", () => {
    const selesai = hitungTigaJarak(SEMUA, { hariIni: HARI, selesai: { [k(C)]: true } });
    expect(selesai[k(C)].lamaSidang.keadaan).toBe("tidak-diketahui");
    expect(selesai[k(C)].lamaSidang.detik).toBeNull();
  });

  it("yang belum dipanggil tidak punya keduanya", () => {
    expect(tiga[k(W)].dariSebelumnya.keadaan).toBe("kosong");
    expect(tiga[k(W)].lamaSidang.keadaan).toBe("kosong");
    expect(tiga[k(W)].urutanRuang).toBeNull();
  });

  it("dipanggil pada detik yang sama: NOL, bukan kosong", () => {
    const P = baris({ perkaraId: "11", panggilTerakhir: `${HARI} 10:00:00` });
    const Q = baris({ perkaraId: "12", panggilTerakhir: `${HARI} 10:00:00` });
    const hasil = hitungTigaJarak([P, Q], { hariIni: HARI });
    expect(hasil[k(Q)].dariSebelumnya).toMatchObject({ keadaan: "selesai", detik: 0 });
  });

  it("urutan masukan tidak mengubah angka", () => {
    const acak = [R, W, C, A, X, B];
    expect(hitungTigaJarak(acak, { hariIni: HARI })).toEqual(tiga);
  });
});

describe("dipanggil ulang: panggilan TERAKHIR adalah waktu sidangnya", () => {
  it("urutan, jarak, dan tunggunya memakai panggilan terakhir", () => {
    // E dipanggil 09:05 (tidak hadir), lalu dipanggil lagi 10:00.
    const E = baris({
      perkaraId: "6",
      nomorAntrian: 7,
      ambilTerawal: `${HARI} 08:30:00`,
      panggilPertama: `${HARI} 09:05:00`,
      panggilTerakhir: `${HARI} 10:00:00`,
      jumlahPanggil: 2,
    });
    const tiga = hitungTigaJarak([...SEMUA, E], { hariIni: HARI });
    // C tidak lagi yang terakhir: sidangnya berakhir saat E dipanggil ulang.
    expect(tiga[k(C)].lamaSidang).toMatchObject({ keadaan: "selesai", detik: 14 * 60 + 50 });
    expect(tiga[k(E)].dariSebelumnya.tetangga?.perkaraId).toBe("3");
    expect(tiga[k(E)].lamaSidang.keadaan).toBe("berjalan");
    // Tunggu E sampai panggilan TERAKHIR: 08:30 -> 10:00.
    expect(tiga[k(E)].tunggu.detik).toBe(90 * 60);
    // Panggilan pertama 09:05 TIDAK memotong B -> X.
    expect(tiga[k(B)].lamaSidang.tetangga?.perkaraId).toBe("9");
  });
});

describe("hari lampau dan hari mendatang", () => {
  it("hari LAMPAU: tidak ada yang berjalan; yang tidak punya pembanding tidak diketahui", () => {
    const tiga = hitungTigaJarak(SEMUA, { hariIni: "2026-09-28" });
    expect(tiga[k(C)].lamaSidang.keadaan).toBe("tidak-diketahui");
    expect(tiga[k(C)].lamaSidang.detik).toBeNull();
    expect(tiga[k(W)].tunggu.keadaan).toBe("tidak-diketahui");
    // Yang selesai tetap selesai, dengan angka yang sama dengan hari itu.
    expect(tiga[k(A)].tunggu.detik).toBe(50 * 60);
    expect(tiga[k(B)].lamaSidang.detik).toBe(17 * 60 + 30);
    expect(Object.values(tiga).some((t) => [t.tunggu, t.dariSebelumnya, t.lamaSidang].some((j) => j.keadaan === "berjalan"))).toBe(false);
  });

  it("hari MENDATANG: yang sudah ambil tidak dianggap menunggu", () => {
    const tiga = hitungTigaJarak(SEMUA, { hariIni: "2026-09-26" });
    expect(tiga[k(W)].tunggu.keadaan).toBe("kosong");
  });

  it("jam antrian tidak terbaca: tidak ada yang dianggap hari ini", () => {
    const tiga = hitungTigaJarak(SEMUA, { hariIni: "" });
    expect(tiga[k(C)].lamaSidang.keadaan).toBe("tidak-diketahui");
    expect(tiga[k(W)].tunggu.keadaan).toBe("tidak-diketahui");
  });

  it("dua hari dalam satu rentang tidak pernah menjadi satu deret", () => {
    const esok = baris({ perkaraId: "1", tanggalSidang: "2026-09-28", panggilTerakhir: "2026-09-28 08:30:00" });
    const tiga = hitungTigaJarak([...SEMUA, esok], { hariIni: HARI });
    expect(tiga[kunciWaktu("2026-09-28", "1")].dariSebelumnya.keadaan).toBe("kosong");
    // Perkara "1" hari ini dan "1" esok adalah dua baris yang berbeda.
    expect(tiga[k(A)].lamaSidang.tetangga?.perkaraId).toBe("2");
  });
});

describe("ruang cadangan dari SIPP", () => {
  it("baris tanpa ruang antrian dikelompokkan menurut ruangan SIPP", () => {
    const S1 = baris({ perkaraId: "21", noRuang: null, ruanganId: null, panggilTerakhir: `${HARI} 09:00:00` });
    const S2 = baris({ perkaraId: "22", noRuang: null, ruanganId: null, panggilTerakhir: `${HARI} 09:20:00` });
    const S3 = baris({ perkaraId: "23", noRuang: null, ruanganId: null, panggilTerakhir: `${HARI} 09:10:00` });
    const tiga = hitungTigaJarak([S1, S2, S3], {
      hariIni: HARI,
      ruangSipp: { [k(S1)]: "Ruang Sidang Utama", [k(S2)]: "Ruang Sidang Utama", [k(S3)]: "Ruang Sidang II" },
    });
    expect(tiga[k(S2)].dariSebelumnya.detik).toBe(20 * 60);
    expect(tiga[k(S3)].dariSebelumnya.keadaan).toBe("kosong");
    expect(tiga[k(S2)].ruang).toBe("Ruang Sidang Utama");
  });
});

describe("bentuk tulisan dan warna", () => {
  it("durasi selesai: menit DIBULATKAN KE BAWAH, sama dengan jam berjalan", () => {
    expect(sebutanDurasi(45)).toBe("45 detik");
    expect(sebutanDurasi(60)).toBe("1 menit");
    expect(sebutanDurasi(12 * 60 + 59)).toBe("12 menit");
    expect(sebutanDurasi(3599)).toBe("59 menit");
    expect(sebutanDurasi(3600)).toBe("1 jam");
    expect(sebutanDurasi(3900)).toBe("1 jam 5 menit");
  });

  it("durasi ringkas untuk pil: angka yang SAMA dengan bentuk panjangnya", () => {
    // Diminta pengguna 28 Sep 2026 - "1 jam 19 menit" melipat tiga baris.
    expect(sebutanDurasiRingkas(45)).toBe("45d");
    expect(sebutanDurasiRingkas(12 * 60 + 59)).toBe("12m");
    expect(sebutanDurasiRingkas(3600)).toBe("1j");
    expect(sebutanDurasiRingkas(79 * 60 + 30)).toBe("1j 19m");
    expect(sebutanDurasiRingkas(-5)).toBe("0d");
    for (const d of [0, 59, 60, 719, 3599, 3600, 3900, 4770, 7200, 9000]) {
      const angka = (t: string) => (t.match(/\d+/g) ?? []).join(",");
      expect(angka(sebutanDurasiRingkas(d))).toBe(angka(sebutanDurasi(d)));
    }
  });

  it("durasi lengkap untuk title, sampai detiknya", () => {
    expect(sebutanDurasiLengkap(3725)).toBe("1 jam 2 menit 5 detik");
    expect(sebutanDurasiLengkap(0)).toBe("0 detik");
    expect(sebutanDurasiLengkap(750)).toBe("12 menit 30 detik");
  });

  it("jam berjalan: mm:dd di bawah sejam, j:mm:dd di atasnya", () => {
    expect(jamBerjalan(65)).toBe("01:05");
    expect(jamBerjalan(3599)).toBe("59:59");
    expect(jamBerjalan(3725)).toBe("1:02:05");
  });

  it("Tunggu netral di bawah ambang, merah sampai 60, merah gelap sesudahnya", () => {
    expect(pitaTunggu(39.99, 40)).toBeNull();
    expect(pitaTunggu(40, 40)?.pita).toBe("merah");
    expect(pitaTunggu(59.9, 40)?.pita).toBe("merah");
    expect(pitaTunggu(60, 40)?.pita).toBe("merah-gelap");
    // Ambangnya milik pemanggil, bukan tertulis di pustaka.
    expect(pitaTunggu(35, 30)?.pita).toBe("merah");
  });

  it("waktu dibaca dengan SATU cara - selisihnya tidak bergantung zona peramban", () => {
    expect(bacaWaktu("2026-09-27 09:00:00")! - bacaWaktu("2026-09-27 08:59:30")!).toBe(30_000);
    expect(bacaWaktu("")).toBeNull();
    expect(bacaWaktu("09:00:00")).toBeNull();
  });

  it("berjalan yang mulainya SESUDAH sekarang tidak menjadi nol", () => {
    const tiga = hitungTigaJarak([W], { hariIni: HARI });
    expect(detikBerjalan(tiga[k(W)].tunggu, bacaWaktu(`${HARI} 08:59:00`)!)).toBeNull();
  });
});
