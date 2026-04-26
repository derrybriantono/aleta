import { NextRequest } from "next/server";

import { isPrivilegedAdmin } from "@/lib/permissions";
import { getDatabase, getDatabaseRuntimeStatus } from "@/server/db/client";
import { requireActorUser } from "@/server/modules/organization/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { handleRouteError, ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const actorUserId = await resolveActorUserId(request);
    const db = await getDatabase();
    const actor = await requireActorUser(db, actorUserId);

    if (!isPrivilegedAdmin(actor)) {
      throw new ApiError(403, "Hanya Admin atau Super Admin yang dapat melihat status database runtime.");
    }

    return ok(await getDatabaseRuntimeStatus());
  } catch (error) {
    return handleRouteError(error);
  }
}
