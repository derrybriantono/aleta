import { type NextRequest } from "next/server";

import { bacaLingkup, daftarPegawaiUntukAktor } from "@/server/modules/skp/layanan";
import { jalankanRuteSkp } from "@/server/modules/skp/rute-umum";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Daftar pegawai yang SKP-nya boleh dilihat aktor (layar SKP).
 *
 *   ?lingkup=saya|bawahan|semua
 *
 * saya = dirinya; bawahan = yang atasan langsungnya aktor; semua = hanya
 * Ketua, Wakil Ketua, Panitera, Super Admin, Admin (403 bagi lainnya).
 */
export async function GET(request: NextRequest) {
  return jalankanRuteSkp(request, "SKP_PEGAWAI_FAILED", async ({ db, aktor }) =>
    ok(await daftarPegawaiUntukAktor(db, aktor, bacaLingkup(request.nextUrl.searchParams.get("lingkup"))))
  );
}
