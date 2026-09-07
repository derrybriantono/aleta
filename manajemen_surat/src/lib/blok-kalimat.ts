import { createHash } from "node:crypto";

/**
 * Blok kalimat: satu alinea hukum, ditulis sekali dan dipakai berkali-kali.
 *
 * ============================================================================
 * YANG SAMA PERSIS DISATUKAN; YANG MIRIP TIDAK PERNAH DISATUKAN SENDIRI
 * ============================================================================
 *
 * Membandingkan dua BAS bersaudara menemukan blok identitas para pihak
 * berbeda antar berkas - satu memuat NIK, satu tidak; urutan pendidikan dan
 * pekerjaan tertukar; "bertempat tinggal di" berhadapan dengan "tempat
 * kediaman di". Tidak satu pun keliru, tetapi keduanya tidak mungkin
 * dua-duanya yang dikehendaki. Itulah harga 812 berkas yang dirawat tangan.
 *
 * Menyatukan yang mirip secara otomatis akan MENGUBAH BUNYI naskah hukum tanpa
 * seorang pun memutuskannya - dan pilihan mana yang benar adalah pekerjaan
 * hakim, bukan pekerjaan pencocok teks. Karena itu:
 *
 *   - blok yang teksnya SAMA PERSIS disatukan menjadi satu blok;
 *   - blok yang BENTUKNYA sama tetapi teksnya berbeda dicatat sebagai
 *     PERGESERAN, ditampilkan berdampingan, dan menunggu manusia memilih.
 *
 * Akibatnya penyusunan ulang tiap blangko dari korpus selalu tepat kata demi
 * kata - yang menjadi uji lulus Tahap 1.
 */

/** Pola penanda ABT di dalam naskah. */
const POLA_PENANDA = /#(\d{3,5})#/g;

export type Blok = {
  /** Sidik teks yang sudah dinormalkan - inilah jati diri bloknya. */
  sidik: string;
  teks: string;
  /** Teks dengan penanda dan angka disamarkan - dipakai mencari pergeseran. */
  bentuk: string;
  sidikBentuk: string;
  penanda: string[];
  panjang: number;
};

/**
 * Membersihkan satu alinea sebelum dijadikan blok.
 *
 * Hanya ruang kosong yang dirapikan. Tanda baca, huruf besar, dan ejaan TIDAK
 * disentuh: perbedaan sekecil apa pun pada kalimat hukum adalah perbedaan yang
 * harus terlihat, bukan diratakan diam-diam oleh pembersih.
 */
export function rapikanAlinea(baris: string): string {
  return String(baris ?? "")
    .replace(/ /g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Alinea yang pantas menjadi blok kalimat.
 *
 * ============================================================================
 * SAMPAHNYA DIKENALI; YANG PENDEK TIDAK DIHUKUM
 * ============================================================================
 *
 * Menyaring dengan ambang panjang tampak aman tetapi tidak. Baris terpendek
 * yang sungguh bermakna pada blangko rujukan berada jauh di bawah ambang mana
 * pun yang cukup untuk membuang sampah: "MENETAPKAN" (10), "Sudah cukup." (12),
 * "Sidang Pertama" (14), "Ketua Majelis," (14), "03 September 2026" (17),
 * "BERITA ACARA SIDANG" (19). Judul dokumen justru struktur yang paling
 * menentukan, dan ia hanya 19 huruf.
 *
 * Kehilangan isi jauh lebih mahal daripada menyimpan sampah: sampah tetap
 * terlihat dan dibereskan pada tahap pembersihan, sedangkan alinea yang hilang
 * mengubah dokumen tanpa seorang pun menyadarinya.
 *
 * Karena itu yang disaring adalah BENTUK SAMPAHNYA, bukan panjangnya.
 */
const PENANDA_BAGIAN = /^(MENGADILI|MENETAPKAN|MEMUTUSKAN|DUDUK PERKARA|PERTIMBANGAN HUKUM|TENTANG DUDUK PERKARA|TENTANG PERTIMBANGAN HUKUM|TENTANG HUKUMNYA|PRIMER|SUBSIDER|SUBSIDAIR|Ketua Majelis,|Hakim Anggota,|Panitera Pengganti,|Panitera,)$/i;

/** Sisa kendali RTF dan bingkai gambar yang lolos penguraian. */
const SAMPAH_RTF =
  /(^\\|shapeType|pVerticies|pSegmentInfo|fLineOK|fShadowOK|wzName|fLayoutInCell|geoRight|geoBottom|txflTextFlow|posrelh|NUMPAGES|\bPAGE\b\s*\\?\*|\\\*\s*(PAGE|Arabic)|^\*+$|^SC\s+Z\s+\d)/i;

/** Baris ini benar-benar berhuruf, bukan sekadar tanda baca atau titik isian. */
const PUNYA_HURUF = /[A-Za-z؀-ۿ]/;

/** Gumpalan heksadesimal - gambar yang tertanam di dalam RTF. */
function gumpalanHex(t: string): boolean {
  return t.length >= 120 && /^[0-9a-f\s]+$/i.test(t);
}

/** Sekurang-kurangnya tiga huruf - di bawah itu bukan kalimat maupun judul. */
function cukupBerhuruf(t: string): boolean {
  return (t.match(/[A-Za-z؀-ۿ]/g) ?? []).length >= 3;
}

export function alineaBerguna(baris: string): boolean {
  const t = rapikanAlinea(baris);
  if (!t) return false;
  if (PENANDA_BAGIAN.test(t)) return true;
  if (SAMPAH_RTF.test(t)) return false;
  if (gumpalanHex(t)) return false;
  if (!PUNYA_HURUF.test(t)) return false;
  if (!cukupBerhuruf(t)) return false;
  return true;
}

/**
 * Bentuk sebuah alinea: teks dengan yang berubah-ubah disamarkan.
 *
 * Dipakai HANYA untuk menemukan pergeseran - dua alinea berbentuk sama tetapi
 * berteks beda adalah kalimat yang seharusnya satu tetapi terlanjur menyimpang.
 * Bentuk tidak pernah dipakai untuk menyusun naskah.
 */
export function bentukAlinea(teks: string): string {
  return rapikanAlinea(teks)
    .replace(POLA_PENANDA, "")
    .replace(/\d+/g, "")
    .toLowerCase()
    .replace(/[.,;:()"'‘’“”-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sidikDari(teks: string): string {
  return createHash("sha1").update(teks, "utf8").digest("hex").slice(0, 16);
}

export function buatBlok(baris: string): Blok {
  const teks = rapikanAlinea(baris);
  const bentuk = bentukAlinea(teks);
  return {
    sidik: sidikDari(teks),
    teks,
    bentuk,
    sidikBentuk: sidikDari(bentuk),
    penanda: [...new Set([...teks.matchAll(POLA_PENANDA)].map((c) => c[1]))].sort(),
    panjang: teks.length,
  };
}

export type SusunanBlangko = {
  jalur: string;
  /** Sidik blok berurutan - inilah susunan dokumennya. */
  urutan: string[];
  /** Alinea yang dibuang sebagai sampah, disimpan supaya dapat diperiksa. */
  dibuang: number;
};

export type HasilKorpus = {
  blok: Map<string, Blok & { jumlahPakai: number }>;
  susunan: SusunanBlangko[];
  /** Kelompok pergeseran: bentuk yang sama dengan lebih dari satu teks. */
  pergeseran: Array<{ sidikBentuk: string; bentuk: string; varian: Array<{ sidik: string; teks: string; jumlahPakai: number }> }>;
};

/**
 * Menyusun korpus dari sekumpulan blangko yang sudah diuraikan menjadi alinea.
 *
 * Fungsi murni: masukan alinea, keluaran blok, susunan, dan daftar pergeseran.
 * Tidak menyentuh basis data sama sekali, supaya seluruh keputusan
 * penggabungan dapat diuji tanpa menyiapkan apa pun.
 */
export function susunKorpus(berkas: Array<{ jalur: string; alinea: string[] }>): HasilKorpus {
  const blok = new Map<string, Blok & { jumlahPakai: number }>();
  const susunan: SusunanBlangko[] = [];

  for (const item of berkas) {
    const urutan: string[] = [];
    let dibuang = 0;
    for (const baris of item.alinea) {
      if (!alineaBerguna(baris)) {
        dibuang += 1;
        continue;
      }
      const b = buatBlok(baris);
      const ada = blok.get(b.sidik);
      if (ada) ada.jumlahPakai += 1;
      else blok.set(b.sidik, { ...b, jumlahPakai: 1 });
      urutan.push(b.sidik);
    }
    susunan.push({ jalur: item.jalur, urutan, dibuang });
  }

  // Pergeseran: kelompokkan menurut bentuk, laporkan yang punya lebih dari satu
  // teks. Yang punya satu teks bukan pergeseran - ia hanya blok biasa.
  const perBentuk = new Map<string, { bentuk: string; varian: Array<{ sidik: string; teks: string; jumlahPakai: number }> }>();
  for (const b of blok.values()) {
    const kelompok = perBentuk.get(b.sidikBentuk) ?? { bentuk: b.bentuk, varian: [] };
    kelompok.varian.push({ sidik: b.sidik, teks: b.teks, jumlahPakai: b.jumlahPakai });
    perBentuk.set(b.sidikBentuk, kelompok);
  }

  const pergeseran = [...perBentuk.entries()]
    .filter(([, k]) => k.varian.length > 1)
    .map(([sidikBentuk, k]) => ({
      sidikBentuk,
      bentuk: k.bentuk,
      // Yang paling sering dipakai lebih dulu - itu yang paling mungkin menjadi
      // bentuk yang dikehendaki, tetapi tetap manusia yang memutuskan.
      varian: k.varian.sort((a, b) => b.jumlahPakai - a.jumlahPakai),
    }))
    .sort((a, b) => b.varian.length - a.varian.length);

  return { blok, susunan, pergeseran };
}

/**
 * Menyusun ulang sebuah blangko dari korpus - inti uji lulus Tahap 1.
 *
 * Bila hasilnya tidak sama persis dengan alinea aslinya, korpus kehilangan
 * atau menukar sesuatu, dan tidak boleh dipakai.
 */
export function susunUlang(
  urutan: string[],
  blok: Map<string, { teks: string }>
): { berhasil: boolean; alinea: string[]; hilang: string[] } {
  const alinea: string[] = [];
  const hilang: string[] = [];
  for (const sidik of urutan) {
    const b = blok.get(sidik);
    if (!b) {
      hilang.push(sidik);
      continue;
    }
    alinea.push(b.teks);
  }
  return { berhasil: hilang.length === 0, alinea, hilang };
}

/** Alinea asli yang berguna saja - pembanding bagi susunUlang. */
export function alineaBergunaSaja(alinea: string[]): string[] {
  return alinea.filter(alineaBerguna).map(rapikanAlinea);
}
