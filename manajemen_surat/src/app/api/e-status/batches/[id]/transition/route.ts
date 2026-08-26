import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { transitionEStatusBatch } from "@/server/modules/e-status/estatus-service";
import { requireActorUser } from "@/server/modules/organization/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { badRequest, handleRouteError, ok } from "@/server/shared/http";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const payload = (await readJsonBody<{ action?: string }>(request)) ?? {};
    const action = payload.action;
    if (
      action !== "submit_review" &&
      action !== "approve" &&
      action !== "lock" &&
      action !== "reject" &&
      action !== "cancel" &&
      action !== "create_revision"
    ) {
      badRequest("Aksi batch E-Status tidak dikenal.");
    }
    const batchAction = action as "submit_review" | "approve" | "lock" | "reject" | "cancel" | "create_revision";

    const db = await getDatabase();
    const actor = await requireActorUser(db, await resolveActorUserId(request));
    return ok(await transitionEStatusBatch(db, actor, id, batchAction, payload, request));
  } catch (error) {
    return handleRouteError(error);
  }
}
