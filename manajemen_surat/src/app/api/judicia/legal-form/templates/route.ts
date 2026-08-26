import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { createTemplateMetadata, listTemplates } from "@/server/modules/judicia/legal-form/templates/jlf-template-service";
import { asRecord, normalizeSafeSearchQuery, readBooleanValue, readLimit, readOptionalStringValue, readStringValue } from "@/server/modules/judicia/legal-form/jlf-validation";
import { requireActorUser } from "@/server/modules/organization/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { created, handleRouteError, ok } from "@/server/shared/http";
import { getSearchParam, readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const actor = await requireActorUser(db, actorUserId);
    const query = getSearchParam(request, "query");
    const items = await listTemplates(db, actor, {
      categoryId: getSearchParam(request, "categoryId"),
      status: getSearchParam(request, "status"),
      query: query ? normalizeSafeSearchQuery(query, "Pencarian template", 1) : undefined,
      limit: readLimit(request.nextUrl.searchParams.get("limit"), 100, 200),
    });

    return ok({ items });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = asRecord(await readJsonBody(request));
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const actor = await requireActorUser(db, actorUserId);
    const template = await createTemplateMetadata(db, actor, {
      categoryId: readStringValue(payload, "categoryId", { required: true, maxLength: 160 }),
      name: readStringValue(payload, "name", { required: true, maxLength: 180 }),
      slug: readOptionalStringValue(payload, "slug", { maxLength: 140 }),
      description: readOptionalStringValue(payload, "description", { maxLength: 800 }),
      documentType: readOptionalStringValue(payload, "documentType", { maxLength: 120 }),
      fileType: readOptionalStringValue(payload, "fileType", { maxLength: 30 }),
      status: readOptionalStringValue(payload, "status", { maxLength: 40 }) ?? "draft",
      requiresValidation: readBooleanValue(payload, "requiresValidation", true),
      supportsAi: readBooleanValue(payload, "supportsAi", false),
      supportsWhatsappNotification: readBooleanValue(payload, "supportsWhatsappNotification", false),
    });

    return created(template);
  } catch (error) {
    return handleRouteError(error);
  }
}
