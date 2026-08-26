import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import {
  getPublicEKepegawaianOptions,
  submitPublicEKepegawaianForm,
} from "@/server/modules/e-kepegawaian/service";
import { storeHrUploadedFile } from "@/server/shared/hr-file-storage";
import { created, handleRouteError } from "@/server/shared/http";
import { getRequestAuditMetadata } from "@/server/shared/request";
import { assertRateLimit, clearRateLimit, recordRateLimitFailure } from "@/server/shared/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function formDataToPayload(formData: FormData) {
  const payload: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (key === "file") continue;
    payload[key] = typeof value === "string" ? value : value.name;
  }
  return payload;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ formType: string }> }
) {
  const { formType } = await context.params;
  let identifier = formType;
  try {
    assertRateLimit("hr-public-submit", request, identifier);
    const db = await getDatabase();
    const formData = await request.formData();
    const payload = formDataToPayload(formData);
    identifier = payload.identifier || formType;

    const file = formData.get("file");
    const options = await getPublicEKepegawaianOptions(db);
    const storedFile = file instanceof File && file.size > 0
      ? await storeHrUploadedFile(file, {
          allowedExtensions: options.settings.publicAllowedFileTypes,
          maxSizeMb: options.settings.publicMaxUploadSizeMb,
        })
      : null;

    const result = await submitPublicEKepegawaianForm(
      db,
      formType,
      payload,
      getRequestAuditMetadata(request),
      storedFile
        ? {
            fileName: storedFile.fileName,
            originalFileName: storedFile.originalFileName,
            filePath: storedFile.publicUrl,
            fileType: storedFile.fileType,
            fileSize: storedFile.fileSize,
          }
        : null
    );
    clearRateLimit("hr-public-submit", request, identifier);
    return created(result);
  } catch (error) {
    recordRateLimitFailure("hr-public-submit", request, identifier);
    return handleRouteError(error);
  }
}
