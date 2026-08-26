import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { archiveCategory, listCategories, updateCategory } from "@/server/modules/judicia/legal-form/templates/jlf-category-service";
import { asRecord, normalizeId, readBooleanValue, readNumberValue, readOptionalStringValue } from "@/server/modules/judicia/legal-form/jlf-validation";
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
    const category = (await listCategories(db, actor, { includeInactive: true }))
      .find((item) => item.id === normalizeId(id, "ID kategori"));

    return ok(category ?? null);
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
    const category = await updateCategory(db, actor, normalizeId(id, "ID kategori"), {
      name: readOptionalStringValue(payload, "name", { maxLength: 140 }),
      slug: readOptionalStringValue(payload, "slug", { maxLength: 120 }),
      description: readOptionalStringValue(payload, "description", { maxLength: 500 }),
      icon: readOptionalStringValue(payload, "icon", { maxLength: 80 }),
      sortOrder: Object.prototype.hasOwnProperty.call(payload, "sortOrder")
        ? readNumberValue(payload, "sortOrder", { fallback: 0, min: 0, max: 10000 })
        : undefined,
      isActive: Object.prototype.hasOwnProperty.call(payload, "isActive")
        ? readBooleanValue(payload, "isActive", true)
        : undefined,
    });

    return ok(category);
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

    return ok(await archiveCategory(db, actor, normalizeId(id, "ID kategori")));
  } catch (error) {
    return handleRouteError(error);
  }
}
