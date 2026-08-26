import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { readJlfAdminSettingsSummary } from "@/server/modules/judicia/legal-form/jlf-admin-settings-service";
import { requireActorUser } from "@/server/modules/organization/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const actor = await requireActorUser(db, actorUserId);
    const summary = await readJlfAdminSettingsSummary(db, actor);

    return ok(summary);
  } catch (error) {
    return handleRouteError(error);
  }
}
