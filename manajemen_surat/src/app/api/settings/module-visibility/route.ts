import { NextRequest } from "next/server";

import { type ModuleId, type ModuleVisibility } from "@/lib/types";
import { getDatabase } from "@/server/db/client";
import {
  getModuleVisibilityFromDb,
  updateModuleVisibilityInDb,
} from "@/server/modules/settings/service";
import { requireActorUser } from "@/server/modules/organization/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { handleRouteError, ok } from "@/server/shared/http";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    await requireActorUser(db, actorUserId);
    const items = await getModuleVisibilityFromDb(db);

    return ok({
      items,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await readJsonBody<{
      roleId: ModuleVisibility["roleId"];
      moduleId: ModuleId;
      enabled: boolean;
    }>(request);
    if (!body.roleId || !body.moduleId || typeof body.enabled !== "boolean") {
      throw new ApiError(400, "roleId, moduleId, dan enabled wajib diisi untuk mengubah visibilitas modul.");
    }

    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const items = await updateModuleVisibilityInDb(db, {
      actorUserId,
      roleId: body.roleId,
      moduleId: body.moduleId,
      enabled: Boolean(body.enabled),
    });

    return ok({
      items,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
