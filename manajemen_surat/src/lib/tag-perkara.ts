/**
 * Tag perkara pada layar Status Perkara - sisi layar.
 *
 * ============================================================================
 * KATALOGNYA TIDAK DISALIN KE SINI
 * ============================================================================
 *
 * Daftar tag, kelompok, dan dasar tanggalnya datang utuh dari bot lewat
 * `/status-perkara/tag`. Menyalinnya ke sini berarti dua daftar yang harus
 * dijaga selaras, dan yang di layar akan menyimpang diam-diam begitu tagnya
 * bertambah - persis cacat yang sudah pernah terjadi pada daftar tabel SIPP.
 *
 * Yang tinggal di sini hanya yang memang milik layar: pilihan periode, dan
 * warna tiap nada.
 */

/** Bentuk satu tag, seperti yang dikirim bot. */
export type TagPerkara = {
  kunci: string;
  label: string;
  kelompok: string;
  nada: string;
  judul: string;
};

export type KelompokTag = { kunci: string; label: string };
export type DasarTanggalTag = { kunci: string; label: string };

export type HasilTagPerkara = {
  ok: boolean;
  jumlah: Record<string, number>;
  lingkup: { dari: string; sampai: string; perkara: number };
  tag: TagPerkara[];
  kelompok: KelompokTag[];
  dasar: DasarTanggalTag[];
};

/**
 * Pilihan rentang waktu.
 *
 * "Seluruhnya" jadi bawaan, bukan "tahun ini": tag seperti "Putus belum BHT"
 * dan "Belum diarsipkan" justru bertumpuk pada perkara TAHUN LALU, dan bila
 * layar terbuka dengan saringan tahun berjalan, yang paling perlu dikerjakan
 * malah yang paling tidak terlihat.
 */
export const PERIODE_TAG = [
  { nilai: "total", label: "Seluruhnya" },
  { nilai: "hari", label: "Hari ini" },
  { nilai: "kemarin", label: "Kemarin" },
  { nilai: "minggu", label: "Minggu ini" },
  { nilai: "bulan", label: "Bulan ini" },
  { nilai: "triwulan", label: "Triwulan ini" },
  { nilai: "semester", label: "Semester ini" },
  { nilai: "tahun", label: "Tahun ini" },
  { nilai: "rentang", label: "Antara tanggal" },
] as const;

export const PERIODE_BAWAAN = "total";
export const DASAR_BAWAAN = "daftar";

/** Periode yang menuntut dua tanggal diisi sendiri. */
export function periodeButuhTanggal(periode: string): boolean {
  return periode === "rentang";
}

/**
 * Warna tiap nada.
 *
 * Memakai bg-card, bukan bg-popover: token popover tidak ada pada tema ALETA
 * dan menghasilkan panel tembus pandang (memori token-popover-tidak-ada).
 */
export const KELAS_NADA: Record<string, { mati: string; hidup: string }> = {
  bahaya: {
    mati: "border-rose-500/40 text-rose-600 dark:text-rose-300 hover:bg-rose-500/10",
    hidup: "border-rose-500 bg-rose-500/15 text-rose-700 dark:text-rose-200",
  },
  awas: {
    mati: "border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10",
    hidup: "border-amber-500 bg-amber-500/15 text-amber-800 dark:text-amber-200",
  },
  aman: {
    mati: "border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10",
    hidup: "border-emerald-500 bg-emerald-500/15 text-emerald-800 dark:text-emerald-200",
  },
  sejuk: {
    mati: "border-sky-500/40 text-sky-700 dark:text-sky-300 hover:bg-sky-500/10",
    hidup: "border-sky-500 bg-sky-500/15 text-sky-800 dark:text-sky-200",
  },
  netral: {
    mati: "border-border text-muted-foreground hover:bg-muted",
    hidup: "border-primary bg-primary/10 text-primary",
  },
};

export function kelasNada(nada: string, hidup: boolean): string {
  const set = KELAS_NADA[nada] || KELAS_NADA.netral;
  return hidup ? set.hidup : set.mati;
}
