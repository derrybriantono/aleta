import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { performEKepegawaianAction } from "@/server/modules/e-kepegawaian/service";
import { requireActorUser } from "@/server/modules/organization/service";
import { handleRouteError, ok } from "@/server/shared/http";
import { resolveActorUserId } from "@/server/shared/auth";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await readJsonBody<{
      action?: string;
      payload?: unknown;
    }>(request);

    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const actor = await requireActorUser(db, actorUserId);
    const result = await performEKepegawaianAction(db, actor, body.action ?? "", body.payload);

    return ok(result, {
      headers: {
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
