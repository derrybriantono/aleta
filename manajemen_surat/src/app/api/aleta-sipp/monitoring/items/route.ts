import { type NextRequest } from "next/server";

import { AletaSippMonitoringService } from "@/server/modules/aleta-sipp/aleta-sipp-monitoring-service";
import { handleRouteError, ok } from "@/server/shared/http";
import { getSearchParam } from "@/server/shared/request";
import { monitoringContext, paginationParams } from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { db, actor } = await monitoringContext(request);
    return ok(
      await AletaSippMonitoringService.listMonitoringItems(db, actor, {
        runKey: getSearchParam(request, "runKey"),
        resultId: getSearchParam(request, "resultId"),
        groupKey: getSearchParam(request, "groupKey"),
        status: getSearchParam(request, "status"),
        followupStatus: getSearchParam(request, "followupStatus"),
        q: getSearchParam(request, "q"),
        ...paginationParams(request),
      })
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
