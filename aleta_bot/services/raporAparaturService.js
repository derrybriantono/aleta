"use strict";

/**
 * ============================================================================
 * BAB 7 - RAPOR KINERJA APARATUR
 * ============================================================================
 *
 * Empat belas butir, dan tidak seluruhnya dapat dibangun hari ini. Yang dapat
 * dibangun didaftarkan; yang belum disebutkan penghalangnya satu per satu di
 * bawah - sebab butir yang hilang tanpa keterangan terbaca seperti butir yang
 * memang tidak ada.
 *
 * ============================================================================
 * YANG MENENTUKAN: BARIS BUKTI HARUS MEMBAWA NAMA PETUGASNYA
 * ============================================================================
 *
 * Rapor per orang tidak menambah kueri baru. Ia memecah penilaian yang sudah
 * ada menurut nama petugas pada tiap baris buktinya - dan karena itu, rapor
 * hanya dapat disusun untuk peran yang namanya benar-benar tercatat di sana.
 *
 * Sebelas butir Ketaatan Tahapan kini membawa empat nama: hakim, majelis,
 * panitera pengganti, dan juru sita. Keempat rapor di bawah berdiri di atas
 * itu.
 */

const rapor = require("./kerangkaRaporService");
const tahapan = require("./penilaianTahapanService");

/** Seluruh penilaian tahapan - dasar bagi keempat rapor. */
function sumberTahapan() {
  return tahapan.TAHAPAN.map((t) => t.kunci);
}

/**
 * ============================================================================
 * SEPULUH BUTIR YANG BELUM DAPAT DIBANGUN, BESERTA PENGHALANGNYA
 * ============================================================================
 *
 * Ditulis sebagai data, bukan sebagai komentar, supaya dapat ditampilkan pada
 * layar dan dihitung penjaganya. Butir yang tidak dapat dibangun tetap harus
 * terlihat - dan alasannya harus dapat dibantah orang.
 */
const BELUM_DAPAT = {
  AP05: {
    judul: "Rapor Penyusun Konsep Putusan",
    sebab:
      "Menuntut tanggal konsep putusan dan putaran perbaikannya. SIPP menyimpan tanggal putusan dan minutasi, tetapi tidak menyimpan kapan konsep disusun maupun berapa kali dikoreksi - keduanya peristiwa di luar SIPP.",
  },
  AP06: {
    judul: "Rapor Mediator",
    sebab:
      "Tabel perkara_mediasi membawa nama mediator, tetapi belum ada satu pun penilaian yang membaca tabel itu. Rapor memecah penilaian yang sudah ada; ia tidak membaca SIPP sendiri. Butir ini menunggu penilaian mediasi dibangun lebih dahulu.",
  },
  AP07: {
    judul: "Rapor Petugas Meja Informasi",
    sebab:
      "Layanan meja informasi dan permohonan salinan tidak terekam pada SIPP sama sekali. Butir ini menuntut sumber data lain - antrian ALETA atau catatan meja - dan itu keputusan tersendiri, bukan pekerjaan kode.",
  },
  AP08: {
    judul: "Rapor Petugas Pengarsipan",
    sebab:
      "Penilaian pengarsipan sudah ada (KT18), tetapi tabel arsip tidak menyimpan nama petugas yang mengarsipkan. Yang tercatat hanya tanggalnya. Tanpa nama, tidak ada yang dapat dipecah.",
  },
  AP09: {
    judul: "Perbandingan Majelis terhadap Nilai Tengah",
    sebab:
      "Menuntut nilai tengah pengadilan sebagai pembanding, dan nilai tengah baru bermakna bila cukup banyak majelis punya penyebut yang cukup. Dengan sebelas penilaian yang baru berjalan, pembandingnya belum stabil - dan pembanding yang goyah membuat majelis tampak menyimpang karena kebetulan.",
  },
  AP10: {
    judul: "Rapor Kinerja Perorangan Gabungan",
    sebab:
      "Menuntut SATU angka gabungan dari beberapa penilaian, dan itu menuntut pembobotan - apakah ketaatan pemanggilan sama pentingnya dengan ketepatan minutasi. Pembobotan adalah kewenangan pimpinan pengadilan, bukan kewenangan yang menulis kodenya. Menjumlahkan baris begitu saja diam-diam memilih pembobotan menurut volume, dan petugas yang mengerjakan banyak tugas ringan akan tampak lebih baik.",
  },
  AP11: {
    judul: "Riwayat Nilai Aparatur Antar Periode",
    sebab:
      "Mesin riwayat nilai sudah ada, tetapi belum satu pun nilai aparatur pernah disimpan - dan riwayat dari satu titik bukan riwayat. Butir ini baru bermakna sesudah rapor berjalan beberapa periode dan nilainya tersimpan.",
  },
  AP12: {
    judul: "Uji Keandalan Antar Penilai",
    sebab:
      "Menuntut dua petugas menilai berkas yang sama lalu hasilnya dibandingkan. ALETA menilai dari data SIPP, bukan dari penilaian manusia, sehingga tidak ada dua penilai yang dapat dibandingkan. Butir ini menuntut cara kerja baru di pengadilan, bukan kode baru.",
  },
  AP13: {
    judul: "Catatan Akses dan Aktivitas Pengguna",
    sebab:
      "Tabel sys_audittrail dan sys_users ada di SIPP, tetapi membaca riwayat masuk dan alamat akses pegawai adalah hal yang berbeda sifatnya dari menilai pekerjaan - ia menyentuh pengawasan orang, bukan pengawasan perkara. Butir ini menunggu keputusan pimpinan tentang siapa yang boleh melihatnya dan untuk apa.",
  },
  AP14: {
    judul: "Uji Kepekaan Bobot Penilaian Aparatur",
    sebab:
      "Menguji apakah peringkat berubah bila bobot diubah - dan bobotnya sendiri belum ada, sebab AP10 belum dibangun. Butir ini menunggu AP10, dan AP10 menunggu keputusan pimpinan.",
  },
};

function daftarkanSemua() {
  rapor.daftarkan({
    kunci: "raporMajelisHakim",
    kode: "AP01",
    judul: "Rapor Kinerja Majelis Hakim",
    keterangan:
      "Sebelas penilaian ketaatan tahapan, dipecah menurut majelis yang menangani perkaranya. Tiap penilaian berdiri sendiri pada kolomnya - tidak ada angka gabungan.",
    versiRumus: "rapor-v1",
    dimensi: "majelis",
    sebutanDimensi: "majelis hakim",
    sumber: sumberTahapan(),
  });

  rapor.daftarkan({
    kunci: "raporHakimPerorangan",
    kode: "AP02",
    judul: "Rapor Kinerja Hakim Perorangan",
    keterangan:
      "Sebelas penilaian ketaatan tahapan, dipecah menurut hakim yang tercatat pada perkaranya.",
    versiRumus: "rapor-v1",
    dimensi: "hakim",
    sebutanDimensi: "hakim",
    sumber: sumberTahapan(),
  });

  rapor.daftarkan({
    kunci: "raporPaniteraPengganti",
    kode: "AP03",
    judul: "Rapor Kinerja Panitera Pengganti",
    keterangan:
      "Sebelas penilaian ketaatan tahapan, dipecah menurut panitera pengganti yang tercatat pada perkaranya.",
    versiRumus: "rapor-v1",
    dimensi: "paniteraPengganti",
    sebutanDimensi: "panitera pengganti",
    sumber: sumberTahapan(),
  });

  rapor.daftarkan({
    kunci: "raporJurusita",
    kode: "AP04",
    judul: "Indeks Keberhasilan Pemanggilan Jurusita",
    keterangan:
      "Penilaian ketaatan tahapan yang menyentuh pemanggilan, dipecah menurut juru sita. Belum disesuaikan tingkat kesulitan wilayah - penyesuaian itu menuntut daftar radius yang belum dibakukan.",
    versiRumus: "rapor-v1",
    dimensi: "jurusita",
    sebutanDimensi: "juru sita",
    sumber: sumberTahapan(),
  });
}

/** Sambungan ke katalog - hanya yang benar-benar dibangun. */
function sambungan() {
  return {
    AP01: "raporMajelisHakim",
    AP02: "raporHakimPerorangan",
    AP03: "raporPaniteraPengganti",
    AP04: "raporJurusita",
  };
}

module.exports = { BELUM_DAPAT, daftarkanSemua, sambungan, sumberTahapan };
