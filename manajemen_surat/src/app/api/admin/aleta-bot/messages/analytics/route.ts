import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { getAletaBotMessageAnalytics } from "@/server/modules/aleta-bot/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    return ok(await getAletaBotMessageAnalytics(db, actorUserId));
  } catch (error) {
    return handleRouteError(error);
  }
}
