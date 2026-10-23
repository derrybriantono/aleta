/**
 * ============================================================================
 * TEMA DIPASANG SEBELUM HALAMAN DIGAMBAR - OLEH SATU PUSAT
 * ============================================================================
 *
 * Gejalanya: halaman berkelebat PUTIH lebih dulu lalu gelap (atau sebaliknya),
 * dan berganti-ganti tiap pindah halaman. Penyebab dan aturan lengkapnya ada di
 * tema-pusat.js; berkas ini hanya MEMULAINYA pada document_start, sebelum
 * satu piksel pun digambar.
 *
 * Yang dikerjakan pusat pada saat ini, semuanya sinkron:
 *
 *   - membaca salinan pilihan (terang | gelap | sistem) dari localStorage
 *     origin yang sama - kunci aleta-tema-pilihan, juga dipakai portal ALETA
 *     sehingga ketiga aplikasi memakai SATU salinan;
 *   - bila pilihannya "sistem", menanyakan prefers-color-scheme di jendela
 *     halaman ini (matchMedia) dan memantau perubahannya;
 *   - memasang data-aleta-tema-sipp / data-aleta-tema pada <html>.
 *
 * chrome.storage hanya asinkron - apa pun yang menunggunya terlambat. Ia
 * dibaca SESUDAH itu hanya untuk menyegarkan: bila isinya sama dengan yang
 * sudah terpasang, tidak ada penulisan dan tidak ada perubahan atribut
 * sama sekali (itulah yang menghentikan kedip antar halaman).
 *
 * Nilai lama tetap terbaca (aleta-tema-sipp: terang/gelap/mati) dan
 * dipetakan oleh pusat; "mati" menjadi pilihan gelap dengan lapisan SIPP
 * dimatikan - saklar itu kini punya kunci sendiri (aleta-tema-lapisan).
 *
 * Pada kunjungan pertama - ketika salinannya memang belum ada - dipakai bawaan
 * yang sama dengan bawaan panel: gelap.
 */

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
  const pusat = globalThis.AletaTemaPusat;
  if (!pusat) return;
  const keadaan = pusat.mulai();

  // Portal ALETA memegang tampilannya sendiri; di sana pusat hanya menjembatani.
  if (pusat.halaman() === "portal") return;
  const tema = keadaan.resolusi;

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
  const pasangWarna = () => {
    try {
      const warna = window.localStorage.getItem("aleta-warna-gelap");
      if (warna && /^[a-z]{3,12}$/.test(warna)) {
        if (document.documentElement.getAttribute("data-aleta-warna") !== warna) {
          document.documentElement.setAttribute("data-aleta-warna", warna);
        }
      }
    } catch {
      /* tanpa salinannya, warna bawaan berlaku sampai panel memperbaikinya */
    }
  };
  if (tema === "gelap") pasangWarna();
  // Tema yang kemudian berganti menjadi gelap (dari popup, tab lain, atau
  // sistem) membawa palet pilihannya pula.
  pusat.dengar((s) => {
    if (s.resolusi === "gelap") pasangWarna();
  });
})();
