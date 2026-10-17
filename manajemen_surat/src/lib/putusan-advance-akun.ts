import { namaCocokSatu } from "@/lib/perkara-sendiri";

/**
 * ============================================================================
 * PUTUSAN ADVANCE PER AKUN (keputusan pengguna 17 Okt 2026)
 * ============================================================================
 *
 * Super Admin/Admin memilih akun yang BOLEH memakai Putusan Advance di
 * Pengaturan SIPP & ABT. Akun lain masih memakai ABT seperti biasa. Bawaan
 * (belum pernah disimpan): HANYA hakim Derry Briantono yang menyala.
 *
 * Saklar ini syarat TAMBAHAN: hak lama (hakim, konseptor perkara itu,
 * Super Admin/Admin - hakPutusanAdvance) tetap diperiksa sesudahnya.
 * Super Admin/Admin pun harus dinyalakan bila ingin memakainya sendiri.
 */

export const NAMA_BAWAAN_ADVANCE = "Derry Briantono";

export const PESAN_ADVANCE_MATI = "Putusan Advance belum diaktifkan untuk akun Anda - hubungi admin.";

export type PengaturanAdvanceAkun = {
  /** id akun ALETA yang menyala. */
  akun: string[];
  diubahOleh: string;
  diubahPada: string;
};

export const BATAS_AKUN_ADVANCE = 300;

const teks = (x: unknown) => String(x ?? "").trim();

/** Bentuk tersimpan yang sah, atau null. */
export function bersihkanPengaturanAdvance(x: unknown): PengaturanAdvanceAkun | null {
  if (!x || typeof x !== "object" || Array.isArray(x)) return null;
  const o = x as Record<string, unknown>;
  if (!Array.isArray(o.akun)) return null;
  const akun = [...new Set(o.akun.map(teks).filter((id) => /^[\w.:@-]{1,80}$/.test(id)))].slice(0, BATAS_AKUN_ADVANCE);
  return { akun, diubahOleh: teks(o.diubahOleh).slice(0, 200), diubahPada: teks(o.diubahPada).slice(0, 40) };
}

/** Akun ini menyala? Belum pernah disimpan = hanya Derry Briantono (cocok nama). */
export function advanceMenyala(
  pengaturan: PengaturanAdvanceAkun | null | undefined,
  akun: { id?: unknown; name?: unknown } | null | undefined
): boolean {
  if (!akun) return false;
  if (!pengaturan) return namaCocokSatu(teks(akun.name), NAMA_BAWAAN_ADVANCE);
  return pengaturan.akun.includes(teks(akun.id));
}
