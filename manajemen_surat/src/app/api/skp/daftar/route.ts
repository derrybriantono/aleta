import { type NextRequest } from "next/server";

import { tanganiDaftarSkp } from "@/server/modules/skp/rute";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Dokumen SKP yang dapat diunduh (menu unduhan), semua jenis:
 *
 *   ?jenis=hakim|pimpinan|<jabatan>&id=&pegawai=&tahun=&periode=(b01..b12|tw1..tw4|tahun)
 *
 * Bentuk jawaban sama dengan /api/aleta-ecourt/eviden-skp, ditambah `jenis`,
 * `penetapan`, dan `dariPenetapan`.
 */
export async function GET(request: NextRequest) {
  return tanganiDaftarSkp(request);
}
