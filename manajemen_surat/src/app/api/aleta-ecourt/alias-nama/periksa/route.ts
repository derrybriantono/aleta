import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { periksaNamaPihak } from "@/server/modules/aleta-ecourt/alias-nama";
import { requireActorUser } from "@/server/modules/organization/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { handleRouteError, ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Pemeriksa ejaan dan nama pihak (U18, rantai B) untuk siapa saja yang masuk.
 *
 *   POST {nama: [{asal, nama}, ...]} -> { tersedia, jumlahNama, usulan: [{jenis, tingkat, pesan, nama, usulanBaku}], kamusKosong }
 *
 * Kamus tidak pernah dikirim: yang kembali hanya usulan atas nama yang dikirim pemanggil. HANYA USULAN - tidak ada yang
 * ditulis ke SIPP, ABT, atau e-Court. Saklar kinerja.ejaanNamaPihak mati (bawaan) -> { tersedia: false }.
 */
export async function POST(request: NextRequest) {
  try {
    const db = await getDatabase();
    await requireActorUser(db, await resolveActorUserId(request));
    let b: unknown;
    try {
      b = await request.json();
    } catch {
      throw new ApiError(400, "Badan permintaan harus JSON.");
    }
    return ok(await periksaNamaPihak(db, b));
  } catch (error) {
    return handleRouteError(error);
  }
}
