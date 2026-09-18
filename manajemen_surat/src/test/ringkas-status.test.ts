/**
 * ============================================================================
 * RINGKASAN SATU LAYAR - DIUJI ATAS PERILAKUNYA, BUKAN ATAS TEKSNYA
 * ============================================================================
 *
 * Berbeda dari sebagian besar penjaga di repo ini yang menyisir teks sumber,
 * berkas ini MENJALANKAN penyusunnya. Ia memang dapat dijalankan: tidak
 * menyentuh basis data, tidak menyentuh jaringan, dan tanggal acuannya
 * disuntikkan alih-alih dibaca dari jam mesin.
 *
 * Yang terakhir itu disengaja. Penyusun yang membaca `new Date()` di dalam
 * dirinya hanya dapat diuji pada hari uji itu dijalankan - dan penjaga yang
 * jawabannya berubah tiap hari adalah penjaga yang akan dimatikan orang.
 */
import { describe, expect, it } from "vitest";

import { AMBANG_HARI_MEDIASI, AMBANG_HARI_SEMA, ringkasStatus, type BahanRingkas } from "@/lib/ringkas-status";

const KOSONG: BahanRingkas = {
  identitas: { nomorPerkara: "1/Pdt.G/2026/PA.Dgl", jenisPerkara: "Cerai Gugat", tanggalDaftar: "2026-01-05" },
  umur: {
    hariBerjalan: 20,
    bulanBerjalan: 0,
    sudahPutus: false,
    hariMinutasi: null,
    hariMediasi: 0,
  },
  majelis: [{ nama: "Fahri", jabatan: "Ketua" }],
  panitera: [{ nama: "Unun" }],
  jadwal: [],
  putusan: null,
};

const HARI_INI = "2026-02-01";

function dengan(ubah: Partial<BahanRingkas>): BahanRingkas {
  return { ...KOSONG, ...ubah };
}

describe("keadaan perkara", () => {
  it("berjalan bila ada sidang di depan", () => {
    const r = ringkasStatus(
      dengan({ jadwal: [{ tanggalSidang: "2026-02-10", jamSidang: "09:00", agenda: "Jawaban", ditunda: false }] }),
      HARI_INI
    );
    expect(r.keadaan).toBe("Dalam persidangan");
    expect(r.berikutnya).toContain("2026-02-10");
    expect(r.berikutnya).toContain("Jawaban");
  });

  it("sidang yang tepat HARI INI masih terhitung di depan", () => {
    // Sidang hari ini belum lewat. Membandingkannya dengan ">" membuat perkara
    // yang justru sedang disidangkan pagi itu terbaca sebagai tanpa jadwal.
    const r = ringkasStatus(
      dengan({ jadwal: [{ tanggalSidang: HARI_INI, jamSidang: "09:00", agenda: "Pembuktian", ditunda: false }] }),
      HARI_INI
    );
    expect(r.keadaan).toBe("Dalam persidangan");
  });

  it("menunggu jadwal bila sidangnya sudah lewat semua", () => {
    const r = ringkasStatus(
      dengan({ jadwal: [{ tanggalSidang: "2026-01-10", jamSidang: "09:00", agenda: "Jawaban", ditunda: true }] }),
      HARI_INI
    );
    expect(r.keadaan).toBe("Menunggu jadwal sidang berikutnya");
    expect(r.keadaanBerat).toBe(true);
  });

  it("sebab selesai membedakan putus, dicabut, dan gugur", () => {
    const dasar = {
      umur: { ...KOSONG.umur, sudahPutus: true, hariBerjalan: 35 },
      putusan: {
        sudahPutus: true,
        tanggalPutusan: "2026-02-01",
        statusPutusan: "Dikabulkan",
        tanggalMinutasi: "2026-02-01",
        tanggalBht: "2026-02-15",
        aktaCerai: null,
      },
    };
    expect(ringkasStatus(dengan(dasar), HARI_INI).keadaan).toContain("Sudah putus");
    expect(
      ringkasStatus(
        dengan({ ...dasar, umur: { ...dasar.umur, sebabSelesai: "dicabut" } }),
        HARI_INI
      ).keadaan
    ).toContain("Dicabut");
    expect(
      ringkasStatus(
        dengan({ ...dasar, umur: { ...dasar.umur, sebabSelesai: "gugur" } }),
        HARI_INI
      ).keadaan
    ).toContain("Gugur");
  });
});

describe("peringatan yang dikumpulkan", () => {
  it("majelis belum ditetapkan adalah peringatan berat", () => {
    const r = ringkasStatus(dengan({ majelis: [] }), HARI_INI);
    expect(r.peringatan[0].pesan).toContain("Majelis");
    expect(r.peringatan[0].berat).toBe(true);
    expect(r.majelisKalimat).toBe("Majelis belum ditetapkan");
  });

  it("lewat lima bulan disebut beserta dasar aturannya", () => {
    const r = ringkasStatus(
      dengan({ umur: { ...KOSONG.umur, hariBerjalan: AMBANG_HARI_SEMA + 1 } }),
      HARI_INI
    );
    const p = r.peringatan.find((x) => x.pesan.includes("belum putus"));
    expect(p).toBeTruthy();
    expect(p!.sebab).toContain("SEMA 2/2014");
  });

  it("perkara yang SUDAH putus tidak lagi diperingatkan soal lima bulan", () => {
    // Perkara lama yang selesai dalam tujuh bulan bukan pekerjaan yang
    // tertunggak - ia sudah selesai, dan memperingatkannya hanya menambah
    // kebisingan pada daftar yang gunanya justru menyaring kebisingan.
    const r = ringkasStatus(
      dengan({
        umur: { ...KOSONG.umur, hariBerjalan: 200, sudahPutus: true },
        putusan: {
          sudahPutus: true,
          tanggalPutusan: "2026-01-20",
          statusPutusan: "Dikabulkan",
          tanggalMinutasi: "2026-01-20",
          tanggalBht: "2026-02-03",
          aktaCerai: null,
        },
      }),
      HARI_INI
    );
    expect(r.peringatan.some((x) => x.pesan.includes("belum putus"))).toBe(false);
  });

  it("mediasi lewat tiga puluh hari disebut beserta PERMA-nya", () => {
    const r = ringkasStatus(
      dengan({ umur: { ...KOSONG.umur, hariMediasi: AMBANG_HARI_MEDIASI + 5 } }),
      HARI_INI
    );
    const p = r.peringatan.find((x) => x.pesan.includes("Mediasi"));
    expect(p).toBeTruthy();
    expect(p!.sebab).toContain("PERMA 1/2016");
  });

  it("minutasi dan BHT yang belum tercatat disebut sesudah putus", () => {
    const r = ringkasStatus(
      dengan({
        umur: { ...KOSONG.umur, sudahPutus: true, hariBerjalan: 30 },
        putusan: {
          sudahPutus: true,
          tanggalPutusan: "2026-01-20",
          statusPutusan: "Dikabulkan",
          tanggalMinutasi: "",
          tanggalBht: "",
          aktaCerai: null,
        },
      }),
      HARI_INI
    );
    expect(r.peringatan.some((x) => x.pesan.includes("Minutasi"))).toBe(true);
    expect(r.peringatan.some((x) => x.pesan.includes("hukum tetap"))).toBe(true);
  });

  it("yang berat berdiri di atas yang ringan", () => {
    const r = ringkasStatus(
      dengan({
        majelis: [],
        umur: { ...KOSONG.umur, sudahPutus: true, hariBerjalan: 30 },
        putusan: {
          sudahPutus: true,
          tanggalPutusan: "2026-01-20",
          statusPutusan: "Dikabulkan",
          tanggalMinutasi: "",
          tanggalBht: "",
          aktaCerai: null,
        },
      }),
      HARI_INI
    );
    const beratTerakhir = r.peringatan.map((x) => x.berat).lastIndexOf(true);
    const ringanPertama = r.peringatan.map((x) => x.berat).indexOf(false);
    expect(ringanPertama === -1 || beratTerakhir < ringanPertama).toBe(true);
  });

  it("perkara sehat tidak melahirkan satu pun peringatan", () => {
    // Daftar yang selalu berisi sesuatu akan diabaikan orang dalam sepekan.
    const r = ringkasStatus(
      dengan({ jadwal: [{ tanggalSidang: "2026-02-10", jamSidang: "09:00", agenda: "Jawaban", ditunda: false }] }),
      HARI_INI
    );
    expect(r.peringatan).toEqual([]);
  });
});
