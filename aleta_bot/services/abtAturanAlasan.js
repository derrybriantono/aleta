"use strict";

/**
 * ============================================================================
 * HURUF ALASAN PERCERAIAN - DIAMBIL DARI NASKAH RESMI, BUKAN DARI INGATAN
 * ============================================================================
 *
 * Blangko [01] Kabul Verstek Cerai menyebut variabel 8503 sebagai:
 *
 *     "ALASAN PERCERAIAN - PILIH SALAH SATU / DAPAT DIGABUNG: A, B, F, H
 *      (FASAKH)"
 *
 * Huruf-huruf itu menunjuk alasan perceraian di dalam peraturan, dan satu
 * huruf yang salah mengubah dasar hukum putusan. Karena itu bunyinya TIDAK
 * BOLEH ditulis dari ingatan siapa pun - termasuk ingatan mesin. Yang ada di
 * bawah disalin apa adanya dari naskah resmi yang diunduh, dan tiap huruf
 * membawa sendiri keterangan dari naskah mana ia berasal.
 *
 * ============================================================================
 * DUA NASKAH, DUA ASAL
 * ============================================================================
 *
 * A, B, dan F disalin dari Pasal 19 PP Nomor 9 Tahun 1975 - naskahnya diunduh
 * dari peraturan.go.id.
 *
 * H TIDAK ADA di PP itu: Pasal 19 berhenti di huruf f. Huruf g dan h hanya ada
 * di Kompilasi Hukum Islam, Pasal 116 - dan KHI-lah dasar yang dipakai
 * Pengadilan Agama.
 *
 * Naskah KHI tidak dapat diambil dari peraturan.go.id: berkas .doc yang
 * dirujuk halaman Inpres 1/1991 di sana menjawab 200 dengan panjang NOL, dan
 * baris "Dokumen Peraturan" pada halamannya kosong. Diambil dari terbitan
 * resmi Kementerian Agama - kementerian yang justru diperintahkan Inpres itu
 * untuk menyebarluaskan KHI.
 *
 * ============================================================================
 * KENAPA DUA SALINAN, DAN APA YANG DIPERIKSA DI ANTARA KEDUANYA
 * ============================================================================
 *
 * Kedua terbitan itu hasil pindaian, dan lapisan teksnya memuat salah baca
 * yang kentara di alinea yang sama: "Pasall17" untuk "Pasal 117", "dalarn"
 * untuk "dalam", "terj::idinya" untuk "terjadinya". Salah baca yang paling
 * berbahaya justru pada PENANDA HURUFNYA - salinan pertama menulis "k." di
 * tempat yang seharusnya "h.".
 *
 * Karena itu bunyinya tidak diambil dari satu salinan saja. Salinan kedua
 * menulis penanda itu dengan benar sebagai "h.", dan urutan a-b-c-d-e-f-g yang
 * mendahuluinya menutup ruang tebakan. Keduanya juga sepakat pada bunyi
 * kalimatnya, termasuk pada penulisan "ketidak rukunan" yang berspasi - jadi
 * itu memang yang tercetak, bukan salah baca.
 *
 * Yang disalin ke bawah adalah bunyi yang disepakati kedua salinan, apa
 * adanya. Merapikan ejaannya berarti menyunting naskah hukum, dan itu bukan
 * wewenang berkas ini.
 */

/** Naskah resmi yang dipakai, beserta asalnya. */
const SUMBER_PP_9_1975 = {
  nama: "Pasal 19 Peraturan Pemerintah Nomor 9 Tahun 1975",
  tautan: "https://peraturan.go.id/files/pp9-1975.pdf",
  diunduh: "2026-09-09",
};

/**
 * Pasal 116 Kompilasi Hukum Islam.
 *
 * Dua terbitan resmi Kementerian Agama, dibandingkan satu sama lain - lihat
 * catatan di kepala berkas ini tentang salah baca pindaian.
 */
const SUMBER_KHI = {
  nama: "Pasal 116 Kompilasi Hukum Islam (Inpres Nomor 1 Tahun 1991)",
  tautan:
    "https://simbi.kemenag.go.id/eliterasi/storage/perpustakaan/slims/repository/b5c07c0ce34195adb3cd15ad059b33f2.pdf",
  pembanding:
    "https://simbi.kemenag.go.id/eliterasi/storage/perpustakaan/pusat/316a67e6-6a05-4bf8-9f1d-6e8b22741b90/buku-digital/df7746a999-7125653410.pdf",
  diunduh: "2026-09-09",
};

/**
 * Peta huruf.
 *
 * `ciri` adalah kata kunci yang, bila muncul di keterangan saksi, MENUNJUK ke
 * huruf ini. Menunjuk, bukan membuktikan - lihat catatan pada usulkan().
 */
const HURUF = [
  {
    huruf: "A",
    siap: true,
    bunyi:
      "Salah satu pihak berbuat zina atau menjadi pemabok, pemadat, penjudi, dan lain sebagainya yang sukar disembuhkan",
    sumber: SUMBER_PP_9_1975,
    ciri: ["zina", "mabuk", "pemabok", "pemadat", "judi", "penjudi", "sabu", "narkoba"],
    syarat: "",
  },
  {
    huruf: "B",
    siap: true,
    bunyi:
      "Salah satu pihak meninggalkan pihak lain selama 2 (dua) tahun berturut-turut tanpa izin pihak lain dan tanpa alasan yang sah atau karena hal lain diluar kemampuannya",
    sumber: SUMBER_PP_9_1975,
    ciri: ["meninggalkan"],
    // Syaratnya angka, dan angka itu tidak dapat disimpulkan dari kata
    // kerjanya. Inilah sebab huruf B tidak pernah diusulkan hanya karena
    // saksi menyebut "meninggalkan tempat kediaman bersama" - hampir tiap
    // perkara memuat kalimat itu, dan hampir semuanya bukan huruf B.
    syarat: "menuntut 2 (dua) tahun berturut-turut - periksa lama pisahnya lebih dulu",
  },
  {
    huruf: "F",
    siap: true,
    bunyi:
      "Antara suami dan isteri terus-menerus terjadi perselisihan dan pertengkaran dan tidak ada harapan akan hidup rukun lagi dalam rumah tangga",
    sumber: SUMBER_PP_9_1975,
    ciri: ["perselisihan", "pertengkaran", "tidak rukun", "tidak harmonis"],
    syarat: "",
  },
  {
    huruf: "H",
    siap: true,
    // Disalin apa adanya, termasuk "ketidak rukunan" yang berspasi - kedua
    // terbitan resmi menuliskannya begitu.
    bunyi:
      "peralihan agama atau murtad yang menyebabkan terjadinya ketidak rukunan dalam rumah tangga",
    sumber: SUMBER_KHI,
    ciri: ["murtad", "pindah agama", "keluar dari agama islam"],
    // Bukan syarat jangka waktu seperti huruf B, melainkan syarat AKIBAT:
    // murtadnya saja tidak cukup, ia harus menyebabkan ketidakrukunan. Itu
    // fakta yang harus dibuktikan di persidangan, dan tidak dapat disimpulkan
    // dari kata "murtad" yang muncul di keterangan saksi.
    syarat:
      "menuntut akibat: murtadnya harus menyebabkan ketidakrukunan rumah tangga - periksa apakah itu terbukti",
  },
];

/**
 * Mengusulkan huruf dari ciri yang ditemukan di keterangan saksi.
 *
 * ============================================================================
 * MENUNJUK, BUKAN MEMUTUSKAN
 * ============================================================================
 *
 * Yang dikembalikan adalah daftar huruf yang PANTAS DIPERIKSA, masing-masing
 * dengan bunyi resminya, kata yang memicunya, dan syarat yang belum tentu
 * terpenuhi. Tidak ada satu pun yang ditandai terpilih.
 *
 * Huruf yang bunyinya belum diambil dari naskah resmi tidak pernah muncul,
 * berapa pun banyak cirinya cocok. Dan huruf yang punya syarat berupa jangka
 * waktu selalu membawa syarat itu di tampilan, sebab syaratnya tidak dapat
 * dibuktikan dari kata kunci.
 */
function usulkan(teksGabungan) {
  const kecil = String(teksGabungan || "").toLowerCase();
  const hasil = [];
  for (const h of HURUF) {
    if (!h.siap) continue;
    const pemicu = h.ciri.filter((kata) => kecil.includes(kata));
    if (pemicu.length === 0) continue;
    hasil.push({
      huruf: h.huruf,
      bunyi: h.bunyi,
      sumber: h.sumber,
      pemicu,
      syarat: h.syarat,
    });
  }
  return hasil;
}

/** Huruf yang bunyinya belum ada, untuk disebut apa adanya di tampilan. */
function belumSiap() {
  return HURUF.filter((h) => !h.siap).map((h) => ({
    huruf: h.huruf,
    sebab: h.syarat,
    sumber: h.sumber,
  }));
}

module.exports = { HURUF, usulkan, belumSiap, SUMBER_PP_9_1975, SUMBER_KHI };
