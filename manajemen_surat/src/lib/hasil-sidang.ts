/**
 * ============================================================================
 * HASIL SIDANG - DIBACA DARI KOLOM YANG SAMA DENGAN ALASAN TUNDAAN
 * ============================================================================
 *
 * SIPP tidak punya kolom hasil sidang pada perkara_jadwal_sidang - diperiksa
 * lewat SHOW COLUMNS. Yang ada `ditunda` dan `alasan_ditunda`, dan panitera
 * sidang memakai SATU kolom itu untuk dua hal yang berbeda:
 *
 *   ditunda = Y   alasan_ditunda berisi AGENDA BERIKUTNYA
 *                 "Panggil Tergugat", "Pembacaan Putusan", "Mediasi"
 *   ditunda = T   alasan_ditunda berisi HASIL SIDANGNYA
 *                 "putus DIKABULKAN (verstek)", "putus DICABUT"
 *
 * Karena itu yang memisahkan keduanya BUKAN isi tulisannya, melainkan bendera
 * `ditunda` milik SIPP sendiri. Memisahkannya dengan menebak kata akan salah
 * pada dua arah sekaligus - dan keduanya ada di data:
 *
 *   "Pembacaan Putusan"                        58 baris, ditunda = Y
 *   "Musyawarah Majelis dan Pembacaan Putusan" 21 baris, ditunda = Y
 *
 * Keduanya mengandung kata "putusan" tetapi bukan hasil sidang - itu agenda
 * sidang berikutnya. Menghijaukannya berarti mengumumkan perkara sudah putus
 * padahal sidangnya baru ditunda untuk pembacaannya.
 *
 * ============================================================================
 * DIUKUR DI PA DONGGALA - 20.063 BARIS JADWAL SIDANG
 * ============================================================================
 *
 *   ditunda = T   3.909 mengandung "putus", 7.395 lainnya, 311 kosong
 *   ditunda = Y     124 mengandung "putus", 8.321 lainnya,   3 kosong
 *
 * Yang 7.395 itu bukan hasil sidang: 6.207 di antaranya berisi angka "0"
 * belaka - nilai bawaan yang tidak pernah diisi - dan sisanya agenda yang
 * terlanjur diketik tanpa menandai tundaannya. Karena itu baris ditunda = T
 * pun masih disaring: hanya yang benar-benar menyebut "putus" yang
 * ditampilkan sebagai hasil.
 *
 * Sisanya sengaja TIDAK ditampilkan. Menampilkan "0" sebagai hasil sidang
 * lebih buruk daripada tidak menampilkan apa pun.
 */

/** Angka bawaan yang tidak pernah diisi - 6.207 baris berisi ini. */
const BUKAN_ISI = new Set(["", "0", "-", "null", "undefined"]);

/**
 * Hasil sidang yang layak ditampilkan, atau kosong bila tidak ada.
 *
 * @param ditunda bendera SIPP - benar berarti isinya agenda berikutnya
 * @param alasan  isi kolom alasan_ditunda apa adanya
 */
export function hasilSidangPutusan(ditunda: boolean, alasan: string): string {
  // Bendera SIPP menang atas isi tulisannya. Lihat catatan di atas.
  if (ditunda) return "";

  const teks = String(alasan || "").trim();
  if (BUKAN_ISI.has(teks.toLowerCase())) return "";

  // "putus", "Putus", "putus DIKABULKAN", "Putus Verstek" - dan juga bentuk
  // gabungan "Panggil Tergugat\nputus verstek" yang 35 baris memakainya.
  if (!/\bputus\b/i.test(teks)) return "";

  // Baris ganda dirapatkan menjadi satu baris: kolomnya sempit, dan tulisan
  // yang menjulur ke bawah menggeser seluruh baris tabel di sebelahnya.
  return teks
    .split(/[\r\n]+/)
    .map((x) => x.trim())
    .filter(Boolean)
    .join(" · ");
}

/**
 * Benar bila barisnya perlu diberi kotak hasil sidang.
 *
 * Dipisah dari fungsi di atas supaya layar tidak perlu membandingkan string
 * kosong untuk memutuskan menggambar atau tidak.
 */
export function adaHasilSidang(ditunda: boolean, alasan: string): boolean {
  return hasilSidangPutusan(ditunda, alasan) !== "";
}

/**
 * Kolom alasan_ditunda BERISI sesuatu - apa pun isinya, asal bukan nilai
 * bawaan yang tidak pernah diisi (BUKAN_ISI).
 *
 * Berbeda dari hasilSidangPutusan, yang hanya mau "putus". Pertanyaan di sini
 * "sudahkah panitera mencatat SESUATU", dan "telah ikrar talak" - 127 baris di
 * satker, 2025 s.d. September 2026 - adalah catatan hasil walau bukan putusan.
 */
export function alasanTerisi(alasan: string | null | undefined): boolean {
  return !BUKAN_ISI.has(String(alasan ?? "").trim().toLowerCase());
}
