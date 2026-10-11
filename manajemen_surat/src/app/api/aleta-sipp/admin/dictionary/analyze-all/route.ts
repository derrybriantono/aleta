import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { AletaSippService } from "@/server/modules/aleta-sipp/aleta-sipp-service";
import { requireActorUser } from "@/server/modules/organization/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";
import { readJsonBody } from "@/server/shared/request";
import { pastikanAplikasiAktor } from "@/server/modules/akses/hak-peran";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await readJsonBody<{
      batchSize?: number;
      offset?: number;
      continueToken?: string;
      force?: boolean;
    }>(request).catch(() => ({}));
    const db = await getDatabase();
    const actor = await requireActorUser(db, await resolveActorUserId(request));
    await pastikanAplikasiAktor(db, actor, "aleta-sipp"); // HAK-PERAN 12 Okt: aplikasi belum fix
    return ok(await AletaSippService.analyzeAllAletaSippDictionary(db, actor, body));
  } catch (error) {
    return handleRouteError(error);
  }
}
