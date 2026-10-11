import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { rejectSuggestedLink } from "@/server/modules/judicia/legal-form/jlf-account-sync-service";
import { asRecord, normalizeId, readOptionalStringValue } from "@/server/modules/judicia/legal-form/jlf-validation";
import { requireActorUser } from "@/server/modules/organization/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";
import { readJsonBody } from "@/server/shared/request";
import { pastikanAplikasiAktor } from "@/server/modules/akses/hak-peran";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const payload = asRecord(await readJsonBody(request).catch(() => ({})));
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const actor = await requireActorUser(db, actorUserId);
    await pastikanAplikasiAktor(db, actor, "judicia-legal-form"); // HAK-PERAN 12 Okt: aplikasi belum fix
    const link = await rejectSuggestedLink(
      db,
      actor,
      normalizeId(id, "ID link akun"),
      readOptionalStringValue(payload, "reason", { maxLength: 300 }) ?? "Ditolak admin."
    );

    return ok(link);
  } catch (error) {
    return handleRouteError(error);
  }
}
