import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { getWhatsappRuntimeModeDiagnostics } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { getAletaBotSnapshot } from "@/server/modules/aleta-bot/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function resolveHealthStatus(errors: string[], warnings: string[]) {
  if (errors.length > 0) return "error";
  if (warnings.length > 0) return "warning";
  return "ok";
}

export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const snapshot = await getAletaBotSnapshot(db, actorUserId);
    const runtimeMode = getWhatsappRuntimeModeDiagnostics();
    const warnings: string[] = [];
    const errors: string[] = [];
    const templateCount = snapshot.templates.length;
    const filledTemplateCount = snapshot.templates.filter((template) => template.body.trim()).length;
    const activeNotificationCount = snapshot.notifications.filter((notification) => notification.isActive).length;
    const connected =
      snapshot.whatsapp.linked ||
      ["connected", "ready", "authenticated"].includes(snapshot.whatsapp.runtimeStatus.toLowerCase()) ||
      ["connected", "ready", "authenticated"].includes(snapshot.whatsapp.internalStatus.toLowerCase());
    const latestDeliveryStatus =
      snapshot.notificationLogs[0]?.status ??
      snapshot.logs.find((log) => log.eventType === "notification" || log.eventType === "message")?.level ??
      null;

    if (runtimeMode.legacyBlocked) {
      warnings.push(runtimeMode.blockerMessage);
    }
    if (templateCount === 0 || filledTemplateCount === 0) {
      errors.push("Template pesan ALETA Bot belum tersedia di database.");
    }
    if (snapshot.employeeRecipients.length === 0) {
      warnings.push("Recipient pegawai ALETA Bot kosong. Pastikan user aktif memiliki nomor WhatsApp.");
    }
    if (!snapshot.settings.dryRunEnabled && runtimeMode.effectiveMode !== "disabled" && !connected) {
      warnings.push("Dry-run nonaktif, tetapi gateway WhatsApp belum terhubung.");
    }
    if (runtimeMode.effectiveMode === "disabled") {
      warnings.push("Pengiriman WhatsApp dinonaktifkan melalui WHATSAPP_RUNTIME_MODE=disabled.");
    }

    return ok({
      status: resolveHealthStatus(errors, warnings),
      generatedAt: new Date().toISOString(),
      settings: {
        botEnabled: snapshot.settings.botEnabled,
        notificationsEnabled: snapshot.settings.notificationsEnabled,
        dryRunEnabled: snapshot.settings.dryRunEnabled,
        messageDelayMs: snapshot.settings.messageDelayMs,
        retryLimit: snapshot.settings.retryLimit,
      },
      runtimeMode,
      gateway: {
        configured: runtimeMode.effectiveMode !== "disabled",
        connected,
        runtimeStatus: snapshot.whatsapp.runtimeStatus,
        internalStatus: snapshot.whatsapp.internalStatus,
        linked: snapshot.whatsapp.linked,
        sessionName: snapshot.whatsapp.sessionName,
        phoneNumberPresent: Boolean(snapshot.whatsapp.phoneNumber),
        lastConnectedAt: snapshot.whatsapp.lastConnectedAt,
        lastErrorMessage: snapshot.whatsapp.lastErrorMessage,
      },
      templates: {
        count: templateCount,
        filledCount: filledTemplateCount,
        editableCount: snapshot.templates.filter((template) => template.editable).length,
      },
      recipients: {
        employeeCount: snapshot.employeeRecipients.length,
        whatsappCoveragePercent: snapshot.whatsappNumberCompleteness.coveragePercent,
        missingWhatsappCount: snapshot.whatsappNumberCompleteness.missingWhatsapp,
      },
      notifications: {
        count: snapshot.notifications.length,
        activeCount: activeNotificationCount,
        lastDeliveryStatus: latestDeliveryStatus,
      },
      queue: {
        workerState: snapshot.workerState,
        deadLetterCount: snapshot.deadLetters.length,
        resolvedDeadLetterCount: snapshot.resolvedDeadLetters.length,
      },
      warnings,
      errors,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
