import { headers } from "next/headers";
import { NextRequest } from "next/server";

import { getAuth } from "@/lib/auth";
import { getDatabase } from "@/server/db/client";
import { requireActorUser } from "@/server/modules/organization/service";
import { handleRouteError, ok, unauthorized } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest) {
  try {
    const auth = await getAuth();
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    const sessionUserId = session?.user?.id;

    if (!sessionUserId) {
      unauthorized();
    }

    const db = await getDatabase();
    const actor = await requireActorUser(db, sessionUserId);

    return ok({
      userId: actor.id,
      isActive: actor.isActive,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
