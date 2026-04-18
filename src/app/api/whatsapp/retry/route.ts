import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { retryWhatsAppDeliveryInDb } from "@/server/modules/whatsapp/delivery";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await readJsonBody<{
      actorUserId?: string;
      scope: "letter" | "disposition";
      entityId: string;
      deliveryId: string;
    }>(request);
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request, body.actorUserId);
    const result = await retryWhatsAppDeliveryInDb(db, {
      actorUserId,
      scope: body.scope,
      entityId: body.entityId,
      deliveryId: body.deliveryId,
    });

    return ok(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
