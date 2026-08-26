import { type NextRequest } from "next/server";

import { AletaSippMonitoringService } from "@/server/modules/aleta-sipp/aleta-sipp-monitoring-service";
import { handleRouteError, ok } from "@/server/shared/http";
import { readJsonBody } from "@/server/shared/request";
import { monitoringContext } from "../../../../../monitoring/_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    inputId: string;
  }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { inputId } = await context.params;
    const body = await readJsonBody<{ status?: string; reviewNotes?: string }>(request).catch(() => ({}));
    const { db, actor } = await monitoringContext(request);
    return ok(await AletaSippMonitoringService.reviewManualInput(db, actor, inputId, body));
  } catch (error) {
    return handleRouteError(error);
  }
}

export const POST = PATCH;
