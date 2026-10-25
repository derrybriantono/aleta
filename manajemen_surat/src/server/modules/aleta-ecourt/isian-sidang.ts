import { randomUUID } from "node:crypto";

import { KODE_FITUR_ISIAN_SIDANG, bersihkanMasukanSidang } from "@/lib/isian-sidang";
import { type AletaDatabase } from "@/server/db/client";
import { fiturMenyala } from "@/server/modules/satker/fitur";

/**
 * ============================================================================
 * ISIAN BAS PER SIDANG - PENYIMPANAN (25 Okt 2026, rantai D butir D6 = U12)
 * ============================================================================
 *
 * Aturan di src/lib/isian-sidang.ts. Di sini: membaca saklar, mengingat dan membaca nilai isian BAS per
 * (perkara, sidang, nomor variabel) di aleta_isian_sidang (migrasi 0103).
 *
 * SAKLAR: Fitur Satker "isian-per-sidang", bawaan MATI. Mati = tidak menulis, tidak membaca.
 *
 * Tidak ada yang ditulis ke SIPP/ABT/e-Court di sini; penulisan sementara ke ABT saat cetak dijalankan
 * ekstensi dari sesi petugas sendiri.
 */

export async function isianSidangAktif(db: AletaDatabase): Promise<boolean> {
  try {
    return await fiturMenyala(db, KODE_FITUR_ISIAN_SIDANG);
  } catch {
    return false;
  }
}

const teks = (x: unknown) => String(x ?? "").trim();

export type IsianSidang = { kode: string; nilai: string; diubahAt: string };

/** Isian BAS satu sidang. Nilai kosong ikut dikembalikan (dikosongkan sengaja). Saklar mati -> kosong. */
export async function bacaIsianSidang(db: AletaDatabase, perkaraId: string, sidang: number): Promise<IsianSidang[]> {
  const id = teks(perkaraId);
  const s = Math.round(Number(sidang) || 0);
  if (!id || s < 1 || !(await isianSidangAktif(db))) return [];
  const baris = await db.queryAll<Record<string, unknown>>(`SELECT no_var, nilai, diubah_at FROM aleta_isian_sidang WHERE perkara_id = ? AND sidang = ? ORDER BY no_var`, [id, s]);
  return baris.map((b) => ({ kode: teks(b.no_var), nilai: String(b.nilai ?? ""), diubahAt: teks(b.diubah_at) }));
}

export type HasilSimpanSidang = { aktif: boolean; disimpan: boolean; sebab: string };

/** Mengingat satu isian BAS untuk satu sidang (nilai terakhir menang). Saklar mati -> tidak menulis. */
export async function simpanIsianSidang(db: AletaDatabase, aktor: { id: string; nama?: string | null }, mentah: unknown): Promise<HasilSimpanSidang> {
  if (!(await isianSidangAktif(db))) return { aktif: false, disimpan: false, sebab: "" };
  const oleh = teks(aktor.nama) || teks(aktor.id);
  if (!oleh) return { aktif: true, disimpan: false, sebab: "Isian harus menyebut siapa yang mengisinya." };
  const m = bersihkanMasukanSidang(mentah);
  if ("ditolak" in m) return { aktif: true, disimpan: false, sebab: m.sebab };
  const lama = await db.queryOne<Record<string, unknown>>(`SELECT id, nilai FROM aleta_isian_sidang WHERE perkara_id = ? AND sidang = ? AND no_var = ?`, [m.perkaraId, m.sidang, m.kode]);
  if (lama && String(lama.nilai ?? "") === m.nilai) return { aktif: true, disimpan: false, sebab: "Sudah sama." };
  if (!lama && !m.nilai) return { aktif: true, disimpan: false, sebab: "Kosong dan belum pernah diingat." };
  const kini = new Date().toISOString();
  if (lama) {
    await db.run(`UPDATE aleta_isian_sidang SET nilai = ?, nomor_perkara = ?, diubah_oleh = ?, diubah_at = ? WHERE id = ?`, [m.nilai, m.nomorPerkara, oleh, kini, teks(lama.id)]);
  } else {
    await db.run(
      `INSERT INTO aleta_isian_sidang (id, perkara_id, nomor_perkara, sidang, no_var, nilai, diisi_oleh, diisi_at, diubah_oleh, diubah_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [randomUUID(), m.perkaraId, m.nomorPerkara, m.sidang, m.kode, m.nilai, oleh, kini, oleh, kini]
    );
  }
  return { aktif: true, disimpan: true, sebab: "" };
}
