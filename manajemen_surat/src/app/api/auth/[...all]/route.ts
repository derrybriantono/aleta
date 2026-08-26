import { toNextJsHandler } from "better-auth/next-js";
import { type NextRequest } from "next/server";

import { getAuth } from "@/lib/auth";
import { getDatabase } from "@/server/db/client";
import { appendAuditLog } from "@/server/shared/audit";
import { ApiError } from "@/server/shared/errors";
import { handleRouteError } from "@/server/shared/http";
import { nextPrefixedId } from "@/server/shared/ids";
import { getRequestAuditMetadata } from "@/server/shared/request";
import {
  assertRateLimit,
  clearRateLimit,
  recordRateLimitFailure,
} from "@/server/shared/rate-limit";

function maskLoginEmail(value: string) {
  const [name = "", domain = ""] = value.trim().toLowerCase().split("@");
  if (!name || !domain) return value ? "[invalid-email]" : "";
  return `${name.slice(0, 2)}***@${domain}`;
}

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
    let loginUser: { id: string; is_active: number } | null = null;

    if (pathname.endsWith("/sign-in/email")) {
      const body = await request.clone().json().catch(() => null) as { email?: string } | null;
      const email = body?.email?.trim();
      rateLimitEmail = email ?? "";

      assertRateLimit("login", request, email);

      if (email) {
        loginUser = await db.prepare(
          `SELECT id, is_active
           FROM users
           WHERE deleted_at IS NULL
             AND LOWER(email) = LOWER(?)
           LIMIT 1`
        ).get<{ id: string; is_active: number }>(email);

        if (loginUser && !Boolean(loginUser.is_active)) {
          await appendAuditLog(db, {
            id: await nextPrefixedId(db, "audit_logs", "adt"),
            actorUserId: loginUser.id,
            action: "LOGIN_BLOCKED_INACTIVE",
            entityType: "auth",
            entityId: loginUser.id,
            payload: {
              email: maskLoginEmail(email),
              ...getRequestAuditMetadata(request),
            },
          });
          throw new ApiError(403, "Akun ini telah diblokir dan tidak dapat digunakan untuk login.");
        }
      }
    }

    const handler = toNextJsHandler(await getAuth());
    const response = await handler.POST(request);

    if (pathname.endsWith("/sign-in/email")) {
      if (response.ok) {
        clearRateLimit("login", request, rateLimitEmail);
        await appendAuditLog(db, {
          id: await nextPrefixedId(db, "audit_logs", "adt"),
          actorUserId: loginUser?.id ?? null,
          action: "LOGIN_SUCCESS",
          entityType: "auth",
          entityId: loginUser?.id ?? "unknown-email",
          payload: {
            email: maskLoginEmail(rateLimitEmail),
            ...getRequestAuditMetadata(request),
          },
        });
      } else if (response.status >= 400) {
        recordRateLimitFailure("login", request, rateLimitEmail);
        await appendAuditLog(db, {
          id: await nextPrefixedId(db, "audit_logs", "adt"),
          actorUserId: loginUser?.id ?? null,
          action: "LOGIN_FAILED",
          entityType: "auth",
          entityId: loginUser?.id ?? "unknown-email",
          payload: {
            email: maskLoginEmail(rateLimitEmail),
            status: response.status,
            ...getRequestAuditMetadata(request),
          },
        });
      }
    }

    return response;
  } catch (error) {
    return handleRouteError(error);
  }
}
