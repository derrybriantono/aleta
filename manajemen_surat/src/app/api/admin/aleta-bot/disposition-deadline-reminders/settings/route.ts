import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { updateDispositionDeadlineReminderSettings } from "@/server/modules/aleta-bot/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest) {
  try {
    const body = await readJsonBody<{
      mode?: "disabled" | "dry_run" | "pilot" | "production";
      confirmText?: string;
      pilotUserIds?: string[] | string;
      pilotRoleIds?: string[] | string;
      pilotPositionIds?: string[] | string;
      schedulerEnabled?: boolean;
      schedulerMode?: "disabled" | "dry_run" | "pilot" | "production";
      schedulerTime?: string;
      killSwitch?: boolean;
    }>(request);
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    return ok(
      await updateDispositionDeadlineReminderSettings(db, {
        actorUserId,
        mode: body.mode,
        confirmText: body.confirmText,
        pilotUserIds: body.pilotUserIds,
        pilotRoleIds: body.pilotRoleIds,
        pilotPositionIds: body.pilotPositionIds,
        schedulerEnabled: body.schedulerEnabled,
        schedulerMode: body.schedulerMode,
        schedulerTime: body.schedulerTime,
        killSwitch: body.killSwitch,
      })
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
