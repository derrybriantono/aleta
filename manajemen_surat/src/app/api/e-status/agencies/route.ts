import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { createEStatusAgency, listEStatusAgencies } from "@/server/modules/e-status/estatus-service";
import { requireActorUser } from "@/server/modules/organization/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { created, handleRouteError, ok } from "@/server/shared/http";
import { readJsonBody } from "@/server/shared/request";
import { pastikanAplikasiAktor } from "@/server/modules/akses/hak-peran";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actor = await requireActorUser(db, await resolveActorUserId(request));
    await pastikanAplikasiAktor(db, actor, "e-status"); // HAK-PERAN 12 Okt: aplikasi belum fix
    return ok(await listEStatusAgencies(db, actor));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await readJsonBody<Record<string, unknown>>(request)) ?? {};
    const db = await getDatabase();
    const actor = await requireActorUser(db, await resolveActorUserId(request));
    await pastikanAplikasiAktor(db, actor, "e-status"); // HAK-PERAN 12 Okt: aplikasi belum fix
    return created(await createEStatusAgency(db, actor, payload, request));
  } catch (error) {
    return handleRouteError(error);
  }
}
