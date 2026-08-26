import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { getEKepegawaianDashboard } from "@/server/modules/e-kepegawaian/service";
import { requireActorUser } from "@/server/modules/organization/service";
import { handleRouteError, ok } from "@/server/shared/http";
import { resolveActorUserId } from "@/server/shared/auth";
import { getRequestAuditMetadata } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const actor = await requireActorUser(db, actorUserId);
    const dashboard = await getEKepegawaianDashboard(db, actor, getRequestAuditMetadata(request));

    return ok(dashboard, {
      headers: {
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
