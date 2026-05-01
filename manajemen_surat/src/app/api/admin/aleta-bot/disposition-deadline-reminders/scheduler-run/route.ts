import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { runDispositionDeadlineReminderSchedulerDryRun } from "@/server/modules/aleta-bot/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await readJsonBody<{ force?: boolean; limit?: number }>(request);
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    return ok(
      await runDispositionDeadlineReminderSchedulerDryRun(db, {
        actorUserId,
        force: body.force !== false,
        limit: body.limit,
      })
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
