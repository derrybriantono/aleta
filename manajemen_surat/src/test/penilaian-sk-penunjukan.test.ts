// @vitest-environment node
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const require_ = createRequire(import.meta.url);
const penilaian = require_(
  path.resolve(process.cwd(), "../aleta_bot/services/penilaianSippService.js")
) as {
  poinPerkara: (fakta: Record<string, unknown>) => {
    rinci: Array<{ kunci: string; poin: number | null; terbaca: boolean; catatan: string }>;
  };
};

/**
 * Penilaian SK Dirjen Badilag 048/2024 - unsur penunjukan PP dan juru sita.
 *
 * ============================================================================
 * YANG DINILAI PENUNJUKAN PERTAMA, BUKAN PENGGANTINYA
 * ============================================================================
 *
 * perkara_penetapan hanya punya SATU baris per perkara - diperiksa di PA
 * Donggala: 9.834 perkara, seluruhnya satu baris. Penggantian panitera
 * pengganti atau juru sita karena itu MENIMPA tanggal di baris yang sama.
 *
 * Akibatnya SK Tabel 2 I.4 dan I.6 - yang mengukur jarak dari PMH ke
 * penunjukan - menghitung jarak ke PENGGANTIAN yang terjadi berbulan-bulan
 * kemudian, lalu memberi nilai nol atas pekerjaan yang sebenarnya dikerjakan
 * pada hari yang sama.
 *
 * Pengukuran yang membuktikannya:
 *
 *   panitera pengganti  465 perkara berbaris lebih dari satu, 440 di antaranya
 *                       tanggalnya berbeda dari penunjukan pertama
 *   juru sita            71 perkara, 52 di antaranya berbeda
 *   perkara 376         penunjukan pertama 2015-12-03, tersimpan 2016-08-23
 *
 * ============================================================================
 * DAN SATU LUBANG YANG TERSINGKAP KARENANYA
 * ============================================================================
 *
 * tangga() memulangkan poin TERTINGGI untuk selisih negatif - "-95 <= 0"
 * bernilai 5, sama dengan yang dikerjakan pada hari yang sama. Selama tanggal
 * yang dipakai adalah tanggal penggantian, keadaan itu jarang muncul sebab
 * penggantian selalu sesudah PMH. Begitu yang dinilai dikembalikan ke
 * penunjukan pertama, urutan terbalik menjadi biasa - PA Donggala kerap
 * menunjuk PP dan juru sita pada hari pendaftaran sedangkan majelisnya
 * ditetapkan menyusul.
 *
 * Memperbaiki tanggalnya TANPA menutup lubang ini akan memberi nilai sempurna
 * kepada ratusan perkara atas urutan yang tidak mungkin terjadi.
 */

function unsur(fakta: Record<string, unknown>, kunci: string) {
  const hasil = penilaian.poinPerkara(fakta);
  const butir = hasil.rinci.find((x) => x.kunci === kunci);
  if (!butir) throw new Error(`unsur ${kunci} tidak ada`);
  return butir;
}

describe("penunjukan pada hari yang sama bernilai penuh", () => {
  it("PP dan juru sita ditunjuk sehari dengan PMH", () => {
    const fakta = {
      tanggalPmh: "2026-07-07",
      tanggalPpp: "2026-07-07",
      tanggalPjs: "2026-07-07",
    };
    expect(unsur(fakta, "penunjukanPp").poin).toBe(5);
    expect(unsur(fakta, "penunjukanJurusita").poin).toBe(5);
  });

  it("tangga SK dipatuhi apa adanya", () => {
    // SK 048/2024 Tabel 2 I.4: hari yang sama 5, hari 1-2 nilai 3, 3-4 nilai 2,
    // 5-9 nilai 1, 10 atau lebih nilai 0.
    const pada = (hari: number) =>
      unsur(
        {
          tanggalPmh: "2026-07-01",
          tanggalPpp: new Date(Date.UTC(2026, 6, 1 + hari)).toISOString().slice(0, 10),
        },
        "penunjukanPp"
      ).poin;
    expect(pada(0)).toBe(5);
    expect(pada(2)).toBe(3);
    expect(pada(4)).toBe(2);
    expect(pada(9)).toBe(1);
    expect(pada(10)).toBe(0);
  });
});

describe("urutan terbalik tidak dinilai - dan tidak dihitung nol", () => {
  const terbalik = {
    tanggalPmh: "2026-08-04",
    tanggalPpp: "2026-07-07",
    tanggalPjs: "2026-07-07",
  };

  it("penunjukan yang mendahului PMH TIDAK bernilai sempurna", () => {
    // Inilah lubangnya: -28 lolos syarat "<= 0" pada tangga dan mendapat 5.
    expect(unsur(terbalik, "penunjukanPp").poin).not.toBe(5);
    expect(unsur(terbalik, "penunjukanJurusita").poin).not.toBe(5);
  });

  it("tidak dinilai sama sekali, bukan dinilai nol", () => {
    // Nol menuduh pengadilan atas keadaan yang belum tentu kesalahannya -
    // dapat saja tanggal PMH yang keliru, bukan penunjukannya.
    for (const kunci of ["penunjukanPp", "penunjukanJurusita"]) {
      const butir = unsur(terbalik, kunci);
      expect(butir.poin, kunci).toBeNull();
      expect(butir.terbaca, kunci).toBe(false);
    }
  });

  it("sebabnya disebutkan beserta selisihnya", () => {
    // Unsur yang tidak dinilai tanpa sebab tidak dapat dibetulkan siapa pun.
    const butir = unsur(terbalik, "penunjukanPp");
    expect(butir.catatan).toContain("28 hari SEBELUM");
    expect(butir.catatan).toContain("tidak mungkin");
  });

  it("penunjukan yang belum tercatat tetap nol, bukan tidak dinilai", () => {
    // Bedanya menentukan: yang belum tercatat memang belum dikerjakan, dan itu
    // pekerjaan yang tertinggal. Yang urutannya terbalik justru sudah
    // dikerjakan - hanya tanggalnya yang bertentangan.
    const kosong = { tanggalPmh: "2026-07-07", tanggalPpp: null, tanggalPjs: null };
    expect(unsur(kosong, "penunjukanPp").poin).toBe(0);
    expect(unsur(kosong, "penunjukanPp").terbaca).toBe(true);
  });
});

describe("tanggal penunjukan dibaca dari tabel petugas", () => {
  const berkasTahapan = path.resolve(
    process.cwd(),
    "../aleta_bot/services/sippTahapanService.js"
  );

  it("penunjukan pertama diambil dari perkara_panitera_pn dan perkara_jurusita", () => {
    const isi = readFileSync(berkasTahapan, "utf8");
    expect(isi).toContain("const tanggalPenunjukanPertama = async (tabel)");
    expect(isi).toContain('tanggalPenunjukanPertama("perkara_panitera_pn")');
    expect(isi).toContain('tanggalPenunjukanPertama("perkara_jurusita")');
  });

  it("yang dipakai tanggal TERAWAL, bukan baris ber-id terkecil", () => {
    // id mengikuti urutan penulisan baris, dan baris yang ditulis menyusul
    // untuk membetulkan catatan lama akan ber-id besar meski tanggalnya
    // paling awal.
    const isi = readFileSync(berkasTahapan, "utf8");
    expect(isi).toContain("SELECT MIN(t.${kolom}) AS pertama");
  });

  it("PMH sengaja TIDAK ikut diperlakukan begini", () => {
    // PMH menetapkan satu MAJELIS - bukan satu orang - dan tanggal penetapan
    // tiap anggotanya tidak selalu sama dengan tanggal penetapan majelisnya.
    const isi = readFileSync(berkasTahapan, "utf8");
    expect(isi).not.toContain('tanggalPenunjukanPertama("perkara_hakim_pn")');
    expect(isi).toContain("PMH sengaja TIDAK ikut diperlakukan begini");
  });

  it("perkara tanpa tabel petugas tetap memakai tanggal lama", () => {
    // Tidak ada yang lebih benar untuk dipakai, dan mengosongkannya akan
    // menghapus tanggal yang selama ini terbaca.
    const isi = readFileSync(berkasTahapan, "utf8");
    expect(isi).toContain("hanya bila memang terbaca");
  });
});
