/**
 * PENJAWAB - BASIS DATA DULU, MODEL TERAKHIR (I5).
 *
 * ============================================================================
 * URUTANNYA BUKAN SOAL BIAYA, MELAINKAN SOAL DAPAT DIPERIKSA
 * ============================================================================
 *
 * Jawaban dari pustaka membawa alamat pasalnya; jawaban dari model membawa
 * kalimat yang terdengar seperti membawa alamat pasalnya. Keduanya terbaca
 * sama meyakinkan di layar, dan hanya yang pertama dapat ditelusuri kembali.
 *
 * Maka pustaka dicoba lebih dulu SELALU - bukan ketika model sedang mahal,
 * bukan ketika jaringan lambat, melainkan selalu. Model dipanggil hanya
 * sesudah pustaka menjawab kosong, dan jawabannya masuk sebagai USULAN.
 *
 * Hematnya biaya adalah akibat, bukan alasan. Kalau alasannya biaya, aturan
 * ini akan dilonggarkan pada hari pagunya masih longgar.
 *
 * ============================================================================
 * LAYAR WAJIB MENYEBUT SIAPA YANG MENJAWAB
 * ============================================================================
 *
 * Inilah bagian yang paling mudah dihilangkan dan paling mahal hilangnya.
 * Tanpa label, hakim membaca dua jawaban yang tampak setara: satu dirakit
 * dari butir yang pernah ia sahkan sendiri, satu dikarang model beberapa
 * detik lalu. Ia tidak punya cara membedakannya, dan tidak ada yang memberi
 * tahu bahwa ada yang perlu dibedakan.
 *
 * `dijawabOleh` karena itu WAJIB pada tiap jawaban, dan tidak punya nilai
 * bawaan. Jawaban tanpa asal tidak dapat dibentuk oleh berkas ini.
 *
 * ============================================================================
 * TIDAK ADA YANG KELUAR SEBELUM DISARING
 * ============================================================================
 *
 * Memanggil model berarti mengirim isi berkas ke luar gedung pengadilan.
 * Itu persis keadaan yang J5 dan J6 dibuat untuknya, jadi keduanya dipakai di
 * sini - bukan diulang, bukan dilonggarkan. Ruas yang belum punya aturan
 * batas menahan seluruh kiriman, dan itu memang yang diinginkan: ruas baru
 * harus diputuskan sekali oleh manusia sebelum ikut terbang.
 */

import { saringKeluar, type AturanBatas, type Putusan } from "@/lib/batas-data";
import { type Penyamar } from "@/lib/penyamaran";

/** Dari mana sebuah jawaban datang. Tidak ada nilai bawaan. */
export type Sumber = "pustaka" | "berkas" | "model" | "tidakDijawab";

export type Jawaban = {
  dijawabOleh: Sumber;
  isi: string;
  /** Alamat pasal atau butir yang mendasarinya; kosong untuk jawaban model. */
  rujukan: string[];
  /**
   * Jawaban ini usulan, bukan pendirian.
   *
   * Selalu true untuk model. Untuk pustaka bergantung keadaan butirnya -
   * butir yang belum disahkan pun usulan, meski datang dari pustaka.
   */
  usulan: boolean;
  /** Hal yang perlu dilihat pembaca sebelum memakainya. */
  peringatan: string[];
};

export type KeadaanPustaka = {
  /** Berapa butir atau pasal yang ditemukan pustaka. */
  jumlah: number;
  isi: string;
  rujukan: string[];
  /** Seluruh yang ditemukan sudah disahkan manusia. */
  disahkan: boolean;
};

export type KeadaanModel = {
  /** AI menyala untuk modul ini. */
  menyala: boolean;
  /** Sebab bila tidak menyala - ditampilkan apa adanya kepada pemakai. */
  sebab: string;
};

/**
 * Memutuskan siapa yang menjawab.
 *
 * Pustaka yang menjawab TIDAK memanggil model sama sekali - bukan memanggil
 * lalu membandingkan. Membandingkan berarti tetap mengirim isi berkas ke luar
 * pada tiap pertanyaan, dan biaya serta risikonya tetap terbayar meski
 * jawabannya tidak dipakai.
 */
export function pilihSumber(pustaka: KeadaanPustaka, model: KeadaanModel): Sumber {
  if (pustaka.jumlah > 0 && pustaka.isi.trim()) return "pustaka";
  if (model.menyala) return "model";
  return "tidakDijawab";
}

/** Jawaban dari pustaka, dengan rujukan yang dapat dibuka. */
export function jawabanPustaka(pustaka: KeadaanPustaka): Jawaban {
  return {
    dijawabOleh: "pustaka",
    isi: pustaka.isi,
    rujukan: pustaka.rujukan,
    usulan: !pustaka.disahkan,
    peringatan: pustaka.disahkan
      ? []
      : ["Butir yang dipakai belum disahkan, sehingga jawabannya masih usulan."],
  };
}

/**
 * Jawaban dari model - SELALU usulan.
 *
 * Tidak ada jalan membuatnya bukan usulan. Model yang jawabannya dapat
 * berstatus pendirian adalah model yang jawabannya akan ditandatangani tanpa
 * dibaca, dan itu bukan keadaan yang boleh dapat dicapai lewat parameter.
 */
export function jawabanModel(masukan: {
  isi: string;
  kutipanTakTerbukti: string[];
  namaModel: string;
}): Jawaban {
  const peringatan = [
    `Disusun model ${masukan.namaModel || "(tidak disebut)"}, bukan diambil dari pustaka. Wajib dibaca sebelum dipakai.`,
  ];
  for (const kutipan of masukan.kutipanTakTerbukti) {
    peringatan.push(`Kutipan "${kutipan}" TIDAK ditemukan di pustaka hukum - periksa sendiri sebelum memakainya.`);
  }
  return {
    dijawabOleh: "model",
    isi: masukan.isi,
    rujukan: [],
    usulan: true,
    peringatan,
  };
}

export function jawabanKosong(sebab: string): Jawaban {
  return {
    dijawabOleh: "tidakDijawab",
    isi: "",
    rujukan: [],
    usulan: false,
    peringatan: [sebab || "Tidak ada jawaban yang dapat diberikan."],
  };
}

export type Kiriman = {
  /** Yang benar-benar boleh dikirim ke penyedia. */
  isi: Record<string, unknown>;
  ditahan: Putusan[];
  disamarkan: Putusan[];
  /** Ruas tanpa aturan batas - menahan seluruh kiriman. */
  belumBeraturan: string[];
  boleh: boolean;
  sebab: string;
};

/**
 * Menyiapkan apa yang boleh keluar.
 *
 * Satu ruas tanpa aturan batas MENAHAN SELURUH kiriman, bukan hanya ruas itu.
 * Mengirim sisanya terasa masuk akal - toh yang tak beraturan sudah dibuang -
 * tetapi akibatnya ketiadaan aturan tidak pernah terasa, dan ruas baru terus
 * bertambah tanpa ada yang memutuskannya. Menahan seluruhnya membuat
 * keputusan itu harus diambil sekali, oleh manusia, pada hari ruas itu
 * pertama kali muncul.
 */
export function siapkanKiriman(
  isi: Record<string, unknown>,
  penyamar: Penyamar,
  aturan?: AturanBatas[]
): Kiriman {
  const hasil = aturan
    ? saringKeluar(isi, penyamar.samarkanNilai, aturan)
    : saringKeluar(isi, penyamar.samarkanNilai);

  const boleh = hasil.belumBeraturan.length === 0;
  return {
    isi: hasil.dikirim,
    ditahan: hasil.ditahan,
    disamarkan: hasil.disamarkan,
    belumBeraturan: hasil.belumBeraturan,
    boleh,
    sebab: boleh
      ? ""
      : `Ruas berikut belum punya aturan batas, sehingga tidak ada yang dikirim: ${hasil.belumBeraturan.join(", ")}.`,
  };
}

/**
 * Ringkasan untuk ditampilkan di layar.
 *
 * Bahasanya sengaja menyebut asalnya lebih dulu, bukan isinya. Pembaca yang
 * melihat "Model menyusun ini" sebelum membaca kalimatnya membaca dengan
 * kewaspadaan yang berbeda daripada yang melihatnya sesudah.
 */
export function sebutkanAsal(jawaban: Jawaban): string {
  switch (jawaban.dijawabOleh) {
    case "pustaka":
      return jawaban.usulan
        ? "Dari pustaka, tetapi butirnya belum disahkan"
        : "Dari pustaka yang sudah disahkan";
    case "berkas":
      return "Dari berkas perkara ini";
    case "model":
      return "Disusun model AI - usulan, bukan pendirian";
    default:
      return "Belum terjawab";
  }
}
