import { type NextRequest } from "next/server";

import { AletaSippMonitoringService } from "@/server/modules/aleta-sipp/aleta-sipp-monitoring-service";
import { handleRouteError, ok } from "@/server/shared/http";
import { readJsonBody } from "@/server/shared/request";
import { monitoringContext } from "../../../monitoring/_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { db, actor } = await monitoringContext(request);
    return ok(await AletaSippMonitoringService.listExternalConnectors(db, actor));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    type ConnectorBody = {
      featureKey?: string;
      connectorName?: string;
      endpoint?: string;
      host?: string;
      mode?: string;
      credentialReference?: string;
      status?: string;
      testConnection?: boolean;
    };
    const body = await readJsonBody<ConnectorBody>(request).catch((): ConnectorBody => ({}));
    const { db, actor } = await monitoringContext(request);
    return ok(await AletaSippMonitoringService.saveExternalConnectorConfig(db, actor, body.featureKey ?? "", body));
  } catch (error) {
    return handleRouteError(error);
  }
}
