"use strict";

/**
 * ============================================================================
 * REKAP PETUGAS - DIHITUNG ATAS SIPP TIRUAN YANG SUNGGUH MENYARING
 * ============================================================================
 *
 * db_config diganti tiruan sebelum layanannya dimuat. Tiruan ini BUKAN daftar
 * jawaban kalengan: ia menyimpan tabel kecil (perkara, putusan, penunjukan,
 * mediasi, relaas, sidang) dan MENJALANKAN saringan tiap kueri atas
 * parameternya - hakim_id yang dikirim layanan itulah yang menentukan baris
 * mana yang pulang. Layanan yang menyaring lewat nama, atau mengirim id yang
 * keliru, mendapat baris yang keliru dan hitungannya patah di sini.
 *
 * Yang dijaga:
 *   - hitungan per kedudukan, keadaan, hasil putusan, lama perkara (termasuk
 *     potongan mediasi), verstek, e-Court, banding - beserta pembilang dan
 *     penyebutnya;
 *   - penyebut nol menghasilkan persen null, bukan 0 atau NaN;
 *   - dua hakim BERNAMA SAMA tetap dua orang - dikenali lewat id;
 *   - mediator: FIND_IN_SET atas daftar ber-koma, cadangan lewat
 *     perkara_mediator, penyatuan lewat mediator.hakim_id;
 *   - relaas juru sita dan sidang panitera hanya pada perkara tugasannya;
 *   - pemeriksa perkara yang sudah putus = yang menjabat pada hari putusan,
 *     bukan yang aktif sekarang; majelis/petugas ikrar talak disebut sendiri;
 *   - masukan yang tidak sah ditolak dengan alasannya;
 *   - singgahan: hitungan kedua tidak menyentuh SIPP, yang sebagian gagal
 *     tidak disinggahkan;
 *   - ID petugas ikut pada muatan Status Perkara (majelis, panitera,
 *     jurusita, mediator).
 *
 * Tidak ada basis data yang disentuh. Nama orang dan nomor perkara karangan.
 */

const pathx = require("path");
const Module = require("module");

let lulus = 0;
let gagal = 0;

function periksa(nama, benar, keterangan) {
  if (benar) {
    lulus += 1;
    console.log(`  OK    ${nama}`);
  } else {
    gagal += 1;
    console.log(`  GAGAL ${nama}${keterangan !== undefined ? ` - ${JSON.stringify(keterangan)}` : ""}`);
  }
}

const HARI_INI = "2026-09-27";

// ============================================================================
// SIPP TIRUAN
// ============================================================================

// `jenis` adalah SALINAN nama pada tabel perkara; 103 sengaja masih memakai
// nama lama ("Istbat Nikah") sedangkan rujukan jenis_perkara-nya sudah
// "Pengesahan Perkawinan/Istbat Nikah" - keadaan yang terukur pada 89 perkara
// sipp_donggala. Rekap mengelompokkan menurut id, dengan nama rujukannya.
const PERKARA = {
  101: { nomor: "101/Pdt.G/2025/PA.Ctt", daftar: "2025-01-10", jenisId: 1, jenis: "Cerai Gugat" },
  102: { nomor: "102/Pdt.G/2025/PA.Ctt", daftar: "2025-02-01", jenisId: 1, jenis: "Cerai Gugat" },
  103: { nomor: "103/Pdt.P/2025/PA.Ctt", daftar: "2025-03-01", jenisId: 2, jenis: "Istbat Nikah" },
  104: { nomor: "104/Pdt.G/2026/PA.Ctt", daftar: "2026-01-05", jenisId: 3, jenis: "Cerai Talak" },
  105: { nomor: "105/Pdt.G/2026/PA.Ctt", daftar: "2026-03-01", jenisId: 1, jenis: "Cerai Gugat" },
  106: { nomor: "106/Pdt.G/2026/PA.Ctt", daftar: "2026-09-01", jenisId: 1, jenis: "Cerai Gugat" },
  201: { nomor: "201/Pdt.G/2025/PA.Ctt", daftar: "2025-05-05", jenisId: 1, jenis: "Cerai Gugat" },
  // Perkara bermajelis ikrar talak - lihat HAKIM_PERKARA.
  301: { nomor: "301/Pdt.G/2026/PA.Ctt", daftar: "2026-01-10", jenisId: 3, jenis: "Cerai Talak" },
  302: { nomor: "302/Pdt.G/2026/PA.Ctt", daftar: "2026-02-10", jenisId: 3, jenis: "Cerai Talak" },
  303: { nomor: "303/Pdt.G/2026/PA.Ctt", daftar: "2026-03-10", jenisId: 1, jenis: "Cerai Gugat" },
  304: { nomor: "304/Pdt.G/2026/PA.Ctt", daftar: "2026-04-10", jenisId: 3, jenis: "Cerai Talak" },
  // Pengganti yang ditetapkan SESUDAH putusan - lihat HAKIM_PERKARA.
  305: { nomor: "305/Pdt.G/2026/PA.Ctt", daftar: "2026-04-14", jenisId: 3, jenis: "Cerai Talak" },
  306: { nomor: "306/Pdt.G/2026/PA.Ctt", daftar: "2026-05-11", jenisId: 3, jenis: "Cerai Talak" },
  307: { nomor: "307/Pdt.G/2026/PA.Ctt", daftar: "2026-06-09", jenisId: 1, jenis: "Cerai Gugat" },
  308: { nomor: "308/Pdt.G/2026/PA.Ctt", daftar: "2026-07-01", jenisId: 1, jenis: "Cerai Gugat" },
  // Majelis/petugas ikrar yang hanya tercatat di borang ikrar - lihat BORANG_IKRAR.
  309: { nomor: "309/Pdt.G/2026/PA.Ctt", daftar: "2026-07-15", jenisId: 3, jenis: "Cerai Talak" },
  310: { nomor: "310/Pdt.G/2026/PA.Ctt", daftar: "2026-07-16", jenisId: 3, jenis: "Cerai Talak" },
  311: { nomor: "311/Pdt.G/2026/PA.Ctt", daftar: "2026-08-25", jenisId: 3, jenis: "Cerai Talak" },
};
const JENIS_PERKARA = { 1: "Cerai Gugat", 2: "Pengesahan Perkawinan/Istbat Nikah", 3: "Cerai Talak" };

const STATUS = { 62: "Dikabulkan", 67: "Dicabut", 7: "Dicabut", 64: "Tidak Dapat Diterima" };

// status_putusan_nama sengaja KOSONG, seperti di SIPP satker - nama status
// hanya boleh datang lewat JOIN status_putusan.
const PUTUSAN = {
  101: { putus: "2025-02-20", bht: "2025-03-10", verstek: "Y", statusId: 62 },
  102: { putus: "2025-08-01", bht: null, verstek: "T", statusId: 67 },
  103: { putus: "2025-03-15", bht: "2025-03-29", verstek: null, statusId: 64 },
  104: { putus: "2026-02-04", bht: "2026-02-18", verstek: "T", statusId: 7 },
  201: { putus: "2025-06-01", bht: "2025-06-15", verstek: "Y", statusId: 62 },
  301: { putus: "2026-02-10", bht: "2026-02-24", verstek: "T", statusId: 62 },
  302: { putus: "2026-03-20", bht: "2026-04-03", verstek: "Y", statusId: 62 },
  303: { putus: "2026-04-20", bht: null, verstek: "T", statusId: 62 },
  304: { putus: "2026-05-10", bht: "2026-05-24", verstek: "T", statusId: 62 },
  305: { putus: "2026-05-20", bht: "2026-06-03", verstek: "T", statusId: 62 },
  306: { putus: "2026-06-10", bht: "2026-06-24", verstek: "T", statusId: 62 },
  307: { putus: "2026-07-20", bht: null, verstek: "T", statusId: 62 },
  308: { putus: "2026-08-10", bht: null, verstek: "T", statusId: 62 },
  309: { putus: "2026-08-20", bht: "2026-09-03", verstek: "T", statusId: 62 },
  310: { putus: "2026-08-25", bht: "2026-09-08", verstek: "T", statusId: 62 },
  311: { putus: "2026-09-15", bht: null, verstek: "T", statusId: 62 },
};

const EFILING = new Set([101, 104, 105]);
const BANDING = new Set([101]);

// Dua hakim BERNAMA SAMA: id 7 dan id 8 orang yang berbeda.
const HAKIM_PN = {
  7: { kode: "C1", nama: "Hakim Tujuh", namaGelar: "Hakim Tujuh, S.H.", aktif: "Y" },
  8: { kode: "C2", nama: "Hakim Tujuh", namaGelar: "Hakim Tujuh, S.H.", aktif: "T" },
  13: { kode: "", nama: "Hakim Tiga Belas", namaGelar: "Hakim Tiga Belas, S.H.", aktif: "Y" },
  14: { kode: "", nama: "Hakim Empat Belas", namaGelar: "Hakim Empat Belas, S.H.", aktif: "Y" },
  15: { kode: "", nama: "Hakim Lima Belas", namaGelar: "Hakim Lima Belas, S.H.", aktif: "Y" },
  16: { kode: "", nama: "Hakim Enam Belas", namaGelar: "Hakim Enam Belas, S.H.", aktif: "Y" },
  17: { kode: "", nama: "Hakim Tujuh Belas", namaGelar: "Hakim Tujuh Belas, S.H.", aktif: "Y" },
  21: { kode: "", nama: "Hakim Dua Satu", namaGelar: "Hakim Dua Satu, S.H.", aktif: "Y" },
  22: { kode: "", nama: "Hakim Dua Dua", namaGelar: "Hakim Dua Dua, S.H.", aktif: "Y" },
  23: { kode: "", nama: "Hakim Dua Tiga", namaGelar: "Hakim Dua Tiga, S.H.", aktif: "Y" },
  24: { kode: "", nama: "Hakim Dua Empat", namaGelar: "Hakim Dua Empat, S.H.", aktif: "Y" },
  25: { kode: "", nama: "Hakim Dua Lima", namaGelar: "Hakim Dua Lima, S.H.", aktif: "Y" },
  26: { kode: "", nama: "Hakim Dua Enam", namaGelar: "Hakim Dua Enam, S.H.", aktif: "Y" },
  27: { kode: "", nama: "Hakim Dua Tujuh", namaGelar: "Hakim Dua Tujuh, S.H.", aktif: "Y" },
  28: { kode: "", nama: "Hakim Dua Delapan", namaGelar: "Hakim Dua Delapan, S.H.", aktif: "Y" },
};
const PANITERA_PN = {
  5: { kode: "", nama: "Panitera Lima", namaGelar: "Panitera Lima, S.H.", aktif: "Y" },
  6: { kode: "", nama: "Panitera Kosong", namaGelar: "Panitera Kosong, S.H.", aktif: "Y" },
  8: { kode: "", nama: "Panitera Delapan", namaGelar: "Panitera Delapan, S.H.", aktif: "Y" },
  9: { kode: "", nama: "Panitera Sembilan", namaGelar: "Panitera Sembilan, S.H.", aktif: "Y" },
};
const JURUSITA = {
  9: { kode: "", nama: "Jurusita Sembilan", namaGelar: "", aktif: "Y", jabatan: "2" },
  11: { kode: "", nama: "Jurusita Sebelas", namaGelar: "", aktif: "Y", jabatan: "2" },
  12: { kode: "", nama: "Jurusita Dua Belas", namaGelar: "", aktif: "Y", jabatan: "2" },
};
const MEDIATOR = {
  40: { status: "H", hakimId: 7, nama: "Hakim Tujuh", namaGelar: "Hakim Tujuh, S.H.", aktif: "Y", bersertifikat: "Y" },
  41: { status: "N", hakimId: null, nama: "Mediator Luar", namaGelar: "Mediator Luar, S.H.", aktif: "Y", bersertifikat: "Y" },
  // Hakim 7 tercatat DUA KALI di tabel mediator - satu orang.
  42: { status: "H", hakimId: 7, nama: "Hakim Tujuh", namaGelar: "Hakim Tujuh, S.H.", aktif: "Y", bersertifikat: "T" },
};

/**
 * Baris penunjukan: tahapan 10 pemeriksaan, 18 ikrar talak. `tidakAktif` =
 * tanggal_tidak_aktif - begitulah SIPP menandai PERGANTIAN (terukur: 2.845
 * baris T tahapan 10 bertanggal). Majelis pemeriksaan yang DINONAKTIFKAN SIPP
 * saat majelis ikrar ditetapkan tidak bertanggal (2.442 baris, 817 perkara) -
 * keadaan yang ditirukan perkara 301 dan 302. Pemeriksa perkara yang sudah
 * putus adalah yang menjabat pada hari putusan (PUTUSAN di atas).
 *
 * Ejaan nama sengaja berbeda-beda untuk orang yang sama.
 */
let idBaris = 0;
function tunjuk(perkara, orang, { tahapan = 10, urutan = 1, jabatan = 2, aktif = "Y", tidakAktif = null, penetapan = "2025-01-01", nama = "" } = {}) {
  idBaris += 1;
  return { id: idBaris, perkara, orang, tahapan, urutan, jabatan, aktif, tidakAktif, penetapan, nama };
}
const HAKIM_PERKARA = [
  tunjuk(101, 7, { urutan: 1, jabatan: 1, nama: "Hakim Tujuh" }),
  tunjuk(102, 7, { urutan: 2, jabatan: 2, nama: "Hakim Tujuh, S.H." }),
  tunjuk(103, 7, { urutan: 1, jabatan: 3, nama: "HAKIM TUJUH" }),
  // 104: hakim 7 DIGANTI sungguhan sebelum putusan, kursinya diisi hakim 13.
  tunjuk(104, 7, { urutan: 1, jabatan: 1, aktif: "T", tidakAktif: "2026-01-20", nama: "Hakim Tujuh" }),
  tunjuk(104, 13, { urutan: 1, jabatan: 1, penetapan: "2026-01-20" }),
  tunjuk(105, 7, { urutan: 2, jabatan: 2, nama: "Hakim Tujuh, S.H." }),
  tunjuk(106, 7, { urutan: 2, jabatan: 2, nama: "Hakim Tujuh" }),
  tunjuk(106, 7, { urutan: 1, jabatan: 1, nama: "Hakim Tujuh" }),
  tunjuk(201, 8, { urutan: 1, jabatan: 1, nama: "Hakim Tujuh, S.H." }),
  tunjuk(101, 8, { urutan: 2, jabatan: 2, nama: "Hakim Tujuh, S.H." }),

  // 301 - seperti perkara_id 385 sipp_donggala: majelis pemeriksa (14 ketua,
  // 16, 17) DINONAKTIFKAN SIPP tanpa tanggal saat majelis ikrar ditetapkan;
  // ketua ikrarnya 15, yang tidak pernah duduk di majelis pemeriksaan.
  tunjuk(301, 14, { urutan: 1, jabatan: 1, aktif: "T", penetapan: "2026-01-11" }),
  tunjuk(301, 16, { urutan: 2, jabatan: 2, aktif: "T", penetapan: "2026-01-11" }),
  tunjuk(301, 17, { urutan: 3, jabatan: 2, aktif: "T", penetapan: "2026-01-11" }),
  tunjuk(301, 15, { tahapan: 18, urutan: 1, jabatan: 1, penetapan: "2026-02-20" }),
  tunjuk(301, 16, { tahapan: 18, urutan: 2, jabatan: 2, penetapan: "2026-02-20" }),
  tunjuk(301, 17, { tahapan: 18, urutan: 3, jabatan: 2, penetapan: "2026-02-20" }),

  // 302 - seperti perkara_id 9920: pergantian SUNGGUHAN di tengah pemeriksaan
  // (15 diganti 16, bertanggal), lalu majelis kedua dinonaktifkan oleh ikrar.
  tunjuk(302, 14, { urutan: 1, jabatan: 1, aktif: "T", tidakAktif: "2026-02-20", penetapan: "2026-02-11" }),
  tunjuk(302, 15, { urutan: 2, jabatan: 2, aktif: "T", tidakAktif: "2026-02-20", penetapan: "2026-02-11" }),
  tunjuk(302, 14, { urutan: 1, jabatan: 1, aktif: "T", penetapan: "2026-02-20" }),
  tunjuk(302, 16, { urutan: 2, jabatan: 2, aktif: "T", penetapan: "2026-02-20" }),
  tunjuk(302, 14, { tahapan: 18, urutan: 1, jabatan: 1, penetapan: "2026-03-25" }),
  tunjuk(302, 16, { tahapan: 18, urutan: 2, jabatan: 2, penetapan: "2026-03-25" }),

  // 303 - seperti perkara_id 10035: pergantian sungguhan TANPA ikrar; seluruh
  // majelis ditulis ulang dan 14 berpindah dari anggota ke ketua.
  tunjuk(303, 15, { urutan: 1, jabatan: 1, aktif: "T", tidakAktif: "2026-03-20", penetapan: "2026-03-11" }),
  tunjuk(303, 14, { urutan: 2, jabatan: 2, aktif: "T", tidakAktif: "2026-03-20", penetapan: "2026-03-11" }),
  tunjuk(303, 14, { urutan: 1, jabatan: 1, penetapan: "2026-03-20" }),
  tunjuk(303, 16, { urutan: 2, jabatan: 2, penetapan: "2026-03-20" }),

  // 304 - seperti perkara_id 6117: pemeriksaan masih aktif, majelis ikrarnya
  // seluruhnya T. 15 tidak memeriksa dan tidak aktif di ikrar.
  tunjuk(304, 14, { urutan: 1, jabatan: 1, penetapan: "2026-04-11" }),
  tunjuk(304, 16, { urutan: 2, jabatan: 2, penetapan: "2026-04-11" }),
  tunjuk(304, 15, { tahapan: 18, urutan: 1, jabatan: 1, aktif: "T", penetapan: "2026-05-01" }),

  // 305 - seperti perkara_id 1895: putus 20 Mei; majelis ikrar (23, 24)
  // dicatat sebagai PENGGANTI di tahapan 10 pada 5 Juni - sesudah putusan -
  // lalu dinonaktifkan penetapan ikrarnya. Baris terakhir tiap kursi (dan yang
  // tak bertanggal) adalah majelis ikrar; pemeriksanya 21 dan 22. Kursi 2
  // semula milik 17, diganti 22 pada 15 April tanpa tanggal tidak aktif:
  // keduanya "menjabat" menurut tanggalnya, yang terakhir ditetapkan menang.
  tunjuk(305, 17, { urutan: 2, jabatan: 2, aktif: "T", penetapan: "2026-04-01" }),
  tunjuk(305, 21, { urutan: 1, jabatan: 1, aktif: "T", tidakAktif: "2026-06-05", penetapan: "2026-04-15" }),
  tunjuk(305, 22, { urutan: 2, jabatan: 2, aktif: "T", tidakAktif: "2026-06-05", penetapan: "2026-04-15" }),
  tunjuk(305, 23, { urutan: 1, jabatan: 1, aktif: "T", penetapan: "2026-06-05" }),
  tunjuk(305, 24, { urutan: 2, jabatan: 2, aktif: "T", penetapan: "2026-06-05" }),
  tunjuk(305, 23, { tahapan: 18, urutan: 1, jabatan: 1, penetapan: "2026-06-06" }),
  tunjuk(305, 24, { tahapan: 18, urutan: 2, jabatan: 2, penetapan: "2026-06-06" }),

  // 306 - seperti perkara_id 2373 dan 4613: putus 10 Juni; pengganti yang
  // ditetapkan 1 Juli, SESUDAH putusan, masih AKTIF sampai sekarang.
  tunjuk(306, 21, { urutan: 1, jabatan: 3, aktif: "T", penetapan: "2026-05-12" }),
  tunjuk(306, 25, { urutan: 1, jabatan: 3, penetapan: "2026-07-01" }),

  // 307 - seperti perkara_id 703: baris AKTIF yang tanggal tidak aktifnya
  // terisi sebelum putusan. Penanda aktif SIPP yang dipercaya.
  tunjuk(307, 22, { urutan: 1, jabatan: 1, tidakAktif: "2026-07-01", penetapan: "2026-06-10" }),
  tunjuk(307, 25, { urutan: 2, jabatan: 2, penetapan: "2026-06-10" }),

  // 308 - penetapan majelis tertulis SESUDAH putusan (10 Agustus): tak satu
  // pun menjabat pada hari itu, jadi berlaku aturan tanpa hari putusan -
  // baris terakhir tiap kursi, yang tak bertanggal didahulukan.
  tunjuk(308, 24, { urutan: 1, jabatan: 1, aktif: "T", tidakAktif: "2026-08-25", penetapan: "2026-08-15" }),
  tunjuk(308, 23, { urutan: 1, jabatan: 1, aktif: "T", penetapan: "2026-08-25" }),

  // 309 - seperti perkara_id 1, 4, 384 sipp_donggala: TANPA baris tahapan 18;
  // majelis ikrarnya (27, 28) hanya tercatat di borang ikrar (BORANG_IKRAR).
  tunjuk(309, 13, { urutan: 1, jabatan: 3, penetapan: "2026-07-20" }),

  // 311 - 26 diganti 13 sebelum putusan, lalu menjadi hakim ikrar menurut
  // borang - tanpa baris tahapan 18.
  tunjuk(311, 26, { urutan: 1, jabatan: 3, aktif: "T", tidakAktif: "2026-09-05", penetapan: "2026-09-01" }),
  tunjuk(311, 13, { urutan: 1, jabatan: 3, penetapan: "2026-09-05" }),
];
const PANITERA_PERKARA = [
  tunjuk(101, 5),
  tunjuk(102, 5),
  // 103: panitera 5 diganti sungguhan sebelum putusan oleh panitera 7.
  tunjuk(103, 5, { aktif: "T", tidakAktif: "2025-03-05" }),
  tunjuk(103, 7, { penetapan: "2025-03-05" }),
  // 104: panitera 5 hanya pada ikrar talak - pemeriksaannya panitera 7.
  tunjuk(104, 7),
  tunjuk(104, 5, { tahapan: 18, penetapan: "2026-02-05" }),
  // 305: panitera 8 mendampingi pemeriksaan; panitera 9 ditetapkan SESUDAH
  // putusan (seperti perkara_id 3306 dan 3307 sipp_donggala) dan masih aktif.
  tunjuk(305, 8, { aktif: "T", tidakAktif: "2026-06-05", penetapan: "2026-04-15" }),
  tunjuk(305, 9, { penetapan: "2026-06-05" }),
];
const JURUSITA_PERKARA = [
  tunjuk(101, 9),
  tunjuk(102, 9),
  tunjuk(105, 9),
  // 104: juru sita 9 hanya pada ikrar talak - pemeriksaannya juru sita 10.
  tunjuk(104, 10),
  tunjuk(104, 9, { tahapan: 18, penetapan: "2026-02-05" }),
  // 305: juru sita 11 memanggil selama pemeriksaan; juru sita 12 ditetapkan
  // SESUDAH putusan (seperti perkara_id 9143 sipp_donggala) dan masih aktif.
  tunjuk(305, 11, { aktif: "T", tidakAktif: "2026-06-05", penetapan: "2026-04-15" }),
  tunjuk(305, 12, { penetapan: "2026-06-05" }),
];

/**
 * Borang penetapan ikrar talak (perkara_ikrar_talak), bentuk yang terukur di
 * sipp_donggala: id ber-koma berurutan dengan nama pada teksnya. Menurut
 * ikrarLengkap (majelisPemeriksaService), per peran: penunjukan aktif tahapan
 * 18 bila ada, selainnya borang ini.
 */
const BORANG_IKRAR = [
  // 309: tanpa tahapan 18 sama sekali - majelis, panitera, dan juru sita
  // ikrarnya hanya di sini.
  {
    perkara: 309,
    majelisId: "27,28",
    majelisTeks: "Hakim Ketua: Hakim Dua Tujuh, S.H.</br>Hakim Anggota 1: Hakim Dua Delapan, S.H.",
    paniteraId: "9",
    paniteraTeks: "Panitera Pengganti: Panitera Sembilan, S.H.",
    jurusitaId: "12",
    jurusitaTeks: "Juru Sita Pengganti: Jurusita Dua Belas",
  },
  // 301: majelis ikrarnya TERCATAT di tahapan 18 (15, 16, 17) - borang yang
  // menyebut 28 tidak dipakai untuk hakim. Paniteranya hanya di borang.
  {
    perkara: 301,
    majelisId: "28,16,17",
    majelisTeks: "Hakim Ketua: Hakim Dua Delapan</br>Hakim Anggota 1: Hakim Enam Belas</br>Hakim Anggota 2: Hakim Tujuh Belas",
    paniteraId: "8",
    paniteraTeks: "Panitera Pengganti: Panitera Delapan",
    jurusitaId: null,
    jurusitaTeks: null,
  },
  // 310: tiga id, dua nama - tidak dapat dipasangkan, tidak dikreditkan.
  {
    perkara: 310,
    majelisId: "27,28,26",
    majelisTeks: "Majelis Hakim : Hakim Dua Tujuh<br>Hakim Dua Delapan",
    paniteraId: null,
    paniteraTeks: null,
    jurusitaId: null,
    jurusitaTeks: null,
  },
  // 311: hakim tunggal ikrar 26 hanya di borang.
  { perkara: 311, majelisId: "26", majelisTeks: "Hakim Tunggal: Hakim Dua Enam", paniteraId: null, paniteraTeks: null, jurusitaId: null, jurusitaTeks: null },
  // 104: panitera (5) dan juru sita (9) ikrarnya TERCATAT di tahapan 18 -
  // borang yang menyebut 7 dan 10 tidak dipakai.
  {
    perkara: 104,
    majelisId: null,
    majelisTeks: null,
    paniteraId: "7",
    paniteraTeks: "Panitera Pengganti: Panitera Tujuh",
    jurusitaId: "10",
    jurusitaTeks: "Jurusita: Jurusita Sepuluh",
  },
  // 302: borang dan tahapan 18 sama-sama menyebut 14 dan 16 - satu kedudukan.
  { perkara: 302, majelisId: "14,16", majelisTeks: "Hakim Ketua: Hakim Empat Belas</br>Hakim Anggota 1: Hakim Enam Belas", paniteraId: null, paniteraTeks: null, jurusitaId: null, jurusitaTeks: null },
];

const MEDIASI = [
  { id: 1, perkara: 102, mediatorId: "40", hasil: "T", penetapan: "2025-02-10", laporan: "2025-03-20", mulai: "2025-02-10", keputusan: "2025-03-02" },
  { id: 2, perkara: 104, mediatorId: "40,41", hasil: "Y2", penetapan: "2026-01-10", laporan: "2026-01-20", mulai: "2026-01-10", keputusan: "2026-01-20" },
  { id: 3, perkara: 105, mediatorId: "40", hasil: null, penetapan: "2026-03-10", laporan: null, mulai: "2026-03-10", keputusan: null },
  { id: 4, perkara: 201, mediatorId: "41", hasil: "S", penetapan: "2025-05-10", laporan: "2025-05-15", mulai: "2025-05-10", keputusan: "2025-05-15" },
  // mediator_id KOSONG - dikenali lewat perkara_mediator (id 40).
  { id: 5, perkara: 101, mediatorId: "", hasil: "Y1", penetapan: "2025-01-15", laporan: "2025-01-25", mulai: "2025-01-15", keputusan: "2025-01-25" },
  // mediator_id kosong dan perkara_mediator-nya id 0 - tidak dapat dikenali.
  { id: 6, perkara: 103, mediatorId: "", hasil: "D", penetapan: "2025-03-05", laporan: "2025-03-08", mulai: "2025-03-05", keputusan: "2025-03-08" },
];
// [perkara, mediator_id, aktif]
const PERKARA_MEDIATOR = [
  [101, 40, "Y"],
  [103, 0, "Y"],
];

// [perkara, ket_temu, status_pos]
const RELAAS = [
  [101, "Y", null],
  [101, "Y", null],
  [101, "S", 2],
  [102, "E", null],
  [102, "S", 1],
  [102, "S", null],
  [105, "T", null],
  [201, "Y", null],
  [201, "Y", null],
  // Relaas ikrar perkara 104 - juru sita 9 hanya juru sita ikrarnya, jadi
  // relaas ini BUKAN relaas perkara tugasannya.
  [104, "Y", null],
  // Relaas pemeriksaan perkara 305 - perkara tugasan juru sita 11.
  [305, "Y", null],
  [305, "S", 1],
];

// [perkara, tanggal, edoc_bas]
const SIDANG = [
  [101, "2025-01-20", "bas1.pdf"],
  [101, "2025-02-03", "bas2.pdf"],
  [101, "2025-02-20", ""],
  [102, "2025-03-01", "bas3.pdf"],
  [102, "2025-04-01", null],
  [102, "2026-10-01", null],
  // Sidang perkara 104 - panitera 5 hanya panitera ikrarnya.
  [104, "2026-02-01", "bas9.pdf"],
  // Sidang pemeriksaan perkara 305 - perkara tugasan panitera 8.
  [305, "2026-05-01", "bas5.pdf"],
  [305, "2026-05-20", ""],
];

let KOLOM = {};
function kolomBawaan() {
  return {
    perkara: ["perkara_id", "nomor_perkara", "tanggal_pendaftaran", "jenis_perkara_nama"],
    perkara_putusan: ["perkara_id", "tanggal_putusan", "tanggal_bht", "putusan_verstek", "status_putusan_id"],
    status_putusan: ["id", "nama"],
    perkara_efiling_id: ["perkara_id"],
    perkara_banding: ["perkara_id"],
    perkara_mediasi: [
      "mediasi_id",
      "perkara_id",
      "mediator_id",
      "mediator_text",
      "status_mediator",
      "hasil_mediasi",
      "penetapan_penunjukan_mediator",
      "tgl_laporan_mediator",
      "dimulai_mediasi",
      "keputusan_mediasi",
    ],
    perkara_mediator: ["perkara_id", "mediator_id", "nama_mediator", "status_mediator", "aktif", "tanggal_penetapan"],
    mediator: ["id", "hakim_id", "status_mediator", "nama", "nama_gelar"],
    perkara_pelaksanaan_relaas: ["perkara_id", "ket_temu", "status_pos"],
    perkara_jadwal_sidang: ["perkara_id", "tanggal_sidang", "edoc_bas"],
    perkara_hakim_pn: ["perkara_id", "hakim_id", "hakim_nama"],
    perkara_panitera_pn: ["perkara_id", "panitera_id"],
    perkara_jurusita: ["perkara_id", "jurusita_id"],
    perkara_ikrar_talak: [
      "perkara_id",
      "majelis_hakim_id",
      "majelis_hakim_text",
      "panitera_pengganti_id",
      "panitera_pengganti_text",
      "jurusita_id",
      "jurusita_text",
    ],
    hakim_pn: ["id"],
    panitera_pn: ["id"],
    jurusita: ["id"],
    jenis_perkara: ["id", "nama"],
  };
}

function hariAntara(a, b) {
  if (!a || !b) return null;
  return Math.round((new Date(`${b}T00:00:00Z`) - new Date(`${a}T00:00:00Z`)) / 86400000);
}

/** Satu baris perkara persis seperti kolomPerkara() memintanya. */
/** perkara_id pada IN (...) sebuah kueri - diambil dari parameternya. */
function idDiminta(teks, params) {
  const cocok = teks.match(/perkara_id IN \(([?, ]+)\)/);
  if (!cocok) return [];
  const jumlah = (cocok[1].match(/\?/g) || []).length;
  // Daftar IN selalu parameter TERAKHIR pada kueri rincian.
  return params.slice(params.length - jumlah).map(Number);
}

/** Mediasi milik sekumpulan id - FIND_IN_SET, lalu cadangan perkara_mediator. */
function mediasiMilik(ids, pakaiCadangan) {
  return MEDIASI.filter((m) => {
    const daftar = String(m.mediatorId || "").split(",").map((x) => Number(x.trim())).filter(Boolean);
    if (daftar.some((x) => ids.includes(x))) return true;
    if (!pakaiCadangan || m.mediatorId) return false;
    return PERKARA_MEDIATOR.some(([pid, mid, aktif]) => pid === m.perkara && aktif === "Y" && ids.includes(mid));
  });
}

let gagalkan = null;
const kueri = [];

function jawab(sql, params) {
  const teks = String(sql).replace(/\s+/g, " ");
  if (gagalkan && gagalkan.test(teks)) throw new Error("kueri tiruan sengaja digagalkan");

  if (/information_schema/i.test(teks)) {
    const hasil = [];
    for (const [tabel, daftar] of Object.entries(KOLOM)) for (const kolom of daftar) hasil.push({ tabel, kolom });
    return hasil;
  }

  // ---- identitas ----
  if (/FROM hakim_pn h WHERE h\.id = \?/.test(teks)) {
    const h = HAKIM_PN[params[0]];
    return h ? [{ id: params[0], ...h }] : [];
  }
  if (/FROM perkara_hakim_pn hk WHERE hk\.hakim_id = \? ORDER BY hk\.id DESC LIMIT 1/.test(teks)) {
    const baris = HAKIM_PERKARA.filter((x) => x.orang === params[0]);
    return baris.length ? [{ nama: baris[baris.length - 1].nama, kode: "" }] : [];
  }
  if (/FROM panitera_pn pn WHERE pn\.id = \?/.test(teks)) {
    const h = PANITERA_PN[params[0]];
    return h ? [{ id: params[0], ...h }] : [];
  }
  if (/FROM perkara_panitera_pn pp WHERE pp\.panitera_id = \?/.test(teks)) return [];
  if (/FROM jurusita js WHERE js\.id = \?/.test(teks)) {
    const h = JURUSITA[params[0]];
    return h ? [{ id: params[0], ...h }] : [];
  }
  if (/FROM perkara_jurusita pj WHERE pj\.jurusita_id = \?/.test(teks)) return [];
  if (/FROM mediator md WHERE md\.id = \?/.test(teks)) {
    const m = MEDIATOR[params[0]];
    return m
      ? [{ id: params[0], kode: "", nama: m.nama, namaGelar: m.namaGelar, aktif: m.aktif, statusMediator: m.status, hakimId: m.hakimId, bersertifikat: m.bersertifikat }]
      : [];
  }
  if (/FROM perkara_mediator pm WHERE pm\.mediator_id = \?/.test(teks)) return [];
  if (/FROM mediator md WHERE md\.hakim_id = \?/.test(teks)) {
    return Object.entries(MEDIATOR)
      .filter(([, m]) => m.hakimId === params[0])
      .map(([id, m]) => ({ id: Number(id), statusMediator: m.status }));
  }

  // ---- seluruh baris penunjukan perkara-perkara seseorang (bentuk kueri kini) ----
  const penunjukan = (daftar) => {
    const perkaraOrang = new Set(daftar.filter((x) => x.orang === params[0]).map((x) => x.perkara));
    return daftar
      .filter((x) => perkaraOrang.has(x.perkara))
      .map((x) => ({
        perkaraId: x.perkara,
        tahapan: x.tahapan,
        urutan: x.urutan,
        orang: x.orang,
        jabatan: x.jabatan,
        aktif: x.aktif,
        tidakAktif: x.tidakAktif,
        // Bentuk kolom sebelum aturan hari putusan - supaya kode lama tetap
        // dapat dijalankan atas tiruan ini (bukti uji baru merah di sana).
        bertanggal: x.tidakAktif ? 1 : 0,
        penetapan: x.penetapan,
        id: x.id,
      }));
  };
  if (/FROM perkara_hakim_pn h WHERE h\.perkara_id IN \(SELECT x\.perkara_id FROM perkara_hakim_pn x WHERE x\.hakim_id = \?\)/.test(teks)) {
    return penunjukan(HAKIM_PERKARA);
  }
  if (/FROM perkara_panitera_pn h WHERE h\.perkara_id IN \(SELECT x\.perkara_id FROM perkara_panitera_pn x WHERE x\.panitera_id = \?\)/.test(teks)) {
    return penunjukan(PANITERA_PERKARA);
  }
  if (/FROM perkara_jurusita h WHERE h\.perkara_id IN \(SELECT x\.perkara_id FROM perkara_jurusita x WHERE x\.jurusita_id = \?\)/.test(teks)) {
    return penunjukan(JURUSITA_PERKARA);
  }

  // ---- tanggal putusan perkara-perkara seseorang (subkueri penunjukan yang sama) ----
  const putusanPenunjukan = (daftar) =>
    [...new Set(daftar.filter((x) => x.orang === params[0]).map((x) => x.perkara))]
      .filter((p) => PUTUSAN[p])
      .map((p) => ({ perkaraId: p, putus: PUTUSAN[p].putus }));
  if (/FROM perkara_putusan pu WHERE pu\.perkara_id IN \(SELECT x\.perkara_id FROM perkara_hakim_pn x WHERE x\.hakim_id = \?\)/.test(teks)) {
    return putusanPenunjukan(HAKIM_PERKARA);
  }
  if (/FROM perkara_putusan pu WHERE pu\.perkara_id IN \(SELECT x\.perkara_id FROM perkara_panitera_pn x WHERE x\.panitera_id = \?\)/.test(teks)) {
    return putusanPenunjukan(PANITERA_PERKARA);
  }
  if (/FROM perkara_putusan pu WHERE pu\.perkara_id IN \(SELECT x\.perkara_id FROM perkara_jurusita x WHERE x\.jurusita_id = \?\)/.test(teks)) {
    return putusanPenunjukan(JURUSITA_PERKARA);
  }

  // ---- borang ikrar yang memuat id seseorang (FIND_IN_SET atas daftar ber-koma) ----
  const borangMemuat = (kunci) =>
    BORANG_IKRAR.filter((b) =>
      String(b[kunci] || "")
        .split(",")
        .map((x) => x.trim())
        .includes(String(params[0]))
    ).map((b) => ({ perkaraId: b.perkara }));
  if (/FROM perkara_ikrar_talak t WHERE FIND_IN_SET\(\?, REPLACE\(t\.majelis_hakim_id, ' ', ''\)\) > 0/.test(teks)) {
    return borangMemuat("majelisId");
  }
  if (/FROM perkara_ikrar_talak t WHERE FIND_IN_SET\(\?, REPLACE\(t\.panitera_pengganti_id, ' ', ''\)\) > 0/.test(teks)) {
    return borangMemuat("paniteraId");
  }
  if (/FROM perkara_ikrar_talak t WHERE FIND_IN_SET\(\?, REPLACE\(t\.jurusita_id, ' ', ''\)\) > 0/.test(teks)) {
    return borangMemuat("jurusitaId");
  }

  // ---- ikrarDariBorang: penunjukan tahapan 18 satu tabel, dan borangnya ----
  //
  // Kueri tahapan 18 dijawab dengan SELURUH baris tahapan 18 perkara itu,
  // aktif maupun tidak - penyaringan aktifnya milik layanan (barisIkrar).
  const dimintaPerkara = new Set(idDiminta(teks, params));
  const barisIkrarTabel = (daftar) =>
    daftar
      .filter((x) => dimintaPerkara.has(x.perkara) && x.tahapan === 18)
      .map((x) => ({ perkaraId: x.perkara, tahapan: x.tahapan, aktif: x.aktif, orang: x.orang }));
  if (/FROM perkara_hakim_pn h WHERE h\.tahapan_id = 18 AND h\.perkara_id IN \(\?/.test(teks)) return barisIkrarTabel(HAKIM_PERKARA);
  if (/FROM perkara_panitera_pn h WHERE h\.tahapan_id = 18 AND h\.perkara_id IN \(\?/.test(teks)) {
    return barisIkrarTabel(PANITERA_PERKARA);
  }
  if (/FROM perkara_jurusita h WHERE h\.tahapan_id = 18 AND h\.perkara_id IN \(\?/.test(teks)) return barisIkrarTabel(JURUSITA_PERKARA);
  if (/FROM perkara_ikrar_talak t WHERE t\.perkara_id IN \(\?/.test(teks)) {
    return BORANG_IKRAR.filter((b) => dimintaPerkara.has(b.perkara)).map((b) => ({
      perkaraId: b.perkara,
      majelisId: b.majelisId,
      majelisTeks: b.majelisTeks,
      paniteraId: b.paniteraId,
      paniteraTeks: b.paniteraTeks,
      jurusitaId: b.jurusitaId,
      jurusitaTeks: b.jurusitaTeks,
    }));
  }

  // ---- bentuk kueri LAMA (sebelum perbaikan majelis ikrar) ----
  //
  // Dipertahankan dengan makna SQL-nya yang sebenarnya (aktif = 'Y' saja),
  // supaya uji ini dapat dijalankan atas kode lama dan membuktikan bahwa uji
  // majelis ikrar MERAH di sana karena hitungannya, bukan karena tiruannya.
  const digantiLama = (daftar) => {
    const perPerkara = new Map();
    for (const b of daftar.filter((x) => x.orang === params[0])) {
      perPerkara.set(b.perkara, (perPerkara.get(b.perkara) || false) || b.aktif === "Y");
    }
    return [{ n: [...perPerkara.values()].filter((x) => !x).length }];
  };
  if (/HAVING MAX\(hk\.aktif = 'Y'\) = 0/.test(teks)) return digantiLama(HAKIM_PERKARA);
  if (/HAVING MAX\(pn\.aktif = 'Y'\) = 0/.test(teks)) return digantiLama(PANITERA_PERKARA);
  if (/HAVING MAX\(js\.aktif = 'Y'\) = 0/.test(teks)) return digantiLama(JURUSITA_PERKARA);
  if (/FROM perkara_hakim_pn hk WHERE hk\.hakim_id = \? AND hk\.aktif = 'Y' GROUP BY hk\.perkara_id LIMIT/.test(teks)) {
    const peta = new Map();
    for (const b of HAKIM_PERKARA) {
      if (b.orang !== params[0] || b.aktif !== "Y") continue;
      const tingkat = { 1: 1, 3: 2, 2: 3 }[b.jabatan] || 4;
      peta.set(b.perkara, Math.min(peta.get(b.perkara) || 9, tingkat));
    }
    return [...peta.entries()].map(([perkaraId, kedudukan]) => ({ perkaraId, kedudukan }));
  }
  if (/FROM perkara_panitera_pn pn WHERE pn\.panitera_id = \? AND pn\.aktif = 'Y' GROUP BY pn\.perkara_id LIMIT/.test(teks)) {
    return [...new Set(PANITERA_PERKARA.filter((x) => x.orang === params[0] && x.aktif === "Y").map((x) => x.perkara))].map(
      (perkaraId) => ({ perkaraId })
    );
  }
  if (/FROM perkara_jurusita js WHERE js\.jurusita_id = \? AND js\.aktif = 'Y' GROUP BY js\.perkara_id LIMIT/.test(teks)) {
    return [...new Set(JURUSITA_PERKARA.filter((x) => x.orang === params[0] && x.aktif === "Y").map((x) => x.perkara))].map(
      (perkaraId) => ({ perkaraId })
    );
  }

  // ---- rincian perkara atas daftar id ----
  const diminta = idDiminta(teks, params).filter((x) => PERKARA[x]);
  if (/FROM perkara p FORCE INDEX \(tanggal_pendaftaran\)/.test(teks)) {
    return diminta.map((x) => ({ perkaraId: x, tanggalDaftar: PERKARA[x].daftar }));
  }
  if (/FROM perkara p FORCE INDEX \(nomor_perkara\)/.test(teks)) {
    return diminta.map((x) => ({ perkaraId: x, nomorPerkara: PERKARA[x].nomor }));
  }
  if (/FROM perkara p FORCE INDEX \(jenis_perkara_id\)/.test(teks)) {
    return diminta.map((x) => ({ perkaraId: x, jenisPerkaraId: PERKARA[x].jenisId }));
  }
  if (/FROM jenis_perkara jp/.test(teks)) {
    return Object.entries(JENIS_PERKARA).map(([id, nama]) => ({ id: Number(id), nama }));
  }
  if (/FROM perkara p WHERE p\.perkara_id IN/.test(teks)) {
    // Jalur cadangan: baris tabel perkara, dengan salinan nama jenisnya.
    return diminta.map((x) => ({
      perkaraId: x,
      nomorPerkara: PERKARA[x].nomor,
      tanggalDaftar: PERKARA[x].daftar,
      jenisPerkaraId: PERKARA[x].jenisId,
      jenisPerkara: PERKARA[x].jenis,
    }));
  }
  if (/FROM perkara_putusan pu/.test(teks)) {
    return diminta
      .filter((x) => PUTUSAN[x])
      .map((x) => ({
        perkaraId: x,
        tanggalPutusan: PUTUSAN[x].putus,
        tanggalBht: PUTUSAN[x].bht,
        verstek: PUTUSAN[x].verstek,
        // Nama status HANYA lewat JOIN status_putusan - tanpa sambungan itu, null.
        statusPutusan: /LEFT JOIN status_putusan sp/.test(teks) ? STATUS[PUTUSAN[x].statusId] : null,
      }));
  }
  if (/FROM perkara_efiling_id e WHERE e\.perkara_id IN/.test(teks)) {
    return diminta.filter((x) => EFILING.has(x)).map((perkaraId) => ({ perkaraId }));
  }
  if (/FROM perkara_banding b WHERE b\.perkara_id IN/.test(teks)) {
    return diminta.filter((x) => BANDING.has(x)).map((perkaraId) => ({ perkaraId }));
  }
  if (/FROM perkara_mediasi m WHERE m\.dimulai_mediasi IS NOT NULL AND m\.perkara_id IN/.test(teks)) {
    return MEDIASI.filter((m) => diminta.includes(m.perkara) && m.mulai).map((m) => ({
      perkaraId: m.perkara,
      mulai: m.mulai,
      selesai: m.keputusan,
    }));
  }

  // ---- mediator ----
  const jumlahId = (teks.match(/FIND_IN_SET\(\?/g) || []).length;
  const idMediator = params.slice(0, jumlahId);
  const pakaiCadangan = /FROM perkara_mediator pm WHERE pm\.perkara_id = m\.perkara_id/.test(teks);
  if (/SELECT DISTINCT m\.perkara_id AS perkaraId FROM perkara_mediasi m/.test(teks)) {
    return [...new Set(mediasiMilik(idMediator, pakaiCadangan).map((m) => m.perkara))].map((perkaraId) => ({ perkaraId }));
  }
  // Dicocokkan sampai kolom ketiganya: kueri mediasi Status Perkara juga
  // diawali "SELECT m.mediasi_id AS mediasiId".
  if (/SELECT m\.mediasi_id AS mediasiId, m\.perkara_id AS perkaraId, m\.hasil_mediasi AS hasil/.test(teks)) {
    return mediasiMilik(idMediator, pakaiCadangan)
      .sort((a, b) => b.penetapan.localeCompare(a.penetapan) || b.id - a.id)
      .map((m) => ({
        mediasiId: m.id,
        perkaraId: m.perkara,
        hasil: m.hasil,
        penetapan: m.penetapan,
        laporan: m.laporan,
        lamaHari: hariAntara(m.penetapan, m.laporan),
      }));
  }

  // ---- relaas dan sidang ----
  //
  // Bentuk kini: daftar perkara_id tugasan (pemeriksaan) di IN (...). Bentuk
  // lama: subkueri penunjukan aktif, termasuk yang hanya pada ikrar talak.
  if (/FROM perkara_pelaksanaan_relaas r/.test(teks)) {
    const tugas = /r\.perkara_id IN \(\?/.test(teks)
      ? new Set(idDiminta(teks, params))
      : new Set(JURUSITA_PERKARA.filter((x) => x.orang === params[0] && x.aktif === "Y").map((x) => x.perkara));
    const kelompok = new Map();
    for (const [pid, sandi, pos] of RELAAS) {
      if (!tugas.has(pid)) continue;
      const kunci = `${pid}|${sandi}`;
      const isi = kelompok.get(kunci) || { perkaraId: pid, sandi, n: 0, sampai: 0, retur: 0 };
      isi.n += 1;
      if (pos === 1) isi.sampai += 1;
      if (pos === 2) isi.retur += 1;
      kelompok.set(kunci, isi);
    }
    return [...kelompok.values()];
  }
  if (/FROM perkara_jadwal_sidang j/.test(teks)) {
    const acuan = params[0];
    const tugas = /j\.perkara_id IN \(\?/.test(teks)
      ? new Set(idDiminta(teks, params))
      : new Set(PANITERA_PERKARA.filter((x) => x.orang === params[2] && x.aktif === "Y").map((x) => x.perkara));
    const sidang = SIDANG.filter((x) => tugas.has(x[0]));
    const lewat = sidang.filter((x) => x[1] < acuan);
    return [
      {
        jumlah: sidang.length,
        perkara: new Set(sidang.map((x) => x[0])).size,
        lewat: lewat.length,
        basAda: lewat.filter((x) => x[2] && !["", "0", "-"].includes(x[2])).length,
      },
    ];
  }

  // ---- muatan Status Perkara ----
  if (/FROM perkara_hakim_pn hk WHERE hk\.perkara_id = \? AND hk\.aktif = 'Y'/.test(teks)) {
    return jawaban.majelis || [];
  }
  if (/FROM perkara_panitera_pn pn WHERE pn\.perkara_id = \?/.test(teks)) return jawaban.panitera || [];
  if (/FROM perkara_jurusita js WHERE js\.perkara_id = \?/.test(teks)) return jawaban.jurusita || [];
  if (/FROM perkara_mediasi m WHERE m\.perkara_id = \? LIMIT 20/.test(teks)) return jawaban.mediasi || [];
  if (/FROM perkara_mediator m WHERE m\.perkara_id = \?/.test(teks)) return jawaban.mediator || [];

  return [];
}

let jawaban = {};

const dbPath = require.resolve(pathx.resolve(__dirname, "..", "db_config.js"));
require.cache[dbPath] = new Module(dbPath, null);
require.cache[dbPath].filename = dbPath;
require.cache[dbPath].loaded = true;
require.cache[dbPath].exports = {
  query(sql, params, callback) {
    kueri.push({ sql: String(sql), params: params || [] });
    try {
      callback(null, jawab(sql, params || []));
    } catch (galat) {
      callback(galat);
    }
  },
};

const layanan = require("../services/rekapPetugasService");
const skema = require("../services/sippSkemaService");
const jadwal = require("../services/sippJadwalSidangService");
const tahapan = require("../services/sippTahapanService");

function siapkan(ubahKolom) {
  KOLOM = kolomBawaan();
  if (ubahKolom) ubahKolom(KOLOM);
  skema.lupakan();
  layanan.kosongkanSinggahan();
  gagalkan = null;
  kueri.length = 0;
}

const rekap = (masukan, opsi = {}) => layanan.rekapPetugas(masukan, { hariIni: HARI_INI, ...opsi });
const sama = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const bag = (pembilang, penyebut, persen) => ({ pembilang, penyebut, persen });

async function jalan() {
  console.log("\n== Hitungan murni ==");
  {
    periksa("12 dari 40 = 30%", sama(layanan.bagian(12, 40), bag(12, 40, 30)));
    periksa("1 dari 3 dibulatkan satu desimal", layanan.bagian(1, 3).persen === 33.3);
    periksa("penyebut nol: persen null, bukan 0", layanan.bagian(0, 0).persen === null);
    periksa("penyebut nol tidak menjadi NaN", layanan.bagian(5, 0).persen === null && layanan.bagian(5, 0).pembilang === 5);
    periksa("median ganjil", layanan.tengah([32, 162, 12]) === 32);
    periksa("median genap = rata dua tengahnya", layanan.tengah([10, 20, 31, 40]) === 25.5);
    periksa("median daftar kosong null", layanan.tengah([]) === null);
    periksa("rata-rata daftar kosong null", layanan.rataRata([]) === null);
  }

  console.log("\n== Masukan yang tidak sah ditolak dengan alasannya ==");
  {
    siapkan();
    const kasus = [
      [{ peran: "ketua", id: "7" }, "peran_tidak_dikenal"],
      [{ peran: "", id: "7" }, "peran_tidak_dikenal"],
      [{ peran: "hakim", id: "" }, "id_tidak_sah"],
      [{ peran: "hakim", id: "12abc" }, "id_tidak_sah"],
      [{ peran: "hakim", id: "0" }, "id_tidak_sah"],
      [{ peran: "hakim", id: "-3" }, "id_tidak_sah"],
      [{ peran: "hakim", id: "1.5" }, "id_tidak_sah"],
      [{ peran: "hakim", id: "99999999999" }, "id_tidak_sah"],
      [{ peran: "hakim", id: "7", tahun: "20255" }, "tahun_tidak_sah"],
      [{ peran: "hakim", id: "7", keadaan: "selesai" }, "keadaan_tidak_dikenal"],
      [{ peran: "panitera", id: "5", kedudukan: "mediator" }, "kedudukan_tidak_dikenal"],
      [{ peran: "hakim", id: "7", lewati: "-1" }, "lewati_tidak_sah"],
      [{ peran: "hakim", id: "7", batas: "0" }, "batas_tidak_sah"],
    ];
    for (const [masukan, alasan] of kasus) {
      const hasil = await rekap(masukan);
      periksa(`${JSON.stringify(masukan)} -> ${alasan} (400)`, !hasil.ok && hasil.alasan === alasan && hasil.status === 400, hasil);
    }
    periksa("masukan yang ditolak tidak menyentuh SIPP", kueri.length === 0, kueri.length);
    const besar = layanan.periksaPilihan({ peran: "hakim", id: "7", batas: "5000" });
    periksa("batas di atas pagu dijepit ke 200, bukan ditolak", besar.ok && besar.pilihan.batas === 200);
  }

  console.log("\n== Hakim 7: hitungan, persentase, pembilang/penyebut ==");
  {
    siapkan();
    const r = await rekap({ peran: "hakim", id: "7" });
    periksa("berhasil", r.ok === true, r);
    periksa("nama dari hakim_pn atas id-nya", r.identitas.nama === "Hakim Tujuh, S.H." && r.identitas.sumber === "hakim_pn");
    // Perkara 104 hanya penunjukan tidak aktif - diganti, tidak dihitung.
    periksa("5 perkara majelis aktif (104 diganti tidak ikut)", r.ringkas.jumlah === 5, r.ringkas.jumlah);
    periksa("pernah diganti: 1 perkara", r.diganti === 1, r.diganti);
    periksa("masih proses 2 dari 5 · 40%", sama(r.ringkas.keadaan.proses, bag(2, 5, 40)), r.ringkas.keadaan.proses);
    periksa("putus 3 dari 5 · 60%", sama(r.ringkas.keadaan.putus, bag(3, 5, 60)));
    periksa("BHT 2 dari 5 · 40%", sama(r.ringkas.keadaan.bht, bag(2, 5, 40)));
    periksa("putus belum BHT 1 dari 5 · 20%", sama(r.ringkas.keadaan.putusBelumBht, bag(1, 5, 20)));
    const hasil = Object.fromEntries(r.ringkas.hasil.map((h) => [h.label, h]));
    periksa("hasil atas perkara putus: Dikabulkan 1 dari 3", sama(hasil.Dikabulkan, { label: "Dikabulkan", ...bag(1, 3, 33.3) }), r.ringkas.hasil);
    periksa("nama status dari JOIN status_putusan (kolom nama di putusan kosong)", Boolean(hasil["Tidak Dapat Diterima"]));
    periksa("tidak ada hasil tanpa nama", !hasil["Status putusan tidak tercatat"]);
    // 101: 41+1-10 = 32; 102: 181+1-20 = 162; 103: 14+1-3 = 12.
    periksa("lama rata-rata 68,7 hari (32, 162, 12)", r.ringkas.lama.rataHari === 68.7, r.ringkas.lama);
    periksa("median 32 hari", r.ringkas.lama.medianHari === 32);
    periksa("dalam lima bulan 2 dari 3 · 66,7%", sama(r.ringkas.lama.dalamBatas, bag(2, 3, 66.7)), r.ringkas.lama.dalamBatas);
    // 105: 210+1 - potongan 60 (mediasi berjalan, dijepit PERMA) = 151 > 150.
    periksa("proses lewat lima bulan 1 dari 2 (potongan mediasi dijepit 60 hari)", sama(r.ringkas.lama.prosesLewatBatas, bag(1, 2, 50)), r.ringkas.lama.prosesLewatBatas);
    periksa("verstek 1 dari 2 terbaca, 1 tidak tercatat", r.ringkas.verstek.pembilang === 1 && r.ringkas.verstek.penyebut === 2 && r.ringkas.verstek.tidakTercatat === 1, r.ringkas.verstek);
    periksa("e-Court 2 dari 5 · 40%", sama(r.ringkas.ecourt, bag(2, 5, 40)));
    periksa("banding 1 dari 3 putus", sama(r.ringkas.banding, bag(1, 3, 33.3)));

    const peran = Object.fromEntries(r.menurutPeran.map((x) => [x.kunci, x.jumlah]));
    periksa("per kedudukan: ketua 2, tunggal 1, anggota 2, mediator 4", sama(peran, { ketua: 2, tunggal: 1, anggota: 2, mediator: 4 }), peran);
    periksa("perkara 106 (anggota DAN ketua) dihitung sekali sebagai ketua", r.daftar.baris.find((b) => b.nomorPerkara.startsWith("106")).kedudukan.join() === "ketua");
    periksa("menurut tahun: 2026 lebih dulu, 2 dan 3 perkara", sama(r.menurutTahun.map((x) => [x.kunci, x.jumlah]), [[2026, 2], [2025, 3]]));
    // Nama jenis dari RUJUKAN jenis_perkara atas id-nya, bukan salinan lama
    // "Istbat Nikah" pada baris perkara 103.
    periksa(
      "menurut jenis: Cerai Gugat 4, Pengesahan Perkawinan/Istbat Nikah 1",
      sama(r.menurutJenis.map((x) => [x.kunci, x.jumlah]), [["Cerai Gugat", 4], ["Pengesahan Perkawinan/Istbat Nikah", 1]]),
      r.menurutJenis.map((x) => [x.kunci, x.jumlah])
    );
    periksa("rincian perkara dibaca lewat indeks", r.jalurBaca === "indeks", r.jalurBaca);
    const kueriPerkara = kueri.filter((k) => /FROM perkara p\b/.test(k.sql));
    periksa(
      "tabel perkara tidak dibaca barisnya - hanya lewat FORCE INDEX",
      kueriPerkara.length === 3 && kueriPerkara.every((k) => /FORCE INDEX/.test(k.sql)),
      kueriPerkara.map((k) => k.sql.replace(/\s+/g, " ").slice(0, 80))
    );

    // Mediasi hakim 7: mediator_id 40 dan 42 (hakim_id 7). Baris 1 (T), 2
    // (Y2, "40,41"), 3 (berjalan), 5 (Y1 lewat perkara_mediator). Baris 6
    // (perkara_mediator id 0) TIDAK ikut.
    const m = r.mediasi;
    periksa("mediasi: 4 baris", m && m.jumlah === 4, m);
    const g = Object.fromEntries(m.hasil.map((x) => [x.kunci, x]));
    periksa("berhasil 2 dari 4 · 50% (Y1 + Y2)", sama({ p: g.berhasil.pembilang, q: g.berhasil.penyebut, r: g.berhasil.persen }, { p: 2, q: 4, r: 50 }));
    periksa("berhasil sebagian 0 dari 4 · 0% (penyebut ada, jadi 0 sah)", g.sebagian.pembilang === 0 && g.sebagian.persen === 0);
    periksa("tidak berhasil 1 dari 4", g.tidak.pembilang === 1 && g.tidak.penyebut === 4);
    periksa("belum ada hasil (perkaranya belum putus) 1", g.berjalan.pembilang === 1);
    periksa("sandi tidak dikenali tidak disebut bila nol", !g.lain);
    periksa("lama mediasi rata 19,3 hari (38, 10, 10)", m.lama.rataHari === 19.3, m.lama);
    periksa("lewat 30 hari 1 dari 3", sama(m.lama.lewatBatas, bag(1, 3, 33.3)));
    periksa("mediasi berjalan lewat 30 hari sejak penetapan: 1", m.lama.berjalanLewatBatas === 1);
    periksa("id mediator tercakup [40, 42]", sama(r.identitas.idMediator, [40, 42]));

    // ---- daftar ----
    periksa("daftar memuat 6 perkara (5 majelis + 104 yang dimediasi)", r.daftar.jumlah === 6, r.daftar.jumlah);
    const mediator104 = r.daftar.baris.find((b) => b.nomorPerkara.startsWith("104"));
    periksa("perkara 104 berkedudukan mediator saja", mediator104 && mediator104.kedudukan.join() === "mediator");
    periksa("pilihan tahun menurun", sama(r.daftar.pilihanTahun, [2026, 2025]));
  }

  console.log("\n== ID bukan nama: dua hakim bernama sama ==");
  {
    siapkan();
    const tujuh = await rekap({ peran: "hakim", id: "7" });
    const delapan = await rekap({ peran: "hakim", id: "8" });
    periksa("namanya persis sama", tujuh.identitas.nama === delapan.identitas.nama);
    periksa("hakim 8 hanya perkaranya sendiri (201 ketua, 101 anggota)", delapan.ringkas.jumlah === 2, delapan.ringkas.jumlah);
    periksa("hakim 8 tidak mewarisi perkara hakim 7", !delapan.daftar.baris.some((b) => b.nomorPerkara.startsWith("103")));
    const kueriHakim = kueri.filter((k) => /perkara_hakim_pn/.test(k.sql));
    periksa("seluruh kueri penunjukan hakim disaring hakim_id, tidak lewat nama", kueriHakim.every((k) => /hakim_id = \?/.test(k.sql) && !/hakim_nama\s*(=|LIKE)/i.test(k.sql)));
    periksa(
      "id yang dikirim ke SIPP adalah 8 pada rekap kedua",
      kueri.some((k) => /perkara_hakim_pn[\s\S]*hakim_id = \?/.test(k.sql) && k.params[0] === 8)
    );
    periksa("seluruh kueri berupa SELECT", kueri.every((k) => /^\s*SELECT\b/i.test(k.sql)));
  }

  console.log("\n== Saringan dan halaman daftar ==");
  {
    siapkan();
    const mediator = await rekap({ peran: "hakim", id: "7", kedudukan: "mediator" });
    periksa("kedudukan mediator: 4 baris", mediator.daftar.jumlah === 4, mediator.daftar.jumlah);
    const proses = await rekap({ peran: "hakim", id: "7", keadaan: "proses" });
    periksa("keadaan proses: 105 dan 106", sama(proses.daftar.baris.map((b) => b.nomorPerkara.slice(0, 3)), ["106", "105"]));
    const tahun = await rekap({ peran: "hakim", id: "7", tahun: "2025" });
    periksa("tahun 2025: 3 perkara", tahun.daftar.jumlah === 3);
    const gabung = await rekap({ peran: "hakim", id: "7", kedudukan: "ketua", keadaan: "bht" });
    periksa("ketua + BHT: hanya 101", sama(gabung.daftar.baris.map((b) => b.nomorPerkara.slice(0, 3)), ["101"]));
    const belumBht = await rekap({ peran: "hakim", id: "7", keadaan: "belum_bht" });
    periksa("belum BHT: hanya 102", sama(belumBht.daftar.baris.map((b) => b.nomorPerkara.slice(0, 3)), ["102"]));
    const halaman = await rekap({ peran: "hakim", id: "7", batas: "2", lewati: "2" });
    periksa("halaman kedua dua baris, masih ada lagi", halaman.daftar.baris.length === 2 && halaman.daftar.adaLagi === true && halaman.daftar.jumlah === 6);
    periksa("ringkasan TIDAK ikut tersaring", tahun.ringkas.jumlah === 5 && gabung.ringkas.jumlah === 5);
  }

  console.log("\n== Singgahan ==");
  {
    siapkan();
    const sekarang = Date.UTC(2026, 8, 27, 2, 0, 0);
    await rekap({ peran: "hakim", id: "7" }, { sekarang });
    const sesudahPertama = kueri.length;
    const kedua = await rekap({ peran: "hakim", id: "7", tahun: "2025" }, { sekarang: sekarang + 1000 });
    periksa("saringan baru tidak menyentuh SIPP lagi", kueri.length === sesudahPertama, kueri.length - sesudahPertama);
    periksa("jawaban kedua menyebut asalnya singgahan", kedua.dariSinggahan === true);
    await rekap({ peran: "hakim", id: "7" }, { sekarang: sekarang + layanan.SINGGAHAN_MS + 1 });
    periksa("lewat dua menit dihitung ulang", kueri.length > sesudahPertama);

    siapkan();
    gagalkan = /FROM perkara_pelaksanaan_relaas r/;
    const pertama = await rekap({ peran: "jurusita", id: "9" }, { sekarang });
    periksa("relaas yang gagal DISEBUT, tidak dijadikan nol", pertama.relaas === null && pertama.takTerbaca.some((x) => x.bagian === "relaas"));
    gagalkan = null;
    const ulang = await rekap({ peran: "jurusita", id: "9" }, { sekarang: sekarang + 1000 });
    periksa("yang sebagian gagal tidak disinggahkan - percobaan kedua membaca lagi", ulang.relaas && ulang.relaas.jumlah === 7 && !ulang.dariSinggahan);
  }

  console.log("\n== Kegagalan bacaan perkara tidak menjadi angka nol ==");
  {
    siapkan();
    // Bacaan penunjukan hakim - bentuk kueri kini maupun lama.
    gagalkan = /FROM perkara_hakim_pn h WHERE h\.perkara_id IN|FROM perkara_hakim_pn hk WHERE hk\.hakim_id = \? AND hk\.aktif = 'Y' GROUP BY/;
    const r = await rekap({ peran: "hakim", id: "7" });
    periksa("penunjukan gagal dibaca: perkaraTerbaca false", r.ok && r.perkaraTerbaca === false, r.perkaraTerbaca);
    periksa("takTerbaca menyebut bagian perkara", r.takTerbaca.some((x) => x.bagian === "perkara"));

    siapkan();
    gagalkan = /FROM perkara_putusan pu/;
    const rinci = await rekap({ peran: "hakim", id: "7" });
    periksa("rincian gagal dibaca: perkaraTerbaca false, bukan lima perkara tanpa putusan", rinci.ok && rinci.perkaraTerbaca === false);
  }

  console.log("\n== FORCE INDEX ditolak: jatuh ke baris biasa, jawabannya sama ==");
  {
    siapkan();
    gagalkan = /FORCE INDEX/;
    const r = await rekap({ peran: "hakim", id: "7" });
    periksa("jalur baca baris", r.jalurBaca === "baris", r.jalurBaca);
    periksa("tidak disebut gagal", r.perkaraTerbaca === true && r.takTerbaca.length === 0, r.takTerbaca);
    periksa("hitungannya sama: 5 perkara, 2 dari 3 dalam lima bulan", r.ringkas.jumlah === 5 && sama(r.ringkas.lama.dalamBatas, bag(2, 3, 66.7)));
    periksa(
      "nama jenis tetap dari rujukan jenis_perkara",
      sama(r.menurutJenis.map((x) => x.kunci), ["Cerai Gugat", "Pengesahan Perkawinan/Istbat Nikah"])
    );
  }

  console.log("\n== Mediator: FIND_IN_SET, cadangan, penyatuan lewat hakim_id ==");
  {
    siapkan();
    const r42 = await rekap({ peran: "mediator", id: "42" });
    periksa("mediator 42 disatukan dengan 40 lewat hakim_id 7", sama(r42.identitas.idMediator, [40, 42]) && r42.identitas.hakimId === 7);
    periksa("sandi status dikirim apa adanya (H)", r42.identitas.statusMediator === "H");
    periksa("4 mediasi, sama dengan halaman hakimnya", r42.mediasi.jumlah === 4);
    periksa("perkara mediasi 4", r42.ringkas.jumlah === 4);

    const r41 = await rekap({ peran: "mediator", id: "41" });
    periksa("mediator 41 (N): 2 mediasi - satu lewat daftar ber-koma \"40,41\"", r41.mediasi.jumlah === 2, r41.mediasi.jumlah);
    const g = Object.fromEntries(r41.mediasi.hasil.map((x) => [x.kunci, x]));
    periksa("berhasil 1 dari 2, sebagian 1 dari 2", g.berhasil.pembilang === 1 && g.sebagian.pembilang === 1 && g.sebagian.penyebut === 2);
    periksa("mediator tanpa hakim_id: tidak ada hakim tertaut", r41.identitas.hakimId === null && sama(r41.identitas.idMediator, [41]));
    periksa("status N dikirim apa adanya", r41.identitas.statusMediator === "N");

    const kosong = await rekap({ peran: "mediator", id: "999" });
    periksa("mediator tak dikenal: 404", !kosong.ok && kosong.status === 404 && kosong.alasan === "petugas_tidak_ditemukan");
  }

  console.log("\n== Juru sita: relaas pada perkara tugasannya ==");
  {
    siapkan();
    const r = await rekap({ peran: "jurusita", id: "9" });
    periksa("3 perkara tugasan", r.ringkas.jumlah === 3);
    periksa("7 relaas pada 3 perkara (relaas perkara 201 tidak ikut)", r.relaas.jumlah === 7 && r.relaas.perkara === 3, r.relaas);
    const cara = Object.fromEntries(r.relaas.cara.map((x) => [x.sandi, x]));
    periksa("surat tercatat 3 dari 7 · 42,9%", sama({ p: cara.S.pembilang, q: cara.S.penyebut, r: cara.S.persen }, { p: 3, q: 7, r: 42.9 }));
    periksa("sandi diterjemahkan lewat caraRelaas yang sama dengan jadwal", cara.E.cara === "Panggilan elektronik");
    periksa("retur 1 dari 3 surat tercatat", sama(r.relaas.pos.retur, bag(1, 3, 33.3)));
    periksa("belum dilacak 1 dari 3", sama(r.relaas.pos.belumDilacak, bag(1, 3, 33.3)));
    periksa("jabatan juru sita pengganti", r.identitas.jabatan === "Juru sita pengganti");
    periksa("nama cadangan dari nama tanpa gelar", r.identitas.nama === "Jurusita Sembilan");
    // 104: juru sita 9 hanya juru sita IKRAR-nya - bukan perkara tugasan
    // pemeriksaan, jadi relaasnya tidak ikut, dan kedudukannya disebut sendiri.
    const kedudukan = Object.fromEntries(r.menurutPeran.map((x) => [x.kunci, x.jumlah]));
    periksa("juru sita ikrar talak disebut sendiri: 104", sama(kedudukan, { jurusita: 3, jurusitaIkrar: 1 }), kedudukan);
    periksa("relaas perkara ikrar-saja tidak dihitung", r.relaas.jumlah === 7, r.relaas.jumlah);
  }

  console.log("\n== Panitera: sidang pada perkara tugasannya ==");
  {
    siapkan();
    const r = await rekap({ peran: "panitera", id: "5" });
    periksa("2 perkara pemeriksaan, 1 diganti sungguhan (103)", r.ringkas.jumlah === 2 && r.diganti === 1, [r.ringkas.jumlah, r.diganti]);
    periksa("6 sidang, 5 sudah lewat (sidang perkara ikrar-saja 104 tidak ikut)", r.sidang.jumlah === 6 && r.sidang.lewat === 5 && r.sidang.akanDatang === 1, r.sidang);
    periksa("BAS 3 dari 5 sidang yang lewat", sama(r.sidang.bas, bag(3, 5, 60)));
    periksa("halaman panitera tidak memuat mediasi maupun relaas", r.mediasi === null && r.relaas === null);
    const kedudukan = Object.fromEntries(r.menurutPeran.map((x) => [x.kunci, x.jumlah]));
    periksa("panitera ikrar talak disebut sendiri: 104", sama(kedudukan, { panitera: 2, paniteraIkrar: 1 }), kedudukan);
  }

  console.log("\n== Majelis ikrar talak TIDAK menggantikan majelis pemeriksa ==");
  {
    // SIPP menonaktifkan majelis pemeriksaan (tahapan 10) begitu majelis ikrar
    // talak (tahapan 18) ditetapkan - tanpa tanggal tidak aktif. Terukur di
    // sipp_donggala: 817 perkara. Pemeriksa perkara itu TETAP majelis tahapan
    // 10; majelis ikrar disebut kedudukan tersendiri, di luar ringkasan.
    siapkan();
    const empatBelas = await rekap({ peran: "hakim", id: "14" });
    const kd14 = Object.fromEntries(empatBelas.menurutPeran.map((x) => [x.kunci, x.jumlah]));
    periksa("ketua pemeriksa 301 (dinonaktifkan ikrar) tetap ketua perkara itu", empatBelas.daftar.baris.some((b) => b.nomorPerkara.startsWith("301") && b.kedudukan.includes("ketua")));
    periksa("hakim 14: 4 perkara pemeriksaan, seluruhnya ketua", empatBelas.ringkas.jumlah === 4 && kd14.ketua === 4, kd14);
    periksa("hakim 14: 302 juga ketua ikrar - kedudukan ikrar 1", kd14.ikrar === 1, kd14);
    periksa("hakim 14: tidak satu pun 'pernah diganti' (301 bukan penggantian)", empatBelas.diganti === 0, empatBelas.diganti);
    periksa("hakim 14 anggota yang DIGANTI di 303 lalu menjadi ketua: dihitung ketua", empatBelas.daftar.baris.find((b) => b.nomorPerkara.startsWith("303")).kedudukan.join() === "ketua");

    const limaBelas = await rekap({ peran: "hakim", id: "15" });
    const kd15 = Object.fromEntries(limaBelas.menurutPeran.map((x) => [x.kunci, x.jumlah]));
    periksa("ketua ikrar 301 yang tak pernah memeriksa: TIDAK dikreditkan sebagai ketua majelis", !kd15.ketua && limaBelas.ringkas.jumlah === 0, kd15);
    periksa("ketua ikrar 301: kedudukan 'Majelis ikrar talak'", kd15.ikrar === 1 && limaBelas.menurutPeran[0].label === "Majelis ikrar talak", limaBelas.menurutPeran);
    periksa("hasil putusan 301 tidak masuk ringkasan ketua ikrarnya", limaBelas.ringkas.hasil.length === 0);
    // 302 dan 303: pergantian SUNGGUHAN (bertanggal); 304: majelis ikrar yang
    // seluruhnya T. Ketiganya tetap tertangkap sebagai "pernah diganti".
    periksa("pergantian sungguhan tetap tertangkap: 302, 303, 304 = 3 diganti", limaBelas.diganti === 3, limaBelas.diganti);

    const enamBelas = await rekap({ peran: "hakim", id: "16" });
    const kd16 = Object.fromEntries(enamBelas.menurutPeran.map((x) => [x.kunci, x.jumlah]));
    periksa("anggota pemeriksa DAN ikrar: anggota 4, ikrar 2", kd16.anggota === 4 && kd16.ikrar === 2 && enamBelas.ringkas.jumlah === 4, kd16);
    periksa("302: pengganti yang kemudian dinonaktifkan ikrar tetap pemeriksa", enamBelas.daftar.baris.find((b) => b.nomorPerkara.startsWith("302")).kedudukan.join() === "anggota,ikrar");

    const tujuh = await rekap({ peran: "hakim", id: "7" });
    periksa("hakim 7: pergantian bertanggal di 104 tetap 1 diganti", tujuh.diganti === 1 && tujuh.ringkas.jumlah === 5);
    const disaring = await rekap({ peran: "hakim", id: "16", kedudukan: "ikrar" });
    periksa("kedudukan ikrar dapat disaring", disaring.ok && disaring.daftar.jumlah === 2, disaring.alasan || disaring.daftar.jumlah);
  }

  console.log("\n== Pemeriksa perkara yang sudah putus: yang menjabat pada hari putusan ==");
  {
    // Data lama sipp_donggala: majelis ikrar dicatat sebagai PENGGANTI di
    // tahapan 10 sesudah putusan (perkara_id 1895), dan sebagian pengganti
    // itu masih aktif (2373, 4613). Yang aktif sekarang, maupun yang terakhir
    // ditetapkan, bukan pemeriksa.
    siapkan();
    const kd = (r) => Object.fromEntries(r.menurutPeran.map((x) => [x.kunci, x.jumlah]));
    const kedudukanDi = (r, nomor) => {
      const b = r.daftar.baris.find((x) => x.nomorPerkara.startsWith(nomor));
      return b ? b.kedudukan.join() : "-";
    };

    const h21 = await rekap({ peran: "hakim", id: "21" });
    periksa("305: ketua yang menjabat pada hari putusan tetap ketua, walau 'diganti' sesudahnya", kedudukanDi(h21, "305") === "ketua", kd(h21));
    periksa("306: hakim tunggal pada hari putusan tetap pemeriksa, walau penggantinya masih aktif", kedudukanDi(h21, "306") === "tunggal", kd(h21));
    periksa("hakim 21: 2 perkara pemeriksaan, tidak satu pun 'pernah diganti'", h21.ringkas.jumlah === 2 && h21.diganti === 0, [h21.ringkas.jumlah, h21.diganti]);

    const h23 = await rekap({ peran: "hakim", id: "23" });
    periksa("305: majelis ikrar yang dicatat sebagai pengganti sesudah putusan - ikrar saja, bukan ketua", kedudukanDi(h23, "305") === "ikrar", kd(h23));
    periksa("308: tak satu pun menjabat pada hari putusan - baris terakhir yang tak bertanggal: ketua", kedudukanDi(h23, "308") === "ketua", kd(h23));
    periksa("hakim 23: ringkasan hanya 308", h23.ringkas.jumlah === 1 && sama(kd(h23), { ketua: 1, ikrar: 1 }), kd(h23));

    const h24 = await rekap({ peran: "hakim", id: "24" });
    periksa(
      "hakim 24: ikrar 305, diganti di 308 (baris bertanggal kalah dari yang tak bertanggal)",
      sama(kd(h24), { ikrar: 1 }) && h24.ringkas.jumlah === 0 && h24.diganti === 1,
      [kd(h24), h24.diganti]
    );

    const h25 = await rekap({ peran: "hakim", id: "25" });
    periksa("306: pengganti yang ditetapkan sesudah putusan - pernah diganti, bukan pemeriksa", h25.diganti === 1 && kedudukanDi(h25, "306") === "-", [kd(h25), h25.diganti]);
    periksa("hakim 25: 307 anggota saja", sama(kd(h25), { anggota: 1 }) && h25.ringkas.jumlah === 1, kd(h25));

    const h22 = await rekap({ peran: "hakim", id: "22" });
    periksa("307: baris AKTIF bertanggal tidak aktif sebelum putusan tetap pemeriksa (ketua)", kedudukanDi(h22, "307") === "ketua", kd(h22));
    periksa("hakim 22: anggota 305, ketua 307", sama(kd(h22), { ketua: 1, anggota: 1 }) && h22.diganti === 0, [kd(h22), h22.diganti]);
    const h17 = await rekap({ peran: "hakim", id: "17" });
    periksa(
      "305 kursi 2: yang terakhir ditetapkan sebelum putusan menang - 17 yang lebih dulu, walau tak bertanggal, diganti",
      kedudukanDi(h17, "305") === "-" && h17.diganti === 1 && kedudukanDi(h17, "301") === "anggota,ikrar",
      [kd(h17), h17.diganti]
    );

    const p8 = await rekap({ peran: "panitera", id: "8" });
    const p9 = await rekap({ peran: "panitera", id: "9" });
    periksa("panitera: yang mendampingi sampai putusan dihitung (305)", p8.ringkas.jumlah === 1 && p8.diganti === 0, [p8.ringkas.jumlah, p8.diganti]);
    periksa("panitera: sidang 305 milik panitera 8 - 2 sidang, BAS 1 dari 2", p8.sidang.jumlah === 2 && sama(p8.sidang.bas, bag(1, 2, 50)), p8.sidang);
    periksa(
      "panitera yang ditetapkan sesudah putusan: 0 perkara, 0 sidang, 1 diganti",
      p9.ringkas.jumlah === 0 && p9.diganti === 1 && p9.sidang.jumlah === 0,
      [p9.ringkas.jumlah, p9.diganti, p9.sidang]
    );

    const j11 = await rekap({ peran: "jurusita", id: "11" });
    const j12 = await rekap({ peran: "jurusita", id: "12" });
    periksa("juru sita: yang memanggil selama pemeriksaan dihitung (305) beserta 2 relaasnya", j11.ringkas.jumlah === 1 && j11.relaas.jumlah === 2, [j11.ringkas.jumlah, j11.relaas]);
    periksa(
      "juru sita yang ditetapkan sesudah putusan: 0 perkara, 0 relaas, 1 diganti",
      j12.ringkas.jumlah === 0 && j12.relaas.jumlah === 0 && j12.diganti === 1,
      [j12.ringkas.jumlah, j12.relaas, j12.diganti]
    );

    // Tanggal putusan tak terbaca: kedudukannya jatuh ke penanda aktif, dan
    // kegagalan itu DISEBUT - bukan hitungan yang diam-diam berubah.
    siapkan();
    gagalkan = /FROM perkara_putusan pu WHERE pu\.perkara_id IN \(SELECT/;
    const gagalPutus = await rekap({ peran: "hakim", id: "21" });
    periksa("tanggal putusan gagal dibaca: disebut di takTerbaca", gagalPutus.ok && gagalPutus.takTerbaca.some((x) => x.bagian === "tanggalPutusan"), gagalPutus.takTerbaca);
    periksa("tanggal putusan gagal dibaca: rincian perkaranya tetap terbaca", gagalPutus.perkaraTerbaca === true);
  }

  console.log("\n== Majelis dan petugas ikrar dari borang penetapan ikrar talak (perkara_ikrar_talak) ==");
  {
    // Aturan yang sama dengan Status Perkara dan eviden SKP (ikrarLengkap):
    // per peran, penunjukan aktif tahapan 18 bila ada, selainnya borang ikrar.
    // Terukur di sipp_donggala: 73 perkara bermajelis ikrar, 798 berpanitera
    // ikrar, dan 829 berjuru sita ikrar yang hanya tercatat di borang.
    siapkan();
    const kd = (r) => Object.fromEntries(r.menurutPeran.map((x) => [x.kunci, x.jumlah]));
    const kedudukanDi = (r, nomor) => {
      const b = r.daftar.baris.find((x) => x.nomorPerkara.startsWith(nomor));
      return b ? b.kedudukan.join() : "-";
    };

    const h27 = await rekap({ peran: "hakim", id: "27" });
    periksa("309: ketua ikrar yang hanya tercatat di borang - kedudukan ikrar", kedudukanDi(h27, "309") === "ikrar", kd(h27));
    periksa(
      "hakim 27: ikrar dari borang tidak ikut ringkasan dan bukan 'pernah diganti'",
      h27.ringkas.jumlah === 0 && h27.diganti === 0 && sama(kd(h27), { ikrar: 1 }),
      [kd(h27), h27.ringkas.jumlah, h27.diganti]
    );
    periksa("310: borang yang ID-nya tidak dapat dipasangkan dengan nama tidak dikreditkan", kedudukanDi(h27, "310") === "-");

    const h28 = await rekap({ peran: "hakim", id: "28" });
    periksa(
      "301: borang TIDAK dipakai bila penunjukan tahapan 18 mencatat majelis ikrar lain",
      kedudukanDi(h28, "301") === "-" && sama(kd(h28), { ikrar: 1 }),
      kd(h28)
    );

    const h26 = await rekap({ peran: "hakim", id: "26" });
    periksa(
      "311: hakim yang diganti sebelum putusan lalu menjadi hakim ikrar (borang) - ikrar, bukan 'pernah diganti'",
      kedudukanDi(h26, "311") === "ikrar" && h26.diganti === 0 && h26.ringkas.jumlah === 0,
      [kd(h26), h26.diganti]
    );

    const h14 = await rekap({ peran: "hakim", id: "14" });
    periksa("302: ikrar dari penunjukan dan borang sekaligus tetap satu kedudukan", kedudukanDi(h14, "302") === "ketua,ikrar" && kd(h14).ikrar === 1, kd(h14));

    const p8 = await rekap({ peran: "panitera", id: "8" });
    periksa(
      "panitera ikrar yang hanya tercatat di borang (301) - kedudukan tersendiri",
      sama(kd(p8), { panitera: 1, paniteraIkrar: 1 }) && kedudukanDi(p8, "301") === "paniteraIkrar",
      kd(p8)
    );
    periksa("panitera: ringkasan dan sidang tetap atas perkara pemeriksaan saja (305)", p8.ringkas.jumlah === 1 && p8.sidang.jumlah === 2, [p8.ringkas.jumlah, p8.sidang]);
    const p9 = await rekap({ peran: "panitera", id: "9" });
    periksa(
      "panitera 9: ikrar 309 dari borang, tetap 1 diganti (305)",
      sama(kd(p9), { paniteraIkrar: 1 }) && p9.diganti === 1 && p9.ringkas.jumlah === 0,
      [kd(p9), p9.diganti]
    );
    const p7 = await rekap({ peran: "panitera", id: "7" });
    periksa("104: borang tidak dipakai bila penunjukan tahapan 18 mencatat panitera ikrar lain", !kd(p7).paniteraIkrar && kd(p7).panitera === 2, kd(p7));

    const j12 = await rekap({ peran: "jurusita", id: "12" });
    periksa("juru sita ikrar yang hanya tercatat di borang (309); relaasnya tidak dihitung", sama(kd(j12), { jurusitaIkrar: 1 }) && j12.relaas.jumlah === 0, [kd(j12), j12.relaas]);
    const j10 = await rekap({ peran: "jurusita", id: "10" });
    periksa("104: borang tidak dipakai bila penunjukan tahapan 18 mencatat juru sita ikrar lain", !kd(j10).jurusitaIkrar && kd(j10).jurusita === 1, kd(j10));

    periksa("keterangan dasar hitung menyebut borang perkara_ikrar_talak", /perkara_ikrar_talak/.test(h27.dasar.penugasan), h27.dasar.penugasan);
    const kueriBorang = kueri.filter((k) => /FROM perkara_ikrar_talak t\s+WHERE FIND_IN_SET/.test(k.sql));
    periksa(
      "borang dicari lewat ID (FIND_IN_SET), tidak lewat nama",
      kueriBorang.length > 0 && kueriBorang.every((k) => !/_text\s*(=|LIKE)/i.test(k.sql)),
      kueriBorang.length
    );

    // Borang tak terbaca: DISEBUT, bukan diam-diam kembali ke penunjukan saja.
    siapkan();
    gagalkan = /FROM perkara_ikrar_talak t WHERE FIND_IN_SET/;
    const gagalCari = await rekap({ peran: "hakim", id: "27" });
    periksa("borang ikrar gagal dicari: disebut di takTerbaca", gagalCari.ok && gagalCari.takTerbaca.some((x) => x.bagian === "borangIkrar"), gagalCari.takTerbaca);
    siapkan();
    gagalkan = /FROM perkara_ikrar_talak t WHERE t\.perkara_id IN/;
    const gagalBaca = await rekap({ peran: "hakim", id: "27" });
    periksa("borang ikrar gagal dibaca: disebut di takTerbaca", gagalBaca.ok && gagalBaca.takTerbaca.some((x) => x.bagian === "borangIkrar"), gagalBaca.takTerbaca);

    // SIPP tanpa tabel borang ikrar: tidak dicari, tidak disebut gagal.
    siapkan((k) => {
      delete k.perkara_ikrar_talak;
    });
    const tanpaBorang = await rekap({ peran: "hakim", id: "14" });
    periksa(
      "SIPP tanpa perkara_ikrar_talak: tidak ada kueri borang, tidak ada yang disebut gagal",
      tanpaBorang.takTerbaca.length === 0 &&
        !kueri.some((k) => /perkara_ikrar_talak/.test(k.sql) && !/information_schema/i.test(k.sql)),
      tanpaBorang.takTerbaca
    );
  }

  console.log("\n== Pembagian nol ==");
  {
    siapkan();
    const r = await rekap({ peran: "panitera", id: "6" });
    periksa("panitera tanpa perkara tetap terbuka", r.ok === true && r.ringkas.jumlah === 0);
    periksa("keadaan proses: null, bukan 0%", r.ringkas.keadaan.proses.persen === null);
    periksa("lama rata dan median null", r.ringkas.lama.rataHari === null && r.ringkas.lama.medianHari === null);
    periksa("dalam lima bulan: penyebut 0, persen null", sama(r.ringkas.lama.dalamBatas, bag(0, 0, null)));
    periksa("verstek persen null", r.ringkas.verstek.persen === null);
    periksa("BAS: 0 dari 0, persen null", sama(r.sidang.bas, bag(0, 0, null)));
    // Ditelusuri pada objeknya, bukan pada JSON: JSON.stringify diam-diam
    // mengubah NaN menjadi null, dan pemeriksaan atas teksnya selalu lulus.
    const adaNaN = (nilai) =>
      typeof nilai === "number"
        ? Number.isNaN(nilai)
        : nilai && typeof nilai === "object"
          ? Object.values(nilai).some(adaNaN)
          : false;
    periksa("tidak ada NaN di seluruh jawaban", !adaNaN(r));
    periksa("penelusur NaN sungguh menangkap NaN", adaNaN({ a: [1, { b: NaN }] }));
  }

  console.log("\n== Tabel yang tidak ada: disebut tidak terbaca, bukan nol ==");
  {
    siapkan((k) => {
      delete k.perkara_efiling_id;
      delete k.perkara_banding;
    });
    const r = await rekap({ peran: "hakim", id: "7" });
    periksa("e-Court null bila tabelnya tidak ada", r.ringkas.ecourt === null);
    periksa("banding null bila tabelnya tidak ada", r.ringkas.banding === null);
  }

  console.log("\n== ID petugas pada muatan Status Perkara ==");
  {
    siapkan();
    jawaban = {
      majelis: [
        { id: 7, kode: "C1", nama: "Hakim Tujuh", jabatan: "Hakim Ketua", urutan: 1 },
        { id: null, kode: "", nama: "Hakim Tanpa Id", jabatan: "Hakim Anggota", urutan: 2 },
      ],
      panitera: [{ id: 5, kode: "", nama: "Panitera Lima, S.H." }],
      jurusita: [{ id: 9, kode: "", nama: "Jurusita Sembilan" }],
    };
    const majelis = await jadwal.majelisPerkara(101);
    periksa("majelis membawa id hakim", majelis[0].id === 7 && majelis[1].id === null, majelis);
    periksa("kueri majelis membaca hakim_id", kueri.some((k) => /hk\.hakim_id AS id/.test(k.sql)));
    const petugas = await jadwal.petugasPerkara(101);
    periksa("panitera dan juru sita membawa id", petugas.panitera[0].id === 5 && petugas.jurusita[0].id === 9, petugas);

    jawaban = {
      mediasi: [
        { mediasiId: 1, mediator: "Satu, S.H.<br/>Dua, S.H.", statusMediator: "H,N", mediatorIdTeks: "40,41", hasil: "T", penetapan: "2025-02-10", laporan: "2025-02-20" },
        { mediasiId: 2, mediator: "Tanpa Id", statusMediator: "", mediatorIdTeks: "", hasil: "", penetapan: "2025-03-01", laporan: "" },
        { mediasiId: 3, mediator: "A<br/>B", statusMediator: "H,H", mediatorIdTeks: "x,17", hasil: "", penetapan: "", laporan: "" },
      ],
      mediator: [
        { mediatorId: 40, nama: "Satu, S.H.", penetapan: "2025-02-10", aktif: "Y" },
        { mediatorId: 43, nama: "Lama", penetapan: "2025-01-01", aktif: "T" },
      ],
    };
    const mediasi = await tahapan.mediasiLengkapPerkara(101);
    periksa("dua mediator: id [40, 41] sejajar dengan nama", sama(mediasi.baris[0].mediatorIds, [40, 41]), mediasi.baris[0]);
    periksa("mediator_id kosong: cadangan id AKTIF dari perkara_mediator (43 yang diganti tidak ikut)", sama(mediasi.baris[1].mediatorIds, [40]), mediasi.baris[1].mediatorIds);
    periksa("bagian yang tak terbaca tetap di tempatnya (null), pasangan tidak bergeser", sama(mediasi.baris[2].mediatorIds, [null, 17]), mediasi.baris[2].mediatorIds);
    periksa("kueri mediasi membaca mediator_id", kueri.some((k) => /m\.mediator_id AS mediatorIdTeks/.test(k.sql)));
  }

  console.log("\n== Kolom nama mediator tak dikenali: penjelasan, bukan nama kosong ==");
  {
    // SIPP yang perkara_mediator-nya hanya dikenali perkara_id dan mediator_id.
    // Id saja bukan keterangan mediator: penjaga "Kolom mediator belum
    // dikenali" harus tetap menyala, bukan terbaca:true dengan nama kosong.
    siapkan((k) => {
      k.perkara_mediator = ["perkara_id", "mediator_id"];
    });
    jawaban = {
      mediasi: [{ mediasiId: 1, mediator: "Satu, S.H.", statusMediator: "H", mediatorIdTeks: "40", hasil: "T", penetapan: "2025-02-10", laporan: "2025-02-20" }],
      mediator: [{ mediatorId: 40 }],
    };
    const mediasi = await tahapan.mediasiLengkapPerkara(101);
    periksa("mediatorTerbaca false", mediasi.mediatorTerbaca === false, mediasi.mediatorTerbaca);
    periksa("tidak ada baris mediator bernama kosong", sama(mediasi.mediator, []), mediasi.mediator);
    // Spasi dan baris baru dirapatkan dulu - kuerinya ditulis bertingkat, dan
    // pola atas teks mentahnya lulus tanpa pernah cocok.
    periksa(
      "kueri perkara_mediator tidak dijalankan",
      !kueri.some((k) => /FROM perkara_mediator m WHERE m\.perkara_id = \?/.test(k.sql.replace(/\s+/g, " ")))
    );
    periksa("id mediasi dari perkara_mediasi tetap terbaca", sama(mediasi.baris[0].mediatorIds, [40]), mediasi.baris[0].mediatorIds);
  }

  console.log(`\nLulus: ${lulus}, Gagal: ${gagal}`);
  process.exit(gagal === 0 ? 0 : 1);
}

jalan().catch((galat) => {
  console.error(galat);
  process.exit(1);
});
