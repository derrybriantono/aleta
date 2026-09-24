// @vitest-environment node
import { describe, expect, it } from "vitest";

import { susunPerjalananSidang, type SidangPerjalanan } from "@/lib/perjalanan-sidang";

/**
 * Hitungan grafik "Umur perkara pada tiap sidang" di layar Status Perkara.
 *
 * Datanya diukur dari sipp_donggala lokal (24 Sep 2026), bukan dikarang:
 * yang dijaga adalah bahwa titik pada hari putusan SAMA PERSIS dengan "Lama
 * perkara" di kepala layar - rumus sippStatusPerkaraService.hariBersih.
 */

const baris = (d: ReadonlyArray<readonly [string, string, string, string]>): SidangPerjalanan[] =>
  d.map(([tanggalSidang, agenda, tunda, alasanDitunda], i) => ({
    sidangId: String(i + 1),
    tanggalSidang,
    agenda,
    ditunda: tunda === "Y",
    alasanDitunda,
  }));

/** 385/Pdt.G/2026/PA.Dgl (perkara_id 9892). */
const JADWAL_385 = baris([
  ["2026-07-15", "Sidang Pertama", "Y", "proses mediasi"],
  ["2026-08-12", "mendengarkan hasil mediasi", "Y", "Jawaban Tergugat"],
  ["2026-08-18", "Jawaban Tergugat", "Y", "Jawaban Tergugat"],
  ["2026-08-21", "Replik Penggugat", "Y", "Duplik Tergugat"],
  ["2026-08-24", "Duplik Tergugat", "Y", "Pembuktian Penggugat"],
  ["2026-08-26", "Pembuktian Penggugat", "Y", "Panggil Tergugat"],
  ["2026-09-09", "Pembuktian Penggugat", "Y", "Pembuktian Tergugat"],
  ["2026-09-16", "Pembuktian Tergugat", "T", ""],
]);
const MEDIASI_385 = {
  tanggalMulai: "2026-07-15",
  tanggalDimulaiTercatat: "2026-07-15",
  tanggalLaporan: "2026-08-10",
  tanggalSelesai: "2026-08-10",
};

/** 274/Pdt.G/2026/PA.Dgl (perkara_id 9730) - putus 12 Agu, dua sidang ikrar sesudahnya. */
const JADWAL_274 = baris([
  ["2026-05-12", "Sidang Pertama", "Y", "Mediasi Para Pihak"],
  ["2026-05-26", "Mendengar Laporan Hasil Mediasi", "Y", "Jawaban Termohon"],
  ["2026-05-29", "Jawaban Termohon", "Y", "Replik Pemohon"],
  ["2026-06-02", "Replik Pemohon", "Y", "Duplik Termohon"],
  ["2026-06-05", "Duplik Termohon", "Y", "Duplik Rekonvensi"],
  ["2026-06-09", "Duplik Rekonvensi", "Y", "Pembuktian Pemohon"],
  ["2026-06-23", "Pembuktian Pemohon", "Y", "Bukti Saksi Pemohon"],
  ["2026-06-30", "Pembuktian Lanjutan Pemohon", "Y", "Termohon tidak hadir"],
  ["2026-07-07", "Pembuktian Lanjutan Pemohon", "Y", "Pembuktian Termohon"],
  ["2026-07-14", "Pembuktian Termohon", "Y", "Pembuktian Lanjutan Termohon"],
  ["2026-07-21", "Pembuktian Lanjutan Termohon", "Y", "Kesimpulan"],
  ["2026-07-27", "Kesimpulan", "Y", "Musyawarah Majelis"],
  ["2026-08-12", "Musyawarah Majelis", "T", "putus DIKABULKAN"],
  ["2026-09-09", "SIDANG IKRAR TALAK", "Y", "Pemohon belum siap membayar pembebanan, tunda 6 bulan"],
  ["2027-03-09", "pengucapan ikrar talak", "T", ""],
]);

describe("perjalanan sidang dihitung seperti Lama perkara", () => {
  it("hari pendaftaran hari ke-1, mediasi dikeluarkan pada TANGGALNYA", () => {
    const h = susunPerjalananSidang({
      tanggalDaftar: "2026-06-30",
      tanggalPutusan: "",
      hariMediasi: 26,
      jadwal: JADWAL_385,
      mediasi: [MEDIASI_385],
      hariIni: "2026-09-17",
    })!;
    expect(h.titik.map((t) => t.hari)).toEqual([16, 18, 24, 27, 30, 32, 46, 53]);
    expect(h.titik.map((t) => t.jeda)).toEqual([null, 28, 6, 3, 3, 2, 14, 7]);
    // Sidang pertama jatuh pada hari mediasi dimulai - belum ada yang dipotong.
    expect(h.titik[0].potonganMediasi).toBe(0);
    expect(h.titik[1].potonganMediasi).toBe(26);
    expect(h.titik[0].alasanTunda).toBe("proses mediasi");
  });

  it("titik pada hari putusan sama persis dengan rumus kepala layar", () => {
    const h = susunPerjalananSidang({
      tanggalDaftar: "2026-04-27",
      tanggalPutusan: "2026-08-12",
      hariMediasi: 14,
      jadwal: JADWAL_274,
      mediasi: [
        {
          tanggalMulai: "2026-05-12",
          tanggalDimulaiTercatat: "2026-05-12",
          tanggalLaporan: "2026-05-26",
          tanggalSelesai: "2026-05-26",
        },
      ],
      hariIni: "2026-09-24",
    })!;
    const akhir = h.titik[h.titik.length - 1];
    expect(akhir.hariPutus).toBe(true);
    // (107 + 1) - min(14, 107) - rumus sippStatusPerkaraService.hariBersih.
    expect(akhir.hari).toBe(94);
    expect(akhir.hari).toBe(akhir.hariKalender + 1 - Math.min(14, akhir.hariKalender));
    // "putus DIKABULKAN" bukan alasan tunda.
    expect(akhir.alasanTunda).toBe("");
    expect(akhir.keterangan).toBe("putus DIKABULKAN");
  });

  it("sidang sesudah putusan tidak digambar, dan jumlahnya DISEBUT", () => {
    const h = susunPerjalananSidang({
      tanggalDaftar: "2026-04-27",
      tanggalPutusan: "2026-08-12",
      hariMediasi: 14,
      jadwal: JADWAL_274,
      mediasi: [],
      hariIni: "2026-09-24",
    })!;
    expect(h.titik).toHaveLength(13);
    expect(h.sesudahPutus).toBe(2);
    expect(Math.max(...h.titik.map((t) => t.hariKalender))).toBe(107);
  });

  it("potongan yang tidak dapat ditempatkan dikatakan, bukan disebar diam-diam", () => {
    const h = susunPerjalananSidang({
      tanggalDaftar: "2026-06-30",
      tanggalPutusan: "",
      hariMediasi: 26,
      jadwal: JADWAL_385,
      mediasi: [],
      hariIni: "2026-09-17",
    })!;
    expect(h.potonganTakTerletak).toBe(true);
    expect(h.titik[1].hari).toBe(44);
  });

  it("baris mediasi kembar tidak dipotong dua kali, dan yang berujung menang", () => {
    const h = susunPerjalananSidang({
      tanggalDaftar: "2026-06-30",
      tanggalPutusan: "",
      hariMediasi: 52,
      jadwal: JADWAL_385,
      mediasi: [MEDIASI_385, MEDIASI_385, { ...MEDIASI_385, tanggalLaporan: "", tanggalSelesai: "" }],
      hariIni: "2026-09-17",
    })!;
    expect(h.rentangMediasi).toEqual([{ mulai: "2026-07-15", selesai: "2026-08-10", hari: 26, tanpaLaporan: false }]);
    expect(h.titik[1].potonganMediasi).toBe(26);
  });

  it("sidang yang akan datang ditandai, yang sudah lewat tidak", () => {
    const h = susunPerjalananSidang({
      tanggalDaftar: "2026-06-30",
      tanggalPutusan: "",
      hariMediasi: 26,
      jadwal: JADWAL_385,
      mediasi: [MEDIASI_385],
      hariIni: "2026-09-10",
    })!;
    expect(h.titik.map((t) => t.akanDatang)).toEqual([false, false, false, false, false, false, false, true]);
  });

  it("tanggal pendaftaran tak terbaca: tidak ada grafik", () => {
    expect(
      susunPerjalananSidang({
        tanggalDaftar: "",
        tanggalPutusan: "",
        hariMediasi: 0,
        jadwal: JADWAL_385,
        mediasi: [],
        hariIni: "2026-09-17",
      })
    ).toBeNull();
  });
});

describe("titik menyebut nomor sidang SIPP, bukan posisinya", () => {
  /**
   * Daftar Perjalanan sidang tepat di atas grafik bernomor menurut
   * perkara_jadwal_sidang.urutan. Titik yang dinomori menurut posisinya akan
   * berselisih dengan daftar itu begitu satu sidang tidak digambar.
   */
  const bernomor = (jadwal: SidangPerjalanan[]) => jadwal.map((s, i) => ({ ...s, urutanSidang: i + 1 }));

  it("nomor SIPP dipakai bila dikirim bot", () => {
    const h = susunPerjalananSidang({
      tanggalDaftar: "2026-06-30",
      tanggalPutusan: "",
      hariMediasi: 26,
      jadwal: bernomor(JADWAL_385),
      mediasi: [MEDIASI_385],
      hariIni: "2026-09-17",
    })!;
    expect(h.titik.map((t) => t.ke)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("sidang yang tidak digambar tidak menggeser nomor sidang sesudahnya", () => {
    // Sidang ke-2 bertanggal rusak (salah catat): dulu posisi membuat sidang
    // ke-3 disebut "ke-2". Nomornya kini tetap nomor SIPP-nya.
    const jadwal = bernomor(JADWAL_385).map((s) => (s.urutanSidang === 2 ? { ...s, tanggalSidang: "2026-13-45" } : s));
    const h = susunPerjalananSidang({
      tanggalDaftar: "2026-06-30",
      tanggalPutusan: "",
      hariMediasi: 26,
      jadwal,
      mediasi: [MEDIASI_385],
      hariIni: "2026-09-17",
    })!;
    expect(h.tanpaTanggal).toBe(1);
    expect(h.titik.map((t) => t.ke)).toEqual([1, 3, 4, 5, 6, 7, 8]);
  });

  it("tanpa nomor (bot lama), posisinya menjadi cadangan", () => {
    const h = susunPerjalananSidang({
      tanggalDaftar: "2026-06-30",
      tanggalPutusan: "",
      hariMediasi: 26,
      jadwal: JADWAL_385.map((s) => ({ ...s, urutanSidang: 0 })),
      mediasi: [MEDIASI_385],
      hariIni: "2026-09-17",
    })!;
    expect(h.titik.map((t) => t.ke)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("dua sidang pada hari yang sama diurutkan menurut nomornya, bukan urutan kirimnya", () => {
    // Terukur pada dua perkara PA Donggala: jam dua sidang sehari tercatat
    // terbalik terhadap nomornya. "ke-" di bawah sumbu tidak boleh menurun.
    const jadwal: SidangPerjalanan[] = [
      { sidangId: "a", tanggalSidang: "2026-07-01", agenda: "Pertama", ditunda: true, alasanDitunda: "", urutanSidang: 1 },
      { sidangId: "c", tanggalSidang: "2026-07-08", agenda: "Ketiga", ditunda: true, alasanDitunda: "", urutanSidang: 3 },
      { sidangId: "b", tanggalSidang: "2026-07-08", agenda: "Kedua", ditunda: true, alasanDitunda: "", urutanSidang: 2 },
      { sidangId: "d", tanggalSidang: "2026-07-15", agenda: "Keempat", ditunda: false, alasanDitunda: "", urutanSidang: 4 },
    ];
    const h = susunPerjalananSidang({
      tanggalDaftar: "2026-06-30",
      tanggalPutusan: "",
      hariMediasi: 0,
      jadwal,
      mediasi: [],
      hariIni: "2026-09-17",
    })!;
    expect(h.titik.map((t) => t.ke)).toEqual([1, 2, 3, 4]);
    expect(h.titik.map((t) => t.agenda)).toEqual(["Pertama", "Kedua", "Ketiga", "Keempat"]);
    // Masukan tidak diubah di tempat.
    expect(jadwal.map((s) => s.sidangId)).toEqual(["a", "c", "b", "d"]);
  });
});
