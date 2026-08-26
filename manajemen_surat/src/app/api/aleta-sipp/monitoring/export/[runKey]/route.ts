import { type NextRequest } from "next/server";

import { AletaSippMonitoringService } from "@/server/modules/aleta-sipp/aleta-sipp-monitoring-service";
import { badRequest, handleRouteError } from "@/server/shared/http";
import { monitoringContext } from "../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    runKey: string;
  }>;
};

function parseRunExportSegment(segment: string) {
  const value = decodeURIComponent(segment || "").trim();
  if (value.toLowerCase().endsWith(".xlsx")) {
    return { runKey: value.slice(0, -5), format: "xlsx" as const };
  }
  if (value.toLowerCase().endsWith(".pdf")) {
    return { runKey: value.slice(0, -4), format: "pdf" as const };
  }
  badRequest("Format export monitoring harus .xlsx atau .pdf.");
  throw new Error("Invalid export format.");
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { runKey: segment } = await context.params;
    const parsed = parseRunExportSegment(segment);
    const { db, actor } = await monitoringContext(request);
    const exportPayload = await AletaSippMonitoringService.exportRun(db, actor, parsed.runKey, parsed.format);
    return new Response(new Blob([exportPayload.body], { type: exportPayload.contentType }), {
      headers: {
        "content-type": exportPayload.contentType,
        "content-disposition": `attachment; filename="${exportPayload.filename}"`,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
