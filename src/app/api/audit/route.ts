import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { listAuditLogsFromDb } from "@/server/modules/audit/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const limit = Number(request.nextUrl.searchParams.get("limit") ?? "200");
    const items = await listAuditLogsFromDb(db, {
      actorUserId,
      limit,
    });

    return ok({
      items,
      total: items.length,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
