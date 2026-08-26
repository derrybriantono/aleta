import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { getJlfDashboardSummary } from "@/server/modules/judicia/legal-form/jlf-reporting-service";
import { requireActorUser } from "@/server/modules/organization/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actor = await requireActorUser(db, await resolveActorUserId(request));
    return ok(await getJlfDashboardSummary(db, actor));
  } catch (error) {
    return handleRouteError(error);
  }
}
