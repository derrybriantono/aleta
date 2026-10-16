import { type NextRequest } from "next/server";

import { isPrivilegedAdmin } from "@/lib/permissions";
import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { bacaDrafSaya } from "@/server/modules/aleta-ecourt/agen-h7-putusan";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * F4.2 - widget ALETA: draf H-7 milik akun (majelis, PP, konseptor sementara;
 * Super Admin/Admin: semua) dengan Hari Putusan hari ini s.d. tujuh hari lagi.
 * Satu GET dari basis data ALETA; SIPP/ABT tidak disentuh.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const actor = await pastikanKapabilitas(db, actorUserId, "panel");
    const lihatSemua = isPrivilegedAdmin(actor);
    const hasil = await bacaDrafSaya(db, { nama: String(actor?.name || ""), lihatSemua });
    return ok({ available: true, ok: true, lihatSemua, ...hasil });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "AGEN_H7_SAYA_FAILED",
      feature: "aleta_ecourt",
      entityId: "agen-h7-saya",
    });
  }
}
