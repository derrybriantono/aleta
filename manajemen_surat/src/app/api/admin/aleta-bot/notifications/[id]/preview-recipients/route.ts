import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { previewAletaBotNotificationRecipients } from "@/server/modules/aleta-bot/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";
import { getNumberSearchParam } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const result = await previewAletaBotNotificationRecipients(db, {
      actorUserId,
      notificationId: id,
      limit: getNumberSearchParam(request, "limit") ?? 10,
    });

    return ok(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
