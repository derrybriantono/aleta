/**
 * ============================================================================
 * PEMILIH RAGAM (K7b) - SALINAN IDENTIK aleta_bot/services/pemilihRagam.js
 * ============================================================================
 *
 * Portal (BAS portal, pratinjau tipe keluaran) dan bot HARUS memilih bentuk
 * yang sama untuk masukan yang sama; bila tidak, pratinjau di layar pengaturan
 * berbeda dari berita acara yang disusun bot. Uji pemilih-ragam-cermin.test.ts
 * menjalankan kedua berkas atas 2.251 nomor perkara sungguhan x 16 kunci x
 * n 3-6 dan menuntut sama 100% - termasuk kelompokTanya atas seluruh
 * pertanyaan templat ABT.
 *
 * Mengubah satu berkas tanpa yang lain memerahkan uji itu. Jangan
 * "merapikan" salah satunya saja.
 */

/**
 * FNV-1a 32 bit atas byte UTF-8, disandikan sendiri (tanpa TextEncoder) -
 * sama byte demi byte dengan TextEncoder, termasuk separuh pasangan surrogate
 * yang menjadi U+FFFD.
 */
export function fnv1a32(teks: string): number {
  const s = String(teks);
  let h = 0x811c9dc5;
  const aduk = (bait: number) => {
    h ^= bait;
    h = Math.imul(h, 0x01000193);
  };
  for (let i = 0; i < s.length; i++) {
    let c = s.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length) {
      const d = s.charCodeAt(i + 1);
      if (d >= 0xdc00 && d <= 0xdfff) {
        c = 0x10000 + ((c - 0xd800) << 10) + (d - 0xdc00);
        i++;
      }
    }
    if (c >= 0xd800 && c <= 0xdfff) c = 0xfffd;
    if (c < 0x80) aduk(c);
    else if (c < 0x800) {
      aduk(0xc0 | (c >> 6));
      aduk(0x80 | (c & 0x3f));
    } else if (c < 0x10000) {
      aduk(0xe0 | (c >> 12));
      aduk(0x80 | ((c >> 6) & 0x3f));
      aduk(0x80 | (c & 0x3f));
    } else {
      aduk(0xf0 | (c >> 18));
      aduk(0x80 | ((c >> 12) & 0x3f));
      aduk(0x80 | ((c >> 6) & 0x3f));
      aduk(0x80 | (c & 0x3f));
    }
  }
  return h >>> 0;
}

/** Pengaduk akhir MurmurHash3. */
export function fmix32(nilai: number): number {
  let h = nilai >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Angka 0 <= x < 1 dari sebuah teks. */
export function angka01(teks: string): number {
  return fmix32(fnv1a32(teks)) / 4294967296;
}

/** Kunci pertanyaan: huruf kecil, #dddd# jadi '#', sebutan jadi 'pihak', selain huruf/angka/'#' jadi spasi. */
export function kunciTanya(pertanyaan: string | null | undefined): string {
  return String(pertanyaan || "")
    .toLowerCase()
    .replace(/#\d{4}#/g, " # ")
    .replace(/\b(?:penggugat|tergugat|pemohon|termohon)(?:\s+i{1,2}\b)?/g, " pihak ")
    .replace(/[^a-z0-9#]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function fpb(a: number, b: number): number {
  let x = a;
  let y = b;
  while (y) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x;
}

export type MasukanIndeks = {
  nomorPerkara?: string | null;
  kodeKumpulan?: string | null;
  kunciTanya?: string | null;
  n: number;
  ke: number;
};

/** Indeks bentuk untuk saksi ke-`ke` (mulai 1) di antara `n` bentuk (rumus K7b). */
export function indeksVarian({ nomorPerkara, kodeKumpulan, kunciTanya: kunci, n, ke }: MasukanIndeks): number {
  const banyak = Math.max(1, Math.floor(Number(n) || 1));
  const urut = Math.max(1, Math.floor(Number(ke) || 1));
  const h = fmix32(fnv1a32(`${nomorPerkara || ""}|${kodeKumpulan || ""}|${kunci || ""}`));
  const dasar = h % banyak;
  let langkah = 1 + ((h >>> 8) % Math.max(1, banyak - 1));
  while (fpb(langkah, banyak) !== 1) langkah++;
  return (dasar + langkah * (urut - 1)) % banyak;
}

/** Apakah pertanyaan ini diragamkan pada perkara ini. */
export function diragamkan({
  nomorPerkara,
  kunciTanya: kunci,
  peluang,
}: {
  nomorPerkara?: string | null;
  kunciTanya?: string | null;
  peluang: number;
}): boolean {
  const p = Number(peluang);
  if (!(p > 0)) return false;
  if (p >= 1) return true;
  return angka01(`${nomorPerkara || ""}|${kunci || ""}|ragam`) < p;
}

export type JenisTanya = "tetap" | "rumusan" | "pokok" | "lain";

/**
 * Kelompok pertanyaan - URUTANNYA BERMAKNA (lihat bot).
 *
 * Pokok 'penyebab', 'cara tahu', dan 'menyaksikan' menuntut kata perselisihan
 * di pertanyaannya: "apa sebab wali tidak mau menjadi wali", "alasan
 * berpoligami", dan "pernah mendengar tindak kekerasan atas anak" bukan
 * pertanyaan perselisihan rumah tangga. 'mengenal' tidak memuat 'kenal'
 * (meN- meluluhkan k), jadi disebut sendiri.
 */
export const KELOMPOK_TANYA: ReadonlyArray<readonly [JenisTanya, string, RegExp]> = [
  ["tetap", "sumpah", /sumpah|identitas|nama lengkap|umur saudara|agama saudara|pekerjaan saudara|alamat saudara/],
  ["rumusan", "penutup", /masih ada (?:yang|keterangan|hal)|ingin .*sampaikan|akan .*sampaikan|ada tambahan/],
  ["rumusan", "maksud", /maksud|tujuan .*(?:menghadap|mengajukan)/],
  ["rumusan", "kenapa cerai", /(?:kenapa|mengapa) .*cerai/],
  ["rumusan", "nafkah", /nafkah/],
  ["rumusan", "komunikasi", /komunikasi|berkomunikasi/],
  ["rumusan", "keberatan", /keberatan/],
  ["pokok", "cara tahu", /^(?=.*(?:selisih|tengkar|cekcok|ribut|masalah|penyebab|pisah))(?=.*(?:bagaimana .*(?:mengetahui|tahu)|dari mana .*(?:tahu|mengetahui)))/],
  ["pokok", "penyebab", /^(?=.*(?:penyebab|sebab|alasan))(?=.*(?:selisih|tengkar|cekcok|ribut|cerai|pisah|masalah))/],
  ["pokok", "menyaksikan", /^(?=.*(?:melihat|mendengar|menyaksikan|berapa kali))(?=.*(?:selisih|tengkar|cekcok|ribut))/],
  ["pokok", "kenal", /kenal|mengenal/],
  ["lain", "hubungan pihak", /tahu hubungan|hubungan (?:antara )?pihak/],
  ["pokok", "tempat tinggal", /(?:dimana|di mana) .*(?:tinggal|kediaman|rumah tangga)|tinggal bersama di tempat lain/],
  ["pokok", "kehidupan", /(?:keadaan|kehidupan|kondisi) rumah tangga|bagaimana rumah tangga/],
  ["lain", "siapa pergi", /siapa .*(?:meninggalkan|pergi)/],
  ["lain", "sanggup", /sanggup/],
  ["pokok", "upaya damai", /upaya|merukunkan|dirukunkan|didamaikan|mendamaikan|rukun kembali/],
  ["pokok", "pisah", /pisah|serumah|satu rumah|tinggal bersama/],
  ["lain", "anak", /anak|keturunan/],
  ["lain", "awal perselisihan", /kapan .*(?:perselisihan|pertengkaran)|puncak/],
];

export function kelompokTanya(pertanyaan: string | null | undefined): { jenis: JenisTanya; kelompok: string; kunci: string } {
  const kunci = kunciTanya(pertanyaan);
  for (const [jenis, kelompok, pola] of KELOMPOK_TANYA) {
    if (pola.test(kunci)) return { jenis, kelompok, kunci };
  }
  return { jenis: "lain", kelompok: "", kunci };
}
