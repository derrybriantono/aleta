import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { createSection, deleteSection, listSections, updateSection } from "@/server/modules/judicia/legal-form/regulations/jlf-regulation-service";
import { asRecord, normalizeId, readNumberValue, readOptionalStringValue, readStringValue } from "@/server/modules/judicia/legal-form/jlf-validation";
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
    return ok({ items: await listSections(db, actor, normalizeId(id)) });
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
    return created(await createSection(db, actor, {
      regulationId: normalizeId(id),
      regulationVersionId: readOptionalStringValue(payload, "regulationVersionId", { maxLength: 160 }),
      sectionType: readStringValue(payload, "sectionType", { required: true, maxLength: 60 }),
      sectionNumber: readOptionalStringValue(payload, "sectionNumber", { maxLength: 80 }),
      parentSectionId: readOptionalStringValue(payload, "parentSectionId", { maxLength: 160 }),
      title: readOptionalStringValue(payload, "title", { maxLength: 300 }),
      content: readOptionalStringValue(payload, "content", { maxLength: 200000 }),
      normalizedContent: readOptionalStringValue(payload, "normalizedContent", { maxLength: 200000 }),
      pageNumber: payload.pageNumber === undefined ? null : readNumberValue(payload, "pageNumber", { min: 1, max: 10000 }),
      sortOrder: readNumberValue(payload, "sortOrder", { fallback: 0, min: 0, max: 100000 }),
      metadata: payload.metadata,
    }, getRequestAuditMetadata(request)));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const payload = asRecord(await readJsonBody(request));
    const db = await getDatabase();
    const actor = await requireActorUser(db, await resolveActorUserId(request));
    return ok(await updateSection(db, actor, normalizeId(readStringValue(payload, "sectionId", { required: true })), {
      regulationVersionId: readOptionalStringValue(payload, "regulationVersionId", { maxLength: 160 }),
      sectionType: readOptionalStringValue(payload, "sectionType", { maxLength: 60 }),
      sectionNumber: readOptionalStringValue(payload, "sectionNumber", { maxLength: 80 }),
      parentSectionId: readOptionalStringValue(payload, "parentSectionId", { maxLength: 160 }),
      title: readOptionalStringValue(payload, "title", { maxLength: 300 }),
      content: readOptionalStringValue(payload, "content", { maxLength: 200000 }),
      normalizedContent: readOptionalStringValue(payload, "normalizedContent", { maxLength: 200000 }),
      pageNumber: payload.pageNumber === undefined ? undefined : readNumberValue(payload, "pageNumber", { min: 1, max: 10000 }),
      sortOrder: payload.sortOrder === undefined ? undefined : readNumberValue(payload, "sortOrder", { min: 0, max: 100000 }),
      metadata: payload.metadata,
    }, getRequestAuditMetadata(request)));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const payload = asRecord(await readJsonBody(request));
    const db = await getDatabase();
    const actor = await requireActorUser(db, await resolveActorUserId(request));
    return ok(await deleteSection(db, actor, normalizeId(readStringValue(payload, "sectionId", { required: true })), getRequestAuditMetadata(request)));
  } catch (error) {
    return handleRouteError(error);
  }
}
