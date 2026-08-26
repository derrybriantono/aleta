import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { createRegulationVersion, listRegulationVersions } from "@/server/modules/judicia/legal-form/regulations/jlf-regulation-service";
import { asRecord, normalizeId, readOptionalStringValue } from "@/server/modules/judicia/legal-form/jlf-validation";
import { requireActorUser } from "@/server/modules/organization/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { created, handleRouteError, ok } from "@/server/shared/http";
import { getRequestAuditMetadata, readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const db = await getDatabase();
    const actor = await requireActorUser(db, await resolveActorUserId(request));
    return ok({ items: await listRegulationVersions(db, actor, normalizeId(id)) });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const payload = asRecord(await readJsonBody(request));
    const db = await getDatabase();
    const actor = await requireActorUser(db, await resolveActorUserId(request));
    return created(await createRegulationVersion(db, actor, {
      regulationId: normalizeId(id),
      versionLabel: readOptionalStringValue(payload, "versionLabel", { maxLength: 120 }),
      documentPath: readOptionalStringValue(payload, "documentPath", { maxLength: 600 }),
      checksum: readOptionalStringValue(payload, "checksum", { maxLength: 180 }),
      textContent: readOptionalStringValue(payload, "textContent", { maxLength: 200000 }),
      extractedTextStatus: readOptionalStringValue(payload, "extractedTextStatus", { maxLength: 60 }),
      changeNote: readOptionalStringValue(payload, "changeNote", { maxLength: 1000 }),
    }, getRequestAuditMetadata(request)));
  } catch (error) {
    return handleRouteError(error);
  }
}
