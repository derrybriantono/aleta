/**
 * ============================================================================
 * SIPP DENGAN IDE ALETA - GELOMBANG 1 (Tahap L2, 16 Okt 2026): PENANDA PER PERAN
 * ============================================================================
 *
 * Aturan penanda dan teksnya ada di bot (aleta_bot/services/sippIdeL2Service.js).
 * Yang diputuskan di sini hanya SIAPA melihat penanda apa - menurut golongan
 * popup (lib/golongan-popup.ts), satu aturan dengan popup ekstensi. Super Admin
 * dan Admin melihat semuanya; golongan lain hanya yang berguna bagi tugasnya.
 *
 * Tiap kode punya saklar sendiri di popup ekstensi - kunci boolean datar di
 * chrome.storage.local (KUNCI_SAKLAR_IDE_L2). Salinan tabel kunci & peran ada di
 * ekstensi-sipp/popup-ide-l2.js; keduanya dijaga sama oleh uji sipp-ide-l2.
 */
import type { KodeGolonganPopup } from "@/lib/golongan-popup";

export const KODE_IDE_L2 = [
  "sita",
  "eksekusi",
  "izin-cerai",
  "penetapan-awal",
  "belum-ditunda",
  "potensi-verstek",
  "umur-perkara",
  "tanpa-sidang-berikut",
  "sisa-ikrar",
  "akta-cerai",
  "lewat-5-bulan",
  "ecourt-verifikasi",
] as const;
export type KodeIdeL2 = (typeof KODE_IDE_L2)[number];

/** Kunci chrome.storage.local tiap saklar (boolean; tak ada = menyala). */
export const KUNCI_SAKLAR_IDE_L2: Record<KodeIdeL2, string> = {
  sita: "ideL2Sita",
  eksekusi: "ideL2Eksekusi",
  "izin-cerai": "ideL2IzinCerai",
  "penetapan-awal": "ideL2Penetapan",
  "belum-ditunda": "ideL2BelumDitunda",
  "potensi-verstek": "ideL2Verstek",
  "umur-perkara": "ideL2Umur",
  "tanpa-sidang-berikut": "ideL2TanpaSidang",
  "sisa-ikrar": "ideL2Ikrar",
  "akta-cerai": "ideL2AktaCerai",
  "lewat-5-bulan": "ideL2LimaBulan",
  "ecourt-verifikasi": "ideL2EcourtVerifikasi",
};

type Golongan = Exclude<KodeGolonganPopup, "super-admin" | "admin">;

/** Golongan (selain Super Admin/Admin) yang melihat tiap penanda. */
export const PERAN_IDE_L2: Record<KodeIdeL2, readonly Golongan[]> = {
  sita: ["ketua", "hakim", "panitera-pengganti", "juru-sita", "panitera"],
  eksekusi: ["ketua", "hakim", "panitera-pengganti", "juru-sita", "panitera"],
  "izin-cerai": ["ketua", "hakim", "panitera-pengganti", "panitera"],
  "penetapan-awal": ["ketua", "panitera", "panitera-pengganti"],
  "belum-ditunda": ["ketua", "hakim", "panitera-pengganti", "panitera"],
  "potensi-verstek": ["ketua", "hakim", "panitera-pengganti"],
  "umur-perkara": ["ketua", "hakim", "panitera-pengganti", "panitera"],
  "tanpa-sidang-berikut": ["ketua", "hakim", "panitera-pengganti", "panitera"],
  "sisa-ikrar": ["ketua", "hakim", "panitera-pengganti", "panitera"],
  "akta-cerai": ["ketua", "panitera", "panitera-pengganti", "ptsp"],
  "lewat-5-bulan": ["ketua"],
  "ecourt-verifikasi": ["ketua", "hakim", "panitera-pengganti"],
};

/** Kode yang boleh dilihat pemilik golongan-golongan ini. */
export function kodeIdeL2UntukGolongan(semua: readonly KodeGolonganPopup[]): KodeIdeL2[] {
  if (semua.some((g) => g === "super-admin" || g === "admin")) return [...KODE_IDE_L2];
  return KODE_IDE_L2.filter((kode) => semua.some((g) => (PERAN_IDE_L2[kode] as readonly string[]).includes(g)));
}

type PenandaMentah = { kode: string };

/** Menyaring jawaban bot: hanya kode yang dikenal DAN boleh dilihat golongan ini. */
export function saringPenandaIdeL2<T extends PenandaMentah>(
  perkara: Record<string, { perkaraId: number; penanda: T[] }>,
  boleh: readonly KodeIdeL2[]
): Record<string, { perkaraId: number; penanda: T[] }> {
  const izin = new Set<string>(boleh);
  const hasil: Record<string, { perkaraId: number; penanda: T[] }> = {};
  for (const [nomor, isi] of Object.entries(perkara || {})) {
    hasil[nomor] = {
      perkaraId: Number(isi?.perkaraId) || 0,
      penanda: (Array.isArray(isi?.penanda) ? isi.penanda : []).filter((p) => izin.has(String(p?.kode))),
    };
  }
  return hasil;
}

/** Nomor perkara dari peramban: dibersihkan, unik, paling banyak 100. */
export function bersihkanNomorIdeL2(masuk: unknown): string[] {
  const daftar = Array.isArray(masuk) ? masuk : [];
  const pola = /^\d{1,5}\/[A-Za-z.]{1,16}\/\d{4}\/[A-Za-z.]{2,12}$/;
  const hasil: string[] = [];
  for (const x of daftar) {
    const t = String(x ?? "").trim().slice(0, 60);
    if (pola.test(t) && !hasil.includes(t)) hasil.push(t);
    if (hasil.length >= 100) break;
  }
  return hasil;
}
