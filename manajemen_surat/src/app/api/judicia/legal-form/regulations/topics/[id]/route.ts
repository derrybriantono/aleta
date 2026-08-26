import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { updateTopic } from "@/server/modules/judicia/legal-form/regulations/jlf-regulation-service";
import { asRecord, normalizeId, readBooleanValue, readOptionalStringValue } from "@/server/modules/judicia/legal-form/jlf-validation";
import { requireActorUser } from "@/server/modules/organization/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";
import { getRequestAuditMetadata, readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const payload = asRecord(await readJsonBody(request));
    const db = await getDatabase();
    const actor = await requireActorUser(db, await resolveActorUserId(request));
    return ok(await updateTopic(db, actor, normalizeId(id), {
      name: readOptionalStringValue(payload, "name", { maxLength: 180 }),
      slug: readOptionalStringValue(payload, "slug", { maxLength: 160 }),
      description: readOptionalStringValue(payload, "description", { maxLength: 1000 }),
      parentId: readOptionalStringValue(payload, "parentId", { maxLength: 160 }),
      isActive: payload.isActive === undefined ? undefined : readBooleanValue(payload, "isActive", true),
    }, getRequestAuditMetadata(request)));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const db = await getDatabase();
    const actor = await requireActorUser(db, await resolveActorUserId(request));
    return ok(await updateTopic(db, actor, normalizeId(id), { isActive: false }, getRequestAuditMetadata(request)));
  } catch (error) {
    return handleRouteError(error);
  }
}
