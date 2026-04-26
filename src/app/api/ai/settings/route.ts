import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { requireActorUser } from "@/server/modules/organization/service";
import { getAISettingsFromDb, upsertAISettingsInDb } from "@/server/modules/ai/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";
import { readJsonBody } from "@/server/shared/request";
import { type PartialAIFeatureFlags } from "@/lib/ai-feature-flags";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    await requireActorUser(db, actorUserId);
    const config = await getAISettingsFromDb(db);

    return ok(config);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await readJsonBody<{
      actorUserId?: string;
      enabled?: boolean;
      primaryLanguage?: "id" | "en";
      activeConnectionId?: string | null;
      featureDispositionAi?: boolean;
      featureMailIntelligence?: boolean;
      featureDraftMetadata?: boolean;
      featureManajemenSuratAi?: boolean;
      featureDisposisiAi?: boolean;
      featureFlags?: PartialAIFeatureFlags;
      connection?: {
        id?: string;
        providerId: string;
        label?: string;
        modelId: string;
        apiKey?: string;
        endpointUrl?: string;
        builtin?: boolean;
        connectionStatus?: "idle" | "connected" | "failed";
        lastTestedAt?: string;
        lastConnectionMessage?: string;
      };
      deleteConnectionId?: string;
    }>(request);
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const result = await upsertAISettingsInDb(db, {
      actorUserId,
      enabled: body.enabled,
      primaryLanguage: body.primaryLanguage,
      activeConnectionId: body.activeConnectionId,
      featureDispositionAi: body.featureDispositionAi,
      featureMailIntelligence: body.featureMailIntelligence,
      featureDraftMetadata: body.featureDraftMetadata,
      featureManajemenSuratAi: body.featureManajemenSuratAi,
      featureDisposisiAi: body.featureDisposisiAi,
      featureFlags: body.featureFlags,
      connection: body.connection,
      deleteConnectionId: body.deleteConnectionId,
    });

    return ok(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
