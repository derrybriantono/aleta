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
