import { getEffectiveRoleId } from "@/lib/permissions";
import type { AletaDatabase } from "@/server/db/client";
import type { PelakuAi } from "@/server/modules/aleta-ai/akses";
import { tanggalLokal } from "@/server/modules/aleta-ai/kurs";
import { catatJejak } from "@/server/modules/aleta-ai/pengaturan";
import { antreSaldo, terapkanMutasi } from "@/server/modules/aleta-ai/saldo";
import { getUsersFromDb } from "@/server/modules/organization/service";
import { ApiError } from "@/server/shared/errors";

/**
 * ============================================================================
 * ALETA Ai - KUOTA HIBAH PER PERAN (tahap 4, opsional)
 * ============================================================================
 *
 * Super Admin dapat memberi setiap peran kuota rupiah per bulan
 * (aleta_ai_kuota_peran). Kuota TIDAK disimpan sebagai angka terpisah: tiap
 * pemberian adalah satu mutasi "kuota" di buku mutasi dengan rujukan
 * kuota:<YYYY-MM>:<peran>, sehingga saldo tetap = jumlah mutasi.
 *
 * Pemberian berlangsung malas (saat pengguna memakai ALETA Ai atau membuka
 * Dompet pada bulan itu) atau serentak oleh Super Admin; keduanya idempoten:
 * satu pengguna menerima kuota satu peran paling banyak sekali per bulan.
 * Kuota yang tidak terpakai TIDAK hangus (ikut saldo) - lihat pertanyaan di
 * laporan T10. Super Admin tidak menerima kuota (sudah gratis).
 */

export const BATAS_KUOTA_RP = 10_000_000;

export type KuotaPeran = { peranId: string; kuotaBulananRp: number };

const teks = (n: unknown) => String(n ?? "").trim();

export async function bacaKuotaPeran(db: AletaDatabase): Promise<KuotaPeran[]> {
  const baris = await db.queryAll<{ peran_id: string; kuota_bulanan_rp: number | string }>(`SELECT peran_id, kuota_bulanan_rp FROM aleta_ai_kuota_peran ORDER BY peran_id`);
  return baris.map((b) => ({ peranId: b.peran_id, kuotaBulananRp: Number(b.kuota_bulanan_rp) || 0 }));
}

/** Super Admin. Kuota 0 = menghapus kuota peran itu. */
export async function simpanKuotaPeran(db: AletaDatabase, olehId: string, daftar: KuotaPeran[]): Promise<KuotaPeran[]> {
  if (!Array.isArray(daftar)) throw new ApiError(400, "Daftar kuota tidak sah.");
  const bersih = daftar.map((k) => {
    const peranId = teks(k?.peranId);
    const rp = Math.trunc(Number(k?.kuotaBulananRp));
    if (!/^[a-z0-9][a-z0-9_-]{1,63}$/i.test(peranId)) throw new ApiError(400, "Peran tidak sah.");
    if (peranId === "super-admin") throw new ApiError(400, "Super Admin sudah gratis; tidak perlu kuota.");
    if (!Number.isFinite(rp) || rp < 0 || rp > BATAS_KUOTA_RP) throw new ApiError(400, `Kuota peran ${peranId} harus antara Rp0 dan Rp${BATAS_KUOTA_RP.toLocaleString("id-ID")}.`);
    return { peranId, kuotaBulananRp: rp };
  });
  const sekarang = new Date().toISOString();
  for (const k of bersih) {
    if (k.kuotaBulananRp === 0) {
      await db.run(`DELETE FROM aleta_ai_kuota_peran WHERE peran_id = ?`, [k.peranId]);
      continue;
    }
    const hasil = await db.run(`UPDATE aleta_ai_kuota_peran SET kuota_bulanan_rp = ?, diubah_oleh = ?, diubah_at = ? WHERE peran_id = ?`, [k.kuotaBulananRp, olehId, sekarang, k.peranId]);
    if (!hasil.changes) {
      await db.run(`INSERT INTO aleta_ai_kuota_peran (peran_id, kuota_bulanan_rp, diubah_oleh, diubah_at) VALUES (?, ?, ?, ?)`, [k.peranId, k.kuotaBulananRp, olehId, sekarang]);
    }
  }
  if (bersih.length) {
    await catatJejak(db, { penggunaId: olehId, peranId: "super-admin", aksi: "admin.kuota", hasil: "ok", ringkas: `Kuota: ${bersih.map((k) => `${k.peranId}=Rp${k.kuotaBulananRp}`).join(", ")}` });
  }
  return bacaKuotaPeran(db);
}

export const rujukanKuota = (bulan: string, peranId: string) => `kuota:${bulan}:${peranId}`;

/**
 * Memberi kuota bulan ini kepada pelaku bila perannya berkuota dan belum
 * menerimanya. Kembalian = rupiah yang diberikan sekarang (0 bila tidak ada /
 * sudah). Tidak pernah melempar (kuota tidak boleh menggagalkan giliran).
 */
export async function pastikanKuotaBulanIni(db: AletaDatabase, pelaku: Pick<PelakuAi, "id" | "peranId" | "superAdmin">, sekarang: Date = new Date()): Promise<number> {
  if (pelaku.superAdmin || !pelaku.id || !pelaku.peranId) return 0;
  try {
    const baris = await db.queryOne<{ kuota_bulanan_rp: number | string }>(`SELECT kuota_bulanan_rp FROM aleta_ai_kuota_peran WHERE peran_id = ?`, [pelaku.peranId]);
    const rp = Math.trunc(Number(baris?.kuota_bulanan_rp ?? 0));
    if (!(rp > 0)) return 0;
    const bulan = tanggalLokal(sekarang).slice(0, 7);
    const rujukan = rujukanKuota(bulan, pelaku.peranId);
    return await antreSaldo(pelaku.id, async () => {
      const ada = await db.queryOne<{ id: string }>(`SELECT id FROM aleta_ai_mutasi WHERE pengguna_id = ? AND jenis = 'kuota' AND rujukan_id = ? LIMIT 1`, [pelaku.id, rujukan]);
      if (ada) return 0;
      await terapkanMutasi(db, { penggunaId: pelaku.id, jenis: "kuota", jumlahRp: rp, rujukanId: rujukan, catatan: `Kuota hibah ${bulan} (peran ${pelaku.peranId})` });
      return rp;
    });
  } catch {
    return 0;
  }
}

/** Super Admin: beri kuota bulan ini ke SEMUA pengguna aktif yang perannya berkuota (idempoten). */
export async function berikanKuotaSemua(db: AletaDatabase, olehId: string, sekarang: Date = new Date()): Promise<{ penerima: number; totalRp: number }> {
  let penerima = 0;
  let totalRp = 0;
  for (const u of await getUsersFromDb(db)) {
    if (!u.isActive) continue;
    const peranId = String(getEffectiveRoleId(u) ?? u.roleId ?? "");
    const rp = await pastikanKuotaBulanIni(db, { id: String(u.id), peranId, superAdmin: peranId === "super-admin" }, sekarang);
    if (rp > 0) {
      penerima += 1;
      totalRp += rp;
    }
  }
  await catatJejak(db, { penggunaId: olehId, peranId: "super-admin", aksi: "admin.kuota.berikan", hasil: "ok", biayaRp: totalRp, ringkas: `Kuota bulan ${tanggalLokal(sekarang).slice(0, 7)}: ${penerima} pengguna` });
  return { penerima, totalRp };
}
