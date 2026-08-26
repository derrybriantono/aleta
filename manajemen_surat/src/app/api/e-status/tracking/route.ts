import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { listEStatusTracking, updateEStatusTracking } from "@/server/modules/e-status/estatus-service";
import { requireActorUser } from "@/server/modules/organization/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { created, handleRouteError, ok } from "@/server/shared/http";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actor = await requireActorUser(db, await resolveActorUserId(request));
    return ok(await listEStatusTracking(db, actor));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await readJsonBody<Record<string, unknown>>(request)) ?? {};
    const db = await getDatabase();
    const actor = await requireActorUser(db, await resolveActorUserId(request));
    return created(await updateEStatusTracking(db, actor, payload, request));
  } catch (error) {
    return handleRouteError(error);
  }
}
