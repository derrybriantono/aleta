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
  const baseUrl = (process.env.ALETA_BOT_RUNTIME_URL || DEFAULT_RUNTIME_URL).replace(/\/+$/, "");
  return `${baseUrl}${path}`;
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

    const headers: HeadersInit = { "content-type": "application/json" };
    if (process.env.ALETA_BOT_INTERNAL_TOKEN) {
      headers["x-aleta-bot-token"] = process.env.ALETA_BOT_INTERNAL_TOKEN;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(getRuntimeUrl("/internal/aleta-bot/public-qa/test"), {
        method: "POST",
        cache: "no-store",
        headers,
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
