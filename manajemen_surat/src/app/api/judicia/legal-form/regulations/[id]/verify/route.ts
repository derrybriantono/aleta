import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { verifyRegulation } from "@/server/modules/judicia/legal-form/regulations/jlf-regulation-service";
import { normalizeId } from "@/server/modules/judicia/legal-form/jlf-validation";
import { requireActorUser } from "@/server/modules/organization/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";
import { getRequestAuditMetadata } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const db = await getDatabase();
    const actor = await requireActorUser(db, await resolveActorUserId(request));
    return ok(await verifyRegulation(db, actor, normalizeId(id), getRequestAuditMetadata(request)));
  } catch (error) {
    return handleRouteError(error);
  }
}
