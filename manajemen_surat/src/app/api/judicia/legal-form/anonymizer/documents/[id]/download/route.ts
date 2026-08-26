import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { getAnonymizedDocumentDownload } from "@/server/modules/judicia/legal-form/anonymization/jlf-anonymization-service";
import { normalizeId } from "@/server/modules/judicia/legal-form/jlf-validation";
import { requireActorUser } from "@/server/modules/organization/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError } from "@/server/shared/http";
import { getRequestAuditMetadata } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const db = await getDatabase();
    const actor = await requireActorUser(db, await resolveActorUserId(request));
    const file = await getAnonymizedDocumentDownload(
      db,
      actor,
      normalizeId(id, "ID dokumen anonim"),
      getRequestAuditMetadata(request)
    );

    return new Response(file.buffer, {
      headers: {
        "Content-Type": file.contentType,
        "Content-Disposition": `attachment; filename="${file.fileName.replace(/"/g, "")}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
