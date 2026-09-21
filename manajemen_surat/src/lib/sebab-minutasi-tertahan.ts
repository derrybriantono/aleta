/**
 * ============================================================================
 * MENGAPA MINUTASI BELUM DAPAT DIKERJAKAN
 * ============================================================================
 *
 * Layar jadwal sudah lama mengatakan "belum minutasi". Yang tidak pernah
 * dikatakannya: APA yang harus dikerjakan lebih dulu. Akibatnya penandanya
 * hanya menuduh, dan yang membacanya tetap harus membuka SIPP satu per satu
 * untuk tahu berkas mana yang kurang.
 *
 * ============================================================================
 * SIPP SENDIRI TIDAK MENGHALANGI APA PUN - DAN ITU HARUS DIKATAKAN
 * ============================================================================
 *
 * Diperiksa pada sumber SIPP 6.2.4 setempat. Yang ada hanya dua hal:
 *
 *   antrian_dirput.php:217   'AND a.tanggal_putusan IS NOT NULL
 *                              AND a.tanggal_minutasi IS NULL'   <- "belum minutasi"
 *   detil_perkara_agama.php:419  tanggal BHT tidak boleh mendahului minutasi
 *
 * Tidak ada satu pun pemeriksaan yang menolak tanggal minutasi karena BAS
 * kurang atau naskah putusan belum diunggah. Tanggal minutasi adalah ruas
 * yang DIKETIK, dan SIPP menerimanya kapan saja sesudah ada putusan.
 *
 * Karena itu daftar di bawah ini TIDAK disebut "syarat" dan tidak pernah
 * berbunyi "SIPP menolak". Ia daftar berkas yang harus ada di dalam bundel
 * sebelum bundelnya patut dijahit - kewajiban tata kelola berkas, bukan
 * kuncian aplikasi. Menyebutnya syarat aplikasi akan membuat orang menyangka
 * SIPP-lah yang menahan, lalu mencari tombol yang tidak pernah ada.
 *
 * ============================================================================
 * HANYA YANG SUNGGUH TERUKUR YANG DISEBUT
 * ============================================================================
 *
 * Tiga hal yang datanya benar-benar dibaca ALETA dari SIPP:
 *
 *   tanggal_putusan                  ada/tidak putusannya
 *   perkara_sidang.<berkas BAS>      BAS tiap sidang
 *   amar_putusan_dok                 naskah putusan
 *   amar_putusan_anonimisasi_dok     naskah anonim
 *
 * Yang tidak terbaca - tanda tangan basah, pemberkasan fisik, kelengkapan
 * relaas dalam bundel - TIDAK dikarang menjadi butir. Daftar yang memuat
 * tuduhan yang tidak dapat diperiksa lebih buruk daripada daftar pendek: satu
 * butir palsu membuat seluruh daftarnya tidak dipercaya.
 */

/** Satu hal yang masih tertinggal sebelum berkasnya patut diminutasi. */
export type SebabMinutasi = {
  kunci: string;
  /** Kalimat pendek untuk layar. */
  pesan: string;
  /**
   * "penghalang" - selama masih ada, minutasi belum patut dikerjakan.
   * "pelengkap"  - tidak menahan minutasi, tetapi tetap tertunggak.
   *
   * Dibedakan supaya naskah anonim yang belum diunggah tidak terbaca sebagai
   * alasan minutasi tertahan. Ia kewajiban publikasi, dan dikerjakan SESUDAH
   * minutasi - lihat antrian_dirput.php:221, yang menghitung "edoc" justru
   * dari perkara yang SUDAH diminutasi.
   */
  tingkat: "penghalang" | "pelengkap";
};

export type BahanMinutasi = {
  /** Perkaranya sudah punya baris putusan di SIPP. */
  sudahPutus: boolean;
  /**
   * Tanggal putusan - BATAS bundel yang akan dijahit.
   *
   * Bukan keterangan tambahan: tanpanya, sidang yang dijadwalkan SESUDAH
   * putusan ikut dihitung, dan seluruh tuduhan BAS-nya palsu. Lihat
   * sidangSampaiPutusan di bawah untuk angkanya.
   */
  tanggalPutusan: string;
  /** Tanggal minutasi di SIPP - kosong berarti belum. */
  tanggalMinutasi: string;
  /** amar_putusan_dok terisi. */
  adaBerkasPutusan: boolean;
  /** amar_putusan_anonimisasi_dok terisi. */
  adaBerkasAnonim: boolean;
  /**
   * Seluruh sidang perkara ini beserta ada tidaknya BAS-nya.
   *
   * Daftar KOSONG bukan berarti "semua BAS lengkap": ia berarti jadwalnya
   * belum terbaca. Keduanya dibedakan di bawah - lihat basBelumTerbaca.
   */
  jadwal: Array<{ adaBas: boolean; tanggalSidang?: string; agenda?: string }>;
};

/**
 * Sudah diminutasi - tidak ada yang perlu diterangkan.
 *
 * Dipisahkan menjadi fungsinya sendiri supaya pemanggilnya tidak perlu
 * mengulang pemeriksaan "kosong atau 0000-00-00" di lima tempat. SIPP menulis
 * tanggal nol, bukan NULL, pada sebagian barisnya.
 */
export function sudahDiminutasi(tanggalMinutasi: string): boolean {
  const t = String(tanggalMinutasi || "").trim();
  if (!t) return false;
  if (t.startsWith("0000-00-00")) return false;
  return true;
}

/**
 * Sidang yang MASUK BUNDEL - sampai hari putusan, tidak lebih.
 *
 * ============================================================================
 * TANPA PENYARINGAN INI, SELURUH TUDUHAN BAS-NYA PALSU
 * ============================================================================
 *
 * jadwalPerkara membawa SELURUH sidang perkara itu, termasuk yang dijadwalkan
 * SESUDAH putusan - dan pada perkara cerai talak itu hal yang biasa: putusan
 * memberi izin mengucapkan ikrar, lalu sidang ikrar talaknya dijadwalkan
 * berbulan-bulan kemudian. Sidang yang belum terjadi tentu belum ada BAS-nya.
 *
 * Diukur pada perkara yang diputus 2026 di SIPP setempat:
 *
 *     perkara putus                                        683
 *     punya sidang berjadwal SESUDAH tanggal putusan        46
 *     BAS kurang pada sidang SAMPAI tanggal putusan          0
 *     BAS kurang pada sidang SESUDAH tanggal putusan         7
 *
 * Nol lawan tujuh. Tanpa penyaringan ini, KETUJUH tuduhan "BAS kurang" yang
 * dikeluarkan layar ini palsu seluruhnya - dan satu butir palsu membuat
 * seluruh daftarnya tidak dipercaya, termasuk butir yang benar.
 *
 * Batasnya <=, bukan <: sidang pada hari putusan justru sidang pembacaannya,
 * dan BAS-nya jelas masuk bundel.
 *
 * Yang tanggalnya TIDAK terbaca ikut dihitung. Ia sudah ada di jadwal perkara
 * yang sudah putus, jadi kemungkinan besar bagian bundelnya; dan bila keliru,
 * kelirunya menambah satu butir yang dapat diperiksa orang - bukan
 * menyembunyikan berkas yang sungguh hilang.
 */
function sidangSampaiPutusan(bahan: BahanMinutasi) {
  const batas = String(bahan.tanggalPutusan || "").slice(0, 10);
  if (!batas) return bahan.jadwal;
  return bahan.jadwal.filter((x) => {
    const tanggal = String(x.tanggalSidang || "").slice(0, 10);
    if (!tanggal) return true;
    return tanggal <= batas;
  });
}

/**
 * Apa saja yang masih tertinggal sebelum berkasnya patut diminutasi.
 *
 * Mengembalikan daftar KOSONG bila:
 *   - perkaranya belum putus sama sekali (minutasi belum pada tempatnya), atau
 *   - sudah diminutasi (tidak ada lagi yang ditanyakan).
 *
 * Urutannya urutan kerja, bukan urutan tingkat: putusan dulu, lalu BAS, lalu
 * naskahnya. Yang membaca daftar ini sedang menyusun berkas, dan ia
 * mengerjakannya menurut urutan itu.
 */
export function sebabMinutasiTertahan(bahan: BahanMinutasi): SebabMinutasi[] {
  if (sudahDiminutasi(bahan.tanggalMinutasi)) return [];
  if (!bahan.sudahPutus) return [];

  const sebab: SebabMinutasi[] = [];

  // --- BAS: dihitung, bukan sekadar disebut ada/tidak ----------------------
  //
  // Jumlahnya disebutkan karena itulah yang membuat butirnya dapat dikerjakan:
  // "3 dari 7 sidang belum ada BAS" mengirim orang membuka tiga sidang; "BAS
  // belum lengkap" mengirimnya membuka tujuh.
  const dalamBundel = sidangSampaiPutusan(bahan);
  const kurangBas = dalamBundel.filter((x) => !x.adaBas);
  if (dalamBundel.length > 0 && kurangBas.length > 0) {
    sebab.push({
      kunci: "bas",
      pesan:
        kurangBas.length === dalamBundel.length
          ? `Berita acara sidang belum ada sama sekali (${kurangBas.length} sidang).`
          : `${kurangBas.length} dari ${dalamBundel.length} sidang belum ada berita acaranya.`,
      tingkat: "penghalang",
    });
  }

  // Jadwalnya sendiri tidak terbaca. Dikatakan apa adanya, BUKAN dihitung
  // sebagai "BAS lengkap" - diam pada keadaan ini membuat berkas yang
  // sebenarnya kurang terbaca sebagai berkas yang sudah beres.
  //
  // Diperiksa pada jadwal MENTAH, bukan yang sudah disaring: jadwal yang
  // seluruhnya jatuh sesudah tanggal putusan bukan jadwal yang gagal dibaca -
  // ia terbaca dengan baik dan memang tidak ada yang masuk bundel.
  if (bahan.jadwal.length === 0) {
    sebab.push({
      kunci: "bas-tak-terbaca",
      pesan: "Jadwal sidang perkara ini belum terbaca, jadi kelengkapan BAS belum dapat diperiksa.",
      tingkat: "pelengkap",
    });
  } else if (dalamBundel.length === 0) {
    // Jadwalnya terbaca, tetapi TIDAK SATU PUN sidangnya jatuh sampai tanggal
    // putusan - seluruhnya sesudahnya. Keadaan yang ganjil dan patut disebut.
    //
    // Dibedakan dari "belum terbaca" di atas: yang itu mengirim orang
    // memeriksa sambungan SIPP, yang ini mengirimnya memeriksa tanggalnya.
    // Dan dibedakan dari diam: tanpa kalimat ini, daftar yang kosong akan
    // dijawab "Berkasnya sudah lengkap" padahal tidak satu BAS pun sempat
    // diperiksa - kalimat yang terdengar seperti pemeriksaan yang lulus.
    sebab.push({
      kunci: "bundel-kosong",
      pesan:
        "Tidak ada sidang yang tercatat sampai tanggal putusan, jadi kelengkapan BAS tidak dapat diperiksa - periksa tanggal putusannya di SIPP.",
      tingkat: "pelengkap",
    });
  }

  // --- Naskah putusan ------------------------------------------------------
  if (!bahan.adaBerkasPutusan) {
    sebab.push({
      kunci: "naskah-putusan",
      pesan: "Naskah putusan belum diunggah ke SIPP.",
      tingkat: "penghalang",
    });
  }

  // --- Naskah anonim: tertunggak, tetapi tidak menahan ---------------------
  //
  // SIPP menghitung "edoc" dari perkara yang SUDAH diminutasi DAN punya
  // naskahnya (antrian_dirput.php:221). Urutannya karena itu minutasi dulu,
  // publikasi kemudian - dan menyebut anonim sebagai penghalang minutasi akan
  // membalik urutan yang dipakai SIPP sendiri.
  if (!bahan.adaBerkasAnonim) {
    sebab.push({
      kunci: "naskah-anonim",
      pesan: "Naskah putusan anonim belum diunggah - diperlukan untuk publikasi, bukan untuk minutasi.",
      tingkat: "pelengkap",
    });
  }

  return sebab;
}

/*
 * TIDAK ADA "ringkasSebabMinutasi" DI SINI - DAN ITU DISENGAJA
 * ============================================================
 *
 * Sempat ditulis: satu kalimat gabungan untuk atribut title pada lencana di
 * baris daftar. Dibuang sebelum di-commit, sebab tidak ada yang dapat
 * memanggilnya dengan jujur.
 *
 * Baris daftar hanya tahu BAS SIDANGNYA SENDIRI. Meringkas sebab dari sana
 * berarti mengarang kalimat yang menyebut BAS lengkap pada perkara yang sidang
 * lainnya belum ada BAS-nya - tepat pada tempat yang paling sering dibaca
 * sekilas. Daftar lengkapnya menuntut jadwal seluruh perkara, dan itu hanya
 * ada di panel Rincian.
 *
 * Fungsi yang diekspor tetapi hanya dipanggil ujinya sendiri tampak seperti
 * cakupan, padahal tidak menjaga apa pun.
 */
