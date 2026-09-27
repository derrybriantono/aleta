import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { tautanSippPerkara } from "@/server/modules/aleta-ecourt/sipp-tautan";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Alamat halaman satu perkara di SIPP.
 *
 *   GET ?perkaraId=<id>[&nomor=<nomor>]   atau   GET ?nomor=<nomor>
 *
 * Jawabannya SELALU 200 { ok: true, data: { alamat, alasan } } - alamat mutlak
 * ke halaman perkara, atau alamat "" dengan alasan berupa kalimat untuk
 * petugas. Hanya galat kewenangan yang bukan 200, sama dengan rute lain.
 *
 * Bila perkaraId dan nomor dikirim bersama, bot memastikan keduanya menunjuk
 * perkara yang SAMA. Membuka perkara lain tanpa ada yang menyadarinya jauh
 * lebih mahal daripada satu tombol yang menolak.
 *
 * Kemampuannya sama dengan Status Perkara ("panel"): tautan ini hanya jalan
 * pintas ke halaman yang isinya sudah terbaca di layar itu.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");

    const p = request.nextUrl.searchParams;
    return ok(
      await tautanSippPerkara({
        perkaraId: p.get("perkaraId"),
        nomor: p.get("nomor"),
      })
    );
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "SIPP_TAUTAN_PERKARA_READ_FAILED",
      feature: "aleta_ecourt",
    });
  }
}
