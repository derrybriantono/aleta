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
 * Enam penanda tidak dapat dimatikan siapa pun:
 *
 *   retur                 relaas kembali; panggilan HARUS diulang atau
 *                         sidangnya batal
 *   belum dipanggil       masih ada pihak yang wajib dipanggil dan
 *                         relaasnya belum ada
 *   tenggang mepet        panggilannya ada, tetapi jaraknya ke hari sidang
 *                         kurang dari ambang jalurnya - tidak patut
 *   belum minutasi        perkara sudah putus, berkasnya belum dijahit
 *   belum unggah putusan  naskahnya belum ada di SIPP
 *   belum ditunda (15:00) hasil sidang belum dicatat sesudah pukul 15:00
 *                         WITA; agenda sidang berikutnya tidak terbentuk
 *
 * Sebabnya bukan kerapian. Saklar yang dimatikan hari ini tidak dinyalakan
 * lagi besok - ia tersimpan di peramban dan dilupakan - sehingga penanda yang
 * dimatikan sekali menjadi penanda yang tidak pernah terlihat lagi. Untuk
 * keterangan yang sekadar menolong itu tidak merugikan. Untuk keenam hal di
 * atas, akibatnya perkara yang batal sidangnya, berkas yang tidak pernah
 * dijahit, atau hasil sidang yang tidak pernah dicatat, dan tidak ada apa pun
 * di layar yang akan menyebutkannya.
 *
 * Aturannya satu dan dijaga uji: tiap kotak keadaan bernada MERAH di layar
 * (NADA_PERLU_DIPERIKSA) punya saklar wajib yang sekunci. Tenggang mepet masuk
 * 2.34.0 sebagai kotak merah dan lupa didaftarkan di sini - panel saklar diam
 * tentangnya selama satu rilis. Kotak gabungan "Perlu diperiksa" TIDAK punya
 * saklar sama sekali: ia daftar pekerjaan hari itu, satu-satunya yang
 * menjawab "hari ini beres atau belum" sejak papan "Perlu ditindaklanjuti"
 * dihapus (24 September 2026).
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

// "Tombol dan alat" dipecah dua pada 24 September 2026: tombol yang hidup di
// tiap BARIS (tunda|putus, mediator, antrian, konseptor) dan alat yang hidup
// sekali di ATAS tabel (skor, cetak, antrian, layar). Memindahkan saklar antar
// kelompok aman - simpanan peramban hanya berkunci `kunci` saklarnya.
export const KELOMPOK_TAMPILAN = [
  { kunci: "penanda", label: "Penanda pada baris" },
  { kunci: "keterangan", label: "Keterangan tambahan" },
  { kunci: "alat", label: "Tombol pada baris" },
  { kunci: "atas", label: "Di atas tabel" },
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
    // Merah sejak 2.34.0 dan ikut "Perlu diperiksa", tetapi tidak pernah
    // didaftarkan di sini. Wajib dengan sebab yang sama dengan retur:
    // panggilan yang tenggangnya kurang tidak patut - sidangnya harus ditunda
    // dan panggilannya diulang.
    kunci: "tenggang-mepet",
    label: "Tenggang mepet",
    keterangan:
      "Lencana H-n, \"sidang hari ini\", atau \"lewat n hari\" di samping nomor perkara, beserta kotak saringnya: jarak panggilan ke hari sidang kurang dari ambang jalurnya.",
    kelompok: "penanda",
    wajib: true,
  },
  {
    // Diminta pengguna 24 September 2026. Wajib dengan alasan yang sama
    // dengan retur: ia anggota kotak gabungan "Perlu diperiksa", dan tanda
    // yang dimatikan sekali tidak pernah terlihat lagi - sementara sidang yang
    // hasilnya tidak dicatat tidak punya agenda berikutnya. Tanda ini hanya
    // hidup sesudah 15:00 pada hari sidangnya sendiri; saklar mati yang
    // tersimpan akan membuatnya bisu tepat pada satu-satunya saat ia berguna.
    kunci: "belum-tunda-lewat-batas",
    label: "Belum ditunda lewat 15:00",
    keterangan:
      "Tanda merah pada baris sidang yang sudah lewat pukul 15:00 WITA pada hari sidangnya tetapi hasilnya belum dicatat - belum ditunda, belum diputus. Ikut dihitung di kotak Perlu diperiksa.",
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
  // Warna TULISAN, bukan lencana. Sel Agenda tidak mendapat kotak baru, dan
  // lencana berlatar merah (retur, belum dipanggil) tetap satu-satunya yang
  // berlatar merah. Bawaannya MENYALA: yang diminta pengguna adalah warnanya,
  // dan saklar ini hanya jalan keluar bagi yang merasa merahnya terlalu ramai
  // - misalnya hari itsbat terpadu, ketika 15 dari 19 sidang e-Litigasi.
  {
    kunci: "agenda-elitigasi",
    label: "Agenda e-Litigasi merah",
    keterangan:
      "Tulisan agenda berwarna merah pada sidang e-Litigasi - perkara e-Court yang agendanya jawaban, replik, duplik, kesimpulan, musyawarah majelis, atau pembacaan putusan/penetapan, selain sidang pertama. Aturannya sama dengan kotak e-Litigasi.",
    kelompok: "penanda",
  },
  // ==========================================================================
  // KETERANGAN INI TERTINGGAL SATU RILIS DI BELAKANG LENCANANYA
  // ==========================================================================
  //
  // Sampai 25 September 2026 keterangannya hanya menyebut potongan mediasi.
  // Padahal lencananya sudah tumbuh tiga bagian yang tidak disebutkannya:
  // potongan 120 hari perkara ghaib, angka kedua "· dari N", dan lencana merah
  // "lewat 5 bulan".
  //
  // Akibatnya terukur, bukan dikira. Di sipp_donggala pada 25 September 2026
  // ada 127 perkara belum putus, 13 di antaranya ghaib - dan hitungWaktuPutus
  // menjepit potongannya sehingga 12 dari 13 berhenti di hariBersih = 1.
  // 322/Pdt.G/2026 berjalan 115 hari dan lencananya berbunyi "1 hari · dari
  // 115": angkanya turun 114 hari. Seluruh 13 perkara itu TIDAK bermediasi
  // sama sekali (0 baris perkara_mediasi), jadi "hari mediasi tidak dihitung"
  // bukan sekadar keterangan yang kurang - ia keterangan yang MENYESATKAN,
  // sebab ia menunjuk satu-satunya potongan yang justru nol di sana.
  //
  // Panitera yang membuka panel ini untuk mencari tahu mengapa layar berbunyi
  // "1 hari" karena itu dijawab dengan aturan yang tidak dipakai pada
  // perkaranya. Dasar hukum kedua potongan disebutkan supaya angkanya dapat
  // ditelusuri ke sumbernya, bukan diterima begitu saja.
  //
  // Dijaga tampilan-antrian-sidang.test.ts, yang MENJALANKAN hitungWaktuPutus
  // bot atas ke-13 umur yang terukur itu - bukan menyisir teks berkas ini.
  // Tidak adanya penjaga itulah sebab keterangan ini dapat tertinggal tanpa
  // satu pun uji merah.
  {
    kunci: "umur-perkara",
    label: "Umur perkara",
    keterangan:
      "Lencana jumlah hari di bawah agenda, berwarna menurut pita Waktu Putus SK Dirjen Badilag 048/DJA/SK.KP3.4.3/IV/2024: hijau, kuning, oranye, merah. Hari mediasi tidak dihitung (PERMA 1/2016 Pasal 24), dan perkara ghaib dipotong 120 hari lagi sebagai kelonggaran SK 048/2024 Tabel 2 nomor 1 - potongan itulah sebabnya perkara yang berjalan 115 hari dapat berbunyi \"1 hari\". Pada baris berkelonggaran lencananya menyebut angka kedua \"· dari N\", yaitu hari di luar mediasi TANPA potongan tersebut. Mematikan saklar ini ikut menyembunyikan lencana merah \"lewat 5 bulan\" - batas lima bulan SEMA 2/2014, yang tidak mengenal kelonggaran ghaib dan menagih laporan kepada Ketua Pengadilan. Rinciannya tetap ada di panel Rincian.",
    kelompok: "penanda",
  },
  {
    kunci: "menunggu-lama",
    label: "Menunggu lama",
    keterangan:
      "Lencana \"menunggu N menit\" di kolom Antrian bila pihaknya sudah mengambil nomor 40 menit lebih dan belum dipanggil masuk.",
    kelompok: "penanda",
  },
  // Perbaikan 2 Okt 2026 sore (butir 4). Tanda "online" sudah ada sebelumnya
  // TANPA saklar dan selalu tampil; kini berupa ikon ponsel dan dapat
  // dimatikan. Bawaannya MENYALA - tidak ada yang hilang bagi pemakai lama.
  {
    kunci: "tanda-antrian-online",
    label: "Tanda antrian online",
    keterangan:
      "Ikon ponsel di kolom Antrian/Jam (dan satu kalimat di panel Rincian) bila nomor antriannya diambil lewat antrian online, bukan di loket/anjungan. Keterangan beserta jam ambilnya ada di tooltip. Kotak saring Antrian online tidak terpengaruh.",
    kelompok: "penanda",
  },
  // --- 6 Okt 2026 (butir 10): saklar untuk penanda yang baru ---------------
  {
    kunci: "verifikasi-majelis",
    label: "Verifikasi majelis e-Litigasi",
    keterangan:
      "Lencana di samping nomor perkara pada sidang e-Litigasi hari ini: sudah diverifikasi (hijau), belum diverifikasi (kuning), belum upload (jingga), tidak konek (abu).",
    kelompok: "penanda",
  },
  {
    kunci: "cc-tidak-sinkron",
    label: "Court Calendar tidak sinkron",
    keterangan:
      "Lencana merah di samping nomor perkara e-Litigasi bila Court Calendar-nya belum dibuat, tidak memuat tanggal sidang ini, atau tujuan agendanya berbeda (kalimat tidak harus sama). Merah = menuntut tindakan: para pihak membaca jadwal yang salah di e-Court.",
    kelompok: "penanda",
    // Merah, sama dengan retur/belum dipanggil: tiap kotak merah punya saklar
    // wajib yang sekunci (dijaga tampilan-antrian-sidang.test.ts).
    wajib: true,
  },
  {
    kunci: "penanda-mediasi",
    label: "Pernah mediasi",
    keterangan:
      "Penanda biru \"Mediasi\" di kolom Agenda bila perkaranya pernah bermediasi (mediator ditunjuk pada atau sebelum hari sidang itu). Ditekan = membuka Status Perkara.",
    kelompok: "penanda",
  },
  {
    kunci: "hasil-mediasi",
    label: "Hasil mediasi",
    keterangan:
      "Penanda hasil mediasi di kolom Agenda, hanya pada agenda laporan hasil mediasi: berhasil dengan perdamaian (hijau), berhasil sebagian (hijau muda), berhasil dengan pencabutan (hijau toska), tidak berhasil (merah), tidak dapat dilaksanakan (abu).",
    kelompok: "penanda",
  },
  // Butir 4 (6 Okt 2026): dibaca dari jawaban & duplik Tergugat di arsip
  // e-Court. Satu saklar untuk keduanya - keduanya menjawab pertanyaan yang
  // sama ("apa yang diajukan Tergugat selain bantahan pokok perkara").
  {
    kunci: "penanda-jawaban",
    label: "Eksepsi & rekonvensi",
    keterangan:
      "Penanda \"eksepsi\" (jingga berbingkai) dan \"rekonvensi\" (biru tua) di kolom Agenda bila jawaban atau duplik Tergugat/Termohon di arsip e-Court mengajukannya - dibaca ALETA dari naskahnya, pindaian lewat OCR. Tooltip menyebut dokumen dan kalimat pemicunya; ditekan = membuka Status Perkara. Yang belum atau tidak dapat dibaca tidak diberi penanda apa pun (bukan berarti tidak ada).",
    kelompok: "penanda",
  },
  /* === 12OKT-K: penanda Sita (butir 22-24) === */
  {
    kunci: "penanda-sita",
    label: "Sita",
    keterangan:
      "Lencana kuning \"Sita Jaminan\", \"Sita Revindikasi\", \"Sita Marital\", \"Sita Eksekusi\" (atau \"Sita\" + sebutan aslinya) di kolom Agenda, di bawah Eksepsi/Rekonvensi - dibaca dari petitum primer (permohonan sita / \"sah dan berharga sita\") dan dari catatan sita SIPP. Tooltip memuat kutipan butir petitumnya; ditekan = membuka Status Perkara. Juga bagian Sita di rincian dan Status Perkara. Bagian Eksekusi punya saklar sendiri (Eksekusi).",
    kelompok: "penanda",
  },
  /* === 12OKT-N: Eksekusi dipisah dari Sita (keputusan 5) === */
  {
    kunci: "penanda-eksekusi",
    label: "Eksekusi",
    keterangan:
      "Bagian Eksekusi di rincian Jadwal Sidang dan Status Perkara: register eksekusi SIPP (nomor, permohonan, jenis, tahapan) beserta putusan yang dieksekusi. Terpisah dari lencana Sita di kolom Agenda.",
    kelompok: "penanda",
  },
  /* === AKHIR 12OKT-N === */
  /* === AKHIR 12OKT-K === */
  {
    kunci: "pembebanan-ikrar",
    label: "Pembebanan ikrar talak",
    keterangan:
      "Lencana ungu di kolom Putusan pada sidang ikrar talak yang putusannya membebankan mut'ah, nafkah iddah, madliyah, nafkah anak, atau pembebanan lain. Rinciannya tetap ada di panel Rincian.",
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
  // (Yang ketiga, "petugas", ada di kelompok Keterangan tambahan - hingga 24
  // September 2026 keterangannya diam soal mode Ringkas, dan saklarnya tampak
  // rusak di mode Lengkap yang bawaan. Kini disebutkan juga.)
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
  // === 12OKT-C: saklar hasil audit butir 7 - penanda ===
  // Penanda yang SUDAH digambar tetapi belum punya saklar (diaudit 12 Okt 2026
  // dengan membandingkan SAKLAR_TAMPILAN dengan yang digambar layar). Bawaannya
  // MENYALA: tidak ada yang hilang bagi pemakai lama.
  {
    kunci: "penanda-verzet",
    label: "Verzet",
    keterangan:
      "Lencana merah \"verzet\" di samping nomor perkara bila perkaranya perlawanan terhadap putusan verstek (tenggang dan pihak yang melawan berbeda dari perkara biasa).",
    kelompok: "penanda",
  },
  {
    kunci: "lencana-putusan-ecourt",
    label: "Putusan e-Court belum beres",
    keterangan:
      "Lencana di baris penanda kolom Perkara (di bawah jenis perkara) pada perkara yang sudah putus: putusannya belum diunggah ke e-Court atau belum bertanda tangan elektronik. Diam bila tidak ada yang perlu dikerjakan. Mematikannya juga menghentikan pemeriksaan keadaan putusan ke e-Court per baris.",
    kelompok: "penanda",
  },
  // === AKHIR 12OKT-C ===
  // 12 Okt 2026 (antrian sidang butir 5): ghaib, prodeo, dan non e-Court di
  // samping nomor perkara; e-Court tidak diberi tanda karena itu yang lazim.
  {
    kunci: "penanda-perkara",
    label: "Ghaib, prodeo, non e-Court",
    keterangan:
      "Lencana di samping nomor perkara: Ghaib (alamat pihak tidak diketahui), Prodeo (dibebaskan dari biaya), dan Non e-Court (perkara didaftarkan langsung di PTSP). Perkara e-Court tidak diberi tanda. Juga di rincian perkara.",
    kelompok: "penanda",
  },
  // 12 Okt 2026 (butir 5): pekerjaan pihak yang membawa kewajiban hukum
  // sendiri (izin/pemberitahuan atasan) - penggolongan sama dengan ABT.
  {
    kunci: "penanda-pekerjaan",
    label: "PNS, PPPK, TNI, POLRI, BUMN/BUMD",
    keterangan:
      "Lencana pekerjaan di samping nama pihak: PNS, PPPK, TNI, POLRI, BUMN, BUMD. Pensiunan, CPNS, dan PPPK paruh waktu tidak diberi lencana. Juga di rincian perkara.",
    kelompok: "penanda",
  },
  // 12 Okt 2026 (butir 18): nama pihak yang SUDAH hadir hari ini berwarna hijau
  // dan diberi "(hadir)". Jam kehadiran tetap di kolom Antrian ("P 09:21 T 08:37").
  {
    kunci: "pihak-hadir",
    label: "Pihak yang sudah hadir",
    keterangan:
      "Nama penggugat/pemohon atau tergugat/termohon yang sudah tercatat hadir hari ini di antrian diberi warna hijau dan tulisan \"(hadir)\" di kolom Perkara & Para Pihak dan di rincian. Jamnya tetap di kolom Antrian. Dibatalkan lewat Reset kehadiran = kembali normal.",
    kelompok: "penanda",
  },
  // === 12OKT-L: penanda pernah diskors (butir 25) ===
  {
    kunci: "pernah-diskors",
    label: "Pernah diskors",
    keterangan:
      "Ikon panah melingkar yang berputar di bawah tombol Selesai bila sidang perkara ini hari ini pernah diskors (walau sudah berjalan lagi atau selesai) atau sidang sebelumnya pernah diskors. Tooltip menyebut kapan diskors, berapa lama, catatannya, dan sidang tanggal berapa. Lencana \"diskors\" yang lama (selama masih diskors) tetap ada. Diam bila pengguna mematikan gerak di perangkatnya.",
    kelompok: "penanda",
  },
  // === AKHIR 12OKT-L ===

  // --- Keterangan tambahan -------------------------------------------------
  {
    kunci: "petugas",
    label: "Majelis, PP, juru sita, ruang",
    keterangan:
      "Baris Majelis, PP, JS, dan Ruang di bawah nomor perkara. Hanya tampil di mode Ringkas; di Lengkap keterangannya punya kolom sendiri (Majelis & Petugas).",
    kelompok: "keterangan",
  },
  // 12 Okt 2026 (butir 1): nama jenis perkara dengan kumulasinya, dari SIPP
  // atau - bila petugas lupa mengisinya - dibaca dari petitum.
  {
    kunci: "kumulasi-perkara",
    label: "Kumulasi perkara",
    keterangan:
      "Jenis perkara ditulis bersama kumulasinya, mis. \"Cerai Gugat Kumulasi Hak Asuh Anak\". Bila kumulasi tidak diisi di SIPP, ALETA membacanya dari petitum dan menandainya \"dari petitum\". Juga di Jadwal Mediasi, Status Perkara, dan rincian.",
    kelompok: "keterangan",
  },
  // 12 Okt 2026 (butir 6): mediator di bawah JS, di atas ruang.
  {
    kunci: "mediator-majelis",
    label: "Mediator di Majelis & Petugas",
    keterangan:
      "Nama mediator di bawah juru sita (di atas ruang) pada Majelis & Petugas, dan di rincian perkara. Hanya untuk perkara yang sudah ditunjuk mediatornya.",
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
    label: "Tiga jarak waktu",
    keterangan:
      "Tunggu (ambil nomor sampai dipanggil), Dari sebelumnya (jeda dari perkara sebelumnya di ruang yang sama), dan Lama sidang (sampai perkara berikutnya di ruang itu dipanggil) di kolom Antrian, beserta legendanya di atas tabel. Yang masih berjalan berdetak tiap detik. Lencana \"menunggu lama\" punya saklarnya sendiri.",
    kelompok: "keterangan",
  },
  {
    kunci: "urutan-sidang",
    label: "Sidang ke-N",
    keterangan: "Tulisan \"sidang ke-N\" di bawah agenda. Kotak saring Sidang pertama tidak terpengaruh.",
    kelompok: "keterangan",
  },
  {
    kunci: "hasil-tundaan",
    label: "Tundaan dan hasil sidang",
    keterangan:
      "Kotak kuning \"Ditunda sampai …\" beserta alasannya dan kotak hijau \"Hasil sidang\" di bawah nama pihak. Kotak saring Ditunda, tanda hijau baris yang selesai, dan kolom Putusan tidak terpengaruh.",
    kelompok: "keterangan",
  },
  {
    kunci: "rincian-antrian",
    label: "Jam ambil antrian",
    keterangan:
      "Jam ambil tiap sisi (P, T, Saksi) dan nama petugas pelayanan di bawah nomor antrian. Nomor antriannya dan tulisan \"dipanggil\" tetap tampil.",
    kelompok: "keterangan",
  },
  // F3.2 (17 Okt 2026): kehadiran rinci per orang - siapa, jam datang, saksi
  // datang berapa dari berapa, sedang disidang/pulang. Bawaan MENYALA.
  {
    kunci: "kehadiran-rinci",
    label: "Kehadiran rinci",
    keterangan:
      "Satu baris di kolom Antrian: \"Penggugat hadir 08.47 · Tergugat belum · Saksi P 1/2\" - pihak sendiri atau kuasanya, turut tergugat/intervensi, saksi tiap pihak dibanding yang diajukan di SIPP, sedang disidang, pulang. Dicatat lewat tombol Antrian (atau mesin antrian) dan menjadi usulan \"Dihadiri oleh\" saat Tunda/Putus serta usulan kehadiran BAS.",
    kelompok: "keterangan",
  },

  // === 12OKT-C: saklar hasil audit butir 7 - keterangan ===
  {
    kunci: "pihak-turut-intervensi",
    label: "Turut Tergugat & intervensi",
    keterangan:
      "Baris \"Turut T:\" dan \"Int:\" di bawah P dan T pada kolom Perkara, untuk perkara yang memiliki turut tergugat atau pihak intervensi. P dan T tetap tampil.",
    kelompok: "keterangan",
  },
  // === AKHIR 12OKT-C ===

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
      "Kolom skor kesiapan beserta kepala kolomnya. Dimatikan sejak awal - skornya hanya dihitung bila tombol Hitung skor ditekan. Hanya ada di mode Lengkap.",
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

  // --- Tombol pada baris ---------------------------------------------------
  {
    kunci: "tombol-tunda-putus",
    label: "Tombol tunda | putus",
    keterangan:
      "Dua tombol pencatat hasil di samping jenis perkara. Hasil sidang tetap dapat dicatat di layar hasil sidang atau di SIPP.",
    kelompok: "alat",
  },
  {
    kunci: "tombol-mediator",
    label: "Tombol mediator",
    keterangan:
      "Tombol Mediator (menunjuk mediator) - sejak 6 Okt 2026 HANYA pada sidang yang dihadiri kedua belah pihak untuk pertama kali. Keterangan mediasinya tetap ada di Status Perkara, bagian Mediasi.",
    kelompok: "alat",
  },
  // 12 Okt 2026 (butir 4): panggil saksi ke ruang sidang lewat layar panggil.
  {
    kunci: "panggil-saksi",
    label: "Panggil saksi",
    keterangan:
      "Nama saksi dapat ditekan untuk memanggilnya ke ruang sidang; pilih saksi mana yang dipanggil (satu, beberapa, atau semua saksi satu pihak).",
    kelompok: "alat",
  },
  {
    kunci: "court-calendar",
    label: "Court Calendar",
    keterangan:
      "Tautan \"Court Calendar\" di dasar kolom Agenda: lihat, susun dari rekomendasi ALETA, sunting, dan simpan ke SIPP. Hanya untuk panitera dan admin.",
    kelompok: "alat",
  },
  // 7 Okt 2026: penanda "belum upload" dapat ditekan. Mematikannya tidak
  // menyembunyikan penandanya - hanya tarikan sekarangnya; penarikan berkala
  // bot tetap berjalan.
  {
    kunci: "tarik-belum-upload",
    label: "Periksa e-Court dari \"belum upload\"",
    keterangan:
      "Penanda jingga \"belum upload\" dapat ditekan: ALETA langsung menarik ulang e-Court HANYA untuk perkara itu (daftar dokumen e-Litigasi + berkas baru ke arsip ALETA), lalu memperbarui penanda barisnya tanpa memuat ulang tabel. Dimatikan = penandanya tetap tampil tetapi tidak dapat ditekan; penarikan berkala tiap 15 menit tidak terpengaruh.",
    kelompok: "alat",
  },
  {
    kunci: "ambil-antrian",
    label: "Tombol Antrian di kolom jam",
    keterangan:
      "Tombol mengambil nomor antrian dan mereset kehadiran dari meja pelayanan. Mesin antrian ruang tunggu tidak terpengaruh.",
    kelompok: "alat",
  },
  {
    // Yang KOSONG saja. Tunjukan yang sudah ada ditulis untuk orang
    // berikutnya, dan yang mematikan saklar di komputer bersama bukan orang
    // yang harus membacanya.
    kunci: "tunjuk-konseptor",
    label: "Tunjuk konseptor (kosong)",
    keterangan:
      "Tombol bergaris \"tunjuk konseptor\" di kolom Putusan pada perkara yang belum ditunjuk. Konseptor sementara yang SUDAH ditunjuk tetap tampil. Hanya ada di mode Lengkap.",
    kelompok: "alat",
  },
  {
    kunci: "keterangan-perkara",
    label: "Keterangan perkara (kosong)",
    keterangan:
      "Tombol bergaris \"keterangan\" di kolom Putusan pada perkara yang belum punya keterangan. Keterangan yang SUDAH berisi tetap tampil. Hanya ada di mode Lengkap.",
    kelompok: "alat",
  },

  // === 12OKT-C: saklar hasil audit butir 7 - tombol pada baris ===
  // Tiga tombol di kolom paling kanan. Hak memakainya tetap mengikuti peran
  // (sidang.jalannya); saklar ini hanya pilihan tampilan, bukan izin.
  {
    kunci: "tombol-status-perkara",
    label: "Tombol Status",
    keterangan:
      "Tombol \"Status\" di bawah Rincian pada kolom paling kanan: membuka Status Perkara. Rincian dan nomor perkara tidak terpengaruh.",
    kelompok: "alat",
  },
  {
    kunci: "tombol-ruang-sidang",
    label: "Tombol jalannya sidang",
    keterangan:
      "Tombol Skors, Lompat ke sini, Lanjutkan, dan Tandai berjalan di kolom paling kanan. Hanya bagi yang berwenang menjalankan sidang; yang tidak berwenang memang tidak melihatnya.",
    kelompok: "alat",
  },
  {
    kunci: "tombol-selesai-sidang",
    label: "Tombol Selesai",
    keterangan:
      "Tombol Selesai di dasar kolom paling kanan (tersinkron dengan antrian sidang). Tanda hijau baris yang sudah selesai tidak terpengaruh. Hanya bagi yang berwenang menjalankan sidang.",
    kelompok: "alat",
  },
  // === AKHIR 12OKT-C ===

  // --- Di atas tabel -------------------------------------------------------
  {
    kunci: "skor-kesiapan",
    label: "Skor kesiapan",
    keterangan: "Tombol Hitung skor beserta lencana nilainya di tiap baris.",
    kelompok: "atas",
  },
  {
    kunci: "cetak",
    label: "Cetak jadwal",
    keterangan: "Tombol mencetak jadwal yang sedang tampil.",
    kelompok: "atas",
  },
  {
    kunci: "daftar-antrian",
    label: "Daftarkan ke antrian",
    keterangan: "Tombol mendaftarkan perkara ke aplikasi antrian ruang tunggu.",
    kelompok: "atas",
  },
  {
    kunci: "ciutkan-selesai",
    label: "Ciutkan perkara yang sudah selesai",
    keterangan:
      "Perkara yang sidangnya sudah selesai (tanda hijau Selesai) tidak digambar di tabel - yang tampil hanya yang sedang berjalan dan yang belum selesai. Jumlah yang diciutkan disebut di atas tabel. Bawaannya MATI (6 Okt 2026, butir 8).",
    kelompok: "atas",
    bawaanMati: true,
  },
  {
    kunci: "tombol-penetapan-kembali",
    label: "Tombol Penetapan kembali",
    keterangan: "Tombol pop-up penetapan kembali PMH/PPP/PJS/PHS (satu atau massal) di deretan tombol. Hanya bagi yang berwenang menetapkan.",
    kelompok: "atas",
  },
  {
    kunci: "tombol-kasir",
    label: "Tombol Kasir",
    keterangan: "Tombol pop-up Kasir (usulan jurnal keuangan perkara, simpan ke SIPP) di deretan tombol. Hanya bagi kasir/keuangan/panitera/admin.",
    kelompok: "atas",
  },
  {
    kunci: "tombol-kasir-harian",
    label: "Tombol Kasir harian",
    keterangan:
      "Tombol Kasir harian (jurnal otomatis massal satu hari menurut keadaan tiap perkara, rekap pengeluaran harian s.d. tahunan dengan PDF, dan pengingat tugas kasir) beserta tombol pengingatnya. Hanya bagi kasir/keuangan/panitera/admin.",
    kelompok: "atas",
  },
  // === 12OKT-C: saklar hasil audit butir 7 - di atas tabel ===
  {
    kunci: "tombol-cetak-relaas",
    label: "Tombol Cetak relaas",
    keterangan:
      "Tombol Cetak relaas di deretan tombol: mencetak relaas panggilan dan pemberitahuan putusan yang lahir pada hari itu lewat ekstensi ALETA. Hanya bagi yang berwenang mencetak relaas.",
    kelompok: "atas",
  },
  // === AKHIR 12OKT-C ===
  {
    kunci: "saring-ruang",
    label: "Tombol ruang sidang",
    keterangan:
      "Di ujung kanan deretan tombol: satu tombol per ruang sidang yang dipakai pada jadwal ini. Ditekan = hanya perkara di ruang itu; ditekan lagi = semua. Tidak tampil bila ruangnya tidak terbaca.",
    kelompok: "atas",
  },
  // 12 Okt 2026 (butir 3): kartu ruang sidang berwarna, bawaan tertutup.
  {
    kunci: "kartu-ruang",
    label: "Kartu ruang sidang",
    keterangan:
      "Di bawah deretan tombol (Hitung skor dan lainnya): satu kartu berwarna per ruang sidang yang dipakai, berisi nama ruang, jumlah perkara, dan jumlah yang perlu diperiksa. Bawaannya diciutkan; ditekan = buka.",
    kelompok: "atas",
  },
  {
    kunci: "layar-antrian",
    label: "Menu layar antrian",
    keterangan: "Tautan ke layar antrian dan layar panggil.",
    kelompok: "atas",
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
 * "Sembunyikan semua" - pasangan tombol "Nyalakan semua".
 *
 * Diminta pengguna 24 September 2026 ("mode sembunyikan yang lain"): dari
 * seluruh-mati, satu centang menyalakan hanya yang hendak dilihat.
 *
 * Yang wajib ditulis true, bukan dilewati: tampil() memang memaksanya menyala,
 * tetapi simpanan yang berbunyi false untuknya adalah simpanan yang berbohong
 * kepada siapa pun yang membacanya lewat DevTools.
 */
export function tampilanSemuaMati(): PilihanTampilan {
  const hasil: PilihanTampilan = {};
  for (const saklar of SAKLAR_TAMPILAN) hasil[saklar.kunci] = Boolean(saklar.wajib);
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
