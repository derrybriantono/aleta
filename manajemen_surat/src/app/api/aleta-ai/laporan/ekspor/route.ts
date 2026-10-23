import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pelakuAiBerhak, wajibSuperAdmin } from "@/server/modules/aleta-ai/akses";
import { laporanKeCsv, laporanKeXlsx, laporanRentang } from "@/server/modules/aleta-ai/laporan";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { handleRouteError } from "@/server/shared/http";
import { getSearchParam } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ALETA Ai - GET /api/aleta-ai/laporan/ekspor?dari=YYYY-MM&sampai=YYYY-MM&format=csv|xlsx (HANYA Super Admin).
 * Pendapatan, biaya API, MDR, laba per bulan/pengguna/peran/kelompok/model. Hanya metadata biaya.
 */
export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    wajibSuperAdmin(await pelakuAiBerhak(db, await resolveActorUserId(request), "aleta-ai.kelola-dompet"));
    const format = String(getSearchParam(request, "format") ?? "xlsx").toLowerCase();
    if (format !== "csv" && format !== "xlsx") throw new ApiError(400, "Format ekspor harus csv atau xlsx.");
    const bulan = String(getSearchParam(request, "bulan") ?? "");
    const lap = await laporanRentang(db, String(getSearchParam(request, "dari") ?? "") || bulan, String(getSearchParam(request, "sampai") ?? "") || bulan);
    const nama = `laporan-aleta-ai-${lap.dari}${lap.sampai !== lap.dari ? `-sd-${lap.sampai}` : ""}.${format}`;
    const isi: BlobPart = format === "csv" ? laporanKeCsv(lap) : new Uint8Array(laporanKeXlsx(lap));
    const jenis = format === "csv" ? "text/csv; charset=utf-8" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    return new Response(new Blob([isi]), {
      headers: { "Content-Type": jenis, "Content-Disposition": `attachment; filename="${nama}"`, "Cache-Control": "no-store" },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
