import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import {
  buildAletaBotDbConnectionTestConfig,
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
  const baseUrl = (
    process.env.ALETA_BOT_BASE_URL ||
    process.env.ALETA_BOT_RUNTIME_URL ||
    DEFAULT_RUNTIME_URL
  ).replace(/\/+$/, "");
  return `${baseUrl}${path}`;
}

function getInternalHeaders(): HeadersInit {
  const headers: HeadersInit = { "content-type": "application/json" };
  const internalToken =
    process.env.ALETA_BOT_INTERNAL_API_TOKEN ||
    process.env.ALETA_BOT_INTERNAL_TOKEN ||
    "";
  if (internalToken) {
    headers["x-aleta-internal-token"] = internalToken;
  }
  return headers;
}

export async function POST(request: NextRequest) {
  try {
    const body = await readJsonBody<{
      action: "test" | "test-draft";
      connectionKey: string;
      connection?: {
        id?: string;
        key: string;
        name?: string;
        description?: string;
        host: string;
        port?: number;
        databaseName: string;
        username: string;
        passwordEnvKey?: string;
        newPassword?: string;
        sslEnabled?: boolean;
        connectionTimeoutMs?: number;
        isActive?: boolean;
        isDefault?: boolean;
        legacySource?: string;
      };
    }>(request);
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);

    await getAletaBotSnapshot(db, actorUserId);

    if (!["test", "test-draft"].includes(body.action)) {
      return ok({ status: false, message: "Aksi koneksi database tidak valid." }, { status: 400 });
    }
    const draftConfig = body.action === "test-draft" && body.connection
      ? await buildAletaBotDbConnectionTestConfig(db, body.connection)
      : null;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(getRuntimeUrl("/internal/aleta-bot/db-connections/test"), {
        method: "POST",
        cache: "no-store",
        headers: getInternalHeaders(),
        body: JSON.stringify(draftConfig
          ? { connectionKey: draftConfig.key, connection: draftConfig }
          : { connectionKey: body.connectionKey }),
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
        key: draftConfig?.key || body.connectionKey,
        status: "failed" as const,
        error: payload?.message || `HTTP ${response.status}`,
        testedAt: new Date().toISOString(),
      };
      const snapshot = await recordAletaBotDbConnectionTestResult(db, {
        actorUserId,
        connectionKey: result.key || draftConfig?.key || body.connectionKey,
        status: result.status === "success" ? "success" : "failed",
        errorMessage: result.error || "",
        testedAt: result.testedAt,
      });

      return ok({ result, snapshot });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Runtime ALETA Bot tidak dapat dihubungi.";
      const snapshot = await recordAletaBotDbConnectionTestResult(db, {
        actorUserId,
        connectionKey: draftConfig?.key || body.connection?.key || body.connectionKey,
        status: "failed",
        errorMessage,
      });
      return ok({
        result: {
          key: draftConfig?.key || body.connection?.key || body.connectionKey,
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
