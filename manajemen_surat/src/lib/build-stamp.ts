/**
 * ============================================================================
 * CAP BUILD - MENJAWAB "APAKAH YANG BARU SUDAH HIDUP?"
 * ============================================================================
 *
 * `APP_VERSION` di `patch-notes.ts` dinaikkan manusia dan menandai RILIS.
 * Cap ini dihitung Docker dan menandai BUILD. Keduanya berbeda pertanyaan:
 *
 *   APP_VERSION  -> "fitur apa yang ada di versi ini?"
 *   cap build    -> "apakah yang saya naikkan barusan sudah benar-benar jalan?"
 *
 * Pertanyaan kedua tidak terjawab sebelum ini ada. Pada 6 Sep 2026 empat
 * penaikan berturut-turut sama-sama menyebut 1.86.0, sehingga satu-satunya
 * cara memeriksanya adalah memanggil rute yang hanya ada di versi baru dan
 * melihat 401 lawan 404. Cara itu bekerja, tetapi menuntut orang mengetahui
 * rute mana yang baru - pengetahuan yang menguap seminggu kemudian.
 *
 * ============================================================================
 * DIISI SAAT MEMBANGUN, BUKAN SAAT MENJALANKAN
 * ============================================================================
 *
 * Nilainya disuntikkan ke berkas kelolaan saat `next build`, sehingga tidak
 * dapat berubah tanpa membangun ulang - dan itulah gunanya. Cap yang dapat
 * diubah tanpa build akan berbohong tentang kode yang sedang berjalan.
 *
 * Kosong pada pengembangan lokal, dan yang memakainya harus menghilangkan
 * tampilannya alih-alih menulis "tidak diketahui" - baris kosong lebih jujur
 * daripada keterangan yang tidak berarti apa-apa.
 */
export const BUILD_STAMP = process.env.NEXT_PUBLIC_ALETA_BUILD_STAMP ?? "";

/**
 * Bentuk siap tampil, atau kosong bila capnya memang tidak ada.
 *
 * Sengaja tidak mengembalikan "-" atau "tidak diketahui": keduanya menempati
 * ruang di layar tanpa memberi tahu apa pun.
 */
export function capBuildTerbaca(): string {
  const cap = BUILD_STAMP.trim();
  return cap ? `build ${cap}` : "";
}
