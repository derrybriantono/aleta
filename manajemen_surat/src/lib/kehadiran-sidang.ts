/**
 * Pembetulan kehadiran sidang SIPP - aturan penekan (G4 4.4, 30 Okt 2026).
 *
 * Keputusan pengguna (rencana G4): penulisan ke SIPP HANYA atas klik PP dan atas
 * akun SIPP PP perkara. Penekan dinilai PP perkara bila akun SIPP yang tertaut
 * ke akun ALETA-nya = akun SIPP PP perkara (bukti terkuat), atau - bila belum
 * tertaut - namanya tercatat sebagai PP perkara itu (aturan nama yang sama
 * dengan hak hasil mediasi, namaAdaDi).
 *
 * Super Admin BOLEH menekan (keputusan pengguna 30 Okt malam, PENEKAN_SUPER_ADMIN_BOLEH = true) - baris SIPP
 * tetap atas akun SIPP PP perkara, penekan sebenarnya dicatat di jejak ALETA. Admin yang bukan PP perkara tidak.
 */

import { namaAdaDi } from "@/lib/perkara-sendiri";

export const PENEKAN_SUPER_ADMIN_BOLEH = true;

export type AtasNamaPp = { username: string; namaLengkap: string };

export type HasilPenekan = { boleh: true; dasar: "akun-sipp" | "nama" | "super-admin" } | { boleh: false; sebab: string };

export const SEBAB_BUKAN_PP =
  "Pembetulan kehadiran ke SIPP hanya ditekan panitera pengganti perkara ini atau Super Admin (akun SIPP tertaut atau nama Anda tidak cocok dengan PP perkara).";

export function penekanAdalahPp(
  penekan: { nama: string; akunSippMilik: string[]; superAdmin?: boolean },
  pp: AtasNamaPp | null | undefined
): HasilPenekan {
  if (!pp || !String(pp.username ?? "").trim()) return { boleh: false, sebab: "Panitera pengganti perkara ini tidak terbaca dari SIPP." };
  const u = pp.username.trim().toLowerCase();
  const milik = (penekan.akunSippMilik ?? []).map((x) => String(x).trim().toLowerCase()).filter(Boolean);
  if (milik.includes(u)) return { boleh: true, dasar: "akun-sipp" };
  // Akun SIPP tertaut ke akun SIPP LAIN = bukan PP ini, walau namanya mirip.
  if (!milik.length && penekan.nama.trim() && namaAdaDi(penekan.nama, pp.namaLengkap)) return { boleh: true, dasar: "nama" };
  if (PENEKAN_SUPER_ADMIN_BOLEH && penekan.superAdmin) return { boleh: true, dasar: "super-admin" };
  return { boleh: false, sebab: SEBAB_BUKAN_PP };
}
