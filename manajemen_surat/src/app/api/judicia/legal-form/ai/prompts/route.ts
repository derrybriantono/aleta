import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { listAiPrompts, updateAiPrompt } from "@/server/modules/judicia/legal-form/ai/jlf-ai-services";
import { asRecord, readBooleanValue, readOptionalStringValue, readStringValue } from "@/server/modules/judicia/legal-form/jlf-validation";
import { requireActorUser } from "@/server/modules/organization/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";
import { getRequestAuditMetadata, readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actor = await requireActorUser(db, await resolveActorUserId(request));
    return ok({ items: await listAiPrompts(db, actor) });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const payload = asRecord(await readJsonBody(request));
    const db = await getDatabase();
    const actor = await requireActorUser(db, await resolveActorUserId(request));
    return ok(await updateAiPrompt(db, actor, {
      key: readStringValue(payload, "key", { required: true, maxLength: 160 }),
      promptTemplate: readStringValue(payload, "promptTemplate", { required: true, maxLength: 12000 }),
      name: readOptionalStringValue(payload, "name", { maxLength: 180 }),
      description: readOptionalStringValue(payload, "description", { maxLength: 1000 }),
      isActive: payload.isActive === undefined ? undefined : readBooleanValue(payload, "isActive", true),
    }, getRequestAuditMetadata(request)));
  } catch (error) {
    return handleRouteError(error);
  }
}
