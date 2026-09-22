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
 * Yang tidak terbaca - tanda tangan basah, pemberkasan fisik - TIDAK dikarang
 * menjadi butir. Daftar yang memuat tuduhan yang tidak dapat diperiksa lebih
 * buruk daripada daftar pendek: satu butir palsu membuat seluruh daftarnya
 * tidak dipercaya.
 *
 * RELAAS dulu ikut ditolak di sini dengan alasan yang sama. Alasan itu sudah
 * tidak benar: bot memulangkan adaDokumen per relaas, dan angka yang sama
 * sudah lama dipajang panel sebagai "Relaas berdokumen 4 dari 4". Sejak
 * 22 September 2026 ia menjadi butir PELENGKAP - yang terbaca ada tidaknya
 * pindaiannya, bukan sah tidaknya panggilannya, dan menahan minutasi atas
 * dasar itu berarti menahannya atas hal yang tidak diukur.
 */

/** Satu berkas yang kurang, disebut namanya. */
export type ButirKurang = {
  /** Sebutan pendeknya, mis. "Sidang ke-3" atau "Relaas Tergugat". */
  label: string;
  /** Keterangan di belakangnya, mis. tanggal dan agendanya. */
  catatan?: string;
};

/** Satu hal yang masih tertinggal sebelum berkasnya patut diminutasi. */
export type SebabMinutasi = {
  kunci: string;
  /** Kalimat pendek untuk layar. */
  pesan: string;
  /**
   * YANG KURANG, DISEBUT SATU PER SATU
   * ==================================
   *
   * Diminta pengguna 22 September 2026: "disebut berkas perkara sidang ke
   * berapa dan agenda berapa". Kalimatnya sendiri tidak diubah - lima penjaga
   * mengikat isinya, dan yang lebih penting: "2 dari 5" adalah angka yang
   * dibaca sekilas, dan membenamkan lima nama sidang ke dalamnya justru
   * menghapus angka itu dari pandangan.
   *
   * Daftar ini digambar sebagai sub-daftar di bawah kalimatnya. Yang
   * membacanya sedang menyusun bundel; ia butuh tahu sidang MANA yang harus
   * dibuka, bukan berapa banyak.
   *
   * Kosong bila butirnya memang tidak menunjuk berkas tertentu - naskah
   * putusan, misalnya, hanya ada satu.
   */
  rincian?: ButirKurang[];
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
  jadwal: Array<{
    adaBas: boolean;
    tanggalSidang?: string;
    agenda?: string;
    /**
     * Sidang keberapa menurut SIPP (kolom perkara_jadwal_sidang.urutan).
     *
     * Dapat 0: bot menulis `Number(row.urutan) || 0` dan kolomnya kosong pada
     * sebagian baris lama. Nol BUKAN nomor - yang menulis "sidang ke-0" pada
     * layar menyuruh orang mencari sesuatu yang tidak ada di SIPP.
     */
    urutanSidang?: number;
  }>;
  /**
   * Relaas panggilan beserta ada tidaknya dokumen pindaiannya.
   *
   * Ditambahkan 22 September 2026 atas permintaan pengguna, yang menyebut
   * relaas bersama putusan dan berita acara sidang.
   *
   * Sampai saat itu berkas ini menolak menghitung relaas - lihat catatan di
   * kepala berkas - dengan alasan kelengkapannya "tidak terbaca". Alasan itu
   * sudah tidak benar: bot memulangkan adaDokumen per relaas, dan angka yang
   * sama sudah dipajang panel sebagai "Relaas berdokumen 4 dari 4".
   *
   * Tetap PELENGKAP, bukan penghalang: yang terbaca adalah ada tidaknya
   * PINDAIAN relaas, bukan sah tidaknya panggilannya. Menahan minutasi atas
   * dasar itu berarti menahannya atas hal yang tidak diukur.
   *
   * Tidak wajib dikirim - pemanggil lama tetap sah, dan tanpa daftar ini
   * butirnya sekadar tidak muncul.
   */
  relaas?: Array<{ adaDokumen: boolean; namaPihak?: string; tanggalRelaas?: string }>;
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
 * Tanggal yang terbaca orang, dari apa pun bentuk yang dikirim SIPP.
 *
 * SIPP mengirim "2026-06-10" pada satu tempat dan "2026-06-10 09:00:00" pada
 * tempat lain. Menuliskannya mentah menghasilkan "10 Jun 2026 00:00:00" di
 * tengah kalimat - dan jam yang tidak pernah diminta siapa pun.
 */
function tanggalPendek(nilai?: string): string {
  const t = String(nilai || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return "";
  const [tahun, bulan, hari] = t.split("-");
  const NAMA = ["", "Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  const nama = NAMA[Number(bulan)] ?? bulan;
  return `${Number(hari)} ${nama} ${tahun}`;
}

/**
 * Menyebut satu sidang dengan sebutan yang dikenali orang.
 *
 * ============================================================================
 * NOMOR DULU, TANGGAL BILA NOMORNYA TIDAK ADA
 * ============================================================================
 *
 * "Sidang ke-3" adalah sebutan yang dipakai di ruang panitera dan yang
 * tertulis di berkasnya. Tanggal dipakai hanya bila nomornya tidak terbaca -
 * dan nomornya memang tidak selalu terbaca: bot menulis nol bila kolom
 * urutan SIPP kosong, dan "sidang ke-0" menyuruh orang mencari sesuatu yang
 * tidak ada.
 *
 * Agenda ditulis apa adanya dari SIPP - ejaannya tidak ajek di sana, dan
 * merapikannya berarti menebak. Yang kosong menjadi "tanpa agenda", sebab
 * tanda hubung menggantung di akhir kalimat terbaca seperti teks yang
 * terpotong.
 *
 * Tidak di-export: penjaga menuntut tiap export berkas ini disebut namanya di
 * layar, dan pembantu yang hanya dipakai di sini tidak punya urusan di sana.
 */
function sebutSidang(x: {
  urutanSidang?: number;
  tanggalSidang?: string;
  agenda?: string;
}): ButirKurang {
  const urutan = Number(x.urutanSidang) || 0;
  const tanggal = tanggalPendek(x.tanggalSidang);
  const label = urutan > 0 ? `Sidang ke-${urutan}` : tanggal ? `Sidang ${tanggal}` : "Sidang";
  const agenda = String(x.agenda || "").trim();
  const bagian: string[] = [];
  // Tanggalnya tidak diulang bila ia sudah menjadi labelnya.
  if (urutan > 0 && tanggal) bagian.push(tanggal);
  bagian.push(agenda || "tanpa agenda");
  return { label, catatan: bagian.join(" — ") };
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
      // Sidang MANA - bukan berapa banyak. Angkanya sudah di kalimat di atas;
      // yang menyusun bundel perlu tahu berkas mana yang harus dicari.
      rincian: kurangBas.map(sebutSidang),
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

  // --- Relaas: PELENGKAP, dan sebabnya tertulis ----------------------------
  //
  // Diminta pengguna 22 September 2026. Yang terbaca ada tidaknya PINDAIAN
  // relaas, bukan sah tidaknya panggilannya - lihat catatan pada BahanMinutasi.
  // Karena itu ia tidak menahan minutasi; ia tertunggak dan disebut.
  //
  // Daftar yang TIDAK dikirim sama sekali berbeda artinya dari daftar kosong:
  // yang pertama berarti pemanggilnya belum menyediakannya, yang kedua berarti
  // memang tidak ada relaas. Keduanya sama-sama tidak menghasilkan butir, dan
  // itu disengaja - menuduh "relaas kurang" atas data yang tidak dikirim
  // persis kesalahan yang dihindari seluruh berkas ini.
  if (Array.isArray(bahan.relaas) && bahan.relaas.length > 0) {
    const kurangRelaas = bahan.relaas.filter((x) => !x.adaDokumen);
    if (kurangRelaas.length > 0) {
      sebab.push({
        kunci: "relaas",
        pesan: `${kurangRelaas.length} dari ${bahan.relaas.length} relaas belum ada dokumen pindaiannya.`,
        rincian: kurangRelaas.map((x) => ({
          label: String(x.namaPihak || "").trim() || "Relaas",
          catatan: tanggalPendek(x.tanggalRelaas) || "tanpa tanggal",
        })),
        tingkat: "pelengkap",
      });
    }
  }

  // --- Naskah putusan ------------------------------------------------------
  if (!bahan.adaBerkasPutusan) {
    sebab.push({
      kunci: "naskah-putusan",
      pesan: "Naskah putusan belum diunggah ke SIPP.",
      // Tanggal putusannya disebut supaya yang mencari berkasnya tahu folder
      // tanggal mana yang harus dibuka - SIPP menyimpan naskah menurut
      // tanggal putusannya, bukan menurut nomor perkaranya.
      rincian: tanggalPendek(bahan.tanggalPutusan)
        ? [{ label: "Putusan", catatan: tanggalPendek(bahan.tanggalPutusan) }]
        : undefined,
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
