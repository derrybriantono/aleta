"use strict";

/**
 * ============================================================================
 * KOSAKATA PEMERIKSA PESAN - DAPAT DITAMBAH TANPA MEMASANG VERSI BARU
 * ============================================================================
 *
 * Pemeriksa pesan menahan tiga hal sebelum pesan pengadilan dikirim: kosakata
 * iklan yang dikenali penyaring WhatsApp, kosakata penipuan yang membuat pesan
 * resmi terbaca seperti penipu, dan alamat pemendek yang menyembunyikan tujuan
 * sebenarnya.
 *
 * Ketiganya tertulis di dalam kode. Tercatat sejak 1.15.0 sebagai
 * keterbatasan: "Daftar kosakata belum dapat disunting dari portal -
 * penambahan kata baru masih lewat pembaruan aplikasi."
 *
 * Akibatnya satu kata baru - satu frasa penipuan yang baru beredar minggu ini,
 * satu pemendek alamat yang baru dipakai - menuntut satu putaran penuh:
 * paket dibangun, diunggah, dipasang, container dibangun ulang. Untuk satu
 * baris teks. Dan itulah sebabnya kosakatanya jarang bertambah, padahal justru
 * kosakata penipuan yang paling cepat berubah di dunia nyata.
 *
 * ============================================================================
 * HANYA DAPAT DITAMBAH, TIDAK DAPAT DIKURANGI - DAN ITU DISENGAJA
 * ============================================================================
 *
 * Daftar bawaan tetap di dalam kode dan tidak dapat dihapus dari layar mana
 * pun. Yang dapat dilakukan pengadilan hanya MENAMBAH.
 *
 * Sebabnya bukan kehati-hatian yang berlebihan. Daftar penipuan memuat "kode
 * otp", "nomor rekening", "segera transfer". Membolehkan penghapusan berarti
 * membolehkan seseorang - dengan niat apa pun, termasuk keliru - membuka jalan
 * bagi persis pesan yang paling berbahaya: pesan yang mengatasnamakan
 * pengadilan dan meminta uang. Peringatannya sendiri tidak menghentikan
 * pengiriman; ia hanya memberi tahu. Menghapusnya tidak memberi kemudahan
 * apa-apa selain menghilangkan pemberitahuan itu.
 *
 * Kalau suatu hari ada kata bawaan yang benar-benar keliru, memperbaikinya
 * memang menuntut versi baru - dan itu keputusan yang pantas ditimbang orang,
 * bukan diubah dari layar.
 */

const { readRuntimeConfig, writeRuntimeConfig } = require("../config/runtime-config");
const logService = require("./logService");

/** Jenis kosakata yang dapat ditambah, beserta batasnya. */
const JENIS = {
  promosi: {
    label: "Kosakata iklan",
    keterangan:
      "Kata khas pesan iklan massal. Penyaring WhatsApp mengenalinya, dan pesan pengadilan tidak membutuhkannya.",
  },
  phishing: {
    label: "Kosakata penipuan",
    keterangan:
      "Frasa yang membuat pesan resmi terbaca seperti penipuan. Pembayaran perkara diurus di bank atau PTSP, tidak lewat pesan.",
  },
  pemendek: {
    label: "Alamat pemendek",
    keterangan:
      "Nama host pemendek tautan. Alamat yang disembunyikan tidak dapat diperiksa penerimanya sebelum ditekan.",
  },
};

/** Berapa banyak yang boleh ditambahkan per jenis. */
const BATAS_JUMLAH = 200;

/** Panjang satu butir. Cukup untuk frasa, tidak cukup untuk menempel kalimat. */
const BATAS_PANJANG = 80;

/**
 * Membersihkan satu daftar tambahan.
 *
 * Dikecilkan hurufnya dan dirapikan spasinya, sebab pemeriksanya membandingkan
 * dalam huruf kecil - butir bertulisan besar tidak akan pernah cocok, dan
 * ketidakcocokan itu tidak menampakkan dirinya sendiri.
 */
function bersihkan(daftar) {
  if (!Array.isArray(daftar)) return [];
  const hasil = [];
  const sudah = new Set();

  for (const satu of daftar) {
    const teks = String(satu || "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase()
      .slice(0, BATAS_PANJANG);

    // Butir sependek satu atau dua huruf akan cocok dengan hampir seluruh
    // pesan, dan peringatan yang selalu berbunyi berhenti dibaca.
    if (teks.length < 3) continue;
    if (sudah.has(teks)) continue;

    sudah.add(teks);
    hasil.push(teks);
    if (hasil.length >= BATAS_JUMLAH) break;
  }

  return hasil;
}

/** Kosakata tambahan yang tersimpan, per jenis. */
function getTambahan() {
  const tersimpan = (readRuntimeConfig() || {}).kosakataTambahan || {};
  const hasil = {};
  for (const jenis of Object.keys(JENIS)) {
    hasil[jenis] = bersihkan(tersimpan[jenis]);
  }
  return hasil;
}

/**
 * Menyimpan kosakata tambahan.
 *
 * Menerima daftar penuh, bukan selisihnya: layar mengirimkan apa yang tampak
 * di hadapannya, dan itu yang tersimpan. Mengirim selisih menuntut kedua sisi
 * sepakat tentang keadaan sebelumnya, dan kesepakatan itu putus begitu dua
 * orang menyunting bersamaan.
 */
function simpanTambahan(muatan = {}, olehSiapa = "") {
  const isi = {};
  for (const jenis of Object.keys(JENIS)) {
    isi[jenis] = bersihkan(muatan[jenis]);
  }

  const sekarang = readRuntimeConfig();
  writeRuntimeConfig({ ...sekarang, kosakataTambahan: isi });

  // Dicatat sebagai kejadian keamanan, sama seperti perubahan rubrik. Yang
  // diubah di sini menentukan pesan mana yang DIPERINGATKAN sebelum dikirim
  // atas nama pengadilan - perubahan sebesar itu tidak boleh tanpa jejak.
  void logService.logSecurityEvent({
    eventType: "kosakata_pemeriksa_pesan_disunting",
    severity: "warning",
    message: "Kosakata pemeriksa pesan ditambah atau dikurangi.",
    metadata: {
      jumlah: Object.fromEntries(Object.entries(isi).map(([jenis, d]) => [jenis, d.length])),
      olehSiapa: String(olehSiapa || ""),
    },
  });

  return { ok: true, tambahan: isi };
}

module.exports = {
  BATAS_JUMLAH,
  BATAS_PANJANG,
  JENIS,
  bersihkan,
  getTambahan,
  simpanTambahan,
};
