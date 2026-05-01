import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { resolveAdminResetRequestInDb } from "@/server/modules/users/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { isApiError } from "@/server/shared/errors";
import { handleRouteError, ok } from "@/server/shared/http";
import { assertRateLimit, clearRateLimit, recordRateLimitFailure } from "@/server/shared/rate-limit";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  let actorId = "";

  try {
    const { requestId } = await params;
    const body = await readJsonBody<{
      action: "approve" | "reject";
      note?: string;
    }>(request);

    const db = await getDatabase();
    actorId = await resolveActorUserId(request);
    assertRateLimit("recovery-admin-resolve", request, actorId);

    const result = await resolveAdminResetRequestInDb(db, {
      actorUserId: actorId,
      requestId,
      action: body.action,
      note: body.note,
    });

    clearRateLimit("recovery-admin-resolve", request, actorId);

    return ok({
      action: body.action,
      tempPassword: result.tempPassword ?? null,
      message:
        body.action === "approve"
          ? "Permintaan disetujui. Password sementara telah dibuat dan wajib disampaikan ke user secara langsung."
          : "Permintaan ditolak.",
    });
  } catch (error) {
    if (actorId && !(isApiError(error) && error.status === 429)) {
      recordRateLimitFailure("recovery-admin-resolve", request, actorId);
    }
    return handleRouteError(error);
  }
}
