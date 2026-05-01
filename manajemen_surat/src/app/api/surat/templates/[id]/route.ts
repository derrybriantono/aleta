import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import {
  deactivateLetterTemplateInDb,
  upsertLetterTemplateInDb,
  type LetterTemplateInput,
} from "@/server/modules/letters/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const body = await readJsonBody<Omit<LetterTemplateInput, "actorUserId" | "id">>(request);
    const item = await upsertLetterTemplateInDb(db, {
      ...body,
      actorUserId,
      id,
    });

    return ok(item);
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
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const result = await deactivateLetterTemplateInDb(db, {
      actorUserId,
      templateId: id,
    });

    return ok(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
