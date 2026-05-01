import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { getLeadershipKpiStatisticsInDb } from "@/server/modules/stats/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { handleRouteError, ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const actorUserId = await resolveActorUserId(request);
    if (!actorUserId) throw new ApiError(401, "Silakan login untuk melihat Ringkasan Pimpinan.");
    const { searchParams } = new URL(request.url);
    const periodDays = Number(searchParams.get("periodDays") || 7);
    const db = await getDatabase();
    return ok(await getLeadershipKpiStatisticsInDb(db, actorUserId, periodDays));
  } catch (error) {
    return handleRouteError(error);
  }
}
