import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { getGatewayKatalogEAudit } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";
import { pastikanAplikasi } from "@/server/modules/akses/hak-peran";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Katalog ALETA e-Audit - seratus delapan puluh lima butir.
 *
 * ============================================================================
 * SISA PEKERJAAN IKUT DIPULANGKAN, DAN ITU DISENGAJA
 * ============================================================================
 *
 * Jawaban ini membawa berapa butir yang sudah tersambung penuh, berapa baru
 * sebagian, dan berapa yang belum sama sekali. Angka itu dihitung di sisi bot
 * dari selisih antara katalog dan penilaian yang benar-benar terdaftar -
 * bukan disimpan, sehingga tidak mungkin usang.
 *
 * Aplikasi yang menyembunyikan sisa pekerjaannya tampak selesai padahal baru
 * sebagian, dan orang yang membukanya menyangka ALETA tidak menilai hal yang
 * sebenarnya memang belum dikerjakan.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");
    await pastikanAplikasi(db, actorUserId, "aleta-e-audit"); // HAK-PERAN 12 Okt: aplikasi belum fix

    const hasil = await getGatewayKatalogEAudit();
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
      feature: "aleta-e-audit",
      action: "katalog",
    });
  }
}
