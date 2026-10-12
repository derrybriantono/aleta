/**
 * ============================================================================
 * BENTUK NAMA PIHAK UNTUK ANONIMISASI PUTUSAN (12 Okt 2026, butir 19)
 * ============================================================================
 *
 * Perkara 564/Pdt.G/2026/PA.Dgl: Penggugat di SIPP bernama
 * "Almaningsi Astuti alias Alma Ningsi Astuti binti Asmin Y", dan bukti P.1
 * (variabel ABT 1214) menulis "KTP-el atas nama ALMANINGSI ASTUTI". ABT
 * menyamarkan dengan str_replace atas nama SIPP UTUH, persis hurufnya; ALETA
 * menyamarkan sisanya, tetapi dahulu hanya memotong nama di "bin/binti" -
 * bentuk sebelum "alias" tidak pernah menjadi sasaran, sedangkan penjaga
 * unggah (namaIntiPihak) memotong di "alias". Akibatnya nama itu lolos dari
 * penyamar dan tertangkap penjaga: unggah ditolak.
 *
 * Aturan bentuk di sini SATU untuk penyamar ekstensi (a30BentukNamaPihak di
 * ekstensi-sipp/konten.js, disalin dan diadu kesamaannya oleh uji) dan untuk
 * penjaga unggah di server.
 *
 * Nama SIPP dipotong di " alias " menjadi beberapa ruas. Ruas pertama selalu
 * nama orang itu. Ruas sesudah "alias" adalah nama orang itu juga BILA ruas
 * sebelumnya belum memuat bin/binti ("Almaningsi Astuti alias Alma Ningsi
 * Astuti binti Asmin Y"), atau bila ruas itu sendiri memuat bin/binti ("X
 * binti Y alias X binti Z"). Selebihnya - "Mariana binti Sapri alias Sapri
 * M. Arif", "Andi Raga bin Topoi alias Petapoi" - "alias" itu milik nama ayah
 * dan TIDAK disamarkan sebagai nama pihak (sipp_donggala: 1.050 dari 20.353
 * nama pihak memuat "alias").
 *
 * Nama diri = bagian ruas sebelum bin/binti. Nama di bawah empat huruf tidak
 * dipakai: terlalu mudah muncul sebagai kata lain.
 */

export const PANJANG_NAMA_DIRI_MIN = 4;

const RAPIKAN = (s: string) => String(s ?? "").replace(/\s+/g, " ").trim();
const POTONG_ALIAS = /\s+alias\s+/i;
const POTONG_BIN = /\s+(?:bin|binti)\s+/i;

export type BentukNamaPihak = {
  /** Nama SIPP apa adanya (spasi dirapikan). */
  utuh: string;
  /** Ruas nama orang itu sendiri, lengkap dengan bin/binti bila ada. */
  ruas: string[];
  /** Nama diri (tanpa bin/binti) tiap ruas, unik, minimal empat huruf. */
  diri: string[];
};

export function bentukNamaPihak(nama: string): BentukNamaPihak {
  const utuh = RAPIKAN(nama);
  const potong = utuh.split(POTONG_ALIAS).map(RAPIKAN).filter(Boolean);
  const ruas: string[] = [];
  let sebelumnyaBerbin = false;
  potong.forEach((satu, i) => {
    const berbin = POTONG_BIN.test(satu);
    if (i === 0 || !sebelumnyaBerbin || berbin) ruas.push(satu);
    sebelumnyaBerbin = berbin;
  });
  const diri: string[] = [];
  const lihat = new Set<string>();
  for (const satu of ruas) {
    const inti = RAPIKAN(satu.split(POTONG_BIN)[0]);
    const kunci = inti.toLowerCase();
    if (inti.length >= PANJANG_NAMA_DIRI_MIN && !lihat.has(kunci)) {
      lihat.add(kunci);
      diri.push(inti);
    }
  }
  return { utuh, ruas, diri };
}

/** Semua nama diri dari daftar nama pihak, unik (tanpa peduli besar-kecil). */
export function namaDiriPihak(namaPihak: string[]): string[] {
  const hasil: string[] = [];
  const lihat = new Set<string>();
  for (const nama of namaPihak) {
    for (const diri of bentukNamaPihak(nama).diri) {
      const kunci = diri.toLowerCase();
      if (!lihat.has(kunci)) {
        lihat.add(kunci);
        hasil.push(diri);
      }
    }
  }
  return hasil;
}

/**
 * Pola nama berbatas kata, tanpa peduli besar-kecil huruf, spasi lentur.
 * Berbatas kata supaya "Rina" tidak ditemukan di dalam "Marina".
 */
export function polaNama(nama: string, bendera = "iu"): RegExp {
  const lolos = RAPIKAN(nama).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s+");
  return new RegExp(`(?<![\\p{L}\\p{N}])${lolos}(?![\\p{L}\\p{N}])`, bendera);
}

export function hitungNama(teks: string, nama: string): number {
  return (String(teks ?? "").match(polaNama(nama, "giu")) ?? []).length;
}

/** Tanda samaran yang ditulis ABT (alamat/pekerjaan -> "xxxx") dan ALETA ("xxx"). */
const TANDA_SAMARAN = /(?<![\p{L}\p{N}])x{3,}(?![\p{L}\p{N}])/giu;

export type NilaiPenyamaran = {
  /** Benar bila ada bukti penyamaran: sekurangnya satu nama pihak berkurang. */
  ada: boolean;
  /** "pembanding" = dihitung terhadap putusan asli; "tanda" = tanpa putusan asli. */
  dasar: "pembanding" | "tanda";
  /** Kemunculan nama diri pihak di putusan asli (dasar pembanding). */
  namaDiPutusan: number;
  /** Kemunculan nama diri pihak yang masih ada di anonimisasi. */
  namaDiAnonim: number;
  /** Banyaknya tanda samaran "xxx" di anonimisasi. */
  tandaSamaran: number;
};

/**
 * Apakah berkas anonimisasi SUNGGUH disamarkan - dasar tombol "Tetap
 * unggah": sisa sebagian boleh diunggah atas keputusan petugas, tetapi berkas
 * yang tidak disamarkan sama sekali (putusan asli di slot anonimisasi) tidak.
 *
 * Dengan putusan asli sebagai pembanding: harus ada nama pihak yang
 * berkurang. Isi yang sama persis = tidak ada penyamaran. Tanpa pembanding
 * (anonimisasi diunggah sendiri, atau putusannya bukan RTF): harus ada tanda
 * samaran "xxx" - bukti bahwa naskah ini pernah melewati penyamar.
 */
export function nilaiPenyamaran(masukan: {
  teksAnonim: string;
  teksPutusan?: string | null;
  namaPihak: string[];
}): NilaiPenyamaran {
  const diri = namaDiriPihak(masukan.namaPihak);
  const hitung = (teks: string) => diri.reduce((jumlah, nama) => jumlah + hitungNama(teks, nama), 0);
  const anonim = String(masukan.teksAnonim ?? "");
  const tandaSamaran = (anonim.match(TANDA_SAMARAN) ?? []).length;
  const namaDiAnonim = hitung(anonim);
  if (masukan.teksPutusan != null) {
    const putusan = String(masukan.teksPutusan);
    const namaDiPutusan = hitung(putusan);
    const sama = RAPIKAN(putusan) === RAPIKAN(anonim);
    return {
      ada: !sama && namaDiAnonim < namaDiPutusan,
      dasar: "pembanding",
      namaDiPutusan,
      namaDiAnonim,
      tandaSamaran,
    };
  }
  return { ada: tandaSamaran > 0, dasar: "tanda", namaDiPutusan: 0, namaDiAnonim, tandaSamaran };
}
