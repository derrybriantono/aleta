import { type NextRequest } from "next/server";

import { AletaSippMonitoringService } from "@/server/modules/aleta-sipp/aleta-sipp-monitoring-service";
import { handleRouteError, ok } from "@/server/shared/http";
import { readJsonBody } from "@/server/shared/request";
import { monitoringContext } from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await readJsonBody<{
      runType?: string;
      year?: number;
      quarter?: number;
      dateStart?: string;
      dateEnd?: string;
      datasourceMode?: string;
      selectedIndicatorKeys?: string[];
      selectedFeatureKeys?: string[];
      dryRun?: boolean;
    }>(request).catch(() => ({}));
    const { db, actor } = await monitoringContext(request);
    return ok(await AletaSippMonitoringService.runMonitoring(db, actor, body));
  } catch (error) {
    return handleRouteError(error);
  }
}
