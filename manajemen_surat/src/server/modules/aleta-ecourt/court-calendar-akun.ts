/**
 * Akun SIPP yang tercatat ketika Court Calendar diisi dari Jadwal Sidang portal
 * (6 Okt 2026, butir 3).
 *
 * Panel SIPP mengetahui akun petugas dari sesi SIPP yang terbuka di
 * peramban. Portal tidak punya sesi SIPP, jadi akunnya diturunkan dari
 * PEMETAAN YANG SUDAH ADA: kredensial SIPP yang disimpan pengguna ALETA di
 * Manajemen Akun (external_app_credentials, app 'sipp'), dengan aturan
 * kepemilikan yang sama dengan Checklist & penjaga e-Court
 * (tentukanPemilikSipp: hanya kredensial aktif, pemilik tunggal).
 *
 * Tidak pernah menebak: tanpa akun milik sendiri = DITOLAK (bukan jatuh ke
 * panitera perkara atau nama lain - keputusan 2 Okt 2026, butir 39). Bila
 * seseorang memiliki lebih dari satu akun SIPP, ia memilih salah satunya;
 * akun yang bukan miliknya ditolak. Bot memastikan sekali lagi bahwa akun itu
 * ada dan tidak diblokir di sys_users.
 */

import { type AletaDatabase } from "@/server/db/client";
import { bacaKredensialSipp, tentukanPemilikSipp, type KredensialSipp } from "@/server/modules/aleta-ecourt/checklist-milestone";

export type PilihanAkunSipp =
  | { ok: true; username: string; milik: string[] }
  | { ok: false; alasan: "akun_sipp_belum_tertaut" | "akun_sipp_ganda" | "akun_sipp_bukan_milik_anda"; pesan: string; milik: string[] };

/** Username SIPP milik pengguna ini - aturan tentukanPemilikSipp. Ejaan dari simpanannya. */
export function akunSippMilik(kredensial: KredensialSipp[], aktorId: string): string[] {
  const pemilik = tentukanPemilikSipp(kredensial);
  const hasil: string[] = [];
  for (const k of kredensial) {
    if (k.userId !== aktorId || !k.aktif) continue;
    const kunci = k.username.trim().toLowerCase();
    if (!kunci || pemilik.get(kunci)?.pemilik !== aktorId) continue;
    if (!hasil.some((x) => x.toLowerCase() === kunci)) hasil.push(k.username.trim());
  }
  return hasil;
}

export function pilihAkunSipp(kredensial: KredensialSipp[], aktorId: string, diminta?: unknown): PilihanAkunSipp {
  const milik = akunSippMilik(kredensial, aktorId);
  const minta = String(diminta ?? "").trim();
  if (minta) {
    const cocok = milik.find((x) => x.toLowerCase() === minta.toLowerCase());
    if (!cocok) {
      return {
        ok: false,
        alasan: "akun_sipp_bukan_milik_anda",
        pesan: `Akun SIPP "${minta.slice(0, 64)}" tidak tersimpan sebagai milik Anda di ALETA - Court Calendar hanya ditulis atas akun SIPP Anda sendiri.`,
        milik,
      };
    }
    return { ok: true, username: cocok, milik };
  }
  if (milik.length === 0) {
    return {
      ok: false,
      alasan: "akun_sipp_belum_tertaut",
      pesan:
        "Akun ALETA Anda belum tertaut ke akun SIPP. Simpan username & password SIPP Anda di Manajemen Akun (aktif), lalu coba lagi - Court Calendar tidak ditulis atas nama orang lain.",
      milik,
    };
  }
  if (milik.length > 1) {
    return {
      ok: false,
      alasan: "akun_sipp_ganda",
      pesan: `Anda menyimpan ${milik.length} akun SIPP (${milik.join(", ")}). Pilih akun yang dipakai.`,
      milik,
    };
  }
  return { ok: true, username: milik[0], milik };
}

export async function akunSippPengguna(db: AletaDatabase, aktorId: string, diminta?: unknown): Promise<PilihanAkunSipp> {
  return pilihAkunSipp(await bacaKredensialSipp(db), aktorId, diminta);
}
