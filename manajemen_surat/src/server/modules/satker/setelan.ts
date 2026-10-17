import type { AletaDatabase } from "@/server/db/client";

/**
 * Penyimpanan pengaturan tingkat satker: baris aleta_ekstensi_setelan milik
 * pengguna sistem (pola Putusan Advance per akun, tanpa migrasi). Kunci
 * berawalan "sistem:". Pembaca TIDAK melempar: yang tidak terbaca = null,
 * dan pemanggil memilih bawaannya (fitur: menyala).
 */
export const PENGGUNA_SISTEM = "*sistem*";

export async function bacaSetelanSistem(db: AletaDatabase, kunci: string): Promise<unknown | null> {
  try {
    const baris = await db.queryOne<{ nilai: string }>("SELECT nilai FROM aleta_ekstensi_setelan WHERE pengguna_id = ? AND kunci = ?", [
      PENGGUNA_SISTEM,
      kunci,
    ]);
    return baris ? JSON.parse(String(baris.nilai)) : null;
  } catch {
    return null;
  }
}

/** Menulis (upsert) lewat penghubung yang diberikan; pemanggil yang mencatat audit. */
export async function tulisSetelanSistem(db: AletaDatabase, kunci: string, nilai: unknown, sekarang: string) {
  await db
    .prepare(
      "INSERT INTO aleta_ekstensi_setelan (pengguna_id, kunci, nilai, diubah_pada) VALUES (?, ?, ?, ?) " +
        "ON CONFLICT (pengguna_id, kunci) DO UPDATE SET nilai = excluded.nilai, diubah_pada = excluded.diubah_pada"
    )
    .run(PENGGUNA_SISTEM, kunci, JSON.stringify(nilai), sekarang);
}
