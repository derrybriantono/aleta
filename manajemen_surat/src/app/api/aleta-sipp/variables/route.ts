import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { AletaSippService } from "@/server/modules/aleta-sipp/aleta-sipp-service";
import { requireActorUser } from "@/server/modules/organization/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";
import { getNumberSearchParam, getSearchParam } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actor = await requireActorUser(db, await resolveActorUserId(request));
    return ok(
      await AletaSippService.getAletaSippVariables(db, actor, {
        q: getSearchParam(request, "q"),
        status: getSearchParam(request, "status"),
        limit: getNumberSearchParam(request, "limit"),
        offset: getNumberSearchParam(request, "offset"),
      })
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
