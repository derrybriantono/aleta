import { NextRequest } from "next/server";

import { isPrivilegedAdmin } from "@/lib/permissions";
import { getDatabase } from "@/server/db/client";
import { requireActorUser } from "@/server/modules/organization/service";
import {
  getWhatsappRuntimeMode,
  getWhatsappRuntimeModeDiagnostics,
  resetGatewayWhatsapp,
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
      throw new ApiError(403, "Hanya Admin atau Super Admin yang dapat menonaktifkan WhatsApp.");
    }

    const runtimeMode = getWhatsappRuntimeMode();
    const runtimeDiagnostics = getWhatsappRuntimeModeDiagnostics();

    if (runtimeMode === "aleta_bot") {
      // Reset penuh sesi di gateway: menghentikan client, menghapus sesi lama,
      // lalu menginisiasi ulang. Ini juga jalur pemulihan bila QR macet/gagal.
      const resetResult = await resetGatewayWhatsapp(true);
      if (!resetResult.ok) {
        throw new ApiError(502, `Gagal mereset sesi WhatsApp di aleta_bot: ${resetResult.error}`);
      }
      return ok({
        message:
          resetResult.data.message ||
          "Sesi WhatsApp direset. Klik 'Mulai Inisiasi / Tampilkan QR' untuk memindai QR baru.",
        snapshot: {
          runtimeStatus: "initializing",
          internalStatus: "initializing",
          qrCode: null,
          linked: false,
          phoneNumber: "",
          sessionName: "aleta-whatsapp-main",
          savedStatus: "inactive",
          lastConnectedAt: null,
          requiresPhoneNumberBeforeInit: false,
          lastErrorMessage: null,
        },
        runtimeMode,
        runtimeDiagnostics,
      });
    }

    if (runtimeMode === "disabled") {
      return ok({
        message: "WhatsApp sudah dinonaktifkan (WHATSAPP_RUNTIME_MODE=disabled).",
        runtimeMode,
        runtimeDiagnostics,
      });
    }

    // legacy_portal
    const { whatsappService } = await import("@/server/modules/whatsapp/service");
    const snapshot = await whatsappService.deactivate();

    return ok({
      message:
        "Sesi WhatsApp gateway dinonaktifkan dari runtime aktif. Nomor resmi tetap tersimpan, dan inisialisasi ulang bisa dilakukan lagi dari halaman ini kapan saja.",
      snapshot,
      runtimeMode,
      runtimeDiagnostics,
    });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "WHATSAPP_GATEWAY_ACCESS_FAILED",
      feature: "whatsapp_gateway",
      entityId: "deactivate",
    });
  }
}
