"use strict";

/**
 * ============================================================================
 * TABEL PEMETAAN RUAS TEKS BEBAS - DISUSUN SESUDAH DIUKUR
 * ============================================================================
 *
 * Pemetaan di berkas ini TIDAK dikarang. Seluruhnya disusun dari pengukuran
 * yang dijalankan pada SIPP Pengadilan Agama Donggala tanggal 7 September 2026,
 * dan angkanya tersimpan pada penyandingan/ukuran-ruas-bebas-20260907.json.
 *
 * ============================================================================
 * DIPETAKAN DI SISI ALETA, BUKAN DIPERBAIKI DI SIPP
 * ============================================================================
 *
 * ALETA tidak pernah menulis ke SIPP, dan tabel pemetaan dapat diperbaiki bila
 * kelak ternyata salah. Tulisan yang sudah diubah di SIPP tidak dapat
 * dikembalikan - dan yang mengubahnya belum tentu orang yang tahu bahwa
 * "Ruangan Satu" dan "Ruang Sidang 1" memang ruangan yang sama.
 *
 * ============================================================================
 * HANYA YANG TIDAK MENUNTUT PENILAIAN MANUSIA
 * ============================================================================
 *
 * Dua ruas dipetakan penuh di sini karena pengelompokannya tidak menuntut
 * penilaian siapa pun - "SMA" dan "Sekolah Lanjutan Tingkat Atas" adalah
 * jenjang yang sama menurut siapa pun yang membacanya.
 *
 * Empat ruas lainnya SENGAJA dibiarkan kosong:
 *
 *   alasanDitunda  1.468 tulisan, dan 6.210 di antaranya berisi "0" belaka.
 *                  Lebih berat lagi: ruas ini mencampur ALASAN dengan HASIL -
 *                  "putus DIKABULKAN (verstek)" bukan alasan penundaan,
 *                  melainkan hasil sidangnya. Memisahkan keduanya adalah
 *                  penilaian yang harus diambil petugas kepaniteraan, bukan
 *                  ditebak dari kata kuncinya.
 *
 *   pekerjaan      2.115 tulisan. Tiga puluh teratas dapat dikelompokkan
 *                  dengan yakin, sisanya tidak - dan mengelompokkan yang tidak
 *                  yakin akan memindahkan orang ke kelompok yang salah tanpa
 *                  ada yang tahu.
 *
 *   uraianBiaya    8.554 tulisan. Pengelompokannya menyentuh keuangan perkara,
 *                  dan salah kelompok di sana berarti salah laporan keuangan.
 *
 *   kecamatan      TIDAK PERLU dipetakan. SIPP sudah punya ref_kecamatan_new,
 *                  dan 95 persen isian yang terisi memang cocok dengannya.
 *                  Yang 5 persen ditulis sebagai NAMA, bukan kode - itu
 *                  perbaikan isian, bukan pekerjaan pemetaan.
 *
 * Mengisi keempatnya tanpa dibaca petugas akan memetakan yang tidak ada dan
 * meninggalkan yang ada.
 */

function bersih(x) {
  return String(x === undefined || x === null ? "" : x)
    .trim()
    .replace(/\s+/g, " ");
}

/** Kunci pembanding: huruf kecil, tanpa tanda baca, tanpa spasi berlebih. */
function kunciBanding(x) {
  return bersih(x)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

/**
 * ============================================================================
 * RUANG SIDANG - 22 tulisan, seluruhnya dipetakan
 * ============================================================================
 *
 * Dari 20.049 baris, 16.960 terisi (84,6 persen) dengan 22 tulisan berbeda -
 * dan ketiga puluh teratas menutupi 100 persen isian, artinya seluruh
 * tulisannya terlihat. Tidak ada ekor yang tersembunyi.
 *
 * Yang menonjol: "Ruang Sidang 1" (7.999), "1" (3.681), "Ruangan Satu" (3.134),
 * "Ruang Sidang 1 Dalam Gedung" (1.293), dan "Ruang Sidang Dalam Gedung 1"
 * (211) adalah ruangan yang SAMA, ditulis LIMA cara - seluruhnya 16.318
 * sidang. Tanpa pemetaan, satu ruang sidang terhitung sebagai lima.
 */
const RUANG_SIDANG = [
  {
    kelompok: "Ruang Sidang 1",
    jenis: "dalam gedung",
    tulisan: [
      "Ruang Sidang 1",
      "1",
      "Ruangan Satu",
      "Ruang Sidang 1 Dalam Gedung",
      "Ruang Sidang Dalam Gedung 1",
    ],
  },
  {
    kelompok: "Ruang Sidang 2",
    jenis: "dalam gedung",
    tulisan: ["Ruang Sidang 2", "2", "Ruangan dua", "Ruang Sidang 2 Dalam Gedung"],
  },
  { kelompok: "Ruang Sidang 3", jenis: "dalam gedung", tulisan: ["3"] },
  {
    kelompok: "Ruang Sidang Elektronik",
    jenis: "dalam gedung",
    tulisan: ["Ruang Sidang Elektronik 1", "Ruang Sidang Elektronik 2"],
  },
  {
    kelompok: "Sidang Terpadu di Luar Gedung",
    jenis: "luar gedung",
    tulisan: [
      "Sidang diluar gedung Pengadilan (sidang terpadu)",
      "Terpadu Sindue",
      "Terpadu Labuan",
      "Terpadu Sindue Tombusabura",
      "Terpadu Sirenja",
    ],
  },
  {
    kelompok: "Sidang Keliling",
    jenis: "luar gedung",
    tulisan: [
      "Sidang diluar gedung Pengadilan (sidang keliling)",
      "Sidang Keliling",
      "Sidang Keliling Sigi Biromaru",
      "Sidang Keliling Rio Pakava",
      "Sidang Keliling Sirenja",
    ],
  },
];

/**
 * ============================================================================
 * PENDIDIKAN - 21 tulisan, seluruhnya dipetakan
 * ============================================================================
 *
 * Dari 36.380 baris, hanya 4.829 terisi - CAKUPANNYA 13,3 PERSEN.
 *
 * Angka itu penting dan mengoreksi dugaan sebelumnya yang menyebut 34.531.
 * Statistik pendidikan para pihak karena itu menggambarkan seperdelapan
 * populasinya, dan wajib membawa penanda cakupan rendah.
 *
 * Isian yang berupa angka telanjang ("2", "9") dan tanda hubung dipetakan ke
 * "tidak terbaca" - BUKAN dibuang. Membuangnya akan membuat cakupan tampak
 * lebih baik daripada kenyataannya.
 */
const PENDIDIKAN = [
  { kelompok: "Tidak/Belum Sekolah", tingkat: 0, tulisan: ["Tidak Ada", "Tidak Sekolah", "Belum Sekolah"] },
  { kelompok: "Taman Kanak-kanak", tingkat: 1, tulisan: ["Taman Kanak-kanak", "TK"] },
  { kelompok: "Sekolah Dasar", tingkat: 2, tulisan: ["Sekolah Dasar", "SD", "Sekolah Dasar (SD)"] },
  {
    kelompok: "Sekolah Lanjutan Tingkat Pertama",
    tingkat: 3,
    tulisan: ["Sekolah Lanjutan Tingkat Pertama", "SLTP", "SMP"],
  },
  {
    kelompok: "Sekolah Lanjutan Tingkat Atas",
    tingkat: 4,
    tulisan: ["Sekolah Lanjutan Tingkat Atas", "SLTA", "SMA", "SMK"],
  },
  { kelompok: "Diploma", tingkat: 5, tulisan: ["Diploma I", "Diploma II", "Diploma III", "Diploma IV"] },
  { kelompok: "Strata I", tingkat: 6, tulisan: ["Strata I", "S1", "Sarjana"] },
  { kelompok: "Strata II", tingkat: 7, tulisan: ["Strata II", "S2", "Magister"] },
  { kelompok: "Strata III", tingkat: 8, tulisan: ["Strata III", "S3", "Doktor"] },
];

const TIDAK_TERBACA = "(tidak terbaca)";
const BELUM_DIPETAKAN = "(belum dipetakan)";

function susunPeta(daftar) {
  const peta = Object.create(null);
  daftar.forEach((k) => {
    k.tulisan.forEach((t) => {
      peta[kunciBanding(t)] = k.kelompok;
    });
  });
  return peta;
}

const PETA_RUANG = susunPeta(RUANG_SIDANG);
const PETA_PENDIDIKAN = susunPeta(PENDIDIKAN);

/**
 * Memetakan sebuah tulisan.
 *
 * Yang tidak dikenali dipulangkan sebagai "(belum dipetakan)" beserta tulisan
 * aslinya - BUKAN dibuang, dan bukan dipaksa masuk kelompok terdekat. Kelompok
 * "belum dipetakan" yang membesar adalah tanda tabel ini perlu ditambah, dan
 * tanda itu harus terlihat.
 */
function petakan(peta, tulisan) {
  const asli = bersih(tulisan);
  if (!asli) return { kelompok: TIDAK_TERBACA, asli, dikenali: false };
  // Angka telanjang dan tanda baca belaka bukan isian yang berarti.
  if (/^[-.\s_]+$/.test(asli)) return { kelompok: TIDAK_TERBACA, asli, dikenali: false };
  const k = kunciBanding(asli);
  if (Object.prototype.hasOwnProperty.call(peta, k)) {
    return { kelompok: peta[k], asli, dikenali: true };
  }
  // Angka telanjang yang tidak ada pada peta - mis. "9" pada ruas pendidikan.
  if (/^\d+$/.test(asli)) return { kelompok: TIDAK_TERBACA, asli, dikenali: false };
  return { kelompok: BELUM_DIPETAKAN, asli, dikenali: false };
}

const petakanRuangSidang = (t) => petakan(PETA_RUANG, t);
const petakanPendidikan = (t) => petakan(PETA_PENDIDIKAN, t);

/** Ruas yang belum punya tabel pemetaan, beserta alasannya. */
const BELUM_DISUSUN = [
  {
    ruas: "alasanDitunda",
    tulisanBerbeda: 1468,
    sebab:
      "Ruas ini mencampur ALASAN dengan HASIL - \"putus DIKABULKAN (verstek)\" bukan alasan penundaan. Memisahkannya adalah penilaian petugas kepaniteraan, bukan tebakan kata kunci. Ditambah 6.210 isian berupa \"0\" belaka.",
  },
  {
    ruas: "pekerjaan",
    tulisanBerbeda: 2115,
    sebab:
      "Tiga puluh teratas dapat dikelompokkan dengan yakin, sisanya tidak. Mengelompokkan yang tidak yakin memindahkan orang ke kelompok yang salah tanpa ada yang tahu.",
  },
  {
    ruas: "uraianBiaya",
    tulisanBerbeda: 8554,
    sebab:
      "Menyentuh keuangan perkara; salah kelompok berarti salah laporan keuangan.",
  },
  {
    ruas: "kecamatan",
    tulisanBerbeda: 340,
    sebab:
      "TIDAK perlu dipetakan. SIPP sudah punya ref_kecamatan_new, dan 95 persen isian cocok dengannya. Yang 5 persen ditulis sebagai nama, bukan kode - itu perbaikan isian, bukan pemetaan.",
  },
];

module.exports = {
  RUANG_SIDANG,
  PENDIDIKAN,
  BELUM_DISUSUN,
  TIDAK_TERBACA,
  BELUM_DIPETAKAN,
  bersih,
  kunciBanding,
  petakanRuangSidang,
  petakanPendidikan,
};
