import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { dryRunDispositionDeadlineReminders } from "@/server/modules/aleta-bot/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";
import { getNumberSearchParam } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const result = await dryRunDispositionDeadlineReminders(db, {
      actorUserId,
      limit: getNumberSearchParam(request, "limit") ?? 20,
    });

    return ok(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
