import type { AletaDatabase } from "@/server/db/client";
import { bacaKunci, tulisKunci } from "@/server/modules/tunda-otomatis/layanan";

/**
 * ============================================================================
 * ISI OTOMATIS DARI BERKAS e-COURT (G2, 25 Okt 2026) - SAKLAR SUPER ADMIN
 * ============================================================================
 *
 * Tiga saklar, SEMUANYA MATI bawaan (mati = perilaku persis seperti sebelum G2):
 *
 *   bukti       daftar alat bukti P.x / T.x dari e-Court yang "rapi" ditulis ke isian ABT yang KOSONG
 *               (penyunting bukti blangko Derry; variabel bukti halaman ABT). Tidak rapi = tetap usulan + tombol Salin.
 *   kesimpulan  kesimpulan para pihak yang "rapi" ditulis ke tanya-jawab kesimpulan sidang yang agendanya sesuai bila barisnya KOSONG.
 *   buktiSaksi  usulan pemetaan bukti <-> keterangan saksi (hanya usulan; tidak menulis apa pun ke ABT/SIPP).
 *
 * Disimpan di aleta_ekstensi_setelan (pengguna '*sistem*', kunci 'sistem:ecourt-berkas-otomatis'), tanpa migrasi - pola yang sama dengan
 * tunda otomatis dan penjaga tenggat. Hanya Super Admin yang mengubah (ditegakkan rute). Membaca TIDAK pernah melempar: galat baca = semua mati.
 *
 * Berkas e-Court HANYA dibaca. Surat gugatan tidak dibaca ulang (sudah ada di SIPP). SIPP hanya dibaca.
 */

export const KUNCI_BERKAS_OTOMATIS = "sistem:ecourt-berkas-otomatis";

export type SetelanBerkasOtomatis = {
  bukti: boolean;
  kesimpulan: boolean;
  buktiSaksi: boolean;
  diubahOleh: string;
  diubahPada: string;
};

export const SETELAN_BERKAS_BAWAAN: Readonly<SetelanBerkasOtomatis> = Object.freeze({
  bukti: false,
  kesimpulan: false,
  buktiSaksi: false,
  diubahOleh: "",
  diubahPada: "",
});

const teks = (x: unknown) => String(x ?? "").trim();

export function bersihkanSetelanBerkas(mentah: unknown): SetelanBerkasOtomatis {
  const m = (mentah && typeof mentah === "object" ? mentah : {}) as Record<string, unknown>;
  return {
    bukti: m.bukti === true,
    kesimpulan: m.kesimpulan === true,
    buktiSaksi: m.buktiSaksi === true,
    diubahOleh: teks(m.diubahOleh).slice(0, 120),
    diubahPada: teks(m.diubahPada).slice(0, 40),
  };
}

/** Setelan tersimpan; apa pun yang gagal terbaca = semua MATI. */
export async function bacaSetelanBerkas(db: AletaDatabase): Promise<SetelanBerkasOtomatis> {
  try {
    return bersihkanSetelanBerkas(await bacaKunci(db, KUNCI_BERKAS_OTOMATIS));
  } catch {
    return { ...SETELAN_BERKAS_BAWAAN };
  }
}

/** Hanya dipanggil rute yang sudah memastikan Super Admin. */
export async function simpanSetelanBerkas(
  db: AletaDatabase,
  aktor: { id: string; name?: string | null },
  badan: Record<string, unknown>
): Promise<SetelanBerkasOtomatis> {
  const lama = await bacaSetelanBerkas(db);
  const baru = bersihkanSetelanBerkas({
    bukti: typeof badan.bukti === "boolean" ? badan.bukti : lama.bukti,
    kesimpulan: typeof badan.kesimpulan === "boolean" ? badan.kesimpulan : lama.kesimpulan,
    buktiSaksi: typeof badan.buktiSaksi === "boolean" ? badan.buktiSaksi : lama.buktiSaksi,
    diubahOleh: teks(aktor.name) || aktor.id,
    diubahPada: new Date().toISOString(),
  });
  await tulisKunci(db, KUNCI_BERKAS_OTOMATIS, baru);
  return baru;
}
