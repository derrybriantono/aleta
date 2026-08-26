import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { AletaSippMonitoringService } from "@/server/modules/aleta-sipp/aleta-sipp-monitoring-service";
import { requireActorUser } from "@/server/modules/organization/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await readJsonBody<{
      indicatorKey?: string;
      periodStart?: string;
      periodEnd?: string;
      value?: unknown;
      notes?: string;
      status?: string;
      evidence?: unknown;
    }>(request);
    const db = await getDatabase();
    const actor = await requireActorUser(db, await resolveActorUserId(request));
    return ok(await AletaSippMonitoringService.saveManualInput(db, actor, body));
  } catch (error) {
    return handleRouteError(error);
  }
}
