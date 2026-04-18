import { NextRequest } from "next/server";

import { getAccessibleLetters } from "@/lib/permissions";
import { getDatabase } from "@/server/db/client";
import { getDispositionsByLetterIdFromDb } from "@/server/modules/dispositions/service";
import { deleteLetterInDb, getLetterByIdFromDb, updateLetterInDb, type UpdateLetterRequest } from "@/server/modules/letters/service";
import { requireActorUser } from "@/server/modules/organization/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { handleRouteError, ok } from "@/server/shared/http";
import { getBooleanSearchParam, readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const actor = await requireActorUser(db, actorUserId);
    const letter = await getLetterByIdFromDb(db, id, {
      includeDeleted: getBooleanSearchParam(request, "includeDeleted"),
    });

    if (!letter) {
      throw new ApiError(404, "Surat tidak ditemukan.");
    }

    const relatedDispositions = await getDispositionsByLetterIdFromDb(db, id);
    if (getAccessibleLetters(actor, [letter], relatedDispositions).length === 0) {
      throw new ApiError(404, "Surat tidak ditemukan.");
    }

    return ok(letter);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await readJsonBody<Omit<UpdateLetterRequest, "actorUserId" | "letterId"> & { actorUserId?: string }>(request);
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    
    const result = await updateLetterInDb(db, {
      ...body,
      actorUserId,
      letterId: id,
    });

    return ok(result);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = request.headers.get("content-type")?.includes("application/json")
      ? await readJsonBody<{ actorUserId?: string }>(request)
      : {};
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const result = await deleteLetterInDb(db, {
      actorUserId,
      letterId: id,
    });

    return ok(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
