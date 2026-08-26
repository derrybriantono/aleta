import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { runBasAssistant } from "@/server/modules/judicia/legal-form/ai/jlf-ai-services";
import { asRecord, readStringValue } from "@/server/modules/judicia/legal-form/jlf-validation";
import { requireActorUser } from "@/server/modules/organization/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";
import { getRequestAuditMetadata, readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const payload = asRecord(await readJsonBody(request));
    const db = await getDatabase();
    const actor = await requireActorUser(db, await resolveActorUserId(request));
    return ok(await runBasAssistant(db, actor, { inputText: readStringValue(payload, "inputText", { required: true, maxLength: 12000 }), context: payload.context as Record<string, unknown> | undefined }, getRequestAuditMetadata(request)));
  } catch (error) {
    return handleRouteError(error);
  }
}
