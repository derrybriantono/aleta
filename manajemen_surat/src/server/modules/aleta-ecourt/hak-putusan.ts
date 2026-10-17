import { isPrivilegedAdmin } from "@/lib/permissions";
import { namaCocokSatu } from "@/lib/perkara-sendiri";
import { type RoleId } from "@/lib/types";
import { type AletaDatabase } from "@/server/db/client";
import { getGatewayKonseptorKeadaan } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
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

export const PESAN_TOLAK_MAJELIS =
  "Hakim hanya dapat mengunggah putusan perkara yang majelisnya ia duduki. Ketua, Wakil Ketua, dan Admin dapat mengunggah putusan semua perkara.";

type BacaMajelis = typeof getGatewayKonseptorKeadaan;

/**
 * Keputusan 16 Okt 2026: hakim hanya putusan perkara MAJELISNYA; Ketua, Wakil
 * Ketua, Admin, Super Admin semua perkara. Dulu hanya ditegakkan di menu ABT -
 * rute yang menulis putusan ke SIPP meloloskan hakim untuk perkara mana pun.
 * Majelis = hakim AKTIF perkara_hakim_pn (bot, SELECT). Tak terbaca = ditolak
 * (unggahannya juga lewat bot yang sama), dengan kalimat yang jujur.
 */
export async function pastikanMajelisPutusan(
  actor: { name?: string | null } | null | undefined,
  peran: RoleId,
  perkaraId: unknown,
  baca?: BacaMajelis
): Promise<void> {
  if (peran !== "hakim") return;
  const pid = String(perkaraId ?? "").trim();
  if (!/^\d{1,12}$/.test(pid)) throw new ApiError(400, "Nomor perkara SIPP (perkara_id) tidak sah.");
  let jawab: Awaited<ReturnType<BacaMajelis>> | null = null;
  try {
    jawab = await (baca ?? getGatewayKonseptorKeadaan)([pid]);
  } catch {
    jawab = null;
  }
  const data = jawab && jawab.ok ? jawab.data : null;
  const gagalMajelis = (data?.gagal ?? []).some((g) => g?.bagian === "majelis");
  if (!data?.perkara || gagalMajelis) {
    throw new ApiError(503, "Majelis perkara ini belum dapat dibaca dari SIPP, jadi hak unggah hakim belum dapat dipastikan. Coba lagi sebentar.");
  }
  const majelis = (data.perkara[pid]?.majelis ?? []).map((m) => String(m?.nama ?? ""));
  if (!majelis.some((n) => namaCocokSatu(String(actor?.name ?? ""), n))) throw new ApiError(403, PESAN_TOLAK_MAJELIS);
}
