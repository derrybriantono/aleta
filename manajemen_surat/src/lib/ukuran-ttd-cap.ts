/**
 * UKURAN TANDA TANGAN DAN CAP - SATU SET UNTUK SEMUA DOKUMEN (20 Okt 2026).
 *
 * Dipakai e-Doc penetapan (bot), ekstensi ("Tambah tanda tangan ke PDF") dan
 * PDF salinan putusan (bot) supaya ukurannya SAMA. Nilai bawaan adalah cermin
 * UKURAN_TTD_CAP di aleta_bot/services/penetapanEdocService.js (dijaga uji
 * ttd-cap-sisa-20okt.test.ts): tanda tangan 64 mm menimpa +-1/3 atas nama,
 * cap berdiameter TETAP 36 mm menindih sisi kiri tanda tangan.
 *
 * Murni (tanpa basis data) - dipakai layar, rute, dan uji.
 */

export const UKURAN_TTD_CAP_BAWAAN = Object.freeze({
  lebarTtdMm: 64,
  /** Tanda tangan turun ke arah nama (mm); bawahnya menimpa +-1/3 atas baris nama. */
  ttdTurunMm: 3,
  diameterCapMm: 36,
  /** Pusat cap di kiri pusat tanda tangan (mm). */
  capGeserKiriMm: 13,
  /** Pusat cap di atas pusat tanda tangan (mm). */
  capGeserAtasMm: 4,
  /** Keburaman cap: tanda tangan di bawahnya tetap terlihat. */
  opasitasCap: 0.88,
});

/** Tinggi maksimum tanda tangan pada lebar bawaan (mm). */
export const TINGGI_TTD_MAKS_BAWAAN_MM = 35;

export type UkuranTtdCap = {
  lebarTtdMm: number;
  ttdTurunMm: number;
  diameterCapMm: number;
  capGeserKiriMm: number;
  capGeserAtasMm: number;
  opasitasCap: number;
};
export type KunciUkuranTtdCap = keyof UkuranTtdCap;

export const BATAS_UKURAN_TTD_CAP: Record<KunciUkuranTtdCap, { min: number; max: number; sebutan: string; satuan: string }> = {
  lebarTtdMm: { min: 20, max: 90, sebutan: "Lebar tanda tangan", satuan: "mm" },
  ttdTurunMm: { min: -10, max: 20, sebutan: "Tanda tangan turun mendekati nama", satuan: "mm" },
  diameterCapMm: { min: 20, max: 60, sebutan: "Diameter cap", satuan: "mm" },
  capGeserKiriMm: { min: -40, max: 40, sebutan: "Pusat cap di kiri pusat tanda tangan", satuan: "mm" },
  capGeserAtasMm: { min: -40, max: 40, sebutan: "Pusat cap di atas pusat tanda tangan", satuan: "mm" },
  opasitasCap: { min: 0.3, max: 1, sebutan: "Keburaman cap", satuan: "" },
};

export const KUNCI_UKURAN_TTD_CAP = Object.keys(BATAS_UKURAN_TTD_CAP) as KunciUkuranTtdCap[];

export class GalatUkuranTtdCap extends Error {}

/** Tinggi maksimum tanda tangan mengikuti lebarnya (perbandingan bawaan 64:35). */
export function tinggiTtdMaksMm(lebarTtdMm: number): number {
  return Math.round(((lebarTtdMm * TINGGI_TTD_MAKS_BAWAAN_MM) / UKURAN_TTD_CAP_BAWAAN.lebarTtdMm) * 10) / 10;
}

/** Menggabungkan masukan yang disaring ke `dasar`; di luar batas ditolak (bukan dipotong). */
export function bersihkanUkuranTtdCap(masukan: unknown, dasar: UkuranTtdCap = { ...UKURAN_TTD_CAP_BAWAAN }): UkuranTtdCap {
  const m = (masukan && typeof masukan === "object" ? masukan : {}) as Record<string, unknown>;
  const hasil: UkuranTtdCap = { ...dasar };
  for (const k of KUNCI_UKURAN_TTD_CAP) {
    if (m[k] === undefined || m[k] === null || m[k] === "") continue;
    const b = BATAS_UKURAN_TTD_CAP[k];
    const n = Number(m[k]);
    if (!Number.isFinite(n) || n < b.min || n > b.max) {
      throw new GalatUkuranTtdCap(`${b.sebutan} harus angka ${b.min} sampai ${b.max}${b.satuan ? ` ${b.satuan}` : ""}.`);
    }
    hasil[k] = k === "opasitasCap" ? Math.round(n * 100) / 100 : Math.round(n * 10) / 10;
  }
  return hasil;
}

/** Bentuk yang dipahami bot (aturBerlaku penetapanEdocService / salinan putusan). */
export function ukuranUntukBot(u: UkuranTtdCap) {
  return {
    lebarTtdMm: u.lebarTtdMm,
    tinggiTtdMaksMm: tinggiTtdMaksMm(u.lebarTtdMm),
    ttdTurunMm: u.ttdTurunMm,
    lebarCapMm: u.diameterCapMm,
    capGeserKiriMm: u.capGeserKiriMm,
    capGeserAtasMm: u.capGeserAtasMm,
    opasitasCap: u.opasitasCap,
  };
}

/** Ukuran lama (Peta penetapan per jenis) yang lebih kecil dari bawaan baru? */
export function ukuranLebihKecilDariBawaan(lebarTtdMm: number, lebarCapMm: number): boolean {
  return lebarTtdMm < UKURAN_TTD_CAP_BAWAAN.lebarTtdMm || lebarCapMm < UKURAN_TTD_CAP_BAWAAN.diameterCapMm;
}

/** Sama dengan bawaan? (tidak dianggap "tersimpan khusus") */
export function samaDenganBawaan(u: UkuranTtdCap): boolean {
  return KUNCI_UKURAN_TTD_CAP.every((k) => u[k] === UKURAN_TTD_CAP_BAWAAN[k]);
}

/**
 * Geometri pratinjau (mm, asal = sudut kiri-atas baris nama): kotak tanda tangan
 * (tingginya ikut perbandingan 2:1 gambar contoh, dibatasi tinggi maks) dan
 * lingkaran cap. Dipakai kartu ukuran; diuji agar sama dengan aturan bot.
 */
export function geometriPratinjau(u: UkuranTtdCap, perbandinganTtd = 2) {
  let lebar = u.lebarTtdMm;
  let tinggi = lebar / perbandinganTtd;
  const maks = tinggiTtdMaksMm(u.lebarTtdMm);
  if (tinggi > maks) {
    lebar = (lebar * maks) / tinggi;
    tinggi = maks;
  }
  const atas = -tinggi + u.ttdTurunMm;
  const pusatCapX = lebar / 2 - u.capGeserKiriMm;
  const pusatCapY = atas + tinggi / 2 - u.capGeserAtasMm;
  return {
    ttd: { kiri: 0, atas, lebar, tinggi },
    cap: { pusatX: pusatCapX, pusatY: pusatCapY, diameter: u.diameterCapMm },
  };
}
