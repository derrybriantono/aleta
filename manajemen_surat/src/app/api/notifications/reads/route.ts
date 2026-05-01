import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { listNotificationReadsFromDb } from "@/server/modules/notifications/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const entityType = request.nextUrl.searchParams.get("entityType");
    const items = await listNotificationReadsFromDb(db, actorUserId, entityType);

    return ok({ items });
  } catch (error) {
    return handleRouteError(error);
  }
}
