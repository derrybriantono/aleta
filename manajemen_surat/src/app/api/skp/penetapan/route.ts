import { type NextRequest } from "next/server";

import { bacaParameterLembar, bacaPenetapanUntukLayar, tetapkanSkp } from "@/server/modules/skp/layanan";
import { bacaIsiJson, jalankanRuteSkp } from "@/server/modules/skp/rute-umum";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Penetapan SKP: tangkapan realisasi yang dikunci.
 *
 *   GET  ?jenis=&pegawai=&tahun=&periode=   penetapan yang ada (draf/terkunci) beserta Lembar-nya
 *   POST {jenis, pegawai, tahun, periode, id?, kunci?: true, tambahan?}
 *        menghitung SEKARANG dari SIPP lalu menyimpan sebagai draf, atau
 *        MENGUNCI bila kunci=true. Hanya atasan langsung, Ketua, Panitera,
 *        Super Admin, Admin (bukan pegawainya sendiri). Yang sudah terkunci
 *        ditolak 409 dan tidak pernah berubah lagi; bot yang gagal
 *        menggagalkan penetapan (angka "—" tidak boleh terkunci diam-diam).
 */
export async function GET(request: NextRequest) {
  return jalankanRuteSkp(request, "SKP_PENETAPAN_FAILED", async ({ db, aktor }) =>
    ok(await bacaPenetapanUntukLayar(db, aktor, bacaParameterLembar(request.nextUrl.searchParams)))
  );
}

export async function POST(request: NextRequest) {
  return jalankanRuteSkp(request, "SKP_PENETAPAN_SIMPAN_FAILED", async ({ db, aktor }) =>
    ok(await tetapkanSkp(db, aktor, await bacaIsiJson(request)))
  );
}
