import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pelakuAi, wajibSuperAdmin } from "@/server/modules/aleta-ai/akses";
import { laporanRentang } from "@/server/modules/aleta-ai/laporan";
import { rekonsiliasiHarianBilaPerlu } from "@/server/modules/aleta-ai/rekonsiliasi";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";
import { getSearchParam } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ALETA Ai - GET /api/aleta-ai/laporan?bulan=YYYY-MM | ?dari=YYYY-MM&sampai=YYYY-MM (Super Admin).
 * {bulan, dari, sampai, pendapatanRp, biayaApiRp, biayaMdrRp, labaRp, ringkasan:{...}, perPengguna, perPeran, perKelompok,
 *  perModel, perBulan: [{nama, giliran, pendapatanRp, biayaApiRp, biayaMdrRp, labaRp, ...}]}.
 * laba = pendapatan - biaya API - MDR. Hanya metadata biaya: tidak ada isi percakapan.
 * Membuka laporan ikut menjalankan rekonsiliasi kemarin bila belum ada.
 */
export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    wajibSuperAdmin(await pelakuAi(db, await resolveActorUserId(request)));
    await rekonsiliasiHarianBilaPerlu(db);
    const bulan = String(getSearchParam(request, "bulan") ?? "");
    return ok(await laporanRentang(db, String(getSearchParam(request, "dari") ?? "") || bulan, String(getSearchParam(request, "sampai") ?? "") || bulan));
  } catch (error) {
    return handleRouteError(error);
  }
}
