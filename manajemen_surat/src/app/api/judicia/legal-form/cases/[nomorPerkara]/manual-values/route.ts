import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { deleteManualValue, listManualValues, saveManualValue } from "@/server/modules/judicia/legal-form/documents/jlf-manual-values-service";
import { asRecord, readOptionalStringValue, readStringValue } from "@/server/modules/judicia/legal-form/jlf-validation";
import { requireActorUser } from "@/server/modules/organization/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { created, handleRouteError, ok } from "@/server/shared/http";
import { getRequestAuditMetadata, getSearchParam, readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ nomorPerkara: string }> }
) {
  try {
    const { nomorPerkara } = await context.params;
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const actor = await requireActorUser(db, actorUserId);
    const items = await listManualValues(db, actor, {
      nomorPerkara: decodeURIComponent(nomorPerkara),
      templateId: getSearchParam(request, "templateId"),
      variableKey: getSearchParam(request, "variableKey"),
    });

    return ok({ items });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ nomorPerkara: string }> }
) {
  try {
    const { nomorPerkara } = await context.params;
    const payload = asRecord(await readJsonBody(request));
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const actor = await requireActorUser(db, actorUserId);
    const value = await saveManualValue(
      db,
      actor,
      {
        nomorPerkara: decodeURIComponent(nomorPerkara),
        sippPerkaraId: readOptionalStringValue(payload, "sippPerkaraId", { maxLength: 80 }),
        templateId: readOptionalStringValue(payload, "templateId", { maxLength: 160 }) ?? null,
        variableKey: readStringValue(payload, "variableKey", { required: true, maxLength: 120 }),
        valueType: readOptionalStringValue(payload, "valueType", { maxLength: 40 }) ?? "text",
        valueText: readOptionalStringValue(payload, "valueText", { maxLength: 8000 }) ?? "",
        valueJson: Object.prototype.hasOwnProperty.call(payload, "valueJson") ? payload.valueJson : null,
      },
      getRequestAuditMetadata(request)
    );

    return created(value);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ nomorPerkara: string }> }
) {
  try {
    const { nomorPerkara } = await context.params;
    const payload = asRecord(await readJsonBody(request));
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const actor = await requireActorUser(db, actorUserId);
    const result = await deleteManualValue(
      db,
      actor,
      {
        nomorPerkara: decodeURIComponent(nomorPerkara),
        templateId: readOptionalStringValue(payload, "templateId", { maxLength: 160 }) ?? null,
        variableKey: readStringValue(payload, "variableKey", { required: true, maxLength: 120 }),
      },
      getRequestAuditMetadata(request)
    );

    return ok(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
