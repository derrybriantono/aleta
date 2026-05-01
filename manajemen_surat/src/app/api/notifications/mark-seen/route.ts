import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import {
  markNotificationReadsSeenInDb,
  type MarkNotificationSeenPayload,
} from "@/server/modules/notifications/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const body = await readJsonBody<MarkNotificationSeenPayload>(request);
    const items = await markNotificationReadsSeenInDb(db, actorUserId, body);

    return ok({ items });
  } catch (error) {
    return handleRouteError(error);
  }
}
