import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { AletaSippService } from "@/server/modules/aleta-sipp/aleta-sipp-service";
import { requireActorUser } from "@/server/modules/organization/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    tableName: string;
  }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { tableName } = await context.params;
    const body = await readJsonBody<{
      humanName?: string;
      category?: string;
      shortDescription?: string;
      longDescription?: string;
      businessFunction?: string;
      dataQualityNotes?: string;
      reviewNotes?: string;
      analysisStatus?: string;
    }>(request);
    const db = await getDatabase();
    const actor = await requireActorUser(db, await resolveActorUserId(request));
    return ok(await AletaSippService.updateAletaSippDictionaryTable(db, actor, tableName, body));
  } catch (error) {
    return handleRouteError(error);
  }
}
