import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { createPasswordRecoveryDraftInDb } from "@/server/modules/users/service";
import { isApiError } from "@/server/shared/errors";
import { created, handleRouteError } from "@/server/shared/http";
import { assertRateLimit, clearRateLimit, recordRateLimitFailure } from "@/server/shared/rate-limit";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let requestedNip = "";

  try {
    const body = await readJsonBody<{
      nip: string;
    }>(request);
    requestedNip = body.nip;
    assertRateLimit("recovery-request", request, requestedNip);
    const db = await getDatabase();
    const recovery = await createPasswordRecoveryDraftInDb(db, body.nip);
    clearRateLimit("recovery-request", request, requestedNip);

    return created({
      recovery: {
        userId: recovery.userId,
        username: recovery.username,
        name: recovery.name,
        maskedWhatsapp: recovery.maskedWhatsapp,
      },
    });
  } catch (error) {
    if (requestedNip && !(isApiError(error) && error.status === 429)) {
      recordRateLimitFailure("recovery-request", request, requestedNip);
    }
    return handleRouteError(error);
  }
}
