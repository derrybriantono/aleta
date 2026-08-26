import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { runAletaBotAction } from "@/server/modules/aleta-bot/service";
import { requireActorUser } from "@/server/modules/organization/service";
import { getAISettingsFromDb, upsertAISettingsInDb } from "@/server/modules/ai/service";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { sanitizePublicErrorMessage } from "@/server/shared/error-sanitizer";
import { ok } from "@/server/shared/http";
import { readJsonBody } from "@/server/shared/request";
import { type PartialAIFeatureFlags } from "@/lib/ai-feature-flags";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await requireActorUser(db, actorUserId);
    const config = await getAISettingsFromDb(db);

    return ok(config);
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "AI_SETTINGS_ACCESS_FAILED",
      feature: "pengaturan_ai",
    });
  }
}

export async function PUT(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
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
      moduleConfigs?: Array<{
        moduleKey: string;
        enabled?: boolean;
        inheritGlobal?: boolean;
        activeConnectionId?: string | null;
      }>;
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
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
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
      moduleConfigs: body.moduleConfigs,
      connection: body.connection,
      deleteConnectionId: body.deleteConnectionId,
    });
    const aletaBotAiSync = await runAletaBotAction(db, {
      actorUserId,
      action: "sync-ai-config",
    })
      .then(() => ({ ok: true as const, message: "AI config ALETA Bot tersinkron." }))
      .catch((error) => ({
        ok: false as const,
        message: sanitizePublicErrorMessage(
          error instanceof Error ? error.message : "",
          "AI config ALETA Bot belum tersinkron."
        ),
      }));

    return ok({ ...result, aletaBotAiSync });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "AI_SETTINGS_ACCESS_FAILED",
      feature: "pengaturan_ai",
    });
  }
}
