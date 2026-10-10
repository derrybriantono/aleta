import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { bacaRekapKasir, pastikanHakKasir } from "@/server/modules/aleta-ecourt/kasir-otomatis";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Rekap pengeluaran kasir (1.189.x butir 4).
 *
 *   GET ?periode=harian|mingguan|bulanan|triwulan|semester|tahunan&tanggal=YYYY-MM-DD
 *
 * Periode yang MEMUAT tanggal itu (minggu Senin-Minggu). Hanya membaca SIPP.
 * PDF-nya: ./pdf dengan parameter yang sama.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanHakKasir(db, actorUserId);
    const q = request.nextUrl.searchParams;
    const hasil = await bacaRekapKasir(String(q.get("periode") || "harian"), String(q.get("tanggal") || ""));
    if (!hasil.ok) return ok({ available: false, ok: false, alasan: hasil.alasan });
    return ok({ available: true, ok: true, rekap: hasil.rekap });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "SIPP_KASIR_REKAP_READ_FAILED",
      feature: "aleta_ecourt",
    });
  }
}
