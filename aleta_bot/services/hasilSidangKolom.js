"use strict";

/**
 * HASIL SIDANG YANG DIKETIK DI KOLOM KETERANGAN (22 Okt 2026)
 *
 * Hasil sidang lazimnya diketik di alasan_ditunda ("putus DIKABULKAN (verstek)").
 * Sebagian petugas mengetiknya di kolom `keterangan` jadwal sidang dan membiarkan
 * alasan_ditunda kosong atau "0" - contoh 609/Pdt.G/2026 sidang 22 Okt:
 * keterangan "putus kabul verstek", alasan_ditunda "0". Diukur di server: 1.198
 * sidang ditunda='T' yang hasil putusnya HANYA ada di keterangan ("Putus",
 * "Putus Verstek", "Putus Kabul", "Putus Dikabulkan", ...). Akibatnya Jadwal
 * Sidang tidak mengenali putusnya, dan tunda otomatis dapat menunda sidang yang
 * sudah diputus.
 *
 * Aturannya: sidang yang TIDAK ditunda, alasan_ditunda kosong/"0"/"-", dan
 * keterangannya memuat kata "putus" -> keterangan dibaca sebagai hasil sidang.
 * Bendera ditunda='Y' tetap menang (isinya agenda berikutnya). Kata "putus"
 * sebagai kata utuh diperiksa lagi di portal (hasilSidangPutusan).
 */
function sqlAlasanHasil(alias) {
  const a = alias ? `${alias}.` : "";
  return `(CASE WHEN COALESCE(${a}ditunda, '') <> 'Y'
              AND TRIM(COALESCE(${a}alasan_ditunda, '')) IN ('', '0', '-')
              AND LOWER(COALESCE(${a}keterangan, '')) LIKE '%putus%'
            THEN ${a}keterangan ELSE ${a}alasan_ditunda END)`;
}

module.exports = { sqlAlasanHasil };
