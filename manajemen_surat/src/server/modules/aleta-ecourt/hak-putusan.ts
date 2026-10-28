import { getEffectiveRoleId, isPrivilegedAdmin } from "@/lib/permissions";
import { type RoleId } from "@/lib/types";
import { type AletaDatabase } from "@/server/db/client";
import { PERAN_PENGAWAS_PUTUSAN, pastikanMilikPerkara } from "@/server/modules/aleta-ecourt/hak-milik-perkara";
import { requireActorUser } from "@/server/modules/organization/service";
import { ApiError } from "@/server/shared/errors";

/**
 * ============================================================================
 * UNGGAH PUTUSAN KE SIPP DAN E-COURT - PERAN, BUKAN KEMAMPUAN (9 Okt 2026)
 * ============================================================================
 *
 * Keputusan pengguna: "untuk putusan itu hanya bisa dilakukan oleh superadmin,
 * admin dan hakim, yang lain tidak boleh upload putusan ke sipp".
 *
 * Sebelumnya unggahan putusan menumpang kemampuan "penunjukan" (papan
 * penunjukan) - kemampuan yang dibuat untuk PENETAPAN. Akibatnya hak unggah
 * putusan ikut bergeser setiap kali gerbang penetapan disunting, dan uji U1
 * menemukan PP serta Juru Sita mati/hidup menurut saklar yang tidak ada
 * hubungannya dengan putusan.
 *
 * Kini hak itu pemeriksaan PERAN yang eksplisit dan TIDAK dapat disunting dari
 * halaman pengaturan akses ekstensi:
 *
 *   - Super Admin dan Admin (peran berlaku, sama dengan pastikanKapabilitas);
 *   - Hakim, termasuk Ketua dan Wakil Ketua - keduanya hakim yang mengetuai
 *     majelis dan memutus perkaranya sendiri (menu putusan mereka sudah ada
 *     sejak matriks 30 Sep; mencabutnya bukan bagian dari keputusan ini).
 *
 * Peran TAMBAHAN tidak memberi hak ini - sama dengan larangan menaruh
 * "super-admin" sebagai peran tambahan. PP, panitera, juru sita, operator,
 * analis, dan staf ditolak 403 di setiap rute yang menulis putusan atau
 * menyiapkan isian borang putusan.
 *
 * Gerbang penetapan ("penunjukan", "kerjakan" di akses.ts) TIDAK diubah.
 *
 * Berkas tersendiri, bukan bagian akses.ts: banyak uji rute meniru akses.ts
 * seluruhnya, dan aturan ini harus tetap berlaku (dan teruji) di sana.
 */
export const PERAN_UNGGAH_PUTUSAN: ReadonlySet<RoleId> = new Set<RoleId>([
  "super-admin",
  "admin",
  "hakim",
  "ketua",
  "wakil-ketua",
]);

const PERAN_ADMIN: ReadonlySet<RoleId> = new Set<RoleId>(["super-admin", "admin"]);

export const PESAN_TOLAK_UNGGAH_PUTUSAN =
  "Unggah putusan ke SIPP dan e-Court hanya untuk Hakim, Admin, dan Super Admin. Peran Anda tidak diberi hak ini.";

type PenggunaBerperan = Parameters<typeof isPrivilegedAdmin>[0];

/**
 * Peran yang memberi hak unggah putusan kepada pengguna ini, atau null.
 * Diteruskan ke bot sebagai `peranPenekan` supaya gerbang bot dapat menolak
 * sendiri bila ada pemanggil yang lupa memeriksa.
 */
export function peranUnggahPutusan(user: PenggunaBerperan): RoleId | null {
  if (!user) return null;
  const utama = String(user.roleId || "") as RoleId;
  if (isPrivilegedAdmin(user)) return PERAN_ADMIN.has(utama) ? utama : "admin";
  return PERAN_UNGGAH_PUTUSAN.has(utama) ? utama : null;
}

export function bolehUnggahPutusan(user: PenggunaBerperan): boolean {
  return peranUnggahPutusan(user) !== null;
}

/** Menuntut hak unggah putusan, atau melempar 403 dengan kalimat yang jelas. */
export async function pastikanBolehUnggahPutusan(db: AletaDatabase, actorUserId: string | null | undefined) {
  const actor = await requireActorUser(db, actorUserId);
  const peran = peranUnggahPutusan(actor);
  if (!peran) throw new ApiError(403, PESAN_TOLAK_UNGGAH_PUTUSAN);
  return { actor, peran };
}

/**
 * Keputusan 16 Okt 2026: hakim hanya putusan perkara MAJELISNYA; Ketua, Wakil
 * Ketua, Admin, Super Admin semua perkara. SATU penjaga untuk semua rute tulis
 * putusan (unggah-sipp memanggil pastikanMilikPerkara langsung; sidang-putus
 * lewat fungsi ini): sumber dan pencocok nama sama dengan layar Unggah massal
 * (hak-milik-perkara). Majelis tak terbaca = ditolak dengan kalimat jujur.
 */
export async function pastikanMajelisPutusan(
  actor: { name?: string | null } | null | undefined,
  peran: RoleId,
  perkaraId: unknown
): Promise<void> {
  if (PERAN_PENGAWAS_PUTUSAN.has(String(peran))) return;
  const pid = String(perkaraId ?? "").trim();
  if (!/^\d{1,12}$/.test(pid)) throw new ApiError(400, "Nomor perkara SIPP (perkara_id) tidak sah.");
  const milik = await pastikanMilikPerkara({ jenis: "putusan", perkaraId: pid, namaAkun: String(actor?.name ?? ""), pengawas: false });
  if (!milik.ok) throw new ApiError(milik.status, milik.pesan);
}

/**
 * ============================================================================
 * HASIL SIDANG IKRAR "PEMOHON TIDAK HADIR" / "RUKUN KEMBALI" (P7, 28 Okt 2026)
 * ============================================================================
 *
 * Keputusan pengguna: status 2 (kekuatan putusan gugur) dan 3 (rukun kembali,
 * perkara dicoret dari register) akibat hukumnya berat - hanya Super Admin,
 * Ketua, Wakil Ketua, dan Hakim. Status 1 (Diikrarkan) tetap mengikuti matriks
 * aksi "sidang.tunda-putus". Admin TIDAK termasuk (beda dengan unggah putusan).
 * Peran berlaku (Plh dihitung) - getEffectiveRoleId. Siapa pun penekannya, akun
 * di SIPP tetap PP ikrar dan ketua majelis ikrar (bot).
 */
export const PERAN_STATUS_IKRAR_BERAT: ReadonlySet<RoleId> = new Set<RoleId>(["super-admin", "ketua", "wakil-ketua", "hakim"]);

export const PESAN_TOLAK_STATUS_IKRAR =
  "Hasil sidang ikrar \"Pemohon Tidak Hadir\" dan \"Rukun Kembali\" hanya dapat dicatat Super Admin, Ketua, Wakil Ketua, atau Hakim.";

/** Status ikrar 1/2/3 dari badan permintaan; 0 bila tidak disebut. */
export function statusIkrarDiminta(nilai: unknown): number {
  const n = Number(nilai);
  return n === 1 || n === 2 || n === 3 ? n : 0;
}

export function bolehStatusIkrarBerat(user: PenggunaBerperan): boolean {
  if (!user) return false;
  const peran = String(getEffectiveRoleId(user) || user.roleId || "") as RoleId;
  return PERAN_STATUS_IKRAR_BERAT.has(peran);
}

/** Status 2/3 menuntut peran P7 (403); status 1 / tanpa status tidak diperiksa di sini. */
export async function pastikanBolehStatusIkrar(db: AletaDatabase, actorUserId: string | null | undefined, status: number) {
  if (status !== 2 && status !== 3) return;
  const actor = await requireActorUser(db, actorUserId);
  if (!bolehStatusIkrarBerat(actor)) throw new ApiError(403, PESAN_TOLAK_STATUS_IKRAR);
}
