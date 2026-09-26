"use strict";

/**
 * ============================================================================
 * HURUF ALASAN PERCERAIAN - DIAMBIL DARI NASKAH RESMI, BUKAN DARI INGATAN
 * ============================================================================
 *
 * Blangko [01] Kabul Verstek Cerai menyebut variabel 8503 sebagai:
 *
 *     "ALASAN PERCERAIAN - PILIH SALAH SATU / DAPAT DIGABUNG: A, B, F, H
 *      (FASAKH)"
 *
 * Huruf-huruf itu menunjuk alasan perceraian di dalam peraturan, dan satu
 * huruf yang salah mengubah dasar hukum putusan. Karena itu bunyinya TIDAK
 * BOLEH ditulis dari ingatan siapa pun - termasuk ingatan mesin. Seluruhnya
 * disalin apa adanya dari naskah resmi yang diunduh.
 *
 * ============================================================================
 * DUA DASAR UNTUK SATU HURUF, DAN ITU BUKAN PENGULANGAN
 * ============================================================================
 *
 * Huruf a, b, dan f ada di DUA tempat sekaligus:
 *
 *   Pasal 19 PP Nomor 9 Tahun 1975  - berlaku bagi semua perkawinan
 *   Pasal 116 Kompilasi Hukum Islam - dasar yang dipakai Pengadilan Agama
 *
 * Isinya sama, BUNYINYA TIDAK. Keduanya disimpan berdampingan karena selisih
 * kata itu nyata dan ikut tercetak ke dalam putusan:
 *
 *   PP  : "pemabok"        KHI : "pemabuk"
 *   PP  : "terus-menerus"  KHI : "terus menerus"
 *
 * Yang menyusun putusan memilih akan mengutip yang mana; berkas ini menyediakan
 * keduanya apa adanya, dan tidak pernah mencampurnya menjadi satu kalimat
 * karangan.
 *
 * Huruf h hanya punya SATU dasar: Pasal 19 PP itu berhenti di huruf f. Huruf g
 * dan h memang hanya ada di KHI.
 *
 * ============================================================================
 * KENAPA DUA SALINAN KHI, DAN APA YANG DIPERIKSA DI ANTARA KEDUANYA
 * ============================================================================
 *
 * Naskah KHI tidak dapat diambil dari peraturan.go.id: berkas .doc yang
 * dirujuk halaman Inpres 1/1991 di sana menjawab 200 dengan panjang NOL, dan
 * baris "Dokumen Peraturan" pada halamannya kosong. Diambil dari terbitan
 * resmi Kementerian Agama - kementerian yang justru diperintahkan Inpres itu
 * untuk menyebarluaskan KHI.
 *
 * Kedua terbitan itu hasil pindaian, dan lapisan teksnya penuh salah baca -
 * masing-masing di tempat yang berbeda:
 *
 *   salinan 1 : "c." untuk huruf "e.", "k." untuk huruf "h.", "Pasall17"
 *   salinan 2 : "siih" untuk "sah", "mendapal", "cac«d", "dalarn",
 *               "terj::idinya", "Pasal 16" untuk "Pasal 116"
 *
 * Salah baca yang paling berbahaya justru pada PENANDA HURUFNYA. Kalau hanya
 * salinan pertama dipakai, huruf h akan tercatat sebagai "k" - dan tidak ada
 * yang dapat memeriksanya dari layar.
 *
 * Karena itu bunyi KHI di bawah adalah yang DISEPAKATI kedua salinan. Di mana
 * keduanya berselisih pada hal yang memang rawan pindaian - koma, spasi -
 * selisihnya disebut di `catatanNaskah`, bukan dipilih diam-diam. Ejaannya
 * tidak dirapikan: merapikan naskah hukum bukan wewenang berkas ini.
 */

/** Pasal 19 PP Nomor 9 Tahun 1975 - naskah digital, bukan pindaian. */
const SUMBER_PP_9_1975 = {
  nama: "Pasal 19 PP Nomor 9 Tahun 1975",
  tautan: "https://peraturan.go.id/files/pp9-1975.pdf",
  diunduh: "2026-09-09",
};

/** Pasal 116 Kompilasi Hukum Islam - dua terbitan resmi Kementerian Agama. */
const SUMBER_KHI = {
  nama: "Pasal 116 Kompilasi Hukum Islam (Inpres Nomor 1 Tahun 1991)",
  tautan:
    "https://simbi.kemenag.go.id/eliterasi/storage/perpustakaan/slims/repository/b5c07c0ce34195adb3cd15ad059b33f2.pdf",
  pembanding:
    "https://simbi.kemenag.go.id/eliterasi/storage/perpustakaan/pusat/316a67e6-6a05-4bf8-9f1d-6e8b22741b90/buku-digital/df7746a999-7125653410.pdf",
  diunduh: "2026-09-09",
};

/**
 * Peta huruf.
 *
 * `dasar` selalu berupa daftar - satu huruf dapat berdiri di atas lebih dari
 * satu naskah, dan yang menyusun putusan berhak melihat keduanya.
 *
 * `ciri` adalah kata kunci yang, bila muncul di keterangan saksi, MENUNJUK ke
 * huruf ini. Menunjuk, bukan membuktikan - lihat catatan pada usulkan().
 */
const HURUF = [
  {
    huruf: "A",
    siap: true,
    dasar: [
      {
        sumber: SUMBER_PP_9_1975,
        bunyi:
          "Salah satu pihak berbuat zina atau menjadi pemabok, pemadat, penjudi, dan lain sebagainya yang sukar disembuhkan",
        catatanNaskah: "",
      },
      {
        sumber: SUMBER_KHI,
        bunyi:
          "salah satu pihak berbuat zina atau menjadi pemabuk, pemadat, penjudi dan lain sebagainya yang sukar disembuhkan",
        catatanNaskah: 'KHI menulis "pemabuk"; PP menulis "pemabok".',
      },
    ],
    ciri: ["zina", "mabuk", "pemabok", "pemabuk", "pemadat", "judi", "penjudi", "sabu", "narkoba"],
    // Syaratnya ada di bunyi huruf itu sendiri: "yang sukar disembuhkan".
    // Dahulu kosong, dan ekstensi mencentang sendiri huruf yang syaratnya
    // kosong - keputusan pengguna 11 menuntut TIDAK satu huruf pun
    // tercentang otomatis.
    syarat:
      "menuntut perbuatan yang SUKAR DISEMBUHKAN - periksa apakah keterangan saksi menunjukkan kebiasaan, bukan kejadian sekali",
  },
  {
    huruf: "B",
    siap: true,
    dasar: [
      {
        sumber: SUMBER_PP_9_1975,
        bunyi:
          "Salah satu pihak meninggalkan pihak lain selama 2 (dua) tahun berturut-turut tanpa izin pihak lain dan tanpa alasan yang sah atau karena hal lain diluar kemampuannya",
        catatanNaskah: "",
      },
      {
        sumber: SUMBER_KHI,
        bunyi:
          "salah satu pihak meninggalkan pihak lain selama 2 (dua) tahun berturut-turut tanpa izin pihak lain dan tanpa alasan yang sah atau karena hal lain diluar kemampuannya",
        catatanNaskah:
          'Kedua salinan KHI berselisih pada tanda baca: salinan 1 menulis "hal lain, diluar kemampuannya", salinan 2 menulis "hal lain di luar kemampuanya". Keduanya rawan salah baca pindaian; yang dipakai bentuk yang sama dengan naskah PP - periksa naskah cetak bila selisih ini menentukan.',
      },
    ],
    // Syaratnya angka, dan angka itu tidak dapat disimpulkan dari kata
    // kerjanya. Inilah sebab huruf B tidak pernah diusulkan hanya karena
    // saksi menyebut "meninggalkan tempat kediaman bersama" - hampir tiap
    // perkara memuat kalimat itu, dan hampir semuanya bukan huruf B.
    ciri: ["meninggalkan"],
    syarat: "menuntut 2 (dua) tahun berturut-turut - periksa lama pisahnya lebih dulu",
  },
  /**
   * ==========================================================================
   * HURUF C, D, DAN E - BUNYI PP SUDAH ADA, BUNYI KHI BELUM
   * ==========================================================================
   *
   * Ketiganya diambil dari naskah PP yang sama dengan huruf A, B, dan F -
   * peraturan.go.id/files/pp9-1975.pdf, diekstrak ulang 20 September 2026.
   * Pengambilan itu memeriksa dirinya sendiri: huruf a, b, dan f yang sudah
   * lebih dulu ada di berkas ini terbukti sama kata demi kata dengan yang baru
   * diekstrak, sehingga huruf c, d, dan e dari ekstraksi yang sama berdiri di
   * atas dasar yang sudah terbukti.
   *
   * Bunyi KHI-nya BELUM ada, dan itu disebut apa adanya pada tiap
   * catatanNaskah - bukan dibiarkan tampak lengkap. Kedua terbitan Kementerian
   * Agama yang dirujuk berkas ini berukuran lebih dari sepuluh megabita dan
   * tidak dapat diambil dari mesin ini. Keduanya tetap harus disalin dan
   * dibandingkan seperti huruf A, B, F, dan H - selisih "pemabok" lawan
   * "pemabuk" pada huruf A membuktikan selisih itu nyata dan ikut tercetak ke
   * dalam putusan.
   *
   * Ketiganya tetap `siap` sebab dasar PP-nya utuh dan sah dikutip: Pasal 19
   * PP Nomor 9 Tahun 1975 berlaku bagi semua perkawinan, termasuk yang
   * diperiksa Pengadilan Agama. Yang menyusun putusan melihat sendiri dasar
   * mana yang tersedia dan memilih mengutipnya atau menunggu.
   *
   * ==========================================================================
   * BLANGKO [01] BELUM MENGENAL KETIGANYA - DAN ITU HARUS TERBACA LEBIH DULU
   * ==========================================================================
   *
   * Diperiksa langsung pada aps_badilag.abt_variabel 20 September 2026: kueri
   * 4020, 8521, 8522, 8528, dan 8530 seluruhnya berupa CASE atas '#8503#', dan
   * tidak satu pun punya cabang untuk C, D, E, atau G. Yang dikenali hanya
   * A, B, F, H beserta gabungan AB, AF, BF, dan ABF.
   *
   * Huruf yang tidak dikenali jatuh ke cabang ELSE, yang berbunyi "TIDAK BENAR
   * QUERY NYA / BELUM ISI ALASAN DI KOLOM ABT" - dan kalimat itu ikut TERCETAK
   * ke dalam putusan.
   *
   * Ekstensi sudah menahannya sesudah 8503 ditulis, tetapi peringatan yang
   * datang sesudah orang memilih bukan peringatan yang menolong. Karena itu
   * keadaan ini ikut disebut pada `syarat` masing-masing - yang ditampilkan di
   * sebelah kotak centangnya, sebelum dicentang.
   *
   * Begitu cabang barunya ditambahkan ke blangko, kalimat ini dihapus dari
   * ketiga syarat di bawah. Sampai saat itu, ia yang menahan putusan tercetak
   * dengan kalimat galat di dalamnya.
   */
  {
    huruf: "C",
    siap: true,
    dasar: [
      {
        sumber: SUMBER_PP_9_1975,
        bunyi:
          "Salah satu pihak mendapat hukuman penjara 5 (lima) tahun atau hukuman yang lebih berat setelah perkawinan berlangsung",
        catatanNaskah: "",
      },
      {
        sumber: SUMBER_KHI,
        bunyi:
          "salah satu pihak mendapat hukuman penjara 5 (lima) tahun atau hukuman yang lebih berat setelah perkawinan berlangsung",
        catatanNaskah:
          "Pindaian huruf c bersih dari salah baca, dan bunyinya sama kata demi kata dengan naskah PP kecuali huruf besar pada awal kalimat. Baru melewati SATU salinan KHI - lihat catatan di atas.",
      },
    ],
    // "dihukum" saja SENGAJA tidak dipakai: posita dan keterangan saksi
    // memakainya untuk hukuman apa pun, termasuk teguran atasan. Yang
    // dijadikan ciri hanya bunyi yang menunjuk pidana penjaranya.
    ciri: ["hukuman penjara", "dipenjara", "pidana penjara", "lembaga pemasyarakatan"],
    syarat:
      "menuntut DUA hal sekaligus: hukumannya 5 (lima) tahun atau lebih berat, DAN dijatuhkan setelah perkawinan berlangsung - periksa putusan pidananya, keduanya tidak dapat disimpulkan dari keterangan saksi | PERHATIAN: blangko [01] belum punya cabang untuk huruf ini - 8503 yang berisi huruf ini membuat 4020, 8521, 8522, 8528, dan 8530 berbunyi 'TIDAK BENAR QUERY NYA' dan kalimat itu ikut tercetak ke dalam putusan",
  },
  {
    huruf: "D",
    siap: true,
    dasar: [
      {
        sumber: SUMBER_PP_9_1975,
        bunyi:
          "Salah satu pihak melakukan kekejaman atau penganiayaan berat yang membahayakan pihak yang lain",
        catatanNaskah: "",
      },
      {
        sumber: SUMBER_KHI,
        bunyi:
          "salah satu pihak melakukan kekejaman atau penganiayaan berat yang membahayakan pihak lain",
        catatanNaskah:
          'SELISIH NYATA dengan PP, dan belum dapat dipastikan: KHI menulis "membahayakan pihak lain", PP menulis "membahayakan pihak yang lain". Tidak ada salah baca ejaan di sekitarnya, sehingga selisih satu kata "yang" itu kemungkinan memang ada di naskahnya - tetapi baru melewati SATU salinan KHI. Periksa naskah cetak bila selisih ini menentukan.',
      },
    ],
    ciri: [
      "kekejaman",
      "penganiayaan",
      "menganiaya",
      "kdrt",
      "kekerasan",
      "memukul",
      "menampar",
      "mencekik",
    ],
    // Bukan syarat angka melainkan syarat DERAJAT, dan derajat itu tidak
    // terbaca dari kata "memukul". Sekali menampar dan penganiayaan yang
    // membahayakan nyawa sama-sama memicu ciri di atas.
    syarat:
      "menuntut kekejaman atau penganiayaan yang BERAT dan MEMBAHAYAKAN pihak lain - periksa derajatnya, sebab ciri di atas menyala pada kekerasan tingkat apa pun | PERHATIAN: blangko [01] belum punya cabang untuk huruf ini - 8503 yang berisi huruf ini membuat 4020, 8521, 8522, 8528, dan 8530 berbunyi 'TIDAK BENAR QUERY NYA' dan kalimat itu ikut tercetak ke dalam putusan",
  },
  {
    huruf: "E",
    siap: true,
    dasar: [
      {
        sumber: SUMBER_PP_9_1975,
        bunyi:
          "Salah satu pihak mendapat cacat badan atau penyakit dengan akibat tidak dapat menjalankan kewajibannya sebagai suami/isteri",
        catatanNaskah: "",
      },
      {
        sumber: SUMBER_KHI,
        bunyi:
          "salah satu pihak mendapat cacat badan atau penyakit dengan akibat tidak dapat menjalankan kewajibannya sebagai suami atau isteri",
        catatanNaskah:
          'Pindaiannya memuat DUA salah baca yang dikoreksi dengan naskah PP sebagai pembanding: "sakah satu pihak" -> "salah satu pihak", "cacat badab" -> "cacat badan". Keduanya bukan kata Indonesia, sehingga koreksinya tidak meragukan. Yang TIDAK dikoreksi: KHI menutup dengan "sebagai suami atau isteri" sedangkan PP menulis "sebagai suami/isteri" - itu selisih penulisan yang nyata, bukan salah baca. Baru melewati SATU salinan KHI.',
      },
    ],
    // "penyakit" dan "sakit" SENGAJA tidak dipakai sendirian - "sakit hati"
    // ada di hampir tiap keterangan saksi perkara perselisihan.
    ciri: ["cacat badan", "cacat tetap", "impoten", "gangguan jiwa"],
    syarat:
      "menuntut AKIBAT: cacat atau penyakitnya harus mengakibatkan tidak dapat menjalankan kewajiban sebagai suami/isteri - periksa apakah akibat itu terbukti, bukan penyakitnya saja | PERHATIAN: blangko [01] belum punya cabang untuk huruf ini - 8503 yang berisi huruf ini membuat 4020, 8521, 8522, 8528, dan 8530 berbunyi 'TIDAK BENAR QUERY NYA' dan kalimat itu ikut tercetak ke dalam putusan",
  },
  {
    huruf: "F",
    siap: true,
    dasar: [
      {
        sumber: SUMBER_PP_9_1975,
        bunyi:
          "Antara suami dan isteri terus-menerus terjadi perselisihan dan pertengkaran dan tidak ada harapan akan hidup rukun lagi dalam rumah tangga",
        catatanNaskah: "",
      },
      {
        sumber: SUMBER_KHI,
        bunyi:
          "antara suami dan isteri terus menerus terjadi perselisihan dan pertengkaran dan tidak ada harapan akan hidup rukun lagi dalam rumah tangga",
        catatanNaskah: 'KHI menulis "terus menerus" tanpa tanda hubung; PP menulis "terus-menerus".',
      },
    ],
    ciri: ["perselisihan", "pertengkaran", "tidak rukun", "tidak harmonis"],
    // Seperti huruf A: syaratnya ada di bunyinya sendiri, dan syarat yang
    // kosong membuat ekstensi mencentangnya sendiri.
    syarat:
      "menuntut perselisihan yang TERUS-MENERUS dan TIDAK ADA HARAPAN akan hidup rukun lagi - periksa keduanya dari keterangan saksi",
  },
  /**
   * ==========================================================================
   * HURUF G - TIDAK DAPAT DIISI, DAN ITU DINYATAKAN
   * ==========================================================================
   *
   * Pelanggaran taklik talak hanya ada di KHI: Pasal 19 PP Nomor 9 Tahun 1975
   * berhenti di huruf f. Tidak ada naskah kedua yang dapat dipakai sebagai
   * gantinya, sehingga huruf ini TIDAK punya satu pun dasar selama naskah KHI
   * belum dapat disalin.
   *
   * Ia dicatat di sini dengan `siap: false` alih-alih dibiarkan tidak ada sama
   * sekali. Bedanya nyata bagi yang memakai layar: huruf yang tidak tercatat
   * tampak seperti huruf yang tidak pernah dipikirkan, sedangkan huruf yang
   * tercatat belum siap muncul pada belumSiap() beserta sebabnya - dan yang
   * menyusun putusan tahu bahwa alasan ini ada, hanya bunyinya yang belum
   * diambil dari naskah resmi.
   *
   * `usulkan()` tidak pernah memulangkannya, berapa pun cirinya cocok.
   */
  {
    huruf: "G",
    // Bunyinya SUDAH ada, tetapi tetap belum siap - dan sebabnya dua, bukan
    // satu. Lihat syarat di bawah. Begitu keduanya terpenuhi, ubah menjadi
    // true; jangan mengubahnya hanya karena bunyinya sudah terisi.
    siap: false,
    dasar: [
      {
        sumber: SUMBER_KHI,
        bunyi: "Suami melanggar taklik talak",
        catatanNaskah:
          'Pindaiannya menulis "menlanggar" - bukan kata Indonesia, dikoreksi menjadi "melanggar". Huruf ini TIDAK punya pembanding sama sekali: Pasal 19 PP Nomor 9 Tahun 1975 berhenti di huruf f, sehingga koreksinya hanya bersandar pada satu salinan. Perhatikan pula ia dimulai huruf besar "Suami" sedangkan huruf lain huruf kecil - belum dapat dipastikan itu memang naskahnya atau ciri pindaian.',
      },
    ],
    ciri: ["taklik talak", "taklik", "ta'lik"],
    syarat:
      "DUA hal harus beres sebelum huruf ini diusulkan. Pertama, bunyinya baru melewati satu salinan KHI dan tidak punya pembanding PP - berkas ini menuntut dua salinan yang disepakati. Kedua, blangko [01] belum punya cabang untuk huruf G, sehingga 8503 yang berisi G membuat 4020, 8521, 8522, 8528, dan 8530 berbunyi 'TIDAK BENAR QUERY NYA' dan kalimat itu ikut tercetak ke dalam putusan.",
  },
  {
    huruf: "H",
    siap: true,
    dasar: [
      {
        sumber: SUMBER_KHI,
        bunyi:
          "peralihan agama atau murtad yang menyebabkan terjadinya ketidak rukunan dalam rumah tangga",
        catatanNaskah:
          'Hanya ada di KHI - Pasal 19 PP 9/1975 berhenti di huruf f. Penulisan "ketidak rukunan" berspasi disalin apa adanya; kedua salinan menuliskannya begitu.',
      },
    ],
    ciri: ["murtad", "pindah agama", "keluar dari agama islam"],
    // Bukan syarat jangka waktu seperti huruf B, melainkan syarat AKIBAT:
    // murtadnya saja tidak cukup, ia harus menyebabkan ketidakrukunan. Itu
    // fakta yang harus dibuktikan di persidangan, dan tidak dapat disimpulkan
    // dari kata "murtad" yang muncul di keterangan saksi.
    syarat:
      "menuntut akibat: murtadnya harus menyebabkan ketidakrukunan rumah tangga - periksa apakah itu terbukti",
  },
];

/**
 * Mengusulkan huruf dari ciri yang ditemukan di keterangan saksi.
 *
 * ============================================================================
 * MENUNJUK, BUKAN MEMUTUSKAN
 * ============================================================================
 *
 * Yang dikembalikan adalah daftar huruf yang PANTAS DIPERIKSA, masing-masing
 * dengan SELURUH dasarnya, kata yang memicunya, dan syarat yang belum tentu
 * terpenuhi. Tidak ada satu pun yang ditandai terpilih, dan tidak satu pun
 * dasarnya disembunyikan - memilihkan naskah mana yang dikutip sama saja
 * dengan memilihkan dasar hukumnya.
 *
 * Huruf yang bunyinya belum diambil dari naskah resmi tidak pernah muncul,
 * berapa pun banyak cirinya cocok.
 */
function usulkan(teksGabungan) {
  const kecil = String(teksGabungan || "").toLowerCase();
  const hasil = [];
  for (const h of HURUF) {
    if (!h.siap) continue;
    const pemicu = h.ciri.filter((kata) => kecil.includes(kata));
    if (pemicu.length === 0) continue;
    hasil.push({ huruf: h.huruf, dasar: h.dasar, pemicu, syarat: h.syarat });
  }
  return hasil;
}

/** Huruf yang bunyinya belum ada, untuk disebut apa adanya di tampilan. */
function belumSiap() {
  return HURUF.filter((h) => !h.siap).map((h) => ({ huruf: h.huruf, sebab: h.syarat }));
}

/** Ciri (kunci CIRI_ALASAN) yang menunjuk huruf A pada blangko [01]. */
const CIRI_HURUF_A = ["zina", "mabuk", "judi", "obat terlarang"];
/** Ciri yang menunjuk huruf tanpa cabang di blangko [01] - tidak diusulkan. */
const CIRI_HURUF_TANPA_CABANG = {
  C: "salah satu pihak menjalani pidana penjara",
  D: "kekerasan dalam rumah tangga",
  E: "cacat badan atau penyakit",
};
const SEBAB_TANPA_CABANG =
  "blangko [01] belum punya cabang untuk huruf ini - 8503 yang berisinya membuat 4020, 8521, 8522, 8528, dan 8530 berbunyi 'TIDAK BENAR QUERY NYA' dan kalimat itu ikut tercetak ke dalam putusan";

/**
 * ============================================================================
 * HURUF UNTUK BLANGKO [01] - DARI CIRI YANG SUDAH DISARING, BUKAN DARI KATA
 * ============================================================================
 *
 * usulkan() di atas menyalakan huruf dari potongan kata atas GABUNGAN
 * keterangan kedua saksi. Terukur atas 318 perkara yang 8503-nya diisi
 * manusia: hanya 27 yang usulannya sama persis dengan pilihan manusia.
 *   - B menyala pada kata "meninggalkan": 311 usulan, 94 dipilih manusia;
 *   - D menyala pada "memukul": 95 usulan, 0 dipilih - dan blangko [01]
 *     tidak punya cabang D sama sekali.
 *
 * Keputusan pengguna 11, yang dijalankan fungsi ini:
 *   F  bila ada perselisihan (disebut saksi mana pun);
 *   B  HANYA bila lama pisah >= 24 bulan (syarat 2 tahun berturut-turut);
 *   A  HANYA dari ciri yang dikuatkan kedua saksi: zina, mabuk, judi, obat;
 *   H  dari ciri murtad yang dikuatkan kedua saksi (blangko [01] mengenalnya);
 *   C, D, E TIDAK diusulkan untuk blangko [01] - kueri 4020/8521/8522/8528/
 *      8530-nya tidak punya cabangnya, dan huruf itu mencetak "TIDAK BENAR
 *      QUERY NYA" ke putusan. Cirinya tidak dibuang diam-diam: ia dipulangkan
 *      pada `tidakDiusulkan` beserta sebabnya.
 * Tidak satu pun dicentang otomatis (centangOtomatis: false, dan tiap huruf
 * membawa syarat - ekstensi hanya mencentang sendiri huruf tanpa syarat).
 *
 * @param {{ciriSaksi1: string[], ciriSaksi2: string[], ciri: string[], lamaPisahBulan: number|null}} bahan
 *   ciri = alasan yang dikuatkan kedua saksi DAN didalilkan (hasil saringan 5227)
 * @returns {{huruf: object[], tidakDiusulkan: {huruf, ciri, sebab}[]}}
 */
function usulkanUntukBlangko01(bahan) {
  const b = bahan || {};
  const ciri = Array.isArray(b.ciri) ? b.ciri : [];
  const gabungan = [...(b.ciriSaksi1 || []), ...(b.ciriSaksi2 || [])];
  const lama = Number.isFinite(b.lamaPisahBulan) ? b.lamaPisahBulan : null;
  const huruf = [];
  const tambah = (kode, pemicu) => {
    const h = HURUF.find((x) => x.huruf === kode);
    if (!h || !h.siap) return;
    huruf.push({ huruf: h.huruf, dasar: h.dasar, pemicu, syarat: h.syarat, centangOtomatis: false });
  };
  const pemicuA = ciri.filter((c) => CIRI_HURUF_A.includes(c));
  if (pemicuA.length) tambah("A", pemicuA);
  if (lama !== null && lama >= 24) tambah("B", [`lama pisah ${lama} bulan`]);
  if (gabungan.includes("perselisihan terus-menerus")) tambah("F", ["perselisihan terus-menerus"]);
  if (ciri.includes("murtad/pindah agama")) tambah("H", ["murtad/pindah agama"]);

  const tidakDiusulkan = Object.entries(CIRI_HURUF_TANPA_CABANG)
    .filter(([, nama]) => ciri.includes(nama))
    .map(([kode, nama]) => ({ huruf: kode, ciri: nama, sebab: SEBAB_TANPA_CABANG }));
  return { huruf, tidakDiusulkan };
}

module.exports = { HURUF, usulkan, belumSiap, usulkanUntukBlangko01, SUMBER_PP_9_1975, SUMBER_KHI };
