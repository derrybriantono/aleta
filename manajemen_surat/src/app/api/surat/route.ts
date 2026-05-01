import { NextRequest } from "next/server";

import { getAccessibleLetters } from "@/lib/permissions";
import { getDatabase } from "@/server/db/client";
import { listDispositionsFromDb } from "@/server/modules/dispositions/service";
import { readLetterSearchFiltersFromRequest } from "@/server/modules/letters/http";
import { createLetterInDb, searchLettersInDb, type CreateLetterRequest } from "@/server/modules/letters/service";
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
    const [letters, dispositions] = await Promise.all([
      searchLettersInDb(db, filters),
      listDispositionsFromDb(db),
    ]);
    const items = getAccessibleLetters(actor, letters, dispositions);

    return ok({
      items,
      total: items.length,
      filters,
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
