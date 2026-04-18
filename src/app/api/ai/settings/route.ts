import { NextRequest } from "next/server";

import { canManageGlobalAI } from "@/lib/permissions";
import { getDatabase } from "@/server/db/client";
import { requireActorUser } from "@/server/modules/organization/service";
import { getAISettingsFromDb, upsertAISettingsInDb } from "@/server/modules/ai/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const actor = await requireActorUser(db, actorUserId);
    const config = await getAISettingsFromDb(db);

    return ok(
      canManageGlobalAI(actor)
        ? config
        : {
            ...config,
            providers: config.providers.map((provider) => ({
              ...provider,
              apiKey: "",
            })),
          }
    );
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await readJsonBody<{
      actorUserId?: string;
      enabled?: boolean;
      providerId?: string;
      modelId?: string;
      primaryLanguage?: "id" | "en";
      provider?: {
        id: string;
        name?: string;
        apiKey?: string;
        endpointUrl?: string;
        models?: string[];
        builtin?: boolean;
      };
    }>(request);
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const result = await upsertAISettingsInDb(db, {
      actorUserId,
      enabled: body.enabled,
      providerId: body.providerId,
      modelId: body.modelId,
      primaryLanguage: body.primaryLanguage,
      provider: body.provider,
    });

    return ok(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
