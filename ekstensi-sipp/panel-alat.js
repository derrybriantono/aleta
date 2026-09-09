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
 * Karena itu berkas ini berdiri sendiri untuk sekarang, dan utangnya dicatat:
 * SESUDAH panel ABT terbukti bekerja di layar sungguhan, konten.js
 * dipindahkan ke sini dan salinannya di sana dibuang. Jangan menambah fungsi
 * baru ke salah satunya tanpa menambahkannya ke keduanya.
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

  const kotak = panel.getBoundingClientRect();
  const sisa = Math.max(window.innerHeight - kotak.top - 12, 160);
  const idaman = Math.max(Math.round(window.innerHeight * 0.6), 220);
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

  kepala.addEventListener("pointerdown", (peristiwa) => {
    // Tombol di dalam kepala tidak boleh ikut menggeser - yang menekan tombol
    // tutup tidak sedang memindahkan panel.
    if (peristiwa.target.closest("button, a, input, select, textarea")) return;
    if (peristiwa.button !== 0) return;

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
      kepala.setPointerCapture(peristiwa.pointerId);
    } catch {
      /* tidak semua peramban mengizinkannya - geser tetap berjalan */
    }
    peristiwa.preventDefault();
  });

  kepala.addEventListener("pointermove", (peristiwa) => {
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

  kepala.addEventListener("pointerup", selesai);
  kepala.addEventListener("pointercancel", selesai);
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
