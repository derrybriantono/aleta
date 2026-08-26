import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { linkTemplateToRegulation, listRegulationsForTemplate } from "@/server/modules/judicia/legal-form/regulations/jlf-regulation-service";
import { asRecord, normalizeId, readOptionalStringValue, readStringValue } from "@/server/modules/judicia/legal-form/jlf-validation";
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
    return ok({ items: await listRegulationsForTemplate(db, actor, normalizeId(id)) });
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
    return created(await linkTemplateToRegulation(db, actor, {
      templateId: normalizeId(id),
      regulationId: readStringValue(payload, "regulationId", { required: true, maxLength: 160 }),
      regulationSectionId: readOptionalStringValue(payload, "regulationSectionId", { maxLength: 160 }),
      relationType: readOptionalStringValue(payload, "relationType", { maxLength: 80 }),
      note: readOptionalStringValue(payload, "note", { maxLength: 1000 }),
    }, getRequestAuditMetadata(request)));
  } catch (error) {
    return handleRouteError(error);
  }
}
