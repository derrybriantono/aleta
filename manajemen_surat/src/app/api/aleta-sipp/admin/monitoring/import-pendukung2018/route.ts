import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { AletaSippMonitoringService } from "@/server/modules/aleta-sipp/aleta-sipp-monitoring-service";
import { requireActorUser } from "@/server/modules/organization/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";
import { pastikanAplikasiAktor } from "@/server/modules/akses/hak-peran";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actor = await requireActorUser(db, await resolveActorUserId(request));
    await pastikanAplikasiAktor(db, actor, "aleta-sipp"); // HAK-PERAN 12 Okt: aplikasi belum fix
    return ok(await AletaSippMonitoringService.importPendukung2018(db, actor));
  } catch (error) {
    return handleRouteError(error);
  }
}
