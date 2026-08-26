import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { getRolesFromDb, requireActorUser } from "@/server/modules/organization/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    await requireActorUser(db, actorUserId);
    const items = await getRolesFromDb(db);

    return ok({
      items,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
