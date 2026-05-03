import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { resendDeadLetter, resolveDeadLetter } from "@/server/modules/aleta-bot/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { badRequest, handleRouteError, ok, unauthorized } from "@/server/shared/http";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    if (!actorUserId) {
      unauthorized();
    }
    const body = await readJsonBody<{ id: string; action?: "resend" | "resolve"; note?: string }>(request);
    if (!body.id) {
      badRequest("id dead letter wajib diisi.");
    }
    if (body.action === "resolve") {
      return ok(await resolveDeadLetter(db, actorUserId, body.id, body.note));
    }
    return ok(await resendDeadLetter(db, actorUserId, body.id));
  } catch (error) {
    return handleRouteError(error);
  }
}
