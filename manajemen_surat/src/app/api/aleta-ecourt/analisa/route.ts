import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { getGatewayAnalisaPerkara } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Satu analisis lanjutan atas satu perkara.
 *
 * ============================================================================
 * DIMUAT SAAT DIMINTA, BUKAN SAAT PERKARA DIBUKA
 * ============================================================================
 *
 * Sepuluh analisis, satu rute, satu jenis per permintaan. Layar Status Perkara
 * sudah berat; menambahkan sepuluh perhitungan ke dalam muatannya akan membuat
 * MEMBUKA perkara menunggu angka yang mungkin tidak akan dilihat siapa pun.
 *
 * Kewenangannya sama dengan layar status perkara itu sendiri - isinya
 * keterangan perkara yang sama, hanya disusun sebagai analisis.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");

    const nomor = String(request.nextUrl.searchParams.get("nomor") || "").trim();
    const jenis = String(request.nextUrl.searchParams.get("jenis") || "").trim();

    if (!nomor || !jenis) {
      return ok({ available: true, ok: false, alasan: "Nomor perkara dan jenis analisis wajib diisi." });
    }

    const hasil = await getGatewayAnalisaPerkara(nomor, jenis);
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
      action: "SIPP_ANALISA_PERKARA_READ_FAILED",
      feature: "aleta_ecourt",
    });
  }
}
