import { randomUUID } from "node:crypto";

import { JENIS_SAMARAN, Penyamar, type EntriSamaran, type JenisSamaran } from "@/lib/aleta-ai/samaran";
import type { AletaDatabase } from "@/server/db/client";
import { bukaIsi, sandiIsi } from "@/server/modules/aleta-ai/percakapan";

/**
 * Penyimpan kode samaran per percakapan (tabel aleta_ai_samaran, 0084). Nilai
 * asli disimpan TERENKRIPSI dengan mekanisme yang sama dengan isi pesan; hanya
 * mesin yang membukanya, untuk percakapan yang sudah dipastikan milik pelaku.
 */

export async function muatPenyamar(db: AletaDatabase, percakapanId: string): Promise<Penyamar> {
  const baris = await db.queryAll<{ kode: string; jenis: string; asli: string }>(
    `SELECT kode, jenis, asli FROM aleta_ai_samaran WHERE percakapan_id = ? ORDER BY dibuat_at, kode`,
    [percakapanId]
  );
  const entri: EntriSamaran[] = [];
  for (const b of baris) {
    const asli = bukaIsi(b.asli);
    if (!asli || !JENIS_SAMARAN.includes(b.jenis as JenisSamaran)) continue;
    entri.push({ kode: b.kode, jenis: b.jenis as JenisSamaran, asli });
  }
  return new Penyamar(entri);
}

/** Menyimpan entri yang BARU dibuat penyamar (yang lama tidak ditulis ulang). */
export async function simpanPenyamar(db: AletaDatabase, percakapanId: string, penyamar: Penyamar): Promise<void> {
  const waktu = new Date().toISOString();
  for (const e of penyamar.baru.splice(0)) {
    const ada = await db.queryOne<{ kode: string }>(`SELECT kode FROM aleta_ai_samaran WHERE percakapan_id = ? AND kode = ?`, [percakapanId, e.kode]);
    if (ada) continue;
    await db.run(`INSERT INTO aleta_ai_samaran (id, percakapan_id, kode, jenis, asli, dibuat_at) VALUES (?, ?, ?, ?, ?, ?)`, [
      `ais-${randomUUID()}`,
      percakapanId,
      e.kode,
      e.jenis,
      sandiIsi(e.asli),
      waktu,
    ]);
  }
}
