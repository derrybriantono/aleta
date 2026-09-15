/**
 * ============================================================================
 * SIFAT RUANGAN SIDANG - DALAM GEDUNG, KELILING, ATAU TERPADU
 * ============================================================================
 *
 * ============================================================================
 * DUA SUMBER YANG TIDAK SEPAKAT, DAN KEDUANYA PUNYA ALASAN
 * ============================================================================
 *
 * SIPP punya benderanya sendiri: ruangan_sidang.sidang_keliling. Dan ada
 * aturan nama yang jelas: yang memuat "ruang sidang" berarti di dalam gedung,
 * selainnya di luar.
 *
 * Diukur atas sidang 2025-2026 di PA Donggala, keduanya BERSELISIH:
 *
 *   ruangan                                   bendera  nama  sidang
 *   Ruang Sidang 1                              (tiada)   0   1.911
 *   Ruang Sidang 1 Dalam Gedung                       0   0   1.343
 *   Ruang Sidang Dalam Gedung 1                 (tiada)   0     211
 *   Sidang diluar gedung (sidang terpadu)       (tiada)   1     128
 *   Sidang Keliling Sigi Biromaru                     1   1     126
 *   Sidang Keliling Rio Pakava                        1   1      40
 *   Terpadu Sindue                                    0   1      39   <-- beda
 *   Sidang diluar gedung (sidang keliling)      (tiada)   1      36
 *   Terpadu Labuan                                    0   1      29   <-- beda
 *   Terpadu Sindue Tombusabura                        0   1      27   <-- beda
 *   Terpadu Sirenja                                   0   1      20   <-- beda
 *
 * DUA HAL YANG DIAJARKAN TABEL INI
 *
 * 1. Bendera SIPP saja TIDAK CUKUP. 2.140 sidang memakai ruangan yang tidak
 *    ada sama sekali di ruangan_sidang - "Ruang Sidang 1" yang paling banyak
 *    dipakai justru termasuk. Mengandalkan bendera saja membuat mayoritas
 *    sidang tidak berketerangan.
 *
 * 2. "TERPADU" BUKAN "KELILING", dan SIPP sendiri yang mengatakannya:
 *    keempat ruangan Terpadu berbendera 0. Aturan nama akan menyatukan
 *    keduanya - 115 sidang - padahal sidang terpadu adalah pelayanan bersama
 *    dengan instansi lain, program yang berbeda dari sidang keliling.
 *
 * Karena itu jawabannya TIGA, bukan dua. Menyatukan terpadu ke dalam keliling
 * membuat laporan sidang keliling melebih-lebihkan dirinya 115 sidang setahun,
 * dan angka yang melebih-lebihkan diri adalah angka yang suatu hari harus
 * ditarik kembali.
 */

export type SifatRuangan = "dalam-gedung" | "keliling" | "terpadu";

export type Ruangan = {
  id: number;
  kode: string;
  nama: string;
  /** Bendera SIPP sendiri. null bila ruangannya tidak terdaftar. */
  benderaKeliling: boolean | null;
  aktif: boolean;
  /** Berapa sidang memakainya dalam 24 bulan terakhir. */
  dipakai?: number;
  /** Tanggal sidang terakhir di ruangan itu, "" bila tidak pernah. */
  terakhirDipakai?: string;
  /** KUA wilayahnya - tempat sidang keliling sesungguhnya digelar. */
  kua?: string;
  kuaAlamat?: string;
};

/** Ruangan yang terbaca sebagai di dalam gedung dari namanya. */
export const POLA_DALAM_GEDUNG = /ruang\s+sidang/i;
/** Ruangan yang terbaca sebagai sidang keliling dari namanya. */
export const POLA_KELILING = /sidang\s+keliling/i;
/** Pelayanan terpadu - di luar gedung, TETAPI bukan sidang keliling. */
export const POLA_TERPADU = /terpadu/i;

/**
 * Menentukan sifat satu ruangan.
 *
 * Urutan pemeriksaannya menentukan hasilnya, dan urutan inilah keputusannya:
 *
 *   1. TERPADU lebih dahulu. "Sidang diluar gedung Pengadilan (sidang
 *      terpadu)" memuat kata "sidang" dan "terpadu" sekaligus; memeriksa
 *      keliling lebih dahulu tidak menangkapnya, tetapi memeriksa nama
 *      gedung lebih dahulu akan salah menyebutnya dalam gedung.
 *   2. Bendera SIPP, bila ruangannya terdaftar. Ia diisi admin pengadilan
 *      dan lebih tahu daripada pola kata mana pun.
 *   3. Nama "sidang keliling".
 *   4. Nama "ruang sidang" - di dalam gedung.
 *   5. Sisanya: di luar gedung tanpa keterangan lain, diperlakukan keliling.
 */
export function sifatRuangan(nama: string, benderaKeliling: boolean | null = null): SifatRuangan {
  const teks = String(nama || "").trim();
  if (!teks) return "dalam-gedung";

  if (POLA_TERPADU.test(teks)) return "terpadu";
  if (benderaKeliling === true) return "keliling";
  if (benderaKeliling === false && POLA_DALAM_GEDUNG.test(teks)) return "dalam-gedung";
  if (POLA_KELILING.test(teks)) return "keliling";
  if (POLA_DALAM_GEDUNG.test(teks)) return "dalam-gedung";
  return "keliling";
}

/** Benar hanya untuk sidang keliling - terpadu TIDAK termasuk. */
export function ruanganKeliling(nama: string, bendera: boolean | null = null): boolean {
  return sifatRuangan(nama, bendera) === "keliling";
}

/** Benar untuk apa pun yang digelar di luar gedung pengadilan. */
export function diLuarGedung(nama: string, bendera: boolean | null = null): boolean {
  return sifatRuangan(nama, bendera) !== "dalam-gedung";
}

export const SEBUTAN_SIFAT: Record<SifatRuangan, string> = {
  "dalam-gedung": "Dalam gedung",
  keliling: "Sidang keliling",
  terpadu: "Sidang terpadu",
};

/**
 * Menyusun daftar ruangan untuk dipilih, dikelompokkan menurut sifatnya.
 *
 * Yang tidak aktif dibuang: ruangan yang sudah ditutup tidak boleh muncul
 * sebagai pilihan, dan menampilkannya lalu menolaknya sesudah ditekan
 * terbaca sebagai kerusakan.
 */
export function kelompokkanRuangan(daftar: Ruangan[]): Record<SifatRuangan, Ruangan[]> {
  const hasil: Record<SifatRuangan, Ruangan[]> = {
    "dalam-gedung": [],
    keliling: [],
    terpadu: [],
  };
  for (const r of daftar) {
    if (!r.aktif) continue;
    hasil[sifatRuangan(r.nama, r.benderaKeliling)].push(r);
  }
  for (const kunci of Object.keys(hasil) as SifatRuangan[]) {
    hasil[kunci].sort(urutPemakaian);
  }
  return hasil;
}

/**
 * ============================================================================
 * YANG SERING DIPAKAI LEBIH DAHULU, BUKAN YANG HURUF AWALNYA KECIL
 * ============================================================================
 *
 * Urutan abjad memperlakukan keempat ruang sidang keliling sebagai setara.
 * Terukur atas sidang PA Donggala sejak 2025, keempatnya sama sekali tidak
 * setara:
 *
 *   Sigi Biromaru   128 sidang      Sirenja    14 sidang
 *   Rio Pakava       40 sidang      Labuan      0 sidang
 *
 * Abjad menaruh Labuan - yang belum pernah dipakai - di atas Sigi Biromaru
 * yang dipakai hampir tiap pekan. Petugas yang menetapkan sidang keliling
 * karena itu menelusuri daftar yang urutannya tidak menyatakan apa pun.
 *
 * Yang belum pernah dipakai TIDAK dibuang - ruang sidang keliling baru selalu
 * bermula dari nol, dan membuangnya berarti ia tidak akan pernah dapat
 * dipakai pertama kali. Ia hanya turun ke bawah.
 */
export function urutPemakaian(a: Ruangan, b: Ruangan): number {
  const pakaiA = Number(a.dipakai) || 0;
  const pakaiB = Number(b.dipakai) || 0;
  if (pakaiA !== pakaiB) return pakaiB - pakaiA;
  return a.nama.localeCompare(b.nama);
}

/**
 * Daftar rata untuk satu layar, sifatnya lebih dahulu lalu pemakaiannya.
 *
 * `dahulukan` menaikkan satu sifat ke atas - dipakai saat petugas menyatakan
 * ini sidang keliling, sehingga yang dicarinya tidak berada di bawah tiga
 * belas baris ruangan dalam gedung.
 */
export function ruanganTerurut(daftar: Ruangan[], dahulukan?: SifatRuangan): Ruangan[] {
  const peringkat = (r: Ruangan) => {
    const sifat = sifatRuangan(r.nama, r.benderaKeliling);
    if (dahulukan && sifat === dahulukan) return 0;
    if (dahulukan && dahulukan === "keliling" && sifat === "terpadu") return 1;
    return sifat === "dalam-gedung" ? 2 : 3;
  };
  return [...daftar]
    .filter((r) => r.aktif)
    .sort((a, b) => {
      const selisih = peringkat(a) - peringkat(b);
      return selisih !== 0 ? selisih : urutPemakaian(a, b);
    });
}
