import { type NextRequest } from "next/server";

import { bacaLembarUntukLayar, bacaParameterLembar } from "@/server/modules/skp/layanan";
import { jalankanRuteSkp } from "@/server/modules/skp/rute-umum";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Lembar SKP satu pegawai untuk satu periode (layar, bukan unduhan).
 *
 *   ?jenis=pimpinan|<jabatan>&pegawai=<id pengguna>&tahun=2026&periode=b09|tw3|tahun
 *    [&tambahan=0][&langsung=1][&id=<ID SIPP hakim>]
 *
 * Tanpa ?pegawai= = pegawai itu aktor sendiri. Hak: bolehLihatSkp (sendiri,
 * atasan langsung, Ketua/Wakil/Panitera, Super Admin/Admin) - 403 bagi lainnya
 * SEBELUM data SIPP dibaca. Penetapan terkunci dipakai apa adanya kecuali
 * ?langsung=1. Bot yang tidak terjangkau tidak menggagalkan layar:
 * sippTerjangkau=false dan indikator SIPP "—".
 */
export async function GET(request: NextRequest) {
  return jalankanRuteSkp(request, "SKP_LEMBAR_FAILED", async ({ db, aktor }) =>
    ok(await bacaLembarUntukLayar(db, aktor, bacaParameterLembar(request.nextUrl.searchParams)))
  );
}
