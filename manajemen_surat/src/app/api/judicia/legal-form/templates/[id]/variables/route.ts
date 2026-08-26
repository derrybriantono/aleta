import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { listTemplateVariables, mapVariableToTemplate, unmapVariable, validateTemplateMappings } from "@/server/modules/judicia/legal-form/templates/jlf-variable-service";
import { asRecord, normalizeId, readBooleanValue, readNumberValue, readOptionalStringValue, readStringValue } from "@/server/modules/judicia/legal-form/jlf-validation";
import { requireActorUser } from "@/server/modules/organization/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { created, handleRouteError, ok } from "@/server/shared/http";
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
    const templateId = normalizeId(id, "ID template");
    const [items, validation] = await Promise.all([
      listTemplateVariables(db, actor, templateId),
      validateTemplateMappings(db, actor, templateId),
    ]);

    return ok({ items, validation });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const payload = asRecord(await readJsonBody(request));
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const actor = await requireActorUser(db, actorUserId);
    const items = await mapVariableToTemplate(db, actor, {
      templateId: normalizeId(id, "ID template"),
      variableId: readStringValue(payload, "variableId", { required: true, maxLength: 180 }),
      placeholder: readStringValue(payload, "placeholder", { required: true, maxLength: 160 }),
      isRequired: readBooleanValue(payload, "isRequired", false),
      sortOrder: readNumberValue(payload, "sortOrder", { fallback: 0, min: 0, max: 10000 }),
    });

    return created({ items });
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
    const action = readOptionalStringValue(payload, "action", { maxLength: 40 });

    if (action === "unmap") {
      return ok({
        items: await unmapVariable(
          db,
          actor,
          normalizeId(readStringValue(payload, "templateVariableId", { required: true }), "ID mapping variabel")
        ),
      });
    }

    return ok({
      validation: await validateTemplateMappings(
        db,
        actor,
        normalizeId(String(payload.templateId ?? id), "ID template")
      ),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
