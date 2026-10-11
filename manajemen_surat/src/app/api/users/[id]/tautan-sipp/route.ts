import { NextRequest } from "next/server";

import { isPrivilegedAdmin } from "@/lib/permissions";
import { getDatabase } from "@/server/db/client";
import { tinjauTautanSipp } from "@/server/modules/external-apps/service";
import { requireActorUser } from "@/server/modules/organization/service";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/users/[id]/tautan-sipp  { aksi: "setujui" | "cabut" }
 *
 * Tinjauan Admin atas tautan akun SIPP yang dibuat ALETA sendiri saat masuk
 * otomatis dari SIPP (nama/NIP sama, 11 Okt 2026). Lihat
 * src/server/modules/portal/masuk-sipp-nama.ts.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let actorId = "";
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let targetUserId = "unknown";
  try {
    const { id } = await params;
    targetUserId = id;
    db = await getDatabase();
    actorId = await resolveActorUserId(request);
    const actor = await requireActorUser(db, actorId);
    if (!isPrivilegedAdmin(actor)) throw new ApiError(403, "Hanya Admin atau Super Admin yang dapat meninjau tautan akun SIPP.");
    const badan = (await request.json().catch(() => ({}))) as { aksi?: unknown };
    const aksi = badan.aksi === "setujui" || badan.aksi === "cabut" ? badan.aksi : null;
    if (!aksi) throw new ApiError(400, "Aksi harus 'setujui' atau 'cabut'.");
    return ok(await tinjauTautanSipp(db, { actor, userId: targetUserId, aksi }));
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId: actorId,
      action: "SIPP_LINK_REVIEW_ACCESS_FAILED",
      feature: "user_management",
      entityId: targetUserId,
    });
  }
}
