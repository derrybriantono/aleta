import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { readLetterSearchFiltersFromRequest } from "@/server/modules/letters/http";
import { requireActorUser } from "@/server/modules/organization/service";
import { searchLettersArchiveInDb } from "@/server/modules/search/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { getSearchParam } from "@/server/shared/request";
import { handleRouteError, ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const actorUser = await requireActorUser(db, actorUserId);
    const filters = readLetterSearchFiltersFromRequest(request);
    const result = await searchLettersArchiveInDb(db, actorUser, {
      ...filters,
      aiQuery: getSearchParam(request, "aiQuery"),
    });

    return ok(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
