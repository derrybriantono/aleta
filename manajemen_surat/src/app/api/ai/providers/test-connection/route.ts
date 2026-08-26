import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { testAIProviderConnectionInDb } from "@/server/modules/ai/service";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    const body = await readJsonBody<{
      actorUserId?: string;
      connectionId?: string;
      providerId?: string;
      modelId?: string;
      apiKey?: string;
    }>(request);
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request, body.actorUserId);
    const result = await testAIProviderConnectionInDb(db, {
      actorUserId,
      connectionId: body.connectionId,
      providerId: body.providerId,
      modelId: body.modelId,
      apiKey: body.apiKey,
    });

    return ok(result);
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "AI_PROVIDER_TEST_ACCESS_FAILED",
      feature: "pengaturan_ai",
    });
  }
}
