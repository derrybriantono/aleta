import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { updateSettingWithAudit } from "@/server/modules/judicia/legal-form/jlf-settings-service";
import { asRecord, normalizeJlfSettingKey, readJsonSettingValue, readOptionalStringValue } from "@/server/modules/judicia/legal-form/jlf-validation";
import { requireActorUser } from "@/server/modules/organization/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";
import { getRequestAuditMetadata, readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest) {
  try {
    const payload = asRecord(await readJsonBody(request));
    const key = normalizeJlfSettingKey(String(payload.key ?? ""));
    const value = readJsonSettingValue(payload);
    const description = readOptionalStringValue(payload, "description", { maxLength: 500 });

    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const actor = await requireActorUser(db, actorUserId);
    const requestMetadata = getRequestAuditMetadata(request);
    const setting = await updateSettingWithAudit(
      db,
      actor,
      { key, value, description },
      {
        ipAddress: requestMetadata.ipAddress,
        userAgent: requestMetadata.userAgent,
        metadata: { method: requestMetadata.method, path: requestMetadata.path },
      }
    );

    return ok(setting);
  } catch (error) {
    return handleRouteError(error);
  }
}
