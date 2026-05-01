import { NextRequest } from "next/server";

import { isPrivilegedAdmin } from "@/lib/permissions";
import { getDatabase } from "@/server/db/client";
import { requireActorUser } from "@/server/modules/organization/service";
import {
  getWhatsappRuntimeMode,
  getGatewayWhatsappStatus,
  getGatewayWhatsappQr,
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
      throw new ApiError(403, "Hanya Admin atau Super Admin yang dapat mengakses scanner WhatsApp.");
    }

    const runtimeMode = getWhatsappRuntimeMode();

    if (runtimeMode === "aleta_bot") {
      const [statusResult, qrResult] = await Promise.allSettled([
        getGatewayWhatsappStatus(),
        getGatewayWhatsappQr(),
      ]);

      const statusData =
        statusResult.status === "fulfilled" && statusResult.value.ok
          ? statusResult.value.data
          : null;
      const qrData =
        qrResult.status === "fulfilled" && qrResult.value.ok
          ? qrResult.value.data
          : null;

      const gatewayStatus = statusData?.status ?? "disconnected";
      const runtimeStatus =
        gatewayStatus === "connected"
          ? "connected"
          : gatewayStatus === "qr_needed"
            ? "waiting_qr"
            : gatewayStatus === "initializing"
              ? "initializing"
              : gatewayStatus === "auth_failure"
                ? "failed"
                : "disconnected";

      return ok({
        qr: qrData?.qr ?? null,
        status: gatewayStatus === "connected" ? "ready" : gatewayStatus === "qr_needed" ? "qr" : gatewayStatus,
        runtimeStatus,
        linked: gatewayStatus === "connected",
        phoneNumber: statusData?.phoneNumber ?? "",
        sessionName: statusData?.sessionName ?? "aleta-whatsapp-main",
        lastConnectedAt: statusData?.lastConnectedAt ?? null,
        requiresPhoneNumberBeforeInit: false,
        lastErrorMessage: statusData?.lastError ?? null,
        runtimeMode,
      });
    }

    if (runtimeMode === "disabled") {
      return ok({
        qr: null,
        status: "inactive",
        runtimeStatus: "disconnected",
        linked: false,
        phoneNumber: "",
        sessionName: "",
        lastConnectedAt: null,
        requiresPhoneNumberBeforeInit: false,
        lastErrorMessage: "WhatsApp dinonaktifkan (WHATSAPP_RUNTIME_MODE=disabled).",
        runtimeMode,
      });
    }

    // legacy_portal
    const { whatsappService } = await import("@/server/modules/whatsapp/service");
    const snapshot = await whatsappService.getGatewaySnapshot();

    return ok({
      qr: snapshot.qrCode,
      status: snapshot.internalStatus,
      runtimeStatus: snapshot.runtimeStatus,
      linked: snapshot.linked,
      phoneNumber: snapshot.phoneNumber,
      sessionName: snapshot.sessionName,
      lastConnectedAt: snapshot.lastConnectedAt,
      requiresPhoneNumberBeforeInit: snapshot.requiresPhoneNumberBeforeInit,
      lastErrorMessage: snapshot.lastErrorMessage,
      runtimeMode,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
