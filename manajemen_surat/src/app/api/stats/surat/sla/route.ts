import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { getLetterSlaStatisticsInDb } from "@/server/modules/stats/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { handleRouteError, ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const actorUserId = await resolveActorUserId(request);
    if (!actorUserId) throw new ApiError(401, "Silakan login untuk melihat SLA disposisi.");
    const db = await getDatabase();
    return ok(await getLetterSlaStatisticsInDb(db, actorUserId));
  } catch (error) {
    return handleRouteError(error);
  }
}
