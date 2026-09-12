import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { getGatewayJejakPenetapan } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ============================================================================
 * RIWAYAT PERBUATAN ALETA PADA PENETAPAN
 * ============================================================================
 *
 * Sampai 1.105.0 penelusurannya dititipkan pada sys_audittrail SIPP: tiap
 * baris yang ditulis ALETA diakhiri "[ALETA] diisikan operator <nama>".
 * Tempatnya keliru - sys_audittrail catatan milik SIPP, dan tidak ada satu pun
 * baris SIPP yang menyebut alat yang dipakai mengetiknya.
 *
 * Sekarang riwayatnya milik ALETA, dan justru lebih lengkap:
 *
 *   - percobaan yang DITOLAK ikut tercatat beserta sebabnya; di sys_audittrail
 *     yang gagal tidak pernah meninggalkan jejak sama sekali,
 *   - tabel apa saja yang disentuh tiap langkah tercatat utuh,
 *   - akun SIPP yang dipakai dan operator ALETA yang menekan tombolnya
 *     tercatat berdampingan - dua orang yang belum tentu sama.
 *
 * Kewenangannya sama dengan menulis dan membongkar penetapan: yang boleh
 * mengerjakannya, dialah yang boleh membaca catatannya.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "penunjukan");

    const ruas = request.nextUrl.searchParams;

    const perkaraMentah = Number(ruas.get("perkaraId"));
    const perkaraId = Number.isFinite(perkaraMentah) && perkaraMentah > 0 ? perkaraMentah : undefined;

    const nomorPerkara = String(ruas.get("nomorPerkara") || "").trim() || undefined;

    // Batasnya dijepit di sini JUGA, bukan hanya di bot: rute ini terbuka bagi
    // peramban, dan permintaan batas satu juta akan menghabiskan ingatan bot
    // sebelum satu baris pun sampai ke layar.
    const batasMentah = Number(ruas.get("batas"));
    const batas = Number.isFinite(batasMentah) ? Math.max(1, Math.min(100, batasMentah)) : 30;

    const respons = await getGatewayJejakPenetapan({ perkaraId, nomorPerkara, batas });
    return Response.json(respons, { status: respons?.ok === false ? 502 : 200 });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "SIPP_PENETAPAN_RIWAYAT_FAILED",
      feature: "aleta_ecourt",
    });
  }
}
