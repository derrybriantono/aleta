import { type NextRequest } from "next/server";

import { AletaSippMonitoringService } from "@/server/modules/aleta-sipp/aleta-sipp-monitoring-service";
import { handleRouteError, ok } from "@/server/shared/http";
import { monitoringContext } from "../../../../monitoring/_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    groupKey: string;
  }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { groupKey } = await context.params;
    const { db, actor } = await monitoringContext(request);
    return ok(await AletaSippMonitoringService.getPendukung2018GroupStats(db, actor, groupKey));
  } catch (error) {
    return handleRouteError(error);
  }
}
