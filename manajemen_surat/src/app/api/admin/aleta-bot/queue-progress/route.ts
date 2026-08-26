import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { getAletaBotQueueProgress } from "@/server/modules/aleta-bot/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { badRequest, handleRouteError, ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const queueId = request.nextUrl.searchParams.get("id")?.trim();
    if (!queueId) {
      badRequest("ID antrean wajib diisi.");
      return ok(null);
    }
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    return ok(await getAletaBotQueueProgress(db, actorUserId, queueId));
  } catch (error) {
    return handleRouteError(error);
  }
}
