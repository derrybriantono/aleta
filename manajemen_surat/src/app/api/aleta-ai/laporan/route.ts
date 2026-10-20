import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pelakuAi, wajibSuperAdmin } from "@/server/modules/aleta-ai/akses";
import { laporanBulanan } from "@/server/modules/aleta-ai/laporan";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";
import { getSearchParam } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ALETA Ai - GET /api/aleta-ai/laporan?bulan=YYYY-MM (Super Admin).
 * {bulan, pendapatanRp, biayaApiRp, biayaMdrRp, labaRp, ringkasan:{...}, perPengguna, perPeran, perKelompok, perModel:
 *  [{nama, giliran, pendapatanRp, biayaApiRp, labaRp, ...}]}. Hanya metadata biaya: tidak ada isi percakapan.
 */
export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    wajibSuperAdmin(await pelakuAi(db, await resolveActorUserId(request)));
    return ok(await laporanBulanan(db, String(getSearchParam(request, "bulan") ?? "")));
  } catch (error) {
    return handleRouteError(error);
  }
}
