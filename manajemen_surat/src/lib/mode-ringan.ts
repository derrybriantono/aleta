/**
 * ============================================================================
 * MODE RINGAN UNTUK PC TUA (K16, rantai B, 25 Okt 2026)
 * ============================================================================
 *
 * SATU ATURAN, DUA SALINAN: ekstensi-sipp/mode-ringan.js (putuskan, terdeteksiTua)
 * memakai aturan yang sama; ekstensi-mode-ringan-25okt.test.ts mengadu keduanya
 * atas semua kombinasi.
 *
 *   pilihan "nyala"  -> ringan, apa pun deteksinya;
 *   pilihan "mati"   -> tidak ringan, apa pun deteksinya;
 *   pilihan "otomatis" (BAWAAN) -> ringan HANYA bila saklar Super Admin
 *       `modeRinganOtomatis` menyala DAN komputer terdeteksi tua
 *       (navigator.deviceMemory <= 4 atau navigator.hardwareConcurrency <= 2).
 *
 * Saklar Super Admin mati bawaan, jadi tanpa pilihan pengguna tidak ada yang berubah.
 */

export type PilihanModeRingan = "otomatis" | "nyala" | "mati";

export const PILIHAN_MODE_RINGAN: readonly PilihanModeRingan[] = ["otomatis", "nyala", "mati"];
/** Kunci localStorage portal (per peramban/PC; sengaja tidak ikut ke PC lain). */
export const KUNCI_MODE_RINGAN = "aleta-mode-ringan";
export const PERISTIWA_MODE_RINGAN = "aleta-mode-ringan-berubah";
export const ATRIBUT_MODE_RINGAN = "data-aleta-ringan";

export function bersihkanPilihanRingan(x: unknown): PilihanModeRingan {
  return PILIHAN_MODE_RINGAN.includes(x as PilihanModeRingan) ? (x as PilihanModeRingan) : "otomatis";
}

/** Memori <= 4 GB atau inti <= 2. Nilai yang tidak diketahui tidak dihitung tua. */
export function perangkatTua(nav: { deviceMemory?: unknown; hardwareConcurrency?: unknown } | null | undefined): boolean {
  const mem = Number(nav?.deviceMemory);
  const inti = Number(nav?.hardwareConcurrency);
  return (Number.isFinite(mem) && mem > 0 && mem <= 4) || (Number.isFinite(inti) && inti > 0 && inti <= 2);
}

export type SebabRingan = "pilihan-nyala" | "pilihan-mati" | "saklar-mati" | "terdeteksi-tua" | "bukan-tua";

export function putuskanModeRingan(p: { pilihan?: unknown; saklarOtomatis?: boolean; tua?: boolean }): { ringan: boolean; sebab: SebabRingan } {
  const pilihan = bersihkanPilihanRingan(p.pilihan);
  if (pilihan === "nyala") return { ringan: true, sebab: "pilihan-nyala" };
  if (pilihan === "mati") return { ringan: false, sebab: "pilihan-mati" };
  if (p.saklarOtomatis !== true) return { ringan: false, sebab: "saklar-mati" };
  return p.tua === true ? { ringan: true, sebab: "terdeteksi-tua" } : { ringan: false, sebab: "bukan-tua" };
}

export const KETERANGAN_SEBAB_RINGAN: Readonly<Record<SebabRingan, string>> = {
  "pilihan-nyala": "Dinyalakan atas pilihan Anda.",
  "pilihan-mati": "Dimatikan atas pilihan Anda.",
  "saklar-mati": "Otomatis belum dinyalakan Super Admin.",
  "terdeteksi-tua": "Komputer ini terdeteksi sederhana (memori 4 GB atau kurang, atau 2 inti), jadi hiasan dimatikan.",
  "bukan-tua": "Komputer ini cukup kuat, jadi tampilan penuh dipakai.",
};
