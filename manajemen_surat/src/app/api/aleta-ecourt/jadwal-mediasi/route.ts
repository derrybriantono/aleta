import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { getGatewayJadwalMediasi } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Jadwal pertemuan mediasi pada satu rentang tanggal.
 *
 * ============================================================================
 * TERPISAH DARI JADWAL SIDANG, DAN MEMANG BEGITU SEHARUSNYA
 * ============================================================================
 *
 * Pertemuan mediasi tersimpan di tabel SIPP sendiri dan tidak pernah ikut
 * pada jadwal sidang. Petugas yang membuka Jadwal Sidang karena itu tidak
 * melihatnya sama sekali - padahal mediasi berjalan pada jam kerja yang sama,
 * memakai ruangan yang sama, dan tenggatnya lebih ketat.
 *
 * Memakai kapabilitas yang SAMA dengan jadwal sidang: keduanya keterangan
 * perkara yang sedang berjalan, dan tidak ada alasan membedakan siapa yang
 * boleh melihatnya.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");

    const p = request.nextUrl.searchParams;
    const hasil = await getGatewayJadwalMediasi({
      dari: String(p.get("dari") || "").trim(),
      sampai: String(p.get("sampai") || "").trim(),
      cari: String(p.get("cari") || "").trim(),
      batas: Number(p.get("batas")) || 200,
    });

    if (!hasil.ok) {
      return ok({
        available: false,
        message: hasil.error || "ALETA Bot belum dapat dihubungi.",
        mediasi: [],
      });
    }

    return ok({
      available: true,
      dari: hasil.data?.dari ?? "",
      sampai: hasil.data?.sampai ?? "",
      terbaca: hasil.data?.terbaca ?? false,
      alasan: hasil.data?.alasan ?? "",
      mediasi: hasil.data?.mediasi ?? [],
    });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "SIPP_JADWAL_MEDIASI_READ_FAILED",
      feature: "aleta_ecourt",
    });
  }
}
