import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { getGatewayDaftarPenilaian } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Daftar penilaian yang terdaftar pada kerangka.
 *
 * ============================================================================
 * DAFTARNYA DATANG DARI MESINNYA, BUKAN DITULIS ULANG DI SINI
 * ============================================================================
 *
 * Layar tidak menyimpan daftar penilaiannya sendiri. Menyalinnya ke sisi portal
 * berarti dua daftar yang perlahan menyimpang, dan pada suatu hari layar
 * menawarkan penilaian yang sudah tidak ada - atau menyembunyikan yang baru.
 *
 * Cara hitung dan ambang tiap penilaian ikut datang dari mesinnya pula, supaya
 * panel "cara hitung" menampilkan yang BENAR-BENAR dipakai menghitung.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");

    const hasil = await getGatewayDaftarPenilaian();
    if (!hasil.ok) {
      return ok({
        available: false,
        ok: false,
        alasan: hasil.error || "ALETA Bot belum dapat dihubungi.",
      });
    }

    return ok({ available: true, ...(hasil.data as Record<string, unknown>) });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      feature: "aleta-penilaian",
      action: "daftar",
    });
  }
}
