/**
 * ============================================================================
 * MENGUSULKAN ISI MEDAN PILIHAN PADA BORANG PUTUSAN SIPP
 * ============================================================================
 *
 * Borang Putusan Akhir tidak hanya berisi teks panjang. Ia juga menuntut
 * pilihan yang BERBEDA-BEDA menurut jenis perkara dan status putusannya, dan
 * tiap pilihan itu masuk ke laporan resmi:
 *
 *   Cerai (alur 15, status 62)   faktor perceraian, faktor sekunder, nusyuz,
 *                                qobla/ba'da dukhul, keadaan istri
 *   Dispensasi kawin (362)       alasan pengajuan - hamil, pergaulan bebas,
 *                                ekonomi, budaya/adat, menghindari zina
 *   Izin poligami (341)          alasan izin
 *   Pembatalan perkawinan (344)  alasan pembatalan
 *   Itsbat nikah (360)           alasan itsbat
 *   Asal usul anak (358)         alasan permohonan
 *   Ekonomi syariah              jenis akad
 *
 * Angka-angka inilah yang kemudian menjadi Laporan Faktor Penyebab Perceraian
 * dan statistik Dispensasi Kawin. Salah pilih di sini tidak terlihat di
 * putusannya sama sekali - ia baru muncul setahun kemudian sebagai angka yang
 * tidak masuk akal pada laporan satuan kerja.
 *
 * ============================================================================
 * PILIHANNYA DATANG DARI HALAMAN, BUKAN DARI HAFALAN
 * ============================================================================
 *
 * Berkas ini TIDAK memuat satu pun nomor pilihan SIPP. Daftar pilihan dikirim
 * ekstensi apa adanya dari borang yang sedang terbuka - sudah disaring SIPP
 * menurut jenis perkara, jenis pengadilan, dan versinya sendiri - dan yang
 * dikerjakan di sini hanya memilih SATU di antaranya berdasarkan bunyi
 * putusan.
 *
 * Akibatnya: SIPP boleh menambah, menghapus, atau menomori ulang pilihannya
 * tanpa satu baris pun di sini berubah. Yang menghafal nomor akan diam-diam
 * salah pada hari daftarnya diperbarui, dan salahnya tidak berbunyi.
 *
 * ============================================================================
 * TIDAK PERNAH MENEBAK
 * ============================================================================
 *
 * Bila tidak ada pilihan yang benar-benar disebut naskahnya, yang dikembalikan
 * KOSONG beserta sebabnya - bukan pilihan pertama, bukan "Lain-Lain". Usulan
 * yang menebak akan dicentang orang yang sedang terburu-buru, dan tebakan itu
 * menjadi angka resmi.
 *
 * Ada satu jenis jawaban yang BUKAN tebakan meski tidak tertulis: BAWAAN yang
 * diukur. Faktor pokok "Perselisihan dan Pertengkaran" dan Keadaan Istri
 * menurut jenis perkara dipakai karena diukur lebih tepat daripada membaca
 * kata - dan keduanya tidak pernah mengaku "pasti".
 *
 * ============================================================================
 * SEBERAPA BAIK INI SEBENARNYA - DIUKUR, BUKAN DIKIRA
 * ============================================================================
 *
 * Diukur atas 1.633 putusan 2025-2026 PA Donggala yang pilihannya SUDAH
 * ditetapkan petugas (perkara dianggap belum putus, usulan dijalankan, lalu
 * dibandingkan dengan isian yang tersimpan). Dasar yang dipakai pertimbangan
 * hukum dan amar yang tersimpan di SIPP:
 *
 *                      sebelum      sesudah (26 Sep 2026)
 *   Status putusan     1.382/1.633  1.598/1.633  dari AMAR - statusMenurutAmar
 *   Verstek            1.513/1.633  1.537/1.633  dari amar
 *   Faktor pokok         310/960      582/960    susunFaktorPerceraian
 *   Faktor sekunder       51/252      115/252    susunFaktorPerceraian
 *   Alasan dispensasi      0/22        22/22     nilai terpilih - hormatiTerpilih
 *   Qobla                945/950      949/950    "pasti" salah 4 -> 0
 *   Nusyuz               238/279      242/279
 *   Sumber hukum sama persis 696/1.631, tidak berubah.
 *
 * Yang dibayar untuk itu juga diukur: pada faktor pokok 79 dari 960 putusan
 * yang dijawab benar kode lama kini salah (8,2%) - 76 di antaranya dulu
 * berkeyakinan "bentrok", jadi tidak tercentang sendiri - dan pada sekunder
 * 30 dari 252 (11,9%). Ambang regresi rencana (0,5%) TIDAK tercapai. Aturan
 * yang dicocokkan pada data yang sama memang dapat mencapai pokok >= 519
 * dengan regresi <= 0,5%, tetapi pada uji silang dua belahan data (dicocokkan
 * di satu belahan, diukur di belahan lain) tidak satu pun mencapai keduanya:
 * yang benarnya >= 54,1% regresinya 2,5-7,2%, yang regresinya 0% benarnya
 * hanya 33,6% (pembetul-regresi-5.js).
 *
 * Yang dapat ditekan tanpa mengubah nilai adalah usulan salah yang
 * TERCENTANG SENDIRI (dasar lebih dari satu kini "bentrok"):
 *
 *                         kode lama   sebelum     sesudah pembetul
 *   Pokok tercentang      149 benar   403 benar   391 benar
 *                         160 salah   174 salah   140 salah
 *   Sekunder tercentang    47 benar   115 benar    69 benar
 *                         182 salah   123 salah    59 salah
 *
 * Dari 79 regresi pokok yang tersisa, 14 tercentang sendiri (sebelumnya 25);
 * dari 30 regresi sekunder, 8 (sebelumnya 29). Skrip ukurnya:
 * D:/aleta-dev/kerja/enam-butir/t1-borang-putusan-portal/ (ukur-borang2.ts,
 * pembetul-banding.js).
 */

export type PilihanMedan = {
  /** Nilai yang akan disetel ke borang - apa adanya dari halaman. */
  nilai: string;
  /** Tulisan yang dibaca petugas pada daftar pilihan. */
  label: string;
};

export type MedanPilihan = {
  /** Penunjuk CSS medan pada halaman, mis. "#faktor_cerai". */
  kunci: string;
  /** Nama medan sebagaimana tertulis di borang. */
  label: string;
  pilihan: PilihanMedan[];
  /**
   * Medan yang boleh bernilai lebih dari satu - kotak centang, bukan daftar.
   *
   * Sumber Hukum adalah satu-satunya pada borang putusan, dan ia memang
   * hampir selalu lebih dari satu: putusan cerai yang khas menyebut
   * Undang-Undang, Kompilasi Hukum Islam, dan fiqh sekaligus. Mengusulkan
   * satu saja berarti dua sisanya diisi tangan tiap kali.
   */
  banyak?: boolean;
  /**
   * Nilai yang SUDAH terpilih di halaman ketika ekstensi membacanya (kontrak
   * K9). Kosong, "-1", dan pilihan berbunyi "Pilih ..." berarti belum ada yang
   * terpilih.
   */
  terpilih?: string | string[];
};

/**
 * Dari mana sebuah usulan berasal (kontrak K9).
 *
 *   amar           kata kerja amar draf - status putusan dan verstek
 *   pertimbangan   naskah dasar yang dikirim: pertimbangan dan duduk perkara
 *                  pada borang putusan, posita dan petitum pada Data Umum -
 *                  termasuk bawaan kode ketika naskahnya diam
 *   halaman        nilai yang sudah terpilih di borang
 *   bawaan-satker  bawaan tambahan satker dari daftar putusan.bawaan-medan
 */
export type SumberUsulan = "amar" | "pertimbangan" | "halaman" | "bawaan-satker";

export type UsulanMedan = {
  kunci: string;
  label: string;
  /** Kosong berarti tidak ada usulan - dan itu jawaban yang sah. */
  nilai: string;
  nilaiLabel: string;
  keyakinan: "pasti" | "cukup" | "bentrok" | "kosong";
  /** Kalimat naskah yang menjadi dasarnya, apa adanya. */
  kutipan: string;
  /** Pilihan lain yang ikut terjaring, supaya petugas melihat saingannya. */
  saingan: Array<{ nilai: string; label: string; nilai_skor: number }>;
  alasan: string;
  /**
   * Untuk medan bernilai banyak: SELURUH pilihan yang naskahnya menyebut,
   * masing-masing beserta kalimat yang menjadi dasarnya.
   *
   * Tidak ada "juara" di sini - pada kotak centang, dua pilihan yang sama
   * kuat bukan perselisihan melainkan dua-duanya benar.
   */
  nilaiBanyak?: Array<{ nilai: string; label: string; kutipan: string }>;
  /** Asal usulan - lihat SumberUsulan. Kosong bila tidak ada usulan. */
  sumberUsulan?: SumberUsulan;
};

/**
 * Satu entri daftar tipe keluaran sebagaimana dikirim portal (bentuk EntriTipe
 * kontrak K3/K10). Ditulis setempat supaya berkas ini tidak bergantung pada
 * modul basis data; bentuknya sama.
 */
export type EntriTipeMedan = {
  kunci: string;
  nilai: string;
  data?: Record<string, unknown> | null;
  urutan?: number;
  /** "bawaan" (cermin kode) atau "tambahan" (entri satker yang disahkan). */
  asal?: string;
};

/** Daftar EFEKTIF (kontrak K3) yang dipakai berkas ini. */
export type TipeUsulanMedan = Partial<
  Record<"putusan.sumber-hukum.sebutan" | "putusan.bawaan-medan", EntriTipeMedan[] | null>
>;

export type OpsiUsulanMedan = {
  /** Nama jenis perkara, mis. "Cerai Gugat" - menentukan sebagian bawaan. */
  jenisPerkara?: string;
  /**
   * Amar draf, TERPISAH dari naskah dasar. Status putusan dan verstek dibaca
   * dari sini lebih dahulu; pertimbangan hanya cadangan.
   */
  amar?: string;
  /** Daftar efektif dari basis data tipe keluaran. Tanpa ini dipakai konstanta. */
  tipe?: TipeUsulanMedan | null;
  /**
   * Daftar efektif putusan.bawaan-medan. Bila diisi, ia menggantikan
   * tipe["putusan.bawaan-medan"]. Entri berasal "tambahan" menghasilkan
   * sumberUsulan "bawaan-satker".
   */
  bawaanSatker?: EntriTipeMedan[] | null;
  /**
   * Buang kalimat rujukan sebelum medan fakta dinilai (bawaan: ya). Data
   * Umum mematikannya: posita bukan pertimbangan, dan kalimat faktanya kerap
   * memuat "Nomor" - nomor akta, nomor surat keterangan. Diukur atas 25
   * permohonan dispensasi, menyaringnya menurunkan usulan yang benar dari 13
   * menjadi 2.
   */
  saringRujukan?: boolean;
  /**
   * Naskah PERTIMBANGAN HUKUM saja, bila pemanggil dapat memisahkannya dari
   * duduk perkara (draf putusan ALETA: pecahNaskahPutusan). Medan temuan
   * (nusyuz, keadaan isteri - PenandaMedan.hanyaPertimbangan) hanya dinilai
   * atas naskah ini; medan lain tetap membaca naskah dasar seperti biasa.
   * Tanpa ini perilakunya sama dengan sebelumnya.
   */
  pertimbangan?: string;
};

/** Kata yang terlalu umum untuk menjadi bukti apa pun. */
const KATA_UMUM = new Set([
  "yang",
  "dan",
  "atau",
  "dari",
  "pada",
  "dalam",
  "untuk",
  "tidak",
  "dapat",
  "telah",
  "sudah",
  "akan",
  "oleh",
  "dengan",
  "adalah",
  "karena",
  "lain",
  "lainnya",
  "salah",
  "satu",
  "pihak",
  "hukum",
  "perkara",
  "orang",
  "anak",
  "istri",
  "suami",
  "kawin",
  "nikah",
  "perkawinan",
  "pengadilan",
  "agama",
]);

/**
 * ============================================================================
 * SEBUTAN LAIN YANG SAH - KEBIASAAN PENULISAN, BUKAN TEBAKAN
 * ============================================================================
 *
 * Sebagian pilihan pada borang SIPP tidak pernah ditulis persis begitu di
 * dalam putusan. Tidak ada satu putusan pun yang berbunyi "UU/PP"; yang
 * ditulis "Undang-Undang Nomor 1 Tahun 1974" dan "Peraturan Pemerintah Nomor
 * 9 Tahun 1975". Tidak ada yang menulis "Fiqh Islam" sebagai sumber hukum;
 * yang ditulis "hukum syar'i" pada kalimat Mengingat.
 *
 * Tanpa daftar ini, Sumber Hukum selalu menjawab "tidak ditemukan" pada
 * naskah yang jelas-jelas menyebut ketiganya - dan petugas mencentang enam
 * kotak itu dengan tangan tiap perkara.
 *
 * Yang ada di sini KEBIASAAN PENULISAN, bukan penalaran hukum. Tiap sebutan
 * adalah kata yang memang dipakai naskah untuk menunjuk pilihan itu, dan tiap
 * usulan yang dihasilkannya tetap membawa kalimat asalnya untuk dibaca.
 *
 * Dicocokkan atas label yang sudah dinormalkan, sehingga huruf besar dan
 * tanda baca borang tidak perlu ditebak.
 *
 * Diekspor untuk cermin bawaan daftar putusan.sumber-hukum.sebutan
 * (tipe-keluaran/bawaan/bawaan-putusan-medan.ts). Isinya TIDAK diubah oleh
 * basis data: satker menambah lewat daftar tipe keluaran, dan daftar efektif
 * itu dikirim lewat opsi.tipe.
 */
export const SEBUTAN_LAIN: Record<string, string[]> = {
  // Kuncinya bentuk yang dihasilkan normalkan(), dan normalkan MEMPERTAHANKAN
  // garis miring - "UU/PP" menjadi "uu/pp", bukan "uu pp".
  "uu/pp": ["undang undang nomor", "undang undang no", "peraturan pemerintah nomor"],
  "kompilasi hukum islam": ["kompilasi hukum islam", "khi"],
  "kompilasi hukum ekonomi syariah": ["kompilasi hukum ekonomi syariah", "khes"],
  "qanun aceh": ["qanun"],
  "fiqh islam": ["hukum syar i", "hukum syari", "fiqih", "fikih", "kitab fiqh"],
  yurisprudensi: ["yurisprudensi", "putusan mahkamah agung nomor"],
};

/**
 * ============================================================================
 * BAWAAN MENURUT JENIS PERKARA
 * ============================================================================
 *
 * Pada cerai gugat, isteri hadir sendiri sebagai Penggugat dan keadaan
 * sucinya ditanyakan majelis di persidangan - jawabannya "Suci".
 *
 * Pada cerai talak, yang berperkara suaminya; keadaan isteri tidak ditanyakan
 * dan memang tidak diketahui. Menjawab "Suci" di situ berarti menuliskan
 * keterangan yang tidak pernah ada di berkas.
 *
 * Diukur atas 942 putusan cerai dikabulkan 2025-2026: cerai gugat 414 "Suci"
 * lawan 383 "Tidak diketahui", cerai talak 86 "Tidak diketahui" lawan 57
 * "Suci". Kebenarannya berpola menurut SIAPA yang menginput, bukan menurut
 * naskah - karena itu bawaan ini dapat disetel satker lewat daftar
 * putusan.bawaan-medan, dan keyakinannya tidak pernah "pasti".
 *
 * Nilainya LABEL pilihan, dicocokkan tanpa memandang huruf besar-kecil.
 * Diekspor untuk cermin bawaan daftar putusan.bawaan-medan.
 */
export const BAWAAN_MENURUT_PERKARA: ReadonlyArray<{
  medan: string;
  jenisPerkara: string;
  nilai: string;
}> = [
  { medan: "Keadaan Istri", jenisPerkara: "gugat", nilai: "Suci" },
  { medan: "Keadaan Istri", jenisPerkara: "talak", nilai: "Tidak diketahui" },
];

/**
 * ============================================================================
 * MEDAN YANG PILIHANNYA TIDAK PERNAH TERTULIS
 * ============================================================================
 *
 * "Putusan Verstek" menawarkan Ya dan Tidak. Tidak satu pun dari kedua kata
 * itu menjadi bukti apa pun - yang menjadi bukti adalah kata "verstek" pada
 * amar dan pertimbangannya.
 *
 * Karena itu medan semacam ini dikenali dari NAMA MEDANNYA, lalu jawabannya
 * ditentukan oleh ada-tidaknya frasa penentu di dalam naskah. Daftarnya
 * sengaja pendek: hanya medan yang benar-benar berbentuk ya/tidak dan
 * penentunya satu frasa yang tidak bermakna ganda.
 *
 * Kecuali verstek, yang dinilai di sini NASKAH FAKTA - naskah dasar yang
 * kalimat rujukannya sudah dibuang (lihat saringKalimatRujukan). Kutipan
 * pasal "kecuali bekas isteri qabla al-dukhul" bukan fakta perkara siapa pun.
 */
type PenandaMedan = {
  medan: RegExp;
  frasa: RegExp;
  ya: RegExp;
  tidak: RegExp;
  /**
   * Bila petikan yang tertangkap frasa - beserta seluruh kalimat di depannya -
   * memuat ini, ia TIDAK dihitung: petikan yang mengingkari atau
   * mengandaikan dirinya sendiri.
   */
  bukan?: RegExp;
  /** Seperti bukan, tetapi diperiksa atas SELURUH kalimat petikannya. */
  bukanKalimat?: RegExp;
  /** Sebutan medan pada kalimat sebab, supaya alasannya terbaca petugas. */
  sebut: string;
  /** Verstek dinilai atas naskah penuh; sisanya atas naskah fakta. */
  naskahPenuh?: boolean;
  /**
   * Medan yang jawabannya lebih dari ya/tidak (keadaan isteri): pilihan yang
   * dicari ditentukan kata yang tertangkap frasa, bukan selalu `ya`.
   */
  mauDari?: (cocok: RegExpExecArray) => RegExp;
  /**
   * Pernyataan TEGAS bahwa jawabannya `tidak` ("tidak terbukti nusyuz").
   * Tanpa ini ketiadaan frasa hanya bawaan ("cukup"); dengan ini, sebutan
   * tegasnya dijawab "pasti". Kalimat yang memuat `bukanTidak` diabaikan.
   */
  frasaTidak?: RegExp;
  bukanTidak?: RegExp;
  /**
   * Pemeriksaan terakhir atas petikan yang lolos frasa, bukan, dan
   * bukanKalimat - untuk syarat yang tidak dapat ditulis sebagai satu pola
   * ("hamil" menuntut penanda waktu kini, "suci" cukup "dalam keadaan").
   */
  sahkan?: (cocok: RegExpExecArray) => boolean;
  /**
   * Medan TEMUAN majelis (nusyuz, keadaan isteri): bila pemanggil mengirim
   * naskah pertimbangan tersendiri (OpsiUsulanMedan.pertimbangan), frasanya
   * hanya dicari di situ - bukan di duduk perkara, tempat posita, jawaban,
   * dan keterangan saksi menceritakan kehamilan yang sudah lewat, kehamilan
   * orang lain, dan klaim para pihak.
   */
  hanyaPertimbangan?: boolean;
};

const PENANDA_MEDAN: PenandaMedan[] = [
  {
    medan: /verstek/i,
    frasa: /\bverstek\b/i,
    ya: /^(ya|iya|verstek|1)$/i,
    tidak: /^(tidak|bukan|0)$/i,
    sebut: "verstek",
    naskahPenuh: true,
  },
  {
    // ────────────────────────────────────────────────────────────────────
    // NUSYUZ - BAWAANNYA TIDAK NUSYUZ, DAN ITU BUKAN KELALAIAN
    // ────────────────────────────────────────────────────────────────────
    //
    // Nusyuz adalah tuduhan terhadap isteri, dan akibatnya nyata: ia
    // menggugurkan hak nafkah iddah. Putusan yang tidak menyatakannya berarti
    // isterinya TIDAK nusyuz - bukan berarti keadaannya belum diketahui.
    //
    // YANG DIHITUNG HANYA TEMUAN. Sebutan pihak harus diikuti kata kerja
    // temuan ("terbukti", "telah", "berbuat", "melakukan", "dinyatakan")
    // sebelum kata nusyuz. Diukur atas 960 putusan cerai dikabulkan, bentuk
    // lamanya (sebutan pihak berdekatan dengan kata nusyuz) mengaku pasti 6
    // kali dan benar 1 - sisanya pertanyaan ("apakah Termohon ... nusyuz atau
    // tidak"), dalil ("mendalilkan Termohon telah nusyuz"), pengingkaran
    // ("tidak satupun terbukti Termohon melakukan nusyuz"), dan pengandaian
    // ("jika nusyuz istri berdampak ..."). Tiap bentuk itu dikenali di bawah.
    medan: /nusyuz/i,
    frasa:
      /(?:penggugat|termohon|tergugat|pemohon|isteri|istri)\b[^.;]{0,60}?\b(?:terbukti|telah|dinyatakan|berbuat|melakukan|bersikap)\b[^.;]{0,40}?\bnusyuz\b/i,
    bukan: /\b(?:tidak|bukan|belum|tanpa|kecuali|sepanjang|apabila|jika|bila|manakala|seandainya|mendalilkan|menuduh|tuduhan|dalil|dalilnya|mengaku)\b/i,
    bukanKalimat: /\bapakah\b|\batau\s+tidak\b|\bada\s+tidaknya\b|\bada\s+atau\s+tidak/i,
    ya: /^nusyuz$/i,
    tidak: /^tidak\s*nusyuz$/i,
    sebut: "temuan bahwa isteri nusyuz",
    // 26 September 2026 (permintaan pengguna 2): bawaannya tetap Tidak
    // Nusyuz ("cukup"), tetapi pertimbangan yang MENYATAKAN tegas isteri
    // tidak nusyuz dijawab "pasti" - "tidak dalam keadaan nusyuz", "tidak
    // terbukti sebagai istri yang nusyuz", "nusyuz Penggugat Rekonvensi
    // tidak terbukti", "tidak dapat dikatakan sebagai isteri yang nusyuz".
    // Pertanyaan ("apakah ... nusyuz atau tidak"), pengandaian, dan beban
    // bukti ("tidak mampu membuktikan dirinya tidak nusyuz" - tersimpan
    // Nusyuz) tidak dihitung.
    frasaTidak:
      /\btidak\s+(?:terbukti\s+)?(?:dalam\s+keadaan\s+|melakukan\s+(?:perbuatan\s+)?|sebagai\s+(?:isteri|istri)\s+yang\s+|bersikap\s+)?nusyuz\b|\bnusyuz\b[^.;]{0,50}?\btidak\s+terbukti\b|\b(?:tidak|bukan)\b[^.;]{0,40}?\b(?:menyatakan|menunjukkan|dikatakan|dikategorikan)\b[^.;]{0,40}?\bnusyuz\b/i,
    // 26 September 2026 (pemeriksa): "tidak nusyuz" yang DIUCAPKAN PIHAK
    // bukan temuan - "Termohon dalam jawabannya menyatakan dirinya tidak
    // nusyuz", "Termohon membantah ... tidak nusyuz", "Majelis tidak
    // sependapat dengan Termohon yang menyatakan dirinya tidak nusyuz", dan
    // "dalil Termohon ... tidak nusyuz tidak terbukti, maka Termohon
    // dinyatakan nusyuz" dahulu dijawab "pasti Tidak Nusyuz" - yang terakhir
    // justru kebalikannya. Klaim pihak yang disusul penolakannya, dan kaidah
    // umum tanpa sebutan pihak ("isteri yang tidak nusyuz berhak ..."),
    // juga tidak dihitung. Dalil NUSYUZ yang tidak terbukti ("dalil nusyuz
    // yang diajukan Tergugat telah dinyatakan tidak terbukti") tetap temuan.
    bukanTidak:
      /\bapakah\b|\batau\s+tidak\b|\bada\s+tidaknya\b|\bapabila\b|\bjika\b|\bkecuali\b|membuktikan\s+dirinya|\btidak\s+sependapat\b|\b(?:menyatakan\s+dirinya|mengaku|membantah|bantahan(?:nya)?|jawaban(?:nya)?|berdalih|dalih(?:nya)?|mendalilkan|dalil(?:nya)?)\b[^.;]{0,60}?\btidak\s+(?:\S+\s+){0,4}?nusyuz\b|\btidak\s+(?:\S+\s+){0,4}?nusyuz\b[^.;]{0,60}?\b(?:tidak\s+(?:terbukti|beralasan|berdasar)|ditolak|dikesampingkan)\b|^(?![^\n]*\b(?:penggugat|tergugat|pemohon|termohon)\b)[^\n]*\byang\s+tidak\s+nusyuz\b/i,
    hanyaPertimbangan: true,
  },
  {
    // ────────────────────────────────────────────────────────────────────
    // QOBLA/BA'DA DUKHUL - BAWAANNYA BA'DA
    // ────────────────────────────────────────────────────────────────────
    //
    // Qobla dukhul berarti belum pernah berkumpul sebagai suami isteri, dan
    // itu keadaan yang jarang serta selalu DISEBUT tegas dalam pertimbangan
    // karena mengubah jumlah iddah. Perkara yang tidak menyebutnya ba'da.
    //
    // Diukur atas 950 putusan: 4 dari 6 usulan "pasti Qobla" SALAH, dan
    // keempatnya kutipan Pasal 149 KHI tentang mut'ah - "kecuali bekas isteri
    // qabla al-dukhul". Kalimat semacam itu kini dibuang sebagai rujukan, dan
    // yang lolos masih disaring kata pengecualiannya.
    medan: /qobla|ba'?da|dukhul/i,
    frasa: /\bqobla\b|\bqabla\b|belum\s+pernah\s+(?:ber)?kumpul/i,
    bukanKalimat: /\bkecuali\b|\bapabila\b|\bpengecualian\b|mut['’`]?ah|pasal\s*149/i,
    ya: /qobla|qabla/i,
    tidak: /ba'?da/i,
    sebut: "qobla dukhul",
  },
  {
    // ────────────────────────────────────────────────────────────────────
    // KEADAAN ISTERI - BAWAANNYA BERGANTUNG JENIS PERKARA
    // ────────────────────────────────────────────────────────────────────
    //
    // Lihat BAWAAN_MENURUT_PERKARA. "Hamil" hanya dipilih bila naskah
    // menyatakan kehamilan yang SEDANG berlangsung. Diukur atas 942 putusan:
    // bentuk lamanya (kata "hamil" di mana saja) mengaku pasti 9 kali dan
    // SALAH kesembilannya - "sejak Penggugat sedang hamil anak pertama",
    // "menutupi aib karena telah hamil diluar nikah", kutipan Pasal 149 KHI.
    medan: /keadaan\s*istri|keadaan\s*isteri/i,
    // 26 September 2026 (permintaan pengguna 2): selain hamil, keadaan SUCI
    // dan HAID yang disebut tegas ("Termohon dalam keadaan suci", "Penggugat
    // sedang haid") kini diikuti dengan keyakinan "pasti". Tanpa sebutan,
    // bawaan menurut jenis perkara tetap berlaku. Diukur atas 942 putusan
    // cerai dikabulkan 2025-2026: tidak satu pun pertimbangan menyebut
    // keadaan isteri sebagai fakta - "suci" hanya muncul di kutipan iddah
    // ("tiga kali suci", 171 putusan), nama saksi ("Suci binti ..."), dan
    // "tujuan suci perkawinan"; ketiganya tidak tertangkap frasa ini.
    //
    // 26 September 2026 (pemeriksa): bentuk pertama frasa ini ("dalam
    // keadaan" atau "sedang" di depan hamil/mengandung, tanpa subjek) diukur
    // atas pertimbangan, posita, dan keterangan saksi sipp_donggala: 11
    // perkara baru "pasti Hamil", 9 salah - kehamilan yang sudah lewat
    // ("meninggalkan Penggugat dalam keadaan hamil anak kedua" pada 2018),
    // kehamilan orang lain ("menikah dengan wanita lain dan sedang
    // mengandung"), anak para Pemohon dispensasi, dan "petitum masih
    // mengandung kekaburan"; "tidak dalam keadaan hamil" dan "bukan dalam
    // keadaan haid" pun terbaca sebaliknya. Kini petikannya harus:
    //   - bersubjek isteri (Termohon/Penggugat), tanpa orang lain di antara
    //     subjek dan keadaannya;
    //   - untuk HAMIL, memuat penanda waktu kini (sedang, saat ini, sekarang,
    //     kini, masih) - "dalam keadaan hamil" telanjang hampir selalu cerita
    //     lampau; "mengandung" hanya bila disusul anak/janin/bayi;
    //   - untuk SUCI/HAID, penanda waktu kini atau "dalam keadaan" tepat di
    //     depannya ("Termohon dalam keadaan suci");
    //   - tanpa pengingkaran di antara subjek dan keadaannya ("tidak dalam
    //     keadaan hamil", "bukan dalam keadaan haid", "dalam keadaan tidak
    //     hamil").
    // Medan ini temuan majelis: bila naskah pertimbangan dikirim tersendiri,
    // hanya itu yang dibaca (hanyaPertimbangan).
    frasa:
      /\b(termohon|penggugat)\b((?:(?!\b(?:pemohon|tergugat|suami|wanita|perempuan|laki-laki|pria|anak|calon|ibu|bayi|janin)\b)[^.;]){0,60}?)\b(hamil|mengandung\s+(?:anak|janin|bayi)|suci|haidh?|menstruasi)\b/i,
    // Tahun, "saat"/"disaat"/"waktu" yang bukan "saat ini", keguguran, dan
    // kepergian menandai CERITA: "sekitar bulan Januari 2022 saat Penggugat
    // sedang hamil", "menendang punggung Penggugat yang sedang hamil ...
    // mengalami keguguran", "meninggalkan Penggugat yang sedang hamil 6 bulan"
    // (5 dari 7 "pasti Hamil" posita/saksi yang tersisa, diukur 26 September
    // 2026; yang lolos "Pada saat ini, Penggugat sedang hamil 1 bulan").
    bukanKalimat:
      /\b(?:sejak|ketika|saat\s+itu|waktu\s+itu|dahulu|dulu|pernah|sebelum|kecuali|apabila|jika|bila)\b|luar\s+nikah|kali\s+suci|\bbagi\s+(?:yang|isteri|istri|janda)\b|waktu\s+tunggu|\biddah\b|\b(?:tidak|bukan|belum)\s+(?:sedang\s+)?(?:hamil|mengandung|suci|haid|haidh|menstruasi)\b|\b(?:19|20)\d{2}\b|\b(?:di)?saat\b(?!\s+ini)|\bwaktu\b(?!\s+(?:ini|sekarang))|keguguran|\bmeninggalkan\b|\bditinggal(?:kan)?\b/i,
    sahkan: (cocok) => {
      const antara = cocok[2] ?? "";
      if (/\b(?:tidak|bukan|belum)\b/i.test(antara)) return false;
      const kini = /\b(?:sedang|saat\s+ini|sekarang|kini|masih)\b/i.test(antara);
      if (/^(?:hamil|mengandung)/i.test(cocok[3] ?? "")) return kini;
      return kini || /\bdalam\s+keadaan\s*$/i.test(antara);
    },
    ya: /hamil/i,
    mauDari: (cocok) => (/^suci$/i.test(cocok[3]) ? /^suci$/i : /haid|menstruasi/i.test(cocok[3]) ? /^haid$/i : /hamil/i),
    tidak: /suci|tidak\s*diketahui/i,
    sebut: "keadaan isteri (suci, haid, atau hamil)",
    hanyaPertimbangan: true,
  },
];

/**
 * ============================================================================
 * KALIMAT RUJUKAN BUKAN FAKTA PERKARA
 * ============================================================================
 *
 * Pertimbangan hukum memuat dua macam kalimat: fakta perkara ini, dan kutipan
 * pasal, surat edaran, atau pendapat hukum yang berlaku untuk SEMUA perkara.
 * "Pasal 149 huruf (b) KHI: ... kecuali bekas isteri ... nusyuz ... qabla
 * al-dukhul" tidak menyatakan apa pun tentang isteri di perkara ini, dan SEMA
 * 1/2022 tentang "indikator" rumah tangga pecah menyebut perselisihan,
 * pisah rumah, dan kekerasan sekaligus pada tiap perkara yang mengutipnya.
 *
 * Kalimat yang mengutip Pasal, Nomor, SEMA, KHI, "indikator", atau "qabla
 * al-dukhul" dibuang SEBELUM medan fakta dinilai. Sumber Hukum dan verstek
 * tetap membaca naskah penuh - justru di kalimat rujukan itulah undang-undang
 * dan kitab disebut.
 */
const POLA_KALIMAT_RUJUKAN =
  /\bpasal\b|\bnomor\b|\bsema\b|\bkhi\b|kompilasi\s+hukum\s+islam|\bindikator\b|\bq[ao]bla\s+a[ld][\s-]*dukh/i;

/**
 * Potongan yang MEMBUKA kutipan: menyebut sumber hukum dan berakhir titik
 * dua ("Pasal 122 Kompilasi Hukum Islam berbunyi:", "sabda Rasulullah SAW
 * yang artinya:"). pecahKalimat memotong di ": ", sehingga isi kutipannya
 * kehilangan kata Pasal/KHI dan dahulu terbaca fakta perkara - "Talak bid'i
 * adalah talak yang dijatuhkan pada waktu isteri dalam keadaan haid" menjadi
 * "pasti Haid" (pemeriksa, 26 September 2026). "fakta" SENGAJA menolak:
 * "... Pasal 311 R.Bg., ditemukan fakta hukum sebagai berikut:" membuka
 * fakta, bukan kutipan.
 */
const POLA_PEMBUKA_KUTIPAN =
  /\bpasal\b|\bsema\b|\bkhi\b|kompilasi\s+hukum\s+islam|undang[\s-]*undang|peraturan\s+pemerintah|\bhadi(?:s|ts|th)\b|\bfirman\b|\bsabda\b|\bkaidah\b|\bqa?idah\b|\bkitab\b|\bdalil\s+syar/i;
/** Paragraf yang memulai pertimbangan baru - kutipan lintas baris berhenti di sini. */
const POLA_AWAL_PERTIMBANGAN =
  /^\s*(?:(?:[-•*]|\d{1,2}[.)])\s*)?(?:menimbang|mengingat|memperhatikan|mengadili|menetapkan|bahwa|dengan\s+demikian|oleh\s+karena|berdasarkan|maka)\b/i;
/** Batas baris kutipan sesudah pembuka yang berakhir di ujung baris. */
const BATAS_BARIS_KUTIPAN = 12;

/**
 * Naskah tanpa kalimat rujukan, dipisah per baris.
 *
 * Kutipan yang dibuka POLA_PEMBUKA_KUTIPAN ikut dibuang bersama pembukanya:
 * sisa barisnya, dan - bila titik duanya di ujung baris - baris-baris
 * berikutnya sampai paragraf pertimbangan baru (paling banyak
 * BATAS_BARIS_KUTIPAN baris).
 */
export function saringKalimatRujukan(naskah: string): string {
  const hasil: string[] = [];
  let sisaBarisKutipan = 0;
  for (const baris of String(naskah ?? "").split(/\n+/)) {
    if (sisaBarisKutipan > 0) {
      if (!POLA_AWAL_PERTIMBANGAN.test(baris)) {
        sisaBarisKutipan--;
        continue;
      }
      sisaBarisKutipan = 0;
    }
    const potongan = pecahKalimat(baris);
    let kutipan = false;
    potongan.forEach((satu, i) => {
      if (kutipan) return;
      if (/:\s*["'“”]?$/.test(satu) && POLA_PEMBUKA_KUTIPAN.test(satu) && !/\bfakta\b/i.test(satu)) {
        kutipan = true;
        if (i === potongan.length - 1) sisaBarisKutipan = BATAS_BARIS_KUTIPAN;
        return;
      }
      if (!POLA_KALIMAT_RUJUKAN.test(satu)) hasil.push(satu);
    });
  }
  return hasil.join("\n");
}

/**
 * ============================================================================
 * FAKTOR PERCERAIAN YANG POKOK BUKAN YANG PALING SERING DISEBUT
 * ============================================================================
 *
 * Perkara yang para pihaknya berpisah dua tahun atau lebih PASTI didasarkan
 * Pasal 19 huruf (b) PP 9/1975 jo. Pasal 116 huruf (b) KHI - meninggalkan
 * salah satu pihak. Itu bukan tafsir: dua tahun berturut-turut adalah unsur
 * yang disebut pasalnya sendiri, dan majelis menyebutnya di pertimbangan
 * justru untuk menyatakan unsurnya terpenuhi.
 *
 * Pola ini hanya dipakai bila naskahnya tidak menyebut huruf pasal sama
 * sekali. Bila menyebut, huruf pasalnya yang menentukan - lihat
 * susunFaktorPerceraian.
 */
const POLA_DITINGGAL_DUA_TAHUN =
  /(?:meninggalkan|pergi|tidak\s+kembali|pisah)[^.;]{0,160}?\b(?:2|dua)\b\s*(?:\(\s*dua\s*\))?\s*tahun|(?:\b(?:2|dua)\b\s*(?:\(\s*dua\s*\))?\s*tahun)[^.;]{0,80}?(?:berturut|meninggalkan|tanpa\s+izin)/i;

/** Kepergian dua tahun ATAU LEBIH - penentu huruf (b) bila huruf (f) juga disebut. */
const POLA_PERGI_DUA_TAHUN_LEBIH =
  /(?:meninggalkan|pergi|tidak\s+kembali|pisah)[^.;]{0,160}?\b(?:2|dua|[3-9]|tiga|empat|lima|enam|tujuh|delapan|sembilan|sepuluh)\b\s*(?:\([^)]*\)\s*)?tahun/i;

/** Label faktor yang berarti "meninggalkan salah satu pihak". */
const POLA_FAKTOR_MENINGGALKAN = /meninggalkan|pergi|ditinggal/i;

/** Label faktor "Perselisihan dan Pertengkaran" - SIPP menulisnya "Peselisihan". */
const POLA_FAKTOR_PERSELISIHAN = /pe(?:r)?selisihan|pertengkaran/i;

/** Tanda rumah tangga pecah karena perselisihan, pada naskah fakta. */
const POLA_ADA_PERSELISIHAN =
  /perselisihan|pertengkaran|bertengkar|berselisih|cekcok|percekcokan|tidak\s+harmonis|tidak\s+rukun|\bpecah\b|broken|syiqaq|tidak\s+ada\s+harapan/i;

/** Kalimat fakta yang menyebut para pihak - tempat ciri alasan dicari. */
const POLA_KALIMAT_PIHAK = /\b(?:penggugat|tergugat|pemohon|termohon|suami|isteri|istri)\b/i;

/**
 * "Masalah ekonomi" disebut sebagai penyebab (bentuk yang dipakai pertimbangan
 * satker). Keputusan pengguna 26 September 2026, "pakai praktik sekarang":
 * pokoknya Perselisihan, Ekonomi menjadi SEKUNDER - lihat susunFaktorPerceraian.
 */
const POLA_MASALAH_EKONOMI = /\b(?:masalah|faktor|persoalan|permasalahan|alasan)\s+ekonomi\b/i;

/**
 * Ciri alasan pada kalimat fakta, dan label faktor yang ditunjuknya.
 *
 * Urutan daftar ini dipakai sebagai pemecah seri: bila dua ciri sama sering
 * disebut, yang lebih dulu di sini yang diusulkan. Katanya bersumber dari
 * CIRI_ALASAN bot (abtUsulanService.js), ditambah "shabu" dan bentuk sehari-
 * hari yang terukur dipakai pertimbangan satker.
 *
 * 26 September 2026: bentuk yang dibaca tepat di BAS petugas ikut dipakai di
 * sini - kekerasan pasif ("dipukul", "ditampar", "dicekik", "pemukulan",
 * ancaman "senjata/benda tajam"), "obat-obat terlarang", "cap tikus", judi
 * "slot", malas/tidak mau bekerja dan "pekerjaan/penghasilan tetap" (Ekonomi),
 * dan "menikah siri"/"menikah dengan wanita lain" (Poligami). Diukur atas 960
 * putusan cerai dikabulkan: pokok tetap 582 benar, tercentang salah 140 -> 138;
 * sekunder 115 -> 116 benar dari 252, tercentang salah 59 -> 58; tanpa
 * regresi. Selingkuh dan WIL SENGAJA tetap menunjuk "Zina": mencabutnya
 * (hanya zina/berzina) menaikkan tercentang salah pokok 138 -> 150, sebab
 * ciri itulah yang menahan bawaan perselisihan menjadi "pilih sendiri".
 * SIPP tidak punya pilihan pihak ketiga; petugas memilih Zina hanya 3 kali
 * dari 227 putusan yang menyebutnya.
 */
const CIRI_FAKTOR: Array<{ ciri: string; label: RegExp; kata: RegExp }> = [
  {
    ciri: "madat",
    label: /madat|narkoba|narkotika/i,
    kata: /\b(?:sabu|shabu|sabu-sabu|narkoba|narkotika|pemadat|madat|ganja|obat\s+terlarang|obat-obatan\s+terlarang|obat-obat\s+terlarang|psikotropika)\b/i,
  },
  {
    ciri: "mabuk",
    label: /mabuk/i,
    kata: /\b(?:mabuk|mabuk-mabukan|minuman\s+keras|miras|pemabuk|pemabok|minuman\s+beralkohol|minum-minuman|cap\s+tikus|memabukkan)\b/i,
  },
  { ciri: "judi", label: /judi/i, kata: /\b(?:judi|berjudi|penjudi|togel|sabung\s+ayam|slot)\b/i },
  {
    ciri: "kekerasan",
    label: /kekerasan|kdrt|kekejaman|aniaya/i,
    kata: /\b(?:kdrt|memukul|dipukul|pemukulan|menampar|ditampar|menendang|ditendang|mencekik|dicekik|menjambak|menganiaya|penganiayaan|kekejaman|kekerasan|main\s+tangan|ringan\s+tangan|senjata\s+tajam|benda\s+tajam)\b/i,
  },
  {
    ciri: "zina",
    label: /zina/i,
    kata: /\b(?:zina|berzina|selingkuh|berselingkuh|perselingkuhan|idaman\s+lain|wanita\s+lain|perempuan\s+lain|laki-laki\s+lain|pria\s+lain|pihak\s+ketiga)\b/i,
  },
  {
    ciri: "ekonomi",
    label: /ekonomi/i,
    kata: /\b(?:ekonomi|nafkah|menafkahi|tidak\s+bekerja|malas\s+bekerja|malas\s+kerja|malas\s+dalam\s+bekerja|tidak\s+mau\s+bekerja|pekerjaan\s+tetap|penghasilan\s+tetap|menelantarkan|tidak\s+bertanggung\s+jawab)\b/i,
  },
  {
    ciri: "meninggalkan",
    label: POLA_FAKTOR_MENINGGALKAN,
    kata: /\b(?:pisah\s+rumah|pisah\s+tempat\s+tinggal|berpisah\s+tempat\s+tinggal|pisah\s+ranjang|meninggalkan|pergi)\b/i,
  },
  {
    ciri: "penjara",
    label: /penjara|pidana/i,
    kata: /\b(?:dipenjara|lembaga\s+pemasyarakatan|menjalani\s+pidana|dihukum\s+penjara|narapidana)\b/i,
  },
  { ciri: "murtad", label: /murtad/i, kata: /\b(?:murtad|pindah\s+agama|keluar\s+dari\s+agama\s+islam)\b/i },
  { ciri: "cacat", label: /cacat/i, kata: /\b(?:cacat\s+badan|impoten|gangguan\s+jiwa)\b/i },
  {
    ciri: "poligami",
    label: /poligami/i,
    kata: /\b(?:poligami|menikah\s+lagi|kawin\s+lagi|beristri\s+lagi|beristeri\s+lagi|menikah\s+siri|menikah\s+dengan\s+(?:wanita|perempuan|laki-laki|pria)\s+lain)\b/i,
  },
  { ciri: "kawin paksa", label: /paksa/i, kata: /\b(?:kawin\s+paksa|dijodohkan|dipaksa\s+menikah|perjodohan)\b/i },
];

/**
 * Huruf Pasal 19 PP 9/1975 dan Pasal 116 KHI dengan faktor yang ditunjuknya,
 * menurut urutan penentuan bila lebih dari satu huruf selain (f) disebut.
 *
 *   b  meninggalkan salah satu pihak dua tahun berturut-turut
 *   c  hukuman penjara lima tahun atau lebih
 *   d  kekejaman atau penganiayaan berat
 *   a  zina, pemabuk, pemadat, penjudi - yang mana, ditentukan ciri
 *   h  peralihan agama (murtad)
 *   e  cacat badan atau penyakit
 */
const HURUF_FAKTOR: Array<{ huruf: string; label?: RegExp; ciriA?: boolean }> = [
  { huruf: "b", label: POLA_FAKTOR_MENINGGALKAN },
  { huruf: "c", label: /penjara|pidana/i },
  { huruf: "d", label: /kekerasan|kdrt|kekejaman|aniaya/i },
  { huruf: "a", ciriA: true },
  { huruf: "h", label: /murtad/i },
  { huruf: "e", label: /cacat/i },
];

function normalkan(teks: string): string {
  return String(teks ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Label medan dibandingkan tanpa memandang ejaan "isteri"/"istri". */
function normalkanLabelMedan(teks: string): string {
  return normalkan(teks).replace(/\bisteri\b/g, "istri");
}

/** Kata bermakna pada sebuah label pilihan. */
function kataPenting(label: string): string[] {
  return normalkan(label)
    .split(/[\s/]+/)
    .filter((kata) => kata.length >= 4 && !KATA_UMUM.has(kata));
}

/**
 * Label yang memuat garis miring adalah beberapa kemungkinan sekaligus -
 * "Pergaulan Bebas/Hubungan Intim" terpenuhi oleh salah satunya. Dipecah
 * supaya naskah yang hanya menyebut "hubungan intim" tetap tertangkap.
 */
function kemungkinanLabel(label: string): string[] {
  const bagian = String(label ?? "")
    .split("/")
    .map((satu) => satu.trim())
    .filter(Boolean);
  return bagian.length > 1 ? [label, ...bagian] : [label];
}

/** Naskah dipecah menjadi kalimat - satuan tempat sebuah fakta dinyatakan. */
function pecahKalimat(naskah: string): string[] {
  return String(naskah ?? "")
    .split(/(?<=[.;:])\s+|\n+/)
    .map((satu) => satu.trim())
    .filter(Boolean);
}

/** Dipangkas supaya kutipan yang panjang tidak memenuhi panel. */
function pangkas(kalimat: string): string {
  return kalimat.length > 300 ? `${kalimat.slice(0, 300)}…` : kalimat;
}

/** Kalimat pertama yang memuat frasa utuh itu. */
function kalimatBerfrasa(kalimat: string[], frasa: string): string {
  for (const satu of kalimat) {
    if (normalkan(satu).includes(frasa)) return pangkas(satu);
  }
  return "";
}

/** Kalimat pertama yang cocok dengan pola itu. */
function kalimatBerpola(kalimat: string[], pola: RegExp): string {
  for (const satu of kalimat) {
    if (pola.test(satu)) return pangkas(satu);
  }
  return "";
}

/**
 * Nilai satu pilihan terhadap naskah.
 *
 * Kata yang lebih panjang berbobot lebih besar: "pertengkaran" menyebut satu
 * hal tertentu, sedangkan "badan" dapat muncul di mana saja. Seluruh kata
 * penting yang hadir bersama-sama memberi tambahan tersendiri - itulah beda
 * antara naskah yang benar-benar menyebut "perselisihan dan pertengkaran terus
 * menerus" dan naskah yang kebetulan memuat kata "terus".
 */
function skorPilihan(
  naskah: string,
  kalimat: string[],
  label: string,
  sebutanLain: Record<string, string[]>
): { skor: number; kata: string[]; kalimat: string } {
  const rendahPenuh = normalkan(naskah);
  let terbaik = { skor: 0, kata: [] as string[], kalimat: "" };

  // Sebutan lain dinilai lebih dahulu dan sebagai FRASA UTUH - "undang undang
  // nomor" yang hadir apa adanya adalah bukti selengkap label yang hadir apa
  // adanya. Yang tidak punya sebutan lain sama sekali tidak terpengaruh.
  for (const sebutan of sebutanLain[normalkan(label)] ?? []) {
    const frasa = normalkan(sebutan);
    if (!frasa || !rendahPenuh.includes(frasa)) continue;
    const skor = 100 + frasa.length;
    if (skor > terbaik.skor) {
      terbaik = { skor, kata: [frasa], kalimat: kalimatBerfrasa(kalimat, frasa) };
    }
  }

  for (const kemungkinan of kemungkinanLabel(label)) {
    const kata = kataPenting(kemungkinan);
    if (kata.length === 0) continue;

    // Frasa utuh - bukti terkuat yang mungkin ada.
    const frasa = normalkan(kemungkinan);
    if (frasa.length >= 6 && rendahPenuh.includes(frasa)) {
      const skor = 100 + frasa.length;
      if (skor > terbaik.skor) terbaik = { skor, kata, kalimat: kalimatBerfrasa(kalimat, frasa) };
      continue;
    }

    // ────────────────────────────────────────────────────────────────────
    // KATA DIHITUNG DI DALAM SATU KALIMAT, BUKAN DI SELURUH NASKAH
    // ────────────────────────────────────────────────────────────────────
    //
    // Ini pernah dikerjakan atas seluruh naskah sekaligus, dan itu keliru
    // dengan cara yang hanya kelihatan pada berkas sungguhan. Diukur atas 184
    // permohonan dispensasi kawin PA Donggala yang alasannya sudah dipilih
    // petugas, yang dicocokkan atas seluruh naskah hanya sepakat pada 116 -
    // dan hampir seluruh selisihnya satu pola: permohonan yang alasannya
    // HAMIL diusulkan "Menghindari Zina/Hubungan Cinta".
    //
    // Sebabnya: posita dispensasi selalu panjang, menyebut "hubungan mereka
    // telah erat" di satu alinea dan "telah saling mencintai" di alinea lain.
    // Dihitung atas seluruh naskah, kedua kata itu "hadir bersama" dan
    // memperoleh tambahan sebagai label yang lengkap - mengalahkan satu kata
    // "hamil" yang justru menentukan perkaranya.
    //
    // Sebuah fakta dinyatakan dalam SATU KALIMAT. Dua kata yang tersebar di
    // dua halaman bukan bukti bahwa naskahnya menyebut keduanya sebagai satu
    // hal.
    for (const satu of kalimat) {
      const rendah = normalkan(satu);
      const hadir = kata.filter((k) => rendah.includes(k));
      if (hadir.length === 0) continue;

      let skor = hadir.reduce((jumlah, k) => jumlah + k.length, 0);
      // Seluruh kata hadir pada kalimat yang sama: jauh lebih meyakinkan
      // daripada sebagian.
      if (hadir.length === kata.length) skor += 20 * kata.length;
      if (skor > terbaik.skor) terbaik = { skor, kata: hadir, kalimat: pangkas(satu) };
    }
  }

  return terbaik;
}

/** Label yang berbunyi ajakan memilih, bukan jawaban. */
function labelAjakan(label: string): boolean {
  const bersih = normalkan(label).replace(/^[-\s]+|[-\s]+$/g, "");
  return !bersih || /^(pilih|silakan pilih|none|kosong)\b/.test(bersih);
}

/** Pilihan yang bukan pilihan: "- Pilih -", "0", dan sejenisnya. */
function pilihanKosong(satu: PilihanMedan): boolean {
  const label = normalkan(satu.label);
  const nilai = String(satu.nilai ?? "").trim();
  if (!label) return true;
  if (nilai === "" || nilai === "0" || nilai === "-1") return true;
  return /^(pilih|silakan pilih|none|kosong)$/.test(label.replace(/^[-\s]+|[-\s]+$/g, ""));
}

/** Pilihan pertama pada medan yang labelnya cocok, selain ajakan memilih. */
function pilihanBerlabel(pilihan: PilihanMedan[], pola: RegExp): PilihanMedan | undefined {
  return (pilihan ?? []).find(
    (x) => String(x.nilai ?? "").trim() !== "" && !labelAjakan(x.label) && pola.test(String(x.label))
  );
}

/** Opsi dari parameter ketiga - string lama (jenis perkara) tetap diterima. */
function bacaOpsi(masukan: string | OpsiUsulanMedan | null | undefined): Required<Pick<OpsiUsulanMedan, "jenisPerkara" | "amar">> &
  OpsiUsulanMedan {
  if (masukan && typeof masukan === "object") {
    return { ...masukan, jenisPerkara: String(masukan.jenisPerkara ?? ""), amar: String(masukan.amar ?? "") };
  }
  return { jenisPerkara: String(masukan ?? ""), amar: "" };
}

/** SEBUTAN_LAIN, atau daftar efektif putusan.sumber-hukum.sebutan bila dikirim. */
function susunSebutanLain(tipe: TipeUsulanMedan | null | undefined): Record<string, string[]> {
  const daftar = tipe?.["putusan.sumber-hukum.sebutan"];
  if (!Array.isArray(daftar)) return SEBUTAN_LAIN;
  const hasil: Record<string, string[]> = {};
  const urut = [...daftar].sort((a, b) => Number(a?.urutan ?? 0) - Number(b?.urutan ?? 0));
  for (const entri of urut) {
    const kunci = normalkan(String(entri?.kunci ?? ""));
    const nilai = String(entri?.nilai ?? "").trim();
    if (!kunci || !nilai) continue;
    (hasil[kunci] ??= []).push(nilai);
  }
  return hasil;
}

type BawaanMedan = { medan: string; jenisPerkara: string; nilai: string; dariSatker: boolean };

/**
 * Daftar bawaan yang berlaku: bawaanSatker, lalu tipe["putusan.bawaan-medan"],
 * lalu BAWAAN_MENURUT_PERKARA. Daftar yang dikirim adalah daftar EFEKTIF
 * (kontrak K3) - bawaan yang dimatikan satker memang tidak ada di dalamnya.
 */
function susunBawaanMedan(opsi: OpsiUsulanMedan): BawaanMedan[] {
  const dariParameter = Array.isArray(opsi.bawaanSatker);
  const daftar = dariParameter ? opsi.bawaanSatker : opsi.tipe?.["putusan.bawaan-medan"];
  if (!Array.isArray(daftar)) {
    return BAWAAN_MENURUT_PERKARA.map((x) => ({ ...x, dariSatker: false }));
  }
  const hasil = [...daftar]
    .filter((x) => x && String(x.kunci ?? "").trim() && String(x.nilai ?? "").trim())
    .sort((a, b) => Number(a?.urutan ?? 0) - Number(b?.urutan ?? 0))
    .map((x) => {
      // Asal "bawaan" dan "cermin" (basis data tak terbaca, K3) sama-sama
      // nilai kode. Tambahan satker berasal "tambahan"; entri bawaanSatker
      // yang tidak menyebut asalnya dianggap tambahan satker.
      const asal = String(x.asal ?? "");
      return {
        medan: String(x.kunci),
        jenisPerkara: String((x.data && (x.data as Record<string, unknown>).jenisPerkara) ?? ""),
        nilai: String(x.nilai),
        dariSatker: asal === "tambahan" || (dariParameter && asal === ""),
      };
    });
  // Tambahan satker didahulukan atas bawaan kode untuk medan dan jenis yang sama.
  return [...hasil.filter((x) => x.dariSatker), ...hasil.filter((x) => !x.dariSatker)];
}

/** Jenis perkara dalam bentuk kunci daftar bawaan: "gugat", "talak", atau nama. */
function jenisBaku(jenisPerkara: string): string {
  if (/cerai\s*gugat/i.test(jenisPerkara)) return "gugat";
  if (/cerai\s*talak/i.test(jenisPerkara)) return "talak";
  return normalkan(jenisPerkara);
}

/** Bawaan yang berlaku untuk satu medan pada jenis perkara ini, beserta pilihannya di halaman. */
function cariBawaan(
  daftar: BawaanMedan[],
  medan: MedanPilihan,
  jenisPerkara: string
): { pilihan: PilihanMedan; dariSatker: boolean } | null {
  const labelMedan = normalkanLabelMedan(medan.label);
  const jenis = jenisBaku(jenisPerkara);
  for (const satu of daftar) {
    if (normalkanLabelMedan(satu.medan) !== labelMedan) continue;
    const jenisEntri = normalkan(satu.jenisPerkara);
    const berlaku = !jenisEntri || jenisEntri === "*" || jenisEntri === jenis || jenisEntri === normalkan(jenisPerkara);
    if (!berlaku) continue;
    const pilihan = (medan.pilihan ?? []).find(
      (x) => !labelAjakan(x.label) && normalkan(x.label) === normalkan(satu.nilai)
    );
    if (pilihan) return { pilihan, dariSatker: satu.dariSatker };
  }
  return null;
}

/**
 * ============================================================================
 * STATUS PUTUSAN DIBACA DARI KATA KERJA AMAR
 * ============================================================================
 *
 * Pertimbangan menguraikan alasan, amar menyatakan putusannya. Membaca status
 * dari pertimbangan menghasilkan 1.382 dari 1.631 yang sama dengan isian
 * petugas - dan salahnya berpola: "permohonan pencabutan ... dapat
 * dikabulkan" menjadi Dikabulkan, "Majelis telah berusaha mendamaikan"
 * menjadi Perdamaian.
 *
 * Aturannya selaras dengan HARAPAN_STATUS di praperiksa-putusan.ts (kata
 * kerja yang HARUS ada di amar untuk tiap status), dibaca dari arah
 * sebaliknya: dari amar ke status. Urutan di bawah menentukan: pencabutan dan
 * gugur lebih dulu, sebab keduanya DITETAPKAN lewat kata "mengabulkan"
 * ("mengabulkan permohonan pencabutan"). Tidak dapat diterima, perdamaian,
 * dan menolak kalah oleh "mengabulkan" yang ada di amar yang sama -
 * "mengabulkan gugatan sebagian; menolak selebihnya" tetap Dikabulkan.
 *
 * Yang dibaca bagian POKOK amar: bagian eksepsi dilewati ("menolak eksepsi"
 * bukan menolak gugatan) dan bagian rekonvensi dipisah dari konvensinya.
 *
 * Gugur dan Digugurkan adalah dua status SIPP dengan amar yang sama bunyinya
 * ("menyatakan gugatan ... gugur"). Diukur atas 72 putusan bergugur: 35 Gugur,
 * 37 Digugurkan, tanpa pembeda di amar maupun pertimbangan. Keduanya karena
 * itu dijawab BENTROK - usulannya bunyi harfiahnya, dan saingannya yang lain.
 */
type StatusAmar = "dicabut" | "gugur" | "digugurkan" | "tdd" | "perdamaian" | "ditolak" | "dicoret" | "dikabulkan";

/**
 * Yang dicabut harus PERKARANYA - "gugatan pencabutan hak asuh anak" pada
 * amar pengabulan cerai bukan pencabutan perkara. Diukur: bentuk yang hanya
 * menuntut kata "pencabutan" salah pada 2 dari 1.362 putusan dikabulkan.
 */
const POLA_CABUT_PERKARA =
  /\bpencabutan\s+(?:perkara|gugatan|permohonan)|\bmencabut\s+(?:perkara|gugatan|permohonan)|\b(?:perkara|gugatan|permohonan)\b[^.;]{0,80}\bdicabut\b/i;

const ATURAN_STATUS_AMAR: Array<{ status: StatusAmar; kata: RegExp; kalahOleh?: RegExp; sebutan: string }> = [
  { status: "dicabut", kata: POLA_CABUT_PERKARA, sebutan: "pencabutan" },
  { status: "digugurkan", kata: /\bdigugurkan\b|\bmenggugurkan\b/, sebutan: "menggugurkan" },
  { status: "gugur", kata: /\bgugur\b/, sebutan: "gugur" },
  {
    status: "tdd",
    kata: /tidak\s+(?:dapat\s+)?diterima|niet\s*ontvankelijk|\(\s*n\.?\s*o\.?\s*\)/,
    kalahOleh: /\bmengabulkan\b/,
    sebutan: "tidak dapat diterima",
  },
  { status: "perdamaian", kata: /\bperdamaian\b|\bberdamai\b/, kalahOleh: /\bmengabulkan\b/, sebutan: "perdamaian" },
  { status: "ditolak", kata: /\bmenolak\s+(?:gugatan|permohonan)\b/, kalahOleh: /\bmengabulkan\b/, sebutan: "menolak" },
  { status: "dicoret", kata: /\bdicoret\b|\bmencoret\b/, kalahOleh: /\bmengabulkan\b/, sebutan: "dicoret dari register" },
  {
    status: "dikabulkan",
    kata: /\bmengabulkan\b|\bmenetapkan\b|\bmenjatuhkan\b|\bmemberi(?:kan)?\s+izin\b|\bmengizinkan\b|\bmenyatakan\s+sah\b/,
    sebutan: "mengabulkan",
  },
];

/** Label pilihan Status Putusan untuk tiap status, dicocokkan atas label ternormal. */
const LABEL_STATUS: Record<StatusAmar, RegExp> = {
  dicabut: /\bdicabut\b|\bcabut\b/,
  gugur: /^gugur$/,
  digugurkan: /\bdigugurkan\b/,
  tdd: /tidak (?:dapat )?diterima|\bn o\b|niet/,
  perdamaian: /damai/,
  ditolak: /\bditolak\b/,
  dicoret: /coret/,
  dikabulkan: /\bdikabulkan\b|\bkabul/,
};

/**
 * Teks amar yang siap dibaca aturan: huruf kecil, spasi dirapatkan, dan judul
 * berspasi ("M E N G A D I L I", "D A L A M") disatukan kembali.
 */
function rapatkanAmar(amar: string): string {
  return String(amar ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\b(?:[a-z] ){2,}[a-z]\b/g, (cocok) => cocok.replace(/ /g, ""))
    .trim();
}

/** Bagian pokok amar: sesudah "dalam pokok perkara", tanpa bagian rekonvensi. */
function amarPokok(amarRapat: string): string {
  let teks = amarRapat;
  const pokok = teks.search(/dalam\s+pokok\s+perkara/);
  if (pokok >= 0) teks = teks.slice(pokok);
  const rekonvensi = teks.search(/dalam\s+rekonvensi/);
  if (rekonvensi >= 0) {
    const konvensi = teks.search(/dalam\s+konvensi(?!\s+dan\s+rekonvensi)/);
    if (konvensi >= 0 && konvensi < rekonvensi) teks = teks.slice(konvensi, rekonvensi);
    else if (konvensi < 0) teks = teks.slice(0, rekonvensi);
  }
  return teks;
}

type HasilAmar = { status: StatusAmar; sebutan: string; kutipan: string } | null;

/** Status menurut kata kerja amar, atau null bila amar tidak menyebut satu pun. */
function statusMenurutAmar(amar: string): HasilAmar {
  const rapat = rapatkanAmar(amar);
  if (!rapat) return null;
  const pokok = amarPokok(rapat);
  for (const aturan of ATURAN_STATUS_AMAR) {
    if (!aturan.kata.test(pokok)) continue;
    if (aturan.kalahOleh && aturan.kalahOleh.test(pokok)) continue;
    const kutipan = pecahKalimat(amar).find((satu) => aturan.kata.test(rapatkanAmar(satu))) ?? "";
    return { status: aturan.status, sebutan: aturan.sebutan, kutipan: pangkas(kutipan) };
  }
  return null;
}

type UsulanDalam = UsulanMedan & {
  /**
   * Bukti yang boleh MENGALAHKAN nilai yang sudah terpilih di halaman: kata
   * kerja amar, huruf pasal yang disebut tanpa huruf (f), atau frasa tegas
   * penanda. Kecocokan kata pada label BUKAN bukti semacam itu - frasa
   * "dampak ekonomi" hadir pada tiap pertimbangan dispensasi.
   */
  tegas?: boolean;
};

/**
 * Usulan status putusan dari amar; null bila amar tidak dapat dibaca.
 *
 * Pada gugur, pertimbangan dipakai HANYA untuk memilih bunyi mana yang
 * diusulkan lebih dulu: pertimbangan yang menulis "digugurkan" atau
 * "menggugurkan" condong ke Digugurkan (15 lawan 12 atas 27 putusan), yang
 * tidak menulisnya condong ke Gugur (23 lawan 22). Keyakinannya tetap bentrok.
 */
function usulanStatusDariAmar(dasar: UsulanMedan, medan: MedanPilihan, amar: string, pertimbangan: string): UsulanDalam | null {
  const hasil = statusMenurutAmar(amar);
  if (!hasil) return null;
  const pilihan = medan.pilihan ?? [];
  const cari = (status: StatusAmar) =>
    pilihan.find((x) => !pilihanKosong(x) && LABEL_STATUS[status].test(normalkan(x.label)));

  if (hasil.status === "gugur" || hasil.status === "digugurkan") {
    const condong: StatusAmar =
      hasil.status === "digugurkan" || /digugurkan|menggugurkan/i.test(pertimbangan) ? "digugurkan" : "gugur";
    const utama = cari(condong);
    const lain = cari(condong === "gugur" ? "digugurkan" : "gugur");
    const pilih = utama ?? lain;
    if (!pilih) return null;
    const saingan = utama && lain ? [{ nilai: String(lain.nilai), label: lain.label, nilai_skor: 0 }] : [];
    return {
      ...dasar,
      nilai: String(pilih.nilai),
      nilaiLabel: pilih.label,
      keyakinan: saingan.length ? "bentrok" : "cukup",
      kutipan: hasil.kutipan,
      saingan,
      sumberUsulan: "amar",
      tegas: false,
      alasan: saingan.length
        ? `Amar menyatakan gugur. SIPP membedakan "${utama?.label}" dan "${lain?.label}", dan bunyi amarnya sama untuk keduanya - pilih sendiri.`
        : `Amar menyatakan gugur; borang hanya menawarkan "${pilih.label}".`,
    };
  }

  const pilih = cari(hasil.status);
  if (!pilih) return null;
  return {
    ...dasar,
    nilai: String(pilih.nilai),
    nilaiLabel: pilih.label,
    keyakinan: "pasti",
    kutipan: hasil.kutipan,
    saingan: [],
    sumberUsulan: "amar",
    tegas: true,
    alasan: `Dibaca dari kata kerja amar ("${hasil.sebutan}").`,
  };
}

/** Verstek dari amar: "verstek" atau "tanpa hadirnya" berarti Ya. */
function usulanVerstekDariAmar(dasar: UsulanMedan, medan: MedanPilihan, amar: string, penanda: PenandaMedan): UsulanDalam | null {
  const rapat = rapatkanAmar(amar);
  if (!rapat) return null;
  const ya = /\bverstek\b|tanpa\s+hadirnya/.test(rapat);
  const mau = ya ? penanda.ya : penanda.tidak;
  const pilih = (medan.pilihan ?? []).find((x) => mau.test(String(x.label).trim()) && !labelAjakan(x.label));
  if (!pilih) return null;
  return {
    ...dasar,
    nilai: String(pilih.nilai),
    nilaiLabel: pilih.label,
    keyakinan: ya ? "pasti" : "cukup",
    kutipan: ya ? pangkas(pecahKalimat(amar).find((x) => /verstek|tanpa\s+hadirnya/i.test(rapatkanAmar(x))) ?? "") : "",
    sumberUsulan: "amar",
    tegas: ya,
    alasan: ya ? "" : `Amar tidak menyebut verstek, jadi dijawab ${pilih.label}. Periksa sendiri.`,
  };
}

/**
 * Nilai yang SUDAH terpilih di halaman (kontrak K9), bila memang ada.
 *
 * "0" sah pada medan ya/tidak ("Tidak"), jadi yang ditolak bukan nilainya
 * melainkan pilihan yang labelnya ajakan memilih.
 */
function pilihanTerpilih(medan: MedanPilihan): PilihanMedan[] {
  const mentah = Array.isArray(medan.terpilih) ? medan.terpilih : medan.terpilih == null ? [] : [medan.terpilih];
  const hasil: PilihanMedan[] = [];
  for (const nilai of mentah) {
    const teks = String(nilai ?? "").trim();
    if (!teks || teks === "-1") continue;
    const pilihan = (medan.pilihan ?? []).find((x) => String(x.nilai) === teks);
    if (!pilihan || labelAjakan(pilihan.label)) continue;
    if (!hasil.some((x) => String(x.nilai) === String(pilihan.nilai))) hasil.push(pilihan);
  }
  return hasil;
}

/**
 * Medan dari ekstensi, disaring ke bentuk yang dikenal usulkanMedanPutusan -
 * dipakai kedua rute (borang Putusan Akhir dan Data Umum).
 *
 * terpilih (kontrak K9) adalah nilai yang SUDAH terpilih di halaman: satu
 * nilai, atau daftar nilai pada kotak centang. Di sini hanya bentuknya yang
 * dipastikan; nilai yang tidak ada di daftar pilihannya dibuang
 * pilihanTerpilih, sehingga halaman tidak dapat menyelipkan nilai karangan.
 */
export function saringMedanPilihan(
  mentah: unknown,
  batas: { medan?: number; pilihan?: number } = {}
): MedanPilihan[] {
  if (!Array.isArray(mentah)) return [];
  const batasMedan = batas.medan ?? 40;
  const batasPilihan = batas.pilihan ?? 400;
  const teksAtauAngka = (x: unknown): x is string | number => typeof x === "string" || typeof x === "number";
  return mentah.slice(0, batasMedan).map((satu) => {
    const medan = (satu && typeof satu === "object" ? satu : {}) as Record<string, unknown>;
    const pilihan = (Array.isArray(medan.pilihan) ? medan.pilihan : []).slice(0, batasPilihan).map((x) => {
      const p = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
      return { nilai: String(p.nilai ?? ""), label: String(p.label ?? "") };
    });
    const hasil: MedanPilihan = { kunci: String(medan.kunci ?? ""), label: String(medan.label ?? ""), pilihan };
    if (medan.banyak === true) hasil.banyak = true;
    if (teksAtauAngka(medan.terpilih)) hasil.terpilih = String(medan.terpilih);
    else if (Array.isArray(medan.terpilih)) {
      hasil.terpilih = medan.terpilih.filter(teksAtauAngka).slice(0, batasPilihan).map((x) => String(x));
    }
    return hasil;
  });
}

/**
 * ============================================================================
 * YANG SUDAH TERPILIH DI HALAMAN DIDAHULUKAN
 * ============================================================================
 *
 * SIPP mengisi sebagian borang Putusan Akhir sendiri dari Data Umum - alasan
 * dispensasi kawin salah satunya. Nilai itu disimpan petugas pada hari perkara
 * didaftarkan, dari positanya, dan diukur SAMA dengan isian putusan pada 22
 * dari 22 perkara dispensasi. Usulan yang membaca pertimbangan menjawab 0 dari
 * 22: kalimat baku "kemungkinan adanya dampak ekonomi" hadir di tiap
 * pertimbangan dispensasi dan memenangkan "Ekonomi".
 *
 * Karena itu nilai yang sudah terpilih menjadi usulan (sumber "halaman"),
 * KECUALI naskah tegas menyebut nilai lain: kata kerja amar, huruf pasal, atau
 * frasa tegas penanda. Kecocokan kata pada label tidak cukup.
 */
export function hormatiTerpilih(medan: MedanPilihan, usul: UsulanMedan & { tegas?: boolean }): UsulanMedan {
  const terpilih = pilihanTerpilih(medan);
  const { tegas, ...bersih } = usul;
  if (terpilih.length === 0) return bersih;

  if (medan.banyak) {
    const nilaiTerpilih = new Set(terpilih.map((x) => String(x.nilai)));
    const tambahan = (bersih.nilaiBanyak ?? []).filter((x) => !nilaiTerpilih.has(String(x.nilai)));
    const semua = [
      ...terpilih.map((x) => ({
        nilai: String(x.nilai),
        label: x.label,
        kutipan: (bersih.nilaiBanyak ?? []).find((y) => String(y.nilai) === String(x.nilai))?.kutipan ?? "",
      })),
      ...tambahan,
    ];
    return {
      ...bersih,
      nilai: String(semua[0].nilai),
      nilaiLabel: semua.map((x) => x.label).join(", "),
      keyakinan: bersih.keyakinan === "pasti" && tambahan.length ? "pasti" : "cukup",
      nilaiBanyak: semua,
      sumberUsulan: tambahan.length ? "pertimbangan" : "halaman",
      alasan: tambahan.length
        ? `${terpilih.length} sudah tercentang di halaman; ${tambahan.length} lagi disebut naskah (${tambahan.map((x) => x.label).join(", ")}).`
        : `${terpilih.length} sudah tercentang di halaman dan dibiarkan apa adanya.`,
    };
  }

  const halaman = terpilih[0];
  if (bersih.nilai && String(bersih.nilai) === String(halaman.nilai)) {
    return { ...bersih, sumberUsulan: bersih.sumberUsulan ?? "halaman" };
  }
  if (bersih.nilai && tegas) {
    return {
      ...bersih,
      alasan: `${bersih.alasan ? `${bersih.alasan} ` : ""}Halaman sudah berisi "${halaman.label}", tetapi naskah tegas menyebut "${bersih.nilaiLabel}" - periksa mana yang benar.`,
    };
  }
  const saingan = bersih.nilai
    ? [{ nilai: String(bersih.nilai), label: bersih.nilaiLabel, nilai_skor: 0 }, ...bersih.saingan.filter((x) => String(x.nilai) !== String(halaman.nilai))]
    : bersih.saingan.filter((x) => String(x.nilai) !== String(halaman.nilai));
  return {
    ...bersih,
    nilai: String(halaman.nilai),
    nilaiLabel: halaman.label,
    keyakinan: "cukup",
    kutipan: "",
    saingan: saingan.slice(0, 4),
    sumberUsulan: "halaman",
    alasan: bersih.nilai
      ? `Sudah terpilih di halaman: "${halaman.label}". Naskah menyebut "${bersih.nilaiLabel}", tetapi tidak cukup tegas untuk menggantinya.`
      : `Sudah terpilih di halaman: "${halaman.label}".`,
  };
}

/**
 * Mengusulkan satu nilai untuk tiap medan pilihan.
 *
 * @param naskah Bunyi putusan - pertimbangan dan duduk perkara yang menyebut
 *               fakta yang menentukan pilihan ini.
 * @param jenisAtauOpsi Nama jenis perkara (bentuk lama), atau OpsiUsulanMedan:
 *               amar draf, daftar tipe keluaran, dan bawaan satker.
 */
export function usulkanMedanPutusan(
  naskah: string,
  medan: MedanPilihan[],
  jenisAtauOpsi: string | OpsiUsulanMedan = ""
): UsulanMedan[] {
  const opsi = bacaOpsi(jenisAtauOpsi);
  const teks = String(naskah ?? "");
  const jenisPerkara = opsi.jenisPerkara;
  const amar = opsi.amar;
  const sebutanLain = susunSebutanLain(opsi.tipe);
  const bawaan = susunBawaanMedan(opsi);
  const daftarMedan = Array.isArray(medan) ? medan : [];

  const kalimatPenuh = pecahKalimat(teks);
  const teksFakta = opsi.saringRujukan === false ? teks : saringKalimatRujukan(teks);
  const kalimatFakta = pecahKalimat(teksFakta);
  // Medan temuan membaca pertimbangan saja bila pemanggil mengirimnya.
  const kalimatTemuan =
    typeof opsi.pertimbangan === "string"
      ? pecahKalimat(opsi.saringRujukan === false ? opsi.pertimbangan : saringKalimatRujukan(opsi.pertimbangan))
      : kalimatFakta;

  const hasil: UsulanDalam[] = daftarMedan.map((satu): UsulanDalam => {
    const kandidat = (satu.pilihan ?? []).filter((x) => !pilihanKosong(x));
    const dasar: UsulanMedan = {
      kunci: satu.kunci,
      label: satu.label,
      nilai: "",
      nilaiLabel: "",
      keyakinan: "kosong",
      kutipan: "",
      saingan: [],
      alasan: "",
    };

    const adaAmar = Boolean(amar.trim());
    const penanda = PENANDA_MEDAN.find((x) => x.medan.test(satu.label));
    if (!teks.trim() && !adaAmar) return { ...dasar, alasan: "Naskah putusan belum ada isinya." };
    if (kandidat.length === 0 && !penanda) {
      return { ...dasar, alasan: "Borang tidak menawarkan pilihan apa pun." };
    }

    // ────────────────────────────────────────────────────────────────────
    // STATUS PUTUSAN DAN VERSTEK - AMAR LEBIH DULU
    // ────────────────────────────────────────────────────────────────────
    const medanStatus = /status\s*putusan/i.test(satu.label);
    if (medanStatus && adaAmar) {
      const dariAmar = usulanStatusDariAmar(dasar, satu, amar, teks);
      if (dariAmar) return dariAmar;
    }
    if (penanda?.naskahPenuh && adaAmar) {
      const dariAmar = usulanVerstekDariAmar(dasar, satu, amar, penanda);
      if (dariAmar) return dariAmar;
    }
    if (!teks.trim()) {
      return {
        ...dasar,
        alasan: medanStatus
          ? "Kata kerja amar tidak dikenali dan pertimbangan belum ada isinya. Pilih sendiri - ALETA tidak menebak."
          : "Naskah putusan belum ada isinya.",
      };
    }

    // ────────────────────────────────────────────────────────────────────
    // MEDAN YA/TIDAK - DIKENALI DARI NAMA MEDANNYA
    // ────────────────────────────────────────────────────────────────────
    if (penanda) {
      const kalimatDinilai = penanda.naskahPenuh
        ? kalimatPenuh
        : penanda.hanyaPertimbangan
        ? kalimatTemuan
        : kalimatFakta;
      // Dicari per KALIMAT, bukan atas seluruh naskah sekaligus - sebuah
      // fakta dinyatakan dalam satu kalimat, dan petikan yang mengingkari
      // dirinya sendiri harus dapat dikenali beserta kalimatnya.
      let cocok: RegExpExecArray | null = null;
      let kalimatCocok = "";
      for (const kal of kalimatDinilai) {
        if (penanda.bukanKalimat && penanda.bukanKalimat.test(kal)) continue;
        const uji = penanda.frasa.exec(kal);
        if (!uji) continue;
        // Kata pengingkar dicari pada petikannya DAN seluruh kalimat di
        // depannya: "tidak satupun terbukti Termohon melakukan nusyuz" dan
        // "tidak terbukti melakukan kelalaian yang menyebabkan terhalangnya
        // Termohon ... atau karena terbukti nusyuz" mengingkari dirinya jauh
        // sebelum sebutan pihaknya. Pengandaian sesudahnya juga dibuang -
        // "isteri dapat dinyatakan nusyuz apabila ...".
        const akhirPetikan = uji.index + uji[0].length;
        if (penanda.bukan) {
          if (penanda.bukan.test(kal.slice(0, akhirPetikan))) continue;
          if (/\b(?:apabila|jika|bila|manakala|kalau)\b/i.test(kal.slice(akhirPetikan, akhirPetikan + 25))) continue;
        }
        if (penanda.sahkan && !penanda.sahkan(uji)) continue;
        cocok = uji;
        kalimatCocok = kal;
        break;
      }
      // Pernyataan tegas bahwa jawabannya "tidak" (nusyuz) - dicari hanya bila
      // frasa "ya" tidak ada. Yang tegas mengalahkan bawaan, sama seperti
      // frasa "ya".
      let kalimatTidak = "";
      if (!cocok && penanda.frasaTidak) {
        for (const kal of kalimatDinilai) {
          if (penanda.bukanTidak && penanda.bukanTidak.test(kal)) continue;
          if (penanda.frasaTidak.test(kal)) {
            kalimatTidak = kal;
            break;
          }
        }
      }
      const tegas = Boolean(cocok) || Boolean(kalimatTidak);
      // Bawaan yang bergantung jenis perkara dipakai HANYA ketika naskahnya
      // memang tidak menyebut apa-apa. Yang tertulis selalu mengalahkan yang
      // disimpulkan dari jenis perkaranya.
      const menurutBawaan = !tegas ? cariBawaan(bawaan, satu, jenisPerkara) : null;
      const mau = cocok ? (penanda.mauDari ? penanda.mauDari(cocok) : penanda.ya) : penanda.tidak;
      // Dicari pada pilihan YANG BELUM DISARING, dan itu perlu: pada medan
      // ya/tidak, "Tidak" bernilai 0 - dan pilihanKosong memang membuang
      // nilai 0 sebagai bukan-pilihan. Aturan itu benar pada daftar biasa,
      // tempat 0 selalu berarti "- Pilih -", tetapi di sini justru
      // membuangnya jawaban yang sah. Label yang berbunyi ajakan memilih
      // tetap dibuang di sini, sebab itu memang bukan jawaban.
      const pilih = menurutBawaan
        ? menurutBawaan.pilihan
        : (satu.pilihan ?? []).find((x) => mau.test(String(x.label).trim()) && !labelAjakan(x.label));
      if (!pilih) {
        return {
          ...dasar,
          alasan: `Borang tidak menawarkan jawaban yang dicari untuk ${satu.label}.`,
        };
      }
      return {
        ...dasar,
        nilai: String(pilih.nilai),
        nilaiLabel: pilih.label,
        // "pasti" hanya ketika frasanya benar-benar ada. Ketiadaan frasa
        // memang berarti Tidak, tetapi ia kesimpulan dari yang TIDAK tertulis
        // - dan itu tidak pernah sekuat yang tertulis.
        keyakinan: tegas ? "pasti" : "cukup",
        kutipan: cocok ? pangkas(kalimatCocok) : kalimatTidak ? pangkas(kalimatTidak) : "",
        sumberUsulan: menurutBawaan?.dariSatker ? "bawaan-satker" : "pertimbangan",
        tegas,
        alasan: tegas
          ? ""
          : menurutBawaan
          ? menurutBawaan.dariSatker
            ? `Naskah tidak menyebut ${penanda.sebut}. Bawaan satker untuk ${satu.label} pada ${jenisPerkara || "perkara ini"}: ${pilih.label}. Periksa sendiri.`
            : `Naskah tidak menyebut ${penanda.sebut}. Pada ${jenisPerkara} keadaan ini lazimnya ${pilih.label}. Periksa sendiri.`
          : `Naskah tidak menyebut ${penanda.sebut} sama sekali, jadi dijawab ${pilih.label}. Periksa sendiri.`,
      };
    }

    // Sumber Hukum membaca naskah PENUH - undang-undang dan kitab justru
    // disebut di kalimat rujukan. Status putusan tanpa amar juga, supaya
    // cadangannya berperilaku seperti dahulu. Sisanya naskah fakta.
    const naskahPenuh = Boolean(satu.banyak) || medanStatus;
    const teksDinilai = naskahPenuh ? teks : teksFakta;
    const kalimatDinilai = naskahPenuh ? kalimatPenuh : kalimatFakta;

    // Cadangan status tanpa amar: "permohonan pencabutan ... dapat
    // dikabulkan" adalah pencabutan, bukan pengabulan gugatan.
    if (medanStatus) {
      const cabut = kalimatPenuh.find((x) => POLA_CABUT_PERKARA.test(x));
      const pilihanCabut = cabut ? kandidat.find((x) => LABEL_STATUS.dicabut.test(normalkan(x.label))) : undefined;
      if (cabut && pilihanCabut) {
        return {
          ...dasar,
          nilai: String(pilihanCabut.nilai),
          nilaiLabel: pilihanCabut.label,
          keyakinan: "cukup",
          kutipan: pangkas(cabut),
          sumberUsulan: "pertimbangan",
          alasan: "Amar tidak terbaca; pertimbangan menyebut pencabutan. Periksa sendiri.",
        };
      }
    }

    const dinilai = kandidat
      .map((x) => ({ ...x, ...skorPilihan(teksDinilai, kalimatDinilai, x.label, sebutanLain) }))
      .filter((x) => x.skor > 0)
      .sort((a, b) => b.skor - a.skor);

    if (dinilai.length === 0) {
      return {
        ...dasar,
        alasan: "Tidak satu pun pilihan disebut naskah putusan. Pilih sendiri - ALETA tidak menebak.",
      };
    }

    // ────────────────────────────────────────────────────────────────────
    // MEDAN BERNILAI BANYAK - TIDAK ADA JUARA DI SINI
    // ────────────────────────────────────────────────────────────────────
    //
    // Pada kotak centang, dua pilihan yang sama kuat bukan perselisihan
    // melainkan dua-duanya benar. Putusan cerai yang khas menyebut
    // Undang-Undang, Kompilasi Hukum Islam, dan hukum syar'i sekaligus, dan
    // ketiganya memang dicentang.
    //
    // Ambangnya sama dengan ambang bukti penuh pada medan biasa: yang
    // seluruh katanya hadir pada satu kalimat, atau frasanya hadir utuh.
    // Kata yang kebetulan lewat tidak cukup untuk menambah satu sumber hukum
    // ke dalam putusan.
    if (satu.banyak) {
      const AMBANG_BANYAK = 20;
      const terpilih = dinilai.filter((x) => x.skor >= AMBANG_BANYAK);
      if (terpilih.length === 0) {
        return {
          ...dasar,
          alasan: "Tidak satu pun pilihan disebut cukup tegas oleh naskah. Centang sendiri.",
        };
      }
      return {
        ...dasar,
        nilai: String(terpilih[0].nilai),
        nilaiLabel: terpilih.map((x) => x.label).join(", "),
        keyakinan: terpilih.some((x) => x.skor >= 100) ? "pasti" : "cukup",
        kutipan: terpilih[0].kalimat,
        nilaiBanyak: terpilih.map((x) => ({
          nilai: String(x.nilai),
          label: x.label,
          kutipan: x.kalimat,
        })),
        sumberUsulan: "pertimbangan",
        alasan: `${terpilih.length} pilihan disebut naskah. Yang tidak disebut tidak dicentang.`,
      };
    }

    const juara = dinilai[0];
    const kedua = dinilai[1];
    // Selisih tipis berarti naskahnya memang menyebut keduanya. Itu bukan
    // kegagalan mesin melainkan keadaan perkaranya, dan yang memutuskan
    // mana yang pokok adalah hakimnya.
    const selisihTipis = kedua ? juara.skor - kedua.skor <= Math.max(6, juara.skor * 0.15) : false;

    // ────────────────────────────────────────────────────────────────────
    // SKOR BESAR TIDAK MENGHAPUS BUKTI YANG LEBIH KECIL
    // ────────────────────────────────────────────────────────────────────
    //
    // Selisih tipis saja tidak cukup, sebab skornya tidak sebanding antar
    // jenis kecocokan: frasa utuh bernilai seratus lebih, satu kata penuh
    // hanya dua puluhan. Yang kedua tidak akan pernah "tipis" terhadap yang
    // pertama meskipun naskahnya jelas menyebut keduanya.
    //
    // Diukur atas 183 permohonan dispensasi kawin PA Donggala yang alasannya
    // sudah dipilih petugas, itulah bentuk salah yang paling sering: posita
    // menulis "keduanya telah menjalin hubungan cinta kasih ... dan saat ini
    // calon istri telah hamil 3 bulan". Frasa "hubungan cinta" hadir utuh dan
    // menang telak atas satu kata "hamil" - padahal justru kehamilan itu yang
    // dijadikan alasan oleh petugas. Naskahnya tidak salah dan mesinnya tidak
    // salah membaca; yang keliru adalah mengaku yakin.
    //
    // AMBANG_BUKTI_PENUH adalah tambahan yang hanya diperoleh pilihan yang
    // SELURUH kata pentingnya hadir pada satu kalimat. Di bawahnya, hanya
    // sebagian katanya yang kebetulan muncul.
    //
    // Atas 184 permohonan yang sama, aturan ini memindahkan yang meragukan ke
    // tempat yang benar: 107 usulan tetap tercentang sendiri dan 103 di
    // antaranya sama dengan pilihan petugas; 76 sisanya ditandai berselisih,
    // tidak tercentang, dan saingannya diperlihatkan. Sebelum aturan ini, 132
    // tercentang sendiri dengan 29 yang berbeda - dan yang berbeda itu tidak
    // berbunyi sama sekali.
    const AMBANG_BUKTI_PENUH = 20;
    const keduanyaBernama = kedua ? kedua.skor >= AMBANG_BUKTI_PENUH : false;

    const tipis = selisihTipis || keduanyaBernama;

    return {
      kunci: satu.kunci,
      label: satu.label,
      nilai: String(juara.nilai),
      nilaiLabel: juara.label,
      keyakinan: tipis ? "bentrok" : juara.skor >= 100 ? "pasti" : "cukup",
      // Kalimat yang MENGHASILKAN skornya, bukan kalimat lain yang kebetulan
      // memuat kata yang sama. Yang dibaca petugas harus yang dinilai mesin.
      kutipan: juara.kalimat,
      saingan: dinilai.slice(1, 4).map((x) => ({ nilai: String(x.nilai), label: x.label, nilai_skor: x.skor })),
      sumberUsulan: "pertimbangan",
      tegas: false,
      alasan: tipis
        ? `Naskah menyebut lebih dari satu kemungkinan (${juara.label} dan ${kedua?.label}). Periksa sendiri mana yang pokok.`
        : "",
    };
  });

  const faktor = susunFaktorPerceraian(hasil, daftarMedan, {
    teks,
    kalimatFakta,
    teksFakta,
    bawaan,
    jenisPerkara,
  });

  return faktor.map((usul, indeks) => {
    const satu = daftarMedan[indeks];
    const bersih: UsulanMedan = satu ? hormatiTerpilih(satu, usul) : { ...usul };
    delete (bersih as UsulanDalam).tegas;
    // Usulan kosong tidak membawa sumber.
    if (!bersih.nilai) delete bersih.sumberUsulan;
    return bersih;
  });
}

/**
 * Huruf Pasal 19 PP 9/1975 atau Pasal 116 KHI yang DISEBUT naskah.
 *
 * Bentuk yang ditemui pada pertimbangan satker: "Pasal 19 huruf (b) dan (f)",
 * "Pasal 116 huruf b dan f", "Pasal 19 huruf (a), (b), dan (f)", "Pasal 116
 * huruf (a) dan huruf (f)". Huruf dihitung hanya bila berdiri sendiri - "d"
 * pada kata "dan" bukan huruf pasal.
 */
export function hurufPasalDikutip(naskah: string): string[] {
  const huruf = new Set<string>();
  const kecil = String(naskah ?? "").toLowerCase();
  const satuHuruf = String.raw`(?:\(\s*[a-h]\s*\)|(?<![a-z])[a-h](?![a-z.'’-]))`;
  const sambung = String.raw`(?:\s*(?:,|dan|atau|serta|&|jo\.?|juncto|huruf))*\s*`;
  const pola = new RegExp(
    String.raw`pasal\s*(?:116|19)\b\s*(?:huruf|hurup|point|poin|angka|butir)?\s*(` +
      satuHuruf +
      "(?:" +
      sambung +
      satuHuruf +
      ")*)",
    "g"
  );
  for (const cocok of kecil.matchAll(pola)) {
    for (const x of cocok[1].matchAll(/\(\s*([a-h])\s*\)|(?<![a-z])([a-h])(?![a-z])/g)) {
      huruf.add(x[1] || x[2]);
    }
  }
  return [...huruf].sort();
}

type KonteksFaktor = {
  teks: string;
  kalimatFakta: string[];
  teksFakta: string;
  bawaan: BawaanMedan[];
  jenisPerkara: string;
};

/**
 * ============================================================================
 * FAKTOR POKOK: BAWAAN PERSELISIHAN, KECUALI HURUF PASAL LAIN DISEBUT TEGAS
 * ============================================================================
 *
 * Diukur atas 960 putusan cerai dikabulkan 2025-2026 PA Donggala:
 *
 *   membaca kata di pertimbangan (bentuk lama)          310/960  (32,3%)
 *   selalu "Perselisihan dan Pertengkaran"              519/960  (54,1%)
 *   bawaan perselisihan + huruf pasal yang disebut      582/960  (60,6%)
 *
 * Kebiasaan satker: huruf (f) - perselisihan terus-menerus - adalah faktor
 * pokok kecuali pertimbangan menyebut dasar huruf LAIN. Huruf (b) saja
 * menghasilkan "Meninggalkan" benar 38 dari 39; huruf (c) Penjara 7 dari 7;
 * huruf (h) Murtad 3 dari 3. Bila (b) disebut BERSAMA (f), yang menentukan
 * kepergian dua tahun atau lebih: tanpa itu yang pokok tetap perselisihan.
 * Huruf (a) bersama (f) tidak diputuskan dari ciri - diukur, ciri madat/judi/
 * mabuk tidak lebih tepat daripada bawaan perselisihan.
 *
 * Keyakinannya "pasti" hanya bila huruf lain disebut TANPA huruf (f). Bawaan
 * dan campuran huruf "cukup".
 *
 * ============================================================================
 * SEKUNDER DARI CIRI ALASAN, DAN TIDAK PERNAH MENGULANG POKOKNYA
 * ============================================================================
 *
 * Bila pokoknya bukan perselisihan, sekundernya perselisihan (bila naskah
 * menyebutnya). Bila pokoknya perselisihan, sekundernya ciri alasan yang
 * paling sering disebut kalimat fakta yang menyebut para pihak. Atas 252
 * putusan bersekunder: bentuk lama 51, aturan ini 115.
 *
 * Bila naskah tidak menyebut perselisihan dan tidak menyebut huruf pasal,
 * perilaku lama berlaku: kata yang disebut naskah, dan kepergian dua tahun
 * didahulukan.
 */
function susunFaktorPerceraian(hasil: UsulanDalam[], medan: MedanPilihan[], konteks: KonteksFaktor): UsulanDalam[] {
  const iPokok = hasil.findIndex(
    (x) => /faktor.*cerai|faktor.*perceraian/i.test(x.label) && !/sekunder/i.test(x.label)
  );
  const iSekunder = hasil.findIndex(
    (x) => /faktor.*cerai|faktor.*perceraian/i.test(x.label) && /sekunder/i.test(x.label)
  );
  if (iPokok < 0 && iSekunder < 0) return hasil;

  const { teks, kalimatFakta, teksFakta } = konteks;
  const huruf = hurufPasalDikutip(teks);
  const hurufLain = huruf.filter((x) => x !== "f");
  const adaF = huruf.includes("f");
  const adaPerselisihan = adaF || POLA_ADA_PERSELISIHAN.test(teksFakta);
  const kalimatPihak = kalimatFakta.filter((x) => POLA_KALIMAT_PIHAK.test(x));

  /** Hitungan ciri pada kalimat fakta, dipetakan ke pilihan halaman. */
  const hitungCiri = (pilihan: PilihanMedan[]) => {
    const hitung: Array<{ pilihan: PilihanMedan; n: number; kalimat: string; urutan: number }> = [];
    CIRI_FAKTOR.forEach((ciri, urutan) => {
      const pil = pilihanBerlabel(pilihan, ciri.label);
      if (!pil || pilihanKosong(pil)) return;
      const kena = kalimatPihak.filter((k) => ciri.kata.test(k));
      if (kena.length === 0) return;
      const ada = hitung.find((x) => String(x.pilihan.nilai) === String(pil.nilai));
      if (ada) ada.n += kena.length;
      else hitung.push({ pilihan: pil, n: kena.length, kalimat: pangkas(kena[0]), urutan });
    });
    return hitung.sort((a, b) => b.n - a.n || a.urutan - b.urutan);
  };

  // ── Pokok ────────────────────────────────────────────────────────────────
  if (iPokok >= 0) {
    const pokokLama = hasil[iPokok];
    const pilihanPokok = medan[iPokok]?.pilihan ?? [];
    const perselisihan = pilihanBerlabel(pilihanPokok, POLA_FAKTOR_PERSELISIHAN);
    const ciri = hitungCiri(pilihanPokok);
    // Perbuatan tertentu yang disebut kalimat fakta dua kali atau lebih -
    // kekerasan, madat, mabuk, judi, zina, penjara, murtad, cacat, poligami,
    // kawin paksa. Dipakai langkah 1 dan 3 untuk KEYAKINAN, tidak untuk nilai.
    const ciriKuat = ciri.filter(
      (x) => x.n >= 2 && !/meninggalkan|pergi|ditinggal|ekonomi|selisih|pertengkaran/i.test(x.pilihan.label)
    );
    const sainganDari = (kecuali: string) =>
      [
        ...ciri.map((x) => ({ nilai: String(x.pilihan.nilai), label: x.pilihan.label, nilai_skor: x.n })),
        ...(perselisihan && adaPerselisihan ? [{ nilai: String(perselisihan.nilai), label: perselisihan.label, nilai_skor: 0 }] : []),
        ...pokokLama.saingan,
        ...(pokokLama.nilai ? [{ nilai: pokokLama.nilai, label: pokokLama.nilaiLabel, nilai_skor: 0 }] : []),
      ]
        .filter((x, i, semua) => x.nilai && x.nilai !== kecuali && semua.findIndex((y) => y.nilai === x.nilai) === i)
        .slice(0, 4);

    let putusanPokok: UsulanDalam | null = null;

    // 1. Huruf pasal selain (f).
    for (const aturan of HURUF_FAKTOR) {
      if (!hurufLain.includes(aturan.huruf)) continue;
      let pil: PilihanMedan | undefined;
      let alasanHuruf = `Pertimbangan menyebut dasar Pasal 19 huruf (${aturan.huruf}) PP 9/1975 jo. Pasal 116 huruf (${aturan.huruf}) KHI`;
      if (aturan.huruf === "b" && adaF && !POLA_PERGI_DUA_TAHUN_LEBIH.test(teks)) {
        // (b) bersama (f) tanpa kepergian dua tahun: pokoknya tetap perselisihan.
        continue;
      }
      if (aturan.ciriA) {
        if (adaF) continue;
        const kandidatA = ciri.filter((x) => /madat|narkoba|narkotika|mabuk|judi|zina/i.test(x.pilihan.label));
        pil = kandidatA[0]?.pilihan;
        alasanHuruf += ` - zina, mabuk, madat, atau judi; yang paling sering disebut: ${pil?.label ?? "-"}`;
      } else if (aturan.label) {
        pil = pilihanBerlabel(pilihanPokok, aturan.label);
      }
      if (!pil || pilihanKosong(pil)) continue;
      const tegas = !adaF;
      // Huruf yang disebut BERSAMA (f) tidak tegas. Bila kalimat fakta pun
      // berulang kali menyebut perbuatan LAIN, yang memilih petugas - tidak
      // dicentang sendiri. Diukur atas 960 putusan cerai (hampir semuanya
      // huruf (b)+(f) dengan kepergian dua tahun): aturan ini mencabut
      // centang dari 26 usulan salah dan 8 usulan benar (pembetul-banding).
      const kuatLain = tegas ? [] : ciriKuat.filter((x) => String(x.pilihan.nilai) !== String(pil?.nilai));
      putusanPokok = {
        ...pokokLama,
        nilai: String(pil.nilai),
        nilaiLabel: pil.label,
        keyakinan: tegas ? "pasti" : kuatLain.length ? "bentrok" : "cukup",
        kutipan: kalimatBerpola(pecahKalimat(teks), /pasal\s*(?:116|19)\b/i) || pokokLama.kutipan,
        saingan: sainganDari(String(pil.nilai)),
        sumberUsulan: "pertimbangan",
        tegas,
        alasan:
          `${alasanHuruf}${adaF ? " bersama huruf (f)" : ""}. ` +
          (aturan.huruf === "b" && adaF ? "Kepergian dua tahun atau lebih disebut, jadi huruf (b) didahulukan. " : "") +
          (kuatLain.length
            ? `Tetapi kalimat fakta berulang kali menyebut ${kuatLain
                .map((x) => `${x.pilihan.label} (${x.n} kalimat)`)
                .join(", ")} - pilih sendiri mana yang pokok.`
            : tegas
            ? ""
            : "Periksa sendiri mana yang pokok."),
      };
      break;
    }

    // 2. Bawaan satker untuk medan faktor, bila ada.
    if (!putusanPokok) {
      const satker = cariBawaan(konteks.bawaan, medan[iPokok], konteks.jenisPerkara);
      if (satker && satker.dariSatker && adaPerselisihan) {
        putusanPokok = {
          ...pokokLama,
          nilai: String(satker.pilihan.nilai),
          nilaiLabel: satker.pilihan.label,
          keyakinan: "cukup",
          kutipan: kalimatBerpola(kalimatFakta, POLA_ADA_PERSELISIHAN),
          saingan: sainganDari(String(satker.pilihan.nilai)),
          sumberUsulan: "bawaan-satker",
          tegas: false,
          alasan: `Bawaan satker untuk ${medan[iPokok].label}: ${satker.pilihan.label}. Periksa sendiri.`,
        };
      }
    }

    // 3. Bawaan perselisihan.
    //
    // Bawaannya tetap perselisihan, tetapi TIDAK dicentang sendiri bila
    // kalimat fakta berulang kali (dua kalimat atau lebih) menyebut perbuatan
    // tertentu - kekerasan, madat, mabuk, judi, zina, penjara, murtad, cacat,
    // poligami, kawin paksa. Diukur atas 690 putusan berhuruf (f) saja: pada
    // 124 perkara yang menyebut kekerasan di dua kalimat fakta atau lebih,
    // pokoknya "Kekerasan" 58 kali dan "Perselisihan" 46 kali. Bawaan tidak
    // lagi dapat dipercaya di situ, dan yang memutuskan petugas. (Menjadikan
    // cirinya NILAI usulan juga diukur dan lebih buruk: pokok benar 522/960,
    // bukan 582 - karena itu nilainya tetap bawaan, hanya keyakinannya bentrok.)
    //
    // Begitu pula bila pertimbangan menyebut huruf LAIN bersama (f) tetapi
    // huruf itu tidak menentukan - (a) tanpa pilihan dari ciri, (b) tanpa
    // kepergian dua tahun. Dasarnya lebih dari satu; di 12 perkara yang dulu
    // tercentang sendiri, bawaan perselisihan benar hanya 4 kali
    // (pembetul-banding).
    if (!putusanPokok && perselisihan && adaPerselisihan) {
      putusanPokok = {
        ...pokokLama,
        nilai: String(perselisihan.nilai),
        nilaiLabel: perselisihan.label,
        keyakinan: ciriKuat.length || hurufLain.length ? "bentrok" : "cukup",
        kutipan:
          kalimatBerpola(kalimatFakta, POLA_ADA_PERSELISIHAN) ||
          kalimatBerpola(pecahKalimat(teks), /pasal\s*(?:116|19)\b[^.;]*\(?\s*f\s*\)?/i),
        saingan: sainganDari(String(perselisihan.nilai)),
        sumberUsulan: "pertimbangan",
        tegas: false,
        alasan:
          `Bawaan: faktor pokok ${perselisihan.label}, sebab pertimbangan ` +
          (hurufLain.length
            ? `menyebut huruf (${huruf.join("), (")}) tanpa bukti yang menentukan huruf selain (f).`
            : "tidak menyebut dasar huruf lain.") +
          (ciriKuat.length
            ? ` Tetapi kalimat fakta berulang kali menyebut ${ciriKuat
                .map((x) => `${x.pilihan.label} (${x.n} kalimat)`)
                .join(", ")} - pilih sendiri mana yang pokok.`
            : hurufLain.length
            ? " Dasarnya lebih dari satu huruf - pilih sendiri mana yang pokok."
            : " Periksa sendiri."),
      };
    }

    // 4. Naskah tidak menyebut perselisihan maupun huruf pasal: perilaku
    //    lama - kata yang disebut naskah, kepergian dua tahun didahulukan.
    if (!putusanPokok) {
      putusanPokok = pokokLama;
      if (POLA_DITINGGAL_DUA_TAHUN.test(teks)) {
        const meninggalkan = pilihanBerlabel(pilihanPokok, POLA_FAKTOR_MENINGGALKAN);
        if (meninggalkan && !pilihanKosong(meninggalkan) && String(meninggalkan.nilai) !== pokokLama.nilai) {
          const semula = { nilai: pokokLama.nilai, label: pokokLama.nilaiLabel };
          putusanPokok = {
            ...pokokLama,
            nilai: String(meninggalkan.nilai),
            nilaiLabel: meninggalkan.label,
            keyakinan: "pasti",
            kutipan:
              kalimatBerfrasa(pecahKalimat(teks), normalkan(String(POLA_DITINGGAL_DUA_TAHUN.exec(teks)?.[0] ?? ""))) ||
              pokokLama.kutipan,
            saingan: semula.nilai
              ? [{ nilai: semula.nilai, label: semula.label, nilai_skor: 0 }, ...pokokLama.saingan]
              : pokokLama.saingan,
            sumberUsulan: "pertimbangan",
            tegas: false,
            alasan:
              "Naskah menyebut kepergian dua tahun atau lebih - unsur Pasal 19 huruf (b) PP 9/1975 jo. Pasal 116 huruf (b) KHI. Faktor itu didahulukan; " +
              (semula.label ? `${semula.label} turun menjadi sekunder.` : "yang lain menjadi sekunder."),
          };
        }
      }
    }
    hasil[iPokok] = putusanPokok;
  }

  // ── Sekunder ─────────────────────────────────────────────────────────────
  if (iSekunder >= 0) {
    const sekunderLama = hasil[iSekunder];
    const pilihanSekunder = medan[iSekunder]?.pilihan ?? [];
    const pokok = iPokok >= 0 ? hasil[iPokok] : null;
    // Pokok yang sudah terpilih di halaman ikut dihormati: sekunder tidak
    // boleh mengulang apa pun yang akan tersimpan sebagai pokok.
    const pokokHalaman = iPokok >= 0 ? pilihanTerpilih(medan[iPokok])[0] : undefined;
    const nilaiPokok = pokokHalaman && !pokok?.tegas ? String(pokokHalaman.nilai) : pokok?.nilai ?? "";
    const labelPokok = pokokHalaman && !pokok?.tegas ? pokokHalaman.label : pokok?.nilaiLabel ?? "";
    const perselisihan = pilihanBerlabel(pilihanSekunder, POLA_FAKTOR_PERSELISIHAN);
    const ciri = hitungCiri(pilihanSekunder).filter((x) => String(x.pilihan.nilai) !== nilaiPokok);
    const pokokPerselisihan = Boolean(nilaiPokok) && POLA_FAKTOR_PERSELISIHAN.test(labelPokok);

    // Keputusan pengguna 26 September 2026 ("pakai praktik sekarang"): bila
    // kalimat fakta menyebut masalah ekonomi dan pokoknya Perselisihan,
    // sekundernya Ekonomi - praktik satker sejak 556/Pdt.G/2025 (sampai
    // 477/Pdt.G/2025 Ekonomi dijadikan pokok). Tanpa aturan ini Ekonomi kalah
    // hitungan oleh "pisah rumah" (Meninggalkan), yang disebut hampir di tiap
    // putusan cerai: hanya 7 dari 31 putusan bermasalah ekonomi bersekunder
    // Ekonomi.
    const ekonomi = pokokPerselisihan ? pilihanBerlabel(pilihanSekunder, /ekonomi/i) : undefined;
    const kalimatEkonomi =
      ekonomi && !pilihanKosong(ekonomi) && String(ekonomi.nilai) !== nilaiPokok
        ? kalimatBerpola(kalimatFakta, POLA_MASALAH_EKONOMI)
        : "";

    let pilih: { pilihan: PilihanMedan; kalimat: string; alasan: string } | null = null;
    if (nilaiPokok && !pokokPerselisihan && perselisihan && adaPerselisihan && String(perselisihan.nilai) !== nilaiPokok) {
      pilih = {
        pilihan: perselisihan,
        kalimat: kalimatBerpola(kalimatFakta, POLA_ADA_PERSELISIHAN),
        alasan: `Pokoknya ${labelPokok}; perselisihan yang disebut naskah menjadi sekunder. Periksa sendiri.`,
      };
    } else if (ekonomi && kalimatEkonomi) {
      pilih = {
        pilihan: ekonomi,
        kalimat: kalimatEkonomi,
        alasan: `Pertimbangan menyebut masalah ekonomi; pokoknya ${labelPokok}, jadi Ekonomi menjadi sekunder menurut praktik satker (keputusan 26 September 2026). Periksa sendiri.`,
      };
    } else if (ciri.length > 0) {
      pilih = {
        pilihan: ciri[0].pilihan,
        kalimat: ciri[0].kalimat,
        alasan:
          `Ciri alasan yang paling sering disebut kalimat fakta (${ciri[0].n} kalimat)` +
          (nilaiPokok ? `, selain pokoknya ${labelPokok}` : "") +
          ". Periksa sendiri.",
      };
    }

    // Sekunder disusun dari pokok USULAN dan tidak boleh mengulangnya. Selama
    // pokok itu belum tentu (bentrok) dan halaman belum memilih pokok,
    // sekundernya pun belum tentu: pokok yang dipilih petugas dapat membalik
    // sekundernya. Diukur atas 252 putusan bersekunder: yang tercentang
    // sendiri benar 115 dan salah 123 menjadi benar 69 dan salah 59; pada
    // 708 putusan yang sekundernya dibiarkan kosong petugas, yang tercentang
    // sendiri turun dari 679 menjadi 381 (pembetul-banding).
    const pokokBelumTentu = !pokokHalaman && pokok?.keyakinan === "bentrok";
    if (pilih) {
      hasil[iSekunder] = {
        ...sekunderLama,
        nilai: String(pilih.pilihan.nilai),
        nilaiLabel: pilih.pilihan.label,
        keyakinan: pokokBelumTentu ? "bentrok" : "cukup",
        kutipan: pilih.kalimat,
        saingan: ciri
          .filter((x) => String(x.pilihan.nilai) !== String(pilih?.pilihan.nilai))
          .slice(0, 3)
          .map((x) => ({ nilai: String(x.pilihan.nilai), label: x.pilihan.label, nilai_skor: x.n })),
        sumberUsulan: "pertimbangan",
        tegas: false,
        alasan: pokokBelumTentu
          ? `${pilih.alasan} Pokoknya sendiri belum tentu - tentukan pokok dulu, lalu pilih sekundernya.`
          : pilih.alasan,
      };
    } else {
      hasil[iSekunder] = {
        ...sekunderLama,
        nilai: "",
        nilaiLabel: "",
        keyakinan: "kosong",
        kutipan: "",
        saingan: [],
        tegas: false,
        alasan: nilaiPokok
          ? `Naskah tidak menyebut faktor lain selain ${labelPokok}, dan faktor itu sudah menjadi pokok. Sekundernya dikosongkan.`
          : "Tidak ada ciri alasan yang disebut kalimat fakta. Sekundernya dikosongkan - pilih sendiri bila ada.",
      };
    }
  }

  return hasil;
}
