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
    const pageSize = getNumberSearchParam(request, "limit") ?? getNumberSearchParam(request, "pageSize") ?? 25;
    const page = getNumberSearchParam(request, "page");
    const offset = getNumberSearchParam(request, "offset") ?? (page ? Math.max(0, page - 1) * pageSize : 0);
    return ok(
      await AletaSippService.getAletaSippVariableRegistry(db, actor, {
        q: getSearchParam(request, "q"),
        legacySource: getSearchParam(request, "legacySource"),
        category: getSearchParam(request, "category"),
        sourceType: getSearchParam(request, "sourceType"),
        variableType: getSearchParam(request, "variableType"),
        mappingStatus: getSearchParam(request, "mappingStatus") ?? getSearchParam(request, "status"),
        reviewStatus: getSearchParam(request, "reviewStatus"),
        queryKey: getSearchParam(request, "queryKey"),
        tableName: getSearchParam(request, "tableName"),
        limit: pageSize,
        offset,
      })
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
