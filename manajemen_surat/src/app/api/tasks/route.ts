import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { getTaskSourcesForUser } from "@/server/modules/tasks/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const payload = await getTaskSourcesForUser(db, actorUserId, {
      source: request.nextUrl.searchParams.get("source"),
      filter: request.nextUrl.searchParams.get("filter"),
      limit: request.nextUrl.searchParams.get("limit"),
    });

    return ok(payload);
  } catch (error) {
    return handleRouteError(error);
  }
}
