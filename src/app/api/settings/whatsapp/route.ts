import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { requireActorUser } from "@/server/modules/organization/service";
import { getWhatsAppSettingsFromDb, updateWhatsAppSettingsInDb } from "@/server/modules/settings/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    await requireActorUser(db, actorUserId);
    return ok(await getWhatsAppSettingsFromDb(db));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await readJsonBody<{
      actorUserId?: string;
      phoneNumber?: string;
      sessionName?: string;
      status?: "active" | "inactive" | "failed";
      lastConnectedAt?: string;
    }>(request);
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
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
    return handleRouteError(error);
  }
}
