import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { asRecord, readOptionalStringValue, readNumberValue } from "@/server/modules/judicia/legal-form/jlf-validation";
import { previewJlfSourceData } from "@/server/modules/judicia/legal-form/sipp/jlf-source-preview-service";
import { requireActorUser } from "@/server/modules/organization/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";
import { getRequestAuditMetadata, readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const payload = asRecord(await readJsonBody(request));
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const actor = await requireActorUser(db, actorUserId);
    const params = payload.params === undefined ? {} : asRecord(payload.params, "Parameter preview");

    return ok(await previewJlfSourceData(
      db,
      actor,
      {
        variableId: readOptionalStringValue(payload, "variableId", { maxLength: 160 }),
        queryKey: readOptionalStringValue(payload, "queryKey", { maxLength: 120 }),
        sourceType: readOptionalStringValue(payload, "sourceType", { maxLength: 80 }),
        sourceKey: readOptionalStringValue(payload, "sourceKey", { maxLength: 180 }),
        legacyAbtType: readOptionalStringValue(payload, "legacyAbtType", { maxLength: 80 }),
        variableKey: readOptionalStringValue(payload, "variableKey", { maxLength: 140 }),
        adminNote: readOptionalStringValue(payload, "adminNote", { maxLength: 2000 }),
        sqlPreview: readOptionalStringValue(payload, "sqlPreview", { maxLength: 20000 }),
        params,
        limit: payload.limit === undefined ? undefined : readNumberValue(payload, "limit", { min: 1, max: 10 }),
      },
      getRequestAuditMetadata(request)
    ));
  } catch (error) {
    return handleRouteError(error);
  }
}
