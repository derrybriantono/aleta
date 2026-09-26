// @vitest-environment node

import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  BULAN_PANJANG,
  BULAN_PENDEK,
  HARI_PANJANG,
  HARI_PENDEK,
  namaHari,
  namaHariPendek,
  tanggalDMY,
  tanggalHariPanjang,
  tanggalHariPendek,
  tanggalPanjang,
  tanggalPanjangDenganHari,
  tanggalRingkas,
  tanggalSah,
} from "@/lib/tanggal-indonesia";

/**
 * ============================================================================
 * BUTIR 1 PERMINTAAN 25 SEPTEMBER 2026 - BENTUK TANGGAL
 * ============================================================================
 *
 * "ganti format dari ini 2026-10-07 menjadi 07-10-2026, sebut juga harinya
 * disamping tanggal"
 *
 * Penjaga ini menahan tiga hal yang masing-masing pernah rusak tanpa satu pun
 * galat:
 *
 *   1. bentuknya - ISO yang lolos ke layar tidak menimbulkan galat apa pun,
 *      ia hanya terbaca salah oleh orang;
 *   2. nama harinya - dihitung dari ANGKANYA, bukan dari zona mesin, sebab
 *      halaman pertama dilukis peladen (TZ=UTC) lalu dilukis ulang peramban
 *      (WITA), dan dua lukisan yang berbeda nama harinya membatalkan lukisan
 *      peladen;
 *   3. tanggal 0000-00-00 dari SIPP - yang bila diterjemahkan menjadi
 *      "30 November -1" terbaca seolah data sungguhan.
 */

const akar = path.resolve(process.cwd(), "..");
const baca = (jalur: string) =>
  readFileSync(path.join(akar, jalur), "utf8").replace(/\r\n/g, "\n");

const SUMBER = baca("manajemen_surat/src/lib/tanggal-indonesia.ts");

// Keenam layar e-Court yang dialihkan ke satu sumber ini.
const LAYAR: Array<[string, string]> = [
  ["sidang", baca("manajemen_surat/src/components/portal/aleta-ecourt-sidang.tsx")],
  [
    "status perkara",
    baca("manajemen_surat/src/components/portal/aleta-ecourt-status-perkara.tsx"),
  ],
  ["mediasi", baca("manajemen_surat/src/components/portal/aleta-ecourt-mediasi.tsx")],
  ["sk majelis", baca("manajemen_surat/src/components/portal/aleta-ecourt-sk-majelis.tsx")],
  ["cetak jadwal", baca("manajemen_surat/src/components/portal/aleta-ecourt-cetak-jadwal.tsx")],
  ["bentuk sajian", baca("manajemen_surat/src/components/portal/bentuk-sajian.tsx")],
];

describe("butir 1 - bentuk tanggal DD-MM-YYYY", () => {
  it("2026-10-07 menjadi 07-10-2026", () => {
    expect(tanggalDMY("2026-10-07")).toBe("07-10-2026");
  });

  it("hari dan bulan satu angka tetap diberi nol di depan", () => {
    // Tanpa nol di depan, kolom tanggal tidak lurus dan "5-1-2026" sekilas
    // terbaca sebagai 5 Januari maupun 1 Mei.
    expect(tanggalDMY("2026-01-05")).toBe("05-01-2026");
    expect(tanggalDMY("2026-12-31")).toBe("31-12-2026");
  });

  it("cap waktu penuh diterima, sebab sebagian ruas mengirim cap waktu", () => {
    expect(tanggalDMY("2026-10-07T00:00:00.000Z")).toBe("07-10-2026");
    expect(tanggalDMY("2026-10-07 14:30:00")).toBe("07-10-2026");
  });
});

describe("butir 1 - nama hari di samping tanggal", () => {
  it("bentuk pendek untuk tabel, bentuk panjang untuk panel", () => {
    expect(tanggalHariPendek("2026-10-07")).toBe("Rab, 07-10-2026");
    expect(tanggalHariPanjang("2026-10-07")).toBe("Rabu, 07-10-2026");
  });

  it("nama harinya benar sepanjang satu minggu penuh", () => {
    // Satu minggu penuh, bukan satu tanggal: tabel hari yang bergeser satu
    // langkah tetap menjawab benar untuk satu tanggal yang kebetulan diuji.
    const minggu: Array<[string, string]> = [
      ["2026-10-04", "Minggu"],
      ["2026-10-05", "Senin"],
      ["2026-10-06", "Selasa"],
      ["2026-10-07", "Rabu"],
      ["2026-10-08", "Kamis"],
      ["2026-10-09", "Jumat"],
      ["2026-10-10", "Sabtu"],
    ];
    for (const [iso, hari] of minggu) {
      expect(namaHari(iso), iso).toBe(hari);
      expect(namaHariPendek(iso), iso).toBe(hari.slice(0, 3));
    }
  });

  it("Sabtu dan Minggu tetap disebut - itu justru gunanya", () => {
    // Terukur di sipp_donggala atas jadwal sejak 1 September 2026: Sabtu dan
    // Minggu NOL. Tundaan yang jatuh ke akhir pekan karena itu salah ketik,
    // dan nama harinya satu-satunya tanda yang menampakkannya sebelum hari H.
    expect(namaHariPendek("2026-10-10")).toBe("Sab");
    expect(namaHariPendek("2026-10-11")).toBe("Min");
  });

  it("nama hari dihitung tanpa zona - Date.UTC, bukan getDay", () => {
    // Bukan selera penulisan: satu getDay() di berkas ini cukup untuk membuat
    // peladen (UTC) dan peramban (WITA) menulis nama hari yang berbeda untuk
    // tanggal yang sama, dan React membuang lukisan peladennya.
    expect(SUMBER).toContain("Date.UTC(");
    expect(SUMBER).toContain("getUTCDay()");
    expect(SUMBER).not.toMatch(/\.getDay\(\)/);
    expect(SUMBER).not.toMatch(/\.getMonth\(\)/);
    expect(SUMBER).not.toMatch(/toLocaleDateString/);
  });
});

describe("butir 1 - bentuk panjang hanya untuk naskah cetak", () => {
  it("bulan berhuruf untuk lembar cetak", () => {
    expect(tanggalPanjang("2026-10-07")).toBe("7 Oktober 2026");
    expect(tanggalPanjangDenganHari("2026-10-07")).toBe("Rabu, 7 Oktober 2026");
  });

  it("bentuk ringkas untuk sumbu grafik", () => {
    expect(tanggalRingkas("2026-10-07")).toBe("7 Okt");
    expect(tanggalRingkas("2026-10-07", true)).toBe("7 Okt '26");
  });

  it("nama bulan dan hari lengkap dan berurutan", () => {
    expect(BULAN_PANJANG).toHaveLength(12);
    expect(BULAN_PENDEK).toHaveLength(12);
    expect(HARI_PANJANG).toHaveLength(7);
    expect(HARI_PENDEK).toHaveLength(7);
    expect(BULAN_PANJANG[0]).toBe("Januari");
    expect(BULAN_PANJANG[11]).toBe("Desember");
    expect(HARI_PANJANG[0]).toBe("Minggu");
  });
});

describe("butir 1 - tanggal tidak sah ditolak, bukan diterjemahkan", () => {
  it("0000-00-00 dari SIPP tidak menjadi tanggal", () => {
    // Terukur 24 September 2026: 1 dari 20.109 baris perkara_jadwal_sidang.
    // new Date("0000-00-00") menjawab 30 November -1 - angka yang terbaca
    // seolah data sungguhan dan tidak dapat dibedakan dari kekeliruan entri.
    expect(tanggalSah("0000-00-00")).toBe(false);
    expect(tanggalDMY("0000-00-00")).toBe("");
    expect(tanggalDMY("0000-00-00", "—")).toBe("—");
    expect(tanggalHariPendek("0000-00-00", "—")).toBe("—");
    expect(namaHari("0000-00-00")).toBe("");
  });

  it("bulan dan hari di luar jangkauan ditolak", () => {
    expect(tanggalSah("2026-13-01")).toBe(false);
    expect(tanggalSah("2026-00-10")).toBe(false);
    expect(tanggalSah("2026-10-00")).toBe(false);
    expect(tanggalSah("2026-10-32")).toBe(false);
  });

  it("kosong, null, dan teks sembarang memulangkan cadangan", () => {
    for (const buruk of ["", "   ", "bukan tanggal", "7 Oktober 2026"]) {
      expect(tanggalDMY(buruk, "—"), JSON.stringify(buruk)).toBe("—");
    }
    expect(tanggalDMY(null, "—")).toBe("—");
    expect(tanggalDMY(undefined, "—")).toBe("—");
    expect(tanggalSah(null)).toBe(false);
  });

  it("cadangan bawaan kosong, bukan tulisan Invalid Date", () => {
    expect(tanggalDMY("x")).toBe("");
    expect(tanggalPanjang("x")).toBe("");
    expect(tanggalRingkas("x")).toBe("");
  });
});

describe("butir 1 - keenam layar memakai satu sumber ini", () => {
  it("setiap layar mengambilnya dari lib/tanggal-indonesia", () => {
    for (const [nama, isi] of LAYAR) {
      expect(isi, nama).toContain('from "@/lib/tanggal-indonesia"');
    }
  });

  it("tidak ada layar yang menyimpan tabel nama bulan atau hari sendiri", () => {
    // Sembilan pembantu terpisah adalah sebab butir ini diminta: pada satu
    // layar yang sama panitera membaca "2026-10-07", "7 Oktober 2026", dan
    // "Rab, 9 September 2026" sekaligus. Satu tabel yang tertinggal di satu
    // layar cukup untuk memulangkan keadaan itu.
    for (const [nama, isi] of LAYAR) {
      expect(isi, `${nama} - tabel bulan sendiri`).not.toMatch(
        /const\s+(NAMA_)?BULAN[A-Z_]*\s*=\s*\[/
      );
      expect(isi, `${nama} - tabel hari sendiri`).not.toMatch(
        /const\s+(NAMA_)?HARI[A-Z_]*\s*=\s*\[/
      );
      expect(isi, `${nama} - pembantu tanggal sendiri`).not.toMatch(
        /function\s+(tanggalTerbaca|tanggalUtuh|namaHariIso|tanggalPanjang|tanggalRingkas)\s*\(/
      );
    }
  });

  it("nama bulan berhuruf tidak dituliskan lagi di dalam layar", () => {
    for (const [nama, isi] of LAYAR) {
      expect(isi, `${nama} menulis "Januari" sendiri`).not.toMatch(
        /"Januari"\s*,\s*"Februari"/
      );
    }
  });
});
