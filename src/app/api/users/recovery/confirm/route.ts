import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { confirmPasswordRecoveryInDb } from "@/server/modules/users/service";
import { isApiError } from "@/server/shared/errors";
import { handleRouteError, ok } from "@/server/shared/http";
import { assertRateLimit, clearRateLimit, recordRateLimitFailure } from "@/server/shared/rate-limit";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let rateLimitKey = "";

  try {
    const body = await readJsonBody<{
      userId: string;
      otp: string;
      password: string;
    }>(request);
    rateLimitKey = body.userId;
    assertRateLimit("recovery-confirm", request, rateLimitKey);
    const db = await getDatabase();
    const result = await confirmPasswordRecoveryInDb(db, body);
    clearRateLimit("recovery-confirm", request, rateLimitKey);

    return ok(result);
  } catch (error) {
    if (rateLimitKey && !(isApiError(error) && error.status === 429)) {
      recordRateLimitFailure("recovery-confirm", request, rateLimitKey);
    }
    return handleRouteError(error);
  }
}
