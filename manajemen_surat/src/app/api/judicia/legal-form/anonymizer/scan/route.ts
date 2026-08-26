import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { scanAnonymizationDocument } from "@/server/modules/judicia/legal-form/anonymization/jlf-anonymization-service";
import { requireActorUser } from "@/server/modules/organization/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { handleRouteError, ok } from "@/server/shared/http";
import { getRequestAuditMetadata } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseStringList(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) return parsed.map((item) => String(item).trim()).filter(Boolean);
  } catch {
    // Comma-separated input remains supported for simple forms.
  }
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      throw new ApiError(400, "File dokumen wajib dikirim pada field 'file'.");
    }

    const db = await getDatabase();
    const actor = await requireActorUser(db, await resolveActorUserId(request));
    const result = await scanAnonymizationDocument(
      db,
      actor,
      file,
      {
        nomorPerkara: String(formData.get("nomorPerkara") ?? "").trim() || undefined,
        partyNames: parseStringList(formData.get("partyNames")),
        customTerms: parseStringList(formData.get("customTerms")),
        includeAiSuggestions: String(formData.get("includeAiSuggestions") ?? "") === "true",
      },
      getRequestAuditMetadata(request)
    );

    return ok(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
