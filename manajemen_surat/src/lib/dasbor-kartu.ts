/**
 * Katalog kartu dasbor - satu daftar, dipakai dasbor dan layar pengaturannya.
 *
 * ============================================================================
 * KENAPA DAFTARNYA DIPISAH DARI YANG MENGGAMBARNYA
 * ============================================================================
 *
 * Susunan bawaan disusun Super Admin pada layar yang TIDAK menggambar kartu
 * yang sesungguhnya - kartu dasbor memuat angka dari ratusan baris surat, dan
 * halaman pengaturan tidak punya urusan menghitungnya. Yang digambar di sana
 * keping bernama.
 *
 * Karena itu nama dan kuncinya harus datang dari satu tempat. Kalau tidak,
 * kunci yang berubah di dasbor akan membuat layar pengaturan menyusun sesuatu
 * yang tidak ada - dan hasilnya tersimpan, terbaca sah, lalu diabaikan diam-
 * diam oleh dasbor karena kuncinya tidak dikenal.
 *
 * Ada uji yang membandingkan daftar ini dengan kunci yang benar-benar dipakai
 * berkas dasbornya.
 */
export type KartuDasbor = {
  kunci: string;
  judul: string;
  keterangan: string;
  /** Hanya tampil bagi peran tertentu; disebut supaya Super Admin tahu. */
  terbatas?: string;
};

export const ZONA_DASBOR: { zona: string; nama: string; keterangan: string; kartu: KartuDasbor[] }[] = [
  {
    zona: "ringkasan",
    nama: "Kartu ringkasan",
    keterangan: "Baris angka paling atas. Urutannya menentukan mana yang terbaca lebih dulu tiap pagi.",
    kartu: [
      {
        kunci: "disposisi-terlambat",
        judul: "Disposisi Terlambat",
        keterangan: "Satu-satunya kartu yang menyatakan ada yang KELIRU, bukan sekadar belum selesai.",
      },
      {
        kunci: "tugas-masuk",
        judul: "Tugas Masuk",
        keterangan: "Yang harus dikerjakan hari ini, oleh orang yang membukanya.",
      },
      {
        kunci: "surat-masuk",
        judul: "Surat Masuk (Total)",
        keterangan: "Jumlah yang perlu diketahui; tidak menuntut perbuatan apa pun.",
      },
      {
        kunci: "surat-keluar",
        judul: "Surat Keluar (Total)",
        keterangan: "Paling jarang menjadi sebab seseorang membuka dasbor.",
      },
    ],
  },
  {
    zona: "panel",
    nama: "Panel besar",
    keterangan: "Kolom di bawah kartu angka. Zona terpisah supaya kartu angka tidak meregang setinggi layar.",
    kartu: [
      {
        kunci: "tugas-penting",
        judul: "Tugas Penting",
        keterangan: "Daftar surat yang menunggu tindak lanjut, beserta tombolnya.",
      },
      {
        kunci: "aktivitas-terbaru",
        judul: "Aktivitas Terbaru",
        keterangan: "Riwayat disposisi; menjawab apa yang sudah terjadi, bukan apa yang harus dikerjakan.",
      },
      {
        kunci: "whatsapp",
        judul: "Ringkasan WhatsApp",
        keterangan: "Perkakas infrastruktur, bukan keterangan perkara.",
        terbatas: "Hanya Super Admin",
      },
    ],
  },
];

/** Seluruh kunci yang dikenal, untuk pemeriksaan. */
export const KUNCI_KARTU_DASBOR = ZONA_DASBOR.flatMap((z) => z.kartu.map((k) => k.kunci));

/**
 * ============================================================================
 * PORTAL - HALAMAN PERTAMA YANG DILIHAT SETIAP ORANG
 * ============================================================================
 *
 * Dasbor Manajemen Surat hanya dibuka orang yang mengurus surat. Portal dibuka
 * SEMUA orang, tiap kali masuk, dan isinya paling berbeda-beda kepentingannya:
 * jurusita menuju relaas, kasir menuju keuangan, panitera menuju perkara. Di
 * sinilah menyusun sendiri paling berguna.
 *
 * Dua zona, dan pemisahannya disengaja:
 *
 *   portal-utama     tiga kartu besar - bagian mana yang lebih dulu dibaca
 *   portal-aplikasi  ubin aplikasi DI DALAM kartu menu - aplikasi mana yang
 *                    lebih dulu dijangkau
 *
 * Kalau keduanya dijadikan satu zona, sebuah ubin aplikasi dapat mendarat di
 * antara kartu besar dan meregang selebar halaman - susunan yang dapat dibuat
 * pengguna tetapi tidak pernah diinginkannya.
 */
export const ZONA_PORTAL: { zona: string; nama: string; keterangan: string; kartu: KartuDasbor[] }[] = [
  {
    zona: "portal-utama",
    nama: "Kartu portal",
    keterangan: "Tiga kartu besar di halaman Menu Kerja. Urutannya menentukan apa yang terbaca lebih dulu tiap kali masuk.",
    kartu: [
      {
        kunci: "ringkasan-kerja",
        judul: "Ringkasan Kerja",
        keterangan: "Angka keadaan hari ini beserta tindakan cepatnya.",
        terbatas: "Hanya Super Admin",
      },
      {
        kunci: "menu-aplikasi",
        judul: "Aplikasi yang Bisa Dibuka",
        keterangan: "Pintu ke seluruh aplikasi ALETA. Yang paling sering dituju kebanyakan orang.",
      },
      {
        kunci: "tugas-penting",
        judul: "Tugas Penting",
        keterangan: "Tugas dan pemberitahuan yang menunggu, dengan tautan langsung ke tiap butirnya.",
      },
    ],
  },
];

export const KUNCI_KARTU_PORTAL = ZONA_PORTAL.flatMap((z) => z.kartu.map((k) => k.kunci));

/**
 * Halaman yang susunan bawaannya dapat disetel Super Admin.
 *
 * Zona ubin aplikasi TIDAK ada di sini, dan itu keputusan: daftar aplikasinya
 * berbeda menurut peran dan hak akses tiap orang, sehingga keping bernama di
 * layar pengaturan tidak akan mewakili apa yang sesungguhnya dilihat pegawai.
 * Ubin aplikasi tetap dapat disusun tiap orang pada halaman portalnya sendiri.
 */
export const HALAMAN_DASBOR: {
  halaman: string;
  nama: string;
  keterangan: string;
  zona: { zona: string; nama: string; keterangan: string; kartu: KartuDasbor[] }[];
}[] = [
  {
    halaman: "manajemen-surat",
    nama: "Dasbor Manajemen Surat",
    keterangan: "Dibuka petugas yang mengurus surat masuk, surat keluar, dan disposisi.",
    zona: ZONA_DASBOR,
  },
  {
    halaman: "portal",
    nama: "Portal - Menu Kerja",
    keterangan: "Halaman pertama sesudah masuk. Dilihat seluruh pegawai, apa pun jabatannya.",
    zona: ZONA_PORTAL,
  },
];
