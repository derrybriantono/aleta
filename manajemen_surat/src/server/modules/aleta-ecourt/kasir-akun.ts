import { isPrivilegedAdmin } from "@/lib/permissions";
import type { UserPersona } from "@/lib/types";
import { panggilBotJadwalSidang } from "@/server/modules/aleta-ecourt/jadwal-sidang-gateway";

/**
 * AKUN KASIR SIPP (28 Okt 2026) - satu akun untuk semua tulisan Kasir ALETA.
 *
 * Kasir otomatis, Kasir Manual (satu hari), dan "Jalankan sekarang" menulis
 * jurnal SIPP selalu atas akun KASIR (pengguna grup Kasir di SIPP), siapa pun
 * pengguna ALETA yang menekan tombolnya. Bot yang menentukan akunnya (lihat
 * aleta_bot/services/kasirAkunService.js); modul ini hanya meneruskan jawabannya
 * ke layar dan memutuskan siapa yang boleh memilih bila akunnya lebih dari satu.
 */
export type AkunKasirSipp = {
  /** Tanda bagi layar: akun ini akun KASIR, bukan akun petugas yang masuk. */
  akunKasir: true;
  ok: boolean;
  username?: string;
  nama?: string;
  alasan?: string;
  pesan?: string;
  calon: Array<{ username: string; nama: string }>;
  milik: string[];
  dipilih: string;
  /** Super Admin/admin boleh memilih akun kasir yang dipakai. */
  bolehPilih: boolean;
};

export function bolehPilihAkunKasir(aktor: UserPersona | null | undefined): boolean {
  return Boolean(aktor && isPrivilegedAdmin(aktor));
}

type JawabanBot = { ok?: boolean; username?: string; nama?: string; alasan?: string; pesan?: string; calon?: Array<{ username?: string; nama?: string }>; dipilih?: string };

export function bentukAkunKasir(jawab: JawabanBot | null | undefined, bolehPilih: boolean, galat?: string): AkunKasirSipp {
  const calon = (Array.isArray(jawab?.calon) ? jawab!.calon : [])
    .map((c) => ({ username: String(c?.username ?? ""), nama: String(c?.nama ?? "") }))
    .filter((c) => c.username);
  const dasar = { akunKasir: true as const, calon, milik: calon.map((c) => c.username), dipilih: String(jawab?.dipilih ?? ""), bolehPilih };
  if (!jawab) return { ...dasar, ok: false, alasan: "akun_kasir_tidak_terbaca", pesan: galat || "Akun kasir SIPP tidak terbaca - Kasir ALETA tidak menulis apa pun." };
  if (jawab.ok === true && jawab.username) return { ...dasar, ok: true, username: String(jawab.username), nama: String(jawab.nama ?? "") };
  return { ...dasar, ok: false, alasan: String(jawab.alasan ?? "akun_kasir_tidak_terbaca"), pesan: String(jawab.pesan ?? "Akun kasir SIPP tidak terbaca - Kasir ALETA tidak menulis apa pun.") };
}

export async function bacaAkunKasir(aktor: UserPersona | null | undefined): Promise<AkunKasirSipp> {
  const hasil = await panggilBotJadwalSidang<JawabanBot>("/kasir/akun", { timeoutMs: 15_000 });
  return bentukAkunKasir(hasil.ok ? hasil.data : null, bolehPilihAkunKasir(aktor), hasil.ok ? undefined : hasil.error);
}
