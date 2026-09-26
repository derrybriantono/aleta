"use strict";

/**
 * ============================================================================
 * PEMILIH RAGAM (K7b) - BENTUK MANA UNTUK SAKSI KE BERAPA, TANPA Math.random
 * ============================================================================
 *
 * Salinan identiknya ada di portal: manajemen_surat/src/lib/tipe-keluaran/
 * pemilih-ragam.ts. Keduanya HARUS memulangkan angka yang sama untuk masukan
 * yang sama - uji pemilih-ragam-cermin.test.ts menjalankan keduanya atas
 * 2.251 nomor perkara sungguhan dan menuntut sama 100%.
 *
 * Sebabnya berbenih, bukan acak:
 *   - mencetak ulang perkara yang sama menghasilkan berita acara yang SAMA
 *     persis; petugas yang mencetak dua kali tidak memegang dua naskah;
 *   - perkara yang berbeda mendapat susunan yang berbeda, sehingga register
 *     tidak berisi dua puluh berita acara yang berbunyi kata demi kata sama;
 *   - dalam satu berita acara, saksi ke-1..n mendapat indeks yang semuanya
 *     berbeda selama banyaknya bentuk >= banyaknya saksi (langkah koprima).
 *
 * Berkas ini tidak me-require apa pun, supaya dapat dimuat uji portal apa
 * adanya.
 */

/**
 * FNV-1a 32 bit atas byte UTF-8.
 *
 * UTF-8 disandikan di sini, bukan lewat TextEncoder: TextEncoder.encode atas
 * teks pendek memakan sekitar 0,25 ms per panggilan di Node - 500 ms untuk
 * dua ratus berita acara - sedangkan hasilnya sama byte demi byte.
 */
function fnv1a32(teks) {
  const s = String(teks);
  let h = 0x811c9dc5;
  const aduk = (bait) => {
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
    if (c >= 0xd800 && c <= 0xdfff) c = 0xfffd; // separuh pasangan: seperti TextEncoder
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

/** Pengaduk akhir MurmurHash3 - menyebarkan bit FNV yang berdekatan. */
function fmix32(nilai) {
  let h = nilai >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Angka 0 <= x < 1 dari sebuah teks - sama di bot dan portal. */
function angka01(teks) {
  return fmix32(fnv1a32(teks)) / 4294967296;
}

/**
 * Kunci pertanyaan: huruf kecil, variabel ABT #dddd# jadi '#', sebutan pihak
 * jadi 'pihak', selain huruf/angka/'#' jadi spasi, spasi dirapatkan.
 *
 * Sebutan disamakan supaya "Apakah saksi kenal dengan Penggugat?" dan "...
 * Pemohon?" berkunci sama: pertanyaan yang sama pada perkara talak dan gugat
 * tidak boleh mendapat nasib ragam yang berbeda hanya karena sebutannya.
 */
function kunciTanya(pertanyaan) {
  return String(pertanyaan || "")
    .toLowerCase()
    .replace(/#\d{4}#/g, " # ")
    .replace(/\b(?:penggugat|tergugat|pemohon|termohon)(?:\s+i{1,2}\b)?/g, " pihak ")
    .replace(/[^a-z0-9#]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function fpb(a, b) {
  let x = a;
  let y = b;
  while (y) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x;
}

/**
 * Indeks bentuk untuk saksi ke-`ke` (mulai 1) di antara `n` bentuk.
 *
 *   h       = fmix32(fnv1a32(nomorPerkara + '|' + kodeKumpulan + '|' + kunciTanya))
 *   dasar   = h mod n
 *   langkah = 1 + ((h >>> 8) mod max(1, n-1)), dinaikkan sampai koprima dengan n
 *   indeks  = (dasar + langkah * (ke-1)) mod n
 */
function indeksVarian({ nomorPerkara, kodeKumpulan, kunciTanya: kunci, n, ke }) {
  const banyak = Math.max(1, Math.floor(Number(n) || 1));
  const urut = Math.max(1, Math.floor(Number(ke) || 1));
  const h = fmix32(fnv1a32(`${nomorPerkara || ""}|${kodeKumpulan || ""}|${kunci || ""}`));
  const dasar = h % banyak;
  let langkah = 1 + ((h >>> 8) % Math.max(1, banyak - 1));
  while (fpb(langkah, banyak) !== 1) langkah++;
  return (dasar + langkah * (urut - 1)) % banyak;
}

/** Apakah pertanyaan ini diragamkan pada perkara ini (peluang 0..1). */
function diragamkan({ nomorPerkara, kunciTanya: kunci, peluang }) {
  const p = Number(peluang);
  if (!(p > 0)) return false;
  if (p >= 1) return true;
  return angka01(`${nomorPerkara || ""}|${kunci || ""}|ragam`) < p;
}

/**
 * Kelompok pertanyaan dan jenisnya.
 *
 *   tetap    lafal sumpah dan identitas saksi - TIDAK PERNAH disentuh
 *   rumusan  pertanyaan yang jawabannya rumusan baku; manusia menjawabnya
 *            sama pada 89-100% pasangan saksi - tidak diberi pembuka, dan
 *            ragamnya mengikuti profil manusia
 *   pokok    pertanyaan pokok (kenal, tempat tinggal, kehidupan rumah tangga,
 *            penyebab, cara tahu, menyaksikan, pisah, upaya damai) - selalu
 *            berbeda bentuk antar saksi selama bentuknya cukup
 *   lain     selebihnya - mengikuti profil manusia bila ada
 *
 * Pokok 'penyebab', 'cara tahu', dan 'menyaksikan' menuntut kata perselisihan
 * di pertanyaannya: "apa sebab wali tidak mau menjadi wali", "alasan
 * berpoligami", dan "pernah mendengar tindak kekerasan atas anak" bukan
 * pertanyaan perselisihan rumah tangga. 'mengenal' tidak memuat 'kenal'
 * (meN- meluluhkan k), jadi disebut sendiri.
 *
 * URUTANNYA BERMAKNA. "Apakah selama pisah ... masih ada komunikasi?" memuat
 * kata "pisah" tetapi pertanyaan rumusan; "Bagaimana saksi mengetahui
 * penyebab ..." memuat "penyebab" tetapi pertanyaan cara tahu.
 */
const KELOMPOK_TANYA = [
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

function kelompokTanya(pertanyaan) {
  const kunci = kunciTanya(pertanyaan);
  for (const [jenis, kelompok, pola] of KELOMPOK_TANYA) {
    if (pola.test(kunci)) return { jenis, kelompok, kunci };
  }
  return { jenis: "lain", kelompok: "", kunci };
}

module.exports = { fnv1a32, fmix32, angka01, kunciTanya, indeksVarian, diragamkan, kelompokTanya, KELOMPOK_TANYA };
