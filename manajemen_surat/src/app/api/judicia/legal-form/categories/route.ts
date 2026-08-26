import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { createCategory, listCategories } from "@/server/modules/judicia/legal-form/templates/jlf-category-service";
import { asRecord, readBooleanValue, readNumberValue, readOptionalStringValue, readStringValue } from "@/server/modules/judicia/legal-form/jlf-validation";
import { requireActorUser } from "@/server/modules/organization/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { created, handleRouteError, ok } from "@/server/shared/http";
import { getBooleanSearchParam, readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const actor = await requireActorUser(db, actorUserId);
    const items = await listCategories(db, actor, {
      includeInactive: getBooleanSearchParam(request, "includeInactive"),
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
    const category = await createCategory(db, actor, {
      name: readStringValue(payload, "name", { required: true, maxLength: 140 }),
      slug: readOptionalStringValue(payload, "slug", { maxLength: 120 }),
      description: readOptionalStringValue(payload, "description", { maxLength: 500 }),
      icon: readOptionalStringValue(payload, "icon", { maxLength: 80 }),
      sortOrder: readNumberValue(payload, "sortOrder", { fallback: 0, min: 0, max: 10000 }),
      isActive: readBooleanValue(payload, "isActive", true),
    });

    return created(category);
  } catch (error) {
    return handleRouteError(error);
  }
}
