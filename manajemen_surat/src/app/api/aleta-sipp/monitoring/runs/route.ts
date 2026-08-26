import { type NextRequest } from "next/server";

import { AletaSippMonitoringService } from "@/server/modules/aleta-sipp/aleta-sipp-monitoring-service";
import { handleRouteError, ok } from "@/server/shared/http";
import { getNumberSearchParam, getSearchParam } from "@/server/shared/request";
import { monitoringContext, paginationParams } from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { db, actor } = await monitoringContext(request);
    return ok(
      await AletaSippMonitoringService.listRuns(db, actor, {
        runType: getSearchParam(request, "runType"),
        year: getNumberSearchParam(request, "year"),
        quarter: getNumberSearchParam(request, "quarter"),
        status: getSearchParam(request, "status"),
        ...paginationParams(request),
      })
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
