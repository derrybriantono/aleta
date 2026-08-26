import { type NextRequest } from "next/server";

import { AletaSippMonitoringService } from "@/server/modules/aleta-sipp/aleta-sipp-monitoring-service";
import { handleRouteError, ok } from "@/server/shared/http";
import { readJsonBody } from "@/server/shared/request";
import { monitoringContext } from "../../../../monitoring/_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    featureKey: string;
  }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { featureKey } = await context.params;
    const body = await readJsonBody<{ action?: string; notes?: string; executionMode?: string; confidenceScore?: number }>(request).catch(() => ({}));
    const { db, actor } = await monitoringContext(request);
    return ok(await AletaSippMonitoringService.reviewMonitoringFeatureQuery(db, actor, featureKey, body));
  } catch (error) {
    return handleRouteError(error);
  }
}
