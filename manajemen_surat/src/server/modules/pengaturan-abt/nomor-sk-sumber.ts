import { DAFTAR_NOMOR_SK, bersihkanPengaturanNomorSk, nomorSkBawaan, type PengaturanNomorSk } from "@/lib/nomor-sk";
import type { AletaDatabase } from "@/server/db/client";

/**
 * SUMBER TUNGGAL nomor dan tanggal SK penunjukan (17 Okt 2026) - aleta_ekstensi_setelan
 * (tanpa migrasi), pengguna_id PENGGUNA_SISTEM, kunci KUNCI_NOMOR_SK. Belum pernah
 * disimpan = nilai bawaan (SK yang berlaku sekarang, lib/nomor-sk.ts).
 *
 * Dipisah dari nomor-sk.ts (yang menarik pemanggilan bot) supaya panel penunjukan
 * majelis (aleta-ecourt/penunjukan-pengaturan.ts) membaca dari tempat yang SAMA
 * tanpa ikut menarik layanan Pengaturan SIPP & ABT.
 */

export const KUNCI_NOMOR_SK = "sistem:nomor-sk";
/** Sama dengan PENGGUNA_SISTEM modul setelan lain (tidak diimpor: modul itu menarik penyapu KTP). */
export const PENGGUNA_SISTEM = "*sistem*";

export type SimpananNomorSk = { nilai: PengaturanNomorSk; diubahOleh: string; diubahPada: string };

export async function bacaSimpananNomorSk(db: AletaDatabase): Promise<SimpananNomorSk | null> {
  try {
    const b = await db.queryOne<{ nilai: string }>("SELECT nilai FROM aleta_ekstensi_setelan WHERE pengguna_id = ? AND kunci = ?", [PENGGUNA_SISTEM, KUNCI_NOMOR_SK]);
    if (!b) return null;
    const mentah = JSON.parse(String(b.nilai)) as { nilai?: Record<string, { nomor?: unknown; tanggal?: unknown }>; diubahOleh?: unknown; diubahPada?: unknown };
    // Simpanan lama tanpa tanggal: tanggal bawaan dipakai sampai disimpan ulang.
    const isi: Record<string, unknown> = {};
    for (const butir of DAFTAR_NOMOR_SK) {
      const x = mentah.nilai?.[butir.kunci];
      if (x) isi[butir.kunci] = { nomor: x.nomor, tanggal: x.tanggal || butir.bawaanTanggal };
    }
    return {
      nilai: bersihkanPengaturanNomorSk(isi, nomorSkBawaan()),
      diubahOleh: String(mentah.diubahOleh ?? ""),
      diubahPada: String(mentah.diubahPada ?? ""),
    };
  } catch {
    return null;
  }
}

export async function bacaNomorSkAleta(db: AletaDatabase) {
  const s = await bacaSimpananNomorSk(db);
  return { nilai: s?.nilai ?? nomorSkBawaan(), tersimpan: Boolean(s), diubahOleh: s?.diubahOleh ?? "", diubahPada: s?.diubahPada ?? "" };
}

/** Nomor dan tanggal (ISO) SK susunan majelis yang berlaku - dipakai panel penunjukan dan kartu SK majelis. */
export async function bacaSkMajelis(db: AletaDatabase): Promise<{ nomor: string; tanggal: string }> {
  const { nilai } = await bacaNomorSkAleta(db);
  return nilai.majelis;
}
