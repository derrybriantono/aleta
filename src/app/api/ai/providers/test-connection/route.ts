import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { testAIProviderConnectionInDb } from "@/server/modules/ai/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await readJsonBody<{
      actorUserId?: string;
      connectionId?: string;
      providerId?: string;
      modelId?: string;
      apiKey?: string;
    }>(request);
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request, body.actorUserId);
    const result = await testAIProviderConnectionInDb(db, {
      actorUserId,
      connectionId: body.connectionId,
      providerId: body.providerId,
      modelId: body.modelId,
      apiKey: body.apiKey,
    });

    return ok(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
