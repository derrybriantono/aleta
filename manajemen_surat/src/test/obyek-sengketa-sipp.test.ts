// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  AMBANG_YAKIN,
  RIWAYAT_MINIMUM,
  kunciObyek,
  rangkumKebiasaanObyek,
  usulkanObyekSengketa,
} from "@/lib/obyek-sengketa-sipp";

/**
 * ============================================================================
 * OBYEK SENGKETA - KEBIASAAN SATKER
 * ============================================================================
 *
 * Angka-angka di bawah ini disalin apa adanya dari sipp_donggala pada
 * 12 September 2026, dikelompokkan menurut jenis perkara. Yang diuji bukan
 * "apakah penggabungnya jalan" melainkan apakah ia memutuskan hal yang benar
 * pada sebaran yang sesungguhnya: cerai gugat nyaris bulat, penetapan ahli
 * waris tidak, dan itsbat punya dua kebiasaan yang sama-sama sah.
 */

/** Cerai gugat (347): 1.345 perkara, satu maksud, empat ejaan. */
const CERAI_GUGAT = [
  { obyek: "Pernikahan/Perceraian", jumlah: 895 },
  { obyek: "Pernikahan / Perceraian", jumlah: 273 },
  { obyek: "Pernikahan atau Perceraian", jumlah: 128 },
  { obyek: "Perkawinan/Perceraian", jumlah: 9 },
];

/** Itsbat nikah (360): dua kebiasaan yang berbeda, ditambah ejaan-ejaan pengesahan. */
const ITSBAT = [
  { obyek: "Pernikahan", jumlah: 186 },
  { obyek: "Isbat Nikah", jumlah: 172 },
  { obyek: "Pengesahan perkawinan / isbat nikah", jumlah: 44 },
  { obyek: "Pengesahan Perkawinan/Istbat Nikah", jumlah: 27 },
  { obyek: "Pengesahan Perkawinan / Istbat Nikah", jumlah: 22 },
  { obyek: "Pengesahan Perkawinan/Isbat Nikah", jumlah: 19 },
  { obyek: "Istbat Nikah", jumlah: 16 },
];

/** Penetapan ahli waris (371): obyeknya keadaan perkara, bukan kebiasaan. */
const AHLI_WARIS = [
  { obyek: "Penetapan Ahli Waris", jumlah: 17 },
  { obyek: "Ahli Waris", jumlah: 6 },
  { obyek: "Dana BPJS Ketenagakerjaan", jumlah: 1 },
  { obyek: "Tanah dan Tanaman/ Tumbuhan", jumlah: 1 },
];

describe("kunci penggabungan ejaan", () => {
  it("spasi di sekitar garis miring dan kata 'atau' disamakan", () => {
    expect(kunciObyek("Pernikahan / Perceraian")).toBe(kunciObyek("Pernikahan/Perceraian"));
    expect(kunciObyek("Pernikahan atau Perceraian")).toBe(kunciObyek("Pernikahan/Perceraian"));
  });

  it("perkawinan dan pernikahan, istbat dan isbat, disamakan", () => {
    expect(kunciObyek("Perkawinan/Perceraian")).toBe(kunciObyek("Pernikahan/Perceraian"));
    expect(kunciObyek("Istbat Nikah")).toBe(kunciObyek("Isbat Nikah"));
    expect(kunciObyek("Itsbat Nikah")).toBe(kunciObyek("Isbat Nikah"));
  });

  it("kata yang berbeda TIDAK disamakan", () => {
    // "Pernikahan" dan "Isbat Nikah" adalah dua kebiasaan yang berbeda pada
    // perkara itsbat; menggabungkannya berarti mengarang kebiasaan yang
    // tidak pernah ada.
    expect(kunciObyek("Pernikahan")).not.toBe(kunciObyek("Isbat Nikah"));
  });

  it("tanda baca di ujung dan huruf besar-kecil tidak membedakan", () => {
    expect(kunciObyek("PERNIKAHAN/PERCERAIAN.")).toBe(kunciObyek("pernikahan/perceraian"));
  });
});

describe("cerai gugat - kebiasaan yang nyaris bulat", () => {
  const hasil = usulkanObyekSengketa(CERAI_GUGAT);

  it("empat ejaan menjadi satu kebiasaan", () => {
    expect(hasil.usulan).toHaveLength(1);
    expect(hasil.usulan[0].jumlah).toBe(1305);
    expect(hasil.total).toBe(1305);
  });

  it("yang diusulkan adalah ejaan yang paling sering dipakai, bukan ejaan pertama yang dibaca", () => {
    expect(hasil.usulan[0].nilai).toBe("Pernikahan/Perceraian");
  });

  it("ejaan lain tercatat sebagai varian, tanpa yang terpilih", () => {
    expect(hasil.usulan[0].varian).toEqual([
      "Pernikahan / Perceraian",
      "Pernikahan atau Perceraian",
      "Perkawinan/Perceraian",
    ]);
  });

  it("dicentang sendiri - kebiasaannya bulat dan riwayatnya panjang", () => {
    expect(hasil.yakin).toBe(true);
    expect(hasil.usulan[0].bagian).toBeCloseTo(1, 5);
  });
});

describe("itsbat nikah - dua kebiasaan yang sama-sama sah", () => {
  const hasil = usulkanObyekSengketa(ITSBAT);

  it("'Pernikahan' dan 'Isbat Nikah' tetap dua kebiasaan terpisah", () => {
    // Sesudah "Istbat Nikah" (16) bergabung, Isbat Nikah berjumlah 188 dan
    // mengungguli "Pernikahan" (186) - selisih dua perkara. Urutannya
    // mengikuti jumlah SESUDAH penggabungan, bukan ejaan tunggal terbanyak.
    const nilai = hasil.usulan.map((x) => x.nilai);
    expect(nilai.slice(0, 2)).toEqual(["Isbat Nikah", "Pernikahan"]);
  });

  it("empat ejaan pengesahan perkawinan menjadi satu", () => {
    const pengesahan = rangkumKebiasaanObyek(ITSBAT).daftar.find((x) => /pengesahan/i.test(x.nilai));
    expect(pengesahan?.jumlah).toBe(44 + 27 + 22 + 19);
    expect(pengesahan?.nilai).toBe("Pengesahan perkawinan / isbat nikah");
  });

  it("'Istbat Nikah' bergabung ke 'Isbat Nikah'", () => {
    const isbat = hasil.usulan.find((x) => x.nilai === "Isbat Nikah");
    expect(isbat?.jumlah).toBe(172 + 16);
    expect(isbat?.varian).toContain("Istbat Nikah");
  });

  it("TIDAK dicentang sendiri - tidak ada yang mencapai ambang", () => {
    // 186 dari 486 adalah 38%. Mencentangnya berarti mesin memilihkan satu
    // dari dua kebiasaan yang sama-sama dipakai satker, dan itu keputusan
    // petugas.
    expect(hasil.yakin).toBe(false);
    expect(hasil.usulan[0].bagian).toBeLessThan(AMBANG_YAKIN);
  });

  it("hanya tiga teratas yang ditawarkan", () => {
    expect(hasil.usulan).toHaveLength(3);
  });
});

describe("penetapan ahli waris - obyeknya keadaan perkara, bukan kebiasaan", () => {
  it("riwayat pendek tidak pernah dicentang sendiri walau bagiannya besar", () => {
    const hasil = usulkanObyekSengketa(AHLI_WARIS);
    expect(hasil.total).toBe(25);
    expect(hasil.total).toBeGreaterThanOrEqual(RIWAYAT_MINIMUM);
    // 17 dari 25 adalah 68% - di bawah ambang. Yang menulis "Dana BPJS
    // Ketenagakerjaan" tahu perkaranya; kebiasaan tidak berhak menimpanya.
    expect(hasil.yakin).toBe(false);
  });

  it("riwayat di bawah minimum tidak dicentang meski bulat", () => {
    const hasil = usulkanObyekSengketa([{ obyek: "Perwalian", jumlah: 5 }]);
    expect(hasil.usulan[0].bagian).toBe(1);
    expect(hasil.yakin).toBe(false);
  });
});

describe("yang tidak dapat dihitung", () => {
  it("tanpa riwayat memulangkan kosong, bukan melempar", () => {
    const hasil = usulkanObyekSengketa([]);
    expect(hasil.total).toBe(0);
    expect(hasil.yakin).toBe(false);
    expect(hasil.usulan).toEqual([]);
  });

  it("baris kosong dan jumlah nol disingkirkan", () => {
    const hasil = rangkumKebiasaanObyek([
      { obyek: "   ", jumlah: 40 },
      { obyek: "Pernikahan", jumlah: 0 },
      { obyek: "Pernikahan", jumlah: 3 },
    ]);
    expect(hasil.total).toBe(3);
    expect(hasil.daftar).toHaveLength(1);
  });
});
