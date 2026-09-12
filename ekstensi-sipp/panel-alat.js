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
    Math.max(Math.round(window.innerHeight / 3), 240),
    Math.round(window.innerHeight / 2)
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
    if (peristiwa.target.closest("button, a, input, select, textarea")) return;
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
function alatTombolKepala(panel, kunci, opsi) {
  const pilihan = opsi || {};
  const wadah = document.createElement("span");
  wadah.className = "aleta-alat-kepala";

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
    panel.setAttribute("data-tema", baru);
    tema.textContent = baru === "gelap" ? "☀" : "☾";
    if (pilihan.temaHalaman) alatTerapkanTemaHalaman(baru);
    try {
      await chrome.storage.local.set({ [pilihan.kunciTema || "temaPanel"]: baru });
    } catch {
      /* temanya tetap berlaku untuk halaman ini */
    }
  });
  tema.textContent = panel.getAttribute("data-tema") === "gelap" ? "☀" : "☾";

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

async function alatSekaliAmbil(alamat, opsi) {
  const pembatal = new AbortController();
  const jam = setTimeout(() => pembatal.abort(), ALAT_BATAS_MS);
  try {
    return await fetch(alamat, { ...(opsi || {}), signal: pembatal.signal });
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
