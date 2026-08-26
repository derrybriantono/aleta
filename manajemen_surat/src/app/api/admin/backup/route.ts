import { NextRequest, NextResponse } from "next/server";

import { isPrivilegedAdmin } from "@/lib/permissions";
import { getDatabase } from "@/server/db/client";
import {
  createApplicationBackup,
  createDatabaseBackup,
  getBackupSystemSnapshot,
  type BackupType,
} from "@/server/modules/backups/service";
import { requireActorUser } from "@/server/modules/organization/service";
import { appendAuditLog } from "@/server/shared/audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { buildAttachmentContentDisposition, getAttachmentSecurityHeaders } from "@/server/shared/download-headers";
import { ApiError, isApiError } from "@/server/shared/errors";
import { handleRouteError, ok } from "@/server/shared/http";
import { nextPrefixedId } from "@/server/shared/ids";
import { readJsonBody, getRequestAuditMetadata } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isBackupType(value: unknown): value is BackupType {
  return value === "database" || value === "application";
}

function backupAction(type: BackupType) {
  return type === "database" ? "EXPORT_DATABASE_BACKUP" : "EXPORT_APPLICATION_BACKUP";
}

function assertCanCreateBackup(actor: Awaited<ReturnType<typeof requireActorUser>>, type: BackupType) {
  if (!isPrivilegedAdmin(actor)) {
    throw new ApiError(403, "Hanya Admin atau Super Admin yang dapat membuat backup.");
  }
  if (type === "database" && actor.roleId !== "super-admin") {
    throw new ApiError(403, "Backup database penuh hanya boleh dibuat oleh Super Admin.");
  }
}

type DatabaseConnection = Awaited<ReturnType<typeof getDatabase>>;

function errorStatus(error: unknown) {
  return isApiError(error) ? error.status : 500;
}

async function appendBackupAudit(
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
      entityType: "system_backup",
      entityId,
      payload,
    });
  } catch (auditError) {
    console.warn("[ALETA AUDIT] Gagal mencatat audit Backup Sistem:", auditError);
  }
}

export async function GET(request: NextRequest) {
  let db: DatabaseConnection | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const actor = await requireActorUser(db, actorUserId);

    if (!isPrivilegedAdmin(actor)) {
      throw new ApiError(403, "Hanya Admin atau Super Admin yang dapat melihat status backup.");
    }

    const snapshot = {
      ...(await getBackupSystemSnapshot(db)),
      permissions: {
        canCreateDatabaseBackup: actor.roleId === "super-admin",
        canCreateApplicationBackup: true,
      },
    };
    await appendBackupAudit(db, {
      actorUserId: actor.id,
      action: "OPEN_BACKUP_SYSTEM",
      entityId: "status",
      payload: {
        request: getRequestAuditMetadata(request),
      },
    });

    return ok(snapshot);
  } catch (error) {
    await appendBackupAudit(db, {
      actorUserId,
      action: "BACKUP_ACCESS_FAILED",
      entityId: "status",
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
  let requestedType: unknown = "";
  try {
    const body = await readJsonBody<{ type?: unknown }>(request);
    requestedType = body.type;

    if (!isBackupType(body.type)) {
      throw new ApiError(400, "Jenis backup tidak valid.");
    }

    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const actor = await requireActorUser(db, actorUserId);

    assertCanCreateBackup(actor, body.type);

    const backup =
      body.type === "database"
        ? await createDatabaseBackup(db)
        : await createApplicationBackup();

    await appendAuditLog(db, {
      id: await nextPrefixedId(db, "audit_logs", "adt"),
      actorUserId: actor.id,
      action: backupAction(body.type),
      entityType: "system_backup",
      entityId: backup.filename,
      payload: {
        ...backup.metadata,
        request: getRequestAuditMetadata(request),
      },
    });

    return new NextResponse(new Uint8Array(backup.buffer), {
      headers: {
        ...getAttachmentSecurityHeaders(),
        "content-type": backup.mimeType,
        "content-length": String(backup.buffer.byteLength),
        "content-disposition": buildAttachmentContentDisposition(backup.filename),
        "x-aleta-app-version": backup.metadata.appVersion,
        "x-aleta-backup-generated-at": backup.metadata.generatedAt,
        ...(backup.metadata.databaseCapturedAt
          ? { "x-aleta-database-captured-at": backup.metadata.databaseCapturedAt }
          : {}),
        ...(backup.metadata.databaseMode ? { "x-aleta-database-mode": backup.metadata.databaseMode } : {}),
        ...(backup.metadata.databaseName ? { "x-aleta-database-name": backup.metadata.databaseName } : {}),
      },
    });
  } catch (error) {
    await appendBackupAudit(db, {
      actorUserId,
      action: "CREATE_BACKUP_FAILED",
      entityId: String(requestedType || "unknown"),
      payload: {
        requestedType,
        status: errorStatus(error),
        message: error instanceof Error ? error.message : "unknown",
        request: getRequestAuditMetadata(request),
      },
    });
    return handleRouteError(error);
  }
}
