import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { deactivateVariable, getVariable, updateVariable } from "@/server/modules/judicia/legal-form/templates/jlf-variable-service";
import { asRecord, normalizeId, readBooleanValue, readOptionalStringValue } from "@/server/modules/judicia/legal-form/jlf-validation";
import { requireActorUser } from "@/server/modules/organization/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const actor = await requireActorUser(db, actorUserId);
    return ok(await getVariable(db, actor, normalizeId(id, "ID variabel")));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const payload = asRecord(await readJsonBody(request));
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const actor = await requireActorUser(db, actorUserId);
    const variable = await updateVariable(db, actor, normalizeId(id, "ID variabel"), {
      legacyCode: readOptionalStringValue(payload, "legacyCode", { maxLength: 20 }),
      key: readOptionalStringValue(payload, "key", { maxLength: 140 }),
      label: readOptionalStringValue(payload, "label", { maxLength: 180 }),
      description: readOptionalStringValue(payload, "description", { maxLength: 800 }),
      dataType: readOptionalStringValue(payload, "dataType", { maxLength: 60 }),
      sourceType: readOptionalStringValue(payload, "sourceType", { maxLength: 80 }),
      sourceKey: readOptionalStringValue(payload, "sourceKey", { maxLength: 220 }),
      transformKey: readOptionalStringValue(payload, "transformKey", { maxLength: 120 }),
      fallbackValue: readOptionalStringValue(payload, "fallbackValue", { maxLength: 500 }),
      legacyAbtType: readOptionalStringValue(payload, "legacyAbtType", { maxLength: 60 }),
      fieldMode: readOptionalStringValue(payload, "fieldMode", { maxLength: 80 }),
      aiEnabled: Object.prototype.hasOwnProperty.call(payload, "aiEnabled")
        ? readBooleanValue(payload, "aiEnabled", false)
        : undefined,
      manualOverrideAllowed: Object.prototype.hasOwnProperty.call(payload, "manualOverrideAllowed")
        ? readBooleanValue(payload, "manualOverrideAllowed", true)
        : undefined,
      isRequired: Object.prototype.hasOwnProperty.call(payload, "isRequired")
        ? readBooleanValue(payload, "isRequired", false)
        : undefined,
      isActive: Object.prototype.hasOwnProperty.call(payload, "isActive")
        ? readBooleanValue(payload, "isActive", true)
        : undefined,
      exampleValue: readOptionalStringValue(payload, "exampleValue", { maxLength: 500 }),
      adminNote: readOptionalStringValue(payload, "adminNote", { maxLength: 800 }),
    });

    return ok(variable);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const actor = await requireActorUser(db, actorUserId);
    return ok(await deactivateVariable(db, actor, normalizeId(id, "ID variabel")));
  } catch (error) {
    return handleRouteError(error);
  }
}
