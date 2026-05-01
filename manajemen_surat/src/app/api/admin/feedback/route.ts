import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { listAdminFeedbackRequestsFromDb } from "@/server/modules/feedback/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";
import { getSearchParam } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const result = await listAdminFeedbackRequestsFromDb(db, actorUserId, {
      type: getSearchParam(request, "type"),
      appArea: getSearchParam(request, "appArea"),
      status: getSearchParam(request, "status"),
      priority: getSearchParam(request, "priority"),
      reporter: getSearchParam(request, "reporter"),
      search: getSearchParam(request, "search"),
    });

    return ok(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
