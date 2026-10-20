import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { bacaKeadaanPenetapanGateway } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Keadaan penetapan satu perkara - SATU sumber (bot: penetapanKeadaanService)
 * untuk kartu Penetapan, tombol di halaman SIPP, dan penanda halaman SIPP.
 * Hanya membaca. Bentuknya: docs/penetapan/KERJAKAN-PENETAPAN.md bagian 2.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");

    const nomor = String(request.nextUrl.searchParams.get("nomor") || "").trim();
    const perkaraId = Number(request.nextUrl.searchParams.get("perkaraId") || 0);
    if (!nomor && !(perkaraId > 0)) return ok({ ok: false, alasan: "perkara_tidak_disebut" });

    const hasil = await bacaKeadaanPenetapanGateway({
      ...(perkaraId > 0 ? { perkaraId } : {}),
      ...(nomor ? { nomorPerkara: nomor } : {}),
    });
    if (!hasil.ok) {
      return ok({ ok: false, alasan: hasil.status === 404 ? "perkara_tidak_ketemu" : "keadaan_tidak_terbaca", pesan: hasil.error });
    }
    return ok(hasil.data);
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "PENETAPAN_KEADAAN_READ_FAILED",
      feature: "penunjukan",
      entityId: "keadaan",
    });
  }
}
