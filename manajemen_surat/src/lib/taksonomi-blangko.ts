/**
 * Taksonomi blangko: membaca dimensi keadaan dari nama berkas.
 *
 * ============================================================================
 * 812 BERKAS ITU BUKAN 812 DOKUMEN
 * ============================================================================
 *
 * Pustaka ABT adalah satu kerangka dokumen dikali matriks keadaan, dituliskan
 * sebagai berkas terpisah untuk tiap kombinasi. Nama berkasnya bukan judul -
 * ia kunci kombinasinya:
 *
 *   04-a. BAS Pertama P Hadir _ T Tidak Hadir - Tunda Panggil T.PA.Mj.rtf
 *         tahapan   kehadiran P  kehadiran T      akibat        susunan
 *
 * Dua berkas bersaudara di folder yang sama ternyata 67% alineanya identik
 * persis; yang berbeda hanya blok yang dipilih oleh keadaan. Karena itu yang
 * dipelajari ALETA bukan berkasnya, melainkan DIMENSINYA - sehingga kombinasi
 * yang ABT tidak punya berkasnya pun kelak menghasilkan dokumen yang benar.
 *
 * ============================================================================
 * YANG TIDAK TERBACA DIBIARKAN KOSONG, TIDAK DITEBAK
 * ============================================================================
 *
 * Nama berkas ditulis manusia selama bertahun-tahun dan tidak seragam. Dimensi
 * yang tidak dapat dibaca dari namanya dikembalikan kosong, bukan diisi nilai
 * yang paling sering muncul: dimensi yang ditebak akan memilih blok kalimat
 * yang keliru, dan kekeliruannya masuk ke naskah yang ditandatangani.
 */

/** Kehadiran satu pihak menurut nama berkas. */
export type Kehadiran = "" | "hadir" | "tidak-hadir" | "ghoib";

export type DimensiBlangko = {
  /** Golongan dokumen: bas, putusan, penetapan, relaas, dan seterusnya. */
  jenis: string;
  /** Untuk BAS: pertama, lanjutan, putus. Kosong bila bukan BAS atau tak terbaca. */
  tahapan: string;
  /** Nomor sidang bila disebut ("BAS 2 ..." -> 2). Nol bila tidak. */
  sidangKe: number;
  kehadiranPihak1: Kehadiran;
  kehadiranPihak2: Kehadiran;
  /** Pihak yang memakai kuasa: "", "pihak1", "pihak2", "keduanya". */
  kuasa: string;
  /** Peristiwa sidang yang membedakan varian: mediasi, pembuktian, dan lain-lain. */
  peristiwa: string[];
  /** Akibat sidang: tunda-panggil-pihak1, tunda-tanggal, putus, dan lain-lain. */
  akibat: string;
  /** Susunan hakim: "majelis", "tunggal", atau kosong bila tidak disebut. */
  susunan: string;
  /** Blangko khusus e-Court. */
  eCourt: boolean;
};

/** Dimensi yang seluruhnya kosong - dipakai bila nama berkas tidak terbaca. */
export function dimensiKosong(): DimensiBlangko {
  return {
    jenis: "",
    tahapan: "",
    sidangKe: 0,
    kehadiranPihak1: "",
    kehadiranPihak2: "",
    kuasa: "",
    peristiwa: [],
    akibat: "",
    susunan: "",
    eCourt: false,
  };
}

/** Folder ABT -> golongan dokumen. Dipakai sebagai dasar sebelum nama berkas dibaca. */
const JENIS_DARI_FOLDER: Array<[RegExp, string]> = [
  [/berita_acara_sidang/i, "bas"],
  [/putusan_penetapan/i, "putusan"],
  [/putusan_gugatan_sederhana/i, "putusan"],
  [/_formulir_kepaniteraan/i, "kepaniteraan"],
  [/_formulir_jinayat/i, "jinayat"],
  [/_ikrar_talak/i, "ikrar-talak"],
  [/_aktacerai/i, "akta-cerai"],
  [/relaas/i, "relaas"],
  [/mediasi/i, "mediasi"],
  [/gugatan_permohonan/i, "gugatan-permohonan"],
  [/e-court/i, "e-court"],
];

function jenisDariJalur(jalur: string, namaBerkas: string): string {
  for (const [pola, jenis] of JENIS_DARI_FOLDER) {
    if (pola.test(jalur)) return jenis;
  }
  // Folder pribadi ("derry_briantono", "Fikrianto", "blangko_lainnya") tidak
  // menyatakan golongan apa pun - namanya sendiri yang harus menjawab.
  if (/^\s*relas{1,2}\b|relaas/i.test(namaBerkas)) return "relaas";
  if (/\bBAS\b/i.test(namaBerkas)) return "bas";
  if (/penetapan/i.test(namaBerkas)) return "penetapan";
  if (/putusan/i.test(namaBerkas)) return "putusan";
  return "";
}

/**
 * Pihak mana yang disebut oleh sepotong nama berkas.
 *
 * "P" dan "T" dipakai ABT sebagai singkatan Penggugat/Pemohon dan
 * Tergugat/Termohon. Dicocokkan sebagai kata utuh supaya "PA" pada
 * "...PA.Mj.rtf" tidak terbaca sebagai Penggugat.
 */
const POLA_P = /(?:^|[\s(_&])P(?:emohon|enggugat)?\s*(?:I{1,3}|\d+)?(?=[\s(_&.,]|$)/i;
const POLA_T = /(?:^|[\s(_&])T(?:ermohon|ergugat)?\s*(?:I{1,3}|\d+)?(?=[\s(_&.,]|$)/i;

/**
 * Akhiran satker yang dipakai ABT: ".PA.Mj", ".PAmj", ".PA. Mj".
 *
 * Harus dibuang SEBELUM pihak dibaca. Tanpa itu "Tunda Panggil T.PA.Mj"
 * membuat huruf T menempel pada titik, pihaknya tidak terbaca, dan akibat
 * "tunda panggil tergugat" merosot menjadi "tunda tanggal" - dua tindakan yang
 * sama sekali berbeda di persidangan.
 */
const AKHIRAN_SATKER = /[\s.]*PA\s*\.?\s*Mj\s*\.?\s*$/i;

/**
 * Kehadiran dibaca dari potongan yang menyebut pihaknya.
 *
 * Urutannya penting: "Tidak Hadir" harus diperiksa SEBELUM "Hadir", sebab
 * "Hadir" adalah bagian dari "Tidak Hadir" dan pemeriksaan terbalik akan
 * membaca ketidakhadiran sebagai kehadiran - kebalikan persis dari keadaan
 * yang sesungguhnya.
 */
function bacaKehadiran(potongan: string): Kehadiran {
  if (/ghoib|ghaib/i.test(potongan)) return "ghoib";
  if (/tidak\s+hadir/i.test(potongan)) return "tidak-hadir";
  if (/\bhadir\b/i.test(potongan)) return "hadir";
  return "";
}

const PERISTIWA: Array<[RegExp, string]> = [
  [/mediasi/i, "mediasi"],
  [/pembuktian|bukti/i, "pembuktian"],
  [/penolakan\s+hakim|hakim\s+berhalangan/i, "penolakan-hakim"],
  [/derden\s*verzet/i, "derden-verzet"],
  [/voluntair/i, "voluntair"],
  [/\bPNS\b|izin\s+atasan/i, "izin-atasan"],
  [/verstek/i, "verstek"],
  [/damai|dicabut|cabut/i, "damai-atau-cabut"],
  [/gugur/i, "gugur"],
  [/saksi/i, "saksi"],
  [/kesimpulan/i, "kesimpulan"],
];

function bacaPeristiwa(teks: string): string[] {
  const hasil = new Set<string>();
  for (const [pola, nama] of PERISTIWA) {
    if (pola.test(teks)) hasil.add(nama);
  }
  return [...hasil].sort();
}

/**
 * Akibat sidang dibaca dari bagian sesudah " - " pertama.
 *
 * Pemisahan pada " - " TERAKHIR akan memotong "Putusan Verstek - (3 Saksi)" di
 * tempat yang salah dan memindahkan keadaan sidang menjadi bagian dari
 * akibatnya - aturan yang sama sudah dipakai jembatan bot saat menguraikan
 * nama blangko, dan dipertahankan di sini supaya keduanya tidak berselisih.
 */
function bacaAkibat(tindakan: string): string {
  if (!tindakan) return "";
  const t = tindakan.toLowerCase();
  if (/putus|penetapan|putusan/.test(t)) return "putus";
  if (/tunda/.test(t)) {
    const sebutP = POLA_P.test(tindakan);
    const sebutT = POLA_T.test(tindakan);
    if (/tambah\s+bukti|bukti/.test(t)) return "tunda-tambah-bukti";
    if (sebutP && sebutT) return "tunda-panggil-keduanya";
    if (sebutT) return "tunda-panggil-pihak2";
    if (sebutP) return "tunda-panggil-pihak1";
    return "tunda-tanggal";
  }
  return "";
}

function bacaSusunan(teks: string): string {
  // ".PA.Mj." dan ".PAmj." adalah penanda majelis yang dipakai ABT; "Tunggal"
  // ditulis lengkap pada blangko hakim tunggal.
  if (/\btunggal\b/i.test(teks)) return "tunggal";
  if (/\.\s*PA\s*\.?\s*mj\b|\bmajelis\b|\bmj\b/i.test(teks)) return "majelis";
  return "";
}

function bacaKuasa(bagianP: string, bagianT: string): string {
  const p = /kuasa/i.test(bagianP);
  const t = /kuasa/i.test(bagianT);
  if (p && t) return "keduanya";
  if (p) return "pihak1";
  if (t) return "pihak2";
  return "";
}

/**
 * Menguraikan satu nama berkas blangko menjadi dimensinya.
 *
 * `jalur` adalah jalur relatif terhadap akar blangko - folder ikut menentukan
 * golongan dokumennya, dan nama berkas saja tidak selalu cukup.
 */
export function uraikanDimensi(jalur: string, namaBerkas?: string): DimensiBlangko {
  const berkas = String(namaBerkas ?? jalur.split("/").pop() ?? "");
  const tanpaAkhiran = berkas.replace(/\.(rtf|doc|docx|odt)$/i, "");
  const hasil = dimensiKosong();

  hasil.jenis = jenisDariJalur(jalur, berkas);
  hasil.eCourt = /\(e-?court\)|e-?court/i.test(tanpaAkhiran);
  hasil.susunan = bacaSusunan(tanpaAkhiran);

  // Kurung siku memuat kode urut dan kadang skenario; keduanya bukan dimensi
  // keadaan, jadi dibuang sebelum sisanya dibaca.
  // Awalan urut ABT: "04-a. ", "01. ", "37-d. ". Huruf sub-urutnya HANYA
  // dikenali bila didahului tanda hubung. Tanpa syarat itu, "01. BAS Putus"
  // kehilangan huruf B-nya dan menjadi "AS Putus" - tahapannya lenyap.
  const sisa = tanpaAkhiran
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\(e-?court\)/gi, " ")
    .replace(/^\s*\d+(?:\s*-\s*[a-z])?\s*\.\s*/i, " ")
    .replace(AKHIRAN_SATKER, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (/\btahapan?\b/i.test(sisa) || /\bBAS\b/i.test(sisa)) {
    if (/\bpertama\b/i.test(sisa)) hasil.tahapan = "pertama";
    else if (/\blanjutan\b/i.test(sisa)) hasil.tahapan = "lanjutan";
    else if (/\bputus\b/i.test(sisa)) hasil.tahapan = "putus";
  }

  const nomorSidang = sisa.match(/\bBAS\s+(\d+)/i);
  if (nomorSidang) hasil.sidangKe = Number(nomorSidang[1]) || 0;

  // Keadaan dipisah dari akibat pada " - " PERTAMA.
  const pisah = sisa.indexOf(" - ");
  const keadaan = pisah >= 0 ? sisa.slice(0, pisah) : sisa;
  const tindakan = pisah >= 0 ? sisa.slice(pisah + 3) : "";

  // Keadaan kedua pihak dipisah pada "_" atau "&" - itulah pemisah yang dipakai
  // ABT antara bagian penggugat dan bagian tergugat.
  const bagian = keadaan.split(/\s*[_&]\s*/);
  let bagianP = "";
  let bagianT = "";
  for (const potong of bagian) {
    if (POLA_T.test(potong) && !bagianT) bagianT = potong;
    else if (POLA_P.test(potong) && !bagianP) bagianP = potong;
  }
  // Bila hanya satu bagian yang menyebut pihak, kehadirannya tetap dibaca dari
  // bagian itu saja; bagian yang tidak menyebut siapa pun tidak diberi arti.
  hasil.kehadiranPihak1 = bacaKehadiran(bagianP);
  hasil.kehadiranPihak2 = bacaKehadiran(bagianT);
  hasil.kuasa = bacaKuasa(bagianP, bagianT);
  hasil.peristiwa = bacaPeristiwa(sisa);
  hasil.akibat = bacaAkibat(tindakan);

  return hasil;
}

/**
 * Kunci kombinasi - dua blangko dengan kunci sama menempati sel matriks yang
 * sama, dan itu berarti salah satunya berlebih.
 */
export function kunciDimensi(d: DimensiBlangko): string {
  return [
    d.jenis || "-",
    d.tahapan || "-",
    d.sidangKe || 0,
    d.kehadiranPihak1 || "-",
    d.kehadiranPihak2 || "-",
    d.kuasa || "-",
    d.peristiwa.join("+") || "-",
    d.akibat || "-",
    d.susunan || "-",
    d.eCourt ? "ecourt" : "-",
  ].join("|");
}

/** Berapa dimensi yang berhasil terbaca - ukuran seberapa jelas nama berkasnya. */
export function kelengkapanDimensi(d: DimensiBlangko): number {
  let terisi = 0;
  if (d.jenis) terisi += 1;
  if (d.tahapan) terisi += 1;
  if (d.kehadiranPihak1) terisi += 1;
  if (d.kehadiranPihak2) terisi += 1;
  if (d.kuasa) terisi += 1;
  if (d.peristiwa.length > 0) terisi += 1;
  if (d.akibat) terisi += 1;
  if (d.susunan) terisi += 1;
  return terisi;
}
