import { type NextRequest } from "next/server";

import { tanganiUnduhSkp } from "@/server/modules/skp/rute";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Unduhan SKP, semua jenis (PDF, Excel, Word, atau ZIP):
 *
 *   ?jenis=hakim|pimpinan|<jabatan>&id=<ID SIPP hakim>&pegawai=<id pengguna>
 *    &tahun=2026&periode=b09|tw3|tahun&dokumen=lembar-skp|bukti-<rhk>|semua
 *    &format=pdf|xlsx|docx[&tanggal=2026-09-30][&tambahan=0][&langsung=1]
 *
 * Alamat dapat disusun dengan alamatUnduhSkp (lib/eviden-skp-unduh). Hak:
 * hakim dan pimpinan memerlukan kemampuan "panel" (isinya eviden hakim),
 * jabatan perkara dan pimpinan memerlukan hak lihat pegawai (bolehLihatSkp).
 * Tiap unduhan yang berhasil dicatat di jejak audit.
 */
export async function GET(request: NextRequest) {
  return tanganiUnduhSkp(request);
}
