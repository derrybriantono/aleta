import { type NextRequest } from "next/server";

import { bacaIdSipp } from "@/lib/rekap-petugas";
import { jalankanRuteSkp } from "@/server/modules/skp/rute-umum";
import { pegawaiDariRekap, peranRekapEvidenSah } from "@/server/modules/skp/rekap-pegawai";
import { ApiError } from "@/server/shared/errors";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Pegawai di balik halaman Rekap Petugas, untuk tombol "Unduh eviden SKP".
 *
 *   ?peran=panitera|jurusita|mediator&id=<id SIPP>
 *
 * Jawab { tersedia, jenis, pegawai, ... } atau { tersedia:false, alasan }.
 * Yang tidak berhak, tidak tertaut, atau nonaktif dijawab tersedia:false
 * (200) - halaman rekap tetap terbuka, hanya tanpa tombol.
 */
export async function GET(request: NextRequest) {
  return jalankanRuteSkp(request, "SKP_REKAP_PEGAWAI_FAILED", async ({ db, aktor }) => {
    const peran = String(request.nextUrl.searchParams.get("peran") ?? "").trim().toLowerCase();
    if (!peranRekapEvidenSah(peran)) throw new ApiError(400, "Peran harus panitera, jurusita, atau mediator.");
    const id = bacaIdSipp(request.nextUrl.searchParams.get("id"));
    if (id === null) throw new ApiError(400, "ID SIPP harus bilangan bulat positif.");
    return ok(await pegawaiDariRekap(db, aktor, { peran, id }));
  });
}
