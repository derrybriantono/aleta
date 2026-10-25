import { type AletaDatabase } from "@/server/db/client";

/**
 * ============================================================================
 * SETELAN KEAMANAN BAGIAN 6 (25 Okt 2026) - SATU TEMPAT KUNCI-NILAI
 * ============================================================================
 *
 * Semua saklar keamanan baru (kebijakan sandi, pengaman aksi admin, uji pulih
 * cadangan) disimpan di aleta_setelan_keamanan (0107) dengan awalan kunci:
 *
 *   sandi.*     kebijakan sandi (6a)
 *   pengaman.*  pengaman aksi admin (6c)
 *   pulih.*     uji pulih cadangan (6d)
 *
 * Tanpa baris = nilai bawaan, dan SEMUA saklar bawaannya MATI. Tabel yang
 * belum ada (migrasi belum jalan) dibaca sebagai "tanpa baris": perilaku lama
 * persis. Menulis ke tabel yang belum ada melempar - layar admin
 * menampilkannya sebagai galat, bukan menelannya.
 */

export type PasanganSetelan = Record<string, string>;

/** Semua baris berawalan `awalan` (mis. "sandi."), kunci utuh. Tabel belum ada -> {}. */
export async function bacaSetelanAwalan(db: AletaDatabase, awalan: string): Promise<PasanganSetelan> {
  try {
    const baris = await db.queryAll<{ kunci: string; nilai: string }>(
      "SELECT kunci, nilai FROM aleta_setelan_keamanan WHERE kunci LIKE ?",
      [`${awalan.replace(/[%_\\]/g, "")}%`]
    );
    return Object.fromEntries(baris.map((b) => [b.kunci, b.nilai]));
  } catch {
    return {};
  }
}

export async function bacaSatuSetelan(db: AletaDatabase, kunci: string): Promise<string | null> {
  try {
    const baris = await db.queryOne<{ nilai: string }>("SELECT nilai FROM aleta_setelan_keamanan WHERE kunci = ?", [kunci]);
    return baris ? String(baris.nilai) : null;
  } catch {
    return null;
  }
}

export async function tulisSetelan(db: AletaDatabase, pasangan: Array<[string, string]>, olehId: string, kini = new Date()) {
  const waktu = kini.toISOString();
  for (const [kunci, nilai] of pasangan) {
    await db
      .prepare(
        `INSERT INTO aleta_setelan_keamanan (kunci, nilai, diubah_oleh, diubah_pada) VALUES (?, ?, ?, ?)
         ON CONFLICT(kunci) DO UPDATE SET nilai = excluded.nilai, diubah_oleh = excluded.diubah_oleh, diubah_pada = excluded.diubah_pada`
      )
      .run(kunci, nilai, olehId, waktu);
  }
}

export function bulatDalam(nilai: unknown, min: number, maks: number, bawaan: number) {
  const n = Math.round(Number(nilai));
  return Number.isFinite(n) && n >= min && n <= maks ? n : bawaan;
}

export function benar(nilai: string | undefined, bawaan: boolean) {
  if (nilai === undefined) return bawaan;
  return nilai === "1" || nilai === "true";
}
