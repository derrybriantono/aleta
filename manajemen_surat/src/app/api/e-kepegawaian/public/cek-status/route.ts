import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { checkPublicEKepegawaianStatus } from "@/server/modules/e-kepegawaian/service";
import { handleRouteError, ok } from "@/server/shared/http";
import { getRequestAuditMetadata } from "@/server/shared/request";
import { assertRateLimit, clearRateLimit, recordRateLimitFailure } from "@/server/shared/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let identifier = "status";
  try {
    assertRateLimit("hr-public-status", request, identifier);
    const body = await request.json().catch(() => ({}));
    if (body && typeof body === "object" && "ticketCode" in body) {
      identifier = String((body as { ticketCode?: unknown }).ticketCode ?? "status");
    }
    const db = await getDatabase();
    const result = await checkPublicEKepegawaianStatus(db, body, getRequestAuditMetadata(request));
    clearRateLimit("hr-public-status", request, identifier);
    return ok(result, {
      headers: {
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    recordRateLimitFailure("hr-public-status", request, identifier);
    return handleRouteError(error);
  }
}
