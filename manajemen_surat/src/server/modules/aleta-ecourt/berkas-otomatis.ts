import { KODE_FITUR_EC_BUKTI, KODE_FITUR_EC_BUKTI_SAKSI, KODE_FITUR_EC_KESIMPULAN } from "@/lib/berkas-ecourt-fitur";
import type { AletaDatabase } from "@/server/db/client";
import { fiturMenyala } from "@/server/modules/satker/fitur";

/**
 * ============================================================================
 * ISI OTOMATIS DARI BERKAS e-COURT (G2, 25 Okt 2026) - SAKLAR FITUR SATKER
 * ============================================================================
 *
 * Tiga saklar, SEMUANYA MATI bawaan (mati = perilaku persis seperti sebelum G2). Sejak 26 Okt 2026 (keputusan Derry)
 * saklarnya butir Fitur Satker (hanya Super Admin), bukan lagi kartu di layar Tenggat:
 *
 *   bukti       ecourt-bukti-otomatis      daftar alat bukti P.x / T.x yang "rapi" ditulis ke isian ABT yang KOSONG
 *   kesimpulan  ecourt-kesimpulan-otomatis kesimpulan para pihak yang "rapi" ditulis ke tanya-jawab kesimpulan bila barisnya KOSONG
 *   buktiSaksi  ecourt-bukti-saksi-usulan  usulan pemetaan bukti <-> keterangan saksi (hanya usulan; tidak menulis apa pun)
 *
 * Membaca TIDAK pernah melempar: galat baca = semua mati. Berkas e-Court HANYA dibaca. SIPP hanya dibaca.
 */

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

/** Setelan menurut Fitur Satker; apa pun yang gagal terbaca = semua MATI. */
export async function bacaSetelanBerkas(db: AletaDatabase): Promise<SetelanBerkasOtomatis> {
  try {
    const [bukti, kesimpulan, buktiSaksi] = await Promise.all([
      fiturMenyala(db, KODE_FITUR_EC_BUKTI),
      fiturMenyala(db, KODE_FITUR_EC_KESIMPULAN),
      fiturMenyala(db, KODE_FITUR_EC_BUKTI_SAKSI),
    ]);
    return bersihkanSetelanBerkas({ bukti, kesimpulan, buktiSaksi });
  } catch {
    return { ...SETELAN_BERKAS_BAWAAN };
  }
}
