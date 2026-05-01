import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { exportAletaBotConfig } from "@/server/modules/aleta-bot/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const payload = await exportAletaBotConfig(db, actorUserId);

    return Response.json(payload, {
      headers: {
        "content-disposition": `attachment; filename="aleta-bot-config-${payload.exportedAt.slice(0, 10)}.json"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
