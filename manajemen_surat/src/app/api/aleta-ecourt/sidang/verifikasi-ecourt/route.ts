import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { getGatewayVerifikasiHariIni } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Penanda verifikasi majelis untuk perkara e-Litigasi yang bersidang pada
 * satu tanggal (butir 30, 5 Okt 2026). HANYA membaca simpanan bot - tidak
 * pernah menarik e-Court saat halaman dimuat; penarikannya di latar bot.
 * Kewenangannya "panel", sama dengan Jadwal Sidang.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");

    const tanggal = String(request.nextUrl.searchParams.get("tanggal") || "").trim();
    const hasil = await getGatewayVerifikasiHariIni(tanggal);
    if (!hasil.ok) {
      return ok({ available: false, alasan: hasil.error || "ALETA Bot belum dapat dihubungi." });
    }
    return ok({ available: true, ...(hasil.data as Record<string, unknown>) });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ECOURT_VERIFIKASI_HARIAN_READ_FAILED",
      feature: "aleta_ecourt",
    });
  }
}
