import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { getEStatusRecordDetail } from "@/server/modules/e-status/estatus-service";
import { requireActorUser } from "@/server/modules/organization/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const db = await getDatabase();
    const actor = await requireActorUser(db, await resolveActorUserId(request));
    return ok(await getEStatusRecordDetail(db, actor, id, request));
  } catch (error) {
    return handleRouteError(error);
  }
}
