import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import {
  activateLegacyRegistry,
  convertLegacyMigrationToDraft,
  disableLegacyKey,
  previewLegacyMigrationConversion,
  rollbackLegacyMigration,
  runLegacyMigrationDryRun,
  submitLegacyMigrationApproval,
  updateLegacyMigration,
} from "@/server/modules/aleta-bot/service";
import {
  getGatewayLegacyCommands,
  getGatewayLegacyNotifications,
  previewGatewayLegacyNotification,
  getWhatsappRuntimeMode,
} from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { resolveActorUserId } from "@/server/shared/auth";
import { badRequest, handleRouteError, ok, unauthorized } from "@/server/shared/http";
import { readJsonBody } from "@/server/shared/request";
import type { AletaBotLegacyMigration } from "@/lib/aleta-bot-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/aleta-bot/legacy-migration
 * Returns live legacy notification registry + command catalog from aleta_bot gateway.
 * Falls back gracefully if gateway is unreachable.
 */
export async function GET(request: NextRequest) {
  try {
    const actorUserId = await resolveActorUserId(request);
    if (!actorUserId) {
      unauthorized();
    }

    const runtimeMode = getWhatsappRuntimeMode();
    if (runtimeMode !== "aleta_bot") {
      return ok({
        runtimeMode,
        available: false,
        message: "Legacy migration adapter hanya tersedia di runtime aleta_bot.",
        notifications: [],
        commands: null,
      });
    }

    const previewKey = request.nextUrl.searchParams.get("previewKey");

    // Preview mode: fetch data preview for a specific notification key
    if (previewKey) {
      const result = await previewGatewayLegacyNotification(previewKey);
      if (!result.ok) {
        return ok({ ok: false, previewKey, error: result.error });
      }
      const { ok: _ok, ...previewData } = result.data as Record<string, unknown> & { ok?: unknown };
      return ok({ ok: true, previewKey, ...previewData });
    }

    // Full snapshot: notifications + commands
    const [notifResult, cmdResult] = await Promise.allSettled([
      getGatewayLegacyNotifications(),
      getGatewayLegacyCommands(),
    ]);

    const notifications =
      notifResult.status === "fulfilled" && notifResult.value.ok
        ? notifResult.value.data.notifications
        : [];

    const commands =
      cmdResult.status === "fulfilled" && cmdResult.value.ok
        ? cmdResult.value.data
        : null;

    return ok({
      runtimeMode,
      available: true,
      notifications,
      notificationCount: notifications.length,
      commands,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

/**
 * POST /api/admin/aleta-bot/legacy-migration
 * Update migration status or run a guarded migration workflow action.
 */
export async function POST(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    if (!actorUserId) {
      unauthorized();
    }

    const body = await readJsonBody<{
      action?: "update-status" | "preview" | "convert" | "dry-run" | "submit-approval" | "activate" | "disable-legacy" | "rollback";
      migrationId?: string;
      status?: AletaBotLegacyMigration["status"];
      notes?: string;
    }>(request);

    if (!body.migrationId) {
      badRequest("migrationId wajib diisi.");
    }

    const migrationId = body.migrationId;
    const action = body.action || "update-status";
    if (!migrationId) return;

    if (action === "preview") {
      return ok(await previewLegacyMigrationConversion(db, actorUserId, migrationId));
    }
    if (action === "convert") {
      return ok(await convertLegacyMigrationToDraft(db, actorUserId, migrationId));
    }
    if (action === "dry-run") {
      return ok(await runLegacyMigrationDryRun(db, actorUserId, migrationId));
    }
    if (action === "submit-approval") {
      return ok(await submitLegacyMigrationApproval(db, actorUserId, migrationId));
    }
    if (action === "activate") {
      return ok(await activateLegacyRegistry(db, actorUserId, migrationId));
    }
    if (action === "disable-legacy") {
      return ok(await disableLegacyKey(db, actorUserId, migrationId));
    }
    if (action === "rollback") {
      return ok(await rollbackLegacyMigration(db, actorUserId, migrationId));
    }

    if (!body.status) {
      badRequest("status wajib diisi untuk update-status.");
    }
    const status = body.status as AletaBotLegacyMigration["status"];

    const validStatuses: AletaBotLegacyMigration["status"][] = [
      "pending",
      "in_progress",
      "migrated",
      "skipped",
      "not_migrated",
      "mapped",
      "registry_draft",
      "needs_manual_mapping",
      "dry_run",
      "pending_approval",
      "active_registry",
      "legacy_disabled",
      "archivable",
    ];
    if (!validStatuses.includes(status)) {
      badRequest(`Status tidak valid. Gunakan: ${validStatuses.join(", ")}.`);
    }

    return ok(
      await updateLegacyMigration(db, {
        actorUserId,
        migrationId,
        status,
        notes: body.notes,
      })
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
