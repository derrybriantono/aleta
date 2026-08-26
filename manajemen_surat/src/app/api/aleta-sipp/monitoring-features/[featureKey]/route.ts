import { type NextRequest } from "next/server";

import { AletaSippMonitoringService } from "@/server/modules/aleta-sipp/aleta-sipp-monitoring-service";
import { handleRouteError, ok } from "@/server/shared/http";
import { monitoringContext } from "../../monitoring/_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    featureKey: string;
  }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { featureKey } = await context.params;
    const { db, actor } = await monitoringContext(request);
    return ok(await AletaSippMonitoringService.getPendukung2018FeatureDetail(db, actor, featureKey));
  } catch (error) {
    return handleRouteError(error);
  }
}
