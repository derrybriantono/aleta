/**
 * ============================================================================
 * JAM PENGADILAN - WITA, BUKAN ZONA PERAMBAN
 * ============================================================================
 *
 * Diminta pengguna 24 September 2026: sesudah pukul 15:00:00, sidang yang
 * hasilnya belum dicatat masuk "Perlu diperiksa". Pukulnya diukur menurut
 * zona pengadilan (Asia/Makassar, UTC+8 tanpa musim panas), bukan zona yang
 * kebetulan disetel di komputer yang membuka layar: komputer berzona WIB akan
 * menyalakannya pukul 16:00 WITA, dan peladen yang berjam UTC - tempat React
 * melukis halaman pertama - pukul 23:00.
 *
 * Yang diambil dari peramban hanya DETIKNYA (Date.now); zonanya dari Intl,
 * yang membawa basis data zonanya sendiri.
 */
export const ZONA_PENGADILAN = "Asia/Makassar";

/** Batas yang disebut pengguna, apa adanya. Dibandingkan sebagai teks "HH:MM:SS". */
export const JAM_BATAS_HASIL_SIDANG = "15:00:00";

export type SaatPengadilan = {
  /** YYYY-MM-DD menurut WITA; kosong sebelum jam peramban terbaca. */
  tanggal: string;
  /** Sudah pukul JAM_BATAS_HASIL_SIDANG atau lewat, pada tanggal di atas. */
  lewatBatas: boolean;
};

/**
 * Keadaan sebelum jam peramban dibaca - lukisan peladen dan lukisan pertama
 * peramban. Tanggal kosong membuat aturan berjam tidak menyala sama sekali:
 * gagal-tertutup, sama seperti jalur penilaian lain di ALETA.
 */
export const SAAT_BELUM_TERBACA: SaatPengadilan = { tanggal: "", lewatBatas: false };

// hourCycle h23, bukan hour12:false - yang terakhir pada sebagian mesin
// menulis tengah malam sebagai "24:00:00", dan "24" >= "15" menyalakan
// aturannya sepanjang jam pertama hari baru.
const PENGURAI = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONA_PENGADILAN,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

/** Tanggal dan jam WITA dari satu saat. */
export function waktuPengadilan(kini: Date = new Date()): { tanggal: string; jam: string } {
  const bagian = PENGURAI.formatToParts(kini);
  const ambil = (jenis: Intl.DateTimeFormatPartTypes) =>
    bagian.find((x) => x.type === jenis)?.value ?? "00";
  return {
    tanggal: `${ambil("year")}-${ambil("month")}-${ambil("day")}`,
    jam: `${ambil("hour")}:${ambil("minute")}:${ambil("second")}`,
  };
}

export function saatPengadilan(kini: Date = new Date()): SaatPengadilan {
  const { tanggal, jam } = waktuPengadilan(kini);
  return { tanggal, lewatBatas: jam >= JAM_BATAS_HASIL_SIDANG };
}

const detikDari = (jam: string) => {
  const [j, m, d] = jam.split(":").map(Number);
  return (j || 0) * 3600 + (m || 0) * 60 + (d || 0);
};

/**
 * Milidetik sampai batas berikutnya - 15:00:00 atau tengah malam WITA -
 * ditambah seperempat detik supaya pembacaan berikutnya jatuh SESUDAH detik
 * batasnya. Paling lama semenit: jam yang digeser, laptop yang tidur, dan
 * pengatur waktu yang diperlambat peramban dikoreksi sendiri tiap menit.
 */
export function jedaKeBatasBerikut(kini: Date = new Date()): number {
  const sekarang = detikDari(waktuPengadilan(kini).jam);
  const batas = detikDari(JAM_BATAS_HASIL_SIDANG);
  const sisaDetik = sekarang < batas ? batas - sekarang : 86_400 - sekarang;
  const jeda = sisaDetik * 1000 - kini.getMilliseconds() + 250;
  return Math.max(250, Math.min(jeda, 60_000));
}
