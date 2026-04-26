import { NextRequest } from "next/server";

import { isPrivilegedAdmin } from "@/lib/permissions";
import { getDatabase } from "@/server/db/client";
import { requireActorUser } from "@/server/modules/organization/service";
import { whatsappService } from "@/server/modules/whatsapp/service";
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

    const snapshot = await whatsappService.deactivate();

    return ok({
      message:
        "Sesi WhatsApp gateway dinonaktifkan dari runtime aktif. Nomor resmi tetap tersimpan, dan inisialisasi ulang bisa dilakukan lagi dari halaman ini kapan saja.",
      snapshot,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
