/**
 * ============================================================================
 * ATURAN FORMAT & SUMBER ISIAN USULAN - SATU ATURAN UNTUK PORTAL DAN EKSTENSI (19 Okt 2026)
 * ============================================================================
 *
 * Usulan isian dari bot (abt/usulan, isi-gugatan, kuasa-gugatan, ktp-pihak) dipakai di dua tempat yang harus
 * menghasilkan tulisan yang SAMA: "Isi otomatis dari SIPP" di Blangko ABT by Derry Briantono (ekstensi, mesin bersama
 * ekstensi-sipp/isi-sipp-bersama.js) dan draf putusan agen ALETA (sisi server portal). Berkas ini CERMIN mesin
 * bersama itu - daftar kode dan fungsi format identik; uji draf-h7-mulus-19okt memuat mesin ekstensi dan
 * membandingkan daftar kode serta keluaran pada korpus nilai, sehingga keduanya tidak dapat berbeda diam-diam.
 *
 *   - PERIODE: "bulan Januari 2023" (bulan dan tahun) atau "tahun 2023" (tahun saja); "awal/akhir/pertengahan tahun 2023".
 *   - HTML: nilai usulan dipolos-kan (tag dibuang, <br> dan penutup blok menjadi baris baru, entitas diurai) KECUALI
 *     variabel yang kuerinya memang menghasilkan HTML (VARIABEL_BERHTML, mis. 8500).
 */

/** Variabel yang kuerinya menghasilkan HTML (KODE_HTML mesin bersama) - nilainya tidak dibersihkan. */
export const VARIABEL_BERHTML: readonly string[] = ["0067", "0068", "0206", "10101", "10102", "4001", "5404", "6000", "6001", "7006", "7007", "7008", "7044", "7045", "7046", "7047", "7048", "7050", "7052", "7054", "7055", "7057", "7058", "7061", "7062", "7080", "7089", "7097", "7098", "7100", "7102", "7104", "7107", "7108", "7109", "7129", "7131", "7133", "7140", "7169", "7170", "8185", "8495", "8499", "8500", "8502", "8506", "8507", "8508", "8509", "8510", "8521", "8522", "8523", "8524", "8526", "8527", "8528", "8530", "8531", "8533", "8534", "8547"];

/** Variabel periode (KODE_PERIODE): awal perselisihan 0222, pisah rumah sejak 0246. */
export const VARIABEL_PERIODE: readonly string[] = ["0222", "0246"];

/** Isian yang tidak pernah diisi agen sendiri (HANYA_SARAN): keputusan hakim. */
export const VARIABEL_HANYA_SARAN: readonly string[] = ["8503", "5227"];

/** Variabel yang memicu bacaan berkas bukti e-Court (VAR_BUKTI). */
export const VAR_BUKTI: readonly string[] = ["9470", "9488", "9489", "9492", "9493", "9804", "9805", "9810", "9834", "9835", "9840", "9873", "9951", "9952", "0654", "0655", "12040", "12041", "12042", "12043", "12044", "12045", "12046", "12047", "12048", "12049"];

/**
 * T11 (31 Okt 2026): bukti surat dan bukti elektronik TERPISAH - lima variabel ABT per pihak (P = Penggugat/Pemohon, T = Tergugat/Termohon).
 * Sama dengan KODE_BUKTI_PISAH di ekstensi-sipp/blangko-derry-isian.js (uji bukti-pisah-t11 menjaganya).
 */
export const KODE_BUKTI_PISAH: Readonly<Record<"P" | "T", Readonly<Record<"surat" | "el" | "pengantarSurat" | "pengantarEl" | "putusan", string>>>> = {
  P: { surat: "12040", el: "12041", pengantarSurat: "12042", pengantarEl: "12043", putusan: "12044" },
  T: { surat: "12045", el: "12046", pengantarSurat: "12047", pengantarEl: "12048", putusan: "12049" },
};

/** Variabel yang diisi dari berkas e-Court (VAR_ECOURT): bacaan isi-gugatan hanya diminta bila blangko memuatnya. */
export const VAR_ECOURT: readonly string[] = ["6055", "6054", "7120", "6071", "6072", "7778", "5110", "5111", "0007", "2004", "7084", "9881", "5227", "8436", "8437", "9355", "9491", "9681", "9164", "9283", "9470", "9488", "9489", "9492", "9493", "9804", "9805", "9810", "9834", "9835", "9840", "9873", "9951", "9952", "0654", "0655", "12020", "12021", "12022", "12023", "12024", "12025", "12026", "12027", "12028", "12040", "12041", "12042", "12043", "12044", "12045", "12046", "12047", "12048", "12049", "0027", "0045", "8175", "8179", "8180", "0370", "0372", "0123", "7139", "8548", "8549", "8800", "8801", "8802", "8803", "8804", "8805", "8806", "8807", "8808", "8809", "8810", "8811", "8813"];

/** Variabel kuasa dari surat gugatan (VAR_KUASA). */
export const VAR_KUASA: readonly string[] = ["0156", "0184", "8538", "8537"];

const teks = (v: unknown): string => (v === null || v === undefined ? "" : String(v));

const NAMA_BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

/** Memuat tag HTML atau entitas HTML? */
export function adaHtml(t: unknown): boolean {
  return /<\s*\/?\s*[a-z][^>]*>|&(?:nbsp|amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);/i.test(teks(t));
}

/** HTML -> teks rapi: <br>, penutup <div>/<p>/<li> menjadi pemisah baris; tag lain dibuang; entitas diurai; spasi dirapikan. */
export function htmlKeTeks(t: unknown): string {
  let x = teks(t);
  if (!adaHtml(x)) return x;
  x = x
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\s*\/\s*(?:div|p|li|tr|h\d|ul|ol|table)\s*>/gi, "\n")
    .replace(/<\s*li\b[^>]*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;|&#0*39;/gi, "'")
    .replace(/&#(\d+);/g, (_m, n: string) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, n: string) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&amp;/gi, "&");
  return x
    .split("\n")
    .map((baris) => baris.replace(/[ \t ]+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

/** Nilai yang diisikan/ditampilkan: HTML dibuang kecuali variabel yang memang berisi HTML dari kuerinya. */
export function bersihkanNilai(kode: string, nilai: unknown): string {
  return VARIABEL_BERHTML.includes(teks(kode)) ? teks(nilai) : htmlKeTeks(nilai);
}

/** Periode baku: "Januari 2023" -> "bulan Januari 2023", "2023" -> "tahun 2023"; tidak menggandakan awalan. Selain itu apa adanya. */
export function formatPeriode(nilai: unknown): string {
  const t = teks(nilai).replace(/\s+/g, " ").trim();
  let m = t.match(new RegExp(`^(?:bulan\\s+)*(${NAMA_BULAN.join("|")}|Pebruari|Nopember)\\s*,?\\s+(?:tahun\\s+)?(\\d{4})$`, "i"));
  if (m) {
    const kecil = m[1].toLowerCase();
    const baku = kecil === "pebruari" ? "februari" : kecil === "nopember" ? "november" : kecil;
    return `bulan ${NAMA_BULAN.find((b) => b.toLowerCase() === baku)} ${m[2]}`;
  }
  // "awal bulan Agustus 2025" bukan salah satu bentuk isian (bulan _ / tahun _ / awal tahun / akhir tahun): menjadi "bulan Agustus 2025".
  m = t.match(new RegExp(`^(?:awal|akhir|pertengahan)\\s+(?:bulan\\s+)+(${NAMA_BULAN.join("|")}|Pebruari|Nopember)\\s*,?\\s+(?:tahun\\s+)?(\\d{4})$`, "i"));
  if (m) {
    const kecil = m[1].toLowerCase();
    const baku = kecil === "pebruari" ? "februari" : kecil === "nopember" ? "november" : kecil;
    return `bulan ${NAMA_BULAN.find((b) => b.toLowerCase() === baku)} ${m[2]}`;
  }
  m = t.match(/^(awal|akhir|pertengahan)\s+(?:tahun\s+)*(\d{4})$/i);
  if (m) return `${m[1].toLowerCase()} tahun ${m[2]}`;
  m = t.match(/^(?:tahun\s+)*(\d{4})$/i);
  if (m) return `tahun ${m[1]}`;
  return t;
}

// ---------------------------------------------------------------------------
// Bentuk nilai menurut MAKNA isian (19 Okt, isian 2) - cermin BENTUK_KODE / sahBentuk / rapikanBentuk mesin bersama ekstensi.
// ---------------------------------------------------------------------------
/** Jenis makna isian yang bentuk nilainya dijaga (kode variabel ABT -> jenis). */
export const BENTUK_KODE: Readonly<Record<string, string>> = {
  "0222": "periode",
  "0246": "periode",
  "9944": "lama",
  "7035": "pihak",
  "1268": "kalimat",
  "0007": "anak",
  "5178": "tempat",
  "5197": "tanggalNikah",
};
const POLA_BULAN_ID = `(?:${NAMA_BULAN.join("|")}|Pebruari|Nopember)`;
const POLA_PERIODE = new RegExp(
  `^(?:bulan ${POLA_BULAN_ID} [0-9]{4}|tahun [0-9]{4}|(?:awal|akhir|pertengahan) (?:tahun [0-9]{4}|bulan ${POLA_BULAN_ID} [0-9]{4})|awal (?:pernikahan|perkawinan|menikah|berumah tangga))$`,
  "i"
);
const POLA_LAMA = /^(?:(?:kurang lebih|sekitar|±|lebih dari)\s+)?\d{1,3}\s*(?:\([^)]{1,25}\)\s*)?(?:tahun|bulan|minggu|hari)(?:\s+(?:dan\s+)?\d{1,3}\s*(?:\([^)]{1,25}\)\s*)?(?:bulan|minggu|hari))?$/i;
const POLA_PIHAK = /^(?:penggugat|tergugat|pemohon|termohon)(?:\s+(?:i|ii|iii|iv))?$/i;
const POLA_TANGGAL_NIKAH = new RegExp(`^[0-9]{1,2} ${POLA_BULAN_ID} (?:19|20)[0-9]{2}$`, "i");
const POLA_KALIMAT_MENTAH = /sebagaimana|bahwa\b|nomor|nomer|tertanggal|melangsungkan|kutipan|akta|surat\s+keterangan|ghoib|ghaib|meninggalkan|\bpergi\b|\btelah\b|\bsudah\b|\byang\b|\bdan\b.*\bdan\b|\d{2,3}\/\d{1,3}\/[IVX]+\//i;
const POLA_KALIMAT_MENTAH_ANAK = /sebagaimana|nomor|tertanggal|melangsungkan|kutipan|akta|surat\s+keterangan|ghoib|ghaib/i;
const satuBaris = (t: unknown): string => teks(t).replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").trim();

/** Jenis makna isian ini ("" = tidak dijaga). Kode dari katalog, atau nama isian untuk periode. */
export function bentukIsian(kode: string, nama = ""): string {
  const k = BENTUK_KODE[teks(kode)];
  if (k) return k;
  return /(awal konflik|awal perselisihan|puncak|pisah rumah sejak)/i.test(teks(nama)) ? "periode" : "";
}

/** Nilai ini sesuai makna isian? true bila isiannya tidak dijaga. Periode diterima setelah dibakukan (formatPeriode). */
export function sahBentuk(kode: string, nilai: unknown, nama = ""): boolean {
  const jenis = bentukIsian(kode, nama);
  if (!jenis) return true;
  const t = satuBaris(nilai);
  if (!t) return false;
  if (jenis === "periode") return POLA_PERIODE.test(formatPeriode(t));
  if (jenis === "lama") return POLA_LAMA.test(t);
  if (jenis === "pihak") return POLA_PIHAK.test(t);
  if (jenis === "tanggalNikah") return POLA_TANGGAL_NIKAH.test(t);
  if (jenis === "kalimat") return t.length <= 400 && /(damai|rukun|nasihat|nasehat|musyawarah|mediasi|upaya|usaha|berusaha)/i.test(t) && !/[<>#]/.test(t);
  if (jenis === "anak") return t.length <= 250 && /anak/i.test(t) && /(dikaruniai|mempunyai|memiliki|punya|keturunan)/i.test(t) && !POLA_KALIMAT_MENTAH_ANAK.test(t);
  if (jenis === "tempat") return t.length <= 90 && !POLA_KALIMAT_MENTAH.test(t) && !/[<>#;]/.test(t);
  return true;
}

/** Nilai yang sudah sah dirapikan ke bentuk tulisnya: periode baku, satu baris untuk isian kalimat/anak/tempat/lama/pihak/tanggal. */
export function rapikanBentuk(kode: string, nilai: unknown, nama = ""): string {
  const jenis = bentukIsian(kode, nama);
  if (jenis === "periode") return formatPeriode(satuBaris(nilai));
  if (["kalimat", "anak", "tempat", "lama", "pihak", "tanggalNikah"].includes(jenis)) return satuBaris(nilai);
  return teks(nilai);
}

/**
 * Nilai usulan sebagaimana ditulis mesin bersama: HTML dibuang (kecuali variabel ber-HTML), dipangkas, lalu periode
 * dibakukan untuk variabel periode. Draf putusan memakai fungsi ini apa adanya. Nilai yang bentuknya BUKAN isiannya
 * (mis. kalimat ghaib di awal perselisihan) dikembalikan KOSONG - lebih baik tanpa usulan daripada salah isi.
 */
export function bersihkanNilaiUsulan(kode: string, nilai: unknown): string {
  const k = teks(kode).trim();
  const bersih = bersihkanNilai(k, nilai).trim();
  const baku = VARIABEL_PERIODE.includes(k) ? formatPeriode(bersih) : bersih;
  if (!baku || VARIABEL_BERHTML.includes(k)) return baku;
  return sahBentuk(k, baku) ? rapikanBentuk(k, baku) : "";
}
