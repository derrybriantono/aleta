import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { archiveRegulation, getRegulation, updateRegulation } from "@/server/modules/judicia/legal-form/regulations/jlf-regulation-service";
import { asRecord, normalizeId, readNumberValue, readOptionalStringValue } from "@/server/modules/judicia/legal-form/jlf-validation";
import { requireActorUser } from "@/server/modules/organization/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";
import { getRequestAuditMetadata, readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const db = await getDatabase();
    const actor = await requireActorUser(db, await resolveActorUserId(request));
    return ok(await getRegulation(db, actor, normalizeId(id)));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const payload = asRecord(await readJsonBody(request));
    const db = await getDatabase();
    const actor = await requireActorUser(db, await resolveActorUserId(request));
    return ok(await updateRegulation(db, actor, normalizeId(id), {
      regulationTypeId: readOptionalStringValue(payload, "regulationTypeId", { maxLength: 160 }),
      title: readOptionalStringValue(payload, "title", { maxLength: 400 }),
      shortTitle: readOptionalStringValue(payload, "shortTitle", { maxLength: 180 }),
      regulationNumber: readOptionalStringValue(payload, "regulationNumber", { maxLength: 120 }),
      regulationYear: payload.regulationYear === undefined ? undefined : readNumberValue(payload, "regulationYear", { min: 1800, max: 2200 }),
      issuingBody: readOptionalStringValue(payload, "issuingBody", { maxLength: 180 }),
      jurisdiction: readOptionalStringValue(payload, "jurisdiction", { maxLength: 120 }),
      subject: readOptionalStringValue(payload, "subject", { maxLength: 240 }),
      summary: readOptionalStringValue(payload, "summary", { maxLength: 4000 }),
      status: readOptionalStringValue(payload, "status", { maxLength: 60 }),
      verificationStatus: readOptionalStringValue(payload, "verificationStatus", { maxLength: 60 }),
      sourceUrl: readOptionalStringValue(payload, "sourceUrl", { maxLength: 600 }),
      sourceName: readOptionalStringValue(payload, "sourceName", { maxLength: 240 }),
      tags: payload.tags,
      metadata: payload.metadata,
    }, getRequestAuditMetadata(request)));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const db = await getDatabase();
    const actor = await requireActorUser(db, await resolveActorUserId(request));
    return ok(await archiveRegulation(db, actor, normalizeId(id), getRequestAuditMetadata(request)));
  } catch (error) {
    return handleRouteError(error);
  }
}
