/**
 * Siapa yang boleh mengisi Court Calendar dari Jadwal Sidang portal (6 Okt
 * 2026, butir 3).
 *
 * Mengikuti fitur sejenis - "Court Calendar otomatis" panel SIPP (butir 29,
 * ccBolehTampil di konten.js): golongan PANITERA (panitera, panitera muda,
 * panitera pengganti/PP - yang mengisi Court Calendar di SIPP) dan ADMIN
 * (admin, super admin), DAN kemampuan "data-umum" (diperiksa di rute,
 * pastikanKapabilitas). Hakim, juru sita, dan peran lain tidak - sama dengan
 * panel.
 *
 * Fungsi ini dipakai layar (menampilkan tombol) dan rute (menolak); rute tetap
 * yang menentukan.
 */

import { getEffectivePositionId, getEffectiveRoleId, isPrivilegedAdmin } from "@/lib/permissions";
import type { UserPersona } from "@/lib/types";

export const PERAN_COURT_CALENDAR: readonly string[] = ["panitera", "panitera-muda", "panitera-pengganti"];

type PenggunaHak = Pick<UserPersona, "roleId" | "positionId"> & Partial<Pick<UserPersona, "additionalRoleIds" | "actingAssignment">>;

export function bolehIsiCourtCalendar(pengguna: PenggunaHak | null | undefined): boolean {
  if (!pengguna) return false;
  const persona = pengguna as UserPersona;
  if (isPrivilegedAdmin(persona)) return true;
  const peran = new Set<string>([
    String(getEffectiveRoleId(persona) ?? pengguna.roleId ?? ""),
    String(pengguna.roleId ?? ""),
    ...(pengguna.additionalRoleIds ?? []).map(String),
  ]);
  if (PERAN_COURT_CALENDAR.some((p) => peran.has(p))) return true;
  if (peran.has("admin") || peran.has("super-admin")) return true;
  const posisi = String(getEffectivePositionId(persona) ?? pengguna.positionId ?? "");
  return /^pos-panitera/.test(posisi);
}
