import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { rejectRegulation } from "@/server/modules/judicia/legal-form/regulations/jlf-regulation-service";
import { asRecord, normalizeId, readStringValue } from "@/server/modules/judicia/legal-form/jlf-validation";
import { requireActorUser } from "@/server/modules/organization/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";
import { getRequestAuditMetadata, readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const payload = asRecord(await readJsonBody(request));
    const db = await getDatabase();
    const actor = await requireActorUser(db, await resolveActorUserId(request));
    return ok(await rejectRegulation(db, actor, normalizeId(id), readStringValue(payload, "reason", { required: true, maxLength: 1000 }), getRequestAuditMetadata(request)));
  } catch (error) {
    return handleRouteError(error);
  }
}
