import { getDatabase } from "@/server/db/client";
import { keadaanPemeliharaan, KEADAAN_MATI } from "@/server/modules/pemeliharaan/layanan";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Keadaan pemeliharaan untuk layar pemeliharaan dan pita pemberitahuan (E3).
 * TANPA sesi - layar pemeliharaan harus dapat bertanya "sudah selesai?" - dan
 * hanya memuat apa yang memang untuk dibaca pengguna: nyala/mati, pesan Super
 * Admin, dan perkiraan waktu. Gagal baca = "tidak ada pemeliharaan" (terbuka).
 */
export async function GET() {
  try {
    const keadaan = await keadaanPemeliharaan(await getDatabase());
    const { adminBoleh: _adminBoleh, ...publik } = keadaan;
    return ok(publik);
  } catch {
    const { adminBoleh: _adminBoleh, ...publik } = KEADAAN_MATI;
    return ok(publik);
  }
}
