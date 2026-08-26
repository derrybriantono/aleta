import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { listAccountLinks } from "@/server/modules/judicia/legal-form/jlf-account-sync-service";
import { readLimit } from "@/server/modules/judicia/legal-form/jlf-validation";
import { requireActorUser } from "@/server/modules/organization/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";
import { getSearchParam } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const actor = await requireActorUser(db, actorUserId);
    const items = await listAccountLinks(db, actor, {
      status: getSearchParam(request, "status"),
      aletaUserId: getSearchParam(request, "aletaUserId"),
      query: getSearchParam(request, "query"),
      limit: readLimit(request.nextUrl.searchParams.get("limit"), 50, 200),
    });

    return ok({ items });
  } catch (error) {
    return handleRouteError(error);
  }
}
