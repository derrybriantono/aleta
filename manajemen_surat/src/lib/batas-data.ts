/**
 * BATAS DATA (J5) - isi berkas mana yang boleh keluar dari gedung ini.
 *
 * ============================================================================
 * YANG DIATUR DI SINI ADALAH KIRIMAN KELUAR, BUKAN TAMPILAN DI LAYAR
 * ============================================================================
 *
 * Petugas di dalam gedung memang berhak melihat NIK dan alamat para pihak -
 * itu pekerjaannya. Yang diatur berkas ini hanyalah apa yang boleh MENINGGALKAN
 * jaringan pengadilan: kiriman ke penyedia AI pada Tahap 6, salinan ke luar,
 * dan berkas contoh untuk pengujian.
 *
 * Membedakan keduanya penting. Penjagaan yang juga menyembunyikan data dari
 * petugas yang berhak akan dimatikan pada minggu pertama, dan sesudah dimatikan
 * ia tidak menjaga apa pun.
 *
 * ============================================================================
 * YANG TIDAK DIKENALI DIANGGAP TERLARANG
 * ============================================================================
 *
 * Inilah satu-satunya arah bawaan yang aman. Ruas baru akan terus bermunculan -
 * sumber data bertambah, kolom SIPP berubah nama, modul baru membawa
 * istilahnya sendiri. Bawaan "boleh" berarti tiap ruas baru diam-diam ikut
 * terkirim sampai ada yang menyadarinya; bawaan "terlarang" berarti tiap ruas
 * baru menghasilkan keluhan yang terlihat pada percobaan pertama.
 *
 * Keluhan yang terlihat dapat diperbaiki. Kiriman yang lolos tidak dapat
 * ditarik kembali.
 */

export type Batas =
  /** Boleh keluar apa adanya. */
  | "bebas"
  /** Boleh keluar sesudah disamarkan. */
  | "samar"
  /** Tidak boleh keluar dalam bentuk apa pun. */
  | "terlarang";

export type AturanBatas = {
  /** Nama ruas, atau pola bila diakhiri "*". */
  ruas: string;
  batas: Batas;
  sebab: string;
};

/**
 * Aturan bawaan.
 *
 * Sengaja pendek dan sengaja ketat. Pengadilan dapat menambahnya lewat
 * penyimpanan, tetapi tidak dapat melonggarkan yang terlarang di sini tanpa
 * menyatakannya sebagai aturan tersendiri - dan pernyataan itu tercatat.
 */
export const BATAS_BAWAAN: AturanBatas[] = [
  { ruas: "nik*", batas: "terlarang", sebab: "Nomor induk kependudukan tidak pernah diperlukan penalaran hukum." },
  { ruas: "nomorKk", batas: "terlarang", sebab: "Nomor kartu keluarga tidak diperlukan penalaran hukum." },
  { ruas: "alamat*", batas: "terlarang", sebab: "Alamat lengkap memungkinkan pihak ditemukan di dunia nyata." },
  { ruas: "telepon*", batas: "terlarang", sebab: "Nomor telepon memungkinkan pihak dihubungi langsung." },
  { ruas: "email*", batas: "terlarang", sebab: "Surel memungkinkan pihak dihubungi langsung." },
  { ruas: "tempatLahir", batas: "terlarang", sebab: "Tempat dan tanggal lahir bersama nama sudah menunjuk satu orang." },
  { ruas: "tanggalLahir", batas: "terlarang", sebab: "Tempat dan tanggal lahir bersama nama sudah menunjuk satu orang." },
  { ruas: "nomorAktaNikah", batas: "terlarang", sebab: "Nomor akta menunjuk berkas catatan sipil yang sebenarnya." },

  { ruas: "nama*", batas: "samar", sebab: "Nama pihak dan saksi diganti sebutan sebelum keluar." },
  { ruas: "nomorPerkara", batas: "samar", sebab: "Nomor perkara menunjuk berkas yang sebenarnya." },
  { ruas: "perkaraId", batas: "samar", sebab: "Pengenal perkara menunjuk berkas yang sebenarnya." },
  { ruas: "tanggal*", batas: "samar", sebab: "Tanggal bersama pengadilan mempersempit ke beberapa perkara saja." },
  { ruas: "keteranganSaksi", batas: "samar", sebab: "Keterangan saksi memuat nama dan tempat di dalam kalimatnya." },
  { ruas: "dalil", batas: "samar", sebab: "Dalil memuat nama dan tempat di dalam kalimatnya." },

  // Pertanyaan diketik pemakai sendiri, dan pemakai menyebut nama serta nomor
  // perkara di dalamnya tanpa berpikir. Disamarkan, bukan dibebaskan.
  { ruas: "pertanyaan", batas: "samar", sebab: "Pertanyaan pemakai kerap memuat nama dan nomor perkara." },

  // Naskah berkas utuh - gugatan, jawaban, berita acara.
  //
  // TERLARANG sebagai bawaan, dan tidak dapat dilonggarkan dengan menyamarkan:
  // menarik "tanggal nikah" dari naskah yang tanggalnya sudah menjadi
  // [TANGGAL] tidak mungkin. Jadi pilihannya hanya dua - dikirim utuh, atau
  // tidak dikirim - dan pilihan itu terlalu besar untuk diambil diam-diam.
  //
  // Pengadilan yang memang hendak memakai penarikan fakta harus menambah
  // barisnya sendiri di aleta_batas_data, dan baris itu mencatat siapa yang
  // memutuskannya.
  { ruas: "naskah", batas: "terlarang", sebab: "Naskah berkas utuh hanya boleh keluar atas keputusan pengadilan yang tercatat." },

  { ruas: "jenisPerkara", batas: "bebas", sebab: "Jenis perkara tidak menunjuk siapa pun." },
  { ruas: "agama", batas: "bebas", sebab: "Diperlukan pemeriksaan kompetensi absolut." },
  { ruas: "pekerjaan", batas: "bebas", sebab: "Tidak menunjuk siapa pun tanpa ruas lain." },
  { ruas: "pendidikan", batas: "bebas", sebab: "Tidak menunjuk siapa pun tanpa ruas lain." },
  { ruas: "umur", batas: "bebas", sebab: "Tidak menunjuk siapa pun tanpa ruas lain." },
  { ruas: "jumlah*", batas: "bebas", sebab: "Hitungan tidak menunjuk siapa pun." },
  { ruas: "tergugatHadir", batas: "bebas", sebab: "Keadaan sidang, bukan jati diri." },
  { ruas: "bunyiPasal", batas: "bebas", sebab: "Naskah peraturan memang terbuka untuk umum." },
  { ruas: "jangkar", batas: "bebas", sebab: "Alamat pasal, bukan data perkara." },
];

function cocok(ruas: string, pola: string): boolean {
  const nama = ruas.trim().toLowerCase();
  const bentuk = pola.trim().toLowerCase();
  if (bentuk.endsWith("*")) return nama.startsWith(bentuk.slice(0, -1));
  return nama === bentuk;
}

export type Putusan = {
  ruas: string;
  batas: Batas;
  sebab: string;
  /** true bila ruas ini tidak dikenali satu aturan pun. */
  bawaanKetat: boolean;
};

/**
 * Menentukan batas satu ruas.
 *
 * Aturan yang lebih TEPAT menang atas yang berpola. "namaHakim" yang disebut
 * tersendiri mengalahkan "nama*", sehingga pengadilan dapat melonggarkan satu
 * ruas tanpa melonggarkan seluruh keluarganya.
 */
export function batasRuas(ruas: string, aturan: AturanBatas[] = BATAS_BAWAAN): Putusan {
  const tepat = aturan.find((item) => !item.ruas.endsWith("*") && cocok(ruas, item.ruas));
  if (tepat) return { ruas, batas: tepat.batas, sebab: tepat.sebab, bawaanKetat: false };

  // Pola terpanjang menang: "namaSaksi*" lebih tepat daripada "nama*".
  const berpola = aturan
    .filter((item) => item.ruas.endsWith("*") && cocok(ruas, item.ruas))
    .sort((a, b) => b.ruas.length - a.ruas.length)[0];
  if (berpola) return { ruas, batas: berpola.batas, sebab: berpola.sebab, bawaanKetat: false };

  return {
    ruas,
    batas: "terlarang",
    sebab: "Ruas ini belum punya aturan batas, sehingga diperlakukan terlarang.",
    bawaanKetat: true,
  };
}

export type HasilSaring = {
  /** Isi yang boleh keluar - hanya ruas bebas, dan ruas samar yang sudah disamarkan. */
  dikirim: Record<string, unknown>;
  ditahan: Putusan[];
  disamarkan: Putusan[];
  /** Ruas yang ditahan hanya karena belum punya aturan - perlu diputuskan. */
  belumBeraturan: string[];
};

/**
 * Menyaring isi sebelum dikirim keluar.
 *
 * Ruas "samar" hanya lolos bila penyamarnya benar-benar mengubah nilainya.
 * Penyamar yang mengembalikan nilai apa adanya - karena polanya tidak
 * dikenali, misalnya - akan meloloskan data asli lewat pintu yang bernama
 * "sudah disamarkan", dan itu lebih buruk daripada tidak ada penyamaran.
 */
export function saringKeluar(
  isi: Record<string, unknown>,
  samarkan: (nilai: unknown, ruas: string) => unknown,
  aturan: AturanBatas[] = BATAS_BAWAAN
): HasilSaring {
  const dikirim: Record<string, unknown> = {};
  const ditahan: Putusan[] = [];
  const disamarkan: Putusan[] = [];
  const belumBeraturan: string[] = [];

  for (const [ruas, nilai] of Object.entries(isi ?? {})) {
    const putusan = batasRuas(ruas, aturan);
    if (putusan.bawaanKetat) belumBeraturan.push(ruas);

    if (putusan.batas === "bebas") {
      dikirim[ruas] = nilai;
      continue;
    }
    if (putusan.batas === "terlarang") {
      ditahan.push(putusan);
      continue;
    }

    const hasil = samarkan(nilai, ruas);
    const berubah = String(hasil ?? "") !== String(nilai ?? "");
    const kosongAsli = String(nilai ?? "").trim() === "";

    if (berubah || kosongAsli) {
      dikirim[ruas] = hasil;
      disamarkan.push(putusan);
    } else {
      ditahan.push({
        ...putusan,
        sebab: `${putusan.sebab} Penyamaran tidak mengubah nilainya, sehingga ruas ini ditahan.`,
      });
    }
  }

  return { dikirim, ditahan, disamarkan, belumBeraturan };
}
