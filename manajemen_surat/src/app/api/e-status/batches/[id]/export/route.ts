import { NextRequest, NextResponse } from "next/server";

import { getDatabase } from "@/server/db/client";
import { exportEStatusBatchFile } from "@/server/modules/e-status/estatus-service";
import { requireActorUser } from "@/server/modules/organization/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError } from "@/server/shared/http";
import { getSearchParam } from "@/server/shared/request";

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
    const exportFile = await exportEStatusBatchFile(db, actor, id, {
      format: getSearchParam(request, "format") || "csv",
    }, request);

    return new NextResponse(exportFile.body, {
      status: 200,
      headers: {
        "Content-Type": exportFile.mimeType,
        "Content-Disposition": `attachment; filename="${exportFile.fileName}"`,
        "X-EStatus-File-Hash": exportFile.fileHash,
        "X-EStatus-Payload-Hash": exportFile.payloadHash,
        "X-EStatus-Verification-Url": exportFile.verificationUrl,
        "X-EStatus-Verification-Id": exportFile.verificationPublicId,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
