import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { deleteBasQaItem, updateBasQaItem } from "@/server/modules/judicia/legal-form/bas-qa/jlf-bas-qa-service";
import { asRecord } from "@/server/modules/judicia/legal-form/jlf-validation";
import { requireActorUser } from "@/server/modules/organization/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";
import { getRequestAuditMetadata, readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const [{ id, itemId }, payload] = await Promise.all([context.params, readJsonBody(request)]);
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const actor = await requireActorUser(db, actorUserId);
    return ok(await updateBasQaItem(db, actor, id, itemId, asRecord(payload), getRequestAuditMetadata(request)));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const { id, itemId } = await context.params;
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const actor = await requireActorUser(db, actorUserId);
    return ok(await deleteBasQaItem(db, actor, id, itemId, getRequestAuditMetadata(request)));
  } catch (error) {
    return handleRouteError(error);
  }
}
