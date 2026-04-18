import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { readLetterSearchFiltersFromRequest } from "@/server/modules/letters/http";
import { getLetterStatisticsInDb } from "@/server/modules/stats/service";
import { getBooleanSearchParam, getSearchParam } from "@/server/shared/request";
import { handleRouteError, ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const filters = readLetterSearchFiltersFromRequest(request);
    const result = await getLetterStatisticsInDb(db, {
      ...filters,
      dimension: (getSearchParam(request, "dimension") as
        | "jenis"
        | "tahun"
        | "triwulan"
        | "klasifikasi"
        | "asal"
        | "status"
        | undefined) ?? "jenis",
      includeAIInsight: getBooleanSearchParam(request, "includeAIInsight") ?? false,
    });

    return ok(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
