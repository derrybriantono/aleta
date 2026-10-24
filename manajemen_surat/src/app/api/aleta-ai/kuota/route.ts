import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pelakuAiBerhak, wajibSuperAdmin } from "@/server/modules/aleta-ai/akses";
import { bacaKuotaPeran, berikanKuotaSemua, simpanKuotaPeran, type KuotaPeran } from "@/server/modules/aleta-ai/kuota";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { handleRouteError, ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ALETA Ai - kuota hibah per peran (HANYA Super Admin; matriks "aleta-ai.kelola-dompet").
 *   GET  -> [{peranId, kuotaBulananRp}]
 *   PUT  {kuota:[{peranId, kuotaBulananRp}]} -> daftar sesudah disimpan (0 = hapus)
 *   POST -> {penerima, totalRp}: beri kuota bulan ini ke semua pengguna aktif (idempoten, mutasi "kuota")
 */
async function superAdmin(request: NextRequest) {
  const db = await getDatabase();
  const pelaku = await pelakuAiBerhak(db, await resolveActorUserId(request), "aleta-ai.kelola-dompet");
  wajibSuperAdmin(pelaku);
  return { db, pelaku };
}

export async function GET(request: NextRequest) {
  try {
    const { db } = await superAdmin(request);
    return ok(await bacaKuotaPeran(db));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { db, pelaku } = await superAdmin(request);
    const badan = (await request.json().catch(() => null)) as { kuota?: KuotaPeran[] } | null;
    if (!badan || !Array.isArray(badan.kuota)) throw new ApiError(400, "Isi permintaan tidak terbaca.");
    return ok(await simpanKuotaPeran(db, pelaku.id, badan.kuota));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { db, pelaku } = await superAdmin(request);
    return ok(await berikanKuotaSemua(db, pelaku.id));
  } catch (error) {
    return handleRouteError(error);
  }
}
