import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import {
  generateAnonymizedDocument,
  type JlfSensitiveEntitySuggestion,
} from "@/server/modules/judicia/legal-form/anonymization/jlf-anonymization-service";
import { asRecord, readOptionalStringValue, readStringValue } from "@/server/modules/judicia/legal-form/jlf-validation";
import { requireActorUser } from "@/server/modules/organization/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { created, handleRouteError } from "@/server/shared/http";
import { getRequestAuditMetadata, readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readSuggestions(payload: Record<string, unknown>) {
  const raw = payload.suggestions;
  return Array.isArray(raw) ? (raw as JlfSensitiveEntitySuggestion[]) : [];
}

function readAcceptedIds(payload: Record<string, unknown>) {
  const raw = payload.acceptedSuggestionIds;
  return Array.isArray(raw) ? raw.map((item) => String(item)).filter(Boolean) : [];
}

export async function POST(request: NextRequest) {
  try {
    const payload = asRecord(await readJsonBody(request));
    const db = await getDatabase();
    const actor = await requireActorUser(db, await resolveActorUserId(request));
    const result = await generateAnonymizedDocument(
      db,
      actor,
      {
        originalFileName: readStringValue(payload, "originalFileName", { required: true, maxLength: 180 }),
        fileType: readOptionalStringValue(payload, "fileType", { maxLength: 12 }),
        text: readStringValue(payload, "text", { required: true, maxLength: 250000 }),
        suggestions: readSuggestions(payload),
        acceptedSuggestionIds: readAcceptedIds(payload),
        nomorPerkara: readOptionalStringValue(payload, "nomorPerkara", { maxLength: 120 }),
      },
      getRequestAuditMetadata(request)
    );

    return created(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
