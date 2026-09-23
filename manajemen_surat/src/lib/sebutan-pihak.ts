/**
 * ============================================================================
 * SATU SUMBER KEBENARAN UNTUK SEBUTAN PARA PIHAK
 * ============================================================================
 *
 * "Penggugat dan Tergugat" atau "Pemohon dan Termohon" - pertanyaan yang
 * terdengar sepele, dan yang sampai 23 September 2026 dijawab sebelas kali
 * dengan tujuh aturan yang berbeda di dalam satu aplikasi.
 *
 * Akibatnya TERUKUR di sipp_donggala (10.120 perkara):
 *
 *   5.581 perkara (55,1%) bersebutan Pemohon/Termohon menurut kueri ABT
 *   sendiri, dan dari jumlah itu -
 *
 *     kelengkapanDataService.js        salah pada 5.254  (94,1%)
 *     penyusunPertimbanganService.js   salah pada 4.415  (79,1%)
 *     isian-putusan-sipp.ts            salah pada 3.999  (71,7%)
 *     jlf-variable-resolver-service.ts salah pada 1.178  (21,1%)
 *     caseDirectoryService.js          salah pada 5.581  (100%)
 *
 * Keluaran kelengkapanDataService dikirim ke nomor WhatsApp pihak berperkara;
 * keluaran isian-putusan-sipp masuk ke amar anonim yang terbit di Direktori
 * Putusan. Salah sebutan di sana bukan salah kata - ia mengubah jenis
 * perkaranya di mata siapa pun yang membacanya kelak.
 *
 * ============================================================================
 * SEBABNYA SATU KATA, DAN TIDAK PERNAH TERTANGKAP UJI
 * ============================================================================
 *
 *   SIPP menulis "Istbat Nikah"  - seluruh pola ALETA menulis "itsbat"/"isbat"
 *   SIPP menulis "Wali Adhol"    - seluruh pola ALETA menulis "wali adhal"
 *
 * 3.972 perkara luput karena huruf yang tertukar. Ujinya hijau selama ini
 * sebab ujinya memakai ejaan karangan ("Itsbat Nikah") yang tidak pernah ada
 * satu baris pun di basis data.
 *
 * ============================================================================
 * NOMOR, BUKAN KATA
 * ============================================================================
 *
 * Aturannya DISALIN dari kueri ABT untuk variabel #0046# dan #0047# -
 * keduanya memakai nomor, bukan nama:
 *
 *   0046 "Pemohon/ Penggugat"
 *     CASE WHEN alur_perkara_id = 16
 *            OR jenis_perkara_id = 346
 *            OR jenis_perkara_id = 341  THEN "Pemohon"
 *          WHEN alur_perkara_id IN (122, 123) THEN "Penuntut Umum"
 *          ELSE "Penggugat"
 *
 *   0047 "Termohon/ Tergugat"  -> "Termohon" / "Terdakwa" / "Tergugat"
 *
 *   346 = Cerai Talak      341 = Izin Poligami
 *   16  = alur permohonan  15 = alur gugatan   122/123 = jinayat
 *
 * Cerai talak dan izin poligami berbentuk /Pdt.G/ tetapi bersebutan
 * Pemohon/Termohon - itulah sebab menebak dari nomor perkara selalu salah
 * pada 1.178 perkara satker ini, dan sebab pencocokan kata hanya boleh jadi
 * cadangan TERAKHIR.
 */

/** Satu pasang sebutan: pihak pertama dan pihak kedua. */
export type SebutanPihak = {
  /** Pihak pertama: Penggugat / Pemohon / Penuntut Umum. */
  satu: string;
  /** Pihak kedua: Tergugat / Termohon / Terdakwa. */
  dua: string;
  /** "gugatan" atau "permohonan" - kata yang dipakai kalimat duduk perkara. */
  surat: string;
  /** Dari mana jawabannya datang. Dibaca penjaga dan panel diagnosis. */
  sumber: "alur" | "jenis" | "kata" | "nomor" | "bawaan";
};

/** Masukan yang dikenali. Seluruhnya boleh kosong; yang ada dipakai. */
export type BahanSebutan = {
  alurPerkaraId?: number | string | null;
  jenisPerkaraId?: number | string | null;
  jenisPerkaraNama?: string | null;
  nomorPerkara?: string | null;
};

/** alur_perkara_id yang berarti permohonan. */
export const ALUR_PERMOHONAN = 16;

/** alur_perkara_id jinayat - Penuntut Umum lawan Terdakwa. */
export const ALUR_JINAYAT = [122, 123] as const;

/**
 * jenis_perkara_id yang bersebutan Pemohon/Termohon MESKI alurnya gugatan.
 *
 *   346 Cerai Talak    - 1.166 perkara di satker ini
 *   341 Izin Poligami  -    12 perkara
 *
 * Keduanya bernomor /Pdt.G/, dan itulah jebakannya.
 */
export const JENIS_PERMOHONAN_DALAM_GUGATAN = [346, 341] as const;

/**
 * Kata yang menandai perkara permohonan - CADANGAN TERAKHIR.
 *
 * Ejaannya mengikuti yang SUNGGUH tertulis di perkara.jenis_perkara_nama,
 * bukan ejaan yang benar menurut kamus. Ketiga bentuk istbat/itsbat/isbat
 * disebut sekaligus sebab satker lain boleh saja menulis yang lain, dan satu
 * huruf yang meleset di sini membuang ribuan perkara tanpa satu pun galat.
 *
 * Daftar nama yang sungguh ada di sipp_donggala, beserta jumlahnya:
 *   Pengesahan Perkawinan/Istbat Nikah 3.885   Cerai Talak 1.166
 *   Dispensasi Kawin 198   P3HP/Penetapan Ahli Waris 102   Perwalian 91
 *   Istbat Nikah 87   Wali Adhol 13   Asal Usul Anak 13   Izin Poligami 12
 *   Lain-Lain 11   Pencegahan Perkawinan 2   Penolakan Perkawinan 1
 */
export const POLA_PERMOHONAN =
  /permohonan|cerai\s*talak|istbat|itsbat|isbat|pengesahan\s*perkawinan|dispensasi|wali\s*adh[oa]l|poligami|asal.?usul|perwalian|pengangkatan|penetapan\s*ahli\s*waris|p3hp|pencegahan\s*perkawinan|penolakan\s*perkawinan/i;

function angka(nilai: number | string | null | undefined): number | null {
  if (nilai === null || nilai === undefined || nilai === "") return null;
  const n = Number(nilai);
  return Number.isFinite(n) ? n : null;
}

function bersih(teks: string | null | undefined): string {
  return String(teks ?? "").replace(/\s+/g, " ").trim();
}

/**
 * Sebutan para pihak untuk satu perkara.
 *
 * Berjenjang, dari yang paling pasti ke yang paling kasar. Tiap jenjang
 * MENGHENTIKAN pencarian - nomor yang sudah menjawab tidak boleh ditimpa
 * tebakan dari kata.
 */
export function sebutanPihakPerkara(bahan: BahanSebutan = {}): SebutanPihak {
  const alur = angka(bahan.alurPerkaraId);
  const jenisId = angka(bahan.jenisPerkaraId);

  // 1. Jinayat - dua sebutan yang sama sekali berbeda, dan tidak pernah
  //    tertukar dengan perdata. Nol perkara di satker ini, tetapi aturannya
  //    ada di ABT dan menghilangkannya berarti PA yang menangani jinayat
  //    mendapat "Penggugat" pada surat dakwaan.
  if (alur !== null && (ALUR_JINAYAT as readonly number[]).includes(alur)) {
    return { satu: "Penuntut Umum", dua: "Terdakwa", surat: "dakwaan", sumber: "alur" };
  }

  // 2. Alur permohonan.
  if (alur === ALUR_PERMOHONAN) return permohonan("alur");

  // 3. Jenis perkara yang bersebutan permohonan meski alurnya gugatan.
  if (jenisId !== null && (JENIS_PERMOHONAN_DALAM_GUGATAN as readonly number[]).includes(jenisId)) {
    return permohonan("jenis");
  }

  // 4. Alur gugatan yang disebut dengan tegas - berhenti di sini, jangan
  //    turun ke pencocokan kata. "Cerai Gugat" memuat kata "gugat", tetapi
  //    "Pengesahan Perkawinan" tidak memuat kata apa pun yang menandai
  //    gugatan, dan menebaknya dari kata justru membalikkan jawabannya.
  if (alur !== null && alur !== ALUR_PERMOHONAN) {
    return { satu: "Penggugat", dua: "Tergugat", surat: "gugatan", sumber: "alur" };
  }

  // 5. Nama jenis perkara - cadangan, dengan ejaan SIPP yang sesungguhnya.
  const nama = bersih(bahan.jenisPerkaraNama);
  if (nama) {
    return POLA_PERMOHONAN.test(nama)
      ? permohonan("kata")
      : { satu: "Penggugat", dua: "Tergugat", surat: "gugatan", sumber: "kata" };
  }

  // 6. Nomor perkara - cadangan TERAKHIR, dan yang paling sering salah.
  //    Seluruh /Pdt.P/ memang permohonan, tetapi tidak seluruh permohonan
  //    berbentuk /Pdt.P/: cerai talak dan izin poligami berbentuk /Pdt.G/.
  const nomor = bersih(bahan.nomorPerkara);
  if (/\/Pdt\.P\//i.test(nomor)) return permohonan("nomor");
  if (/\/Pdt\.G\//i.test(nomor)) {
    return { satu: "Penggugat", dua: "Tergugat", surat: "gugatan", sumber: "nomor" };
  }

  // 7. Tidak ada satu pun keterangan. Gugatan dipilih sebab ia bentuk yang
  //    paling banyak dipakai pada perkara yang tidak berketerangan, dan
  //    sebab seluruh kalimat baku sudah bercadangan sama.
  return { satu: "Penggugat", dua: "Tergugat", surat: "gugatan", sumber: "bawaan" };
}

function permohonan(sumber: SebutanPihak["sumber"]): SebutanPihak {
  return { satu: "Pemohon", dua: "Termohon", surat: "permohonan", sumber };
}

/**
 * Sebutan satu pihak menurut kedudukannya.
 *
 * pihakKe pada SIPP: 1 = penggugat/pemohon, 2 = tergugat/termohon. Kuasa
 * hukum memakai sebutan yang diwakilinya, didahului "Kuasa".
 */
export function sebutanSatuPihak(
  pihakKe: number | string | null | undefined,
  bahan: BahanSebutan = {},
  jenisPeran?: string | null
): string {
  const pasangan = sebutanPihakPerkara(bahan);
  const ke = String(pihakKe ?? "").toLowerCase();
  const kedua = ke === "2" || ke === "t";
  const pokok = kedua ? pasangan.dua : pasangan.satu;
  return bersih(jenisPeran).toLowerCase() === "kuasa" ? `Kuasa ${pokok}` : pokok;
}

/** Apakah perkara ini permohonan? Dipakai kalimat yang hanya butuh satu bit. */
export function perkaraPermohonan(bahan: BahanSebutan = {}): boolean {
  return sebutanPihakPerkara(bahan).satu === "Pemohon";
}
