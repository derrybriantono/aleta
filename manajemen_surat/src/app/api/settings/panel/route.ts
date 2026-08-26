import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { requireActorUser } from "@/server/modules/organization/service";
import {
  getPanelSettingsFromDb,
  updatePanelSettingsInDb,
} from "@/server/modules/settings/service";
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
    return ok(await getPanelSettingsFromDb(db));
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "PANEL_SETTINGS_ACCESS_FAILED",
      feature: "pengaturan_panel",
    });
  }
}

export async function PUT(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    const body = await readJsonBody<{
      footerMode?: unknown;
      portalCards?: unknown;
      publicAccess?: unknown;
      externalApps?: unknown;
    }>(request);
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const result = await updatePanelSettingsInDb(db, {
      actorUserId,
      payload: {
        footerMode: body.footerMode,
        portalCards: body.portalCards,
        publicAccess: body.publicAccess,
        externalApps: body.externalApps,
      },
    });

    return ok(result);
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "PANEL_SETTINGS_ACCESS_FAILED",
      feature: "pengaturan_panel",
    });
  }
}
