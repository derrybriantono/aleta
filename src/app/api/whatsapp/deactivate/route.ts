import { NextRequest } from "next/server";

import { isPrivilegedAdmin } from "@/lib/permissions";
import { getDatabase } from "@/server/db/client";
import { requireActorUser } from "@/server/modules/organization/service";
import { getWhatsappRuntimeMode } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
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
      throw new ApiError(403, "Hanya Admin atau Super Admin yang dapat menonaktifkan WhatsApp.");
    }

    const runtimeMode = getWhatsappRuntimeMode();

    if (runtimeMode === "aleta_bot") {
      return ok({
        message:
          "Sesi WhatsApp dikelola oleh aleta_bot gateway. Gunakan panel ALETA Bot (action: logout) untuk menonaktifkan sesi.",
        runtimeMode,
      });
    }

    if (runtimeMode === "disabled") {
      return ok({
        message: "WhatsApp sudah dinonaktifkan (WHATSAPP_RUNTIME_MODE=disabled).",
        runtimeMode,
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
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
