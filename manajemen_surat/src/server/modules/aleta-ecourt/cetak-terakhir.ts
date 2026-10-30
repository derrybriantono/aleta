import { type AletaDatabase } from "@/server/db/client";
import { ApiError } from "@/server/shared/errors";

/**
 * ============================================================================
 * CETAKAN TERAKHIR PER PERKARA (migrasi 0120, 30 Okt 2026)
 * ============================================================================
 *
 * Ringkasan cetakan terakhir satu blangko pada satu perkara: potongan paragraf (sidik + 160 huruf pertama), bukan dokumennya. Dipakai
 * ekstensi untuk keterangan pasif "N bagian berubah sejak cetakan terakhir" di langkah Cetak. Satu baris per (perkara, blangko), ditimpa
 * tiap cetak; baris lebih tua dari 400 hari dibuang saat menyimpan. Data tetap di server ALETA.
 */

export type BagianCetak = { h: string; t: string };

export const BATAS_BAGIAN = 600;
export const BATAS_TEKS_BAGIAN = 160;
const MASA_SIMPAN_HARI = 400;

/** Kunci blangko: nama berkas tanpa ".rtf", spasi dilebur, huruf kecil, paling panjang 200. */
export function kunciBerkasCetak(berkas: unknown): string {
  return String(berkas ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\.rtf$/i, "")
    .trim()
    .toLowerCase()
    .slice(0, 200);
}

export function bersihkanBagian(mentah: unknown): BagianCetak[] | null {
  if (!Array.isArray(mentah)) return null;
  const hasil: BagianCetak[] = [];
  for (const x of mentah.slice(0, BATAS_BAGIAN)) {
    if (!x || typeof x !== "object") continue;
    const h = String((x as { h?: unknown }).h ?? "").toLowerCase();
    if (!/^[0-9a-f]{4,16}$/.test(h)) continue;
    const t = String((x as { t?: unknown }).t ?? "").replace(/[\u0000-\u001F]/g, " ").replace(/\s+/g, " ").trim().slice(0, BATAS_TEKS_BAGIAN);
    hasil.push({ h, t });
  }
  return hasil;
}

export async function bacaCetakTerakhir(db: AletaDatabase, perkaraId: string, berkas: string) {
  const id = String(perkaraId ?? "").trim();
  const kunci = kunciBerkasCetak(berkas);
  if (!/^\d{1,12}$/.test(id) || !kunci) return { ada: false as const };
  const b = await db.queryOne<{ bagian: string; dicetak_pada: string; dicetak_oleh: string }>(
    `SELECT bagian, dicetak_pada, dicetak_oleh FROM aleta_cetak_terakhir WHERE perkara_id = ? AND berkas_kunci = ?`,
    [id, kunci]
  );
  if (!b) return { ada: false as const };
  let bagian: BagianCetak[] = [];
  try {
    bagian = bersihkanBagian(JSON.parse(String(b.bagian))) ?? [];
  } catch {
    bagian = [];
  }
  return { ada: true as const, dicetakPada: String(b.dicetak_pada), dicetakOleh: String(b.dicetak_oleh ?? ""), bagian };
}

export async function simpanCetakTerakhir(db: AletaDatabase, aktor: { id: string; name?: string | null }, mentah: unknown) {
  const m = mentah && typeof mentah === "object" && !Array.isArray(mentah) ? (mentah as Record<string, unknown>) : null;
  if (!m) throw new ApiError(400, "Masukan tidak sah.");
  const perkaraId = String(m.perkaraId ?? "").trim();
  const kunci = kunciBerkasCetak(m.berkas);
  if (!/^\d{1,12}$/.test(perkaraId)) throw new ApiError(400, "perkaraId harus angka.");
  if (!kunci) throw new ApiError(400, "Nama blangko harus disebut.");
  const bagian = bersihkanBagian(m.bagian);
  if (!bagian || !bagian.length) throw new ApiError(400, "Ringkasan cetakan kosong.");
  const sekarang = new Date().toISOString();
  const oleh = String(aktor.name || aktor.id).slice(0, 120);
  await db.run(
    `INSERT INTO aleta_cetak_terakhir (perkara_id, berkas_kunci, nomor_perkara, bagian, jumlah_bagian, dicetak_pada, dicetak_oleh) VALUES (?, ?, ?, ?, ?, ?, ?) ` +
      `ON CONFLICT (perkara_id, berkas_kunci) DO UPDATE SET nomor_perkara = excluded.nomor_perkara, bagian = excluded.bagian, jumlah_bagian = excluded.jumlah_bagian, dicetak_pada = excluded.dicetak_pada, dicetak_oleh = excluded.dicetak_oleh`,
    [perkaraId, kunci, String(m.nomorPerkara ?? "").slice(0, 80), JSON.stringify(bagian), bagian.length, sekarang, oleh]
  );
  const batas = new Date(Date.now() - MASA_SIMPAN_HARI * 86400000).toISOString();
  await db.run(`DELETE FROM aleta_cetak_terakhir WHERE dicetak_pada < ?`, [batas]);
  return { disimpan: true, jumlah: bagian.length, dicetakPada: sekarang };
}
