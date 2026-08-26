import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { getGatewayOnlineQueueMonitor } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { requireActorUser } from "@/server/modules/organization/service";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Pemantauan antrian sidang online untuk halaman ALETA Bot.
 *
 * Hanya membaca. Petugas perlu tahu antriannya jalan atau tidak: bila basis
 * data antrian putus, perintah "daftar antrian" dari pihak gagal tanpa ada
 * yang menyadari, dan itu baru ketahuan saat sidang.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    // requireActorUser sekaligus menolak akun yang sudah diblokir.
    await requireActorUser(db, actorUserId);

    const limit = Number(request.nextUrl.searchParams.get("limit") || 100);
    const logLimit = Number(request.nextUrl.searchParams.get("logLimit") || 50);

    const hasil = await getGatewayOnlineQueueMonitor({ limit, logLimit });

    if (!hasil.ok) {
      // Bot tidak terjangkau bukan berarti antrian bermasalah - bedakan supaya
      // petugas tidak salah menyimpulkan.
      return ok({
        available: false,
        message: hasil.error || "ALETA Bot belum dapat dihubungi.",
        monitor: null,
        logs: [],
      });
    }

    return ok({
      available: true,
      message: "",
      monitor: hasil.data?.monitor ?? null,
      logs: hasil.data?.logs ?? [],
    });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ONLINE_QUEUE_MONITOR_ACCESS_FAILED",
      feature: "antrian_online",
      entityId: "monitor",
    });
  }
}
