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
 * Mengubah ukuran panel dari sudut kiri-bawah.
 *
 * Sudut KIRI, bukan kanan: panel menempel di tepi kanan layar, dan sudut kanan
 * bawahnya sering berada di luar jangkauan atau di atas bilah gulir halaman.
 */
function alatPasangUbahUkuran(panel, kunci) {
  const pegangan = document.createElement("div");
  // Memakai kelas pegangan yang SUDAH ada di panel.css, bukan kelas baru:
  // ukuran, kursor, dan lapisannya sudah diputuskan di sana, dan kelas kedua
  // yang mirip pasti berselisih dengan yang pertama.
  pegangan.className = "aleta-tarik aleta-tarik--sudut aleta-tarik--sb";
  pegangan.title = "Tarik untuk mengubah ukuran panel";
  panel.appendChild(pegangan);

  let tarik = null;

  pegangan.addEventListener("pointerdown", (peristiwa) => {
    alatNormalkanJangkar(panel);
    const kotak = panel.getBoundingClientRect();
    tarik = {
      x: peristiwa.clientX,
      y: peristiwa.clientY,
      lebar: kotak.width,
      tinggi: kotak.height,
      kiri: kotak.left,
    };
    try {
      pegangan.setPointerCapture(peristiwa.pointerId);
    } catch {
      /* tidak semua peramban mengizinkannya */
    }
    peristiwa.preventDefault();
    peristiwa.stopPropagation();
  });

  pegangan.addEventListener("pointermove", (peristiwa) => {
    if (!tarik) return;
    const geserX = peristiwa.clientX - tarik.x;
    const lebar = Math.min(Math.max(tarik.lebar - geserX, 280), Math.min(window.innerWidth - 20, 900));
    const tinggi = Math.max(tarik.tinggi + (peristiwa.clientY - tarik.y), 160);
    panel.style.width = `${Math.round(lebar)}px`;
    panel.style.height = `${Math.round(tinggi)}px`;
    panel.style.maxHeight = "none";
    // Tepi kanannya diam: yang ditarik sudut kiri, jadi kirinya yang bergerak.
    panel.style.left = `${Math.round(tarik.kiri + (tarik.lebar - lebar))}px`;
    panel.dataset.tinggiSendiri = "1";
  });

  const selesai = () => {
    if (!tarik) return;
    tarik = null;
    const kotak = panel.getBoundingClientRect();
    alatSimpanPosisi(kunci, {
      kiri: Math.round(kotak.left),
      atas: Math.round(kotak.top),
      lebar: Math.round(kotak.width),
      tinggi: Math.round(kotak.height),
    });
  };

  pegangan.addEventListener("pointerup", selesai);
  pegangan.addEventListener("pointercancel", selesai);
}

/**
 * Tombol-tombol kepala panel.
 *
 * Urutannya dari yang paling sering dipakai ke yang paling jarang: tema, ciut,
 * layar penuh, kembalikan bawaan, tutup. Tombol tutup paling kanan dan paling
 * akhir - sebab ia yang paling mahal salah tekan.
 */
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

  // ── Tema panel ────────────────────────────────────────────────────────────
  //
  // Yang diganti tema PANEL, bukan tema halaman ABT. Mewarnai ulang aplikasi
  // orang lain menuntut peta warna tersendiri - tiap kelas dan tiap latar
  // dipasangkan satu per satu, seperti yang dikerjakan untuk SIPP - dan
  // separuh peta menghasilkan halaman yang setengah berubah, yang lebih buruk
  // daripada tidak berubah sama sekali.
  const tema = buat("aleta-tema", "", "Ganti tema panel ALETA", async () => {
    const baru = panel.getAttribute("data-tema") === "gelap" ? "terang" : "gelap";
    panel.setAttribute("data-tema", baru);
    tema.textContent = baru === "gelap" ? "☀" : "☾";
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
  const ciut = buat("aleta-lipat", "–", "Ciutkan panel", () => {
    const sedang = panel.classList.toggle("aleta-panel-ciut");
    ciut.textContent = sedang ? "▢" : "–";
    ciut.title = sedang ? "Bentangkan panel" : "Ciutkan panel";
    if (!sedang) alatJepitTinggi(panel);
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

  try {
    const simpan = await chrome.storage.local.get([pilihan.kunciTema || "temaPanel"]);
    const tema = simpan[pilihan.kunciTema || "temaPanel"];
    panel.setAttribute("data-tema", tema === "terang" ? "terang" : "gelap");
    const tombolTema = kepala.querySelector(".aleta-tema");
    if (tombolTema) tombolTema.textContent = tema === "terang" ? "☾" : "☀";
  } catch {
    panel.setAttribute("data-tema", "gelap");
  }

  alatNormalkanJangkar(panel);
  alatTerapkanPosisi(panel, await alatMuatPosisi(kunci));
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
