import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { extractTextFromPdfBuffer } from "@/server/modules/ai/pdf";
import { requireActorUser } from "@/server/modules/organization/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { handleRouteError, ok } from "@/server/shared/http";
import { assertPdfBuffer, assertPdfUploadMetadata } from "@/server/shared/pdf-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    await requireActorUser(db, actorUserId);

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      throw new ApiError(400, "File PDF wajib dikirim pada field 'file'.");
    }

    assertPdfUploadMetadata(file);
    const sizeMb = Number((file.size / (1024 * 1024)).toFixed(2));

    const pageLimitInput = formData.get("pageLimit");
    const pageLimit =
      typeof pageLimitInput === "string" && Number.isFinite(Number(pageLimitInput))
        ? Number(pageLimitInput)
        : 5;
    const fileArrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(fileArrayBuffer);
    assertPdfBuffer(fileBuffer);

    const { extractedText, scannedPageCount } = await extractTextFromPdfBuffer(
      fileArrayBuffer,
      Math.max(1, Math.min(pageLimit, 10))
    );

    return ok({
      fileName: file.name,
      fileSizeMb: sizeMb,
      extractedText,
      scannedPageCount,
      verifyBeforeSave: true,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
