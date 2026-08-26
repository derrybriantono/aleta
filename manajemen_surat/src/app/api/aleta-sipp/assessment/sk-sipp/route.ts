import { type NextRequest } from "next/server";

import { AletaSippMonitoringService } from "@/server/modules/aleta-sipp/aleta-sipp-monitoring-service";
import { handleRouteError, ok } from "@/server/shared/http";
import { getNumberSearchParam } from "@/server/shared/request";
import { monitoringContext } from "../../monitoring/_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { db, actor } = await monitoringContext(request);
    const year = getNumberSearchParam(request, "year");
    const [stats, triwulan] = await Promise.all([
      AletaSippMonitoringService.getMonitoringStats(db, actor),
      AletaSippMonitoringService.getTriwulanOptions(db, actor, year),
    ]);
    return ok({ stats, triwulan });
  } catch (error) {
    return handleRouteError(error);
  }
}
