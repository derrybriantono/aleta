/**
 * ============================================================================
 * FORMAT TULISAN LENCANA/TAG - HURUF AWAL KAPITAL (14 Okt 2026)
 * ============================================================================
 *
 * Permintaan pengguna: semua tag/lencana bulat di Jadwal Sidang (dan tempat lain
 * yang memakai komponen lencana yang sama - Status Perkara, Jadwal Mediasi)
 * berhuruf awal kapital: "potensi verstek" -> "Potensi verstek",
 * "contradictoir" -> "Contradictoir". Sisanya dibiarkan seperti aslinya.
 *
 * SATU aturan, dipakai <Badge> (otomatis untuk anak berupa teks) dan lencana
 * buatan sendiri di Jadwal Sidang:
 *
 *   - Hanya KATA PERTAMA yang dilihat, dan hanya bila seluruhnya huruf kecil
 *     (boleh bersambung tanda hubung: "belum-upload", diakhiri tanda baca).
 *   - Kata yang memuat huruf kapital, angka, titik di tengah, garis bawah, @,
 *     garis miring, atau titik dua dibiarkan: singkatan (PNS, TNI, BAS),
 *     "e-Court", "eKTP", "v1.199.0", nomor perkara, surel, kode, alamat.
 *   - Kata berawalan "e-" (e-Court, e-Litigasi, e-court, e-summons) dibiarkan:
 *     huruf e kecil itu memang ejaannya.
 *   - Teks yang diawali bukan-huruf (angka, "·", "(", spasi) dilihat dari huruf
 *     PERTAMANYA hanya bila yang mendahuluinya spasi atau tanda kurung/kutip
 *     pembuka; "12 hari" tetap "12 hari".
 */

const KATA_KECIL = /^[a-zß-ÿ]+(?:-[a-zß-ÿ]+)*[.,;:!?)\]"'’]*$/;

/** Huruf pertama kapital bila kata pertamanya huruf kecil biasa. Murni. */
export function formatLencana(teks: string): string {
  if (typeof teks !== "string" || teks.length === 0) return teks;
  const awal = /^[\s("'“‘[]*/.exec(teks)?.[0] ?? "";
  const sisa = teks.slice(awal.length);
  const kata = /^\S+/.exec(sisa)?.[0] ?? "";
  if (!kata || !KATA_KECIL.test(kata)) return teks;
  if (/^e-/.test(kata)) return teks;
  return awal + sisa.charAt(0).toUpperCase() + sisa.slice(1);
}

/** Anak React berupa teks (atau daftar yang diawali teks) - teks pertamanya diformat. */
export function formatAnakLencana<T>(anak: T): T {
  if (typeof anak === "string") return formatLencana(anak) as unknown as T;
  if (Array.isArray(anak) && anak.length > 0 && typeof anak[0] === "string") {
    const salin = anak.slice();
    salin[0] = formatLencana(salin[0]);
    return salin as unknown as T;
  }
  return anak;
}
