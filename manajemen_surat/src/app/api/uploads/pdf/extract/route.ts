import { NextRequest } from "next/server";

import { extractTextFromPdfBuffer } from "@/server/modules/ai/pdf";
import { ApiError } from "@/server/shared/errors";
import { handleRouteError, ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      throw new ApiError(400, "File PDF wajib dikirim pada field 'file'.");
    }

    const sizeMb = Number((file.size / (1024 * 1024)).toFixed(2));
    if (sizeMb > 100) {
      throw new ApiError(413, "Ukuran PDF melebihi batas 100MB.");
    }

    const pageLimitInput = formData.get("pageLimit");
    const pageLimit =
      typeof pageLimitInput === "string" && Number.isFinite(Number(pageLimitInput))
        ? Number(pageLimitInput)
        : 5;
    const { extractedText, scannedPageCount } = await extractTextFromPdfBuffer(
      await file.arrayBuffer(),
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
