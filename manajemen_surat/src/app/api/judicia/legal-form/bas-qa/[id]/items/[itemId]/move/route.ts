import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { moveBasQaItem } from "@/server/modules/judicia/legal-form/bas-qa/jlf-bas-qa-service";
import { asRecord, readStringValue } from "@/server/modules/judicia/legal-form/jlf-validation";
import { requireActorUser } from "@/server/modules/organization/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";
import { getRequestAuditMetadata, readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const [{ id, itemId }, payload] = await Promise.all([context.params, readJsonBody(request)]);
    const record = asRecord(payload);
    const direction = readStringValue(record, "direction", { required: true, maxLength: 8 });
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const actor = await requireActorUser(db, actorUserId);
    return ok(await moveBasQaItem(
      db,
      actor,
      id,
      itemId,
      direction === "up" ? "up" : "down",
      getRequestAuditMetadata(request)
    ));
  } catch (error) {
    return handleRouteError(error);
  }
}
