import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { createManualLink } from "@/server/modules/judicia/legal-form/jlf-account-sync-service";
import { asRecord, normalizeId } from "@/server/modules/judicia/legal-form/jlf-validation";
import { requireActorUser } from "@/server/modules/organization/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { created, handleRouteError } from "@/server/shared/http";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const payload = asRecord(await readJsonBody(request));
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const actor = await requireActorUser(db, actorUserId);
    const link = await createManualLink(db, actor, {
      aletaUserId: normalizeId(String(payload.aletaUserId ?? ""), "ID user ALETA"),
      sippUserId: normalizeId(String(payload.sippUserId ?? ""), "ID user SIPP"),
    });

    return created(link);
  } catch (error) {
    return handleRouteError(error);
  }
}
