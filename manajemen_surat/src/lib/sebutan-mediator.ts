/**
 * ============================================================================
 * SEBUTAN MEDIATOR: MEDIATOR HAKIM ATAU MEDIATOR NON HAKIM
 * ============================================================================
 *
 * SIPP tidak menyimpan kata "hakim" untuk mediator. Ia menyimpan SANDI:
 *
 *   mediator.status_mediator           char(1)      rujukan: H profesi Hakim,
 *                                                   N profesi Mediator
 *   perkara_mediator.status_mediator   char(1)      satu baris per mediator
 *   perkara_mediasi.status_mediator    varchar(50)  sandi SELURUH mediator
 *                                                   perkara itu, dirangkai
 *                                                   koma, berurutan sama
 *                                                   dengan nama pada
 *                                                   mediator_text
 *
 * Terukur 27 Sep 2026 pada perkara_mediasi:
 *
 *   sipp_donggala    "H" 747   "H,H" 3   "N" 3   "" 1     (754 baris)
 *   sipp (Bungku)    "H" 574   "H,H" 1   NULL 1           (576 baris)
 *
 * Nama untuk "H,H" dirangkai <br/> di mediator_text, misalnya
 * "Mohamad Arif, S.Ag.,M.H.<br/>Mazidah, S.Ag., M.H." - dua hakim, satu sandi
 * untuk tiap nama.
 *
 * SIPP sendiri mengenal TIGA sandi (application/controllers/manage_mediator.php:
 * pilihan 1 -> 'N', 2 -> 'H', selainnya -> 'P'), dan laporan mediasinya
 * menghitung hakim dengan status_mediator='H' saja. 'P' belum pernah muncul di
 * kedua basis data terukur; menurut ketentuan di bawah ia Non Hakim.
 *
 * ============================================================================
 * CACAT YANG DIPERBAIKI
 * ============================================================================
 *
 * Layar Jadwal Mediasi dulu menggolongkan dengan /hakim/i atas sandi itu.
 * Huruf "H" tidak pernah memuat kata "hakim", sehingga SETIAP mediator hakim
 * terhitung "Mediator non-hakim" - chip saringan menulis 0 hakim dan 1
 * non-hakim untuk perkara yang statusnya jelas H - dan selnya menulis huruf
 * "H" mentah yang tidak berarti apa pun bagi pembacanya.
 *
 * Ketentuan pengguna, 27 Sep 2026: H = Mediator Hakim, selainnya = Mediator
 * Non Hakim. Aturan itu SAMA dengan SQL bot yang sudah lama berjalan
 * (notifikasi.js: CASE WHEN status_mediator = 'H' THEN 'H' ELSE 'NH'), jadi
 * layar dan rekap WhatsApp kini menggolongkan dengan cara yang sama.
 *
 * ============================================================================
 * KOSONG BUKAN NON HAKIM
 * ============================================================================
 *
 * Satu-satunya perbedaan dengan SQL bot di atas, dan disengaja: status yang
 * TIDAK DIISI tidak dijatuhkan ke Non Hakim. Kosong berarti petugas belum
 * mencatatnya, bukan keterangan bahwa mediatornya bukan hakim. Baris kosong
 * di sipp_donggala (perkara_id 9645) bernama "Akbar Ali, S.H.I" - dan tabel
 * rujukan mediator SIPP sendiri mencatat Akbar Ali berstatus H. Menyebutnya
 * "Mediator Non Hakim" menulis fakta yang keliru dan memasukkannya ke hitungan
 * non-hakim yang dilaporkan. Ia disebut "Status mediator belum tercatat",
 * supaya pembacanya tahu bahwa yang harus dilengkapi adalah SIPP.
 *
 * Pembantu ini dipakai bersama oleh layar Jadwal Mediasi dan Status Perkara;
 * jangan menulis pola hakim/non-hakim baru di tempat lain.
 */

/** Golongan satu mediator. */
export type GolonganMediator = "hakim" | "non-hakim" | "belum-tercatat";

/**
 * Golongan satu catatan mediasi, yang dapat bermediator lebih dari satu.
 * "campuran" = sekurangnya satu hakim DAN satu non-hakim - nol baris pada
 * kedua basis data terukur, tetapi sandi berangkai membuatnya mungkin.
 */
export type GolonganMediatorPerkara = GolonganMediator | "campuran";

/** Kata yang ditulis ke layar untuk tiap golongan. */
export const SEBUTAN_MEDIATOR: Readonly<Record<GolonganMediator, string>> = {
  hakim: "Mediator Hakim",
  "non-hakim": "Mediator Non Hakim",
  "belum-tercatat": "Status mediator belum tercatat",
};

/**
 * Bentuk yang dikenali sebagai HAKIM.
 *
 * Sandi SIPP-nya hanya "H". Bentuk kata ikut dikenali supaya pembantu ini
 * aman dipanggil atas keluarannya sendiri: tanpa itu, sebutanMediator(
 * sebutanMediator("H")) membaca "Mediator Hakim" sebagai sandi asing dan
 * membaliknya menjadi Non Hakim - kekeliruan yang tidak menimbulkan galat
 * apa pun. "HAKIM MEDIATOR" adalah bentuk yang pernah dipakai contoh data
 * aleta_bot/scripts/verify-jadwal-mediasi.js.
 */
const BENTUK_HAKIM = new Set(["H", "HAKIM", "MEDIATOR HAKIM", "HAKIM MEDIATOR"]);

/**
 * Bentuk yang berarti statusnya BELUM tercatat - termasuk tanda kosong yang
 * dipakai layar ("-", "—") dan sebutan belum-tercatat buatan pembantu ini
 * sendiri, dengan alasan yang sama seperti BENTUK_HAKIM.
 */
const BENTUK_BELUM_TERCATAT = new Set([
  "",
  "-",
  "—",
  "BELUM TERCATAT",
  "STATUS MEDIATOR BELUM TERCATAT",
]);

function bakukan(sandi: unknown): string {
  if (sandi === null || sandi === undefined) return "";
  return String(sandi).replace(/[\s_-]+/g, " ").trim().toUpperCase();
}

/**
 * Golongan SATU sandi - satu mediator.
 *
 * H (besar-kecil tidak dibedakan) = hakim; kosong = belum tercatat;
 * SELAIN ITU = non-hakim, sesuai ketentuan pengguna. Sandi asing seperti "NH"
 * atau "X" ikut Non Hakim, bukan dibuang, sebab ketentuannya "selainnya".
 */
export function golonganSatuMediator(sandi: unknown): GolonganMediator {
  const baku = bakukan(sandi);
  // "—" tidak ikut dibakukan menjadi spasi, jadi diperiksa pada bentuk
  // mentahnya juga.
  if (BENTUK_BELUM_TERCATAT.has(baku) || BENTUK_BELUM_TERCATAT.has(String(sandi ?? "").trim())) {
    return "belum-tercatat";
  }
  if (BENTUK_HAKIM.has(baku)) return "hakim";
  return "non-hakim";
}

/**
 * Golongan TIAP mediator dari sandi berangkai ("H", "H,H", "H,N").
 *
 * Kosong seluruhnya menghasilkan daftar kosong - tidak ada mediator yang
 * dapat disebut. Satu bagian kosong di dalam rangkaian ("H,") tetap dihitung
 * sebagai satu mediator yang statusnya belum tercatat, sebab rangkaian SIPP
 * sejajar dengan daftar namanya.
 */
export function golonganTiapMediator(status: unknown): GolonganMediator[] {
  const mentah = status === null || status === undefined ? "" : String(status);
  if (golonganSatuMediator(mentah) === "belum-tercatat") return [];
  return mentah.split(",").map((bagian) => golonganSatuMediator(bagian));
}

/** Golongan satu catatan mediasi - dipakai hitungan dan saringan. */
export function golonganMediator(status: unknown): GolonganMediatorPerkara {
  const tiap = golonganTiapMediator(status).filter((x) => x !== "belum-tercatat");
  if (tiap.length === 0) return "belum-tercatat";
  const unik = new Set(tiap);
  if (unik.size > 1) return "campuran";
  return tiap[0];
}

/** Adakah sekurangnya satu mediator hakim pada catatan ini. */
export function adaMediatorHakim(status: unknown): boolean {
  return golonganTiapMediator(status).includes("hakim");
}

/** Adakah sekurangnya satu mediator non-hakim pada catatan ini. */
export function adaMediatorNonHakim(status: unknown): boolean {
  return golonganTiapMediator(status).includes("non-hakim");
}

/** Statusnya tidak diisi sama sekali - bukan hakim, bukan pula non-hakim. */
export function statusMediatorBelumTercatat(status: unknown): boolean {
  return golonganMediator(status) === "belum-tercatat";
}

/**
 * Sebutan yang ditulis ke layar untuk satu catatan mediasi.
 *
 *   "H"      -> "Mediator Hakim"
 *   "N"      -> "Mediator Non Hakim"
 *   "H,H"    -> "Mediator Hakim"                       (tidak diulang)
 *   "H,N"    -> "Mediator Hakim, Mediator Non Hakim"
 *   "" / nul -> "Status mediator belum tercatat"
 *
 * Rangkaian campuran dipisah KOMA, bukan "dan": dengan begitu sebutan ini
 * dapat dibaca ulang oleh golonganTiapMediator tanpa kehilangan satu pun
 * golongannya.
 */
export function sebutanMediator(status: unknown): string {
  const tiap = golonganTiapMediator(status).filter((x) => x !== "belum-tercatat");
  if (tiap.length === 0) return SEBUTAN_MEDIATOR["belum-tercatat"];
  return [...new Set(tiap)].map((golongan) => SEBUTAN_MEDIATOR[golongan]).join(", ");
}

/** Satu mediator beserta sebutannya. */
export type MediatorBersebutan = {
  nama: string;
  golongan: GolonganMediator;
  sebutan: string;
};

/**
 * Nama mediator dari mediator_text, tanpa pemisah HTML-nya.
 *
 * SIPP merangkai beberapa mediator dengan <br/> - disalin apa adanya oleh
 * bot, sehingga tanpa pemecahan ini layar menulis tanda "<br/>" mentah di
 * tengah nama.
 */
export function namaTiapMediator(namaTeks: unknown): string[] {
  const mentah = namaTeks === null || namaTeks === undefined ? "" : String(namaTeks);
  return mentah
    .split(/<br\s*\/?>|\r?\n/i)
    .map((nama) => nama.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

/**
 * Tiap mediator berpasangan dengan sandinya sendiri.
 *
 * Nama ke-n berpasangan dengan sandi ke-n, sebab begitulah SIPP merangkai
 * keduanya. Sandi yang kurang TIDAK dipinjam dari mediator lain - dua nama
 * dengan satu sandi "H" berarti status mediator kedua belum tercatat, bukan
 * ikut hakim.
 */
export function daftarMediator(namaTeks: unknown, status: unknown): MediatorBersebutan[] {
  const nama = namaTiapMediator(namaTeks);
  const golongan = golonganTiapMediator(status);
  const jumlah = Math.max(nama.length, golongan.length);
  const hasil: MediatorBersebutan[] = [];
  for (let i = 0; i < jumlah; i += 1) {
    const g = golongan[i] ?? "belum-tercatat";
    hasil.push({ nama: nama[i] ?? "", golongan: g, sebutan: SEBUTAN_MEDIATOR[g] });
  }
  return hasil;
}
