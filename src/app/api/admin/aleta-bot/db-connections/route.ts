import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import {
  getAletaBotSnapshot,
  recordAletaBotDbConnectionTestResult,
} from "@/server/modules/aleta-bot/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_RUNTIME_URL = "http://127.0.0.1:3003";

function getRuntimeUrl(path: string) {
  const baseUrl = (process.env.ALETA_BOT_RUNTIME_URL || DEFAULT_RUNTIME_URL).replace(/\/+$/, "");
  return `${baseUrl}${path}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await readJsonBody<{ action: "test"; connectionKey: string }>(request);
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);

    await getAletaBotSnapshot(db, actorUserId);

    if (body.action !== "test") {
      return ok({ status: false, message: "Aksi koneksi database tidak valid." }, { status: 400 });
    }

    const headers: HeadersInit = { "content-type": "application/json" };
    if (process.env.ALETA_BOT_INTERNAL_TOKEN) {
      headers["x-aleta-bot-token"] = process.env.ALETA_BOT_INTERNAL_TOKEN;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(getRuntimeUrl("/internal/aleta-bot/db-connections/test"), {
        method: "POST",
        cache: "no-store",
        headers,
        body: JSON.stringify({ connectionKey: body.connectionKey }),
        signal: controller.signal,
      });
      const payload = (await response.json().catch(() => null)) as {
        result?: {
          key?: string;
          status?: "success" | "failed";
          error?: string;
          testedAt?: string;
          durationMs?: number;
          source?: string;
        };
        message?: string;
      } | null;
      const result = payload?.result ?? {
        key: body.connectionKey,
        status: "failed" as const,
        error: payload?.message || `HTTP ${response.status}`,
        testedAt: new Date().toISOString(),
      };
      const snapshot = await recordAletaBotDbConnectionTestResult(db, {
        actorUserId,
        connectionKey: result.key || body.connectionKey,
        status: result.status === "success" ? "success" : "failed",
        errorMessage: result.error || "",
        testedAt: result.testedAt,
      });

      return ok({ result, snapshot });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Runtime ALETA Bot tidak dapat dihubungi.";
      const snapshot = await recordAletaBotDbConnectionTestResult(db, {
        actorUserId,
        connectionKey: body.connectionKey,
        status: "failed",
        errorMessage,
      });
      return ok({
        result: {
          key: body.connectionKey,
          status: "failed",
          error: errorMessage,
          testedAt: new Date().toISOString(),
        },
        snapshot,
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    return handleRouteError(error);
  }
}
