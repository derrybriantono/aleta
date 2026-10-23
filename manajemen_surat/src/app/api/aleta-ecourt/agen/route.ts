import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { susunAgen } from "@/server/modules/aleta-ecourt/agen";
import { requireActorUser } from "@/server/modules/organization/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";
import { alamatIpPeramban } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Agen ALETA tahap 1 - dibaca widget agen di ekstensi.
 *
 *   GET ?peran=super-admin|hakim
 *
 * Selalu tentang PEMANGGILNYA SENDIRI. Sekaligus menjalankan tugas yang jatuh
 * tempo untuk pemanggil ini (paling cepat tiap 2 menit, sekali per periode) -
 * lihat agen.ts. Tidak ada tulisan ke SIPP, ABT, atau e-Court dari rute ini.
 *
 * Tanpa sesi: 401 (requireActorUser).
 */
export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const actor = await requireActorUser(db, actorUserId);
    const data = await susunAgen(db, actor, {
      peranDiminta: request.nextUrl.searchParams.get("peran") || "",
      alamatIp: alamatIpPeramban(request),
    });
    return ok(data);
  } catch (error) {
    return handleRouteError(error);
  }
}
