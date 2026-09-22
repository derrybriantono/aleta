/**
 * ============================================================================
 * SAKLAR TAMPILAN LAYAR ANTRIAN SIDANG
 * ============================================================================
 *
 * Layar jadwal sidang dipakai empat macam orang yang pekerjaannya berbeda:
 * panitera sidang yang mencatat hasil, jurusita yang mengejar relaas, majelis
 * yang menyiapkan naskah, dan petugas yang membacakan antrian di ruang tunggu.
 * Tiap penanda berguna bagi salah satunya dan menjadi kebisingan bagi tiga
 * sisanya.
 *
 * Sampai sekarang jawabannya satu-satunya adalah mode Ringkas/Lengkap - dan
 * itu keputusan borongan: ia menyembunyikan kolom, bukan penanda, dan tidak
 * dapat memilih. Berkas ini memberi tiap penanda saklarnya sendiri.
 *
 * ============================================================================
 * YANG MENDESAK TIDAK PUNYA SAKLAR - DAN ITU DISENGAJA
 * ============================================================================
 *
 * Empat penanda tidak dapat dimatikan siapa pun:
 *
 *   retur                 relaas kembali; panggilan HARUS diulang atau
 *                         sidangnya batal
 *   belum dipanggil       masih ada pihak yang wajib dipanggil dan
 *                         relaasnya belum ada
 *   belum minutasi        perkara sudah putus, berkasnya belum dijahit
 *   belum unggah putusan  naskahnya belum ada di SIPP
 *
 * Sebabnya bukan kerapian. Saklar yang dimatikan hari ini tidak dinyalakan
 * lagi besok - ia tersimpan di peramban dan dilupakan - sehingga penanda yang
 * dimatikan sekali menjadi penanda yang tidak pernah terlihat lagi. Untuk
 * keterangan yang sekadar menolong itu tidak merugikan. Untuk keempat hal di
 * atas, akibatnya perkara yang batal sidangnya atau berkas yang tidak pernah
 * dijahit, dan tidak ada apa pun di layar yang akan menyebutkannya.
 *
 * Yang mematikan penanda menyembunyikannya dari dirinya sendiri; yang
 * membaca layar sesudahnya belum tentu orang yang mematikannya.
 */

/** Satu saklar tampilan. */
export type SaklarTampilan = {
  kunci: string;
  label: string;
  /** Apa yang disembunyikan bila dimatikan - untuk keterangan di panel. */
  keterangan: string;
  kelompok: KunciKelompokTampilan;
  /**
   * Tidak dapat dimatikan. Saklarnya tetap DIGAMBAR - dalam keadaan menyala
   * dan tidak dapat ditekan - beserta sebabnya. Menghilangkannya dari daftar
   * akan membuat orang mengira penandanya tidak ada, lalu mencarinya.
   */
  wajib?: boolean;
  /**
   * Bawaannya MATI, bukan menyala.
   *
   * Pengecualian, dan hanya bagi yang mematikannya tidak menghilangkan satu
   * pun fakta tentang perkara - lihat sebabnya pada daftarnya di bawah.
   */
  bawaanMati?: boolean;
};

export const KELOMPOK_TAMPILAN = [
  { kunci: "penanda", label: "Penanda pada baris" },
  { kunci: "keterangan", label: "Keterangan tambahan" },
  { kunci: "alat", label: "Tombol dan alat" },
] as const;

export type KunciKelompokTampilan = (typeof KELOMPOK_TAMPILAN)[number]["kunci"];

/**
 * Seluruh saklar, urut menurut kelompok lalu menurut seberapa sering dipakai.
 *
 * Kuncinya dipakai sebagai nama ruas di simpanan peramban, jadi MENGUBAH
 * kunci berarti menyetel ulang pilihan seluruh pemakai. Menambah kunci baru
 * aman: yang tidak dikenal simpanan lama memakai nilai bawaan.
 */
export const SAKLAR_TAMPILAN: SaklarTampilan[] = [
  // --- Yang mendesak: didahulukan justru karena tidak dapat dimatikan ------
  {
    kunci: "retur",
    label: "Retur",
    keterangan: "Relaas yang kembali tidak terlaksana - panggilan harus diulang.",
    kelompok: "penanda",
    wajib: true,
  },
  {
    kunci: "belum-dipanggil",
    label: "Belum dipanggil",
    keterangan: "Masih ada pihak yang wajib dipanggil dan relaasnya belum ada.",
    kelompok: "penanda",
    wajib: true,
  },
  {
    kunci: "belum-minutasi",
    label: "Belum minutasi",
    keterangan:
      "Kotak saring di atas tabel, dan lencana merah pada kolom Putusan: perkaranya sudah putus tetapi berkasnya belum dijahit.",
    kelompok: "penanda",
    wajib: true,
  },
  {
    // Kotak saring SAJA - tidak ada lencananya di baris, dan itu disebutkan.
    // Menjanjikan penanda baris yang tidak ada membuat orang mencarinya di
    // baris, tidak menemukannya, lalu menyimpulkan saklarnya rusak.
    kunci: "belum-unggah-putusan",
    label: "Belum unggah putusan",
    keterangan:
      "Kotak saring di atas tabel (tidak ada lencananya di baris): perkaranya sudah putus tetapi naskahnya belum diunggah ke SIPP.",
    kelompok: "penanda",
    wajib: true,
  },

  // --- Penanda yang dapat dipilih -----------------------------------------
  {
    kunci: "hari-putusan",
    label: "Hari Putusan",
    keterangan: "Penanda kuning pada sidang yang hari ini berdiri di hadapan putusannya.",
    kelompok: "penanda",
  },
  {
    kunci: "ikrar-talak",
    label: "Ikrar Talak",
    keterangan: "Penanda biru pada sidang penyaksian ikrar talak.",
    kelompok: "penanda",
  },
  {
    kunci: "potensi-verstek",
    label: "Potensi verstek",
    keterangan: "Penanda kuning bila pada sidang sebelumnya tergugat belum pernah hadir.",
    kelompok: "penanda",
  },
  {
    kunci: "kehadiran",
    label: "Kehadiran pihak",
    keterangan: "Lencana contradictoir dan sebutan siapa yang hadir.",
    kelompok: "penanda",
  },
  // ==========================================================================
  // DUA YANG HANYA HIDUP DI MODE RINGKAS - DAN ITU DISEBUTKAN
  // ==========================================================================
  //
  // Keduanya digambar di dalam baris berkelas `hanya-ringkas`, sebab di mode
  // Lengkap keterangannya sudah punya kolomnya sendiri. Saklarnya karena itu
  // tidak mengubah apa pun selama mode Lengkap yang dipakai - dan mode
  // Lengkap adalah bawaan.
  //
  // Diam soal itu akan membuat orang menekan saklarnya, melihat layarnya tidak
  // berubah, lalu menyimpulkan saklarnya rusak - atau lebih buruk, menyimpulkan
  // seluruh panel ini tidak bekerja.
  //
  // TIDAK disembunyikan dari daftar: yang memakai mode Ringkas - petugas yang
  // membacakan antrian di depan ruang sidang - justru mereka yang paling
  // memerlukan saklarnya.
  {
    kunci: "belum-bas",
    label: "Belum ada BAS",
    keterangan:
      "Penanda berita acara sidang yang belum diunggah. Hanya tampil di mode Ringkas; di Lengkap keterangannya ada di kolom BAS.",
    kelompok: "penanda",
  },
  {
    kunci: "tidak-dipanggil",
    label: "Tidak perlu dipanggil",
    keterangan:
      "Penanda netral bila semua pihak hadir pada sidang sebelumnya. Hanya tampil di mode Ringkas.",
    kelompok: "penanda",
  },

  // --- Keterangan tambahan -------------------------------------------------
  {
    kunci: "petugas",
    label: "Majelis, PP, juru sita, ruang",
    keterangan: "Baris keterangan petugas di bawah nomor perkara.",
    kelompok: "keterangan",
  },
  {
    kunci: "kuasa",
    label: "Kuasa hukum",
    keterangan: "Penanda ada tidaknya kuasa pada tiap sisi.",
    kelompok: "keterangan",
  },
  {
    kunci: "saksi",
    label: "Saksi",
    keterangan: "Jumlah dan nama saksi yang diajukan tiap sisi.",
    kelompok: "keterangan",
  },
  {
    kunci: "jarak-sidang",
    label: "Jeda antar sidang",
    keterangan: "Lencana +menit dari perkara sebelumnya di ruang yang sama.",
    kelompok: "keterangan",
  },

  // ==========================================================================
  // DUA SAKLAR YANG BAWAANNYA MATI - PENGECUALIAN, DAN SEBABNYA DITULIS
  // ==========================================================================
  //
  // Seluruh saklar lain bawaannya MENYALA: layar ini sudah berjalan sebelum
  // saklarnya ada, dan bawaan yang mematikan sesuatu menghilangkan penanda
  // dari layar orang yang tidak pernah meminta apa pun.
  //
  // Kedua ini sebaliknya, atas permintaan pengguna 22 September 2026. Keduanya
  // BUKAN penanda yang hilang - keduanya keterangan yang selama ini SELALU
  // ADA dan tidak pernah dapat disingkirkan:
  //
  //   kolom Siap    memakan satu kolom penuh pada tiap baris, padahal skornya
  //                 hanya dihitung bila tombolnya ditekan;
  //   catatan kaki  kalimat penjelasan yang sama persis pada tiap perkara -
  //                 "Tenggang dihitung dari tanggal panggilan dikirim...",
  //                 "Angka ambang dapat diubah di menu Integrasi e-Court" -
  //                 dibaca sekali seumur hidup pemakainya, lalu dilewati
  //                 selamanya sambil tetap memakan ruang.
  //
  // Yang dimatikan di sini tidak menghilangkan satu pun FAKTA tentang perkara;
  // yang hilang hanya kalimat yang menerangkan cara ALETA menghitung. Itu
  // sebabnya keduanya boleh mati sejak awal, sementara yang lain tidak.
  {
    kunci: "kolom-siap",
    label: "Kolom Siap",
    keterangan:
      "Kolom skor kesiapan beserta kepala kolomnya. Dimatikan sejak awal - skornya hanya dihitung bila tombol Hitung skor ditekan.",
    kelompok: "keterangan",
    bawaanMati: true,
  },
  {
    kunci: "catatan-cara-hitung",
    label: "Catatan cara menghitung",
    keterangan:
      "Kalimat yang menerangkan cara ALETA menghitung - tenggang panggilan, ambang penilaian, dan sejenisnya. Sama pada tiap perkara, dan dibaca sekali seumur hidup.",
    kelompok: "keterangan",
    bawaanMati: true,
  },

  // --- Tombol dan alat -----------------------------------------------------
  {
    kunci: "skor-kesiapan",
    label: "Skor kesiapan",
    keterangan: "Tombol Hitung skor beserta lencana nilainya di tiap baris.",
    kelompok: "alat",
  },
  {
    kunci: "cetak",
    label: "Cetak jadwal",
    keterangan: "Tombol mencetak jadwal yang sedang tampil.",
    kelompok: "alat",
  },
  {
    kunci: "daftar-antrian",
    label: "Daftarkan ke antrian",
    keterangan: "Tombol mendaftarkan perkara ke aplikasi antrian ruang tunggu.",
    kelompok: "alat",
  },
  {
    kunci: "layar-antrian",
    label: "Menu layar antrian",
    keterangan: "Tautan ke layar antrian dan layar panggil.",
    kelompok: "alat",
  },
];

/** Kunci yang tidak dapat dimatikan - dihitung dari daftarnya, bukan didaftar ulang. */
export const SAKLAR_WAJIB: readonly string[] = SAKLAR_TAMPILAN.filter((x) => x.wajib).map(
  (x) => x.kunci
);

export type PilihanTampilan = Record<string, boolean>;

/**
 * Bawaan: SEMUANYA menyala.
 *
 * Layar ini sudah berjalan sebelum saklarnya ada, dan bawaan yang mematikan
 * sesuatu akan menghilangkan penanda dari layar orang yang tidak pernah
 * meminta apa pun - perubahan yang tidak diminta dan tidak diumumkan.
 */
export function tampilanBawaan(): PilihanTampilan {
  const hasil: PilihanTampilan = {};
  for (const saklar of SAKLAR_TAMPILAN) hasil[saklar.kunci] = !saklar.bawaanMati;
  return hasil;
}

/**
 * Apakah satu bagian layar digambar.
 *
 * Yang wajib selalu benar - tanpa melihat simpanannya sama sekali. Simpanan
 * peramban dapat disunting orang lewat DevTools, dan sebuah nilai `false` yang
 * tersimpan di sana tidak boleh cukup untuk memadamkan penanda retur.
 */
export function tampil(pilihan: PilihanTampilan | undefined, kunci: string): boolean {
  if (SAKLAR_WAJIB.includes(kunci)) return true;
  if (!pilihan) return true;
  const nilai = pilihan[kunci];
  if (nilai !== undefined) return nilai;
  // Yang belum pernah disimpan memakai bawaannya - menyala bagi hampir
  // semuanya, mati bagi dua yang ditandai bawaanMati. Lihat tampilanBawaan.
  //
  // Dibaca dari daftarnya, bukan dikembalikan true begitu saja: simpanan yang
  // ditulis versi sebelum kedua saklar itu ada tidak memuat kuncinya, dan
  // mengembalikan true akan menyalakan keduanya bagi seluruh pemakai lama -
  // yaitu kebalikan dari yang diminta.
  return !SAKLAR_TAMPILAN.find((x) => x.kunci === kunci)?.bawaanMati;
}

/**
 * Membaca simpanan peramban menjadi pilihan yang sah.
 *
 * Yang tidak dikenali dibuang, bukan dipercaya: simpanan dapat berasal dari
 * versi lama atau dari suntingan tangan, dan ruas asing yang lolos akan
 * menumpuk tanpa pernah terpakai.
 */
export function bacaTampilan(mentah: string | null): PilihanTampilan {
  const hasil = tampilanBawaan();
  if (!mentah) return hasil;
  let urai: unknown;
  try {
    urai = JSON.parse(mentah);
  } catch {
    return hasil;
  }
  if (!urai || typeof urai !== "object" || Array.isArray(urai)) return hasil;
  const isi = urai as Record<string, unknown>;
  for (const saklar of SAKLAR_TAMPILAN) {
    if (saklar.wajib) continue;
    const nilai = isi[saklar.kunci];
    if (typeof nilai === "boolean") hasil[saklar.kunci] = nilai;
  }
  return hasil;
}

/** Berapa banyak yang sedang dimatikan - untuk lencana kecil pada tombolnya. */
export function jumlahDimatikan(pilihan: PilihanTampilan): number {
  // Yang BAWAANNYA memang mati tidak dihitung sebagai "dimatikan orang" -
  // angka pada tombol menyatakan berapa yang disingkirkan dari keadaan
  // biasanya, dan menghitung bawaan membuatnya berbunyi 2 pada layar yang
  // belum pernah disentuh siapa pun.
  return SAKLAR_TAMPILAN.filter(
    (x) => !x.wajib && !x.bawaanMati && pilihan[x.kunci] === false
  ).length;
}

/** Kelompok beserta anggotanya, untuk digambar panel saklarnya. */
export function kelompokTampilan() {
  return KELOMPOK_TAMPILAN.map((kelompok) => ({
    ...kelompok,
    anggota: SAKLAR_TAMPILAN.filter((x) => x.kelompok === kelompok.kunci),
  }));
}

export const KUNCI_SIMPANAN_TAMPILAN = "aleta.jadwal-sidang.tampilan";
