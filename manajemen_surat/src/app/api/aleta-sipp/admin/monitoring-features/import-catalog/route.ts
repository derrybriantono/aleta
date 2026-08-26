import { type NextRequest } from "next/server";

import { AletaSippMonitoringService } from "@/server/modules/aleta-sipp/aleta-sipp-monitoring-service";
import { handleRouteError, ok } from "@/server/shared/http";
import { monitoringContext } from "../../../monitoring/_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { db, actor } = await monitoringContext(request);
    return ok(await AletaSippMonitoringService.importPendukung2018FeatureCatalog(db, actor));
  } catch (error) {
    return handleRouteError(error);
  }
}
