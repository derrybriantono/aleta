import { NextRequest } from "next/server";

import { isPrivilegedAdmin } from "@/lib/permissions";
import { getDatabase } from "@/server/db/client";
import { requireActorUser } from "@/server/modules/organization/service";
import {
  getWhatsappRuntimeMode,
  buildGatewayWhatsappSnapshot,
} from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { handleRouteError, ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const actorUserId = await resolveActorUserId(request);
    const db = await getDatabase();
    const actor = await requireActorUser(db, actorUserId);

    if (!isPrivilegedAdmin(actor)) {
      throw new ApiError(403, "Hanya Admin atau Super Admin yang dapat membaca status WhatsApp gateway.");
    }

    const runtimeMode = getWhatsappRuntimeMode();

    if (runtimeMode === "aleta_bot") {
      const snapshot = await buildGatewayWhatsappSnapshot();
      return ok({
        ...snapshot,
        requiresPhoneNumberBeforeInit: false,
        runtimeMode,
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
      runtimeLabel: "Legacy Warning: Portal WhatsApp Client",
      singleGateway: false,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
