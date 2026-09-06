/**
 * Penggolongan variabel ABT menjadi tiga kelas.
 *
 * ============================================================================
 * KELAS DITENTUKAN OLEH SUMBERNYA, BUKAN OLEH SULITNYA
 * ============================================================================
 *
 * Kelas A tidak berarti mudah dan Kelas B tidak berarti sukar. Yang membedakan
 * hanyalah SIAPA yang mengetahui nilainya:
 *
 *   A - sumbernya pasti dan ada di mesin: SQL yang sudah tertulis, kolom SIPP,
 *       atau fungsi murni atas nilai lain. Tidak ada penilaian manusia.
 *   B - hanya diketahui hakim atau panitera yang menyidangkan. Mas kawin,
 *       status wali nikah, alasan permohonan. Tidak ada sumbernya di mana pun,
 *       dan tidak boleh ada - menebaknya berarti mengarang fakta perkara.
 *   C - tidak dapat diisi siapa pun, termasuk ABT sendiri. Terdaftar tanpa
 *       jenis dan tanpa sumber, atau tidak terdaftar sama sekali.
 *
 * ============================================================================
 * KELAS C ADALAH TEMUAN, BUKAN KEGAGALAN
 * ============================================================================
 *
 * Menggolongkan variabel tanpa sumber sebagai B ("nanti diisi manusia") akan
 * memunculkannya di layar isian sebagai kotak kosong yang tidak pernah dapat
 * diisi dengan benar, karena tidak seorang pun tahu variabel itu meminta apa.
 * Menyebutnya C membuatnya masuk daftar yang harus dibereskan di blangkonya -
 * dan itulah perlakuan yang jujur.
 */

/** Kelas variabel: A mekanis, B butuh manusia, C mati. */
export type KelasVariabel = "A" | "B" | "C";

export type HasilKelas = {
  kelas: KelasVariabel;
  /** Sebab penggolongannya, disimpan supaya alasannya terbaca tanpa dihitung ulang. */
  sebab: string;
};

export type DefinisiVariabel = {
  noVar: string;
  nama?: string;
  jenis?: string;
  sqlQuery?: string;
  dataTabel?: string;
  dataKolom?: string;
};

/**
 * Jenis yang nilainya selalu dapat diperoleh mesin.
 *
 * "function" tidak masuk daftar: di ABT ia dipakai untuk hal yang berbeda-beda
 * dan tidak selalu punya sumber. Yang tidak dikenali jatuh ke pemeriksaan
 * berikutnya, bukan langsung dianggap A.
 */
const JENIS_MEKANIS = new Set([
  "data_sql",
  "data_sipp",
  "data_tanggal",
  "tanggal_hari",
  "tanggal_hijriah",
  "terbilang",
  "tanya_jawab",
  "multi_sidang",
  "qrcode",
]);

/** Jenis yang nilainya hanya ada pada manusia yang menyidangkan. */
const JENIS_TANGAN = new Set(["data_teks"]);

/** Pola penanda variabel di dalam naskah dan di dalam kueri ABT. */
const POLA_PENANDA = /#(\d{3,5})#/g;

/**
 * Variabel lain yang disebut sebuah definisi, dari namanya maupun kuerinya.
 *
 * Dipakai penyelesai bertingkat: sebuah variabel tidak dapat diselesaikan
 * sebelum seluruh yang disebutnya selesai. Dirinya sendiri dibuang supaya
 * variabel yang menyebut dirinya tidak tampak sebagai lingkaran.
 */
export function variabelBersarang(def: DefinisiVariabel): string[] {
  const kumpul = new Set<string>();
  for (const teks of [def.nama ?? "", def.sqlQuery ?? ""]) {
    for (const cocok of String(teks).matchAll(POLA_PENANDA)) {
      if (cocok[1] !== def.noVar) kumpul.add(cocok[1]);
    }
  }
  return [...kumpul].sort();
}

/**
 * Golongkan satu definisi.
 *
 * Urutannya penting: jenis yang menjanjikan sumber diperiksa DULU apakah
 * sumbernya sungguh ada. Variabel berjenis data_sql yang sql_query-nya kosong
 * bukan Kelas A - ia menjanjikan kueri yang tidak pernah ditulis, dan
 * memperlakukannya sebagai A berarti penyelesai akan memanggil kueri kosong
 * lalu mengisi naskah dengan hasil yang tidak ada.
 */
export function golongkan(def: DefinisiVariabel): HasilKelas {
  const jenis = String(def.jenis ?? "").trim().toLowerCase();
  const sql = String(def.sqlQuery ?? "").trim();
  const tabel = String(def.dataTabel ?? "").trim();
  const kolom = String(def.dataKolom ?? "").trim();

  if (!jenis) {
    return { kelas: "C", sebab: "Terdaftar di ABT tanpa jenis - tidak dapat diisi siapa pun." };
  }

  if (jenis === "data_sql") {
    if (!sql) {
      return { kelas: "C", sebab: "Berjenis data_sql tetapi sql_query kosong - kueri yang dijanjikan tidak pernah ditulis." };
    }
    return { kelas: "A", sebab: "SQL sudah tertulis di ABT dan tinggal dijalankan." };
  }

  if (jenis === "data_sipp") {
    if (!tabel && !kolom) {
      return { kelas: "C", sebab: "Berjenis data_sipp tetapi tabel dan kolomnya tidak disebut." };
    }
    return { kelas: "A", sebab: `Menunjuk langsung ke SIPP: ${tabel || "?"}.${kolom || "?"}.` };
  }

  if (JENIS_TANGAN.has(jenis)) {
    return { kelas: "B", sebab: "Hanya diketahui hakim atau panitera yang menyidangkan - tidak ada sumbernya di mana pun." };
  }

  if (JENIS_MEKANIS.has(jenis)) {
    return { kelas: "A", sebab: `Dihitung mesin dari jenis "${jenis}".` };
  }

  // Jenis yang tidak dikenali TIDAK diangkat menjadi A. Jenis baru boleh
  // muncul kapan saja di ABT, dan menganggapnya mekanis berarti penyelesai
  // memperlakukan sesuatu yang belum dipahami seolah sudah dipahami.
  return { kelas: "C", sebab: `Jenis "${jenis}" belum dikenali ALETA - perlu diperiksa manusia sebelum dipakai.` };
}

/** Golongan untuk kode yang dipakai blangko tetapi tidak ada barisnya di ABT. */
export function golonganYatim(noVar: string): HasilKelas {
  return {
    kelas: "C",
    sebab: `#${noVar}# dipakai blangko tetapi tidak terdaftar di abt_variabel - salah ketik lama, atau blangko dari satker lain.`,
  };
}

/** Rekapitulasi jumlah per kelas. */
export function rekapKelas(daftar: Array<{ kelas: KelasVariabel }>): Record<KelasVariabel, number> {
  const rekap: Record<KelasVariabel, number> = { A: 0, B: 0, C: 0 };
  for (const item of daftar) rekap[item.kelas] += 1;
  return rekap;
}
