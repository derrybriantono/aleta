// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  AMBANG_TEPAT_WAKTU_HARI,
  DAFTAR_DOKUMEN_EVIDEN_SKP,
  KOLOM_STATUS_PERKARA,
  durasiPerkara,
  hariMediasiBersih,
  ikrarSesuai,
  konteksEviden,
  lamaDijalani,
  masukPeriodePemeriksa,
  persen,
  selStatusPerkara,
  susunDokumenEvidenSkp,
  susunPaketEvidenSkp,
  teksPihak,
} from "@/lib/eviden-skp-katalog";
import type { BarisEvidenSkp, DataEvidenSkp, DokumenEvidenSkp, PeriodeSkp } from "@/lib/eviden-skp-tipe";

/**
 * ============================================================================
 * KATALOG EVIDEN SKP - PILIHAN PERKARA, TEKS SEL, REALISASI, DAN DASARNYA
 * ============================================================================
 *
 * Keempat perkara contoh spreadsheet pengguna ("SKP 2026 DERRY BRIANTONO")
 * ditulis ulang di sini sebagai FAKTA, persis seperti yang dibaca bot dari
 * sipp_donggala 27 September 2026. Durasi dan teks selnya harus sama dengan
 * spreadsheet itu - kecuali selisih yang disengaja dan dijelaskan (Putusan
 * perkara dicabut, Musyawarah Majelis yang tidak diagendakan di SIPP).
 */

const TW1: PeriodeSkp = {
  kunci: "tw1",
  tahun: 2026,
  label: "Triwulan I",
  labelPanjang: "Triwulan I Tahun 2026",
  mulai: "2026-01-01",
  selesai: "2026-03-31",
  bulan: 3,
};
const TW2: PeriodeSkp = { ...TW1, kunci: "tw2", label: "Triwulan II", labelPanjang: "Triwulan II Tahun 2026", mulai: "2026-04-01", selesai: "2026-06-30" };
const TW3: PeriodeSkp = { ...TW1, kunci: "tw3", label: "Triwulan III", labelPanjang: "Triwulan III Tahun 2026", mulai: "2026-07-01", selesai: "2026-09-30" };

let urut = 0;
function baris(over: Partial<BarisEvidenSkp> = {}): BarisEvidenSkp {
  urut += 1;
  return {
    perkaraId: String(5000 + urut),
    nomorPerkara: `${urut}/Pdt.G/2026/PA.Ctt`,
    jenisPerkara: "Cerai Gugat",
    jenisPerkaraId: 347,
    alurPerkaraId: 15,
    tanggalDaftar: "2026-04-05",
    hubungan: ["hakim-anggota"],
    pihak: { satu: { sebutan: "Penggugat", nama: ["Penggugat"] }, dua: { sebutan: "Tergugat", nama: ["Tergugat"] }, turut: null },
    majelis: [
      { kedudukan: "Hakim Ketua", nama: "Ketua Majelis", hakimId: "29" },
      { kedudukan: "Hakim Anggota 1", nama: "Anggota Satu", hakimId: "26" },
      { kedudukan: "Hakim Anggota 2", nama: "Hakim Ini", hakimId: "31" },
    ],
    majelisIkrar: [],
    panitera: ["Panitera Contoh"],
    jurusita: ["Jurusita Contoh"],
    musyawarah: null,
    tanggalPutusan: null,
    statusPutusan: null,
    verstek: null,
    tanggalMinutasi: null,
    tanggalBht: null,
    mediasi: null,
    rentangMediasi: [],
    ikrar: null,
    banding: null,
    kasasi: null,
    pk: null,
    sidangKeliling: false,
    sidangLuarGedung: [],
    itsbatTerpadu: false,
    ghaib: false,
    prodeo: false,
    ecourt: true,
    eSummons: true,
    unggahPutusan: { ada: false, tanggal: null },
    anonimisasi: { ada: false, tanggal: null },
    direktori: { url: null, tanggal: null },
    ...over,
  };
}

function data(periode: PeriodeSkp, isi: BarisEvidenSkp[], over: Partial<DataEvidenSkp> = {}): DataEvidenSkp {
  return {
    ok: true,
    peran: "hakim",
    periode,
    orang: { id: "31", nama: "Hakim Ini, S.H.", nip: "199401022017121003", jabatan: "Hakim", pangkatGolongan: null },
    ketua: { nama: "Ketua Contoh, S.H.I., M.H.", nip: "198208312007041001", jabatan: "Ketua Pengadilan Agama Contoh", sumber: "uji" },
    aturanPeriode: "Aturan periode uji.",
    baris: isi,
    catatan: ["Catatan bot uji."],
    galat: [],
    // 27 September 2026 pukul 10.00 WITA.
    dihitungPada: "2026-09-27T02:00:00.000Z",
    ...over,
  };
}

const dok = (d: DataEvidenSkp, kunci: string): DokumenEvidenSkp => {
  const hasil = susunDokumenEvidenSkp(d).find((x) => x.kunci === kunci);
  if (!hasil) throw new Error(`dokumen ${kunci} tidak ada`);
  return hasil;
};
const realisasi = (d: DokumenEvidenSkp) => d.indikator.map((i) => `${i.aspek}: ${i.realisasi}`);

// ---- keempat contoh spreadsheet, sebagai fakta sipp_donggala -------------------

const MAJELIS_687 = [
  { kedudukan: "Hakim Ketua", nama: "Akbar Ali", hakimId: "29" },
  { kedudukan: "Hakim Anggota 1", nama: "Himawan Tatura Wijaya", hakimId: "26" },
  { kedudukan: "Hakim Anggota 2", nama: "Derry Briantono", hakimId: "31" },
];

const c687 = () =>
  baris({
    perkaraId: "9291",
    nomorPerkara: "687/Pdt.G/2025/PA.Dgl",
    jenisPerkara: "Wasiat",
    jenisPerkaraId: 365,
    tanggalDaftar: "2025-11-28",
    pihak: {
      satu: { sebutan: "Penggugat", nama: ["JAM’AN BIN MASIMPARA"] },
      dua: { sebutan: "Tergugat", nama: ["DEALIMA BINTI KAMARUZAMAN", "SUBHAN BIN KAMARUZAMAN"] },
      turut: { sebutan: "Turut Tergugat", nama: ["Kepala Desa Pewunu"] },
    },
    majelis: MAJELIS_687,
    panitera: ["Sri Susilowati, S.H."],
    jurusita: ["Tanty Restianty"],
    musyawarah: { tanggal: "2026-03-17", sumber: 'Agenda sidang 2026-03-17: "Musyawarah Majelis"' },
    tanggalPutusan: "2026-03-17",
    statusPutusan: "Tidak Dapat Diterima",
    verstek: false,
    tanggalMinutasi: "2026-03-17",
    tanggalBht: "2026-04-01",
    mediasi: {
      mediator: "Himawan Tatura Wijaya, S.H.I., M.H.",
      olehOrangIni: false,
      hasil: "Tidak dapat dilaksanakan",
      berhasil: null,
      tanggalPenetapan: "2025-12-09",
      tanggalLaporan: "2025-12-16",
    },
    rentangMediasi: [{ mulai: "2025-12-09", selesai: "2025-12-16" }],
    unggahPutusan: { ada: true, tanggal: "2026-03-17" },
    anonimisasi: { ada: true, tanggal: "2026-03-17" },
    direktori: { url: "http://putusan.mahkamahagung.go.id/putusan/zaf121e7893a458cbb6f313635363134", tanggal: "2026-03-17" },
  });

const c620 = () =>
  baris({
    perkaraId: "9215",
    nomorPerkara: "620/Pdt.G/2025/PA.Dgl",
    jenisPerkara: "Kewarisan",
    jenisPerkaraId: 364,
    tanggalDaftar: "2025-10-22",
    majelis: MAJELIS_687,
    panitera: ["Sri Susilowati, S.H."],
    jurusita: ["Mohammad Syukri"],
    musyawarah: { tanggal: "2026-02-24", sumber: 'Sidang 2026-02-03 ditunda untuk "Musyawarah Majelis"; sidang berikutnya 2026-02-24' },
    tanggalPutusan: "2026-02-24",
    statusPutusan: "Dikabulkan",
    verstek: false,
    tanggalMinutasi: "2026-02-24",
    mediasi: {
      mediator: "Abdul Salam, S.H.I., M.H.",
      olehOrangIni: false,
      hasil: "Tidak berhasil",
      berhasil: false,
      tanggalPenetapan: "2025-11-04",
      tanggalLaporan: "2025-12-02",
    },
    rentangMediasi: [{ mulai: "2025-11-04", selesai: "2025-12-02" }],
    banding: { tanggalPermohonan: "2026-03-10", tanggalPemberitahuan: "2026-05-06", tanggalInputPemberitahuan: "2026-05-06", putusan: "Menguatkan", tanggalPutusan: "2026-05-04" },
    kasasi: { tanggalPermohonan: "2026-05-20", tanggalPemberitahuan: null, tanggalInputPemberitahuan: null, putusan: null, tanggalPutusan: null },
    unggahPutusan: { ada: true, tanggal: "2026-02-24" },
    anonimisasi: { ada: true, tanggal: "2026-02-24" },
    direktori: { url: "http://putusan.mahkamahagung.go.id/putusan/zaf1118abb309324b2eb323131313336", tanggal: "2026-02-24" },
  });

const c142 = () =>
  baris({
    perkaraId: "9528",
    nomorPerkara: "142/Pdt.G/2026/PA.Dgl",
    jenisPerkara: "Kewarisan",
    jenisPerkaraId: 364,
    tanggalDaftar: "2026-02-18",
    tanggalPutusan: "2026-04-07",
    statusPutusan: "Dicabut",
    verstek: false,
    tanggalMinutasi: "2026-04-07",
    tanggalBht: "2026-04-22",
    mediasi: {
      mediator: "Himawan Tatura Wijaya, S.H.I., M.H.",
      olehOrangIni: false,
      hasil: "Berhasil dengan pencabutan",
      berhasil: true,
      tanggalPenetapan: "2026-03-03",
      tanggalLaporan: "2026-04-07",
    },
    rentangMediasi: [{ mulai: "2026-03-03", selesai: "2026-04-07" }],
    unggahPutusan: { ada: true, tanggal: "2026-04-07" },
    anonimisasi: { ada: true, tanggal: "2026-04-07" },
    direktori: { url: "http://putusan.mahkamahagung.go.id/putusan/zaf1332bd389ef208aa0313631373535", tanggal: "2026-04-08" },
  });

const c273 = () =>
  baris({
    perkaraId: "9729",
    nomorPerkara: "273/Pdt.G/2026/PA.Dgl",
    jenisPerkara: "Kewarisan",
    jenisPerkaraId: 364,
    tanggalDaftar: "2026-04-27",
    mediasi: {
      mediator: "Idris, S.H.I., M.H.",
      olehOrangIni: false,
      hasil: "Tidak berhasil",
      berhasil: false,
      tanggalPenetapan: "2026-06-03",
      tanggalLaporan: "2026-07-15",
    },
    rentangMediasi: [{ mulai: "2026-06-03", selesai: "2026-07-15" }],
  });

describe("durasi - sama dengan keempat contoh spreadsheet", () => {
  it("687 = 103, 620 = 98 (Triwulan I); 142 = 14, 273 = 38 (Triwulan II)", () => {
    const k1 = konteksEviden(data(TW1, []));
    const k2 = konteksEviden(data(TW2, []));
    expect(durasiPerkara(c687(), k1)).toBe(103);
    expect(durasiPerkara(c620(), k1)).toBe(98);
    expect(durasiPerkara(c142(), k2)).toBe(14);
    // Belum putus: sampai 30 Juni, mediasi 3 Juni-15 Juli dipotong di 30 Juni.
    expect(durasiPerkara(c273(), k2)).toBe(38);
  });

  it("perkara yang diputus SESUDAH akhir periode dihitung sampai akhir periode", () => {
    const k = konteksEviden(data(TW2, []));
    const b = baris({ tanggalDaftar: "2026-06-11", tanggalPutusan: "2026-07-09", rentangMediasi: [] });
    expect(durasiPerkara(b, k)).toBe(20); // 11-30 Juni = 20 hari, hari daftar ikut
  });

  it("periode berjalan dihitung sampai hari ini WITA, bukan akhir periode", () => {
    const k = konteksEviden(data(TW3, []));
    expect(k.berjalan).toBe(true);
    expect(k.batas).toBe("2026-09-27");
    expect(durasiPerkara(baris({ tanggalDaftar: "2026-09-20" }), k)).toBe(8);
  });

  it("hari mediasi: kembar berujung menang, tindih disatukan, dijepit ke perkara, paling banyak 60", () => {
    // Dua baris bermula sama - yang berujung menang atas yang menggantung.
    expect(hariMediasiBersih([{ mulai: "2026-01-10", selesai: null }, { mulai: "2026-01-10", selesai: "2026-01-11" }], "2026-01-01", "2026-06-30")).toBe(1);
    // Bertindih: 10-20 dan 15-25 = 15 hari, bukan 20.
    expect(hariMediasiBersih([{ mulai: "2026-01-10", selesai: "2026-01-20" }, { mulai: "2026-01-15", selesai: "2026-01-25" }], "2026-01-01", "2026-06-30")).toBe(15);
    // Dijepit ke tanggal daftar dan batas.
    expect(hariMediasiBersih([{ mulai: "2025-12-01", selesai: "2026-01-05" }], "2026-01-01", "2026-06-30")).toBe(4);
    // Menggantung sampai batas, dibatasi 60.
    expect(hariMediasiBersih([{ mulai: "2026-01-10", selesai: null }], "2026-01-01", "2026-06-30")).toBe(60);
    expect(hariMediasiBersih(undefined, "2026-01-01", "2026-06-30")).toBe(0);
  });

  it("mediasi tidak memotong durasi melebihi umurnya sendiri", () => {
    const k = konteksEviden(data(TW2, []));
    const b = baris({ tanggalDaftar: "2026-06-29", rentangMediasi: [{ mulai: "2026-06-29", selesai: null }] });
    expect(durasiPerkara(b, k)).toBe(1);
  });
});

describe("Status Perkara - 25 kolom seperti spreadsheet", () => {
  it("kolomnya persis 25, berurutan seperti spreadsheet", () => {
    expect(KOLOM_STATUS_PERKARA.map((k) => k.judul)).toEqual([
      "No",
      "Nomor Perkara",
      "Jenis Perkara",
      "Tanggal Pendaftaran",
      "Para Pihak",
      "Majelis Hakim",
      "Panitera",
      "Jurusita",
      "Musyawarah Majelis",
      "Durasi (Hari)",
      "Mediasi",
      "Putusan",
      "Minutasi",
      "Ikrar Talak",
      "Banding",
      "Kasasi",
      "Peninjauan Kembali (PK)",
      "Sidang Keliling",
      "Itsbat Terpadu",
      "Ghaib",
      "Prodeo",
      "E-Court",
      "Upload Putusan",
      "Anonimisasi",
      "Direktori Putusan",
    ]);
  });

  it("687/Pdt.G/2025 pada Triwulan I - sama dengan baris spreadsheet", () => {
    const d = dok(data(TW1, [c687()]), "status-perkara");
    expect(d.tabel.kolom).toBe(KOLOM_STATUS_PERKARA);
    expect(d.tabel.baris[0]).toEqual({
      no: "1",
      nomor: "687/Pdt.G/2025/PA.Dgl",
      jenis: "Wasiat",
      daftar: "28/11/2025",
      pihak: "Penggugat:\nJAM’AN BIN MASIMPARA\nTergugat:\n1.DEALIMA BINTI KAMARUZAMAN\n2.SUBHAN BIN KAMARUZAMAN\nTurut Tergugat:\nKepala Desa Pewunu",
      majelis: "Hakim Ketua: Akbar Ali\nHakim Anggota 1: Himawan Tatura Wijaya\nHakim Anggota 2: Derry Briantono",
      panitera: "Sri Susilowati, S.H.",
      jurusita: "Tanty Restianty",
      musyawarah: "Terlaksana MM",
      durasi: "103",
      mediasi: "Tidak Dapat Dilaksanakan",
      putusan: "Putus (Tidak Dapat Diterima)",
      minutasi: "Telah Di Minutasi",
      ikrar: "-",
      banding: "-",
      kasasi: "-",
      pk: "-",
      keliling: "-",
      terpadu: "-",
      ghaib: "-",
      prodeo: "-",
      ecourt: "E-Court",
      unggah: "Telah Di Upload",
      anonimisasi: "Telah Di Anonimisasi",
      direktori: "http://putusan.mahkamahagung.go.id/putusan/zaf121e7893a458cbb6f313635363134",
    });
  });

  it("620/Pdt.G/2025 pada Triwulan I: Putus (Dikabulkan), Banding; kasasi 20 Mei belum terjadi per 31 Maret", () => {
    const d = dok(data(TW1, [c620()]), "status-perkara");
    expect(d.tabel.baris[0]).toMatchObject({
      putusan: "Putus (Dikabulkan)",
      banding: "Banding",
      kasasi: "-",
      jurusita: "Mohammad Syukri",
      durasi: "98",
      musyawarah: "Terlaksana MM",
    });
  });

  it("620/Pdt.G/2025 pada Triwulan II tidak ikut Status Perkara - diputus sebelum periode", () => {
    const d = dok(data(TW2, [c620()]), "status-perkara");
    expect(d.tabel.baris).toEqual([]);
  });

  it("273/Pdt.G/2026 pada Triwulan II: belum putus, durasi 38, mediasi masih berjalan per 30 Juni", () => {
    const d = dok(data(TW2, [c273()]), "status-perkara");
    expect(d.tabel.baris[0]).toMatchObject({
      nomor: "273/Pdt.G/2026/PA.Dgl",
      daftar: "27/04/2026",
      durasi: "38",
      mediasi: "Proses Mediasi",
      putusan: "-",
      minutasi: "-",
      ecourt: "E-Court",
      musyawarah: "-",
      direktori: "-",
    });
  });

  it("142/Pdt.G/2026 pada Triwulan II: durasi 14; perkara dicabut ditulis Putus (Dicabut)", () => {
    const d = dok(data(TW2, [c142()]), "status-perkara");
    expect(d.tabel.baris[0]).toMatchObject({ durasi: "14", putusan: "Putus (Dicabut)", minutasi: "Telah Di Minutasi", mediasi: "Berhasil Dengan Pencabutan" });
  });

  it("yang terjadi sesudah akhir periode ditulis '-'", () => {
    const b = baris({
      tanggalDaftar: "2026-06-11",
      tanggalPutusan: "2026-07-09",
      statusPutusan: "Dikabulkan",
      tanggalMinutasi: "2026-07-09",
      musyawarah: { tanggal: "2026-07-09", sumber: "x" },
      unggahPutusan: { ada: true, tanggal: "2026-07-09" },
      anonimisasi: { ada: true, tanggal: "2026-07-10" },
      direktori: { url: "http://putusan.mahkamahagung.go.id/putusan/x", tanggal: "2026-07-11" },
      banding: { tanggalPermohonan: "2026-07-20", tanggalPemberitahuan: null, tanggalInputPemberitahuan: null, putusan: null },
    });
    const sel = dok(data(TW2, [b]), "status-perkara").tabel.baris[0];
    expect(sel).toMatchObject({ putusan: "-", minutasi: "-", musyawarah: "-", unggah: "-", anonimisasi: "-", direktori: "-", banding: "-", durasi: "20" });
  });

  it("penanda yang tidak terbaca ditulis 'Tidak terbaca', bukan '-'", () => {
    const b = baris({ sidangKeliling: null, ghaib: null, prodeo: null, ecourt: null, unggahPutusan: null, direktori: null });
    const sel = selStatusPerkara(b, konteksEviden(data(TW2, [])), 1);
    expect(sel).toMatchObject({ keliling: "Tidak terbaca", ghaib: "Tidak terbaca", prodeo: "Tidak terbaca", ecourt: "Tidak terbaca", unggah: "Tidak terbaca", direktori: "Tidak terbaca" });
  });

  it("memuat HANYA perkara majelis pemeriksa yang masuk periode", () => {
    const k = konteksEviden(data(TW2, []));
    const mediatorSaja = baris({ hubungan: ["mediator"] });
    const ikrarSaja = baris({ hubungan: ["majelis-ikrar"] });
    const putusSebelum = baris({ tanggalDaftar: "2026-01-01", tanggalPutusan: "2026-03-31" });
    const tepatAwal = baris({ tanggalDaftar: "2026-01-01", tanggalPutusan: "2026-04-01" });
    const daftarAkhir = baris({ tanggalDaftar: "2026-06-30" });
    const daftarSesudah = baris({ tanggalDaftar: "2026-07-01" });
    expect([mediatorSaja, ikrarSaja, putusSebelum, tepatAwal, daftarAkhir, daftarSesudah].map((b) => masukPeriodePemeriksa(b, k))).toEqual([
      false,
      false,
      false,
      true,
      true,
      false,
    ]);
    const d = dok(data(TW2, [mediatorSaja, ikrarSaja, putusSebelum, tepatAwal, daftarAkhir, daftarSesudah]), "status-perkara");
    expect(d.tabel.baris.map((b) => b.nomor)).toEqual([tepatAwal.nomorPerkara, daftarAkhir.nomorPerkara]);
    expect(d.tabel.baris.map((b) => b.no)).toEqual(["1", "2"]);
  });

  it("para pihak: satu nama tanpa nomor, lebih dari satu bernomor", () => {
    expect(
      teksPihak(
        baris({
          pihak: {
            satu: { sebutan: "Pemohon", nama: ["A"] },
            dua: { sebutan: "Termohon", nama: ["B", "C"] },
            turut: { sebutan: "Turut Termohon", nama: ["D"] },
          },
        })
      )
    ).toBe("Pemohon:\nA\nTermohon:\n1.B\n2.C\nTurut Termohon:\nD");
  });
});

describe("persentase", () => {
  it("satu desimal berkoma, ',0' dibuang, penyebut nol '—'", () => {
    expect(persen(11, 12)).toBe("91,7%");
    expect(persen(12, 12)).toBe("100%");
    expect(persen(0, 5)).toBe("0%");
    expect(persen(1, 3)).toBe("33,3%");
    expect(persen(0, 0)).toBe("—");
  });
});

describe("rekap per dokumen - pilihan perkara, realisasi, dasar", () => {
  it("Rekap Perkara: diselesaikan dalam periode, ketepatan 150 hari", () => {
    const tepat = baris({ tanggalDaftar: "2026-04-01", tanggalPutusan: "2026-05-01", statusPutusan: "Dikabulkan" });
    const lewat = baris({ tanggalDaftar: "2025-12-01", tanggalPutusan: "2026-06-01", statusPutusan: "Dikabulkan" });
    const belum = baris({ tanggalDaftar: "2026-06-11" });
    const d = dok(data(TW2, [tepat, lewat, belum]), "rekap-perkara");
    expect(realisasi(d)).toEqual(["Kuantitas: 2 Perkara", "Kualitas: 50%", "Waktu: 3 Bulan"]);
    expect(d.indikator[0].dasar).toBe(
      "2 dari 3 perkara yang ditangani sebagai majelis pemeriksa diputus dalam periode; 1 lainnya belum putus per 30 Juni 2026, seluruhnya masih dalam 150 hari."
    );
    expect(d.indikator[1].dasar).toBe(`1 dari 2 perkara yang diputus dalam periode selesai paling lama ${AMBANG_TEPAT_WAKTU_HARI} hari.`);
    expect(d.indikator[2].dasar).toBe("Periode Triwulan II Tahun 2026: 1 April 2026 s.d. 30 Juni 2026.");
    expect(d.tabel.baris.map((b) => b.ketepatan)).toEqual([`Lewat ${AMBANG_TEPAT_WAKTU_HARI} hari`, "Tepat waktu", "Belum putus"]);
    expect(d.tabel.baris[1].kedudukan).toBe("Hakim Anggota 2");
    expect(d.rhk).toBe("Penyelesaian penerimaan perkara yang pasti, transparan dan akuntabel");
  });

  it("tanpa perkara: kuantitas 0, kualitas '—' - bukan 0% dan bukan 100%", () => {
    const d = dok(data(TW2, []), "rekap-perkara");
    expect(realisasi(d)).toEqual(["Kuantitas: 0 Perkara", "Kualitas: —", "Waktu: 3 Bulan"]);
  });

  it("Rekap Minutasi: keterisian, dan jujur bahwa tanggalnya sama dengan putusan", () => {
    const sama = baris({ tanggalPutusan: "2026-05-01", tanggalMinutasi: "2026-05-01" });
    const belum = baris({ tanggalPutusan: "2026-05-02", tanggalMinutasi: null });
    const sesudah = baris({ tanggalPutusan: "2026-06-29", tanggalMinutasi: "2026-07-02" });
    const d = dok(data(TW2, [sama, belum, sesudah]), "rekap-minutasi");
    expect(realisasi(d)).toEqual(["Kuantitas: 1 Perkara", "Kualitas: 33,3%", "Waktu: 3 Bulan"]);
    expect(d.indikator[1].dasar).toMatch(/TIDAK dapat diukur dari SIPP: tanggal minutasi sama dengan tanggal putusan pada 1 dari 1 perkara/);
    expect(d.tabel.baris.map((b) => b.minutasi)).toEqual(["Telah Di Minutasi", "Belum Diminutasi", "Belum Diminutasi"]);
  });

  it("Rekap Musyawarah Majelis: yang tercatat dalam periode, tanpa hakim tunggal", () => {
    const ada = baris({ musyawarah: { tanggal: "2026-05-10", sumber: "Agenda" }, tanggalPutusan: "2026-05-10" });
    const belumPutus = baris({ musyawarah: { tanggal: "2026-06-20", sumber: "Agenda" } });
    const tunggal = baris({ hubungan: ["hakim-tunggal"], musyawarah: { tanggal: "2026-05-10", sumber: "Agenda" } });
    const diluar = baris({ tanggalDaftar: "2026-02-01", musyawarah: { tanggal: "2026-03-20", sumber: "Agenda" } });
    const tanpa = baris({});
    const d = dok(data(TW2, [ada, belumPutus, tunggal, diluar, tanpa]), "rekap-musyawarah-majelis");
    expect(d.tabel.baris.map((b) => b.nomor)).toEqual([ada.nomorPerkara, belumPutus.nomorPerkara]);
    expect(realisasi(d)).toEqual(["Kuantitas: 2 Kegiatan", "Kualitas: 50%", "Waktu: 3 Bulan"]);
    expect(d.catatan.join(" ")).toMatch(/2 perkara majelis lainnya dalam periode ini tidak ikut/);
  });

  it("Rekap Mediasi: hanya sebagai mediator; yang tidak dapat dilaksanakan tidak dihitung berhasil maupun gagal", () => {
    const med = (hasil: string, berhasil: boolean | null, laporan: string | null) =>
      baris({
        hubungan: ["mediator"],
        mediasi: { mediator: "Hakim Ini", olehOrangIni: true, hasil, berhasil, tanggalPenetapan: "2026-04-01", tanggalLaporan: laporan },
      });
    const d = dok(
      data(TW2, [
        med("Berhasil dengan kesepakatan", true, "2026-04-11"),
        med("Tidak berhasil", false, "2026-04-21"),
        med("Tidak dapat dilaksanakan", null, "2026-04-06"),
        med("", null, null),
        baris({}),
      ]),
      "rekap-mediasi"
    );
    expect(d.tabel.baris.length).toBe(4);
    expect(realisasi(d)).toEqual(["Kuantitas: 4 Kegiatan", "Kualitas: 50%", "Waktu: 3 Bulan"]);
    expect(d.indikator[1].dasar).toMatch(/1 dari 2 mediasi .* 1 tidak dapat dilaksanakan atau hasilnya tidak tercatat/);
    // (10 + 20 + 5) / 3 hari - yang belum dilaporkan tidak ikut dirata-rata.
    expect(d.indikator[2].dasar).toMatch(/Rata-rata 11,7 hari sejak penetapan mediator/);
    expect(d.tabel.baris.map((b) => b.hasil)).toContain("Proses Mediasi");
  });

  it("Rekap Sidang Keliling: yang tidak terbaca disebut; seluruhnya tak terbaca '—'", () => {
    const keliling = baris({ sidangKeliling: true, sidangLuarGedung: [{ tanggal: "2026-06-25", tempat: "Sidang Keliling Sigi Biromaru", terpadu: false }], tanggalDaftar: "2026-06-11" });
    const tidak = baris({ sidangKeliling: false });
    const takTerbaca = baris({ sidangKeliling: null });
    const d = dok(data(TW2, [keliling, tidak, takTerbaca]), "rekap-sidang-keliling");
    expect(d.tabel.baris.length).toBe(1);
    expect(d.tabel.baris[0].tempat).toBe("25/06/2026 - Sidang Keliling Sigi Biromaru");
    expect(realisasi(d)).toEqual(["Kuantitas: 1 Perkara", "Kualitas: 0%", "Waktu: 3 Bulan"]);
    expect(d.indikator[1].dasar).toBe("0 dari 1 perkara sidang keliling diputus dalam periode; 1 lainnya belum putus per 30 Juni 2026, seluruhnya masih dalam 150 hari.");
    expect(d.catatan.join(" ")).toMatch(/tidak terbaca dari SIPP pada 1 perkara/);

    const semua = dok(data(TW2, [baris({ sidangKeliling: null }), baris({ sidangKeliling: null })]), "rekap-sidang-keliling");
    expect(realisasi(semua)).toEqual(["Kuantitas: —", "Kualitas: —", "Waktu: 3 Bulan"]);
  });

  it("Rekap E-Court: diselesaikan lewat e-Court; e-Summons atas yang terbaca", () => {
    const d = dok(
      data(TW2, [
        baris({ ecourt: true, eSummons: true, tanggalPutusan: "2026-05-01" }),
        baris({ ecourt: true, eSummons: false }),
        baris({ ecourt: true, eSummons: null }),
        baris({ ecourt: false }),
      ]),
      "rekap-ecourt"
    );
    expect(d.tabel.baris.length).toBe(3);
    expect(realisasi(d)).toEqual(["Kuantitas: 1 Perkara", "Kualitas: 50%", "Waktu: 3 Bulan"]);
    expect(d.indikator[1].dasar).toMatch(/e-Litigasi tidak tercatat per perkara di SIPP/);
  });

  it("Rekap Isbat Terpadu: penyelesaian dalam periode", () => {
    const d = dok(
      data(TW2, [
        baris({
          jenisPerkaraId: 360,
          hubungan: ["hakim-tunggal"],
          itsbatTerpadu: true,
          sidangLuarGedung: [{ tanggal: "2026-05-08", tempat: "Terpadu Sindue", terpadu: true }],
          tanggalPutusan: "2026-05-08",
        }),
        baris({ itsbatTerpadu: false }),
      ]),
      "rekap-isbat-terpadu"
    );
    expect(realisasi(d)).toEqual(["Kuantitas: 1 Perkara", "Kualitas: 100%", "Waktu: 3 Bulan"]);
    expect(d.tabel.baris[0].tempat).toBe("08/05/2026 - Terpadu Sindue");
  });

  it("Rekap Ikrar Talak: sesudah BHT, paling lama 180 hari, tidak mendahului PHS", () => {
    const ik = (bht: string | null, phs: string | null, ikrar: string | null) =>
      baris({ hubungan: ["majelis-ikrar"], jenisPerkaraId: 346, tanggalBht: bht, ikrar: { tanggalIkrar: ikrar, tanggalPhsIkrar: phs } });
    const sesuai = ik("2026-04-01", "2026-04-05", "2026-04-20");
    const lewat = ik("2025-08-19", "2025-08-20", "2026-04-03");
    const mendahuluiPhs = ik("2026-04-01", "2026-05-01", "2026-04-20");
    const tanpaBht = ik(null, "2026-04-01", "2026-04-10");
    const belum = ik("2026-06-01", "2026-06-10", null);
    expect(ikrarSesuai(sesuai)).toBe(true);
    expect(ikrarSesuai(lewat)).toBe(false);
    expect(ikrarSesuai(mendahuluiPhs)).toBe(false);
    expect(ikrarSesuai(tanpaBht)).toBe(null);
    const d = dok(data(TW2, [sesuai, lewat, mendahuluiPhs, tanpaBht, belum]), "rekap-ikrar-talak");
    expect(realisasi(d)).toEqual(["Kuantitas: 4 Perkara", "Kualitas: 33,3%", "Waktu: 3 Bulan"]);
    expect(d.indikator[1].dasar).toMatch(/1 tanpa tanggal BHT, tidak dinilai/);
    const ket = Object.fromEntries(d.tabel.baris.map((b) => [b.nomor, b.keterangan]));
    expect(ket[lewat.nomorPerkara]).toBe("Lewat 180 hari sesudah BHT (227 hari)");
    expect(ket[belum.nomorPerkara]).toBe("Belum diucapkan dalam periode");
  });

  it("Rekap Salinan Putusan: terunggah paling lambat akhir periode", () => {
    const d = dok(
      data(TW2, [
        baris({ tanggalPutusan: "2026-05-01", unggahPutusan: { ada: true, tanggal: "2026-05-02" } }),
        baris({ tanggalPutusan: "2026-06-30", unggahPutusan: { ada: true, tanggal: "2026-07-01" } }),
        baris({ tanggalPutusan: "2026-05-03", unggahPutusan: { ada: true, tanggal: null } }),
        baris({ tanggalPutusan: "2026-05-04", unggahPutusan: null }),
      ]),
      "rekap-salinan-putusan"
    );
    expect(realisasi(d)).toEqual(["Kuantitas: 2 Perkara", "Kualitas: 66,7%", "Waktu: 3 Bulan"]);
    expect(d.indikator[1].dasar).toMatch(/1 tidak terbaca, tidak dihitung/);
  });

  it("Rekap Prodeo: tepat waktu atas yang diputus", () => {
    const d = dok(
      data(TW2, [
        baris({ prodeo: true, tanggalDaftar: "2026-04-01", tanggalPutusan: "2026-04-20" }),
        baris({ prodeo: true, tanggalDaftar: "2026-06-01" }),
        baris({ prodeo: false }),
      ]),
      "rekap-prodeo"
    );
    expect(realisasi(d)).toEqual(["Kuantitas: 2 Perkara", "Kualitas: 100%", "Waktu: 3 Bulan"]);
  });

  it("Rekap Direktori Putusan: terbit per akhir periode; lengkap = putusan + anonimisasi", () => {
    const d = dok(
      data(TW2, [
        baris({
          tanggalPutusan: "2026-05-01",
          unggahPutusan: { ada: true, tanggal: "2026-05-01" },
          anonimisasi: { ada: true, tanggal: "2026-05-01" },
          direktori: { url: "http://putusan.mahkamahagung.go.id/putusan/a", tanggal: "2026-05-03" },
        }),
        baris({
          tanggalPutusan: "2026-06-29",
          unggahPutusan: { ada: true, tanggal: "2026-06-29" },
          anonimisasi: { ada: false, tanggal: null },
          direktori: { url: "http://putusan.mahkamahagung.go.id/putusan/b", tanggal: "2026-07-02" },
        }),
      ]),
      "rekap-direktori-putusan"
    );
    expect(realisasi(d)).toEqual(["Kuantitas: 1 Putusan", "Kualitas: 50%", "Waktu: 3 Bulan"]);
    expect(d.indikator[2].dasar).toMatch(/Rata-rata 2 hari sejak putusan sampai terbit/);
    expect(d.tabel.baris.map((b) => b.direktori)).toEqual(["http://putusan.mahkamahagung.go.id/putusan/a", "-"]);
  });

  it("Rekap Selesai Prosedur: diminutasi, terunggah, dan beranonimisasi", () => {
    const lengkap = baris({
      tanggalPutusan: "2026-05-01",
      tanggalMinutasi: "2026-05-01",
      unggahPutusan: { ada: true, tanggal: "2026-05-01" },
      anonimisasi: { ada: true, tanggal: "2026-05-01" },
    });
    const tanpaAnonim = baris({ tanggalPutusan: "2026-05-02", tanggalMinutasi: "2026-05-02", unggahPutusan: { ada: true, tanggal: "2026-05-02" } });
    const d = dok(data(TW2, [lengkap, tanpaAnonim]), "rekap-selesai-minutasi");
    expect(realisasi(d)).toEqual(["Kuantitas: 2 Perkara", "Kualitas: 50%", "Waktu: 3 Bulan"]);
  });

  it("Rekap Upaya Hukum: satu baris per tingkat, dokumen = pemberitahuan dalam periode", () => {
    const d = dok(data(TW2, [c620()]), "rekap-upaya-hukum");
    expect(d.tabel.baris.map((b) => `${b.upaya}|${b.permohonan}|${b.tanggalPutusan}|${b.amar}|${b.pemberitahuan}|${b.input}`)).toEqual([
      "Banding|10/03/2026|04/05/2026|Menguatkan|06/05/2026|06/05/2026",
      "Kasasi|20/05/2026|-|-|-|-",
    ]);
    expect(realisasi(d)).toEqual(["Kuantitas: 1 Dokumen", "Kualitas: 100%", "Waktu: 3 Bulan"]);
    expect(d.indikator[1].dasar).toMatch(/Akurasi identitas dan alamat .* tidak tercatat di SIPP/);
    expect(d.indikator[2].dasar).toMatch(/Rata-rata 0 hari sejak pemberitahuan sampai diinput ke SIPP/);
    // Upaya hukum pada perkara yang hanya dimediasi tidak ikut.
    const mediator = { ...c620(), hubungan: ["mediator" as const] };
    expect(dok(data(TW2, [mediator]), "rekap-upaya-hukum").tabel.baris).toEqual([]);
  });
});

describe("periode berjalan - dibaca sampai HARI INI (27 September 2026), bukan akhir periode", () => {
  const TAHUN26: PeriodeSkp = { ...TW1, kunci: "tahun", label: "Tahunan", labelPanjang: "Tahun 2026", mulai: "2026-01-01", selesai: "2026-12-31", bulan: 12 };

  it("musyawarah, ikrar, mediasi, dan pemberitahuan bertanggal sesudah hari ini tidak dihitung", () => {
    const lalu = baris({ musyawarah: { tanggal: "2026-09-20", sumber: "Agenda" } });
    const nanti = baris({ musyawarah: { tanggal: "2026-09-29", sumber: "Agenda" } });
    expect(dok(data(TAHUN26, [lalu, nanti]), "rekap-musyawarah-majelis").tabel.baris.map((b) => b.nomor)).toEqual([lalu.nomorPerkara]);

    const ikrar = (tanggal: string) =>
      baris({ hubungan: ["majelis-ikrar"], tanggalBht: "2026-08-01", ikrar: { tanggalIkrar: tanggal, tanggalPhsIkrar: "2026-08-05" } });
    const ik = dok(data(TW3, [ikrar("2026-09-10"), ikrar("2026-09-29")]), "rekap-ikrar-talak");
    expect(realisasi(ik)[0]).toBe("Kuantitas: 1 Perkara");

    const upaya = baris({
      tanggalDaftar: "2026-01-05",
      tanggalPutusan: "2026-03-01",
      banding: { tanggalPermohonan: "2026-03-10", tanggalPemberitahuan: "2026-09-29", tanggalInputPemberitahuan: null, putusan: "Menguatkan", tanggalPutusan: "2026-09-20" },
    });
    expect(realisasi(dok(data(TW3, [upaya]), "rekap-upaya-hukum"))[0]).toBe("Kuantitas: 0 Dokumen");
  });

  it("minutasi, BHT, ikrar, dan pemberitahuan bertanggal sesudah hari ini belum dianggap terjadi", () => {
    // Tanggal yang diisi lebih dahulu di SIPP (sebelum peristiwanya) - dalam
    // periode, tetapi sesudah hari ini.
    const b = baris({
      hubungan: ["hakim-ketua"],
      tanggalDaftar: "2026-07-01",
      tanggalPutusan: "2026-09-15",
      tanggalMinutasi: "2026-09-29",
      tanggalBht: "2026-09-29",
      ikrar: { tanggalIkrar: "2026-09-30", tanggalPhsIkrar: "2026-09-20" },
      banding: { tanggalPermohonan: "2026-09-16", tanggalPemberitahuan: "2026-09-29", tanggalInputPemberitahuan: "2026-09-29", putusan: "Menguatkan", tanggalPutusan: "2026-09-28" },
    });
    const status = dok(data(TW3, [b]), "status-perkara").tabel.baris[0];
    expect([status.minutasi, status.ikrar]).toEqual(["-", "-"]);
    expect(dok(data(TW3, [b]), "rekap-minutasi").tabel.baris[0].minutasi).toBe("Belum Diminutasi");
    expect(dok(data(TW3, [b]), "rekap-selesai-minutasi").tabel.baris[0].bht).toBe("-");
    const upaya = dok(data(TW3, [b]), "rekap-upaya-hukum").tabel.baris[0];
    expect([upaya.permohonan, upaya.tanggalPutusan, upaya.amar, upaya.pemberitahuan]).toEqual(["16/09/2026", "-", "-", "-"]);
    // Periode yang sudah selesai: dibaca sampai akhir periodenya.
    const selesai = dok(data(TW3, [b], { dihitungPada: "2026-10-05T02:00:00.000Z" }), "status-perkara").tabel.baris[0];
    expect([selesai.minutasi, selesai.ikrar]).toEqual(["Telah Di Minutasi", "Telah Ikrar Talak"]);
  });

  it("aspek Waktu: lama yang SUDAH dijalani, bukan 12 Bulan", () => {
    const tahun = dok(data(TAHUN26, []), "rekap-perkara").indikator[2];
    expect(tahun.realisasi).toBe("8 Bulan 27 Hari, s.d. 27 September 2026");
    expect(tahun.dasar).toMatch(/belum berakhir/);
    expect(dok(data(TW3, []), "rekap-perkara").indikator[2].realisasi).toBe("2 Bulan 27 Hari, s.d. 27 September 2026");
    // Periode yang sudah selesai tetap bulan penuh.
    expect(dok(data(TW2, []), "rekap-perkara").indikator[2].realisasi).toBe("3 Bulan");
  });

  it("lama dijalani: bulan penuh lalu sisa hari, hari pertama ikut dihitung", () => {
    expect(lamaDijalani("2026-01-01", "2026-09-27")).toBe("8 Bulan 27 Hari");
    expect(lamaDijalani("2026-07-01", "2026-07-31")).toBe("1 Bulan");
    expect(lamaDijalani("2026-10-01", "2026-10-01")).toBe("1 Hari");
    expect(lamaDijalani("2026-04-01", "2026-06-30")).toBe("3 Bulan");
    expect(lamaDijalani("2026-01-01", "2026-02-28")).toBe("2 Bulan");
  });
});

describe("dokumen resmi - hanya yang pantas dibaca penilai", () => {
  it("catatan untuk petugas (catatanOperator) tidak tercetak di dokumen mana pun", () => {
    const d = data(TW2, [c273()], { catatanOperator: ["NIP Ketua di konfigurasi SIPP (KetuaPNNIP) hanya 17 angka."] });
    for (const x of susunDokumenEvidenSkp(d)) expect(x.catatan.join(" "), x.kunci).not.toMatch(/KetuaPNNIP|17 angka/);
  });

  it("Rekap Ikrar menyebut sumber majelis ikrar dengan benar: penunjukan ATAU penetapan ikrar talak", () => {
    const teks = dok(data(TW2, []), "rekap-ikrar-talak").catatan.join(" ");
    expect(teks).not.toMatch(/penunjukan ikrar yang aktif/);
    expect(teks).toMatch(/penetapan ikrar talak/);
  });

  it("tidak menyapa 'Anda' - dokumen dibaca penilai, ditandatangani hakimnya", () => {
    const semua = susunDokumenEvidenSkp(data(TW2, [c620(), c273(), c142(), baris({ hubungan: ["mediator"], mediasi: null })]));
    for (const d of semua) {
      expect(JSON.stringify([d.indikator, d.catatan, d.rhk]), d.kunci).not.toMatch(/\bAnda\b/);
    }
  });
});

describe("katalog dan paket", () => {
  it("17 dokumen berurutan: status, 13 rekap, 3 yang bukan data SIPP", () => {
    expect(DAFTAR_DOKUMEN_EVIDEN_SKP.map((d) => d.kunci)).toEqual([
      "status-perkara",
      "rekap-perkara",
      "rekap-minutasi",
      "rekap-musyawarah-majelis",
      "rekap-mediasi",
      "rekap-sidang-keliling",
      "rekap-ecourt",
      "rekap-isbat-terpadu",
      "rekap-ikrar-talak",
      "rekap-salinan-putusan",
      "rekap-prodeo",
      "rekap-direktori-putusan",
      "rekap-selesai-minutasi",
      "rekap-upaya-hukum",
      "laporan-posbakum",
      "kegiatan-sipintar",
      "laporan-hawasbid",
    ]);
    const semua = susunDokumenEvidenSkp(data(TW2, [c273()]));
    expect(semua.map((d) => d.kunci)).toEqual(DAFTAR_DOKUMEN_EVIDEN_SKP.map((d) => d.kunci));
    expect(semua.filter((d) => !d.tersedia).map((d) => d.kunci)).toEqual(["laporan-posbakum", "kegiatan-sipintar", "laporan-hawasbid"]);
  });

  it("judul besar di dokumen, judul lengkap berperiode, tiga indikator tiap rekap", () => {
    const semua = susunDokumenEvidenSkp(data(TW2, []));
    const perkara = semua.find((d) => d.kunci === "rekap-perkara")!;
    expect(perkara.judul).toBe("REKAP PERKARA");
    expect(perkara.judulLengkap).toBe("Rekap Perkara Triwulan II Tahun 2026");
    for (const d of semua.filter((x) => x.tersedia && x.kunci !== "status-perkara")) {
      expect(d.indikator.map((i) => i.aspek), d.kunci).toEqual(["Kuantitas", "Kualitas", "Waktu"]);
      expect(d.rhk, d.kunci).toBeTruthy();
      expect(d.indikator.every((i) => i.dasar.length > 10), d.kunci).toBe(true);
    }
  });

  it("dokumen yang bukan data SIPP: tidak tersedia beserta sebabnya, tanpa tabel", () => {
    const posbakum = susunDokumenEvidenSkp(data(TW2, [])).find((d) => d.kunci === "laporan-posbakum")!;
    expect(posbakum.tersedia).toBe(false);
    expect(posbakum.sebabTidakTersedia).toMatch(/SIPP tidak mencatat layanan Pos Bantuan Hukum/);
    expect(posbakum.tabel).toEqual({ kolom: [], baris: [] });
  });

  it("catatan tiap dokumen memuat aturan periode, batas keadaan, dan catatan bot", () => {
    const d = dok(data(TW2, []), "rekap-prodeo");
    expect(d.catatan).toContain("Aturan periode uji.");
    expect(d.catatan).toContain("Catatan bot uji.");
    expect(d.catatan.join(" ")).toMatch(/Keadaan tiap perkara dibaca per 30 Juni 2026/);
    const berjalan = dok(data(TW3, []), "rekap-prodeo");
    expect(berjalan.catatan.join(" ")).toMatch(/Periode belum berakhir: keadaan tiap perkara dibaca sampai 27 September 2026/);
  });

  it("paket meneruskan periode, orang, Ketua, error, dan waktu hitung", () => {
    const paket = susunPaketEvidenSkp(data(TW2, [], { galat: ["Jadwal sidang tidak terbaca dari SIPP: uji"] }));
    expect(paket.orang.nama).toBe("Hakim Ini, S.H.");
    expect(paket.ketua?.nip).toBe("198208312007041001");
    expect(paket.galat).toEqual(["Jadwal sidang tidak terbaca dari SIPP: uji"]);
    expect(paket.dokumen).toHaveLength(17);
    expect(paket.dihitungPada).toBe("2026-09-27T02:00:00.000Z");
  });
});
