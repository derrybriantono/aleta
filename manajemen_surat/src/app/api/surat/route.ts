import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import {
  readLetterPaginationFromRequest,
  readLetterSearchFiltersFromRequest,
  readLetterSortFromRequest,
} from "@/server/modules/letters/http";
import { createLetterInDb, searchLettersPageForActorInDb, type CreateLetterRequest } from "@/server/modules/letters/service";
import { requireActorUser } from "@/server/modules/organization/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { created, handleRouteError, ok } from "@/server/shared/http";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const actor = await requireActorUser(db, actorUserId);
    const filters = readLetterSearchFiltersFromRequest(request);
    const paginationInput = readLetterPaginationFromRequest(request);
    const sort = readLetterSortFromRequest(request);
    const result = await searchLettersPageForActorInDb(db, actor, filters, {
      ...paginationInput,
      ...sort,
    });

    return ok({
      items: result.items,
      data: result.items,
      total: result.pagination.total,
      pagination: result.pagination,
      filters,
      sort: result.sort,
      meta: result.meta,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await readJsonBody<Omit<CreateLetterRequest, "actorUserId"> & { actorUserId?: string }>(request);
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const result = await createLetterInDb(db, {
      ...body,
      actorUserId,
    });

    return created(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
