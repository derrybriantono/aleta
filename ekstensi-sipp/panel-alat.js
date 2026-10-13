"use strict";

/**
 * ============================================================================
 * PERKAKAS PANEL: GESER, UBAH UKURAN, CIUT, LAYAR PENUH, POSISI, TEMA
 * ============================================================================
 *
 * Panel ALETA di halaman SIPP punya semuanya sejak lama. Panel di halaman ABT
 * lahir belakangan dan tidak punya satu pun - tidak dapat digeser, tidak dapat
 * diubah ukurannya, tidak dapat diciutkan, dan temanya tidak dapat diganti.
 * Untuk panel yang menutupi sisi kanan halaman kerja, itu berarti satu-satunya
 * jalan keluar adalah menutupnya.
 *
 * ============================================================================
 * KENAPA BERKAS BARU, DAN BUKAN MEMAKAI YANG DI konten.js
 * ============================================================================
 *
 * Ini keputusan yang perlu disebut apa adanya, sebab ia melanggar aturan yang
 * dipegang di tempat lain: satu aturan di satu tempat.
 *
 * Fungsi yang sama sudah ada di konten.js. Memindahkannya ke sini dan menyuruh
 * konten.js memakai yang ini memang lebih benar - dan itu memang tujuan
 * akhirnya. Tetapi konten.js melayani panel yang hidup di halaman SIPP, dan
 * halaman itu tidak dapat dibuka dari lingkungan pengembangan ini: ia menuntut
 * sesi SIPP. Memindahkan kode yang tidak dapat diuji ulang berarti bertaruh
 * dengan panel yang hari ini bekerja.
 *
 * KEADAAN SEKARANG - LANGKAH PERTAMA SUDAH DIAMBIL
 *
 * Berkas ini kini dimuat di KEDUA halaman - SIPP dan ABT - dan lingkupnya
 * diperiksa bersih dari tabrakan nama sebelum dipasang: sembilan belas
 * deklarasi puncak di sini, tidak satu pun bertabrakan dengan 150 milik
 * konten.js maupun 56 milik abt.js. Awalan alat* itulah yang membuatnya
 * mungkin.
 *
 * Yang SUDAH dipakai bersama: alatPesanGagal - satu kalimat untuk kegagalan
 * sambungan, dipakai kedua halaman.
 *
 * Yang BELUM: fungsi panel masih kembar - satu salinan di sini dan satu di
 * konten.js.
 *
 * ============================================================================
 * KEMBARNYA SUDAH DIADU, DAN HASILNYA MENGUBAH APA YANG TERSISA
 * ============================================================================
 *
 * Dahulu tertulis di sini bahwa penyatuannya "menuntut panel SIPP dibuka di
 * layar sungguhan". Itu benar untuk langkah terakhirnya saja, dan menjadi
 * alasan menunda seluruhnya.
 *
 * Sekarang keduanya dijalankan atas panel palsu yang sama lalu diadu ruas demi
 * ruas - lihat uji panel-kembar-setara. Yang terbukti SETARA, lengkap dengan
 * pembulatan dan perlakuan tepi layarnya:
 *
 *   jepitKeLayar          - argumen tinggi pada versi konten.js ternyata mati
 *   jepitTinggi           - rumusnya berbeda bentuk, sama hasilnya
 *   terapkanPosisi        - termasuk ukuran melebihi layar dan tinggi nol
 *   normalkanJangkar      - termasuk pembulatan pecahan piksel
 *   kembalikanBawaan      - gaya yang dibersihkan sama persis
 *
 * Satu selisih ketemu dan sudah ditutup: alatJepitTinggi tidak berhenti pada
 * panel yang sedang menjadi lencana, sedangkan kembarannya berhenti.
 *
 * ============================================================================
 * YANG TERSISA CUMA SATU, DAN INILAH YANG MENUNTUT SATU TARIKAN SUNGGUHAN
 * ============================================================================
 *
 * Cara MENYIMPANNYA berbeda, dan keduanya benar:
 *
 *   konten.js   mengingat sebagian - geser menyimpan kiri/atas saja, lalu
 *               digabung dengan lebar/tinggi yang sudah diingat sebelumnya
 *   di sini     mengukur ulang seluruh kotak tiap kali menyimpan
 *
 * Akibatnya berbeda hanya pada satu keadaan: panel yang BELUM PERNAH diubah
 * ukurannya. konten.js tidak menyimpan lebarnya sama sekali sehingga panel
 * mengikuti lebar bawaan CSS; yang di sini menyimpan lebar terukur sehingga
 * panel mengunci lebar yang berlaku saat itu. Hari ini keduanya menghasilkan
 * tampilan yang sama - dan akan berselisih pada hari lebar bawaannya diubah.
 *
 * Itulah satu-satunya yang tersisa, dan ia hanya menampakkan diri pada
 * tarikan sungguhan di halaman SIPP. Sampai itu dapat dilakukan: fungsi BARU
 * ditulis di sini saja dan dipakai keduanya - seperti alatPesanGagal. Yang
 * dilarang menambah salinan baru ke konten.js.
 *
 * ============================================================================
 * BEDANYA DENGAN YANG DI konten.js
 * ============================================================================
 *
 * Yang di sini tidak menyimpan keadaan di lingkup modul. Tiap fungsi menerima
 * panelnya dan kunci penyimpanannya sebagai argumen, sehingga satu halaman
 * dapat memasang lebih dari satu panel tanpa keduanya saling menimpa posisi.
 * Itu bukan kebutuhan hari ini, tetapi ia yang membuat berkas ini dapat
 * dipakai konten.js nanti tanpa diubah lagi.
 */

/** Menjaga panel tetap terlihat walau jendela diperkecil setelah digeser. */
function alatJepitKeLayar(kiri, atas, lebar) {
  return {
    kiri: Math.min(Math.max(kiri, 0), Math.max(window.innerWidth - lebar, 0)),
    atas: Math.min(Math.max(atas, 0), Math.max(window.innerHeight - 40, 0)),
  };
}

/**
 * Tingginya dijepit ke ruang yang tersisa DI BAWAH posisinya, dan berhenti di
 * tiga per lima layar.
 *
 * Sebabnya sama seperti pada panel SIPP: panel ber-overflow:hidden yang lebih
 * tinggi daripada ruang tersisa tidak menggulung - ia hanya menjulur keluar
 * layar, dan butir terbawahnya tidak pernah dapat diklik. Tidak ada yang
 * tampak rusak; yang tidak terjadi hanya menggulung.
 */
function alatJepitTinggi(panel) {
  if (!panel) return;
  if (panel.classList.contains("aleta-panel-penuh")) return;
  if (panel.classList.contains("aleta-panel-ciut")) return;

  // ==========================================================================
  // LENCANA TIDAK DIJEPIT - PENJAGA YANG SEBELUMNYA HILANG DI SINI
  // ==========================================================================
  //
  // Salinan kembarnya di konten.js sudah lama berhenti pada panel yang sedang
  // menjadi logo melayang; yang di sini tidak. Ketahuan saat keduanya diadu -
  // lihat panel-kembar-setara.
  //
  // Belum berakibat apa-apa hari ini, dan sebabnya kebetulan: pemulihan
  // keadaan memanggil alatCiutkan lalu SEGERA memanggil fungsi ini, tetapi
  // lencana selalu lebih pendek daripada lantai 160 piksel sehingga ia keluar
  // pada pemeriksaan tinggi di bawah.
  //
  // Kebetulan itu tidak boleh dijadikan penjagaan. Lencana yang kelak dibuat
  // lebih besar akan mendapat tinggi paksa tanpa seorang pun memintanya, dan
  // gejalanya - logo melayang yang tiba-tiba memanjang - tidak akan
  // menunjukkan sebabnya.
  if (panel.classList.contains(KELAS_LENCANA)) return;

  const kotak = panel.getBoundingClientRect();
  const sisa = Math.max(window.innerHeight - kotak.top - 12, 160);
  // Sepertiga tinggi jendela, dengan ATAP separuh layar.
  //
  // Batas pertamanya tiga per lima, dan itu masih terlalu tinggi: pada layar
  // 1080 berarti hampir 600 piksel panel yang menutupi sisi kanan halaman
  // kerja, lalu terpotong di tepi bawah begitu isinya lebih panjang daripada
  // jatahnya. Lantai 240 piksel menjaganya tetap terbaca pada jendela yang
  // sangat pendek, dan atap separuh layar menjaga lantai itu sendiri tidak
  // berbalik menjadi panel yang menutupi segalanya.
  const idaman = Math.min(
    Math.max(Math.round(window.innerHeight / 2), 320),
    Math.round((window.innerHeight * 2) / 3)
  );
  const batas = panel.dataset.tinggiSendiri === "1" ? sisa : Math.min(sisa, idaman);
  if (kotak.height <= batas) return;

  panel.style.height = `${Math.round(batas)}px`;
  panel.style.maxHeight = `${Math.round(batas)}px`;
}

/**
 * Menjangkarkan panel pada kiri-atas, bukan pada kanan-atas.
 *
 * Pada jangkar kanan, menarik sudut kanan-bawah untuk MELEBARKAN justru
 * menumbuhkan panel ke kiri sementara sudut yang ditarik diam di tempat -
 * terasa terbalik, dan orang berhenti mencoba. Dijangkarkan ulang pada
 * koordinat yang persis sama, sehingga tampilannya tidak bergeser sedikit pun.
 */
function alatNormalkanJangkar(panel) {
  if (!panel || panel.style.left) return;
  const kotak = panel.getBoundingClientRect();
  panel.style.left = `${Math.round(kotak.left)}px`;
  panel.style.top = `${Math.round(kotak.top)}px`;
  panel.style.right = "auto";
  panel.style.bottom = "auto";
}

async function alatMuatPosisi(kunci) {
  try {
    const simpan = await chrome.storage.local.get([kunci]);
    const posisi = simpan[kunci];
    if (!posisi || typeof posisi !== "object") return null;
    return posisi;
  } catch {
    return null;
  }
}

function alatSimpanPosisi(kunci, posisi) {
  try {
    void chrome.storage.local.set({ [kunci]: posisi });
  } catch {
    /* penyimpanan tidak tersedia - posisinya berlaku untuk halaman ini saja */
  }
}

/* === POSISI-AWAL 12 Okt === */
//
// SESI BARU: panel ALETA di KANAN ATAS dengan ukuran yang nyaman.
//
// Letaknya sudah kanan atas (panel.css: top/right 12px) selama petugas belum
// pernah menggesernya; yang kurang adalah UKURAN - 460px dan setinggi isinya
// terasa sempit, dan setiap petugas baru menariknya sendiri dulu supaya besar.
// Bawaan sekarang dihitung dari layar: lebar sepertiga layar (paling sedikit
// 520px, paling banyak 760px) dan tinggi 70% layar - tidak pernah melewati
// layarnya. Ukuran yang SUDAH tersimpan (ditarik petugas) tidak disentuh.
const ALAT_AWAL_LEBAR_MIN = 520;
const ALAT_AWAL_LEBAR_MAKS = 760;
const ALAT_AWAL_TEPI = 12;

function alatUkuranAwal() {
  const w = Number(window.innerWidth) || 0;
  const h = Number(window.innerHeight) || 0;
  if (w <= 0 || h <= 0) return null;
  const lebarLayar = Math.max(w - ALAT_AWAL_TEPI * 2, 260);
  const tinggiLayar = Math.max(h - ALAT_AWAL_TEPI * 2, 160);
  const lebar = Math.min(Math.max(Math.round(w * 0.33), ALAT_AWAL_LEBAR_MIN), ALAT_AWAL_LEBAR_MAKS, lebarLayar);
  const tinggi = Math.min(Math.max(Math.round(h * 0.7), 420), tinggiLayar);
  return { lebar, tinggi };
}

/**
 * Memasang ukuran bawaan pada yang BELUM punya ukuran tersimpan (lebar dan
 * tinggi dinilai sendiri-sendiri). Dipanggil sebelum jangkar dinormalkan -
 * lebar baru dipasang selagi panel masih berjangkar kanan, jadi sudut kanan
 * atasnya tetap di tempat. Mengembalikan true bila ada yang dipasang.
 */
function alatTerapkanUkuranAwal(panel, posisi) {
  if (!panel || !panel.style) return false;
  // SYARAT MUTLAK (tahap 7): tampilan Lama identik dengan fd9aad7 sampai ke
  // gaya sebaris panelnya - ukuran bawaan besar hanya di Baru dan UI Baru.
  try {
    if (alatUjiMode() === "lama") return false;
  } catch {
    return false;
  }
  const awal = alatUkuranAwal();
  if (!awal) return false;
  const simpan = posisi && typeof posisi === "object" ? posisi : {};
  let dipasang = false;
  if (!(typeof simpan.lebar === "number" && simpan.lebar > 0)) {
    panel.style.width = `${awal.lebar}px`;
    dipasang = true;
  }
  if (!(typeof simpan.tinggi === "number" && simpan.tinggi > 0)) {
    panel.style.height = `${awal.tinggi}px`;
    panel.style.maxHeight = "none";
    // Tingginya bawaan yang disengaja: batas idaman (sepertiga layar) tidak
    // memotongnya, hanya tepi layar.
    panel.dataset.tinggiSendiri = "1";
    dipasang = true;
  }
  return dipasang;
}
/* === AKHIR POSISI-AWAL === */

function alatTerapkanPosisi(panel, posisi) {
  if (!panel || !posisi) return;

  // Ukuran lebih dulu: posisinya dijepit terhadap ukuran yang SUDAH berlaku,
  // bukan terhadap ukuran bawaan yang sebentar lagi berubah.
  if (typeof posisi.lebar === "number" && posisi.lebar > 0) {
    panel.style.width = `${Math.min(posisi.lebar, Math.max(window.innerWidth - 20, 260))}px`;
  }
  if (typeof posisi.tinggi === "number" && posisi.tinggi > 0) {
    panel.dataset.tinggiSendiri = "1";
    panel.style.height = `${Math.min(posisi.tinggi, Math.max(window.innerHeight - 20, 160))}px`;
    panel.style.maxHeight = "none";
  }
  if (typeof posisi.kiri === "number" && typeof posisi.atas === "number") {
    const kotak = panel.getBoundingClientRect();
    const aman = alatJepitKeLayar(posisi.kiri, posisi.atas, kotak.width || 320);
    panel.style.left = `${aman.kiri}px`;
    panel.style.top = `${aman.atas}px`;
    panel.style.right = "auto";
    panel.style.bottom = "auto";
  }
  alatJepitTinggi(panel);
}

/** Mengembalikan panel ke tempat, ukuran, dan tampilan bawaannya. */
/**
 * ============================================================================
 * MENYINGKIR TANPA MENCARI TOMBOLNYA
 * ============================================================================
 *
 * Panel ini melayang di atas halaman milik aplikasi lain dan kerap menutupi
 * tepat bagian yang sedang dibaca. Tombol ciutnya ada di kepala panel - yang
 * berarti untuk menyingkirkan panel, orang harus lebih dahulu menemukan
 * panelnya.
 *
 * Dua jalan keluar yang sudah dikenal orang dari aplikasi lain:
 *
 *   Escape                 satu tekanan, tanpa memindahkan tangan dari papan
 *   klik DUA KALI di luar   isyarat "saya sedang mengerjakan yang di bawah"
 *
 * Kenapa DUA kali, bukan sekali: panel ini dipakai berdampingan dengan
 * halaman di bawahnya - petugas menyalin nomor perkara dari tabel SIPP lalu
 * kembali ke panel. Menciutkannya pada klik pertama di luar membuat panel
 * hilang setiap kali orang menyentuh halaman, dan ia harus dibentangkan lagi
 * berkali-kali dalam satu menit.
 *
 * Escape TIDAK menciutkan bila sedang ada yang disunting: kotak isian memakai
 * Escape untuk membatalkan suntingan, dan merebutnya berarti menutup panel
 * sekaligus membuang ketikan orang.
 */
/**
 * ============================================================================
 * MODE SUNTING LANGSUNG DI ABT - BAWAANNYA MATI
 * ============================================================================
 *
 * Panel ABT membuat tiap nilai variabel dapat disunting hanya dengan
 * mengkliknya. Cepat bagi yang memang hendak menyunting, dan berbahaya bagi
 * yang tidak: satu klik salah sasaran pada baris yang sedang dibaca membuka
 * kotak isian di atas nilai yang benar, dan yang menutupnya dengan
 * mengklik ke tempat lain tidak selalu sadar apakah ketikannya tersimpan.
 *
 * Halaman ABT adalah tempat naskah putusan disusun. Membuka suntingan karena
 * kebetulan tersentuh adalah risiko yang tidak sebanding dengan waktu yang
 * dihemat satu klik.
 *
 * MATI secara bawaan, dan itu keputusan: perilaku yang mengubah isi berkas
 * perkara tidak pantas menyala tanpa ada yang menyalakannya. Saat mati, tiap
 * baris tetap punya tombol suntingnya sendiri - jalannya lebih panjang satu
 * tekanan, dan tekanan itulah yang menyatakan kehendak.
 */
const KUNCI_SUNTING_LANGSUNG = "suntingLangsungAbt";

async function alatSuntingLangsung() {
  try {
    const simpan = await chrome.storage.local.get([KUNCI_SUNTING_LANGSUNG]);
    return simpan[KUNCI_SUNTING_LANGSUNG] === true;
  } catch {
    // Penyimpanan tidak terbaca = anggap MATI. Yang gagal dibaca tidak boleh
    // menyalakan perilaku yang mengubah berkas perkara.
    return false;
  }
}

async function alatSetelSuntingLangsung(nyala) {
  try {
    await chrome.storage.local.set({ [KUNCI_SUNTING_LANGSUNG]: nyala === true });
  } catch {
    /* tanpa penyimpanan, saklarnya hanya berlaku selama halaman hidup */
  }
}

/**
 * ============================================================================
 * TINGKAP MILIK HALAMANNYA SENDIRI - ESCAPE DI SANA BUKAN MILIK KITA
 * ============================================================================
 *
 * SIPP membuka borangnya lewat popup_form(): sebuah div berkelas .popup yang
 * ditempelkan ke body dan diisi lewat AJAX. ABT memakai magnific popup
 * (.mfp-wrap). Keduanya tingkap sungguhan di mata yang memakainya, dan
 * Escape di atas tingkap yang terbuka berarti "tutup tingkap ini" - bukan
 * "ciutkan panel ALETA di belakangnya".
 *
 * Merebutnya menghasilkan kejadian yang paling membingungkan: tingkapnya
 * tetap terbuka menutupi layar, sementara panel yang TIDAK sedang dilihat
 * diam-diam menciut di baliknya.
 */
function alatTingkapHalamanTerbuka() {
  const PEMILIH =
    "#popup_form, #popup_form_2nd, #popup_form_3rd, #popup_form_4th, #popup-detil, .mfp-wrap";
  try {
    for (const tingkap of document.querySelectorAll(PEMILIH)) {
      // getClientRects, bukan offsetParent: tingkap SIPP position:fixed, dan
      // offsetParent elemen fixed selalu null - pemeriksaan itu akan
      // mengatakan "tidak ada" pada tingkap yang sedang menutupi layar.
      if (tingkap.getClientRects().length > 0) return true;
    }
  } catch {
    /* pemilih tidak dikenali peramban: anggap tidak ada tingkap */
  }
  return false;
}

/**
 * ============================================================================
 * SATU PASANG PENDENGAR UNTUK SELURUH HALAMAN, BUKAN SEPASANG TIAP PANEL
 * ============================================================================
 *
 * Bentuk pertamanya memasang sepasang pendengar document tiap kali satu panel
 * dipasang. Itu tidak terasa selama panelnya dibangun sekali seumur halaman -
 * dan panel ABT maupun portal memang begitu.
 *
 * Panel SIPP tidak. Ia digambar ULANG tiap kali tingkap SIPP terbuka atau
 * tertutup - Putusan Akhir, Data Umum, e-Doc - dan tiap penggambaran
 * melahirkan panel baru beserta sepasang pendengar baru. Yang lama tidak
 * pernah dilepas: ia hanya berhenti berbuat apa-apa sebab panelnya sudah
 * tidak terpasang. Sesudah sehari bekerja, puluhan pendengar menumpuk di
 * dokumen yang sama dan ikut dijalankan pada TIAP tekanan tombol.
 *
 * Sekarang pendengarnya satu pasang seumur halaman, dan panelnya yang
 * didaftarkan ke sini. Yang panelnya sudah dibuang dikeluarkan dari daftar -
 * tetapi hanya sesudah ia pernah benar-benar terpasang, sebab jalan keluar
 * ini dipasang alatPasangPanel SEBELUM panelnya ditempelkan ke body (lihat
 * susunPanelAbt); membuangnya lebih awal berarti membunuhnya di dalam
 * kandungan.
 */
const alatDaftarKeluar = new Set();
let alatKeluarTerpasang = false;

/** Panel yang masih hidup, sekaligus membersihkan yang sudah tidak ada. */
function alatPanelKeluarHidup() {
  const hidup = [];
  for (const entri of Array.from(alatDaftarKeluar)) {
    if (!entri.panel.isConnected) {
      if (entri.pernah) alatDaftarKeluar.delete(entri);
      continue;
    }
    entri.pernah = true;
    hidup.push(entri);
  }
  return hidup;
}

/**
 * Escape dan klik ganda di luar - dua jalan keluar tanpa mencari tombolnya.
 *
 * `opsi.ciutkan` disediakan untuk panel yang menciut dengan caranya sendiri.
 * Panel SIPP menyimpan keadaan lencananya lewat simpanKeadaanPanel di
 * konten.js, bukan lewat alatSimpanPosisi - dan dua penyimpan untuk satu
 * keadaan akan saling menimpa.
 */
function alatPasangJalanKeluar(panel, kunci, opsi) {
  // Pita "Pembaruan tersedia" (butir 24, Baru & UI Baru) - pintu ini dilewati
  // ketiga panel, termasuk panel SIPP yang menyusun kepalanya sendiri.
  // Didaftarkan SEBELUM pagar di bawah: panel yang isinya disusun ulang
  // mendapatkan pitanya lagi. Pendaftarannya idempoten.
  if (panel && typeof alatPasangPitaPembaruan === "function") alatPasangPitaPembaruan(panel);
  if (!panel || panel.dataset.jalanKeluar === "1") return;
  panel.dataset.jalanKeluar = "1";
  alatDaftarKeluar.add({ panel, kunci: String(kunci || ""), opsi: opsi || {}, pernah: false });
  // Perbaikan 2 Okt (UI Baru; gerbangnya ditanyakan saat bertindak): butir 11
  // klik dua kali di sudut = pindah ke sudut itu, butir 4 panel situs yang
  // disetel tersembunyi lahir sebagai lencana. Lihat bagian 3e.
  if (typeof alatPasangSudut === "function") {
    const o = opsi || {};
    const pindah = typeof o.pindahKeSudut === "function" ? o.pindahKeSudut : panel.aletaPindahKeSudut;
    alatPasangSudut(panel, { kunci, saatPindah: typeof pindah === "function" ? pindah : null });
  }
  if (typeof alatTerapkanBawaanTampil === "function") void alatTerapkanBawaanTampil(panel, kunci, opsi);

  if (alatKeluarTerpasang) return;
  alatKeluarTerpasang = true;

  // ==========================================================================
  // HANYA ISIAN DI DALAM PANEL YANG MEREBUT ESCAPE
  // ==========================================================================
  //
  // Bentuk pertamanya memeriksa document.activeElement saja: isian mana pun
  // yang sedang berfokus membatalkan Escape. Alasannya benar untuk isian
  // MILIK PANEL - di sana Escape membatalkan suntingan, dan merebutnya
  // berarti membuang ketikan orang.
  //
  // Tetapi SIPP dan ABT adalah halaman borang dari ujung ke ujung. Satu klik
  // pada kolom mana pun - dan itulah yang dikerjakan orang sepanjang hari -
  // membuat fokus tinggal di kotak isian halaman, sehingga Escape TIDAK
  // PERNAH sampai ke panel. Di halaman portal ALETA, yang hampir tidak punya
  // borang, jalan keluarnya bekerja seperti seharusnya.
  //
  // Itulah "escape tidak berfungsi di sipp dan abt, di aleta berfungsi":
  // bukan pendengarnya tidak terpasang, melainkan syaratnya hampir selalu
  // terpenuhi di kedua halaman itu.
  const sedangMenyunting = (panel) => {
    const fokus = document.activeElement;
    if (!fokus) return false;
    // Isian HALAMAN bukan urusan panel ini. Yang mengetik di kolom SIPP lalu
    // menekan Escape tidak kehilangan apa pun - panelnya menciut, dan
    // ketikannya utuh.
    if (!panel.contains(fokus)) return false;
    const tag = String(fokus.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return true;
    return fokus.isContentEditable === true;
  };

  const ciutkan = (entri) => {
    const panel = entri.panel;
    if (panel.classList.contains("aleta-panel-lencana")) return;
    if (entri.opsi && typeof entri.opsi.ciutkan === "function") {
      entri.opsi.ciutkan();
      return;
    }
    alatCiutkan(panel, entri.kunci, true);
  };

  document.addEventListener(
    "keydown",
    (peristiwa) => {
      if (peristiwa.key !== "Escape") return;
      if (alatTingkapHalamanTerbuka()) return;
      // continue, bukan return: dua panel dapat hidup berdampingan di halaman
      // ABT, dan yang sedang disunting di salah satunya tidak menahan yang
      // lain - itu pula perilaku bentuk lamanya, ketika tiap panel punya
      // pendengarnya sendiri.
      for (const entri of alatPanelKeluarHidup()) {
        if (sedangMenyunting(entri.panel)) continue;
        ciutkan(entri);
      }
    },
    true
  );

  // Pada fase TANGKAP, sama seperti Escape di atas. SIPP dan ABT keduanya
  // halaman jQuery yang memasang pendengarnya sendiri di mana-mana, dan
  // pendengar yang menghentikan gelembung membuat klik ganda tidak pernah
  // sampai ke document - tanpa satu pun tanda bahwa ia dihentikan.
  document.addEventListener(
    "dblclick",
    (peristiwa) => {
      if (alatTingkapHalamanTerbuka()) return;
      /* === 12OKT-G: klik dua kali untuk menyunting sel ABT bukan permintaan menyingkir === */
      // Saklar "Sunting langsung (klik dua kali)" menyala: klik dua kali pada sel
      // ABT membuka penyunting, dan klik dua kali di dalam kotak penyunting
      // memilih kata - panel tidak boleh ikut menciut. (suntingLangsungNyala
      // milik abt.js; belum ada di halaman tanpa abt.js.)
      const sasaranDua = peristiwa.target && typeof peristiwa.target.closest === "function" ? peristiwa.target : null;
      if (sasaranDua) {
        if (sasaranDua.closest(".aleta-abt-sunting")) return;
        if (sasaranDua.closest(".aleta-abt-dapat-disunting") && typeof suntingLangsungNyala !== "undefined" && suntingLangsungNyala) return;
      }
      /* === AKHIR 12OKT-G === */
      // Butir 11 (2 Okt, UI Baru): klik dua kali di SUDUT panel/widget ALETA
      // memindahkannya - bukan permintaan menyingkir bagi panel lain.
      if (typeof alatSudutCari === "function" && alatSudutCari(peristiwa.clientX, peristiwa.clientY, ALAT_SUDUT_ZONA, 0)) return;
      for (const entri of alatPanelKeluarHidup()) {
        const panel = entri.panel;
        // Di DALAM panel, klik ganda adalah memilih kata - bukan permintaan
        // menyingkir.
        if (panel.contains(peristiwa.target)) continue;
        ciutkan(entri);
      }
    },
    true
  );
}

function alatKembalikanBawaan(panel, kunci) {
  try {
    void chrome.storage.local.remove(kunci);
  } catch {
    /* yang penting tampilannya sudah kembali */
  }
  for (const sifat of ["left", "top", "right", "bottom", "width", "height", "maxHeight"]) {
    panel.style[sifat] = "";
  }
  delete panel.dataset.tinggiSendiri;
  panel.classList.remove("aleta-panel-penuh", "aleta-panel-ciut");

  // ==========================================================================
  // DIJANGKARKAN KE KANAN SECARA EKSPLISIT, BUKAN DISERAHKAN KE CSS
  // ==========================================================================
  //
  // Bawaan panel adalah top 12px KANAN 12px, dan membersihkan gaya sebaris
  // seharusnya mengembalikannya ke sana. Nyatanya tidak selalu: panel yang
  // pernah digeser sudah dijangkarkan ulang ke kiri oleh alatNormalkanJangkar
  // (right:auto + left px), dan pada halaman yang aturan CSS-nya bertumpuk -
  // ABT dan halaman ALETA di antaranya - jangkar kanan itu tidak selalu
  // menang kembali. Hasilnya panel melompat ke KIRI, menutupi tempat kerja.
  //
  // Menuliskannya sendiri membuat hasilnya sama di ketiga halaman, tanpa
  // bergantung pada aturan mana yang kebetulan lebih kuat.
  panel.style.right = "12px";
  panel.style.top = "12px";
  panel.style.left = "auto";
  panel.style.bottom = "auto";

  alatJepitTinggi(panel);
}

/**
 * Menggeser panel dengan menarik kepalanya.
 *
 * Memakai pointer event, bukan mouse event: satu jalur untuk tetikus, sentuh,
 * dan pena sekaligus. setPointerCapture membuat panel tetap mengikuti walau
 * penunjuknya keluar dari jendela - tanpa itu, tarikan cepat "terlepas" di
 * tepi layar dan panel tertinggal di tengah jalan.
 */
/**
 * ============================================================================
 * CIUT MENJADI LENCANA - BUKAN KOTAK KOSONG
 * ============================================================================
 *
 * Yang dulu terjadi ketika panel diciutkan: isinya disembunyikan dan KEPALANYA
 * tetap ada - selebar panel semula, kosong, dengan deretan tombol di kanannya.
 * Di layar itu terbaca sebagai panel yang rusak, bukan panel yang diciutkan.
 * Ia menutupi separuh lebar halaman kerja tanpa menampilkan satu pun
 * keterangan, dan tetap harus disingkirkan dengan tangan.
 *
 * Sekarang yang tersisa satu lencana bulat berisi logo ALETA:
 *
 *   - dapat digeser, sama seperti panelnya - itu sebabnya ia dipasang pada
 *     elemen panel yang SAMA, bukan elemen baru; seluruh perkakas geser,
 *     jepit tepi layar, dan simpan posisi berlaku apa adanya
 *   - satu klik membentangkannya kembali, dan klik ganda juga - lihat
 *     catatan di bawah tentang bedanya klik dari tarikan
 *   - posisinya disimpan terpisah dari posisi panel yang terbentang, supaya
 *     lencana yang ditaruh di pojok tidak memindahkan panelnya sekalian
 *
 * ============================================================================
 * MEMBEDAKAN KLIK DARI TARIKAN - INI YANG PALING MUDAH SALAH
 * ============================================================================
 *
 * Lencana ini dua-duanya sekaligus: sasaran tarikan DAN tombol. Tanpa
 * pembeda, tiap tarikan berakhir dengan panel yang terbentang kembali - sebab
 * tiap tarikan diakhiri satu pointerup di atas lencananya.
 *
 * Pembedanya JARAK, bukan waktu. Tarikan sependek dua piksel tetap tarikan
 * bila jarinya bergeser, dan tekanan selama satu detik tetap klik bila
 * jarinya diam. Ambangnya 4 piksel: cukup longgar untuk tangan yang gemetar,
 * cukup ketat untuk tidak menelan tarikan yang sungguhan.
 *
 * alatPasangGeser menandai panel dengan data-baru-digeser setiap kali
 * pergeserannya melewati ambang itu, dan penanda itu yang dibaca di sini.
 */
const KELAS_LENCANA = "aleta-panel-lencana";

/** Menyimpan ukuran terbentang supaya membentangkan kembali tidak menebak. */
function alatCiutkan(panel, kunci, jadikanLencana) {
  const sedang = panel.classList.contains(KELAS_LENCANA);
  const mau = jadikanLencana === undefined ? !sedang : Boolean(jadikanLencana);
  if (mau === sedang) return;

  if (mau) {
    // Ukuran terbentangnya dicatat di elemennya sendiri, bukan di penyimpanan:
    // ia hanya berlaku selama halaman ini terbuka, dan menuliskannya ke
    // chrome.storage berarti satu tulisan tiap kali tombolnya ditekan.
    const kotak = panel.getBoundingClientRect();
    panel.dataset.lebarSemula = String(Math.round(kotak.width));
    panel.dataset.tinggiSemula = String(Math.round(kotak.height));
    panel.classList.add(KELAS_LENCANA);
    panel.classList.remove("aleta-panel-penuh");
    panel.style.width = "";
    panel.style.height = "";
    panel.style.maxHeight = "";
    panel.title = "Klik untuk membentangkan panel ALETA";
  } else {
    panel.classList.remove(KELAS_LENCANA);
    panel.removeAttribute("title");
    if (panel.dataset.lebarSemula) panel.style.width = `${panel.dataset.lebarSemula}px`;
    if (panel.dataset.tinggiSemula) {
      panel.style.height = `${panel.dataset.tinggiSemula}px`;
      panel.style.maxHeight = "none";
    }
    alatJepitTinggi(panel);
  }

  // Dijepit ke tepi layar sesudah ukurannya berubah, bukan sebelum: lencana
  // yang diletakkan di pojok kanan bawah akan menjulur keluar begitu ia
  // membentang menjadi panel selebar tiga ratus piksel.
  const kotak = panel.getBoundingClientRect();
  const aman = alatJepitKeLayar(kotak.left, kotak.top, kotak.width);
  panel.style.left = `${aman.kiri}px`;
  panel.style.top = `${aman.atas}px`;
  panel.style.right = "auto";
  panel.style.bottom = "auto";

  const tombol = panel.querySelector(".aleta-lipat");
  if (tombol) {
    tombol.textContent = mau ? "▢" : "–";
    tombol.title = mau ? "Bentangkan panel" : "Ciutkan menjadi lencana";
  }

  alatSimpanPosisi(kunci, {
    kiri: Math.round(aman.kiri),
    atas: Math.round(aman.atas),
    lebar: Number(panel.dataset.lebarSemula) || undefined,
    tinggi: Number(panel.dataset.tinggiSemula) || undefined,
    lencana: mau,
  });
}

/**
 * Memasang lencananya dan pendengar yang membentangkannya kembali.
 *
 * Logonya dari berkas ekstensi, bukan huruf "A" yang digambar dengan CSS:
 * yang melayang di atas halaman aplikasi lain harus dapat dikenali dalam
 * sekejap sebagai milik ALETA, dan sekejap itu tidak cukup untuk membaca.
 */
function alatPasangLencana(panel, kunci) {
  const lencana = document.createElement("div");
  lencana.className = "aleta-lencana";

  let alamatLogo = "";
  try {
    alamatLogo = chrome.runtime.getURL("ikon/aleta-32.png");
  } catch {
    /* di luar ekstensi - huruf yang dipakai sebagai gantinya */
  }

  if (alamatLogo) {
    const gambar = document.createElement("img");
    gambar.src = alamatLogo;
    gambar.alt = "ALETA";
    gambar.draggable = false;
    lencana.appendChild(gambar);
  } else {
    lencana.textContent = "A";
  }

  panel.appendChild(lencana);

  // Satu klik DAN klik ganda, keduanya membentangkan. Klik ganda sebenarnya
  // sudah tercakup - klik pertamanya membentangkan, klik keduanya jatuh pada
  // panel yang sudah terbentang dan tidak mengerjakan apa-apa. Pendengar
  // dblclick tetap dipasang supaya tarikan yang berakhir dengan ketukan
  // cepat - yang penandanya masih menyala - tetap dapat membentangkan.
  const bentangkan = (peristiwa) => {
    // ====================================================================
    // KLIK DARI SEBUAH TOMBOL BUKAN KLIK PADA LENCANA
    // ====================================================================
    //
    // Inilah yang membuat tombol ciutkan "tidak bekerja" di panel ABT dan
    // panel portal - dan kerjanya justru sempurna, hanya dibatalkan
    // seketika oleh pendengar ini.
    //
    // Urutannya dalam SATU peristiwa klik:
    //   1. tombol .aleta-lipat ditekan  -> alatCiutkan(..., true)
    //   2. panel menyandang KELAS_LENCANA          <- sudah menciut
    //   3. peristiwa yang sama menggelembung ke panel
    //   4. bentangkan berjalan; pagar KELAS_LENCANA di bawah justru TERBUKA,
    //      sebab kelasnya baru saja dipasang tiga langkah sebelumnya
    //   5. alatCiutkan(..., false)                 <- terbentang lagi
    //
    // Hasil bersihnya nol, tanpa satu galat pun. Bukti yang menguatkan:
    // tombolnya BERHASIL tepat sesudah panel digeser - sebab penanda
    // baruDigeser masih menyala dan menghentikan langkah 4.
    //
    // Panel SIPP tidak terkena karena pendengarnya dipasang pada elemen
    // lencananya, bukan pada panel. Di sini ia memang harus pada panel -
    // tangkapan penunjuk membelokkan klik ke panel, lihat catatan panjang di
    // bawah - jadi yang ditambahkan pagarnya, bukan tempatnya.
    //
    // Aman: begitu panel menjadi lencana, seluruh kepala beserta tombolnya
    // display:none, sehingga tidak ada tombol yang dapat ditekan untuk
    // membentangkannya kembali.
    const sasaran = peristiwa && peristiwa.target;
    if (sasaran && typeof sasaran.closest === "function") {
      if (sasaran.closest("button, a, input, select, textarea, label")) return;
    }
    if (!panel.classList.contains(KELAS_LENCANA)) return;
    if (panel.dataset.baruDigeser === "1") {
      // Tarikan, bukan klik. Penandanya dilepas supaya klik BERIKUTNYA -
      // yang jarinya diam - dapat membentangkan.
      delete panel.dataset.baruDigeser;
      return;
    }
    peristiwa.preventDefault();
    peristiwa.stopPropagation();
    alatCiutkan(panel, kunci, false);
  };

  // ------------------------------------------------------------------
  // PENDENGARNYA PADA PANEL, BUKAN PADA LENCANA - DAN ITU BUKAN KELALAIAN
  // ------------------------------------------------------------------
  //
  // alatPasangGeser menangkap penunjuk pada PANEL di setiap pointerdown, dan
  // selama tangkapan itu berlaku peramban membelokkan `click` serta `dblclick`
  // ke elemen penangkap. Lencana hanya ANAK panel, jadi peristiwa yang mendarat
  // di induk tidak pernah turun kepadanya: dipasang pada lencana, pendengar ini
  // tidak pernah berjalan sekali pun, dan panel yang sudah diciutkan tidak
  // dapat dibuka lagi - tanpa satu galat pun tercatat.
  //
  // Halaman SIPP tidak terkena sebab konten.js menggeser panelnya dengan
  // mousedown dan tidak pernah menangkap penunjuk. Yang terkena hanya ALETA dan
  // ABT, yang berbagi berkas ini - persis seperti yang dilaporkan.
  //
  // Dipasang pada panel, ia benar pada KEDUA keadaan: saat tangkapan berlaku
  // klik memang mendarat di panel, dan saat tidak, klik menggelembung dari
  // lencana ke panel. Panel yang sedang terbentang tetap aman - bentangkan()
  // sudah berpagar KELAS_LENCANA di atas.
  //
  // Terukur pada harness yang memuat berkas ini apa adanya, dengan klik tetikus
  // sungguhan: sebelum diperbaiki pendengar berjalan 0 kali dan panel tetap
  // terciut; sesudahnya berjalan 1 kali dan panel terbentang kembali ke lebar
  // semula.
  panel.addEventListener("click", bentangkan);
  panel.addEventListener("dblclick", (peristiwa) => {
    delete panel.dataset.baruDigeser;
    bentangkan(peristiwa);
  });

  return lencana;
}

function alatPasangGeser(panel, kepala, kunci) {
  let geser = null;

  panel.addEventListener("pointerdown", (peristiwa) => {
    // Tombol di dalam kepala tidak boleh ikut menggeser - yang menekan tombol
    // tutup tidak sedang memindahkan panel.
    if (peristiwa.target.closest("button, a, input, select, textarea, .aleta-warna-pilih")) return;
    if (peristiwa.button !== 0) return;
    // ========================================================================
    // LENCANA DIGESER DARI LENCANANYA, PANEL DARI KEPALANYA
    // ========================================================================
    //
    // Pendengar ini dulu dipasang pada KEPALA panel, dan kepala itu
    // display:none begitu panelnya menjadi lencana - sehingga lencana yang
    // dijanjikan dapat digeser sesungguhnya tidak pernah dapat digeser sama
    // sekali. Satu-satunya jalan menyingkirkannya adalah membentangkannya
    // kembali lalu menggeser panelnya, yaitu justru yang tidak diinginkan
    // orang yang baru saja menciutkannya.
    //
    // Sekarang dipasang pada panel, dengan pagar ini: panel yang terbentang
    // tetap hanya digeser dari kepalanya - menyeret badannya berarti menyeret
    // teks yang sedang dibaca - sedangkan lencana digeser dari mana saja.
    if (!panel.classList.contains(KELAS_LENCANA) && !kepala.contains(peristiwa.target)) return;

    alatNormalkanJangkar(panel);
    const kotak = panel.getBoundingClientRect();
    geser = {
      x: peristiwa.clientX,
      y: peristiwa.clientY,
      kiri: kotak.left,
      atas: kotak.top,
    };
    panel.classList.add("aleta-menggeser");
    // ------------------------------------------------------------------
    // TANGKAPAN PENUNJUK SENGAJA TETAP DI SINI - JANGAN DITUNDA
    // ------------------------------------------------------------------
    //
    // Tangkapan ini membelokkan `click` dan `dblclick` ke panel, dan itu dahulu
    // membuat panel terciut tidak dapat dibentangkan lagi: pendengarnya
    // terpasang pada anak (.aleta-lencana), yang tidak pernah kebagian.
    // Perbaikannya ADA DI alatPasangLencana - pendengarnya yang dipindahkan ke
    // panel, bukan tangkapannya yang dibuang dari sini.
    //
    // Menunda tangkapan sampai ambang 4 piksel terlewati SUDAH DICOBA dan
    // ditolak, sesudah diukur di Chromium sungguhan pada berkas ini apa adanya:
    // kliknya memang sembuh, tetapi tarikan JAUH mati sama sekali. Tanpa
    // tangkapan, pointermove hanya sampai ke panel selama penunjuk masih di
    // ATAS panel - dan lencana hanya 54x54 piksel, sehingga tarikan cepat
    // meninggalkannya sebelum ambangnya sempat menangkap. Terukur: tarikan
    // pendek di dalam lencana berpindah, tarikan ke seberang layar tidak
    // bergerak satu piksel pun.
    try {
      panel.setPointerCapture(peristiwa.pointerId);
    } catch {
      /* tidak semua peramban mengizinkannya - geser tetap berjalan */
    }
    peristiwa.preventDefault();
  });

  panel.addEventListener("pointermove", (peristiwa) => {
    if (!geser) return;
    // Ambang 4 piksel memisahkan tarikan dari klik - dibaca alatPasangLencana
    // supaya lencana yang baru saja digeser tidak ikut membentang.
    if (Math.abs(peristiwa.clientX - geser.x) > 4 || Math.abs(peristiwa.clientY - geser.y) > 4) {
      panel.dataset.baruDigeser = "1";
    }
    const kotak = panel.getBoundingClientRect();
    const aman = alatJepitKeLayar(
      geser.kiri + (peristiwa.clientX - geser.x),
      geser.atas + (peristiwa.clientY - geser.y),
      kotak.width
    );
    panel.style.left = `${aman.kiri}px`;
    panel.style.top = `${aman.atas}px`;
    panel.style.right = "auto";
    panel.style.bottom = "auto";
  });

  const selesai = () => {
    if (!geser) return;
    geser = null;
    panel.classList.remove("aleta-menggeser");
    const kotak = panel.getBoundingClientRect();
    // ------------------------------------------------------------------
    // MENGGESER LENCANA TIDAK BOLEH MENGHAPUS KEADAAN LENCANANYA
    // ------------------------------------------------------------------
    //
    // alatSimpanPosisi menulis dengan storage.local.set, yang MENGGANTI
    // seluruh objek alih-alih menggabungkannya. Bentuk lama tidak menyertakan
    // medan `lencana`, sehingga sekali lencana digeser penanda itu lenyap -
    // dan `lebar` terisi 52, yaitu ukuran lencana, bukan ukuran panel.
    // Akibatnya pada pemuatan berikutnya panel yang ditinggalkan terciut
    // terbentang sendiri, seukuran lencana.
    // Bentuknya disamakan dengan alatCiutkan: undefined, bukan nol - keduanya
    // sama-sama diabaikan alatTerapkanPosisi yang berpagar `> 0`, tetapi nol
    // yang tersimpan membuat pembacanya mengira ada ukuran yang berarti.
    const jadiLencana = panel.classList.contains(KELAS_LENCANA);
    const lebarSemula = Number(panel.dataset.lebarSemula) || undefined;
    const tinggiSemula = Number(panel.dataset.tinggiSemula) || undefined;
    alatSimpanPosisi(kunci, {
      kiri: Math.round(kotak.left),
      atas: Math.round(kotak.top),
      lebar: jadiLencana ? lebarSemula : Math.round(kotak.width),
      tinggi: jadiLencana
        ? tinggiSemula
        : panel.dataset.tinggiSendiri === "1"
          ? Math.round(kotak.height)
          : 0,
      lencana: jadiLencana,
    });
    alatJepitTinggi(panel);
  };

  panel.addEventListener("pointerup", selesai);
  panel.addEventListener("pointercancel", selesai);
}

/**
 * ============================================================================
 * DELAPAN PEGANGAN, BUKAN SATU DI SUDUT YANG SALAH
 * ============================================================================
 *
 * Bentuk pertamanya memasang SATU pegangan, 12 x 12 piksel, tembus pandang,
 * di sudut KIRI-BAWAH. Panel SIPP memasang delapan - empat sisi dan empat
 * sudut - dan sudut kanan-bawahnya punya petunjuk yang tergambar
 * (.aleta-tarik--st::after, dua garis kecil).
 *
 * Akibatnya persis yang dilaporkan: di SIPP panelnya dapat ditarik, di ABT
 * tidak. Bukan karena pegangannya tidak ada, melainkan karena ia satu-satunya,
 * tak terlihat, dan berada di sudut yang tidak pernah dicoba orang. Yang
 * ditarik orang sudut kanan-bawah - tempat petunjuknya digambar, dan tempat
 * hampir setiap jendela di sistem operasi mana pun dapat diubah ukurannya.
 *
 * Sekarang keduanya sama. Arah dan perhitungannya disalin dari pasangUbahUkuran
 * di konten.js - termasuk aturan yang menentukan: TEPI SEBERANG DIAM.
 *
 * ============================================================================
 * KENAPA UKURANNYA DIJEPIT SEBELUM POSISINYA DIHITUNG
 * ============================================================================
 *
 * Menarik tepi kiri mengubah lebar DAN kiri sekaligus, dan kirinya diturunkan
 * dari lebar yang SUDAH dijepit. Kalau urutannya dibalik, panel yang sudah
 * menyentuh lebar minimum masih terus bergeser mengikuti kursor walau
 * ukurannya berhenti berubah - tepi seberang yang seharusnya diam malah
 * berjalan sendiri.
 */
const ALAT_ARAH_TARIK = [
  { nama: "u", x: 0, y: -1, sudut: false },
  { nama: "s", x: 0, y: 1, sudut: false },
  { nama: "b", x: -1, y: 0, sudut: false },
  { nama: "t", x: 1, y: 0, sudut: false },
  { nama: "ub", x: -1, y: -1, sudut: true },
  { nama: "ut", x: 1, y: -1, sudut: true },
  { nama: "sb", x: -1, y: 1, sudut: true },
  { nama: "st", x: 1, y: 1, sudut: true },
];

/** Sama dengan min-width/min-height di panel.css - dijaga sepasang. */
const ALAT_LEBAR_MIN = 260;
const ALAT_TINGGI_MIN = 150;

function alatPasangUbahUkuran(panel, kunci) {
  for (const arah of ALAT_ARAH_TARIK) {
    // Memakai kelas pegangan yang SUDAH ada di panel.css, bukan kelas baru:
    // ukuran, kursor, dan lapisannya sudah diputuskan di sana.
    const pegangan = document.createElement("div");
    pegangan.className = "aleta-tarik aleta-tarik--" + arah.nama;
    if (arah.sudut) pegangan.classList.add("aleta-tarik--sudut");
    pegangan.title = "Tarik untuk mengubah ukuran panel";
    panel.appendChild(pegangan);

    pegangan.addEventListener("pointerdown", (peristiwa) => {
      if (peristiwa.button !== 0) return;

      alatNormalkanJangkar(panel);
      const kotak = panel.getBoundingClientRect();
      const mulaiX = peristiwa.clientX;
      const mulaiY = peristiwa.clientY;
      const awalKiri = kotak.left;
      const awalAtas = kotak.top;
      const awalLebar = kotak.width;
      const awalTinggi = kotak.height;

      // Batas atas dihitung sekali di awal tarikan, bukan tiap gerakan:
      // membaca innerWidth puluhan kali per detik memaksa peramban menghitung
      // ulang tata letak halaman ABT di belakangnya.
      const lebarMaks = Math.min(window.innerWidth - 20, 900);
      const tinggiMaks = window.innerHeight - 20;

      const jepit = (nilai, kecil, besar) =>
        Math.min(Math.max(nilai, kecil), Math.max(besar, kecil));

      const saatGerak = (gerak) => {
        const geserX = gerak.clientX - mulaiX;
        const geserY = gerak.clientY - mulaiY;

        let lebar = awalLebar;
        let tinggi = awalTinggi;
        let kiri = awalKiri;
        let atas = awalAtas;

        if (arah.x === 1) {
          lebar = jepit(awalLebar + geserX, ALAT_LEBAR_MIN, lebarMaks);
        } else if (arah.x === -1) {
          lebar = jepit(awalLebar - geserX, ALAT_LEBAR_MIN, lebarMaks);
          // Tepi kanan tetap di tempatnya.
          kiri = awalKiri + (awalLebar - lebar);
        }

        if (arah.y === 1) {
          tinggi = jepit(awalTinggi + geserY, ALAT_TINGGI_MIN, tinggiMaks);
        } else if (arah.y === -1) {
          tinggi = jepit(awalTinggi - geserY, ALAT_TINGGI_MIN, tinggiMaks);
          // Tepi bawah tetap di tempatnya.
          atas = awalAtas + (awalTinggi - tinggi);
        }

        if (arah.x !== 0) {
          panel.style.width = `${Math.round(lebar)}px`;
          panel.style.left = `${Math.round(Math.max(kiri, 0))}px`;
          panel.style.right = "auto";
        }
        if (arah.y !== 0) {
          panel.style.height = `${Math.round(tinggi)}px`;
          panel.style.top = `${Math.round(Math.max(atas, 0))}px`;
          panel.style.bottom = "auto";
          // Batas bawaan dilepas begitu tingginya diatur sendiri - kalau
          // tidak, panel setinggi apa pun tetap terpotong pada batas itu.
          panel.style.maxHeight = "none";
          panel.dataset.tinggiSendiri = "1";
        }
      };

      const saatLepas = () => {
        document.removeEventListener("pointermove", saatGerak);
        document.removeEventListener("pointerup", saatLepas);
        document.removeEventListener("pointercancel", saatLepas);

        const akhir = panel.getBoundingClientRect();
        alatSimpanPosisi(kunci, {
          kiri: Math.round(akhir.left),
          atas: Math.round(akhir.top),
          lebar: Math.round(akhir.width),
          tinggi: Math.round(akhir.height),
        });
      };

      // Dipasang pada document, bukan pada pegangannya: tarikan cepat membuat
      // penunjuk meninggalkan kotak selebar dua belas piksel itu dalam satu
      // gerakan, dan pegangan yang mendengarkan dirinya sendiri kehilangan
      // tarikannya di tengah jalan.
      document.addEventListener("pointermove", saatGerak);
      document.addEventListener("pointerup", saatLepas);
      document.addEventListener("pointercancel", saatLepas);

      peristiwa.preventDefault();
      peristiwa.stopPropagation();
    });
  }
}

/**
 * Tombol-tombol kepala panel.
 *
 * Urutannya dari yang paling sering dipakai ke yang paling jarang: tema, ciut,
 * layar penuh, kembalikan bawaan, tutup. Tombol tutup paling kanan dan paling
 * akhir - sebab ia yang paling mahal salah tekan.
 */
/**
 * ============================================================================
 * TEMA HALAMAN - PENANDA DAN SALINAN SINKRONNYA
 * ============================================================================
 *
 * Satu penanda pada <html>, dan satu salinan di localStorage halaman itu.
 * Keduanya harus bergerak bersama:
 *
 *   penanda      yang mengubah warna SEKARANG, seketika, tanpa satu pun
 *                permintaan - CSS-nya sudah terpasang sejak awal
 *   salinan      yang membuat halaman BERIKUTNYA lahir sudah benar, sebab
 *                tema-awal.js membacanya pada document_start
 *
 * Tanpa salinannya, tiap perpindahan halaman menampilkan tema lama sepersekian
 * detik lebih dulu. Itulah "lag" yang dikeluhkan - bukan lambatnya penggantian,
 * melainkan halaman berikutnya yang lahir salah lalu diperbaiki di depan mata.
 *
 * Nama kuncinya SAMA dengan yang dipakai SIPP - aleta-tema-sipp - dan itu
 * disengaja: keduanya satu origin, sehingga tema yang dipilih di halaman SIPP
 * langsung berlaku di halaman ABT dan sebaliknya. Dua kunci terpisah berarti
 * dua tema yang berselisih pada satu layar yang sama.
 */
const KUNCI_SALINAN_TEMA_HALAMAN = "aleta-tema-sipp";

/**
 * ============================================================================
 * MENGGANTI TEMA TANPA TERSENDAT
 * ============================================================================
 *
 * Satu penanda di akar mengubah warna SELURUH halaman sekaligus. Masalahnya
 * bukan pada penghitungan gayanya - itu beberapa milidetik - melainkan pada
 * TRANSISI: SIPP, AdminLTE, dan Bootstrap memasang transition pada ratusan
 * elemen (tombol, baris tabel, kotak, tautan). Mengganti tema berarti
 * menyalakan ratusan animasi warna pada saat yang sama, dan itulah yang
 * terasa sebagai tersendat - bukan temanya yang lambat, melainkan perjalanan
 * menuju temanya yang dianimasikan semua.
 *
 * Selama pergantian, seluruh transisi dan animasi dimatikan; dua bingkai
 * kemudian - satu untuk menghitung, satu untuk memastikan sudah tercat -
 * semuanya dikembalikan. Hasilnya pergantian yang berkedip sekali dan
 * selesai, bukan yang merayap selama setengah detik.
 */
function alatTanpaTransisi(kerjakan) {
  const akar = document.documentElement;
  let dipasang = false;
  try {
    akar.classList.add("aleta-ganti-tema");
    dipasang = true;
  } catch {
    /* tanpa kelasnya, temanya tetap berganti - hanya dengan transisi */
  }
  try {
    kerjakan();
  } finally {
    if (dipasang) {
      const lepas = () => akar.classList.remove("aleta-ganti-tema");
      if (typeof requestAnimationFrame === "function") {
        requestAnimationFrame(() => requestAnimationFrame(lepas));
      } else {
        setTimeout(lepas, 50);
      }
    }
  }
}

/**
 * ============================================================================
 * TEMA DAN PALET IKUT SEKETIKA DI SELURUH TAB
 * ============================================================================
 *
 * Sebelumnya tombol tema hanya mengubah TAB TEMPAT IA DITEKAN. Petugas yang
 * membuka SIPP di tiga tab - daftar perkara, detail, dan jadwal sidang, cara
 * kerja yang paling lumrah - lalu mengganti tema di salah satunya, melihat
 * dua tab lain tetap seperti semula sampai dimuat ulang. Yang terbaca dari
 * situ bukan "berlaku per tab", melainkan "saklarnya tidak berfungsi".
 *
 * chrome.storage.onChanged sampai ke SEMUA tab tanpa izin tambahan apa pun.
 * Panel yang terdaftar di sini ikut berganti seketika, beserta penanda
 * halamannya dan salinan sinkron yang dibaca tema-awal.js.
 */
const alatPanelTema = [];

function alatDaftarkanPanelTema(panel, pilihan, kunci) {
  if (!panel) return;
  if (alatPanelTema.some((x) => x.panel === panel)) return;
  // Kuncinya ikut dicatat: tanpa itu alatSelaraskanWarna tidak dapat tahu
  // panel mana yang sudah dilepas dari popup.
  alatPanelTema.push({ panel, pilihan: pilihan || {}, kunci: String(kunci || "") });
}

/** Satu tema diberlakukan ke panel yang terdaftar dan ke halamannya. */
function alatSelaraskanTema(tema) {
  const bersih = tema === "terang" ? "terang" : "gelap";
  alatTanpaTransisi(() => {
    for (const { panel, pilihan } of alatPanelTema) {
      if (!panel.isConnected) continue;
      panel.setAttribute("data-tema", bersih);
      const tombol = panel.querySelector(".aleta-tema");
      if (tombol) tombol.textContent = bersih === "gelap" ? "☀" : "☾";
      if (pilihan.temaHalaman) alatTerapkanTemaHalaman(bersih);
    }
  });
}

async function alatSelaraskanWarna(nama) {
  // Panel yang dilepas dari popup TIDAK ikut - itulah arti dilepas. Dibaca
  // lebih dulu supaya penggambarannya tetap satu tarikan tanpa transisi.
  const mandiri = await alatPetaMandiri();
  alatTanpaTransisi(() => {
    const ikut = alatPanelTema.filter((x) => x.panel.isConnected && !(x.kunci && mandiri[x.kunci] === true));
    if (alatPanelTema.length === 0) {
      alatTerapkanWarna(null, nama, false);
      return;
    }
    for (const { panel } of ikut) {
      alatTerapkanWarna(panel, nama, false);
      const pemilih = panel.querySelector(".aleta-warna-pilih");
      if (pemilih && typeof pemilih.aletaTandai === "function") pemilih.aletaTandai(nama || "");
    }
    // Halaman hanya ikut bila ada satu pun panel yang masih terikat popup -
    // kalau seluruhnya dilepas, atribut warna halaman milik yang dilepas.
    if (ikut.length === 0) return;
  });
  // Salinan sinkron halaman INI ikut diperbarui - kalau tidak, halaman
  // berikutnya di tab ini lahir dengan warna lama lalu berkelebat.
  try {
    window.localStorage.setItem(KUNCI_SALINAN_WARNA, nama || "");
  } catch {
    /* halaman berikutnya berkelebat sekali - warnanya tetap berlaku kini */
  }
}

function alatDengarkanTemaPalet() {
  const tanda = "__aletaDengarTema";
  if (globalThis[tanda]) return;
  globalThis[tanda] = true;
  try {
    chrome.storage.onChanged.addListener((ubah, tempat) => {
      if (tempat !== "local") return;
      if (ubah[KUNCI_WARNA_GELAP]) {
        const nama = String(ubah[KUNCI_WARNA_GELAP].newValue || "");
        alatSelaraskanWarna(DAFTAR_WARNA_GELAP.some(([k]) => k === nama) ? nama : "");
      }
      if (ubah.temaPanel) {
        alatSelaraskanTema(ubah.temaPanel.newValue === "terang" ? "terang" : "gelap");
      }
    });
  } catch {
    /* tanpa pendengarnya, temanya berlaku di tab tempat ia ditekan saja */
  }
}

function alatTerapkanTemaHalaman(tema) {
  const akar = document.documentElement;
  if (tema === "gelap") akar.setAttribute("data-aleta-tema-sipp", "gelap");
  else akar.removeAttribute("data-aleta-tema-sipp");
  try {
    window.localStorage.setItem(KUNCI_SALINAN_TEMA_HALAMAN, tema === "gelap" ? "gelap" : "terang");
  } catch {
    // Penyimpanan halaman ditolak - temanya tetap berlaku untuk halaman ini,
    // hanya halaman berikutnya yang akan berkelebat sekali.
  }
}
/**
 * ============================================================================
 * ENAM WARNA GELAP SUPER ADMIN - SATU NILAI, TIGA APLIKASI
 * ============================================================================
 *
 * Paletnya di panel.css (blok "ENAM WARNA GELAP UNTUK SUPER ADMIN"). Yang
 * dikerjakan di sini hanya MENYAMPAIKAN pilihannya ke dua tempat sekaligus -
 * akar panel (ALETA) dan <html> halaman (lapisan SIPP/ABT) - dan menyimpannya
 * di dua tempat pula, dengan alasan yang sama seperti tema: chrome.storage
 * sumber kebenarannya, localStorage salinan sinkron supaya halaman berikutnya
 * lahir sudah berwarna (dibaca tema-awal.js pada document_start).
 *
 * Nama warnanya kunci pendek, bukan nilai heksa: yang tersimpan tidak boleh
 * dapat menyuntikkan apa pun ke atribut HTML.
 */
const KUNCI_WARNA_GELAP = "warnaGelap";
/**
 * ============================================================================
 * WARNA YANG DILEPAS DARI POPUP
 * ============================================================================
 *
 * Bawaannya satu warna untuk semua: diganti di popup, ketiga panel ikut.
 * Itu yang dikehendaki hampir selalu - tetapi tidak selalu. SIPP, ABT, dan
 * halaman ALETA kerap terbuka berdampingan di satu layar, dan yang bekerja
 * di antaranya perlu tahu SEKILAS sedang menatap yang mana.
 *
 * Karena itu tiap panel boleh dilepas: warnanya disimpan atas namanya
 * sendiri, dan perubahan dari popup tidak lagi menyentuhnya. Yang dilepas
 * disebut di tombolnya, bukan didiamkan - warna yang tidak ikut berubah
 * tanpa keterangan terbaca sebagai popup yang rusak.
 */
const KUNCI_WARNA_MANDIRI = "warnaMandiri";
const KUNCI_WARNA_SENDIRI = "warnaSendiri";
const KUNCI_SALINAN_WARNA = "aleta-warna-gelap";
const DAFTAR_WARNA_GELAP = [
  ["", "Hijau SIPP (bawaan)", "#7fd0a6"],
  ["arang", "Arang - hitam, aksen kelabu", "#b8b8b8"],
  ["neon", "Neon - hitam pekat, hijau neon", "#35d98f"],
  ["hangat", "Hangat - krem, koral, emas", "#e9b64a"],
  ["pastel", "Pastel - kelabu lembut, biru muda", "#a8dadc"],
  ["permata", "Permata - biru laut dalam", "#5fc3dd"],
  ["vibran", "Vibran - jingga bata, ungu", "#ff7a4d"],
];

/** Memasang satu warna ke panel DAN halaman, lalu menyimpannya. */
function alatTerapkanWarna(panel, nama, simpan, kunci) {
  const dikenal = DAFTAR_WARNA_GELAP.some(([k]) => k === nama);
  const bersih = dikenal ? nama : "";
  const akar = document.documentElement;
  if (bersih) {
    if (panel) panel.setAttribute("data-warna", bersih);
    akar.setAttribute("data-aleta-warna", bersih);
  } else {
    if (panel) panel.removeAttribute("data-warna");
    akar.removeAttribute("data-aleta-warna");
  }
  if (!simpan) return;
  try {
    window.localStorage.setItem(KUNCI_SALINAN_WARNA, bersih);
  } catch {
    /* halaman berikutnya berkelebat sekali - warnanya tetap berlaku kini */
  }
  // Ke tempat yang benar - milik panel ini bila dilepas dari popup, milik
  // semua bila tidak. `kunci` datang dari pemanggil; tanpa itu ia global,
  // sama seperti sebelum pelepasan ada.
  void alatSimpanWarna(kunci, bersih);
}

/** Panel mana saja yang warnanya dilepas dari popup. */
async function alatPetaMandiri() {
  try {
    const simpan = await chrome.storage.local.get([KUNCI_WARNA_MANDIRI]);
    const peta = simpan[KUNCI_WARNA_MANDIRI];
    return peta && typeof peta === "object" ? peta : {};
  } catch {
    return {};
  }
}

async function alatWarnaMandiri(kunci) {
  if (!kunci) return false;
  return (await alatPetaMandiri())[kunci] === true;
}

/** Warna sendiri satu panel - dipakai hanya ketika panel itu dilepas. */
async function alatWarnaSendiri(kunci) {
  try {
    const simpan = await chrome.storage.local.get([KUNCI_WARNA_SENDIRI]);
    const peta = simpan[KUNCI_WARNA_SENDIRI];
    const nama = peta && typeof peta === "object" ? String(peta[kunci] || "") : "";
    return DAFTAR_WARNA_GELAP.some(([k]) => k === nama) ? nama : "";
  } catch {
    return "";
  }
}

/**
 * Menyimpan warna ke tempat yang benar: milik panel ini bila dilepas, milik
 * semua bila tidak. Salah tempat berarti mengganti warna satu panel diam-diam
 * mengganti warna dua panel lainnya.
 */
async function alatSimpanWarna(kunci, nama) {
  const bersih = DAFTAR_WARNA_GELAP.some(([k]) => k === nama) ? nama : "";
  try {
    if (kunci && (await alatWarnaMandiri(kunci))) {
      const simpan = await chrome.storage.local.get([KUNCI_WARNA_SENDIRI]);
      const peta = simpan[KUNCI_WARNA_SENDIRI] && typeof simpan[KUNCI_WARNA_SENDIRI] === "object" ? simpan[KUNCI_WARNA_SENDIRI] : {};
      peta[kunci] = bersih;
      await chrome.storage.local.set({ [KUNCI_WARNA_SENDIRI]: peta });
      return;
    }
    await chrome.storage.local.set({ [KUNCI_WARNA_GELAP]: bersih });
  } catch {
    /* di luar konteks ekstensi - warnanya tetap berlaku di halaman ini */
  }
}

/** Menyalakan atau memadamkan pelepasan satu panel. */
async function alatSetelWarnaMandiri(kunci, ya) {
  if (!kunci) return;
  try {
    const peta = await alatPetaMandiri();
    if (ya) peta[kunci] = true;
    else delete peta[kunci];
    await chrome.storage.local.set({ [KUNCI_WARNA_MANDIRI]: peta });
  } catch {
    /* tanpa penyimpanan, pelepasannya berlaku sampai halaman dimuat ulang */
  }
}

/** Warna yang BERLAKU untuk satu panel: miliknya sendiri bila dilepas. */
async function alatWarnaBerlaku(kunci) {
  if (kunci && (await alatWarnaMandiri(kunci))) return alatWarnaSendiri(kunci);
  return alatWarnaTersimpan();
}

/** Warna tersimpan, dari chrome.storage. Kosong berarti bawaan. */
async function alatWarnaTersimpan() {
  try {
    const simpan = await chrome.storage.local.get([KUNCI_WARNA_GELAP]);
    const nama = String(simpan[KUNCI_WARNA_GELAP] || "");
    return DAFTAR_WARNA_GELAP.some(([k]) => k === nama) ? nama : "";
  } catch {
    return "";
  }
}

/**
 * Pemilih warnanya: tujuh titik kecil (bawaan + enam), hanya bagi super admin.
 *
 * Peran dibaca dari pilihan.peran bila pemanggilnya sudah tahu; bila belum,
 * dari atribut data-peran pada akar panel yang dipasang alatTandaiPeranPanel.
 * Yang bukan super admin tidak melihat apa pun - bukan tombol yang mati,
 * melainkan tidak ada sama sekali.
 */
function alatPemilihWarna(panel, wadah, pilihan) {
  const peran = String((pilihan && pilihan.peran) || (panel && panel.getAttribute("data-peran")) || "");
  if (peran !== "super" && !/super/i.test(peran)) return null;
  if (wadah.querySelector(".aleta-warna-pilih")) return null;

  // ==========================================================================
  // SATU TITIK DI KEPALA, TUJUH TITIK DI BALIKNYA
  // ==========================================================================
  //
  // Dulu ketujuh titik berdiri sejajar di deret tombol kepala. Dua hal salah
  // sekaligus, dan keduanya hanya terlihat oleh super admin - satu-satunya
  // peran yang melihat pemilihnya:
  //
  //   1. Aturan ".aleta-alat-kepala button" menghapus latar dan garis setiap
  //      tombol kepala (background: none; border: 0). Pada titik warna, latar
  //      itulah satu-satunya isinya - jadi ENAM titik lenyap. Yang tersisa
  //      hanya lingkaran garis luar titik yang sedang aktif: satu bulatan
  //      kosong yang, ditekan berapa kali pun, tidak berbuat apa-apa sebab
  //      ia memang sudah aktif. "Pemilihan warna tidak berfungsi".
  //   2. Tujuh tombol bertambah lebar oleh padding tombol kepala; deretnya
  //      tidak muat di baris pertama dan kepala panel patah ke baris kedua.
  //
  // Sekarang di kepala hanya ada SATU titik: warna palet yang sedang aktif.
  // Menekannya membuka baris tujuh titik tepat di bawah kepala; memilih satu
  // menutupnya lagi. Kepala tetap satu baris, dan yang ditekan sungguh
  // berbuat sesuatu.
  const tombol = document.createElement("button");
  tombol.type = "button";
  tombol.className = "aleta-warna-tombol";
  tombol.setAttribute("aria-haspopup", "true");
  tombol.setAttribute("aria-expanded", "false");

  const kotak = document.createElement("span");
  kotak.className = "aleta-warna-pilih";
  kotak.setAttribute("role", "group");
  kotak.setAttribute("aria-label", "Warna tema gelap");
  kotak.hidden = true;

  const titikSemua = [];
  const tandai = (aktif) => {
    const baris = DAFTAR_WARNA_GELAP.find(([k]) => k === aktif) || DAFTAR_WARNA_GELAP[0];
    for (const [t, nama] of titikSemua) t.setAttribute("aria-pressed", nama === baris[0] ? "true" : "false");
    tombol.style.setProperty("--titik", baris[2]);
    tombol.title = `Warna tema gelap: ${baris[1]}. Tekan untuk mengganti.`;
    tombol.setAttribute("aria-label", tombol.title);
  };
  const buka = (ya) => {
    kotak.hidden = !ya;
    tombol.setAttribute("aria-expanded", ya ? "true" : "false");
  };
  tombol.addEventListener("click", (peristiwa) => {
    peristiwa.stopPropagation();
    buka(kotak.hidden);
  });
  // Menekan di luar pemilih menutupnya. Dipasang sekali per pemilih, dan
  // tidak berbuat apa-apa selama pemilihnya memang tertutup.
  document.addEventListener("pointerdown", (peristiwa) => {
    if (kotak.hidden) return;
    if (kotak.contains(peristiwa.target) || tombol.contains(peristiwa.target)) return;
    buka(false);
  });

  for (const [nama, judul, contoh] of DAFTAR_WARNA_GELAP) {
    const titik = document.createElement("button");
    titik.type = "button";
    titik.className = "aleta-warna-titik";
    titik.title = judul;
    titik.setAttribute("aria-label", judul);
    titik.style.setProperty("--titik", contoh);
    titik.addEventListener("click", () => {
      // kunciPanel menentukan ke mana warnanya disimpan: milik panel ini bila
      // sudah dilepas, milik semua bila belum.
      alatTerapkanWarna(panel, nama, true, (pilihan && pilihan.kunciPanel) || "");
      tandai(nama);
      buka(false);
    });
    kotak.appendChild(titik);
    titikSemua.push([titik, nama]);
  }
  // Pemulih di alatPasangPanel memanggil ini sesudah warna tersimpan dibaca -
  // titik aktif dan warna tombol kepala ikut, bukan hanya atributnya.
  kotak.aletaTandai = tandai;
  tandai(panel.getAttribute("data-warna") || "");
  wadah.appendChild(tombol);
  wadah.appendChild(kotak);
  return kotak;
}

/**
 * ============================================================================
 * PINTASAN PAPAN TIK DAN BARIS KAKI - SATU BENTUK UNTUK KETIGA PANEL
 * ============================================================================
 *
 * Panel SIPP sudah lama punya keduanya; ABT dan halaman ALETA hanya punya
 * ikon segarkan dan nomor seri. Akibatnya dua-duanya:
 *
 *   1. Pintasannya tidak ada, dan yang sudah hafal Alt+A di SIPP menekannya
 *      di ABT lalu tidak terjadi apa-apa - itu mengajari orang bahwa
 *      pintasannya tidak dapat dipercaya di mana pun.
 *   2. Ikon segarkan dan nomor serinya berdiri di KIRI. Bukan karena diatur
 *      begitu: yang mendorongnya ke kanan adalah margin otomatis pada
 *      kalimat pintasan, dan tanpa kalimat itu tidak ada yang mendorong.
 *
 * Yang didaftarkan di sini HANYA pintasan yang benar-benar ada sasarannya di
 * panel itu. Menampilkan Alt+R pada panel yang tidak punya riwayat berarti
 * menjanjikan sesuatu yang tidak pernah terjadi - dan itu lebih buruk
 * daripada tidak menampilkannya.
 */
function alatBarisPintasan(daftar) {
  const pintasan = document.createElement("div");
  pintasan.className = "aleta-kaki-pintasan";
  pintasan.textContent = daftar.map((x) => x.tombol).join(" · ");
  pintasan.title =
    daftar.map((x) => `${x.tombol}  ${x.nama}`).join("\n") +
    "\n\nTidak berlaku selagi mengetik di kolom isian.";

  // Tombol panel ringkas dibungkus bersama pintasannya, bukan dipasang
  // terpisah - yang memakai helper ini ada tiga panel, dan menuntut ketiganya
  // memasangnya sendiri berarti satu di antaranya kelak terlupakan.
  //
  // margin-right otomatis TETAP melekat pada .aleta-kaki-pintasan; pembungkus
  // ini mewarisinya lewat display:contents, sehingga tata letak kaki tidak
  // berubah sama sekali - lihat panel.css.
  const bungkus = document.createElement("div");
  bungkus.className = "aleta-kaki-kiri";
  bungkus.appendChild(alatTombolRingkas());
  bungkus.appendChild(pintasan);
  return bungkus;
}

/**
 * Memasang pendengar pintasan untuk satu panel.
 *
 * Pada fase TANGKAP, sebab halaman SIPP dan ABT memasang pendengarnya sendiri
 * dan menghentikan gelembungnya. Pendengarnya satu per panel dan menandai
 * dirinya, supaya panel yang digambar ulang - ABT menggambar ulang tiap kali
 * disegarkan - tidak menumpuk pendengar yang sama berkali-kali.
 */
function alatPasangPintasan(idPanel, daftar) {
  const tanda = `aletaPintasan_${idPanel}`;
  if (window[tanda]) document.removeEventListener("keydown", window[tanda], true);

  const pendengar = (peristiwa) => {
    if (!peristiwa.altKey || peristiwa.ctrlKey || peristiwa.metaKey) return;
    const sasaran = peristiwa.target instanceof Element ? peristiwa.target : null;
    if (sasaran && (sasaran.isContentEditable || sasaran.closest('input, textarea, select, [contenteditable="true"]'))) {
      return;
    }
    const panel = document.getElementById(idPanel);
    if (!panel) return;
    const kunci = peristiwa.key === "Enter" ? "Enter" : String(peristiwa.key || "").toLowerCase();
    const cocok = daftar.find((x) => x.kunci === kunci);
    if (!cocok) return;
    peristiwa.preventDefault();
    try {
      cocok.jalankan(panel);
    } catch {
      /* satu pintasan yang gagal tidak boleh mematikan yang lain */
    }
  };

  window[tanda] = pendengar;
  document.addEventListener("keydown", pendengar, true);
}

/** Menekan tombol pertama yang cocok dan tidak mati. Kosong bila tidak ada. */
function alatTekanPertama(panel, pemilih) {
  for (const t of Array.from(panel.querySelectorAll(pemilih))) {
    if (!t.disabled && t.offsetParent !== null) {
      t.scrollIntoView({ block: "nearest" });
      t.click();
      return true;
    }
  }
  return false;
}

function alatTombolKepala(panel, kunci, opsi) {
  const pilihan = opsi || {};
  const wadah = document.createElement("span");
  wadah.className = "aleta-alat-kepala";

  // Lencana lingkungan berdiri PALING KIRI di deret ini, sebelum tombol
  // apa pun. Ia menjawab pertanyaan yang harus dijawab SEBELUM menekan:
  // panel ini menempel di SIPP yang mana. Lihat alatLencanaLingkungan -
  // di peladen, petugas biasa tidak melihatnya sama sekali.
  const lencanaLingkungan = alatLencanaLingkungan(
    pilihan.peran || (panel && panel.getAttribute && panel.getAttribute("data-peran"))
  );
  if (lencanaLingkungan) wadah.appendChild(lencanaLingkungan);

  const buat = (kelas, teks, judul, saatKlik) => {
    const tombol = document.createElement("button");
    tombol.type = "button";
    tombol.className = kelas;
    tombol.textContent = teks;
    tombol.title = judul;
    tombol.addEventListener("click", saatKlik);
    wadah.appendChild(tombol);
    return tombol;
  };

  // ── Tema panel, DAN halamannya sekalian ───────────────────────────────────
  //
  // ==========================================================================
  // DULU HANYA PANELNYA - DAN ITU MEMBUAT "TERANG" TAMPAK RUSAK
  // ==========================================================================
  //
  // Catatan lama di sini berbunyi: yang diganti tema PANEL, bukan tema halaman
  // ABT, sebab mewarnai ulang aplikasi orang lain menuntut peta warna
  // tersendiri. Alasannya benar - tetapi keadaannya berubah: penanda
  // data-aleta-tema-sipp SUDAH terpasang di halaman ABT sejak
  // tema-awal.js berjalan pada document_start, sehingga halamannya sudah
  // gelap sejak awal tanpa ada satu pun cara mematikannya.
  //
  // Akibatnya persis yang dilaporkan: menekan tombol terang hanya
  // menerangkan panel selebar telapak tangan, sementara halaman di
  // belakangnya tetap gelap. "Light mode tidak berfungsi" - dan memang tidak,
  // sebab tombolnya tidak pernah menyentuh halamannya.
  //
  // Sekarang satu tombol mengurus keduanya, dan petanya benar-benar dibuat -
  // lihat blok "TEMA GELAP UNTUK HALAMAN ABT" di panel.css.
  //
  // ==========================================================================
  // SALINAN SINKRON DITULIS DI SINI JUGA, DAN ITU YANG MEMBUATNYA TANPA JEDA
  // ==========================================================================
  //
  // chrome.storage hanya asinkron. Kalau hanya ia yang menyimpan, halaman ABT
  // berikutnya akan digambar dengan tema lama lebih dulu lalu berubah -
  // kelebat yang justru paling menyakitkan mata. localStorage halaman ini
  // sinkron dan dibaca tema-awal.js pada document_start, sebelum satu piksel
  // digambar. Keduanya ditulis: chrome.storage tetap sumber kebenarannya,
  // localStorage cache yang membuat halaman berikutnya lahir sudah benar.
  const tema = buat("aleta-tema", "", "Ganti tema ALETA dan halaman ini", async () => {
    const baru = panel.getAttribute("data-tema") === "gelap" ? "terang" : "gelap";
    // Penanda dipasang LEBIH DAHULU dan tanpa menunggu apa pun. Menyimpan ke
    // chrome.storage adalah panggilan asinkron lintas proses; menunggunya
    // sebelum mengubah tampilan membuat tekanan tombol terasa tidak
    // menghasilkan apa-apa selama sepersekian detik - dan yang menekannya
    // menekan sekali lagi, yang justru mengembalikannya.
    alatTanpaTransisi(() => {
      panel.setAttribute("data-tema", baru);
      tema.textContent = baru === "gelap" ? "☀" : "☾";
      if (pilihan.temaHalaman) alatTerapkanTemaHalaman(baru);
    });
    try {
      await chrome.storage.local.set({ [pilihan.kunciTema || "temaPanel"]: baru });
    } catch {
      /* temanya tetap berlaku untuk halaman ini */
    }
  });
  tema.textContent = panel.getAttribute("data-tema") === "gelap" ? "☀" : "☾";

  // Enam warna gelap - hanya bagi super admin, dan hanya ikon. Dipasang
  // sesudah tombol tema sebab warnanya memang anak dari tema gelap.
  alatPemilihWarna(panel, wadah, pilihan);

  // Kunci pas perkakas - juga hanya super admin, dan juga satu tombol saja.
  alatTombolPerkakas(panel, wadah, pilihan);

  // ── Ciut ──────────────────────────────────────────────────────────────────
  //
  // Menyisakan kepalanya saja. Bedanya dengan menutup: yang diciutkan masih
  // terlihat, jadi tidak ada yang perlu diingat untuk membukanya kembali.
  const ciut = buat("aleta-lipat", "–", "Ciutkan menjadi lencana", () => {
    alatCiutkan(panel, kunci, true);
  });

  // ── Layar penuh dan keluar darinya ────────────────────────────────────────
  //
  // Satu tombol untuk keduanya, dan tulisannya berubah. Tombol keluar yang
  // terpisah hanya berguna satu kali dan menganggur selebihnya - sedangkan
  // ruang di kepala panel selebar tiga ratus piksel.
  const penuh = buat("aleta-penuh", "⛶", "Layar penuh", () => {
    const sedang = panel.classList.toggle("aleta-panel-penuh");
    penuh.textContent = sedang ? "⤡" : "⛶";
    penuh.title = sedang ? "Keluar dari layar penuh" : "Layar penuh";
    if (!sedang) alatJepitTinggi(panel);
  });

  buat("aleta-bawaan", "⟲", "Kembalikan posisi dan ukuran bawaan", () => {
    alatKembalikanBawaan(panel, kunci);
    ciut.textContent = "–";
    penuh.textContent = "⛶";
  });

  // ── Lepas warna halaman ini dari popup ───────────────────────────────────
  //
  // Berdampingan dengan tombol kembalikan-bawaan sebab keduanya sejenis:
  // mengatur panelnya sendiri, bukan isi perkaranya. Keadaannya DISEBUT pada
  // judul tombol - warna yang berhenti mengikuti popup tanpa keterangan
  // terbaca sebagai popup yang rusak, dan yang membacanya akan menekan
  // popup berkali-kali.
  //
  // Hanya digambar untuk yang melihat pemilih warnanya. Tombol yang melepas
  // sesuatu yang tidak dapat dipilih hanya menambah satu tanda tanya.
  const bolehWarna = /super/i.test(String((opsi && opsi.peran) || panel.getAttribute("data-peran") || ""));
  if (bolehWarna && kunci) {
    const lepas = buat("aleta-warna-lepas", "⇄", "", async () => {
      const kini = await alatWarnaMandiri(kunci);
      await alatSetelWarnaMandiri(kunci, !kini);
      // Yang baru dilepas mewarisi warna yang sedang tampak - kalau tidak, ia
      // melompat ke bawaan pada tekanan pertama, dan yang menekannya mengira
      // tombol ini mengganti warna, bukan melepasnya.
      if (!kini) await alatSimpanWarna(kunci, panel.getAttribute("data-warna") || "");
      tandaiLepas(!kini);
    });
    var tandaiLepas = (mandiri) => {
      lepas.textContent = mandiri ? "⊘" : "⇄";
      lepas.title = mandiri
        ? "Warna halaman ini DILEPAS dari popup - hanya berubah dari panel ini. Tekan untuk mengikut lagi."
        : "Warna halaman ini mengikuti popup ekstensi. Tekan untuk melepasnya.";
      lepas.setAttribute("aria-pressed", mandiri ? "true" : "false");
    };
    void alatWarnaMandiri(kunci).then((m) => tandaiLepas(m));
  }

  if (typeof pilihan.saatTutup === "function") {
    // Judulnya menyebut jalan pulangnya. Tombol tutup yang tidak mengatakan
    // cara membukanya kembali membuat orang menutupnya sekali lalu mengira
    // panelnya rusak - dan itu yang terjadi selama ini di ABT dan portal.
    const judulLama = pilihan.judulTutup || "Tutup panel - nyalakan lagi dari kotak centang di ikon ALETA pada bilah ekstensi";
    const tutup = buat("aleta-matikan", "×", judulLama, () => {
      // UI Baru: × hanya menutup (menciut ke lencana); ALETA tetap aktif, dan
      // "Matikan ALETA" tetap di popup. Lama dan Baru: perilaku semula.
      if (alatTutupHanyaMenciut()) {
        alatCiutkan(panel, kunci, true);
        return;
      }
      pilihan.saatTutup();
    });
    if (tutup && tutup.addEventListener) {
      tutup.addEventListener("mouseenter", () => {
        tutup.title = alatTutupHanyaMenciut() ? ALAT_JUDUL_TUTUP_BARU : judulLama;
      });
    }
  }

  return wadah;
}

/**
 * Memasang seluruh perkakas pada satu panel sekaligus.
 *
 * Satu pintu, supaya pemakainya tidak perlu mengingat urutan: jangkar dulu,
 * lalu posisi tersimpan, lalu pengaman tepi layar. Urutan yang tertukar
 * menghasilkan panel yang menjulur keluar layar - dan itu tidak tampak rusak,
 * ia hanya berhenti dapat digulung.
 */
async function alatPasangPanel(panel, kepala, kunci, opsi) {
  const pilihan = opsi || {};
  kepala.appendChild(alatTombolKepala(panel, kunci, pilihan));
  alatPasangPetunjuk(panel);
  alatPasangGeser(panel, kepala, kunci);
  alatPasangUbahUkuran(panel, kunci);

  // Lencana dipasang pada panel yang SAMA. Gesernya TIDAK didaftarkan lagi:
  // alatPasangGeser memasang pendengarnya pada `panel`, bukan pada argumen
  // keduanya - argumen itu hanya dipakai sebagai pagar `kepala.contains(...)`,
  // dan pagar itu sudah korslet sendiri begitu panel menyandang KELAS_LENCANA.
  // Pendaftaran kedua karena itu tidak menambah kemampuan apa pun; yang
  // ditambahnya hanya dua salinan logika geser pada tiap tarikan, dua kali
  // penulisan posisi ke penyimpanan, dan dua kali tangkapan penunjuk.
  alatPasangLencana(panel, kunci);

  try {
    const simpan = await chrome.storage.local.get([pilihan.kunciTema || "temaPanel"]);
    const tema = simpan[pilihan.kunciTema || "temaPanel"];
    panel.setAttribute("data-tema", tema === "terang" ? "terang" : "gelap");
    const tombolTema = kepala.querySelector(".aleta-tema");
    if (tombolTema) tombolTema.textContent = tema === "terang" ? "☾" : "☀";
    // Penanda halaman diselaraskan dengan pilihan tersimpan. tema-awal.js
    // sudah memasangnya dari salinan sinkron; baris ini yang memperbaikinya
    // bila salinannya tertinggal - misalnya sesudah pilihan diganti dari
    // popup, yang menulis ke chrome.storage tetapi tidak ke localStorage.
    if (pilihan.temaHalaman) alatTerapkanTemaHalaman(tema === "terang" ? "terang" : "gelap");
  } catch {
    panel.setAttribute("data-tema", "gelap");
    if (pilihan.temaHalaman) alatTerapkanTemaHalaman("gelap");
  }

  // Warna gelap pilihan dipulihkan sesudah temanya - ia anak dari tema gelap.
  // Pemilihnya dipasang (lagi) di sini sebab data-peran pada akar panel
  // kerap baru terpasang SESUDAH kepala disusun; pemasangannya idempoten,
  // jadi yang sudah ada tidak digandakan.
  try {
    // Warna yang BERLAKU untuk panel ini - miliknya sendiri bila sudah
    // dilepas dari popup, warna bersama bila belum.
    const warna = await alatWarnaBerlaku(kunci);
    alatTerapkanWarna(panel, warna, false);
    const kepalaAlat = kepala.querySelector(".aleta-alat-kepala");
    if (kepalaAlat) alatPemilihWarna(panel, kepalaAlat, { ...pilihan, kunciPanel: kunci });
    const pemilih = kepala.querySelector(".aleta-warna-pilih");
    if (pemilih && typeof pemilih.aletaTandai === "function") pemilih.aletaTandai(warna);
  } catch {
    /* warna bawaan berlaku */
  }

  // Lingkungan, bilah gulir, dan mode kering dipasang di sini supaya ketiga
  // panel mendapatkannya tanpa satu baris tambahan di masing-masing berkas.
  alatTandaiLingkungan(panel);
  alatPasangGulir(panel);
  alatDaftarkanPanelTema(panel, pilihan, kunci);
  alatDengarkanTemaPalet();
  void alatMuatKering();

  // pindahKeSudut (butir 11, 2 Okt): pemilik panel yang punya letak berlabuh
  // (portal "samping") melepas labuhnya sendiri sebelum pindah ke sudut.
  if (typeof pilihan.pindahKeSudut === "function") panel.aletaPindahKeSudut = pilihan.pindahKeSudut;
  alatPasangJalanKeluar(panel, kunci);
  // Klik 2x kepala = layar penuh (butir 18, Baru & UI Baru). Panel SIPP
  // memasangnya sendiri di konten.js - kepalanya disusun di sana.
  alatPasangKlikGandaKepala(panel, kunci, kepala);
  const posisiTersimpan = await alatMuatPosisi(kunci);
  // POSISI-AWAL 12 Okt: ukuran bawaan untuk sesi baru, SEBELUM jangkar dinormalkan.
  alatTerapkanUkuranAwal(panel, posisiTersimpan);
  alatNormalkanJangkar(panel);
  alatTerapkanPosisi(panel, posisiTersimpan);
  // Keadaan lencana ikut dipulihkan. Yang menutup halaman dengan panel
  // terciut mengharapkannya terciut lagi saat kembali - panel yang
  // terbentang sendiri menutupi apa yang sedang dibacanya.
  if (posisiTersimpan && posisiTersimpan.lencana) alatCiutkan(panel, kunci, true);
  // Dijepit di luar alatTerapkanPosisi, sebab fungsi itu keluar lebih awal
  // ketika belum ada posisi tersimpan - yakni tepat pada pemuatan PERTAMA.
  // Tanpa baris ini, panel yang baru muncul setinggi isinya: terukur 672 dari
  // 800 piksel pada pengujian, bukan tiga per lima yang dijanjikan, dan baru
  // terjepit sesudah kebetulan digeser atau jendelanya diubah ukurannya.
  alatJepitTinggi(panel);

  // Jendela yang dipendekkan menimbulkan keadaan yang sama dengan panel yang
  // baru muncul: tingginya melewati tepi bawah, dan gulirnya mati.
  window.addEventListener("resize", () => {
    if (!panel.isConnected) return;
    const kotak = panel.getBoundingClientRect();
    if (panel.style.left) {
      const aman = alatJepitKeLayar(kotak.left, kotak.top, kotak.width);
      panel.style.left = `${aman.kiri}px`;
      panel.style.top = `${aman.atas}px`;
    }
    alatJepitTinggi(panel);
  });

  alatPasangPemulihPosisi(panel, kunci);
}

/**
 * ============================================================================
 * JALAN PULANG DARI LUAR PANEL - UNTUK PANEL YANG SUDAH TIDAK TERLIHAT
 * ============================================================================
 *
 * Panel yang terciut menjadi lencana lalu digeser ke tepi, atau yang
 * tertinggal di luar layar sesudah pindah monitor, tidak dapat dikembalikan
 * dari panel itu sendiri: tombolnya ikut hilang bersamanya.
 *
 * Popup ikon Chrome karena itu menghapus kunci posisinya, dan pendengar ini
 * yang mengembalikan panelnya - ke tempat bawaan DAN terbentang lagi.
 * Membentangkan ikut dikerjakan dengan sengaja: yang menekan "Kembalikan
 * posisi panel" sedang mencari panel yang hilang dari pandangannya, dan
 * lencana di pojok bukan jawaban atas pencarian itu.
 *
 * Panel SIPP punya pendengarnya sendiri di konten.js - ia menyimpan
 * keadaannya lewat jalur yang berbeda - jadi yang dilayani di sini panel ABT
 * dan panel halaman ALETA, yang selama ini tidak punya jalan pulang sama
 * sekali.
 */
function alatPasangPemulihPosisi(panel, kunci) {
  if (!kunci) return;
  try {
    chrome.storage.onChanged.addListener((ubah, tempat) => {
      if (tempat !== "local" || !ubah[kunci]) return;
      if (ubah[kunci].newValue !== undefined) return;
      if (!panel.isConnected) return;
      panel.classList.remove(KELAS_LENCANA, "aleta-panel-penuh");
      panel.removeAttribute("title");
      alatKembalikanBawaan(panel, kunci);
      const lipat = panel.querySelector(".aleta-lipat");
      if (lipat) {
        lipat.textContent = "–";
        lipat.title = "Ciutkan menjadi lencana";
      }
    });
  } catch {
    /* di luar konteks ekstensi: panel tetap dapat dikembalikan dari tombolnya */
  }
}

/**
 * ============================================================================
 * KETIKA ALETA TIDAK TERJANGKAU - SATU KALIMAT, DAN APA YANG MASIH JALAN
 * ============================================================================
 *
 * Yang tergambar sebelumnya bunyi mentah: "ALETA menjawab 502",
 * "Failed to fetch", "NetworkError when attempting to fetch resource".
 * Ketiganya benar dan ketiganya tidak menolong siapa pun.
 *
 * Yang disimpulkan petugas dari kalimat seperti itu SELALU sama: ekstensinya
 * rusak. Lalu ia menutup panelnya, dan sesudah beberapa kali begitu ia berhenti
 * memakainya - padahal yang mati hanya satu bagian, dan bagian terbesar
 * ekstensi ini tidak pernah menyentuh ALETA sama sekali.
 *
 * ============================================================================
 * YANG TETAP JALAN TANPA SERVER - DAN INI BUKAN PENGHIBURAN
 * ============================================================================
 *
 * Dihitung dari jalur tiap fiturnya, bukan dikira-kira:
 *
 *   TETAP JALAN            tidak menyentuh ALETA sama sekali
 *     tema gelap/terang    berkas gaya ekstensi, dipasang peramban
 *     panel                geser, ukuran, lencana, posisi tersimpan
 *     penandaan halaman    dibaca dari halaman SIPP itu sendiri
 *     penjaga CETAK        membaca baris variabel di halaman ABT
 *     sunting variabel     rute edit_data milik ABT
 *     keterangan saksi     rute tanyajawab_perkara_edit milik ABT
 *     CETAK: rtf + anonim  keduanya rute ABT; hanya PDF yang lewat ALETA
 *
 *   MENUNGGU ALETA         memang lewat portal, dan tidak ada jalan lain
 *     usulan dari saksi    kerangka fakta disusun bot dari keterangan saksi
 *     huruf alasan         naskah pasalnya ada di server
 *     perapian posita      bot yang membaca dan menulis kolom posita SIPP
 *     PDF                  LibreOffice hidup di dalam container bot
 *     penunjukan & Data Umum  keduanya membaca SIPP lewat bot
 *
 * Daftar itu ditulis di sini, satu tempat, sebab ia harus ikut berubah ketika
 * jalurnya berubah. Menyebarkannya ke tiap pesan galat berarti daftar yang
 * separuhnya usang dan tidak ada yang tahu bagian mana.
 */

/** Sebab yang dapat dibedakan dari satu kegagalan permintaan. */
function alatSebabGagal(galat, status) {
  if (status === 401 || status === 403) return "masuk";

  // Permintaan yang dihentikan sendiri karena melewati batas waktu. Dulu ia
  // jatuh ke "lain" dan berbunyi sebagai galat yang tidak dikenali, padahal
  // ia keadaan yang paling sering: portal hidup tetapi terlalu lambat.
  if (galat && galat.name === "AbortError") return "lambat";

  if (status === 502 || status === 503 || status === 504) return "mati";
  if (typeof status === "number" && status >= 500) return "mati";
  if (typeof status === "number" && status > 0) return "jawaban";

  // TypeError dari fetch berarti permintaannya tidak pernah sampai: server
  // mati, jaringan putus, atau alamatnya tidak terjangkau. Peramban tidak
  // membedakan ketiganya - dan memang tidak dapat.
  const pesan = String((galat && galat.message) || galat || "");
  if (/failed to fetch|networkerror|load failed|fetch/i.test(pesan)) return "mati";
  return "lain";
}

/**
 * Kalimat yang menggantikan bunyi mentah.
 *
 * @param {unknown} galat galat yang tertangkap, bila ada
 * @param {number} [status] kode jawaban HTTP, bila permintaannya sampai
 * @param {string} [yangDiminta] nama pekerjaan yang gagal, untuk kalimat pertama
 */
function alatPesanGagal(galat, status, yangDiminta) {
  const sebab = alatSebabGagal(galat, status);
  if (sebab === "lambat") {
    return (
      `${yangDiminta || "Permintaan"} dihentikan karena ALETA tidak menjawab dalam ` +
      `${Math.round(ALAT_BATAS_MS / 1000)} detik. Panel dan penanda SIPP tetap berjalan; ` +
      "coba lagi sebentar lagi."
    );
  }
  const pekerjaan = yangDiminta ? `${yangDiminta} gagal` : "Permintaan gagal";

  if (sebab === "masuk") {
    return (
      `${pekerjaan}: belum masuk portal ALETA di peramban ini. ` +
      "Buka portal ALETA di tab lain, masuk, lalu coba lagi - " +
      "tidak perlu menyegarkan halaman ini."
    );
  }

  if (sebab === "mati") {
    return (
      `${pekerjaan}: server ALETA tidak terjangkau. ` +
      "Yang TETAP jalan tanpanya: tema, panel, penandaan halaman, penjaga CETAK, " +
      "sunting variabel ABT, pembersih keterangan saksi, dan CETAK berkas rtf " +
      "beserta anonimnya. Yang menunggu ALETA: usulan dari keterangan saksi, " +
      "huruf alasan, perapian posita, PDF, penunjukan, dan Data Umum."
    );
  }

  if (sebab === "jawaban") {
    return `${pekerjaan}: ALETA menjawab ${status}. Kalau berulang, sebutkan angka itu saat melapor.`;
  }

  const pesan = String((galat && galat.message) || galat || "").slice(0, 160);
  return `${pekerjaan}: ${pesan || "sebabnya tidak terbaca"}.`;
}

/**
 * Satu pintu untuk memanggil ALETA.
 *
 * ============================================================================
 * KEGAGALAN YANG PALING PENTING TERJADI SEBELUM ADA JAWABAN
 * ============================================================================
 *
 * Memeriksa respons.status hanya menangkap permintaan yang SAMPAI. Ketika
 * servernya mati - keadaan yang justru paling sering - fetch melempar
 * TypeError sebelum ada status apa pun, dan lemparan itu melewati seluruh
 * pemeriksaan status di bawahnya.
 *
 * Akibatnya yang tergambar di panel bunyi mentah peramban: "Failed to fetch".
 * Kalimat itu benar dan tidak menolong siapa pun.
 *
 * Fungsi ini menangkapnya di tempat ia terjadi, lalu melempar ulang dengan
 * kalimat yang menyebut sebab DAN apa yang masih jalan tanpa server - lihat
 * alatPesanGagal.
 *
 * ============================================================================
 * TIDAK SEMUA PERMINTAAN MELEWATI SINI - DAN ITU DISENGAJA
 * ============================================================================
 *
 * Lima permintaan di konten.js tetap memanggil fetch langsung, sebab kelimanya
 * memang TIDAK menampilkan apa pun ketika gagal: penutup titipan, pemeriksa
 * versi, penanda daftar massal, pembaca keadaan permintaan, dan penyisip panel
 * itu sendiri. Yang terakhir yang paling menentukan: panel disisipkan pada
 * TIAP halaman perkara SIPP, dan panel yang berteriak di tiap halaman ketika
 * ALETA mati persis yang membuat ekstensinya dimatikan orang.
 *
 * Membungkusnya di sini hanya menyusun kalimat yang lalu dibuang di catch
 * kosong. Angkanya dijaga uji ekstensi-pesan-gagal, supaya permintaan BARU
 * yang mentah memaksa penulisnya memilih dengan sadar - bukan lolos diam-diam.
 */
/**
 * ============================================================================
 * BATAS WAKTU, PENYATUAN, DAN SATU PERCOBAAN KEDUA
 * ============================================================================
 *
 * Tiga hal yang membuat panel terasa menggantung ketika portal sedang berat,
 * dan ketiganya tidak menghilangkan satu pun kemampuan:
 *
 *   BATAS WAKTU  fetch tanpa batas menggantung sampai peramban menyerah
 *                sendiri - pada Chrome itu bermenit-menit. Selama itu
 *                bagian panel tetap bertulis "memuat..." tanpa satu pun
 *                keterangan, dan yang membacanya menyimpulkan ekstensinya
 *                rusak. Sembilan detik: cukup untuk jaringan kantor yang
 *                lambat, terlalu singkat untuk terasa sebagai panel macet.
 *
 *   PENYATUAN    halaman SIPP mengubah DOM-nya terus-menerus, dan beberapa
 *                bagian panel meminta alamat yang SAMA dalam hitungan
 *                milidetik. Permintaan yang sedang terbang dipakai bersama,
 *                bukan diulang - jawabannya disalin untuk tiap peminta.
 *
 *   PERCOBAAN    satu kedipan jaringan tidak lagi berakhir sebagai pesan
 *   KEDUA        galat. Diulang sekali, sesudah jeda pendek.
 *
 * ============================================================================
 * HANYA BACAAN YANG DISATUKAN DAN DIULANG
 * ============================================================================
 *
 * Ini pagar yang menentukan. Permintaan yang MENULIS - menetapkan,
 * membongkar, mengesahkan - tidak pernah disatukan dan tidak pernah diulang:
 * dua penetapan yang kebetulan beralamat sama bukan satu penetapan, dan
 * permintaan tulis yang diulang sesudah jawabannya hilang di jalan akan
 * menuliskannya DUA KALI ke dalam berkas perkara yang sungguhan.
 *
 * Yang dipakai sebagai pembeda method-nya: tanpa method berarti GET, dan
 * hanya GET yang boleh disatukan maupun diulang.
 */
const ALAT_BATAS_MS = 9000;
/** Jawaban yang lebih lama dari ini dicatat sebagai portal yang sedang berat. */
const ALAT_AMBANG_LAMBAT_MS = 2500;
const ALAT_JEDA_ULANG_MS = 400;

/** Permintaan bacaan yang sedang terbang, menurut alamatnya. */
const alatTerbang = new Map();

/** Keadaan portal menurut permintaan terakhir - dibaca panel bila perlu. */
const alatKeadaanPortal = { lambat: false, terakhirMs: 0, gagalBerturut: 0 };

function alatCatatKecepatan(lamaMs, berhasil) {
  alatKeadaanPortal.terakhirMs = lamaMs;
  alatKeadaanPortal.lambat = berhasil && lamaMs > ALAT_AMBANG_LAMBAT_MS;
  alatKeadaanPortal.gagalBerturut = berhasil ? 0 : alatKeadaanPortal.gagalBerturut + 1;
}

/** Kunci penyatuan - kosong berarti tidak boleh disatukan maupun diulang. */
function alatKunciPermintaan(alamat, opsi) {
  const cara = String((opsi && opsi.method) || "GET").toUpperCase();
  if (cara !== "GET") return "";
  return `GET ${alamat}`;
}

/**
 * Satu permintaan, dengan batas waktunya sendiri.
 *
 * batasMs boleh disebut pemanggil untuk pekerjaan yang memang lebih lama
 * daripada satu bacaan panel - unggahan naskah, misalnya. Ia DIBUANG dari
 * opsi sebelum diteruskan ke fetch: fetch tidak mengenalinya, dan
 * meninggalkannya di sana hanya menaruh medan asing di dalam permintaan.
 */
async function alatSekaliAmbil(alamat, opsi) {
  const { batasMs, ...sisa } = opsi || {};
  const batas = Number(batasMs) > 0 ? Number(batasMs) : ALAT_BATAS_MS;
  const pembatal = new AbortController();
  const jam = setTimeout(() => pembatal.abort(), batas);
  try {
    return await fetch(alamat, { ...sisa, signal: pembatal.signal });
  } finally {
    clearTimeout(jam);
  }
}

async function alatAmbil(alamat, opsi, yangDiminta) {
  const kunci = alatKunciPermintaan(alamat, opsi);

  // Jawaban DISALIN untuk tiap peminta. Badan Response hanya dapat dibaca
  // sekali, dan dua bagian panel yang berbagi satu Response akan membuat
  // yang kedua menerima "body already read" - galat yang tidak ada
  // hubungannya dengan apa pun yang dikerjakannya.
  if (kunci && alatTerbang.has(kunci)) {
    return (await alatTerbang.get(kunci)).clone();
  }

  const kerja = (async () => {
    const mulai = Date.now();
    try {
      const respons = await alatSekaliAmbil(alamat, opsi);

      // 5xx pada BACAAN diulang sekali - portal yang sedang dibangun ulang
      // menjawab 502 sekejap, lalu hidup lagi.
      if (kunci && respons.status >= 500) {
        await new Promise((r) => setTimeout(r, ALAT_JEDA_ULANG_MS));
        const lagi = await alatSekaliAmbil(alamat, opsi);
        alatCatatKecepatan(Date.now() - mulai, true);
        return lagi;
      }

      alatCatatKecepatan(Date.now() - mulai, true);
      return respons;
    } catch (galat) {
      // Batas waktu TIDAK diulang: yang sudah menunggu sembilan detik tidak
      // ditolong dengan menunggu sembilan detik lagi.
      if (kunci && galat && galat.name !== "AbortError") {
        try {
          await new Promise((r) => setTimeout(r, ALAT_JEDA_ULANG_MS));
          const lagi = await alatSekaliAmbil(alamat, opsi);
          alatCatatKecepatan(Date.now() - mulai, true);
          return lagi;
        } catch (galatKedua) {
          alatCatatKecepatan(Date.now() - mulai, false);
          throw new Error(alatPesanGagal(galatKedua, 0, yangDiminta));
        }
      }
      alatCatatKecepatan(Date.now() - mulai, false);
      throw new Error(alatPesanGagal(galat, 0, yangDiminta));
    }
  })();

  if (!kunci) return kerja;

  alatTerbang.set(kunci, kerja);
  // Kegagalannya ditelan DI SINI saja - supaya penghapusan kuncinya tetap
  // berjalan tanpa meninggalkan penolakan yang tidak tertangani. Penolakan
  // yang sesungguhnya tetap sampai ke pemanggil lewat await di bawah.
  void kerja.catch(() => {}).finally(() => alatTerbang.delete(kunci));
  return (await kerja).clone();
}

/**
 * ============================================================================
 * SKALA HURUF PANEL - SATU SETELAN, BERLAKU DI SELURUH PANEL
 * ============================================================================
 *
 * Panel ALETA dipakai berjam-jam di sebelah SIPP, dan ukuran hurufnya dipilih
 * dahulu untuk layar 1920 yang dekat. Di layar yang lebih besar, lebih jauh,
 * atau oleh mata yang lebih tua, huruf 12,5px itu terlalu kecil - dan satu-
 * satunya jalan yang tersedia selama ini adalah memperbesar SELURUH halaman
 * SIPP dengan Ctrl+Plus, yang justru merusak tabel perkaranya.
 *
 * Yang diskalakan HANYA ukuran huruf, bukan seluruh panel. Tiap font-size di
 * panel.css ditulis calc(Npx * var(--aleta-skala-huruf, 1)), jadi:
 *
 *   - tanpa setelan apa pun, pengalinya 1 dan tampilannya sama persis
 *     seperti sebelum kemampuan ini ada;
 *   - lebar panel, posisi, dan seluruh tata letaknya tidak bergeser, sehingga
 *     panel yang sudah diatur letaknya tetap di tempatnya.
 *
 * Disetel di popup ikon peramban dan disimpan di penyimpanan ekstensi, yang
 * MILIK PROFIL PERAMBAN masing-masing. Karena itu ia menjadi bawaan orang itu
 * sendiri - di komputer bersama, tiap petugas yang memakai profil Chrome-nya
 * sendiri punya ukurannya sendiri - dan bertahan sesudah halaman ditutup,
 * peramban ditutup, dan ekstensi diperbarui.
 *
 * Disetel pada documentElement, bukan pada panelnya: satu halaman dapat
 * memuat panel dan sisipan sekaligus, dan menyetelnya di akar membuat
 * seluruhnya ikut tanpa satu pun daftar elemen yang harus dijaga tetap
 * lengkap.
 */
const ALAT_SKALA_KUNCI = "skalaHuruf";
const ALAT_SKALA_BAWAAN = 100;
/** Di bawah ini huruf panel tidak lagi terbaca pada layar mana pun. */
const ALAT_SKALA_MIN = 80;
/** Di atas ini teks mulai melampaui kotaknya pada panel selebar 360px. */
const ALAT_SKALA_MAKS = 160;
const ALAT_SKALA_LANGKAH = 10;

/**
 * Nilai apa pun menjadi persen yang sah - dibulatkan ke kelipatan langkah.
 *
 * Yang tersimpan pernah ditulis tangan lewat penyimpanan ekstensi, dan nilai
 * seperti 1000 akan membuat satu huruf memenuhi layar tanpa ada jalan kembali
 * selain membuka popup yang hurufnya ikut raksasa.
 */
function alatRapikanSkala(nilai) {
  const angka = Number(nilai);
  if (!Number.isFinite(angka)) return ALAT_SKALA_BAWAAN;
  const dibulatkan = Math.round(angka / ALAT_SKALA_LANGKAH) * ALAT_SKALA_LANGKAH;
  return Math.min(ALAT_SKALA_MAKS, Math.max(ALAT_SKALA_MIN, dibulatkan));
}

/** Memasang pengalinya pada akar dokumen. */
function alatTerapkanSkalaHuruf(persen) {
  const bersih = alatRapikanSkala(persen);
  try {
    document.documentElement.style.setProperty("--aleta-skala-huruf", String(bersih / 100));
  } catch {
    /* halaman tanpa documentElement tidak mungkin ada - dan kalau ada,
       ukuran huruf bukan yang perlu dirisaukan */
  }
  return bersih;
}

/** Membaca setelan tersimpan lalu memasangnya. Dipanggil sekali saat muat. */
async function alatMuatSkalaHuruf() {
  try {
    const simpan = await chrome.storage.local.get([ALAT_SKALA_KUNCI]);
    return alatTerapkanSkalaHuruf(simpan[ALAT_SKALA_KUNCI]);
  } catch {
    // Penyimpanan tidak tersedia - ukuran bawaan tetap dipakai, dan panelnya
    // tetap terbaca. Ini bukan keadaan yang pantas menghentikan apa pun.
    return alatTerapkanSkalaHuruf(ALAT_SKALA_BAWAAN);
  }
}

// Dipasang SEBELUM panel digambar, supaya tidak ada kedipan dari ukuran
// bawaan ke ukuran pilihan petugas.
void alatMuatSkalaHuruf();

// Perubahan dari popup berlaku seketika di seluruh tab yang terbuka, tanpa
// memuat ulang halaman dan tanpa izin "tabs".
try {
  chrome.storage.onChanged.addListener((perubahan, wilayah) => {
    if (wilayah !== "local" || !perubahan[ALAT_SKALA_KUNCI]) return;
    alatTerapkanSkalaHuruf(perubahan[ALAT_SKALA_KUNCI].newValue);
  });
} catch {
  /* di luar ekstensi tidak ada chrome.storage - panelnya tetap tergambar */
}

/**
 * ============================================================================
 * PETUNJUK FITUR: MUNCUL SESUDAH KURSOR DIAM DUA DETIK
 * ============================================================================
 *
 * Tiap tombol di kepala dan kaki panel sudah membawa title yang menerangkan
 * gunanya. Tetapi petunjuk bawaan peramban muncul kapan pun ia mau - sekitar
 * satu detik, tidak dapat diatur - dan bentuknya kotak kuning kecil yang
 * tidak mengikuti tema, terpotong pada kalimat panjang, dan hilang begitu
 * kursor bergeser satu piksel.
 *
 * Yang diminta: penjelasan yang berbeda untuk tiap fitur, muncul sesudah
 * kursor diam dua detik. Dua detik bukan angka sembarang - kursor yang lewat
 * di atas deretan ikon tidak boleh memunculkan lima petunjuk berturut-turut;
 * yang diam dua detik memang sedang bertanya.
 *
 * ============================================================================
 * TITLE-NYA DIPINDAHKAN, BUKAN DISALIN
 * ============================================================================
 *
 * Pada sentuhan pertama, title dipindahkan ke data-aleta-tip dan dihapus
 * dari elemennya. Tanpa itu peramban tetap memunculkan petunjuk bawaannya
 * pada detik pertama, dan petunjuk ini pada detik kedua - dua kotak untuk
 * satu pertanyaan. Kalimatnya tidak hilang: ia tetap dibaca dari
 * data-aleta-tip, dan tetap tersedia bagi pembaca layar lewat aria-label
 * bila elemennya belum punya.
 *
 * Satu kotak untuk seluruh halaman, dibuat saat pertama kali dibutuhkan.
 */
const ALAT_PETUNJUK_JEDA_MS = 2000;
const ALAT_PETUNJUK_ID = "aleta-petunjuk";

function alatKotakPetunjuk() {
  let kotak = document.getElementById(ALAT_PETUNJUK_ID);
  if (kotak) return kotak;
  kotak = document.createElement("div");
  kotak.id = ALAT_PETUNJUK_ID;
  kotak.className = "aleta-petunjuk";
  kotak.setAttribute("role", "tooltip");
  kotak.hidden = true;
  document.body.appendChild(kotak);
  return kotak;
}

function alatPasangPetunjuk(akar) {
  if (!akar || akar.dataset.aletaPetunjukTerpasang === "1") return;
  akar.dataset.aletaPetunjukTerpasang = "1";

  let jam = null;
  let sasaran = null;

  const sembunyikan = () => {
    if (jam) clearTimeout(jam);
    jam = null;
    sasaran = null;
    const kotak = document.getElementById(ALAT_PETUNJUK_ID);
    if (kotak) kotak.hidden = true;
  };

  const tunjukkan = (elemen) => {
    const teks = elemen.getAttribute("data-aleta-tip") || "";
    if (!teks) return;
    const kotak = alatKotakPetunjuk();
    kotak.textContent = teks;
    // Ikut tema panelnya, bukan tema halaman - panel terang di atas SIPP
    // gelap harus memunculkan petunjuk yang terang pula.
    const tema = akar.getAttribute("data-tema") || "";
    if (tema) kotak.setAttribute("data-tema", tema);
    else kotak.removeAttribute("data-tema");
    kotak.hidden = false;

    // Di bawah elemennya; bila tidak muat, di atasnya. Dijepit ke tepi
    // layar supaya kalimat panjang tidak terpotong di kanan.
    const r = elemen.getBoundingClientRect();
    const lebar = kotak.offsetWidth;
    const tinggi = kotak.offsetHeight;
    let kiri = r.left;
    if (kiri + lebar > window.innerWidth - 8) kiri = window.innerWidth - 8 - lebar;
    if (kiri < 8) kiri = 8;
    let atas = r.bottom + 6;
    if (atas + tinggi > window.innerHeight - 8) atas = r.top - 6 - tinggi;
    if (atas < 8) atas = 8;
    kotak.style.left = `${Math.round(kiri)}px`;
    kotak.style.top = `${Math.round(atas)}px`;
  };

  akar.addEventListener("mouseover", (peristiwa) => {
    const asal = peristiwa.target;
    if (!asal || asal.nodeType !== 1) return;
    const elemen = asal.closest("[title], [data-aleta-tip]");
    if (!elemen || !akar.contains(elemen)) return;
    if (elemen === sasaran) return;

    // Pindahkan, jangan salin - lihat catatan di atas.
    const title = elemen.getAttribute("title");
    if (title) {
      elemen.setAttribute("data-aleta-tip", title);
      elemen.removeAttribute("title");
      if (!elemen.getAttribute("aria-label")) elemen.setAttribute("aria-label", title);
    }

    sembunyikan();
    sasaran = elemen;
    jam = setTimeout(() => {
      jam = null;
      if (sasaran === elemen) tunjukkan(elemen);
    }, ALAT_PETUNJUK_JEDA_MS);
  });

  akar.addEventListener("mouseout", (peristiwa) => {
    if (!sasaran) return;
    const tujuan = peristiwa.relatedTarget;
    // Masih di dalam elemen yang sama - anak-anaknya juga milik dia.
    if (tujuan && tujuan.nodeType === 1 && sasaran.contains(tujuan)) return;
    sembunyikan();
  });

  // Menekan, menggulung, atau mengetik berarti pertanyaannya sudah terjawab.
  // Peristiwa pointer, bukan peristiwa tetikus: satu jalur untuk tetikus,
  // sentuh, dan pena - sama dengan seluruh pegangan panel lainnya.
  akar.addEventListener("pointerdown", sembunyikan, true);
  akar.addEventListener("scroll", sembunyikan, true);
  akar.addEventListener("keydown", sembunyikan, true);
}

/**
 * ============================================================================
 * KELAS WARNA CHIP MENURUT PERAN PENGGUNA
 * ============================================================================
 *
 * Satu tempat untuk ketiga panel, supaya "Super Admin" berwarna sama di SIPP,
 * ABT, dan ALETA. Super admin bergradasi berkilau bergerak, admin bergradasi
 * diam, hakim dan panitera berwarna sendiri, selebihnya polos - urutannya
 * dari yang paling khusus, sebab "super admin" memuat kata "admin".
 */
/**
 * ============================================================================
 * TANDA PERAN PADA AKAR PANEL - SATU ATRIBUT, TIGA PANEL
 * ============================================================================
 *
 * Chip perannya sudah berwarna sejak 1.121.0, tetapi warnanya berhenti di
 * chip itu sendiri. Yang diminta: panel super admin TERLIHAT berbeda sejak
 * pandangan pertama, di SIPP, ABT, dan halaman ALETA sekaligus.
 *
 * Dikerjakan dengan satu atribut pada akar panel, bukan dengan kelas yang
 * ditempel di banyak tempat: gayanya lalu tinggal satu blok CSS, dan panel
 * mana pun yang memakai panel-alat.js ikut tanpa satu baris tambahan.
 *
 * Nilainya SAMA dengan kelas chipnya - "super", "admin", dan seterusnya -
 * supaya keduanya tidak pernah dapat berselisih.
 */
function alatTandaiPeranPanel(akar, peran) {
  if (!akar || !akar.setAttribute) return;
  const kelas = alatKelasPeran(peran);
  const nama = kelas.replace(/^aleta-peran-/, "");
  if (nama && nama !== "lain") akar.setAttribute("data-peran", nama);
  else akar.removeAttribute("data-peran");
}

function alatKelasPeran(peran) {
  const p = String(peran || "").toLowerCase();
  if (!p) return "aleta-peran-lain";
  if (/super/.test(p)) return "aleta-peran-super";
  if (/admin/.test(p)) return "aleta-peran-admin";
  if (/hakim|ketua|wakil/.test(p)) return "aleta-peran-hakim";
  if (/panitera|jurusita|juru\s*sita|\bpp\b/.test(p)) return "aleta-peran-panitera";
  return "aleta-peran-lain";
}

/*
 * ============================================================================
 * MENU PER PERAN - SATU SUMBER UNTUK PANEL SIPP DAN ABT (perbaikan 30 Sep sore)
 * ============================================================================
 *
 * Pengguna menetapkan susunan menu per peran, di dalam perkara dan di halaman
 * daftar / beranda. Panel SIPP (konten.js), panel ABT (abt.js), dan Juru Sita
 * (jurusita.js) membaca DARI SINI - bukan menyimpan daftar peran sendiri yang
 * dapat berselisih.
 *
 * alatGolonganPeran(peran) -> "admin" | "ketua" | "hakim" | "panitera" |
 *                             "jurusita" | "lain"
 *   peran = nama peran portal ("Super Admin", "Wakil Ketua", "Panitera
 *   Pengganti", "Jurusita", ...) atau id-nya ("super-admin", ...).
 *   "lain" (operator, analis perkara, staf, ...) = susunan lama TIDAK
 *   dikurangi: alatMenuPeran memulangkan null dan pemanggil memakai
 *   kewenangan yang sudah ada.
 *
 * alatMenuPeran(situs, halaman, peran, opsi) -> string[] | null
 *   situs   "sipp" | "abt"
 *   halaman "perkara" (di dalam satu perkara) | "daftar" (daftar perkara SIPP
 *           / beranda ABT)
 *   opsi.ditangani   false = pengguna TIDAK menangani perkara ini (bukan
 *                    majelis/PP/JS-nya). undefined = belum diketahui ->
 *                    diperlakukan menangani (tidak mengurangi).
 *   opsi.penunjukanLengkap  true = PMH, PPP, PJS, dan PHS sudah ada (tab
 *                    Penetapan Ketua/Wakil disembunyikan).
 *   Hasilnya URUTAN menu dari kiri ke kanan (menu pertama = bawaan terbuka).
 *   null = tidak ada aturan untuk peran ini -> pemanggil memakai susunan lama.
 *
 * Kunci menu:
 *   SIPP perkara : "penetapan" "putusan" "jurusita" "berkas" "perkara"
 *   ABT perkara  : "isi-input" (Isi dari SIPP & input ke ABT) "unggah-putusan"
 *                  "susun-saksi" "jurusita" (relaas & PBT) "semua" (admin)
 *                  "isi-bas" (Isi dari SIPP & input ke ABT KHUSUS blangko BAS -
 *                  panitera sidang/PP, perbaikan 2 Okt sore butir 7)
 *   daftar/beranda: "penetapan-massal" "bas-massal" "relaas-pbt-massal"
 *                  "putusan-massal"
 *
 * Yang TIDAK menangani perkara ini hanya melihat Perkara dan Berkas (SIPP)
 * atau tidak ada menu kerja (ABT) - membaca tetap boleh, mengerjakan tidak.
 * Admin dan Super Admin selalu melihat seluruhnya.
 */
function alatGolonganPeran(peran) {
  const p = String(peran || "").toLowerCase().replace(/[-_]+/g, " ").trim();
  if (!p) return "lain";
  if (/super|\badmin\b|administrator/.test(p)) return "admin";
  // "Wakil Ketua" sudah memuat kata ketua; "wakil" saja tidak cukup - "Wakil Panitera" adalah panitera.
  if (/\bketua\b/.test(p)) return "ketua";
  if (/hakim/.test(p)) return "hakim";
  if (/juru\s*sita|jurusita/.test(p)) return "jurusita";
  // \bpanitera\b (2 Okt, butir 16b): "Staf Kepaniteraan" / "Kepaniteraan Hukum"
  // BUKAN panitera - tanpa batas kata, staf unit kepaniteraan ikut golongan
  // panitera dan kehilangan fitur peran "lain" (mis. scan KTP saksi, K5).
  if (/\bpanitera\b|\bpp\b/.test(p)) return "panitera";
  return "lain";
}

// Menu "putusan" / "putusan-massal" / "unggah-putusan" hanya pada golongan
// admin, ketua, hakim - selaras dengan keputusan 9 Okt 2026 (hak unggah
// putusan = Super Admin, Admin, Hakim termasuk Ketua/Wakil). Peran "lain"
// (null = susunan lama) tetap TIDAK diberi bagian unggahnya: konten.js/abt.js
// menanyakan alatBolehUnggahPutusan sendiri, dan pemantau ambil menahannya.
const ALAT_MENU_PERAN = {
  sipp: {
    perkara: {
      // "ptsp" (perbaikan 5 Okt butir 11): tab PTSP - Data Umum dari berkas
      // gugatan (dulu di Penetapan), saksi/pihak dari foto KTP, rapikan
      // identitas para pihak. Ketua tetap mendapatkannya karena Data Umum
      // dulu ada di tab Penetapannya (fitur lama tidak dikurangi). Peran
      // "lain" (PTSP/operator) memakai susunan lama = semua tab, termasuk PTSP.
      admin: ["penetapan", "ptsp", "putusan", "jurusita", "berkas", "perkara"],
      ketua: ["penetapan", "putusan", "berkas", "perkara", "ptsp"],
      hakim: ["putusan", "berkas", "perkara"],
      panitera: ["berkas", "perkara"],
      jurusita: ["jurusita", "perkara", "berkas"],
    },
    daftar: {
      admin: ["penetapan-massal", "bas-massal", "relaas-pbt-massal", "putusan-massal"],
      ketua: ["penetapan-massal", "putusan-massal"],
      hakim: ["putusan-massal"],
      panitera: ["bas-massal"],
      jurusita: ["relaas-pbt-massal"],
    },
  },
  abt: {
    perkara: {
      admin: ["semua"],
      ketua: ["isi-input", "unggah-putusan"],
      hakim: ["isi-input", "unggah-putusan"],
      panitera: ["susun-saksi", "isi-bas"],
      jurusita: ["jurusita"],
    },
    daftar: {
      admin: ["putusan-massal", "bas-massal", "relaas-pbt-massal"],
      ketua: ["putusan-massal"],
      hakim: ["putusan-massal"],
      panitera: ["bas-massal"],
      jurusita: ["relaas-pbt-massal"],
    },
  },
};

/*
 * ============================================================================
 * HAK UNGGAH PUTUSAN - PERAN EKSPLISIT (keputusan 9 Okt 2026)
 * ============================================================================
 *
 * "untuk putusan itu hanya bisa dilakukan oleh superadmin, admin dan hakim,
 * yang lain tidak boleh upload putusan ke sipp".
 *
 * Berlaku untuk SEMUA jalur putusan: e-Doc putusan + anonimisasi ke SIPP,
 * isian borang Putusan Akhir otomatis ("Isikan yang dicentang"/simpan),
 * putusan massal SIPP dan ABT, dan upload salinan putusan ke e-Court.
 * Golongan "admin" (Super Admin, Admin), "hakim", dan "ketua" (Ketua/Wakil -
 * hakim yang mengetuai majelis). PP, panitera, juru sita, operator, analis,
 * staf: TIDAK - bagiannya tidak digambar dan tiap permintaannya ditahan
 * pemantau ambil (alatUnggahPutusanDitahan) dengan kalimat di bawah.
 *
 * Bukan lagi kemampuan "penunjukan" (papan penunjukan): itu gerbang
 * PENETAPAN, dan menumpanginya membuat PP & JS kehilangan/ mendapat hak putusan
 * menurut saklar yang tidak ada hubungannya (temuan uji U1).
 *
 * Penjagaan sesungguhnya di peladen: rute portal menolak 403 dan gerbang bot
 * menolak sekali lagi. Di sini KENYAMANAN - supaya tombol yang pasti ditolak
 * tidak ditawarkan.
 */
const ALAT_PESAN_TOLAK_UNGGAH_PUTUSAN =
  "Unggah putusan ke SIPP dan e-Court hanya untuk Hakim, Admin, dan Super Admin. Peran Anda tidak diberi hak ini.";

/**
 * true | false | null. `pengguna` = objek { peran, bolehUnggahPutusan? } dari
 * portal, atau nama/id peran. Jawaban peladen (bolehUnggahPutusan) menang;
 * tanpa itu dihitung dari golongan perannya. null = peran belum diketahui
 * (belum masuk / belum terbaca) - pemanggil menggambar seperti biasa dan
 * peladen yang menolak.
 */
function alatBolehUnggahPutusan(pengguna) {
  let peran = pengguna;
  if (pengguna && typeof pengguna === "object") {
    if (typeof pengguna.bolehUnggahPutusan === "boolean") return pengguna.bolehUnggahPutusan;
    peran = pengguna.peran;
  }
  const p = String(peran || "").trim();
  if (!p) return null;
  const golongan = alatGolonganPeran(p);
  return golongan === "admin" || golongan === "hakim" || golongan === "ketua";
}

/**
 * Akun ALETA yang sedang masuk di halaman ini - BUKAN peran pratinjau "ganti
 * peran": yang ditahan di sini tulisan sungguhan, dan yang menentukannya
 * akun yang sungguh masuk. Dibaca dari variabel milik konten.js (SIPP) atau
 * abt.js (ABT) bila ada.
 */
function alatPenggunaAkunAleta() {
  try {
    // eslint-disable-next-line no-undef
    if (typeof penggunaTerakhir !== "undefined" && penggunaTerakhir) return penggunaTerakhir;
  } catch {
    /* bukan halaman SIPP */
  }
  try {
    // eslint-disable-next-line no-undef
    if (typeof penggunaAletaAbt !== "undefined" && penggunaAletaAbt) return penggunaAletaAbt;
  } catch {
    /* bukan halaman ABT */
  }
  return null;
}

/** Hak unggah putusan akun yang sedang masuk: true | false | null (belum diketahui). */
function alatBolehUnggahPutusanKini() {
  return alatBolehUnggahPutusan(alatPenggunaAkunAleta());
}

/** Rute portal yang MENULIS putusan atau menyiapkan isian borang putusan. */
const ALAT_RUTE_UNGGAH_PUTUSAN = [
  /\/aleta\/api\/aleta-ecourt\/putusan\/unggah-sipp(?:[?#]|$)/,
  /\/aleta\/api\/aleta-ecourt\/putusan\/unggah-naskah(?:[?#]|$)/,
  /\/aleta\/api\/aleta-ecourt\/putusan\/isian-sipp(?:[?#]|$)/,
  /\/aleta\/api\/aleta-ecourt\/ecourt-putusan\/unggah(?:[?#]|$)/,
];

/**
 * Ditahan karena peran yang masuk TIDAK berhak unggah putusan? Hanya bila
 * perannya PASTI bukan Hakim/Admin/Super Admin - peran yang belum terbaca
 * dibiarkan berangkat, dan peladen yang menolak 403.
 */
function alatUnggahPutusanDitahan(alamat) {
  const a = String(alamat || "");
  if (!ALAT_RUTE_UNGGAH_PUTUSAN.some((pola) => pola.test(a))) return false;
  return alatBolehUnggahPutusanKini() === false;
}

/** Jawaban tiruan 403 untuk permintaan putusan yang ditahan - bentuk badannya sama dengan portal. */
function alatJawabanTolakUnggahPutusan() {
  const badan = JSON.stringify({
    ok: false,
    error: { message: ALAT_PESAN_TOLAK_UNGGAH_PUTUSAN },
    data: { ok: false, alasan: "peran_tidak_boleh_unggah_putusan", sebab: ALAT_PESAN_TOLAK_UNGGAH_PUTUSAN },
    alasan: "peran_tidak_boleh_unggah_putusan",
    pesan: ALAT_PESAN_TOLAK_UNGGAH_PUTUSAN,
  });
  return new Response(badan, {
    status: 403,
    statusText: "Forbidden",
    headers: { "content-type": "application/json" },
  });
}

/**
 * Kotak terkunci pengganti bagian putusan bagi peran yang tidak berhak -
 * fiturnya tidak hilang diam-diam: alasannya disebut di tempatnya.
 */
function alatKotakTerkunciPutusan(judul) {
  const kotak = alatEl("div", "aleta-terkunci-putusan aleta-kosong-lembut");
  kotak.setAttribute("data-aleta-terkunci", "unggah-putusan");
  kotak.setAttribute("role", "note");
  kotak.textContent = `${judul ? `${judul}: ` : ""}${ALAT_PESAN_TOLAK_UNGGAH_PUTUSAN}`;
  return kotak;
}

/*
 * ============================================================================
 * HAK KASIR - TAB KASIR EKSTENSI (1.189.x butir 3)
 * ============================================================================
 *
 * Sama dengan Kasir 1.186 di portal (lib/kasir-jurnal.ts bolehKasir): kasir,
 * petugas keuangan perkara, bendahara, analis keuangan, Panitera dan Panitera
 * Muda, Admin, Super Admin. Panitera PENGGANTI, hakim, juru sita TIDAK -
 * golongan "panitera" matriks menu memuat PP, jadi Kasir tidak menumpang
 * matriks itu. Jawaban server (bolehKasir dari sipp-konteks / siapa) menang;
 * tanpa itu dihitung dari nama perannya. Rute kasir tetap menolak sendiri.
 */
function alatBolehKasir(pengguna) {
  let peran = pengguna;
  if (pengguna && typeof pengguna === "object") {
    if (typeof pengguna.bolehKasir === "boolean") return pengguna.bolehKasir;
    peran = pengguna.peran;
  }
  const p = String(peran || "").toLowerCase().replace(/[-_]+/g, " ").trim();
  if (!p) return null;
  if (alatGolonganPeran(p) === "admin") return true;
  if (/kasir|keuangan|bendahara/.test(p)) return true;
  if (/pengganti|\bpp\b/.test(p)) return false;
  return /^panitera( muda)?$|\bpanitera muda\b/.test(p) || p === "panitera";
}

/**
 * Rentang periode rekap kasir yang MEMUAT tanggal itu - kembaran
 * rentangPeriode di manajemen_surat/src/lib/kasir-otomatis.ts (uji
 * kasir-otomatis.test.ts menuntut jawabannya sama). Minggu = Senin-Minggu.
 */
function alatKasirRentang(periode, tanggal) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(tanggal || ""));
  if (!m) return null;
  const t = Number(m[1]);
  const b = Number(m[2]) - 1;
  const h = Number(m[3]);
  const iso = (tt, bb, hh) => new Date(Date.UTC(tt, bb, hh)).toISOString().slice(0, 10);
  if (periode === "harian") return { dari: iso(t, b, h), sampai: iso(t, b, h) };
  if (periode === "mingguan") {
    const mundur = (new Date(Date.UTC(t, b, h)).getUTCDay() + 6) % 7;
    return { dari: iso(t, b, h - mundur), sampai: iso(t, b, h - mundur + 6) };
  }
  if (periode === "bulanan") return { dari: iso(t, b, 1), sampai: iso(t, b + 1, 0) };
  if (periode === "triwulan") {
    const q = Math.floor(b / 3);
    return { dari: iso(t, q * 3, 1), sampai: iso(t, q * 3 + 3, 0) };
  }
  if (periode === "semester") {
    const s = b < 6 ? 0 : 1;
    return { dari: iso(t, s * 6, 1), sampai: iso(t, s * 6 + 6, 0) };
  }
  if (periode === "tahunan") return { dari: iso(t, 0, 1), sampai: iso(t, 11, 31) };
  return null;
}

function alatMenuPeran(situs, halaman, peran, opsi) {
  const o = opsi && typeof opsi === "object" ? opsi : {};
  // R 11 Okt: `peran` boleh objek pengguna { peran, bolehKasir, peranTambahan }
  // - golongan menu Kasir/PTSP dikenali dari situ (alatGolonganMenuSemua).
  const golonganSemua = alatGolonganMenuSemua(peran);
  const golongan = golonganSemua[0];
  const tabel = ALAT_MENU_PERAN[situs] && ALAT_MENU_PERAN[situs][halaman];
  if (!tabel || !golonganSemua.some((g) => tabel[g])) return null;
  let menu = [];
  for (const g of golonganSemua) for (const k of tabel[g] || []) if (!menu.includes(k)) menu.push(k);
  if (golongan === "admin") return menu;
  // R 11 Okt: kasir & PTSP bekerja atas SEMUA perkara - "ditangani" tidak berlaku.
  if (halaman === "perkara" && o.ditangani === false && golongan !== "kasir" && golongan !== "ptsp") {
    // Membaca boleh, mengerjakan tidak. KECUALI Penetapan bagi Ketua/Wakil
    // (agen W, uji ekstensi-menu-peran): PMH/PPP/PJS/PHS justru ditetapkan
    // SEBELUM ada majelis, jadi ketua belum pernah "menangani" perkara yang
    // hendak ia tetapkan majelisnya - dan kontrak K2 menyebut Ketua/Wakil
    // dianggap menangani semua perkara untuk Penetapan. Tanpa pengecualian
    // ini tab Penetapan hilang tepat di perkara baru yang membutuhkannya.
    menu =
      situs === "sipp"
        ? menu.filter(
            (k) => k === "perkara" || k === "berkas" || (golongan === "ketua" && (k === "penetapan" || k === "ptsp"))
          )
        : [];
  }
  if (situs === "sipp" && halaman === "perkara" && golongan === "ketua" && o.penunjukanLengkap === true) {
    menu = menu.filter((k) => k !== "penetapan");
  }
  return menu;
}

/* === R 11 Okt === */
/*
 * GOLONGAN MENU KASIR & PTSP (perbaikan tampilan per peran, 11 Okt 2026)
 *
 * "buat tampilannya sesuai dengan rolenya jangan sampai tercampur (kecuali
 * superadmin dan admin)". Kasir (peran tambahan kasir/keuangan/bendahara,
 * Analis Keuangan) dan petugas PTSP/operator selama ini jatuh ke golongan
 * "lain" -> alatMenuPeran null -> SELURUH tab (Penetapan, Putusan, Juru Sita,
 * ...) tampil bagi mereka. Golongan menu di sini HANYA untuk matriks menu;
 * alatGolonganPeran tidak berubah (dipakai gerbang lain: saksiscan "lain",
 * BAS massal, unggah putusan) supaya tidak ada kewenangan yang bergeser.
 *
 * Urutan pengenalan: golongan jabatan yang sudah ada menang (admin, ketua,
 * hakim, panitera, jurusita). Hanya "lain" yang diperinci menjadi "kasir"
 * dan/atau "ptsp"; yang tidak dikenali tetap "lain" (susunan lama).
 */
const ALAT_PERAN_TAMBAHAN_KASIR = ["kasir", "petugas_keuangan_perkara", "bendahara_penerimaan", "bendahara_pengeluaran"];
const ALAT_PERAN_TAMBAHAN_PTSP = [
  "petugas_ptsp",
  "petugas_meja_informasi",
  "petugas_pendaftaran_perkara",
  "resepsionis",
  "operator_sipp",
  "operator_edoc",
  "petugas_ecourt",
  "petugas_validasi_ecourt",
  "petugas_gugatan_mandiri",
];
// "Kasubag Umum dan Keuangan" BUKAN kasir (kesekretariatan) - polanya sempit;
// jawaban server bolehKasir dan peran tambahan yang menentukan selebihnya.
const ALAT_POLA_PERAN_KASIR = /kasir|bendahara|analis keuangan|keuangan perkara/;
const ALAT_POLA_PERAN_PTSP = /ptsp|operator|meja informasi|pendaftaran|resepsionis|front office/;

ALAT_MENU_PERAN.sipp.perkara.kasir = ["kasir", "perkara"];
ALAT_MENU_PERAN.sipp.perkara.ptsp = ["ptsp", "berkas", "perkara"];
// Kasir massal/rekap/pengingat bukan menu daftar umum: tempatnya halaman
// daftar jurnal keuangan (konten.js r11HalamanJurnalDaftar), bukan dashboard.
ALAT_MENU_PERAN.sipp.daftar.kasir = [];
// Penetapan massal tetap ditawarkan: gerbang kemampuan "penunjukan" (diatur
// Admin per peran) yang memutuskan di konten.js - matriks hanya mengurangi.
ALAT_MENU_PERAN.sipp.daftar.ptsp = ["penetapan-massal"];
// ABT: kasir tidak punya pekerjaan blangko. PTSP di ABT belum diputuskan
// pengguna - tetap susunan lama (tanpa kunci).
ALAT_MENU_PERAN.abt.perkara.kasir = [];
ALAT_MENU_PERAN.abt.daftar.kasir = [];

/**
 * Golongan menu (satu atau lebih, urut) untuk nama peran ATAU objek pengguna
 * { peran, bolehKasir?, peranTambahan? }. Selalu memulangkan larik tak kosong.
 */
function alatGolonganMenuSemua(pengguna) {
  // HAK-PERAN 12 Okt: golongan dari matriks peran portal menang atas tebakan nama.
  const dariServer = alatGolonganDariServer(pengguna);
  if (dariServer) return dariServer;
  const objek = pengguna && typeof pengguna === "object" ? pengguna : null;
  const peran = objek ? objek.peran : pengguna;
  const dasar = alatGolonganPeran(peran);
  if (dasar !== "lain") return [dasar];
  const p = String(peran || "").toLowerCase().replace(/[-_]+/g, " ").trim();
  const tambahan = objek && Array.isArray(objek.peranTambahan) ? objek.peranTambahan.map((x) => String(x || "").toLowerCase()) : [];
  const hasil = [];
  if (ALAT_POLA_PERAN_KASIR.test(p) || tambahan.some((x) => ALAT_PERAN_TAMBAHAN_KASIR.includes(x)) || (objek && objek.bolehKasir === true)) {
    hasil.push("kasir");
  }
  if (ALAT_POLA_PERAN_PTSP.test(p) || tambahan.some((x) => ALAT_PERAN_TAMBAHAN_PTSP.includes(x))) hasil.push("ptsp");
  return hasil.length ? hasil : ["lain"];
}

/** Golongan menu utama (yang pertama) - "kasir"/"ptsp" hanya bila jabatannya "lain". */
function alatGolonganMenu(pengguna) {
  return alatGolonganMenuSemua(pengguna)[0];
}
/* === AKHIR R 11 Okt === */

/* === HAK-PERAN 12 Okt === */
/*
 * MATRIKS PERAN 12 Okt 2026 - satu sumber di portal (src/lib/matriks-peran.ts,
 * golonganMenuEkstensi). Server mengirim `golonganMenu` lewat /ekstensi/siapa,
 * sipp-konteks, dan sumber "siapa" ABT: jabatan (positionId) dan peran
 * tambahan ikut terbaca, juga di ABT yang dulu hanya tahu NAMA peran.
 * Matriks lengkap & alasannya: D:/aleta-dev/kerja/peran-12okt/matriks-peran.md.
 *
 * Golongan baru di sini (hanya bila datang dari server; tebakan nama tetap
 * golongan lama, sehingga portal lama tidak mengubah apa pun):
 *   pp           - Panitera Pengganti (dulu "panitera"): susunan lama panitera.
 *   panmud       - Panitera Muda: + tab PTSP (registrasi/Data Umum).
 *   panitera-utama - Panitera ("panitera" dari server): + tab PTSP (pengawas registrasi).
 *   mediator     - mediator non-hakim: Perkara, Berkas (baca).
 *   analis       - Analis Perkara: Berkas, Perkara; ABT bantu susun saksi/BAS.
 *   sekretariat  - Kesekretariatan: Perkara saja (tidak menangani perkara).
 *   lain-tetap   - pelaksana/TI/staf tanpa tugas perkara: Perkara saja.
 * Peran tanpa golonganMenu dari server tetap memakai tebakan lama
 * (alatGolonganPeran + R 11 Okt), termasuk "lain" = susunan lama.
 */
const ALAT_GOLONGAN_MENU_SAH = [
  "admin",
  "ketua",
  "hakim",
  "panitera",
  "panmud",
  "pp",
  "jurusita",
  "kasir",
  "ptsp",
  "mediator",
  "analis",
  "sekretariat",
  "lain",
];
let alatGolonganServerTerakhir = null;

/** Diingat dari jawaban server (ABT memanggil alatMenuPeran dengan NAMA peran). */
function alatSetelGolonganServer(daftar) {
  const bersih = Array.isArray(daftar)
    ? daftar.map((x) => String(x || "").toLowerCase()).filter((x) => ALAT_GOLONGAN_MENU_SAH.includes(x))
    : [];
  alatGolonganServerTerakhir = bersih.length ? bersih : null;
}

/** Golongan dari server (objek pengguna ber-golonganMenu, atau yang terakhir diingat) - null bila tidak ada. */
function alatGolonganDariServer(pengguna) {
  const objek = pengguna && typeof pengguna === "object" ? pengguna : null;
  let daftar = null;
  if (objek && Array.isArray(objek.golonganMenu)) {
    alatSetelGolonganServer(objek.golonganMenu);
    daftar = alatGolonganServerTerakhir;
  } else if (!objek && alatGolonganServerTerakhir && pengguna) {
    daftar = alatGolonganServerTerakhir;
  }
  if (!daftar || !daftar.length) return null;
  // "lain" dari server = tidak menangani perkara -> tabel "lain-tetap"
  // (bukan "lain" tebakan nama yang berarti susunan lama).
  // "panitera" dari server = Panitera sungguhan -> "panitera-utama" (tebakan
  // nama "panitera" tetap mencakup PP, susunan lamanya tidak diubah).
  return daftar.map((g) => (g === "lain" ? "lain-tetap" : g === "panitera" ? "panitera-utama" : g));
}

// SIPP - halaman perkara (tab pertama = tab bawaan terbuka)
ALAT_MENU_PERAN.sipp.perkara.pp = ["berkas", "perkara"];
ALAT_MENU_PERAN.sipp.perkara["panitera-utama"] = ["berkas", "perkara", "ptsp"];
ALAT_MENU_PERAN.sipp.perkara.panmud = ["berkas", "perkara", "ptsp"];
ALAT_MENU_PERAN.sipp.perkara.mediator = ["perkara", "berkas"];
ALAT_MENU_PERAN.sipp.perkara.analis = ["berkas", "perkara"];
ALAT_MENU_PERAN.sipp.perkara.sekretariat = ["perkara"];
ALAT_MENU_PERAN.sipp.perkara["lain-tetap"] = ["perkara"];
// SIPP - daftar/dashboard (menu massal)
ALAT_MENU_PERAN.sipp.daftar.pp = ["bas-massal"];
ALAT_MENU_PERAN.sipp.daftar["panitera-utama"] = ["bas-massal"];
ALAT_MENU_PERAN.sipp.daftar.panmud = ["bas-massal"];
ALAT_MENU_PERAN.sipp.daftar.mediator = [];
ALAT_MENU_PERAN.sipp.daftar.analis = ["bas-massal"];
ALAT_MENU_PERAN.sipp.daftar.sekretariat = [];
ALAT_MENU_PERAN.sipp.daftar["lain-tetap"] = [];
// ABT - perkara & beranda. PTSP di ABT SENGAJA tidak disentuh (keputusan
// R 11 Okt butir 5 masih menunggu pengguna) - tetap susunan lama.
ALAT_MENU_PERAN.abt.perkara.pp = ["susun-saksi", "isi-bas"];
ALAT_MENU_PERAN.abt.perkara["panitera-utama"] = ["susun-saksi", "isi-bas"];
ALAT_MENU_PERAN.abt.perkara.panmud = ["susun-saksi", "isi-bas"];
ALAT_MENU_PERAN.abt.perkara.mediator = [];
ALAT_MENU_PERAN.abt.perkara.analis = ["susun-saksi", "isi-bas"];
ALAT_MENU_PERAN.abt.perkara.sekretariat = [];
ALAT_MENU_PERAN.abt.perkara["lain-tetap"] = [];
ALAT_MENU_PERAN.abt.daftar.pp = ["bas-massal"];
ALAT_MENU_PERAN.abt.daftar["panitera-utama"] = ["bas-massal"];
ALAT_MENU_PERAN.abt.daftar.panmud = ["bas-massal"];
ALAT_MENU_PERAN.abt.daftar.mediator = [];
ALAT_MENU_PERAN.abt.daftar.analis = ["bas-massal"];
ALAT_MENU_PERAN.abt.daftar.sekretariat = [];
ALAT_MENU_PERAN.abt.daftar["lain-tetap"] = [];
/* === AKHIR HAK-PERAN === */

/*
 * ============================================================================
 * PERKAKAS SUPER ADMIN - TUJUH ALAT DI SATU LACI
 * ============================================================================
 *
 * Ketujuhnya menjawab satu keluhan yang sama, yang selama ini dijawab dengan
 * tangkapan layar dan tebakan: KETIKA SESUATU TIDAK BERES, TIDAK ADA TEMPAT
 * MELIHAT APA YANG SEBENARNYA TERJADI.
 *
 *   1. Lingkungan      - panel ini menempel di SIPP yang mana?
 *   2. Versi terpasang - yang berjalan sudah versi terbaru, atau lupa Reload?
 *   3. Mode kering     - coba dulu tanpa menyimpan apa pun.
 *   4. Papan kesehatan - sepuluh pertanyaan yang biasanya dijawab lewat SSH.
 *   5. Kotak hitam     - lima puluh kejadian terakhir, apa adanya.
 *   6. Riwayat tindakan- apa yang ALETA ubah, dan bagaimana mengembalikannya.
 *   7. Periksa penunjuk- masih ketemu tidak, tombol dan medan yang dicari?
 *
 * SEMUANYA HANYA UNTUK SUPER ADMIN, dan alasannya bukan kerahasiaan: ketujuh
 * alat ini menjawab pertanyaan ORANG YANG MEMPERBAIKI, bukan pertanyaan orang
 * yang sedang mengerjakan perkara. Petugas yang melihatnya hanya mendapat
 * enam tombol lagi yang harus diabaikan.
 *
 * Mencatat TIDAK BOLEH MENJADI BEBAN. Semua catatan disimpan di memori dengan
 * batas jumlah, disalin ke sessionStorage supaya selamat dari muat ulang
 * halaman - itu justru saat yang paling dibutuhkan, sebab kegagalan unggah
 * kerap diikuti halaman yang berpindah - dan tidak pernah dikirim ke mana
 * pun. Tidak ada satu pun permintaan jaringan tambahan yang dibuat hanya
 * untuk mencatat.
 */

/** Elemen ringkas - panel-alat.js tidak memuat buatElemen milik konten.js. */
function alatEl(tag, kelas, teks) {
  const e = document.createElement(tag);
  if (kelas) e.className = kelas;
  if (teks !== undefined && teks !== null) e.textContent = String(teks);
  return e;
}

/* ─── 1. LINGKUNGAN: SIPP YANG MANA ─────────────────────────────────────────
 *
 * SIPP di komputer ini dan SIPP di peladen tampilannya SAMA PERSIS - judul
 * yang sama, warna yang sama, nomor perkara yang sama, sebab basis datanya
 * memang salinan. Satu-satunya beda ada di bilah alamat, yang justru bagian
 * layar yang paling jarang dibaca ketika sedang bekerja.
 *
 * Akibat kekeliruannya tidak setara: yang salah menekan di komputer sendiri
 * kehilangan data uji; yang salah menekan di peladen mengubah perkara
 * sungguhan, dan penetapan massal tidak punya tombol batal.
 *
 * Karena itu lencananya TIDAK hanya untuk super admin: siapa pun yang sedang
 * membuka SIPP di luar peladen harus melihatnya. Di peladen sendiri lencana
 * itu justru DISEMBUNYIKAN dari petugas - di sanalah tempat yang benar, dan
 * tulisan yang selalu ada berhenti dibaca. Super admin tetap melihat keduanya,
 * sebab ia yang berpindah-pindah.
 */
const ALAT_INANG_PELADEN = "192.168.10.10";

function alatLingkungan() {
  let inang = "";
  try {
    inang = String(window.location.hostname || "");
  } catch {
    inang = "";
  }
  if (inang === ALAT_INANG_PELADEN) {
    return { kunci: "peladen", label: "SERVER", judul: `SIPP server ${ALAT_INANG_PELADEN} - data perkara SUNGGUHAN.` };
  }
  if (inang === "127.0.0.1" || inang === "localhost" || inang === "::1") {
    return { kunci: "lokal", label: "LOKAL", judul: "SIPP di komputer ini - salinan untuk uji coba, bukan data server." };
  }
  return { kunci: "lain", label: inang || "?", judul: `SIPP di ${inang || "alamat yang tidak dikenali"} - bukan server, bukan komputer ini.` };
}

function alatTandaiLingkungan(panel) {
  const l = alatLingkungan();
  try {
    document.documentElement.setAttribute("data-aleta-lingkungan", l.kunci);
  } catch {
    /* halaman tanpa akar - lencananya tetap terpasang */
  }
  if (panel && panel.setAttribute) panel.setAttribute("data-lingkungan", l.kunci);
  return l;
}

function alatLencanaLingkungan(peran) {
  const l = alatLingkungan();
  const super_ = /super/i.test(String(peran || ""));
  if (l.kunci === "peladen" && !super_) return null;
  const chip = alatEl("span", `aleta-lingkungan aleta-lingkungan-${l.kunci}`, l.label);
  chip.title = l.judul;
  return chip;
}

/* ─── 2. KOTAK HITAM ────────────────────────────────────────────────────────
 *
 * Lima puluh kejadian terakhir: tiap permintaan ke portal beserta lama dan
 * statusnya, tiap perintah ke jembatan, tiap galat yang tertangkap panel.
 *
 * Kenapa ini yang paling sering menolong: pesan yang sampai ke layar sudah
 * DITERJEMAHKAN supaya dapat dibaca petugas. "Server ALETA tidak terjangkau"
 * pernah berarti galat basis data karena satu bita kosong di dalam berkas RTF
 * - tidak ada hubungannya dengan jangkauan. Yang menerjemahkan itu benar
 * untuk petugas dan menyesatkan untuk yang memperbaiki; kotak hitam menyimpan
 * yang belum diterjemahkan.
 */
const ALAT_KOTAK_MAKS = 50;
const ALAT_KOTAK_KUNCI = "aleta-kotak-hitam";
const alatKotak = [];
let alatKotakNomor = 0;

function alatKotakMuat() {
  if (alatKotak.length > 0) return;
  try {
    const mentah = window.sessionStorage.getItem(ALAT_KOTAK_KUNCI);
    if (!mentah) return;
    const urai = JSON.parse(mentah);
    if (Array.isArray(urai)) {
      for (const x of urai.slice(-ALAT_KOTAK_MAKS)) alatKotak.push(x);
      alatKotakNomor = alatKotak.length;
    }
  } catch {
    /* sessionStorage ditutup atau isinya rusak - mulai dari kosong */
  }
}

function alatKotakSimpan() {
  try {
    window.sessionStorage.setItem(ALAT_KOTAK_KUNCI, JSON.stringify(alatKotak));
  } catch {
    /* penuh atau ditutup - catatan tetap hidup di memori halaman ini */
  }
}

/**
 * Satu kejadian dicatat.
 *
 * `rinci` sengaja dipotong: satu jawaban JSON bisa puluhan kilobita, dan
 * kotak hitam yang membuat halaman berat justru menambah cacat, bukan
 * menemukannya.
 */
function alatCatat(jenis, ringkas, rinci) {
  alatKotakMuat();
  alatKotakNomor += 1;
  const potong = (x) => {
    if (x === undefined || x === null) return "";
    const s = typeof x === "string" ? x : (() => { try { return JSON.stringify(x); } catch { return String(x); } })();
    return s.length > 400 ? `${s.slice(0, 400)}…` : s;
  };
  alatKotak.push({
    id: alatKotakNomor,
    waktu: new Date().toISOString(),
    jenis: String(jenis || "lain"),
    ringkas: String(ringkas || "").slice(0, 200),
    rinci: potong(rinci),
  });
  while (alatKotak.length > ALAT_KOTAK_MAKS) alatKotak.shift();
  alatKotakSimpan();
}

function alatKotakHitam() {
  alatKotakMuat();
  return alatKotak.slice();
}

function alatKotakKosongkan() {
  alatKotak.length = 0;
  alatKotakSimpan();
}

/* ─── 3. MODE KERING ────────────────────────────────────────────────────────
 *
 * Satu saklar: coba semuanya, jangan simpan apa pun.
 *
 * Batasnya dipilih dengan sengaja, dan bukan "tidak boleh menyentuh apa-apa":
 *
 *   MEDAN TETAP DIISI. Justru itu yang ingin dilihat - apakah tanggal,
 *   majelis, dan amar yang akan ditulis sudah benar. Mengisi medan tidak
 *   mengubah apa pun di basis data SIPP; SIPP baru menyimpan ketika tombol
 *   Simpan miliknya ditekan.
 *
 *   TOMBOL SIMPAN SIPP TIDAK PERNAH DITEKAN, dan tidak satu pun permintaan
 *   tulis ke portal ALETA dikirim. Dua itulah yang benar-benar mengubah data.
 *
 * Jadi mode kering menjawab "apa yang akan terjadi" dengan memperlihatkannya
 * di layar, bukan dengan menjanjikannya di teks.
 */
const ALAT_KERING_KUNCI = "modeKering";
let alatKeringNyalaKini = false;
/**
 * Sudahkah saklarnya disentuh DI HALAMAN INI?
 *
 * Tanpa penanda ini ada lomba yang berakibat buruk satu arah. alatMuatKering
 * dipanggil dua kali - saat berkas ini dimuat, dan saat panel dipasang - dan
 * keduanya membaca penyimpanan secara asinkron. Yang menyalakan mode kering
 * tepat sebelum salah satu bacaan itu kembali akan melihat saklarnya kembali
 * mati sendiri, TANPA pemberitahuan apa pun.
 *
 * Arah salahnya yang membuatnya berbahaya: orang mengira tulisan sedang
 * ditahan, padahal sudah tidak. Karena itu pilihan yang disetel di halaman
 * ini selalu menang atas bacaan yang masih di jalan.
 */
let alatKeringDisetel = false;

function alatKeringNyala() {
  return alatKeringNyalaKini === true;
}

async function alatMuatKering() {
  let terbaca = false;
  try {
    const simpan = await chrome.storage.local.get([ALAT_KERING_KUNCI]);
    terbaca = simpan[ALAT_KERING_KUNCI] === true;
  } catch {
    terbaca = false;
  }
  if (alatKeringDisetel) return alatKeringNyalaKini;
  alatKeringNyalaKini = terbaca;
  alatTandaiKering();
  return alatKeringNyalaKini;
}

/**
 * Saklarnya satu untuk seluruh peramban, jadi tab lain harus ikut seketika.
 *
 * Tanpa ini, mode kering yang dinyalakan di satu tab SIPP tidak berlaku di tab
 * SIPP sebelahnya sampai halamannya dimuat ulang - dan tab sebelah itulah yang
 * paling mungkin dipakai menekan sesuatu.
 */
function alatDengarkanKering() {
  try {
    chrome.storage.onChanged.addListener((ubah, tempat) => {
      if (tempat !== "local" || !ubah[ALAT_KERING_KUNCI]) return;
      alatKeringNyalaKini = ubah[ALAT_KERING_KUNCI].newValue === true;
      alatKeringDisetel = true;
      alatTandaiKering();
    });
  } catch {
    /* tanpa pendengarnya, mode kering tetap berlaku di tab tempat ia disetel */
  }
}

async function alatSetelKering(nyala) {
  alatKeringDisetel = true;
  alatKeringNyalaKini = nyala === true;
  alatTandaiKering();
  alatCatat("kering", alatKeringNyalaKini ? "mode kering DINYALAKAN" : "mode kering dimatikan", "");
  try {
    await chrome.storage.local.set({ [ALAT_KERING_KUNCI]: alatKeringNyalaKini });
  } catch {
    /* berlaku untuk halaman ini saja */
  }
  return alatKeringNyalaKini;
}

/** Penanda di akar: dari sinilah pita miring di tepi panel mengambil isyarat. */
function alatTandaiKering() {
  try {
    if (alatKeringNyalaKini) document.documentElement.setAttribute("data-aleta-kering", "ya");
    else document.documentElement.removeAttribute("data-aleta-kering");
  } catch {
    /* tanpa penandanya, mode kering tetap berlaku - hanya tidak terlihat */
  }
}

/* ─── 3b. UJI TAMPILAN: LAMA / BARU / UI BARU, SAKLAR FITUR, MODE COBA ─────
 *
 * Tahap 1 rencana "ekstensi dulu" (29 September 2026). Super Admin dapat
 * merasakan tiga tampilan bergantian, seketika, dari popup:
 *
 *   lama  kulit Klasik, semua fitur ide mati  - persis ekstensi sebelumnya
 *   baru  kulit Klasik, fitur ide yang saklarnya dinyalakan ikut tampil
 *   ui    kulit Modern, fitur ide yang saklarnya dinyalakan ikut tampil
 *
 * Pilihannya disimpan di chrome.storage.local PC ini saja selama masa coba;
 * "terapkan ke pegawai lain" menyusul lewat portal (tahap 5). Pengalihnya
 * hanya tampil untuk Super Admin di popup - sama dengan pemilih warna.
 *
 * SYARAT UTAMA: selama pilihannya "lama" (bawaan, dan yang berlaku bila
 * kuncinya tidak ada) TIDAK ADA satu pun yang berubah - tidak ada atribut di
 * halaman, tidak ada permintaan yang ditahan, tidak ada fitur yang tampil.
 *
 * MODE COBA menyertai "baru" dan "ui" dengan sendirinya. Selama Super Admin
 * mencoba, tindakan yang berdampak ke luar ditahan: kirim WhatsApp, tulis ke
 * SIPP, ABT, dan portal ALETA. Bedanya dengan mode kering:
 *
 *   mode kering  menahan TULISAN ke portal ALETA dan tombol Simpan SIPP
 *   mode coba    menahan SEMUA permintaan non-GET dari ekstensi - termasuk
 *                simpan ABT - kecuali daftar kecil yang sudah diperiksa
 *                hanya MEMBACA atau MENGHITUNG (ALETA_COBA_BOLEH di bawah)
 *
 * Arah kesalahannya dipilih sengaja: permintaan yang belum diperiksa ditahan.
 * Fitur yang tertahan terlihat gagal dengan pesan "mode coba"; tulisan yang
 * lolos tanpa sengaja tidak dapat ditarik kembali.
 *
 * Tindakan nyata dapat diizinkan lagi dengan satu kotak centang di popup
 * ("Izinkan tindakan nyata"), tanpa harus kembali ke tampilan Lama.
 */
const ALAT_UJI_KUNCI_TAMPILAN = "ujiTampilan";
const ALAT_UJI_KUNCI_FITUR = "ujiFitur";
const ALAT_UJI_KUNCI_NYATA = "ujiIzinkanNyata";
/**
 * Tampilan yang DITERAPKAN admin lewat portal (tahap 5, migrasi 0052):
 * GET /aleta/api/aleta-ecourt/ekstensi/tampilan, disinggahkan di sini supaya
 * halaman berikutnya langsung berpakaian benar dan tab lain ikut lewat
 * onChanged. Bentuk: { mode, fitur, diterapkan, versi, diambil }.
 */
const ALAT_UJI_KUNCI_SERVER = "tampilanServer";
const ALAT_TAMPILAN_API = "/aleta/api/aleta-ecourt/ekstensi/tampilan";
/** Satu pembacaan per lima menit cukup - SIPP memuat ulang halaman tiap klik. */
const ALAT_TAMPILAN_JEDA_MS = 5 * 60 * 1000;
const ALAT_UJI_MODE = ["lama", "baru", "ui"];
const alatUji = { mode: "lama", fitur: {}, izinkanNyata: false, server: null };

/**
 * Permintaan non-GET yang TETAP boleh selama mode coba - masing-masing sudah
 * diperiksa rutenya hanya membaca atau menghitung, tidak menyimpan apa pun:
 *
 *   abt/pdf               RTF -> PDF lewat bot, hasilnya dipulangkan saja
 *   abt/usulan            usulan isian blangko, dihitung dari SIPP
 *   putusan/praperiksa    temuan sebelum mengisi borang putusan
 *   sipp-konteks/massal   ringkasan beberapa perkara sekaligus
 *   main/cari (ABT)       pencarian daftar perkara ABT
 *   tanyajawab_perkara_edit TANPA aksi=simpan - pembacaan tanya-jawab ABT
 *
 * Posita SENGAJA tidak ada: salah satu jalannya merapikan posita di SIPP.
 * Menambah baris ke sini berarti sudah membaca rutenya sampai ke ujung.
 */
const ALETA_COBA_BOLEH = [
  /\/aleta\/api\/aleta-bot\/abt\/pdf(?:[?#]|$)/,
  /\/aleta\/api\/aleta-bot\/abt\/usulan(?:[?#]|$)/,
  /\/aleta\/api\/aleta-ecourt\/putusan\/praperiksa(?:[?#]|$)/,
  /\/aleta\/api\/aleta-bot\/sipp-konteks\/massal(?:[?#]|$)/,
  /\/aps_badilag\/.*\/main\/cari(?:[?#]|$)/,
  // Setelan PRIBADI (tahap 5): urutan pintasan, tanda checklist - tidak
  // mengirim apa pun ke luar dan tidak menyentuh SIPP, ABT, maupun WhatsApp.
  /\/aleta\/api\/aleta-ecourt\/ekstensi\/setelan(?:[?#]|$)/,
  // Menandai komentar hakim atas BAS "selesai" (tahap 6-7): catatan internal
  // antar-petugas, tidak menyentuh SIPP, ABT, maupun WhatsApp.
  /\/aleta\/api\/aleta-ecourt\/bas-komentar(?:[?#]|$)/,
  // Laporkan masalah (ide sipp-30, tahap 7): satu baris feedback_requests
  // plus audit portal - dibaca admin di menu Masukan Pengguna. Tidak mengirim
  // WhatsApp, tidak menyentuh SIPP maupun ABT. Justru selama mencoba tampilan
  // baru Super Admin paling perlu melaporkan yang janggal. Mode LATIHAN tetap
  // menahannya: di sana tidak satu pun catatan ALETA boleh lahir.
  /\/aleta\/api\/feedback(?:[?#]|$)/,
  // Konversi naskah (K1, perbaikan 30 Sep butir 8 dan 11): RTF/DOC/DOCX/PDF
  // diubah bentuknya lewat soffice di bot lalu DIPULANGKAN saja - tidak ada
  // yang disimpan di ALETA, SIPP, maupun ABT. Setara abt/pdf di atas. Yang
  // menulis (unggah-sipp) tetap ditahan; konversi hanya langkah hitungnya.
  /\/aleta\/api\/aleta-ecourt\/putusan\/konversi-naskah(?:[?#]|$)/,
  // Baca foto/teks KTP (perbaikan 2 Okt butir 16): hanya menghitung usulan medan
  // dan memulangkannya - foto tidak disimpan, tidak ada yang ditulis ke mana pun.
  // Pengisian ke blangko SIPP tetap oleh petugas, dan Simpan SIPP tetap ditahan.
  /\/aleta\/api\/aleta-ecourt\/saksi-scan(?:[?#]|$)/,
  // Rapikan identitas para pihak (perbaikan 5 Okt butir 26): alamat dikirim,
  // usulan rapinya DIPULANGKAN (rapikanAlamat) - tidak ada yang disimpan.
  // Menuliskannya ke SIPP tetap lewat blangko edit pihak, Simpan oleh petugas.
  /\/aleta\/api\/aleta-ecourt\/rapikan-alamat(?:[?#]|$)/,
];

function alatUjiBersihMode(x) {
  return ALAT_UJI_MODE.includes(x) ? x : "lama";
}

/**
 * Tampilan yang BERLAKU di tab ini:
 *
 *   1. Super Admin sedang mencoba di PC ini (ujiTampilan lokal bukan Lama):
 *      pilihannya sendiri menang, dan mode coba ikut berlaku.
 *   2. Selain itu, tampilan yang diterapkan admin lewat portal (diterapkan
 *      true dan bukan Lama): mode dan saklarnya dari server, TANPA mode coba -
 *      pegawai yang diberi tampilan baru harus tetap dapat bekerja.
 *   3. Selain itu Lama - persis ekstensi sebelumnya.
 */
function alatUjiBerlaku() {
  /* === UIBARU-WAJIB 12 Okt === */
  if (alatUjiWajibUi()) {
    const w = alatUji.server;
    return { mode: "ui", fitur: w && w.diterapkan === true && w.fitur ? w.fitur : {}, sumber: "wajib" };
  }
  /* === AKHIR UIBARU-WAJIB === */
  if (alatUji.mode !== "lama") return { mode: alatUji.mode, fitur: alatUji.fitur, sumber: "coba" };
  const s = alatUji.server;
  if (s && s.diterapkan === true && s.mode !== "lama") return { mode: s.mode, fitur: s.fitur || {}, sumber: "server" };
  return { mode: "lama", fitur: {}, sumber: "bawaan" };
}

/** "lama" | "baru" | "ui" - tampilan yang berlaku (lihat alatUjiBerlaku). */
function alatUjiMode() {
  return alatUjiBerlaku().mode;
}

/** "klasik" | "modern" - kulit yang dipakai panel. */
function alatKulit() {
  return alatUjiMode() === "ui" ? "modern" : "klasik";
}

/**
 * Apakah fitur ide `kode` (mis. "sipp-5") boleh tampil?
 * Dalam tampilan Lama selalu tidak, apa pun isi saklarnya.
 */
function alatFiturNyala(kode) {
  const b = alatUjiBerlaku();
  if (b.mode === "lama") return false;
  const k = String(kode || "");
  if (b.fitur[k] !== true) return false;
  // Profil peran (K4, perbaikan 30 Sep butir 25): pegawai yang bukan Super
  // Admin/Admin hanya melihat fitur ide yang ada di profil perannya. Profil
  // tanpa daftar fitur (null) tidak menyaring apa pun.
  const p = alatProfilPeran();
  if (p && p.fitur && p.fitur[k] !== true) return false;
  return true;
}

/** Mode coba aktif: tampilan bukan Lama dan tindakan nyata tidak diizinkan. */
function alatCobaAktif() {
  // UIBARU-WAJIB 12 Okt: pilihan uji lokal hanya milik Super Admin; akun lain
  // tidak pernah dikenai mode coba oleh sisa pilihan yang tertinggal di PC ini.
  if (alatUjiWajibUi()) return false;
  return alatUji.mode !== "lama" && alatUji.izinkanNyata !== true;
}

/* === UIBARU-WAJIB 12 Okt ===
 * Selain Super Admin, tampilan SELALU UI Baru (keputusan pengguna 12 Okt):
 * pilihan Lama/Baru tersimpan diabaikan dan pengalihnya disembunyikan di popup.
 * Peran dibaca dari profil yang disinggahkan GET /ekstensi/tampilan
 * (data.profil.peran = kunci peran: "super-admin", "admin", "hakim", ...).
 * Peran belum diketahui (belum masuk, portal lama) = aturan lama berlaku.
 * Satu fungsi penentu: konten.js/abt.js/checklist.js/aleta.js membaca mode lewat
 * alatUjiBerlaku/alatUjiMode (t7Aktif, s1Aktif, a30Aktif ...), jadi ikut seluruhnya. */
function alatUjiWajibUi() {
  const s = alatUji.server;
  const p = s && typeof s === "object" ? s.profil : null;
  const peran = p && typeof p === "object" ? String(p.peran || "") : "";
  return Boolean(peran) && peran !== "super-admin";
}
/* === AKHIR UIBARU-WAJIB === */

/**
 * Apakah permintaan ini harus ditahan mode coba?
 * `cara` sudah dalam huruf besar; GET dan HEAD tidak pernah ditahan.
 */
function alatCobaMenahan(alamat, cara) {
  if (!alatCobaAktif()) return false;
  const c = String(cara || "GET").toUpperCase();
  if (c === "GET" || c === "HEAD") return false;
  const a = String(alamat || "");
  if (ALETA_COBA_BOLEH.some((pola) => pola.test(a))) return false;
  // Tanya-jawab ABT: rute yang sama untuk membaca dan menyimpan; yang
  // menyimpan selalu membawa aksi=simpan (lihat alamatTanyaJawab di abt.js).
  if (/\/tanyajawab_perkara_edit\?/.test(a) && !/[?&]aksi=simpan(?:&|$)/.test(a)) return false;
  return true;
}

/** Jawaban tiruan untuk permintaan yang ditahan mode coba - 423, dengan sebabnya. */
function alatJawabanCoba(alamat, cara) {
  const badan = JSON.stringify({
    ok: false,
    alasan: "mode_coba",
    pesan: "Mode coba aktif - Super Admin sedang mencoba tampilan baru, jadi tidak ada yang dikirim atau disimpan.",
    yangDitahan: { cara: String(cara || "POST").toUpperCase(), alamat: String(alamat || "") },
  });
  return new Response(badan, {
    status: 423,
    statusText: "Mode coba",
    headers: { "content-type": "application/json" },
  });
}

/**
 * Penanda di <html>: kulit Modern dan pita mode coba mengambil isyarat dari
 * sini, di SIPP, ABT, dan portal sekaligus - termasuk widget checklist, yang
 * membacanya lewat :host-context. Dalam tampilan Lama keduanya DILEPAS,
 * sehingga halaman persis seperti sebelum fitur ini ada.
 */
function alatTandaiUji() {
  try {
    const akar = document.documentElement;
    if (alatKulit() === "modern") akar.setAttribute("data-aleta-kulit", "modern");
    else akar.removeAttribute("data-aleta-kulit");
    if (alatCobaAktif()) akar.setAttribute("data-aleta-coba", "ya");
    else akar.removeAttribute("data-aleta-coba");
  } catch {
    /* tanpa penanda, penahanan tetap berlaku - hanya tidak terlihat */
  }
  // Penjelasan teknis (K5) bergerbang tampilan: tiap kali tampilan berganti,
  // penandanya ikut dipasang atau dilepas.
  alatTandaiTeknis();
}

function alatUjiTerima(simpan) {
  const s = simpan || {};
  if (ALAT_UJI_KUNCI_TAMPILAN in s) alatUji.mode = alatUjiBersihMode(s[ALAT_UJI_KUNCI_TAMPILAN]);
  if (ALAT_UJI_KUNCI_FITUR in s) {
    const f = s[ALAT_UJI_KUNCI_FITUR];
    alatUji.fitur = f && typeof f === "object" && !Array.isArray(f) ? f : {};
  }
  if (ALAT_UJI_KUNCI_NYATA in s) alatUji.izinkanNyata = s[ALAT_UJI_KUNCI_NYATA] === true;
  if (ALAT_UJI_KUNCI_SERVER in s) alatUji.server = alatBersihTampilanServer(s[ALAT_UJI_KUNCI_SERVER]);
}

/** Singgahan tampilan server yang rusak atau asing diperlakukan sebagai tidak ada. */
function alatBersihTampilanServer(x) {
  if (!x || typeof x !== "object" || Array.isArray(x)) return null;
  const fitur = {};
  if (x.fitur && typeof x.fitur === "object" && !Array.isArray(x.fitur)) {
    for (const [k, v] of Object.entries(x.fitur)) if (v === true && /^[a-z]+-\d{1,2}$/.test(k)) fitur[k] = true;
  }
  const hasil = {
    mode: alatUjiBersihMode(x.mode),
    fitur,
    diterapkan: x.diterapkan === true,
    versi: String(x.versi || ""),
    diambil: Number(x.diambil) || 0,
    profil: alatBersihProfil(x.profil),
  };
  // Ruas ini hanya ada bila portal mengirim setelan pribadi - singgahan lama
  // dan portal lama tetap berbentuk persis seperti sebelumnya.
  const setelan = alatBersihSetelanSinggah(x.setelan);
  if (setelan) hasil.setelan = setelan;
  return hasil;
}

/*
 * SETELAN PRIBADI YANG IKUT DISINGGAHKAN (perbaikan 1 Okt butir 7)
 *
 * GET /ekstensi/tampilan sudah memulangkan setelan pribadi pemanggilnya
 * (aleta_ekstensi_setelan) di samping tampilannya. Kunci di daftar ini ikut
 * disimpan di singgahan tampilanServer - TANPA permintaan tambahan - supaya
 * widget checklist di PC mana pun memakai susunan milik AKUN yang masuk.
 *
 * Bentuk per kunci:
 *   tidak ada      tidak diketahui (portal lama, belum masuk, belum terbaca)
 *   null           portal menjawab: akun ini belum punya setelan itu
 *   {nilai, diubahPada}
 */
const ALAT_SETELAN_SINGGAH = ["widget.tata"];
/**
 * Perbaikan 2 Okt butir 4: kunci yang disinggahkan HANYA bila portal
 * mengirimnya (akun sudah pernah menyimpan) - tanpa itu bentuk singgahan
 * tetap persis seperti 1 Okt ({"widget.tata": ...} saja).
 */
const ALAT_SETELAN_SINGGAH_BILA_ADA = ["panel.bawaan"];

function alatBersihSetelanSinggah(x) {
  if (!x || typeof x !== "object" || Array.isArray(x)) return undefined;
  const hasil = {};
  let ada = false;
  for (const k of [...ALAT_SETELAN_SINGGAH, ...ALAT_SETELAN_SINGGAH_BILA_ADA]) {
    if (!(k in x)) continue;
    const v = x[k];
    if (v === null) {
      hasil[k] = null;
      ada = true;
    } else if (v && typeof v === "object" && "nilai" in v && typeof v.diubahPada === "string") {
      hasil[k] = { nilai: v.nilai, diubahPada: v.diubahPada };
      ada = true;
    }
  }
  return ada ? hasil : undefined;
}

/** Dari jawaban GET tampilan: setelan yang disinggahkan, atau undefined bila portal tidak mengirim setelan. */
function alatSetelanDariJawaban(data) {
  const s = data && data.setelan;
  if (!s || typeof s !== "object" || Array.isArray(s)) return undefined;
  const hasil = {};
  for (const k of ALAT_SETELAN_SINGGAH) {
    const baris = s[k];
    hasil[k] = baris && typeof baris === "object" && "nilai" in baris ? { nilai: baris.nilai, diubahPada: String(baris.diubahPada || "") } : null;
  }
  for (const k of ALAT_SETELAN_SINGGAH_BILA_ADA) {
    const baris = s[k];
    if (baris && typeof baris === "object" && "nilai" in baris) hasil[k] = { nilai: baris.nilai, diubahPada: String(baris.diubahPada || "") };
  }
  return hasil;
}

/** undefined (tidak diketahui) | null (akun ini belum punya) | {nilai, diubahPada}. */
function alatSetelanTersinggah(kunci) {
  const s = alatUji.server;
  if (!s || !s.setelan || typeof s.setelan !== "object" || !(kunci in s.setelan)) return undefined;
  return s.setelan[kunci];
}

/**
 * Sesudah PUT /ekstensi/setelan berhasil: singgahan diperbarui di tempat,
 * supaya tab lain (dan halaman berikutnya) tidak membaca nilai server yang
 * sudah basi sebelum pembacaan lima menitan berikutnya.
 */
async function alatCatatSetelanTersinggah(kunci, nilai, diubahPada) {
  if (!ALAT_SETELAN_SINGGAH.includes(kunci) && !ALAT_SETELAN_SINGGAH_BILA_ADA.includes(kunci)) return;
  const s = alatUji.server;
  if (!s) return;
  const baru = {
    ...s,
    setelan: {
      ...(s.setelan || {}),
      [kunci]: nilai === null ? null : { nilai, diubahPada: String(diubahPada || "") },
    },
  };
  alatUji.server = baru;
  try {
    await chrome.storage.local.set({ [ALAT_UJI_KUNCI_SERVER]: baru });
  } catch {
    /* berlaku untuk halaman ini saja */
  }
}

/**
 * Membaca tampilan yang diterapkan admin dari portal, paling sering sekali
 * per lima menit. 401/403 = belum masuk portal: tetap Lama (singgahan
 * dikosongkan). Jaringan gagal atau portal lama tanpa rutenya (404): singgahan
 * terakhir dipakai apa adanya - menebak lebih buruk daripada diam.
 */
async function alatSegarkanTampilanServer(paksa) {
  const lama = alatUji.server;
  // Layar publik portal (TV ruang tunggu, papan antrean, papan pintu): tidak
  // satu permintaan pun atas nama petugas, dan tidak ada yang disimpan - sama
  // dengan panel dan widget yang memang tidak lahir di sana.
  const jalur = typeof location !== "undefined" && location ? location.pathname : "";
  if (alatHalamanPublikPortal(jalur)) return lama;
  if (!paksa && lama && Date.now() - lama.diambil < ALAT_TAMPILAN_JEDA_MS) return lama;
  // Kegagalan pun dicatat waktunya. Tanpa itu portal yang belum mengenal rute
  // ini (404 - server belum dipasang) atau server yang tidak terjangkau akan
  // ditanya lagi pada TIAP klik SIPP, sebab SIPP memuat ulang halaman tiap klik.
  const tetap = () => (lama ? { ...lama, diambil: Date.now() } : { mode: "lama", fitur: {}, diterapkan: false, versi: "", diambil: Date.now() });
  let jawab;
  let baru;
  try {
    jawab = await fetch(ALAT_TAMPILAN_API, { credentials: "include", cache: "no-store" });
  } catch {
    jawab = null;
  }
  if (!jawab) {
    baru = tetap();
  } else if (jawab.status === 401 || jawab.status === 403) {
    baru = { mode: "lama", fitur: {}, diterapkan: false, versi: "", diambil: Date.now() };
  } else if (jawab.ok) {
    try {
      const isi = await jawab.json();
      const data = isi && isi.data ? isi.data : isi;
      const t = (data && data.tampilan) || {};
      baru = alatBersihTampilanServer({
        ...t,
        versi: data && data.versi,
        diambil: Date.now(),
        profil: data && data.profil,
        setelan: alatSetelanDariJawaban(data),
      });
    } catch {
      baru = tetap();
    }
  } else {
    baru = tetap();
  }
  alatUji.server = baru;
  try {
    await chrome.storage.local.set({ [ALAT_UJI_KUNCI_SERVER]: baru });
  } catch {
    /* berlaku untuk halaman ini saja */
  }
  const profilBerubah = JSON.stringify((lama && lama.profil) || null) !== JSON.stringify(baru.profil || null);
  if (!lama || lama.versi !== baru.versi || lama.mode !== baru.mode || lama.diterapkan !== baru.diterapkan || profilBerubah) {
    alatTandaiUji();
    alatKabarkanUji();
  }
  await alatTerapkanProfilSaklar();
  return baru;
}

async function alatMuatUji() {
  try {
    const simpan = await chrome.storage.local.get([
      ALAT_UJI_KUNCI_TAMPILAN,
      ALAT_UJI_KUNCI_FITUR,
      ALAT_UJI_KUNCI_NYATA,
      ALAT_UJI_KUNCI_SERVER,
    ]);
    alatUjiTerima(simpan);
  } catch {
    /* penyimpanan tidak terbaca: tetap "lama" - tidak ada yang berubah */
  }
  alatTandaiUji();
  // Profil peran dari singgahan (butir 25). Tanpa profil, atau dalam Lama,
  // tidak ada yang ditulis - lihat alatTerapkanProfilSaklar.
  await alatTerapkanProfilSaklar();
  // Widget checklist (Shadow DOM) mungkin sudah tergambar sebelum bacaan ini
  // kembali. Dalam tampilan Lama tidak ada yang perlu dikabarkan.
  if (alatUjiMode() !== "lama") alatKabarkanUji();
  return alatUjiMode();
}

/**
 * × di kepala panel (perbaikan desain popup/widget nomor 12, tahap 2).
 *
 * Selama ini × MEMATIKAN saklar induk - pilihan yang sengaja, sebab × yang
 * dahulu hanya membuang panel meninggalkan orang tanpa jalan pulang sampai
 * halamannya dimuat ulang. Dalam UI Baru × hanya MENUTUP: panel menciut ke
 * lencana, yang selalu dapat dibentangkan lagi, dan ALETA tetap aktif.
 * "Matikan ALETA" tetap ada di popup (saklar induk). Lama dan Baru tidak berubah.
 */
const ALAT_JUDUL_TUTUP_BARU = "Tutup panel (menjadi lencana) - ALETA tetap aktif. Matikan ALETA dari popup ikon ALETA.";

function alatTutupHanyaMenciut() {
  return alatKulit() === "modern";
}

/* ─── 3b-bis. BAGIAN BERSAMA PERBAIKAN 30 SEPTEMBER 2026 ─────────────────────
 *
 * Empat hal yang dipakai lebih dari satu panel, dan karena itu hidup di sini,
 * bukan disalin ke konten.js, abt.js, aleta.js, dan checklist.js:
 *
 *   butir 18  klik 2x kepala panel = layar penuh; klik 2x lagi = ukuran
 *             bawaan (alatPasangKlikGandaKepala)
 *   butir 24  pita "Pembaruan tersedia" di atas panel dan widget; satu klik
 *             meminta pembaruan lalu memuat ulang ekstensi
 *             (alatPasangPitaPembaruan, alatJalankanPembaruan)
 *   butir 25  profil saklar mengikuti peran login (kontrak K4) - saklar dan
 *             fitur ide pegawai yang bukan Super Admin/Admin
 *             (alatProfilPeran, alatTerapkanProfilSaklar)
 *   butir 6   penjelasan panjang dilipat di balik ⓘ (alatLipatPenjelasan)
 *
 * Semuanya hanya hidup dalam tampilan Baru dan UI Baru. Dalam Lama tidak ada
 * atribut, elemen, pendengar yang bertindak, maupun permintaan tambahan:
 * gerbangnya ditanyakan SAAT bertindak (alatUjiMode), sehingga pengalih di
 * popup berlaku seketika tanpa memuat ulang halaman.
 */

// ── Butir 18: klik ganda kepala = layar penuh ────────────────────────────────

const alatKlikGandaTerpasang = new WeakSet();
/**
 * Yang klik gandanya BUKAN milik kepala: kendali, dan elemen yang punya klik
 * ganda sendiri - nomor perkara di kepala SIPP (.aleta-nomor-tukar) menukar
 * nomor perkara dengan nomor register pada klik ganda. Elemen lain yang kelak
 * memakai klik ganda cukup diberi atribut data-aleta-klik-ganda.
 */
const ALAT_KLIK_GANDA_BUKAN =
  "button, a, input, select, textarea, label, summary, [contenteditable='true'], [role='button'], .aleta-warna-pilih, .aleta-nomor-tukar, [data-aleta-klik-ganda]";

/**
 * Klik 2x pada kepala panel: layar penuh; klik 2x lagi: kembali ke ukuran
 * sebelumnya. Yang dikerjakan SAMA PERSIS dengan tombol ⛶ panel itu - tombol
 * aslinya yang ditekan, sehingga panel SIPP (yang menyimpan dan memulihkan
 * letaknya sendiri di konten.js) dan panel ABT/portal (panel-alat.js) tidak
 * punya dua jalan untuk satu keadaan.
 *
 * Klik ganda pada tombol, tautan, isian, atau pemilih warna di kepala TIDAK
 * memicunya: di sana klik ganda adalah dua tekanan tombol, bukan permintaan
 * melebarkan panel. Panel yang sedang menjadi lencana juga tidak: klik
 * gandanya milik alatPasangLencana (membentangkan).
 *
 * `kepala` boleh dikosongkan - yang dipakai lalu .aleta-kepala pertama di
 * dalam panel. `kunci` diterima supaya pemanggilnya seragam dengan fungsi
 * panel lain; ukuran tersimpan tidak disentuh (tombol ⛶ pun tidak).
 */
function alatPasangKlikGandaKepala(panel, kunci, kepala) {
  if (!panel || typeof panel.addEventListener !== "function" || alatKlikGandaTerpasang.has(panel)) return;
  alatKlikGandaTerpasang.add(panel);
  // Fase TANGKAP pada panel: berjalan sebelum pendengar lencana (fase
  // gelembung) sempat membentangkan panelnya - kalau tidak, klik ganda yang
  // membentangkan lencana langsung melebarkannya juga.
  panel.addEventListener(
    "dblclick",
    (peristiwa) => {
      if (alatUjiMode() === "lama") return;
      if (panel.classList.contains(KELAS_LENCANA)) return;
      const k = kepala && panel.contains(kepala) ? kepala : panel.querySelector(".aleta-kepala");
      if (!k) return;
      // alatPasangGeser menangkap penunjuk pada PANEL, dan tangkapan itu
      // membelokkan dblclick ke panel. Yang sesungguhnya diketuk dicari dari
      // titik ketukannya.
      let sasaran = peristiwa.target;
      if (sasaran === panel && typeof document.elementFromPoint === "function" && Number.isFinite(peristiwa.clientX)) {
        const di = document.elementFromPoint(peristiwa.clientX, peristiwa.clientY);
        if (di) sasaran = di;
      }
      if (!sasaran || !k.contains(sasaran)) return;
      if (
        typeof sasaran.closest === "function" &&
        sasaran.closest(ALAT_KLIK_GANDA_BUKAN)
      ) {
        return;
      }
      alatAlihLayarPenuh(panel, k);
      try {
        const pilihan = window.getSelection ? window.getSelection() : null;
        if (pilihan) pilihan.removeAllRanges();
      } catch {
        /* kata yang terpilih oleh klik ganda hanya kosmetik */
      }
    },
    true
  );
}

/** Menekan tombol ⛶ panel ini; tanpa tombol, kelasnya sendiri yang dibalik. */
function alatAlihLayarPenuh(panel, kepala) {
  const tombol = (kepala && kepala.querySelector(".aleta-penuh")) || panel.querySelector(".aleta-penuh");
  if (tombol && typeof tombol.click === "function") {
    tombol.click();
    return;
  }
  const sedang = panel.classList.toggle("aleta-panel-penuh");
  if (!sedang) alatJepitTinggi(panel);
}

// ── Butir 25: profil saklar mengikuti peran login (K4) ───────────────────────

/** Saklar yang boleh diatur profil peran. Saklar induk "aktif" SENGAJA tidak. */
const ALAT_PROFIL_SAKLAR = [
  "tandaiHalaman",
  "sisipJadwal",
  "cetakTigaBerkas",
  "checklistMilestone",
  "suntingLangsungAbt",
  // Perbaikan 30 Sep sore butir 3 (K5): profil peran BOLEH menetapkan keadaan
  // awal saklar penjelasan teknis. Portal belum mengirimnya (profil-saklar.ts
  // belum mengenal kuncinya) - sampai itu, bawaannya nyala.
  "sembunyikanTeknis",
];
/** Tanda profil yang terakhir diterapkan di PC ini: "<peran>|<saklar JSON>". */
const ALAT_PROFIL_KUNCI_DITERAPKAN = "profilSaklarDiterapkan";

/**
 * data.profil dari GET /ekstensi/tampilan (K4), diperiksa lagi di sini.
 * Kunci saklar di luar ALAT_PROFIL_SAKLAR dan kode fitur yang tidak berbentuk
 * "<tempat>-<angka>" dibuang; nilai selain boolean dibuang.
 */
function alatBersihProfil(x) {
  if (!x || typeof x !== "object" || Array.isArray(x)) return null;
  let saklar = null;
  if (x.saklar && typeof x.saklar === "object" && !Array.isArray(x.saklar)) {
    saklar = {};
    for (const k of ALAT_PROFIL_SAKLAR) if (typeof x.saklar[k] === "boolean") saklar[k] = x.saklar[k];
  }
  let fitur = null;
  if (x.fitur && typeof x.fitur === "object" && !Array.isArray(x.fitur)) {
    fitur = {};
    for (const [k, v] of Object.entries(x.fitur)) if (v === true && /^[a-z]+-\d{1,2}$/.test(k)) fitur[k] = true;
  }
  return {
    peran: String(x.peran || "").slice(0, 40),
    saklar,
    fitur,
    sumber: x.sumber === "admin" ? "admin" : "bawaan",
    bolehUbahProfil: x.bolehUbahProfil === true,
  };
}

/**
 * Profil peran yang BERLAKU di tab ini, atau null:
 *   - tampilan Lama: null (Lama tetap persis seperti sebelumnya);
 *   - server tidak memberi profil (404, portal lama, belum masuk): null;
 *   - Super Admin dan Admin (bolehUbahProfil): null - mereka tetap mengatur
 *     saklarnya sendiri dan tetap melihat "Profil saklar" di popup.
 */
function alatProfilPeran() {
  if (alatUjiBerlaku().mode === "lama") return null;
  const s = alatUji.server;
  const p = s && s.profil;
  if (!p || p.bolehUbahProfil === true) return null;
  return p;
}

/**
 * Menyetel saklar ekstensi menurut profil peran - HANYA ketika profilnya
 * berubah (peran lain yang masuk, atau admin mengubah isi profil), bukan pada
 * tiap pemuatan halaman.
 *
 * Sebabnya: × pada widget checklist mematikan saklarnya, dan petugas boleh
 * mematikan satu saklar untuk sementara. Profil yang ditulis ulang tiap lima
 * menit akan menyalakannya kembali tanpa diminta - saklar yang melawan
 * pemiliknya. Jadi profil menetapkan keadaan AWAL peran itu; perubahan
 * pribadi sesudahnya bertahan sampai profilnya sendiri berubah.
 *
 * Dipulangkan true bila ada yang ditulis.
 */
async function alatTerapkanProfilSaklar() {
  const p = alatProfilPeran();
  if (!p || !p.saklar || !Object.keys(p.saklar).length) return false;
  const tanda = `${p.peran}|${JSON.stringify(p.saklar)}`;
  try {
    const s = await chrome.storage.local.get([ALAT_PROFIL_KUNCI_DITERAPKAN, ...Object.keys(p.saklar)]);
    if (s[ALAT_PROFIL_KUNCI_DITERAPKAN] === tanda) return false;
    const tulis = { [ALAT_PROFIL_KUNCI_DITERAPKAN]: tanda };
    for (const [k, v] of Object.entries(p.saklar)) if (s[k] !== v) tulis[k] = v;
    await chrome.storage.local.set(tulis);
    const diubah = Object.keys(tulis).filter((k) => k !== ALAT_PROFIL_KUNCI_DITERAPKAN);
    alatCatat("profil", `saklar mengikuti profil ${p.peran || "peran"}`, diubah.join(", ") || "sudah sama");
    return true;
  } catch {
    return false;
  }
}

// ── Butir 24: pita "Pembaruan tersedia" ──────────────────────────────────────

/** Singgahan versi yang disajikan portal: { portal, diambil }. */
const ALAT_PITA_KUNCI = "pitaPembaruan";
/** SIPP memuat ulang halaman tiap klik; satu bacaan per sepuluh menit cukup. */
const ALAT_PITA_JEDA_MS = 10 * 60 * 1000;
const alatPitaPanel = new Set();
let alatPitaJanji = null;
let alatPitaPendengar = false;

/** Membandingkan "1.174.1" dengan "1.175.0": positif bila a lebih baru. */
function alatBandingVersi(a, b) {
  const pecah = (x) => String(x || "").split(".").map((n) => Number(n) || 0);
  const kiri = pecah(a);
  const kanan = pecah(b);
  for (let i = 0; i < Math.max(kiri.length, kanan.length); i += 1) {
    const selisih = (kiri[i] || 0) - (kanan[i] || 0);
    if (selisih !== 0) return selisih;
  }
  return 0;
}

/**
 * { portal, terpasang } bila portal menyajikan versi yang LEBIH BARU daripada
 * yang terpasang; null selainnya - termasuk portal mati, belum masuk, dan
 * versi pengembangan yang justru lebih maju. Satu GET per sepuluh menit per
 * PC (singgahan pitaPembaruan), dan tidak sama sekali dalam Lama atau di
 * layar publik portal.
 *
 * `opsi.tanpaAmbil`: hanya membaca singgahan, berapa pun umurnya - tidak
 * pernah bertanya ke portal. Dipakai widget checklist, yang dijanjikan tidak
 * menambah permintaan (uji widget tahap 3); bacaannya diisi panel ALETA yang
 * hidup di halaman yang sama.
 */
function alatPembaruanTersedia(paksa, opsi) {
  if (opsi && opsi.tanpaAmbil === true) return alatHitungPembaruan(false, true);
  if (!paksa && alatPitaJanji) return alatPitaJanji;
  alatPitaJanji = alatHitungPembaruan(paksa, false);
  return alatPitaJanji;
}

async function alatHitungPembaruan(paksa, tanpaAmbil) {
  if (alatUjiMode() === "lama") return null;
  const jalur = typeof location !== "undefined" && location ? location.pathname : "";
  if (alatHalamanPublikPortal(jalur)) return null;
  let terpasang = "";
  try {
    terpasang = String(chrome.runtime.getManifest().version || "");
  } catch {
    return null;
  }
  if (!terpasang) return null;
  let portal = "";
  let segar = false;
  try {
    const s = await chrome.storage.local.get([ALAT_PITA_KUNCI]);
    const x = s && s[ALAT_PITA_KUNCI];
    const umur = x && typeof x === "object" ? Date.now() - Number(x.diambil || 0) : Infinity;
    if (x && typeof x === "object" && (tanpaAmbil || (!paksa && umur >= 0 && umur < ALAT_PITA_JEDA_MS))) {
      portal = String(x.portal || "");
      segar = true;
    }
  } catch {
    /* tanpa singgahan: ditanyakan */
  }
  if (!segar && !tanpaAmbil) {
    try {
      const jawab = await fetch(ALAT_EKSTENSI_INFO, { credentials: "include", cache: "no-store" });
      if (jawab.ok) {
        const luar = await jawab.json();
        const data = luar && luar.data ? luar.data : luar;
        portal = String((data && data.versi) || "");
      }
    } catch {
      portal = "";
    }
    try {
      // Kegagalan pun disinggahkan: portal yang mati tidak ditanya lagi
      // pada tiap klik SIPP.
      await chrome.storage.local.set({ [ALAT_PITA_KUNCI]: { portal, diambil: Date.now() } });
    } catch {
      /* berlaku untuk halaman ini saja */
    }
  }
  if (!/^\d+(\.\d+){1,3}$/.test(portal)) return null;
  return alatBandingVersi(portal, terpasang) > 0 ? { portal, terpasang } : null;
}

/**
 * ============================================================================
 * ANTREAN KERJA MASSAL DILAPORKAN KE LATAR - PENAHAN TOMBOL PERBARUI (9 Okt 2026)
 * ============================================================================
 *
 * Penetapan massal, putusan massal (SIPP dan ABT), BAS massal, dan putaran
 * massal lain berjalan di skrip konten TAB, bukan di latar.js. Memuat ulang
 * ekstensi di tengahnya memutus butir yang sedang dikerjakan. Karena itu tiap
 * antrean melapor: denyut saat mulai dan tiap kali maju, "selesai" saat
 * berhenti dengan cara apa pun. latar.js menyimpannya di
 * chrome.storage.session dan MENAHAN "Perbarui ekstensi" selama ada yang
 * hidup - "Tunggu antrean <nama> selesai (x/y)", dengan "Tetap perbarui"
 * (paksa) tetap tersedia.
 *
 * Denyut HANYA saat antrean benar-benar maju - bukan pengatur waktu. Antrean
 * yang macet (satu butir menggantung) atau ditinggal berhenti berdenyut, dan
 * sesudah 10 menit latar.js tidak menahan lagi. Antrean yang hidup di memori
 * tab dilepas saat halamannya ditinggal (pagehide); antrean bertahan antar
 * halaman (putusan massal SIPP) memakai `id` tetap dan `lepasSaatPergi: false`.
 *
 * Gagal mengirim pesan TIDAK PERNAH menghentikan antreannya - yang hilang
 * hanya penahan tombol Perbarui.
 */
function alatKirimKeLatar(pesan) {
  try {
    if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.sendMessage) return;
    const janji = chrome.runtime.sendMessage(pesan);
    if (janji && typeof janji.catch === "function") janji.catch(() => undefined);
  } catch {
    /* konteks ekstensi mati - antreannya tetap berjalan */
  }
}

/**
 * alatAntreanKerja(antrean, nama, total, opsi?) -> { id, maju(x, y?), selesai() }
 *   antrean  kunci jenis: "penetapan-massal" | "putusan-massal-sipp" |
 *            "putusan-massal-abt" | "bas-massal" | "unggah-naskah-massal" ...
 *   nama     sebutan manusia untuk kalimat "Tunggu antrean <nama> selesai"
 *   opsi.id  id tetap (antrean yang bertahan antar halaman)
 *   opsi.lepasSaatPergi  bawaan true - lepas saat halaman ditinggal
 */
function alatAntreanKerja(antrean, nama, total, opsi) {
  const o = opsi && typeof opsi === "object" ? opsi : {};
  const id = o.id
    ? String(o.id)
    : `${String(antrean || "antrean")}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  let selesai = Math.max(0, Number(o.selesai) || 0);
  let jumlah = Math.max(0, Number(total) || 0);
  let hidup = true;
  const lepasSaatPergi = o.lepasSaatPergi !== false;
  const denyut = () => {
    if (!hidup) return;
    alatKirimKeLatar({ sumber: "aleta-panel", jenis: "antrean-kerja-denyut", id, antrean: String(antrean || ""), nama: String(nama || ""), selesai, total: jumlah });
  };
  const akhiri = () => {
    if (!hidup) return;
    hidup = false;
    try {
      if (lepasSaatPergi) window.removeEventListener("pagehide", akhiri);
    } catch {
      /* tanpa window */
    }
    alatKirimKeLatar({ sumber: "aleta-panel", jenis: "antrean-kerja-selesai", id });
  };
  try {
    if (lepasSaatPergi) window.addEventListener("pagehide", akhiri);
  } catch {
    /* tanpa window - antrean lepas sendiri sesudah basi */
  }
  denyut();
  return {
    id,
    maju(x, y) {
      selesai = Math.max(0, Number(x) || 0);
      if (y !== undefined && y !== null) jumlah = Math.max(0, Number(y) || 0);
      denyut();
    },
    selesai: akhiri,
  };
}

/**
 * Antrean putusan massal SIPP BERTAHAN antar halaman (chrome.storage.local):
 * satu butir per halaman perkara. Ia dilaporkan dengan id tetap tiap kali
 * panelnya digambar atau satu butir selesai, dan dilepas begitu tidak ada lagi
 * yang menunggu atau sedang dikerjakan. Petugas yang meninggalkannya lebih
 * dari 10 menit tidak lagi menahan tombol Perbarui (basi di latar.js).
 */
function alatLaporAntreanPutusanSipp(antrean) {
  if (!antrean || !Array.isArray(antrean.butir)) return;
  const id = `putusan-massal-sipp:${antrean.id || "aktif"}`;
  const h = alatAntreanRingkas(antrean);
  const sisa = (h.menunggu || 0) + (h.jalan || 0);
  if (antrean.tahap !== "sipp" || sisa === 0) {
    alatAntreanKerjaLepas(id);
    return;
  }
  const total = antrean.butir.length;
  alatAntreanKerja("putusan-massal-sipp", "putusan massal SIPP", total, { id, lepasSaatPergi: false, selesai: total - sisa });
}

/** Melepas antrean ber-id tetap tanpa pegangannya (mis. "Akhiri antrean" di halaman lain). */
function alatAntreanKerjaLepas(id) {
  if (!id) return;
  alatKirimKeLatar({ sumber: "aleta-panel", jenis: "antrean-kerja-selesai", id: String(id) });
}

/**
 * Jawaban latar.js yang MENAHAN pembaruan: putaran relaas (keadaan lama)
 * atau antrean kerja massal di tab SIPP/ABT ("antrean-berjalan", 9 Okt
 * 2026). Keduanya membawa ditahan: true dari latar.js yang baru.
 */
function alatPembaruanDitahan(jawab) {
  if (!jawab) return false;
  return jawab.ditahan === true || jawab.keadaan === "putaran-relaas-berjalan" || jawab.keadaan === "antrean-berjalan";
}

/**
 * Minta pembaruan ke latar.js, lalu muat ulang ekstensi - satu klik.
 *
 *   1. "perbarui": Chrome memeriksa updates.xml; CRX yang lebih baru
 *      diunduh, dipasang, dan ekstensi dimuat ulang oleh latar.js.
 *   2. Bila Chrome tidak memasang apa pun (Load unpacked, "no_update",
 *      "ditahan"): "muat-ulang" - membaca ulang berkas dari foldernya.
 *   3. Halaman dimuat ulang sesudahnya, sebab skrip konten TIDAK disuntikkan
 *      ulang ke halaman yang sudah terbuka.
 *
 * Putaran cetak relaas yang belum selesai membuat latar.js MENAHAN pemuatan
 * ulang; kalimatnya disampaikan dan tekanan KEDUA (paksa) baru memaksa -
 * aturan yang sama dengan tombol di popup dan panel portal.
 *
 * `kabar(teks, buruk)` menampilkan keadaan. Dipulangkan { selesai, perluPaksa }.
 */
async function alatJalankanPembaruan(paksa, kabar) {
  const sampaikan = typeof kabar === "function" ? kabar : () => {};
  const kirim = async (jenis) => {
    try {
      const pesan = paksa ? { sumber: "aleta-panel", jenis, paksa: true } : { sumber: "aleta-panel", jenis };
      return await chrome.runtime.sendMessage(pesan);
    } catch {
      // Konteks mati sebelum jawaban sampai: ekstensinya memang sedang
      // dimuat ulang - pertanda perintahnya berjalan.
      return { ok: true, keadaan: "konteks_mati", pesan: "Ekstensi sedang dimuat ulang." };
    }
  };
  sampaikan("Menanyakan pembaruan kepada Chrome…", false);
  let jawab = await kirim("perbarui");
  if (alatPembaruanDitahan(jawab)) {
    sampaikan(`${jawab.pesan || "Antrean massal belum selesai."} Klik sekali lagi untuk tetap memperbarui.`, true);
    return { selesai: false, perluPaksa: true, labelPaksa: jawab.labelPaksa || "" };
  }
  const terpasang = jawab && jawab.ok && (jawab.keadaan === "dipasang" || jawab.keadaan === "konteks_mati");
  if (!terpasang) {
    sampaikan("Memuat ulang ekstensi dari berkasnya…", false);
    jawab = await kirim("muat-ulang");
    if (alatPembaruanDitahan(jawab)) {
      sampaikan(`${jawab.pesan || "Antrean massal belum selesai."} Klik sekali lagi untuk tetap memuat ulang.`, true);
      return { selesai: false, perluPaksa: true, labelPaksa: jawab.labelPaksa || "" };
    }
  }
  sampaikan(`${(jawab && jawab.pesan) || "Ekstensi sedang dimuat ulang."} Halaman ini dimuat ulang sebentar lagi.`, false);
  setTimeout(() => {
    try {
      location.reload();
    } catch {
      /* halaman sudah berpindah */
    }
  }, 1500);
  return { selesai: true, perluPaksa: false };
}

/** Isi pita: judul versi + keterangan singkat. Dipakai panel dan widget. */
function alatTeksPita(info) {
  return {
    judul: `Pembaruan tersedia ${info.portal}`,
    ket: `terpasang ${info.terpasang} · klik untuk memperbarui dan memuat ulang ekstensi`,
  };
}

/** Membuat tombol pita untuk satu panel (elemen biasa, bukan Shadow DOM). */
function alatBuatPita(info) {
  const t = alatTeksPita(info);
  const pita = document.createElement("button");
  pita.type = "button";
  pita.className = "aleta-pita-pembaruan";
  pita.setAttribute("role", "status");
  pita.title = `Versi ${info.portal} tersedia di server; yang terpasang ${info.terpasang}. Klik: minta pembaruan ke Chrome, lalu muat ulang ekstensi dan halaman ini.`;
  const judul = document.createElement("b");
  judul.textContent = t.judul;
  const ket = document.createElement("span");
  ket.className = "aleta-pita-pembaruan-ket";
  ket.textContent = t.ket;
  pita.appendChild(judul);
  pita.appendChild(ket);
  let paksa = false;
  pita.addEventListener("click", async (peristiwa) => {
    peristiwa.preventDefault();
    peristiwa.stopPropagation();
    if (pita.disabled) return;
    pita.disabled = true;
    const hasil = await alatJalankanPembaruan(paksa, (teks, buruk) => {
      ket.textContent = teks;
      pita.classList.toggle("aleta-pita-pembaruan-buruk", Boolean(buruk));
    });
    paksa = hasil.perluPaksa === true;
    if (!hasil.selesai) pita.disabled = false;
  });
  return pita;
}

// ── 1.184.0 (5 Okt 2026, butir 18): pembaruan OTOMATIS ───────────────────────

/**
 * Sampai 1.183.0 pembaruan menunggu petugas menekan pita "Pembaruan tersedia".
 * Kini, begitu portal menyajikan versi yang lebih baru, ekstensi memperbarui
 * DAN memuat ulang dirinya sendiri - jalan yang sama dengan pita
 * (alatJalankanPembaruan -> latar.js requestUpdateCheck/reload), lalu tulisan
 * kecil "diperbarui ke x.y.z" tampil di atas widget.
 *
 * Tiga pagar, supaya tidak ada pekerjaan yang hilang dan tidak ada putaran:
 *   1. hanya pada halaman yang BARU dimuat (<= 20 detik) dan tanpa isian /
 *      jendela sembul yang sedang terbuka - petugas belum mengetik apa pun;
 *   2. sekali per versi (pembaruanOtomatis.versi): pemasangan "Load unpacked"
 *      yang foldernya belum disalin tetap di versi lama sesudah dimuat ulang,
 *      dan tanpa pagar ini halaman akan memuat ulang tanpa henti - pita
 *      manual tetap ada untuk keadaan itu;
 *   3. penahan putaran cetak relaas di latar.js tetap berlaku (tidak dipaksa).
 */
const ALAT_OTOMATIS_KUNCI = "pembaruanOtomatis";
const ALAT_OTOMATIS_SEGAR_MS = 20000;
const ALAT_CATATAN_PERBARUI_ID = "aleta-catatan-perbarui";
let alatOtomatisJalan = false;
let alatSesudahPerbaruiDicek = false;

/** Ada isian atau jendela sembul yang sedang dikerjakan petugas? */
function alatAdaKerjaTerbuka() {
  try {
    const aktif = document.activeElement;
    if (aktif && aktif !== document.body && /^(INPUT|TEXTAREA|SELECT)$/.test(aktif.tagName)) return true;
    if (aktif && aktif.isContentEditable) return true;
    for (const el of Array.from(document.querySelectorAll(".popup, .mfp-wrap, .modal.in, .modal.show, [role=dialog]"))) {
      if (el.offsetParent !== null || (el.getClientRects && el.getClientRects().length > 0)) return true;
    }
  } catch {
    /* anggap tidak ada */
  }
  return false;
}

/** Tulisan kecil di atas widget checklist (atau kiri bawah bila widget tidak ada). */
function alatTampilkanCatatanPerbarui(teks, buruk, lamaMs) {
  try {
    let el = document.getElementById(ALAT_CATATAN_PERBARUI_ID);
    if (!el) {
      el = document.createElement("div");
      el.id = ALAT_CATATAN_PERBARUI_ID;
      el.className = "aleta-catatan-perbarui";
      el.setAttribute("role", "status");
      (document.body || document.documentElement).appendChild(el);
    }
    el.textContent = String(teks || "");
    el.classList.toggle("aleta-catatan-perbarui-buruk", Boolean(buruk));
    const widget = document.getElementById("aleta-cm-akar");
    const r = widget && widget.getBoundingClientRect ? widget.getBoundingClientRect() : null;
    if (r && r.height > 0) {
      el.style.left = `${Math.max(8, Math.round(r.left))}px`;
      el.style.bottom = `${Math.max(8, Math.round(window.innerHeight - r.top + 6))}px`;
    } else {
      el.style.left = "16px";
      el.style.bottom = "16px";
    }
    clearTimeout(el.aletaTutup);
    if (lamaMs > 0) el.aletaTutup = setTimeout(() => el.remove(), lamaMs);
    return el;
  } catch {
    return null;
  }
}

/** Sesudah ekstensi dimuat ulang: sebut versi barunya sekali. */
async function alatCekSesudahPerbarui() {
  if (alatSesudahPerbaruiDicek) return;
  alatSesudahPerbaruiDicek = true;
  try {
    const s = await chrome.storage.local.get([ALAT_OTOMATIS_KUNCI]);
    const c = s && s[ALAT_OTOMATIS_KUNCI];
    if (!c || !c.versi || c.diberitahu) return;
    const terpasang = String(chrome.runtime.getManifest().version || "");
    if (alatBandingVersi(terpasang, c.versi) < 0) return;
    alatTampilkanCatatanPerbarui(`ALETA diperbarui ke ${terpasang}`, false, 8000);
    await chrome.storage.local.set({ [ALAT_OTOMATIS_KUNCI]: { ...c, diberitahu: true } });
  } catch {
    /* tanpa catatan - versinya tetap terbaca di kaki panel */
  }
}

/** Memperbarui sendiri bila pagar di atas mengizinkan. Pulang true bila dijalankan. */
async function alatPembaruanOtomatis(info) {
  if (!info || !info.portal || alatOtomatisJalan) return false;
  try {
    if (typeof performance !== "undefined" && performance.now() > ALAT_OTOMATIS_SEGAR_MS) return false;
  } catch {
    /* tanpa jam halaman - lanjut */
  }
  if (alatAdaKerjaTerbuka()) return false;
  try {
    const s = await chrome.storage.local.get([ALAT_OTOMATIS_KUNCI]);
    const c = s && s[ALAT_OTOMATIS_KUNCI];
    if (c && c.versi === info.portal) return false;
    alatOtomatisJalan = true;
    await chrome.storage.local.set({
      [ALAT_OTOMATIS_KUNCI]: { versi: info.portal, dari: info.terpasang, pada: new Date().toISOString(), diberitahu: false },
    });
  } catch {
    alatOtomatisJalan = false;
    return false;
  }
  alatTampilkanCatatanPerbarui(`Memperbarui ALETA ke ${info.portal}…`, false, 0);
  const hasil = await alatJalankanPembaruan(false, (teks, buruk) => {
    if (buruk) alatTampilkanCatatanPerbarui(teks, true, 12000);
  });
  if (!hasil || !hasil.selesai) {
    alatOtomatisJalan = false;
    return false;
  }
  return true;
}

/** Menggambar atau mencabut pita di tiap panel yang terdaftar. */
async function alatSegarkanPita() {
  const tampil = alatUjiMode() !== "lama";
  const info = tampil ? await alatPembaruanTersedia(false) : null;
  // 1.184.0 (butir 18): pembaruan otomatis; pita tetap ada sebagai jalan manual.
  if (info) void alatPembaruanOtomatis(info);
  for (const panel of Array.from(alatPitaPanel)) {
    if (!panel.isConnected && panel.aletaPitaPernah) {
      alatPitaPanel.delete(panel);
      continue;
    }
    const ada = panel.querySelector(":scope > .aleta-pita-pembaruan");
    if (!info || alatUjiMode() === "lama") {
      if (ada) ada.remove();
      continue;
    }
    if (panel.isConnected) panel.aletaPitaPernah = true;
    if (!ada) panel.insertBefore(alatBuatPita(info), panel.firstChild);
  }
}

/**
 * Mendaftarkan panel untuk pita pembaruan (butir 24). Dipanggil
 * alatPasangJalanKeluar - pintu yang dilewati panel SIPP, ABT, dan portal -
 * jadi tidak ada panel yang perlu mengingat memanggilnya.
 */
function alatPasangPitaPembaruan(panel) {
  if (!panel || typeof panel.querySelector !== "function") return;
  alatPitaPanel.add(panel);
  if (!alatPitaPendengar) {
    alatPitaPendengar = true;
    try {
      document.addEventListener("aleta-uji-berubah", () => {
        alatPitaJanji = null;
        void alatSegarkanPita();
      });
    } catch {
      /* pita mengikuti tampilan saat halaman dimuat ulang */
    }
  }
  // Dalam Lama tidak ada permintaan dan tidak ada elemen.
  if (alatUjiMode() === "lama") return;
  void alatCekSesudahPerbarui();
  void alatSegarkanPita();
}

// ── Butir 6: penjelasan panjang dilipat di balik ⓘ ───────────────────────────

/** Keterangan yang lebih panjang dari ini dilipat (sama dengan T6_INFO_BATAS abt.js). */
const ALAT_INFO_BATAS = 90;

/** Kalimat pertama, dipotong bila terlalu panjang - ringkasan di samping ⓘ. */
function alatRingkasPenjelasan(teks) {
  const bersih = String(teks || "").replace(/\s+/g, " ").trim();
  const titik = bersih.search(/[.!?](\s|$)/);
  const kalimat = titik > 0 ? bersih.slice(0, titik + 1) : bersih;
  return kalimat.length <= 72 ? kalimat : `${kalimat.slice(0, 64).replace(/\s+\S*$/, "")}…`;
}

/**
 * Melipat penjelasan panjang di dalam `akar` di balik tombol ⓘ yang dapat
 * dibuka-tutup (butir 6 dan 26: "tidak ramai, tanpa menghilangkan fitur").
 *
 * Yang dilipat HANYA elemen yang cocok `pemilih`, lebih panjang dari
 * `batas` huruf, dan tidak memuat tombol, tautan, maupun isian - penjelasan
 * murni. Yang berisi kendali tidak pernah dilipat, supaya tidak ada fitur
 * yang tersembunyi di balik ⓘ. Isinya tidak diubah: elemen aslinya yang
 * disembunyikan, dan ⓘ menampilkannya kembali di tempat yang sama.
 *
 * Dalam Lama tidak berbuat apa pun. Aman dipanggil berulang: yang sudah
 * dilipat dilewati. Dipulangkan jumlah yang baru dilipat.
 */
function alatLipatPenjelasan(akar, pemilih, batas) {
  if (!akar || typeof akar.querySelectorAll !== "function" || alatUjiMode() === "lama") return 0;
  const ambang = Number(batas) > 0 ? Number(batas) : ALAT_INFO_BATAS;
  let jumlah = 0;
  for (const el of Array.from(akar.querySelectorAll(pemilih))) {
    if (el.hidden || el.hasAttribute("data-aleta-dilipat")) continue;
    if (el.parentElement && el.parentElement.closest("[data-aleta-dilipat]")) continue;
    if (el.querySelector("button, a[href], input, select, textarea")) continue;
    const teks = String(el.textContent || "").replace(/\s+/g, " ").trim();
    if (teks.length <= ambang || !el.parentNode) continue;

    const tombol = document.createElement("button");
    tombol.type = "button";
    // Penjelasan teknis (K5) yang dilipat: ⓘ-nya ikut teknis, supaya saklar
    // "Sembunyikan penjelasan teknis" tidak meninggalkan ⓘ tanpa isi.
    tombol.className = el.classList && el.classList.contains("aleta-teknis") ? "aleta-info-lipat aleta-teknis" : "aleta-info-lipat";
    tombol.setAttribute("aria-expanded", "false");
    tombol.title = "Tampilkan penjelasan lengkap";
    const ikon = document.createElement("span");
    ikon.className = "aleta-info-lipat-ikon";
    ikon.textContent = "ⓘ";
    ikon.setAttribute("aria-hidden", "true");
    const ringkas = document.createElement("span");
    ringkas.className = "aleta-info-lipat-ringkas";
    ringkas.textContent = alatRingkasPenjelasan(teks);
    tombol.appendChild(ikon);
    tombol.appendChild(ringkas);

    el.setAttribute("data-aleta-dilipat", "ya");
    el.hidden = true;
    tombol.addEventListener("click", (peristiwa) => {
      // Tombol di dalam <label> atau <summary>: tanpa ini klik membalik
      // saklarnya atau menutup lacinya juga.
      peristiwa.preventDefault();
      peristiwa.stopPropagation();
      const buka = el.hidden;
      el.hidden = !buka;
      ringkas.hidden = buka;
      tombol.setAttribute("aria-expanded", buka ? "true" : "false");
      tombol.title = buka ? "Sembunyikan penjelasan" : "Tampilkan penjelasan lengkap";
    });
    el.parentNode.insertBefore(tombol, el);
    jumlah += 1;
  }
  return jumlah;
}

/* ─── 3b-lipat. LIPAT SERAGAM (K2, perbaikan 1 Okt butir 1) ───────────────────
 *
 * Pengguna 1 Okt: "semua bagian/kelompok di panel SIPP, panel ABT, panel
 * massal, Juru Sita, BAS massal, widget memakai SATU bentuk lipat yang sama
 * (kepala, panah, jarak, ingat buka/tutup)". Sebelumnya ada lima bentuk:
 * bagian() konten.js (tombol + ▾/▸ teks), kelompok t6/t7, <details> jurusita
 * dan basmassal, kelompok checklist, dan judul statis panel portal.
 *
 *   alatLipat(judul, {kunci, terbuka, ringkas, lencana, saatUbah, ingat, tag, kelas})
 *     -> { akar, kepala, isi, buka(nilai?), terbuka(), setelLencana(teks, nada),
 *          setelRingkas(teks), setelJudul(teks) }
 *     Bagian BARU. akar = <section class="aleta-lipatan" data-kunci
 *     data-terbuka="ya|tidak">, kepala = <button class="aleta-lipat-kepala"
 *     aria-expanded aria-controls>, isi = <div class="aleta-lipat-isi"
 *     role="region" aria-labelledby> (hidden saat tertutup).
 *
 *   alatJadikanLipat(elemen, {kunci, terbuka, kepala})
 *     Bagian LAMA diberi rupa yang sama TANPA mengubah perilakunya:
 *       <details>                -> summary jadi kepala; buka/tutup tetap milik
 *                                   peramban (diingat bila ada kunci)
 *       kepala tombol ber-aria-expanded (bagian() konten.js, kelompok(),
 *       kelompok checklist)      -> hanya kelas; klik tetap milik pemiliknya,
 *                                   ingatannya tetap ingatan lamanya
 *       kepala statis (judul div, kartu t7, bagian portal)
 *                                -> MENJADI dapat dilipat: kepala bertombol
 *                                   (role=button, Enter/Spasi), isi
 *                                   disembunyikan lewat CSS (anak yang
 *                                   ditambahkan belakangan ikut tersembunyi)
 *     Aman dipanggil berulang (yang sudah dipasang dilewati).
 *
 * KELAS AKAR BUKAN "aleta-lipat": nama itu sudah lama dipakai tombol "–"
 * (ciutkan panel) di kepala panel - panel.css memberinya lebar 22 piksel dan
 * banyak tempat mencarinya dengan panel.querySelector(".aleta-lipat").
 * Akar bagian memakai "aleta-lipatan"; kepala dan isi tetap sesuai kontrak.
 *
 * Ingatan buka/tutup: chrome.storage.local "lipatTerbuka" = {kunci: boolean},
 * paling banyak ALAT_LIPAT_MAKS kunci (yang tertua dibuang). Dibaca sekali per
 * halaman; bagian yang lahir sebelum bacaan kembali menyesuaikan diri sesudah
 * bacaan itu, kecuali sudah disentuh orang di halaman ini.
 *
 * Rupa (panel.css blok W1) hanya dalam UI Baru: html[data-aleta-kulit="modern"].
 * Perilaku (buka/tutup) berlaku di mana pun fungsi ini dipanggil - dan yang
 * memanggilnya hanya jalan UI Baru (K1).
 */
const ALAT_LIPAT_KUNCI = "lipatTerbuka";
const ALAT_LIPAT_MAKS = 400;
/** { kunci: boolean } atau null sebelum terbaca. */
let alatLipatIngatan = null;
let alatLipatJanji = null;
let alatLipatNomor = 0;
let alatLipatDengar = false;
const ALAT_LIPAT_AWALAN = `aleta-lipat-${Math.random().toString(36).slice(2, 8)}`;

function alatLipatBersih(x) {
  const hasil = {};
  if (!x || typeof x !== "object" || Array.isArray(x)) return hasil;
  for (const [k, v] of Object.entries(x)) {
    if (typeof v === "boolean" && k && k.length <= 160) hasil[k] = v;
  }
  return hasil;
}

/** Membaca ingatan buka/tutup sekali per halaman (janji yang sama untuk semua). */
function alatMuatLipat() {
  if (alatLipatJanji) return alatLipatJanji;
  alatLipatJanji = (async () => {
    let terbaca = {};
    try {
      const s = await chrome.storage.local.get([ALAT_LIPAT_KUNCI]);
      terbaca = alatLipatBersih(s && s[ALAT_LIPAT_KUNCI]);
    } catch {
      terbaca = {};
    }
    // Yang sudah diubah di halaman ini selama bacaan berjalan menang.
    alatLipatIngatan = { ...terbaca, ...(alatLipatIngatan || {}) };
    if (!alatLipatDengar) {
      alatLipatDengar = true;
      try {
        chrome.storage.onChanged.addListener((ubah, tempat) => {
          if (tempat !== "local" || !ubah || !ubah[ALAT_LIPAT_KUNCI]) return;
          alatLipatIngatan = alatLipatBersih(ubah[ALAT_LIPAT_KUNCI].newValue);
        });
      } catch {
        /* tab lain berlaku sesudah halaman dimuat ulang */
      }
    }
    return alatLipatIngatan;
  })();
  return alatLipatJanji;
}

/** Ingatan satu kunci: true/false, atau undefined bila belum pernah disimpan/terbaca. */
function alatLipatDiingat(kunci) {
  if (!kunci || !alatLipatIngatan) return undefined;
  const v = alatLipatIngatan[kunci];
  return typeof v === "boolean" ? v : undefined;
}

function alatSimpanLipat(kunci, terbuka) {
  if (!kunci) return;
  const peta = { ...(alatLipatIngatan || {}) };
  delete peta[kunci];
  peta[kunci] = Boolean(terbuka);
  const kunciSemua = Object.keys(peta);
  for (let i = 0; i < kunciSemua.length - ALAT_LIPAT_MAKS; i += 1) delete peta[kunciSemua[i]];
  alatLipatIngatan = peta;
  // Bacaan belum selesai: tulisannya menunggu, supaya ingatan kunci lain tidak tertimpa.
  void Promise.resolve(alatLipatJanji || alatMuatLipat())
    .then(() => {
      const gabung = { ...(alatLipatIngatan || {}) };
      return chrome.storage.local.set({ [ALAT_LIPAT_KUNCI]: gabung });
    })
    .catch(() => {
      /* berlaku untuk halaman ini saja */
    });
}

function alatLipatPanah() {
  const panah = document.createElement("span");
  panah.className = "aleta-lipat-panah";
  panah.setAttribute("aria-hidden", "true");
  return panah;
}

function alatLipatKabar(akar, kunci, terbuka, olehOrang, saatUbah) {
  if (typeof saatUbah === "function") {
    try {
      saatUbah(terbuka, olehOrang);
    } catch {
      /* galat pemanggil tidak menghentikan lipatan */
    }
  }
  try {
    akar.dispatchEvent(new CustomEvent("aleta-lipat-berubah", { bubbles: true, detail: { kunci, terbuka, olehOrang } }));
  } catch {
    /* tanpa peristiwa, buka/tutup tetap berlaku */
  }
}

/** Lencana kepala: teks pendek + nada ("lewat" | "mendesak" | "aman" | "netral"). */
function alatLipatIsiLencana(tempat, lencana, nada) {
  const teks = lencana && typeof lencana === "object" ? lencana.teks : lencana;
  const n = lencana && typeof lencana === "object" ? lencana.nada : nada;
  tempat.textContent = teks === undefined || teks === null ? "" : String(teks);
  tempat.hidden = !tempat.textContent;
  if (n) tempat.setAttribute("data-nada", String(n));
  else tempat.removeAttribute("data-nada");
}

/**
 * Bagian lipat BARU - lihat catatan di atas. `judul` boleh teks atau simpul.
 * opsi.terbuka: bawaan bila belum pernah diingat (bawaan: terbuka).
 * opsi.ringkas: teks pendek di kepala (mis. "3 perlu dicek"); true = rupa rapat.
 * opsi.ingat: false = jangan ingat buka/tutup walau berkunci.
 */
function alatLipat(judul, opsi) {
  const o = opsi && typeof opsi === "object" ? opsi : {};
  const kunci = String(o.kunci || "").trim();
  const ingat = Boolean(kunci) && o.ingat !== false;
  alatLipatNomor += 1;
  const idKepala = `${ALAT_LIPAT_AWALAN}-k${alatLipatNomor}`;
  const idIsi = `${ALAT_LIPAT_AWALAN}-i${alatLipatNomor}`;

  const akar = document.createElement(o.tag === "div" ? "div" : "section");
  akar.className = `aleta-lipatan${o.kelas ? ` ${o.kelas}` : ""}`;
  if (kunci) akar.setAttribute("data-kunci", kunci);
  if (o.ringkas === true) akar.setAttribute("data-rapat", "ya");

  const kepala = document.createElement("button");
  kepala.type = "button";
  kepala.className = "aleta-lipat-kepala";
  kepala.id = idKepala;
  kepala.setAttribute("aria-controls", idIsi);
  kepala.appendChild(alatLipatPanah());
  const teksJudul = document.createElement("span");
  teksJudul.className = "aleta-lipat-judul";
  if (judul && typeof judul === "object" && judul.nodeType) teksJudul.appendChild(judul);
  else teksJudul.textContent = String(judul === undefined || judul === null ? "" : judul);
  kepala.appendChild(teksJudul);
  const ringkas = document.createElement("span");
  ringkas.className = "aleta-lipat-ringkas";
  ringkas.textContent = typeof o.ringkas === "string" ? o.ringkas : "";
  ringkas.hidden = !ringkas.textContent;
  kepala.appendChild(ringkas);
  const lencana = document.createElement("span");
  lencana.className = "aleta-lipat-lencana";
  alatLipatIsiLencana(lencana, o.lencana);
  kepala.appendChild(lencana);
  // Butir 7 (2 Okt): tag peran di KIRI judul (sesudah panah) - lihat alatLipatTagPeran.
  const tagPeran = alatLipatTagPeran(kepala, o.peran);

  const isi = document.createElement("div");
  isi.className = "aleta-lipat-isi";
  isi.id = idIsi;
  isi.setAttribute("role", "region");
  isi.setAttribute("aria-labelledby", idKepala);
  akar.appendChild(kepala);
  akar.appendChild(isi);

  let terbukaKini = true;
  let disentuh = false;
  const terapkan = (nilai) => {
    terbukaKini = Boolean(nilai);
    kepala.setAttribute("aria-expanded", terbukaKini ? "true" : "false");
    akar.setAttribute("data-terbuka", terbukaKini ? "ya" : "tidak");
    isi.hidden = !terbukaKini;
  };
  const diingat = ingat ? alatLipatDiingat(kunci) : undefined;
  terapkan(diingat !== undefined ? diingat : o.terbuka !== false);
  if (ingat && !alatLipatIngatan) {
    void alatMuatLipat().then(() => {
      const v = alatLipatDiingat(kunci);
      if (disentuh || v === undefined || v === terbukaKini) return;
      terapkan(v);
      alatLipatKabar(akar, kunci, terbukaKini, false, o.saatUbah);
    });
  }

  const buka = (nilai) => {
    const sasaran = nilai === undefined ? !terbukaKini : Boolean(nilai);
    disentuh = true;
    if (sasaran === terbukaKini) return terbukaKini;
    terapkan(sasaran);
    if (ingat) alatSimpanLipat(kunci, terbukaKini);
    alatLipatKabar(akar, kunci, terbukaKini, true, o.saatUbah);
    return terbukaKini;
  };
  kepala.addEventListener("click", (e) => {
    // Kendali yang disisipkan pemanggil di kepala (tautan, isian) bukan lipatan.
    const t = e.target;
    if (t && t !== kepala && typeof t.closest === "function" && t.closest("a[href], input, select, textarea, [data-lipat-abaikan]")) return;
    buka();
  });

  const pegangan = {
    akar,
    kepala,
    isi,
    buka,
    terbuka: () => terbukaKini,
    setelLencana: (teks, nada) => alatLipatIsiLencana(lencana, teks, nada),
    setelRingkas: (teks) => {
      ringkas.textContent = teks ? String(teks) : "";
      ringkas.hidden = !ringkas.textContent;
    },
    setelJudul: (teks) => {
      teksJudul.textContent = String(teks === undefined || teks === null ? "" : teks);
    },
    setelPeran: (peran) => alatLipatIsiPeran(tagPeran, peran),
  };
  akar.__aletaLipat = pegangan;
  return pegangan;
}

/* ─── 3b-lipat-peran. TAG PERAN DI KEPALA LIPATAN (K2, perbaikan 2 Okt butir 7)
 *
 * Pengguna 2 Okt: "tulisan ROLE di samping accordion tiap bagian (mis. kiri
 * 'Susun keterangan saksi' ada tulisan 'Panitera')". Opsi `peran` di alatLipat
 * dan alatJadikanLipat: teks, daftar teks, atau kode golongan
 * (admin/ketua/hakim/panitera/jurusita/pp/lain) - kode diganti sebutannya.
 * Elemennya <span class="aleta-lipat-peran"> di KIRI judul - tepat sesudah
 * panah ("kiri 'Susun keterangan saksi' ada tulisan 'Panitera'"); tanpa
 * peran = elemennya hidden, jadi kepala yang tidak memakainya tampak persis
 * seperti sebelumnya. Klik pada tag tetap melipat (tag bukan kendali).
 * Pegangan alatLipat punya setelPeran(peran); alatJadikanLipat memanggil
 * alatLipatTagPeran pada kepala yang ditemukannya (ketiga asal).
 */
const ALAT_LIPAT_SEBUTAN_PERAN = {
  admin: "Admin",
  "super admin": "Super Admin",
  ketua: "Ketua",
  hakim: "Hakim",
  panitera: "Panitera",
  "panitera sidang": "Panitera Sidang",
  pp: "PP",
  jurusita: "Juru Sita",
  "juru sita": "Juru Sita",
  lain: "Petugas",
};

/** Teks tag peran dari opsi `peran` (string | string[] | null) - "" bila kosong. */
function alatLipatTeksPeran(peran) {
  const daftar = (Array.isArray(peran) ? peran : [peran])
    .map((p) => String(p === undefined || p === null ? "" : p).trim())
    .filter(Boolean)
    .map((p) => ALAT_LIPAT_SEBUTAN_PERAN[p.toLowerCase().replace(/[-_]+/g, " ")] || p);
  const unik = [];
  for (const p of daftar) if (!unik.includes(p)) unik.push(p);
  return unik.join(" · ").slice(0, 80);
}

function alatLipatIsiPeran(tag, peran) {
  if (!tag) return;
  const teks = alatLipatTeksPeran(peran);
  tag.textContent = teks;
  tag.hidden = !teks;
  if (teks) tag.title = `Bagian ini untuk: ${teks}`;
  else tag.removeAttribute("title");
}

/**
 * Pasang (sekali) tag peran di `kepala`: tepat sesudah panah lipat (kiri
 * judul), atau di awal kepala bila tanpa panah. Kepala yang sudah bertag
 * hanya diperbarui teksnya.
 */
function alatLipatTagPeran(kepala, peran) {
  if (!kepala) return null;
  let tag = kepala.querySelector(":scope > .aleta-lipat-peran");
  if (!tag) {
    tag = document.createElement("span");
    tag.className = "aleta-lipat-peran";
    tag.hidden = true;
    const panah = kepala.querySelector(":scope > .aleta-lipat-panah");
    kepala.insertBefore(tag, panah ? panah.nextSibling : kepala.firstChild);
  }
  alatLipatIsiPeran(tag, peran);
  return tag;
}

/**
 * Butir 19 (2 Okt) - konvensi bawaan buka/tutup: jangan semua terbuka.
 * alatLipatBawaanTerbuka(urutanKunci, kunciUtama?) -> (kunci) => boolean:
 * hanya kunciUtama (atau kunci PERTAMA urutan bila kunciUtama kosong/tidak
 * ada di urutan) yang terbuka; sisanya tertutup. Ingatan orang tetap menang
 * (alatLipat hanya memakai `terbuka` bila kunci belum pernah diingat).
 */
function alatLipatBawaanTerbuka(urutanKunci, kunciUtama) {
  const urutan = (Array.isArray(urutanKunci) ? urutanKunci : []).map((k) => String(k || "")).filter(Boolean);
  const utama = kunciUtama && urutan.includes(String(kunciUtama)) ? String(kunciUtama) : urutan[0] || "";
  return (kunci) => Boolean(utama) && String(kunci || "") === utama;
}

/** Anak langsung `akar` yang memuat (atau adalah) `el`. */
function alatAnakLangsung(akar, el) {
  let x = el;
  while (x && x.parentElement !== akar) x = x.parentElement;
  return x && x.parentElement === akar ? x : null;
}

/**
 * Bagian LAMA diberi rupa lipat yang sama - lihat catatan di atas.
 * Pulang pegangan { akar, kepala, isi, buka(nilai?), terbuka(), asal } atau
 * null bila elemennya tidak dapat dijadikan lipatan (tanpa kepala).
 */
function alatJadikanLipat(el, opsi) {
  if (!el || el.nodeType !== 1) return null;
  const o = opsi && typeof opsi === "object" ? opsi : {};
  if (el.__aletaLipat) {
    // Dipanggil ulang dengan peran: tag diperbarui, sisanya tetap.
    if (o.peran !== undefined && el.__aletaLipat.kepala) alatLipatTagPeran(el.__aletaLipat.kepala, o.peran);
    return el.__aletaLipat;
  }
  const kunci = String(o.kunci || "").trim();
  const anak = Array.from(el.children || []);

  // 1. <details>: buka/tutup tetap milik peramban.
  if (String(el.tagName).toUpperCase() === "DETAILS") {
    const ringkasan = anak.find((c) => String(c.tagName).toUpperCase() === "SUMMARY") || null;
    el.classList.add("aleta-lipatan");
    el.setAttribute("data-lipat-asal", "details");
    if (kunci) el.setAttribute("data-kunci", kunci);
    if (ringkasan) {
      ringkasan.classList.add("aleta-lipat-kepala");
      if (!ringkasan.querySelector(":scope > .aleta-lipat-panah")) ringkasan.insertBefore(alatLipatPanah(), ringkasan.firstChild);
      if (o.peran !== undefined) alatLipatTagPeran(ringkasan, o.peran);
    }
    const tandai = () => el.setAttribute("data-terbuka", el.open ? "ya" : "tidak");
    let disentuh = false;
    if (kunci) {
      const v = alatLipatDiingat(kunci);
      if (v !== undefined) el.open = v;
      else if (!alatLipatIngatan) {
        void alatMuatLipat().then(() => {
          const w = alatLipatDiingat(kunci);
          if (!disentuh && w !== undefined && w !== el.open) el.open = w;
        });
      }
    }
    tandai();
    // Peristiwa toggle juga lahir dari pemulihan di atas (asinkron) - yang
    // disimpan hanya yang berbeda dari ingatan, jadi pemulihan tidak menulis.
    el.addEventListener("toggle", () => {
      tandai();
      if (!kunci) return;
      if (alatLipatDiingat(kunci) === el.open) return;
      disentuh = true;
      alatSimpanLipat(kunci, el.open);
    });
    const pegangan = {
      akar: el,
      kepala: ringkasan,
      isi: null,
      asal: "details",
      buka: (nilai) => {
        el.open = nilai === undefined ? !el.open : Boolean(nilai);
        tandai();
        return el.open;
      },
      terbuka: () => Boolean(el.open),
      setelPeran: (p) => (ringkasan ? alatLipatTagPeran(ringkasan, p) : null),
    };
    el.__aletaLipat = pegangan;
    return pegangan;
  }

  // 2. Kepala tombol yang SUDAH melipat (aria-expanded): hanya rupa.
  const tombolLama = anak.find(
    (c) => String(c.tagName).toUpperCase() === "BUTTON" && c.hasAttribute("aria-expanded")
  );
  if (tombolLama) {
    el.classList.add("aleta-lipatan");
    el.setAttribute("data-lipat-asal", "tombol");
    tombolLama.classList.add("aleta-lipat-kepala");
    const panahLama = tombolLama.querySelector(".aleta-bagian-panah, .aleta-cm-panah, .aleta-lipat-panah");
    if (panahLama) panahLama.classList.add("aleta-lipat-panah");
    else tombolLama.insertBefore(alatLipatPanah(), tombolLama.firstChild);
    if (o.peran !== undefined) alatLipatTagPeran(tombolLama, o.peran);
    const isiLama = anak.find((c) => c !== tombolLama && /(^|\s)[\w-]*-isi(\s|$)/.test(String(c.className || ""))) || null;
    if (isiLama) isiLama.classList.add("aleta-lipat-isi");
    const tandai = () =>
      el.setAttribute("data-terbuka", tombolLama.getAttribute("aria-expanded") === "false" ? "tidak" : "ya");
    tandai();
    try {
      new MutationObserver(tandai).observe(tombolLama, { attributes: true, attributeFilter: ["aria-expanded"] });
    } catch {
      /* tanpa pengamat, data-terbuka tertinggal - panah tetap ikut aria-expanded */
    }
    const pegangan = {
      akar: el,
      kepala: tombolLama,
      isi: isiLama,
      asal: "tombol",
      buka: (nilai) => {
        const kini = tombolLama.getAttribute("aria-expanded") !== "false";
        const sasaran = nilai === undefined ? !kini : Boolean(nilai);
        if (sasaran !== kini) tombolLama.click();
        return tombolLama.getAttribute("aria-expanded") !== "false";
      },
      terbuka: () => tombolLama.getAttribute("aria-expanded") !== "false",
      setelPeran: (p) => alatLipatTagPeran(tombolLama, p),
    };
    el.__aletaLipat = pegangan;
    return pegangan;
  }

  // 3. Kepala statis: dijadikan dapat dilipat.
  let kepala = o.kepala && o.kepala.nodeType === 1 ? alatAnakLangsung(el, o.kepala) : null;
  if (!kepala) {
    kepala =
      anak.find((c) =>
        typeof c.matches === "function" &&
        c.matches(
          "header, h1, h2, h3, h4, h5, h6, .aleta-bagian-judul, .aleta-t7-kartu-judul, .aleta-t6-bagian-kepala, [class*='-judul'], [class*='-kepala']"
        )
      ) || null;
  }
  if (!kepala) return null;
  el.classList.add("aleta-lipatan");
  el.setAttribute("data-lipat-asal", "kartu");
  if (kunci) el.setAttribute("data-kunci", kunci);
  kepala.classList.add("aleta-lipat-kepala");
  if (String(kepala.tagName).toUpperCase() !== "BUTTON") {
    kepala.setAttribute("role", "button");
    if (!kepala.hasAttribute("tabindex")) kepala.setAttribute("tabindex", "0");
  }
  if (!kepala.querySelector(":scope > .aleta-lipat-panah")) kepala.insertBefore(alatLipatPanah(), kepala.firstChild);
  if (o.peran !== undefined) alatLipatTagPeran(kepala, o.peran);

  let terbukaKini = true;
  let disentuh = false;
  const terapkan = (nilai) => {
    terbukaKini = Boolean(nilai);
    kepala.setAttribute("aria-expanded", terbukaKini ? "true" : "false");
    el.setAttribute("data-terbuka", terbukaKini ? "ya" : "tidak");
  };
  const diingat = kunci ? alatLipatDiingat(kunci) : undefined;
  terapkan(diingat !== undefined ? diingat : o.terbuka !== false);
  if (kunci && !alatLipatIngatan) {
    void alatMuatLipat().then(() => {
      const v = alatLipatDiingat(kunci);
      if (!disentuh && v !== undefined && v !== terbukaKini) terapkan(v);
    });
  }
  const buka = (nilai) => {
    const sasaran = nilai === undefined ? !terbukaKini : Boolean(nilai);
    disentuh = true;
    if (sasaran === terbukaKini) return terbukaKini;
    terapkan(sasaran);
    if (kunci) alatSimpanLipat(kunci, terbukaKini);
    alatLipatKabar(el, kunci, terbukaKini, true, o.saatUbah);
    return terbukaKini;
  };
  // Kendali milik kepala (tombol salin, ⓘ, pilihan) tetap bekerja sendiri.
  const kendaliLain = (t) =>
    t && t !== kepala && typeof t.closest === "function" && t.closest("button, a[href], input, select, textarea, summary, label, [data-lipat-abaikan]");
  kepala.addEventListener("click", (e) => {
    const k = kendaliLain(e.target);
    if (k && kepala.contains(k)) return;
    buka();
  });
  kepala.addEventListener("keydown", (e) => {
    if (e.target !== kepala || String(kepala.tagName).toUpperCase() === "BUTTON") return;
    if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
      e.preventDefault();
      buka();
    }
  });
  const pegangan = {
    akar: el,
    kepala,
    isi: null,
    asal: "kartu",
    buka,
    terbuka: () => terbukaKini,
    setelPeran: (p) => alatLipatTagPeran(kepala, p),
  };
  el.__aletaLipat = pegangan;
  return pegangan;
}

/* ─── 3c. SENYAP 1 JAM (ide popup-12) ────────────────────────────────────────
 *
 * Satu tombol di popup menyembunyikan panel, penanda halaman, dan widget
 * selama satu jam, lalu semuanya muncul kembali SENDIRI - tanpa harus ingat
 * menyalakannya lagi. Yang disimpan hanya saat berakhirnya (senyapSampai,
 * milidetik); tab lain ikut lewat chrome.storage.onChanged.
 *
 * Hanya menyembunyikan tampilan: tidak ada yang dimatikan, antrean yang
 * sedang berjalan tetap berjalan. Berlaku hanya bila saklar fitur popup-12
 * menyala (tampilan Baru / UI Baru) - dalam Lama tidak pernah.
 */
const ALAT_KUNCI_SENYAP = "senyapSampai";
let alatSenyapSampai = 0;
let alatSenyapPewaktu = 0;

function alatSenyapAktif() {
  return alatFiturNyala("popup-12") && alatSenyapSampai > Date.now();
}

function alatTandaiSenyap() {
  try {
    const akar = document.documentElement;
    if (alatSenyapAktif()) akar.setAttribute("data-aleta-senyap", "ya");
    else akar.removeAttribute("data-aleta-senyap");
  } catch {
    /* tanpa penanda, tampilan tidak disembunyikan */
  }
  if (alatSenyapPewaktu) clearTimeout(alatSenyapPewaktu);
  alatSenyapPewaktu = 0;
  const sisa = alatSenyapSampai - Date.now();
  // Dibangunkan tepat saat berakhir, supaya panel muncul lagi tanpa muat ulang.
  if (alatSenyapAktif() && sisa > 0) alatSenyapPewaktu = setTimeout(alatTandaiSenyap, Math.min(sisa + 50, 2147483000));
}

async function alatMuatSenyap() {
  try {
    const simpan = await chrome.storage.local.get([ALAT_KUNCI_SENYAP]);
    alatSenyapSampai = Number(simpan[ALAT_KUNCI_SENYAP]) || 0;
  } catch {
    alatSenyapSampai = 0;
  }
  alatTandaiSenyap();
}

function alatDengarkanSenyap() {
  try {
    chrome.storage.onChanged.addListener((ubah, tempat) => {
      if (tempat !== "local") return;
      if (ALAT_KUNCI_SENYAP in ubah) alatSenyapSampai = Number(ubah[ALAT_KUNCI_SENYAP].newValue) || 0;
      // Saklar fitur atau tampilan yang berganti juga menentukan senyap.
      if (ALAT_KUNCI_SENYAP in ubah || ALAT_UJI_KUNCI_TAMPILAN in ubah || ALAT_UJI_KUNCI_FITUR in ubah || ALAT_UJI_KUNCI_SERVER in ubah) alatTandaiSenyap();
    });
  } catch {
    /* berlaku saat halaman dimuat ulang */
  }
}

/* ─── 3d. MODE LATIHAN (ide sipp-28) ─────────────────────────────────────────
 *
 * Saklar keselamatan milik Super Admin dan Admin (keputusan pengguna 29
 * September 2026), dinyalakan dari popup. Untuk melatih petugas baru di SIPP
 * yang SUNGGUHAN: semua tombol panel berjalan seperti biasa, tetapi tidak ada
 * satu pun yang ditulis ke SIPP maupun ke ALETA - dan yang AKAN ditulis
 * diperlihatkan di layar ("LATIHAN: yang akan ditulis ...").
 *
 * Bedanya dengan dua penahan yang sudah ada:
 *
 *   mode kering   menahan tulisan ke /aleta/api dan tombol Simpan SIPP;
 *                 medan blangko SIPP TETAP diisi, supaya isiannya dapat
 *                 diperiksa di layar
 *   mode coba     menyertai tampilan uji Super Admin; menahan non-GET kecuali
 *                 ALETA_COBA_BOLEH, termasuk setelan pribadi dan Masukan
 *   mode latihan  menahan SEMUA non-GET kecuali daftar hitung/baca yang lebih
 *                 sempit lagi (ALETA_LATIHAN_BOLEH), tombol Simpan SIPP, DAN
 *                 pengisian medan blangko SIPP ("isi" jembatan - lihat
 *                 kirimKeJembatan di konten.js)
 *
 * Pengisian medan ikut ditahan, dan itu sengaja berbeda dengan mode kering.
 * Yang dilatih petugas baru; kebiasaan pertama petugas baru sesudah borang
 * terisi adalah menekan Simpan milik SIPP sendiri - tombol halaman yang TIDAK
 * dapat ditahan ekstensi. Borang yang terisi di bawah tanda "latihan" adalah
 * senjata terkokang. Yang ingin melihat isiannya di layar memakai mode kering.
 *
 * Arah kesalahannya sama dengan mode coba: yang belum diperiksa ditahan.
 * Permintaan yang ditahan dijawab 423 dengan alasan "mode_latihan" - panel
 * menampilkan kalimatnya - dan dicatat di kotak "Catatan latihan" bersama
 * ringkasan badannya.
 *
 * Bawaannya MATI, dan selama mati tidak ada yang berubah: tidak ada atribut,
 * tidak ada kotak, tidak ada permintaan yang ditahan. Berlaku di SEMUA
 * tampilan (Lama juga) - ia saklar keselamatan, bukan fitur tampilan uji.
 */
const ALAT_LATIHAN_KUNCI = "modeLatihan";
const ALAT_LATIHAN_MAKS = 30;
let alatLatihanNyalaKini = false;
/** Sebabnya sama dengan alatKeringDisetel - pilihan di halaman ini menang atas bacaan yang masih di jalan. */
let alatLatihanDisetel = false;
/** Sudahkah penyimpanan terbaca sekali? Sebelum itu tulisan MENUNGGU bacaannya. */
let alatLatihanTerbaca = false;
let alatLatihanSiap = null;
/** Hanya di memori: badan permintaan dapat memuat nama pihak, dan tidak perlu bertahan. */
const alatLatihanCatatan = [];

/**
 * Non-GET yang TETAP boleh selama latihan: ALETA_COBA_BOLEH dikurangi yang
 * menyimpan catatan di ALETA (setelan pribadi, Masukan). Masing-masing hanya
 * membaca atau menghitung - lihat catatan ALETA_COBA_BOLEH.
 */
const ALETA_LATIHAN_BOLEH = [
  /\/aleta\/api\/aleta-bot\/abt\/pdf(?:[?#]|$)/,
  /\/aleta\/api\/aleta-bot\/abt\/usulan(?:[?#]|$)/,
  /\/aleta\/api\/aleta-ecourt\/putusan\/praperiksa(?:[?#]|$)/,
  /\/aleta\/api\/aleta-bot\/sipp-konteks\/massal(?:[?#]|$)/,
  /\/aps_badilag\/.*\/main\/cari(?:[?#]|$)/,
  // Konversi naskah (K1) hanya menghitung - lihat ALETA_COBA_BOLEH. Unggahan
  // hasilnya ke SIPP (unggah-sipp) tetap ditahan latihan.
  /\/aleta\/api\/aleta-ecourt\/putusan\/konversi-naskah(?:[?#]|$)/,
];

/** Sebutan manusiawi untuk rute yang paling sering ditahan. */
const ALAT_LATIHAN_SEBUTAN = [
  [/\/penunjukan\/tulis(?:[?#]|$)/, "Menuliskan penetapan ke SIPP"],
  [/\/penunjukan\/hapus-semua(?:[?#]|$)/, "Membatalkan SELURUH penetapan di SIPP"],
  [/\/penunjukan\/hapus(?:[?#]|$)/, "Membatalkan penetapan di SIPP"],
  [/\/penunjukan\/catat(?:[?#]|$)/, "Mencatat isian blangko di ALETA"],
  [/\/penunjukan\/antrean(?:[?#]|$)/, "Meneruskan penetapan ke pejabat"],
  [/\/putusan\/unggah-sipp(?:[?#]|$)/, "Mengunggah putusan ke SIPP"],
  [/\/putusan\/unggah-naskah(?:[?#]|$)/, "Mengunggah naskah putusan ke ALETA"],
  [/\/putusan\/isian-sipp(?:[?#]|$)/, "Menyusun usulan isian putusan"],
  [/\/aleta\/api\/feedback(?:[?#]|$)/, "Mengirim laporan masalah ke Masukan ALETA"],
  [/\/aps_badilag\//, "Menyimpan ke ABT"],
  [/\/manage_court_calendar\/validateInput(?:[?#]|$)/, "Menyimpan Court Calendar ke SIPP"],
];

function alatLatihanNyala() {
  return alatLatihanNyalaKini === true;
}

async function alatMuatLatihan() {
  let terbaca = false;
  try {
    const simpan = await chrome.storage.local.get([ALAT_LATIHAN_KUNCI]);
    terbaca = simpan[ALAT_LATIHAN_KUNCI] === true;
  } catch {
    terbaca = false;
  }
  alatLatihanTerbaca = true;
  if (alatLatihanDisetel) return alatLatihanNyalaKini;
  alatLatihanNyalaKini = terbaca;
  alatTandaiLatihan();
  return alatLatihanNyalaKini;
}

function alatDengarkanLatihan() {
  try {
    chrome.storage.onChanged.addListener((ubah, tempat) => {
      if (tempat !== "local" || !ubah[ALAT_LATIHAN_KUNCI]) return;
      const sebelum = alatLatihanNyalaKini;
      alatLatihanNyalaKini = ubah[ALAT_LATIHAN_KUNCI].newValue === true;
      alatLatihanDisetel = true;
      alatLatihanTerbaca = true;
      if (sebelum !== alatLatihanNyalaKini) {
        alatCatat("latihan", alatLatihanNyalaKini ? "mode latihan DINYALAKAN" : "mode latihan dimatikan", "");
      }
      alatTandaiLatihan();
    });
  } catch {
    /* tanpa pendengarnya, pilihan berlaku saat halaman dimuat ulang */
  }
}

/**
 * Penanda <html data-aleta-latihan="ya"> - pita panel dan label halaman
 * mengambil isyarat dari sini. Dilepas seluruhnya saat mati, bersama kotak
 * catatannya: halaman kembali persis seperti sebelum latihan.
 */
function alatTandaiLatihan() {
  try {
    const akar = document.documentElement;
    if (alatLatihanNyalaKini) akar.setAttribute("data-aleta-latihan", "ya");
    else akar.removeAttribute("data-aleta-latihan");
    if (!alatLatihanNyalaKini) {
      const kotak = document.getElementById("aleta-latihan-kotak");
      if (kotak) kotak.remove();
      alatLatihanCatatan.length = 0;
    }
  } catch {
    /* tanpa penanda, penahanan tetap berlaku - hanya tidak terlihat */
  }
  try {
    document.dispatchEvent(new CustomEvent("aleta-latihan-berubah", { detail: { nyala: alatLatihanNyalaKini } }));
  } catch {
    /* yang mendengarkan akan ikut saat halaman dimuat ulang */
  }
}

/** Apakah permintaan ini harus ditahan mode latihan? GET dan HEAD tidak pernah. */
function alatLatihanMenahan(alamat, cara) {
  if (!alatLatihanNyala()) return false;
  const c = String(cara || "GET").toUpperCase();
  if (c === "GET" || c === "HEAD") return false;
  const a = String(alamat || "");
  if (ALETA_LATIHAN_BOLEH.some((pola) => pola.test(a))) return false;
  // Tanya-jawab ABT: bacaannya sama rutenya dengan simpanannya (lihat
  // alatCobaMenahan) - yang tanpa aksi=simpan hanya membaca.
  if (/\/tanyajawab_perkara_edit\?/.test(a) && !/[?&]aksi=simpan(?:&|$)/.test(a)) return false;
  return true;
}

function alatLatihanSebutan(alamat) {
  const a = String(alamat || "");
  for (const [pola, sebutan] of ALAT_LATIHAN_SEBUTAN) if (pola.test(a)) return sebutan;
  return "Menulis ke server";
}

/**
 * Ringkasan badan permintaan untuk dibaca manusia: "kunci: nilai" paling
 * banyak delapan, nilai dipotong. Berkas disebut namanya, tidak dibaca.
 */
function alatLatihanRingkasBadan(badan) {
  const potong = (x) => {
    const s = typeof x === "string" ? x : JSON.stringify(x);
    const t = String(s === undefined ? "" : s).replace(/\s+/g, " ").trim();
    return t.length > 80 ? `${t.slice(0, 80)}…` : t;
  };
  try {
    if (badan === undefined || badan === null || badan === "") return "";
    if (typeof FormData !== "undefined" && badan instanceof FormData) {
      const baris = [];
      for (const [k, v] of badan.entries()) {
        baris.push(`${k}: ${v && typeof v === "object" && "name" in v ? `berkas ${v.name}` : potong(v)}`);
        if (baris.length >= 8) break;
      }
      return baris.join(" · ");
    }
    if (typeof badan === "string") {
      let isi = null;
      try {
        isi = JSON.parse(badan);
      } catch {
        isi = null;
      }
      if (isi && typeof isi === "object" && !Array.isArray(isi)) {
        return Object.entries(isi)
          .slice(0, 8)
          .map(([k, v]) => `${k}: ${potong(v)}`)
          .join(" · ");
      }
      return potong(badan);
    }
    return `(${Object.prototype.toString.call(badan).slice(8, -1)})`;
  } catch {
    return "";
  }
}

/**
 * Satu tindakan yang ditahan latihan: dicatat, ditampilkan, dan dikabarkan.
 * `butir` = { jenis: "kirim"|"tekan"|"isi", sebutan, rinci }.
 */
function alatCatatLatihan(butir) {
  const b = {
    jenis: String((butir && butir.jenis) || "kirim"),
    sebutan: String((butir && butir.sebutan) || ""),
    rinci: String((butir && butir.rinci) || ""),
    waktu: Date.now(),
  };
  alatLatihanCatatan.push(b);
  while (alatLatihanCatatan.length > ALAT_LATIHAN_MAKS) alatLatihanCatatan.shift();
  alatCatat("latihan", `LATIHAN ${b.jenis}: ${b.sebutan}`, b.rinci.slice(0, 200));
  alatGambarLatihan();
  try {
    document.dispatchEvent(new CustomEvent("aleta-latihan-tertahan", { detail: { ...b } }));
  } catch {
    /* kotaknya sudah tergambar */
  }
}

function alatLatihanDaftar() {
  return alatLatihanCatatan.map((x) => ({ ...x }));
}

/** Jawaban tiruan untuk permintaan yang ditahan latihan - 423, dengan sebabnya. */
function alatJawabanLatihan(alamat, cara, sebutan) {
  const badan = JSON.stringify({
    ok: false,
    alasan: "mode_latihan",
    pesan: `LATIHAN: ${sebutan} tidak dikirim - mode latihan menyala, tidak ada yang ditulis ke SIPP maupun ALETA.`,
    // Kontrak jawaban portal ({ error: { message } }) ikut diisi, supaya
    // pemanggil yang hanya membaca bentuk itu pun menyebut sebabnya.
    error: { message: `LATIHAN: ${sebutan} tidak dikirim (mode latihan).` },
    yangDitahan: { cara: String(cara || "POST").toUpperCase(), alamat: String(alamat || "") },
  });
  return new Response(badan, {
    status: 423,
    statusText: "Mode latihan",
    headers: { "content-type": "application/json" },
  });
}

/**
 * Kotak "Catatan latihan": daftar yang AKAN ditulis seandainya latihan mati.
 * Ditempel ke <html>, bukan ke <body> - pengamat DOM panel SIPP mendengarkan
 * <body>, dan kotak yang tumbuh di sana akan memicu penyegaran panel.
 */
function alatGambarLatihan() {
  if (!alatLatihanNyala()) return;
  try {
    let kotak = document.getElementById("aleta-latihan-kotak");
    if (!kotak) {
      kotak = document.createElement("section");
      kotak.id = "aleta-latihan-kotak";
      kotak.className = "aleta-latihan-kotak";
      kotak.setAttribute("role", "log");
      kotak.setAttribute("aria-label", "Catatan latihan ALETA");
      document.documentElement.appendChild(kotak);
    }
    kotak.hidden = false;
    kotak.textContent = "";
    const kepala = alatEl("div", "aleta-latihan-kepala");
    kepala.appendChild(alatEl("strong", "", "LATIHAN: yang akan ditulis"));
    kepala.appendChild(alatEl("span", "aleta-latihan-hitung", `${alatLatihanCatatan.length} ditahan`));
    const kosongkan = alatEl("button", "aleta-latihan-tombol", "kosongkan");
    kosongkan.type = "button";
    kosongkan.addEventListener("click", () => {
      alatLatihanCatatan.length = 0;
      kotak.remove();
    });
    const tutup = alatEl("button", "aleta-latihan-tombol", "×");
    tutup.type = "button";
    tutup.title = "Sembunyikan catatan ini - muncul lagi pada tindakan berikutnya";
    tutup.addEventListener("click", () => {
      kotak.hidden = true;
    });
    kepala.appendChild(kosongkan);
    kepala.appendChild(tutup);
    kotak.appendChild(kepala);
    kotak.appendChild(
      alatEl(
        "div",
        "aleta-latihan-ket",
        "Tidak ada yang ditulis ke SIPP maupun ALETA. Medan blangko SIPP tidak diisi dan tombol Simpan tidak ditekan."
      )
    );
    const daftar = alatEl("ol", "aleta-latihan-daftar");
    for (const b of alatLatihanCatatan.slice().reverse()) {
      const li = alatEl("li", `aleta-latihan-butir aleta-latihan-${b.jenis}`);
      li.appendChild(alatEl("span", "aleta-latihan-sebutan", b.sebutan));
      if (b.rinci) li.appendChild(alatEl("span", "aleta-latihan-rinci", b.rinci));
      daftar.appendChild(li);
    }
    kotak.appendChild(daftar);
  } catch {
    /* catatan tetap ada di kotak hitam */
  }
}

// Dipasang saat berkas dimuat, sebelum konten.js, abt.js, dan aleta.js -
// sama dengan mode kering. alatLatihanSiap ditunggu pemantau permintaan untuk
// tulisan yang berangkat sebelum bacaan pertama kembali.
alatDengarkanLatihan();
alatLatihanSiap = alatMuatLatihan();

/** Peristiwa DOM untuk yang perlu menata ulang dirinya: widget checklist, dan fitur ide kelak. */
function alatKabarkanUji() {
  try {
    document.dispatchEvent(new CustomEvent("aleta-uji-berubah", { detail: { mode: alatUji.mode } }));
  } catch {
    /* yang mendengarkan akan ikut saat halaman dimuat ulang */
  }
}

/** Pengalih di popup berlaku seketika di semua tab yang terbuka. */
function alatDengarkanUji() {
  try {
    chrome.storage.onChanged.addListener((ubah, tempat) => {
      if (tempat !== "local") return;
      const kunci = [ALAT_UJI_KUNCI_TAMPILAN, ALAT_UJI_KUNCI_FITUR, ALAT_UJI_KUNCI_NYATA, ALAT_UJI_KUNCI_SERVER];
      if (!kunci.some((k) => k in ubah)) return;
      const baru = {};
      for (const k of kunci) if (k in ubah) baru[k] = ubah[k].newValue;
      const modeSebelum = alatUji.mode;
      alatUjiTerima(baru);
      alatTandaiUji();
      if (modeSebelum !== alatUji.mode) {
        alatCatat("uji", `tampilan ${modeSebelum} → ${alatUji.mode}`, alatCobaAktif() ? "mode coba aktif" : "");
      }
      alatKabarkanUji();
    });
  } catch {
    /* tanpa pendengarnya, pilihan berlaku saat halaman dimuat ulang */
  }
}

/**
 * ============================================================================
 * PANEL RINGKAS - KETERANGAN PANJANG DISEMBUNYIKAN, PESAN TIDAK
 * ============================================================================
 *
 * Diminta pengguna 22 September 2026: satu saklar di samping deretan pintasan
 * Alt, untuk meminimalkan "segala keterangan yang tidak terlalu penting" -
 * contohnya "Putusan akhir dan anonimisasinya diunggah sekaligus - berkas,
 * kolom dokumen, baris Direktori Putusan, dan antreannya. PDF saja."
 *
 * Kalimat semacam itu ditulis untuk orang yang PERTAMA KALI membuka panelnya.
 * Yang sudah memakainya tiap hari membacanya ratusan kali, dan tiap kalimat
 * mendorong tombol yang sungguh dipakainya makin ke bawah.
 *
 * ============================================================================
 * YANG DISEMBUNYIKAN HANYA YANG BERTANDA, BUKAN SELURUH KELASNYA
 * ============================================================================
 *
 * Kelas .aleta-tetap-sebab bermuka dua: separuh pemakaiannya kotak KABAR yang
 * lahir kosong lalu diisi pesan galat, kemajuan, atau hasil. Menyembunyikan
 * kelasnya begitu saja membuat panel DIAM ketika sesuatu gagal - penetapan
 * yang tidak tersimpan akan tampak seperti tidak terjadi apa-apa.
 *
 * Karena itu keterangan tetapnya diberi kelas kedua .aleta-remeh, dan hanya
 * itu yang disembunyikan. Aturan CSS-nya ada di panel.css dan seluruhnya
 * dijangkar pada kelas berawalan .aleta- supaya tidak pernah menyentuh satu
 * pun elemen milik SIPP.
 *
 * Bawaannya MATI. Yang belum pernah menyalakannya tidak boleh kehilangan
 * keterangan yang tidak pernah ia minta dihilangkan.
 */
const ALAT_RINGKAS_KUNCI = "panelRingkas";
let alatRingkasNyalaKini = false;
/** Sebabnya sama dengan alatKeringDisetel - lihat catatannya di atas. */
let alatRingkasDisetel = false;

function alatRingkasNyala() {
  return alatRingkasNyalaKini === true;
}

async function alatMuatRingkas() {
  let terbaca = false;
  try {
    const simpan = await chrome.storage.local.get([ALAT_RINGKAS_KUNCI]);
    terbaca = simpan[ALAT_RINGKAS_KUNCI] === true;
  } catch {
    terbaca = false;
  }
  if (alatRingkasDisetel) return alatRingkasNyalaKini;
  alatRingkasNyalaKini = terbaca;
  alatTandaiRingkas();
  return alatRingkasNyalaKini;
}

function alatDengarkanRingkas() {
  try {
    chrome.storage.onChanged.addListener((ubah, tempat) => {
      if (tempat !== "local" || !ubah[ALAT_RINGKAS_KUNCI]) return;
      alatRingkasNyalaKini = ubah[ALAT_RINGKAS_KUNCI].newValue === true;
      alatRingkasDisetel = true;
      alatTandaiRingkas();
      alatSegarkanTombolRingkas();
    });
  } catch {
    /* tanpa pendengarnya, pilihannya tetap berlaku di tab tempat ia disetel */
  }
}

async function alatSetelRingkas(nyala) {
  alatRingkasDisetel = true;
  alatRingkasNyalaKini = nyala === true;
  alatTandaiRingkas();
  alatSegarkanTombolRingkas();
  try {
    await chrome.storage.local.set({ [ALAT_RINGKAS_KUNCI]: alatRingkasNyalaKini });
  } catch {
    /* berlaku untuk halaman ini saja */
  }
  return alatRingkasNyalaKini;
}

function alatTandaiRingkas() {
  try {
    if (alatRingkasNyalaKini) document.documentElement.setAttribute("data-aleta-ringkas", "ya");
    else document.documentElement.removeAttribute("data-aleta-ringkas");
  } catch {
    /* tanpa penandanya, keterangannya tetap tampil - tidak ada yang rusak */
  }
}

/**
 * Menyegarkan SELURUH tombolnya, bukan yang ditekan saja.
 *
 * Satu halaman dapat memuat lebih dari satu panel - ABT membuka panel perkara
 * dan panel massal berdampingan - dan keduanya menggambar kakinya sendiri.
 * Tombol yang tidak ikut disegarkan akan menunjukkan keadaan yang berlawanan
 * dengan apa yang sedang berlaku, dan itu lebih membingungkan daripada tidak
 * ada tombol sama sekali.
 */
function alatSegarkanTombolRingkas() {
  try {
    const semua = document.querySelectorAll(".aleta-kaki-ringkas");
    for (const tombol of semua) alatRupaTombolRingkas(tombol);
  } catch {
    /* tombol yang tidak tersegarkan hanya keliru rupanya, bukan kerjanya */
  }
}

function alatRupaTombolRingkas(tombol) {
  const nyala = alatRingkasNyala();
  tombol.setAttribute("aria-pressed", nyala ? "true" : "false");
  tombol.textContent = nyala ? "⌄" : "⌃";
  tombol.title = nyala
    ? "Keterangan panjang sedang disembunyikan. Tekan untuk menampilkannya kembali."
    : "Sembunyikan keterangan panjang. Tombol, isian, dan pesan error tetap tampil.";
}

/**
 * Tombol saklarnya, untuk ditaruh di kaki panel.
 *
 * SEBELUM deretan pintasan, bukan sesudahnya: .aleta-kaki-pintasan memegang
 * margin-right otomatis yang mendorong ikon segarkan dan nomor versi ke
 * kanan. Tombol yang ditaruh sesudahnya ikut terdorong ke ujung kanan, jauh
 * dari tulisan Alt+A yang menjadi acuan pengguna.
 */
function alatTombolRingkas() {
  const tombol = document.createElement("button");
  tombol.type = "button";
  tombol.className = "aleta-kaki-ringkas";
  alatRupaTombolRingkas(tombol);
  tombol.addEventListener("click", () => {
    void alatSetelRingkas(!alatRingkasNyala());
  });
  return tombol;
}

/*
 * ============================================================================
 * SEMBUNYIKAN PENJELASAN TEKNIS (perbaikan 30 Sep sore butir 3, kontrak K5)
 * ============================================================================
 *
 * Pengguna: "semua penjelasan teknis / berbahasa teknis tersembunyi" - contoh
 * "4 variabel memang tidak berlaku untuk perkara ini (tanpa kuasa, bukan
 * prodeo): 0132, 0156, 0661, 0663" atau "Belum ada variabel disematkan…".
 *
 * Berbeda dengan panel ringkas di atas (bawaan MATI, kelas .aleta-remeh):
 * saklar ini BAWAAN NYALA, dan yang disembunyikannya hanya elemen berkelas
 * .aleta-teknis - tiap agen menandai penjelasan teknis di berkasnya sendiri.
 * Pesan error, peringatan yang meminta tindakan, konfirmasi, dan hasil yang
 * harus dibaca untuk bertindak TIDAK PERNAH diberi kelas itu.
 *
 *   sembunyikanTeknis (chrome.storage.local)  true / false; belum pernah
 *                                             diatur = true (nyala)
 *   <html data-aleta-teknis="sembunyi">       dipasang HANYA bila saklar
 *                                             nyala DAN tampilan Baru/UI Baru;
 *                                             dalam Lama tidak pernah - Lama
 *                                             tetap identik
 *   peristiwa "aleta-teknis-berubah"          di document, tiap kali keadaan
 *                                             berlaku atau saklarnya berubah;
 *                                             detail { tersembunyi, saklar }
 *   alatTeknisTersembunyi()                   untuk JS: apakah penjelasan
 *                                             teknis sedang disembunyikan
 *
 * Aturan CSS-nya di panel.css (blok W) untuk halaman, dan di Shadow DOM
 * widget checklist (checklist.js) untuk widget. Saklarnya di popup dan di
 * widget; alatSaklarTeknis() menyediakan saklar siap pasang untuk panel.
 */
const ALAT_TEKNIS_KUNCI = "sembunyikanTeknis";
const ALAT_TEKNIS_PERISTIWA = "aleta-teknis-berubah";
let alatTeknisSaklarKini = true;
/** Sebabnya sama dengan alatKeringDisetel - pilihan yang tiba selama bacaan pertama menang. */
let alatTeknisDisetel = false;
/** Keadaan terakhir yang dikabarkan ("tersembunyi|saklar") - peristiwa hanya saat berubah. */
let alatTeknisDikabarkan = "false|true";

/** Nilai saklar yang tersimpan (bawaan nyala), tanpa memandang tampilan. */
function alatTeknisSaklar() {
  try {
    return alatTeknisSaklarKini !== false;
  } catch {
    return true;
  }
}

/** Apakah penjelasan teknis sedang disembunyikan di halaman ini? Lama: tidak pernah. */
function alatTeknisTersembunyi() {
  try {
    return alatTeknisSaklarKini !== false && alatUjiMode() !== "lama";
  } catch {
    return false;
  }
}

function alatTandaiTeknis() {
  try {
    const sembunyi = alatTeknisTersembunyi();
    const akar = document.documentElement;
    if (sembunyi) akar.setAttribute("data-aleta-teknis", "sembunyi");
    else akar.removeAttribute("data-aleta-teknis");
    const saklar = alatTeknisSaklar();
    const tanda = `${sembunyi}|${saklar}`;
    if (tanda === alatTeknisDikabarkan) return;
    alatTeknisDikabarkan = tanda;
    document.dispatchEvent(new CustomEvent(ALAT_TEKNIS_PERISTIWA, { detail: { tersembunyi: sembunyi, saklar } }));
  } catch {
    /* dipanggil sebelum berkas ini selesai dimuat, atau tanpa dokumen - penjelasannya tetap tampil */
  }
}

async function alatMuatTeknis() {
  let terbaca = true;
  try {
    const simpan = await chrome.storage.local.get([ALAT_TEKNIS_KUNCI]);
    terbaca = simpan[ALAT_TEKNIS_KUNCI] !== false;
  } catch {
    terbaca = true;
  }
  if (!alatTeknisDisetel) alatTeknisSaklarKini = terbaca;
  alatTandaiTeknis();
  return alatTeknisSaklarKini;
}

function alatDengarkanTeknis() {
  try {
    chrome.storage.onChanged.addListener((ubah, tempat) => {
      if (tempat !== "local" || !ubah[ALAT_TEKNIS_KUNCI]) return;
      // Kunci yang dihapus (newValue undefined) kembali ke bawaan: nyala.
      alatTeknisSaklarKini = ubah[ALAT_TEKNIS_KUNCI].newValue !== false;
      alatTeknisDisetel = true;
      alatTandaiTeknis();
    });
  } catch {
    /* tanpa pendengarnya, pilihannya tetap berlaku di tab tempat ia disetel */
  }
}

async function alatSetelTeknis(nyala) {
  alatTeknisDisetel = true;
  alatTeknisSaklarKini = nyala !== false;
  alatTandaiTeknis();
  try {
    await chrome.storage.local.set({ [ALAT_TEKNIS_KUNCI]: alatTeknisSaklarKini });
  } catch {
    /* berlaku untuk halaman ini saja */
  }
  return alatTeknisSaklarKini;
}

/**
 * Saklar siap pasang untuk panel (mis. menu ⋯ panel ABT): kotak centang
 * berlabel, selalu mengikuti keadaan yang tersimpan - juga bila diubah dari
 * popup atau widget. Dalam Lama tidak ada yang dipasang: null.
 */
function alatSaklarTeknis() {
  if (alatUjiMode() === "lama") return null;
  const label = document.createElement("label");
  label.className = "aleta-saklar-teknis";
  label.title = "Keterangan teknis disembunyikan. Error, peringatan, dan konfirmasi tetap tampil.";
  const kotak = document.createElement("input");
  kotak.type = "checkbox";
  kotak.checked = alatTeknisSaklar();
  kotak.addEventListener("change", () => void alatSetelTeknis(kotak.checked));
  const teks = document.createElement("span");
  teks.textContent = "Sembunyikan penjelasan teknis";
  label.appendChild(kotak);
  label.appendChild(teks);
  let pernahTerpasang = false;
  const ikuti = () => {
    // Pendengar dilepas sesudah saklarnya dibuang dari halaman - bukan
    // sebelum pemanggil sempat memasangnya.
    if (label.isConnected) pernahTerpasang = true;
    else if (pernahTerpasang) {
      document.removeEventListener(ALAT_TEKNIS_PERISTIWA, ikuti);
      return;
    }
    kotak.checked = alatTeknisSaklar();
  };
  document.addEventListener(ALAT_TEKNIS_PERISTIWA, ikuti);
  return label;
}

/**
 * Bolehkah permintaan ini berangkat?
 *
 * Yang ditahan hanya TULISAN ke portal ALETA. Bacaan tetap berjalan - panel
 * yang kosong tidak memperlihatkan apa pun untuk diperiksa, dan itu membuat
 * mode kering tidak ada gunanya. Permintaan ke SIPP sendiri juga tidak
 * disentuh: ALETA tidak pernah menulis ke SIPP lewat jaringan, melainkan lewat
 * borangnya - dan borang itu ditahan di tempat lain (perintah "tekan").
 */
function alatKeringMenahan(alamat, opsi) {
  if (!alatKeringNyala()) return false;
  const cara = String((opsi && opsi.method) || "GET").toUpperCase();
  if (cara === "GET" || cara === "HEAD") return false;
  return /\/aleta\/api\//.test(String(alamat || ""));
}

/** Jawaban tiruan untuk permintaan yang ditahan - 423 Locked, dengan sebabnya. */
function alatJawabanKering(alamat, opsi) {
  const cara = String((opsi && opsi.method) || "POST").toUpperCase();
  const badan = JSON.stringify({
    ok: false,
    alasan: "mode_kering",
    pesan: "Mode kering aktif - tidak ada yang dikirim ke ALETA.",
    yangDitahan: { cara, alamat: String(alamat || "") },
  });
  return new Response(badan, {
    status: 423,
    statusText: "Mode kering",
    headers: { "content-type": "application/json" },
  });
}

/* ─── 4. PEMANTAU PERMINTAAN: SATU KAIT UNTUK SEMUANYA ──────────────────────
 *
 * Permintaan jaringan ekstensi ini keluar dari lebih dari tiga puluh tempat -
 * sebagian lewat alatAmbil, sebagian lewat fetch langsung. Memasang catatan
 * di tiap tempat berarti tiga puluh suntingan yang harus tetap lengkap
 * selamanya, dan yang terlewat justru akan menjadi yang paling dibutuhkan.
 *
 * Karena itu yang dibungkus fetch-nya sendiri, SATU KALI. Ini fetch milik
 * dunia terasing ekstensi - bukan fetch halaman SIPP: permintaan SIPP sendiri
 * tidak ikut tercatat dan tidak ikut tertahan.
 */
function alatPasangPemantauAmbil() {
  const tanda = "__aletaPemantauAmbil";
  if (globalThis[tanda]) return;
  const asli = globalThis.fetch;
  if (typeof asli !== "function") return;
  globalThis[tanda] = true;

  globalThis.fetch = async function aletaFetch(masukan, opsi) {
    const alamat = typeof masukan === "string" ? masukan : (masukan && masukan.url) || String(masukan);
    const cara = String((opsi && opsi.method) || (masukan && masukan.method) || "GET").toUpperCase();

    // Hak unggah putusan (keputusan 9 Okt 2026) - PALING DULU, dan untuk
    // semua cara termasuk GET isian-sipp: peran yang pasti tidak berhak tidak
    // mengirim apa pun; jawabannya 403 tiruan berkalimat sama dengan peladen.
    if (alatUnggahPutusanDitahan(alamat)) {
      alatCatat("hak", `DITAHAN ${cara} ${alatRingkasAlamat(alamat)}`, "peran tidak berhak unggah putusan");
      return alatJawabanTolakUnggahPutusan();
    }

    // Mode latihan lebih dulu daripada kering dan coba: ia yang paling ketat,
    // dan yang ditahannya harus tercatat di kotak "yang akan ditulis" walau
    // penahan lain ikut menyala. Tulisan yang berangkat sebelum saklarnya
    // sempat terbaca MENUNGGU bacaannya - latihan yang menyala tidak boleh
    // kalah balapan dengan tekanan pertama sesudah halaman dimuat.
    if (cara !== "GET" && cara !== "HEAD") {
      if (!alatLatihanTerbaca && alatLatihanSiap) await alatLatihanSiap;
      if (alatLatihanMenahan(alamat, cara)) {
        const sebutan = alatLatihanSebutan(alamat);
        alatCatatLatihan({
          jenis: "kirim",
          sebutan: `${sebutan} - ${cara} ${alatRingkasAlamat(alamat)}`,
          rinci: alatLatihanRingkasBadan((opsi && opsi.body) || undefined),
        });
        return alatJawabanLatihan(alamat, cara, sebutan);
      }
    }
    if (alatKeringMenahan(alamat, opsi || masukan)) {
      alatCatat("kering", `DITAHAN ${cara} ${alatRingkasAlamat(alamat)}`, "mode kering aktif");
      return alatJawabanKering(alamat, opsi || masukan);
    }
    if (alatCobaMenahan(alamat, cara)) {
      alatCatat("coba", `DITAHAN ${cara} ${alatRingkasAlamat(alamat)}`, "mode coba aktif");
      return alatJawabanCoba(alamat, cara);
    }

    const mulai = Date.now();
    try {
      const jawab = await asli.call(this, masukan, opsi);
      const lama = Date.now() - mulai;
      alatCatat(
        jawab.ok ? "ambil" : "ambil-gagal",
        `${cara} ${alatRingkasAlamat(alamat)} → ${jawab.status} (${lama} ms)`,
        jawab.ok ? "" : `status ${jawab.status} ${jawab.statusText || ""}`
      );
      return jawab;
    } catch (galat) {
      alatCatat(
        "ambil-galat",
        `${cara} ${alatRingkasAlamat(alamat)} → ${(galat && galat.name) || "galat"} (${Date.now() - mulai} ms)`,
        (galat && galat.message) || String(galat)
      );
      throw galat;
    }
  };
}

/** Alamat dipendekkan supaya satu baris kotak hitam tetap satu baris. */
function alatRingkasAlamat(alamat) {
  const s = String(alamat || "");
  const tanpaAsal = s.replace(/^https?:\/\/[^/]+/i, "");
  return tanpaAsal.length > 70 ? `${tanpaAsal.slice(0, 70)}…` : tanpaAsal;
}

/* ─── 5. RIWAYAT TINDAKAN, DAN JALAN PULANGNYA ──────────────────────────────
 *
 * Tiap medan yang diisi ALETA dicatat bersama NILAI SEBELUMNYA. Dari situlah
 * "pulihkan" mungkin: mengisinya kembali dengan yang lama.
 *
 * Yang TIDAK dapat dipulihkan disebut apa adanya - penekanan tombol Simpan
 * SIPP, unggahan berkas, penetapan yang sudah terbit. Menawarkan tombol
 * pulihkan untuk sesuatu yang tidak dapat dipulihkan lebih buruk daripada
 * tidak menawarkan apa-apa; yang menekannya akan mengira keadaannya sudah
 * kembali.
 */
const ALAT_RIWAYAT_MAKS = 40;
const ALAT_RIWAYAT_KUNCI = "aleta-riwayat-tindakan";
const alatRiwayat = [];
let alatRiwayatNomor = 0;

function alatRiwayatMuat() {
  if (alatRiwayat.length > 0) return;
  try {
    const mentah = window.sessionStorage.getItem(ALAT_RIWAYAT_KUNCI);
    if (!mentah) return;
    const urai = JSON.parse(mentah);
    if (Array.isArray(urai)) {
      for (const x of urai.slice(-ALAT_RIWAYAT_MAKS)) alatRiwayat.push(x);
      alatRiwayatNomor = alatRiwayat.length;
    }
  } catch {
    /* mulai dari kosong */
  }
}

function alatRiwayatSimpan() {
  try {
    window.sessionStorage.setItem(ALAT_RIWAYAT_KUNCI, JSON.stringify(alatRiwayat));
  } catch {
    /* riwayat tetap hidup di memori halaman ini */
  }
}

function alatCatatTindakan(tindakan) {
  alatRiwayatMuat();
  alatRiwayatNomor += 1;
  const baris = {
    id: alatRiwayatNomor,
    waktu: new Date().toISOString(),
    jenis: String((tindakan && tindakan.jenis) || "isi"),
    penunjuk: String((tindakan && tindakan.penunjuk) || ""),
    jenisMedan: String((tindakan && tindakan.jenisMedan) || ""),
    label: String((tindakan && tindakan.label) || ""),
    nilaiLama: (tindakan && tindakan.nilaiLama) === undefined ? "" : String(tindakan.nilaiLama).slice(0, 300),
    nilaiBaru: (tindakan && tindakan.nilaiBaru) === undefined ? "" : String(tindakan.nilaiBaru).slice(0, 300),
    dapatPulih: Boolean(tindakan && tindakan.dapatPulih),
    dipulihkan: false,
  };
  alatRiwayat.push(baris);
  while (alatRiwayat.length > ALAT_RIWAYAT_MAKS) alatRiwayat.shift();
  alatRiwayatSimpan();
  return baris;
}

function alatRiwayatTindakan() {
  alatRiwayatMuat();
  return alatRiwayat.slice();
}

function alatRiwayatKosongkan() {
  alatRiwayat.length = 0;
  alatRiwayatSimpan();
}

function alatTandaiDipulihkan(id) {
  alatRiwayatMuat();
  const baris = alatRiwayat.find((x) => x.id === id);
  if (baris) {
    baris.dipulihkan = true;
    alatRiwayatSimpan();
  }
}

/**
 * Cara memulihkan berbeda di tiap panel - hanya panel SIPP yang punya
 * jembatan ke borangnya. Panel yang punya mendaftarkan pemulihnya di sini;
 * yang tidak, riwayatnya tetap terbaca tanpa tombol pulihkan.
 */
let alatPemulihTindakan = null;
function alatDaftarkanPemulih(fungsi) {
  alatPemulihTindakan = typeof fungsi === "function" ? fungsi : null;
}

/* ─── 6. PENUNJUK: MASIH KETEMU TIDAK? ──────────────────────────────────────
 *
 * Ekstensi ini mencari tombol dan medan SIPP lewat penunjuk CSS. Ketika SIPP
 * diperbarui dan nama medannya berubah, penunjuk yang tidak ketemu TIDAK
 * menimbulkan galat - querySelector hanya menjawab null, dan ekstensi diam
 * saja tidak mengisi apa-apa. Rusaknya tidak bersuara; yang bersuara petugas,
 * berhari-hari kemudian.
 *
 * Yang didaftarkan di sini penunjuk yang MENENTUKAN - yang kalau hilang,
 * sebuah kemampuan berhenti bekerja. Penunjuk yang memang wajar tidak ada di
 * halaman tertentu ditandai tidak wajib, supaya laporannya tidak penuh
 * peringatan palsu yang lama-lama diabaikan.
 */
const alatPenunjukTerdaftar = [];

function alatDaftarkanPenunjuk(nama, penunjuk, pilihan) {
  if (!nama || !penunjuk) return;
  const opsi = pilihan || {};
  if (alatPenunjukTerdaftar.some((x) => x.nama === nama)) return;
  alatPenunjukTerdaftar.push({
    nama: String(nama),
    penunjuk: Array.isArray(penunjuk) ? penunjuk.slice() : [String(penunjuk)],
    wajib: opsi.wajib !== false,
    saat: String(opsi.saat || "halaman ini"),
  });
}

function alatPeriksaPenunjuk() {
  const hasil = [];
  for (const satu of alatPenunjukTerdaftar) {
    let ketemu = "";
    for (const p of satu.penunjuk) {
      try {
        if (document.querySelector(p)) {
          ketemu = p;
          break;
        }
      } catch {
        /* penunjuk yang tidak sah dihitung tidak ketemu - dan itu memang cacat */
      }
    }
    hasil.push({
      nama: satu.nama,
      ketemu: Boolean(ketemu),
      dipakai: ketemu,
      dicoba: satu.penunjuk,
      wajib: satu.wajib,
      saat: satu.saat,
    });
  }
  return hasil;
}

/* ─── 7. PAPAN KESEHATAN ────────────────────────────────────────────────────
 *
 * Sepuluh pertanyaan yang biasanya dijawab dengan membuka SSH, membaca log,
 * dan menjalankan beberapa perintah. Semuanya dijawab dari sini, dari apa
 * yang memang sudah diketahui panel - TANPA satu pun permintaan tambahan,
 * kecuali satu bacaan ringan ke portal untuk versi yang disajikannya.
 */
const ALAT_EKSTENSI_INFO = "/aleta/api/aleta-ecourt/ekstensi?info=versi";

async function alatPapanKesehatan(opsi) {
  const pilihan = opsi || {};
  const baris = [];
  const tambah = (nama, keadaan, ket) => baris.push({ nama, keadaan, ket: String(ket || "") });

  const l = alatLingkungan();
  tambah("Lingkungan", l.kunci === "peladen" ? "awas" : "baik", `${l.label} — ${l.judul}`);

  let terpasang = "";
  try {
    terpasang = String(chrome.runtime.getManifest().version || "");
  } catch {
    terpasang = "";
  }
  tambah("Versi terpasang", terpasang ? "baik" : "buruk", terpasang || "tidak terbaca - ekstensi di luar konteksnya");

  let disajikan = "";
  let portalHidup = false;
  const mulai = Date.now();
  try {
    const jawab = await fetch(ALAT_EKSTENSI_INFO, { credentials: "include", cache: "no-store" });
    portalHidup = jawab.ok;
    if (jawab.ok) {
      const luar = await jawab.json();
      const data = luar && luar.data ? luar.data : luar;
      disajikan = String((data && data.versi) || "");
    }
  } catch {
    portalHidup = false;
  }
  const lama = Date.now() - mulai;
  tambah("Portal ALETA", portalHidup ? "baik" : "buruk", portalHidup ? `menjawab dalam ${lama} ms` : "tidak menjawab - portal mati, atau alamatnya salah");

  if (terpasang && disajikan) {
    const sama = terpasang === disajikan;
    tambah(
      "Ekstensi mutakhir",
      sama ? "baik" : "awas",
      sama ? `${terpasang} - sama dengan portal` : `portal menyajikan ${disajikan}, yang berjalan ${terpasang}. Unduh lalu tekan Muat Ulang di chrome://extensions.`
    );
  }

  tambah(
    "Mode kering",
    alatKeringNyala() ? "awas" : "baik",
    alatKeringNyala() ? "AKTIF - tidak ada yang disimpan maupun dikirim" : "mati - tindakan berlaku sungguhan"
  );

  const kecepatan = alatKeadaanPortal.terakhirMs;
  tambah(
    "Kecepatan terakhir",
    alatKeadaanPortal.gagalBerturut > 0 ? "buruk" : alatKeadaanPortal.lambat ? "awas" : "baik",
    alatKeadaanPortal.gagalBerturut > 0
      ? `${alatKeadaanPortal.gagalBerturut} permintaan gagal berturut-turut`
      : kecepatan
        ? `${kecepatan} ms`
        : "belum ada permintaan"
  );

  const kotak = alatKotakHitam();
  const galat = kotak.filter((x) => x.jenis === "ambil-galat" || x.jenis === "ambil-gagal").length;
  tambah("Kotak hitam", galat > 0 ? "awas" : "baik", `${kotak.length} kejadian tercatat, ${galat} di antaranya gagal`);

  const penunjuk = alatPeriksaPenunjuk();
  const hilang = penunjuk.filter((x) => x.wajib && !x.ketemu);
  tambah(
    "Penunjuk halaman",
    penunjuk.length === 0 ? "baik" : hilang.length > 0 ? "buruk" : "baik",
    penunjuk.length === 0
      ? "tidak ada yang perlu diperiksa di halaman ini"
      : hilang.length > 0
        ? `${hilang.length} dari ${penunjuk.length} tidak ketemu: ${hilang.map((x) => x.nama).join(", ")}`
        : `${penunjuk.length} penunjuk ketemu semua`
  );

  const riwayat = alatRiwayatTindakan();
  tambah("Riwayat tindakan", "baik", `${riwayat.length} tindakan tercatat di tab ini`);

  if (pilihan.akun) {
    tambah("Akun", pilihan.akun.aleta || pilihan.akun.sipp ? "baik" : "awas", [pilihan.akun.aleta, pilihan.akun.sipp].filter(Boolean).join(" | ") || "belum terbaca");
  }

  return baris;
}

/* ─── LAPORAN UNTUK DITEMPEL ────────────────────────────────────────────────
 *
 * Satu tombol, satu tempelan. Yang selama ini dikerjakan dengan berganti-ganti
 * tangkapan layar - dan tangkapan layar tidak memuat status HTTP, lama
 * permintaan, maupun galat yang sudah terlanjut diterjemahkan.
 */
function alatLaporan(tambahan) {
  const l = alatLingkungan();
  let versi = "";
  try {
    versi = String(chrome.runtime.getManifest().version || "");
  } catch {
    versi = "?";
  }
  const baris = [];
  baris.push("LAPORAN ALETA");
  baris.push(`waktu      : ${new Date().toISOString()}`);
  baris.push(`ekstensi   : ${versi}`);
  baris.push(`lingkungan : ${l.label} (${l.kunci})`);
  baris.push(`halaman    : ${String(window.location.pathname + window.location.search).slice(0, 200)}`);
  baris.push(`mode kering: ${alatKeringNyala() ? "AKTIF" : "mati"}`);
  if (tambahan && tambahan.perkara) baris.push(`perkara    : ${tambahan.perkara}`);
  if (tambahan && tambahan.peran) baris.push(`peran      : ${tambahan.peran}`);

  const penunjuk = alatPeriksaPenunjuk().filter((x) => !x.ketemu);
  baris.push("");
  baris.push(`PENUNJUK TIDAK KETEMU (${penunjuk.length})`);
  for (const p of penunjuk) baris.push(`  ${p.wajib ? "!" : "-"} ${p.nama}: ${p.dicoba.join(" | ")}`);

  const riwayat = alatRiwayatTindakan();
  baris.push("");
  baris.push(`RIWAYAT TINDAKAN (${riwayat.length})`);
  for (const r of riwayat) {
    baris.push(`  ${r.waktu} ${r.jenis} ${r.penunjuk} : "${r.nilaiLama}" → "${r.nilaiBaru}"${r.dipulihkan ? " [dipulihkan]" : ""}`);
  }

  const kotak = alatKotakHitam();
  baris.push("");
  baris.push(`KOTAK HITAM (${kotak.length} kejadian terakhir)`);
  for (const k of kotak) {
    baris.push(`  ${k.waktu} [${k.jenis}] ${k.ringkas}${k.rinci ? ` :: ${k.rinci}` : ""}`);
  }
  return baris.join("\n");
}

async function alatSalin(teks) {
  try {
    await navigator.clipboard.writeText(teks);
    return true;
  } catch {
    // Papan klip ditolak - laporan tetap harus dapat diambil, jadi ia
    // ditaruh di kotak teks yang sudah tersorot seluruhnya.
    return false;
  }
}

/* ─── GULIR YANG MUDAH DILIHAT DAN MUDAH DITEKAN ────────────────────────────
 *
 * Bilah gulir panel dulu selebar 9 piksel dan selalu tampak. Dua-duanya
 * salah untuk panel ini: 9 piksel terlalu tipis untuk ditangkap kursor -
 * meleset sedikit berarti menyeret panelnya - sementara bilah yang selalu
 * tampak menjadi garis terang di tepi kanan yang tidak pernah dibutuhkan
 * ketika isinya memang muat.
 *
 * Sekarang: lebarnya 12 piksel supaya mudah ditekan, dan pegangannya TEMBUS
 * PANDANG selama tidak dipakai. Ia muncul pada tiga keadaan, dan ketiganya
 * berarti "orang ini sedang berurusan dengan gulir":
 *
 *   - kursor masuk ke jalur selebar dua jempol di tepi kanan panel;
 *   - isinya sedang digulir, dan sedetik sesudahnya;
 *   - papan tik memindahkan fokus ke sesuatu di dalam panel.
 *
 * Lebarnya TIDAK ikut berubah - hanya warnanya. Bilah yang melebar saat
 * disentuh menggeser isi panel tepat ketika orang sedang membidiknya.
 */
const ALAT_GULIR_JALUR = 30;
const ALAT_GULIR_DIAM_MS = 1200;

function alatPasangGulir(panel) {
  if (!panel || panel.dataset.gulirTerpasang === "ya") return;
  panel.dataset.gulirTerpasang = "ya";

  let pewaktu = 0;
  const tampak = (ya) => {
    if (ya) panel.setAttribute("data-gulir", "tampak");
    else panel.removeAttribute("data-gulir");
  };
  const tampakSebentar = () => {
    tampak(true);
    clearTimeout(pewaktu);
    pewaktu = setTimeout(() => tampak(false), ALAT_GULIR_DIAM_MS);
  };

  // ==========================================================================
  // SATU PEMBACAAN TATA LETAK PER BINGKAI, BUKAN SATU PER GERAKAN
  // ==========================================================================
  //
  // getBoundingClientRect MEMAKSA peramban menghitung ulang tata letak saat
  // itu juga. Dipanggil di dalam pointermove, ia berjalan puluhan kali per
  // detik selama kursor bergerak di atas panel - di atas halaman SIPP yang
  // tabelnya ribuan sel, itu cukup untuk membuat seluruh halaman terasa
  // berat, termasuk hal-hal yang tidak ada hubungannya dengan panel.
  //
  // Sekarang letak tepinya dibaca paling banyak sekali per bingkai gambar.
  let bingkai = 0;
  let xTerakhir = 0;
  panel.addEventListener("pointermove", (peristiwa) => {
    xTerakhir = peristiwa.clientX;
    if (bingkai) return;
    bingkai = requestAnimationFrame(() => {
      bingkai = 0;
      const kotak = panel.getBoundingClientRect();
      if (xTerakhir >= kotak.right - ALAT_GULIR_JALUR) {
        clearTimeout(pewaktu);
        tampak(true);
      } else if (panel.getAttribute("data-gulir") === "tampak") {
        tampakSebentar();
      }
    });
  });

  panel.addEventListener("pointerleave", () => {
    clearTimeout(pewaktu);
    tampak(false);
  });

  // Gulir ditangkap pada fase TANGKAP: yang bergulir kerap .aleta-isi atau
  // laci perkakas di dalamnya, dan peristiwa scroll tidak menggelembung.
  panel.addEventListener("scroll", tampakSebentar, true);
  panel.addEventListener("focusin", tampakSebentar);
}

/* ─── LACI PERKAKAS: SATU TEMPAT, BUKAN TUJUH TOMBOL ────────────────────────
 *
 * Ketujuh alat tidak mendapat tombolnya sendiri-sendiri di kepala panel.
 * Alasannya sama dengan yang membuat pemilih warna dirapikan lebih dulu:
 * deret tombol kepala adalah tempat yang paling mahal di seluruh panel, dan
 * alat yang dipakai ketika ada masalah tidak berhak menempatinya setiap hari.
 *
 * Satu tombol kunci pas membuka laci; lacinya menutupi isi panel selama
 * dibuka, sebab yang membukanya memang sedang tidak membaca perkara.
 */
/**
 * Versi yang berjalan tertinggal dari yang disajikan portal?
 *
 * Menjawab null bila sama, lebih baru, atau tidak dapat diketahui - dan
 * "tidak dapat diketahui" sengaja diperlakukan sama dengan "tidak apa-apa":
 * portal yang mati tidak boleh memunculkan peringatan tentang versi.
 */
async function alatVersiTertinggal() {
  let terpasang = "";
  try {
    terpasang = String(chrome.runtime.getManifest().version || "");
  } catch {
    return null;
  }
  if (!terpasang) return null;
  try {
    const jawab = await fetch(ALAT_EKSTENSI_INFO, { credentials: "include", cache: "no-store" });
    if (!jawab.ok) return null;
    const luar = await jawab.json();
    const data = luar && luar.data ? luar.data : luar;
    const portal = String((data && data.versi) || "");
    if (!portal || portal === terpasang) return null;
    return { portal, terpasang };
  } catch {
    return null;
  }
}

function alatLaciPerkakas(panel, opsi) {
  const pilihan = opsi || {};
  const laci = alatEl("div", "aleta-perkakas");
  laci.hidden = true;

  const kepala = alatEl("div", "aleta-perkakas-kepala");
  kepala.appendChild(alatEl("span", "aleta-perkakas-judul", "Perkakas super admin"));
  const tombolSegar = alatEl("button", "aleta-perkakas-aksi", "Segarkan");
  tombolSegar.type = "button";
  const tombolSalin = alatEl("button", "aleta-perkakas-aksi", "Salin laporan");
  tombolSalin.type = "button";
  tombolSalin.title = "Menyalin keadaan, riwayat, dan kotak hitam sebagai satu teks untuk ditempel.";
  const tombolTutup = alatEl("button", "aleta-perkakas-tutup", "×");
  tombolTutup.type = "button";
  tombolTutup.title = "Tutup perkakas";
  kepala.appendChild(tombolSegar);
  kepala.appendChild(tombolSalin);
  kepala.appendChild(tombolTutup);
  laci.appendChild(kepala);

  const badan = alatEl("div", "aleta-perkakas-isi");
  laci.appendChild(badan);

  const kabar = alatEl("div", "aleta-perkakas-kabar");
  kabar.hidden = true;
  laci.appendChild(kabar);

  const beritahu = (teks, buruk) => {
    kabar.textContent = teks;
    kabar.classList.toggle("aleta-perkakas-kabar-buruk", Boolean(buruk));
    kabar.hidden = false;
  };

  /** Satu kelompok berjudul di dalam laci. */
  const kelompok = (judul) => {
    const k = alatEl("div", "aleta-perkakas-kelompok");
    k.appendChild(alatEl("div", "aleta-perkakas-kelompok-judul", judul));
    const isi = alatEl("div", "aleta-perkakas-kelompok-isi");
    k.appendChild(isi);
    badan.appendChild(k);
    return isi;
  };

  async function gambar() {
    badan.textContent = "";

    // --- Papan kesehatan -----------------------------------------------------
    const isiPapan = kelompok("Papan kesehatan");
    isiPapan.appendChild(alatEl("div", "aleta-perkakas-tunggu", "memeriksa…"));
    // --- Mode kering ---------------------------------------------------------
    const isiKering = kelompok("Mode kering");
    const saklar = alatEl("button", "aleta-perkakas-saklar");
    saklar.type = "button";
    const gambarSaklar = () => {
      const nyala = alatKeringNyala();
      saklar.textContent = nyala ? "Mode kering: AKTIF" : "Mode kering: mati";
      saklar.classList.toggle("aleta-perkakas-saklar-nyala", nyala);
      saklar.setAttribute("aria-pressed", nyala ? "true" : "false");
    };
    gambarSaklar();
    saklar.addEventListener("click", async () => {
      await alatSetelKering(!alatKeringNyala());
      gambarSaklar();
      beritahu(
        alatKeringNyala()
          ? "Mode kering aktif. Medan tetap diisi supaya hasilnya terlihat, tetapi tombol Simpan SIPP tidak ditekan dan tidak ada yang dikirim ke ALETA."
          : "Mode kering dimatikan. Tindakan berlaku sungguhan."
      );
    });
    isiKering.appendChild(saklar);
    isiKering.appendChild(
      alatEl(
        "div",
        "aleta-perkakas-ket",
        "Medan tetap diisi supaya dapat diperiksa; yang ditahan hanya penekanan Simpan milik SIPP dan pengiriman ke ALETA."
      )
    );

    // --- Penunjuk ------------------------------------------------------------
    const isiPenunjuk = kelompok("Penunjuk halaman");
    const hasilPenunjuk = alatPeriksaPenunjuk();
    if (hasilPenunjuk.length === 0) {
      isiPenunjuk.appendChild(alatEl("div", "aleta-perkakas-ket", "Tidak ada penunjuk yang didaftarkan untuk halaman ini."));
    } else {
      for (const p of hasilPenunjuk) {
        const baris = alatEl("div", `aleta-perkakas-baris aleta-perkakas-${p.ketemu ? "baik" : p.wajib ? "buruk" : "awas"}`);
        baris.appendChild(alatEl("span", "aleta-perkakas-nama", p.nama));
        baris.appendChild(
          alatEl("span", "aleta-perkakas-nilai", p.ketemu ? p.dipakai : `tidak ketemu — dicoba: ${p.dicoba.join(" | ")}`)
        );
        isiPenunjuk.appendChild(baris);
      }
    }

    // --- Riwayat tindakan ----------------------------------------------------
    const isiRiwayat = kelompok("Riwayat tindakan");
    const riwayat = alatRiwayatTindakan().slice().reverse();
    if (riwayat.length === 0) {
      isiRiwayat.appendChild(alatEl("div", "aleta-perkakas-ket", "Belum ada yang diubah ALETA di tab ini."));
    } else {
      for (const r of riwayat) {
        const baris = alatEl("div", "aleta-perkakas-baris");
        baris.appendChild(alatEl("span", "aleta-perkakas-nama", r.label || r.penunjuk));
        baris.appendChild(
          alatEl("span", "aleta-perkakas-nilai", `"${r.nilaiLama || "(kosong)"}" → "${r.nilaiBaru}"`)
        );
        if (r.dipulihkan) {
          baris.appendChild(alatEl("span", "aleta-perkakas-tanda", "dipulihkan"));
        } else if (r.dapatPulih && alatPemulihTindakan) {
          const pulih = alatEl("button", "aleta-perkakas-pulih", "Pulihkan");
          pulih.type = "button";
          pulih.title = `Mengisi kembali ${r.penunjuk} dengan nilai sebelumnya. SIPP belum disimpan, jadi ini benar-benar mengembalikannya.`;
          pulih.addEventListener("click", async () => {
            pulih.disabled = true;
            try {
              const hasil = await alatPemulihTindakan(r);
              if (hasil && hasil.ok) {
                alatTandaiDipulihkan(r.id);
                alatCatat("pulih", `dipulihkan ${r.penunjuk}`, `kembali ke "${r.nilaiLama}"`);
                beritahu(`${r.label || r.penunjuk} dikembalikan ke nilai sebelumnya.`);
                void gambar();
              } else {
                beritahu(`Tidak dapat dipulihkan: ${(hasil && hasil.alasan) || "medannya tidak ditemukan lagi"}.`, true);
                pulih.disabled = false;
              }
            } catch (galat) {
              beritahu(`Tidak dapat dipulihkan: ${(galat && galat.message) || galat}.`, true);
              pulih.disabled = false;
            }
          });
          baris.appendChild(pulih);
        } else {
          const tanda = alatEl("span", "aleta-perkakas-tanda", "tidak dapat dipulihkan");
          tanda.title = "Penekanan Simpan, unggahan, dan penetapan yang sudah terbit tidak punya jalan kembali dari sini.";
          baris.appendChild(tanda);
        }
        isiRiwayat.appendChild(baris);
      }
    }

    // --- Kotak hitam ---------------------------------------------------------
    const isiKotak = kelompok("Kotak hitam");
    const kotak = alatKotakHitam().slice().reverse();
    if (kotak.length === 0) {
      isiKotak.appendChild(alatEl("div", "aleta-perkakas-ket", "Belum ada kejadian tercatat."));
    } else {
      for (const k of kotak) {
        const buruk = k.jenis === "ambil-galat" || k.jenis === "ambil-gagal";
        const baris = alatEl("div", `aleta-perkakas-baris${buruk ? " aleta-perkakas-buruk" : ""}`);
        baris.appendChild(alatEl("span", "aleta-perkakas-jam", String(k.waktu).slice(11, 19)));
        baris.appendChild(alatEl("span", "aleta-perkakas-nilai", k.ringkas));
        if (k.rinci) baris.title = k.rinci;
        isiKotak.appendChild(baris);
      }
      const kosongkan = alatEl("button", "aleta-perkakas-aksi", "Kosongkan catatan");
      kosongkan.type = "button";
      kosongkan.addEventListener("click", () => {
        alatKotakKosongkan();
        alatRiwayatKosongkan();
        beritahu("Kotak hitam dan riwayat dikosongkan.");
        void gambar();
      });
      isiKotak.appendChild(kosongkan);
    }

    // Papan kesehatan diisi belakangan - ia satu-satunya yang menunggu jaringan,
    // dan menahan seluruh laci demi satu bacaan membuat lacinya terasa macet.
    try {
      const papan = await alatPapanKesehatan(pilihan);
      isiPapan.textContent = "";
      for (const b of papan) {
        const baris = alatEl("div", `aleta-perkakas-baris aleta-perkakas-${b.keadaan}`);
        baris.appendChild(alatEl("span", "aleta-perkakas-nama", b.nama));
        baris.appendChild(alatEl("span", "aleta-perkakas-nilai", b.ket));
        isiPapan.appendChild(baris);
      }
    } catch (galat) {
      isiPapan.textContent = "";
      isiPapan.appendChild(alatEl("div", "aleta-perkakas-ket", `Papan kesehatan gagal: ${(galat && galat.message) || galat}`));
    }
  }

  tombolSegar.addEventListener("click", () => void gambar());
  tombolTutup.addEventListener("click", () => {
    laci.hidden = true;
  });
  tombolSalin.addEventListener("click", async () => {
    const teks = alatLaporan(pilihan);
    const berhasil = await alatSalin(teks);
    if (berhasil) {
      beritahu("Laporan disalin. Tempel saja ke chat.");
      return;
    }
    // Papan klip ditolak peramban. Laporannya tetap harus dapat diambil -
    // ditaruh di kotak teks yang isinya sudah tersorot seluruhnya.
    const kotakTeks = alatEl("textarea", "aleta-perkakas-laporan");
    kotakTeks.value = teks;
    kotakTeks.readOnly = true;
    badan.insertBefore(kotakTeks, badan.firstChild);
    kotakTeks.focus();
    kotakTeks.select();
    beritahu("Papan klip ditolak peramban. Laporannya tersorot di atas - tekan Ctrl+C.", true);
  });

  laci.gambar = gambar;
  return laci;
}

/**
 * Tombol kunci pas di deret kepala - hanya super admin, dan hanya satu.
 *
 * Titik merah kecil muncul di atasnya ketika ada yang perlu dilihat: portal
 * menyajikan versi yang lebih baru daripada yang berjalan, atau mode kering
 * sedang aktif. Keduanya keadaan yang menjelaskan gejala aneh, dan keduanya
 * mudah terlupa.
 */
function alatTombolPerkakas(panel, wadah, opsi) {
  const pilihan = opsi || {};
  const peran = String(pilihan.peran || (panel && panel.getAttribute("data-peran")) || "");
  if (peran !== "super" && !/super/i.test(peran)) return null;
  if (wadah.querySelector(".aleta-perkakas-tombol")) return null;

  const tombol = alatEl("button", "aleta-perkakas-tombol", "⚙");
  tombol.type = "button";
  tombol.title = "Perkakas super admin: kesehatan, mode kering, kotak hitam, riwayat, penunjuk";
  tombol.setAttribute("aria-expanded", "false");

  const laci = alatLaciPerkakas(panel, pilihan);
  panel.appendChild(laci);

  tombol.addEventListener("click", () => {
    const buka = laci.hidden;
    laci.hidden = !buka;
    tombol.setAttribute("aria-expanded", buka ? "true" : "false");
    if (!buka) return;
    // Panel digulir ke puncak lebih dulu. Laci ini diletakkan absolut di
    // dalam panel yang BISA DIGULIR: kalau panelnya sedang tergulir ke
    // bawah, lacinya ikut tergeser ke atas dan kepalanya keluar dari layar.
    panel.scrollTop = 0;
    void laci.gambar();
  });

  // Titik peringatan: mode kering aktif, atau versi tertinggal.
  const tandai = () => tombol.classList.toggle("aleta-perkakas-perlu", alatKeringNyala());
  void alatMuatKering().then(tandai);

  // Versi tertinggal diperiksa sekali, diam-diam. Ekstensi yang dimuat dari
  // folder tidak pernah memperbarui dirinya sendiri, dan yang lupa menekan
  // Muat Ulang akan mencari kesalahan di portal - tempat yang salah.
  void alatVersiTertinggal().then((tertinggal) => {
    if (!tertinggal) return;
    tombol.classList.add("aleta-perkakas-perlu");
    tombol.title = `${tombol.title}

Portal menyajikan ${tertinggal.portal}, yang berjalan ${tertinggal.terpasang}. Unduh lalu tekan Muat Ulang di chrome://extensions.`;
  });

  wadah.appendChild(tombol);
  return tombol;
}

/* ─── 3e. PERBAIKAN 2 OKT 2026 - BAWAAN TAMPIL (butir 4) DAN SUDUT (butir 11) ──
 *
 * Keduanya dipasang lewat alatPasangJalanKeluar - satu-satunya pintu yang
 * dilewati KETIGA panel (portal dan ABT lewat alatPasangPanel, SIPP
 * langsung dari konten.js). Widget checklist memakai alatPasangSudut
 * sendiri (checklist.js). HANYA UI Baru: gerbangnya ditanyakan saat
 * bertindak, jadi Lama dan Baru tidak berubah satu atribut pun.
 *
 * ── Butir 4: panel terbuka atau tersembunyi saat halaman dimuat ──────────────
 *   Pengguna 2 Okt: "toggle hide/unhide DEFAULT per ALETA/SIPP/ABT di widget
 *   ekstensi; bila di-hide, ekstensi itu default TIDAK terbuka". Bawaan:
 *   ALETA tersembunyi, SIPP dan ABT terbuka. Tersembunyi = panel lahir
 *   sebagai LENCANA (logo bulat) - satu klik membentangkannya; tidak ada
 *   fitur yang hilang, dan saklar induk "aktif" tidak disentuh.
 *   Disimpan:
 *     server  setelan akun "panel.bawaan" = {aleta, sipp, abt} (PUT
 *             /ekstensi/setelan oleh popup), disinggahkan di tampilanServer
 *     lokal   chrome.storage.local "panelBawaanTampil" = {aleta, sipp, abt,
 *             diubahPada} - cadangan bila server tak terjangkau
 *   Yang lebih BARU (diubahPada) yang berlaku; tanpa keduanya = bawaan.
 *   Diterapkan SEKALI per panel per muat halaman: panel SIPP digambar ulang
 *   terus-menerus, dan yang sudah dibentangkan orang tidak boleh menciut lagi.
 *
 * ── Butir 11: klik dua kali di SUDUT panel = pindah ke sudut layar itu ──────
 *   Zona 20 px di tiap pojok DALAM panel. Mendekat (36 px, boleh dari luar
 *   panel 14 px) = sorot bayangan di pojok itu (.aleta-sudut-sorot). Klik
 *   dua kali di zona = panel pindah ke pojok layar yang sama (jarak tepi 12
 *   px) dan letaknya disimpan di kunci posisi panel itu. Klik dua kali kepala
 *   (= layar penuh) tetap: zona sudut adalah pojok kecil, dan klik dua kali
 *   di zona tidak diteruskan ke kepala. Tombol di pojok (×) tetap tombol.
 *
 *   alatPasangSudut(el, {kunci, saatPindah(sudut), wadahSorot, gerbang})
 *     sudut = "ki-at" | "ka-at" | "ki-bw" | "ka-bw"
 *     saatPindah  bila ada, dipanggil MENGGANTIKAN pemindahan bawaan
 *     wadahSorot  tempat elemen sorot (bawaan: el) - widget Shadow DOM
 *     gerbang     () => boolean tambahan (bawaan: selalu)
 */
const ALAT_BAWAAN_TAMPIL_KUNCI = "panelBawaanTampil";
const ALAT_BAWAAN_TAMPIL_SETELAN = "panel.bawaan";
const ALAT_BAWAAN_TAMPIL = { aleta: false, sipp: true, abt: true };
const ALAT_BAWAAN_SITUS = ["aleta", "sipp", "abt"];
/** Kunci posisi panel yang sudah diberi bawaannya di halaman ini. */
const alatBawaanSudah = new Set();

function alatBawaanTampilBersih(x) {
  const hasil = {};
  if (!x || typeof x !== "object" || Array.isArray(x)) return hasil;
  for (const s of ALAT_BAWAAN_SITUS) if (typeof x[s] === "boolean") hasil[s] = x[s];
  return hasil;
}

/**
 * Pilihan yang berlaku dari cadangan lokal {aleta,sipp,abt,diubahPada} dan
 * setelan akun {nilai:{...}, diubahPada}: yang lebih baru menang; ruas yang
 * tidak disebut = bawaan. Pulang {aleta, sipp, abt, sumber}.
 */
function alatBawaanTampilBerlaku(lokal, server) {
  const l = lokal && typeof lokal === "object" ? lokal : null;
  const s = server && typeof server === "object" && server.nilai && typeof server.nilai === "object" ? server : null;
  const waktu = (x) => {
    const t = Date.parse(String((x && x.diubahPada) || ""));
    return Number.isFinite(t) ? t : 0;
  };
  let pilih = null;
  let sumber = "bawaan";
  if (s && (!l || waktu(s) >= waktu(l))) {
    pilih = alatBawaanTampilBersih(s.nilai);
    sumber = "akun";
  } else if (l) {
    pilih = alatBawaanTampilBersih(l);
    sumber = "lokal";
  }
  return { ...ALAT_BAWAAN_TAMPIL, ...(pilih || {}), sumber };
}

async function alatBacaBawaanTampil() {
  let lokal = null;
  try {
    const s = await chrome.storage.local.get([ALAT_BAWAAN_TAMPIL_KUNCI]);
    lokal = s && s[ALAT_BAWAAN_TAMPIL_KUNCI];
  } catch {
    lokal = null;
  }
  const server = typeof alatSetelanTersinggah === "function" ? alatSetelanTersinggah(ALAT_BAWAAN_TAMPIL_SETELAN) : undefined;
  return alatBawaanTampilBerlaku(lokal, server);
}

/** "aleta" | "sipp" | "abt" dari kunci posisi panel, atau dari alamat halaman. */
function alatSitusPanel(kunci) {
  const k = String(kunci || "");
  if (k === "posisiPanelAleta") return "aleta";
  if (/^posisiPanelAbt/.test(k)) return "abt";
  if (k === "posisiPanel") return "sipp";
  try {
    const jalur = String(location.pathname || "");
    if (/^\/aleta(?:\/|$)/.test(jalur)) return "aleta";
    if (/\/aps_badilag\//.test(jalur)) return "abt";
    if (/\/SIPP(?:\/|$)/i.test(jalur)) return "sipp";
  } catch {
    /* tanpa alamat: tidak dikenali */
  }
  return "";
}

let alatUjiSiapJanji = null;
/** Janji yang selesai sesudah tampilan (Lama/Baru/UI Baru) terbaca. */
function alatUjiSiap() {
  return alatUjiSiapJanji || Promise.resolve();
}

/**
 * Butir 4: panel situs yang disetel TERSEMBUNYI lahir sebagai lencana -
 * sekali per kunci per muat halaman, hanya UI Baru. Pulang true bila diciutkan.
 */
async function alatTerapkanBawaanTampil(panel, kunci, opsi) {
  const o = opsi || {};
  const k = String(kunci || "");
  if (!panel || alatBawaanSudah.has(k)) return false;
  await alatUjiSiap();
  if (alatUjiMode() !== "ui") return false;
  const situs = alatSitusPanel(k);
  if (!situs) return false;
  // Ditandai SEBELUM menunggu penyimpanan: panel SIPP yang digambar ulang
  // selama bacaan berjalan tidak boleh ikut diciutkan dua kali.
  if (alatBawaanSudah.has(k)) return false;
  alatBawaanSudah.add(k);
  const b = await alatBacaBawaanTampil();
  if (b[situs] !== false) return false;
  // Panel yang baru disusun kadang belum masuk halaman.
  for (let i = 0; i < 40 && !panel.isConnected; i += 1) await alatJeda(50);
  if (!panel.isConnected || panel.classList.contains(KELAS_LENCANA)) return false;
  try {
    if (typeof o.ciutkan === "function") o.ciutkan();
    else alatCiutkan(panel, k, true);
    panel.setAttribute("data-aleta-bawaan-tersembunyi", "ya");
    return true;
  } catch {
    return false;
  }
}

// ── Butir 11: sudut ─────────────────────────────────────────────────────────

const ALAT_SUDUT_ZONA = 20;
const ALAT_SUDUT_DEKAT = 36;
const ALAT_SUDUT_LUAR = 14;
const ALAT_SUDUT_TEPI = 12;
/** Sisi kotak sorot (px) - rupanya di blok W2 panel.css dan GAYA checklist.js. */
const ALAT_SUDUT_SOROT = 44;
const ALAT_SUDUT_NAMA = { "ki-at": "kiri atas", "ka-at": "kanan atas", "ki-bw": "kiri bawah", "ka-bw": "kanan bawah" };
/** Yang bukan sudut walau di pojok: kendali tetap kendali. */
const ALAT_SUDUT_BUKAN = "button, a[href], input, select, textarea, summary, label, [contenteditable='true']";
const alatSudutDaftar = [];
let alatSudutDengar = false;

/** Sudut kotak terdekat dari titik (x,y) bila dalam `dekat` px (dan paling jauh `luar` px di luar kotak). */
function alatSudutDari(kotak, x, y, dekat, luar) {
  if (!kotak || !Number.isFinite(x) || !Number.isFinite(y)) return "";
  // Kotak tanpa ukuran (panel belum tertata) tidak punya sudut: tanpa ini
  // setiap klik di titik (0,0) terbaca sebagai "pojok".
  if (!(kotak.right - kotak.left > 0) || !(kotak.bottom - kotak.top > 0)) return "";
  const lebarLuar = Number.isFinite(luar) ? luar : 0;
  const dKiri = x - kotak.left;
  const dKanan = kotak.right - x;
  const dAtas = y - kotak.top;
  const dBawah = kotak.bottom - y;
  const dalam = (d) => d >= -lebarLuar && d <= dekat;
  const h = dalam(dKiri) && (!dalam(dKanan) || dKiri <= dKanan) ? "ki" : dalam(dKanan) ? "ka" : "";
  const v = dalam(dAtas) && (!dalam(dBawah) || dAtas <= dBawah) ? "at" : dalam(dBawah) ? "bw" : "";
  return h && v ? `${h}-${v}` : "";
}

function alatSudutTerlabuh(el) {
  try {
    if ((window.innerWidth || 0) < 1100) return false;
    const akar = document.documentElement;
    if (el.id === "aleta-panel-portal" && akar.getAttribute("data-aleta-portal-letak") === "samping") return true;
    if (el.id === "aleta-panel-sipp" && akar.getAttribute("data-aleta-sipp-labuh") === "kanan") return true;
  } catch {
    /* tanpa keterangan: anggap mengambang */
  }
  return false;
}

function alatSudutBoleh(entri) {
  const el = entri.el;
  if (!el || !el.isConnected) return false;
  if (alatUjiMode() !== "ui") return false;
  if (el.classList && (el.classList.contains(KELAS_LENCANA) || el.classList.contains("aleta-panel-penuh"))) return false;
  // Panel yang BERLABUH (letak samping portal, labuh kanan SIPP UI Baru; CSS
  // !important di layar >= 1100 px) tidak dapat dipindah ke sudut - kecuali
  // pemiliknya memberi saatPindah sendiri (yang melepas labuhnya).
  if (!entri.saatPindah && alatSudutTerlabuh(el)) return false;
  if (typeof entri.gerbang === "function") {
    try {
      if (!entri.gerbang()) return false;
    } catch {
      return false;
    }
  }
  return true;
}

function alatSudutSorot(entri, sudut) {
  const wadah = entri.wadahSorot || entri.el;
  let sorot = entri.sorot;
  if (!sudut) {
    if (sorot) sorot.remove();
    entri.sorot = null;
    entri.el.removeAttribute("data-aleta-sudut-dekat");
    return;
  }
  if (!sorot || !sorot.isConnected) {
    sorot = document.createElement("div");
    sorot.className = "aleta-sudut-sorot";
    sorot.setAttribute("aria-hidden", "true");
    const ket = document.createElement("span");
    ket.className = "aleta-sudut-ket";
    sorot.appendChild(ket);
    wadah.appendChild(sorot);
    entri.sorot = sorot;
  }
  sorot.setAttribute("data-sudut", sudut);
  sorot.firstChild.textContent = "2×";
  sorot.title = `Klik dua kali: pindahkan ke ${ALAT_SUDUT_NAMA[sudut] || "sudut ini"}`;
  // Fixed, dihitung dari kotak panel: tidak ikut tergulung isi panel.
  const kotak = entri.el.getBoundingClientRect();
  const U = ALAT_SUDUT_SOROT;
  sorot.style.position = "fixed";
  sorot.style.left = `${Math.round(sudut.startsWith("ki") ? kotak.left : kotak.right - U)}px`;
  sorot.style.top = `${Math.round(sudut.endsWith("at") ? kotak.top : kotak.bottom - U)}px`;
  entri.el.setAttribute("data-aleta-sudut-dekat", sudut);
}

/** Pemindahan bawaan: ke pojok layar, letak disimpan (digabung) di kunci posisi panel. */
function alatSudutPindahkan(panel, kunci, sudut) {
  const kotak = panel.getBoundingClientRect();
  const lebar = kotak.width || panel.offsetWidth || 320;
  const tinggi = kotak.height || panel.offsetHeight || 200;
  const T = ALAT_SUDUT_TEPI;
  const kiri = Math.max(0, sudut.startsWith("ki") ? T : (window.innerWidth || 0) - lebar - T);
  const atas = Math.max(0, sudut.endsWith("at") ? T : (window.innerHeight || 0) - tinggi - T);
  panel.style.left = `${Math.round(kiri)}px`;
  panel.style.top = `${Math.round(atas)}px`;
  panel.style.right = "auto";
  panel.style.bottom = "auto";
  if (kunci) {
    void Promise.resolve()
      .then(() => chrome.storage.local.get([kunci]))
      .then((s) => {
        const lama = s && s[kunci] && typeof s[kunci] === "object" ? s[kunci] : {};
        return chrome.storage.local.set({ [kunci]: { ...lama, kiri: Math.round(kiri), atas: Math.round(atas) } });
      })
      .catch(() => {
        /* berlaku untuk halaman ini saja */
      });
  }
  return { kiri: Math.round(kiri), atas: Math.round(atas) };
}

function alatSudutCari(x, y, dekat, luar) {
  for (let i = alatSudutDaftar.length - 1; i >= 0; i -= 1) {
    const entri = alatSudutDaftar[i];
    if (!entri.el.isConnected) {
      if (entri.sorot) entri.sorot.remove();
      alatSudutDaftar.splice(i, 1);
      continue;
    }
    if (!alatSudutBoleh(entri)) continue;
    const sudut = alatSudutDari(entri.el.getBoundingClientRect(), x, y, dekat, luar);
    if (sudut) return { entri, sudut };
  }
  return null;
}

function alatSudutDengarDokumen() {
  if (alatSudutDengar) return;
  alatSudutDengar = true;
  let bingkai = 0;
  let titik = null;
  const periksa = () => {
    bingkai = 0;
    if (!titik) return;
    const kena = alatSudutCari(titik.x, titik.y, ALAT_SUDUT_DEKAT, ALAT_SUDUT_LUAR);
    for (const entri of alatSudutDaftar) {
      const sudut = kena && kena.entri === entri ? kena.sudut : "";
      if ((entri.el.getAttribute("data-aleta-sudut-dekat") || "") !== sudut) alatSudutSorot(entri, sudut);
    }
  };
  try {
    document.addEventListener(
      "pointermove",
      (e) => {
        titik = { x: e.clientX, y: e.clientY };
        if (bingkai) return;
        bingkai = typeof requestAnimationFrame === "function" ? requestAnimationFrame(periksa) : setTimeout(periksa, 16);
      },
      { passive: true, capture: true }
    );
  } catch {
    /* tanpa sorot: klik dua kali di sudut tetap bekerja */
  }
}

/** Butir 11 - lihat catatan bagian ini. Aman dipanggil berulang untuk elemen yang sama. */
function alatPasangSudut(el, opsi) {
  if (!el || typeof el.addEventListener !== "function") return null;
  if (alatSudutDaftar.some((x) => x.el === el)) return el;
  const o = opsi || {};
  const entri = {
    el,
    kunci: String(o.kunci || ""),
    saatPindah: typeof o.saatPindah === "function" ? o.saatPindah : null,
    wadahSorot: o.wadahSorot || null,
    gerbang: o.gerbang,
    sorot: null,
  };
  alatSudutDaftar.push(entri);
  alatSudutDengarDokumen();
  const diZona = (e) => {
    if (!alatSudutBoleh(entri)) return "";
    const path = typeof e.composedPath === "function" ? e.composedPath() : [];
    const sasaran = path[0] && path[0].nodeType === 1 ? path[0] : e.target;
    if (sasaran && sasaran !== el && typeof sasaran.closest === "function" && sasaran.closest(ALAT_SUDUT_BUKAN)) return "";
    return alatSudutDari(el.getBoundingClientRect(), e.clientX, e.clientY, ALAT_SUDUT_ZONA, 0);
  };
  // Fase TANGKAP, didaftarkan sebelum klik dua kali kepala (alatPasangKlikGandaKepala
  // dipasang sesudah pintu ini): sudut menang, kepala tidak ikut ke layar penuh.
  el.addEventListener(
    "dblclick",
    (e) => {
      const sudut = diZona(e);
      if (!sudut) return;
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
      try {
        if (entri.saatPindah) entri.saatPindah(sudut);
        else alatSudutPindahkan(el, entri.kunci, sudut);
      } catch {
        /* panel tetap di tempatnya */
      }
      alatSudutSorot(entri, "");
      try {
        el.dispatchEvent(new CustomEvent("aleta-sudut-pindah", { bubbles: true, detail: { sudut, kunci: entri.kunci } }));
      } catch {
        /* tanpa kabar, pemindahan tetap berlaku */
      }
      try {
        const pilihan = window.getSelection ? window.getSelection() : null;
        if (pilihan) pilihan.removeAllRanges();
      } catch {
        /* kosmetik */
      }
    },
    true
  );
  return el;
}

// Pemantau dipasang saat berkas ini dimuat, bukan saat panel digambar:
// permintaan paling awal - pembacaan konteks perkara - berangkat sebelum
// panelnya ada, dan justru itu yang paling sering gagal.
alatPasangPemantauAmbil();
alatDengarkanKering();
void alatMuatKering();
alatDengarkanUji();
// Senyap dibaca SESUDAH uji tampilan: ia bergantung pada saklar fitur popup-12.
alatDengarkanSenyap();
// alatUjiSiapJanji: bawaan tampil (butir 4, 2 Okt) menunggu tampilan terbaca.
alatUjiSiapJanji = alatMuatUji();
void alatUjiSiapJanji
  .then(() => alatMuatSenyap())
  // Sesudah singgahan terbaca: yang sudah segar tidak diminta lagi.
  .then(() => alatSegarkanTampilanServer(false));
// Panel ringkas dipasang di tingkat modul atas sebab yang sama: berkas ini
// dimuat lebih dulu daripada konten.js, abt.js, dan aleta.js pada keempat
// konteks, jadi penandanya sudah terpasang sebelum satu panel pun digambar -
// dan tidak ada kedipan keterangan yang muncul lalu hilang.
alatDengarkanRingkas();
void alatMuatRingkas();
// Penjelasan teknis (K5): sebab yang sama - penandanya sudah ada sebelum
// panel pertama digambar. Gerbang tampilannya ikut alatTandaiUji.
alatDengarkanTeknis();
void alatMuatTeknis();

/*
 * ============================================================================
 * TIPE KELUARAN DARI PORTAL - DENGAN SINGGAHAN, LALU TERTANAM (K7)
 * ============================================================================
 *
 * Empat daftar yang dulu hanya tertanam di ekstensi (medan borang putusan,
 * peta blangko, padanan jenis, pilihan alasan saksi) kini dapat ditambah dan
 * dimatikan dari portal. Ekstensi membacanya lewat SATU rute
 * (/ekstensi/tipe-keluaran), yang menjawab keempatnya sekaligus berikut
 * versinya: 16 hex yang berubah setiap kali satu entri berubah.
 *
 * Urutan pakai, dan alasannya:
 *
 *   1. singgahan dengan versi SAMA   - 0 permintaan. Versi yang berlaku
 *                                      diketahui dari /ekstensi/siapa
 *                                      (alatSetelVersiTipe) atau dari jawaban
 *                                      portal sebelumnya di halaman ini.
 *   2. portal                        - tepat 1 permintaan, lalu disinggahkan.
 *   3. singgahan lama                - portal gagal: tambahan yang sudah sah
 *                                      TIDAK boleh hilang dari layar hanya
 *                                      karena portal sedang dibangun ulang.
 *   4. tertanam                      - konstanta di berkas ini; perilakunya
 *                                      sama persis dengan sebelum portal ada.
 *
 * Setiap entri dari portal atau singgahan diperiksa LAGI di sini. Portal sudah
 * memeriksanya waktu disahkan, tetapi singgahan dapat disunting tangan lewat
 * penyimpanan ekstensi, dan satu penunjuk tombol Simpan yang lolos ke panel
 * borang putusan berarti panel menekan Simpan - itu yang tidak pernah boleh
 * terjadi. Yang dibuang disebut di konsol beserta alasannya; tidak diam.
 */
const ALAT_TIPE_KUNCI = "tipeKeluaran";
const ALAT_TIPE_ALAMAT = "/aleta/api/aleta-ecourt/ekstensi/tipe-keluaran";
const ALAT_TIPE_DAFTAR = [
  "putusan.medan-borang",
  "putusan.peta-blangko",
  "putusan.padanan-jenis",
  "bas.saksi.alasan-pilihan",
];
const ALAT_TIPE_POLA_VERSI = /^[0-9a-f]{16}$/;
/** Batas bacaan: portal yang menggantung tidak boleh menahan panel sembilan detik. */
const ALAT_TIPE_BATAS_MS = 5000;
/** Portal yang baru saja gagal tidak ditanya lagi sebelum ini lewat. */
const ALAT_TIPE_JEDA_GAGAL_MS = 60000;
/** Sama dengan penyaring bot (K6): lebih dari ini bukan daftar, melainkan kekeliruan. */
const ALAT_TIPE_MAKS_ENTRI = 200;
const ALAT_TIPE_MAKS_NILAI = 400;
/** Sama dengan validasi portal untuk putusan.medan-borang. */
const ALAT_TIPE_POLA_PENUNJUK_NAMA = /^[a-z]*\[name="[A-Za-z0-9_-]+(\[\])?"\]$/;
const ALAT_TIPE_POLA_PENUNJUK_ID = /^#[A-Za-z][\w-]*$/;

/**
 * Versi tipe keluaran yang berlaku menurut portal.
 *   undefined = belum diketahui (tanya portal sekali)
 *   null      = portal menyatakan tabelnya tak terbaca (jangan bertanya)
 *   '16 hex'  = versi yang berlaku
 */
let alatVersiTipeKini;
/** Waktu portal terakhir gagal menjawab, dan versi yang waktu itu dicari. */
let alatTipeGagal = { pada: 0, versi: undefined };
/** Permintaan yang sedang terbang - dua pemanggil sejajar berbagi satu. */
let alatTipeTerbang = null;

/** Dipanggil oleh pembaca /ekstensi/siapa dengan ruas versiTipe-nya. */
function alatSetelVersiTipe(versi) {
  if (versi === null) {
    alatVersiTipeKini = null;
    return null;
  }
  const v = String(versi || "").trim();
  alatVersiTipeKini = ALAT_TIPE_POLA_VERSI.test(v) ? v : undefined;
  return alatVersiTipeKini;
}

/** Semua teks di dalam satu nilai (nilai, data bersarang, daftar). */
function alatTipeTeksDi(nilai, hasil) {
  if (typeof nilai === "string") hasil.push(nilai);
  else if (Array.isArray(nilai)) for (const x of nilai) alatTipeTeksDi(x, hasil);
  else if (nilai && typeof nilai === "object") for (const x of Object.values(nilai)) alatTipeTeksDi(x, hasil);
  return hasil;
}

/**
 * Alasan satu entri ditolak, atau "" bila sah. Aturannya aturan portal yang
 * dapat diperiksa tanpa basis data: tanpa '${', '<', baris baru; untuk medan
 * borang, penunjuknya harus [name="..."] atau #id dan tidak pernah menunjuk
 * tombol Simpan atau submit.
 */
function alatTipeAlasanTolak(daftar, e) {
  if (!e || typeof e !== "object") return "bukan entri";
  if (typeof e.kunci !== "string" || typeof e.nilai !== "string") return "kunci/nilai bukan teks";
  if (e.data !== undefined && e.data !== null && (typeof e.data !== "object" || Array.isArray(e.data))) {
    return "data bukan objek";
  }
  if ([...e.nilai].length > ALAT_TIPE_MAKS_NILAI) return `nilai lebih dari ${ALAT_TIPE_MAKS_NILAI} huruf`;
  for (const teks of alatTipeTeksDi([e.kunci, e.nilai, e.data || {}], [])) {
    if (teks.includes("${")) return "memuat '${'";
    if (teks.includes("<")) return "memuat '<'";
    if (/[\r\n]/.test(teks)) return "memuat baris baru";
  }
  const data = e.data || {};
  if (daftar === "putusan.medan-borang") {
    const p = data.penunjuk;
    if (typeof p !== "string" || !p || p.length > 300) return "penunjuk kosong atau terlalu panjang";
    if (/simpan|submit/i.test(p)) return "penunjuk tombol Simpan/submit";
    if (!ALAT_TIPE_POLA_PENUNJUK_NAMA.test(p) && !ALAT_TIPE_POLA_PENUNJUK_ID.test(p)) return "bentuk penunjuk tidak dikenal";
  }
  if (daftar === "putusan.peta-blangko") {
    if (!e.kunci || e.kunci !== e.kunci.replace(/\s+/g, " ").trim().toLowerCase()) return "kunci jenis tidak baku";
    if (!e.nilai.trim()) return "berkas blangko kosong";
    if (typeof data.jenisAsli !== "string" || !data.jenisAsli.trim()) return "jenisAsli kosong";
    if (data.blangkoLain !== undefined && (!Array.isArray(data.blangkoLain) || data.blangkoLain.some((x) => typeof x !== "string" || !x))) {
      return "blangkoLain bukan daftar teks";
    }
  }
  if (daftar === "putusan.padanan-jenis" && (!e.kunci.trim() || !e.nilai.trim())) return "kunci atau nama lain kosong";
  return "";
}

/**
 * Entri yang lolos, dalam urutannya. Yang dibuang dilaporkan di konsol
 * dengan alasannya - penyaring yang membuang diam-diam sama buruknya dengan
 * entri rusak yang lolos, sebab yang kehilangan barisnya tidak tahu sebabnya.
 */
function alatTipeSaring(daftar, entri, asal) {
  const masuk = Array.isArray(entri) ? entri : [];
  const lolos = [];
  const tolak = [];
  for (const e of masuk) {
    const alasan = alatTipeAlasanTolak(daftar, e);
    if (alasan) {
      tolak.push(`${String(e && e.nilai).slice(0, 60)} (${alasan})`);
      continue;
    }
    if (lolos.length >= ALAT_TIPE_MAKS_ENTRI) {
      tolak.push(`${e.nilai.slice(0, 60)} (melebihi ${ALAT_TIPE_MAKS_ENTRI} entri)`);
      continue;
    }
    lolos.push({
      kunci: e.kunci,
      nilai: e.nilai,
      data: e.data && typeof e.data === "object" ? JSON.parse(JSON.stringify(e.data)) : {},
      urutan: Number.isFinite(Number(e.urutan)) ? Number(e.urutan) : lolos.length,
      asal: typeof e.asal === "string" ? e.asal : "bawaan",
      sidik: typeof e.sidik === "string" ? e.sidik : "",
    });
  }
  if (tolak.length) {
    console.warn(`[ALETA] Tipe keluaran ${daftar} (${asal}): ${tolak.length} entri dibuang - ${tolak.join("; ")}`);
  }
  return { entri: lolos, dibuang: tolak.length };
}

/** Entri tertanam untuk peta blangko - dibentuk dari ALAT_PETA_BAWAAN. */
function alatTipeTertanamPeta() {
  return Object.entries(ALAT_PETA_BAWAAN).map(([kunci, b], urutan) => {
    const data = { jenisAsli: b.jenisAsli };
    if (b.statusAsli) data.statusAsli = b.statusAsli; // P 12 Okt: baris status cerai bawaan
    if (b.blangko) data.blangko = b.blangko;
    if (b.blangkoLain) data.blangkoLain = [...b.blangkoLain];
    if (b.catatan) data.catatan = b.catatan;
    return { kunci, nilai: b.berkas, data, urutan, asal: "bawaan", sidik: "" };
  });
}

/** Entri tertanam untuk padanan jenis - dibentuk dari ALAT_PADANAN_JENIS. */
function alatTipeTertanamPadanan() {
  const hasil = [];
  for (const [baku, lain] of ALAT_PADANAN_JENIS) {
    for (const nilai of lain) hasil.push({ kunci: baku, nilai, data: {}, urutan: hasil.length, asal: "bawaan", sidik: "" });
  }
  return hasil;
}

const ALAT_TIPE_TERTANAM = {
  "putusan.peta-blangko": alatTipeTertanamPeta,
  "putusan.padanan-jenis": alatTipeTertanamPadanan,
};

async function alatTipeBacaSinggahan() {
  try {
    const simpan = await chrome.storage.local.get([ALAT_TIPE_KUNCI]);
    const s = simpan && simpan[ALAT_TIPE_KUNCI];
    if (!s || typeof s !== "object" || !s.isi || typeof s.isi !== "object") return null;
    return s;
  } catch (galat) {
    console.warn("[ALETA] Singgahan tipe keluaran tidak terbaca:", galat);
    return null;
  }
}

async function alatTipeTulisSinggahan(versi, isi) {
  try {
    await chrome.storage.local.set({ [ALAT_TIPE_KUNCI]: { versi, pada: new Date().toISOString(), isi } });
    return true;
  } catch (galat) {
    console.warn("[ALETA] Singgahan tipe keluaran tidak tersimpan:", galat);
    return false;
  }
}

/**
 * Satu permintaan ke portal. Pulang {versi, isi} atau melempar dengan
 * sebabnya. Jawaban 200 yang bentuknya salah dihitung GAGAL - memakainya
 * akan menimpa singgahan yang baik dengan kekosongan.
 */
async function alatTipeTanyaPortal() {
  const respons = await alatAmbil(
    ALAT_TIPE_ALAMAT,
    { credentials: "include", cache: "no-store", batasMs: ALAT_TIPE_BATAS_MS },
    "Membaca tipe keluaran dari ALETA"
  );
  if (!respons || !respons.ok) throw new Error(`portal menjawab ${respons ? respons.status : "kosong"}`);
  const luar = await respons.json();
  const isi = luar && luar.ok === undefined && luar.data ? luar.data : luar;
  if (!isi || isi.ok !== true) throw new Error("jawaban portal tidak ok");
  const versi = String(isi.versi || "");
  if (!ALAT_TIPE_POLA_VERSI.test(versi)) throw new Error("versi tipe keluaran tidak sah");
  if (!isi.daftar || typeof isi.daftar !== "object") throw new Error("jawaban tanpa daftar");
  const daftar = {};
  for (const k of ALAT_TIPE_DAFTAR) if (Array.isArray(isi.daftar[k])) daftar[k] = isi.daftar[k];
  return { versi, isi: daftar };
}

/**
 * Entri efektif satu daftar untuk ekstensi.
 *
 *   daftar  salah satu dari empat daftar ekstensi
 *   opsi    {versiTipe?, tertanam?}
 *           versiTipe  versi yang berlaku (bila tidak disebut, dipakai yang
 *                      disetel alatSetelVersiTipe atau jawaban portal terakhir)
 *           tertanam   entri cadangan terakhir, untuk daftar yang konstantanya
 *                      tinggal di berkas lain (konten.js, abt.js). Peta blangko
 *                      dan padanan jenis membawa tertanamnya sendiri.
 *
 * Pulang {entri, asal: 'portal'|'singgahan'|'tertanam', versi, dibuang}.
 */
async function alatTipeKeluaran(daftar, opsi) {
  if (!ALAT_TIPE_DAFTAR.includes(daftar)) {
    throw new Error(`Daftar tipe keluaran "${String(daftar)}" tidak dibaca ekstensi.`);
  }
  const pilihan = opsi || {};
  const sumberTertanam = pilihan.tertanam !== undefined ? pilihan.tertanam : ALAT_TIPE_TERTANAM[daftar];
  if (sumberTertanam === undefined) {
    // Tanpa cadangan terakhir, portal yang mati akan membuat daftar ini kosong
    // tanpa satu pun tanda. Lebih baik pemanggilnya patah sekarang, di uji.
    throw new Error(`Daftar "${daftar}" tidak punya tertanam - sebutkan opsi.tertanam.`);
  }
  const tertanam = () => {
    const mentah = typeof sumberTertanam === "function" ? sumberTertanam() : sumberTertanam;
    return { ...alatTipeSaring(daftar, mentah, "tertanam"), asal: "tertanam", versi: null };
  };
  const dariSinggahan = (s) => {
    if (!s || !Array.isArray(s.isi[daftar])) return null;
    return { ...alatTipeSaring(daftar, s.isi[daftar], "singgahan"), asal: "singgahan", versi: s.versi || null };
  };

  const versiDiminta = Object.prototype.hasOwnProperty.call(pilihan, "versiTipe")
    ? pilihan.versiTipe === null
      ? null
      : ALAT_TIPE_POLA_VERSI.test(String(pilihan.versiTipe || ""))
        ? String(pilihan.versiTipe)
        : undefined
    : alatVersiTipeKini;

  const singgahan = await alatTipeBacaSinggahan();
  // 1. Singgahan dengan versi sama - tanpa permintaan.
  if (singgahan && versiDiminta && singgahan.versi === versiDiminta) {
    const hasil = dariSinggahan(singgahan);
    if (hasil) return hasil;
  }

  // 2. Portal - kecuali ia sudah menyatakan tabelnya tak terbaca, atau baru
  //    saja gagal untuk versi yang sama.
  const baruGagal =
    alatTipeGagal.pada > 0 &&
    Date.now() - alatTipeGagal.pada < ALAT_TIPE_JEDA_GAGAL_MS &&
    alatTipeGagal.versi === versiDiminta;
  if (versiDiminta !== null && !baruGagal) {
    try {
      if (!alatTipeTerbang) {
        alatTipeTerbang = alatTipeTanyaPortal().finally(() => {
          alatTipeTerbang = null;
        });
      }
      const jawab = await alatTipeTerbang;
      alatVersiTipeKini = jawab.versi;
      alatTipeGagal = { pada: 0, versi: undefined };
      await alatTipeTulisSinggahan(jawab.versi, jawab.isi);
      if (Array.isArray(jawab.isi[daftar])) {
        return { ...alatTipeSaring(daftar, jawab.isi[daftar], "portal"), asal: "portal", versi: jawab.versi };
      }
      console.warn(`[ALETA] Portal tidak mengirim daftar ${daftar}; dipakai cadangan.`);
    } catch (galat) {
      alatTipeGagal = { pada: Date.now(), versi: versiDiminta };
      console.warn(`[ALETA] Tipe keluaran tidak terbaca dari portal (${String((galat && galat.message) || galat)}); dipakai cadangan.`);
    }
  }

  // 3. Singgahan lama, 4. tertanam.
  return dariSinggahan(singgahan) || tertanam();
}

/*
 * ============================================================================
 * PUTUSAN MASSAL - FONDASI YANG DIPAKAI PANEL ABT DAN PANEL SIPP
 * ============================================================================
 *
 * Tiga hal tinggal di sini karena keduanya memakainya:
 *
 *   1. PEMETAAN BLANGKO  jenis perkara -> blangko ABT mana (a/b token, nama)
 *   2. ANTREAN MASSAL    daftar perkara yang sedang dikerjakan, beserta
 *                        keadaan tiap butirnya - di chrome.storage, sebab
 *                        tab ABT dan tab SIPP beda asal dan sessionStorage
 *                        tidak menyeberang
 *   3. JADWAL SIDANG     sidang pada satu tanggal, dari ALETA - sumber
 *                        "hari ini / pilih tanggal"
 *
 * Yang SENGAJA tidak ada di sini: penentuan "perkara ini siap diputus".
 * Agenda sidang tidak dapat dipercaya sebagai penentu - layanan jadwal
 * sendiri mencatat sidang ikrar beragenda "Musyawarah Majelis" - jadi ALETA
 * menyodorkan kandidat beserta keterangannya, dan orang yang memutuskan.
 */

/* ─── 1. PEMETAAN BLANGKO ───────────────────────────────────────────────── */
const ALAT_PETA_BLANGKO_KUNCI = "petaBlangkoPutusan";

/**
 * Jenis perkara yang lazim di Pengadilan Agama, sebagai baris awal editor.
 * Jenis lain yang muncul dari jadwal sidang ditambahkan sendiri saat tampil.
 */
const ALAT_JENIS_LAZIM = [
  "Cerai Gugat",
  "Cerai Talak",
  "Dispensasi Kawin",
  "Itsbat Nikah",
  "Penetapan Ahli Waris",
  "Perwalian",
  "Wali Adhal",
  "Poligami",
  "Harta Bersama",
  "Kewarisan",
  "Pengangkatan Anak",
  "Asal Usul Anak",
];

/**
 * ============================================================================
 * SIPP MENAMAI JENIS PERKARA DENGAN KATA YANG LAIN
 * ============================================================================
 *
 * Pemetaan blangko berkunci nama jenis perkara apa adanya dari SIPP. Selama
 * namanya sama dengan yang kita daftar, ia bekerja. Diukur atas sipp_donggala
 * (salinan server, 14 September 2026), perkara sejak 2025 - empat tidak sama:
 *
 *   Pengesahan Perkawinan/Istbat Nikah   403 perkara   kita: "itsbat nikah"
 *   P3HP/Penetapan Ahli Waris             26 perkara   kita: "penetapan ahli waris"
 *   Izin Poligami                          1 perkara   kita: "poligami"
 *   Wali Adhol                             1 perkara   kita: "wali adhal"
 *
 * 431 perkara, dan yang pertama adalah jenis KEDUA TERBANYAK di pengadilan
 * ini. Seluruhnya dilewati putusan massal dengan alasan "blangko belum
 * dipetakan" - kalimat yang benar menurut kodenya dan menyesatkan menurut
 * kenyataannya, sebab blangkonya SUDAH dipetakan, hanya di bawah nama lain.
 *
 * Yang keempat bukan singkatan melainkan EJAAN: "Wali Adhol" dan "Wali
 * Adhal". Tidak ada aturan umum yang dapat menyatukan keduanya tanpa juga
 * menyatukan kata yang memang berbeda - maka daftarnya ditulis satu per satu,
 * dan tiap tambahan harus datang dari nama yang BENAR-BENAR ada di SIPP,
 * bukan dari dugaan tentang nama yang mungkin ada.
 */
const ALAT_PADANAN_JENIS = [
  [
    "itsbat nikah",
    [
      "pengesahan perkawinan/istbat nikah",
      "pengesahan perkawinan/itsbat nikah",
      "pengesahan perkawinan",
      "istbat nikah",
      "isbat nikah",
    ],
  ],
  ["penetapan ahli waris", ["p3hp/penetapan ahli waris", "p3hp"]],
  ["poligami", ["izin poligami"]],
  ["wali adhal", ["wali adhol", "wali adlal"]],
];

/**
 * Padanan yang BERLAKU - mula-mula yang tertanam, lalu yang dari portal
 * (putusan.padanan-jenis) sesudah alatMuatPadananJenis. alatKunciJenis
 * serempak dan dipanggil di banyak tempat, jadi yang dibaca adalah salinan
 * di memori; pembaruannya asinkron dan terjadi sebelum peta blangko dimuat.
 */
let alatPadananBerlaku = ALAT_PADANAN_JENIS;

/** nama lain -> kunci baku. Disusun sekali tiap padanan berganti. */
function alatSusunPetaPadanan(padanan) {
  const peta = new Map();
  for (const [baku, lain] of padanan) for (const n of lain) peta.set(n, baku);
  return peta;
}
let alatPetaPadanan = alatSusunPetaPadanan(ALAT_PADANAN_JENIS);

/**
 * Entri putusan.padanan-jenis -> bentuk ALAT_PADANAN_JENIS, urutan baku
 * menurut kemunculan pertama. Urutan jawaban portal DIPAKAI apa adanya (bawaan
 * dulu, lalu tambahan) - portal yang menetapkannya, bukan ruas urutan.
 */
function alatPadananDariEntri(entri) {
  const rapi = (x) => String(x || "").replace(/\s+/g, " ").trim().toLowerCase();
  const kelompok = new Map();
  for (const e of entri) {
    const baku = rapi(e.kunci);
    const lain = rapi(e.nilai);
    if (!baku || !lain || lain === baku) continue;
    if (!kelompok.has(baku)) kelompok.set(baku, []);
    if (!kelompok.get(baku).includes(lain)) kelompok.get(baku).push(lain);
  }
  return [...kelompok.entries()];
}

/**
 * Padanan dimuat dari tipe keluaran (portal, singgahan, atau tertanam) dan
 * dipasang untuk alatKunciJenis. Pulang {padanan, asal}.
 */
async function alatMuatPadananJenis(opsi) {
  const hasil = await alatTipeKeluaran("putusan.padanan-jenis", opsi);
  const padanan = hasil.asal === "tertanam" ? ALAT_PADANAN_JENIS : alatPadananDariEntri(hasil.entri);
  alatPadananBerlaku = padanan;
  alatPetaPadanan = alatSusunPetaPadanan(padanan);
  return { padanan, asal: hasil.asal };
}

/**
 * Kunci pemetaan: nama jenis dirapikan supaya "Cerai gugat" dan "CERAI GUGAT"
 * satu, lalu dipadankan supaya nama SIPP yang berbeda menunjuk kunci yang sama.
 */
function alatKunciJenis(jenis) {
  const bersih = String(jenis || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  return alatPetaPadanan.get(bersih) || bersih;
}

/** Nama lain yang menunjuk kunci ini - untuk disebut di layar. */
function alatNamaLainJenis(kunci) {
  const baris = alatPadananBerlaku.find(([baku]) => baku === kunci);
  return baris ? baris[1] : [];
}

async function alatMuatPetaBlangko() {
  try {
    const simpan = await chrome.storage.local.get([ALAT_PETA_BLANGKO_KUNCI]);
    const peta = simpan[ALAT_PETA_BLANGKO_KUNCI];
    return peta && typeof peta === "object" ? peta : {};
  } catch {
    return {};
  }
}

async function alatSimpanPetaBlangko(peta) {
  try {
    await chrome.storage.local.set({ [ALAT_PETA_BLANGKO_KUNCI]: peta || {} });
    return true;
  } catch {
    return false;
  }
}

/*
 * ============================================================================
 * PEMBACA PEMETAAN BLANGKO SERVER - SATU UNTUK SELURUH EKSTENSI
 * (PERBAIKAN 2 OKT SORE, AGEN P, BUTIR 1)
 * ============================================================================
 *
 * Yang diatur admin di ALETA e-Court > Integrasi e-Court > Pemetaan blangko
 * (GET /aleta/api/aleta-ecourt/pemetaan-blangko?jenis=putusan|relaas|pbt|bas)
 * dibaca DI SINI, oleh setiap tempat yang memilih blangko: putusan massal ABT
 * dan SIPP, unggah putusan satu perkara, relaas & PBT (jurusita.js), BAS.
 * Sebelum ini hanya jurusita.js yang bertanya ke server - sekali per halaman -
 * dan pemetaan PUTUSAN dari server tidak dibaca siapa pun.
 *
 * Urutan sumber: server -> simpanan server terakhir (chrome.storage.local,
 * hanya bila server tidak menjawab) -> kosong (pemanggil memakai bawaannya).
 *
 * SINGGAHAN: ALAT_PEMETAAN_SINGGAH_MS = 60 detik, di memori halaman. Jawaban
 * yang lebih muda dari itu dipakai tanpa bertanya lagi; sesudahnya permintaan
 * berikutnya bertanya ke server. Jadi perubahan admin berlaku PALING LAMA 1
 * MENIT kemudian, tanpa Reload ekstensi (dan seketika pada halaman yang baru
 * dibuka sesudah singgahannya habis). Server yang gagal tidak diulang-ulang
 * pada tiap pemanggilan: kegagalan juga disinggahkan 15 detik.
 *
 * Hanya GET - lolos mode coba, latihan, dan kering seperti bacaan lain.
 */
const ALAT_API_PEMETAAN_BLANGKO = "/aleta/api/aleta-ecourt/pemetaan-blangko";
const ALAT_PEMETAAN_SINGGAH_MS = 60 * 1000;
const ALAT_PEMETAAN_SINGGAH_GAGAL_MS = 15 * 1000;
/** Simpanan bawaan (putusan, bas). Relaas & PBT memakai "petaBlangkoRelaasPbt" milik jurusita.js. */
const ALAT_KUNCI_PEMETAAN_SERVER = "pemetaanBlangkoServer";
const ALAT_JENIS_PEMETAAN = ["putusan", "relaas", "pbt", "bas"];
/** jenis -> { hasil, waktu, gagal } */
const alatPemetaanSinggah = new Map();
/** jenis -> Promise yang sedang terbang (dua bagian panel = satu permintaan). */
const alatPemetaanTerbang = new Map();

/** { kunci: namaBerkas } dari butir jawaban server; butir tanpa nama dibuang, nama TIDAK dirapikan. */
function alatPetaDariButirPemetaan(butir) {
  const peta = {};
  for (const b of Array.isArray(butir) ? butir : []) {
    const kunci = String((b && b.kunci) || "").trim();
    const nama = typeof (b && b.namaBerkas) === "string" ? b.namaBerkas : "";
    if (kunci && nama.trim()) peta[kunci] = nama;
  }
  return peta;
}

/** Hanya butir yang DIATUR admin (bukan benih bawaan server). */
function alatPetaAdminDariButir(butir) {
  return alatPetaDariButirPemetaan((Array.isArray(butir) ? butir : []).filter((b) => b && b.sumber === "admin"));
}

async function alatTanyaPemetaanServer(jenis) {
  try {
    const r = await alatAmbil(
      `${ALAT_API_PEMETAAN_BLANGKO}?jenis=${encodeURIComponent(jenis)}`,
      { credentials: "include", cache: "no-store" },
      "Membaca pemetaan blangko"
    );
    if (!r.ok) return null;
    const luar = await r.json();
    if (!luar || luar.ok === false) return null;
    const isi = luar.data ? luar.data : luar;
    if (!isi || !Array.isArray(isi.butir)) return null;
    return {
      peta: alatPetaDariButirPemetaan(isi.butir),
      admin: alatPetaAdminDariButir(isi.butir),
      diubahPada: String(isi.diubahPada || ""),
    };
  } catch {
    return null;
  }
}

/**
 * Pemetaan satu jenis yang BERLAKU. Pulang
 *   { jenis, peta, admin, sumber: "server"|"simpanan"|"bawaan", diubahPada, diambil }
 * peta  = seluruh butir server (admin + benih bawaan server)
 * admin = hanya yang diatur admin (putusan memakai ini - bawaan putusan milik ekstensi)
 *
 * opsi.paksa       lewati singgahan memori
 * opsi.kunciSimpan kunci chrome.storage.local (bawaan ALAT_KUNCI_PEMETAAN_SERVER)
 */
async function alatPemetaanBlangko(jenis, opsi) {
  const o = opsi || {};
  if (!ALAT_JENIS_PEMETAAN.includes(jenis)) throw new Error(`Jenis pemetaan "${String(jenis)}" tidak dikenal.`);
  const kunciSimpan = String(o.kunciSimpan || ALAT_KUNCI_PEMETAAN_SERVER);
  const kunciSinggah = `${kunciSimpan}|${jenis}`;
  const kini = Date.now();
  const s = alatPemetaanSinggah.get(kunciSinggah);
  if (!o.paksa && s && kini - s.waktu < (s.gagal ? ALAT_PEMETAAN_SINGGAH_GAGAL_MS : ALAT_PEMETAAN_SINGGAH_MS)) return s.hasil;
  if (alatPemetaanTerbang.has(kunciSinggah)) return alatPemetaanTerbang.get(kunciSinggah);
  const kerja = (async () => {
    const server = await alatTanyaPemetaanServer(jenis);
    let simpanan = {};
    try {
      const x = await chrome.storage.local.get([kunciSimpan]);
      simpanan = x && x[kunciSimpan] && typeof x[kunciSimpan] === "object" ? x[kunciSimpan] : {};
    } catch {
      simpanan = {};
    }
    let hasil;
    if (server) {
      hasil = { jenis, peta: server.peta, admin: server.admin, sumber: "server", diubahPada: server.diubahPada, diambil: Date.now() };
      try {
        await chrome.storage.local.set({
          [kunciSimpan]: {
            ...simpanan,
            [jenis]: { peta: server.peta, admin: server.admin, diubahPada: server.diubahPada, diambil: hasil.diambil },
          },
        });
      } catch {
        /* tanpa simpanan, halaman berikutnya bertanya ke server lagi */
      }
    } else if (simpanan[jenis] && simpanan[jenis].peta && typeof simpanan[jenis].peta === "object") {
      const lama = simpanan[jenis];
      hasil = {
        jenis,
        peta: lama.peta,
        admin: lama.admin && typeof lama.admin === "object" ? lama.admin : lama.peta,
        sumber: "simpanan",
        diubahPada: String(lama.diubahPada || ""),
        diambil: Number(lama.diambil) || 0,
      };
    } else {
      hasil = { jenis, peta: {}, admin: {}, sumber: "bawaan", diubahPada: "", diambil: 0 };
    }
    alatPemetaanSinggah.set(kunciSinggah, { hasil, waktu: Date.now(), gagal: !server });
    return hasil;
  })();
  alatPemetaanTerbang.set(kunciSinggah, kerja);
  try {
    return await kerja;
  } finally {
    alatPemetaanTerbang.delete(kunciSinggah);
  }
}

/*
 * ============================================================================
 * PUTUSAN PER JENIS PERKARA DAN PER STATUS PUTUSAN (BUTIR 3)
 * ============================================================================
 *
 * Kunci peta peramban (petaBlangkoPutusan): "<jenis baku>" seperti dulu,
 * ditambah "<jenis baku>|<status>" dan "<jenis baku>|<status>|verstek" -
 * huruf kecil (alatKunciJenis + alatKunciStatusPutusan). Kunci admin server
 * "Cerai Gugat|Dikabulkan|verstek" dipetakan ke sana di
 * alatTerapkanPemetaanServer. Status perkara dari isian putusan SIPP / data
 * perkara yang sudah dibaca; kosong = blangko jenisnya (perilaku lama).
 *
 * CERMIN: manajemen_surat/src/lib/pemetaan-blangko.ts pilihBlangkoPutusan
 * (uji pemetaan-blangko-2okt.test.ts menjalankan keduanya).
 */
function alatKunciStatusPutusan(status) {
  return String(status || "")
    .replace(/\(.*?\)/g, " ")
    .replace(/\bverstek\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Kunci peta peramban untuk kunci admin server ("Cerai Gugat|Dikabulkan|verstek"). */
function alatKunciPetaDariAdmin(kunciAdmin) {
  const [jenis = "", status = "", tanda = ""] = String(kunciAdmin || "").split("|");
  const j = alatKunciJenis(jenis);
  const s = alatKunciStatusPutusan(status);
  if (!j) return "";
  if (!s) return j;
  return /verstek/i.test(tanda) || /verstek/i.test(status) ? `${j}|${s}|verstek` : `${j}|${s}`;
}

/**
 * Baris peta untuk satu perkara: [kumulasi+status+verstek -> kumulasi+status ->] status+verstek -> status -> jenis.
 * Pulang { baris, kunci, tingkat } atau null. `kumulasi` (T 13 Okt, opsional) = daftar kode kumulasi perkara (SIPP + petitum,
 * kumulasiPerkaraService) - lihat alatKodeKumulasi; baris kumulasi berkunci "<jenis>+<kode>[+<kode>]|<status>[|verstek]".
 */
function alatPetaUntukPerkara(peta, jenis, status, verstek, kumulasi) {
  const p = peta && typeof peta === "object" ? peta : {};
  const j = alatKunciJenis(jenis);
  if (!j) return null;
  const s = alatKunciStatusPutusan(status);
  const v = Boolean(verstek) || /verstek/i.test(String(status || ""));
  const ada = (k) => p[k] && alatBlangkoTerpetakan(p[k]);
  /* === T 13 Okt === */
  if (s) {
    for (const kode of alatCalonKunciKumulasi(kumulasi)) {
      const jk = `${j}+${kode}`;
      if (v && ada(`${jk}|${s}|verstek`)) return { baris: p[`${jk}|${s}|verstek`], kunci: `${jk}|${s}|verstek`, tingkat: "kumulasi-verstek" };
      if (ada(`${jk}|${s}`)) return { baris: p[`${jk}|${s}`], kunci: `${jk}|${s}`, tingkat: "kumulasi" };
    }
  }
  /* === AKHIR T === */
  if (s && v && ada(`${j}|${s}|verstek`)) return { baris: p[`${j}|${s}|verstek`], kunci: `${j}|${s}|verstek`, tingkat: "status-verstek" };
  if (s && ada(`${j}|${s}`)) return { baris: p[`${j}|${s}`], kunci: `${j}|${s}`, tingkat: "status" };
  if (p[j]) return { baris: p[j], kunci: j, tingkat: "jenis" };
  return null;
}

/** Sebutan baris peta untuk daftar pilihan: "Cerai Gugat · Dikabulkan (verstek)". */
function alatSebutKunciPeta(kunci, baris) {
  const [j, s, v] = String(kunci || "").split("|");
  const jenis = (baris && baris.jenisAsli) || j;
  if (!s) return jenis;
  const status = (baris && baris.statusAsli) || s;
  return `${jenis} · ${status}${v ? " (verstek)" : ""}`;
}

/**
 * Menerapkan pemetaan PUTUSAN server ke peta peramban (diubah di tempat).
 * Pulang true bila ada yang berubah.
 *
 *   - kunci admin yang nama berkasnya berbeda dari baris peramban: baris itu
 *     DISETEL ke nama admin dan tokennya dilepas (diambil ulang dari ABT -
 *     token adalah enkripsi sesi ABT, tidak pernah dikirim server);
 *   - nama sama: tokennya tetap, baris ditandai sumber "server";
 *   - baris yang dulu datang dari server (sumber "server") tetapi kini tidak
 *     diatur lagi: baris status dihapus, baris jenis kembali ke bawaan
 *     ekstensi (atau dihapus bila tanpa bawaan) - HANYA bila server MENJAWAB
 *     (simpanan lama tidak boleh menghapus apa pun) dan bawaanBerlaku dikirim
 *     (peta lengkap ABT; panel SIPP mengirim null).
 */
function alatTerapkanPemetaanServer(peta, pemetaan, bawaanBerlaku) {
  if (!pemetaan || pemetaan.sumber === "bawaan") return false;
  const admin = pemetaan.admin && typeof pemetaan.admin === "object" ? pemetaan.admin : {};
  let berubah = false;
  const dariServer = new Set();
  for (const [kunciAdmin, nama] of Object.entries(admin)) {
    const kunci = alatKunciPetaDariAdmin(kunciAdmin);
    if (!kunci || !String(nama || "").trim()) continue;
    dariServer.add(kunci);
    const [, statusAdmin = ""] = String(kunciAdmin).split("|");
    const ada = peta[kunci];
    const bawaan = bawaanBerlaku && bawaanBerlaku[kunci.split("|")[0]];
    if (ada && alatKunciBerkas(ada.berkas) === alatKunciBerkas(nama)) {
      if (ada.sumber !== "server") {
        peta[kunci] = { ...ada, sumber: "server", bawaan: false };
        berubah = true;
      }
      continue;
    }
    peta[kunci] = {
      jenisAsli: (ada && ada.jenisAsli) || (bawaan && bawaan.jenisAsli) || String(kunciAdmin).split("|")[0],
      ...(statusAdmin ? { statusAsli: statusAdmin.replace(/\s*\(.*?\)\s*/g, "").trim() } : {}),
      berkas: String(nama),
      ...(bawaan && bawaan.blangko ? { blangko: bawaan.blangko, blangkoDiminta: bawaan.blangko } : {}),
      ...(bawaan && bawaan.blangkoLain ? { blangkoLain: bawaan.blangkoLain } : {}),
      a: "",
      b: "",
      d: "",
      bawaan: false,
      sumber: "server",
      catatan: "diatur admin di Pemetaan blangko server - token diambil ulang dari ABT",
      disimpanPada: new Date().toISOString(),
    };
    berubah = true;
  }
  // Tanpa bawaanBerlaku (panel SIPP, peta di memori) tidak ada yang dilepas.
  if (pemetaan.sumber === "server" && bawaanBerlaku) {
    for (const [kunci, baris] of Object.entries(peta)) {
      if (!baris || baris.sumber !== "server" || dariServer.has(kunci)) continue;
      const bawaan = !kunci.includes("|") && bawaanBerlaku ? bawaanBerlaku[kunci] : null;
      if (bawaan) peta[kunci] = { ...bawaan, disimpanPada: new Date().toISOString() };
      else delete peta[kunci];
      berubah = true;
    }
  }
  return berubah;
}

/**
 * Satu baris pemetaan yang sah. Token a/b diperiksa bentuknya saja - keduanya
 * hasil enkripsi ABT yang hanya ABT dapat membacanya; yang dijaga di sini
 * cuma "bukan kosong, bukan berisi spasi atau tanda kutip".
 */
/**
 * ============================================================================
 * PENJAGA TOKEN PERNAH MEMBUANG TIGA DARI EMPAT TOKEN SUNGGUHAN
 * ============================================================================
 *
 * Penjaga lamanya menuntut token hanya berisi [A-Za-z0-9+/=_%.-]. Token ABT
 * yang sesungguhnya - hasil enkripsi CodeIgniter - kerap memuat "~", dan
 * diukur atas empat tautan blangko di peladen 14 September 2026: TIGA di
 * antaranya memuat "~" dan karena itu dibuang di sini, diam-diam.
 *
 * Akibatnya persis seperti yang dilaporkan dari layar: "7 token terisi, 7
 * berkas tidak ditemukan" - angka yang sama dua kali, sebab ketujuhnya
 * memang ketemu, lalu tokennya dihapus penjaga ini sebelum disimpan. Yang
 * membacanya menyimpulkan blangkonya tidak ada di ABT.
 *
 * Sekarang yang ditolak hanya yang memang tidak mungkin token: kosong,
 * terlalu pendek, mengandung spasi, atau memuat huruf yang akan mematahkan
 * tautan (< > " ' & ? #). Selebihnya diterima apa adanya - ia tetap dilewatkan
 * URLSearchParams saat dipakai, jadi tidak ada yang dapat menyusup lewat sini.
 */
function alatTokenSah(x) {
  return /^[^\s<>"'&?#]{8,}$/.test(String(x || ""));
}

function alatRapikanBlangko(masukan) {
  const b = masukan || {};
  const token = (x) => String(x || "").trim();
  const sah = alatTokenSah;
  const a = token(b.a);
  const bb = token(b.b);
  return {
    blangko: String(b.blangko || "").replace(/\s+/g, " ").trim().slice(0, 120),
    berkas: String(b.berkas || "").replace(/\s+/g, " ").trim().slice(0, 160),
    a: sah(a) ? a : "",
    b: sah(bb) ? bb : "",
    d: String(b.d || "").trim().slice(0, 8),
    disimpanPada: String(b.disimpanPada || new Date().toISOString()),
  };
}

function alatBlangkoLengkap(baris) {
  return Boolean(baris && baris.a && baris.b && baris.berkas);
}

/** Alamat RTF terisi untuk satu perkara, dari satu baris pemetaan. */
function alatAlamatPreviewAbt(asal, baris, perkaraId) {
  if (!alatBlangkoLengkap(baris) || !perkaraId) return "";
  const q = new URLSearchParams();
  q.set("c", String(perkaraId));
  q.set("b", baris.b);
  q.set("a", baris.a);
  if (baris.d) q.set("d", baris.d);
  return `${asal}/preview?${q.toString()}`;
}

/**
 * Membaca a/b/c dari satu tautan berkas di halaman blangko ABT.
 *
 * ABT menulis tautannya sebagai onclick:
 *   showLoading();post("…/abt/main/cari", { a:"<enc dir>", b:"<enc file>", c:"<id>" });
 * dan halaman perkara sebagai href abt/preview?c=&b=&a=&d=. Keduanya dibaca.
 */
function alatTokenDariTautan(elemen) {
  if (!elemen) return null;
  const onclick = String(elemen.getAttribute("onclick") || "");
  const cocok = onclick.match(/a\s*:\s*"([^"]+)"\s*,\s*b\s*:\s*"([^"]+)"/);
  if (cocok) return { a: cocok[1], b: cocok[2], d: "" };
  const href = String(elemen.getAttribute("href") || "");
  if (/abt\/preview/.test(href)) {
    try {
      const u = new URL(href, location.origin).searchParams;
      return { a: u.get("a") || "", b: u.get("b") || "", d: u.get("d") || "" };
    } catch {
      return null;
    }
  }
  return null;
}

/* ─── 2. ANTREAN MASSAL ─────────────────────────────────────────────────── */
const ALAT_ANTREAN_KUNCI = "antreanPutusanMassal";
const ALAT_ANTREAN_MAKS = 120;

/**
 * Bentuk antrean:
 *   {
 *     id, dibuat, tanggalSidang, tahap: "abt"|"sipp", asal: "abt"|"sidang"|"berkas"|"",
 *     modus: "otomatis"|"manual", kering: bool, posisi: number,
 *     butir: [{ nomor, perkaraId, jenis, enc, keadaan, catatan, sebabTahan?, pemegang?,
 *               isianPilihan?, dokumen:{rtf,pdf,anonim,unggah} }]
 *   }
 * keadaan: menunggu | jalan | selesai | gagal | dilewati | jeda | tertahan
 * sebabTahan (lanjutan SIPP): praperiksa | pilihan-kosong | pilihan-beda | gagal-isi |
 *   medan-tambahan | antrean-diakhiri ("pilihan" = keduanya, butir sebelum 26 Sep 2026)
 * pemegang: ALAT_PENANDA_HALAMAN halaman yang sedang mengerjakannya
 * isianPilihan: [{ medan, nilai, asal: "bawaan"|"tegas"|"usulan" }] - pilihan borang
 *   yang diisikan ALETA pada perkara itu
 */
async function alatMuatAntrean() {
  return (await alatMuatAntreanRinci()).antrean;
}

/**
 * ============================================================================
 * EKSTENSI DIMUAT ULANG DI TENGAH ANTREAN (uji rilis 9 Okt 2026)
 * ============================================================================
 *
 * Sesudah ekstensi dimuat ulang atau diperbarui, skrip di halaman yang sudah
 * terbuka tetap hidup, tetapi tiap chrome.storage melempar "Extension context
 * invalidated". Dahulu itu terbaca sama dengan antrean yang KOSONG, sehingga
 * petugas diberi tahu "antrean ini sudah diakhiri atau diganti" - keliru, dan
 * tanpa jalan keluar. Kini sebabnya "terputus": muat ulang halamannya.
 */
function alatGalatTerputus(galat) {
  const pesan = String((galat && galat.message) || galat || "");
  if (/context invalidated/i.test(pesan)) return true;
  try {
    return typeof chrome === "undefined" || !chrome || !chrome.storage || !chrome.storage.local;
  } catch {
    return true;
  }
}

/** Antrean beserta keterangan apakah penyimpanan ekstensi terputus. */
async function alatMuatAntreanRinci() {
  try {
    const simpan = await chrome.storage.local.get([ALAT_ANTREAN_KUNCI]);
    const q = simpan[ALAT_ANTREAN_KUNCI];
    return { antrean: q && Array.isArray(q.butir) ? q : null, terputus: false };
  } catch (galat) {
    return { antrean: null, terputus: alatGalatTerputus(galat) };
  }
}

/**
 * ============================================================================
 * ANTREAN DIUBAH PER BUTIR, BUKAN DITIMPA DENGAN SALINAN LAMA
 * ============================================================================
 *
 * Sampai 26 September 2026 tiap langkah antrean SIPP menulis SELURUH antrean
 * dari salinan yang dibacanya di awal pengerjaan. Salinan itu basi begitu tab
 * lain - atau tombol "Akhiri antrean" - menulis: perkara yang sudah tersimpan
 * di tab lain tercatat "menunggu" lagi (lalu disimpan kedua kalinya), antrean
 * yang sudah diakhiri hidup kembali, dan antrean baru yang disusun dari berkas
 * tertimpa antrean lama.
 *
 * Kini tiap tulis dari pengerjaan antrean adalah baca-ubah-tulis SATU butir
 * (alatUbahButirAntrean): antrean dibaca segar, dipastikan masih antrean yang
 * sama (id), satu butir diubah, lalu ditulis. Antrean yang sudah diakhiri atau
 * diganti tidak ditulis sama sekali.
 *
 * Baca-ubah-tulis itu - dan tiap tulis utuh lewat alatSimpanAntrean -
 * digilir lewat satu kunci Web Locks bila peramban menyediakannya. Kunci itu
 * berlaku lintas tab seasal, jadi dua tab SIPP tidak dapat sama-sama membaca
 * "menunggu" lalu sama-sama mengklaim perkara yang sama. Tanpa Web Locks
 * semuanya tetap berjalan seperti sebelumnya, hanya tanpa giliran.
 *
 * NAVIGATOR.LOCKS HANYA ADA DI SECURE CONTEXT (https, localhost, 127.0.0.1).
 * SIPP satker yang dibuka lewat http://192.168.10.10 bukan secure context,
 * jadi di sana - menurut spesifikasinya; belum diukur di peramban kantor -
 * kunci ini tidak ada. Yang tetap menjaga di sana: penanda pemegang
 * (butir.pemegang) yang diperiksa pada tiap tulis, dan pemeriksaan segar
 * TEPAT sebelum Simpan di jalankanSatuAntreanSipp - dua tab yang sama-sama
 * mengklaim satu perkara hanya meloloskan pemegang terakhir.
 */
const ALAT_ANTREAN_NAMA_KUNCI = "aleta-antrean-putusan-massal";

/**
 * Penanda halaman ini. Butir yang sedang dikerjakan membawa penanda halaman
 * yang mengerjakannya (butir.pemegang); halaman lain tidak menulis ke butir
 * itu, dan halaman ini tidak menekan Simpan bila butirnya sudah dipegang
 * halaman lain.
 */
const ALAT_PENANDA_HALAMAN = `halaman-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/** Menjalankan `kerja` di bawah kunci antrean bila Web Locks ada; tanpanya langsung. */
async function alatDalamKunciAntrean(kerja) {
  const kunci =
    typeof navigator !== "undefined" && navigator && navigator.locks && typeof navigator.locks.request === "function"
      ? navigator.locks
      : null;
  if (!kunci) return kerja();
  let mulai = false;
  try {
    return await kunci.request(ALAT_ANTREAN_NAMA_KUNCI, () => {
      mulai = true;
      return kerja();
    });
  } catch (galat) {
    // Galat dari kerjanya sendiri diteruskan. Web Locks yang menolak sebelum
    // kerja dimulai berarti berjalan tanpa giliran - seperti sebelum ada kunci.
    if (mulai) throw galat;
    return kerja();
  }
}

/** Tulis antrean terakhir yang gagal karena ekstensi terputus (lihat alatGalatTerputus). */
let alatAntreanTulisTerputus = false;

/** Tulis utuh TANPA kunci - hanya untuk dipanggil dari dalam kunci antrean. */
async function alatTulisAntreanLangsung(antrean) {
  try {
    if (!antrean) await chrome.storage.local.remove([ALAT_ANTREAN_KUNCI]);
    else await chrome.storage.local.set({ [ALAT_ANTREAN_KUNCI]: antrean });
    alatAntreanTulisTerputus = false;
    return true;
  } catch (galat) {
    alatAntreanTulisTerputus = alatGalatTerputus(galat);
    return false;
  }
}

/** Menyimpan antrean UTUH (menyusun baru, mengakhiri) - bergiliran dengan tulisan lain. */
async function alatSimpanAntrean(antrean) {
  return alatDalamKunciAntrean(() => alatTulisAntreanLangsung(antrean));
}

/**
 * Baca-ubah-tulis SATU butir antrean. `ubah(butir)` mengubah butir SEGAR di
 * tempat; memulangkan false berarti batal dan tidak ada yang ditulis.
 *
 * Pulang { ok, sebab, butir } - butir adalah salinan sesudah diubah (atau
 * sebelum, bila batal). sebab: "diakhiri" (antrean sudah tidak ada),
 * "diganti" (antrean lain), "tidak-ada" (nomornya tidak di antrean), "ditolak"
 * (ubah memulangkan false), "gagal-tulis", "terputus" (ekstensi dimuat ulang -
 * penyimpanannya tidak terjangkau dari halaman ini; uji rilis 9 Okt 2026).
 */
async function alatUbahButirAntrean(idAntrean, nomor, ubah) {
  return alatDalamKunciAntrean(async () => {
    const { antrean, terputus } = await alatMuatAntreanRinci();
    if (terputus) return { ok: false, sebab: "terputus", butir: null };
    if (!antrean) return { ok: false, sebab: "diakhiri", butir: null };
    if (antrean.id !== idAntrean) return { ok: false, sebab: "diganti", butir: null };
    const butir = antrean.butir.find((x) => x.nomor === nomor);
    if (!butir) return { ok: false, sebab: "tidak-ada", butir: null };
    if (ubah(butir) === false) return { ok: false, sebab: "ditolak", butir: { ...butir } };
    const tertulis = await alatTulisAntreanLangsung(antrean);
    return {
      ok: tertulis,
      sebab: tertulis ? "" : alatAntreanTulisTerputus ? "terputus" : "gagal-tulis",
      butir: { ...butir },
    };
  });
}

/** Membaca SATU butir antrean segar - tanpa menulis. Bentuk pulangnya sama. */
async function alatBacaButirAntrean(idAntrean, nomor) {
  const { antrean, terputus } = await alatMuatAntreanRinci();
  if (terputus) return { ok: false, sebab: "terputus", butir: null };
  if (!antrean) return { ok: false, sebab: "diakhiri", butir: null };
  if (antrean.id !== idAntrean) return { ok: false, sebab: "diganti", butir: null };
  const butir = antrean.butir.find((x) => x.nomor === nomor);
  return butir ? { ok: true, sebab: "", butir: { ...butir } } : { ok: false, sebab: "tidak-ada", butir: null };
}

function alatBuatAntrean(pilihan) {
  const p = pilihan || {};
  const butir = (p.butir || []).slice(0, ALAT_ANTREAN_MAKS).map((x) => ({
    nomor: String(x.nomor || ""),
    perkaraId: String(x.perkaraId || ""),
    jenis: String(x.jenis || ""),
    enc: String(x.enc || ""),
    keadaan: "menunggu",
    catatan: "",
    dokumen: { rtf: "", pdf: "", anonim: "", unggah: "" },
  }));
  return {
    // Ekor acak: dua antrean yang disusun pada milidetik yang sama tetap
    // berbeda id - id-lah yang membedakan antrean lama dari penggantinya.
    id: `massal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    dibuat: new Date().toISOString(),
    tanggalSidang: String(p.tanggalSidang || ""),
    tahap: p.tahap === "sipp" ? "sipp" : "abt",
    // Asal antrean - disebut apa adanya di panel lanjutan SIPP.
    asal: ["abt", "sidang", "berkas"].includes(p.asal) ? p.asal : "",
    // Otomatis HANYA bila diminta dengan namanya. Mode otomatis menekan
    // Simpan SIPP sendiri; sampai 26 September 2026 nilai yang tidak dikenal
    // - "draf" dari antrean berkas - diam-diam menjadi otomatis.
    modus: p.modus === "otomatis" ? "otomatis" : "manual",
    kering: p.kering !== false,
    posisi: 0,
    butir,
  };
}

/** Butir berikutnya yang masih menunggu - atau null bila habis. */
function alatAntreanBerikutnya(antrean) {
  if (!antrean) return null;
  const i = antrean.butir.findIndex((x) => x.keadaan === "menunggu" || x.keadaan === "jalan");
  if (i < 0) return null;
  antrean.posisi = i;
  return antrean.butir[i];
}

function alatAntreanRingkas(antrean) {
  const hitung = { menunggu: 0, jalan: 0, selesai: 0, gagal: 0, dilewati: 0, jeda: 0, tertahan: 0 };
  for (const b of (antrean && antrean.butir) || []) hitung[b.keadaan] = (hitung[b.keadaan] || 0) + 1;
  return hitung;
}

/**
 * ============================================================================
 * ANTREAN BARU TIDAK DIAM-DIAM MENGGANTI YANG BELUM SELESAI
 * ============================================================================
 *
 * Hanya ada SATU antrean tersimpan: menyusun antrean baru (dari berkas, dari
 * jadwal sidang, atau dari tahap ABT) menggantinya. Sampai 26 September 2026
 * penggantian itu diam - perkara antrean lama yang belum dikerjakan hilang
 * tanpa kabar. Kini petugas ditanya dulu bila antrean lama masih punya
 * perkara menunggu atau sedang dikerjakan; antrean yang sudah habis diganti
 * tanpa bertanya. Halaman tanpa window.confirm (uji lama) berperilaku seperti
 * sebelumnya: diganti.
 *
 * @param {string} asalBaru sebutan antrean baru, untuk kalimat pertanyaannya
 * @returns {Promise<boolean>} true = boleh mengganti
 */
async function alatBolehGantiAntrean(asalBaru) {
  const lama = await alatMuatAntrean();
  if (!lama) return true;
  const h = alatAntreanRingkas(lama);
  const belum = (h.menunggu || 0) + (h.jalan || 0);
  if (belum === 0) return true;
  const w = typeof window !== "undefined" ? window : null;
  if (!w || typeof w.confirm !== "function") return true;
  const asalLama = { abt: "tahap ABT", sidang: "jadwal sidang", berkas: "berkas putusan" }[lama.asal] || "sebelumnya";
  return Boolean(
    w.confirm(
      `Antrean putusan massal dari ${asalLama}${lama.tanggalSidang ? ` (sidang ${lama.tanggalSidang})` : ""} ` +
        `masih punya ${belum} perkara yang belum dikerjakan. Antrean baru${asalBaru ? ` dari ${asalBaru}` : ""} ` +
        "akan menggantinya, dan perkara itu tidak dilanjutkan. Lanjutkan?"
    )
  );
}

/* ─── 3. JADWAL SIDANG PADA SATU TANGGAL ───────────────────────────────── */
const ALAT_API_SIDANG = "/aleta/api/aleta-ecourt/sidang";

function alatTanggalIso(tanggal) {
  const t = tanggal instanceof Date ? tanggal : new Date();
  const y = t.getFullYear();
  const m = String(t.getMonth() + 1).padStart(2, "0");
  const d = String(t.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Sidang pada satu tanggal, dari ALETA. Baris yang datang sudah membawa
 * sudahPutus, jenisPerkara, agenda, perkaraId - persis yang dibutuhkan untuk
 * MENAWARKAN, bukan memutuskan.
 */
async function alatSidangPadaTanggal(tanggalIso) {
  const q = new URLSearchParams({ dari: tanggalIso, sampai: tanggalIso, batas: "300" });
  const respons = await alatAmbil(
    `${ALAT_API_SIDANG}?${q.toString()}`,
    { credentials: "include", cache: "no-store" },
    "Membaca jadwal sidang"
  );
  if (!respons.ok) throw new Error(alatPesanGagal(null, respons.status, "Membaca jadwal sidang"));
  const luar = await respons.json();
  const isi = luar && luar.data ? luar.data : luar;
  if (!isi || isi.available === false) {
    throw new Error((isi && isi.message) || "ALETA belum dapat membaca jadwal sidang.");
  }
  const sidang = Array.isArray(isi.sidang) ? isi.sidang : [];
  // Satu perkara bisa punya dua baris sidang di hari yang sama (ditunda lalu
  // dijadwalkan ulang). Yang ditawarkan satu per perkara.
  const per = new Map();
  for (const s of sidang) {
    const nomor = String(s.nomorPerkara || "");
    if (!nomor || per.has(nomor)) continue;
    per.set(nomor, {
      nomor,
      perkaraId: String(s.perkaraId || ""),
      jenis: String(s.jenisPerkara || ""),
      agenda: String(s.agenda || ""),
      sudahPutus: Boolean(s.sudahPutus),
      // Dipakai menamai berkas - lihat sebutStatusPutusan di abt.js.
      statusPutusan: String(s.statusPutusan || ""),
      verstek: Boolean(s.verstekPutusan),
      ditunda: Boolean(s.ditunda),
      ikrar: Boolean(s.sidangIkrarTalak),
      jam: String(s.jamSidang || ""),
      // Perbaikan 1 Okt (K4, butir 13): bahan aletaMassalPutusanLayak di
      // basmassal.js - putus / ditunda untuk putusan atau musyawarah. Ruas
      // tambahan saja; ruas lama dan urutannya tidak berubah.
      alasanDitunda: String(s.alasanDitunda || ""),
      tanggalPutusan: String(s.tanggalPutusan || ""),
      tanggalSidang: String(s.tanggalSidang || tanggalIso || ""),
      // T 13 Okt: kode kumulasi (SIPP + petitum) - dipakai pemilih blangko putusan kumulasi (alatPetaUntukPerkara).
      kumulasi: alatKodeKumulasi(s.kumulasi),
    });
  }
  return [...per.values()];
}

/** Pemilih tanggal kecil: hari ini sebagai bawaan, boleh diubah. */
function alatPemilihTanggal(saatUbah) {
  const wadah = alatEl("div", "aleta-massal-tanggal");
  const label = alatEl("label", "aleta-massal-tanggal-label", "Tanggal sidang");
  const masukan = document.createElement("input");
  masukan.type = "date";
  masukan.className = "aleta-massal-tanggal-isi";
  masukan.value = alatTanggalIso(new Date());
  const hariIni = alatEl("button", "aleta-perkakas-aksi", "Hari ini");
  hariIni.type = "button";
  hariIni.addEventListener("click", () => {
    masukan.value = alatTanggalIso(new Date());
    if (saatUbah) saatUbah(masukan.value);
  });
  masukan.addEventListener("change", () => {
    if (saatUbah && masukan.value) saatUbah(masukan.value);
  });
  wadah.appendChild(label);
  wadah.appendChild(masukan);
  wadah.appendChild(hariIni);
  wadah.nilai = () => masukan.value;
  return wadah;
}

/** Jeda antar perkara - berurutan dan bernapas, bukan serentak. */
const ALAT_JEDA_MASSAL_MS = 1500;
function alatJeda(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/* ─── 1a-jeda. JEDA SEPERTI MANUSIA UNTUK AKSI TULIS (K4, perbaikan 2 Okt butir 14)
 *
 * Keputusan pengguna 2 Okt: jeda seperti manusia DIPERTAHANKAN untuk tulisan
 * ke SIPP/ABT/e-Court, dan ekstensi tidak mencolok di halaman sistem luar.
 * (Audit jujur - siapa, kapan, IP, "lewat ALETA" - tetap di tabel aleta_*,
 * bukan di kolom audit sistem luar; itu urusan jalur portal/bot, bukan jeda.)
 *
 *   alatJedaManusia(jenis?, opsi?) -> Promise<number>  (milidetik yang dijalani)
 *
 *   jenis   rentang (ms)    dipakai untuk
 *   klik     350 -   900    menekan tombol / memilih di halaman
 *   isi      500 -  1400    mengisi satu isian sebelum isian berikutnya
 *   simpan   900 -  2200    sebelum mengirim satu simpanan (POST) - BAWAAN
 *   unggah  1500 -  3500    sebelum mengunggah berkas (edoc, putusan, BAS)
 *   pindah   800 -  1800    berpindah halaman/langkah dalam satu alur
 *   perkara 2000 -  4500    antar dua perkara dalam pekerjaan massal
 *   Jenis yang tidak dikenal = "simpan".
 *
 *   opsi.alamat  alamat tulisan; bila mode coba menahannya, tanpa jeda.
 *   opsi.sinyal  AbortSignal - dibatalkan = jeda selesai seketika (0).
 *   opsi.skala   pengali rentang (bawaan 1), mis. 0.5 untuk aksi sangat ringan.
 *
 * TANPA JEDA (seketika 0): mode kering, mode latihan, mode coba yang menahan
 * tulisan (tanpa alamat: setiap mode coba aktif) - tidak ada yang ditulis,
 * jadi menunggu hanya memperlambat orang yang berlatih. Juga tanpa jeda bila
 * alatSetelJedaSkala(0) (dipakai uji).
 *
 * BUKAN untuk GET/baca biasa, dan bukan pengganti jeda beban yang sudah ada
 * (alatJeda(ALAT_JEDA_MASSAL_MS) dsb. tetap seperti sebelumnya).
 */
const ALAT_JEDA_MANUSIA = {
  klik: [350, 900],
  isi: [500, 1400],
  simpan: [900, 2200],
  unggah: [1500, 3500],
  pindah: [800, 1800],
  perkara: [2000, 4500],
};
let alatJedaSkalaUmum = 1;

/** Pengali seluruh jeda manusia (0 = tanpa jeda; uji memakainya). Pulang skala yang berlaku. */
function alatSetelJedaSkala(n) {
  const x = Number(n);
  alatJedaSkalaUmum = Number.isFinite(x) && x >= 0 ? Math.min(x, 5) : 1;
  return alatJedaSkalaUmum;
}

/** Rentang [min, maks] jenis itu (jenis tak dikenal = simpan). */
function alatJedaManusiaRentang(jenis) {
  const r = ALAT_JEDA_MANUSIA[String(jenis || "").toLowerCase()] || ALAT_JEDA_MANUSIA.simpan;
  return [r[0], r[1]];
}

/** Apakah jeda dilewati: tidak ada yang sungguh ditulis. */
function alatJedaManusiaDilewati(alamat) {
  try {
    if (typeof alatKeringNyala === "function" && alatKeringNyala()) return true;
    if (typeof alatLatihanNyala === "function" && alatLatihanNyala()) return true;
    if (alamat) {
      if (typeof alatCobaMenahan === "function" && alatCobaMenahan(alamat, "POST")) return true;
    } else if (typeof alatCobaAktif === "function" && alatCobaAktif()) {
      return true;
    }
  } catch {
    /* tanpa keterangan mode: jeda tetap berjalan (arah aman) */
  }
  return false;
}

function alatJedaManusia(jenis, opsi) {
  const o = opsi && typeof opsi === "object" ? opsi : {};
  if (alatJedaManusiaDilewati(o.alamat)) return Promise.resolve(0);
  const skala = alatJedaSkalaUmum * (Number.isFinite(Number(o.skala)) && Number(o.skala) >= 0 ? Number(o.skala) : 1);
  if (skala <= 0) return Promise.resolve(0);
  const [min, maks] = alatJedaManusiaRentang(jenis);
  const ms = Math.round((min + Math.random() * (maks - min)) * skala);
  const sinyal = o.sinyal;
  if (sinyal && sinyal.aborted) return Promise.resolve(0);
  return new Promise((selesai) => {
    let batal = null;
    const t = setTimeout(() => {
      if (sinyal && batal) sinyal.removeEventListener("abort", batal);
      selesai(ms);
    }, ms);
    if (sinyal && typeof sinyal.addEventListener === "function") {
      batal = () => {
        clearTimeout(t);
        selesai(0);
      };
      sinyal.addEventListener("abort", batal, { once: true });
    }
  });
}

/* ─── 1b. PEMETAAN MENURUT NAMA BERKAS, TOKEN MENYUSUL ──────────────────────
 *
 * Token a/b hanya dapat dibaca dari halaman ABT yang sedang terbuka, dan
 * halaman ABT peladen tidak selalu terjangkau saat pemetaannya disusun -
 * sepanjang sesi ini peladen mati. Kalau pemetaan menuntut token sejak awal,
 * ia tidak dapat disusun sama sekali sampai peladen hidup.
 *
 * Karena itu satu baris pemetaan cukup memuat NAMA BERKAS. Tokennya dicari
 * panel ABT sendiri ketika halamannya terbuka: bilah kelompok di beranda
 * memuat tautan tiap kelompok, halaman kelompok memuat tautan tiap berkas
 * beserta tokennya, dan namanya dicocokkan. Begitu ketemu, tokennya disimpan
 * ke baris itu supaya tidak dicari lagi.
 *
 * Nama juga lebih tahan lama daripada token: token adalah hasil enkripsi
 * ABT dengan kunci peladen, dan kunci yang berganti membuat seluruh token
 * yang tersimpan mati diam-diam. Nama berkasnya tidak ikut berganti.
 */

/** Nama berkas dirapikan untuk dibandingkan: huruf kecil, spasi tunggal, tanpa .rtf. */
function alatKunciBerkas(nama) {
  // Dirapikan DULU, baru akhirannya dibuang: ".RTF " berekor spasi tidak
  // pernah cocok dengan /\.rtf$/ sebelum spasinya dipangkas.
  return String(nama || "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\.rtf$/i, "")
    .trim()
    .toLowerCase();
}

/** Baris yang sudah menyebut berkasnya - dengan atau tanpa token. */
function alatBlangkoTerpetakan(baris) {
  return Boolean(baris && String(baris.berkas || "").trim());
}

/**
 * Pemetaan bawaan - cerai lebih dahulu, sesuai permintaan; jenis lain
 * menyusul sesudah tersambung ke peladen. Tanpa token: tokennya diambil
 * panel ABT begitu halamannya terbuka.
 */
const ALAT_BERKAS_CERAI_BAWAAN = "[01] [Kabul Verstek] Cerai (Format Lengkap)";
/**
 * ============================================================================
 * NAMA BERKAS TIDAK CUKUP - KELOMPOKNYA YANG MEMBEDAKAN
 * ============================================================================
 *
 * Diukur 14 September 2026 atas folder blangko peladen (derry_briantono):
 * berkas "[01] [Kabul Verstek] Cerai (Format Lengkap).rtf" ADA DI KEDUA
 * folder - "1 Perceraian CG" dan "1a Perceraian CT" - dan keduanya identik
 * sampai ke bita terakhir (md5 ad896109…, 143.721 bita).
 *
 * Pencarian token bekerja atas NAMA BERKAS, lalu memakai kelompok PERTAMA
 * yang memuatnya. Di ABT "Putusan Cerai Gugat" (menu 901) berdiri sebelum
 * "Putusan Cerai Talak" (menu 902), jadi Cerai Talak SELALU mendarat di menu
 * Cerai Gugat. Isinya kebetulan sama, jadi tidak ada satu pun galat yang
 * berbunyi - tetapi menu CG tidak memuat berkas khas talak sama sekali:
 *
 *   [01a] [Kabul Verstek] CT - F (Ex Offiicio mutah iddah dan nafkah anak)
 *   [02]  [Kabul] CT - F
 *   [02]  [Kabul] [Rekonvensi] CT - F (Mutah iddah nafkah anak)
 *   [02a] [Kabul] CT - T Tidak Hadir Setelah Mediasi - F
 *
 * Selama barisnya tertambat ke menu CG, tak satu pun dari itu dapat dipilih
 * untuk perkara cerai talak. Karena itu baris bawaan menyebut kelompoknya,
 * dan pencarian token menghormati sebutan itu.
 */
const ALAT_KELOMPOK_CERAI_GUGAT = "Putusan Cerai Gugat";
const ALAT_KELOMPOK_CERAI_TALAK = "Putusan Cerai Talak";
/**
 * ABT MENYEBUT SATU MENU DENGAN DUA NAMA, dan keduanya sama-sama kita baca:
 *
 *   abt_menu.nama        "Putusan Cerai Talak"  - judul <h3> di halaman kelompok
 *   abt_menu.nama_alias  "Putusan CT"           - tulisan tautan di bilah kiri
 *
 * Yang tersimpan pada baris pemetaan adalah yang PERTAMA (dari <h3>), sebab
 * dari sanalah tokennya dipanen. Yang dibaca saat mengurutkan pencarian
 * adalah yang KEDUA. Menyebut satu saja membuat separuh kodenya tidak pernah
 * cocok - dan diamnya tidak terlihat, ia hanya membuat pencarian memindai
 * seluruh kelompok dengan urutan apa adanya.
 */
const ALAT_KELOMPOK_LAIN_CERAI_GUGAT = ["Putusan CG"];
const ALAT_KELOMPOK_LAIN_CERAI_TALAK = ["Putusan CT"];
/** Seri yang sama di peladen: "[01] [Kabul] IN" untuk itsbat nikah. */
const ALAT_BERKAS_ITSBAT_BAWAAN = "[01] [Kabul] IN";
/**
 * ============================================================================
 * DISPENSASI KAWIN - DIBACA DARI PELADEN, BUKAN LAGI DITEBAK
 * ============================================================================
 *
 * Bawaan lamanya "DK (Full) Perempuan Hamil V.2" - nama dari ABT setempat
 * (salinan PA Bungku), dipasang supaya barisnya tidak kosong dan DITANDAI
 * "periksa namanya di peladen" sejak hari pertama.
 *
 * Diperiksa 14 September 2026 pada folder blangko peladen
 * (_blangko_abt/derry_briantono/3 Dispensasi Kawin): tebakan itu tidak ada
 * di sana sama sekali. Yang ada enam berkas, dan yang paling lazim untuk
 * skenario dikabulkan adalah yang dipakai sekarang.
 *
 * Ada DUA varian kabul yang berdampingan - anak perempuan yang hamil, dan
 * anak laki-laki yang calon istrinya hamil. Keduanya jenis perkara yang sama
 * di SIPP, jadi bawaan hanya dapat menyebut satu; yang lain dipilih per
 * perkara lewat pilihan blangko di daftar putusan massal. Itu sebabnya
 * catatannya menyebutkan nama varian satunya - supaya yang memilih tidak
 * perlu mencarinya sendiri di ABT.
 */
const ALAT_BERKAS_DISPENSASI_BAWAAN = "[01] [Kabul] DK - (Anak P Cewek) Hamil";
const ALAT_PETA_BAWAAN = {
  "cerai gugat": {
    jenisAsli: "Cerai Gugat",
    berkas: ALAT_BERKAS_CERAI_BAWAAN,
    blangko: ALAT_KELOMPOK_CERAI_GUGAT,
    blangkoLain: ALAT_KELOMPOK_LAIN_CERAI_GUGAT,
    bawaan: true,
  },
  "cerai talak": {
    jenisAsli: "Cerai Talak",
    berkas: ALAT_BERKAS_CERAI_BAWAAN,
    blangko: ALAT_KELOMPOK_CERAI_TALAK,
    blangkoLain: ALAT_KELOMPOK_LAIN_CERAI_TALAK,
    bawaan: true,
  },
  "itsbat nikah": { jenisAsli: "Itsbat Nikah", berkas: ALAT_BERKAS_ITSBAT_BAWAAN, bawaan: true },
  "dispensasi kawin": {
    jenisAsli: "Dispensasi Kawin",
    berkas: ALAT_BERKAS_DISPENSASI_BAWAAN,
    bawaan: true,
    catatan: "nama dari server - varian cowok: [01] [Kabul] DK - (Anak P Cowok) Calon Istri Hamil",
  },
};

/* === 4B 11 Okt === */
/**
 * Blangko putusan GUGATAN LAIN dari paket ABT "abt-blangko-gugatan-lain" (menu baru grup derry_briantono:
 * 920 Putusan Harta Bersama, 921 Putusan Kewarisan, 923 Putusan Izin Poligami). Disusun dari putusan nyata
 * PA Donggala (506/Pdt.G/2026, 620/Pdt.G/2025, 0102/Pdt.G/2016) - bukan tebakan nama.
 *
 * Sebelum paket itu dipasang di satker berkasnya tidak ada; pencarian token lalu tidak menemukan apa pun dan
 * panel menyebutnya - perlakuan yang sama dengan bawaan lain yang belum ada di server. Itsbat kontensius
 * (alur 15, menu 922) TIDAK diberi baris sendiri: jenis SIPP-nya sama dengan itsbat permohonan ("itsbat nikah").
 */
Object.assign(ALAT_PETA_BAWAAN, {
  "harta bersama": {
    jenisAsli: "Harta Bersama",
    berkas: "[02a] [Kabul] HB - T Tidak Hadir Setelah Mediasi",
    blangko: "Putusan Harta Bersama",
    blangkoLain: ["Putusan HB"],
    bawaan: true,
    catatan: "paket ABT abt-blangko-gugatan-lain - varian: [97] [Perdamaian] Akta Perdamaian; [98] [Cabut] Gugatan - P & T Hadir Sebelum Jawaban",
  },
  kewarisan: {
    jenisAsli: "Kewarisan",
    berkas: "[01] [Kabul] Kewarisan - Kontradiktur",
    blangko: "Putusan Kewarisan",
    blangkoLain: ["Putusan Waris"],
    bawaan: true,
    catatan: "paket ABT abt-blangko-gugatan-lain - varian: [97] [Perdamaian] Akta Perdamaian",
  },
  poligami: {
    jenisAsli: "Izin Poligami",
    berkas: "[01] [Kabul] Izin Poligami",
    blangko: "Putusan Izin Poligami",
    blangkoLain: ["Putusan Poligami"],
    bawaan: true,
    catatan: "paket ABT abt-blangko-gugatan-lain - varian: [98] [Cabut] Permohonan - P & T Hadir Sebelum Jawaban",
  },
});
/* === AKHIR 4B === */

/* === P 12 Okt === */
/**
 * BLANGKO CERAI PER STATUS PUTUSAN - bawaan, bukan lagi satu blangko untuk semua status.
 *
 * Sebelum ini cerai gugat/talak hanya punya baris JENIS ("[01] [Kabul Verstek] Cerai (Format Lengkap)"), jadi perkara
 * yang dicabut, digugurkan, ditolak, NO, dicoret, atau dikabulkan kontradiktoir tetap ditawari blangko kabul verstek
 * kecuali admin mengaturnya satu per satu di Pemetaan blangko server. Baris di bawah memakai kunci yang sama dengan baris
 * status buatan admin ("<jenis>|<status>[|verstek]", lihat alatPetaUntukPerkara), sehingga urutan pencariannya tetap:
 * status+verstek -> status -> jenis, dan pemetaan admin tetap menang (alatTerapkanPemetaanServer).
 *
 * Nama berkas = folder derry_briantono "1 Perceraian CG" / "1a Perceraian CT" (diperiksa 12 Okt 2026). Untuk status yang
 * punya beberapa varian dipilih yang PALING SERING dipakai pada putusan PA Donggala 2025-2026 di PC (mis. cabut 1a: 54
 * putusan); varian lain disebut di catatan supaya dapat dipilih per perkara. "Dikabulkan" WAJIB berpasangan dengan baris
 * "|verstek": tanpa itu perkara verstek jatuh ke baris "dikabulkan" (kontradiktoir) sebelum sampai ke baris jenis.
 * Status SIPP: status_putusan jenis_pengadilan 4 (62 Dikabulkan, 63 Ditolak, 64 Tidak Dapat Diterima, 65 Digugurkan,
 * 66 Dicoret dari Register, 67 Dicabut, 93 Gugur). Perdamaian (85) tidak pernah terjadi pada perkara cerai satker.
 * Blangko [02b] dan [98] [NO] 4b berasal dari paket ABT abt-cerai-lengkap (Agen P).
 */
function alatBarisStatusCerai(jenis, status, berkas, catatan) {
  const gugat = jenis === "Cerai Gugat";
  return {
    jenisAsli: jenis,
    statusAsli: status,
    berkas,
    blangko: gugat ? ALAT_KELOMPOK_CERAI_GUGAT : ALAT_KELOMPOK_CERAI_TALAK,
    blangkoLain: [...(gugat ? ALAT_KELOMPOK_LAIN_CERAI_GUGAT : ALAT_KELOMPOK_LAIN_CERAI_TALAK)],
    bawaan: true,
    ...(catatan ? { catatan } : {}),
  };
}
const ALAT_BERKAS_STATUS_CERAI = {
  verstekKabul: [ALAT_BERKAS_CERAI_BAWAAN, ""],
  // "Unus Testis Nullus Testis" hanya ada di folder CG (diperiksa 12 Okt) - catatan CT tidak menyebutnya.
  tolakVerstek: ["[01ab] [Tolak Verstek] Cerai - Tidak ada bukti", "varian: [01ab] [Tolak Verstek] Cerai - Kurang 6 Bulan SEMA 1 Tahun 2022"],
  tolak: ["[03] [Tolak] Cerai - T Tidak Hadir Setelah Mediasi - F Tidak Terbukti", ""],
  no: [
    "[98] [NO] 4. Cerai P & T Tidak Hadir - Alamat T Tidak Diketahui",
    "varian: [98] [NO] 4a. Cerai P Hadir Sidang Pertama Lalu 2x Tidak Hadir (SEMA 1 2022); [98] [NO] 4b. Cerai P Diwakili Kuasa Insidentil Tidak Sah & T Tidak Hadir",
  ],
  gugur: ["[98] [Gugur] 3. Cerai P & T Tidak Hadir", "varian: [98] [Gugur] 3a. Cerai P Tidak Hadir & T Hadir"],
  cabut: [
    "[98] [Cabut] 1a. Cerai P Hadir & T Tidak Hadir - Tanpa Mediasi (Alamat T Tidak Diketahui)",
    "varian: [98] [Cabut] 1. Cerai P Hadir & T Tidak Hadir - Tanpa Mediasi (P & T Damai); [98] [Cabut] 2. Cerai P & T Hadir- Setelah Mediasi (Sebelum Jawaban); [98] [Cabut] 5. Cerai P Hadir & T Tidak Hadir - Setelah Pembuktian",
  ],
  coret: ["[98] [Coret] 6. Cerai Dibatalkan dari Pendaftaran - Panjar Habis", ""],
};
function alatPetaStatusCerai(jenis, kodeJenis) {
  const k = jenis.toLowerCase();
  const B = ALAT_BERKAS_STATUS_CERAI;
  const kabul = [
    `[02] [Kabul] ${kodeJenis} - F`,
    `varian: [02a] [Kabul] ${kodeJenis} - T Tidak Hadir Setelah Mediasi - F; [02b] [Kabul] ${kodeJenis} - F - Mediasi Berhasil Sebagian (Kesepakatan Dimuat dalam Amar)` +
      (kodeJenis === "CT" ? "; [02] [Kabul] [Rekonvensi] CT - F (Mutah iddah nafkah anak)" : ""),
  ];
  const baris = {
    [`${k}|dikabulkan|verstek`]: alatBarisStatusCerai(jenis, "Dikabulkan", ...B.verstekKabul),
    [`${k}|dikabulkan`]: alatBarisStatusCerai(jenis, "Dikabulkan", ...kabul),
    [`${k}|ditolak|verstek`]: alatBarisStatusCerai(
      jenis,
      "Ditolak",
      B.tolakVerstek[0],
      kodeJenis === "CG" ? `${B.tolakVerstek[1]}; [01ab] [Tolak Verstek] Cerai - Unus Testis Nullus Testis` : B.tolakVerstek[1]
    ),
    [`${k}|ditolak`]: alatBarisStatusCerai(jenis, "Ditolak", ...B.tolak),
    [`${k}|tidak dapat diterima`]: alatBarisStatusCerai(jenis, "Tidak Dapat Diterima", ...B.no),
    [`${k}|digugurkan`]: alatBarisStatusCerai(jenis, "Digugurkan", ...B.gugur),
    [`${k}|gugur`]: alatBarisStatusCerai(jenis, "Gugur", ...B.gugur),
    [`${k}|dicabut`]: alatBarisStatusCerai(jenis, "Dicabut", ...B.cabut),
    [`${k}|dicoret dari register`]: alatBarisStatusCerai(jenis, "Dicoret dari Register", ...B.coret),
  };
  return baris;
}
Object.assign(ALAT_PETA_BAWAAN, alatPetaStatusCerai("Cerai Gugat", "CG"), alatPetaStatusCerai("Cerai Talak", "CT"));
/* === AKHIR P === */

/* === T 13 Okt === */
/**
 * BLANGKO PUTUSAN PERKARA KUMULASI (butir 4) - baris bawaan "<jenis>+<kode kumulasi>|<status>[|verstek]".
 *
 * Kumulasi = keterangan bot (kumulasiPerkaraService: SIPP perkara_kumulasi, dan petitum perkara cerai bila SIPP kosong -
 * keputusan pengguna 12 Okt: keduanya digabung). Diukur 13 Okt atas sipp_donggala (5.655 perkara cerai, 256 berkumulasi):
 * CG + itsbat kabul verstek 87, CG + hak asuh kabul verstek 37 (+ nafkah anak 7), CT + itsbat kabul verstek 13.
 * Folder derry_briantono: "1c Perceraian Kumulasi Itsbat Nikah" (sudah ada, CG), dan dari paket ABT abt-putusan-bas-lengkap
 * (Agen T): "1d Putusan Cerai Gugat Kumulasi Hak Asuh Anak" & "1e Putusan Cerai Talak Kumulasi Itsbat Nikah".
 * Hanya status yang punya blangkonya; status lain (cabut/gugur/NO/tolak) tetap jatuh ke baris status cerai biasa.
 * Kode gabungan dicoba lebih dulu (mis. hak-asuh-anak+nafkah-anak), lalu tiap kode sendiri-sendiri.
 */
const ALAT_URUT_KUMULASI = ["itsbat-nikah", "hak-asuh-anak", "nafkah-anak"];

/** Kode kumulasi dari keterangan bot ({daftar:[{kode}]}), daftar kode, atau null -> daftar kode bersih berurutan. */
function alatKodeKumulasi(kumulasi) {
  const daftar = Array.isArray(kumulasi) ? kumulasi : kumulasi && Array.isArray(kumulasi.daftar) ? kumulasi.daftar : [];
  const kode = daftar
    .map((x) => (typeof x === "string" ? x : x && typeof x.kode === "string" ? x.kode : ""))
    .map((x) => x.trim().toLowerCase())
    .filter((x) => /^[a-z0-9-]{2,40}$/.test(x));
  return [...new Set(kode)];
}

/** Kunci kumulasi yang dicoba, dari yang paling khusus: gabungan semua kode yang dikenal, lalu tiap kode. */
function alatCalonKunciKumulasi(kumulasi) {
  const kode = alatKodeKumulasi(kumulasi).filter((k) => ALAT_URUT_KUMULASI.includes(k));
  kode.sort((a, b) => ALAT_URUT_KUMULASI.indexOf(a) - ALAT_URUT_KUMULASI.indexOf(b));
  const hasil = [];
  if (kode.length > 1) hasil.push(kode.join("+"));
  for (const k of kode) hasil.push(k);
  return hasil;
}

function alatBarisKumulasi(jenisAsli, statusAsli, berkas, blangko, blangkoLain, catatan) {
  return { jenisAsli, statusAsli, berkas, blangko, blangkoLain: [...blangkoLain], bawaan: true, ...(catatan ? { catatan } : {}) };
}
Object.assign(ALAT_PETA_BAWAAN, {
  "cerai gugat+itsbat-nikah|dikabulkan|verstek": alatBarisKumulasi(
    "Cerai Gugat Kumulasi Itsbat Nikah",
    "Dikabulkan",
    "[01aa] [Kabul Verstek] IN + CG - F",
    "Putusan Cerai Kumulasi Itsbat Nikah",
    ["Putusan Cerai Kumulasi Itsbat"],
    "varian: [01aa] [Kabul Verstek] IN + CG - B & F"
  ),
  "cerai talak+itsbat-nikah|dikabulkan|verstek": alatBarisKumulasi(
    "Cerai Talak Kumulasi Itsbat Nikah",
    "Dikabulkan",
    "[01aa] [Kabul Verstek] Putusan CT Kumulasi Itsbat Nikah - F",
    "Putusan Cerai Talak Kumulasi Itsbat Nikah",
    ["Putusan CT Kumulasi Itsbat"],
    "paket ABT abt-putusan-bas-lengkap"
  ),
  "cerai gugat+hak-asuh-anak|dikabulkan|verstek": alatBarisKumulasi(
    "Cerai Gugat Kumulasi Hak Asuh Anak",
    "Dikabulkan",
    "[01] [Kabul Verstek] Putusan CG Kumulasi Hak Asuh Anak - Anak Belum Mumayyiz",
    "Putusan Cerai Gugat Kumulasi Hak Asuh Anak",
    ["Putusan CG Kumulasi Hak Asuh"],
    "varian: [01b] [Kabul Verstek] Putusan CG Kumulasi Hak Asuh Anak dan Nafkah Anak - Anak Belum Mumayyiz"
  ),
  "cerai gugat+hak-asuh-anak+nafkah-anak|dikabulkan|verstek": alatBarisKumulasi(
    "Cerai Gugat Kumulasi Hak Asuh Anak dan Nafkah Anak",
    "Dikabulkan",
    "[01b] [Kabul Verstek] Putusan CG Kumulasi Hak Asuh Anak dan Nafkah Anak - Anak Belum Mumayyiz",
    "Putusan Cerai Gugat Kumulasi Hak Asuh Anak",
    ["Putusan CG Kumulasi Hak Asuh"],
    "varian: [01] [Kabul Verstek] Putusan CG Kumulasi Hak Asuh Anak - Anak Belum Mumayyiz"
  ),
});
/* === AKHIR T === */

/**
 * Pemetaan tersimpan, dilengkapi bawaannya untuk jenis yang belum pernah
 * disentuh. Yang pernah disunting - termasuk yang sengaja dihapus lalu
 * ditandai kosong - tidak ditimpa bawaan.
 */
/**
 * Entri putusan.peta-blangko -> bentuk ALAT_PETA_BAWAAN. Satu jenis satu
 * baris: bila portal mengirim dua untuk jenis yang sama (bawaan tidak
 * dimatikan sebelum tambahannya disahkan), yang pertama dipakai dan yang
 * kedua disebut di konsol - dua baris untuk satu jenis akan berselisih.
 */
function alatPetaBawaanDariEntri(entri) {
  const hasil = {};
  for (const e of entri) {
    if (hasil[e.kunci]) {
      console.warn(`[ALETA] Peta blangko: jenis "${e.kunci}" dikirim dua kali; "${e.nilai}" diabaikan.`);
      continue;
    }
    const d = e.data || {};
    hasil[e.kunci] = {
      jenisAsli: d.jenisAsli,
      ...(d.statusAsli ? { statusAsli: d.statusAsli } : {}), // P 12 Okt: baris status cerai bawaan
      berkas: e.nilai,
      ...(d.blangko ? { blangko: d.blangko } : {}),
      ...(Array.isArray(d.blangkoLain) ? { blangkoLain: [...d.blangkoLain] } : {}),
      bawaan: true,
      ...(d.catatan ? { catatan: d.catatan } : {}),
    };
  }
  return hasil;
}

/**
 * Bawaan peta blangko yang BERLAKU - dari portal bila ada, dan padanannya
 * dimuat lebih dulu supaya kunci lama dipadankan dengan padanan yang sama.
 * Pulang {bawaan, asal}. Tertanam berarti ALAT_PETA_BAWAAN itu sendiri.
 */
async function alatPetaBawaanBerlaku() {
  await alatMuatPadananJenis();
  const hasil = await alatTipeKeluaran("putusan.peta-blangko");
  const bawaan = hasil.asal === "tertanam" ? ALAT_PETA_BAWAAN : alatPetaBawaanDariEntri(hasil.entri);
  return { bawaan, asal: hasil.asal };
}

async function alatMuatPetaBlangkoLengkap() {
  // ==========================================================================
  // BAWAANNYA MILIK PORTAL, TOKENNYA MILIK PERAMBAN
  // ==========================================================================
  //
  // Nama berkas, menu, dan jenis yang dipetakan diatur SEKALI di portal dan
  // berlaku untuk setiap peramban tanpa penyuntingan satu per satu. Token a/b/d
  // tetap per peramban di petaBlangkoPutusan: ia hasil enkripsi sesi ABT yang
  // tidak bermakna di peramban lain, jadi tidak pernah dikirim ke portal.
  const { bawaan: bawaanBerlaku, asal: asalBawaan } = await alatPetaBawaanBerlaku();
  const peta = await alatMuatPetaBlangko();
  let berubah = false;

  // ==========================================================================
  // BARIS YANG BERKUNCI NAMA LAIN DIGABUNG, TIDAK DITINGGALKAN
  // ==========================================================================
  //
  // Sebelum padanan ada, baris dapat tersimpan dengan kunci "pengesahan
  // perkawinan/istbat nikah". Sesudah padanan ada, kunci itu tidak akan
  // pernah dicari lagi - dan baris yang pernah disunting tangan akan lenyap
  // dari layar tanpa satu pun pemberitahuan. Itu kehilangan pekerjaan orang,
  // bukan pembersihan.
  //
  // Yang menang saat keduanya ada: baris yang PERNAH DISUNTING mengalahkan
  // bawaan, dan di antara dua yang sederajat, yang sudah punya token. Yang
  // kalah tetap dibuang - dua baris untuk satu jenis akan berselisih.
  for (const kunciLama of Object.keys(peta)) {
    const kunciBaku = alatKunciJenis(kunciLama);
    if (kunciBaku === kunciLama) continue;
    const lama = peta[kunciLama];
    const ada = peta[kunciBaku];
    const lamaMenang =
      !ada ||
      (lama && !lama.bawaan && ada.bawaan) ||
      (lama && Boolean(lama.bawaan) === Boolean(ada.bawaan) && alatBlangkoLengkap(lama) && !alatBlangkoLengkap(ada));
    if (lamaMenang) peta[kunciBaku] = { ...lama, jenisAsli: (ada && ada.jenisAsli) || lama.jenisAsli || kunciBaku };
    delete peta[kunciLama];
    berubah = true;
  }

  // ==========================================================================
  // BAWAAN YANG DIMATIKAN ATAU DIGANTI DI PORTAL IKUT DI PERAMBAN
  // ==========================================================================
  //
  // HANYA bila bawaannya datang dari portal atau singgahannya. Tertanam tidak
  // pernah menghapus atau menyetel ulang apa pun - tanpa portal, perilakunya
  // sama dengan sebelum portal ada. Dan hanya baris bawaan: baris yang pernah
  // disunting tangan menyatakan kehendak orang, tidak disentuh.
  //
  // Nama berkas dibandingkan lewat alatKunciBerkas, bukan apa adanya: pengisi
  // token menulis nama berkas persis seperti di ABT (mis. berakhiran .RTF),
  // dan membandingkan apa adanya akan melepas tokennya pada tiap pemuatan.
  if (asalBawaan !== "tertanam") {
    for (const [kunci, ada] of Object.entries(peta)) {
      if (!ada || !ada.bawaan) continue;
      const baru = bawaanBerlaku[kunci];
      if (!baru) {
        delete peta[kunci];
        berubah = true;
        continue;
      }
      if (alatKunciBerkas(ada.berkas) === alatKunciBerkas(baru.berkas)) continue;
      peta[kunci] = {
        ...baru,
        ...(baru.blangko ? { blangkoDiminta: baru.blangko } : {}),
        a: "",
        b: "",
        d: "",
        catatan: `berkas disetel portal ke "${baru.berkas}" - token diambil ulang`,
        disimpanPada: new Date().toISOString(),
      };
      berubah = true;
    }
  }

  for (const [kunci, bawaan] of Object.entries(bawaanBerlaku)) {
    if (peta[kunci] === undefined) {
      peta[kunci] = { ...bawaan, disimpanPada: new Date().toISOString() };
      berubah = true;
      continue;
    }
    // ========================================================================
    // BARIS BAWAAN YANG TERTAMBAT KE MENU YANG KELIRU DILEPAS
    // ========================================================================
    //
    // Cerai Talak sudah tersimpan bertoken menu "Putusan Cerai Gugat" pada
    // pemasangan sebelum ini - bukan karena ada yang memilihnya, melainkan
    // karena pencarian berdasar nama berkas selalu menemukan CG lebih dulu.
    // Token itu dilepas supaya diambil ulang dari menu yang benar.
    //
    // HANYA baris bawaan. Yang pernah disunting tangan menyatakan kehendak
    // orang - kalau seseorang sengaja menautkan talak ke menu gugat, itu
    // keputusannya, bukan kekeliruan yang boleh saya batalkan diam-diam.
    // Yang dibandingkan adalah menu yang DIMINTA, bukan menu tempat tokennya
    // akhirnya ditemukan. Keduanya bisa berbeda secara sah - bila ABT di
    // hadapan petugas memang tidak punya menu itu, barisnya terisi dari menu
    // lain dan itu sudah disebut pada catatannya.
    //
    // Membandingkan tempat-ditemukan akan membuat baris semacam itu dianggap
    // keliru pada SETIAP pemuatan: token dilepas, seluruh ABT dipindai ulang,
    // hasilnya sama, dilepas lagi. Berputar tanpa akhir, dan yang terlihat di
    // layar hanya panel yang selalu sibuk tanpa sebab.
    const ada = peta[kunci];
    if (!ada || !ada.bawaan || !bawaan.blangko) continue;
    const dimintaDulu = ada.blangkoDiminta || "";
    const perluAmbilUlang = dimintaDulu
      ? alatKunciKelompok(dimintaDulu) !== alatKunciKelompok(bawaan.blangko)
      : true;
    if (!perluAmbilUlang) continue;
    peta[kunci] = {
      ...ada,
      blangko: bawaan.blangko,
      blangkoDiminta: bawaan.blangko,
      ...(bawaan.blangkoLain ? { blangkoLain: bawaan.blangkoLain } : {}),
      a: "",
      b: "",
      d: "",
      catatan: `menu disetel ke "${bawaan.blangko}" - token diambil ulang`,
      disimpanPada: new Date().toISOString(),
    };
    berubah = true;
  }

  // ==========================================================================
  // PEMETAAN PUTUSAN SERVER MENANG (PERBAIKAN 2 OKT SORE, BUTIR 1 & 3)
  // ==========================================================================
  //
  // Yang diatur admin di Pemetaan blangko > Putusan (per jenis, per status
  // putusan) menggantikan nama berkas baris peramban - lihat
  // alatTerapkanPemetaanServer. Singgahan 1 menit (alatPemetaanBlangko).
  try {
    const pemetaan = await alatPemetaanBlangko("putusan");
    if (alatTerapkanPemetaanServer(peta, pemetaan, bawaanBerlaku)) berubah = true;
  } catch {
    /* server dan simpanan tak terbaca: peta peramban apa adanya */
  }
  if (berubah) await alatSimpanPetaBlangko(peta);
  return peta;
}

/**
 * Tautan kelompok blangko dari HTML beranda ABT.
 *
 *   <a ... href="…/abt/main/beranda?a=ENC&c=">NAMA KELOMPOK</a>
 *
 * Dibaca dengan regex atas teks HTML, bukan DOM - supaya dapat dijalankan
 * atas hasil fetch tanpa menggambarnya, dan dapat diuji tanpa peramban.
 */
function alatUraiKelompokDariHtml(html) {
  const hasil = [];
  const teks = String(html || "");
  const pola = /<a\b[^>]*href=["']([^"']*\/abt\/main\/(?:beranda|daftar)\?a=([^"'&]+)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = pola.exec(teks))) {
    const nama = m[3].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    const a = m[2].trim();
    if (!nama || !a) continue;
    if (hasil.some((x) => x.a === a)) continue;
    hasil.push({ kelompok: nama, a, href: m[1] });
  }
  return hasil;
}

/**
 * Berkas blangko dari HTML satu halaman kelompok ABT.
 *
 *   <div class="pricing-top …"><h3>NAMA KELOMPOK</h3></div>
 *   …<p><a title='ukuran file 300 kb' href='#' onclick='showLoading();post("…/cari", {
 *        a:"ENCDIR", b:"ENCFILE", c:"…"});'># <span>NAMA BERKAS</span></a></p>
 */
function alatUraiBerkasDariHtml(html) {
  const hasil = [];
  const teks = String(html || "");
  const judul = teks.match(/class=["'][^"']*pricing-top[^"']*["'][^>]*>\s*<h3>([\s\S]*?)<\/h3>/i);
  const kelompok = judul ? judul[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() : "";
  // Tiap <a …>…</a> dibaca utuh: atribut onclick ABT membentang beberapa
  // baris (post("…", {\n\t\ta:"…",\n\t\tb:"…",\n\t\tc:"…"\n\t\t});) dan memuat
  // tanda kutip ganda di dalam kutip tunggal, jadi token dicari di dalam
  // seluruh isi tag, bukan lewat pola satu baris.
  const tag = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = tag.exec(teks))) {
    const atribut = m[1];
    const token = atribut.match(/\ba\s*:\s*\\?["']([^"'\\]+)\\?["']\s*,\s*b\s*:\s*\\?["']([^"'\\]+)\\?["']/);
    if (!token) continue;
    const berkas = m[2].replace(/<[^>]+>/g, "").replace(/^#\s*/, "").replace(/\s+/g, " ").trim();
    if (!berkas) continue;
    hasil.push({ blangko: kelompok, berkas, a: token[1], b: token[2], d: "" });
  }
  return hasil;
}

/**
 * ============================================================================
 * ALAMAT PORTAL DICATAT DARI SETIAP HALAMAN, BUKAN HANYA SIPP
 * ============================================================================
 *
 * Popup berjalan di origin chrome-extension:// dan tidak punya cara lain
 * mengetahui alamat portal. Dulu hanya skrip SIPP yang mencatatnya, dengan
 * alasan "ia yang berjalan di halaman SIPP" - padahal ABT dan halaman ALETA
 * berdiri di origin YANG SAMA dan sama-sama tahu.
 *
 * Akibatnya nyata: petugas yang seharian di ABT tidak pernah membuka SIPP,
 * jadi popupnya memakai alamat yang tercatat entah kapan - dan sesudah
 * pindah peladen, alamat itu menunjuk mesin yang sudah mati. Yang terbaca di
 * layar "portal tidak terjangkau", seolah portalnya yang bermasalah.
 *
 * Menaruhnya di sini membuat ketiga skrip mencatat hal yang sama tanpa
 * menyalin kodenya, dan tanpa izin "tabs" - izin itu memberi kemampuan
 * membaca alamat SELURUH tab peramban, jauh lebih luas daripada yang
 * dibutuhkan.
 */
let alatAsalSudahDicatat = false;

function alatCatatAsalPortal() {
  // Alamatnya tidak berubah sepanjang halaman ini hidup, jadi menuliskannya
  // pada tiap penyegaran hanya menambah kerja tanpa menambah keterangan.
  if (alatAsalSudahDicatat) return;
  alatAsalSudahDicatat = true;
  try {
    chrome.storage.local.set({ asalPortal: `${location.origin}/aleta` });
  } catch {
    /* penyimpanan tidak tersedia: popup memakai keterangan cadangan */
  }
}

/**
 * ============================================================================
 * LAYAR PORTAL YANG MENGHADAP MASYARAKAT - SATU DAFTAR UNTUK PANEL DAN WIDGET
 * ============================================================================
 *
 * Layar sentuh ambil antrian, televisi ruang tunggu, tautan antrian tanpa
 * login, antrian per ruang, papan pintu ruang sidang, halaman publik, dan
 * verifikasi formulir dibuka di peramban yang SAMA dengan ekstensi petugas -
 * sering di PC meja pelayanan yang layarnya dihadapkan ke ruang tunggu.
 * Panel ALETA (aleta.js) memuat nama petugas, pintasan jabatannya, dan jalan
 * kembali ke perkara yang baru dibukanya di SIPP; widget checklist
 * (checklist.js) memuat nomor perkara dan pekerjaan tertundanya. Di layar
 * itu keduanya membeberkan isinya kepada siapa pun yang sedang menunggu.
 *
 * Dahulu hanya widget yang tahu daftar ini, sedangkan panel hanya
 * mengecualikan halaman masuk dan verifikasi dokumen - jadi panelnya tetap
 * tergambar di televisi ruang tunggu. Daftarnya kini tinggal di sini,
 * satu-satunya, dan keduanya bertanya ke fungsi yang sama: rute publik baru
 * cukup ditambahkan sekali, dan tidak ada daftar kedua yang diam-diam
 * tertinggal.
 *
 * Dijaga uji (ekstensi-checklist-milestone.test.ts, "layar yang menghadap
 * masyarakat"): tiap rute tingkat atas di manajemen_surat/src/app harus
 * digolongkan dulu, publik atau bukan, dan kedua skrip dibuktikan memakai
 * fungsi ini, bukan salinannya.
 *
 * Polanya menuntut SEGMEN UTUH: /aleta/aleta-antrian - meja petugas antrian -
 * tidak ikut, walau namanya memuat "antrian". Awalan /aleta boleh tidak ada,
 * sama dengan cara aleta.js membaca jalurnya; jalur SIPP (/SIPP/...,
 * /index.php/...) dan ABT (/aps_badilag/...) tidak pernah cocok, sebab segmen
 * pertamanya lain.
 */
const ALAT_POLA_HALAMAN_PUBLIK =
  /^(?:\/aleta)?\/(antrian|antrian-layar|antrian-tampil|antrian-ruang|sidang-ruang|public|judicia\/legal-form\/verify)(\/|$)/i;

/** Apakah jalur ini - bawaannya halaman ini - layar portal yang menghadap masyarakat? */
function alatHalamanPublikPortal(jalur) {
  const isi = jalur === undefined ? location.pathname : jalur;
  return ALAT_POLA_HALAMAN_PUBLIK.test(String(isi || ""));
}

/** Nama kelompok dirapikan untuk dibandingkan - besar-kecil dan spasi saja. */
function alatKunciKelompok(nama) {
  return String(nama || "").replace(/\s+/g, " ").trim().toLowerCase();
}

/** Nama-nama kelompok yang boleh diterima, dirapikan - satu nama atau daftar. */
function alatKunciKelompokBanyak(kelompok) {
  const daftar = Array.isArray(kelompok) ? kelompok : [kelompok];
  return daftar.map(alatKunciKelompok).filter(Boolean);
}

/** Berkas yang namanya sama, dari daftar hasil urai. Kelompoknya tidak dilihat. */
function alatCocokkanBerkas(daftar, nama) {
  const kunci = alatKunciBerkas(nama);
  if (!kunci) return null;
  return (daftar || []).find((b) => alatKunciBerkas(b.berkas) === kunci) || null;
}

/**
 * Berkas senama YANG BERADA DI KELOMPOK YANG DIMINTA - atau null.
 *
 * ============================================================================
 * KENAPA INI TIDAK BOLEH PUNYA CADANGAN SENDIRI
 * ============================================================================
 *
 * Versi pertama perbaikan ini memulangkan "yang senama" bila kelompoknya tidak
 * ketemu, dan itu membatalkan seluruh perbaikannya: pemanggilnya memeriksa
 * satu kelompok pada satu waktu, jadi saat memindai Cerai Gugat ia langsung
 * mendapat jawaban dan tidak pernah sampai ke Cerai Talak. Cadangannya harus
 * dipegang pemanggil, yang melihat SELURUH kelompok - bukan di sini, yang
 * hanya melihat satu.
 */
function alatCocokkanBerkasDiKelompok(daftar, nama, kelompokDiharapkan) {
  const kunci = alatKunciBerkas(nama);
  const diminta = alatKunciKelompokBanyak(kelompokDiharapkan);
  if (!kunci || diminta.length === 0) return null;
  return (
    (daftar || []).find(
      (b) => alatKunciBerkas(b.berkas) === kunci && diminta.includes(alatKunciKelompok(b.blangko))
    ) || null
  );
}

/** Kelompok yang diharapkan didahulukan, sisanya tetap pada urutan ABT. */
function alatDahulukanKelompok(daftar, kelompokDiharapkan) {
  const diminta = alatKunciKelompokBanyak(kelompokDiharapkan);
  const semua = (daftar || []).slice();
  if (diminta.length === 0) return semua;
  const cocok = (k) => diminta.includes(alatKunciKelompok(k.kelompok));
  const depan = semua.filter(cocok);
  if (depan.length === 0) return semua;
  return depan.concat(semua.filter((k) => !cocok(k)));
}

/* ─── 1c. PEMETAAN DIISI DARI POHON BLANGKO PORTAL ─────────────────────────
 *
 * Portal sudah tahu set blangko mana untuk jenis perkara apa (SET_BLANGKO di
 * lib/pohon-blangko.ts), dan bot sudah dapat membaca isi foldernya di
 * peladen. Rute /aleta-ecourt/blangko/pohon menyatukan keduanya dan memberi
 * satu USULAN bawaan per set - berkas pertama pada skenario kabul.
 *
 * Yang dikerjakan di sini hanya menuangkannya ke tabel pemetaan:
 *   - baris kosong, bawaan, atau bertanda "dari pohon" diisi;
 *   - baris yang pernah DISUNTING tangan tidak disentuh, kecuali diminta
 *     menimpa. Yang diketik orang lebih berharga daripada bawaan mana pun.
 * Token a/b tetap diambil dari halaman ABT seperti biasa - nama berkas dari
 * pohon adalah nama yang sama persis dengan yang dirender ABT.
 */
const ALAT_API_POHON = "/aleta/api/aleta-ecourt/blangko/pohon";

/** Nama tampil: tanpa akhiran .rtf - persis seperti ABT menuliskannya di kartu. */
function alatNamaBerkasTampil(nama) {
  return String(nama || "").replace(/\s+/g, " ").trim().replace(/\.rtf$/i, "").trim();
}

async function alatAmbilPohonBlangko(asal) {
  const alamat = `${asal || ""}${ALAT_API_POHON}`;
  const respons = await fetch(alamat, { credentials: "include", cache: "no-store" });
  if (respons.status === 401 || respons.status === 403) throw new Error("Belum masuk portal ALETA.");
  if (!respons.ok) throw new Error(`Portal menjawab ${respons.status} saat membaca pohon blangko.`);
  const luar = await respons.json();
  const isi = luar && luar.data ? luar.data : luar;
  const set = isi && Array.isArray(isi.set) ? isi.set : [];
  return set;
}

/** Set yang cocok untuk satu jenis - aturan yang sama dengan setUntukPerkara di portal. */
function alatSetCocokJenis(set, jenis) {
  const j = alatKunciJenis(jenis);
  if (!j) return [];
  return (set || []).filter((s) => Array.isArray(s.untuk) && s.untuk.some((kata) => j.includes(String(kata).toLowerCase())));
}

/**
 * Usulan untuk satu jenis: dari set cocok PERTAMA yang punya usulan.
 * Pulang { berkas, blangko, kategori, folder } atau null.
 */
function alatUsulanDariPohon(set, jenis) {
  for (const s of alatSetCocokJenis(set, jenis)) {
    if (s && s.usulan && s.usulan.berkas) {
      return {
        berkas: alatNamaBerkasTampil(s.usulan.berkas),
        blangko: String(s.nama || ""),
        kategori: String(s.usulan.kategori || ""),
        folder: String(s.folder || ""),
      };
    }
  }
  return null;
}

/** Seluruh nama berkas putusan yang dikenal pohon untuk satu jenis - untuk daftar pilihan. */
function alatBerkasPohonUntukJenis(set, jenis) {
  const hasil = [];
  for (const s of alatSetCocokJenis(set, jenis)) {
    for (const j of s.jenjang || []) {
      for (const b of j.blangko || []) {
        hasil.push({ berkas: alatNamaBerkasTampil(b.berkas), blangko: String(s.nama || ""), kategori: String(b.kategori || j.label || "") });
      }
    }
  }
  return hasil;
}

/**
 * Menuangkan usulan pohon ke pemetaan. Pulang daftar { jenis, berkas, blangko }
 * yang terisi; peta diubah di tempat, pemanggil yang menyimpannya.
 */
function alatIsiPetaDariPohon(peta, set, pilihan) {
  const opsi = pilihan || {};
  const jenisSemua = new Set(ALAT_JENIS_LAZIM.map(alatKunciJenis));
  for (const k of Object.keys(peta || {})) jenisSemua.add(k);
  const terisi = [];
  for (const kunci of jenisSemua) {
    const ada = peta[kunci];
    const bolehDiisi =
      !ada || !alatBlangkoTerpetakan(ada) || ada.bawaan === true || ada.sumber === "pohon" || opsi.timpa === true;
    if (!bolehDiisi) continue;
    const label = (ada && ada.jenisAsli) || ALAT_JENIS_LAZIM.find((x) => alatKunciJenis(x) === kunci) || kunci;
    const usulan = alatUsulanDariPohon(set, label);
    if (!usulan) continue;
    // Nama yang sama tidak ditulis ulang - tokennya yang sudah terisi tetap.
    if (ada && alatKunciBerkas(ada.berkas) === alatKunciBerkas(usulan.berkas)) continue;
    peta[kunci] = {
      jenisAsli: label,
      berkas: usulan.berkas,
      blangko: usulan.blangko,
      bawaan: false,
      sumber: "pohon",
      catatan: `dari pohon blangko: ${usulan.blangko}${usulan.kategori ? ` · ${usulan.kategori}` : ""}`,
      disimpanPada: new Date().toISOString(),
    };
    terisi.push({ jenis: label, berkas: usulan.berkas, blangko: usulan.blangko });
  }
  return terisi;
}

/*
 * ============================================================================
 * ISI OTOMATIS HALAMAN MASUK SIPP DAN ABT (7 Okt 2026)
 * ============================================================================
 *
 * Berkas ini dimuat di SIPP, ABT, dan portal; yang di bawah ini hanya bekerja
 * pada HALAMAN MASUK SIPP atau ABT yang dikenali dari blangkonya sendiri -
 * bentuknya dibaca dari kode SIPP/ABT di server satker (diperiksa 7 Okt 2026):
 *
 *   SIPP  application/views/Login/login.php
 *         <form id="login_frm" action=".../login/validation_credential">
 *           input[name=username], input[name=password], input[type=submit]
 *         Ditolak -> dialihkan ke .../login/index/ERR
 *
 *   ABT   application/views/login.php
 *         <form action=".../login/signin">
 *           input[name=userName], input[name=password], <button>Login</button>
 *         Ditolak -> blangko yang sama dirender ulang di .../login/signin
 *         (.alert-danger "Password salah" / "Status Akun Tidak Aktif")
 *
 * Password-nya tidak disimpan di sini: diminta dari pekerja latar tepat saat
 * hendak diisi (titipan di chrome.storage.session, lihat latar.js), diisikan,
 * lalu blangkonya dikirim. Isian yang sudah diketik petugas tidak ditimpa.
 * Halaman masuk yang memperlihatkan penolakan TIDAK diisi lagi - ekstensi
 * memberi tahu pekerja latar supaya menahan isi otomatis untuk jenis itu.
 */
function alatKenaliHalamanMasuk(dok, lokasi) {
  if (!dok || !dok.querySelector) return null;
  const jalur = String((lokasi && lokasi.pathname) || "");
  const tujuan = (f) => String((f && f.getAttribute && f.getAttribute("action")) || "");

  const sipp = dok.querySelector("form#login_frm");
  if (sipp && /\/login\/validation_credential\/?$/.test(tujuan(sipp))) {
    // SIPP menulis <form> DI DALAM <tbody> (views/Login/login.php). Parser
    // HTML menutup form seperti itu seketika, jadi medan-medannya BUKAN
    // keturunannya - hanya "dimiliki" lewat penunjuk form parser (uji rilis
    // 9 Okt 2026: sampai 1.188.0 halaman masuk SIPP sungguhan tidak pernah
    // dikenali). Dicari lewat form.elements, lalu keturunan, lalu medan
    // tunggal sehalaman yang tidak dimiliki form lain.
    const medanMilik = (pilih, nama) => {
      try {
        const dariDaftar = sipp.elements && sipp.elements.namedItem ? sipp.elements.namedItem(nama) : null;
        if (dariDaftar && dariDaftar.tagName === "INPUT") return dariDaftar;
      } catch {
        /* lanjut ke cara berikutnya */
      }
      const keturunan = sipp.querySelector(pilih);
      if (keturunan) return keturunan;
      const sehalaman = Array.from(dok.querySelectorAll(pilih)).filter((x) => !x.form || x.form === sipp);
      return sehalaman.length === 1 ? sehalaman[0] : null;
    };
    const nama = medanMilik('input[name="username"]', "username");
    const sandi = medanMilik('input[name="password"]', "password");
    if (nama && sandi) {
      const tombolSemua = Array.from(
        dok.querySelectorAll('input[type="submit"], button[type="submit"], button:not([type])')
      ).filter((x) => x.form === sipp || sipp.contains(x));
      return {
        jenis: "sipp",
        blangko: sipp,
        nama,
        sandi,
        tombol: tombolSemua[0] || null,
        ditolak: /\/login\/index\/ERR\/?$/i.test(jalur),
      };
    }
  }

  for (const f of Array.from(dok.querySelectorAll("form"))) {
    if (!/\/login\/signin\/?$/.test(tujuan(f))) continue;
    const nama = f.querySelector('input[name="userName"]');
    const sandi = f.querySelector('input[name="password"]');
    if (!nama || !sandi) continue;
    return {
      jenis: "abt",
      blangko: f,
      nama,
      sandi,
      tombol: f.querySelector('button[type="submit"], button:not([type]), input[type="submit"]'),
      ditolak: /\/login\/signin\/?$/.test(jalur) || Boolean(f.querySelector(".alert-danger") || dok.querySelector(".alert-danger")),
    };
  }
  return null;
}

/** Mengirim satu pesan ke pekerja latar; selalu selesai, tidak pernah melempar. */
function alatPesanLatar(pesan) {
  return new Promise((selesai) => {
    try {
      if (!chrome.runtime || !chrome.runtime.id) {
        selesai(null);
        return;
      }
      chrome.runtime.sendMessage(pesan, (jawaban) => {
        let gagal = null;
        try {
          gagal = chrome.runtime.lastError || null;
        } catch (e) {
          gagal = e;
        }
        selesai(gagal ? null : jawaban || null);
      });
    } catch {
      selesai(null);
    }
  });
}

/** Mengisi satu medan seperti diketik - peristiwa input/change ikut dilepas. */
function alatIsiMedanMasuk(medan, nilai) {
  const proto = Object.getPrototypeOf(medan);
  const setel = proto && Object.getOwnPropertyDescriptor(proto, "value");
  if (setel && setel.set) setel.set.call(medan, nilai);
  else medan.value = nilai;
  medan.dispatchEvent(new Event("input", { bubbles: true }));
  medan.dispatchEvent(new Event("change", { bubbles: true }));
}

async function alatMasukOtomatis(dok, lokasi) {
  const halaman = alatKenaliHalamanMasuk(dok, lokasi);
  if (!halaman) return { dikerjakan: false, sebab: "bukan halaman masuk" };

  if (halaman.ditolak) {
    await alatPesanLatar({ sumber: "aleta-panel", jenis: "masuk-gagal", halaman: halaman.jenis });
    return { dikerjakan: false, sebab: "ditolak" };
  }
  // Petugas sudah mengetik sendiri - tidak ditimpa.
  if (halaman.sandi.value) return { dikerjakan: false, sebab: "sudah terisi" };

  const jawaban = await alatPesanLatar({ sumber: "aleta-panel", jenis: "masuk-minta", halaman: halaman.jenis });
  if (!jawaban || jawaban.ok !== true || typeof jawaban.username !== "string" || typeof jawaban.sandi !== "string") {
    return { dikerjakan: false, sebab: (jawaban && jawaban.sebab) || "tanpa titipan" };
  }
  // Diperiksa lagi: petugas bisa mulai mengetik selama menunggu jawaban.
  if (halaman.sandi.value) return { dikerjakan: false, sebab: "sudah terisi" };
  // ABT meneruskan password akun bernama "supervisor" ke server Badilag
  // (controllers/Login.php) - password SIPP tidak pernah dikirim ke sana.
  // Tanpa peka huruf besar: MySQL ABT mencocokkan "Supervisor" = "supervisor".
  if (halaman.jenis === "abt" && jawaban.username.trim().toLowerCase() === "supervisor") {
    return { dikerjakan: false, sebab: "akun supervisor ABT" };
  }

  alatIsiMedanMasuk(halaman.nama, jawaban.username);
  alatIsiMedanMasuk(halaman.sandi, jawaban.sandi);
  if (halaman.tombol && typeof halaman.tombol.click === "function") halaman.tombol.click();
  else if (typeof halaman.blangko.requestSubmit === "function") halaman.blangko.requestSubmit();
  else halaman.blangko.submit();
  return { dikerjakan: true, jenis: halaman.jenis };
}

// Dijalankan sekali per halaman. Di halaman selain masuk SIPP/ABT ia berhenti
// pada langkah pertama tanpa menghubungi siapa pun.
try {
  if (typeof document !== "undefined" && typeof location !== "undefined") {
    void alatMasukOtomatis(document, location).catch(() => undefined);
  }
} catch {
  /* di luar konteks halaman */
}
