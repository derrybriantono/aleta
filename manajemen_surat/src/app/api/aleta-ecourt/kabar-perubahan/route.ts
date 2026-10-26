import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { kabarPerubahanDariCermin } from "@/server/modules/cermin/kabar";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Kabar perubahan data SIPP untuk satu perkara (A8 / U17, 25 Okt 2026), dari jejak
 * Cermin Perkara: SATU baca Postgres, tanpa menyentuh SIPP. Kewenangannya "panel",
 * sama dengan sipp-konteks.
 *
 *   GET ?nomor=...&sejak=<token ISO>
 *     -> { available: true, kabar: { aktif, alasan, token, berubah, diubahPada, bagian, kemungkinanDariAleta } }
 *
 * Tanpa `sejak` hanya mengembalikan `token` dasar. `aktif:false` = klien diam (saklar
 * Kabar perubahan mati, cermin tertinggal, atau perkara belum tercermin).
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");
    const nomor = String(request.nextUrl.searchParams.get("nomor") || "").trim();
    const sejak = String(request.nextUrl.searchParams.get("sejak") || "").trim();
    const kabar = await kabarPerubahanDariCermin(nomor, sejak);
    return ok({ available: true, kabar });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "KABAR_PERUBAHAN_CERMIN_READ_FAILED",
      feature: "cermin_perkara",
      entityId: "kabar-perubahan",
    });
  }
}
