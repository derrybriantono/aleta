import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { getAletaBotSnapshot } from "@/server/modules/aleta-bot/service";
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
    const body = await readJsonBody<{ action: "test"; question: string }>(request);
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);

    await getAletaBotSnapshot(db, actorUserId);

    if (body.action !== "test") {
      return ok({ status: false, message: "Aksi Pertanyaan Para Pihak tidak valid." }, { status: 400 });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(getRuntimeUrl("/internal/aleta-bot/public-qa/test"), {
        method: "POST",
        cache: "no-store",
        headers: getInternalHeaders(),
        body: JSON.stringify({ question: body.question }),
        signal: controller.signal,
      });
      const payload = (await response.json().catch(() => null)) as {
        status?: boolean;
        result?: unknown;
        message?: string;
      } | null;
      if (!response.ok || !payload?.status) {
        throw new Error(payload?.message || `HTTP ${response.status}`);
      }

      return ok({ result: payload.result });
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    return handleRouteError(error);
  }
}
