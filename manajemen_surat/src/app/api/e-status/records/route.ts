import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { listEStatusRecords } from "@/server/modules/e-status/estatus-service";
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
    return ok(await listEStatusRecords(db, actor, {
      kategori: getSearchParam(request, "kategori"),
      validationStatus: getSearchParam(request, "validationStatus"),
      workflowStatus: getSearchParam(request, "workflowStatus"),
      q: getSearchParam(request, "q"),
      limit: getNumberSearchParam(request, "limit"),
    }));
  } catch (error) {
    return handleRouteError(error);
  }
}
