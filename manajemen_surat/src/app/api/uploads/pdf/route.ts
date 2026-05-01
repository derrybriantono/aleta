import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest } from "next/server";

import { ApiError } from "@/server/shared/errors";
import { handleRouteError, ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "pdf");

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

    // Ensure directory exists (extra safety)
    await mkdir(UPLOAD_DIR, { recursive: true });

    const timestamp = Date.now();
    const safeFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const uniqueFileName = `${timestamp}-${safeFileName}`;
    const filePath = path.join(UPLOAD_DIR, uniqueFileName);
    const publicUrl = `/uploads/pdf/${uniqueFileName}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    return ok({
      fileName: file.name,
      fileSizeMb: sizeMb,
      filePath: publicUrl,
      publicUrl,
      uploadedAt: new Date().toISOString(),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
