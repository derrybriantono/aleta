import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { getGatewayAlatEAudit } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Dua puluh alat di dalam penilaian beserta keadaannya.
 *
 * Keadaannya dihitung di sisi bot dari berkas yang benar-benar ada pada kedua
 * sisi - mesin dan layar. Alat yang mesinnya sudah ada tetapi layarnya belum
 * BUKAN alat yang selesai: angkanya terhitung tetapi tidak terlihat siapa pun,
 * dan itu keadaan yang paling mudah dianggap tuntas.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");

    const hasil = await getGatewayAlatEAudit();
    if (!hasil.ok) {
      return ok({ available: false, ok: false, alasan: hasil.error || "ALETA Bot belum dapat dihubungi." });
    }
    return ok({ available: true, ...(hasil.data as Record<string, unknown>) });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      feature: "aleta-e-audit",
      action: "alat",
    });
  }
}
