import { type NextRequest } from "next/server";

import { KETERANGAN_KINERJA } from "@/lib/kinerja-ekstensi";
import { getDatabase } from "@/server/db/client";
import { bacaKinerja, simpanKinerja } from "@/server/modules/aleta-ecourt/kinerja-ekstensi";
import { bolehMenyuntingAkses } from "@/server/modules/aleta-ecourt/akses";
import { requireActorUser } from "@/server/modules/organization/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { handleRouteError, ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Saklar kinerja ekstensi/portal.
 *   GET -> { saklar, keterangan, bolehMengubah }   (siapa saja yang masuk)
 *   PUT {saklar-yang-diubah: boolean} -> { saklar }  (HANYA Super Admin; tercatat di audit)
 */
export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actor = await requireActorUser(db, await resolveActorUserId(request));
    return ok({ saklar: await bacaKinerja(db), keterangan: KETERANGAN_KINERJA, bolehMengubah: bolehMenyuntingAkses(actor) });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actorId = await resolveActorUserId(request);
    let badan: unknown;
    try {
      badan = await request.json();
    } catch {
      throw new ApiError(400, "Badan permintaan harus JSON.");
    }
    return ok({ saklar: await simpanKinerja(db, actorId, badan) });
  } catch (error) {
    return handleRouteError(error);
  }
}
