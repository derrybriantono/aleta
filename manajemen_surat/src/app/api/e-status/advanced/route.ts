import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import {
  checkEStatusDataMinimization,
  createEStatusApiIntegration,
  createEStatusIncident,
  listEStatusAdvancedControls,
  prepareEStatusApiRequest,
  prepareEStatusSecureFileExchange,
  runEStatusAiAssist,
} from "@/server/modules/e-status/estatus-service";
import { requireActorUser } from "@/server/modules/organization/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { badRequest, created, handleRouteError, ok } from "@/server/shared/http";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actor = await requireActorUser(db, await resolveActorUserId(request));
    return ok(await listEStatusAdvancedControls(db, actor));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await readJsonBody<Record<string, unknown>>(request)) ?? {};
    const action = typeof payload.action === "string" ? payload.action : "";
    const db = await getDatabase();
    const actor = await requireActorUser(db, await resolveActorUserId(request));

    if (action === "prepare_file_exchange") {
      return created(await prepareEStatusSecureFileExchange(db, actor, payload, request));
    }
    if (action === "create_api_integration") {
      return created(await createEStatusApiIntegration(db, actor, payload, request));
    }
    if (action === "prepare_api_request") {
      return created(await prepareEStatusApiRequest(db, actor, payload, request));
    }
    if (action === "create_incident") {
      return created(await createEStatusIncident(db, actor, payload, request));
    }
    if (action === "ai_assist") {
      return created(await runEStatusAiAssist(db, actor, payload, request));
    }
    if (action === "minimization_check") {
      return ok(await checkEStatusDataMinimization(db, actor, payload, request));
    }

    badRequest("Aksi advanced E-Status tidak dikenal.");
  } catch (error) {
    return handleRouteError(error);
  }
}
