import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { previewAletaBotRetentionCleanup } from "@/server/modules/aleta-bot/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await readJsonBody<{ action: "preview-cleanup"; retentionDays?: number }>(request);
    if (body.action !== "preview-cleanup") {
      return ok({ status: false, message: "Aksi maintenance tidak valid." }, { status: 400 });
    }

    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    return ok(await previewAletaBotRetentionCleanup(db, actorUserId, body.retentionDays));
  } catch (error) {
    return handleRouteError(error);
  }
}
