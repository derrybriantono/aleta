import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanAdminIstimewa } from "@/server/modules/aleta-ecourt/akses";
import { mintaSumberDayaBot } from "@/server/modules/sumber-daya/gateway";
import { bacaSumberDaya } from "@/server/modules/sumber-daya/layanan";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { handleRouteError, ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Rincian sumber daya server - butir 3 (6 Oktober 2026). Super Admin dan Admin.
 *
 *   GET -> ringkasan ALETA / seluruh server, RAM per container ALETA dan per
 *          layanan host lain, partisi, disk ALETA per sumber, GPU, sumber tiap
 *          angka, dan catatan yang belum terukur.
 *
 * Hanya membaca. Bersinggah 3 detik (layar berdetak tiap 5 detik).
 */
export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    await pastikanAdminIstimewa(db, actorUserId, "melihat rincian sumber daya server");
    const hasil = await bacaSumberDaya(db, () => mintaSumberDayaBot());
    if (!hasil.ok) throw new ApiError(503, hasil.error);
    return ok(hasil.data);
  } catch (error) {
    return handleRouteError(error);
  }
}
