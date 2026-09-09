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
 * BOLEH ditulis dari ingatan siapa pun - termasuk ingatan mesin. Seluruhnya
 * disalin apa adanya dari naskah resmi yang diunduh.
 *
 * ============================================================================
 * DUA DASAR UNTUK SATU HURUF, DAN ITU BUKAN PENGULANGAN
 * ============================================================================
 *
 * Huruf a, b, dan f ada di DUA tempat sekaligus:
 *
 *   Pasal 19 PP Nomor 9 Tahun 1975  - berlaku bagi semua perkawinan
 *   Pasal 116 Kompilasi Hukum Islam - dasar yang dipakai Pengadilan Agama
 *
 * Isinya sama, BUNYINYA TIDAK. Keduanya disimpan berdampingan karena selisih
 * kata itu nyata dan ikut tercetak ke dalam putusan:
 *
 *   PP  : "pemabok"        KHI : "pemabuk"
 *   PP  : "terus-menerus"  KHI : "terus menerus"
 *
 * Yang menyusun putusan memilih akan mengutip yang mana; berkas ini menyediakan
 * keduanya apa adanya, dan tidak pernah mencampurnya menjadi satu kalimat
 * karangan.
 *
 * Huruf h hanya punya SATU dasar: Pasal 19 PP itu berhenti di huruf f. Huruf g
 * dan h memang hanya ada di KHI.
 *
 * ============================================================================
 * KENAPA DUA SALINAN KHI, DAN APA YANG DIPERIKSA DI ANTARA KEDUANYA
 * ============================================================================
 *
 * Naskah KHI tidak dapat diambil dari peraturan.go.id: berkas .doc yang
 * dirujuk halaman Inpres 1/1991 di sana menjawab 200 dengan panjang NOL, dan
 * baris "Dokumen Peraturan" pada halamannya kosong. Diambil dari terbitan
 * resmi Kementerian Agama - kementerian yang justru diperintahkan Inpres itu
 * untuk menyebarluaskan KHI.
 *
 * Kedua terbitan itu hasil pindaian, dan lapisan teksnya penuh salah baca -
 * masing-masing di tempat yang berbeda:
 *
 *   salinan 1 : "c." untuk huruf "e.", "k." untuk huruf "h.", "Pasall17"
 *   salinan 2 : "siih" untuk "sah", "mendapal", "cac«d", "dalarn",
 *               "terj::idinya", "Pasal 16" untuk "Pasal 116"
 *
 * Salah baca yang paling berbahaya justru pada PENANDA HURUFNYA. Kalau hanya
 * salinan pertama dipakai, huruf h akan tercatat sebagai "k" - dan tidak ada
 * yang dapat memeriksanya dari layar.
 *
 * Karena itu bunyi KHI di bawah adalah yang DISEPAKATI kedua salinan. Di mana
 * keduanya berselisih pada hal yang memang rawan pindaian - koma, spasi -
 * selisihnya disebut di `catatanNaskah`, bukan dipilih diam-diam. Ejaannya
 * tidak dirapikan: merapikan naskah hukum bukan wewenang berkas ini.
 */

/** Pasal 19 PP Nomor 9 Tahun 1975 - naskah digital, bukan pindaian. */
const SUMBER_PP_9_1975 = {
  nama: "Pasal 19 PP Nomor 9 Tahun 1975",
  tautan: "https://peraturan.go.id/files/pp9-1975.pdf",
  diunduh: "2026-09-09",
};

/** Pasal 116 Kompilasi Hukum Islam - dua terbitan resmi Kementerian Agama. */
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
 * `dasar` selalu berupa daftar - satu huruf dapat berdiri di atas lebih dari
 * satu naskah, dan yang menyusun putusan berhak melihat keduanya.
 *
 * `ciri` adalah kata kunci yang, bila muncul di keterangan saksi, MENUNJUK ke
 * huruf ini. Menunjuk, bukan membuktikan - lihat catatan pada usulkan().
 */
const HURUF = [
  {
    huruf: "A",
    siap: true,
    dasar: [
      {
        sumber: SUMBER_PP_9_1975,
        bunyi:
          "Salah satu pihak berbuat zina atau menjadi pemabok, pemadat, penjudi, dan lain sebagainya yang sukar disembuhkan",
        catatanNaskah: "",
      },
      {
        sumber: SUMBER_KHI,
        bunyi:
          "salah satu pihak berbuat zina atau menjadi pemabuk, pemadat, penjudi dan lain sebagainya yang sukar disembuhkan",
        catatanNaskah: 'KHI menulis "pemabuk"; PP menulis "pemabok".',
      },
    ],
    ciri: ["zina", "mabuk", "pemabok", "pemabuk", "pemadat", "judi", "penjudi", "sabu", "narkoba"],
    syarat: "",
  },
  {
    huruf: "B",
    siap: true,
    dasar: [
      {
        sumber: SUMBER_PP_9_1975,
        bunyi:
          "Salah satu pihak meninggalkan pihak lain selama 2 (dua) tahun berturut-turut tanpa izin pihak lain dan tanpa alasan yang sah atau karena hal lain diluar kemampuannya",
        catatanNaskah: "",
      },
      {
        sumber: SUMBER_KHI,
        bunyi:
          "salah satu pihak meninggalkan pihak lain selama 2 (dua) tahun berturut-turut tanpa izin pihak lain dan tanpa alasan yang sah atau karena hal lain diluar kemampuannya",
        catatanNaskah:
          'Kedua salinan KHI berselisih pada tanda baca: salinan 1 menulis "hal lain, diluar kemampuannya", salinan 2 menulis "hal lain di luar kemampuanya". Keduanya rawan salah baca pindaian; yang dipakai bentuk yang sama dengan naskah PP - periksa naskah cetak bila selisih ini menentukan.',
      },
    ],
    // Syaratnya angka, dan angka itu tidak dapat disimpulkan dari kata
    // kerjanya. Inilah sebab huruf B tidak pernah diusulkan hanya karena
    // saksi menyebut "meninggalkan tempat kediaman bersama" - hampir tiap
    // perkara memuat kalimat itu, dan hampir semuanya bukan huruf B.
    ciri: ["meninggalkan"],
    syarat: "menuntut 2 (dua) tahun berturut-turut - periksa lama pisahnya lebih dulu",
  },
  {
    huruf: "F",
    siap: true,
    dasar: [
      {
        sumber: SUMBER_PP_9_1975,
        bunyi:
          "Antara suami dan isteri terus-menerus terjadi perselisihan dan pertengkaran dan tidak ada harapan akan hidup rukun lagi dalam rumah tangga",
        catatanNaskah: "",
      },
      {
        sumber: SUMBER_KHI,
        bunyi:
          "antara suami dan isteri terus menerus terjadi perselisihan dan pertengkaran dan tidak ada harapan akan hidup rukun lagi dalam rumah tangga",
        catatanNaskah: 'KHI menulis "terus menerus" tanpa tanda hubung; PP menulis "terus-menerus".',
      },
    ],
    ciri: ["perselisihan", "pertengkaran", "tidak rukun", "tidak harmonis"],
    syarat: "",
  },
  {
    huruf: "H",
    siap: true,
    dasar: [
      {
        sumber: SUMBER_KHI,
        bunyi:
          "peralihan agama atau murtad yang menyebabkan terjadinya ketidak rukunan dalam rumah tangga",
        catatanNaskah:
          'Hanya ada di KHI - Pasal 19 PP 9/1975 berhenti di huruf f. Penulisan "ketidak rukunan" berspasi disalin apa adanya; kedua salinan menuliskannya begitu.',
      },
    ],
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
 * dengan SELURUH dasarnya, kata yang memicunya, dan syarat yang belum tentu
 * terpenuhi. Tidak ada satu pun yang ditandai terpilih, dan tidak satu pun
 * dasarnya disembunyikan - memilihkan naskah mana yang dikutip sama saja
 * dengan memilihkan dasar hukumnya.
 *
 * Huruf yang bunyinya belum diambil dari naskah resmi tidak pernah muncul,
 * berapa pun banyak cirinya cocok.
 */
function usulkan(teksGabungan) {
  const kecil = String(teksGabungan || "").toLowerCase();
  const hasil = [];
  for (const h of HURUF) {
    if (!h.siap) continue;
    const pemicu = h.ciri.filter((kata) => kecil.includes(kata));
    if (pemicu.length === 0) continue;
    hasil.push({ huruf: h.huruf, dasar: h.dasar, pemicu, syarat: h.syarat });
  }
  return hasil;
}

/** Huruf yang bunyinya belum ada, untuk disebut apa adanya di tampilan. */
function belumSiap() {
  return HURUF.filter((h) => !h.siap).map((h) => ({ huruf: h.huruf, sebab: h.syarat }));
}

module.exports = { HURUF, usulkan, belumSiap, SUMBER_PP_9_1975, SUMBER_KHI };
