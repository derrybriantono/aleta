import { NextRequest } from "next/server";

import { isPrivilegedAdmin } from "@/lib/permissions";
import { getDatabase } from "@/server/db/client";
import { requireActorUser } from "@/server/modules/organization/service";
import {
  connectGatewayWhatsapp,
  getWhatsappRuntimeMode,
  getWhatsappRuntimeModeDiagnostics,
} from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    actorUserId = await resolveActorUserId(request);
    db = await getDatabase();
    const actor = await requireActorUser(db, actorUserId);

    if (!isPrivilegedAdmin(actor)) {
      throw new ApiError(403, "Hanya Admin atau Super Admin yang dapat menginisialisasi WhatsApp.");
    }

    const runtimeMode = getWhatsappRuntimeMode();
    const runtimeDiagnostics = getWhatsappRuntimeModeDiagnostics();

    if (runtimeMode === "aleta_bot") {
      const result = await connectGatewayWhatsapp();
      if (!result.ok) {
        throw new ApiError(502, result.error);
      }

      return ok({
        message: result.data.message ?? "Connect WhatsApp Gateway diminta ke runtime ALETA Bot.",
        gatewayStatus: result.data.status,
        started: result.data.started ?? false,
        qrAvailable: result.data.qrAvailable ?? false,
        runtimeMode,
        runtimeDiagnostics,
        runtimeLabel: "ALETA Bot Gateway",
        singleGateway: true,
      });
    }

    if (runtimeMode === "disabled") {
      return ok({
        message: "WhatsApp dinonaktifkan (WHATSAPP_RUNTIME_MODE=disabled). Tidak ada yang perlu diinisialisasi.",
        runtimeMode,
        runtimeDiagnostics,
      });
    }

    // legacy_portal
    const { whatsappService } = await import("@/server/modules/whatsapp/service");
    void whatsappService.initialize();

    return ok({
      message: "Proses inisialisasi WhatsApp dimulai. Pairing QR bisa dilakukan tanpa wajib mengisi nomor resmi terlebih dahulu.",
      runtimeMode,
      runtimeDiagnostics,
    });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "WHATSAPP_GATEWAY_ACCESS_FAILED",
      feature: "whatsapp_gateway",
      entityId: "init",
    });
  }
}
