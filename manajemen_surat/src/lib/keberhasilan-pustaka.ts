/**
 * UKURAN KEBERHASILAN PUSTAKA (K4) DAN BELAJAR DARI SUNTINGAN (K5).
 *
 * ============================================================================
 * UKURANNYA BERKURANGNYA PEMAKAIAN AI, BUKAN BERTAMBAHNYA
 * ============================================================================
 *
 * Hampir semua sistem yang memasang AI mengukur keberhasilannya dari seberapa
 * banyak AI dipakai. Di sini justru sebaliknya: pustaka yang bekerja membuat
 * AI makin jarang diperlukan, dan angka yang naik adalah persentase putusan
 * yang selesai TANPA memanggil model sama sekali.
 *
 * Arah ini bukan kesantunan. Tiap alinea yang datang dari pustaka membawa
 * alamat pasalnya dan pernah disahkan hakim; tiap alinea yang datang dari
 * model harus dibaca ulang seluruhnya. Pustaka yang tumbuh berarti pekerjaan
 * yang berkurang, bukan alat yang menganggur.
 *
 * ============================================================================
 * YANG DIHITUNG DRAF, BUKAN PANGGILAN
 * ============================================================================
 *
 * Menghitung panggilan model akan memuji bulan yang sepi sidang. Yang
 * dihitung adalah draf: dari sekian draf yang disusun bulan ini, berapa yang
 * seluruh pertimbangannya datang dari pustaka.
 *
 * ============================================================================
 * SUNTINGAN PETUGAS ADALAH KELUHAN YANG TIDAK PERNAH DIUCAPKAN
 * ============================================================================
 *
 * Hakim yang menolak alinea yang sama pada sepuluh perkara tidak akan
 * melaporkannya - ia hanya menolaknya lagi. Penolakan yang berulang karena
 * itu dikumpulkan menjadi daftar untuk dibaca manusia.
 *
 * Yang TIDAK dikerjakan: mengubah pustaka sendiri. Butir yang sering ditolak
 * bukan berarti butir itu salah - mungkin ia dipakai pada jenis perkara yang
 * keliru, mungkin syaratnya terlalu longgar, mungkin hakimnya yang keliru.
 * Ketiganya menuntut orang yang membaca, dan sistem yang memperbaiki dirinya
 * sendiri berdasarkan hitungan akan memperbaiki yang ketiga.
 */

export type HitunganDraf = {
  /** Draf yang disusun pada rentang ini. */
  jumlahDraf: number;
  /** Draf yang seluruh butirnya datang dari pustaka. */
  tanpaModel: number;
  /** Draf yang sedikitnya satu alineanya disusun model. */
  denganModel: number;
  /** Draf yang tidak memuat satu pun butir - pustaka belum menjawab apa pun. */
  tanpaButir: number;
};

export type Keberhasilan = {
  jumlahDraf: number;
  tanpaModel: number;
  denganModel: number;
  tanpaButir: number;
  /** 0..100 - bagian draf yang selesai tanpa memanggil model. */
  persenTanpaModel: number;
  /** Kalimat siap tampil; kosong bila belum ada draf sama sekali. */
  kalimat: string;
};

/**
 * Menghitung persentase draf yang selesai tanpa model.
 *
 * Draf tanpa satu pun butir TIDAK dihitung sebagai keberhasilan pustaka
 * meskipun ia juga tidak memanggil model. Menghitungnya akan membuat angka
 * ini tertinggi justru pada hari pustaka masih kosong - persis kebalikan dari
 * yang hendak diukur.
 */
export function hitungKeberhasilan(hitungan: HitunganDraf): Keberhasilan {
  const jumlah = Math.max(0, Number(hitungan.jumlahDraf) || 0);
  const tanpaModel = Math.max(0, Number(hitungan.tanpaModel) || 0);
  const denganModel = Math.max(0, Number(hitungan.denganModel) || 0);
  const tanpaButir = Math.max(0, Number(hitungan.tanpaButir) || 0);

  const berbutir = Math.max(0, jumlah - tanpaButir);
  const persen = berbutir > 0 ? Math.round((tanpaModel / berbutir) * 100) : 0;

  const kalimat = !jumlah
    ? ""
    : berbutir === 0
      ? `${jumlah} draf disusun, tetapi tidak satu pun memuat butir pustaka. Pustaka belum menjawab apa pun.`
      : `${persen} persen draf selesai tanpa memanggil model (${tanpaModel} dari ${berbutir} draf berbutir).` +
        (tanpaButir ? ` ${tanpaButir} draf lain belum memuat butir sama sekali.` : "");

  return {
    jumlahDraf: jumlah,
    tanpaModel,
    denganModel,
    tanpaButir,
    persenTanpaModel: persen,
    kalimat,
  };
}

// =============================================================================
// K5 - BELAJAR DARI SUNTINGAN
// =============================================================================

export type PenolakanButir = {
  butirId: string;
  teks: string;
  jumlahDipakai: number;
  jumlahDitolak: number;
  /** Alasan penolakan, apa adanya - tidak diringkas mesin. */
  alasan: string[];
};

export type TemuanSuntingan = {
  butirId: string;
  teks: string;
  jumlahDipakai: number;
  jumlahDitolak: number;
  /** 0..100 */
  persenDitolak: number;
  saran: string;
  alasan: string[];
};

/** Butir yang dipakai lebih jarang dari ini tidak dinilai - contohnya terlalu sedikit. */
export const MINIMAL_DIPAKAI = 5;

/** Di atas bagian ini, butir pantas dibaca ulang manusia. */
export const AMBANG_DITOLAK = 0.4;

/**
 * Menyaring butir yang pantas dibaca ulang.
 *
 * Dua penjagaan terhadap kesimpulan yang terlalu cepat:
 *
 *   - butir yang baru dipakai sekali atau dua kali TIDAK dinilai. Satu
 *     penolakan pada satu pemakaian menghasilkan 100 persen, dan angka itu
 *     akan menaikkannya ke puncak daftar tanpa arti apa pun; dan
 *   - hasilnya berupa SARAN untuk dibaca, bukan tindakan. Butir yang sering
 *     ditolak mungkin keliru, mungkin dipakai pada jenis perkara yang salah,
 *     mungkin hakimnya yang keliru - ketiganya menuntut orang yang membaca.
 */
export function saringSuntingan(penolakan: PenolakanButir[]): TemuanSuntingan[] {
  const temuan: TemuanSuntingan[] = [];

  for (const butir of penolakan ?? []) {
    const dipakai = Math.max(0, Number(butir.jumlahDipakai) || 0);
    const ditolak = Math.max(0, Number(butir.jumlahDitolak) || 0);
    if (dipakai < MINIMAL_DIPAKAI) continue;

    const bagian = ditolak / dipakai;
    if (bagian < AMBANG_DITOLAK) continue;

    temuan.push({
      butirId: butir.butirId,
      teks: butir.teks,
      jumlahDipakai: dipakai,
      jumlahDitolak: ditolak,
      persenDitolak: Math.round(bagian * 100),
      saran:
        bagian >= 0.8
          ? "Hampir selalu ditolak. Periksa apakah bunyinya keliru, atau syaratnya membuatnya terpilih pada perkara yang salah."
          : "Sering ditolak. Baca alasan penolakannya sebelum memutuskan apa pun.",
      alasan: (butir.alasan ?? []).filter(Boolean).slice(0, 5),
    });
  }

  // Yang paling sering ditolak lebih dulu; yang seri diurutkan menurut berapa
  // kali dipakai, sebab butir yang dipakai dua ratus kali lebih mendesak
  // daripada yang dipakai lima kali dengan persentase sama.
  return temuan.sort(
    (a, b) => b.persenDitolak - a.persenDitolak || b.jumlahDipakai - a.jumlahDipakai
  );
}
