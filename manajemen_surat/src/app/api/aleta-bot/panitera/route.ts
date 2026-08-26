import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { getGatewayPaniteraDashboard } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { requireActorUser } from "@/server/modules/organization/service";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Ringkasan kerja panitera pengganti.
 *
 * Hanya membaca. Tidak ada tombol yang mengubah apa pun dari halaman ini -
 * keputusan verifikasi tetap di tangan hakim lewat menu WhatsApp-nya sendiri.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await requireActorUser(db, actorUserId);

    const limit = Number(request.nextUrl.searchParams.get("limit") || 100);
    const hasil = await getGatewayPaniteraDashboard({ limit });

    if (!hasil.ok) {
      // Bot tidak terjangkau bukan berarti tidak ada pekerjaan menunggu -
      // bedakan supaya petugas tidak salah menyimpulkan halaman kosong.
      return ok({
        available: false,
        message: hasil.error || "ALETA Bot belum dapat dihubungi.",
        dashboard: null,
      });
    }

    return ok({
      available: true,
      message: "",
      dashboard: hasil.data?.dashboard ?? null,
    });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "PANITERA_DASHBOARD_ACCESS_FAILED",
      feature: "panitera_dashboard",
      entityId: "dashboard",
    });
  }
}
