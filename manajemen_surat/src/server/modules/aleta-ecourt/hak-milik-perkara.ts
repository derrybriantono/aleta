import { namaCocokSatu } from "@/lib/perkara-sendiri";
import { getGatewayUnggahMassalCek } from "@/server/modules/aleta-bot/whatsapp-gateway-client";

/**
 * ============================================================================
 * UNGGAH e-DOC KE SIPP: HANYA PERKARA MILIK AKUN (audit ABT, 17 Okt 2026, A4)
 * ============================================================================
 *
 * Keputusan 9 Okt 2026: unggah putusan hanya Super Admin/Admin/Hakim, BAS
 * milik panitera sidang. Rute unggah dahulu hanya memeriksa PERAN: hakim mana
 * pun dapat mengunggah putusan perkara hakim lain, dan PP mana pun dapat
 * mengunggah (bahkan mengganti, ganti=1) BAS perkara PP lain - padahal layar
 * Unggah massal sudah menyaring "milik saya" memakai nama majelis/PP SIPP.
 *
 * Kini rute memakai sumber dan pencocok nama yang SAMA dengan layar itu:
 * majelis pemeriksa (putusan) / PP aktif (BAS) dibaca bot dari SIPP (cek,
 * SELECT saja), dicocokkan dengan nama akun lewat namaCocokSatu.
 *
 * Yang mengawasi tidak dibatasi: Super Admin, Admin, Ketua, Wakil Ketua
 * (putusan); Admin, Panitera, Panmud, Analis (BAS) - sama dengan saringan
 * "semua" di Unggah massal (hakUnggahMassal.semua). "Lihat sebagai akun" hanya
 * tampilan di ekstensi; server selalu menilai akun yang sungguh masuk.
 *
 * Petugas yang tidak terbaca (bot mati, daftar kosong) = DITOLAK dengan
 * kalimat yang jelas, bukan diloloskan.
 */
export type JenisMilik = "putusan" | "bas";

/** Peran (peranPenekan) yang mengawasi semua perkara untuk unggah putusan. */
export const PERAN_PENGAWAS_PUTUSAN: ReadonlySet<string> = new Set(["super-admin", "admin", "ketua", "wakil-ketua"]);

export const PESAN_BUKAN_MAJELIS =
  "Perkara ini bukan perkara majelis Anda, jadi putusannya tidak dapat diunggah dari akun Anda. Hubungi hakim yang menangani perkara ini atau Admin.";
export const PESAN_BUKAN_PP =
  "Perkara ini bukan perkara Anda sebagai Panitera Pengganti, jadi BAS-nya tidak dapat diunggah dari akun Anda. Hubungi PP perkara ini atau Panitera/Admin.";
export const PESAN_PETUGAS_TAK_TERBACA =
  "Majelis atau Panitera Pengganti perkara ini belum dapat dibaca dari SIPP, jadi hak unggah Anda belum dapat dipastikan. Coba lagi sebentar lagi.";

export type PenilaianMilik = { ok: true } | { ok: false; status: 403 | 502; pesan: string };

/** Murni: apakah akun ini salah satu petugas yang tertulis? */
export function akunAdalahPetugas(namaAkun: string, petugas: string[]): boolean {
  return Boolean(String(namaAkun || "").trim()) && petugas.some((n) => namaCocokSatu(namaAkun, n));
}

/** Murni: menilai dari daftar petugas yang sudah dibaca (null = tidak terbaca). */
export function nilaiMilikPerkara(p: { jenis: JenisMilik; namaAkun: string; pengawas: boolean; petugas: string[] | null }): PenilaianMilik {
  if (p.pengawas) return { ok: true };
  if (!p.petugas || p.petugas.length === 0) return { ok: false, status: 502, pesan: PESAN_PETUGAS_TAK_TERBACA };
  if (akunAdalahPetugas(p.namaAkun, p.petugas)) return { ok: true };
  return { ok: false, status: 403, pesan: p.jenis === "putusan" ? PESAN_BUKAN_MAJELIS : PESAN_BUKAN_PP };
}

const daftarTeks = (x: unknown): string[] | null => (Array.isArray(x) ? x.map((n) => String(n ?? "").trim()).filter(Boolean) : null);

/**
 * Membaca petugas perkara dari bot lalu menilai. Pengawas langsung lolos tanpa
 * perjalanan ke bot.
 */
export async function pastikanMilikPerkara(p: {
  jenis: JenisMilik;
  perkaraId: string;
  sidangId?: string;
  namaAkun: string;
  pengawas: boolean;
}): Promise<PenilaianMilik> {
  if (p.pengawas) return { ok: true };
  let petugas: string[] | null = null;
  try {
    const jawab = await getGatewayUnggahMassalCek({ jenis: p.jenis, perkaraId: p.perkaraId, sidangId: p.sidangId });
    if (jawab?.ok) {
      const data = jawab.data as Record<string, unknown>;
      petugas = daftarTeks(p.jenis === "putusan" ? data.majelis : data.panitera);
    }
  } catch {
    petugas = null;
  }
  return nilaiMilikPerkara({ jenis: p.jenis, namaAkun: p.namaAkun, pengawas: false, petugas });
}
