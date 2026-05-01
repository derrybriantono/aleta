import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { getAssistantJudgeSettingsFromDb, updateAssistantJudgeSettingsInDb } from "@/server/modules/settings/service";
import { requireActorUser } from "@/server/modules/organization/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";
import { readJsonBody } from "@/server/shared/request";
import type { AssistantJudgeConfig } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    await requireActorUser(db, actorUserId);
    return ok(await getAssistantJudgeSettingsFromDb(db));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await readJsonBody<AssistantJudgeConfig>(request);
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const result = await updateAssistantJudgeSettingsInDb(db, {
      actorUserId,
      payload: body,
    });

    return ok(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
