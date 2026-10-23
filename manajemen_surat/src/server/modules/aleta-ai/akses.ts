import type { KunciAksi } from "@/lib/matriks-peran";
import { getEffectiveRoleId } from "@/lib/permissions";
import type { AletaDatabase } from "@/server/db/client";
import { pastikanAksiAktor, pastikanAplikasiAktor } from "@/server/modules/akses/hak-peran";
import { getUserByIdFromDb, requireActorUser } from "@/server/modules/organization/service";
import { ApiError } from "@/server/shared/errors";

/**
 * Hak ALETA Ai (tahap 1):
 *   - masuk ALETA wajib (sesi sah dan akun aktif);
 *   - Super Admin: pengaturan, proyek, isi saldo, laporan, kurs;
 *   - semua pengguna: hanya percakapan dan saldo MILIKNYA;
 *   - Super Admin TIDAK dapat membaca isi percakapan orang lain (rahasia
 *     musyawarah) - hanya metadata biaya lewat laporan.
 */
export type PelakuAi = {
  id: string;
  nama: string;
  peranId: string;
  superAdmin: boolean;
};

export async function pelakuAi(db: AletaDatabase, actorUserId: string | null | undefined): Promise<PelakuAi> {
  const pengguna = await requireActorUser(db, actorUserId);
  const peranId = String(getEffectiveRoleId(pengguna) ?? pengguna.roleId ?? "");
  return { id: String(pengguna.id), nama: String(pengguna.name ?? ""), peranId, superAdmin: peranId === "super-admin" };
}

/**
 * Tahap 4 (dompet): pelaku + pagar matriks peran di SERVER - aplikasi
 * "aleta-ai" harus dibuka untuk perannya (Akses Menu) DAN golongannya diberi
 * aksi itu (matriks-peran.ts AKSI). 401 tanpa sesi, 403 bila tidak berhak.
 */
export async function pelakuAiBerhak(db: AletaDatabase, actorUserId: string | null | undefined, aksi: KunciAksi): Promise<PelakuAi> {
  const pengguna = await requireActorUser(db, actorUserId);
  await pastikanAplikasiAktor(db, pengguna, "aleta-ai");
  pastikanAksiAktor(pengguna, aksi);
  const peranId = String(getEffectiveRoleId(pengguna) ?? pengguna.roleId ?? "");
  return { id: String(pengguna.id), nama: String(pengguna.name ?? ""), peranId, superAdmin: peranId === "super-admin" };
}

export function wajibSuperAdmin(pelaku: PelakuAi): void {
  if (!pelaku.superAdmin) throw new ApiError(403, "Hanya Super Admin yang dapat membuka bagian ini.");
}

export async function penggunaAda(db: AletaDatabase, penggunaId: string): Promise<boolean> {
  const p = await getUserByIdFromDb(db, penggunaId);
  return Boolean(p && p.isActive);
}
