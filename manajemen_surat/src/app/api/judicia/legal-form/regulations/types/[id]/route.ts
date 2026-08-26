import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { disableRegulationType, updateRegulationType } from "@/server/modules/judicia/legal-form/regulations/jlf-regulation-service";
import { asRecord, normalizeId, readBooleanValue, readNumberValue, readOptionalStringValue } from "@/server/modules/judicia/legal-form/jlf-validation";
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
    return ok(await updateRegulationType(db, actor, normalizeId(id), {
      code: readOptionalStringValue(payload, "code", { maxLength: 80 }),
      name: readOptionalStringValue(payload, "name", { maxLength: 180 }),
      description: readOptionalStringValue(payload, "description", { maxLength: 1000 }),
      hierarchyLevel: payload.hierarchyLevel === undefined ? undefined : readNumberValue(payload, "hierarchyLevel", { min: 0, max: 100 }),
      issuingScope: readOptionalStringValue(payload, "issuingScope", { maxLength: 120 }),
      isBinding: payload.isBinding === undefined ? undefined : readBooleanValue(payload, "isBinding", true),
      isActive: payload.isActive === undefined ? undefined : readBooleanValue(payload, "isActive", true),
      sortOrder: payload.sortOrder === undefined ? undefined : readNumberValue(payload, "sortOrder", { min: 0, max: 10000 }),
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
    return ok(await disableRegulationType(db, actor, normalizeId(id), getRequestAuditMetadata(request)));
  } catch (error) {
    return handleRouteError(error);
  }
}
