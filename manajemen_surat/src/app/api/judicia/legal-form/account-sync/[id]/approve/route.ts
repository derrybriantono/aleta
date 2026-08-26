import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { approveSuggestedLink } from "@/server/modules/judicia/legal-form/jlf-account-sync-service";
import { normalizeId } from "@/server/modules/judicia/legal-form/jlf-validation";
import { requireActorUser } from "@/server/modules/organization/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const actor = await requireActorUser(db, actorUserId);
    const link = await approveSuggestedLink(db, actor, normalizeId(id, "ID link akun"));

    return ok(link);
  } catch (error) {
    return handleRouteError(error);
  }
}
