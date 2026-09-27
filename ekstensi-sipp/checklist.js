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
 *           <enc> hasil enkripsi SIPP yang tidak dapat dibuat di luar SIPP
 *           (lihat "ALAMAT HALAMAN PERKARA YANG BOLEH DIBUKA ULANG" di
 *           konten.js). Karena itu dipakai alamat yang SUDAH PERNAH dirender
 *           SIPP di peramban ini: riwayat halaman detail (riwayatPerkaraSipp,
 *           dicatat konten.js - jalan kembali yang sama dengan panel portal)
 *           dan tautan "detil" di daftar perkara yang pernah dibuka (dipanen
 *           di sini, hanya selama saklarnya menyala, dan dihapus saat saklar
 *           dimatikan). Keduanya hanya dipakai bila jalurnya perkara_detil/
 *           <enc> di asal ini. Perkara yang belum pernah terlihat: beranda SIPP
 *           dibuka, nomornya disalin untuk ditempel di kotak cari - dan itu
 *           DISEBUT, bukan dibiarkan tampak seperti tautan yang benar.
 *
 * Semua tujuan dibuka di tab baru. Tidak ada satu pun yang ditulis ke SIPP,
 * ABT, maupun ALETA dari sini: yang dikirim hanya satu GET tentang pekerjaan
 * pemanggilnya sendiri.
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
  };
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
    }
    .aleta-cm-menggeser .aleta-cm-kepala, .aleta-cm-menggeser .aleta-cm-pil { cursor: grabbing; }
    .aleta-cm-ikon { width: 18px; height: 18px; flex: none; display: block; }
    .aleta-cm-judul { font-weight: 700; white-space: nowrap; }
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
    select.aleta-cm-peran { cursor: pointer; appearance: auto; }
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

    @media (prefers-reduced-motion: reduce) {
      .aleta-cm-berputar { animation: none; opacity: 0.6; }
      .aleta-cm-bilah-isi { transition: none; }
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
  };

  let akar = null;
  let bayang = null;
  let jamBerkala = null;
  let jamKabarSingkat = null;
  let jamKabarTutup = null;
  let nomorMinta = 0;
  let abaikanKlikPil = false;

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

  function lipatanBersih(x) {
    const hasil = {};
    for (const [k, v] of Object.entries(objek(x))) if (typeof v === "boolean") hasil[k] = v;
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

    // SIPP
    const tab = namaTabSipp(halaman);
    const lanjut = tab ? `, lalu tab ${tab}` : "";
    const dikenal = nomor ? keadaan.petaSipp.get(kunciNomor(nomor)) : "";
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

  function susunKerjakan(butir) {
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
      a.addEventListener("click", () => {
        // Disalin DI DALAM tekanan - execCommand menolak di luar itu.
        const tersalin = salinTeks(nomor);
        // Digambar sesudahnya: mengganti isi widget di tengah tekanan tidak
        // boleh bersaing dengan tab baru yang sedang dibuka.
        setTimeout(() => {
          kabarSingkat(
            tersalin
              ? `Nomor ${nomor} disalin - tempel di kotak cari ${tempat}.`
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
      const h = hitungan(keadaan.data);
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
    const segar = tombol("aleta-cm-segar", "", "Segarkan sekarang", () => void segarkan(), "segar");
    segar.appendChild(el("span", keadaan.memuat ? "aleta-cm-berputar" : "", "⟳"));
    alat.appendChild(segar);
    alat.appendChild(tombol("aleta-cm-kecilkan", "–", "Kecilkan menjadi pil", () => setelKecil(true), "kecilkan"));
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
    const li = el("li", "aleta-cm-butir");
    li.setAttribute("data-id", String(b.id ?? ""));
    if (b.jenis) li.setAttribute("data-jenis", String(b.jenis));
    const teks = el("div", "aleta-cm-butir-teks");
    teks.appendChild(el("div", "aleta-cm-butir-judul", String(b.judul || b.jenis || "Tanpa judul")));
    const ket = el("div", "aleta-cm-butir-ket");
    const nomor = String(objek(b.perkara).nomor || "").trim();
    if (nomor) ket.appendChild(el("span", "aleta-cm-nomor", nomor));
    const bagian = [String(b.keterangan || "").trim(), teksTenggat(b.tenggat)].filter(Boolean);
    if (bagian.length) ket.appendChild(document.createTextNode(`${nomor ? " · " : ""}${bagian.join(" · ")}`));
    if (ket.childNodes.length) teks.appendChild(ket);
    li.appendChild(teks);
    li.appendChild(susunKerjakan(b));
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
    if (buka && daftar.length) {
      const ul = el("ul", "aleta-cm-daftar");
      for (const b of daftar) ul.appendChild(susunButir(b));
      bagian.appendChild(ul);
    }
    return bagian;
  }

  function susunIsi() {
    const isi = el("div", "aleta-cm-isi");
    const data = keadaan.data;
    if (data.butir.length === 0) {
      const label = labelPeran(data);
      isi.appendChild(el("div", "aleta-cm-kosong", `Tidak ada pekerjaan tertunda${label ? ` untuk ${label}` : ""}.`));
      return isi;
    }
    const h = hitungan(data);
    const jumlah = { lewat: h.lewat, "hari-ini": h.hariIni, "minggu-ini": h.mingguIni };
    for (const k of KELOMPOK) {
      const daftar = data.butir.filter((b) => b.kelompok === k.kunci);
      if (daftar.length === 0 && jumlah[k.kunci] === 0) continue;
      isi.appendChild(susunKelompok(k.kunci, k.judul, daftar, jumlah[k.kunci], terbuka(k.kunci, k.bawaanTerbuka)));
    }
    // Kelompok yang tidak dikenal versi ekstensi ini tetap ditampilkan -
    // membuangnya berarti pekerjaan yang hilang tanpa jejak.
    const lain = data.butir.filter((b) => !KELOMPOK.some((k) => k.kunci === b.kelompok));
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
    baris.appendChild(el("span", "aleta-cm-catatan", "butir hilang sendiri saat datanya lengkap"));
    kaki.appendChild(baris);

    const data = keadaan.data;
    if (!data) return kaki;
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
    panel.appendChild(susunKepala());
    const kabar = susunKabar();
    if (kabar) panel.appendChild(kabar);
    if (keadaan.data) {
      panel.appendChild(susunKemajuan());
      panel.appendChild(susunIsi());
    } else if (!keadaan.galat) {
      panel.appendChild(el("div", "aleta-cm-memuat", "Memuat checklist…"));
    }
    panel.appendChild(susunKaki());
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
    const h = keadaan.data ? hitungan(keadaan.data) : null;
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
  function gambar() {
    if (!bayang) return;
    const wadah = bayang.querySelector(".aleta-cm-wadah");
    if (!wadah) return;
    const fokus = kunciFokus();
    const isiLama = wadah.querySelector(".aleta-cm-isi");
    const gulung = isiLama ? isiLama.scrollTop : 0;
    wadah.textContent = "";
    const kecil = Boolean(keadaan.posisi && keadaan.posisi.kecil);
    wadah.appendChild(kecil ? susunPil() : susunPanel());
    const isiBaru = wadah.querySelector(".aleta-cm-isi");
    if (isiBaru && gulung) isiBaru.scrollTop = gulung;
    fokuskan(fokus);
  }

  // ─── Tema dan posisi ───────────────────────────────────────────────────────

  function terapkanTema() {
    if (!akar) return;
    akar.setAttribute("data-tema", keadaan.tema);
    if (keadaan.warna) akar.setAttribute("data-warna", keadaan.warna);
    else akar.removeAttribute("data-warna");
    // Petunjuk dua detik panel-alat.js membaca data-tema dari akar yang
    // dipasanginya - di sini wadah di dalam bayangan.
    const wadah = bayang && bayang.querySelector(".aleta-cm-wadah");
    if (wadah) wadah.setAttribute("data-tema", keadaan.tema);
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
    const p = keadaan.posisi;
    const aman = p && Number.isFinite(p.kiri) ? jepit(p.kiri, p.bawah) : { kiri: TEPI, bawah: TEPI };
    akar.style.left = `${Math.round(aman.kiri)}px`;
    akar.style.bottom = `${Math.round(aman.bawah)}px`;
    akar.style.top = "auto";
    akar.style.right = "auto";
  }

  function simpanPosisi() {
    const p = keadaan.posisi || {};
    const isi = { kecil: Boolean(p.kecil) };
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
    fokuskan(kecil ? "pil" : "kecilkan");
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
      if (!sasaran.closest(".aleta-cm-pil") && sasaran.closest("button, a, select, input, textarea, summary")) return;
      abaikanKlikPil = false;
      geser = {
        x: e.clientX,
        y: e.clientY,
        kiri: parseFloat(akar.style.left) || 0,
        bawah: parseFloat(akar.style.bottom) || 0,
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
        kecil: Boolean(keadaan.posisi && keadaan.posisi.kecil),
      };
      simpanPosisi();
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
    void panenTautanSipp();
    void segarkan();
  }

  function lepas() {
    hentikanJam();
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
    try {
      const respons = await ambil(
        alamatPermintaan(),
        { credentials: "include", cache: "no-store" },
        "Membaca checklist milestone"
      );
      if (nomor !== nomorMinta) return;
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
        }
      }
      if (keadaan.galat) catat(`gagal: ${keadaan.galat.jenis}`, keadaan.galat.pesan);
    } catch (galat) {
      if (nomor !== nomorMinta) return;
      keadaan.galat = { jenis: "jaringan", pesan: kalimatPertama(galat && galat.message) };
      catat("portal tidak menjawab", keadaan.galat.pesan);
    } finally {
      if (nomor === nomorMinta) {
        keadaan.memuat = false;
        gambar();
      }
    }
    void panenTautanSipp();
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
          terapkanPosisi();
          gambar();
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
    ]);
    const lama = (kunci) => !berubahSebelumSiap.has(kunci);
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
  }

  // Pendengar dipasang SEBELUM penyimpanan terbaca: saklar yang diubah
  // selama pembacaan pertama tidak boleh hilang.
  dengarkan();
  window.addEventListener("focus", saatKembali);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") saatKembali();
  });
  window.addEventListener("resize", () => terapkanPosisi());

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
