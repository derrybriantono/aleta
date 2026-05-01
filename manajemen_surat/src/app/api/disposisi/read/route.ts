import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { markDispositionReadInDb } from "@/server/modules/dispositions/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await readJsonBody<{ dispositionId: string }>(request);
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const result = await markDispositionReadInDb(db, {
      actorUserId,
      dispositionId: body.dispositionId,
    });

    return ok(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
