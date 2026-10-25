/**
 * Setelan tingkat sistem tanpa migrasi: tabel aleta_ekstensi_setelan dengan
 * pengguna_id "*sistem*" (pola yang sama dengan penyapu KTP pihak). Dipakai
 * saklar rantai E (pemeriksaan berkala, mode pemeliharaan, verifikasi dua
 * langkah, penjaga integritas). SEMUA saklar baru MATI bawaan: nilai yang
 * tidak ada = bawaan modul pemanggil.
 */
import type { AletaDatabase } from "@/server/db/client";

export const PENGGUNA_SISTEM_SETELAN = "*sistem*";

export async function bacaSetelanSistem(db: AletaDatabase, kunci: string): Promise<string | null> {
  const baris = await db.queryAll<{ nilai: string }>(
    "SELECT nilai FROM aleta_ekstensi_setelan WHERE pengguna_id = ? AND kunci = ?",
    [PENGGUNA_SISTEM_SETELAN, kunci]
  );
  return baris[0] ? String(baris[0].nilai) : null;
}

export async function bacaSetelanJson<T>(db: AletaDatabase, kunci: string): Promise<Partial<T> | null> {
  try {
    const teks = await bacaSetelanSistem(db, kunci);
    if (!teks) return null;
    const isi = JSON.parse(teks) as unknown;
    return isi && typeof isi === "object" && !Array.isArray(isi) ? (isi as Partial<T>) : null;
  } catch {
    return null;
  }
}

export async function simpanSetelanSistem(db: AletaDatabase, kunci: string, nilai: string, sekarang = new Date().toISOString()) {
  await db.run(
    "INSERT INTO aleta_ekstensi_setelan (pengguna_id, kunci, nilai, diubah_pada) VALUES (?, ?, ?, ?) " +
      "ON CONFLICT (pengguna_id, kunci) DO UPDATE SET nilai = excluded.nilai, diubah_pada = excluded.diubah_pada",
    [PENGGUNA_SISTEM_SETELAN, kunci, nilai, sekarang]
  );
}

export async function hapusSetelanSistem(db: AletaDatabase, kunci: string) {
  await db.run("DELETE FROM aleta_ekstensi_setelan WHERE pengguna_id = ? AND kunci = ?", [PENGGUNA_SISTEM_SETELAN, kunci]);
}
