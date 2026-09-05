/**
 * JALUR APLIKASI BARU (K7) - db_surat, bukutamu, db_absensi, dan seterusnya.
 *
 * ============================================================================
 * YANG DIBUTUHKAN BUKAN PENGHUBUNG, MELAINKAN SYARAT MASUK
 * ============================================================================
 *
 * Menyambungkan satu basis data baru itu mudah - beberapa baris kueri, selesai
 * sore itu juga. Yang sulit muncul enam bulan kemudian: tidak ada yang ingat
 * ruas mana dari aplikasi itu boleh keluar gedung, tidak ada yang tahu
 * datanya sudah basi berapa lama, dan tidak ada yang berani mematikannya
 * karena tidak jelas apa yang bergantung padanya.
 *
 * Berkas ini karena itu bukan penghubung. Ia daftar SYARAT yang harus dipenuhi
 * sebuah aplikasi sebelum boleh menjadi sumber - dan pemeriksa yang menolak
 * pendaftaran yang belum memenuhinya.
 *
 * ============================================================================
 * TIGA SYARAT, DAN KETIGANYA PERNAH TERLUPAKAN
 * ============================================================================
 *
 * 1. HANYA BACA. Aplikasi sumber tidak boleh ditulisi ALETA. Aturan ini sudah
 *    berlaku bagi APS Badilag sejak awal dan pernah hampir dilanggar karena
 *    "cuma menandai sudah terbaca".
 *
 * 2. RUAS DIDAFTARKAN BESERTA BATASNYA. Sumber baru membawa nama kolom baru,
 *    dan J5 memperlakukan ruas tak dikenal sebagai terlarang. Tanpa
 *    pendaftaran, aplikasi barunya tersambung tetapi tidak satu pun ruasnya
 *    dapat dipakai - dan kegagalannya terlihat seperti kerusakan sambungan.
 *
 * 3. UMUR DATA DINYATAKAN. Data absensi kemarin masih berguna; data absensi
 *    tahun lalu menyesatkan bila ditampilkan tanpa tanggal. Sumber yang tidak
 *    menyatakan umurnya akan dibaca seolah selalu mutakhir.
 */

import { type Batas } from "@/lib/batas-data";

export type RuasSumber = {
  nama: string;
  batas: Batas;
  keterangan: string;
};

export type Sumber = {
  /** Nama pendek, dipakai sebagai awalan ruas: "absensi", "bukutamu". */
  kode: string;
  nama: string;
  /** Basis data atau layanan asalnya, untuk ditelusuri. */
  asal: string;
  hanyaBaca: boolean;
  /**
   * Berapa lama data dari sumber ini masih dianggap mutakhir, dalam jam.
   * Nol berarti belum dinyatakan - dan itu ditolak.
   */
  umurWajarJam: number;
  ruas: RuasSumber[];
  /** Siapa yang mendaftarkannya, dan atas perintah siapa. */
  didaftarkanOleh: string;
  atasPerintah: string;
};

export type HasilPeriksa = {
  ok: boolean;
  halangan: string[];
  peringatan: string[];
};

function bersih(nilai: unknown): string {
  return String(nilai ?? "").trim();
}

/**
 * Memeriksa pendaftaran sumber baru.
 *
 * Menolak, bukan memperingatkan. Sumber yang terdaftar dengan syarat yang
 * belum lengkap akan dipakai sebelum syaratnya dilengkapi - dan yang
 * memakainya tidak akan tahu apa yang kurang.
 */
export function periksaSumber(sumber: Sumber): HasilPeriksa {
  const halangan: string[] = [];
  const peringatan: string[] = [];

  const kode = bersih(sumber.kode);
  if (!/^[a-z][a-z0-9_]{1,30}$/.test(kode)) {
    halangan.push('Kode sumber harus huruf kecil, angka, dan garis bawah - misalnya "db_surat".');
  }
  if (!bersih(sumber.nama)) halangan.push("Nama sumber wajib diisi.");
  if (!bersih(sumber.asal)) halangan.push("Asal data wajib disebut supaya dapat ditelusuri.");

  if (!sumber.hanyaBaca) {
    halangan.push(
      "Sumber wajib hanya-baca. ALETA tidak menulis ke aplikasi lain - termasuk sekadar menandai sudah terbaca."
    );
  }

  if (!(Number(sumber.umurWajarJam) > 0)) {
    halangan.push(
      "Umur wajar data wajib dinyatakan. Sumber yang tidak menyatakannya akan dibaca seolah selalu mutakhir."
    );
  }

  const ruas = sumber.ruas ?? [];
  if (!ruas.length) {
    halangan.push("Sekurangnya satu ruas wajib didaftarkan beserta batas keluarnya.");
  }

  const namaTerpakai = new Set<string>();
  for (const satu of ruas) {
    const nama = bersih(satu.nama);
    if (!nama) {
      halangan.push("Ada ruas tanpa nama.");
      continue;
    }
    if (namaTerpakai.has(nama.toLowerCase())) {
      halangan.push(`Ruas "${nama}" didaftarkan dua kali.`);
    }
    namaTerpakai.add(nama.toLowerCase());

    if (!["bebas", "samar", "terlarang"].includes(satu.batas)) {
      halangan.push(`Ruas "${nama}" belum menyatakan batas keluarnya.`);
    }
    // Ruas berawalan kode sumbernya sendiri membuat asalnya terbaca dari
    // namanya saja. Bukan syarat, tetapi yang melanggarnya akan menyulitkan
    // orang yang kelak membaca daftar ruas gabungan dari sepuluh sumber.
    if (kode && !nama.toLowerCase().startsWith(kode.toLowerCase())) {
      peringatan.push(`Ruas "${nama}" tidak berawalan "${kode}", sehingga asalnya tidak terbaca dari namanya.`);
    }
    if (satu.batas === "bebas" && !bersih(satu.keterangan)) {
      halangan.push(`Ruas "${nama}" berbatas bebas tanpa keterangan. Yang boleh keluar wajib beralasan.`);
    }
  }

  if (!bersih(sumber.didaftarkanOleh)) halangan.push("Sebutkan siapa yang mendaftarkan.");
  if (!bersih(sumber.atasPerintah)) {
    halangan.push("Sebutkan atas perintah siapa sumber ini disambungkan.");
  }

  return { ok: halangan.length === 0, halangan, peringatan };
}

/**
 * Aturan batas data untuk seluruh ruas satu sumber.
 *
 * Dipakai memasukkan ruas sumber baru ke penyaring J5 tanpa menyunting
 * BATAS_BAWAAN - daftar bawaan itu tentang ruas perkara, dan mencampurnya
 * dengan ruas aplikasi lain akan membuat keduanya sulit dibaca.
 */
export function aturanBatasSumber(sumber: Sumber): Array<{ ruas: string; batas: Batas; sebab: string }> {
  return (sumber.ruas ?? [])
    .filter((item) => bersih(item.nama))
    .map((item) => ({
      ruas: bersih(item.nama),
      batas: item.batas,
      sebab: bersih(item.keterangan) || `Ruas dari sumber ${bersih(sumber.nama) || bersih(sumber.kode)}.`,
    }));
}

export type KeadaanData = {
  segar: boolean;
  umurJam: number;
  keterangan: string;
};

/**
 * Menilai kesegaran data satu sumber.
 *
 * BELUM ADA PEMANGGILNYA, dan itu disengaja: fungsi ini bagian dari kontrak
 * yang harus dipenuhi pembaca sumber baru, dan sumber baru pertama belum
 * disambungkan. Disebutkan di sini supaya ketiadaan pemanggilnya terbaca
 * sebagai kontrak yang menunggu, bukan sebagai kode mati yang terlupakan.
 *
 *
 * Data yang lewat umur wajarnya TIDAK disembunyikan - ia ditampilkan dengan
 * umurnya disebutkan. Menyembunyikannya membuat layar kosong yang terbaca
 * sebagai "tidak ada data", padahal yang benar adalah "datanya ada, hanya
 * lama" - dan keduanya menuntut tindakan yang berbeda.
 */
export function nilaiKesegaran(sumber: Sumber, diambilPada: string, sekarang = new Date()): KeadaanData {
  const waktu = new Date(String(diambilPada ?? ""));
  if (Number.isNaN(waktu.getTime())) {
    return { segar: false, umurJam: 0, keterangan: "Waktu pengambilan data tidak tercatat." };
  }

  const umurJam = Math.max(0, (sekarang.getTime() - waktu.getTime()) / 3_600_000);
  const wajar = Number(sumber.umurWajarJam) || 0;
  const segar = wajar > 0 && umurJam <= wajar;

  return {
    segar,
    umurJam: Math.round(umurJam * 10) / 10,
    keterangan: segar
      ? ""
      : `Data ${bersih(sumber.nama) || bersih(sumber.kode)} berumur ${Math.round(umurJam)} jam, ` +
        `melewati batas wajar ${wajar} jam. Ditampilkan apa adanya, bukan disembunyikan.`,
  };
}
