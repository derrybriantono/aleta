import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { submitForValidation } from "@/server/modules/judicia/legal-form/documents/jlf-document-validation-service";
import { asRecord, normalizeId, readOptionalStringValue } from "@/server/modules/judicia/legal-form/jlf-validation";
import { requireActorUser } from "@/server/modules/organization/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";
import { getRequestAuditMetadata, readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const payload = asRecord(await readJsonBody(request).catch(() => ({})));
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const actor = await requireActorUser(db, actorUserId);

    return ok(await submitForValidation(
      db,
      actor,
      normalizeId(id, "ID dokumen"),
      readOptionalStringValue(payload, "comment", { maxLength: 2000 }),
      getRequestAuditMetadata(request)
    ));
  } catch (error) {
    return handleRouteError(error);
  }
}
