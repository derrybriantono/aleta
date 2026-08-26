import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { requireActorUser } from "@/server/modules/organization/service";
import { runSystemPreflight } from "@/server/modules/system/preflight";
import { resolveActorUserId } from "@/server/shared/auth";
import { forbidden, handleRouteError, ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const actor = await requireActorUser(db, actorUserId);

    if (actor.roleId !== "super-admin" && actor.roleId !== "admin") {
      forbidden("Hanya Admin atau Super Admin yang dapat menjalankan preflight sistem.");
    }

    return ok(await runSystemPreflight(db));
  } catch (error) {
    return handleRouteError(error);
  }
}
