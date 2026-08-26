import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { createRegulationType, listRegulationTypes } from "@/server/modules/judicia/legal-form/regulations/jlf-regulation-service";
import { asRecord, readBooleanValue, readNumberValue, readOptionalStringValue, readStringValue } from "@/server/modules/judicia/legal-form/jlf-validation";
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
    return ok({ items: await listRegulationTypes(db, actor, { includeInactive: request.nextUrl.searchParams.get("includeInactive") === "true" }) });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = asRecord(await readJsonBody(request));
    const db = await getDatabase();
    const actor = await requireActorUser(db, await resolveActorUserId(request));
    const item = await createRegulationType(db, actor, {
      code: readStringValue(payload, "code", { required: true, maxLength: 80 }),
      name: readStringValue(payload, "name", { required: true, maxLength: 180 }),
      description: readOptionalStringValue(payload, "description", { maxLength: 1000 }),
      hierarchyLevel: readNumberValue(payload, "hierarchyLevel", { fallback: 0, min: 0, max: 100 }),
      issuingScope: readOptionalStringValue(payload, "issuingScope", { maxLength: 120 }),
      isBinding: readBooleanValue(payload, "isBinding", true),
      sortOrder: readNumberValue(payload, "sortOrder", { fallback: 0, min: 0, max: 10000 }),
    }, getRequestAuditMetadata(request));
    return created(item);
  } catch (error) {
    return handleRouteError(error);
  }
}
