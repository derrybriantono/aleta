import { readFile } from "node:fs/promises";

import { cleanInstitutionLogoWhiteCanvas } from "@/server/shared/institution-logo-background";
import { findStoredInstitutionLogoFile } from "@/server/shared/institution-logo-storage";
import { handleRouteError } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ fileName: string }> }
) {
  try {
    const { fileName } = await context.params;
    const storedFile = await findStoredInstitutionLogoFile(fileName);
    const buffer = await readFile(storedFile.absolutePath);
    const logo = await cleanInstitutionLogoWhiteCanvas(buffer, storedFile.contentType);
    const responseBody = new Uint8Array(logo.buffer);

    return new Response(responseBody, {
      headers: {
        "cache-control": "public, max-age=31536000, immutable",
        "content-length": String(logo.buffer.byteLength),
        "content-type": logo.contentType,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
