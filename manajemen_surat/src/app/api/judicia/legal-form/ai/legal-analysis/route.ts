import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { runLegalAnalysis } from "@/server/modules/judicia/legal-form/ai/jlf-ai-services";
import { asRecord, readOptionalStringValue, readStringValue } from "@/server/modules/judicia/legal-form/jlf-validation";
import { requireActorUser } from "@/server/modules/organization/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";
import { getRequestAuditMetadata, readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const payload = asRecord(await readJsonBody(request));
    const db = await getDatabase();
    const actor = await requireActorUser(db, await resolveActorUserId(request));
    return ok(await runLegalAnalysis(db, actor, {
      analysisType: readOptionalStringValue(payload, "analysisType", { maxLength: 80 }) ?? "regulation_lookup",
      query: readStringValue(payload, "query", { required: true, maxLength: 12000 }),
      nomorPerkara: readOptionalStringValue(payload, "nomorPerkara", { maxLength: 160 }),
      generatedDocumentId: readOptionalStringValue(payload, "generatedDocumentId", { maxLength: 160 }),
      regulationId: readOptionalStringValue(payload, "regulationId", { maxLength: 160 }),
      topicId: readOptionalStringValue(payload, "topicId", { maxLength: 160 }),
    }, getRequestAuditMetadata(request)));
  } catch (error) {
    return handleRouteError(error);
  }
}
