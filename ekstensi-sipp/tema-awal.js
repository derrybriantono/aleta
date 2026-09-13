"use strict";

/**
 * ============================================================================
 * TEMA DIPASANG SEBELUM HALAMAN DIGAMBAR
 * ============================================================================
 *
 * Gejalanya: halaman SIPP berkelebat PUTIH lebih dulu, lalu berubah gelap
 * sepersekian detik kemudian. Paling terasa pada daftar perkara yang panjang
 * dan tiap kali membuka satu perkara - yakni pada dua halaman yang paling
 * sering dibuka. Bagi mata, kelebat putih di antara dua halaman gelap lebih
 * menyakitkan daripada halaman yang terang sepanjang waktu.
 *
 * SEBABNYA URUTAN, BUKAN BERAT
 *
 * Gayanya sendiri sudah siap sejak awal - panel.css dipasang sebagai berkas
 * gaya content script, dan peramban menerapkannya sebelum menggambar. Yang
 * datang terlambat adalah PENANDANYA: data-aleta-tema-sipp baru dipasang di
 * dalam segarkan(), yang berjalan pada document_idle, sesudah menunggu
 * chrome.storage.local yang asinkron.
 *
 * Jadi halaman digambar dulu dengan gaya SIPP asli, dan baru sesudah itu
 * penandanya menyala dan seluruh warna berubah sekaligus.
 *
 * KENAPA localStorage, PADAHAL SUMBER KEBENARANNYA chrome.storage
 *
 * chrome.storage.local hanya dapat dibaca secara asinkron. Apa pun yang
 * menunggunya sudah pasti terlambat - janji yang paling cepat pun selesai
 * sesudah gambar pertama.
 *
 * localStorage halaman ini SINKRON. Berkas ini karena itu membaca salinan
 * temanya dari sana pada document_start - sebelum satu piksel pun digambar -
 * lalu memasang penandanya seketika. chrome.storage tetap sumber kebenarannya;
 * salinan di localStorage hanya cache yang ditulis ulang tiap kali temanya
 * berubah (lihat simpanSalinanTema di konten.js).
 *
 * Yang dititipkan ke penyimpanan aplikasi orang lain hanya SATU kunci berisi
 * satu kata, "gelap" atau "terang". Itu harga yang disebut terus-terang: tanpa
 * cache sinkron, kelebat putihnya tidak dapat dihilangkan sama sekali.
 *
 * Pada kunjungan pertama - ketika cache-nya memang belum ada - dipakai bawaan
 * yang sama dengan bawaan panel: gelap. Yang pernah memilih terang tidak akan
 * pernah melihat kelebat gelap, sebab pilihannya sudah tersalin sejak
 * pemuatan sebelumnya.
 */

const KUNCI_SALINAN = "aleta-tema-sipp";

/**
 * ============================================================================
 * SIPP DAN ABT DIBEDAKAN DI SINI, BUKAN DI DALAM CSS
 * ============================================================================
 *
 * Keduanya berbagi satu berkas gaya dan satu penanda tema, dan itu memang
 * disengaja - keduanya satu origin, sehingga tema yang dipilih di salah
 * satunya langsung berlaku di yang lain. Tetapi DOM-nya berbeda jauh:
 *
 *   SIPP  #konten  .cssTable  #tableDetilPerkara  .detil  .usual
 *   ABT   #content #wrapper   .about              .agile_wthree_inner_grids
 *
 * Peta warna SIPP karena itu tidak menyentuh satu pun elemen ABT. Yang
 * berlaku di sana hanya aturan html dan body - halamannya menjadi hitam
 * sementara tulisannya tetap hijau tua, merah, dan biru tua milik ABT sendiri.
 * Itulah "garis dan tulisannya tidak nampak": bukan warnanya salah pilih,
 * melainkan tidak ada satu pun aturan yang mengaturnya.
 *
 * Penandanya dipasang DI SINI, pada document_start, bersama penanda tema -
 * bukan sesudah panel muncul. Peta warna ABT karena itu sudah berlaku pada
 * gambar pertama, sama seperti temanya.
 */
(function tandaiHalaman() {
  try {
    if (window.location.pathname.indexOf("/aps_badilag/") === 0) {
      document.documentElement.setAttribute("data-aleta-halaman", "abt");
    }
  } catch {
    /* tanpa penandanya, ABT hanya kehilangan peta warnanya - bukan temanya */
  }
})();

(function pasangSedini() {
  let tema = "gelap";
  try {
    const tersimpan = window.localStorage.getItem(KUNCI_SALINAN);
    if (tersimpan === "terang" || tersimpan === "gelap" || tersimpan === "mati") {
      tema = tersimpan;
    }
  } catch {
    // Penyimpanan halaman tidak tersedia - mode penjelajahan tertentu
    // menolaknya. Bawaan gelap tetap dipakai, dan konten.js akan
    // memperbaikinya sesudah membaca chrome.storage.
  }

  // "mati" berarti petugas mematikan lapisan gelap untuk SIPP. Tidak ada
  // penanda yang dipasang, dan halamannya tampil asli sejak awal - tanpa
  // kelebat gelap sedikit pun.
  if (tema === "gelap") {
    document.documentElement.setAttribute("data-aleta-tema-sipp", "gelap");
  }

  // ==========================================================================
  // WARNA GELAP PILIHAN - DIPASANG PADA GAMBAR PERTAMA, SEPERTI TEMANYA
  // ==========================================================================
  //
  // Enam palet gelap super admin (lihat panel.css). Sama seperti temanya:
  // sumber kebenarannya chrome.storage, salinannya di localStorage supaya
  // dapat dibaca SINKRON di sini. Tanpa salinan ini halaman lahir hijau SIPP
  // lalu berganti warna sesudah panel muncul - kelebat yang persis hendak
  // dihilangkan berkas ini.
  //
  // Hanya dipasang bila temanya gelap: palet gelap di atas halaman terang
  // bukan warna, melainkan kerusakan.
  if (tema === "gelap") {
    try {
      const warna = window.localStorage.getItem("aleta-warna-gelap");
      if (warna && /^[a-z]{3,12}$/.test(warna)) {
        document.documentElement.setAttribute("data-aleta-warna", warna);
      }
    } catch {
      /* tanpa salinannya, warna bawaan berlaku sampai panel memperbaikinya */
    }
  }
})();
