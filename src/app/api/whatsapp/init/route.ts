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
      throw new ApiError(403, "Hanya Admin atau Super Admin yang dapat menginisialisasi WhatsApp.");
    }

    const runtimeMode = getWhatsappRuntimeMode();

    if (runtimeMode === "aleta_bot") {
      return ok({
        message:
          "Inisialisasi WhatsApp dikelola oleh aleta_bot gateway. Gunakan panel ALETA Bot untuk menghubungkan ulang sesi.",
        runtimeMode,
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
