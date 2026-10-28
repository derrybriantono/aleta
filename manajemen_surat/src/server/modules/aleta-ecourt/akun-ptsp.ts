/**
 * Pembaca akun PTSP untuk pemilih "Lihat sebagai" (28 Okt 2026). Aturan memilih ada di lib/akun-ptsp.ts (murni);
 * di sini hanya membaca akun ALETA. Gagal-terbuka: akun tak terbaca = pemilih tanpa kelompok PTSP, bukan galat.
 */
import { namaAkunPtsp } from "@/lib/akun-ptsp";
import type { AletaDatabase } from "@/server/db/client";
import { getUsersFromDb } from "@/server/modules/organization/service";

export async function bacaAkunPtsp(db: AletaDatabase): Promise<string[]> {
  try {
    return namaAkunPtsp(await getUsersFromDb(db));
  } catch {
    return [];
  }
}
