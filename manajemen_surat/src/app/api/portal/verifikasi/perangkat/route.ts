import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { requireActorUser } from "@/server/modules/organization/service";
import { cabutPerangkatTepercaya } from "@/server/modules/verifikasi/layanan";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Mencabut kepercayaan perangkat MILIK SENDIRI ({perangkatId}; kosong = semua perangkat). */
export async function DELETE(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actor = await requireActorUser(db, await resolveActorUserId(request));
    const badan = await readJsonBody<{ perangkatId?: string }>(request).catch(() => ({}) as { perangkatId?: string });
    const dicabut = await cabutPerangkatTepercaya(db, actor.id, badan.perangkatId ? String(badan.perangkatId) : undefined);
    return ok({ dicabut });
  } catch (error) {
    return handleRouteError(error);
  }
}
