import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { updateFeedbackRequestInDb, type UpdateFeedbackPayload } from "@/server/modules/feedback/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body = await readJsonBody<UpdateFeedbackPayload>(request);
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const { id } = await params;
    const item = await updateFeedbackRequestInDb(db, actorUserId, id, body);

    return ok({ item });
  } catch (error) {
    return handleRouteError(error);
  }
}
