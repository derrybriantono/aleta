import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { bacaJejak, bolehLihatSemua } from "@/server/modules/aleta-ecourt/agen";
import { requireActorUser } from "@/server/modules/organization/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Riwayat agen. GET ?semua=1&tugas=<kunci>&batas=<n>
 *
 * Semua petugas hanya untuk Super Admin; selain itu selalu milik pemanggil
 * (permintaan semua=1 dari yang tidak berhak diam-diam jatuh ke miliknya).
 */
export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const actor = await requireActorUser(db, actorUserId);
    const q = request.nextUrl.searchParams;
    const semua = q.get("semua") === "1" && bolehLihatSemua(actor);
    const jejak = await bacaJejak(db, {
      penggunaId: semua ? undefined : actor.id,
      tugas: q.get("tugas") || undefined,
      batas: Number(q.get("batas") || 100),
    });
    return ok({ semua, jejak });
  } catch (error) {
    return handleRouteError(error);
  }
}
