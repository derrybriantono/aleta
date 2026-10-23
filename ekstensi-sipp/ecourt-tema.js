"use strict";

/**
 * ============================================================================
 * TEMA GELAP e-COURT (situs ecourt.mahkamahagung.go.id) - 23 Okt 2026
 * ============================================================================
 *
 * Berkas ini hanya MEMULAI pusat tema (tema-pusat.js) pada document_start,
 * sebelum satu piksel pun digambar. Warnanya ada di ecourt-tema.css, yang
 * baru berlaku ketika <html> membawa data-aleta-tema-ecourt="gelap".
 *
 * Batas yang dijaga:
 *   - tidak mengubah isi atau perilaku situs, tidak menyembunyikan apa pun,
 *     tidak mengirim apa pun, tidak membaca isi halaman;
 *   - satu-satunya jejak di halaman: atribut data-aleta-tema-ecourt di <html>
 *     (hanya saat gelap dan saklarnya menyala) dan salinan pilihan di
 *     localStorage origin e-Court supaya tak berkedip antar halaman;
 *   - pilihan terang | gelap | sistem SATU sumber dengan SIPP/ABT/portal
 *     (tema-pusat.js); halaman e-Court hanya mengikutinya, tidak menulisnya;
 *   - "terang" = situs apa adanya; saklar "Tema gelap di e-Court" di popup
 *     (kunci temaEcourt, bawaan menyala) mematikan lapisan seluruhnya.
 */
(function pasangTemaEcourt() {
  const pusat = globalThis.AletaTemaPusat;
  if (!pusat || pusat.halaman() === "portal") return;
  pusat.mulai();
})();
