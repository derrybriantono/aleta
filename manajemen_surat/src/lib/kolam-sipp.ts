/**
 * Pengaturan kolam sambungan SIPP di bot (K3, rantai F1, 25 Okt 2026).
 *
 * Kembaran dari aleta_bot/services/kolamSippService.js (rapikan/RENTANG); uji
 * kolam-sipp-25okt memastikan keduanya menghasilkan nilai yang sama.
 * BAWAAN = perilaku sebelum fitur ini: satu kolam 10 sambungan, tanpa batas tunggu,
 * tanpa batas antrean, kueri lambat tidak diputus di server.
 */
export type KolamSippSetelan = {
  /** Layar (portal) memakai kolam sendiri, terpisah dari kerja latar (WhatsApp, cron, penilaian). */
  terpisah: boolean;
  /** Ukuran kolam utama (satu-satunya kolam bila `terpisah` mati; kolam latar bila menyala). */
  batas: number;
  /** Ukuran kolam layar; hanya dipakai saat `terpisah` menyala. */
  batasInteraktif: number;
  /** Menunggu sambungan paling lama (milidetik); 0 = menunggu tanpa batas seperti dulu. */
  antreMaksMs: number;
  /** Antrean paling banyak; 0 = tanpa batas seperti dulu. */
  antreanMaks: number;
  /** Kueri yang melewati batas waktu dihentikan juga di server (KILL QUERY). */
  putusKueriLambat: boolean;
};

export const KOLAM_SIPP_RENTANG = {
  batas: { min: 1, maks: 50 },
  batasInteraktif: { min: 1, maks: 50 },
  antreMaksMs: { min: 0, maks: 60000 },
  antreanMaks: { min: 0, maks: 5000 },
} as const;

export const KOLAM_SIPP_BAWAAN: KolamSippSetelan = {
  terpisah: false,
  batas: 10,
  batasInteraktif: 10,
  antreMaksMs: 0,
  antreanMaks: 0,
  putusKueriLambat: false,
};

function angka(nilai: unknown, bawaan: number, rentang: { min: number; maks: number }): number {
  const n = Number(nilai);
  if (nilai === undefined || nilai === null || nilai === "" || !Number.isFinite(n)) return bawaan;
  return Math.max(rentang.min, Math.min(rentang.maks, Math.round(n)));
}

/** Masukan apa pun -> setelan sah. Yang tidak disebut memakai `dasar` (bawaan bila kosong). */
export function rapikanKolamSipp(masukan: unknown, dasar: KolamSippSetelan = KOLAM_SIPP_BAWAAN): KolamSippSetelan {
  const x = masukan && typeof masukan === "object" ? (masukan as Record<string, unknown>) : {};
  return {
    terpisah: typeof x.terpisah === "boolean" ? x.terpisah : dasar.terpisah,
    batas: angka(x.batas, dasar.batas, KOLAM_SIPP_RENTANG.batas),
    batasInteraktif: angka(x.batasInteraktif, dasar.batasInteraktif, KOLAM_SIPP_RENTANG.batasInteraktif),
    antreMaksMs: angka(x.antreMaksMs, dasar.antreMaksMs, KOLAM_SIPP_RENTANG.antreMaksMs),
    antreanMaks: angka(x.antreanMaks, dasar.antreanMaks, KOLAM_SIPP_RENTANG.antreanMaks),
    putusKueriLambat: typeof x.putusKueriLambat === "boolean" ? x.putusKueriLambat : dasar.putusKueriLambat,
  };
}

/** Jumlah sambungan terbanyak yang dapat dibuka bot ke SIPP dengan setelan ini. */
export function totalSambunganMaks(s: KolamSippSetelan): number {
  return s.terpisah ? s.batas + s.batasInteraktif : s.batas;
}

/**
 * Peringatan bagi Super Admin. `maxConnections` = nilai max_connections MariaDB SIPP
 * (diukur di server); kosong bila belum diukur.
 */
export function peringatanKolamSipp(s: KolamSippSetelan, maxConnections?: number | null): string[] {
  const hasil: string[] = [];
  const total = totalSambunganMaks(s);
  if (maxConnections && maxConnections > 0) {
    // SIPP dan ABT sendiri, phpMyAdmin, dan Navicat memakai sambungan dari batas yang sama.
    const sisa = Math.floor(maxConnections * 0.5);
    if (total > sisa) {
      hasil.push(
        `Total sambungan bot (${total}) lebih dari separuh batas SIPP (${maxConnections}). SIPP dan ABT sendiri perlu sisanya.`
      );
    }
  }
  if (s.antreanMaks > 0 && s.antreanMaks < 5) {
    hasil.push("Antrean di bawah 5 membuat layar sering ditolak saat ramai.");
  }
  if (s.antreMaksMs > 0 && s.antreMaksMs < 1000) {
    hasil.push("Batas tunggu di bawah 1 detik terlalu pendek; layar akan gagal bahkan saat SIPP sehat.");
  }
  return hasil;
}
