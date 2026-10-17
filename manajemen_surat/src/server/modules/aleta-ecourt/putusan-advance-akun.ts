import {
  BATAS_AKUN_ADVANCE,
  advanceMenyala,
  bersihkanPengaturanAdvance,
  type PengaturanAdvanceAkun,
} from "@/lib/putusan-advance-akun";
import { withTransaction, type AletaDatabase } from "@/server/db/client";
import { appendAuditLog } from "@/server/shared/audit";
import { ApiError } from "@/server/shared/errors";
import { nextPrefixedId } from "@/server/shared/ids";

/**
 * Putusan Advance per akun (17 Okt 2026) - disimpan di aleta_ekstensi_setelan
 * (tanpa migrasi), pengguna_id PENGGUNA_SISTEM, kunci KUNCI_ADVANCE_AKUN.
 * Aturannya di @/lib/putusan-advance-akun. Tidak ada yang ditulis ke SIPP/ABT.
 */
export const KUNCI_ADVANCE_AKUN = "sistem:putusan-advance-akun";
/** Sama dengan PENGGUNA_SISTEM ktp-pihak-pengaturan.ts (tidak diimpor: modul itu menarik penyapu KTP). */
const PENGGUNA_SISTEM = "*sistem*";

/** Peran yang lazim memakai Putusan Advance (hakim & konseptor) - calon di layar admin. */
const PERAN_CALON = ["hakim", "ketua", "wakil-ketua", "panitera-pengganti", "panitera", "panitera-muda", "super-admin", "admin"];

export async function bacaPengaturanAdvance(db: AletaDatabase): Promise<PengaturanAdvanceAkun | null> {
  try {
    const baris = await db.queryOne<{ nilai: string }>(
      "SELECT nilai FROM aleta_ekstensi_setelan WHERE pengguna_id = ? AND kunci = ?",
      [PENGGUNA_SISTEM, KUNCI_ADVANCE_AKUN]
    );
    return baris ? bersihkanPengaturanAdvance(JSON.parse(String(baris.nilai))) : null;
  } catch {
    return null;
  }
}

/** Saklar per akun - dipanggil rute putusan/advance SEBELUM hak lama. */
export async function advanceMenyalaUntuk(db: AletaDatabase, akun: { id?: unknown; name?: unknown } | null | undefined) {
  return advanceMenyala(await bacaPengaturanAdvance(db), akun);
}

export type CalonAdvance = { id: string; nama: string; peran: string; menyala: boolean };

/** Layar admin: pengaturan + akun calon (aktif, peran hakim/konseptor/admin) dengan keadaannya. */
export async function bacaLayarAdvance(db: AletaDatabase) {
  const pengaturan = await bacaPengaturanAdvance(db);
  const baris = await db.queryAll<Record<string, unknown>>(
    `SELECT id, name, role_id FROM users WHERE is_active = 1 AND deleted_at IS NULL ORDER BY name`
  );
  const calon: CalonAdvance[] = baris
    .filter((b) => PERAN_CALON.includes(String(b.role_id ?? "")) || pengaturan?.akun.includes(String(b.id)))
    .map((b) => {
      const akun = { id: String(b.id), name: String(b.name ?? "") };
      return { id: akun.id, nama: akun.name, peran: String(b.role_id ?? ""), menyala: advanceMenyala(pengaturan, akun) };
    });
  return { tersimpan: Boolean(pengaturan), pengaturan, calon };
}

/** Simpan daftar akun yang menyala (Super Admin/Admin - diperiksa rute). */
export async function simpanPengaturanAdvance(db: AletaDatabase, aktor: { id: string; name?: string | null }, badan: Record<string, unknown>) {
  if (!Array.isArray(badan.akun)) throw new ApiError(400, "Daftar akun Putusan Advance harus dikirim.");
  if (badan.akun.length > BATAS_AKUN_ADVANCE) throw new ApiError(400, `Paling banyak ${BATAS_AKUN_ADVANCE} akun.`);
  const diminta = [...new Set(badan.akun.map((x) => String(x ?? "").trim()).filter(Boolean))];
  const ada = diminta.length
    ? await db.queryAll<Record<string, unknown>>(
        `SELECT id FROM users WHERE deleted_at IS NULL AND id IN (${diminta.map(() => "?").join(", ")})`,
        diminta
      )
    : [];
  const dikenal = new Set(ada.map((b) => String(b.id)));
  const takDikenal = diminta.filter((id) => !dikenal.has(id));
  if (takDikenal.length) throw new ApiError(400, "Ada akun yang tidak dikenal ALETA - muat ulang halaman lalu pilih lagi.");
  const sekarang = new Date().toISOString();
  const isi = bersihkanPengaturanAdvance({ akun: diminta, diubahOleh: aktor.name || aktor.id, diubahPada: sekarang });
  if (!isi) throw new ApiError(400, "Pengaturan Putusan Advance tidak sah.");
  await withTransaction(db, async (tx) => {
    await tx
      .prepare(
        "INSERT INTO aleta_ekstensi_setelan (pengguna_id, kunci, nilai, diubah_pada) VALUES (?, ?, ?, ?) " +
          "ON CONFLICT (pengguna_id, kunci) DO UPDATE SET nilai = excluded.nilai, diubah_pada = excluded.diubah_pada"
      )
      .run(PENGGUNA_SISTEM, KUNCI_ADVANCE_AKUN, JSON.stringify(isi), sekarang);
    await appendAuditLog(tx, {
      id: await nextPrefixedId(tx, "audit_logs", "adt"),
      actorUserId: aktor.id,
      action: "UPDATE_PUTUSAN_ADVANCE_AKUN",
      entityType: "aleta_ekstensi_setelan",
      entityId: `${PENGGUNA_SISTEM}:${KUNCI_ADVANCE_AKUN}`,
      payload: { akun: isi.akun },
      createdAt: sekarang,
    });
  });
  return { ok: true, ...(await bacaLayarAdvance(db)) };
}
