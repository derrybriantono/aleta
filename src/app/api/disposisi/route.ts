import { NextRequest } from "next/server";

import { getEffectivePositionId, isDispositionAssignedToUser } from "@/lib/permissions";
import { getDatabase } from "@/server/db/client";
import {
  createDispositionInDb,
  getDispositionByIdFromDb,
  getDispositionsByLetterIdFromDb,
  listDispositionsFromDb,
  type CreateDispositionRequest,
} from "@/server/modules/dispositions/service";
import { requireActorUser } from "@/server/modules/organization/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { getSearchParam, readJsonBody } from "@/server/shared/request";
import { created, handleRouteError, ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const actor = await requireActorUser(db, actorUserId);
    const dispositionId = getSearchParam(request, "id");
    const suratId = getSearchParam(request, "suratId");
    const canAccess = (item: Awaited<ReturnType<typeof getDispositionByIdFromDb>>) =>
      Boolean(
        item &&
          (isDispositionAssignedToUser(actor, item) ||
            item.pengirimId === actor.id ||
            item.targetPositionId === getEffectivePositionId(actor))
      );

    if (dispositionId) {
      const item = await getDispositionByIdFromDb(db, dispositionId);

      if (!canAccess(item)) {
        throw new ApiError(404, "Disposisi tidak ditemukan.");
      }

      return ok(item);
    }

    if (suratId) {
      const items = (await getDispositionsByLetterIdFromDb(db, suratId)).filter((item) => canAccess(item));
      return ok({
        suratId,
        items,
      });
    }

    const items = (await listDispositionsFromDb(db)).filter((item) => canAccess(item));
    return ok({
      items,
      total: items.length,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await readJsonBody<Omit<CreateDispositionRequest, "actorUserId"> & { actorUserId?: string }>(request);
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const result = await createDispositionInDb(db, {
      ...body,
      actorUserId,
    });

    return created(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
