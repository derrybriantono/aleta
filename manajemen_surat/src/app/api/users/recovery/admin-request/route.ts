import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { createAdminResetRequestInDb } from "@/server/modules/users/service";
import { isApiError } from "@/server/shared/errors";
import { created, handleRouteError } from "@/server/shared/http";
import { assertRateLimit, clearRateLimit, recordRateLimitFailure } from "@/server/shared/rate-limit";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let rateLimitKey = "";

  try {
    const body = await readJsonBody<{ identifier: string }>(request);
    rateLimitKey = body.identifier?.trim() ?? "";
    assertRateLimit("recovery-admin-request", request, rateLimitKey);

    const db = await getDatabase();
    const result = await createAdminResetRequestInDb(db, { identifier: body.identifier });
    clearRateLimit("recovery-admin-request", request, rateLimitKey);

    return created({
      requestId: result.requestId,
      name: result.name,
      message: "Permintaan bantuan reset password berhasil dikirim. Admin atau Super Admin akan segera memverifikasi dan memproses permintaan ini.",
    });
  } catch (error) {
    if (rateLimitKey && !(isApiError(error) && error.status === 429)) {
      recordRateLimitFailure("recovery-admin-request", request, rateLimitKey);
    }
    return handleRouteError(error);
  }
}
