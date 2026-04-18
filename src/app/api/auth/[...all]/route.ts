import { toNextJsHandler } from "better-auth/next-js";
import { type NextRequest } from "next/server";

import { getAuth } from "@/lib/auth";
import { getDatabase } from "@/server/db/client";
import { ApiError } from "@/server/shared/errors";
import { handleRouteError } from "@/server/shared/http";
import {
  assertRateLimit,
  clearRateLimit,
  recordRateLimitFailure,
} from "@/server/shared/rate-limit";

export async function GET(request: NextRequest) {
  await getDatabase();
  const handler = toNextJsHandler(await getAuth());
  return handler.GET(request);
}

export async function POST(request: NextRequest) {
  try {
    const db = await getDatabase();
    const pathname = new URL(request.url).pathname;
    let rateLimitEmail = "";

    if (pathname.endsWith("/sign-in/email")) {
      const body = await request.clone().json().catch(() => null) as { email?: string } | null;
      const email = body?.email?.trim();
      rateLimitEmail = email ?? "";

      assertRateLimit("login", request, email);

      if (email) {
        const user = await db.prepare(
          `SELECT id, is_active
           FROM users
           WHERE deleted_at IS NULL
             AND LOWER(email) = LOWER(?)
           LIMIT 1`
        ).get<{ id: string; is_active: number }>(email);

        if (user && !Boolean(user.is_active)) {
          throw new ApiError(403, "Akun ini telah diblokir dan tidak dapat digunakan untuk login.");
        }
      }
    }

    const handler = toNextJsHandler(await getAuth());
    const response = await handler.POST(request);

    if (pathname.endsWith("/sign-in/email")) {
      if (response.ok) {
        clearRateLimit("login", request, rateLimitEmail);
      } else if (response.status >= 400) {
        recordRateLimitFailure("login", request, rateLimitEmail);
      }
    }

    return response;
  } catch (error) {
    return handleRouteError(error);
  }
}
