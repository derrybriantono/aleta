import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { createVariable, listVariablesPage } from "@/server/modules/judicia/legal-form/templates/jlf-variable-service";
import { asRecord, normalizeSafeSearchQuery, readBooleanValue, readLimit, readOptionalStringValue, readStringValue } from "@/server/modules/judicia/legal-form/jlf-validation";
import { requireActorUser } from "@/server/modules/organization/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { created, handleRouteError, ok } from "@/server/shared/http";
import { getBooleanSearchParam, getSearchParam, readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const actor = await requireActorUser(db, actorUserId);
    const query = getSearchParam(request, "query");
    const limitParam = request.nextUrl.searchParams.get("limit");
    const offset = Math.max(0, Number(request.nextUrl.searchParams.get("offset") ?? 0) || 0);
    const result = await listVariablesPage(db, actor, {
      sourceType: getSearchParam(request, "sourceType"),
      dataType: getSearchParam(request, "dataType"),
      includeInactive: getBooleanSearchParam(request, "includeInactive"),
      query: query ? normalizeSafeSearchQuery(query, "Pencarian variabel", 1) : undefined,
      limit: limitParam === "all" ? 20000 : readLimit(limitParam, 150, 20000),
      offset: limitParam === "all" ? 0 : offset,
      sortBy: getSearchParam(request, "sortBy"),
      sortDir: getSearchParam(request, "sortDir"),
    });

    return ok(result);
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
    const variable = await createVariable(db, actor, {
      legacyCode: readOptionalStringValue(payload, "legacyCode", { maxLength: 20 }),
      key: readStringValue(payload, "key", { required: true, maxLength: 140 }),
      label: readStringValue(payload, "label", { required: true, maxLength: 180 }),
      description: readOptionalStringValue(payload, "description", { maxLength: 800 }),
      dataType: readOptionalStringValue(payload, "dataType", { maxLength: 60 }),
      sourceType: readOptionalStringValue(payload, "sourceType", { maxLength: 80 }),
      sourceKey: readOptionalStringValue(payload, "sourceKey", { maxLength: 220 }),
      transformKey: readOptionalStringValue(payload, "transformKey", { maxLength: 120 }),
      fallbackValue: readOptionalStringValue(payload, "fallbackValue", { maxLength: 500 }),
      legacyAbtType: readOptionalStringValue(payload, "legacyAbtType", { maxLength: 60 }),
      fieldMode: readOptionalStringValue(payload, "fieldMode", { maxLength: 80 }),
      aiEnabled: readBooleanValue(payload, "aiEnabled", false),
      manualOverrideAllowed: readBooleanValue(payload, "manualOverrideAllowed", true),
      isRequired: readBooleanValue(payload, "isRequired", false),
      isActive: readBooleanValue(payload, "isActive", true),
      exampleValue: readOptionalStringValue(payload, "exampleValue", { maxLength: 500 }),
      adminNote: readOptionalStringValue(payload, "adminNote", { maxLength: 800 }),
    });

    return created(variable);
  } catch (error) {
    return handleRouteError(error);
  }
}
