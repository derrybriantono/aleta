import { type NextRequest } from "next/server";

import { type AletaDatabase } from "@/server/db/client";
import { appendAuditLog } from "@/server/shared/audit";
import { isApiError } from "@/server/shared/errors";
import { sanitizePublicErrorMessage } from "@/server/shared/error-sanitizer";
import { handleRouteError } from "@/server/shared/http";
import { nextPrefixedId } from "@/server/shared/ids";
import { getRequestAuditMetadata } from "@/server/shared/request";

function errorStatus(error: unknown) {
  return isApiError(error) ? error.status : 500;
}

export async function appendAdminAccessFailureAudit(
  db: AletaDatabase | null,
  request: NextRequest,
  {
    actorUserId,
    action,
    feature,
    entityId = "access",
    error,
  }: {
    actorUserId?: string | null;
    action: string;
    feature: string;
    entityId?: string;
    error: unknown;
  }
) {
  const status = errorStatus(error);
  if (!db || (status !== 401 && status !== 403)) return;

  try {
    await appendAuditLog(db, {
      id: await nextPrefixedId(db, "audit_logs", "adt"),
      actorUserId: actorUserId ?? null,
      action,
      entityType: "admin_access",
      entityId,
      payload: {
        feature,
        status,
        message: sanitizePublicErrorMessage(error instanceof Error ? error.message : "Akses ditolak.", "Akses ditolak."),
        request: getRequestAuditMetadata(request),
      },
    });
  } catch (auditError) {
    console.warn("[ALETA AUDIT] Gagal mencatat audit gagal akses admin:", auditError);
  }
}

export async function handleAdminRouteError(
  error: unknown,
  request: NextRequest,
  options: {
    db: AletaDatabase | null;
    actorUserId?: string | null;
    action: string;
    feature: string;
    entityId?: string;
  }
) {
  await appendAdminAccessFailureAudit(options.db, request, { ...options, error });
  return handleRouteError(error);
}
