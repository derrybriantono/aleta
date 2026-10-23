import { DAFTAR_KEMAMPUAN_AI, GOLONGAN_PERAN, KEMAMPUAN_AI, type GolonganPeran, type KemampuanAi, type TimpaanKemampuanAi } from "@/lib/matriks-peran";
import type { AletaDatabase } from "@/server/db/client";
import { catatJejak } from "@/server/modules/aleta-ai/pengaturan";
import { ApiError } from "@/server/shared/errors";

/**
 * Timpaan matriks kemampuan ALETA Ai oleh Super Admin (rencana v2 10.3),
 * disimpan sebagai JSON di aleta_ai_pengaturan kunci "matriks_kemampuan".
 * Kemampuan yang tidak ditimpa memakai bawaan KEMAMPUAN_AI (matriks-peran.ts).
 */

export const KUNCI_MATRIKS_KEMAMPUAN = "matriks_kemampuan";

export function bersihkanTimpaan(mentah: unknown): TimpaanKemampuanAi {
  const hasil: TimpaanKemampuanAi = {};
  if (!mentah || typeof mentah !== "object" || Array.isArray(mentah)) return hasil;
  for (const [k, v] of Object.entries(mentah as Record<string, unknown>)) {
    if (!DAFTAR_KEMAMPUAN_AI.includes(k as KemampuanAi) || !Array.isArray(v)) continue;
    const golongan = [...new Set(v.map((x) => String(x)))].filter(
      (g): g is GolonganPeran => (GOLONGAN_PERAN as readonly string[]).includes(g) && g !== "super-admin" && g !== "admin"
    );
    hasil[k as KemampuanAi] = golongan;
  }
  return hasil;
}

export async function bacaTimpaanKemampuan(db: AletaDatabase): Promise<TimpaanKemampuanAi> {
  const baris = await db.queryOne<{ nilai: string }>(`SELECT nilai FROM aleta_ai_pengaturan WHERE kunci = ?`, [KUNCI_MATRIKS_KEMAMPUAN]);
  if (!baris?.nilai) return {};
  try {
    return bersihkanTimpaan(JSON.parse(baris.nilai));
  } catch {
    return {};
  }
}

/** Matriks berlaku untuk layar pengaturan: per kemampuan, golongan yang boleh dan apakah bawaan. */
export function matriksBerlaku(timpaan: TimpaanKemampuanAi) {
  return DAFTAR_KEMAMPUAN_AI.map((k) => ({
    kemampuan: k,
    label: KEMAMPUAN_AI[k].label,
    golongan: [...(timpaan[k] ?? KEMAMPUAN_AI[k].golongan)],
    bawaan: !timpaan[k],
  }));
}

/** Menyimpan timpaan (Super Admin). `null` pada satu kemampuan = kembali ke bawaan. */
export async function simpanTimpaanKemampuan(db: AletaDatabase, olehId: string, masukan: unknown): Promise<TimpaanKemampuanAi> {
  if (!masukan || typeof masukan !== "object" || Array.isArray(masukan)) throw new ApiError(400, "Matriks kemampuan tidak terbaca.");
  const lama = await bacaTimpaanKemampuan(db);
  const baru: TimpaanKemampuanAi = { ...lama };
  for (const [k, v] of Object.entries(masukan as Record<string, unknown>)) {
    if (!DAFTAR_KEMAMPUAN_AI.includes(k as KemampuanAi)) throw new ApiError(400, `Kemampuan tidak dikenal: ${k}.`);
    if (v === null) delete baru[k as KemampuanAi];
    else if (!Array.isArray(v)) throw new ApiError(400, `Isi kemampuan ${k} harus daftar golongan.`);
  }
  Object.assign(baru, bersihkanTimpaan(Object.fromEntries(Object.entries(masukan as Record<string, unknown>).filter(([, v]) => v !== null))));
  const nilai = JSON.stringify(baru);
  const waktu = new Date().toISOString();
  const hasil = await db.run(`UPDATE aleta_ai_pengaturan SET nilai = ?, diubah_oleh = ?, diubah_at = ? WHERE kunci = ?`, [nilai, olehId, waktu, KUNCI_MATRIKS_KEMAMPUAN]);
  if (!hasil.changes) {
    await db.run(`INSERT INTO aleta_ai_pengaturan (kunci, nilai, diubah_oleh, diubah_at) VALUES (?, ?, ?, ?)`, [KUNCI_MATRIKS_KEMAMPUAN, nilai, olehId, waktu]);
  }
  await catatJejak(db, { penggunaId: olehId, peranId: "super-admin", aksi: "ubah-matriks-kemampuan", ringkas: Object.keys(masukan as object).join(",") });
  return baru;
}
