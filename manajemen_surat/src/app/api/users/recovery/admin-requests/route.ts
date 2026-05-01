import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { listAdminResetRequestsInDb } from "@/server/modules/users/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const requests = await listAdminResetRequestsInDb(db, actorUserId);

    return ok({ requests });
  } catch (error) {
    return handleRouteError(error);
  }
}
