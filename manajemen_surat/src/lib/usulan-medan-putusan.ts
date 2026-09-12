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
 * ============================================================================
 * SEBERAPA BAIK INI SEBENARNYA - DIUKUR, BUKAN DIKIRA
 * ============================================================================
 *
 * Diukur atas berkas PA Donggala yang pilihannya SUDAH ditetapkan petugas,
 * lalu usulan mesin dibandingkan dengan pilihan itu. Yang dihitung bukan
 * "berapa persen benar" melainkan BERAPA YANG TERCENTANG SENDIRI LALU
 * KELIRU - sebab hanya itu yang dapat tersimpan tanpa dibaca:
 *
 *   Alasan dispensasi kawin (184 permohonan)
 *     107 tercentang sendiri, 103 sama dengan pilihan petugas, 4 berbeda.
 *     76 ditandai berselisih dan tidak tercentang.
 *
 *   Faktor penyebab perceraian (400 putusan, pertimbangan + posita)
 *     22 tercentang sendiri, 9 sama, 13 berbeda.
 *     378 ditandai berselisih.
 *
 * Perbedaannya bukan kebetulan dan patut diketahui siapa pun yang membaca ini:
 * posita dispensasi menyebut SATU fakta yang menentukan - hamil, atau tidak.
 * Gugatan perceraian menyebut banyak - ekonomi, pertengkaran, ditinggalkan,
 * kekerasan - sebab seluruhnya memang terjadi, dan yang dicatat petugas adalah
 * yang dipandang pokok. Itu penilaian hakim dan panitera, bukan pembacaan
 * teks.
 *
 * Karena itu faktor perceraian hampir selalu berakhir "berselisih", dan itu
 * BUKAN kegagalan: yang diperlihatkan kepada petugas adalah kalimat-kalimat
 * yang mendasari tiap kemungkinan, bukan satu jawaban yang mengaku pasti.
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
};

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
 */
const SEBUTAN_LAIN: Record<string, string[]> = {
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
 */
const PENANDA_MEDAN: Array<{ medan: RegExp; frasa: RegExp; ya: RegExp; tidak: RegExp }> = [
  {
    medan: /verstek/i,
    frasa: /\bverstek\b/i,
    ya: /^(ya|iya|verstek|1)$/i,
    tidak: /^(tidak|bukan|0)$/i,
  },
];

function normalkan(teks: string): string {
  return String(teks ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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
  label: string
): { skor: number; kata: string[]; kalimat: string } {
  const rendahPenuh = normalkan(naskah);
  let terbaik = { skor: 0, kata: [] as string[], kalimat: "" };

  // Sebutan lain dinilai lebih dahulu dan sebagai FRASA UTUH - "undang undang
  // nomor" yang hadir apa adanya adalah bukti selengkap label yang hadir apa
  // adanya. Yang tidak punya sebutan lain sama sekali tidak terpengaruh.
  for (const sebutan of SEBUTAN_LAIN[normalkan(label)] ?? []) {
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

/** Pilihan yang bukan pilihan: "- Pilih -", "0", dan sejenisnya. */
function pilihanKosong(satu: PilihanMedan): boolean {
  const label = normalkan(satu.label);
  const nilai = String(satu.nilai ?? "").trim();
  if (!label) return true;
  if (nilai === "" || nilai === "0" || nilai === "-1") return true;
  return /^(pilih|silakan pilih|none|kosong)$/.test(label.replace(/^[-\s]+|[-\s]+$/g, ""));
}

/**
 * Mengusulkan satu nilai untuk tiap medan pilihan.
 *
 * @param naskah Bunyi putusan - pertimbangan dan duduk perkara yang menyebut
 *               fakta yang menentukan pilihan ini.
 */
export function usulkanMedanPutusan(naskah: string, medan: MedanPilihan[]): UsulanMedan[] {
  const teks = String(naskah ?? "");
  return (Array.isArray(medan) ? medan : []).map((satu) => {
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

    if (!teks.trim()) return { ...dasar, alasan: "Naskah putusan belum ada isinya." };
    if (kandidat.length === 0) return { ...dasar, alasan: "Borang tidak menawarkan pilihan apa pun." };

    const kalimat = pecahKalimat(teks);

    // ────────────────────────────────────────────────────────────────────
    // MEDAN YA/TIDAK - DIKENALI DARI NAMA MEDANNYA
    // ────────────────────────────────────────────────────────────────────
    const penanda = PENANDA_MEDAN.find((x) => x.medan.test(satu.label));
    if (penanda) {
      const cocok = penanda.frasa.exec(teks);
      const mau = cocok ? penanda.ya : penanda.tidak;
      // Dicari pada pilihan YANG BELUM DISARING, dan itu perlu: pada medan
      // ya/tidak, "Tidak" bernilai 0 - dan pilihanKosong memang membuang
      // nilai 0 sebagai bukan-pilihan. Aturan itu benar pada daftar biasa,
      // tempat 0 selalu berarti "- Pilih -", tetapi di sini justru
      // membuangnya jawaban yang sah. Label yang berbunyi ajakan memilih
      // tetap dibuang di sini, sebab itu memang bukan jawaban.
      const pilih = (satu.pilihan ?? []).find(
        (x) => mau.test(String(x.label).trim()) && !/^(pilih|silakan pilih)/i.test(String(x.label).trim())
      );
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
        keyakinan: cocok ? "pasti" : "cukup",
        kutipan: cocok ? kalimatBerfrasa(kalimat, normalkan(cocok[0])) : "",
        alasan: cocok
          ? ""
          : `Naskah tidak menyebut "${String(penanda.frasa.source).replace(/\\b/g, "")}" sama sekali, jadi dijawab ${pilih.label}. Periksa sendiri.`,
      };
    }
    const dinilai = kandidat
      .map((x) => ({ ...x, ...skorPilihan(teks, kalimat, x.label) }))
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
      alasan: tipis
        ? `Naskah menyebut lebih dari satu kemungkinan (${juara.label} dan ${kedua?.label}). Periksa sendiri mana yang pokok.`
        : "",
    };
  });
}
