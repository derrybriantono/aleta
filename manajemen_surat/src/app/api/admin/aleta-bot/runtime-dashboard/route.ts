import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { getAletaBotSnapshot, runAletaBotAction } from "@/server/modules/aleta-bot/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_RUNTIME_URL = "http://127.0.0.1:3003";

function getRuntimeStatusUrl() {
  const baseUrl = (
    process.env.ALETA_BOT_BASE_URL ||
    process.env.ALETA_BOT_RUNTIME_URL ||
    DEFAULT_RUNTIME_URL
  ).replace(/\/+$/, "");
  return `${baseUrl}/internal/aleta-bot/status`;
}

export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);

    await getAletaBotSnapshot(db, actorUserId);

    const headers: HeadersInit = {};
    const internalToken =
      process.env.ALETA_BOT_INTERNAL_API_TOKEN ||
      process.env.ALETA_BOT_INTERNAL_TOKEN ||
      "";
    if (internalToken) {
      headers["x-aleta-internal-token"] = internalToken;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      const response = await fetch(getRuntimeStatusUrl(), {
        cache: "no-store",
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeout);
      let payload = await response.json().catch(() => null);
      let autoSync: { attempted: boolean; ok: boolean; message: string } | null = null;

      if (
        response.ok &&
        payload?.aiRuntime?.status === "needs_sync" &&
        String(process.env.ALETA_BOT_AI_AUTO_SYNC_ON_DASHBOARD || "true") !== "false"
      ) {
        try {
          await runAletaBotAction(db, {
            actorUserId,
            action: "sync-ai-config",
          });
          const retryResponse = await fetch(getRuntimeStatusUrl(), {
            cache: "no-store",
            headers,
          });
          payload = await retryResponse.json().catch(() => payload);
          autoSync = {
            attempted: true,
            ok: retryResponse.ok,
            message: retryResponse.ok
              ? "AI config bridge disinkronkan ulang otomatis karena status needs_sync."
              : `Auto sync selesai, tetapi runtime status gagal dibaca ulang: HTTP ${retryResponse.status}.`,
          };
        } catch (error) {
          autoSync = {
            attempted: true,
            ok: false,
            message: error instanceof Error ? error.message : "Auto sync AI config gagal.",
          };
        }
      }

      return ok({
        online: response.ok,
        fetchedAt: new Date().toISOString(),
        statusCode: response.status,
        runtimeUrlConfigured: Boolean(process.env.ALETA_BOT_RUNTIME_URL),
        autoSync,
        payload,
      });
    } catch (error) {
      return ok({
        online: false,
        fetchedAt: new Date().toISOString(),
        statusCode: 0,
        runtimeUrlConfigured: Boolean(process.env.ALETA_BOT_RUNTIME_URL),
        errorMessage: error instanceof Error ? error.message : "Runtime ALETA Bot tidak dapat dihubungi.",
        payload: null,
      });
    }
  } catch (error) {
    return handleRouteError(error);
  }
}
