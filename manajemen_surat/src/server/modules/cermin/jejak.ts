/**
 * Jejak cermin: tanda terakhir per tabel SIPP, kemajuan pemindai awal, hasil
 * pencocokan, dan catatan galat. Satu baris per kunci di aleta_cermin_jejak
 * (nilai_json). Hanya basis data ALETA - tidak menyentuh SIPP.
 */
import type { AletaDatabase } from "@/server/db/client";

export const KUNCI_JEJAK = {
  pemindai: "pemindai",
  pembaruan: "pembaruan",
  pencocokan: "pencocokan",
} as const;

export async function bacaJejak(db: AletaDatabase, kunci: string): Promise<unknown | null> {
  const baris = await db.queryAll<{ nilai_json: string }>("SELECT nilai_json FROM aleta_cermin_jejak WHERE kunci = ?", [kunci]);
  if (!baris[0]) return null;
  try {
    return JSON.parse(baris[0].nilai_json);
  } catch {
    return null;
  }
}

export async function tulisJejak(db: AletaDatabase, kunci: string, nilai: unknown, sekarang = new Date().toISOString()) {
  await db.run(
    `INSERT INTO aleta_cermin_jejak (kunci, nilai_json, diperbarui_at) VALUES (?, ?, ?)
     ON CONFLICT (kunci) DO UPDATE SET nilai_json = excluded.nilai_json, diperbarui_at = excluded.diperbarui_at`,
    [kunci, JSON.stringify(nilai), sekarang]
  );
}

export async function hapusJejak(db: AletaDatabase, kunci: string) {
  await db.run("DELETE FROM aleta_cermin_jejak WHERE kunci = ?", [kunci]);
}
