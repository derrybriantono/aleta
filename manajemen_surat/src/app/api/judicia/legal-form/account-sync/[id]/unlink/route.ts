import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { unlinkAccount } from "@/server/modules/judicia/legal-form/jlf-account-sync-service";
import { asRecord, normalizeId, readOptionalStringValue } from "@/server/modules/judicia/legal-form/jlf-validation";
import { requireActorUser } from "@/server/modules/organization/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";
import { readJsonBody } from "@/server/shared/request";

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
    const link = await unlinkAccount(
      db,
      actor,
      normalizeId(id, "ID link akun"),
      readOptionalStringValue(payload, "reason", { maxLength: 300 }) ?? "Diputus admin."
    );

    return ok(link);
  } catch (error) {
    return handleRouteError(error);
  }
}
