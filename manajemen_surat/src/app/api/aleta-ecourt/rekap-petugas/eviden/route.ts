import { type NextRequest } from "next/server";

import { tanganiEvidenRekap } from "@/server/modules/aleta-ecourt/eviden-skp-rekap";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Eviden SKP dari Rekap Petugas untuk PP, Juru Sita, dan Mediator yang akunnya
 * belum tertaut ke pegawai (Pemetaan SKP). ?aksi=daftar|unduh. Hak: kemampuan
 * panel, sama dengan tombol hakim. Lihat modules/aleta-ecourt/eviden-skp-rekap.
 */
export async function GET(request: NextRequest) {
  return tanganiEvidenRekap(request);
}
