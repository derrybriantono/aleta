import { type NextRequest } from "next/server";

import { AletaSippMonitoringService } from "@/server/modules/aleta-sipp/aleta-sipp-monitoring-service";
import { handleRouteError, ok } from "@/server/shared/http";
import { getNumberSearchParam } from "@/server/shared/request";
import { monitoringContext } from "../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { db, actor } = await monitoringContext(request);
    return ok(await AletaSippMonitoringService.getTriwulanOptions(db, actor, getNumberSearchParam(request, "year")));
  } catch (error) {
    return handleRouteError(error);
  }
}
