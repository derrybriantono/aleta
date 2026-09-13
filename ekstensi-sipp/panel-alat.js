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

  lencana.addEventListener("click", bentangkan);
  lencana.addEventListener("dblclick", (peristiwa) => {
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
    alatSimpanPosisi(kunci, {
      kiri: Math.round(kotak.left),
      atas: Math.round(kotak.top),
      lebar: Math.round(kotak.width),
      tinggi: panel.dataset.tinggiSendiri === "1" ? Math.round(kotak.height) : 0,
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

function alatDaftarkanPanelTema(panel, pilihan) {
  if (!panel) return;
  if (alatPanelTema.some((x) => x.panel === panel)) return;
  alatPanelTema.push({ panel, pilihan: pilihan || {} });
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

function alatSelaraskanWarna(nama) {
  alatTanpaTransisi(() => {
    if (alatPanelTema.length === 0) {
      alatTerapkanWarna(null, nama, false);
      return;
    }
    for (const { panel } of alatPanelTema) {
      if (!panel.isConnected) continue;
      alatTerapkanWarna(panel, nama, false);
      const pemilih = panel.querySelector(".aleta-warna-pilih");
      if (pemilih && typeof pemilih.aletaTandai === "function") pemilih.aletaTandai(nama || "");
    }
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
function alatTerapkanWarna(panel, nama, simpan) {
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
  try {
    void chrome.storage.local.set({ [KUNCI_WARNA_GELAP]: bersih });
  } catch {
    /* di luar konteks ekstensi */
  }
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
      alatTerapkanWarna(panel, nama, true);
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
  return pintasan;
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

  if (typeof pilihan.saatTutup === "function") {
    buat("aleta-matikan", "×", "Sembunyikan panel untuk halaman ini", pilihan.saatTutup);
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

  // Lencana dipasang pada panel yang SAMA, dan digeser lewat perkakas yang
  // sama pula - hanya pegangannya yang berbeda. Kepalanya tidak dapat
  // dipakai sebagai pegangan saat menciut, sebab ia yang disembunyikan.
  const lencana = alatPasangLencana(panel, kunci);
  alatPasangGeser(panel, lencana, kunci);

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
    const warna = await alatWarnaTersimpan();
    alatTerapkanWarna(panel, warna, false);
    const kepalaAlat = kepala.querySelector(".aleta-alat-kepala");
    if (kepalaAlat) alatPemilihWarna(panel, kepalaAlat, pilihan);
    const pemilih = kepala.querySelector(".aleta-warna-pilih");
    if (pemilih && typeof pemilih.aletaTandai === "function") pemilih.aletaTandai(warna);
  } catch {
    /* warna bawaan berlaku */
  }

  // Lingkungan, bilah gulir, dan mode kering dipasang di sini supaya ketiga
  // panel mendapatkannya tanpa satu baris tambahan di masing-masing berkas.
  alatTandaiLingkungan(panel);
  alatPasangGulir(panel);
  alatDaftarkanPanelTema(panel, pilihan);
  alatDengarkanTemaPalet();
  void alatMuatKering();

  alatNormalkanJangkar(panel);
  const posisiTersimpan = await alatMuatPosisi(kunci);
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
    return { kunci: "peladen", label: "PELADEN", judul: `SIPP peladen ${ALAT_INANG_PELADEN} - data perkara SUNGGUHAN.` };
  }
  if (inang === "127.0.0.1" || inang === "localhost" || inang === "::1") {
    return { kunci: "lokal", label: "LOKAL", judul: "SIPP di komputer ini - salinan untuk uji coba, bukan data peladen." };
  }
  return { kunci: "lain", label: inang || "?", judul: `SIPP di ${inang || "alamat yang tidak dikenali"} - bukan peladen, bukan komputer ini.` };
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

    if (alatKeringMenahan(alamat, opsi || masukan)) {
      alatCatat("kering", `DITAHAN ${cara} ${alatRingkasAlamat(alamat)}`, "mode kering aktif");
      return alatJawabanKering(alamat, opsi || masukan);
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

// Pemantau dipasang saat berkas ini dimuat, bukan saat panel digambar:
// permintaan paling awal - pembacaan konteks perkara - berangkat sebelum
// panelnya ada, dan justru itu yang paling sering gagal.
alatPasangPemantauAmbil();
alatDengarkanKering();
void alatMuatKering();
