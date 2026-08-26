import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { adminManualResetPasswordInDb } from "@/server/modules/users/service";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { isApiError } from "@/server/shared/errors";
import { ok } from "@/server/shared/http";
import { assertRateLimit, clearRateLimit, recordRateLimitFailure } from "@/server/shared/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let actorId = "";
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let targetUserId = "unknown";

  try {
    const { id } = await params;
    targetUserId = id;
    db = await getDatabase();
    actorId = await resolveActorUserId(request);
    assertRateLimit("admin-manual-reset", request, actorId);

    const result = await adminManualResetPasswordInDb(db, {
      actorUserId: actorId,
      targetUserId,
    });

    clearRateLimit("admin-manual-reset", request, actorId);

    return ok({
      tempPassword: result.tempPassword,
      message: "Password berhasil direset. Sampaikan password sementara ini ke user secara langsung dan minta user segera menggantinya.",
    });
  } catch (error) {
    if (actorId && !(isApiError(error) && error.status === 429)) {
      recordRateLimitFailure("admin-manual-reset", request, actorId);
    }
    return handleAdminRouteError(error, request, {
      db,
      actorUserId: actorId,
      action: "USER_PASSWORD_RESET_ACCESS_FAILED",
      feature: "user_management",
      entityId: targetUserId,
    });
  }
}
