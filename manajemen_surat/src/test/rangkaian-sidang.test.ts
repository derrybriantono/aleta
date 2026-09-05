// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  hariIndonesia,
  penandaDariSidang,
  ringkasSebelumnya,
  sidangKe,
  susunRangkaian,
  tanggalIndonesia,
} from "@/lib/rangkaian-sidang";

/**
 * Rangkaian sidang - BAS berikutnya tahu apa yang terjadi sebelumnya.
 *
 * ============================================================================
 * YANG DIJAGA DI SINI
 * ============================================================================
 *
 * Baris di bawah ini SALINAN APA ADANYA dari perkara_jadwal_sidang perkara
 * 521/Pdt.G/2026/PA.Dgl di server - termasuk kebiasaan SIPP menyimpan angka
 * sebagai teks dan menandai penundaan dengan "Y"/"T". Contoh karangan yang
 * kebetulan rapi akan menyembunyikan justru kekeliruan yang paling mungkin
 * terjadi.
 *
 * Yang paling berbahaya: BAS lanjutan yang menyebut dirinya sidang pertama,
 * atau hari yang tidak cocok dengan tanggalnya - keduanya tertulis pada naskah
 * yang sama dan baru ketahuan setelah ditandatangani.
 */

const RIWAYAT = [
  {
    sidangKe: "2",
    urutan: "2",
    tanggalSidang: "2026-09-15",
    jamSidang: "09:00:00",
    agenda: "Panggil Tergugat",
    ruangan: "Ruang Sidang 1 Dalam Gedung",
    ditunda: "T",
    alasanDitunda: "",
    tanggalDitunda: null,
    alasanSebelumnya: "Panggil Tergugat",
    tanggalSebelumnya: "2026-09-01",
    agendaSebelumnya: "Sidang Pertama",
  },
  {
    sidangKe: "1",
    urutan: "1",
    tanggalSidang: "2026-09-01",
    jamSidang: "09:22:19",
    agenda: "Sidang Pertama",
    ruangan: "Ruang Sidang 1 Dalam Gedung",
    ditunda: "Y",
    alasanDitunda: "Panggil Tergugat",
    tanggalDitunda: "2026-09-15",
    alasanSebelumnya: "",
    tanggalSebelumnya: null,
    agendaSebelumnya: "",
  },
];

describe("menyusun rangkaian", () => {
  it("diurutkan menurut nomor sidang, bukan urutan baris", () => {
    // SIPP mengembalikan sidang ke-2 lebih dulu. BAS yang menyebut sidang ke-2
    // sebagai sidang pertama tidak dapat ditarik setelah ditandatangani.
    const rangkaian = susunRangkaian(RIWAYAT);
    expect(rangkaian.map((s) => s.sidangKe)).toEqual([1, 2]);
  });

  it("penundaan terbaca beserta alasannya", () => {
    const pertama = susunRangkaian(RIWAYAT)[0];
    expect(pertama.ditunda).toBe(true);
    expect(pertama.alasanDitunda).toBe("Panggil Tergugat");
    expect(pertama.tanggalDitunda).toBe("2026-09-15");
  });

  it("sidang pertama tidak punya sidang sebelumnya", () => {
    expect(susunRangkaian(RIWAYAT)[0].sebelumnya).toBeNull();
  });

  it("sidang lanjutan membawa sidang sebelumnya dari SIPP", () => {
    const kedua = susunRangkaian(RIWAYAT)[1];
    expect(kedua.sebelumnya?.tanggal).toBe("2026-09-01");
    expect(kedua.sebelumnya?.agenda).toBe("Sidang Pertama");
    expect(kedua.sebelumnya?.alasan).toBe("Panggil Tergugat");
  });

  it("riwayat kosong atau tidak berbentuk larik tidak menjatuhkan apa pun", () => {
    expect(susunRangkaian(null)).toEqual([]);
    expect(susunRangkaian({})).toEqual([]);
    expect(susunRangkaian([])).toEqual([]);
  });
});

describe("hari dan tanggal", () => {
  it("hari dan tanggal dibaca dengan aturan zona yang sama", () => {
    // Kalau keduanya dibaca beda zona, BAS dapat menyebut "Senin, 2 September
    // 2026" untuk tanggal yang jatuh pada Selasa - keduanya di naskah yang sama.
    expect(hariIndonesia("2026-09-01")).toBe("Selasa");
    expect(tanggalIndonesia("2026-09-01")).toBe("1 September 2026");
    expect(hariIndonesia("2026-09-15")).toBe("Selasa");
    expect(tanggalIndonesia("2026-09-15")).toBe("15 September 2026");
  });

  it("tanggal yang tidak terbaca menghasilkan kosong, bukan tebakan", () => {
    expect(hariIndonesia("")).toBe("");
    expect(hariIndonesia("bukan tanggal")).toBe("");
    expect(tanggalIndonesia(null)).toBe("");
  });
});

describe("memilih sidang menurut blangkonya", () => {
  it("blangko BAS 2 mengambil sidang ke-2", () => {
    const sidang = sidangKe(susunRangkaian(RIWAYAT), 2);
    expect(sidang?.tanggal).toBe("2026-09-15");
    expect(sidang?.agenda).toBe("Panggil Tergugat");
  });

  it("sidang yang belum tercatat mengembalikan kosong, bukan sidang terdekat", () => {
    // Mengambil yang terdekat berarti BAS sidang ke-3 memuat tanggal sidang
    // ke-2 - dan tanggal itu terbaca wajar sehingga tidak ada yang memeriksanya.
    expect(sidangKe(susunRangkaian(RIWAYAT), 3)).toBeNull();
    expect(sidangKe(susunRangkaian(RIWAYAT), 0)).toBeNull();
  });
});

describe("penanda dari sidang", () => {
  it("hari, tanggal, dan sebutan sidang terisi", () => {
    const peta = penandaDariSidang(sidangKe(susunRangkaian(RIWAYAT), 1));
    expect(peta.get("0032")?.nilai).toBe("Selasa");
    expect(peta.get("0033")?.nilai).toBe("1 September 2026");
    expect(peta.get("9003")?.nilai).toBe("Pertama");
  });

  it("sidang ke-2 dan seterusnya disebut Lanjutan", () => {
    const peta = penandaDariSidang(sidangKe(susunRangkaian(RIWAYAT), 2));
    expect(peta.get("9003")?.nilai).toBe("Lanjutan");
    expect(peta.get("0033")?.nilai).toBe("15 September 2026");
  });

  it("tanpa sidang tidak ada penanda yang diisi", () => {
    expect(penandaDariSidang(null).size).toBe(0);
  });

  it("asal penanda menyebut sidang ke berapa", () => {
    const peta = penandaDariSidang(sidangKe(susunRangkaian(RIWAYAT), 2));
    expect(peta.get("0033")?.asal).toContain("sidang ke-2");
  });
});

describe("ringkasan sidang sebelumnya", () => {
  it("menyebut hari, tanggal, agenda, dan alasan penundaan", () => {
    const kalimat = ringkasSebelumnya(sidangKe(susunRangkaian(RIWAYAT), 2));
    expect(kalimat).toContain("Selasa");
    expect(kalimat).toContain("1 September 2026");
    expect(kalimat).toContain("Sidang Pertama");
    expect(kalimat).toContain("Panggil Tergugat");
  });

  it("sidang pertama tidak menghasilkan ringkasan", () => {
    expect(ringkasSebelumnya(sidangKe(susunRangkaian(RIWAYAT), 1))).toBe("");
    expect(ringkasSebelumnya(null)).toBe("");
  });
});
