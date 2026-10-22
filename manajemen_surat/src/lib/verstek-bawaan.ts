import type { SidangRiwayat } from "./bawaan-tunda";

/**
 * Centang "Verstek" bawaan di form Putus Jadwal Sidang (keputusan hakim 22 Okt 2026):
 * gugatan yang Tergugat/Termohonnya BELUM PERNAH hadir - sidang terdahulu maupun
 * kehadiran yang dipilih hari ini - tercentang dengan sendirinya; jenis putusan
 * dicabut, tidak dapat diterima, dicoret (dan gugur, yang berarti Penggugat tidak
 * hadir sehingga bukan verstek) membuatnya tidak tercentang.
 *
 * Sandi dihadiri_oleh SIPP: 1 semua pihak, 2 pihak pertama saja, 3 pihak kedua
 * saja, 4 tidak hadir.
 */
const TERGUGAT_HADIR = new Set([1, 3]);

const STATUS_TANPA_VERSTEK = /cabut|tidak\s+dapat\s+diterima|niet|coret|gugur/i;

/** Jenis putusan yang tidak pernah verstek. */
export function statusTanpaVerstek(namaStatus: string | null | undefined): boolean {
  return STATUS_TANPA_VERSTEK.test(String(namaStatus || ""));
}

/**
 * true = Tergugat belum pernah hadir. null = riwayat tidak terbaca (tidak menebak:
 * centang tetap mati seperti dulu).
 */
export function tergugatBelumPernahHadir(
  riwayat: SidangRiwayat[] | null | undefined,
  jadwalIdSekarang: number,
  dihadiriHariIni: number
): boolean | null {
  if (!Array.isArray(riwayat)) return null;
  if (TERGUGAT_HADIR.has(Number(dihadiriHariIni))) return false;
  return !riwayat.some(
    (r) => r.jadwalId !== jadwalIdSekarang && TERGUGAT_HADIR.has(Number(r.dihadiriOleh))
  );
}

/** Nilai centang Verstek bawaan untuk form Putus. */
export function verstekBawaan(bahan: {
  gugatan: boolean;
  riwayat: SidangRiwayat[] | null | undefined;
  jadwalIdSekarang: number;
  dihadiriHariIni: number;
  namaStatus: string | null | undefined;
}): boolean {
  if (!bahan.gugatan || statusTanpaVerstek(bahan.namaStatus)) return false;
  return tergugatBelumPernahHadir(bahan.riwayat, bahan.jadwalIdSekarang, bahan.dihadiriHariIni) === true;
}
