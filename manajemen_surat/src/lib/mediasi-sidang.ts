/**
 * ============================================================================
 * SIDANG YANG BERURUSAN DENGAN MEDIASI
 * ============================================================================
 *
 * Diminta pengguna 22 September 2026: tombol Mediator di samping Tunda dan
 * Putus, "munculnya ketika keterangan ditunda yaitu keterangannya laporan
 * hasil mediasi atau mediasi para pihak (pokoknya yang ada hubungan mediasi)".
 *
 * ============================================================================
 * DIUKUR, BUKAN DIKIRA - DAN PENGUKURANNYA MENGUBAH TIGA KEPUTUSAN
 * ============================================================================
 *
 * Diukur pada perkara_jadwal_sidang satker (20.109 baris):
 *
 *     alasan_ditunda menyebut mediasi        841
 *     agenda menyebut mediasi                619
 *     salah satu dari keduanya             1.407
 *
 * Tiga hal yang ditentukan angka itu:
 *
 * 1. KEDUANYA DIBACA, bukan alasan_ditunda saja. Membaca alasan tundanya saja
 *    melewatkan 566 baris - lebih dari sepertiga - dan yang terlewat itu
 *    justru sidang yang agendanya memang mediasi.
 *
 * 2. TIDAK MENSYARATKAN ditunda = 'Y'. 28 baris beragenda "Mediasi" dan 21
 *    baris "proses mediasi" berbendera 'T'. Mensyaratkan tundanya membuat
 *    tombolnya tidak pernah muncul pada baris-baris itu, dan diamnya tidak
 *    berbunyi apa pun.
 *
 * 3. POLANYA /medias/, BUKAN /\bmediasi\b/. Tulisannya bebas dan banyak salah
 *    ketik - inilah yang benar-benar ada di data:
 *
 *      "Proses Mediasi" 536   "Mediasi para pihak" 51   "Mediasi" 28
 *      "proses mediasi" 21    "peroses mediasi" 19      "Upaya Mediasi" 13
 *      "Mediasi Lanjutan" 12  "Perdamaian/Mediasi" 7    "Pembacaan Hasil Mediasi" 7
 *      "Laporan hasil mediasi" 5   "Peoses Mediasi" 1   "Proses Mediasin" 1
 *
 *    "Proses Mediasin" dan tulisan yang tersambung tanpa spasi lolos oleh
 *    pola akar kata; pola berbatas kata membuangnya.
 */

/**
 * Akar katanya, bukan kata utuhnya.
 *
 * "medias" menangkap mediasi, mediasin, mediasinya, dan bentuk tersambung
 * seperti "hasilmediasi". "mediator" ditulis terpisah sebab akarnya berbeda -
 * dan ia memang muncul pada agenda "Penunjukan Mediator".
 */
const POLA_MEDIASI = /medias|mediator/i;

/**
 * Apakah sidang ini berurusan dengan mediasi.
 *
 * Membaca agenda DAN alasan tundanya. Keduanya teks bebas dari SIPP, dan
 * keduanya dibaca apa adanya - merapikannya lebih dulu berarti menebak.
 */
export function sidangBerbauMediasi(agenda?: string, alasanDitunda?: string): boolean {
  const gabung = `${String(agenda ?? "")} ${String(alasanDitunda ?? "")}`;
  return POLA_MEDIASI.test(gabung);
}

/**
 * Bagian mana yang menyebut mediasi - untuk diterangkan di layar.
 *
 * Yang membaca tombol yang muncul tiba-tiba akan bertanya "kenapa di baris
 * ini". Menjawabnya dengan menunjukkan kalimat yang memicunya lebih jujur
 * daripada membiarkannya menebak, dan lebih murah daripada menerangkan
 * aturannya.
 */
export function sebabBerbauMediasi(agenda?: string, alasanDitunda?: string): string {
  const a = String(agenda ?? "").trim();
  const t = String(alasanDitunda ?? "").trim();
  const bagian: string[] = [];
  if (a && POLA_MEDIASI.test(a)) bagian.push(`agenda "${a}"`);
  if (t && POLA_MEDIASI.test(t)) bagian.push(`alasan tunda "${t}"`);
  return bagian.join(" dan ");
}
