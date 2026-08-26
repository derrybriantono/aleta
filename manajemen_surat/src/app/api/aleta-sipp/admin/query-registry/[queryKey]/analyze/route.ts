import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { AletaSippService } from "@/server/modules/aleta-sipp/aleta-sipp-service";
import { requireActorUser } from "@/server/modules/organization/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    queryKey: string;
  }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { queryKey } = await context.params;
    const db = await getDatabase();
    const actor = await requireActorUser(db, await resolveActorUserId(request));
    return ok(await AletaSippService.analyzeAletaSippQueryRegistry(db, actor, queryKey));
  } catch (error) {
    return handleRouteError(error);
  }
}
