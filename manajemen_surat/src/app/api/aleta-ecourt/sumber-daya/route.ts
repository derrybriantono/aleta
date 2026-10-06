import { type NextRequest } from "next/server";

import { isPrivilegedAdmin } from "@/lib/permissions";
import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { mintaSumberDayaBot } from "@/server/modules/sumber-daya/gateway";
import { bacaSumberDaya, ringkasUntukWidget } from "@/server/modules/sumber-daya/layanan";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { handleRouteError, ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Indikator sumber daya untuk widget ekstensi - butir 3 (6 Oktober 2026).
 *
 *   GET -> { diukurPada, ringkas: { aleta, server } (RAM, disk, GPU: persen +
 *          warna), bolehRinci, alamatRinci }
 *
 * Kewenangannya "panel" (sama dengan panel ekstensi). Rincian per container
 * dan layanan host TIDAK ikut - itu di /api/admin/sumber-daya, Admin saja.
 * Bersinggah 3 detik di portal dan di bot; hanya membaca.
 */
export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const actor = await pastikanKapabilitas(db, actorUserId, "panel");
    const hasil = await bacaSumberDaya(db, () => mintaSumberDayaBot());
    if (!hasil.ok) throw new ApiError(503, hasil.error);
    return ok(ringkasUntukWidget(hasil.data, isPrivilegedAdmin(actor)));
  } catch (error) {
    return handleRouteError(error);
  }
}
