import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { readLetterSearchFiltersFromRequest } from "@/server/modules/letters/http";
import { searchLettersArchiveInDb } from "@/server/modules/search/service";
import { getSearchParam } from "@/server/shared/request";
import { handleRouteError, ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const filters = readLetterSearchFiltersFromRequest(request);
    const result = await searchLettersArchiveInDb(db, {
      ...filters,
      aiQuery: getSearchParam(request, "aiQuery"),
    });

    return ok(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
