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
 * bawah disalin apa adanya dari naskah resmi yang diunduh dari peraturan.go.id.
 *
 * ============================================================================
 * TIGA HURUF ADA, SATU BELUM
 * ============================================================================
 *
 * A, B, dan F ada di Pasal 19 PP Nomor 9 Tahun 1975 - naskahnya berhasil
 * diunduh dan disalin apa adanya.
 *
 * H TIDAK ADA di PP itu: Pasal 19 hanya sampai huruf f. Huruf g dan h berasal
 * dari Kompilasi Hukum Islam (Instruksi Presiden Nomor 1 Tahun 1991), dan
 * naskah resminya BELUM berhasil diunduh - berkas .doc di peraturan.go.id
 * menjawab kosong.
 *
 * Karena itu huruf H sengaja dibiarkan tanpa bunyi, dan mesin ini TIDAK AKAN
 * PERNAH mengusulkannya sampai bunyinya diisi dari naskah resmi. Mengisinya
 * dengan kalimat yang "kira-kira benar" jauh lebih berbahaya daripada
 * membiarkannya kosong: yang kosong terlihat, yang kira-kira tidak.
 *
 * CARA MELENGKAPI: unduh naskah resmi Inpres 1/1991, salin bunyi Pasal 116
 * huruf h apa adanya ke dalam `bunyi`, isi `sumber` dengan tautannya, lalu
 * ubah `siap` menjadi true. Pengujian akan langsung ikut menjaga bentuknya.
 */

/** Naskah resmi yang dipakai, beserta asalnya. */
const SUMBER_PP_9_1975 = {
  nama: "Pasal 19 Peraturan Pemerintah Nomor 9 Tahun 1975",
  tautan: "https://peraturan.go.id/files/pp9-1975.pdf",
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
    siap: false,
    bunyi: "",
    sumber: {
      nama: "Kompilasi Hukum Islam (Instruksi Presiden Nomor 1 Tahun 1991)",
      tautan: "https://peraturan.go.id/id/inpres-no-1-tahun-1991",
      diunduh: "",
    },
    ciri: ["murtad", "pindah agama", "keluar dari agama islam"],
    syarat:
      "BELUM DIPAKAI - bunyi huruf H belum diambil dari naskah resmi KHI. Lengkapi abtAturanAlasan.js lebih dulu.",
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

module.exports = { HURUF, usulkan, belumSiap, SUMBER_PP_9_1975 };
