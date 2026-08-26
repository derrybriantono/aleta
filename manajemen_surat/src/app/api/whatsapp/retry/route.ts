import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { retryWhatsAppDeliveryInDb } from "@/server/modules/whatsapp/delivery";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    const body = await readJsonBody<{
      actorUserId?: string;
      scope: "letter" | "disposition";
      entityId: string;
      deliveryId: string;
    }>(request);
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request, body.actorUserId);
    const result = await retryWhatsAppDeliveryInDb(db, {
      actorUserId,
      scope: body.scope,
      entityId: body.entityId,
      deliveryId: body.deliveryId,
    });

    return ok(result);
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "WHATSAPP_GATEWAY_ACCESS_FAILED",
      feature: "whatsapp_gateway",
      entityId: "retry",
    });
  }
}
