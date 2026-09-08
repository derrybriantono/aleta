"use strict";

/**
 * Saklar tampil/sembunyi panel.
 *
 * Hanya menyimpan tiga nilai di penyimpanan ekstensi. Tidak ada kredensial,
 * tidak ada data perkara - keduanya tetap di sesi portal dan di server.
 *
 * Tidak ada pemuatan ulang tab di sini. Skrip konten mendengarkan perubahan
 * penyimpanan sendiri, sehingga saklarnya berlaku seketika tanpa menuntut
 * izin "tabs" - izin yang memberi ekstensi kemampuan membaca alamat SELURUH
 * tab peramban, jauh lebih luas daripada yang dibutuhkan.
 */
const kotak = document.getElementById("aktif");
const kotakTanda = document.getElementById("tandaiHalaman");
const kotakSisip = document.getElementById("sisipJadwal");

/**
 * Penyimpanan ekstensi, bila memang sedang berjalan sebagai ekstensi.
 *
 * Berkas ini kadang dibuka sebagai halaman biasa - saat memeriksa tampilannya.
 * Di luar ekstensi, chrome.storage tidak ada, dan menyentuhnya melempar galat
 * yang menghentikan seluruh skrip: saklarnya lalu mati total tanpa keterangan
 * apa pun. Karena itu ketiadaannya diperlakukan sebagai keadaan yang wajar.
 */
const penyimpanan =
  typeof chrome !== "undefined" && chrome.storage && chrome.storage.local
    ? chrome.storage.local
    : null;

function pasangNilai(simpan) {
  // Panel bawaannya MENYALA: ia hanya menambah lapisan di sisi kanan.
  kotak.checked = simpan.aktif !== false;
  // Penandaan halaman bawaannya MATI. Menyisipkan tanda ke dalam halaman kerja
  // orang tanpa mereka minta bukan keputusan yang pantas diambil sendiri oleh
  // sebuah pembaruan.
  kotakTanda.checked = simpan.tandaiHalaman === true;
  // Menyisipkan ke dalam tabel SIPP lebih jauh lagi daripada menandai:
  // tampilannya menyatu, sehingga berkas ALETA terlihat seperti bagian
  // SIPP. Bawaannya mati, dan menyalakannya keputusan petugas.
  kotakSisip.checked = simpan.sisipJadwal === true;

  // Alamat portal dicatat skrip konten saat halaman SIPP dibuka. Popup
  // berjalan di origin chrome-extension://, sehingga tautan relatif di sini
  // menunjuk ke dalam ekstensi - bukan ke server.
  const tautan = document.getElementById("tautanPortal");
  if (!tautan) return;
  if (simpan.asalPortal) {
    tautan.href = simpan.asalPortal;
  } else {
    // Belum pernah membuka halaman SIPP, jadi alamatnya belum diketahui.
    // Menebak alamatnya lebih buruk daripada mengatakannya apa adanya.
    tautan.removeAttribute("href");
    tautan.textContent = "portal ALETA (buka halaman SIPP dulu)";
  }
}

if (penyimpanan) {
  penyimpanan
    .get(["aktif", "tandaiHalaman", "sisipJadwal", "asalPortal"])
    .then(pasangNilai)
    .catch(() => pasangNilai({}));
} else {
  pasangNilai({});
}

function simpan(kunci, nilai) {
  if (!penyimpanan) return;
  void penyimpanan.set({ [kunci]: nilai });
}

kotak.addEventListener("change", () => simpan("aktif", kotak.checked));
kotakTanda.addEventListener("change", () => simpan("tandaiHalaman", kotakTanda.checked));
kotakSisip.addEventListener("change", () => simpan("sisipJadwal", kotakSisip.checked));

/**
 * ============================================================================
 * MENGEMBALIKAN PANEL YANG TERGESER KELUAR LAYAR
 * ============================================================================
 *
 * Yang dihapus hanya SATU kunci - posisiPanel, tempat letak dan ukuran panel
 * disimpan. Skrip konten mendengarkan penghapusan itu lalu mengembalikan
 * panelnya ke tempat bawaan, sehingga tidak perlu memuat ulang halaman dan
 * tidak perlu izin "tabs" hanya untuk menyentuh satu tab.
 *
 * Saklar tampil/sembunyi, tema, dan lipatan menu TIDAK ikut terhapus: yang
 * hilang dari layar adalah letaknya, dan membuang pengaturan lain sekalian
 * berarti menghukum petugas atas kesalahan yang tidak ia perbuat.
 */
const tombolReset = document.getElementById("resetPosisi");
const kabarReset = document.getElementById("kabarReset");

function kabarkan(teks) {
  if (!kabarReset) return;
  kabarReset.textContent = teks;
  kabarReset.hidden = false;
}

if (tombolReset) {
  tombolReset.addEventListener("click", () => {
    if (!penyimpanan) {
      kabarkan("Penyimpanan ekstensi tidak tersedia di jendela ini.");
      return;
    }
    tombolReset.disabled = true;
    void penyimpanan
      .remove("posisiPanel")
      .then(() => {
        kabarkan("Posisi panel dikembalikan. Buka kembali halaman SIPP bila belum terlihat.");
      })
      .catch(() => {
        kabarkan("Gagal mengembalikan posisi. Coba lagi.");
      })
      .finally(() => {
        tombolReset.disabled = false;
      });
  });
}
