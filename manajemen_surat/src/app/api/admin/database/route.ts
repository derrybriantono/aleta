import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import {
  getDatabaseAdminSnapshot,
  runReadOnlyDatabaseQuery,
  updateDatabaseTableRow,
} from "@/server/modules/database-admin/service";
import { requireActorUser } from "@/server/modules/organization/service";
import { appendAuditLog } from "@/server/shared/audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError, isApiError } from "@/server/shared/errors";
import { handleRouteError, ok } from "@/server/shared/http";
import { nextPrefixedId } from "@/server/shared/ids";
import { getRequestAuditMetadata, readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function assertSuperAdmin(roleId: string) {
  if (roleId !== "super-admin") {
    throw new ApiError(403, "Hanya Super Admin yang dapat membuka data PostgreSQL asli.");
  }
}

type DatabaseConnection = Awaited<ReturnType<typeof getDatabase>>;
type DatabasePostBody = {
  action?: string;
  sql?: unknown;
  tableName?: unknown;
  primaryKey?: unknown;
  patch?: unknown;
};

function errorStatus(error: unknown) {
  return isApiError(error) ? error.status : 500;
}

function previewSql(sql: unknown) {
  return typeof sql === "string" ? sql.slice(0, 1000) : "";
}

function patchColumns(patch: unknown) {
  return patch && typeof patch === "object" && !Array.isArray(patch) ? Object.keys(patch) : [];
}

async function appendDatabaseAdminAudit(
  db: DatabaseConnection | null,
  {
    actorUserId,
    action,
    entityId,
    payload,
  }: {
    actorUserId?: string | null;
    action: string;
    entityId: string;
    payload?: unknown;
  }
) {
  if (!db) return;
  try {
    await appendAuditLog(db, {
      id: await nextPrefixedId(db, "audit_logs", "adt"),
      actorUserId: actorUserId ?? null,
      action,
      entityType: "admin_database",
      entityId,
      payload,
    });
  } catch (auditError) {
    console.warn("[ALETA AUDIT] Gagal mencatat audit Admin Database:", auditError);
  }
}

export async function GET(request: NextRequest) {
  let db: DatabaseConnection | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const actor = await requireActorUser(db, actorUserId);
    assertSuperAdmin(actor.roleId);

    const { searchParams } = new URL(request.url);
    const options = {
      tableName: searchParams.get("table"),
      page: searchParams.get("page"),
      pageSize: searchParams.get("pageSize"),
      search: searchParams.get("search"),
    };
    const snapshot = await getDatabaseAdminSnapshot(db, options);
    await appendDatabaseAdminAudit(db, {
      actorUserId: actor.id,
      action: "OPEN_ADMIN_DATABASE",
      entityId: snapshot.selectedTable?.name ?? "overview",
      payload: {
        tableName: snapshot.selectedTable?.name ?? null,
        page: snapshot.page,
        pageSize: snapshot.pageSize,
        search: options.search ? "[filled]" : "",
        request: getRequestAuditMetadata(request),
      },
    });

    return ok(snapshot);
  } catch (error) {
    await appendDatabaseAdminAudit(db, {
      actorUserId,
      action: "ADMIN_DATABASE_ACCESS_FAILED",
      entityId: "open",
      payload: {
        status: errorStatus(error),
        message: error instanceof Error ? error.message : "unknown",
        request: getRequestAuditMetadata(request),
      },
    });
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  let db: DatabaseConnection | null = null;
  let actorUserId: string | null = null;
  let body: DatabasePostBody | null = null;
  try {
    body = await readJsonBody<DatabasePostBody>(request);
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const actor = await requireActorUser(db, actorUserId);
    assertSuperAdmin(actor.roleId);

    if (body.action === "run-query") {
      return ok(await runReadOnlyDatabaseQuery(db, actor.id, body.sql, {
        request: getRequestAuditMetadata(request),
      }));
    }

    if (body.action === "update-row") {
      return ok(
        await updateDatabaseTableRow(db, actor.id, {
          tableName: body.tableName,
          primaryKey: body.primaryKey,
          patch: body.patch,
          auditMetadata: {
            request: getRequestAuditMetadata(request),
          },
        })
      );
    }

    throw new ApiError(400, "Aksi database tidak valid.");
  } catch (error) {
    await appendDatabaseAdminAudit(db, {
      actorUserId,
      action:
        body?.action === "run-query"
          ? "RUN_DATABASE_QUERY_FAILED"
          : body?.action === "update-row"
            ? "UPDATE_DATABASE_ROW_FAILED"
            : "ADMIN_DATABASE_ACTION_FAILED",
      entityId: String(body?.tableName || body?.action || "unknown"),
      payload: {
        status: errorStatus(error),
        message: error instanceof Error ? error.message : "unknown",
        sqlPreview: body?.action === "run-query" ? previewSql(body.sql) : "",
        tableName: body?.action === "update-row" ? body.tableName : "",
        patchColumns: body?.action === "update-row" ? patchColumns(body.patch) : [],
        request: getRequestAuditMetadata(request),
      },
    });
    return handleRouteError(error);
  }
}
