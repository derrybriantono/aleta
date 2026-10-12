/**
 * ============================================================================
 * PIHAK YANG SUDAH HADIR HARI INI (12 Okt 2026, butir 18)
 * ============================================================================
 *
 * Permintaan pengguna: pihak yang sudah hadir diberi warna hijau dan tulisan
 * "(hadir)" di kolom Perkara & Para Pihak. Jamnya TIDAK ditulis di nama: jam
 * per sisi sudah ada di kolom Antrian ("P 09:21 T 08:37") dan itu tetap.
 *
 * SUMBERNYA ANTRIAN HARI INI, BUKAN dihadiriOleh SIPP
 * ---------------------------------------------------
 * `dihadiriOleh` adalah HASIL sidang yang dicatat panitera sesudahnya, dan
 * kolomnya sudah berisi nilai sebelum sidang berjalan (sandi 2 "pihak pertama
 * saja" paling sering) - memakainya akan menghijaukan orang yang belum
 * datang. Kedatangan sungguhan tercatat di antrian (kolom pihak1/pihak2 bila
 * terisi jam). Membatalkan kehadiran (Reset) mengosongkan kolomnya, sehingga
 * nama kembali normal tanpa kerja tambahan.
 *
 * Antrian dicatat per SISI (penggugat/pemohon = 1, tergugat/termohon = 2) dan
 * tidak membedakan pihak sendiri dari kuasanya; yang diberi tanda karenanya
 * adalah sisinya. Turut tergugat dan intervensi tidak punya kolom antrian,
 * jadi tidak pernah ditandai (tidak menebak).
 *
 * Hanya berlaku bila sidangnya HARI INI: antrian yang tanggalnya tidak cocok
 * sudah dibuang oleh antrianUntuk(), dan di sini ditambah syarat tanggal
 * sidang = hari ini supaya jadwal hari lain tidak tampak "sudah hadir".
 */

export type BahanKehadiranAntrian =
  | {
      pihak1?: string | null;
      pihak2?: string | null;
    }
  | null
  | undefined;

export type PihakHadir = { pihak1: boolean; pihak2: boolean };

export const TANPA_PIHAK_HADIR: PihakHadir = { pihak1: false, pihak2: false };

function terisi(jam: string | null | undefined): boolean {
  return typeof jam === "string" && jam.trim() !== "";
}

/**
 * Sisi mana yang sudah tercatat hadir pada sidang `tanggalSidang`.
 * Gagal-tertutup: tanggal tidak terbaca, bukan hari ini, atau tanpa antrian
 * berarti tidak ada yang ditandai.
 */
export function pihakHadirHariIni(
  antrian: BahanKehadiranAntrian,
  tanggalSidang: string | null | undefined,
  hariIni: string
): PihakHadir {
  if (!antrian) return TANPA_PIHAK_HADIR;
  if (!tanggalSidang || tanggalSidang !== hariIni) return TANPA_PIHAK_HADIR;
  const hasil = { pihak1: terisi(antrian.pihak1), pihak2: terisi(antrian.pihak2) };
  return hasil.pihak1 || hasil.pihak2 ? hasil : TANPA_PIHAK_HADIR;
}

export const TULISAN_HADIR = "(hadir)";
export const JUDUL_HADIR =
  "Sudah tercatat hadir hari ini di antrian (pihak itu sendiri atau kuasanya). Jamnya ada di kolom Antrian.";
