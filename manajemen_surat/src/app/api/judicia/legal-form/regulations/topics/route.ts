import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { createTopic, listTopics } from "@/server/modules/judicia/legal-form/regulations/jlf-regulation-service";
import { asRecord, readBooleanValue, readOptionalStringValue, readStringValue } from "@/server/modules/judicia/legal-form/jlf-validation";
import { requireActorUser } from "@/server/modules/organization/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { created, handleRouteError, ok } from "@/server/shared/http";
import { getRequestAuditMetadata, readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actor = await requireActorUser(db, await resolveActorUserId(request));
    return ok({ items: await listTopics(db, actor, { includeInactive: request.nextUrl.searchParams.get("includeInactive") === "true" }) });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = asRecord(await readJsonBody(request));
    const db = await getDatabase();
    const actor = await requireActorUser(db, await resolveActorUserId(request));
    return created(await createTopic(db, actor, {
      name: readStringValue(payload, "name", { required: true, maxLength: 180 }),
      slug: readOptionalStringValue(payload, "slug", { maxLength: 160 }),
      description: readOptionalStringValue(payload, "description", { maxLength: 1000 }),
      parentId: readOptionalStringValue(payload, "parentId", { maxLength: 160 }),
      isActive: readBooleanValue(payload, "isActive", true),
    }, getRequestAuditMetadata(request)));
  } catch (error) {
    return handleRouteError(error);
  }
}
