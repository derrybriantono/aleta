import { type NextRequest } from "next/server";

import { AletaSippMonitoringService } from "@/server/modules/aleta-sipp/aleta-sipp-monitoring-service";
import { handleRouteError, ok } from "@/server/shared/http";
import { getSearchParam } from "@/server/shared/request";
import { monitoringContext, paginationParams } from "../monitoring/_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { db, actor } = await monitoringContext(request);
    return ok(
      await AletaSippMonitoringService.listPendukung2018Features(db, actor, {
        q: getSearchParam(request, "q"),
        groupKey: getSearchParam(request, "groupKey"),
        implementationStatus: getSearchParam(request, "implementationStatus"),
        safetyStatus: getSearchParam(request, "safetyStatus"),
        reviewStatus: getSearchParam(request, "reviewStatus"),
        ...paginationParams(request),
      })
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
