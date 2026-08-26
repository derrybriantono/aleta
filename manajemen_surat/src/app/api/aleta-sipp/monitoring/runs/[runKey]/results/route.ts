import { type NextRequest } from "next/server";

import { AletaSippMonitoringService } from "@/server/modules/aleta-sipp/aleta-sipp-monitoring-service";
import { handleRouteError, ok } from "@/server/shared/http";
import { getSearchParam } from "@/server/shared/request";
import { monitoringContext, paginationParams } from "../../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    runKey: string;
  }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { runKey } = await context.params;
    const { db, actor } = await monitoringContext(request);
    return ok(
      await AletaSippMonitoringService.getRunResults(db, actor, runKey, {
        status: getSearchParam(request, "status"),
        ...paginationParams(request),
      })
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
