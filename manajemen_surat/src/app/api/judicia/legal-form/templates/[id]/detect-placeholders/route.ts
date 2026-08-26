import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { detectPlaceholdersForLatestTemplateVersion, detectPlaceholdersForVersion } from "@/server/modules/judicia/legal-form/templates/jlf-template-service";
import { asRecord, normalizeId, readOptionalStringValue } from "@/server/modules/judicia/legal-form/jlf-validation";
import { requireActorUser } from "@/server/modules/organization/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const payload = asRecord(await readJsonBody(request).catch(() => ({})));
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const actor = await requireActorUser(db, actorUserId);
    const versionId = readOptionalStringValue(payload, "versionId", { maxLength: 180 });
    const report = versionId
      ? await detectPlaceholdersForVersion(db, actor, normalizeId(versionId, "ID versi template"))
      : await detectPlaceholdersForLatestTemplateVersion(db, actor, normalizeId(id, "ID template"));

    return ok(report);
  } catch (error) {
    return handleRouteError(error);
  }
}
