import { NextRequest } from "next/server";

import { isPrivilegedAdmin } from "@/lib/permissions";
import { getDatabase } from "@/server/db/client";
import { requireActorUser } from "@/server/modules/organization/service";
import {
  connectGatewayWhatsapp,
  getWhatsappRuntimeMode,
} from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { handleRouteError, ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const actorUserId = await resolveActorUserId(request);
    const db = await getDatabase();
    const actor = await requireActorUser(db, actorUserId);

    if (!isPrivilegedAdmin(actor)) {
      throw new ApiError(403, "Hanya Admin atau Super Admin yang dapat menginisialisasi WhatsApp.");
    }

    const runtimeMode = getWhatsappRuntimeMode();

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
        runtimeLabel: "ALETA Bot Gateway",
        singleGateway: true,
      });
    }

    if (runtimeMode === "disabled") {
      return ok({
        message: "WhatsApp dinonaktifkan (WHATSAPP_RUNTIME_MODE=disabled). Tidak ada yang perlu diinisialisasi.",
        runtimeMode,
      });
    }

    // legacy_portal
    const { whatsappService } = await import("@/server/modules/whatsapp/service");
    void whatsappService.initialize();

    return ok({
      message: "Proses inisialisasi WhatsApp dimulai. Pairing QR bisa dilakukan tanpa wajib mengisi nomor resmi terlebih dahulu.",
      runtimeMode,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
