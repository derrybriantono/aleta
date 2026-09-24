/**
 * ============================================================================
 * WARNA PITA WAKTU PUTUS - SK DIRJEN BADILAG 048/DJA/SK.KP3.4.3/IV/2024
 * ============================================================================
 *
 * Diminta pengguna 24 September 2026: "<=3 Bulan itu warna hijau, 4 Bulan
 * itu warna kuning, 5 Bulan warna oranye dan >5 Bulan warna merah" - diukur
 * atas hari perkara berjalan DI LUAR hari mediasi.
 *
 * Waktu Putus Perkara adalah salah satu unsur SK itu (Lampiran, Kriteria
 * huruf a), bukan judulnya: judul resminya "Evaluasi Kinerja pada Sistem
 * Informasi Penelusuran Perkara (SIPP) di Lingkungan Peradilan Agama".
 *
 * Berkas ini SENGAJA tidak memutuskan pita dari jumlah hari. Nilai SK (5, 3,
 * 1, 0) dihitung bot - penilaianSippService.hitungWaktuPutus, TANGGA yang
 * sama yang menilai unsur waktu putus di layar Status Perkara - dan yang ada
 * di sini hanya terjemahan NILAI ke warna. Menulis ulang "<= 90 hijau" di
 * peramban melahirkan aturan kedua yang suatu hari berselisih diam-diam.
 *
 * Tangganya sama, masukannya TIDAK: di Antrian Sidang yang dinilai hari di
 * luar mediasi saja, sebagaimana didefinisikan pengguna - pengecualian perkara
 * khusus (ghaib dan sejenisnya) tidak dipotong. Penilaian SK di Status Perkara
 * memotongnya, sehingga perkara ghaib dapat bernilai lebih baik di sana.
 *
 * `rentang` hanya KETERANGAN untuk legenda; pita-waktu-putus.test.ts
 * memastikannya sama dengan tangga bot.
 *
 * Kuning memakai yellow, bukan amber: amber-100 dan orange-100 nyaris sama di
 * layar, sehingga kuning dan oranye tidak dapat dibedakan.
 *
 * Ini BUKAN kode warna Bab III huruf C SK (hijau/kuning/merah atas persentase
 * nilai satuan kerja). Itu menilai satker; ini satu perkara.
 */
export type PitaWaktuPutus = {
  nilai: 5 | 3 | 1 | 0;
  warna: "hijau" | "kuning" | "oranye" | "merah";
  rentang: string;
  /** Lencana berbingkai dan berlatar - umur perkara di bawah agenda. */
  kelasKotak: string;
  /** Tulisan saja - legenda di Rincian waktu perkara. */
  kelasTeks: string;
};

export const PITA_WAKTU_PUTUS: readonly PitaWaktuPutus[] = [
  {
    nilai: 5,
    warna: "hijau",
    rentang: "paling lama 90 hari (3 bulan)",
    kelasKotak:
      "border-emerald-500 bg-emerald-100 text-emerald-900 dark:bg-emerald-500/15 dark:text-emerald-200",
    kelasTeks: "text-emerald-700 dark:text-emerald-300",
  },
  {
    nilai: 3,
    warna: "kuning",
    rentang: "91-120 hari (4 bulan)",
    kelasKotak:
      "border-yellow-500 bg-yellow-100 text-yellow-900 dark:bg-yellow-500/15 dark:text-yellow-200",
    kelasTeks: "text-yellow-700 dark:text-yellow-300",
  },
  {
    nilai: 1,
    warna: "oranye",
    rentang: "121-150 hari (5 bulan)",
    kelasKotak:
      "border-orange-500 bg-orange-100 text-orange-900 dark:bg-orange-500/15 dark:text-orange-200",
    kelasTeks: "text-orange-700 dark:text-orange-300",
  },
  {
    nilai: 0,
    warna: "merah",
    rentang: "lebih dari 150 hari (lebih dari 5 bulan)",
    kelasKotak: "border-red-500 bg-red-100 text-red-900 dark:bg-red-500/15 dark:text-red-200",
    kelasTeks: "text-red-700 dark:text-red-300",
  },
];

/** Pita untuk sebuah nilai SK; null bila bot belum mengirim nilainya. */
export function pitaWaktuPutus(nilai: number | null | undefined): PitaWaktuPutus | null {
  return PITA_WAKTU_PUTUS.find((p) => p.nilai === nilai) ?? null;
}
