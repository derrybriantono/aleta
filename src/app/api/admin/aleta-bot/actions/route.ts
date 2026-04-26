import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { runAletaBotAction } from "@/server/modules/aleta-bot/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await readJsonBody<{
      action:
        | "sync-config"
        | "reconnect"
        | "logout"
        | "send-test"
        | "test-template"
        | "test-query"
        | "test-notification"
        | "test-connection";
      payload?: Record<string, unknown>;
    }>(request);
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);

    return ok(
      await runAletaBotAction(db, {
        actorUserId,
        action: body.action,
        payload: body.payload,
      })
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
