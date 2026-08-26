import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { getJlfCaseDetail } from "@/server/modules/judicia/legal-form/cases/jlf-case-service";
import { requireActorUser } from "@/server/modules/organization/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";
import { getRequestAuditMetadata } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ nomorPerkara: string }> }
) {
  try {
    const { nomorPerkara } = await context.params;
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const actor = await requireActorUser(db, actorUserId);

    return ok(await getJlfCaseDetail(db, actor, nomorPerkara, getRequestAuditMetadata(request)));
  } catch (error) {
    return handleRouteError(error);
  }
}
