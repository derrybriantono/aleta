import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { verifyDocumentToken } from "@/server/modules/judicia/legal-form/verification/jlf-document-verification-service";
import { requireActorUser } from "@/server/modules/organization/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";
import { getRequestAuditMetadata } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params;
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const actor = actorUserId ? await requireActorUser(db, actorUserId).catch(() => null) : null;

    return ok(await verifyDocumentToken(db, token, actor, getRequestAuditMetadata(request)));
  } catch (error) {
    return handleRouteError(error);
  }
}
