import { NextRequest } from "next/server";

import { isPrivilegedAdmin } from "@/lib/permissions";
import { getDatabase } from "@/server/db/client";
import { requireActorUser } from "@/server/modules/organization/service";
import {
  getWhatsappRuntimeMode,
  getWhatsappRuntimeModeDiagnostics,
  buildGatewayWhatsappSnapshot,
} from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    actorUserId = await resolveActorUserId(request);
    db = await getDatabase();
    const actor = await requireActorUser(db, actorUserId);

    if (!isPrivilegedAdmin(actor)) {
      throw new ApiError(403, "Hanya Admin atau Super Admin yang dapat membaca status WhatsApp gateway.");
    }

    const runtimeMode = getWhatsappRuntimeMode();
    const runtimeDiagnostics = getWhatsappRuntimeModeDiagnostics();

    if (runtimeMode === "aleta_bot") {
      const snapshot = await buildGatewayWhatsappSnapshot();
      return ok({
        ...snapshot,
        requiresPhoneNumberBeforeInit: false,
        runtimeMode,
        runtimeDiagnostics,
        runtimeLabel: "ALETA Bot Gateway",
        singleGateway: true,
      });
    }

    if (runtimeMode === "disabled") {
      return ok({
        runtimeStatus: "disconnected",
        internalStatus: "inactive",
        qrCode: null,
        linked: false,
        phoneNumber: "",
        sessionName: "",
        savedStatus: "inactive",
        lastConnectedAt: null,
        lastErrorMessage: "WhatsApp dinonaktifkan (WHATSAPP_RUNTIME_MODE=disabled).",
        requiresPhoneNumberBeforeInit: false,
        runtimeMode,
        runtimeDiagnostics,
        runtimeLabel: "Disabled",
        singleGateway: false,
      });
    }

    // legacy_portal
    const { whatsappService } = await import("@/server/modules/whatsapp/service");
    const snapshot = await whatsappService.getGatewaySnapshot();
    return ok({
      ...snapshot,
      runtimeMode,
      runtimeDiagnostics,
      runtimeLabel: "Legacy Warning: Portal WhatsApp Client",
      singleGateway: false,
    });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "WHATSAPP_GATEWAY_ACCESS_FAILED",
      feature: "whatsapp_gateway",
      entityId: "status",
    });
  }
}
