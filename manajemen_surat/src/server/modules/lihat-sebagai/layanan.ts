/**
 * ============================================================================
 * LIHAT SEBAGAI PENGGUNA/PERAN (E4, admin 1 - 25 Okt 2026)
 * ============================================================================
 *
 * Super Admin melihat ALETA "seperti yang dilihat" sebuah akun atau peran:
 * menu apa yang tampil, mana yang tersembunyi, dan KENAPA (Akses Menu per
 * peran atau matriks hak). Ini PRATINJAU BACA-SAJA yang dihitung di server dari
 * sumber yang sama dengan tampilan sesungguhnya - tidak ada sesi akun lain yang
 * dibuka, tidak ada data perkara yang dibuka atas nama orang lain, sehingga
 * tidak ada yang bisa ditulis atau dibocorkan lewat fitur ini.
 *
 * Aturan:
 *   - hanya Super Admin (aksi "lihat-sebagai.pakai");
 *   - alasan wajib (10-300 huruf); sesi 30 menit, lalu otomatis berakhir;
 *   - setiap mulai/akhiri tercatat di audit_logs;
 *   - pemilik akun yang dilihat dapat membaca catatan "dilihat oleh Super Admin"
 *     (20 terakhir, 180 hari) di halaman Akun;
 *   - Super Admin tidak dapat melihat sebagai dirinya sendiri (tak berguna).
 *
 * Tersimpan di aleta_ekstensi_setelan (*sistem*, tanpa migrasi).
 */
import {
  ALASAN_LIHAT_MAKS,
  ALASAN_LIHAT_MIN,
  MASA_LIHAT_SEBAGAI_MENIT,
  jelaskanSemuaAplikasi,
  type PenjelasanMenu,
} from "@/lib/lihat-sebagai";
import { LABEL_GOLONGAN, golonganPengguna } from "@/lib/matriks-peran";
import { getEffectiveRoleId } from "@/lib/permissions";
import { portalApps, roles } from "@/lib/mock-data";
import type { UserPersona } from "@/lib/types";
import type { AletaDatabase } from "@/server/db/client";
import { bacaSetelanJson, hapusSetelanSistem, simpanSetelanSistem } from "@/server/modules/kesehatan/setelan";
import { getUserByIdFromDb, getUsersFromDb } from "@/server/modules/organization/service";
import { getModuleVisibilityFromDb } from "@/server/modules/settings/service";
import { appendAuditLog } from "@/server/shared/audit";
import { ApiError } from "@/server/shared/errors";
import { nextPrefixedId } from "@/server/shared/ids";

export const BATAS_CATATAN = 20;
export const RETENSI_CATATAN_HARI = 180;

const kunciSesi = (superAdminId: string) => `lihat-sebagai:sesi:${superAdminId}`;
const kunciCatatan = (userId: string) => `lihat-sebagai:catatan:${userId}`;

export type SesiLihat = {
  jenis: "akun" | "peran";
  /** Kosong bila jenis = peran. */
  userId: string;
  roleId: string;
  nama: string;
  alasan: string;
  mulai: string;
  berakhir: string;
};

export type CatatanDilihat = { oleh: string; pada: string; alasan: string };

export type HasilLihat = {
  sesi: SesiLihat;
  sisaMenit: number;
  golongan: string[];
  menu: PenjelasanMenu[];
};

export function bersihkanAlasan(x: unknown): string {
  const teks = String(x ?? "").replace(/[<>]/g, "").replace(/\s+/g, " ").trim();
  if (teks.length < ALASAN_LIHAT_MIN) throw new ApiError(400, `Alasan wajib diisi, paling sedikit ${ALASAN_LIHAT_MIN} huruf.`);
  if (teks.length > ALASAN_LIHAT_MAKS) throw new ApiError(400, `Alasan paling panjang ${ALASAN_LIHAT_MAKS} huruf.`);
  return teks;
}

function sisaMenit(sesi: Pick<SesiLihat, "berakhir">, kini: Date): number {
  return Math.max(0, Math.ceil((Date.parse(sesi.berakhir) - kini.getTime()) / 60_000));
}

/** Sesi yang masih berlaku, atau null (kedaluwarsa dihapus). */
export async function sesiLihatAktif(db: AletaDatabase, superAdminId: string, kini: Date = new Date()): Promise<SesiLihat | null> {
  const s = await bacaSetelanJson<SesiLihat>(db, kunciSesi(superAdminId));
  if (!s || !s.berakhir || !s.mulai) return null;
  if (Date.parse(s.berakhir) <= kini.getTime()) {
    await hapusSetelanSistem(db, kunciSesi(superAdminId)).catch(() => undefined);
    return null;
  }
  return {
    jenis: s.jenis === "akun" ? "akun" : "peran",
    userId: String(s.userId ?? ""),
    roleId: String(s.roleId ?? ""),
    nama: String(s.nama ?? ""),
    alasan: String(s.alasan ?? ""),
    mulai: s.mulai,
    berakhir: s.berakhir,
  };
}

/** Pengguna tiruan untuk sebuah peran: tanpa jabatan, tanpa peran tambahan. */
export function penggunaTiruanPeran(roleId: string): UserPersona {
  return {
    id: `peran:${roleId}`,
    username: roleId,
    name: roleId,
    roleId,
    positionId: "",
    isActive: true,
  } as unknown as UserPersona;
}

async function hitungPenjelasan(db: AletaDatabase, pengguna: UserPersona): Promise<{ menu: PenjelasanMenu[]; golongan: string[] }> {
  const visibilitas = await getModuleVisibilityFromDb(db).catch(() => []);
  const peranEfektif = getEffectiveRoleId(pengguna);
  const akses = visibilitas.find((v) => v.roleId === peranEfektif) ?? null;
  const menu = jelaskanSemuaAplikasi(
    pengguna,
    portalApps.map((a) => ({ id: a.id, label: a.label })),
    akses ? { roleId: akses.roleId, modules: akses.modules as Partial<Record<string, boolean>> } : null
  );
  const golongan = golonganPengguna(pengguna).map((g) => LABEL_GOLONGAN[g] ?? g);
  return { menu, golongan };
}

export async function mulaiLihatSebagai(
  db: AletaDatabase,
  superAdmin: { id: string; nama: string },
  masukan: { userId?: unknown; roleId?: unknown; alasan?: unknown },
  kini: Date = new Date()
): Promise<HasilLihat> {
  const alasan = bersihkanAlasan(masukan.alasan);
  const userId = String(masukan.userId ?? "").trim();
  const roleId = String(masukan.roleId ?? "").trim();
  if (!userId && !roleId) throw new ApiError(400, "Pilih akun atau peran yang akan dilihat.");

  let sesi: SesiLihat;
  let pengguna: UserPersona;
  const berakhir = new Date(kini.getTime() + MASA_LIHAT_SEBAGAI_MENIT * 60_000).toISOString();
  if (userId) {
    if (userId === superAdmin.id) throw new ApiError(400, "Anda sedang melihat sebagai diri sendiri; pilih akun atau peran lain.");
    const target = await getUserByIdFromDb(db, userId);
    if (!target) throw new ApiError(404, "Akun tidak ditemukan.");
    pengguna = target;
    sesi = {
      jenis: "akun",
      userId: target.id,
      roleId: String(getEffectiveRoleId(target) ?? target.roleId ?? ""),
      nama: target.name,
      alasan,
      mulai: kini.toISOString(),
      berakhir,
    };
  } else {
    const peran = roles.find((r) => r.id === roleId);
    if (!peran) throw new ApiError(404, "Peran tidak ditemukan.");
    pengguna = penggunaTiruanPeran(peran.id);
    sesi = { jenis: "peran", userId: "", roleId: peran.id, nama: peran.name ?? peran.id, alasan, mulai: kini.toISOString(), berakhir };
  }

  await simpanSetelanSistem(db, kunciSesi(superAdmin.id), JSON.stringify(sesi), kini.toISOString());
  if (sesi.jenis === "akun") await tambahCatatan(db, sesi.userId, { oleh: superAdmin.nama || superAdmin.id, pada: sesi.mulai, alasan }, kini);
  await appendAuditLog(db, {
    id: await nextPrefixedId(db, "audit_logs", "adt"),
    actorUserId: superAdmin.id,
    action: "LIHAT_SEBAGAI_MULAI",
    entityType: sesi.jenis === "akun" ? "users" : "roles",
    entityId: sesi.jenis === "akun" ? sesi.userId : sesi.roleId,
    payload: { jenis: sesi.jenis, alasan, berakhir },
  });
  const { menu, golongan } = await hitungPenjelasan(db, pengguna);
  return { sesi, sisaMenit: sisaMenit(sesi, kini), golongan, menu };
}

/** Tampilan sesi yang sedang berjalan (dihitung ulang, selalu sama dengan keadaan sekarang). */
export async function lihatSesiBerjalan(db: AletaDatabase, superAdminId: string, kini: Date = new Date()): Promise<HasilLihat | null> {
  const sesi = await sesiLihatAktif(db, superAdminId, kini);
  if (!sesi) return null;
  let pengguna: UserPersona | null;
  if (sesi.jenis === "akun") {
    pengguna = await getUserByIdFromDb(db, sesi.userId);
    if (!pengguna) {
      await hapusSetelanSistem(db, kunciSesi(superAdminId)).catch(() => undefined);
      return null;
    }
  } else {
    pengguna = penggunaTiruanPeran(sesi.roleId);
  }
  const { menu, golongan } = await hitungPenjelasan(db, pengguna);
  return { sesi, sisaMenit: sisaMenit(sesi, kini), golongan, menu };
}

export async function akhiriLihatSebagai(db: AletaDatabase, superAdmin: { id: string }, kini: Date = new Date()): Promise<boolean> {
  const sesi = await sesiLihatAktif(db, superAdmin.id, kini);
  if (!sesi) return false;
  await hapusSetelanSistem(db, kunciSesi(superAdmin.id));
  await appendAuditLog(db, {
    id: await nextPrefixedId(db, "audit_logs", "adt"),
    actorUserId: superAdmin.id,
    action: "LIHAT_SEBAGAI_AKHIR",
    entityType: sesi.jenis === "akun" ? "users" : "roles",
    entityId: sesi.jenis === "akun" ? sesi.userId : sesi.roleId,
    payload: { jenis: sesi.jenis, mulai: sesi.mulai },
  });
  return true;
}

async function tambahCatatan(db: AletaDatabase, userId: string, c: CatatanDilihat, kini: Date) {
  const daftar = await bacaCatatanDilihat(db, userId, kini);
  daftar.unshift(c);
  await simpanSetelanSistem(db, kunciCatatan(userId), JSON.stringify({ daftar: daftar.slice(0, BATAS_CATATAN) }), kini.toISOString());
}

/** Catatan "dilihat oleh Super Admin" milik satu akun: terbaru dulu, 180 hari, 20 terakhir. */
export async function bacaCatatanDilihat(db: AletaDatabase, userId: string, kini: Date = new Date()): Promise<CatatanDilihat[]> {
  const isi = await bacaSetelanJson<{ daftar: CatatanDilihat[] }>(db, kunciCatatan(userId));
  const batas = kini.getTime() - RETENSI_CATATAN_HARI * 86_400_000;
  return (Array.isArray(isi?.daftar) ? isi.daftar : [])
    .filter((c) => c && typeof c.pada === "string" && Date.parse(c.pada) >= batas)
    .map((c) => ({ oleh: String(c.oleh ?? ""), pada: c.pada, alasan: String(c.alasan ?? "") }))
    .slice(0, BATAS_CATATAN);
}

/** Pilihan untuk layar: akun aktif (tanpa Super Admin sendiri) dan peran. */
export async function pilihanLihatSebagai(db: AletaDatabase, superAdminId: string) {
  const akun = (await getUsersFromDb(db))
    .filter((u) => u.isActive && u.id !== superAdminId)
    .map((u) => ({ id: u.id, nama: u.name, roleId: u.roleId }));
  return { akun, peran: roles.map((r) => ({ id: r.id, nama: r.name ?? r.id })) };
}
