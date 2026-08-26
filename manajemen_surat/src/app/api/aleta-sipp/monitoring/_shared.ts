import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { requireActorUser } from "@/server/modules/organization/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { getNumberSearchParam, getSearchParam } from "@/server/shared/request";

export async function monitoringContext(request: NextRequest) {
  const db = await getDatabase();
  const actor = await requireActorUser(db, await resolveActorUserId(request));
  return { db, actor };
}

export function paginationParams(request: NextRequest) {
  return {
    page: getNumberSearchParam(request, "page"),
    pageSize: getNumberSearchParam(request, "pageSize"),
    limit: getNumberSearchParam(request, "limit"),
    offset: getNumberSearchParam(request, "offset"),
  };
}

export function monitoringFilterParams(request: NextRequest) {
  return {
    q: getSearchParam(request, "q"),
    sourceType: getSearchParam(request, "sourceType"),
    category: getSearchParam(request, "category"),
    status: getSearchParam(request, "status"),
    reviewStatus: getSearchParam(request, "reviewStatus"),
    ...paginationParams(request),
  };
}
