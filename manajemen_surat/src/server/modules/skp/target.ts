import { rhkJabatanSkp } from "@/lib/skp-jabatan-katalog";
import type { AktorSkp, JabatanSkp, StatusTargetSkp, TargetSkpJabatan } from "@/lib/skp-jabatan-tipe";
import { type AletaDatabase, withTransaction } from "@/server/db/client";
import { bolehUbahTargetSkp } from "@/server/modules/skp/hak";
import { angkaAtauNull, jabatanSkpSah, pastikanTeks, sekarangIso } from "@/server/modules/skp/umum";
import { appendAuditLog } from "@/server/shared/audit";
import { ApiError } from "@/server/shared/errors";
import { nextPrefixedId } from "@/server/shared/ids";

/**
 * Target per jabatan, tahun, RHK, dan indikator (aleta_skp_target). Tanpa
 * baris = target usulan dari kode (SKP_JABATAN_2026) yang berlabel "usulan".
 * Baris berstatus "disahkan" = salinan e-Kinerja resmi. Diubah Panitera,
 * Ketua, Super Admin, dan Admin - Wakil Ketua lihat saja.
 */

type BarisTarget = {
  id: string;
  jabatan: string;
  tahun: number;
  kunci_rhk: string;
  kunci_indikator: string;
  target_nilai: number | null;
  target_teks: string;
  satuan: string;
  status: string;
  diubah_oleh_id: string;
  diubah_pada: string;
};

function petakan(b: BarisTarget): TargetSkpJabatan {
  return {
    id: b.id,
    jabatan: b.jabatan as JabatanSkp,
    tahun: Number(b.tahun),
    kunciRhk: b.kunci_rhk,
    kunciIndikator: b.kunci_indikator,
    targetNilai: angkaAtauNull(b.target_nilai),
    targetTeks: b.target_teks,
    satuan: b.satuan,
    status: b.status === "disahkan" ? "disahkan" : "usulan",
    diubahOlehId: b.diubah_oleh_id,
    diubahPada: b.diubah_pada,
  };
}

export async function bacaTarget(
  db: AletaDatabase,
  saring: { tahun: number; jabatan?: JabatanSkp | null }
): Promise<TargetSkpJabatan[]> {
  const baris = await db.queryAll<BarisTarget>(
    `SELECT id, jabatan, tahun, kunci_rhk, kunci_indikator, target_nilai, target_teks, satuan, status, diubah_oleh_id, diubah_pada
       FROM aleta_skp_target
      WHERE tahun = ? ${saring.jabatan ? "AND jabatan = ?" : ""}
      ORDER BY jabatan ASC, kunci_rhk ASC, kunci_indikator ASC`,
    saring.jabatan ? [saring.tahun, saring.jabatan] : [saring.tahun]
  );
  return baris.map(petakan);
}

export type MasukanTargetSkp = {
  jabatan: string;
  tahun: number;
  kunciRhk: string;
  kunciIndikator: string;
  targetNilai?: number | string | null;
  targetTeks?: string;
  satuan?: string;
  status?: string;
};

function periksaTahun(tahun: unknown): number {
  const n = Number(tahun);
  if (!Number.isInteger(n) || n < 2000 || n > 2100) throw new ApiError(400, "Tahun harus empat angka antara 2000 dan 2100.");
  return n;
}

/**
 * Menyimpan satu atau banyak target (upsert). Kunci RHK dan indikator harus
 * ada di katalog jabatannya - target liar tidak pernah terpakai dan hanya
 * membingungkan. Semuanya atau tidak sama sekali.
 */
export async function simpanTarget(
  db: AletaDatabase,
  aktor: AktorSkp,
  butir: readonly MasukanTargetSkp[]
): Promise<TargetSkpJabatan[]> {
  if (!bolehUbahTargetSkp(aktor.peran)) {
    throw new ApiError(403, "Hanya Panitera, Ketua, atau administrator yang dapat mengubah target SKP.");
  }
  if (butir.length === 0) throw new ApiError(400, "Tidak ada target yang disimpan.");
  if (butir.length > 300) throw new ApiError(400, "Terlalu banyak target sekaligus (paling banyak 300).");

  const siap = butir.map((b) => {
    if (!jabatanSkpSah(b.jabatan)) throw new ApiError(400, `Jabatan "${String(b.jabatan)}" tidak dikenal.`);
    const jabatan = b.jabatan;
    const tahun = periksaTahun(b.tahun);
    const rhk = rhkJabatanSkp(jabatan).find((r) => r.kunci === b.kunciRhk);
    const indikator = rhk?.indikator.find((i) => i.kunci === b.kunciIndikator);
    if (!rhk || !indikator) {
      throw new ApiError(400, `RHK atau indikator "${String(b.kunciRhk)}/${String(b.kunciIndikator)}" tidak ada pada jabatan ini.`);
    }
    const status: StatusTargetSkp = b.status === "disahkan" ? "disahkan" : "usulan";
    const targetNilai = angkaAtauNull(b.targetNilai);
    if (b.targetNilai !== null && b.targetNilai !== undefined && b.targetNilai !== "" && targetNilai === null) {
      throw new ApiError(400, "Nilai target harus angka.");
    }
    if (targetNilai !== null && targetNilai < 0) throw new ApiError(400, "Nilai target tidak boleh negatif.");
    const targetTeks = pastikanTeks(b.targetTeks, "Bunyi target", 120) || (targetNilai === null ? "Belum ada target" : String(targetNilai));
    const satuan = pastikanTeks(b.satuan, "Satuan", 30) || indikator.satuan;
    return { jabatan, tahun, kunciRhk: rhk.kunci, kunciIndikator: indikator.kunci, targetNilai, targetTeks, satuan, status };
  });

  return withTransaction(db, async (tx) => {
    const hasil: TargetSkpJabatan[] = [];
    const sekarang = sekarangIso();
    for (const s of siap) {
      const ada = await tx.queryOne<{ id: string }>(
        `SELECT id FROM aleta_skp_target WHERE jabatan = ? AND tahun = ? AND kunci_rhk = ? AND kunci_indikator = ?`,
        [s.jabatan, s.tahun, s.kunciRhk, s.kunciIndikator]
      );
      let id = ada?.id;
      if (id) {
        await tx.run(
          `UPDATE aleta_skp_target SET target_nilai = ?, target_teks = ?, satuan = ?, status = ?, diubah_oleh_id = ?, diubah_pada = ? WHERE id = ?`,
          [s.targetNilai, s.targetTeks, s.satuan, s.status, aktor.userId, sekarang, id]
        );
      } else {
        id = await nextPrefixedId(tx, "aleta_skp_target", "skptgt");
        await tx.run(
          `INSERT INTO aleta_skp_target (id, jabatan, tahun, kunci_rhk, kunci_indikator, target_nilai, target_teks, satuan, status, diubah_oleh_id, diubah_pada)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, s.jabatan, s.tahun, s.kunciRhk, s.kunciIndikator, s.targetNilai, s.targetTeks, s.satuan, s.status, aktor.userId, sekarang]
        );
      }
      hasil.push({
        id,
        jabatan: s.jabatan,
        tahun: s.tahun,
        kunciRhk: s.kunciRhk,
        kunciIndikator: s.kunciIndikator,
        targetNilai: s.targetNilai,
        targetTeks: s.targetTeks,
        satuan: s.satuan,
        status: s.status,
        diubahOlehId: aktor.userId,
        diubahPada: sekarang,
      });
    }
    await appendAuditLog(tx, {
      id: await nextPrefixedId(tx, "audit_logs", "adt"),
      actorUserId: aktor.userId,
      action: "SKP_TARGET_SIMPAN",
      entityType: "skp_target",
      entityId: `${siap[0].jabatan}:${siap[0].tahun}`,
      payload: {
        jumlah: siap.length,
        jabatan: [...new Set(siap.map((s) => s.jabatan))],
        tahun: [...new Set(siap.map((s) => s.tahun))],
        disahkan: siap.filter((s) => s.status === "disahkan").length,
      },
    });
    return hasil;
  });
}
