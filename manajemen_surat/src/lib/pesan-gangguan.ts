/**
 * Menerjemahkan kegagalan teknis menjadi kalimat yang dapat dibaca petugas.
 *
 * ============================================================================
 * "Failed to fetch" TIDAK MENJELASKAN APA PUN
 * ============================================================================
 *
 * Ketika basis data mati, peladen tidak sempat menjawab apa-apa dan peramban
 * melempar "Failed to fetch". Kalimat itu muncul apa adanya di halaman masuk,
 * dan yang membacanya panitera pengganti pada pukul tujuh pagi - bukan
 * pemrogram.
 *
 * Akibatnya dua hal yang sama buruknya: petugas mengira dirinya salah mengetik
 * kata sandi lalu mencoba berulang kali sampai akun terkunci, atau ia melapor
 * "ALETA rusak" tanpa satu keterangan pun yang dapat dipakai memperbaikinya.
 *
 * ============================================================================
 * TIGA HAL YANG HARUS ADA PADA TIAP PESAN
 * ============================================================================
 *
 *   1. APA yang terjadi, dalam kalimat biasa
 *   2. Bahwa itu BUKAN kesalahan yang membacanya - supaya ia berhenti mencoba
 *   3. APA yang dapat dilakukannya sekarang
 *
 * Yang TIDAK disebut: nama pustaka, kode galat, nomor porta, dan nama berkas.
 * Semua itu tetap dicatat di konsol peramban dan log peladen, tempat yang
 * memperbaikinya memang mencarinya.
 */

/** Kalimat teknis yang berarti peladen tidak terjangkau sama sekali. */
const CIRI_TIDAK_TERJANGKAU = [
  "failed to fetch",
  "fetch failed",
  "networkerror",
  "network error",
  "load failed",
  "err_connection",
  "err_network",
  "err_internet_disconnected",
  "econnrefused",
  "econnreset",
  "etimedout",
  "enotfound",
  "getaddrinfo",
  "socket hang up",
  "terminated",
];

/** Kalimat teknis yang berarti peladen hidup tetapi basis datanya tidak. */
const CIRI_BASIS_DATA = [
  "database",
  "postgres",
  "connection terminated",
  "password authentication failed",
  "too many clients",
  "relation ",
  "pool",
];

function kecilkan(galat: unknown): string {
  if (!galat) return "";
  if (typeof galat === "string") return galat.toLowerCase();
  if (galat instanceof Error) return String(galat.message || "").toLowerCase();
  if (typeof galat === "object") {
    const x = galat as { message?: unknown; error?: unknown; statusText?: unknown };
    for (const nilai of [x.message, x.statusText]) {
      if (typeof nilai === "string" && nilai) return nilai.toLowerCase();
    }
    if (x.error && typeof x.error === "object") {
      const pesan = (x.error as { message?: unknown }).message;
      if (typeof pesan === "string") return pesan.toLowerCase();
    }
  }
  return "";
}

function cocok(teks: string, ciri: string[]) {
  return ciri.some((c) => teks.includes(c));
}

export type JenisGangguan = "tidak-terjangkau" | "basis-data" | "peladen" | "bukan-gangguan";

/**
 * Menggolongkan kegagalan.
 *
 * @param status kode HTTP bila jawabannya sempat datang; 0 bila tidak sama
 *               sekali - dan tidak sama sekali itulah yang paling sering
 *               berarti basis datanya mati.
 */
export function jenisGangguan(galat: unknown, status = 0): JenisGangguan {
  const teks = kecilkan(galat);

  if (status === 503 || cocok(teks, CIRI_BASIS_DATA)) return "basis-data";
  if (cocok(teks, CIRI_TIDAK_TERJANGKAU)) return "tidak-terjangkau";
  if (status >= 500) return "peladen";
  return "bukan-gangguan";
}

/**
 * Kalimat untuk petugas.
 *
 * @param cadangan pesan yang dipakai bila ini BUKAN gangguan layanan - yaitu
 *                 kegagalan biasa seperti kata sandi yang keliru, yang memang
 *                 harus disampaikan apa adanya.
 */
export function pesanGangguan(
  galat: unknown,
  cadangan: string,
  status = 0,
  /**
   * "masuk" (bawaan) = halaman masuk, kalimatnya menenangkan soal kata sandi.
   * "data" = layar data (Jadwal Sidang, Jadwal Mediasi, Status Perkara) yang
   * mencoba lagi sendiri - kata sandi tidak disebut sama sekali.
   */
  konteks: "masuk" | "data" = "masuk"
): string {
  if (konteks === "data") {
    switch (jenisGangguan(galat, status)) {
      case "basis-data":
        return "Layanan data ALETA sedang tidak aktif sebentar. Data yang sudah tampil tetap dapat dibaca; ALETA akan mencoba memuat lagi sendiri.";
      case "tidak-terjangkau":
        return "Sambungan ke server ALETA sedang terputus - biasanya jaringan kantor atau server yang sedang dimulai ulang. Data yang sudah tampil tetap dapat dibaca; ALETA akan mencoba memuat lagi sendiri.";
      case "peladen":
        return "Server ALETA sedang sibuk atau dimulai ulang. Data yang sudah tampil tetap dapat dibaca; ALETA akan mencoba memuat lagi sendiri.";
      default:
        return cadangan;
    }
  }
  switch (jenisGangguan(galat, status)) {
    case "basis-data":
      return (
        "Layanan data ALETA sedang tidak aktif, jadi akun Anda belum dapat diperiksa. " +
        "Ini bukan karena kata sandi Anda salah - tidak perlu mencoba berulang kali. " +
        "Tunggu beberapa menit lalu coba lagi; bila tetap begini, hubungi petugas TI " +
        "atau administrator ALETA dan sebutkan jam kejadiannya."
      );
    case "tidak-terjangkau":
      return (
        "ALETA tidak dapat dihubungi dari komputer ini. Biasanya karena jaringan kantor " +
        "sedang terputus atau server ALETA sedang dimatikan sementara. " +
        "Ini bukan karena kata sandi Anda salah. Periksa sambungan jaringan Anda, " +
        "tunggu sebentar, lalu coba lagi - bila tetap begini, hubungi petugas TI."
      );
    case "peladen":
      return (
        "ALETA sedang mengalami gangguan di sisi server. Ini bukan karena kata sandi " +
        "Anda salah. Muat ulang halaman lalu coba lagi; bila tetap begini, hubungi " +
        "petugas TI dan sebutkan jam kejadiannya."
      );
    default:
      return cadangan;
  }
}

/** Apakah ini gangguan layanan, bukan kesalahan pengguna. */
export function adalahGangguan(galat: unknown, status = 0) {
  return jenisGangguan(galat, status) !== "bukan-gangguan";
}
