import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import {
  BUNYI_KEHADIRAN,
  muatKehadiran,
  simpanKehadiran,
  type MasukanKehadiran,
} from "@/server/modules/aleta-ecourt/bas-kehadiran";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { getSearchParam } from "@/server/shared/request";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Kehadiran para pihak pada satu sidang.
 *
 *   GET  ?perkaraId=10102&sidangKe=1   catatan kehadiran sidang itu
 *   PUT  {perkaraId, sidangKe, ...}    menyimpannya
 *
 * Bunyi kehadiran yang lazim ikut dikirim supaya panitera dapat memilih tanpa
 * mengetik - tetapi kotaknya tetap bebas diketik. Perkara menghadirkan keadaan
 * yang tidak terduga, dan daftar tertutup memaksa memilih yang paling mendekati
 * lalu menuliskan yang tidak terjadi.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");

    const perkaraId = String(getSearchParam(request, "perkaraId") ?? "").trim();
    const sidangKe = Number(getSearchParam(request, "sidangKe") ?? "0") || 0;

    const kehadiran = await muatKehadiran(db, perkaraId, sidangKe);
    return ok({ ada: Boolean(kehadiran), kehadiran, bunyi: BUNYI_KEHADIRAN });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "BAS_KEHADIRAN_BACA_FAILED",
      feature: "aleta_ecourt",
      entityId: "bas-kehadiran",
    });
  }
}

export async function PUT(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");

    const masukan = (await request.json()) as MasukanKehadiran;
    const kehadiran = await simpanKehadiran(db, String(actorUserId ?? ""), masukan);

    return ok({ ok: true, kehadiran });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "BAS_KEHADIRAN_SIMPAN_FAILED",
      feature: "aleta_ecourt",
      entityId: "bas-kehadiran",
    });
  }
}
