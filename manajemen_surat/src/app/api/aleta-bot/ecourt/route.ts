import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import {
  getGatewayEcourtStatus,
  setGatewayEcourtAktif,
} from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { requireActorUser } from "@/server/modules/organization/service";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Keadaan e-Court untuk tab pengelolaan di halaman ALETA Bot. */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await requireActorUser(db, actorUserId);

    const hasil = await getGatewayEcourtStatus({
      limit: Number(request.nextUrl.searchParams.get("limit") || 100),
      dokumenLimit: Number(request.nextUrl.searchParams.get("dokumenLimit") || 25),
    });

    if (!hasil.ok) {
      return ok({
        available: false,
        message: hasil.error || "ALETA Bot belum dapat dihubungi.",
        status: null,
        dokumen: [],
      });
    }

    return ok({
      available: true,
      message: "",
      status: hasil.data?.status ?? null,
      dokumen: hasil.data?.dokumen ?? [],
    });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ECOURT_STATUS_READ_FAILED",
      feature: "ecourt",
      entityId: "status",
    });
  }
}

/**
 * Menyalakan atau mematikan pemberitahuan e-Court.
 *
 * Mematikan tidak membuang antrean: dokumen yang menunggu tetap menunggu dan
 * dikirim begitu dinyalakan kembali.
 */
export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await requireActorUser(db, actorUserId);

    const body = (await request.json()) as { aktif?: boolean };
    const hasil = await setGatewayEcourtAktif(body.aktif === true);

    if (!hasil.ok) {
      return ok({ ok: false, message: hasil.error || "ALETA Bot belum dapat dihubungi." });
    }

    return ok({ ok: true, aktif: hasil.data?.aktif === true });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ECOURT_TOGGLE_FAILED",
      feature: "ecourt",
      entityId: "aktif",
    });
  }
}
