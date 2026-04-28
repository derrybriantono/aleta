import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { resendDeadLetter } from "@/server/modules/aleta-bot/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await readJsonBody<{ id: string }>(request);
    if (!body.id) {
      return handleRouteError(new Error("id dead letter wajib diisi."));
    }
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    return ok(await resendDeadLetter(db, actorUserId, body.id));
  } catch (error) {
    return handleRouteError(error);
  }
}
