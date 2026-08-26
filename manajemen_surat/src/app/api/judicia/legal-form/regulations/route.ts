import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { createRegulation, listRegulations } from "@/server/modules/judicia/legal-form/regulations/jlf-regulation-service";
import { asRecord, normalizeSafeSearchQuery, readLimit, readNumberValue, readOptionalStringValue, readStringValue } from "@/server/modules/judicia/legal-form/jlf-validation";
import { requireActorUser } from "@/server/modules/organization/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { created, handleRouteError, ok } from "@/server/shared/http";
import { getRequestAuditMetadata, getSearchParam, readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actor = await requireActorUser(db, await resolveActorUserId(request));
    const query = getSearchParam(request, "query");
    return ok({ items: await listRegulations(db, actor, {
      query: query ? normalizeSafeSearchQuery(query, "Pencarian peraturan", 1) : undefined,
      regulationTypeId: getSearchParam(request, "typeId"),
      regulationYear: request.nextUrl.searchParams.get("year") ? Number(request.nextUrl.searchParams.get("year")) : undefined,
      status: getSearchParam(request, "status"),
      verificationStatus: getSearchParam(request, "verificationStatus"),
      topicId: getSearchParam(request, "topicId"),
      limit: readLimit(request.nextUrl.searchParams.get("limit"), 50, 200),
    }) });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = asRecord(await readJsonBody(request));
    const db = await getDatabase();
    const actor = await requireActorUser(db, await resolveActorUserId(request));
    const item = await createRegulation(db, actor, {
      regulationTypeId: readStringValue(payload, "regulationTypeId", { required: true, maxLength: 160 }),
      title: readStringValue(payload, "title", { required: true, maxLength: 400 }),
      shortTitle: readOptionalStringValue(payload, "shortTitle", { maxLength: 180 }),
      regulationNumber: readOptionalStringValue(payload, "regulationNumber", { maxLength: 120 }),
      regulationYear: payload.regulationYear === undefined ? null : readNumberValue(payload, "regulationYear", { min: 1800, max: 2200 }),
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
    }, getRequestAuditMetadata(request));
    return created(item);
  } catch (error) {
    return handleRouteError(error);
  }
}
