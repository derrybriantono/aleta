import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import {
  createFeedbackRequestInDb,
  listOwnFeedbackRequestsFromDb,
  type CreateFeedbackPayload,
} from "@/server/modules/feedback/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { created, handleRouteError, ok } from "@/server/shared/http";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const items = await listOwnFeedbackRequestsFromDb(db, actorUserId);

    return ok({ items });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await readJsonBody<CreateFeedbackPayload>(request);
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const item = await createFeedbackRequestInDb(db, actorUserId, body);

    return created({ item });
  } catch (error) {
    return handleRouteError(error);
  }
}
