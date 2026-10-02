/**
 * ============================================================================
 * TANDA ANTRIAN ONLINE DI JADWAL SIDANG (perbaikan 2 Okt 2026 sore, butir 4)
 * ============================================================================
 *
 * Diminta pengguna: baris Jadwal Sidang diberi ikon bila pihaknya mengambil
 * nomor lewat ANTRIAN ONLINE, bukan di loket/anjungan ruang tunggu.
 *
 * ----------------------------------------------------------------------------
 * SUMBERNYA SATU, DAN HANYA ITU YANG DIPAKAI
 * ----------------------------------------------------------------------------
 *
 * Kolom `online` pada sipp_turunan_antrian.antrian_sidang - dibaca bot
 * (antrianSidangService.petaAntrian -> `online: Number(a.online) === 1`) dan,
 * untuk hari lampau, dari rekaman antrian ALETA yang menyimpan nilai yang sama
 * (lib/rekam-antrian.ts, `online`).
 *
 * Siapa yang menulisnya (diukur dari kodenya, bukan dikira):
 *   - bot WhatsApp ("daftar antrian#..." / "antrian online#..." / "ambil
 *     antrian") -> antrianOnlineService.registerOnlineQueue: `SET a.online = 1`
 *     dan mengisi kolom waktu SISI pengirimnya (pihak_1 / pihak_2) bila masih
 *     kosong;
 *   - pendaftaran baris oleh ALETA (antrianSinkronService) menulis 0;
 *   - layar sentuh ruang tunggu (/api/antrian-publik) dan meja pelayanan
 *     (/api/aleta-ecourt/antrian-ambil) TIDAK menyentuh `online` sama sekali.
 *
 * ----------------------------------------------------------------------------
 * YANG TIDAK PASTI TIDAK DITEBAK
 * ----------------------------------------------------------------------------
 *
 * `online` ditulis per BARIS sidang, bukan per pihak. Bila hanya satu sisi
 * yang punya jam ambil, sisi itulah yang mengambil (bot WhatsApp selalu
 * mengisi jam sisinya sendiri). Bila KEDUA sisi punya jam, sumbernya tidak
 * mencatat sisi mana yang lewat online - keterangannya menyebut keduanya dan
 * mengatakan tidak diketahui, tidak memilih salah satu.
 *
 * Hari lampau dari rekaman ALETA tidak membawa jam per sisi; yang ada hanya
 * jam ambil terawal, dan disebut sebagai itu.
 *
 * Tanpa `online === true` tidak ada tanda. NULL (keadaan seluruh baris di PA
 * Donggala sampai catatan di aleta-ecourt-sidang.tsx ditulis) dan 0 sama-sama
 * berarti "tidak diketahui online", bukan "pasti di loket" - karena itu yang
 * ditandai hanya yang online, dan tidak ada tanda "loket".
 */

/** Bagian baris antrian yang dibaca tanda ini - cocok dengan AntrianBaris layar. */
export type AntrianUntukTandaOnline = {
  online?: boolean | null;
  pihak1?: string | null;
  pihak2?: string | null;
  waktuAmbil?: string | null;
};

export type TandaAntrianOnline = {
  /** Sisi yang mengambil lewat online bila PASTI; "" bila tidak diketahui. */
  sisi: "P" | "T" | "";
  /** Jam ambil yang dapat disebut ("" bila tidak ada atau tidak pasti sisinya). */
  jam: string;
  /** Kalimat untuk title / aria-label - selalu memuat "diambil lewat antrian online". */
  keterangan: string;
};

/** Frasa yang diminta pengguna - dipakai di tiap keterangan, dijaga uji. */
export const FRASA_ANTRIAN_ONLINE = "diambil lewat antrian online";

function teks(nilai: unknown): string {
  return typeof nilai === "string" ? nilai.trim() : "";
}

/**
 * Tanda antrian online untuk satu baris antrian, atau null bila tidak online.
 *
 * Murni - tanpa React, tanpa jam peramban - supaya aturannya diuji langsung.
 */
export function tandaAntrianOnline(
  antrian: AntrianUntukTandaOnline | null | undefined
): TandaAntrianOnline | null {
  if (!antrian || antrian.online !== true) return null;

  const p1 = teks(antrian.pihak1);
  const p2 = teks(antrian.pihak2);
  const awal = teks(antrian.waktuAmbil);
  const dasar = `Nomor antrian ${FRASA_ANTRIAN_ONLINE}, bukan di loket/anjungan ruang tunggu`;

  if (p1 && !p2) {
    return {
      sisi: "P",
      jam: p1,
      keterangan: `${dasar} - penggugat/pemohon, pukul ${p1}.`,
    };
  }
  if (p2 && !p1) {
    return {
      sisi: "T",
      jam: p2,
      keterangan: `${dasar} - tergugat/termohon, pukul ${p2}.`,
    };
  }
  if (p1 && p2) {
    return {
      sisi: "",
      jam: "",
      keterangan:
        `Antrian ${FRASA_ANTRIAN_ONLINE} oleh sekurangnya satu pihak (P pukul ${p1}, T pukul ${p2}). ` +
        "Sumber antrian mencatat online per sidang, bukan per pihak - pihak yang mana tidak diketahui.",
    };
  }
  if (awal) {
    return {
      sisi: "",
      jam: awal,
      keterangan: `${dasar} - jam ambil terawal ${awal}.`,
    };
  }
  return { sisi: "", jam: "", keterangan: `${dasar}.` };
}
