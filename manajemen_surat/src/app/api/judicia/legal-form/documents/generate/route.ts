import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { generateDocument } from "@/server/modules/judicia/legal-form/documents/jlf-document-generation-service";
import { asRecord, readOptionalStringValue, readStringValue } from "@/server/modules/judicia/legal-form/jlf-validation";
import { requireActorUser } from "@/server/modules/organization/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { created, handleRouteError } from "@/server/shared/http";
import { getRequestAuditMetadata, readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readSelectedHearing(payload: Record<string, unknown>) {
  const value = payload.selectedHearing;
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

export async function POST(request: NextRequest) {
  try {
    const payload = asRecord(await readJsonBody(request));
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const actor = await requireActorUser(db, actorUserId);
    const document = await generateDocument(
      db,
      actor,
      {
        templateId: readStringValue(payload, "templateId", { required: true, maxLength: 160 }),
        nomorPerkara: readStringValue(payload, "nomorPerkara", { required: true, maxLength: 120 }),
        sippPerkaraId: readOptionalStringValue(payload, "sippPerkaraId", { maxLength: 80 }),
        selectedHearing: readSelectedHearing(payload),
        mode: (readOptionalStringValue(payload, "mode", { maxLength: 40 }) as never) ?? "generate_draft",
      },
      getRequestAuditMetadata(request)
    );

    return created(document);
  } catch (error) {
    return handleRouteError(error);
  }
}
