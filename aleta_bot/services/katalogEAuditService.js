"use strict";

/**
 * ============================================================================
 * KATALOG ALETA e-AUDIT - SERATUS DELAPAN PULUH LIMA BUTIR
 * ============================================================================
 *
 * Katalog ini DAFTAR, bukan mesin. Ia menyatakan butir apa saja yang hendak
 * dinilai; yang menghitungnya kerangkaPenilaianService, dan tiap butir baru
 * benar-benar hidup ketika sebuah penilaian didaftarkan untuknya.
 *
 * ============================================================================
 * MENGAPA DAFTARNYA DIPISAH DARI MESINNYA
 * ============================================================================
 *
 * Kalau daftarnya sama dengan yang terdaftar di mesin, maka yang belum
 * dikerjakan menjadi tidak terlihat - dan aplikasi tampak selesai padahal
 * baru sebagian. Dengan memisahkannya, sisa pekerjaan dapat DIHITUNG:
 * berapa butir yang sudah tersambung, berapa sebagian, berapa belum.
 *
 * Angka itu tidak ditulis tangan di mana pun. Ia dihitung dari selisih antara
 * daftar ini dan daftar penilaian yang benar-benar terdaftar, sehingga tidak
 * mungkin usang.
 *
 * ============================================================================
 * "SEBAGIAN" ADALAH KEADAAN YANG SAH, DAN HARUS DAPAT DINYATAKAN
 * ============================================================================
 *
 * Sebagian penilaian yang sudah dibangun mengukur hal yang MIRIP dengan butir
 * katalog, tetapi tidak sama. Contohnya KT10 menuntut jarak waktu antara
 * sidang dan selesainya berita acara, sedangkan yang sudah dibangun baru
 * memeriksa keberadaannya.
 *
 * Menandainya "sudah" akan berbohong; menandainya "belum" akan membuang
 * pekerjaan yang sudah ada. Karena itu ada keadaan ketiga - "sebagian" -
 * beserta catatan yang menyebutkan apa yang masih kurang. Catatan itu wajib;
 * sambungan sebagian tanpa catatan ditolak.
 */

/** Kedua belas bab, urut. */
const BAB = [
  { no: 1, nama: "Mesin Penilaian" },
  { no: 2, nama: "Pengawasan Mutu dan Integritas Data" },
  { no: 3, nama: "Ketaatan Tahapan dan Tenggang Waktu" },
  { no: 4, nama: "Laporan Perkara (LIPA 1-22)" },
  { no: 5, nama: "Register dan Buku Kepaniteraan" },
  { no: 6, nama: "Beban Kerja dan Pemerataan" },
  { no: 7, nama: "Rapor Kinerja Aparatur" },
  { no: 8, nama: "Keuangan Perkara" },
  { no: 9, nama: "Statistik Perkara dan Para Pihak" },
  { no: 10, nama: "Mutu Putusan dan Persidangan" },
  { no: 11, nama: "Pelayanan kepada Pencari Keadilan" },
  { no: 12, nama: "Metode Analisis dan Pengujian" },
];

/**
 * Arti huruf bentuk sajian. Satu butir dapat membawa beberapa huruf sekaligus,
 * misalnya "NTBGR" berarti angka pokok, tabel rincian, diagram batang, diagram
 * garis, dan kesimpulan.
 */
const BENTUK = {
  N: "Angka pokok",
  T: "Tabel rincian",
  R: "Kesimpulan",
  B: "Diagram batang",
  G: "Diagram garis",
  A: "Diagram area",
  S: "Diagram sebar",
  P: "Diagram pai",
  K: "Peta kendali",
  L: "Bentuk resmi",
};

/**
 * Dari mana angka butir ini berasal - dan inilah yang menentukan urutan
 * pengerjaannya, bukan nomor babnya.
 */
const MUTU_RUAS = {
  kode: "Membaca ruas berkode di SIPP - dapat dikerjakan berkelompok dengan pola yang sama",
  hitung: "Dihitung dari beberapa ruas sekaligus - menuntut rancangan sendiri",
  bebas: "Bertumpu pada ruas yang diketik bebas - menuntut pembakuan lebih dahulu, dan sebagian mungkin tidak layak dinilai",
};

const LANTAI_SAH = new Set(["harian", "bulanan"]);

/**
 * Butir yang memang TIDAK punya satuan baris, beserta sebabnya.
 *
 * Satuan baris menjawab "satu baris bukti itu apa" - satu perkara, satu
 * pegawai, satu bulan. Butir yang bukan pengukuran tidak punya jawaban untuk
 * itu, dan memaksakan satu hanya akan menghasilkan jawaban karangan.
 *
 * Daftarnya sengaja pendek dan bernalar. Butir baru yang lupa mengisi satuan
 * barisnya akan digagalkan penjaga, bukan diam-diam diterima.
 */
const TANPA_SATUAN_BARIS = {
  MT15: "Bukan pengukuran melainkan alat tanya jawab atas data. Ia tidak menghasilkan angka berpenyebut, sehingga tidak ada yang dapat disebut sebagai satu baris buktinya.",
};

/** Seratus delapan puluh lima butir, disalin dari katalog prototipe. */
const KATALOG = [
  { kode: "MS01", bab: 1, nama: "Mesin Periode Tujuh Jendela",
    bentuk: "TR", satuanBaris: "periode", mutuRuas: "hitung", lantai: "harian",
    keterangan: "Satu butir penilaian ditulis sekali sebagai fungsi berparameter tanggal, lalu dilihat dari tujuh jendela waktu." },
  { kode: "MS02", bab: 1, nama: "Rapor Berjenjang Perkara sampai Pengadilan",
    bentuk: "NTBAR", satuanBaris: "jenjang", mutuRuas: "kode", lantai: "harian",
    keterangan: "Nilai yang sama ditumpuk empat tingkat: perkara, aparatur, satuan kerja, dan pengadilan." },
  { kode: "MS03", bab: 1, nama: "Riwayat Nilai Tersimpan",
    bentuk: "NTGK", satuanBaris: "bulan", mutuRuas: "hitung", lantai: "harian",
    keterangan: "Nilai disimpan tiap periode beserta aturan yang berlaku saat itu, bukan dihitung ulang setiap dibuka." },
  { kode: "MS04", bab: 1, nama: "Daftar Bukti di Balik Setiap Angka",
    bentuk: "NTR", satuanBaris: "perkara", mutuRuas: "hitung", lantai: "harian",
    keterangan: "Setiap angka dapat dibuka menjadi daftar perkara penyusunnya." },
  { kode: "MS05", bab: 1, nama: "Pembatas Kecukupan Penyebut",
    bentuk: "NTR", satuanBaris: "pegawai", mutuRuas: "hitung", lantai: "harian",
    keterangan: "Nilai hanya tampil bila penyebutnya sekurang-kurangnya dua puluh; di bawah itu yang tampil daftarnya." },
  { kode: "MS06", bab: 1, nama: "Berkas Pengawasan Siap Kirim",
    bentuk: "LTR", satuanBaris: "lipa", mutuRuas: "kode", lantai: "harian",
    keterangan: "Nilai, temuan, bukti, dan tanggal hitung dalam satu berkas siap dikirim kepada pengawas." },
  { kode: "IN01", bab: 2, nama: "Perubahan Putusan Setelah Minutasi",
    bentuk: "NTBGR", satuanBaris: "pegawai", mutuRuas: "kode", lantai: "harian",
    keterangan: "Putusan yang diubah setelah berkas diminutasi." },
  { kode: "IN02", bab: 2, nama: "Perubahan Putusan Setelah Berkekuatan Hukum Tetap",
    bentuk: "NTBGR", satuanBaris: "pegawai", mutuRuas: "kode", lantai: "harian",
    keterangan: "Putusan yang diubah setelah tenggang upaya hukum lewat." },
  { kode: "IN03", bab: 2, nama: "Kewajaran Waktu Penginputan Data",
    bentuk: "NTBGR", satuanBaris: "pegawai", mutuRuas: "kode", lantai: "harian",
    keterangan: "Puluhan perkara yang diinput dalam satu waktu duduk membuat tanggal input kehilangan makna." },
  { kode: "IN04", bab: 2, nama: "Penginputan di Luar Jam Kerja dan Hari Libur",
    bentuk: "NTBG", satuanBaris: "pegawai", mutuRuas: "kode", lantai: "harian",
    keterangan: "Penginputan pada malam hari dan akhir pekan." },
  { kode: "IN05", bab: 2, nama: "Kesesuaian Urutan Tahapan Perkara",
    bentuk: "NTB", satuanBaris: "perkara", mutuRuas: "hitung", lantai: "harian",
    keterangan: "Tanggal yang tidak mungkin terjadi menurut hukum acara, misalnya PHS mendahului PMH." },
  { kode: "IN06", bab: 2, nama: "Rekam Jejak Penginputan per Aparatur",
    bentuk: "NTBGS", satuanBaris: "pegawai", mutuRuas: "kode", lantai: "harian",
    keterangan: "Apa yang diinput, kapan, dan apa yang diubah setelahnya." },
  { kode: "IN07", bab: 2, nama: "Kelengkapan Ruas Wajib Perkara",
    bentuk: "NTBPR", satuanBaris: "dok", mutuRuas: "kode", lantai: "harian",
    keterangan: "Persentase ruas wajib yang terisi, penjaga laporan sebelum dikunci." },
  { kode: "IN08", bab: 2, nama: "Kelengkapan Dokumen Elektronik",
    bentuk: "NTBR", satuanBaris: "dok", mutuRuas: "kode", lantai: "harian",
    keterangan: "Petitum, amar putusan, dan naskah anonimisasi." },
  { kode: "IN09", bab: 2, nama: "Kewajaran Tanggal Putus, Minutasi, dan BHT",
    bentuk: "NTBR", satuanBaris: "perkara", mutuRuas: "hitung", lantai: "harian",
    keterangan: "Tanggal yang tidak masuk akal secara hukum acara." },
  { kode: "IN10", bab: 2, nama: "Pencocokan SIPP dengan Arsip e-Court",
    bentuk: "NTBR", satuanBaris: "dok", mutuRuas: "kode", lantai: "harian",
    keterangan: "Perkara yang tercatat di satu tempat namun hilang di tempat lain." },
  { kode: "IN11", bab: 2, nama: "Pencocokan Buku Jurnal Keuangan dengan SIPP",
    bentuk: "NTKR", satuanBaris: "bulan", mutuRuas: "hitung", lantai: "harian",
    keterangan: "Selisih ditelusuri sampai transaksi penyebabnya." },
  { kode: "IN12", bab: 2, nama: "Pencocokan Data Meja Informasi dengan SIPP",
    bentuk: "NTBG", satuanBaris: "bulan", mutuRuas: "hitung", lantai: "harian",
    keterangan: "Akta cerai yang terbit namun tidak pernah diambil." },
  { kode: "IN13", bab: 2, nama: "Perkara Tanpa Data Saksi",
    bentuk: "NTB", satuanBaris: "perkara", mutuRuas: "hitung", lantai: "harian",
    keterangan: "Perkara yang keterangan saksinya belum diinput." },
  { kode: "IN14", bab: 2, nama: "Jejak Audit Aplikasi",
    bentuk: "NTB", satuanBaris: "pegawai", mutuRuas: "kode", lantai: "harian",
    keterangan: "Riwayat perubahan data pada seluruh tabel tahapan." },
  { kode: "KT01", bab: 3, nama: "Ketaatan Penginputan Pendaftaran Perkara",
    bentuk: "NTBGK", satuanBaris: "butir", mutuRuas: "kode", lantai: "harian",
    keterangan: "Jarak antara penerimaan perkara dan penginputannya." },
  { kode: "KT02", bab: 3, nama: "Ketaatan Penetapan Majelis Hakim",
    bentuk: "NTBGK", satuanBaris: "majelis", mutuRuas: "kode", lantai: "harian",
    keterangan: "Dihitung dari keberadaan dokumen penetapan dan tanggal penginputannya." },
  { kode: "KT03", bab: 3, nama: "Ketaatan Penunjukan Panitera Pengganti",
    bentuk: "NTBGK", satuanBaris: "pp", mutuRuas: "kode", lantai: "harian",
    keterangan: "Dihitung dari penunjukan yang pertama kali diinput." },
  { kode: "KT04", bab: 3, nama: "Ketaatan Penunjukan Jurusita dan Jurusita Pengganti",
    bentuk: "NTBGK", satuanBaris: "js", mutuRuas: "kode", lantai: "harian",
    keterangan: "Dihitung dari penunjukan yang pertama kali diinput." },
  { kode: "KT05", bab: 3, nama: "Ketaatan Penetapan Hari Sidang",
    bentuk: "NTBGK", satuanBaris: "majelis", mutuRuas: "kode", lantai: "harian",
    keterangan: "Dihitung dari dokumen penetapan hari sidang." },
  { kode: "KT06", bab: 3, nama: "Ketaatan Tenggang Pemanggilan Pasal 122 HIR",
    bentuk: "NTBK", satuanBaris: "js", mutuRuas: "kode", lantai: "harian",
    keterangan: "Panggilan sah sekurangnya tiga hari kerja sebelum sidang." },
  { kode: "KT07", bab: 3, nama: "Ketaatan Penginputan Relaas Panggilan",
    bentuk: "NTBGK", satuanBaris: "js", mutuRuas: "kode", lantai: "harian",
    keterangan: "Jarak antara pelaksanaan panggilan dan penginputan relaasnya." },
  { kode: "KT08", bab: 3, nama: "Ketaatan Penginputan Data Mediasi",
    bentuk: "NTBGK", satuanBaris: "mediator", mutuRuas: "kode", lantai: "harian",
    keterangan: "Bernilai sempurna apabila perkara tidak wajib mediasi menurut PERMA 1/2016." },
  { kode: "KT09", bab: 3, nama: "Ketaatan Penginputan Jadwal dan Penundaan Sidang",
    bentuk: "NTBGK", satuanBaris: "majelis", mutuRuas: "kode", lantai: "harian",
    keterangan: "Penundaan dan agenda diinput tepat waktu." },
  { kode: "KT10", bab: 3, nama: "Ketaatan Penginputan Berita Acara Sidang",
    bentuk: "NTBGK", satuanBaris: "pp", mutuRuas: "kode", lantai: "harian",
    keterangan: "Jarak antara sidang dan selesainya berita acara." },
  { kode: "KT11", bab: 3, nama: "Ketaatan Penginputan Putusan",
    bentuk: "NTBGK", satuanBaris: "majelis", mutuRuas: "kode", lantai: "harian",
    keterangan: "Jarak antara pengucapan putusan dan penginputannya." },
  { kode: "KT12", bab: 3, nama: "Ketaatan Minutasi Berkas Perkara",
    bentuk: "NTBGK", satuanBaris: "pp", mutuRuas: "kode", lantai: "harian",
    keterangan: "Tenggang empat belas hari sejak putusan diucapkan." },
  { kode: "KT13", bab: 3, nama: "Ketaatan Pemberitahuan Isi Putusan",
    bentuk: "NTBGK", satuanBaris: "js", mutuRuas: "kode", lantai: "harian",
    keterangan: "Dibaca dari kehadiran pihak pada saat pengucapan putusan." },
  { kode: "KT14", bab: 3, nama: "Ketaatan Penetapan Berkekuatan Hukum Tetap",
    bentuk: "NTBGK", satuanBaris: "majelis", mutuRuas: "kode", lantai: "harian",
    keterangan: "Dihitung dari lewatnya tenggang upaya hukum." },
  { kode: "KT15", bab: 3, nama: "Ketaatan Penerbitan Akta Cerai",
    bentuk: "NTBGK", satuanBaris: "pp", mutuRuas: "kode", lantai: "harian",
    keterangan: "Bernilai sempurna apabila bukan perkara perceraian." },
  { kode: "KT16", bab: 3, nama: "Ketaatan Pelaksanaan Sidang Ikrar Talak",
    bentuk: "NTBGK", satuanBaris: "majelis", mutuRuas: "kode", lantai: "harian",
    keterangan: "Dihitung dari penetapan hari sidang ikrar sampai pelaksanaannya." },
  { kode: "KT17", bab: 3, nama: "Ketaatan Publikasi Direktori Putusan",
    bentuk: "NTBGK", satuanBaris: "majelis", mutuRuas: "kode", lantai: "harian",
    keterangan: "Tenggang satu hari kerja sejak putusan diucapkan." },
  { kode: "KT18", bab: 3, nama: "Ketaatan Pengarsipan Berkas Perkara",
    bentuk: "NTBGK", satuanBaris: "pp", mutuRuas: "kode", lantai: "harian",
    keterangan: "Berkas dimasukkan ke boks arsip setelah minutasi." },
  { kode: "KT19", bab: 3, nama: "Ketaatan Terhadap SEMA dan PERMA yang Berlaku",
    bentuk: "NTB", satuanBaris: "butir", mutuRuas: "kode", lantai: "harian",
    keterangan: "Kepatuhan aturan yang melekat pada tiap jenis perkara." },
  { kode: "KT20", bab: 3, nama: "Nilai Gabungan Ketaatan SK Dirjen Badilag 048/2024",
    bentuk: "NTBGKR", satuanBaris: "butir", mutuRuas: "kode", lantai: "harian",
    keterangan: "Dua puluh sembilan butir, dipisah tiga keadaan: tepat, terlambat, dan mendahului peristiwa." },
  { kode: "LP00", bab: 4, nama: "Papan Kendali Pengiriman Laporan Perkara",
    bentuk: "NTBGKR", satuanBaris: "lipa", mutuRuas: "kode", lantai: "bulanan",
    keterangan: "Ringkasan seluruh dua puluh dua laporan: mana yang sudah dikirim, terlambat, dan berselisih dengan SIPP." },
  { kode: "LP01", bab: 4, nama: "LIPA 1 — Keadaan Perkara",
    bentuk: "NLTGKR", satuanBaris: "bulan", mutuRuas: "kode", lantai: "bulanan",
    keterangan: "Penerimaan, penyelesaian, minutasi, dan sisa perkara." },
  { kode: "LP02", bab: 4, nama: "LIPA 2 — Perkara Dimohonkan Banding",
    bentuk: "NLTGKR", satuanBaris: "bulan", mutuRuas: "kode", lantai: "bulanan",
    keterangan: "Perkara yang diajukan upaya hukum banding." },
  { kode: "LP03", bab: 4, nama: "LIPA 3 — Perkara Dimohonkan Kasasi",
    bentuk: "NLTGKR", satuanBaris: "bulan", mutuRuas: "kode", lantai: "bulanan",
    keterangan: "Perkara yang diajukan upaya hukum kasasi." },
  { kode: "LP04", bab: 4, nama: "LIPA 4 — Perkara Dimohonkan Peninjauan Kembali",
    bentuk: "NLTGKR", satuanBaris: "bulan", mutuRuas: "kode", lantai: "bulanan",
    keterangan: "Perkara yang diajukan peninjauan kembali." },
  { kode: "LP05", bab: 4, nama: "LIPA 5 — Pelaksanaan Putusan atau Eksekusi",
    bentuk: "NLTGKR", satuanBaris: "bulan", mutuRuas: "kode", lantai: "bulanan",
    keterangan: "Permohonan dan pelaksanaan eksekusi." },
  { kode: "LP06", bab: 4, nama: "LIPA 6 — Kegiatan Hakim",
    bentuk: "NLTGKR", satuanBaris: "hakim", mutuRuas: "kode", lantai: "bulanan",
    keterangan: "Beban kerja majelis hakim." },
  { kode: "LP07", bab: 4, nama: "LIPA 7 — Keuangan Perkara",
    bentuk: "NLTGKR", satuanBaris: "bulan", mutuRuas: "kode", lantai: "bulanan",
    keterangan: "Penerimaan, pengeluaran, dan sisa panjar biaya perkara." },
  { kode: "LP08", bab: 4, nama: "LIPA 8 — Keuangan Perkara Eksekusi",
    bentuk: "NLTGKR", satuanBaris: "bulan", mutuRuas: "kode", lantai: "bulanan",
    keterangan: "Keuangan yang melekat pada perkara eksekusi." },
  { kode: "LP09", bab: 4, nama: "LIPA 9 — Penerimaan Hak-Hak Kepaniteraan",
    bentuk: "NLTGKR", satuanBaris: "bulan", mutuRuas: "kode", lantai: "bulanan",
    keterangan: "Penerimaan negara bukan pajak dari hak kepaniteraan." },
  { kode: "LP10", bab: 4, nama: "LIPA 10 — Penggunaan Formulir Akta Cerai",
    bentuk: "NLTGKR", satuanBaris: "bulan", mutuRuas: "kode", lantai: "bulanan",
    keterangan: "Pemakaian, sisa, dan kerusakan blangko akta cerai." },
  { kode: "LP11", bab: 4, nama: "LIPA 11 — Eksaminasi Putusan",
    bentuk: "NLTGKR", satuanBaris: "hakim", mutuRuas: "kode", lantai: "bulanan",
    keterangan: "Putusan yang dieksaminasi beserta hasilnya." },
  { kode: "LP12", bab: 4, nama: "LIPA 12 — Pelaksanaan Mediasi",
    bentuk: "NLTGKR", satuanBaris: "mediator", mutuRuas: "kode", lantai: "bulanan",
    keterangan: "Perkara yang dimediasi dan hasil kesepakatannya." },
  { kode: "LP13", bab: 4, nama: "LIPA 13 — Penerbitan Akta Cerai",
    bentuk: "NLTGKR", satuanBaris: "bulan", mutuRuas: "kode", lantai: "bulanan",
    keterangan: "Akta cerai yang diterbitkan dan diserahkan." },
  { kode: "LP14", bab: 4, nama: "LIPA 14 — Sidang di Luar Gedung Pengadilan",
    bentuk: "NLTGKR", satuanBaris: "kec", mutuRuas: "bebas", lantai: "bulanan",
    keterangan: "Pelaksanaan sidang keliling — dibiayai DIPA 04." },
  { kode: "LP15", bab: 4, nama: "LIPA 15 — Pembebasan Biaya Perkara (Prodeo)",
    bentuk: "NLTGKR", satuanBaris: "bulan", mutuRuas: "kode", lantai: "bulanan",
    keterangan: "Perkara prodeo — dibiayai DIPA 04." },
  { kode: "LP16", bab: 4, nama: "LIPA 16 — Pos Bantuan Hukum",
    bentuk: "NLTGKR", satuanBaris: "bulan", mutuRuas: "kode", lantai: "bulanan",
    keterangan: "Layanan Posbakum — dibiayai DIPA 04." },
  { kode: "LP17", bab: 4, nama: "LIPA 17 — Biaya Proses Penyelesaian Perkara",
    bentuk: "NLTGKR", satuanBaris: "biaya", mutuRuas: "bebas", lantai: "bulanan",
    keterangan: "Penggunaan biaya proses penyelesaian perkara." },
  { kode: "LP18", bab: 4, nama: "LIPA 18 — Meja Informasi dan Pengaduan",
    bentuk: "NLTGKR", satuanBaris: "layanan", mutuRuas: "kode", lantai: "bulanan",
    keterangan: "Pengelolaan meja informasi dan penerimaan pengaduan." },
  { kode: "LP19", bab: 4, nama: "LIPA 19 — Penanganan Pengaduan",
    bentuk: "NLTGKR", satuanBaris: "bulan", mutuRuas: "kode", lantai: "bulanan",
    keterangan: "Pengaduan yang diterima, diproses, dan diselesaikan." },
  { kode: "LP20", bab: 4, nama: "LIPA 20 — Keuangan Titipan Pihak Ketiga",
    bentuk: "NLTGKR", satuanBaris: "bulan", mutuRuas: "kode", lantai: "bulanan",
    keterangan: "Uang konsinyasi yang dititipkan kepada pengadilan." },
  { kode: "LP21", bab: 4, nama: "LIPA 21 — Pelayanan Terpadu Sidang Keliling",
    bentuk: "NLTGKR", satuanBaris: "kec", mutuRuas: "bebas", lantai: "bulanan",
    keterangan: "Sidang keliling terpadu bersama instansi lain." },
  { kode: "LP22", bab: 4, nama: "LIPA 22 — Dispensasi Kawin",
    bentuk: "NLTGKR", satuanBaris: "bulan", mutuRuas: "kode", lantai: "bulanan",
    keterangan: "Permohonan dispensasi kawin yang diterima dan diputus." },
  { kode: "LP23", bab: 4, nama: "Aspek 1 — Ketepatan Waktu Pengiriman Laporan",
    bentuk: "NTBGKR", satuanBaris: "lipa", mutuRuas: "kode", lantai: "bulanan",
    keterangan: "Kepatuhan mengunggah, memvalidasi, dan mengirim sebelum batas akhir bulanan." },
  { kode: "LP24", bab: 4, nama: "Aspek 2 — Validitas dan Sinkronisasi dengan SIPP",
    bentuk: "NTBGKR", satuanBaris: "lipa", mutuRuas: "kode", lantai: "bulanan",
    keterangan: "Kesesuaian angka laporan dengan data riil SIPP — selisih dan kejanggalan." },
  { kode: "LP25", bab: 4, nama: "Aspek 3 — Kinerja Pelaksanaan DIPA 04",
    bentuk: "NTBGKR", satuanBaris: "dipa", mutuRuas: "kode", lantai: "bulanan",
    keterangan: "Realisasi fisik dan pertanggungjawaban pada LIPA 14, 15, dan 16." },
  { kode: "RG01", bab: 5, nama: "Register Induk Perkara Gugatan",
    bentuk: "LNG", satuanBaris: "bulan", mutuRuas: "kode", lantai: "bulanan",
    keterangan: "Bentuk register tidak diubah." },
  { kode: "RG02", bab: 5, nama: "Register Induk Perkara Permohonan",
    bentuk: "LNG", satuanBaris: "bulan", mutuRuas: "kode", lantai: "bulanan",
    keterangan: "Bentuk register tidak diubah." },
  { kode: "RG03", bab: 5, nama: "Register Permohonan Banding",
    bentuk: "LNG", satuanBaris: "bulan", mutuRuas: "kode", lantai: "bulanan",
    keterangan: "Bentuk register tidak diubah." },
  { kode: "RG04", bab: 5, nama: "Register Permohonan Kasasi",
    bentuk: "LNG", satuanBaris: "bulan", mutuRuas: "kode", lantai: "bulanan",
    keterangan: "Bentuk register tidak diubah." },
  { kode: "RG05", bab: 5, nama: "Register Permohonan Peninjauan Kembali",
    bentuk: "LN", satuanBaris: "bulan", mutuRuas: "kode", lantai: "bulanan",
    keterangan: "Bentuk register tidak diubah." },
  { kode: "RG06", bab: 5, nama: "Register Mediasi",
    bentuk: "LNG", satuanBaris: "mediator", mutuRuas: "kode", lantai: "bulanan",
    keterangan: "Bentuk register tidak diubah." },
  { kode: "RG07", bab: 5, nama: "Register Eksekusi",
    bentuk: "LN", satuanBaris: "bulan", mutuRuas: "kode", lantai: "bulanan",
    keterangan: "Bentuk register tidak diubah." },
  { kode: "RG08", bab: 5, nama: "Register Penyitaan",
    bentuk: "LN", satuanBaris: "bulan", mutuRuas: "kode", lantai: "bulanan",
    keterangan: "Bentuk register tidak diubah." },
  { kode: "RG09", bab: 5, nama: "Register Konsinyasi",
    bentuk: "LN", satuanBaris: "bulan", mutuRuas: "kode", lantai: "bulanan",
    keterangan: "Bentuk register tidak diubah." },
  { kode: "RG10", bab: 5, nama: "Register Akta Cerai",
    bentuk: "LNG", satuanBaris: "bulan", mutuRuas: "kode", lantai: "bulanan",
    keterangan: "Bentuk register tidak diubah." },
  { kode: "RG11", bab: 5, nama: "Register Pembebasan Biaya Perkara",
    bentuk: "LN", satuanBaris: "bulan", mutuRuas: "kode", lantai: "bulanan",
    keterangan: "Bentuk register tidak diubah." },
  { kode: "RG12", bab: 5, nama: "Register Gugatan Sederhana",
    bentuk: "LN", satuanBaris: "bulan", mutuRuas: "kode", lantai: "bulanan",
    keterangan: "Bentuk register tidak diubah." },
  { kode: "RG13", bab: 5, nama: "Register Ekonomi Syariah",
    bentuk: "LN", satuanBaris: "bulan", mutuRuas: "kode", lantai: "bulanan",
    keterangan: "Bentuk register tidak diubah." },
  { kode: "RG14", bab: 5, nama: "Register Arsip Berkas Perkara",
    bentuk: "LNG", satuanBaris: "bulan", mutuRuas: "kode", lantai: "bulanan",
    keterangan: "Bentuk register tidak diubah." },
  { kode: "BK01", bab: 6, nama: "Beban Perkara Majelis Hakim",
    bentuk: "NTBAR", satuanBaris: "majelis", mutuRuas: "kode", lantai: "harian",
    keterangan: "Jumlah dan sebaran perkara yang ditangani." },
  { kode: "BK02", bab: 6, nama: "Beban Perkara Panitera Pengganti",
    bentuk: "NTBAR", satuanBaris: "pp", mutuRuas: "kode", lantai: "harian",
    keterangan: "Jumlah dan sebaran perkara yang didampingi." },
  { kode: "BK03", bab: 6, nama: "Beban Pemanggilan Jurusita",
    bentuk: "NTBAR", satuanBaris: "js", mutuRuas: "kode", lantai: "harian",
    keterangan: "Jumlah relaas yang dilaksanakan dan sebaran wilayahnya." },
  { kode: "BK04", bab: 6, nama: "Indeks Pemerataan Pembagian Perkara",
    bentuk: "NTBAR", satuanBaris: "majelis", mutuRuas: "hitung", lantai: "harian",
    keterangan: "Koefisien Gini atas pembagian perkara — menilai pembagian, bukan orangnya." },
  { kode: "BK05", bab: 6, nama: "Kepadatan Jadwal Sidang Harian",
    bentuk: "NTB", satuanBaris: "ruang", mutuRuas: "bebas", lantai: "harian",
    keterangan: "Hari yang melampaui kapasitas majelis, terlihat sebelum harinya tiba." },
  { kode: "BK06", bab: 6, nama: "Pemanfaatan Ruang Sidang",
    bentuk: "NTBA", satuanBaris: "ruang", mutuRuas: "bebas", lantai: "harian",
    keterangan: "Ruang yang menganggur saat ruang lain berdesakan." },
  { kode: "BK07", bab: 6, nama: "Beban Perkara yang Tidak Tercatat",
    bentuk: "NTBR", satuanBaris: "majelis", mutuRuas: "hitung", lantai: "harian",
    keterangan: "Perkara yang menyita waktu tanpa menambah angka statistik." },
  { kode: "BK08", bab: 6, nama: "Simulasi Dampak Perubahan Beban Kerja",
    bentuk: "NTGAR", satuanBaris: "bulan", mutuRuas: "hitung", lantai: "harian",
    keterangan: "Penggeser skenario dengan model antrean sederhana — model, bukan pengukuran." },
  { kode: "BK09", bab: 6, nama: "Proyeksi Sisa Perkara Akhir Periode",
    bentuk: "NTGAR", satuanBaris: "bulan", mutuRuas: "hitung", lantai: "harian",
    keterangan: "Perkiraan sisa berdasarkan laju penerimaan dan penyelesaian." },
  { kode: "BK10", bab: 6, nama: "Perbandingan Beban Antar Periode",
    bentuk: "NTBG", satuanBaris: "bulan", mutuRuas: "hitung", lantai: "harian",
    keterangan: "Bulan ini dibanding bulan lalu dan tahun lalu." },
  { kode: "AP01", bab: 7, nama: "Rapor Kinerja Majelis Hakim",
    bentuk: "NTBGSR", satuanBaris: "majelis", mutuRuas: "kode", lantai: "harian",
    keterangan: "Lama penyelesaian, ketepatan waktu, penundaan, dan tingkat upaya hukum." },
  { kode: "AP02", bab: 7, nama: "Rapor Kinerja Hakim Perorangan",
    bentuk: "NTBGR", satuanBaris: "hakim", mutuRuas: "kode", lantai: "harian",
    keterangan: "Jumlah perkara ditangani dan kecepatan penyelesaiannya." },
  { kode: "AP03", bab: 7, nama: "Rapor Kinerja Panitera Pengganti",
    bentuk: "NTBGR", satuanBaris: "pp", mutuRuas: "kode", lantai: "harian",
    keterangan: "Jarak sidang ke berita acara, ketepatan agenda, dan kelengkapannya." },
  { kode: "AP04", bab: 7, nama: "Indeks Keberhasilan Pemanggilan Jurusita",
    bentuk: "NTBSR", satuanBaris: "js", mutuRuas: "kode", lantai: "harian",
    keterangan: "Tingkat relaas retur yang disesuaikan tingkat kesulitan wilayah." },
  { kode: "AP05", bab: 7, nama: "Rapor Penyusun Konsep Putusan",
    bentuk: "NTBGR", satuanBaris: "pp", mutuRuas: "kode", lantai: "harian",
    keterangan: "Rentang putus ke konsep, koreksi, dan minutasi, beserta putaran perbaikannya." },
  { kode: "AP06", bab: 7, nama: "Rapor Mediator",
    bentuk: "NTBGR", satuanBaris: "mediator", mutuRuas: "kode", lantai: "harian",
    keterangan: "Tingkat keberhasilan mediasi tiap mediator." },
  { kode: "AP07", bab: 7, nama: "Rapor Petugas Meja Informasi",
    bentuk: "NTBG", satuanBaris: "pegawai", mutuRuas: "kode", lantai: "harian",
    keterangan: "Layanan informasi dan permohonan salinan yang dilayani." },
  { kode: "AP08", bab: 7, nama: "Rapor Petugas Pengarsipan",
    bentuk: "NTBG", satuanBaris: "pegawai", mutuRuas: "kode", lantai: "harian",
    keterangan: "Berkas yang diarsipkan dan ketepatan waktunya." },
  { kode: "AP09", bab: 7, nama: "Perbandingan Majelis terhadap Nilai Tengah",
    bentuk: "NTBS", satuanBaris: "majelis", mutuRuas: "kode", lantai: "harian",
    keterangan: "Majelis dibanding nilai tengah pengadilan." },
  { kode: "AP10", bab: 7, nama: "Rapor Kinerja Perorangan Gabungan",
    bentuk: "NTBGR", satuanBaris: "pegawai", mutuRuas: "kode", lantai: "harian",
    keterangan: "Rekam jejak tiap aparatur, dengan pembatas dua puluh perkara." },
  { kode: "AP11", bab: 7, nama: "Riwayat Nilai Aparatur Antar Periode",
    bentuk: "NTGK", satuanBaris: "pegawai", mutuRuas: "hitung", lantai: "harian",
    keterangan: "Nilai bergerak dari periode ke periode, bukan potret sesaat." },
  { kode: "AP12", bab: 7, nama: "Uji Keandalan Antar Penilai",
    bentuk: "NTR", satuanBaris: "pegawai", mutuRuas: "hitung", lantai: "harian",
    keterangan: "Dua petugas menilai berkas yang sama, apakah hasilnya sama." },
  { kode: "AP13", bab: 7, nama: "Catatan Akses dan Aktivitas Pengguna",
    bentuk: "NTB", satuanBaris: "pegawai", mutuRuas: "kode", lantai: "harian",
    keterangan: "Riwayat masuk dan alamat akses aplikasi." },
  { kode: "AP14", bab: 7, nama: "Uji Kepekaan Bobot Penilaian Aparatur",
    bentuk: "NTBSR", satuanBaris: "butir", mutuRuas: "hitung", lantai: "harian",
    keterangan: "Bila bobot butir diubah, apakah peringkatnya ikut berubah." },
  { kode: "KU01", bab: 8, nama: "Panjar Biaya Perkara",
    bentuk: "NTBPGA", satuanBaris: "biaya", mutuRuas: "bebas", lantai: "harian",
    keterangan: "Penerimaan panjar menurut jenis perkara." },
  { kode: "KU02", bab: 8, nama: "Penggunaan Biaya Perkara",
    bentuk: "NTBPA", satuanBaris: "biaya", mutuRuas: "bebas", lantai: "harian",
    keterangan: "Rincian pengeluaran dari panjar biaya perkara." },
  { kode: "KU03", bab: 8, nama: "Sisa Panjar Belum Dikembalikan",
    bentuk: "NTBG", satuanBaris: "perkara", mutuRuas: "hitung", lantai: "harian",
    keterangan: "Uang para pihak yang belum diambil kembali." },
  { kode: "KU04", bab: 8, nama: "Kekurangan Panjar Biaya Perkara",
    bentuk: "NTB", satuanBaris: "perkara", mutuRuas: "hitung", lantai: "harian",
    keterangan: "Perkara yang panjarnya habis sebelum selesai." },
  { kode: "KU05", bab: 8, nama: "Penerimaan Negara Bukan Pajak",
    bentuk: "NTBGA", satuanBaris: "bulan", mutuRuas: "hitung", lantai: "harian",
    keterangan: "PNBP dari hak-hak kepaniteraan." },
  { kode: "KU06", bab: 8, nama: "Biaya Pemanggilan Menurut Radius",
    bentuk: "NTB", satuanBaris: "kec", mutuRuas: "bebas", lantai: "harian",
    keterangan: "Biaya panggilan per wilayah — menunggu surat keputusan radius." },
  { kode: "KU07", bab: 8, nama: "Transaksi Keuangan Harian",
    bentuk: "NTBAG", satuanBaris: "biaya", mutuRuas: "bebas", lantai: "harian",
    keterangan: "Panjar, panggilan, PNBP, hak kepaniteraan, meterai, dan ATK." },
  { kode: "KU08", bab: 8, nama: "Saldo dan Rekapitulasi Keuangan",
    bentuk: "NTAG", satuanBaris: "bulan", mutuRuas: "hitung", lantai: "harian",
    keterangan: "Saldo awal, penerimaan, pengeluaran, dan sisa." },
  { kode: "KU09", bab: 8, nama: "Validasi Keuangan Harian",
    bentuk: "NTK", satuanBaris: "bulan", mutuRuas: "hitung", lantai: "harian",
    keterangan: "Pemeriksaan silang harian atas buku jurnal." },
  { kode: "KU10", bab: 8, nama: "Validasi Keuangan Bulanan dan Tahunan",
    bentuk: "NTK", satuanBaris: "bulan", mutuRuas: "hitung", lantai: "harian",
    keterangan: "Pemeriksaan silang berkala atas buku jurnal." },
  { kode: "KU11", bab: 8, nama: "Perbandingan Buku Jurnal dengan SIPP",
    bentuk: "NTKR", satuanBaris: "bulan", mutuRuas: "hitung", lantai: "harian",
    keterangan: "Selisih ditelusuri sampai transaksi penyebabnya." },
  { kode: "KU12", bab: 8, nama: "Keuangan Perkara Upaya Hukum",
    bentuk: "NTB", satuanBaris: "upaya", mutuRuas: "kode", lantai: "harian",
    keterangan: "Biaya banding, kasasi, dan peninjauan kembali." },
  { kode: "KU13", bab: 8, nama: "Keuangan Perkara Eksekusi",
    bentuk: "NTB", satuanBaris: "bulan", mutuRuas: "hitung", lantai: "harian",
    keterangan: "Biaya yang melekat pada perkara eksekusi." },
  { kode: "KU14", bab: 8, nama: "Uang Titipan Pihak Ketiga",
    bentuk: "NTBG", satuanBaris: "bulan", mutuRuas: "hitung", lantai: "harian",
    keterangan: "Konsinyasi yang dititipkan kepada pengadilan." },
  { kode: "KU15", bab: 8, nama: "Uang Persediaan Kepaniteraan",
    bentuk: "NT", satuanBaris: "biaya", mutuRuas: "bebas", lantai: "harian",
    keterangan: "Pencatatan uang persediaan dan kuitansinya." },
  { kode: "KU16", bab: 8, nama: "Beban Biaya yang Ditanggung Para Pihak",
    bentuk: "NTBAR", satuanBaris: "jenis", mutuRuas: "hitung", lantai: "harian",
    keterangan: "Berapa yang sebenarnya dikeluarkan pencari keadilan." },
  { kode: "ST01", bab: 9, nama: "Keadaan Perkara Bulanan",
    bentuk: "NTBGA", satuanBaris: "bulan", mutuRuas: "hitung", lantai: "bulanan",
    keterangan: "Perkara diterima, diputus, dan sisanya." },
  { kode: "ST02", bab: 9, nama: "Sebaran Jenis Perkara",
    bentuk: "NTBPG", satuanBaris: "jenis", mutuRuas: "kode", lantai: "bulanan",
    keterangan: "Delapan belas jenis perkara yang pernah diterima." },
  { kode: "ST03", bab: 9, nama: "Sebaran Jenis Amar Putusan",
    bentuk: "NTBPG", satuanBaris: "status", mutuRuas: "kode", lantai: "bulanan",
    keterangan: "Dikabulkan, ditolak, tidak diterima, dicabut, gugur, dan coret register." },
  { kode: "ST04", bab: 9, nama: "Analisis Faktor Penyebab Perceraian",
    bentuk: "NTBGSR", satuanBaris: "faktor", mutuRuas: "kode", lantai: "bulanan",
    keterangan: "Dua puluh enam kategori baku, disilangkan dengan usia perkawinan dan pendidikan." },
  { kode: "ST05", bab: 9, nama: "Sebaran Pendidikan Para Pihak",
    bentuk: "NTBPS", satuanBaris: "pendidikan", mutuRuas: "kode", lantai: "bulanan",
    keterangan: "Dua belas jenjang pendidikan." },
  { kode: "ST06", bab: 9, nama: "Sebaran Pekerjaan Para Pihak",
    bentuk: "NTBS", satuanBaris: "pekerjaan", mutuRuas: "bebas", lantai: "bulanan",
    keterangan: "Ruas teks bebas — wajib dikelompokkan lebih dahulu." },
  { kode: "ST07", bab: 9, nama: "Sebaran Umur Para Pihak",
    bentuk: "NTBPS", satuanBaris: "umur", mutuRuas: "hitung", lantai: "bulanan",
    keterangan: "Kelompok umur penggugat dan tergugat." },
  { kode: "ST08", bab: 9, nama: "Sebaran Usia Perkawinan",
    bentuk: "NTBPS", satuanBaris: "usia", mutuRuas: "hitung", lantai: "bulanan",
    keterangan: "Lama perkawinan sebelum perkara diajukan." },
  { kode: "ST09", bab: 9, nama: "Sebaran Perkara Menurut Wilayah Hukum",
    bentuk: "NTB", satuanBaris: "kec", mutuRuas: "bebas", lantai: "bulanan",
    keterangan: "Enam belas kecamatan dalam wilayah hukum." },
  { kode: "ST10", bab: 9, nama: "Tren dan Pola Musiman Penerimaan Perkara",
    bentuk: "NTGAR", satuanBaris: "bulan", mutuRuas: "hitung", lantai: "bulanan",
    keterangan: "Penguraian menjadi tren, pola musiman, dan proyeksi." },
  { kode: "ST11", bab: 9, nama: "Perkara Berdasarkan Cara Pendaftaran",
    bentuk: "NTBPG", satuanBaris: "daftar", mutuRuas: "kode", lantai: "bulanan",
    keterangan: "Manual, e-Court, dan sidang keliling." },
  { kode: "ST12", bab: 9, nama: "Tingkat Penggunaan e-Court",
    bentuk: "NTBG", satuanBaris: "bulan", mutuRuas: "hitung", lantai: "bulanan",
    keterangan: "Proporsi perkara yang didaftarkan secara elektronik." },
  { kode: "ST13", bab: 9, nama: "Perkara Verstek dan Kontensius",
    bentuk: "NTBPG", satuanBaris: "sifat", mutuRuas: "kode", lantai: "bulanan",
    keterangan: "Sebaran menurut kehadiran pihak tergugat." },
  { kode: "ST14", bab: 9, nama: "Perkara Dicabut dan Gugur",
    bentuk: "NTBG", satuanBaris: "bulan", mutuRuas: "hitung", lantai: "bulanan",
    keterangan: "Perkara yang berakhir tanpa putusan pokok." },
  { kode: "ST15", bab: 9, nama: "Perkara Prodeo dan Pembebasan Biaya",
    bentuk: "NTBG", satuanBaris: "bulan", mutuRuas: "hitung", lantai: "bulanan",
    keterangan: "Perkara yang dibebaskan dari biaya." },
  { kode: "ST16", bab: 9, nama: "Perkara dengan Panggilan Ghaib",
    bentuk: "NTBG", satuanBaris: "perkara", mutuRuas: "hitung", lantai: "bulanan",
    keterangan: "Pemanggilan melalui media massa." },
  { kode: "ST17", bab: 9, nama: "Perkara Delegasi Bantuan Panggilan",
    bentuk: "NTB", satuanBaris: "kec", mutuRuas: "bebas", lantai: "bulanan",
    keterangan: "Tabayun masuk dan keluar." },
  { kode: "ST18", bab: 9, nama: "Profil Upaya Hukum",
    bentuk: "NTB", satuanBaris: "upaya", mutuRuas: "kode", lantai: "bulanan",
    keterangan: "Angka dasar banding, kasasi, dan peninjauan kembali." },
  { kode: "ST19", bab: 9, nama: "Riwayat Perkara Para Pihak",
    bentuk: "NTR", satuanBaris: "perkara", mutuRuas: "hitung", lantai: "bulanan",
    keterangan: "Perkara lain melalui nomor induk kependudukan dan nama." },
  { kode: "ST20", bab: 9, nama: "Riwayat Perkara Antar Pasangan Pihak",
    bentuk: "NTR", satuanBaris: "perkara", mutuRuas: "hitung", lantai: "bulanan",
    keterangan: "Apakah kedua pihak pernah berperkara sebelumnya." },
  { kode: "ST21", bab: 9, nama: "Perkara Berisiko Melampaui Ambang",
    bentuk: "NTB", satuanBaris: "perkara", mutuRuas: "hitung", lantai: "bulanan",
    keterangan: "Perkara yang mendekati atau melewati ambang lima bulan." },
  { kode: "ST22", bab: 9, nama: "Perkara Menyimpang dari Kebiasaan Jenisnya",
    bentuk: "NTBS", satuanBaris: "perkara", mutuRuas: "hitung", lantai: "bulanan",
    keterangan: "Perkara yang jauh berbeda dari kebiasaan jenisnya." },
  { kode: "MP01", bab: 10, nama: "Mutu Pertimbangan Hukum",
    bentuk: "NTBSR", satuanBaris: "majelis", mutuRuas: "kode", lantai: "harian",
    keterangan: "Panjang uraian dan kepadatan rujukan peraturan." },
  { kode: "MP02", bab: 10, nama: "Kesesuaian Petitum dengan Amar Putusan",
    bentuk: "NTR", satuanBaris: "perkara", mutuRuas: "hitung", lantai: "harian",
    keterangan: "Butir petitum yang belum menemukan padanannya di amar." },
  { kode: "MP03", bab: 10, nama: "Keajekan Amar Antar Majelis",
    bentuk: "NTBSR", satuanBaris: "majelis", mutuRuas: "kode", lantai: "harian",
    keterangan: "Perkara serupa dengan amar berbeda — untuk ditanyakan, bukan diseragamkan." },
  { kode: "MP04", bab: 10, nama: "Amar Nafkah, Iddah, dan Mut’ah",
    bentuk: "NTBR", satuanBaris: "jenis", mutuRuas: "bebas", lantai: "harian",
    keterangan: "Rapuh — dihitung dari pencarian kata pada teks amar." },
  { kode: "MP05", bab: 10, nama: "Eksaminasi Putusan",
    bentuk: "NTBGR", satuanBaris: "hakim", mutuRuas: "kode", lantai: "harian",
    keterangan: "Putusan yang dieksaminasi beserta temuannya." },
  { kode: "MP06", bab: 10, nama: "Pola Penundaan Persidangan",
    bentuk: "NTBP", satuanBaris: "alasan", mutuRuas: "bebas", lantai: "harian",
    keterangan: "Alasan penundaan — ruas teks bebas, wajib dikelompokkan." },
  { kode: "MP07", bab: 10, nama: "Jumlah Persidangan per Perkara",
    bentuk: "NTBPR", satuanBaris: "jenis", mutuRuas: "hitung", lantai: "harian",
    keterangan: "Berapa kali sidang dibutuhkan sampai perkara selesai." },
  { kode: "MP08", bab: 10, nama: "Kehadiran Para Pihak di Persidangan",
    bentuk: "NTBPG", satuanBaris: "sifat", mutuRuas: "kode", lantai: "harian",
    keterangan: "Kehadiran penggugat dan tergugat pada tiap sidang." },
  { kode: "MP09", bab: 10, nama: "Pelaksanaan Mediasi dan Hasilnya",
    bentuk: "NTBPGR", satuanBaris: "mediator", mutuRuas: "kode", lantai: "harian",
    keterangan: "Perkara yang dimediasi beserta hasil kesepakatannya." },
  { kode: "MP10", bab: 10, nama: "Kesesuaian Kesepakatan Mediasi dengan Amar",
    bentuk: "NTR", satuanBaris: "perkara", mutuRuas: "hitung", lantai: "harian",
    keterangan: "Apakah kesepakatan mediasi benar-benar tercermin dalam putusan." },
  { kode: "MP11", bab: 10, nama: "Prakiraan Waktu Penyelesaian Perkara",
    bentuk: "NTGR", satuanBaris: "jenis", mutuRuas: "hitung", lantai: "harian",
    keterangan: "Sebaran perkara sejenis yang telah diputus." },
  { kode: "MP12", bab: 10, nama: "Peta Kendali Mutu Penyelesaian",
    bentuk: "NTKGR", satuanBaris: "bulan", mutuRuas: "hitung", lantai: "harian",
    keterangan: "Batas kendali; hanya bulan yang benar-benar menyimpang yang ditandai." },
  { kode: "MP13", bab: 10, nama: "Corong Tahapan Perkara",
    bentuk: "NTBAR", satuanBaris: "butir", mutuRuas: "kode", lantai: "harian",
    keterangan: "Di mana perkara tersendat, dari pendaftaran sampai pengarsipan." },
  { kode: "MP14", bab: 10, nama: "Nilai Kondisi Penanganan Perkara",
    bentuk: "NTBR", satuanBaris: "perkara", mutuRuas: "hitung", lantai: "harian",
    keterangan: "Gabungan umur, penundaan, relaas, kelengkapan berkas, dan sisa waktu minutasi." },
  { kode: "MP15", bab: 10, nama: "Indeks Risiko Melampaui Lima Bulan",
    bentuk: "NTBSR", satuanBaris: "perkara", mutuRuas: "hitung", lantai: "harian",
    keterangan: "Kemungkinan perkara melewati asas penyelesaian — dugaan, dan ditulis sebagai dugaan." },
  { kode: "MP16", bab: 10, nama: "Kronologi Lengkap Perkara",
    bentuk: "TR", satuanBaris: "perkara", mutuRuas: "hitung", lantai: "harian",
    keterangan: "Seluruh peristiwa perkara dalam satu deret waktu." },
  { kode: "LY01", bab: 11, nama: "Lama Layanan yang Dirasakan Para Pihak",
    bentuk: "NTBAR", satuanBaris: "jenis", mutuRuas: "hitung", lantai: "harian",
    keterangan: "Pendaftaran, sidang pertama, putusan, hingga akta cerai di tangan." },
  { kode: "LY02", bab: 11, nama: "Jumlah Kehadiran yang Dibebankan kepada Pihak",
    bentuk: "NTBPR", satuanBaris: "jenis", mutuRuas: "hitung", lantai: "harian",
    keterangan: "Hari kerja yang hilang bagi para pihak." },
  { kode: "LY03", bab: 11, nama: "Waktu Tunggu di Meja Pelayanan",
    bentuk: "NTBG", satuanBaris: "bulan", mutuRuas: "hitung", lantai: "harian",
    keterangan: "Lama antrian pada Pelayanan Terpadu Satu Pintu." },
  { kode: "LY04", bab: 11, nama: "Layanan Informasi dan Permohonan Salinan",
    bentuk: "NTBG", satuanBaris: "layanan", mutuRuas: "kode", lantai: "harian",
    keterangan: "Permohonan informasi dan salinan produk pengadilan." },
  { kode: "LY05", bab: 11, nama: "Penanganan Pengaduan Masyarakat",
    bentuk: "NTBG", satuanBaris: "bulan", mutuRuas: "hitung", lantai: "harian",
    keterangan: "Pengaduan diterima, diproses, dan diselesaikan." },
  { kode: "LY06", bab: 11, nama: "Akta Cerai Terbit Belum Diambil",
    bentuk: "NTBG", satuanBaris: "perkara", mutuRuas: "hitung", lantai: "harian",
    keterangan: "Akta yang sudah terbit namun belum diambil pihak." },
  { kode: "LY07", bab: 11, nama: "Salinan Putusan Belum Diambil",
    bentuk: "NTBG", satuanBaris: "perkara", mutuRuas: "hitung", lantai: "harian",
    keterangan: "Salinan yang sudah siap namun belum diambil." },
  { kode: "LY08", bab: 11, nama: "Pelaksanaan Sidang di Luar Gedung",
    bentuk: "NTB", satuanBaris: "kec", mutuRuas: "bebas", lantai: "harian",
    keterangan: "Sidang keliling menurut wilayah pelaksanaan." },
  { kode: "LY09", bab: 11, nama: "Layanan Pos Bantuan Hukum",
    bentuk: "NTBG", satuanBaris: "bulan", mutuRuas: "hitung", lantai: "harian",
    keterangan: "Jumlah dan jenis layanan Posbakum." },
  { kode: "LY10", bab: 11, nama: "Nilai Kepuasan Masyarakat dan Persepsi Antikorupsi",
    bentuk: "NTBG", satuanBaris: "layanan", mutuRuas: "kode", lantai: "harian",
    keterangan: "Diisi manual dari hasil survei — tidak tersedia dalam basis data." },
  { kode: "LY11", bab: 11, nama: "Papan Nilai Pelayanan Publik",
    bentuk: "NTBGR", satuanBaris: "layanan", mutuRuas: "kode", lantai: "harian",
    keterangan: "Angka layanan yang boleh dipublikasikan." },
  { kode: "LY12", bab: 11, nama: "Pemberitahuan kepada Pihak melalui Pesan Elektronik",
    bentuk: "NTBG", satuanBaris: "bulan", mutuRuas: "hitung", lantai: "harian",
    keterangan: "Tingkat pesan sampai sebagai indikator layanan." },
  { kode: "MT01", bab: 12, nama: "Uji Beda Antar Periode",
    bentuk: "NTGR", satuanBaris: "bulan", mutuRuas: "hitung", lantai: "bulanan",
    keterangan: "Apakah periode ini benar-benar lebih baik, atau kebetulan." },
  { kode: "MT02", bab: 12, nama: "Uji Beda Proporsi Antar Unit",
    bentuk: "NTBR", satuanBaris: "majelis", mutuRuas: "hitung", lantai: "bulanan",
    keterangan: "Apakah selisih antar majelis berarti, atau sebaran biasa." },
  { kode: "MT03", bab: 12, nama: "Analisis Regresi Lama Penyelesaian",
    bentuk: "NTSR", satuanBaris: "jenis", mutuRuas: "hitung", lantai: "bulanan",
    keterangan: "Apa yang paling menentukan lamanya penyelesaian perkara." },
  { kode: "MT04", bab: 12, nama: "Analisis Kohort Perkara",
    bentuk: "NTAG", satuanBaris: "bulan", mutuRuas: "hitung", lantai: "bulanan",
    keterangan: "Perkara yang masuk pada bulan tertentu, bagaimana nasibnya." },
  { kode: "MT05", bab: 12, nama: "Penguraian Deret Waktu",
    bentuk: "NTGA", satuanBaris: "bulan", mutuRuas: "hitung", lantai: "bulanan",
    keterangan: "Mana tren, mana pola musiman, mana kejadian luar biasa." },
  { kode: "MT06", bab: 12, nama: "Deteksi Data Pencilan",
    bentuk: "NTSB", satuanBaris: "perkara", mutuRuas: "hitung", lantai: "bulanan",
    keterangan: "Perkara mana yang jauh menyimpang, dan mengapa." },
  { kode: "MT07", bab: 12, nama: "Analisis Pareto Penyebab",
    bentuk: "NTBAR", satuanBaris: "alasan", mutuRuas: "bebas", lantai: "bulanan",
    keterangan: "Dua puluh persen sebab mana yang menimbulkan delapan puluh persen masalah." },
  { kode: "MT08", bab: 12, nama: "Indeks Konsentrasi Beban",
    bentuk: "NTBA", satuanBaris: "majelis", mutuRuas: "hitung", lantai: "bulanan",
    keterangan: "Seberapa timpang pembagian beban perkara." },
  { kode: "MT09", bab: 12, nama: "Uji Hubungan Antar Ukuran",
    bentuk: "NTSR", satuanBaris: "uji", mutuRuas: "hitung", lantai: "bulanan",
    keterangan: "Korelasi terbatas pada pasangan yang ditetapkan lebih dahulu." },
  { kode: "MT10", bab: 12, nama: "Selang Kepercayaan Nilai",
    bentuk: "NTGR", satuanBaris: "bulan", mutuRuas: "hitung", lantai: "bulanan",
    keterangan: "Angka nilai itu sebenarnya berkisar di antara berapa." },
  { kode: "MT11", bab: 12, nama: "Peta Kendali Proses",
    bentuk: "NTKG", satuanBaris: "bulan", mutuRuas: "hitung", lantai: "bulanan",
    keterangan: "Bulan mana yang benar-benar menyimpang dari kebiasaan." },
  { kode: "MT12", bab: 12, nama: "Penelusuran Sebab Akar Temuan",
    bentuk: "TR", satuanBaris: "alasan", mutuRuas: "bebas", lantai: "bulanan",
    keterangan: "Temuan yang berulang ini sebabnya apa." },
  { kode: "MT13", bab: 12, nama: "Uji Petik Berbasis Risiko",
    bentuk: "NTR", satuanBaris: "perkara", mutuRuas: "hitung", lantai: "bulanan",
    keterangan: "Berkas mana yang layak diperiksa secara manual." },
  { kode: "MT14", bab: 12, nama: "Perbandingan Antar Satuan Kerja",
    bentuk: "NTBR", satuanBaris: "satker", mutuRuas: "kode", lantai: "bulanan",
    keterangan: "Posisi pengadilan dibanding pengadilan agama lain — butuh data pembanding." },
  { kode: "MT15", bab: 12, nama: "Asisten Analisis Berbasis Kecerdasan Buatan",
    bentuk: "NTR", satuanBaris: "", mutuRuas: "hitung", lantai: "bulanan",
    keterangan: "Tanya jawab berbahasa Indonesia atas data, selalu disertai bukti dan sumbernya." },
];

/**
 * ============================================================================
 * SAMBUNGAN KE PENILAIAN YANG BENAR-BENAR ADA
 * ============================================================================
 *
 * Kunci di sini nama penilaian pada kerangkaPenilaianService. Sambungan yang
 * menunjuk penilaian tidak terdaftar akan ketahuan saat keadaan dihitung -
 * bukan didiamkan.
 */
const SAMBUNGAN = {
  KT01: {
    kunci: "ketaatanInputPendaftaran",
    sifat: "sebagian",
    catatan:
      "Butir ini menuntut JARAK antara penerimaan berkas dan penginputannya. SIPP menyimpan tanggal pendaftaran, bukan tanggal penginputan, sehingga yang dinilai baru keberadaan tanggal pendaftarannya.",
  },
  KT02: {
    kunci: "ketaatanPenetapanMajelis",
    sifat: "sebagian",
    catatan:
      "Butir ini menuntut keberadaan DOKUMEN penetapan beserta tanggal penginputannya. Yang dinilai baru tanggal penetapannya - dokumennya belum diperiksa.",
  },
  KT03: {
    kunci: "ketaatanPenunjukanPaniteraPengganti",
    sifat: "sebagian",
    catatan:
      "Butir ini menuntut tanggal PENGINPUTAN penunjukan yang pertama. Yang dinilai di sini tanggal penetapannya, dan keduanya dapat berbeda jauh. Penginputannya kini terukur tersendiri - lihat ketepatanInput pada daftar di luar katalog.",
  },
  KT04: {
    kunci: "ketaatanPenunjukanJurusita",
    sifat: "sebagian",
    catatan:
      "Butir ini menuntut tanggal PENGINPUTAN penunjukan yang pertama. Yang dinilai di sini tanggal penetapannya, dan keduanya dapat berbeda jauh. Penginputannya kini terukur tersendiri - lihat ketepatanInput pada daftar di luar katalog.",
  },
  KT05: {
    kunci: "ketaatanPenetapanHariSidang",
    sifat: "sebagian",
    catatan:
      "Butir ini menuntut tanggal dokumen penetapan hari sidang. Yang dinilai tanggal sidang pertamanya - keduanya berdekatan tetapi bukan hal yang sama, dan penetapan yang terlambat dengan sidang yang tepat waktu tidak akan terlihat.",
  },
  KT11: {
    kunci: "ketaatanInputPutusan",
    sifat: "sebagian",
    catatan:
      "Butir ini menuntut jarak antara pengucapan putusan dan penginputannya. Yang dinilai jarak antara pendaftaran dan putusan - ukuran yang sah tetapi menjawab pertanyaan yang lain.",
  },
  KT12: {
    kunci: "ketaatanMinutasiBerkas",
    sifat: "penuh",
    catatan: "",
  },
  KT14: {
    kunci: "ketaatanPenetapanBht",
    sifat: "sebagian",
    catatan:
      "Butir ini menuntut BHT dihitung dari lewatnya tenggang upaya hukum tiap jenis perkara. Yang dinilai baru satu batas tetap tiga puluh hari sejak putusan.",
  },
  KT15: {
    kunci: "ketaatanPenerbitanAktaCerai",
    sifat: "sebagian",
    catatan:
      "Perkara bukan perceraian sudah dikecualikan lewat saringan jenis perkara. Yang belum: butir ini menyatakan perkara non-perceraian bernilai SEMPURNA, sedangkan di sini mereka dikeluarkan dari penyebut. Keduanya berbeda pengaruhnya pada nilai gabungan.",
  },
  KT16: {
    kunci: "ketaatanSidangIkrarTalak",
    sifat: "sebagian",
    catatan:
      "Butir ini menghitung dari penetapan hari sidang ikrar sampai pelaksanaannya. Yang dinilai dari tanggal berkekuatan hukum tetap sampai ikrar - tenggang enam bulan menurut Pasal 70 ayat (6) UU 7 Tahun 1989.",
  },
  KT18: {
    kunci: "ketaatanPengarsipanBerkas",
    sifat: "sebagian",
    catatan:
      "Butir ini tidak menyebutkan batas hari. Batas tiga puluh hari sesudah minutasi yang dipakai di sini adalah pilihan yang belum disahkan siapa pun, dan harus ditetapkan sebelum angkanya dipakai membina.",
  },
  // ==========================================================================
  // SEBARAN BAB 9 - DINILAI DARI KELENGKAPAN BAHANNYA
  // ==========================================================================
  //
  // Sebaran tidak punya benar atau salah; yang dapat dinilai APAKAH BAHANNYA
  // ADA. Sebaran pendidikan yang disusun dari data yang tiga perempat kosong
  // bukan gambaran keadaan - ia gambaran atas seperempat perkara yang
  // kebetulan diisi, disajikan seolah gambaran seluruhnya.
  //
  // Sebarannya sendiri tetap dipulangkan pada baris bukti, lengkap dengan
  // berapa banyak yang tidak terhitung.
  ST05: {
    kunci: "sebaranPendidikan",
    sifat: "sebagian",
    catatan:
      "Yang dinilai KETERISIAN ruas pendidikan, bukan bentuk sebarannya. Sebaran yang disusun dari ruas yang sebagian besar kosong bukan gambaran keadaan - diukur pada satu basis data SIPP: 76 terisi dari 878 baris pihak dalam setahun.",
  },
  ST06: {
    kunci: "sebaranPekerjaan",
    sifat: "sebagian",
    catatan:
      "Keterisiannya terukur. Pengelompokan kata pekerjaannya - ruas teks bebas - belum dikerjakan, dan tanpa itu sebarannya masih berupa daftar tulisan yang berbeda-beda ejaannya.",
  },
  ST07: {
    kunci: "sebaranUmur",
    sifat: "sebagian",
    catatan:
      "Keterisian tanggal lahirnya terukur. Pengelompokan umurnya belum - batas kelompoknya keputusan pimpinan, bukan angka yang dapat dikarang mesin.",
  },
  ST19: {
    kunci: "kelengkapanNikPihak",
    sifat: "sebagian",
    catatan:
      "Keterisian nomor induk kependudukannya terukur - itulah dasar penelusuran riwayat. Penelusuran riwayatnya sendiri belum dikerjakan.",
  },
  // ==========================================================================
  // BAB 5 - EMPAT BELAS REGISTER KEPANITERAAN
  // ==========================================================================
  //
  // Katalognya menyebut satu batas dengan tegas: bentuk register tidak diubah.
  // Yang dinilai karena itu bukan susunan kolomnya, melainkan apakah baris yang
  // seharusnya tercatat memang tercatat lengkap - register yang bentuknya
  // sempurna tetapi separuh kolomnya kosong tetap tidak dapat dipakai
  // memeriksa apa pun.
  //
  // SIPP tidak punya tabel register: register di sana TURUNAN, dicetak dari
  // tabel perkara dan tabel tahapannya. Tiap butir di bawah karena itu
  // dipetakan ke tabel sumbernya yang sungguhan.
  RG01: {
    kunci: "registerIndukGugatan",
    sifat: "penuh",
    catatan: "",
  },
  RG02: {
    kunci: "registerIndukPermohonan",
    sifat: "penuh",
    catatan: "",
  },
  RG03: {
    kunci: "registerBanding",
    sifat: "penuh",
    catatan: "",
  },
  RG04: {
    kunci: "registerKasasi",
    sifat: "penuh",
    catatan: "",
  },
  RG05: {
    kunci: "registerPeninjauanKembali",
    sifat: "penuh",
    catatan: "",
  },
  RG06: {
    kunci: "registerMediasi",
    sifat: "penuh",
    catatan: "",
  },
  RG07: {
    kunci: "registerEksekusi",
    sifat: "penuh",
    catatan: "",
  },
  RG08: {
    kunci: "registerPenyitaan",
    sifat: "sebagian",
    catatan:
      "Tabel perkara_sita tidak ada pada SIPP satker ini, sehingga registernya tidak menghasilkan baris sama sekali - dan sengaja TIDAK dinilai nol. Nol berarti menuduh pengadilan tidak mencatat sesuatu yang memang tidak punya tempat penyimpanan. Butir ini hidup sendiri begitu SIPP satker lain punya tabelnya.",
  },
  RG09: {
    kunci: "registerKonsinyasi",
    sifat: "sebagian",
    catatan:
      "Tabel perkara_konsinyasi tidak ada pada SIPP satker ini, sehingga registernya tidak menghasilkan baris sama sekali - dan sengaja TIDAK dinilai nol. Nol berarti menuduh pengadilan tidak mencatat sesuatu yang memang tidak punya tempat penyimpanan. Butir ini hidup sendiri begitu SIPP satker lain punya tabelnya.",
  },
  RG10: {
    kunci: "registerAktaCerai",
    sifat: "penuh",
    catatan: "",
  },
  RG11: {
    kunci: "registerPembebasanBiaya",
    sifat: "penuh",
    catatan: "",
  },
  RG12: {
    kunci: "registerGugatanSederhana",
    sifat: "penuh",
    catatan: "",
  },
  RG13: {
    kunci: "registerEkonomiSyariah",
    sifat: "penuh",
    catatan: "",
  },
  RG14: {
    kunci: "registerArsipBerkas",
    sifat: "penuh",
    catatan: "",
  },
  // ==========================================================================
  // BAB 4 - DUA BELAS LIPA YANG SUMBERNYA MEMANG ADA DI SIPP
  // ==========================================================================
  //
  // Sepuluh LIPA lainnya sengaja TIDAK disambungkan. Datanya tidak ada di
  // SIPP dan tidak ada di mana pun yang dapat dibaca ALETA - diperiksa pada
  // basis datanya: tidak satu pun tabel untuk Posbakum, pengaduan, eksaminasi
  // putusan, sidang keliling, stok blangko akta cerai, maupun realisasi DIPA.
  //
  // Mengarang angkanya jauh lebih buruk daripada membiarkannya kosong. Laporan
  // LIPA dikirim ke Pengadilan Tinggi Agama dan dipakai menilai satuan kerja;
  // angka yang tersusun dari sumber yang tidak ada akan dipertanggungjawabkan
  // seseorang yang tidak pernah tahu dari mana angkanya datang.
  //
  // Yang dinilai KELENGKAPAN BAHANNYA, bukan angka laporannya. ALETA tidak
  // menyusun LIPA - itu pekerjaan operator laporan, dan bentuk laporannya
  // tidak diubah.
  LP01: {
    kunci: "lipaKeadaanPerkara",
    sifat: "sebagian",
    catatan:
      "Kelengkapan bahannya di SIPP terukur. Penyusunan angka laporannya sendiri tetap di tangan operator laporan - bentuk LIPA tidak diubah, dan ALETA tidak mengirimkannya.",
  },
  LP02: {
    kunci: "lipaPerkaraBanding",
    sifat: "sebagian",
    catatan:
      "Kelengkapan bahannya di SIPP terukur. Penyusunan angka laporannya sendiri tetap di tangan operator laporan - bentuk LIPA tidak diubah, dan ALETA tidak mengirimkannya.",
  },
  LP03: {
    kunci: "lipaPerkaraKasasi",
    sifat: "sebagian",
    catatan:
      "Kelengkapan bahannya di SIPP terukur. Penyusunan angka laporannya sendiri tetap di tangan operator laporan - bentuk LIPA tidak diubah, dan ALETA tidak mengirimkannya.",
  },
  LP04: {
    kunci: "lipaPerkaraPeninjauanKembali",
    sifat: "sebagian",
    catatan:
      "Kelengkapan bahannya di SIPP terukur. Penyusunan angka laporannya sendiri tetap di tangan operator laporan - bentuk LIPA tidak diubah, dan ALETA tidak mengirimkannya.",
  },
  LP05: {
    kunci: "lipaEksekusi",
    sifat: "sebagian",
    catatan:
      "Kelengkapan bahannya di SIPP terukur. Penyusunan angka laporannya sendiri tetap di tangan operator laporan - bentuk LIPA tidak diubah, dan ALETA tidak mengirimkannya.",
  },
  LP06: {
    kunci: "lipaKegiatanHakim",
    sifat: "sebagian",
    catatan:
      "Kelengkapan bahannya di SIPP terukur. Penyusunan angka laporannya sendiri tetap di tangan operator laporan - bentuk LIPA tidak diubah, dan ALETA tidak mengirimkannya.",
  },
  LP07: {
    kunci: "lipaKeuanganPerkara",
    sifat: "sebagian",
    catatan:
      "Kelengkapan bahannya di SIPP terukur. Penyusunan angka laporannya sendiri tetap di tangan operator laporan - bentuk LIPA tidak diubah, dan ALETA tidak mengirimkannya.",
  },
  LP12: {
    kunci: "lipaPelaksanaanMediasi",
    sifat: "sebagian",
    catatan:
      "Kelengkapan bahannya di SIPP terukur. Penyusunan angka laporannya sendiri tetap di tangan operator laporan - bentuk LIPA tidak diubah, dan ALETA tidak mengirimkannya.",
  },
  LP13: {
    kunci: "lipaPenerbitanAktaCerai",
    sifat: "sebagian",
    catatan:
      "Kelengkapan bahannya di SIPP terukur. Penyusunan angka laporannya sendiri tetap di tangan operator laporan - bentuk LIPA tidak diubah, dan ALETA tidak mengirimkannya.",
  },
  LP15: {
    kunci: "lipaPembebasanBiaya",
    sifat: "sebagian",
    catatan:
      "Kelengkapan bahannya di SIPP terukur. Penyusunan angka laporannya sendiri tetap di tangan operator laporan - bentuk LIPA tidak diubah, dan ALETA tidak mengirimkannya.",
  },
  LP17: {
    kunci: "lipaBiayaProses",
    sifat: "sebagian",
    catatan:
      "Kelengkapan bahannya di SIPP terukur. Penyusunan angka laporannya sendiri tetap di tangan operator laporan - bentuk LIPA tidak diubah, dan ALETA tidak mengirimkannya.",
  },
  LP22: {
    kunci: "lipaDispensasiKawin",
    sifat: "sebagian",
    catatan:
      "Kelengkapan bahannya di SIPP terukur. Penyusunan angka laporannya sendiri tetap di tangan operator laporan - bentuk LIPA tidak diubah, dan ALETA tidak mengirimkannya.",
  },
  KT06: {
    kunci: "ketaatanTenggangPanggilan",
    sifat: "penuh",
    catatan: "",
  },
  IN01: {
    kunci: "putusanTidakDiubahSesudahMinutasi",
    sifat: "penuh",
    catatan: "",
  },
  KT10: {
    kunci: "kelengkapanBeritaAcaraSidang",
    sifat: "sebagian",
    catatan:
      "Butir ini menuntut JARAK WAKTU antara sidang dan selesainya berita acara. Yang sudah dibangun baru memeriksa keberadaannya, belum ketepatan waktunya.",
  },
  IN07: {
    kunci: "kelengkapanRuasWajibPerkara",
    sifat: "sebagian",
    catatan:
      "Butir ini mencakup SELURUH ruas wajib perkara. Yang diperiksa baru dua - amar dan petitum - dan daftar ruas wajib yang sebenarnya belum ditetapkan siapa pun.",
  },
  IN08: {
    kunci: "kelengkapanDokumenElektronik",
    sifat: "sebagian",
    catatan:
      "Yang diperiksa baru keberadaan berkas amar putusan dan anonimisasinya. Butir ini juga menuntut dokumen lain - salinan putusan, penetapan - yang belum diperiksa.",
  },
  IN09: {
    kunci: "kewajaranUrutanTanggalPutusan",
    sifat: "penuh",
    catatan: "",
  },
  IN13: {
    kunci: "perkaraTanpaDataSaksi",
    sifat: "sebagian",
    catatan:
      "Butir ini seharusnya hanya berlaku bagi perkara yang memang melalui pembuktian dengan saksi. Yang dinilai sekarang seluruh perkara, sehingga perkara yang putus verstek atau dicabut ikut terhitung tanpa saksi.",
  },
  AP01: {
    kunci: "raporMajelisHakim",
    sifat: "sebagian",
    catatan:
      "Butir ini menuntut lama penyelesaian, penundaan, dan tingkat upaya hukum. Yang tersusun baru sebelas penilaian ketaatan tahapan; ketiga hal itu belum ada penilaiannya.",
  },
  AP02: {
    kunci: "raporHakimPerorangan",
    sifat: "sebagian",
    catatan:
      "Butir ini menuntut jumlah perkara ditangani dan kecepatan penyelesaiannya. Yang tersusun baru ketaatan tahapan; kecepatan penyelesaian belum ada penilaiannya.",
  },
  AP03: {
    kunci: "raporPaniteraPengganti",
    sifat: "sebagian",
    catatan:
      "Butir ini menuntut jarak sidang ke berita acara dan ketepatan agenda. Yang tersusun baru ketaatan tahapan; jarak sidang ke berita acara menunggu KT10 dibangun penuh.",
  },
  AP04: {
    kunci: "raporJurusita",
    sifat: "sebagian",
    catatan:
      "Butir ini menuntut tingkat relaas retur yang DISESUAIKAN tingkat kesulitan wilayah. Penyesuaian itu menuntut daftar radius yang belum dibakukan, dan relaas retur belum ada penilaiannya.",
  },
  ST02: {
    kunci: "sebaranJenisPerkara",
    sifat: "penuh",
    catatan: "",
  },
  ST03: {
    kunci: "sebaranAmarPutusan",
    sifat: "penuh",
    catatan: "",
  },
  ST09: {
    kunci: "sebaranWilayahKecamatan",
    sifat: "sebagian",
    catatan:
      "Sebarannya berjalan, tetapi bertumpu pada ruas kecamatan yang diketik bebas dan hanya terisi 32,2 persen. Butir ini belum dapat menjawab wilayah mana yang paling banyak berperkara sampai daftar kecamatannya dibakukan.",
  },
  ST13: {
    kunci: "sebaranVerstek",
    sifat: "penuh",
    catatan: "",
  },
  KU03: {
    kunci: "sisaPanjarSudahDikembalikan",
    sifat: "penuh",
    catatan: "",
  },
  KU01: {
    kunci: "panjarTercatatSetiapPerkara",
    sifat: "sebagian",
    catatan:
      "Butir ini menuntut penerimaan panjar dirinci menurut jenis perkara. Yang sudah dibangun baru memeriksa bahwa tiap perkara punya sekurangnya satu penerimaan.",
  },
  KU02: {
    kunci: "pengeluaranTidakMelebihiPenerimaan",
    sifat: "sebagian",
    catatan:
      "Butir ini menuntut RINCIAN pengeluaran dari panjar. Yang sudah dibangun baru memeriksa bahwa pengeluaran tidak melebihi penerimaannya.",
  },
};

/**
 * Penilaian yang sudah dibangun tetapi TIDAK ada butirnya di katalog.
 *
 * Didaftarkan di sini dengan sengaja. Penilaian yang berjalan tanpa tercatat
 * di mana pun adalah pekerjaan yang tidak dapat dipertanggungjawabkan - dan
 * pada suatu hari tidak ada yang tahu mengapa ia ada.
 */
const DI_LUAR_KATALOG = {
  kelengkapanAmarPutusan:
    "Memeriksa keterisian ruas amar putusan saja. Semula disambungkan ke IN07, lalu digantikan kelengkapanRuasWajibPerkara yang memeriksa amar bersama petitum sekaligus. Yang lama tetap berjalan karena butir per-ruas berguna saat menelusuri ruas mana yang kosong.",
  asasPenyelesaianLimaBulan:
    "Asas penyelesaian lima bulan menurut SEMA 2 Tahun 2014. Katalog memuat MP15 - indeks risiko melampaui lima bulan - tetapi itu DUGAAN ke depan, bukan pengukuran ketaatan yang sudah terjadi. Keduanya berbeda dan keduanya berguna.",
  kelengkapanPertimbanganHukum:
    "Ikut menyusun IN07 bersama kelengkapan amar putusan. Didaftarkan terpisah karena satu butir katalog hanya dapat menunjuk satu penilaian, sedangkan keduanya berdiri sendiri-sendiri.",

  // ==========================================================================
  // KETEPATAN PENGINPUTAN - SEPARUH YANG SELAMA INI HILANG DARI EMPAT BUTIR
  // ==========================================================================
  //
  // KT02, KT03, KT04, dan KT11 menyebutkan sendiri bahwa yang mereka tuntut
  // adalah tanggal PENGINPUTAN, sementara yang dinilai baru tanggal
  // peristiwanya. Keempat penilaian di bawah mengisi separuh yang hilang itu.
  //
  // Didaftarkan terpisah, bukan menggantikan sambungan yang ada, karena satu
  // butir katalog hanya dapat menunjuk satu penilaian - sedangkan keduanya
  // mengukur hal yang berbeda dan keduanya diperlukan. Penetapan bertanggal 3
  // Januari yang baru diketik 20 Januari patuh menurut yang satu dan terlambat
  // menurut yang lain, dan kedua keterangan itu sama-sama benar.
  ketepatanInputPenetapanMajelis:
    "Jarak antara tanggal penetapan majelis dan saat ia diketik ke SIPP. Mengisi separuh KT02 yang menuntut tanggal penginputan; separuh lainnya - keberadaan dokumen penetapannya - masih belum.",
  ketepatanInputPaniteraPengganti:
    "Jarak antara tanggal penunjukan panitera pengganti dan saat ia diketik ke SIPP. Inilah yang dituntut KT03 dan selama ini tidak terukur.",
  ketepatanInputJurusita:
    "Jarak antara tanggal penunjukan jurusita dan saat ia diketik ke SIPP. Inilah yang dituntut KT04 dan selama ini tidak terukur.",
  ketepatanInputPenetapanHariSidang:
    "Jarak antara tanggal penetapan hari sidang dan saat ia diketik ke SIPP. Mengisi separuh KT05. Yang dinilai penetapan PERTAMA; penundaan dan penetapan hari sidang berikutnya tidak ikut, sebab keduanya peristiwa yang berbeda.",
  ketepatanInputPutusan:
    "Jarak antara pengucapan putusan dan saat ia diketik ke SIPP. Mengisi separuh KT11; sambungan KT11 yang ada mengukur jarak pendaftaran ke putusan, ukuran yang sah tetapi menjawab pertanyaan yang lain.",
};

/**
 * ============================================================================
 * SAMBUNGAN KE KEMAMPUAN MESIN - KHUSUS BAB 1
 * ============================================================================
 *
 * Bab 1 berbeda dari sebelas bab lainnya. Sebelas bab itu MENGUKUR
 * pengadilan, dan tiap butirnya wajar disambungkan ke satu penilaian. Bab 1
 * mengukur MESINNYA sendiri - apakah ada periode tujuh jendela, apakah tiap
 * angka dapat dibuka menjadi buktinya, apakah nilai berpenyebut terlalu kecil
 * ditahan.
 *
 * Kemampuan semacam itu bukan penilaian. Tidak ada kunci penilaian untuk
 * ditunjuk, sehingga selama sambungan hanya berbentuk SAMBUNGAN, keenam butir
 * Bab 1 jatuh ke "belum" - bukan karena belum dikerjakan, melainkan karena
 * tidak ada tempat menyebutkannya.
 *
 * Akibatnya papan e-Audit MENGECILKAN dirinya sendiri. Bab 1 tertulis 0 dari
 * 6, padahal MS01, MS03, MS04, dan MS05 sudah tertanam sebagai kontrak yang
 * ditegakkan saat pendaftaran - kerangkaPenilaianService bahkan menyebut
 * nomor butirnya di kepala berkasnya sendiri.
 *
 * Papan yang salah menyebut sisa pekerjaannya sama merusaknya dengan papan
 * yang menyembunyikannya: yang satu membuat orang menyangka pekerjaannya
 * sudah selesai, yang lain membuat orang mengerjakan ulang apa yang sudah ada.
 *
 * ============================================================================
 * TETAP DIHITUNG, TIDAK DITULIS
 * ============================================================================
 *
 * Aturan katalog ini sejak semula: keadaan dihitung dari kenyataan, bukan
 * ditulis tangan. Aturan itu berlaku juga di sini - nama kemampuan di bawah
 * hanya berarti bila kemampuannya benar-benar TERBUKTI, dan pembuktiannya
 * dikerjakan kemampuanMesinService dengan MENJALANKAN kemampuan itu, bukan
 * dengan membaca keberadaan namanya.
 *
 * Katalog ini sengaja tidak memanggilnya sendiri: ia daftar, bukan mesin.
 * Yang memanggil pemeriksanya adalah rute gerbang, sama seperti ia yang
 * mengumpulkan daftar penilaian terdaftar.
 */
const KEMAMPUAN = {
  MS01: {
    kemampuan: "periodeTujuhJendela",
    sifat: "penuh",
    catatan:
      "Tujuh jendela waktu - harian sampai tahunan - dijalankan atas satu tanggal acuan, dan seluruhnya menghasilkan satuan beserta rentang terbacanya.",
  },
  MS02: {
    kemampuan: "raporBerjenjang",
    sifat: "penuh",
    catatan:
      "Satu nilai dipecah menurut jenjangnya, dan rapor yang tidak menyebut dimensinya ditolak saat didaftarkan. Angka gabungan antar penilaian sengaja TIDAK disediakan - pembobotan adalah kewenangan pimpinan pengadilan.",
  },
  MS03: {
    kemampuan: "riwayatNilaiTersimpan",
    sifat: "penuh",
    catatan:
      "Nilai disimpan per periode beserta sidik aturan yang berlaku saat itu, dan hitungan ulangnya dapat disandingkan dengan yang tersimpan.",
  },
  MS04: {
    kemampuan: "wajibMenyebutBukti",
    sifat: "penuh",
    catatan:
      "Penilaian tanpa baris() DITOLAK saat didaftarkan - dibuktikan dengan menyodorkan definisi tanpa bukti dan memastikan ia ditolak, bukan dengan membaca kodenya.",
  },
  MS05: {
    kemampuan: "pembatasPenyebut",
    sifat: "penuh",
    catatan:
      "Penyebut di bawah dua puluh menahan nilainya dan menampilkan daftarnya - dibuktikan dengan meminta nilai atas penyebut sembilan belas dan memastikan yang kembali bukan nilai.",
  },
  MS06: {
    kemampuan: "berkasPengawasan",
    sifat: "penuh",
    catatan:
      "Nilai, bukti, temuan, tanggal hitung, dan aturan yang berlaku dirangkai menjadi satu berkas; berkas yang kurang satu bagian ditolak beserta sebabnya, tidak dikirim setengah.",
  },
};

/* ==========================================================================
 * PEMBACAAN
 * ========================================================================== */

function daftarBab() {
  return BAB.map((b) => ({
    ...b,
    jumlah: KATALOG.filter((x) => x.bab === b.no).length,
  }));
}

function daftarButir(bab) {
  const n = Number(bab);
  return Number.isFinite(n) && n > 0 ? KATALOG.filter((x) => x.bab === n) : KATALOG.slice();
}

function butir(kode) {
  const k = String(kode || "").trim().toUpperCase();
  return KATALOG.find((x) => x.kode === k) || null;
}

/** Arti huruf bentuk sajian sebuah butir, terurut sebagaimana ditulis. */
function bentukTerbaca(kodeBentuk) {
  return String(kodeBentuk || "")
    .split("")
    .map((h) => ({ huruf: h, arti: Object.prototype.hasOwnProperty.call(BENTUK, h) ? BENTUK[h] : null }));
}

/**
 * Keadaan seluruh katalog, DIHITUNG - bukan ditulis.
 *
 * @param terdaftar daftar kunci penilaian yang benar-benar terdaftar di mesin
 */
function keadaan(terdaftar, kemampuanTerpenuhi) {
  const ada = new Set((terdaftar || []).map(String));
  const mampu = new Set((kemampuanTerpenuhi || []).map(String));

  const perButir = KATALOG.map((b) => {
    // Kemampuan mesin diperiksa LEBIH DAHULU. Butir Bab 1 tidak punya kunci
    // penilaian untuk ditunjuk, dan tanpa jalur ini ia selamanya "belum".
    const m = Object.prototype.hasOwnProperty.call(KEMAMPUAN, b.kode) ? KEMAMPUAN[b.kode] : null;
    if (m) {
      if (!mampu.has(m.kemampuan)) {
        // Sama seperti sambungan yang menunjuk penilaian tidak terdaftar:
        // kemampuan yang disebut tetapi tidak terbukti adalah TEMUAN, bukan
        // hal yang boleh dianggap "belum" begitu saja.
        return {
          kode: b.kode,
          bab: b.bab,
          keadaan: "putus",
          kunci: m.kemampuan,
          catatan: `disandarkan pada kemampuan "${m.kemampuan}" tetapi kemampuan itu tidak terbukti saat diperiksa`,
        };
      }
      return { kode: b.kode, bab: b.bab, keadaan: m.sifat, kunci: m.kemampuan, catatan: m.catatan };
    }

    const s = Object.prototype.hasOwnProperty.call(SAMBUNGAN, b.kode) ? SAMBUNGAN[b.kode] : null;
    if (!s) return { kode: b.kode, bab: b.bab, keadaan: "belum", kunci: null, catatan: "" };
    if (!ada.has(s.kunci)) {
      // Sambungan yang menunjuk penilaian tidak terdaftar - itu temuan, bukan
      // hal yang boleh dianggap "belum" begitu saja.
      return {
        kode: b.kode,
        bab: b.bab,
        keadaan: "putus",
        kunci: s.kunci,
        catatan: `disambungkan ke "${s.kunci}" tetapi penilaian itu tidak terdaftar di mesin`,
      };
    }
    return { kode: b.kode, bab: b.bab, keadaan: s.sifat, kunci: s.kunci, catatan: s.catatan };
  });

  const hitung = (k) => perButir.filter((x) => x.keadaan === k).length;

  // Penilaian terdaftar yang tidak disebut katalog maupun daftar di luar katalog.
  const disebut = new Set(Object.values(SAMBUNGAN).map((x) => x.kunci));
  Object.keys(DI_LUAR_KATALOG).forEach((k) => disebut.add(k));
  const tanpaTempat = [...ada].filter((k) => !disebut.has(k));

  return {
    jumlahButir: KATALOG.length,
    penuh: hitung("penuh"),
    sebagian: hitung("sebagian"),
    belum: hitung("belum"),
    putus: hitung("putus"),
    diLuarKatalog: Object.keys(DI_LUAR_KATALOG).length,
    tanpaTempat,
    perButir,
  };
}

/* ==========================================================================
 * PEMERIKSAAN DIRI
 * ========================================================================== */

/**
 * Cela pada katalog itu sendiri.
 *
 * Dijalankan penjaga, bukan saat melayani permintaan - katalog yang cacat
 * harus ketahuan sebelum dipasang, bukan sesudah dibuka orang.
 */
function celaKatalog() {
  const cela = [];
  const terlihat = new Set();

  KATALOG.forEach((b, i) => {
    const di = `butir ke-${i + 1} (${b.kode})`;
    if (!/^[A-Z]{2}\d{2}$/.test(b.kode)) cela.push(`${di}: kode tidak berbentuk dua huruf dua angka`);
    if (terlihat.has(b.kode)) cela.push(`${di}: kode kembar`);
    terlihat.add(b.kode);

    if (!BAB.some((x) => x.no === b.bab)) cela.push(`${di}: bab ${b.bab} tidak ada`);
    if (!b.nama || b.nama.length < 5) cela.push(`${di}: nama terlalu pendek`);
    if (!b.keterangan || b.keterangan.length < 15) cela.push(`${di}: keterangan terlalu pendek untuk menerangkan apa pun`);
    if (!LANTAI_SAH.has(b.lantai)) cela.push(`${di}: lantai "${b.lantai}" tidak dikenali`);
    if (!Object.prototype.hasOwnProperty.call(MUTU_RUAS, b.mutuRuas)) {
      cela.push(`${di}: mutuRuas "${b.mutuRuas}" tidak dikenali`);
    }
    if (!b.bentuk) cela.push(`${di}: tanpa bentuk sajian`);
    else {
      [...b.bentuk].forEach((h) => {
        if (!Object.prototype.hasOwnProperty.call(BENTUK, h)) cela.push(`${di}: huruf bentuk "${h}" tidak dikenali`);
      });
    }
    if (!b.satuanBaris && !Object.prototype.hasOwnProperty.call(TANPA_SATUAN_BARIS, b.kode)) {
      cela.push(`${di}: tanpa satuan baris, dan tidak ada alasan tertulis untuk itu`);
    }
    if (b.satuanBaris && Object.prototype.hasOwnProperty.call(TANPA_SATUAN_BARIS, b.kode)) {
      cela.push(`${di}: punya satuan baris tetapi masih tercantum sebagai pengecualian - cabut pengecualiannya`);
    }
  });

  // Sambungan harus menunjuk butir yang ada, dan yang "sebagian" wajib
  // menyebutkan apa yang masih kurang.
  Object.entries(SAMBUNGAN).forEach(([kode, s]) => {
    if (!terlihat.has(kode)) cela.push(`sambungan "${kode}" menunjuk butir yang tidak ada di katalog`);
    if (s.sifat !== "penuh" && s.sifat !== "sebagian") cela.push(`sambungan "${kode}": sifat "${s.sifat}" tidak dikenali`);
    if (s.sifat === "sebagian" && (!s.catatan || s.catatan.length < 30)) {
      cela.push(`sambungan "${kode}": sifat sebagian WAJIB menyebutkan apa yang masih kurang`);
    }
    if (s.sifat === "penuh" && s.catatan) {
      cela.push(`sambungan "${kode}": sifat penuh tidak boleh membawa catatan kekurangan`);
    }
  });

  Object.entries(TANPA_SATUAN_BARIS).forEach(([kode, alasan]) => {
    if (!terlihat.has(kode)) cela.push(`pengecualian satuan baris "${kode}" menunjuk butir yang tidak ada`);
    if (!alasan || alasan.length < 40) {
      cela.push(`pengecualian satuan baris "${kode}" wajib menyebutkan sebabnya panjang lebar`);
    }
  });

  Object.entries(DI_LUAR_KATALOG).forEach(([kunci, alasan]) => {
    if (!alasan || alasan.length < 40) {
      cela.push(`penilaian di luar katalog "${kunci}" wajib menyebutkan alasannya panjang lebar`);
    }
  });

  return cela;
}

module.exports = {
  BAB,
  TANPA_SATUAN_BARIS,
  BENTUK,
  MUTU_RUAS,
  KATALOG,
  SAMBUNGAN,
  KEMAMPUAN,
  DI_LUAR_KATALOG,
  daftarBab,
  daftarButir,
  butir,
  bentukTerbaca,
  keadaan,
  celaKatalog,
};
