import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { requireActorUser } from "@/server/modules/organization/service";
import { getWhatsAppSettingsFromDb, updateWhatsAppSettingsInDb } from "@/server/modules/settings/service";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await requireActorUser(db, actorUserId);
    return ok(await getWhatsAppSettingsFromDb(db));
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "WHATSAPP_SETTINGS_ACCESS_FAILED",
      feature: "whatsapp_gateway",
    });
  }
}

export async function PUT(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    const body = await readJsonBody<{
      actorUserId?: string;
      phoneNumber?: string;
      sessionName?: string;
      status?: "active" | "inactive" | "failed";
      lastConnectedAt?: string;
    }>(request);
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const result = await updateWhatsAppSettingsInDb(db, {
      actorUserId,
      payload: {
        phoneNumber: body.phoneNumber,
        sessionName: body.sessionName,
        status: body.status,
        lastConnectedAt: body.lastConnectedAt,
      },
    });

    return ok(result);
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "WHATSAPP_SETTINGS_ACCESS_FAILED",
      feature: "whatsapp_gateway",
    });
  }
}
