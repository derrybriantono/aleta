/**
 * ============================================================================
 * DAFTAR FITUR EKSTENSI - CERMIN ekstensi-sipp/daftar-fitur.js
 * ============================================================================
 *
 * Seratus dua puluh kode ide ekstensi ("<bagian>-<nomor>") beserta judulnya,
 * dipakai portal untuk halaman Tampilan ekstensi dan untuk membuang kode yang
 * tidak dikenal sebelum disimpan atau dikirim ke ekstensi.
 *
 * Sumbernya berkas ekstensi; berkas ini SALINANNYA. Disusun oleh
 * D:/aleta-dev/kerja/tahap5/buat-daftar-fitur-ts.mjs - jangan menyunting
 * butirnya dengan tangan. src/test/daftar-fitur-ekstensi.test.ts menjalankan
 * berkas ekstensi dan membandingkannya butir demi butir dengan daftar ini,
 * sehingga keduanya tidak dapat berselisih tanpa uji menjadi merah.
 */

export type BagianFiturEkstensi = "sipp" | "abt" | "portal" | "popup";

export type FiturEkstensi = {
  kode: string;
  bagian: BagianFiturEkstensi;
  nomor: number;
  jenis: "upgrade" | "baru";
  judul: string;
  perluKeputusan: boolean;
};

export const BAGIAN_FITUR_EKSTENSI: Readonly<Record<BagianFiturEkstensi, string>> = {
  "sipp": "Panel di SIPP",
  "abt": "Panel di ABT",
  "portal": "Panel di portal ALETA",
  "popup": "Popup dan widget",
};

export const DAFTAR_FITUR_EKSTENSI: readonly FiturEkstensi[] = [
  { kode: "sipp-1", bagian: "sipp", nomor: 1, jenis: "upgrade", judul: "Ringkasan \"Langkah berikutnya\"", perluKeputusan: false },
  { kode: "sipp-2", bagian: "sipp", nomor: 2, jenis: "upgrade", judul: "Daftar isi lengket dengan lencana", perluKeputusan: false },
  { kode: "sipp-3", bagian: "sipp", nomor: 3, jenis: "upgrade", judul: "Beban hakim sebagai bilah", perluKeputusan: false },
  { kode: "sipp-4", bagian: "sipp", nomor: 4, jenis: "upgrade", judul: "Giliran juru sita dengan kalimat ramah", perluKeputusan: false },
  { kode: "sipp-5", bagian: "sipp", nomor: 5, jenis: "upgrade", judul: "Rencana penulisan tampil sebelum menekan", perluKeputusan: false },
  { kode: "sipp-6", bagian: "sipp", nomor: 6, jenis: "upgrade", judul: "Pertimbangan dan amar tampil rapi", perluKeputusan: false },
  { kode: "sipp-7", bagian: "sipp", nomor: 7, jenis: "upgrade", judul: "Praperiksa dengan tombol tindakan", perluKeputusan: false },
  { kode: "sipp-8", bagian: "sipp", nomor: 8, jenis: "upgrade", judul: "Penilaian SK dikelompokkan", perluKeputusan: false },
  { kode: "sipp-9", bagian: "sipp", nomor: 9, jenis: "upgrade", judul: "Tarik berkas KTP dari barisnya", perluKeputusan: false },
  { kode: "sipp-10", bagian: "sipp", nomor: 10, jenis: "upgrade", judul: "Peta Kolom Formulir disembunyikan", perluKeputusan: false },
  { kode: "sipp-11", bagian: "sipp", nomor: 11, jenis: "baru", judul: "Kotak cari di dalam panel", perluKeputusan: false },
  { kode: "sipp-12", bagian: "sipp", nomor: 12, jenis: "baru", judul: "Mode Ringkas / Lengkap yang diingat", perluKeputusan: false },
  { kode: "sipp-13", bagian: "sipp", nomor: 13, jenis: "baru", judul: "Catatan internal perkara", perluKeputusan: false },
  { kode: "sipp-14", bagian: "sipp", nomor: 14, jenis: "baru", judul: "Pengingat tenggat dengan hitungan hari", perluKeputusan: true },
  { kode: "sipp-15", bagian: "sipp", nomor: 15, jenis: "baru", judul: "Riwayat perubahan data SIPP", perluKeputusan: false },
  { kode: "sipp-16", bagian: "sipp", nomor: 16, jenis: "baru", judul: "Tombol \"Buka di ALETA\"", perluKeputusan: false },
  { kode: "sipp-17", bagian: "sipp", nomor: 17, jenis: "baru", judul: "Salin cepat sekali klik", perluKeputusan: false },
  { kode: "sipp-18", bagian: "sipp", nomor: 18, jenis: "baru", judul: "Mode fokus dua kolom", perluKeputusan: false },
  { kode: "sipp-19", bagian: "sipp", nomor: 19, jenis: "baru", judul: "Pembanding versi draf putusan", perluKeputusan: false },
  { kode: "sipp-20", bagian: "sipp", nomor: 20, jenis: "baru", judul: "Pemeriksa ejaan dan nama pihak", perluKeputusan: false },
  { kode: "sipp-21", bagian: "sipp", nomor: 21, jenis: "baru", judul: "\"Perkara berikutnya\"", perluKeputusan: true },
  { kode: "sipp-22", bagian: "sipp", nomor: 22, jenis: "baru", judul: "Kartu bantuan pintasan", perluKeputusan: false },
  { kode: "sipp-23", bagian: "sipp", nomor: 23, jenis: "baru", judul: "Lampu sambungan SIPP / ALETA / e-Court", perluKeputusan: false },
  { kode: "sipp-24", bagian: "sipp", nomor: 24, jenis: "baru", judul: "Panel mengikuti tab SIPP", perluKeputusan: false },
  { kode: "sipp-25", bagian: "sipp", nomor: 25, jenis: "baru", judul: "Kabar perubahan oleh petugas lain", perluKeputusan: false },
  { kode: "sipp-26", bagian: "sipp", nomor: 26, jenis: "baru", judul: "Sisa panjar dan perkiraan biaya", perluKeputusan: true },
  { kode: "sipp-27", bagian: "sipp", nomor: 27, jenis: "baru", judul: "Templat pertimbangan per status putusan", perluKeputusan: true },
  { kode: "sipp-28", bagian: "sipp", nomor: 28, jenis: "baru", judul: "Mode latihan untuk petugas baru", perluKeputusan: true },
  { kode: "sipp-29", bagian: "sipp", nomor: 29, jenis: "baru", judul: "Kirim ke hakim untuk acc", perluKeputusan: true },
  { kode: "sipp-30", bagian: "sipp", nomor: 30, jenis: "baru", judul: "Laporkan masalah sekali klik", perluKeputusan: true },
  { kode: "abt-1", bagian: "abt", nomor: 1, jenis: "upgrade", judul: "Pesan status yang ramah", perluKeputusan: false },
  { kode: "abt-2", bagian: "abt", nomor: 2, jenis: "upgrade", judul: "Variabel tak berlaku dilipat jadi satu", perluKeputusan: false },
  { kode: "abt-3", bagian: "abt", nomor: 3, jenis: "upgrade", judul: "Kotak centang unggah yang rapi", perluKeputusan: false },
  { kode: "abt-4", bagian: "abt", nomor: 4, jenis: "upgrade", judul: "Lencana keyakinan menjadi saringan", perluKeputusan: false },
  { kode: "abt-5", bagian: "abt", nomor: 5, jenis: "upgrade", judul: "Peringatan huruf G di paling atas", perluKeputusan: true },
  { kode: "abt-6", bagian: "abt", nomor: 6, jenis: "upgrade", judul: "Tombol cepat untuk alasan yang belum terbukti", perluKeputusan: false },
  { kode: "abt-7", bagian: "abt", nomor: 7, jenis: "upgrade", judul: "Beda jawaban saksi disorot", perluKeputusan: false },
  { kode: "abt-8", bagian: "abt", nomor: 8, jenis: "upgrade", judul: "Alasan dikelompokkan", perluKeputusan: false },
  { kode: "abt-9", bagian: "abt", nomor: 9, jenis: "upgrade", judul: "Riwayat per variabel dengan tombol pulihkan", perluKeputusan: false },
  { kode: "abt-10", bagian: "abt", nomor: 10, jenis: "upgrade", judul: "Lima tombol menjadi langkah bernomor", perluKeputusan: false },
  { kode: "abt-11", bagian: "abt", nomor: 11, jenis: "baru", judul: "Bilah kemajuan variabel", perluKeputusan: false },
  { kode: "abt-12", bagian: "abt", nomor: 12, jenis: "baru", judul: "Pratinjau putusan jadi", perluKeputusan: false },
  { kode: "abt-13", bagian: "abt", nomor: 13, jenis: "baru", judul: "Pemeriksa konsistensi", perluKeputusan: false },
  { kode: "abt-14", bagian: "abt", nomor: 14, jenis: "baru", judul: "Salin dari perkara serupa", perluKeputusan: true },
  { kode: "abt-15", bagian: "abt", nomor: 15, jenis: "baru", judul: "Pembuat varian kalimat", perluKeputusan: false },
  { kode: "abt-16", bagian: "abt", nomor: 16, jenis: "baru", judul: "Mode sidang", perluKeputusan: false },
  { kode: "abt-17", bagian: "abt", nomor: 17, jenis: "baru", judul: "Daftar wajib sebelum CETAK", perluKeputusan: true },
  { kode: "abt-18", bagian: "abt", nomor: 18, jenis: "baru", judul: "Tanda \"sudah diperiksa hakim\"", perluKeputusan: true },
  { kode: "abt-19", bagian: "abt", nomor: 19, jenis: "baru", judul: "Perkara sebelumnya pihak yang sama", perluKeputusan: false },
  { kode: "abt-20", bagian: "abt", nomor: 20, jenis: "baru", judul: "Kirim keterangan saksi ke BAS SIPP", perluKeputusan: true },
  { kode: "abt-21", bagian: "abt", nomor: 21, jenis: "baru", judul: "Kotak cari variabel", perluKeputusan: false },
  { kode: "abt-22", bagian: "abt", nomor: 22, jenis: "baru", judul: "Variabel favorit disematkan", perluKeputusan: false },
  { kode: "abt-23", bagian: "abt", nomor: 23, jenis: "baru", judul: "Urungkan dan ulangi", perluKeputusan: false },
  { kode: "abt-24", bagian: "abt", nomor: 24, jenis: "baru", judul: "Perkiraan panjang putusan", perluKeputusan: false },
  { kode: "abt-25", bagian: "abt", nomor: 25, jenis: "baru", judul: "Mode baca untuk hakim", perluKeputusan: false },
  { kode: "abt-26", bagian: "abt", nomor: 26, jenis: "baru", judul: "Pemeriksa anonimisasi", perluKeputusan: true },
  { kode: "abt-27", bagian: "abt", nomor: 27, jenis: "baru", judul: "Saran dasar hukum per huruf alasan", perluKeputusan: true },
  { kode: "abt-28", bagian: "abt", nomor: 28, jenis: "baru", judul: "Templat pertanyaan pribadi", perluKeputusan: false },
  { kode: "abt-29", bagian: "abt", nomor: 29, jenis: "baru", judul: "Simpan draf otomatis", perluKeputusan: false },
  { kode: "abt-30", bagian: "abt", nomor: 30, jenis: "baru", judul: "Ringkasan musyawarah majelis", perluKeputusan: false },
  { kode: "portal-1", bagian: "portal", nomor: 1, jenis: "upgrade", judul: "Ekstensi: \"Terbaru ✓\" dan apa yang baru", perluKeputusan: false },
  { kode: "portal-2", bagian: "portal", nomor: 2, jenis: "upgrade", judul: "Kembali ke SIPP yang lebih berisi", perluKeputusan: false },
  { kode: "portal-3", bagian: "portal", nomor: 3, jenis: "upgrade", judul: "Buka SIPP / ABT langsung ke perkara", perluKeputusan: false },
  { kode: "portal-4", bagian: "portal", nomor: 4, jenis: "upgrade", judul: "Pintasan Super Admin yang bisa diatur", perluKeputusan: true },
  { kode: "portal-5", bagian: "portal", nomor: 5, jenis: "upgrade", judul: "Kewenangan dikelompokkan", perluKeputusan: true },
  { kode: "portal-6", bagian: "portal", nomor: 6, jenis: "upgrade", judul: "Ikon kepala panel berlabel", perluKeputusan: false },
  { kode: "portal-7", bagian: "portal", nomor: 7, jenis: "upgrade", judul: "Lencana SERVER yang bercerita", perluKeputusan: false },
  { kode: "portal-8", bagian: "portal", nomor: 8, jenis: "upgrade", judul: "Panel tidak menutupi tabel", perluKeputusan: true },
  { kode: "portal-9", bagian: "portal", nomor: 9, jenis: "upgrade", judul: "Pratinjau catatan pembaruan", perluKeputusan: false },
  { kode: "portal-10", bagian: "portal", nomor: 10, jenis: "upgrade", judul: "Kotak cari di Kembali ke SIPP", perluKeputusan: false },
  { kode: "portal-11", bagian: "portal", nomor: 11, jenis: "baru", judul: "Tugas saya hari ini", perluKeputusan: false },
  { kode: "portal-12", bagian: "portal", nomor: 12, jenis: "baru", judul: "Lonceng portal di panel", perluKeputusan: false },
  { kode: "portal-13", bagian: "portal", nomor: 13, jenis: "baru", judul: "Cari perkara dari panel", perluKeputusan: false },
  { kode: "portal-14", bagian: "portal", nomor: 14, jenis: "baru", judul: "Lampu sambungan", perluKeputusan: false },
  { kode: "portal-15", bagian: "portal", nomor: 15, jenis: "baru", judul: "Tema per situs", perluKeputusan: false },
  { kode: "portal-16", bagian: "portal", nomor: 16, jenis: "baru", judul: "Ganti peran cepat", perluKeputusan: false },
  { kode: "portal-17", bagian: "portal", nomor: 17, jenis: "baru", judul: "Lapor masalah dari panel", perluKeputusan: false },
  { kode: "portal-18", bagian: "portal", nomor: 18, jenis: "baru", judul: "Tur singkat", perluKeputusan: false },
  { kode: "portal-19", bagian: "portal", nomor: 19, jenis: "baru", judul: "Riwayat tulisan saya ke SIPP", perluKeputusan: false },
  { kode: "portal-20", bagian: "portal", nomor: 20, jenis: "baru", judul: "Statistik pribadi mingguan", perluKeputusan: false },
  { kode: "portal-21", bagian: "portal", nomor: 21, jenis: "baru", judul: "Pengaturan pemberitahuan pribadi", perluKeputusan: false },
  { kode: "portal-22", bagian: "portal", nomor: 22, jenis: "baru", judul: "Salin tautan perkara", perluKeputusan: false },
  { kode: "portal-23", bagian: "portal", nomor: 23, jenis: "baru", judul: "Jadwal sidang saya (mini)", perluKeputusan: false },
  { kode: "portal-24", bagian: "portal", nomor: 24, jenis: "baru", judul: "Peringatan versi beda antar PC", perluKeputusan: false },
  { kode: "portal-25", bagian: "portal", nomor: 25, jenis: "baru", judul: "Unduhan terakhir", perluKeputusan: false },
  { kode: "portal-26", bagian: "portal", nomor: 26, jenis: "baru", judul: "Catatan tempel pribadi", perluKeputusan: false },
  { kode: "portal-27", bagian: "portal", nomor: 27, jenis: "baru", judul: "Daftar pintasan keyboard", perluKeputusan: false },
  { kode: "portal-28", bagian: "portal", nomor: 28, jenis: "baru", judul: "Mode layar publik", perluKeputusan: false },
  { kode: "portal-29", bagian: "portal", nomor: 29, jenis: "baru", judul: "Diagnosa ekstensi sekali klik", perluKeputusan: false },
  { kode: "portal-30", bagian: "portal", nomor: 30, jenis: "baru", judul: "Sinkron pengaturan antar PC", perluKeputusan: false },
  { kode: "popup-1", bagian: "popup", nomor: 1, jenis: "upgrade", judul: "Keterangan saklar diringkas", perluKeputusan: false },
  { kode: "popup-2", bagian: "popup", nomor: 2, jenis: "upgrade", judul: "Lampu sambungan per situs", perluKeputusan: false },
  { kode: "popup-3", bagian: "popup", nomor: 3, jenis: "upgrade", judul: "Saklar dikelompokkan", perluKeputusan: false },
  { kode: "popup-4", bagian: "popup", nomor: 4, jenis: "upgrade", judul: "Penggeser ukuran huruf", perluKeputusan: false },
  { kode: "popup-5", bagian: "popup", nomor: 5, jenis: "upgrade", judul: "Tiga pilihan tema dengan contoh", perluKeputusan: false },
  { kode: "popup-6", bagian: "popup", nomor: 6, jenis: "upgrade", judul: "Angka checklist di lencana dan ikon", perluKeputusan: false },
  { kode: "popup-7", bagian: "popup", nomor: 7, jenis: "upgrade", judul: "Tandai selesai dan Tunda 1 hari", perluKeputusan: true },
  { kode: "popup-8", bagian: "popup", nomor: 8, jenis: "upgrade", judul: "Lencana logo yang memberi kabar", perluKeputusan: false },
  { kode: "popup-9", bagian: "popup", nomor: 9, jenis: "upgrade", judul: "Menempel ke sudut terdekat", perluKeputusan: false },
  { kode: "popup-10", bagian: "popup", nomor: 10, jenis: "upgrade", judul: "Versi, pembaruan, dan yang baru", perluKeputusan: false },
  { kode: "popup-11", bagian: "popup", nomor: 11, jenis: "baru", judul: "Profil saklar per peran", perluKeputusan: false },
  { kode: "popup-12", bagian: "popup", nomor: 12, jenis: "baru", judul: "Mode senyap 1 jam", perluKeputusan: false },
  { kode: "popup-13", bagian: "popup", nomor: 13, jenis: "baru", judul: "Kembalikan posisi panel dan widget", perluKeputusan: false },
  { kode: "popup-14", bagian: "popup", nomor: 14, jenis: "baru", judul: "Ekspor dan impor pengaturan", perluKeputusan: false },
  { kode: "popup-15", bagian: "popup", nomor: 15, jenis: "baru", judul: "Kotak cari saklar", perluKeputusan: false },
  { kode: "popup-16", bagian: "popup", nomor: 16, jenis: "baru", judul: "Atur pintasan keyboard", perluKeputusan: false },
  { kode: "popup-17", bagian: "popup", nomor: 17, jenis: "baru", judul: "Widget \"Jadwal sidang saya hari ini\"", perluKeputusan: false },
  { kode: "popup-18", bagian: "popup", nomor: 18, jenis: "baru", judul: "Widget antrean untuk PP", perluKeputusan: false },
  { kode: "popup-19", bagian: "popup", nomor: 19, jenis: "baru", judul: "Widget WhatsApp perlu dibalas", perluKeputusan: false },
  { kode: "popup-20", bagian: "popup", nomor: 20, jenis: "baru", judul: "Widget catatan cepat", perluKeputusan: false },
  { kode: "popup-21", bagian: "popup", nomor: 21, jenis: "baru", judul: "Penghitung lama sidang berjalan", perluKeputusan: false },
  { kode: "popup-22", bagian: "popup", nomor: 22, jenis: "baru", judul: "Widget kalender tenggat", perluKeputusan: false },
  { kode: "popup-23", bagian: "popup", nomor: 23, jenis: "baru", judul: "Dok widget", perluKeputusan: false },
  { kode: "popup-24", bagian: "popup", nomor: 24, jenis: "baru", judul: "Widget di jendela terpisah", perluKeputusan: false },
  { kode: "popup-25", bagian: "popup", nomor: 25, jenis: "baru", judul: "Laporkan masalah", perluKeputusan: false },
  { kode: "popup-26", bagian: "popup", nomor: 26, jenis: "baru", judul: "Tanda \"BARU\" sekali tampil", perluKeputusan: false },
  { kode: "popup-27", bagian: "popup", nomor: 27, jenis: "baru", judul: "Batas situs yang terlihat", perluKeputusan: false },
  { kode: "popup-28", bagian: "popup", nomor: 28, jenis: "baru", judul: "Statistik penggunaan pribadi", perluKeputusan: true },
  { kode: "popup-29", bagian: "popup", nomor: 29, jenis: "baru", judul: "Panduan singkat per saklar", perluKeputusan: false },
  { kode: "popup-30", bagian: "popup", nomor: 30, jenis: "baru", judul: "Mode aksesibilitas", perluKeputusan: false },
];

/** Kode yang dikenal - dipakai membuang kode asing sebelum disimpan dan dikirim. */
export const KODE_FITUR_EKSTENSI: ReadonlySet<string> = new Set(DAFTAR_FITUR_EKSTENSI.map((f) => f.kode));
