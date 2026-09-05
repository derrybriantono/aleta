"use strict";

/**
 * Keadaan sesi tiap akun e-Court - diperiksa sekali, dipakai berkali-kali.
 *
 * ============================================================================
 * "TERSIMPAN" BUKAN "MASIH BERLAKU"
 * ============================================================================
 *
 * Sebelum ini layar pengaturan menulis "Sesi tersimpan" hanya karena folder
 * profilnya ada. Folder itu tetap ada walau sesinya sudah lama habis - dihapus
 * pun tidak oleh e-Court, sebab e-Court tidak tahu-menahu soal folder di server
 * pengadilan. Akibatnya layar menyatakan aman padahal penarikan sudah berhenti
 * sejak semalam, dan tidak ada yang tahu sampai ada yang membuka log.
 *
 * Karena itu keadaan sesi di sini punya TIGA nilai, bukan dua:
 *
 *   berlaku       - sudah diperiksa, dan e-Court menerima sesinya
 *   kedaluwarsa   - sudah diperiksa, dan e-Court menolaknya
 *   belum_pasti   - foldernya ada, tetapi belum diperiksa sejak bot menyala
 *
 * Yang ketiga TIDAK boleh ditulis "tersimpan" begitu saja. Itulah kekeliruan
 * yang membuat orang percaya pada keadaan yang tidak pernah diperiksa.
 *
 * ============================================================================
 * KENAPA DISIMPAN, BUKAN DIPERIKSA TIAP KALI DITANYA
 * ============================================================================
 *
 * Satu pemeriksaan sungguhan berarti menyalakan Chrome, memuat halaman
 * e-Court, dan menutupnya lagi. Beberapa detik, dan berat. Layar pengaturan
 * menanyakannya tiap kali dibuka - dan dengan beberapa akun, tiap kali berarti
 * beberapa Chrome berturut-turut. Itulah lag yang dirasakan.
 *
 * Jadi hasilnya disimpan beserta waktunya. Selama masih segar, yang
 * dikembalikan hasil simpanan - lengkap dengan keterangan "diperiksa sekian
 * menit lalu", supaya pembacanya tahu persis seberapa baru angka itu.
 *
 * ============================================================================
 * SATU PEMERIKSAAN PER SLOT PADA SATU WAKTU
 * ============================================================================
 *
 * Tanpa penjaga ini, menekan Periksa Sesi dua kali menyalakan dua Chrome pada
 * folder profil yang SAMA. Chrome menolak profil yang sedang dipakai proses
 * lain, sehingga pemeriksaan kedua gagal - dan kegagalan itu terbaca sebagai
 * sesi mati, padahal sesinya baik-baik saja.
 *
 * Permintaan yang datang selagi ada pemeriksaan berjalan menunggu hasil yang
 * sama, bukan memulai pemeriksaan baru.
 */

const ecourtLoginService = require("./ecourtLoginService");
const ecourtAkunService = require("./ecourtAkunService");
const ecourtKredensialService = require("./ecourtKredensialService");
const sesiEcourt = require("../tools/ecourt-bridge/sesi");

/** Berapa lama hasil pemeriksaan dianggap masih segar. */
const SEGAR_MS = 3 * 60 * 1000;

/** slot -> { hasil, padaMs } */
const simpanan = new Map();

/** slot -> Promise yang sedang berjalan. */
const sedangDiperiksa = new Map();

function kunciSlot(slot) {
  return sesiEcourt.bersihkanSlot(slot) || "utama";
}

/**
 * Menyusun keadaan yang dapat dibaca manusia dari hasil mentah periksaSesi.
 *
 * Perhatikan bahwa `berlaku: null` TIDAK dipetakan menjadi kedaluwarsa. Null
 * berarti belum diketahui - dan menyamakan "belum tahu" dengan "mati" akan
 * mengirim petugas login ulang untuk sesi yang sebenarnya masih hidup.
 */
function susunKeadaan(mentah, { diperiksa }) {
  if (!mentah || !mentah.tersimpan) {
    return {
      keadaan: "belum_pernah",
      label: "Belum pernah login",
      berlaku: false,
      tersimpan: false,
    };
  }

  if (mentah.berlaku === true) {
    return { keadaan: "berlaku", label: "Sesi berlaku", berlaku: true, tersimpan: true };
  }

  if (mentah.berlaku === false) {
    return {
      keadaan: "kedaluwarsa",
      label: "Sesi kedaluwarsa - perlu login ulang",
      berlaku: false,
      tersimpan: true,
    };
  }

  if (mentah.alasan === "gerbang_menunggu_penegasan") {
    return {
      keadaan: "gerbang",
      label: "Menunggu penegasan - akun dipakai di perangkat lain",
      berlaku: false,
      tersimpan: true,
    };
  }

  return {
    keadaan: "belum_pasti",
    label: diperiksa ? "Belum dapat dipastikan" : "Tersimpan, belum diperiksa",
    berlaku: false,
    tersimpan: true,
  };
}

/**
 * Keadaan satu slot.
 *
 * @param {string} slot
 * @param {{ paksa?: boolean, dalam?: boolean }} pilihan
 *   paksa - abaikan simpanan, periksa sungguhan sekarang
 *   dalam - lakukan pemeriksaan sungguhan bila simpanannya sudah basi
 */
async function keadaanSlot(slot, { paksa = false, dalam = false } = {}) {
  const kunci = kunciSlot(slot);
  const sekarang = Date.now();
  const tersimpan = simpanan.get(kunci);

  if (!paksa && tersimpan && sekarang - tersimpan.padaMs < SEGAR_MS) {
    return {
      ...tersimpan.hasil,
      dariSimpanan: true,
      umurDetik: Math.round((sekarang - tersimpan.padaMs) / 1000),
    };
  }

  // Tanpa izin memeriksa sungguhan, yang dikembalikan hanya apa yang dapat
  // diketahui tanpa membuka peramban.
  if (!paksa && !dalam) {
    const cepat = await ecourtLoginService.periksaSesi({ cepat: true, slot: kunci });
    const keadaan = susunKeadaan(cepat, { diperiksa: false });
    return {
      slot: kunci,
      ...keadaan,
      namaPengguna: cepat.namaPengguna || "",
      alasan: cepat.alasan || "",
      diperiksaPada: "",
      dariSimpanan: false,
      umurDetik: null,
    };
  }

  // Pemeriksaan yang sedang berjalan dipakai bersama - lihat catatan di kepala
  // berkas tentang dua Chrome pada satu folder profil.
  if (sedangDiperiksa.has(kunci)) return sedangDiperiksa.get(kunci);

  const kerja = (async () => {
    try {
      const mentah = await ecourtLoginService.periksaSesi({ cepat: false, slot: kunci });
      const keadaan = susunKeadaan(mentah, { diperiksa: true });
      const hasil = {
        slot: kunci,
        ...keadaan,
        namaPengguna: mentah.namaPengguna || "",
        alasan: mentah.alasan || "",
        diperiksaPada: mentah.diperiksaPada || new Date().toISOString(),
      };
      simpanan.set(kunci, { hasil, padaMs: Date.now() });
      return { ...hasil, dariSimpanan: false, umurDetik: 0 };
    } finally {
      sedangDiperiksa.delete(kunci);
    }
  })();

  sedangDiperiksa.set(kunci, kerja);
  return kerja;
}

/**
 * Keadaan SELURUH slot.
 *
 * Pemeriksaan sungguhan dijalankan BERURUTAN, bukan serentak. Beberapa Chrome
 * sekaligus pada server pengadilan menghabiskan memori, dan pada mesin yang
 * padat justru membuat semuanya gagal - termasuk penarikan yang sedang
 * berjalan.
 */
async function keadaanSemua({ paksa = false, dalam = false } = {}) {
  const akun = ecourtAkunService.daftarAkun();
  const daftarKredensial = ecourtKredensialService.daftar();
  const petaKredensial = Object.fromEntries(daftarKredensial.map((x) => [x.slot, x]));

  const hasil = [];
  for (const satu of akun) {
    const keadaan = await keadaanSlot(satu.slot, { paksa, dalam });
    const kredensial = petaKredensial[satu.slot] || null;
    hasil.push({
      ...satu,
      ...keadaan,
      // Surel boleh dilihat - ia menolong memastikan akun yang benar. Sandi
      // tidak pernah ikut, bahkan tidak dalam bentuk tersandi.
      emailTersimpan: kredensial ? kredensial.email : "",
      isiOtomatis: Boolean(kredensial && kredensial.adaSandi),
      kredensialDiperbaruiPada: kredensial ? kredensial.diperbaruiPada : "",
    });
  }
  return hasil;
}

/** Membuang simpanan - dipakai setelah login, logout, atau akun dihapus. */
function lupakan(slot = "") {
  if (!slot) {
    simpanan.clear();
    return;
  }
  simpanan.delete(kunciSlot(slot));
}

module.exports = {
  SEGAR_MS,
  keadaanSemua,
  keadaanSlot,
  lupakan,
  susunKeadaan,
};
