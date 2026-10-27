import type { AletaDatabase } from "@/server/db/client";
import type { PelakuAi } from "@/server/modules/aleta-ai/akses";
import { tanggalLokal } from "@/server/modules/aleta-ai/kurs";
import type { PengaturanAi } from "@/server/modules/aleta-ai/pengaturan";

/**
 * ============================================================================
 * ALETA Ai - BATAS PEMAKAIAN (tahap 4)
 * ============================================================================
 *
 *   per pengguna per hari  token (semua pengguna, termasuk Super Admin: "gratis
 *                          dalam batas wajar") dan rupiah ditagih (Super Admin
 *                          dikecualikan karena tidak ditagih)
 *   per satker per bulan   biaya API (Rp pada kurs dasar) SELURUH pemakaian,
 *                          termasuk Super Admin dan pengklasifikasi - melindungi
 *                          tagihan API pengelola. 0 = tanpa batas.
 *   batas laju             pesan per menit per pengguna (mesin.ts: izinkanLaju)
 *
 * `tambahanRp`/`tambahanToken` = perkiraan giliran/tugas yang akan berjalan:
 * batas ditolak SEBELUM jalan bila perkiraan itu akan melampauinya.
 */

export const PESAN_BATAS_HARIAN = "Batas pemakaian harian ALETA Ai Anda sudah tercapai. Coba lagi besok.";
export const PESAN_BATAS_SATKER = "Batas pemakaian ALETA Ai satker untuk bulan ini sudah tercapai. Hubungi Super Admin.";

export type HasilBatas = { ok: true } | { ok: false; jenis: "harian-token" | "harian-rp" | "satker-bulanan"; alasan: string };

/** Awal hari & awal bulan (WITA) sebagai ISO UTC. */
export function awalHariIso(sekarang: Date): string {
  return new Date(`${tanggalLokal(sekarang)}T00:00:00+08:00`).toISOString();
}

export function awalBulanIso(sekarang: Date): string {
  return new Date(`${tanggalLokal(sekarang).slice(0, 7)}-01T00:00:00+08:00`).toISOString();
}

/**
 * Rupiah ditagih dan token terpakai pengguna sejak awal hari: giliran percakapan
 * DAN tugas T9 (token = catatan per panggilan aleta_ai_penggunaan jenis "tugas";
 * rupiah = potongan mutasi yang merujuk jalan tugas, rujukan "ait-...").
 */
export async function pemakaianHariIni(db: AletaDatabase, penggunaId: string, sekarang: Date = new Date()): Promise<{ rp: number; token: number }> {
  const awal = awalHariIso(sekarang);
  const baris = await db.queryOne<{ rp: number | string | null; tok: number | string | null }>(
    `SELECT COALESCE(SUM(biaya_rp), 0) AS rp, COALESCE(SUM(token_masuk + token_keluar + token_cache_tulis + token_cache_baca), 0) AS tok
     FROM aleta_ai_obrolan_pesan WHERE pemilik_id = ? AND peran = 'ai' AND dibuat_at >= ?`,
    [penggunaId, awal]
  );
  const tugasTok = await db.queryOne<{ tok: number | string | null }>(
    `SELECT COALESCE(SUM(token_masuk + token_keluar + token_cache_tulis + token_cache_baca), 0) AS tok
     FROM aleta_ai_penggunaan WHERE pengguna_id = ? AND jenis = 'tugas' AND dibuat_at >= ?`,
    [penggunaId, awal]
  );
  const tugasRp = await db.queryOne<{ rp: number | string | null }>(
    `SELECT COALESCE(SUM(jumlah_rp), 0) AS rp FROM aleta_ai_mutasi WHERE pengguna_id = ? AND jenis = 'potong' AND rujukan_id LIKE 'ait-%' AND dibuat_at >= ?`,
    [penggunaId, awal]
  );
  return { rp: Number(baris?.rp ?? 0) - Number(tugasRp?.rp ?? 0), token: Number(baris?.tok ?? 0) + Number(tugasTok?.tok ?? 0) };
}

/** Biaya API (Rp, kurs dasar) seluruh satker sejak awal bulan - dari catatan per panggilan (aleta_ai_penggunaan). */
export async function pemakaianSatkerBulanIni(db: AletaDatabase, sekarang: Date = new Date()): Promise<number> {
  const baris = await db.queryOne<{ rp: number | string | null }>(`SELECT COALESCE(SUM(biaya_api_rp), 0) AS rp FROM aleta_ai_penggunaan WHERE dibuat_at >= ?`, [
    awalBulanIso(sekarang),
  ]);
  return Number(baris?.rp ?? 0);
}

export async function periksaBatas(
  db: AletaDatabase,
  pelaku: PelakuAi,
  pengaturan: PengaturanAi,
  sekarang: Date = new Date(),
  opsi: {
    tambahanRp?: number;
    tambahanToken?: number;
    tambahanApiRp?: number;
    /** Giliran/tugas ini gratis karena promosi (tidak ditagih): batas harian Rp tidak relevan, batas token dan satker TETAP. */
    tanpaTagihan?: boolean;
  } = {}
): Promise<HasilBatas> {
  const hari = await pemakaianHariIni(db, pelaku.id, sekarang);
  const tambahToken = Math.max(0, opsi.tambahanToken ?? 0);
  if (hari.token >= pengaturan.batasHarianToken || (tambahToken > 0 && hari.token + tambahToken > pengaturan.batasHarianToken)) {
    return { ok: false, jenis: "harian-token", alasan: PESAN_BATAS_HARIAN };
  }
  const tambahRp = Math.max(0, opsi.tambahanRp ?? 0);
  if (!pelaku.superAdmin && !opsi.tanpaTagihan && (hari.rp >= pengaturan.batasHarianRp || (tambahRp > 0 && hari.rp + tambahRp > pengaturan.batasHarianRp))) {
    return { ok: false, jenis: "harian-rp", alasan: PESAN_BATAS_HARIAN };
  }
  if (pengaturan.batasSatkerBulananRp > 0) {
    const satker = await pemakaianSatkerBulanIni(db, sekarang);
    const tambahApi = Math.max(0, opsi.tambahanApiRp ?? 0);
    if (satker >= pengaturan.batasSatkerBulananRp || (tambahApi > 0 && satker + tambahApi > pengaturan.batasSatkerBulananRp)) {
      return { ok: false, jenis: "satker-bulanan", alasan: PESAN_BATAS_SATKER };
    }
  }
  return { ok: true };
}
