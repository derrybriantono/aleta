/**
 * ============================================================================
 * KODE MAJELIS - LEBIH BESAR DAN TEBAL (5 Oktober 2026, butir 4)
 * ============================================================================
 *
 * Diminta pengguna: kode majelis ("C1-C2-C3" dari SIPP, "C1|C2|C3" dari
 * aplikasi antrian) di Jadwal Sidang dan layar-layar antrian dibuat agak besar
 * dan tebal - itulah yang dicari petugas yang memanggil perkara di depan ruang
 * sidang, dan sebelumnya ia sekecil keterangan di sekitarnya.
 *
 * Ukurannya RELATIF (1.1em) supaya satu kelas berlaku di konteks yang ukuran
 * dasarnya berbeda-beda (sel tabel text-sm, layar ruang tunggu text-2xl) -
 * selalu sedikit lebih besar daripada teks di sekitarnya, tidak melompat.
 * whitespace-nowrap: kode tidak boleh patah di tanda hubung / garis tegak
 * (lihat catatan di sel Majelis & Petugas). Warna tidak ditetapkan di sini -
 * layar gelap ruang tunggu memakai warnanya sendiri.
 */
export const KELAS_KODE_MAJELIS = "whitespace-nowrap font-mono text-[1.1em] font-bold tracking-tight";

/** Lencana kode majelis di kolom Majelis & Petugas (mode Lengkap). Dulu text-xs font-semibold. */
export const KELAS_LENCANA_KODE_MAJELIS = "whitespace-nowrap rounded bg-muted px-1 py-0.5 font-mono text-sm font-bold";
