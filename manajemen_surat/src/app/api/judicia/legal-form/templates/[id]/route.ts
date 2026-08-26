import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { archiveTemplate, getTemplate, updateTemplate } from "@/server/modules/judicia/legal-form/templates/jlf-template-service";
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
    return ok(await getTemplate(db, actor, normalizeId(id, "ID template")));
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
    const template = await updateTemplate(db, actor, normalizeId(id, "ID template"), {
      categoryId: readOptionalStringValue(payload, "categoryId", { maxLength: 160 }),
      name: readOptionalStringValue(payload, "name", { maxLength: 180 }),
      slug: readOptionalStringValue(payload, "slug", { maxLength: 140 }),
      description: readOptionalStringValue(payload, "description", { maxLength: 800 }),
      documentType: readOptionalStringValue(payload, "documentType", { maxLength: 120 }),
      fileType: readOptionalStringValue(payload, "fileType", { maxLength: 30 }),
      status: readOptionalStringValue(payload, "status", { maxLength: 40 }),
      requiresValidation: Object.prototype.hasOwnProperty.call(payload, "requiresValidation")
        ? readBooleanValue(payload, "requiresValidation", true)
        : undefined,
      supportsAi: Object.prototype.hasOwnProperty.call(payload, "supportsAi")
        ? readBooleanValue(payload, "supportsAi", false)
        : undefined,
      supportsWhatsappNotification: Object.prototype.hasOwnProperty.call(payload, "supportsWhatsappNotification")
        ? readBooleanValue(payload, "supportsWhatsappNotification", false)
        : undefined,
    });

    return ok(template);
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
    return ok(await archiveTemplate(db, actor, normalizeId(id, "ID template")));
  } catch (error) {
    return handleRouteError(error);
  }
}
