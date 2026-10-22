/**
 * Tujuan sesudah masuk ALETA (22 Okt 2026).
 *
 * Menu "E-Court" di bilah atas SIPP mengantar pengguna yang belum masuk ALETA ke
 * halaman masuk dengan ?kembali=<jalur>, supaya sesudah masuk ia mendarat di
 * formulir yang dimaksud, bukan di beranda. Jalur itu datang dari alamat yang
 * dapat diketik siapa pun, jadi HANYA jalur di dalam portal sendiri yang diikuti:
 * harus dimulai satu garis miring, tanpa nama situs, tanpa garis miring ganda
 * atau terbalik, tanpa aksara kendali. Selain itu -> bawaan.
 */
export function tujuanKembaliAman(mentah: unknown, bawaan = "/portal"): string {
  if (typeof mentah !== "string") return bawaan;
  const jalur = mentah.trim();
  if (!jalur || jalur.length > 300) return bawaan;
  if (!jalur.startsWith("/") || jalur.startsWith("//") || jalur.startsWith("/\\")) return bawaan;
  if (/[\u0000-\u001f\u007f\\]/.test(jalur)) return bawaan;
  if (/^\/[a-z][a-z0-9+.-]*:/i.test(jalur) || jalur.includes("://")) return bawaan;
  // Bukan ke halaman masuk lagi dan bukan ke rute API (dapat memutar atau menampilkan JSON mentah).
  if (/^\/(?:login|api)(?:[/?#]|$)/i.test(jalur)) return bawaan;
  return jalur;
}
