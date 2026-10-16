"use strict";

/**
 * ============================================================================
 * CHECKLIST MILESTONE - WIDGET TERSENDIRI DI KIRI BAWAH
 * ============================================================================
 *
 * Diminta 26 September 2026: saklar "checklist milestone" di popup ekstensi,
 * dan ketika dinyalakan muncul widget yang TERPISAH dari panel ALETA yang
 * sudah ada - "buat jadi widget tersendiri".
 *
 * Isinya pekerjaan penting peran yang sedang masuk portal ALETA: yang sudah
 * lewat tenggat, yang jatuh hari ini, dan yang jatuh minggu ini - masing-
 * masing dengan satu tombol Kerjakan yang membuka tempat pekerjaannya (ABT,
 * SIPP, portal ALETA, atau e-Court). Daftarnya disusun PORTAL lewat
 * /api/aleta-ecourt/checklist; berkas ini hanya menampilkannya. Aturan "apa
 * yang dianggap belum selesai" hidup di satu tempat, di peladen - bukan di
 * berkas yang berjalan dalam beberapa versi sekaligus di peramban orang.
 *
 * ============================================================================
 * TERPISAH SUNGGUHAN, BUKAN SEKADAR KOTAK KEDUA
 * ============================================================================
 *
 *   AKAR SENDIRI   <aleta-cm-widget> dengan Shadow DOM. Gaya SIPP, ABT,
 *                  portal, dan panel.css tidak menembusnya, dan gaya widget
 *                  tidak bocor keluar. Kelas .aleta-panel tidak dipakai di
 *                  mana pun: panel.css dan panel-alat.js memperlakukan
 *                  pemilik kelas itu sebagai panel ALETA.
 *
 *   DI <html>,     pengamat DOM konten.js mengamati <body>. Widget yang lahir
 *   BUKAN <body>   di sana memicu penyegaran panel SIPP tiap kali ia muncul
 *                  atau hilang - kerja sia-sia di halaman yang sedang dipakai.
 *
 *   TANPA NAMA     seluruh isi berkas ini satu fungsi. Skrip konten SIPP, ABT,
 *   BERSAMA        dan portal berbagi SATU lingkup, dan satu nama puncak yang
 *                  kebetulan sama dengan milik konten.js akan menjatuhkan
 *                  salah satunya dengan galat "already declared".
 *
 *   SAKLAR         checklistMilestone, bawaannya MATI - ia menambah satu kotak
 *   SENDIRI        di tiap halaman kerja, dan itu keputusan petugas. Tetap
 *                  tunduk pada saklar induk "aktif": induk mati berarti tidak
 *                  ada apa pun dari ALETA di halaman, termasuk widget ini.
 *
 *   TIDAK DI       halaman cetak SIPP, halaman masuk, dan layar portal yang
 *   SEMUA HALAMAN  menghadap masyarakat (alatHalamanPublikPortal di
 *                  panel-alat.js, sama dengan panel ALETA) tidak memuatnya;
 *                  yang sudah tergambar tidak ikut tercetak (@media print di
 *                  bayangannya dan di blok cetak panel.css).
 *
 * ============================================================================
 * TOMBOL KERJAKAN - KE MANA, DAN BATASNYA
 * ============================================================================
 *
 *   aleta   alamat dari portal, ditempel ke asal portal (/aleta). Alamat di
 *           luar asal halaman ini, atau yang jalurnya keluar dari /aleta/
 *           sesudah dinormalkan ("/aleta/../SIPP/..."), ditolak: tombolnya
 *           mati beserta sebabnya.
 *   ecourt  alamat mutlak hanya https di *.mahkamahagung.go.id (e-Court
 *           memang di luar, tetapi hanya di sana). Alamat relatif diperlakukan
 *           seperti "aleta". Tanpa alamat: beranda e-Court, nomornya disalin.
 *
 *   abt dan sipp: `alamat` dari portal DIABAIKAN - alamatnya selalu dibangun
 *   di sini dari perkaranya. Alamat seasal belum tentu aman dibuka: ABT punya
 *   GET yang menghapus.
 *
 *   abt     abt/main/beranda?c=<perkara_id>: beranda ABT DENGAN perkara
 *           terpilih. Tiap kelompok blangko di bilah kirinya membawa c=, dan
 *           blangko yang dipilih langsung masuk abt/main/cari untuk perkara
 *           itu - lewat pemeriksaan hak akses ABT sendiri (views/abt/
 *           beranda.php, controllers/Abt.php). Blangkonya tidak dapat dibuka
 *           langsung: alamat blangko (a, b) disandikan kunci peladen ABT.
 *           Blangko yang dituju disebut di petunjuk tombolnya.
 *   sipp    halaman perkara SIPP hanya terbuka lewat perkara_detil/<enc>, dan
 *           <enc> hasil enkripsi SIPP (lihat "ALAMAT HALAMAN PERKARA YANG
 *           BOLEH DIBUKA ULANG" di konten.js). Sumbernya, berurutan: riwayat
 *           halaman detail (riwayatPerkaraSipp, dicatat konten.js), tautan
 *           "detil" di daftar perkara yang pernah dibuka (dipanen di sini), dan
 *           - untuk perkara yang belum pernah terlihat di peramban ini -
 *           SERVER: rute portal sipp-tautan menyusun <enc> dari perkara_id
 *           dengan sandi SIPP yang ditiru bot (7 Okt 2026, "diarahkan ke
 *           halaman SIPP bagian jadwal sidang"). Alamat server diminta
 *           sebelum tombol ditekan dan disimpan bersama tautan hasil panen.
 *           Server dan tab tujuan hanya di Baru/UI Baru; Lama persis seperti
 *           sebelumnya (pintu masuk tanpa tab, atau beranda).
 *           Semuanya hanya selama saklarnya menyala, dihapus saat saklar
 *           dimatikan, dan hanya dipakai bila jalurnya perkara_detil/<enc> di
 *           asal ini. Tab pekerjaannya dibuka lewat segmen ketiga SIPP sendiri
 *           (perkara_detil_agama/<enc>/4 = Jadwal Sidang) - lihat
 *           NOMOR_TAB_SIPP dan bukaTabTujuanSipp. Bila alamatnya belum tiba
 *           atau gagal disusun: beranda SIPP dibuka, nomornya disalin untuk
 *           ditempel di kotak cari - dan sebabnya DISEBUT.
 *
 * Semua tujuan dibuka di tab baru. Tidak ada satu pun yang ditulis ke SIPP,
 * ABT, maupun ALETA dari sini: yang dikirim hanya satu GET tentang pekerjaan
 * pemanggilnya sendiri.
 *
 * ============================================================================
 * TAHAP 3 RENCANA "EKSTENSI DULU" - DOK, LENCANA, DAN WIDGET KECIL
 * ============================================================================
 *
 * Semuanya bertanya ke panel-alat.js (alatUjiMode, alatKulit, alatFiturNyala)
 * sebelum tampil. Dalam tampilan Lama tidak satu pun berlaku: jalan
 * penggambaran, penyimpanan, dan permintaannya persis seperti sebelumnya.
 *
 *   UI BARU (kulit Modern) - perbaikan desain D8-D11, tanpa saklar:
 *     D8   butir menjadi kartu bertenggat (warna menurut kelompok)
 *     D9   widget dan lencana logo duduk dalam SATU dok di kiri bawah
 *     D10  lencana: angka tugas + cincin keadaan sambungan portal
 *     D11  "Atur widget": pilih yang tampil, urutkan dengan diseret
 *
 *   BARU dan UI BARU - hanya bila saklar fiturnya menyala:
 *     popup-6   angka belum selesai ke ikon ekstensi (lewat kunci
 *               angkaChecklist, dibaca latar.js) dan ke lencana
 *     popup-7   Selesai / Tunda - DISIMPAN DI PERAMBAN INI SAJA (keputusan
 *               pengguna, dipindah ke server di tahap 5). Hanya
 *               MENYEMBUNYIKAN butir dari daftar pemilik PC ini; data SIPP
 *               tidak disentuh, dan butir muncul lagi saat tundanya habis
 *     popup-8   lencana logo berkabar menggantikan pil (kulit Klasik)
 *     popup-9   dilepas, menempel ke sudut terdekat - diingat per situs
 *     popup-20  catatan cepat, popup-21 lama sidang, popup-22 kalender
 *               tenggat dari checklist yang SUDAH ada - semuanya lokal
 *     popup-23  susunan dok boleh berbeda untuk SIPP, ABT, dan portal
 *
 *   MENYUSUL (butuh data baru dari portal): jadwal sidang saya (popup-17),
 *   antrean PP (popup-18), WhatsApp perlu dibalas (popup-19), dan jendela
 *   terpisah (popup-24). Di "Atur widget" mereka DISEBUT dengan tanda
 *   menyusul dan tidak dapat dinyalakan - bukan disembunyikan diam-diam.
 *
 * Semua itu duduk di dalam akar yang sama (<aleta-cm-widget>), jadi layar
 * publik portal, halaman cetak, senyap 1 jam, dan @media print berlaku
 * tanpa aturan tambahan. Tidak ada permintaan baru: mode coba tidak punya
 * apa pun untuk ditahan di sini.
 */
(function checklistMilestone() {
  // Dimuat dua kali di satu halaman berarti dua widget dan dua putaran
  // permintaan. Yang kedua diam.
  if (globalThis.__aletaChecklistMilestone) return;
  globalThis.__aletaChecklistMilestone = true;

  // ─── Tetapan ───────────────────────────────────────────────────────────────

  const KUNCI_SAKLAR = "checklistMilestone";
  const KUNCI_INDUK = "aktif";
  const KUNCI_TEMA = "temaPanel";
  const KUNCI_WARNA = "warnaGelap";
  const KUNCI_PERAN = "peranChecklistMilestone";
  const KUNCI_LIPATAN = "lipatanChecklistMilestone";
  const KUNCI_RIWAYAT_SIPP = "riwayatPerkaraSipp";
  const KUNCI_TAUTAN_SIPP = "tautanPerkaraSipp";
  // Tahap 3 - hanya ditulis di luar tampilan Lama, dan hanya oleh fitur yang
  // saklarnya menyala. Bentuknya disebut di tandaBersih, catatanBersih,
  // lamaSidangBersih, susunanBersih, sudutBersih, dan tulisAngka.
  const KUNCI_TANDA = "tandaChecklist";
  const KUNCI_ANGKA = "angkaChecklist";
  const KUNCI_CATATAN = "catatanCepat";
  const KUNCI_LAMA_SIDANG = "lamaSidang";
  const KUNCI_SUSUNAN = "susunanWidget";
  const KUNCI_SUDUT = "sudutWidget";
  // Perbaikan 1 Okt butir 7 (UI Baru saja) - lihat "TATA BAGIAN WIDGET" di bawah.
  const KUNCI_TATA = "tataWidget";
  const KUNCI_TAMPILAN_SERVER = "tampilanServer";
  const SETELAN_TATA = "widget.tata";
  const ALAMAT_SETELAN = "/aleta/api/aleta-ecourt/ekstensi/setelan";
  /** Perubahan yang beruntun (menarik ukuran, beberapa saklar) dikirim sekali. */
  const TATA_KIRIM_JEDA_MS = 1500;
  const TINGGI_MIN = 60;
  const TINGGI_MAKS = 1200;
  const TINGGI_LANGKAH = 20;
  const LEBAR_LEPAS_MIN = 240;
  const LEBAR_LEPAS_MAKS = 900;

  const ALAMAT_API = "/aleta/api/aleta-ecourt/checklist";
  const TAG_AKAR = "aleta-cm-widget";
  const TAG_KABAR = "aleta-cm-kabar";

  const SEGAR_BERKALA_MS = 5 * 60 * 1000;
  /** Fokus yang kembali dalam selang ini tidak meminta ulang - lihat saatKembali. */
  const JEDA_FOKUS_MS = 30 * 1000;
  const KABAR_TUTUP_MS = 9000;
  const KABAR_SINGKAT_MS = 8000;
  /** Tautan detil SIPP yang diingat, paling banyak - yang tertua dibuang. */
  const TAUTAN_MAKS = 300;
  /** Tautan yang sudah diingat ditulis ulang hanya bila lebih tua dari ini. */
  const TAUTAN_SEGAR_MS = 24 * 60 * 60 * 1000;
  const TEPI = 12;
  const AMBANG_GESER = 4;
  /** Satu tingkat DI BAWAH panel ALETA (2147483000): panel layar penuh menutupinya. */
  const Z_WIDGET = 2147482990;

  /**
   * Jawaban checklist yang lebih lama dari ini mewarnai cincin lencana oranye
   * - ambang yang sama dengan "portal lambat" di panel-alat.js.
   */
  const AMBANG_LAMBAT_MS = typeof ALAT_AMBANG_LAMBAT_MS === "number" ? ALAT_AMBANG_LAMBAT_MS : 2500;
  /** Tanda Selesai/Tunda yang diingat, paling banyak - yang tertua dibuang. */
  const TANDA_MAKS = 500;
  /**
   * Tanda selesai yang butirnya TIDAK PERNAH hilang dari portal tetap
   * kedaluwarsa sesudah ini: pekerjaan yang ditandai selesai tetapi sebulan
   * kemudian masih dianggap belum oleh portal patut dilihat lagi.
   */
  const SELESAI_UMUR_MAKS_MS = 30 * 24 * 60 * 60 * 1000;
  /** angkaChecklist ditulis ulang walau sama, sesudah selang ini - supaya latar.js tahu angkanya masih hidup. */
  const ANGKA_SEGAR_MS = 10 * 60 * 1000;
  const CATATAN_MAKS = 5000;
  const CATATAN_JEDA_MS = 500;
  const RIWAYAT_SIDANG_MAKS = 100;
  /** Sidang yang lebih pendek dari ini salah tekan, bukan sidang - tidak ikut rata-rata. */
  const SIDANG_MIN_MS = 60 * 1000;
  const NAMA_SITUS = { sipp: "SIPP", abt: "ABT", portal: "portal" };
  const DAFTAR_SUDUT = ["kiri-bawah", "kanan-bawah", "kiri-atas", "kanan-atas"];

  /**
   * Isi galeri "Atur widget". `kode` = saklar fitur di popup (daftar-fitur.js);
   * checklist tidak punya: saklar utamanya checklistMilestone. `menyusul` =
   * idenya sudah dicatat tetapi datanya belum dikirim portal - tampil di
   * galeri dengan sebabnya, tidak dapat dinyalakan.
   */
  const WIDGET = [
    { id: "checklist", kode: "", judul: "Checklist milestone", ket: "Tugas penting peran Anda. Saklar utamanya tetap di popup." },
    { id: "catatan", kode: "popup-20", judul: "Catatan cepat", ket: "Tersimpan di peramban ini saja" },
    { id: "lama-sidang", kode: "popup-21", judul: "Lama sidang", ket: "Jam sidang yang sedang berjalan" },
    { id: "kalender", kode: "popup-22", judul: "Kalender tenggat", ket: "Dua minggu, dari checklist yang sudah ada" },
    {
      id: "jadwal-saya",
      kode: "popup-17",
      judul: "Jadwal sidang saya",
      ket: "Sidang hari ini milik Anda",
      menyusul: "Menunggu data jadwal sidang per petugas dari portal.",
    },
    {
      id: "antrean",
      kode: "popup-18",
      judul: "Antrean",
      ket: "Nomor yang sedang dipanggil",
      menyusul: "Menunggu data antrean ruang sidang dari portal.",
    },
    {
      id: "whatsapp",
      kode: "popup-19",
      judul: "WhatsApp perlu dibalas",
      ket: "Pesan pihak yang belum dijawab",
      menyusul: "Menunggu data pesan masuk dari portal, dan keputusan peran yang boleh melihatnya.",
    },
    {
      id: "jendela",
      kode: "popup-24",
      judul: "Widget di jendela terpisah",
      ket: "Pindahkan dok ke jendela kecil di layar kedua",
      menyusul: "Jendela terpisah butuh halaman ekstensi sendiri - menyusul bersama widget yang memakai data portal.",
    },
  ];

  /**
   * Halaman yang tidak boleh memuat keterangan ALETA sama sekali - daftar yang
   * sama dengan POLA_HALAMAN_CETAK di konten.js (dijaga uji supaya tidak
   * berselisih). Relas dan akta adalah dokumen resmi; widget yang ikut
   * tercetak di dalamnya merusaknya.
   */
  const POLA_HALAMAN_CETAK = [
    "/c_template",
    "/popup_",
    "/cetak",
    "/print",
    "/template_",
    "/laporan_cetak",
    "/amplop",
    "/instrumen",
  ];
  /*
   * Layar portal yang MENGHADAP MASYARAKAT (layar sentuh ambil antrian,
   * televisi ruang tunggu, tautan antrian tanpa login, antrian per ruang,
   * papan pintu ruang sidang, halaman publik, verifikasi formulir) TIDAK
   * didaftar di sini lagi: daftarnya satu, alatHalamanPublikPortal di
   * panel-alat.js, dan panel ALETA (aleta.js) memakai daftar yang sama.
   * Widget memuat nomor perkara dan pekerjaan tertunda petugas - di layar
   * itu ia membeberkannya ke ruang tunggu.
   */
  /** Sumber pola nomor perkara - sama dengan POLA_PERKARA di konten.js. */
  const SUMBER_POLA_NOMOR =
    "\\b(\\d{1,5}\\/[A-Za-z]{1,10}(?:\\.[A-Za-z]{1,4}){0,2}\\/\\d{4}\\/[A-Za-z]{2,4}\\.[A-Za-z]{2,6})\\b";
  const WARNA_DIKENAL = ["arang", "neon", "hangat", "pastel", "permata", "vibran"];

  const KELOMPOK = [
    { kunci: "lewat", judul: "Lewat tenggat", bawaanTerbuka: true },
    { kunci: "hari-ini", judul: "Hari ini", bawaanTerbuka: true },
    // Tertutup bawaan: yang jatuh minggu ini belum menuntut apa pun hari ini,
    // dan daftar yang terbentang seluruhnya mendorong yang mendesak keluar
    // dari layar.
    { kunci: "minggu-ini", judul: "Minggu ini", bawaanTerbuka: false },
  ];
  const NAMA_TUJUAN = { abt: "ABT", sipp: "SIPP", aleta: "ALETA", ecourt: "e-Court" };
  /** Halaman semantik dari portal -> nama tab yang dicari petugas di SIPP. */
  const TAB_SIPP = {
    perkara: "Data Umum",
    penetapan: "Penetapan",
    "jadwal-sidang": "Jadwal Sidang",
    putusan: "Putusan Akhir",
    relaas: "Jadwal Sidang (Cetak Relas)",
    "akta-cerai": "Akta Cerai",
    keuangan: "Biaya Perkara",
    saksi: "Saksi",
    mediasi: "Mediasi",
    ikrar: "Ikrar Talak",
    "pendaftaran-online": "e-Court Tingkat Pertama",
    "arsip-perkara": "Daftar Arsip Perkara",
  };
  /**
   * Pekerjaan yang tempatnya MENU SIPP, bukan tab halaman perkara (uji rilis
   * 9 Okt 2026). Jalurnya tautan menu SIPP sendiri (sys_menus.link satker),
   * di bawah akar SIPP - keduanya daftar yang hanya DIBACA saat dibuka:
   *   pendaftaran-online  register e-Court yang dibayar belum punya perkara,
   *                       jadi halaman perkara (dan beranda) bukan tempatnya;
   *   arsip-perkara       halaman detail perkara tidak memuat arsip sama sekali.
   * Hanya di Baru dan UI Baru; tampilan Lama tetap persis (beranda).
   */
  const MENU_SIPP = {
    "pendaftaran-online": { jalur: "pendaftaran_online", nama: "e-Court > Tingkat Pertama" },
    "arsip-perkara": { jalur: "list_arsip", nama: "Arsip Perkara > Daftar Arsip Perkara" },
  };
  /**
   * Halaman semantik -> nomor tab di halaman perkara SIPP
   * (views/perkara/detil_perkara_agama.php: <a href="#tabs<N>">). Nomor itu
   * ditempel sebagai segmen ketiga pintu masuk - perkara_detil_agama/<enc>/<N> -
   * jalan yang dipakai SIPP SENDIRI untuk kembali ke tab sesudah blangkonya
   * disimpan (jadwal_sidang_p_tunda.php: ".../'.$enc.'/4"). manage_perkara::
   * setParams menyimpannya sebagai flash tab_no, dan halaman detailnya
   * menekan $('.tabs<N>').
   *
   * Tab Ikrar Talak (24), Akta Cerai (25), dan Biaya Perkara (11) dicetak SIPP
   * TANPA kelas tabs<N>, jadi tekanan SIPP sendiri tidak menemukannya. Untuk
   * itu alamatnya juga membawa #aleta-tab=<N>, dan widget di halaman detail
   * menekan tabnya sendiri bila SIPP belum (lihat bukaTabTujuanSipp). "" =
   * Data Umum, tab yang memang terbuka lebih dulu.
   */
  const NOMOR_TAB_SIPP = {
    perkara: "",
    penetapan: "2",
    "jadwal-sidang": "4",
    putusan: "10",
    // Relaas dicetak dan pelaksanaannya diinput dari tab Jadwal Sidang -
    // pelaksanaan_relaas_v.php pun kembali ke ".../4".
    relaas: "4",
    "akta-cerai": "25",
    keuangan: "11",
    saksi: "23",
    mediasi: "6",
    ikrar: "24",
  };
  /** Penanda tab tujuan di alamat - ditulis tombol Kerjakan, dibaca di halaman detail. */
  const POLA_TAB_TUJUAN = /^#aleta-tab=(\d{1,3})$/;
  /**
   * Rute portal yang menyusun alamat bersandi perkara_detil_agama/<enc> dari
   * perkara_id (bot meniru Encrypt CI2 SIPP dengan kunci SIPP - lihat
   * aleta_bot/services/sippTautanService.js). Jawabannya SELALU
   * { ok, data: { alamat, alasan } }.
   */
  const ALAMAT_TAUTAN_SIPP = "/aleta/api/aleta-ecourt/sipp-tautan";
  /** Permintaan alamat yang boleh terbang bersamaan - bot tidak dibanjiri daftar panjang. */
  const TAUTAN_SERVER_PARALEL = 3;
  /** Alamat yang gagal disusun tidak diminta ulang sebelum selang ini. */
  const TAUTAN_GAGAL_ULANG_MS = 5 * 60 * 1000;
  /** Kelompok blangko ABT yang disebut portal -> nama yang dicari petugas di bilah kiri ABT. */
  const BLANGKO_ABT = {
    "blangko-putusan": "Putusan",
    "blangko-penetapan": "Penetapan",
    "blangko-bas": "BAS (berita acara sidang)",
    "blangko-relaas": "Relaas",
    "blangko-akta": "Akta",
  };
  /** e-Court Mahkamah Agung - satu-satunya asal luar yang boleh dibuka tombol Kerjakan. */
  const ECOURT = "https://ecourt.mahkamahagung.go.id/";
  const NAMA_HARI = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
  const NAMA_BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

  /** Aplikasi tempat halaman ini berada - menentukan kunci posisi dan alamat dasar. */
  const JENIS = (() => {
    const jalur = String(location.pathname || "");
    if (/^\/aps_badilag(\/|$)/i.test(jalur)) return "abt";
    if (/^\/aleta(\/|$)/i.test(jalur)) return "portal";
    return "sipp";
  })();

  /**
   * Posisi disimpan PER APLIKASI, dengan alasan yang sama dengan panel ALETA
   * (posisiPanel / posisiPanelAbt / posisiPanelAleta): tata letak SIPP, ABT,
   * dan portal berbeda, dan menggeser widget dari kaki tabel SIPP tidak boleh
   * diam-diam memindahkannya di ABT. Popup menghapus ketiganya lewat
   * "Kembalikan posisi panel".
   */
  const KUNCI_POSISI = { sipp: "posisiChecklistSipp", abt: "posisiChecklistAbt", portal: "posisiChecklistAleta" }[JENIS];

  /*
   * Palet disalin dari panel.css (.aleta-panel, tema terang, dan enam warna
   * gelap super admin), bukan dibaca dari sana: Shadow DOM tidak mewarisi
   * aturan halaman. Keduanya dijaga uji supaya tidak berselisih.
   */
  const GAYA = `
    :host {
      all: initial;
      position: fixed;
      z-index: ${Z_WIDGET};
      --aleta-latar: #16211c;
      --aleta-latar-naik: #1d2925;
      --aleta-garis: #2c3a34;
      --aleta-garis-kuat: #3a4a44;
      --aleta-tulisan: #e6ede8;
      --aleta-tulisan-lembut: #a3b4ab;
      --aleta-merek: #7fd0a6;
      --aleta-aman: #7fd0a6;
      --aleta-mendesak: #e0bc6b;
      --aleta-lewat: #eb968c;
      --cm-bayang: 0 12px 30px rgba(0, 0, 0, 0.42);
    }
    :host([data-tema="terang"]) {
      --aleta-latar: #ece9e3;
      --aleta-latar-naik: #f6f4ef;
      --aleta-garis: #d5cec2;
      --aleta-garis-kuat: #b9b0a0;
      --aleta-tulisan: #2b2721;
      --aleta-tulisan-lembut: #63594c;
      --aleta-merek: #1c6f46;
      --aleta-aman: #1c6f46;
      --aleta-mendesak: #8a5a0d;
      --aleta-lewat: #a33228;
      --cm-bayang: 0 12px 30px rgba(60, 48, 30, 0.22);
    }
    :host([data-warna="arang"]:not([data-tema="terang"])) {
      --aleta-latar: #171717;
      --aleta-latar-naik: #1f1f1f;
      --aleta-garis: #353535;
      --aleta-garis-kuat: #464646;
      --aleta-tulisan: #e0e0e0;
      --aleta-tulisan-lembut: #a9a9a9;
      --aleta-merek: #b8b8b8;
      --aleta-aman: #9fc5a8;
    }
    :host([data-warna="neon"]:not([data-tema="terang"])) {
      --aleta-latar: #111111;
      --aleta-latar-naik: #191919;
      --aleta-garis: #2a2a2a;
      --aleta-garis-kuat: #3a3a3a;
      --aleta-tulisan: #f2f2f2;
      --aleta-tulisan-lembut: #b0b0b0;
      --aleta-merek: #35d98f;
      --aleta-aman: #35d98f;
    }
    :host([data-warna="hangat"]:not([data-tema="terang"])) {
      --aleta-latar: #201d1a;
      --aleta-latar-naik: #29251f;
      --aleta-garis: #433d36;
      --aleta-garis-kuat: #574f45;
      --aleta-tulisan: #f5e8d8;
      --aleta-tulisan-lembut: #c4b5a2;
      --aleta-merek: #e9b64a;
      --aleta-aman: #a9c98d;
    }
    :host([data-warna="pastel"]:not([data-tema="terang"])) {
      --aleta-latar: #2a2a2a;
      --aleta-latar-naik: #333333;
      --aleta-garis: #474747;
      --aleta-garis-kuat: #585858;
      --aleta-tulisan: #e4e4e4;
      --aleta-tulisan-lembut: #b5b5b5;
      --aleta-merek: #a8dadc;
      --aleta-aman: #b9dcb0;
    }
    :host([data-warna="permata"]:not([data-tema="terang"])) {
      --aleta-latar: #1c1c1c;
      --aleta-latar-naik: #242424;
      --aleta-garis: #383838;
      --aleta-garis-kuat: #4a4a4a;
      --aleta-tulisan: #f0f0f0;
      --aleta-tulisan-lembut: #b9b9b9;
      --aleta-merek: #5fc3dd;
      --aleta-aman: #8fc7a0;
    }
    :host([data-warna="vibran"]:not([data-tema="terang"])) {
      --aleta-latar: #1a1a1a;
      --aleta-latar-naik: #232323;
      --aleta-garis: #383838;
      --aleta-garis-kuat: #4b4b4b;
      --aleta-tulisan: #f7f7f7;
      --aleta-tulisan-lembut: #bcbcbc;
      --aleta-merek: #ff7a4d;
      --aleta-aman: #b39ddb;
    }
    /* Kulit Modern (UI Baru, tahap 1 / 1.172.0) - token yang sama dengan
       blok KULIT MODERN di panel.css. data-kulit dipasang terapkanTema dari
       penanda <html data-aleta-kulit>; dalam tampilan Lama atributnya tidak
       ada, jadi dua blok ini tidak menyentuh apa pun. !important supaya
       menang atas enam palet di atas, sama seperti di panel.css. */
    :host([data-kulit="modern"]:not([data-tema="terang"])) {
      --aleta-latar: #111a2b !important;
      --aleta-latar-naik: #162238 !important;
      --aleta-garis: #24324b !important;
      --aleta-garis-kuat: #344560 !important;
      --aleta-tulisan: #e8eef7 !important;
      --aleta-tulisan-lembut: #aab6c8 !important;
      --aleta-merek: #3ec6e6 !important;
      --aleta-aman: #34d399 !important;
      --aleta-mendesak: #f5b83d !important;
      --aleta-lewat: #f87171 !important;
    }
    :host([data-kulit="modern"][data-tema="terang"]) {
      --aleta-latar: #ffffff !important;
      --aleta-latar-naik: #f3f5f9 !important;
      --aleta-garis: #e2e7ef !important;
      --aleta-garis-kuat: #cdd5e1 !important;
      --aleta-tulisan: #111827 !important;
      --aleta-tulisan-lembut: #4b5565 !important;
      --aleta-merek: #0b89a8 !important;
      --aleta-aman: #047857 !important;
      --aleta-mendesak: #b45309 !important;
      --aleta-lewat: #b91c1c !important;
    }

    *, *::before, *::after { box-sizing: border-box; }

    .aleta-cm-wadah {
      --cm-merek-latar: color-mix(in srgb, var(--aleta-merek) 16%, var(--aleta-latar));
      --cm-merek-garis: color-mix(in srgb, var(--aleta-merek) 42%, var(--aleta-latar));
      --cm-merek-tombol: color-mix(in srgb, var(--aleta-merek) 24%, var(--aleta-latar));
      --cm-merek-tombol-sorot: color-mix(in srgb, var(--aleta-merek) 36%, var(--aleta-latar));
      --cm-lewat-latar: color-mix(in srgb, var(--aleta-lewat) 16%, var(--aleta-latar-naik));
      --cm-mendesak-latar: color-mix(in srgb, var(--aleta-mendesak) 16%, var(--aleta-latar-naik));
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: calc(12.5px * var(--aleta-skala-huruf, 1));
      line-height: 1.45;
      color: var(--aleta-tulisan);
      -webkit-font-smoothing: antialiased;
    }

    button, select, a { font: inherit; color: inherit; }
    button:focus-visible, select:focus-visible, a:focus-visible, summary:focus-visible {
      outline: 2px solid var(--aleta-merek);
      outline-offset: 1px;
    }

    .aleta-cm {
      width: 348px;
      max-width: calc(100vw - 24px);
      max-height: min(72vh, 580px);
      display: flex;
      flex-direction: column;
      background: var(--aleta-latar);
      border: 1px solid var(--aleta-garis-kuat);
      border-radius: 12px;
      box-shadow: var(--cm-bayang);
      overflow: hidden;
    }

    .aleta-cm-kepala {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 8px 8px 12px;
      background: var(--aleta-latar-naik);
      border-bottom: 1px solid var(--aleta-garis);
      cursor: grab;
      user-select: none;
      touch-action: none;
      /* CHECKLIST-POSISI 12 Okt: kepala yang sempit membungkus kendalinya ke
         baris kedua - judul dan pilihan peran tidak lagi terpotong menjadi
         "Checklist mi" / "o..". */
      flex-wrap: wrap;
      row-gap: 2px;
    }
    .aleta-cm-menggeser .aleta-cm-kepala, .aleta-cm-menggeser .aleta-cm-pil { cursor: grabbing; }
    .aleta-cm-ikon { width: 18px; height: 18px; flex: none; display: block; }
    .aleta-cm-judul { font-weight: 700; white-space: nowrap; flex: 0 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
    .aleta-cm-peran {
      min-width: 0;
      max-width: 128px;
      padding: 1px 8px;
      border: 1px solid var(--cm-merek-garis);
      border-radius: 999px;
      background: var(--cm-merek-latar);
      color: var(--aleta-merek);
      font-size: calc(11px * var(--aleta-skala-huruf, 1));
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    select.aleta-cm-peran { cursor: pointer; appearance: auto; flex: 0 1 auto; min-width: 84px; }
    select.aleta-cm-peran option { background: var(--aleta-latar); color: var(--aleta-tulisan); }
    .aleta-cm-alat { margin-left: auto; display: inline-flex; gap: 2px; flex: none; }
    .aleta-cm-alat button {
      width: 26px;
      height: 26px;
      padding: 0;
      border: 0;
      border-radius: 6px;
      background: transparent;
      color: var(--aleta-tulisan-lembut);
      font-size: calc(15px * var(--aleta-skala-huruf, 1));
      line-height: 1;
      cursor: pointer;
    }
    .aleta-cm-alat button:hover { background: var(--aleta-latar); color: var(--aleta-tulisan); }
    .aleta-cm-hanya-baca { color: var(--aleta-tulisan-lembut); font-size: calc(11px * var(--aleta-skala-huruf, 1)); font-style: italic; }
    .aleta-cm-berputar { display: inline-block; animation: aleta-cm-putar 0.9s linear infinite; }
    @keyframes aleta-cm-putar { to { transform: rotate(360deg); } }

    .aleta-cm-kabar {
      padding: 8px 12px;
      border-bottom: 1px solid var(--aleta-garis);
      background: var(--aleta-latar-naik);
      font-size: calc(11.5px * var(--aleta-skala-huruf, 1));
      overflow-wrap: anywhere;
    }
    .aleta-cm-kabar-galat { background: var(--cm-mendesak-latar); }
    .aleta-cm-kabar strong { color: var(--aleta-tulisan); }
    .aleta-cm-kabar a { color: var(--aleta-merek); font-weight: 600; }

    .aleta-cm-kemajuan { padding: 9px 12px 10px; border-bottom: 1px solid var(--aleta-garis); }
    .aleta-cm-kemajuan-teks {
      margin-bottom: 6px;
      color: var(--aleta-tulisan-lembut);
      font-size: calc(11.5px * var(--aleta-skala-huruf, 1));
    }
    .aleta-cm-bilah { height: 6px; border-radius: 999px; background: var(--aleta-garis); overflow: hidden; }
    .aleta-cm-bilah-isi {
      display: block;
      height: 100%;
      border-radius: inherit;
      background: var(--aleta-aman);
      transition: width 0.3s ease;
    }

    .aleta-cm-isi { flex: 1 1 auto; overflow-y: auto; overscroll-behavior: contain; padding: 2px 0 6px; }
    .aleta-cm-kelompok + .aleta-cm-kelompok { border-top: 1px solid var(--aleta-garis); }
    .aleta-cm-kelompok-kepala {
      display: flex;
      align-items: center;
      gap: 6px;
      width: 100%;
      padding: 8px 12px;
      border: 0;
      background: transparent;
      color: var(--aleta-tulisan-lembut);
      font-size: calc(10.5px * var(--aleta-skala-huruf, 1));
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      text-align: left;
      cursor: pointer;
    }
    .aleta-cm-kelompok-kepala:hover { color: var(--aleta-tulisan); }
    .aleta-cm-panah { width: 10px; flex: none; }
    .aleta-cm-hitung {
      min-width: 20px;
      padding: 0 6px;
      border-radius: 999px;
      background: var(--aleta-latar-naik);
      color: var(--aleta-tulisan);
      letter-spacing: 0;
      text-align: center;
      font-variant-numeric: tabular-nums;
    }
    .aleta-cm-sebagian { font-weight: 400; letter-spacing: 0; text-transform: none; }
    .aleta-cm-kelompok-lewat .aleta-cm-kelompok-judul { color: var(--aleta-lewat); }
    .aleta-cm-kelompok-lewat .aleta-cm-hitung { background: var(--cm-lewat-latar); color: var(--aleta-lewat); }
    .aleta-cm-kelompok-hari-ini .aleta-cm-kelompok-judul { color: var(--aleta-mendesak); }
    .aleta-cm-kelompok-hari-ini .aleta-cm-hitung { background: var(--cm-mendesak-latar); color: var(--aleta-mendesak); }

    .aleta-cm-daftar { list-style: none; margin: 0; padding: 0 8px 6px; display: flex; flex-direction: column; gap: 6px; }
    .aleta-cm-butir {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 10px;
      border-radius: 8px;
      border-left: 3px solid var(--aleta-garis-kuat);
      background: var(--aleta-latar-naik);
    }
    .aleta-cm-kelompok-lewat .aleta-cm-butir { border-left-color: var(--aleta-lewat); }
    .aleta-cm-kelompok-hari-ini .aleta-cm-butir { border-left-color: var(--aleta-mendesak); }
    .aleta-cm-butir-teks { flex: 1 1 auto; min-width: 0; }
    .aleta-cm-butir-judul { font-weight: 600; overflow-wrap: anywhere; }
    .aleta-cm-butir-ket {
      margin-top: 2px;
      color: var(--aleta-tulisan-lembut);
      font-size: calc(11.5px * var(--aleta-skala-huruf, 1));
      overflow-wrap: anywhere;
    }
    .aleta-cm-nomor { color: var(--aleta-tulisan); font-variant-numeric: tabular-nums; }
    .aleta-cm-kerjakan {
      flex: none;
      padding: 5px 9px;
      border: 1px solid var(--cm-merek-garis);
      border-radius: 7px;
      background: var(--cm-merek-tombol);
      color: var(--aleta-tulisan);
      font-size: calc(11.5px * var(--aleta-skala-huruf, 1));
      font-weight: 600;
      text-decoration: none;
      white-space: nowrap;
      cursor: pointer;
    }
    .aleta-cm-kerjakan:hover { background: var(--cm-merek-tombol-sorot); }
    .aleta-cm-kerjakan-mati { opacity: 0.55; cursor: not-allowed; }
    .aleta-cm-kosong, .aleta-cm-memuat { padding: 16px 14px; color: var(--aleta-tulisan-lembut); text-align: center; }

    .aleta-cm-kaki {
      padding: 8px 12px 9px;
      border-top: 1px solid var(--aleta-garis);
      color: var(--aleta-tulisan-lembut);
      font-size: calc(11px * var(--aleta-skala-huruf, 1));
    }
    .aleta-cm-kaki-baris { display: flex; flex-wrap: wrap; gap: 2px 8px; }
    .aleta-cm-waktu { color: var(--aleta-tulisan); font-variant-numeric: tabular-nums; }
    .aleta-cm-kaki details { margin-top: 6px; }
    .aleta-cm-kaki summary { color: var(--aleta-tulisan); cursor: pointer; }
    .aleta-cm-kaki-daftar { margin: 4px 0 0; padding-left: 16px; }
    .aleta-cm-kaki-daftar li + li { margin-top: 2px; }

    .aleta-cm-pil {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 7px 14px 7px 11px;
      border: 1px solid var(--aleta-garis-kuat);
      border-radius: 999px;
      background: var(--aleta-latar);
      color: var(--aleta-tulisan);
      font-weight: 600;
      white-space: nowrap;
      box-shadow: var(--cm-bayang);
      cursor: grab;
      touch-action: none;
    }
    .aleta-cm-pil::before {
      content: "";
      width: 8px;
      height: 8px;
      flex: none;
      border-radius: 999px;
      background: var(--aleta-aman);
    }
    .aleta-cm-pil[data-nada="lewat"]::before { background: var(--aleta-lewat); }
    .aleta-cm-pil[data-nada="mendesak"]::before { background: var(--aleta-mendesak); }
    .aleta-cm-pil:hover { border-color: var(--aleta-merek); }

    .aleta-cm-kabar-tutup {
      max-width: 330px;
      padding: 10px 12px;
      border: 1px solid var(--aleta-garis-kuat);
      border-radius: 10px;
      background: var(--aleta-latar);
      box-shadow: var(--cm-bayang);
      cursor: pointer;
    }

    /* ── Tahap 3: dok, lencana, dan widget kecil. Seluruh kelasnya hanya
       dilahirkan di luar tampilan Lama, jadi aturan ini tidak menyentuh
       widget Lama. Warna selalu lewat token, supaya enam palet, tema
       terang, dan kulit Modern ikut dengan sendirinya. ── */
    .aleta-cmw-dok {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 8px;
      width: 348px;
      max-width: calc(100vw - 24px);
    }
    .aleta-cmw-tumpuk {
      display: flex;
      flex-direction: column;
      gap: 8px;
      width: 348px;
      max-width: calc(100vw - 24px);
      max-height: calc(100vh - 96px);
      overflow-y: auto;
      overscroll-behavior: contain;
    }
    /* Di kulit Klasik checklist berdiri DI LUAR tumpukan, dengan tingginya
       sendiri (paling tinggi min(72vh, 580px)). Tumpukan di atasnya mendapat
       sisanya - tanpa batas ini keduanya melampaui layar dan kepala widget
       teratas terpotong di luar jangkauan. */
    .aleta-cmw-tumpuk-klasik {
      margin-bottom: 8px;
      max-height: max(120px, calc(100vh - min(72vh, 580px) - 40px));
    }
    .aleta-cmw-dok .aleta-cmw-tumpuk, .aleta-cmw-dok .aleta-cm, .aleta-cmw-dok .aleta-cmw-kotak { width: 100%; }
    .aleta-cmw-kotak {
      flex: none;
      width: 348px;
      max-width: calc(100vw - 24px);
      background: var(--aleta-latar);
      border: 1px solid var(--aleta-garis-kuat);
      border-radius: 12px;
      box-shadow: var(--cm-bayang);
      overflow: hidden;
    }
    .aleta-cmw-kepala {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 8px 8px 12px;
      background: var(--aleta-latar-naik);
      border-bottom: 1px solid var(--aleta-garis);
      font-weight: 700;
      cursor: grab;
      user-select: none;
      touch-action: none;
    }
    .aleta-cmw-kepala .aleta-cm-alat button { width: 26px; height: 26px; }
    .aleta-cmw-isi { display: flex; flex-direction: column; gap: 8px; padding: 9px 12px 10px; }
    .aleta-cmw-ket { color: var(--aleta-tulisan-lembut); font-size: calc(11px * var(--aleta-skala-huruf, 1)); }
    .aleta-cmw-baris { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
    .aleta-cmw-tombol, .aleta-cm-tanda {
      padding: 4px 9px;
      border: 1px solid var(--aleta-garis-kuat);
      border-radius: 7px;
      background: var(--aleta-latar-naik);
      color: var(--aleta-tulisan);
      font-size: calc(11.5px * var(--aleta-skala-huruf, 1));
      font-weight: 600;
      white-space: nowrap;
      cursor: pointer;
    }
    .aleta-cmw-tombol:hover, .aleta-cm-tanda:hover { border-color: var(--aleta-merek); }
    .aleta-cmw-tombol:disabled { opacity: 0.5; cursor: not-allowed; }
    .aleta-cmw-tombol-utama { background: var(--cm-merek-tombol); border-color: var(--cm-merek-garis); }
    .aleta-cmw-tombol-kecil { padding: 2px 7px; font-size: calc(11px * var(--aleta-skala-huruf, 1)); }

    /* popup-7: Selesai / Tunda */
    .aleta-cm-butir-aksi { flex: none; display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
    .aleta-cm-butir-aksi-kecil { display: flex; gap: 4px; }
    .aleta-cm-tanda {
      padding: 2px 7px;
      background: transparent;
      color: var(--aleta-tulisan-lembut);
      font-size: calc(11px * var(--aleta-skala-huruf, 1));
    }
    .aleta-cm-tanda:hover { color: var(--aleta-tulisan); }
    .aleta-cm-kaki-daftar .aleta-cm-tanda { margin-left: 6px; }

    /* D8: kartu tugas bertenggat (UI Baru) */
    .aleta-cm-butir.aleta-cm-kartu {
      display: grid;
      gap: 6px;
      padding: 10px 12px;
      border: 1px solid var(--aleta-garis);
      border-left: 3px solid var(--aleta-garis-kuat);
      border-radius: 10px;
    }
    .aleta-cm-kartu[data-nada="lewat"] { border-color: color-mix(in srgb, var(--aleta-lewat) 45%, var(--aleta-garis)); border-left-color: var(--aleta-lewat); }
    .aleta-cm-kartu[data-nada="mendesak"] { border-left-color: var(--aleta-mendesak); }
    .aleta-cm-kartu-atas { display: flex; align-items: baseline; gap: 8px; min-width: 0; }
    .aleta-cm-kartu-atas .aleta-cm-butir-judul { flex: 1 1 auto; min-width: 0; }
    .aleta-cm-kartu-tenggat {
      flex: none;
      color: var(--aleta-tulisan-lembut);
      font-size: calc(11.5px * var(--aleta-skala-huruf, 1));
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    }
    .aleta-cm-kartu[data-nada="lewat"] .aleta-cm-kartu-tenggat { color: var(--aleta-lewat); }
    .aleta-cm-kartu[data-nada="mendesak"] .aleta-cm-kartu-tenggat { color: var(--aleta-mendesak); }
    .aleta-cm-kartu-aksi { display: flex; flex-wrap: wrap; gap: 6px; }
    :host([data-kulit="modern"]) .aleta-cm,
    :host([data-kulit="modern"]) .aleta-cmw-kotak { border-radius: 14px; }

    /* D10 / popup-8: lencana logo - angka tugas + cincin sambungan */
    .aleta-cmw-lencana-baris { display: flex; align-items: center; gap: 10px; max-width: 100%; }
    .aleta-cmw-lencana {
      position: relative;
      flex: none;
      width: 48px;
      height: 48px;
      padding: 3px;
      border: 0;
      border-radius: 50%;
      background: var(--aleta-garis-kuat);
      box-shadow: var(--cm-bayang);
      cursor: grab;
      touch-action: none;
    }
    .aleta-cmw-lencana[data-sambungan="baik"] { background: var(--aleta-aman); }
    .aleta-cmw-lencana[data-sambungan="lambat"],
    .aleta-cmw-lencana[data-sambungan="belum-masuk"] { background: var(--aleta-mendesak); }
    .aleta-cmw-lencana[data-sambungan="putus"] { background: var(--aleta-lewat); }
    .aleta-cmw-lencana-logo {
      display: grid;
      place-items: center;
      width: 100%;
      height: 100%;
      border-radius: 50%;
      background: var(--aleta-latar);
      overflow: hidden;
    }
    .aleta-cmw-lencana-logo .aleta-cm-ikon { width: 24px; height: 24px; }
    .aleta-cmw-lencana-angka {
      position: absolute;
      top: -4px;
      right: -4px;
      min-width: 20px;
      height: 20px;
      padding: 0 5px;
      border-radius: 999px;
      background: var(--aleta-lewat);
      color: #fff;
      font-size: 11px;
      font-weight: 700;
      line-height: 20px;
      text-align: center;
      font-variant-numeric: tabular-nums;
    }
    .aleta-cmw-lencana-angka[data-nada="mendesak"] { background: var(--aleta-mendesak); color: #1a1204; }
    .aleta-cmw-lencana-angka[data-nada="tenang"] { background: var(--aleta-garis-kuat); color: var(--aleta-tulisan); }
    .aleta-cmw-lencana-ket {
      display: grid;
      gap: 2px;
      min-width: 0;
      padding: 5px 9px;
      border-radius: 8px;
      background: var(--aleta-latar);
      color: var(--aleta-tulisan-lembut);
      font-size: calc(11px * var(--aleta-skala-huruf, 1));
    }

    /* Butir 3 (6 Okt): indikator sumber daya server - RAM, CPU, Disk, GPU */
    .aleta-cmw-lencana-baris:has(.aleta-cmw-sd) { flex-wrap: wrap; }
    .aleta-cmw-sd {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 5px;
      border-radius: 999px;
      background: var(--aleta-latar);
      box-shadow: var(--cm-bayang);
      font-size: calc(11px * var(--aleta-skala-huruf, 1));
      color: var(--aleta-tulisan-lembut);
    }
    .aleta-cmw-tumpuk-klasik + .aleta-cmw-sd, .aleta-cm-wadah > .aleta-cmw-sd { margin-bottom: 6px; }
    .aleta-cmw-sd-lingkup, .aleta-cmw-sd-titik {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      padding: 2px 6px;
      border: 0;
      border-radius: 999px;
      background: transparent;
      color: inherit;
      font: inherit;
      cursor: pointer;
    }
    .aleta-cmw-sd-lingkup {
      background: var(--aleta-latar-naik);
      color: var(--aleta-tulisan);
      font-weight: 700;
      letter-spacing: 0.02em;
    }
    .aleta-cmw-sd[data-sd-lingkup="server"] .aleta-cmw-sd-lingkup { background: var(--aleta-merek); color: var(--aleta-latar); }
    .aleta-cmw-sd-titik:hover, .aleta-cmw-sd-lingkup:hover { outline: 1px solid var(--aleta-garis-kuat); }
    .aleta-cmw-sd-bulat { width: 8px; height: 8px; border-radius: 50%; background: var(--aleta-garis-kuat); }
    .aleta-cmw-sd-titik[data-warna="hijau"] .aleta-cmw-sd-bulat { background: #22c55e; }
    .aleta-cmw-sd-titik[data-warna="kuning"] .aleta-cmw-sd-bulat { background: #eab308; }
    .aleta-cmw-sd-titik[data-warna="merah"] .aleta-cmw-sd-bulat { background: #ef4444; box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.35); }
    .aleta-cmw-sd-titik[data-warna="merah"] .aleta-cmw-sd-nilai { color: var(--aleta-lewat); }
    .aleta-cmw-sd-titik[data-warna="kuning"] .aleta-cmw-sd-nilai { color: var(--aleta-mendesak); }
    .aleta-cmw-sd-nilai { color: var(--aleta-tulisan); font-variant-numeric: tabular-nums; }
    .aleta-cmw-sd-rinci { padding: 2px 6px; color: var(--aleta-merek); text-decoration: none; white-space: nowrap; }
    .aleta-cmw-sd-rinci:hover { text-decoration: underline; }

    /* D11 / popup-23: Atur widget */
    .aleta-cmw-atur-daftar { list-style: none; margin: 0; padding: 0; }
    .aleta-cmw-atur-baris { display: flex; align-items: center; gap: 8px; padding: 7px 4px; border-top: 1px solid var(--aleta-garis); }
    .aleta-cmw-atur-baris[data-diseret="ya"] { border-radius: 8px; background: var(--aleta-latar-naik); outline: 1px solid var(--aleta-merek); }
    .aleta-cmw-atur-baris[data-menyusul="ya"] .aleta-cmw-atur-teks b { color: var(--aleta-tulisan-lembut); }
    .aleta-cmw-pegangan {
      flex: none;
      width: 16px;
      color: var(--aleta-tulisan-lembut);
      letter-spacing: -2px;
      cursor: grab;
      user-select: none;
      touch-action: none;
    }
    .aleta-cmw-atur-teks { flex: 1 1 auto; min-width: 0; display: grid; gap: 1px; }
    .aleta-cmw-atur-teks small { color: var(--aleta-tulisan-lembut); font-size: calc(11px * var(--aleta-skala-huruf, 1)); }
    .aleta-cmw-geser { display: inline-flex; gap: 2px; flex: none; }
    .aleta-cmw-geser button {
      width: 22px;
      height: 22px;
      padding: 0;
      border: 1px solid var(--aleta-garis);
      border-radius: 6px;
      background: transparent;
      color: var(--aleta-tulisan-lembut);
      cursor: pointer;
    }
    .aleta-cmw-geser button:disabled { opacity: 0.35; cursor: default; }
    .aleta-cmw-saklar {
      position: relative;
      flex: none;
      width: 36px;
      height: 20px;
      padding: 0;
      border: 0;
      border-radius: 999px;
      background: var(--aleta-garis-kuat);
      cursor: pointer;
    }
    .aleta-cmw-saklar::after {
      content: "";
      position: absolute;
      top: 2px;
      left: 2px;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: #fff;
      transition: left 0.15s ease;
    }
    .aleta-cmw-saklar[aria-checked="true"] { background: var(--aleta-merek); }
    .aleta-cmw-saklar[aria-checked="true"]::after { left: 18px; }
    .aleta-cmw-saklar:disabled { opacity: 0.45; cursor: not-allowed; }
    .aleta-cmw-menyusul {
      margin-left: 4px;
      padding: 0 7px;
      border: 1px solid var(--aleta-garis-kuat);
      border-radius: 999px;
      color: var(--aleta-tulisan-lembut);
      font-size: calc(10.5px * var(--aleta-skala-huruf, 1));
      font-weight: 600;
    }

    /* popup-20: catatan cepat */
    .aleta-cmw-catatan {
      width: 100%;
      min-height: 76px;
      padding: 7px 9px;
      border: 1px solid var(--aleta-garis-kuat);
      border-radius: 8px;
      background: var(--aleta-latar-naik);
      color: var(--aleta-tulisan);
      font: inherit;
      resize: vertical;
    }
    .aleta-cmw-catatan:focus-visible { outline: 2px solid var(--aleta-merek); outline-offset: 1px; }

    /* popup-21: lama sidang */
    .aleta-cmw-jam {
      font-size: calc(24px * var(--aleta-skala-huruf, 1));
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      letter-spacing: 0.02em;
    }
    .aleta-cmw-jam[data-skors="ya"] { color: var(--aleta-mendesak); }
    /* F3.1: skors hari ini dari Jadwal Sidang ALETA */
    .aleta-cmw-skors { display: flex; flex-direction: column; gap: 3px; padding-top: 6px; border-top: 1px dashed var(--aleta-garis); }
    .aleta-cmw-skors-judul { font-weight: 700; font-size: calc(11.5px * var(--aleta-skala-huruf, 1)); }
    .aleta-cmw-skors-baris { font-size: calc(11.5px * var(--aleta-skala-huruf, 1)); line-height: 1.35; }
    .aleta-cmw-skors-baris[data-skors-aktif="ya"] b { color: var(--aleta-mendesak); }
    .aleta-cmw-skors-baris[data-skors-aktif="tidak"] { color: var(--aleta-tulisan-lembut); }
    .aleta-cmw-skors-baris[data-skors-lewat="ya"] span { font-weight: 700; }

    /* popup-22: kalender tenggat */
    .aleta-cmw-kal {
      display: grid;
      grid-template-columns: repeat(7, minmax(0, 1fr));
      gap: 3px;
      text-align: center;
      font-size: calc(11px * var(--aleta-skala-huruf, 1));
    }
    .aleta-cmw-kal-hari { color: var(--aleta-tulisan-lembut); font-weight: 700; }
    .aleta-cmw-kal-tgl {
      position: relative;
      padding: 4px 0 8px;
      border: 1px solid transparent;
      border-radius: 6px;
      background: var(--aleta-latar-naik);
      color: var(--aleta-tulisan);
      font-variant-numeric: tabular-nums;
      cursor: pointer;
    }
    .aleta-cmw-kal-tgl[data-lalu="ya"] { opacity: 0.65; }
    .aleta-cmw-kal-tgl[data-kini="ya"] { border-color: var(--aleta-merek); }
    .aleta-cmw-kal-tgl[data-dipilih="ya"] { background: var(--cm-merek-tombol); }
    .aleta-cmw-kal-tgl::after {
      content: "";
      position: absolute;
      left: 50%;
      bottom: 2px;
      width: 5px;
      height: 5px;
      margin-left: -2.5px;
      border-radius: 50%;
      background: transparent;
    }
    .aleta-cmw-kal-tgl[data-nada="aman"]::after { background: var(--aleta-aman); }
    .aleta-cmw-kal-tgl[data-nada="mendesak"]::after { background: var(--aleta-mendesak); }
    .aleta-cmw-kal-tgl[data-nada="lewat"]::after { background: var(--aleta-lewat); }
    .aleta-cmw-kal-daftar { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
    .aleta-cmw-kal-daftar li { display: flex; align-items: center; gap: 8px; }
    .aleta-cmw-kal-daftar li > span { flex: 1 1 auto; min-width: 0; overflow-wrap: anywhere; }

    @media (prefers-reduced-motion: reduce) {
      .aleta-cm-berputar { animation: none; opacity: 0.6; }
      .aleta-cm-bilah-isi { transition: none; }
      .aleta-cmw-saklar::after { transition: none; }
    }

    /* Perbaikan 30 Sep butir 24 - pita "Pembaruan tersedia" di atas widget,
     * dan butir 6 - penjelasan panjang di balik ⓘ. Keduanya hanya lahir dalam
     * tampilan Baru dan UI Baru. */
    .aleta-cm-pita {
      display: flex; flex-wrap: wrap; align-items: baseline; gap: 2px 8px;
      width: 100%; margin: 0 0 6px; padding: 6px 10px;
      border: 1px solid var(--cm-merek-garis); border-radius: 8px;
      background: var(--cm-merek-latar); color: var(--aleta-tulisan);
      box-shadow: var(--cm-bayang); text-align: left; cursor: pointer;
    }
    .aleta-cm-pita b { color: var(--aleta-merek); }
    .aleta-cm-pita-ket { color: var(--aleta-tulisan-lembut); font-size: 0.92em; }
    .aleta-cm-pita:hover:not(:disabled) { background: var(--aleta-latar-naik); }
    .aleta-cm-pita:disabled { cursor: progress; }
    .aleta-cm-pita[data-buruk="ya"] .aleta-cm-pita-ket { color: var(--aleta-lewat); }
    [data-cm-dilipat="ya"][hidden] { display: none !important; }
    .aleta-cm-info {
      display: inline-flex; align-items: baseline; gap: 6px; margin: 2px 0; padding: 0;
      border: 0; background: none; color: var(--aleta-tulisan-lembut); cursor: pointer; text-align: left;
    }
    .aleta-cm-info b { color: var(--aleta-merek); }
    .aleta-cm-info:hover span { color: var(--aleta-tulisan); text-decoration: underline; }

    /* Perbaikan 30 Sep sore butir 3 (K5): penjelasan teknis tersembunyi.
     * data-teknis dipasang pada akar hanya bila <html data-aleta-teknis>
     * ada - panel-alat.js memasangnya hanya dalam Baru dan UI Baru. */
    :host([data-teknis="sembunyi"]) .aleta-teknis { display: none !important; }
    .aleta-cmw-teknis {
      display: flex; align-items: center; gap: 8px; margin-top: 6px; padding-top: 6px;
      border-top: 1px solid var(--aleta-garis);
    }
    .aleta-cmw-teknis-teks { flex: 1 1 auto; min-width: 0; display: grid; gap: 1px; }
    .aleta-cmw-teknis-teks b { font-weight: 600; }
    .aleta-cmw-teknis-teks small { color: var(--aleta-tulisan-lembut); }
    .aleta-cmw-teknis .aleta-cmw-saklar { flex: none; }

    /* Perbaikan 1 Okt butir 1 (K2): lipat seragam - SALINAN aturan blok W1
     * panel.css (Shadow DOM tidak mewarisi aturan halaman), dengan gerbang
     * :host([data-kulit="modern"]) menggantikan html[data-aleta-kulit="modern"].
     * Dijaga uji ekstensi-lipat-widget-1okt supaya keduanya tidak berselisih. */
    .aleta-lipatan > .aleta-lipat-isi[hidden], .aleta-lipat-isi[hidden] { display: none !important; }
    /* Perbaikan 2 Okt (agen W): tag peran (butir 7), menu bagian (butir 13),
     * sorot sudut (butir 11) - salinan rupa blok W2 panel.css untuk Shadow DOM. */
    .aleta-lipat-peran[hidden] { display: none !important; }
    :host([data-kulit="modern"]) .aleta-lipat-peran {
      flex: none; padding: 1px 7px; border: 1px solid var(--aleta-garis); border-radius: 999px;
      background: var(--aleta-latar-naik); color: var(--aleta-tulisan-lembut);
      font-size: calc(11.5px * var(--aleta-skala-huruf, 1)); font-weight: 600; white-space: nowrap;
    }
    .aleta-cm-bagian-menu {
      display: grid; gap: 4px; margin: 4px 8px 6px; padding: 8px 10px;
      border: 1px solid var(--aleta-garis); border-radius: 10px; background: var(--aleta-latar-naik);
    }
    .aleta-cm-bagian-judul { font-weight: 700; font-size: calc(11.5px * var(--aleta-skala-huruf, 1)); color: var(--aleta-tulisan-lembut); }
    .aleta-cm-bagian-baris { display: flex; align-items: center; gap: 8px; min-height: 26px; }
    .aleta-cm-bagian-teks { flex: 1 1 auto; min-width: 0; }
    .aleta-cm-bagian-baris .aleta-cmw-saklar { flex: none; }
    .aleta-cm-bagian-ket { color: var(--aleta-tulisan-lembut); font-size: calc(11.5px * var(--aleta-skala-huruf, 1)); }
    .aleta-cm-bagian-kaki { display: flex; justify-content: flex-end; padding-top: 4px; border-top: 1px solid var(--aleta-garis); }
    .aleta-cm-bagian-tombol[aria-expanded="true"] { background: var(--aleta-latar-naik); color: var(--aleta-tulisan); }
    .aleta-sudut-sorot {
      position: fixed; z-index: 3; width: 44px; height: 44px; pointer-events: none;
      border: 0 solid var(--aleta-merek, #3b82f6);
      box-shadow: 0 0 18px 2px color-mix(in srgb, var(--aleta-merek, #3b82f6) 45%, transparent);
    }
    .aleta-sudut-sorot[data-sudut="ki-at"] { border-top-width: 3px; border-left-width: 3px; border-top-left-radius: 10px; }
    .aleta-sudut-sorot[data-sudut="ka-at"] { border-top-width: 3px; border-right-width: 3px; border-top-right-radius: 10px; }
    .aleta-sudut-sorot[data-sudut="ki-bw"] { border-bottom-width: 3px; border-left-width: 3px; border-bottom-left-radius: 10px; }
    .aleta-sudut-sorot[data-sudut="ka-bw"] { border-bottom-width: 3px; border-right-width: 3px; border-bottom-right-radius: 10px; }
    .aleta-sudut-ket {
      position: absolute; padding: 0 4px; border-radius: 6px; background: var(--aleta-merek, #3b82f6);
      color: #fff; font-family: system-ui, sans-serif; font-size: calc(11.5px * var(--aleta-skala-huruf, 1)); font-weight: 700; line-height: 1.4;
    }
    .aleta-sudut-sorot[data-sudut$="-at"] .aleta-sudut-ket { top: 6px; }
    .aleta-sudut-sorot[data-sudut$="-bw"] .aleta-sudut-ket { bottom: 6px; }
    .aleta-sudut-sorot[data-sudut^="ki-"] .aleta-sudut-ket { left: 6px; }
    .aleta-sudut-sorot[data-sudut^="ka-"] .aleta-sudut-ket { right: 6px; }
    .aleta-lipatan[data-lipat-asal="kartu"][data-terbuka="tidak"] > :not(.aleta-lipat-kepala) { display: none !important; }
    :host([data-kulit="modern"]) .aleta-lipat-kepala {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
      margin: 0;
      padding: 7px 10px;
      border: 0;
      border-radius: 8px;
      background: transparent;
      color: var(--aleta-tulisan);
      font-family: inherit;
      font-size: calc(12.5px * var(--aleta-skala-huruf, 1));
      font-weight: 700;
      line-height: 1.35;
      letter-spacing: 0.01em;
      text-transform: none;
      text-align: left;
      list-style: none;
      cursor: pointer;
      user-select: none;
    }
    :host([data-kulit="modern"]) .aleta-lipat-kepala:hover { background: var(--aleta-latar-naik); }
    :host([data-kulit="modern"]) .aleta-lipat-kepala:focus-visible { outline: 2px solid var(--aleta-merek); outline-offset: 1px; }
    :host([data-kulit="modern"]) .aleta-lipat-panah {
      position: relative;
      display: inline-block;
      flex: 0 0 auto;
      width: 14px;
      height: 14px;
      color: var(--aleta-tulisan-lembut);
      font-size: 0 !important;
      line-height: 0;
      opacity: 1;
    }
    :host([data-kulit="modern"]) .aleta-lipat-panah::before {
      content: "";
      position: absolute;
      left: 3px;
      top: 4px;
      width: 6px;
      height: 6px;
      border-right: 2px solid currentColor;
      border-bottom: 2px solid currentColor;
      transform: rotate(-45deg);
      transition: transform 0.15s ease;
    }
    :host([data-kulit="modern"]) .aleta-lipat-kepala[aria-expanded="true"] > .aleta-lipat-panah::before {
      top: 2px;
      transform: rotate(45deg);
    }
    :host([data-kulit="modern"]) .aleta-lipat-judul { flex: 1 1 auto; min-width: 0; overflow-wrap: anywhere; }
    :host([data-kulit="modern"]) .aleta-lipat-ringkas,
    :host([data-kulit="modern"]) .aleta-lipat-lencana[hidden] { display: none; }
    :host([data-kulit="modern"]) .aleta-lipat-lencana {
      flex: none;
      margin-left: auto;
      padding: 1px 8px;
      border-radius: 999px;
      background: var(--aleta-latar-naik);
      color: var(--aleta-tulisan-lembut);
      font-size: calc(11px * var(--aleta-skala-huruf, 1));
      font-weight: 600;
    }
    /* Kepala kotak widget: tombol lipat + kendali; sisa kepala tetap pegangan geser. */
    :host([data-kulit="modern"]) .aleta-cmw-kepala { padding: 4px 6px 4px 4px; }
    :host([data-kulit="modern"]) .aleta-cmw-kepala > .aleta-lipat-kepala,
    :host([data-kulit="modern"]) .aleta-cm-kepala > .aleta-lipat-kepala { flex: 0 1 auto; padding: 5px 8px; }
    :host([data-kulit="modern"]) .aleta-cm-kepala > .aleta-lipat-kepala .aleta-cm-judul { white-space: nowrap; }
    :host([data-kulit="modern"]) .aleta-cm-kelompok > .aleta-lipat-kepala { width: 100%; padding: 8px 40px 8px 12px; border-radius: 0; }
    .aleta-cm-badan { display: flex; flex-direction: column; flex: 1 1 auto; min-height: 0; }

    /* Butir 7: kendali bagian, garis tarik, jendela melayang, Atur kelompok. */
    :host([data-kulit="modern"]) .aleta-cm-kelompok { position: relative; }
    .aleta-cmw-kel-alat { position: absolute; top: 5px; right: 8px; display: inline-flex; gap: 2px; }
    .aleta-cmw-pisah, .aleta-cmw-gabung, .aleta-cmw-sembunyi {
      width: 26px;
      height: 26px;
      padding: 0;
      border: 0;
      border-radius: 6px;
      background: transparent;
      color: var(--aleta-tulisan-lembut);
      font-size: calc(14px * var(--aleta-skala-huruf, 1));
      line-height: 1;
      cursor: pointer;
    }
    .aleta-cmw-pisah:hover, .aleta-cmw-gabung:hover, .aleta-cmw-sembunyi:hover { background: var(--aleta-latar-naik); color: var(--aleta-tulisan); }
    .aleta-cmw-tarik {
      position: relative;
      flex: none;
      height: 10px;
      margin: 0;
      cursor: ns-resize;
      touch-action: none;
      outline: none;
    }
    .aleta-cmw-tarik::before {
      content: "";
      position: absolute;
      left: 50%;
      top: 3px;
      width: 36px;
      height: 4px;
      margin-left: -18px;
      border-radius: 999px;
      background: var(--aleta-garis-kuat);
    }
    .aleta-cmw-tarik:hover::before, .aleta-cmw-tarik:focus-visible::before, .aleta-cmw-tarik[data-ditarik="ya"]::before { background: var(--aleta-merek); }
    .aleta-cmw-lepasan .aleta-cmw-tarik { cursor: nwse-resize; }
    .aleta-lipat-isi[hidden] ~ .aleta-cmw-tarik { display: none; }
    .aleta-cmw-lepas-wadah {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: calc(12.5px * var(--aleta-skala-huruf, 1));
      line-height: 1.45;
      color: var(--aleta-tulisan);
      --cm-merek-latar: color-mix(in srgb, var(--aleta-merek) 16%, var(--aleta-latar));
      --cm-merek-garis: color-mix(in srgb, var(--aleta-merek) 42%, var(--aleta-latar));
      --cm-merek-tombol: color-mix(in srgb, var(--aleta-merek) 24%, var(--aleta-latar));
      --cm-merek-tombol-sorot: color-mix(in srgb, var(--aleta-merek) 36%, var(--aleta-latar));
      --cm-lewat-latar: color-mix(in srgb, var(--aleta-lewat) 16%, var(--aleta-latar-naik));
      --cm-mendesak-latar: color-mix(in srgb, var(--aleta-mendesak) 16%, var(--aleta-latar-naik));
    }
    .aleta-cmw-lepasan {
      position: fixed;
      max-width: calc(100vw - 24px);
      max-height: calc(100vh - 16px);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .aleta-cmw-lepasan > .aleta-cmw-isi, .aleta-cmw-lepasan > .aleta-cm-badan { min-height: 0; overflow-y: auto; }
    .aleta-cmw-lepasan .aleta-cmw-kepala, .aleta-cmw-lepasan .aleta-cm-kepala { cursor: move; }
    .aleta-cmw-lepasan[data-digeser="ya"] { opacity: 0.92; }
    .aleta-cmw-kelompok-lepas .aleta-cm-daftar { padding: 0; }
    .aleta-cmw-bagian-lain { display: grid; gap: 4px; margin: 4px 12px 2px; }
    .aleta-cmw-bagian-lain-baris {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      color: var(--aleta-tulisan-lembut);
      font-size: calc(11.5px * var(--aleta-skala-huruf, 1));
    }
    .aleta-cmw-atur-kel { margin-top: 6px; }
    .aleta-cmw-atur-sub {
      margin: 4px 4px 2px;
      color: var(--aleta-tulisan-lembut);
      font-size: calc(10.5px * var(--aleta-skala-huruf, 1));
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    .aleta-cmw-atur-kel-baris { display: flex; align-items: center; gap: 8px; padding: 7px 4px 7px 28px; border-top: 1px solid var(--aleta-garis); }
    .aleta-cmw-atur-pisah, .aleta-cmw-atur-ukuran {
      flex: none;
      width: 24px;
      height: 22px;
      padding: 0;
      border: 1px solid var(--aleta-garis);
      border-radius: 6px;
      background: transparent;
      color: var(--aleta-tulisan-lembut);
      cursor: pointer;
    }
    .aleta-cmw-atur-pisah[aria-pressed="true"] { border-color: var(--aleta-merek); color: var(--aleta-merek); }
    .aleta-cmw-sinkron { margin-top: 6px; }
    .aleta-cmw-sinkron[data-nada="mendesak"] { color: var(--aleta-mendesak); }
    @media (prefers-reduced-motion: reduce) {
      :host([data-kulit="modern"]) .aleta-lipat-panah::before { transition: none; }
    }

    /* Tidak pernah ikut tercetak - widget maupun kabar tutupnya. Akarnya di
     * <html>, di luar jangkauan aturan cetak halaman ("body > *:not(...)",
     * "body *"), jadi yang menyembunyikannya harus dibawa sendiri. Lapisan
     * kedua ada di blok cetak panel.css. */
    @media print {
      :host { display: none !important; }
    }
  `;

  // ─── Keadaan ───────────────────────────────────────────────────────────────

  const keadaan = {
    /** Penyimpanan sudah terbaca sekali - sebelum itu tidak ada yang diputuskan. */
    siap: false,
    induk: true,
    nyala: false,
    tema: "gelap",
    warna: "",
    /** { kiri?, bawah?, kecil } atau null (bawaan: kiri bawah, terbentang). */
    posisi: null,
    /** Peran yang dipilih petugas; kosong = portal yang memilih. */
    peran: "",
    lipatan: {},
    riwayatSipp: [],
    tautanSipp: {},
    petaSipp: new Map(),
    /**
     * Permintaan alamat bersandi ke server, per kunci nomor:
     * { keadaan: "memuat" | "gagal", alasan, pada }. Yang berhasil tidak
     * tinggal di sini - ia masuk tautanSipp (lihat siapkanTautanServer).
     */
    tautanServer: new Map(),
    /** Jawaban terakhir yang BERHASIL - tetap ditampilkan saat portal diam. */
    data: null,
    /** { jenis: "masuk"|"akses"|"jaringan"|"tidak-ada"|"jawaban", pesan } */
    galat: null,
    memuat: false,
    diterima: 0,
    terakhirMinta: 0,
    perluSegar: false,
    kabar: "",
    kakiTerbuka: {},
    // ── Tahap 3 - tidak dibaca apa pun dalam tampilan Lama ──
    /** { [id butir]: tanda } - lihat tandaBersih. */
    tanda: {},
    /** Keadaan sambungan dari permintaan checklist terakhir - lihat catatSambungan. */
    sambungan: { keadaan: "", lamaMs: 0 },
    catatan: "",
    lamaSidang: { berjalan: null, riwayat: [] },
    /** { semua?, sipp?, abt?, portal? } masing-masing { urutan: [], mati: [] }. */
    susunan: {},
    /** { sipp?, abt?, portal? } -> "kiri-bawah" | "kanan-bawah" | "kiri-atas" | "kanan-atas". */
    sudut: {},
    aturTerbuka: false,
    /** Butir 13 (2 Okt): menu bagian di kepala checklist terbuka. Tidak disimpan. */
    bagianTerbuka: false,
    /** Tanggal yang dipilih di kalender tenggat ("YYYY-MM-DD"), atau kosong. */
    hariKalender: "",
    // ── Perbaikan 1 Okt butir 7 - hanya UI Baru ──
    /** Lihat tataBersih. */
    tata: {
      bagian: {},
      kelompok: { urutan: [], mati: [] },
      serverPada: "",
      diubah: 0,
      tertunda: false,
      lokalSaja: "",
    },
    /** Keadaan simpan ke server untuk Atur widget: { status, pada, pesan }. */
    sinkronTata: { status: "", pada: 0, pesan: "" },
  };

  let akar = null;
  let bayang = null;
  let jamBerkala = null;
  let jamKabarSingkat = null;
  let jamKabarTutup = null;
  let nomorMinta = 0;
  let abaikanKlikPil = false;
  let jamTunda = null;
  let jamSidang = null;
  /* F3.1: skors hari ini dari Jadwal Sidang ALETA (blok di widget Lama sidang). */
  const ALAMAT_SKORS = "/aleta/api/aleta-ecourt/sidang/skors";
  const SKORS_SEGAR_MS = 60 * 1000;
  const SKORS_TAMPIL_MAKS = 6;
  const skorsPortal = { diterima: 0, daftar: null, galat: "", memuat: false };
  let jamSkors = null;
  let jamCatatan = null;
  /** Elemen catatan dipakai ulang antar penggambaran - ketikan, kursor, dan urungkan tidak hilang. */
  let kotakCatatan = null;
  let angkaTertulis = "";
  let angkaTertulisPada = 0;

  // ─── Pembantu kecil ────────────────────────────────────────────────────────

  function el(tag, kelas, teks) {
    const e = document.createElement(tag);
    if (kelas) e.className = kelas;
    if (teks !== undefined && teks !== null) e.textContent = String(teks);
    return e;
  }

  function tombol(kelas, teks, judul, saatKlik, fokus) {
    const t = el("button", kelas, teks);
    t.type = "button";
    t.title = judul;
    t.setAttribute("aria-label", judul);
    if (fokus) t.setAttribute("data-fokus", fokus);
    t.addEventListener("click", saatKlik);
    return t;
  }

  function objek(x) {
    return x && typeof x === "object" && !Array.isArray(x) ? x : {};
  }

  /** Kunci milik objek itu sendiri - "constructor" dari portal bukan tujuan. */
  function punya(obj, kunci) {
    return Object.prototype.hasOwnProperty.call(obj, kunci);
  }

  function angka(x, cadangan) {
    return typeof x === "number" && Number.isFinite(x) && x >= 0 ? x : cadangan;
  }

  function dua(n) {
    return String(n).padStart(2, "0");
  }

  function jamMenit(t) {
    return `${dua(t.getHours())}.${dua(t.getMinutes())}`;
  }

  function kunciNomor(nomor) {
    return String(nomor || "").replace(/\s+/g, "").toUpperCase();
  }

  /** Kalimat pertama saja - pesan alatAmbil menyambung daftar panjang sesudahnya. */
  function kalimatPertama(teks) {
    const s = String(teks || "").trim();
    const i = s.search(/\.\s/);
    return i > 0 ? s.slice(0, i + 1) : s.slice(0, 220);
  }

  async function baca(kunci) {
    try {
      return objek(await chrome.storage.local.get(kunci));
    } catch {
      return {};
    }
  }

  function tulis(isi) {
    try {
      const janji = chrome.storage.local.set(isi);
      if (janji && typeof janji.catch === "function") janji.catch(() => {});
    } catch {
      /* konteks ekstensi mati (ekstensi dimuat ulang) - berlaku di tab ini saja */
    }
  }

  function hapusSimpanan(kunci) {
    try {
      const janji = chrome.storage.local.remove(kunci);
      if (janji && typeof janji.catch === "function") janji.catch(() => {});
    } catch {
      /* sama seperti tulis() */
    }
  }

  function catat(ringkas, rinci) {
    try {
      if (typeof alatCatat === "function") alatCatat("checklist", ringkas, rinci || "");
    } catch {
      /* kotak hitam hanya kemudahan */
    }
  }

  function warnaBersih(x) {
    const s = String(x || "");
    return WARNA_DIKENAL.includes(s) ? s : "";
  }

  function peranBersih(x) {
    const s = String(x || "").trim();
    return /^[a-z][a-z0-9-]{0,39}$/.test(s) ? s : "";
  }

  function posisiBersih(p) {
    if (!p || typeof p !== "object") return null;
    const hasil = { kecil: p.kecil === true };
    if (Number.isFinite(p.kiri) && Number.isFinite(p.bawah)) {
      hasil.kiri = Math.max(0, Math.round(p.kiri));
      hasil.bawah = Math.max(0, Math.round(p.bawah));
    }
    return hasil;
  }

  /* === CHECKLIST-POSISI 12 Okt === */
  /**
   * Bawaan TERTUTUP: sesi baru (belum ada posisi tersimpan) memulai widget
   * sebagai lencana/pil - daftarnya tidak menutupi halaman sebelum diminta.
   * Yang pernah membentangkannya (kecil:false tersimpan) tetap terbentang -
   * pilihan petugas diingat.
   */
  function sedangKecil() {
    return keadaan.posisi ? keadaan.posisi.kecil === true : true;
  }
  /* === AKHIR CHECKLIST-POSISI === */

  function lipatanBersih(x) {
    const hasil = {};
    for (const [k, v] of Object.entries(objek(x))) if (typeof v === "boolean") hasil[k] = v;
    return hasil;
  }

  // ─── Tahap 3: gerbang tampilan uji ─────────────────────────────────────────
  //
  // Ditanyakan ke panel-alat.js tiap kali, bukan disalin: pengalih di popup
  // berlaku seketika (peristiwa aleta-uji-berubah), dan panel-alat.js yang
  // tidak termuat berarti Lama - tidak ada yang berubah.

  function modeUji() {
    try {
      return typeof alatUjiMode === "function" ? alatUjiMode() : "lama";
    } catch {
      return "lama";
    }
  }

  /** Saklar fitur ide menyala - dalam Lama selalu tidak (alatFiturNyala sendiri menjaganya). */
  function fitur(kode) {
    try {
      return typeof alatFiturNyala === "function" && alatFiturNyala(kode) === true;
    } catch {
      return false;
    }
  }

  /**
   * Perbaikan 30 Sep sore butir 3 (K5): menandai penjelasan teknis dengan
   * kelas aleta-teknis - hanya di luar Lama, supaya widget Lama tetap
   * identik sampai ke nama kelasnya. Dipulangkan elemennya sendiri.
   */
  function teknis(x) {
    if (x && x.classList && modeUji() !== "lama") x.classList.add("aleta-teknis");
    return x;
  }

  /** Nilai saklar "Sembunyikan penjelasan teknis" (bawaan nyala) - dari panel-alat.js. */
  function saklarTeknis() {
    try {
      return typeof alatTeknisSaklar === "function" ? alatTeknisSaklar() !== false : true;
    } catch {
      return true;
    }
  }

  /**
   * Saklar "Sembunyikan penjelasan teknis" di widget (K5). Yang menyimpan
   * tetap panel-alat.js (alatSetelTeknis) - satu penulis kunci
   * sembunyikanTeknis, dan tab lain ikut lewat onChanged.
   */
  function susunSaklarTeknis() {
    if (modeUji() === "lama" || typeof alatSetelTeknis !== "function") return null;
    const nyala = saklarTeknis();
    const baris = el("div", "aleta-cmw-teknis");
    baris.setAttribute("data-widget-teknis", "ya");
    const teks = el("div", "aleta-cmw-teknis-teks");
    teks.appendChild(el("b", "", "Sembunyikan penjelasan teknis"));
    teks.appendChild(el("small", "", "Error, peringatan, dan konfirmasi tetap tampil."));
    baris.appendChild(teks);
    const saklar = tombol(
      "aleta-cmw-saklar",
      "",
      nyala ? "Tampilkan lagi penjelasan teknis" : "Sembunyikan penjelasan teknis",
      () => {
        void Promise.resolve(alatSetelTeknis(!saklarTeknis())).then(() => gambar());
      },
      "saklar-teknis"
    );
    saklar.setAttribute("role", "switch");
    saklar.setAttribute("aria-checked", nyala ? "true" : "false");
    saklar.setAttribute("aria-label", "Sembunyikan penjelasan teknis");
    baris.appendChild(saklar);
    return baris;
  }

  /** UI Baru: perbaikan desain D8-D11 berlaku. */
  function modern() {
    try {
      return typeof alatKulit === "function" && alatKulit() === "modern";
    } catch {
      return false;
    }
  }

  /**
   * tandaChecklist - tanda Selesai/Tunda di peramban ini (popup-7):
   *   { [id butir portal]: {
   *       tanda: "selesai" | "tunda",
   *       pada: ms saat ditandai,
   *       sampai: ms berakhirnya tunda (hanya "tunda"),
   *       peran: peran checklist saat ditandai (kunci portal),
   *       jenis: jenis butir ("hakim.konsep-putusan"),
   *       nomor, judul: untuk daftar "disembunyikan" dan pemindahan ke server (tahap 5)
   *   } }
   * id butir portal = "<jenis>:<kunci calon>" (checklist-milestone.ts), jadi
   * sudah membawa jenis dan perkaranya.
   */
  function tandaBersih(x) {
    const hasil = {};
    for (const [id, t] of Object.entries(objek(x))) {
      if (!id || id.length > 300 || !t || typeof t !== "object") continue;
      const tanda = t.tanda === "selesai" || t.tanda === "tunda" ? t.tanda : "";
      const pada = Number(t.pada);
      if (!tanda || !Number.isFinite(pada)) continue;
      const isi = {
        tanda,
        pada,
        peran: peranBersih(t.peran),
        jenis: String(t.jenis || "").slice(0, 80),
        nomor: String(t.nomor || "").slice(0, 60),
        judul: String(t.judul || "").slice(0, 120),
      };
      if (tanda === "tunda") {
        const sampai = Number(t.sampai);
        if (!Number.isFinite(sampai)) continue;
        isi.sampai = sampai;
      }
      hasil[id] = isi;
    }
    return hasil;
  }

  /** Yang terbaru saja, paling banyak TANDA_MAKS. */
  function pangkasTanda(peta) {
    const semua = Object.entries(peta);
    if (semua.length <= TANDA_MAKS) return peta;
    return Object.fromEntries(semua.sort((a, b) => b[1].pada - a[1].pada).slice(0, TANDA_MAKS));
  }

  /** catatanCepat - { teks, pada } (popup-20). Hanya teksnya yang dipakai. */
  function catatanBersih(x) {
    return String(objek(x).teks || "").slice(0, CATATAN_MAKS);
  }

  /**
   * lamaSidang (popup-21):
   *   { berjalan: { mulai, skorsSejak (0 = tidak diskors), skorsMs } | null,
   *     riwayat: [{ mulai, selesai, lamaMs, skorsMs }] - terbaru di depan }
   */
  function lamaSidangBersih(x) {
    const s = objek(x);
    const b = objek(s.berjalan);
    const berjalan = Number.isFinite(b.mulai)
      ? {
          mulai: b.mulai,
          skorsSejak: Number.isFinite(b.skorsSejak) && b.skorsSejak > 0 ? b.skorsSejak : 0,
          skorsMs: Number.isFinite(b.skorsMs) && b.skorsMs > 0 ? b.skorsMs : 0,
        }
      : null;
    const riwayat = (Array.isArray(s.riwayat) ? s.riwayat : [])
      .filter((r) => r && Number.isFinite(r.lamaMs) && r.lamaMs >= SIDANG_MIN_MS)
      .slice(0, RIWAYAT_SIDANG_MAKS)
      .map((r) => ({
        mulai: Number(r.mulai) || 0,
        selesai: Number(r.selesai) || 0,
        lamaMs: r.lamaMs,
        skorsMs: Number(r.skorsMs) || 0,
      }));
    return { berjalan, riwayat };
  }

  /** susunanWidget (dok UI Baru): { semua?|sipp?|abt?|portal?: { urutan: [id], mati: [id] } }. */
  function susunanBersih(x) {
    const dikenal = new Set(WIDGET.map((w) => w.id));
    const satu = (s) => {
      const o = objek(s);
      const saring = (d) => [...new Set((Array.isArray(d) ? d : []).map(String).filter((id) => dikenal.has(id)))];
      return { urutan: saring(o.urutan), mati: saring(o.mati) };
    };
    const hasil = {};
    for (const k of ["semua", "sipp", "abt", "portal"]) if (punya(objek(x), k)) hasil[k] = satu(x[k]);
    return hasil;
  }

  /** sudutWidget (popup-9): { sipp?, abt?, portal? } -> salah satu DAFTAR_SUDUT. */
  function sudutBersih(x) {
    const hasil = {};
    for (const k of ["sipp", "abt", "portal"]) if (DAFTAR_SUDUT.includes(objek(x)[k])) hasil[k] = x[k];
    return hasil;
  }

  // ─── Halaman yang tidak boleh memuatnya ────────────────────────────────────

  function halamanTerlarang() {
    const jalur = String(location.pathname || "").toLowerCase();
    if (POLA_HALAMAN_CETAK.some((pola) => jalur.includes(pola))) return true;
    if (alatHalamanPublikPortal(jalur)) return true;
    // Halaman masuk (SIPP, ABT, portal) dan verifikasi dokumen publik portal:
    // tidak ada sesi untuk dibaca, dan kotak yang menutupi isian sandi hanya
    // mengganggu.
    return /\/(login|verifikasi-dokumen)(\/|$)/.test(jalur);
  }

  function bolehTampil() {
    return keadaan.siap && keadaan.induk && keadaan.nyala && !halamanTerlarang();
  }

  // ─── Alamat dasar tiap aplikasi ────────────────────────────────────────────

  /**
   * Akar SIPP. Di halaman SIPP dibaca dari alamatnya sendiri (/SIPP/ di
   * peladen, /index.php/ di mesin setempat); dari ABT dan portal diturunkan
   * dengan aturan yang sama dengan alamatSippDariAbt di abt.js.
   */
  function dasarSipp() {
    const jalur = String(location.pathname || "");
    if (JENIS === "sipp") {
      const cocok = jalur.match(/^(.*?\/SIPP\/)/i) || jalur.match(/^(\/index\.php\/)/i);
      if (cocok) return `${location.origin}${cocok[1]}`;
    }
    return location.hostname === "127.0.0.1" ? `${location.origin}/index.php/` : `${location.origin}/SIPP/`;
  }

  function berandaSipp() {
    const dasar = dasarSipp();
    return /\/index\.php\/$/i.test(dasar) ? `${dasar}dashboard` : dasar;
  }

  /** Akar pengendali ABT - sama dengan asalAbt() di abt.js. */
  function dasarAbt() {
    if (JENIS === "abt") {
      const cocok = String(location.pathname || "").match(/^(.*?\/abt)\//);
      if (cocok) return `${location.origin}${cocok[1]}`;
    }
    return `${location.origin}/aps_badilag/abt`;
  }

  /** Alamat http(s) di asal halaman ini; selain itu kosong. */
  function alamatDalam(mentah, dasar) {
    const s = String(mentah || "").trim();
    if (!s) return "";
    if (/^[a-z][a-z0-9+.-]*:/i.test(s) && !/^https?:/i.test(s)) return "";
    let url;
    try {
      url = new URL(s, dasar);
    } catch {
      return "";
    }
    if (!/^https?:$/.test(url.protocol) || url.origin !== location.origin) return "";
    return url.href;
  }

  /**
   * Alamat portal. Rute Next.js lazim ditulis tanpa basePath ("/aleta-ecourt"),
   * padahal portal di peladen duduk di bawah /aleta - jadi awalannya
   * ditambahkan bila belum ada. "/aleta-ecourt" BUKAN berawalan /aleta: huruf
   * sesudahnya "-", bukan "/".
   *
   * Jalurnya diperiksa SESUDAH dinormalkan: "/aleta/../SIPP/perkara_hapus/1"
   * seasal dan berawalan /aleta, tetapi yang dibuka /SIPP/perkara_hapus/1.
   * Yang keluar dari /aleta/ ditolak.
   */
  function alamatPortal(mentah) {
    let s = String(mentah || "").trim();
    if (s.startsWith("/") && !s.startsWith("//") && !/^\/aleta(?=[/?#]|$)/.test(s)) s = `/aleta${s}`;
    const href = alamatDalam(s, `${location.origin}/aleta/`);
    return href && new URL(href).pathname.startsWith("/aleta/") ? href : "";
  }

  /**
   * Alamat e-Court. Yang mutlak hanya diterima di *.mahkamahagung.go.id dan
   * hanya lewat https - aturan yang sama dengan pengambil berkas e-Court di
   * bot: tautan dari jawaban yang mengarah ke tempat lain tidak diikuti, dan
   * sesi e-Court tidak dibuka lewat http biasa. Yang relatif diperlakukan
   * sebagai halaman portal ALETA.
   */
  function alamatEcourt(mentah) {
    const s = String(mentah || "").trim();
    if (/^https?:\/\//i.test(s)) {
      try {
        const url = new URL(s);
        if (url.protocol !== "https:") return "";
        return /(^|\.)mahkamahagung\.go\.id$/i.test(url.hostname) ? url.href : "";
      } catch {
        return "";
      }
    }
    return alamatPortal(s);
  }

  // ─── Jalan ke halaman perkara SIPP ─────────────────────────────────────────

  /** Jalur pintu masuk perkara SIPP: perkara_detil/<enc> (atau perkara_detil_agama/<enc>). */
  const POLA_DETIL_SIPP = /\/perkara_detil(?:_[a-z]+)?\/[^/]+\/?$/i;

  /**
   * Pintu masuk perkara yang sah: seasal, dan JALURNYA (sesudah dinormalkan,
   * tanpa kueri) perkara_detil/<enc>. Halaman detail berbasis flash-session
   * (detil_perkara_agama tanpa <enc>) tidak dapat dibuka ulang - SIPP
   * mengalihkannya ke beranda - jadi riwayat konten.js yang menyimpan
   * location.href halaman itu tidak boleh mengalahkan tautan hasil panen.
   * Aturan yang sama untuk panen, tautan tersimpan, dan riwayat. Pulang
   * alamat mutlaknya, atau kosong.
   */
  function alamatDetilSipp(url) {
    const href = typeof url === "string" ? alamatDalam(url, location.origin) : "";
    return href && POLA_DETIL_SIPP.test(new URL(href).pathname) ? href : "";
  }

  /** Peta nomor -> alamat detil SIPP; riwayat halaman detail menang atas daftar. */
  function susunPetaSipp() {
    const peta = new Map();
    for (const [nomor, isi] of Object.entries(objek(keadaan.tautanSipp))) {
      const href = alamatDetilSipp(objek(isi).url);
      if (href) peta.set(kunciNomor(nomor), href);
    }
    const riwayat = Array.isArray(keadaan.riwayatSipp) ? keadaan.riwayatSipp : [];
    for (const r of [...riwayat].reverse()) {
      const href = r && r.nomor ? alamatDetilSipp(r.url) : "";
      if (href) peta.set(kunciNomor(r.nomor), href);
    }
    keadaan.petaSipp = peta;
  }

  /** Nomor perkara bila teksnya memuat TEPAT satu - baris daftar, bukan tabel gabungan. */
  function satuNomor(teks) {
    const semua = new Set(String(teks || "").match(new RegExp(SUMBER_POLA_NOMOR, "g")) || []);
    return semua.size === 1 ? [...semua][0] : "";
  }

  /**
   * Teks satu baris tabel, SEL DEMI SEL. SIPP mencetak sel tanpa spasi di
   * antaranya ('</td><td>'), sehingga textContent baris menyambung nomor urut,
   * nomor perkara, dan jenis perkara menjadi "1389/Pdt.G/2026/PA.DglCerai" -
   * nomor yang tidak dikenali pola mana pun.
   */
  function teksBaris(baris) {
    const sel = baris.cells ? Array.from(baris.cells) : Array.from(baris.children || []);
    return sel.length ? sel.map((s) => s.textContent || "").join(" ") : String(baris.textContent || "");
  }

  /**
   * Memanen tautan "detil" dari daftar perkara SIPP yang sedang terbuka.
   *
   * SIPP merender tiap baris daftar dengan [<a href=".../perkara_detil_agama/
   * <enc>">detil</a>] (views/perkara_list/perkara_list.php) - alamat yang sah
   * dibuka kapan pun. Hanya dijalankan selama widget menyala DAN terpasang:
   * dengan saklar mati, halaman SIPP tidak dibaca sama sekali oleh berkas
   * ini - termasuk oleh permintaan yang masih terbang saat saklar dimatikan.
   * Saklar yang dimatikan juga menghapus tautan yang sudah dipanen (lihat
   * lupakanTautanSipp).
   */
  function bolehPanen() {
    return JENIS === "sipp" && !!document.body && bolehTampil() && !!akar && akar.isConnected;
  }

  async function panenTautanSipp() {
    if (!bolehPanen()) return;
    const temuan = [];
    for (const a of Array.from(document.querySelectorAll('a[href*="perkara_detil"]'))) {
      const href = alamatDetilSipp(String(a.href || ""));
      if (!href) continue;
      const baris = a.closest("tr");
      const nomor = baris ? satuNomor(teksBaris(baris)) : "";
      if (nomor) temuan.push([kunciNomor(nomor), href]);
    }
    if (temuan.length === 0) return;

    const simpan = await baca([KUNCI_TAUTAN_SIPP]);
    // Saklar boleh dimatikan selama penyimpanan dibaca - yang dipanen
    // sebelum itu tidak ditulis, dan tidak menghidupkan lagi yang baru dihapus.
    if (!bolehPanen()) return;
    const peta = { ...objek(simpan[KUNCI_TAUTAN_SIPP]) };
    const kini = Date.now();
    let berubah = false;
    for (const [nomor, url] of temuan) {
      const lama = peta[nomor];
      // Enkripsi SIPP berganti tiap render, jadi alamatnya selalu "baru".
      // Yang sudah diingat dan masih muda dibiarkan - menulis ulang tiap
      // daftar dibuka hanya menambah kerja penyimpanan tanpa menambah apa pun.
      if (lama && alamatDetilSipp(lama.url) && kini - Number(lama.pada || 0) < TAUTAN_SEGAR_MS) continue;
      peta[nomor] = { url, pada: kini };
      berubah = true;
    }
    if (!berubah) return;
    const urut = Object.entries(peta)
      .sort((x, y) => Number(objek(y[1]).pada || 0) - Number(objek(x[1]).pada || 0))
      .slice(0, TAUTAN_MAKS);
    keadaan.tautanSipp = Object.fromEntries(urut);
    susunPetaSipp();
    tulis({ [KUNCI_TAUTAN_SIPP]: keadaan.tautanSipp });
  }

  /**
   * Tautan hasil panen hanya berguna bagi widget ini. Saklar yang dimatikan -
   * dari popup, dari ×, atau selagi tidak ada halaman yang terbuka (dihapus
   * di halaman berikutnya, lihat mulai) - melupakannya: dengan saklar mati
   * tidak ada yang dibaca dari halaman SIPP, dan tidak ada yang tersisa
   * darinya. riwayatPerkaraSipp milik konten.js (panel ALETA), tidak disentuh.
   */
  function lupakanTautanSipp() {
    keadaan.tautanSipp = {};
    susunPetaSipp();
    hapusSimpanan(KUNCI_TAUTAN_SIPP);
  }

  function namaTabSipp(halaman) {
    const h = String(halaman || "").trim();
    if (!h) return "";
    return punya(TAB_SIPP, h.toLowerCase()) ? TAB_SIPP[h.toLowerCase()] : h.slice(0, 40);
  }

  // ─── Tombol Kerjakan ───────────────────────────────────────────────────────

  /**
   * Ke mana satu butir dikerjakan. Mengembalikan
   *   { tujuan, label, href, judul, salin?, tempat? }
   * href kosong berarti tombolnya mati - judulnya menyebut sebabnya. salin =
   * nomor yang disalin saat ditekan, karena halamannya sendiri tidak diketahui
   * dan nomor itu harus dicari di tempat (SIPP / e-Court).
   */
  function tautanKerjakan(butir) {
    const k = objek(butir && butir.kerjakan);
    const tujuan = String(k.tujuan || "").toLowerCase();
    const nama = punya(NAMA_TUJUAN, tujuan) ? NAMA_TUJUAN[tujuan] : "";
    const perkara = objek(butir && butir.perkara);
    const nomor = String(perkara.nomor || "").trim();
    const idPerkara = /^\d+$/.test(String(perkara.id ?? "").trim()) ? String(perkara.id).trim() : "";
    const halaman = String(k.halaman || "").trim();

    if (!nama) {
      return {
        tujuan,
        label: "Kerjakan",
        href: "",
        judul: `Tujuan "${tujuan || "kosong"}" belum dikenal ekstensi ini - perbarui ekstensi ALETA.`,
      };
    }
    const label = `Kerjakan di ${nama}`;

    if (tujuan === "ecourt" && !String(k.alamat || "").trim()) {
      // Portal boleh tidak tahu halaman dokumennya. e-Court tetap dibuka -
      // di berandanya - dan nomornya disalin untuk dicari, sama seperti SIPP.
      return {
        tujuan,
        label,
        href: ECOURT,
        judul: nomor
          ? `Portal tidak menyertakan halaman e-Court untuk butir ini. e-Court dibuka di berandanya dan nomor ${nomor} disalin untuk dicari.`
          : "Buka e-Court (tab baru)",
        salin: nomor,
        tempat: "e-Court",
      };
    }

    if (tujuan === "aleta" || tujuan === "ecourt") {
      const href = tujuan === "aleta" ? alamatPortal(k.alamat) : alamatEcourt(k.alamat);
      if (!href) {
        return {
          tujuan,
          label,
          href: "",
          judul: k.alamat
            ? `Alamat dari portal ditolak (${String(k.alamat).slice(0, 80)}) - bukan alamat ${nama} yang sah.`
            : `Portal tidak menyertakan alamat ${nama} untuk butir ini.`,
        };
      }
      return { tujuan, label, href, judul: `Buka di ${nama === "ALETA" ? "portal ALETA" : nama} (tab baru)` };
    }

    // ABT dan SIPP: alamatnya SELALU dibangun di sini, dari perkaranya. `alamat`
    // dari portal diabaikan - katalog tidak pernah memancarkannya untuk kedua
    // tujuan ini, dan alamat seasal belum tentu aman dibuka: ABT punya GET
    // yang menghapus (main/tanyajawab_template?hapus=), dan
    // "/aleta/../SIPP/..." seasal juga.
    if (tujuan === "abt") {
      const href = `${dasarAbt()}/main/beranda${idPerkara ? `?c=${idPerkara}` : ""}`;
      const kelompok = punya(BLANGKO_ABT, halaman.toLowerCase()) ? BLANGKO_ABT[halaman.toLowerCase()] : "";
      const sasaran = kelompok
        ? `pilih kelompok blangko ${kelompok}`
        : halaman
          ? `pilih blangko "${halaman.slice(0, 60)}"`
          : "pilih blangkonya";
      return {
        tujuan,
        label,
        href,
        judul: idPerkara
          ? `Buka ABT dengan perkara ${nomor || idPerkara} terpilih, lalu ${sasaran} di bilah kiri. ` +
            "Blangko tidak dapat dibuka langsung: alamatnya disandikan ABT."
          : `Buka ABT, lalu ${sasaran}.`,
      };
    }

    // SIPP: halaman perkaranya langsung, di tab pekerjaannya. Alamatnya dari
    // riwayat, panen daftar, atau server (siapkanTautanServer) - yang
    // terakhir itu membuat perkara yang belum pernah dibuka di peramban ini
    // pun terbuka langsung.
    //
    // Hanya di Baru dan UI Baru. Tampilan Lama tetap PERSIS ekstensi
    // sebelumnya (dijaga ekstensi-widget-tahap3: "Lama IDENTIK"): pintu masuk
    // tanpa tab, dan perkara yang belum terlihat ke beranda.
    const tab = namaTabSipp(halaman);
    const lanjut = tab ? `, lalu tab ${tab}` : "";
    const dikenal = nomor ? keadaan.petaSipp.get(kunciNomor(nomor)) : "";
    if (modeUji() === "lama") {
      if (dikenal) {
        return { tujuan, label, href: dikenal, judul: `Buka perkara ${nomor} di SIPP${lanjut} (tab baru)` };
      }
      return {
        tujuan,
        label,
        href: berandaSipp(),
        judul: nomor
          ? `Perkara ${nomor} belum pernah terbuka di SIPP pada peramban ini, jadi alamatnya belum diketahui. ` +
            `SIPP dibuka di berandanya dan nomornya disalin untuk dicari${lanjut}.`
          : `Buka SIPP${lanjut} (tab baru)`,
        salin: nomor,
        tempat: "SIPP",
      };
    }
    const menu = menuSipp(halaman);
    if (menu) {
      return {
        tujuan,
        label,
        href: `${dasarSipp()}${menu.jalur}`,
        judul: nomor
          ? `Buka menu ${menu.nama} di SIPP (tab baru). Nomor ${nomor} disalin untuk dicari di sana.`
          : `Buka menu ${menu.nama} di SIPP (tab baru).`,
        ...(nomor ? { salin: nomor, tempat: `SIPP (${menu.nama})`, menu: true } : {}),
      };
    }
    const nomorTab = nomorTabSipp(halaman);
    if (dikenal) {
      return {
        tujuan,
        label,
        href: alamatDenganTab(dikenal, nomorTab),
        judul:
          `Buka perkara ${nomor} di SIPP${tab ? ` langsung di tab ${tab}` : ""} (tab baru).` +
          (nomorTab
            ? ` Bila tab itu belum ada pada perkara ini, SIPP menampilkan Data Umum - tombol tambahnya ada di baris tombol atas.`
            : ""),
      };
    }
    return {
      tujuan,
      label,
      href: berandaSipp(),
      judul: nomor
        ? `${sebabTautanBelumAda(nomor, idPerkara)} Sementara itu SIPP dibuka di berandanya dan nomornya disalin untuk dicari${lanjut}.`
        : `Buka SIPP${lanjut} (tab baru)`,
      salin: nomor,
      tempat: "SIPP",
    };
  }

  /** Kalimat sebab tombol SIPP masih ke beranda: memuat, gagal (beserta alasan server), atau tanpa pengenal. */
  function sebabTautanBelumAda(nomor, idPerkara) {
    if (!idPerkara) {
      return `Portal tidak menyertakan pengenal perkara ${nomor}, jadi alamat halaman perkaranya di SIPP tidak dapat disusun.`;
    }
    const s = keadaan.tautanServer.get(kunciNomor(nomor));
    if (s && s.keadaan === "memuat") return `Alamat halaman perkara ${nomor} di SIPP sedang disiapkan server.`;
    if (s && s.keadaan === "gagal") {
      return `Alamat halaman perkara ${nomor} di SIPP belum dapat disusun: ${s.alasan || "server tidak menjawab."}`;
    }
    return `Alamat halaman perkara ${nomor} di SIPP belum diketahui.`;
  }

  /** Menu SIPP (bukan tab halaman perkara) untuk halaman semantik portal, atau null. */
  function menuSipp(halaman) {
    const h = String(halaman || "").trim().toLowerCase();
    return punya(MENU_SIPP, h) ? MENU_SIPP[h] : null;
  }

  /** Nomor tab halaman perkara SIPP untuk halaman semantik portal; "" = Data Umum. */
  function nomorTabSipp(halaman) {
    const h = String(halaman || "").trim().toLowerCase();
    return punya(NOMOR_TAB_SIPP, h) ? NOMOR_TAB_SIPP[h] : "";
  }

  /**
   * Pintu masuk perkara + tab tujuan: perkara_detil_agama/<enc>/<N>#aleta-tab=<N>.
   * Kueri dibuang - setParams SIPP membaca segmen, bukan kueri. Tanpa tab,
   * pintu masuknya dipulangkan apa adanya.
   *
   * Pintu umum perkara_detil/<enc> (riwayat konten.js menyusunnya begitu)
   * membuka views/perkara/detil_perkara.php, yang NOMOR TABNYA LAIN: di sana
   * 24 = Mediasi Di Luar Pengadilan dan 25 = Court Calendar. Karena itu
   * pintu umum diganti pintu agama - <enc>-nya sama (base64 encrypt
   * perkara_id), dan rute sipp-tautan pun memulangkan perkara_detil_agama.
   */
  function alamatDenganTab(detil, tab) {
    if (!tab) return detil;
    try {
      const url = new URL(detil);
      url.pathname = url.pathname.replace(/\/perkara_detil\/([^/]+)\/?$/i, "/perkara_detil_agama/$1");
      url.pathname = `${url.pathname.replace(/\/+$/, "")}/${tab}`;
      url.search = "";
      url.hash = `aleta-tab=${tab}`;
      return url.href;
    } catch {
      return detil;
    }
  }

  // ─── Alamat bersandi dari server ───────────────────────────────────────────

  /**
   * Butir SIPP yang halaman perkaranya belum diketahui peramban ini, dan
   * belum (atau sudah lama tidak) dimintakan ke server.
   */
  function butirPerluTautan(data) {
    const hasil = new Map();
    const kini = Date.now();
    for (const b of data && Array.isArray(data.butir) ? data.butir : []) {
      const k = objek(b && b.kerjakan);
      if (String(k.tujuan || "").toLowerCase() !== "sipp") continue;
      // Menu SIPP: halamannya bukan halaman perkara, alamat bersandi tidak dipakai.
      if (menuSipp(k.halaman)) continue;
      const p = objek(b && b.perkara);
      const nomor = String(p.nomor || "").trim();
      const id = /^\d+$/.test(String(p.id ?? "").trim()) ? String(p.id).trim() : "";
      if (!nomor || !id) continue;
      const kunci = kunciNomor(nomor);
      if (keadaan.petaSipp.has(kunci) || hasil.has(kunci)) continue;
      const lalu = keadaan.tautanServer.get(kunci);
      if (lalu && (lalu.keadaan === "memuat" || kini - Number(lalu.pada || 0) < TAUTAN_GAGAL_ULANG_MS)) continue;
      hasil.set(kunci, { kunci, id, nomor });
    }
    return [...hasil.values()];
  }

  /** Sama dengan syarat panen: hanya selama widget menyala dan terpasang. */
  function bolehMintaTautan() {
    return !!document.body && bolehTampil() && !!akar && akar.isConnected;
  }

  /** Satu alamat dari server: { url } atau { alasan }. Tidak pernah melempar. */
  async function mintaSatuTautan(t) {
    const ambil = typeof alatAmbil === "function" ? alatAmbil : (alamat, opsi) => fetch(alamat, opsi);
    const kueri = new URLSearchParams({ perkaraId: t.id, nomor: t.nomor });
    try {
      const respons = await ambil(
        `${ALAMAT_TAUTAN_SIPP}?${kueri.toString()}`,
        { credentials: "include", cache: "no-store" },
        "Menyusun alamat halaman perkara SIPP"
      );
      if (respons.status === 401) return { alasan: "sesi portal ALETA habis - masuk lagi ke portal." };
      if (respons.status === 403) return { alasan: "akun ALETA ini tidak berwenang membuka Status Perkara." };
      if (respons.status === 404) return { alasan: "portal ALETA di server ini belum punya rute sipp-tautan." };
      if (!respons.ok) {
        const pesan = await pesanDariJawaban(respons);
        return { alasan: `ALETA menjawab ${respons.status}${pesan ? `: ${pesan}` : "."}` };
      }
      const luar = await respons.json();
      const isi = objek(luar && typeof luar === "object" && luar.data && typeof luar.data === "object" ? luar.data : luar);
      const mentah = String(isi.alamat || "").trim();
      if (!mentah) {
        return { alasan: String(isi.alasan || "").trim().slice(0, 300) || "server tidak menyertakan alamatnya." };
      }
      // Dipakai hanya pintu masuk perkara SIPP di asal halaman ini - aturan
      // yang sama dengan tautan hasil panen dan riwayat.
      const url = alamatDetilSipp(mentah);
      return url ? { url } : { alasan: "alamat dari server bukan pintu masuk perkara SIPP di peramban ini." };
    } catch (galat) {
      return { alasan: kalimatPertama(galat && galat.message) || "portal ALETA tidak menjawab." };
    }
  }

  /**
   * Meminta alamat bersandi (perkara_detil_agama/<enc>) untuk tiap butir SIPP
   * yang alamatnya belum diketahui - SEBELUM tombolnya ditekan. Tombolnya
   * harus tetap <a target="_blank"> biasa: tab yang dibuka sesudah menunggu
   * jaringan ditahan pemblokir munculan, dan nomor hanya dapat disalin di
   * dalam tekanan itu sendiri. Selama alamatnya belum tiba, atau bila
   * gagal, tombolnya tetap jalan lama: beranda SIPP + nomor disalin.
   *
   * Yang berhasil disimpan bersama tautan hasil panen (tautanPerkaraSipp),
   * jadi ikut dihapus saat saklarnya dimatikan.
   */
  async function siapkanTautanServer() {
    if (!bolehMintaTautan() || !keadaan.data) return;
    // Lama tidak meminta apa pun yang baru - tampilan yang berlaku dapat
    // datang dari server, jadi ditunggu dulu.
    try {
      if (typeof alatUjiSiap === "function") await alatUjiSiap();
    } catch {
      /* tanpa tampilan server: yang lokal yang berlaku */
    }
    if (modeUji() === "lama" || !bolehMintaTautan()) return;
    const antre = butirPerluTautan(keadaan.data);
    if (antre.length === 0) return;
    const mulaiPada = Date.now();
    for (const t of antre) keadaan.tautanServer.set(t.kunci, { keadaan: "memuat", alasan: "", pada: mulaiPada });

    const baru = [];
    let i = 0;
    const pekerja = async () => {
      while (i < antre.length) {
        const t = antre[i++];
        // Saklar dimatikan di tengah jalan: sisanya tidak diminta.
        if (!bolehMintaTautan()) return;
        const h = await mintaSatuTautan(t);
        if (h.url) {
          keadaan.tautanServer.delete(t.kunci);
          baru.push([t.kunci, h.url]);
        } else {
          keadaan.tautanServer.set(t.kunci, { keadaan: "gagal", alasan: h.alasan, pada: Date.now() });
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(TAUTAN_SERVER_PARALEL, antre.length) }, pekerja));
    // Yang tidak sempat diminta dilepas - diminta lagi pada penyegaran berikutnya.
    for (const t of antre) {
      const s = keadaan.tautanServer.get(t.kunci);
      if (s && s.keadaan === "memuat") keadaan.tautanServer.delete(t.kunci);
    }

    if (baru.length > 0 && bolehMintaTautan()) {
      const simpan = await baca([KUNCI_TAUTAN_SIPP]);
      // Sama dengan panen: yang tiba sesudah saklar dimatikan tidak ditulis.
      if (bolehMintaTautan()) {
        const peta = { ...objek(simpan[KUNCI_TAUTAN_SIPP]) };
        const kini = Date.now();
        for (const [kunci, url] of baru) peta[kunci] = { url, pada: kini };
        const urut = Object.entries(peta)
          .sort((x, y) => Number(objek(y[1]).pada || 0) - Number(objek(x[1]).pada || 0))
          .slice(0, TAUTAN_MAKS);
        keadaan.tautanSipp = Object.fromEntries(urut);
        susunPetaSipp();
        tulis({ [KUNCI_TAUTAN_SIPP]: keadaan.tautanSipp });
      }
    }
    if (akar && akar.isConnected) gambar();
  }

  // ─── Tab tujuan di halaman perkara SIPP ────────────────────────────────────

  /**
   * Halaman detail perkara yang dibuka tombol Kerjakan membawa
   * #aleta-tab=<N>. Tab bernomor yang punya kelas tabs<N> sudah ditekan SIPP
   * sendiri (lewat segmen ketiga alamatnya); yang tidak - Ikrar Talak, Akta
   * Cerai, Biaya Perkara - ditekan di sini, persis seperti petugas menekannya:
   * pemuat AJAX tab itu milik halaman SIPP sendiri. Tidak ada yang ditulis.
   * Tab yang memang belum ada pada perkara itu DISEBUT, bukan didiamkan.
   */
  async function bukaTabTujuanSipp() {
    if (JENIS !== "sipp") return;
    if (!POLA_TAB_TUJUAN.test(String(location.hash || ""))) return;
    if (!/detil[_-]?perkara/i.test(String(location.pathname || ""))) return;
    try {
      if (typeof alatUjiSiap === "function") await alatUjiSiap();
    } catch {
      /* tanpa tampilan server: yang lokal yang berlaku */
    }
    const cocok = POLA_TAB_TUJUAN.exec(String(location.hash || ""));
    if (!cocok || !keadaan.induk || !keadaan.nyala || modeUji() === "lama") return;
    const no = cocok[1];
    // Penanda dibuang: dimuat ulang atau disalin, alamatnya tidak menekan apa pun lagi.
    try {
      history.replaceState(history.state, "", `${location.pathname}${location.search}`);
    } catch {
      /* dibiarkan - penandanya tidak berbahaya */
    }
    const tab = document.querySelector(`a[href="#tabs${no}"]`);
    if (!tab) {
      const halaman = Object.keys(NOMOR_TAB_SIPP).find((h) => NOMOR_TAB_SIPP[h] === no);
      const nama = halaman ? namaTabSipp(halaman) : `nomor ${no}`;
      kabarSingkat(
        `Tab ${nama} belum ada pada perkara ini, jadi SIPP menampilkan Data Umum. Tombol tambahnya ada di baris tombol atas.`
      );
      return;
    }
    if (tab.classList.contains("loaded") || tab.classList.contains("selected")) return;
    tab.click();
  }

  /**
   * Menyalin ke papan klip. navigator.clipboard hanya ada di konteks aman,
   * dan SIPP peladen berjalan di http biasa - di sana execCommand satu-
   * satunya jalan, dan ia hanya bekerja di dalam tekanan tombol.
   */
  function salinTeks(teks) {
    try {
      if (window.isSecureContext && navigator.clipboard && navigator.clipboard.writeText) {
        void navigator.clipboard.writeText(teks).catch(() => {});
        return true;
      }
    } catch {
      /* lanjut ke jalan lama */
    }
    if (typeof document.execCommand !== "function") return false;
    const kotak = el("textarea");
    kotak.value = teks;
    kotak.setAttribute("readonly", "");
    kotak.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0;";
    (bayang || document.documentElement).appendChild(kotak);
    try {
      kotak.focus({ preventScroll: true });
      kotak.select();
      return Boolean(document.execCommand("copy"));
    } catch {
      return false;
    } finally {
      kotak.remove();
    }
  }

  function kabarSingkat(teks) {
    keadaan.kabar = teks;
    if (jamKabarSingkat) clearTimeout(jamKabarSingkat);
    jamKabarSingkat = setTimeout(() => {
      jamKabarSingkat = null;
      keadaan.kabar = "";
      gambar();
    }, KABAR_SINGKAT_MS);
    gambar();
  }

  /**
   * Butir pengingat yang hanya dibaca (pengingat kasir bagi panitera, 12 Okt):
   * portal menandainya hanyaBaca - tanpa Kerjakan, Selesai, Tunda; yang ada
   * hanya keterangan bahwa tugas itu dikerjakan petugas lain.
   */
  function hanyaBaca(butir) {
    return Boolean(butir && butir.hanyaBaca === true);
  }

  function susunKeteranganHanyaBaca() {
    const k = el("span", "aleta-cm-hanya-baca", "Hanya pengingat");
    k.title = "Tugas ini dikerjakan kasir atau petugas keuangan - Anda hanya melihat pengingatnya.";
    return k;
  }

  function susunKerjakan(butir) {
    if (hanyaBaca(butir)) return susunKeteranganHanyaBaca();
    const t = tautanKerjakan(butir);
    if (!t.href) {
      const mati = el("span", "aleta-cm-kerjakan aleta-cm-kerjakan-mati", t.label);
      mati.title = t.judul;
      mati.setAttribute("aria-disabled", "true");
      mati.setAttribute("data-tujuan", t.tujuan);
      return mati;
    }
    const a = el("a", "aleta-cm-kerjakan", t.label);
    a.href = t.href;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.title = t.judul;
    a.setAttribute("data-tujuan", t.tujuan);
    if (t.salin) {
      const nomor = t.salin;
      const tempat = t.tempat || "SIPP";
      // Menu SIPP: alamatnya memang menu itu - yang dicari di sana nomornya.
      const menu = t.menu === true;
      a.addEventListener("click", () => {
        // Disalin DI DALAM tekanan - execCommand menolak di luar itu.
        const tersalin = salinTeks(nomor);
        // Digambar sesudahnya: mengganti isi widget di tengah tekanan tidak
        // boleh bersaing dengan tab baru yang sedang dibuka.
        setTimeout(() => {
          kabarSingkat(
            tersalin
              ? `Nomor ${nomor} disalin - tempel di kotak cari ${tempat}.`
              : menu
                ? `Cari nomor ${nomor} di ${tempat}.`
                : `Alamat perkara ${nomor} belum diketahui - cari nomornya di ${tempat}.`
          );
        }, 0);
      });
    }
    return a;
  }

  // ─── Tampilan ──────────────────────────────────────────────────────────────

  function hitungan(data) {
    const tampil = { lewat: 0, "hari-ini": 0, "minggu-ini": 0 };
    for (const b of data.butir) if (punya(tampil, b.kelompok)) tampil[b.kelompok] += 1;
    const r = objek(data.ringkas);
    const lewat = angka(r.lewat, tampil.lewat);
    const hariIni = angka(r.hariIni, tampil["hari-ini"]);
    const mingguIni = angka(r.mingguIni, tampil["minggu-ini"]);
    const selesaiHariIni = angka(r.selesaiHariIni, 0);
    const totalHariIni = angka(r.totalHariIni, hariIni + selesaiHariIni);
    return { lewat, hariIni, mingguIni, selesaiHariIni, totalHariIni, tampil };
  }

  function awalHari(t) {
    return new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime();
  }

  // ─── Tahap 3: tanda Selesai / Tunda (popup-7) ──────────────────────────────

  /**
   * Tanda yang sedang BERLAKU untuk butir ini, atau null. Saklar popup-7 yang
   * mati (dan tampilan Lama) berarti tidak ada tanda sama sekali - tandanya
   * tidak dihapus, hanya tidak dipakai, sehingga menyalakannya lagi
   * memulihkan daftar yang sama.
   */
  function tandaBerlaku(b) {
    if (!fitur("popup-7")) return null;
    const id = String((b && b.id) ?? "");
    if (!id || !punya(keadaan.tanda, id)) return null;
    const t = keadaan.tanda[id];
    // Tunda yang sudah habis: butirnya kembali, walau tandanya belum dibersihkan.
    if (t.tanda === "tunda" && !(t.sampai > Date.now())) return null;
    return t;
  }

  /**
   * Butir ringkasan portal ("<jenis>:lainnya" - "... dan 7 perkara lain")
   * mewakili banyak perkara sekaligus; menandainya selesai menyembunyikan
   * pekerjaan yang tidak pernah dilihat orangnya.
   */
  function bolehDitandai(b) {
    if (hanyaBaca(b)) return false;
    const id = String((b && b.id) ?? "");
    return Boolean(id) && !/:lainnya$/.test(id);
  }

  function butirTampil(data) {
    return data.butir.filter((b) => !tandaBerlaku(b));
  }

  function butirTersembunyi(data) {
    return data.butir.filter((b) => tandaBerlaku(b));
  }

  /**
   * hitungan() dikurangi butir yang disembunyikan di peramban ini. Hitungan
   * portal tetap hitungan penuh (portal boleh memangkas daftarnya), jadi yang
   * dikurangkan hanya yang sungguh tersembunyi - bukan diganti hitungan daftar.
   */
  function hitunganTampil(data) {
    const h = hitungan(data);
    if (!fitur("popup-7")) return h;
    const kurang = { lewat: 0, "hari-ini": 0, "minggu-ini": 0 };
    for (const b of butirTersembunyi(data)) if (punya(kurang, b.kelompok)) kurang[b.kelompok] += 1;
    return {
      ...h,
      lewat: Math.max(0, h.lewat - kurang.lewat),
      hariIni: Math.max(0, h.hariIni - kurang["hari-ini"]),
      mingguIni: Math.max(0, h.mingguIni - kurang["minggu-ini"]),
    };
  }

  /** Jumlah yang belum selesai - angka di lencana dan di ikon ekstensi (popup-6). */
  function angkaBelum() {
    const data = keadaan.data;
    if (!data) return { belum: 0, lewat: 0, hariIni: 0 };
    const h = hitunganTampil(data);
    const lain = butirTampil(data).filter((b) => !KELOMPOK.some((k) => k.kunci === b.kelompok)).length;
    return { belum: h.lewat + h.hariIni + h.mingguIni + lain, lewat: h.lewat, hariIni: h.hariIni };
  }

  function awalBesok() {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), t.getDate() + 1).getTime();
  }

  function tandai(b, tanda) {
    if (!fitur("popup-7") || !bolehDitandai(b)) return;
    const id = String(b.id);
    const judul = String(b.judul || b.jenis || "Butir").slice(0, 120);
    const isi = {
      tanda,
      pada: Date.now(),
      peran: peranBersih((keadaan.data && keadaan.data.peranAktif) || keadaan.peran),
      jenis: String(b.jenis || "").slice(0, 80),
      nomor: String(objek(b.perkara).nomor || "").slice(0, 60),
      judul,
    };
    // "Tunda 1 hari" = sampai besok: butirnya kembali di awal hari kerja
    // berikutnya, bukan di tengah hari esok pada jam yang sama.
    if (tanda === "tunda") isi.sampai = awalBesok();
    keadaan.tanda = pangkasTanda({ ...keadaan.tanda, [id]: isi });
    tulis({ [KUNCI_TANDA]: keadaan.tanda });
    catat(`tanda ${tanda}`, id);
    aturJamTunda();
    tulisAngka();
    kabarSingkat(
      tanda === "selesai"
        ? `"${judul}" ditandai selesai di peramban ini. Data SIPP tidak diubah; butirnya dapat dikembalikan dari kaki.`
        : `"${judul}" ditunda sampai besok. Butirnya kembali sendiri.`
    );
  }

  function lepasTanda(id) {
    if (!punya(keadaan.tanda, id)) return;
    const sisa = { ...keadaan.tanda };
    delete sisa[id];
    keadaan.tanda = sisa;
    tulis({ [KUNCI_TANDA]: sisa });
    aturJamTunda();
    tulisAngka();
    gambar();
  }

  /**
   * Tanda yang tidak lagi berguna dibersihkan sesudah jawaban portal yang
   * BERHASIL: tunda yang habis, selesai yang terlalu tua, dan tanda yatim -
   * butirnya hilang sendiri dari portal (pekerjaannya memang selesai).
   *
   * Yatim hanya diputuskan bila tidak ada ruang ragu: jawaban tanpa bacaan
   * yang gagal, peran yang sama dengan saat ditandai, jenisnya tidak sedang
   * "belum dapat dihitung", dan tidak diwakili butir ringkasan
   * ("<jenis>:lainnya" - perkaranya mungkin hanya terpangkas dari daftar).
   */
  function bersihkanTanda(data) {
    if (!fitur("popup-7")) return;
    const kini = Date.now();
    const ada = new Set(data.butir.map((b) => String(b.id ?? "")));
    const diringkas = new Set(
      data.butir.filter((b) => /:lainnya$/.test(String(b.id ?? ""))).map((b) => String(b.jenis || ""))
    );
    const tidakTerbaca = new Set(data.jenisTidakTersedia.map((j) => String(j.jenis || "")));
    const lengkap = data.galat.length === 0;
    const peran = data.peranAktif;
    const sisa = {};
    let berubah = false;
    for (const [id, t] of Object.entries(keadaan.tanda)) {
      const habis = t.tanda === "tunda" ? !(t.sampai > kini) : kini - t.pada > SELESAI_UMUR_MAKS_MS;
      const yatim =
        lengkap && Boolean(peran) && t.peran === peran && !ada.has(id) && !diringkas.has(t.jenis) && !tidakTerbaca.has(t.jenis);
      if (habis || yatim) berubah = true;
      else sisa[id] = t;
    }
    if (!berubah) return;
    keadaan.tanda = sisa;
    tulis({ [KUNCI_TANDA]: sisa });
  }

  /** Dibangunkan tepat saat tunda terdekat habis - butirnya muncul lagi tanpa muat ulang. */
  function aturJamTunda() {
    if (jamTunda) clearTimeout(jamTunda);
    jamTunda = null;
    if (!fitur("popup-7") || !akar || !akar.isConnected) return;
    const kini = Date.now();
    let paling = Infinity;
    for (const t of Object.values(keadaan.tanda)) if (t.tanda === "tunda" && t.sampai > kini) paling = Math.min(paling, t.sampai);
    if (!Number.isFinite(paling)) return;
    jamTunda = setTimeout(() => {
      jamTunda = null;
      gambar();
      tulisAngka();
      aturJamTunda();
    }, Math.min(paling - kini + 50, 2147483000));
  }

  /**
   * angkaChecklist (popup-6) - ringkasan untuk angka di ikon ekstensi:
   *   { belum, lewat, hariIni, sambungan, pada }
   * Dibaca latar.js, yang juga memeriksa sendiri tampilan dan saklarnya.
   * Ditulis hanya bila berubah, atau sudah lama - lima tab tidak menulis
   * angka yang sama lima kali tiap penyegaran.
   */
  function tulisAngka() {
    if (!fitur("popup-6")) {
      angkaTertulis = "";
      return;
    }
    // Belum ada jawaban sama sekali (masih memuat): angka lama di ikon lebih
    // benar daripada nol sesaat. Sesi habis (401/403) memang menulis nol.
    if (!keadaan.data && !keadaan.galat) return;
    const a = angkaBelum();
    const sambungan = keadaan.sambungan.keadaan || "";
    const jejak = `${a.belum}/${a.lewat}/${a.hariIni}/${sambungan}`;
    const kini = Date.now();
    if (jejak === angkaTertulis && kini - angkaTertulisPada < ANGKA_SEGAR_MS) return;
    angkaTertulis = jejak;
    angkaTertulisPada = kini;
    tulis({ [KUNCI_ANGKA]: { belum: a.belum, lewat: a.lewat, hariIni: a.hariIni, sambungan, pada: kini } });
  }

  // ─── Tahap 3: keadaan sambungan (cincin lencana, D10 / popup-8) ────────────

  /**
   * Diukur dari permintaan checklist SENDIRI, bukan ditebak:
   *   baik         2xx dalam AMBANG_LAMBAT_MS
   *   lambat       2xx, tetapi lebih lama
   *   belum-masuk  401/403 - portal menjawab, tetapi tidak memberi data
   *   putus        tidak terjangkau, 404, 5xx, atau jawaban lain
   */
  function catatSambungan(status, lamaMs) {
    let k = "putus";
    if (status >= 200 && status < 300) k = lamaMs > AMBANG_LAMBAT_MS ? "lambat" : "baik";
    else if (status === 401 || status === 403) k = "belum-masuk";
    keadaan.sambungan = { keadaan: k, lamaMs };
  }

  /* === CHECKLIST-POSISI 12 Okt === */
  /**
   * Keterangan teknis di pita widget (jumlah tugas + arti cincin, sudut yang
   * diingat, "butir hilang sendiri...") hanya untuk Super Admin - petugas
   * lain cukup dengan angka di lencana dan daftarnya. Penandanya datang dari
   * portal (pengguna.superAdmin); portal lama tidak mengirimnya = disembunyikan.
   * Galat dan peringatan (susunKabar) tetap tampil untuk semua.
   */
  function bolehKeteranganTeknis() {
    // Lama: persis sebelumnya - tidak ada pita, dan kakinya tidak berubah.
    if (modeUji() === "lama") return true;
    const d = keadaan.data;
    return Boolean(d && d.pengguna && d.pengguna.superAdmin === true);
  }
  /* === AKHIR CHECKLIST-POSISI === */

  function teksSambungan() {
    const s = keadaan.sambungan;
    if (s.keadaan === "baik") return "cincin hijau: portal tersambung";
    if (s.keadaan === "lambat") return `cincin oranye: portal lambat (${(s.lamaMs / 1000).toFixed(1).replace(".", ",")} dtk)`;
    if (s.keadaan === "belum-masuk") return "cincin oranye: portal menjawab, tetapi belum masuk";
    if (s.keadaan === "putus") return "cincin merah: portal terputus";
    return "memeriksa sambungan…";
  }

  function teksTenggat(iso) {
    if (!iso) return "";
    const t = new Date(String(iso));
    if (Number.isNaN(t.getTime())) return "";
    const selisih = Math.round((awalHari(t) - awalHari(new Date())) / 86400000);
    if (selisih < 0) return `lewat ${-selisih} hari`;
    if (selisih === 0) return "tenggat hari ini";
    if (selisih === 1) return "tenggat besok";
    return `tenggat ${NAMA_HARI[t.getDay()]} ${t.getDate()} ${NAMA_BULAN[t.getMonth()]}`;
  }

  function waktuData() {
    const dibuat = keadaan.data ? new Date(String(keadaan.data.dibuat || "")) : null;
    if (dibuat && !Number.isNaN(dibuat.getTime())) return jamMenit(dibuat);
    return keadaan.diterima ? jamMenit(new Date(keadaan.diterima)) : "";
  }

  function labelPeran(data) {
    const aktif = data.peranAktif || keadaan.peran;
    const p = data.peranTersedia.find((x) => x.kunci === aktif);
    return p ? p.label : "";
  }

  function teksPil() {
    if (keadaan.data) {
      const h = hitunganTampil(keadaan.data);
      return `Checklist · ${h.lewat} lewat · ${h.hariIni} hari ini`;
    }
    const g = keadaan.galat;
    if (g && g.jenis === "masuk") return "Checklist · belum masuk ALETA";
    if (g && g.jenis === "jaringan") return "Checklist · portal tidak menjawab";
    if (g) return "Checklist · tidak terbaca";
    return "Checklist · memuat…";
  }

  function susunIkon() {
    try {
      const img = el("img", "aleta-cm-ikon");
      img.src = chrome.runtime.getURL("ikon/aleta-32.png");
      img.alt = "";
      return img;
    } catch {
      return el("span", "aleta-cm-ikon", "✓");
    }
  }

  function susunChipPeran() {
    const data = keadaan.data;
    if (!data || data.peranTersedia.length === 0) return null;
    // Pilihan petugas lebih dulu: selama jawaban peran barunya masih di
    // jalan, chip tidak boleh melompat kembali ke peran lama.
    const aktif = keadaan.peran || data.peranAktif;
    if (data.peranTersedia.length === 1) {
      const chip = el("span", "aleta-cm-peran", data.peranTersedia[0].label);
      chip.title = "Peran yang dihitung checklist ini";
      return chip;
    }
    const pilih = el("select", "aleta-cm-peran");
    pilih.title = "Ganti peran - checklist dihitung ulang untuk peran itu";
    pilih.setAttribute("aria-label", "Peran checklist");
    pilih.setAttribute("data-fokus", "peran");
    for (const p of data.peranTersedia) {
      const o = el("option", "", p.label);
      o.value = p.kunci;
      if (p.kunci === aktif) o.selected = true;
      pilih.appendChild(o);
    }
    pilih.addEventListener("change", () => gantiPeran(pilih.value));
    return pilih;
  }

  function susunKepala() {
    const kepala = el("header", "aleta-cm-kepala");
    kepala.setAttribute("data-geser", "1");
    const nama = keadaan.data && keadaan.data.pengguna ? String(keadaan.data.pengguna.nama || "") : "";
    kepala.title = nama ? `Checklist milestone - ${nama}. Geser dari sini.` : "Checklist milestone. Geser dari sini.";
    kepala.appendChild(susunIkon());
    kepala.appendChild(el("span", "aleta-cm-judul", "Checklist milestone"));
    const chip = susunChipPeran();
    if (chip) kepala.appendChild(chip);

    const alat = el("span", "aleta-cm-alat");
    // Butir 13 (2 Okt): pengaturan SEMUA bagian widget langsung dari kepala
    // checklist - "Atur widget" lengkap tetap di kaki dok.
    if (modern()) {
      const bagian = tombol(
        "aleta-cm-bagian-tombol",
        "☰",
        keadaan.bagianTerbuka ? "Tutup pengaturan bagian widget" : "Bagian widget: pilih yang tampil (Catatan cepat, Lama sidang, Kalender tenggat, ...)",
        () => {
          keadaan.bagianTerbuka = !keadaan.bagianTerbuka;
          gambar();
          fokuskan("bagian-tombol");
        },
        "bagian-tombol"
      );
      bagian.setAttribute("aria-expanded", keadaan.bagianTerbuka ? "true" : "false");
      bagian.setAttribute("aria-haspopup", "true");
      alat.appendChild(bagian);
    }
    const segar = tombol("aleta-cm-segar", "", "Segarkan sekarang", () => void segarkan(), "segar");
    segar.appendChild(el("span", keadaan.memuat ? "aleta-cm-berputar" : "", "⟳"));
    alat.appendChild(segar);
    alat.appendChild(
      tombol(
        "aleta-cm-kecilkan",
        "–",
        lencanaDipakai() ? "Ciutkan menjadi lencana" : "Kecilkan menjadi pil",
        () => setelKecil(true),
        "kecilkan"
      )
    );
    alat.appendChild(
      tombol(
        "aleta-cm-tutup",
        "×",
        "Tutup - mematikan saklar Checklist milestone. Nyalakan lagi dari popup ikon ALETA.",
        tutup,
        "tutup"
      )
    );
    kepala.appendChild(alat);
    return kepala;
  }

  function susunKabar() {
    const g = keadaan.galat;
    if (!g && !keadaan.kabar) return null;
    const kotak = el("div", g ? "aleta-cm-kabar aleta-cm-kabar-galat" : "aleta-cm-kabar");
    // "status", bukan "alert": widget digambar ulang tiap penyegaran, dan
    // alert yang lahir ulang tiap lima menit dibacakan pembaca layar lagi dan
    // lagi selama portal masih diam.
    kotak.setAttribute("role", "status");
    if (!g) {
      kotak.textContent = keadaan.kabar;
      return kotak;
    }
    kotak.setAttribute("data-galat", g.jenis);
    const tambah = (teks) => kotak.appendChild(document.createTextNode(teks));
    if (g.jenis === "masuk") {
      kotak.appendChild(el("strong", "", "Masuk ke portal ALETA dulu."));
      tambah(" Checklist dibaca dengan sesi portal di peramban ini. ");
      const a = el("a", "", "Buka portal ALETA");
      a.href = `${location.origin}/aleta`;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      kotak.appendChild(a);
      tambah(" - sesudah masuk, tekan ⟳.");
      return kotak;
    }
    const judul = {
      akses: "Akun ALETA ini tidak diberi checklist.",
      jaringan: "Portal ALETA tidak menjawab.",
      "tidak-ada": "Portal ALETA belum mengenal checklist milestone.",
      jawaban: "Portal ALETA menolak permintaan.",
    }[g.jenis];
    kotak.appendChild(el("strong", "", judul || "Checklist tidak terbaca."));
    if (g.pesan) tambah(` ${g.pesan}`);
    if (g.jenis === "tidak-ada") tambah(" Portal perlu diperbarui ke versi yang membawa rute checklist.");
    if (keadaan.data) tambah(` Butir di bawah dari pukul ${waktuData()} - belum diperbarui.`);
    return kotak;
  }

  function susunKemajuan() {
    const h = hitungan(keadaan.data);
    const kotak = el("div", "aleta-cm-kemajuan");
    const teks =
      h.totalHariIni > 0 ? `Hari ini ${h.selesaiHariIni} dari ${h.totalHariIni} selesai` : "Tidak ada tenggat hari ini";
    kotak.appendChild(el("div", "aleta-cm-kemajuan-teks", teks));
    const bilah = el("div", "aleta-cm-bilah");
    bilah.setAttribute("role", "progressbar");
    bilah.setAttribute("aria-label", teks);
    bilah.setAttribute("aria-valuemin", "0");
    bilah.setAttribute("aria-valuemax", String(h.totalHariIni));
    bilah.setAttribute("aria-valuenow", String(Math.min(h.selesaiHariIni, h.totalHariIni)));
    const isi = el("span", "aleta-cm-bilah-isi");
    const persen = h.totalHariIni > 0 ? Math.round((100 * Math.min(h.selesaiHariIni, h.totalHariIni)) / h.totalHariIni) : 0;
    isi.style.width = `${persen}%`;
    bilah.appendChild(isi);
    kotak.appendChild(bilah);
    return kotak;
  }

  function terbuka(kunci, bawaan) {
    return typeof keadaan.lipatan[kunci] === "boolean" ? keadaan.lipatan[kunci] : bawaan;
  }

  function susunButir(b) {
    if (modern()) return susunKartu(b);
    const li = el("li", "aleta-cm-butir");
    li.setAttribute("data-id", String(b.id ?? ""));
    if (b.jenis) li.setAttribute("data-jenis", String(b.jenis));
    const teks = el("div", "aleta-cm-butir-teks");
    teks.appendChild(el("div", "aleta-cm-butir-judul", String(b.judul || b.jenis || "Tanpa judul")));
    const ket = susunKetButir(b);
    if (ket.childNodes.length) teks.appendChild(ket);
    li.appendChild(teks);
    // popup-7 dalam kulit Klasik: Selesai dan Tunda di bawah Kerjakan, supaya
    // judul butir tidak terjepit tiga tombol sebaris di kotak 348 piksel.
    const tanda = susunTombolTanda(b);
    if (tanda) {
      const aksi = el("div", "aleta-cm-butir-aksi");
      aksi.appendChild(susunKerjakan(b));
      aksi.appendChild(tanda);
      li.appendChild(aksi);
    } else {
      li.appendChild(susunKerjakan(b));
    }
    return li;
  }

  function susunKetButir(b) {
    const ket = el("div", "aleta-cm-butir-ket");
    const nomor = String(objek(b.perkara).nomor || "").trim();
    if (nomor) ket.appendChild(el("span", "aleta-cm-nomor", nomor));
    const bagian = [String(b.keterangan || "").trim(), teksTenggat(b.tenggat)].filter(Boolean);
    if (bagian.length) ket.appendChild(document.createTextNode(`${nomor ? " · " : ""}${bagian.join(" · ")}`));
    return ket;
  }

  /** Selesai dan Tunda (popup-7), atau null bila saklarnya mati / butirnya ringkasan. */
  function susunTombolTanda(b) {
    if (!fitur("popup-7") || !bolehDitandai(b)) return null;
    const id = String(b.id);
    const kotak = el("div", "aleta-cm-butir-aksi-kecil");
    const sebab = "Hanya menyembunyikan butir ini di peramban Anda - data SIPP dan portal tidak diubah.";
    kotak.appendChild(
      tombol("aleta-cm-tanda aleta-cm-tanda-selesai", "✓ Selesai", `Tandai selesai. ${sebab}`, () => tandai(b, "selesai"), `selesai-${id}`)
    );
    kotak.appendChild(
      tombol(
        "aleta-cm-tanda aleta-cm-tanda-tunda",
        "◷ Tunda",
        `Tunda sampai besok - butirnya kembali sendiri. ${sebab}`,
        () => tandai(b, "tunda"),
        `tunda-${id}`
      )
    );
    return kotak;
  }

  /** Tenggat pendek untuk pojok kartu: "7 hari lewat", "hari ini", "besok", "Kam 2 Okt". */
  function tenggatRingkas(iso) {
    if (!iso) return "";
    const t = new Date(String(iso));
    if (Number.isNaN(t.getTime())) return "";
    const selisih = Math.round((awalHari(t) - awalHari(new Date())) / 86400000);
    if (selisih < 0) return `${-selisih} hari lewat`;
    if (selisih === 0) return "hari ini";
    if (selisih === 1) return "besok";
    return `${NAMA_HARI[t.getDay()]} ${t.getDate()} ${NAMA_BULAN[t.getMonth()]}`;
  }

  /**
   * D8 (UI Baru): butir menjadi kartu bertenggat - judul dan tenggat berwarna
   * di atas, perkara dan keterangan di tengah, tindakan di bawah. Kelas
   * aleta-cm-butir dan tombol Kerjakan-nya tetap sama: pemilih yang sama
   * menemukan butir yang sama di kedua kulit.
   */
  function susunKartu(b) {
    const li = el("li", "aleta-cm-butir aleta-cm-kartu");
    li.setAttribute("data-id", String(b.id ?? ""));
    if (b.jenis) li.setAttribute("data-jenis", String(b.jenis));
    li.setAttribute("data-nada", b.kelompok === "lewat" ? "lewat" : b.kelompok === "hari-ini" ? "mendesak" : "tenang");
    const atas = el("div", "aleta-cm-kartu-atas");
    atas.appendChild(el("span", "aleta-cm-butir-judul", String(b.judul || b.jenis || "Tanpa judul")));
    const ringkas = tenggatRingkas(b.tenggat);
    if (ringkas) atas.appendChild(el("span", "aleta-cm-kartu-tenggat", ringkas));
    li.appendChild(atas);
    const ket = susunKetButir(b);
    if (ket.childNodes.length) li.appendChild(ket);
    const aksi = el("div", "aleta-cm-kartu-aksi");
    aksi.appendChild(susunKerjakan(b));
    const tanda = susunTombolTanda(b);
    if (tanda) for (const t of Array.from(tanda.childNodes)) aksi.appendChild(t);
    li.appendChild(aksi);
    return li;
  }

  function susunKelompok(kunci, judul, daftar, jumlah, buka) {
    const bagian = el("section", `aleta-cm-kelompok aleta-cm-kelompok-${kunci}`);
    bagian.setAttribute("data-kelompok", kunci);
    const kepala = el("button", "aleta-cm-kelompok-kepala");
    kepala.type = "button";
    kepala.setAttribute("aria-expanded", buka ? "true" : "false");
    kepala.setAttribute("data-fokus", `kelompok-${kunci}`);
    kepala.appendChild(el("span", "aleta-cm-panah", buka ? "▾" : "▸"));
    kepala.appendChild(el("span", "aleta-cm-kelompok-judul", judul));
    kepala.appendChild(el("span", "aleta-cm-hitung", jumlah));
    // Portal boleh memangkas daftarnya; hitungannya tetap hitungan penuh, dan
    // selisihnya disebut - bukan dibiarkan tampak seperti hitungan yang salah.
    if (daftar.length < jumlah) kepala.appendChild(el("span", "aleta-cm-sebagian", `${daftar.length} ditampilkan`));
    kepala.addEventListener("click", () => setelLipatan(kunci, !buka));
    bagian.appendChild(kepala);
    let ul = null;
    if (buka && daftar.length) {
      ul = el("ul", "aleta-cm-daftar");
      for (const b of daftar) ul.appendChild(susunButir(b));
      bagian.appendChild(ul);
    }
    // Perbaikan 1 Okt (UI Baru): kepala berupa lipat seragam (K2), tombol ⧉
    // memisahkan kelompok menjadi jendela melayang, dan pegangan di kakinya
    // mengubah tinggi daftarnya.
    if (modern() && kunci !== "lain") {
      try {
        if (typeof alatJadikanLipat === "function") alatJadikanLipat(bagian);
      } catch {
        /* rupa lama tetap */
      }
      const idBagian = `kel-${kunci}`;
      const alat = el("span", "aleta-cmw-kel-alat");
      alat.appendChild(tombol("aleta-cmw-pisah", "⧉", `Pisahkan ${judul} menjadi jendela melayang sendiri`, () => pisahkan(idBagian), `pisah-${idBagian}`));
      bagian.appendChild(alat);
      if (ul) {
        terapkanTinggi(ul, tinggiBagian(idBagian));
        pasangTarik(bagian, idBagian, ul, judul);
      }
    }
    return bagian;
  }

  function susunIsi() {
    const isi = el("div", "aleta-cm-isi");
    const data = keadaan.data;
    // Tanpa popup-7 (dan dalam Lama) butirTampil = data.butir, utuh.
    const butir = butirTampil(data);
    if (butir.length === 0) {
      const label = labelPeran(data);
      const sembunyi = data.butir.length - butir.length;
      isi.appendChild(
        el(
          "div",
          "aleta-cm-kosong",
          `Tidak ada pekerjaan tertunda${label ? ` untuk ${label}` : ""}.` +
            (sembunyi > 0 ? ` ${sembunyi} butir disembunyikan di peramban ini - lihat kaki.` : "")
        )
      );
      return isi;
    }
    const h = hitunganTampil(data);
    const jumlah = { lewat: h.lewat, "hari-ini": h.hariIni, "minggu-ini": h.mingguIni };
    // UI Baru (butir 7): urutan kelompok milik pengguna; yang disembunyikan
    // atau dipisah ke jendela sendiri tidak digambar di sini.
    const ui = modern();
    for (const k of ui ? urutanKelompok() : KELOMPOK) {
      if (ui && (kelompokMati(k.kunci) || terpisah(`kel-${k.kunci}`))) continue;
      const daftar = butir.filter((b) => b.kelompok === k.kunci);
      if (daftar.length === 0 && jumlah[k.kunci] === 0) continue;
      isi.appendChild(susunKelompok(k.kunci, k.judul, daftar, jumlah[k.kunci], terbuka(k.kunci, k.bawaanTerbuka)));
    }
    if (ui) {
      const lainnya = susunCatatanKelompok(jumlah);
      if (lainnya) isi.appendChild(lainnya);
    }
    // Kelompok yang tidak dikenal versi ekstensi ini tetap ditampilkan -
    // membuangnya berarti pekerjaan yang hilang tanpa jejak.
    const lain = butir.filter((b) => !KELOMPOK.some((k) => k.kunci === b.kelompok));
    if (lain.length) isi.appendChild(susunKelompok("lain", "Lainnya", lain, lain.length, terbuka("lain", true)));
    return isi;
  }

  /**
   * Nama jenis untuk dibaca orang. Portal mengirim kuncinya
   * ("hakim.konsep-putusan"); judulnya dipakai bila ikut dikirim, dan bila
   * tidak, kuncinya dirapikan - awalan peran dibuang, tanda hubung menjadi
   * spasi - supaya kaki tidak berisi kode.
   */
  function namaJenis(j) {
    const judul = String(j.judul || "").trim();
    if (judul) return judul;
    const kunci = String(j.jenis || "").trim();
    if (!kunci) return "?";
    const pendek = kunci.includes(".") ? kunci.slice(kunci.indexOf(".") + 1) : kunci;
    const rapi = pendek.replace(/[-_]+/g, " ").trim();
    return rapi ? rapi.charAt(0).toUpperCase() + rapi.slice(1) : kunci;
  }

  function lipatanKaki(kunci, ringkas, baris) {
    const lipat = el("details", `aleta-cm-${kunci}`);
    if (keadaan.kakiTerbuka[kunci]) lipat.open = true;
    lipat.addEventListener("toggle", () => {
      keadaan.kakiTerbuka[kunci] = lipat.open;
    });
    lipat.appendChild(el("summary", "", ringkas));
    const ul = el("ul", "aleta-cm-kaki-daftar");
    for (const b of baris) ul.appendChild(b);
    lipat.appendChild(ul);
    return lipat;
  }

  function susunKaki() {
    const kaki = el("footer", "aleta-cm-kaki");
    const baris = el("div", "aleta-cm-kaki-baris");
    const waktu = keadaan.data ? waktuData() : "";
    if (waktu) baris.appendChild(el("span", "aleta-cm-waktu", `Diperbarui ${waktu}`));
    if (bolehKeteranganTeknis()) baris.appendChild(teknis(el("span", "aleta-cm-catatan", "butir hilang sendiri saat datanya lengkap")));
    // popup-9 dalam kulit Klasik; di dok UI Baru disebut di samping lencana.
    if (sudutAktif() && !modern() && bolehKeteranganTeknis()) baris.appendChild(teknis(el("span", "aleta-cm-sudut", teksSudut())));
    kaki.appendChild(baris);
    // K5: saklar penjelasan teknis - dalam Baru (kulit Klasik) di kaki
    // checklist; dalam UI Baru di "Atur widget". Lama: tidak ada.
    if (!modern()) {
      const saklar = susunSaklarTeknis();
      if (saklar) kaki.appendChild(saklar);
    }

    const data = keadaan.data;
    if (!data) return kaki;
    // popup-7: yang disembunyikan TETAP terjangkau - disebut, dan satu tekanan
    // mengembalikannya. Tanda yang salah tekan tidak boleh berarti pekerjaan
    // yang hilang dari pandangan sampai portal berubah.
    const tersembunyi = butirTersembunyi(data);
    if (tersembunyi.length) {
      const daftar = tersembunyi.map((b) => {
        const t = tandaBerlaku(b);
        const id = String(b.id);
        const li = el("li");
        li.setAttribute("data-tersembunyi", id);
        li.appendChild(el("strong", "", String(b.judul || b.jenis || "Butir")));
        const nomor = String(objek(b.perkara).nomor || "").trim();
        const keadaanTanda =
          t.tanda === "selesai"
            ? `ditandai selesai ${jamMenit(new Date(t.pada))}`
            : `ditunda sampai ${NAMA_HARI[new Date(t.sampai).getDay()]} ${jamMenit(new Date(t.sampai))}`;
        li.appendChild(document.createTextNode(`${nomor ? ` · ${nomor}` : ""} - ${keadaanTanda}`));
        li.appendChild(
          tombol(
            "aleta-cm-tanda aleta-cm-kembalikan",
            "Kembalikan",
            "Tampilkan lagi butir ini di daftar",
            () => lepasTanda(id),
            `kembalikan-${id}`
          )
        );
        return li;
      });
      kaki.appendChild(
        lipatanKaki("tersembunyi", `${daftar.length} disembunyikan di peramban ini (selesai / tunda)`, daftar)
      );
    }
    // Jenis yang TIDAK dapat dihitung disebut, bukan disembunyikan: checklist
    // yang diam tentang yang tidak ia periksa terbaca sebagai "semua beres".
    if (data.jenisTidakTersedia.length) {
      const daftar = data.jenisTidakTersedia.map((j) => {
        const li = el("li");
        li.setAttribute("data-jenis", String(j.jenis || ""));
        li.appendChild(el("strong", "", namaJenis(j)));
        if (j.sebab) li.appendChild(document.createTextNode(` - ${j.sebab}`));
        return li;
      });
      kaki.appendChild(
        lipatanKaki("tidak-tersedia", `${daftar.length} jenis belum dapat dihitung`, daftar)
      );
    }
    if (data.galat.length) {
      const daftar = data.galat.map((g) => el("li", "", g));
      kaki.appendChild(lipatanKaki("galat-sebagian", `${daftar.length} bacaan gagal di portal`, daftar));
    }
    return kaki;
  }

  function susunPanel() {
    const panel = el("section", "aleta-cm");
    panel.setAttribute("role", "region");
    panel.setAttribute("aria-label", "Checklist milestone");
    panel.setAttribute("aria-busy", keadaan.memuat ? "true" : "false");
    const kepala = susunKepala();
    panel.appendChild(kepala);
    // UI Baru (K2): judul menjadi tombol lipat; isi panel di bawahnya ikut
    // terlipat. Lama dan Baru: susunan lama persis.
    let wadahIsi = panel;
    if (modern() && typeof alatLipat === "function") {
      const judul = kepala.querySelector(":scope > .aleta-cm-judul");
      if (judul) {
        const penanda = document.createComment("judul");
        kepala.insertBefore(penanda, judul);
        const l = alatLipat(judul, { kunci: "widget:checklist" });
        l.kepala.setAttribute("data-fokus", "lipat-checklist");
        l.kepala.title = "Lipat atau bentangkan Checklist milestone";
        kepala.replaceChild(l.kepala, penanda);
        panel.classList.add("aleta-lipatan");
        l.isi.classList.add("aleta-cm-badan");
        l.isi.removeAttribute("role");
        panel.appendChild(l.isi);
        wadahIsi = l.isi;
      }
    }
    // Butir 13: menu bagian dari tombol ☰ di kepala - tepat di bawah kepala,
    // di luar isi yang dapat dilipat (menu tetap terlihat walau terlipat).
    if (modern() && keadaan.bagianTerbuka) panel.insertBefore(susunMenuBagian(), kepala.nextSibling);
    const kabar = susunKabar();
    if (kabar) wadahIsi.appendChild(kabar);
    if (keadaan.data) {
      wadahIsi.appendChild(susunKemajuan());
      wadahIsi.appendChild(susunIsi());
    } else if (!keadaan.galat) {
      wadahIsi.appendChild(el("div", "aleta-cm-memuat", "Memuat checklist…"));
    }
    wadahIsi.appendChild(susunKaki());
    return panel;
  }

  function susunPil() {
    const teks = teksPil();
    const pil = el("button", "aleta-cm-pil", teks);
    pil.type = "button";
    pil.setAttribute("data-geser", "1");
    pil.setAttribute("data-fokus", "pil");
    pil.title = "Bentangkan checklist. Geser untuk memindahkan.";
    pil.setAttribute("aria-label", `${teks}. Bentangkan checklist`);
    const h = keadaan.data ? hitunganTampil(keadaan.data) : null;
    pil.setAttribute("data-nada", h && h.lewat > 0 ? "lewat" : h && h.hariIni > 0 ? "mendesak" : "tenang");
    pil.addEventListener("click", () => {
      // Pil yang baru saja digeser tidak ikut terbentang.
      if (abaikanKlikPil) {
        abaikanKlikPil = false;
        return;
      }
      setelKecil(false);
    });
    return pil;
  }

  // ─── Tahap 3: lencana logo (D10, popup-6, popup-8) ─────────────────────────

  /** Bentuk ciut widget: lencana (UI Baru, atau popup-8) - selain itu pil lama. */
  function lencanaDipakai() {
    return modern() || fitur("popup-8");
  }

  /**
   * Lencana logo: angka yang belum selesai + cincin keadaan sambungan. Sama
   * dengan pil, ia pegangan geser sekaligus tombol - yang baru saja digeser
   * tidak ikut berganti bentuk.
   */
  function susunLencana(kecil) {
    const a = angkaBelum();
    const s = keadaan.sambungan.keadaan || "belum";
    const t = el("button", "aleta-cmw-lencana");
    t.type = "button";
    t.setAttribute("data-geser", "1");
    t.setAttribute("data-fokus", "lencana");
    t.setAttribute("data-sambungan", s);
    const logo = el("span", "aleta-cmw-lencana-logo");
    logo.appendChild(susunIkon());
    t.appendChild(logo);
    if (keadaan.data && a.belum > 0) {
      const n = el("b", "aleta-cmw-lencana-angka", a.belum > 99 ? "99+" : a.belum);
      n.setAttribute("data-nada", a.lewat > 0 ? "lewat" : a.hariIni > 0 ? "mendesak" : "tenang");
      t.appendChild(n);
    }
    const ringkas = keadaan.data ? `${a.belum} tugas belum selesai (${a.lewat} lewat tenggat)` : teksPil();
    const judul = `${ringkas}${bolehKeteranganTeknis() ? ` · ${teksSambungan()}` : ""}. ${kecil ? "Bentangkan widget" : "Ciutkan menjadi lencana"} - geser untuk memindahkan.`;
    t.title = judul;
    t.setAttribute("aria-label", judul);
    t.setAttribute("aria-expanded", kecil ? "false" : "true");
    t.addEventListener("click", () => {
      if (abaikanKlikPil) {
        abaikanKlikPil = false;
        return;
      }
      setelKecil(!kecil);
    });
    return t;
  }

  // ─── Butir 3 (6 Okt 2026): indikator sumber daya server ────────────────────
  //
  // Empat titik berwarna - RAM, CPU, Disk, GPU - di samping lencana dok (UI Baru)
  // atau di atas checklist (Baru, hanya bila saklar portal-7 "Lencana SERVER
  // yang bercerita" menyala). Lama: tidak ada apa pun, tidak ada permintaan.
  //
  //   klik titik     beralih ALETA saja <-> seluruh server; yang tampil
  //                  disebut di chip di depannya (diingat di peramban ini)
  //   "Rincian ›"    membuka Admin > Sumber daya server di tab baru (hanya
  //                  bila portal menyebut pemanggilnya Admin)
  //
  // Diminta tiap 5 detik selama tab terlihat dan widget terpasang; berhenti
  // saat tab disembunyikan. Satu GET, bersinggah 3 detik di portal dan bot.
  // Isi titik diperbarui DI TEMPAT - widget tidak digambar ulang tiap detak.

  const ALAMAT_SUMBER_DAYA = "/aleta/api/aleta-ecourt/sumber-daya";
  const KUNCI_LINGKUP_SD = "lingkupSumberDaya";
  const KODE_SD = "portal-7";
  const DETAK_SD_MS = 5000;
  const BATAS_TUNGGU_SD_MS = 4500;
  const LINGKUP_SD = { aleta: "ALETA", server: "Server" };
  const NAMA_SD = { ram: "RAM", cpu: "CPU", disk: "Disk", gpu: "GPU" };
  /* 12OKT-N: urutan titik di strip - RAM, CPU, Disk, GPU. */
  const URUTAN_SD = ["ram", "cpu", "disk", "gpu"];
  const WARNA_SD = ["hijau", "kuning", "merah", "kelabu"];

  const sd = {
    lingkup: "aleta",
    lingkupTerbaca: false,
    /** Jawaban terakhir yang berhasil: { diukurPada, ringkas, bolehRinci, alamatRinci }. */
    data: null,
    /** "" | "masuk" | "akses" | "jaringan" | "jawaban" */
    galat: "",
    jam: null,
    jalan: false,
    terakhir: 0,
  };

  /** Indikator berlaku di tampilan ini: UI Baru, atau Baru dengan saklar portal-7. Lama tidak pernah. */
  function sdBerlaku() {
    if (modeUji() === "lama") return false;
    // CHECKLIST-POSISI 12 Okt (keputusan pengguna): strip RAM/CPU/Disk/GPU HANYA Super Admin,
    // Admin pun tidak. Selama jawaban checklist belum tiba, tidak berlaku (dan tidak meminta).
    if (!(keadaan.data && keadaan.data.pengguna && keadaan.data.pengguna.superAdmin === true)) return false;
    return modern() || fitur(KODE_SD);
  }

  function lingkupSdBersih(x) {
    return x === "server" ? "server" : "aleta";
  }

  /** 12OKT-N: beban rata-rata {m1,m5,m15}; bentuk lain = null. */
  function sdBeban(b) {
    const o = objek(b);
    const [m1, m5, m15] = [o.m1, o.m5, o.m15].map((v) => (v === null || v === undefined || v === "" ? NaN : Number(v)));
    return Number.isFinite(m1) && Number.isFinite(m5) && Number.isFinite(m15) ? { m1, m5, m15 } : null;
  }

  /** Jawaban portal -> bentuk yang dipercaya titik. null bila bentuknya tidak dikenal. */
  function sdBersihkan(isi) {
    const x = objek(isi);
    const r = objek(x.ringkas);
    if (!punya(r, "aleta") || !punya(r, "server")) return null;
    const keping = (k) => {
      const o = objek(k);
      const p = o.persen === null || o.persen === undefined || o.persen === "" ? null : Number(o.persen);
      return {
        persen: Number.isFinite(p) ? p : null,
        warna: WARNA_SD.includes(o.warna) ? o.warna : "kelabu",
        ada: o.ada !== false,
        keterangan: String(o.keterangan || ""),
        partisi: o.partisi ? String(o.partisi) : "",
        sebagian: o.sebagian === true,
        /* 12OKT-N: CPU (agen J) - inti dan beban hanya untuk tooltip. */
        inti: Number.isFinite(Number(o.inti)) && o.inti !== null && o.inti !== "" ? Number(o.inti) : null,
        intiTerpakai: Number.isFinite(Number(o.intiTerpakai)) && o.intiTerpakai !== null && o.intiTerpakai !== "" ? Number(o.intiTerpakai) : null,
        beban: sdBeban(o.beban),
      };
    };
    // CPU: portal/bot lama tanpa ruas cpu = keping kosong (persen null, kelabu) - "tidak terbaca", bukan 0%.
    const lingkup = (l) => ({ ram: keping(objek(l).ram), cpu: keping(objek(l).cpu), disk: keping(objek(l).disk), gpu: keping(objek(l).gpu) });
    return {
      diukurPada: String(x.diukurPada || ""),
      ringkas: { aleta: lingkup(r.aleta), server: lingkup(r.server) },
      bolehRinci: x.bolehRinci === true,
      alamatRinci: String(x.alamatRinci || "/admin/sumber-daya"),
    };
  }

  function sdTeksPersen(k) {
    if (!k || k.persen === null) return "–";
    return `${Math.round(k.persen)}%`;
  }

  function sdJudulTitik(jenis, k) {
    const siapa = sd.lingkup === "server" ? "seluruh server" : "ALETA";
    if (!k) {
      const sebab =
        sd.galat === "masuk" ? "belum masuk portal ALETA" : sd.galat === "jaringan" ? "portal tidak menjawab" : sd.galat ? "tidak terbaca" : "memuat";
      return `${NAMA_SD[jenis]} ${siapa}: ${sebab}. Klik untuk beralih ALETA / seluruh server.`;
    }
    let isi;
    if (jenis === "gpu" && !k.ada) isi = k.keterangan || "tidak ada GPU";
    else if (jenis === "cpu" && k.persen === null) isi = "tidak terbaca";
    else isi = `${k.persen === null ? "tidak terukur" : `${String(k.persen).replace(".", ",")}%`}`;
    if (jenis === "cpu" && k.persen !== null) {
      const f = (n) => String(Math.round(n * 100) / 100).replace(".", ",");
      if (k.intiTerpakai !== null && k.inti !== null) isi += ` (${f(k.intiTerpakai)} dari ${f(k.inti)} inti)`;
      if (k.beban) isi += `, beban rata-rata ${f(k.beban.m1)} / ${f(k.beban.m5)} / ${f(k.beban.m15)}`;
      if (k.sebagian) isi += " - sebagian: tidak semua aplikasi terukur";
    }
    if (jenis === "disk" && k.partisi) isi += ` (partisi ${k.partisi})`;
    if (jenis === "disk" && k.sebagian) isi += " - sebagian: citra Docker belum terukur";
    return `${NAMA_SD[jenis]} ${siapa}: ${isi}. Klik untuk beralih ke ${sd.lingkup === "server" ? "ALETA saja" : "seluruh server"}.`;
  }

  /** Strip indikator. `kecil` = dok ciut (tanpa tautan Rincian). */
  function susunIndikatorSd(kecil) {
    const strip = el("div", "aleta-cmw-sd");
    strip.setAttribute("data-sd-lingkup", sd.lingkup);
    if (kecil) strip.setAttribute("data-sd-kecil", "ya");
    strip.setAttribute("role", "group");
    strip.setAttribute("aria-label", `Sumber daya ${sd.lingkup === "server" ? "seluruh server" : "ALETA"}`);
    const ganti = () => gantiLingkupSd();
    const chip = tombol(
      "aleta-cmw-sd-lingkup",
      LINGKUP_SD[sd.lingkup],
      `Yang tampil: ${sd.lingkup === "server" ? "seluruh server" : "ALETA saja"}. Klik untuk beralih.`,
      ganti,
      "sd-lingkup"
    );
    chip.setAttribute("aria-pressed", sd.lingkup === "server" ? "true" : "false");
    strip.appendChild(chip);
    const r = sd.data ? sd.data.ringkas[sd.lingkup] : null;
    for (const jenis of URUTAN_SD) {
      const k = r ? r[jenis] : null;
      const t = tombol("aleta-cmw-sd-titik", "", sdJudulTitik(jenis, k), ganti, `sd-${jenis}`);
      t.setAttribute("data-sd", jenis);
      // CPU yang tidak terbaca selalu kelabu dengan "–" (bukan 0%), apa pun warna kirimannya.
      t.setAttribute("data-warna", k && !(jenis === "cpu" && k.persen === null) ? k.warna : "kelabu");
      t.setAttribute("aria-label", sdJudulTitik(jenis, k));
      t.appendChild(el("span", "aleta-cmw-sd-bulat"));
      t.appendChild(el("span", "aleta-cmw-sd-nama", NAMA_SD[jenis]));
      t.appendChild(el("b", "aleta-cmw-sd-nilai", jenis === "gpu" && k && !k.ada ? "–" : sdTeksPersen(k)));
      strip.appendChild(t);
    }
    if (!kecil && sd.data && sd.data.bolehRinci) {
      const href = alamatPortal(sd.data.alamatRinci);
      if (href) {
        const a = el("a", "aleta-cmw-sd-rinci", "Rincian ›");
        a.href = href;
        a.target = "_blank";
        a.rel = "noopener";
        a.title = "Buka Admin > Sumber daya server: pemakaian tiap aplikasi, ALETA dipisah dari aplikasi lain";
        a.setAttribute("data-fokus", "sd-rinci");
        strip.appendChild(a);
      }
    }
    return strip;
  }

  /** Mengganti isi strip yang sudah tergambar tanpa menggambar ulang widget. */
  function perbaruiIndikatorSd() {
    if (!bayang) return;
    const fokus = kunciFokus();
    for (const lama of Array.from(bayang.querySelectorAll(".aleta-cmw-sd"))) {
      lama.replaceWith(susunIndikatorSd(lama.getAttribute("data-sd-kecil") === "ya"));
    }
    if (fokus && fokus.startsWith("sd-")) fokuskan(fokus);
  }

  function gantiLingkupSd() {
    sd.lingkup = sd.lingkup === "server" ? "aleta" : "server";
    tulis({ [KUNCI_LINGKUP_SD]: sd.lingkup });
    perbaruiIndikatorSd();
  }

  async function mintaSumberDaya() {
    if (sd.jalan) return;
    sd.jalan = true;
    sd.terakhir = Date.now();
    const pengendali = typeof AbortController === "function" ? new AbortController() : null;
    const tunda = pengendali ? setTimeout(() => pengendali.abort(), BATAS_TUNGGU_SD_MS) : null;
    try {
      const r = await fetch(ALAMAT_SUMBER_DAYA, {
        credentials: "include",
        cache: "no-store",
        ...(pengendali ? { signal: pengendali.signal } : {}),
      });
      // 403 = tanpa kewenangan panel: tidak ada yang perlu ditanyakan lagi di halaman ini.
      if (r.status === 401) sd.galat = "masuk";
      else if (r.status === 403) sd.galat = "akses";
      else if (!r.ok) sd.galat = "jawaban";
      else {
        const luar = await r.json();
        const isi = sdBersihkan(luar && typeof luar === "object" && luar.data ? luar.data : luar);
        if (isi) {
          sd.data = isi;
          sd.galat = "";
        } else sd.galat = "jawaban";
      }
    } catch {
      sd.galat = "jaringan";
    } finally {
      // Pemantau waktu nyata: angka yang tidak dapat diperbarui tidak dibiarkan
      // tampak hidup. Titiknya kelabu dengan sebabnya sampai bacaan berikutnya.
      if (sd.galat) sd.data = null;
      if (tunda) clearTimeout(tunda);
      sd.jalan = false;
    }
    if (sd.galat === "akses") {
      hentikanJamSd();
      if (bayang) for (const s of Array.from(bayang.querySelectorAll(".aleta-cmw-sd"))) s.remove();
      return;
    }
    perbaruiIndikatorSd();
  }

  function hentikanJamSd() {
    if (sd.jam) clearInterval(sd.jam);
    sd.jam = null;
  }

  /**
   * Menyalakan / mematikan detak menurut keadaan sekarang. Dipanggil sesudah
   * tiap gambar(), saat tab berganti terlihat, dan saat tampilan berganti.
   * Aman dipanggil berulang: tidak pernah memicu permintaan rapat.
   */
  function aturJamSd() {
    const hidup = sdBerlaku() && sd.galat !== "akses" && akar && akar.isConnected && document.visibilityState !== "hidden";
    if (!hidup) {
      hentikanJamSd();
      return;
    }
    if (!sd.lingkupTerbaca) {
      sd.lingkupTerbaca = true;
      void baca([KUNCI_LINGKUP_SD]).then((s) => {
        const l = lingkupSdBersih(s[KUNCI_LINGKUP_SD]);
        if (l !== sd.lingkup) {
          sd.lingkup = l;
          perbaruiIndikatorSd();
        }
      });
    }
    if (!sd.jam) sd.jam = setInterval(detakSd, DETAK_SD_MS);
    if (!sd.jalan && Date.now() - sd.terakhir >= DETAK_SD_MS - 500) void mintaSumberDaya();
  }

  /** Satu detak: tab tersembunyi, widget terlepas, atau tampilan berganti = berhenti. */
  function detakSd() {
    if (!sdBerlaku() || sd.galat === "akses" || !akar || !akar.isConnected || document.visibilityState === "hidden") {
      hentikanJamSd();
      return;
    }
    void mintaSumberDaya();
  }

  /** Strip yang boleh dipasang di gambar ini (null bila tidak berlaku atau tidak berwenang). */
  function indikatorSdUntukGambar(kecil) {
    if (!sdBerlaku() || sd.galat === "akses") return null;
    return susunIndikatorSd(kecil);
  }

  // ─── Tahap 3: dok dan tumpukan widget (D9, D11, popup-20..23) ──────────────

  /** Susunan dok yang berlaku di situs ini: per situs hanya bila popup-23 menyala. */
  function kunciSusunan() {
    return fitur("popup-23") ? JENIS : "semua";
  }

  /**
   * PERBAIKAN 2 OKT BUTIR 13 (UI Baru): "bawaan hanya checklist milestone yang
   * tampil, bagian lain (Catatan cepat, Lama sidang, Kalender tenggat, dst.)
   * HIDE". Berlaku hanya selama BELUM ada susunan tersimpan (lokal maupun
   * akun) - yang sudah menyimpan tatanya sendiri tetap memakai tatanya.
   * Lama dan Baru tidak membaca susunan sama sekali.
   */
  function susunanBawaan() {
    if (!modern()) return { urutan: [], mati: [] };
    return { urutan: [], mati: WIDGET.filter((w) => w.id !== "checklist" && !w.menyusul).map((w) => w.id) };
  }

  function susunanAktif() {
    const k = kunciSusunan();
    const s = keadaan.susunan[k] || (k !== "semua" ? keadaan.susunan.semua : null);
    return s || susunanBawaan();
  }

  function simpanSusunan(isi) {
    keadaan.susunan = { ...keadaan.susunan, [kunciSusunan()]: isi };
    tulis({ [KUNCI_SUSUNAN]: keadaan.susunan });
    // Butir 7: susunan dok ikut ke setelan akun di server (UI Baru).
    if (modern()) catatTataBerubah();
    gambar();
  }

  /** Widget yang dapat dinyalakan di tampilan ini (menyusul tidak pernah). */
  function widgetTersedia(w) {
    return !w.menyusul && (w.id === "checklist" || fitur(w.kode));
  }

  /** Urutan lengkap widget yang bukan "menyusul": yang disimpan dulu, sisanya urutan bawaan. */
  function urutanWidget() {
    const bukanMenyusul = WIDGET.filter((w) => !w.menyusul).map((w) => w.id);
    const simpan = susunanAktif().urutan.filter((id) => bukanMenyusul.includes(id));
    return [...new Set([...simpan, ...bukanMenyusul])];
  }

  /** Yang tampil di dok UI Baru, berurutan. */
  function widgetTampil() {
    const mati = new Set(susunanAktif().mati);
    return urutanWidget().filter((id) => !mati.has(id) && widgetTersedia(WIDGET.find((w) => w.id === id)));
  }

  function susunWidget(id) {
    if (id === "checklist") return susunPanel();
    if (id === "catatan") return susunCatatan();
    if (id === "lama-sidang") return susunLamaSidang();
    if (id === "kalender") return susunKalender();
    return null;
  }

  /**
   * D9 (UI Baru): satu dok di kiri bawah - widget bertumpuk, lalu lencana
   * logo di kakinya beserta keterangannya dan "Atur widget". Ciut = lencana saja.
   */
  function susunDok(kecil) {
    const dok = el("div", "aleta-cmw-dok");
    dok.setAttribute("data-dok", kecil ? "ciut" : "bentang");
    if (!kecil) {
      if (keadaan.aturTerbuka) {
        dok.appendChild(susunAtur());
      } else {
        const tumpuk = el("div", "aleta-cmw-tumpuk");
        for (const id of widgetTampil()) {
          // Butir 7: bagian yang dipisah tinggal di jendela melayangnya.
          if (terpisah(id)) continue;
          const w = susunWidget(id);
          if (w) {
            pasangKendaliBagian(w, id, false);
            tumpuk.appendChild(w);
          }
        }
        if (tumpuk.childNodes.length) dok.appendChild(tumpuk);
      }
    }
    const baris = el("div", "aleta-cmw-lencana-baris");
    baris.appendChild(susunLencana(kecil));
    // Butir 3 (6 Okt): RAM / Disk / GPU di samping lencana, ciut maupun bentang.
    const indikator = indikatorSdUntukGambar(kecil);
    if (indikator) baris.appendChild(indikator);
    if (!kecil) {
      const ket = el("div", "aleta-cmw-lencana-ket");
      const a = angkaBelum();
      // CHECKLIST-POSISI 12 Okt: kotaknya tetap ada (tata letak), isinya hanya Super Admin.
      if (bolehKeteranganTeknis()) {
        ket.appendChild(el("span", "aleta-cmw-lencana-teks", `${keadaan.data ? `${a.belum} tugas · ` : ""}${teksSambungan()}`));
      }
      if (sudutAktif() && bolehKeteranganTeknis()) ket.appendChild(teknis(el("span", "aleta-cm-sudut", teksSudut())));
      baris.appendChild(ket);
      const atur = tombol(
        "aleta-cmw-tombol aleta-cmw-atur-buka",
        "⚙ Atur widget",
        keadaan.aturTerbuka ? "Tutup Atur widget" : "Atur widget: pilih yang tampil dan urutannya",
        () => bukaAtur(!keadaan.aturTerbuka),
        "atur-buka"
      );
      atur.setAttribute("aria-expanded", keadaan.aturTerbuka ? "true" : "false");
      baris.appendChild(atur);
    }
    dok.appendChild(baris);
    return dok;
  }

  /**
   * Tampilan Baru (kulit Klasik): tanpa dok dan tanpa galeri - widget kecil
   * yang saklarnya menyala bertumpuk di atas checklist, urutan bawaan. Tanpa
   * satu pun saklar, isinya persis jalan Lama: panel atau pil.
   */
  function susunTumpukKlasik(kecil) {
    const frag = document.createDocumentFragment();
    if (kecil) {
      frag.appendChild(fitur("popup-8") ? susunLencana(true) : susunPil());
      return frag;
    }
    // Butir 3 (6 Okt): indikator sumber daya - di Baru hanya dengan saklar portal-7.
    const indikator = indikatorSdUntukGambar(false);
    if (indikator) frag.appendChild(indikator);
    const tambahan = WIDGET.filter((w) => w.id !== "checklist" && widgetTersedia(w));
    if (tambahan.length) {
      const tumpuk = el("div", "aleta-cmw-tumpuk aleta-cmw-tumpuk-klasik");
      for (const w of tambahan) {
        const isi = susunWidget(w.id);
        if (isi) tumpuk.appendChild(isi);
      }
      frag.appendChild(tumpuk);
    }
    frag.appendChild(susunPanel());
    return frag;
  }

  /**
   * Kotak satu widget kecil: kepala (juga pegangan geser dok) dan isinya.
   *
   * UI Baru (perbaikan 1 Okt butir 1, K2): judulnya menjadi tombol lipat yang
   * sama dengan panel SIPP, ABT, dan portal (alatLipat di panel-alat.js) -
   * panah, buka/tutup diingat per bagian ("widget:<id>"). Kepala tetap
   * pegangan geser di luar tombolnya. Atur widget tidak dilipat.
   */
  function kotakWidget(id, judul) {
    const lipat = modern() && id !== "atur" && typeof alatLipat === "function";
    let kotak;
    let isi;
    let tombolLipat = null;
    const teksJudul = el("span", "aleta-cmw-judul", judul);
    if (lipat) {
      const l = alatLipat(teksJudul, { kunci: `widget:${id}`, kelas: "aleta-cmw-kotak" });
      kotak = l.akar;
      isi = l.isi;
      isi.classList.add("aleta-cmw-isi");
      tombolLipat = l.kepala;
      tombolLipat.setAttribute("data-fokus", `lipat-${id}`);
      tombolLipat.title = `Lipat atau bentangkan ${judul}`;
    } else {
      kotak = el("section", "aleta-cmw-kotak");
      isi = el("div", "aleta-cmw-isi");
    }
    kotak.setAttribute("data-widget-isi", id);
    kotak.setAttribute("role", "region");
    kotak.setAttribute("aria-label", judul);
    const kepala = el("header", "aleta-cmw-kepala");
    kepala.setAttribute("data-geser", "1");
    kepala.title = `${judul}. Geser dari sini.`;
    kepala.appendChild(tombolLipat || teksJudul);
    kotak.insertBefore(kepala, kotak.firstChild);
    if (!isi.parentNode) kotak.appendChild(isi);
    return { kotak, kepala, isi };
  }

  // ─── popup-20: catatan cepat ───────────────────────────────────────────────

  function susunCatatan() {
    const w = kotakWidget("catatan", "Catatan cepat");
    if (!kotakCatatan) {
      kotakCatatan = el("textarea", "aleta-cmw-catatan");
      kotakCatatan.setAttribute("data-fokus", "catatan");
      kotakCatatan.setAttribute("aria-label", "Catatan cepat");
      kotakCatatan.maxLength = CATATAN_MAKS;
      kotakCatatan.placeholder = "Hal kecil yang harus diingat…";
      kotakCatatan.addEventListener("input", () => {
        keadaan.catatan = kotakCatatan.value.slice(0, CATATAN_MAKS);
        if (jamCatatan) clearTimeout(jamCatatan);
        jamCatatan = setTimeout(simpanCatatan, CATATAN_JEDA_MS);
      });
      kotakCatatan.addEventListener("blur", simpanCatatan);
    }
    if (kotakCatatan.value !== keadaan.catatan && !catatanDisunting()) kotakCatatan.value = keadaan.catatan;
    w.isi.appendChild(kotakCatatan);
    w.isi.appendChild(teknis(el("div", "aleta-cmw-ket", "Tersimpan di peramban ini saja - tidak dikirim ke mana pun.")));
    return w.kotak;
  }

  function catatanDisunting() {
    return Boolean(kotakCatatan && bayang && bayang.activeElement === kotakCatatan);
  }

  function simpanCatatan() {
    if (jamCatatan) clearTimeout(jamCatatan);
    jamCatatan = null;
    if (!kotakCatatan) return;
    const teks = kotakCatatan.value.slice(0, CATATAN_MAKS);
    keadaan.catatan = teks;
    tulis({ [KUNCI_CATATAN]: { teks, pada: Date.now() } });
  }

  // ─── popup-21: lama sidang berjalan ────────────────────────────────────────

  function lamaBerjalan(b, kini = Date.now()) {
    if (!b) return 0;
    const skorsKini = b.skorsSejak ? kini - b.skorsSejak : 0;
    return Math.max(0, kini - b.mulai - b.skorsMs - skorsKini);
  }

  function formatDurasi(ms) {
    const detik = Math.floor(ms / 1000);
    return `${dua(Math.floor(detik / 3600))}:${dua(Math.floor((detik % 3600) / 60))}:${dua(detik % 60)}`;
  }

  /** Rata-rata HANYA dari sidang yang dicatat di peramban ini. */
  function rataSidang() {
    const r = keadaan.lamaSidang.riwayat;
    if (!r.length) return null;
    return { menit: Math.round(r.reduce((n, x) => n + x.lamaMs, 0) / r.length / 60000), jumlah: r.length };
  }

  function ubahSidang(tindakan) {
    const kini = Date.now();
    const s = keadaan.lamaSidang;
    let berjalan = s.berjalan ? { ...s.berjalan } : null;
    let riwayat = s.riwayat;
    if (tindakan === "mulai" && !berjalan) berjalan = { mulai: kini, skorsSejak: 0, skorsMs: 0 };
    else if (tindakan === "skors" && berjalan && !berjalan.skorsSejak) berjalan.skorsSejak = kini;
    else if (tindakan === "lanjut" && berjalan && berjalan.skorsSejak) {
      berjalan.skorsMs += kini - berjalan.skorsSejak;
      berjalan.skorsSejak = 0;
    } else if (tindakan === "selesai" && berjalan) {
      const lamaMs = lamaBerjalan(berjalan, kini);
      const skorsMs = berjalan.skorsMs + (berjalan.skorsSejak ? kini - berjalan.skorsSejak : 0);
      if (lamaMs >= SIDANG_MIN_MS) {
        riwayat = [{ mulai: berjalan.mulai, selesai: kini, lamaMs, skorsMs }, ...riwayat].slice(0, RIWAYAT_SIDANG_MAKS);
      }
      berjalan = null;
    } else if (tindakan === "batal") berjalan = null;
    else return;
    keadaan.lamaSidang = { berjalan, riwayat };
    tulis({ [KUNCI_LAMA_SIDANG]: keadaan.lamaSidang });
    gambar();
  }

  function susunLamaSidang() {
    const w = kotakWidget("lama-sidang", "Lama sidang");
    const b = keadaan.lamaSidang.berjalan;
    const jam = el("div", "aleta-cmw-jam", formatDurasi(lamaBerjalan(b)));
    jam.setAttribute("role", "timer");
    if (b && b.skorsSejak) jam.setAttribute("data-skors", "ya");
    w.isi.appendChild(jam);
    const ket = b
      ? `mulai ${jamMenit(new Date(b.mulai))}${b.skorsSejak ? ` · diskors sejak ${jamMenit(new Date(b.skorsSejak))}` : ""}`
      : "Belum ada sidang yang berjalan.";
    w.isi.appendChild(el("div", "aleta-cmw-ket aleta-cmw-sidang-ket", ket));
    const r = rataSidang();
    const rata = el(
      "div",
      "aleta-cmw-ket aleta-cmw-sidang-rata",
      r
        ? `Rata-rata ${r.menit} menit dari ${r.jumlah} sidang yang dicatat di peramban ini.`
        : "Rata-rata muncul sesudah sidang pertama dicatat di peramban ini."
    );
    // Angka rata-ratanya hasil; kalimat "muncul sesudah…" penjelasan.
    w.isi.appendChild(r ? rata : teknis(rata));
    const baris = el("div", "aleta-cmw-baris");
    const t = (kelas, teks, judul, tindakan) =>
      baris.appendChild(tombol(`aleta-cmw-tombol ${kelas}`, teks, judul, () => ubahSidang(tindakan), `sidang-${tindakan}`));
    if (!b) t("aleta-cmw-tombol-utama", "▶ Mulai", "Mulai menghitung lama sidang", "mulai");
    else {
      if (b.skorsSejak) t("aleta-cmw-tombol-utama", "▶ Lanjut", "Lanjutkan sidang yang diskors", "lanjut");
      else t("", "⏸ Skors", "Skors - waktu skors tidak ikut dihitung", "skors");
      t("aleta-cmw-tombol-utama", "■ Selesai", "Selesai - lamanya dicatat untuk rata-rata", "selesai");
      t("", "Batal", "Batalkan tanpa mencatat", "batal");
    }
    w.isi.appendChild(baris);
    // F3.1: skors yang dicatat di Jadwal Sidang ALETA hari ini - sinkron dengan
    // portal (alasan, perkiraan lanjut + hitung mundur, lama skors).
    if (modeUji() !== "lama") w.isi.appendChild(susunBlokSkors());
    return w.kotak;
  }

  // ─── F3.1 (17 Okt 2026): skors hari ini dari Jadwal Sidang ALETA ───────────
  //
  // Jam "Lama sidang" di atas milik peramban ini saja. Skors yang SAH (yang
  // menggerakkan antrian dan masuk BAS) dicatat di Jadwal Sidang ALETA - di
  // sini hanya DIBACA (GET sidang/skors?tanggal=hari ini), satu permintaan
  // per menit dan hanya selama widget ini terlihat. Tidak menulis apa pun.

  function tanggalHariIniSkors() {
    const t = new Date();
    return `${t.getFullYear()}-${dua(t.getMonth() + 1)}-${dua(t.getDate())}`;
  }

  function waktuSkors(teks) {
    const c = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(String(teks || ""));
    return c ? new Date(Number(c[1]), Number(c[2]) - 1, Number(c[3]), Number(c[4]), Number(c[5])) : null;
  }

  function jamSkorsTitik(teks) {
    const t = waktuSkors(teks);
    return t ? jamMenit(t) : "";
  }

  /** Satu baris widget: { nomor, ket, lewat, aktif }. */
  function kalimatSkorsWidget(s, kini) {
    const alasan = String(s.alasan || "").trim();
    const mulai = jamSkorsTitik(s.diskorsPada);
    const nomor = String(s.nomorPerkara || "").trim() || `perkara ${s.perkaraId}`;
    if (String(s.dilanjutkanPada || "").trim()) {
      const akhir = jamSkorsTitik(s.dilanjutkanPada);
      const detik = Number.isFinite(s.lamaDetik) ? s.lamaDetik : null;
      const menit = detik !== null ? Math.max(1, Math.round(detik / 60)) : null;
      return { nomor, aktif: false, lewat: false, ket: [`skors ${mulai}-${akhir}${menit ? ` (${menit} menit)` : ""}`, alasan].filter(Boolean).join(" · ") };
    }
    const perkiraan = waktuSkors(s.perkiraanLanjut);
    let mundur = "";
    let lewat = false;
    if (perkiraan) {
      const sisa = Math.round((perkiraan.getTime() - kini.getTime()) / 60000);
      lewat = sisa < 0;
      mundur = sisa > 0 ? ` (${sisa} mnt lagi)` : sisa === 0 ? " (sebentar lagi)" : ` (lewat ${-sisa} mnt)`;
    }
    return {
      nomor,
      aktif: true,
      lewat,
      ket: [`diskors sejak ${mulai}`, alasan, perkiraan ? `lanjut ±${jamMenit(perkiraan)}${mundur}` : ""].filter(Boolean).join(" · "),
    };
  }

  function isiBlokSkors(blok) {
    while (blok.firstChild) blok.removeChild(blok.firstChild);
    blok.appendChild(el("div", "aleta-cmw-skors-judul", "Skors hari ini · Jadwal Sidang ALETA"));
    if (skorsPortal.daftar === null) {
      blok.appendChild(el("div", "aleta-cmw-ket", skorsPortal.galat || (skorsPortal.memuat ? "Membaca skors dari ALETA…" : "Menunggu data skors dari ALETA…")));
      return;
    }
    // Yang masih diskors lebih dulu, lalu yang sudah dilanjutkan (terbaru dulu).
    const kini = new Date();
    const aktif = skorsPortal.daftar.filter((s) => !String(s.dilanjutkanPada || "").trim());
    const usai = skorsPortal.daftar.filter((s) => String(s.dilanjutkanPada || "").trim()).reverse();
    const semua = [...aktif, ...usai].slice(0, SKORS_TAMPIL_MAKS);
    if (!semua.length) {
      blok.appendChild(el("div", "aleta-cmw-ket", "Tidak ada sidang yang diskors hari ini."));
    }
    for (const s of semua) {
      const k = kalimatSkorsWidget(s, kini);
      const baris = el("div", "aleta-cmw-skors-baris");
      baris.setAttribute("data-skors-aktif", k.aktif ? "ya" : "tidak");
      if (k.lewat) baris.setAttribute("data-skors-lewat", "ya");
      if (s.oleh) baris.title = `Diskors oleh ${s.oleh}${s.dilanjutkanOleh ? `, dilanjutkan oleh ${s.dilanjutkanOleh}` : ""}`;
      baris.appendChild(el("b", "", k.nomor));
      baris.appendChild(el("span", "", ` ${k.ket}`));
      blok.appendChild(baris);
    }
    const lebih = aktif.length + usai.length - semua.length;
    if (lebih > 0) blok.appendChild(el("div", "aleta-cmw-ket", `+${lebih} lainnya di Jadwal Sidang ALETA.`));
    if (skorsPortal.galat) blok.appendChild(el("div", "aleta-cmw-ket", skorsPortal.galat));
  }

  function susunBlokSkors() {
    const blok = el("div", "aleta-cmw-skors");
    blok.setAttribute("data-skors-portal", "");
    isiBlokSkors(blok);
    return blok;
  }

  function gambarUlangBlokSkors() {
    if (!bayang) return;
    for (const b of Array.from(bayang.querySelectorAll(".aleta-cmw-skors"))) isiBlokSkors(b);
  }

  async function muatSkorsPortal() {
    if (skorsPortal.memuat) return;
    skorsPortal.memuat = true;
    const ambil = typeof alatAmbil === "function" ? alatAmbil : (alamat, opsi) => fetch(alamat, opsi);
    try {
      const r = await ambil(
        `${ALAMAT_SKORS}?tanggal=${tanggalHariIniSkors()}`,
        { credentials: "include", cache: "no-store" },
        "Membaca skors sidang hari ini"
      );
      const luar = await r.json().catch(() => null);
      const isi = luar && typeof luar === "object" && luar.data && typeof luar.data === "object" ? luar.data : luar;
      if (!r.ok || !isi || isi.available === false || !Array.isArray(isi.skors)) {
        skorsPortal.galat = r.status === 401 || r.status === 403 ? "Skors hanya terbaca oleh petugas sidang yang masuk ALETA." : "Skors dari ALETA belum dapat dibaca.";
      } else {
        skorsPortal.daftar = isi.skors.filter((s) => s && typeof s === "object" && s.perkaraId);
        skorsPortal.galat = "";
      }
    } catch {
      skorsPortal.galat = "Skors dari ALETA belum dapat dibaca.";
    } finally {
      skorsPortal.memuat = false;
      skorsPortal.diterima = Date.now();
      gambarUlangBlokSkors();
    }
  }

  /** Skors dibaca hanya selama bloknya terlihat; hitung mundurnya diperbarui tiap 30 detik. */
  function aturSkorsPortal() {
    const perlu = Boolean(bayang && bayang.querySelector(".aleta-cmw-skors") && akar && akar.isConnected);
    if (!perlu) {
      if (jamSkors) clearInterval(jamSkors);
      jamSkors = null;
      return;
    }
    if (Date.now() - skorsPortal.diterima >= SKORS_SEGAR_MS) void muatSkorsPortal();
    if (jamSkors) return;
    jamSkors = setInterval(() => {
      if (!bayang || !bayang.querySelector(".aleta-cmw-skors") || !akar || !akar.isConnected) return aturSkorsPortal();
      if (Date.now() - skorsPortal.diterima >= SKORS_SEGAR_MS) void muatSkorsPortal();
      else gambarUlangBlokSkors();
    }, 30 * 1000);
  }

  /** Jam berdetak hanya selama sidangnya berjalan, tidak diskors, dan jamnya terlihat. */
  function aturJamSidang() {
    const b = keadaan.lamaSidang.berjalan;
    const perlu = Boolean(bayang && bayang.querySelector(".aleta-cmw-jam") && b && !b.skorsSejak && akar && akar.isConnected);
    if (!perlu) {
      if (jamSidang) clearInterval(jamSidang);
      jamSidang = null;
      return;
    }
    if (jamSidang) return;
    jamSidang = setInterval(() => {
      const kini = keadaan.lamaSidang.berjalan;
      if (!bayang || !kini || kini.skorsSejak) return aturJamSidang();
      for (const j of Array.from(bayang.querySelectorAll(".aleta-cmw-jam"))) j.textContent = formatDurasi(lamaBerjalan(kini));
    }, 1000);
  }

  // ─── popup-22: kalender tenggat dua minggu ─────────────────────────────────

  function kunciTanggal(t) {
    return `${t.getFullYear()}-${dua(t.getMonth() + 1)}-${dua(t.getDate())}`;
  }

  function teksTanggal(t) {
    return `${NAMA_HARI[t.getDay()]} ${t.getDate()} ${NAMA_BULAN[t.getMonth()]}`;
  }

  /**
   * Dua minggu mulai Senin minggu ini, dari tenggat butir checklist yang
   * SUDAH diterima - tidak ada permintaan baru. Portal hanya mengirim yang
   * lewat, hari ini, dan minggu ini, jadi minggu kedua biasanya lengang: itu
   * disebut, bukan dibiarkan terbaca "tidak ada tenggat".
   */
  function susunKalender() {
    const w = kotakWidget("kalender", "Kalender tenggat");
    const data = keadaan.data;
    if (!data) {
      w.isi.appendChild(el("div", "aleta-cmw-ket", "Menunggu checklist dari portal…"));
      return w.kotak;
    }
    const kini = new Date();
    const hariIni = awalHari(kini);
    const awal = new Date(kini.getFullYear(), kini.getMonth(), kini.getDate() - ((kini.getDay() + 6) % 7));
    const hari = Array.from({ length: 14 }, (_, i) => new Date(awal.getFullYear(), awal.getMonth(), awal.getDate() + i));
    const akhir = hari[13];
    const judulKal = w.kepala.querySelector(".aleta-cmw-judul") || w.kepala.firstChild;
    judulKal.textContent = `Kalender tenggat · ${teksTanggal(awal)} – ${teksTanggal(akhir)}`;

    const perHari = new Map();
    let sebelum = 0;
    let sesudah = 0;
    let tanpa = 0;
    for (const b of butirTampil(data)) {
      const t = b.tenggat ? new Date(String(b.tenggat)) : null;
      if (!t || Number.isNaN(t.getTime())) {
        tanpa += 1;
        continue;
      }
      if (awalHari(t) < awal.getTime()) sebelum += 1;
      else if (awalHari(t) > akhir.getTime()) sesudah += 1;
      else {
        const k = kunciTanggal(t);
        perHari.set(k, [...(perHari.get(k) || []), b]);
      }
    }
    if (keadaan.hariKalender && !hari.some((d) => kunciTanggal(d) === keadaan.hariKalender)) keadaan.hariKalender = "";

    const kal = el("div", "aleta-cmw-kal");
    kal.setAttribute("role", "group");
    kal.setAttribute("aria-label", "Tenggat dua minggu");
    for (const n of ["S", "S", "R", "K", "J", "S", "M"]) kal.appendChild(el("span", "aleta-cmw-kal-hari", n));
    for (const d of hari) {
      const k = kunciTanggal(d);
      const daftar = perHari.get(k) || [];
      const tgl = tombol(
        "aleta-cmw-kal-tgl",
        d.getDate(),
        `${teksTanggal(d)}: ${daftar.length ? `${daftar.length} tenggat - ${daftar.map((b) => b.judul || b.jenis).join("; ")}` : "tidak ada tenggat"}`,
        () => {
          keadaan.hariKalender = keadaan.hariKalender === k ? "" : k;
          gambar();
        },
        `kal-${k}`
      );
      tgl.setAttribute("data-tanggal", k);
      if (d.getTime() === hariIni) tgl.setAttribute("data-kini", "ya");
      if (d.getTime() < hariIni) tgl.setAttribute("data-lalu", "ya");
      if (keadaan.hariKalender === k) tgl.setAttribute("data-dipilih", "ya");
      if (daftar.length) {
        tgl.setAttribute("data-jumlah", String(daftar.length));
        tgl.setAttribute("data-nada", d.getTime() < hariIni ? "lewat" : d.getTime() === hariIni ? "mendesak" : "aman");
      }
      kal.appendChild(tgl);
    }
    w.isi.appendChild(kal);

    if (keadaan.hariKalender) {
      const pilihan = perHari.get(keadaan.hariKalender) || [];
      const ul = el("ul", "aleta-cmw-kal-daftar");
      if (!pilihan.length) ul.appendChild(el("li", "aleta-cmw-ket", "Tidak ada tenggat pada hari itu."));
      for (const b of pilihan) {
        const li = el("li");
        const nomor = String(objek(b.perkara).nomor || "").trim();
        li.appendChild(el("span", "", `${b.judul || b.jenis || "Butir"}${nomor ? ` · ${nomor}` : ""}`));
        li.appendChild(susunKerjakan(b));
        ul.appendChild(li);
      }
      w.isi.appendChild(ul);
    }
    const catatan = [];
    if (sebelum) catatan.push(`${sebelum} tenggat lewat sebelum ${teksTanggal(awal)}`);
    if (sesudah) catatan.push(`${sesudah} sesudah ${teksTanggal(akhir)}`);
    if (tanpa) catatan.push(`${tanpa} tanpa tenggat`);
    // Hitungannya hasil; batas sumbernya penjelasan teknis (K5).
    const batas = "hanya tenggat yang dikirim checklist (lewat, hari ini, minggu ini)";
    if (modeUji() === "lama") {
      catatan.push(batas);
      w.isi.appendChild(el("div", "aleta-cmw-ket", `${catatan.join(" · ")}.`));
    } else {
      const ket = el("div", "aleta-cmw-ket", catatan.length ? `${catatan.join(" · ")}.` : "");
      ket.appendChild(teknis(el("span", "", `${catatan.length ? " " : ""}${batas.charAt(0).toUpperCase()}${batas.slice(1)}.`)));
      w.isi.appendChild(ket);
    }
    return w.kotak;
  }

  // ─── Perbaikan 2 Okt butir 13: menu bagian di kepala checklist ─────────────

  /**
   * Saklar tampil/sembunyi tiap bagian widget, dari kepala checklist. Satu
   * sumber dengan "Atur widget" (alihWidget, susunanWidget, setelan akun) -
   * yang diubah di sini terbaca di sana dan sebaliknya. Bagian yang saklar
   * fiturnya mati atau yang menyusul DISEBUT, tidak dapat ditekan.
   */
  function susunMenuBagian() {
    const menu = el("div", "aleta-cm-bagian-menu");
    menu.setAttribute("role", "group");
    menu.setAttribute("aria-label", "Bagian widget yang tampil");
    menu.appendChild(el("div", "aleta-cm-bagian-judul", "Bagian yang tampil"));
    const mati = new Set(susunanAktif().mati);
    for (const wd of WIDGET) {
      // Yang menyusul cukup disebut sebaris di bawah (tidak dapat dinyalakan) -
      // tujuh saklar mati berderet hanya meramaikan kepala checklist.
      if (wd.id === "checklist" || wd.menyusul) continue;
      const tersedia = widgetTersedia(wd);
      const baris = el("div", "aleta-cm-bagian-baris");
      baris.setAttribute("data-bagian", wd.id);
      const teks = el("span", "aleta-cm-bagian-teks", wd.judul);
      if (wd.menyusul) teks.appendChild(el("span", "aleta-cmw-menyusul", "menyusul"));
      baris.appendChild(teks);
      const nyala = tersedia && !mati.has(wd.id);
      const saklar = tombol(
        "aleta-cmw-saklar",
        "",
        wd.menyusul
          ? `${wd.judul} - menyusul: ${wd.menyusul}`
          : tersedia
            ? `${nyala ? "Sembunyikan" : "Tampilkan"} ${wd.judul}`
            : `${wd.judul}: saklar fitur ${wd.kode} di popup masih mati`,
        () => alihWidget(wd.id),
        `bagian-saklar-${wd.id}`
      );
      saklar.setAttribute("role", "switch");
      saklar.setAttribute("aria-checked", nyala ? "true" : "false");
      saklar.disabled = !tersedia;
      baris.appendChild(saklar);
      menu.appendChild(baris);
    }
    const menyusul = WIDGET.filter((w) => w.menyusul).map((w) => w.judul);
    if (menyusul.length) menu.appendChild(el("div", "aleta-cm-bagian-ket", `Menyusul: ${menyusul.join(", ")}.`));
    const kaki = el("div", "aleta-cm-bagian-kaki");
    kaki.appendChild(
      tombol(
        "aleta-cmw-tombol",
        "⚙ Atur lengkap",
        "Atur widget: urutan, pisah ke jendela, tinggi, kelompok checklist",
        () => {
          keadaan.bagianTerbuka = false;
          bukaAtur(true);
        },
        "bagian-atur"
      )
    );
    menu.appendChild(kaki);
    return menu;
  }

  // ─── Perbaikan 2 Okt butir 11: klik dua kali di sudut widget ───────────────

  /** "ki-at" (panel-alat.js) -> pindah ke sudut layar itu. */
  function pindahKeSudutLayar(sudut) {
    if (!akar) return;
    const PETA = { "ki-at": "kiri-atas", "ka-at": "kanan-atas", "ki-bw": "kiri-bawah", "ka-bw": "kanan-bawah" };
    const nama = PETA[sudut];
    if (!nama) return;
    if (fitur("popup-9")) {
      keadaan.sudut = { ...keadaan.sudut, [JENIS]: nama };
      tulis({ [KUNCI_SUDUT]: keadaan.sudut });
      terapkanPosisi();
      gambar();
      return;
    }
    const kotak = akar.getBoundingClientRect();
    const lebar = kotak.width || 0;
    const tinggi = kotak.height || 0;
    const kiri = nama.startsWith("kiri") ? TEPI : Math.max((window.innerWidth || 0) - lebar - TEPI, 0);
    const bawah = nama.endsWith("bawah") ? TEPI : Math.max((window.innerHeight || 0) - tinggi - TEPI, 0);
    keadaan.posisi = { kiri: Math.round(kiri), bawah: Math.round(bawah), kecil: sedangKecil() };
    simpanPosisi();
    terapkanPosisi();
  }

  // ─── D11 / popup-23: Atur widget ───────────────────────────────────────────

  function bukaAtur(buka) {
    keadaan.aturTerbuka = Boolean(buka) && modern();
    gambar();
    fokuskan(keadaan.aturTerbuka ? "atur-tutup" : "atur-buka");
  }

  function geserUrutan(id, arah) {
    const urutan = urutanWidget();
    const i = urutan.indexOf(id);
    const j = i + arah;
    if (i < 0 || j < 0 || j >= urutan.length) return;
    [urutan[i], urutan[j]] = [urutan[j], urutan[i]];
    simpanSusunan({ urutan, mati: susunanAktif().mati });
  }

  function alihWidget(id) {
    const s = susunanAktif();
    const mati = new Set(s.mati);
    if (mati.has(id)) mati.delete(id);
    else mati.add(id);
    simpanSusunan({ urutan: urutanWidget(), mati: [...mati] });
  }

  /**
   * Seret ⋮⋮ untuk mengurutkan. Barisnya dipindahkan di tempat selama diseret
   * dan urutannya disimpan saat dilepas. Tombol ↑ ↓ di tiap baris melakukan
   * hal yang sama untuk papan tik dan layar sentuh yang sulit menyeret.
   * Peristiwanya tidak diteruskan ke dok - menyeret baris bukan menggeser dok.
   */
  function pasangSeretAtur(daftar) {
    let seret = null;
    daftar.addEventListener("pointerdown", (e) => {
      const p = e.target && typeof e.target.closest === "function" ? e.target.closest(".aleta-cmw-pegangan") : null;
      if (!p) return;
      const baris = p.closest("[data-urut]");
      if (!baris) return;
      e.stopPropagation();
      seret = { baris };
      baris.setAttribute("data-diseret", "ya");
      try {
        if (e.pointerId !== undefined && typeof p.setPointerCapture === "function") p.setPointerCapture(e.pointerId);
      } catch {
        /* tanpa tangkapan, seret tetap berjalan selama penunjuk di atas daftar */
      }
    });
    daftar.addEventListener("pointermove", (e) => {
      if (!seret) return;
      e.stopPropagation();
      for (const b of Array.from(daftar.querySelectorAll("[data-urut]"))) {
        if (b === seret.baris) continue;
        const r = b.getBoundingClientRect();
        if (e.clientY < r.top || e.clientY > r.bottom) continue;
        daftar.insertBefore(seret.baris, e.clientY < r.top + r.height / 2 ? b : b.nextSibling);
        break;
      }
    });
    const lepasSeret = (e) => {
      if (!seret) return;
      if (e) e.stopPropagation();
      seret.baris.removeAttribute("data-diseret");
      seret = null;
      const urutan = Array.from(daftar.querySelectorAll("[data-urut]")).map((b) => b.getAttribute("data-widget"));
      simpanSusunan({ urutan, mati: susunanAktif().mati });
    };
    daftar.addEventListener("pointerup", lepasSeret);
    daftar.addEventListener("pointercancel", lepasSeret);
  }

  function susunAtur() {
    const w = kotakWidget("atur", "Atur widget");
    w.kotak.classList.add("aleta-cmw-atur");
    const alat = el("span", "aleta-cm-alat");
    alat.appendChild(tombol("aleta-cmw-atur-tutup", "×", "Tutup Atur widget", () => bukaAtur(false), "atur-tutup"));
    w.kepala.appendChild(alat);
    w.isi.appendChild(
      teknis(el(
        "div",
        "aleta-cmw-ket",
        "Pilih yang tampil di dok. Seret ⋮⋮ (atau ↑ ↓) untuk mengubah urutan. " +
          (fitur("popup-23")
            ? `Susunan ini untuk ${NAMA_SITUS[JENIS]} saja - SIPP, ABT, dan portal boleh berbeda.`
            : "Susunan yang sama berlaku di SIPP, ABT, dan portal.") +
          " ⧉ memisahkan bagian menjadi jendela melayang; tarik garis di kaki bagian untuk mengubah tingginya." +
          " Disimpan di akun Anda di server - berlaku di PC mana pun Anda masuk - dengan cadangan di peramban ini."
      ))
    );
    const daftar = el("ul", "aleta-cmw-atur-daftar");
    const urutan = urutanWidget();
    const mati = new Set(susunanAktif().mati);
    urutan.forEach((id, i) => {
      const wd = WIDGET.find((x) => x.id === id);
      const tersedia = widgetTersedia(wd);
      const li = el("li", "aleta-cmw-atur-baris");
      li.setAttribute("data-widget", id);
      li.setAttribute("data-urut", String(i));
      const pegang = el("span", "aleta-cmw-pegangan", "⋮⋮");
      pegang.setAttribute("aria-hidden", "true");
      pegang.title = "Seret untuk mengubah urutan";
      li.appendChild(pegang);
      const teks = el("div", "aleta-cmw-atur-teks");
      teks.appendChild(el("b", "", wd.judul));
      const kecil = el("small", "", tersedia ? wd.ket : `${wd.ket}.`);
      // Sebab saklarnya tidak dapat ditekan - penjelasan teknis (K5).
      if (!tersedia) kecil.appendChild(teknis(el("span", "", ` Saklar fitur ${wd.kode} di popup (Uji tampilan) masih mati.`)));
      teks.appendChild(kecil);
      li.appendChild(teks);
      const geser = el("span", "aleta-cmw-geser");
      const naik = tombol("", "↑", `Naikkan ${wd.judul}`, () => geserUrutan(id, -1), `atur-naik-${id}`);
      const turun = tombol("", "↓", `Turunkan ${wd.judul}`, () => geserUrutan(id, 1), `atur-turun-${id}`);
      naik.disabled = i === 0;
      turun.disabled = i === urutan.length - 1;
      geser.appendChild(naik);
      geser.appendChild(turun);
      li.appendChild(geser);
      // Butir 7: pisah / gabung dan kembalikan tinggi, per bagian.
      if (tersedia) {
        const lepas = terpisah(id);
        const pisah = tombol(
          "aleta-cmw-atur-pisah",
          lepas ? "⤓" : "⧉",
          lepas ? `Gabungkan ${wd.judul} kembali ke dok` : `Pisahkan ${wd.judul} menjadi jendela melayang sendiri`,
          () => (lepas ? gabungkan(id) : pisahkan(id)),
          `atur-pisah-${id}`
        );
        pisah.setAttribute("aria-pressed", lepas ? "true" : "false");
        li.appendChild(pisah);
        if (tinggiBagian(id)) {
          li.appendChild(tombol("aleta-cmw-atur-ukuran", "↺", `Kembalikan tinggi ${wd.judul} ke bawaan`, () => setelTinggi(id, 0), `atur-ukuran-${id}`));
        }
      }
      const nyala = tersedia && !mati.has(id);
      const saklar = tombol(
        "aleta-cmw-saklar",
        "",
        tersedia ? `${nyala ? "Sembunyikan" : "Tampilkan"} ${wd.judul} di dok` : `${wd.judul}: saklar fitur ${wd.kode} masih mati`,
        () => alihWidget(id),
        `atur-saklar-${id}`
      );
      saklar.setAttribute("role", "switch");
      saklar.setAttribute("aria-checked", nyala ? "true" : "false");
      saklar.disabled = !tersedia;
      li.appendChild(saklar);
      daftar.appendChild(li);
    });
    // Yang menyusul DISEBUT, dengan sebabnya - tanpa pegangan, tanpa urutan,
    // dan saklarnya tidak dapat ditekan.
    for (const wd of WIDGET.filter((x) => x.menyusul)) {
      const li = el("li", "aleta-cmw-atur-baris");
      li.setAttribute("data-widget", wd.id);
      li.setAttribute("data-menyusul", "ya");
      li.appendChild(el("span", "aleta-cmw-pegangan", ""));
      const teks = el("div", "aleta-cmw-atur-teks");
      const judul = el("b", "", wd.judul);
      judul.appendChild(el("span", "aleta-cmw-menyusul", "menyusul"));
      teks.appendChild(judul);
      teks.appendChild(teknis(el("small", "", wd.menyusul)));
      li.appendChild(teks);
      const saklar = el("button", "aleta-cmw-saklar");
      saklar.type = "button";
      saklar.disabled = true;
      saklar.setAttribute("role", "switch");
      saklar.setAttribute("aria-checked", "false");
      saklar.setAttribute("aria-label", `${wd.judul} - menyusul, belum dapat dinyalakan`);
      saklar.title = `${wd.judul} - menyusul: ${wd.menyusul}`;
      li.appendChild(saklar);
      daftar.appendChild(li);
    }
    pasangSeretAtur(daftar);
    w.isi.appendChild(daftar);
    // Butir 7: kelompok di dalam checklist - urutan, sembunyi, pisah, tinggi.
    w.isi.appendChild(susunAturKelompok());
    w.isi.appendChild(susunKeadaanTata());
    // K5: saklar penjelasan teknis - di UI Baru tempatnya di sini, bersama
    // setelan widget lainnya.
    const saklarTeknisAtur = susunSaklarTeknis();
    if (saklarTeknisAtur) w.isi.appendChild(saklarTeknisAtur);
    return w.kotak;
  }

  // ─── Perbaikan 1 Okt butir 7: TATA BAGIAN WIDGET (UI Baru saja) ───────────
  //
  // Tiap bagian widget - Checklist milestone, Catatan cepat, Lama sidang,
  // Kalender tenggat, dan kelompok di dalam checklist (Lewat tenggat, Hari
  // ini, Minggu ini) - dapat:
  //   disembunyikan   Atur widget (saklar), atau ⊘ di jendela melayang
  //   diubah tinggi   tarik garis di kaki bagian; papan tik: fokus garisnya
  //                   lalu panah atas/bawah, Home = tinggi bawaan; klik ganda
  //                   = tinggi bawaan; Atur widget: ↺
  //   dipindah urut   Atur widget: seret ⋮⋮ atau ↑ ↓
  //   DIPISAH         ⧉ di kepala bagian (atau Atur widget): menjadi jendela
  //                   melayang sendiri yang dapat digeser dari kepalanya dan
  //                   diubah tinggi/lebarnya; ⤓ menggabungkannya lagi ke dok
  //
  // PENYIMPANAN
  //   susunanWidget  (sudah ada) widget yang tampil dan urutannya di dok
  //   tataWidget     {bagian: {id: {tinggi?, lepas?: {x, y, lebar?}}},
  //                   kelompok: {urutan, mati}, serverPada, diubah, tertunda,
  //                   lokalSaja}
  //   Keduanya CADANGAN LOKAL. Yang menentukan adalah setelan AKUN di server:
  //   PUT /aleta/api/aleta-ecourt/ekstensi/setelan, kunci "widget.tata",
  //   nilai {susunan, bagian, kelompok}. Bacaannya menumpang singgahan
  //   tampilan yang diambil panel-alat.js tiap lima menit (alatSetelanTersinggah)
  //   - tidak ada permintaan baca tambahan - jadi susunan yang sama berlaku di
  //   PC mana pun akun itu masuk. Jendela melayang disimpan dalam PECAHAN
  //   layar (0..1): layar tiap PC berbeda ukurannya.
  //
  // ATURAN SINKRON (sinkronTata)
  //   server tidak diketahui          cadangan lokal dipakai apa adanya
  //   ada perubahan tertunda          dikirim (yang terakhir diubah menang)
  //   server lebih baru dari yang     diambil ke cadangan lokal
  //   terakhir disepakati
  //   server kosong, padahal          cadangan itu milik akun lain di PC ini
  //   cadangan pernah disepakati      -> kembali ke susunan bawaan
  //   mode latihan / mode kering      perubahan disimpan di peramban ini saja
  //                                   (lokalSaja) dan tidak pernah dikirim
  //   mode coba                       setelan pribadi BOLEH (ALETA_COBA_BOLEH)
  //   gagal / tanpa sesi              tetap tertunda; dikirim lagi pada
  //                                   kesempatan berikutnya

  let jamKirimTata = null;
  let kirimTataBerjalan = false;

  function idBagianSah() {
    return [...WIDGET.filter((w) => !w.menyusul).map((w) => w.id), ...KELOMPOK.map((k) => `kel-${k.kunci}`)];
  }

  function judulBagian(id) {
    const w = WIDGET.find((x) => x.id === id);
    if (w) return w.judul;
    const k = KELOMPOK.find((x) => `kel-${x.kunci}` === id);
    return k ? k.judul : id;
  }

  function jepitAngka(n, min, maks) {
    return Math.min(Math.max(n, min), maks);
  }

  function tataBersih(x) {
    const o = objek(x);
    const sah = new Set(idBagianSah());
    const bagian = {};
    for (const [id, isi] of Object.entries(objek(o.bagian))) {
      if (!sah.has(id)) continue;
      const b = objek(isi);
      const hasil = {};
      const t = Number(b.tinggi);
      if (Number.isFinite(t) && t > 0) hasil.tinggi = Math.round(jepitAngka(t, TINGGI_MIN, TINGGI_MAKS));
      if (b.lepas && typeof b.lepas === "object") {
        const lx = Number(b.lepas.x);
        const ly = Number(b.lepas.y);
        if (Number.isFinite(lx) && Number.isFinite(ly)) {
          hasil.lepas = { x: jepitAngka(lx, 0, 1), y: jepitAngka(ly, 0, 1) };
          const lebar = Number(b.lepas.lebar);
          if (Number.isFinite(lebar) && lebar > 0) hasil.lepas.lebar = Math.round(jepitAngka(lebar, LEBAR_LEPAS_MIN, LEBAR_LEPAS_MAKS));
        }
      }
      if (hasil.tinggi !== undefined || hasil.lepas) bagian[id] = hasil;
    }
    const kunciKel = KELOMPOK.map((k) => k.kunci);
    const kel = objek(o.kelompok);
    const daftar = (d) => (Array.isArray(d) ? [...new Set(d.filter((k) => kunciKel.includes(k)))] : []);
    return {
      bagian,
      kelompok: { urutan: daftar(kel.urutan), mati: daftar(kel.mati) },
      serverPada: typeof o.serverPada === "string" ? o.serverPada : "",
      diubah: Number(o.diubah) || 0,
      tertunda: o.tertunda === true,
      lokalSaja: typeof o.lokalSaja === "string" ? o.lokalSaja : "",
    };
  }

  function tataBagian(id) {
    return objek(keadaan.tata.bagian[id]);
  }

  /** Bagian ini sedang di jendela melayangnya sendiri? Hanya UI Baru. */
  function terpisah(id) {
    return modern() && Boolean(tataBagian(id).lepas);
  }

  function tinggiBagian(id) {
    return modern() ? Number(tataBagian(id).tinggi) || 0 : 0;
  }

  function urutanKelompok() {
    const urutan = [...new Set([...keadaan.tata.kelompok.urutan, ...KELOMPOK.map((k) => k.kunci)])];
    return urutan.map((k) => KELOMPOK.find((x) => x.kunci === k)).filter(Boolean);
  }

  function kelompokMati(kunci) {
    return modern() && keadaan.tata.kelompok.mati.includes(kunci);
  }

  /** "latihan" | "kering" | "" - perubahan yang tidak boleh dikirim ke server. */
  function hanyaLokal() {
    try {
      if (typeof alatLatihanNyala === "function" && alatLatihanNyala()) return "latihan";
    } catch {
      /* tanpa panel-alat.js: tidak ada latihan */
    }
    try {
      if (typeof alatKeringNyala === "function" && alatKeringNyala()) return "kering";
    } catch {
      /* tanpa panel-alat.js: tidak ada mode kering */
    }
    return "";
  }

  /** Mencatat bahwa tata (atau susunan dok) baru diubah pengguna di sini. */
  function catatTataBerubah(t) {
    const lokal = hanyaLokal();
    keadaan.tata = { ...tataBersih(t || keadaan.tata), diubah: Date.now(), tertunda: !lokal, lokalSaja: lokal };
    if (lokal) {
      keadaan.sinkronTata = { status: "lokal", pada: Date.now(), pesan: lokal === "latihan" ? "mode latihan" : "mode kering" };
    }
    tulis({ [KUNCI_TATA]: keadaan.tata });
    if (!lokal) jadwalkanKirimTata(TATA_KIRIM_JEDA_MS);
  }

  function ubahTata(ubah) {
    if (!modern()) return;
    const t = tataBersih(keadaan.tata);
    ubah(t);
    catatTataBerubah(t);
    gambar();
  }

  function ubahBagian(t, id, ubah) {
    const b = { ...objek(t.bagian[id]) };
    ubah(b);
    if (b.tinggi === undefined && !b.lepas) delete t.bagian[id];
    else t.bagian[id] = b;
  }

  function setelTinggi(id, px) {
    ubahTata((t) =>
      ubahBagian(t, id, (b) => {
        if (px > 0) b.tinggi = Math.round(jepitAngka(px, TINGGI_MIN, TINGGI_MAKS));
        else delete b.tinggi;
      })
    );
  }

  /** Letak awal jendela melayang: bertangga, supaya yang baru tidak menutupi yang lama. */
  function letakLepasAwal() {
    const n = Object.values(keadaan.tata.bagian).filter((b) => b && b.lepas).length;
    return { x: jepitAngka(0.32 + 0.03 * n, 0, 0.9), y: jepitAngka(0.12 + 0.05 * n, 0, 0.9) };
  }

  function pisahkan(id) {
    ubahTata((t) =>
      ubahBagian(t, id, (b) => {
        b.lepas = letakLepasAwal();
      })
    );
    fokuskanLepas(`gabung-${id}`);
  }

  function gabungkan(id) {
    ubahTata((t) =>
      ubahBagian(t, id, (b) => {
        delete b.lepas;
      })
    );
    fokuskan(`pisah-${id}`);
  }

  /** ⊘ di jendela melayang - tampil lagi lewat Atur widget. */
  function sembunyikanBagian(id) {
    if (id.startsWith("kel-")) {
      const k = id.slice(4);
      ubahTata((t) => {
        if (!t.kelompok.mati.includes(k)) t.kelompok.mati.push(k);
      });
      return;
    }
    const s = susunanAktif();
    if (!s.mati.includes(id)) simpanSusunan({ urutan: urutanWidget(), mati: [...s.mati, id] });
  }

  function alihKelompok(k) {
    ubahTata((t) => {
      t.kelompok.mati = t.kelompok.mati.includes(k) ? t.kelompok.mati.filter((x) => x !== k) : [...t.kelompok.mati, k];
    });
  }

  function geserKelompok(k, arah) {
    const urutan = urutanKelompok().map((x) => x.kunci);
    const i = urutan.indexOf(k);
    const j = i + arah;
    if (i < 0 || j < 0 || j >= urutan.length) return;
    [urutan[i], urutan[j]] = [urutan[j], urutan[i]];
    ubahTata((t) => {
      t.kelompok.urutan = urutan;
    });
  }

  // ── Sinkron dengan setelan akun ──

  function waktuIso(x) {
    const t = Date.parse(String(x || ""));
    return Number.isFinite(t) ? t : 0;
  }

  /** undefined (tidak diketahui) | null (akun ini belum punya) | {nilai, diubahPada}. */
  function tataServer() {
    try {
      return typeof alatSetelanTersinggah === "function" ? alatSetelanTersinggah(SETELAN_TATA) : undefined;
    } catch {
      return undefined;
    }
  }

  function nilaiTataServer() {
    return { susunan: keadaan.susunan, bagian: keadaan.tata.bagian, kelompok: keadaan.tata.kelompok };
  }

  function adopsiTata(s) {
    const n = objek(s && s.nilai);
    keadaan.tata = {
      ...tataBersih({ bagian: n.bagian, kelompok: n.kelompok }),
      serverPada: s ? String(s.diubahPada || "") : "",
      diubah: Date.now(),
      tertunda: false,
      lokalSaja: "",
    };
    keadaan.susunan = susunanBersih(n.susunan);
    keadaan.sinkronTata = { status: s ? "diambil" : "bawaan", pada: Date.now(), pesan: "" };
    tulis({ [KUNCI_TATA]: keadaan.tata, [KUNCI_SUSUNAN]: keadaan.susunan });
    gambar();
  }

  function sinkronTata() {
    if (!keadaan.siap || !modern()) return;
    const t = keadaan.tata;
    if (t.tertunda) {
      // Perubahan di PC ini yang belum terkirim menang - itulah tindakan
      // terakhir orangnya. Dicoba walau server belum terbaca: gagal berarti
      // tetap tertunda, tidak ada yang hilang.
      if (!jamKirimTata && document.visibilityState !== "hidden") jadwalkanKirimTata(200);
      return;
    }
    const s = tataServer();
    if (s === undefined) return;
    if (s) {
      if (waktuIso(s.diubahPada) > waktuIso(t.serverPada)) adopsiTata(s);
      return;
    }
    if (t.serverPada && !t.lokalSaja) adopsiTata(null);
  }

  function jadwalkanKirimTata(ms) {
    if (jamKirimTata) clearTimeout(jamKirimTata);
    jamKirimTata = setTimeout(() => {
      jamKirimTata = null;
      void kirimTata();
    }, ms);
  }

  async function kirimTata() {
    if (!modern() || !keadaan.tata.tertunda || kirimTataBerjalan) return;
    const lokal = hanyaLokal();
    if (lokal) {
      keadaan.tata = { ...keadaan.tata, tertunda: false, lokalSaja: lokal };
      keadaan.sinkronTata = { status: "lokal", pada: Date.now(), pesan: lokal === "latihan" ? "mode latihan" : "mode kering" };
      tulis({ [KUNCI_TATA]: keadaan.tata });
      if (keadaan.aturTerbuka) gambar();
      return;
    }
    kirimTataBerjalan = true;
    const diubahSaatKirim = keadaan.tata.diubah;
    const nilai = nilaiTataServer();
    keadaan.sinkronTata = { status: "mengirim", pada: Date.now(), pesan: "" };
    try {
      let jawab;
      try {
        jawab = await fetch(ALAMAT_SETELAN, {
          method: "PUT",
          credentials: "include",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kunci: SETELAN_TATA, nilai }),
        });
      } catch (galat) {
        keadaan.sinkronTata = { status: "gagal", pada: Date.now(), pesan: "server tidak terjangkau" };
        catat("tata widget belum tersimpan di server", kalimatPertama(galat && galat.message));
        return;
      }
      if (!jawab.ok) {
        const pesan = await pesanDariJawaban(jawab);
        if (jawab.status === 423) {
          // Ditahan penahan panel-alat.js (latihan / kering) - tetap di peramban.
          keadaan.tata = { ...keadaan.tata, tertunda: false, lokalSaja: "ditahan" };
          keadaan.sinkronTata = { status: "lokal", pada: Date.now(), pesan: pesan || "ditahan" };
          tulis({ [KUNCI_TATA]: keadaan.tata });
        } else if (jawab.status === 400) {
          // Ditolak server: mengirim ulang nilai yang sama tidak menolong.
          keadaan.tata = { ...keadaan.tata, tertunda: false };
          keadaan.sinkronTata = { status: "gagal", pada: Date.now(), pesan: pesan || "ditolak server" };
          tulis({ [KUNCI_TATA]: keadaan.tata });
        } else {
          keadaan.sinkronTata = {
            status: "gagal",
            pada: Date.now(),
            pesan: jawab.status === 401 ? "belum masuk portal ALETA" : `server menjawab ${jawab.status}`,
          };
        }
        catat(`tata widget belum tersimpan di server (${jawab.status})`, pesan);
        return;
      }
      let d = {};
      try {
        const isi = await jawab.json();
        d = objek(isi && isi.data ? isi.data : isi);
      } catch {
        d = {};
      }
      const pada = String(d.diubahPada || "");
      const masihSama = keadaan.tata.diubah === diubahSaatKirim;
      keadaan.tata = { ...keadaan.tata, serverPada: pada || keadaan.tata.serverPada, tertunda: !masihSama, lokalSaja: "" };
      keadaan.sinkronTata = { status: "tersimpan", pada: Date.now(), pesan: "" };
      tulis({ [KUNCI_TATA]: keadaan.tata });
      if (pada && typeof alatCatatSetelanTersinggah === "function") {
        void alatCatatSetelanTersinggah(SETELAN_TATA, "nilai" in d ? d.nilai : nilai, pada);
      }
      if (!masihSama) jadwalkanKirimTata(TATA_KIRIM_JEDA_MS);
    } finally {
      kirimTataBerjalan = false;
      if (keadaan.aturTerbuka) gambar();
    }
  }

  // ── Kendali tiap bagian: ⧉ / ⤓ ⊘ di kepala, garis tarik di kaki ──

  function jepitTinggi(px) {
    return Math.round(jepitAngka(px, TINGGI_MIN, Math.min(TINGGI_MAKS, Math.max((window.innerHeight || TINGGI_MAKS) - 40, TINGGI_MIN))));
  }

  /** Tinggi diterapkan ke wadah gulung bagian (bukan ke kotaknya): kepala tetap terlihat. */
  function terapkanTinggi(sasaran, px) {
    if (!sasaran || !sasaran.style) return;
    if (!px) {
      for (const k of ["height", "max-height", "flex", "overflow-y"]) sasaran.style.removeProperty(k);
      return;
    }
    sasaran.style.height = `${px}px`;
    sasaran.style.maxHeight = "none";
    sasaran.style.flex = "none";
    sasaran.style.overflowY = "auto";
    const panel = typeof sasaran.closest === "function" ? sasaran.closest(".aleta-cm") : null;
    if (panel) panel.style.maxHeight = "none";
  }

  function sasaranTinggi(kotak, id) {
    if (id === "checklist") return kotak.querySelector(".aleta-cm-isi") || kotak.querySelector(".aleta-cm-badan");
    return kotak.querySelector(":scope > .aleta-cmw-isi") || kotak.querySelector(".aleta-cmw-isi");
  }

  /**
   * Garis tarik di kaki bagian. Ditarik: tinggi berubah langsung, disimpan
   * saat dilepas. Dalam jendela melayang tarikan ke samping mengubah
   * lebarnya juga. Peristiwanya tidak diteruskan - menarik bukan menggeser dok.
   */
  function pasangTarik(kotak, id, sasaran, judul) {
    if (!modern() || !kotak || !sasaran) return;
    const t = tinggiBagian(id);
    const garis = el("div", "aleta-cmw-tarik");
    garis.setAttribute("role", "separator");
    garis.setAttribute("aria-orientation", "horizontal");
    garis.setAttribute("aria-label", `Ubah tinggi ${judul}`);
    garis.setAttribute("aria-valuemin", String(TINGGI_MIN));
    garis.setAttribute("aria-valuemax", String(TINGGI_MAKS));
    if (t) garis.setAttribute("aria-valuenow", String(t));
    garis.setAttribute("data-tarik", id);
    garis.setAttribute("data-fokus", `tarik-${id}`);
    garis.tabIndex = 0;
    garis.title = `Tarik untuk mengubah tinggi ${judul}. Klik ganda atau Home: tinggi bawaan. Papan tik: panah atas/bawah.`;
    let tarik = null;
    garis.addEventListener("pointerdown", (e) => {
      if (typeof e.button === "number" && e.button !== 0) return;
      e.stopPropagation();
      e.preventDefault();
      const ukur = sasaran.getBoundingClientRect();
      const ukurKotak = kotak.getBoundingClientRect();
      tarik = {
        x: e.clientX,
        y: e.clientY,
        tinggi: tinggiBagian(id) || Math.round(ukur.height) || TINGGI_MIN,
        lebar: Math.round(ukurKotak.width) || 0,
        nilai: 0,
        lebarBaru: 0,
      };
      garis.setAttribute("data-ditarik", "ya");
      try {
        if (e.pointerId !== undefined) garis.setPointerCapture(e.pointerId);
      } catch {
        /* tanpa tangkapan, tarikan tetap berjalan selama penunjuk di atas garis */
      }
    });
    garis.addEventListener("pointermove", (e) => {
      if (!tarik) return;
      e.stopPropagation();
      tarik.nilai = jepitTinggi(tarik.tinggi + (e.clientY - tarik.y));
      terapkanTinggi(sasaran, tarik.nilai);
      if (terpisah(id) && tarik.lebar) {
        tarik.lebarBaru = Math.round(jepitAngka(tarik.lebar + (e.clientX - tarik.x), LEBAR_LEPAS_MIN, LEBAR_LEPAS_MAKS));
        kotak.style.width = `${tarik.lebarBaru}px`;
      }
    });
    const selesai = (e) => {
      if (!tarik) return;
      if (e) e.stopPropagation();
      const x = tarik;
      tarik = null;
      garis.removeAttribute("data-ditarik");
      if (!x.nilai && !x.lebarBaru) return;
      ubahTata((tt) =>
        ubahBagian(tt, id, (b) => {
          if (x.nilai) b.tinggi = x.nilai;
          if (x.lebarBaru && b.lepas) b.lepas = { ...b.lepas, lebar: x.lebarBaru };
        })
      );
    };
    garis.addEventListener("pointerup", selesai);
    garis.addEventListener("pointercancel", selesai);
    garis.addEventListener("dblclick", (e) => {
      e.stopPropagation();
      setelTinggi(id, 0);
    });
    garis.addEventListener("keydown", (e) => {
      const kini = tinggiBagian(id) || Math.round(sasaran.getBoundingClientRect().height) || TINGGI_MIN * 2;
      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        setelTinggi(id, jepitTinggi(kini + (e.key === "ArrowUp" ? -TINGGI_LANGKAH : TINGGI_LANGKAH)));
      } else if (e.key === "Home") {
        e.preventDefault();
        setelTinggi(id, 0);
      }
    });
    kotak.appendChild(garis);
  }

  /** Kendali kepala (⧉ di dok; ⤓ ⊘ di jendela melayang) dan garis tarik satu bagian. */
  function pasangKendaliBagian(kotak, id, lepas) {
    if (!modern() || !kotak) return;
    const judul = judulBagian(id);
    const kepala = kotak.querySelector(":scope > .aleta-cm-kepala, :scope > .aleta-cmw-kepala");
    if (kepala) {
      let alat = kepala.querySelector(":scope > .aleta-cm-alat");
      if (!alat) {
        alat = el("span", "aleta-cm-alat");
        kepala.appendChild(alat);
      }
      const kendali = lepas
        ? [
            tombol("aleta-cmw-gabung", "⤓", `Gabungkan ${judul} kembali ke dok`, () => gabungkan(id), `gabung-${id}`),
            tombol(
              "aleta-cmw-sembunyi",
              "⊘",
              `Sembunyikan ${judul} - tampilkan lagi lewat ⚙ Atur widget`,
              () => sembunyikanBagian(id),
              `sembunyi-${id}`
            ),
          ]
        : [tombol("aleta-cmw-pisah", "⧉", `Pisahkan ${judul} menjadi jendela melayang sendiri`, () => pisahkan(id), `pisah-${id}`)];
      const sebelum = alat.querySelector(":scope > .aleta-cm-segar, :scope > .aleta-cm-kecilkan");
      for (const t of kendali) alat.insertBefore(t, sebelum || null);
    }
    const sasaran = sasaranTinggi(kotak, id);
    terapkanTinggi(sasaran, tinggiBagian(id));
    pasangTarik(kotak, id, sasaran, judul);
  }

  /** Kelompok checklist di jendelanya sendiri: kartu yang sama, kepala widget. */
  function susunKelompokLepas(k) {
    const def = KELOMPOK.find((x) => x.kunci === k);
    const data = keadaan.data;
    const w = kotakWidget(`kel-${k}`, def ? def.judul : k);
    w.kotak.classList.add(`aleta-cm-kelompok-${k}`, "aleta-cmw-kelompok-lepas");
    if (!data) {
      w.isi.appendChild(el("div", "aleta-cmw-ket", "Menunggu checklist dari portal…"));
      return w.kotak;
    }
    const h = hitunganTampil(data);
    const jumlah = { lewat: h.lewat, "hari-ini": h.hariIni, "minggu-ini": h.mingguIni }[k] || 0;
    const tombolJudul = w.kepala.querySelector(".aleta-lipat-kepala") || w.kepala;
    tombolJudul.appendChild(el("span", "aleta-cm-hitung", jumlah));
    const daftar = butirTampil(data).filter((b) => b.kelompok === k);
    if (!daftar.length) {
      w.isi.appendChild(el("div", "aleta-cmw-ket", "Tidak ada pekerjaan di kelompok ini."));
      return w.kotak;
    }
    const ul = el("ul", "aleta-cm-daftar");
    for (const b of daftar) ul.appendChild(susunButir(b));
    w.isi.appendChild(ul);
    return w.kotak;
  }

  /** Kelompok yang DISEMBUNYIKAN tetapi berisi tugas disebut di checklist - tidak hilang diam-diam. */
  function susunCatatanKelompok(jumlah) {
    const kotak = el("div", "aleta-cmw-bagian-lain");
    for (const k of KELOMPOK) {
      const n = Number(jumlah[k.kunci]) || 0;
      if (!kelompokMati(k.kunci) || n === 0) continue;
      const baris = el("div", "aleta-cmw-bagian-lain-baris");
      baris.setAttribute("data-kelompok-sembunyi", k.kunci);
      baris.appendChild(el("span", "", `${k.judul} (${n}) disembunyikan`));
      baris.appendChild(
        tombol("aleta-cmw-tombol aleta-cmw-tombol-kecil", "Tampilkan", `Tampilkan lagi ${k.judul} di checklist`, () => alihKelompok(k.kunci), `kel-tampil-${k.kunci}`)
      );
      kotak.appendChild(baris);
    }
    return kotak.childNodes.length ? kotak : null;
  }

  // ── Jendela melayang ──

  function idTerpisah() {
    if (!modern()) return [];
    const atas = widgetTampil().filter((id) => terpisah(id));
    // Kelompok hanya bila checklistnya sendiri tampil (bukan disembunyikan dari dok).
    const checklistAda = widgetTampil().includes("checklist");
    const kel = checklistAda
      ? urutanKelompok()
          .filter((k) => !kelompokMati(k.kunci) && terpisah(`kel-${k.kunci}`))
          .map((k) => `kel-${k.kunci}`)
      : [];
    return [...atas, ...kel];
  }

  function terapkanLetakLepas(kotak, id) {
    if (!kotak || !id) return;
    const l = objek(tataBagian(id).lepas);
    const vw = window.innerWidth || 0;
    const vh = window.innerHeight || 0;
    const lebar = Math.min(Number(l.lebar) || 348, Math.max(vw - 2 * TEPI, LEBAR_LEPAS_MIN));
    kotak.style.position = "fixed";
    kotak.style.width = `${Math.round(lebar)}px`;
    const kiri = jepitAngka((Number(l.x) || 0) * vw, 0, Math.max(vw - lebar, 0));
    const atas = jepitAngka((Number(l.y) || 0) * vh, 0, Math.max(vh - 40, 0));
    kotak.style.left = `${Math.round(kiri)}px`;
    kotak.style.top = `${Math.round(atas)}px`;
  }

  /** Geser jendela melayang dari kepalanya; letaknya disimpan saat dilepas. */
  function pasangGeserLepas(wadahLepas) {
    let g = null;
    wadahLepas.addEventListener("pointerdown", (e) => {
      if (typeof e.button === "number" && e.button !== 0) return;
      const t = e.target && typeof e.target.closest === "function" ? e.target : null;
      if (!t) return;
      const kepala = t.closest(".aleta-cm-kepala, .aleta-cmw-kepala");
      if (!kepala || t.closest("button, a, select, input, textarea, summary")) return;
      const kotak = kepala.closest("[data-lepasan]");
      if (!kotak) return;
      g = {
        kotak,
        id: kotak.getAttribute("data-lepasan"),
        x: e.clientX,
        y: e.clientY,
        kiri: parseFloat(kotak.style.left) || 0,
        atas: parseFloat(kotak.style.top) || 0,
        pindah: false,
      };
      try {
        if (e.pointerId !== undefined) kepala.setPointerCapture(e.pointerId);
      } catch {
        /* tanpa tangkapan, geser tetap berjalan selama penunjuk di atas jendela */
      }
    });
    wadahLepas.addEventListener("pointermove", (e) => {
      if (!g) return;
      const dx = e.clientX - g.x;
      const dy = e.clientY - g.y;
      if (!g.pindah && Math.abs(dx) <= AMBANG_GESER && Math.abs(dy) <= AMBANG_GESER) return;
      if (!g.pindah) g.kotak.setAttribute("data-digeser", "ya");
      g.pindah = true;
      const r = g.kotak.getBoundingClientRect();
      const vw = window.innerWidth || 0;
      const vh = window.innerHeight || 0;
      g.kotak.style.left = `${Math.round(jepitAngka(g.kiri + dx, 0, Math.max(vw - (r.width || 0), 0)))}px`;
      g.kotak.style.top = `${Math.round(jepitAngka(g.atas + dy, 0, Math.max(vh - 40, 0)))}px`;
    });
    const selesai = () => {
      if (!g) return;
      const x = g;
      g = null;
      x.kotak.removeAttribute("data-digeser");
      if (!x.pindah) return;
      const vw = window.innerWidth || 1;
      const vh = window.innerHeight || 1;
      ubahTata((t) =>
        ubahBagian(t, x.id, (b) => {
          b.lepas = {
            ...objek(b.lepas),
            x: (parseFloat(x.kotak.style.left) || 0) / vw,
            y: (parseFloat(x.kotak.style.top) || 0) / vh,
          };
        })
      );
    };
    wadahLepas.addEventListener("pointerup", selesai);
    wadahLepas.addEventListener("pointercancel", selesai);
  }

  /**
   * Wadah jendela melayang: saudara .aleta-cm-wadah di dalam bayangan yang
   * sama (senyap, cetak, layar publik, dan tema ikut dengan sendirinya).
   * Hanya lahir bila ada yang dipisah - dalam Lama dan Baru tidak pernah.
   */
  function gambarLepasan() {
    if (!bayang) return;
    const daftar = idTerpisah();
    let wadahLepas = bayang.querySelector(".aleta-cmw-lepas-wadah");
    if (!daftar.length) {
      if (wadahLepas) wadahLepas.remove();
      return;
    }
    if (!wadahLepas) {
      wadahLepas = el("div", "aleta-cmw-lepas-wadah");
      wadahLepas.setAttribute("data-tema", keadaan.tema);
      bayang.appendChild(wadahLepas);
      pasangGeserLepas(wadahLepas);
      try {
        if (typeof alatPasangPetunjuk === "function") alatPasangPetunjuk(wadahLepas);
      } catch {
        /* tanpa petunjuk, title bawaan peramban tetap ada */
      }
    }
    wadahLepas.textContent = "";
    for (const id of daftar) {
      const kotak = id.startsWith("kel-") ? susunKelompokLepas(id.slice(4)) : susunWidget(id);
      if (!kotak) continue;
      kotak.classList.add("aleta-cmw-lepasan");
      kotak.setAttribute("data-lepasan", id);
      pasangKendaliBagian(kotak, id, true);
      wadahLepas.appendChild(kotak);
      terapkanLetakLepas(kotak, id);
    }
    lipatPanjang(wadahLepas);
  }

  function fokuskanLepas(kunci) {
    if (!bayang) return;
    const sasaran = bayang.querySelector(`.aleta-cmw-lepas-wadah [data-fokus="${kunci}"]`);
    try {
      if (sasaran) sasaran.focus({ preventScroll: true });
    } catch {
      /* fokus hanya kemudahan papan tik */
    }
  }

  // ── Atur widget: kelompok checklist dan keadaan simpan ──

  function susunAturKelompok() {
    const kotak = el("div", "aleta-cmw-atur-kel");
    kotak.appendChild(el("div", "aleta-cmw-atur-sub", "Bagian di dalam Checklist milestone"));
    const daftar = el("ul", "aleta-cmw-atur-daftar");
    const urutan = urutanKelompok();
    urutan.forEach((k, i) => {
      const id = `kel-${k.kunci}`;
      const li = el("li", "aleta-cmw-atur-kel-baris");
      li.setAttribute("data-kelompok-atur", k.kunci);
      const teks = el("div", "aleta-cmw-atur-teks");
      teks.appendChild(el("b", "", k.judul));
      teks.appendChild(el("small", "", terpisah(id) ? "di jendela melayang" : "di dalam checklist"));
      li.appendChild(teks);
      const geser = el("span", "aleta-cmw-geser");
      const naik = tombol("", "↑", `Naikkan ${k.judul}`, () => geserKelompok(k.kunci, -1), `atur-kel-naik-${k.kunci}`);
      const turun = tombol("", "↓", `Turunkan ${k.judul}`, () => geserKelompok(k.kunci, 1), `atur-kel-turun-${k.kunci}`);
      naik.disabled = i === 0;
      turun.disabled = i === urutan.length - 1;
      geser.appendChild(naik);
      geser.appendChild(turun);
      li.appendChild(geser);
      const lepas = terpisah(id);
      const pisah = tombol(
        "aleta-cmw-atur-pisah",
        lepas ? "⤓" : "⧉",
        lepas ? `Gabungkan ${k.judul} kembali ke checklist` : `Pisahkan ${k.judul} menjadi jendela melayang sendiri`,
        () => (lepas ? gabungkan(id) : pisahkan(id)),
        `atur-pisah-${id}`
      );
      pisah.setAttribute("aria-pressed", lepas ? "true" : "false");
      li.appendChild(pisah);
      if (tinggiBagian(id)) {
        li.appendChild(tombol("aleta-cmw-atur-ukuran", "↺", `Kembalikan tinggi ${k.judul} ke bawaan`, () => setelTinggi(id, 0), `atur-ukuran-${id}`));
      }
      const nyala = !kelompokMati(k.kunci);
      const saklar = tombol(
        "aleta-cmw-saklar",
        "",
        `${nyala ? "Sembunyikan" : "Tampilkan"} ${k.judul}`,
        () => alihKelompok(k.kunci),
        `atur-kel-saklar-${k.kunci}`
      );
      saklar.setAttribute("role", "switch");
      saklar.setAttribute("aria-checked", nyala ? "true" : "false");
      li.appendChild(saklar);
      daftar.appendChild(li);
    });
    kotak.appendChild(daftar);
    return kotak;
  }

  function susunKeadaanTata() {
    const t = keadaan.tata;
    const s = keadaan.sinkronTata;
    const server = tataServer();
    let teks;
    let nada = "tenang";
    if (t.lokalSaja === "latihan" || hanyaLokal() === "latihan") {
      teks = "Mode latihan: susunan disimpan di peramban ini saja, tidak dikirim ke server.";
      nada = "mendesak";
    } else if (t.lokalSaja === "kering" || hanyaLokal() === "kering") {
      teks = "Mode kering: susunan disimpan di peramban ini saja, tidak dikirim ke server.";
      nada = "mendesak";
    } else if (t.tertunda && s.status === "gagal") {
      teks = `Belum tersimpan di server (${s.pesan || "gagal"}). Tersimpan di peramban ini dan dikirim lagi otomatis.`;
      nada = "mendesak";
    } else if (t.tertunda) {
      teks = "Menyimpan ke akun Anda di server…";
    } else if (s.status === "gagal") {
      teks = `Tidak tersimpan di server: ${s.pesan || "gagal"}. Tersimpan di peramban ini.`;
      nada = "mendesak";
    } else if (t.serverPada) {
      teks = "Tersimpan di akun Anda - berlaku otomatis di PC mana pun Anda masuk.";
    } else if (server === undefined) {
      teks = "Server belum terbaca - memakai cadangan di peramban ini.";
    } else {
      teks = "Belum ada susunan di akun Anda; perubahan pertama disimpan ke server.";
    }
    const kotak = el("div", "aleta-cmw-ket aleta-cmw-sinkron", teks);
    kotak.setAttribute("data-nada", nada);
    kotak.setAttribute("role", "status");
    return kotak;
  }

  // ─── popup-9: menempel ke sudut terdekat ───────────────────────────────────

  function sudutAktif() {
    return fitur("popup-9") ? keadaan.sudut[JENIS] || "" : "";
  }

  function teksSudut() {
    return `Menempel ${sudutAktif().replace("-", " ")} · diingat untuk ${NAMA_SITUS[JENIS]}`;
  }

  /**
   * Sesudah digeser: menempel ke sudut layar yang paling dekat dengan titik
   * tengah widget, dan sudutnya diingat untuk situs ini saja. Widget yang
   * dilepas di tengah halaman tidak tertinggal menutupi tabel SIPP.
   */
  function tempelKeSudut() {
    if (!akar) return;
    const kotak = akar.getBoundingClientRect();
    const kiri = parseFloat(akar.style.left) || 0;
    const bawah = parseFloat(akar.style.bottom) || 0;
    const h = kiri + (kotak.width || 0) / 2 < (window.innerWidth || 0) / 2 ? "kiri" : "kanan";
    const v = bawah + (kotak.height || 0) / 2 < (window.innerHeight || 0) / 2 ? "bawah" : "atas";
    keadaan.sudut = { ...keadaan.sudut, [JENIS]: `${h}-${v}` };
    tulis({ [KUNCI_SUDUT]: keadaan.sudut });
    terapkanPosisi();
    gambar();
  }

  function kunciFokus() {
    try {
      const aktif = bayang && bayang.activeElement;
      return aktif && aktif.getAttribute ? aktif.getAttribute("data-fokus") || "" : "";
    } catch {
      return "";
    }
  }

  function fokuskan(kunci) {
    if (!kunci || !bayang) return;
    const sasaran = bayang.querySelector(`[data-fokus="${kunci}"]`);
    if (!sasaran || typeof sasaran.focus !== "function") return;
    try {
      sasaran.focus({ preventScroll: true });
    } catch {
      /* fokus hanya kemudahan papan tik */
    }
  }

  /**
   * Menggambar ulang seluruh isi widget. Isinya kecil, jadi disusun ulang
   * utuh - lebih sederhana dan lebih pasti daripada menambal. Fokus papan
   * tik dan gulungan daftar dipulihkan supaya penyegaran lima menitan tidak
   * mencabut tempat orang sedang membaca.
   */
  /* === CHECKLIST-POSISI 12 Okt === */
  //
  // KLIK YANG HILANG: "kadang saya klik minimize tidak mau minimize".
  //
  // Sebabnya bukan tombolnya, melainkan penggambaran ulang. gambar() membuang
  // seluruh isi wadah dan membuatnya lagi - dan itu terjadi sendiri di tengah
  // jalan: mengklik jendela yang baru kembali fokus memicu segarkan() (event
  // focus datang pada TEKANAN, sebelum tombol dilepas), penyegaran lima menit,
  // jawaban portal, tulisan tanda/susunan dari tab lain. Tombol yang ditekan
  // lalu dilepas ADALAH SIMPUL LAIN: peramban hanya mengirim click bila tekan
  // dan lepas jatuh pada simpul yang sama, jadi kliknya lenyap tanpa galat.
  //
  // Selama penunjuk masih menekan di dalam widget, penggambaran DITUNDA dan
  // dikerjakan sesudah dilepas (dan sesudah click-nya terkirim).
  const BATAS_TEKAN_MS = 5000;
  let tekanSejak = 0;
  let gambarTertunda = false;

  function sedangDitekan() {
    return tekanSejak > 0 && Date.now() - tekanSejak < BATAS_TEKAN_MS;
  }

  function mulaiTekan() {
    tekanSejak = Date.now();
  }

  function lepasTekan() {
    if (!tekanSejak) return;
    tekanSejak = 0;
    if (!gambarTertunda) return;
    // click menyusul pointerup secara sinkron; gambar ulang sesudahnya.
    setTimeout(() => {
      if (!gambarTertunda || sedangDitekan()) return;
      gambarTertunda = false;
      gambar();
    }, 0);
  }
  /* === AKHIR CHECKLIST-POSISI === */

  function gambar() {
    if (!bayang) return;
    const wadah = bayang.querySelector(".aleta-cm-wadah");
    if (!wadah) return;
    if (sedangDitekan()) {
      gambarTertunda = true;
      return;
    }
    gambarTertunda = false;
    const fokus = kunciFokus();
    const isiLama = wadah.querySelector(".aleta-cm-isi");
    const gulung = isiLama ? isiLama.scrollTop : 0;
    // Catatan yang sedang diketik: kotaknya dipakai ulang, tetapi dilepas dan
    // dipasang kembali - letak kursornya diingat dulu.
    const pilihanCatatan = catatanDisunting() ? [kotakCatatan.selectionStart, kotakCatatan.selectionEnd] : null;
    wadah.textContent = "";
    const kecil = sedangKecil();
    const mode = modeUji();
    // Lama: jalan yang sama persis seperti sebelum tahap 3.
    if (mode === "lama") wadah.appendChild(kecil ? susunPil() : susunPanel());
    else if (modern()) wadah.appendChild(susunDok(kecil));
    else wadah.appendChild(susunTumpukKlasik(kecil));
    // Perbaikan 30 Sep (Baru & UI Baru): pita pembaruan di atas widget
    // (butir 24) dan penjelasan panjang di balik ⓘ (butir 6).
    if (mode !== "lama") {
      tanyaPembaruan();
      if (infoPembaruan) wadah.insertBefore(susunPita(infoPembaruan), wadah.firstChild);
      lipatPanjang(wadah);
    }
    // Butir 7: bagian yang dipisah digambar di jendela melayangnya sendiri
    // (hanya UI Baru; di luar itu wadahnya dibuang bila ada).
    gambarLepasan();
    const isiBaru = wadah.querySelector(".aleta-cm-isi");
    if (isiBaru && gulung) isiBaru.scrollTop = gulung;
    fokuskan(fokus);
    if (pilihanCatatan && catatanDisunting()) {
      try {
        kotakCatatan.setSelectionRange(pilihanCatatan[0], pilihanCatatan[1]);
      } catch {
        /* letak kursor hanya kemudahan */
      }
    }
    if (mode !== "lama") {
      aturJamSidang();
      aturJamSd();
      aturSkorsPortal();
    }
  }

  // ─── Perbaikan 30 Sep: pita pembaruan (24) dan ⓘ (6) ─────────────────────
  //
  // Versinya dibaca dari SINGGAHAN yang diisi panel ALETA di halaman yang
  // sama (alatPembaruanTersedia dengan tanpaAmbil) - widget ini tidak pernah
  // menambah permintaan sendiri. Kliknya memakai
  // alatJalankanPembaruan yang sama dengan pita panel: minta pembaruan ke
  // Chrome, lalu muat ulang ekstensi dan halaman. Tanpa panel-alat.js (tidak
  // pernah terjadi di manifest ini) pitanya tidak ada.

  let infoPembaruan = null;
  let pembaruanDitanya = false;
  let pembaruanPada = 0;
  let paksaPembaruan = false;
  /** Singgahan yang masih kosong dibaca lagi paling cepat semenit sekali. */
  const JEDA_BACA_PITA_MS = 60 * 1000;

  function tanyaPembaruan() {
    if (typeof alatPembaruanTersedia !== "function") return;
    if (pembaruanDitanya && (infoPembaruan || Date.now() - pembaruanPada < JEDA_BACA_PITA_MS)) return;
    pembaruanDitanya = true;
    pembaruanPada = Date.now();
    Promise.resolve(alatPembaruanTersedia(false, { tanpaAmbil: true }))
      .then((info) => {
        const ada = Boolean(info && info.portal);
        const berubah = ada !== Boolean(infoPembaruan);
        infoPembaruan = ada ? info : null;
        if (berubah && akar && akar.isConnected) gambar();
      })
      .catch(() => {
        /* tanpa pita - widgetnya tetap utuh */
      });
  }

  function susunPita(info) {
    const teks =
      typeof alatTeksPita === "function"
        ? alatTeksPita(info)
        : { judul: `Pembaruan tersedia ${info.portal}`, ket: "klik untuk memperbarui" };
    const pita = el("button", "aleta-cm-pita");
    pita.type = "button";
    pita.setAttribute("role", "status");
    pita.title = `Versi ${info.portal} tersedia di server; yang terpasang ${info.terpasang}. Klik: minta pembaruan ke Chrome, lalu muat ulang ekstensi dan halaman ini.`;
    pita.appendChild(el("b", "", teks.judul));
    const ket = el("span", "aleta-cm-pita-ket", teks.ket);
    pita.appendChild(ket);
    pita.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (pita.disabled || typeof alatJalankanPembaruan !== "function") return;
      pita.disabled = true;
      const hasil = await alatJalankanPembaruan(paksaPembaruan, (t, buruk) => {
        ket.textContent = t;
        if (buruk) pita.setAttribute("data-buruk", "ya");
        else pita.removeAttribute("data-buruk");
      });
      paksaPembaruan = Boolean(hasil && hasil.perluPaksa);
      if (!(hasil && hasil.selesai)) pita.disabled = false;
    });
    return pita;
  }

  /**
   * Penjelasan panjang di widget (kotak kosong, alasan "menyusul" di Atur
   * widget) dilipat di balik ⓘ - kalimat pertamanya tetap tampil. Yang
   * memuat tombol atau tautan tidak pernah dilipat.
   */
  function lipatPanjang(wadah) {
    const BATAS = 90;
    for (const x of Array.from(wadah.querySelectorAll(".aleta-cm-kosong, .aleta-cmw-atur-teks small"))) {
      if (x.hidden || x.hasAttribute("data-cm-dilipat")) continue;
      if (x.querySelector("button, a[href], input, select, textarea")) continue;
      const teks = String(x.textContent || "").replace(/\s+/g, " ").trim();
      if (teks.length <= BATAS || !x.parentNode) continue;
      const ringkas =
        typeof alatRingkasPenjelasan === "function" ? alatRingkasPenjelasan(teks) : `${teks.slice(0, 64)}…`;
      // Penjelasan teknis yang dilipat: ⓘ-nya ikut tersembunyi (K5).
      const tombol = el("button", x.classList.contains("aleta-teknis") ? "aleta-cm-info aleta-teknis" : "aleta-cm-info");
      tombol.type = "button";
      tombol.setAttribute("aria-expanded", "false");
      tombol.title = "Tampilkan penjelasan lengkap";
      tombol.appendChild(el("b", "", "ⓘ"));
      const r = el("span", "", ringkas);
      tombol.appendChild(r);
      x.setAttribute("data-cm-dilipat", "ya");
      x.hidden = true;
      tombol.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const buka = x.hidden;
        x.hidden = !buka;
        r.hidden = buka;
        tombol.setAttribute("aria-expanded", buka ? "true" : "false");
      });
      x.parentNode.insertBefore(tombol, x);
    }
  }

  // ─── Tema dan posisi ───────────────────────────────────────────────────────

  function terapkanTema() {
    if (!akar) return;
    akar.setAttribute("data-tema", keadaan.tema);
    if (keadaan.warna) akar.setAttribute("data-warna", keadaan.warna);
    else akar.removeAttribute("data-warna");
    tandaiKulit(akar);
    tandaiTeknis(akar);
    // Petunjuk dua detik panel-alat.js membaca data-tema dari akar yang
    // dipasanginya - di sini wadah di dalam bayangan.
    const wadah = bayang && bayang.querySelector(".aleta-cm-wadah");
    if (wadah) wadah.setAttribute("data-tema", keadaan.tema);
  }

  /**
   * Kulit Modern mengikuti penanda <html data-aleta-kulit="modern"> yang
   * dipasang panel-alat.js (alatTandaiUji). Tanpa penanda itu atributnya
   * dilepas - tampilan Lama dan Baru tetap berkulit Klasik.
   */
  function tandaiKulit(inang) {
    if (!inang) return;
    if (document.documentElement.getAttribute("data-aleta-kulit") === "modern") inang.setAttribute("data-kulit", "modern");
    else inang.removeAttribute("data-kulit");
  }

  /**
   * Penjelasan teknis (K5) mengikuti <html data-aleta-teknis="sembunyi"> yang
   * dipasang panel-alat.js (alatTandaiTeknis) - aturan panel.css tidak
   * menembus Shadow DOM, jadi akarnya diberi tanda sendiri. Lama: tidak pernah.
   */
  function tandaiTeknis(inang) {
    if (!inang) return;
    if (document.documentElement.getAttribute("data-aleta-teknis") === "sembunyi") inang.setAttribute("data-teknis", "sembunyi");
    else inang.removeAttribute("data-teknis");
  }

  /** Dijepit ke layar, dengan ukuran yang SUDAH berlaku. */
  function jepit(kiri, bawah) {
    const kotak = akar ? akar.getBoundingClientRect() : { width: 0, height: 0 };
    const maksKiri = Math.max((window.innerWidth || 0) - Math.max(kotak.width || 0, 40), 0);
    const maksBawah = Math.max((window.innerHeight || 0) - Math.max(kotak.height || 0, 40), 0);
    return {
      kiri: Math.min(Math.max(kiri, 0), maksKiri),
      bawah: Math.min(Math.max(bawah, 0), maksBawah),
    };
  }

  /**
   * Dijangkarkan ke KIRI BAWAH, bukan kiri atas: widget ini tumbuh dan
   * menyusut (pil, kelompok yang dibuka), dan yang dijangkarkan ke bawah
   * tumbuh ke atas - kakinya tetap di tempat yang dipilih orang.
   */
  function terapkanPosisi() {
    if (!akar) return;
    // popup-9: sudut yang diingat untuk situs ini menang atas posisi bebas.
    const sudut = sudutAktif();
    if (sudut) {
      const [h, v] = sudut.split("-");
      akar.style.left = h === "kiri" ? `${TEPI}px` : "auto";
      akar.style.right = h === "kanan" ? `${TEPI}px` : "auto";
      akar.style.bottom = v === "bawah" ? `${TEPI}px` : "auto";
      akar.style.top = v === "atas" ? `${TEPI}px` : "auto";
      return;
    }
    const p = keadaan.posisi;
    const aman = p && Number.isFinite(p.kiri) ? jepit(p.kiri, p.bawah) : { kiri: TEPI, bawah: TEPI };
    akar.style.left = `${Math.round(aman.kiri)}px`;
    akar.style.bottom = `${Math.round(aman.bawah)}px`;
    akar.style.top = "auto";
    akar.style.right = "auto";
  }

  function simpanPosisi() {
    const p = keadaan.posisi || {};
    const isi = { kecil: sedangKecil() };
    if (Number.isFinite(p.kiri) && Number.isFinite(p.bawah)) {
      isi.kiri = p.kiri;
      isi.bawah = p.bawah;
    }
    tulis({ [KUNCI_POSISI]: isi });
  }

  function setelKecil(kecil) {
    keadaan.posisi = { ...(keadaan.posisi || {}), kecil };
    simpanPosisi();
    gambar();
    terapkanPosisi();
    fokuskan(kecil ? (lencanaDipakai() ? "lencana" : "pil") : modern() ? "lencana" : "kecilkan");
  }

  function setelLipatan(kunci, buka) {
    keadaan.lipatan = { ...keadaan.lipatan, [kunci]: buka };
    tulis({ [KUNCI_LIPATAN]: keadaan.lipatan });
    gambar();
  }

  /**
   * Geser dari kepala (panel terbentang) atau dari pil. Tombol, pilihan
   * peran, dan tautan di kepala tidak ikut menggeser - yang menekan tombol
   * tutup tidak sedang memindahkan widget.
   */
  function pasangGeser(wadah) {
    let geser = null;
    wadah.addEventListener("pointerdown", (e) => {
      if (typeof e.button === "number" && e.button !== 0) return;
      const sasaran = e.target && typeof e.target.closest === "function" ? e.target : null;
      if (!sasaran) return;
      const pegangan = sasaran.closest("[data-geser]");
      if (!pegangan) return;
      // Pil dan lencana tombol SEKALIGUS pegangan; tombol lain tidak menggeser.
      if (!sasaran.closest(".aleta-cm-pil, .aleta-cmw-lencana") && sasaran.closest("button, a, select, input, textarea, summary")) {
        return;
      }
      abaikanKlikPil = false;
      // Widget yang menempel di sudut kanan atau atas (popup-9) berjangkar
      // right/top - titik awalnya dibaca dari kotaknya, bukan dari left/bottom
      // yang "auto". Di luar itu jalannya sama dengan sebelumnya.
      const kiriGaya = parseFloat(akar.style.left);
      const bawahGaya = parseFloat(akar.style.bottom);
      const kotak = Number.isFinite(kiriGaya) && Number.isFinite(bawahGaya) ? null : akar.getBoundingClientRect();
      geser = {
        x: e.clientX,
        y: e.clientY,
        kiri: kotak ? kotak.left || 0 : kiriGaya || 0,
        bawah: kotak ? Math.max((window.innerHeight || 0) - (kotak.bottom || 0), 0) : bawahGaya || 0,
        pindah: false,
      };
      try {
        if (e.pointerId !== undefined && typeof pegangan.setPointerCapture === "function") {
          pegangan.setPointerCapture(e.pointerId);
        }
      } catch {
        /* tanpa tangkapan, geser tetap berjalan selama penunjuk di atas widget */
      }
    });
    wadah.addEventListener("pointermove", (e) => {
      if (!geser) return;
      const dx = e.clientX - geser.x;
      const dy = e.clientY - geser.y;
      if (!geser.pindah && Math.abs(dx) <= AMBANG_GESER && Math.abs(dy) <= AMBANG_GESER) return;
      if (!geser.pindah) wadah.classList.add("aleta-cm-menggeser");
      geser.pindah = true;
      const aman = jepit(geser.kiri + dx, geser.bawah - dy);
      akar.style.left = `${Math.round(aman.kiri)}px`;
      akar.style.bottom = `${Math.round(aman.bawah)}px`;
      // Lepas dari jangkar sudut (popup-9); tanpa sudut keduanya sudah "auto".
      if (akar.style.right !== "auto") akar.style.right = "auto";
      if (akar.style.top !== "auto") akar.style.top = "auto";
    });
    const selesai = () => {
      if (!geser) return;
      const pindah = geser.pindah;
      geser = null;
      wadah.classList.remove("aleta-cm-menggeser");
      if (!pindah) return;
      abaikanKlikPil = true;
      keadaan.posisi = {
        kiri: parseFloat(akar.style.left) || 0,
        bawah: parseFloat(akar.style.bottom) || 0,
        kecil: sedangKecil(),
      };
      simpanPosisi();
      if (fitur("popup-9")) tempelKeSudut();
    };
    wadah.addEventListener("pointerup", selesai);
    wadah.addEventListener("pointercancel", selesai);
  }

  // ─── Memasang dan melepas ──────────────────────────────────────────────────

  function buatAkar() {
    // Sisa muatan lama - ekstensi yang dimuat ulang meninggalkan widget yang
    // konteksnya sudah mati.
    for (const lama of Array.from(document.querySelectorAll(TAG_AKAR))) lama.remove();
    akar = document.createElement(TAG_AKAR);
    akar.id = "aleta-cm-akar";
    akar.style.position = "fixed";
    akar.style.zIndex = String(Z_WIDGET);
    bayang = akar.attachShadow({ mode: "open" });
    bayang.appendChild(el("style", "", GAYA));
    const wadah = el("div", "aleta-cm-wadah");
    bayang.appendChild(wadah);
    pasangGeser(wadah);
    // CHECKLIST-POSISI 12 Okt: penggambaran ditunda selama penunjuk menekan.
    // Di akar bayangan, bukan di wadah: jendela melayang (data-lepasan) hidup
    // di wadah saudaranya dan menggambar ulang dirinya sama seperti dok.
    bayang.addEventListener("pointerdown", mulaiTekan, true);
    // Butir 11 (2 Okt, UI Baru): klik dua kali di sudut = pindah ke sudut itu.
    try {
      if (typeof alatPasangSudut === "function") {
        alatPasangSudut(wadah, {
          saatPindah: pindahKeSudutLayar,
          wadahSorot: bayang,
          gerbang: () => modern() && !sedangKecil(),
        });
      }
    } catch {
      /* tanpa sudut, geser tetap ada */
    }
    // Petunjuk dua detik yang sama dengan panel ALETA.
    try {
      if (typeof alatPasangPetunjuk === "function") alatPasangPetunjuk(wadah);
    } catch {
      /* tanpa petunjuk, title bawaan peramban tetap ada */
    }
  }

  function pasang() {
    hapusKabarTutup();
    if (akar && akar.isConnected) return;
    if (!akar) buatAkar();
    (document.documentElement || document.body).appendChild(akar);
    terapkanTema();
    terapkanPosisi();
    gambar();
    mulaiJam();
    aturJamTunda();
    void panenTautanSipp();
    void segarkan();
  }

  function lepas() {
    hentikanJam();
    // Tahap 3: catatan yang belum sempat tersimpan ditulis sekarang; jam
    // tunda dan jam sidang berhenti bersama widgetnya.
    if (jamCatatan) simpanCatatan();
    if (jamTunda) clearTimeout(jamTunda);
    jamTunda = null;
    if (jamSidang) clearInterval(jamSidang);
    jamSidang = null;
    if (jamSkors) clearInterval(jamSkors);
    jamSkors = null;
    if (akar) akar.remove();
  }

  function evaluasi() {
    if (bolehTampil()) pasang();
    else lepas();
  }

  function hapusKabarTutup() {
    if (jamKabarTutup) clearTimeout(jamKabarTutup);
    jamKabarTutup = null;
    for (const lama of Array.from(document.querySelectorAll(TAG_KABAR))) lama.remove();
  }

  /**
   * Tutup = saklar checklistMilestone dimatikan, sama seperti × di panel
   * ALETA mematikan saklar induk. Tombol tutup yang tidak menyebut jalan
   * pulangnya membuat orang menutupnya sekali lalu mengira fiturnya hilang -
   * jadi jalan pulang itu disebut sebentar di tempat widget tadi berdiri.
   */
  function tutup() {
    keadaan.nyala = false;
    lepas();
    tulis({ [KUNCI_SAKLAR]: false });
    hapusKabarTutup();
    const inang = document.createElement(TAG_KABAR);
    inang.style.position = "fixed";
    inang.style.zIndex = String(Z_WIDGET);
    inang.style.left = akar ? akar.style.left : `${TEPI}px`;
    inang.style.bottom = akar ? akar.style.bottom : `${TEPI}px`;
    inang.setAttribute("data-tema", keadaan.tema);
    if (keadaan.warna) inang.setAttribute("data-warna", keadaan.warna);
    tandaiKulit(inang);
    const b = inang.attachShadow({ mode: "open" });
    b.appendChild(el("style", "", GAYA));
    const wadah = el("div", "aleta-cm-wadah");
    const kotak = el(
      "div",
      "aleta-cm-kabar-tutup",
      "Checklist milestone dimatikan. Menyalakannya lagi dari popup ikon ALETA di bilah ekstensi Chrome - kotak centang “Checklist milestone”."
    );
    kotak.setAttribute("role", "status");
    kotak.title = "Tutup kabar ini";
    kotak.addEventListener("click", hapusKabarTutup);
    wadah.appendChild(kotak);
    b.appendChild(wadah);
    (document.documentElement || document.body).appendChild(inang);
    jamKabarTutup = setTimeout(hapusKabarTutup, KABAR_TUTUP_MS);
  }

  // ─── Membaca portal ────────────────────────────────────────────────────────

  function alamatPermintaan() {
    return keadaan.peran ? `${ALAMAT_API}?peran=${encodeURIComponent(keadaan.peran)}` : ALAMAT_API;
  }

  function rapikanData(isi) {
    const peranTersedia = (Array.isArray(isi.peranTersedia) ? isi.peranTersedia : [])
      .filter((p) => p && peranBersih(p.kunci))
      .map((p) => ({ kunci: String(p.kunci), label: String(p.label || p.kunci) }));
    return {
      pengguna: isi.pengguna && typeof isi.pengguna === "object" ? isi.pengguna : null,
      peranTersedia,
      peranAktif: peranBersih(isi.peranAktif),
      dibuat: String(isi.dibuat || ""),
      ringkas: objek(isi.ringkas),
      butir: isi.butir.filter((b) => b && typeof b === "object"),
      jenisTidakTersedia: (Array.isArray(isi.jenisTidakTersedia) ? isi.jenisTidakTersedia : []).filter(
        (j) => j && typeof j === "object"
      ),
      galat: (Array.isArray(isi.galat) ? isi.galat : []).map((g) => String(g)).filter(Boolean),
    };
  }

  async function pesanDariJawaban(respons) {
    try {
      const luar = await respons.json();
      const e = objek(luar && luar.error);
      return String(e.message || (luar && (luar.pesan || luar.message)) || "").slice(0, 200);
    } catch {
      return "";
    }
  }

  /**
   * Satu permintaan ke portal. Jawaban yang datang sesudah permintaan yang
   * lebih baru (peran diganti di tengah jalan) dibuang - jawaban basi yang
   * menang berarti checklist peran yang salah. Diperiksa SESUDAH TIAP await,
   * bukan hanya sesudah kepala jawaban: badan jawaban lama boleh tiba sesudah
   * jawaban peran baru tergambar. Keadaan baru diubah sesudah pemeriksaan
   * terakhir.
   */
  async function segarkan() {
    if (!akar || !akar.isConnected) return;
    const nomor = ++nomorMinta;
    keadaan.memuat = true;
    keadaan.terakhirMinta = Date.now();
    keadaan.perluSegar = false;
    gambar();
    const ambil =
      typeof alatAmbil === "function" ? alatAmbil : (alamat, opsi) => fetch(alamat, opsi);
    // Lama permintaan diukur untuk cincin lencana (tahap 3); dalam Lama tidak
    // ada yang membacanya.
    const mulaiMinta = Date.now();
    try {
      const respons = await ambil(
        alamatPermintaan(),
        { credentials: "include", cache: "no-store" },
        "Membaca checklist milestone"
      );
      if (nomor !== nomorMinta) return;
      catatSambungan(respons.status, Date.now() - mulaiMinta);
      if (respons.status === 401) {
        // Sesi yang habis: data orang yang tadi masuk tidak ditampilkan lagi.
        keadaan.data = null;
        keadaan.galat = { jenis: "masuk", pesan: "" };
      } else if (respons.status === 403) {
        const pesan = await pesanDariJawaban(respons);
        if (nomor !== nomorMinta) return;
        keadaan.data = null;
        keadaan.galat = { jenis: "akses", pesan };
      } else if (respons.status === 404) {
        keadaan.galat = { jenis: "tidak-ada", pesan: "" };
      } else if (!respons.ok) {
        const pesan = await pesanDariJawaban(respons);
        if (nomor !== nomorMinta) return;
        keadaan.galat = { jenis: "jawaban", pesan: `ALETA menjawab ${respons.status}${pesan ? `: ${pesan}` : ""}.` };
      } else {
        const luar = await respons.json();
        if (nomor !== nomorMinta) return;
        const isi = luar && typeof luar === "object" && luar.data && typeof luar.data === "object" ? luar.data : luar;
        if (!isi || typeof isi !== "object" || !Array.isArray(isi.butir)) {
          keadaan.galat = { jenis: "jawaban", pesan: "Bentuk jawabannya tidak dikenal ekstensi ini." };
        } else {
          keadaan.data = rapikanData(isi);
          keadaan.galat = null;
          keadaan.diterima = Date.now();
          // Peran tersimpan yang tidak lagi dimiliki akun ini dilupakan -
          // tanpa itu tiap penyegaran meminta peran yang pasti ditolak.
          if (keadaan.peran && !keadaan.data.peranTersedia.some((p) => p.kunci === keadaan.peran)) {
            keadaan.peran = "";
            hapusSimpanan(KUNCI_PERAN);
          }
          bersihkanTanda(keadaan.data);
        }
      }
      if (keadaan.galat) catat(`gagal: ${keadaan.galat.jenis}`, keadaan.galat.pesan);
    } catch (galat) {
      if (nomor !== nomorMinta) return;
      catatSambungan(0, Date.now() - mulaiMinta);
      keadaan.galat = { jenis: "jaringan", pesan: kalimatPertama(galat && galat.message) };
      catat("portal tidak menjawab", keadaan.galat.pesan);
    } finally {
      if (nomor === nomorMinta) {
        keadaan.memuat = false;
        gambar();
        tulisAngka();
      }
    }
    // Sesudah panen: perkara yang tautannya baru dipanen tidak perlu ditanyakan ke server.
    void panenTautanSipp()
      .catch(() => {})
      .then(() => siapkanTautanServer())
      .catch(() => {});
  }

  function gantiPeran(kunci) {
    const bersih = peranBersih(kunci);
    if (!bersih || bersih === keadaan.peran) return;
    keadaan.peran = bersih;
    tulis({ [KUNCI_PERAN]: bersih });
    void segarkan();
  }

  // ─── Penyegaran berkala dan saat kembali ───────────────────────────────────

  function mulaiJam() {
    if (jamBerkala) return;
    jamBerkala = setInterval(() => {
      if (!akar || !akar.isConnected) return;
      // Tab di belakang tidak meminta apa pun: lima tab SIPP yang terbuka
      // berarti lima permintaan tiap lima menit untuk layar yang tidak dilihat
      // siapa pun. Yang tertunda ditebus saat tabnya kembali dilihat.
      if (document.visibilityState === "hidden") {
        keadaan.perluSegar = true;
        return;
      }
      void segarkan();
    }, SEGAR_BERKALA_MS);
  }

  function hentikanJam() {
    if (jamBerkala) clearInterval(jamBerkala);
    jamBerkala = null;
  }

  /**
   * Jendela kembali difokus - biasanya sesudah petugas mengerjakan sesuatu di
   * tab lain, dan justru saat itulah butir yang sudah selesai harus hilang.
   * Fokus yang berkedip bolak-balik dalam setengah menit tidak meminta ulang.
   */
  function saatKembali() {
    if (!akar || !akar.isConnected) return;
    if (!keadaan.perluSegar && Date.now() - keadaan.terakhirMinta < JEDA_FOKUS_MS) return;
    void segarkan();
  }

  // ─── Penyimpanan: dibaca sekali, lalu didengarkan ──────────────────────────

  /**
   * Kunci yang berubah SELAMA pembacaan pertama. Nilai dari pendengar lebih
   * baru daripada hasil get() yang sedang di jalan, jadi mulai() tidak boleh
   * menimpanya - saklar yang dicentang tepat saat halaman dimuat akan
   * terbalik diam-diam.
   */
  const berubahSebelumSiap = new Set();

  function dengarkan() {
    try {
      chrome.storage.onChanged.addListener((ubah, wilayah) => {
        if (wilayah !== "local" || !ubah) return;
        if (!keadaan.siap) for (const k of Object.keys(ubah)) berubahSebelumSiap.add(k);
        let saklarBerubah = false;
        if (ubah[KUNCI_INDUK]) {
          keadaan.induk = ubah[KUNCI_INDUK].newValue !== false;
          saklarBerubah = true;
        }
        if (ubah[KUNCI_SAKLAR]) {
          keadaan.nyala = ubah[KUNCI_SAKLAR].newValue === true;
          saklarBerubah = true;
          if (!keadaan.nyala) lupakanTautanSipp();
        }
        if (ubah[KUNCI_TEMA] || ubah[KUNCI_WARNA]) {
          if (ubah[KUNCI_TEMA]) keadaan.tema = ubah[KUNCI_TEMA].newValue === "terang" ? "terang" : "gelap";
          if (ubah[KUNCI_WARNA]) keadaan.warna = warnaBersih(ubah[KUNCI_WARNA].newValue);
          terapkanTema();
        }
        // Hanya PENGHAPUSAN yang diikuti - itulah "Kembalikan posisi panel"
        // di popup. Posisi yang ditulis tab lain tidak menarik widget di tab
        // ini dari bawah tangan orang.
        if (ubah[KUNCI_POSISI] && ubah[KUNCI_POSISI].newValue === undefined) {
          keadaan.posisi = null;
          // Sudut yang diingat (popup-9) ikut dikembalikan untuk situs ini -
          // hanya bila memang ada, jadi yang tidak pernah mencobanya tidak
          // melihat satu tulisan pun.
          if (punya(keadaan.sudut, JENIS)) {
            const sisa = { ...keadaan.sudut };
            delete sisa[JENIS];
            keadaan.sudut = sisa;
            tulis({ [KUNCI_SUDUT]: sisa });
          }
          terapkanPosisi();
          gambar();
        }
        // ── Tahap 3: kunci yang hanya ditulis di luar tampilan Lama ──
        if (ubah[KUNCI_TANDA]) {
          keadaan.tanda = tandaBersih(ubah[KUNCI_TANDA].newValue);
          aturJamTunda();
          tulisAngka();
          gambar();
        }
        if (ubah[KUNCI_CATATAN] && !catatanDisunting()) {
          keadaan.catatan = catatanBersih(ubah[KUNCI_CATATAN].newValue);
          if (kotakCatatan) kotakCatatan.value = keadaan.catatan;
        }
        if (ubah[KUNCI_LAMA_SIDANG]) {
          keadaan.lamaSidang = lamaSidangBersih(ubah[KUNCI_LAMA_SIDANG].newValue);
          gambar();
        }
        if (ubah[KUNCI_SUSUNAN]) {
          keadaan.susunan = susunanBersih(ubah[KUNCI_SUSUNAN].newValue);
          gambar();
        }
        // Butir 7: tata dari tab lain, dan setelan akun dari server (lewat
        // singgahan tampilan yang diperbarui panel-alat.js).
        if (ubah[KUNCI_TATA]) {
          const baru = tataBersih(ubah[KUNCI_TATA].newValue);
          if (JSON.stringify(baru) !== JSON.stringify(keadaan.tata)) {
            keadaan.tata = baru;
            gambar();
          }
        }
        if (ubah[KUNCI_TAMPILAN_SERVER]) setTimeout(sinkronTata, 0);
        // Sudut situs LAIN diikuti; sudut situs ini hanya milik tab yang
        // menggesernya - sama dengan posisi, tab lain tidak menarik widget
        // dari bawah tangan orang.
        if (ubah[KUNCI_SUDUT]) {
          const baru = sudutBersih(ubah[KUNCI_SUDUT].newValue);
          if (punya(keadaan.sudut, JENIS)) baru[JENIS] = keadaan.sudut[JENIS];
          else delete baru[JENIS];
          keadaan.sudut = baru;
        }
        if (ubah[KUNCI_RIWAYAT_SIPP] || ubah[KUNCI_TAUTAN_SIPP]) {
          if (ubah[KUNCI_RIWAYAT_SIPP]) keadaan.riwayatSipp = ubah[KUNCI_RIWAYAT_SIPP].newValue || [];
          if (ubah[KUNCI_TAUTAN_SIPP]) keadaan.tautanSipp = objek(ubah[KUNCI_TAUTAN_SIPP].newValue);
          susunPetaSipp();
          gambar();
        }
        if (ubah[KUNCI_PERAN]) {
          const p = peranBersih(ubah[KUNCI_PERAN].newValue);
          if (p !== keadaan.peran) {
            keadaan.peran = p;
            if (akar && akar.isConnected) void segarkan();
          }
        }
        if (saklarBerubah && keadaan.siap) evaluasi();
      });
    } catch {
      /* di luar konteks ekstensi - saklarnya berlaku sesudah halaman dimuat ulang */
    }
  }

  async function mulai() {
    const simpan = await baca([
      KUNCI_INDUK,
      KUNCI_SAKLAR,
      KUNCI_TEMA,
      KUNCI_WARNA,
      KUNCI_POSISI,
      KUNCI_PERAN,
      KUNCI_LIPATAN,
      KUNCI_RIWAYAT_SIPP,
      KUNCI_TAUTAN_SIPP,
      KUNCI_TANDA,
      KUNCI_CATATAN,
      KUNCI_LAMA_SIDANG,
      KUNCI_SUSUNAN,
      KUNCI_SUDUT,
      KUNCI_TATA,
    ]);
    const lama = (kunci) => !berubahSebelumSiap.has(kunci);
    if (lama(KUNCI_TATA)) keadaan.tata = tataBersih(simpan[KUNCI_TATA]);
    // Tahap 3 - dibaca selalu (murah), dipakai hanya di luar tampilan Lama.
    if (lama(KUNCI_TANDA)) keadaan.tanda = tandaBersih(simpan[KUNCI_TANDA]);
    if (lama(KUNCI_CATATAN)) keadaan.catatan = catatanBersih(simpan[KUNCI_CATATAN]);
    if (lama(KUNCI_LAMA_SIDANG)) keadaan.lamaSidang = lamaSidangBersih(simpan[KUNCI_LAMA_SIDANG]);
    if (lama(KUNCI_SUSUNAN)) keadaan.susunan = susunanBersih(simpan[KUNCI_SUSUNAN]);
    if (lama(KUNCI_SUDUT)) keadaan.sudut = sudutBersih(simpan[KUNCI_SUDUT]);
    // Induk bawaannya MENYALA, widget ini bawaannya MATI - sama dengan popup.
    if (lama(KUNCI_INDUK)) keadaan.induk = simpan[KUNCI_INDUK] !== false;
    if (lama(KUNCI_SAKLAR)) keadaan.nyala = simpan[KUNCI_SAKLAR] === true;
    if (lama(KUNCI_TEMA)) keadaan.tema = simpan[KUNCI_TEMA] === "terang" ? "terang" : "gelap";
    if (lama(KUNCI_WARNA)) keadaan.warna = warnaBersih(simpan[KUNCI_WARNA]);
    if (lama(KUNCI_POSISI)) keadaan.posisi = posisiBersih(simpan[KUNCI_POSISI]);
    if (lama(KUNCI_PERAN)) keadaan.peran = peranBersih(simpan[KUNCI_PERAN]);
    keadaan.lipatan = lipatanBersih(simpan[KUNCI_LIPATAN]);
    if (lama(KUNCI_RIWAYAT_SIPP)) {
      keadaan.riwayatSipp = Array.isArray(simpan[KUNCI_RIWAYAT_SIPP]) ? simpan[KUNCI_RIWAYAT_SIPP] : [];
    }
    if (lama(KUNCI_TAUTAN_SIPP)) keadaan.tautanSipp = objek(simpan[KUNCI_TAUTAN_SIPP]);
    susunPetaSipp();
    // Saklar dimatikan selagi tidak ada halaman yang terbuka: sisanya di sini.
    if (!keadaan.nyala && simpan[KUNCI_TAUTAN_SIPP] !== undefined) lupakanTautanSipp();
    keadaan.siap = true;
    evaluasi();
    sinkronTata();
    void bukaTabTujuanSipp().catch(() => {});
  }

  // Pendengar dipasang SEBELUM penyimpanan terbaca: saklar yang diubah
  // selama pembacaan pertama tidak boleh hilang.
  dengarkan();
  window.addEventListener("focus", saatKembali);
  // CHECKLIST-POSISI 12 Okt: lepas/batal di mana pun - juga di luar widget.
  window.addEventListener("pointerup", lepasTekan, true);
  window.addEventListener("pointercancel", lepasTekan, true);
  window.addEventListener("blur", lepasTekan);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") saatKembali();
  });
  // Butir 3 (6 Okt): detak sumber daya berhenti saat tab disembunyikan dan
  // menyala lagi saat terlihat. Dalam Lama aturJamSd tidak menyalakan apa pun.
  document.addEventListener("visibilitychange", () => aturJamSd());
  window.addEventListener("resize", () => terapkanPosisi());
  // Pengalih Lama / Baru / UI Baru di popup - kulitnya ikut seketika.
  document.addEventListener("aleta-uji-berubah", () => terapkanTema());
  // Saklar "Sembunyikan penjelasan teknis" (K5), dari popup, widget, atau
  // tab lain: tanda akarnya dan rupa saklarnya ikut seketika.
  document.addEventListener("aleta-teknis-berubah", () => {
    terapkanTema();
    if (akar && akar.isConnected && modeUji() !== "lama") gambar();
  });
  // ...dan susunannya: dok, lencana, tombol Selesai/Tunda, sudut, angka ikon.
  // Kembali ke Lama menggambar ulang lewat jalan Lama, jadi tidak ada sisa.
  document.addEventListener("aleta-uji-berubah", () => {
    // Pita pembaruan ditanyakan lagi menurut tampilan yang baru.
    pembaruanDitanya = false;
    if (!modern()) keadaan.aturTerbuka = false;
    if (!akar || !akar.isConnected) return;
    terapkanPosisi();
    gambar();
    aturJamTunda();
    tulisAngka();
    sinkronTata();
    // Dari Lama ke Baru/UI Baru: alamat halaman perkara SIPP baru diminta sekarang.
    void siapkanTautanServer().catch(() => {});
  });
  // Jendela melayang tetap di dalam layar saat ukuran jendela berubah.
  window.addEventListener("resize", () => {
    if (!bayang || !modern()) return;
    for (const k of Array.from(bayang.querySelectorAll("[data-lepasan]"))) terapkanLetakLepas(k, k.getAttribute("data-lepasan"));
  });

  // Portal berpindah halaman tanpa memuat ulang (Next.js): /login -> /portal
  // harus dikejar sendiri. Dan React boleh membuang simpul yang tidak
  // dikenalnya saat menyusun ulang akarnya - widget yang seharusnya tampil
  // dipasang kembali.
  if (JENIS === "portal") {
    let jalurTerakhir = location.pathname;
    setInterval(() => {
      const pindah = location.pathname !== jalurTerakhir;
      jalurTerakhir = location.pathname;
      if (pindah || (bolehTampil() && akar && !akar.isConnected)) evaluasi();
    }, 1000);
  }

  void mulai();
})();
