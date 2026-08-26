/**
 * Pemeriksa isi pesan: memberi peringatan, tidak pernah menolak.
 *
 * --- Masalah yang diselesaikan ---
 *
 * Seluruh isi pesan bawaan ALETA sudah aman, tetapi menu Edit Isi Pesan
 * menerima teks apa pun tanpa sepatah kata pun peringatan. Admin yang
 * bermaksud baik bisa menambahkan "GRATIS!!!", deretan emoji, atau tautan
 * pemendek tanpa tahu bahwa hal-hal itulah yang paling sering membuat nomor
 * WhatsApp ditangguhkan.
 *
 * --- Kenapa memperingatkan, bukan menolak ---
 *
 * Yang menulis isi pesan adalah pegawai pengadilan yang tahu apa yang perlu
 * disampaikan kepada pihak berperkara. Pemeriksa ini hanya menebak dari bentuk
 * kalimat, dan tebakannya bisa salah. Menolak penyimpanan berarti pemeriksa
 * yang keliru dapat menghalangi pemberitahuan yang sah - kerugian yang lebih
 * pasti daripada risiko yang dihindarinya.
 *
 * Karena itu hasilnya selalu berupa PERINGATAN yang menjelaskan alasannya,
 * dan keputusan tetap di tangan admin.
 *
 * --- Kenapa dicocokkan per KATA UTUH ---
 *
 * Pencocokan potongan kata menghasilkan peringatan palsu yang merusak
 * kepercayaan pada pemeriksanya. Contoh nyata dari isi pesan ALETA sendiri:
 * kata "menangani" memuat potongan "menang", dan "Perseroan Terbatas" memuat
 * "terbatas". Pemeriksa yang berteriak pada kalimat yang benar akan diabaikan
 * orang, dan pemeriksa yang diabaikan sama saja dengan tidak ada.
 */

export type MessageWarningSeverity = "tinggi" | "sedang" | "rendah";

export type MessageWarning = {
  /** Kode tetap, dipakai pengujian dan penyaringan. */
  code: string;
  severity: MessageWarningSeverity;
  /** Judul pendek untuk daftar peringatan. */
  label: string;
  /** Penjelasan mengapa hal ini berisiko. */
  detail: string;
  /** Bagian isi pesan yang memicu peringatan. */
  samples: string[];
  /** Saran perbaikan. */
  fix: string;
};

/**
 * Layanan pemendek tautan.
 *
 * Harus sama persis dengan SHORTENER_HOSTS pada
 * aleta_bot/services/outgoingChatService.js. Bila keduanya berbeda, portal akan
 * memperingatkan tautan yang tidak dicatat bot, atau sebaliknya - dan
 * ketidakcocokan seperti itu membuat kedua pihak tidak bisa dipercaya.
 * Kesamaannya dijaga oleh pengujian.
 */
export const SHORTENER_HOSTS = [
  "s.id",
  "bit.ly",
  "tinyurl.com",
  "t.co",
  "goo.gl",
  "ow.ly",
  "is.gd",
  "cutt.ly",
  "shorturl.at",
  "rb.gy",
  "linktr.ee",
];

/**
 * Kosakata khas iklan dan penipuan.
 *
 * Sengaja memakai frasa beberapa kata jika kata tunggalnya lazim dipakai dalam
 * bahasa pengadilan. "segera" misalnya TIDAK didaftarkan, karena isi pesan
 * pegawai yang sah memang berbunyi "Mohon segera ditindaklanjuti"; yang
 * didaftarkan adalah "segera transfer".
 */
const PROMO_PHRASES = [
  "gratis",
  "cuma-cuma",
  "hadiah",
  "bonus",
  "doorprize",
  "undian",
  "jackpot",
  "promo",
  "promosi",
  "diskon",
  "cashback",
  "voucher",
  "kupon",
  "menang",
  "pemenang",
  "buruan",
  "penawaran terbatas",
  "waktu terbatas",
  "kuota terbatas",
  "jangan sampai ketinggalan",
  "klik di sini",
  "klik disini",
  "klik link",
  "klik tautan",
  "daftar sekarang",
  "beli sekarang",
  "order sekarang",
  "penghasilan tambahan",
  "modal kecil",
  "tanpa jaminan",
  "pinjol",
];

/**
 * Kosakata penipuan yang mengatasnamakan lembaga.
 *
 * Dipisahkan dari kosakata iklan karena bahayanya berbeda dan lebih besar:
 * pesan pengadilan yang berbunyi seperti penipuan tidak hanya berisiko
 * diblokir, tetapi juga mengajari warga untuk mempercayai penipu yang meniru
 * pengadilan. Pembayaran perkara diurus di bank atau PTSP, tidak lewat pesan.
 */
const PHISHING_PHRASES = [
  "kode otp",
  "kode verifikasi",
  "kode rahasia",
  "nomor rekening",
  "transfer ke rekening",
  "segera transfer",
  "kirim uang",
  "pin atm",
  "kata sandi",
  "password",
  "verifikasi data anda",
  "konfirmasi data anda",
  "akun anda diblokir",
  "akun anda ditangguhkan",
];

/**
 * Singkatan yang memang ditulis kapital dan tidak boleh dianggap berteriak.
 */
const CAPS_ALLOWLIST = new Set([
  "PTSP",
  "SIPP",
  "ALETA",
  "WITA",
  "WIB",
  "WITENG",
  "HALO",
  "BERHENTI",
  "LANJUT",
  "PDF",
  "PMH",
  "BHT",
  "KUA",
  "NIK",
  "PDT",
  "PA.DGL",
  "JURUSITA",
  "WHATSAPP",
]);

/** Ambang panjang isi pesan sebelum diperingatkan. */
export const MAX_RECOMMENDED_LENGTH = 1200;
/** Ambang jumlah emoji sebelum diperingatkan. */
export const MAX_RECOMMENDED_EMOJI = 3;

/** Membuang penanda variabel agar tidak ikut dianalisis bentuk hurufnya. */
function stripPlaceholders(body: string) {
  return body.replace(/\{\{\s*[a-zA-Z0-9_]+\s*\}\}/g, " ");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Mencari frasa sebagai KATA UTUH.
 *
 * Batas kata memakai penjaga karakter huruf/angka di kedua sisi, bukan \b,
 * karena frasa yang mengandung tanda hubung seperti "cuma-cuma" tidak
 * diperlakukan benar oleh \b.
 */
function findPhrases(haystack: string, phrases: string[]) {
  const found: string[] = [];
  const lower = haystack.toLowerCase();
  for (const phrase of phrases) {
    const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(phrase)}(?![\\p{L}\\p{N}])`, "iu");
    if (pattern.test(lower)) found.push(phrase);
  }
  return found;
}

function findShortenerLinks(body: string) {
  const found: string[] = [];
  for (const host of SHORTENER_HOSTS) {
    const pattern = new RegExp(`https?://(?:www\\.)?${escapeRegExp(host)}/\\S+`, "gi");
    const matches = body.match(pattern);
    if (matches) found.push(...matches);
  }
  return found;
}

/** Kata yang seluruhnya huruf kapital dan bukan singkatan yang dikenal. */
function findShoutedWords(body: string) {
  const bersih = stripPlaceholders(body);
  const kata = bersih.match(/[A-Z][A-Z.]{3,}/g) || [];
  const hasil: string[] = [];
  for (const item of kata) {
    const normalized = item.replace(/\.$/, "");
    if (CAPS_ALLOWLIST.has(normalized)) continue;
    if (hasil.includes(normalized)) continue;
    hasil.push(normalized);
  }
  return hasil;
}

function countEmoji(body: string) {
  const matches = body.match(/\p{Extended_Pictographic}/gu);
  return matches ? matches.length : 0;
}

/**
 * Memeriksa satu isi pesan.
 *
 * @returns daftar peringatan, terurut dari yang paling berat
 */
export function lintTemplateBody(body: string): MessageWarning[] {
  const teks = typeof body === "string" ? body : String(body ?? "");
  const warnings: MessageWarning[] = [];
  if (!teks.trim()) return warnings;

  const pemendek = findShortenerLinks(teks);
  if (pemendek.length > 0) {
    warnings.push({
      code: "pemendek_tautan",
      severity: "tinggi",
      label: "Tautan pemendek",
      detail:
        "Alamat pemendek menyembunyikan tujuan sebenarnya sampai diklik, persis seperti cara kerja penipuan. Ini pemicu pemblokiran dari isi pesan yang paling sering.",
      samples: pemendek,
      fix: "Ganti dengan alamat lengkap pada domain resmi, misalnya https://pa-donggala.go.id.",
    });
  }

  const phishing = findPhrases(teks, PHISHING_PHRASES);
  if (phishing.length > 0) {
    warnings.push({
      code: "kata_penipuan",
      severity: "tinggi",
      label: "Kalimat menyerupai penipuan",
      detail:
        "Pesan pengadilan yang menyebut rekening, transfer, kode verifikasi, atau kata sandi akan dibaca warga sebagai penipuan yang mengatasnamakan pengadilan. Selain berisiko dilaporkan, ini mengajari warga mempercayai penipu yang meniru pengadilan.",
      samples: phishing,
      fix: "Pembayaran perkara diurus di bank atau meja PTSP, bukan lewat pesan. Arahkan pihak datang atau menghubungi nomor resmi.",
    });
  }

  const promosi = findPhrases(teks, PROMO_PHRASES);
  if (promosi.length > 0) {
    warnings.push({
      code: "kata_promosi",
      severity: "tinggi",
      label: "Kosakata iklan",
      detail:
        "Kata-kata ini adalah kosakata khas pesan iklan massal, dan penyaring WhatsApp mengenalinya. Pesan pengadilan tidak membutuhkannya.",
      samples: promosi,
      fix: "Tulis dengan bahasa resmi pengadilan yang lugas.",
    });
  }

  const berteriak = findShoutedWords(teks);
  if (berteriak.length > 0) {
    warnings.push({
      code: "huruf_kapital",
      severity: "sedang",
      label: "Kata ditulis kapital semua",
      detail:
        "Menulis kata dengan huruf besar semua adalah ciri pesan iklan, dan bagi penerima terbaca seperti dibentak.",
      samples: berteriak,
      fix: "Tulis biasa. Bila perlu penekanan, pakai satu tanda bintang di kedua sisi kata.",
    });
  }

  const emoji = countEmoji(teks);
  if (emoji > MAX_RECOMMENDED_EMOJI) {
    warnings.push({
      code: "emoji_berlebihan",
      severity: "sedang",
      label: `Terlalu banyak emoji (${emoji})`,
      detail:
        "Emoji bertumpuk adalah ciri pesan promosi. Pesan resmi pengadilan juga kehilangan wibawanya.",
      samples: [`${emoji} emoji, disarankan paling banyak ${MAX_RECOMMENDED_EMOJI}`],
      fix: "Kurangi sampai paling banyak tiga, atau hilangkan sama sekali.",
    });
  }

  if (teks.length > MAX_RECOMMENDED_LENGTH) {
    warnings.push({
      code: "pesan_terlalu_panjang",
      severity: "sedang",
      label: `Isi pesan terlalu panjang (${teks.length} huruf)`,
      detail:
        "Pesan sepanjang ini jarang dibaca sampai habis. Pesan yang tidak dibaca menurunkan nilai keterlibatan akun, dan nilai keterlibatan yang rendah membuat nomor terlihat seperti pengirim massal.",
      samples: [`${teks.length} huruf, disarankan di bawah ${MAX_RECOMMENDED_LENGTH}`],
      fix: "Pindahkan keterangan panjang ke menu chat, dan sisakan pokoknya saja di pemberitahuan.",
    });
  }

  if (/\*\*[^*\n]+\*\*/.test(teks)) {
    warnings.push({
      code: "bintang_ganda",
      severity: "rendah",
      label: "Tanda bintang ganda",
      detail:
        "WhatsApp menebalkan tulisan dengan SATU tanda bintang. Dua tanda bintang membuat bintangnya ikut terbaca penerima.",
      samples: (teks.match(/\*\*[^*\n]+\*\*/g) || []).slice(0, 3),
      fix: "Pakai satu tanda bintang: *seperti ini*.",
    });
  }

  const tandaBeruntun = teks.match(/[!?]{3,}/g);
  if (tandaBeruntun) {
    warnings.push({
      code: "tanda_baca_beruntun",
      severity: "rendah",
      label: "Tanda seru atau tanya beruntun",
      detail: "Tanda baca bertumpuk adalah ciri pesan iklan dan mengurangi kesan resmi.",
      samples: [...new Set(tandaBeruntun)].slice(0, 3),
      fix: "Cukup satu tanda baca.",
    });
  }

  const urutan: Record<MessageWarningSeverity, number> = { tinggi: 0, sedang: 1, rendah: 2 };
  return warnings.sort((a, b) => urutan[a.severity] - urutan[b.severity]);
}

/** Ringkasan singkat untuk ditampilkan di daftar isi pesan. */
export function summarizeWarnings(warnings: MessageWarning[]) {
  return {
    total: warnings.length,
    tinggi: warnings.filter((item) => item.severity === "tinggi").length,
    sedang: warnings.filter((item) => item.severity === "sedang").length,
    rendah: warnings.filter((item) => item.severity === "rendah").length,
  };
}
