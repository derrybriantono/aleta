import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { lookupPublicEKepegawaianEmployee } from "@/server/modules/e-kepegawaian/service";
import { handleRouteError, ok } from "@/server/shared/http";
import { assertRateLimit, clearRateLimit, recordRateLimitFailure } from "@/server/shared/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let identifier = "lookup";
  try {
    const body = await request.json().catch(() => ({}));
    if (body && typeof body === "object") {
      const candidate = body as { value?: unknown; identifier?: unknown; name?: unknown; contact?: unknown };
      identifier = String(candidate.value ?? candidate.identifier ?? candidate.name ?? candidate.contact ?? "lookup");
    }
    assertRateLimit("hr-public-lookup", request, identifier);
    const db = await getDatabase();
    const result = await lookupPublicEKepegawaianEmployee(db, body);
    clearRateLimit("hr-public-lookup", request, identifier);
    return ok(result, {
      headers: {
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    recordRateLimitFailure("hr-public-lookup", request, identifier);
    return handleRouteError(error);
  }
}
