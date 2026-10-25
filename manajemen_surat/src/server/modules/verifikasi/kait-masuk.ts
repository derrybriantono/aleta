import { APIError } from "better-auth/api";

import type { AletaDatabase } from "@/server/db/client";
import { putuskanMasuk, terbitkanTantangan } from "@/server/modules/verifikasi/layanan";

export const KODE_VERIFIKASI_DIPERLUKAN = "VERIFIKASI_DIPERLUKAN";

/**
 * Dipanggil kait sesi (perangkat/kait-auth.ts) untuk jalur MASUK, SESUDAH
 * password terbukti benar dan batas perangkat lolos. Saklar mati = kembali
 * seketika tanpa menyentuh apa pun selain satu bacaan pengaturan (disinggahkan).
 *
 * Gagal terbuka: bila keputusan tidak dapat dihitung (basis data), masuk
 * diteruskan dan kejadiannya dicatat di log server. Hanya penolakan yang
 * memang diputuskan (APIError 403 VERIFIKASI_DIPERLUKAN + tiket) yang dilempar.
 */
export async function tegakkanVerifikasi(db: AletaDatabase, m: { userId: string; perangkatId: string; ip: string; jalur: string }): Promise<void> {
  let keputusan: Awaited<ReturnType<typeof putuskanMasuk>>;
  try {
    keputusan = await putuskanMasuk(db, { userId: m.userId, perangkatId: m.perangkatId, ip: m.ip, konsumsi: true });
    if (!keputusan.perlu) {
      if (keputusan.sebab === "tanpa-metode") console.warn(`[VERIFIKASI] akun ${m.userId} wajib kode tetapi tidak punya cara menerimanya; masuk diteruskan.`);
      return;
    }
  } catch (galat) {
    console.warn("[VERIFIKASI] tidak dapat diperiksa; masuk diteruskan:", galat instanceof Error ? galat.message : "tidak diketahui");
    return;
  }
  let tiket: string;
  try {
    tiket = await terbitkanTantangan(db, { userId: m.userId, perangkatId: m.perangkatId, jalur: m.jalur });
  } catch (galat) {
    console.warn("[VERIFIKASI] tiket tidak dapat diterbitkan; masuk diteruskan:", galat instanceof Error ? galat.message : "tidak diketahui");
    return;
  }
  throw new APIError("FORBIDDEN", {
    message: "Masukkan kode verifikasi untuk melanjutkan masuk.",
    code: KODE_VERIFIKASI_DIPERLUKAN,
    tiket,
    sebab: keputusan.sebab,
    metode: keputusan.metode,
  });
}
