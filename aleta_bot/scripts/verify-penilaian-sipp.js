"use strict";

/**
 * Menguji penilaianSippService terhadap angka yang tertulis pada SK Dirjen
 * Badilag Nomor 048/DJA/SK.KP3.4.3/IV/2024.
 *
 * Tiap perkara di sini menyebutkan halaman atau nomor tabel SK yang diuji,
 * supaya bila SK diubah, yang perlu diperiksa jelas letaknya.
 */

const penilaian = require("../services/penilaianSippService");

let jumlah = 0;
let gagal = 0;

function cek(nama, dapat, harap) {
  jumlah += 1;
  const sama = JSON.stringify(dapat) === JSON.stringify(harap);
  if (!sama) {
    gagal += 1;
    console.log(`  GAGAL: ${nama}`);
    console.log(`         diharap ${JSON.stringify(harap)}, didapat ${JSON.stringify(dapat)}`);
  }
}

/** Poin satu unsur untuk sekumpulan fakta. */
function poin(kunci, fakta, jenisPengadilan = "pertama") {
  const hasil = penilaian.poinPerkara(fakta, { jenisPengadilan });
  const baris = hasil.rinci.find((x) => x.kunci === kunci);
  if (!baris) return "unsur-tidak-ada";
  return baris.terbaca ? baris.poin : "tidak-terbaca";
}

function tanggal(teks) {
  return new Date(`${teks}T00:00:00`);
}

console.log("");
console.log("Uji penilaian SIPP - SK 048/DJA/SK.KP3.4.3/IV/2024");
console.log("");

// ---------------------------------------------------------------------------
console.log("Tabel 1 - bobot nilai");
// ---------------------------------------------------------------------------

const bobotPa = (aspek) =>
  penilaian.UNSUR.filter((u) => u.aspek === aspek).reduce((a, u) => a + u.bobotPa, 0);

cek("bobot aspek kinerja PA = 50%", bobotPa("kinerja"), 50);
cek("bobot aspek input data PA = 40%", bobotPa("input"), 40);
cek("bobot aspek kelengkapan dokumen PA = 10%", bobotPa("kelengkapan"), 10);
cek("bobot aspek kesesuaian PA = 10% (pengurang)", bobotPa("kesesuaian"), 10);
cek(
  "kinerja + kepatuhan = 100%",
  bobotPa("kinerja") + bobotPa("input") + bobotPa("kelengkapan"),
  100
);

cek("waktu putus perkara berbobot 20%", penilaian.UNSUR.find((u) => u.kunci === "waktuPutus").bobotPa, 20);
cek("waktu minutasi berbobot 15%", penilaian.UNSUR.find((u) => u.kunci === "waktuMinutasi").bobotPa, 15);
cek("waktu publikasi putusan berbobot 15%", penilaian.UNSUR.find((u) => u.kunci === "waktuPublikasi").bobotPa, 15);
cek("E-Dokumen BAS berbobot 3%", penilaian.UNSUR.find((u) => u.kunci === "eDokBas").bobotPa, 3);
cek(
  "amar putusan tidak berbobot pada tingkat pertama",
  penilaian.UNSUR.find((u) => u.kunci === "eDokAmarPutusan").bobotPa,
  0
);
cek(
  "amar putusan berbobot 10% pada tingkat banding",
  penilaian.UNSUR.find((u) => u.kunci === "eDokAmarPutusan").bobotPta,
  10
);

// ---------------------------------------------------------------------------
console.log("Tabel 2 huruf a - kriteria waktu putus perkara");
// ---------------------------------------------------------------------------

const putus = (hariBerjalan, tambahan = {}) => {
  const daftar = tanggal("2025-01-01");
  const akhir = new Date(daftar.getTime() + hariBerjalan * 24 * 60 * 60 * 1000);
  return poin("waktuPutus", { tanggalDaftar: daftar, tanggalPutus: akhir, ...tambahan });
};

// Hari pendaftaran IKUT dihitung: selisih 89 hari berarti perkara berjalan 90
// hari. Itulah cara notifikasi SIPP pengadilan ini menghitung sejak lama, dan
// memakai cara yang sama membuat kedua angkanya dapat disandingkan.
cek("selisih 30 hari = 31 hari berjalan = 5", putus(30), 5);
cek("selisih 89 hari = 90 hari (3 bulan) = 5", putus(89), 5);
cek("selisih 90 hari = 91 hari (lewat 3 bulan) = 3", putus(90), 3);
cek("selisih 119 hari = 120 hari (4 bulan) = 3", putus(119), 3);
cek("selisih 120 hari = 121 hari (lewat 4 bulan) = 1", putus(120), 1);
cek("selisih 149 hari = 150 hari (5 bulan) = 1", putus(149), 1);
cek("selisih 150 hari = 151 hari (lebih dari 5 bulan) = 0", putus(150), 0);
cek("putus 400 hari = 0", putus(400), 0);
cek("didaftar dan diputus hari yang sama = 1 hari berjalan = 5", putus(0), 5);
cek("belum putus = tidak terbaca", poin("waktuPutus", { tanggalDaftar: tanggal("2025-01-01") }), "tidak-terbaca");

console.log("Tabel 2 nomor 1 - pengecualian perkara khusus");
cek("ghaib 200 hari dikurangi 120 = 80 hari = 5", putus(200, { perkaraGhaib: true }), 5);
cek("ghaib 220 hari dikurangi 120 = 100 hari = 3", putus(220, { perkaraGhaib: true }), 3);
cek("ghaib diumumkan 260 hari dikurangi 180 = 80 hari = 5", putus(260, { perkaraGhaibDiumumkan: true }), 5);
cek("mafqud 350 hari dikurangi 270 = 80 hari = 5", putus(350, { perkaraMafqud: true }), 5);
cek("PNS izin atasan 60 hari: 140 dikurangi 60 = 80 hari = 5", putus(140, { hariIzinAtasan: 60 }), 5);
cek(
  "izin atasan dibatasi 6 bulan (180 hari)",
  penilaian.kelonggaranWaktuPutus({ hariIzinAtasan: 400 }).hari,
  180
);

// ---------------------------------------------------------------------------
console.log("Tabel 2 huruf b - waktu minutasi berkas perkara");
// ---------------------------------------------------------------------------

const minutasi = (selisih) => {
  const p = tanggal("2025-03-10");
  return poin("waktuMinutasi", {
    tanggalPutus: p,
    tanggalMinutasi: new Date(p.getTime() + selisih * 24 * 60 * 60 * 1000),
  });
};

cek("minutasi hari ke-1 = 5", minutasi(1), 5);
cek("minutasi hari ke-2 = 5", minutasi(2), 5);
cek("minutasi hari ke-3 = 3", minutasi(3), 3);
cek("minutasi hari ke-5 = 3", minutasi(5), 3);
cek("minutasi hari ke-6 = 2", minutasi(6), 2);
cek("minutasi hari ke-9 = 2", minutasi(9), 2);
cek("minutasi hari ke-10 = 1", minutasi(10), 1);
cek("minutasi hari ke-14 = 1", minutasi(14), 1);
cek("minutasi hari ke-15 = 0", minutasi(15), 0);
cek(
  "sudah putus tetapi belum diminutasi = 0",
  poin("waktuMinutasi", { tanggalPutus: tanggal("2025-03-10") }),
  0
);

// ---------------------------------------------------------------------------
console.log("Tabel 2 huruf c - waktu publikasi putusan");
// ---------------------------------------------------------------------------

const publikasi = (selisih) => {
  const p = tanggal("2025-03-10");
  return poin("waktuPublikasi", {
    tanggalPutus: p,
    tanggalUnggahPutusan: new Date(p.getTime() + selisih * 24 * 60 * 60 * 1000),
  });
};

cek("publikasi hari ke-2 = 5", publikasi(2), 5);
cek("publikasi hari ke-3 = 3", publikasi(3), 3);
cek("publikasi hari ke-5 = 3", publikasi(5), 3);
cek("publikasi hari ke-6 = 2", publikasi(6), 2);
cek("publikasi hari ke-9 = 2", publikasi(9), 2);
cek("publikasi hari ke-10 = 1", publikasi(10), 1);
cek("publikasi hari ke-14 = 1", publikasi(14), 1);
cek("publikasi hari ke-15 = 0", publikasi(15), 0);
cek(
  "putus tetapi belum diunggah = 0",
  poin("waktuPublikasi", { tanggalPutus: tanggal("2025-03-10"), tanggalUnggahPutusan: null }),
  0
);
cek(
  "sumber tanggal unggah belum tersambung = tidak terbaca, bukan nol",
  poin("waktuPublikasi", { tanggalPutus: tanggal("2025-03-10") }),
  "tidak-terbaca"
);

// ---------------------------------------------------------------------------
console.log("Tabel 2 bagian I - input data");
// ---------------------------------------------------------------------------

const daftarAwal = tanggal("2025-02-03");
const geser = (awal, n) => new Date(awal.getTime() + n * 24 * 60 * 60 * 1000);

const pendaftaran = (n) =>
  poin("pendaftaranPerkara", { tanggalDaftar: daftarAwal, tanggalInputPendaftaran: geser(daftarAwal, n) });
cek("I.1 pendaftaran hari yang sama = 5", pendaftaran(0), 5);
cek("I.1 pendaftaran hari ke-1 = 3", pendaftaran(1), 3);
cek("I.1 pendaftaran hari ke-2 = 2", pendaftaran(2), 2);
cek("I.1 pendaftaran hari ke-3 = 1", pendaftaran(3), 1);
cek("I.1 pendaftaran hari ke-4 = 0", pendaftaran(4), 0);
cek("I.1 pendaftaran hari ke-9 = 0", pendaftaran(9), 0);

const pmh = (n) => poin("penetapanMajelis", { tanggalDaftar: daftarAwal, tanggalPmh: geser(daftarAwal, n) });
cek("I.2 PMH hari yang sama = 5", pmh(0), 5);
cek("I.2 PMH hari ke-1 = 3", pmh(1), 3);
cek("I.2 PMH hari ke-2 = 3", pmh(2), 3);
cek("I.2 PMH hari ke-3 = 2", pmh(3), 2);
cek("I.2 PMH hari ke-4 = 2", pmh(4), 2);
cek("I.2 PMH hari ke-5 = 1", pmh(5), 1);
cek("I.2 PMH hari ke-9 = 1", pmh(9), 1);
cek("I.2 PMH hari ke-10 = 0", pmh(10), 0);

const pmhTanggal = tanggal("2025-02-05");
const inputPmh = (n) =>
  poin("inputPenetapanMajelis", { tanggalPmh: pmhTanggal, tanggalInputPmh: geser(pmhTanggal, n) });
cek("I.3 input PMH hari yang sama = 5", inputPmh(0), 5);
cek("I.3 input PMH hari ke-3 = 1", inputPmh(3), 1);
cek("I.3 input PMH hari ke-4 = 0", inputPmh(4), 0);

cek(
  "I.4 penunjukan PP hari ke-2 = 3",
  poin("penunjukanPp", { tanggalPmh: pmhTanggal, tanggalPpp: geser(pmhTanggal, 2) }),
  3
);
cek(
  "I.6 penunjukan juru sita hari ke-5 = 1",
  poin("penunjukanJurusita", { tanggalPmh: pmhTanggal, tanggalPjs: geser(pmhTanggal, 5) }),
  1
);
cek(
  "I.8 PHS hari ke-10 = 0",
  poin("penetapanHariSidang", { tanggalPmh: pmhTanggal, tanggalPhs: geser(pmhTanggal, 10) }),
  0
);

console.log("Tabel 2 I.10 - pengisian data relaas");
const relaas = (selisihHariSebelumSidang) => {
  const sidang = tanggal("2025-04-10");
  return poin("dataRelaas", {
    relaas: [{ tanggalSidang: sidang, tanggalInput: geser(sidang, -selisihHariSebelumSidang) }],
  });
};
cek("I.10 relaas diinput 5 hari sebelum sidang = 5", relaas(5), 5);
cek("I.10 relaas diinput 3 hari sebelum sidang = 5", relaas(3), 5);
cek("I.10 relaas diinput 2 hari sebelum sidang = 2", relaas(2), 2);
cek("I.10 relaas diinput 1 hari sebelum sidang = 1", relaas(1), 1);
cek("I.10 relaas diinput pada hari sidang = 0", relaas(0), 0);
cek("I.10 tidak ada data relaas = -5", poin("dataRelaas", { relaas: [] }), -5);

console.log("Tabel 2 I.11 dan I.12 - mediasi dan saksi");
cek("I.11 rapor mediasi terisi = 5", poin("dataMediasi", { rapotMediasiTerisi: true }), 5);
cek("I.11 rapor mediasi kosong = 0", poin("dataMediasi", { rapotMediasiTerisi: false }), 0);
cek("I.12 saksi lengkap 3 dari 3 = 5", poin("dataSaksi", { saksi: [{ isianTerisi: 3 }] }), 5);
cek("I.12 saksi 2 dari 3 = 3", poin("dataSaksi", { saksi: [{ isianTerisi: 2 }] }), 3);
cek("I.12 saksi 1 dari 3 = 2", poin("dataSaksi", { saksi: [{ isianTerisi: 1 }] }), 2);
cek("I.12 saksi 0 dari 3 = 1", poin("dataSaksi", { saksi: [{ isianTerisi: 0 }] }), 1);
// Perkara TANPA saksi tidak punya data saksi untuk dilengkapi. Sebelumnya
// dinilai nol - seolah datanya dilalaikan - padahal saksinya memang tidak
// pernah ada, dan menghukum pekerjaan yang tidak pernah dibebankan membuat
// papan penilaiannya berhenti dibaca.
cek("I.12 tidak ada saksi = 5 (tidak berlaku)", poin("dataSaksi", { saksi: [] }), 5);
cek(
  "I.12 perkara cabut atau gugur dikecualikan",
  poin("dataSaksi", { saksi: [], dikecualikanSaksi: true }),
  "tidak-terbaca"
);

console.log("Tabel 2 I.13 dan I.14 - pemberitahuan putusan dan BHT");
const pbt = (h) => poin("pemberitahuanPutusan", { wajibPbt: true, hariPbt: h });
cek("I.13 PBT 3 hari = 5", pbt(3), 5);
cek("I.13 PBT 4 hari = 3", pbt(4), 3);
cek("I.13 PBT 5 hari = 2", pbt(5), 2);
cek("I.13 PBT 6 hari = 1", pbt(6), 1);
cek("I.13 PBT 7 hari = 0", pbt(7), 0);
cek(
  "I.13 pelaksanaan dan penginputan dirata-rata",
  poin("pemberitahuanPutusan", { wajibPbt: true, hariPbt: 3, hariInputPbt: 1 }),
  4
);
cek("I.14 BHT terisi = 5", poin("pengisianBht", { wajibBht: true, tanggalBht: tanggal("2025-05-01") }), 5);
cek("I.14 BHT kosong = 0", poin("pengisianBht", { wajibBht: true, tanggalBht: null }), 0);

console.log("Tabel 2 I.15 sampai I.17");
cek("I.15 sisa panjar hari yang sama = 5", poin("sisaPanjar", { hariInputSisaPanjar: 0 }), 5);
cek("I.15 sisa panjar hari ke-4 = 0", poin("sisaPanjar", { hariInputSisaPanjar: 4 }), 0);
cek("I.16 arsip 5 hari = 5", poin("dataArsip", { hariInputArsip: 5 }), 5);
cek("I.16 arsip 6 hari = 3", poin("dataArsip", { hariInputArsip: 6 }), 3);
cek("I.16 arsip 7 hari = 2", poin("dataArsip", { hariInputArsip: 7 }), 2);
cek("I.16 arsip 8 hari = 1", poin("dataArsip", { hariInputArsip: 8 }), 1);
cek("I.16 arsip 9 hari = 0", poin("dataArsip", { hariInputArsip: 9 }), 0);
cek("I.17 delegasi 1 hari = 5", poin("penerimaanDelegasi", { hariTerimaDelegasi: 1 }), 5);
cek("I.17 delegasi 2 hari = 3", poin("penerimaanDelegasi", { hariTerimaDelegasi: 2 }), 3);
cek("I.17 delegasi 5 hari = 0", poin("penerimaanDelegasi", { hariTerimaDelegasi: 5 }), 0);

// ---------------------------------------------------------------------------
console.log("Tabel 2 bagian II - kelengkapan dokumen");
// ---------------------------------------------------------------------------

cek("II.1 petitum ada = 5", poin("eDokPetitum", { adaDokPetitum: true }), 5);
cek("II.1 petitum tidak ada = 0", poin("eDokPetitum", { adaDokPetitum: false }), 0);

const dokRelaas = (ada, seharusnya) =>
  poin("eDokRelaas", { relaasBerdokumen: ada, relaasSeharusnya: seharusnya });
cek("II.2 relaas lengkap 100% = 5", dokRelaas(4, 4), 5);
cek("II.2 relaas 75% = 3", dokRelaas(3, 4), 3);
cek("II.2 relaas 50% = 2", dokRelaas(2, 4), 2);
cek("II.2 relaas 25% = 1", dokRelaas(1, 4), 1);
cek("II.2 relaas 0% = 0", dokRelaas(0, 4), 0);

const bas = (selisih) => {
  const sidang = tanggal("2025-04-10");
  return poin("eDokBas", { bas: [{ tanggalSidang: sidang, tanggalUnggah: geser(sidang, selisih) }] });
};
cek("II.3 BAS 0 hari setelah sidang = 5", bas(0), 5);
cek("II.3 BAS 1 hari = 4", bas(1), 4);
cek("II.3 BAS 2 hari = 3", bas(2), 3);
cek("II.3 BAS 3 hari = 2", bas(3), 2);
cek("II.3 BAS 4 hari = 1", bas(4), 1);
cek("II.3 BAS 5 hari = 0", bas(5), 0);
cek(
  "II.3 BAS tidak diunggah = 0",
  poin("eDokBas", { bas: [{ tanggalSidang: tanggal("2025-04-10"), tanggalUnggah: null }] }),
  0
);

const bhtTanggal = tanggal("2025-05-01");
const akta = (selisih) =>
  poin("eDokAktaCerai", {
    wajibAktaCerai: true,
    tanggalBht: bhtTanggal,
    tanggalAktaCerai: geser(bhtTanggal, selisih),
  });
cek("II.4 akta cerai 1 hari setelah BHT = 5", akta(1), 5);
cek("II.4 akta cerai 2 hari = 4", akta(2), 4);
cek("II.4 akta cerai 3 hari = 3", akta(3), 3);
cek("II.4 akta cerai 4 hari = 2", akta(4), 2);
cek("II.4 akta cerai 5 hari = 1", akta(5), 1);
cek("II.4 akta cerai 6 hari = 1", akta(6), 1);
cek("II.4 akta cerai 7 hari = 0", akta(7), 0);

// ---------------------------------------------------------------------------
console.log("Tabel 2 bagian III - kesesuaian (pengurang)");
// ---------------------------------------------------------------------------

const agenda = (selisih) => {
  const p = tanggal("2025-06-10");
  return poin("agendaSidangTerakhir", {
    tanggalPutus: p,
    tanggalSidangTerakhir: geser(p, -selisih),
  });
};
cek("III.1 sidang terakhir sama dengan tanggal putus = 0", agenda(0), 0);
cek("III.1 selisih 2 hari = -1", agenda(2), -1);
cek("III.1 selisih 3 hari = -1", agenda(3), -1);
cek("III.1 selisih 4 hari = -2", agenda(4), -2);
cek("III.1 selisih 5 hari = -3", agenda(5), -3);
cek("III.1 selisih 6 hari = -5", agenda(6), -5);
cek("III.1 selisih 10 hari = -5", agenda(10), -5);
cek(
  "III.1 talak kabul dikecualikan",
  poin("agendaSidangTerakhir", {
    tanggalPutus: tanggal("2025-06-10"),
    tanggalSidangTerakhir: tanggal("2025-06-01"),
    dikecualikanAgendaTerakhir: true,
  }),
  "tidak-terbaca"
);

cek("III.2 sinkron tiap hari = 0", poin("sinkronisasi", { hariTidakSinkron: 0 }), 0);
cek("III.2 tidak sinkron 1 hari = -1", poin("sinkronisasi", { hariTidakSinkron: 1 }), -1);
cek("III.2 tidak sinkron 3 hari = -3", poin("sinkronisasi", { hariTidakSinkron: 3 }), -3);
cek("III.2 tidak sinkron 4 hari = -5", poin("sinkronisasi", { hariTidakSinkron: 4 }), -5);

cek("III.3 delegasi 6 hari sebelum sidang = 0", poin("permohonanDelegasi", { hariSebelumSidangDelegasi: 6 }), 0);
cek("III.3 delegasi 5 hari = -1", poin("permohonanDelegasi", { hariSebelumSidangDelegasi: 5 }), -1);
cek("III.3 delegasi 4 hari = -2", poin("permohonanDelegasi", { hariSebelumSidangDelegasi: 4 }), -2);
cek("III.3 delegasi 3 hari = -3", poin("permohonanDelegasi", { hariSebelumSidangDelegasi: 3 }), -3);
cek("III.3 delegasi 2 hari = -5", poin("permohonanDelegasi", { hariSebelumSidangDelegasi: 2 }), -5);

cek("III.4 jenis putusan sesuai = 0", poin("jenisPutusan", { jenisPutusanSesuai: true }), 0);
cek("III.4 jenis putusan tidak sesuai = -5", poin("jenisPutusan", { jenisPutusanSesuai: false }), -5);

// ---------------------------------------------------------------------------
console.log("Bab II huruf C - rumus nilai satker");
// ---------------------------------------------------------------------------

// Satu perkara sempurna pada seluruh unsur yang terbaca.
const sempurna = {
  tanggalDaftar: tanggal("2025-01-06"),
  tanggalPutus: tanggal("2025-02-10"),
  tanggalMinutasi: tanggal("2025-02-11"),
  tanggalUnggahPutusan: tanggal("2025-02-12"),
  tanggalInputPendaftaran: tanggal("2025-01-06"),
  tanggalPmh: tanggal("2025-01-06"),
  tanggalInputPmh: tanggal("2025-01-06"),
  tanggalPpp: tanggal("2025-01-06"),
  tanggalInputPpp: tanggal("2025-01-06"),
  tanggalPjs: tanggal("2025-01-06"),
  tanggalInputPjs: tanggal("2025-01-06"),
  tanggalPhs: tanggal("2025-01-06"),
  tanggalInputPhs: tanggal("2025-01-06"),
  relaas: [{ tanggalSidang: tanggal("2025-01-20"), tanggalInput: tanggal("2025-01-15") }],
  rapotMediasiTerisi: true,
  saksi: [{ isianTerisi: 3 }],
  wajibPbt: true,
  hariPbt: 1,
  hariInputPbt: 0,
  wajibBht: true,
  tanggalBht: tanggal("2025-02-25"),
  hariInputSisaPanjar: 0,
  hariInputArsip: 1,
  hariTerimaDelegasi: 1,
  adaDokPetitum: true,
  relaasBerdokumen: 2,
  relaasSeharusnya: 2,
  bas: [{ tanggalSidang: tanggal("2025-01-20"), tanggalUnggah: tanggal("2025-01-20") }],
  wajibAktaCerai: true,
  tanggalAktaCerai: tanggal("2025-02-26"),
  tanggalSidangTerakhir: tanggal("2025-02-10"),
  hariTidakSinkron: 0,
  hariSebelumSidangDelegasi: 7,
  jenisPutusanSesuai: true,
  dataPerkaraValid: true,
};

const hasilSempurna = penilaian.nilaiSatker([sempurna]);
cek("perkara sempurna: seluruh unsur terbaca", hasilSempurna.utuh, true);
cek("perkara sempurna: NKPP = 50", hasilSempurna.nkpp, 50);
cek("perkara sempurna: NKPS = 50", hasilSempurna.nkps, 50);
cek("perkara sempurna: nilai akhir = 100", hasilSempurna.nilaiAkhir, 100);
cek("perkara sempurna: predikat 5 bintang", hasilSempurna.predikat.bintang, 5);
cek("perkara sempurna: warna hijau", hasilSempurna.warna, "hijau");

// NKPP adalah rata-rata BERBOBOT: tiap unsur sudah dikalikan bobotnya, maka
// menjumlahkannya menghasilkan 50 pada satker sempurna - bukan dibagi tiga.
const kinerjaSaja = penilaian.nilaiSatker([
  {
    tanggalDaftar: tanggal("2025-01-06"),
    tanggalPutus: tanggal("2025-02-10"),
    tanggalMinutasi: tanggal("2025-02-11"),
    tanggalUnggahPutusan: tanggal("2025-02-12"),
  },
]);
cek("NKPP rata-rata berbobot: 20+15+15 = 50", kinerjaSaja.nkpp, 50);
cek("unsur yang tidak terbaca dilaporkan bobotnya", kinerjaSaja.utuh, false);

// Nilai riil dijumlahkan lintas perkara sebelum dibagi maksimalnya.
const duaPerkara = penilaian.nilaiSatker([
  { tanggalDaftar: tanggal("2025-01-06"), tanggalPutus: tanggal("2025-02-10") }, // 35 hari = 5
  { tanggalDaftar: tanggal("2025-01-06"), tanggalPutus: tanggal("2025-06-10") }, // 155 hari = 0
]);
const unsurPutus = duaPerkara.unsur.find((u) => u.kunci === "waktuPutus");
cek("dua perkara: poin riil waktu putus = 5", unsurPutus.poinRiil, 5);
cek("dua perkara: poin maksimal waktu putus = 10", unsurPutus.poinMaksimal, 10);
cek("dua perkara: nilai unsur = 5/10 x 20% = 10", unsurPutus.nilai, 10);

// Unsur pengurang benar-benar mengurangi.
const denganPengurang = penilaian.nilaiSatker([{ ...sempurna, jenisPutusanSesuai: false }]);
cek(
  "jenis putusan tidak sesuai mengurangi 2%",
  Math.round((hasilSempurna.nilaiAkhir - denganPengurang.nilaiAkhir) * 100) / 100,
  2
);

// ---------------------------------------------------------------------------
console.log("Bab III - predikat, warna, dan kategori satker");
// ---------------------------------------------------------------------------

cek("predikat 99% = 5 bintang", penilaian.predikat(99).bintang, 5);
cek("predikat 98% = 4 bintang", penilaian.predikat(98).bintang, 4);
cek("predikat 96% = 4 bintang", penilaian.predikat(96).bintang, 4);
cek("predikat 95% = 3 bintang", penilaian.predikat(95).bintang, 3);
cek("predikat 91% = 3 bintang", penilaian.predikat(91).bintang, 3);
cek("predikat 90% = 2 bintang", penilaian.predikat(90).bintang, 2);
cek("predikat 76% = 2 bintang", penilaian.predikat(76).bintang, 2);
cek("predikat 70% = 1 bintang", penilaian.predikat(70).bintang, 1);

cek("warna 91% hijau", penilaian.warna(91), "hijau");
cek("warna 90% kuning", penilaian.warna(90), "kuning");
cek("warna 61% kuning", penilaian.warna(61), "kuning");
cek("warna 60% merah", penilaian.warna(60), "merah");
cek("warna 20% merah", penilaian.warna(20), "merah");

cek("PA 6000 perkara = kategori I", penilaian.kategoriSatker(6000), "I");
// SK menulis Kategori I "5000 ke atas" dan Kategori II "2501 - 5000" -
// keduanya memuat 5000. Yang dipakai penyebutan yang tegas: 5000 = Kategori I.
cek("PA 5000 perkara = kategori I (batas tumpang tindih di SK)", penilaian.kategoriSatker(5000), "I");
cek("PA 4999 perkara = kategori II", penilaian.kategoriSatker(4999), "II");
cek("PA 2501 perkara = kategori II", penilaian.kategoriSatker(2501), "II");
cek("PA 2500 perkara = kategori III", penilaian.kategoriSatker(2500), "III");
cek("PA 1001 perkara = kategori III", penilaian.kategoriSatker(1001), "III");
cek("PA 1000 perkara = kategori IV", penilaian.kategoriSatker(1000), "IV");
cek("PA 251 perkara = kategori IV", penilaian.kategoriSatker(251), "IV");
cek("PA 250 perkara = kategori V", penilaian.kategoriSatker(250), "V");
cek("PTA 151 perkara = kategori I", penilaian.kategoriSatker(151, "banding"), "I");
cek("PTA 150 perkara = kategori II", penilaian.kategoriSatker(150, "banding"), "II");
cek("PTA 50 perkara = kategori III", penilaian.kategoriSatker(50, "banding"), "III");

// ---------------------------------------------------------------------------
console.log("\nButir yang TIDAK BERLAKU dinilai sempurna, bukan nol");

// Perkara tanpa saksi, tanpa mediasi, tanpa delegasi, dan bukan perkara
// perceraian sebelumnya mendapat nol - seolah pekerjaannya dilalaikan. Tidak
// ada yang dilalaikan: pekerjaannya memang tidak pernah ada, dan papan
// penilaian yang menghukum hal yang mustahil dikerjakan akan berhenti dibaca.
cek("mediasi tidak ada = 5", poin("dataMediasi", { adaMediasi: false, rapotMediasiTerisi: false }), 5);

// Yang dibedakan dengan hati-hati: TIDAK ADA mediasi berbeda dari ADA mediasi
// yang rapornya belum diisi. Yang kedua memang kelalaian.
cek(
  "mediasi ada tapi rapor kosong tetap 0",
  poin("dataMediasi", { adaMediasi: true, rapotMediasiTerisi: false }),
  0
);
cek(
  "mediasi ada dan rapor terisi = 5",
  poin("dataMediasi", { adaMediasi: true, rapotMediasiTerisi: true }),
  5
);

cek("tidak menerima delegasi = 5", poin("penerimaanDelegasi", { hariTerimaDelegasi: null }), 5);

// Butir tabayun PENGURANG - nilai terbaiknya 0, bukan 5. Tidak ada tabayun
// berarti tidak ada pengurangan sama sekali, dan itulah bentuk sempurnanya.
cek(
  "tidak ada tabayun = 0 (tanpa pengurangan)",
  poin("permohonanDelegasi", { hariSebelumSidangDelegasi: null }),
  0
);
cek(
  "tabayun 2 hari sebelum sidang = -5",
  poin("permohonanDelegasi", { hariSebelumSidangDelegasi: 2 }),
  -5
);

cek("bukan perkara perceraian = 5", poin("eDokAktaCerai", { wajibAktaCerai: false }), 5);

// Jenis perkaranya belum terbaca BUKAN berarti bukan perkara perceraian.
// Memberi nilai sempurna di sini berarti menilai perkara yang jenisnya tidak
// diketahui - nilai yang tidak berdasar apa pun.
cek("jenis perkara tidak terbaca = belum dinilai", poin("eDokAktaCerai", {}), "tidak-terbaca");

console.log("\nI.13 Pemberitahuan putusan - hanya bagi yang TIDAK HADIR");

// Pihak yang HADIR saat putusan dibacakan sudah mendengarnya sendiri.
// Menuntut pemberitahuan kepadanya berarti menilai pekerjaan yang tidak ada.
cek(
  "kedua pihak hadir = 5 (tidak perlu diberitahu)",
  poin("pemberitahuanPutusan", {
    wajibPbt: false,
    alasanTidakWajibPbt: "Kedua pihak hadir saat putusan dibacakan.",
  }),
  5
);

// Wajib, dan sudah dilaksanakan - dinilai menurut tangga SK.
cek("wajib, PBT 3 hari = 5", poin("pemberitahuanPutusan", { wajibPbt: true, hariPbt: 3 }), 5);
cek("wajib, PBT 4 hari = 3", poin("pemberitahuanPutusan", { wajibPbt: true, hariPbt: 4 }), 3);
cek("wajib, PBT 6 hari = 1", poin("pemberitahuanPutusan", { wajibPbt: true, hariPbt: 6 }), 1);
cek("wajib, PBT 8 hari = 0", poin("pemberitahuanPutusan", { wajibPbt: true, hariPbt: 8 }), 0);

// Wajib tetapi belum dilaksanakan - inilah kelalaian yang sebenarnya.
cek(
  "wajib tetapi belum diberitahukan = 0",
  poin("pemberitahuanPutusan", {
    wajibPbt: true,
    hariPbt: null,
    pbtPerPihak: [{ sebutan: "Tergugat/Termohon", tanggal: "", hari: null }],
  }),
  0
);

// Belum tersambung sama sekali - berbeda dari tidak wajib.
cek(
  "data PBT belum tersambung = belum dinilai",
  poin("pemberitahuanPutusan", {}),
  "tidak-terbaca"
);

console.log("");
console.log("Perkara kosong - yang belum diisi bernilai nol, yang tak terbaca tidak");
// ---------------------------------------------------------------------------

const kosong = penilaian.poinPerkara({});
cek(
  "perkara kosong: tidak ada unsur yang bernilai selain null",
  kosong.rinci.every((x) => !x.terbaca),
  true
);
cek("perkara kosong: seluruh unsur dilaporkan belum tersambung", kosong.unsurBelumTersambung.length, kosong.rinci.length);

const kosongNilai = penilaian.nilaiSatker([{}]);
cek("perkara kosong: nilai akhir 0", kosongNilai.nilaiAkhir, 0);
cek("perkara kosong: dinyatakan tidak utuh", kosongNilai.utuh, false);

// Pemeriksaan diri: pastikan skrip ini benar-benar menguji sesuatu.
if (jumlah < 120) {
  gagal += 1;
  console.log(`  GAGAL: skrip hanya menjalankan ${jumlah} pemeriksaan - terlalu sedikit, ada yang tidak berjalan.`);
}

console.log("");
if (gagal === 0) {
  console.log(`  OK - ${jumlah} pemeriksaan lulus.`);
  console.log("");
  process.exit(0);
} else {
  console.log(`  ${gagal} dari ${jumlah} pemeriksaan GAGAL.`);
  console.log("");
  process.exit(1);
}
