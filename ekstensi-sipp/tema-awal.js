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
})();
