import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { getGatewaySebaranJurusita } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Sebaran relaas per jurusita.
 *
 * ============================================================================
 * ANGKA TENTANG ORANG, DAN KARENA ITU HARUS BENAR
 * ============================================================================
 *
 * Daftar ini menyebut nama dan menghitung pekerjaannya - ia dapat dipakai
 * membagi beban, dan dapat dipakai menilai. Sampai 2.33.0 nama jurusita
 * dicari di tabel yang salah, dan 61,6% baris yang bernama menyebut ORANG
 * LAIN sementara dua jurusita tersibuk tidak pernah muncul sama sekali.
 *
 * Yang belum bernama disebutkan jumlahnya, bukan disembunyikan: daftar yang
 * menyembunyikan bagian tak bernamanya akan dibaca sebagai lengkap.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");

    const p = request.nextUrl.searchParams;
    const hasil = await getGatewaySebaranJurusita({
      periode: p.get("periode") || "tahun",
      acuan: p.get("acuan") || "",
      dari: p.get("dari") || "",
      sampai: p.get("sampai") || "",
    });
    if (!hasil.ok) {
      return Response.json(
        { ok: false, alasan: hasil.error || "sebaran_belum_dapat_dibaca" },
        { status: 502 }
      );
    }
    return ok(hasil.data);
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "SEBARAN_JURUSITA_FAILED",
      feature: "aleta_ecourt",
    });
  }
}
