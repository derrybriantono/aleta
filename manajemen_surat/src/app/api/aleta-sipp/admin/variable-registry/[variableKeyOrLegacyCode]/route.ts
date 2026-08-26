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
    variableKeyOrLegacyCode: string;
  }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { variableKeyOrLegacyCode } = await context.params;
    const body = await readJsonBody<Record<string, unknown>>(request);
    const db = await getDatabase();
    const actor = await requireActorUser(db, await resolveActorUserId(request));
    return ok(await AletaSippService.updateAletaSippVariableRegistry(db, actor, variableKeyOrLegacyCode, body));
  } catch (error) {
    return handleRouteError(error);
  }
}
