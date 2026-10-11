/* === HAK-PERAN 12 Okt === */
/**
 * Penjaga SISI SERVER matriks peran (src/lib/matriks-peran.ts).
 *
 * Menyembunyikan tombol bukan penjagaan: ekstensi & layar berjalan di
 * peramban pengguna. Rute yang MENULIS memanggil pastikanAksi SESUDAH
 * penjaga lamanya (pastikanKapabilitas dkk.) - matriks hanya MENAMBAH pagar,
 * tidak membuka apa pun yang sebelumnya tertutup.
 */

import { getEffectiveRoleId } from "@/lib/permissions";
import {
  PETA_ATURAN_APLIKASI,
  aplikasiTampil,
  bolehAksi,
  kunciBukaAplikasi,
  kunciTutupAplikasi,
  pesanTolakAksi,
  type KunciAksi,
} from "@/lib/matriks-peran";
import type { UserPersona } from "@/lib/types";
import { type AletaDatabase } from "@/server/db/client";
import { requireActorUser } from "@/server/modules/organization/service";
import { ApiError } from "@/server/shared/errors";

/** 401 tanpa sesi; 403 bila golongan pengguna tidak diberi aksi ini. */
export async function pastikanAksi(db: AletaDatabase, actorUserId: string | null | undefined, aksi: KunciAksi) {
  const actor = await requireActorUser(db, actorUserId);
  pastikanAksiAktor(actor, aksi);
  return actor;
}

/** Untuk rute yang sudah memegang obyek aktor. */
export function pastikanAksiAktor(actor: UserPersona, aksi: KunciAksi) {
  if (!bolehAksi(actor, aksi)) {
    throw new ApiError(403, pesanTolakAksi(aksi), { aksi, alasan: "matriks_peran" });
  }
}

/** Timpaan Akses Menu (buka:/tutup:) untuk peran berlaku si aktor. */
async function bacaTimpaanPeran(db: AletaDatabase, roleId: string, appId: string) {
  try {
    const baris = await db
      .prepare(
        `SELECT module_id, enabled FROM module_visibility_settings WHERE role_id = ? AND module_id IN (?, ?)`
      )
      .all<{ module_id: string; enabled: number | string | boolean }>(roleId, kunciBukaAplikasi(appId), kunciTutupAplikasi(appId));
    const modules: Record<string, boolean> = {};
    for (const b of baris) modules[b.module_id] = Number(b.enabled) === 1 || b.enabled === true;
    return { roleId, modules };
  } catch {
    // Tabel tak terbaca: tanpa timpaan - bawaan matriks yang berlaku (lebih ketat).
    return { roleId, modules: {} };
  }
}

/**
 * Pagar aplikasi (terutama yang BELUM FIX: ALETA x SIPP, Judicia, e-Audit,
 * E-Status): 403 kecuali Super Admin atau dibuka untuk perannya lewat Akses
 * Menu. Menutup celah "ubin tersembunyi tetapi API terbuka".
 */
export async function pastikanAplikasi(db: AletaDatabase, actorUserId: string | null | undefined, appId: string) {
  const actor = await requireActorUser(db, actorUserId);
  await pastikanAplikasiAktor(db, actor, appId);
  return actor;
}

export async function pastikanAplikasiAktor(db: AletaDatabase, actor: UserPersona, appId: string) {
  const aturan = PETA_ATURAN_APLIKASI.get(appId);
  if (!aturan) return;
  const roleId = String(getEffectiveRoleId(actor) ?? actor.roleId ?? "");
  const akses = await bacaTimpaanPeran(db, roleId, appId);
  if (!aplikasiTampil(actor, appId, akses)) {
    throw new ApiError(
      403,
      aturan.status === "belum-fix"
        ? `${aturan.label} belum dibuka untuk peran Anda (aplikasi masih dalam penyempurnaan). Hubungi Super Admin - Akses Menu.`
        : `${aturan.label} tidak dibuka untuk peran Anda. Hubungi Super Admin - Akses Menu.`,
      { aplikasi: appId, alasan: "matriks_peran" }
    );
  }
}
/* === AKHIR HAK-PERAN === */
